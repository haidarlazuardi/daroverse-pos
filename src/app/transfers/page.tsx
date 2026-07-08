'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, Button, formatNumber } from '@/components/ui';
import { DataTable, Column } from '@/components/ui/DataTable';
import { SlideOver } from '@/components/ui/SlideOver';
import { Toolbar } from '@/components/ui/Toolbar';
import { api } from '@/lib/fetch';

interface Ingredient { id: string; name: string; unit: string; stockLevels: { location: string; quantity: number }[] }
interface Movement  { id: string; quantity: number; location: string; notes: string | null; createdAt: string; ingredient: { name: string; unit: string } }

const LOCS: Record<string,string> = { GUDANG: 'Gudang', BAR: 'Bar', KITCHEN: 'Dapur' };

export default function TransfersPage() {
  const [moves, setMoves]           = useState<Movement[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading]       = useState(true);
  const [slideOpen, setSlideOpen]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState('');
  const [form, setForm]             = useState({ ingredientId: '', fromLocation: 'GUDANG', toLocation: 'BAR', quantity: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, ings] = await Promise.all([api.get<any>('/api/transfers'), api.get<Ingredient[]>('/api/ingredients')]);
      setMoves(t.transfers || []); setIngredients(ings);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedIng = ingredients.find(i => i.id === form.ingredientId);
  const fromStock   = selectedIng?.stockLevels.find(s => s.location === form.fromLocation)?.quantity ?? 0;

  function openSlide() { setForm({ ingredientId: '', fromLocation: 'GUDANG', toLocation: 'BAR', quantity: '' }); setFormError(''); setSlideOpen(true); }

  async function handleTransfer() {
    if (!form.ingredientId) { setFormError('Pilih bahan'); return; }
    if (!form.quantity || parseFloat(form.quantity) <= 0) { setFormError('Jumlah harus lebih dari 0'); return; }
    if (form.fromLocation === form.toLocation) { setFormError('Lokasi asal dan tujuan tidak boleh sama'); return; }
    setSaving(true); setFormError('');
    try {
      await api.post('/api/transfers', { ingredientId: form.ingredientId, fromLocation: form.fromLocation, toLocation: form.toLocation, quantity: parseFloat(form.quantity) });
      setSlideOpen(false); load();
    } catch (e: any) { setFormError(e?.message || 'Gagal transfer'); }
    finally { setSaving(false); }
  }

  const columns: Column<Movement>[] = [
    {
      key: 'createdAt', label: 'Waktu', sortable: true, width: 'w-36',
      render: m => <span className="text-gray-500 text-sm">{new Date(m.createdAt).toLocaleDateString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</span>,
    },
    {
      key: 'ingredient', label: 'Bahan', sortable: true,
      render: m => <span className="font-medium text-gray-900">{m.ingredient.name}</span>,
    },
    {
      key: 'location', label: 'Tujuan', width: 'w-28',
      render: m => <Badge variant="info">{LOCS[m.location] ?? m.location}</Badge>,
    },
    {
      key: 'quantity', label: 'Jumlah', sortable: true, width: 'w-32',
      render: m => <span className="font-medium text-brand-700">+{formatNumber(m.quantity)} {m.ingredient.unit}</span>,
    },
    {
      key: 'notes', label: 'Catatan',
      render: m => <span className="text-gray-400 text-sm">{m.notes || '—'}</span>,
    },
  ];

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Transfer Stok</h1>
          <p className="text-sm text-gray-500 mt-1">Pindahkan bahan antar lokasi (Gudang → Bar / Dapur)</p>
        </div>

        <Toolbar onAdd={openSlide} addLabel="Transfer Baru" />

        <DataTable
          data={moves} columns={columns} keyField="id" loading={loading}
          emptyMessage="Belum ada riwayat transfer."
        />
      </div>

      <SlideOver open={slideOpen} onClose={() => setSlideOpen(false)} title="Transfer Stok"
        subtitle="Pindahkan bahan dari satu lokasi ke lokasi lain"
        footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setSlideOpen(false)} disabled={saving}>Batal</Button><Button onClick={handleTransfer} disabled={saving}>{saving ? 'Memproses...' : 'Transfer'}</Button></div>}
      >
        {formError && <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{formError}</div>}
        <div>
          <label className="label">Bahan <span className="text-red-400">*</span></label>
          <select className="select w-full" value={form.ingredientId} onChange={e => setForm({ ...form, ingredientId: e.target.value })}>
            <option value="">— Pilih bahan —</option>
            {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Dari</label>
            <select className="select w-full" value={form.fromLocation} onChange={e => setForm({ ...form, fromLocation: e.target.value })}>
              {Object.entries(LOCS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {selectedIng && <p className="text-xs text-gray-400 mt-1">Stok: {formatNumber(fromStock)} {selectedIng.unit}</p>}
          </div>
          <div>
            <label className="label">Ke</label>
            <select className="select w-full" value={form.toLocation} onChange={e => setForm({ ...form, toLocation: e.target.value })}>
              {Object.entries(LOCS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Jumlah {selectedIng ? `(${selectedIng.unit})` : ''} <span className="text-red-400">*</span></label>
          <input className="input w-full" type="number" placeholder="0" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
          {selectedIng && form.quantity && parseFloat(form.quantity) > fromStock && (
            <p className="text-xs text-red-500 mt-1">⚠️ Melebihi stok di {LOCS[form.fromLocation]} ({formatNumber(fromStock)} {selectedIng.unit})</p>
          )}
        </div>
      </SlideOver>
    </AdminLayout>
  );
}
