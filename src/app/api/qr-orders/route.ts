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
    const items = qrOrder.items as any[];

    // Upsert customer by phone
    if (qrOrder.customerPhone) {
      await prisma.customer.upsert({
        where: { phone: qrOrder.customerPhone },
        create: { name: qrOrder.customerName, phone: qrOrder.customerPhone },
        update: { name: qrOrder.customerName },
      });
    }

    // Update QR order status
    await (prisma as any).qROrder.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        confirmedBy: user.userId,
      },
    });

    // Deduct stock + log movement (best effort)
    for (const item of items) {
      try {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          include: { recipe: { include: { items: true } } },
        });
        if (product?.recipe?.items) {
          for (const ri of product.recipe.items) {
            const deductQty = ri.quantity * item.quantity;
            await prisma.stockLevel.updateMany({
              where: { ingredientId: ri.ingredientId },
              data: { quantity: { decrement: deductQty } },
            });
            await prisma.stockMovement.create({
              data: {
                ingredientId: ri.ingredientId,
                type: 'SALE' as any,
                quantity: -deductQty,
                location: product.station === 'FOOD' ? 'KITCHEN' : 'BAR',
                notes: `Sales — ${item.name} ×${item.quantity}`,
                createdBy: user.userId,
              },
            });
          }
        }
      } catch { /* silent */ }
    }

    return success({ confirmed: true });
  }

  if (action === 'cancel') {
    await (prisma as any).qROrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    return success({ cancelled: true });
  }

  return error('Action tidak valid');
}, ALL_ROLES);
