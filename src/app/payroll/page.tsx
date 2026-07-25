'use client';
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/fetch';
import { formatCurrency, Modal, Button } from '@/components/ui';

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const STATUS_COLOR: Record<string,string> = { DRAFT:'#f59e0b', REVIEW:'#3b82f6', APPROVED:'#8b5cf6', PAID:'#16a34a' };
const STATUS_LABEL: Record<string,string> = { DRAFT:'Draft', REVIEW:'Review', APPROVED:'Disetujui', PAID:'Sudah Dibayar' };
const EMP_LABEL: Record<string,string> = { HELPER:'Helper', STAFF:'Staff', MANAGER:'Manager' };

export default function PayrollPage() {
  const now = new Date();
  const [year, setYear]         = useState(now.getFullYear());
  const [month, setMonth]       = useState(now.getMonth()+1);
  const [period, setPeriod]     = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [kasbons, setKasbons]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [kasbonEdit, setKasbonEdit] = useState('');

  async function loadAll() {
    setLoading(true);
    try {
      const [p, att, kb] = await Promise.all([
        api.get<any>(`/api/payroll?year=${year}&month=${month}`).catch(()=>null),
        api.get<any[]>(`/api/attendance?mode=monthly&year=${year}&month=${month}`).catch(()=>[]),
        api.get<any[]>('/api/kasbon').catch(()=>[]),
      ]);
      setPeriod(p);
      setAttendance(Array.isArray(att) ? att : []);
      setKasbons(Array.isArray(kb) ? kb : []);
    } finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, [year, month]);

  async function generate() {
    setGenerating(true);
    try {
      await api.post('/api/payroll', { year, month });
      await loadAll();
    } catch(e:any) { alert(e.message); }
    finally { setGenerating(false); }
  }

  async function updateStatus(action: string) {
    if (!period) return;
    await api.patch('/api/payroll', { periodId: period.id, action });
    await loadAll();
  }

  async function saveRecord() {
    if (!editRecord) return;
    await api.patch('/api/payroll', {
      periodId: period.id, action: 'update_record',
      recordId: editRecord.id, kasbonDeduction: parseFloat(kasbonEdit)||0,
    });
    setEditRecord(null);
    await loadAll();
  }

  function exportCSV() {
    if (!period?.records) return;
    const rows = [
      ['Nama','Tipe','Hari Hadir','Rate/Hari','Gaji Pokok','Service Charge','Kasbon','Take Home','Bank','No Rekening','Atas Nama'],
      ...period.records.map((r:any) => [
        r.user?.name, EMP_LABEL[r.employeeType]||r.employeeType,
        r.presentDays, r.dailyRate, r.baseSalary,
        Math.round(r.serviceCharge), r.kasbonDeduction, Math.round(r.totalAmount),
        r.bankName||'', r.bankAccount||'', r.bankAccountName||'',
      ]),
    ];
    const csv  = '\uFEFF' + rows.map(r => r.join(',')).join('\n');
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
    a.download = `payroll-${year}-${String(month).padStart(2,'0')}.csv`;
    a.click();
  }

  // Helper: get attendance for a user
  const getAtt = (userId: string) => attendance.find(a => a.userId === userId);
  // Helper: get active kasbon for a user
  const getKasbon = (userId: string) => kasbons.filter(k => k.userId === userId && k.status === 'ACTIVE');
  const getTotalKasbonRemaining = (userId: string) => getKasbon(userId).reduce((s,k) => s+k.remaining, 0);

  const canEdit = period?.status === 'DRAFT' || period?.status === 'REVIEW';

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black" style={{ color:'var(--text-1)' }}>Payroll</h1>
            <p className="text-sm" style={{ color:'var(--text-3)' }}>{MONTHS[month-1]} {year}</p>
          </div>
          <div className="flex gap-2">
            <select value={month} onChange={e=>setMonth(parseInt(e.target.value))} className="input py-1.5 text-sm">
              {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
            </select>
            <select value={year} onChange={e=>setYear(parseInt(e.target.value))} className="input py-1.5 text-sm">
              {[2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor:'var(--brand)',borderTopColor:'transparent' }}/>
          </div>
        ) : (
          <>
            {/* Attendance preview — selalu tampil */}
            {attendance.length > 0 && (
              <div className="card p-4">
                <p className="font-bold mb-3" style={{ color:'var(--text-1)' }}>📅 Kehadiran {MONTHS[month-1]} {year}</p>
                <div className="space-y-2">
                  {attendance.map((a:any) => {
                    const kb = getTotalKasbonRemaining(a.userId);
                    return (
                      <div key={a.userId} className="flex items-center gap-3 py-2 border-b last:border-0" style={{ borderColor:'var(--border)' }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-black flex-shrink-0"
                          style={{ background:'var(--brand)' }}>
                          {a.user?.name?.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm" style={{ color:'var(--text-1)' }}>{a.user?.name}</p>
                          <p className="text-xs" style={{ color:'var(--text-3)' }}>{a.user?.employeeType}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-lg tabular-nums" style={{ color:'var(--brand)' }}>{a.presentCount}</p>
                          <p className="text-xs" style={{ color:'var(--text-3)' }}>hari</p>
                        </div>
                        <div className="text-right w-24">
                          <p className="font-semibold text-sm" style={{ color:'var(--text-1)' }}>
                            {formatCurrency((a.user?.dailyRate||0)*a.presentCount)}
                          </p>
                          {kb > 0 && <p className="text-xs text-amber-600">Kasbon: {formatCurrency(kb)}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Kasbon aktif preview */}
            {kasbons.length > 0 && (
              <div className="card p-4">
                <p className="font-bold mb-3" style={{ color:'var(--text-1)' }}>💰 Kasbon Aktif</p>
                <div className="space-y-2">
                  {kasbons.map((k:any) => (
                    <div key={k.id} className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor:'var(--border)' }}>
                      <div>
                        <p className="font-semibold text-sm" style={{ color:'var(--text-1)' }}>{k.user?.name}</p>
                        {k.reason && <p className="text-xs" style={{ color:'var(--text-3)' }}>{k.reason}</p>}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-500">{formatCurrency(k.remaining)}</p>
                        <p className="text-xs" style={{ color:'var(--text-3)' }}>dari {formatCurrency(k.amount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <a href="/payroll/kasbon" className="text-xs font-semibold mt-3 inline-block" style={{ color:'var(--brand)' }}>Kelola kasbon →</a>
              </div>
            )}

            {!period ? (
              <div className="card text-center py-12">
                <p className="text-4xl mb-3">📋</p>
                <p className="font-bold mb-1" style={{ color:'var(--text-1)' }}>Belum ada payroll {MONTHS[month-1]} {year}</p>
                <p className="text-sm mb-6" style={{ color:'var(--text-3)' }}>Generate untuk menghitung gaji dari data absensi + revenue</p>
                <button onClick={generate} disabled={generating} className="btn btn-primary btn-md mx-auto">
                  {generating ? '⏳ Menghitung...' : '⚡ Generate Payroll'}
                </button>
              </div>
            ) : (<>
              {/* KPI */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label:'Revenue', value:formatCurrency(period.totalRevenue) },
                  { label:'Pool SC (5%)', value:formatCurrency(period.serviceChargePool) },
                  { label:'Karyawan', value:`${period.records?.length||0} orang` },
                  { label:'Total Payout', value:formatCurrency(period.totalPayout), hi:true },
                ].map(({label,value,hi})=>(
                  <div key={label} className="card p-4">
                    <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-3)' }}>{label}</p>
                    <p className="text-xl font-black" style={{ color:hi?'var(--brand)':'var(--text-1)' }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Status */}
              <div className="card p-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold" style={{ color:'var(--text-2)' }}>Status:</span>
                  <span className="text-xs px-3 py-1 rounded-full font-bold"
                    style={{ background:`${STATUS_COLOR[period.status]}20`, color:STATUS_COLOR[period.status] }}>
                    {STATUS_LABEL[period.status]}
                  </span>
                  {period.paidAt && <span className="text-xs" style={{ color:'var(--text-3)' }}>
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
                  {period.status === 'DRAFT' && <button onClick={()=>updateStatus('approve')} className="btn btn-primary btn-sm">✓ Approve</button>}
                  {period.status === 'APPROVED' && <button onClick={()=>updateStatus('paid')} className="btn btn-primary btn-sm">💸 Sudah Dibayar</button>}
                </div>
              </div>

              {/* Records — dengan kehadiran dan kasbon terintegrasi */}
              <div className="card overflow-hidden">
                <div className="divide-y" style={{ borderColor:'var(--border)' }}>
                  {(period.records||[]).map((r:any) => {
                    const att = getAtt(r.userId);
                    const kb  = getKasbon(r.userId);
                    const kbTotal = kb.reduce((s:number,k:any)=>s+k.remaining,0);
                    return (
                      <div key={r.id} className="p-4">
                        {/* Row header */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-base flex-shrink-0"
                            style={{ background:'var(--brand)' }}>
                            {r.user?.name?.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <p className="font-bold" style={{ color:'var(--text-1)' }}>{r.user?.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background:'var(--surface-2)', color:'var(--text-2)' }}>
                                {EMP_LABEL[r.employeeType]||r.employeeType}
                              </span>
                              <span className="text-xs" style={{ color:'var(--text-3)' }}>{formatCurrency(r.dailyRate)}/hari</span>
                              {r.bankAccount && <span className="text-xs" style={{ color:'var(--text-3)' }}>{r.bankName} {r.bankAccount}</span>}
                            </div>
                          </div>
                          {canEdit && (
                            <button onClick={()=>{setEditRecord(r);setKasbonEdit(String(r.kasbonDeduction||0));}}
                              className="text-xs font-medium text-blue-500 hover:underline flex-shrink-0">Edit kasbon</button>
                          )}
                        </div>

                        {/* Breakdown */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                          <div className="rounded-xl p-2.5" style={{ background:'var(--surface-2)' }}>
                            <p className="text-xs" style={{ color:'var(--text-3)' }}>Hari Masuk</p>
                            <p className="font-black text-lg tabular-nums" style={{ color:'var(--text-1)' }}>
                              {att?.presentCount ?? r.presentDays}
                            </p>
                          </div>
                          <div className="rounded-xl p-2.5" style={{ background:'var(--surface-2)' }}>
                            <p className="text-xs" style={{ color:'var(--text-3)' }}>Gaji Pokok</p>
                            <p className="font-bold" style={{ color:'var(--text-1)' }}>{formatCurrency(r.baseSalary)}</p>
                          </div>
                          <div className="rounded-xl p-2.5" style={{ background:'var(--surface-2)' }}>
                            <p className="text-xs" style={{ color:'var(--text-3)' }}>Service Charge</p>
                            <p className="font-bold" style={{ color:'var(--text-1)' }}>{formatCurrency(Math.round(r.serviceCharge))}</p>
                          </div>
                          <div className="rounded-xl p-2.5" style={{ background: r.kasbonDeduction > 0 ? '#FFF5F5' : 'var(--surface-2)', border: r.kasbonDeduction > 0 ? '1px solid #FECACA' : 'none' }}>
                            <p className="text-xs" style={{ color:'var(--text-3)' }}>Kasbon Potong</p>
                            <p className="font-bold" style={{ color:r.kasbonDeduction>0?'#DC2626':'var(--text-3)' }}>
                              {r.kasbonDeduction > 0 ? `-${formatCurrency(r.kasbonDeduction)}` : '—'}
                            </p>
                          </div>
                        </div>

                        {/* Kasbon sisa info */}
                        {kbTotal > 0 && (
                          <p className="text-xs mt-2" style={{ color:'#D97706' }}>
                            ⚠️ Sisa kasbon: {formatCurrency(kbTotal)}
                          </p>
                        )}

                        {/* Take home */}
                        <div className="flex justify-between items-center mt-3 pt-3 border-t" style={{ borderColor:'var(--border)' }}>
                          <span className="text-sm font-bold" style={{ color:'var(--text-2)' }}>Take Home</span>
                          <span className="text-xl font-black" style={{ color:'var(--brand)' }}>{formatCurrency(Math.round(r.totalAmount))}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Total */}
                <div className="flex justify-between items-center px-4 py-3" style={{ background:'var(--surface-2)' }}>
                  <span className="font-bold" style={{ color:'var(--text-2)' }}>Total Payout</span>
                  <span className="text-2xl font-black" style={{ color:'var(--brand)' }}>
                    {formatCurrency(Math.round((period.records||[]).reduce((s:number,r:any)=>s+r.totalAmount,0)))}
                  </span>
                </div>
              </div>
            </>)}
          </>
        )}

        {/* Edit kasbon modal */}
        {editRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <h3 className="font-black text-lg mb-4" style={{ color:'var(--text-1)' }}>Kasbon — {editRecord.user?.name}</h3>
              {getKasbon(editRecord.userId).map((k:any) => (
                <div key={k.id} className="flex justify-between text-sm mb-2 pb-2 border-b" style={{ borderColor:'var(--border)' }}>
                  <span style={{ color:'var(--text-3)' }}>{k.reason||'Kasbon'}</span>
                  <span className="font-bold text-amber-600">sisa {formatCurrency(k.remaining)}</span>
                </div>
              ))}
              <div className="space-y-3 my-3">
                <div className="flex justify-between text-sm"><span style={{ color:'var(--text-3)' }}>Gaji Pokok</span><span className="font-semibold">{formatCurrency(editRecord.baseSalary)}</span></div>
                <div className="flex justify-between text-sm"><span style={{ color:'var(--text-3)' }}>Service Charge</span><span className="font-semibold">{formatCurrency(Math.round(editRecord.serviceCharge))}</span></div>
                <div>
                  <label className="label">Potongan Kasbon Bulan Ini (Rp)</label>
                  <input type="number" value={kasbonEdit} onChange={e=>setKasbonEdit(e.target.value)} className="input" placeholder="0"/>
                </div>
                <div className="flex justify-between font-bold pt-2 border-t" style={{ borderColor:'var(--border)' }}>
                  <span>Take Home</span>
                  <span style={{ color:'var(--brand)' }}>
                    {formatCurrency(Math.round(editRecord.baseSalary + editRecord.serviceCharge - (parseFloat(kasbonEdit)||0)))}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>setEditRecord(null)} className="btn btn-secondary btn-md flex-1">Batal</button>
                <Button onClick={saveRecord} className="flex-1">Simpan</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
