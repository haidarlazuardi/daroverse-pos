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

  if (action === 'confirm') {
    // Create POS order from QR order
    const items = qrOrder.items as any[];

    // Deduct stock for each item
    for (const item of items) {
      try {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          include: { recipe: { include: { items: { include: { ingredient: true } } } } },
        });
        if (product?.recipe?.items) {
          for (const ri of product.recipe.items) {
            await prisma.stockLevel.updateMany({
              where: { ingredientId: ri.ingredientId },
              data: { quantity: { decrement: ri.quantity * item.quantity } },
            });
          }
        }
      } catch { /* silent - stock deduction best effort */ }
    }

    // Update QR order status
    await (prisma as any).qROrder.update({
      where: { id },
      data: { status: 'CONFIRMED', confirmedAt: new Date(), confirmedBy: user.userId },
    });

    // Upsert customer if phone provided
    if (qrOrder.customerPhone) {
      await prisma.customer.upsert({
        where: { phone: qrOrder.customerPhone },
        create: { name: qrOrder.customerName, phone: qrOrder.customerPhone },
        update: { name: qrOrder.customerName },
      });
    }

    return success({ confirmed: true });
  }

  if (action === 'cancel') {
    await (prisma as any).qROrder.update({ where: { id }, data: { status: 'CANCELLED' } });
    return success({ cancelled: true });
  }

  return error('Action tidak valid');
}, ALL_ROLES);
