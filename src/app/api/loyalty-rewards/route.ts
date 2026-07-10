export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES, SENIOR_ROLES } from '@/lib/auth';

export const GET = withAuth(async (req: NextRequest) => {
  const rewards = await prisma.loyaltyReward.findMany({
    where: { active: true },
    include: { product: { select: { id: true, name: true, price: true } } },
    orderBy: { pointsRequired: 'asc' },
  });
  return success(rewards);
});

export const POST = withAuth(async (req: NextRequest) => {
  const { name, description, pointsRequired, rewardType, productId, discountAmount } = await req.json();
  if (!name || !pointsRequired || !rewardType) return error('Field wajib tidak lengkap');
  const reward = await prisma.loyaltyReward.create({
    data: { name, description: description || null, pointsRequired: parseInt(pointsRequired), rewardType, productId: productId || null, discountAmount: discountAmount ? parseFloat(discountAmount) : null },
    include: { product: { select: { id: true, name: true, price: true } } },
  });
  return success(reward, 201);
}, SENIOR_ROLES);

export const PATCH = withAuth(async (req: NextRequest) => {
  const { id, ...data } = await req.json();
  if (!id) return error('ID wajib');
  const reward = await prisma.loyaltyReward.update({
    where: { id },
    data: { ...data, pointsRequired: data.pointsRequired ? parseInt(data.pointsRequired) : undefined, discountAmount: data.discountAmount ? parseFloat(data.discountAmount) : undefined },
    include: { product: { select: { id: true, name: true, price: true } } },
  });
  return success(reward);
}, SENIOR_ROLES);

export const DELETE = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return error('ID wajib');
  await prisma.loyaltyReward.update({ where: { id }, data: { active: false } });
  return success({ deleted: true });
}, SENIOR_ROLES);
