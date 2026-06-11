import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { authenticate } from '@/lib/auth';

// GET: both admin and cashier can fetch active discounts
export async function GET(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return error('Unauthorized', 401);

  const where = user.role === 'CASHIER' ? { active: true } : {};

  const discounts = await prisma.discount.findMany({
    where,
    orderBy: { name: 'asc' },
  });

  // Filter expired for cashier
  const now = new Date();
  const filtered = user.role === 'CASHIER'
    ? discounts.filter(d => {
        if (d.validFrom && d.validFrom > now) return false;
        if (d.validTo && d.validTo < now) return false;
        return true;
      })
    : discounts;

  return success(filtered);
}

export const POST = withAuth(async (req) => {
  const { name, type, value, active, minOrder, maxDiscount, validFrom, validTo } = await req.json();
  if (!name || !type || value === undefined) return error('Name, type, and value are required');

  const discount = await prisma.discount.create({
    data: {
      name,
      type,
      value: parseFloat(value),
      active: active !== false,
      minOrder: minOrder ? parseFloat(minOrder) : null,
      maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
      validFrom: validFrom ? new Date(validFrom) : null,
      validTo: validTo ? new Date(validTo) : null,
    },
  });
  return success(discount, 201);
}, ['ADMIN']);

export const PUT = withAuth(async (req) => {
  const { id, ...data } = await req.json();
  if (!id) return error('ID is required');

  const discount = await prisma.discount.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.value !== undefined && { value: parseFloat(data.value) }),
      ...(data.active !== undefined && { active: data.active }),
      ...(data.minOrder !== undefined && { minOrder: data.minOrder ? parseFloat(data.minOrder) : null }),
      ...(data.maxDiscount !== undefined && { maxDiscount: data.maxDiscount ? parseFloat(data.maxDiscount) : null }),
      ...(data.validFrom !== undefined && { validFrom: data.validFrom ? new Date(data.validFrom) : null }),
      ...(data.validTo !== undefined && { validTo: data.validTo ? new Date(data.validTo) : null }),
    },
  });
  return success(discount);
}, ['ADMIN']);

export const DELETE = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return error('ID is required');

  await prisma.discount.update({ where: { id }, data: { active: false } });
  return success({ deleted: true });
}, ['ADMIN']);
