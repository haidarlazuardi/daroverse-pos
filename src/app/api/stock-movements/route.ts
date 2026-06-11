import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';

export const GET = withAuth(async (req, user) => {
  const { searchParams } = new URL(req.url);
  const outletId = searchParams.get('outletId') || user.outletId;
  const ingredientId = searchParams.get('ingredientId');
  const type = searchParams.get('type');
  const limit = parseInt(searchParams.get('limit') || '100');

  const where: Record<string, unknown> = {};
  if (outletId) where.outletId = outletId;
  if (ingredientId) where.ingredientId = ingredientId;
  if (type) where.type = type;

  const movements = await prisma.stockMovement.findMany({
    where,
    include: { ingredient: true, outlet: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return success(movements);
}, ['ADMIN']);

export const POST = withAuth(async (req, user) => {
  const { outletId: reqOutletId, ingredientId, type, quantity, notes } = await req.json();
  const outletId = reqOutletId || user.outletId;

  if (!outletId || !ingredientId || !type || quantity === undefined) {
    return error('Outlet, ingredient, type, and quantity are required');
  }

  const validTypes = ['IN', 'OUT', 'WASTE', 'ADJUSTMENT', 'TRANSFER'];
  if (!validTypes.includes(type)) return error('Invalid movement type');

  const qtyChange = ['IN', 'ADJUSTMENT'].includes(type)
    ? Math.abs(quantity)
    : -Math.abs(quantity);

  // Update stock level
  await prisma.stockLevel.upsert({
    where: { outletId_ingredientId: { outletId, ingredientId } },
    update: { quantity: { increment: qtyChange }, lastUpdated: new Date() },
    create: { outletId, ingredientId, quantity: Math.max(0, qtyChange) },
  });

  // Log movement
  const movement = await prisma.stockMovement.create({
    data: {
      outletId,
      ingredientId,
      type,
      quantity: qtyChange,
      notes,
      createdBy: user.userId,
    },
    include: { ingredient: true },
  });

  return success(movement, 201);
}, ['ADMIN']);
