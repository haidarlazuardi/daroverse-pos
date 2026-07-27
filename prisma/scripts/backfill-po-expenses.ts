import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Get all completed POs
  const completedPOs = await prisma.purchaseOrder.findMany({
    where: { status: 'COMPLETED' },
    include: { supplier: true, items: true },
  });

  let created = 0;
  for (const po of completedPOs) {
    // Check if expense already exists for this PO
    const existing = await prisma.expense.findFirst({
      where: { description: { contains: po.poNumber } },
    });
    if (existing) { console.log(`  Skip ${po.poNumber} — expense sudah ada`); continue; }

    const totalAmount = po.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    if (totalAmount <= 0) continue;

    await prisma.expense.create({
      data: {
        category: 'PURCHASE' as any,
        description: `Pembelian PO #${po.poNumber} — ${po.supplier?.name || 'Supplier'}`,
        amount: totalAmount,
        paidBy: 'System (backfill)',
        createdAt: po.completedAt || po.createdAt,
      },
    });
    console.log(`✓ Created expense for ${po.poNumber}: Rp${totalAmount.toLocaleString('id-ID')}`);
    created++;
  }

  console.log(`\n✅ Backfill selesai — ${created} expense baru dibuat dari ${completedPOs.length} PO completed`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
