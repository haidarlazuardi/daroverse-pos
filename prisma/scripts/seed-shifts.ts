import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const shifts = [
    { name: 'Shift Pagi', startTime: '09:00', endTime: '17:00' },
    { name: 'Shift Sore', startTime: '16:00', endTime: '00:00' },
  ];
  await (prisma as any).shiftTemplate.createMany({
    data: shifts,
    skipDuplicates: true,
  });
  console.log('✓ Shift templates seeded');
}
main().catch(console.error).finally(() => prisma.$disconnect());
