export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES } from '@/lib/auth';

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const userId = searchParams.get('userId');

  const from = new Date(date + 'T00:00:00');
  const to   = new Date(date + 'T23:59:59');

  const where: any = { createdAt: { gte: from, lte: to } };
  if (userId) where.userId = userId;

  const records = await (prisma as any).attendance.findMany({
    where,
    include: { user: { select: { name: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return success(records);
}, ADMIN_ROLES);
