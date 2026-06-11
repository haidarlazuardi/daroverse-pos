'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card, StatCard, Badge, Loader, formatCurrency, formatNumber } from '@/components/ui';
import { api } from '@/lib/fetch';
import clsx from 'clsx';

interface DashboardData {
  summary: { totalRevenue: number; totalCOGS: number; totalProfit: number; totalTransactions: number; avgOrderValue: number; profitMargin: number };
  productPerformance: Array<{ id: string; name: string; category: string; qty: number; revenue: number; profit: number }>;
  menuEngineering: Array<{ id: string; name: string; qty: number; revenue: number; profit: number; margin: number; classification: string }>;
  peakHours: Array<{ hour: number; count: number; revenue: number }>;
  dailyTrend: Array<{ date: string; revenue: number; cost: number; profit: number; orders: number }>;
  alerts: Array<{ name: string; currentStock: number; minStock: number; severity: string; unit: string }>;
}

interface AlertsData {
  stockAlerts: Array<{ name: string; currentStock: number; minStock: number; severity: string; unit: string }>;
  predictions: Array<{ name: string; currentStock: number; avgDailyUsage: number; daysUntilOut: number; stockoutDate: string; severity: string; unit: string }>;
  marginAlerts: Array<{ name: string; price: number; cost: number; margin: number }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [alerts, setAlerts] = useState<AlertsData | null>(null);
  const [expenses, setExpenses] = useState<{ total: number; byCategory: Record<string, number> } | null>(null);
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [d, a] = await Promise.all([
        api.get<DashboardData>(`/api/dashboard?period=${period}`),
        api.get<AlertsData>('/api/alerts').catch(() => null),
      ]);
      setData(d);
      if (a) setAlerts(a);

      // Get expenses for current period
      try {
        const now = new Date();
        let from: string;
        if (period === 'today') from = now.toISOString().slice(0, 10);
        else if (period === 'week') from = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
        else if (period === 'month') from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        else from = `${now.getFullYear()}-01-01`;
        const exp = await api.get<any>(`/api/expenses?from=${from}&to=${now.toISOString().slice(0, 10)}`);
        setExpenses({ total: exp.total, byCategory: exp.byCategory });
      } catch {}
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const classIcons: Record<string, { label: string; color: string }> = {
    star: { label: '⭐ Star', color: 'text-amber-600 bg-amber-50' },
    plowhorse: { label: '🐴 Plowhorse', color: 'text-blue-600 bg-blue-50' },
    puzzle: { label: '🧩 Puzzle', color: 'text-purple-600 bg-purple-50' },
    dog: { label: '🐕 Dog', color: 'text-surface-500 bg-surface-50' },
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><h2 className="text-2xl font-bold text-surface-900 tracking-tight">Dashboard</h2><p className="text-surface-500 text-sm mt-1">Business overview and analytics</p></div>
          <div className="flex gap-1.5 bg-white border border-surface-200 rounded-xl p-1">
            {['today', 'week', 'month', 'year'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={clsx('px-4 py-1.5 text-sm font-medium rounded-lg transition-all capitalize', period === p ? 'bg-surface-900 text-white' : 'text-surface-600 hover:bg-surface-50')}>{p}</button>
            ))}
          </div>
        </div>

        {loading || !data ? <Loader /> : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard label="Revenue" value={formatCurrency(data.summary.totalRevenue)}
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>} />
              <StatCard label="Transactions" value={formatNumber(data.summary.totalTransactions)} sub={`Avg ${formatCurrency(data.summary.avgOrderValue)}`} />
              <StatCard label="COGS" value={formatCurrency(data.summary.totalCOGS)} />
              <StatCard label="Expenses" value={formatCurrency(expenses?.total || 0)} />
              <StatCard label="Net Profit" value={formatCurrency(data.summary.totalProfit - (expenses?.total || 0))}
                sub={`${data.summary.profitMargin.toFixed(1)}% gross margin`} />
            </div>

            {/* Alerts Row */}
            {alerts && (alerts.stockAlerts.length > 0 || alerts.predictions.length > 0 || alerts.marginAlerts.length > 0) && (
              <div className="grid lg:grid-cols-3 gap-4">
                {/* Low Stock */}
                {alerts.stockAlerts.length > 0 && (
                  <Card>
                    <h3 className="font-bold text-surface-900 mb-3 flex items-center gap-2">
                      <span className="text-amber-500">⚠️</span> Low Stock ({alerts.stockAlerts.length})
                    </h3>
                    <div className="space-y-2">
                      {alerts.stockAlerts.slice(0, 5).map(a => (
                        <div key={a.name} className="flex items-center justify-between text-sm">
                          <span className="text-surface-700">{a.name}</span>
                          <Badge variant={a.severity === 'critical' ? 'danger' : 'warning'}>{a.currentStock} {a.unit}</Badge>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Predicted Stockouts */}
                {alerts.predictions.length > 0 && (
                  <Card>
                    <h3 className="font-bold text-surface-900 mb-3 flex items-center gap-2">
                      <span className="text-red-500">📉</span> Predicted Stockout
                    </h3>
                    <div className="space-y-2">
                      {alerts.predictions.slice(0, 5).map(p => (
                        <div key={p.name} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="text-surface-700">{p.name}</span>
                            <span className="text-xs text-surface-400 ml-1">({p.avgDailyUsage}/{p.unit}/day)</span>
                          </div>
                          <Badge variant={p.severity === 'critical' ? 'danger' : p.severity === 'high' ? 'warning' : 'info'}>
                            {p.daysUntilOut < 1 ? 'TODAY' : `${p.daysUntilOut}d left`}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Negative Margin */}
                {alerts.marginAlerts.length > 0 && (
                  <Card>
                    <h3 className="font-bold text-surface-900 mb-3 flex items-center gap-2">
                      <span className="text-red-500">💸</span> Negative Margin ({alerts.marginAlerts.length})
                    </h3>
                    <div className="space-y-2">
                      {alerts.marginAlerts.map(a => (
                        <div key={a.name} className="flex items-center justify-between text-sm">
                          <span className="text-surface-700">{a.name}</span>
                          <span className="text-red-600 font-bold">{formatCurrency(a.margin)}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Revenue Trend */}
              <Card>
                <h3 className="font-bold text-surface-900 mb-4">Revenue Trend</h3>
                {data.dailyTrend.length > 0 ? (
                  <div className="space-y-2">
                    {data.dailyTrend.slice(-10).map(day => {
                      const maxRev = Math.max(...data.dailyTrend.map(d => d.revenue), 1);
                      return (
                        <div key={day.date} className="flex items-center gap-3 text-sm">
                          <span className="text-surface-500 w-20 text-xs">{day.date.slice(5)}</span>
                          <div className="flex-1 h-6 bg-surface-50 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${(day.revenue / maxRev) * 100}%` }} />
                          </div>
                          <span className="text-surface-700 font-medium w-24 text-right text-xs">{formatCurrency(day.revenue)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="text-surface-400 text-sm py-8 text-center">No data for this period</p>}
              </Card>

              {/* Peak Hours */}
              <Card>
                <h3 className="font-bold text-surface-900 mb-4">Peak Hours</h3>
                {data.peakHours.length > 0 ? (
                  <div className="grid grid-cols-6 gap-1">
                    {Array.from({ length: 24 }, (_, h) => {
                      const hourData = data.peakHours.find(p => p.hour === h);
                      const maxCount = Math.max(...data.peakHours.map(p => p.count), 1);
                      const intensity = hourData ? hourData.count / maxCount : 0;
                      return (
                        <div key={h} className="aspect-square rounded-lg flex items-center justify-center text-[10px] font-medium"
                          style={{ backgroundColor: intensity > 0 ? `rgba(34, 197, 94, ${0.1 + intensity * 0.8})` : '#f8fafc', color: intensity > 0.5 ? 'white' : '#64748b' }}
                          title={`${h}:00 - ${hourData?.count || 0} orders`}>{h}</div>
                      );
                    })}
                  </div>
                ) : <p className="text-surface-400 text-sm py-8 text-center">No data</p>}
              </Card>

              {/* Top Products */}
              <Card>
                <h3 className="font-bold text-surface-900 mb-4">Top Products</h3>
                <div className="space-y-3">
                  {data.productPerformance.slice(0, 8).map((product, i) => (
                    <div key={product.id} className="flex items-center gap-3">
                      <span className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold', i < 3 ? 'bg-brand-100 text-brand-700' : 'bg-surface-100 text-surface-500')}>{i + 1}</span>
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium text-surface-900 truncate">{product.name}</p><p className="text-xs text-surface-400">{product.qty} sold</p></div>
                      <p className="text-sm font-bold text-surface-700">{formatCurrency(product.revenue)}</p>
                    </div>
                  ))}
                  {data.productPerformance.length === 0 && <p className="text-surface-400 text-sm py-4 text-center">No sales data</p>}
                </div>
              </Card>

              {/* Menu Engineering */}
              <Card>
                <h3 className="font-bold text-surface-900 mb-4">Menu Engineering</h3>
                <div className="space-y-2">
                  {data.menuEngineering.slice(0, 10).map(product => {
                    const cls = classIcons[product.classification] || classIcons.dog;
                    return (
                      <div key={product.id} className="flex items-center justify-between py-2 border-b border-surface-50 last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', cls.color)}>{cls.label}</span>
                          <span className="text-sm text-surface-900 truncate">{product.name}</span>
                        </div>
                        <span className="text-xs text-surface-500 ml-2">{(product.margin * 100).toFixed(0)}%</span>
                      </div>
                    );
                  })}
                  {data.menuEngineering.length === 0 && <p className="text-surface-400 text-sm py-4 text-center">No data</p>}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
