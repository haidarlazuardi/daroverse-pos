export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ALL_ROLES } from '@/lib/auth';

export const POST = withAuth(async (req: NextRequest, user) => {
  const { photo, location } = await req.json();
  if (!photo) return error('Photo wajib');

  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const todayStr = wib.toISOString().slice(0,10);

  // Cek sudah check-in hari ini belum
  const existing = await (prisma as any).attendance.findFirst({
    where: {
      userId: user.userId,
      type: 'CHECK_IN',
      createdAt: {
        gte: new Date(todayStr + 'T00:00:00+07:00'),
        lte: new Date(todayStr + 'T23:59:59+07:00'),
      },
    },
  });

  const type = existing ? 'CHECK_OUT' : 'CHECK_IN';
  const photoExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const attendance = await (prisma as any).attendance.create({
    data: {
      userId: user.userId, type, photo, photoExpiresAt,
      latitude:  location?.lat  ?? null,
      longitude: location?.lng  ?? null,
      accuracy:  location?.accuracy ?? null,
    },
  });

  return success({ type, attendance });
}, ALL_ROLES);
