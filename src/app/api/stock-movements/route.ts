import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES, SENIOR_ROLES } from '@/lib/auth';
import { StockLocation } from '@prisma/client';
import { ensureCan } from '@/lib/permissions';

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const location = searchParams.get('location');
  const ingredientId = searchParams.get('ingredientId');
  const type = searchParams.get('type');
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 300);

  const where: Record<string, unknown> = {};
  if (location) where.location = location as StockLocation;
  if (ingredientId) where.ingredientId = ingredientId;
  if (type) where.type = type;

  const movements = await prisma.stockMovement.findMany({
    where,
    include: { ingredient: { select: { name: true, unit: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return success(movements);
}, ADMIN_ROLES);

// Manual movement: WASTE (the staff "Buang" action) or ADJUSTMENT.
// PURCHASE/TRANSFER/PRODUCTION/SALE flow through their own engine paths.
export const POST = withAuth(async (req, user) => {
  const denied = await ensureCan(user, 'waste'); if (denied) return error(denied, 403);
  const { location, ingredientId, type, quantity, notes } = await req.json();

  if (!location || !ingredientId || !type || quantity === undefined) {
    return error('location, ingredientId, type, dan quantity wajib diisi');
  }
  if (!['WASTE', 'ADJUSTMENT'].includes(type)) return error('Tipe gerakan tidak valid');

  // WASTE always removes; ADJUSTMENT is signed.
  const qtyChange = type === 'WASTE' ? -Math.abs(quantity) : quantity;

  await prisma.stockLevel.upsert({
    where: { ingredientId_location: { ingredientId, location } },
    update: { quantity: { increment: qtyChange }, lastUpdated: new Date() },
    create: { ingredientId, location, quantity: Math.max(0, qtyChange) },
  });

  const movement = await prisma.stockMovement.create({
    data: { ingredientId, location, type, quantity: qtyChange, notes, createdBy: user.userId },
    include: { ingredient: { select: { name: true, unit: true } } },
  });
  return success(movement, 201);
}); // any authenticated user (staff 'Buang')
