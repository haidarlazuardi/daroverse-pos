import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';

export const GET = withAuth(async () => {
  const suppliers = await prisma.supplier.findMany({
    include: { _count: { select: { purchaseOrders: true } } },
    orderBy: { name: 'asc' },
  });
  return success(suppliers);
}, ['SUPER_ADMIN']);

export const POST = withAuth(async (req) => {
  const { name, contactPerson, phone, email, address } = await req.json();
  if (!name) return error('Supplier name is required');

  const supplier = await prisma.supplier.create({
    data: { name, contactPerson, phone, email, address },
  });
  return success(supplier, 201);
}, ['SUPER_ADMIN']);

export const PUT = withAuth(async (req) => {
  const { id, ...data } = await req.json();
  if (!id) return error('ID is required');

  const supplier = await prisma.supplier.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.contactPerson !== undefined && { contactPerson: data.contactPerson }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.address !== undefined && { address: data.address }),
    },
  });
  return success(supplier);
}, ['SUPER_ADMIN']);
