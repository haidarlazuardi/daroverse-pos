export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES } from '@/lib/auth';
import { nowWIB } from '@/lib/wib';

function generateSONumber() {
  const now = nowWIB();
  const y = now.getUTCFullYear().toString().slice(2);
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `SO-${y}${m}${d}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

// GET — list supply orders
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const orders = await (prisma as any).supplyOrder.findMany({
    where: status ? { status } : {},
    include: {
      supplier: { select: { id: true, name: true } },
      items: {
        include: { supplyItem: { select: { id: true, name: true, unit: true, category: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return success({ orders });
}, ADMIN_ROLES);

// POST — buat supply order baru
export const POST = withAuth(async (req: NextRequest, user) => {
  const { supplierId, items, notes } = await req.json();
  if (!items?.length) return error('items wajib');

  const totalAmount = items.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0);

  const order = await (prisma as any).supplyOrder.create({
    data: {
      poNumber: generateSONumber(),
      supplierId: supplierId || null,
      totalAmount,
      notes: notes || null,
      createdBy: user.userId,
      status: 'DRAFT',
      items: {
        create: items.map((i: any) => ({
          supplyItemId: i.supplyItemId,
          quantity: parseFloat(i.quantity),
          unitPrice: parseFloat(i.unitPrice),
          totalPrice: parseFloat(i.quantity) * parseFloat(i.unitPrice),
        })),
      },
    },
    include: {
      supplier: { select: { name: true } },
      items: { include: { supplyItem: true } },
    },
  });
  return success(order, 201);
}, ADMIN_ROLES);

// PATCH — update status, receive order
export const PATCH = withAuth(async (req: NextRequest, user) => {
  const { id, action, items } = await req.json();
  if (!id) return error('id wajib');

  if (action === 'receive') {
    await prisma.$transaction(async (tx) => {
      const order = await (tx as any).supplyOrder.findUnique({
        where: { id }, include: { items: { include: { supplyItem: true } } },
      });
      if (!order) throw new Error('Order tidak ditemukan');

      // Update stock setiap supply item
      for (const item of order.items) {
        const qty = item.quantity;
        await (tx as any).supplyItem.update({
          where: { id: item.supplyItemId },
          data: {
            currentStock: { increment: qty },
            latestPrice: item.unitPrice,
          },
        });
      }

      // Auto-create expense
      await tx.expense.create({
        data: {
          category: 'OPERATIONAL' as any,
          description: `Supply Order ${order.poNumber}`,
          amount: order.totalAmount,
          createdBy: user.userId,
        },
      });

      await (tx as any).supplyOrder.update({
        where: { id },
        data: { status: 'RECEIVED', receivedAt: new Date() },
      });
    });
    return success({ received: true });
  }

  if (action === 'cancel') {
    await (prisma as any).supplyOrder.update({
      where: { id }, data: { status: 'CANCELLED' },
    });
    return success({ cancelled: true });
  }

  if (action === 'order') {
    await (prisma as any).supplyOrder.update({
      where: { id }, data: { status: 'ORDERED' },
    });
    return success({ ordered: true });
  }

  return error('Action tidak valid');
}, ADMIN_ROLES);
