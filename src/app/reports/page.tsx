'use client';
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/fetch';
import { formatCurrency, Button, Modal } from '@/components/ui';
import { useAuthStore } from '@/store';

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

export default function ReportsPage() {
  const { user } = useAuthStore();
  const now = new Date();
  const [tab, setTab]             = useState<'ringkasan'|'bahan_baku'|'target'|'transaksi'|'produk'|'pembayaran'|'pengeluaran'>('ringkasan');
  const [period, setPeriod]       = useState<'weekly'|'monthly'>('monthly');
  const [selMonth, setSelMonth]   = useState(now.getMonth() + 1);
  const [selYear, setSelYear]     = useState(now.getFullYear());
  const [summary, setSummary]     = useState<any>(null);
  const [bahan, setBahan]         = useState<any>(null);
  const [target, setTarget]       = useState<any>(null);
  const [loading, setLoading]     = useState(false);
  const [targetModal, setTargetModal] = useState(false);
  const [tutupModal, setTutupModal]   = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  const [targetForm, setTargetForm] = useState({
    revenueTarget: '', ordersPerDay: '', grossMarginPct: '', maxExpense: '', maxInventoryValue: '', notes: ''
  });

  useEffect(() => {
    loadData();
  }, [selMonth, selYear, period]);

  async function loadData() {
    setLoading(true);
    const daysInMonth = new Date(selYear, selMonth, 0).getDate();
    const from = period === 'monthly'
      ? `${selYear}-${String(selMonth).padStart(2,'0')}-01`
      : (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0,10); })();
    const to = period === 'monthly'
      ? `${selYear}-${String(selMonth).padStart(2,'0')}-${daysInMonth}`
      : new Date().toISOString().slice(0,10);

    try {
      const [sum, tgt, snap] = await Promise.all([
        api.get<any>(`/api/analytics?type=summary&from=${from}&to=${to}`),
        api.get<any>(`/api/monthly-targets?year=${selYear}&month=${selMonth}`),
        api.get<any>(`/api/inventory-snapshot?year=${selYear}&month=${selMonth}`),
      ]);
      setSummary(sum);
      setTarget(tgt);
      if (tgt) setTargetForm({
        revenueTarget: String(tgt.revenueTarget),
        ordersPerDay: String(tgt.ordersPerDay),
        grossMarginPct: String(tgt.grossMarginPct),
        maxExpense: String(tgt.maxExpense),
        maxInventoryValue: String(tgt.maxInventoryValue),
        notes: tgt.notes || '',
      });

      // Bahan baku report
      const [rawSnap, orders, pos] = await Promise.all([
        api.get<any[]>('/api/ingredients?active=true'),
        api.get<any>(`/api/analytics?type=summary&from=${from}&to=${to}`),
        api.get<any[]>(`/api/purchase-orders?status=COMPLETED&from=${from}&to=${to}`),
      ]);

      const currentValue = (rawSnap || []).reduce((s: number, ing: any) => {
        const qty = (ing.stockLevels || []).reduce((q: number, sl: any) => q + sl.quantity, 0);
        return s + qty * ing.latestPrice;
      }, 0);

      const purchaseValue = (pos || []).reduce((s: number, p: any) => s + p.totalAmount, 0);
      const prevSnap = snap;

      setBahan({
        currentValue: Math.round(currentValue),
        cogs: sum?.cogs || 0,
        purchaseValue: Math.round(purchaseValue),
        prevSnapshotValue: prevSnap?.totalValue || 0,
        shrinkage: prevSnap ? Math.round((prevSnap.totalValue + purchaseValue - (sum?.cogs || 0)) - currentValue) : null,
        snapshotDate: prevSnap?.snapshotDate,
      });
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  async function saveTarget() {
    try {
      await api.post('/api/monthly-targets', {
        year: selYear, month: selMonth,
        revenueTarget:     parseFloat(targetForm.revenueTarget),
        ordersPerDay:      parseInt(targetForm.ordersPerDay),
        grossMarginPct:    parseFloat(targetForm.grossMarginPct),
        maxExpense:        parseFloat(targetForm.maxExpense),
        maxInventoryValue: parseFloat(targetForm.maxInventoryValue),
        notes: targetForm.notes,
      });
      setTargetModal(false);
      loadData();
    } catch (e: any) { alert(e.message || 'Gagal'); }
  }

  async function tutupBulan() {
    setSnapshotting(true);
    try {
      await api.post('/api/inventory-snapshot', { year: selYear, month: selMonth });
      alert('✅ Snapshot stok berhasil disimpan. Generating laporan PDF...');
      // Generate PDF report
      generatePDF();
      setTutupModal(false);
      loadData();
    } catch (e: any) { alert(e.message || 'Gagal'); }
    finally { setSnapshotting(false); }
  }

  function generatePDF() {
    const daysInMonth = new Date(selYear, selMonth, 0).getDate();
    const revenue     = summary?.revenue || 0;
    const cogs        = summary?.cogs    || 0;
    const grossProfit = summary?.grossProfit || 0;
    const grossMargin = summary?.grossMargin || 0;
    const expense     = summary?.expense || 0;
    const netProfit   = summary?.netProfit || 0;
    const orders      = summary?.orders  || 0;
    const avgOrder    = summary?.avgOrder || 0;

    const revTarget  = target?.revenueTarget || 0;
    const revAchieve = revTarget > 0 ? Math.round((revenue / revTarget) * 100) : null;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Laporan ${MONTHS[selMonth-1]} ${selYear} — Soeka House</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 32px; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #48654D; }
      .logo { font-size: 24px; font-weight: 900; color: #48654D; letter-spacing: -1px; }
      .logo-sub { font-size: 11px; color: #666; margin-top: 2px; }
      h2 { font-size: 14px; font-weight: 900; color: #48654D; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1.5px solid #48654D; padding-bottom: 4px; }
      .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
      .kpi { background: #F6EDDB; border-radius: 8px; padding: 10px 12px; }
      .kpi-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #666; margin-bottom: 4px; }
      .kpi-value { font-size: 16px; font-weight: 900; color: #2D4A32; }
      .kpi-sub { font-size: 9px; color: #888; margin-top: 2px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
      th { background: #48654D; color: #fff; padding: 6px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; }
      td { border: 1px solid #ddd; padding: 6px 8px; font-size: 11px; }
      td.num { text-align: right; font-weight: 600; }
      td.label { color: #444; }
      .total-row td { background: #F6EDDB; font-weight: 700; font-size: 12px; }
      .achieve { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 9px; font-weight: 700; }
      .achieve-ok  { background: #dcfce7; color: #16a34a; }
      .achieve-bad { background: #fee2e2; color: #dc2626; }
      .section { margin-bottom: 20px; }
      @media print { body { padding: 16px; } }
    </style></head><body>

    <div class="header">
      <div>
        <div class="logo">SOEKA HOUSE</div>
        <div class="logo-sub">Laporan Bulanan — ${MONTHS[selMonth-1]} ${selYear}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:#666">Digenerate: ${new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' })}</div>
        <div style="font-size:11px;color:#666">Periode: 1–${daysInMonth} ${MONTHS[selMonth-1]} ${selYear}</div>
      </div>
    </div>

    <!-- KPI Utama -->
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Revenue</div><div class="kpi-value">${formatCurrency(revenue)}</div>${revAchieve !== null ? `<div class="kpi-sub"><span class="achieve ${revAchieve >= 100 ? 'achieve-ok' : 'achieve-bad'}">${revAchieve}% dari target</span></div>` : ''}</div>
      <div class="kpi"><div class="kpi-label">Gross Profit</div><div class="kpi-value">${formatCurrency(grossProfit)}</div><div class="kpi-sub">Margin ${grossMargin}%</div></div>
      <div class="kpi"><div class="kpi-label">Net Profit</div><div class="kpi-value">${formatCurrency(netProfit)}</div></div>
      <div class="kpi"><div class="kpi-label">Total Order</div><div class="kpi-value">${orders.toLocaleString('id-ID')}</div><div class="kpi-sub">Avg ${formatCurrency(avgOrder)}/order</div></div>
    </div>

    <h2>Profit & Loss</h2>
    <table>
      <thead><tr><th>Keterangan</th><th style="text-align:right">Jumlah</th><th style="text-align:right">% Revenue</th></tr></thead>
      <tbody>
        <tr><td class="label">Revenue Penjualan</td><td class="num">${formatCurrency(revenue)}</td><td class="num">100%</td></tr>
        <tr><td class="label">HPP / COGS</td><td class="num" style="color:#dc2626">(${formatCurrency(cogs)})</td><td class="num">${revenue > 0 ? Math.round((cogs/revenue)*100) : 0}%</td></tr>
        <tr class="total-row"><td>Gross Profit</td><td class="num">${formatCurrency(grossProfit)}</td><td class="num">${grossMargin}%</td></tr>
        <tr><td class="label">Pengeluaran Operasional</td><td class="num" style="color:#dc2626">(${formatCurrency(expense)})</td><td class="num">${revenue > 0 ? Math.round((expense/revenue)*100) : 0}%</td></tr>
        <tr class="total-row"><td>Net Profit</td><td class="num" style="color:${netProfit >= 0 ? '#16a34a' : '#dc2626'}">${formatCurrency(netProfit)}</td><td class="num">${revenue > 0 ? Math.round((netProfit/revenue)*100) : 0}%</td></tr>
      </tbody>
    </table>

    ${target ? `
    <h2>Pencapaian vs Target</h2>
    <table>
      <thead><tr><th>KPI</th><th style="text-align:right">Target</th><th style="text-align:right">Aktual</th><th style="text-align:right">Pencapaian</th></tr></thead>
      <tbody>
        <tr><td>Revenue Bulanan</td><td class="num">${formatCurrency(target.revenueTarget)}</td><td class="num">${formatCurrency(revenue)}</td><td class="num"><span class="achieve ${revenue >= target.revenueTarget ? 'achieve-ok' : 'achieve-bad'}">${revAchieve}%</span></td></tr>
        <tr><td>Avg Orders/Hari</td><td class="num">${target.ordersPerDay}</td><td class="num">${Math.round(orders/daysInMonth)}</td><td class="num"><span class="achieve ${orders/daysInMonth >= target.ordersPerDay ? 'achieve-ok' : 'achieve-bad'}">${Math.round((orders/daysInMonth/target.ordersPerDay)*100)}%</span></td></tr>
        <tr><td>Gross Margin</td><td class="num">${target.grossMarginPct}%</td><td class="num">${grossMargin}%</td><td class="num"><span class="achieve ${grossMargin >= target.grossMarginPct ? 'achieve-ok' : 'achieve-bad'}">${grossMargin >= target.grossMarginPct ? '✓' : '✗'}</span></td></tr>
        <tr><td>Max Pengeluaran</td><td class="num">${formatCurrency(target.maxExpense)}</td><td class="num">${formatCurrency(expense)}</td><td class="num"><span class="achieve ${expense <= target.maxExpense ? 'achieve-ok' : 'achieve-bad'}">${expense <= target.maxExpense ? '✓ Aman' : '✗ Melebihi'}</span></td></tr>
      </tbody>
    </table>` : ''}

    ${bahan ? `
    <h2>Laporan Bahan Baku</h2>
    <table>
      <thead><tr><th>Keterangan</th><th style="text-align:right">Nilai</th></tr></thead>
      <tbody>
        ${bahan.prevSnapshotValue > 0 ? `<tr><td>Nilai Stok Awal Bulan</td><td class="num">${formatCurrency(bahan.prevSnapshotValue)}</td></tr>` : ''}
        <tr><td>Total Pembelian (PO)</td><td class="num">${formatCurrency(bahan.purchaseValue)}</td></tr>
        <tr><td>COGS Terpakai</td><td class="num" style="color:#dc2626">(${formatCurrency(bahan.cogs)})</td></tr>
        <tr class="total-row"><td>Nilai Stok Akhir (Aktual)</td><td class="num">${formatCurrency(bahan.currentValue)}</td></tr>
        ${bahan.shrinkage !== null ? `<tr><td style="color:${bahan.shrinkage > 0 ? '#dc2626' : '#16a34a'}">Selisih / Shrinkage</td><td class="num" style="color:${bahan.shrinkage > 0 ? '#dc2626' : '#16a34a'}">${formatCurrency(Math.abs(bahan.shrinkage))} ${bahan.shrinkage > 0 ? '(kehilangan)' : '(surplus)'}</td></tr>` : ''}
      </tbody>
    </table>` : ''}

    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #ddd;display:flex;justify-content:space-between">
      <div style="text-align:center;width:200px">
        <div style="border-top:1px solid #000;margin-top:50px;padding-top:6px;font-size:9px">Manager</div>
      </div>
      <div style="text-align:center;width:200px">
        <div style="border-top:1px solid #000;margin-top:50px;padding-top:6px;font-size:9px">Owner</div>
      </div>
    </div>

    <script>window.print();</script>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  }

  const isSenior = ['SUPER_ADMIN','OWNER'].includes(user?.role || '');

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-title">Laporan</h1>
            <p className="page-subtitle">Rekap performa & keuangan Soeka House</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isSenior && (
              <>
                <Button onClick={() => setTargetModal(true)} variant="secondary">
                  🎯 Set Target {MONTHS[selMonth-1]}
                </Button>
                <Button onClick={() => setTutupModal(true)}>
                  📦 Tutup Bulan
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {(['monthly','weekly'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${period === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                {p === 'monthly' ? 'Bulanan' : 'Mingguan'}
              </button>
            ))}
          </div>
          {period === 'monthly' && (
            <>
              <select value={selMonth} onChange={e => setSelMonth(parseInt(e.target.value))} className="select">
                {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
              <select value={selYear} onChange={e => setSelYear(parseInt(e.target.value))} className="select">
                {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
          {[['ringkasan','📊 Ringkasan'],['bahan_baku','🥬 Bahan Baku'],['target','🎯 Target'],['transaksi','🧾 Transaksi'],['produk','🍵 Produk'],['pembayaran','💳 Pembayaran'],['pengeluaran','💸 Pengeluaran']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key as any)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${tab === key ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              style={tab === key ? { borderColor: 'var(--brand)', color: 'var(--brand)' } : {}}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <>
            {/* Tab Ringkasan */}
            {tab === 'ringkasan' && summary && (
              <div className="space-y-4">
                {/* P&L */}
                <div className="card overflow-hidden">
                  <div className="px-4 py-3 font-bold" style={{ background: 'var(--surface-2)', color: 'var(--text-1)' }}>Profit & Loss</div>
                  <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {[
                      { label: 'Revenue', value: summary.revenue, highlight: false },
                      { label: 'HPP / COGS', value: -summary.cogs, highlight: false },
                      { label: 'Gross Profit', value: summary.grossProfit, highlight: true },
                      { label: 'Pengeluaran Operasional', value: -summary.expense, highlight: false },
                      { label: 'Net Profit', value: summary.netProfit, highlight: true, big: true },
                    ].map(({ label, value, highlight, big }) => (
                      <div key={label} className={`flex justify-between px-4 py-3 ${highlight ? 'font-bold' : ''}`}
                        style={{ background: highlight ? 'var(--surface-2)' : 'white' }}>
                        <span style={{ color: 'var(--text-2)', fontSize: big ? 14 : 13 }}>{label}</span>
                        <span style={{ color: value < 0 ? '#dc2626' : value > 0 && highlight ? '#16a34a' : 'var(--text-1)', fontSize: big ? 16 : 13 }}>
                          {value < 0 ? `(${formatCurrency(Math.abs(value))})` : formatCurrency(value)}
                          {label === 'Gross Profit' && ` — ${summary.grossMargin}%`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* vs Target */}
                {target && (
                  <div className="card overflow-hidden">
                    <div className="px-4 py-3 font-bold" style={{ background: 'var(--surface-2)', color: 'var(--text-1)' }}>Pencapaian vs Target</div>
                    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                      {[
                        { label: 'Revenue', actual: summary.revenue, tgt: target.revenueTarget, fmt: (v: number) => formatCurrency(v) },
                        { label: 'Gross Margin', actual: summary.grossMargin, tgt: target.grossMarginPct, fmt: (v: number) => `${v}%` },
                        { label: 'Pengeluaran (max)', actual: summary.expense, tgt: target.maxExpense, fmt: (v: number) => formatCurrency(v), invert: true },
                      ].map(({ label, actual, tgt: t, fmt: f, invert }) => {
                        const pct   = t > 0 ? Math.round((actual / t) * 100) : 0;
                        const ok    = invert ? actual <= t : actual >= t;
                        return (
                          <div key={label} className="px-4 py-3">
                            <div className="flex justify-between mb-1.5">
                              <span className="text-sm" style={{ color: 'var(--text-2)' }}>{label}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">Target: {f(t)}</span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {ok ? '✅' : '⚠️'} {f(actual)}
                                </span>
                              </div>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-gray-100">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: ok ? '#16a34a' : '#ef4444' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button onClick={generatePDF}
                  className="w-full py-3 rounded-xl font-bold text-white transition-all active:scale-95"
                  style={{ background: 'var(--brand)' }}>
                  🖨️ Export PDF Laporan {MONTHS[selMonth-1]} {selYear}
                </button>
              </div>
            )}

            {/* Tab Bahan Baku */}
            {tab === 'bahan_baku' && bahan && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Nilai Stok Sekarang', value: formatCurrency(bahan.currentValue), color: 'var(--brand)' },
                    { label: 'COGS Periode Ini', value: formatCurrency(bahan.cogs), color: '#dc2626' },
                    { label: 'Total Pembelian (PO)', value: formatCurrency(bahan.purchaseValue), color: 'var(--text-1)' },
                    { label: 'Shrinkage', value: bahan.shrinkage !== null ? formatCurrency(Math.abs(bahan.shrinkage)) : 'Belum ada snapshot', color: bahan.shrinkage > 0 ? '#dc2626' : '#16a34a' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="card p-4">
                      <p className="text-xs text-gray-400 mb-1">{label}</p>
                      <p className="text-xl font-black" style={{ color }}>{value}</p>
                    </div>
                  ))}
                </div>

                {bahan.shrinkage === null && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
                    ⚠️ Belum ada snapshot stok awal bulan untuk periode ini. Klik "Tutup Bulan" di akhir bulan untuk generate snapshot dan menghitung shrinkage.
                  </div>
                )}

                {bahan.shrinkage !== null && (
                  <div className="card overflow-hidden">
                    <div className="px-4 py-3 font-bold" style={{ background: 'var(--surface-2)' }}>Rekonsiliasi Bahan Baku</div>
                    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                      {[
                        { label: 'Nilai Stok Awal Bulan', value: bahan.prevSnapshotValue },
                        { label: '+ Pembelian (PO)', value: bahan.purchaseValue },
                        { label: '- COGS Terpakai', value: -bahan.cogs },
                        { label: '= Stok Teoritis', value: bahan.prevSnapshotValue + bahan.purchaseValue - bahan.cogs },
                        { label: 'Stok Aktual (Snapshot)', value: bahan.currentValue },
                        { label: 'Selisih / Shrinkage', value: -bahan.shrinkage, highlight: true },
                      ].map(({ label, value, highlight }) => (
                        <div key={label} className={`flex justify-between px-4 py-3 ${highlight ? 'font-bold' : ''}`}
                          style={{ background: highlight ? 'var(--surface-2)' : 'white' }}>
                          <span className="text-sm" style={{ color: 'var(--text-2)' }}>{label}</span>
                          <span className="text-sm font-semibold" style={{ color: value < 0 ? '#dc2626' : 'var(--text-1)' }}>
                            {value < 0 ? `(${formatCurrency(Math.abs(value))})` : formatCurrency(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab Target */}
            {tab === 'target' && (
              <div className="space-y-3">
                {target ? (
                  <div className="card overflow-hidden">
                    <div className="px-4 py-3 flex justify-between" style={{ background: 'var(--surface-2)' }}>
                      <span className="font-bold">Target {MONTHS[selMonth-1]} {selYear}</span>
                      {isSenior && <button onClick={() => setTargetModal(true)} className="text-xs font-medium" style={{ color: 'var(--brand)' }}>Edit</button>}
                    </div>
                    {[
                      { label: 'Revenue Bulanan', value: formatCurrency(target.revenueTarget) },
                      { label: 'Orders per Hari', value: `${target.ordersPerDay} order` },
                      { label: 'Gross Margin', value: `${target.grossMarginPct}%` },
                      { label: 'Maks Pengeluaran', value: formatCurrency(target.maxExpense) },
                      { label: 'Maks Nilai Bahan Baku', value: formatCurrency(target.maxInventoryValue) },
                      ...(target.notes ? [{ label: 'Catatan', value: target.notes }] : []),
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between px-4 py-3 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                        <span className="text-sm" style={{ color: 'var(--text-2)' }}>{label}</span>
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="card p-8 text-center">
                    <p className="text-3xl mb-3">🎯</p>
                    <p className="font-semibold mb-2" style={{ color: 'var(--text-1)' }}>Belum ada target untuk {MONTHS[selMonth-1]} {selYear}</p>
                    {isSenior && <Button onClick={() => setTargetModal(true)}>Set Target Sekarang</Button>}
                  </div>
                )}
              </div>
            )}

            {/* Tab Transaksi */}
            {tab === 'transaksi' && (
              <TransaksiTab year={selYear} month={selMonth}/>
            )}

            {/* Tab Produk */}
            {tab === 'produk' && (
              <ProdukTab year={selYear} month={selMonth}/>
            )}

            {/* Tab Pembayaran */}
            {tab === 'pembayaran' && (
              <PembayaranTab year={selYear} month={selMonth}/>
            )}

            {/* Tab Pengeluaran */}
            {tab === 'pengeluaran' && (
              <PengeluaranTab year={selYear} month={selMonth}/>
            )}
          </>
        )}
      </div>

      {/* Target Modal */}
      <Modal open={targetModal} onClose={() => setTargetModal(false)} title={`Set Target — ${MONTHS[selMonth-1]} ${selYear}`}>
        <div className="space-y-3">
          {[
            { key: 'revenueTarget', label: 'Target Revenue Bulanan (Rp)', placeholder: '90000000' },
            { key: 'ordersPerDay',  label: 'Target Order per Hari',         placeholder: '50' },
            { key: 'grossMarginPct',label: 'Target Gross Margin (%)',        placeholder: '65' },
            { key: 'maxExpense',    label: 'Maks Pengeluaran Bulanan (Rp)', placeholder: '20000000' },
            { key: 'maxInventoryValue', label: 'Maks Nilai Bahan Baku (Rp)', placeholder: '15000000' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input className="input" type="number" placeholder={placeholder}
                value={targetForm[key as keyof typeof targetForm]}
                onChange={e => setTargetForm(p => ({ ...p, [key]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label className="label">Catatan</label>
            <textarea className="input" rows={2} value={targetForm.notes}
              onChange={e => setTargetForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Catatan strategi bulan ini..." />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setTargetModal(false)} className="btn btn-secondary btn-md">Batal</button>
            <Button onClick={saveTarget}>Simpan Target</Button>
          </div>
        </div>
      </Modal>

      {/* Tutup Bulan Modal */}
      <Modal open={tutupModal} onClose={() => setTutupModal(false)} title="Tutup Bulan">
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-sm font-semibold text-amber-800 mb-1">⚠️ Yang akan terjadi:</p>
            <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
              <li>Snapshot nilai stok semua bahan disimpan untuk {MONTHS[selMonth-1]} {selYear}</li>
              <li>Laporan PDF bulan ini otomatis di-generate</li>
              <li>Data ini digunakan untuk menghitung shrinkage bulan depan</li>
            </ul>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            Pastikan semua transaksi, pengeluaran, dan penerimaan PO sudah diinput sebelum tutup bulan.
          </p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setTutupModal(false)} className="btn btn-secondary btn-md">Batal</button>
            <Button onClick={tutupBulan} disabled={snapshotting}>
              {snapshotting ? 'Memproses...' : '📦 Tutup Bulan & Export PDF'}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}

// ── Report Tab Components ─────────────────────────────────────────────────────
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function useReportData(year: number, month: number, type: string) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const from = `${year}-${String(month).padStart(2,'0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    setLoading(true);
    api.get<any>(`/api/analytics?type=${type}&from=${from}&to=${to}`)
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [year, month, type]);
  return { data, loading };
}

function TabLoader() {
  return <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor:'var(--brand)', borderTopColor:'transparent' }}/></div>;
}

function TransaksiTab({ year, month }: { year: number; month: number }) {
  const { data, loading } = useReportData(year, month, 'transactions');
  if (loading) return <TabLoader/>;
  if (!data) return <p className="text-center py-8 text-gray-400">Tidak ada data</p>;
  const orders = data.orders || [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Total Order', orders.length],
          ['Revenue', formatCurrency(data.revenue || 0)],
          ['Avg Order', formatCurrency(data.avgOrder || 0)],
          ['Void', (orders.filter((o: any) => o.status === 'VOIDED').length)],
        ].map(([label, value]) => (
          <div key={label as string} className="card p-4 text-center">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className="font-black text-lg" style={{ color: 'var(--brand)' }}>{value}</p>
          </div>
        ))}
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr style={{ background: 'var(--surface-2)' }}>
            {['Tanggal','Order #','Customer','Total','Metode','Status'].map(h => (
              <th key={h} className="px-3 py-2.5 text-left text-xs font-bold text-gray-400 uppercase">{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {orders.slice(0,50).map((o: any) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-xs text-gray-500">{new Date(o.createdAt).toLocaleDateString('id-ID')}</td>
                <td className="px-3 py-2 text-xs font-mono font-bold">#{o.orderNumber}</td>
                <td className="px-3 py-2 text-xs">{o.billName || o.customer?.name || '—'}</td>
                <td className="px-3 py-2 text-xs font-bold" style={{ color: 'var(--brand)' }}>{formatCurrency(o.total)}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{o.payment?.method || '—'}</td>
                <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-bold ${o.status==='COMPLETED'?'bg-green-100 text-green-700':o.status==='VOIDED'?'bg-red-100 text-red-700':'bg-yellow-100 text-yellow-700'}`}>{o.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProdukTab({ year, month }: { year: number; month: number }) {
  const { data, loading } = useReportData(year, month, 'products');
  if (loading) return <TabLoader/>;
  if (!data) return <p className="text-center py-8 text-gray-400">Tidak ada data</p>;
  const products = data.products || [];
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr style={{ background: 'var(--surface-2)' }}>
          {['#','Produk','Kategori','Terjual','Revenue','% Revenue'].map(h => (
            <th key={h} className="px-3 py-2.5 text-left text-xs font-bold text-gray-400 uppercase">{h}</th>
          ))}
        </tr></thead>
        <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {products.map((p: any, i: number) => (
            <tr key={p.productId} className="hover:bg-gray-50">
              <td className="px-3 py-2.5 text-xs text-gray-400">{i+1}</td>
              <td className="px-3 py-2.5 text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{p.name}</td>
              <td className="px-3 py-2.5 text-xs text-gray-500">{p.category || '—'}</td>
              <td className="px-3 py-2.5 text-sm font-bold" style={{ color: 'var(--brand)' }}>{p.qty?.toLocaleString('id-ID')}</td>
              <td className="px-3 py-2.5 text-sm font-bold">{formatCurrency(p.revenue)}</td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100"><div className="h-full rounded-full" style={{ width: `${p.revenuePct}%`, background: 'var(--brand)' }}/></div>
                  <span className="text-xs text-gray-500">{p.revenuePct?.toFixed(1)}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PembayaranTab({ year, month }: { year: number; month: number }) {
  const { data, loading } = useReportData(year, month, 'payments');
  if (loading) return <TabLoader/>;
  if (!data) return <p className="text-center py-8 text-gray-400">Tidak ada data</p>;
  const methods = data.methods || [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {methods.map((m: any) => (
          <div key={m.method} className="card p-4">
            <p className="text-xs text-gray-400 mb-1">{m.method}</p>
            <p className="font-black text-base" style={{ color: 'var(--brand)' }}>{formatCurrency(m.total)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{m.count} transaksi</p>
          </div>
        ))}
      </div>
      <div className="card p-4">
        <p className="font-bold text-sm mb-3" style={{ color: 'var(--text-1)' }}>Distribusi</p>
        {methods.map((m: any) => (
          <div key={m.method} className="flex items-center gap-3 mb-2">
            <p className="text-sm w-20 text-gray-600">{m.method}</p>
            <div className="flex-1 h-2.5 rounded-full bg-gray-100">
              <div className="h-full rounded-full" style={{ width: `${m.pct}%`, background: 'var(--brand)' }}/>
            </div>
            <p className="text-sm font-bold w-12 text-right" style={{ color: 'var(--brand)' }}>{m.pct?.toFixed(0)}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PengeluaranTab({ year, month }: { year: number; month: number }) {
  const { data, loading } = useReportData(year, month, 'expenses');
  if (loading) return <TabLoader/>;
  if (!data) return <p className="text-center py-8 text-gray-400">Tidak ada data</p>;
  const categories = data.categories || [];
  const items = data.items || [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {categories.map((c: any) => (
          <div key={c.category} className="card p-4">
            <p className="text-xs text-gray-400 mb-1">{c.category}</p>
            <p className="font-black text-base" style={{ color: 'var(--brand)' }}>{formatCurrency(c.total)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.count} item</p>
          </div>
        ))}
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr style={{ background: 'var(--surface-2)' }}>
            {['Tanggal','Kategori','Keterangan','Jumlah'].map(h => (
              <th key={h} className="px-3 py-2.5 text-left text-xs font-bold text-gray-400 uppercase">{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {items.map((e: any) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-3 py-2.5 text-xs text-gray-500">{new Date(e.createdAt).toLocaleDateString('id-ID')}</td>
                <td className="px-3 py-2.5"><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{e.category}</span></td>
                <td className="px-3 py-2.5 text-sm text-gray-700">{e.description}</td>
                <td className="px-3 py-2.5 text-sm font-bold text-red-500">{formatCurrency(e.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
