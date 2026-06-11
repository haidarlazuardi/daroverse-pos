'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card, Button, Badge, Modal, Input, Select, Loader, formatCurrency } from '@/components/ui';
import { api } from '@/lib/fetch';
import clsx from 'clsx';

interface PO {
  id: string; poNumber: string; status: string; totalAmount: number; notes: string | null;
  createdAt: string; completedAt: string | null;
  supplier: { id: string; name: string };
  items: Array<{ id: string; quantity: number; unitPrice: number; totalPrice: number; ingredient: { id: string; name: string; unit: string } }>;
}
interface Supplier { id: string; name: string }
interface Ingredient { id: string; name: string; unit: string; latestPrice: number }

export default function PurchaseOrdersPage() {
  const [pos, setPOs] = useState<PO[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PO | null>(null);
  const [filter, setFilter] = useState('all');

  const [form, setForm] = useState({
    supplierId: '', notes: '', markComplete: true,
    items: [] as { ingredientId: string; quantity: string; unitPrice: string }[],
  });

  const load = useCallback(async () => {
    try {
      const [p, s, i] = await Promise.all([
        api.get<PO[]>('/api/purchase-orders'), api.get<Supplier[]>('/api/suppliers'), api.get<Ingredient[]>('/api/ingredients'),
      ]);
      setPOs(p); setSuppliers(s); setIngredients(i);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.supplierId || form.items.length === 0) { alert('Select supplier and add items'); return; }
    try {
      await api.post('/api/purchase-orders', {
        supplierId: form.supplierId, notes: form.notes, markComplete: form.markComplete,
        items: form.items.map(i => ({ ingredientId: i.ingredientId, quantity: parseFloat(i.quantity), unitPrice: parseFloat(i.unitPrice) })),
      });
      setShowCreate(false); setForm({ supplierId: '', notes: '', markComplete: true, items: [] }); load();
    } catch (e: any) { alert(e.message || 'Failed'); }
  };

  const handleAction = async (id: string, action: string) => {
    try { await api.patch('/api/purchase-orders', { id, action }); load(); setSelectedPO(null); } catch (e: any) { alert(e.message || 'Failed'); }
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { ingredientId: '', quantity: '', unitPrice: '' }] });
  const filtered = filter === 'all' ? pos : pos.filter(p => p.status === filter);
  const statusColors: Record<string, 'default' | 'success' | 'danger'> = { DRAFT: 'default', COMPLETED: 'success', CANCELLED: 'danger' };
  const total = form.items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0), 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="page-header">
          <div><h2 className="page-title">Purchase Orders</h2><p className="page-subtitle">Record purchases — stock and expenses auto-synced</p></div>
          <Button onClick={() => setShowCreate(true)}>+ Record Purchase</Button>
        </div>

        <div className="tab-group">
          {['all', 'DRAFT', 'COMPLETED'].map(s => (
            <button key={s} onClick={() => setFilter(s)} className={clsx('tab-item', filter === s ? 'tab-active' : 'tab-inactive')}>{s.toLowerCase()}</button>
          ))}
        </div>

        {loading ? <Loader /> : (
          <Card padding={false}><div className="table-wrapper"><table className="table">
            <thead><tr><th>PO Number</th><th>Supplier</th><th>Date</th><th className="right">Total</th><th className="center">Items</th><th className="center">Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map(po => (
                <tr key={po.id} className="cursor-pointer" onClick={() => setSelectedPO(po)}>
                  <td className="mono font-medium">{po.poNumber}</td>
                  <td>{po.supplier.name}</td>
                  <td className="muted">{new Date(po.createdAt).toLocaleDateString('id-ID')}</td>
                  <td className="right bold">{formatCurrency(po.totalAmount)}</td>
                  <td className="center muted">{po.items.length}</td>
                  <td className="center"><Badge variant={statusColors[po.status] || 'default'}>{po.status}</Badge></td>
                  <td className="right"><button className="btn btn-sm btn-ghost">View</button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
          {filtered.length === 0 && <div className="empty-state"><p className="empty-title">No purchase orders</p></div>}
          </Card>
        )}
      </div>

      {/* Create PO */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Record Purchase" maxWidth="max-w-2xl">
        <div className="space-y-4">
          <Select label="Supplier" value={form.supplierId} onChange={e => setForm({...form, supplierId: e.target.value})}
            options={[{ value: '', label: 'Select supplier' }, ...suppliers.map(s => ({ value: s.id, label: s.name }))]} />

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Items</label>
              <button onClick={addItem} className="text-sm text-green-600 font-medium">+ Add Item</button>
            </div>
            {form.items.map((item, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select value={item.ingredientId}
                  onChange={e => {
                    const items = [...form.items]; items[i].ingredientId = e.target.value;
                    const ing = ingredients.find(ig => ig.id === e.target.value);
                    if (ing) items[i].unitPrice = String(ing.latestPrice);
                    setForm({...form, items});
                  }} className="select flex-1">
                  <option value="">Select ingredient</option>
                  {ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>)}
                </select>
                <input type="number" placeholder="Qty" value={item.quantity}
                  onChange={e => { const items = [...form.items]; items[i].quantity = e.target.value; setForm({...form, items}); }}
                  className="input w-24" />
                <input type="number" placeholder="Price" value={item.unitPrice}
                  onChange={e => { const items = [...form.items]; items[i].unitPrice = e.target.value; setForm({...form, items}); }}
                  className="input w-28" />
                <button onClick={() => setForm({...form, items: form.items.filter((_, idx) => idx !== i)})} className="p-2 text-red-400">✕</button>
              </div>
            ))}
            {form.items.length > 0 && <p className="text-sm font-bold text-right mt-2">Total: {formatCurrency(total)}</p>}
          </div>

          <Input label="Notes" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Optional" />

          <label className="flex items-center gap-3 p-3 bg-green-50 rounded-xl cursor-pointer">
            <input type="checkbox" checked={form.markComplete} onChange={e => setForm({...form, markComplete: e.target.checked})}
              className="w-4 h-4 text-green-600 rounded" />
            <div>
              <p className="text-sm font-medium text-green-800">Mark as received & paid</p>
              <p className="text-xs text-green-600">Stock will be updated and expense recorded automatically</p>
            </div>
          </label>

          <Button onClick={handleCreate} className="w-full">{form.markComplete ? 'Record Purchase & Update Stock' : 'Save as Draft'}</Button>
        </div>
      </Modal>

      {/* PO Detail */}
      <Modal open={!!selectedPO} onClose={() => setSelectedPO(null)} title={selectedPO?.poNumber || ''} maxWidth="max-w-2xl">
        {selectedPO && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Supplier:</span> <span className="font-medium">{selectedPO.supplier.name}</span></div>
              <div><span className="text-gray-500">Status:</span> <Badge variant={statusColors[selectedPO.status]}>{selectedPO.status}</Badge></div>
              <div><span className="text-gray-500">Date:</span> {new Date(selectedPO.createdAt).toLocaleDateString('id-ID')}</div>
              <div><span className="text-gray-500">Total:</span> <span className="font-bold">{formatCurrency(selectedPO.totalAmount)}</span></div>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-2">Items</h4>
              {selectedPO.items.map(item => (
                <div key={item.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5 text-sm mb-1">
                  <div><span className="font-medium">{item.ingredient.name}</span><span className="text-gray-400 ml-2">{item.quantity} {item.ingredient.unit}</span></div>
                  <span className="font-bold">{formatCurrency(item.totalPrice)}</span>
                </div>
              ))}
            </div>
            {selectedPO.status === 'COMPLETED' && (
              <div className="success-box">✅ Stock updated and expense of {formatCurrency(selectedPO.totalAmount)} recorded</div>
            )}
            {selectedPO.status === 'DRAFT' && (
              <div className="flex gap-2">
                <Button onClick={() => handleAction(selectedPO.id, 'complete')} className="flex-1">Mark as Received</Button>
                <Button variant="danger" onClick={() => handleAction(selectedPO.id, 'cancel')} className="flex-1">Cancel</Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
