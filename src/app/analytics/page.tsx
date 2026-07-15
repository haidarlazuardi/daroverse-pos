'use client';
import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/fetch';
import { formatCurrency } from '@/components/ui';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';

const CHART_TYPES = [
  { id: 'revenue',     label: 'Revenue Trend',        icon: '📈' },
  { id: 'best_seller', label: 'Best Seller',           icon: '🏆' },
  { id: 'peak_hours',  label: 'Peak Hours',            icon: '⏰' },
  { id: 'category',    label: 'Kategori',              icon: '🍩' },
  { id: 'payment',     label: 'Metode Pembayaran',     icon: '💳' },
  { id: 'retention',   label: 'Customer Retention',    icon: '👥' },
];

const PERIODS = [
  { label: '7 hari',   days: 7 },
  { label: '30 hari',  days: 30 },
  { label: '3 bulan',  days: 90 },
];

const COLORS = ['#48654D','#7BA07F','#A8C5A0','#D4E8D6','#2D4A32','#1a2e1f','#F6EDDB','#E8D5B0'];

const fmt = (v: number) => formatCurrency(v).replace('Rp ', '');

export default function AnalyticsPage() {
  const [chartType, setChartType]   = useState('revenue');
  const [period, setPeriod]         = useState(30);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');
  const [data, setData]             = useState<any>(null);
  const [loading, setLoading]       = useState(false);
  const [target, setTarget]         = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const now   = new Date();
    const from  = customFrom || new Date(now.getTime() - period * 86400000).toISOString().slice(0, 10);
    const to    = customTo   || now.toISOString().slice(0, 10);
    try {
      const [res, tgt] = await Promise.all([
        api.get<any>(`/api/analytics?type=${chartType}&from=${from}&to=${to}`),
        api.get<any>(`/api/monthly-targets?year=${now.getFullYear()}&month=${now.getMonth() + 1}`),
      ]);
      setData(res);
      setTarget(tgt);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [chartType, period, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);

  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const dailyRevTarget = target ? target.revenueTarget / daysInMonth : 0;

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="page-header">
          <div>
            <h1 className="page-title">Analitik</h1>
            <p className="page-subtitle">Insight performa bisnis Soeka House</p>
          </div>
        </div>

        {/* Chart selector */}
        <div className="flex gap-2 flex-wrap">
          {CHART_TYPES.map(c => (
            <button key={c.id} onClick={() => setChartType(c.id)}
              className="px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all"
              style={chartType === c.id
                ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' }
                : { borderColor: 'var(--border-md)', color: 'var(--text-2)' }}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        {/* Period filter */}
        <div className="flex gap-2 items-center flex-wrap">
          {PERIODS.map(p => (
            <button key={p.days} onClick={() => { setPeriod(p.days); setCustomFrom(''); setCustomTo(''); }}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-all"
              style={period === p.days && !customFrom
                ? { background: 'var(--surface-3)', borderColor: 'var(--brand)', color: 'var(--brand)' }
                : { borderColor: 'var(--border)', color: 'var(--text-2)' }}>
              {p.label}
            </button>
          ))}
          <div className="flex items-center gap-1">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="input text-sm py-1.5" style={{ width: 130 }} />
            <span className="text-xs text-gray-400">—</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="input text-sm py-1.5" style={{ width: 130 }} />
          </div>
        </div>

        {/* Chart area */}
        <div className="card p-5">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
            </div>
          ) : !data ? (
            <div className="flex justify-center py-20 text-gray-400">Tidak ada data</div>
          ) : (
            <>
              {/* Revenue Trend */}
              {chartType === 'revenue' && Array.isArray(data) && (
                <div>
                  <div className="flex gap-6 mb-4 flex-wrap">
                    {[
                      { label: 'Total Revenue', value: formatCurrency(data.reduce((s: number, d: any) => s + d.revenue, 0)) },
                      { label: 'Total Profit', value: formatCurrency(data.reduce((s: number, d: any) => s + d.profit, 0)) },
                      { label: 'Avg/hari', value: formatCurrency(data.length ? data.reduce((s: number, d: any) => s + d.revenue, 0) / data.length : 0) },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs text-gray-400">{label}</p>
                        <p className="font-bold" style={{ color: 'var(--text-1)' }}>{value}</p>
                      </div>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={data}>
                      <defs>
                        <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#48654D" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#48654D" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="profit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#7BA07F" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#7BA07F" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)}/>
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={fmt}/>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={l => `Tanggal: ${l}`}/>
                      <Legend/>
                      {dailyRevTarget > 0 && <ReferenceLine y={dailyRevTarget} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Target', fill: '#ef4444', fontSize: 10 }}/>}
                      <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#48654D" strokeWidth={2} fill="url(#rev)"/>
                      <Area type="monotone" dataKey="profit"  name="Gross Profit" stroke="#7BA07F" strokeWidth={1.5} fill="url(#profit)"/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Best Seller */}
              {chartType === 'best_seller' && Array.isArray(data) && (
                <div>
                  <ResponsiveContainer width="100%" height={Math.max(300, data.slice(0,10).length * 40)}>
                    <BarChart data={data.slice(0, 10)} layout="vertical" margin={{ left: 120 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                      <XAxis type="number" tick={{ fontSize: 10 }}/>
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={115}/>
                      <Tooltip formatter={(v: number, name: string) => [name === 'revenue' ? formatCurrency(v) : v, name === 'revenue' ? 'Revenue' : 'Qty']}/>
                      <Legend/>
                      <Bar dataKey="qty" name="Qty Terjual" fill="#48654D" radius={[0,4,4,0]}/>
                      <Bar dataKey="revenue" name="Revenue" fill="#A8C5A0" radius={[0,4,4,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Peak Hours */}
              {chartType === 'peak_hours' && Array.isArray(data) && (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.filter((d: any) => d.orders > 0)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                    <XAxis dataKey="hour" tickFormatter={(h: number) => `${h}:00`} tick={{ fontSize: 10 }}/>
                    <YAxis tick={{ fontSize: 10 }}/>
                    <Tooltip labelFormatter={(h: number) => `Jam ${h}:00–${h+1}:00`} formatter={(v: number, name: string) => [name === 'revenue' ? formatCurrency(v) : v, name === 'revenue' ? 'Revenue' : 'Orders']}/>
                    <Legend/>
                    <Bar dataKey="orders" name="Orders" fill="#48654D" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              )}

              {/* Category */}
              {chartType === 'category' && Array.isArray(data) && (
                <div className="flex items-center gap-8">
                  <ResponsiveContainer width="50%" height={280}>
                    <PieChart>
                      <Pie data={data} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${((percent ?? 0)*100).toFixed(0)}%`}>
                        {data.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {data.map((d: any, i: number) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }}/>
                        <span className="text-sm flex-1">{d.name}</span>
                        <span className="text-sm font-bold">{formatCurrency(d.revenue)}</span>
                        <span className="text-xs text-gray-400">{d.qty} item</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment method */}
              {chartType === 'payment' && Array.isArray(data) && (
                <div className="flex items-center gap-8">
                  <ResponsiveContainer width="50%" height={280}>
                    <PieChart>
                      <Pie data={data} dataKey="amount" nameKey="method" cx="50%" cy="50%" outerRadius={100}
                        label={({ method, percent }) => `${method} ${((percent ?? 0)*100).toFixed(0)}%`}>
                        {data.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-3">
                    {data.map((d: any, i: number) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }}/>
                        <span className="text-sm flex-1 font-medium">{d.method}</span>
                        <div className="text-right">
                          <p className="text-sm font-bold">{formatCurrency(d.amount)}</p>
                          <p className="text-xs text-gray-400">{d.count} transaksi</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Retention */}
              {chartType === 'retention' && data && !Array.isArray(data) && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {[
                      { label: 'Pelanggan Baru', value: data.newCustomers, color: '#48654D' },
                      { label: 'Pelanggan Repeat', value: data.repeatCustomers, color: '#7BA07F' },
                      { label: 'Transaksi Tanpa Data', value: data.anonymous, color: '#9CA3AF' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="card p-4">
                        <p className="text-xs text-gray-400">{label}</p>
                        <p className="text-3xl font-black mt-1" style={{ color }}>{value}</p>
                      </div>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={[
                        { name: 'Baru', value: data.newCustomers },
                        { name: 'Repeat', value: data.repeatCustomers },
                        { name: 'Anonim', value: data.anonymous },
                      ]} dataKey="value" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${((percent ?? 0)*100).toFixed(0)}%`}>
                        {[0,1,2].map(i => <Cell key={i} fill={COLORS[i]}/>)}
                      </Pie>
                      <Tooltip/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
