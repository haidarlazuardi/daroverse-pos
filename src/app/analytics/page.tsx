'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, Loader, formatCurrency, formatNumber } from '@/components/ui';
import { api } from '@/lib/fetch';
import clsx from 'clsx';

const PERIODS = [
  { value: 'today', label: 'Hari ini' },
  { value: 'week',  label: '7 hari' },
  { value: 'month', label: 'Bulan ini' },
  { value: 'all',   label: 'Semua' },
] as const;

const LOC_LABEL: Record<string, string> = { GUDANG: 'Gudang', BAR: 'Bar', KITCHEN: 'Dapur' };

function KpiCard({ label, value, sub, variant = 'default' }: { label: string; value: string; sub?: string; variant?: 'default'|'success'|'warning'|'danger' }) {
  const colors = {
    default: 'bg-white border-gray-200 text-gray-900',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    danger:  'bg-red-50 border-red-200 text-red-700',
  };
  return (
    <div className={clsx('rounded-xl border p-4', colors[variant])}>
      <p className="text-xs font-medium opacity-60 mb-1">{label}</p>
      <p className="text-2xl font-bold leading-none">{value}</p>
      {sub && <p className="text-xs opacity-50 mt-1">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-bold text-gray-900 mb-3">{children}</h2>;
}

export default function AnalyticsPage() {
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState<typeof PERIODS[number]['value']>('month');
  const [expandedLoc, setExpandedLoc] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api.get(`/api/analytics?period=${period}`)); }
    catch { /* silent */ }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Analitik</h1>
            <p className="text-sm text-gray-500 mt-0.5">Kesehatan bisnis Soeka House</p>
          </div>
          {/* Period selector - pill style */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)}
                className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                  period === p.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {loading || !data ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-6">

            {/* ── 1. COGS & Revenue ─────────────────────────────────── */}
            <section>
              <SectionTitle>💰 Pendapatan & Biaya</SectionTitle>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <KpiCard label="Pendapatan" value={formatCurrency(data.cogs.revenue)} />
                <KpiCard label="COGS Teoritis"
                  value={formatCurrency(data.cogs.theoreticalCOGS)}
                  sub={`${data.cogs.theoreticalPct.toFixed(1)}% dari omzet`}
                  variant={data.cogs.theoreticalPct > 40 ? 'warning' : 'success'}
                />
                <KpiCard label="Buang (Waste)"
                  value={formatCurrency(data.cogs.wasteValue)}
                  variant={data.cogs.wasteValue > 100000 ? 'warning' : 'default'}
                />
                <KpiCard label="Selisih Opname"
                  value={formatCurrency(data.cogs.shrinkValue)}
                  variant={data.cogs.shrinkValue > 50000 ? 'warning' : 'default'}
                />
              </div>
              {/* Kebocoran highlight */}
              <div className={clsx('rounded-xl p-4 flex items-center justify-between',
                data.cogs.leakPct > 5 ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200')}>
                <div>
                  <p className="text-xs font-medium text-gray-500">Total Kebocoran</p>
                  <p className={clsx('text-2xl font-bold', data.cogs.leakPct > 5 ? 'text-red-600' : 'text-emerald-600')}>
                    {formatCurrency(data.cogs.leakTotal)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">waste + selisih opname</p>
                </div>
                <div className="text-right">
                  <p className={clsx('text-4xl font-black', data.cogs.leakPct > 5 ? 'text-red-500' : 'text-emerald-500')}>
                    {data.cogs.leakPct.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-400">dari COGS</p>
                  <p className={clsx('text-xs font-semibold mt-1', data.cogs.leakPct > 5 ? 'text-red-600' : 'text-emerald-600')}>
                    {data.cogs.leakPct > 5 ? '⚠️ Perlu perhatian' : '✅ Masih wajar'}
                  </p>
                </div>
              </div>
            </section>

            {/* ── 2. Reorder Suggestions ─────────────────────────────── */}
            {data.reorderSuggestions?.length > 0 && (
              <section>
                <SectionTitle>🛒 Perlu Dibeli Segera</SectionTitle>
                <div className="space-y-2">
                  {data.reorderSuggestions.slice(0, 8).map((item: any) => (
                    <div key={item.id} className={clsx(
                      'bg-white border rounded-xl p-4 flex items-center justify-between gap-4',
                      item.currentStock === 0 ? 'border-red-200 bg-red-50/30' : 'border-amber-200 bg-amber-50/20'
                    )}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{item.name}</p>
                          {item.currentStock === 0
                            ? <Badge variant="danger">Habis</Badge>
                            : <Badge variant="warning">Stok rendah</Badge>
                          }
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Stok: <span className="font-medium text-gray-700">{formatNumber(item.currentStock)} {item.unit}</span>
                          {' · '}Min: {formatNumber(item.minStock)} {item.unit}
                          {item.daysLeft !== null && ` · ≈${item.daysLeft} hari lagi`}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-gray-900">
                          {item.suggestPurchaseUnit || `${formatNumber(item.suggestQty)} ${item.unit}`}
                        </p>
                        <p className="text-xs text-gray-400">≈ {formatCurrency(item.estimatedCost)}</p>
                      </div>
                    </div>
                  ))}
                  {data.reorderSuggestions.length > 8 && (
                    <p className="text-sm text-center text-gray-400 py-2">+{data.reorderSuggestions.length - 8} bahan lainnya</p>
                  )}
                </div>
              </section>
            )}

            {/* ── 3. Stok per Lokasi ─────────────────────────────────── */}
            <section>
              <SectionTitle>📦 Stok per Lokasi</SectionTitle>
              <div className="space-y-2">
                {(['GUDANG', 'BAR', 'KITCHEN'] as const).map(loc => {
                  const items = (data.stockByLocation[loc] || []).filter((i: any) => i.quantity > 0);
                  const isExpanded = expandedLoc === loc;
                  const shown = isExpanded ? items : items.slice(0, 5);
                  return (
                    <div key={loc} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <button onClick={() => setExpandedLoc(isExpanded ? null : loc)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-900">{LOC_LABEL[loc]}</span>
                          <Badge variant="default">{items.length} bahan</Badge>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          className={clsx('text-gray-400 transition-transform', isExpanded && 'rotate-90')}>
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </button>
                      {items.length > 0 && (
                        <div className="border-t border-gray-100 divide-y divide-gray-100">
                          {shown.map((i: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center px-4 py-2.5">
                              <span className="text-sm text-gray-700">{i.name}{i.type === 'PREPPED' && <span className="text-purple-400 ml-1">●</span>}</span>
                              <span className="text-sm font-semibold text-gray-900">{formatNumber(i.quantity)} {i.unit}</span>
                            </div>
                          ))}
                          {!isExpanded && items.length > 5 && (
                            <button onClick={() => setExpandedLoc(loc)}
                              className="w-full py-2 text-sm text-brand-600 hover:bg-brand-50 transition-colors">
                              Lihat {items.length - 5} bahan lainnya →
                            </button>
                          )}
                        </div>
                      )}
                      {items.length === 0 && <p className="px-4 py-3 text-sm text-gray-400">Tidak ada stok</p>}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ── 4. Modifier Insights ───────────────────────────────── */}
            {data.modifierInsights?.length > 0 && (
              <section>
                <SectionTitle>🎛️ Pilihan Paling Populer</SectionTitle>
                <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
                  {data.modifierInsights.slice(0, 8).map((m: any, i: number) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{m.option}</p>
                        <p className="text-xs text-gray-400">{m.group}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Mini bar */}
                        <div className="w-20 bg-gray-100 rounded-full h-1.5 hidden sm:block">
                          <div className="bg-brand-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, m.count / data.modifierInsights[0].count * 100)}%` }} />
                        </div>
                        <span className="text-sm font-bold text-gray-900 w-12 text-right">{m.count}×</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── 5. CRM ─────────────────────────────────────────────── */}
            <section>
              <SectionTitle>👥 Pelanggan</SectionTitle>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <KpiCard label="Total Pelanggan" value={formatNumber(data.crm.totalCustomers)} />
                <KpiCard label="Member (punya HP)" value={formatNumber(data.crm.members)} />
                <KpiCard label="Repeat Customer"
                  value={`${data.crm.repeatRate.toFixed(0)}%`}
                  variant={data.crm.repeatRate > 30 ? 'success' : 'default'}
                  sub={`${data.crm.repeatCustomers} orang`}
                />
                <KpiCard label="Poin Beredar" value={formatNumber(data.crm.pointsOutstanding)} sub="belum ditukar" variant="warning" />
              </div>
              {data.crm.topCustomers?.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-700">🏆 Top Spender</p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {data.crm.topCustomers.map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{c.name}</p>
                            <p className="text-xs text-gray-400">{c.visitCount}× kunjungan · {c.points} poin</p>
                          </div>
                        </div>
                        <p className="font-bold text-gray-900">{formatCurrency(c.totalSpent)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* ── 6. Production Variance ─────────────────────────────── */}
            {data.productionVariance?.length > 0 && (
              <section>
                <SectionTitle>🍳 Selisih Produksi Batch</SectionTitle>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="divide-y divide-gray-100">
                    {data.productionVariance.slice(0, 5).map((p: any, i: number) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{p.name}</p>
                          <p className="text-xs text-gray-400">Plan {formatNumber(p.planned)} → Aktual {formatNumber(p.actual)} {p.unit}</p>
                        </div>
                        <div className={clsx('text-sm font-bold', p.variance > 0 ? 'text-emerald-600' : 'text-red-600')}>
                          {p.variance > 0 ? '+' : ''}{formatNumber(p.variance)} {p.unit}
                          <span className="text-xs ml-1 opacity-70">({p.variancePct.toFixed(1)}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

          </div>
        )}
      </div>
    </AdminLayout>
  );
}
