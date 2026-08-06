export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES, ALL_ROLES } from '@/lib/auth';
import { calcMinutesLate, getLateStatus } from '@/lib/late-engine';

// GET — list late records (filter by month/user)
export const GET = withAuth(async (req: NextRequest, user) => {
  const { searchParams } = new URL(req.url);
  const year   = parseInt(searchParams.get('year')  || String(new Date().getFullYear()));
  const month  = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
  const userId = searchParams.get('userId') || (ADMIN_ROLES.includes(user.role as any) ? undefined : user.userId);

  const from = new Date(`${year}-${String(month).padStart(2,'0')}-01T00:00:00+07:00`);
  const to   = new Date(new Date(from).setMonth(from.getMonth() + 1));

  const records = await (prisma as any).lateRecord.findMany({
    where: {
      date: { gte: from, lt: to },
      ...(userId ? { userId } : {}),
    },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { date: 'desc' },
  });

  return success(records);
}, ALL_ROLES);

// POST — catat keterlambatan (manager input manual)
export const POST = withAuth(async (req: NextRequest, user) => {
  const { userId: targetUserId, date, shift, checkInTime, confirmed, note, status: manualStatus } = await req.json();
  if (!targetUserId || !date || !shift) return error('userId, date, shift wajib');

  let minutesLate = 0;
  let status: string = manualStatus || 'LATE';

  if (checkInTime) {
    minutesLate = calcMinutesLate(new Date(checkInTime), shift as '1'|'2');
    const computed = getLateStatus(minutesLate);
    status = manualStatus || (computed === 'ON_TIME' ? 'LATE' : computed);
  }

  const record = await (prisma as any).lateRecord.create({
    data: {
      userId: targetUserId,
      date: new Date(date),
      shift: String(shift),
      minutesLate,
      status,
      confirmed: confirmed || false,
      note: note || null,
      createdBy: user.userId,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  return success(record, 201);
}, ADMIN_ROLES);

// PATCH — update (confirm, add note, change status)
export const PATCH = withAuth(async (req: NextRequest) => {
  const { id, confirmed, note, status } = await req.json();
  if (!id) return error('id wajib');

  const record = await (prisma as any).lateRecord.update({
    where: { id },
    data: {
      ...(confirmed !== undefined && { confirmed }),
      ...(note !== undefined && { note }),
      ...(status !== undefined && { status }),
    },
    include: { user: { select: { id: true, name: true } } },
  });
  return success(record);
}, ADMIN_ROLES);

// DELETE — hapus record
export const DELETE = withAuth(async (req: NextRequest) => {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return error('id wajib');
  await (prisma as any).lateRecord.delete({ where: { id } });
  return success({ deleted: true });
}, ADMIN_ROLES);
