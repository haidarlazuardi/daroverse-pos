export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get('phone')?.trim();
  if (!phone || phone.length < 8) return error('Nomor HP tidak valid', 400);

  // Normalize: 08xx → 628xx
  const normalized = phone.startsWith('0') ? '62' + phone.slice(1)
    : phone.startsWith('+') ? phone.slice(1)
    : phone;

  const customer = await prisma.customer.findFirst({
    where: { OR: [{ phone }, { phone: normalized }] },
    select: {
      id: true, name: true, phone: true, points: true,
      totalSpent: true, visitCount: true, createdAt: true,
    },
  });

  if (!customer) return error('Pelanggan tidak ditemukan', 404);

  // Get available rewards
  const rewards = await (prisma as any).loyaltyReward.findMany({
    where: { active: true },
    orderBy: { pointsRequired: 'asc' },
  });

  const availableRewards = rewards.map((r: any) => ({
    ...r,
    canRedeem: customer.points >= r.pointsRequired,
    timesRedeemable: Math.floor(customer.points / r.pointsRequired),
  }));

  return success({ customer, rewards: availableRewards });
}
