'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, Button, Modal, Input, Select, formatCurrency } from '@/components/ui';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Toolbar } from '@/components/ui/Toolbar';
import { api } from '@/lib/fetch';
import clsx from 'clsx';
import * as XLSX from 'xlsx';

interface ModOption { name: string; effect: 'ADJUST'|'ADD'; targetIngredientId: string; multiplier: string; addQty: string; priceDelta: string; isDefault: boolean }
interface ModGroup  { name: string; selectionType: 'SINGLE'|'MULTI'; options: ModOption[] }
interface Product {
  id: string; name: string; sku: string|null; price: number; cost: number; active: boolean;
  station: 'FOOD'|'DRINK'; takeawayCharge: number; packagingIngredientId: string|null;
  category: { id: string; name: string; color: string };
  recipe?:          { items: Array<{ ingredient: { id: string; name: string; unit: string }; quantity: number }> };
  modifierGroups?:  Array<{ name: string; selectionType: 'SINGLE'|'MULTI'; options: Array<{ name: string; effect: 'ADJUST'|'ADD'; targetIngredientId: string|null; multiplier: number|null; addQty: number|null; priceDelta: number; isDefault: boolean }> }>;
}
interface Category   { id: string; name: string; color: string }
interface Ingredient { id: string; name: string; unit: string; latestPrice: number; type?: string }

const emptyOption = (): ModOption => ({ name: '', effect: 'ADJUST', targetIngredientId: '', multiplier: '1', addQty: '', priceDelta: '0', isDefault: false });
const emptyForm = { name: '', sku: '', categoryId: '', price: '', station: 'DRINK' as 'FOOD'|'DRINK', takeawayCharge: '', packagingIngredientId: '', recipeItems: [] as { ingredientId: string; quantity: string }[], modGroups: [] as ModGroup[] };

export default function ProductsPage() {
  const [products, setProducts]       = useState<Product[]>([]);
  const [categories, setCategories]   = useState<Category[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filterCat, setFilterCat]     = useState('');
  const [filterStation, setFilterStation] = useState('');
  const [selected, setSelected]       = useState<string[]>([]);
  const [showAdd, setShowAdd]         = useState(false);
  const [editProduct, setEditProduct] = useState<Product|null>(null);
  const [form, setForm]               = useState(emptyForm);
  const [priceRec, setPriceRec]       = useState<{ cost: number; recommendations: Record<string,number> }|null>(null);
  const [saving, setSaving]           = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/products?';
      if (search)        url += `search=${encodeURIComponent(search)}&`;
      if (filterCat)     url += `categoryId=${filterCat}&`;
      if (filterStation) url += `station=${filterStation}&`;
      const [p, c, i] = await Promise.all([api.get<Product[]>(url), api.get<Category[]>('/api/categories'), api.get<Ingredient[]>('/api/ingredients')]);
      setProducts(p); setCategories(c); setIngredients(i);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [search, filterCat, filterStation]);

  useEffect(() => { load(); }, [load]);

  const closeModal = () => { setShowAdd(false); setEditProduct(null); setForm(emptyForm); setPriceRec(null); };

  function openEdit(p: Product) {
    setForm({
      name: p.name, sku: p.sku||'', categoryId: p.category.id, price: String(p.price),
      station: p.station||'DRINK', takeawayCharge: p.takeawayCharge ? String(p.takeawayCharge) : '',
      packagingIngredientId: p.packagingIngredientId||'',
      recipeItems: p.recipe?.items.map(ri => ({ ingredientId: ri.ingredient.id, quantity: String(ri.quantity) })) || [],
      modGroups: (p.modifierGroups||[]).map(g => ({
        name: g.name, selectionType: g.selectionType,
        options: g.options.map(o => ({ name: o.name, effect: o.effect, targetIngredientId: o.targetIngredientId||'', multiplier: o.multiplier!=null ? String(o.multiplier) : '1', addQty: o.addQty!=null ? String(o.addQty) : '', priceDelta: String(o.priceDelta||0), isDefault: o.isDefault })),
      })),
    });
    setPriceRec(null); setEditProduct(p);
  }

  const buildPayload = () => ({
    name: form.name, sku: form.sku||undefined, categoryId: form.categoryId, price: form.price,
    station: form.station, takeawayCharge: form.takeawayCharge ? parseFloat(form.takeawayCharge) : 0,
    packagingIngredientId: form.packagingIngredientId||undefined,
    recipe: form.recipeItems.length > 0 ? { items: form.recipeItems.map(ri => ({ ingredientId: ri.ingredientId, quantity: parseFloat(ri.quantity) })) } : undefined,
    modifierGroups: form.modGroups.map((g,gi) => ({
      name: g.name, selectionType: g.selectionType, sortOrder: gi,
      options: g.options.map((o,oi) => ({ name: o.name, effect: o.effect, targetIngredientId: o.targetIngredientId||null, multiplier: o.effect==='ADJUST' ? o.multiplier : null, addQty: o.effect==='ADD' ? o.addQty : null, priceDelta: o.priceDelta||0, isDefault: o.isDefault, sortOrder: oi })),
    })),
  });

  async function handleSave() {
    setSaving(true);
    try {
      if (editProduct) await api.put('/api/products', { id: editProduct.id, ...buildPayload() });
      else             await api.post('/api/products', buildPayload());
      closeModal(); load();
    } catch (e: any) { alert(e.message||'Gagal'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Nonaktifkan produk ini?')) return;
    try { await api.delete(`/api/products?id=${id}`); load(); }
    catch (e: any) { alert(e.message||'Gagal'); }
  }

  async function getRecommendation() {
    if (!form.recipeItems.some(r => r.ingredientId && r.quantity)) return;
    try {
      const rec = await api.post<any>('/api/products', { name: 'temp', categoryId: form.categoryId||categories[0]?.id||'x', recommendOnly: true, recipe: { items: form.recipeItems.map(ri => ({ ingredientId: ri.ingredientId, quantity: parseFloat(ri.quantity)||0 })) } });
      setPriceRec(rec);
    } catch { /* silent */ }
  }

  function handleExport() {
    const rows = products.map(p => ({ id: p.id, name: p.name, sku: p.sku??'', category: p.category.name, station: p.station, price: p.price, cost: p.cost, margin_pct: p.price > 0 ? ((p.price-p.cost)/p.price*100).toFixed(1) : 0, active: p.active, recipe_items: p.recipe?.items.length??0 }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'products-export.xlsx');
  }

  // Modifier helpers
  const setGroups = (modGroups: ModGroup[]) => setForm({ ...form, modGroups });
  const addGroup  = () => setGroups([...form.modGroups, { name: '', selectionType: 'SINGLE', options: [emptyOption()] }]);
  const updGroup  = (gi: number, patch: Partial<ModGroup>) => setGroups(form.modGroups.map((g,i) => i===gi ? {...g,...patch} : g));
  const updOption = (gi: number, oi: number, patch: Partial<ModOption>) => setGroups(form.modGroups.map((g,i) => i!==gi ? g : { ...g, options: g.options.map((o,j) => j===oi ? {...o,...patch} : o) }));

  const columns: Column<Product>[] = [
    {
      key: 'name', label: 'Produk', sortable: true,
      render: p => (
        <div>
          <p className="font-medium text-gray-900">{p.name}</p>
          {p.sku && <p className="text-xs text-gray-400 font-mono">{p.sku}</p>}
        </div>
      ),
    },
    {
      key: 'category', label: 'Kategori', sortable: true, width: 'w-36',
      render: p => (
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.category.color }} />
          <span className="text-gray-700 text-sm">{p.category.name}</span>
        </div>
      ),
    },
    {
      key: 'station', label: 'Station', width: 'w-24',
      render: p => <Badge variant={p.station==='FOOD' ? 'warning' : 'info'}>{p.station==='FOOD' ? 'Dapur' : 'Bar'}</Badge>,
    },
    {
      key: 'price', label: 'Harga', sortable: true, width: 'w-32',
      render: p => <span className="font-semibold text-gray-900">{formatCurrency(p.price)}</span>,
    },
    {
      key: 'cost', label: 'HPP', sortable: true, width: 'w-32',
      render: p => <span className="text-gray-500 text-sm">{formatCurrency(p.cost)}</span>,
    },
    {
      key: 'margin', label: 'Margin', sortable: true, width: 'w-24',
      render: p => {
        const m = p.price > 0 ? ((p.price-p.cost)/p.price*100) : 0;
        return <Badge variant={m>=30 ? 'success' : m>=15 ? 'warning' : 'danger'}>{m.toFixed(0)}%</Badge>;
      },
    },
    {
      key: 'recipe', label: 'Resep', width: 'w-16',
      render: p => <span className="text-gray-400 text-sm text-center block">{p.recipe ? p.recipe.items.length : '—'}</span>,
    },
    {
      key: 'active', label: 'Status', width: 'w-20',
      render: p => <Badge variant={p.active ? 'success' : 'default'}>{p.active ? 'Aktif' : 'Off'}</Badge>,
    },
  ];

  const isEditing  = !!editProduct;
  const modalOpen  = showAdd || isEditing;

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Produk & Menu</h1>
          <p className="text-sm text-gray-500 mt-1">Menu dengan costing berbasis resep dan modifier</p>
        </div>

        <Toolbar
          search={search} onSearch={setSearch} searchPlaceholder="Cari produk..."
          filters={[
            { key: 'category', label: 'Kategori', value: filterCat, onChange: setFilterCat, options: categories.map(c => ({ value: c.id, label: c.name })) },
            { key: 'station', label: 'Station', value: filterStation, onChange: setFilterStation, options: [{ value: 'DRINK', label: 'Bar' }, { value: 'FOOD', label: 'Dapur' }] },
          ]}
          onAdd={() => { closeModal(); setShowAdd(true); }} addLabel="Produk Baru"
          onExport={handleExport}

          extra={
  <button onClick={async () => {
    if (!confirm('Recalculate HPP semua produk dari resep?')) return;
    try {
      await api.patch('/api/products', {});
      alert('✅ HPP berhasil diupdate!');
      load();
    } catch (e: any) { alert(e?.message || 'Gagal'); }
  }} className="flex items-center gap-1.5 px-3 py-2 text-sm text-purple-600 border border-purple-200 rounded-xl hover:bg-purple-50 transition-colors">
    💡 Recalculate HPP
  </button>
}
          selected={selected}
          bulkActions={
            <Button variant="danger" size="sm" onClick={() => { if(confirm(`Nonaktifkan ${selected.length} produk?`)) Promise.all(selected.map(id => api.delete(`/api/products?id=${id}`))).then(() => { setSelected([]); load(); }); }}>
              Nonaktifkan {selected.length}
            </Button>
          }
        />

        <DataTable
          data={products} columns={columns} keyField="id" loading={loading}
          emptyMessage="Belum ada produk. Klik 'Produk Baru' untuk menambah."
          selected={selected} onSelectChange={setSelected}
          onRowClick={p => openEdit(p)}
          rowActions={p => (
            <>
              <button onClick={e => { e.stopPropagation(); openEdit(p); }} title="Edit"
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button onClick={e => { e.stopPropagation(); handleDelete(p.id); }} title="Nonaktifkan"
                className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              </button>
            </>
          )}
        />
      </div>

      {/* Add/Edit Modal — form terlalu complex untuk SlideOver */}
      <Modal open={modalOpen} onClose={closeModal} title={isEditing ? `Edit: ${editProduct?.name}` : 'Produk Baru'} maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nama produk" value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="cth. Kopi Susu" />
            <Input label="SKU" value={form.sku} onChange={e => setForm({...form,sku:e.target.value})} placeholder="Opsional" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label="Kategori" value={form.categoryId} onChange={e => setForm({...form,categoryId:e.target.value})}
              options={[{value:'',label:'Pilih kategori'},...categories.map(c=>({value:c.id,label:c.name}))]} />
            <Select label="Station" value={form.station} onChange={e => setForm({...form,station:e.target.value as 'FOOD'|'DRINK'})}
              options={[{value:'DRINK',label:'Bar (minuman)'},{value:'FOOD',label:'Dapur (makanan)'}]} />
            <Input label="Harga (Rp)" type="number" value={form.price} onChange={e => setForm({...form,price:e.target.value})} />
          </div>

          {form.station === 'FOOD' && (
            <div className="grid grid-cols-2 gap-4">
              <Input label="Biaya take-away (Rp)" type="number" value={form.takeawayCharge} onChange={e => setForm({...form,takeawayCharge:e.target.value})} placeholder="cth. 2000" />
              <Select label="Bahan kemasan (box)" value={form.packagingIngredientId} onChange={e => setForm({...form,packagingIngredientId:e.target.value})}
                options={[{value:'',label:'Tidak ada'},...ingredients.filter(i=>i.unit==='pcs').map(i=>({value:i.id,label:i.name}))]} />
            </div>
          )}

          {/* Recipe */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Resep penyajian</label>
              <div className="flex gap-3">
                <button onClick={getRecommendation} className="text-xs text-purple-600 hover:text-purple-700 font-medium">💡 Rekomendasi harga</button>
                <button onClick={() => setForm({...form,recipeItems:[...form.recipeItems,{ingredientId:'',quantity:''}]})} className="text-sm text-brand-600 font-medium">+ Bahan</button>
              </div>
            </div>
            {form.recipeItems.map((ri,i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select value={ri.ingredientId} onChange={e=>{const items=[...form.recipeItems];items[i].ingredientId=e.target.value;setForm({...form,recipeItems:items});}} className="select flex-1">
                  <option value="">Pilih bahan</option>
                  {ingredients.map(ing=><option key={ing.id} value={ing.id}>{ing.type==='PREPPED'?'🔸 ':''}{ing.name} ({ing.unit})</option>)}
                </select>
                <input type="number" placeholder="Qty" value={ri.quantity} onChange={e=>{const items=[...form.recipeItems];items[i].quantity=e.target.value;setForm({...form,recipeItems:items});}} className="input w-24" />
                <button onClick={()=>setForm({...form,recipeItems:form.recipeItems.filter((_,j)=>j!==i)})} className="p-2 text-red-400 hover:text-red-600">✕</button>
              </div>
            ))}
          </div>

          {priceRec && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-purple-800 mb-2">💡 HPP: {formatCurrency(priceRec.cost)} — pilih target margin:</p>
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(priceRec.recommendations).map(([key,val])=>(
                  <button key={key} onClick={()=>setForm({...form,price:String(val)})}
                    className={clsx('py-2 rounded-xl text-sm font-bold border-2 transition-all', form.price===String(val)?'border-purple-500 bg-purple-100 text-purple-700':'border-purple-200 text-purple-600 hover:border-purple-300')}>
                    <span className="block text-[10px] opacity-70">{key.replace('margin','')}%</span>
                    {formatCurrency(val)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Modifier editor */}
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0">Modifier Groups</label>
              <button onClick={addGroup} className="text-sm text-brand-600 font-medium">+ Grup</button>
            </div>
            {form.modGroups.length===0 && <p className="text-xs text-gray-400">Belum ada modifier. Tambah untuk pilihan (Sweetness, Ice, Add-on, dll).</p>}
            <div className="space-y-3">
              {form.modGroups.map((g,gi)=>(
                <div key={gi} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex gap-2 mb-2">
                    <input value={g.name} onChange={e=>updGroup(gi,{name:e.target.value})} placeholder="Nama grup (cth. Sweetness)" className="input flex-1 text-sm" />
                    <select value={g.selectionType} onChange={e=>updGroup(gi,{selectionType:e.target.value as 'SINGLE'|'MULTI'})} className="select w-32 text-sm">
                      <option value="SINGLE">Pilih 1</option><option value="MULTI">Pilih banyak</option>
                    </select>
                    <button onClick={()=>setGroups(form.modGroups.filter((_,i)=>i!==gi))} className="p-2 text-red-400 hover:text-red-600">✕</button>
                  </div>
                  <div className="space-y-2 pl-2 border-l-2 border-gray-200">
                    {g.options.map((o,oi)=>(
                      <div key={oi} className="grid grid-cols-12 gap-1.5 items-center">
                        <input value={o.name} onChange={e=>updOption(gi,oi,{name:e.target.value})} placeholder="Opsi" className="input col-span-3 text-sm" />
                        <select value={o.effect} onChange={e=>updOption(gi,oi,{effect:e.target.value as 'ADJUST'|'ADD'})} className="select col-span-2 text-sm">
                          <option value="ADJUST">skala</option><option value="ADD">tambah</option>
                        </select>
                        <select value={o.targetIngredientId} onChange={e=>updOption(gi,oi,{targetIngredientId:e.target.value})} className="select col-span-3 text-sm">
                          <option value="">target —</option>
                          {ingredients.map(ing=><option key={ing.id} value={ing.id}>{ing.name}</option>)}
                        </select>
                        {o.effect==='ADJUST'
                          ? <input type="number" step="0.1" value={o.multiplier} onChange={e=>updOption(gi,oi,{multiplier:e.target.value})} placeholder="x" className="input col-span-1 text-sm" title="multiplier" />
                          : <input type="number" value={o.addQty} onChange={e=>updOption(gi,oi,{addQty:e.target.value})} placeholder="qty" className="input col-span-1 text-sm" />}
                        <input type="number" value={o.priceDelta} onChange={e=>updOption(gi,oi,{priceDelta:e.target.value})} placeholder="+Rp" className="input col-span-2 text-sm" />
                        <label className="col-span-1 flex items-center justify-center" title="default"><input type="checkbox" checked={o.isDefault} onChange={e=>updOption(gi,oi,{isDefault:e.target.checked})} /></label>
                      </div>
                    ))}
                    <button onClick={()=>updGroup(gi,{options:[...g.options,emptyOption()]})} className="text-xs text-brand-600 font-medium">+ Opsi</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? 'Menyimpan...' : isEditing ? 'Update Produk' : 'Buat Produk'}</Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}
