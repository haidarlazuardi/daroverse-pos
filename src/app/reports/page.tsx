'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, Button, Loader, Modal, formatCurrency, formatNumber } from '@/components/ui';
import { api } from '@/lib/fetch';
import clsx from 'clsx';
import * as XLSX from 'xlsx';

type ReportTab = 'summary' | 'daily' | 'transactions' | 'category' | 'payment';

const TABS: { key: ReportTab; label: string; icon: string }[] = [
  { key: 'summary',      label: 'Ringkasan', icon: '📊' },
  { key: 'daily',        label: 'Harian',    icon: '📅' },
  { key: 'transactions', label: 'Transaksi', icon: '🧾' },
  { key: 'category',     label: 'Kategori',  icon: '🏷️' },
  { key: 'payment',      label: 'Pembayaran',icon: '💳' },
];

const PRESETS = [
  { label: 'Hari ini',   days: 0 },
  { label: 'Kemarin',    days: 1 },
  { label: '7 hari',     days: 7 },
  { label: '30 hari',    days: 30 },
];

function getPresetDates(days: number): { from: string; to: string } {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  if (days === 0) return { from: to, to };
  if (days === 1) {
    const yesterday = new Date(today.getTime() - 864e5).toISOString().slice(0, 10);
    return { from: yesterday, to: yesterday };
  }
  const from = new Date(today.getTime() - days * 864e5).toISOString().slice(0, 10);
  return { from, to };
}

function TrendBadge({ pct }: { pct: number }) {
  if (pct === 0) return null;
  return (
    <span className={clsx('text-xs font-semibold px-1.5 py-0.5 rounded-full', pct > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
      {pct > 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

export default function ReportsPage() {
  const now = new Date();
  const [tab, setTab]         = useState<ReportTab>('summary');
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [txData, setTxData]   = useState<any>(null);
  const [txDetail, setTxDetail] = useState<any>(null);
  const [fromDate, setFromDate] = useState(now.toISOString().slice(0, 10));
  const [toDate, setToDate]     = useState(now.toISOString().slice(0, 10));

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = `type=${tab}&from=${fromDate}&to=${toDate}`;
      setData(await api.get(`/api/reports?${params}`));
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [tab, fromDate, toDate]);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try { setTxData(await api.get(`/api/orders?from=${fromDate}&to=${toDate}&limit=100`)); }
    catch { /* silent */ }
    finally { setLoading(false); }
  }, [fromDate, toDate]);

  useEffect(() => {
    if (tab === 'transactions') loadTransactions();
    else loadReport();
  }, [tab, loadReport, loadTransactions]);

  function applyPreset(days: number) {
    const { from, to } = getPresetDates(days);
    setFromDate(from); setToDate(to);
  }

  function exportData() {
    if (!data) return;
    let rows: any[] = [];
    if (tab === 'daily' && data.daily) {
      rows = data.daily.map((d: any) => ({ tanggal: d.date, omzet: d.revenue, transaksi: d.orders, hpp: d.cogs, laba: d.profit }));
    } else if (tab === 'category' && data.byCategory) {
      rows = data.byCategory.map((c: any) => ({ kategori: c.category, omzet: c.revenue, transaksi: c.orders, item: c.items }));
    } else if (tab === 'payment' && data.byPayment) {
      rows = data.byPayment.map((p: any) => ({ metode: p.method, omzet: p.revenue, transaksi: p.count }));
    }
    if (!rows.length) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `report-${tab}-${fromDate}.xlsx`);
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">Laporan</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ringkasan penjualan dan performa bisnis</p>
        </div>

        {/* Date filter */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          {/* Presets */}
          <div className="flex gap-2 flex-wrap mb-3">
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p.days)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl hover:border-brand-400 hover:text-brand-600 transition-colors">
                {p.label}
              </button>
            ))}
          </div>
          {/* Custom range */}
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="input text-sm" />
            <span className="text-gray-400 text-sm">—</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="input text-sm" />
            <button onClick={exportData}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              Export
            </button>
          </div>
        </div>

        {/* Tabs - scrollable on mobile */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-shrink-0',
                tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              <span className="hidden sm:inline">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-4">

            {/* SUMMARY */}
            {tab === 'summary' && data && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Omzet',    value: formatCurrency(data.summary?.revenue || 0) },
                    { label: 'Total Transaksi', value: formatNumber(data.summary?.orders || 0) + ' order' },
                    { label: 'Rata-rata/Order', value: formatCurrency(data.summary?.avgOrder || 0) },
                    { label: 'Total Laba',      value: formatCurrency(data.summary?.profit || 0) },
                  ].map(s => (
                    <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
                      <p className="text-xs text-gray-400">{s.label}</p>
                      <p className="text-xl font-bold text-gray-900 mt-1">{s.value}</p>
                    </div>
                  ))}
                </div>
                {data.hourly && (
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-gray-700 mb-3">Jam tersibuk</p>
                    <div className="space-y-2">
                      {data.hourly.filter((h: any) => h.orders > 0).map((h: any) => (
                        <div key={h.hour} className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 w-12">{h.hour}:00</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div className="bg-brand-500 h-2 rounded-full transition-all"
                              style={{ width: `${(h.orders / Math.max(...data.hourly.map((x: any) => x.orders))) * 100}%` }} />
                          </div>
                          <span className="text-xs font-medium text-gray-700 w-16 text-right">{h.orders} order</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* DAILY */}
            {tab === 'daily' && data?.daily && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tanggal</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Omzet</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Transaksi</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">HPP</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Laba</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.daily.map((d: any) => {
                        const margin = d.revenue > 0 ? (d.profit / d.revenue * 100) : 0;
                        return (
                          <tr key={d.date} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {new Date(d.date).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' })}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">{formatCurrency(d.revenue)}</td>
                            <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">{d.orders}</td>
                            <td className="px-4 py-3 text-right text-gray-500 hidden md:table-cell">{formatCurrency(d.cogs)}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={clsx('font-bold', margin >= 30 ? 'text-emerald-600' : margin >= 15 ? 'text-amber-600' : 'text-red-600')}>
                                {formatCurrency(d.profit)}
                              </span>
                              <span className="text-xs text-gray-400 ml-1">({margin.toFixed(0)}%)</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {data.daily.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-gray-200 bg-gray-50">
                          <td className="px-4 py-3 font-bold text-gray-900">Total</td>
                          <td className="px-4 py-3 text-right font-bold">{formatCurrency(data.daily.reduce((s: number, d: any) => s + d.revenue, 0))}</td>
                          <td className="px-4 py-3 text-right font-bold hidden sm:table-cell">{data.daily.reduce((s: number, d: any) => s + d.orders, 0)}</td>
                          <td className="px-4 py-3 text-right font-bold hidden md:table-cell">{formatCurrency(data.daily.reduce((s: number, d: any) => s + d.cogs, 0))}</td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(data.daily.reduce((s: number, d: any) => s + d.profit, 0))}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* TRANSACTIONS */}
            {tab === 'transactions' && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {!txData ? (
                  <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {(txData.orders || []).map((o: any) => (
                      <button key={o.id} onClick={() => setTxDetail(o)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{o.orderNumber}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(o.createdAt).toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                            {o.customerName && ` · ${o.customerName}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-gray-900">{formatCurrency(o.total)}</span>
                          <Badge variant={o.orderType === 'TAKEAWAY' ? 'warning' : 'default'}>
                            {o.orderType === 'TAKEAWAY' ? 'Bawa' : 'Makan'}
                          </Badge>
                        </div>
                      </button>
                    ))}
                    {(txData.orders || []).length === 0 && (
                      <p className="py-12 text-center text-sm text-gray-400">Tidak ada transaksi di periode ini</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* CATEGORY */}
            {tab === 'category' && data?.byCategory && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="divide-y divide-gray-100">
                  {data.byCategory.map((c: any, i: number) => {
                    const pct = data.summary?.revenue > 0 ? (c.revenue / data.summary.revenue * 100) : 0;
                    return (
                      <div key={i} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-medium text-gray-900">{c.category}</span>
                          <span className="font-bold text-gray-900">{formatCurrency(c.revenue)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                            <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-400 w-24 text-right">{c.orders} order · {pct.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PAYMENT */}
            {tab === 'payment' && data?.byPayment && (
              <div className="space-y-3">
                {data.byPayment.map((p: any, i: number) => {
                  const pct = data.summary?.revenue > 0 ? (p.revenue / data.summary.revenue * 100) : 0;
                  return (
                    <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{p.method === 'CASH' ? '💵' : p.method === 'QRIS' ? '📱' : '💳'}</span>
                          <span className="font-semibold text-gray-900">{p.method}</span>
                        </div>
                        <span className="font-bold text-gray-900">{formatCurrency(p.revenue)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className="bg-brand-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400">{p.count} transaksi · {pct.toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}
      </div>

      {/* Transaction detail modal */}
      {txDetail && (
        <Modal open={!!txDetail} onClose={() => setTxDetail(null)} title={txDetail.orderNumber}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-gray-400 text-xs">Waktu</p><p className="font-medium">{new Date(txDetail.createdAt).toLocaleString('id-ID')}</p></div>
              <div><p className="text-gray-400 text-xs">Tipe</p><p className="font-medium">{txDetail.orderType === 'TAKEAWAY' ? 'Bawa pulang' : 'Makan di sini'}</p></div>
              {txDetail.customerName && <div><p className="text-gray-400 text-xs">Pelanggan</p><p className="font-medium">{txDetail.customerName}</p></div>}
            </div>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              {(txDetail.items || []).map((item: any, i: number) => (
                <div key={i} className={clsx('flex justify-between px-4 py-3 text-sm', i > 0 && 'border-t border-gray-100')}>
                  <div>
                    <p className="font-medium text-gray-900">{item.product?.name || 'Item'}</p>
                    {item.modifiers?.length > 0 && <p className="text-xs text-gray-400">{item.modifiers.map((m: any) => m.optionName).join(', ')}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(item.unitPrice * item.quantity)}</p>
                    <p className="text-xs text-gray-400">{item.quantity}× {formatCurrency(item.unitPrice)}</p>
                  </div>
                </div>
              ))}
              <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 flex justify-between font-bold">
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
