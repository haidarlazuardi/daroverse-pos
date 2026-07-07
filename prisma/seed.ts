/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
import { seedUsers } from './seeds/users';
import { seedSettings } from './seeds/settings';
import { seedCategories } from './seeds/categories';
import { seedModifierTemplates } from './seeds/modifierTemplates';
import { seedPaymentMethods } from './seeds/paymentMethods';
import { seedStockLocations } from './seeds/stockLocations';
import { seedUnits } from './seeds/units';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Daroverse POS Production Seed...\n');

  await seedUsers(prisma);
  console.log('✅ Master User seeded');

  await seedSettings(prisma);
  console.log('✅ App Settings seeded');

  await seedCategories(prisma);
  console.log('✅ Default Categories seeded');

  // Dieksekusi tapi no-op karena format enum/string bawaan schema
  await seedModifierTemplates(prisma);
  await seedPaymentMethods(prisma);
  await seedStockLocations(prisma);
  await seedUnits(prisma);

  console.log('\n🎉 Production seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });