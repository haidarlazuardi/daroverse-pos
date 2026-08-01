import prisma from '../../src/lib/prisma';

async function main() {
  const stale = await prisma.shift.findMany({
    where: { status: 'OPEN' },
    include: { user: { select: { name: true } } },
  });

  console.log(`Found ${stale.length} open shift(s):`);
  for (const s of stale) {
    const ageHours = (Date.now() - new Date(s.openedAt).getTime()) / (1000 * 60 * 60);
    console.log(`  - ${s.id} | ${s.user.name} | opened: ${s.openedAt} | age: ${ageHours.toFixed(1)}h`);
  }

  if (stale.length === 0) { console.log('No stale shifts.'); return; }

  const closed = await prisma.shift.updateMany({
    where: { status: 'OPEN' },
    data: { status: 'CLOSED', closedAt: new Date(), notes: 'Manually closed: stale shift cleanup' },
  });
  console.log(`Closed ${closed.count} shift(s).`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
