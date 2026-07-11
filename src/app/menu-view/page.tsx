'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, formatCurrency } from '@/components/ui';
import { api } from '@/lib/fetch';

export default function MenuViewPage() {
  const [products, setProducts]   = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selectedCat, setSelectedCat] = useState('');
  const [search, setSearch]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        api.get<any[]>('/api/products'),
        api.get<any[]>('/api/categories'),
      ]);
      setProducts(p.filter((x: any) => x.active));
      setCategories(c);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = products.filter(p =>
    (!selectedCat || p.categoryId === selectedCat) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()))
  );
  const byCategory = categories
    .map(cat => ({ ...cat, items: filtered.filter(p => p.categoryId === cat.id) }))
    .filter(cat => cat.items.length > 0);

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto">
        <div className="page-header">
          <div>
            <h1 className="page-title">Menu & Resep</h1>
            <p className="page-subtitle">Referensi menu dan bahan untuk dapur</p>
          </div>
          <span className="badge badge-default">{products.length} aktif</span>
        </div>

        {/* Filter */}
        <div className="flex gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-3)' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input className="input pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari menu..." />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setSelectedCat('')}
              className="px-3 py-1.5 text-sm rounded-lg font-medium transition-all border"
              style={!selectedCat ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } : { borderColor: 'var(--border-md)', color: 'var(--text-2)' }}>
              Semua
            </button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setSelectedCat(cat.id === selectedCat ? '' : cat.id)}
                className="px-3 py-1.5 text-sm rounded-lg font-medium transition-all border"
                style={selectedCat === cat.id ? { background: cat.color, color: '#fff', borderColor: cat.color } : { borderColor: 'var(--border-md)', color: 'var(--text-2)' }}>
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} /></div>
        ) : byCategory.length === 0 ? (
          <div className="empty-state"><p className="empty-title">Tidak ada menu</p></div>
        ) : (
          <div className="space-y-6">
            {byCategory.map(cat => (
              <div key={cat.id}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: cat.color }} />
                  <h2 className="font-bold" style={{ color: 'var(--text-1)' }}>{cat.name}</h2>
                  <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>{cat.items.length} menu</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {cat.items.map((p: any) => (
                    <div key={p.id} className="card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold" style={{ color: 'var(--text-1)' }}>{p.name}</p>
                          {p.sku && <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>SKU: {p.sku}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold" style={{ color: 'var(--brand)' }}>{formatCurrency(p.price)}</p>
                          <span className="badge badge-default mt-1">{p.station === 'FOOD' ? '🍳 Dapur' : '☕ Bar'}</span>
                        </div>
                      </div>
                      {p.recipe?.items?.length > 0 && (
                        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                          <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-3)' }}>Bahan:</p>
                          <div className="space-y-0.5">
                            {p.recipe.items.map((ri: any, i: number) => (
                              <p key={i} className="text-xs" style={{ color: 'var(--text-2)' }}>
                                • {ri.ingredient?.name} — {ri.quantity} {ri.ingredient?.unit}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                      {p.modifierGroups?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {p.modifierGroups.map((mg: any) => (
                            <span key={mg.id} className="badge badge-default text-xs">{mg.name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
