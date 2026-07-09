import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const CREAMER_BUBUK = 'cmrauefxi0004yswpaerawjh4';

  // Cari Creamer Milac
  const creamerMilac = await prisma.ingredient.findFirst({
    where: { name: { contains: 'Milac', mode: 'insensitive' } },
  });

  if (!creamerMilac) {
    console.log('❌ Creamer Milac tidak ditemukan');
    return;
  }
  console.log(`✓ Creamer Milac: ${creamerMilac.id}`);

  // Re-point recipe items
  const updated = await (prisma as any).recipeItem.updateMany({
    where: { ingredientId: CREAMER_BUBUK },
    data: { ingredientId: creamerMilac.id },
  });
  console.log(`✓ Updated ${updated.count} recipe items`);

  // Sekarang aman delete Creamer Bubuk
  await (prisma as any).stockLevel.deleteMany({ where: { ingredientId: CREAMER_BUBUK } });
  await (prisma as any).stockOpnameItem.deleteMany({ where: { ingredientId: CREAMER_BUBUK } });
  await (prisma as any).stockMovement.deleteMany({ where: { ingredientId: CREAMER_BUBUK } });
  await (prisma as any).productionOrderItem.deleteMany({ where: { ingredientId: CREAMER_BUBUK } });
  await (prisma as any).purchaseOrderItem.deleteMany({ where: { ingredientId: CREAMER_BUBUK } });
  await (prisma as any).recipeItem.deleteMany({ where: { ingredientId: CREAMER_BUBUK } });
  await (prisma as any).recipe.deleteMany({ where: { ingredientId: CREAMER_BUBUK } });
  await prisma.ingredient.delete({ where: { id: CREAMER_BUBUK } });
  console.log('✓ Creamer Bubuk deleted');
  console.log('\n💡 Jalankan Recalculate HPP di Products!');
}

main()
  .catch(e => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
