export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, generateOrderNumber } from '@/lib/api-helpers';
import { authenticate, ADMIN_ROLES, SENIOR_ROLES } from '@/lib/auth';
import {
  computeOrderRequirements,
  applyDeductionsInTx,
  reverseStockForOrder,
  OrderItemInput,
} from '@/lib/stock-engine';
import { Prisma } from '@prisma/client';

// ── Client payload shapes ──
interface ClientModifier {
  groupName: string;
  optionName: string;
  effect: 'ADJUST' | 'ADD';
  targetIngredientId: string | null;
  multiplier?: number | null;
  addQty?: number | null;
  priceDelta?: number | null;
}
interface ClientItem {
  productId: string;
  quantity: number;
  notes?: string | null;
  modifiers?: ClientModifier[];
}

// ── Settings helper (rates kept in AppSetting, parsed with safe fallbacks) ──
async function getSettings() {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: ['tax_rate', 'service_rate', 'loyalty_earn_divisor', 'loyalty_redeem_value'] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const num = (k: string, d: number) => {
    const v = parseFloat(String(map.get(k) || ''));
    return Number.isFinite(v) ? v : d;
  };
  return {
    taxRate: num('tax_rate', 0.1),
    serviceRate: num('service_rate', 0.05),
    earnDivisor: num('loyalty_earn_divisor', 1000), // 1 point / Rp1000
    redeemValue: num('loyalty_redeem_value', 100), // Rp100 / point
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

// ── Calc stack: tax & service from PRODUCT subtotal only; takeaway charge
//    and redeem discount sit OUTSIDE tax. All charges optional. ──
function computeCalcStack(p: {
  subtotal: number;
  discountAmount: number;
  redeemDiscount: number;
  takeawayCharge: number;
  taxEnabled: boolean;
  serviceEnabled: boolean;
  taxRate: number;
  serviceRate: number;
}) {
  const tax = p.taxEnabled ? round(p.subtotal * p.taxRate) : 0;
  const serviceCharge = p.serviceEnabled ? round(p.subtotal * p.serviceRate) : 0;
  const total = round(
    p.subtotal + tax + serviceCharge + p.takeawayCharge - p.discountAmount - p.redeemDiscount
  );
  return { tax, serviceCharge, total: Math.max(0, total) };
}

function toEngineItems(items: ClientItem[]): OrderItemInput[] {
  return items.map((i) => ({
    productId: i.productId,
    quantity: i.quantity,
    modifiers: (i.modifiers || []).map((m) => ({
      effect: m.effect,
      targetIngredientId: m.targetIngredientId,
      multiplier: m.multiplier,
      addQty: m.addQty,
    })),
  }));
}

const stripForCashier = (order: any) => ({
  ...order,
  costTotal: undefined,
  profit: undefined,
  items: order.items?.map(({ cost, ...i }: any) => i) ?? order.items,
});

// ─────────────────────────────────────────────────────────
//  GET — list orders
// ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return error('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const id     = searchParams.get('id');
  const status = searchParams.get('status');
  const shiftId = searchParams.get('shiftId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
  const offset = parseInt(searchParams.get('offset') || '0');

  // Single order fetch
  if (id) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true, modifiers: true } },
        payment: true, customer: true,
      },
    });
    if (!order) return error('Order tidak ditemukan', 404);
    return success(order);
  }

  const where: any = {};
  if (status) where.status = status as any;
  // Queue mode: COMPLETED orders not yet served to customer
  if (searchParams.get('queue') === 'true') {
    where.status = 'COMPLETED';
    where.servedAt = null;
  }
  if (shiftId) where.shiftId = shiftId;
  if (!ADMIN_ROLES.includes(user.role)) where.userId = user.userId;
  if (from || to) {
    where.createdAt = {};
    // Support both plain date (YYYY-MM-DD) and full ISO string
    if (from) where.createdAt.gte = new Date(from.includes('T') ? from : from + 'T00:00:00.000Z');
    if (to)   where.createdAt.lte = new Date(to.includes('T')   ? to   : to   + 'T23:59:59.999Z');
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        items: { include: { product: { select: { name: true, station: true } }, modifiers: true } },
        payment: true,
        user: { select: { name: true } },
        customer: { select: { name: true, phone: true } },
        discountRef: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.order.count({ where }),
  ]);

  const data = !ADMIN_ROLES.includes(user.role) ? orders.map(stripForCashier) : orders;
  return success({ orders: data, total, limit, offset });
}

// ─────────────────────────────────────────────────────────
//  POST — create order (immediate sale OR open bill).
//  Stock is deducted on creation in BOTH cases (deduction-when-item-made).
// ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return error('Unauthorized', 401);

  try {
    const body = await req.json();
    const {
      items, notes, customerId, customerName, customerPhone,
      paymentMethod, paymentReference, received,
      discountId, splitGroup, splitIndex, billName,
      orderType = 'DINE_IN',
      taxEnabled = false, serviceEnabled = false,
      redeemPoints = 0,
      open = false, // true = open bill (status OPEN); false = immediate COMPLETED
    } = body as {
      items: ClientItem[]; notes?: string; customerId?: string;
      customerName?: string; customerPhone?: string;
      paymentMethod?: string; paymentReference?: string; received?: number;
      discountId?: string; splitGroup?: string; splitIndex?: number; billName?: string;
      orderType?: 'DINE_IN' | 'TAKEAWAY';
      taxEnabled?: boolean; serviceEnabled?: boolean; redeemPoints?: number; open?: boolean;
    };

    if (!items?.length) return error('Order harus punya minimal satu item');
    const productIds = items.map((i) => i.productId);

    const [products, requirements, activeShift, disc, settings] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds }, active: true },
        select: { id: true, name: true, price: true, station: true, takeawayCharge: true },
      }),
      computeOrderRequirements(toEngineItems(items), orderType),
      prisma.shift.findFirst({ where: { status: { in: ['OPEN', 'PENDING_CLOSE'] } }, orderBy: { openedAt: 'desc' } }),
      discountId ? prisma.discount.findUnique({ where: { id: discountId } }) : Promise.resolve(null),
      getSettings(),
    ]);
    if (products.length !== new Set(productIds).size) return error('Sebagian produk tidak tersedia');

    const productMap = new Map((products as any[]).map((p: any) => [p.id, p]));

    // Build order items (price includes add-on priceDelta; cost from engine lines).
    const orderItems = items.map((item, idx) => {
      const product = productMap.get(item.productId)!;
      const addOnPrice = (item.modifiers || []).reduce((s, m) => s + (m.priceDelta || 0), 0);
      const unitPrice = product.price + addOnPrice;
      const unitCost = requirements.lines[idx]?.unitCost || 0;
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: unitPrice,
        cost: unitCost,
        subtotal: unitPrice * item.quantity,
        notes: item.notes || null,
        modifiers: {
          create: (item.modifiers || []).map((m) => ({
            groupName: m.groupName,
            optionName: m.optionName,
            effect: m.effect,
            targetIngredientId: m.targetIngredientId,
            multiplier: m.multiplier ?? null,
            addQty: m.addQty ?? null,
            priceDelta: m.priceDelta ?? 0,
          })),
        },
      };
    });

    const subtotal = round(orderItems.reduce((s, i) => s + i.subtotal, 0));

    // Take-away charge: per-food-item, only when TAKEAWAY (outside tax).
    let takeawayCharge = 0;
    if (orderType === 'TAKEAWAY') {
      for (const item of items) {
        const p = productMap.get(item.productId)!;
        if (p.station === 'FOOD') takeawayCharge += p.takeawayCharge * item.quantity;
      }
    }
    takeawayCharge = round(takeawayCharge);

    // Discount (server-side; never trusts client amounts).
    let discountAmount = 0;
    let discountLabel: string | null = null;
    if (disc && disc.active && (!disc.minOrder || subtotal >= disc.minOrder)) {
      discountAmount = disc.type === 'PERCENT'
        ? Math.min(subtotal * (disc.value / 100), disc.maxDiscount ?? Infinity)
        : Math.min(disc.value, subtotal);
      discountAmount = round(discountAmount);
      discountLabel = disc.name;
    }

    // Customer (upsert by phone — phone is unique, fixes the dup bug).
    let finalCustomerId = customerId || null;
    let customer = finalCustomerId
      ? await prisma.customer.findUnique({ where: { id: finalCustomerId } })
      : null;
    if (!customer && customerPhone) {
      customer = await prisma.customer.upsert({
        where: { phone: customerPhone },
        update: customerName ? { name: customerName } : {},
        create: { name: customerName || 'Customer', phone: customerPhone, memberSince: new Date() },
      });
      finalCustomerId = customer.id;
    }

    // Loyalty redeem (only on immediate completion, capped to balance & total).
    let redeemDiscount = 0;
    let pointsRedeemed = 0;
    if (!open && customer && redeemPoints > 0) {
      pointsRedeemed = Math.min(redeemPoints, customer.points);
      redeemDiscount = round(pointsRedeemed * settings.redeemValue);
    }

    const { tax, serviceCharge, total } = computeCalcStack({
      subtotal, discountAmount, redeemDiscount, takeawayCharge,
      taxEnabled, serviceEnabled, taxRate: settings.taxRate, serviceRate: settings.serviceRate,
    });

    // Cap redeem so total never goes negative; recompute if clipped.
    if (redeemDiscount > 0 && total === 0 && subtotal + tax + serviceCharge + takeawayCharge - discountAmount < redeemDiscount) {
      redeemDiscount = round(subtotal + tax + serviceCharge + takeawayCharge - discountAmount);
      pointsRedeemed = Math.floor(redeemDiscount / settings.redeemValue);
    }

    const totalCost = round(requirements.totalCost);
    const profit = round(total - totalCost);
    const pointsEarned = open ? 0 : Math.floor(total / settings.earnDivisor);
    const paymentReceived = received ?? total;
    const change = Math.max(0, round(paymentReceived - total));

    // ── ONE transaction: order + items + modifiers + (payment) + deduction + loyalty ──
    const order = await prisma.$transaction(async (tx) => {
      const ord = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          orderType,
          userId: user.userId,
          shiftId: activeShift?.id || null,
          customerId: finalCustomerId,
          discountId: discountId || null,
          status: open ? 'OPEN' : 'COMPLETED',
          billName: billName || customerName || null,
          subtotal,
          taxEnabled, taxRate: settings.taxRate, tax,
          serviceEnabled, serviceRate: settings.serviceRate, serviceCharge,
          takeawayCharge,
          discount: discountAmount, discountLabel,
          pointsEarned, pointsRedeemed,
          total, costTotal: totalCost, profit,
          notes: notes || null,
          splitGroup: splitGroup || null,
          splitIndex: splitIndex ?? null,
          items: { create: orderItems },
          ...(open ? {} : {
            payment: {
              create: {
                method: (paymentMethod as any) || 'CASH',
                status: 'PAID',
                amount: total,
                received: paymentReceived,
                change,
                reference: paymentReference || null,
              },
            },
          }),
        },
        include: { items: { include: { product: { select: { name: true } }, modifiers: true } }, payment: true },
      });

      // Deduct stock on creation (both OPEN and COMPLETED).
      await applyDeductionsInTx(tx, requirements.deductions, requirements.costPerUnit, ord.id, user.userId);

      // Loyalty only settles on a completed sale.
      if (!open && finalCustomerId) {
        const ledger: any[] = [];
        if (pointsEarned > 0) ledger.push({ customerId: finalCustomerId, orderId: ord.id, type: 'EARN', points: pointsEarned });
        if (pointsRedeemed > 0) ledger.push({ customerId: finalCustomerId, orderId: ord.id, type: 'REDEEM', points: -pointsRedeemed });
        if (ledger.length) await tx.loyaltyLedger.createMany({ data: ledger });
        await tx.customer.update({
          where: { id: finalCustomerId },
          data: {
            points: { increment: pointsEarned - pointsRedeemed },
            totalSpent: { increment: total },
            visitCount: { increment: 1 },
            lastVisitAt: new Date(),
          },
        });
      }
      return ord;
    });

    return success(!ADMIN_ROLES.includes(user.role) ? stripForCashier(order) : order, 201);
  } catch (e: any) {
    console.error('Order creation error:', e);
    return error(e.message || 'Gagal membuat order', 500);
  }
}

// ─────────────────────────────────────────────────────────
//  PATCH — addItems (open bill) | complete | cancel | refund
// ─────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return error('Unauthorized', 401);

  try {
    const body = await req.json();
    const { orderId, action } = body;
    if (!orderId || !action) return error('orderId dan action wajib diisi');

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { modifiers: true } }, payment: true },
    });
    if (!order) return error('Order tidak ditemukan');

    // Reconstruct engine inputs from stored items + modifier snapshots.
    const itemInputs: OrderItemInput[] = order.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      modifiers: i.modifiers.map((m) => ({
        effect: m.effect, targetIngredientId: m.targetIngredientId,
        multiplier: m.multiplier, addQty: m.addQty,
      })),
    }));

    // ── Add items to an open bill (deduct only the new items) ──
    if (action === 'addItems' && order.status === 'OPEN') {
      const newItems = body.items as ClientItem[];
      if (!newItems?.length) return error('Tidak ada item untuk ditambahkan');

      const productIds = newItems.map((i) => i.productId);
      const [products, req2] = await Promise.all([
        prisma.product.findMany({ where: { id: { in: productIds }, active: true }, select: { id: true, price: true } }),
        computeOrderRequirements(toEngineItems(newItems), order.orderType as 'DINE_IN' | 'TAKEAWAY'),
      ]);
      const pm = new Map((products as any[]).map((p: any) => [p.id, p]));

      const created = newItems.map((item, idx) => {
        const p = pm.get(item.productId)!;
        const addOn = (item.modifiers || []).reduce((s, m) => s + (m.priceDelta || 0), 0);
        const unitPrice = p.price + addOn;
        return {
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          price: unitPrice,
          cost: req2.lines[idx]?.unitCost || 0,
          subtotal: unitPrice * item.quantity,
          notes: item.notes || null,
          modifiers: (item.modifiers || []).map((m) => ({
            groupName: m.groupName, optionName: m.optionName, effect: m.effect,
            targetIngredientId: m.targetIngredientId, multiplier: m.multiplier ?? null,
            addQty: m.addQty ?? null, priceDelta: m.priceDelta ?? 0,
          })),
        };
      });

      await prisma.$transaction(async (tx) => {
        for (const ci of created) {
          await tx.orderItem.create({
            data: {
              orderId: ci.orderId, productId: ci.productId, quantity: ci.quantity,
              price: ci.price, cost: ci.cost, subtotal: ci.subtotal, notes: ci.notes,
              modifiers: { create: ci.modifiers },
            },
          });
        }
        const addSubtotal = round(created.reduce((s, i) => s + i.subtotal, 0));
        const addCost = round(created.reduce((s, i) => s + i.cost * i.quantity, 0));
        await tx.order.update({
          where: { id: order.id },
          data: {
            subtotal: { increment: addSubtotal },
            total: { increment: addSubtotal },
            costTotal: { increment: addCost },
          },
        });
        await applyDeductionsInTx(tx, req2.deductions, req2.costPerUnit, order.id, user.userId);
      });
      return success({ added: created.length });
    }

    // ── Close an open bill (payment + loyalty; stock already deducted) ──
    // Mark as served (handed to customer)
    if (action === 'complete_serve') {
      await (prisma.order as any).update({
        where: { id: order.id },
        data: { servedAt: new Date(), servedBy: user.userId },
      });
      return success({ served: true });
    }

    if (action === 'complete' && order.status === 'OPEN') {
      const settings = await getSettings();
      const taxEnabled = body.taxEnabled ?? order.taxEnabled;
      const serviceEnabled = body.serviceEnabled ?? order.serviceEnabled;

      const { tax, serviceCharge, total } = computeCalcStack({
        subtotal: order.subtotal, discountAmount: order.discount, redeemDiscount: 0,
        takeawayCharge: order.takeawayCharge, taxEnabled, serviceEnabled,
        taxRate: settings.taxRate, serviceRate: settings.serviceRate,
      });
      const pointsEarned = order.customerId ? Math.floor(total / settings.earnDivisor) : 0;
      const paymentReceived = body.received ?? total;
      const change = Math.max(0, round(paymentReceived - total));

      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'COMPLETED', taxEnabled, serviceEnabled, tax, serviceCharge,
            total, profit: round(total - order.costTotal), pointsEarned,
            payment: {
              create: {
                method: (body.paymentMethod as any) || 'CASH', status: 'PAID',
                amount: total, received: paymentReceived, change,
                reference: body.paymentReference || null,
              },
            },
          },
        });
        if (order.customerId) {
          if (pointsEarned > 0) await tx.loyaltyLedger.create({ data: { customerId: order.customerId, orderId: order.id, type: 'EARN', points: pointsEarned } });
          await tx.customer.update({
            where: { id: order.customerId },
            data: { points: { increment: pointsEarned }, totalSpent: { increment: total }, visitCount: { increment: 1 }, lastVisitAt: new Date() },
          });
        }
      });
      return success({ completed: true });
    }

    // ── Cancel an open bill (reverse the stock it already deducted) ──
    if (action === 'cancel' && order.status === 'OPEN') {
      await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
      await reverseStockForOrder(itemInputs, order.orderType as 'DINE_IN' | 'TAKEAWAY', order.id, user.userId);
      return success({ cancelled: true });
    }

    // ── Refund a completed order (admin only) ──
    if (action === 'refund' && order.status === 'COMPLETED') {
      if (!SENIOR_ROLES.includes(user.role)) return error('Hanya admin yang bisa refund', 403);

      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'REFUNDED', refundedAt: new Date(), refundReason: body.refundReason || null, refundBy: user.userId },
        });
        if (order.payment) await tx.payment.update({ where: { id: order.payment.id }, data: { status: 'REFUNDED' } });
        if (order.customerId && (order.pointsEarned || order.pointsRedeemed)) {
          await tx.customer.update({
            where: { id: order.customerId },
            data: { points: { increment: order.pointsRedeemed - order.pointsEarned }, totalSpent: { decrement: order.total } },
          });
        }
      });
      await reverseStockForOrder(itemInputs, order.orderType as 'DINE_IN' | 'TAKEAWAY', order.id, user.userId);
      return success({ refunded: true });
    }

    return error('Aksi tidak valid untuk status order ini');
  } catch (e: any) {
    console.error('Order update error:', e);
    return error(e.message || 'Gagal', 500);
  }
}
