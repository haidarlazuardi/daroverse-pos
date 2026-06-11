'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card, Button, Modal, Input, Loader, Badge } from '@/components/ui';
import { api } from '@/lib/fetch';

interface Supplier {
  id: string; name: string; contactPerson: string | null; phone: string | null;
  email: string | null; address: string | null; active: boolean;
  _count: { purchaseOrders: number };
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: '', contactPerson: '', phone: '', email: '', address: '' });

  const load = useCallback(async () => {
    try { setSuppliers(await api.get<Supplier[]>('/api/suppliers')); } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => setForm({ name: '', contactPerson: '', phone: '', email: '', address: '' });

  const handleAdd = async () => {
    try { await api.post('/api/suppliers', form); setShowAdd(false); resetForm(); load(); } catch (e) { console.error(e); }
  };

  const handleEdit = async () => {
    if (!editSupplier) return;
    try { await api.put('/api/suppliers', { id: editSupplier.id, ...form }); setEditSupplier(null); resetForm(); load(); } catch (e) { console.error(e); }
  };

  const openEdit = (s: Supplier) => {
    setForm({ name: s.name, contactPerson: s.contactPerson || '', phone: s.phone || '', email: s.email || '', address: s.address || '' });
    setEditSupplier(s);
  };

  const isEditing = !!editSupplier;
  const modalOpen = showAdd || isEditing;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h2 className="text-2xl font-bold text-surface-900">Suppliers</h2><p className="text-surface-500 text-sm mt-1">Manage your ingredient suppliers</p></div>
          <Button onClick={() => { resetForm(); setShowAdd(true); }}>+ Add Supplier</Button>
        </div>

        {loading ? <Loader /> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map(s => (
              <Card key={s.id}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">{s.name.charAt(0)}</div>
                  <Badge variant={s.active ? 'success' : 'default'}>{s.active ? 'Active' : 'Inactive'}</Badge>
                </div>
                <h3 className="font-bold text-surface-900">{s.name}</h3>
                {s.contactPerson && <p className="text-sm text-surface-500 mt-1">{s.contactPerson}</p>}
                {s.phone && <p className="text-sm text-surface-400">{s.phone}</p>}
                {s.email && <p className="text-sm text-surface-400">{s.email}</p>}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-surface-100">
                  <p className="text-xs text-surface-400">{s._count.purchaseOrders} POs</p>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>Edit</Button>
                </div>
              </Card>
            ))}
            {suppliers.length === 0 && <div className="col-span-full py-12 text-center text-surface-400">No suppliers yet</div>}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => { setShowAdd(false); setEditSupplier(null); resetForm(); }} title={isEditing ? `Edit: ${editSupplier?.name}` : 'Add Supplier'}>
        <div className="space-y-4">
          <Input label="Company Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <Input label="Contact Person" value={form.contactPerson} onChange={e => setForm({...form, contactPerson: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            <Input label="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          </div>
          <Input label="Address" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
          <Button onClick={isEditing ? handleEdit : handleAdd} className="w-full">{isEditing ? 'Update Supplier' : 'Add Supplier'}</Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}
