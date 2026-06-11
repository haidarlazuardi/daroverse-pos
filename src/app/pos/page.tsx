'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useCartStore, CartItem } from '@/store';
import { api } from '@/lib/fetch';
import { formatCurrency, Modal, Button, Input } from '@/components/ui';
import clsx from 'clsx';

interface Product { id: string; name: string; price: number; categoryId: string; category: { id: string; name: string; color: string }; active: boolean }
interface Category { id: string; name: string; color: string }
interface DiscountPreset { id: string; name: string; type: 'PERCENT' | 'FIXED'; value: number }
type Step = 'cart' | 'payment' | 'receipt';

export default function POSPage() {
  const router = useRouter();
  const { user, hydrate, logout } = useAuthStore();
  const cart = useCartStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [discounts, setDiscounts] = useState<DiscountPreset[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('cart');
  const [payMethod, setPayMethod] = useState<'CASH' | 'QRIS'>('CASH');
  const [cashReceived, setCashReceived] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [showCart, setShowCart] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [showHeld, setShowHeld] = useState(false);
  const [heldOrders, setHeldOrders] = useState<any[]>([]);
  const [showShift, setShowShift] = useState(false);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => {
    if (!user) { const t = setTimeout(() => { if (!useAuthStore.getState().user) router.replace('/login'); }, 500); return () => clearTimeout(t); }
  }, [user, router]);

  const loadData = useCallback(async () => {
    try {
      const [prods, cats, discs] = await Promise.all([
        api.get<Product[]>('/api/products?active=true'),
        api.get<Category[]>('/api/categories'),
        api.get<DiscountPreset[]>('/api/discounts'),
      ]);
      setProducts(prods); setCategories(cats); setDiscounts(discs);
      try { const shifts = await api.get<any[]>('/api/shifts?active=true'); if (shifts.length > 0) setActiveShift(shifts[0]); } catch {}
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (user) loadData(); }, [user, loadData]);

  useEffect(() => {
    if (!selectedDiscount) { cart.setDiscount('none', 0); return; }
    const disc = discounts.find(d => d.id === selectedDiscount);
    if (disc) cart.setDiscount(disc.type === 'PERCENT' ? 'percent' : 'fixed', disc.value);
  }, [selectedDiscount, discounts]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') { setSearch(''); searchRef.current?.blur(); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  const filtered = products.filter(p => {
    if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleCheckout = async () => {
    if (cart.items.length === 0) return;
    setSubmitting(true);
    try {
      const received = payMethod === 'CASH' ? parseFloat(cashReceived) || cart.total() : cart.total();
      const order = await api.post('/api/orders', {
        items: cart.items.map(i => ({ productId: i.productId, quantity: i.quantity, notes: i.notes })),
        notes: cart.notes, paymentMethod: payMethod, received, outletId: user?.outletId,
        discountId: selectedDiscount || undefined,
      });
      setLastOrder(order); setStep('receipt'); cart.clear(); setSelectedDiscount('');
    } catch (e: any) { alert(e.message || 'Checkout failed'); }
    finally { setSubmitting(false); }
  };

  const handleHold = async () => {
    if (cart.items.length === 0) return;
    try {
      await api.post('/api/orders', { items: cart.items.map(i => ({ productId: i.productId, quantity: i.quantity, notes: i.notes })), notes: cart.notes, status: 'HOLD', outletId: user?.outletId });
      cart.clear(); setSelectedDiscount(''); alert('Order on hold');
    } catch (e: any) { alert(e.message || 'Failed'); }
  };

  const loadHeldOrders = async () => {
    try { const data = await api.get<any>('/api/orders?status=HOLD&limit=20'); setHeldOrders(data.orders || []); setShowHeld(true); } catch (e) { console.error(e); }
  };

  const resumeHeld = async (order: any) => {
    cart.clear();
    for (const item of order.items) { cart.addItem({ id: item.productId, name: item.product?.name || 'Item', price: item.price }); if (item.quantity > 1) cart.updateQuantity(item.productId, item.quantity); }
    try { await api.patch('/api/orders', { orderId: order.id, action: 'cancel' }); } catch {}
    setShowHeld(false);
  };

  const loadHistory = async () => {
    try { const data = await api.get<any>('/api/orders?limit=20'); setOrderHistory(data.orders || []); setShowHistory(true); } catch (e) { console.error(e); }
  };

  const openShift = async () => {
    try { await api.post('/api/shifts', { action: 'open', openingCash: openingCash || '0' }); setOpeningCash(''); loadData(); setShowShift(false); } catch (e: any) { alert(e.message || 'Failed'); }
  };

  const closeShift = async () => {
    if (!activeShift) return;
    try { const result = await api.post<any>('/api/shifts', { action: 'close', shiftId: activeShift.id, closingCash: closingCash || '0' }); setActiveShift(null); setClosingCash(''); setShowShift(false); alert(`Shift closed. Diff: ${formatCurrency(result.difference || 0)}`); } catch (e: any) { alert(e.message || 'Failed'); }
  };

  const sendWhatsApp = () => {
    if (!lastOrder || !customerPhone) { alert('Enter customer phone number'); return; }
    const phone = customerPhone.startsWith('0') ? '62' + customerPhone.slice(1) : customerPhone.startsWith('+') ? customerPhone.slice(1) : customerPhone;
    const items = (lastOrder.items || []).map((i: any) => `• ${i.product?.name || 'Item'} x${i.quantity} = ${formatCurrency(i.subtotal)}`).join('\n');
    const msg = `🧾 *Daroverse POS Receipt*\n\nOrder: ${lastOrder.orderNumber}\nDate: ${new Date(lastOrder.createdAt).toLocaleString('id-ID')}\n${customerName ? `Customer: ${customerName}\n` : ''}\n${items}\n\nSubtotal: ${formatCurrency(lastOrder.subtotal)}${lastOrder.discount > 0 ? `\nDiscount: -${formatCurrency(lastOrder.discount)}` : ''}\nTax: ${formatCurrency(lastOrder.tax)}\n*Total: ${formatCurrency(lastOrder.total)}*\n\nPayment: ${lastOrder.payment?.method || 'N/A'}\nChange: ${formatCurrency(lastOrder.payment?.change || 0)}\n\nTerima kasih! 🙏`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const printReceipt = () => {
    if (!lastOrder) return;
    const w = window.open('', '_blank', 'width=300,height=600');
    if (!w) return;
    const items = (lastOrder.items || []).map((i: any) => `<tr><td>${i.product?.name || ''}</td><td class="center">${i.quantity}</td><td class="right">${formatCurrency(i.subtotal)}</td></tr>`).join('');
    w.document.write(`<html><head><title>Receipt</title><style>body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:10px}table{width:100%;border-collapse:collapse}td{padding:2px 0}.line{border-top:1px dashed #000;margin:6px 0}.center{text-align:center}.right{text-align:right}</style></head><body><h2 style="text-align:center;margin:4px 0">Daroverse POS</h2><p class="center">${lastOrder.orderNumber}<br>${new Date(lastOrder.createdAt).toLocaleString('id-ID')}</p><div class="line"></div><table>${items}</table><div class="line"></div><table><tr><td>Subtotal</td><td class="right">${formatCurrency(lastOrder.subtotal)}</td></tr>${lastOrder.discount > 0 ? `<tr><td>Discount</td><td class="right">-${formatCurrency(lastOrder.discount)}</td></tr>` : ''}<tr><td>Tax</td><td class="right">${formatCurrency(lastOrder.tax)}</td></tr><tr><td><b>TOTAL</b></td><td class="right"><b>${formatCurrency(lastOrder.total)}</b></td></tr>${lastOrder.payment ? `<tr><td>${lastOrder.payment.method}</td><td class="right">${formatCurrency(lastOrder.payment.received)}</td></tr><tr><td>Change</td><td class="right">${formatCurrency(lastOrder.payment.change)}</td></tr>` : ''}</table><div class="line"></div><p class="center">Terima kasih!</p><script>window.print();</script></body></html>`);
    w.document.close();
  };

  const resetCheckout = () => { setStep('cart'); setPayMethod('CASH'); setCashReceived(''); setLastOrder(null); setShowCart(false); setCustomerName(''); setCustomerPhone(''); };

  if (!user) return null;

  return (
    <div className="pos-grid bg-gray-50">
      {/* LEFT: Products */}
      <div className="flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-2 flex-shrink-0">
          {/* Back to dashboard for admin */}
          {user.role === 'ADMIN' && (
            <button onClick={() => router.push('/dashboard')} className="btn btn-sm btn-ghost" title="Back to Dashboard">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}
          <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
          </div>
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input ref={searchRef} type="text" placeholder="Search... ( / )" value={search} onChange={e => setSearch(e.target.value)} className="filter-input pl-9" />
          </div>
          <button onClick={loadHeldOrders} className="btn btn-sm btn-ghost text-amber-600" title="Held Orders">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </button>
          <button onClick={loadHistory} className="btn btn-sm btn-ghost" title="Order History">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </button>
          <button onClick={() => setShowShift(true)} className={clsx('btn btn-sm', activeShift ? 'btn-ghost text-green-600' : 'btn-ghost text-red-500')} title="Shift">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </button>
          <button onClick={() => setShowCart(true)} className="lg:hidden relative p-2.5 bg-green-600 text-white rounded-xl">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
            {cart.itemCount() > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center">{cart.itemCount()}</span>}
          </button>
          <button onClick={() => { logout(); router.replace('/login'); }} className="hidden lg:flex btn btn-sm btn-ghost" title="Logout">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </header>

        <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex gap-2 overflow-x-auto flex-shrink-0">
          <button onClick={() => setSelectedCategory('all')} className={clsx('pos-category-pill', selectedCategory === 'all' ? 'pos-category-active' : 'pos-category-inactive')}>All</button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
              className={clsx('pos-category-pill', selectedCategory === cat.id ? 'text-white' : 'pos-category-inactive')}
              style={selectedCategory === cat.id ? { backgroundColor: cat.color } : undefined}>{cat.name}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? <Loader /> : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map(product => {
                const inCart = cart.items.find(i => i.productId === product.id);
                return (
                  <button key={product.id} onClick={() => cart.addItem({ id: product.id, name: product.name, price: product.price })}
                    className={clsx('pos-product-card', inCart ? 'pos-product-card-active' : 'pos-product-card-inactive')}>
                    {inCart && <span className="absolute top-2 right-2 w-6 h-6 bg-green-600 rounded-full text-white text-xs font-bold flex items-center justify-center">{inCart.quantity}</span>}
                    <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center text-lg" style={{ backgroundColor: product.category?.color + '20', color: product.category?.color }}>{product.name.charAt(0)}</div>
                    <p className="font-semibold text-sm text-gray-900 truncate">{product.name}</p>
                    <p className="text-green-600 font-bold text-sm mt-1">{formatCurrency(product.price)}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Cart */}
      <div className={clsx('bg-white border-l border-gray-200 flex flex-col h-screen', 'max-lg:fixed max-lg:inset-0 max-lg:z-50 max-lg:transition-transform max-lg:duration-300', showCart ? 'max-lg:translate-x-0' : 'max-lg:translate-x-full')}>
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h2 className="font-bold text-gray-900">{step === 'cart' ? 'Current Order' : step === 'payment' ? 'Payment' : 'Receipt'}</h2>
          <div className="flex items-center gap-2">
            {step === 'payment' && <button onClick={() => setStep('cart')} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>}
            <button onClick={() => setShowCart(false)} className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {/* CART */}
        {step === 'cart' && (<>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {cart.items.length === 0 ? (
              <div className="empty-state"><p className="empty-title">No items yet</p><p className="empty-text">Tap a product to add it</p></div>
            ) : (
              <div className="space-y-2">{cart.items.map(item => <CartItemRow key={item.productId} item={item} />)}</div>
            )}
          </div>
          {cart.items.length > 0 && (
            <div className="border-t border-gray-200 px-4 py-3 flex-shrink-0 space-y-3">
              <select value={selectedDiscount} onChange={e => setSelectedDiscount(e.target.value)} className="select text-sm">
                <option value="">No discount</option>
                {discounts.map(d => <option key={d.id} value={d.id}>{d.name} ({d.type === 'PERCENT' ? `${d.value}%` : formatCurrency(d.value)})</option>)}
              </select>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatCurrency(cart.subtotal())}</span></div>
                {cart.discountAmount() > 0 && <div className="flex justify-between text-red-500"><span>Discount</span><span>-{formatCurrency(cart.discountAmount())}</span></div>}
                <div className="flex justify-between text-gray-600"><span>Tax (11%)</span><span>{formatCurrency(cart.tax())}</span></div>
                <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-100"><span>Total</span><span>{formatCurrency(cart.total())}</span></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => cart.clear()} className="btn btn-md btn-danger text-sm">Clear</button>
                <button onClick={handleHold} className="btn btn-md btn-secondary text-sm text-amber-600">Hold</button>
                <button onClick={() => setStep('payment')} className="btn btn-md btn-primary text-sm">Charge</button>
              </div>
            </div>
          )}
        </>)}

        {/* PAYMENT */}
        {step === 'payment' && (
          <div className="flex-1 flex flex-col px-4 py-4">
            <div className="text-center mb-6">
              <p className="text-gray-500 text-sm">Total</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{formatCurrency(cart.total())}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {(['CASH', 'QRIS'] as const).map(m => (
                <button key={m} onClick={() => setPayMethod(m)} className={clsx('py-4 rounded-2xl text-sm font-semibold border-2 transition-all', payMethod === m ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-gray-300')}>
                  {m === 'CASH' ? '💵' : '📱'} {m}
                </button>
              ))}
            </div>
            {payMethod === 'CASH' && (
              <div className="mb-4">
                <label className="label">Cash Received</label>
                <input type="number" value={cashReceived} onChange={e => setCashReceived(e.target.value)} className="input text-xl text-center font-bold" autoFocus />
                {parseFloat(cashReceived) >= cart.total() && <p className="text-center text-green-600 font-bold mt-2">Change: {formatCurrency(parseFloat(cashReceived) - cart.total())}</p>}
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {[cart.total(), 50000, 100000, 150000, 200000, 500000].map(a => (
                    <button key={a} onClick={() => setCashReceived(String(a))} className="btn btn-sm btn-secondary">{formatCurrency(a)}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-auto">
              <button onClick={handleCheckout} disabled={submitting || (payMethod === 'CASH' && parseFloat(cashReceived) > 0 && parseFloat(cashReceived) < cart.total())}
                className="btn btn-lg btn-primary w-full text-lg">{submitting ? 'Processing...' : 'Complete Payment'}</button>
            </div>
          </div>
        )}

        {/* RECEIPT */}
        {step === 'receipt' && lastOrder && (
          <div className="flex-1 flex flex-col px-4 py-4 overflow-y-auto">
            <div className="text-center mb-4">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-3 animate-pulse-green">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-green-600"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h3 className="text-xl font-bold">Payment Successful!</h3>
              <p className="text-gray-500 mt-1">{lastOrder.orderNumber}</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm mb-4">
              {(lastOrder.items || []).map((i: any) => (
                <div key={i.id} className="flex justify-between"><span>{i.product?.name} x{i.quantity}</span><span>{formatCurrency(i.subtotal)}</span></div>
              ))}
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(lastOrder.subtotal)}</span></div>
                {lastOrder.discount > 0 && <div className="flex justify-between text-red-500"><span>Discount</span><span>-{formatCurrency(lastOrder.discount)}</span></div>}
                <div className="flex justify-between"><span>Tax</span><span>{formatCurrency(lastOrder.tax)}</span></div>
                <div className="flex justify-between font-bold text-lg mt-1"><span>Total</span><span>{formatCurrency(lastOrder.total)}</span></div>
              </div>
              {lastOrder.payment && (
                <div className="border-t border-gray-200 pt-2">
                  <div className="flex justify-between"><span>{lastOrder.payment.method}</span><span>{formatCurrency(lastOrder.payment.received)}</span></div>
                  <div className="flex justify-between text-green-600 font-bold"><span>Change</span><span>{formatCurrency(lastOrder.payment.change)}</span></div>
                </div>
              )}
            </div>

            {/* WhatsApp Receipt */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-semibold text-green-800 mb-2">📱 Send Receipt via WhatsApp</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name" className="input text-sm" />
                <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="08xx or +62xx" className="input text-sm" />
              </div>
              <button onClick={sendWhatsApp} className="btn btn-sm btn-primary w-full bg-green-600">Send via WhatsApp</button>
            </div>

            <div className="mt-auto space-y-2">
              <button onClick={printReceipt} className="btn btn-md btn-secondary w-full">🖨 Print Receipt</button>
              <button onClick={resetCheckout} className="btn btn-lg btn-primary w-full text-lg">New Order</button>
            </div>
          </div>
        )}
      </div>

      {/* Order History Modal */}
      <Modal open={showHistory} onClose={() => setShowHistory(false)} title="Recent Orders" maxWidth="max-w-lg">
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {orderHistory.map(o => (
            <button key={o.id} onClick={() => { setOrderDetail(o); setShowHistory(false); }}
              className="w-full text-left bg-gray-50 rounded-xl p-3 hover:bg-gray-100 transition-colors">
              <div className="flex justify-between text-sm"><span className="font-mono font-medium">{o.orderNumber}</span><span className="font-bold">{formatCurrency(o.total)}</span></div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{new Date(o.createdAt).toLocaleString('id-ID')}</span>
                <span>{o.payment?.method} · {o.items?.length || 0} items · <Badge variant={o.status === 'COMPLETED' ? 'success' : o.status === 'REFUNDED' ? 'danger' : 'default'}>{o.status}</Badge></span>
              </div>
            </button>
          ))}
          {orderHistory.length === 0 && <p className="text-center text-gray-400 py-4">No orders</p>}
        </div>
      </Modal>

      {/* Order Detail Modal */}
      <Modal open={!!orderDetail} onClose={() => setOrderDetail(null)} title={orderDetail?.orderNumber || 'Order Detail'}>
        {orderDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Date:</span> {new Date(orderDetail.createdAt).toLocaleString('id-ID')}</div>
              <div><span className="text-gray-500">Status:</span> <Badge variant={orderDetail.status === 'COMPLETED' ? 'success' : 'danger'}>{orderDetail.status}</Badge></div>
              <div><span className="text-gray-500">Cashier:</span> {orderDetail.user?.name || '—'}</div>
              <div><span className="text-gray-500">Payment:</span> {orderDetail.payment?.method || '—'}</div>
            </div>
            <div className="border-t pt-3">
              <h4 className="font-semibold text-sm mb-2">Items</h4>
              {(orderDetail.items || []).map((i: any) => (
                <div key={i.id} className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                  <div><span className="font-medium">{i.product?.name}</span> <span className="text-gray-400">x{i.quantity}</span></div>
                  <span className="font-bold">{formatCurrency(i.subtotal)}</span>
                </div>
              ))}
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(orderDetail.subtotal)}</span></div>
              {orderDetail.discount > 0 && <div className="flex justify-between text-red-500"><span>Discount ({orderDetail.discountLabel})</span><span>-{formatCurrency(orderDetail.discount)}</span></div>}
              <div className="flex justify-between"><span>Tax</span><span>{formatCurrency(orderDetail.tax)}</span></div>
              <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{formatCurrency(orderDetail.total)}</span></div>
              {orderDetail.payment && <div className="flex justify-between text-green-600 pt-1"><span>Change</span><span>{formatCurrency(orderDetail.payment.change)}</span></div>}
            </div>
          </div>
        )}
      </Modal>

      {/* Held Orders Modal */}
      <Modal open={showHeld} onClose={() => setShowHeld(false)} title="Held Orders" maxWidth="max-w-lg">
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {heldOrders.map(o => (
            <div key={o.id} className="warn-box">
              <div className="flex justify-between text-sm"><span className="font-mono font-medium">{o.orderNumber}</span><span className="font-bold">{formatCurrency(o.total)}</span></div>
              <p className="text-xs text-gray-500 mt-1">{o.items?.length || 0} items · {new Date(o.createdAt).toLocaleString('id-ID')}</p>
              <button onClick={() => resumeHeld(o)} className="btn btn-sm btn-primary w-full mt-2 bg-amber-500 hover:bg-amber-600">Resume Order</button>
            </div>
          ))}
          {heldOrders.length === 0 && <p className="text-center text-gray-400 py-4">No held orders</p>}
        </div>
      </Modal>

      {/* Shift Modal */}
      <Modal open={showShift} onClose={() => setShowShift(false)} title={activeShift ? 'Active Shift' : 'Open Shift'}>
        {!activeShift ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Enter opening cash balance to start shift.</p>
            <Input label="Opening Cash (IDR)" type="number" value={openingCash} onChange={e => setOpeningCash(e.target.value)} placeholder="e.g. 500000" />
            <Button onClick={openShift} className="w-full">Open Shift</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="success-box">
              <p>Opened: {new Date(activeShift.openedAt).toLocaleString('id-ID')}</p>
              <p>Opening Cash: <strong>{formatCurrency(activeShift.openingCash)}</strong></p>
            </div>
            <Input label="Closing Cash (count your drawer)" type="number" value={closingCash} onChange={e => setClosingCash(e.target.value)} />
            <Button onClick={closeShift} variant="danger" className="w-full">Close Shift</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Loader() {
  return <div className="flex items-center justify-center h-full"><svg className="animate-spin w-8 h-8 text-green-600" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.2"/><path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/></svg></div>;
}

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: string }) {
  const cls: Record<string, string> = { default: 'badge-default', success: 'badge-success', warning: 'badge-warning', danger: 'badge-danger' };
  return <span className={clsx('badge', cls[variant] || 'badge-default')}>{children}</span>;
}

function CartItemRow({ item }: { item: CartItem }) {
  const { updateQuantity, removeItem } = useCartStore();
  return (
    <div className="pos-cart-item">
      <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p><p className="text-sm text-green-600 font-medium">{formatCurrency(item.price)}</p></div>
      <div className="flex items-center gap-1.5">
        <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100">−</button>
        <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
        <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100">+</button>
      </div>
      <p className="text-sm font-bold text-gray-900 w-20 text-right">{formatCurrency(item.price * item.quantity)}</p>
      <button onClick={() => removeItem(item.productId)} className="p-1 text-gray-400 hover:text-red-500">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  );
}
