export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { STOCK_ROLES } from '@/lib/auth';

export const GET = withAuth(async (req: NextRequest, _user, { params }: any) => {
  const id = params?.id;
  if (!id) return error('ID wajib');
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { supplier: true, items: { include: { ingredient: true } } },
  });
  if (!po) return error('PO tidak ditemukan', 404);
  return success(po);
}, STOCK_ROLES);
