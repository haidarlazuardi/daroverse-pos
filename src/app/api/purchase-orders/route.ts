export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth, generatePONumber } from '@/lib/api-helpers';
import { ADMIN_ROLES, SENIOR_ROLES, STOCK_ROLES } from '@/lib/auth';
import { receivePurchaseOrder } from '@/lib/stock-engine';
import { ensureCan } from '@/lib/permissions';

export const GET = withAuth(async (req, user) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const pos = await prisma.purchaseOrder.findMany({
    where,
    include: { supplier: true, items: { include: { ingredient: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return success(pos);
});

// POST: Record purchase. markComplete=true → stock updated immediately.
// IMPORTANT: No Expense record is created. Ingredient purchases are
// INVENTORY (asset), recognized as cost when SOLD (COGS). Recording them
// as expenses too would double-count the cost and understate profit.
export const POST = withAuth(async (req, user) => {
  try {
    const { supplierId, items, notes, markComplete } = await req.json();
    if (!supplierId || !items?.length) return error('Supplier dan items wajib diisi');

    const totalAmount = items.reduce(
      (sum: number, i: { quantity: number; unitPrice: number }) => sum + i.quantity * i.unitPrice, 0);

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: generatePONumber(),
        supplierId,
        status: 'DRAFT',
        totalAmount, notes,
        createdBy: user.userId,
        items: {
          create: items.map((item: any) => ({
            ingredientId: item.ingredientId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
          })),
        },
      },
      include: { supplier: true, items: { include: { ingredient: true } } },
    });

    if (markComplete) {
      await receivePurchaseOrder(po.id, user.userId);
    }

    return success(po, 201);
  } catch (e: any) {
    console.error('PO create error:', e);
    return error(e.message || 'Failed', 500);
  }
}, STOCK_ROLES);

export const PATCH = withAuth(async (req, user) => {
  try {
    const { id, action } = await req.json();
    if (!id || !action) return error('ID and action required');
    if (action === 'complete') { const d = await ensureCan(user, 'receive_po'); if (d) return error(d, 403); }
    else if (!ADMIN_ROLES.includes(user.role)) return error('Hanya admin.', 403);

    if (action === 'complete') {
      await receivePurchaseOrder(id, user.userId);
      return success({ completed: true });
    }
    if (action === 'cancel') {
      await prisma.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
      return success({ cancelled: true });
    }
    return error('Invalid action');
  } catch (e: any) {
    return error(e.message || 'Failed', 500);
  }
});
