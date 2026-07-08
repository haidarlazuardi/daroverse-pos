import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { StockLocation } from '@prisma/client';
import { ensureCan } from '@/lib/permissions';

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const location = searchParams.get('location');
  const id = searchParams.get('id');

  if (id) {
    const opname = await prisma.stockOpname.findUnique({
      where: { id },
      include: { items: { include: { ingredient: { select: { name: true, unit: true } } } } },
    });
    return success(opname);
  }

  const opnames = await prisma.stockOpname.findMany({
    where: location ? { location: location as StockLocation } : {},
    include: { items: { include: { ingredient: { select: { name: true, unit: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  return success(opnames);
});

export const POST = withAuth(async (req, user) => {
  try {
    const { action, opnameId, location, items, notes, tier } = await req.json();
    const denied = await ensureCan(user, action === 'complete' ? 'opname_apply' : 'opname_input');
    if (denied) return error(denied, 403);

    // CREATE — snapshot current stock at a location (optionally only a count tier).
    if (action === 'create') {
      if (!location) return error('Lokasi wajib diisi');

      // Query ingredients langsung — lebih reliable daripada lewat stockLevels
      // karena stockLevels mungkin belum ada untuk ingredient baru
      const ingredients = await prisma.ingredient.findMany({
        where: {
          active: true,
          ...(tier ? { countTier: tier as any } : {}),
        },
        select: { id: true },
      });

      // Ensure stockLevels exist for all ingredients at this location
      await prisma.stockLevel.createMany({
        data: ingredients.map(i => ({
          ingredientId: i.id,
          location: location as StockLocation,
          quantity: 0,
        })),
        skipDuplicates: true,
      });

      // Fetch updated stockLevels
      const stockLevels = await prisma.stockLevel.findMany({
        where: {
          location: location as StockLocation,
          ingredientId: { in: ingredients.map(i => i.id) },
        },
      });

      const opname = await prisma.stockOpname.create({
        data: {
          location: location as StockLocation,
          status: 'DRAFT',
          notes,
          createdBy: user.userId,
          items: {
            create: stockLevels.map((sl) => ({
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

    // UPDATE counts (staff enter physical counts — blind to systemQty in the UI).
    if (action === 'update') {
      if (!opnameId || !items?.length) return error('opnameId dan items wajib diisi');
      for (const item of items) {
        const actualQty = parseFloat(item.actualQty) || 0;
        await prisma.stockOpnameItem.update({
          where: { id: item.id },
          data: { actualQty, difference: actualQty - item.systemQty, notes: item.notes || null },
        });
      }
      return success({ saved: true });
    }

    // COMPLETE — apply adjustments + auto-classify by per-ingredient tolerance.
    if (action === 'complete') {
      if (!opnameId) return error('opnameId wajib diisi');
      const opname = await prisma.stockOpname.findUnique({
        where: { id: opnameId },
        include: { items: { include: { ingredient: { select: { opnameTolerance: true } } } } },
      });
      if (!opname) return error('Opname tidak ditemukan');
      if (opname.status === 'COMPLETED') return error('Opname sudah selesai');

      let adjustments = 0;
      let flagged = 0;
      for (const item of opname.items) {
        if (item.difference === 0) {
          await prisma.stockOpnameItem.update({ where: { id: item.id }, data: { resolved: true, resolution: 'match' } });
          continue;
        }
        adjustments++;
        const tol = item.ingredient.opnameTolerance ?? 0;
        const withinTol = Math.abs(item.difference) <= tol;
        if (!withinTol) flagged++;

        await prisma.stockLevel.update({
          where: { ingredientId_location: { ingredientId: item.ingredientId, location: opname.location } },
          data: { quantity: item.actualQty, lastUpdated: new Date(), lastCountedAt: new Date() },
        });
        await prisma.stockMovement.create({
          data: {
            ingredientId: item.ingredientId, location: opname.location, type: 'OPNAME',
            quantity: item.difference, reference: opname.id,
            notes: `Opname: ${item.systemQty} → ${item.actualQty}`, createdBy: user.userId,
          },
        });
        await prisma.stockOpnameItem.update({
          where: { id: item.id },
          data: { resolved: withinTol, resolution: withinTol ? 'shrinkage' : 'flagged' },
        });
      }

      await prisma.stockOpname.update({ where: { id: opnameId }, data: { status: 'COMPLETED' } });
      return success({ completed: true, adjustments, flagged });
    }

    return error('Aksi tidak valid');
  } catch (e: any) {
    return error(e.message || 'Gagal', 500);
  }
});
