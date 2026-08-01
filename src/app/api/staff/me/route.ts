export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ALL_ROLES } from '@/lib/auth';

export const GET = withAuth(async (_req: NextRequest, user) => {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const monthStart = new Date(`${wib.getFullYear()}-${String(wib.getMonth()+1).padStart(2,'0')}-01T00:00:00+07:00`);
  const monthEnd   = new Date(new Date(monthStart).setMonth(monthStart.getMonth()+1)-1);
  const todayStr   = wib.toISOString().slice(0,10);

  const [me, attendances, payrollRecord, kasbons, schedules, revenueData, todayAttendances] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.userId },
      select: { id:true, name:true, role:true, employeeType:true, dailyRate:true,
                bankName:true, bankAccount:true, joinDate:true },
    }),
    (prisma as any).attendance.findMany({
      where: { userId: user.userId, type: 'CHECK_IN', createdAt: { gte: monthStart, lte: monthEnd } },
      select: { id:true, createdAt:true },
      orderBy: { createdAt: 'desc' },
    }),
    (prisma as any).payrollRecord.findFirst({
      where: { userId: user.userId, period: { year: wib.getFullYear(), month: wib.getMonth()+1 } },
      include: { period: { select: { status:true, year:true, month:true, totalPayout:true, paidAt:true } } },
    }),
    (prisma as any).kasbon.findMany({
      where: { userId: user.userId, status: 'ACTIVE' },
      select: { id:true, amount:true, remaining:true, reason:true, createdAt:true },
    }),
    (async () => {
      const s = new Date(wib); s.setDate(wib.getDate() - wib.getDay() + 1); s.setHours(0,0,0,0);
      const e = new Date(s); e.setDate(s.getDate() + 6); e.setHours(23,59,59,999);
      return (prisma as any).workSchedule.findMany({
        where: { userId: user.userId, date: { gte: s, lte: e } },
        include: { shift: true }, orderBy: { date: 'asc' },
      });
    })(),
    // SC Pool dari order yang benar-benar ada SC-nya
    (async () => {
      const orders = await prisma.order.findMany({
        where: { status: 'COMPLETED', createdAt: { gte: monthStart, lte: monthEnd } },
        select: { serviceCharge: true },
      });
      // SC pool = total service charge yang dikumpulkan dari customer
      const scPool = orders.reduce((s,o) => s + (o.serviceCharge || 0), 0);
      const allAtt = await (prisma as any).attendance.findMany({
        where: { type: 'CHECK_IN', createdAt: { gte: monthStart, lte: monthEnd } },
        select: { userId: true },
      });
      return { scPool, totalDays: allAtt.length };
    })(),
    (prisma as any).attendance.findMany({
      where: {
        userId: user.userId,
        createdAt: {
          gte: new Date(todayStr + 'T00:00:00+07:00'),
          lte: new Date(todayStr + 'T23:59:59+07:00'),
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  if (!me) return error('User tidak ditemukan', 404);

  const presentDays = attendances.length;
  const dailyRate   = (me as any).dailyRate || 0;
  const baseSalary  = presentDays * dailyRate;
  const scEstimate  = revenueData.totalDays > 0 ? (revenueData.scPool / revenueData.totalDays) * presentDays : 0;
  const kasbonTotal = kasbons.reduce((s: number, k: any) => s + k.remaining, 0);

  return success({
    user: me,
    attendance: {
      today: {
        checkedIn:  todayAttendances.some((a:any) => a.type === 'CHECK_IN'),
        checkedOut: todayAttendances.some((a:any) => a.type === 'CHECK_OUT'),
      },
      monthCount: presentDays,
    },
    payroll: {
      current: {
        presentDays, dailyRate, baseSalary,
        scPool: revenueData.scPool,
        totalDays: revenueData.totalDays,
        scEstimate: Math.round(scEstimate),
        kasbonDeduction: kasbonTotal,
        estimateTakeHome: Math.round(baseSalary + scEstimate - kasbonTotal),
      },
      record: payrollRecord || null,
    },
    kasbons,
    schedules,
  });
}, ALL_ROLES);
