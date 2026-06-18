import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error } from '@/lib/api-helpers';
import { authenticate } from '@/lib/auth';
import { buildProductionDraft, executeProductionOrder } from '@/lib/stock-engine';
import { ensureCan } from '@/lib/permissions';
import { StockLocation } from '@prisma/client';

function genNumber() {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PRD-${date}-${rand}`;
}

// GET — list production orders
export async function GET(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return error('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const location = searchParams.get('location');

  const orders = await prisma.productionOrder.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      ...(location ? { location: location as StockLocation } : {}),
    },
    include: {
      ingredient: { select: { name: true, unit: true } },
      items: { include: { ingredient: { select: { name: true, unit: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return success({ productionOrders: orders });
}

// POST — "Bikin batch": create the order from the batch recipe and execute it
// (consume raw, produce prepped) unless { execute: false } is passed.
export async function POST(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return error('Unauthorized', 401);
  { const d = await ensureCan(user, 'batch'); if (d) return error(d, 403); }

  try {
    const { ingredientId, batchMultiplier = 1, location, actualYield, execute = true } = await req.json();
    if (!ingredientId || !location) return error('ingredientId dan location wajib diisi');
    if (batchMultiplier <= 0) return error('Jumlah batch harus lebih dari 0');

    const draft = await buildProductionDraft(ingredientId, batchMultiplier, location as StockLocation);

    const po = await prisma.productionOrder.create({
      data: {
        number: genNumber(),
        ingredientId: draft.ingredientId,
        location: draft.location,
        batchMultiplier,
        plannedYield: draft.plannedYield,
        status: 'DRAFT',
        createdBy: user.userId,
        items: { create: draft.items },
      },
    });

    if (execute) {
      await executeProductionOrder(po.id, user.userId, actualYield);
    }

    const result = await prisma.productionOrder.findUnique({
      where: { id: po.id },
      include: { ingredient: { select: { name: true, unit: true } }, items: true },
    });
    return success(result, 201);
  } catch (e: any) {
    console.error('Production error:', e);
    return error(e.message || 'Gagal membuat produksi', 500);
  }
}

// PATCH — execute a DRAFT (with optional actualYield) or cancel
export async function PATCH(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return error('Unauthorized', 401);
  { const d = await ensureCan(user, 'batch'); if (d) return error(d, 403); }

  try {
    const { productionOrderId, action, actualYield } = await req.json();
    if (!productionOrderId || !action) return error('productionOrderId dan action wajib diisi');

    if (action === 'execute') {
      await executeProductionOrder(productionOrderId, user.userId, actualYield);
      return success({ executed: true });
    }
    if (action === 'cancel') {
      const po = await prisma.productionOrder.findUnique({ where: { id: productionOrderId } });
      if (!po) return error('Production order tidak ditemukan');
      if (po.status === 'COMPLETED') return error('Tidak bisa membatalkan produksi yang sudah selesai');
      await prisma.productionOrder.update({ where: { id: productionOrderId }, data: { status: 'CANCELLED' } });
      return success({ cancelled: true });
    }
    return error('Aksi tidak valid');
  } catch (e: any) {
    return error(e.message || 'Gagal', 500);
  }
}
