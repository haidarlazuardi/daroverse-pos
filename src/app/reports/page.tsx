'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card, StatCard, Badge, Loader, Button, Modal, formatCurrency, formatNumber } from '@/components/ui';
import { api } from '@/lib/fetch';
import clsx from 'clsx';

type ReportTab = 'summary' | 'daily' | 'monthly' | 'ytd' | 'category' | 'payment' | 'comparison' | 'product' | 'transactions';

const TABS: { key: ReportTab; label: string }[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'daily', label: 'Daily' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'ytd', label: 'Year to Date' },
  { key: 'category', label: 'Category' },
  { key: 'payment', label: 'Payment' },
  { key: 'comparison', label: 'Comparison' },
  { key: 'product', label: 'Products' },
  { key: 'transactions', label: 'Transactions' },
];

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('summary');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [txData, setTxData] = useState<any>(null);
  const [txDetail, setTxDetail] = useState<any>(null);

  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [fromDate, setFromDate] = useState(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
  const [toDate, setToDate] = useState(now.toISOString().slice(0, 10));

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      let params = `type=${tab}`;
      if (tab === 'ytd' || tab === 'monthly') params += `&year=${year}`;
      else params += `&from=${fromDate}&to=${toDate}`;
      setData(await api.get(`/api/reports?${params}`));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [tab, year, fromDate, toDate]);

  // Load transactions separately for the transactions tab
  const loadTransactions = useCallback(async () => {
    try {
      setTxData(await api.get(`/api/orders?from=${fromDate}&to=${toDate}&limit=200`));
    } catch (e) { console.error(e); }
  }, [fromDate, toDate]);

  useEffect(() => { if (tab === 'transactions') loadTransactions(); else loadReport(); }, [tab, loadReport, loadTransactions]);

  const setPreset = (preset: string) => {
    const today = new Date();
    let f: Date, t: Date = today;
    switch (preset) {
      case 'today': f = today; break;
      case 'yesterday': f = t = new Date(today.getTime() - 86400000); break;
      case 'this_week': f = new Date(today); f.setDate(today.getDate() - today.getDay()); break;
      case 'this_month': f = new Date(today.getFullYear(), today.getMonth(), 1); break;
      case 'last_month': f = new Date(today.getFullYear(), today.getMonth() - 1, 1); t = new Date(today.getFullYear(), today.getMonth(), 0); break;
      case 'this_quarter': f = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1); break;
      case 'this_year': f = new Date(today.getFullYear(), 0, 1); break;
      default: return;
    }
    setFromDate(f.toISOString().slice(0, 10));
    setToDate(t.toISOString().slice(0, 10));
  };

  const downloadExport = (exportType: string) => {
    const token = localStorage.getItem('token');
    fetch(`/api/reports/export?type=${exportType}&from=${fromDate}&to=${toDate}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error('Export failed'); return r.blob(); })
      .then(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${exportType}-${fromDate}-to-${toDate}.csv`; a.click(); })
      .catch(e => alert(e.message));
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="page-header">
          <div><h2 className="page-title">Reports</h2><p className="page-subtitle">Detailed analytics and exportable reports</p></div>
          <select onChange={e => { if (e.target.value) downloadExport(e.target.value); e.target.value = ''; }}
            className="select w-auto" defaultValue="">
            <option value="" disabled>📥 Download CSV</option>
            <option value="daily">Daily Report</option>
            <option value="product">Product Report</option>
            <option value="category">Category Report</option>
            <option value="payment">Payment Report</option>
            <option value="transactions">All Transactions</option>
          </select>
        </div>

        {/* Tabs */}
        <div className="tab-group">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={clsx('tab-item', tab === t.key ? 'tab-active' : 'tab-inactive')}>{t.label}</button>
          ))}
        </div>

        {/* Date controls */}
        <Card>
          <div className="flex flex-wrap items-end gap-4">
            {(tab === 'ytd' || tab === 'monthly') ? (
              <div>
                <label className="label">Year</label>
                <select value={year} onChange={e => setYear(e.target.value)} className="select w-auto">
                  {[0, 1, 2, 3].map(i => { const y = now.getFullYear() - i; return <option key={y} value={y}>{y}</option>; })}
                </select>
              </div>
            ) : (<>
              <div><label className="label">From</label><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="input w-auto" /></div>
              <div><label className="label">To</label><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="input w-auto" /></div>
              <div className="flex gap-1.5 flex-wrap">
                {['today', 'yesterday', 'this_week', 'this_month', 'last_month', 'this_quarter', 'this_year'].map(p => (
                  <button key={p} onClick={() => setPreset(p)} className="btn btn-sm btn-secondary capitalize">{p.replace('_', ' ')}</button>
                ))}
              </div>
            </>)}
          </div>
        </Card>

        {/* Tab Content */}
        {tab === 'transactions' ? (
          <TransactionsView data={txData} onViewDetail={setTxDetail} />
        ) : loading ? <Loader /> : !data ? (
          <div className="empty-state"><p className="empty-title">No data</p></div>
        ) : (<>
          {tab === 'summary' && <SummaryView data={data} />}
          {tab === 'daily' && <DailyView data={data} />}
          {tab === 'monthly' && <MonthlyView data={data} />}
          {tab === 'ytd' && <YTDView data={data} />}
          {tab === 'category' && <CategoryView data={data} />}
          {tab === 'payment' && <PaymentView data={data} />}
          {tab === 'comparison' && <ComparisonView data={data} />}
          {tab === 'product' && <ProductView data={data} />}
        </>)}
      </div>

      {/* Transaction Detail Modal */}
      <Modal open={!!txDetail} onClose={() => setTxDetail(null)} title={txDetail?.orderNumber || 'Order Detail'} maxWidth="max-w-2xl">
        {txDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Date:</span> {new Date(txDetail.createdAt).toLocaleString('id-ID')}</div>
              <div><span className="text-gray-500">Status:</span> <Badge variant={txDetail.status === 'COMPLETED' ? 'success' : txDetail.status === 'REFUNDED' ? 'danger' : 'default'}>{txDetail.status}</Badge></div>
              <div><span className="text-gray-500">Cashier:</span> {txDetail.user?.name || '—'}</div>
              <div><span className="text-gray-500">Payment:</span> {txDetail.payment?.method || '—'}</div>
            </div>
            <div className="border-t pt-3">
              <h4 className="font-semibold text-sm mb-2">Items</h4>
              {(txDetail.items || []).map((i: any) => (
                <div key={i.id} className="flex justify-between items-center text-sm py-2 border-b border-gray-50 last:border-0">
                  <div className="flex-1">
                    <span className="font-medium">{i.product?.name}</span>
                    <span className="text-gray-400 ml-2">x{i.quantity} @ {formatCurrency(i.price)}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold">{formatCurrency(i.subtotal)}</span>
                    <span className="text-xs text-gray-400 ml-2">cost: {formatCurrency(i.cost * i.quantity)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1.5">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(txDetail.subtotal)}</span></div>
              {txDetail.discount > 0 && <div className="flex justify-between text-red-500"><span>Discount {txDetail.discountLabel && `(${txDetail.discountLabel})`}</span><span>-{formatCurrency(txDetail.discount)}</span></div>}
              <div className="flex justify-between"><span>Tax ({(txDetail.taxRate * 100).toFixed(0)}%)</span><span>{formatCurrency(txDetail.tax)}</span></div>
              <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-2"><span>Total</span><span>{formatCurrency(txDetail.total)}</span></div>
              <div className="flex justify-between text-green-700 font-medium"><span>COGS</span><span>{formatCurrency(txDetail.costTotal)}</span></div>
              <div className="flex justify-between text-green-700 font-bold"><span>Profit</span><span>{formatCurrency(txDetail.profit)}</span></div>
              {txDetail.payment && (
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="flex justify-between"><span>Received ({txDetail.payment.method})</span><span>{formatCurrency(txDetail.payment.received)}</span></div>
                  <div className="flex justify-between"><span>Change</span><span>{formatCurrency(txDetail.payment.change)}</span></div>
                </div>
              )}
            </div>
            {txDetail.notes && <div className="info-box">Note: {txDetail.notes}</div>}
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}

// ─── Transactions View (with detail drill-down) ──────
function TransactionsView({ data, onViewDetail }: { data: any; onViewDetail: (o: any) => void }) {
  if (!data) return <Loader />;
  const orders = data.orders || [];
  return (
    <Card padding={false}><div className="table-wrapper"><table className="table">
      <thead><tr>
        <th>Order #</th><th>Date</th><th>Cashier</th><th className="center">Items</th>
        <th className="right">Subtotal</th><th className="right">Discount</th><th className="right">Total</th>
        <th className="right">COGS</th><th className="right">Profit</th><th className="center">Payment</th><th className="center">Status</th>
      </tr></thead>
      <tbody>
        {orders.map((o: any) => (
          <tr key={o.id} className="cursor-pointer" onClick={() => onViewDetail(o)}>
            <td className="mono font-medium text-green-700">{o.orderNumber}</td>
            <td className="muted text-xs">{new Date(o.createdAt).toLocaleString('id-ID')}</td>
            <td className="muted">{o.user?.name || '—'}</td>
            <td className="center muted">{o.items?.length || 0}</td>
            <td className="right">{formatCurrency(o.subtotal)}</td>
            <td className="right">{o.discount > 0 ? <span className="text-red-500">-{formatCurrency(o.discount)}</span> : '—'}</td>
            <td className="right bold">{formatCurrency(o.total)}</td>
            <td className="right muted">{formatCurrency(o.costTotal)}</td>
            <td className="right"><span className={o.profit >= 0 ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>{formatCurrency(o.profit)}</span></td>
            <td className="center"><Badge variant="info">{o.payment?.method || '—'}</Badge></td>
            <td className="center"><Badge variant={o.status === 'COMPLETED' ? 'success' : o.status === 'REFUNDED' ? 'danger' : 'default'}>{o.status}</Badge></td>
          </tr>
        ))}
      </tbody>
    </table></div>
    {orders.length === 0 && <div className="empty-state"><p className="empty-title">No transactions for this period</p></div>}
    <div className="px-6 py-3 text-sm text-gray-500 border-t">{data.total || orders.length} transactions · Click any row to view details</div>
    </Card>
  );
}

// ─── Summary View ────────────────────────────────────
function SummaryView({ data }: { data: any }) {
  const s = data.summary;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="Total Revenue" value={formatCurrency(s.totalRevenue)} />
      <StatCard label="Total COGS" value={formatCurrency(s.totalCOGS)} />
      <StatCard label="Net Profit" value={formatCurrency(s.totalProfit)} sub={`${s.profitMargin?.toFixed(1)}% margin`} />
      <StatCard label="Transactions" value={formatNumber(s.totalTransactions)} sub={`Avg ${formatCurrency(s.avgOrderValue)}`} />
      <StatCard label="Avg Daily Revenue" value={formatCurrency(s.avgDailyRevenue || 0)} />
      <StatCard label="Avg Daily Tx" value={formatNumber(Math.round(s.avgDailyTransactions || 0))} />
      <StatCard label="Discounts Given" value={formatCurrency(s.totalDiscount || 0)} />
      <StatCard label="Tax Collected" value={formatCurrency(s.totalTax || 0)} />
    </div>
  );
}

// ─── Daily View ──────────────────────────────────────
function DailyView({ data }: { data: any }) {
  const maxRev = Math.max(...(data.daily || []).map((d: any) => d.revenue), 1);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Revenue" value={formatCurrency(data.summary.totalRevenue)} />
        <StatCard label="COGS" value={formatCurrency(data.summary.totalCOGS)} />
        <StatCard label="Profit" value={formatCurrency(data.summary.totalProfit)} />
        <StatCard label="Transactions" value={formatNumber(data.summary.totalTransactions)} />
      </div>
      <Card padding={false}><div className="table-wrapper"><table className="table">
        <thead><tr><th>Date</th><th>Revenue</th><th className="right">COGS</th><th className="right">Profit</th><th className="right">Tx</th><th className="right">Avg Order</th></tr></thead>
        <tbody>
          {(data.daily || []).map((d: any) => (
            <tr key={d.date}>
              <td className="font-medium">{d.date}</td>
              <td>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${(d.revenue / maxRev) * 100}%` }} />
                  </div>
                  <span className="font-bold w-28 text-right">{formatCurrency(d.revenue)}</span>
                </div>
              </td>
              <td className="right muted">{formatCurrency(d.cogs)}</td>
              <td className="right"><span className={d.profit >= 0 ? 'text-emerald-600 font-medium' : 'text-red-600'}>{formatCurrency(d.profit)}</span></td>
              <td className="right muted">{d.transactions}</td>
              <td className="right muted">{formatCurrency(d.avgOrder)}</td>
            </tr>
          ))}
        </tbody>
        {(data.daily || []).length > 0 && <tfoot><tr className="bg-gray-50 font-bold">
          <td className="px-6 py-3 text-sm">Total</td><td className="px-6 py-3 text-sm text-right">{formatCurrency(data.summary.totalRevenue)}</td>
          <td className="px-6 py-3 text-sm text-right">{formatCurrency(data.summary.totalCOGS)}</td><td className="px-6 py-3 text-sm text-right">{formatCurrency(data.summary.totalProfit)}</td>
          <td className="px-6 py-3 text-sm text-right">{data.summary.totalTransactions}</td><td className="px-6 py-3 text-sm text-right">{formatCurrency(data.summary.avgOrderValue)}</td>
        </tr></tfoot>}
      </table></div>
      {(data.daily || []).length === 0 && <div className="empty-state"><p className="empty-title">No data</p></div>}
      </Card>
    </div>
  );
}

// ─── Monthly View ────────────────────────────────────
function MonthlyView({ data }: { data: any }) {
  const monthNames: Record<string, string> = { '01': 'January', '02': 'February', '03': 'March', '04': 'April', '05': 'May', '06': 'June', '07': 'July', '08': 'August', '09': 'September', '10': 'October', '11': 'November', '12': 'December' };
  const maxRev = Math.max(...(data.monthly || []).map((m: any) => m.revenue), 1);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Annual Revenue" value={formatCurrency(data.summary.totalRevenue)} />
        <StatCard label="Annual Profit" value={formatCurrency(data.summary.totalProfit)} />
        <StatCard label="Transactions" value={formatNumber(data.summary.totalTransactions)} />
        <StatCard label="COGS" value={formatCurrency(data.summary.totalCOGS)} />
      </div>
      <Card padding={false}><div className="table-wrapper"><table className="table">
        <thead><tr><th>Month</th><th>Revenue</th><th className="right">COGS</th><th className="right">Profit</th><th className="right">Margin</th><th className="right">Tx</th></tr></thead>
        <tbody>
          {(data.monthly || []).map((m: any) => (
            <tr key={m.month} className={m.transactions === 0 ? 'opacity-30' : ''}>
              <td className="font-medium">{monthNames[m.month.split('-')[1]] || m.month}</td>
              <td>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${(m.revenue / maxRev) * 100}%` }} />
                  </div>
                  <span className="font-bold w-28 text-right">{formatCurrency(m.revenue)}</span>
                </div>
              </td>
              <td className="right muted">{formatCurrency(m.cogs)}</td>
              <td className="right"><span className={m.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(m.profit)}</span></td>
              <td className="right">{m.transactions > 0 ? <Badge variant={m.profitMargin >= 30 ? 'success' : m.profitMargin >= 15 ? 'warning' : 'danger'}>{m.profitMargin.toFixed(1)}%</Badge> : '—'}</td>
              <td className="right muted">{m.transactions}</td>
            </tr>
          ))}
        </tbody>
      </table></div></Card>
    </div>
  );
}

// ─── YTD View ────────────────────────────────────────
function YTDView({ data }: { data: any }) {
  const maxCum = Math.max(...(data.monthly || []).map((m: any) => m.cumulativeRevenue || 0), 1);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={`YTD Revenue ${data.year}`} value={formatCurrency(data.summary.totalRevenue)} />
        <StatCard label="YTD Profit" value={formatCurrency(data.summary.totalProfit)} sub={`${data.summary.profitMargin?.toFixed(1)}% margin`} />
        <StatCard label="Transactions" value={formatNumber(data.summary.totalTransactions)} />
        <StatCard label="Avg Monthly" value={formatCurrency(data.summary.avgMonthlyRevenue || 0)} />
      </div>
      <Card>
        <h3 className="font-bold text-gray-900 mb-4">Cumulative Revenue {data.year}</h3>
        <div className="space-y-2">
          {(data.monthly || []).map((m: any) => (
            <div key={m.month} className="flex items-center gap-3 text-sm">
              <span className="text-gray-500 w-10 font-medium">{m.label}</span>
              <div className="flex-1 h-7 bg-gray-50 rounded-lg overflow-hidden relative">
                <div className="absolute inset-y-0 left-0 bg-green-100 rounded-lg" style={{ width: `${((m.cumulativeRevenue || 0) / maxCum) * 100}%` }} />
                <div className="absolute inset-y-0 left-0 bg-green-500 rounded-lg" style={{ width: `${(m.revenue / maxCum) * 100}%` }} />
              </div>
              <div className="w-44 text-right flex gap-3">
                <span className="text-gray-400 text-xs w-20">{formatCurrency(m.revenue)}</span>
                <span className="font-bold text-gray-700 text-xs w-24">{formatCurrency(m.cumulativeRevenue || 0)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-green-500 rounded" /> Monthly</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-green-100 rounded" /> Cumulative</span>
        </div>
      </Card>
      <Card padding={false}><div className="table-wrapper"><table className="table">
        <thead><tr><th>Month</th><th className="right">Revenue</th><th className="right">COGS</th><th className="right">Profit</th><th className="right">Margin</th><th className="right">Tx</th><th className="right">Cumulative</th></tr></thead>
        <tbody>
          {(data.monthly || []).map((m: any) => (
            <tr key={m.month} className={m.transactions === 0 ? 'opacity-30' : ''}>
              <td className="font-medium">{m.label} {data.year}</td>
              <td className="right bold">{formatCurrency(m.revenue)}</td>
              <td className="right muted">{formatCurrency(m.cogs)}</td>
              <td className="right"><span className={m.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(m.profit)}</span></td>
              <td className="right">{m.transactions > 0 ? <Badge variant={m.profitMargin >= 30 ? 'success' : 'warning'}>{m.profitMargin.toFixed(1)}%</Badge> : '—'}</td>
              <td className="right muted">{m.transactions}</td>
              <td className="right font-bold text-green-700">{formatCurrency(m.cumulativeRevenue || 0)}</td>
            </tr>
          ))}
        </tbody>
      </table></div></Card>
    </div>
  );
}

// ─── Category View ───────────────────────────────────
function CategoryView({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Total Revenue" value={formatCurrency(data.summary.totalRevenue)} />
        <StatCard label="Transactions" value={formatNumber(data.summary.totalTransactions)} />
      </div>
      <Card>
        <h3 className="font-bold text-gray-900 mb-3">Revenue Share</h3>
        <div className="flex h-8 rounded-xl overflow-hidden mb-3">
          {(data.categories || []).map((c: any) => (
            <div key={c.categoryId} style={{ width: `${c.revenueShare}%`, backgroundColor: c.color }} title={`${c.name}: ${c.revenueShare.toFixed(1)}%`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {(data.categories || []).map((c: any) => (
            <span key={c.categoryId} className="flex items-center gap-1.5 text-sm"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />{c.name} ({c.revenueShare.toFixed(1)}%)</span>
          ))}
        </div>
      </Card>
      <Card padding={false}><div className="table-wrapper"><table className="table">
        <thead><tr><th>Category</th><th className="right">Revenue</th><th className="right">Share</th><th className="right">COGS</th><th className="right">Profit</th><th className="right">Margin</th><th className="right">Qty</th></tr></thead>
        <tbody>
          {(data.categories || []).map((c: any) => (
            <tr key={c.categoryId}>
              <td><span className="flex items-center gap-2 font-medium"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />{c.name}</span></td>
              <td className="right bold">{formatCurrency(c.revenue)}</td>
              <td className="right muted">{c.revenueShare.toFixed(1)}%</td>
              <td className="right muted">{formatCurrency(c.cogs)}</td>
              <td className="right"><span className={c.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(c.profit)}</span></td>
              <td className="right"><Badge variant={c.profitMargin >= 30 ? 'success' : c.profitMargin >= 15 ? 'warning' : 'danger'}>{c.profitMargin.toFixed(1)}%</Badge></td>
              <td className="right muted">{formatNumber(c.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table></div></Card>
    </div>
  );
}

// ─── Payment View ────────────────────────────────────
function PaymentView({ data }: { data: any }) {
  const icons: Record<string, string> = { CASH: '💵', QRIS: '📱', CARD: '💳', TRANSFER: '🏦' };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(data.payments || []).map((p: any) => (
          <StatCard key={p.method} label={`${icons[p.method] || ''} ${p.method}`} value={formatCurrency(p.total)} sub={`${p.count} tx (${p.share.toFixed(1)}%)`} />
        ))}
      </div>
      <Card>
        <h3 className="font-bold text-gray-900 mb-3">Payment Split</h3>
        <div className="flex h-10 rounded-xl overflow-hidden">
          {(data.payments || []).map((p: any, i: number) => {
            const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6'];
            return <div key={p.method} style={{ width: `${p.share}%`, backgroundColor: colors[i % colors.length] }}
              className="flex items-center justify-center text-white text-xs font-bold">{p.share > 10 ? `${p.method} ${p.share.toFixed(0)}%` : ''}</div>;
          })}
        </div>
      </Card>
      <Card padding={false}><div className="table-wrapper"><table className="table">
        <thead><tr><th>Method</th><th className="right">Total</th><th className="right">Transactions</th><th className="right">Share</th><th className="right">Avg Tx</th></tr></thead>
        <tbody>
          {(data.payments || []).map((p: any) => (
            <tr key={p.method}>
              <td className="font-medium">{icons[p.method]} {p.method}</td>
              <td className="right bold">{formatCurrency(p.total)}</td>
              <td className="right muted">{formatNumber(p.count)}</td>
              <td className="right muted">{p.share.toFixed(1)}%</td>
              <td className="right muted">{formatCurrency(p.avgTransaction)}</td>
            </tr>
          ))}
        </tbody>
      </table></div></Card>
    </div>
  );
}

// ─── Comparison View ─────────────────────────────────
function ComparisonView({ data }: { data: any }) {
  if (!data?.current || !data?.previous) return <div className="empty-state"><p className="empty-title">No comparison data available</p><p className="empty-text">Select a date range with enough historical data</p></div>;
  const c = data.current, p = data.previous, ch = data.changes;
  const rows = [
    { label: 'Revenue', current: c.revenue, previous: p.revenue, change: ch.revenue, fmt: formatCurrency },
    { label: 'COGS', current: c.cogs, previous: p.cogs, change: ch.cogs, fmt: formatCurrency, invertColor: true },
    { label: 'Profit', current: c.profit, previous: p.profit, change: ch.profit, fmt: formatCurrency },
    { label: 'Transactions', current: c.transactions, previous: p.transactions, change: ch.transactions, fmt: (v: number) => formatNumber(v) },
    { label: 'Avg Order', current: c.avgOrderValue, previous: p.avgOrderValue, change: ch.avgOrderValue, fmt: formatCurrency },
    { label: 'Profit Margin', current: c.profitMargin, previous: p.profitMargin, change: null, fmt: (v: number) => `${v.toFixed(1)}%` },
  ];
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-6 text-sm text-gray-500">
          <span className="flex items-center gap-2"><span className="w-3 h-3 bg-green-500 rounded-full" />Current: {new Date(c.period.from).toLocaleDateString('id-ID')} – {new Date(c.period.to).toLocaleDateString('id-ID')}</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 bg-gray-300 rounded-full" />Previous: {new Date(p.period.from).toLocaleDateString('id-ID')} – {new Date(p.period.to).toLocaleDateString('id-ID')}</span>
        </div>
      </Card>
      <Card padding={false}><div className="table-wrapper"><table className="table">
        <thead><tr><th>Metric</th><th className="right">Current</th><th className="right">Previous</th><th className="right">Change</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label}>
              <td className="font-medium">{r.label}</td>
              <td className="right bold">{r.fmt(r.current)}</td>
              <td className="right muted">{r.fmt(r.previous)}</td>
              <td className="right">
                {r.change !== null ? (
                  <span className={clsx('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold',
                    r.invertColor ? (r.change <= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')
                    : (r.change >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'))}>
                    {r.change >= 0 ? '↑' : '↓'} {Math.abs(r.change).toFixed(1)}%
                  </span>
                ) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table></div></Card>
    </div>
  );
}

// ─── Product View ────────────────────────────────────
function ProductView({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Revenue" value={formatCurrency(data.summary.totalRevenue)} />
        <StatCard label="COGS" value={formatCurrency(data.summary.totalCOGS)} />
        <StatCard label="Profit" value={formatCurrency(data.summary.totalProfit)} />
        <StatCard label="Products Sold" value={formatNumber((data.products || []).length)} />
      </div>
      <Card padding={false}><div className="table-wrapper"><table className="table">
        <thead><tr><th>#</th><th>Product</th><th>Category</th><th className="right">Qty</th><th className="right">Revenue</th><th className="right">Share</th><th className="right">COGS</th><th className="right">Profit</th><th className="right">Margin</th></tr></thead>
        <tbody>
          {(data.products || []).map((p: any, i: number) => (
            <tr key={p.productId}>
              <td><span className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold', i < 3 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>{i + 1}</span></td>
              <td className="font-medium">{p.name}</td>
              <td><span className="flex items-center gap-1.5 text-gray-600"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.categoryColor }} />{p.category}</span></td>
              <td className="right bold">{formatNumber(p.qty)}</td>
              <td className="right bold">{formatCurrency(p.revenue)}</td>
              <td className="right muted">{p.revenueShare.toFixed(1)}%</td>
              <td className="right muted">{formatCurrency(p.cogs)}</td>
              <td className="right"><span className={p.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(p.profit)}</span></td>
              <td className="right"><Badge variant={p.profitMargin >= 30 ? 'success' : p.profitMargin >= 15 ? 'warning' : 'danger'}>{p.profitMargin.toFixed(1)}%</Badge></td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {(data.products || []).length === 0 && <div className="empty-state"><p className="empty-title">No product data</p></div>}
      </Card>
    </div>
  );
}
