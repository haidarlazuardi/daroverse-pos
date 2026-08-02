export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ALL_ROLES } from '@/lib/auth';

export const POST = withAuth(async (req: NextRequest, user) => {
  const { ingredientId, multiplier = 1, location = 'BAR' } = await req.json();
  if (!ingredientId) return error('ingredientId wajib');

  const ing = await prisma.ingredient.findUnique({
    where: { id: ingredientId },
    include: { prepRecipe: { include: { items: { include: { ingredient: true } } } } },
  });
  if (!ing) return error('Bahan tidak ditemukan');
  if (ing.type !== 'PREPPED') return error('Bahan bukan tipe PREPPED');
  if (!ing.prepRecipe) return error('Bahan tidak punya resep batch');

  const mult = parseFloat(String(multiplier)) || 1;

  await prisma.$transaction(async (tx) => {
    // Deduct raw materials
    for (const item of ing.prepRecipe!.items) {
      const needed = item.quantity * mult;
      await (tx as any).stockLevel.upsert({
        where: { ingredientId_location: { ingredientId: item.ingredientId, location } },
        create: { ingredientId: item.ingredientId, location, quantity: -needed },
        update: { quantity: { decrement: needed } },
      });
      await (tx as any).stockMovement.create({
        data: { ingredientId: item.ingredientId, location, type: 'PRODUCTION_USE', quantity: -needed,
          notes: `Batch ${ing.name} ×${mult}`, createdBy: user.userId },
      });
    }
    // Add produced ingredient
    const produced = (ing.conversionRate || 1) * mult;
    await (tx as any).stockLevel.upsert({
      where: { ingredientId_location: { ingredientId, location } },
      create: { ingredientId, location, quantity: produced },
      update: { quantity: { increment: produced } },
    });
    await (tx as any).stockMovement.create({
      data: { ingredientId, location, type: 'PRODUCTION_MAKE', quantity: produced,
        notes: `Batch ×${mult}`, createdBy: user.userId },
    });
  });

  return success({ ok: true, message: `Batch ${ing.name} ×${mult} selesai` });
}, ALL_ROLES);
