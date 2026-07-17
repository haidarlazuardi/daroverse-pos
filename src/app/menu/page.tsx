'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function formatCurrency(n: number) {
  return 'Rp\u00A0' + n.toLocaleString('id-ID');
}

type Product = { id: string; name: string; price: number; category: { id: string; name: string; color: string }; station: string };
type CartItem = { productId: string; name: string; price: number; quantity: number };

// ── Countdown ────────────────────────────────────────────────────────────────
function Countdown({ expiresAt, onExpired }: { expiresAt: string; onExpired: () => void }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecs(diff);
      if (diff === 0) onExpired();
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [expiresAt, onExpired]);
  const m = Math.floor(secs / 60), s = secs % 60;
  const pct = (secs / 600) * 100;
  const urgent = secs < 120;
  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r="40" fill="none" stroke="#E8DDD0" strokeWidth="5"/>
        <circle cx="48" cy="48" r="40" fill="none"
          stroke={urgent ? '#C0392B' : '#48654D'} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={`${2*Math.PI*40}`}
          strokeDashoffset={`${2*Math.PI*40*(1-pct/100)}`}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}/>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black tabular-nums" style={{ color: urgent ? '#C0392B' : '#1A1A1A', fontFamily: 'Georgia, serif' }}>
          {String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
        </span>
        <span className="text-[9px] tracking-widest text-[#999] uppercase font-medium">menit</span>
      </div>
    </div>
  );
}

// ── FONT LOADER ──────────────────────────────────────────────────────────────
function FontLoader() {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=Inter:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }, []);
  return null;
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
function MenuContent() {
  const searchParams = useSearchParams();
  const urlTable = searchParams.get('table') || '';

  // ── Restore from sessionStorage on mount ──────────────────────────────────
  const [step, setStepRaw] = useState<'landing'|'menu'|'info'|'payment'|'status'>(() => {
    try {
      const saved = sessionStorage.getItem('soeka_menu_step');
      if (saved) return saved as any;
    } catch {}
    return urlTable ? 'menu' : 'landing';
  });
  const [tableId, setTableIdRaw] = useState(() => {
    try { return sessionStorage.getItem('soeka_menu_table') || urlTable || ''; } catch { return urlTable || ''; }
  });
  const [cart, setCartRaw] = useState<CartItem[]>(() => {
    try { const s = sessionStorage.getItem('soeka_menu_cart'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [name, setNameRaw] = useState(() => { try { return sessionStorage.getItem('soeka_menu_name') || ''; } catch { return ''; } });
  const [phone, setPhoneRaw] = useState(() => { try { return sessionStorage.getItem('soeka_menu_phone') || ''; } catch { return ''; } });
  const [order, setOrderRaw] = useState<any>(() => {
    try { const s = sessionStorage.getItem('soeka_menu_order'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [orderStatus, setOrderStatusRaw] = useState(() => { try { return sessionStorage.getItem('soeka_menu_status') || ''; } catch { return ''; } });

  // Wrapped setters that also persist
  function setStep(v: typeof step)        { setStepRaw(v);        try { sessionStorage.setItem('soeka_menu_step', v); } catch {} }
  function setTableId(v: string)          { setTableIdRaw(v);     try { sessionStorage.setItem('soeka_menu_table', v); } catch {} }
  function setCart(fn: CartItem[] | ((p: CartItem[]) => CartItem[])) {
    setCartRaw(prev => {
      const next = typeof fn === 'function' ? fn(prev) : fn;
      try { sessionStorage.setItem('soeka_menu_cart', JSON.stringify(next)); } catch {}
      return next;
    });
  }
  function setName(v: string)             { setNameRaw(v);        try { sessionStorage.setItem('soeka_menu_name', v); } catch {} }
  function setPhone(v: string)            { setPhoneRaw(v);       try { sessionStorage.setItem('soeka_menu_phone', v); } catch {} }
  function setOrder(v: any)               { setOrderRaw(v);       try { sessionStorage.setItem('soeka_menu_order', JSON.stringify(v)); } catch {} }
  function setOrderStatus(v: string)      { setOrderStatusRaw(v); try { sessionStorage.setItem('soeka_menu_status', v); } catch {} }

  function clearSession() {
    ['soeka_menu_step','soeka_menu_table','soeka_menu_cart','soeka_menu_name','soeka_menu_phone','soeka_menu_order','soeka_menu_status']
      .forEach(k => { try { sessionStorage.removeItem(k); } catch {} });
  }

  // Non-persisted state (re-fetched on mount)
  const [tableInput, setTableInput] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selCat, setSelCat] = useState('');
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [payMethod, setPayMethod] = useState<'QRIS'|'BCA'|'CASH'>('QRIS');
  const [proofPreview, setProofPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tableId) return;
    setLoading(true);
    fetch(`/api/public/menu?table=${tableId}`)
      .then(r => r.json())
      .then(d => { setProducts(d.data?.products || []); setCategories(d.data?.categories || []); setSettings(d.data?.settings); })
      .finally(() => setLoading(false));
  }, [tableId]);

  useEffect(() => {
    if (!order || step !== 'status') return;
    const poll = setInterval(async () => {
      const r = await fetch(`/api/public/qr-orders?id=${order.id}`);
      const d = await r.json();
      if (d.data?.status) setOrderStatus(d.data.status);
    }, 5000);
    return () => clearInterval(poll);
  }, [order, step]);

  const filtered = products.filter(p =>
    (!selCat || p.category.id === selCat) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()))
  );
  const grouped = categories.map(c => ({ ...c, items: filtered.filter(p => p.category.id === c.id) })).filter(c => c.items.length > 0);
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  function addToCart(p: Product) {
    setCart(prev => {
      const ex = prev.find(i => i.productId === p.id);
      return ex ? prev.map(i => i.productId === p.id ? {...i, quantity: i.quantity+1} : i) : [...prev, {productId: p.id, name: p.name, price: p.price, quantity: 1}];
    });
  }
  function removeFromCart(id: string) {
    setCart(prev => prev.map(i => i.productId===id ? {...i, quantity: i.quantity-1} : i).filter(i => i.quantity > 0));
  }
  function getQty(id: string) { return cart.find(i => i.productId===id)?.quantity || 0; }

  async function handleOrder() {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const items = cart.map(i => ({ productId: i.productId, name: i.name, price: i.price, quantity: i.quantity, subtotal: i.price*i.quantity }));
      const r = await fetch('/api/public/qr-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, customerName: name, customerPhone: phone, items }),
      });
      const d = await r.json();
      setOrder(d.data);
      setStep('payment');
    } catch { alert('Gagal, coba lagi'); }
    finally { setSubmitting(false); }
  }

  function handleProofSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const canvas = document.createElement('canvas');
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 900; let w = img.width, h = img.height;
      if (w > MAX) { h = Math.round(h*MAX/w); w = MAX; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      setProofPreview(canvas.toDataURL('image/jpeg', 0.75));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  async function handleUploadProof() {
    if (!proofPreview || !order) return;
    setUploading(true);
    try {
      const r = await fetch('/api/public/qr-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: order.id, action: 'upload_proof', proofB64: proofPreview, payMethod }),
      });
      const d = await r.json();
      if (d.data) { setOrderStatus('PAYMENT_UPLOADED'); setStep('status'); }
      else alert(d.error || 'Gagal upload');
    } catch { alert('Gagal, coba lagi'); }
    finally { setUploading(false); }
  }

  const serif = { fontFamily: "'Playfair Display', Georgia, serif" };
  const sans  = { fontFamily: "'Inter', system-ui, sans-serif" };
  const bg    = '#FAF7F2';
  const cream = '#F2EBE0';
  const dark  = '#1C1C1C';
  const green = '#48654D';
  const muted = '#8A8278';

  // ── LANDING ──────────────────────────────────────────────────────────────
  if (step === 'landing') return (
    <div className="min-h-screen flex flex-col" style={{ background: bg, ...sans }}>
      <FontLoader />
      {/* Header */}
      <div className="px-6 pt-10 pb-6 flex items-start justify-between">
        <div>
          <p className="text-xs tracking-[0.2em] uppercase font-semibold mb-1" style={{ color: muted }}>Selamat Datang di</p>
          <h1 className="text-4xl font-black leading-none tracking-tight" style={{ ...serif, color: dark }}>
            Soeka<br /><em>House</em>
          </h1>
        </div>
        <div className="w-11 h-11 rounded-full flex items-center justify-center mt-1" style={{ background: green }}>
          <span className="text-white font-black text-lg" style={serif}>S</span>
        </div>
      </div>

      {/* Hero strip */}
      <div className="mx-6 rounded-2xl overflow-hidden mb-8" style={{ background: green, minHeight: 160 }}>
        <div className="p-6 h-full flex flex-col justify-between" style={{ minHeight: 160 }}>
          <p className="text-xs tracking-widest uppercase font-semibold" style={{ color: 'rgba(246,237,219,0.7)' }}>Scan & Order</p>
          <div>
            <p className="text-2xl font-black leading-tight" style={{ ...serif, color: '#F6EDDB' }}>
              Pesan langsung<br /><em>dari mejamu.</em>
            </p>
            <p className="text-sm mt-2" style={{ color: 'rgba(246,237,219,0.7)', ...sans }}>Tanpa antri. Tanpa ribet.</p>
          </div>
        </div>
      </div>

      {/* Table input */}
      <div className="px-6 flex-1">
        <p className="text-xs tracking-[0.15em] uppercase font-semibold mb-3" style={{ color: muted }}>Nomor Meja Kamu</p>
        <div className="relative">
          <input
            type="number" value={tableInput}
            onChange={e => setTableInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && tableInput && (setTableId(tableInput), setStep('menu'))}
            placeholder="Contoh: 3"
            className="w-full px-5 py-4 rounded-2xl text-2xl font-black outline-none border-2 transition-all"
            style={{ background: 'white', borderColor: tableInput ? green : '#E8E0D5', color: dark, ...serif }}
          />
        </div>
        <p className="text-xs mt-2" style={{ color: muted, ...sans }}>Lihat nomor meja di atas meja kamu</p>
      </div>

      <div className="px-6 pb-10 pt-6">
        <button
          onClick={() => { if (tableInput) { setTableId(tableInput); setStep('menu'); } }}
          disabled={!tableInput}
          className="w-full py-4 rounded-2xl font-black text-base transition-all disabled:opacity-40"
          style={{ background: dark, color: bg, ...serif, letterSpacing: '-0.01em' }}>
          Lihat Menu →
        </button>
      </div>
    </div>
  );

  // ── MENU ─────────────────────────────────────────────────────────────────
  if (step === 'menu') return (
    <div className="min-h-screen" style={{ background: bg, ...sans }}>
      <FontLoader />
      {/* Sticky header */}
      <div className="sticky top-0 z-30 px-5 pt-4 pb-3" style={{ background: `${bg}F0`, backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-black" style={{ ...serif, color: dark }}>Soeka House</h1>
            <p className="text-xs" style={{ color: muted }}>Meja {tableId}</p>
          </div>
          {cart.length > 0 && (
            <button onClick={() => setStep('info')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full font-semibold text-sm"
              style={{ background: dark, color: bg, ...sans }}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black" style={{ background: green }}>{totalItems}</span>
              {formatCurrency(totalPrice)}
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-2.5">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" fill="none" stroke={muted} strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari menu..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none border"
            style={{ background: 'white', borderColor: '#E8E0D5', color: dark }}/>
        </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {[{ id: '', name: 'Semua' }, ...categories].map(c => (
            <button key={c.id} onClick={() => setSelCat(c.id)}
              className="px-3.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 border transition-all"
              style={selCat === c.id
                ? { background: dark, color: bg, borderColor: dark }
                : { background: 'white', color: muted, borderColor: '#E8E0D5' }}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products */}
      <div className="px-5 pb-32">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: green, borderTopColor: 'transparent' }}/>
          </div>
        ) : grouped.map(cat => (
          <div key={cat.id} className="mb-8">
            {/* Category header */}
            <div className="flex items-baseline gap-3 mb-4 pt-2">
              <h2 className="text-2xl font-black" style={{ ...serif, color: dark }}>{cat.name}</h2>
              <div className="flex-1 h-px" style={{ background: '#E8E0D5' }}/>
              <span className="text-xs" style={{ color: muted }}>{cat.items.length} menu</span>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 gap-3">
              {cat.items.map((p: Product) => {
                const qty = getQty(p.id);
                return (
                  <div key={p.id} className="rounded-2xl overflow-hidden border" style={{ background: 'white', borderColor: '#EDE5D8' }}>
                    {/* Thumbnail */}
                    <div className="h-32 flex items-center justify-center" style={{ background: `${cat.color || green}12` }}>
                      <span className="text-5xl">{p.station === 'FOOD' ? '🍔' : '☕'}</span>
                    </div>
                    {/* Info */}
                    <div className="p-3">
                      <p className="text-sm font-bold leading-snug mb-0.5" style={{ color: dark }}>{p.name}</p>
                      <p className="text-xs font-black mb-3" style={{ color: green }}>{formatCurrency(p.price)}</p>
                      {qty === 0 ? (
                        <button onClick={() => addToCart(p)}
                          className="w-full py-2 rounded-xl text-xs font-bold border-2 transition-all"
                          style={{ borderColor: dark, color: dark, background: 'transparent' }}>
                          + Tambah
                        </button>
                      ) : (
                        <div className="flex items-center justify-between rounded-xl px-2 py-1" style={{ background: cream }}>
                          <button onClick={() => removeFromCart(p.id)}
                            className="w-7 h-7 rounded-full flex items-center justify-center font-black text-base" style={{ background: 'white', color: dark }}>
                            −
                          </button>
                          <span className="font-black text-base" style={{ color: dark }}>{qty}</span>
                          <button onClick={() => addToCart(p)}
                            className="w-7 h-7 rounded-full flex items-center justify-center font-black text-base text-white" style={{ background: dark }}>
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {grouped.length === 0 && !loading && (
          <div className="text-center py-20">
            <p className="text-3xl mb-3">☕</p>
            <p className="font-semibold" style={{ color: muted }}>Menu sedang disiapkan</p>
          </div>
        )}
      </div>

      {/* Cart FAB */}
      {totalItems > 0 && (
        <div className="fixed bottom-6 left-5 right-5 z-40">
          <button onClick={() => setStep('info')}
            className="w-full py-4 px-5 rounded-2xl flex items-center justify-between font-bold shadow-2xl"
            style={{ background: dark, color: bg, boxShadow: '0 8px 40px rgba(28,28,28,0.35)' }}>
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-black" style={{ background: green }}>{totalItems}</span>
              <span style={{ ...serif }}>Lihat Pesanan</span>
            </div>
            <span className="font-black" style={serif}>{formatCurrency(totalPrice)}</span>
          </button>
        </div>
      )}
    </div>
  );

  // ── INFO ──────────────────────────────────────────────────────────────────
  if (step === 'info') return (
    <div className="min-h-screen flex flex-col" style={{ background: bg, ...sans }}>
      <FontLoader />
      <div className="px-5 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => setStep('menu')} className="w-9 h-9 rounded-full border flex items-center justify-center" style={{ borderColor: '#E8E0D5', background: 'white' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={dark} strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 className="text-2xl font-black" style={{ ...serif, color: dark }}>Pesanan Kamu</h1>
      </div>

      {/* Cart items */}
      <div className="px-5 space-y-2 mb-4">
        {cart.map(item => (
          <div key={item.productId} className="flex items-center gap-3 py-3 border-b" style={{ borderColor: '#EDE5D8' }}>
            <div className="flex-1">
              <p className="font-semibold text-sm" style={{ color: dark }}>{item.name}</p>
              <p className="text-xs mt-0.5 font-bold" style={{ color: green }}>{formatCurrency(item.price)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => removeFromCart(item.productId)}
                className="w-7 h-7 rounded-full border flex items-center justify-center font-black" style={{ borderColor: '#E8E0D5' }}>−</button>
              <span className="w-5 text-center font-black text-sm" style={{ color: dark }}>{item.quantity}</span>
              <button onClick={() => addToCart({ id: item.productId, name: item.name, price: item.price, category: { id: '', name: '', color: '' }, station: '' })}
                className="w-7 h-7 rounded-full flex items-center justify-center font-black text-white" style={{ background: dark }}>+</button>
            </div>
            <p className="w-20 text-right font-black text-sm" style={{ color: dark }}>{formatCurrency(item.price * item.quantity)}</p>
          </div>
        ))}
        <div className="flex justify-between items-center pt-2">
          <span className="font-bold" style={{ color: muted }}>Total</span>
          <span className="text-2xl font-black" style={{ ...serif, color: dark }}>{formatCurrency(totalPrice)}</span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 my-2 h-px" style={{ background: '#EDE5D8' }} />

      {/* Customer info */}
      <div className="px-5 pt-4 space-y-3">
        <p className="text-xs tracking-[0.15em] uppercase font-semibold" style={{ color: muted }}>Data Kamu</p>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama *"
          className="w-full px-4 py-3.5 rounded-xl border-2 outline-none text-sm font-medium transition-all"
          style={{ borderColor: name ? dark : '#E8E0D5', background: 'white', color: dark }}/>
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="No HP *"
          className="w-full px-4 py-3.5 rounded-xl border-2 outline-none text-sm font-medium transition-all"
          style={{ borderColor: phone ? dark : '#E8E0D5', background: 'white', color: dark }}/>
        <p className="text-xs" style={{ color: muted }}>Nama & No HP wajib diisi untuk melanjutkan pesanan</p>
      </div>

      <div className="flex-1"/>
      <div className="px-5 pb-8 pt-4">
        <button onClick={handleOrder} disabled={!name.trim() || !phone.trim() || submitting}
          className="w-full py-4 rounded-2xl font-black text-base transition-all disabled:opacity-40"
          style={{ background: dark, color: bg, ...serif }}>
          {submitting ? 'Memproses...' : 'Lanjut ke Pembayaran →'}
        </button>
      </div>
    </div>
  );

  // ── PAYMENT ───────────────────────────────────────────────────────────────
  if (step === 'payment' && order) return (
    <div className="min-h-screen" style={{ background: bg, ...sans }}>
      <FontLoader />
      <div className="px-5 pt-6 pb-4">
        <p className="text-xs tracking-widest uppercase font-semibold mb-1" style={{ color: muted }}>Meja {tableId} · #{order.orderNumber}</p>
        <h1 className="text-3xl font-black" style={{ ...serif, color: dark }}>Bayar<br /><em>Sekarang.</em></h1>
      </div>

      <div className="px-5 space-y-4 pb-10">
        {/* Total + Countdown */}
        <div className="rounded-2xl p-5 flex items-center justify-between" style={{ background: dark }}>
          <div>
            <p className="text-xs tracking-widest uppercase font-semibold mb-1" style={{ color: 'rgba(250,247,242,0.5)' }}>Total Bayar</p>
            <p className="text-3xl font-black" style={{ ...serif, color: bg }}>{formatCurrency(order.total)}</p>
          </div>
          <Countdown expiresAt={order.expiresAt} onExpired={() => { setOrderStatus('CANCELLED'); setStep('status'); }}/>
        </div>

        {/* Payment method selector */}
        <div className="rounded-2xl p-4 border" style={{ background: 'white', borderColor: '#EDE5D8' }}>
          <p className="text-xs tracking-widest uppercase font-semibold mb-3" style={{ color: muted }}>Metode Bayar</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'QRIS', icon: '📱', label: 'QRIS' },
              { id: 'BCA',  icon: '🏦', label: 'Transfer BCA' },
              { id: 'CASH', icon: '💵', label: 'Bayar di Kasir' },
            ] as const).map(m => (
              <button key={m.id} onClick={() => setPayMethod(m.id)}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all"
                style={{
                  borderColor: payMethod === m.id ? dark : '#E8E0D5',
                  background: payMethod === m.id ? dark : 'white',
                }}>
                <span className="text-xl">{m.icon}</span>
                <span className="text-xs font-bold leading-tight text-center"
                  style={{ color: payMethod === m.id ? bg : muted }}>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* QRIS */}
        {payMethod === 'QRIS' && (
          <div className="rounded-2xl p-5 border" style={{ background: 'white', borderColor: '#EDE5D8' }}>
            <p className="text-xs tracking-widest uppercase font-semibold mb-4 text-center" style={{ color: muted }}>Scan QRIS untuk Bayar</p>
            {settings?.qrisImageB64 ? (
              <img src={settings.qrisImageB64} alt="QRIS" className="w-64 h-64 mx-auto rounded-xl object-contain"/>
            ) : (
              <div className="w-64 h-64 mx-auto rounded-xl flex flex-col items-center justify-center gap-3 border-2 border-dashed" style={{ borderColor: '#E8E0D5', background: cream }}>
                <span className="text-5xl">📱</span>
                <p className="text-xs text-center px-6 font-medium" style={{ color: muted }}>QR Code QRIS Soeka House</p>
              </div>
            )}
            {settings?.qrisName && <p className="text-center text-sm font-bold mt-3" style={{ color: green }}>{settings.qrisName}</p>}
          </div>
        )}

        {/* BCA Transfer */}
        {payMethod === 'BCA' && (
          <div className="rounded-2xl p-5 border" style={{ background: 'white', borderColor: '#EDE5D8' }}>
            <p className="text-xs tracking-widest uppercase font-semibold mb-4" style={{ color: muted }}>Transfer BCA</p>
            <div className="rounded-xl p-4 mb-3" style={{ background: cream }}>
              <p className="text-xs font-semibold mb-1" style={{ color: muted }}>No. Rekening</p>
              <p className="text-2xl font-black tracking-widest" style={{ color: dark, ...serif }}>
                {settings?.bcaAccount || '1234567890'}
              </p>
              <p className="text-sm font-semibold mt-1" style={{ color: green }}>
                a/n {settings?.bcaName || 'Soeka House'}
              </p>
            </div>
            <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: '#FEF9C3', borderColor: '#FDE047' }}>
              <span className="text-lg">⚠️</span>
              <p className="text-xs font-medium" style={{ color: '#854D0E' }}>
                Transfer tepat <strong>{formatCurrency(order.total)}</strong> untuk memudahkan verifikasi
              </p>
            </div>
          </div>
        )}

        {/* Cash - langsung ke kasir */}
        {payMethod === 'CASH' && (
          <div className="rounded-2xl p-5 border text-center" style={{ background: 'white', borderColor: '#EDE5D8' }}>
            <span className="text-5xl">🧾</span>
            <p className="text-lg font-black mt-3 mb-1" style={{ ...serif, color: dark }}>Bayar di Kasir</p>
            <p className="text-sm" style={{ color: muted }}>Tunjukkan halaman ini ke kasir dan bayar langsung di counter</p>
            <div className="mt-4 rounded-xl p-3" style={{ background: cream }}>
              <p className="text-xs font-semibold" style={{ color: muted }}>Kode Order</p>
              <p className="text-xl font-black font-mono mt-1" style={{ color: dark }}>#{order.orderNumber}</p>
            </div>
          </div>
        )}

        {/* Upload bukti — untuk QRIS dan BCA */}
        {payMethod !== 'CASH' && (
          <div className="rounded-2xl p-5 border" style={{ background: 'white', borderColor: '#EDE5D8' }}>
            <p className="text-xs tracking-widest uppercase font-semibold mb-4" style={{ color: muted }}>Sudah Bayar? Upload Bukti</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleProofSelect}/>
            {proofPreview ? (
              <div className="space-y-3">
                <div className="relative">
                  <img src={proofPreview} alt="Bukti" className="w-full rounded-xl object-cover max-h-52"/>
                  <button onClick={() => setProofPreview('')}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center text-red-400 font-black text-xs">✕</button>
                </div>
                <button onClick={handleUploadProof} disabled={uploading}
                  className="w-full py-4 rounded-xl font-black text-base disabled:opacity-50 transition-all"
                  style={{ background: green, color: 'white', ...serif }}>
                  {uploading ? 'Mengirim...' : '✓ Kirim Bukti Pembayaran'}
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="w-full py-6 rounded-xl border-2 border-dashed flex flex-col items-center gap-2 transition-all"
                style={{ borderColor: '#D8D0C5', background: cream }}>
                <span className="text-3xl">📎</span>
                <span className="text-sm font-bold" style={{ color: dark }}>Pilih File Bukti Transfer</span>
                <span className="text-xs" style={{ color: muted }}>Screenshot atau foto dari galeri</span>
              </button>
            )}
          </div>
        )}

        {/* Cash — tombol konfirmasi langsung */}
        {payMethod === 'CASH' && (
          <button onClick={async () => {
            setUploading(true);
            try {
              const r = await fetch('/api/public/qr-orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: order.id, action: 'upload_proof', proofB64: null, payMethod: 'CASH' }),
              });
              const d = await r.json();
              if (d.data) { setOrderStatus('PAYMENT_UPLOADED'); setStep('status'); }
            } catch { alert('Gagal, coba lagi'); }
            finally { setUploading(false); }
          }} disabled={uploading}
            className="w-full py-4 rounded-2xl font-black text-base disabled:opacity-50"
            style={{ background: dark, color: bg, ...serif }}>
            {uploading ? 'Memproses...' : '✓ Saya Akan Bayar di Kasir'}
          </button>
        )}
      </div>
    </div>
  );

  // ── STATUS ────────────────────────────────────────────────────────────────
  if (step === 'status') {
    const statusMap: Record<string, { icon: string; headline: string; sub: string }> = {
      PAYMENT_UPLOADED: { icon: '⏳', headline: 'Menunggu\nKonfirmasi.', sub: 'Kasir sedang memverifikasi pembayaran kamu.' },
      CONFIRMED:        { icon: '✅', headline: 'Pesanan\nDikonfirmasi!', sub: 'Pesanan kamu sedang diproses. Ditunggu ya!' },
      CANCELLED:        { icon: '❌', headline: 'Order\nDibatalkan.', sub: 'Waktu habis atau order dibatalkan.' },
    };
    const cfg = statusMap[orderStatus] || statusMap['PAYMENT_UPLOADED'];
    return (
      <div className="min-h-screen flex flex-col px-6" style={{ background: bg, ...sans }}>
        <FontLoader />
        <div className="flex-1 flex flex-col justify-center">
          <span className="text-6xl mb-6">{cfg.icon}</span>
          <h1 className="text-4xl font-black leading-tight mb-3 whitespace-pre-line" style={{ ...serif, color: dark }}>{cfg.headline}</h1>
          <p className="text-base mb-2" style={{ color: muted }}>{cfg.sub}</p>
          {order && <p className="text-xs font-mono mt-1 mb-8" style={{ color: muted }}>#{order.orderNumber} · Meja {tableId}</p>}

          {orderStatus === 'CONFIRMED' && (
            <div className="rounded-2xl p-4 border mb-6" style={{ background: 'white', borderColor: '#EDE5D8' }}>
              {cart.map(i => (
                <div key={i.productId} className="flex justify-between py-2 border-b last:border-0 text-sm" style={{ borderColor: '#EDE5D8' }}>
                  <span style={{ color: dark }}>{i.quantity}× {i.name}</span>
                  <span className="font-bold" style={{ color: green }}>{formatCurrency(i.price*i.quantity)}</span>
                </div>
              ))}
            </div>
          )}

          {orderStatus === 'CONFIRMED' && (
            <button onClick={() => { clearSession(); setStepRaw('menu'); setCartRaw([]); setOrderRaw(null); setOrderStatusRaw(''); setNameRaw(''); setPhoneRaw(''); }}
              className="w-full py-4 rounded-2xl font-black text-base mt-2"
              style={{ background: dark, color: bg, ...serif }}>
              Pesan Lagi →
            </button>
          )}

          {orderStatus === 'CANCELLED' && (
            <button onClick={() => { clearSession(); setStepRaw('menu'); setCartRaw([]); setOrderRaw(null); setOrderStatusRaw(''); setNameRaw(''); setPhoneRaw(''); }}
              className="w-full py-4 rounded-2xl font-black text-base" style={{ background: dark, color: bg, ...serif }}>
              Pesan Ulang →
            </button>
          )}

          {orderStatus === 'CONFIRMED' && (
            <div className="rounded-2xl border overflow-hidden mb-4" style={{ background: 'white', borderColor: '#EDE5D8' }}>
              {/* Receipt header */}
              <div className="px-5 py-4" style={{ background: dark }}>
                <p className="text-xs tracking-widest uppercase font-semibold mb-1" style={{ color: 'rgba(250,247,242,0.5)' }}>Soeka House</p>
                <p className="text-xl font-black" style={{ ...serif, color: bg }}>Struk Pesanan</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(250,247,242,0.5)' }}>#{order?.orderNumber} · Meja {tableId}</p>
              </div>
              {/* Items */}
              <div className="px-5 py-4 space-y-2">
                {cart.map(i => (
                  <div key={i.productId} className="flex justify-between text-sm border-b pb-2 last:border-0" style={{ borderColor: '#EDE5D8' }}>
                    <span style={{ color: dark }}>{i.quantity}× {i.name}</span>
                    <span className="font-bold" style={{ color: green }}>{formatCurrency(i.price*i.quantity)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-1">
                  <span className="font-bold" style={{ color: muted }}>Total</span>
                  <span className="text-xl font-black" style={{ ...serif, color: dark }}>{formatCurrency(totalPrice)}</span>
                </div>
                {name && <p className="text-xs pt-1" style={{ color: muted }}>Pelanggan: {name}</p>}
              </div>
              {/* Download button */}
              <div className="px-5 pb-5">
                <button
                  onClick={() => {
                    // Generate receipt as canvas and download
                    const canvas = document.createElement('canvas');
                    const dpr = 2;
                    canvas.width = 375 * dpr;
                    canvas.height = (280 + cart.length * 40) * dpr;
                    const ctx = canvas.getContext('2d')!;
                    ctx.scale(dpr, dpr);
                    const W = 375, pad = 24;

                    // Background
                    ctx.fillStyle = '#FAF7F2';
                    ctx.fillRect(0, 0, W, canvas.height/dpr);

                    // Header bg
                    ctx.fillStyle = '#1C1C1C';
                    ctx.roundRect(pad, pad, W-pad*2, 90, 16);
                    ctx.fill();

                    // Header text
                    ctx.fillStyle = 'rgba(250,247,242,0.5)';
                    ctx.font = '500 10px Inter, sans-serif';
                    ctx.fillText('SOEKA HOUSE', pad+16, pad+22);
                    ctx.fillStyle = '#FAF7F2';
                    ctx.font = 'bold 22px Georgia, serif';
                    ctx.fillText('Struk Pesanan', pad+16, pad+50);
                    ctx.fillStyle = 'rgba(250,247,242,0.5)';
                    ctx.font = '500 10px Inter, sans-serif';
                    ctx.fillText(`#${order?.orderNumber} · Meja ${tableId}`, pad+16, pad+70);

                    // Items
                    let y = pad + 110;
                    cart.forEach(i => {
                      ctx.fillStyle = '#1C1C1C';
                      ctx.font = '500 13px Inter, sans-serif';
                      ctx.fillText(`${i.quantity}× ${i.name}`, pad, y);
                      ctx.fillStyle = '#48654D';
                      ctx.font = 'bold 13px Inter, sans-serif';
                      const priceW = ctx.measureText(formatCurrency(i.price*i.quantity)).width;
                      ctx.fillText(formatCurrency(i.price*i.quantity), W-pad-priceW, y);
                      ctx.strokeStyle = '#EDE5D8';
                      ctx.beginPath(); ctx.moveTo(pad, y+8); ctx.lineTo(W-pad, y+8); ctx.stroke();
                      y += 36;
                    });

                    // Total
                    ctx.fillStyle = '#8A8278';
                    ctx.font = '600 12px Inter, sans-serif';
                    ctx.fillText('Total', pad, y+20);
                    ctx.fillStyle = '#1C1C1C';
                    ctx.font = 'bold 20px Georgia, serif';
                    const totalW = ctx.measureText(formatCurrency(totalPrice)).width;
                    ctx.fillText(formatCurrency(totalPrice), W-pad-totalW, y+20);

                    // Footer
                    ctx.fillStyle = '#8A8278';
                    ctx.font = '500 10px Inter, sans-serif';
                    ctx.fillText('Terima kasih sudah mampir ke Soeka House ☕', pad, y+50);

                    const link = document.createElement('a');
                    link.download = `struk-soeka-${order?.orderNumber || 'order'}.jpg`;
                    link.href = canvas.toDataURL('image/jpeg', 0.9);
                    link.click();
                  }}
                  className="w-full py-3 rounded-xl border-2 font-bold text-sm transition-all"
                  style={{ borderColor: dark, color: dark, background: 'transparent' }}>
                  ↓ Download Struk (.jpg)
                </button>
              </div>
            </div>
          )}

          {orderStatus === 'PAYMENT_UPLOADED' && (
            <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 border" style={{ borderColor: '#F5D98B', background: '#FFFBEB' }}>
              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse flex-shrink-0"/>
              <p className="text-xs font-medium" style={{ color: '#92620A' }}>Halaman otomatis update saat dikonfirmasi kasir</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export default function MenuPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAF7F2' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#48654D', borderTopColor: 'transparent' }}/>
      </div>
    }>
      <MenuContent />
    </Suspense>
  );
}
