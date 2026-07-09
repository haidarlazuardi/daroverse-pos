export const dynamic = 'force-dynamic';

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

  const [stockLevels, ingredients, orders, wasteMoves, opnameMoves, prodOrders, modifiers, customers, usageMoves, ordersWithItems, allOrders4w] = await Promise.all([
    prisma.stockLevel.findMany({ include: { ingredient: { select: { name: true, unit: true, type: true } } } }),
    prisma.ingredient.findMany({ where: { active: true }, select: { id: true, name: true, unit: true, latestPrice: true, minStock: true, purchaseUnit: true, conversionRate: true } }),
    prisma.order.findMany({ where: { status: 'COMPLETED', createdAt: inPeriod }, select: { total: true, costTotal: true, profit: true } }),
    prisma.stockMovement.findMany({ where: { type: 'WASTE', createdAt: inPeriod }, select: { ingredientId: true, quantity: true } }),
    prisma.stockMovement.findMany({ where: { type: 'OPNAME', createdAt: inPeriod, quantity: { lt: 0 } }, select: { ingredientId: true, quantity: true } }),
    prisma.productionOrder.findMany({ where: { status: 'COMPLETED', completedAt: inPeriod }, include: { ingredient: { select: { name: true, unit: true } } } }),
    prisma.orderItemModifier.findMany({ where: { orderItem: { order: { status: 'COMPLETED', createdAt: inPeriod } } }, select: { groupName: true, optionName: true } }),
    prisma.customer.findMany({ select: { id: true, name: true, phone: true, points: true, totalSpent: true, visitCount: true, lastVisitAt: true, createdAt: true } }),
    prisma.stockMovement.findMany({ where: { type: { in: ['SALE','PRODUCTION'] }, quantity: { lt: 0 }, createdAt: { gte: fourWeeksAgo } }, select: { ingredientId: true, quantity: true } }),
    // For menu engineering & hourly — needs items + category
    prisma.order.findMany({
      where: { status: 'COMPLETED', createdAt: inPeriod },
      select: {
        createdAt: true,
        items: {
          select: {
            quantity: true, unitPrice: true, costPrice: true,
            product: { select: { id: true, name: true, category: { select: { id: true, name: true, color: true } } } },
          },
        },
      },
    }),
    // Last 4 weeks orders for repeat rate trend
    prisma.order.findMany({
      where: { status: 'COMPLETED', createdAt: { gte: fourWeeksAgo } },
      select: { customerId: true, createdAt: true },
    }),
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

  // ── INSIGHT 1: Jam Sibuk per Hari ──────────────────────────────────────────
  const DAY_NAMES = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  const hourlyGrid: Record<number, Record<number, { orders: number; revenue: number }>> = {};
  for (let d = 0; d < 7; d++) {
    hourlyGrid[d] = {};
    for (let h = 6; h < 23; h++) hourlyGrid[d][h] = { orders: 0, revenue: 0 };
  }
  for (const o of ordersWithItems) {
    const d = new Date(o.createdAt).getDay();
    const h = new Date(o.createdAt).getHours();
    if (hourlyGrid[d]?.[h]) {
      const rev = o.items.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0);
      hourlyGrid[d][h].orders++;
      hourlyGrid[d][h].revenue += rev;
    }
  }
  const busyByDay = DAY_NAMES.map((name, d) => {
    const hours = Object.entries(hourlyGrid[d]).map(([h, v]) => ({ hour: parseInt(h), ...v }));
    const peakHour = hours.reduce((best, h) => h.orders > best.orders ? h : best, hours[0]);
    const totalOrders = hours.reduce((s, h) => s + h.orders, 0);
    return { day: name, dayIndex: d, hours, peakHour, totalOrders };
  });

  // ── INSIGHT 2: Menu Engineering Matrix ─────────────────────────────────────
  const productStats = new Map<string, { name: string; category: string; categoryColor: string; qty: number; revenue: number; cost: number }>();
  for (const o of ordersWithItems) {
    for (const item of o.items) {
      if (!item.product) continue;
      const pid = item.product.id;
      const existing = productStats.get(pid) || { name: item.product.name, category: item.product.category?.name || 'Lainnya', categoryColor: item.product.category?.color || '#888', qty: 0, revenue: 0, cost: 0 };
      existing.qty     += item.quantity;
      existing.revenue += item.unitPrice * item.quantity;
      existing.cost    += (item.costPrice || 0) * item.quantity;
      productStats.set(pid, existing);
    }
  }
  const allProducts = Array.from(productStats.values());
  const avgQty     = allProducts.length ? allProducts.reduce((s, p) => s + p.qty, 0) / allProducts.length : 0;
  const avgMargin  = allProducts.length ? allProducts.reduce((s, p) => s + (p.revenue > 0 ? (p.revenue - p.cost) / p.revenue * 100 : 0), 0) / allProducts.length : 0;
  const menuMatrix = allProducts.map(p => {
    const margin = p.revenue > 0 ? (p.revenue - p.cost) / p.revenue * 100 : 0;
    const highPopularity = p.qty >= avgQty;
    const highMargin     = margin >= avgMargin;
    const quadrant =
      highPopularity && highMargin  ? 'star'       :
      highPopularity && !highMargin ? 'plowhorse'  :
      !highPopularity && highMargin ? 'puzzle'     : 'dog';
    return { ...p, margin, quadrant };
  }).sort((a, b) => b.revenue - a.revenue);

  // ── INSIGHT 3: Food Cost % per Kategori ────────────────────────────────────
  const catStats = new Map<string, { revenue: number; cost: number; qty: number }>();
  for (const p of allProducts) {
    const ex = catStats.get(p.category) || { revenue: 0, cost: 0, qty: 0 };
    ex.revenue += p.revenue; ex.cost += p.cost; ex.qty += p.qty;
    catStats.set(p.category, ex);
  }
  const foodCostByCategory = Array.from(catStats.entries()).map(([category, stats]) => ({
    category,
    revenue: stats.revenue,
    cost: stats.cost,
    qty: stats.qty,
    foodCostPct: stats.revenue > 0 ? stats.cost / stats.revenue * 100 : 0,
    status: stats.revenue > 0 ? (stats.cost / stats.revenue * 100 < 28 ? 'excellent' : stats.cost / stats.revenue * 100 < 35 ? 'good' : stats.cost / stats.revenue * 100 < 45 ? 'warning' : 'danger') : 'unknown',
  })).sort((a, b) => b.revenue - a.revenue);

  // ── INSIGHT 4: Repeat Rate Trend (per minggu, 4 minggu terakhir) ───────────
  const weekBuckets: Record<number, Set<string>> = { 0: new Set(), 1: new Set(), 2: new Set(), 3: new Set() };
  const weekCustomers: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const o of allOrders4w) {
    if (!o.customerId) continue;
    const weeksAgo = Math.floor((now.getTime() - new Date(o.createdAt).getTime()) / (7 * 864e5));
    if (weeksAgo >= 0 && weeksAgo < 4) {
      weekBuckets[weeksAgo].add(o.customerId);
      weekCustomers[weeksAgo]++;
    }
  }
  const repeatRateTrend = [3, 2, 1, 0].map(w => {
    const uniqueCustomers = weekBuckets[w].size;
    const totalOrders = weekCustomers[w];
    const repeatRate = uniqueCustomers > 0 ? (1 - uniqueCustomers / totalOrders) * 100 : 0;
    const weekStart = new Date(now.getTime() - (w + 1) * 7 * 864e5);
    return {
      week: `${weekStart.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}`,
      uniqueCustomers, totalOrders,
      repeatRate: Math.max(0, Math.round(repeatRate * 10) / 10),
    };
  });

  // ── INSIGHT 5: Waste-to-Revenue Ratio ──────────────────────────────────────
  const wasteByIngredient = new Map<string, { name: string; unit: string; qty: number; value: number }>();
  for (const m of wasteMoves) {
    const ing = ingredients.find(i => i.id === m.ingredientId);
    if (!ing) continue;
    const ex = wasteByIngredient.get(m.ingredientId) || { name: ing.name, unit: ing.unit, qty: 0, value: 0 };
    ex.qty   += Math.abs(m.quantity);
    ex.value += Math.abs(m.quantity) * (ing.latestPrice || 0);
    wasteByIngredient.set(m.ingredientId, ex);
  }
  const wasteBreakdown = Array.from(wasteByIngredient.values()).sort((a, b) => b.value - a.value).slice(0, 10);
  const totalRevenue2  = orders.reduce((s, o) => s + o.total, 0);
  const wasteRatio = {
    totalWasteValue: wasteValue,
    revenueInPeriod: totalRevenue2,
    ratio: totalRevenue2 > 0 ? wasteValue / totalRevenue2 * 100 : 0,
    status: totalRevenue2 > 0 ? (wasteValue / totalRevenue2 * 100 < 2 ? 'excellent' : wasteValue / totalRevenue2 * 100 < 5 ? 'good' : wasteValue / totalRevenue2 * 100 < 10 ? 'warning' : 'danger') : 'unknown',
    topWastedItems: wasteBreakdown,
  };

  return success({
    period, stockByLocation: byLoc, cogs, productionVariance, modifierInsights, crm, reorderSuggestions,
    // 5 new insights
    busyByDay, menuMatrix, foodCostByCategory, repeatRateTrend, wasteRatio,
  });
}, ADMIN_ROLES);
