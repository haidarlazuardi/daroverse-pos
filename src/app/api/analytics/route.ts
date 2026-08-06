export const dynamic = 'force-dynamic';
import { dateRangeWIB } from '@/lib/wib';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES } from '@/lib/auth';

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const type  = searchParams.get('type') || 'revenue';
  const from  = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(Date.now() - 30 * 86400000);
  const to    = searchParams.get('to')   ? new Date(searchParams.get('to')!)   : new Date();
  to.setHours(23, 59, 59, 999);

  const baseWhere = {
    status: 'COMPLETED' as any,
    createdAt: { gte: from, lte: to },
  };

  // ── Revenue trend ──────────────────────────────────────────────────────
  if (type === 'revenue') {
    const orders = await prisma.order.findMany({
      where: baseWhere,
      select: { createdAt: true, total: true, subtotal: true, costTotal: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const byDate = new Map<string, { revenue: number; cost: number; orders: number }>();
    for (const o of orders) {
      // Fix: group by WIB date, bukan UTC date
      const wibDate = new Date(o.createdAt.getTime() + 7 * 60 * 60 * 1000);
      const d = wibDate.toISOString().slice(0, 10);
      const existing = byDate.get(d) || { revenue: 0, cost: 0, orders: 0 };
      byDate.set(d, {
        revenue: existing.revenue + o.total,
        cost:    existing.cost + (o.costTotal || 0),
        orders:  existing.orders + 1,
      });
    }

    return success(Array.from(byDate.entries()).map(([date, v]) => ({
      date,
      revenue: Math.round(v.revenue),
      cost:    Math.round(v.cost),
      profit:  Math.round(v.revenue - v.cost),
      orders:  v.orders,
      margin:  v.revenue > 0 ? Math.round(((v.revenue - v.cost) / v.revenue) * 100) : 0,
    })));
  }

  // ── Best seller ────────────────────────────────────────────────────────
  if (type === 'best_seller') {
    const items = await prisma.orderItem.findMany({
      where: { order: baseWhere },
      include: { product: { select: { name: true, category: { select: { name: true } } } } },
    });

    const byProduct = new Map<string, { name: string; category: string; qty: number; revenue: number }>();
    for (const i of items) {
      const key = i.productId;
      const ex  = byProduct.get(key) || { name: i.product.name, category: i.product.category?.name || '', qty: 0, revenue: 0 };
      byProduct.set(key, { ...ex, qty: ex.qty + i.quantity, revenue: ex.revenue + i.subtotal });
    }

    return success(Array.from(byProduct.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 20));
  }

  // ── Peak hours ─────────────────────────────────────────────────────────
  if (type === 'peak_hours') {
    const orders = await prisma.order.findMany({
      where: baseWhere,
      select: { createdAt: true, total: true },
    });

    const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0, revenue: 0 }));
    for (const o of orders) {
      // Fix: pakai WIB (UTC+7), bukan UTC
      const h = (new Date(o.createdAt).getUTCHours() + 7) % 24;
      byHour[h].orders++;
      byHour[h].revenue += o.total;
    }

    return success(byHour.map(h => ({ ...h, revenue: Math.round(h.revenue) })));
  }

  // ── Category breakdown ─────────────────────────────────────────────────
  if (type === 'category') {
    const items = await prisma.orderItem.findMany({
      where: { order: baseWhere },
      include: { product: { select: { category: { select: { name: true, color: true } } } } },
    });

    const byCategory = new Map<string, { name: string; color: string; qty: number; revenue: number }>();
    for (const i of items) {
      const cat = i.product.category?.name || 'Lainnya';
      const ex  = byCategory.get(cat) || { name: cat, color: i.product.category?.color || '#888', qty: 0, revenue: 0 };
      byCategory.set(cat, { ...ex, qty: ex.qty + i.quantity, revenue: ex.revenue + i.subtotal });
    }

    return success(Array.from(byCategory.values()).sort((a, b) => b.revenue - a.revenue));
  }

  // ── Payment method split ───────────────────────────────────────────────
  if (type === 'payment') {
    const payments = await prisma.payment.findMany({
      where: { order: baseWhere },
      select: { method: true, amount: true },
    });

    const byMethod = new Map<string, { method: string; count: number; amount: number }>();
    for (const p of payments) {
      const ex = byMethod.get(p.method) || { method: p.method, count: 0, amount: 0 };
      byMethod.set(p.method, { ...ex, count: ex.count + 1, amount: ex.amount + p.amount });
    }

    return success(Array.from(byMethod.values()).map(v => ({ ...v, amount: Math.round(v.amount) })));
  }

  // ── Customer retention ─────────────────────────────────────────────────
  if (type === 'retention') {
    const orders = await prisma.order.findMany({
      where: { ...baseWhere, customerId: { not: null } },
      select: { customerId: true, createdAt: true },
    });

    const customerOrders = new Map<string, number>();
    for (const o of orders) {
      customerOrders.set(o.customerId!, (customerOrders.get(o.customerId!) || 0) + 1);
    }

    const newCustomers    = Array.from(customerOrders.values()).filter(c => c === 1).length;
    const repeatCustomers = Array.from(customerOrders.values()).filter(c => c > 1).length;
    const totalOrders     = orders.length;
    const withCustomer    = orders.filter(o => o.customerId).length;

    return success({ newCustomers, repeatCustomers, totalOrders, withCustomer, anonymous: totalOrders - withCustomer });
  }

  // ── Summary (for dashboard) ────────────────────────────────────────────
  if (type === 'summary') {
    const [orders, expenses, poValue] = await Promise.all([
      prisma.order.findMany({ where: baseWhere, select: { total: true, costTotal: true } }),
      prisma.expense.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { amount: true } }),
      prisma.purchaseOrder.findMany({ where: { status: 'COMPLETED' as any, createdAt: { gte: from, lte: to } }, select: { totalAmount: true } }),
    ]);

    const revenue  = orders.reduce((s, o) => s + o.total, 0);
    const cogs     = orders.reduce((s, o) => s + (o.costTotal || 0), 0);
    // Fix: exclude PURCHASE expenses dari netProfit — sudah masuk COGS
    const opExpenses = expenses.filter((e: any) => e.category !== 'PURCHASE').reduce((s, e) => s + e.amount, 0);
    const purchaseExp = expenses.filter((e: any) => e.category === 'PURCHASE').reduce((s, e) => s + e.amount, 0);
    const expense  = expenses.reduce((s, e) => s + e.amount, 0);
    const purchase = poValue.reduce((s, p) => s + p.totalAmount, 0);

    return success({
      revenue:     Math.round(revenue),
      cogs:        Math.round(cogs),
      grossProfit: Math.round(revenue - cogs),
      grossMargin: revenue > 0 ? Math.round(((revenue - cogs) / revenue) * 100) : 0,
      netProfit:   Math.round(revenue - cogs - opExpenses), // hanya operational expenses
      orders:      orders.length,
      avgOrder:    orders.length > 0 ? Math.round(revenue / orders.length) : 0,
      expense:     Math.round(expense),
      purchase:    Math.round(purchase),
    });
  }

  // ── Transactions list ──────────────────────────────────────────────────────
  if (type === 'transactions') {
    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: from, lte: to }, status: { in: ['COMPLETED', 'OPEN', 'VOIDED'] } },
      include: {
        payment: { select: { method: true } },
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const revenue = orders.filter(o => o.status === 'COMPLETED').reduce((s, o) => s + o.total, 0);
    const avgOrder = orders.filter(o => o.status === 'COMPLETED').length > 0
      ? revenue / orders.filter(o => o.status === 'COMPLETED').length : 0;
    return success({ orders, revenue: Math.round(revenue), avgOrder: Math.round(avgOrder) });
  }

  // ── Products performance ───────────────────────────────────────────────────
  if (type === 'products') {
    const items = await prisma.orderItem.findMany({
      where: { order: { status: 'COMPLETED', createdAt: { gte: from, lte: to } } },
      include: { product: { include: { category: true } } },
    });
    const map = new Map<string, { name: string; category: string; qty: number; revenue: number }>();
    for (const item of items) {
      const key = item.productId;
      const ex = map.get(key) || { name: item.product?.name || '—', category: item.product?.category?.name || '—', qty: 0, revenue: 0 };
      ex.qty += item.quantity;
      ex.revenue += item.subtotal;
      map.set(key, ex);
    }
    const totalRevenue = [...map.values()].reduce((s, p) => s + p.revenue, 0);
    const products = [...map.entries()]
      .map(([productId, p]) => ({ productId, ...p, revenuePct: totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
    return success({ products, totalRevenue: Math.round(totalRevenue) });
  }

  // ── Payment methods ────────────────────────────────────────────────────────
  if (type === 'payments') {
    const payments = await prisma.payment.findMany({
      where: { order: { status: 'COMPLETED', createdAt: { gte: from, lte: to } } },
      select: { method: true, amount: true },
    });
    const map = new Map<string, { total: number; count: number }>();
    for (const p of payments) {
      const ex = map.get(p.method) || { total: 0, count: 0 };
      ex.total += p.amount;
      ex.count += 1;
      map.set(p.method, ex);
    }
    const grandTotal = [...map.values()].reduce((s, m) => s + m.total, 0);
    const methods = [...map.entries()].map(([method, m]) => ({
      method, total: Math.round(m.total), count: m.count,
      pct: grandTotal > 0 ? (m.total / grandTotal) * 100 : 0,
    })).sort((a, b) => b.total - a.total);
    return success({ methods, grandTotal: Math.round(grandTotal) });
  }

  // ── Expenses ───────────────────────────────────────────────────────────────
  if (type === 'expenses') {
    const items = await prisma.expense.findMany({
      where: { createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: 'desc' },
    });
    const catMap = new Map<string, { total: number; count: number }>();
    for (const e of items) {
      const ex = catMap.get(e.category) || { total: 0, count: 0 };
      ex.total += e.amount;
      ex.count += 1;
      catMap.set(e.category, ex);
    }
    const categories = [...catMap.entries()].map(([category, c]) => ({ category, ...c, total: Math.round(c.total) }))
      .sort((a, b) => b.total - a.total);
    const grandTotal = items.reduce((s, e) => s + e.amount, 0);
    return success({ categories, items, grandTotal: Math.round(grandTotal) });
  }

  return error('type tidak valid');
}, ADMIN_ROLES);
