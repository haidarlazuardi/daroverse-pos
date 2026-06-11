import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, generateOrderNumber } from '@/lib/api-helpers';
import { authenticate } from '@/lib/auth';
import { computeOrderRequirements, applyDeductionsInTx, reverseStockForOrder } from '@/lib/stock-engine';

export async function GET(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return error('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const outletId = searchParams.get('outletId') || user.outletId;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const shiftId = searchParams.get('shiftId');

  const where: Record<string, unknown> = {};
  if (outletId) where.outletId = outletId;
  if (status) where.status = status;
  if (shiftId) where.shiftId = shiftId;
  if (user.role === 'CASHIER') where.userId = user.userId;
  if (from || to) {
    where.createdAt = {};
    if (from) (where.createdAt as any).gte = new Date(from);
    if (to) (where.createdAt as any).lte = new Date(to + 'T23:59:59.999Z');
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        items: { include: { product: true } },
        payment: true,
        user: { select: { name: true } },
        customer: true,
        discountRef: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.order.count({ where }),
  ]);

  const data = user.role === 'CASHIER'
    ? orders.map(({ costTotal, profit, ...o }: any) => ({ ...o, items: o.items.map(({ cost, ...i }: any) => i) }))
    : orders;

  return success({ orders: data, total, limit, offset });
}

export async function POST(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return error('Unauthorized', 401);

  try {
    const body = await req.json();
    const {
      items, notes, customerId, paymentMethod, received,
      outletId: reqOutletId, discountId, status: reqStatus,
      splitGroup, splitIndex, customerName, customerPhone,
    } = body;

    if (!items?.length) return error('Order must have at least one item');
    const outletId = reqOutletId || user.outletId;
    if (!outletId) return error('No outlet assigned');

    // ── Parallel pre-fetch (3 queries at once instead of sequential) ──
    const productIds = items.map((i: any) => i.productId);
    const [outlet, products, requirements, activeShift, disc] = await Promise.all([
      prisma.outlet.findUnique({ where: { id: outletId } }),
      prisma.product.findMany({ where: { id: { in: productIds }, active: true } }),
      computeOrderRequirements(items),
      prisma.shift.findFirst({ where: { userId: user.userId, closedAt: null } }),
      discountId ? prisma.discount.findUnique({ where: { id: discountId } }) : Promise.resolve(null),
    ]);

    if (!outlet) return error('Outlet not found');
    if (products.length !== productIds.length) return error('Some products are unavailable');

    const taxRate = outlet.taxRate || 0.11;
    const { totalCost, itemCosts, deductions, costPerUnit } = requirements;

    const orderItems = items.map((item: any) => {
      const product = products.find((p: any) => p.id === item.productId)!;
      const unitCost = itemCosts.get(item.productId) || 0;
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        cost: unitCost,
        subtotal: product.price * item.quantity,
        notes: item.notes || null,
      };
    });

    const subtotal = orderItems.reduce((s: number, i: any) => s + i.subtotal, 0);

    // Discount (server-side, never trusts client amounts)
    let discountAmount = 0;
    let discountLabel: string | null = null;
    if (disc && disc.active && (!disc.minOrder || subtotal >= disc.minOrder)) {
      if (disc.type === 'PERCENT') {
        discountAmount = subtotal * (disc.value / 100);
        if (disc.maxDiscount) discountAmount = Math.min(discountAmount, disc.maxDiscount);
      } else {
        discountAmount = Math.min(disc.value, subtotal);
      }
      discountLabel = disc.name;
    }

    const taxableAmount = subtotal - discountAmount;
    const tax = taxableAmount * taxRate;
    const total = taxableAmount + tax;
    const profit = total - totalCost;
    const paymentReceived = received || total;
    const change = Math.max(0, paymentReceived - total);
    const isHold = reqStatus === 'HOLD';

    // Optional: link/create customer for WhatsApp receipt tracking
    let finalCustomerId = customerId || null;
    if (!finalCustomerId && customerPhone) {
      const customer = await prisma.customer.upsert({
        where: { id: customerPhone }, // phone-as-key fallback won't match; create path below
        update: {},
        create: { name: customerName || 'Customer', phone: customerPhone },
      }).catch(() =>
        prisma.customer.create({ data: { name: customerName || 'Customer', phone: customerPhone } })
      );
      finalCustomerId = customer?.id || null;
    }

    // ── ONE transaction: order + payment + stock deduction + movements ──
    // If anything fails, EVERYTHING rolls back. No more orphan orders
    // with undeducted stock.
    const order = await prisma.$transaction(async (tx) => {
      const ord = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          outletId,
          userId: user.userId,
          shiftId: activeShift?.id || null,
          customerId: finalCustomerId,
          discountId: discountId || null,
          status: isHold ? 'HOLD' : 'COMPLETED',
          subtotal, tax, taxRate,
          discount: discountAmount,
          discountLabel,
          total,
          costTotal: totalCost,
          profit,
          notes: notes || null,
          splitGroup: splitGroup || null,
          splitIndex: splitIndex || null,
          items: { create: orderItems },
          ...(!isHold && {
            payment: {
              create: {
                method: paymentMethod || 'CASH',
                status: 'PAID',
                amount: total,
                received: paymentReceived,
                change,
              },
            },
          }),
        },
        include: { items: { include: { product: true } }, payment: true, discountRef: true },
      });

      if (!isHold) {
        await applyDeductionsInTx(tx, outletId, deductions, costPerUnit, ord.id, user.userId);
      }
      return ord;
    });

    const responseOrder = user.role === 'CASHIER'
      ? { ...order, costTotal: undefined, profit: undefined }
      : order;

    return success(responseOrder, 201);
  } catch (e: any) {
    console.error('Order creation error:', e);
    return error(e.message || 'Failed to create order', 500);
  }
}

// PATCH: hold → complete, refund, cancel
export async function PATCH(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return error('Unauthorized', 401);

  try {
    const { orderId, action, paymentMethod, received, refundReason } = await req.json();
    if (!orderId || !action) return error('Order ID and action are required');

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payment: true },
    });
    if (!order) return error('Order not found');

    if (action === 'complete' && order.status === 'HOLD') {
      const paymentReceived = received || order.total;
      const change = Math.max(0, paymentReceived - order.total);
      const itemInputs = order.items.map(i => ({ productId: i.productId, quantity: i.quantity }));
      const { deductions, costPerUnit } = await computeOrderRequirements(itemInputs);

      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: 'COMPLETED',
            payment: {
              create: {
                method: paymentMethod || 'CASH',
                status: 'PAID',
                amount: order.total,
                received: paymentReceived,
                change,
              },
            },
          },
        });
        await applyDeductionsInTx(tx, order.outletId, deductions, costPerUnit, order.id, user.userId);
      });
      return success({ completed: true });
    }

    if (action === 'cancel' && order.status === 'HOLD') {
      await prisma.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
      return success({ cancelled: true });
    }

    if (action === 'refund' && order.status === 'COMPLETED') {
      if (user.role !== 'ADMIN') return error('Only admin can refund', 403);

      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'REFUNDED', refundedAt: new Date(), refundReason: refundReason || null, refundBy: user.userId },
      });
      if (order.payment) {
        await prisma.payment.update({ where: { id: order.payment.id }, data: { status: 'REFUNDED' } });
      }
      await reverseStockForOrder(
        order.outletId,
        order.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
        order.id, user.userId
      );
      return success({ refunded: true });
    }

    return error('Invalid action for current order status');
  } catch (e: any) {
    return error(e.message || 'Failed', 500);
  }
}
