'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card, Button, Badge, Modal, Input, Select, Loader, formatCurrency } from '@/components/ui';
import { api } from '@/lib/fetch';
import clsx from 'clsx';

interface Product {
  id: string; name: string; sku: string | null; price: number; cost: number; active: boolean;
  category: { id: string; name: string; color: string };
  recipe?: { items: Array<{ ingredient: { id: string; name: string; unit: string }; quantity: number }> };
}
interface Category { id: string; name: string; color: string }
interface Ingredient { id: string; name: string; unit: string; latestPrice: number; type?: string }

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddCat, setShowAddCat] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [form, setForm] = useState({ name: '', sku: '', categoryId: '', price: '', recipeItems: [] as { ingredientId: string; quantity: string }[] });
  const [catForm, setCatForm] = useState({ name: '', color: '#22c55e' });
  const [priceRec, setPriceRec] = useState<{ cost: number; recommendations: Record<string, number> } | null>(null);

  const load = useCallback(async () => {
    try {
      let url = '/api/products?';
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (filterCat) url += `categoryId=${filterCat}&`;
      const [p, c, i] = await Promise.all([
        api.get<Product[]>(url), api.get<Category[]>('/api/categories'), api.get<Ingredient[]>('/api/ingredients'),
      ]);
      setProducts(p); setCategories(c); setIngredients(i);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, filterCat]);

  useEffect(() => { load(); }, [load]);

  const getRecommendation = async () => {
    if (form.recipeItems.length === 0 || form.recipeItems.some(r => !r.ingredientId || !r.quantity)) return;
    try {
      const rec = await api.post<any>('/api/products', {
        name: 'temp', categoryId: form.categoryId || categories[0]?.id || 'x', recommendOnly: true,
        recipe: { items: form.recipeItems.map(ri => ({ ingredientId: ri.ingredientId, quantity: parseFloat(ri.quantity) || 0 })) },
      });
      setPriceRec(rec);
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
    try {
      if (editProduct) {
        await api.put('/api/products', {
          id: editProduct.id, name: form.name, sku: form.sku || undefined, categoryId: form.categoryId, price: form.price,
          recipe: form.recipeItems.length > 0 ? { items: form.recipeItems.map(ri => ({ ingredientId: ri.ingredientId, quantity: parseFloat(ri.quantity) })) } : undefined,
        });
      } else {
        await api.post('/api/products', {
          name: form.name, sku: form.sku || undefined, categoryId: form.categoryId, price: form.price,
          recipe: form.recipeItems.length > 0 ? { items: form.recipeItems.map(ri => ({ ingredientId: ri.ingredientId, quantity: parseFloat(ri.quantity) })) } : undefined,
        });
      }
      closeModal(); load();
    } catch (e: any) { alert(e.message || 'Failed'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this product? It will be hidden from POS.')) return;
    try {
      await api.delete(`/api/products?id=${id}`);
      load();
    } catch (e: any) {
      alert(e.message || 'Failed to delete');
    }
  };

  const openEdit = (p: Product) => {
    setForm({
      name: p.name, sku: p.sku || '', categoryId: p.category.id, price: String(p.price),
      recipeItems: p.recipe?.items.map(ri => ({ ingredientId: ri.ingredient.id, quantity: String(ri.quantity) })) || [],
    });
    setPriceRec(null); setEditProduct(p);
  };

  const closeModal = () => { setShowAdd(false); setEditProduct(null); setForm({ name: '', sku: '', categoryId: '', price: '', recipeItems: [] }); setPriceRec(null); };
  const addRecipeItem = () => setForm({ ...form, recipeItems: [...form.recipeItems, { ingredientId: '', quantity: '' }] });
  const isEditing = !!editProduct;
  const modalOpen = showAdd || isEditing;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="page-header">
          <div><h2 className="page-title">Products</h2><p className="page-subtitle">Menu items with recipe-based costing</p></div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowAddCat(true)}>+ Category</Button>
            <Button onClick={() => { closeModal(); setShowAdd(true); }}>+ Product</Button>
          </div>
        </div>

        <Card><div className="filter-bar">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="filter-input" />
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="filter-select">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div></Card>

        {loading ? <Loader /> : (
          <Card padding={false}><div className="table-wrapper"><table className="table">
            <thead><tr>
              <th>Product</th><th>Category</th><th className="right">Price</th><th className="right">Cost</th>
              <th className="right">Margin</th><th className="center">Recipe</th><th className="center">Status</th><th></th>
            </tr></thead>
            <tbody>
              {products.map(p => {
                const margin = p.price > 0 ? ((p.price - p.cost) / p.price * 100) : 0;
                return (
                  <tr key={p.id}>
                    <td><p className="font-medium text-gray-900">{p.name}</p>{p.sku && <p className="text-xs text-gray-400">{p.sku}</p>}</td>
                    <td><span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.category.color }} />{p.category.name}</span></td>
                    <td className="right bold">{formatCurrency(p.price)}</td>
                    <td className="right muted">{formatCurrency(p.cost)}</td>
                    <td className="right"><Badge variant={margin >= 30 ? 'success' : margin >= 15 ? 'warning' : 'danger'}>{margin.toFixed(0)}%</Badge></td>
                    <td className="center muted">{p.recipe ? `${p.recipe.items.length} items` : '—'}</td>
                    <td className="center"><Badge variant={p.active ? 'success' : 'default'}>{p.active ? 'Active' : 'Off'}</Badge></td>
                    <td className="right">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEdit(p)} className="btn btn-sm btn-ghost">Edit</button>
                        <button onClick={() => handleDelete(p.id)} className="btn btn-sm btn-ghost text-red-500">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
          {products.length === 0 && <div className="empty-state"><p className="empty-title">No products found</p></div>}
          </Card>
        )}
      </div>

      {/* Add/Edit Product */}
      <Modal open={modalOpen} onClose={closeModal} title={isEditing ? `Edit: ${editProduct?.name}` : 'Add Product'} maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Product Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Americano" />
            <Input label="SKU" value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} placeholder="Optional" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Category" value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})}
              options={[{ value: '', label: 'Select category' }, ...categories.map(c => ({ value: c.id, label: c.name }))]} />
            <Input label="Price (IDR)" type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Recipe</label>
              <div className="flex gap-2">
                <button onClick={getRecommendation} className="text-xs text-purple-600 hover:text-purple-700 font-medium">💡 Price Recommendation</button>
                <button onClick={addRecipeItem} className="text-sm text-green-600 font-medium">+ Ingredient</button>
              </div>
            </div>
            {form.recipeItems.map((ri, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select value={ri.ingredientId}
                  onChange={e => { const items = [...form.recipeItems]; items[i].ingredientId = e.target.value; setForm({...form, recipeItems: items}); }}
                  className="select flex-1">
                  <option value="">Select ingredient</option>
                  {ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.type === 'PREPPED' ? '🔸 ' : ''}{ing.name} ({ing.unit})</option>)}
                </select>
                <input type="number" placeholder="Qty" value={ri.quantity}
                  onChange={e => { const items = [...form.recipeItems]; items[i].quantity = e.target.value; setForm({...form, recipeItems: items}); }}
                  className="input w-24" />
                <button onClick={() => setForm({...form, recipeItems: form.recipeItems.filter((_, idx) => idx !== i)})} className="p-2 text-red-400 hover:text-red-600">✕</button>
              </div>
            ))}
          </div>

          {priceRec && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-purple-800 mb-2">💡 Cost: {formatCurrency(priceRec.cost)} — Select target margin:</p>
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(priceRec.recommendations).map(([key, val]) => {
                  const label = key.replace('margin', '') + '%';
                  return (
                    <button key={key} onClick={() => setForm({...form, price: String(val)})}
                      className={clsx('py-2 rounded-xl text-sm font-bold border-2 transition-all',
                        form.price === String(val) ? 'border-purple-500 bg-purple-100 text-purple-700' : 'border-purple-200 text-purple-600 hover:border-purple-300')}>
                      <span className="block text-[10px] opacity-70">{label}</span>
                      {formatCurrency(val)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <Button onClick={handleSave} className="w-full">{isEditing ? 'Update Product' : 'Create Product'}</Button>
        </div>
      </Modal>

      <Modal open={showAddCat} onClose={() => setShowAddCat(false)} title="Add Category">
        <div className="space-y-4">
          <Input label="Category Name" value={catForm.name} onChange={e => setCatForm({...catForm, name: e.target.value})} />
          <div><label className="label">Color</label><input type="color" value={catForm.color} onChange={e => setCatForm({...catForm, color: e.target.value})} className="w-full h-10 rounded-xl cursor-pointer" /></div>
          <Button onClick={async () => { try { await api.post('/api/categories', catForm); setShowAddCat(false); setCatForm({ name: '', color: '#22c55e' }); load(); } catch (e) { console.error(e); } }} className="w-full">Create Category</Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}
