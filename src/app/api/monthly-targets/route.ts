export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { SENIOR_ROLES } from '@/lib/auth';

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const year  = searchParams.get('year')  ? parseInt(searchParams.get('year')!)  : new Date().getFullYear();
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null;

  if (month) {
    const target = await (prisma as any).monthlyTarget.findUnique({
      where: { year_month: { year, month } },
    });
    return success(target);
  }

  const targets = await (prisma as any).monthlyTarget.findMany({
    where: { year },
    orderBy: { month: 'asc' },
  });
  return success(targets);
});

export const POST = withAuth(async (req: NextRequest, user) => {
  const body = await req.json();
  const { year, month, revenueTarget, ordersPerDay, grossMarginPct, maxExpense, maxInventoryValue, notes } = body;

  if (!year || !month) return error('year dan month wajib');

  const target = await (prisma as any).monthlyTarget.upsert({
    where: { year_month: { year, month } },
    create: { year, month, revenueTarget, ordersPerDay, grossMarginPct, maxExpense, maxInventoryValue, notes, createdBy: user.userId },
    update: { revenueTarget, ordersPerDay, grossMarginPct, maxExpense, maxInventoryValue, notes },
  });
  return success(target);
}, SENIOR_ROLES);
