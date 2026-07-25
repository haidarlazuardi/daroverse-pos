'use client';
import { useState, useEffect, useRef } from 'react';

type User = { id: string; name: string; role: string };
type Step = 'select' | 'camera' | 'preview' | 'done';

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', OWNER: 'Owner', MANAGER: 'Manager',
  STAFF: 'Staff', CASHIER: 'Kasir',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export default function AbsensiPage() {
  const [users, setUsers]           = useState<User[]>([]);
  const [selected, setSelected]     = useState<User | null>(null);
  const [step, setStep]             = useState<Step>('select');
  const [photo, setPhoto]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState<any>(null);
  const [error, setError]           = useState('');
  const [stream, setStream]         = useState<MediaStream | null>(null);
  const [location, setLocation]     = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [locError, setLocError]     = useState('');

  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const serif = { fontFamily: "'Georgia', serif" };
  const bg    = '#FAF7F2';
  const dark  = '#1C1C1C';
  const green = '#48654D';
  const cream = '#F2EBE0';
  const muted = '#8A8278';

  useEffect(() => {
    fetch('/api/public/attendance')
      .then(r => r.json())
      .then(d => setUsers(d.data || []));
  }, []);

  // Start camera when step = camera
  useEffect(() => {
    if (step !== 'camera') return;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 640 } })
      .then(s => {
        setStream(s);
        if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); }
      })
      .catch(() => setError('Tidak bisa akses kamera. Izinkan akses kamera di browser.'));
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, [step]);

  function stopStream() {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
  }

  function takePhoto() {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const SIZE = 480;
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;
    const vw = video.videoWidth, vh = video.videoHeight;
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2, sy = (vh - side) / 2;
    ctx.drawImage(video, sx, sy, side, side, 0, 0, SIZE, SIZE);
    const b64 = canvas.toDataURL('image/jpeg', 0.75);
    setPhoto(b64);
    stopStream();
    setStep('preview');

    // Get location immediately after photo
    setLocError('');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }),
        () => setLocError('Lokasi tidak bisa diakses'),
        { timeout: 8000, enableHighAccuracy: true }
      );
    } else {
      setLocError('Browser tidak support GPS');
    }
  }

  async function submit() {
    if (!selected || !photo) return;
    setSubmitting(true); setError('');
    try {
      const r = await fetch('/api/public/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selected.id, photo, location }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal');
      setResult(d.data);
      setStep('done');
    } catch (e: any) {
      setError(e.message);
    } finally { setSubmitting(false); }
  }

  function reset() {
    setSelected(null); setPhoto(''); setResult(null); setError(''); setStep('select');
  }

  // ── SELECT ────────────────────────────────────────────────────────────────
  if (step === 'select') return (
    <div className="min-h-screen flex flex-col" style={{ background: bg }}>
      {/* Header */}
      <div className="px-6 pt-10 pb-6">
        <p className="text-xs tracking-[0.2em] uppercase font-semibold mb-1" style={{ color: muted }}>Soeka House</p>
        <h1 className="text-4xl font-black leading-none" style={{ ...serif, color: dark }}>
          Absensi<br /><em>Karyawan</em>
        </h1>
        <p className="text-sm mt-2" style={{ color: muted }}>
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="px-6 pb-4">
        <p className="text-xs tracking-widest uppercase font-semibold mb-3" style={{ color: muted }}>Pilih Nama Kamu</p>
        <div className="space-y-2">
          {users.map(u => (
            <button key={u.id} onClick={() => { setSelected(u); setStep('camera'); }}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98]"
              style={{ background: 'white', borderColor: '#EDE5D8' }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center font-black text-lg text-white flex-shrink-0"
                style={{ background: green }}>
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-base" style={{ color: dark }}>{u.name}</p>
                <p className="text-xs" style={{ color: muted }}>{ROLE_LABEL[u.role] || u.role}</p>
              </div>
              <svg className="ml-auto flex-shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-red-600 text-center">{error}</p>}
      </div>
    </div>
  );

  // ── CAMERA ────────────────────────────────────────────────────────────────
  if (step === 'camera') return (
    <div className="min-h-screen flex flex-col" style={{ background: dark }}>
      <div className="px-5 pt-6 pb-3 flex items-center gap-3">
        <button onClick={() => { stopStream(); setStep('select'); }}
          className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <p className="text-white font-bold">{selected?.name}</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Ambil selfie untuk absensi</p>
        </div>
      </div>

      {/* Camera viewfinder */}
      <div className="flex-1 flex flex-col items-center justify-center px-5">
        <div className="relative w-full max-w-sm aspect-square rounded-3xl overflow-hidden mb-6">
          <video ref={videoRef} autoPlay playsInline muted
            className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }}/>
          {/* Corner guides */}
          {[['top-3 left-3','border-t-2 border-l-2'],['top-3 right-3','border-t-2 border-r-2'],
            ['bottom-3 left-3','border-b-2 border-l-2'],['bottom-3 right-3','border-b-2 border-r-2']].map(([pos, cls], i) => (
            <div key={i} className={`absolute ${pos} w-8 h-8 ${cls} rounded-sm`} style={{ borderColor: 'rgba(255,255,255,0.8)' }}/>
          ))}
        </div>
        <canvas ref={canvasRef} className="hidden"/>

        {error ? (
          <div className="text-center">
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <button onClick={() => { setError(''); setStep('select'); }}
              className="px-6 py-3 rounded-xl text-white font-bold" style={{ background: 'rgba(255,255,255,0.15)' }}>
              Kembali
            </button>
          </div>
        ) : (
          <button onClick={takePhoto}
            className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-transform active:scale-95"
            style={{ background: 'rgba(255,255,255,0.2)' }}>
            <div className="w-14 h-14 rounded-full bg-white"/>
          </button>
        )}
        <p className="text-xs mt-4 text-center" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Posisikan wajah di dalam frame lalu tap tombol
        </p>
      </div>
    </div>
  );

  // ── PREVIEW ───────────────────────────────────────────────────────────────
  if (step === 'preview') return (
    <div className="min-h-screen flex flex-col" style={{ background: bg }}>
      <div className="px-5 pt-6 pb-3 flex items-center gap-3">
        <button onClick={() => { setPhoto(''); setStep('camera'); }}
          className="w-9 h-9 rounded-full border flex items-center justify-center" style={{ borderColor: '#EDE5D8', background: 'white' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={dark} strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 className="font-black text-xl" style={{ ...serif, color: dark }}>Konfirmasi</h1>
      </div>

      <div className="px-5 space-y-4 pb-8">
        {/* Preview foto */}
        <div className="rounded-3xl overflow-hidden aspect-square max-w-xs mx-auto" style={{ border: '3px solid #EDE5D8' }}>
          <img src={photo} alt="selfie" className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }}/>
        </div>

        {/* Info */}
        <div className="rounded-2xl p-4 border" style={{ background: 'white', borderColor: '#EDE5D8' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white"
              style={{ background: green }}>
              {selected?.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold" style={{ color: dark }}>{selected?.name}</p>
              <p className="text-xs" style={{ color: muted }}>
                {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              </p>
            </div>
          </div>
          {/* Location */}
          <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: '#EDE5D8' }}>
            <span className="text-base">📍</span>
            {location ? (
              <div>
                <p className="text-xs font-semibold" style={{ color: dark }}>
                  {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                </p>
                <p className="text-xs" style={{ color: muted }}>Akurasi ±{location.accuracy}m</p>
              </div>
            ) : locError ? (
              <p className="text-xs text-amber-600">{locError} — absensi tetap bisa dilanjutkan</p>
            ) : (
              <p className="text-xs" style={{ color: muted }}>Mendapatkan lokasi...</p>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

        <button onClick={submit} disabled={submitting}
          className="w-full py-4 rounded-2xl font-black text-base disabled:opacity-50 transition-all"
          style={{ background: dark, color: bg, ...serif }}>
          {submitting ? 'Menyimpan...' : '✓ Konfirmasi Absensi'}
        </button>
        <button onClick={() => { setPhoto(''); setStep('camera'); }}
          className="w-full py-3 rounded-2xl font-bold text-sm border-2" style={{ borderColor: '#EDE5D8', color: muted }}>
          Ambil Ulang
        </button>
      </div>
    </div>
  );

  // ── DONE ──────────────────────────────────────────────────────────────────
  if (step === 'done' && result) {
    const isIn = result.type === 'CHECK_IN';
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: bg }}>
        <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl mb-6"
          style={{ background: isIn ? '#D1FAE5' : '#FEE2E2' }}>
          {isIn ? '✅' : '👋'}
        </div>
        <p className="text-sm font-semibold mb-1" style={{ color: muted }}>{getGreeting()},</p>
        <h1 className="text-3xl font-black mb-2" style={{ ...serif, color: dark }}>{result.userName}!</h1>
        <p className="text-lg font-bold mb-1" style={{ color: isIn ? green : '#DC2626' }}>
          {isIn ? 'Kamu sudah masuk ✓' : 'Sampai jumpa! 👋'}
        </p>
        <p className="text-4xl font-black tabular-nums my-4" style={{ ...serif, color: dark }}>
          {new Date(result.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <p className="text-sm mb-8" style={{ color: muted }}>
          {new Date(result.createdAt).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>

        {/* Preview foto kecil */}
        <div className="w-24 h-24 rounded-2xl overflow-hidden mb-8 border-2" style={{ borderColor: '#EDE5D8' }}>
          <img src={photo} alt="selfie" className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }}/>
        </div>

        <button onClick={reset}
          className="w-full max-w-xs py-4 rounded-2xl font-black text-base"
          style={{ background: dark, color: bg, ...serif }}>
          Selesai
        </button>
      </div>
    );
  }

  return null;
}
