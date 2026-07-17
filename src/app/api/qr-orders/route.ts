export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ALL_ROLES } from '@/lib/auth';

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'PAYMENT_UPLOADED';
  const orders = await (prisma as any).qROrder.findMany({
    where: { status },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return success(orders);
});

export const PATCH = withAuth(async (req: NextRequest, user) => {
  const { id, action } = await req.json();
  if (!id || !action) return error('id dan action wajib');

  const qrOrder = await (prisma as any).qROrder.findUnique({ where: { id } });
  if (!qrOrder) return error('Order tidak ditemukan', 404);

  // ── CANCEL ────────────────────────────────────────────────────────────────
  if (action === 'cancel') {
    await (prisma as any).qROrder.update({ where: { id }, data: { status: 'CANCELLED' } });
    return success({ cancelled: true });
  }

  // ── CONFIRM ───────────────────────────────────────────────────────────────
  if (action === 'confirm') {
    const items = qrOrder.items as any[];
    const subtotal = items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);

    // 1. Upsert customer by phone
    let customerId: string | null = null;
    if (qrOrder.customerPhone) {
      const customer = await prisma.customer.upsert({
        where: { phone: qrOrder.customerPhone },
        create: { name: qrOrder.customerName, phone: qrOrder.customerPhone },
        update: {},
      });
      customerId = customer.id;
    }

    // 2. Create POS Order — masuk queue (COMPLETED + servedAt null)
    const now = new Date();
    const orderNum = `ORD-${now.getFullYear().toString().slice(2)}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;

    let posOrderId: string | null = null;
    try {
      const posOrder = await prisma.order.create({
        data: {
          orderNumber: orderNum,
          userId: user.userId,
          status: 'COMPLETED' as any,
          orderType: 'DINE_IN' as any,
          customerId,
          billName: `${qrOrder.customerName} (Meja ${qrOrder.tableId})`,
          subtotal,
          discount: 0,
          tax: 0,
          serviceCharge: 0,
          takeawayCharge: 0,
          total: subtotal,
          costTotal: 0,
          profit: 0,
          taxEnabled: false,
          serviceEnabled: false,
          notes: `[QR Menu] Meja ${qrOrder.tableId}`,
          // servedAt = null → masuk queue
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              cost: 0,
              subtotal: item.price * item.quantity,
            })),
          },
          payment: {
            create: {
              method: 'QRIS' as any,
              status: 'COMPLETED' as any,
              amount: subtotal,
              received: subtotal,
              change: 0,
            },
          },
        } as any,
      });
      posOrderId = posOrder.id;
    } catch (e: any) {
      console.error('Failed to create POS order from QR:', e.message);
      // Still confirm the QR order even if POS order fails
    }

    // 3. Update QR order status
    await (prisma as any).qROrder.update({
      where: { id },
      data: { status: 'CONFIRMED', confirmedAt: new Date(), confirmedBy: user.userId, posOrderId },
    });

    // 4. Deduct stock + log movement (best effort)
    for (const item of items) {
      try {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          include: { recipe: { include: { items: true } } },
        });
        if (product?.recipe?.items?.length) {
          for (const ri of product.recipe.items) {
            const qty = ri.quantity * item.quantity;
            await prisma.stockLevel.updateMany({
              where: { ingredientId: ri.ingredientId },
              data: { quantity: { decrement: qty } },
            });
            try {
              await prisma.stockMovement.create({
                data: {
                  ingredientId: ri.ingredientId,
                  type: 'SALE' as any,
                  quantity: -qty,
                  location: product.station === 'FOOD' ? 'KITCHEN' : 'BAR',
                  notes: `Sales — ${item.name} ×${item.quantity}`,
                  createdBy: user.userId,
                },
              });
            } catch { /* StockMovement table mungkin belum ada — skip */ }
          }
        }
      } catch { /* silent */ }
    }

    return success({ confirmed: true, posOrderId });
  }

  return error('Action tidak valid');
}, ALL_ROLES);
