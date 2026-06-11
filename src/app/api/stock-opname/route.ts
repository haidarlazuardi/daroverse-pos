import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';

export const GET = withAuth(async (req, user) => {
  const { searchParams } = new URL(req.url);
  const outletId = searchParams.get('outletId') || user.outletId;
  const id = searchParams.get('id');

  // Single opname detail
  if (id) {
    const opname = await prisma.stockOpname.findUnique({
      where: { id },
      include: {
        outlet: { select: { name: true } },
        items: { include: { ingredient: { select: { name: true, unit: true } } } },
      },
    });
    return success(opname);
  }

  const opnames = await prisma.stockOpname.findMany({
    where: outletId ? { outletId } : {},
    include: {
      outlet: { select: { name: true } },
      items: { include: { ingredient: { select: { name: true, unit: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return success(opnames);
}, ['ADMIN']);

export const POST = withAuth(async (req, user) => {
  try {
    const { action, opnameId, outletId: reqOutletId, items, notes } = await req.json();
    const outletId = reqOutletId || user.outletId;

    // CREATE
    if (action === 'create') {
      if (!outletId) return error('Outlet required');
      const stockLevels = await prisma.stockLevel.findMany({
        where: { outletId },
        include: { ingredient: true },
      });

      const opname = await prisma.stockOpname.create({
        data: {
          outletId, status: 'DRAFT', notes, createdBy: user.userId,
          items: {
            create: stockLevels
              .filter(sl => sl.ingredient?.active)
              .map(sl => ({
                ingredientId: sl.ingredientId,
                systemQty: sl.quantity,
                actualQty: sl.quantity,
                difference: 0,
              })),
          },
        },
        include: { items: { include: { ingredient: { select: { name: true, unit: true } } } } },
      });
      return success(opname, 201);
    }

    // UPDATE counts
    if (action === 'update') {
      if (!opnameId || !items?.length) return error('Opname ID and items required');
      for (const item of items) {
        const actualQty = parseFloat(item.actualQty) || 0;
        await prisma.stockOpnameItem.update({
          where: { id: item.id },
          data: { actualQty, difference: actualQty - item.systemQty, notes: item.notes || null },
        });
      }
      return success({ saved: true });
    }

    // COMPLETE — apply adjustments
    if (action === 'complete') {
      if (!opnameId) return error('Opname ID required');
      const opname = await prisma.stockOpname.findUnique({
        where: { id: opnameId }, include: { items: true },
      });
      if (!opname) return error('Not found');
      if (opname.status === 'COMPLETED') return error('Already completed');

      let adjustments = 0;
      for (const item of opname.items) {
        if (item.difference === 0) continue;
        adjustments++;
        await prisma.stockLevel.update({
          where: { outletId_ingredientId: { outletId: opname.outletId, ingredientId: item.ingredientId } },
          data: { quantity: item.actualQty, lastUpdated: new Date() },
        });
        await prisma.stockMovement.create({
          data: {
            outletId: opname.outletId, ingredientId: item.ingredientId, type: 'OPNAME',
            quantity: item.difference, reference: opname.id,
            notes: `Opname: system ${item.systemQty} → actual ${item.actualQty}${item.notes ? ` (${item.notes})` : ''}`,
            createdBy: user.userId,
          },
        });
      }

      await prisma.stockOpname.update({ where: { id: opnameId }, data: { status: 'COMPLETED' } });
      return success({ completed: true, adjustments });
    }

    return error('Invalid action');
  } catch (e: any) {
    return error(e.message || 'Failed', 500);
  }
}, ['ADMIN']);
