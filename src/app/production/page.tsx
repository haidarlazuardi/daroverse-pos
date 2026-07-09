'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card, Button, Badge, Modal, Loader } from '@/components/ui';
import { api } from '@/lib/fetch';

interface Ingredient { id: string; name: string; unit: string; type: 'RAW' | 'PREPPED' }
interface PO {
  id: string; number: string; status: string; plannedYield: number; actualYield: number | null;
  location: string; createdAt: string; ingredient: { name: string; unit: string };
}

export default function ProductionPage() {
  const [orders, setOrders] = useState<PO[]>([]);
  const [prepped, setPrepped] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ ingredientId: '', batchMultiplier: '1', location: 'BAR', actualYield: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [po, ings] = await Promise.all([
        api.get<any>('/api/production'),
        api.get<Ingredient[]>('/api/ingredients?type=PREPPED'),
      ]);
      setOrders(po.productionOrders || []);
      setPrepped(ings.filter((i) => i.type === 'PREPPED'));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!form.ingredientId) return;
    setBusy(true);
    try {
      await api.post('/api/production', {
        ingredientId: form.ingredientId,
        batchMultiplier: parseFloat(form.batchMultiplier) || 1,
        location: form.location,
        actualYield: form.actualYield ? parseFloat(form.actualYield) : undefined,
        execute: true,
      });
      setShow(false); setForm({ ingredientId: '', batchMultiplier: '1', location: 'BAR', actualYield: '' }); load();
    } catch (e: any) { alert(e.message || 'Gagal'); } finally { setBusy(false); }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h2 className="text-xl sm:text-2xl font-bold text-surface-900">Produksi</h2><p className="text-surface-500 text-sm mt-1">Racik stok olahan dari bahan mentah</p></div>
          <Button onClick={() => setShow(true)}>+ Bikin batch</Button>
        </div>

        {loading ? <Loader /> : (
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-surface-200">
                  {['No', 'Olahan', 'Lokasi', 'Rencana', 'Hasil', 'Status', 'Tanggal'].map((h) => <th key={h} className="text-left px-3 sm:px-6 py-3 text-xs font-semibold text-surface-500 uppercase">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-surface-100">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-surface-50 text-sm">
                      <td className="px-3 sm:px-6 py-3 font-mono text-xs">{o.number}</td>
                      <td className="px-3 sm:px-6 py-3 font-medium">{o.ingredient?.name}</td>
                      <td className="px-3 sm:px-6 py-3">{o.location}</td>
                      <td className="px-3 sm:px-6 py-3">{o.plannedYield} {o.ingredient?.unit}</td>
                      <td className="px-3 sm:px-6 py-3">{o.actualYield ?? '—'} {o.actualYield ? o.ingredient?.unit : ''}</td>
                      <td className="px-3 sm:px-6 py-3"><Badge variant={o.status === 'COMPLETED' ? 'success' : o.status === 'CANCELLED' ? 'danger' : 'default'}>{o.status}</Badge></td>
                      <td className="px-3 sm:px-6 py-3 text-surface-400">{new Date(o.createdAt).toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {orders.length === 0 && <div className="py-12 text-center text-surface-400">Belum ada produksi</div>}
            </div>
          </Card>
        )}
      </div>

      <Modal open={show} onClose={() => setShow(false)} title="Bikin batch">
        <div className="space-y-4">
          <div><label className="label">Olahan</label>
            <select value={form.ingredientId} onChange={(e) => setForm({ ...form, ingredientId: e.target.value })} className="select">
              <option value="">Pilih olahan</option>
              {prepped.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select></div>
          <div><label className="label">Jumlah batch</label><input type="number" min="0.5" step="0.5" value={form.batchMultiplier} onChange={(e) => setForm({ ...form, batchMultiplier: e.target.value })} className="input" /></div>
          <div><label className="label">Lokasi</label>
            <select value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="select">
              <option value="BAR">Bar</option><option value="KITCHEN">Dapur</option>
            </select></div>
          <div><label className="label">Hasil aktual (opsional)</label><input type="number" value={form.actualYield} onChange={(e) => setForm({ ...form, actualYield: e.target.value })} className="input" placeholder="Kosongkan = sesuai rencana" /></div>
          <Button onClick={submit} disabled={busy} className="w-full">{busy ? 'Memproses...' : 'Bikin & potong stok'}</Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}
