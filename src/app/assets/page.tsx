'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card, Button, Badge, Modal, Input, Select, Loader, StatCard, formatCurrency } from '@/components/ui';
import { api } from '@/lib/fetch';

const ASSET_CATEGORIES = ['Peralatan Dapur', 'Elektronik', 'Furnitur', 'Peralatan Bar', 'Kebersihan', 'Lainnya'];
const CONDITIONS = [
  { value: 'GOOD', label: 'Good' }, { value: 'FAIR', label: 'Fair' },
  { value: 'POOR', label: 'Poor' }, { value: 'BROKEN', label: 'Broken' },
];

export default function AssetsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [form, setForm] = useState({ name: '', code: '', category: 'Peralatan Dapur', condition: 'GOOD', purchaseDate: '', purchasePrice: '', location: '', supplier: '', notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/assets?';
      if (search) url += `search=${search}&`;
      if (filterCat) url += `category=${filterCat}&`;
      setData(await api.get(url));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, filterCat]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    try {
      await api.post('/api/assets', { ...form, purchasePrice: form.purchasePrice || undefined, currentValue: form.purchasePrice || undefined });
      setShowAdd(false); setForm({ name: '', code: '', category: 'Peralatan Dapur', condition: 'GOOD', purchaseDate: '', purchasePrice: '', location: '', supplier: '', notes: '' }); load();
    } catch (e) { console.error(e); }
  };

  const condColor: Record<string, 'success' | 'warning' | 'danger' | 'default'> = { GOOD: 'success', FAIR: 'warning', POOR: 'danger', BROKEN: 'danger', DISPOSED: 'default' };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><h2 className="text-2xl font-bold text-surface-900">Assets</h2><p className="text-surface-500 text-sm mt-1">Track equipment and inventory items</p></div>
          <Button onClick={() => setShowAdd(true)}>+ Add Asset</Button>
        </div>

        <Card>
          <div className="flex gap-3 flex-wrap">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets..." className="px-3 py-2 border border-surface-300 rounded-xl text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="px-3 py-2 border border-surface-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30">
              <option value="">All Categories</option>
              {ASSET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </Card>

        {loading || !data ? <Loader /> : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Assets" value={String((data.assets || []).length)} />
              <StatCard label="Total Value" value={formatCurrency(data.totalValue || 0)} />
              {Object.entries(data.byCategory as Record<string, { count: number; value: number }>).slice(0, 2).map(([cat, info]) => (
                <StatCard key={cat} label={cat} value={`${info.count} items`} sub={formatCurrency(info.value)} />
              ))}
            </div>

            <Card padding={false}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-surface-200">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Asset</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Category</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Location</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Condition</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Value</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Purchase Date</th>
                  </tr></thead>
                  <tbody className="divide-y divide-surface-100">
                    {(data.assets || []).map((a: any) => (
                      <tr key={a.id} className="hover:bg-surface-50">
                        <td className="px-6 py-4"><p className="text-sm font-medium text-surface-900">{a.name}</p>{a.code && <p className="text-xs text-surface-400">{a.code}</p>}</td>
                        <td className="px-6 py-4 text-sm text-surface-600">{a.category}</td>
                        <td className="px-6 py-4 text-sm text-surface-500">{a.location || '—'}</td>
                        <td className="px-6 py-4 text-center"><Badge variant={condColor[a.condition] || 'default'}>{a.condition}</Badge></td>
                        <td className="px-6 py-4 text-sm font-bold text-right">{a.currentValue ? formatCurrency(a.currentValue) : '—'}</td>
                        <td className="px-6 py-4 text-sm text-surface-500">{a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString('id-ID') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(data.assets || []).length === 0 && <div className="py-12 text-center text-surface-400">No assets found</div>}
              </div>
            </Card>
          </>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Asset" maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Asset Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Blender Philips" />
            <Input label="Asset Code" value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="Optional (e.g. EQ-001)" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Category" value={form.category} onChange={e => setForm({...form, category: e.target.value})} options={ASSET_CATEGORIES.map(c => ({ value: c, label: c }))} />
            <Select label="Condition" value={form.condition} onChange={e => setForm({...form, condition: e.target.value})} options={CONDITIONS} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Purchase Date" type="date" value={form.purchaseDate} onChange={e => setForm({...form, purchaseDate: e.target.value})} />
            <Input label="Purchase Price (IDR)" type="number" value={form.purchasePrice} onChange={e => setForm({...form, purchasePrice: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="e.g. Dapur, Bar" />
            <Input label="Supplier" value={form.supplier} onChange={e => setForm({...form, supplier: e.target.value})} />
          </div>
          <Input label="Notes" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
          <Button onClick={handleAdd} className="w-full">Add Asset</Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}
