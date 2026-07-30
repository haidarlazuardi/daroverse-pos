export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ALL_ROLES } from '@/lib/auth';

export const POST = withAuth(async (req: NextRequest, user) => {
  const { ingredientId, fromLocation, toLocation, quantity, notes } = await req.json();
  if (!ingredientId || !fromLocation || !toLocation || !quantity) return error('Data tidak lengkap');
  if (fromLocation === toLocation) return error('Lokasi asal dan tujuan sama');
  if (quantity <= 0) return error('Jumlah harus lebih dari 0');

  const ing = await prisma.ingredient.findUnique({ where: { id: ingredientId }, select: { name: true } });
  if (!ing) return error('Bahan tidak ditemukan');

  await prisma.$transaction(async (tx) => {
    // Kurangi stok di fromLocation (TRIAL: allow negative)
    const fromLevel = await (tx as any).stockLevel.findFirst({
      where: { ingredientId, location: fromLocation },
    });
    if (fromLevel) {
      await (tx as any).stockLevel.updateMany({
        where: { ingredientId, location: fromLocation },
        data: { quantity: { decrement: quantity }, lastUpdated: new Date() },
      });
    } else {
      await (tx as any).stockLevel.create({
        data: { ingredientId, location: fromLocation, quantity: -quantity, lastUpdated: new Date() },
      });
    }

    // Tambah stok di toLocation
    await (tx as any).stockLevel.upsert({
      where: { ingredientId_location: { ingredientId, location: toLocation } },
      create: { ingredientId, location: toLocation, quantity, lastUpdated: new Date() },
      update: { quantity: { increment: quantity }, lastUpdated: new Date() },
    });

    // Log movement
    await (tx as any).stockMovement.createMany({
      data: [
        { ingredientId, location: fromLocation, type: 'TRANSFER_OUT', quantity: -quantity,
          notes: notes || `Transfer ke ${toLocation}`, createdBy: user.userId },
        { ingredientId, location: toLocation, type: 'TRANSFER_IN', quantity,
          notes: notes || `Transfer dari ${fromLocation}`, createdBy: user.userId },
      ],
    });
  });

  return success({ ok: true, message: `${quantity} unit ${ing.name} dipindah dari ${fromLocation} ke ${toLocation}` });
}, ALL_ROLES);
