import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (v: string) => {
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(row.map(v => escape(String(v ?? ''))).join(','));
  }
  return '\ufeff' + lines.join('\r\n'); // BOM for Excel UTF-8
}

export async function GET(req: NextRequest) {
  try {
    const user = requireAuth(req, ['ADMIN']);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'daily';
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const outletId = searchParams.get('outletId') || user.outletId;

    const now = new Date();
    const dateFrom = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const dateTo = to ? new Date(to + 'T23:59:59.999Z') : now;

    const baseWhere: Record<string, unknown> = {
      status: 'COMPLETED',
      createdAt: { gte: dateFrom, lte: dateTo },
    };
    if (outletId) baseWhere.outletId = outletId;

    const orders = await prisma.order.findMany({
      where: baseWhere,
      include: {
        items: { include: { product: { include: { category: true } } } },
        payment: true,
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    let csv = '';
    let filename = '';

    if (type === 'daily') {
      const dailyMap = new Map<string, any>();
      for (const o of orders) {
        const day = new Date(o.createdAt).toISOString().slice(0, 10);
        const d = dailyMap.get(day) || { date: day, revenue: 0, cogs: 0, profit: 0, transactions: 0, discount: 0, tax: 0 };
        d.revenue += o.total; d.cogs += o.costTotal; d.profit += o.profit;
        d.transactions++; d.discount += o.discount; d.tax += o.tax;
        dailyMap.set(day, d);
      }
      const rows = Array.from(dailyMap.values()).map(d => [
        d.date, d.revenue.toFixed(0), d.cogs.toFixed(0), d.profit.toFixed(0),
        String(d.transactions), d.discount.toFixed(0), d.tax.toFixed(0),
        d.transactions > 0 ? (d.revenue / d.transactions).toFixed(0) : '0',
      ]);
      csv = toCsv(['Date', 'Revenue', 'COGS', 'Profit', 'Transactions', 'Discount', 'Tax', 'Avg Order'], rows);
      filename = `daily-report-${dateFrom.toISOString().slice(0, 10)}-to-${dateTo.toISOString().slice(0, 10)}.csv`;
    }

    else if (type === 'product') {
      const prodMap = new Map<string, any>();
      for (const o of orders) {
        for (const item of o.items) {
          const p = prodMap.get(item.productId) || {
            name: item.product.name, category: item.product.category?.name || '',
            qty: 0, revenue: 0, cogs: 0, profit: 0,
          };
          p.qty += item.quantity; p.revenue += item.subtotal;
          p.cogs += item.cost * item.quantity; p.profit += item.subtotal - item.cost * item.quantity;
          prodMap.set(item.productId, p);
        }
      }
      const rows = Array.from(prodMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .map(p => [
          p.name, p.category, String(p.qty), p.revenue.toFixed(0), p.cogs.toFixed(0),
          p.profit.toFixed(0), p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(1) + '%' : '0%',
        ]);
      csv = toCsv(['Product', 'Category', 'Qty Sold', 'Revenue', 'COGS', 'Profit', 'Margin'], rows);
      filename = `product-report-${dateFrom.toISOString().slice(0, 10)}-to-${dateTo.toISOString().slice(0, 10)}.csv`;
    }

    else if (type === 'category') {
      const catMap = new Map<string, any>();
      for (const o of orders) {
        for (const item of o.items) {
          const catName = item.product.category?.name || 'Uncategorized';
          const c = catMap.get(catName) || { name: catName, revenue: 0, cogs: 0, profit: 0, qty: 0 };
          c.revenue += item.subtotal; c.cogs += item.cost * item.quantity;
          c.profit += item.subtotal - item.cost * item.quantity; c.qty += item.quantity;
          catMap.set(catName, c);
        }
      }
      const totalRev = Array.from(catMap.values()).reduce((s, c) => s + c.revenue, 0);
      const rows = Array.from(catMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .map(c => [
          c.name, String(c.qty), c.revenue.toFixed(0),
          totalRev > 0 ? ((c.revenue / totalRev) * 100).toFixed(1) + '%' : '0%',
          c.cogs.toFixed(0), c.profit.toFixed(0),
          c.revenue > 0 ? ((c.profit / c.revenue) * 100).toFixed(1) + '%' : '0%',
        ]);
      csv = toCsv(['Category', 'Qty Sold', 'Revenue', 'Share', 'COGS', 'Profit', 'Margin'], rows);
      filename = `category-report-${dateFrom.toISOString().slice(0, 10)}-to-${dateTo.toISOString().slice(0, 10)}.csv`;
    }

    else if (type === 'payment') {
      const payMap = new Map<string, any>();
      for (const o of orders) {
        if (!o.payment) continue;
        const m = payMap.get(o.payment.method) || { method: o.payment.method, count: 0, total: 0 };
        m.count++; m.total += o.total;
        payMap.set(o.payment.method, m);
      }
      const totalRev = Array.from(payMap.values()).reduce((s, p) => s + p.total, 0);
      const rows = Array.from(payMap.values()).map(p => [
        p.method, String(p.count), p.total.toFixed(0),
        totalRev > 0 ? ((p.total / totalRev) * 100).toFixed(1) + '%' : '0%',
        p.count > 0 ? (p.total / p.count).toFixed(0) : '0',
      ]);
      csv = toCsv(['Method', 'Transactions', 'Total', 'Share', 'Avg Transaction'], rows);
      filename = `payment-report-${dateFrom.toISOString().slice(0, 10)}-to-${dateTo.toISOString().slice(0, 10)}.csv`;
    }

    else if (type === 'transactions') {
      const rows = orders.map(o => [
        o.orderNumber,
        new Date(o.createdAt).toISOString().slice(0, 19).replace('T', ' '),
        o.user.name,
        String(o.items.length),
        o.subtotal.toFixed(0),
        o.discount.toFixed(0),
        o.tax.toFixed(0),
        o.total.toFixed(0),
        o.costTotal.toFixed(0),
        o.profit.toFixed(0),
        o.payment?.method || '-',
        o.status,
      ]);
      csv = toCsv(['Order#', 'DateTime', 'Cashier', 'Items', 'Subtotal', 'Discount', 'Tax', 'Total', 'COGS', 'Profit', 'Payment', 'Status'], rows);
      filename = `transactions-${dateFrom.toISOString().slice(0, 10)}-to-${dateTo.toISOString().slice(0, 10)}.csv`;
    }

    else {
      return NextResponse.json({ success: false, error: 'Invalid export type' }, { status: 400 });
    }

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    if (e instanceof AuthError) {
      return NextResponse.json({ success: false, error: e.message }, { status: e.status });
    }
    console.error('Export error:', e);
    return NextResponse.json({ success: false, error: 'Export failed' }, { status: 500 });
  }
}
