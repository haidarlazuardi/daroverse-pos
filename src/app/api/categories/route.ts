export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES, SENIOR_ROLES } from '@/lib/auth';

// GET — semua role yang login bisa baca (dipakai POS, products, dll)
export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search');

  const categories = await prisma.category.findMany({
    where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
    include: { _count: { select: { products: true } } },
    orderBy: { sortOrder: 'asc' },
  });

  return success(categories);
});

// POST — create
export const POST = withAuth(async (req) => {
  const { name, color, icon, sortOrder } = await req.json();
  if (!name?.trim()) return error('Nama kategori wajib diisi');

  const exists = await prisma.category.findFirst({ where: { name: { equals: name.trim(), mode: 'insensitive' } } });
  if (exists) return error('Nama kategori sudah ada');

  const category = await prisma.category.create({
    data: { name: name.trim(), color: color || '#22c55e', icon: icon || null, sortOrder: sortOrder ?? 0 },
    include: { _count: { select: { products: true } } },
  });

  return success(category, 201);
}, ADMIN_ROLES);

// PATCH — update
export const PATCH = withAuth(async (req) => {
  const { id, name, color, icon, sortOrder } = await req.json();
  if (!id) return error('ID wajib diisi');
  if (name !== undefined && !name?.trim()) return error('Nama kategori tidak boleh kosong');

  const data: Record<string, unknown> = {};
  if (name   !== undefined) data.name      = name.trim();
  if (color  !== undefined) data.color     = color;
  if (icon   !== undefined) data.icon      = icon || null;
  if (sortOrder !== undefined) data.sortOrder = sortOrder;

  const category = await prisma.category.update({
    where: { id },
    data,
    include: { _count: { select: { products: true } } },
  });

  return success(category);
}, ADMIN_ROLES);

// DELETE — hanya SENIOR (cegah hapus kategori yang masih punya produk)
export const DELETE = withAuth(async (req) => {
  const { id } = await req.json();
  if (!id) return error('ID wajib diisi');

  const cat = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!cat) return error('Kategori tidak ditemukan', 404);
  if (cat._count.products > 0) return error(`Kategori masih dipakai oleh ${cat._count.products} produk. Pindahkan produk dulu sebelum menghapus.`);

  await prisma.category.delete({ where: { id } });
  return success({ deleted: true });
}, SENIOR_ROLES);
