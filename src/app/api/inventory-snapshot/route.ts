export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { SENIOR_ROLES } from '@/lib/auth';

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const year  = parseInt(searchParams.get('year')  || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));

  const snapshot = await (prisma as any).inventorySnapshot.findUnique({
    where: { year_month: { year, month } },
  });
  return success(snapshot);
});

export const POST = withAuth(async (req: NextRequest, user) => {
  const body  = await req.json();
  const year  = body.year  || new Date().getFullYear();
  const month = body.month || new Date().getMonth() + 1;

  // Calculate current inventory value
  const ingredients = await prisma.ingredient.findMany({
    where: { active: true },
    include: { stockLevels: true },
  });

  const items = ingredients.map(ing => {
    const totalQty = ing.stockLevels.reduce((s, sl) => s + sl.quantity, 0);
    const value    = totalQty * ing.latestPrice;
    return {
      ingredientId: ing.id,
      name:         ing.name,
      unit:         ing.unit,
      type:         ing.type,
      qty:          totalQty,
      latestPrice:  ing.latestPrice,
      totalValue:   Math.round(value),
    };
  }).filter(i => i.qty > 0);

  const totalValue = items.reduce((s, i) => s + i.totalValue, 0);

  const snapshot = await (prisma as any).inventorySnapshot.upsert({
    where: { year_month: { year, month } },
    create: { year, month, totalValue, items, createdBy: user.userId },
    update: { totalValue, items, snapshotDate: new Date() },
  });

  return success({ snapshot, itemCount: items.length, totalValue });
}, SENIOR_ROLES);
