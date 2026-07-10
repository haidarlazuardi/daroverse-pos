export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { SENIOR_ROLES } from '@/lib/auth';

const VOID_REASONS = ['WRONG_ITEM','CUSTOMER_CANCEL','OVERCHARGE','SYSTEM_ERROR','OTHER'];

export const POST = withAuth(async (req: NextRequest, user) => {
  const { orderId, voidReason, stockReturned = false } = await req.json();

  if (!orderId)   return error('orderId wajib diisi');
  if (!voidReason || !VOID_REASONS.includes(voidReason)) return error('Alasan void tidak valid');

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: { include: { recipe: { include: { items: { include: { ingredient: true } } } } } },
          modifiers: true,
        },
      },
      payment: true,
    },
  });
  if (!order) return error('Order tidak ditemukan', 404);
  if (order.status === 'VOIDED') return error('Order sudah di-void');
  if (order.status === 'OPEN')   return error('Order masih open, cancel dulu');

  const oldValue = { status: order.status, total: order.total };

  if (stockReturned) {
    for (const item of order.items) {
      const recipe = item.product?.recipe;
      if (!recipe) continue;
      for (const ri of recipe.items) {
        await prisma.stockLevel.updateMany({
          where: { ingredientId: ri.ingredientId, location: 'BAR' },
          data: { quantity: { increment: ri.quantity * item.quantity } },
        });
        await (prisma as any).stockMovement.create({
          data: { ingredientId: ri.ingredientId, type: 'VOID_RETURN', quantity: ri.quantity * item.quantity, location: 'BAR', notes: `Void ${order.orderNumber}`, userId: user.userId },
        });
      }
    }
  }

  const voided = await prisma.order.update({
    where: { id: orderId },
    data: { status: 'VOIDED', voidedAt: new Date(), voidedBy: user.userId, voidReason, stockReturned },
  });

  if (order.pointsEarned > 0 && order.customerId) {
    await prisma.customer.update({
      where: { id: order.customerId },
      data: { points: { decrement: order.pointsEarned }, totalSpent: { decrement: order.total }, visitCount: { decrement: 1 } },
    });
    await prisma.loyaltyLedger.create({
      data: { customerId: order.customerId, orderId, type: 'ADJUST', points: -order.pointsEarned, note: `Void ${order.orderNumber}`, createdBy: user.userId },
    });
  }

  await prisma.auditLog.create({
    data: { userId: user.userId, userName: user.name || '', action: 'VOID', entity: 'Order', entityId: orderId, oldValue, newValue: { voidReason, stockReturned } },
  });

  return success(voided);
}, SENIOR_ROLES);

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to   = searchParams.get('to');

  const orders = await prisma.order.findMany({
    where: {
      status: 'VOIDED',
      ...(from || to ? { voidedAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to + 'T23:59:59Z') } : {}) } } : {}),
    },
    include: { user: { select: { name: true } } },
    orderBy: { voidedAt: 'desc' },
    take: 50,
  });
  return success({ orders });
}, SENIOR_ROLES);
