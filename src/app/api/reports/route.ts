import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';

export const GET = withAuth(async (req, user) => {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'summary'; // summary | monthly | ytd | category | payment | comparison | daily | product
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const month = searchParams.get('month'); // YYYY-MM
  const year = searchParams.get('year');   // YYYY

  // ─── Build date filter ─────────────────────────────
  let dateFrom: Date;
  let dateTo: Date;
  const now = new Date();

  if (from && to) {
    dateFrom = new Date(from);
    dateTo = new Date(to + 'T23:59:59.999Z');
  } else if (month) {
    const [y, m] = month.split('-').map(Number);
    dateFrom = new Date(y, m - 1, 1);
    dateTo = new Date(y, m, 0, 23, 59, 59, 999); // Last day of month
  } else if (year) {
    dateFrom = new Date(parseInt(year), 0, 1);
    dateTo = new Date(parseInt(year), 11, 31, 23, 59, 59, 999);
  } else {
    // Default: current month
    dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    dateTo = now;
  }

  const baseWhere: Record<string, unknown> = {
    status: 'COMPLETED',
    createdAt: { gte: dateFrom, lte: dateTo },
  };

  // ─── Fetch orders once ─────────────────────────────
  const orders = await prisma.order.findMany({
    where: baseWhere,
    include: {
      items: { include: { product: { include: { category: true } } } },
      payment: true,
      user: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const totalCOGS = orders.reduce((s, o) => s + o.costTotal, 0);
  const totalProfit = orders.reduce((s, o) => s + o.profit, 0);
  const totalDiscount = orders.reduce((s, o) => s + o.discount, 0);
  const totalTax = orders.reduce((s, o) => s + o.tax, 0);
  const totalTransactions = orders.length;
  const avgOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  // ─── TYPE: summary ─────────────────────────────────
  if (type === 'summary') {
    return success({
      period: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
      summary: {
        totalRevenue,
        totalCOGS,
        totalProfit,
        totalDiscount,
        totalTax,
        totalTransactions,
        avgOrderValue,
        profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
        avgDailyRevenue: totalTransactions > 0
          ? totalRevenue / Math.max(1, Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24)))
          : 0,
        avgDailyTransactions: totalTransactions > 0
          ? totalTransactions / Math.max(1, Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24)))
          : 0,
      },
    });
  }

  // ─── TYPE: daily ───────────────────────────────────
  if (type === 'daily') {
    const dailyMap = new Map<string, {
      date: string; revenue: number; cogs: number; profit: number;
      transactions: number; discount: number; tax: number; avgOrder: number;
    }>();

    for (const order of orders) {
      const day = new Date(order.createdAt).toISOString().slice(0, 10);
      const existing = dailyMap.get(day) || { date: day, revenue: 0, cogs: 0, profit: 0, transactions: 0, discount: 0, tax: 0, avgOrder: 0 };
      existing.revenue += order.total;
      existing.cogs += order.costTotal;
      existing.profit += order.profit;
      existing.transactions++;
      existing.discount += order.discount;
      existing.tax += order.tax;
      dailyMap.set(day, existing);
    }

    const daily = Array.from(dailyMap.values())
      .map(d => ({ ...d, avgOrder: d.transactions > 0 ? d.revenue / d.transactions : 0 }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return success({
      period: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
      summary: { totalRevenue, totalCOGS, totalProfit, totalTransactions, avgOrderValue },
      daily,
    });
  }

  // ─── TYPE: monthly ─────────────────────────────────
  if (type === 'monthly') {
    const monthlyMap = new Map<string, {
      month: string; revenue: number; cogs: number; profit: number;
      transactions: number; discount: number; tax: number;
    }>();

    for (const order of orders) {
      const m = new Date(order.createdAt).toISOString().slice(0, 7); // YYYY-MM
      const existing = monthlyMap.get(m) || { month: m, revenue: 0, cogs: 0, profit: 0, transactions: 0, discount: 0, tax: 0 };
      existing.revenue += order.total;
      existing.cogs += order.costTotal;
      existing.profit += order.profit;
      existing.transactions++;
      existing.discount += order.discount;
      existing.tax += order.tax;
      monthlyMap.set(m, existing);
    }

    const monthly = Array.from(monthlyMap.values())
      .map(m => ({
        ...m,
        avgOrder: m.transactions > 0 ? m.revenue / m.transactions : 0,
        profitMargin: m.revenue > 0 ? (m.profit / m.revenue) * 100 : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return success({
      period: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
      summary: { totalRevenue, totalCOGS, totalProfit, totalTransactions },
      monthly,
    });
  }

  // ─── TYPE: ytd ─────────────────────────────────────
  if (type === 'ytd') {
    const ytdYear = year ? parseInt(year) : now.getFullYear();
    const ytdFrom = new Date(ytdYear, 0, 1);
    const ytdTo = new Date(ytdYear, 11, 31, 23, 59, 59, 999);

    const ytdWhere: Record<string, unknown> = {
      status: 'COMPLETED',
      createdAt: { gte: ytdFrom, lte: ytdTo > now ? now : ytdTo },
    };

    const ytdOrders = await prisma.order.findMany({
      where: ytdWhere,
      include: { payment: true },
      orderBy: { createdAt: 'asc' },
    });

    // Monthly breakdown for the year
    const monthlyBreakdown: Array<{
      month: string; label: string; revenue: number; cogs: number;
      profit: number; transactions: number; profitMargin: number;
    }> = [];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let m = 0; m < 12; m++) {
      const monthOrders = ytdOrders.filter(o => new Date(o.createdAt).getMonth() === m);
      const rev = monthOrders.reduce((s, o) => s + o.total, 0);
      const cogs = monthOrders.reduce((s, o) => s + o.costTotal, 0);
      const prof = monthOrders.reduce((s, o) => s + o.profit, 0);
      monthlyBreakdown.push({
        month: `${ytdYear}-${String(m + 1).padStart(2, '0')}`,
        label: monthNames[m],
        revenue: rev,
        cogs,
        profit: prof,
        transactions: monthOrders.length,
        profitMargin: rev > 0 ? (prof / rev) * 100 : 0,
      });
    }

    const ytdRevenue = ytdOrders.reduce((s, o) => s + o.total, 0);
    const ytdCOGS = ytdOrders.reduce((s, o) => s + o.costTotal, 0);
    const ytdProfit = ytdOrders.reduce((s, o) => s + o.profit, 0);
    const ytdTx = ytdOrders.length;

    // Cumulative running total
    let cumRevenue = 0;
    const cumulative = monthlyBreakdown.map(m => {
      cumRevenue += m.revenue;
      return { ...m, cumulativeRevenue: cumRevenue };
    });

    return success({
      year: ytdYear,
      summary: {
        totalRevenue: ytdRevenue,
        totalCOGS: ytdCOGS,
        totalProfit: ytdProfit,
        totalTransactions: ytdTx,
        avgMonthlyRevenue: ytdRevenue / Math.max(1, cumulative.filter(m => m.transactions > 0).length),
        profitMargin: ytdRevenue > 0 ? (ytdProfit / ytdRevenue) * 100 : 0,
      },
      monthly: cumulative,
    });
  }

  // ─── TYPE: category ────────────────────────────────
  if (type === 'category') {
    const catMap = new Map<string, {
      categoryId: string; name: string; color: string;
      revenue: number; cogs: number; profit: number; qty: number; transactions: Set<string>;
    }>();

    for (const order of orders) {
      for (const item of order.items) {
        const catId = item.product.categoryId;
        const existing = catMap.get(catId) || {
          categoryId: catId,
          name: item.product.category?.name || 'Uncategorized',
          color: item.product.category?.color || '#94a3b8',
          revenue: 0, cogs: 0, profit: 0, qty: 0, transactions: new Set<string>(),
        };
        existing.revenue += item.subtotal;
        existing.cogs += item.cost * item.quantity;
        existing.profit += item.subtotal - item.cost * item.quantity;
        existing.qty += item.quantity;
        existing.transactions.add(order.id);
        catMap.set(catId, existing);
      }
    }

    const categories = Array.from(catMap.values())
      .map(c => ({
        categoryId: c.categoryId,
        name: c.name,
        color: c.color,
        revenue: c.revenue,
        cogs: c.cogs,
        profit: c.profit,
        qty: c.qty,
        transactions: c.transactions.size,
        profitMargin: c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0,
        revenueShare: totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return success({
      period: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
      summary: { totalRevenue, totalTransactions },
      categories,
    });
  }

  // ─── TYPE: payment ─────────────────────────────────
  if (type === 'payment') {
    const payMap = new Map<string, { method: string; count: number; total: number }>();

    for (const order of orders) {
      if (!order.payment) continue;
      const method = order.payment.method;
      const existing = payMap.get(method) || { method, count: 0, total: 0 };
      existing.count++;
      existing.total += order.total;
      payMap.set(method, existing);
    }

    const payments = Array.from(payMap.values())
      .map(p => ({
        ...p,
        share: totalRevenue > 0 ? (p.total / totalRevenue) * 100 : 0,
        avgTransaction: p.count > 0 ? p.total / p.count : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Daily payment breakdown
    const dailyPayMap = new Map<string, Record<string, number>>();
    for (const order of orders) {
      if (!order.payment) continue;
      const day = new Date(order.createdAt).toISOString().slice(0, 10);
      const existing = dailyPayMap.get(day) || {};
      existing[order.payment.method] = (existing[order.payment.method] || 0) + order.total;
      dailyPayMap.set(day, existing);
    }

    const dailyPayments = Array.from(dailyPayMap.entries())
      .map(([date, methods]) => ({ date, ...methods }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return success({
      period: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
      summary: { totalRevenue, totalTransactions },
      payments,
      dailyPayments,
    });
  }

  // ─── TYPE: comparison ──────────────────────────────
  if (type === 'comparison') {
    // Compare current period vs previous equal-length period
    const durationMs = Math.max(dateTo.getTime() - dateFrom.getTime(), 86400000); // Minimum 1 day
    const prevFrom = new Date(dateFrom.getTime() - durationMs);
    const prevTo = new Date(dateFrom.getTime() - 1);

    const prevWhere: Record<string, unknown> = {
      status: 'COMPLETED',
      createdAt: { gte: prevFrom, lte: prevTo },
    };

    const prevOrders = await prisma.order.findMany({ where: prevWhere });

    const prevRevenue = prevOrders.reduce((s, o) => s + o.total, 0);
    const prevCOGS = prevOrders.reduce((s, o) => s + o.costTotal, 0);
    const prevProfit = prevOrders.reduce((s, o) => s + o.profit, 0);
    const prevTx = prevOrders.length;
    const prevAvg = prevTx > 0 ? prevRevenue / prevTx : 0;

    const pctChange = (current: number, previous: number) =>
      previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;

    return success({
      current: {
        period: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
        revenue: totalRevenue,
        cogs: totalCOGS,
        profit: totalProfit,
        transactions: totalTransactions,
        avgOrderValue,
        profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
      },
      previous: {
        period: { from: prevFrom.toISOString(), to: prevTo.toISOString() },
        revenue: prevRevenue,
        cogs: prevCOGS,
        profit: prevProfit,
        transactions: prevTx,
        avgOrderValue: prevAvg,
        profitMargin: prevRevenue > 0 ? (prevProfit / prevRevenue) * 100 : 0,
      },
      changes: {
        revenue: pctChange(totalRevenue, prevRevenue),
        cogs: pctChange(totalCOGS, prevCOGS),
        profit: pctChange(totalProfit, prevProfit),
        transactions: pctChange(totalTransactions, prevTx),
        avgOrderValue: pctChange(avgOrderValue, prevAvg),
      },
    });
  }

  // ─── TYPE: product ─────────────────────────────────
  if (type === 'product') {
    const prodMap = new Map<string, {
      productId: string; name: string; category: string; categoryColor: string;
      price: number; cost: number; qty: number; revenue: number; cogs: number; profit: number;
    }>();

    for (const order of orders) {
      for (const item of order.items) {
        const existing = prodMap.get(item.productId) || {
          productId: item.productId,
          name: item.product.name,
          category: item.product.category?.name || '',
          categoryColor: item.product.category?.color || '#94a3b8',
          price: item.price,
          cost: item.cost,
          qty: 0, revenue: 0, cogs: 0, profit: 0,
        };
        existing.qty += item.quantity;
        existing.revenue += item.subtotal;
        existing.cogs += item.cost * item.quantity;
        existing.profit += item.subtotal - item.cost * item.quantity;
        prodMap.set(item.productId, existing);
      }
    }

    const products = Array.from(prodMap.values())
      .map(p => ({
        ...p,
        profitMargin: p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0,
        revenueShare: totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return success({
      period: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
      summary: { totalRevenue, totalCOGS, totalProfit, totalTransactions },
      products,
    });
  }

  return error('Invalid report type. Use: summary, daily, monthly, ytd, category, payment, comparison, product');
}, ['SUPER_ADMIN']);
