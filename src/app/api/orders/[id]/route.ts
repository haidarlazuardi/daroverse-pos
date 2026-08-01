export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { SENIOR_ROLES } from '@/lib/auth';

export const DELETE = withAuth(async (req: NextRequest, _user, params) => {
  const id = params?.id;
  if (!id) return error('ID wajib');

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, payment: true },
  });
  if (!order) return error('Order tidak ditemukan', 404);

  await prisma.$transaction(async (tx) => {
    // Hapus related records
    await tx.payment.deleteMany({ where: { orderId: id } });
    await tx.orderItem.deleteMany({ where: { orderId: id } });
    await (tx as any).stockMovement.deleteMany({ where: { reference: id } });
    await tx.order.delete({ where: { id } });
  });

  return success({ deleted: true });
}, SENIOR_ROLES);
