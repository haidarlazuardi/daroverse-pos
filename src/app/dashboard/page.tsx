'use client';
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/fetch';
import { formatCurrency } from '@/components/ui';

function KPICard({ label, value, sub, trend, target, targetLabel, color = 'var(--brand)' }: {
  label: string; value: string; sub?: string;
  trend?: number; target?: string; targetLabel?: string; color?: string;
}) {
  const achieved = trend !== undefined ? trend >= 100 : null;
  return (
    <div className="card p-4">
      <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="text-2xl font-black mb-1" style={{ color: 'var(--text-1)', letterSpacing: '-0.03em' }}>{value}</p>
      {sub && <p className="text-xs" style={{ color: 'var(--text-3)' }}>{sub}</p>}
      {target && (
        <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{targetLabel || 'Target'}: {target}</span>
            {trend !== undefined && (
              <span className="text-xs font-bold" style={{ color: achieved ? '#16a34a' : '#dc2626' }}>
                {achieved ? '✅' : '⚠️'} {Math.round(trend)}%
              </span>
            )}
          </div>
          {trend !== undefined && (
            <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(trend, 100)}%`, background: achieved ? '#16a34a' : color }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [today, setToday]       = useState<any>(null);
  const [yesterday, setYest]    = useState<any>(null);
  const [target, setTarget]     = useState<any>(null);
  const [topMenu, setTopMenu]   = useState<any[]>([]);
  const [alerts, setAlerts]     = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const now   = new Date();
    const yest  = new Date(now); yest.setDate(yest.getDate() - 1);
    const todayStr = now.toISOString().slice(0, 10);
    const yestStr  = yest.toISOString().slice(0, 10);
    const year  = now.getFullYear();
    const month = now.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();

    Promise.all([
      api.get<any>(`/api/analytics?type=summary&from=${todayStr}&to=${todayStr}`),
      api.get<any>(`/api/analytics?type=summary&from=${yestStr}&to=${yestStr}`),
      api.get<any>(`/api/monthly-targets?year=${year}&month=${month}`),
      api.get<any[]>(`/api/analytics?type=best_seller&from=${todayStr}&to=${todayStr}`),
      api.get<any[]>('/api/ingredients?low=1'),
    ]).then(([tod, yes, tgt, menu, low]) => {
      setToday(tod);
      setYest(yes);
      setTarget(tgt);
      setTopMenu((menu || []).slice(0, 5));

      const alertList: any[] = [];
      if ((low || []).length > 0) alertList.push({ type: 'warning', msg: `${low.length} bahan di bawah minimum stok` });
      if (tgt && tod) {
        const dailyRevTarget = tgt.revenueTarget / daysInMonth;
        if (tod.revenue < dailyRevTarget * 0.8) alertList.push({ type: 'danger', msg: 'Revenue hari ini di bawah 80% target harian' });
        if (tod.grossMargin < tgt.grossMarginPct - 5) alertList.push({ type: 'warning', msg: `Gross margin ${tod.grossMargin}% di bawah target ${tgt.grossMarginPct}%` });
      }
      setAlerts(alertList);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailyRevTarget = target ? target.revenueTarget / daysInMonth : 0;
  const revTrend = dailyRevTarget > 0 && today ? (today.revenue / dailyRevTarget) * 100 : undefined;
  const orderTrend = target && today ? (today.orders / target.ordersPerDay) * 100 : undefined;
  const marginTrend = target && today ? (today.grossMargin / target.grossMarginPct) * 100 : undefined;

  const vsYest = (curr: number, prev: number) => {
    if (!prev) return '';
    const diff = curr - prev;
    const pct  = Math.round((diff / prev) * 100);
    return `${diff >= 0 ? '↑' : '↓'} ${Math.abs(pct)}% vs kemarin`;
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">{now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          {!target && (
            <a href="/reports" className="text-xs px-3 py-1.5 rounded-lg border text-amber-700 bg-amber-50 border-amber-200 font-medium">
              ⚠️ Target belum diset
            </a>
          )}
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className={`px-4 py-2.5 rounded-xl text-sm font-medium ${a.type === 'danger' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                {a.type === 'danger' ? '🚨' : '⚠️'} {a.msg}
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <>
            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KPICard
                label="Revenue Hari Ini"
                value={formatCurrency(today?.revenue || 0)}
                sub={yesterday ? vsYest(today?.revenue || 0, yesterday.revenue) : undefined}
                target={dailyRevTarget > 0 ? formatCurrency(dailyRevTarget) : undefined}
                targetLabel="Target harian"
                trend={revTrend}
              />
              <KPICard
                label="Total Order"
                value={String(today?.orders || 0)}
                sub={yesterday ? vsYest(today?.orders || 0, yesterday.orders) : undefined}
                target={target ? String(target.ordersPerDay) : undefined}
                targetLabel="Target/hari"
                trend={orderTrend}
              />
              <KPICard
                label="Rata-rata Order"
                value={formatCurrency(today?.avgOrder || 0)}
                sub={yesterday ? vsYest(today?.avgOrder || 0, yesterday.avgOrder) : undefined}
              />
              <KPICard
                label="Gross Margin"
                value={`${today?.grossMargin || 0}%`}
                sub={`HPP: ${formatCurrency(today?.cogs || 0)}`}
                target={target ? `${target.grossMarginPct}%` : undefined}
                targetLabel="Target"
                trend={marginTrend}
                color="#8b5cf6"
              />
            </div>

            {/* P&L Hari Ini */}
            <div className="grid grid-cols-3 gap-3">
              <div className="card p-4">
                <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>Gross Profit</p>
                <p className="text-xl font-black" style={{ color: '#16a34a' }}>{formatCurrency(today?.grossProfit || 0)}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>Pengeluaran</p>
                <p className="text-xl font-black" style={{ color: '#dc2626' }}>{formatCurrency(today?.expense || 0)}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>Net Profit Est.</p>
                <p className="text-xl font-black" style={{ color: (today?.netProfit || 0) >= 0 ? '#16a34a' : '#dc2626' }}>
                  {formatCurrency(today?.netProfit || 0)}
                </p>
              </div>
            </div>

            {/* Top Menu + Alerts */}
            <div className="grid lg:grid-cols-2 gap-4">
              {/* Top 5 Menu */}
              <div className="card p-4">
                <p className="font-bold mb-3" style={{ color: 'var(--text-1)' }}>🏆 Top Menu Hari Ini</p>
                {topMenu.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: 'var(--text-3)' }}>Belum ada transaksi hari ini</p>
                ) : (
                  <div className="space-y-2">
                    {topMenu.map((m, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                          style={{ background: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : 'var(--brand)' }}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-1)' }}>{m.name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-3)' }}>{m.qty} terjual</p>
                        </div>
                        <p className="text-sm font-bold flex-shrink-0" style={{ color: 'var(--brand)' }}>{formatCurrency(m.revenue)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick stats */}
              <div className="card p-4 space-y-3">
                <p className="font-bold" style={{ color: 'var(--text-1)' }}>📊 Ringkasan</p>
                {[
                  { label: 'Revenue', value: formatCurrency(today?.revenue || 0) },
                  { label: 'HPP (COGS)', value: formatCurrency(today?.cogs || 0) },
                  { label: 'Gross Profit', value: formatCurrency(today?.grossProfit || 0) },
                  { label: 'Pengeluaran', value: formatCurrency(today?.expense || 0) },
                  { label: 'Net Profit', value: formatCurrency(today?.netProfit || 0) },
                  { label: 'Total Pembelian Bahan', value: formatCurrency(today?.purchase || 0) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center py-1 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-sm" style={{ color: 'var(--text-2)' }}>{label}</span>
                    <span className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
