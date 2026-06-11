'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card, Button, Badge, Modal, Input, Select, Loader, formatCurrency, formatNumber } from '@/components/ui';
import { api } from '@/lib/fetch';
import clsx from 'clsx';

interface Ingredient {
  id: string; name: string; type: string; unit: string; purchaseUnit: string | null;
  conversionRate: number | null; minStock: number; latestPrice: number;
  stockLevels: Array<{ quantity: number }>;
  prepRecipe?: { yieldQty: number | null; yieldUnit: string | null; items: Array<{ ingredient: { id: string; name: string; unit: string }; quantity: number }> };
}

interface StockMovement {
  id: string; type: string; quantity: number; notes: string | null; createdAt: string;
  ingredient: { name: string; unit: string };
}

export default function InventoryPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<'stock' | 'movements'>('stock');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Form for adding ingredient
  const emptyForm = { name: '', unit: 'g', minStock: '0', latestPrice: '0', type: 'RAW', purchaseUnit: '', conversionRate: '', prepYield: '', prepYieldUnit: '', prepItems: [] as { ingredientId: string; quantity: string }[] };
  const [form, setForm] = useState(emptyForm);

  // Only load raw ingredients for prepped recipe builder
  const rawIngredients = ingredients.filter(i => i.type === 'RAW');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/ingredients?';
      if (typeFilter) url += `type=${typeFilter}&`;
      if (search) url += `search=${encodeURIComponent(search)}&`;
      const [ings, movs] = await Promise.all([
        api.get<Ingredient[]>(url),
        api.get<StockMovement[]>('/api/stock-movements?limit=50'),
      ]);
      setIngredients(ings); setMovements(movs);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.name || !form.unit) { alert('Name and unit are required'); return; }
    try {
      const payload: Record<string, unknown> = {
        name: form.name, unit: form.unit, type: form.type,
        minStock: parseFloat(form.minStock) || 0,
        latestPrice: parseFloat(form.latestPrice) || 0,
      };
      if (form.purchaseUnit) payload.purchaseUnit = form.purchaseUnit;
      if (form.conversionRate) payload.conversionRate = parseFloat(form.conversionRate);

      // Prepped ingredient sub-recipe
      if (form.type === 'PREPPED' && form.prepItems.length > 0) {
        payload.prepRecipe = {
          yieldQty: form.prepYield ? parseFloat(form.prepYield) : null,
          yieldUnit: form.prepYieldUnit || form.unit,
          items: form.prepItems.filter(i => i.ingredientId && i.quantity).map(i => ({
            ingredientId: i.ingredientId, quantity: parseFloat(i.quantity),
          })),
        };
      }

      await api.post('/api/ingredients', payload);
      setShowAdd(false); setForm(emptyForm); load();
    } catch (e: any) { alert(e.message || 'Failed'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this ingredient?')) return;
    try { await api.delete(`/api/ingredients?id=${id}`); load(); } catch (e: any) { alert(e.message || 'Failed'); }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="page-header">
          <div><h2 className="page-title">Inventory</h2><p className="page-subtitle">Manage ingredients and stock levels</p></div>
          <div className="flex gap-3">
            <div className="tab-group">
              {(['stock', 'movements'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} className={clsx('tab-item', tab === t ? 'tab-active' : 'tab-inactive')}>{t}</button>
              ))}
            </div>
            <Button onClick={() => { setForm(emptyForm); setShowAdd(true); }}>+ Add Ingredient</Button>
          </div>
        </div>

        <Card><div className="filter-bar">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ingredients..." className="filter-input" />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="filter-select">
            <option value="">All Types</option>
            <option value="RAW">Raw Material</option>
            <option value="PREPPED">Prepped / Olahan</option>
          </select>
        </div></Card>

        {loading ? <Loader /> : tab === 'stock' ? (
          <Card padding={false}><div className="table-wrapper"><table className="table">
            <thead><tr>
              <th>Ingredient</th><th>Type</th><th>Unit</th><th className="right">Stock</th>
              <th className="right">Min</th><th className="right">Price/Unit</th><th className="center">Status</th><th></th>
            </tr></thead>
            <tbody>
              {ingredients.map(ing => {
                const stock = ing.stockLevels?.[0]?.quantity ?? 0;
                const isLow = stock <= ing.minStock;
                const isCritical = stock <= 0;
                return (
                  <tr key={ing.id}>
                    <td>
                      <p className="font-medium text-gray-900">{ing.name}</p>
                      {ing.purchaseUnit && <p className="text-xs text-gray-400">Buy: {ing.purchaseUnit} (1 {ing.purchaseUnit} = {ing.conversionRate} {ing.unit})</p>}
                      {ing.type === 'PREPPED' && ing.prepRecipe && (
                        <p className="text-xs text-purple-500 mt-0.5">
                          Recipe: {ing.prepRecipe.items.map(ri => `${ri.quantity}${ri.ingredient.unit} ${ri.ingredient.name}`).join(' + ')}
                          {ing.prepRecipe.yieldQty && ` → yields ${ing.prepRecipe.yieldQty}${ing.prepRecipe.yieldUnit || ing.unit}`}
                        </p>
                      )}
                    </td>
                    <td><Badge variant={ing.type === 'PREPPED' ? 'info' : 'default'}>{ing.type === 'PREPPED' ? '🔸 Prepped' : 'Raw'}</Badge></td>
                    <td className="muted">{ing.unit}</td>
                    <td className={clsx('right font-bold', isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : '')}>{formatNumber(stock)}</td>
                    <td className="right muted">{formatNumber(ing.minStock)}</td>
                    <td className="right">{formatCurrency(ing.latestPrice)}</td>
                    <td className="center">{isCritical ? <Badge variant="danger">Out</Badge> : isLow ? <Badge variant="warning">Low</Badge> : <Badge variant="success">OK</Badge>}</td>
                    <td className="right">
                      <button onClick={() => handleDelete(ing.id)} className="btn btn-sm btn-ghost text-red-500">×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
          {ingredients.length === 0 && <div className="empty-state"><p className="empty-title">No ingredients found</p></div>}
          </Card>
        ) : (
          <Card padding={false}><div className="table-wrapper"><table className="table">
            <thead><tr><th>Date</th><th>Ingredient</th><th>Type</th><th className="right">Qty</th><th>Notes</th></tr></thead>
            <tbody>
              {movements.map(mov => (
                <tr key={mov.id}>
                  <td className="muted">{new Date(mov.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="font-medium">{mov.ingredient.name}</td>
                  <td><Badge variant={mov.quantity > 0 ? 'success' : 'danger'}>{mov.type}</Badge></td>
                  <td className={clsx('right font-bold', mov.quantity > 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {mov.quantity > 0 ? '+' : ''}{formatNumber(mov.quantity)} {mov.ingredient.unit}
                  </td>
                  <td className="muted truncate max-w-[200px]">{mov.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          {movements.length === 0 && <div className="empty-state"><p className="empty-title">No movements</p></div>}
          </Card>
        )}
      </div>

      {/* Add Ingredient Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Ingredient" maxWidth="max-w-2xl">
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Coffee Beans" />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type" value={form.type} onChange={e => setForm({...form, type: e.target.value})} options={[
              { value: 'RAW', label: 'Raw Material' }, { value: 'PREPPED', label: 'Prepped / Olahan' },
            ]} />
            <Select label="Primary Unit" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} options={[
              { value: 'g', label: 'Grams (g)' }, { value: 'kg', label: 'Kilograms (kg)' },
              { value: 'ml', label: 'Milliliters (ml)' }, { value: 'L', label: 'Liters (L)' }, { value: 'pcs', label: 'Pieces (pcs)' },
            ]} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Purchase Unit (optional)" value={form.purchaseUnit} onChange={e => setForm({...form, purchaseUnit: e.target.value})} placeholder="e.g. kg, L, box" />
            <Input label="Conversion Rate" type="number" value={form.conversionRate} onChange={e => setForm({...form, conversionRate: e.target.value})} placeholder="e.g. 1000 (1kg=1000g)" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Min Stock" type="number" value={form.minStock} onChange={e => setForm({...form, minStock: e.target.value})} />
            <Input label="Price per Unit (IDR)" type="number" value={form.latestPrice} onChange={e => setForm({...form, latestPrice: e.target.value})} />
          </div>

          {form.purchaseUnit && form.conversionRate && (
            <div className="info-box">1 {form.purchaseUnit} = {form.conversionRate} {form.unit}</div>
          )}

          {/* Prepped Ingredient Recipe Builder */}
          {form.type === 'PREPPED' && (
            <div className="border border-purple-200 rounded-xl p-4 bg-purple-50/50">
              <div className="flex items-center justify-between mb-3">
                <label className="label mb-0 text-purple-800">🔸 Sub-Recipe (raw materials needed)</label>
                <button onClick={() => setForm({...form, prepItems: [...form.prepItems, { ingredientId: '', quantity: '' }]})}
                  className="text-sm text-purple-600 font-medium">+ Add Raw Material</button>
              </div>
              {form.prepItems.map((ri, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <select value={ri.ingredientId}
                    onChange={e => { const items = [...form.prepItems]; items[i].ingredientId = e.target.value; setForm({...form, prepItems: items}); }}
                    className="select flex-1">
                    <option value="">Select raw material</option>
                    {rawIngredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>)}
                  </select>
                  <input type="number" placeholder="Qty" value={ri.quantity}
                    onChange={e => { const items = [...form.prepItems]; items[i].quantity = e.target.value; setForm({...form, prepItems: items}); }}
                    className="input w-24" />
                  <button onClick={() => setForm({...form, prepItems: form.prepItems.filter((_, idx) => idx !== i)})} className="p-2 text-red-400 hover:text-red-600">✕</button>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4 mt-3">
                <Input label="Yield Quantity" type="number" value={form.prepYield} onChange={e => setForm({...form, prepYield: e.target.value})} placeholder="e.g. 800" />
                <Input label="Yield Unit" value={form.prepYieldUnit} onChange={e => setForm({...form, prepYieldUnit: e.target.value})} placeholder={form.unit} />
              </div>
              {form.prepItems.length > 0 && <p className="text-xs text-purple-600 mt-2">Cost will be auto-calculated from raw material prices.</p>}
            </div>
          )}

          <Button onClick={handleAdd} className="w-full">Add Ingredient</Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}
