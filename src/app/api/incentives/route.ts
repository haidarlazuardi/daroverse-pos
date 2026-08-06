export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES, SENIOR_ROLES, ALL_ROLES } from '@/lib/auth';
import { getIncentiveLevel } from '@/lib/late-engine';

// GET — list incentives (per minggu/bulan)
export const GET = withAuth(async (req: NextRequest, user) => {
  const { searchParams } = new URL(req.url);
  const year  = parseInt(searchParams.get('year')  || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
  const from  = new Date(`${year}-${String(month).padStart(2,'0')}-01T00:00:00+07:00`);
  const to    = new Date(new Date(from).setMonth(from.getMonth() + 1));

  const incentives = await (prisma as any).dailyIncentive.findMany({
    where: { date: { gte: from, lt: to } },
    include: {
      entries: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
    orderBy: { date: 'desc' },
  });

  // Kalau staff, filter hanya entries milik mereka
  const filtered = ADMIN_ROLES.includes(user.role as any) ? incentives : incentives.filter(
    (i: any) => i.entries.some((e: any) => e.userId === user.userId)
  );

  return success(filtered);
}, ALL_ROLES);

// POST — generate insentif harian (manager input manual atau auto dari revenue)
export const POST = withAuth(async (req: NextRequest, user) => {
  const { date, crewUserIds, revenue, manualLevel } = await req.json();
  if (!date || !crewUserIds?.length) return error('date dan crewUserIds wajib');

  // Cek revenue hari itu kalau tidak manual
  let actualRevenue = revenue;
  if (!actualRevenue) {
    const wibDate = new Date(date + 'T00:00:00+07:00');
    const nextDay = new Date(wibDate.getTime() + 24 * 60 * 60 * 1000);
    const orders  = await prisma.order.findMany({
      where: { status: 'COMPLETED', createdAt: { gte: wibDate, lt: nextDay } },
      select: { total: true },
    });
    actualRevenue = orders.reduce((s, o) => s + o.total, 0);
  }

  const lvl = manualLevel
    ? [{ level: 1, target: 1_500_000, pool: 120_000 }, { level: 2, target: 3_000_000, pool: 240_000 }, { level: 3, target: 4_500_000, pool: 360_000 }].find(l => l.level === manualLevel)
    : getIncentiveLevel(actualRevenue);

  if (!lvl) return error(`Revenue ${actualRevenue.toLocaleString('id-ID')} belum mencapai target minimum Rp 1.500.000`);

  const perPerson = Math.floor(lvl.pool / crewUserIds.length);

  // Upsert — kalau sudah ada hari itu, update
  const existing = await (prisma as any).dailyIncentive.findUnique({ where: { date: new Date(date + 'T00:00:00+07:00') } });
  if (existing) {
    await (prisma as any).incentiveEntry.deleteMany({ where: { incentiveId: existing.id } });
    await (prisma as any).dailyIncentive.delete({ where: { id: existing.id } });
  }

  const incentive = await (prisma as any).dailyIncentive.create({
    data: {
      date:      new Date(date + 'T00:00:00+07:00'),
      revenue:   actualRevenue,
      level:     lvl.level,
      totalPool: lvl.pool,
      perPerson,
      crewCount: crewUserIds.length,
      entries: {
        create: crewUserIds.map((uid: string) => ({ userId: uid, amount: perPerson })),
      },
    },
    include: {
      entries: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  return success(incentive, 201);
}, ADMIN_ROLES);

// PATCH — cairkan insentif (mark as PAID)
export const PATCH = withAuth(async (req: NextRequest, user) => {
  const { action, ids, incentiveId } = await req.json();

  if (action === 'pay_week') {
    // Cairkan semua PENDING minggu ini
    if (!ids?.length) return error('ids wajib');
    await (prisma as any).dailyIncentive.updateMany({
      where: { id: { in: ids }, status: 'PENDING' },
      data: { status: 'PAID', paidAt: new Date(), paidBy: user.userId },
    });
    await (prisma as any).incentiveEntry.updateMany({
      where: { incentiveId: { in: ids }, status: 'PENDING' },
      data: { status: 'PAID' },
    });
    return success({ paid: ids.length });
  }

  if (action === 'pay_one' && incentiveId) {
    await (prisma as any).dailyIncentive.update({
      where: { id: incentiveId },
      data: { status: 'PAID', paidAt: new Date(), paidBy: user.userId },
    });
    await (prisma as any).incentiveEntry.updateMany({
      where: { incentiveId },
      data: { status: 'PAID' },
    });
    return success({ paid: true });
  }

  return error('Action tidak valid');
}, SENIOR_ROLES);
