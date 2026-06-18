'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card, Badge, Loader, formatCurrency, formatNumber } from '@/components/ui';
import { api } from '@/lib/fetch';
import clsx from 'clsx';

const LOC_LABEL: Record<string, string> = { GUDANG: 'Gudang', BAR: 'Bar', KITCHEN: 'Dapur' };
const PERIODS = [['today', 'Hari ini'], ['week', '7 hari'], ['month', 'Bulan ini'], ['all', 'Semua']] as const;

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api.get(`/api/analytics?period=${period}`)); } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [period]);
  useEffect(() => { load(); }, [load]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="page-header">
          <div><h2 className="page-title">Analitik</h2><p className="page-subtitle">Kesehatan stok, kebocoran COGS, produksi, modifier & pelanggan</p></div>
          <div className="tab-group">
            {PERIODS.map(([v, l]) => (
              <button key={v} onClick={() => setPeriod(v)} className={clsx('tab-item', period === v ? 'tab-active' : 'tab-inactive')}>{l}</button>
            ))}
          </div>
        </div>

        {loading || !data ? <Loader /> : (
          <div className="space-y-6">
            {/* 2 — COGS leak */}
            <Card>
              <h3 className="font-bold text-gray-900 mb-1">COGS teoritis vs kebocoran</h3>
              <p className="text-xs text-gray-400 mb-4">Kebocoran = buang + selisih opname, dinilai pakai harga terakhir (perkiraan).</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Stat label="Pendapatan" value={formatCurrency(data.cogs.revenue)} />
                <Stat label="COGS teoritis" value={formatCurrency(data.cogs.theoreticalCOGS)} sub={`${data.cogs.theoreticalPct.toFixed(1)}% dari revenue`} />
                <Stat label="Buang" value={formatCurrency(data.cogs.wasteValue)} />
                <Stat label="Selisih opname" value={formatCurrency(data.cogs.shrinkValue)} />
              </div>
              <div className={clsx('rounded-xl p-4 flex items-center justify-between', data.cogs.leakPct > 5 ? 'bg-red-50' : 'bg-emerald-50')}>
                <div>
                  <p className="text-sm text-gray-500">Total kebocoran</p>
                  <p className={clsx('text-2xl font-bold', data.cogs.leakPct > 5 ? 'text-red-600' : 'text-emerald-600')}>{formatCurrency(data.cogs.leakTotal)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">% dari COGS</p>
                  <p className={clsx('text-2xl font-bold', data.cogs.leakPct > 5 ? 'text-red-600' : 'text-emerald-600')}>{data.cogs.leakPct.toFixed(1)}%</p>
                </div>
              </div>
            </Card>

            {/* 1 — Stock by location */}
            <Card>
              <h3 className="font-bold text-gray-900 mb-4">Stok per lokasi</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['GUDANG', 'BAR', 'KITCHEN'] as const).map((loc) => {
                  const items = (data.stockByLocation[loc] || []).filter((i: any) => i.quantity > 0);
                  return (
                    <div key={loc} className="border border-gray-100 rounded-xl p-3">
                      <p className="font-semibold text-gray-700 mb-2">{LOC_LABEL[loc]} <span className="text-xs text-gray-400">({items.length})</span></p>
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {items.map((i: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-gray-600 truncate">{i.name}{i.type === 'PREPPED' && <span className="text-purple-400"> ●</span>}</span>
                            <span className="font-medium text-gray-800">{formatNumber(i.quantity)} {i.unit}</span>
                          </div>
                        ))}
                        {items.length === 0 && <p className="text-xs text-gray-400">Kosong</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* 3 — Production variance */}
            <Card>
              <h3 className="font-bold text-gray-900 mb-4">Variance produksi</h3>
              {data.productionVariance.length === 0 ? (
                <p className="text-sm text-gray-400">Tidak ada selisih hasil produksi pada periode ini.</p>
              ) : (
                <div className="space-y-2">
                  {data.productionVariance.map((p: any, idx: number) => (
                    <div key={idx} className={clsx('flex items-center justify-between p-3 rounded-lg', p.variance < 0 ? 'bg-red-50' : 'bg-emerald-50')}>
                      <div><span className="font-medium">{p.name}</span><span className="text-xs text-gray-500 ml-2">rencana {formatNumber(p.planned)} → hasil {formatNumber(p.actual)} {p.unit}</span></div>
                      <span className={clsx('font-bold', p.variance < 0 ? 'text-red-600' : 'text-emerald-600')}>{p.variance > 0 ? '+' : ''}{formatNumber(p.variance)} ({p.variancePct.toFixed(0)}%)</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* 4 — Modifier insights */}
            <Card>
              <h3 className="font-bold text-gray-900 mb-4">Insight modifier</h3>
              {data.modifierInsights.length === 0 ? (
                <p className="text-sm text-gray-400">Belum ada data modifier.</p>
              ) : (() => {
                const max = Math.max(...data.modifierInsights.map((m: any) => m.count));
                return (
                  <div className="space-y-2">
                    {data.modifierInsights.slice(0, 12).map((m: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-3 text-sm">
                        <span className="w-40 truncate text-gray-600"><span className="text-gray-400">{m.group}:</span> {m.option}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full flex items-center justify-end pr-2 text-[11px] text-white font-medium" style={{ width: `${Math.max(8, (m.count / max) * 100)}%` }}>{m.count}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </Card>

            {/* 5 — CRM */}
            <Card>
              <h3 className="font-bold text-gray-900 mb-4">CRM</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Stat label="Pelanggan" value={formatNumber(data.crm.totalCustomers)} />
                <Stat label="Member (ada HP)" value={formatNumber(data.crm.members)} />
                <Stat label="Repeat rate" value={`${data.crm.repeatRate.toFixed(0)}%`} sub={`${data.crm.repeatCustomers} pelanggan`} />
                <Stat label="Poin beredar" value={formatNumber(data.crm.pointsOutstanding)} />
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Top pelanggan</p>
              <div className="space-y-1">
                {data.crm.topCustomers.map((c: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                    <span>{c.name} <span className="text-gray-400 text-xs">{c.phone || ''}</span></span>
                    <span className="font-medium">{formatCurrency(c.totalSpent)} <span className="text-gray-400 text-xs">· {c.visitCount}x</span></span>
                  </div>
                ))}
                {data.crm.topCustomers.length === 0 && <p className="text-xs text-gray-400">Belum ada pelanggan</p>}
              </div>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
