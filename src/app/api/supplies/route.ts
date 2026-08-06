export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES, ALL_ROLES } from '@/lib/auth';

// GET — list supply items
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const items = await (prisma as any).supplyItem.findMany({
    where: {
      active: true,
      ...(category ? { category } : {}),
    },
    include: { defaultSupplier: { select: { id: true, name: true } } },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  return success(items);
}, ALL_ROLES);

// POST — tambah supply item baru
export const POST = withAuth(async (req: NextRequest) => {
  const { name, unit, category, defaultSupplierId, latestPrice, minStock, notes } = await req.json();
  if (!name || !unit || !category) return error('name, unit, category wajib');
  const item = await (prisma as any).supplyItem.create({
    data: {
      name: name.trim(), unit, category,
      defaultSupplierId: defaultSupplierId || null,
      latestPrice: parseFloat(latestPrice) || 0,
      minStock: parseFloat(minStock) || 0,
      notes: notes || null,
    },
  });
  return success(item, 201);
}, ADMIN_ROLES);

// PATCH — update supply item
export const PATCH = withAuth(async (req: NextRequest) => {
  const { id, ...data } = await req.json();
  if (!id) return error('id wajib');
  const item = await (prisma as any).supplyItem.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.unit !== undefined && { unit: data.unit }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.defaultSupplierId !== undefined && { defaultSupplierId: data.defaultSupplierId || null }),
      ...(data.latestPrice !== undefined && { latestPrice: parseFloat(data.latestPrice) || 0 }),
      ...(data.minStock !== undefined && { minStock: parseFloat(data.minStock) || 0 }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
      ...(data.active !== undefined && { active: data.active }),
    },
  });
  return success(item);
}, ADMIN_ROLES);

// DELETE — soft delete
export const DELETE = withAuth(async (req: NextRequest) => {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return error('id wajib');
  await (prisma as any).supplyItem.update({ where: { id }, data: { active: false } });
  return success({ deleted: true });
}, ADMIN_ROLES);
