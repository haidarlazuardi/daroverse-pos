import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { getLowStockAlerts, getPredictedStockouts } from '@/lib/stock-engine';

export const GET = withAuth(async (req, user) => {
  const [stockAlerts, predictions] = await Promise.all([
    getLowStockAlerts(),
    getPredictedStockouts(),
  ]);

  // Negative margin products
  const negativeMarginProducts = await prisma.product.findMany({
    where: { active: true, cost: { gt: 0 } },
    include: { category: true },
  });

  const marginAlerts = negativeMarginProducts
    .filter((p: any) => p.price <= p.cost)
    .map((p: any) => ({
      productId: p.id,
      name: p.name,
      category: p.category.name,
      price: p.price,
      cost: p.cost,
      margin: p.price - p.cost,
      severity: 'high' as const,
    }));

  return success({ stockAlerts, predictions, marginAlerts });
}, ['SUPER_ADMIN']);
