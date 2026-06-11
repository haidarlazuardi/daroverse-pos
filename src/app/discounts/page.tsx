'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card, Button, Badge, Modal, Input, Select, Loader, formatCurrency } from '@/components/ui';
import { api } from '@/lib/fetch';

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'PERCENT', value: '', minOrder: '', maxDiscount: '', validFrom: '', validTo: '' });

  const load = useCallback(async () => {
    try { setDiscounts(await api.get('/api/discounts')); } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    try {
      await api.post('/api/discounts', { ...form, value: form.value, minOrder: form.minOrder || undefined, maxDiscount: form.maxDiscount || undefined, validFrom: form.validFrom || undefined, validTo: form.validTo || undefined });
      setShowAdd(false); setForm({ name: '', type: 'PERCENT', value: '', minOrder: '', maxDiscount: '', validFrom: '', validTo: '' }); load();
    } catch (e) { console.error(e); }
  };

  const toggleActive = async (id: string, active: boolean) => {
    try { await api.put('/api/discounts', { id, active: !active }); load(); } catch (e) { console.error(e); }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h2 className="text-2xl font-bold text-surface-900">Discounts</h2><p className="text-surface-500 text-sm mt-1">Setup discount presets for POS cashier</p></div>
          <Button onClick={() => setShowAdd(true)}>+ Add Discount</Button>
        </div>

        {loading ? <Loader /> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {discounts.map(d => (
              <Card key={d.id}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-lg">
                    {d.type === 'PERCENT' ? '%' : 'Rp'}
                  </div>
                  <Badge variant={d.active ? 'success' : 'default'}>{d.active ? 'Active' : 'Inactive'}</Badge>
                </div>
                <h3 className="font-bold text-surface-900">{d.name}</h3>
                <p className="text-2xl font-bold text-purple-600 mt-1">
                  {d.type === 'PERCENT' ? `${d.value}%` : formatCurrency(d.value)}
                </p>
                <div className="mt-3 space-y-1 text-xs text-surface-500">
                  {d.minOrder && <p>Min order: {formatCurrency(d.minOrder)}</p>}
                  {d.maxDiscount && <p>Max discount: {formatCurrency(d.maxDiscount)}</p>}
                  {d.validFrom && <p>From: {new Date(d.validFrom).toLocaleDateString('id-ID')}</p>}
                  {d.validTo && <p>Until: {new Date(d.validTo).toLocaleDateString('id-ID')}</p>}
                </div>
                <button onClick={() => toggleActive(d.id, d.active)} className="mt-4 w-full py-2 text-sm font-medium bg-surface-50 hover:bg-surface-100 rounded-lg transition-colors">
                  {d.active ? 'Deactivate' : 'Activate'}
                </button>
              </Card>
            ))}
            {discounts.length === 0 && <div className="col-span-full py-12 text-center text-surface-400">No discounts yet</div>}
          </div>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Discount Preset">
        <div className="space-y-4">
          <Input label="Discount Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Member 10%" />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type" value={form.type} onChange={e => setForm({...form, type: e.target.value})} options={[{ value: 'PERCENT', label: 'Percentage (%)' }, { value: 'FIXED', label: 'Fixed Amount (Rp)' }]} />
            <Input label={form.type === 'PERCENT' ? 'Value (%)' : 'Value (IDR)'} type="number" value={form.value} onChange={e => setForm({...form, value: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Min Order (IDR)" type="number" value={form.minOrder} onChange={e => setForm({...form, minOrder: e.target.value})} placeholder="Optional" />
            <Input label="Max Discount (IDR)" type="number" value={form.maxDiscount} onChange={e => setForm({...form, maxDiscount: e.target.value})} placeholder="Optional (for %)" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Valid From" type="date" value={form.validFrom} onChange={e => setForm({...form, validFrom: e.target.value})} />
            <Input label="Valid To" type="date" value={form.validTo} onChange={e => setForm({...form, validTo: e.target.value})} />
          </div>
          <Button onClick={handleAdd} className="w-full">Create Discount</Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}
