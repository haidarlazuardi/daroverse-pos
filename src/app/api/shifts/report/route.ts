export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ALL_ROLES } from '@/lib/auth';

export const GET = withAuth(async (req: NextRequest) => {
  const shiftId = new URL(req.url).searchParams.get('shiftId');
  if (!shiftId) return error('shiftId wajib');

  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { user: { select: { name: true } } },
  });
  if (!shift) return error('Shift tidak ditemukan', 404);

  // Ambil semua order COMPLETED dalam shift ini
  const orders = await prisma.order.findMany({
    where: { shiftId, status: 'COMPLETED' },
    include: {
      items: { include: { product: { select: { name: true } } } },
      payment: { select: { method: true, received: true, change: true } },
    },
  });

  // Aggregate items
  const itemMap: Record<string, { name: string; qty: number; subtotal: number }> = {};
  for (const order of orders) {
    for (const item of order.items) {
      const key = item.productId;
      if (!itemMap[key]) itemMap[key] = { name: item.product?.name || '?', qty: 0, subtotal: 0 };
      itemMap[key].qty      += item.quantity;
      itemMap[key].subtotal += item.subtotal;
    }
  }

  const items = Object.values(itemMap).filter(i => i.qty > 0);

  // WIB date
  const wib = new Date(new Date(shift.openedAt).getTime() + 7 * 60 * 60 * 1000);
  const dateStr = wib.toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  return success({
    shift,
    cashierName:   (shift.user as any)?.name || 'Kasir',
    date:          dateStr,
    openingCash:   shift.openingCash || 0,
    closingCash:   shift.closingCash || 0,
    expectedCash:  shift.expectedCash || 0,
    difference:    shift.difference || 0,
    cashSales:     shift.cashSales || 0,
    qrisSales:     shift.qrisSales || 0,
    cardSales:     shift.cardSales || 0,
    totalSales:    shift.totalSales || 0,
    totalExpenses: shift.totalExpenses || 0,
    orderCount:    orders.length,
    items,
  });
}, ALL_ROLES);
