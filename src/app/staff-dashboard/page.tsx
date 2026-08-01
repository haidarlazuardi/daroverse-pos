'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store';
import { api } from '@/lib/fetch';
import { formatCurrency } from '@/components/ui';

// ── QR Scan Hook ─────────────────────────────────────────────────────────────
function useQRScan(onScan: (data: any) => void) {
  const [scanning, setScanning] = useState(false);
  const activeRef = useRef(false);
  const streamRef = useRef<MediaStream|null>(null);

  async function startScan() {
    setScanning(true);
    activeRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:'environment' } });
      streamRef.current = stream;
      const video = document.createElement('video');
      video.srcObject = stream; video.playsInline = true; video.muted = true;
      await video.play();
      scanLoop(video);
    } catch { stopScan(); }
  }

  async function scanLoop(video: HTMLVideoElement) {
    if (!activeRef.current) return;
    const BD = (window as any).BarcodeDetector;
    if (!BD) { stopScan(); alert('Browser tidak support scan QR'); return; }
    const detector = new BD({ formats: ['qr_code'] });
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth||640; canvas.height = video.videoHeight||480;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    try {
      const codes = await detector.detect(canvas);
      if (codes.length > 0) {
        try { onScan(JSON.parse(codes[0].rawValue)); stopScan(); return; } catch {}
      }
    } catch {}
    if (activeRef.current) requestAnimationFrame(() => scanLoop(video));
  }

  function stopScan() {
    activeRef.current = false; setScanning(false);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  return { scanning, startScan, stopScan };
}

function QRBtn({ onScan }: { onScan:(d:any)=>void }) {
  const { scanning, startScan, stopScan } = useQRScan(onScan);
  return (
    <button onClick={scanning ? stopScan : startScan}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border"
      style={{ borderColor: scanning?'#dc2626':GREEN, color: scanning?'#dc2626':GREEN, background: scanning?'#fef2f2':'#e8f5e9' }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>
        <rect x="7" y="7" width="4" height="4" rx="1"/><rect x="13" y="7" width="4" height="4" rx="1"/>
        <rect x="7" y="13" width="4" height="4" rx="1"/>
      </svg>
      {scanning ? 'Stop' : 'Scan QR'}
    </button>
  );
}


const GREEN = '#48654D';
const CREAM = '#F6EDDB';
const DAYS  = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

type Section = 'home' | 'payroll' | 'absensi' | 'stok' | 'transaksi' | 'pengeluaran' | 'request' | 'printer';

export default function StaffDashboard() {
  const router = useRouter();
  const { user, hydrate } = useAuthStore();
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>('home');
  const [absenModal, setAbsenModal] = useState(false);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (!user) return;
    // Redirect non-staff to dashboard
    if (['OWNER','MANAGER','SUPER_ADMIN'].includes(user.role)) {
      router.replace('/dashboard');
      return;
    }
    loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    try {
      const d = await api.get<any>('/api/staff/me');
      setData(d);
    } catch {} finally { setLoading(false); }
  }

  if (loading || !user) return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: CREAM }}>
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: GREEN, borderTopColor: 'transparent' }}/>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: '#F5F0E8', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-safe" style={{ background: GREEN }}>
        <div className="flex items-center justify-between py-4">
          <div>
            <p className="text-xs text-green-200 font-medium">Selamat datang</p>
            <p className="text-white font-black text-lg leading-tight">{user.name}</p>
          </div>
          <div className="flex items-center gap-3">
            {data?.user?.role === 'STAFF' && (
              <button onClick={() => router.push('/pos')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-white border border-white/30"
                style={{ background: 'rgba(255,255,255,0.15)' }}>
                POS →
              </button>
            )}
            <button onClick={() => { useAuthStore.getState().logout(); router.replace('/login'); }}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.15)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            </button>
          </div>
        </div>

        {/* Nav tabs */}
        <div className="flex gap-1 pb-3 overflow-x-auto scrollbar-hide">
          {([
            ['home','🏠','Beranda'],
            ['absensi','👆','Absen'],
            ['payroll','💰','Payroll'],
            ['stok','📦','Stok'],
            ['transaksi','🧾','Riwayat'],
            ['pengeluaran','💸','Pengeluaran'],
            ['request','📋','Request'],
            ['printer','🖨️','Printer'],
          ] as [Section,string,string][]).map(([s,icon,label]) => (
            <button key={s} onClick={() => setSection(s)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={{ background: section===s ? 'white' : 'rgba(255,255,255,0.15)', color: section===s ? GREEN : 'rgba(255,255,255,0.8)' }}>
              <span>{icon}</span><span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4 pb-8">
        {section === 'home' && <HomeSection data={data} onAbsen={() => setSection('absensi')}/>}
        {section === 'absensi' && <AbsenSection data={data} onRefresh={loadData}/>}
        {section === 'payroll' && <PayrollSection data={data}/>}
        {section === 'stok' && <StokSection/>}
        {section === 'transaksi' && <TransaksiSection/>}
        {section === 'pengeluaran' && <PengeluaranSection onDone={loadData}/>}
        {section === 'request' && <RequestSection onDone={loadData}/>}
        {section === 'printer' && <PrinterSection/>}
      </div>
    </div>
  );
}

// ── HOME ─────────────────────────────────────────────────────────────────────
function HomeSection({ data, onAbsen }: any) {
  if (!data) return null;
  const { attendance, payroll, schedules } = data;
  const today = new Date();
  const todayDay = today.getDay();

  return (
    <div className="space-y-4">
      {/* Absen card */}
      <div className="rounded-2xl p-4 text-white" style={{ background: GREEN }}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold text-sm opacity-80">Status Hari Ini</p>
          <p className="text-xs opacity-60">{today.toLocaleDateString('id-ID',{day:'numeric',month:'long'})}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl mb-1 ${attendance.today.checkedIn ? 'bg-green-400' : 'bg-white/20'}`}>
              {attendance.today.checkedIn ? '✓' : '–'}
            </div>
            <p className="text-xs opacity-70">Masuk</p>
          </div>
          <div className="text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl mb-1 ${attendance.today.checkedOut ? 'bg-orange-400' : 'bg-white/20'}`}>
              {attendance.today.checkedOut ? '✓' : '–'}
            </div>
            <p className="text-xs opacity-70">Pulang</p>
          </div>
          <div className="flex-1 text-right">
            <button onClick={onAbsen}
              className="px-4 py-2.5 rounded-xl font-bold text-sm"
              style={{ background: 'white', color: GREEN }}>
              {!attendance.today.checkedIn ? '👆 Absen Masuk' : !attendance.today.checkedOut ? '👋 Absen Pulang' : '✓ Sudah Absen'}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4 bg-white">
          <p className="text-xs text-gray-400 mb-1">Hari Masuk Bulan Ini</p>
          <p className="text-3xl font-black" style={{ color: GREEN }}>{attendance.monthCount}</p>
          <p className="text-xs text-gray-400">hari</p>
        </div>
        <div className="rounded-2xl p-4 bg-white">
          <p className="text-xs text-gray-400 mb-1">Est. Take Home</p>
          <p className="text-xl font-black" style={{ color: GREEN }}>{formatCurrency(payroll.current.estimateTakeHome)}</p>
          <p className="text-xs text-gray-400">bulan ini</p>
        </div>
      </div>

      {/* Jadwal minggu ini */}
      <div className="rounded-2xl p-4 bg-white">
        <p className="font-bold text-sm mb-3" style={{ color: GREEN }}>Jadwal Minggu Ini</p>
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((day, i) => {
            const sched = schedules?.find((s: any) => new Date(s.date).getDay() === i);
            const isToday = i === todayDay;
            return (
              <div key={day} className="text-center">
                <p className="text-xs text-gray-400 mb-1">{day}</p>
                <div className={`rounded-lg py-1.5 text-xs font-bold ${isToday ? 'border-2' : ''}`}
                  style={{
                    borderColor: isToday ? GREEN : 'transparent',
                    background: sched?.isOffDay ? '#F3F4F6' : sched ? GREEN + '15' : '#F9FAFB',
                    color: sched?.isOffDay ? '#9CA3AF' : sched ? GREEN : '#D1D5DB',
                  }}>
                  {sched?.isOffDay ? 'Off' : sched ? (sched.shift?.name?.replace('Shift ','') || '–') : '–'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── ABSEN ────────────────────────────────────────────────────────────────────
function AbsenSection({ data, onRefresh }: any) {
  const [step, setStep] = useState<'camera'|'preview'|'done'>('camera');
  const [photo, setPhoto] = useState('');
  const [location, setLocation] = useState<any>(null);
  const [locError, setLocError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream|null>(null);

  const { attendance } = data || {};
  const nextType = !attendance?.today?.checkedIn ? 'CHECK_IN' : !attendance?.today?.checkedOut ? 'CHECK_OUT' : null;

  useEffect(() => {
    if (step === 'camera' && nextType) startCamera();
    return () => stopStream();
  }, [step, nextType]);

  async function startCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode:'user', width:{ideal:640}, height:{ideal:640} } });
      streamRef.current = s;
      if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); }
    } catch { setLocError('Tidak bisa akses kamera'); }
  }

  function stopStream() { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; }

  function takePhoto() {
    const video = videoRef.current; const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const SIZE = 480; canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;
    const vw = video.videoWidth, vh = video.videoHeight;
    const side = Math.min(vw, vh);
    ctx.save(); ctx.scale(-1,1); ctx.translate(-SIZE,0);
    ctx.drawImage(video, (vw-side)/2, (vh-side)/2, side, side, 0, 0, SIZE, SIZE);
    ctx.restore();
    setPhoto(canvas.toDataURL('image/jpeg', 0.75));
    stopStream(); setStep('preview');
    navigator.geolocation?.getCurrentPosition(
      p => setLocation({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      () => setLocError('GPS tidak tersedia'),
      { timeout: 8000, enableHighAccuracy: true }
    );
  }

  async function submit() {
    setSubmitting(true);
    try {
      const r = await api.post<any>('/api/staff/attendance', { photo, location });
      setResult(r);
      setStep('done');
      onRefresh();
    } catch(e: any) { alert(e.message || 'Gagal'); }
    finally { setSubmitting(false); }
  }

  if (!nextType && step === 'camera') return (
    <div className="rounded-2xl p-6 bg-white text-center">
      <p className="text-4xl mb-3">✅</p>
      <p className="font-bold text-gray-900">Absensi hari ini sudah lengkap</p>
      <p className="text-sm text-gray-400 mt-1">Masuk & pulang sudah tercatat</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 bg-white">
        <p className="font-bold mb-1" style={{ color: GREEN }}>
          {nextType === 'CHECK_IN' ? '👆 Absen Masuk' : '👋 Absen Pulang'}
        </p>
        <p className="text-xs text-gray-400">{new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'})}</p>
      </div>

      {step === 'camera' && (
        <div className="space-y-3">
          <div className="rounded-2xl overflow-hidden bg-black aspect-square relative">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted style={{ transform:'scaleX(-1)' }}/>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 rounded-full border-4 border-white/50"/>
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden"/>
          <button onClick={takePhoto} className="w-full py-4 rounded-2xl font-black text-white text-lg" style={{ background: GREEN }}>
            📸 Ambil Foto
          </button>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-3">
          <div className="rounded-2xl overflow-hidden aspect-square">
            <img src={photo} alt="selfie" className="w-full h-full object-cover rounded-2xl"/>
          </div>
          <div className="rounded-2xl p-4 bg-white">
            <div className="flex items-center gap-2">
              <span className="text-lg">📍</span>
              {location ? (
                <div>
                  <p className="text-xs font-bold text-gray-700">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</p>
                  <p className="text-xs text-gray-400">Akurasi ±{location.accuracy}m</p>
                </div>
              ) : locError ? (
                <p className="text-xs text-amber-600">{locError}</p>
              ) : (
                <p className="text-xs text-gray-400">Mendapatkan lokasi...</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { setPhoto(''); setLocError(''); setStep('camera'); }} className="py-3 rounded-2xl font-bold border text-gray-600" style={{ borderColor: '#e5e7eb' }}>
              Ulangi
            </button>
            <button onClick={submit} disabled={submitting} className="py-3 rounded-2xl font-bold text-white" style={{ background: GREEN }}>
              {submitting ? 'Menyimpan...' : 'Konfirmasi'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="rounded-2xl p-8 bg-white text-center">
          <p className="text-5xl mb-3">{result?.type === 'CHECK_IN' ? '👆' : '👋'}</p>
          <p className="font-black text-lg text-gray-900">{result?.type === 'CHECK_IN' ? 'Absen Masuk Berhasil' : 'Absen Pulang Berhasil'}</p>
          <p className="text-sm text-gray-400 mt-1">{new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</p>
          <button onClick={() => setStep('camera')} className="mt-4 px-6 py-2.5 rounded-xl font-bold text-sm" style={{ background: GREEN + '15', color: GREEN }}>
            Kembali
          </button>
        </div>
      )}
    </div>
  );
}

// ── PAYROLL ──────────────────────────────────────────────────────────────────
function PayrollSection({ data }: any) {
  if (!data) return null;
  const { payroll, kasbons } = data;
  const { current, record } = payroll;
  const now = new Date(Date.now() + 7*60*60*1000);

  return (
    <div className="space-y-4">
      {/* Bulan berjalan */}
      <div className="rounded-2xl overflow-hidden bg-white">
        <div className="px-4 py-3 border-b" style={{ borderColor: '#F0ECE4', background: GREEN + '08' }}>
          <p className="font-black text-sm" style={{ color: GREEN }}>{MONTHS[now.getMonth()]} {now.getFullYear()} — Estimasi</p>
        </div>
        <div className="divide-y" style={{ borderColor: '#F0ECE4' }}>
          {[
            ['Hari Masuk', `${current.presentDays} hari`],
            ['Rate Harian', formatCurrency(current.dailyRate)],
            ['Gaji Pokok', formatCurrency(current.baseSalary)],
            ['SC Pool Bulan Ini', formatCurrency(current.scPool)],
            ['Estimasi SC Kamu', formatCurrency(current.scEstimate)],
            ['Potongan Kasbon', current.kasbonDeduction > 0 ? `-${formatCurrency(current.kasbonDeduction)}` : '—'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between px-4 py-3 text-sm">
              <span className="text-gray-500">{label}</span>
              <span className="font-semibold text-gray-900">{value}</span>
            </div>
          ))}
          <div className="flex justify-between px-4 py-4">
            <span className="font-bold text-gray-700">Estimasi Take Home</span>
            <span className="font-black text-xl" style={{ color: GREEN }}>{formatCurrency(current.estimateTakeHome)}</span>
          </div>
        </div>
      </div>

      {/* Kasbon aktif */}
      {kasbons.length > 0 && (
        <div className="rounded-2xl bg-white overflow-hidden">
          <div className="px-4 py-3 border-b" style={{ borderColor: '#F0ECE4' }}>
            <p className="font-black text-sm text-amber-700">💰 Kasbon Aktif</p>
          </div>
          {kasbons.map((k: any) => (
            <div key={k.id} className="px-4 py-3 border-b" style={{ borderColor: '#F0ECE4' }}>
              <div className="flex justify-between mb-2">
                <p className="text-sm font-semibold text-gray-900">{k.reason || 'Kasbon'}</p>
                <p className="text-sm font-bold text-red-500">{formatCurrency(k.remaining)}</p>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-green-500" style={{ width:`${((k.amount-k.remaining)/k.amount)*100}%` }}/>
              </div>
              <p className="text-xs text-gray-400 mt-1">{formatCurrency(k.amount-k.remaining)} dari {formatCurrency(k.amount)} dilunasi</p>
            </div>
          ))}
        </div>
      )}

      {/* History slip */}
      {record && (
        <div className="rounded-2xl bg-white overflow-hidden">
          <div className="px-4 py-3 border-b" style={{ borderColor: '#F0ECE4' }}>
            <p className="font-black text-sm" style={{ color: GREEN }}>Slip Gaji Terakhir</p>
          </div>
          <div className="px-4 py-3 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-400">Periode</span><span className="font-semibold">{MONTHS[record.period.month-1]} {record.period.year}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-400">Status</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${record.period.status==='PAID'?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'}`}>{record.period.status}</span>
            </div>
            <div className="flex justify-between text-sm"><span className="text-gray-400">Take Home</span><span className="font-black" style={{ color:GREEN }}>{formatCurrency(record.totalAmount)}</span></div>
            {record.period.paidAt && <div className="flex justify-between text-sm"><span className="text-gray-400">Dibayar</span><span className="font-semibold">{new Date(record.period.paidAt).toLocaleDateString('id-ID')}</span></div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── STOK ─────────────────────────────────────────────────────────────────────
function StokSection() {
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subSection, setSubSection] = useState<'cek'|'transfer'|'batch'|'waste'|'opname'|'receive'>('cek');

  useEffect(() => {
    api.get<any[]>('/api/ingredients?active=1').then(r => setIngredients(Array.isArray(r)?r:[])).finally(() => setLoading(false));
  }, []);

  const stockAt = (id: string, loc: string) =>
    ingredients.find(i => i.id === id)?.stockLevels?.find((s: any) => s.location === loc)?.quantity ?? 0;

  const tabs = [['cek','Cek'],['transfer','Transfer'],['batch','Batch'],['waste','Waste'],['opname','Opname'],['receive','Terima PO']];

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {tabs.map(([s,label]) => (
          <button key={s} onClick={() => setSubSection(s as any)}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={{ background: subSection===s ? GREEN : 'white', color: subSection===s ? 'white' : '#6b7280' }}>
            {label}
          </button>
        ))}
      </div>

      {subSection === 'cek' && (
        <div className="space-y-2">
          <input value={search} onChange={e => setSearch(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm bg-white" placeholder="Cari bahan..."/>
          {ingredients.filter(i => i.name.toLowerCase().includes(search.toLowerCase())).map(i => (
            <div key={i.id} className="rounded-xl bg-white p-3">
              <p className="font-semibold text-sm text-gray-900">{i.name}</p>
              <div className="flex gap-3 mt-1">
                {['GUDANG','BAR','KITCHEN'].map(l => (
                  <p key={l} className="text-xs text-gray-400">{l}: <span className="font-bold text-gray-700">{stockAt(i.id,l)}</span> {i.unit}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {subSection === 'transfer' && <StokTransfer ingredients={ingredients} stockAt={stockAt}/>}
      {subSection === 'batch'    && <StokBatch prepped={ingredients.filter(i => i.type==='PREPPED')}/>}
      {subSection === 'waste'    && <StokWaste ingredients={ingredients} stockAt={stockAt}/>}
      {subSection === 'opname'   && <StokOpname ingredients={ingredients}/>}
      {subSection === 'receive'  && <StokReceive/>}
    </div>
  );
}

function StokTransfer({ ingredients, stockAt }: any) {
  const raw = ingredients.filter((i:any) => i.type==='RAW');
  const [id,setId]=useState('');const [qty,setQty]=useState('');const [from,setFrom]=useState('GUDANG');const [to,setTo]=useState('BAR');const [busy,setBusy]=useState(false);
  const ing = raw.find((i:any) => i.id===id);
  function onQR(data:any){ if(data.ingredientId){setId(data.ingredientId);if(data.qty)setQty(String(data.qty));} }
  async function submit(){if(!id||!qty)return;setBusy(true);try{await api.post('/api/stock/transfer',{ingredientId:id,fromLocation:from,toLocation:to,quantity:parseFloat(qty)});alert('Transfer berhasil');setQty('');}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  return <div className="space-y-3">
    <div className="flex justify-between items-center"><span className="text-xs font-bold text-gray-500">Bahan</span><QRBtn onScan={onQR}/></div>
    <select value={id} onChange={e=>setId(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm bg-white"><option value="">Pilih bahan</option>{raw.map((i:any)=><option key={i.id} value={i.id}>{i.name}</option>)}</select>
    {ing && <p className="text-xs text-gray-400 px-1">Stok {from}: {stockAt(id,from)} {ing.unit}</p>}
    <div><p className="text-xs font-bold text-gray-500 mb-1.5">Dari</p><div className="flex gap-2">{['GUDANG','BAR','KITCHEN'].map(l=><button key={l} onClick={()=>setFrom(l)} className="flex-1 py-2 rounded-xl text-sm font-bold border" style={{ borderColor:from===l?GREEN:'#e5e7eb',color:from===l?GREEN:'#6b7280',background:from===l?GREEN+'10':'white' }}>{l}</button>)}</div></div>
    <div><p className="text-xs font-bold text-gray-500 mb-1.5">Ke</p><div className="flex gap-2">{['GUDANG','BAR','KITCHEN'].map(l=><button key={l} onClick={()=>setTo(l)} className="flex-1 py-2 rounded-xl text-sm font-bold border" style={{ borderColor:to===l?GREEN:'#e5e7eb',color:to===l?GREEN:'#6b7280',background:to===l?GREEN+'10':'white' }}>{l}</button>)}</div></div>
    <input type="number" value={qty} onChange={e=>setQty(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm bg-white" placeholder={`Jumlah (${ing?.unit||'unit'})`}/>
    <button onClick={submit} disabled={busy||!id||!qty||from===to} className="w-full py-3 rounded-xl font-bold text-white" style={{ background:GREEN }}>{busy?'Proses...':'Transfer'}</button>
  </div>;
}

function StokBatch({ prepped }: any) {
  const [id,setId]=useState('');const [mult,setMult]=useState('1');const [loc,setLoc]=useState('BAR');const [busy,setBusy]=useState(false);
  async function submit(){if(!id)return;setBusy(true);try{await api.post('/api/stock/batch',{ingredientId:id,multiplier:parseFloat(mult),location:loc});alert('Batch selesai');}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  return <div className="space-y-3">
    <select value={id} onChange={e=>setId(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm bg-white"><option value="">Pilih olahan</option>{prepped.map((i:any)=><option key={i.id} value={i.id}>{i.name}</option>)}</select>
    <input type="number" value={mult} onChange={e=>setMult(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm bg-white" placeholder="Multiplier (1 = 1x resep)"/>
    <div className="flex gap-2">{['BAR','KITCHEN','GUDANG'].map(l=><button key={l} onClick={()=>setLoc(l)} className="flex-1 py-2 rounded-xl text-sm font-bold border" style={{ borderColor:loc===l?GREEN:'#e5e7eb',color:loc===l?GREEN:'#6b7280' }}>{l}</button>)}</div>
    <button onClick={submit} disabled={busy||!id} className="w-full py-3 rounded-xl font-bold text-white" style={{ background:GREEN }}>{busy?'Proses...':'Buat Batch'}</button>
  </div>;
}

function StokWaste({ ingredients, stockAt }: any) {
  const [id,setId]=useState('');const [qty,setQty]=useState('');const [loc,setLoc]=useState('BAR');const [reason,setReason]=useState('');const [busy,setBusy]=useState(false);
  const ing = ingredients.find((i:any)=>i.id===id);
  function onQR(data:any){ if(data.ingredientId){setId(data.ingredientId);if(data.qty)setQty(String(data.qty));} }
  async function submit(){if(!id||!qty)return;setBusy(true);try{await api.post('/api/stock/waste',{ingredientId:id,quantity:parseFloat(qty),location:loc,reason});alert('Waste dicatat');setQty('');setReason('');}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  return <div className="space-y-3">
    <div className="flex justify-between items-center"><span className="text-xs font-bold text-gray-500">Bahan</span><QRBtn onScan={onQR}/></div>
    <select value={id} onChange={e=>setId(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm bg-white"><option value="">Pilih bahan</option>{ingredients.map((i:any)=><option key={i.id} value={i.id}>{i.name}</option>)}</select>
    {ing && <p className="text-xs text-gray-400 px-1">Stok {loc}: {stockAt(id,loc)} {ing.unit}</p>}
    <div className="flex gap-2">{['BAR','KITCHEN','GUDANG'].map(l=><button key={l} onClick={()=>setLoc(l)} className="flex-1 py-2 rounded-xl text-sm font-bold border" style={{ borderColor:loc===l?'#dc2626':'#e5e7eb',color:loc===l?'#dc2626':'#6b7280' }}>{l}</button>)}</div>
    <input type="number" value={qty} onChange={e=>setQty(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm bg-white" placeholder={`Jumlah dibuang (${ing?.unit||'unit'})`}/>
    <input value={reason} onChange={e=>setReason(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm bg-white" placeholder="Alasan (opsional)"/>
    <button onClick={submit} disabled={busy||!id||!qty} className="w-full py-3 rounded-xl font-bold text-white" style={{ background:'#dc2626' }}>{busy?'Proses...':'Catat Waste'}</button>
  </div>;
}

function StokOpname({ ingredients }: any) {
  const [entries,setEntries]=useState([{ingredientId:'',location:'BAR',actualQty:''}]);
  const [busy,setBusy]=useState(false);
  const upd=(i:number,k:string,v:string)=>setEntries(p=>p.map((e,j)=>j===i?{...e,[k]:v}:e));
  function onQR(data:any){ if(data.ingredientId){setEntries(p=>{const last=p[p.length-1];if(!last.ingredientId)return p.map((e,i)=>i===p.length-1?{...e,ingredientId:data.ingredientId}:e);return [...p,{ingredientId:data.ingredientId,location:'BAR',actualQty:''}];});} }
  async function submit(){const valid=entries.filter(e=>e.ingredientId&&e.actualQty);if(!valid.length)return;setBusy(true);try{await api.post('/api/stock/opname',{entries:valid.map(e=>({...e,actualQty:parseFloat(e.actualQty)})),apply:false});alert('Opname dicatat');}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  return <div className="space-y-3">
    <div className="flex justify-between items-center"><span className="text-xs font-bold text-gray-500">Bahan ({entries.length})</span><QRBtn onScan={onQR}/></div>
    {entries.map((e,i)=>(<div key={i} className="rounded-xl bg-white p-3 space-y-2">
      <select value={e.ingredientId} onChange={ev=>upd(i,'ingredientId',ev.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="">Pilih bahan</option>{ingredients.map((ing:any)=><option key={ing.id} value={ing.id}>{ing.name}</option>)}</select>
      <div className="flex gap-1.5">{['GUDANG','BAR','KITCHEN'].map(l=><button key={l} onClick={()=>upd(i,'location',l)} className="flex-1 py-1.5 rounded-lg text-xs font-bold border" style={{ borderColor:e.location===l?GREEN:'#e5e7eb',color:e.location===l?GREEN:'#9ca3af' }}>{l}</button>)}</div>
      <input type="number" value={e.actualQty} onChange={ev=>upd(i,'actualQty',ev.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Qty aktual"/>
    </div>))}
    <button onClick={()=>setEntries(p=>[...p,{ingredientId:'',location:'BAR',actualQty:''}])} className="w-full py-2.5 rounded-xl text-sm font-bold border border-gray-200 bg-white text-gray-600">+ Tambah Bahan</button>
    <button onClick={submit} disabled={busy} className="w-full py-3 rounded-xl font-bold text-white" style={{ background:GREEN }}>{busy?'Menyimpan...':'Simpan Opname'}</button>
  </div>;
}

function StokReceive() {
  const [pos,setPOs]=useState<any[]>([]);const [busy,setBusy]=useState(false);
  useEffect(()=>{ api.get<any>('/api/purchase-orders?status=DRAFT').then(r=>setPOs(r.orders||r||[])).catch(()=>{}); },[]);
  async function receive(id:string){setBusy(true);try{await api.patch('/api/purchase-orders',{id,action:'complete'});alert('PO diterima');setPOs(p=>p.filter(x=>x.id!==id));}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  return <div className="space-y-3">
    {pos.length===0?<div className="rounded-xl bg-white p-6 text-center text-gray-400 text-sm">Tidak ada PO pending</div>
    :pos.map(po=>(<div key={po.id} className="rounded-xl bg-white p-4">
      <div className="flex justify-between mb-3"><div><p className="font-bold text-sm text-gray-900">{po.poNumber}</p><p className="text-xs text-gray-400">{po.supplier?.name}</p></div><p className="font-bold text-sm" style={{ color:GREEN }}>{formatCurrency(po.totalAmount)}</p></div>
      <button onClick={()=>receive(po.id)} disabled={busy} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background:GREEN }}>Terima & Update Stok</button>
    </div>))}
  </div>;
}

// ── TRANSAKSI ─────────────────────────────────────────────────────────────────
function TransaksiSection() {
  const [orders,setOrders]=useState<any[]>([]);const [loading,setLoading]=useState(true);const [selected,setSelected]=useState<any>(null);
  useEffect(()=>{ api.get<any>('/api/orders?limit=30&status=COMPLETED').then(r=>setOrders(r.orders||r||[])).finally(()=>setLoading(false)); },[]);
  const fmt=(d:string)=>new Date(d).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
  const fmtD=(d:string)=>new Date(d).toLocaleDateString('id-ID',{day:'numeric',month:'short'});
  if(loading) return <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor:GREEN,borderTopColor:'transparent' }}/></div>;
  return <div className="space-y-2">
    {orders.map(o=>(
      <button key={o.id} onClick={()=>setSelected(selected?.id===o.id?null:o)} className="w-full text-left rounded-xl bg-white p-3.5 transition-all" style={{ border: selected?.id===o.id?`2px solid ${GREEN}`:'2px solid transparent' }}>
        <div className="flex justify-between items-center">
          <div><p className="font-bold text-sm text-gray-900">#{o.orderNumber}</p><p className="text-xs text-gray-400">{fmtD(o.createdAt)} {fmt(o.createdAt)}{o.billName?` · ${o.billName}`:''}</p></div>
          <p className="font-black text-sm" style={{ color:GREEN }}>{formatCurrency(o.total)}</p>
        </div>
        {selected?.id===o.id && <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
          {(o.items||[]).map((item:any,idx:number)=>(<div key={idx} className="flex justify-between text-xs text-gray-500"><span>{item.quantity}× {item.product?.name||item.name}</span><span>{formatCurrency(item.subtotal)}</span></div>))}
        </div>}
      </button>
    ))}
  </div>;
}

// ── PENGELUARAN ───────────────────────────────────────────────────────────────
function PengeluaranSection({ onDone }: any) {
  const [cat,setCat]=useState('OPERATIONAL');const [desc,setDesc]=useState('');const [amount,setAmount]=useState('');const [busy,setBusy]=useState(false);
  async function submit(){if(!desc||!amount)return;setBusy(true);try{await api.post('/api/expenses',{category:cat,description:desc,amount:parseFloat(amount)});alert('Dicatat');setDesc('');setAmount('');onDone();}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  return <div className="space-y-3">
    <div className="rounded-2xl bg-white p-4 space-y-3">
      <p className="font-bold text-sm" style={{ color:GREEN }}>Catat Pengeluaran</p>
      <select value={cat} onChange={e=>setCat(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm">
        {['OPERATIONAL','PURCHASE','UTILITIES','SALARY','OTHER'].map(c=><option key={c} value={c}>{c}</option>)}
      </select>
      <input value={desc} onChange={e=>setDesc(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm" placeholder="Keterangan"/>
      <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm" placeholder="Nominal (Rp)"/>
      <button onClick={submit} disabled={busy||!desc||!amount} className="w-full py-3 rounded-xl font-bold text-white" style={{ background:GREEN }}>{busy?'Menyimpan...':'Catat'}</button>
    </div>
  </div>;
}

// ── REQUEST ───────────────────────────────────────────────────────────────────
function RequestSection({ onDone }: any) {
  const [ingredients,setIngredients]=useState<any[]>([]);
  const [items,setItems]=useState([{ingredientId:'',quantity:'',unit:''}]);
  const [notes,setNotes]=useState('');const [busy,setBusy]=useState(false);
  const [myRequests,setMyRequests]=useState<any[]>([]);
  useEffect(()=>{
    api.get<any[]>('/api/ingredients?active=1').then(r=>setIngredients(Array.isArray(r)?r:[]));
    api.get<any[]>('/api/purchase-requests?status=PENDING').then(r=>setMyRequests(Array.isArray(r)?r:[])).catch(()=>{});
  },[]);
  const raw = ingredients.filter((i:any)=>i.type==='RAW');
  const updItem=(i:number,k:string,v:string)=>setItems(p=>p.map((e,j)=>j===i?{...e,[k]:v}:e));
  function onIngChange(idx:number,id:string){const ing=raw.find((i:any)=>i.id===id);setItems(p=>p.map((e,j)=>j===idx?{...e,ingredientId:id,unit:ing?.purchaseUnit||ing?.unit||''}:e));}
  async function submit(){const valid=items.filter(i=>i.ingredientId&&i.quantity);if(!valid.length)return;setBusy(true);try{await api.post('/api/purchase-requests',{items:valid.map(i=>({ingredientId:i.ingredientId,quantity:parseFloat(i.quantity),unit:i.unit})),notes});alert('Request terkirim');setItems([{ingredientId:'',quantity:'',unit:''}]);setNotes('');onDone();}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  return <div className="space-y-4">
    <div className="rounded-2xl bg-white p-4 space-y-3">
      <p className="font-bold text-sm" style={{ color:GREEN }}>Request Bahan ke Manager</p>
      {items.map((item,i)=>{
        const ing=raw.find((x:any)=>x.id===item.ingredientId);
        return <div key={i} className="rounded-xl border border-gray-100 p-3 space-y-2">
          <select value={item.ingredientId} onChange={e=>onIngChange(i,e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="">Pilih bahan</option>{raw.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <div className="flex gap-2">
            <input type="number" value={item.quantity} onChange={e=>updItem(i,'quantity',e.target.value)} className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Qty"/>
            <div className="rounded-lg border border-gray-100 px-3 py-2 text-sm text-gray-400 bg-gray-50 min-w-16 flex items-center">{ing?.purchaseUnit||ing?.unit||'unit'}</div>
          </div>
        </div>;
      })}
      <button onClick={()=>setItems(p=>[...p,{ingredientId:'',quantity:'',unit:''}])} className="w-full py-2 rounded-xl text-sm font-bold border border-gray-200 text-gray-600">+ Tambah Bahan</button>
      <textarea value={notes} onChange={e=>setNotes(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm" rows={2} placeholder="Catatan untuk manager (opsional)"/>
      <button onClick={submit} disabled={busy||!items.some(i=>i.ingredientId&&i.quantity)} className="w-full py-3 rounded-xl font-bold text-white" style={{ background:'#EA580C' }}>{busy?'Mengirim...':'📋 Kirim Request'}</button>
    </div>
    {myRequests.length>0 && <div className="rounded-2xl bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100"><p className="font-bold text-sm text-gray-700">Request Saya (Pending)</p></div>
      {myRequests.map((r:any)=>(<div key={r.id} className="px-4 py-3 border-b border-gray-100 last:border-0">
        <p className="text-xs text-gray-400 mb-1">{new Date(r.createdAt).toLocaleDateString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>
        {r.items?.map((item:any,i:number)=><p key={i} className="text-sm text-gray-700">{item.quantity} {item.unit} {item.ingredient?.name}</p>)}
        {r.notes && <p className="text-xs text-gray-400 mt-1 italic">{r.notes}</p>}
      </div>))}
    </div>}
  </div>;
}

// ── PRINTER ───────────────────────────────────────────────────────────────────
function PrinterSection() {
  const [connected,setConnected]=useState(false);const [name,setName]=useState('');
  useEffect(()=>{
    import('@/lib/bluetooth-printer').then(({getSavedPrinter,isConnected})=>{ const s=getSavedPrinter();if(s)setName(String(s));setConnected(isConnected()); });
  },[]);
  async function pair(){const {pairAndConnect,isConnected,getSavedPrinter}=await import('@/lib/bluetooth-printer');try{await pairAndConnect();setConnected(isConnected());const s=getSavedPrinter();if(s)setName(String(s));}catch{alert('Gagal pair');}}
  async function testPrint(){const {printData}=await import('@/lib/bluetooth-printer');const E=0x1B,L=0x0A,G=0x1D;const enc=(s:string)=>Array.from(s).map(c=>c.charCodeAt(0));const d=new Uint8Array([E,0x40,...enc('TEST PRINT'),L,...enc('Soeka House'),L,L,L,G,0x56,0x42,0x10]);await printData(d).catch(e=>alert('Gagal: '+e.message));}
  return <div className="space-y-3">
    <div className="rounded-2xl bg-white p-6 text-center">
      <p className="text-5xl mb-3">{connected?'🖨️':'📵'}</p>
      <p className="font-bold text-gray-900">{connected?'Printer Terhubung':'Printer Tidak Terhubung'}</p>
      {name && <p className="text-xs text-gray-400 mt-1">{name}</p>}
    </div>
    <button onClick={pair} className="w-full py-3 rounded-2xl font-bold text-white" style={{ background:GREEN }}>🔗 {connected?'Ganti Printer':'Pair Printer'}</button>
    {connected && <button onClick={testPrint} className="w-full py-3 rounded-2xl font-bold border border-gray-200 text-gray-700 bg-white">🖨️ Test Print</button>}
  </div>;
}
