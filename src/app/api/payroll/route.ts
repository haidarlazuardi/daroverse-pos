export const dynamic = 'force-dynamic';
import { startOfMonthWIB, endOfMonthWIB } from '@/lib/wib';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { SENIOR_ROLES, ADMIN_ROLES } from '@/lib/auth';

// GET — list periods or get one
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const year  = searchParams.get('year');
  const month = searchParams.get('month');

  if (year && month) {
    const period = await (prisma as any).payrollPeriod.findUnique({
      where: { year_month: { year: parseInt(year), month: parseInt(month) } },
      include: {
        records: {
          include: { user: { select: { name: true, role: true, employeeType: true, bankName: true, bankAccount: true, bankAccountName: true } } },
          orderBy: { user: { name: 'asc' } },
        },
      },
    });
    return success(period);
  }

  const periods = await (prisma as any).payrollPeriod.findMany({
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    take: 12,
  });
  return success(periods);
}, ADMIN_ROLES);

// POST — generate payroll for a period
export const POST = withAuth(async (req: NextRequest) => {
  const { year, month } = await req.json();
  if (!year || !month) return error('year dan month wajib');

  const from = new Date(`${year}-${String(month).padStart(2,'0')}-01T00:00:00`);
  const to   = new Date(new Date(from).setMonth(from.getMonth()+1)-1);
  to.setHours(23,59,59);

  // Get total revenue and actual SC dari POS
  const orders = await prisma.order.findMany({
    where: { status: 'COMPLETED' as any, createdAt: { gte: from, lte: to } },
    select: { total: true, serviceCharge: true },
  });
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  // SC pool = total service charge yang benar-benar dikumpulkan dari customer
  const serviceChargePool = orders.reduce((s, o) => s + (o.serviceCharge || 0), 0);
  // Hitung totalPresentDays hanya dari staff yang SC eligible — diperbaiki di bawah setelah data staff ada

  // Get all active users — prefer Employee data if linked
  const users = await prisma.user.findMany({
    where: { active: true, role: 'STAFF' },
    select: { id: true, name: true, employeeType: true, dailyRate: true,
              bankName: true, bankAccount: true, bankAccountName: true,
              employee: { select: { dailyRate: true, bankName: true, bankAccount: true,
                bankAccountName: true, employeeType: true, position: true,
                serviceChargeEligible: true } } },
  });

  // Count attendance per user
  const attendances = await (prisma as any).attendance.findMany({
    where: { type: 'CHECK_IN', createdAt: { gte: from, lte: to } },
    select: { userId: true },
  });
  const presentMap: Record<string, number> = {};
  for (const a of attendances) {
    presentMap[a.userId] = (presentMap[a.userId] || 0) + 1;
  }
  const totalPresentDays = Object.values(presentMap).reduce((s, v) => s + v, 0);

  // Get scheduled days per user
  const schedules = await (prisma as any).workSchedule.findMany({
    where: { date: { gte: from, lte: to }, isOffDay: false },
    select: { userId: true },
  });
  const scheduledMap: Record<string, number> = {};
  for (const s of schedules) {
    scheduledMap[s.userId] = (scheduledMap[s.userId] || 0) + 1;
  }

  // Get active kasbons
  const kasbons = await (prisma as any).kasbon.findMany({
    where: { userId: { in: users.map((u: any) => u.id) }, status: 'ACTIVE' },
    select: { id: true, userId: true, remaining: true },
  });

  // Upsert period
  const period = await (prisma as any).payrollPeriod.upsert({
    where: { year_month: { year, month } },
    create: { year, month, totalRevenue, serviceChargePool, status: 'DRAFT' },
    update: { totalRevenue, serviceChargePool, status: 'DRAFT' },
  });

  // Pre-calculate: total eligible present days untuk pembagi SC yang benar
  const eligiblePresentDays = users.reduce((s, u) => {
    const emp = (u as any).employee;
    const scEligible = emp?.serviceChargeEligible !== false;
    return s + (scEligible ? (presentMap[u.id] || 0) : 0);
  }, 0);

  // Generate records
  let totalPayout = 0;
  for (const user of users) {
    const presentDays   = presentMap[user.id] || 0;
    const scheduledDays = scheduledMap[user.id] || 0;
    const emp           = (user as any).employee;
    const dailyRate     = emp?.dailyRate || (user.dailyRate as number) || 0;
    const scEligible    = emp?.serviceChargeEligible !== false;
    const baseSalary    = dailyRate * presentDays;

    // Fix SC: pembagi hanya eligible staff, non-eligible dapat 0
    const scShare = scEligible && eligiblePresentDays > 0
      ? (serviceChargePool / eligiblePresentDays) * presentDays
      : 0;

    // Fix kasbon: pakai monthlyInstallment dari kasbon aktif
    const userKasbon = kasbons.find((k: any) => k.userId === user.id);
    const kasbonDeduction = userKasbon?.monthlyInstallment || 0;

    const totalAmount = baseSalary + scShare - kasbonDeduction;
    totalPayout += totalAmount;

    await (prisma as any).payrollRecord.upsert({
      where: { periodId_userId: { periodId: period.id, userId: user.id } },
      create: {
        periodId: period.id, userId: user.id,
        employeeType: emp?.employeeType || user.employeeType, dailyRate,
        scheduledDays, presentDays,
        baseSalary, serviceCharge: Math.round(scShare),
        kasbonDeduction, totalAmount: Math.round(totalAmount),
        bankName: emp?.bankName || user.bankName,
        bankAccount: emp?.bankAccount || user.bankAccount,
        bankAccountName: emp?.bankAccountName || user.bankAccountName,
        scEligible,
      },
      update: {
        scheduledDays, presentDays, baseSalary: Math.round(baseSalary),
        serviceCharge: Math.round(scShare),
        kasbonDeduction, totalAmount: Math.round(totalAmount),
      },
    });
  }

  await (prisma as any).payrollPeriod.update({
    where: { id: period.id },
    data: { totalPayout },
  });

  return success({ periodId: period.id, totalRevenue, serviceChargePool, totalPayout }, 201);
}, SENIOR_ROLES);

// PATCH — update status or record
export const PATCH = withAuth(async (req: NextRequest, user) => {
  const { periodId, action, recordId, kasbonDeduction, notes } = await req.json();
  if (!periodId || !action) return error('periodId dan action wajib');

  if (action === 'approve') {
    await (prisma as any).payrollPeriod.update({
      where: { id: periodId },
      data: { status: 'APPROVED', approvedBy: user.userId, approvedAt: new Date() },
    });
  } else if (action === 'paid') {
    await (prisma as any).payrollPeriod.update({
      where: { id: periodId },
      data: { status: 'PAID', paidAt: new Date() },
    });
  } else if (action === 'update_record' && recordId) {
    const rec = await (prisma as any).payrollRecord.findUnique({ where: { id: recordId } });
    if (!rec) return error('Record tidak ditemukan');
    const newKasbon = kasbonDeduction ?? rec.kasbonDeduction;
    const totalAmount = rec.baseSalary + rec.serviceCharge - newKasbon;
    await (prisma as any).payrollRecord.update({
      where: { id: recordId },
      data: { kasbonDeduction: newKasbon, totalAmount, notes },
    });
  }
  return success({ ok: true });
}, SENIOR_ROLES);
