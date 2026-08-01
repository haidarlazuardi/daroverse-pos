'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/store';
import { api } from '@/lib/fetch';
import { formatCurrency } from '@/components/ui';
import { getSavedPrinter, isConnected, pairAndConnect, printData } from '@/lib/bluetooth-printer';
import { buildReceipt, buildKitchenTicket } from '@/lib/escpos';

type Mode = 'home'|'batch'|'take'|'check'|'waste'|'receive'|'opname'|'menu'|'expense'|'printer'|'history';
type Ingredient = { id:string;name:string;unit:string;type:string;stockLevels?:{location:string;quantity:number}[] };

const TITLES:Record<Mode,string> = { home:'Staff Hub',batch:'Bikin batch',take:'Ambil bahan',check:'Cek stok',waste:'Buang',receive:'Terima barang',opname:'Stock opname',menu:'Lihat menu',expense:'Pengeluaran',printer:'Printer',history:'Riwayat' };

export default function StaffSidebar({ open, onClose }:{ open:boolean; onClose:()=>void }) {
  const { user, hydrate } = useAuthStore();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [perms, setPerms] = useState<Record<string,boolean>>({});
  const [mode, setMode] = useState<Mode>('home');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const touchStartX = useRef<number|null>(null);

  useEffect(()=>{ hydrate(); },[hydrate]);
  useEffect(()=>{ if(!user) return; api.get<Record<string,boolean>>('/api/auth/permissions').then(setPerms).catch(()=>{}); },[user]);
  const load = useCallback(async()=>{ const r=await api.get<Ingredient[]>('/api/ingredients?active=1').catch(()=>[]); setIngredients(Array.isArray(r)?r:[]); },[]);
  useEffect(()=>{ if(user) load(); },[user,load]);
  useEffect(()=>{ if(!open) setTimeout(()=>setMode('home'),300); },[open]);

  const can=(p:string)=>{ if(!user) return false; if(['SUPER_ADMIN','OWNER','MANAGER'].includes(user.role)) return true; return perms[p]!==false; };
  const showToast=(msg:string)=>{ setToast(msg); setTimeout(()=>setToast(''),3000); };
  const onDone=(msg:string)=>{ showToast(msg); setMode('home'); load(); };
  const stockAt=(id:string,loc:string)=>ingredients.find(i=>i.id===id)?.stockLevels?.find(s=>s.location===loc)?.quantity??0;

  const tiles=[
    { mode:'batch' as Mode,perm:'batch_production',color:'#0891B2',label:'Bikin batch',desc:'Produksi olahan',icon:'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
    { mode:'take' as Mode,perm:'take_stock',color:'#7C3AED',label:'Ambil bahan',desc:'Transfer ke station',icon:'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
    { mode:'check' as Mode,perm:'view_stock',color:'#059669',label:'Cek stok',desc:'Lihat stok bahan',icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { mode:'waste' as Mode,perm:'waste_stock',color:'#DC2626',label:'Buang',desc:'Catat waste/rusak',icon:'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' },
    { mode:'receive' as Mode,perm:'receive_stock',color:'#D97706',label:'Terima barang',desc:'Terima PO masuk',icon:'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
    { mode:'opname' as Mode,perm:'stock_opname',color:'#0369A1',label:'Stock opname',desc:'Hitung stok aktual',icon:'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
    { mode:'menu' as Mode,perm:'view_menu',color:'#555',label:'Lihat menu',desc:'Daftar & resep',icon:'M4 6h16M4 12h16M4 18h7' },
    { mode:'expense' as Mode,perm:'expense',color:'#B45309',label:'Pengeluaran',desc:'Belanja kecil',icon:'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6' },
    { mode:'history' as Mode,perm:'view_menu',color:'#0369A1',label:'Riwayat',desc:'History transaksi',icon:'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { mode:'printer' as Mode,perm:'view_menu',color:'#374151',label:'Printer',desc:'Setup Bluetooth',icon:'M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z' },
  ];
  const visible = tiles.filter(t=>can(t.perm));

  const onTouchStart=(e:React.TouchEvent)=>{ touchStartX.current=e.touches[0].clientX; };
  const onTouchEnd=(e:React.TouchEvent)=>{ if(touchStartX.current===null) return; if(touchStartX.current-e.changedTouches[0].clientX>60) onClose(); touchStartX.current=null; };

  return <>
    <div onClick={onClose} className="fixed inset-0 z-40 transition-opacity duration-300"
      style={{ background:'rgba(0,0,0,0.5)',opacity:open?1:0,pointerEvents:open?'auto':'none' }}/>
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      className="fixed top-0 left-0 h-full z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-out"
      style={{ width:'85vw',maxWidth:360,background:'white',transform:open?'translateX(0)':'translateX(-100%)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ background:'var(--brand)' }}>
        <div className="flex items-center gap-2">
          {mode!=='home' && <button onClick={()=>setMode('home')} className="text-white opacity-80">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>}
          <p className="font-black text-white">{TITLES[mode]}</p>
        </div>
        <button onClick={onClose} className="text-white opacity-70 text-xl">✕</button>
      </div>

      {toast && <div className="mx-4 mt-3 rounded-xl px-4 py-2.5 text-sm font-medium text-white flex-shrink-0" style={{ background:'#16a34a' }}>{toast}</div>}

      <div className="flex-1 overflow-y-auto">
        {mode==='home' && <div className="p-4">
          {user && <p className="text-sm mb-4 font-medium" style={{ color:'#888' }}>Halo, {user.name} 👋</p>}
          <div className="grid grid-cols-2 gap-3">
            {visible.map(t=>(
              <button key={t.mode} onClick={()=>setMode(t.mode)}
                className="rounded-2xl border p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform"
                style={{ borderColor:'#e5e7eb',background:'#f9fafb' }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background:t.color+'18',color:t.color }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon}/></svg>
                </div>
                <span className="font-bold text-sm text-center text-gray-900">{t.label}</span>
                <span className="text-xs text-center text-gray-400">{t.desc}</span>
              </button>
            ))}
            <a href="/scan-transfer" className="rounded-2xl border p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform no-underline" style={{ borderColor:'#e5e7eb',background:'#f9fafb' }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background:'#7C3AED18',color:'#7C3AED' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/><rect x="7" y="7" width="4" height="4" rx="1"/><rect x="13" y="7" width="4" height="4" rx="1"/><rect x="7" y="13" width="4" height="4" rx="1"/><path d="M13 13h1v1M15 13h2v2M15 15h2v2M13 16h1v2"/></svg>
              </div>
              <span className="font-bold text-sm text-gray-900">Scan QR</span>
              <span className="text-xs text-gray-400">Transfer stok</span>
            </a>
          </div>
        </div>}
        {mode==='batch'   && <BatchForm   prepped={ingredients.filter(i=>i.type==='PREPPED')} busy={busy} setBusy={setBusy} onDone={onDone}/>}
        {mode==='take'    && <TakeForm    ingredients={ingredients} busy={busy} setBusy={setBusy} onDone={onDone} stockAt={stockAt}/>}
        {mode==='check'   && <CheckStock  ingredients={ingredients} stockAt={stockAt}/>}
        {mode==='waste'   && <WasteForm   ingredients={ingredients} busy={busy} setBusy={setBusy} onDone={onDone} stockAt={stockAt}/>}
        {mode==='receive' && <ReceivePO   busy={busy} setBusy={setBusy} onDone={onDone}/>}
        {mode==='opname'  && <Opname      canApply={can('apply_opname')} busy={busy} setBusy={setBusy} onDone={onDone}/>}
        {mode==='menu'    && <MenuView/>}
        {mode==='expense' && <ExpenseForm busy={busy} setBusy={setBusy} onDone={onDone}/>}
        {mode==='printer' && <PrinterSetup/>}
        {mode==='history' && <TxHistory/>}
      </div>
    </div>
  </>;
}

const FW=({children}:{children:React.ReactNode})=><div className="p-4 space-y-3">{children}</div>;
function Picker<T extends {id:string;name:string}>({items,value,onChange,placeholder}:{items:T[];value:string;onChange:(v:string)=>void;placeholder:string}) {
  return <select value={value} onChange={e=>onChange(e.target.value)} className="input w-full"><option value="">{placeholder}</option>{items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select>;
}
const LP=({value,set,locs}:{value:string;set:(v:any)=>void;locs:string[]})=>(
  <div className="flex gap-2">{locs.map(l=><button key={l} onClick={()=>set(l)} className="flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all" style={{ borderColor:value===l?'var(--brand)':'#e5e7eb',color:value===l?'var(--brand)':'#6b7280',background:value===l?'#e8f5e9':'white' }}>{l}</button>)}</div>
);

function BatchForm({prepped,busy,setBusy,onDone}:any) {
  const [id,setId]=useState('');const [mult,setMult]=useState('1');const [loc,setLoc]=useState('BAR');
  async function submit(){if(!id||!mult)return;setBusy(true);try{await api.post('/api/stock/batch',{ingredientId:id,multiplier:parseFloat(mult),location:loc});onDone('Batch selesai');}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  return <FW><Picker items={prepped} value={id} onChange={setId} placeholder="Pilih olahan"/><input type="number" value={mult} onChange={e=>setMult(e.target.value)} className="input" placeholder="Multiplier"/><LP value={loc} set={setLoc} locs={['BAR','KITCHEN','GUDANG']}/><button onClick={submit} disabled={busy||!id} className="btn btn-primary btn-md w-full">{busy?'Proses...':'Buat Batch'}</button></FW>;
}
function TakeForm({ingredients,busy,setBusy,onDone,stockAt}:any) {
  const [id,setId]=useState('');const [qty,setQty]=useState('');const [from,setFrom]=useState('GUDANG');const [to,setTo]=useState('BAR');
  const raw=ingredients.filter((i:any)=>i.type==='RAW');const ing=raw.find((i:any)=>i.id===id);
  async function submit(){if(!id||!qty)return;setBusy(true);try{await api.post('/api/stock/transfer',{ingredientId:id,fromLocation:from,toLocation:to,quantity:parseFloat(qty)});onDone('Transfer selesai');}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  return <FW><Picker items={raw} value={id} onChange={setId} placeholder="Pilih bahan"/>{ing&&<p className="text-xs text-gray-400">Stok {from}: {stockAt(id,from)} {ing.unit}</p>}<div><p className="text-xs font-bold text-gray-500 mb-1">Dari</p><LP value={from} set={setFrom} locs={['GUDANG','BAR','KITCHEN']}/></div><div><p className="text-xs font-bold text-gray-500 mb-1">Ke</p><LP value={to} set={setTo} locs={['GUDANG','BAR','KITCHEN']}/></div><input type="number" value={qty} onChange={e=>setQty(e.target.value)} className="input" placeholder={`Jumlah (${ing?.unit||'unit'})`}/><button onClick={submit} disabled={busy||!id||!qty||from===to} className="btn btn-primary btn-md w-full">{busy?'Proses...':'Transfer'}</button></FW>;
}
function CheckStock({ingredients,stockAt}:any) {
  const [search,setSearch]=useState('');
  const filtered=ingredients.filter((i:any)=>i.name.toLowerCase().includes(search.toLowerCase()));
  return <div className="p-4"><input value={search} onChange={e=>setSearch(e.target.value)} className="input mb-3" placeholder="Cari bahan..."/><div className="space-y-2">{filtered.map((i:any)=>(<div key={i.id} className="rounded-xl p-3 border border-gray-100 bg-gray-50"><p className="font-bold text-sm text-gray-900">{i.name}</p><div className="flex gap-3 mt-1">{['GUDANG','BAR','KITCHEN'].map(l=><p key={l} className="text-xs text-gray-400">{l}: <span className="font-bold text-gray-700">{stockAt(i.id,l)}</span> {i.unit}</p>)}</div></div>))}</div></div>;
}
function WasteForm({ingredients,busy,setBusy,onDone,stockAt}:any) {
  const [id,setId]=useState('');const [qty,setQty]=useState('');const [loc,setLoc]=useState('BAR');const [reason,setReason]=useState('');
  const ing=ingredients.find((i:any)=>i.id===id);
  async function submit(){if(!id||!qty)return;setBusy(true);try{await api.post('/api/stock/waste',{ingredientId:id,quantity:parseFloat(qty),location:loc,reason});onDone('Waste dicatat');}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  return <FW><Picker items={ingredients} value={id} onChange={setId} placeholder="Pilih bahan"/>{ing&&<p className="text-xs text-gray-400">Stok {loc}: {stockAt(id,loc)} {ing.unit}</p>}<LP value={loc} set={setLoc} locs={['BAR','KITCHEN','GUDANG']}/><input type="number" value={qty} onChange={e=>setQty(e.target.value)} className="input" placeholder={`Jumlah dibuang (${ing?.unit||'unit'})`}/><input value={reason} onChange={e=>setReason(e.target.value)} className="input" placeholder="Alasan (opsional)"/><button onClick={submit} disabled={busy||!id||!qty} className="btn btn-primary btn-md w-full" style={{ background:'#dc2626' }}>{busy?'Proses...':'Catat Waste'}</button></FW>;
}
function ReceivePO({busy,setBusy,onDone}:any) {
  const [pos,setPOs]=useState<any[]>([]);
  useEffect(()=>{ api.get<any>('/api/purchase-orders?status=DRAFT').then(r=>setPOs(r.orders||r||[])).catch(()=>{}); },[]);
  async function receive(id:string){setBusy(true);try{await api.patch('/api/purchase-orders',{id,action:'complete'});onDone('PO diterima');}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  return <div className="p-4 space-y-3">{pos.length===0?<p className="text-center py-8 text-gray-400 text-sm">Tidak ada PO pending</p>:pos.map(po=>(<div key={po.id} className="rounded-xl border border-gray-100 p-3 bg-gray-50"><div className="flex justify-between items-start mb-2"><div><p className="font-bold text-sm text-gray-900">{po.poNumber}</p><p className="text-xs text-gray-400">{po.supplier?.name}</p></div><p className="font-bold text-sm" style={{ color:'var(--brand)' }}>{formatCurrency(po.totalAmount)}</p></div><button onClick={()=>receive(po.id)} disabled={busy} className="btn btn-primary btn-sm w-full">Terima & Update Stok</button></div>))}</div>;
}
function Opname({canApply,busy,setBusy,onDone}:any) {
  const [entries,setEntries]=useState([{ingredientId:'',location:'BAR',actualQty:''}]);
  const [ings,setIngs]=useState<any[]>([]);
  useEffect(()=>{ api.get<any[]>('/api/ingredients?active=1').then(r=>setIngs(Array.isArray(r)?r:[])).catch(()=>{}); },[]);
  const add=()=>setEntries(p=>[...p,{ingredientId:'',location:'BAR',actualQty:''}]);
  const upd=(i:number,k:string,v:string)=>setEntries(p=>p.map((e,j)=>j===i?{...e,[k]:v}:e));
  async function submit(){const valid=entries.filter(e=>e.ingredientId&&e.actualQty);if(!valid.length)return;setBusy(true);try{await api.post('/api/stock/opname',{entries:valid.map(e=>({...e,actualQty:parseFloat(e.actualQty)})),apply:canApply});onDone(canApply?'Opname diterapkan':'Opname dicatat');}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  return <div className="p-4 space-y-3">{entries.map((e,i)=>(<div key={i} className="rounded-xl border border-gray-100 p-3 space-y-2"><select value={e.ingredientId} onChange={ev=>upd(i,'ingredientId',ev.target.value)} className="input w-full"><option value="">Pilih bahan</option>{ings.map((ing:any)=><option key={ing.id} value={ing.id}>{ing.name}</option>)}</select><div className="flex gap-1">{['GUDANG','BAR','KITCHEN'].map(l=><button key={l} onClick={()=>upd(i,'location',l)} className="flex-1 py-1 rounded-lg text-xs font-bold border" style={{ borderColor:e.location===l?'var(--brand)':'#e5e7eb',color:e.location===l?'var(--brand)':'#6b7280' }}>{l}</button>)}</div><input type="number" value={e.actualQty} onChange={ev=>upd(i,'actualQty',ev.target.value)} className="input" placeholder="Qty aktual"/></div>))}<button onClick={add} className="btn btn-secondary btn-sm w-full">+ Tambah</button><button onClick={submit} disabled={busy} className="btn btn-primary btn-md w-full">{busy?'Menyimpan...':canApply?'Terapkan':'Simpan'}</button></div>;
}
function MenuView() {
  const [products,setProducts]=useState<any[]>([]);const [search,setSearch]=useState('');
  useEffect(()=>{ api.get<any[]>('/api/products?active=1').then(r=>setProducts(Array.isArray(r)?r:[])).catch(()=>{}); },[]);
  const filtered=products.filter(p=>p.name.toLowerCase().includes(search.toLowerCase()));
  return <div className="p-4"><input value={search} onChange={e=>setSearch(e.target.value)} className="input mb-3" placeholder="Cari menu..."/><div className="space-y-2">{filtered.map(p=>(<div key={p.id} className="flex items-center justify-between rounded-xl p-3 border border-gray-100 bg-gray-50"><p className="font-semibold text-sm text-gray-900">{p.name}</p><p className="font-bold text-sm" style={{ color:'var(--brand)' }}>{formatCurrency(p.price)}</p></div>))}</div></div>;
}
function ExpenseForm({busy,setBusy,onDone}:any) {
  const [cat,setCat]=useState('OPERATIONAL');const [desc,setDesc]=useState('');const [amount,setAmount]=useState('');
  async function submit(){if(!desc||!amount)return;setBusy(true);try{await api.post('/api/expenses',{category:cat,description:desc,amount:parseFloat(amount)});onDone('Pengeluaran dicatat');setDesc('');setAmount('');}catch(e:any){alert(e.message);}finally{setBusy(false);}}
  return <FW><select value={cat} onChange={e=>setCat(e.target.value)} className="input">{['OPERATIONAL','PURCHASE','UTILITIES','SALARY','OTHER'].map(c=><option key={c} value={c}>{c}</option>)}</select><input value={desc} onChange={e=>setDesc(e.target.value)} className="input" placeholder="Keterangan"/><input type="number" value={amount} onChange={e=>setAmount(e.target.value)} className="input" placeholder="Nominal (Rp)"/><button onClick={submit} disabled={busy||!desc||!amount} className="btn btn-primary btn-md w-full">{busy?'Menyimpan...':'Catat'}</button></FW>;
}
function PrinterSetup() {
  const [name,setName]=useState('');const [connected,setConnected]=useState(false);
  useEffect(()=>{ const s=getSavedPrinter();if(s)setName(String(s));setConnected(isConnected()); },[]);
  async function pair(){try{await pairAndConnect();setConnected(isConnected());const s=getSavedPrinter();if(s)setName(String(s));}catch{alert('Gagal pair printer');}}
  async function testPrint(){const E=0x1B,L=0x0A,G=0x1D;const enc=(s:string)=>Array.from(s).map(c=>c.charCodeAt(0));const d=new Uint8Array([E,0x40,...enc('TEST PRINT'),L,...enc('Soeka House'),L,...enc(new Date().toLocaleString('id-ID')),L,L,L,G,0x56,0x42,0x10]);await printData(d).catch(e=>alert('Gagal: '+e.message));}
  return <FW><div className="rounded-xl p-4 border border-gray-100 bg-gray-50 text-center"><div className="text-3xl mb-2">{connected?'🖨️':'📵'}</div><p className="font-bold text-gray-900">{connected?'Terhubung':'Tidak terhubung'}</p>{name&&<p className="text-xs mt-1 text-gray-400">{name}</p>}</div><button onClick={pair} className="btn btn-primary btn-md w-full">🔗 {connected?'Ganti Printer':'Pair Printer'}</button>{connected&&<button onClick={testPrint} className="btn btn-secondary btn-md w-full">🖨️ Test Print</button>}</FW>;
}
function TxHistory() {
  const [orders,setOrders]=useState<any[]>([]);const [loading,setLoading]=useState(true);const [selected,setSelected]=useState<any>(null);const [printing,setPrinting]=useState(false);
  useEffect(()=>{ api.get<any>('/api/orders?limit=50&status=COMPLETED').then(r=>setOrders(r.orders||r||[])).catch(()=>{}).finally(()=>setLoading(false)); },[]);
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
  const fmtD=(d:string)=>new Date(d).toLocaleDateString('id-ID',{day:'numeric',month:'short'});
  if(loading) return <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor:'var(--brand)',borderTopColor:'transparent' }}/></div>;
  return <div className="p-3 space-y-2">
    {orders.length===0&&<p className="text-center py-8 text-sm text-gray-400">Belum ada transaksi</p>}
    {orders.map(o=>(
      <button key={o.id} onClick={()=>setSelected(selected?.id===o.id?null:o)} className="w-full text-left rounded-xl border p-3 transition-all" style={{ borderColor:selected?.id===o.id?'var(--brand)':'#e5e7eb',background:selected?.id===o.id?'#f9fafb':'white' }}>
        <div className="flex items-center justify-between">
          <div><p className="font-bold text-sm text-gray-900">#{o.orderNumber}</p><p className="text-xs text-gray-400">{fmtD(o.createdAt)} {fmt(o.createdAt)}{o.billName?` · ${o.billName}`:''}</p></div>
          <p className="font-black text-sm" style={{ color:'var(--brand)' }}>{formatCurrency(o.total)}</p>
        </div>
        {selected?.id===o.id&&<div className="mt-3 pt-3 border-t border-gray-100">
          <div className="space-y-1 mb-3">{(o.items||[]).map((item:any,idx:number)=>(<div key={idx} className="flex justify-between text-xs text-gray-600"><span>{item.quantity}× {item.product?.name||item.name}</span><span className="font-medium">{formatCurrency(item.subtotal)}</span></div>))}</div>
          <div className="grid grid-cols-3 gap-1.5">
            {([['🍳','kitchen'],['☕','bar'],['🧾','customer']] as const).map(([icon,type])=>(
              <button key={type} disabled={printing} onClick={e=>{e.stopPropagation();printTicket(o,type as any);}} className="py-2 rounded-lg text-xs font-bold border disabled:opacity-50" style={{ borderColor:'var(--brand)',color:'var(--brand)' }}>{printing?'...':icon}</button>
            ))}
          </div>
        </div>}
      </button>
    ))}
  </div>;
}
