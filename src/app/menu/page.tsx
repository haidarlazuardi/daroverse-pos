'use client';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function formatCurrency(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

type Product = { id: string; name: string; price: number; category: { id: string; name: string; color: string }; station: string };
type CartItem = { productId: string; name: string; price: number; quantity: number };

// ── Countdown ─────────────────────────────────────────────────────────────────
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

  const m = Math.floor(secs / 60);
  const s = secs % 60;
  const pct = Math.min(100, (secs / 600) * 100);
  const urgent = secs < 120;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-28 h-28">
        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
          <circle cx="56" cy="56" r="48" fill="none" stroke="#E5E7EB" strokeWidth="8" />
          <circle cx="56" cy="56" r="48" fill="none"
            stroke={urgent ? '#EF4444' : '#48654D'} strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 48}`}
            strokeDashoffset={`${2 * Math.PI * 48 * (1 - pct / 100)}`}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black tabular-nums" style={{ color: urgent ? '#EF4444' : '#111' }}>
            {String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
          </span>
          <span className="text-xs text-gray-400 font-medium">tersisa</span>
        </div>
      </div>
      {urgent && secs > 0 && (
        <p className="text-xs text-red-500 font-semibold animate-pulse text-center">
          Segera upload bukti pembayaran!
        </p>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function MenuContent() {
  const searchParams = useSearchParams();
  const tableId = searchParams.get('table') || '1';

  const [step, setStep] = useState<'menu'|'info'|'payment'|'status'>('menu');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selCat, setSelCat] = useState('');
  const [search, setSearch] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [orderStatus, setOrderStatus] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/public/menu?table=${tableId}`)
      .then(r => r.json())
      .then(d => { setProducts(d.data?.products || []); setCategories(d.data?.categories || []); setSettings(d.data?.settings); })
      .finally(() => setLoading(false));
  }, [tableId]);

  // Poll order status
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
  const grouped = categories
    .map(c => ({ ...c, items: filtered.filter(p => p.category.id === c.id) }))
    .filter(c => c.items.length > 0);

  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  function addToCart(p: Product) {
    setCart(prev => {
      const ex = prev.find(i => i.productId === p.id);
      if (ex) return prev.map(i => i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { productId: p.id, name: p.name, price: p.price, quantity: 1 }];
    });
  }
  function removeFromCart(id: string) {
    setCart(prev => prev.map(i => i.productId === id ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0));
  }
  function getQty(id: string) { return cart.find(i => i.productId === id)?.quantity || 0; }

  async function handleOrder() {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const items = cart.map(i => ({ productId: i.productId, name: i.name, price: i.price, quantity: i.quantity, subtotal: i.price * i.quantity }));
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
    // Compress image
    const canvas = document.createElement('canvas');
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      const b64 = canvas.toDataURL('image/jpeg', 0.7);
      setProofPreview(b64);
      setProofFile(file);
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
        body: JSON.stringify({ id: order.id, action: 'upload_proof', proofB64: proofPreview }),
      });
      const d = await r.json();
      if (d.data) { setOrderStatus('PAYMENT_UPLOADED'); setStep('status'); }
      else alert(d.error || 'Gagal upload');
    } catch { alert('Gagal, coba lagi'); }
    finally { setUploading(false); }
  }

  // ── MENU SCREEN ────────────────────────────────────────────────────────────
  if (step === 'menu') return (
    <div className="min-h-screen bg-[#F6EDDB]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#F6EDDB]/95 backdrop-blur-sm pb-2">
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-xl font-black tracking-tight text-[#2D4A32]">Soeka House</h1>
              <p className="text-xs text-[#7A9A7E]">Meja {tableId} · Scan & Order</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-[#48654D] flex items-center justify-center">
              <span className="text-white font-black text-base">S</span>
            </div>
          </div>
          {/* Search */}
          <div className="relative mt-3">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CAF9E]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari menu..."
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-white/80 text-sm outline-none border border-[#E8DFD0] focus:border-[#48654D] transition-colors placeholder:text-[#BDBDBD]" />
          </div>
          {/* Category tabs */}
          <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-none pb-1">
            <button onClick={() => setSelCat('')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${!selCat ? 'bg-[#48654D] text-white shadow-sm' : 'bg-white/80 text-[#48654D] border border-[#E8DFD0]'}`}>
              Semua
            </button>
            {categories.map(c => (
              <button key={c.id} onClick={() => setSelCat(selCat === c.id ? '' : c.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${selCat === c.id ? 'text-white shadow-sm' : 'bg-white/80 text-gray-600 border border-[#E8DFD0]'}`}
                style={selCat === c.id ? { background: c.color || '#48654D' } : {}}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="px-4 pb-40">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-3 border-[#48654D] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : grouped.map(cat => (
          <div key={cat.id} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full" style={{ background: cat.color || '#48654D' }} />
              <h2 className="text-sm font-black uppercase tracking-widest text-[#48654D]">{cat.name}</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {cat.items.map((p: Product) => {
                const qty = getQty(p.id);
                return (
                  <div key={p.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#F0E8D8] active:scale-[0.97] transition-transform">
                    {/* Image placeholder */}
                    <div className="h-28 flex items-center justify-center text-4xl"
                      style={{ background: `${cat.color || '#48654D'}18` }}>
                      {p.station === 'FOOD' ? '🍔' : '☕'}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-bold text-[#1A1A1A] leading-tight mb-1">{p.name}</p>
                      <p className="text-xs font-black text-[#48654D] mb-2.5">{formatCurrency(p.price)}</p>
                      {qty === 0 ? (
                        <button onClick={() => addToCart(p)}
                          className="w-full py-2 rounded-xl bg-[#48654D] text-white text-xs font-bold active:bg-[#3a5040] transition-colors">
                          + Tambah
                        </button>
                      ) : (
                        <div className="flex items-center justify-between bg-[#F0F7F1] rounded-xl px-2 py-1.5">
                          <button onClick={() => removeFromCart(p.id)}
                            className="w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center text-[#48654D] font-black text-base active:bg-gray-100">
                            −
                          </button>
                          <span className="font-black text-[#48654D] text-base">{qty}</span>
                          <button onClick={() => addToCart(p)}
                            className="w-7 h-7 rounded-full bg-[#48654D] shadow-sm flex items-center justify-center text-white font-black text-base active:bg-[#3a5040]">
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
      </div>

      {/* Cart FAB */}
      {totalItems > 0 && (
        <div className="fixed bottom-6 left-4 right-4 z-40">
          <button onClick={() => setStep('info')}
            className="w-full bg-[#48654D] text-white rounded-2xl py-4 px-5 flex items-center justify-between shadow-xl active:bg-[#3a5040] transition-colors"
            style={{ boxShadow: '0 8px 32px rgba(72,101,77,0.4)' }}>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center">
                <span className="font-black text-sm">{totalItems}</span>
              </div>
              <span className="font-bold text-sm">Lihat Pesanan</span>
            </div>
            <span className="font-black">{formatCurrency(totalPrice)}</span>
          </button>
        </div>
      )}
    </div>
  );

  // ── INFO SCREEN ────────────────────────────────────────────────────────────
  if (step === 'info') return (
    <div className="min-h-screen bg-[#F6EDDB] flex flex-col">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => setStep('menu')} className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center active:bg-gray-100">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#48654D" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 className="text-lg font-black text-[#2D4A32]">Detail Pesanan</h1>
      </div>

      {/* Cart items */}
      <div className="px-4 mb-6 space-y-2">
        {cart.map(item => (
          <div key={item.productId} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
            <div className="flex-1">
              <p className="text-sm font-bold text-[#1A1A1A]">{item.name}</p>
              <p className="text-xs font-semibold text-[#48654D]">{formatCurrency(item.price)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => removeFromCart(item.productId)}
                className="w-7 h-7 rounded-full bg-[#F0F7F1] flex items-center justify-center text-[#48654D] font-black">−</button>
              <span className="w-6 text-center font-black text-[#1A1A1A]">{item.quantity}</span>
              <button onClick={() => addToCart({ id: item.productId, name: item.name, price: item.price, category: { id: '', name: '', color: '' }, station: '' })}
                className="w-7 h-7 rounded-full bg-[#48654D] flex items-center justify-center text-white font-black">+</button>
            </div>
            <p className="text-sm font-black text-[#48654D] w-20 text-right">{formatCurrency(item.price * item.quantity)}</p>
          </div>
        ))}
        <div className="bg-[#48654D] rounded-2xl px-4 py-3 flex justify-between items-center">
          <span className="text-white font-bold">Total</span>
          <span className="text-white font-black text-lg">{formatCurrency(totalPrice)}</span>
        </div>
      </div>

      {/* Customer info */}
      <div className="px-4 space-y-3">
        <p className="text-sm font-black text-[#2D4A32] uppercase tracking-wide">Data Kamu</p>
        <div>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Nama *"
            className="w-full px-4 py-3.5 rounded-2xl bg-white border border-[#E8DFD0] text-sm font-medium outline-none focus:border-[#48654D] transition-colors placeholder:text-[#BDBDBD]" />
        </div>
        <div>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="No HP (opsional · untuk loyalty poin)"
            className="w-full px-4 py-3.5 rounded-2xl bg-white border border-[#E8DFD0] text-sm font-medium outline-none focus:border-[#48654D] transition-colors placeholder:text-[#BDBDBD]" />
        </div>
        <p className="text-xs text-[#9CAF9E]">No HP dipakai untuk program loyalty Soeka House</p>
      </div>

      <div className="flex-1" />

      <div className="px-4 pb-8 pt-4">
        <button onClick={handleOrder} disabled={!name.trim() || submitting}
          className="w-full bg-[#48654D] text-white rounded-2xl py-4 font-black text-base disabled:opacity-50 active:bg-[#3a5040] transition-all"
          style={{ boxShadow: '0 8px 32px rgba(72,101,77,0.35)' }}>
          {submitting ? 'Memproses...' : 'Lanjut ke Pembayaran →'}
        </button>
      </div>
    </div>
  );

  // ── PAYMENT SCREEN ────────────────────────────────────────────────────────
  if (step === 'payment' && order) return (
    <div className="min-h-screen bg-[#F6EDDB] flex flex-col">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-xl font-black text-[#2D4A32]">Bayar Sekarang</h1>
        <p className="text-sm text-[#7A9A7E] mt-0.5">Order #{order.orderNumber} · Meja {tableId}</p>
      </div>

      <div className="px-4 pt-2 pb-6 flex flex-col gap-5">
        {/* Countdown */}
        <div className="bg-white rounded-3xl p-5 flex flex-col items-center shadow-sm border border-[#F0E8D8]">
          <p className="text-xs font-black uppercase tracking-widest text-[#9CAF9E] mb-3">Batas Waktu Pembayaran</p>
          <Countdown expiresAt={order.expiresAt} onExpired={() => { setOrderStatus('CANCELLED'); setStep('status'); }} />
        </div>

        {/* Total */}
        <div className="bg-[#48654D] rounded-3xl px-5 py-4 flex justify-between items-center">
          <span className="text-white/80 text-sm font-medium">Total Bayar</span>
          <span className="text-white font-black text-2xl">{formatCurrency(order.total)}</span>
        </div>

        {/* QRIS */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#F0E8D8]">
          <p className="text-xs font-black uppercase tracking-widest text-[#9CAF9E] mb-4 text-center">Scan QRIS untuk Bayar</p>
          {settings?.qrisImageB64 ? (
            <img src={settings.qrisImageB64} alt="QRIS" className="w-56 h-56 mx-auto rounded-2xl object-contain" />
          ) : (
            <div className="w-56 h-56 mx-auto rounded-2xl bg-[#F6EDDB] border-2 border-dashed border-[#C8D9C9] flex flex-col items-center justify-center gap-2">
              <span className="text-4xl">📱</span>
              <p className="text-xs text-center text-[#9CAF9E] font-medium px-4">QR Code QRIS akan ditampilkan di sini</p>
            </div>
          )}
          {settings?.qrisName && (
            <p className="text-center text-xs text-[#48654D] font-semibold mt-3">{settings.qrisName}</p>
          )}
        </div>

        {/* Upload proof */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#F0E8D8]">
          <p className="text-xs font-black uppercase tracking-widest text-[#9CAF9E] mb-4">Upload Bukti Pembayaran</p>
          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            className="hidden" onChange={handleProofSelect} />

          {proofPreview ? (
            <div className="space-y-3">
              <div className="relative">
                <img src={proofPreview} alt="Bukti" className="w-full rounded-2xl object-cover max-h-48" />
                <button onClick={() => { setProofPreview(''); setProofFile(null); }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white shadow flex items-center justify-center text-red-400 font-black text-sm">✕</button>
              </div>
              <button onClick={handleUploadProof} disabled={uploading}
                className="w-full py-4 rounded-2xl bg-[#48654D] text-white font-black text-base disabled:opacity-60 active:bg-[#3a5040] transition-all"
                style={{ boxShadow: '0 6px 24px rgba(72,101,77,0.3)' }}>
                {uploading ? 'Mengirim...' : '✓ Konfirmasi Pembayaran'}
              </button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()}
              className="w-full py-5 rounded-2xl border-2 border-dashed border-[#C8D9C9] bg-[#F6EDDB] flex flex-col items-center gap-2 active:bg-[#EDE5D5] transition-colors">
              <span className="text-3xl">📷</span>
              <span className="text-sm font-bold text-[#48654D]">Foto / Upload Bukti Transfer</span>
              <span className="text-xs text-[#9CAF9E]">JPG atau PNG, maks 5MB</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // ── STATUS SCREEN ─────────────────────────────────────────────────────────
  if (step === 'status') {
    const statusConfig: Record<string, { icon: string; title: string; sub: string; color: string }> = {
      PAYMENT_UPLOADED: { icon: '⏳', title: 'Menunggu Konfirmasi', sub: 'Kasir sedang memverifikasi pembayaran kamu', color: '#F59E0B' },
      CONFIRMED: { icon: '✅', title: 'Pesanan Dikonfirmasi!', sub: 'Pesanan kamu sedang diproses. Ditunggu ya!', color: '#48654D' },
      CANCELLED: { icon: '❌', title: 'Order Dibatalkan', sub: 'Waktu pembayaran habis atau order dibatalkan', color: '#EF4444' },
    };
    const cfg = statusConfig[orderStatus] || statusConfig['PAYMENT_UPLOADED'];

    return (
      <div className="min-h-screen bg-[#F6EDDB] flex flex-col items-center justify-center px-6 text-center">
        <div className="text-7xl mb-6">{cfg.icon}</div>
        <h1 className="text-2xl font-black text-[#2D4A32] mb-2">{cfg.title}</h1>
        <p className="text-[#7A9A7E] text-sm mb-2">{cfg.sub}</p>
        {order && <p className="text-xs text-[#9CAF9E] font-mono mb-8">#{order.orderNumber}</p>}

        {orderStatus === 'CONFIRMED' && (
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-sm border border-[#F0E8D8] mb-6">
            <p className="text-xs font-black uppercase tracking-widest text-[#9CAF9E] mb-3">Pesanan Kamu</p>
            {cart.map(i => (
              <div key={i.productId} className="flex justify-between py-1.5 border-b border-[#F0E8D8] last:border-0">
                <span className="text-sm text-[#1A1A1A]">{i.quantity}× {i.name}</span>
                <span className="text-sm font-bold text-[#48654D]">{formatCurrency(i.price * i.quantity)}</span>
              </div>
            ))}
          </div>
        )}

        {orderStatus === 'CANCELLED' && (
          <button onClick={() => { setStep('menu'); setCart([]); setOrder(null); setOrderStatus(''); }}
            className="w-full max-w-sm py-4 rounded-2xl bg-[#48654D] text-white font-black">
            Pesan Ulang
          </button>
        )}

        {orderStatus === 'PAYMENT_UPLOADED' && (
          <div className="flex gap-2 items-center bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <p className="text-xs text-amber-700 font-medium">Halaman ini otomatis update saat dikonfirmasi</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default function MenuPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F6EDDB] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#48654D] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <MenuContent />
    </Suspense>
  );
}
