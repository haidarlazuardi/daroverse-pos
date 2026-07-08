'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, Button, formatNumber } from '@/components/ui';
import { api } from '@/lib/fetch';
import clsx from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpnameItem {
  id: string; ingredientId: string; systemQty: number; actualQty: number;
  difference: number; notes: string | null;
  ingredient: { name: string; unit: string };
}
interface Opname {
  id: string; status: 'DRAFT' | 'COMPLETED'; location: string; createdAt: string;
  items: OpnameItem[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSIONS = [
  {
    id: 'daily',
    label: 'Hitung Harian',
    sublabel: 'Sebelum buka — ±10 menit',
    description: 'Bahan yang cepat habis: kopi, susu, sirup. Hitung di Bar.',
    location: 'BAR',
    tier: '',
    icon: '☀️',
    color: 'amber',
  },
  {
    id: 'weekly',
    label: 'Hitung Mingguan',
    sublabel: 'Senin pagi — ±30 menit',
    description: 'Semua bahan di Bar dan Kitchen. Cek juga sisa stok Gudang.',
    location: 'GUDANG',
    tier: '',
    icon: '📋',
    color: 'blue',
  },
  {
    id: 'opening',
    label: 'Input Stok Awal',
    sublabel: 'Hanya sekali saat pertama pakai',
    description: 'Masukkan stok yang ada sekarang sebagai data awal sistem.',
    location: 'GUDANG',
    tier: '',
    icon: '🚀',
    color: 'green',
  },
] as const;

type SessionId = typeof SESSIONS[number]['id'];

const LOC_LABEL: Record<string, string> = { GUDANG: 'Gudang', BAR: 'Bar', KITCHEN: 'Dapur' };
const ALL_LOCS = ['GUDANG', 'BAR', 'KITCHEN'] as const;

// ─── Color helpers ────────────────────────────────────────────────────────────

const SESSION_STYLES: Record<string, { card: string; icon: string; btn: string }> = {
  amber: {
    card: 'border-amber-200 hover:border-amber-400 hover:bg-amber-50/40',
    icon: 'bg-amber-100 text-amber-700',
    btn:  'bg-amber-500 hover:bg-amber-600 text-white',
  },
  blue: {
    card: 'border-blue-200 hover:border-blue-400 hover:bg-blue-50/40',
    icon: 'bg-blue-100 text-blue-700',
    btn:  'bg-blue-500 hover:bg-blue-600 text-white',
  },
  green: {
    card: 'border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/40',
    icon: 'bg-emerald-100 text-emerald-700',
    btn:  'bg-emerald-500 hover:bg-emerald-600 text-white',
  },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StockOpnamePage() {
  const [activeOpname, setActiveOpname] = useState<Opname | null>(null);
  const [editItems, setEditItems]       = useState<OpnameItem[]>([]);
  const [viewMode, setViewMode]         = useState(false);
  const [history, setHistory]           = useState<Opname[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [creating, setCreating]         = useState<SessionId | null>(null);
  const [saving, setSaving]             = useState(false);
  const [activeLoc, setActiveLoc]       = useState<'GUDANG' | 'BAR' | 'KITCHEN'>('GUDANG');
  const [isOpeningStock, setIsOpeningStock] = useState(false);
  const [search, setSearch]             = useState('');

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try { setHistory(await api.get<Opname[]>('/api/stock-opname')); }
    catch { /* silent */ }
    finally { setLoadingHistory(false); }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ── Start a session ──────────────────────────────────────────────────────

  async function startSession(session: typeof SESSIONS[number]) {
    setCreating(session.id);
    try {
      if (session.id === 'opening') {
        // Opening stock: create opname for all 3 locations, merge items
        const opnames = await Promise.all(
          ALL_LOCS.map(loc => api.post<Opname>('/api/stock-opname', { action: 'create', location: loc }))
        );
        // Combine items from all 3, tag with location
        const allItems: OpnameItem[] = opnames.flatMap(o =>
          (o.items || []).map(item => ({ ...item, _location: o.location } as any))
        );
        // Use first opname as "primary" — we'll complete all 3
        setActiveOpname({ ...opnames[0], _allOpnames: opnames } as any);
        setEditItems(allItems);
        setIsOpeningStock(true);
        setActiveLoc('GUDANG');
      } else {
        const opname = await api.post<Opname>('/api/stock-opname', {
          action: 'create',
          location: session.location,
          tier: session.tier || undefined,
        });
        setActiveOpname(opname);
        setEditItems((opname as any).items || []);
        setIsOpeningStock(false);
        setActiveLoc(session.location as any);
      }
      setViewMode(false);
      setSearch('');
    } catch (e: any) { alert(e.message || 'Gagal memulai'); }
    finally { setCreating(null); }
  }

  function openHistory(o: Opname) {
    setActiveOpname(o); setEditItems(o.items || []);
    setViewMode(o.status === 'COMPLETED'); setIsOpeningStock(false);
    setActiveLoc(o.location as any); setSearch('');
  }

  function back() { setActiveOpname(null); setEditItems([]); setIsOpeningStock(false); loadHistory(); }

  function updateQty(itemId: string, value: string) {
    setEditItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, actualQty: parseFloat(value) || 0, difference: (parseFloat(value)||0) - i.systemQty } : i
    ));
  }

  async function saveDraft() {
    setSaving(true);
    try {
      await api.post('/api/stock-opname', { action: 'update', opnameId: activeOpname!.id, items: editItems.filter((i: any) => !i._location || i._location === activeOpname!.location) });
    } catch (e: any) { alert(e.message || 'Gagal'); }
    finally { setSaving(false); }
  }

  async function complete() {
    const diffCount = editItems.filter(i => i.difference !== 0).length;
    const msg = diffCount > 0
      ? `Ada ${diffCount} bahan yang jumlahnya beda dari sistem. Stok akan disesuaikan ke hitungan kamu. Lanjut?`
      : 'Semua cocok! Selesaikan opname ini?';
    if (!confirm(msg)) return;

    setSaving(true);
    try {
      if (isOpeningStock) {
        // Complete all 3 opnames
        const allOpnames: Opname[] = (activeOpname as any)._allOpnames || [activeOpname];
        for (const o of allOpnames) {
          const locItems = editItems.filter((i: any) => i._location === o.location);
          if (locItems.length) await api.post('/api/stock-opname', { action: 'update', opnameId: o.id, items: locItems });
          await api.post('/api/stock-opname', { action: 'complete', opnameId: o.id });
        }
        alert('✅ Stok awal berhasil disimpan! Sistem siap dipakai.');
      } else {
        await api.post('/api/stock-opname', { action: 'update', opnameId: activeOpname!.id, items: editItems });
        const result = await api.post<any>('/api/stock-opname', { action: 'complete', opnameId: activeOpname!.id });
        if (result.adjustments > 0) alert(`✅ Selesai! ${result.adjustments} bahan disesuaikan.`);
        else alert('✅ Selesai! Semua stok sudah cocok.');
      }
      back();
    } catch (e: any) { alert(e.message || 'Gagal menyelesaikan'); }
    finally { setSaving(false); }
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const displayItems = isOpeningStock
    ? editItems.filter((i: any) => i._location === activeLoc)
    : editItems;

  const filteredItems = displayItems.filter(i =>
    !search || i.ingredient.name.toLowerCase().includes(search.toLowerCase())
  );

  const diffCount   = editItems.filter(i => i.difference !== 0).length;
  const filledCount = editItems.filter(i => i.actualQty > 0).length;
  const totalItems  = editItems.length;

  const lastOpnames = history.slice(0, 5);

  // ── Render: Home screen ──────────────────────────────────────────────────

  if (!activeOpname) return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-gray-900">Stock Opname</h1>
          <p className="text-sm text-gray-500 mt-1">Pilih jenis hitungan yang mau dilakukan</p>
        </div>

        {/* Session cards */}
        <div className="space-y-3 mb-10">
          {SESSIONS.map(session => {
            const styles = SESSION_STYLES[session.color];
            const isLoading = creating === session.id;
            return (
              <div key={session.id} className={clsx('bg-white border-2 rounded-2xl p-5 transition-all', styles.card)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0', styles.icon)}>
                      {session.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{session.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{session.sublabel}</p>
                      <p className="text-sm text-gray-600 mt-2">{session.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => startSession(session)}
                    disabled={!!creating}
                    className={clsx('flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50', styles.btn)}
                  >
                    {isLoading ? 'Memuat...' : 'Mulai'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* History */}
        {lastOpnames.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Riwayat Terakhir</p>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {lastOpnames.map((o, idx) => {
                const diffs = (o.items||[]).filter(i => i.difference !== 0).length;
                return (
                  <button key={o.id} onClick={() => openHistory(o)}
                    className={clsx('w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left', idx > 0 && 'border-t border-gray-100')}>
                    <div className="flex items-center gap-3">
                      <Badge variant="info">{LOC_LABEL[o.location]}</Badge>
                      <span className="text-sm text-gray-600">
                        {new Date(o.createdAt).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {diffs > 0
                        ? <Badge variant="warning">{diffs} selisih</Badge>
                        : <Badge variant="success">Cocok semua</Badge>
                      }
                      <Badge variant={o.status === 'COMPLETED' ? 'success' : 'warning'}>
                        {o.status === 'COMPLETED' ? 'Selesai' : 'Draft'}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!loadingHistory && lastOpnames.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-sm">Belum pernah opname.</p>
            <p className="text-sm">Kalau baru mulai, pilih <strong>Input Stok Awal</strong> dulu.</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );

  // ── Render: Count screen ─────────────────────────────────────────────────

  const progress = totalItems > 0 ? Math.round(filledCount / totalItems * 100) : 0;

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-5">
          <button onClick={back} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-3 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Kembali
          </button>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {viewMode ? 'Hasil Opname' : isOpeningStock ? '🚀 Input Stok Awal' : '✏️ Hitung Stok'}
                {!isOpeningStock && <span className="ml-2 text-gray-400 font-normal">— {LOC_LABEL[activeOpname.location]}</span>}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {new Date(activeOpname.createdAt).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}
              </p>
            </div>
            {!viewMode && (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={saveDraft} disabled={saving}>Simpan Draft</Button>
                <Button size="sm" onClick={complete} disabled={saving}>
                  {saving ? 'Memproses...' : '✅ Selesaikan'}
                </Button>
              </div>
            )}
          </div>

          {/* Progress bar (only in edit mode) */}
          {!viewMode && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                <span>{filledCount} dari {totalItems} bahan sudah diisi</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-brand-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Diff summary */}
          {viewMode && diffCount > 0 && (
            <div className="mt-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
              ⚠️ {diffCount} bahan ditemukan selisih — stok sudah disesuaikan.
            </div>
          )}
          {viewMode && diffCount === 0 && (
            <div className="mt-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
              ✅ Semua stok cocok dengan sistem.
            </div>
          )}
        </div>

        {/* Location tabs (opening stock only) */}
        {isOpeningStock && (
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-4">
            {ALL_LOCS.map(loc => {
              const locItems = editItems.filter((i: any) => i._location === loc);
              const filled   = locItems.filter(i => i.actualQty > 0).length;
              return (
                <button key={loc} onClick={() => setActiveLoc(loc)}
                  className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                    activeLoc === loc ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                  {LOC_LABEL[loc]}
                  {filled > 0 && <span className="ml-1.5 text-xs text-brand-500 font-semibold">{filled}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
            placeholder="Cari bahan..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <div className="col-span-5">Bahan</div>
            <div className="col-span-2 text-right">{viewMode ? 'Sistem' : 'Sistem'}</div>
            <div className="col-span-3 text-center">{viewMode ? 'Aktual' : 'Hitungan kamu'}</div>
            <div className="col-span-2 text-right">Selisih</div>
          </div>

          <div className="divide-y divide-gray-100">
            {filteredItems.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-gray-400">Tidak ada bahan yang cocok</div>
            )}
            {filteredItems.map(item => {
              const diff   = item.actualQty - item.systemQty;
              const isFilled = item.actualQty > 0;
              return (
                <div key={item.id} className={clsx(
                  'grid grid-cols-12 gap-2 px-4 py-3 items-center transition-colors',
                  diff !== 0 && !viewMode ? 'bg-amber-50/40' : '',
                  diff > 0 && viewMode ? 'bg-emerald-50/40' : '',
                  diff < 0 && viewMode ? 'bg-red-50/40' : '',
                )}>
                  <div className="col-span-5">
                    <p className={clsx('text-sm font-medium', isFilled ? 'text-gray-900' : 'text-gray-600')}>{item.ingredient.name}</p>
                    <p className="text-xs text-gray-400">{item.ingredient.unit}</p>
                  </div>
                  <div className="col-span-2 text-right text-sm text-gray-400">{formatNumber(item.systemQty)}</div>
                  <div className="col-span-3 flex justify-center">
                    {viewMode ? (
                      <span className="font-bold text-gray-900">{formatNumber(item.actualQty)}</span>
                    ) : (
                      <input
                        type="number" min="0" step="0.1"
                        value={item.actualQty === 0 && !isFilled ? '' : item.actualQty}
                        placeholder={String(item.systemQty)}
                        onChange={e => updateQty(item.id, e.target.value)}
                        className={clsx(
                          'w-28 text-center border rounded-xl px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors',
                          isFilled && diff !== 0 ? 'border-amber-300 bg-amber-50 text-amber-800'
                          : isFilled ? 'border-brand-300 bg-brand-50 text-brand-700'
                          : 'border-gray-200 bg-white text-gray-700'
                        )}
                      />
                    )}
                  </div>
                  <div className={clsx('col-span-2 text-right text-sm font-bold', diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-gray-300')}>
                    {diff !== 0 ? (diff > 0 ? '+' : '') + formatNumber(diff) : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom action (mobile-friendly) */}
        {!viewMode && (
          <div className="mt-4 flex justify-between items-center gap-3">
            <p className="text-sm text-gray-400">{diffCount > 0 ? `${diffCount} bahan akan disesuaikan` : 'Semua cocok sejauh ini'}</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={saveDraft} disabled={saving}>Simpan Draft</Button>
              <Button onClick={complete} disabled={saving}>{saving ? 'Memproses...' : '✅ Selesaikan'}</Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
