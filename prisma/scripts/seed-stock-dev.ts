/**
 * seed-stock-dev.ts
 * Set semua stok ingredient ke 9999 di semua lokasi untuk testing
 * Reset: npx tsx prisma/scripts/seed-stock-dev.ts --reset
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const LOCATIONS = ['GUDANG', 'BAR', 'KITCHEN'] as const;
const DEV_QTY   = 9999;
const RESET_QTY = 0;

async function main() {
  const isReset = process.argv.includes('--reset');
  const qty = isReset ? RESET_QTY : DEV_QTY;

  console.log(`\n${isReset ? '🔄 RESET' : '🧪 SEED'} stok ke ${qty} untuk semua ingredient...\n`);

  const ingredients = await prisma.ingredient.findMany({ where: { active: true }, select: { id: true, name: true, type: true } });
  console.log(`Found ${ingredients.length} ingredients`);

  let updated = 0;
  for (const ing of ingredients) {
    for (const loc of LOCATIONS) {
      await prisma.stockLevel.upsert({
        where: { ingredientId_location: { ingredientId: ing.id, location: loc } },
        create: { ingredientId: ing.id, location: loc, quantity: qty },
        update: { quantity: qty },
      });
    }
    // Log movement
    await prisma.stockMovement.create({
      data: {
        ingredientId: ing.id,
        type: 'ADJUSTMENT',
        quantity: qty,
        location: 'GUDANG',
        notes: isReset ? 'Dev stock reset to 0' : 'Dev stock seed to 9999',
        createdBy: 'system',
      },
    });
    updated++;
    process.stdout.write(`\r  Updated: ${updated}/${ingredients.length}`);
  }

  console.log(`\n\n✅ Done! ${updated} ingredients × ${LOCATIONS.length} locations = ${updated * LOCATIONS.length} records`);
  console.log(isReset
    ? '\nStok direset ke 0. Run tanpa --reset untuk seed lagi.'
    : '\nSemua stok = 9999. Run dengan --reset untuk reset ke 0.'
  );
}

main().catch(console.error).finally(() => prisma.$disconnect());
