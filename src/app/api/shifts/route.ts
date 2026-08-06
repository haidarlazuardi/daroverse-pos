export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES, SENIOR_ROLES, ALL_ROLES } from '@/lib/auth';

// ── Helper: hitung summary shift ────────────────────────────────────────────
async function calcShiftSummary(shiftId: string) {
  // Ambil order COMPLETED saja (exclude VOID/VOIDED)
  const orders = await prisma.order.findMany({
    where: {
      shiftId,
      status: { in: ['COMPLETED'] },
    },
    include: { payment: { select: { method: true, amount: true } } },
  });

  const cashSales  = orders.filter(o => (o.payment as any)?.method === 'CASH').reduce((s, o) => s + o.total, 0);
  const qrisSales  = orders.filter(o => (o.payment as any)?.method === 'QRIS').reduce((s, o) => s + o.total, 0);
  const cardSales  = orders.filter(o => (o.payment as any)?.method === 'CARD').reduce((s, o) => s + o.total, 0);
  const totalSales = orders.reduce((s, o) => s + o.total, 0);

  // Ambil expense yang linked ke shift ini (semua dianggap dibayar cash dari laci)
  const expenses = await prisma.expense.findMany({
    where: { shiftId },
    select: { amount: true },
  });
  const cashExpenses  = expenses.reduce((s, e) => s + e.amount, 0);
  const totalExpenses = cashExpenses;

  return { cashSales, qrisSales, cardSales, totalSales, cashExpenses, totalExpenses, orderCount: orders.length };
}

// ── GET ──────────────────────────────────────────────────────────────────────
export const GET = withAuth(async (req: NextRequest, user) => {
  const { searchParams } = new URL(req.url);
  const active = searchParams.get('active');
  const limit  = parseInt(searchParams.get('limit') || '20');

  if (active === 'true') {
    // Fix #5: return OPEN atau PENDING_CLOSE sebagai "aktif"
    const shift = await prisma.shift.findFirst({
      where: { status: { in: ['OPEN', 'PENDING_CLOSE'] } },
      include: { user: { select: { name: true } } },
      orderBy: { openedAt: 'desc' },
    });

    // Auto-close shift stale > 24 jam
    if (shift && shift.status === 'OPEN') {
      const ageH = (Date.now() - new Date(shift.openedAt).getTime()) / 3600000;
      if (ageH > 24) {
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

// ── POST — open shift ────────────────────────────────────────────────────────
export const POST = withAuth(async (req: NextRequest, user) => {
  const body = await req.json();
  const openingCash = parseFloat(body.openingCash) || 0;

  // Fix #4: blok kalau ada OPEN atau PENDING_CLOSE
  const existing = await prisma.shift.findFirst({
    where: { status: { in: ['OPEN', 'PENDING_CLOSE'] } },
    include: { user: { select: { name: true } } },
  });
  if (existing) {
    const label = existing.status === 'PENDING_CLOSE'
      ? `Shift oleh ${existing.user?.name || 'staff lain'} sedang menunggu approval penutupan`
      : `Sudah ada shift aktif yang dibuka oleh ${existing.user?.name || 'staff lain'}`;
    return error(label, 400);
  }

  const shift = await prisma.shift.create({
    data: { userId: user.userId, openingCash, status: 'OPEN' },
    include: { user: { select: { name: true } } },
  });

  try {
    await (prisma as any).auditLog?.create({
      data: { userId: user.userId, userName: user.name || '', action: 'SHIFT_OPEN', entity: 'Shift', entityId: shift.id, newValue: { openingCash } },
    });
  } catch {}

  return success(shift, 201);
}, ADMIN_ROLES);

// ── PATCH — request_close / approve_close / force_close ──────────────────────
export const PATCH = withAuth(async (req: NextRequest, user) => {
  const { id, action, closingCash, notes } = await req.json();
  if (!id) return error('ID wajib diisi');

  const shift = await prisma.shift.findUnique({ where: { id } });
  if (!shift) return error('Shift tidak ditemukan', 404);

  // Fix #3: satu jalur request_close, hapus duplikasi
  if (action === 'request_close') {
    if (shift.status !== 'OPEN') return error('Shift harus OPEN untuk ditutup');

    // Fix #1: hitung summary dengan formula benar (potong cashExpenses)
    const summary = await calcShiftSummary(id);
    const closing = parseFloat(closingCash) || 0;

    // Fix #1: expectedCash = openingCash + cashSales - cashExpenses
    const expectedCash = shift.openingCash + summary.cashSales - summary.cashExpenses;
    const difference   = closing - expectedCash;

    const updated = await prisma.shift.update({
      where: { id },
      data: {
        status: 'PENDING_CLOSE',
        closingCash: closing,
        expectedCash,
        difference,
        cashSales:     summary.cashSales,
        qrisSales:     summary.qrisSales,
        cardSales:     summary.cardSales,
        totalSales:    summary.totalSales,
        totalExpenses: summary.totalExpenses,
        notes: notes || shift.notes,
      },
      include: { user: { select: { name: true } } },
    });
    return success(updated);
  }

  if (action === 'approve_close') {
    if (!SENIOR_ROLES.includes(user.role as any) && !ADMIN_ROLES.includes(user.role as any)) {
      return error('Hanya manager/owner yang bisa approve', 403);
    }
    if (shift.status !== 'PENDING_CLOSE') return error('Shift harus PENDING_CLOSE untuk di-approve');

    const updated = await prisma.shift.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date(), approvedBy: user.userId, approvedAt: new Date() },
      include: { user: { select: { name: true } } },
    });

    try {
      await (prisma as any).auditLog?.create({
        data: { userId: user.userId, userName: user.name || '', action: 'SHIFT_CLOSE', entity: 'Shift', entityId: id },
      });
    } catch {}

    return success(updated);
  }

  // Force close — owner/manager bisa langsung close tanpa request
  if (action === 'force_close') {
    if (!ADMIN_ROLES.includes(user.role as any)) return error('Hanya admin yang bisa force close', 403);

    const summary = await calcShiftSummary(id);
    const closing  = parseFloat(closingCash) || 0;
    const expectedCash = shift.openingCash + summary.cashSales - summary.cashExpenses;

    const updated = await prisma.shift.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closingCash: closing,
        expectedCash,
        difference: closing - expectedCash,
        cashSales:     summary.cashSales,
        qrisSales:     summary.qrisSales,
        cardSales:     summary.cardSales,
        totalSales:    summary.totalSales,
        totalExpenses: summary.totalExpenses,
        approvedBy: user.userId,
        approvedAt: new Date(),
        notes: notes || 'Force closed by admin',
      },
      include: { user: { select: { name: true } } },
    });
    return success(updated);
  }

  // Reopen — kalau PENDING_CLOSE perlu dibatalkan
  if (action === 'reopen') {
    if (!ADMIN_ROLES.includes(user.role as any)) return error('Hanya admin yang bisa reopen', 403);
    if (shift.status === 'CLOSED') return error('Shift sudah CLOSED tidak bisa dibuka kembali');
    const updated = await prisma.shift.update({
      where: { id },
      data: { status: 'OPEN', closingCash: null, expectedCash: null, difference: null, notes: notes || 'Reopened by admin' },
      include: { user: { select: { name: true } } },
    });
    return success(updated);
  }

  return error('Action tidak valid');
}, ALL_ROLES); // ALL: staff can request_close; approve/force/reopen checked internally
