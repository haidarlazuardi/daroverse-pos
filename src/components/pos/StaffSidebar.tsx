'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/store';
import { api } from '@/lib/fetch';
import { formatCurrency } from '@/components/ui';
import { getSavedPrinter, isConnected, pairAndConnect, printData } from '@/lib/bluetooth-printer';
import { buildReceipt, buildKitchenTicket } from '@/lib/escpos';

type Mode = 'batch'|'take'|'check'|'waste'|'receive'|'opname'|'menu'|'expense'|'printer'|'history'|'request';
type Ingredient = { id:string;name:string;unit:string;type:string;stockLevels?:{location:string;quantity:number}[] };

const TILES: { mode:Mode;perm:string;color:string;label:string;icon:string }[] = [
  { mode:'history', perm:'view_menu',         color:'#0369A1', label:'Riwayat',       icon:'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { mode:'check',   perm:'view_stock',        color:'#059669', label:'Cek Stok',      icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { mode:'take',    perm:'take_stock',        color:'#7C3AED', label:'Ambil Bahan',   icon:'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
  { mode:'batch',   perm:'batch_production',  color:'#0891B2', label:'Bikin Batch',   icon:'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
  { mode:'waste',   perm:'waste_stock',       color:'#DC2626', label:'Waste',         icon:'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' },
  { mode:'receive', perm:'receive_stock',     color:'#D97706', label:'Terima PO',     icon:'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { mode:'opname',  perm:'stock_opname',      color:'#0369A1', label:'Opname',        icon:'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { mode:'expense', perm:'expense',           color:'#B45309', label:'Pengeluaran',   icon:'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6' },
  { mode:'menu',    perm:'view_menu',         color:'#555',    label:'Menu',          icon:'M4 6h16M4 12h16M4 18h7' },
  { mode:'printer', perm:'view_menu',         color:'#374151', label:'Printer',       icon:'M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z' },
];

export default function StaffSidebar() {
  const { user, hydrate } = useAuthStore();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [perms, setPerms] = useState<Record<string,boolean>>({});
  const [active, setActive] = useState<Mode|null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => {
    if (!user) return;
    api.get<Record<string,boolean>>('/api/auth/permissions').then(setPerms).catch(() => {});
  }, [user]);
  const load = useCallback(async () => {
    const r = await api.get<Ingredient[]>('/api/ingredients?active=1').catch(() => []);
    setIngredients(Array.isArray(r) ? r : []);
  }, []);
  useEffect(() => { if (user) load(); }, [user, load]);

  const can = (p: string) => {
    if (!user) return false;
    if (['SUPER_ADMIN','OWNER','MANAGER'].includes(user.role)) return true;
    return perms[p] !== false;
  };
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  const onDone = (msg: string) => { showToast(msg); setActive(null); load(); };
  const stockAt = (id: string, loc: string) =>
    ingredients.find(i => i.id === id)?.stockLevels?.find(s => s.location === loc)?.quantity ?? 0;

  const visible = TILES.filter(t => can(t.perm));
  const activeTile = visible.find(t => t.mode === active);
  const panelOpen = active !== null;

  return (
    <>
      {/* Icon Rail — always visible, collapsible */}
      <div className="flex flex-col h-screen border-r transition-all duration-200"
        style={{ background:'var(--surface-2, #f9fafb)', borderColor:'var(--border)', width: expanded ? 160 : 56, overflowY:'auto', overflowX:'hidden', flexShrink:0 }}>

        {/* Logo */}
        <div className="flex items-center justify-center border-b flex-shrink-0 px-2 py-3" style={{ borderColor:'var(--border)' }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center font-black text-white text-xs flex-shrink-0"
            style={{ background:'var(--brand)' }}>S</div>
          {expanded && <p className="text-xs font-black ml-2 flex-1 truncate" style={{ color:'var(--brand)' }}>Staff Hub</p>}
        </div>

        {/* Tiles */}
        <div className="flex flex-col gap-0.5 py-2 flex-1 px-1">
          {visible.map(t => (
            <button key={t.mode}
              onClick={() => setActive(active === t.mode ? null : t.mode)}
              title={!expanded ? t.label : undefined}
              className="rounded-xl flex items-center gap-2.5 transition-all relative"
              style={{
                padding: expanded ? '8px 10px' : '10px',
                justifyContent: expanded ? 'flex-start' : 'center',
                background: active === t.mode ? t.color + '15' : 'transparent',
                color: active === t.mode ? t.color : '#9CA3AF',
                minHeight: 36,
              }}>
              {/* Active bar */}
              {active === t.mode && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full" style={{ background: t.color }}/>
              )}
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
                <path d={t.icon}/>
              </svg>
              {expanded && <span className="text-xs font-semibold truncate">{t.label}</span>}
            </button>
          ))}

        </div>

        {/* Toast indicator */}
        {toast && (
          <div className="mx-1 mb-1 rounded-lg p-1.5 text-center flex-shrink-0" style={{ background:'#16a34a' }}>
            <span className="text-white text-xs">{expanded ? '✓ '+toast.slice(0,12) : '✓'}</span>
          </div>
        )}

        {/* Expand / Collapse toggle — center bottom, always visible */}
        <div className="flex justify-center border-t py-2 flex-shrink-0" style={{ borderColor:'var(--border)' }}>
          <button onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-all"
            style={{ background:'var(--brand)', color:'white', boxShadow:'0 2px 8px rgba(72,101,77,0.3)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              {expanded
                ? <polyline points="15 18 9 12 15 6"/>
                : <polyline points="9 18 15 12 9 6"/>}
            </svg>
            {expanded && <span>Tutup</span>}
          </button>
        </div>
      </div>

      {/* Expanded Panel — slides over content */}
      <div className="fixed top-0 left-14 h-full z-50 flex flex-col shadow-xl transition-all duration-250"
        style={{
          width: panelOpen ? 280 : 0,
          overflow: 'hidden',
          background: 'white',
          borderRight: panelOpen ? '1px solid var(--border)' : 'none',
        }}>
        {panelOpen && activeTile && (
          <div className="w-[280px] h-full flex flex-col">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b"
              style={{ borderColor:'var(--border)', background: activeTile.color + '10' }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: activeTile.color + '20', color: activeTile.color }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={activeTile.icon}/></svg>
                </div>
                <p className="font-black text-sm" style={{ color:'var(--text-1)' }}>{activeTile.label}</p>
              </div>
              <button onClick={() => setActive(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>

            {/* Toast */}
            {toast && (
              <div className="mx-3 mt-2 rounded-xl px-3 py-2 text-sm font-medium text-white flex-shrink-0"
                style={{ background:'#16a34a' }}>{toast}</div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {active==='batch'   && <BatchForm   prepped={ingredients.filter(i=>i.type==='PREPPED')} busy={busy} setBusy={setBusy} onDone={onDone}/>}
              {active==='take'    && <TakeForm    ingredients={ingredients} busy={busy} setBusy={setBusy} onDone={onDone} stockAt={stockAt}/>}
              {active==='check'   && <CheckStock  ingredients={ingredients} stockAt={stockAt}/>}
              {active==='waste'   && <WasteForm   ingredients={ingredients} busy={busy} setBusy={setBusy} onDone={onDone} stockAt={stockAt}/>}
              {active==='receive' && <ReceivePO   busy={busy} setBusy={setBusy} onDone={onDone}/>}
              {active==='opname'  && <Opname      canApply={can('apply_opname')} busy={busy} setBusy={setBusy} onDone={onDone}/>}
              {active==='menu'    && <MenuView/>}
              {active==='expense' && <ExpenseForm busy={busy} setBusy={setBusy} onDone={onDone}/>}
              {active==='printer' && <PrinterSetup/>}
              {active==='request' && <RequestForm ingredients={ingredients} busy={busy} setBusy={setBusy} onDone={onDone}/>}
        {active==='request' && <RequestForm ingredients={ingredients} onDone={onDone}/>}
              {active==='history' && <TxHistory/>}
            </div>
          </div>
        )}
      </div>

      {/* Overlay when panel open */}
      {panelOpen && (
        <div onClick={() => setActive(null)} className="fixed inset-0 z-40" style={{ background:'rgba(0,0,0,0.15)' }}/>
      )}
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
// ── QR Scan Hook ─────────────────────────────────────────────────────────────
function useQRScan(onScan: (data: any) => void) {
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement|null>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const activeRef = useRef(false);

  async function startScan() {
    setScanning(true);
    activeRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:'environment' } });
      streamRef.current = stream;
      // Create video element dynamically
      const video = document.createElement('video');
      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;
      await video.play();
      videoRef.current = video;
      scanLoop(video);
    } catch { stopScan(); }
  }

  async function scanLoop(video: HTMLVideoElement) {
    if (!activeRef.current) return;
    const BarcodeDetector = (window as any).BarcodeDetector;
    if (!BarcodeDetector) { stopScan(); alert('Browser tidak support scan QR'); return; }
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);
    try {
      const codes = await detector.detect(canvas);
      if (codes.length > 0) {
        try { const data = JSON.parse(codes[0].rawValue); onScan(data); stopScan(); return; }
        catch { /* invalid QR, continue */ }
      }
    } catch {}
    if (activeRef.current) requestAnimationFrame(() => scanLoop(video));
  }

  function stopScan() {
    activeRef.current = false;
    setScanning(false);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    videoRef.current = null;
  }

  return { scanning, startScan, stopScan };
}

// QR Scan button component
function QRScanBtn({ onScan, label='Scan QR' }: { onScan:(d:any)=>void; label?:string }) {
  const { scanning, startScan, stopScan } = useQRScan(onScan);
  return (
    <button type="button" onClick={scanning ? stopScan : startScan}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all"
      style={{ borderColor: scanning ? '#dc2626' : 'var(--brand)', color: scanning ? '#dc2626' : 'var(--brand)', background: scanning ? '#fef2f2' : '#e8f5e9' }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>
        <rect x="7" y="7" width="4" height="4" rx="1"/><rect x="13" y="7" width="4" height="4" rx="1"/>
        <rect x="7" y="13" width="4" height="4" rx="1"/>
      </svg>
      {scanning ? 'Stop Scan' : label}
    </button>
  );
}

const FW = ({children}:{children:React.ReactNode}) => <div className="p-3 space-y-2.5">{children}</div>;
function Picker<T extends {id:string;name:string}>({items,value,onChange,placeholder}:{items:T[];value:string;onChange:(v:string)=>void;placeholder:string}) {
  return <select value={value} onChange={e=>onChange(e.target.value)} className="input w-full text-sm"><option value="">{placeholder}</option>{items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select>;
}
const LP=({value,set,locs}:{value:string;set:(v:any)=>void;locs:string[]})=>(
  <div className="flex gap-1">{locs.map(l=><button key={l} onClick={()=>set(l)} className="flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all" style={{ borderColor:value===l?'var(--brand)':'#e5e7eb',color:value===l?'var(--brand)':'#6b7280',background:value===l?'#e8f5e9':'white' }}>{l}</button>)}</div>
);

function BatchForm({prepped,busy,setBusy,onDone}:any) {
  const [id,setId]=useState('');const [mult,setMult]=useState('1');const [loc,setLoc]=useState('BAR');
  async function submit(){if(!id||!mult)return;setBusy(true);try{await api.post('/api/stock/batch',{ingredientId:id,multiplier:parseFloat(mult),location:loc});onDone('Batch selesai');}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  return <FW><Picker items={prepped} value={id} onChange={setId} placeholder="Pilih olahan"/><input type="number" value={mult} onChange={e=>setMult(e.target.value)} className="input text-sm" placeholder="Multiplier"/><LP value={loc} set={setLoc} locs={['BAR','KITCHEN','GUDANG']}/><button onClick={submit} disabled={busy||!id} className="btn btn-primary btn-sm w-full">{busy?'Proses...':'Buat Batch'}</button></FW>;
}
function TakeForm({ingredients,busy,setBusy,onDone,stockAt}:any) {
  const [id,setId]=useState('');const [qty,setQty]=useState('');const [from,setFrom]=useState('GUDANG');const [to,setTo]=useState('BAR');
  const raw=ingredients.filter((i:any)=>i.type==='RAW');const ing=raw.find((i:any)=>i.id===id);
  function onQR(data:any){ if(data.ingredientId){setId(data.ingredientId);if(data.qty)setQty(String(data.qty));} }
  async function submit(){if(!id||!qty)return;setBusy(true);try{await api.post('/api/stock/transfer',{ingredientId:id,fromLocation:from,toLocation:to,quantity:parseFloat(qty)});onDone('Transfer selesai');}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  return <FW>
    <div className="flex items-center justify-between"><p className="text-xs font-bold text-gray-500">Bahan</p><QRScanBtn onScan={onQR} label="Scan Label"/></div>
    <Picker items={raw} value={id} onChange={setId} placeholder="Pilih bahan"/>
    {ing&&<p className="text-xs text-gray-400">Stok {from}: {stockAt(id,from)} {ing.unit}</p>}
    <div><p className="text-xs font-bold text-gray-500 mb-1">Dari</p><LP value={from} set={setFrom} locs={['GUDANG','BAR','KITCHEN']}/></div>
    <div><p className="text-xs font-bold text-gray-500 mb-1">Ke</p><LP value={to} set={setTo} locs={['GUDANG','BAR','KITCHEN']}/></div>
    <input type="number" value={qty} onChange={e=>setQty(e.target.value)} className="input text-sm" placeholder={`Jumlah (${ing?.unit||'unit'})`}/>
    <button onClick={submit} disabled={busy||!id||!qty||from===to} className="btn btn-primary btn-sm w-full">{busy?'Proses...':'Transfer'}</button>
  </FW>;
}
function CheckStock({ingredients,stockAt}:any) {
  const [search,setSearch]=useState('');
  const filtered=ingredients.filter((i:any)=>i.name.toLowerCase().includes(search.toLowerCase()));
  return <div className="p-3"><input value={search} onChange={e=>setSearch(e.target.value)} className="input text-sm mb-2" placeholder="Cari bahan..."/><div className="space-y-1.5">{filtered.map((i:any)=>(<div key={i.id} className="rounded-lg p-2.5 border border-gray-100 bg-gray-50"><p className="font-bold text-xs text-gray-900">{i.name}</p><div className="flex gap-2 mt-1">{['GUDANG','BAR','KITCHEN'].map(l=><p key={l} className="text-xs text-gray-400">{l}: <span className="font-bold text-gray-700">{stockAt(i.id,l)}</span></p>)}</div></div>))}</div></div>;
}
function WasteForm({ingredients,busy,setBusy,onDone,stockAt}:any) {
  const [id,setId]=useState('');const [qty,setQty]=useState('');const [loc,setLoc]=useState('BAR');const [reason,setReason]=useState('');
  const ing=ingredients.find((i:any)=>i.id===id);
  function onQR(data:any){ if(data.ingredientId){setId(data.ingredientId);if(data.qty)setQty(String(data.qty));if(data.purchaseUnit)setLoc(loc);} }
  async function submit(){if(!id||!qty)return;setBusy(true);try{await api.post('/api/stock/waste',{ingredientId:id,quantity:parseFloat(qty),location:loc,reason});onDone('Waste dicatat');}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  return <FW>
    <div className="flex items-center justify-between"><p className="text-xs font-bold text-gray-500">Bahan</p><QRScanBtn onScan={onQR} label="Scan Label"/></div>
    <Picker items={ingredients} value={id} onChange={setId} placeholder="Pilih bahan"/>
    {ing&&<p className="text-xs text-gray-400">Stok {loc}: {stockAt(id,loc)} {ing.unit}</p>}
    <LP value={loc} set={setLoc} locs={['BAR','KITCHEN','GUDANG']}/>
    <input type="number" value={qty} onChange={e=>setQty(e.target.value)} className="input text-sm" placeholder="Jumlah dibuang"/>
    <input value={reason} onChange={e=>setReason(e.target.value)} className="input text-sm" placeholder="Alasan (opsional)"/>
    <button onClick={submit} disabled={busy||!id||!qty} className="btn btn-sm w-full text-white" style={{ background:'#dc2626' }}>{busy?'Proses...':'Catat Waste'}</button>
  </FW>;
}
function ReceivePO({busy,setBusy,onDone}:any) {
  const [pos,setPOs]=useState<any[]>([]);
  useEffect(()=>{ api.get<any>('/api/purchase-orders?status=DRAFT').then(r=>setPOs(r.orders||r||[])).catch(()=>{}); },[]);
  async function receive(id:string){setBusy(true);try{await api.patch('/api/purchase-orders',{id,action:'complete'});onDone('PO diterima');}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  return <div className="p-3 space-y-2">{pos.length===0?<p className="text-center py-6 text-gray-400 text-sm">Tidak ada PO pending</p>:pos.map(po=>(<div key={po.id} className="rounded-lg border border-gray-100 p-3 bg-gray-50"><div className="flex justify-between mb-2"><div><p className="font-bold text-xs text-gray-900">{po.poNumber}</p><p className="text-xs text-gray-400">{po.supplier?.name}</p></div><p className="font-bold text-xs" style={{ color:'var(--brand)' }}>{formatCurrency(po.totalAmount)}</p></div><button onClick={()=>receive(po.id)} disabled={busy} className="btn btn-primary btn-sm w-full text-xs">Terima & Update Stok</button></div>))}</div>;
}
function Opname({canApply,busy,setBusy,onDone}:any) {
  const [entries,setEntries]=useState([{ingredientId:'',location:'BAR',actualQty:''}]);
  const [ings,setIngs]=useState<any[]>([]);
  useEffect(()=>{ api.get<any[]>('/api/ingredients?active=1').then(r=>setIngs(Array.isArray(r)?r:[])).catch(()=>{}); },[]);
  const upd=(i:number,k:string,v:string)=>setEntries(p=>p.map((e,j)=>j===i?{...e,[k]:v}:e));
  function onQR(data:any){
    if(data.ingredientId){
      // Add as new entry or fill last empty one
      setEntries(p=>{
        const last=p[p.length-1];
        if(!last.ingredientId){
          return p.map((e,i)=>i===p.length-1?{...e,ingredientId:data.ingredientId}:e);
        }
        return [...p,{ingredientId:data.ingredientId,location:'BAR',actualQty:''}];
      });
    }
  }
  async function submit(){const valid=entries.filter(e=>e.ingredientId&&e.actualQty);if(!valid.length)return;setBusy(true);try{await api.post('/api/stock/opname',{entries:valid.map(e=>({...e,actualQty:parseFloat(e.actualQty)})),apply:canApply});onDone(canApply?'Opname diterapkan':'Opname dicatat');}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  return <div className="p-3 space-y-2">
    <div className="flex justify-between items-center"><p className="text-xs font-bold text-gray-500">Bahan ({entries.length})</p><QRScanBtn onScan={onQR} label="Scan Tambah"/></div>
    {entries.map((e,i)=>(<div key={i} className="rounded-lg border border-gray-100 p-2.5 space-y-1.5">
      <select value={e.ingredientId} onChange={ev=>upd(i,'ingredientId',ev.target.value)} className="input w-full text-sm"><option value="">Pilih bahan</option>{ings.map((ing:any)=><option key={ing.id} value={ing.id}>{ing.name}</option>)}</select>
      <div className="flex gap-1">{['GUDANG','BAR','KITCHEN'].map(l=><button key={l} onClick={()=>upd(i,'location',l)} className="flex-1 py-1 rounded text-xs font-bold border" style={{ borderColor:e.location===l?'var(--brand)':'#e5e7eb',color:e.location===l?'var(--brand)':'#9ca3af' }}>{l}</button>)}</div>
      <input type="number" value={e.actualQty} onChange={ev=>upd(i,'actualQty',ev.target.value)} className="input text-sm" placeholder="Qty aktual"/>
    </div>))}
    <button onClick={()=>setEntries(p=>[...p,{ingredientId:'',location:'BAR',actualQty:''}])} className="btn btn-secondary btn-sm w-full text-xs">+ Tambah Manual</button>
    <button onClick={submit} disabled={busy} className="btn btn-primary btn-sm w-full">{busy?'...':canApply?'Terapkan':'Simpan'}</button>
  </div>;
}
function MenuView() {
  const [products,setProducts]=useState<any[]>([]);
  const [search,setSearch]=useState('');
  const [selected,setSelected]=useState<any>(null);
  useEffect(()=>{
    api.get<any>('/api/products?active=1&includeRecipe=1').then(r=>{
      const arr=Array.isArray(r)?r:(r?.products||r?.data||[]);
      setProducts(arr);
    }).catch(()=>{});
  },[]);
  const filtered=products.filter((p:any)=>p.name.toLowerCase().includes(search.toLowerCase()));
  return <div className="p-3">
    <input value={search} onChange={e=>{setSearch(e.target.value);setSelected(null);}} className="input text-sm mb-2" placeholder="Cari menu..."/>
    {selected ? (
      <div>
        <button onClick={()=>setSelected(null)} className="flex items-center gap-1 text-xs text-gray-400 mb-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Kembali
        </button>
        <div className="rounded-xl border border-gray-100 overflow-hidden">
          <div className="p-3 border-b border-gray-100" style={{ background:'var(--brand)10' }}>
            <p className="font-black text-sm text-gray-900">{selected.name}</p>
            {selected.description && <p className="text-xs text-gray-500 mt-0.5">{selected.description}</p>}
          </div>
          {/* Resep */}
          {selected.recipe?.items?.length > 0 && (
            <div className="p-3 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Bahan</p>
              <div className="space-y-1">
                {selected.recipe.items.map((ri:any,i:number)=>(
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-gray-700">{ri.ingredient?.name}</span>
                    <span className="font-bold text-gray-900">{ri.quantity} {ri.ingredient?.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Cara pembuatan */}
          <div className="p-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Cara Pembuatan</p>
            {selected.recipe?.instructions ? (
              <div className="space-y-1.5">
                {String(selected.recipe.instructions).split('\n').filter((s:string)=>s.trim()).map((step:string,i:number)=>(
                  <div key={i} className="flex gap-2 text-xs">
                    <span className="font-black text-gray-300 text-base leading-tight w-4 flex-shrink-0">{i+1}</span>
                    <span className="text-gray-700 leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {Array(5).fill(0).map((_,i)=>(
                  <div key={i} className="border-b border-gray-100 pb-2"/>
                ))}
                <p className="text-xs text-gray-300 italic">Diisi manual</p>
              </div>
            )}
          </div>
        </div>
      </div>
    ) : (
      <div className="space-y-1.5">
        {filtered.map((p:any)=>(
          <button key={p.id} onClick={()=>setSelected(p)} className="w-full flex items-center justify-between rounded-lg p-2.5 border border-gray-100 bg-gray-50 text-left hover:border-gray-300 transition-colors">
            <div>
              <p className="font-semibold text-xs text-gray-900">{p.name}</p>
              {p.category?.name && <p className="text-xs text-gray-400">{p.category.name}</p>}
            </div>
            <div className="flex items-center gap-1.5">
              <p className="font-bold text-xs" style={{ color:'var(--brand)' }}>{formatCurrency(p.price)}</p>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </button>
        ))}
      </div>
    )}
  </div>;
}
function ExpenseForm({busy,setBusy,onDone}:any) {
  const [cat,setCat]=useState('OPERATIONAL');const [desc,setDesc]=useState('');const [amount,setAmount]=useState('');
  async function submit(){if(!desc||!amount)return;setBusy(true);try{await api.post('/api/expenses',{category:cat,description:desc,amount:parseFloat(amount)});onDone('Dicatat');setDesc('');setAmount('');}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  return <FW><select value={cat} onChange={e=>setCat(e.target.value)} className="input text-sm">{['OPERATIONAL','PURCHASE','UTILITIES','SALARY','OTHER'].map(c=><option key={c} value={c}>{c}</option>)}</select><input value={desc} onChange={e=>setDesc(e.target.value)} className="input text-sm" placeholder="Keterangan"/><input type="number" value={amount} onChange={e=>setAmount(e.target.value)} className="input text-sm" placeholder="Nominal (Rp)"/><button onClick={submit} disabled={busy||!desc||!amount} className="btn btn-primary btn-sm w-full">{busy?'...':'Catat'}</button></FW>;
}
function PrinterSetup() {
  const [name,setName]=useState('');const [connected,setConnected]=useState(false);
  useEffect(()=>{ const s=getSavedPrinter();if(s)setName(String(s));setConnected(isConnected()); },[]);
  async function pair(){try{await pairAndConnect();setConnected(isConnected());const s=getSavedPrinter();if(s)setName(String(s));}catch{alert('Gagal');}}
  async function testPrint(){const E=0x1B,L=0x0A,G=0x1D;const enc=(s:string)=>Array.from(s).map(c=>c.charCodeAt(0));const d=new Uint8Array([E,0x40,...enc('TEST PRINT'),L,...enc('Soeka House'),L,L,L,G,0x56,0x42,0x10]);await printData(d).catch(e=>alert('Gagal: '+e.message));}
  return <FW><div className="rounded-lg p-3 border border-gray-100 bg-gray-50 text-center"><div className="text-2xl mb-1">{connected?'🖨️':'📵'}</div><p className="font-bold text-sm text-gray-900">{connected?'Terhubung':'Tidak terhubung'}</p>{name&&<p className="text-xs mt-0.5 text-gray-400 truncate">{name}</p>}</div><button onClick={pair} className="btn btn-primary btn-sm w-full">🔗 {connected?'Ganti':'Pair Printer'}</button>{connected&&<button onClick={testPrint} className="btn btn-secondary btn-sm w-full">🖨️ Test Print</button>}</FW>;
}
function TxHistory() {
  const [orders,setOrders]=useState<any[]>([]);const [loading,setLoading]=useState(true);const [selected,setSelected]=useState<any>(null);const [printing,setPrinting]=useState(false);
  useEffect(()=>{ api.get<any>('/api/orders?limit=30&status=COMPLETED').then(r=>setOrders(r.orders||r||[])).catch(()=>{}).finally(()=>setLoading(false)); },[]);
  async function printTicket(o:any,type:'kitchen'|'bar'|'customer'){
    setPrinting(true);
    try{
      const full=await api.get<any>(`/api/orders?id=${o.id}`).catch(()=>o);const order=full.order||full;
      const items=(order.items||[]).map((i:any)=>({name:i.product?.name||'',qty:i.quantity,price:i.unitPrice||0,subtotal:i.subtotal||0}));
      const date=new Date(order.createdAt).toLocaleString('id-ID');
      if(type==='kitchen'){const ki=items.filter((_:any,idx:number)=>(order.items?.[idx]?.product?.station||'DRINK')==='FOOD');await printData(buildKitchenTicket({orderNumber:order.orderNumber,date,customerName:order.billName,items:ki,station:'KITCHEN'}));}
      else if(type==='bar'){const bi=items.filter((_:any,idx:number)=>(order.items?.[idx]?.product?.station||'DRINK')==='DRINK');await printData(buildKitchenTicket({orderNumber:order.orderNumber,date,customerName:order.billName,items:bi,station:'BAR'}));}
      else{await printData(buildReceipt({orderNumber:order.orderNumber,date,customerName:order.billName,items,subtotal:order.subtotal,discount:order.discount,tax:order.tax,serviceCharge:order.serviceCharge,total:order.total,payMethod:order.payment?.method||'CASH',received:order.payment?.received,change:order.payment?.change}));}
    }catch(e:any){alert(`Gagal: ${e.message}`);}finally{setPrinting(false);}
  }
  const fmt=(d:string)=>new Date(d).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
  if(loading) return <div className="flex justify-center py-8"><div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor:'var(--brand)',borderTopColor:'transparent' }}/></div>;
  return <div className="p-2 space-y-1.5">
    {orders.length===0&&<p className="text-center py-6 text-xs text-gray-400">Belum ada transaksi</p>}
    {orders.map(o=>(
      <button key={o.id} onClick={()=>setSelected(selected?.id===o.id?null:o)} className="w-full text-left rounded-lg border p-2.5 transition-all text-xs" style={{ borderColor:selected?.id===o.id?'var(--brand)':'#e5e7eb',background:selected?.id===o.id?'#f0fdf4':'white' }}>
        <div className="flex justify-between items-center">
          <div><p className="font-bold text-gray-900">#{o.orderNumber}</p><p className="text-gray-400">{fmt(o.createdAt)}{o.billName?` · ${o.billName}`:''}</p></div>
          <p className="font-black" style={{ color:'var(--brand)' }}>{formatCurrency(o.total)}</p>
        </div>
        {selected?.id===o.id&&<div className="mt-2 pt-2 border-t border-gray-100">
          <div className="space-y-0.5 mb-2">{(o.items||[]).map((item:any,idx:number)=>(<div key={idx} className="flex justify-between text-gray-500"><span>{item.quantity}× {item.product?.name}</span><span>{formatCurrency(item.subtotal)}</span></div>))}</div>
          <div className="grid grid-cols-3 gap-1">
            {([['🍳','kitchen'],['☕','bar'],['🧾','customer']] as const).map(([icon,type])=>(
              <button key={type} disabled={printing} onClick={e=>{e.stopPropagation();printTicket(o,type as any);}} className="py-1.5 rounded text-xs font-bold border disabled:opacity-50" style={{ borderColor:'var(--brand)',color:'var(--brand)' }}>{printing?'...':icon}</button>
            ))}
          </div>
        </div>}
      </button>
    ))}
  </div>;
}

function RequestForm({ ingredients, onDone }: any) {
  const raw = ingredients.filter((i: any) => i.type === 'RAW');
  const [items, setItems] = useState([{ ingredientId: '', quantity: '', notes: '' }]);
  const [globalNotes, setGlobalNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const addItem = () => setItems(p => [...p, { ingredientId: '', quantity: '', notes: '' }]);
  const removeItem = (i: number) => setItems(p => p.filter((_, j) => j !== i));
  const updItem = (i: number, k: string, v: string) => setItems(p => p.map((e, j) => j === i ? { ...e, [k]: v } : e));

  async function submit() {
    const valid = items.filter(i => i.ingredientId && i.quantity);
    if (!valid.length) { alert('Minimal 1 bahan harus diisi'); return; }
    setSaving(true);
    try {
      const ing = (id: string) => raw.find((i: any) => i.id === id);
      await api.post('/api/purchase-requests', {
        notes: globalNotes || null,
        items: valid.map(i => ({
          ingredientId: i.ingredientId,
          quantity: parseFloat(i.quantity),
          unit: ing(i.ingredientId)?.purchaseUnit || ing(i.ingredientId)?.unit || 'unit',
          notes: i.notes || null,
        })),
      });
      onDone('Request terkirim ke manager');
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-3 space-y-3">
      <p className="text-xs text-gray-400">Pilih bahan yang perlu di-restock. Manager akan terima notifikasi dan buat PO.</p>

      {items.map((item, i) => {
        const ing = raw.find((r: any) => r.id === item.ingredientId);
        return (
          <div key={i} className="rounded-lg border border-gray-100 p-2.5 space-y-2 bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">Bahan {i + 1}</span>
              {items.length > 1 && (
                <button onClick={() => removeItem(i)} className="text-red-400 text-xs">Hapus</button>
              )}
            </div>
            <select value={item.ingredientId} onChange={e => updItem(i, 'ingredientId', e.target.value)}
              className="input w-full text-sm">
              <option value="">Pilih bahan...</option>
              {raw.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {ing && (
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={item.quantity}
                  onChange={e => updItem(i, 'quantity', e.target.value)}
                  className="input text-sm flex-1"
                  placeholder="Qty"
                />
                <span className="text-xs font-bold text-gray-500 flex-shrink-0">
                  {ing.purchaseUnit || ing.unit}
                </span>
              </div>
            )}
            <input
              value={item.notes}
              onChange={e => updItem(i, 'notes', e.target.value)}
              className="input text-sm w-full"
              placeholder="Catatan (opsional)"
            />
          </div>
        );
      })}

      <button onClick={addItem} className="btn btn-secondary btn-sm w-full text-xs">
        + Tambah Bahan
      </button>

      <textarea
        value={globalNotes}
        onChange={e => setGlobalNotes(e.target.value)}
        className="input text-sm w-full"
        rows={2}
        placeholder="Catatan tambahan untuk manager..."
      />

      <button onClick={submit} disabled={saving}
        className="btn btn-primary btn-sm w-full"
        style={{ background: '#DC2626' }}>
        {saving ? 'Mengirim...' : '📋 Kirim Request'}
      </button>
    </div>
  );
}
