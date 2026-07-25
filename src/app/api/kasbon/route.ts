export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { SENIOR_ROLES } from '@/lib/auth';

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const where: any = { status: 'ACTIVE' };
  if (userId) where.userId = userId;
  const kasbons = await (prisma as any).kasbon.findMany({
    where,
    include: { user: { select: { name: true } }, payments: { orderBy: { createdAt: 'desc' }, take: 5 } },
    orderBy: { createdAt: 'desc' },
  });
  return success(kasbons);
}, SENIOR_ROLES);

export const POST = withAuth(async (req: NextRequest, user) => {
  const { userId, amount, reason } = await req.json();
  if (!userId || !amount) return error('userId dan amount wajib');
  const kasbon = await (prisma as any).kasbon.create({
    data: { userId, amount, remaining: amount, reason, createdBy: user.userId },
  });
  return success(kasbon, 201);
}, SENIOR_ROLES);

export const PATCH = withAuth(async (req: NextRequest) => {
  const { kasbonId, payAmount, periodId } = await req.json();
  if (!kasbonId || !payAmount) return error('kasbonId dan payAmount wajib');
  const kasbon = await (prisma as any).kasbon.findUnique({ where: { id: kasbonId } });
  if (!kasbon) return error('Kasbon tidak ditemukan');
  const newRemaining = Math.max(0, kasbon.remaining - payAmount);
  await (prisma as any).kasbon.update({
    where: { id: kasbonId },
    data: { remaining: newRemaining, status: newRemaining === 0 ? 'LUNAS' : 'ACTIVE' },
  });
  await (prisma as any).kasbonPayment.create({
    data: { kasbonId, amount: payAmount, periodId: periodId || null },
  });
  return success({ remaining: newRemaining });
}, SENIOR_ROLES);
