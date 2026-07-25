export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES } from '@/lib/auth';

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const active = searchParams.get('active');
  const where: any = { employeeType: { not: null } };
  if (active === '1') where.active = true;
  const employees = await prisma.user.findMany({
    where,
    select: {
      id: true, name: true, role: true, active: true,
      employeeType: true, dailyRate: true,
      bankName: true, bankAccount: true, bankAccountName: true,
      joinDate: true,
    },
    orderBy: { name: 'asc' },
  });
  return success(employees);
}, ADMIN_ROLES);
