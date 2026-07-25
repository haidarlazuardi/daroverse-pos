'use client';
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/fetch';
import { formatCurrency } from '@/components/ui';

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const STATUS_COLOR: Record<string, string> = { DRAFT: '#f59e0b', REVIEW: '#3b82f6', APPROVED: '#8b5cf6', PAID: '#16a34a' };
const STATUS_LABEL: Record<string, string> = { DRAFT: 'Draft', REVIEW: 'Review', APPROVED: 'Disetujui', PAID: 'Sudah Dibayar' };
const EMP_LABEL: Record<string, string> = { HELPER: 'Helper', STAFF: 'Staff', MANAGER: 'Manager' };

export default function PayrollPage() {
  const now = new Date();
  const [year, setYear]       = useState(now.getFullYear());
  const [month, setMonth]     = useState(now.getMonth() + 1);
  const [period, setPeriod]   = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [kasbonEdit, setKasbonEdit] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get<any>(`/api/payroll?year=${year}&month=${month}`)
      .then(setPeriod).catch(() => setPeriod(null))
      .finally(() => setLoading(false));
  }, [year, month]);

  async function generate() {
    setGenerating(true);
    try {
      await api.post('/api/payroll', { year, month });
      const p = await api.get<any>(`/api/payroll?year=${year}&month=${month}`);
      setPeriod(p);
    } catch(e: any) { alert(e.message); }
    finally { setGenerating(false); }
  }

  async function updateStatus(action: string) {
    if (!period) return;
    await api.patch('/api/payroll', { periodId: period.id, action });
    const p = await api.get<any>(`/api/payroll?year=${year}&month=${month}`);
    setPeriod(p);
  }

  async function saveRecord() {
    if (!editRecord) return;
    await api.patch('/api/payroll', {
      periodId: period.id, action: 'update_record',
      recordId: editRecord.id, kasbonDeduction: parseFloat(kasbonEdit) || 0,
    });
    setEditRecord(null);
    const p = await api.get<any>(`/api/payroll?year=${year}&month=${month}`);
    setPeriod(p);
  }

  function exportCSV() {
    if (!period?.records) return;
    const rows = [
      ['Nama','Tipe','Hari Hadir','Rate/Hari','Gaji Pokok','Service Charge','Kasbon','Take Home','Bank','No Rekening','Atas Nama'],
      ...period.records.map((r: any) => [
        r.user?.name, EMP_LABEL[r.employeeType]||r.employeeType,
        r.presentDays, r.dailyRate, r.baseSalary,
        Math.round(r.serviceCharge), r.kasbonDeduction, Math.round(r.totalAmount),
        r.bankName||'', r.bankAccount||'', r.bankAccountName||'',
      ]),
    ];
    const csv  = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `payroll-${year}-${String(month).padStart(2,'0')}.csv`;
    a.click();
  }

  const canEdit = period?.status === 'DRAFT' || period?.status === 'REVIEW';

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black" style={{ color: 'var(--text-1)' }}>Payroll</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Penggajian karyawan Soeka House</p>
          </div>
          <div className="flex gap-2">
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="input py-1.5 text-sm">
              {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="input py-1.5 text-sm">
              {[2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }}/>
          </div>
        ) : !period ? (
          <div className="card text-center py-16">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-bold mb-1" style={{ color: 'var(--text-1)' }}>Belum ada payroll {MONTHS[month-1]} {year}</p>
            <p className="text-sm mb-6" style={{ color: 'var(--text-3)' }}>Generate untuk menghitung gaji otomatis dari data absensi + revenue</p>
            <button onClick={generate} disabled={generating} className="btn btn-primary btn-md mx-auto">
              {generating ? '⏳ Menghitung...' : '⚡ Generate Payroll'}
            </button>
          </div>
        ) : (<>
          {/* KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Revenue Bulan Ini', value: formatCurrency(period.totalRevenue) },
              { label: 'Pool SC (5%)', value: formatCurrency(period.serviceChargePool) },
              { label: 'Karyawan', value: `${period.records?.length||0} orang` },
              { label: 'Total Payout', value: formatCurrency(period.totalPayout), hi: true },
            ].map(({ label, value, hi }) => (
              <div key={label} className="card p-4">
                <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>{label}</p>
                <p className="text-xl font-black" style={{ color: hi ? 'var(--brand)' : 'var(--text-1)' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Status bar */}
          <div className="card p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold" style={{ color: 'var(--text-2)' }}>Status:</span>
              <span className="text-xs px-3 py-1 rounded-full font-bold"
                style={{ background: `${STATUS_COLOR[period.status]}20`, color: STATUS_COLOR[period.status] }}>
                {STATUS_LABEL[period.status]}
              </span>
              {period.paidAt && <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                Dibayar: {new Date(period.paidAt).toLocaleDateString('id-ID')}
              </span>}
            </div>
            <div className="flex gap-2 flex-wrap">
              {period.status !== 'PAID' && (
                <button onClick={generate} disabled={generating} className="btn btn-secondary btn-sm">
                  {generating ? '...' : '🔄 Regenerate'}
                </button>
              )}
              <button onClick={exportCSV} className="btn btn-secondary btn-sm">📥 Export CSV</button>
              {period.status === 'DRAFT' && (
                <button onClick={() => updateStatus('approve')} className="btn btn-primary btn-sm">✓ Approve</button>
              )}
              {period.status === 'APPROVED' && (
                <button onClick={() => updateStatus('paid')} className="btn btn-primary btn-sm">💸 Sudah Dibayar</button>
              )}
            </div>
          </div>

          {/* Records */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    {['Karyawan','Tipe','Hadir','Rate/Hari','Gaji Pokok','Service Charge','Kasbon','Take Home',''].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--text-3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {(period.records||[]).map((r: any) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-3">
                        <p className="font-semibold" style={{ color: 'var(--text-1)' }}>{r.user?.name}</p>
                        {r.bankAccount && <p className="text-xs" style={{ color: 'var(--text-3)' }}>{r.bankName} {r.bankAccount}</p>}
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                          {EMP_LABEL[r.employeeType]||r.employeeType}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-bold text-center" style={{ color: 'var(--text-1)' }}>{r.presentDays}</td>
                      <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-2)' }}>{formatCurrency(r.dailyRate)}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--text-1)' }}>{formatCurrency(r.baseSalary)}</td>
                      <td className="px-3 py-3" style={{ color: 'var(--text-2)' }}>{formatCurrency(Math.round(r.serviceCharge))}</td>
                      <td className="px-3 py-3 text-red-500">{r.kasbonDeduction > 0 ? `-${formatCurrency(r.kasbonDeduction)}` : '—'}</td>
                      <td className="px-3 py-3 font-black" style={{ color: 'var(--brand)' }}>{formatCurrency(Math.round(r.totalAmount))}</td>
                      <td className="px-3 py-3">
                        {canEdit && (
                          <button onClick={() => { setEditRecord(r); setKasbonEdit(String(r.kasbonDeduction||0)); }}
                            className="text-xs font-medium text-blue-500 hover:underline">Edit</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--surface-2)' }}>
                    <td colSpan={7} className="px-3 py-3 text-right font-bold text-sm" style={{ color: 'var(--text-2)' }}>TOTAL PAYOUT</td>
                    <td className="px-3 py-3 font-black text-lg" style={{ color: 'var(--brand)' }}>
                      {formatCurrency(Math.round((period.records||[]).reduce((s: number, r: any) => s + r.totalAmount, 0)))}
                    </td>
                    <td/>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>)}

        {/* Edit kasbon modal */}
        {editRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <h3 className="font-black text-lg mb-4" style={{ color: 'var(--text-1)' }}>
                Edit Kasbon — {editRecord.user?.name}
              </h3>
              <div className="space-y-3 mb-5">
                <div className="flex justify-between text-sm"><span style={{ color: 'var(--text-3)' }}>Gaji Pokok</span><span className="font-semibold">{formatCurrency(editRecord.baseSalary)}</span></div>
                <div className="flex justify-between text-sm"><span style={{ color: 'var(--text-3)' }}>Service Charge</span><span className="font-semibold">{formatCurrency(Math.round(editRecord.serviceCharge))}</span></div>
                <div>
                  <label className="label">Potongan Kasbon Bulan Ini (Rp)</label>
                  <input type="number" value={kasbonEdit} onChange={e => setKasbonEdit(e.target.value)} className="input" placeholder="0"/>
                </div>
                <div className="flex justify-between font-bold pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <span>Take Home</span>
                  <span style={{ color: 'var(--brand)' }}>
                    {formatCurrency(Math.round(editRecord.baseSalary + editRecord.serviceCharge - (parseFloat(kasbonEdit)||0)))}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditRecord(null)} className="btn btn-secondary btn-md flex-1">Batal</button>
                <button onClick={saveRecord} className="btn btn-primary btn-md flex-1">Simpan</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
