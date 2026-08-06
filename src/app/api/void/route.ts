export const dynamic = 'force-dynamic';
// DEPRECATED: gunakan /api/void-requests untuk flow request→approve
// Ini redirect handler untuk backward compat dari void page
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES } from '@/lib/auth';

// GET — list voided orders (untuk void history page)
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to   = searchParams.get('to');
  const orders = await prisma.order.findMany({
    where: {
      status: 'VOIDED',
      ...(from && to ? { createdAt: { gte: new Date(from), lte: new Date(to) } } : {}),
    },
    include: {
      payment: { select: { method: true } },
      items:   { select: { quantity: true, subtotal: true, product: { select: { name: true } } } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  return success({ orders });
}, ADMIN_ROLES);

// POST — direct void oleh admin/owner (tanpa approval flow)
export const POST = withAuth(async (req: NextRequest, user) => {
  const { orderId, voidReason, stockReturned = false } = await req.json();
  if (!orderId || !voidReason) return error('orderId dan voidReason wajib');

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: { include: { recipe: { include: { items: true } } } } } } },
  });
  if (!order) return error('Order tidak ditemukan', 404);
  if (order.status === 'VOIDED') return error('Order sudah di-void');

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'VOIDED', stockReturned, voidReason: voidReason as any },
    });

    // Return stok kalau diminta
    if (stockReturned) {
      for (const item of order.items) {
        const recipe = (item.product as any)?.recipe?.items || [];
        for (const ri of recipe) {
          await (tx as any).stockLevel.upsert({
            where: { ingredientId_location: { ingredientId: ri.ingredientId, location: 'BAR' } },
            create: { ingredientId: ri.ingredientId, location: 'BAR', quantity: ri.quantity * item.quantity },
            update: { quantity: { increment: ri.quantity * item.quantity } },
          });
          await (tx as any).stockMovement.create({
            data: { ingredientId: ri.ingredientId, location: 'BAR', type: 'VOID_RETURN',
              quantity: ri.quantity * item.quantity, notes: `Void #${order.orderNumber}`, createdBy: user.userId },
          });
        }
      }
    }
  });

  return success({ voided: true, orderNumber: order.orderNumber });
}, ADMIN_ROLES);
