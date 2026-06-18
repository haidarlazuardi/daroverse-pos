import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error } from '@/lib/api-helpers';
import { authenticate } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return error('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const active = searchParams.get('active');
  const limit = parseInt(searchParams.get('limit') || '20');

  const where: Record<string, unknown> = {};
  if (active === 'true') where.closedAt = null;
  if (user.role === 'CASHIER') where.userId = user.userId;

  const shifts = await prisma.shift.findMany({
    where,
    include: {
      user: { select: { name: true, email: true } },
      _count: { select: { orders: true, expenses: true } },
    },
    orderBy: { openedAt: 'desc' },
    take: limit,
  });

  return success(shifts);
}

export async function POST(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return error('Unauthorized', 401);

  const { action, shiftId, openingCash, closingCash, notes } = await req.json();

  // OPEN SHIFT
  if (action === 'open') {
    // Check if user already has an open shift
    const existing = await prisma.shift.findFirst({
      where: { userId: user.userId, closedAt: null },
    });
    if (existing) return error('You already have an open shift. Close it first.');

    const shift = await prisma.shift.create({
      data: {
        userId: user.userId,
        openingCash: parseFloat(openingCash) || 0,
        notes,
      },
      include: { user: { select: { name: true } } },
    });
    return success(shift, 201);
  }

  // CLOSE SHIFT
  if (action === 'close') {
    if (!shiftId) return error('Shift ID is required');

    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        orders: { where: { status: 'COMPLETED' }, include: { payment: true } },
        expenses: true,
      },
    });

    if (!shift) return error('Shift not found');
    if (shift.closedAt) return error('Shift already closed');
    if (shift.userId !== user.userId && user.role !== 'SUPER_ADMIN') return error('Not your shift');

    // Calculate totals
    let cashSales = 0, qrisSales = 0, totalSales = 0;
    for (const order of shift.orders) {
      totalSales += order.total;
      if (order.payment?.method === 'CASH') cashSales += order.total;
      else qrisSales += order.total;
    }
    const totalExpenses = shift.expenses.reduce((s, e) => s + e.amount, 0);
    const expectedCash = shift.openingCash + cashSales - totalExpenses;
    const actualClosing = parseFloat(closingCash) || 0;
    const difference = actualClosing - expectedCash;

    const updated = await prisma.shift.update({
      where: { id: shiftId },
      data: {
        closedAt: new Date(),
        closingCash: actualClosing,
        expectedCash,
        difference,
        cashSales,
        qrisSales,
        totalSales,
        totalExpenses,
        notes: notes || shift.notes,
      },
      include: { user: { select: { name: true } } },
    });
    return success(updated);
  }

  return error('Invalid action. Use "open" or "close"');
}
