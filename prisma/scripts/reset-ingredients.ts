import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Resetting all ingredient data...\n');

  // Hapus semua dalam urutan yang benar (FK order)
  await prisma.stockOpnameItem.deleteMany({});
  console.log('  ✓ StockOpnameItem cleared');

  await prisma.stockOpname.deleteMany({});
  console.log('  ✓ StockOpname cleared');

  await prisma.stockMovement.deleteMany({});
  console.log('  ✓ StockMovement cleared');

  await prisma.stockLevel.deleteMany({});
  console.log('  ✓ StockLevel cleared');

  await (prisma as any).recipeItem.deleteMany({});
  console.log('  ✓ RecipeItem cleared');

  await (prisma as any).recipe.deleteMany({});
  console.log('  ✓ Recipe cleared');

  await (prisma as any).productionOrderItem.deleteMany({});
  console.log('  ✓ ProductionOrderItem cleared');

  await (prisma as any).productionOrder.deleteMany({});
  console.log('  ✓ ProductionOrder cleared');

  await (prisma as any).purchaseOrderItem.deleteMany({});
  console.log('  ✓ PurchaseOrderItem cleared');

  await (prisma as any).purchaseOrder.deleteMany({});
  console.log('  ✓ PurchaseOrder cleared');

  await prisma.ingredient.deleteMany({});
  console.log('  ✓ Ingredient cleared');

  console.log('\n✅ Reset selesai. Mulai seed...\n');

  // ── SEED BAHAN BAKU ──────────────────────────────────────────────────────

  async function upsertIng(data: {
    name: string; type: 'RAW' | 'PREPPED'; unit: string;
    purchaseUnit?: string; conversionRate?: number;
    latestPrice: number; minStock: number;
  }) {
    const ing = await prisma.ingredient.create({
      data: { ...data, active: true },
    });
    await (prisma as any).stockLevel.createMany({
      data: ['GUDANG', 'BAR', 'KITCHEN'].map(loc => ({
        ingredientId: ing.id, location: loc, quantity: 0,
      })),
    });
    return ing;
  }

  const rawDefs = [
    // Dairy
    { name: 'Susu Freshmilk Diamond',    unit: 'ml',   purchaseUnit: 'pack',    conversionRate: 946,   latestPrice: 25.55,   minStock: 1000 },
    { name: 'Creamer Milac',              unit: 'ml',   purchaseUnit: 'pack',    conversionRate: 6000,  latestPrice: 84,      minStock: 500  },
    { name: 'Susu SKM Carnation',         unit: 'g',    purchaseUnit: 'pcs',     conversionRate: 370,   latestPrice: 54.05,   minStock: 370  },
    { name: 'Susu Evaporasi Carnation',   unit: 'ml',   purchaseUnit: 'pcs',     conversionRate: 405,   latestPrice: 61.73,   minStock: 405  },
    { name: 'Oat Milk Oat Side',          unit: 'ml',   purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 35,      minStock: 500  },
    { name: 'Margarin Royal Palmia',      unit: 'g',    purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 95,      minStock: 200  },
    { name: 'Red Cheddar',                unit: 'pcs',  purchaseUnit: 'pack',    conversionRate: 84,    latestPrice: 2142.86, minStock: 10   },
    // Gula
    { name: 'Gula Aren Foya',             unit: 'g',    purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 55,      minStock: 500  },
    { name: 'Gula Pasir Gulaku',          unit: 'g',    purchaseUnit: 'kg',      conversionRate: 5000,  latestPrice: 18,      minStock: 500  },
    // Teh
    { name: 'Teh Tong Dji Jasmine',       unit: 'g',    purchaseUnit: 'Pack',    conversionRate: 250,   latestPrice: 100,     minStock: 250  },
    // Soda
    { name: 'Soda Zoda',                  unit: 'ml',   purchaseUnit: 'kaleng',  conversionRate: 250,   latestPrice: 20,      minStock: 500  },
    { name: 'Tonic Sweppes',              unit: 'ml',   purchaseUnit: 'kaleng',  conversionRate: 250,   latestPrice: 23.33,   minStock: 500  },
    // Sirup & Flavor
    { name: 'Flavour Dark Choco Foya',    unit: 'g',    purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 166.5,   minStock: 200  },
    { name: 'Flavour Matcha Foya',        unit: 'g',    purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 155.4,   minStock: 200  },
    { name: 'Flavour Tiramisu Foya',      unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 140.6,   minStock: 150  },
    { name: 'Flavour Vanila Foya',        unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 140.6,   minStock: 150  },
    { name: 'Flavour Caramel Foya',       unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 140.6,   minStock: 150  },
    { name: 'Flavour Pandan Foya',        unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 140.6,   minStock: 150  },
    { name: 'Flavour Strawberry Foya',    unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 140.6,   minStock: 150  },
    { name: 'Flavour Butterscotch Foya',  unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 140.6,   minStock: 150  },
    { name: 'Flavour Mint Foya',          unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 140.6,   minStock: 150  },
    { name: 'Flavour Peach Foya',         unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 154.07,  minStock: 150  },
    { name: 'Flavour Fruity Foya',        unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 154.07,  minStock: 150  },
    { name: 'Berry Juice Diamond',        unit: 'ml',   purchaseUnit: 'pack',    conversionRate: 946,   latestPrice: 39.43,   minStock: 200  },
    { name: 'Orange Juice Sunquick',      unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 1000,  latestPrice: 95,      minStock: 200  },
    // Bumbu
    { name: 'Sea Salt',                   unit: 'g',    purchaseUnit: 'pack',    conversionRate: 300,   latestPrice: 166.67,  minStock: 50   },
    { name: 'Cabai Cayenne',              unit: 'g',    purchaseUnit: 'pack',    conversionRate: 500,   latestPrice: 82,      minStock: 100  },
    { name: 'Cajun Seasoning',            unit: 'g',    purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 115,     minStock: 100  },
    { name: 'Smoke Powder',               unit: 'g',    purchaseUnit: 'pack',    conversionRate: 250,   latestPrice: 380,     minStock: 50   },
    { name: 'Penyedap Rasa Knorr',        unit: 'g',    purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 125,     minStock: 100  },
    { name: 'Baking Soda',                unit: 'g',    purchaseUnit: 'botol',   conversionRate: 81,    latestPrice: 98.77,   minStock: 30   },
    // Kopi
    { name: 'House Blend Beans 60:40',    unit: 'g',    purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 240,     minStock: 500  },
    { name: 'Anaerobic Idjen Gemilang',   unit: 'g',    purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 400,     minStock: 250  },
    { name: 'Specialty Beans',            unit: 'g',    purchaseUnit: 'pack',    conversionRate: 250,   latestPrice: 500,     minStock: 250  },
    // Air
    { name: 'Air Mineral Galon Cleo',     unit: 'ml',   purchaseUnit: 'galon',   conversionRate: 19000, latestPrice: 1.05,    minStock: 5000 },
    // Sayur & Buah
    { name: 'Nanas',                      unit: 'g',    purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 20,      minStock: 500  },
    { name: 'Kentang Dieng',              unit: 'g',    purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 20,      minStock: 500  },
    { name: 'Pisang Oli',                 unit: 'g',    purchaseUnit: 'sisir',   conversionRate: 1000,  latestPrice: 15,      minStock: 300  },
    { name: 'Romaine Lettuce (Selada)',   unit: 'g',    purchaseUnit: 'pcs',     conversionRate: 300,   latestPrice: 20,      minStock: 200  },
    { name: 'Bawang Bombay',              unit: 'g',    purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 30,      minStock: 200  },
    { name: 'Bawang Putih',               unit: 'g',    purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 38,      minStock: 200  },
    { name: 'Bawang Merah',               unit: 'g',    purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 40,      minStock: 200  },
    { name: 'Cabai Hijau Besar',          unit: 'g',    purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 23,      minStock: 200  },
    { name: 'Lengkuas',                   unit: 'g',    purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 15,      minStock: 100  },
    { name: 'Daun Jeruk',                 unit: 'g',    purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 20,      minStock: 50   },
    // Protein
    { name: 'Paha Ayam Fillet',           unit: 'g',    purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 52,      minStock: 500  },
    { name: 'Kulit Ayam',                 unit: 'g',    purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 38,      minStock: 300  },
    { name: 'Daging Has Dalam',           unit: 'g',    purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 160,     minStock: 500  },
    { name: 'Daging Giling',              unit: 'g',    purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 85,      minStock: 300  },
    { name: 'Telur',                      unit: 'pcs',  purchaseUnit: 'kg',      conversionRate: 60,    latestPrice: 1667,    minStock: 30   },
    { name: 'Sayap Ayam',                 unit: 'g',    purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 45,      minStock: 500  },
    // Karbohidrat
    { name: 'Beras Setra Ramos',          unit: 'g',    purchaseUnit: 'sak',     conversionRate: 10000, latestPrice: 25,      minStock: 2000 },
    // Bakery & Dry
    { name: 'Tepung Terigu Kunci Biru',   unit: 'g',    purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 19,      minStock: 500  },
    { name: 'Tepung Maizena',             unit: 'g',    purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 28,      minStock: 200  },
    { name: 'Burger Bun Butterfield',     unit: 'pcs',  purchaseUnit: 'pack',    conversionRate: 10,    latestPrice: 3000,    minStock: 10   },
    // Topping & Saus
    { name: 'Chocolate Crumble',          unit: 'g',    purchaseUnit: 'pack',    conversionRate: 500,   latestPrice: 94,      minStock: 100  },
    { name: 'Saus Cabai Del Monte',       unit: 'pcs',  purchaseUnit: 'karton',  conversionRate: 24,    latestPrice: 322.92,  minStock: 5    },
    { name: 'Mayonaise Mamayo',           unit: 'g',    purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 26,      minStock: 200  },
    { name: 'Saus BBQ Smoky',             unit: 'g',    purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 35,      minStock: 200  },
    { name: 'Saus Tiram Cap Panda',       unit: 'g',    purchaseUnit: 'botol',   conversionRate: 500,   latestPrice: 100,     minStock: 100  },
    { name: 'Kecap Manis Bango',          unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 600,   latestPrice: 47.62,   minStock: 200  },
    // Oil
    { name: 'Minyak Sawit Minyakita',     unit: 'ml',   purchaseUnit: 'galon',   conversionRate: 5000,  latestPrice: 24,      minStock: 1000 },
  ];

  const rawMap = new Map<string, string>();
  for (const def of rawDefs) {
    const ing = await upsertIng({ ...def, type: 'RAW' });
    rawMap.set(def.name, ing.id);
    process.stdout.write('.');
  }
  console.log(`\n  ✓ ${rawDefs.length} bahan baku (RAW)`);

  // ── BATCH RECIPES (PREPPED) ──────────────────────────────────────────────
  const batchDefs = [
    {
      name: 'Milk Premix', unit: 'ml', latestPrice: 37.56, minStock: 500, yieldQty: 3847,
      items: [
        { name: 'Susu Freshmilk Diamond',  qty: 2835 },
        { name: 'Susu Evaporasi Carnation', qty: 405  },
        { name: 'Creamer Milac',            qty: 607  },
      ],
    },
    {
      name: 'Espresso', unit: 'ml', latestPrice: 81.08, minStock: 300, yieldQty: 1500,
      items: [
        { name: 'House Blend Beans 60:40', qty: 500  },
        { name: 'Air Mineral Galon Cleo',  qty: 1500 },
      ],
    },
    {
      name: 'Liquid Aren', unit: 'ml', latestPrice: 46.28, minStock: 300, yieldQty: 1200,
      items: [
        { name: 'Gula Aren Foya',         qty: 1000 },
        { name: 'Air Mineral Galon Cleo', qty: 500  },
      ],
    },
    {
      name: 'Simple Syrup', unit: 'ml', latestPrice: 15.45, minStock: 300, yieldQty: 1200,
      items: [
        { name: 'Gula Pasir Gulaku',      qty: 1000 },
        { name: 'Air Mineral Galon Cleo', qty: 500  },
      ],
    },
    {
      name: 'Coldbrew Idjen', unit: 'ml', latestPrice: 58.38, minStock: 500, yieldQty: 7000,
      items: [
        { name: 'Anaerobic Idjen Gemilang', qty: 1000 },
        { name: 'Air Mineral Galon Cleo',   qty: 8000 },
      ],
    },
    {
      name: 'Cream Top', unit: 'ml', latestPrice: 144.67, minStock: 100, yieldQty: 280,
      items: [
        { name: 'Creamer Milac',         qty: 200 },
        { name: 'Susu Freshmilk Diamond', qty: 50  },
        { name: 'Flavour Vanila Foya',   qty: 30  },
      ],
    },
    {
      name: 'Liquid Teh', unit: 'ml', latestPrice: 1.22, minStock: 500, yieldQty: 1000,
      items: [
        { name: 'Teh Tong Dji Jasmine',  qty: 50   },
        { name: 'Air Mineral Galon Cleo', qty: 1000 },
      ],
    },
  ];

  for (const def of batchDefs) {
    const ing = await upsertIng({ name: def.name, type: 'PREPPED', unit: def.unit, latestPrice: def.latestPrice, minStock: def.minStock });
    const resolvedItems = def.items
      .map(item => ({ ingredientId: rawMap.get(item.name), quantity: item.qty }))
      .filter(item => item.ingredientId);

    if (resolvedItems.length !== def.items.length) {
      console.log(`\n  ⚠ ${def.name}: beberapa bahan tidak ditemukan`);
    }

    await (prisma as any).recipe.create({
      data: {
        ingredientId: ing.id,
        yieldQty: def.yieldQty,
        yieldUnit: def.unit,
        items: {
          create: resolvedItems.map(i => ({ ingredientId: i.ingredientId!, quantity: i.quantity })),
        },
      },
    });
    process.stdout.write('.');
  }
  console.log(`\n  ✓ ${batchDefs.length} batch recipe (PREPPED)`);
  console.log('\n✅ Seed selesai!');
  console.log('💡 Buka Products → klik "Recalculate HPP"');
}

main()
  .catch(e => { console.error('\n❌ Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
