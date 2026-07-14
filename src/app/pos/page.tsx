'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useCartStore, CartLine, SelectedModifier, lineUnitPrice } from '@/store';
import { api } from '@/lib/fetch';
import { formatCurrency, Modal, Button, Input } from '@/components/ui';
import clsx from 'clsx';

interface ModOption {
  id: string; name: string; effect: 'ADJUST' | 'ADD';
  targetIngredientId: string | null; multiplier: number | null; addQty: number | null;
  priceDelta: number; isDefault: boolean;
}
interface ModGroup { id: string; name: string; selectionType: 'SINGLE' | 'MULTI'; options: ModOption[] }
interface RecipeItem { ingredientId: string; quantity: number }
interface Product {
  id: string; name: string; price: number; categoryId: string; station: 'FOOD' | 'DRINK';
  takeawayCharge: number; category: { id: string; name: string; color: string };
  modifierGroups: ModGroup[]; recipe?: { items: RecipeItem[] };
}
interface Category { id: string; name: string; color: string }
interface DiscountPreset { id: string; name: string; type: 'PERCENT' | 'FIXED'; value: number }
interface Settings { tax_rate?: string; service_rate?: string; loyalty_redeem_value?: string }
type Step = 'cart' | 'payment' | 'receipt';

const STATION_LOC: Record<string, string> = { FOOD: 'KITCHEN', DRINK: 'BAR' };

const toSelected = (g: ModGroup, o: ModOption): SelectedModifier => ({
  groupName: g.name, optionName: o.name, effect: o.effect,
  targetIngredientId: o.targetIngredientId, multiplier: o.multiplier, addQty: o.addQty, priceDelta: o.priceDelta,
});
function defaultModifiers(product: Product): SelectedModifier[] {
  const out: SelectedModifier[] = [];
  for (const g of product.modifierGroups || []) {
    if (g.selectionType === 'SINGLE') {
      const opt = g.options.find((o) => o.isDefault) || g.options[0];
      if (opt) out.push(toSelected(g, opt));
    } else { for (const o of g.options) if (o.isDefault) out.push(toSelected(g, o)); }
  }
  return out;
}

// ── CustomerSearch — autocomplete dengan nama atau HP ──────────────────────
function CustomerSearch({ phone, name, onSelect, onClear, onNew }: {
  phone: string; name: string;
  onSelect: (c: any) => void;
  onClear: () => void;
  onNew: (name: string, phone: string) => void;
}) {
  const [q, setQ]             = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const hasCustomer = !!phone || !!name;

  useEffect(() => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.get<any>(`/api/customers?search=${encodeURIComponent(q)}&limit=5`);
        setResults(res.customers || res || []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  function handleSaveNew() {
    if (!newName.trim()) return;
    onNew(newName.trim(), newPhone.trim());
    setShowNew(false); setQ(''); setResults([]);
  }

  if (hasCustomer) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">{name || 'Pelanggan'}</p>
          {phone && <p className="text-xs text-gray-400">{phone}</p>}
        </div>
        <button onClick={onClear} className="text-xs text-gray-400 hover:text-red-500 px-2 py-1">✕ Ganti</button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={q} onChange={e => setQ(e.target.value)}
        placeholder="Cari pelanggan (nama / HP)..."
        className="input text-sm w-full"
      />
      {searching && <p className="text-xs text-gray-400 mt-1">Mencari...</p>}

      {/* Dropdown results */}
      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
          {results.map((c: any) => (
            <button key={c.id} onClick={() => { onSelect(c); setQ(''); setResults([]); }}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 text-left">
              <div>
                <p className="text-sm font-semibold">{c.name}</p>
                <p className="text-xs text-gray-400">{c.phone || 'No HP'}</p>
              </div>
              <span className="text-xs font-bold text-amber-600">{c.points || 0} poin</span>
            </button>
          ))}
          <button onClick={() => { setShowNew(true); setResults([]); }}
            className="w-full px-3 py-2 text-xs text-center font-medium text-brand-600 hover:bg-brand-50">
            + Daftarkan pelanggan baru
          </button>
        </div>
      )}

      {/* No results + new button */}
      {q.length >= 2 && results.length === 0 && !searching && (
        <div className="mt-1 border border-gray-200 rounded-xl p-2 bg-gray-50">
          <p className="text-xs text-gray-400 text-center mb-1.5">Tidak ditemukan</p>
          <button onClick={() => { setShowNew(true); setNewName(q); }}
            className="w-full py-1.5 text-xs font-semibold rounded-lg text-white" style={{ background: 'var(--brand)' }}>
            + Daftarkan "{q}" sebagai pelanggan baru
          </button>
        </div>
      )}

      {/* New customer form */}
      {showNew && (
        <div className="mt-2 p-3 border border-brand-200 rounded-xl bg-brand-50 space-y-2">
          <p className="text-xs font-bold text-brand-700">Pelanggan Baru</p>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Nama *" className="input text-sm" />
          <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)}
            placeholder="No HP (opsional, untuk loyalty)" className="input text-sm" />
          <div className="flex gap-2">
            <button onClick={() => setShowNew(false)} className="flex-1 py-1.5 text-xs rounded-lg bg-white border border-gray-200 text-gray-500">Batal</button>
            <button onClick={handleSaveNew} disabled={!newName.trim()}
              className="flex-1 py-1.5 text-xs rounded-lg text-white font-semibold disabled:opacity-50" style={{ background: 'var(--brand)' }}>
              Simpan & Lanjut
            </button>
          </div>
        </div>
      )}

      {/* Skip button */}
      {!showNew && (
        <button onClick={() => onNew('Guest', '')} className="mt-1.5 w-full text-xs text-gray-400 hover:text-gray-600 py-1">
          Lewati (transaksi tanpa data pelanggan)
        </button>
      )}
    </div>
  );
}

export default function POSPage() {
  const router = useRouter();
  const { user, hydrate, logout } = useAuthStore();
  const cart = useCartStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [discounts, setDiscounts] = useState<DiscountPreset[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, Record<string, number>>>({});
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('cart');
  const [payMethod, setPayMethod] = useState<'CASH' | 'QRIS' | 'CARD'>('CASH');
  const [cashReceived, setCashReceived] = useState('');
  const [payRef, setPayRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [showCart, setShowCart] = useState(false);
  const [rightTab, setRightTab] = useState<'cart'|'queue'>('cart');
  const [queueOrders, setQueueOrders] = useState<any[]>([]);
  const [queueCount, setQueueCount] = useState(0);

  // Poll active orders for queue
  useEffect(() => {
    async function loadQueue() {
      try {
        const res = await api.get<any>('/api/orders?status=OPEN&queue=true&limit=20');
        const orders = res.orders || [];
        setQueueOrders(orders);
        setQueueCount(orders.length);
      } catch { /* silent */ }
    }
    loadQueue();
    const t = setInterval(loadQueue, 30000);
    return () => clearInterval(t);
  }, []);
  const [selectedDiscount, setSelectedDiscount] = useState('');
  const [editLine, setEditLine] = useState<CartLine | null>(null);
  const [config, setConfig] = useState<{ product: Product; modifiers: SelectedModifier[] } | null>(null);
  const [showBills, setShowBills] = useState(false);
  const [openBills, setOpenBills] = useState<any[]>([]);
  const [activeBill, setActiveBill] = useState<{ id: string; name: string } | null>(null);
  const [billModal, setBillModal] = useState(false);
  const [billName, setBillName] = useState('');
  const [showShift, setShowShift] = useState(false);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [loy, setLoy] = useState<{ name: string; points: number; rewards?: any[] } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => {
    if (!user) { const t = setTimeout(() => { if (!useAuthStore.getState().user) router.replace('/login'); }, 500); return () => clearTimeout(t); }
  }, [user, router]);

  const loadData = useCallback(async () => {
    try {
      const [prods, cats, discs, settings, ings] = await Promise.all([
        api.get<Product[]>('/api/products?active=true'),
        api.get<Category[]>('/api/categories'),
        api.get<DiscountPreset[]>('/api/discounts'),
        api.get<Settings>('/api/settings').catch(() => ({} as Settings)),
        api.get<any[]>('/api/ingredients').catch(() => []),
      ]);
      setProducts(prods); setCategories(cats); setDiscounts(discs);
      const map: Record<string, Record<string, number>> = {};
      for (const ing of ings) {
        map[ing.id] = {};
        for (const sl of ing.stockLevels || []) map[ing.id][sl.location] = sl.quantity;
      }
      setStockMap(map);
      cart.setRates(
        parseFloat(settings.tax_rate || '0.1') || 0.1,
        parseFloat(settings.service_rate || '0.05') || 0.05,
        parseFloat(settings.loyalty_redeem_value || '100') || 100,
      );
      try { const shifts = await api.get<any[]>('/api/shifts?active=true'); if (shifts.length > 0) setActiveShift(shifts[0]); } catch {}
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (user) loadData(); }, [user, loadData]);

  useEffect(() => {
    if (!selectedDiscount) { cart.setDiscount(0, null, null); return; }
    const d = discounts.find((x) => x.id === selectedDiscount);
    if (!d) return;
    const sub = cart.subtotal();
    const amt = d.type === 'PERCENT' ? sub * (d.value / 100) : Math.min(d.value, sub);
    cart.setDiscount(Math.round(amt), d.id, d.name);
  }, [selectedDiscount, discounts, cart.lines]);

  // How many of this product can we make right now (base recipe vs stock at its station)?
  const maxMakeable = (p: Product): number => {
    if (!p.recipe || !p.recipe.items.length) return Infinity;
    const loc = STATION_LOC[p.station] || 'BAR';
    let m = Infinity;
    for (const it of p.recipe.items) {
      if (it.quantity <= 0) continue;
      const have = stockMap[it.ingredientId]?.[loc] ?? 0;
      m = Math.min(m, Math.floor(have / it.quantity));
    }
    return m;
  };

  const filtered = products.filter((p) => {
    if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const addProduct = (p: Product) => {
    if (p.modifierGroups?.length) setConfig({ product: p, modifiers: defaultModifiers(p) });
    else cart.addLine({ productId: p.id, name: p.name, basePrice: p.price, station: p.station, takeawayCharge: p.takeawayCharge, modifiers: [] });
  };

  const orderItemsPayload = () =>
    cart.lines.map((l) => ({
      productId: l.productId, quantity: l.quantity, notes: l.notes,
      modifiers: l.modifiers.map((m) => ({ groupName: m.groupName, optionName: m.optionName, effect: m.effect, targetIngredientId: m.targetIngredientId, multiplier: m.multiplier, addQty: m.addQty, priceDelta: m.priceDelta })),
    }));

  const commonBody = () => ({
    items: orderItemsPayload(), notes: cart.notes || undefined, orderType: cart.orderType,
    taxEnabled: cart.taxEnabled, serviceEnabled: cart.serviceEnabled,
    discountId: cart.discountId || undefined, redeemPoints: cart.redeemPoints || 0,
    customerName: custName || undefined, customerPhone: custPhone || undefined,
  });

  const handleCheckout = async () => {
    if (cart.lines.length === 0) return;
    setSubmitting(true);
    try {
      const received = payMethod === 'CASH' ? parseFloat(cashReceived) || cart.total() : cart.total();
      let order;
      if (activeBill) {
        // Tutup open bill yang sudah ada
        await api.patch<any>('/api/orders', {
          orderId: activeBill.id, action: 'complete',
          paymentMethod: payMethod, paymentReference: payRef || undefined,
          received, taxEnabled: cart.taxEnabled, serviceEnabled: cart.serviceEnabled,
        });
        // Fetch order lengkap untuk struk
        order = await api.get<any>(`/api/orders?id=${activeBill.id}`);
      } else {
        order = await api.post('/api/orders', { ...commonBody(), open: false, paymentMethod: payMethod, paymentReference: payRef || undefined, received });
      }
      setLastOrder(order); setStep('receipt'); cart.clear(); setActiveBill(null); setSelectedDiscount(''); loadData();
    } catch (e: any) { alert(e.message || 'Checkout gagal'); }
    finally { setSubmitting(false); }
  };

  const confirmSaveBill = async () => {
    if (cart.lines.length === 0) return;
    try {
      await api.post('/api/orders', { ...commonBody(), open: true, billName: billName || 'Bill' });
      cart.clear(); setSelectedDiscount(''); setBillModal(false); setBillName(''); loadData();
    } catch (e: any) { alert(e.message || 'Gagal'); }
  };

  const addToBill = async () => {
    if (!activeBill || cart.lines.length === 0) return;
    try {
      await api.patch('/api/orders', { orderId: activeBill.id, action: 'addItems', items: orderItemsPayload() });
      cart.clear(); setActiveBill(null); loadData();
    } catch (e: any) { alert(e.message || 'Gagal'); }
  };

  const loadBills = async () => {
    try { const data = await api.get<any>('/api/orders?status=OPEN&limit=30'); setOpenBills(data.orders || []); setShowBills(true); } catch (e) { console.error(e); }
  };
  const startAddingToBill = (bill: any) => { cart.clear(); setActiveBill({ id: bill.id, name: bill.billName || bill.orderNumber }); setShowBills(false); };
  const closeBill = async (bill: any) => {
    // Load item dari open bill ke cart, lalu buka payment screen
    try {
      const order = await api.get<any>(`/api/orders?id=${bill.id}`);
      cart.clear();
      // Rebuild cart dari order items
      for (const item of order.items || []) {
        const lineData = {
          productId: item.productId,
          name: item.product?.name || item.name || '',
          basePrice: item.unitPrice,
          station: item.product?.station || 'DRINK',
          takeawayCharge: item.product?.takeawayCharge || 0,
          modifiers: (item.modifiers || []).map((m: any) => ({
            groupName: m.groupName, optionName: m.optionName,
            effect: m.effect, priceDelta: m.priceDelta,
            targetIngredientId: m.targetIngredientId,
            multiplier: m.multiplier, addQty: m.addQty,
          })),
        };
        for (let q = 0; q < (item.quantity || 1); q++) {
          cart.addLine(lineData);
        }
      }
      setActiveBill({ id: bill.id, name: bill.billName || bill.orderNumber });
      setShowBills(false);
      setStep('payment');
      setShowCart(true);
    } catch (e: any) { alert(e?.message || 'Gagal load bill'); }
  };

  const lookupCustomer = async () => {
    if (!custPhone) return;
    try {
      const r = await api.get<any>(`/api/customers?phone=${encodeURIComponent(custPhone)}`);
      if (r.found) { setLoy({ name: r.customer.name, points: r.customer.points }); if (r.customer.name) setCustName(r.customer.name); }
      else setLoy({ name: '', points: 0 });
    } catch (e) { console.error(e); }
  };

  const openShift = async () => { try { await api.post('/api/shifts', { action: 'open', openingCash: openingCash || '0' }); setOpeningCash(''); loadData(); setShowShift(false); } catch (e: any) { alert(e.message || 'Gagal'); } };
  const closeShift = async () => { if (!activeShift) return; try { const r = await api.post<any>('/api/shifts', { action: 'close', shiftId: activeShift.id, closingCash: closingCash || '0' }); setActiveShift(null); setClosingCash(''); setShowShift(false); alert(`Shift ditutup. Selisih: ${formatCurrency(r.difference || 0)}`); } catch (e: any) { alert(e.message || 'Gagal'); } };

  const receiptLines = (o: any) => [
    '🧾 *Soeka House*', '', `Order: ${o.orderNumber}`, `Tanggal: ${new Date(o.createdAt).toLocaleString('id-ID')}`,
    custName ? `Pelanggan: ${custName}` : '', '',
    ...(o.items || []).map((i: any) => `• ${i.product?.name || 'Item'} x${i.quantity} = ${formatCurrency(i.subtotal)}`), '',
    `Subtotal: ${formatCurrency(o.subtotal)}`,
    o.discount > 0 ? `Diskon: -${formatCurrency(o.discount)}` : '',
    o.tax > 0 ? `Pajak: ${formatCurrency(o.tax)}` : '',
    o.serviceCharge > 0 ? `Service: ${formatCurrency(o.serviceCharge)}` : '',
    o.takeawayCharge > 0 ? `Take-away: ${formatCurrency(o.takeawayCharge)}` : '',
    `*Total: ${formatCurrency(o.total)}*`, '', `Bayar: ${o.payment?.method || '-'}`,
    '',
    o.pointsEarned > 0 ? `⭐ +${o.pointsEarned} poin didapat` : '',
    loy && loy.points > 0 ? `💎 Total poin kamu: ${loy.points + (o.pointsEarned || 0)} poin` : '',
    custPhone ? `Cek poin: ${typeof window !== 'undefined' ? window.location.origin : ''}/cek-poin` : '',
    '', 'Terima kasih! 🙏',
  ].filter(Boolean);

  const sendWhatsApp = () => {
    if (!lastOrder || !custPhone) { alert('Isi nomor HP pelanggan'); return; }
    const phone = custPhone.startsWith('0') ? '62' + custPhone.slice(1) : custPhone.startsWith('+') ? custPhone.slice(1) : custPhone;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(receiptLines(lastOrder).join('\n'))}`, '_blank');
  };

  const printReceipt = () => {
    if (!lastOrder) return;
    const w = window.open('', '_blank', 'width=300,height=600'); if (!w) return;
    const o = lastOrder;
    const items = (o.items || []).map((i: any) => `<tr><td>${i.product?.name || ''} x${i.quantity}</td><td class="r">${formatCurrency(i.subtotal)}</td></tr>`).join('');
    const row = (l: string, v: number) => v > 0 ? `<tr><td>${l}</td><td class="r">${formatCurrency(v)}</td></tr>` : '';
    const newPoinTotal = loy ? loy.points + (o.pointsEarned || 0) : (o.pointsEarned || 0);
    const pointsBlock = (custName || o.pointsEarned > 0) ? `
      <div class="line"></div>
      ${custName ? `<p class="c" style="font-size:11px">Pelanggan: <b>${custName}</b></p>` : ''}
      ${o.pointsEarned > 0 ? `<p class="c" style="font-size:11px">+ ${o.pointsEarned} poin didapat</p>` : ''}
      ${newPoinTotal > 0 ? `<p class="c" style="font-size:13px;font-weight:bold">Total poin: ${newPoinTotal.toLocaleString('id-ID')} &#11088;</p>` : ''}
      ${custPhone ? '<p class="c" style="font-size:10px;color:#888">Cek poin: daroverse-pos.vercel.app/cek-poin</p>' : ''}
    ` : '';
    const html = `<html><head><title>Struk</title><style>body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:10px}table{width:100%;border-collapse:collapse}td{padding:2px 0}.line{border-top:1px dashed #000;margin:6px 0}.c{text-align:center}.r{text-align:right}</style></head><body>
      <h3 class="c" style="margin:4px 0">Soeka House</h3>
      <p class="c">${o.orderNumber}<br>${new Date(o.createdAt).toLocaleString('id-ID')}</p>
      <div class="line"></div>
      <table>${items}</table>
      <div class="line"></div>
      <table>
        ${row('Subtotal', o.subtotal)}
        ${o.discount > 0 ? `<tr><td>Diskon</td><td class="r">-${formatCurrency(o.discount)}</td></tr>` : ''}
        ${row('Pajak', o.tax)}
        ${row('Service', o.serviceCharge)}
        ${row('Take-away', o.takeawayCharge)}
        <tr><td><b>TOTAL</b></td><td class="r"><b>${formatCurrency(o.total)}</b></td></tr>
        ${o.payment ? `<tr><td>${o.payment.method}</td><td class="r">${formatCurrency(o.payment.received)}</td></tr>${o.payment.change > 0 ? `<tr><td>Kembali</td><td class="r">${formatCurrency(o.payment.change)}</td></tr>` : ''}` : ''}
      </table>
      ${pointsBlock}
      <div class="line"></div>
      <p class="c">Terima kasih! &#128591;</p>
      <script>window.print();</script>
    </body></html>`;
    w.document.write(html);
    w.document.close();
  };

  const resetCheckout = () => { setStep('cart'); setPayMethod('CASH'); setCashReceived(''); setPayRef(''); setLastOrder(null); setShowCart(false); setCustName(''); setCustPhone(''); setLoy(null); cart.setRedeemPoints(0); };

  if (!user) return null;

  return (
    <div className="pos-grid bg-gray-50">
      {/* LEFT: products */}
      <div className="flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-2 flex-shrink-0">
          {user.role === 'SUPER_ADMIN' && (
            <button onClick={() => router.push('/dashboard')} className="btn btn-sm btn-ghost" title="Dashboard">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
          )}
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input ref={searchRef} type="text" placeholder="Cari menu..." value={search} onChange={(e) => setSearch(e.target.value)} className="filter-input pl-9" />
          </div>
          <button onClick={() => router.push('/staff')} className="btn btn-sm btn-ghost" title="Layar staff">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7h-9M14 17H5M17 3a4 4 0 100 8 4 4 0 000-8zM7 13a4 4 0 100 8 4 4 0 000-8z" /></svg>
          </button>
          <button onClick={loadBills} className="btn btn-sm btn-ghost text-amber-600" title="Bill terbuka">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
          </button>
          <button onClick={() => setShowShift(true)} className={clsx('btn btn-sm btn-ghost', activeShift ? 'text-green-600' : 'text-red-500')} title="Shift">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
          </button>
          <button onClick={() => setShowCart(true)} className="lg:hidden relative p-2.5 bg-green-600 text-white rounded-xl">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" /></svg>
            {cart.itemCount() > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">{cart.itemCount()}</span>}
          </button>
          <button onClick={() => { logout(); router.replace('/login'); }} className="hidden lg:flex btn btn-sm btn-ghost" title="Logout">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          </button>
        </header>

        <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex gap-2 overflow-x-auto flex-shrink-0">
          <button onClick={() => setSelectedCategory('all')} className={clsx('pos-category-pill', selectedCategory === 'all' ? 'pos-category-active' : 'pos-category-inactive')}>Semua</button>
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={clsx('pos-category-pill', selectedCategory === cat.id ? 'text-white' : 'pos-category-inactive')} style={selectedCategory === cat.id ? { backgroundColor: cat.color } : undefined}>{cat.name}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? <Loader /> : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map((product) => {
                const qty = cart.lines.filter((l) => l.productId === product.id).reduce((s, l) => s + l.quantity, 0);
                const makeable = maxMakeable(product);
                const out = makeable <= 0;
                const low = !out && makeable !== Infinity && makeable <= 3;
                return (
                  <button key={product.id} onClick={() => !out && addProduct(product)} disabled={out}
                    className={clsx('pos-product-card relative', out ? 'opacity-50 cursor-not-allowed' : qty > 0 ? 'pos-product-card-active' : 'pos-product-card-inactive')}>
                    {qty > 0 && !out && <span className="absolute top-2 right-2 w-6 h-6 bg-green-600 rounded-full text-white text-xs font-bold flex items-center justify-center">{qty}</span>}
                    {out && <span className="absolute top-2 right-2 text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">HABIS</span>}
                    {low && <span className="absolute top-2 right-2 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">sisa {makeable}</span>}
                    <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center text-lg" style={{ backgroundColor: product.category?.color + '20', color: product.category?.color }}>{product.name.charAt(0)}</div>
                    <p className="font-semibold text-sm text-gray-900 truncate">{product.name}</p>
                    <p className="text-green-600 font-bold text-sm mt-1">{formatCurrency(product.price)}</p>
                    {product.modifierGroups?.length > 0 && <p className="text-[10px] text-gray-400 mt-0.5">bisa diatur</p>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: cart + queue */}
      <div className={clsx('bg-white border-l border-gray-200 flex flex-col h-screen', 'max-lg:fixed max-lg:inset-0 max-lg:z-50 max-lg:transition-transform max-lg:duration-300', showCart ? 'max-lg:translate-x-0' : 'max-lg:translate-x-full')}>
        <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
          {/* Tab toggle — only show in cart step */}
          {step === 'cart' ? (
            <div className="flex items-center gap-2">
              <div className="flex flex-1 bg-gray-100 rounded-xl p-1">
                <button onClick={() => setRightTab('cart')}
                  className={clsx('flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all', rightTab === 'cart' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500')}>
                  {activeBill ? `Bill: ${activeBill.name}` : 'Pesanan'}
                </button>
                <button onClick={() => setRightTab('queue')}
                  className={clsx('flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5', rightTab === 'queue' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500')}>
                  Queue
                  {queueCount > 0 && (
                    <span className={clsx('min-w-[18px] h-[18px] rounded-full text-xs font-black text-white flex items-center justify-center px-1', rightTab === 'queue' ? 'bg-brand-600' : 'bg-red-500')}>
                      {queueCount}
                    </span>
                  )}
                </button>
              </div>
              <div className="flex items-center gap-1">
                {activeBill && <button onClick={() => { setActiveBill(null); cart.clear(); }} className="text-sm text-gray-500">Batal</button>}
                <button onClick={() => setShowCart(false)} className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">{step === 'payment' ? 'Pembayaran' : 'Struk'}</h2>
              <div className="flex items-center gap-2">
                {step === 'payment' && <button onClick={() => setStep('cart')} className="text-sm text-gray-500 hover:text-gray-700">← Kembali</button>}
                <button onClick={() => setShowCart(false)} className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* QUEUE TAB */}
        {step === 'cart' && rightTab === 'queue' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {queueOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <p className="text-3xl mb-3">✅</p>
                <p className="font-semibold text-gray-600">Semua pesanan selesai</p>
                <p className="text-sm text-gray-400 mt-1">Tidak ada pesanan aktif</p>
              </div>
            ) : (
              queueOrders.map(o => (
                <div key={o.id} className="bg-white border-2 border-gray-100 rounded-xl p-3 hover:border-brand-200 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>{o.orderNumber}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(o.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        {o.type === 'TAKEAWAY' && <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Take Away</span>}
                      </p>
                    </div>
                    <p className="font-bold text-sm" style={{ color: 'var(--brand)' }}>{formatCurrency(o.total)}</p>
                  </div>
                  <div className="space-y-0.5 mb-3">
                    {(o.items || []).map((item: any, i: number) => (
                      <p key={i} className="text-xs text-gray-600">
                        • {item.product?.name} <span className="font-semibold">×{item.quantity}</span>
                      </p>
                    ))}
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await api.patch('/api/orders', { id: o.id, action: 'complete_serve' });
                        setQueueOrders(p => p.filter(x => x.id !== o.id));
                        setQueueCount(p => Math.max(0, p - 1));
                      } catch (e: any) { alert(e.message || 'Gagal'); }
                    }}
                    className="w-full py-2 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
                    style={{ background: 'var(--brand)' }}>
                    ✓ Pesanan Diserahkan
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {step === 'cart' && rightTab === 'cart' && (<>
          <div className="px-4 pt-3 flex-shrink-0">
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {(['DINE_IN', 'TAKEAWAY'] as const).map((t) => (
                <button key={t} onClick={() => cart.setOrderType(t)} className={clsx('flex-1 text-sm py-2 rounded-lg font-medium', cart.orderType === t ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500')}>{t === 'DINE_IN' ? 'Dine in' : 'Take away'}</button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {cart.lines.length === 0 ? (
              <div className="empty-state"><p className="empty-title">Belum ada item</p><p className="empty-text">Tap menu untuk menambah</p></div>
            ) : (
              <div className="space-y-2">{cart.lines.map((line) => <CartLineRow key={line.lineId} line={line} onEdit={() => setEditLine(line)} />)}</div>
            )}
          </div>

          {cart.lines.length > 0 && (
            <div className="border-t border-gray-200 px-4 py-3 flex-shrink-0 space-y-3">
              {!activeBill && (
                <select value={selectedDiscount} onChange={(e) => setSelectedDiscount(e.target.value)} className="select text-sm">
                  <option value="">Tanpa diskon</option>
                  {discounts.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.type === 'PERCENT' ? `${d.value}%` : formatCurrency(d.value)})</option>)}
                </select>
              )}
              <div className="flex gap-3 text-sm">
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={cart.taxEnabled} onChange={(e) => cart.setTaxEnabled(e.target.checked)} /> Pajak {Math.round(cart.taxRate * 100)}%</label>
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={cart.serviceEnabled} onChange={(e) => cart.setServiceEnabled(e.target.checked)} /> Service {Math.round(cart.serviceRate * 100)}%</label>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatCurrency(cart.subtotal())}</span></div>
                {cart.discount > 0 && <div className="flex justify-between text-red-500"><span>Diskon</span><span>-{formatCurrency(cart.discount)}</span></div>}
                {cart.tax() > 0 && <div className="flex justify-between text-gray-600"><span>Pajak</span><span>{formatCurrency(cart.tax())}</span></div>}
                {cart.service() > 0 && <div className="flex justify-between text-gray-600"><span>Service</span><span>{formatCurrency(cart.service())}</span></div>}
                {cart.takeawayTotal() > 0 && <div className="flex justify-between text-gray-600"><span>Take-away</span><span>{formatCurrency(cart.takeawayTotal())}</span></div>}
                <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-100"><span>Total</span><span>{formatCurrency(cart.total())}</span></div>
              </div>
              {activeBill ? (
                <button onClick={addToBill} className="btn btn-md btn-primary w-full text-sm">Tambah ke bill</button>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => { cart.clear(); setSelectedDiscount(''); }} className="btn btn-md btn-danger text-sm">Hapus</button>
                  <button onClick={() => { setBillName(''); setBillModal(true); }} className="btn btn-md btn-secondary text-sm text-amber-600">Simpan bill</button>
                  <button onClick={() => setStep('payment')} className="btn btn-md btn-primary text-sm">Bayar</button>
                </div>
              )}
            </div>
          )}
        </>)}

        {step === 'payment' && (
          <div className="flex-1 flex flex-col px-4 py-4 overflow-y-auto">
            <div className="text-center mb-6"><p className="text-gray-500 text-sm">Total</p><p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{formatCurrency(cart.total())}</p></div>

            {/* Customer Search */}
            <div className="mb-4 border border-gray-200 rounded-xl p-3">
              <CustomerSearch
                phone={custPhone} name={custName}
                onSelect={async (c) => {
                  setCustPhone(c.phone || ''); setCustName(c.name);
                  // Fetch customer points + available rewards
                  try {
                    const res = await fetch(`/api/public/check-points?phone=${encodeURIComponent(c.phone || '')}`);
                    const data = await res.json();
                    setLoy({ name: c.name, points: c.points, rewards: data.data?.rewards || [] });
                  } catch {
                    setLoy({ name: c.name, points: c.points, rewards: [] });
                  }
                }}
                onClear={() => { setCustPhone(''); setCustName(''); setLoy(null); cart.setRedeemPoints(0); }}
                onNew={(name, phone) => { setCustName(name); setCustPhone(phone); setLoy({ name, points: 0 }); }}
              />
              {loy && loy.points > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-green-700">{loy.name}</p>
                    <span className="text-sm font-black text-amber-600">{loy.points} poin</span>
                  </div>
                  {/* Reward checkpoints */}
                  {(loy.rewards || []).length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-gray-400 font-medium">Tukar reward:</p>
                      {(loy.rewards || []).map((r: any) => {
                        const canRedeem = loy.points >= r.pointsRequired;
                        const isActive  = cart.redeemPoints === r.pointsRequired;
                        return (
                          <button key={r.id}
                            disabled={!canRedeem}
                            onClick={() => {
                              if (isActive) { cart.setRedeemPoints(0); }
                              else { cart.setRedeemPoints(r.pointsRequired); }
                            }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl border-2 transition-all text-left"
                            style={{
                              borderColor: isActive ? '#48654D' : canRedeem ? '#D1E8D3' : '#E5E7EB',
                              background:  isActive ? '#F0F7F1' : canRedeem ? '#FAFFF9' : '#F9FAFB',
                              opacity: canRedeem ? 1 : 0.5,
                            }}>
                            <div className="flex items-center gap-2">
                              <span>{r.rewardType === 'FREE_PRODUCT' ? (r.station === 'FOOD' ? '🍔' : '🥤') : '💰'}</span>
                              <div>
                                <p className="text-xs font-semibold" style={{ color: '#111816' }}>{r.name}</p>
                                {r.maxPrice && <p className="text-xs text-gray-400">max {formatCurrency(r.maxPrice)}</p>}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs font-bold" style={{ color: canRedeem ? '#48654D' : '#9CA3AF' }}>{r.pointsRequired} poin</p>
                              {isActive && <p className="text-xs text-green-600 font-medium">✓ Dipilih</p>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {(loy.rewards || []).length === 0 && (
                    <p className="text-xs text-gray-400">Belum ada reward tersedia</p>
                  )}
                  {cart.redeemPoints > 0 && (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-green-50 border border-green-200">
                      <span className="text-xs text-green-700 font-medium">Diskon tukar poin</span>
                      <span className="text-xs font-bold text-green-700">-{formatCurrency(cart.redeemPoints * cart.redeemValue)}</span>
                    </div>
                  )}
                </div>
              )}
              {loy && loy.points === 0 && <p className="mt-2 text-xs text-gray-400">Belum punya poin. Akan mendapat poin dari transaksi ini.</p>}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {(['CASH', 'QRIS', 'CARD'] as const).map((m) => (
                <button key={m} onClick={() => setPayMethod(m)} className={clsx('py-3 rounded-2xl text-sm font-semibold border-2 transition-all', payMethod === m ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-gray-300')}>{m === 'CASH' ? 'Tunai' : m === 'QRIS' ? 'QRIS' : 'EDC'}</button>
              ))}
            </div>
            {payMethod === 'CASH' && (
              <div className="mb-4">
                <label className="label">Uang diterima</label>
                <input type="number" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} className="input text-xl text-center font-bold" autoFocus />
                {parseFloat(cashReceived) >= cart.total() && <p className="text-center text-green-600 font-bold mt-2">Kembali: {formatCurrency(parseFloat(cashReceived) - cart.total())}</p>}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                  {[cart.total(), 50000, 100000, 150000, 200000, 500000].map((a, idx) => (<button key={idx} onClick={() => setCashReceived(String(a))} className="btn btn-sm btn-secondary">{formatCurrency(a)}</button>))}
                </div>
              </div>
            )}
            {(payMethod === 'QRIS' || payMethod === 'CARD') && (
              <div className="mb-4">
                <label className="label">{payMethod === 'QRIS' ? 'Ref QRIS (cocokkan sound box)' : 'Kode approval EDC'}</label>
                <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} className="input" placeholder="Opsional" />
                {payMethod === 'QRIS' && <p className="text-xs text-gray-400 mt-1">Konfirmasi nominal dari sound box sebelum tandai lunas.</p>}
              </div>
            )}
            <div className="mt-auto">
              <button onClick={handleCheckout} disabled={submitting || (payMethod === 'CASH' && parseFloat(cashReceived) > 0 && parseFloat(cashReceived) < cart.total())} className="btn btn-lg btn-primary w-full text-lg">{submitting ? 'Memproses...' : 'Selesaikan'}</button>
            </div>
          </div>
        )}

        {step === 'receipt' && lastOrder && (
          <div className="flex-1 flex flex-col px-4 py-4 overflow-y-auto">
            <div className="text-center mb-4">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-3"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-green-600"><polyline points="20 6 9 17 4 12" /></svg></div>
              <h3 className="text-xl font-bold">Pembayaran berhasil</h3>
              <p className="text-gray-500 mt-1">{lastOrder.orderNumber}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm mb-4">
              {(lastOrder.items || []).map((i: any) => (<div key={i.id} className="flex justify-between"><span>{i.product?.name} x{i.quantity}</span><span>{formatCurrency(i.subtotal)}</span></div>))}
              <div className="border-t border-gray-200 pt-2 mt-2 space-y-1">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(lastOrder.subtotal)}</span></div>
                {lastOrder.discount > 0 && <div className="flex justify-between text-red-500"><span>Diskon</span><span>-{formatCurrency(lastOrder.discount)}</span></div>}
                {lastOrder.tax > 0 && <div className="flex justify-between"><span>Pajak</span><span>{formatCurrency(lastOrder.tax)}</span></div>}
                {lastOrder.serviceCharge > 0 && <div className="flex justify-between"><span>Service</span><span>{formatCurrency(lastOrder.serviceCharge)}</span></div>}
                {lastOrder.takeawayCharge > 0 && <div className="flex justify-between"><span>Take-away</span><span>{formatCurrency(lastOrder.takeawayCharge)}</span></div>}
                <div className="flex justify-between font-bold text-lg mt-1"><span>Total</span><span>{formatCurrency(lastOrder.total)}</span></div>
              </div>
              {lastOrder.payment && (<div className="border-t border-gray-200 pt-2"><div className="flex justify-between"><span>{lastOrder.payment.method}</span><span>{formatCurrency(lastOrder.payment.received)}</span></div>{lastOrder.payment.change > 0 && <div className="flex justify-between text-green-600 font-bold"><span>Kembali</span><span>{formatCurrency(lastOrder.payment.change)}</span></div>}</div>)}
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-semibold text-green-800 mb-2">Kirim struk via WhatsApp</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input type="text" value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Nama" className="input text-sm" />
                <input type="tel" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="08xx" className="input text-sm" />
              </div>
              <button onClick={sendWhatsApp} className="btn btn-sm btn-primary w-full bg-green-600">Kirim WhatsApp</button>
            </div>
            <div className="mt-auto space-y-2">
              <button onClick={printReceipt} className="btn btn-md btn-secondary w-full">🖨 Cetak struk</button>
              <button onClick={resetCheckout} className="btn btn-lg btn-primary w-full text-lg">Order baru</button>
            </div>
          </div>
        )}
      </div>

      {/* Modifier sheet (new item OR edit line) */}
      {(config || editLine) && (
        <ModifierSheet
          product={config ? config.product : products.find((p) => p.id === editLine!.productId)}
          initial={config ? config.modifiers : editLine!.modifiers}
          isNew={!!config}
          onClose={() => { setConfig(null); setEditLine(null); }}
          onSave={(mods) => {
            if (config) cart.addLine({ productId: config.product.id, name: config.product.name, basePrice: config.product.price, station: config.product.station, takeawayCharge: config.product.takeawayCharge, modifiers: mods });
            else if (editLine) cart.setLineModifiers(editLine.lineId, mods);
            setConfig(null); setEditLine(null);
          }}
        />
      )}

      {/* Bill name modal */}
      <Modal open={billModal} onClose={() => setBillModal(false)} title="Simpan sebagai bill">
        <div className="space-y-3">
          <Input label="Nama / nomor meja" value={billName} onChange={(e) => setBillName(e.target.value)} placeholder="cth. Meja 4 / Budi" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {['Meja 1', 'Meja 2', 'Meja 3', 'Meja 4', 'Meja 5', 'Meja 6', 'Take away', 'Bar'].map((t) => (
              <button key={t} onClick={() => setBillName(t)} className={clsx('py-2 rounded-lg text-sm border', billName === t ? 'bg-green-50 border-green-500 text-green-700' : 'border-gray-200 text-gray-600')}>{t}</button>
            ))}
          </div>
          <Button onClick={confirmSaveBill} disabled={!billName} className="w-full">Simpan bill</Button>
        </div>
      </Modal>

      {/* Open bills */}
      <Modal open={showBills} onClose={() => setShowBills(false)} title="Bill terbuka" maxWidth="max-w-lg">
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {openBills.map((o) => (
            <div key={o.id} className="warn-box">
              <div className="flex justify-between text-sm"><span className="font-medium">{o.billName || o.orderNumber}</span><span className="font-bold">{formatCurrency(o.total)}</span></div>
              <p className="text-xs text-gray-500 mt-1">{o.items?.length || 0} item · {new Date(o.createdAt).toLocaleString('id-ID')}</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button onClick={() => startAddingToBill(o)} className="btn btn-sm btn-secondary">Tambah item</button>
                <button onClick={() => closeBill(o)} className="btn btn-sm btn-primary">Tutup & bayar</button>
              </div>
            </div>
          ))}
          {openBills.length === 0 && <p className="text-center text-gray-400 py-4">Tidak ada bill terbuka</p>}
        </div>
      </Modal>

      {/* Shift */}
      <Modal open={showShift} onClose={() => setShowShift(false)} title={activeShift ? 'Shift aktif' : 'Buka shift'}>
        {!activeShift ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Masukkan kas awal untuk memulai shift.</p>
            <Input label="Kas awal (Rp)" type="number" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} placeholder="cth. 500000" />
            <Button onClick={openShift} className="w-full">Buka shift</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="success-box"><p>Dibuka: {new Date(activeShift.openedAt).toLocaleString('id-ID')}</p><p>Kas awal: <strong>{formatCurrency(activeShift.openingCash)}</strong></p></div>
            <Input label="Kas akhir (hitung laci)" type="number" value={closingCash} onChange={(e) => setClosingCash(e.target.value)} />
            <Button onClick={closeShift} variant="danger" className="w-full">Tutup shift</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Loader() {
  return <div className="flex items-center justify-center h-full"><svg className="animate-spin w-8 h-8 text-green-600" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.2" /><path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" /></svg></div>;
}

function CartLineRow({ line, onEdit }: { line: CartLine; onEdit: () => void }) {
  const { updateQuantity, removeLine } = useCartStore();
  const unit = lineUnitPrice(line);
  const modText = line.modifiers.filter((m) => m.optionName !== 'Normal' && m.optionName !== 'Glass').map((m) => m.optionName.toLowerCase()).join(' · ');
  return (
    <div className="pos-cart-item">
      <button onClick={onEdit} className="flex-1 min-w-0 text-left">
        <p className="text-sm font-semibold text-gray-900 truncate">{line.name}</p>
        {modText ? <p className="text-xs text-green-600 truncate">{modText}</p> : line.modifiers.length === 0 ? null : <p className="text-xs" style={{color:'var(--text-3)'}}>ketuk untuk atur</p>}
        <p className="text-sm text-gray-500">{formatCurrency(unit)}</p>
      </button>
      <div className="flex items-center gap-1.5">
        <button onClick={() => updateQuantity(line.lineId, line.quantity - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100">−</button>
        <span className="w-8 text-center font-bold text-sm">{line.quantity}</span>
        <button onClick={() => updateQuantity(line.lineId, line.quantity + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100">+</button>
      </div>
      <p className="text-sm font-bold text-gray-900 w-20 text-right">{formatCurrency(unit * line.quantity)}</p>
      <button onClick={() => removeLine(line.lineId)} className="p-1 text-gray-400 hover:text-red-500"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>
    </div>
  );
}

function ModifierSheet({ product, initial, isNew, onClose, onSave }: { product?: Product; initial: SelectedModifier[]; isNew: boolean; onClose: () => void; onSave: (m: SelectedModifier[]) => void }) {
  const [single, setSingle] = useState<Record<string, string>>({});
  const [multi, setMulti] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const s: Record<string, string> = {}; const m: Record<string, string[]> = {};
    for (const g of product?.modifierGroups || []) {
      if (g.selectionType === 'SINGLE') {
        const chosen = initial.find((x) => x.groupName === g.name);
        s[g.name] = chosen?.optionName || (g.options.find((o) => o.isDefault) || g.options[0])?.name || '';
      } else { m[g.name] = initial.filter((x) => x.groupName === g.name).map((x) => x.optionName); }
    }
    setSingle(s); setMulti(m);
  }, [product, initial]);

  if (!product) return null;

  const build = (): SelectedModifier[] => {
    const out: SelectedModifier[] = [];
    for (const g of product.modifierGroups) {
      if (g.selectionType === 'SINGLE') { const o = g.options.find((x) => x.name === single[g.name]); if (o) out.push(toSelected(g, o)); }
      else { for (const o of g.options) if ((multi[g.name] || []).includes(o.name)) out.push(toSelected(g, o)); }
    }
    return out;
  };
  const previewPrice = product.price + build().reduce((s, m) => s + (m.priceDelta || 0), 0);

  return (
    <Modal open onClose={onClose} title={product.name}>
      <div className="space-y-4">
        {product.modifierGroups.map((g) => (
          <div key={g.id}>
            <p className="text-sm text-gray-500 mb-1.5">{g.name}</p>
            {g.selectionType === 'SINGLE' ? (
              <div className="flex gap-2 flex-wrap">
                {g.options.map((o) => (
                  <button key={o.id} onClick={() => setSingle({ ...single, [g.name]: o.name })} className={clsx('px-3 py-2 rounded-lg text-sm border', single[g.name] === o.name ? 'bg-green-50 border-green-500 text-green-700' : 'border-gray-200 text-gray-600')}>{o.name}{o.priceDelta > 0 ? ` +${formatCurrency(o.priceDelta)}` : ''}</button>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {g.options.map((o) => {
                  const on = (multi[g.name] || []).includes(o.name);
                  return (
                    <button key={o.id} onClick={() => setMulti({ ...multi, [g.name]: on ? (multi[g.name] || []).filter((n) => n !== o.name) : [...(multi[g.name] || []), o.name] })} className={clsx('w-full flex justify-between items-center px-3 py-2 rounded-lg text-sm border', on ? 'bg-green-50 border-green-500 text-green-700' : 'border-gray-200 text-gray-600')}>
                      <span>{o.name} {o.priceDelta > 0 && <span className="text-gray-400">+{formatCurrency(o.priceDelta)}</span>}</span><span>{on ? '✓' : '+'}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        <button onClick={() => onSave(build())} className="btn btn-md btn-primary w-full">{isNew ? 'Tambah' : 'Simpan'} — {formatCurrency(previewPrice)}</button>
      </div>
    </Modal>
  );
}
