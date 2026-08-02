export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ALL_ROLES } from '@/lib/auth';

export const POST = withAuth(async (req: NextRequest, user) => {
  const { ingredientId, quantity, location = 'BAR', reason = '' } = await req.json();
  if (!ingredientId || !quantity) return error('ingredientId dan quantity wajib');
  if (quantity <= 0) return error('Quantity harus lebih dari 0');

  const ing = await prisma.ingredient.findUnique({ where: { id: ingredientId }, select: { name: true } });
  if (!ing) return error('Bahan tidak ditemukan');

  await prisma.$transaction(async (tx) => {
    await (tx as any).stockLevel.upsert({
      where: { ingredientId_location: { ingredientId, location } },
      create: { ingredientId, location, quantity: -quantity },
      update: { quantity: { decrement: quantity } },
    });
    await (tx as any).stockMovement.create({
      data: { ingredientId, location, type: 'WASTE', quantity: -quantity,
        notes: reason || 'Waste', createdBy: user.userId },
    });
  });

  return success({ ok: true, message: `${quantity} ${ing.name} dicatat sebagai waste` });
}, ALL_ROLES);
