import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { getLowStockAlerts } from '@/lib/stock-engine';

export const GET = withAuth(async (req, user) => {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || 'today';

  // Date range
  const now = new Date();
  let from: Date;
  switch (period) {
    case 'today':
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      from = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const where: Record<string, unknown> = {
    status: 'COMPLETED',
    createdAt: { gte: from, lte: now },
  };

  // Core metrics
  const orders = await prisma.order.findMany({ where });
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const totalCOGS = orders.reduce((s, o) => s + o.costTotal, 0);
  const totalProfit = orders.reduce((s, o) => s + o.profit, 0);
  const totalTransactions = orders.length;
  const avgOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  // Product performance
  const orderItems = await prisma.orderItem.findMany({
    where: { order: where },
    include: { product: { include: { category: true } } },
  });

  const productMap = new Map<string, { name: string; category: string; qty: number; revenue: number; cost: number; profit: number }>();
  for (const item of orderItems) {
    const key = item.productId;
    const existing = productMap.get(key) || {
      name: item.product.name,
      category: item.product.category?.name || 'Uncategorized',
      qty: 0,
      revenue: 0,
      cost: 0,
      profit: 0,
    };
    existing.qty += item.quantity;
    existing.revenue += item.subtotal;
    existing.cost += item.cost * item.quantity;
    existing.profit += item.subtotal - item.cost * item.quantity;
    productMap.set(key, existing);
  }

  const productPerformance = Array.from(productMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.revenue - a.revenue);

  // Menu engineering classification
  const avgQty = productPerformance.length > 0
    ? productPerformance.reduce((s, p) => s + p.qty, 0) / productPerformance.length
    : 0;
  const avgMargin = productPerformance.length > 0
    ? productPerformance.reduce((s, p) => s + (p.revenue > 0 ? p.profit / p.revenue : 0), 0) / productPerformance.length
    : 0;

  const menuEngineering = productPerformance.map(p => {
    const margin = p.revenue > 0 ? p.profit / p.revenue : 0;
    const highPop = p.qty >= avgQty;
    const highMargin = margin >= avgMargin;

    let classification: string;
    if (highPop && highMargin) classification = 'star';
    else if (highPop && !highMargin) classification = 'plowhorse';
    else if (!highPop && highMargin) classification = 'puzzle';
    else classification = 'dog';

    return { ...p, margin, classification };
  });

  // Peak hours analysis
  const hourMap = new Map<number, { count: number; revenue: number }>();
  for (const order of orders) {
    const hour = new Date(order.createdAt).getHours();
    const existing = hourMap.get(hour) || { count: 0, revenue: 0 };
    existing.count++;
    existing.revenue += order.total;
    hourMap.set(hour, existing);
  }
  const peakHours = Array.from(hourMap.entries())
    .map(([hour, data]) => ({ hour, ...data }))
    .sort((a, b) => b.count - a.count);

  // Daily revenue trend
  const dailyMap = new Map<string, { revenue: number; cost: number; profit: number; orders: number }>();
  for (const order of orders) {
    const day = new Date(order.createdAt).toISOString().slice(0, 10);
    const existing = dailyMap.get(day) || { revenue: 0, cost: 0, profit: 0, orders: 0 };
    existing.revenue += order.total;
    existing.cost += order.costTotal;
    existing.profit += order.profit;
    existing.orders++;
    dailyMap.set(day, existing);
  }
  const dailyTrend = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Low stock alerts
  const alerts: unknown[] = await getLowStockAlerts();

  return success({
    summary: {
      totalRevenue,
      totalCOGS,
      totalProfit,
      totalTransactions,
      avgOrderValue,
      profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
    },
    productPerformance: productPerformance.slice(0, 20),
    menuEngineering,
    peakHours,
    dailyTrend,
    alerts,
    period,
  });
}, ['SUPER_ADMIN']);
