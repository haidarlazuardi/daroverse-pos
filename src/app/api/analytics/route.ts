import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, withAuth } from '@/lib/api-helpers';
import { StockLocation } from '@prisma/client';

// One endpoint, five datasets. All data already collected by the engine —
// this just reads and aggregates it.
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || 'month';
  const now = new Date();
  const from =
    period === 'today' ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : period === 'week' ? new Date(now.getTime() - 7 * 864e5)
        : period === 'all' ? new Date(0)
          : new Date(now.getFullYear(), now.getMonth(), 1); // month
  const inPeriod = { gte: from, lte: now };

  const [stockLevels, ingredients, orders, wasteMoves, opnameMoves, prodOrders, modifiers, customers] = await Promise.all([
    prisma.stockLevel.findMany({ include: { ingredient: { select: { name: true, unit: true, type: true } } } }),
    prisma.ingredient.findMany({ select: { id: true, name: true, unit: true, latestPrice: true } }),
    prisma.order.findMany({ where: { status: 'COMPLETED', createdAt: inPeriod }, select: { total: true, costTotal: true, profit: true } }),
    prisma.stockMovement.findMany({ where: { type: 'WASTE', createdAt: inPeriod }, select: { ingredientId: true, quantity: true } }),
    prisma.stockMovement.findMany({ where: { type: 'OPNAME', createdAt: inPeriod, quantity: { lt: 0 } }, select: { ingredientId: true, quantity: true } }),
    prisma.productionOrder.findMany({ where: { status: 'COMPLETED', completedAt: inPeriod }, include: { ingredient: { select: { name: true, unit: true } } } }),
    prisma.orderItemModifier.findMany({ where: { orderItem: { order: { status: 'COMPLETED', createdAt: inPeriod } } }, select: { groupName: true, optionName: true } }),
    prisma.customer.findMany({ select: { id: true, name: true, phone: true, points: true, totalSpent: true, visitCount: true, lastVisitAt: true } }),
  ]);

  const priceOf = new Map(ingredients.map((i) => [i.id, i.latestPrice || 0]));

  // 1) Stock by location
  const byLoc: Record<string, Array<{ name: string; unit: string; type: string; quantity: number }>> = { GUDANG: [], BAR: [], KITCHEN: [] };
  for (const sl of stockLevels) {
    (byLoc[sl.location] ||= []).push({ name: sl.ingredient.name, unit: sl.ingredient.unit, type: sl.ingredient.type, quantity: sl.quantity });
  }

  // 2) COGS theoretical vs leak (waste + opname shrinkage), valued at latest price
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const theoreticalCOGS = orders.reduce((s, o) => s + o.costTotal, 0);
  const wasteValue = wasteMoves.reduce((s, m) => s + Math.abs(m.quantity) * (priceOf.get(m.ingredientId) || 0), 0);
  const shrinkValue = opnameMoves.reduce((s, m) => s + Math.abs(m.quantity) * (priceOf.get(m.ingredientId) || 0), 0);
  const leakTotal = wasteValue + shrinkValue;
  const cogs = {
    revenue,
    theoreticalCOGS,
    theoreticalPct: revenue ? (theoreticalCOGS / revenue) * 100 : 0,
    wasteValue,
    shrinkValue,
    leakTotal,
    leakPct: theoreticalCOGS ? (leakTotal / theoreticalCOGS) * 100 : 0,
  };

  // 3) Production variance
  const productionVariance = prodOrders.map((p) => {
    const actual = p.actualYield ?? p.plannedYield;
    const variance = actual - p.plannedYield;
    return {
      name: p.ingredient.name, unit: p.ingredient.unit,
      planned: p.plannedYield, actual, variance,
      variancePct: p.plannedYield ? (variance / p.plannedYield) * 100 : 0,
      date: p.completedAt,
    };
  }).filter((p) => p.variance !== 0);

  // 4) Modifier insights
  const modTally = new Map<string, number>();
  for (const m of modifiers) {
    const key = `${m.groupName}||${m.optionName}`;
    modTally.set(key, (modTally.get(key) || 0) + 1);
  }
  const modifierInsights = Array.from(modTally.entries())
    .map(([k, count]) => { const [group, option] = k.split('||'); return { group, option, count }; })
    .sort((a, b) => b.count - a.count);

  // 5) CRM
  const members = customers.filter((c) => c.phone);
  const crm = {
    totalCustomers: customers.length,
    members: members.length,
    repeatCustomers: customers.filter((c) => c.visitCount > 1).length,
    repeatRate: customers.length ? (customers.filter((c) => c.visitCount > 1).length / customers.length) * 100 : 0,
    pointsOutstanding: customers.reduce((s, c) => s + c.points, 0),
    topCustomers: [...customers].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5)
      .map((c) => ({ name: c.name, phone: c.phone, totalSpent: c.totalSpent, visitCount: c.visitCount, points: c.points })),
  };

  return success({ period, stockByLocation: byLoc, cogs, productionVariance, modifierInsights, crm });
}, ['SUPER_ADMIN']);
