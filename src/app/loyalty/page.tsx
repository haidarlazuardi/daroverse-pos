'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, Button, Modal, StatCard, formatCurrency } from '@/components/ui';
import { SlideOver } from '@/components/ui/SlideOver';
import { Toolbar } from '@/components/ui/Toolbar';
import { api } from '@/lib/fetch';

const EMPTY = { name: '', description: '', pointsRequired: '', rewardType: 'FREE_PRODUCT', productId: '', discountAmount: '' };

export default function LoyaltyPage() {
  const [rewards, setRewards]   = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing]   = useState<any>(null);
  const [form, setForm]         = useState({ ...EMPTY });
  const [saving, setSaving]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([
        api.get<any[]>('/api/loyalty-rewards'),
        api.get<any[]>('/api/products'),
      ]);
      setRewards(r);
      setProducts(p.filter((p: any) => p.active));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setForm({ ...EMPTY }); setSlideOpen(true); }
  function openEdit(r: any) {
    setEditing(r);
    setForm({ name: r.name, description: r.description || '', pointsRequired: String(r.pointsRequired), rewardType: r.rewardType, productId: r.productId || '', discountAmount: r.discountAmount ? String(r.discountAmount) : '' });
    setSlideOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.pointsRequired) return;
    setSaving(true);
    try {
      const payload = { ...form, pointsRequired: parseInt(form.pointsRequired), productId: form.productId || null, discountAmount: form.discountAmount ? parseFloat(form.discountAmount) : null };
      if (editing) await api.patch('/api/loyalty-rewards', { id: editing.id, ...payload });
      else await api.post('/api/loyalty-rewards', payload);
      setSlideOpen(false); load();
    } catch (e: any) { alert(e.message || 'Gagal'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await api.delete(`/api/loyalty-rewards?id=${deleteTarget.id}`); setDeleteTarget(null); load(); }
    catch (e: any) { alert(e.message || 'Gagal'); }
    finally { setDeleting(false); }
  }

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const filtered = rewards.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto">
        <div className="page-header">
          <div><h1 className="page-title">Loyalty Rewards</h1><p className="page-subtitle">Konfigurasi hadiah yang bisa ditukar pelanggan dengan poin</p></div>
        </div>

        <Toolbar search={search} onSearch={setSearch} searchPlaceholder="Cari reward..." onAdd={openAdd} addLabel="Tambah Reward" />

        {loading ? (
          <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p className="text-4xl mb-3">🎁</p>
            <p className="empty-title">Belum ada reward</p>
            <p className="empty-text">Tambah reward yang bisa ditukar pelanggan dengan poin loyalty</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(r => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl" style={{ background: 'rgba(72,101,77,0.1)' }}>
                    {r.rewardType === 'FREE_PRODUCT' ? '🎁' : '💰'}
                  </div>
                  <Badge variant={r.active ? 'success' : 'default'}>{r.active ? 'Aktif' : 'Nonaktif'}</Badge>
                </div>
                <h3 className="font-bold text-base" style={{ color: 'var(--text-1)' }}>{r.name}</h3>
                {r.description && <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>{r.description}</p>}
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-2)' }}>Poin dibutuhkan</span>
                    <span className="font-black text-amber-600 text-lg">{r.pointsRequired} poin</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-2)' }}>Benefit</span>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                      {r.rewardType === 'FREE_PRODUCT' ? r.product?.name || 'Produk gratis' : `Diskon ${formatCurrency(r.discountAmount)}`}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => openEdit(r)} className="flex-1 py-2 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors" style={{ color: 'var(--text-1)' }}>Edit</button>
                  <button onClick={() => setDeleteTarget(r)} className="p-2 rounded-lg bg-gray-100 hover:bg-red-50 hover:text-red-600 transition-colors" style={{ color: 'var(--text-3)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SlideOver open={slideOpen} onClose={() => setSlideOpen(false)}
        title={editing ? 'Edit Reward' : 'Tambah Reward'}
        footer={<div className="flex justify-end gap-3"><button onClick={() => setSlideOpen(false)} className="btn btn-secondary btn-md">Batal</button><Button onClick={handleSave} disabled={saving || !form.name || !form.pointsRequired}>{saving ? 'Menyimpan...' : 'Simpan'}</Button></div>}>
        <div className="space-y-4">
          <div><label className="label">Nama Reward *</label><input className="input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="cth. Kopi Gratis" /></div>
          <div><label className="label">Deskripsi</label><input className="input" value={form.description} onChange={e => f('description', e.target.value)} placeholder="Opsional" /></div>
          <div><label className="label">Poin yang Dibutuhkan *</label>
            <input className="input" type="number" value={form.pointsRequired} onChange={e => f('pointsRequired', e.target.value)} placeholder="cth. 100" />
          </div>
          <div><label className="label">Tipe Reward</label>
            <select className="select" value={form.rewardType} onChange={e => f('rewardType', e.target.value)}>
              <option value="FREE_PRODUCT">Produk Gratis</option>
              <option value="DISCOUNT">Diskon Nominal (Rp)</option>
            </select>
          </div>
          {form.rewardType === 'FREE_PRODUCT' ? (
            <div><label className="label">Produk yang Diberikan</label>
              <select className="select" value={form.productId} onChange={e => f('productId', e.target.value)}>
                <option value="">Pilih produk</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}</option>)}
              </select>
            </div>
          ) : (
            <div><label className="label">Jumlah Diskon (Rp)</label>
              <input className="input" type="number" value={form.discountAmount} onChange={e => f('discountAmount', e.target.value)} placeholder="cth. 10000" />
            </div>
          )}
        </div>
      </SlideOver>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus Reward">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>Yakin hapus reward <span className="font-bold" style={{ color: 'var(--text-1)' }}>{deleteTarget?.name}</span>?</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteTarget(null)} className="btn btn-secondary btn-md">Batal</button>
            <button onClick={handleDelete} disabled={deleting} className="btn btn-danger btn-md">{deleting ? 'Menghapus...' : 'Hapus'}</button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
