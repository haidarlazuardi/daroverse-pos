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
    { id: 'sup_001', name: 'Roastery Partner',         contactPerson: null, phone: null, email: null, address: null },
    { id: 'sup_002', name: 'Distributor Dairy',         contactPerson: null, phone: null, email: null, address: null },
    { id: 'sup_003', name: 'Toko Bahan Kue & Sirup',   contactPerson: null, phone: null, email: null, address: null },
    { id: 'sup_004', name: 'Pasar / Sayur Buah',        contactPerson: null, phone: null, email: null, address: null },
    { id: 'sup_005', name: 'Supplier Daging & Frozen',  contactPerson: null, phone: null, email: null, address: null },
    { id: 'sup_006', name: 'Toko Sembako',              contactPerson: null, phone: null, email: null, address: null },
    { id: 'sup_007', name: 'Sablon Cup Ranji',          contactPerson: null, phone: null, email: null, address: null },
    { id: 'sup_008', name: 'Supplier Cleo',             contactPerson: null, phone: null, email: null, address: null },
    { id: 'sup_009', name: 'Supplier Voya',             contactPerson: null, phone: null, email: null, address: null },
  ];

  for (const s of SUPPLIERS) {
    await prisma.supplier.upsert({ where: { id: s.id }, update: s, create: { ...s, active: true } });
  }
  console.log(`  ✓ ${SUPPLIERS.length} supplier`);

  // ── 3. BAHAN BAKU (RAW) ───────────────────────────────────────────────────
  // Field: id, name, unit (satuan pakai), purchaseUnit, conversionRate, latestPrice (per satuan pakai), minStock

  const RAW_INGREDIENTS = [
    // Dairy
    { id: 'ing_B001', name: 'Susu Freshmilk Diamond',    unit: 'ml',   purchaseUnit: 'karton',  conversionRate: 12000, latestPrice: 24.17,  minStock: 1000 },
    { id: 'ing_B002', name: 'Creamer Milac',              unit: 'ml',   purchaseUnit: 'pack',    conversionRate: 6000,  latestPrice: 84,     minStock: 500  },
    { id: 'ing_B003', name: 'Susu SKM Carnation',         unit: 'gram', purchaseUnit: 'pcs',     conversionRate: 370,   latestPrice: 54.05,  minStock: 370  },
    { id: 'ing_B004', name: 'Susu Evaporasi Carnation',   unit: 'gram', purchaseUnit: 'pcs',     conversionRate: 405,   latestPrice: 61.73,  minStock: 405  },
    { id: 'ing_B032', name: 'Oat Milk Oat Side',          unit: 'ml',   purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 35,     minStock: 500  },
    { id: 'ing_B046', name: 'Margarin Royal Palmia',      unit: 'gram', purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 95,     minStock: 200  },
    { id: 'ing_B055', name: 'Red Cheddar',                unit: 'pcs',  purchaseUnit: 'pack',    conversionRate: 84,    latestPrice: 2142.86,minStock: 10   },
    // Gula
    { id: 'ing_B005', name: 'Gula Aren Foya',             unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 55,     minStock: 500  },
    { id: 'ing_B006', name: 'Gula Pasir Gulaku',          unit: 'gram', purchaseUnit: 'kg',      conversionRate: 5000,  latestPrice: 18,     minStock: 500  },
    // Teh
    { id: 'ing_B007', name: 'Teh Tong Dji Jasmine',       unit: 'pcs',  purchaseUnit: 'pack',    conversionRate: 12,    latestPrice: 1166.67,minStock: 12   },
    // Tonic Soda
    { id: 'ing_B008', name: 'Soda Zoda',                  unit: 'ml',   purchaseUnit: 'karton',  conversionRate: 6000,  latestPrice: 20,     minStock: 500  },
    { id: 'ing_B009', name: 'Tonic Sweppes',              unit: 'ml',   purchaseUnit: 'karton',  conversionRate: 6000,  latestPrice: 23.33,  minStock: 500  },
    // Sirup & Flavor
    { id: 'ing_B010', name: 'Flavour Dark Choco Foya',    unit: 'gram', purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 166.5,  minStock: 200  },
    { id: 'ing_B011', name: 'Flavour Matcha Foya',        unit: 'gram', purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 155.4,  minStock: 200  },
    { id: 'ing_B013', name: 'Flavour Tiramisu Foya',      unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 140.6,  minStock: 150  },
    { id: 'ing_B014', name: 'Flavour Vanila Foya',        unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 140.6,  minStock: 150  },
    { id: 'ing_B015', name: 'Flavour Caramel Foya',       unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 140.6,  minStock: 150  },
    { id: 'ing_B016', name: 'Flavour Pandan Foya',        unit: 'ml',   purchaseUnit: 'pack',    conversionRate: 750,   latestPrice: 140.6,  minStock: 150  },
    { id: 'ing_B017', name: 'Flavour Strawberry Foya',    unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 140.6,  minStock: 150  },
    { id: 'ing_B018', name: 'Flavour Butterscotch Foya',  unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 140.6,  minStock: 150  },
    { id: 'ing_B019', name: 'Flavour Mint Foya',          unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 140.6,  minStock: 150  },
    { id: 'ing_B020', name: 'Flavour Peach Foya',         unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 154.07, minStock: 150  },
    { id: 'ing_B021', name: 'Flavour Fruity Foya',        unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 750,   latestPrice: 154.07, minStock: 150  },
    { id: 'ing_B023', name: 'Berry Juice Diamond',        unit: 'ml',   purchaseUnit: 'pack',    conversionRate: 946,   latestPrice: 39.43,  minStock: 200  },
    { id: 'ing_B024', name: 'Orange Juice Sunquick',      unit: 'ml',   purchaseUnit: 'botol',   conversionRate: 1000,  latestPrice: 95,     minStock: 200  },
    // Bumbu
    { id: 'ing_B022', name: 'Sea Salt',                   unit: 'gram', purchaseUnit: 'pack',    conversionRate: 300,   latestPrice: 166.67, minStock: 50   },
    { id: 'ing_B043', name: 'Cabai Cayenne',              unit: 'gram', purchaseUnit: 'pack',    conversionRate: 500,   latestPrice: 82,     minStock: 100  },
    { id: 'ing_B044', name: 'Cajun Seasoning',            unit: 'gram', purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 115,    minStock: 100  },
    { id: 'ing_B045', name: 'Smoke Powder',               unit: 'gram', purchaseUnit: 'pack',    conversionRate: 250,   latestPrice: 380,    minStock: 50   },
    { id: 'ing_B060', name: 'Penyedap Rasa Knorr',        unit: 'gram', purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 125,    minStock: 100  },
    { id: 'ing_B065', name: 'Baking Soda',                unit: 'gram', purchaseUnit: 'botol',   conversionRate: 81,    latestPrice: 98.77,  minStock: 30   },
    // Kopi
    { id: 'ing_B025', name: 'House Blend Beans 60:40',    unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 240,    minStock: 500  },
    { id: 'ing_B026', name: 'Anaerobic Idjen Gemilang',   unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 400,    minStock: 250  },
    { id: 'ing_B028', name: 'Specialty Beans',            unit: 'gram', purchaseUnit: 'pack',    conversionRate: 250,   latestPrice: 500,    minStock: 250  },
    // Galon
    { id: 'ing_B031', name: 'Air Mineral Galon Cleo',     unit: 'ml',   purchaseUnit: 'pcs',     conversionRate: 19000, latestPrice: 1.08,   minStock: 5000 },
    // Sayur & Buah
    { id: 'ing_B029', name: 'Nanas',                      unit: 'gram', purchaseUnit: 'pcs',     conversionRate: 1000,  latestPrice: 20,     minStock: 500  },
    { id: 'ing_B040', name: 'Kentang Dieng',              unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 20,     minStock: 500  },
    { id: 'ing_B041', name: 'Pisang Oli',                 unit: 'gram', purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 15,     minStock: 300  },
    { id: 'ing_B047', name: 'Romaine Lettuce',            unit: 'gram', purchaseUnit: 'pcs',     conversionRate: 1000,  latestPrice: 20,     minStock: 200  },
    { id: 'ing_B049', name: 'Bawang Bombay',              unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 20,     minStock: 200  },
    { id: 'ing_B050', name: 'Bawang Putih',               unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 30,     minStock: 200  },
    { id: 'ing_B051', name: 'Bawang Merah',               unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 30,     minStock: 200  },
    { id: 'ing_B056', name: 'Cabai Hijau Besar',          unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 20,     minStock: 200  },
    { id: 'ing_B058', name: 'Lengkuas',                   unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 15,     minStock: 100  },
    { id: 'ing_B059', name: 'Daun Jeruk',                 unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 20,     minStock: 50   },
    // Protein
    { id: 'ing_B034', name: 'Paha Ayam Fillet',           unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 52,     minStock: 500  },
    { id: 'ing_B035', name: 'Kulit Ayam',                 unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 38,     minStock: 300  },
    { id: 'ing_B036', name: 'Daging Has Dalam',           unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 160,    minStock: 500  },
    { id: 'ing_B037', name: 'Daging Giling',              unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 100,    minStock: 300  },
    { id: 'ing_B038', name: 'Telur',                      unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 30,     minStock: 500  },
    { id: 'ing_B039', name: 'Sayap Ayam',                 unit: 'gram', purchaseUnit: 'kg',      conversionRate: 1000,  latestPrice: 45,     minStock: 500  },
    // Karbohidrat
    { id: 'ing_B033', name: 'Beras Setra Ramos',          unit: 'gram', purchaseUnit: 'sak',     conversionRate: 10000, latestPrice: 25,     minStock: 2000 },
    // Bakery & Dry
    { id: 'ing_B042', name: 'Tepung Terigu Kunci Biru',   unit: 'gram', purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 19,     minStock: 500  },
    { id: 'ing_B061', name: 'Tepung Maizena',             unit: 'gram', purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 28,     minStock: 200  },
    { id: 'ing_B064', name: 'Burger Bun Butterfield',     unit: 'pcs',  purchaseUnit: 'pcs',     conversionRate: 10,    latestPrice: 3000,   minStock: 10   },
    // Topping
    { id: 'ing_B030', name: 'Chocolate Crumble',          unit: 'gram', purchaseUnit: 'pack',    conversionRate: 500,   latestPrice: 94,     minStock: 100  },
    { id: 'ing_B052', name: 'Saus Cabai Del Monte',       unit: 'pcs',  purchaseUnit: 'karton',  conversionRate: 480,   latestPrice: 322.92, minStock: 10   },
    { id: 'ing_B053', name: 'Mayonaise Mamayo',           unit: 'gram', purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 26,     minStock: 200  },
    { id: 'ing_B054', name: 'Saus BBQ Smoky',             unit: 'gram', purchaseUnit: 'pack',    conversionRate: 1000,  latestPrice: 35,     minStock: 200  },
    { id: 'ing_B057', name: 'Saus Tiram Cap Panda',       unit: 'gram', purchaseUnit: 'botol',   conversionRate: 500,   latestPrice: 100,    minStock: 100  },
    { id: 'ing_B063', name: 'Kecap Manis Bango',          unit: 'ml',   purchaseUnit: 'pack',    conversionRate: 735,   latestPrice: 47.62,  minStock: 200  },
    // Oil
    { id: 'ing_B048', name: 'Minyak Sawit Minyakita',     unit: 'ml',   purchaseUnit: 'galon',   conversionRate: 5000,  latestPrice: 24,     minStock: 1000 },
  ];

  for (const ing of RAW_INGREDIENTS) {
    const existing = await prisma.ingredient.findFirst({ where: { name: ing.name } });
    if (existing) continue;
    const created = await prisma.ingredient.create({
      data: {
        id:             ing.id,
        name:           ing.name,
        type:           'RAW',
        unit:           ing.unit,
        purchaseUnit:   ing.purchaseUnit,
        conversionRate: ing.conversionRate,
        latestPrice:    ing.latestPrice,
        minStock:       ing.minStock,
        active:         true,
      },
    });
    // Create stock levels
    await prisma.stockLevel.createMany({
      data: ['GUDANG','BAR','KITCHEN'].map(location => ({ ingredientId: created.id, location: location as any, quantity: 0 })),
      skipDuplicates: true,
    });
  }
  console.log(`  ✓ ${RAW_INGREDIENTS.length} bahan baku (RAW)`);

  // ── 4. BATCH RECIPES (PREPPED ingredients) ────────────────────────────────

  const BATCH_RECIPES = [
    {
      id: 'ing_BRB01', name: 'Milk Premix',     unit: 'ml', latestPrice: 37.56, minStock: 500,
      yieldQty: 3847,
      items: [
        { ingredientId: 'ing_B001', quantity: 2835 }, // Susu Freshmilk
        { ingredientId: 'ing_B004', quantity: 405  }, // Susu Evaporasi (gram → ml approx)
        { ingredientId: 'ing_B002', quantity: 607  }, // Creamer
      ],
    },
    {
      id: 'ing_BRB02', name: 'Espresso',         unit: 'ml', latestPrice: 81.08, minStock: 300,
      yieldQty: 1500,
      items: [
        { ingredientId: 'ing_B025', quantity: 500  }, // House Blend Beans
        { ingredientId: 'ing_B031', quantity: 1500 }, // Air Galon
      ],
    },
    {
      id: 'ing_BRB03', name: 'Liquid Aren',      unit: 'ml', latestPrice: 46.28, minStock: 300,
      yieldQty: 1200,
      items: [
        { ingredientId: 'ing_B005', quantity: 1000 }, // Gula Aren
        { ingredientId: 'ing_B031', quantity: 500  }, // Air Galon
      ],
    },
    {
      id: 'ing_BRB04', name: 'Simple Syrup',     unit: 'ml', latestPrice: 15.45, minStock: 300,
      yieldQty: 1200,
      items: [
        { ingredientId: 'ing_B006', quantity: 1000 }, // Gula Pasir
        { ingredientId: 'ing_B031', quantity: 500  }, // Air Galon
      ],
    },
    {
      id: 'ing_BRB05', name: 'Coldbrew Idjen',   unit: 'ml', latestPrice: 58.38, minStock: 500,
      yieldQty: 7000,
      items: [
        { ingredientId: 'ing_B026', quantity: 1000 }, // Anaerobic Idjen
        { ingredientId: 'ing_B031', quantity: 8000 }, // Air Galon
      ],
    },
    {
      id: 'ing_BRB06', name: 'Cream Top',        unit: 'ml', latestPrice: 144.67, minStock: 100,
      yieldQty: 280,
      items: [
        { ingredientId: 'ing_B002', quantity: 200 }, // Creamer
        { ingredientId: 'ing_B001', quantity: 50  }, // Susu Freshmilk
        { ingredientId: 'ing_B014', quantity: 30  }, // Flavour Vanila
      ],
    },
    {
      id: 'ing_BRB07', name: 'Liquid Teh',       unit: 'ml', latestPrice: 1.22, minStock: 500,
      yieldQty: 1000,
      items: [
        { ingredientId: 'ing_B007', quantity: 12   }, // Teh
        { ingredientId: 'ing_B031', quantity: 1000 }, // Air Galon
      ],
    },
  ];

  for (const batch of BATCH_RECIPES) {
    const existing = await prisma.ingredient.findFirst({ where: { name: batch.name } });
    if (existing) continue;
    const created = await prisma.ingredient.create({
      data: {
        id:          batch.id,
        name:        batch.name,
        type:        'PREPPED',
        unit:        batch.unit,
        latestPrice: batch.latestPrice,
        minStock:    batch.minStock,
        active:      true,
      },
    });
    // Create prep recipe
    await prisma.recipe.create({
      data: {
        ingredientId: created.id,
        yieldQty:     batch.yieldQty,
        yieldUnit:    batch.unit,
        items: {
          create: batch.items.map(i => ({ ingredientId: i.ingredientId, quantity: i.quantity })),
        },
      },
    });
    // Stock levels
    await prisma.stockLevel.createMany({
      data: ['GUDANG','BAR','KITCHEN'].map(location => ({ ingredientId: created.id, location: location as any, quantity: 0 })),
      skipDuplicates: true,
    });
  }
  console.log(`  ✓ ${BATCH_RECIPES.length} batch recipe (PREPPED)`);

  // ── 5. PRODUCTS ───────────────────────────────────────────────────────────
  // Harga jual = 0 (lo isi manual via UI). Station: DRINK untuk minuman, FOOD untuk makanan.

  const PRODUCTS = [
    // Signature
    { id: 'prd_P001', name: 'Kopi Soeka',              categoryId: 'cat_signature',  station: 'DRINK', price: 0 },
    { id: 'prd_P002', name: 'Kopi House',               categoryId: 'cat_signature',  station: 'DRINK', price: 0 },
    { id: 'prd_P003', name: 'Choco Mint',               categoryId: 'cat_signature',  station: 'DRINK', price: 0 },
    { id: 'prd_P004', name: 'Summer Breeze',            categoryId: 'cat_signature',  station: 'DRINK', price: 0 },
    { id: 'prd_P005', name: 'Berry Mont Blanc',         categoryId: 'cat_signature',  station: 'DRINK', price: 0 },
    { id: 'prd_P006', name: 'Butterscotch Sea Salt',    categoryId: 'cat_signature',  station: 'DRINK', price: 0 },
    { id: 'prd_P007', name: 'Cold Brew',                categoryId: 'cat_signature',  station: 'DRINK', price: 0 },
    // Coffee
    { id: 'prd_P008', name: 'Magic',                    categoryId: 'cat_coffee',     station: 'DRINK', price: 0 },
    { id: 'prd_P009', name: 'Cappuccino',               categoryId: 'cat_coffee',     station: 'DRINK', price: 0 },
    { id: 'prd_P010', name: 'White Latte',              categoryId: 'cat_coffee',     station: 'DRINK', price: 0 },
    { id: 'prd_P011', name: 'Kopi Caramel',             categoryId: 'cat_coffee',     station: 'DRINK', price: 0 },
    { id: 'prd_P012', name: 'Kopi Tiramisu',            categoryId: 'cat_coffee',     station: 'DRINK', price: 0 },
    { id: 'prd_P013', name: 'Kopi Baileys',             categoryId: 'cat_coffee',     station: 'DRINK', price: 0 },
    { id: 'prd_P014', name: 'Kopi Kakao',               categoryId: 'cat_coffee',     station: 'DRINK', price: 0 },
    { id: 'prd_P015', name: 'Kopi Klepon',              categoryId: 'cat_coffee',     station: 'DRINK', price: 0 },
    // Tea
    { id: 'prd_P016', name: 'Teh Peach',               categoryId: 'cat_tea',        station: 'DRINK', price: 0 },
    { id: 'prd_P017', name: 'Teh Lemongrass',          categoryId: 'cat_tea',        station: 'DRINK', price: 0 },
    { id: 'prd_P018', name: 'Kombucha Berry',          categoryId: 'cat_tea',        station: 'DRINK', price: 0 },
    // Non Coffee
    { id: 'prd_P019', name: 'Susu Vanila',             categoryId: 'cat_noncoffee',  station: 'DRINK', price: 0 },
    { id: 'prd_P020', name: 'Susu Caramel',            categoryId: 'cat_noncoffee',  station: 'DRINK', price: 0 },
    { id: 'prd_P021', name: 'Susu Klepon',             categoryId: 'cat_noncoffee',  station: 'DRINK', price: 0 },
    { id: 'prd_P022', name: 'Matcha',                  categoryId: 'cat_noncoffee',  station: 'DRINK', price: 0 },
    { id: 'prd_P023', name: 'Choco Tiramisu',          categoryId: 'cat_noncoffee',  station: 'DRINK', price: 0 },
    { id: 'prd_P024', name: 'Variasi Pink',            categoryId: 'cat_noncoffee',  station: 'DRINK', price: 0 },
    // Refresher
    { id: 'prd_P025', name: 'Soeka Sparkling',         categoryId: 'cat_refresher',  station: 'DRINK', price: 0 },
    { id: 'prd_P026', name: 'Soekaberry Tonic',        categoryId: 'cat_refresher',  station: 'DRINK', price: 0 },
    { id: 'prd_P027', name: 'Pine Soda',               categoryId: 'cat_refresher',  station: 'DRINK', price: 0 },
    { id: 'prd_P028', name: 'Strawberry Cold',         categoryId: 'cat_refresher',  station: 'DRINK', price: 0 },
    { id: 'prd_P029', name: 'Fruit Bomb',              categoryId: 'cat_refresher',  station: 'DRINK', price: 0 },
    // Palestino
    { id: 'prd_P030', name: 'Palestino',               categoryId: 'cat_palestino',  station: 'DRINK', price: 0 },
    { id: 'prd_P031', name: 'Orange Palestino',        categoryId: 'cat_palestino',  station: 'DRINK', price: 0 },
    { id: 'prd_P032', name: 'Peach Palestino',         categoryId: 'cat_palestino',  station: 'DRINK', price: 0 },
    // Burger
    { id: 'prd_P033', name: 'Chicken Burger Nashville',categoryId: 'cat_burger',     station: 'FOOD',  price: 0 },
    { id: 'prd_P034', name: 'Classic Burger',          categoryId: 'cat_burger',     station: 'FOOD',  price: 0 },
    { id: 'prd_P035', name: 'Superb Burger',           categoryId: 'cat_burger',     station: 'FOOD',  price: 0 },
    // Meals
    { id: 'prd_P036', name: 'Nasi Oseng Daging Cabe Ijo', categoryId: 'cat_meals',  station: 'FOOD',  price: 0 },
    { id: 'prd_P037', name: 'Nasi Ayam Crispy',        categoryId: 'cat_meals',      station: 'FOOD',  price: 0 },
    { id: 'prd_P038', name: 'Nasi Telur Barendo',      categoryId: 'cat_meals',      station: 'FOOD',  price: 0 },
    { id: 'prd_P039', name: 'Nasi Kulit',              categoryId: 'cat_meals',      station: 'FOOD',  price: 0 },
    // Snack
    { id: 'prd_P040', name: 'Wings Nashville Honey',   categoryId: 'cat_snack',      station: 'FOOD',  price: 0 },
    { id: 'prd_P041', name: 'Chicken Skin',            categoryId: 'cat_snack',      station: 'FOOD',  price: 0 },
    { id: 'prd_P042', name: 'Mix Platter',             categoryId: 'cat_snack',      station: 'FOOD',  price: 0 },
    { id: 'prd_P043', name: 'Potato Wedges',           categoryId: 'cat_snack',      station: 'FOOD',  price: 0 },
    { id: 'prd_P044', name: 'Pisang Goreng',           categoryId: 'cat_snack',      station: 'FOOD',  price: 0 },
    // Add On
    { id: 'prd_P045', name: 'Extra Shot',              categoryId: 'cat_addon',      station: 'DRINK', price: 0 },
    { id: 'prd_P046', name: 'Extra Creamy',            categoryId: 'cat_addon',      station: 'DRINK', price: 0 },
    { id: 'prd_P047', name: 'Mineral Water',           categoryId: 'cat_addon',      station: 'DRINK', price: 0 },
    { id: 'prd_P048', name: 'Oatmilk',                categoryId: 'cat_addon',      station: 'DRINK', price: 0 },
  ];

  for (const p of PRODUCTS) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) continue;
    await prisma.product.create({
      data: {
        id:         p.id,
        name:       p.name,
        categoryId: p.categoryId,
        station:    p.station as any,
        price:      p.price,
        cost:       0,
        active:     true,
      },
    });
  }
  console.log(`  ✓ ${PRODUCTS.length} produk`);
}
