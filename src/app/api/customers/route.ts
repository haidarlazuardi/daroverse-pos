import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, withAuth } from '@/lib/api-helpers';

// GET ?phone=08xx  → single customer (for POS loyalty lookup), or null
// GET (no phone)   → recent customers list
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get('phone');

  if (phone) {
    const customer = await prisma.customer.findUnique({
      where: { phone },
      select: { id: true, name: true, phone: true, points: true, totalSpent: true, visitCount: true },
    });
    return success({ found: !!customer, customer });
  }

  const customers = await prisma.customer.findMany({
    orderBy: { lastVisitAt: 'desc' },
    take: 50,
    select: { id: true, name: true, phone: true, points: true, totalSpent: true, visitCount: true, lastVisitAt: true },
  });
  return success(customers);
});
