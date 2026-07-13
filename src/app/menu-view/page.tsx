'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { formatCurrency } from '@/components/ui';
import { SlideOver } from '@/components/ui/SlideOver';
import { api } from '@/lib/fetch';

export default function MenuViewPage() {
  const [products, setProducts]     = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selectedCat, setSelectedCat] = useState('');
  const [search, setSearch]         = useState('');
  const [viewed, setViewed]         = useState<any | null>(null);

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
            <p className="page-subtitle">Klik menu untuk lihat resep & cara pembuatan</p>
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
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
          </div>
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
                  {cat.items.map((p: any) => {
                    const inst = p.instructions as any;
                    const meta = inst?.meta || {};
                    const steps: any[] = inst?.steps || [];
                    const hasDetail = steps.length > 0 || Object.values(meta).some(Boolean);
                    return (
                      <button key={p.id} onClick={() => setViewed(p)}
                        className="card p-4 text-left hover:shadow-md transition-shadow w-full">
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

                        {/* Bahan preview */}
                        {p.recipe?.items?.length > 0 && (
                          <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                            <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-3)' }}>
                              Bahan ({p.recipe.items.length}):
                            </p>
                            <div className="space-y-0.5">
                              {p.recipe.items.slice(0, 4).map((ri: any, i: number) => (
                                <p key={i} className="text-xs" style={{ color: 'var(--text-2)' }}>
                                  • {ri.ingredient?.name} — {ri.quantity} {ri.ingredient?.unit}
                                </p>
                              ))}
                              {p.recipe.items.length > 4 && (
                                <p className="text-xs" style={{ color: 'var(--text-3)' }}>+{p.recipe.items.length - 4} bahan lagi...</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Cara pembuatan hint */}
                        {hasDetail && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--brand)' }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            <span className="text-xs font-medium" style={{ color: 'var(--brand)' }}>
                              {steps.length > 0 ? `${steps.length} langkah cara pembuatan` : 'Lihat detail standar produksi'}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail SlideOver */}
      {viewed && (() => {
        const inst = viewed.instructions as any;
        const meta = inst?.meta || {};
        const steps: any[] = inst?.steps || [];
        return (
          <SlideOver open={!!viewed} onClose={() => setViewed(null)} title={viewed.name}
            footer={<button onClick={() => setViewed(null)} className="btn btn-secondary btn-md w-full">Tutup</button>}>
            <div className="space-y-5">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Harga Jual', value: formatCurrency(viewed.price) },
                  { label: 'Station', value: viewed.station === 'FOOD' ? '🍳 Dapur' : '☕ Bar' },
                  { label: 'SKU', value: viewed.sku || '—' },
                  { label: 'Kategori', value: viewed.category?.name || '—' },
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
                      { label: 'Tipe Produk',       value: meta.productType },
                      { label: 'Kemasan',            value: meta.packaging },
                      { label: 'Umur Simpan',        value: meta.shelfLife },
                      { label: 'Syarat Mutu',        value: meta.qualityStandard },
                      { label: 'Saran Penyajian',    value: meta.servingSuggestion },
                      { label: 'Alat Penyajian',     value: meta.servingTools },
                      { label: 'Alat Produksi',      value: meta.productionTools },
                    ].filter(i => i.value).map(({ label, value }) => (
                      <div key={label} className="flex gap-3 p-2.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                        <span className="text-xs font-semibold w-32 flex-shrink-0 pt-0.5" style={{ color: 'var(--text-3)' }}>{label}</span>
                        <span className="text-sm" style={{ color: 'var(--text-1)' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resep */}
              {viewed.recipe?.items?.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>
                    Resep ({viewed.recipe.items.length} bahan)
                  </p>
                  <div className="space-y-1.5">
                    {viewed.recipe.items.map((ri: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: 'var(--brand)' }}>{i + 1}</span>
                          <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{ri.ingredient?.name}</span>
                        </div>
                        <span className="text-sm font-bold" style={{ color: 'var(--text-2)' }}>
                          {ri.quantity} {ri.ingredient?.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cara pembuatan */}
              {steps.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>
                    Cara Pembuatan ({steps.length} langkah)
                  </p>
                  <div className="space-y-2">
                    {steps.map((step: any, i: number) => (
                      <div key={i} className="flex gap-3 p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                          style={{ background: 'var(--brand)' }}>{i + 1}</div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{step.title}</p>
                          {step.description && (
                            <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>{step.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modifier groups */}
              {viewed.modifierGroups?.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Modifier</p>
                  <div className="flex flex-wrap gap-1.5">
                    {viewed.modifierGroups.map((mg: any) => (
                      <span key={mg.id} className="px-2.5 py-1 rounded-full text-xs font-medium border" style={{ borderColor: 'var(--border-md)', color: 'var(--text-2)' }}>{mg.name}</span>
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
