import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Reset stock levels to 0
  const levels = await prisma.stockLevel.updateMany({
    data: { quantity: 0 },
  });
  console.log(`✓ Reset ${levels.count} stock levels ke 0`);

  // Clear movement log
  const movements = await prisma.stockMovement.deleteMany({});
  console.log(`✓ Hapus ${movements.count} stock movement records`);

  console.log('\n✅ Stock berhasil direset. Siap input data real.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
