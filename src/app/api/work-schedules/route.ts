export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES } from '@/lib/auth';

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to   = searchParams.get('to');
  if (!from || !to) return error('from dan to wajib');
  const schedules = await (prisma as any).workSchedule.findMany({
    where: { date: { gte: new Date(from), lte: new Date(to + 'T23:59:59') } },
    include: {
      user: { select: { name: true, employeeType: true } },
      shift: true,
    },
    orderBy: [{ date: 'asc' }, { user: { name: 'asc' } }],
  });
  return success(schedules);
}, ADMIN_ROLES);

export const POST = withAuth(async (req: NextRequest, user) => {
  const { schedules } = await req.json();
  if (!schedules?.length) return error('schedules wajib');
  const results: any[] = [];
  for (const s of schedules as any[]) {
    const r = await (prisma as any).workSchedule.upsert({
      where: { userId_date: { userId: s.userId, date: new Date(s.date) } },
      create: { userId: s.userId, shiftTemplateId: s.shiftTemplateId, date: new Date(s.date), isOffDay: s.isOffDay ?? false, createdBy: user.userId },
      update: { shiftTemplateId: s.shiftTemplateId, isOffDay: s.isOffDay ?? false },
    });
    results.push(r as any);
  }
  return success(results);
}, ADMIN_ROLES);
