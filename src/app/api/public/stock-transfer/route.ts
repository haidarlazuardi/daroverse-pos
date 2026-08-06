export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error } from '@/lib/api-helpers';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { staffId } = body;
  if (staffId) {
    const staff = await prisma.user.findUnique({ where: { id: staffId }, select: { active: true } });
    if (!staff?.active) return Response.json({ error: 'Staff tidak valid' }, { status: 403 });
  }
  const { ingredientId, fromLocation, toLocation, quantity, notes } = await req.json();
  if (!ingredientId || !fromLocation || !toLocation || !quantity) return error('Data tidak lengkap');
  if (fromLocation === toLocation) return error('Lokasi asal dan tujuan sama');
  if (quantity <= 0) return error('Jumlah harus lebih dari 0');

  const ing = await prisma.ingredient.findUnique({ where: { id: ingredientId }, select: { name: true } });
  if (!ing) return error('Bahan tidak ditemukan');

  await prisma.$transaction(async (tx) => {
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
    await (tx as any).stockLevel.upsert({
      where: { ingredientId_location: { ingredientId, location: toLocation } },
      create: { ingredientId, location: toLocation, quantity, lastUpdated: new Date() },
      update: { quantity: { increment: quantity }, lastUpdated: new Date() },
    });
    await (tx as any).stockMovement.createMany({
      data: [
        { ingredientId, location: fromLocation, type: 'TRANSFER', quantity: -quantity,
          notes: notes || `Scan QR - Transfer ke ${toLocation}`, createdBy: 'SCAN_QR' },
        { ingredientId, location: toLocation, type: 'TRANSFER', quantity,
          notes: notes || `Scan QR - Transfer dari ${fromLocation}`, createdBy: 'SCAN_QR' },
      ],
    });
  });

  return success({ ok: true, message: `${quantity} ${ing.name} dipindah ${fromLocation} → ${toLocation}` });
}
