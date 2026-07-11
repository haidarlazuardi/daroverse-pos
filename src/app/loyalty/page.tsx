'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, Button, Modal, formatCurrency } from '@/components/ui';
import { SlideOver } from '@/components/ui/SlideOver';
import { Toolbar } from '@/components/ui/Toolbar';
import { api } from '@/lib/fetch';

const EMPTY = {
  name: '', description: '', pointsRequired: '',
  rewardType: 'FREE_PRODUCT', station: 'DRINK', maxPrice: '', discountAmount: '',
};
const STATION_LABEL: Record<string, string> = { DRINK: '🥤 Minuman', FOOD: '🍔 Makanan', '': '🎁 Semua' };

export default function LoyaltyPage() {
  const [rewards, setRewards]   = useState<any[]>([]);
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
    try { setRewards(await api.get<any[]>('/api/loyalty-rewards')); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setForm({ ...EMPTY }); setSlideOpen(true); }
  function openEdit(r: any) {
    setEditing(r);
    setForm({
      name: r.name, description: r.description || '',
      pointsRequired: String(r.pointsRequired),
      rewardType: r.rewardType,
      station: r.station || 'DRINK',
      maxPrice: r.maxPrice ? String(r.maxPrice) : '',
      discountAmount: r.discountAmount ? String(r.discountAmount) : '',
    });
    setSlideOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.pointsRequired) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        pointsRequired: parseInt(form.pointsRequired),
        rewardType: form.rewardType,
        station: form.rewardType === 'FREE_PRODUCT' ? (form.station || null) : null,
        maxPrice: form.rewardType === 'FREE_PRODUCT' && form.maxPrice ? parseFloat(form.maxPrice) : null,
        discountAmount: form.rewardType === 'DISCOUNT' && form.discountAmount ? parseFloat(form.discountAmount) : null,
      };
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
          <div>
            <h1 className="page-title">Loyalty Rewards</h1>
            <p className="page-subtitle">Checkpoint penukaran poin pelanggan</p>
          </div>
        </div>

        <div className="info-box mb-4">
          <strong>Cara kerja:</strong> Pelanggan dapat 1 poin per Rp 1.000 belanja.
          Poin bisa ditukar reward saat di POS, berlaku kelipatan.
          Contoh: 500 poin = 1 minuman gratis, 1.000 poin = 2 minuman gratis.
        </div>

        <Toolbar search={search} onSearch={setSearch} searchPlaceholder="Cari reward..." onAdd={openAdd} addLabel="Tambah Reward" />

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p className="text-4xl mb-3">🎁</p>
            <p className="empty-title">Belum ada reward</p>
            <p className="empty-text">Tambah checkpoint penukaran poin untuk pelanggan</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(r => (
              <div key={r.id} className="card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ background: 'rgba(72,101,77,0.1)' }}>
                    {r.rewardType === 'FREE_PRODUCT' ? (STATION_LABEL[r.station || '']?.split(' ')[0] || '🎁') : '💰'}
                  </div>
                  <Badge variant="success">Aktif</Badge>
                </div>

                <h3 className="font-bold text-base" style={{ color: 'var(--text-1)' }}>{r.name}</h3>
                {r.description && <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>{r.description}</p>}

                <div className="mt-4 p-3 rounded-xl" style={{ background: '#FFFBEB', border: '1px solid #fef08a' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-700">Checkpoint</span>
                    <span className="text-xl font-black text-amber-600">{r.pointsRequired} poin</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-amber-100">
                    <p className="text-sm font-bold text-amber-800">
                      {r.rewardType === 'FREE_PRODUCT'
                        ? `${STATION_LABEL[r.station || '']} gratis${r.maxPrice ? ` (max ${formatCurrency(r.maxPrice)})` : ''}`
                        : `Diskon ${formatCurrency(r.discountAmount)}`}
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Kelipatan: 2× = {r.pointsRequired * 2} poin, 3× = {r.pointsRequired * 3} poin
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button onClick={() => openEdit(r)}
                    className="flex-1 py-2 text-xs font-semibold rounded-lg transition-colors"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-1)' }}>
                    Edit
                  </button>
                  <button onClick={() => setDeleteTarget(r)}
                    className="p-2 rounded-lg transition-colors"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SlideOver open={slideOpen} onClose={() => setSlideOpen(false)}
        title={editing ? 'Edit Reward' : 'Tambah Reward'}
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setSlideOpen(false)} className="btn btn-secondary btn-md">Batal</button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.pointsRequired}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        }>
        <div className="space-y-4">
          <div>
            <label className="label">Nama Reward *</label>
            <input className="input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="cth. Minuman Gratis" />
          </div>
          <div>
            <label className="label">Deskripsi</label>
            <input className="input" value={form.description} onChange={e => f('description', e.target.value)} placeholder="Opsional" />
          </div>
          <div>
            <label className="label">Checkpoint Poin *</label>
            <input className="input" type="number" value={form.pointsRequired} onChange={e => f('pointsRequired', e.target.value)} placeholder="cth. 500" />
            {form.pointsRequired && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>
                = Rp {((parseInt(form.pointsRequired) || 0) * 1000).toLocaleString('id-ID')} total belanja
              </p>
            )}
          </div>
          <div>
            <label className="label">Tipe Reward</label>
            <select className="select" value={form.rewardType} onChange={e => f('rewardType', e.target.value)}>
              <option value="FREE_PRODUCT">Produk Gratis (bebas pilih)</option>
              <option value="DISCOUNT">Diskon Nominal (Rp)</option>
            </select>
          </div>

          {form.rewardType === 'FREE_PRODUCT' ? (
            <>
              <div>
                <label className="label">Kategori Produk</label>
                <select className="select" value={form.station} onChange={e => f('station', e.target.value)}>
                  <option value="DRINK">🥤 Minuman saja</option>
                  <option value="FOOD">🍔 Makanan saja</option>
                  <option value="">🎁 Semua</option>
                </select>
              </div>
              <div>
                <label className="label">Harga Maksimal (Rp)</label>
                <input className="input" type="number" value={form.maxPrice} onChange={e => f('maxPrice', e.target.value)} placeholder="Kosongkan = semua harga" />
              </div>
            </>
          ) : (
            <div>
              <label className="label">Jumlah Diskon (Rp)</label>
              <input className="input" type="number" value={form.discountAmount} onChange={e => f('discountAmount', e.target.value)} placeholder="cth. 10000" />
            </div>
          )}

          {form.pointsRequired && (
            <div className="p-3 rounded-xl" style={{ background: '#FFFBEB', border: '1px solid #fef08a' }}>
              <p className="text-xs font-semibold text-amber-700 mb-2">Preview Kelipatan</p>
              {[1, 2, 3].map(n => (
                <div key={n} className="flex justify-between text-xs text-amber-600">
                  <span>{n}× reward</span>
                  <span className="font-bold">
                    {(parseInt(form.pointsRequired) || 0) * n} poin
                    = Rp {(((parseInt(form.pointsRequired) || 0) * n) * 1000).toLocaleString('id-ID')} belanja
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </SlideOver>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus Reward">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            Yakin hapus <span className="font-bold" style={{ color: 'var(--text-1)' }}>{deleteTarget?.name}</span>?
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteTarget(null)} className="btn btn-secondary btn-md">Batal</button>
            <button onClick={handleDelete} disabled={deleting} className="btn btn-danger btn-md">
              {deleting ? 'Menghapus...' : 'Hapus'}
            </button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
