export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES, ALL_ROLES } from '@/lib/auth';

// GET — units untuk satu ingredient
export const GET = withAuth(async (req: NextRequest) => {
  const ingredientId = new URL(req.url).searchParams.get('ingredientId');
  if (!ingredientId) return error('ingredientId wajib');
  const units = await (prisma as any).ingredientUnit.findMany({
    where: { ingredientId },
    orderBy: { sortOrder: 'asc' },
  });
  return success(units);
}, ALL_ROLES);

// POST — tambah unit baru
export const POST = withAuth(async (req: NextRequest) => {
  const { ingredientId, name, parentUnit, parentQty } = await req.json();
  if (!ingredientId || !name) return error('ingredientId dan name wajib');

  // Hitung toBase
  let toBase: number;
  if (parentUnit && parentQty) {
    // Cari toBase dari parent unit
    const parent = await (prisma as any).ingredientUnit.findFirst({
      where: { ingredientId, name: parentUnit },
    });
    if (!parent) return error(`Unit parent "${parentUnit}" tidak ditemukan`);
    toBase = parent.toBase * parentQty;
  } else {
    // Direct to base — wajib ada parentQty sebagai toBase langsung
    if (!parentQty) return error('parentQty wajib (jumlah base unit per 1 unit ini)');
    toBase = parentQty;
  }

  // Sort order — lebih besar dari unit yang ada
  const existing = await (prisma as any).ingredientUnit.findMany({ where: { ingredientId } });
  const sortOrder = existing.length;

  const unit = await (prisma as any).ingredientUnit.create({
    data: { ingredientId, name, toBase, parentUnit: parentUnit || null, parentQty: parentQty || null, sortOrder },
  });
  return success(unit, 201);
}, ADMIN_ROLES);

// DELETE — hapus unit
export const DELETE = withAuth(async (req: NextRequest) => {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return error('id wajib');
  await (prisma as any).ingredientUnit.delete({ where: { id } });
  return success({ deleted: true });
}, ADMIN_ROLES);
