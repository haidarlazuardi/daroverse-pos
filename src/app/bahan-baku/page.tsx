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
interface PrepRecipe {
  id: string; yieldQty: number | null; yieldUnit: string | null;
  items: { quantity: number; ingredient: { id: string; name: string; unit: string; latestPrice: number } }[];
}
interface PrepIngredient extends Ingredient {
  prepRecipe?: PrepRecipe;
}

const EMPTY_RAW = {
  name: '', type: 'RAW', unit: 'g', purchaseUnit: '', conversionRate: '',
  latestPrice: '', purchasePrice: '', minStock: '', defaultLocation: '', isPackaging: false,
};
const EMPTY_PREP = { name: '', unit: 'ml', yieldQty: '', yieldUnit: 'ml', minStock: '', latestPrice: '' };
const UNITS = ['g','ml','pcs','kg','liter','botol','pack','kaleng','lembar','buah'];

const GROUPS: { label: string; keys: string[] }[] = [
  { label: '🥛 Dairy, Base & Minuman',   keys: ['susu','creamer','evaporasi','skm','freshmilk','oat milk','mineral','galon','air'] },
  { label: '☕ Kopi & Teh',              keys: ['beans','kopi','house blend','anaerobic','idjen','specialty','teh','coldbrew','espresso'] },
  { label: '🍯 Sirup, Flavour & Powder', keys: ['flavour','sirup','gula','liquid aren','simple syrup','dark choco','matcha','vanila','caramel','pandan','strawberry','butterscotch','mint','peach','fruity','tiramisu','berry juice','orange juice','soda','tonic','baking soda','chocolate crumble'] },
  { label: '🥩 Protein',                 keys: ['ayam','daging','sayap','kulit','paha','telur','bacon','beef'] },
  { label: '🥬 Sayur & Buah',            keys: ['nanas','kentang','pisang','lettuce','selada','bawang','cabai','hijau','lengkuas','daun jeruk'] },
  { label: '🧂 Bumbu & Seasoning',       keys: ['sea salt','cajun','smoke powder','cayenne','penyedap','margarin','minyak','kecap','saus','mayonaise','tiram','bbq','maizena','terigu','tepung'] },
  { label: '🍞 Dry Goods & Packaging',   keys: ['beras','burger bun','red cheddar','cheddar'] },
];
function categorize(name: string) {
  const lower = name.toLowerCase();
  for (const g of GROUPS) if (g.keys.some(k => lower.includes(k))) return g.label;
  return '📦 Lainnya';
}

export default function BahanBakuPage() {
  const [tab, setTab]         = useState<'raw'|'prepped'>('raw');
  const [rawData, setRawData] = useState<Ingredient[]>([]);
  const [prepData, setPrepData] = useState<PrepIngredient[]>([]);
  const [rawAll, setRawAll]   = useState<Ingredient[]>([]); // for recipe picker
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  // RAW form
  const [rawSlide, setRawSlide]   = useState(false);
  const [editingRaw, setEditingRaw] = useState<Ingredient | null>(null);
  const [rawForm, setRawForm]     = useState({ ...EMPTY_RAW });
  const [savingRaw, setSavingRaw] = useState(false);

  // PREPPED form
  const [prepSlide, setPrepSlide]   = useState(false);
  const [editingPrep, setEditingPrep] = useState<PrepIngredient | null>(null);
  const [prepForm, setPrepForm]     = useState({ ...EMPTY_PREP });
  const [recipeItems, setRecipeItems] = useState<{ ingredientId: string; quantity: string }[]>([]);
  const [savingPrep, setSavingPrep] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Ingredient | null>(null);
  const [deleting, setDeleting]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any[]>('/api/ingredients');
      const raw  = res.filter((i: any) => i.type === 'RAW'     && i.active);
      const prep = res.filter((i: any) => i.type === 'PREPPED'  && i.active);
      setRawData(raw);
      setRawAll(raw);
      setPrepData(prep);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── RAW handlers ──────────────────────────────────────────────────────────
  function openAddRaw() { setEditingRaw(null); setRawForm({ ...EMPTY_RAW }); setRawSlide(true); }
  function openEditRaw(ing: Ingredient) {
    setEditingRaw(ing);
    const conv = ing.conversionRate || 1;
    setRawForm({
      name: ing.name,
      type: ing.type || 'RAW',
      unit: ing.unit,
      purchaseUnit: ing.purchaseUnit || '',
      conversionRate: ing.conversionRate ? String(ing.conversionRate) : '',
      latestPrice: String(ing.latestPrice),
      purchasePrice: ing.conversionRate ? String(ing.latestPrice * ing.conversionRate) : '',
      minStock: String(ing.minStock),
      defaultLocation: (ing as any).defaultLocation || '',
      isPackaging: (ing as any).isPackaging || false,
    });
    setRawSlide(true);
  }
  async function handleSaveRaw() {
    if (!rawForm.name.trim()) return;
    setSavingRaw(true);
    try {
      // Hitung latestPrice dari purchasePrice / conversionRate jika diisi
      let latestPrice = parseFloat(rawForm.latestPrice) || 0;
      if (rawForm.purchasePrice && rawForm.conversionRate) {
        latestPrice = parseFloat(rawForm.purchasePrice) / parseFloat(rawForm.conversionRate);
      }
      const payload = {
        name: rawForm.name.trim(),
        type: 'RAW',
        unit: rawForm.unit,
        purchaseUnit: rawForm.purchaseUnit || null,
        conversionRate: rawForm.conversionRate ? parseFloat(rawForm.conversionRate) : null,
        latestPrice,
        minStock: parseFloat(rawForm.minStock) || 0,
        defaultLocation: rawForm.defaultLocation || null,
        isPackaging: rawForm.isPackaging,
        active: true,
      };
      if (editingRaw) await api.patch('/api/ingredients', { id: editingRaw.id, ...payload });
      else await api.post('/api/ingredients', payload);
      setRawSlide(false); load();
    } catch (e: any) { alert(e.message || 'Gagal'); }
    finally { setSavingRaw(false); }
  }

  // ── PREPPED handlers ──────────────────────────────────────────────────────
  function openAddPrep() {
    setEditingPrep(null);
    setPrepForm({ ...EMPTY_PREP });
    setRecipeItems([{ ingredientId: '', quantity: '' }]);
    setPrepSlide(true);
  }
  function openEditPrep(ing: PrepIngredient) {
    setEditingPrep(ing);
    setPrepForm({ name: ing.name, unit: ing.unit, yieldQty: ing.prepRecipe?.yieldQty ? String(ing.prepRecipe.yieldQty) : '', yieldUnit: ing.prepRecipe?.yieldUnit || ing.unit, minStock: String(ing.minStock), latestPrice: String(ing.latestPrice) });
    setRecipeItems(ing.prepRecipe?.items.map(ri => ({ ingredientId: ri.ingredient.id, quantity: String(ri.quantity) })) || [{ ingredientId: '', quantity: '' }]);
    setPrepSlide(true);
  }
  async function handleSavePrep() {
    if (!prepForm.name) return;
    setSavingPrep(true);
    try {
      const validItems = recipeItems.filter(ri => ri.ingredientId && ri.quantity);
      const payload = {
        name: prepForm.name.trim(),
        unit: prepForm.unit,
        minStock: parseFloat(prepForm.minStock) || 0,
        latestPrice: parseFloat(prepForm.latestPrice) || 0,
        type: 'PREPPED',
        active: true,
        prepRecipe: validItems.length > 0 ? {
          yieldQty: parseFloat(prepForm.yieldQty) || null,
          yieldUnit: prepForm.yieldUnit || prepForm.unit,
          items: validItems.map(ri => ({ ingredientId: ri.ingredientId, quantity: parseFloat(ri.quantity) })),
        } : undefined,
      };
      if (editingPrep) await api.patch('/api/ingredients', { id: editingPrep.id, ...payload });
      else await api.post('/api/ingredients', payload);
      setPrepSlide(false); load();
    } catch (e: any) { alert(e.message || 'Gagal'); }
    finally { setSavingPrep(false); }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await api.delete(`/api/ingredients?id=${deleteTarget.id}`); setDeleteTarget(null); load(); }
    catch (e: any) { alert(e.message || 'Gagal'); }
    finally { setDeleting(false); }
  }

  // ── Export / Import / Template ────────────────────────────────────────────
  function handleExport() {
    const rows = rawData.map(i => ({
      name: i.name, type: i.type, unit: i.unit,
      purchase_unit: i.purchaseUnit ?? '',
      conversion_rate: i.conversionRate ?? '',
      latest_price: i.latestPrice,
      purchase_price: i.conversionRate ? i.latestPrice * i.conversionRate : '',
      min_stock: i.minStock,
      default_location: (i as any).defaultLocation ?? '',
      is_packaging: (i as any).isPackaging ?? false,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bahan Baku');
    XLSX.writeFile(wb, 'bahan-baku-soeka.xlsx');
  }

  function handleDownloadTemplate() {
    const rows = [{
      name: 'Contoh: Susu Freshmilk', type: 'RAW', unit: 'ml',
      purchase_unit: 'liter', conversion_rate: 1000,
      purchase_price: 24000, latest_price: 24,
      min_stock: 2000, default_location: 'BAR', is_packaging: false,
    }];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'template-bahan-baku.xlsx');
  }

  async function handleImport(file: File) {
    try {
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf);
      const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]]);
      if (!rows.length) { alert('File kosong'); return; }
      let ok = 0; const errors: string[] = [];
      for (const [i, row] of rows.entries()) {
        if (!row.name || !row.unit) { errors.push(`Baris ${i + 2}: name dan unit wajib`); continue; }
        try {
          // Hitung latestPrice dari purchase_price / conversion_rate jika ada
          let latestPrice = parseFloat(row.latest_price) || 0;
          if (row.purchase_price && row.conversion_rate) {
            latestPrice = parseFloat(row.purchase_price) / parseFloat(row.conversion_rate);
          }
          await api.post('/api/ingredients', {
            name: String(row.name).trim(), type: row.type || 'RAW', unit: row.unit,
            purchaseUnit: row.purchase_unit || null,
            conversionRate: row.conversion_rate ? parseFloat(row.conversion_rate) : null,
            minStock: parseFloat(row.min_stock) || 0,
            latestPrice,
            defaultLocation: row.default_location || null,
            isPackaging: row.is_packaging === true || row.is_packaging === 'true',
          });
          ok++;
        } catch (e: any) { errors.push(`Baris ${i + 2} "${row.name}": ${e?.message}`); }
      }
      alert(`Import selesai: ${ok} berhasil${errors.length ? `\n\nGagal:\n${errors.join('\n')}` : ''}`);
      load();
    } catch { alert('Gagal membaca file'); }
  }

  // ── Filtered & grouped ────────────────────────────────────────────────────
  const filteredRaw = rawData.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));
  const filteredPrep = prepData.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));

  const grouped = new Map<string, Ingredient[]>();
  for (const ing of filteredRaw) {
    const cat = categorize(ing.name);
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(ing);
  }
  const sortedGroups = Array.from(grouped.entries()).sort((a, b) => {
    const ai = GROUPS.findIndex(g => g.label === a[0]); const bi = GROUPS.findIndex(g => g.label === b[0]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const rf = (k: string, v: string | boolean) => setRawForm(p => ({ ...p, [k]: v }));
  const pf = (k: string, v: string) => setPrepForm(p => ({ ...p, [k]: v }));

  // ── Computed recipe cost ──────────────────────────────────────────────────
  const recipeCostPreview = recipeItems.reduce((total, ri) => {
    const ing = rawAll.find(r => r.id === ri.ingredientId);
    if (!ing || !ri.quantity) return total;
    return total + (ing.latestPrice * parseFloat(ri.quantity));
  }, 0);

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <div className="page-header">
          <div>
            <h1 className="page-title">Bahan Baku</h1>
            <p className="page-subtitle">Master data harga & satuan semua bahan</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-default">{rawData.length} RAW</span>
            <span className="badge badge-info">{prepData.length} Olahan</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="tab-group mb-5">
          <button onClick={() => setTab('raw')} className={clsx('tab-item', tab === 'raw' ? 'tab-active' : 'tab-inactive')}>
            🌿 Bahan Mentah ({rawData.length})
          </button>
          <button onClick={() => setTab('prepped')} className={clsx('tab-item', tab === 'prepped' ? 'tab-active' : 'tab-inactive')}>
            🍶 Bahan Olahan ({prepData.length})
          </button>
        </div>

        {tab === 'raw' ? (
          <>
            <Toolbar search={search} onSearch={setSearch} searchPlaceholder="Cari bahan..." onExport={handleExport} onDownloadTemplate={handleDownloadTemplate} onImport={handleImport} onAdd={openAddRaw} addLabel="Bahan Baru" />
            {loading ? (
              <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} /></div>
            ) : sortedGroups.length === 0 ? (
              <div className="empty-state"><p className="empty-title">Tidak ada bahan</p></div>
            ) : (
              <div className="space-y-6">
                {sortedGroups.map(([category, items]) => (
                  <div key={category}>
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{category}</h2>
                      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>{items.length} bahan</span>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Nama</th>
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase hidden sm:table-cell">Satuan Beli</th>
                              <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase hidden md:table-cell">Isi / Satuan</th>
                              <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase">Harga Beli</th>
                              <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase">Harga / Unit</th>
                              <th className="px-4 py-2.5 w-16" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {items.map(ing => (
                              <tr key={ing.id} className="hover:bg-gray-50/50 group">
                                <td className="px-4 py-3">
                                  <p className="font-semibold" style={{ color: 'var(--text-1)' }}>{ing.name}</p>
                                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>min {formatNumber(ing.minStock)} {ing.unit}</p>
                                </td>
                                <td className="px-4 py-3 hidden sm:table-cell" style={{ color: 'var(--text-2)' }}>{ing.purchaseUnit || '—'}</td>
                                <td className="px-4 py-3 text-right hidden md:table-cell">
                                  <span className="font-mono text-xs" style={{ color: 'var(--text-2)' }}>{ing.conversionRate ? `${formatNumber(ing.conversionRate)} ${ing.unit}` : '—'}</span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{formatCurrency((ing.latestPrice || 0) * (ing.conversionRate || 1))}</span>
                                  <span className="text-xs block" style={{ color: 'var(--text-3)' }}>/{ing.purchaseUnit || 'unit'}</span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="font-bold text-sm" style={{ color: 'var(--brand)' }}>{formatCurrency(ing.latestPrice)}</span>
                                  <span className="text-xs block" style={{ color: 'var(--text-3)' }}>/{ing.unit}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 justify-end">
                                    <button onClick={() => openEditRaw(ing)} className="p-1.5 rounded-lg hover:bg-brand-50 text-gray-400 hover:text-brand-600">
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                    </button>
                                    <button onClick={() => setDeleteTarget(ing)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <Toolbar search={search} onSearch={setSearch} searchPlaceholder="Cari bahan olahan..." onAdd={openAddPrep} addLabel="Tambah Olahan" />
            {loading ? (
              <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} /></div>
            ) : filteredPrep.length === 0 ? (
              <div className="empty-state"><p className="empty-title">Belum ada bahan olahan</p><p className="empty-text">Bahan olahan adalah hasil batch produksi seperti Milk Premix, Espresso, Coldbrew, dll</p></div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPrep.map(ing => {
                  const recipe = ing.prepRecipe;
                  const totalCost = recipe?.items.reduce((s, ri) => s + ri.ingredient.latestPrice * ri.quantity, 0) || 0;
                  const costPerUnit = recipe?.yieldQty ? totalCost / recipe.yieldQty : 0;
                  return (
                    <div key={ing.id} className="card p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-bold" style={{ color: 'var(--text-1)' }}>{ing.name}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                            {recipe?.yieldQty ? `Yield: ${formatNumber(recipe.yieldQty)} ${recipe.yieldUnit || ing.unit}` : 'Yield belum diset'}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openEditPrep(ing)} className="p-1.5 rounded-lg hover:bg-brand-50 text-gray-400 hover:text-brand-600">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button onClick={() => setDeleteTarget(ing)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                          </button>
                        </div>
                      </div>

                      {recipe?.items?.length ? (
                        <div className="space-y-1 mb-3">
                          {recipe.items.map((ri, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span style={{ color: 'var(--text-2)' }}>• {ri.ingredient.name}</span>
                              <span style={{ color: 'var(--text-3)' }}>{formatNumber(ri.quantity)} {ri.ingredient.unit}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>Belum ada resep</p>
                      )}

                      <div className="pt-3 border-t flex justify-between" style={{ borderColor: 'var(--border)' }}>
                        <div>
                          <p className="text-xs" style={{ color: 'var(--text-3)' }}>Total bahan</p>
                          <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{formatCurrency(totalCost)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs" style={{ color: 'var(--text-3)' }}>HPP per {ing.unit}</p>
                          <p className="font-bold" style={{ color: 'var(--brand)' }}>{costPerUnit > 0 ? formatCurrency(costPerUnit) : '—'}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── SlideOver RAW ────────────────────────────────────────────────── */}
      <SlideOver open={rawSlide} onClose={() => setRawSlide(false)}
        title={editingRaw ? `Edit: ${editingRaw.name}` : 'Bahan Baru'}
        subtitle={editingRaw ? editingRaw.name : 'Isi detail bahan baru'}
        footer={<div className="flex justify-end gap-3"><button onClick={() => setRawSlide(false)} className="btn btn-secondary btn-md">Batal</button><Button onClick={handleSaveRaw} disabled={savingRaw || !rawForm.name}>{savingRaw ? 'Menyimpan...' : editingRaw ? 'Simpan' : 'Buat Bahan'}</Button></div>}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Nama Bahan <span className="text-red-400">*</span></label>
            <input className="input w-full" placeholder="cth. Susu Freshmilk Diamond, Kopi Robusta..." value={rawForm.name} autoFocus
              onChange={e => rf('name', e.target.value)} />
          </div>
          <div>
            <label className="label">Satuan Dasar <span className="text-red-400">*</span></label>
            <select className="select w-full" value={rawForm.unit} onChange={e => rf('unit', e.target.value)}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Satuan Beli <span className="text-gray-400 font-normal">(opsional)</span></label>
            <input className="input w-full" placeholder="cth. kg, karton, botol" value={rawForm.purchaseUnit}
              onChange={e => rf('purchaseUnit', e.target.value)} />
          </div>
          <div>
            <label className="label">Konversi ke {rawForm.unit || 'satuan dasar'}</label>
            <input className="input w-full" type="number"
              placeholder={`cth. 1000 (1 ${rawForm.purchaseUnit || 'beli'} = 1000 ${rawForm.unit})`}
              value={rawForm.conversionRate}
              onChange={e => {
                rf('conversionRate', e.target.value);
                // Recalc latestPrice jika purchasePrice sudah diisi
                if (rawForm.purchasePrice && e.target.value) {
                  rf('latestPrice', String(parseFloat(rawForm.purchasePrice) / parseFloat(e.target.value)));
                }
              }} />
          </div>
          <div>
            <label className="label">Harga Beli per {rawForm.purchaseUnit || 'Satuan Beli'} (Rp)</label>
            <input className="input w-full" type="number"
              placeholder="cth. 24000"
              value={rawForm.purchasePrice}
              onChange={e => {
                rf('purchasePrice', e.target.value);
                // Auto-hitung harga per satuan dasar
                const conv = parseFloat(rawForm.conversionRate) || 1;
                rf('latestPrice', String((parseFloat(e.target.value) || 0) / conv));
              }} />
          </div>
          <div>
            <label className="label">Harga / {rawForm.unit} (Rp) <span className="text-gray-400 font-normal">— auto</span></label>
            <input className="input w-full" type="number"
              placeholder="Otomatis dari harga beli ÷ konversi"
              value={rawForm.latestPrice ? String(parseFloat(rawForm.latestPrice).toFixed(2)) : ''}
              onChange={e => rf('latestPrice', e.target.value)} />
            {rawForm.latestPrice && rawForm.unit && (
              <p className="text-xs mt-1 font-semibold" style={{ color: 'var(--brand)' }}>
                = {formatCurrency(parseFloat(rawForm.latestPrice))} / {rawForm.unit}
              </p>
            )}
          </div>
          <div>
            <label className="label">Min Stok ({rawForm.unit})</label>
            <input className="input w-full" type="number" value={rawForm.minStock}
              onChange={e => rf('minStock', e.target.value)} />
          </div>
          <div>
            <label className="label">Lokasi Default</label>
            <select className="select w-full" value={rawForm.defaultLocation} onChange={e => rf('defaultLocation', e.target.value)}>
              <option value="">— Pilih lokasi —</option>
              <option value="GUDANG">Gudang</option>
              <option value="BAR">Bar</option>
              <option value="KITCHEN">Dapur</option>
            </select>
          </div>
          <div className="flex items-center gap-3 pt-6">
            <input type="checkbox" id="isPackaging" checked={rawForm.isPackaging}
              onChange={e => setRawForm(p => ({ ...p, isPackaging: e.target.checked }))}
              className="rounded border-gray-300" />
            <label htmlFor="isPackaging" className="text-sm" style={{ color: 'var(--text-1)' }}>Packaging (cup, box, dll)</label>
          </div>
        </div>
      </SlideOver>

      {/* ── SlideOver PREPPED ─────────────────────────────────────────────── */}
      <SlideOver open={prepSlide} onClose={() => setPrepSlide(false)}
        title={editingPrep ? `Edit: ${editingPrep.name}` : 'Tambah Bahan Olahan'}
        footer={<div className="flex justify-end gap-3"><button onClick={() => setPrepSlide(false)} className="btn btn-secondary btn-md">Batal</button><Button onClick={handleSavePrep} disabled={savingPrep || !prepForm.name}>{savingPrep ? 'Menyimpan...' : 'Simpan'}</Button></div>}>
        <div className="space-y-4">
          <div><label className="label">Nama Olahan *</label><input className="input" value={prepForm.name} onChange={e => pf('name', e.target.value)} placeholder="cth. Milk Premix, Espresso, Coldbrew" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Satuan Hasil</label><select className="select" value={prepForm.unit} onChange={e => pf('unit', e.target.value)}>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
            <div><label className="label">Yield per Batch ({prepForm.unit})</label><input className="input" type="number" value={prepForm.yieldQty} onChange={e => pf('yieldQty', e.target.value)} placeholder="cth. 3847" /></div>
          </div>
          <div><label className="label">Min Stok ({prepForm.unit})</label><input className="input" type="number" value={prepForm.minStock} onChange={e => pf('minStock', e.target.value)} /></div>

          {/* Recipe items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Bahan Pembuat (Resep)</label>
              <button onClick={() => setRecipeItems(p => [...p, { ingredientId: '', quantity: '' }])}
                className="text-xs font-semibold" style={{ color: 'var(--brand)' }}>+ Tambah Bahan</button>
            </div>
            <div className="space-y-2">
              {recipeItems.map((ri, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select className="select flex-1" value={ri.ingredientId}
                    onChange={e => setRecipeItems(p => { const n = [...p]; n[i].ingredientId = e.target.value; return n; })}>
                    <option value="">Pilih bahan...</option>
                    {rawAll.map(r => <option key={r.id} value={r.id}>{r.name} ({r.unit})</option>)}
                  </select>
                  <input type="number" className="input w-24" placeholder="Qty" value={ri.quantity}
                    onChange={e => setRecipeItems(p => { const n = [...p]; n[i].quantity = e.target.value; return n; })} />
                  <button onClick={() => setRecipeItems(p => p.filter((_, j) => j !== i))}
                    className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 flex-shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Cost preview */}
          {recipeItems.some(ri => ri.ingredientId && ri.quantity) && (
            <div className="p-3 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-2)' }}>Total biaya bahan</span>
                <span className="font-bold" style={{ color: 'var(--text-1)' }}>{formatCurrency(recipeCostPreview)}</span>
              </div>
              {prepForm.yieldQty && (
                <div className="flex justify-between text-sm mt-1">
                  <span style={{ color: 'var(--text-2)' }}>HPP per {prepForm.unit}</span>
                  <span className="font-bold" style={{ color: 'var(--brand)' }}>
                    {formatCurrency(recipeCostPreview / (parseFloat(prepForm.yieldQty) || 1))}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </SlideOver>

      {/* ── Delete Modal ──────────────────────────────────────────────────── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus Bahan">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            Yakin hapus <span className="font-bold" style={{ color: 'var(--text-1)' }}>{deleteTarget?.name}</span>? Pastikan tidak dipakai di resep manapun.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteTarget(null)} className="btn btn-secondary btn-md">Batal</button>
            <button onClick={handleDelete} disabled={deleting} className="btn btn-danger btn-md">{deleting ? 'Menghapus...' : 'Hapus'}</button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
