import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Daroverse POS...\n');

  // Clean existing data
  await prisma.stockMovement.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.stockOpnameItem.deleteMany();
  await prisma.stockOpname.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.recipeItem.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.outletProduct.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.discount.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.appSetting.deleteMany();
  await prisma.user.deleteMany();
  await prisma.outlet.deleteMany();

  // ─── Outlets ─────────────────────────────────────
  const outlet1 = await prisma.outlet.create({
    data: { name: 'Daroverse HQ', address: 'Jl. Margonda Raya No. 100, Depok', phone: '021-7712345' },
  });
  const outlet2 = await prisma.outlet.create({
    data: { name: 'Daroverse Mall', address: 'Mall Detos Lt. 2, Depok', phone: '021-7754321' },
  });
  console.log('✅ Outlets created');

  // ─── Users ───────────────────────────────────────
  const adminPass = await bcrypt.hash('admin123', 12);
  const cashierPass = await bcrypt.hash('cashier123', 12);

  await prisma.user.createMany({
    data: [
      { name: 'Haidar Admin', email: 'admin@daroverse.com', password: adminPass, role: 'ADMIN', outletId: outlet1.id },
      { name: 'Rina Kasir', email: 'cashier@daroverse.com', password: cashierPass, role: 'CASHIER', outletId: outlet1.id },
      { name: 'Budi Kasir', email: 'budi@daroverse.com', password: cashierPass, role: 'CASHIER', outletId: outlet2.id },
    ],
  });
  console.log('✅ Users created');

  // ─── Categories ──────────────────────────────────
  const catCoffee = await prisma.category.create({ data: { name: 'Coffee', color: '#92400e', sortOrder: 1 } });
  const catNonCoffee = await prisma.category.create({ data: { name: 'Non-Coffee', color: '#059669', sortOrder: 2 } });
  const catFood = await prisma.category.create({ data: { name: 'Food', color: '#dc2626', sortOrder: 3 } });
  const catSnack = await prisma.category.create({ data: { name: 'Snacks', color: '#7c3aed', sortOrder: 4 } });
  const catDessert = await prisma.category.create({ data: { name: 'Desserts', color: '#db2777', sortOrder: 5 } });
  console.log('✅ Categories created');

  // ─── Ingredients ─────────────────────────────────
  const ingredients = await Promise.all([
    prisma.ingredient.create({ data: { name: 'Arabica Coffee Beans', unit: 'g', minStock: 2000, latestPrice: 150 } }),      // 0
    prisma.ingredient.create({ data: { name: 'Robusta Coffee Beans', unit: 'g', minStock: 1000, latestPrice: 80 } }),       // 1
    prisma.ingredient.create({ data: { name: 'Fresh Milk', unit: 'ml', minStock: 5000, latestPrice: 18 } }),                // 2
    prisma.ingredient.create({ data: { name: 'Sugar', unit: 'g', minStock: 3000, latestPrice: 14 } }),                      // 3
    prisma.ingredient.create({ data: { name: 'Chocolate Syrup', unit: 'ml', minStock: 1000, latestPrice: 45 } }),           // 4
    prisma.ingredient.create({ data: { name: 'Vanilla Syrup', unit: 'ml', minStock: 500, latestPrice: 55 } }),              // 5
    prisma.ingredient.create({ data: { name: 'Matcha Powder', unit: 'g', minStock: 500, latestPrice: 250 } }),              // 6
    prisma.ingredient.create({ data: { name: 'Ice Cubes', unit: 'g', minStock: 10000, latestPrice: 3 } }),                  // 7
    prisma.ingredient.create({ data: { name: 'Whipped Cream', unit: 'ml', minStock: 500, latestPrice: 60 } }),              // 8
    prisma.ingredient.create({ data: { name: 'Bread Slices', unit: 'pcs', minStock: 50, latestPrice: 2500 } }),             // 9
    prisma.ingredient.create({ data: { name: 'Cheddar Cheese', unit: 'g', minStock: 500, latestPrice: 120 } }),             // 10
    prisma.ingredient.create({ data: { name: 'Butter', unit: 'g', minStock: 500, latestPrice: 100 } }),                     // 11
    prisma.ingredient.create({ data: { name: 'Chicken Breast', unit: 'g', minStock: 1000, latestPrice: 55 } }),             // 12
    prisma.ingredient.create({ data: { name: 'Rice', unit: 'g', minStock: 5000, latestPrice: 12 } }),                       // 13
    prisma.ingredient.create({ data: { name: 'Cooking Oil', unit: 'ml', minStock: 2000, latestPrice: 18 } }),               // 14
    prisma.ingredient.create({ data: { name: 'Eggs', unit: 'pcs', minStock: 50, latestPrice: 2800 } }),                     // 15
    prisma.ingredient.create({ data: { name: 'French Fries (Frozen)', unit: 'g', minStock: 2000, latestPrice: 35 } }),      // 16
    prisma.ingredient.create({ data: { name: 'Flour', unit: 'g', minStock: 2000, latestPrice: 10 } }),                      // 17
    prisma.ingredient.create({ data: { name: 'Tea Leaves', unit: 'g', minStock: 500, latestPrice: 200 } }),                 // 18
    prisma.ingredient.create({ data: { name: 'Honey', unit: 'ml', minStock: 300, latestPrice: 120 } }),                     // 19
  ]);
  console.log('✅ Ingredients created');

  // ─── Stock Levels ────────────────────────────────
  for (const outlet of [outlet1, outlet2]) {
    for (const ing of ingredients) {
      const baseQty = ing.minStock * (2 + Math.random() * 3);
      await prisma.stockLevel.create({
        data: { outletId: outlet.id, ingredientId: ing.id, quantity: Math.round(baseQty) },
      });
    }
  }
  console.log('✅ Stock levels initialized');

  // ─── Products with Recipes ───────────────────────
  const productData = [
    // Coffee
    { name: 'Espresso', cat: catCoffee.id, price: 18000, recipe: [{ i: 0, q: 18 }] },
    { name: 'Americano', cat: catCoffee.id, price: 22000, recipe: [{ i: 0, q: 18 }] },
    { name: 'Cafe Latte', cat: catCoffee.id, price: 28000, recipe: [{ i: 0, q: 18 }, { i: 2, q: 200 }] },
    { name: 'Cappuccino', cat: catCoffee.id, price: 28000, recipe: [{ i: 0, q: 18 }, { i: 2, q: 150 }] },
    { name: 'Vanilla Latte', cat: catCoffee.id, price: 32000, recipe: [{ i: 0, q: 18 }, { i: 2, q: 200 }, { i: 5, q: 20 }] },
    { name: 'Mocha', cat: catCoffee.id, price: 32000, recipe: [{ i: 0, q: 18 }, { i: 2, q: 200 }, { i: 4, q: 30 }] },
    { name: 'Iced Coffee', cat: catCoffee.id, price: 25000, recipe: [{ i: 0, q: 18 }, { i: 2, q: 100 }, { i: 3, q: 15 }, { i: 7, q: 150 }] },
    { name: 'Kopi Susu Gula Aren', cat: catCoffee.id, price: 24000, recipe: [{ i: 1, q: 20 }, { i: 2, q: 150 }, { i: 3, q: 20 }, { i: 7, q: 150 }] },
    // Non-Coffee
    { name: 'Matcha Latte', cat: catNonCoffee.id, price: 30000, recipe: [{ i: 6, q: 5 }, { i: 2, q: 250 }, { i: 3, q: 10 }] },
    { name: 'Hot Chocolate', cat: catNonCoffee.id, price: 26000, recipe: [{ i: 4, q: 40 }, { i: 2, q: 200 }] },
    { name: 'Iced Tea', cat: catNonCoffee.id, price: 15000, recipe: [{ i: 18, q: 5 }, { i: 3, q: 20 }, { i: 7, q: 200 }] },
    { name: 'Honey Lemon Tea', cat: catNonCoffee.id, price: 22000, recipe: [{ i: 18, q: 5 }, { i: 19, q: 15 }] },
    { name: 'Fresh Milk', cat: catNonCoffee.id, price: 20000, recipe: [{ i: 2, q: 300 }] },
    // Food
    { name: 'Nasi Goreng Ayam', cat: catFood.id, price: 35000, recipe: [{ i: 13, q: 200 }, { i: 12, q: 100 }, { i: 15, q: 1 }, { i: 14, q: 20 }] },
    { name: 'Grilled Cheese Sandwich', cat: catFood.id, price: 28000, recipe: [{ i: 9, q: 2 }, { i: 10, q: 40 }, { i: 11, q: 15 }] },
    { name: 'Chicken Sandwich', cat: catFood.id, price: 32000, recipe: [{ i: 9, q: 2 }, { i: 12, q: 80 }, { i: 10, q: 20 }, { i: 11, q: 10 }] },
    // Snacks
    { name: 'French Fries', cat: catSnack.id, price: 20000, recipe: [{ i: 16, q: 150 }, { i: 14, q: 30 }] },
    { name: 'Roti Bakar', cat: catSnack.id, price: 18000, recipe: [{ i: 9, q: 2 }, { i: 11, q: 20 }, { i: 3, q: 10 }] },
    // Desserts
    { name: 'Chocolate Waffle', cat: catDessert.id, price: 30000, recipe: [{ i: 17, q: 80 }, { i: 15, q: 1 }, { i: 4, q: 30 }, { i: 8, q: 20 }] },
    { name: 'Pancake Stack', cat: catDessert.id, price: 28000, recipe: [{ i: 17, q: 100 }, { i: 15, q: 2 }, { i: 2, q: 50 }, { i: 19, q: 15 }] },
  ];

  const products = [];
  for (const p of productData) {
    // Calculate cost
    let cost = 0;
    for (const ri of p.recipe) {
      cost += ri.q * ingredients[ri.i].latestPrice;
    }

    const product = await prisma.product.create({
      data: {
        name: p.name,
        categoryId: p.cat,
        price: p.price,
        cost,
        sku: `SKU-${p.name.replace(/\s+/g, '-').toUpperCase().slice(0, 12)}`,
        recipe: {
          create: {
            items: {
              create: p.recipe.map(ri => ({
                ingredientId: ingredients[ri.i].id,
                quantity: ri.q,
              })),
            },
          },
        },
      },
    });
    products.push(product);

    // Make available in both outlets
    await prisma.outletProduct.createMany({
      data: [
        { outletId: outlet1.id, productId: product.id },
        { outletId: outlet2.id, productId: product.id },
      ],
    });
  }
  console.log('✅ Products with recipes created');

  // ─── Suppliers ───────────────────────────────────
  const sup1 = await prisma.supplier.create({
    data: { name: 'PT Kopi Nusantara', contactPerson: 'Ahmad', phone: '08123456789', email: 'ahmad@kopinus.id', address: 'Bandung, Jawa Barat' },
  });
  const sup2 = await prisma.supplier.create({
    data: { name: 'CV Segar Makmur', contactPerson: 'Dewi', phone: '08198765432', email: 'dewi@segarmakmur.id', address: 'Bogor, Jawa Barat' },
  });
  const sup3 = await prisma.supplier.create({
    data: { name: 'UD Bahan Bakery', contactPerson: 'Roni', phone: '08111222333', email: 'roni@bahanbakery.id', address: 'Jakarta Selatan' },
  });
  console.log('✅ Suppliers created');

  // ─── Customers ───────────────────────────────────
  await prisma.customer.createMany({
    data: [
      { name: 'Walk-in Customer', phone: null },
      { name: 'Pak Joko', phone: '08123000111' },
      { name: 'Ibu Sari', phone: '08123000222' },
    ],
  });
  console.log('✅ Customers created');

  // ─── Sample Orders (last 30 days) ────────────────
  const users = await prisma.user.findMany();
  const cashiers = users.filter(u => u.role === 'CASHIER');
  const admin = users.find(u => u.role === 'ADMIN')!;

  let orderCount = 0;
  for (let daysAgo = 30; daysAgo >= 0; daysAgo--) {
    const ordersPerDay = 5 + Math.floor(Math.random() * 15); // 5-20 orders per day

    for (let o = 0; o < ordersPerDay; o++) {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      date.setHours(7 + Math.floor(Math.random() * 14), Math.floor(Math.random() * 60));

      const numItems = 1 + Math.floor(Math.random() * 4);
      const selectedProducts: typeof products[number][] = [];
      for (let i = 0; i < numItems; i++) {
        const p = products[Math.floor(Math.random() * products.length)];
        if (!selectedProducts.find(sp => sp.id === p.id)) selectedProducts.push(p);
      }

      const items = selectedProducts.map(p => ({
        productId: p.id,
        quantity: 1 + Math.floor(Math.random() * 3),
        price: p.price,
        cost: p.cost,
        subtotal: 0,
      }));
      items.forEach(i => { i.subtotal = i.price * i.quantity; });

      const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
      const tax = subtotal * 0.11;
      const total = subtotal + tax;
      const costTotal = items.reduce((s, i) => s + i.cost * i.quantity, 0);
      const profit = total - costTotal;

      const cashier = cashiers[Math.floor(Math.random() * cashiers.length)] || admin;

      const orderNum = `ORD-${date.toISOString().slice(2, 10).replace(/-/g, '')}-${String(orderCount).padStart(4, '0')}`;

      await prisma.order.create({
        data: {
          orderNumber: orderNum,
          outletId: outlet1.id,
          userId: cashier.id,
          status: 'COMPLETED',
          subtotal, tax, total, costTotal, profit,
          createdAt: date,
          items: {
            create: items.map(i => ({
              productId: i.productId,
              quantity: i.quantity,
              price: i.price,
              cost: i.cost,
              subtotal: i.subtotal,
            })),
          },
          payment: {
            create: {
              method: Math.random() > 0.3 ? 'CASH' : 'QRIS',
              status: 'PAID',
              amount: total,
              received: Math.random() > 0.5 ? Math.ceil(total / 10000) * 10000 : total,
              change: 0,
              createdAt: date,
            },
          },
        },
      });
      orderCount++;
    }
  }
  console.log(`✅ ${orderCount} sample orders created`);

  // ─── Sample Purchase Orders ──────────────────────
  await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-SEED-0001',
      outletId: outlet1.id,
      supplierId: sup1.id,
      status: 'COMPLETED',
      totalAmount: 750000,
      completedAt: new Date(),
      createdBy: admin.id,
      items: {
        create: [
          { ingredientId: ingredients[0].id, quantity: 3000, unitPrice: 150, totalPrice: 450000, receivedQty: 3000 },
          { ingredientId: ingredients[1].id, quantity: 2000, unitPrice: 80, totalPrice: 160000, receivedQty: 2000 },
        ],
      },
    },
  });

  await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-SEED-0002',
      outletId: outlet1.id,
      supplierId: sup2.id,
      status: 'APPROVED',
      totalAmount: 540000,
      approvedAt: new Date(),
      createdBy: admin.id,
      items: {
        create: [
          { ingredientId: ingredients[2].id, quantity: 20000, unitPrice: 18, totalPrice: 360000 },
          { ingredientId: ingredients[15].id, quantity: 100, unitPrice: 2800, totalPrice: 280000 },
        ],
      },
    },
  });

  await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-SEED-0003',
      outletId: outlet1.id,
      supplierId: sup3.id,
      status: 'DRAFT',
      totalAmount: 200000,
      createdBy: admin.id,
      items: {
        create: [
          { ingredientId: ingredients[17].id, quantity: 10000, unitPrice: 10, totalPrice: 100000 },
          { ingredientId: ingredients[11].id, quantity: 1000, unitPrice: 100, totalPrice: 100000 },
        ],
      },
    },
  });
  console.log('✅ Sample purchase orders created');

  // ─── Discount Presets ────────────────────────────
  await prisma.discount.createMany({
    data: [
      { name: 'Member 10%', type: 'PERCENT', value: 10, active: true },
      { name: 'Promo Ramadan 15%', type: 'PERCENT', value: 15, active: true, maxDiscount: 20000 },
      { name: 'Diskon Rp5.000', type: 'FIXED', value: 5000, active: true, minOrder: 30000 },
      { name: 'Happy Hour 20%', type: 'PERCENT', value: 20, active: true, maxDiscount: 15000 },
      { name: 'Student Discount', type: 'PERCENT', value: 10, active: true },
    ],
  });
  console.log('✅ Discount presets created');

  // ─── Sample Expenses ─────────────────────────────
  const expenseData = [
    { category: 'UTILITIES', description: 'Listrik bulan ini', amount: 850000 },
    { category: 'UTILITIES', description: 'Air PDAM', amount: 150000 },
    { category: 'SUPPLIES', description: 'Gas LPG 3kg x5', amount: 100000 },
    { category: 'SUPPLIES', description: 'Tissue, sabun, lap', amount: 75000 },
    { category: 'OPERATIONAL', description: 'Parkir harian', amount: 10000 },
    { category: 'MAINTENANCE', description: 'Service grinder', amount: 350000 },
    { category: 'TRANSPORT', description: 'Grab belanja bahan', amount: 25000 },
  ];
  for (const exp of expenseData) {
    await prisma.expense.create({
      data: { ...exp, outletId: outlet1.id, createdBy: admin.id, paidBy: 'Petty Cash' } as any,
    });
  }
  console.log('✅ Sample expenses created');

  // ─── Sample Assets ───────────────────────────────
  await prisma.asset.createMany({
    data: [
      { name: 'Espresso Machine La Marzocco', code: 'EQ-001', outletId: outlet1.id, category: 'Peralatan Bar', condition: 'GOOD', purchasePrice: 45000000, currentValue: 35000000, location: 'Bar' },
      { name: 'Coffee Grinder Eureka', code: 'EQ-002', outletId: outlet1.id, category: 'Peralatan Bar', condition: 'GOOD', purchasePrice: 8500000, currentValue: 7000000, location: 'Bar' },
      { name: 'Blender Vitamix', code: 'EQ-003', outletId: outlet1.id, category: 'Peralatan Dapur', condition: 'GOOD', purchasePrice: 3500000, currentValue: 3000000, location: 'Dapur' },
      { name: 'Kulkas 2 Pintu Samsung', code: 'EQ-004', outletId: outlet1.id, category: 'Elektronik', condition: 'GOOD', purchasePrice: 5500000, currentValue: 4000000, location: 'Dapur' },
      { name: 'Meja Kasir Custom', code: 'FN-001', outletId: outlet1.id, category: 'Furnitur', condition: 'GOOD', purchasePrice: 2000000, currentValue: 1500000, location: 'Kasir' },
      { name: 'Kursi Pelanggan x10', code: 'FN-002', outletId: outlet1.id, category: 'Furnitur', condition: 'FAIR', purchasePrice: 5000000, currentValue: 3000000, location: 'Dining Area' },
      { name: 'Waffle Maker', code: 'EQ-005', outletId: outlet1.id, category: 'Peralatan Dapur', condition: 'GOOD', purchasePrice: 1200000, currentValue: 1000000, location: 'Dapur' },
      { name: 'iPad POS Terminal', code: 'EL-001', outletId: outlet1.id, category: 'Elektronik', condition: 'GOOD', purchasePrice: 7000000, currentValue: 5500000, location: 'Kasir' },
    ],
  });
  console.log('✅ Sample assets created');

  // ─── App Settings ────────────────────────────────
  await prisma.appSetting.createMany({
    data: [
      { key: 'default_tax_rate', value: '0.11', label: 'Default Tax Rate' },
      { key: 'store_name', value: 'Daroverse Coffee', label: 'Store Name' },
      { key: 'receipt_footer', value: 'Terima kasih! Follow @daroverse', label: 'Receipt Footer' },
    ],
  });
  console.log('✅ App settings created');

  console.log('\n🎉 Seeding complete!');
  console.log('\n📋 Login credentials:');
  console.log('   Admin:   admin@daroverse.com / admin123');
  console.log('   Cashier: cashier@daroverse.com / cashier123');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
