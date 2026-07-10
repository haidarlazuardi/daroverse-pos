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

function KpiCard({ label, value, sub, variant = 'default' }: { label: string; value: string | number; sub?: string; variant?: 'default'|'success'|'warning'|'danger' }) {
  const colors = {
    default: 'bg-white border-gray-200 text-gray-900',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    danger:  'bg-red-50 border-red-200 text-red-700',
  };
  return (
    <div className={clsx('rounded-xl border p-4', colors[variant])}>
      <p className="text-xs font-medium opacity-60 mb-1">{label}</p>
      <p className="text-xl sm:text-2xl font-bold leading-none">{value}</p>
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
            {data?.cogs && (
              <section>
                <SectionTitle>💰 Pendapatan & Biaya</SectionTitle>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <KpiCard label="Pendapatan" value={formatCurrency(data.cogs.revenue || 0)} />
                  <KpiCard label="COGS Teoritis"
                    value={formatCurrency(data.cogs.theoreticalCOGS || 0)}
                    sub={`${(data.cogs.theoreticalPct || 0).toFixed(1)}% dari omzet`}
                    variant={(data.cogs.theoreticalPct || 0) > 40 ? 'warning' : 'success'}
                  />
                  <KpiCard label="Buang (Waste)"
                    value={formatCurrency(data.cogs.wasteValue || 0)}
                    variant={(data.cogs.wasteValue || 0) > 100000 ? 'warning' : 'default'}
                  />
                  <KpiCard label="Selisih Opname"
                    value={formatCurrency(data.cogs.shrinkValue || 0)}
                    variant={(data.cogs.shrinkValue || 0) > 50000 ? 'warning' : 'default'}
                  />
                </div>
                {/* Kebocoran highlight */}
                <div className={clsx('rounded-xl p-4 flex items-center justify-between',
                  (data.cogs.leakPct || 0) > 5 ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200')}>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Total Kebocoran</p>
                    <p className={clsx('text-2xl font-bold', (data.cogs.leakPct || 0) > 5 ? 'text-red-600' : 'text-emerald-600')}>
                      {formatCurrency(data.cogs.leakTotal || 0)}
                    </p>
                    <p className="text-xs mt-0.5" style={{color:"var(--text-2)"}}>waste + selisih opname</p>
                  </div>
                  <div className="text-right">
                    <p className={clsx('text-3xl sm:text-4xl font-black', (data.cogs.leakPct || 0) > 5 ? 'text-red-500' : 'text-emerald-500')}>
                      {(data.cogs.leakPct || 0).toFixed(1)}%
                    </p>
                    <p className="text-xs" style={{color:"var(--text-2)"}}>dari COGS</p>
                    <p className={clsx('text-xs font-semibold mt-1', (data.cogs.leakPct || 0) > 5 ? 'text-red-600' : 'text-emerald-600')}>
                      {(data.cogs.leakPct || 0) > 5 ? '⚠️ Perlu perhatian' : '✅ Masih wajar'}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* ── 2. Reorder Suggestions ─────────────────────────────── */}
            {data?.reorderSuggestions?.length > 0 && (
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
                        <p className="text-xs" style={{color:"var(--text-2)"}}>≈ {formatCurrency(item.estimatedCost)}</p>
                      </div>
                    </div>
                  ))}
                  {data.reorderSuggestions.length > 8 && (
                    <p className="text-sm text-center py-2" style={{color:"var(--text-2)"}}>+{data.reorderSuggestions.length - 8} bahan lainnya</p>
                  )}
                </div>
              </section>
            )}

            {/* ── 3. Stok per Lokasi ─────────────────────────────────── */}
            {data?.stockByLocation && (
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
                            className={clsx("transition-transform", isExpanded && "rotate-90")} style={{color:"var(--text-2)"}}>
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
                        {items.length === 0 && <p className="px-4 py-3 text-sm" style={{color:"var(--text-2)"}}>Tidak ada stok</p>}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── 4. Modifier Insights ───────────────────────────────── */}
            {data?.modifierInsights?.length > 0 && (
              <section>
                <SectionTitle>🎛️ Pilihan Paling Populer</SectionTitle>
                <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
                  {data.modifierInsights.slice(0, 8).map((m: any, i: number) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{m.option}</p>
                        <p className="text-xs" style={{color:"var(--text-2)"}}>{m.group}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Mini bar */}
                        <div className="w-20 bg-gray-100 rounded-full h-1.5 hidden sm:block">
                          <div className="bg-brand-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, (m.count / (data.modifierInsights[0]?.count || 1)) * 100)}%` }} />
                        </div>
                        <span className="text-sm font-bold text-gray-900 w-12 text-right">{m.count}×</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── 5. CRM ─────────────────────────────────────────────── */}
            {data?.crm && (
              <section>
                <SectionTitle>👥 Pelanggan</SectionTitle>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <KpiCard label="Total Pelanggan" value={formatNumber(data.crm.totalCustomers || 0)} />
                  <KpiCard label="Member (punya HP)" value={formatNumber(data.crm.members || 0)} />
                  <KpiCard label="Repeat Customer"
                    value={`${(data.crm.repeatRate || 0).toFixed(0)}%`}
                    variant={(data.crm.repeatRate || 0) > 30 ? 'success' : 'default'}
                    sub={`${data.crm.repeatCustomers || 0} orang`}
                  />
                  <KpiCard label="Poin Beredar" value={formatNumber(data.crm.pointsOutstanding || 0)} sub="belum ditukar" variant="warning" />
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
                              <p className="text-xs" style={{color:"var(--text-2)"}}>{c.visitCount}× kunjungan · {c.points} poin</p>
                            </div>
                          </div>
                          <p className="font-bold text-gray-900">{formatCurrency(c.totalSpent)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ── 6. Production Variance ─────────────────────────────── */}
            {data?.productionVariance?.length > 0 && (
              <section>
                <SectionTitle>🍳 Selisih Produksi Batch</SectionTitle>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="divide-y divide-gray-100">
                    {data.productionVariance.slice(0, 5).map((p: any, i: number) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{p.name}</p>
                          <p className="text-xs" style={{color:"var(--text-2)"}}>Plan {formatNumber(p.planned)} → Aktual {formatNumber(p.actual)} {p.unit}</p>
                        </div>
                        <div className={clsx('text-sm font-bold', p.variance > 0 ? 'text-emerald-600' : 'text-red-600')}>
                          {p.variance > 0 ? '+' : ''}{formatNumber(p.variance)} {p.unit}
                          <span className="text-xs ml-1 opacity-70">({(p.variancePct || 0).toFixed(1)}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* ── INSIGHT 1: Jam Sibuk per Hari ──────────────────── */}
            {data?.busyByDay && (
              <section>
                <SectionTitle>⏰ Jam & Hari Tersibuk</SectionTitle>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-3 py-2 text-left text-gray-400 font-semibold w-12">Jam</th>
                          {data.busyByDay.map((d: any) => (
                            <th key={d.day} className="px-2 py-2 text-center text-gray-500 font-semibold">{d.day}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: 17 }, (_, i) => i + 6).map(hour => {
                          const maxOrders = Math.max(...data.busyByDay.flatMap((d: any) => d.hours.map((h: any) => h.orders)));
                          return (
                            <tr key={hour} className="border-b border-gray-100 last:border-0">
                              <td className="px-3 py-1.5 text-gray-400 font-mono">{String(hour).padStart(2,'0')}:00</td>
                              {data.busyByDay.map((d: any) => {
                                const h = d.hours.find((h: any) => h.hour === hour);
                                const intensity = maxOrders > 0 ? (h?.orders || 0) / maxOrders : 0;
                                const bg = intensity === 0 ? 'transparent'
                                  : intensity < 0.3 ? 'rgba(72,101,77,0.1)'
                                  : intensity < 0.6 ? 'rgba(72,101,77,0.3)'
                                  : intensity < 0.85 ? 'rgba(72,101,77,0.6)'
                                  : 'rgba(72,101,77,0.9)';
                                const textColor = intensity >= 0.6 ? '#fff' : '#48654D';
                                return (
                                  <td key={d.day} className="px-2 py-1.5 text-center" style={{ background: bg }}>
                                    {(h?.orders || 0) > 0 && (
                                      <span className="font-bold text-[10px]" style={{ color: textColor }}>{h.orders}</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center gap-4">
                    <span className="text-xs" style={{color:"var(--text-2)"}}>Intensitas:</span>
                    {[['Sepi','rgba(72,101,77,0.1)','#48654D'],['Ramai','rgba(72,101,77,0.6)','#fff'],['Peak','rgba(72,101,77,0.9)','#fff']].map(([label, bg, color]) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded" style={{ background: bg }} />
                        <span className="text-xs text-gray-500">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* ── INSIGHT 2: Menu Engineering Matrix ─────────────── */}
            {data?.menuMatrix?.length > 0 && (
              <section>
                <SectionTitle>🎯 Menu Engineering</SectionTitle>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {[
                    { q: 'star',      label: '⭐ Star',      desc: 'Laku + margin tinggi → Push!',      color: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
                    { q: 'plowhorse', label: '🐴 Plowhorse', desc: 'Laku + margin rendah → Naikkan harga', color: 'bg-blue-50 border-blue-200',    badge: 'bg-blue-100 text-blue-700' },
                    { q: 'puzzle',    label: '🧩 Puzzle',    desc: 'Jarang + margin tinggi → Promosiin', color: 'bg-amber-50 border-amber-200',   badge: 'bg-amber-100 text-amber-700' },
                    { q: 'dog',       label: '🐕 Dog',       desc: 'Jarang + margin rendah → Evaluasi',  color: 'bg-red-50 border-red-200',       badge: 'bg-red-100 text-red-700' },
                  ].map(({ q, label, desc, color, badge }) => {
                    const items = data.menuMatrix.filter((p: any) => p.quadrant === q);
                    return (
                      <div key={q} className={clsx('rounded-xl border p-4', color)}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-gray-900 text-sm">{label}</span>
                          <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full', badge)}>{items.length} menu</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{desc}</p>
                        <div className="space-y-1">
                          {items.slice(0, 4).map((p: any) => (
                            <div key={p.name} className="flex items-center justify-between">
                              <span className="text-xs text-gray-700 truncate max-w-[60%]">{p.name}</span>
                              <span className="text-xs font-semibold text-gray-600">{(p.margin || 0).toFixed(0)}%</span>
                            </div>
                          ))}
                          {items.length > 4 && <p className="text-xs" style={{color:"var(--text-2)"}}>+{items.length - 4} lainnya</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── INSIGHT 3: Food Cost % per Kategori ────────────── */}
            {data?.foodCostByCategory?.length > 0 && (
              <section>
                <SectionTitle>🍳 Food Cost % per Kategori</SectionTitle>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/> &lt;28% Excellent</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"/> 28-35% Good</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"/> 35-45% Warning</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/> &gt;45% Danger</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {data.foodCostByCategory.map((c: any) => {
                      const statusColor = c.status === 'excellent' ? 'text-emerald-600 bg-emerald-50'
                        : c.status === 'good' ? 'text-blue-600 bg-blue-50'
                        : c.status === 'warning' ? 'text-amber-600 bg-amber-50'
                        : c.status === 'danger' ? 'text-red-600 bg-red-50'
                        : 'text-gray-500 bg-gray-50';
                      const barColor = c.status === 'excellent' ? 'bg-emerald-500'
                        : c.status === 'good' ? 'bg-blue-500'
                        : c.status === 'warning' ? 'bg-amber-500'
                        : 'bg-red-500';
                      return (
                        <div key={c.category} className="px-4 py-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-semibold text-sm text-gray-900">{c.category}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs" style={{color:"var(--text-2)"}}>{formatCurrency(c.revenue)} omzet</span>
                              <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full', statusColor)}>
                                {(c.foodCostPct || 0).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className={clsx('h-1.5 rounded-full', barColor)}
                              style={{ width: `${Math.min(100, c.foodCostPct || 0)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* ── INSIGHT 4: Repeat Rate Trend ───────────────────── */}
            {data?.repeatRateTrend && (
              <section>
                <SectionTitle>🔄 Repeat Rate 4 Minggu Terakhir</SectionTitle>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="grid grid-cols-4 gap-3">
                    {data.repeatRateTrend.map((w: any, i: number) => {
                      const isLatest = i === data.repeatRateTrend.length - 1;
                      const prev = i > 0 ? data.repeatRateTrend[i-1].repeatRate : null;
                      const trend = prev !== null ? w.repeatRate - prev : 0;
                      return (
                        <div key={w.week} className={clsx('rounded-xl p-3 text-center', isLatest ? 'bg-brand-50 border border-brand-200' : 'bg-gray-50')}>
                          <p className="text-xs mb-1" style={{color:"var(--text-2)"}}>{w.week}</p>
                          <p className={clsx('text-2xl font-black', isLatest ? 'text-brand-700' : 'text-gray-700')}>
                            {(w.repeatRate || 0).toFixed(0)}%
                          </p>
                          <p className="text-xs mt-0.5" style={{color:"var(--text-2)"}}>{w.uniqueCustomers} pelanggan</p>
                          {trend !== 0 && (
                            <p className={clsx('text-xs font-semibold mt-1', trend > 0 ? 'text-emerald-600' : 'text-red-500')}>
                              {trend > 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs mt-3 text-center" style={{color:"var(--text-2)"}}>
                    Repeat rate = % order dari pelanggan yang pernah order sebelumnya. Target &gt;30%.
                  </p>
                </div>
              </section>
            )}

            {/* ── INSIGHT 5: Waste-to-Revenue ────────────────────── */}
            {data?.wasteRatio && (
              <section>
                <SectionTitle>🗑️ Waste-to-Revenue Ratio</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  {[
                    { label: 'Total Waste', value: formatCurrency(data.wasteRatio.totalWasteValue || 0) },
                    { label: 'Omzet Periode', value: formatCurrency(data.wasteRatio.revenueInPeriod || 0) },
                    {
                      label: 'Waste Ratio',
                      value: `${(data.wasteRatio.ratio || 0).toFixed(2)}%`,
                      variant: data.wasteRatio.status === 'excellent' ? 'positive'
                        : data.wasteRatio.status === 'good' ? 'default'
                        : data.wasteRatio.status === 'warning' ? 'warning' : 'negative',
                    },
                  ].map(s => (
                    <div key={s.label} className={clsx(
                      'rounded-xl border p-4',
                      s.variant === 'positive' ? 'bg-emerald-50 border-emerald-200'
                      : s.variant === 'warning' ? 'bg-amber-50 border-amber-200'
                      : s.variant === 'negative' ? 'bg-red-50 border-red-200'
                      : 'bg-white border-gray-200'
                    )}>
                      <p className="text-xs uppercase tracking-wide font-semibold" style={{color:"var(--text-2)"}}>{s.label}</p>
                      <p className={clsx('text-2xl font-black mt-1',
                        s.variant === 'positive' ? 'text-emerald-700'
                        : s.variant === 'warning' ? 'text-amber-700'
                        : s.variant === 'negative' ? 'text-red-700'
                        : 'text-gray-900'
                      )}>{s.value}</p>
                      {s.variant && (
                        <p className="text-xs mt-1 font-medium" style={{ color: 'inherit' }}>
                          {data.wasteRatio.status === 'excellent' ? '✅ Sangat baik (<2%)'
                          : data.wasteRatio.status === 'good' ? '👍 Wajar (2-5%)'
                          : data.wasteRatio.status === 'warning' ? '⚠️ Perlu perhatian (5-10%)'
                          : '🚨 Kritis (>10%)'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                {data.wasteRatio.topWastedItems?.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-700">Bahan paling banyak terbuang</p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {data.wasteRatio.topWastedItems.map((item: any, i: number) => (
                        <div key={i} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.name}</p>
                            <p className="text-xs" style={{color:"var(--text-2)"}}>{formatNumber(item.qty)} {item.unit} terbuang</p>
                          </div>
                          <p className="font-bold text-red-600 text-sm">{formatCurrency(item.value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

          </div>
        )}
      </div>
    </AdminLayout>
  );
}