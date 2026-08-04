'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store';
import { api } from '@/lib/fetch';
import IngredientPicker from '@/components/ui/IngredientPicker';
import { formatCurrency } from '@/components/ui';
import BottomNav from '@/components/staff/BottomNav';

const G = '#48654D';

type Sheet = 'transfer'|'batch'|'waste'|'opname'|'receive'|'request'|'expense'|'printer'|'menu'|'leave'|null;

const TILES = [
  { id:'transfer' as Sheet, icon:'🔀', label:'Transfer', desc:'Pindah bahan', color:'#7C3AED' },
  { id:'batch'    as Sheet, icon:'🍳', label:'Bikin Batch', desc:'Produksi olahan', color:'#0891B2' },
  { id:'waste'    as Sheet, icon:'🗑', label:'Waste', desc:'Catat buang', color:'#DC2626' },
  { id:'opname'   as Sheet, icon:'📋', label:'Opname', desc:'Hitung stok', color:'#0369A1' },
  { id:'receive'  as Sheet, icon:'📦', label:'Terima PO', desc:'Barang masuk', color:'#D97706' },
  { id:'request'  as Sheet, icon:'📩', label:'Request', desc:'Minta ke manager', color:'#EA580C' },
  { id:'expense'  as Sheet, icon:'💸', label:'Pengeluaran', desc:'Catat belanja', color:'#B45309' },
  { id:'menu'     as Sheet, icon:'📖', label:'Menu', desc:'Lihat resep', color:'#059669' },
  { id:'leave'    as Sheet, icon:'🏖️', label:'Izin/Cuti', desc:'Ajukan izin', color:'#6366F1' },
  { id:'printer'  as Sheet, icon:'🖨️', label:'Printer', desc:'Setup BT', color:'#374151' },
];

export default function StaffHub() {
  const { user, hydrate } = useAuthStore();
  const [sheet, setSheet]         = useState<Sheet>(null);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loadingIngs, setLoadingIngs] = useState(true);

  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => {
    if (!user) return;
    api.get<any[]>('/api/ingredients?active=1')
      .then(r => setIngredients(Array.isArray(r) ? r : []))
      .finally(() => setLoadingIngs(false));
  }, [user]);

  const stockAt = (id: string, loc: string) =>
    ingredients.find(i => i.id === id)?.stockLevels?.find((s: any) => s.location === loc)?.quantity ?? 0;

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F7F3EE' }}>
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor:G, borderTopColor:'transparent' }}/>
    </div>
  );

  return (
    <div className="min-h-screen pb-24" style={{ background:'#F7F3EE', fontFamily:"'Inter', system-ui, sans-serif" }}>

      {/* Header */}
      <div className="px-5 pt-12 pb-5" style={{ background: G }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-green-200 text-xs font-bold tracking-widest uppercase mb-1">Fitur Kerja</p>
            <h1 className="text-white font-black text-2xl">Staff Hub</h1>
          </div>
          {['OWNER','MANAGER','SUPER_ADMIN'].includes(user.role) && (
            <a href="/dashboard"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold mt-1"
              style={{ background:'rgba(255,255,255,0.15)', color:'white' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
              Dashboard
            </a>
          )}
        </div>
      </div>

      {/* Cek Stok quick card */}
      <StokQuickCard ingredients={ingredients} stockAt={stockAt}/>

      {/* Tile grid */}
      <div className="px-4 mt-4">
        <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color:'#A0A0A0' }}>Aksi</p>
        <div className="grid grid-cols-3 gap-3">
          {TILES.map(tile => (
            <button key={tile.id} onClick={() => setSheet(tile.id)}
              className="flex flex-col items-center justify-center rounded-2xl bg-white py-5 gap-2 active:scale-95 transition-all"
              style={{ boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
              <span className="text-2xl">{tile.icon}</span>
              <span className="text-xs font-black" style={{ color:'#1a1a1a' }}>{tile.label}</span>
              <span className="text-xs" style={{ color:'#B0B0B0' }}>{tile.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Sheet */}
      {sheet && (
        <BottomSheet title={TILES.find(t=>t.id===sheet)?.label || ''} onClose={() => setSheet(null)}>
          {sheet==='transfer'  && <TransferForm  ingredients={ingredients} stockAt={stockAt} onDone={() => setSheet(null)}/>}
          {sheet==='batch'     && <BatchForm     prepped={ingredients.filter(i=>i.type==='PREPPED')} onDone={() => setSheet(null)}/>}
          {sheet==='waste'     && <WasteForm     ingredients={ingredients} stockAt={stockAt} onDone={() => setSheet(null)}/>}
          {sheet==='opname'    && <OpnameForm    ingredients={ingredients} onDone={() => setSheet(null)}/>}
          {sheet==='receive'   && <ReceiveForm   onDone={() => setSheet(null)}/>}
          {sheet==='request'   && <RequestForm   ingredients={ingredients.filter(i=>i.type==='RAW')} onDone={() => setSheet(null)}/>}
          {sheet==='expense'   && <ExpenseForm   onDone={() => setSheet(null)}/>}
          {sheet==='menu'      && <MenuView      ingredients={ingredients}/>}
          {sheet==='printer'   && <PrinterForm/>}
          {sheet==='leave'     && <LeaveForm onDone={() => setSheet(null)}/>}
        </BottomSheet>
      )}

      <BottomNav hasPosAccess={['OWNER','MANAGER','SUPER_ADMIN'].includes(user.role)}/>
    </div>
  );
}

// ── Bottom Sheet ──────────────────────────────────────────────────────────────
function BottomSheet({ title, onClose, children }: { title:string; onClose:()=>void; children:React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40" style={{ background:'rgba(0,0,0,0.4)' }}/>
      <div className="fixed left-0 right-0 z-50 rounded-t-3xl overflow-hidden"
        style={{
          background:'white',
          bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
          maxHeight: 'calc(85vh - 64px - env(safe-area-inset-bottom, 0px))',
          display:'flex',
          flexDirection:'column',
        }}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background:'#E0E0E0' }}/>
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0" style={{ borderColor:'#F0EDE8' }}>
          <p className="font-black text-base" style={{ color:'#1a1a1a' }}>{title}</p>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background:'#F5F5F5', color:'#888' }}>✕</button>
        </div>
        {/* Content — padding bottom extra untuk safe area */}
        <div className="flex-1 overflow-y-auto px-5 py-4"
          style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}>
          {children}
        </div>
      </div>
    </>
  );
}

// ── QR Hook ───────────────────────────────────────────────────────────────────
function useQR(onScan: (d:any) => void) {
  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState('');
  const activeRef = useRef(false);
  const streamRef = useRef<MediaStream|null>(null);
  const rafRef    = useRef<number>(0);

  async function start() {
    setCamError('');
    setScanning(true);
    activeRef.current = true;
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = s;
      // Attach to visible video element
      const v = document.getElementById('qr-video') as HTMLVideoElement;
      if (v) { v.srcObject = s; v.playsInline = true; v.muted = true; await v.play().catch(()=>{}); loop(v); }
      else {
        // fallback headless
        const vEl = document.createElement('video');
        vEl.srcObject = s; vEl.playsInline = true; vEl.muted = true; await vEl.play().catch(()=>{});
        loop(vEl);
      }
    } catch(e: any) {
      setCamError('Izinkan akses kamera di pengaturan browser/HP');
      setScanning(false); activeRef.current = false;
    }
  }

  function stop() {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
    setCamError('');
  }

  async function loop(v: HTMLVideoElement) {
    if (!activeRef.current) return;
    if (v.readyState < 2) { rafRef.current = requestAnimationFrame(() => loop(v)); return; }
    const w = v.videoWidth || 640, h = v.videoHeight || 480;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(v, 0, 0, w, h);
    let found = false;
    // Try BarcodeDetector (Chrome Android)
    const BD = (window as any).BarcodeDetector;
    if (BD) {
      try {
        const r = await new BD({ formats: ['qr_code'] }).detect(c);
        if (r.length) { found = true; handleRaw(r[0].rawValue); }
      } catch {}
    }
    // Fallback jsQR (Safari iOS, Firefox)
    if (!found) {
      try {
        const jsQR = (await import('jsqr')).default;
        const img = ctx.getImageData(0, 0, w, h);
        const res = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
        if (res) { found = true; handleRaw(res.data); }
      } catch {}
    }
    if (!found && activeRef.current) rafRef.current = requestAnimationFrame(() => loop(v));
  }

  function handleRaw(raw: string) {
    try { onScan(JSON.parse(raw)); stop(); return; } catch {}
    const match = raw.match(/\/scan\/([a-z0-9]+)$/i);
    if (match) { onScan({ ingredientId: match[1] }); stop(); return; }
    onScan({ ingredientId: raw }); stop();
  }

  return { scanning, camError, start, stop };
}

function QRBtn({ onScan }: { onScan:(d:any)=>void }) {
  const { scanning, camError, start, stop } = useQR(onScan);
  return (
    <div>
      <button onClick={scanning ? stop : start}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
        style={{ background:scanning?'#FEF2F2':'#E8F5E9', color:scanning?'#DC2626':G, border:`1px solid ${scanning?'#DC2626':G}` }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>
          <rect x="7" y="7" width="4" height="4" rx="1"/><rect x="13" y="7" width="4" height="4" rx="1"/><rect x="7" y="13" width="4" height="4" rx="1"/>
        </svg>
        {scanning ? 'Stop Kamera' : 'Scan QR'}
      </button>
      {camError && (
        <p className="text-xs mt-1.5 text-red-500">{camError}</p>
      )}
      {scanning && !camError && (
        <div className="mt-2 rounded-xl overflow-hidden relative" style={{ background:'#000', aspectRatio:'4/3' }}>
          <video id="qr-video" autoPlay playsInline muted
            style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
          {/* Scan overlay */}
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
            <div style={{ width:160, height:160, border:`2px solid ${G}`, borderRadius:12, boxShadow:`0 0 0 2000px rgba(0,0,0,0.35)` }}/>
          </div>
          <p style={{ position:'absolute', bottom:8, left:0, right:0, textAlign:'center', color:'white', fontSize:11, fontWeight:600, textShadow:'0 1px 2px rgba(0,0,0,0.8)' }}>
            Arahkan QR ke dalam kotak
          </p>
        </div>
      )}
    </div>
  );
}

// ── Stok Quick Card ───────────────────────────────────────────────────────────
function StokQuickCard({ ingredients, stockAt }: any) {
  const [search, setSearch] = useState('');
  const [open, setOpen]     = useState(false);
  const filtered = ingredients.filter((i:any) => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="mx-4 mt-4 rounded-2xl bg-white overflow-hidden" style={{ boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
      <button onClick={()=>setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">📊</span>
          <span className="font-black text-sm" style={{ color:'#1a1a1a' }}>Cek Stok</span>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C0C0C0" strokeWidth="2"
          style={{ transform:open?'rotate(180deg)':'none', transition:'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="border-t px-4 py-3 space-y-3" style={{ borderColor:'#F0EDE8' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm" style={{ borderColor:'#E8E2D9', outline:'none' }}
            placeholder="Cari bahan..."/>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filtered.slice(0,20).map((i:any) => (
              <div key={i.id} className="rounded-xl px-3 py-2.5" style={{ background:'#F7F5F2' }}>
                <p className="text-sm font-semibold mb-1" style={{ color:'#1a1a1a' }}>{i.name}</p>
                <div className="flex gap-4">
                  {['GUDANG','BAR','KITCHEN'].map(l => (
                    <p key={l} className="text-xs" style={{ color:'#A0A0A0' }}>
                      {l} <span className="font-bold" style={{ color:'#1a1a1a' }}>{stockAt(i.id,l)}</span> {i.unit}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Forms ─────────────────────────────────────────────────────────────────────
const Field = ({ label, children }: { label:string; children:React.ReactNode }) => (
  <div><p className="text-xs font-bold mb-1.5" style={{ color:'#888' }}>{label}</p>{children}</div>
);
const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className="w-full rounded-xl border px-4 py-3 text-sm" style={{ borderColor:'#E8E2D9', outline:'none', background:'#FAFAF8' }}/>
);
const Select = ({ value, onChange, children }: any) => (
  <select value={value} onChange={onChange} className="w-full rounded-xl border px-4 py-3 text-sm" style={{ borderColor:'#E8E2D9', outline:'none', background:'#FAFAF8' }}>
    {children}
  </select>
);
const LocPicker = ({ value, set }: { value:string; set:(v:string)=>void }) => (
  <div className="flex gap-2">
    {['GUDANG','BAR','KITCHEN'].map(l => (
      <button key={l} onClick={()=>set(l)} className="flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all"
        style={{ borderColor:value===l?G:'#E8E2D9', color:value===l?G:'#A0A0A0', background:value===l?G+'12':'#FAFAF8' }}>
        {l}
      </button>
    ))}
  </div>
);
const SubmitBtn = ({ busy, label, onClick, disabled, color=G }: any) => (
  <button onClick={onClick} disabled={busy||disabled}
    className="w-full py-3.5 rounded-xl font-black text-white text-sm disabled:opacity-50 transition-all"
    style={{ background:color, boxShadow:`0 4px 14px ${color}40` }}>
    {busy ? 'Memproses...' : label}
  </button>
);

function TransferForm({ ingredients, stockAt, onDone }: any) {
  const raw = ingredients; // semua bahan bisa ditransfer
  const [id,setId]=useState('');const [qty,setQty]=useState('');const [from,setFrom]=useState('GUDANG');const [to,setTo]=useState('BAR');const [busy,setBusy]=useState(false);
  const ing = raw.find((i:any)=>i.id===id);
  function onQR(d:any){ if(d.ingredientId){setId(d.ingredientId);if(d.qty)setQty(String(d.qty));} }
  async function submit(){if(!id||!qty)return;setBusy(true);try{await api.post('/api/stock/transfer',{ingredientId:id,fromLocation:from,toLocation:to,quantity:parseFloat(qty)});onDone();}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  return <div className="space-y-4">
    <Field label="BAHAN"><div className="flex gap-2"><div className="flex-1"><IngredientPicker ingredients={raw} value={id} onChange={setId}/></div><QRBtn onScan={onQR}/></div>{ing&&<p className="text-xs mt-1.5" style={{ color:'#A0A0A0' }}>Stok {from}: <strong>{stockAt(id,from)}</strong> {ing.unit}</p>}</Field>
    <Field label="DARI"><LocPicker value={from} set={setFrom}/></Field>
    <Field label="KE"><LocPicker value={to} set={setTo}/></Field>
    <Field label={`JUMLAH (${ing?.unit||'unit'})`}><Input type="number" value={qty} onChange={e=>setQty(e.target.value)} placeholder="0"/></Field>
    <SubmitBtn busy={busy} label="Transfer Sekarang" onClick={submit} disabled={!id||!qty||from===to}/>
  </div>;
}

function BatchForm({ prepped, onDone }: any) {
  const [id,setId]=useState('');const [mult,setMult]=useState('1');const [loc,setLoc]=useState('BAR');const [actualYield,setActualYield]=useState('');const [busy,setBusy]=useState(false);
  const selected = prepped.find((i:any)=>i.id===id);
  const stdYield = selected ? ((selected.prepRecipe?.yieldQty || selected.conversionRate || 1) * parseFloat(mult||'1')) : 0;
  async function submit(){
    if(!id)return;
    setBusy(true);
    try{
      const res = await api.post<any>('/api/stock/batch',{
        ingredientId:id,
        multiplier:parseFloat(mult),
        location:loc,
        ...(actualYield ? { actualYield: parseFloat(actualYield) } : {}),
      });
      alert(res.message || 'Batch selesai');
      onDone();
    }catch(e:any){alert(e.message);}finally{setBusy(false);}
  }
  return <div className="space-y-4">
    <Field label="OLAHAN"><IngredientPicker ingredients={prepped} value={id} onChange={setId} placeholder='Pilih olahan...' showUnit={true}/></Field>
    <Field label="MULTIPLIER (1 = 1x resep)"><Input type="number" value={mult} onChange={e=>setMult(e.target.value)}/></Field>
    {selected && stdYield > 0 && (
      <div className="rounded-xl px-4 py-3 text-sm" style={{ background:'#F7F5F2' }}>
        <span style={{ color:'#A0A0A0' }}>Yield standar: </span>
        <strong style={{ color:G }}>{stdYield.toLocaleString('id-ID')} {selected.unit}</strong>
      </div>
    )}
    <Field label={`YIELD AKTUAL (${selected?.unit||'unit'}) — opsional`}>
      <Input type="number" value={actualYield} onChange={e=>setActualYield(e.target.value)}
        placeholder={stdYield > 0 ? `Default: ${stdYield.toLocaleString('id-ID')}` : 'Kosongkan = pakai standar resep'}/>
    </Field>
    <Field label="SIMPAN KE"><LocPicker value={loc} set={setLoc}/></Field>
    <SubmitBtn busy={busy} label="Buat Batch" onClick={submit} disabled={!id} color="#0891B2"/>
  </div>;
}

function WasteForm({ ingredients, stockAt, onDone }: any) {
  const [id,setId]=useState('');const [qty,setQty]=useState('');const [loc,setLoc]=useState('BAR');const [reason,setReason]=useState('');const [busy,setBusy]=useState(false);
  const ing = ingredients.find((i:any)=>i.id===id);
  function onQR(d:any){ if(d.ingredientId){setId(d.ingredientId);if(d.qty)setQty(String(d.qty));} }
  async function submit(){if(!id||!qty)return;setBusy(true);try{await api.post('/api/stock/waste',{ingredientId:id,quantity:parseFloat(qty),location:loc,reason});onDone();}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  return <div className="space-y-4">
    <Field label="BAHAN"><div className="flex gap-2"><div className="flex-1"><IngredientPicker ingredients={ingredients} value={id} onChange={setId}/></div><QRBtn onScan={onQR}/></div>{ing&&<p className="text-xs mt-1.5" style={{ color:'#A0A0A0' }}>Stok {loc}: <strong>{stockAt(id,loc)}</strong> {ing.unit}</p>}</Field>
    <Field label="LOKASI"><LocPicker value={loc} set={setLoc}/></Field>
    <Field label={`JUMLAH DIBUANG (${ing?.unit||'unit'})`}><Input type="number" value={qty} onChange={e=>setQty(e.target.value)} placeholder="0"/></Field>
    <Field label="ALASAN (OPSIONAL)"><Input value={reason} onChange={e=>setReason(e.target.value)} placeholder="misal: kadaluarsa, tumpah..."/></Field>
    <SubmitBtn busy={busy} label="Catat Waste" onClick={submit} disabled={!id||!qty} color="#DC2626"/>
  </div>;
}

function OpnameForm({ ingredients, onDone }: any) {
  const [entries,setEntries]=useState([{ingredientId:'',location:'BAR',actualQty:''}]);
  const [busy,setBusy]=useState(false);
  const upd=(i:number,k:string,v:string)=>setEntries(p=>p.map((e,j)=>j===i?{...e,[k]:v}:e));
  function onQR(d:any){ if(d.ingredientId){setEntries(p=>{const last=p[p.length-1];if(!last.ingredientId)return p.map((e,i)=>i===p.length-1?{...e,ingredientId:d.ingredientId}:e);return [...p,{ingredientId:d.ingredientId,location:'BAR',actualQty:''}];});} }
  async function submit(){const v=entries.filter(e=>e.ingredientId&&e.actualQty);if(!v.length)return;setBusy(true);try{await api.post('/api/stock/opname',{entries:v.map(e=>({...e,actualQty:parseFloat(e.actualQty)})),apply:false});onDone();}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  return <div className="space-y-4">
    <div className="flex items-center justify-between"><p className="text-xs font-bold" style={{ color:'#888' }}>BAHAN ({entries.length})</p><QRBtn onScan={onQR}/></div>
    {entries.map((e,i)=>(<div key={i} className="rounded-xl p-3 space-y-2.5" style={{ background:'#F7F5F2' }}>
      <IngredientPicker ingredients={ingredients} value={e.ingredientId} onChange={(v:string)=>upd(i,'ingredientId',v)}/>
      <LocPicker value={e.location} set={v=>upd(i,'location',v)}/>
      <Input type="number" value={e.actualQty} onChange={ev=>upd(i,'actualQty',ev.target.value)} placeholder="Qty aktual"/>
    </div>))}
    <button onClick={()=>setEntries(p=>[...p,{ingredientId:'',location:'BAR',actualQty:''}])} className="w-full py-2.5 rounded-xl text-sm font-bold border" style={{ borderColor:'#E8E2D9', color:'#888' }}>+ Tambah Bahan</button>
    <SubmitBtn busy={busy} label="Simpan Opname" onClick={submit} disabled={!entries.some(e=>e.ingredientId&&e.actualQty)} color="#0369A1"/>
  </div>;
}

function ReceiveForm({ onDone }: any) {
  const [pos,setPOs]=useState<any[]>([]);const [busy,setBusy]=useState(false);
  useEffect(()=>{ api.get<any>('/api/purchase-orders?status=DRAFT').then(r=>setPOs(r.orders||r||[])).catch(()=>{}); },[]);
  async function receive(id:string){setBusy(true);try{await api.patch('/api/purchase-orders',{id,action:'complete'});setPOs(p=>p.filter(x=>x.id!==id));}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  if(pos.length===0) return <div className="text-center py-10"><p className="text-4xl mb-3">✓</p><p className="font-bold" style={{ color:'#1a1a1a' }}>Tidak ada PO pending</p></div>;
  return <div className="space-y-3">
    {pos.map(po=>(<div key={po.id} className="rounded-xl p-4" style={{ background:'#F7F5F2' }}>
      <div className="flex justify-between items-start mb-3">
        <div><p className="font-black text-sm" style={{ color:'#1a1a1a' }}>{po.poNumber}</p><p className="text-xs" style={{ color:'#A0A0A0' }}>{po.supplier?.name}</p></div>
        <p className="font-black text-sm" style={{ color:G }}>{formatCurrency(po.totalAmount)}</p>
      </div>
      <SubmitBtn busy={busy} label="Terima & Update Stok" onClick={()=>receive(po.id)} disabled={false}/>
    </div>))}
  </div>;
}

function RequestForm({ ingredients, onDone }: any) {
  const [items,setItems]=useState([{ingredientId:'',quantity:'',unit:''}]);
  const [notes,setNotes]=useState('');const [busy,setBusy]=useState(false);
  const upd=(i:number,k:string,v:string)=>setItems(p=>p.map((e,j)=>j===i?{...e,[k]:v}:e));
  function pick(idx:number,id:string){const ing=ingredients.find((i:any)=>i.id===id);setItems(p=>p.map((e,j)=>j===idx?{...e,ingredientId:id,unit:ing?.purchaseUnit||ing?.unit||''}:e));}
  async function submit(){const v=items.filter(i=>i.ingredientId&&i.quantity);if(!v.length)return;setBusy(true);try{await api.post('/api/purchase-requests',{items:v.map(i=>({ingredientId:i.ingredientId,quantity:parseFloat(i.quantity),unit:i.unit})),notes});onDone();}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  return <div className="space-y-4">
    <p className="text-sm" style={{ color:'#888' }}>Manager akan terima notifikasi dan buat PO dari request ini.</p>
    {items.map((item,i)=>{const ing=ingredients.find((x:any)=>x.id===item.ingredientId);return(
      <div key={i} className="rounded-xl p-3.5 space-y-2.5" style={{ background:'#F7F5F2' }}>
        <IngredientPicker ingredients={ingredients} value={item.ingredientId} onChange={(v:string)=>pick(i,v)}/>
        <div className="flex gap-2"><div className="flex-1"><Input type="number" value={item.quantity} onChange={e=>upd(i,'quantity',e.target.value)} placeholder="Qty"/></div><div className="rounded-xl px-3 flex items-center text-sm" style={{ background:'white', border:'1px solid #E8E2D9', color:'#A0A0A0', minWidth:60 }}>{ing?.purchaseUnit||ing?.unit||'unit'}</div></div>
      </div>);
    })}
    <button onClick={()=>setItems(p=>[...p,{ingredientId:'',quantity:'',unit:''}])} className="w-full py-2.5 rounded-xl text-sm font-bold border" style={{ borderColor:'#E8E2D9', color:'#888' }}>+ Tambah Bahan</button>
    <Field label="CATATAN"><Input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Untuk manager (opsional)"/></Field>
    <SubmitBtn busy={busy} label="Kirim Request" onClick={submit} disabled={!items.some(i=>i.ingredientId&&i.quantity)} color="#EA580C"/>
  </div>;
}

function ExpenseForm({ onDone }: any) {
  const [cat,setCat]=useState('OPERATIONAL');const [desc,setDesc]=useState('');const [amount,setAmount]=useState('');const [busy,setBusy]=useState(false);
  async function submit(){if(!desc||!amount)return;setBusy(true);try{await api.post('/api/expenses',{category:cat,description:desc,amount:parseFloat(amount)});onDone();}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  return <div className="space-y-4">
    <Field label="KATEGORI"><Select value={cat} onChange={(e:any)=>setCat(e.target.value)}>{['OPERATIONAL','PURCHASE','UTILITIES','SALARY','OTHER'].map(c=><option key={c} value={c}>{c}</option>)}</Select></Field>
    <Field label="KETERANGAN"><Input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Detail pengeluaran"/></Field>
    <Field label="NOMINAL (RP)"><Input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0"/></Field>
    <SubmitBtn busy={busy} label="Catat Pengeluaran" onClick={submit} disabled={!desc||!amount} color="#B45309"/>
  </div>;
}

function MenuView({ ingredients }: any) {
  const [products,setProducts]=useState<any[]>([]);const [search,setSearch]=useState('');const [selected,setSelected]=useState<any>(null);
  useEffect(()=>{ api.get<any>('/api/products?active=1&includeRecipe=1').then(r=>{const a=Array.isArray(r)?r:(r?.products||r?.data||[]);setProducts(a);}).catch(()=>{}); },[]);
  const filtered=products.filter((p:any)=>p.name.toLowerCase().includes(search.toLowerCase()));
  if(selected) return <div className="space-y-4">
    <button onClick={()=>setSelected(null)} className="flex items-center gap-2 text-sm font-bold" style={{ color:G }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>Kembali
    </button>
    <div className="rounded-2xl overflow-hidden" style={{ border:'1px solid #F0EDE8' }}>
      <div className="p-4" style={{ background:G+'10' }}>
        <p className="font-black text-base" style={{ color:'#1a1a1a' }}>{selected.name}</p>
        {selected.category?.name&&<p className="text-xs mt-0.5" style={{ color:'#A0A0A0' }}>{selected.category.name}</p>}
        <p className="font-black text-lg mt-1" style={{ color:G }}>{formatCurrency(selected.price)}</p>
      </div>
      {selected.recipe?.items?.length>0&&<div className="p-4 border-t" style={{ borderColor:'#F0EDE8' }}>
        <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color:'#A0A0A0' }}>Bahan</p>
        {selected.recipe.items.map((ri:any,i:number)=>(
          <div key={i} className="flex justify-between py-1.5 border-b last:border-0" style={{ borderColor:'#F7F5F2' }}>
            <span className="text-sm" style={{ color:'#1a1a1a' }}>{ri.ingredient?.name}</span>
            <span className="text-sm font-bold" style={{ color:'#666' }}>{ri.quantity} {ri.ingredient?.unit}</span>
          </div>
        ))}
      </div>}
      <div className="p-4 border-t" style={{ borderColor:'#F0EDE8' }}>
        <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color:'#A0A0A0' }}>Cara Pembuatan</p>
        {selected.recipe?.instructions ? (
          String(selected.recipe.instructions).split('\n').filter((s:string)=>s.trim()).map((step:string,i:number)=>(
            <div key={i} className="flex gap-3 mb-3">
              <span className="font-black text-xl w-5 flex-shrink-0" style={{ color:'#E8E2D9' }}>{i+1}</span>
              <p className="text-sm leading-relaxed" style={{ color:'#444' }}>{step}</p>
            </div>
          ))
        ) : (
          <p className="text-sm" style={{ color:'#C0C0C0' }}>Cara pembuatan belum diisi</p>
        )}
      </div>
    </div>
  </div>;
  return <div className="space-y-3">
    <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari menu..."/>
    {filtered.map((p:any)=>(
      <button key={p.id} onClick={()=>setSelected(p)} className="w-full flex items-center justify-between rounded-xl px-4 py-3.5 text-left" style={{ background:'#F7F5F2' }}>
        <div><p className="font-bold text-sm" style={{ color:'#1a1a1a' }}>{p.name}</p><p className="text-xs" style={{ color:'#A0A0A0' }}>{p.category?.name}</p></div>
        <div className="flex items-center gap-2"><p className="font-black text-sm" style={{ color:G }}>{formatCurrency(p.price)}</p><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C0C0C0" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg></div>
      </button>
    ))}
  </div>;
}

function PrinterForm() {
  const [connected,setConnected]=useState(false);const [name,setName]=useState('');
  useEffect(()=>{ import('@/lib/bluetooth-printer').then(({getSavedPrinter,isConnected})=>{ const s=getSavedPrinter();if(s)setName(String(s));setConnected(isConnected()); }); },[]);
  async function pair(){const m=await import('@/lib/bluetooth-printer');try{await m.pairAndConnect();setConnected(m.isConnected());const s=m.getSavedPrinter();if(s)setName(String(s));}catch{alert('Gagal');}}
  async function test(){const m=await import('@/lib/bluetooth-printer');const E=0x1B,L=0x0A,Gs=0x1D;const enc=(s:string)=>Array.from(s).map(c=>c.charCodeAt(0));await m.printData(new Uint8Array([E,0x40,...enc('TEST PRINT'),L,...enc('Soeka House'),L,L,L,Gs,0x56,0x42,0x10])).catch(e=>alert('Gagal: '+e.message));}
  return <div className="space-y-4">
    <div className="rounded-2xl p-8 text-center" style={{ background:'#F7F5F2' }}>
      <p className="text-5xl mb-3">{connected?'🖨️':'📵'}</p>
      <p className="font-black text-base" style={{ color:'#1a1a1a' }}>{connected?'Printer Terhubung':'Belum Terhubung'}</p>
      {name&&<p className="text-xs mt-1" style={{ color:'#A0A0A0' }}>{name}</p>}
    </div>
    <SubmitBtn busy={false} label={`🔗 ${connected?'Ganti Printer':'Pair Printer'}`} onClick={pair} disabled={false}/>
    {connected&&<button onClick={test} className="w-full py-3.5 rounded-xl font-black text-sm border" style={{ borderColor:'#E8E2D9', color:'#666' }}>🖨️ Test Print</button>}
  </div>;
}

function LeaveForm({ onDone }: any) {
  const [type,setType]=useState('SICK');
  const [start,setStart]=useState('');
  const [end,setEnd]=useState('');
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [myLeaves,setMyLeaves]=useState<any[]>([]);

  useEffect(()=>{
    api.get<any[]>('/api/leaves').then(r=>setMyLeaves(Array.isArray(r)?r:[])).catch(()=>{});
  },[]);

  async function submit(){
    if(!start||!end||!reason)return;
    setBusy(true);
    try{
      await api.post('/api/leaves',{type,startDate:start,endDate:end,reason});
      alert('Pengajuan terkirim');
      setReason('');setStart('');setEnd('');
      onDone();
    }catch(e:any){alert(e.message);}
    finally{setBusy(false);}
  }

  const STATUS_COLOR: Record<string,string> = { PENDING:'#F59E0B', APPROVED:'#16A34A', REJECTED:'#DC2626' };
  const TYPE_LABEL: Record<string,string> = { SICK:'Sakit', PERMISSION:'Izin', ANNUAL:'Cuti Tahunan', OTHER:'Lainnya' };

  return <div className="space-y-4">
    <Field label="JENIS">
      <Select value={type} onChange={(e:any)=>setType(e.target.value)}>
        <option value="SICK">🤒 Sakit</option>
        <option value="PERMISSION">✋ Izin</option>
        <option value="ANNUAL">🏖️ Cuti Tahunan</option>
        <option value="OTHER">📝 Lainnya</option>
      </Select>
    </Field>
    <div className="grid grid-cols-2 gap-3">
      <Field label="DARI"><Input type="date" value={start} onChange={e=>setStart(e.target.value)}/></Field>
      <Field label="SAMPAI"><Input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></Field>
    </div>
    <Field label="ALASAN"><Input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Keterangan..."/></Field>
    <SubmitBtn busy={busy} label="Kirim Pengajuan" onClick={submit} disabled={!start||!end||!reason} color="#6366F1"/>

    {myLeaves.length > 0 && <>
      <p className="text-xs font-bold tracking-widest uppercase pt-2" style={{ color:'#A0A0A0' }}>Pengajuan Saya</p>
      {myLeaves.slice(0,5).map((l:any)=>(
        <div key={l.id} className="rounded-xl p-3 flex justify-between items-start" style={{ background:'#F7F5F2' }}>
          <div>
            <p className="text-sm font-bold" style={{ color:'#1a1a1a' }}>{TYPE_LABEL[l.type]}</p>
            <p className="text-xs" style={{ color:'#A0A0A0' }}>{new Date(l.startDate).toLocaleDateString('id-ID')} – {new Date(l.endDate).toLocaleDateString('id-ID')}</p>
            <p className="text-xs" style={{ color:'#888' }}>{l.reason}</p>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full font-bold text-white" style={{ background:STATUS_COLOR[l.status] }}>{l.status}</span>
        </div>
      ))}
    </>}
  </div>;
}
