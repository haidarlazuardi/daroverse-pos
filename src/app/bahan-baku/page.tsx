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
  shelfLifeDays: number | null; instructions: any | null;
  items: { quantity: number; ingredient: { id: string; name: string; unit: string; latestPrice: number } }[];
}
interface PrepIngredient extends Ingredient {
  prepRecipe?: PrepRecipe;
}

const EMPTY_RAW = {
  name: '', type: 'RAW', unit: 'g', purchaseUnit: '', conversionRate: '',
  latestPrice: '', purchasePrice: '', minStock: '', defaultLocation: 'GUDANG', isPackaging: false,
  defaultSupplierId: '',
};
const EMPTY_PREP = { name: '', unit: 'ml', yieldQty: '', yieldUnit: 'ml', minStock: '', latestPrice: '', shelfLifeDays: '', steps: [] as { title: string; description: string }[] };
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
  const [suppliers, setSuppliers] = useState<any[]>([]);

  // PREPPED form
  const [prepSlide, setPrepSlide]   = useState(false);
  const [viewPrep, setViewPrep] = useState<PrepIngredient | null>(null);
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
      const [res, sups] = await Promise.all([
        api.get<any[]>('/api/ingredients'),
        api.get<any[]>('/api/suppliers').catch(() => []),
      ]);
      const raw  = res.filter((i: any) => i.type === 'RAW'     && i.active);
      const prep = res.filter((i: any) => i.type === 'PREPPED'  && i.active);
      setRawData(raw);
      setRawAll(raw);
      setPrepData(prep);
      setSuppliers(Array.isArray(sups) ? sups : (sups as any)?.suppliers || []);
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
      defaultLocation: (ing as any).defaultLocation || (ing.type === 'RAW' ? 'GUDANG' : ''),
      isPackaging: (ing as any).isPackaging || false,
      defaultSupplierId: (ing as any).defaultSupplierId || '',
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
        defaultSupplierId: (rawForm as any).defaultSupplierId || null,
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
    setPrepForm({ name: ing.name, unit: ing.unit, yieldQty: ing.prepRecipe?.yieldQty ? String(ing.prepRecipe.yieldQty) : '', yieldUnit: ing.prepRecipe?.yieldUnit || ing.unit, minStock: String(ing.minStock), latestPrice: String(ing.latestPrice), shelfLifeDays: ing.prepRecipe?.shelfLifeDays ? String(ing.prepRecipe.shelfLifeDays) : '', steps: Array.isArray(ing.prepRecipe?.instructions) ? ing.prepRecipe.instructions as { title: string; description: string }[] : [] });
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
          shelfLifeDays: prepForm.shelfLifeDays ? parseInt(prepForm.shelfLifeDays) : null,
          instructions: prepForm.steps.length > 0 ? prepForm.steps.filter(s => s.title || s.description) : null,
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


  function printRaw() {
    const now = new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
    const rows = rawData.map((i,n) => `<tr>
      <td>${n+1}</td><td><strong>${i.name}</strong></td><td>${i.unit}</td>
      <td>${i.purchaseUnit||'—'}</td>
      <td>${i.conversionRate?`${i.conversionRate} ${i.unit}`:'—'}</td>
      <td style="text-align:right">${i.latestPrice>0?'Rp '+Math.round(i.latestPrice).toLocaleString('id-ID'):'—'}</td>
      <td style="text-align:right">${i.conversionRate&&i.latestPrice?'Rp '+Math.round(i.latestPrice*i.conversionRate).toLocaleString('id-ID'):'—'}</td>
      <td style="text-align:right">${i.minStock>0?`${i.minStock} ${i.unit}`:'—'}</td>
      <td>${(i as any).defaultLocation||'GUDANG'}</td>
    </tr>`).join('');
    const css = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:8.5pt;color:#111}@media print{@page{size:A4 landscape;margin:10mm 12mm}}.hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #48654D;padding-bottom:3mm;margin-bottom:4mm}.logo{width:9mm;height:9mm;background:#48654D;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:11pt}.title{font-size:14pt;font-weight:900;color:#2D4A32;margin-left:3mm}.sec{background:#48654D;color:#F6EDDB;padding:2mm 4mm;font-size:10pt;font-weight:900;margin-bottom:0}table{width:100%;border-collapse:collapse}th{background:#F6EDDB;color:#2D4A32;font-size:7pt;font-weight:700;text-transform:uppercase;padding:2mm 2.5mm;text-align:left;border-bottom:1.5px solid #D8CFC0}td{padding:1.8mm 2.5mm;border-bottom:0.5px solid #F0ECE4;font-size:8.5pt}tr:nth-child(even) td{background:#FAFAF8}.ftr{margin-top:3mm;font-size:7pt;color:#aaa;display:flex;justify-content:space-between;border-top:0.5px solid #eee;padding-top:2mm}`;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bahan Mentah</title><style>${css}</style></head><body><div class="hdr"><div style="display:flex;align-items:center"><div class="logo">S</div><div class="title">Master Bahan Mentah</div></div><div style="font-size:7.5pt;color:#888">Soeka House — ${now}</div></div><div class="sec">Bahan Mentah (RAW) — ${rawData.length} bahan</div><table><tr><th>#</th><th>Nama</th><th>Satuan</th><th>Satuan Beli</th><th>Isi/Satuan</th><th>Harga/Unit</th><th>Harga/Satuan Beli</th><th>Stok Min</th><th>Lokasi</th></tr>${rows}</table><div class="ftr"><span>SOEKA HOUSE — Dokumen Internal</span><span>Dicetak ${now}</span></div><script>window.onload=()=>window.print()</script></body></html>`;
    const w = window.open('','_blank'); if(w){w.document.write(html);w.document.close();}
  }

  function printPrepped() {
    const now = new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
    // Group by location/type (all in one page like menu resep)
    const css = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:8.5pt;color:#111}@media print{@page{size:A4 portrait;margin:10mm 12mm}.page{page-break-after:always}.page:last-child{page-break-after:avoid}}.page{padding:6mm 8mm}.hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #48654D;padding-bottom:2.5mm;margin-bottom:3mm}.logo{width:8mm;height:8mm;background:#48654D;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:10pt}.title{font-size:12pt;font-weight:900;color:#2D4A32;margin-left:2.5mm}.cat{background:#2D4A32;color:#F6EDDB;padding:2mm 4mm;font-size:10pt;font-weight:900;margin-bottom:2.5mm}.card{border:1px solid #EDE5D0;border-radius:3px;margin-bottom:2.5mm;overflow:hidden;break-inside:avoid}.ctop{padding:2mm 3mm;background:#FAFAF8;border-bottom:1px solid #EDE5D0}.rname{font-size:10pt;font-weight:900;color:#2D4A32}.body{display:flex}.ci{flex:0 0 42%;padding:2mm 3mm;border-right:1px solid #EDE5D0}.cs{flex:1;padding:2mm 3mm}.lbl{font-size:6.5pt;font-weight:700;color:#48654D;text-transform:uppercase;letter-spacing:0.8px;padding-bottom:1.5mm;border-bottom:1px solid #F0ECE4;margin-bottom:1.5mm}.ir{display:flex;justify-content:space-between;padding:0.8mm 0;border-bottom:0.3px solid #F5F3EE;font-size:8pt}.iq{font-weight:700;color:#48654D}.bl{border-bottom:0.5px solid #EDE5D0;margin-bottom:4.5mm}.bh{font-size:7pt;color:#bbb;font-style:italic;margin-top:1.5mm}.ftr{margin-top:2.5mm;padding-top:1.5mm;border-top:0.5px solid #EDE5D0;display:flex;justify-content:space-between;font-size:6.5pt;color:#ccc}`;
    const cards = prepData.map(i => {
      const items = (i as any).prepRecipe?.items||[];
      const ingr = items.length>0
        ? items.map((r:any)=>`<div class="ir"><span>${r.ingredient.name}</span><span class="iq">${r.quantity} ${r.ingredient.unit}</span></div>`).join('')
        : '<span style="font-size:7.5pt;color:#aaa">Belum ada resep</span>';
      const steps = Array(6).fill(0).map(()=>'<div class="bl"></div>').join('')+'<p class="bh">Diisi oleh tim operasional</p>';
      return `<div class="card"><div class="ctop"><div class="rname">${i.name}</div></div><div class="body"><div class="ci"><div class="lbl">Bahan</div>${ingr}</div><div class="cs"><div class="lbl">Cara Pembuatan</div>${steps}</div></div></div>`;
    }).join('');
    const page = `<div class="page"><div class="hdr"><div style="display:flex;align-items:center"><div class="logo">S</div><div class="title">Bahan Olahan</div></div><div style="font-size:7pt;color:#888">${now}</div></div><div class="cat">Bahan Olahan (PREPPED) <span style="font-size:7.5pt;opacity:0.7;font-weight:400">${prepData.length} bahan</span></div>${cards}<div class="ftr"><span>SOEKA HOUSE — Panduan Produksi</span><span>${now}</span></div></div>`;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bahan Olahan</title><style>${css}</style></head><body>${page}<script>window.onload=()=>window.print()</script></body></html>`;
    const w = window.open('','_blank'); if(w){w.document.write(html);w.document.close();}
  }

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
            <Toolbar search={search} onSearch={setSearch} searchPlaceholder="Cari bahan..." onExport={handleExport} onPrint={printRaw} onDownloadTemplate={handleDownloadTemplate} onImport={handleImport} onAdd={openAddRaw} addLabel="Bahan Baru" />
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
            <Toolbar search={search} onSearch={setSearch} searchPlaceholder="Cari bahan olahan..." onPrint={printPrepped} onAdd={openAddPrep} addLabel="Tambah Olahan" />
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
                  const steps = Array.isArray(recipe?.instructions) ? recipe.instructions as { title: string; description: string }[] : [];
                  return (
                    <div key={ing.id} className="card p-4 flex flex-col">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-bold" style={{ color: 'var(--text-1)' }}>{ing.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {recipe?.yieldQty && (
                              <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                                Yield: {formatNumber(recipe.yieldQty)} {recipe.yieldUnit || ing.unit}
                              </span>
                            )}
                            {recipe?.shelfLifeDays && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">
                                {recipe.shelfLifeDays}h shelf life
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => setViewPrep(ing)} className="p-1.5 rounded-lg hover:bg-brand-50 text-gray-400 hover:text-brand-600" title="Lihat Detail">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          </button>
                          <button onClick={() => openEditPrep(ing)} className="p-1.5 rounded-lg hover:bg-brand-50 text-gray-400 hover:text-brand-600" title="Edit">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button onClick={() => setDeleteTarget(ing)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500" title="Hapus">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                          </button>
                        </div>
                      </div>

                      {/* Bahan */}
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

                      {/* Steps preview */}
                      {steps.length > 0 && (
                        <div className="mb-3 p-2 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-3)' }}>CARA PEMBUATAN ({steps.length} langkah)</p>
                          <p className="text-xs" style={{ color: 'var(--text-2)' }}>
                            {steps[0].title}{steps.length > 1 ? ` + ${steps.length - 1} langkah lagi...` : ''}
                          </p>
                        </div>
                      )}

                      {/* Footer cost */}
                      <div className="pt-3 border-t flex justify-between mt-auto" style={{ borderColor: 'var(--border)' }}>
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

          {/* Supplier Default */}
          {suppliers.length > 0 && (
            <div className="pt-2">
              <label className="label">Supplier Default</label>
              <select
                value={(rawForm as any).defaultSupplierId || ''}
                onChange={e => setRawForm(p => ({ ...p, defaultSupplierId: e.target.value }))}
                className="select w-full mt-1">
                <option value="">Belum ditentukan</option>
                {suppliers.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                Akan otomatis ter-assign saat generate PO dari request staff
              </p>
            </div>
          )}

          {/* Multi-level unit — only show when editing existing ingredient */}
          {editingRaw && (
            <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="font-bold text-sm mb-1" style={{ color: 'var(--text-1)' }}>Satuan Tambahan</p>
              <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>
                Definisikan satuan beli yang berbeda (maks 3 level). Contoh: pack → karton
              </p>
              <UnitManager ingredientId={editingRaw.id} baseUnit={rawForm.unit}/>
            </div>
          )}
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
          <div>
            <label className="label">Shelf Life (hari)</label>
            <input className="input" type="number" value={prepForm.shelfLifeDays} onChange={e => pf('shelfLifeDays', e.target.value)} placeholder="cth. 3 (tahan 3 hari)" />
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Sistem akan alert jika batch sudah lewat dari tanggal ini</p>
          </div>

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

          {/* Cara pembuatan - structured steps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Cara Pembuatan</label>
              <button onClick={() => setPrepForm(p => ({ ...p, steps: [...p.steps, { title: `Langkah ${p.steps.length + 1}`, description: '' }] }))}
                className="text-xs font-semibold" style={{ color: 'var(--brand)' }}>+ Tambah Langkah</button>
            </div>
            <div className="space-y-2">
              {prepForm.steps.map((step, i) => (
                <div key={i} className="flex gap-2 items-start p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0 mt-1" style={{ background: 'var(--brand)' }}>{i + 1}</div>
                  <div className="flex-1 space-y-1.5">
                    <input className="input text-sm" placeholder="Judul langkah" value={step.title}
                      onChange={e => { const s = [...prepForm.steps]; s[i].title = e.target.value; setPrepForm(p => ({ ...p, steps: s })); }} />
                    <textarea className="input text-sm" rows={2} placeholder="Deskripsi detail" value={step.description}
                      onChange={e => { const s = [...prepForm.steps]; s[i].description = e.target.value; setPrepForm(p => ({ ...p, steps: s })); }} />
                  </div>
                  <button onClick={() => setPrepForm(p => ({ ...p, steps: p.steps.filter((_, j) => j !== i) }))}
                    className="p-1.5 text-gray-400 hover:text-red-500 flex-shrink-0">✕</button>
                </div>
              ))}
              {prepForm.steps.length === 0 && (
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>Belum ada langkah. Klik "+ Tambah Langkah" untuk mulai.</p>
              )}
            </div>
          </div>
        </div>
      </SlideOver>

      {/* ── Detail View PREPPED ──────────────────────────────────────────── */}
      {viewPrep && (
        <SlideOver open={!!viewPrep} onClose={() => setViewPrep(null)} title={viewPrep.name}
          footer={
            <div className="flex gap-3">
              <Button onClick={() => { setViewPrep(null); openEditPrep(viewPrep); }} variant="secondary">Edit</Button>
              <button onClick={() => setViewPrep(null)} className="btn btn-secondary btn-md flex-1">Tutup</button>
            </div>
          }>
          {(() => {
            const recipe = viewPrep.prepRecipe;
            const totalCost = recipe?.items.reduce((s, ri) => s + ri.ingredient.latestPrice * ri.quantity, 0) || 0;
            const costPerUnit = recipe?.yieldQty ? totalCost / recipe.yieldQty : 0;
            const steps = Array.isArray(recipe?.instructions) ? recipe.instructions as { title: string; description: string }[] : [];
            return (
              <div className="space-y-5">
                {/* Info block */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Satuan', value: viewPrep.unit },
                    { label: 'Yield per Batch', value: recipe?.yieldQty ? `${formatNumber(recipe.yieldQty)} ${recipe.yieldUnit || viewPrep.unit}` : '—' },
                    { label: 'Shelf Life', value: recipe?.shelfLifeDays ? `${recipe.shelfLifeDays} hari` : '—' },
                    { label: 'HPP per unit', value: costPerUnit > 0 ? formatCurrency(costPerUnit) : '—' },
                    { label: 'Total biaya bahan', value: formatCurrency(totalCost) },
                    { label: 'Min Stok', value: `${formatNumber(viewPrep.minStock)} ${viewPrep.unit}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                      <p className="text-xs" style={{ color: 'var(--text-3)' }}>{label}</p>
                      <p className="font-semibold text-sm mt-0.5" style={{ color: 'var(--text-1)' }}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Bahan */}
                {recipe?.items?.length ? (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Bahan Pembuat</p>
                    <div className="space-y-1.5">
                      {recipe.items.map((ri, i) => (
                        <div key={i} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: 'var(--brand)' }}>{i + 1}</span>
                            <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{ri.ingredient.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{formatNumber(ri.quantity)}</span>
                            <span className="text-xs ml-1" style={{ color: 'var(--text-3)' }}>{ri.ingredient.unit}</span>
                          </div>
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
            );
          })()}
        </SlideOver>
      )}

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

// ── Unit Manager Component ────────────────────────────────────────────────────
function UnitManager({ ingredientId, baseUnit }: { ingredientId: string; baseUnit: string }) {
  const [units, setUnits] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', parentUnit: '', parentQty: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<any[]>(`/api/ingredient-units?ingredientId=${ingredientId}`)
      .then(r => setUnits(Array.isArray(r) ? r : [])).catch(() => {});
  }, [ingredientId]);

  async function addUnit() {
    if (!form.name || !form.parentQty) return;
    setSaving(true);
    try {
      const u = await api.post<any>('/api/ingredient-units', {
        ingredientId,
        name: form.name,
        parentUnit: form.parentUnit || null,
        parentQty: parseFloat(form.parentQty),
      });
      setUnits(p => [...p, u]);
      setForm({ name: '', parentUnit: '', parentQty: '' });
      setAdding(false);
    } catch(e: any) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function deleteUnit(id: string) {
    if (!confirm('Hapus satuan ini?')) return;
    await api.delete(`/api/ingredient-units?id=${id}`);
    setUnits(p => p.filter(u => u.id !== id));
  }

  return (
    <div className="space-y-2">
      {/* Existing units */}
      {units.length > 0 && (
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
          <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase" style={{ background: 'var(--surface-2)' }}>
            Satuan yang terdaftar
          </div>
          {units.map((u, i) => (
            <div key={u.id} className="flex items-center justify-between px-3 py-2.5 border-t text-sm"
              style={{ borderColor: 'var(--border)' }}>
              <div>
                <span className="font-bold" style={{ color: 'var(--text-1)' }}>1 {u.name}</span>
                <span className="text-gray-400 mx-1">=</span>
                {u.parentUnit
                  ? <span className="text-gray-600">{u.parentQty} {u.parentUnit} = {u.toBase.toLocaleString('id-ID')} {baseUnit}</span>
                  : <span className="text-gray-600">{u.toBase.toLocaleString('id-ID')} {baseUnit}</span>
                }
              </div>
              <button onClick={() => deleteUnit(u.id)} className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50">
                Hapus
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {adding ? (
        <div className="rounded-xl border p-3 space-y-2.5" style={{ borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-xs">Nama Satuan</label>
              <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
                className="input w-full" placeholder="cth. pack, karton, sak"/>
            </div>
            <div>
              <label className="label text-xs">
                {form.parentUnit ? `Jumlah ${form.parentUnit}` : `Isi (${baseUnit})`}
              </label>
              <input type="number" value={form.parentQty} onChange={e => setForm(p => ({...p, parentQty: e.target.value}))}
                className="input w-full" placeholder="cth. 12"/>
            </div>
          </div>
          {units.length > 0 && (
            <div>
              <label className="label text-xs">Satuan Parent (opsional — kosongkan jika langsung ke {baseUnit})</label>
              <select value={form.parentUnit} onChange={e => setForm(p => ({...p, parentUnit: e.target.value}))}
                className="select w-full">
                <option value="">Langsung ke {baseUnit}</option>
                {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </div>
          )}
          {form.name && form.parentQty && (
            <p className="text-xs font-medium" style={{ color: 'var(--brand)' }}>
              Preview: 1 {form.name} = {form.parentUnit
                ? `${form.parentQty} ${form.parentUnit} = ${((units.find(u=>u.name===form.parentUnit)?.toBase||1)*parseFloat(form.parentQty||'0')).toLocaleString('id-ID')} ${baseUnit}`
                : `${parseFloat(form.parentQty||'0').toLocaleString('id-ID')} ${baseUnit}`
              }
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={() => { setAdding(false); setForm({ name:'',parentUnit:'',parentQty:'' }); }}
              className="btn btn-secondary btn-sm flex-1">Batal</button>
            <button onClick={addUnit} disabled={saving || !form.name || !form.parentQty}
              className="btn btn-primary btn-sm flex-1">{saving ? 'Menyimpan...' : 'Tambah'}</button>
          </div>
        </div>
      ) : (
        units.length < 3 && (
          <button onClick={() => setAdding(true)}
            className="w-full py-2 rounded-xl border border-dashed text-sm font-medium"
            style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>
            + Tambah Satuan {units.length === 0 ? '(mis. pack, karton)' : 'Level ' + (units.length + 1)}
          </button>
        )
      )}
    </div>
  );
}
