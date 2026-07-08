import { PrismaClient } from '@prisma/client';

export async function seedSoekaHouse(prisma: PrismaClient) {

  // ── 1. CATEGORIES ─────────────────────────────────────────────────────────
  const CATEGORIES = [
    { id: 'cat_signature',  name: 'Signature',  color: '#48654D', sortOrder: 1 },
    { id: 'cat_coffee',     name: 'Coffee',     color: '#6B4226', sortOrder: 2 },
    { id: 'cat_tea',        name: 'Tea',        color: '#2D6A4F', sortOrder: 3 },
    { id: 'cat_noncoffee',  name: 'Non Coffee', color: '#457B9D', sortOrder: 4 },
    { id: 'cat_refresher',  name: 'Refresher',  color: '#E63946', sortOrder: 5 },
    { id: 'cat_palestino',  name: 'Palestino',  color: '#2A9D8F', sortOrder: 6 },
    { id: 'cat_burger',     name: 'Burger',     color: '#E76F51', sortOrder: 7 },
    { id: 'cat_meals',      name: 'Meals',      color: '#264653', sortOrder: 8 },
    { id: 'cat_snack',      name: 'Snack',      color: '#F4A261', sortOrder: 9 },
    { id: 'cat_addon',      name: 'Add On',     color: '#8B8B8B', sortOrder: 10 },
  ];

  for (const c of CATEGORIES) {
    await prisma.category.upsert({ where: { id: c.id }, update: c, create: c });
  }
  console.log(`  ✓ ${CATEGORIES.length} kategori`);

  // ── 2. SUPPLIERS ──────────────────────────────────────────────────────────
  const SUPPLIERS = [
    { id: 'sup_001', name: 'Roastery Partner' },
    { id: 'sup_002', name: 'Distributor Dairy' },
    { id: 'sup_003', name: 'Toko Bahan Kue & Sirup' },
    { id: 'sup_004', name: 'Pasar / Sayur Buah' },
    { id: 'sup_005', name: 'Supplier Daging & Frozen' },
    { id: 'sup_006', name: 'Toko Sembako' },
    { id: 'sup_007', name: 'Sablon Cup Ranji' },
    { id: 'sup_008', name: 'Supplier Cleo' },
    { id: 'sup_009', name: 'Supplier Voya' },
  ];

  for (const s of SUPPLIERS) {
    await prisma.supplier.upsert({
      where: { id: s.id },
      update: { name: s.name },
      create: { id: s.id, name: s.name, active: true },
    });
  }
  console.log(`  ✓ ${SUPPLIERS.length} supplier`);

  // ── 3. HELPER: upsert ingredient + stock levels ───────────────────────────
  async function upsertIngredient(data: {
    name: string; type: 'RAW' | 'PREPPED'; unit: string;
    purchaseUnit?: string; conversionRate?: number;
    latestPrice: number; minStock: number;
  }) {
    // Check by name — avoid duplicate key issues
    const existing = await prisma.ingredient.findFirst({ where: { name: data.name } });
    if (existing) return existing;

    const ing = await prisma.ingredient.create({
      data: {
        name: data.name, type: data.type, unit: data.unit,
        purchaseUnit: data.purchaseUnit || null,
        conversionRate: data.conversionRate || null,
        latestPrice: data.latestPrice,
        minStock: data.minStock,
        active: true,
      },
    });

    await prisma.stockLevel.createMany({
      data: ['GUDANG', 'BAR', 'KITCHEN'].map(location => ({
        ingredientId: ing.id, location: location as any, quantity: 0,
      })),
      skipDuplicates: true,
    });

    return ing;
  }

  // ── 4. BAHAN BAKU (RAW) ───────────────────────────────────────────────────
  const rawDefs = [
    // Dairy
    { name: 'Susu Freshmilk Diamond',    unit: 'ml',   purchaseUnit: 'karton',  conversionRate: 12000, latestPrice: 24.17,   minStock: 1000 },
    { name: 'Creamer Milac',              unit: 'ml',   purchaseUnit: 'pack',    conversionRate: 6000,  latestPrice: 84,      minStock: 500  },
    { name: 'Susu SKM Carnation',         unit: 'gram', purchaseUnit: 'pcs',     conversionRate: 370,   latestPrice: 54.05,   minStock: 370  },
    { name: 'Susu Evaporasi Carnation',   unit: 'ml',   purchaseUnit: 'pcs',     conversionRate: 405,   latestPrice: 61.73,   minStock: 405  },
    { name: 'Oat Milk Oat Side',          unit: 'ml',   purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 35,      minStock: 500  },
    { name: 'Margarin Royal Palmia',      unit: 'gram', purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 95,      minStock: 200  },
    { name: 'Red Cheddar',                unit: 'pcs',  purchaseUnit: 'pack',    conversionRate: 84,    latestPrice: 2142.86, minStock: 10   },
    // Gula
    { name: 'Gula Aren Foya',             unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 55,      minStock: 500  },
    { name: 'Gula Pasir Gulaku',          unit: 'gram', purchaseUnit: 'kg',      conversionRate: 5000,  latestPrice: 18,      minStock: 500  },
    // Teh
    { name: 'Teh Tong Dji Jasmine',       unit: 'pcs',  purchaseUnit: 'pack',    conversionRate: 12,    latestPrice: 1166.67, minStock: 12   },
    // Tonic Soda
    { name: 'Soda Zoda',                  unit: 'ml',   purchaseUnit: 'karton',  conversionRate: 6000,  latestPrice: 20,      minStock: 500  },
    { name: 'Tonic Sweppes',              unit: 'ml',   purchaseUnit: 'karton',  conversionRate: 6000,  latestPrice: 23.33,   minStock: 500  },
    // Sirup & Flavor
    { name: 'Flavour Dark Choco Foya',    unit: 'gram', purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 166.5,   minStock: 200  },
    { name: 'Flavour Matcha Foya',        unit: 'gram', purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 155.4,   minStock: 200  },
    { name: 'Flavour Tiramisu Foya',      unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 140.6,   minStock: 150  },
    { name: 'Flavour Vanila Foya',        unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 140.6,   minStock: 150  },
    { name: 'Flavour Caramel Foya',       unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 140.6,   minStock: 150  },
    { name: 'Flavour Pandan Foya',        unit: 'ml',   purchaseUnit: 'pack',    conversionRate: 750,   latestPrice: 140.6,   minStock: 150  },
    { name: 'Flavour Strawberry Foya',    unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 140.6,   minStock: 150  },
    { name: 'Flavour Butterscotch Foya',  unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 140.6,   minStock: 150  },
    { name: 'Flavour Mint Foya',          unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 140.6,   minStock: 150  },
    { name: 'Flavour Peach Foya',         unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 154.07,  minStock: 150  },
    { name: 'Flavour Fruity Foya',        unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 154.07,  minStock: 150  },
    { name: 'Berry Juice Diamond',        unit: 'ml',   purchaseUnit: 'pack',    conversionRate: 946,   latestPrice: 39.43,   minStock: 200  },
    { name: 'Orange Juice Sunquick',      unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 1000,  latestPrice: 95,      minStock: 200  },
    // Bumbu
    { name: 'Sea Salt',                   unit: 'gram', purchaseUnit: 'pack',    conversionRate: 300,   latestPrice: 166.67,  minStock: 50   },
    { name: 'Cabai Cayenne',              unit: 'gram', purchaseUnit: 'pack',    conversionRate: 500,   latestPrice: 82,      minStock: 100  },
    { name: 'Cajun Seasoning',            unit: 'gram', purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 115,     minStock: 100  },
    { name: 'Smoke Powder',               unit: 'gram', purchaseUnit: 'pack',    conversionRate: 250,   latestPrice: 380,     minStock: 50   },
    { name: 'Penyedap Rasa Knorr',        unit: 'gram', purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 125,     minStock: 100  },
    { name: 'Baking Soda',                unit: 'gram', purchaseUnit: 'botol',   conversionRate: 81,    latestPrice: 98.77,   minStock: 30   },
    // Kopi
    { name: 'House Blend Beans 60:40',    unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 240,     minStock: 500  },
    { name: 'Anaerobic Idjen Gemilang',   unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 400,     minStock: 250  },
    { name: 'Specialty Beans',            unit: 'gram', purchaseUnit: 'pack',    conversionRate: 250,   latestPrice: 500,     minStock: 250  },
    // Air
    { name: 'Air Mineral Galon Cleo',     unit: 'ml',   purchaseUnit: 'pcs',     conversionRate: 19000, latestPrice: 1.08,    minStock: 5000 },
    // Sayur & Buah
    { name: 'Nanas',                      unit: 'gram', purchaseUnit: 'pcs',     conversionRate: 1000,  latestPrice: 20,      minStock: 500  },
    { name: 'Kentang Dieng',              unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 20,      minStock: 500  },
    { name: 'Pisang Oli',                 unit: 'gram', purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 15,      minStock: 300  },
    { name: 'Romaine Lettuce',            unit: 'gram', purchaseUnit: 'pcs',     conversionRate: 1000,  latestPrice: 20,      minStock: 200  },
    { name: 'Bawang Bombay',              unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 20,      minStock: 200  },
    { name: 'Bawang Putih',               unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 30,      minStock: 200  },
    { name: 'Bawang Merah',               unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 30,      minStock: 200  },
    { name: 'Cabai Hijau Besar',          unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 20,      minStock: 200  },
    { name: 'Lengkuas',                   unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 15,      minStock: 100  },
    { name: 'Daun Jeruk',                 unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 20,      minStock: 50   },
    // Protein
    { name: 'Paha Ayam Fillet',           unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 52,      minStock: 500  },
    { name: 'Kulit Ayam',                 unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 38,      minStock: 300  },
    { name: 'Daging Has Dalam',           unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 160,     minStock: 500  },
    { name: 'Daging Giling',              unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 100,     minStock: 300  },
    { name: 'Telur',                      unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 30,      minStock: 500  },
    { name: 'Sayap Ayam',                 unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 45,      minStock: 500  },
    // Karbohidrat
    { name: 'Beras Setra Ramos',          unit: 'gram', purchaseUnit: 'sak',     conversionRate: 10000, latestPrice: 25,      minStock: 2000 },
    // Bakery & Dry
    { name: 'Tepung Terigu Kunci Biru',   unit: 'gram', purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 19,      minStock: 500  },
    { name: 'Tepung Maizena',             unit: 'gram', purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 28,      minStock: 200  },
    { name: 'Burger Bun Butterfield',     unit: 'pcs',  purchaseUnit: 'pcs',     conversionRate: 10,    latestPrice: 3000,    minStock: 10   },
    // Topping & Saus
    { name: 'Chocolate Crumble',          unit: 'gram', purchaseUnit: 'pack',    conversionRate: 500,   latestPrice: 94,      minStock: 100  },
    { name: 'Saus Cabai Del Monte',       unit: 'pcs',  purchaseUnit: 'karton',  conversionRate: 480,   latestPrice: 322.92,  minStock: 10   },
    { name: 'Mayonaise Mamayo',           unit: 'gram', purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 26,      minStock: 200  },
    { name: 'Saus BBQ Smoky',             unit: 'gram', purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 35,      minStock: 200  },
    { name: 'Saus Tiram Cap Panda',       unit: 'gram', purchaseUnit: 'botol',   conversionRate: 500,   latestPrice: 100,     minStock: 100  },
    { name: 'Kecap Manis Bango',          unit: 'ml',   purchaseUnit: 'pack',    conversionRate: 735,   latestPrice: 47.62,   minStock: 200  },
    // Oil
    { name: 'Minyak Sawit Minyakita',     unit: 'ml',   purchaseUnit: 'galon',   conversionRate: 5000,  latestPrice: 24,      minStock: 1000 },
  ];

  const rawMap = new Map<string, string>(); // name → id
  for (const def of rawDefs) {
    const ing = await upsertIngredient({ ...def, type: 'RAW' });
    rawMap.set(def.name, ing.id);
  }
  console.log(`  ✓ ${rawDefs.length} bahan baku (RAW)`);

  // ── 5. BATCH RECIPES (PREPPED) ────────────────────────────────────────────
  // Items referensi nama → resolve ke ID aktual dari rawMap
  const batchDefs = [
    {
      name: 'Milk Premix', unit: 'ml', latestPrice: 37.56, minStock: 500, yieldQty: 3847,
      items: [
        { name: 'Susu Freshmilk Diamond', qty: 2835 },
        { name: 'Susu Evaporasi Carnation', qty: 405 },
        { name: 'Creamer Milac', qty: 607 },
      ],
    },
    {
      name: 'Espresso', unit: 'ml', latestPrice: 81.08, minStock: 300, yieldQty: 1500,
      items: [
        { name: 'House Blend Beans 60:40', qty: 500 },
        { name: 'Air Mineral Galon Cleo', qty: 1500 },
      ],
    },
    {
      name: 'Liquid Aren', unit: 'ml', latestPrice: 46.28, minStock: 300, yieldQty: 1200,
      items: [
        { name: 'Gula Aren Foya', qty: 1000 },
        { name: 'Air Mineral Galon Cleo', qty: 500 },
      ],
    },
    {
      name: 'Simple Syrup', unit: 'ml', latestPrice: 15.45, minStock: 300, yieldQty: 1200,
      items: [
        { name: 'Gula Pasir Gulaku', qty: 1000 },
        { name: 'Air Mineral Galon Cleo', qty: 500 },
      ],
    },
    {
      name: 'Coldbrew Idjen', unit: 'ml', latestPrice: 58.38, minStock: 500, yieldQty: 7000,
      items: [
        { name: 'Anaerobic Idjen Gemilang', qty: 1000 },
        { name: 'Air Mineral Galon Cleo', qty: 8000 },
      ],
    },
    {
      name: 'Cream Top', unit: 'ml', latestPrice: 144.67, minStock: 100, yieldQty: 280,
      items: [
        { name: 'Creamer Milac', qty: 200 },
        { name: 'Susu Freshmilk Diamond', qty: 50 },
        { name: 'Flavour Vanila Foya', qty: 30 },
      ],
    },
    {
      name: 'Liquid Teh', unit: 'ml', latestPrice: 1.22, minStock: 500, yieldQty: 1000,
      items: [
        { name: 'Teh Tong Dji Jasmine', qty: 12 },
        { name: 'Air Mineral Galon Cleo', qty: 1000 },
      ],
    },
  ];

  for (const def of batchDefs) {
    const ing = await upsertIngredient({ name: def.name, type: 'PREPPED', unit: def.unit, latestPrice: def.latestPrice, minStock: def.minStock });

    // Check if recipe already exists
    const existingRecipe = await prisma.recipe.findFirst({ where: { ingredientId: ing.id } });
    if (existingRecipe) continue;

    // Resolve ingredient IDs from names
    const resolvedItems = def.items
      .map(item => ({ ingredientId: rawMap.get(item.name), quantity: item.qty }))
      .filter(item => item.ingredientId); // skip if not found

    if (resolvedItems.length !== def.items.length) {
      console.warn(`  ⚠ ${def.name}: beberapa bahan tidak ditemukan, skip recipe`);
      continue;
    }

    await prisma.recipe.create({
      data: {
        ingredientId: ing.id,
        yieldQty: def.yieldQty,
        yieldUnit: def.unit,
        items: {
          create: resolvedItems.map(i => ({ ingredientId: i.ingredientId!, quantity: i.quantity })),
        },
      },
    });
  }
  console.log(`  ✓ ${batchDefs.length} batch recipe (PREPPED)`);

  // ── 6. PRODUCTS ───────────────────────────────────────────────────────────
  const PRODUCTS = [
    { name: 'Kopi Soeka',               categoryId: 'cat_signature',  station: 'DRINK' },
    { name: 'Kopi House',               categoryId: 'cat_signature',  station: 'DRINK' },
    { name: 'Choco Mint',               categoryId: 'cat_signature',  station: 'DRINK' },
    { name: 'Summer Breeze',            categoryId: 'cat_signature',  station: 'DRINK' },
    { name: 'Berry Mont Blanc',         categoryId: 'cat_signature',  station: 'DRINK' },
    { name: 'Butterscotch Sea Salt',    categoryId: 'cat_signature',  station: 'DRINK' },
    { name: 'Cold Brew',                categoryId: 'cat_signature',  station: 'DRINK' },
    { name: 'Magic',                    categoryId: 'cat_coffee',     station: 'DRINK' },
    { name: 'Cappuccino',               categoryId: 'cat_coffee',     station: 'DRINK' },
    { name: 'White Latte',              categoryId: 'cat_coffee',     station: 'DRINK' },
    { name: 'Kopi Caramel',             categoryId: 'cat_coffee',     station: 'DRINK' },
    { name: 'Kopi Tiramisu',            categoryId: 'cat_coffee',     station: 'DRINK' },
    { name: 'Kopi Baileys',             categoryId: 'cat_coffee',     station: 'DRINK' },
    { name: 'Kopi Kakao',               categoryId: 'cat_coffee',     station: 'DRINK' },
    { name: 'Kopi Klepon',              categoryId: 'cat_coffee',     station: 'DRINK' },
    { name: 'Teh Peach',               categoryId: 'cat_tea',        station: 'DRINK' },
    { name: 'Teh Lemongrass',          categoryId: 'cat_tea',        station: 'DRINK' },
    { name: 'Kombucha Berry',          categoryId: 'cat_tea',        station: 'DRINK' },
    { name: 'Susu Vanila',             categoryId: 'cat_noncoffee',  station: 'DRINK' },
    { name: 'Susu Caramel',            categoryId: 'cat_noncoffee',  station: 'DRINK' },
    { name: 'Susu Klepon',             categoryId: 'cat_noncoffee',  station: 'DRINK' },
    { name: 'Matcha',                  categoryId: 'cat_noncoffee',  station: 'DRINK' },
    { name: 'Choco Tiramisu',          categoryId: 'cat_noncoffee',  station: 'DRINK' },
    { name: 'Variasi Pink',            categoryId: 'cat_noncoffee',  station: 'DRINK' },
    { name: 'Soeka Sparkling',         categoryId: 'cat_refresher',  station: 'DRINK' },
    { name: 'Soekaberry Tonic',        categoryId: 'cat_refresher',  station: 'DRINK' },
    { name: 'Pine Soda',               categoryId: 'cat_refresher',  station: 'DRINK' },
    { name: 'Strawberry Cold',         categoryId: 'cat_refresher',  station: 'DRINK' },
    { name: 'Fruit Bomb',              categoryId: 'cat_refresher',  station: 'DRINK' },
    { name: 'Palestino',               categoryId: 'cat_palestino',  station: 'DRINK' },
    { name: 'Orange Palestino',        categoryId: 'cat_palestino',  station: 'DRINK' },
    { name: 'Peach Palestino',         categoryId: 'cat_palestino',  station: 'DRINK' },
    { name: 'Chicken Burger Nashville',categoryId: 'cat_burger',     station: 'FOOD'  },
    { name: 'Classic Burger',          categoryId: 'cat_burger',     station: 'FOOD'  },
    { name: 'Superb Burger',           categoryId: 'cat_burger',     station: 'FOOD'  },
    { name: 'Nasi Oseng Daging Cabe Ijo', categoryId: 'cat_meals',  station: 'FOOD'  },
    { name: 'Nasi Ayam Crispy',        categoryId: 'cat_meals',      station: 'FOOD'  },
    { name: 'Nasi Telur Barendo',      categoryId: 'cat_meals',      station: 'FOOD'  },
    { name: 'Nasi Kulit',              categoryId: 'cat_meals',      station: 'FOOD'  },
    { name: 'Wings Nashville Honey',   categoryId: 'cat_snack',      station: 'FOOD'  },
    { name: 'Chicken Skin',            categoryId: 'cat_snack',      station: 'FOOD'  },
    { name: 'Mix Platter',             categoryId: 'cat_snack',      station: 'FOOD'  },
    { name: 'Potato Wedges',           categoryId: 'cat_snack',      station: 'FOOD'  },
    { name: 'Pisang Goreng',           categoryId: 'cat_snack',      station: 'FOOD'  },
    { name: 'Extra Shot',              categoryId: 'cat_addon',      station: 'DRINK' },
    { name: 'Extra Creamy',            categoryId: 'cat_addon',      station: 'DRINK' },
    { name: 'Mineral Water',           categoryId: 'cat_addon',      station: 'DRINK' },
    { name: 'Oatmilk',                categoryId: 'cat_addon',      station: 'DRINK' },
  ];

  for (const p of PRODUCTS) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) continue;
    await prisma.product.create({
      data: { name: p.name, categoryId: p.categoryId, station: p.station as any, price: 0, cost: 0, active: true },
    });
  }
  console.log(`  ✓ ${PRODUCTS.length} produk`);
}
