'use client';
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/fetch';
import { formatCurrency } from '@/components/ui';
import { useAuthStore } from '@/store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

function KPICard({ label, value, sub, trend, target, color = 'var(--brand)' }: {
  label: string; value: string; sub?: string; trend?: number; target?: string; color?: string;
}) {
  const ok = trend !== undefined ? trend >= 100 : null;
  return (
    <div className="card p-4">
      <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="text-2xl font-black mb-0.5" style={{ color: 'var(--text-1)', letterSpacing: '-0.03em' }}>{value}</p>
      {sub && <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>{sub}</p>}
      {target && trend !== undefined && (
        <div className="mt-2">
          <div className="flex justify-between mb-1">
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>Target: {target}</span>
            <span className="text-xs font-bold" style={{ color: ok ? '#16a34a' : '#dc2626' }}>{Math.round(trend)}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(trend, 100)}%`, background: ok ? '#16a34a' : color }} />
          </div>
        </div>
      )}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [today, setToday]       = useState<any>(null);
  const [yesterday, setYest]    = useState<any>(null);
  const [target, setTarget]     = useState<any>(null);
  const [trend7, setTrend7]     = useState<any[]>([]);
  const [topMenu, setTopMenu]   = useState<any[]>([]);
  const [alerts, setAlerts]     = useState<any[]>([]);
  const [shift, setShift]       = useState<any>(null);
  const [expired, setExpired]   = useState<any[]>([]);
  const [customers, setCustomers] = useState<any>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const now  = new Date();
    const yest = new Date(now); yest.setDate(yest.getDate() - 1);
    const d7   = new Date(now); d7.setDate(d7.getDate() - 7);
    const todayStr = now.toISOString().slice(0, 10);
    const yestStr  = yest.toISOString().slice(0, 10);
    const d7Str    = d7.toISOString().slice(0, 10);
    const year = now.getFullYear(), month = now.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();

    Promise.all([
      api.get<any>(`/api/analytics?type=summary&from=${todayStr}&to=${todayStr}`),
      api.get<any>(`/api/analytics?type=summary&from=${yestStr}&to=${yestStr}`),
      api.get<any>(`/api/monthly-targets?year=${year}&month=${month}`),
      api.get<any[]>(`/api/analytics?type=revenue&from=${d7Str}&to=${todayStr}`),
      api.get<any[]>(`/api/analytics?type=best_seller&from=${todayStr}&to=${todayStr}`),
      api.get<any[]>('/api/ingredients?low=1'),
      api.get<any>('/api/shifts?active=true'),
      api.get<any>(`/api/analytics?type=retention&from=${todayStr}&to=${todayStr}`),
    ]).then(([tod, yes, tgt, rev7, menu, low, sh, cust]) => {
      setToday(tod);
      setYest(yes);
      setTarget(tgt);
      setTrend7(rev7 || []);
      setTopMenu((menu || []).slice(0, 5));
      setCustomers(cust);
      setShift(sh?.shift || sh?.[0] || null);

      // Alerts
      const al: any[] = [];
      if ((low || []).length > 0) al.push({ type: 'warning', msg: `Stok rendah: ${(low || []).slice(0,3).map((i: any) => i.name).join(', ')}${(low||[]).length > 3 ? ` +${(low||[]).length-3} lainnya` : ''}` });
      if (!sh?.shift && !sh?.[0]) al.push({ type: 'info', msg: 'Shift belum dibuka hari ini' });
      if (tgt && tod) {
        const dailyRev = tgt.revenueTarget / daysInMonth;
        if (tod.revenue < dailyRev * 0.7) al.push({ type: 'danger', msg: `Revenue hari ini ${Math.round((tod.revenue/dailyRev)*100)}% dari target harian` });
      }
      setAlerts(al);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailyRevTarget = target ? target.revenueTarget / daysInMonth : 0;
  const revTrend    = dailyRevTarget > 0 && today ? (today.revenue / dailyRevTarget) * 100 : undefined;
  const orderTrend  = target && today ? (today.orders / target.ordersPerDay) * 100 : undefined;
  const marginTrend = target && today ? (today.grossMargin / target.grossMarginPct) * 100 : undefined;

  const vsYest = (curr: number, prev: number) => {
    if (!prev) return '';
    const pct = Math.round(((curr - prev) / prev) * 100);
    return `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct)}% vs kemarin`;
  };

  const firstName = user?.name?.split(' ')[0] || 'Owner';

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Greeting */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black" style={{ color: 'var(--text-1)', letterSpacing: '-0.03em' }}>
              {getGreeting()}, {firstName} 👋
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
              {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {shift && <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">● Shift aktif</span>}
            </p>
          </div>
          {!target && (
            <a href="/reports" className="text-xs px-3 py-1.5 rounded-lg border text-amber-700 bg-amber-50 border-amber-200 font-medium">⚠️ Set target bulan ini</a>
          )}
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 ${
                a.type === 'danger' ? 'bg-red-50 text-red-700 border border-red-200' :
                a.type === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                {a.type === 'danger' ? '🚨' : a.type === 'warning' ? '⚠️' : 'ℹ️'} {a.msg}
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
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KPICard label="Revenue Hari Ini" value={formatCurrency(today?.revenue || 0)}
                sub={yesterday ? vsYest(today?.revenue||0, yesterday.revenue) : undefined}
                target={dailyRevTarget > 0 ? formatCurrency(dailyRevTarget) : undefined} trend={revTrend} />
              <KPICard label="Total Order" value={String(today?.orders || 0)}
                sub={yesterday ? vsYest(today?.orders||0, yesterday.orders) : undefined}
                target={target ? String(target.ordersPerDay) : undefined} trend={orderTrend} />
              <KPICard label="Avg Order Value" value={formatCurrency(today?.avgOrder || 0)}
                sub={yesterday ? vsYest(today?.avgOrder||0, yesterday.avgOrder) : undefined} />
              <KPICard label="Gross Margin" value={`${today?.grossMargin || 0}%`}
                sub={`HPP: ${formatCurrency(today?.cogs || 0)}`}
                target={target ? `${target.grossMarginPct}%` : undefined} trend={marginTrend} color="#8b5cf6" />
            </div>

            {/* P&L Strip */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Gross Profit', value: today?.grossProfit || 0, color: '#16a34a' },
                { label: 'Pengeluaran', value: today?.expense || 0, color: '#dc2626' },
                { label: 'Net Profit Est.', value: today?.netProfit || 0, color: (today?.netProfit||0) >= 0 ? '#16a34a' : '#dc2626' },
              ].map(({ label, value, color }) => (
                <div key={label} className="card p-4">
                  <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>{label}</p>
                  <p className="text-xl font-black" style={{ color }}>{formatCurrency(value)}</p>
                </div>
              ))}
            </div>

            {/* Trend 7 Hari + Top Menu */}
            <div className="grid lg:grid-cols-5 gap-4">
              {/* Revenue 7 hari */}
              <div className="card p-4 lg:col-span-3">
                <p className="font-bold mb-3" style={{ color: 'var(--text-1)' }}>📈 Revenue 7 Hari Terakhir</p>
                {trend7.length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: 'var(--text-3)' }}>Belum ada data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={trend7} margin={{ left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} />
                      <YAxis tick={{ fontSize: 9 }} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={l => `Tgl: ${l}`} />
                      {dailyRevTarget > 0 && <ReferenceLine y={dailyRevTarget} stroke="#ef4444" strokeDasharray="3 3" />}
                      <Bar dataKey="revenue" name="Revenue" fill="#48654D" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Top 5 Menu */}
              <div className="card p-4 lg:col-span-2">
                <p className="font-bold mb-3" style={{ color: 'var(--text-1)' }}>🏆 Top Menu Hari Ini</p>
                {topMenu.length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: 'var(--text-3)' }}>Belum ada transaksi</p>
                ) : (
                  <div className="space-y-2.5">
                    {topMenu.map((m, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                          style={{ background: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : 'var(--brand)' }}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-1)' }}>{m.name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-3)' }}>{m.qty}× · {formatCurrency(m.revenue)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Shift + Customer + Stok */}
            <div className="grid lg:grid-cols-3 gap-4">
              {/* Shift info */}
              <div className="card p-4">
                <p className="font-bold mb-3" style={{ color: 'var(--text-1)' }}>🕐 Shift Hari Ini</p>
                {shift ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span style={{ color: 'var(--text-3)' }}>Kasir</span>
                      <span className="font-semibold">{shift.user?.name || '-'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span style={{ color: 'var(--text-3)' }}>Buka</span>
                      <span className="font-semibold">{new Date(shift.openedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span style={{ color: 'var(--text-3)' }}>Status</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${shift.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {shift.status === 'OPEN' ? 'Aktif' : 'Pending Close'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span style={{ color: 'var(--text-3)' }}>Kas awal</span>
                      <span className="font-semibold">{formatCurrency(shift.openingCash || 0)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-2xl mb-1">⏸</p>
                    <p className="text-sm" style={{ color: 'var(--text-3)' }}>Shift belum dibuka</p>
                    <a href="/shift" className="text-xs font-semibold mt-2 inline-block" style={{ color: 'var(--brand)' }}>Buka shift →</a>
                  </div>
                )}
              </div>

              {/* Customer hari ini */}
              <div className="card p-4">
                <p className="font-bold mb-3" style={{ color: 'var(--text-1)' }}>👥 Customer Hari Ini</p>
                {customers ? (
                  <div className="space-y-2">
                    {[
                      { label: 'Dengan data', value: customers.withCustomer, color: 'var(--brand)' },
                      { label: 'Pelanggan baru', value: customers.newCustomers, color: '#7BA07F' },
                      { label: 'Pelanggan repeat', value: customers.repeatCustomers, color: '#f59e0b' },
                      { label: 'Tanpa data', value: customers.anonymous, color: '#9ca3af' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex justify-between items-center">
                        <span className="text-sm" style={{ color: 'var(--text-2)' }}>{label}</span>
                        <span className="text-sm font-bold" style={{ color }}>{value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-center py-4" style={{ color: 'var(--text-3)' }}>Belum ada data</p>
                )}
              </div>

              {/* Ringkasan P&L */}
              <div className="card p-4">
                <p className="font-bold mb-3" style={{ color: 'var(--text-1)' }}>💰 Ringkasan Keuangan</p>
                <div className="space-y-2">
                  {[
                    { label: 'Revenue', value: today?.revenue || 0 },
                    { label: 'COGS', value: -(today?.cogs || 0) },
                    { label: 'Gross Profit', value: today?.grossProfit || 0 },
                    { label: 'Pengeluaran', value: -(today?.expense || 0) },
                    { label: 'Net Profit', value: today?.netProfit || 0 },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center border-b last:border-0 pb-1.5 last:pb-0" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-xs" style={{ color: 'var(--text-2)' }}>{label}</span>
                      <span className="text-xs font-bold" style={{ color: value < 0 ? '#dc2626' : value > 0 ? 'var(--text-1)' : 'var(--text-3)' }}>
                        {value < 0 ? `(${formatCurrency(Math.abs(value))})` : formatCurrency(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
