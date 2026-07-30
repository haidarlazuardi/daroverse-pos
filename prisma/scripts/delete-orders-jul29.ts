import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Tanggal 29 Juli 2026 WIB (UTC+7)
  const from = new Date('2026-07-28T17:00:00.000Z'); // 29 Jul 00:00 WIB
  const to   = new Date('2026-07-29T16:59:59.999Z'); // 29 Jul 23:59 WIB

  // Preview dulu sebelum hapus
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { id: true, orderNumber: true, status: true, total: true, createdAt: true },
  });

  console.log(`\nDitemukan ${orders.length} order pada 29 Juli 2026:`);
  for (const o of orders) {
    const wib = new Date(o.createdAt.getTime() + 7*60*60*1000);
    console.log(`  ${o.orderNumber} | ${o.status} | Rp${o.total.toLocaleString('id-ID')} | ${wib.toLocaleTimeString('id-ID')}`);
  }

  if (orders.length === 0) {
    console.log('Tidak ada order ditemukan.');
    return;
  }

  const ids = orders.map(o => o.id);

  // Hapus semua related data dulu (cascade)
  const payments = await prisma.payment.deleteMany({ where: { orderId: { in: ids } } });
  console.log(`\n✓ Hapus ${payments.count} payment records`);

  const items = await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
  console.log(`✓ Hapus ${items.count} order items`);

  // Hapus stock movements yang terkait
  const movements = await prisma.stockMovement.deleteMany({
    where: { reference: { in: ids } },
  });
  console.log(`✓ Hapus ${movements.count} stock movements`);

  // Hapus orders
  const deleted = await prisma.order.deleteMany({ where: { id: { in: ids } } });
  console.log(`✓ Hapus ${deleted.count} orders`);

  // Hapus expense dari PO pembelian hari itu juga? (hanya expense tipe PURCHASE bukan)
  // Tidak dihapus — expense pembelian tetap valid

  console.log('\n✅ Selesai. Semua transaksi 29 Juli 2026 sudah dihapus.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
