'use client';
import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/fetch';

const DAYS = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const EMP_COLOR: Record<string, string> = { HELPER: '#f59e0b', STAFF: '#3b82f6', MANAGER: '#8b5cf6' };

function getWeekDates(date: Date) {
  const day = date.getDay();
  const mon = new Date(date); mon.setDate(date.getDate() - day + 1);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
}

export default function SchedulePage() {
  const [weekStart, setWeekStart]   = useState(() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); d.setHours(0,0,0,0); return d; });
  const [schedules, setSchedules]   = useState<any[]>([]);
  const [users, setUsers]           = useState<any[]>([]);
  const [shifts, setShifts]         = useState<any[]>([]);
  const [loading, setLoading]       = useState(false);
  const [editCell, setEditCell]     = useState<any>(null);

  const weekDates = getWeekDates(weekStart);
  const from = weekDates[0].toISOString().slice(0, 10);
  const to   = weekDates[6].toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, u, sh] = await Promise.all([
      api.get<any[]>(`/api/work-schedules?from=${from}&to=${to}`),
      api.get<any[]>('/api/employees?active=1'),
      api.get<any[]>('/api/shift-templates'),
    ]);
    setSchedules(s||[]); setUsers((u||[]).filter((u: any) => u.employeeType)); setShifts(sh||[]);
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  function prevWeek() { const d = new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d); }
  function nextWeek() { const d = new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d); }

  function getSchedule(userId: string, date: Date) {
    const ds = date.toISOString().slice(0,10);
    return schedules.find(s => s.userId === userId && s.date.slice(0,10) === ds);
  }

  async function setShiftForCell(userId: string, date: Date, shiftId: string | null, isOffDay: boolean) {
    await api.post('/api/work-schedules', {
      schedules: [{ userId, date: date.toISOString().slice(0,10), shiftTemplateId: shiftId, isOffDay }]
    });
    setEditCell(null);
    load();
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black" style={{ color: 'var(--text-1)' }}>Jadwal Kerja</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>
              {weekDates[0].toLocaleDateString('id-ID',{day:'numeric',month:'short'})} – {weekDates[6].toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={prevWeek} className="btn btn-secondary btn-sm">← Prev</button>
            <button onClick={() => { const d=new Date(); d.setDate(d.getDate()-d.getDay()+1); d.setHours(0,0,0,0); setWeekStart(d); }} className="btn btn-secondary btn-sm">Minggu Ini</button>
            <button onClick={nextWeek} className="btn btn-secondary btn-sm">Next →</button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }}/></div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <th className="px-3 py-2.5 text-left font-bold text-xs uppercase" style={{ color: 'var(--text-3)', minWidth: 120 }}>Karyawan</th>
                  {weekDates.map((d, i) => {
                    const isToday = d.toDateString() === new Date().toDateString();
                    return (
                      <th key={i} className="px-2 py-2.5 text-center font-bold text-xs" style={{ color: isToday ? 'var(--brand)' : 'var(--text-3)', minWidth: 90 }}>
                        {DAYS[d.getDay()]}<br/>
                        <span className={`text-base font-black ${isToday ? 'underline' : ''}`} style={{ color: isToday ? 'var(--brand)' : 'var(--text-1)' }}>{d.getDate()}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{u.name}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: `${EMP_COLOR[u.employeeType]||'#6b7280'}20`, color: EMP_COLOR[u.employeeType]||'#6b7280' }}>
                        {u.employeeType}
                      </span>
                    </td>
                    {weekDates.map((d, i) => {
                      const sc = getSchedule(u.id, d);
                      return (
                        <td key={i} className="px-2 py-2 text-center">
                          <button onClick={() => setEditCell({ userId: u.id, userName: u.name, date: d, sc })}
                            className="w-full min-h-[44px] rounded-xl text-xs font-medium transition-all hover:opacity-80"
                            style={sc?.isOffDay
                              ? { background: '#F3F4F6', color: '#9CA3AF' }
                              : sc
                                ? { background: 'var(--brand)', color: 'white' }
                                : { background: 'var(--surface-2)', color: 'var(--text-3)' }
                            }>
                            {sc?.isOffDay ? '🏖 Off' : sc ? sc.shift?.name?.replace('Shift ','') : '—'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Edit cell modal */}
        {editCell && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditCell(null)}>
            <div className="bg-white rounded-2xl p-5 w-full max-w-xs shadow-2xl" onClick={e => e.stopPropagation()}>
              <p className="font-black text-base mb-1" style={{ color: 'var(--text-1)' }}>{editCell.userName}</p>
              <p className="text-sm mb-4" style={{ color: 'var(--text-3)' }}>
                {editCell.date.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'})}
              </p>
              <div className="space-y-2">
                {shifts.map(sh => (
                  <button key={sh.id} onClick={() => setShiftForCell(editCell.userId, editCell.date, sh.id, false)}
                    className="w-full py-3 rounded-xl text-sm font-bold text-left px-4 border-2 transition-all"
                    style={{ borderColor: editCell.sc?.shiftTemplateId === sh.id ? 'var(--brand)' : 'var(--border)', color: 'var(--text-1)' }}>
                    {sh.name}
                    <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-3)' }}>{sh.startTime}–{sh.endTime}</span>
                  </button>
                ))}
                <button onClick={() => setShiftForCell(editCell.userId, editCell.date, null, true)}
                  className="w-full py-3 rounded-xl text-sm font-bold text-left px-4 border-2 transition-all"
                  style={{ borderColor: editCell.sc?.isOffDay ? '#9CA3AF' : 'var(--border)', color: '#9CA3AF' }}>
                  🏖 Hari Libur
                </button>
                {editCell.sc && (
                  <button onClick={() => setShiftForCell(editCell.userId, editCell.date, null, false)}
                    className="w-full py-2 rounded-xl text-xs text-red-400 hover:bg-red-50 transition-colors">
                    Hapus Jadwal
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
