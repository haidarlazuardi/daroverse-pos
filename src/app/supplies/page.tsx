'use client';
import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/fetch';
import { formatCurrency } from '@/components/ui';

const CATEGORIES = [
  { value: 'UTILITIES',   label: 'Utilities',    icon: '⚡', color: '#F59E0B' },
  { value: 'CONSUMABLES', label: 'Consumables',  icon: '🧴', color: '#3B82F6' },
  { value: 'PACKAGING',   label: 'Packaging',    icon: '📦', color: '#8B5CF6' },
  { value: 'CLEANING',    label: 'Cleaning',     icon: '🧹', color: '#10B981' },
  { value: 'EQUIPMENT',   label: 'Equipment',    icon: '🔧', color: '#6B7280' },
  { value: 'OTHER',       label: 'Lainnya',      icon: '📋', color: '#9CA3AF' },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c]));

const EMPTY_ITEM = { name: '', unit: 'pcs', category: 'CONSUMABLES', defaultSupplierId: '', latestPrice: '', minStock: '', notes: '' };
const EMPTY_ORDER = { supplierId: '', notes: '', items: [] as any[] };

export default function SuppliesPage() {
  const [tab, setTab] = useState<'items'|'orders'>('items');
  const [items, setItems]     = useState<any[]>([]);
  const [orders, setOrders]   = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [itemModal, setItemModal] = useState(false);
  const [editItem, setEditItem]   = useState<any>(null);
  const [itemForm, setItemForm]   = useState({ ...EMPTY_ITEM });
  const [saving, setSaving]       = useState(false);

  const [orderModal, setOrderModal] = useState(false);
  const [orderForm, setOrderForm]   = useState({ ...EMPTY_ORDER });
  const [orderSaving, setOrderSaving] = useState(false);

  const [filterCat, setFilterCat] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const [i, o, s] = await Promise.all([
        api.get<any[]>('/api/supplies'),
        api.get<any>('/api/supply-orders'),
        api.get<any[]>('/api/suppliers'),
      ]);
      setItems(Array.isArray(i) ? i : []);
      setOrders(o?.orders || []);
      setSuppliers(Array.isArray(s) ? s : []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const filtered = items.filter(i => !filterCat || i.category === filterCat);

  function openAddItem() { setEditItem(null); setItemForm({ ...EMPTY_ITEM }); setItemModal(true); }
  function openEditItem(item: any) {
    setEditItem(item);
    setItemForm({
      name: item.name, unit: item.unit, category: item.category,
      defaultSupplierId: item.defaultSupplierId || '',
      latestPrice: String(item.latestPrice || ''),
      minStock: String(item.minStock || ''),
      notes: item.notes || '',
    });
    setItemModal(true);
  }

  async function saveItem() {
    if (!itemForm.name || !itemForm.unit) return;
    setSaving(true);
    try {
      if (editItem) await api.patch('/api/supplies', { id: editItem.id, ...itemForm });
      else await api.post('/api/supplies', itemForm);
      await loadItems();
      setItemModal(false);
    } catch(e: any) { alert(e.message); }
    finally { setSaving(false); }
  }

  // Order form helpers
  function addOrderItem() {
    setOrderForm(p => ({ ...p, items: [...p.items, { supplyItemId: '', quantity: '1', unitPrice: '' }] }));
  }
  function updateOrderItem(idx: number, field: string, val: string) {
    setOrderForm(p => {
      const items = [...p.items];
      items[idx] = { ...items[idx], [field]: val };
      // Auto-fill price from supply item
      if (field === 'supplyItemId') {
        const si = items.find((_, i) => i === idx) && filtered.find(s => s.id === val);
        if (si) items[idx].unitPrice = String(si.latestPrice || '');
      }
      return { ...p, items };
    });
  }
  function removeOrderItem(idx: number) {
    setOrderForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));
  }

  async function saveOrder() {
    if (!orderForm.items.length) return;
    setOrderSaving(true);
    try {
      await api.post('/api/supply-orders', orderForm);
      await loadItems();
      setOrderModal(false);
      setOrderForm({ ...EMPTY_ORDER });
    } catch(e: any) { alert(e.message); }
    finally { setOrderSaving(false); }
  }

  async function receiveOrder(id: string) {
    if (!confirm('Tandai order ini sebagai diterima? Stock akan diupdate.')) return;
    try {
      await api.patch('/api/supply-orders', { id, action: 'receive' });
      await loadItems();
    } catch(e: any) { alert(e.message); }
  }

  const orderTotal = orderForm.items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0), 0);

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black" style={{ color: 'var(--text-1)' }}>Supplies & Utilities</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Non-bahan baku — utilities, consumables, packaging</p>
          </div>
          <div className="flex gap-2">
            {tab === 'items' && (
              <button onClick={openAddItem} className="btn btn-sm btn-primary">+ Item Baru</button>
            )}
            {tab === 'orders' && (
              <button onClick={() => { setOrderForm({ ...EMPTY_ORDER }); setOrderModal(true); }} className="btn btn-sm btn-primary">+ Buat Order</button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--surface-2)' }}>
          {[['items','📦 Master Data'],['orders','🛒 Purchase Orders']].map(([t, label]) => (
            <button key={t} onClick={() => setTab(t as any)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={tab === t
                ? { background: 'white', color: 'var(--text-1)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                : { color: 'var(--text-3)' }}>
              {label}
              {t === 'orders' && orders.filter(o => o.status === 'DRAFT' || o.status === 'ORDERED').length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-amber-500 text-white">
                  {orders.filter(o => o.status === 'DRAFT' || o.status === 'ORDERED').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }}/>
          </div>
        ) : tab === 'items' ? (
          <>
            {/* Category filter */}
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setFilterCat('')}
                className="btn btn-sm" style={!filterCat ? { background: 'var(--brand)', color: 'white' } : { background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                Semua ({items.length})
              </button>
              {CATEGORIES.map(cat => {
                const count = items.filter(i => i.category === cat.value).length;
                if (!count) return null;
                return (
                  <button key={cat.value} onClick={() => setFilterCat(filterCat === cat.value ? '' : cat.value)}
                    className="btn btn-sm"
                    style={filterCat === cat.value
                      ? { background: cat.color, color: 'white' }
                      : { background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                    {cat.icon} {cat.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Items grid */}
            {filtered.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-3xl mb-2">📦</p>
                <p style={{ color: 'var(--text-3)' }}>Belum ada item supplies</p>
                <button onClick={openAddItem} className="btn btn-primary mt-4">+ Tambah Item</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map(item => {
                  const cat = CAT_MAP[item.category];
                  const lowStock = item.minStock > 0 && item.currentStock <= item.minStock;
                  return (
                    <div key={item.id} className="card p-4 cursor-pointer hover:border-brand transition-colors"
                      style={{ borderColor: lowStock ? '#FCA5A5' : 'var(--border)' }}
                      onClick={() => openEditItem(item)}>
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-lg">{cat?.icon}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: cat?.color + '20', color: cat?.color }}>
                          {cat?.label}
                        </span>
                      </div>
                      <p className="font-bold text-sm mb-1" style={{ color: 'var(--text-1)' }}>{item.name}</p>
                      <div className="flex justify-between text-xs" style={{ color: 'var(--text-3)' }}>
                        <span>Stok: <strong style={{ color: lowStock ? '#DC2626' : 'var(--brand)' }}>{item.currentStock} {item.unit}</strong></span>
                        <span>{formatCurrency(item.latestPrice)}/{item.unit}</span>
                      </div>
                      {item.defaultSupplier && (
                        <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>📍 {item.defaultSupplier.name}</p>
                      )}
                      {lowStock && (
                        <p className="text-xs mt-1 font-bold text-red-500">⚠️ Stok menipis</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Orders tab */
          <div className="space-y-3">
            {orders.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-3xl mb-2">🛒</p>
                <p style={{ color: 'var(--text-3)' }}>Belum ada supply order</p>
              </div>
            ) : orders.map(order => {
              const STATUS_COLOR: Record<string, string> = { DRAFT: '#F59E0B', ORDERED: '#3B82F6', RECEIVED: '#10B981', CANCELLED: '#9CA3AF' };
              return (
                <div key={order.id} className="card p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-black text-base" style={{ color: 'var(--text-1)' }}>{order.poNumber}</p>
                      <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                        {order.supplier?.name || 'Tanpa supplier'} · {new Date(order.createdAt).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded-full font-bold text-white"
                        style={{ background: STATUS_COLOR[order.status] }}>
                        {order.status}
                      </span>
                      <p className="font-black" style={{ color: 'var(--brand)' }}>{formatCurrency(order.totalAmount)}</p>
                    </div>
                  </div>
                  {/* Items */}
                  <div className="space-y-1 mb-3">
                    {order.items.map((item: any) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span style={{ color: 'var(--text-2)' }}>{item.supplyItem?.name} × {item.quantity} {item.supplyItem?.unit}</span>
                        <span style={{ color: 'var(--text-3)' }}>{formatCurrency(item.totalPrice)}</span>
                      </div>
                    ))}
                  </div>
                  {/* Actions */}
                  {(order.status === 'DRAFT' || order.status === 'ORDERED') && (
                    <div className="flex gap-2">
                      {order.status === 'DRAFT' && (
                        <button onClick={() => api.patch('/api/supply-orders', { id: order.id, action: 'order' }).then(loadItems)}
                          className="btn btn-sm btn-primary flex-1">Tandai Dipesan</button>
                      )}
                      <button onClick={() => receiveOrder(order.id)}
                        className="btn btn-sm flex-1"
                        style={{ background: '#E1F5EE', color: '#0F6E56', border: '1px solid #9FE1CB' }}>
                        ✓ Terima
                      </button>
                      <button onClick={() => api.patch('/api/supply-orders', { id: order.id, action: 'cancel' }).then(loadItems)}
                        className="btn btn-sm"
                        style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                        Batal
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Item Modal */}
      {itemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden max-h-screen overflow-y-auto">
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <p className="font-black text-base" style={{ color: 'var(--text-1)' }}>{editItem ? 'Edit Item' : 'Tambah Item'}</p>
              <button onClick={() => setItemModal(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="label">Nama Item *</label>
                <input value={itemForm.name} onChange={e => setItemForm(p => ({ ...p, name: e.target.value }))}
                  className="input w-full mt-1" placeholder="cth. Gas LPG 3kg, Sabun Cuci"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Satuan *</label>
                  <input value={itemForm.unit} onChange={e => setItemForm(p => ({ ...p, unit: e.target.value }))}
                    className="input w-full mt-1" placeholder="pcs, liter, kg"/>
                </div>
                <div>
                  <label className="label">Kategori *</label>
                  <select value={itemForm.category} onChange={e => setItemForm(p => ({ ...p, category: e.target.value }))}
                    className="select w-full mt-1">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Harga Terakhir (Rp)</label>
                  <input type="number" value={itemForm.latestPrice} onChange={e => setItemForm(p => ({ ...p, latestPrice: e.target.value }))}
                    className="input w-full mt-1"/>
                </div>
                <div>
                  <label className="label">Min. Stok</label>
                  <input type="number" value={itemForm.minStock} onChange={e => setItemForm(p => ({ ...p, minStock: e.target.value }))}
                    className="input w-full mt-1"/>
                </div>
              </div>
              <div>
                <label className="label">Supplier Default</label>
                <select value={itemForm.defaultSupplierId} onChange={e => setItemForm(p => ({ ...p, defaultSupplierId: e.target.value }))}
                  className="select w-full mt-1">
                  <option value="">Pilih supplier...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Catatan</label>
                <textarea value={itemForm.notes} onChange={e => setItemForm(p => ({ ...p, notes: e.target.value }))}
                  className="input w-full mt-1 resize-none" rows={2}/>
              </div>
            </div>
            <div className="px-5 py-4 border-t flex gap-3" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setItemModal(false)} className="btn btn-secondary flex-1">Batal</button>
              <button onClick={saveItem} disabled={saving || !itemForm.name} className="btn btn-primary flex-1">
                {saving ? 'Menyimpan...' : editItem ? 'Simpan' : 'Tambah'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Modal */}
      {orderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="px-5 py-4 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
              <p className="font-black text-base" style={{ color: 'var(--text-1)' }}>Buat Supply Order</p>
              <button onClick={() => setOrderModal(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="label">Supplier</label>
                <select value={orderForm.supplierId} onChange={e => setOrderForm(p => ({ ...p, supplierId: e.target.value }))}
                  className="select w-full mt-1">
                  <option value="">Tanpa supplier / bayar langsung</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label m-0">Item</label>
                  <button onClick={addOrderItem} className="text-xs font-bold" style={{ color: 'var(--brand)' }}>+ Tambah</button>
                </div>
                <div className="space-y-2">
                  {orderForm.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <select value={item.supplyItemId}
                          onChange={e => {
                            const si = items.find(s => s.id === e.target.value);
                            setOrderForm(p => {
                              const newItems = [...p.items];
                              newItems[idx] = { ...newItems[idx], supplyItemId: e.target.value, unitPrice: si ? String(si.latestPrice) : '' };
                              return { ...p, items: newItems };
                            });
                          }}
                          className="select w-full text-sm">
                          <option value="">Pilih item...</option>
                          {items.map(s => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input type="number" value={item.quantity} placeholder="Qty"
                          onChange={e => updateOrderItem(idx, 'quantity', e.target.value)}
                          className="input w-full text-sm"/>
                      </div>
                      <div className="col-span-3">
                        <input type="number" value={item.unitPrice} placeholder="Harga"
                          onChange={e => updateOrderItem(idx, 'unitPrice', e.target.value)}
                          className="input w-full text-sm"/>
                      </div>
                      <button onClick={() => removeOrderItem(idx)} className="text-red-400 hover:text-red-600 text-lg col-span-1">×</button>
                    </div>
                  ))}
                  {orderForm.items.length === 0 && (
                    <button onClick={addOrderItem} className="w-full py-3 rounded-xl border-2 border-dashed text-sm font-medium"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>
                      + Tambah item
                    </button>
                  )}
                </div>
              </div>

              {orderTotal > 0 && (
                <div className="flex justify-between items-center py-2 border-t font-bold" style={{ borderColor: 'var(--border)' }}>
                  <span style={{ color: 'var(--text-2)' }}>Total</span>
                  <span style={{ color: 'var(--brand)' }}>{formatCurrency(orderTotal)}</span>
                </div>
              )}

              <div>
                <label className="label">Catatan</label>
                <textarea value={orderForm.notes} onChange={e => setOrderForm(p => ({ ...p, notes: e.target.value }))}
                  className="input w-full mt-1 resize-none" rows={2}/>
              </div>
            </div>
            <div className="px-5 py-4 border-t flex gap-3 flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setOrderModal(false)} className="btn btn-secondary flex-1">Batal</button>
              <button onClick={saveOrder} disabled={orderSaving || !orderForm.items.length}
                className="btn btn-primary flex-1">
                {orderSaving ? 'Membuat...' : 'Buat Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
