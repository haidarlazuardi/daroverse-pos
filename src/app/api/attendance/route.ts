export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES } from '@/lib/auth';

const TZ_OFFSET = 7 * 60 * 60 * 1000; // WIB UTC+7

function dayRange(dateStr: string) {
  // dateStr = 'YYYY-MM-DD' in WIB
  const from = new Date(new Date(dateStr + 'T00:00:00').getTime() - TZ_OFFSET);
  const to   = new Date(new Date(dateStr + 'T23:59:59').getTime() - TZ_OFFSET);
  return { from, to };
}

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const mode   = searchParams.get('mode') || 'daily'; // daily | monthly | summary
  const date   = searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const year   = parseInt(searchParams.get('year')  || String(new Date().getFullYear()));
  const month  = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
  const userId = searchParams.get('userId');

  // Auto-cleanup expired photos (best effort)
  try {
    await (prisma as any).attendance.updateMany({
      where: { photoExpiresAt: { lt: new Date() }, photo: { not: null } },
      data: { photo: null },
    });
  } catch {}

  if (mode === 'daily') {
    const { from, to } = dayRange(date);
    const where: any = { createdAt: { gte: from, lte: to } };
    if (userId) where.userId = userId;
    const records = await (prisma as any).attendance.findMany({
      where,
      include: { user: { select: { name: true, employeeType: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return success(records);
  }

  if (mode === 'monthly') {
    // Summary per karyawan per bulan — untuk payroll
    const from = new Date(`${year}-${String(month).padStart(2,'0')}-01T00:00:00`);
    from.setTime(from.getTime() - TZ_OFFSET);
    const to = new Date(new Date(from).setMonth(from.getMonth()+1)-1);
    to.setHours(23,59,59);

    const where: any = { type: 'CHECK_IN', createdAt: { gte: from, lte: to } };
    if (userId) where.userId = userId;

    const records = await (prisma as any).attendance.findMany({
      where,
      include: { user: { select: { name: true, employeeType: true, dailyRate: true } } },
      orderBy: { createdAt: 'asc' },
    });

    // Group by user
    const grouped: Record<string, any> = {};
    for (const r of records) {
      if (!grouped[r.userId]) {
        grouped[r.userId] = { userId: r.userId, user: r.user, days: [], presentCount: 0 };
      }
      const dayStr = new Date(new Date(r.createdAt).getTime() + TZ_OFFSET).toISOString().slice(0,10);
      if (!grouped[r.userId].days.includes(dayStr)) {
        grouped[r.userId].days.push(dayStr);
        grouped[r.userId].presentCount++;
      }
    }
    return success(Object.values(grouped));
  }

  return success([]);
}, ADMIN_ROLES);
