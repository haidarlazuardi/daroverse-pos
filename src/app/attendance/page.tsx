'use client';
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/fetch';

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const EMP_COLOR: Record<string,string> = { HELPER:'#f59e0b', STAFF:'#3b82f6', MANAGER:'#8b5cf6' };

export default function AttendancePage() {
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD in local
  const [view, setView]         = useState<'daily'|'monthly'>('daily');
  const [date, setDate]         = useState(todayStr);
  const [year, setYear]         = useState(now.getFullYear());
  const [month, setMonth]       = useState(now.getMonth()+1);
  const [records, setRecords]   = useState<any[]>([]);
  const [monthly, setMonthly]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(false);
  const [photoModal, setPhotoModal] = useState('');

  // Daily
  useEffect(() => {
    if (view !== 'daily') return;
    setLoading(true);
    api.get<any[]>(`/api/attendance?mode=daily&date=${date}`)
      .then(setRecords).catch(()=>{}).finally(()=>setLoading(false));
  }, [date, view]);

  // Monthly
  useEffect(() => {
    if (view !== 'monthly') return;
    setLoading(true);
    api.get<any[]>(`/api/attendance?mode=monthly&year=${year}&month=${month}`)
      .then(setMonthly).catch(()=>{}).finally(()=>setLoading(false));
  }, [year, month, view]);

  // Group daily by user
  const grouped = records.reduce((acc: Record<string,any[]>, r:any) => {
    const name = r.user?.name || r.userId;
    if (!acc[name]) acc[name] = [];
    acc[name].push(r);
    return acc;
  }, {});
  const summary = Object.entries(grouped).map(([name, recs]:[string,any[]]) => {
    const checkIn  = recs.find(r => r.type === 'CHECK_IN');
    const checkOut = recs.filter(r => r.type === 'CHECK_OUT').pop();
    let duration = '';
    if (checkIn && checkOut) {
      const diff = Math.round((new Date(checkOut.createdAt).getTime() - new Date(checkIn.createdAt).getTime()) / 60000);
      duration = `${Math.floor(diff/60)}j ${diff%60}m`;
    }
    return { name, checkIn, checkOut, duration, employeeType: recs[0]?.user?.employeeType };
  });

  const fmt = (dt: string) => new Date(dt).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black" style={{ color:'var(--text-1)' }}>Absensi</h1>
            <p className="text-sm" style={{ color:'var(--text-3)' }}>
              {view==='daily' ? `${summary.length} karyawan hadir` : `Rekap ${MONTHS[month-1]} ${year}`}
            </p>
          </div>
          <a href="/absensi" target="_blank" className="btn btn-secondary btn-sm text-xs">🔗 Link Absensi</a>
        </div>

        {/* View toggle */}
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background:'var(--surface-2)' }}>
          {(['daily','monthly'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={view===v ? {background:'white',color:'var(--text-1)',boxShadow:'0 1px 3px rgba(0,0,0,0.1)'} : {color:'var(--text-3)'}}>
              {v==='daily' ? 'Harian' : 'Bulanan'}
            </button>
          ))}
        </div>

        {/* Filters */}
        {view==='daily' ? (
          <div className="flex items-center gap-2">
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="input py-1.5 text-sm"/>
            <button onClick={()=>setDate(todayStr)} className="btn btn-secondary btn-sm">Hari Ini</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <select value={month} onChange={e=>setMonth(parseInt(e.target.value))} className="input py-1.5 text-sm">
              {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
            </select>
            <select value={year} onChange={e=>setYear(parseInt(e.target.value))} className="input py-1.5 text-sm">
              {[2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor:'var(--brand)',borderTopColor:'transparent' }}/>
          </div>
        ) : view==='daily' ? (
          /* ── DAILY VIEW ─────────────────────────────────────── */
          summary.length===0 ? (
            <div className="card text-center py-12">
              <p className="text-3xl mb-2">📋</p>
              <p style={{ color:'var(--text-3)' }}>Belum ada absensi {date===todayStr ? 'hari ini' : date}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {summary.map(({ name, checkIn, checkOut, duration, employeeType }) => (
                <div key={name} className="card p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-base flex-shrink-0"
                      style={{ background: EMP_COLOR[employeeType]||'var(--brand)' }}>
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold" style={{ color:'var(--text-1)' }}>{name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background:`${EMP_COLOR[employeeType]||'#6b7280'}15`, color:EMP_COLOR[employeeType]||'#6b7280' }}>
                        {employeeType||'—'}
                      </span>
                    </div>
                    {duration && (
                      <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background:'var(--surface-2)', color:'var(--text-2)' }}>
                        ⏱ {duration}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Check In */}
                    <div className="rounded-xl p-3 border" style={{ borderColor:'#D1FAE5', background:'#F0FDF4' }}>
                      <p className="text-xs font-bold mb-1 text-green-700">Masuk</p>
                      {checkIn ? (
                        <div>
                          <p className="text-xl font-black text-green-800 tabular-nums">{fmt(checkIn.createdAt)}</p>
                          {checkIn.photo && (
                            <button onClick={()=>setPhotoModal(checkIn.photo)} className="mt-1.5 w-full">
                              <img src={checkIn.photo} alt="selfie" className="w-full h-14 object-cover rounded-lg" style={{ transform:'scaleX(-1)' }}/>
                            </button>
                          )}
                          {!checkIn.photo && <p className="text-xs text-gray-400 mt-1">Foto expired</p>}
                          {checkIn.latitude && (
                            <a href={`https://maps.google.com/?q=${checkIn.latitude},${checkIn.longitude}`} target="_blank" rel="noopener noreferrer"
                              className="mt-1 flex items-center gap-1 text-xs text-green-600 underline">📍 Peta</a>
                          )}
                        </div>
                      ) : <p className="text-sm text-gray-400">—</p>}
                    </div>
                    {/* Check Out */}
                    <div className="rounded-xl p-3 border" style={{ borderColor:checkOut?'#FECACA':'#E5E7EB', background:checkOut?'#FFF5F5':'#F9FAFB' }}>
                      <p className="text-xs font-bold mb-1" style={{ color:checkOut?'#DC2626':'#9CA3AF' }}>Pulang</p>
                      {checkOut ? (
                        <div>
                          <p className="text-xl font-black tabular-nums" style={{ color:'#DC2626' }}>{fmt(checkOut.createdAt)}</p>
                          {checkOut.photo && (
                            <button onClick={()=>setPhotoModal(checkOut.photo)} className="mt-1.5 w-full">
                              <img src={checkOut.photo} alt="selfie" className="w-full h-14 object-cover rounded-lg" style={{ transform:'scaleX(-1)' }}/>
                            </button>
                          )}
                          {!checkOut.photo && <p className="text-xs text-gray-400 mt-1">Foto expired</p>}
                          {checkOut.latitude && (
                            <a href={`https://maps.google.com/?q=${checkOut.latitude},${checkOut.longitude}`} target="_blank" rel="noopener noreferrer"
                              className="mt-1 flex items-center gap-1 text-xs text-red-500 underline">📍 Peta</a>
                          )}
                        </div>
                      ) : <p className="text-sm" style={{ color:'#9CA3AF' }}>Belum pulang</p>}
                    </div>
                  </div>
                  {/* Correction buttons */}
                  <div className="mt-3 pt-3 border-t flex flex-wrap gap-2" style={{ borderColor:'var(--border)' }}>
                    {checkIn && (
                      <button onClick={async()=>{ if(!confirm('Hapus data absen masuk?'))return; await api.patch('/api/attendance',{id:checkIn.id,action:'delete'}); setRecords(p=>p.filter((r:any)=>r.id!==checkIn.id)); }}
                        className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">
                        🗑 Hapus Masuk
                      </button>
                    )}
                    {checkOut && (
                      <button onClick={async()=>{ if(!confirm('Hapus data absen pulang?'))return; await api.patch('/api/attendance',{id:checkOut.id,action:'delete'}); setRecords(p=>p.filter((r:any)=>r.id!==checkOut.id)); }}
                        className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">
                        🗑 Hapus Pulang
                      </button>
                    )}
                    {!checkIn && (
                      <button onClick={async()=>{ const t=prompt('Jam masuk (HH:MM):','08:00'); if(!t)return; const [h,m]=t.split(':'); const dt=new Date(date+'T'+h.padStart(2,'0')+':'+m.padStart(2,'0')+':00+07:00'); const r=await api.patch<any>('/api/attendance',{id:(checkOut?.userId||checkIn?.userId||''),action:'add',type:'CHECK_IN',createdAt:dt.toISOString()}); setRecords((p:any[])=>[...p,r]); }}
                        className="text-xs px-2.5 py-1 rounded-lg border text-green-600 border-green-200 hover:bg-green-50">
                        ＋ Tambah Masuk
                      </button>
                    )}
                    {checkIn && !checkOut && (
                      <button onClick={async()=>{ const t=prompt('Jam pulang (HH:MM):','17:00'); if(!t)return; const [h,m]=t.split(':'); const dt=new Date(date+'T'+h.padStart(2,'0')+':'+m.padStart(2,'0')+':00+07:00'); const r=await api.patch<any>('/api/attendance',{id:checkIn.userId,action:'add',type:'CHECK_OUT',createdAt:dt.toISOString()}); setRecords((p:any[])=>[...p,r]); }}
                        className="text-xs px-2.5 py-1 rounded-lg border text-amber-600 border-amber-200 hover:bg-amber-50">
                        ＋ Tambah Pulang
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* ── MONTHLY VIEW ───────────────────────────────────── */
          monthly.length===0 ? (
            <div className="card text-center py-12">
              <p className="text-3xl mb-2">📅</p>
              <p style={{ color:'var(--text-3)' }}>Belum ada data absensi {MONTHS[month-1]} {year}</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b flex justify-between items-center" style={{ borderColor:'var(--border)', background:'var(--surface-2)' }}>
                <span className="text-sm font-bold" style={{ color:'var(--text-2)' }}>Rekap Kehadiran — {MONTHS[month-1]} {year}</span>
                <span className="text-xs" style={{ color:'var(--text-3)' }}>Total hari masuk</span>
              </div>
              <div className="divide-y" style={{ borderColor:'var(--border)' }}>
                {monthly.map((m:any) => (
                  <div key={m.userId} className="flex items-center px-4 py-3 gap-4">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-white flex-shrink-0"
                      style={{ background: EMP_COLOR[m.user?.employeeType]||'var(--brand)' }}>
                      {m.user?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{ color:'var(--text-1)' }}>{m.user?.name}</p>
                      <p className="text-xs" style={{ color:'var(--text-3)' }}>{m.user?.employeeType} · Rp{Number(m.user?.dailyRate||0).toLocaleString('id-ID')}/hari</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black tabular-nums" style={{ color:'var(--brand)' }}>{m.presentCount}</p>
                      <p className="text-xs" style={{ color:'var(--text-3)' }}>hari masuk</p>
                    </div>
                    <div className="text-right w-28">
                      <p className="font-bold text-sm" style={{ color:'var(--text-1)' }}>
                        Rp{((m.user?.dailyRate||0)*m.presentCount).toLocaleString('id-ID')}
                      </p>
                      <p className="text-xs" style={{ color:'var(--text-3)' }}>estimasi gaji</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {/* Photo modal */}
        {photoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={()=>setPhotoModal('')}>
            <div className="relative max-w-sm w-full">
              <img src={photoModal} alt="selfie" className="w-full rounded-2xl" style={{ transform:'scaleX(-1)' }}/>
              <button className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">✕</button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
