'use client';
import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/fetch';
import { formatCurrency } from '@/components/ui';
import { INCENTIVE_LEVELS, calcMonthlyPunishment, SHIFT_CONFIG } from '@/lib/late-engine';

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const STATUS_LABEL: Record<string,string> = { LATE:'Terlambat', VERY_LATE:'Telat >1.5 jam', ABSENT_NO_INFO:'Alpha' };
const STATUS_COLOR: Record<string,string> = { LATE:'#F59E0B', VERY_LATE:'#DC2626', ABSENT_NO_INFO:'#7C3AED' };

export default function RewardPage() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab,   setTab]   = useState<'late'|'incentive'|'summary'>('summary');

  const [lateRecords,  setLateRecords]  = useState<any[]>([]);
  const [incentives,   setIncentives]   = useState<any[]>([]);
  const [staff,        setStaff]        = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);

  // Late modal
  const [lateModal, setLateModal] = useState(false);
  const [lateForm, setLateForm]   = useState({ userId: '', date: now.toISOString().slice(0,10), shift: '1', minutesLate: '', status: 'LATE', confirmed: false, note: '' });
  const [lateSaving, setLateSaving] = useState(false);

  // Incentive modal
  const [incModal,   setIncModal]   = useState(false);
  const [incDate,    setIncDate]    = useState(now.toISOString().slice(0,10));
  const [incCrew,    setIncCrew]    = useState<string[]>([]);
  const [incManual,  setIncManual]  = useState<number|null>(null);
  const [incSaving,  setIncSaving]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lr, inc, s] = await Promise.all([
        api.get<any[]>(`/api/late-records?year=${year}&month=${month}`),
        api.get<any[]>(`/api/incentives?year=${year}&month=${month}`),
        api.get<any[]>('/api/users?role=STAFF'),
      ]);
      setLateRecords(Array.isArray(lr)  ? lr  : []);
      setIncentives(Array.isArray(inc)  ? inc : []);
      setStaff(Array.isArray(s) ? s : (s as any)?.users || []);
    } catch {} finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  // Per-staff summary
  const staffSummary = staff.map(s => {
    const records = lateRecords.filter(r => r.userId === s.id);
    const punishment = calcMonthlyPunishment(records, s.dailyRate || 0);
    const myIncentives = incentives.flatMap((i: any) => i.entries.filter((e: any) => e.userId === s.id));
    const totalIncentive = myIncentives.reduce((sum: number, e: any) => sum + e.amount, 0);
    const pendingIncentive = myIncentives.filter((e: any) => e.status === 'PENDING').reduce((sum: number, e: any) => sum + e.amount, 0);
    return { ...s, records, punishment, totalIncentive, pendingIncentive };
  });

  async function saveLate() {
    setLateSaving(true);
    try {
      await api.post('/api/late-records', { ...lateForm, minutesLate: parseInt(lateForm.minutesLate) || 0 });
      await load();
      setLateModal(false);
    } catch(e: any) { alert(e.message); }
    finally { setLateSaving(false); }
  }

  async function deleteRecord(id: string) {
    if (!confirm('Hapus record ini?')) return;
    await api.delete(`/api/late-records?id=${id}`);
    load();
  }

  async function toggleConfirm(record: any) {
    await api.patch('/api/late-records', { id: record.id, confirmed: !record.confirmed });
    load();
  }

  async function saveIncentive() {
    if (!incCrew.length) { alert('Pilih minimal 1 crew'); return; }
    setIncSaving(true);
    try {
      await api.post('/api/incentives', { date: incDate, crewUserIds: incCrew, manualLevel: incManual });
      await load();
      setIncModal(false);
    } catch(e: any) { alert(e.message); }
    finally { setIncSaving(false); }
  }

  async function payIncentives(ids: string[]) {
    if (!confirm(`Cairkan ${ids.length} insentif?`)) return;
    await api.patch('/api/incentives', { action: 'pay_week', ids });
    load();
  }

  const pendingIncentives = incentives.filter((i: any) => i.status === 'PENDING');
  const pendingTotal = pendingIncentives.reduce((s: number, i: any) => s + i.totalPool, 0);

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black" style={{ color:'var(--text-1)' }}>Reward & Punishment</h1>
            <p className="text-sm" style={{ color:'var(--text-3)' }}>Keterlambatan, insentif omset, summary payroll</p>
          </div>
          <div className="flex gap-2">
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="select">
              {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="select">
              {[2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Pending incentive alert */}
        {pendingIncentives.length > 0 && (
          <div className="rounded-xl p-4 flex items-center justify-between gap-4"
            style={{ background:'#FFFBEB', border:'1px solid #F59E0B40' }}>
            <div>
              <p className="font-bold text-sm" style={{ color:'#854F0B' }}>
                ⭐ {pendingIncentives.length} insentif belum dicairkan
              </p>
              <p className="text-xs mt-0.5" style={{ color:'#A0660E' }}>
                Total: {formatCurrency(pendingTotal)} — cairkan setiap Jumat
              </p>
            </div>
            <button onClick={() => payIncentives(pendingIncentives.map((i:any) => i.id))}
              className="btn btn-sm font-bold"
              style={{ background:'#F59E0B', color:'white' }}>
              Cairkan Semua
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background:'var(--surface-2)' }}>
          {[['summary','📊 Summary'],['late','⚠️ Keterlambatan'],['incentive','⭐ Insentif']].map(([t,label]) => (
            <button key={t} onClick={() => setTab(t as any)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={tab===t?{background:'white',color:'var(--text-1)',boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}:{color:'var(--text-3)'}}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor:'var(--brand)', borderTopColor:'transparent' }}/>
          </div>
        ) : tab === 'summary' ? (
          /* SUMMARY TAB */
          <div className="space-y-3">
            {staffSummary.length === 0 ? (
              <div className="card text-center py-10 text-gray-400">Belum ada data staff</div>
            ) : staffSummary.map(s => (
              <div key={s.id} className="card p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="font-black text-base" style={{ color:'var(--text-1)' }}>{s.name}</p>
                    <p className="text-xs" style={{ color:'var(--text-3)' }}>Daily rate: {formatCurrency(s.dailyRate || 0)}</p>
                  </div>
                  <div className="flex gap-2 text-right flex-wrap justify-end">
                    {s.punishment.totalDeduction > 0 && (
                      <span className="text-sm font-bold px-2 py-1 rounded-lg" style={{ background:'#FEF2F2', color:'#DC2626' }}>
                        -{formatCurrency(s.punishment.totalDeduction)}
                      </span>
                    )}
                    {s.totalIncentive > 0 && (
                      <span className="text-sm font-bold px-2 py-1 rounded-lg" style={{ background:'#FFFBEB', color:'#854F0B' }}>
                        +{formatCurrency(s.totalIncentive)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center text-sm">
                  <div className="rounded-xl p-3" style={{ background:'var(--surface-2)' }}>
                    <p className="font-black text-lg" style={{ color: s.records.length > 0 ? '#DC2626' : 'var(--text-3)' }}>
                      {s.records.length}
                    </p>
                    <p className="text-xs" style={{ color:'var(--text-3)' }}>Keterlambatan</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background:'var(--surface-2)' }}>
                    <p className="font-black text-lg" style={{ color:'#DC2626' }}>
                      {formatCurrency(s.punishment.totalDeduction)}
                    </p>
                    <p className="text-xs" style={{ color:'var(--text-3)' }}>Potongan</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background:'var(--surface-2)' }}>
                    <p className="font-black text-lg" style={{ color:'#854F0B' }}>
                      {formatCurrency(s.pendingIncentive)}
                    </p>
                    <p className="text-xs" style={{ color:'var(--text-3)' }}>Insentif pending</p>
                  </div>
                </div>
                {s.punishment.details.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {s.punishment.details.map((d: string, i: number) => (
                      <p key={i} className="text-xs px-2 py-1 rounded-lg" style={{ background:'#FEF2F2', color:'#DC2626' }}>⚠️ {d}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : tab === 'late' ? (
          /* LATE TAB */
          <>
            <div className="flex justify-between items-center">
              <div className="text-sm" style={{ color:'var(--text-3)' }}>
                <span className="font-bold text-base" style={{ color:'var(--text-1)' }}>{lateRecords.length}</span> record keterlambatan
              </div>
              <button onClick={() => { setLateForm({ userId: '', date: now.toISOString().slice(0,10), shift: '1', minutesLate: '', status: 'LATE', confirmed: false, note: '' }); setLateModal(true); }}
                className="btn btn-sm btn-primary">+ Catat</button>
            </div>

            {/* Info shift */}
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(SHIFT_CONFIG).map(([k, cfg]) => (
                <div key={k} className="rounded-xl p-3" style={{ background:'var(--surface-2)' }}>
                  <p className="font-bold text-sm" style={{ color:'var(--text-1)' }}>{cfg.name}</p>
                  <p className="text-xs" style={{ color:'var(--text-3)' }}>Toleransi: {cfg.tolerance} menit → batas {String(cfg.start.h).padStart(2,'0')}:{String(cfg.start.m + cfg.tolerance).padStart(2,'0')}</p>
                </div>
              ))}
            </div>

            {lateRecords.length === 0 ? (
              <div className="card text-center py-10 text-gray-400">Belum ada catatan keterlambatan</div>
            ) : (
              <div className="space-y-2">
                {lateRecords.map((r: any) => (
                  <div key={r.id} className="card p-3 flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm" style={{ color:'var(--text-1)' }}>{r.user?.name}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                          style={{ background: STATUS_COLOR[r.status] }}>
                          {STATUS_LABEL[r.status]}
                        </span>
                        {r.confirmed && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background:'#E1F5EE', color:'#0F6E56' }}>✓ Dikonfirmasi</span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color:'var(--text-3)' }}>
                        {new Date(r.date).toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long' })}
                        {' · '} Shift {r.shift}
                        {r.minutesLate > 0 && ` · ${r.minutesLate} menit terlambat`}
                      </p>
                      {r.note && <p className="text-xs mt-1 italic" style={{ color:'var(--text-3)' }}>{r.note}</p>}
                    </div>
                    <div className="flex gap-1">
                      {r.status === 'VERY_LATE' && (
                        <button onClick={() => toggleConfirm(r)}
                          className="btn btn-sm text-xs"
                          style={r.confirmed
                            ? { background:'#E1F5EE', color:'#0F6E56', border:'1px solid #9FE1CB' }
                            : { background:'var(--surface-2)', color:'var(--text-3)', border:'1px solid var(--border)' }}>
                          {r.confirmed ? 'Unconfirm' : 'Konfirmasi'}
                        </button>
                      )}
                      <button onClick={() => deleteRecord(r.id)}
                        className="btn btn-sm text-xs"
                        style={{ background:'#FEF2F2', color:'#DC2626', border:'1px solid #FECACA' }}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* INCENTIVE TAB */
          <>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-bold" style={{ color:'var(--text-1)' }}>Insentif Harian</p>
                <p className="text-xs" style={{ color:'var(--text-3)' }}>Berdasarkan target omset — cairkan tiap Jumat</p>
              </div>
              <button onClick={() => { setIncDate(now.toISOString().slice(0,10)); setIncCrew([]); setIncModal(true); }}
                className="btn btn-sm btn-primary">+ Input Insentif</button>
            </div>

            {/* Level targets */}
            <div className="grid grid-cols-3 gap-3">
              {INCENTIVE_LEVELS.map(lvl => (
                <div key={lvl.level} className="rounded-xl p-3 text-center" style={{ background:'var(--surface-2)' }}>
                  <p className="text-xs font-bold mb-1" style={{ color:'var(--text-3)' }}>Level {lvl.level}</p>
                  <p className="font-black text-sm" style={{ color:'var(--text-1)' }}>{formatCurrency(lvl.target)}</p>
                  <p className="text-xs mt-0.5" style={{ color:'#854F0B' }}>Pool: {formatCurrency(lvl.pool)}</p>
                </div>
              ))}
            </div>

            {incentives.length === 0 ? (
              <div className="card text-center py-10 text-gray-400">Belum ada insentif bulan ini</div>
            ) : (
              <div className="space-y-3">
                {incentives.map((inc: any) => (
                  <div key={inc.id} className="card p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-black text-sm" style={{ color:'var(--text-1)' }}>
                          {new Date(inc.date).toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long' })}
                        </p>
                        <p className="text-xs" style={{ color:'var(--text-3)' }}>
                          Omset: {formatCurrency(inc.revenue)} · Level {inc.level} · {inc.crewCount} crew
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded-full font-bold"
                          style={inc.status === 'PAID'
                            ? { background:'#E1F5EE', color:'#0F6E56' }
                            : { background:'#FFFBEB', color:'#854F0B' }}>
                          {inc.status === 'PAID' ? '✓ Dicairkan' : 'Pending'}
                        </span>
                        <p className="font-black" style={{ color:'var(--brand)' }}>{formatCurrency(inc.totalPool)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {inc.entries.map((e: any) => (
                        <span key={e.id} className="text-xs px-2 py-1 rounded-lg font-medium"
                          style={{ background:'var(--surface-2)', color:'var(--text-2)' }}>
                          {e.user?.name} · {formatCurrency(e.amount)}
                        </span>
                      ))}
                    </div>
                    {inc.status === 'PENDING' && (
                      <button onClick={() => payIncentives([inc.id])}
                        className="mt-3 btn btn-sm w-full"
                        style={{ background:'#F59E0B', color:'white' }}>
                        Cairkan Insentif Ini
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Late Modal */}
      {lateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor:'var(--border)' }}>
              <p className="font-black text-base" style={{ color:'var(--text-1)' }}>Catat Keterlambatan</p>
              <button onClick={() => setLateModal(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="label">Staff *</label>
                <select value={lateForm.userId} onChange={e => setLateForm(p => ({...p, userId: e.target.value}))} className="select w-full mt-1">
                  <option value="">Pilih staff...</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tanggal *</label>
                  <input type="date" value={lateForm.date} onChange={e => setLateForm(p => ({...p, date: e.target.value}))} className="input w-full mt-1"/>
                </div>
                <div>
                  <label className="label">Shift *</label>
                  <select value={lateForm.shift} onChange={e => setLateForm(p => ({...p, shift: e.target.value}))} className="select w-full mt-1">
                    <option value="1">Shift 1 (09:30)</option>
                    <option value="2">Shift 2 (16:00)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Status *</label>
                <select value={lateForm.status} onChange={e => setLateForm(p => ({...p, status: e.target.value}))} className="select w-full mt-1">
                  <option value="LATE">Terlambat (dalam batas)</option>
                  <option value="VERY_LATE">Telat lebih dari 1.5 jam</option>
                  <option value="ABSENT_NO_INFO">Alpha (tidak masuk tanpa kabar)</option>
                </select>
              </div>
              {lateForm.status !== 'ABSENT_NO_INFO' && (
                <div>
                  <label className="label">Berapa menit terlambat</label>
                  <input type="number" value={lateForm.minutesLate} onChange={e => setLateForm(p => ({...p, minutesLate: e.target.value}))} className="input w-full mt-1" placeholder="menit"/>
                </div>
              )}
              {lateForm.status === 'VERY_LATE' && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="conf" checked={lateForm.confirmed} onChange={e => setLateForm(p => ({...p, confirmed: e.target.checked}))}/>
                  <label htmlFor="conf" className="text-sm" style={{ color:'var(--text-1)' }}>Ada konfirmasi / alasan yang disetujui manager</label>
                </div>
              )}
              <div>
                <label className="label">Catatan</label>
                <textarea value={lateForm.note} onChange={e => setLateForm(p => ({...p, note: e.target.value}))} className="input w-full mt-1 resize-none" rows={2}/>
              </div>
            </div>
            <div className="px-5 py-4 border-t flex gap-3" style={{ borderColor:'var(--border)' }}>
              <button onClick={() => setLateModal(false)} className="btn btn-secondary flex-1">Batal</button>
              <button onClick={saveLate} disabled={lateSaving || !lateForm.userId} className="btn btn-primary flex-1">
                {lateSaving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incentive Modal */}
      {incModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor:'var(--border)' }}>
              <p className="font-black text-base" style={{ color:'var(--text-1)' }}>Input Insentif Harian</p>
              <button onClick={() => setIncModal(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="label">Tanggal</label>
                <input type="date" value={incDate} onChange={e => setIncDate(e.target.value)} className="input w-full mt-1"/>
              </div>
              <div>
                <label className="label">Level manual (opsional — kosongkan untuk auto dari revenue)</label>
                <select value={incManual || ''} onChange={e => setIncManual(e.target.value ? Number(e.target.value) : null)} className="select w-full mt-1">
                  <option value="">Auto dari revenue hari itu</option>
                  <option value="1">Level 1 — Rp 1.500.000 → Pool Rp 120.000</option>
                  <option value="2">Level 2 — Rp 3.000.000 → Pool Rp 240.000</option>
                  <option value="3">Level 3 — Rp 4.500.000 → Pool Rp 360.000</option>
                </select>
              </div>
              <div>
                <label className="label">Crew yang bertugas *</label>
                <div className="mt-1 space-y-1">
                  {staff.map(s => (
                    <label key={s.id} className="flex items-center gap-2 p-2 rounded-xl cursor-pointer hover:bg-gray-50">
                      <input type="checkbox" checked={incCrew.includes(s.id)}
                        onChange={e => setIncCrew(p => e.target.checked ? [...p, s.id] : p.filter(id => id !== s.id))}/>
                      <span className="text-sm" style={{ color:'var(--text-1)' }}>{s.name}</span>
                    </label>
                  ))}
                </div>
                {incCrew.length > 0 && (
                  <p className="text-xs mt-2" style={{ color:'var(--text-3)' }}>
                    {incCrew.length} crew dipilih · per orang ≈ {formatCurrency(incManual ? [120000,240000,360000][incManual-1] / incCrew.length : 0)}
                  </p>
                )}
              </div>
            </div>
            <div className="px-5 py-4 border-t flex gap-3" style={{ borderColor:'var(--border)' }}>
              <button onClick={() => setIncModal(false)} className="btn btn-secondary flex-1">Batal</button>
              <button onClick={saveIncentive} disabled={incSaving || !incCrew.length} className="btn btn-primary flex-1">
                {incSaving ? 'Memproses...' : 'Simpan Insentif'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
