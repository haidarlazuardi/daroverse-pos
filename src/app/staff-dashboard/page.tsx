'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store';
import { api } from '@/lib/fetch';
import { formatCurrency } from '@/components/ui';
import BottomNav from '@/components/staff/BottomNav';

const G = '#48654D'; // brand green
const DAYS = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

export default function StaffDashboard() {
  const router = useRouter();
  const { user, hydrate } = useAuthStore();
  const [data, setData]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => {
    if (!user) return;
    if (['OWNER','MANAGER','SUPER_ADMIN'].includes(user.role)) { router.replace('/dashboard'); return; }
    api.get<any>('/api/staff/me').then(setData).finally(() => setLoading(false));
  }, [user]);

  const now   = new Date();
  const today = now.toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long' });

  if (loading || !user) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F7F3EE' }}>
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: G, borderTopColor: 'transparent' }}/>
    </div>
  );

  const attendance = data?.attendance;
  const payroll    = data?.payroll?.current;
  const kasbons    = data?.kasbons || [];
  const schedules  = data?.schedules || [];

  return (
    <div className="min-h-screen pb-24" style={{ background: '#F7F3EE', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Header */}
      <div className="px-5 pt-12 pb-6" style={{ background: G }}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-green-200 text-xs font-medium tracking-widest uppercase mb-1">{today}</p>
            <h1 className="text-white font-black text-2xl leading-tight">Halo, {user.name.split(' ')[0]} 👋</h1>
          </div>
          <button onClick={() => { useAuthStore.getState().logout(); router.replace('/login'); }}
            className="w-9 h-9 rounded-full flex items-center justify-center mt-1"
            style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
          </button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-3.5" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <p className="text-green-200 text-xs mb-1">Hari Masuk</p>
            <p className="text-white font-black text-2xl">{attendance?.monthCount ?? '–'}</p>
            <p className="text-green-200 text-xs">{MONTHS[now.getMonth()]}</p>
          </div>
          <div className="rounded-2xl p-3.5" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <p className="text-green-200 text-xs mb-1">Est. Take Home</p>
            <p className="text-white font-black text-lg leading-tight">{payroll ? formatCurrency(payroll.estimateTakeHome) : '–'}</p>
            <p className="text-green-200 text-xs">bulan ini</p>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-4 mt-4">

        {/* Absen Card */}
        <AbsenCard attendance={attendance} userId={user.userId} onRefresh={() =>
          api.get<any>('/api/staff/me').then(setData)
        }/>

        {/* Jadwal Minggu Ini */}
        <ScheduleCard schedules={schedules}/>

        {/* Payroll Breakdown */}
        {payroll && <PayrollCard payroll={payroll} record={data?.payroll?.record} month={MONTHS[now.getMonth()]} year={now.getFullYear()}/>}

        {/* Kasbon */}
        {kasbons.length > 0 && <KasbonCard kasbons={kasbons}/>}
      </div>
    </div>
  );
}

// ── Absen Card ────────────────────────────────────────────────────────────────
function AbsenCard({ attendance, userId, onRefresh }: any) {
  const [step, setStep]     = useState<'idle'|'camera'|'preview'|'done'>('idle');
  const [photo, setPhoto]   = useState('');
  const [loc, setLoc]       = useState<any>(null);
  const [busy, setBusy]     = useState(false);
  const [result, setResult] = useState<any>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream|null>(null);

  const checkedIn  = attendance?.today?.checkedIn;
  const checkedOut = attendance?.today?.checkedOut;
  const nextType   = !checkedIn ? 'CHECK_IN' : !checkedOut ? 'CHECK_OUT' : null;

  useEffect(() => {
    if (step === 'camera') startCam();
    return () => stopStream();
  }, [step]);

  async function startCam() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode:'user', width:{ideal:640}, height:{ideal:640} } });
      streamRef.current = s;
      if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); }
    } catch { setStep('idle'); alert('Tidak bisa akses kamera'); }
  }
  function stopStream() { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; }

  function snap() {
    const v = videoRef.current; const c = canvasRef.current; if (!v||!c) return;
    const S = 480; c.width=S; c.height=S;
    const ctx = c.getContext('2d')!;
    const side = Math.min(v.videoWidth,v.videoHeight);
    ctx.save(); ctx.scale(-1,1); ctx.translate(-S,0);
    ctx.drawImage(v,(v.videoWidth-side)/2,(v.videoHeight-side)/2,side,side,0,0,S,S);
    ctx.restore();
    setPhoto(c.toDataURL('image/jpeg',0.8));
    stopStream(); setStep('preview');
    navigator.geolocation?.getCurrentPosition(
      p => setLoc({ lat:p.coords.latitude, lng:p.coords.longitude, accuracy:Math.round(p.coords.accuracy) }),
      () => {}, { timeout:8000, enableHighAccuracy:true }
    );
  }

  async function submit() {
    setBusy(true);
    try {
      const r = await api.post<any>('/api/staff/attendance', { photo, location: loc });
      setResult(r); setStep('done'); onRefresh();
    } catch(e:any) { alert(e.message || 'Gagal'); setBusy(false); }
    finally { setBusy(false); }
  }

  // Idle state
  if (step === 'idle') return (
    <div className="rounded-2xl overflow-hidden bg-white" style={{ boxShadow: '0 2px 16px rgba(72,101,77,0.08)' }}>
      <div className="p-4">
        <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#A0A0A0' }}>Kehadiran Hari Ini</p>
        <div className="flex gap-3 mb-4">
          {[
            { label:'Masuk', done: checkedIn, color:'#22C55E' },
            { label:'Pulang', done: checkedOut, color:'#F59E0B' },
          ].map(item => (
            <div key={item.label} className="flex-1 rounded-xl p-3 flex items-center gap-2.5"
              style={{ background: item.done ? item.color+'12' : '#F7F7F7' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: item.done ? item.color : '#E5E5E5' }}>
                {item.done
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  : <div className="w-2 h-2 rounded-full bg-gray-300"/>}
              </div>
              <span className="text-sm font-bold" style={{ color: item.done ? '#1a1a1a' : '#B0B0B0' }}>{item.label}</span>
            </div>
          ))}
        </div>
        {nextType ? (
          <button onClick={() => setStep('camera')}
            className="w-full py-3.5 rounded-xl font-black text-white text-sm tracking-wide transition-all active:scale-98"
            style={{ background: G, boxShadow: `0 4px 14px ${G}40` }}>
            {nextType === 'CHECK_IN' ? '👆 Absen Masuk Sekarang' : '👋 Absen Pulang Sekarang'}
          </button>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm font-semibold" style={{ color: G }}>✓ Absensi hari ini lengkap</p>
          </div>
        )}
      </div>
    </div>
  );

  // Camera
  if (step === 'camera') return (
    <div className="rounded-2xl overflow-hidden bg-black" style={{ aspectRatio:'1' }}>
      <div className="relative w-full h-full">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted style={{ transform:'scaleX(-1)' }}/>
        <canvas ref={canvasRef} className="hidden"/>
        {/* Oval guide */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="rounded-full border-4 border-white/60" style={{ width:180, height:220, boxShadow:'0 0 0 9999px rgba(0,0,0,0.5)' }}/>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col items-center gap-3">
          <p className="text-white text-xs font-medium opacity-70">Posisikan wajah di dalam oval</p>
          <button onClick={snap}
            className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center"
            style={{ background: G }}>
            <div className="w-10 h-10 rounded-full bg-white"/>
          </button>
          <button onClick={() => { stopStream(); setStep('idle'); }} className="text-white/60 text-xs">Batal</button>
        </div>
      </div>
    </div>
  );

  // Preview
  if (step === 'preview') return (
    <div className="rounded-2xl overflow-hidden bg-white" style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
      <img src={photo} alt="selfie" className="w-full aspect-square object-cover"/>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <span>📍</span>
          <span style={{ color: loc ? '#1a1a1a' : '#A0A0A0' }}>
            {loc ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)} (±${loc.accuracy}m)` : 'Mendapatkan lokasi...'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => { setPhoto(''); setLoc(null); setStep('camera'); }}
            className="py-3 rounded-xl font-bold text-sm border" style={{ borderColor: '#E5E5E5', color: '#666' }}>
            Ulangi
          </button>
          <button onClick={submit} disabled={busy}
            className="py-3 rounded-xl font-black text-sm text-white" style={{ background: G }}>
            {busy ? 'Menyimpan...' : 'Konfirmasi'}
          </button>
        </div>
      </div>
    </div>
  );

  // Done
  if (step === 'done') return (
    <div className="rounded-2xl bg-white p-8 text-center" style={{ boxShadow: '0 2px 16px rgba(72,101,77,0.08)' }}>
      <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: G+'15' }}>
        <span className="text-3xl">{result?.type === 'CHECK_IN' ? '👆' : '👋'}</span>
      </div>
      <p className="font-black text-lg mb-1" style={{ color: '#1a1a1a' }}>
        {result?.type === 'CHECK_IN' ? 'Absen Masuk Berhasil' : 'Absen Pulang Berhasil'}
      </p>
      <p className="text-sm" style={{ color: '#A0A0A0' }}>
        {new Date().toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })} WIB
      </p>
      <button onClick={() => setStep('idle')} className="mt-5 px-6 py-2.5 rounded-xl text-sm font-bold"
        style={{ background: G+'15', color: G }}>
        Selesai
      </button>
    </div>
  );

  return null;
}

// ── Schedule Card ─────────────────────────────────────────────────────────────
function ScheduleCard({ schedules }: any) {
  const now = new Date();
  const weekDays = Array.from({ length:7 }, (_,i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - now.getDay() + i + 1); // Mon–Sun
    return d;
  });

  return (
    <div className="rounded-2xl bg-white p-4" style={{ boxShadow: '0 2px 16px rgba(72,101,77,0.06)' }}>
      <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#A0A0A0' }}>Jadwal Minggu Ini</p>
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((d, i) => {
          const dateStr = d.toISOString().slice(0,10);
          const sched   = schedules.find((s: any) => s.date?.slice(0,10) === dateStr);
          const isToday = d.toDateString() === now.toDateString();
          const shiftName = sched?.isOffDay ? 'Off' : sched?.shift?.name?.replace('Shift ','').slice(0,1) || '–';
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <p className="text-xs" style={{ color: '#C0C0C0' }}>{DAYS[i+1]}</p>
              <div className="w-full aspect-square rounded-xl flex items-center justify-center text-xs font-black transition-all"
                style={{
                  background: isToday ? G : sched && !sched.isOffDay ? G+'18' : '#F5F5F5',
                  color: isToday ? 'white' : sched && !sched.isOffDay ? G : '#C0C0C0',
                  border: isToday ? 'none' : '1.5px solid transparent',
                }}>
                {shiftName}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Payroll Card ──────────────────────────────────────────────────────────────
function PayrollCard({ payroll, record, month, year }: any) {
  const [open, setOpen] = useState(true);

  const rows = [
    { label: 'Hari masuk', value: `${payroll.presentDays} hari`, highlight: false },
    { label: 'Gaji pokok', value: formatCurrency(payroll.baseSalary), highlight: false },
    { label: 'Estimasi SC', value: payroll.scEstimate > 0 ? formatCurrency(payroll.scEstimate) : 'Belum ada SC', highlight: false },
    { label: 'Potongan kasbon', value: payroll.kasbonDeduction > 0 ? `−${formatCurrency(payroll.kasbonDeduction)}` : '—', highlight: false },
  ];

  return (
    <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 2px 16px rgba(72,101,77,0.06)' }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-4">
        <div className="text-left">
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#A0A0A0' }}>Payroll</p>
          <p className="font-black text-base mt-0.5" style={{ color: '#1a1a1a' }}>{month} {year}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs" style={{ color: '#A0A0A0' }}>Est. Take Home</p>
            <p className="font-black text-lg" style={{ color: G }}>{formatCurrency(payroll.estimateTakeHome)}</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C0C0C0" strokeWidth="2"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t" style={{ borderColor: '#F0EDE8' }}>
          {rows.map(row => (
            <div key={row.label} className="flex justify-between px-4 py-2.5 border-b" style={{ borderColor: '#F7F5F2' }}>
              <span className="text-sm" style={{ color: '#888' }}>{row.label}</span>
              <span className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{row.value}</span>
            </div>
          ))}
          {record && (
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#F7F9F7' }}>
              <div>
                <p className="text-xs" style={{ color: '#A0A0A0' }}>Slip terakhir dibayar</p>
                <p className="text-sm font-bold" style={{ color: G }}>{formatCurrency(record.totalAmount)}</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{ background: '#D1FAE5', color: '#065F46' }}>
                {record.period?.status}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Kasbon Card ───────────────────────────────────────────────────────────────
function KasbonCard({ kasbons }: any) {
  const total = kasbons.reduce((s: number, k: any) => s + k.remaining, 0);

  return (
    <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 2px 16px rgba(72,101,77,0.06)' }}>
      <div className="px-4 py-3.5 flex items-center justify-between border-b" style={{ borderColor: '#F0EDE8' }}>
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#A0A0A0' }}>Kasbon Aktif</p>
        <p className="font-black text-base" style={{ color: '#EF4444' }}>{formatCurrency(total)}</p>
      </div>
      {kasbons.map((k: any) => {
        const pct = Math.round(((k.amount - k.remaining) / k.amount) * 100);
        return (
          <div key={k.id} className="px-4 py-3.5 border-b last:border-0" style={{ borderColor: '#F7F5F2' }}>
            <div className="flex justify-between mb-2">
              <p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{k.reason || 'Kasbon'}</p>
              <p className="text-sm font-bold" style={{ color: '#EF4444' }}>{formatCurrency(k.remaining)}</p>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F0EDE8' }}>
              <div className="h-full rounded-full transition-all" style={{ width:`${pct}%`, background: G }}/>
            </div>
            <p className="text-xs mt-1.5" style={{ color: '#B0B0B0' }}>{pct}% dilunasi dari {formatCurrency(k.amount)}</p>
          </div>
        );
      })}
    </div>
  );
}
