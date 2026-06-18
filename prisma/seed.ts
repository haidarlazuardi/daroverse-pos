import { PrismaClient, StockLocation } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const LOCS: StockLocation[] = ['GUDANG', 'BAR', 'KITCHEN'] as StockLocation[];

async function main() {
  console.log('🌱 Seeding Daroverse POS (single outlet, 3 locations)...\n');

  // ─── Clean (respect FK order) ───────────────────────────
  await prisma.loyaltyLedger.deleteMany();
  await prisma.orderItemModifier.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.stockOpnameItem.deleteMany();
  await prisma.stockOpname.deleteMany();
  await prisma.productionOrderItem.deleteMany();
  await prisma.productionOrder.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.modifierOption.deleteMany();
  await prisma.modifierGroup.deleteMany();
  await prisma.recipeItem.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.discount.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.appSetting.deleteMany();
  await prisma.user.deleteMany();

  // ─── Users (2 roles) ────────────────────────────────────
  const adminPass = await bcrypt.hash('admin123', 10);
  const cashierPass = await bcrypt.hash('cashier123', 10);
  await prisma.user.createMany({
    data: [
      { name: 'Haidar', email: 'admin@daroverse.com', password: adminPass, role: 'SUPER_ADMIN' },
      { name: 'Rina Kasir', email: 'cashier@daroverse.com', password: cashierPass, role: 'CASHIER' },
    ],
  });
  console.log('✅ Users');

  // ─── Settings (calc stack + loyalty) ────────────────────
  await prisma.appSetting.createMany({
    data: [
      { key: 'business_name', value: 'Soeka House', label: 'Nama bisnis' },
      { key: 'tax_rate', value: '0.10', label: 'Pajak (PB1)' },
      { key: 'service_rate', value: '0.05', label: 'Service charge' },
      { key: 'loyalty_earn_divisor', value: '1000', label: 'Rp per 1 poin' },
      { key: 'loyalty_redeem_value', value: '100', label: 'Nilai tukar 1 poin (Rp)' },
    ],
  });
  console.log('✅ Settings');

  // ─── Categories ─────────────────────────────────────────
  const coffee = await prisma.category.create({ data: { name: 'Coffee', color: '#3B6D11', sortOrder: 1 } });
  const food = await prisma.category.create({ data: { name: 'Food', color: '#993C1D', sortOrder: 2 } });

  // ─── Ingredients (RAW) ──────────────────────────────────
  const ing = async (data: any) => prisma.ingredient.create({ data });

  const kopi = await ing({ name: 'Biji kopi (espresso)', type: 'RAW', unit: 'g', packUnit: 'pack', packFactor: 250, purchaseUnit: 'karton', conversionRate: 5000, transferStep: 250, defaultLocation: 'BAR', countTier: 'A', latestPrice: 0.15, minStock: 500 });
  const susu = await ing({ name: 'Susu UHT', type: 'RAW', unit: 'ml', packUnit: 'pack', packFactor: 1000, purchaseUnit: 'karton', conversionRate: 12000, transferStep: 1000, defaultLocation: 'BAR', countTier: 'B', latestPrice: 0.018, minStock: 2000 });
  const air = await ing({ name: 'Air', type: 'RAW', unit: 'ml', defaultLocation: 'BAR', countTier: 'C', latestPrice: 0 });
  const milac = await ing({ name: 'Milac', type: 'RAW', unit: 'g', packUnit: 'pack', packFactor: 1000, transferStep: 1000, defaultLocation: 'BAR', countTier: 'B', latestPrice: 0.05, minStock: 500 });
  const fn = await ing({ name: 'F&N', type: 'RAW', unit: 'ml', packUnit: 'pack', packFactor: 600, transferStep: 600, defaultLocation: 'BAR', countTier: 'B', latestPrice: 0.02, minStock: 600 });
  const gulaRaw = await ing({ name: 'Gula aren (mentah)', type: 'RAW', unit: 'g', packUnit: 'pack', packFactor: 1000, transferStep: 1000, defaultLocation: 'BAR', countTier: 'B', latestPrice: 0.025, minStock: 500 });
  const ice = await ing({ name: 'Es batu', type: 'RAW', unit: 'g', defaultLocation: 'BAR', countTier: 'A', latestPrice: 0.002, minStock: 1000 });
  const whip = await ing({ name: 'Whip cream', type: 'RAW', unit: 'ml', defaultLocation: 'BAR', countTier: 'A', latestPrice: 0.08, minStock: 200 });
  const cup = await ing({ name: 'Cup plastik', type: 'RAW', unit: 'pcs', defaultLocation: 'BAR', countTier: 'B', isPackaging: true, latestPrice: 500, minStock: 50 });
  const box = await ing({ name: 'Box makanan', type: 'RAW', unit: 'pcs', defaultLocation: 'KITCHEN', countTier: 'B', isPackaging: true, latestPrice: 1000, minStock: 30 });
  const croissantRaw = await ing({ name: 'Croissant (frozen)', type: 'RAW', unit: 'pcs', defaultLocation: 'KITCHEN', countTier: 'A', latestPrice: 8000, minStock: 10 });

  // ─── Ingredients (PREPPED) + batch recipes ──────────────
  const liquidCoffee = await ing({ name: 'Liquid coffee milk', type: 'PREPPED', unit: 'ml', defaultLocation: 'BAR', countTier: 'A', opnameTolerance: 50, minStock: 500 });
  const creamerMix = await ing({ name: 'Creamer mix', type: 'PREPPED', unit: 'ml', defaultLocation: 'BAR', countTier: 'A', opnameTolerance: 50, minStock: 300 });
  const gulaSyrup = await ing({ name: 'Gula aren (syrup)', type: 'PREPPED', unit: 'ml', defaultLocation: 'BAR', countTier: 'A', opnameTolerance: 50, minStock: 300 });

  // batch recipe: prepped ingredient ← raw, per standard yield
  const batch = async (ingredientId: string, yieldQty: number, items: { ingredientId: string; quantity: number }[]) =>
    prisma.recipe.create({ data: { ingredientId, yieldQty, yieldUnit: 'ml', items: { create: items } } });

  await batch(liquidCoffee.id, 1000, [{ ingredientId: kopi.id, quantity: 80 }, { ingredientId: susu.id, quantity: 850 }, { ingredientId: air.id, quantity: 150 }]);
  await batch(creamerMix.id, 1000, [{ ingredientId: milac.id, quantity: 200 }, { ingredientId: fn.id, quantity: 800 }]);
  await batch(gulaSyrup.id, 1000, [{ ingredientId: gulaRaw.id, quantity: 600 }, { ingredientId: air.id, quantity: 500 }]);
  console.log('✅ Ingredients + batch recipes');

  // ─── Stock per location ─────────────────────────────────
  const stock: { ingredientId: string; location: StockLocation; quantity: number }[] = [];
  const setStock = (ingredientId: string, perLoc: Partial<Record<StockLocation, number>>) => {
    for (const loc of LOCS) stock.push({ ingredientId, location: loc, quantity: perLoc[loc] || 0 });
  };
  setStock(kopi.id, { GUDANG: 5000, BAR: 1000 });
  setStock(susu.id, { GUDANG: 24000, BAR: 3000 });
  setStock(air.id, { BAR: 100000, KITCHEN: 50000 });
  setStock(milac.id, { GUDANG: 3000, BAR: 1000 });
  setStock(fn.id, { GUDANG: 3000, BAR: 1200 });
  setStock(gulaRaw.id, { GUDANG: 3000, BAR: 1000 });
  setStock(ice.id, { BAR: 8000 });
  setStock(whip.id, { BAR: 500 });
  setStock(cup.id, { GUDANG: 200, BAR: 150 });
  setStock(box.id, { GUDANG: 100, KITCHEN: 50 });
  setStock(croissantRaw.id, { KITCHEN: 24 });
  setStock(liquidCoffee.id, { BAR: 2000 });
  setStock(creamerMix.id, { BAR: 1000 });
  setStock(gulaSyrup.id, { BAR: 1000 });
  await prisma.stockLevel.createMany({ data: stock });
  console.log('✅ Stock (3 locations)');

  // ─── Product: Kopi Susu (DRINK) + serving recipe ────────
  const kopiSusu = await prisma.product.create({
    data: {
      name: 'Kopi Susu', categoryId: coffee.id, station: 'DRINK', price: 22000,
      recipe: { create: { items: { create: [
        { ingredientId: liquidCoffee.id, quantity: 120 },
        { ingredientId: creamerMix.id, quantity: 25 },
        { ingredientId: gulaSyrup.id, quantity: 25 },
        { ingredientId: ice.id, quantity: 80 },
      ] } } },
    },
  });

  // Modifiers (per-product)
  await prisma.modifierGroup.create({
    data: {
      productId: kopiSusu.id, name: 'Sweetness', selectionType: 'SINGLE', sortOrder: 1,
      options: { create: [
        { name: 'Normal', effect: 'ADJUST', targetIngredientId: gulaSyrup.id, multiplier: 1, isDefault: true, sortOrder: 1 },
        { name: 'Less', effect: 'ADJUST', targetIngredientId: gulaSyrup.id, multiplier: 0.5, sortOrder: 2 },
        { name: 'No sugar', effect: 'ADJUST', targetIngredientId: gulaSyrup.id, multiplier: 0, sortOrder: 3 },
      ] },
    },
  });
  await prisma.modifierGroup.create({
    data: {
      productId: kopiSusu.id, name: 'Ice', selectionType: 'SINGLE', sortOrder: 2,
      options: { create: [
        { name: 'Normal', effect: 'ADJUST', targetIngredientId: ice.id, multiplier: 1, isDefault: true, sortOrder: 1 },
        { name: 'Less', effect: 'ADJUST', targetIngredientId: ice.id, multiplier: 0.5, sortOrder: 2 },
      ] },
    },
  });
  await prisma.modifierGroup.create({
    data: {
      productId: kopiSusu.id, name: 'Penyajian', selectionType: 'SINGLE', sortOrder: 3,
      options: { create: [
        { name: 'Glass', effect: 'ADD', targetIngredientId: null, isDefault: true, sortOrder: 1 },
        { name: 'Cup', effect: 'ADD', targetIngredientId: cup.id, addQty: 1, sortOrder: 2 },
      ] },
    },
  });
  await prisma.modifierGroup.create({
    data: {
      productId: kopiSusu.id, name: 'Add-on', selectionType: 'MULTI', sortOrder: 4,
      options: { create: [
        { name: 'Whip cream', effect: 'ADD', targetIngredientId: whip.id, addQty: 15, priceDelta: 5000, sortOrder: 1 },
        { name: 'Extra shot', effect: 'ADD', targetIngredientId: kopi.id, addQty: 18, priceDelta: 8000, sortOrder: 2 },
      ] },
    },
  });

  // ─── Product: Croissant (FOOD) ──────────────────────────
  await prisma.product.create({
    data: {
      name: 'Butter Croissant', categoryId: food.id, station: 'FOOD', price: 28000,
      takeawayCharge: 2000, packagingIngredientId: box.id,
      recipe: { create: { items: { create: [{ ingredientId: croissantRaw.id, quantity: 1 }] } } },
    },
  });
  console.log('✅ Products + modifiers');

  // ─── Supplier, discount, customer ───────────────────────
  await prisma.supplier.create({ data: { name: 'Distributor Kopi Bogor', phone: '0812-3456-7890' } });
  await prisma.discount.create({ data: { name: 'Opening 10%', type: 'PERCENT', value: 10 } });
  await prisma.customer.create({ data: { name: 'Pelanggan Setia', phone: '081200000001', memberSince: new Date(), points: 50 } });

  console.log('\n🎉 Seed selesai.');
  console.log('   Admin   : admin@daroverse.com / admin123');
  console.log('   Kasir   : cashier@daroverse.com / cashier123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
