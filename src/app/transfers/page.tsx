'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, Button, formatNumber } from '@/components/ui';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Toolbar } from '@/components/ui/Toolbar';
import { api } from '@/lib/fetch';
import clsx from 'clsx';
import * as XLSX from 'xlsx';

interface Ingredient {
  id: string; name: string; unit: string; type: string;
  stockLevels: { location: string; quantity: number }[];
}
interface Movement {
  id: string; quantity: number; location: string; notes: string | null; createdAt: string;
  ingredient: { name: string; unit: string };
}

const LOCS: Record<string, string> = { GUDANG: 'Gudang', BAR: 'Bar', KITCHEN: 'Dapur' };
const LOC_KEYS = ['GUDANG', 'BAR', 'KITCHEN'] as const;
type Loc = typeof LOC_KEYS[number];

type BulkEntry = { ingredientId: string; qty: string };

export default function TransfersPage() {
  const [moves, setMoves]             = useState<Movement[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading]         = useState(true);
  const [mode, setMode]               = useState<'history' | 'bulk'>('history');
  const [fromLoc, setFromLoc]         = useState<Loc>('GUDANG');
  const [toLoc, setToLoc]             = useState<Loc>('BAR');
  const [entries, setEntries]         = useState<BulkEntry[]>([]);
  const [saving, setSaving]           = useState(false);
  const [search, setSearch]           = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, ings] = await Promise.all([
        api.get<any>('/api/transfers'),
        api.get<Ingredient[]>('/api/ingredients'),
      ]);
      setMoves(t.transfers || []);
      setIngredients(ings);
      // Init entries untuk semua ingredient
      setEntries(ings.map((i: Ingredient) => ({ ingredientId: i.id, qty: '' })));
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = ingredients.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase())
  );

  function setQty(ingredientId: string, qty: string) {
    setEntries(prev => prev.map(e => e.ingredientId === ingredientId ? { ...e, qty } : e));
  }

  function getQty(ingredientId: string) {
    return entries.find(e => e.ingredientId === ingredientId)?.qty ?? '';
  }

  function getStock(ing: Ingredient, loc: string) {
    return ing.stockLevels.find(s => s.location === loc)?.quantity ?? 0;
  }

  const filledEntries = entries.filter(e => parseFloat(e.qty) > 0);

  async function handleBulkTransfer() {
    if (fromLoc === toLoc) { alert('Lokasi asal dan tujuan tidak boleh sama'); return; }
    if (!filledEntries.length) { alert('Belum ada qty yang diisi'); return; }

    // Validasi stok
    const errors: string[] = [];
    for (const entry of filledEntries) {
      const ing = ingredients.find(i => i.id === entry.ingredientId);
      const stock = getStock(ing!, fromLoc);
      if (parseFloat(entry.qty) > stock) {
        errors.push(`${ing?.name}: stok ${LOCS[fromLoc]} hanya ${formatNumber(stock)} ${ing?.unit}`);
      }
    }
    if (errors.length) { alert(`Stok tidak cukup:\n${errors.join('\n')}`); return; }

    if (!confirm(`Transfer ${filledEntries.length} bahan dari ${LOCS[fromLoc]} → ${LOCS[toLoc]}?`)) return;

    setSaving(true);
    try {
      let ok = 0; const failed: string[] = [];
      for (const entry of filledEntries) {
        try {
          await api.post('/api/transfers', {
            ingredientId: entry.ingredientId,
            fromLocation: fromLoc,
            toLocation: toLoc,
            quantity: parseFloat(entry.qty),
          });
          ok++;
        } catch (e: any) {
          const ing = ingredients.find(i => i.id === entry.ingredientId);
          failed.push(`${ing?.name}: ${e?.message}`);
        }
      }
      // Reset qty
      setEntries(prev => prev.map(e => ({ ...e, qty: '' })));
      setSearch('');
      load();
      setMode('history');
      if (failed.length) alert(`${ok} berhasil.\n\nGagal:\n${failed.join('\n')}`);
      else alert(`✅ ${ok} bahan berhasil ditransfer ke ${LOCS[toLoc]}`);
    } catch (e: any) { alert(e?.message || 'Gagal'); }
    finally { setSaving(false); }
  }

  const columns: Column<Movement>[] = [
    {
      key: 'createdAt', label: 'Waktu', sortable: true,
      render: m => <span className="text-gray-500 text-sm">{new Date(m.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>,
    },
    {
      key: 'ingredient', label: 'Bahan', sortable: true,
      render: m => <span className="font-medium text-gray-900">{m.ingredient.name}</span>,
    },
    {
      key: 'location', label: 'Tujuan', width: 'w-24',
      render: m => <Badge variant="info">{LOCS[m.location] ?? m.location}</Badge>,
    },
    {
      key: 'quantity', label: 'Jumlah', sortable: true, width: 'w-32',
      render: m => <span className="font-medium text-brand-700">+{formatNumber(m.quantity)} {m.ingredient.unit}</span>,
    },
    {
      key: 'notes', label: 'Catatan',
      render: m => <span className="text-gray-400 text-sm">{m.notes || '—'}</span>,
    },
  ];

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Transfer Stok</h1>
            <p className="text-sm text-gray-500 mt-1">Pindahkan bahan antar lokasi</p>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-5">
          <button onClick={() => setMode('history')}
            className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium transition-all', mode === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            Riwayat
          </button>
          <button onClick={() => setMode('bulk')}
            className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium transition-all', mode === 'bulk' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            Transfer Sekaligus
          </button>
        </div>

        {mode === 'history' ? (
          <>
            <Toolbar
              onAdd={() => setMode('bulk')} addLabel="Transfer Baru"
              search={search} onSearch={setSearch} searchPlaceholder="Cari bahan..."
              onExport={() => {
                const rows = moves.map(m => ({ Waktu: new Date(m.createdAt).toLocaleString('id-ID'), Bahan: m.ingredient.name, Satuan: m.ingredient.unit, Tujuan: m.location, Jumlah: m.quantity, Catatan: m.notes || '' }));
                const ws = XLSX.utils.json_to_sheet(rows);
                const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Transfers');
                XLSX.writeFile(wb, 'transfers-soeka.xlsx');
              }}
            />
            <DataTable
              data={moves} columns={columns} keyField="id" loading={loading}
              emptyMessage="Belum ada riwayat transfer."
            />
          </>
        ) : (
          <div className="space-y-4">
            {/* From → To selector */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Arah Transfer</p>
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <label className="label text-xs">Dari</label>
                  <select value={fromLoc} onChange={e => setFromLoc(e.target.value as Loc)} className="select">
                    {LOC_KEYS.map(l => <option key={l} value={l}>{LOCS[l]}</option>)}
                  </select>
                </div>
                <div className="pt-5 text-gray-400">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </div>
                <div>
                  <label className="label text-xs">Ke</label>
                  <select value={toLoc} onChange={e => setToLoc(e.target.value as Loc)} className="select">
                    {LOC_KEYS.map(l => <option key={l} value={l}>{LOCS[l]}</option>)}
                  </select>
                </div>
                {fromLoc === toLoc && <p className="text-sm text-red-500 pt-5">Lokasi tidak boleh sama</p>}
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                placeholder="Cari bahan..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {/* Bulk entry table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                <p className="text-sm font-semibold text-gray-700">
                  {LOCS[fromLoc]} → {LOCS[toLoc]}
                </p>
                <p className="text-xs text-gray-400">{filledEntries.length} bahan diisi</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Bahan</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Stok {LOCS[fromLoc]}</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-36">Qty Transfer</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Stok {LOCS[toLoc]}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map(ing => {
                      const fromStock = getStock(ing, fromLoc);
                      const toStock   = getStock(ing, toLoc);
                      const qty       = parseFloat(getQty(ing.id)) || 0;
                      const overLimit = qty > fromStock;
                      const isFilled  = qty > 0;
                      return (
                        <tr key={ing.id} className={clsx('transition-colors', isFilled ? 'bg-brand-50/20' : 'hover:bg-gray-50/30')}>
                          <td className="px-4 py-3">
                            <p className={clsx('font-medium', isFilled ? 'text-gray-900' : 'text-gray-600')}>{ing.name}</p>
                            <p className="text-xs text-gray-400">{ing.unit}</p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={clsx('text-sm font-medium', fromStock === 0 ? 'text-red-400' : 'text-gray-700')}>
                              {formatNumber(fromStock)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number" min="0" step="0.1"
                              value={getQty(ing.id)}
                              placeholder="0"
                              onChange={e => setQty(ing.id, e.target.value)}
                              className={clsx(
                                'w-28 text-center border rounded-xl px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 transition-colors',
                                overLimit ? 'border-red-300 bg-red-50 text-red-700 focus:ring-red-500/20'
                                : isFilled ? 'border-brand-300 bg-brand-50 text-brand-700 focus:ring-brand-500/20'
                                : 'border-gray-200 bg-white text-gray-700 focus:ring-brand-500/20'
                              )}
                            />
                            {overLimit && <p className="text-xs text-red-500 mt-0.5">Melebihi stok</p>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm text-gray-500">{formatNumber(toStock)}</span>
                            {isFilled && !overLimit && (
                              <p className="text-xs text-brand-500">→ {formatNumber(toStock + qty)}</p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">Tidak ada bahan yang cocok</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center">
              <button onClick={() => { setMode('history'); setSearch(''); setEntries(ingredients.map(i => ({ ingredientId: i.id, qty: '' }))); }}
                className="text-sm text-gray-400 hover:text-gray-600">← Batal</button>
              <div className="flex items-center gap-3">
                {filledEntries.length > 0 && (
                  <p className="text-sm text-gray-500">{filledEntries.length} bahan akan ditransfer</p>
                )}
                <Button onClick={handleBulkTransfer} disabled={saving || fromLoc === toLoc || !filledEntries.length}>
                  {saving ? 'Memproses...' : `Transfer ${filledEntries.length > 0 ? filledEntries.length + ' Bahan' : ''}`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
