'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, Button, Modal, formatCurrency } from '@/components/ui';
import { SlideOver } from '@/components/ui/SlideOver';
import { Toolbar } from '@/components/ui/Toolbar';
import { api } from '@/lib/fetch';
import clsx from 'clsx';
import * as XLSX from 'xlsx';

const EMPTY = { name: '', type: 'PERCENT', value: '', minOrder: '', maxDiscount: '', validFrom: '', validTo: '' };

export default function DiscountsPage() {
  const [data, setData]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm]       = useState({ ...EMPTY });
  const [saving, setSaving]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api.get('/api/discounts')); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setForm({ ...EMPTY }); setSlideOpen(true); }
  function openEdit(d: any) {
    setEditing(d);
    setForm({ name: d.name, type: d.type, value: String(d.value), minOrder: d.minOrder ? String(d.minOrder) : '', maxDiscount: d.maxDiscount ? String(d.maxDiscount) : '', validFrom: d.validFrom?.slice(0,10) || '', validTo: d.validTo?.slice(0,10) || '' });
    setSlideOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.value) return;
    setSaving(true);
    try {
      const payload = { ...form, value: parseFloat(form.value), minOrder: form.minOrder ? parseFloat(form.minOrder) : undefined, maxDiscount: form.maxDiscount ? parseFloat(form.maxDiscount) : undefined, validFrom: form.validFrom || undefined, validTo: form.validTo || undefined };
      if (editing) await api.put('/api/discounts', { id: editing.id, ...payload });
      else await api.post('/api/discounts', payload);
      setSlideOpen(false); load();
    } catch (e: any) { alert(e.message || 'Gagal'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await api.delete(`/api/discounts?id=${deleteTarget.id}`); setDeleteTarget(null); load(); }
    catch (e: any) { alert(e.message || 'Gagal'); }
    finally { setDeleting(false); }
  }

  async function toggleActive(d: any) {
    try { await api.put('/api/discounts', { id: d.id, active: !d.active }); load(); }
    catch (e) { console.error(e); }
  }

  function handleExport() {
    const ws = XLSX.utils.json_to_sheet(data.map(d => ({ Nama: d.name, Tipe: d.type, Nilai: d.value, 'Min Order': d.minOrder || '', 'Maks Diskon': d.maxDiscount || '', 'Berlaku Dari': d.validFrom?.slice(0,10) || '', 'Berlaku Sampai': d.validTo?.slice(0,10) || '', Status: d.active ? 'Aktif' : 'Nonaktif' })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Discounts');
    XLSX.writeFile(wb, 'discounts.xlsx');
  }

  const filtered = data.filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()));
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <div className="page-header">
          <div><h1 className="page-title">Diskon</h1><p className="page-subtitle">Kelola preset diskon untuk kasir POS</p></div>
        </div>

        <Toolbar search={search} onSearch={setSearch} searchPlaceholder="Cari nama diskon..." onExport={handleExport} onAdd={openAdd} addLabel="Tambah Diskon" />

        {loading ? (
          <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p className="empty-title">Belum ada diskon</p><p className="empty-text">Tambah preset diskon untuk digunakan kasir saat transaksi</p></div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(d => (
              <div key={d.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-lg flex-shrink-0">
                    {d.type === 'PERCENT' ? '%' : 'Rp'}
                  </div>
                  <Badge variant={d.active ? 'success' : 'default'}>{d.active ? 'Aktif' : 'Nonaktif'}</Badge>
                </div>
                <h3 className="font-bold text-gray-900">{d.name}</h3>
                <p className="text-2xl font-black text-purple-600 mt-1">
                  {d.type === 'PERCENT' ? `${d.value}%` : formatCurrency(d.value)}
                </p>
                <div className="mt-3 space-y-1 text-xs text-gray-400">
                  {d.minOrder   && <p>Min order: {formatCurrency(d.minOrder)}</p>}
                  {d.maxDiscount && <p>Maks diskon: {formatCurrency(d.maxDiscount)}</p>}
                  {d.validFrom  && <p>Dari: {new Date(d.validFrom).toLocaleDateString('id-ID')}</p>}
                  {d.validTo    && <p>Sampai: {new Date(d.validTo).toLocaleDateString('id-ID')}</p>}
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => toggleActive(d)} className={clsx('flex-1 py-2 text-xs font-semibold rounded-lg transition-colors', d.active ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100')}>
                    {d.active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  <button onClick={() => openEdit(d)} className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-brand-50 hover:text-brand-600 transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button onClick={() => setDeleteTarget(d)} className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SlideOver open={slideOpen} onClose={() => setSlideOpen(false)}
        title={editing ? 'Edit Diskon' : 'Tambah Diskon'}
        footer={<div className="flex justify-end gap-3"><button onClick={() => setSlideOpen(false)} className="btn btn-secondary btn-md">Batal</button><Button onClick={handleSave} disabled={saving || !form.name || !form.value}>{saving ? 'Menyimpan...' : 'Simpan'}</Button></div>}>
        <div className="space-y-4">
          <div><label className="label">Nama Diskon *</label><input className="input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="cth. Member 10%" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Tipe</label>
              <select className="select" value={form.type} onChange={e => f('type', e.target.value)}>
                <option value="PERCENT">Persentase (%)</option>
                <option value="FIXED">Nominal (Rp)</option>
              </select></div>
            <div><label className="label">Nilai *</label><input className="input" type="number" value={form.value} onChange={e => f('value', e.target.value)} placeholder={form.type === 'PERCENT' ? '10' : '5000'} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Min Order (Rp)</label><input className="input" type="number" value={form.minOrder} onChange={e => f('minOrder', e.target.value)} placeholder="Opsional" /></div>
            <div><label className="label">Maks Diskon (Rp)</label><input className="input" type="number" value={form.maxDiscount} onChange={e => f('maxDiscount', e.target.value)} placeholder="Opsional" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Berlaku Dari</label><input className="input" type="date" value={form.validFrom} onChange={e => f('validFrom', e.target.value)} /></div>
            <div><label className="label">Berlaku Sampai</label><input className="input" type="date" value={form.validTo} onChange={e => f('validTo', e.target.value)} /></div>
          </div>
        </div>
      </SlideOver>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus Diskon">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Yakin hapus diskon <span className="font-bold">{deleteTarget?.name}</span>?</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteTarget(null)} className="btn btn-secondary btn-md">Batal</button>
            <button onClick={handleDelete} disabled={deleting} className="btn btn-danger btn-md">{deleting ? 'Menghapus...' : 'Hapus'}</button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
