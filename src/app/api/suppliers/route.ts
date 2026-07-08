import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { STOCK_ROLES, ADMIN_ROLES, SENIOR_ROLES } from '@/lib/auth';

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search');
  const suppliers = await prisma.supplier.findMany({
    where: {
      active: true,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    },
    include: { _count: { select: { purchaseOrders: true } } },
    orderBy: { name: 'asc' },
  });
  return success(suppliers);
}, STOCK_ROLES);

export const POST = withAuth(async (req) => {
  const { name, contactPerson, phone, email, address } = await req.json();
  if (!name?.trim()) return error('Nama supplier wajib diisi');

  const exists = await prisma.supplier.findFirst({ where: { name: { equals: name.trim(), mode: 'insensitive' }, active: true } });
  if (exists) return error('Nama supplier sudah ada');

  const supplier = await prisma.supplier.create({
    data: { name: name.trim(), contactPerson: contactPerson || null, phone: phone || null, email: email || null, address: address || null },
    include: { _count: { select: { purchaseOrders: true } } },
  });
  return success(supplier, 201);
}, ADMIN_ROLES);

export const PATCH = withAuth(async (req) => {
  const { id, name, contactPerson, phone, email, address } = await req.json();
  if (!id) return error('ID wajib diisi');
  if (name !== undefined && !name?.trim()) return error('Nama supplier tidak boleh kosong');

  const data: Record<string, unknown> = {};
  if (name          !== undefined) data.name          = name.trim();
  if (contactPerson !== undefined) data.contactPerson = contactPerson || null;
  if (phone         !== undefined) data.phone         = phone || null;
  if (email         !== undefined) data.email         = email || null;
  if (address       !== undefined) data.address       = address || null;

  const supplier = await prisma.supplier.update({
    where: { id },
    data,
    include: { _count: { select: { purchaseOrders: true } } },
  });
  return success(supplier);
}, ADMIN_ROLES);

export const DELETE = withAuth(async (req) => {
  const { id } = await req.json();
  if (!id) return error('ID wajib diisi');
  const s = await prisma.supplier.findUnique({ where: { id }, include: { _count: { select: { purchaseOrders: true } } } });
  if (!s) return error('Supplier tidak ditemukan', 404);
  if (s._count.purchaseOrders > 0) return error(`Supplier masih memiliki ${s._count.purchaseOrders} purchase order.`);
  await prisma.supplier.update({ where: { id }, data: { active: false } });
  return success({ deleted: true });
}, SENIOR_ROLES);
