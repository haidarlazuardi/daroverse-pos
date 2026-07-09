'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, formatCurrency, formatNumber } from '@/components/ui';
import { Toolbar } from '@/components/ui/Toolbar';
import { api } from '@/lib/fetch';
import clsx from 'clsx';

interface Ingredient {
  id: string; name: string; type: string;
  unit: string; purchaseUnit: string | null; conversionRate: number | null;
  latestPrice: number; minStock: number; active: boolean;
}

// ── Kategori grouping manual ──────────────────────────────────────────────────
const CATEGORY_GROUPS: { label: string; keywords: string[] }[] = [
  {
    label: '🥛 Dairy, Base & Minuman',
    keywords: ['susu','creamer','evaporasi','skm','freshmilk','oat milk','mineral','galon','air'],
  },
  {
    label: '☕ Kopi & Teh',
    keywords: ['beans','kopi','house blend','anaerobic','idjen','specialty','teh','coldbrew','espresso'],
  },
  {
    label: '🍯 Sirup, Flavour & Powder',
    keywords: ['flavour','sirup','gula','liquid aren','simple syrup','dark choco','matcha','vanila','caramel','pandan','strawberry','butterscotch','mint','peach','fruity','tiramisu','baileys','berry juice','orange juice','soda','tonic','baking soda'],
  },
  {
    label: '🥩 Protein',
    keywords: ['ayam','daging','sayap','kulit','paha','telur','bacon','beef'],
  },
  {
    label: '🥬 Sayur & Buah',
    keywords: ['nanas','kentang','pisang','lettuce','selada','bawang','cabai','hijau','lengkuas','daun jeruk'],
  },
  {
    label: '🧂 Bumbu & Seasoning',
    keywords: ['sea salt','cajun','smoke powder','cayenne','penyedap','margarin','minyak','kecap','saus','mayonaise','tiram','bbq','maizena','terigu','tepung'],
  },
  {
    label: '🍞 Dry Goods & Packaging',
    keywords: ['beras','burger bun','red cheddar','cheddar'],
  },
];

function categorize(ing: Ingredient): string {
  const lower = ing.name.toLowerCase();
  for (const group of CATEGORY_GROUPS) {
    if (group.keywords.some(kw => lower.includes(kw))) return group.label;
  }
  return '📦 Lainnya';
}

function getHargaBeli(ing: Ingredient): number {
  return (ing.latestPrice || 0) * (ing.conversionRate || 1);
}

function getIsiPerSatuanBeli(ing: Ingredient): string {
  if (!ing.conversionRate) return '—';
  return `${formatNumber(ing.conversionRate)} ${ing.unit}`;
}

export default function BahanBakuPage() {
  const [data, setData]       = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Ingredient[]>('/api/ingredients');
      setData(res.filter(i => i.type === 'RAW' && i.active));
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = search
    ? data.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : data;

  // Group by category
  const grouped = new Map<string, Ingredient[]>();
  for (const ing of filtered) {
    const cat = categorize(ing);
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(ing);
  }
  // Sort groups by CATEGORY_GROUPS order
  const sortedGroups = Array.from(grouped.entries()).sort((a, b) => {
    const ai = CATEGORY_GROUPS.findIndex(g => g.label === a[0]);
    const bi = CATEGORY_GROUPS.findIndex(g => g.label === b[0]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <div className="page-header">
          <div>
            <h1 className="page-title">Bahan Baku</h1>
            <p className="page-subtitle">Daftar harga & satuan semua bahan baku RAW</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-default">{data.length} bahan aktif</span>
          </div>
        </div>

        <Toolbar search={search} onSearch={setSearch} searchPlaceholder="Cari bahan..." />

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sortedGroups.length === 0 ? (
          <div className="empty-state"><p className="empty-title">Tidak ada bahan ditemukan</p></div>
        ) : (
          <div className="space-y-6">
            {sortedGroups.map(([category, items]) => (
              <div key={category}>
                {/* Category header */}
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-sm font-bold text-gray-700">{category}</h2>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">{items.length} bahan</span>
                </div>

                {/* Table */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Nama Bahan
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                            Satuan Beli
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">
                            Isi per Satuan
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Harga Beli
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Harga / {' '}
                            <span className="normal-case font-normal">satuan pakai</span>
                          </th>
                          <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                            Satuan
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {items.map(ing => {
                          const hargaBeli = getHargaBeli(ing);
                          const isiPerSatuan = getIsiPerSatuanBeli(ing);
                          const hargaPerUnit = ing.latestPrice || 0;
                          return (
                            <tr key={ing.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-4 py-3">
                                <span className="font-medium text-gray-900">{ing.name}</span>
                              </td>
                              <td className="px-4 py-3 hidden sm:table-cell">
                                <span className="text-gray-500">
                                  {ing.purchaseUnit || '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right hidden md:table-cell">
                                <span className="text-gray-500 text-xs font-mono">
                                  {isiPerSatuan}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="font-semibold text-gray-900">
                                  {formatCurrency(hargaBeli)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-brand-700 font-semibold text-xs">
                                  {formatCurrency(hargaPerUnit)}
                                  <span className="text-gray-400 font-normal">/{ing.unit}</span>
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center hidden sm:table-cell">
                                <span className="badge badge-default">{ing.unit}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {/* Category subtotal */}
                      <tfoot>
                        <tr className="bg-gray-50 border-t border-gray-200">
                          <td colSpan={3} className="px-4 py-2 text-xs text-gray-400">
                            {items.length} bahan
                          </td>
                          <td className="px-4 py-2 text-right text-xs font-bold text-gray-600">
                            {/* Total nilai stok jika ada */}
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
