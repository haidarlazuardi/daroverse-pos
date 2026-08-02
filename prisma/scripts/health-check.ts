import prisma from '../../src/lib/prisma';

type Check = { name: string; status: 'ok'|'warn'|'error'; message: string; count?: number; items?: any[] };
const checks: Check[] = [];

function ok(name: string, message: string)                          { checks.push({ name, status:'ok',    message }); }
function warn(name: string, message: string, count=0, items?: any[]){ checks.push({ name, status:'warn',  message, count, items }); }
function fail(name: string, message: string, count=0, items?: any[]){ checks.push({ name, status:'error', message, count, items }); }

async function run() {
  const now = new Date();
  const wib = new Date(now.getTime() + 7*60*60*1000);
  const monthStart = new Date(`${wib.getUTCFullYear()}-${String(wib.getUTCMonth()+1).padStart(2,'0')}-01T00:00:00+07:00`);

  console.log('🔍 Daroverse POS Health Check');
  console.log(`📅 ${wib.toLocaleString('id-ID', { timeZone:'Asia/Jakarta' })}\n`);

  // ── 1. DB Connection ──────────────────────────────────────────────────────
  try { await prisma.$queryRaw`SELECT 1`; ok('DB Connection', 'Database terhubung'); }
  catch { fail('DB Connection', 'Tidak bisa konek ke database'); }

  // ── 2. Order tanpa payment ────────────────────────────────────────────────
  const ordersNoPayment = await prisma.order.findMany({
    where: { status: 'COMPLETED', payment: null },
    select: { orderNumber: true, total: true, createdAt: true },
    take: 10,
  });
  if (ordersNoPayment.length === 0) ok('Order Payment', 'Semua completed order punya payment');
  else warn('Order Payment', `${ordersNoPayment.length} completed order tanpa payment record`, ordersNoPayment.length, ordersNoPayment);

  // ── 3. Order tanpa nama customer ──────────────────────────────────────────
  const ordersNoName = await prisma.order.count({ where: { status:'COMPLETED', billName: null, customerId: null } });
  if (ordersNoName === 0) ok('Customer Name', 'Semua order punya nama customer');
  else warn('Customer Name', `${ordersNoName} order tanpa nama customer`, ordersNoName);

  // ── 4. Stok negatif ───────────────────────────────────────────────────────
  const negStocks = await (prisma as any).stockLevel.findMany({
    where: { quantity: { lt: 0 } },
    include: { ingredient: { select: { name: true } } },
    take: 20,
  });
  if (negStocks.length === 0) ok('Stok Negatif', 'Tidak ada stok negatif');
  else warn('Stok Negatif', `${negStocks.length} bahan punya stok negatif`, negStocks.length,
    negStocks.map((s: any) => `${s.ingredient.name} @ ${s.location}: ${s.quantity}`));

  // ── 5. HPP 0 di completed orders ─────────────────────────────────────────
  const zeroHPP = await prisma.order.count({ where: { status:'COMPLETED', costTotal: 0, total: { gt: 0 } } });
  if (zeroHPP === 0) ok('HPP (costTotal)', 'Semua order punya costTotal > 0');
  else warn('HPP (costTotal)', `${zeroHPP} completed order dengan HPP = 0`, zeroHPP);

  // ── 6. Produk tanpa resep ─────────────────────────────────────────────────
  const noRecipe = await prisma.product.count({ where: { active: true, recipe: null } });
  if (noRecipe === 0) ok('Resep Produk', 'Semua produk aktif punya resep');
  else warn('Resep Produk', `${noRecipe} produk aktif tanpa resep`, noRecipe);

  // ── 7. Bahan tanpa harga ──────────────────────────────────────────────────
  const noPrice = await prisma.ingredient.count({ where: { active: true, latestPrice: 0, type: 'RAW' } });
  if (noPrice === 0) ok('Harga Bahan', 'Semua bahan RAW punya harga');
  else warn('Harga Bahan', `${noPrice} bahan RAW tanpa harga`, noPrice);

  // ── 8. Karyawan tanpa dailyRate ───────────────────────────────────────────
  const noRate = await prisma.user.findMany({
    where: { active: true, role: 'STAFF', OR: [{ dailyRate: null }, { dailyRate: 0 }] },
    select: { name: true },
  });
  if (noRate.length === 0) ok('Daily Rate', 'Semua staff punya daily rate');
  else warn('Daily Rate', `${noRate.length} staff tanpa daily rate`, noRate.length, noRate.map((u: any) => u.name));

  // ── 9. Shift terbuka lama ─────────────────────────────────────────────────
  const staleShift = await prisma.shift.findFirst({ where: { status: 'OPEN' } });
  if (!staleShift) ok('Shift', 'Tidak ada shift yang sedang buka (di luar jam operasional)');
  else {
    const ageH = (Date.now() - new Date(staleShift.openedAt).getTime()) / 3600000;
    if (ageH > 16) fail('Shift', `Shift sudah terbuka ${Math.round(ageH)} jam — kemungkinan lupa ditutup`);
    else ok('Shift', `Ada shift aktif, sudah ${Math.round(ageH)} jam`);
  }

  // ── 10. SC Pool consistency ───────────────────────────────────────────────
  const completedOrders = await prisma.order.findMany({
    where: { status: 'COMPLETED', createdAt: { gte: monthStart } },
    select: { serviceCharge: true, serviceEnabled: true, subtotal: true },
  });
  const expectedSC = completedOrders.filter(o => o.serviceEnabled).reduce((s, o) => s + o.subtotal * 0.05, 0);
  const actualSC   = completedOrders.reduce((s, o) => s + (o.serviceCharge || 0), 0);
  const scDiff = Math.abs(expectedSC - actualSC);
  if (scDiff < 100) ok('SC Pool', `SC pool konsisten (selisih Rp${Math.round(scDiff)})`);
  else warn('SC Pool', `SC pool selisih Rp${Math.round(scDiff)} dari expected`, scDiff);

  // ── 11. PayrollRecord bulan ini ───────────────────────────────────────────
  const y = wib.getUTCFullYear(), m = wib.getUTCMonth() + 1;
  const payrollPeriod = await (prisma as any).payrollPeriod.findFirst({ where: { year: y, month: m } });
  if (!payrollPeriod) warn('Payroll', `Payroll period ${m}/${y} belum digenerate`);
  else if (payrollPeriod.status === 'DRAFT') warn('Payroll', `Payroll ${m}/${y} masih DRAFT`);
  else ok('Payroll', `Payroll ${m}/${y} status: ${payrollPeriod.status}`);

  // ── 12. Open bill lama ────────────────────────────────────────────────────
  const yesterday = new Date(now.getTime() - 24*3600*1000);
  const oldBills = await prisma.order.findMany({
    where: { status: 'OPEN', createdAt: { lt: yesterday } },
    select: { orderNumber: true, billName: true, createdAt: true, total: true },
  });
  if (oldBills.length === 0) ok('Open Bill', 'Tidak ada open bill lebih dari 24 jam');
  else warn('Open Bill', `${oldBills.length} open bill lebih dari 24 jam`, oldBills.length,
    oldBills.map(b => `#${b.orderNumber} ${b.billName||''} - ${b.total.toLocaleString('id-ID')}`));

  // ── 13. Expense tanpa kategori valid ─────────────────────────────────────
  const validCats = ['PURCHASE','OPERATIONAL','UTILITIES','SALARY','OTHER'];
  const expenses = await prisma.expense.findMany({ select: { category: true }, take: 500 });
  const invalidExp = expenses.filter(e => !validCats.includes(e.category));
  if (invalidExp.length === 0) ok('Expense Kategori', 'Semua expense punya kategori valid');
  else warn('Expense Kategori', `${invalidExp.length} expense dengan kategori tidak valid`, invalidExp.length);

  // ── 14. Duplicate order number ────────────────────────────────────────────
  const orderNums = await prisma.order.groupBy({ by: ['orderNumber'], having: { orderNumber: { _count: { gt: 1 } } } });
  if (orderNums.length === 0) ok('Order Number', 'Tidak ada duplicate order number');
  else fail('Order Number', `${orderNums.length} duplicate order number ditemukan`, orderNums.length);

  // ── 15. StockMovement orphan ─────────────────────────────────────────────
  const movements = await (prisma as any).stockMovement.count();
  ok('Stock Movement', `${movements.toLocaleString('id-ID')} stock movement records`);

  // ── Print Results ─────────────────────────────────────────────────────────
  const okCount   = checks.filter(c => c.status === 'ok').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;
  const errCount  = checks.filter(c => c.status === 'error').length;

  console.log('─'.repeat(60));
  for (const c of checks) {
    const icon = c.status === 'ok' ? '✅' : c.status === 'warn' ? '⚠️ ' : '❌';
    console.log(`${icon} ${c.name.padEnd(20)} ${c.message}`);
    if (c.items?.length && c.status !== 'ok') {
      c.items.slice(0, 5).forEach(i => console.log(`   → ${JSON.stringify(i)}`));
      if ((c.items.length) > 5) console.log(`   → ... dan ${c.items.length - 5} lagi`);
    }
  }
  console.log('─'.repeat(60));
  console.log(`\n📊 ${okCount} OK  |  ${warnCount} Warning  |  ${errCount} Error`);

  if (errCount > 0) process.exit(1);
}

run().catch(e => { console.error('Health check failed:', e); process.exit(1); })
     .finally(() => prisma.$disconnect());
