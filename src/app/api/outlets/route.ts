import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';

export const GET = withAuth(async () => {
  const outlets = await prisma.outlet.findMany({
    include: { _count: { select: { users: true, orders: true } } },
    orderBy: { name: 'asc' },
  });
  return success(outlets);
}, ['ADMIN']);

export const POST = withAuth(async (req) => {
  const { name, address, phone } = await req.json();
  if (!name) return error('Name is required');

  const outlet = await prisma.outlet.create({
    data: { name, address, phone },
  });
  return success(outlet, 201);
}, ['ADMIN']);
