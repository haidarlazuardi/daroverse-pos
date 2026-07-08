import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES } from '@/lib/auth';
import { StockLocation } from '@prisma/client';

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || 'month';
  const now  = new Date();
  const from =
    period === 'today' ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
    : period === 'week' ? new Date(now.getTime() - 7 * 864e5)
    : period === 'all'  ? new Date(0)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const inPeriod = { gte: from, lte: now };

  // 4 weeks ago for usage calculation
  const fourWeeksAgo = new Date(now.getTime() - 28 * 864e5);

  const [stockLevels, ingredients, orders, wasteMoves, opnameMoves, prodOrders, modifiers, customers, usageMoves] = await Promise.all([
    prisma.stockLevel.findMany({ include: { ingredient: { select: { name: true, unit: true, type: true } } } }),
    prisma.ingredient.findMany({ where: { active: true }, select: { id: true, name: true, unit: true, latestPrice: true, minStock: true, purchaseUnit: true, conversionRate: true } }),
    prisma.order.findMany({ where: { status: 'COMPLETED', createdAt: inPeriod }, select: { total: true, costTotal: true, profit: true } }),
    prisma.stockMovement.findMany({ where: { type: 'WASTE', createdAt: inPeriod }, select: { ingredientId: true, quantity: true } }),
    prisma.stockMovement.findMany({ where: { type: 'OPNAME', createdAt: inPeriod, quantity: { lt: 0 } }, select: { ingredientId: true, quantity: true } }),
    prisma.productionOrder.findMany({ where: { status: 'COMPLETED', completedAt: inPeriod }, include: { ingredient: { select: { name: true, unit: true } } } }),
    prisma.orderItemModifier.findMany({ where: { orderItem: { order: { status: 'COMPLETED', createdAt: inPeriod } } }, select: { groupName: true, optionName: true } }),
    prisma.customer.findMany({ select: { id: true, name: true, phone: true, points: true, totalSpent: true, visitCount: true, lastVisitAt: true } }),
    // Usage = deductions from orders (SALE) + production (PRODUCTION) over 4 weeks for forecasting
    prisma.stockMovement.findMany({ where: { type: { in: ['SALE','PRODUCTION'] }, quantity: { lt: 0 }, createdAt: { gte: fourWeeksAgo } }, select: { ingredientId: true, quantity: true } }),
  ]);

  const priceOf    = new Map(ingredients.map(i => [i.id, i.latestPrice || 0]));
  const minStockOf = new Map(ingredients.map(i => [i.id, i.minStock || 0]));

  // 1) Stock by location
  const byLoc: Record<string, Array<{ name: string; unit: string; type: string; quantity: number }>> = { GUDANG: [], BAR: [], KITCHEN: [] };
  for (const sl of stockLevels) (byLoc[sl.location] ||= []).push({ name: sl.ingredient.name, unit: sl.ingredient.unit, type: sl.ingredient.type, quantity: sl.quantity });

  // Current total stock per ingredient
  const currentStock = new Map<string, number>();
  for (const sl of stockLevels) currentStock.set(sl.ingredientId, (currentStock.get(sl.ingredientId) || 0) + sl.quantity);

  // 2) COGS vs leak
  const revenue          = orders.reduce((s, o) => s + o.total, 0);
  const theoreticalCOGS  = orders.reduce((s, o) => s + o.costTotal, 0);
  const wasteValue       = wasteMoves.reduce((s, m) => s + Math.abs(m.quantity) * (priceOf.get(m.ingredientId) || 0), 0);
  const shrinkValue      = opnameMoves.reduce((s, m) => s + Math.abs(m.quantity) * (priceOf.get(m.ingredientId) || 0), 0);
  const leakTotal        = wasteValue + shrinkValue;
  const cogs = { revenue, theoreticalCOGS, theoreticalPct: revenue ? theoreticalCOGS/revenue*100 : 0, wasteValue, shrinkValue, leakTotal, leakPct: theoreticalCOGS ? leakTotal/theoreticalCOGS*100 : 0 };

  // 3) Production variance
  const productionVariance = prodOrders.map(p => {
    const actual   = p.actualYield ?? p.plannedYield;
    const variance = actual - p.plannedYield;
    return { name: p.ingredient.name, unit: p.ingredient.unit, planned: p.plannedYield, actual, variance, variancePct: p.plannedYield ? variance/p.plannedYield*100 : 0, date: p.completedAt };
  }).filter(p => p.variance !== 0);

  // 4) Modifier insights
  const modTally = new Map<string, number>();
  for (const m of modifiers) { const k = `${m.groupName}||${m.optionName}`; modTally.set(k, (modTally.get(k)||0)+1); }
  const modifierInsights = Array.from(modTally.entries()).map(([k,count]) => { const [group,option] = k.split('||'); return {group,option,count}; }).sort((a,b) => b.count-a.count);

  // 5) CRM
  const members = customers.filter(c => c.phone);
  const crm = {
    totalCustomers: customers.length, members: members.length,
    repeatCustomers: customers.filter(c => c.visitCount > 1).length,
    repeatRate: customers.length ? customers.filter(c => c.visitCount > 1).length/customers.length*100 : 0,
    pointsOutstanding: customers.reduce((s,c) => s+c.points, 0),
    topCustomers: [...customers].sort((a,b) => b.totalSpent-a.totalSpent).slice(0,5).map(c => ({ name:c.name, phone:c.phone, totalSpent:c.totalSpent, visitCount:c.visitCount, points:c.points })),
  };

  // 6) Reorder suggestions (Phase 3 intelligence)
  // Weekly avg usage from last 4 weeks, suggest PO qty for 2 weeks buffer
  const weeklyUsage = new Map<string, number>();
  for (const m of usageMoves) {
    weeklyUsage.set(m.ingredientId, (weeklyUsage.get(m.ingredientId)||0) + Math.abs(m.quantity));
  }
  // Divide by 4 to get weekly average
  for (const [id, total] of weeklyUsage) weeklyUsage.set(id, total/4);

  const reorderSuggestions = ingredients
    .map(ing => {
      const stock      = currentStock.get(ing.id) || 0;
      const minStock   = ing.minStock || 0;
      const weeklyAvg  = weeklyUsage.get(ing.id) || 0;
      const daysLeft   = weeklyAvg > 0 ? (stock / weeklyAvg) * 7 : null;
      const isLow      = stock <= minStock;
      const suggest2wk = Math.ceil(weeklyAvg * 2); // 2-week buffer
      const inPurchaseUnit = ing.purchaseUnit && ing.conversionRate && suggest2wk > 0
        ? Math.ceil(suggest2wk / ing.conversionRate) + ' ' + ing.purchaseUnit
        : null;

      return { id: ing.id, name: ing.name, unit: ing.unit, purchaseUnit: ing.purchaseUnit, conversionRate: ing.conversionRate, currentStock: stock, minStock, weeklyAvg: Math.round(weeklyAvg*10)/10, daysLeft: daysLeft ? Math.round(daysLeft) : null, isLow, suggestQty: suggest2wk, suggestPurchaseUnit: inPurchaseUnit, latestPrice: ing.latestPrice, estimatedCost: suggest2wk * ing.latestPrice };
    })
    .filter(i => i.isLow || (i.daysLeft !== null && i.daysLeft < 14))
    .sort((a, b) => {
      // Critical (out of stock) first, then by days left
      if (a.currentStock === 0 && b.currentStock > 0) return -1;
      if (b.currentStock === 0 && a.currentStock > 0) return 1;
      return (a.daysLeft ?? 999) - (b.daysLeft ?? 999);
    });

  return success({ period, stockByLocation: byLoc, cogs, productionVariance, modifierInsights, crm, reorderSuggestions });
}, ADMIN_ROLES);
