export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ALL_ROLES, ADMIN_ROLES } from '@/lib/auth';

// GET — list void requests (admin: all, staff: own)
export const GET = withAuth(async (req: NextRequest, user) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || undefined;
  const requests = await (prisma as any).voidRequest.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(!ADMIN_ROLES.includes(user.role) ? { requestedBy: user.userId } : {}),
    },
    include: {
      order: { select: { orderNumber: true, total: true, billName: true, createdAt: true } },
      user:  { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return success(requests);
}, ALL_ROLES);

// POST — staff request void
export const POST = withAuth(async (req: NextRequest, user) => {
  const { orderId, reason } = await req.json();
  if (!orderId || !reason) return error('orderId dan reason wajib');

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return error('Order tidak ditemukan', 404);
  if (order.status === 'VOID') return error('Order sudah di-void');

  // Cek sudah ada pending request
  const existing = await (prisma as any).voidRequest.findFirst({
    where: { orderId, status: 'PENDING' },
  });
  if (existing) return error('Sudah ada void request pending untuk order ini');

  const vr = await (prisma as any).voidRequest.create({
    data: { orderId, requestedBy: user.userId, reason },
  });
  return success(vr, 201);
}, ALL_ROLES);

// PATCH — admin approve/reject
export const PATCH = withAuth(async (req: NextRequest, user) => {
  const { id, action, reviewNote } = await req.json();
  if (!id || !action) return error('id dan action wajib');

  const vr = await (prisma as any).voidRequest.findUnique({
    where: { id },
    include: {
      order: {
        include: {
          items: {
            include: {
              product: { select: { name: true, station: true } },
            },
          },
        },
      },
    },
  });
  if (!vr) return error('Void request tidak ditemukan', 404);
  if (vr.status !== 'PENDING') return error('Request sudah diproses');

  if (action === 'approve') {
    await prisma.$transaction(async (tx) => {
      // Update order status
      await tx.order.update({ where: { id: vr.orderId }, data: { status: 'VOID' as any } });

      // Reverse stok — lookup resep per product
      for (const item of vr.order?.items || []) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: { recipe: { include: { items: true } } },
        });
        const recipeItems = (product as any)?.recipe?.items || [];
        for (const ri of recipeItems) {
          const qty = ri.quantity * item.quantity;
          await (tx as any).stockLevel.upsert({
            where: { ingredientId_location: { ingredientId: ri.ingredientId, location: 'BAR' } },
            create: { ingredientId: ri.ingredientId, location: 'BAR', quantity: qty },
            update: { quantity: { increment: qty } },
          });
          await (tx as any).stockMovement.create({
            data: { ingredientId: ri.ingredientId, location: 'BAR', type: 'VOID_REVERSE', quantity: qty,
              notes: `Void order #${vr.order?.orderNumber}`, createdBy: user.userId },
          });
        }
      }

      // Update void request
      await (tx as any).voidRequest.update({
        where: { id },
        data: { status: 'APPROVED', reviewedBy: user.userId, reviewNote: reviewNote || null },
      });
    });
    return success({ approved: true });
  }

  if (action === 'reject') {
    await (prisma as any).voidRequest.update({
      where: { id },
      data: { status: 'REJECTED', reviewedBy: user.userId, reviewNote: reviewNote || null },
    });
    return success({ rejected: true });
  }

  return error('Action tidak valid');
}, ADMIN_ROLES);
