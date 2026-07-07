const fs = require('fs');
const path = require('path');

// 1. Buat folder jika belum ada
const dir = path.join(__dirname, 'prisma', 'seeds');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// 2. Siapkan konten file
const files = {
  'prisma/seed.ts': `
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
  console.log('🌱 Starting Daroverse POS Production Seed...\\n');

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

  console.log('\\n🎉 Production seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
`,

  'prisma/seeds/users.ts': `
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

export async function seedUsers(prisma: PrismaClient) {
  const password = await bcrypt.hash('Bogor123!!', 10);

  await prisma.user.upsert({
    where: { email: 'lazuardi723@gmail.com' },
    update: {
      name: 'Haidar Lazuardi',
      password,
      role: 'SUPER_ADMIN',
    },
    create: {
      email: 'lazuardi723@gmail.com',
      name: 'Haidar Lazuardi',
      password,
      role: 'SUPER_ADMIN',
    },
  });
}
`,

  'prisma/seeds/settings.ts': `
import { PrismaClient } from '@prisma/client';

export async function seedSettings(prisma: PrismaClient) {
  const settings = [
    { key: 'business_name', value: 'Daroverse POS', label: 'Nama Bisnis' },
    { key: 'tax_rate', value: '0.10', label: 'Pajak (PB1)' },
    { key: 'service_rate', value: '0.05', label: 'Service Charge' },
    { key: 'loyalty_earn_divisor', value: '1000', label: 'Rp per 1 Poin' },
    { key: 'loyalty_redeem_value', value: '100', label: 'Nilai Tukar 1 Poin (Rp)' },
    { key: 'currency', value: 'IDR', label: 'Mata Uang' },
    { key: 'timezone', value: 'Asia/Jakarta', label: 'Zona Waktu' },
  ];

  for (const setting of settings) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: {}, 
      create: setting,
    });
  }
}
`,

  'prisma/seeds/categories.ts': `
import { PrismaClient } from '@prisma/client';

export async function seedCategories(prisma: PrismaClient) {
  const categories = [
    { id: 'cat_coffee', name: 'Coffee', color: '#3B6D11', sortOrder: 1 },
    { id: 'cat_non_coffee', name: 'Non Coffee', color: '#22c55e', sortOrder: 2 },
    { id: 'cat_tea', name: 'Tea', color: '#10b981', sortOrder: 3 },
    { id: 'cat_food', name: 'Food', color: '#993C1D', sortOrder: 4 },
    { id: 'cat_dessert', name: 'Dessert', color: '#f43f5e', sortOrder: 5 },
    { id: 'cat_snack', name: 'Snack', color: '#f59e0b', sortOrder: 6 },
    { id: 'cat_merchandise', name: 'Merchandise', color: '#6366f1', sortOrder: 7 },
    { id: 'cat_other', name: 'Other', color: '#64748b', sortOrder: 8 },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {
        name: cat.name,
        color: cat.color,
        sortOrder: cat.sortOrder,
      },
      create: cat,
    });
  }
}
`,

  'prisma/seeds/modifierTemplates.ts': `
import { PrismaClient } from '@prisma/client';

export async function seedModifierTemplates(prisma: PrismaClient) {
  // Sesuai schema.prisma, model ModifierGroup mewajibkan 'productId' (String).
  // Karena production seed tidak boleh membuat dummy product, 
  // modifier tidak bisa dibuat mandiri tanpa product. File ini sengaja kosong (no-op).
}
`,

  'prisma/seeds/paymentMethods.ts': `
import { PrismaClient } from '@prisma/client';

export async function seedPaymentMethods(prisma: PrismaClient) {
  // PaymentMethod adalah Enum (CASH, QRIS, CARD, TRANSFER).
  // Tidak ada tabel database independen untuk ini. File sengaja kosong (no-op).
}
`,

  'prisma/seeds/stockLocations.ts': `
import { PrismaClient } from '@prisma/client';

export async function seedStockLocations(prisma: PrismaClient) {
  // StockLocation adalah Enum (GUDANG, BAR, KITCHEN).
  // Tidak ada tabel database independen untuk ini. File sengaja kosong (no-op).
}
`,

  'prisma/seeds/units.ts': `
import { PrismaClient } from '@prisma/client';

export async function seedUnits(prisma: PrismaClient) {
  // Units di schema bertipe 'String' (misal: 'pcs', 'gr') pada model Ingredient.
  // Tidak ada tabel master Units untuk di-seed. File sengaja kosong (no-op).
}
`
};

// 3. Tulis semua file
for (const [filepath, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(__dirname, filepath), content.trim() + '\\n');
}

console.log('✅ Berhasil! Semua file seed production sudah di-generate ke folder prisma/');