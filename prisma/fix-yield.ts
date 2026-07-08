// Script: fix yieldQty yang null di semua prep recipes
// Jalanin: npx ts-node prisma/fix-yield.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const YIELD_MAP: Record<string, number> = {
  'Milk Premix':    3847,
  'PREMIX MILK':    3847,
  'Espresso':       1500,
  'Liquid Aren':    1200,
  'Simple Syrup':   1200,
  'Coldbrew Idjen': 7000,
  'Cream Top':       280,
  'Liquid Teh':     1000,
};

async function main() {
  const recipes = await prisma.recipe.findMany({
    where: { ingredientId: { not: null } },
    include: { ingredient: true },
  });

  let fixed = 0;
  for (const r of recipes) {
    if (r.yieldQty && r.yieldQty > 0) continue; // udah bener

    const name = r.ingredient?.name || '';
    const yieldQty = Object.entries(YIELD_MAP).find(([k]) => name.toLowerCase().includes(k.toLowerCase()))?.[1];

    if (yieldQty) {
      await prisma.recipe.update({ where: { id: r.id }, data: { yieldQty } });
      console.log(`Fixed: ${name} → yieldQty = ${yieldQty}`);
      fixed++;
    } else {
      console.log(`WARNING: ${name} — yieldQty masih null, tambahkan manual ke YIELD_MAP`);
    }
  }

  console.log(`\n✅ Fixed ${fixed} recipes`);
  console.log('Jalanin "💡 Recalculate HPP" di halaman Products setelah ini.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
