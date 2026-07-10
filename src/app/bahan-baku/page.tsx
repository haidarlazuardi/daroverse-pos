'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, Button, Modal, formatCurrency, formatNumber } from '@/components/ui';
import { SlideOver } from '@/components/ui/SlideOver';
import { Toolbar } from '@/components/ui/Toolbar';
import { api } from '@/lib/fetch';
import clsx from 'clsx';
import * as XLSX from 'xlsx';

interface Ingredient {
  id: string; name: string; type: string;
  unit: string; purchaseUnit: string | null; conversionRate: number | null;
  latestPrice: number; minStock: number; active: boolean;
}

const EMPTY_FORM = {
  name: '', unit: 'g', purchaseUnit: '', conversionRate: '',
  latestPrice: '', minStock: '',
};

// ── Kategori grouping ─────────────────────────────────────────────────────────
const GROUPS: { label: string; keys: string[] }[] = [
  { label: '🥛 Dairy, Base & Minuman',   keys: ['susu','creamer','evaporasi','skm','freshmilk','oat milk','mineral','galon','air'] },
  { label: '☕ Kopi & Teh',              keys: ['beans','kopi','house blend','anaerobic','idjen','specialty','teh','coldbrew','espresso'] },
  { label: '🍯 Sirup, Flavour & Powder', keys: ['flavour','sirup','gula','liquid aren','simple syrup','dark choco','matcha','vanila','caramel','pandan','strawberry','butterscotch','mint','peach','fruity','tiramisu','berry juice','orange juice','soda','tonic','baking soda','chocolate crumble'] },
  { label: '🥩 Protein',                 keys: ['ayam','daging','sayap','kulit','paha','telur','bacon','beef'] },
  { label: '🥬 Sayur & Buah',            keys: ['nanas','kentang','pisang','lettuce','selada','bawang','cabai','hijau','lengkuas','daun jeruk'] },
  { label: '🧂 Bumbu & Seasoning',       keys: ['sea salt','cajun','smoke powder','cayenne','penyedap','margarin','minyak','kecap','saus','mayonaise','tiram','bbq','maizena','terigu','tepung'] },
  { label: '🍞 Dry Goods & Packaging',   keys: ['beras','burger bun','red cheddar','cheddar'] },
];

function categorize(name: string): string {
  const lower = name.toLowerCase();
  for (const g of GROUPS) {
    if (g.keys.some(k => lower.includes(k))) return g.label;
  }
  return '📦 Lainnya';
}

const UNITS = ['g','ml','pcs','kg','liter','botol','pack','kaleng','lembar','buah'];

export default function BahanBakuPage() {
  const [data, setData]       = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm]       = useState({ ...EMPTY_FORM });
  const [saving, setSaving]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Ingredient | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Ingredient[]>('/api/ingredients');
      setData(res.filter(i => i.type === 'RAW' && i.active));
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setSlideOpen(true);
  }

  function openEdit(ing: Ingredient) {
    setEditing(ing);
    setForm({
      name: ing.name,
      unit: ing.unit,
      purchaseUnit: ing.purchaseUnit || '',
      conversionRate: ing.conversionRate ? String(ing.conversionRate) : '',
      latestPrice: String(ing.latestPrice),
      minStock: String(ing.minStock),
    });
    setSlideOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.unit || !form.latestPrice) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        unit: form.unit,
        purchaseUnit: form.purchaseUnit || null,
        conversionRate: form.conversionRate ? parseFloat(form.conversionRate) : null,
        latestPrice: parseFloat(form.latestPrice),
        minStock: parseFloat(form.minStock) || 0,
        type: 'RAW',
        active: true,
      };
      if (editing) {
        await api.patch('/api/ingredients', { id: editing.id, ...payload });
      } else {
        await api.post('/api/ingredients', payload);
      }
      setSlideOpen(false);
      load();
    } catch (e: any) { alert(e.message || 'Gagal menyimpan'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/ingredients?id=${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } catch (e: any) { alert(e.message || 'Gagal menghapus'); }
    finally { setDeleting(false); }
  }

  function handleExport() {
    const rows = data.map(ing => ({
      Nama: ing.name,
      'Satuan Pakai': ing.unit,
      'Satuan Beli': ing.purchaseUnit || '',
      'Isi per Satuan Beli': ing.conversionRate || '',
      'Harga Beli (Rp)': (ing.latestPrice || 0) * (ing.conversionRate || 1),
      'Harga per Satuan Pakai (Rp)': ing.latestPrice,
      'Min Stok': ing.minStock,
      Kategori: categorize(ing.name),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 10 }, { wch: 25 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bahan Baku');
    XLSX.writeFile(wb, 'bahan-baku-soeka.xlsx');
  }

  const filtered = search
    ? data.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : data;

  // Group
  const grouped = new Map<string, Ingredient[]>();
  for (const ing of filtered) {
    const cat = categorize(ing.name);
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(ing);
  }
  const sortedGroups = Array.from(grouped.entries()).sort((a, b) => {
    const ai = GROUPS.findIndex(g => g.label === a[0]);
    const bi = GROUPS.findIndex(g => g.label === b[0]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <div className="page-header">
          <div>
            <h1 className="page-title">Bahan Baku</h1>
            <p className="page-subtitle">Master data harga & satuan bahan baku</p>
          </div>
          <span className="badge badge-default">{data.length} bahan aktif</span>
        </div>

        <Toolbar
          search={search} onSearch={setSearch} searchPlaceholder="Cari bahan..."
          onExport={handleExport}
          onAdd={openAdd} addLabel="Tambah Bahan"
        />

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sortedGroups.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">Tidak ada bahan ditemukan</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedGroups.map(([category, items]) => (
              <div key={category}>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-sm font-bold text-gray-700">{category}</h2>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">{items.length} bahan</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Nama Bahan</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Satuan Beli</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Isi / Satuan</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Harga Beli</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Harga / Unit</th>
                          <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Satuan</th>
                          <th className="px-4 py-2.5 w-20" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {items.map(ing => {
                          const hargaBeli = (ing.latestPrice || 0) * (ing.conversionRate || 1);
                          return (
                            <tr key={ing.id} className="hover:bg-gray-50/50 transition-colors group">
                              <td className="px-4 py-3">
                                <span className="font-semibold text-gray-900">{ing.name}</span>
                                {ing.minStock > 0 && (
                                  <p className="text-xs text-gray-400 mt-0.5">Min: {formatNumber(ing.minStock)} {ing.unit}</p>
                                )}
                              </td>
                              <td className="px-4 py-3 hidden sm:table-cell text-gray-500">
                                {ing.purchaseUnit || '—'}
                              </td>
                              <td className="px-4 py-3 text-right hidden md:table-cell">
                                <span className="text-gray-500 font-mono text-xs">
                                  {ing.conversionRate ? `${formatNumber(ing.conversionRate)} ${ing.unit}` : '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="font-semibold text-gray-900">{formatCurrency(hargaBeli)}</span>
                                <span className="text-xs text-gray-400 block">/{ing.purchaseUnit || 'unit'}</span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-brand-700 font-bold text-sm">{formatCurrency(ing.latestPrice)}</span>
                                <span className="text-xs text-gray-400 block">/{ing.unit}</span>
                              </td>
                              <td className="px-4 py-3 text-center hidden sm:table-cell">
                                <span className="badge badge-default">{ing.unit}</span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => openEdit(ing)}
                                    className="p-1.5 rounded-lg hover:bg-brand-50 text-gray-400 hover:text-brand-600 transition-colors"
                                    title="Edit">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                    </svg>
                                  </button>
                                  <button onClick={() => setDeleteTarget(ing)}
                                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                                    title="Hapus">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                      <polyline points="3 6 5 6 21 6"/>
                                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                                      <path d="M10 11v6M14 11v6"/>
                                      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── SlideOver Edit/Add ─────────────────────────────────────────────── */}
      {slideOpen && (
        <SlideOver
          open={slideOpen}
          onClose={() => setSlideOpen(false)}
          title={editing ? `Edit: ${editing.name}` : 'Tambah Bahan Baku'}
          subtitle={editing ? 'Update data bahan baku' : 'Tambah bahan baru ke master data'}
          footer={
            <div className="flex justify-end gap-3">
              <button onClick={() => setSlideOpen(false)} className="btn btn-secondary btn-md">Batal</button>
              <Button onClick={handleSave} disabled={saving || !form.name || !form.latestPrice}>
                {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Tambah Bahan'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Nama */}
            <div>
              <label className="label">Nama Bahan *</label>
              <input className="input" value={form.name} onChange={e => f('name', e.target.value)}
                placeholder="cth. Susu Freshmilk Diamond" />
            </div>

            {/* Satuan Pakai */}
            <div>
              <label className="label">Satuan Pakai *</label>
              <select className="select" value={form.unit} onChange={e => f('unit', e.target.value)}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Satuan yang dipakai di resep (g, ml, pcs, dll)</p>
            </div>

            {/* Satuan Beli */}
            <div>
              <label className="label">Satuan Beli</label>
              <input className="input" value={form.purchaseUnit} onChange={e => f('purchaseUnit', e.target.value)}
                placeholder="cth. kg, pack, botol, karton" />
              <p className="text-xs text-gray-400 mt-1">Satuan saat beli dari supplier</p>
            </div>

            {/* Isi per Satuan Beli */}
            <div>
              <label className="label">Isi per Satuan Beli ({form.unit})</label>
              <input className="input" type="number" value={form.conversionRate}
                onChange={e => f('conversionRate', e.target.value)}
                placeholder="cth. 1000 (artinya 1 kg = 1000 g)" />
              <p className="text-xs text-gray-400 mt-1">Berapa {form.unit || 'unit'} dalam 1 {form.purchaseUnit || 'satuan beli'}</p>
            </div>

            {/* Harga Beli per Satuan Beli */}
            <div>
              <label className="label">Harga Beli per {form.purchaseUnit || 'Satuan Beli'} (Rp) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Rp</span>
                <input className="input pl-9" type="number" value={
                  // Show total purchase price (latestPrice × conversionRate)
                  form.latestPrice && form.conversionRate
                    ? String(parseFloat(form.latestPrice) * parseFloat(form.conversionRate))
                    : form.latestPrice
                }
                  onChange={e => {
                    // Convert back to per-unit price
                    const totalPrice = parseFloat(e.target.value) || 0;
                    const conv = parseFloat(form.conversionRate) || 1;
                    f('latestPrice', String(totalPrice / conv));
                  }}
                  placeholder="cth. 24000" />
              </div>
              {form.latestPrice && form.conversionRate && (
                <p className="text-xs text-brand-600 mt-1 font-medium">
                  = {formatCurrency(parseFloat(form.latestPrice))} / {form.unit}
                </p>
              )}
            </div>

            {/* Min Stok */}
            <div>
              <label className="label">Minimum Stok ({form.unit})</label>
              <input className="input" type="number" value={form.minStock}
                onChange={e => f('minStock', e.target.value)}
                placeholder="cth. 500" />
              <p className="text-xs text-gray-400 mt-1">Alert akan muncul jika stok di bawah nilai ini</p>
            </div>

            {/* Preview */}
            {form.latestPrice && (
              <div className="p-3 rounded-xl bg-brand-50 border border-brand-100">
                <p className="text-xs font-semibold text-brand-700 mb-2">Preview</p>
                <div className="space-y-1 text-xs text-brand-600">
                  {form.purchaseUnit && form.conversionRate && (
                    <p>1 {form.purchaseUnit} = {formatNumber(parseFloat(form.conversionRate))} {form.unit}</p>
                  )}
                  {form.purchaseUnit && form.conversionRate && (
                    <p>Harga beli: {formatCurrency(parseFloat(form.latestPrice) * parseFloat(form.conversionRate))} / {form.purchaseUnit}</p>
                  )}
                  <p>Harga pakai: {formatCurrency(parseFloat(form.latestPrice))} / {form.unit}</p>
                </div>
              </div>
            )}
          </div>
        </SlideOver>
      )}

      {/* ── Delete Confirm ─────────────────────────────────────────────────── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus Bahan Baku">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Yakin mau hapus <span className="font-bold text-gray-900">{deleteTarget?.name}</span>?
            Pastikan bahan ini tidak dipakai di resep manapun.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteTarget(null)} className="btn btn-secondary btn-md">Batal</button>
            <button onClick={handleDelete} disabled={deleting}
              className="btn btn-danger btn-md">
              {deleting ? 'Menghapus...' : 'Hapus'}
            </button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
