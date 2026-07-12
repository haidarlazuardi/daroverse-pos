'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, Button, formatCurrency, formatNumber } from '@/components/ui';
import { DataTable, Column } from '@/components/ui/DataTable';
import { SlideOver } from '@/components/ui/SlideOver';
import { Toolbar } from '@/components/ui/Toolbar';
import { api } from '@/lib/fetch';
import clsx from 'clsx';
import * as XLSX from 'xlsx';

interface Ingredient {
  id: string; name: string; type: string; unit: string;
  purchaseUnit: string | null; conversionRate: number | null;
  minStock: number; latestPrice: number; active: boolean;
  defaultLocation: string | null; isPackaging: boolean;
  stockLevels: Array<{ location: string; quantity: number }>;
  prepRecipe?: { yieldQty: number | null; yieldUnit: string | null; items: Array<{ ingredient: { id: string; name: string; unit: string }; quantity: number }> };
}

const UNITS = ['g','kg','ml','L','pcs','lembar','botol','bungkus','porsi'];
const LOCATIONS: Record<string,string> = { GUDANG: 'Gudang', BAR: 'Bar', KITCHEN: 'Dapur' };

const emptyForm = {
  name: '', type: 'RAW', unit: 'g', purchaseUnit: '', conversionRate: '',
  minStock: '0', latestPrice: '0', defaultLocation: '', isPackaging: false,
  prepYield: '', prepYieldUnit: '',
  prepItems: [] as { ingredientId: string; quantity: string }[],
};

export default function InventoryPage() {
  const [data, setData]         = useState<Ingredient[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing]   = useState<Ingredient | null>(null);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState('');
  const [tab, setTab]           = useState<'stock'|'alerts'>('stock');

  const [allRaw, setAllRaw] = useState<Ingredient[]>([]);

  const rawIngredients = allRaw; // always full list, not filtered

  const totalStock = (ing: Ingredient) => ing.stockLevels.reduce((s, sl) => s + sl.quantity, 0);
  const isLow = (ing: Ingredient) => totalStock(ing) <= ing.minStock;
  const isCritical = (ing: Ingredient) => totalStock(ing) <= 0;
  const alertItems = data.filter(isLow);

  // Shelf life alert — check production orders that are past shelf life
  const [expiredBatches, setExpiredBatches] = useState<any[]>([]);
  useEffect(() => {
    api.get<any[]>('/api/production?status=COMPLETED&limit=50').then(orders => {
      const now = Date.now();
      const expired = orders.filter((o: any) => {
        const shelfLife = o.ingredient?.prepRecipe?.shelfLifeDays;
        if (!shelfLife || !o.completedAt) return false;
        const expiryMs = new Date(o.completedAt).getTime() + shelfLife * 86400000;
        return expiryMs < now;
      });
      setExpiredBatches(expired);
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/ingredients?';
      if (typeFilter) url += `type=${typeFilter}&`;
      if (search)     url += `search=${encodeURIComponent(search)}&`;
      const [result, raw] = await Promise.all([
        api.get<Ingredient[]>(url),
        api.get<Ingredient[]>('/api/ingredients?type=RAW'),
      ]);
      setData(result);
      setAllRaw(raw);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [search, typeFilter]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null); setForm(emptyForm); setFormError(''); setSlideOpen(true);
  }

  function openEdit(ing: Ingredient) {
    setEditing(ing);
    setForm({
      name: ing.name, type: ing.type, unit: ing.unit,
      purchaseUnit: ing.purchaseUnit ?? '', conversionRate: ing.conversionRate ? String(ing.conversionRate) : '',
      minStock: String(ing.minStock), latestPrice: String(ing.latestPrice),
      defaultLocation: ing.defaultLocation ?? '', isPackaging: ing.isPackaging,
      prepYield: ing.prepRecipe?.yieldQty ? String(ing.prepRecipe.yieldQty) : '',
      prepYieldUnit: ing.prepRecipe?.yieldUnit ?? '',
      prepItems: ing.prepRecipe?.items.map(i => ({ ingredientId: i.ingredient.id, quantity: String(i.quantity) })) ?? [],
    });
    setFormError(''); setSlideOpen(true);
  }

  function closeSlide() { setSlideOpen(false); setEditing(null); setFormError(''); }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('Nama bahan wajib diisi'); return; }
    if (!form.unit)        { setFormError('Satuan wajib diisi'); return; }
    setSaving(true); setFormError('');
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(), type: form.type, unit: form.unit,
        purchaseUnit: form.purchaseUnit || null,
        conversionRate: form.conversionRate ? parseFloat(form.conversionRate) : null,
        minStock: parseFloat(form.minStock) || 0,
        latestPrice: parseFloat(form.latestPrice) || 0,
        defaultLocation: form.defaultLocation || null,
        isPackaging: form.isPackaging,
      };
      if (form.type === 'PREPPED' && form.prepItems.length > 0) {
        payload.prepRecipe = {
          yieldQty: form.prepYield ? parseFloat(form.prepYield) : null,
          yieldUnit: form.prepYieldUnit || form.unit,
          items: form.prepItems.filter(i => i.ingredientId && i.quantity).map(i => ({ ingredientId: i.ingredientId, quantity: parseFloat(i.quantity) })),
        };
      }
      if (editing) {
        await api.patch('/api/ingredients', { id: editing.id, ...payload });
      } else {
        await api.post('/api/ingredients', payload);
      }
      closeSlide(); load();
    } catch (e: any) { setFormError(e?.message || 'Gagal menyimpan'); }
    finally { setSaving(false); }
  }

  async function handleDeactivate(ing: Ingredient) {
    if (!confirm(`Nonaktifkan "${ing.name}"? Bahan tidak akan muncul di menu tapi data historis tetap ada.`)) return;
    try { await api.delete(`/api/ingredients?id=${ing.id}`); load(); }
    catch (e: any) { alert(e?.message || 'Gagal'); }
  }

  // Export
  function handleExport() {
    const rows = data.map(i => ({
      id: i.id, name: i.name, type: i.type, unit: i.unit,
      purchase_unit: i.purchaseUnit ?? '', conversion_rate: i.conversionRate ?? '',
      min_stock: i.minStock, latest_price: i.latestPrice,
      default_location: i.defaultLocation ?? '', is_packaging: i.isPackaging,
      stock_gudang:  i.stockLevels.find(s => s.location === 'GUDANG')?.quantity ?? 0,
      stock_bar:     i.stockLevels.find(s => s.location === 'BAR')?.quantity ?? 0,
      stock_kitchen: i.stockLevels.find(s => s.location === 'KITCHEN')?.quantity ?? 0,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ingredients');
    XLSX.writeFile(wb, 'ingredients-export.xlsx');
  }

  function handleDownloadTemplate() {
    const rows = [{ name: 'Contoh Bahan', type: 'RAW', unit: 'g', purchase_unit: 'kg', conversion_rate: 1000, min_stock: 500, latest_price: 50, default_location: 'GUDANG', is_packaging: false }];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ingredients');
    XLSX.writeFile(wb, 'ingredients-template.xlsx');
  }

  async function handleImport(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf);
      const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]]);
      if (!rows.length) { alert('File kosong'); return; }
      let ok = 0; const errors: string[] = [];
      for (const [i, row] of rows.entries()) {
        if (!row.name || !row.unit) { errors.push(`Baris ${i+2}: name dan unit wajib`); continue; }
        try {
          await api.post('/api/ingredients', {
            name: String(row.name).trim(), type: row.type || 'RAW', unit: row.unit,
            purchaseUnit: row.purchase_unit || null, conversionRate: row.conversion_rate || null,
            minStock: parseFloat(row.min_stock) || 0, latestPrice: parseFloat(row.latest_price) || 0,
            defaultLocation: row.default_location || null,
          });
          ok++;
        } catch (e: any) { errors.push(`Baris ${i+2} "${row.name}": ${e?.message}`); }
      }
      alert(`Import selesai: ${ok} berhasil${errors.length ? `\n\nGagal:\n${errors.join('\n')}` : ''}`);
      load();
    } catch { alert('Gagal membaca file'); }
  }

  // Columns
  const columns: Column<Ingredient>[] = [
    {
      key: 'name', label: 'Nama', sortable: true,
      render: ing => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{ing.name}</span>
            {ing.isPackaging && <Badge variant="default">Packaging</Badge>}
          </div>
          {ing.purchaseUnit && ing.conversionRate && (
            <p className="text-xs text-gray-400 mt-0.5">1 {ing.purchaseUnit} = {formatNumber(ing.conversionRate)} {ing.unit}</p>
          )}
          {ing.type === 'PREPPED' && ing.prepRecipe && (
            <p className="text-xs text-purple-500 mt-0.5">
              {ing.prepRecipe.items.map(ri => `${ri.quantity}${ri.ingredient.unit} ${ri.ingredient.name}`).join(' + ')}
              {ing.prepRecipe.yieldQty && ` → ${ing.prepRecipe.yieldQty}${ing.prepRecipe.yieldUnit}`}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'type', label: 'Tipe', sortable: true, width: 'w-28',
      render: ing => <Badge variant={ing.type === 'PREPPED' ? 'info' : 'default'}>{ing.type === 'PREPPED' ? 'Olahan' : 'Bahan Baku'}</Badge>,
    },
    {
      key: 'stock', label: 'Stok Total', sortable: true, width: 'w-32',
      render: ing => {
        const total = totalStock(ing);
        return (
          <div>
            <span className={clsx('font-bold', isCritical(ing) ? 'text-red-600' : isLow(ing) ? 'text-amber-600' : 'text-gray-900')}>
              {formatNumber(total)} {ing.unit}
            </span>
            <div className="text-xs text-gray-400 mt-0.5">
              {ing.stockLevels.filter(sl => sl.quantity > 0).map(sl => `${LOCATIONS[sl.location]} ${formatNumber(sl.quantity)}`).join(' · ') || '—'}
            </div>
          </div>
        );
      },
    },
    {
      key: 'minStock', label: 'Min Stok', sortable: true, width: 'w-28',
      render: ing => <span className="text-gray-500 text-sm">{formatNumber(ing.minStock)} {ing.unit}</span>,
    },
    {
      key: 'status', label: 'Status', width: 'w-20',
      render: ing => isCritical(ing)
        ? <Badge variant="danger">Habis</Badge>
        : isLow(ing) ? <Badge variant="warning">Low</Badge>
        : <Badge variant="success">OK</Badge>,
    },
  ];

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola bahan baku dan stok</p>
        </div>

        {/* Alert banner */}
        {alertItems.length > 0 && (
          <div className="mb-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-amber-500">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span className="text-sm font-medium text-amber-800">
                {alertItems.length} bahan di bawah minimum stok
              </span>
            </div>
            <button onClick={() => setTab('alerts')} className="text-xs text-amber-700 font-medium hover:underline">
              Lihat semua →
            </button>
          </div>
        )}
        {expiredBatches.length > 0 && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-red-500">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span className="text-sm font-medium text-red-800">
                ⚠️ {expiredBatches.length} batch olahan melewati shelf life — segera buang atau cek kondisi
              </span>
            </div>
            <span className="text-xs text-red-600 font-medium">
              {expiredBatches.map((b: any) => b.ingredient?.name).filter(Boolean).join(', ')}
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
          {(['stock','alerts'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {t === 'stock' ? 'Semua Stok' : `Reorder Alert (${alertItems.length})`}
            </button>
          ))}
        </div>

        <Toolbar
          search={search} onSearch={setSearch} searchPlaceholder="Cari bahan..."
          filters={[
            { key: 'type', label: 'Tipe', value: typeFilter, onChange: setTypeFilter,
              options: [{ value: 'RAW', label: 'Bahan Baku' }, { value: 'PREPPED', label: 'Olahan' }] },
            { key: 'location', label: 'Station', value: locationFilter, onChange: setLocationFilter,
              options: [{ value: 'GUDANG', label: 'Gudang' }, { value: 'BAR', label: 'Bar' }, { value: 'KITCHEN', label: 'Dapur' }] },
          ]}
          onExport={handleExport} onDownloadTemplate={handleDownloadTemplate} onImport={handleImport}
          selected={selected}
          bulkActions={
            <Button variant="secondary" size="sm" onClick={() => {
              if (confirm(`Nonaktifkan ${selected.length} bahan?`))
                Promise.all(selected.map(id => api.delete(`/api/ingredients?id=${id}`))).then(() => { setSelected([]); load(); });
            }}>Nonaktifkan {selected.length} dipilih</Button>
          }
        />

        <DataTable
          data={tab === 'alerts' ? alertItems : (locationFilter ? data.filter((i: any) => i.stockLevels?.some((s: any) => s.location === locationFilter && s.quantity > 0)) : data)}
          columns={columns}
          keyField="id"
          loading={loading}
          emptyMessage={tab === 'alerts' ? 'Semua stok di atas minimum 👍' : 'Belum ada bahan. Klik "Bahan Baru" untuk menambah.'}
          selected={selected} onSelectChange={setSelected}
          rowActions={ing => (
            <>
              <button onClick={() => openEdit(ing)} title="Edit"
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button onClick={() => handleDeactivate(ing)} title="Nonaktifkan"
                className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
              </button>
            </>
          )}
        />
      </div>

      <SlideOver
        open={slideOpen} onClose={closeSlide} width="lg"
        title={editing ? 'Edit Bahan' : 'Bahan Baru'}
        subtitle={editing ? editing.name : 'Isi detail bahan baru'}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={closeSlide} disabled={saving}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : editing ? 'Simpan' : 'Buat Bahan'}</Button>
          </div>
        }
      >
        {formError && <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{formError}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Nama Bahan <span className="text-red-400">*</span></label>
            <input className="input w-full" placeholder="cth. Kopi Robusta, Susu UHT..." value={form.name} autoFocus
              onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Tipe</label>
            <select className="select w-full" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="RAW">Bahan Baku (RAW)</option>
              <option value="PREPPED">Olahan (PREPPED)</option>
            </select>
          </div>
          <div>
            <label className="label">Satuan Dasar <span className="text-red-400">*</span></label>
            <select className="select w-full" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Satuan Beli <span className="text-gray-400 font-normal">(opsional)</span></label>
            <input className="input w-full" placeholder="cth. kg, karton, botol" value={form.purchaseUnit}
              onChange={e => setForm({ ...form, purchaseUnit: e.target.value })} />
          </div>
          <div>
            <label className="label">Konversi ke {form.unit || 'satuan dasar'}</label>
            <input className="input w-full" type="number" placeholder={`cth. 1000 (1 ${form.purchaseUnit||'beli'} = 1000 ${form.unit})`}
              value={form.conversionRate} onChange={e => setForm({ ...form, conversionRate: e.target.value })} />
          </div>
          <div>
            <label className="label">Min Stok <span className="text-gray-400 font-normal">({form.unit})</span></label>
            <input className="input w-full" type="number" value={form.minStock}
              onChange={e => setForm({ ...form, minStock: e.target.value })} />
          </div>
          <div>
            <label className="label">Harga / {form.unit} (Rp)</label>
            <input className="input w-full" type="number" value={form.latestPrice}
              onChange={e => setForm({ ...form, latestPrice: e.target.value })} />
          </div>
          <div>
            <label className="label">Lokasi Default</label>
            <select className="select w-full" value={form.defaultLocation} onChange={e => setForm({ ...form, defaultLocation: e.target.value })}>
              <option value="">— Pilih lokasi —</option>
              <option value="GUDANG">Gudang</option>
              <option value="BAR">Bar</option>
              <option value="KITCHEN">Dapur</option>
            </select>
          </div>
          <div className="flex items-center gap-3 pt-6">
            <input type="checkbox" id="isPackaging" checked={form.isPackaging}
              onChange={e => setForm({ ...form, isPackaging: e.target.checked })}
              className="rounded border-gray-300 text-brand-600" />
            <label htmlFor="isPackaging" className="text-sm text-gray-700">Packaging (cup, box, dll)</label>
          </div>
        </div>

        {/* PREPPED recipe */}
        {form.type === 'PREPPED' && (
          <div className="border border-purple-200 rounded-xl p-4 bg-purple-50/40 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-purple-800">Sub-Recipe (bahan baku yang dipakai)</p>
              <button onClick={() => setForm({ ...form, prepItems: [...form.prepItems, { ingredientId: '', quantity: '' }] })}
                className="text-sm text-purple-600 font-medium hover:underline">+ Tambah bahan</button>
            </div>
            {form.prepItems.map((ri, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select value={ri.ingredientId} className="select flex-1"
                  onChange={e => { const items = [...form.prepItems]; items[i].ingredientId = e.target.value; setForm({ ...form, prepItems: items }); }}>
                  <option value="">Pilih bahan baku</option>
                  {rawIngredients.map(r => <option key={r.id} value={r.id}>{r.name} ({r.unit})</option>)}
                </select>
                <input type="number" placeholder="Qty" value={ri.quantity} className="input w-24"
                  onChange={e => { const items = [...form.prepItems]; items[i].quantity = e.target.value; setForm({ ...form, prepItems: items }); }} />
                <button onClick={() => setForm({ ...form, prepItems: form.prepItems.filter((_, j) => j !== i) })}
                  className="p-1.5 text-red-400 hover:text-red-600">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="label">Yield Quantity</label>
                <input className="input w-full" type="number" placeholder="cth. 800" value={form.prepYield}
                  onChange={e => setForm({ ...form, prepYield: e.target.value })} />
              </div>
              <div>
                <label className="label">Yield Unit</label>
                <input className="input w-full" placeholder={form.unit} value={form.prepYieldUnit}
                  onChange={e => setForm({ ...form, prepYieldUnit: e.target.value })} />
              </div>
            </div>
            <p className="text-xs text-purple-500">Harga per unit akan dihitung otomatis dari harga bahan baku.</p>
          </div>
        )}
      </SlideOver>
    </AdminLayout>
  );
}
