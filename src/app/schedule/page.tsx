'use client';
import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/fetch';
import { formatCurrency } from '@/components/ui';

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const DAYS   = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const ROLE_LABEL: Record<string,string> = {
  BARISTA:'Barista', HELPER:'Helper', KITCHEN:'Kitchen',
  KITCHEN_HELPER:'Kitchen Helper', BARISTA_HELPER:'Barista Helper',
};
const ROLE_COLOR: Record<string,string> = {
  BARISTA:'#185FA5', HELPER:'#0F6E56', KITCHEN:'#854F0B',
  KITCHEN_HELPER:'#993C1D', BARISTA_HELPER:'#534AB7',
};
const ROLE_BG: Record<string,string> = {
  BARISTA:'#E6F1FB', HELPER:'#E1F5EE', KITCHEN:'#FAEEDA',
  KITCHEN_HELPER:'#FAECE7', BARISTA_HELPER:'#EEEDFE',
};
const SHIFT_LABEL: Record<string,string> = { PAGI:'Pagi', SORE:'Sore' };
const TYPE_LABEL: Record<string,string> = {
  REGULAR:'', EXTRA:'Extra', COVER:'Cover', DAILY_WORKER:'DW',
};

const STAFF_ROLES: Array<{ value: string; label: string }> = [
  { value: 'BARISTA',        label: 'Barista' },
  { value: 'HELPER',         label: 'Helper' },
  { value: 'KITCHEN',        label: 'Kitchen' },
  { value: 'KITCHEN_HELPER', label: 'Kitchen Helper' },
];

export default function SchedulePage() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [schedule, setSchedule] = useState<any>(null);
  const [loading,  setLoading]  = useState(false);
  const [generating, setGenerating] = useState(false);
  const [staff,    setStaff]    = useState<any[]>([]);
  const [staffConfigs, setStaffConfigs] = useState<any[]>([]);
  const [view, setView] = useState<'calendar'|'list'|'payroll'>('calendar');
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [editModal, setEditModal] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignType, setAssignType] = useState('REGULAR');
  const [assignNotes, setAssignNotes] = useState('');
  const [dailyWorkerName, setDailyWorkerName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await api.get<any>(`/api/schedules?year=${year}&month=${month}`);
      setSchedule(s);
    } catch {} finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get<any[]>('/api/users?role=STAFF').then(r => {
      const arr = Array.isArray(r) ? r : (r as any)?.users || [];
      setStaff(arr);
      setStaffConfigs(arr.map((s: any) => ({ userId: s.id, name: s.name, role: 'BARISTA' })));
    }).catch(() => {});
  }, []);

  async function generate() {
    setGenerating(true);
    try {
      const s = await api.post<any>('/api/schedules', { year, month, staffConfigs });
      setSchedule(s);
      setShowConfig(false);
    } catch(e: any) { alert(e.message); }
    finally { setGenerating(false); }
  }

  async function saveSlot() {
    if (!selectedSlot) return;
    setSaving(true);
    try {
      await api.patch('/api/schedules', {
        slotId: selectedSlot.id,
        action: 'assign',
        userId: assignUserId || null,
        dailyWorkerName: assignUserId ? null : dailyWorkerName,
        notes: assignNotes,
        type: assignType,
      });
      await load();
      setEditModal(false);
    } catch(e: any) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function addExtra() {
    if (!selectedSlot || !assignUserId) return;
    setSaving(true);
    try {
      await api.patch('/api/schedules', {
        slotId: selectedSlot.id,
        action: 'add_extra',
        userId: assignUserId,
        notes: assignNotes || 'Shift tambahan',
        type: 'EXTRA',
      });
      await load();
      setEditModal(false);
    } catch(e: any) { alert(e.message); }
    finally { setSaving(false); }
  }

  function openEdit(slot: any) {
    setSelectedSlot(slot);
    setAssignUserId(slot.userId || '');
    setAssignType(slot.type || 'REGULAR');
    setAssignNotes(slot.notes || '');
    setDailyWorkerName(slot.dailyWorkerName || '');
    setEditModal(true);
  }

  // Group slots by date
  const slotsByDate: Record<string, any[]> = {};
  for (const slot of schedule?.slots || []) {
    const key = new Date(slot.date).toDateString();
    if (!slotsByDate[key]) slotsByDate[key] = [];
    slotsByDate[key].push(slot);
  }

  // Days in month
  const days: Date[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }

  // Payroll summary
  const payrollMap: Record<string, { name: string; regular: number; extra: number; off: number; rate: number }> = {};
  for (const slot of schedule?.slots || []) {
    if (!slot.userId || !slot.user) continue;
    const uid = slot.userId;
    if (!payrollMap[uid]) payrollMap[uid] = { name: slot.user.name, regular: 0, extra: 0, off: 0, rate: slot.user.dailyRate || 0 };
    if (slot.isOff) payrollMap[uid].off++;
    else if (slot.type === 'EXTRA' || slot.type === 'COVER') payrollMap[uid].extra++;
    else payrollMap[uid].regular++;
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="select">
              {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="select">
              {[2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {schedule && (
              <span className="text-xs px-2 py-1 rounded-full font-bold"
                style={{ background: schedule.status === 'PUBLISHED' ? '#E1F5EE' : '#FAEEDA',
                  color: schedule.status === 'PUBLISHED' ? '#0F6E56' : '#854F0B' }}>
                {schedule.status}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {['calendar','list','payroll'].map(v => (
              <button key={v} onClick={() => setView(v as any)}
                className="btn btn-sm"
                style={{ background: view === v ? 'var(--brand)' : 'var(--surface-2)', color: view === v ? 'white' : 'var(--text-2)' }}>
                {v === 'calendar' ? 'Kalender' : v === 'list' ? 'List' : 'Payroll'}
              </button>
            ))}
            <button onClick={() => setShowConfig(true)} className="btn btn-sm btn-secondary">
              Konfigurasi
            </button>
            {!schedule ? (
              <button onClick={() => setShowConfig(true)} className="btn btn-sm btn-primary">
                + Generate Jadwal
              </button>
            ) : (
              <button onClick={generate} disabled={generating} className="btn btn-sm btn-secondary">
                {generating ? 'Generating...' : 'Re-generate'}
              </button>
            )}
          </div>
        </div>

        {loading && <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor:'var(--brand)', borderTopColor:'transparent' }}/></div>}

        {!schedule && !loading && (
          <div className="card p-12 text-center">
            <p className="text-4xl mb-3">📅</p>
            <p className="font-bold text-lg mb-2" style={{ color:'var(--text-1)' }}>Belum ada jadwal {MONTHS[month-1]} {year}</p>
            <p className="text-sm mb-6" style={{ color:'var(--text-3)' }}>Konfigurasi role staff lalu generate jadwal otomatis</p>
            <button onClick={() => setShowConfig(true)} className="btn btn-primary px-8">+ Buat Jadwal</button>
          </div>
        )}

        {/* Calendar View */}
        {schedule && view === 'calendar' && (
          <div>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAYS.map(d => (
                <div key={d} className="text-center text-xs font-bold py-2" style={{ color:'var(--text-3)' }}>{d}</div>
              ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells before month starts */}
              {Array.from({ length: days[0].getDay() }).map((_, i) => <div key={`e${i}`}/>)}
              {days.map(day => {
                const key = day.toDateString();
                const daySlots = (slotsByDate[key] || []).filter((s: any) => !s.isOff);
                const offSlots = (slotsByDate[key] || []).filter((s: any) => s.isOff);
                const dow = day.getDay();
                const isWeekend = dow === 5 || dow === 6;
                const hasMissing = daySlots.some((s: any) => !s.userId);
                return (
                  <div key={key} className="rounded-xl border p-1.5 min-h-24 cursor-pointer hover:border-brand transition-colors"
                    style={{ borderColor: hasMissing ? '#F09595' : 'var(--border)', background: isWeekend ? 'var(--surface-2)' : 'white' }}
                    onClick={() => {}}>
                    <p className="text-xs font-bold mb-1" style={{ color: isWeekend ? '#185FA5' : 'var(--text-2)' }}>
                      {day.getDate()}
                    </p>
                    <div className="space-y-0.5">
                      {daySlots.slice(0, 4).map((slot: any) => (
                        <div key={slot.id} onClick={e => { e.stopPropagation(); openEdit(slot); }}
                          className="rounded px-1 py-0.5 text-xs cursor-pointer hover:opacity-80"
                          style={{ background: ROLE_BG[slot.role], color: ROLE_COLOR[slot.role] }}>
                          <span className="font-bold">{slot.shift[0]}</span>
                          {' '}{slot.user?.name?.split(' ')[0] || <span style={{ opacity:.5 }}>—</span>}
                          {slot.type !== 'REGULAR' && <span className="ml-0.5 opacity-60">[{TYPE_LABEL[slot.type]}]</span>}
                        </div>
                      ))}
                      {daySlots.length > 4 && <p className="text-xs" style={{ color:'var(--text-3)' }}>+{daySlots.length - 4} lagi</p>}
                      {offSlots.length > 0 && (
                        <p className="text-xs" style={{ color:'#888' }}>🏖 {offSlots.map((s: any) => s.user?.name?.split(' ')[0]).join(', ')}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* List View */}
        {schedule && view === 'list' && (
          <div className="space-y-4">
            {days.map(day => {
              const key = day.toDateString();
              const daySlots = slotsByDate[key] || [];
              if (!daySlots.length) return null;
              const dow = day.getDay();
              return (
                <div key={key} className="card overflow-hidden">
                  <div className="px-4 py-2.5 flex items-center justify-between" style={{ background:'var(--surface-2)' }}>
                    <p className="font-bold text-sm" style={{ color:'var(--text-1)' }}>
                      {DAYS[dow]}, {day.getDate()} {MONTHS[month-1]}
                    </p>
                    {(dow === 5 || dow === 6) && <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background:'#E6F1FB', color:'#185FA5' }}>Ramai</span>}
                  </div>
                  <div className="divide-y" style={{ borderColor:'var(--border)' }}>
                    {['PAGI','SORE'].map(shift => {
                      const shiftSlots = daySlots.filter((s: any) => s.shift === shift);
                      if (!shiftSlots.length) return null;
                      return (
                        <div key={shift} className="px-4 py-2">
                          <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color:'var(--text-3)' }}>{SHIFT_LABEL[shift]}</p>
                          <div className="flex flex-wrap gap-2">
                            {shiftSlots.map((slot: any) => (
                              <button key={slot.id} onClick={() => openEdit(slot)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:opacity-80"
                                style={{
                                  background: slot.isOff ? '#F1EFE8' : ROLE_BG[slot.role],
                                  color: slot.isOff ? '#888' : ROLE_COLOR[slot.role],
                                  borderColor: slot.isOff ? '#D3D1C7' : ROLE_COLOR[slot.role] + '40',
                                  textDecoration: slot.isOff ? 'line-through' : 'none',
                                }}>
                                <span>{ROLE_LABEL[slot.role]}</span>
                                <span style={{ opacity:.7 }}>·</span>
                                <span>{slot.user?.name || slot.dailyWorkerName || <span style={{ opacity:.4 }}>Kosong</span>}</span>
                                {slot.type !== 'REGULAR' && <span className="opacity-60">[{TYPE_LABEL[slot.type]}]</span>}
                                {!slot.userId && !slot.isOff && <span style={{ color:'#E24B4A' }}>!</span>}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Payroll View */}
        {schedule && view === 'payroll' && (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b" style={{ borderColor:'var(--border)', background:'var(--surface-2)' }}>
              <p className="font-bold" style={{ color:'var(--text-1)' }}>Estimasi Payroll — {MONTHS[month-1]} {year}</p>
              <p className="text-xs mt-0.5" style={{ color:'var(--text-3)' }}>Shift regular = 1× daily rate · Extra/cover = ½ daily rate</p>
            </div>
            <table className="w-full text-sm">
              <thead><tr style={{ background:'var(--surface-2)' }}>
                {['Staff','Shift Regular','Extra/Cover','Libur','Daily Rate','Estimasi Gaji'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase" style={{ color:'var(--text-3)' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y" style={{ borderColor:'var(--border)' }}>
                {Object.entries(payrollMap).map(([uid, p]) => {
                  const total = (p.regular * p.rate) + (p.extra * p.rate / 2);
                  return (
                    <tr key={uid} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-semibold" style={{ color:'var(--text-1)' }}>{p.name}</td>
                      <td className="px-3 py-2.5 text-center">{p.regular}</td>
                      <td className="px-3 py-2.5 text-center">{p.extra || '—'}</td>
                      <td className="px-3 py-2.5 text-center">{p.off}</td>
                      <td className="px-3 py-2.5" style={{ color:'var(--text-3)' }}>{formatCurrency(p.rate)}</td>
                      <td className="px-3 py-2.5 font-bold" style={{ color:'var(--brand)' }}>{formatCurrency(total)}</td>
                    </tr>
                  );
                })}
                <tr style={{ background:'var(--surface-2)' }}>
                  <td colSpan={5} className="px-3 py-2.5 font-bold text-right" style={{ color:'var(--text-1)' }}>Total Estimasi</td>
                  <td className="px-3 py-2.5 font-black text-lg" style={{ color:'var(--brand)' }}>
                    {formatCurrency(Object.values(payrollMap).reduce((s, p) => s + (p.regular * p.rate) + (p.extra * p.rate / 2), 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Staff Config Modal */}
        {showConfig && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background:'rgba(0,0,0,0.4)' }}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor:'var(--border)' }}>
                <p className="font-black text-lg" style={{ color:'var(--text-1)' }}>Konfigurasi Role Staff</p>
                <button onClick={() => setShowConfig(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
              </div>
              <div className="px-5 py-4 space-y-3 max-h-96 overflow-y-auto">
                <p className="text-sm" style={{ color:'var(--text-3)' }}>Assign role utama setiap staff untuk jadwal ini</p>
                {staffConfigs.map((cfg, i) => (
                  <div key={cfg.userId} className="flex items-center gap-3">
                    <p className="text-sm font-medium flex-1" style={{ color:'var(--text-1)' }}>{cfg.name}</p>
                    <select value={cfg.role}
                      onChange={e => setStaffConfigs(prev => prev.map((c, ci) => ci === i ? { ...c, role: e.target.value } : c))}
                      className="select text-sm">
                      {STAFF_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="px-5 py-4 border-t flex gap-3" style={{ borderColor:'var(--border)' }}>
                <button onClick={() => setShowConfig(false)} className="btn btn-secondary flex-1">Batal</button>
                <button onClick={generate} disabled={generating} className="btn btn-primary flex-1">
                  {generating ? 'Generating...' : 'Generate Jadwal'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Slot Modal */}
        {editModal && selectedSlot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background:'rgba(0,0,0,0.4)' }}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
              <div className="px-5 py-4 border-b" style={{ borderColor:'var(--border)', background: ROLE_BG[selectedSlot.role] }}>
                <p className="font-black" style={{ color: ROLE_COLOR[selectedSlot.role] }}>
                  {ROLE_LABEL[selectedSlot.role]} · {SHIFT_LABEL[selectedSlot.shift]}
                </p>
                <p className="text-xs mt-0.5" style={{ color: ROLE_COLOR[selectedSlot.role] + 'aa' }}>
                  {new Date(selectedSlot.date).toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long' })}
                </p>
              </div>
              <div className="px-5 py-4 space-y-3">
                <div>
                  <label className="label">Assign Staff</label>
                  <select value={assignUserId} onChange={e => setAssignUserId(e.target.value)} className="select w-full mt-1">
                    <option value="">Daily Worker / Kosong</option>
                    {staff.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                {!assignUserId && (
                  <div>
                    <label className="label">Nama Daily Worker</label>
                    <input value={dailyWorkerName} onChange={e => setDailyWorkerName(e.target.value)}
                      className="input w-full mt-1" placeholder="Nama daily worker..."/>
                  </div>
                )}
                {assignUserId && (
                  <div>
                    <label className="label">Tipe Shift</label>
                    <select value={assignType} onChange={e => setAssignType(e.target.value)} className="select w-full mt-1">
                      <option value="REGULAR">Regular (1× daily rate)</option>
                      <option value="EXTRA">Extra / Double shift (½ daily rate)</option>
                      <option value="COVER">Cover staff lain (½ daily rate)</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="label">Catatan</label>
                  <input value={assignNotes} onChange={e => setAssignNotes(e.target.value)}
                    className="input w-full mt-1" placeholder="Opsional..."/>
                </div>
              </div>
              <div className="px-5 py-4 border-t flex gap-2 flex-wrap" style={{ borderColor:'var(--border)' }}>
                <button onClick={() => setEditModal(false)} className="btn btn-secondary">Batal</button>
                <button onClick={saveSlot} disabled={saving} className="btn btn-primary flex-1">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
                {assignUserId && (
                  <button onClick={addExtra} disabled={saving}
                    className="btn flex-1"
                    style={{ background:'#E1F5EE', color:'#0F6E56', border:'1px solid #9FE1CB' }}>
                    + Tambah sebagai Extra
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
