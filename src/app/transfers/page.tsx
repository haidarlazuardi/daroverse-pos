'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card, Button, Loader, Modal } from '@/components/ui';
import { api } from '@/lib/fetch';

interface Ingredient { id: string; name: string; unit: string; stockLevels: { location: string; quantity: number }[] }
interface Movement { id: string; quantity: number; location: string; createdAt: string; ingredient: { name: string; unit: string } }

export default function TransfersPage() {
  const [moves, setMoves] = useState<Movement[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ ingredientId: '', toLocation: 'BAR', quantity: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, ings] = await Promise.all([
        api.get<any>('/api/transfers'),
        api.get<Ingredient[]>('/api/ingredients'),
      ]);
      setMoves(t.transfers || []); setIngredients(ings);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const gudangStock = (i: Ingredient) => i.stockLevels?.find((s) => s.location === 'GUDANG')?.quantity ?? 0;
  const fromGudang = ingredients.filter((i) => gudangStock(i) > 0);
  const sel = ingredients.find((i) => i.id === form.ingredientId);

  const submit = async () => {
    if (!form.ingredientId || !form.quantity) return;
    setBusy(true);
    try {
      await api.post('/api/transfers', { ingredientId: form.ingredientId, toLocation: form.toLocation, quantity: parseFloat(form.quantity) });
      setShow(false); setForm({ ingredientId: '', toLocation: 'BAR', quantity: '' }); load();
    } catch (e: any) { alert(e.message || 'Gagal'); } finally { setBusy(false); }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h2 className="text-2xl font-bold text-surface-900">Transfer</h2><p className="text-surface-500 text-sm mt-1">Pindah stok gudang ke bar / dapur</p></div>
          <Button onClick={() => setShow(true)}>+ Transfer</Button>
        </div>

        {loading ? <Loader /> : (
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-surface-200">
                  {['Bahan', 'Ke', 'Jumlah', 'Tanggal'].map((h) => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-surface-100">
                  {moves.map((m) => (
                    <tr key={m.id} className="hover:bg-surface-50 text-sm">
                      <td className="px-6 py-3 font-medium">{m.ingredient?.name}</td>
                      <td className="px-6 py-3">{m.location}</td>
                      <td className="px-6 py-3">{m.quantity} {m.ingredient?.unit}</td>
                      <td className="px-6 py-3 text-surface-400">{new Date(m.createdAt).toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {moves.length === 0 && <div className="py-12 text-center text-surface-400">Belum ada transfer</div>}
            </div>
          </Card>
        )}
      </div>

      <Modal open={show} onClose={() => setShow(false)} title="Transfer stok">
        <div className="space-y-4">
          <div><label className="label">Bahan (ada stok di gudang)</label>
            <select value={form.ingredientId} onChange={(e) => setForm({ ...form, ingredientId: e.target.value })} className="select">
              <option value="">Pilih bahan</option>
              {fromGudang.map((i) => <option key={i.id} value={i.id}>{i.name} (sisa {gudangStock(i)} {i.unit})</option>)}
            </select></div>
          <div><label className="label">Jumlah {sel ? `(${sel.unit})` : ''}</label><input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="input" /></div>
          <div><label className="label">Ke</label>
            <select value={form.toLocation} onChange={(e) => setForm({ ...form, toLocation: e.target.value })} className="select">
              <option value="BAR">Bar</option><option value="KITCHEN">Dapur</option>
            </select></div>
          <Button onClick={submit} disabled={busy} className="w-full">{busy ? 'Memproses...' : 'Transfer sekarang'}</Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}
