export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ALL_ROLES, ADMIN_ROLES } from '@/lib/auth';

export const GET = withAuth(async (req: NextRequest, user) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const leaves = await (prisma as any).leave.findMany({
    where: {
      ...(!ADMIN_ROLES.includes(user.role) ? { userId: user.userId } : {}),
      ...(status ? { status } : {}),
    },
    include: { user: { select: { name: true, employeeType: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return success(leaves);
}, ALL_ROLES);

export const POST = withAuth(async (req: NextRequest, user) => {
  const { type, startDate, endDate, reason } = await req.json();
  if (!type || !startDate || !endDate || !reason) return error('Semua field wajib');
  const leave = await (prisma as any).leave.create({
    data: { userId: user.userId, type, startDate: new Date(startDate), endDate: new Date(endDate), reason },
  });
  return success(leave, 201);
}, ALL_ROLES);

export const PATCH = withAuth(async (req: NextRequest, user) => {
  const { id, status, notes } = await req.json();
  if (!id || !status) return error('id dan status wajib');
  const leave = await (prisma as any).leave.update({
    where: { id },
    data: { status, approvedBy: user.userId, approvedAt: new Date(), notes: notes || null },
  });
  return success(leave);
}, ADMIN_ROLES);
