'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, Button, Modal, formatCurrency, formatNumber } from '@/components/ui';
import { api } from '@/lib/fetch';
import clsx from 'clsx';
import * as XLSX from 'xlsx';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportTab = 'summary' | 'daily' | 'monthly' | 'ytd' | 'category' | 'product' | 'payment' | 'expenses' | 'transactions';

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS: { key: ReportTab; label: string }[] = [
  { key: 'summary',      label: 'Ringkasan'   },
  { key: 'daily',        label: 'Harian'      },
  { key: 'monthly',      label: 'Bulanan'     },
  { key: 'ytd',          label: 'Tahunan'     },
  { key: 'category',     label: 'Kategori'    },
  { key: 'product',      label: 'Produk'      },
  { key: 'payment',      label: 'Pembayaran'  },
  { key: 'expenses',     label: 'Pengeluaran' },
  { key: 'transactions', label: 'Transaksi'   },
];

// ─── Date presets ─────────────────────────────────────────────────────────────

const PRESETS = [
  { label: 'Hari ini',  days: 0  },
  { label: 'Kemarin',   days: 1  },
  { label: '7 hari',    days: 7  },
  { label: 'Bulan ini', days: -1 }, // special case
  { label: '30 hari',   days: 30 },
];

function getPreset(days: number): { from: string; to: string } {
  const today = new Date();
  const fmt   = (d: Date) => d.toISOString().slice(0, 10);
  const to    = fmt(today);
  if (days === 0) return { from: to, to };
  if (days === 1) { const y = fmt(new Date(today.getTime() - 864e5)); return { from: y, to: y }; }
  if (days === -1) { // bulan ini
    const from = fmt(new Date(today.getFullYear(), today.getMonth(), 1));
    return { from, to };
  }
  return { from: fmt(new Date(today.getTime() - days * 864e5)), to };
}

// ─── Style B — Clean dark accent helpers ─────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl" style={{background:"var(--brand)",color:"#fff"}} px-4 py-3 mb-3">
      <h2 className="text-sm font-semibold tracking-wide">{children}</h2>
    </div>
  );
}

function MetricCard({ label, value, sub, highlight = false, variant = 'default' }: {
  label: string; value: string; sub?: string;
  highlight?: boolean;
  variant?: 'default' | 'positive' | 'negative' | 'warning';
}) {
  const valueColor = variant === 'positive' ? 'text-emerald-600'
    : variant === 'negative' ? 'text-red-600'
    : variant === 'warning'  ? 'text-amber-600'
    : 'text-gray-900';
  return (
    <div className={clsx('rounded-xl border p-4 bg-white', highlight ? 'border-gray-900 shadow-md' : 'border-gray-200 shadow-sm')}>
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      <p className={clsx('text-xl sm:text-2xl font-black mt-1 leading-none', valueColor)}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={clsx('px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100', right ? 'text-right' : 'text-left')}>
      {children}
    </th>
  );
}

function Td({ children, right, bold, muted, color }: { children: React.ReactNode; right?: boolean; bold?: boolean; muted?: boolean; color?: string }) {
  return (
    <td className={clsx('px-4 py-3 border-b border-gray-100 align-middle', right && 'text-right', bold && 'font-bold', muted && 'text-gray-400', color)}>
      {children}
    </td>
  );
}

function MarginBadge({ margin }: { margin: number }) {
  const variant = margin >= 50 ? 'bg-emerald-100 text-emerald-700'
    : margin >= 30 ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700';
  return <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full', variant)}>{margin.toFixed(0)}%</span>;
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────

function MiniBar({ value, max, color = 'bg-brand-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-20 bg-gray-100 rounded-full h-1.5 hidden sm:block">
      <div className={clsx('h-1.5 rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const now = new Date();
  const [tab, setTab]           = useState<ReportTab>('summary');
  const [data, setData]         = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [txData, setTxData]     = useState<any>(null);
  const [txDetail, setTxDetail] = useState<any>(null);
  const [fromDate, setFromDate] = useState(() => getPreset(0).from);
  const [toDate, setToDate]     = useState(() => getPreset(0).to);
  const [year, setYear]         = useState(String(now.getFullYear()));
  const cacheRef = useRef<Map<string, any>>(new Map());

  const cacheKey = `${tab}-${fromDate}-${toDate}-${year}`;

  const loadData = useCallback(async () => {
    // Check cache first for instant render
    if (cacheRef.current.has(cacheKey)) {
      setData(cacheRef.current.get(cacheKey));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (tab === 'transactions') {
        const res = await api.get<any>(`/api/orders?from=${fromDate}&to=${toDate}&limit=200`);
        setTxData(res);
        setData(null);
      } else {
        let params = `type=${tab}`;
        if (tab === 'ytd' || tab === 'monthly') params += `&year=${year}`;
        else params += `&from=${fromDate}&to=${toDate}`;
        const res = await api.get<any>(`/api/reports?${params}`);
        cacheRef.current.set(cacheKey, res); // cache it
        setData(res);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [tab, fromDate, toDate, year, cacheKey]);

  useEffect(() => { loadData(); }, [loadData]);

  function applyPreset(days: number) {
    const { from, to } = getPreset(days);
    setFromDate(from); setToDate(to);
    cacheRef.current.clear(); // invalidate cache on date change
  }

  function exportToExcel() {
    if (!data) return;
    let rows: any[] = [];
    const sheet = tab;
    if (tab === 'daily' && data.daily) rows = data.daily;
    else if (tab === 'category' && data.byCategory) rows = data.byCategory;
    else if (tab === 'product' && data.products) rows = data.products;
    else if (tab === 'payment' && data.byPayment) rows = data.byPayment;
    else if (tab === 'monthly' && data.monthly) rows = data.monthly;
    else if (tab === 'expenses') rows = [...(data.expenses||[]), ...(data.purchases||[])];
    if (!rows.length) return;
    const ws = XLSX.utils.json_to_sheet(rows.map(r => {
      const clean: any = {};
      for (const [k, v] of Object.entries(r)) {
        if (typeof v !== 'object' || v === null) clean[k] = v;
      }
      return clean;
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheet);
    XLSX.writeFile(wb, `soeka-${sheet}-${fromDate}.xlsx`);
  }

  const s = data?.summary;

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">

        {/* Page header — Style B */}
        <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
          <div>
            <h1 className="text-xl font-black text-gray-900">Laporan</h1>
            <p className="text-sm text-gray-400 mt-0.5">Performa penjualan & keuangan Soeka House</p>
          </div>
          <button onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl" style={{background:"var(--brand)",color:"#fff"}} transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Export Excel
          </button>
        </div>

        {/* Date filter */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
          <div className="flex gap-2 flex-wrap mb-3">
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p.days)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:border-gray-900 hover:text-gray-900 transition-colors font-medium">
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(tab === 'ytd' || tab === 'monthly') ? (
              <input type="number" value={year} min="2020" max="2099"
                onChange={e => { setYear(e.target.value); cacheRef.current.clear(); }}
                className="input text-sm w-28" placeholder="Tahun" />
            ) : (
              <>
                <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); cacheRef.current.clear(); }} className="input text-sm" />
                <span className="opacity-80">—</span>
                <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); cacheRef.current.clear(); }} className="input text-sm" />
              </>
            )}
          </div>
        </div>

        {/* Tabs — scrollable */}
        <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={clsx(
                'px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0',
                tab === t.key ? "tab-active" : 'tab-inactive bg-white border border-gray-200'
              )}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
            <span className="text-sm">Memuat data...</span>
          </div>
        ) : (
          <div className="space-y-5">

            {/* ── SUMMARY ─────────────────────────────────────────────── */}
            {tab === 'summary' && s && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard label="Total Omzet" value={formatCurrency(s.totalRevenue)} highlight />
                  <MetricCard label="Total Transaksi" value={formatNumber(s.totalTransactions)} sub="order selesai" />
                  <MetricCard label="Rata-rata/Order" value={formatCurrency(s.avgOrderValue)} />
                  <MetricCard label="Laba Kotor" value={formatCurrency(s.grossProfit)}
                    sub={`Margin ${s.grossMargin?.toFixed(1) || 0}%`}
                    variant={s.grossMargin >= 40 ? 'positive' : s.grossMargin >= 20 ? 'warning' : 'negative'} />
                </div>

                {/* P&L mini */}
                <div>
                  <SectionHeader>📊 P&L Ringkas</SectionHeader>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm divide-y divide-gray-100">
                    {[
                      { label: 'Pendapatan', value: s.totalRevenue, indent: false, bold: false, color: '' },
                      { label: 'HPP (Cost of Goods)', value: -s.totalCOGS, indent: true, bold: false, color: 'text-red-600' },
                      { label: 'Laba Kotor', value: s.grossProfit, indent: false, bold: true, color: s.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600' },
                      { label: 'Pengeluaran Operasional', value: -(s.totalExpenses||0), indent: true, bold: false, color: 'text-red-600' },
                      { label: 'Pembelian Bahan (PO)', value: -(s.totalPurchases||0), indent: true, bold: false, color: 'text-red-600' },
                      { label: 'Laba Operasional', value: s.operatingProfit||s.totalProfit, indent: false, bold: true, color: (s.operatingProfit||s.totalProfit) >= 0 ? 'text-emerald-700' : 'text-red-600' },
                    ].map((row, i) => (
                      <div key={i} className={clsx('flex justify-between items-center px-4 py-3', row.bold && 'bg-gray-50')}>
                        <span className={clsx('text-sm', row.indent && 'pl-4 text-gray-500', row.bold && 'font-bold text-gray-900')}>{row.label}</span>
                        <span className={clsx('text-sm font-semibold', row.bold && 'font-black text-base', row.color || 'text-gray-900')}>
                          {row.value < 0 ? `(${formatCurrency(-row.value)})` : formatCurrency(row.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hourly */}
                {data.hourly && (
                  <div>
                    <SectionHeader>⏰ Jam Tersibuk</SectionHeader>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-2">
                      {data.hourly.filter((h: any) => h.orders > 0).map((h: any) => {
                        const maxOrders = Math.max(...data.hourly.map((x: any) => x.orders));
                        return (
                          <div key={h.hour} className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 w-14 font-mono">{String(h.hour).padStart(2,'0')}:00</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                              <div className="h-2 rounded-full" style={{background:"var(--brand)"}} transition-all"
                                style={{ width: `${(h.orders / maxOrders) * 100}%` }} />
                            </div>
                            <span className="text-xs font-bold text-gray-700 w-16 text-right">{h.orders} order</span>
                            <span className="text-xs text-gray-400 w-28 text-right hidden sm:block">{formatCurrency(h.revenue)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── DAILY ───────────────────────────────────────────────── */}
            {tab === 'daily' && data?.daily && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard label="Total Omzet" value={formatCurrency(s?.totalRevenue||0)} highlight />
                  <MetricCard label="Transaksi" value={formatNumber(s?.totalTransactions||0)} />
                  <MetricCard label="Pengeluaran" value={formatCurrency((s?.totalExpenses||0)+(s?.totalPurchases||0))} variant="negative" />
                  <MetricCard label="Laba Bersih" value={formatCurrency(s?.operatingProfit||0)} variant={s?.operatingProfit >= 0 ? 'positive' : 'negative'} />
                </div>
                <TableWrapper>
                  <thead>
                    <tr>
                      <Th>Tanggal</Th>
                      <Th right>Omzet</Th>
                      <Th right>Transaksi</Th>
                      <Th right><span className="hidden md:inline">HPP</span></Th>
                      <Th right><span className="hidden md:inline">Pengeluaran</span></Th>
                      <Th right><span className="hidden md:inline">Pembelian</span></Th>
                      <Th right>Laba Bersih</Th>
                      <Th right>Margin</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.map((d: any) => {
                      const margin = d.revenue > 0 ? ((d.netProfit ?? d.profit) / d.revenue * 100) : 0;
                      return (
                        <tr key={d.date} className="hover:bg-gray-50/50 transition-colors">
                          <Td bold>{new Date(d.date).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' })}</Td>
                          <Td right bold>{formatCurrency(d.revenue)}</Td>
                          <Td right muted>{d.transactions}</Td>
                          <Td right muted>{formatCurrency(d.cogs)}</Td>
                          <Td right color="text-amber-600">{d.expenses > 0 ? formatCurrency(d.expenses) : '—'}</Td>
                          <Td right color="text-orange-600">{d.purchases > 0 ? formatCurrency(d.purchases) : '—'}</Td>
                          <Td right bold color={margin >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(d.netProfit ?? d.profit)}</Td>
                          <Td right><MarginBadge margin={margin} /></Td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{background:"var(--brand)",color:"#fff"}}>
                      <td className="px-4 py-3 font-bold text-sm">Total</td>
                      <td className="px-4 py-3 text-right font-bold text-sm">{formatCurrency(data.daily.reduce((s: number, d: any) => s+d.revenue, 0))}</td>
                      <td className="px-4 py-3 text-right opacity-80 text-sm">{data.daily.reduce((s: number, d: any) => s+d.transactions, 0)}</td>
                      <td className="px-4 py-3 text-right opacity-80 text-sm">{formatCurrency(data.daily.reduce((s: number, d: any) => s+d.cogs, 0))}</td>
                      <td className="px-4 py-3 text-right text-amber-300 text-sm">{formatCurrency(data.daily.reduce((s: number, d: any) => s+(d.expenses||0), 0))}</td>
                      <td className="px-4 py-3 text-right text-orange-300 text-sm">{formatCurrency(data.daily.reduce((s: number, d: any) => s+(d.purchases||0), 0))}</td>
                      <td className="px-4 py-3 text-right font-bold text-sm text-emerald-300">{formatCurrency(data.daily.reduce((s: number, d: any) => s+(d.netProfit??d.profit), 0))}</td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  </tfoot>
                </TableWrapper>
              </>
            )}

            {/* ── MONTHLY ─────────────────────────────────────────────── */}
            {tab === 'monthly' && data?.monthly && (
              <TableWrapper>
                <thead>
                  <tr>
                    <Th>Bulan</Th>
                    <Th right>Omzet</Th>
                    <Th right>Transaksi</Th>
                    <Th right><span className="hidden md:inline">HPP</span></Th>
                    <Th right>Laba Kotor</Th>
                    <Th right>Margin</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthly.map((m: any) => {
                    const margin = m.revenue > 0 ? (m.profit / m.revenue * 100) : 0;
                    return (
                      <tr key={m.month} className="hover:bg-gray-50/50">
                        <Td bold>{new Date(m.month + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</Td>
                        <Td right bold>{formatCurrency(m.revenue)}</Td>
                        <Td right muted>{m.transactions}</Td>
                        <Td right muted>{formatCurrency(m.cogs)}</Td>
                        <Td right bold color={m.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(m.profit)}</Td>
                        <Td right><MarginBadge margin={margin} /></Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrapper>
            )}

            {/* ── YTD ─────────────────────────────────────────────────── */}
            {tab === 'ytd' && data && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard label="Omzet YTD" value={formatCurrency(data.summary?.totalRevenue||0)} highlight />
                  <MetricCard label="Transaksi" value={formatNumber(data.summary?.totalTransactions||0)} />
                  <MetricCard label="Total Laba" value={formatCurrency(data.summary?.totalProfit||0)} variant="positive" />
                  <MetricCard label="Rata-rata/Bulan" value={formatCurrency((data.summary?.totalRevenue||0)/12)} />
                </div>
                {data.monthly && (
                  <TableWrapper>
                    <thead><tr><Th>Bulan</Th><Th right>Omzet</Th><Th right>Kumulatif</Th><Th right>Laba</Th><Th right>Margin</Th></tr></thead>
                    <tbody>
                      {data.monthly.map((m: any) => {
                        const margin = m.revenue > 0 ? (m.profit / m.revenue * 100) : 0;
                        return (
                          <tr key={m.month} className="hover:bg-gray-50/50">
                            <Td bold>{new Date(m.month + '-01').toLocaleDateString('id-ID', { month: 'long' })}</Td>
                            <Td right>{formatCurrency(m.revenue)}</Td>
                            <Td right muted>{formatCurrency(m.cumulative || 0)}</Td>
                            <Td right color={m.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(m.profit)}</Td>
                            <Td right><MarginBadge margin={margin} /></Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </TableWrapper>
                )}
              </>
            )}

            {/* ── CATEGORY ────────────────────────────────────────────── */}
            {tab === 'category' && data?.byCategory && (
              <>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <MetricCard label="Total Omzet" value={formatCurrency(s?.totalRevenue||0)} highlight />
                  <MetricCard label="Total Transaksi" value={formatNumber(s?.totalTransactions||0)} />
                </div>
                <TableWrapper>
                  <thead><tr><Th>Kategori</Th><Th right>Omzet</Th><Th right>Item Terjual</Th><Th right>Order</Th><Th right>% Omzet</Th></tr></thead>
                  <tbody>
                    {data.byCategory.map((c: any, i: number) => {
                      const pct = s?.totalRevenue > 0 ? (c.revenue / s.totalRevenue * 100) : 0;
                      return (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <Td>
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                              <span className="font-medium text-gray-900">{c.name}</span>
                            </div>
                          </Td>
                          <Td right bold>{formatCurrency(c.revenue)}</Td>
                          <Td right muted>{formatNumber(c.items)}</Td>
                          <Td right muted>{c.orders}</Td>
                          <Td right>
                            <div className="flex items-center justify-end gap-2">
                              <MiniBar value={c.revenue} max={s?.totalRevenue||1} color="bg-brand-700" />
                              <span className="text-sm font-bold text-gray-700 w-10 text-right">{pct.toFixed(1)}%</span>
                            </div>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </TableWrapper>
              </>
            )}

            {/* ── PRODUCT ─────────────────────────────────────────────── */}
            {tab === 'product' && data?.products && (
              <TableWrapper>
                <thead><tr><Th>Produk</Th><Th>Kategori</Th><Th right>Qty Terjual</Th><Th right>Omzet</Th><Th right><span className="hidden md:inline">HPP</span></Th><Th right>Laba</Th><Th right>Margin</Th></tr></thead>
                <tbody>
                  {data.products.map((p: any, i: number) => {
                    const margin = p.revenue > 0 ? (p.profit / p.revenue * 100) : 0;
                    return (
                      <tr key={i} className="hover:bg-gray-50/50">
                        <Td bold>{p.name}</Td>
                        <Td>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.categoryColor }} />
                            <span className="text-gray-500 text-xs">{p.category}</span>
                          </div>
                        </Td>
                        <Td right muted>{formatNumber(p.quantity)}</Td>
                        <Td right bold>{formatCurrency(p.revenue)}</Td>
                        <Td right muted>{formatCurrency(p.cogs)}</Td>
                        <Td right color={p.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(p.profit)}</Td>
                        <Td right><MarginBadge margin={margin} /></Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrapper>
            )}

            {/* ── PAYMENT ─────────────────────────────────────────────── */}
            {tab === 'payment' && data?.byPayment && (
              <div className="space-y-3">
                {data.byPayment.map((p: any) => {
                  const pct = s?.totalRevenue > 0 ? (p.revenue / s.totalRevenue * 100) : 0;
                  return (
                    <div key={p.method} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white text-lg">
                            {p.method === 'CASH' ? '💵' : p.method === 'QRIS' ? '📱' : '💳'}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{p.method}</p>
                            <p className="text-xs text-gray-400">{p.count} transaksi</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-xl text-gray-900">{formatCurrency(p.revenue)}</p>
                          <p className="text-xs text-gray-400">{pct.toFixed(1)}% dari omzet</p>
                        </div>
                      </div>
                      <div className="bg-gray-100 rounded-full h-2">
                        <div className="h-2 rounded-full" style={{background:"var(--brand)"}} transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── EXPENSES ────────────────────────────────────────────── */}
            {tab === 'expenses' && data && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <MetricCard label="Pengeluaran Operasional" value={formatCurrency(s?.totalExpenses||0)} variant="negative" />
                  <MetricCard label="Pembelian Bahan (PO)" value={formatCurrency(s?.totalPurchases||0)} variant="negative" />
                  <MetricCard label="Total Pengeluaran" value={formatCurrency((s?.totalExpenses||0)+(s?.totalPurchases||0))} highlight />
                </div>

                {/* Expense by category */}
                {s?.expenseByCategory && Object.keys(s.expenseByCategory).length > 0 && (
                  <div>
                    <SectionHeader>📂 Per Kategori Pengeluaran</SectionHeader>
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm divide-y divide-gray-100">
                      {Object.entries(s.expenseByCategory as Record<string,number>)
                        .sort((a, b) => b[1] - a[1])
                        .map(([cat, amt]) => {
                          const total = s.totalExpenses || 1;
                          return (
                            <div key={cat} className="flex items-center justify-between px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-gray-700">{cat}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <MiniBar value={amt} max={total} color="bg-red-400" />
                                <span className="font-bold text-gray-900 text-sm">{formatCurrency(amt)}</span>
                              </div>
                            </div>
                          );
                        })
                      }
                    </div>
                  </div>
                )}

                {/* Expense list */}
                {data.expenses?.length > 0 && (
                  <div>
                    <SectionHeader>🧾 Pengeluaran Operasional</SectionHeader>
                    <TableWrapper>
                      <thead><tr><Th>Tanggal</Th><Th>Kategori</Th><Th>Keterangan</Th><Th right>Jumlah</Th></tr></thead>
                      <tbody>
                        {data.expenses.map((e: any) => (
                          <tr key={e.id} className="hover:bg-gray-50/50">
                            <Td muted>{new Date(e.date).toLocaleDateString('id-ID', { day:'2-digit', month:'short' })}</Td>
                            <Td><Badge variant="default">{e.category}</Badge></Td>
                            <Td>{e.description}</Td>
                            <Td right bold color="text-red-600">{formatCurrency(e.amount)}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </TableWrapper>
                  </div>
                )}

                {/* PO list */}
                {data.purchases?.length > 0 && (
                  <div>
                    <SectionHeader>📦 Pembelian Bahan (Purchase Order)</SectionHeader>
                    <TableWrapper>
                      <thead><tr><Th>Tanggal</Th><Th>No. PO</Th><Th>Supplier</Th><Th right>Jumlah</Th></tr></thead>
                      <tbody>
                        {data.purchases.map((po: any) => (
                          <tr key={po.id} className="hover:bg-gray-50/50">
                            <Td muted>{new Date(po.date).toLocaleDateString('id-ID', { day:'2-digit', month:'short' })}</Td>
                            <Td><span className="font-mono text-sm">{po.poNumber}</span></Td>
                            <Td>{po.supplier}</Td>
                            <Td right bold color="text-orange-600">{formatCurrency(po.amount)}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </TableWrapper>
                  </div>
                )}
              </>
            )}

            {/* ── TRANSACTIONS ────────────────────────────────────────── */}
            {tab === 'transactions' && (
              txData ? (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm text-gray-500">{txData.orders?.length || 0} transaksi</p>
                  </div>
                  <TableWrapper>
                    <thead>
                      <tr>
                        <Th>No. Order</Th>
                        <Th>Waktu</Th>
                        <Th>Pelanggan</Th>
                        <Th>Tipe</Th>
                        <Th right>Total</Th>
                        <Th right>Laba</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {(txData.orders||[]).map((o: any) => (
                        <tr key={o.id} onClick={() => setTxDetail(o)}
                          className="hover:bg-gray-50/50 cursor-pointer transition-colors">
                          <Td><span className="font-mono text-sm font-bold">{o.orderNumber}</span></Td>
                          <Td muted>{new Date(o.createdAt).toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</Td>
                          <Td muted>{o.customerName || '—'}</Td>
                          <Td>
                            <Badge variant={o.orderType === 'TAKEAWAY' ? 'warning' : 'default'}>
                              {o.orderType === 'TAKEAWAY' ? 'Bawa' : 'Makan'}
                            </Badge>
                          </Td>
                          <Td right bold>{formatCurrency(o.total)}</Td>
                          <Td right color={o.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(o.profit)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrapper>
                </div>
              ) : (
                <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" /></div>
              )
            )}

          </div>
        )}
      </div>

      {/* Transaction detail modal */}
      {txDetail && (
        <Modal open={!!txDetail} onClose={() => setTxDetail(null)} title={`Detail — ${txDetail.orderNumber}`}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-gray-400 text-xs mb-0.5">Waktu</p><p className="font-medium">{new Date(txDetail.createdAt).toLocaleString('id-ID')}</p></div>
              <div><p className="text-gray-400 text-xs mb-0.5">Tipe</p><p className="font-medium">{txDetail.orderType === 'TAKEAWAY' ? 'Bawa pulang' : 'Makan di sini'}</p></div>
              {txDetail.customerName && <div><p className="text-gray-400 text-xs mb-0.5">Pelanggan</p><p className="font-medium">{txDetail.customerName}</p></div>}
              <div><p className="text-gray-400 text-xs mb-0.5">Payment</p><p className="font-medium">{txDetail.payment?.method || '—'}</p></div>
            </div>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              {(txDetail.items||[]).map((item: any, i: number) => (
                <div key={i} className={clsx('flex justify-between px-4 py-3 text-sm', i > 0 && 'border-t border-gray-100')}>
                  <div>
                    <p className="font-medium text-gray-900">{item.product?.name || 'Item'}</p>
                    {item.modifiers?.length > 0 && (
                      <p className="text-xs text-gray-400">{item.modifiers.map((m: any) => m.optionName).join(' · ')}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(item.unitPrice * item.quantity)}</p>
                    <p className="text-xs text-gray-400">{item.quantity}× {formatCurrency(item.unitPrice)}</p>
                  </div>
                </div>
              ))}
              <div className="border-t-2 border-gray-200 bg-gray-900 text-white px-4 py-3 flex justify-between font-black">
                <span>Total</span>
                <span>{formatCurrency(txDetail.total)}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}
