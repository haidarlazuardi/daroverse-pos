export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES, SENIOR_ROLES, ALL_ROLES } from '@/lib/auth';

export const GET = withAuth(async (req: NextRequest, user) => {
  const { searchParams } = new URL(req.url);
  const active = searchParams.get('active');
  const limit  = parseInt(searchParams.get('limit') || '20');

  if (active === 'true') {
    // Shift adalah global per café — ambil shift OPEN terakhir
    const shift = await prisma.shift.findFirst({
      where: { status: 'OPEN' },
      include: { user: { select: { name: true } } },
      orderBy: { openedAt: 'desc' },
    });

    // Auto-close shift yang sudah lebih dari 24 jam (stale shift)
    if (shift) {
      const ageHours = (Date.now() - new Date(shift.openedAt).getTime()) / (1000 * 60 * 60);
      if (ageHours > 24) {
        await prisma.shift.update({
          where: { id: shift.id },
          data: { status: 'CLOSED', closedAt: new Date(), notes: 'Auto-closed: shift melebihi 24 jam' },
        });
        return success([]);
      }
    }

    return success(shift ? [shift] : []);
  }

  const shifts = await prisma.shift.findMany({
    where: ADMIN_ROLES.includes(user.role as any) ? {} : { userId: user.userId },
    include: { user: { select: { name: true, role: true } } },
    orderBy: { openedAt: 'desc' },
    take: limit,
  });
  return success({ shifts });
}, ALL_ROLES);

export const POST = withAuth(async (req: NextRequest, user) => {
  const body = await req.json();

  // Support both POS format { action:'open', openingCash } and new format { openingCash }
  const action = body.action;
  const openingCash = parseFloat(body.openingCash) || 0;

  if (action === 'close') {
    // POS close — treated as request_close (needs manager approval)
    const shift = await prisma.shift.findUnique({ where: { id: body.shiftId } });
    if (!shift) return error('Shift tidak ditemukan', 404);

    const orders = await prisma.order.findMany({
      where: { shiftId: body.shiftId, status: 'COMPLETED' },
      include: { payment: { select: { method: true } } },
    });
    const cashSales  = orders.filter(o => (o.payment as any)?.method === 'CASH').reduce((s, o) => s + o.total, 0);
    const qrisSales  = orders.filter(o => (o.payment as any)?.method === 'QRIS').reduce((s, o) => s + o.total, 0);
    const cardSales  = orders.filter(o => (o.payment as any)?.method === 'CARD').reduce((s, o) => s + o.total, 0);
    const totalSales = orders.reduce((s, o) => s + o.total, 0);
    const closingCash = parseFloat(body.closingCash) || 0;
    const expectedCash = shift.openingCash + cashSales;

    const updated = await prisma.shift.update({
      where: { id: body.shiftId },
      data: { status: 'PENDING_CLOSE', closingCash, expectedCash, difference: closingCash - expectedCash, cashSales, qrisSales, cardSales, totalSales },
    });
    return success({ ...updated, difference: updated.difference });
  }

  // Open shift — cek global, tidak boleh ada shift OPEN dari siapapun
  const existing = await prisma.shift.findFirst({
    where: { status: 'OPEN' },
    include: { user: { select: { name: true } } },
  });
  if (existing) return error(`Sudah ada shift aktif yang dibuka oleh ${existing.user?.name || 'staff lain'}`, 400);

  const shift = await prisma.shift.create({
    data: { userId: user.userId, openingCash, status: 'OPEN' },
    include: { user: { select: { name: true } } },
  });

  // Audit log — try but don't fail if AuditLog model doesn't exist yet
  try {
    await (prisma as any).auditLog?.create({
      data: { userId: user.userId, userName: user.name || '', action: 'SHIFT_OPEN', entity: 'Shift', entityId: shift.id, newValue: { openingCash } },
    });
  } catch {}

  return success(shift, 201);
}, ADMIN_ROLES);

export const PATCH = withAuth(async (req: NextRequest, user) => {
  const { id, action, closingCash, notes } = await req.json();
  if (!id) return error('ID wajib diisi');

  const shift = await prisma.shift.findUnique({
    where: { id },
    include: {
      orders: { where: { status: 'COMPLETED' }, include: { payment: { select: { method: true } } } },
    },
  });
  if (!shift) return error('Shift tidak ditemukan', 404);

  if (action === 'request_close') {
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
    if (!SENIOR_ROLES.includes(user.role as any) && !ADMIN_ROLES.includes(user.role as any)) {
      return error('Hanya manager/owner yang bisa approve', 403);
    }
    const updated = await prisma.shift.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date(), approvedBy: user.userId, approvedAt: new Date() },
      include: { user: { select: { name: true } } },
    });
    try {
      await (prisma as any).auditLog.create({
        data: { userId: user.userId, userName: user.name || '', action: 'SHIFT_CLOSE', entity: 'Shift', entityId: id, newValue: { approvedBy: user.userId, closedAt: new Date() } },
      });
    } catch { /* silent if auditLog not migrated yet */ }
    return success(updated);
  }

  return error('Action tidak valid');
}, ALL_ROLES);
