export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth, generateOrderNumber } from '@/lib/api-helpers';
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

  if (action === 'confirm') {
    const items = qrOrder.items as any[];

    // Upsert customer
    let customerId: string | null = null;
    if (qrOrder.customerPhone) {
      const customer = await prisma.customer.upsert({
        where: { phone: qrOrder.customerPhone },
        create: { name: qrOrder.customerName, phone: qrOrder.customerPhone },
        update: { name: qrOrder.customerName },
      });
      customerId = customer.id;
    }

    // Create real POS Order so it appears in queue
    const subtotal = items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
    const now = new Date();
    const orderNum = `ORD-${now.getFullYear().toString().slice(2)}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;

    const posOrder = await prisma.order.create({
      data: {
        orderNumber: orderNum,
        status: 'COMPLETED' as any,
        orderType: 'DINE_IN' as any,
        subtotal,
        discount: 0,
        tax: 0,
        serviceCharge: 0,
        takeawayCharge: 0,
        total: subtotal,
        costTotal: 0,
        taxEnabled: false,
        serviceEnabled: false,
        customerName: qrOrder.customerName,
        customerId,
        notes: `[QR Menu] Meja ${qrOrder.tableId}`,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.price,
            subtotal: item.price * item.quantity,
            price: item.price,
            cost: 0,
          })),
        },
        payment: {
          create: {
            method: 'QRIS' as any,
            amount: subtotal,
            received: subtotal,
            change: 0,
            status: 'COMPLETED' as any,
          },
        },
      } as any,
    });

    // Deduct stock
    for (const item of items) {
      try {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          include: { recipe: { include: { items: true } } },
        });
        if (product?.recipe?.items) {
          for (const ri of product.recipe.items) {
            await prisma.stockLevel.updateMany({
              where: { ingredientId: ri.ingredientId },
              data: { quantity: { decrement: ri.quantity * item.quantity } },
            });
          }
        }
      } catch { /* silent */ }
    }

    // Update QR order — link to POS order
    await (prisma as any).qROrder.update({
      where: { id },
      data: { status: 'CONFIRMED', confirmedAt: new Date(), confirmedBy: user.userId, posOrderId: posOrder.id },
    });

    return success({ confirmed: true, posOrderId: posOrder.id });
  }

  if (action === 'cancel') {
    await (prisma as any).qROrder.update({ where: { id }, data: { status: 'CANCELLED' } });
    return success({ cancelled: true });
  }

  return error('Action tidak valid');
}, ALL_ROLES);
