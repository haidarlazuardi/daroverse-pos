export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { SENIOR_ROLES } from '@/lib/auth';

export const GET = withAuth(async () => {
  const rewards = await prisma.loyaltyReward.findMany({
    where: { active: true },
    orderBy: { pointsRequired: 'asc' },
  });
  return success(rewards);
});

export const POST = withAuth(async (req: NextRequest) => {
  const { name, description, pointsRequired, rewardType, station, maxPrice, discountAmount } = await req.json();
  if (!name || !pointsRequired || !rewardType) return error('Field wajib tidak lengkap');
  const reward = await prisma.loyaltyReward.create({
    data: {
      name,
      description: description || null,
      pointsRequired: parseInt(pointsRequired),
      rewardType,
      station: station || null,
      maxPrice: maxPrice ? parseFloat(maxPrice) : null,
      discountAmount: discountAmount ? parseFloat(discountAmount) : null,
    },
  });
  return success(reward, 201);
}, SENIOR_ROLES);

export const PATCH = withAuth(async (req: NextRequest) => {
  const { id, name, description, pointsRequired, rewardType, station, maxPrice, discountAmount, active } = await req.json();
  if (!id) return error('ID wajib');
  const reward = await prisma.loyaltyReward.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(pointsRequired !== undefined && { pointsRequired: parseInt(pointsRequired) }),
      ...(rewardType !== undefined && { rewardType }),
      ...(station !== undefined && { station }),
      ...(maxPrice !== undefined && { maxPrice: maxPrice ? parseFloat(maxPrice) : null }),
      ...(discountAmount !== undefined && { discountAmount: discountAmount ? parseFloat(discountAmount) : null }),
      ...(active !== undefined && { active }),
    },
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
