export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES, ALL_ROLES } from '@/lib/auth';

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const phone  = searchParams.get('phone');
  const search = searchParams.get('search');
  const limit  = Math.min(parseInt(searchParams.get('limit') || '100'), 500);

  // Single customer lookup (POS loyalty)
  if (phone) {
    const customer = await prisma.customer.findUnique({
      where: { phone },
      select: { id: true, name: true, phone: true, points: true, totalSpent: true, visitCount: true },
    });
    return success({ found: !!customer, customer });
  }

  // List with optional search
  const customers = await prisma.customer.findMany({
    where: search ? {
      OR: [
        { name:  { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ],
    } : undefined,
    orderBy: { totalSpent: 'desc' },
    take: limit,
    select: {
      id: true, name: true, phone: true, points: true,
      totalSpent: true, visitCount: true, lastVisitAt: true, createdAt: true,
    },
  });
  return success(customers);
}, ALL_ROLES);

export const PATCH = withAuth(async (req: NextRequest) => {
  const { id, name, phone } = await req.json();
  if (!id) return error('ID wajib diisi');
  const customer = await prisma.customer.update({
    where: { id },
    data: { ...(name && { name }), ...(phone && { phone }) },
  });
  return success(customer);
}, ADMIN_ROLES);

export const DELETE = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return error('ID wajib diisi');
  await prisma.customer.delete({ where: { id } });
  return success({ deleted: true });
}, ADMIN_ROLES);
