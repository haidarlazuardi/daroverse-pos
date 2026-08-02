export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ALL_ROLES } from '@/lib/auth';

export const POST = withAuth(async (req: NextRequest, user) => {
  const { ingredientId, multiplier = 1, location = 'BAR', actualYield } = await req.json();
  if (!ingredientId) return error('ingredientId wajib');

  const ing = await prisma.ingredient.findUnique({
    where: { id: ingredientId },
    include: {
      prepRecipe: {
        include: { items: { include: { ingredient: { select: { name: true, unit: true, defaultLocation: true } } } } }
      }
    },
  });
  if (!ing) return error('Bahan tidak ditemukan', 404);
  if (ing.type !== 'PREPPED') return error('Bahan bukan tipe PREPPED');
  if (!ing.prepRecipe) return error(`${ing.name} tidak punya resep batch`);

  const mult     = parseFloat(String(multiplier)) || 1;
  const recipe   = ing.prepRecipe;
  // Yield: pakai actualYield kalau diinput, fallback ke yieldQty × mult, fallback ke conversionRate × mult
  const produced = actualYield
    ? parseFloat(String(actualYield))
    : (recipe.yieldQty || ing.conversionRate || 1) * mult;

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Deduct raw materials dari default location masing-masing (atau GUDANG)
      for (const item of recipe.items) {
        const needed  = item.quantity * mult;
        const srcLoc  = (item.ingredient.defaultLocation as string) || 'GUDANG';
        await (tx as any).stockLevel.upsert({
          where: { ingredientId_location: { ingredientId: item.ingredientId, location: srcLoc } },
          create: { ingredientId: item.ingredientId, location: srcLoc, quantity: -needed, lastUpdated: new Date() },
          update: { quantity: { decrement: needed }, lastUpdated: new Date() },
        });
        await (tx as any).stockMovement.create({
          data: {
            ingredientId: item.ingredientId,
            location: srcLoc,
            type: 'PRODUCTION_USE',
            quantity: -needed,
            notes: `Batch ${ing.name} ×${mult}`,
            createdBy: user.userId,
          },
        });
      }

      // 2. Tambah hasil batch ke lokasi tujuan
      await (tx as any).stockLevel.upsert({
        where: { ingredientId_location: { ingredientId, location } },
        create: { ingredientId, location, quantity: produced, lastUpdated: new Date() },
        update: { quantity: { increment: produced }, lastUpdated: new Date() },
      });
      await (tx as any).stockMovement.create({
        data: {
          ingredientId,
          location,
          type: 'PRODUCTION_MAKE',
          quantity: produced,
          notes: actualYield
            ? `Batch ×${mult} (yield aktual: ${produced} ${ing.unit})`
            : `Batch ×${mult} (yield: ${produced} ${ing.unit})`,
          createdBy: user.userId,
        },
      });
    });

    return success({
      ok: true,
      produced,
      unit: ing.unit,
      message: `✅ Batch ${ing.name} selesai — ${produced} ${ing.unit} di ${location}`,
    });
  } catch (e: any) {
    return error(`Gagal batch: ${e.message}`, 500);
  }
}, ALL_ROLES);
