'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, Button, Modal, Input, Select, formatCurrency } from '@/components/ui';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Toolbar } from '@/components/ui/Toolbar';
import { SlideOver } from '@/components/ui/SlideOver';
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
const emptyForm = {
  name: '', sku: '', categoryId: '', price: '', station: 'DRINK' as 'FOOD'|'DRINK',
  takeawayCharge: '', packagingIngredientId: '',
  recipeItems: [] as { ingredientId: string; quantity: string }[],
  modGroups: [] as ModGroup[],
  // FnB Standard fields
  productType: '',       // cth. Coffee, Non Coffee, Food
  packaging: '',         // cth. Plastik cup 16oz
  shelfLife: '',         // cth. 1 hari dari tanggal pembuatan
  qualityStandard: '',   // syarat mutu
  servingSuggestion: '', // saran penyajian
  servingTools: '',      // alat penyajian
  productionTools: '',   // alat produksi
  steps: [] as { title: string; description: string }[],
};

export default function ProductsPage() {
  const [products, setProducts]       = useState<Product[]>([]);
  function printMenuResep() {
    const now = new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
    const grouped: Record<string,Product[]> = {};
    for (const p of products) {
      const cat = p.category?.name||'Lainnya';
      if (!grouped[cat]) grouped[cat]=[];
      grouped[cat].push(p);
    }
    const css = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:8.5pt;color:#111}@media print{@page{size:A4 portrait;margin:10mm 12mm}.page{page-break-after:always}.page:last-child{page-break-after:avoid}}.page{padding:6mm 8mm}.hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #48654D;padding-bottom:2.5mm;margin-bottom:3mm}.logo{width:8mm;height:8mm;background:#48654D;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:10pt}.title{font-size:12pt;font-weight:900;color:#2D4A32;margin-left:2.5mm}.cat{background:#2D4A32;color:#F6EDDB;padding:2mm 4mm;font-size:10pt;font-weight:900;margin-bottom:2.5mm}.card{border:1px solid #EDE5D0;border-radius:3px;margin-bottom:2.5mm;overflow:hidden;break-inside:avoid}.ctop{padding:2mm 3mm;background:#FAFAF8;border-bottom:1px solid #EDE5D0}.rname{font-size:10pt;font-weight:900;color:#2D4A32}.body{display:flex}.ci{flex:0 0 42%;padding:2mm 3mm;border-right:1px solid #EDE5D0}.cs{flex:1;padding:2mm 3mm}.lbl{font-size:6.5pt;font-weight:700;color:#48654D;text-transform:uppercase;letter-spacing:0.8px;padding-bottom:1.5mm;border-bottom:1px solid #F0ECE4;margin-bottom:1.5mm}.ir{display:flex;justify-content:space-between;padding:0.8mm 0;border-bottom:0.3px solid #F5F3EE;font-size:8pt}.iq{font-weight:700;color:#48654D}.bl{border-bottom:0.5px solid #EDE5D0;margin-bottom:4.5mm}.bh{font-size:7pt;color:#bbb;font-style:italic;margin-top:1.5mm}.ftr{margin-top:2.5mm;padding-top:1.5mm;border-top:0.5px solid #EDE5D0;display:flex;justify-content:space-between;font-size:6.5pt;color:#ccc}`;
    const pages = Object.entries(grouped).map(([cat,items]) => {
      const cards = items.map(p => {
        const ri = (p as any).recipe?.items||[];
        const ingr = ri.length>0
          ? ri.map((r:any)=>`<div class="ir"><span>${r.ingredient.name}</span><span class="iq">${r.quantity} ${r.ingredient.unit}</span></div>`).join('')
          : '<span style="font-size:7.5pt;color:#aaa">Belum ada resep</span>';
        const steps = Array(6).fill(0).map(()=>'<div class="bl"></div>').join('')+'<p class="bh">Diisi oleh tim operasional</p>';
        return `<div class="card"><div class="ctop"><div class="rname">${p.name}</div></div><div class="body"><div class="ci"><div class="lbl">Bahan</div>${ingr}</div><div class="cs"><div class="lbl">Cara Pembuatan</div>${steps}</div></div></div>`;
      }).join('');
      return `<div class="page"><div class="hdr"><div style="display:flex;align-items:center"><div class="logo">S</div><div class="title">Menu &amp; Resep</div></div><div style="font-size:7pt;color:#888">${now}</div></div><div class="cat">${cat} <span style="font-size:7.5pt;opacity:0.7;font-weight:400">${items.length} menu</span></div>${cards}<div class="ftr"><span>SOEKA HOUSE — Panduan Produksi</span><span>${now}</span></div></div>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Menu &amp; Resep</title><style>${css}</style></head><body>${pages}<script>window.onload=()=>window.print()</script></body></html>`;
    const w = window.open('','_blank'); if(w){w.document.write(html);w.document.close();}
  }

  const [categories, setCategories]   = useState<Category[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filterCat, setFilterCat]     = useState('');
  const [filterStation, setFilterStation] = useState('');
  const [selected, setSelected]       = useState<string[]>([]);
  const [showAdd, setShowAdd]         = useState(false);
  const [editProduct, setEditProduct] = useState<Product|null>(null);
  const [viewProduct, setViewProduct] = useState<Product|null>(null);
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
    const inst = (p as any).instructions as any;
    const meta = inst?.meta || {};
    setForm({
      name: p.name, sku: p.sku||'', categoryId: p.category.id, price: String(p.price),
      station: p.station||'DRINK', takeawayCharge: p.takeawayCharge ? String(p.takeawayCharge) : '',
      packagingIngredientId: p.packagingIngredientId||'',
      recipeItems: p.recipe?.items.map(ri => ({ ingredientId: ri.ingredient.id, quantity: String(ri.quantity) })) || [],
      modGroups: (p.modifierGroups||[]).map(g => ({
        name: g.name, selectionType: g.selectionType,
        options: g.options.map(o => ({ name: o.name, effect: o.effect, targetIngredientId: o.targetIngredientId||'', multiplier: o.multiplier!=null ? String(o.multiplier) : '1', addQty: o.addQty!=null ? String(o.addQty) : '', priceDelta: String(o.priceDelta||0), isDefault: o.isDefault })),
      })),
      productType: meta.productType || '',
      packaging: meta.packaging || '',
      shelfLife: meta.shelfLife || '',
      qualityStandard: meta.qualityStandard || '',
      servingSuggestion: meta.servingSuggestion || '',
      servingTools: meta.servingTools || '',
      productionTools: meta.productionTools || '',
      steps: inst?.steps || [],
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
    instructions: {
      meta: {
        productType: form.productType || null,
        packaging: form.packaging || null,
        shelfLife: form.shelfLife || null,
        qualityStandard: form.qualityStandard || null,
        servingSuggestion: form.servingSuggestion || null,
        servingTools: form.servingTools || null,
        productionTools: form.productionTools || null,
      },
      steps: form.steps.filter(s => s.title || s.description),
    },
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
    const wb = XLSX.utils.book_new();

    // Group products by category
    const grouped = new Map<string, typeof products>();
    for (const p of products) {
      const cat = p.category?.name || 'Lainnya';
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(p);
    }

    // ── Sheet 1: Ringkasan per Kategori ─────────────────────────
    const summaryRows: any[] = [];
    for (const [cat, items] of grouped) {
      const totalRevenue = items.reduce((s, p) => s + p.price, 0);
      const avgMargin = items.length > 0
        ? items.reduce((s, p) => s + (p.price > 0 ? (p.price - p.cost) / p.price * 100 : 0), 0) / items.length
        : 0;
      summaryRows.push({
        'Kategori': cat,
        'Jumlah Menu': items.length,
        'Rata-rata Harga Jual': Math.round(totalRevenue / items.length),
        'Rata-rata Margin (%)': avgMargin.toFixed(1),
        'Menu Aktif': items.filter(p => p.active).length,
        'Menu Nonaktif': items.filter(p => !p.active).length,
      });
    }
    summaryRows.push({
      'Kategori': 'TOTAL',
      'Jumlah Menu': products.length,
      'Rata-rata Harga Jual': '',
      'Rata-rata Margin (%)': '',
      'Menu Aktif': products.filter(p => p.active).length,
      'Menu Nonaktif': products.filter(p => !p.active).length,
    });

    const wsSum = XLSX.utils.json_to_sheet(summaryRows);
    wsSum['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsSum, '📊 Ringkasan');

    // ── Sheet 2: Semua Produk per Kategori ───────────────────────
    const allRows: any[] = [];
    for (const [cat, items] of grouped) {
      // Category header row
      allRows.push({ '': `── ${cat} (${items.length} menu) ──` });
      // Column headers
      allRows.push({
        '': 'Nama Produk',
        ' ': 'SKU',
        '  ': 'Station',
        '   ': 'Harga Jual',
        '    ': 'HPP',
        '     ': 'Margin %',
        '      ': 'Profit/Porsi',
        '       ': 'Status',
      });
      // Product rows
      for (const p of items) {
        const margin = p.price > 0 ? ((p.price - p.cost) / p.price * 100) : 0;
        allRows.push({
          '': p.name,
          ' ': p.sku ?? '-',
          '  ': p.station === 'FOOD' ? 'Dapur' : 'Bar',
          '   ': p.price,
          '    ': p.cost,
          '     ': `${margin.toFixed(1)}%`,
          '      ': p.price - p.cost,
          '       ': p.active ? 'Aktif' : 'Nonaktif',
        });
      }
      // Empty spacer
      allRows.push({});
    }

    const wsAll = XLSX.utils.json_to_sheet(allRows, { skipHeader: true });
    wsAll['!cols'] = [{ wch: 32 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsAll, '📋 Semua Produk');

    // ── Sheet per kategori (kalau ada filter) ────────────────────
    for (const [cat, items] of grouped) {
      const rows = items.map(p => {
        const margin = p.price > 0 ? ((p.price - p.cost) / p.price * 100) : 0;
        return {
          'Nama Produk': p.name,
          'SKU': p.sku ?? '-',
          'Station': p.station === 'FOOD' ? 'Dapur' : 'Bar',
          'Harga Jual (Rp)': p.price,
          'HPP (Rp)': p.cost,
          'Margin (%)': parseFloat(margin.toFixed(1)),
          'Profit per Porsi (Rp)': p.price - p.cost,
          'Jumlah Bahan': p.recipe?.items.length ?? 0,
          'Status': p.active ? 'Aktif' : 'Nonaktif',
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 10 }];
      // Sheet name max 31 chars
      const sheetName = cat.slice(0, 28);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    // ── Sheet: Resep Detail ───────────────────────────────────────
    const recipeRows: any[] = [];
    for (const p of products) {
      if (!p.recipe?.items.length) continue;
      for (const ri of p.recipe.items) {
        recipeRows.push({
          'Produk': p.name,
          'Kategori': p.category?.name ?? '',
          'Station': p.station === 'FOOD' ? 'Dapur' : 'Bar',
          'Bahan': ri.ingredient.name,
          'Jumlah': ri.quantity,
          'Satuan': ri.ingredient.unit,
          'Harga Jual': p.price,
          'HPP': p.cost,
        });
      }
    }
    if (recipeRows.length > 0) {
      const wsR = XLSX.utils.json_to_sheet(recipeRows);
      wsR['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 10 }, { wch: 28 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsR, '🧪 Resep Detail');
    }

    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `soeka-menu-${date}.xlsx`);
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
          onPrint={printMenuResep} onAdd={() => { closeModal(); setShowAdd(true); }} addLabel="Produk Baru"
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
              <button onClick={e => { e.stopPropagation(); setViewProduct(p); }} title="Lihat Detail"
                className="p-1.5 hover:bg-brand-50 rounded-lg text-gray-400 hover:text-brand-600 transition-colors">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
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

          {/* ── Standar Produksi (FnB Standard) ── */}
          <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <p className="text-sm font-bold mb-3" style={{ color: 'var(--text-1)' }}>📋 Standar Produksi</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Tipe Produk</label>
                <input className="input" value={form.productType} onChange={e => setForm({...form, productType: e.target.value})} placeholder="cth. Coffee, Non Coffee, Food" />
              </div>
              <div>
                <label className="label">Kemasan</label>
                <input className="input" value={form.packaging} onChange={e => setForm({...form, packaging: e.target.value})} placeholder="cth. Plastik cup 16oz" />
              </div>
              <div>
                <label className="label">Umur Simpan</label>
                <input className="input" value={form.shelfLife} onChange={e => setForm({...form, shelfLife: e.target.value})} placeholder="cth. 1 hari dari tanggal pembuatan" />
              </div>
              <div className="col-span-2">
                <label className="label">Syarat Mutu</label>
                <input className="input" value={form.qualityStandard} onChange={e => setForm({...form, qualityStandard: e.target.value})} placeholder="cth. Kemasan tidak boleh cacat (sobek, bocor, penyok)" />
              </div>
              <div className="col-span-2">
                <label className="label">Saran Penyajian</label>
                <input className="input" value={form.servingSuggestion} onChange={e => setForm({...form, servingSuggestion: e.target.value})} placeholder="cth. Baiknya langsung diminum dalam kondisi fresh" />
              </div>
              <div>
                <label className="label">Alat Penyajian</label>
                <input className="input" value={form.servingTools} onChange={e => setForm({...form, servingTools: e.target.value})} placeholder="cth. Sendok, sedotan, paper bag" />
              </div>
              <div>
                <label className="label">Alat Produksi</label>
                <input className="input" value={form.productionTools} onChange={e => setForm({...form, productionTools: e.target.value})} placeholder="cth. Espresso Machine, Digital Scale" />
              </div>
            </div>

            {/* Steps / Cara Pembuatan */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Cara Pembuatan</label>
                <button onClick={() => setForm({...form, steps: [...form.steps, { title: `Langkah ${form.steps.length + 1}`, description: '' }]})}
                  className="text-xs font-semibold" style={{ color: 'var(--brand)' }}>+ Tambah Langkah</button>
              </div>
              <div className="space-y-2">
                {form.steps.map((step, i) => (
                  <div key={i} className="flex gap-2 items-start p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0 mt-1" style={{ background: 'var(--brand)' }}>{i + 1}</div>
                    <div className="flex-1 space-y-1.5">
                      <input className="input text-sm" placeholder="Judul langkah" value={step.title}
                        onChange={e => { const s = [...form.steps]; s[i].title = e.target.value; setForm({...form, steps: s}); }} />
                      <textarea className="input text-sm" rows={2} placeholder="Deskripsi detail" value={step.description}
                        onChange={e => { const s = [...form.steps]; s[i].description = e.target.value; setForm({...form, steps: s}); }} />
                    </div>
                    <button onClick={() => setForm({...form, steps: form.steps.filter((_,j) => j !== i)})}
                      className="p-1.5 text-gray-400 hover:text-red-500 flex-shrink-0">✕</button>
                  </div>
                ))}
                {form.steps.length === 0 && (
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>Belum ada langkah. Klik "+ Tambah Langkah" untuk mulai.</p>
                )}
              </div>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? 'Menyimpan...' : isEditing ? 'Update Produk' : 'Buat Produk'}</Button>
        </div>
      </Modal>
      {/* ── Detail View Produk ── */}
      {viewProduct && (() => {
        const inst = (viewProduct as any).instructions as any;
        const meta = inst?.meta || {};
        const steps: { title: string; description: string }[] = inst?.steps || [];
        const recipe = viewProduct.recipe;
        return (
          <SlideOver open={!!viewProduct} onClose={() => setViewProduct(null)} title={viewProduct.name}
            footer={
              <div className="flex gap-3">
                <Button onClick={() => { setViewProduct(null); openEdit(viewProduct); }} variant="secondary">Edit</Button>
                <button onClick={() => setViewProduct(null)} className="btn btn-secondary btn-md flex-1">Tutup</button>
              </div>
            }>
            <div className="space-y-5">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Harga Jual', value: formatCurrency(viewProduct.price) },
                  { label: 'HPP', value: formatCurrency(viewProduct.cost) },
                  { label: 'Margin', value: viewProduct.price > 0 ? `${(((viewProduct.price - viewProduct.cost) / viewProduct.price) * 100).toFixed(1)}%` : '—' },
                  { label: 'Station', value: viewProduct.station === 'FOOD' ? '🍳 Dapur' : '☕ Bar' },
                  { label: 'SKU', value: viewProduct.sku || '—' },
                  { label: 'Kategori', value: viewProduct.category?.name || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>{label}</p>
                    <p className="font-semibold text-sm mt-0.5" style={{ color: 'var(--text-1)' }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Standar Produksi */}
              {Object.values(meta).some(Boolean) && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Standar Produksi</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Tipe Produk', value: meta.productType },
                      { label: 'Kemasan', value: meta.packaging },
                      { label: 'Umur Simpan', value: meta.shelfLife },
                      { label: 'Syarat Mutu', value: meta.qualityStandard },
                      { label: 'Saran Penyajian', value: meta.servingSuggestion },
                      { label: 'Alat Penyajian', value: meta.servingTools },
                      { label: 'Alat Produksi', value: meta.productionTools },
                    ].filter(i => i.value).map(({ label, value }) => (
                      <div key={label} className="flex gap-3 p-2.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                        <span className="text-xs font-semibold w-28 flex-shrink-0 pt-0.5" style={{ color: 'var(--text-3)' }}>{label}</span>
                        <span className="text-sm" style={{ color: 'var(--text-1)' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resep */}
              {recipe?.items?.length ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Resep</p>
                  <div className="space-y-1.5">
                    {recipe.items.map((ri, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: 'var(--brand)' }}>{i + 1}</span>
                          <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{ri.ingredient.name}</span>
                        </div>
                        <span className="text-sm font-bold" style={{ color: 'var(--text-2)' }}>{ri.quantity} {ri.ingredient.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Cara pembuatan */}
              {steps.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Cara Pembuatan</p>
                  <div className="space-y-2">
                    {steps.map((step, i) => (
                      <div key={i} className="flex gap-3 p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0" style={{ background: 'var(--brand)' }}>{i + 1}</div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{step.title}</p>
                          {step.description && <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>{step.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SlideOver>
        );
      })()}

    </AdminLayout>
  );
}
