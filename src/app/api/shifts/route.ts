export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES, SENIOR_ROLES } from '@/lib/auth';

export const GET = withAuth(async (req: NextRequest, user) => {
  const { searchParams } = new URL(req.url);
  const active = searchParams.get('active');
  const limit  = parseInt(searchParams.get('limit') || '20');

  if (active === 'true') {
    const shift = await prisma.shift.findFirst({
      where: { userId: user.userId, status: 'OPEN' },
      include: { user: { select: { name: true } } },
    });
    return success({ shift });
  }

  const shifts = await prisma.shift.findMany({
    where: ADMIN_ROLES.includes(user.role as any) ? {} : { userId: user.userId },
    include: { user: { select: { name: true, role: true } } },
    orderBy: { openedAt: 'desc' },
    take: limit,
  });
  return success({ shifts });
});

export const POST = withAuth(async (req: NextRequest, user) => {
  const { openingCash, notes } = await req.json();

  const existing = await prisma.shift.findFirst({
    where: { userId: user.userId, status: 'OPEN' },
  });
  if (existing) return error('Kamu sudah punya shift yang sedang berjalan', 400);

  const shift = await prisma.shift.create({
    data: { userId: user.userId, openingCash: parseFloat(openingCash) || 0, status: 'OPEN', notes: notes || null },
    include: { user: { select: { name: true } } },
  });

  await prisma.auditLog.create({
    data: { userId: user.userId, userName: user.name || '', action: 'SHIFT_OPEN', entity: 'Shift', entityId: shift.id, newValue: { openingCash } },
  });

  return success(shift, 201);
});

export const PATCH = withAuth(async (req: NextRequest, user) => {
  const { id, action, closingCash, notes } = await req.json();
  if (!id) return error('ID wajib diisi');

  const shift = await prisma.shift.findUnique({
    where: { id },
    include: {
      orders: { where: { status: 'COMPLETED' }, select: { total: true, payment: { select: { method: true } } } },
    },
  });
  if (!shift) return error('Shift tidak ditemukan', 404);

  if (action === 'request_close') {
    if (shift.userId !== user.userId && !ADMIN_ROLES.includes(user.role as any)) return error('Bukan shift kamu', 403);
    if (shift.status !== 'OPEN') return error('Shift bukan OPEN');

    const cashSales  = shift.orders.filter(o => (o.payment as any)?.method === 'CASH').reduce((s, o) => s + o.total, 0);
    const qrisSales  = shift.orders.filter(o => (o.payment as any)?.method === 'QRIS').reduce((s, o) => s + o.total, 0);
    const cardSales  = shift.orders.filter(o => (o.payment as any)?.method === 'CARD').reduce((s, o) => s + o.total, 0);
    const totalSales = shift.orders.reduce((s, o) => s + o.total, 0);
    const expectedCash = shift.openingCash + cashSales;
    const closing = parseFloat(closingCash) || 0;

    const updated = await prisma.shift.update({
      where: { id },
      data: { status: 'PENDING_CLOSE', closingCash: closing, expectedCash, difference: closing - expectedCash, cashSales, qrisSales, cardSales, totalSales, notes: notes || shift.notes },
      include: { user: { select: { name: true } } },
    });
    return success(updated);
  }

  if (action === 'approve_close') {
    if (!SENIOR_ROLES.includes(user.role as any)) return error('Hanya manager/owner yang bisa approve', 403);
    if (shift.status !== 'PENDING_CLOSE') return error('Shift belum request close');

    const updated = await prisma.shift.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date(), approvedBy: user.userId, approvedAt: new Date() },
      include: { user: { select: { name: true } } },
    });

    await prisma.auditLog.create({
      data: { userId: user.userId, userName: user.name || '', action: 'SHIFT_CLOSE', entity: 'Shift', entityId: id, newValue: { approvedBy: user.userId } },
    });

    return success(updated);
  }

  return error('Action tidak valid');
});
