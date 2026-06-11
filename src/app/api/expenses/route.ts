import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error } from '@/lib/api-helpers';
import { authenticate } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return error('Unauthorized', 401);
  if (user.role !== 'ADMIN') return error('Forbidden', 403);

  const { searchParams } = new URL(req.url);
  const outletId = searchParams.get('outletId') || user.outletId;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const category = searchParams.get('category');

  const where: Record<string, unknown> = {};
  if (outletId) where.outletId = outletId;
  if (category) where.category = category;
  if (from || to) {
    where.createdAt = {};
    if (from) (where.createdAt as any).gte = new Date(from);
    if (to) (where.createdAt as any).lte = new Date(to + 'T23:59:59.999Z');
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: { outlet: { select: { name: true } }, shift: { select: { id: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory: Record<string, number> = {};
  expenses.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });

  return success({ expenses, total, byCategory });
}

export async function POST(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return error('Unauthorized', 401);

  const { category, description, amount, paidBy, shiftId } = await req.json();
  if (!category || !description || !amount) return error('Category, description, and amount are required');

  const outletId = user.outletId;
  if (!outletId) return error('No outlet assigned');

  // Auto-link to active shift if not provided
  let finalShiftId = shiftId;
  if (!finalShiftId) {
    const activeShift = await prisma.shift.findFirst({
      where: { userId: user.userId, closedAt: null },
    });
    finalShiftId = activeShift?.id || null;
  }

  const expense = await prisma.expense.create({
    data: {
      outletId,
      shiftId: finalShiftId,
      category,
      description,
      amount: parseFloat(amount),
      paidBy: paidBy || user.name,
      createdBy: user.userId,
    },
  });

  return success(expense, 201);
}

export async function DELETE(req: NextRequest) {
  const user = authenticate(req);
  if (!user || user.role !== 'ADMIN') return error('Forbidden', 403);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return error('ID is required');

  await prisma.expense.delete({ where: { id } });
  return success({ deleted: true });
}
