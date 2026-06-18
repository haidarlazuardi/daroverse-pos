'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store';
import { api } from '@/lib/fetch';
import { formatCurrency } from '@/components/ui';

interface StockLevel { location: 'GUDANG' | 'BAR' | 'KITCHEN'; quantity: number }
interface Ingredient {
  id: string; name: string; unit: string; type: 'RAW' | 'PREPPED';
  defaultLocation: 'GUDANG' | 'BAR' | 'KITCHEN' | null; minStock: number; stockLevels: StockLevel[];
}
type Mode = 'home' | 'batch' | 'take' | 'check' | 'waste' | 'receive' | 'opname' | 'menu' | 'expense';

const LOC_LABEL: Record<string, string> = { GUDANG: 'Gudang', BAR: 'Bar', KITCHEN: 'Dapur' };

export default function StaffPage() {
  const router = useRouter();
  const { user, hydrate, logout } = useAuthStore();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<Mode>('home');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const isAdmin = user?.role === 'SUPER_ADMIN';
  const can = (f: string) => isAdmin || !!perms[f];

  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => {
    if (!user) { const t = setTimeout(() => { if (!useAuthStore.getState().user) router.replace('/login'); }, 500); return () => clearTimeout(t); }
  }, [user, router]);

  const load = useCallback(async () => {
    try {
      const [ings, p] = await Promise.all([
        api.get<Ingredient[]>('/api/ingredients'),
        api.get<any>('/api/permissions').catch(() => ({ permissions: {} })),
      ]);
      setIngredients(ings); setPerms(p.permissions || {});
    } catch (e) { console.error(e); }
  }, []);
  useEffect(() => { if (user) load(); }, [user, load]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };
  const stockAt = (ing: Ingredient, loc: string) => ing.stockLevels.find((s) => s.location === loc)?.quantity ?? 0;
  const prepped = ingredients.filter((i) => i.type === 'PREPPED');
  const needBatch = ingredients.filter((i) => i.type === 'PREPPED' && i.minStock > 0 && (stockAt(i, 'BAR') + stockAt(i, 'KITCHEN')) <= i.minStock);
  const needRestock = ingredients.filter((i) => i.type === 'RAW' && i.minStock > 0 && stockAt(i, 'GUDANG') <= i.minStock);

  if (!user) return null;

  const TITLES: Record<Mode, string> = { home: `Halo, ${user.name}`, batch: 'Bikin batch', take: 'Ambil bahan', check: 'Cek stok', waste: 'Buang', receive: 'Terima barang', opname: 'Stock opname', menu: 'Lihat menu', expense: 'Catat pengeluaran' };

  const tiles: { mode: Mode; perm: string; color: string; label: string; desc: string; icon: string }[] = [
    { mode: 'batch', perm: 'batch', color: '#3B6D11', label: 'Bikin batch', desc: 'Racik stok olahan', icon: 'M12 8a4 4 0 100 8 4 4 0 000-8z' },
    { mode: 'take', perm: 'transfer', color: '#1D6F99', label: 'Ambil bahan', desc: 'Gudang → Bar/Dapur', icon: 'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4' },
    { mode: 'check', perm: 'check_stock', color: '#8A6D1D', label: 'Cek stok', desc: 'Sisa per tempat', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2' },
    { mode: 'waste', perm: 'waste', color: '#993C1D', label: 'Buang', desc: 'Catat bahan rusak', icon: 'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2' },
    { mode: 'receive', perm: 'receive_po', color: '#4B3D99', label: 'Terima barang', desc: 'Barang dari supplier', icon: 'M20 8v6M23 11h-6M9 12a4 4 0 100-8 4 4 0 000 8zM1 20v-1a4 4 0 014-4h4a4 4 0 014 4v1' },
    { mode: 'opname', perm: 'opname_input', color: '#0E7C6B', label: 'Opname', desc: 'Hitung stok fisik', icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11' },
    { mode: 'menu', perm: 'view_menu', color: '#555', label: 'Lihat menu', desc: 'Daftar & resep', icon: 'M4 6h16M4 12h16M4 18h7' },
    { mode: 'expense', perm: 'expense', color: '#B45309', label: 'Pengeluaran', desc: 'Belanja kecil', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6' },
  ];
  const visible = tiles.filter((t) => can(t.perm));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {mode !== 'home' && (
            <button onClick={() => setMode('home')} className="btn btn-sm btn-ghost">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
          )}
          <h1 className="font-bold text-gray-900">{TITLES[mode]}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/pos')} className="btn btn-sm btn-ghost">Kasir</button>
          {isAdmin && <button onClick={() => router.push('/dashboard')} className="btn btn-sm btn-ghost">Admin</button>}
          <button onClick={() => { logout(); router.replace('/login'); }} className="btn btn-sm btn-ghost text-gray-400">Keluar</button>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-2xl w-full mx-auto">
        {mode === 'home' && (needBatch.length > 0 || needRestock.length > 0) && (
          <div className="mb-4 space-y-2">
            {needBatch.length > 0 && can('batch') && (
              <button onClick={() => setMode('batch')} className="w-full text-left bg-amber-50 border border-amber-200 rounded-xl p-3 active:scale-[0.99] transition-transform">
                <p className="text-sm font-semibold text-amber-800">Perlu dibikin ({needBatch.length})</p>
                <p className="text-xs text-amber-700 mt-0.5">{needBatch.slice(0, 4).map((i) => i.name).join(', ')}{needBatch.length > 4 ? ', dst' : ''}</p>
              </button>
            )}
            {needRestock.length > 0 && (
              <div className="w-full bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm font-semibold text-red-700">Stok menipis ({needRestock.length})</p>
                <p className="text-xs text-red-600 mt-0.5">{needRestock.slice(0, 4).map((i) => i.name).join(', ')}{needRestock.length > 4 ? ', dst' : ''} — kabari admin</p>
              </div>
            )}
          </div>
        )}

        {mode === 'home' && (
          visible.length === 0 ? (
            <p className="text-center text-gray-400 mt-8">Belum ada fitur yang diaktifkan untuk akunmu. Minta admin membuka di Hak Akses.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 mt-2">
              {visible.map((t) => (
                <button key={t.mode} onClick={() => setMode(t.mode)} className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col items-center justify-center gap-2 aspect-square active:scale-95 transition-transform hover:border-gray-300">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: t.color + '18', color: t.color }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon} /></svg>
                  </div>
                  <span className="font-bold text-gray-900 text-lg">{t.label}</span>
                  <span className="text-xs text-gray-400 text-center">{t.desc}</span>
                </button>
              ))}
            </div>
          )
        )}

        {mode === 'batch' && <BatchForm prepped={prepped} busy={busy} setBusy={setBusy} onDone={(m) => { flash(m); load(); setMode('home'); }} />}
        {mode === 'take' && <TakeForm ingredients={ingredients} busy={busy} setBusy={setBusy} stockAt={stockAt} onDone={(m) => { flash(m); load(); setMode('home'); }} />}
        {mode === 'check' && <CheckStock ingredients={ingredients} stockAt={stockAt} />}
        {mode === 'waste' && <WasteForm ingredients={ingredients} busy={busy} setBusy={setBusy} stockAt={stockAt} onDone={(m) => { flash(m); load(); setMode('home'); }} />}
        {mode === 'receive' && <ReceivePO busy={busy} setBusy={setBusy} onDone={(m) => { flash(m); load(); }} />}
        {mode === 'opname' && <Opname canApply={can('opname_apply')} busy={busy} setBusy={setBusy} onDone={(m) => { flash(m); load(); }} />}
        {mode === 'menu' && <MenuView />}
        {mode === 'expense' && <ExpenseForm busy={busy} setBusy={setBusy} onDone={(m) => { flash(m); setMode('home'); }} />}
      </main>

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium z-50">{toast}</div>}
    </div>
  );
}

function Picker<T extends { id: string; name: string }>({ items, value, onChange, placeholder }: { items: T[]; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="select text-base py-3">
      <option value="">{placeholder}</option>
      {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
    </select>
  );
}
const LocPick = ({ value, set, locs }: { value: string; set: (v: any) => void; locs: ('GUDANG' | 'BAR' | 'KITCHEN')[] }) => (
  <div className="flex gap-2">{locs.map((l) => <button key={l} onClick={() => set(l)} className={`flex-1 py-2.5 rounded-xl border text-sm font-medium ${value === l ? 'bg-green-50 border-green-500 text-green-700' : 'border-gray-200 text-gray-600'}`}>{LOC_LABEL[l]}</button>)}</div>
);

function BatchForm({ prepped, busy, setBusy, onDone }: any) {
  const [ingredientId, setId] = useState(''); const [mult, setMult] = useState('1'); const [loc, setLoc] = useState('BAR');
  const submit = async () => { if (!ingredientId) return; setBusy(true); try { await api.post('/api/production', { ingredientId, batchMultiplier: parseFloat(mult) || 1, location: loc, execute: true }); onDone('Batch berhasil dibuat ✓'); } catch (e: any) { alert(e.message || 'Gagal'); } finally { setBusy(false); } };
  return (
    <div className="space-y-4 mt-2">
      <p className="text-sm text-gray-500">Pilih olahan yang mau diracik. Bahan mentahnya otomatis kepotong.</p>
      <div><label className="label">Mau bikin apa?</label><Picker items={prepped} value={ingredientId} onChange={setId} placeholder="Pilih olahan" /></div>
      <div><label className="label">Berapa batch?</label><input type="number" min="0.5" step="0.5" value={mult} onChange={(e) => setMult(e.target.value)} className="input text-base py-3" /></div>
      <div><label className="label">Dibuat di mana?</label><LocPick value={loc} set={setLoc} locs={['BAR', 'KITCHEN']} /></div>
      <button onClick={submit} disabled={busy || !ingredientId} className="btn btn-lg btn-primary w-full">{busy ? 'Memproses...' : 'Bikin sekarang'}</button>
    </div>
  );
}

function TakeForm({ ingredients, busy, setBusy, onDone, stockAt }: any) {
  const [ingredientId, setId] = useState(''); const [qty, setQty] = useState(''); const [loc, setLoc] = useState('BAR');
  const fromGudang = ingredients.filter((i: Ingredient) => stockAt(i, 'GUDANG') > 0);
  const sel = ingredients.find((i: Ingredient) => i.id === ingredientId);
  const submit = async () => { if (!ingredientId || !qty) return; setBusy(true); try { await api.post('/api/transfers', { ingredientId, toLocation: loc, quantity: parseFloat(qty) }); onDone('Bahan dipindah ✓'); } catch (e: any) { alert(e.message || 'Gagal'); } finally { setBusy(false); } };
  return (
    <div className="space-y-4 mt-2">
      <p className="text-sm text-gray-500">Pindahkan bahan dari gudang ke bar atau dapur.</p>
      <div><label className="label">Bahan</label><Picker items={fromGudang} value={ingredientId} onChange={setId} placeholder="Pilih bahan" />{sel && <p className="text-xs text-gray-400 mt-1">Sisa gudang: {stockAt(sel, 'GUDANG')} {sel.unit}</p>}</div>
      <div><label className="label">Jumlah {sel ? `(${sel.unit})` : ''}</label><input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="input text-base py-3" /></div>
      <div><label className="label">Ke mana?</label><LocPick value={loc} set={setLoc} locs={['BAR', 'KITCHEN']} /></div>
      <button onClick={submit} disabled={busy || !ingredientId || !qty} className="btn btn-lg btn-primary w-full">{busy ? 'Memproses...' : 'Ambil sekarang'}</button>
    </div>
  );
}

function CheckStock({ ingredients, stockAt }: any) {
  const [q, setQ] = useState('');
  const list = ingredients.filter((i: Ingredient) => i.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3 mt-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari bahan..." className="input text-base py-3" />
      <div className="space-y-2">
        {list.map((i: Ingredient) => (
          <div key={i.id} className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="flex justify-between items-center"><span className="font-medium text-gray-900">{i.name}</span><span className="text-xs text-gray-400">{i.type === 'PREPPED' ? 'olahan' : 'mentah'}</span></div>
            <div className="flex gap-3 mt-2 text-sm">
              {(['GUDANG', 'BAR', 'KITCHEN'] as const).map((l) => (
                <div key={l} className="flex-1 text-center bg-gray-50 rounded-lg py-1.5"><p className="text-[11px] text-gray-400">{LOC_LABEL[l]}</p><p className="font-bold text-gray-800">{stockAt(i, l)}<span className="text-[11px] font-normal text-gray-400"> {i.unit}</span></p></div>
              ))}
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="text-center text-gray-400 py-6">Tidak ada bahan</p>}
      </div>
    </div>
  );
}

function WasteForm({ ingredients, busy, setBusy, onDone, stockAt }: any) {
  const [ingredientId, setId] = useState(''); const [loc, setLoc] = useState('BAR'); const [qty, setQty] = useState(''); const [notes, setNotes] = useState('');
  const sel = ingredients.find((i: Ingredient) => i.id === ingredientId);
  const submit = async () => { if (!ingredientId || !qty) return; setBusy(true); try { await api.post('/api/stock-movements', { location: loc, ingredientId, type: 'WASTE', quantity: parseFloat(qty), notes }); onDone('Pembuangan dicatat ✓'); } catch (e: any) { alert(e.message || 'Gagal'); } finally { setBusy(false); } };
  return (
    <div className="space-y-4 mt-2">
      <p className="text-sm text-gray-500">Catat bahan yang rusak / tumpah / kedaluwarsa.</p>
      <div><label className="label">Bahan</label><Picker items={ingredients} value={ingredientId} onChange={setId} placeholder="Pilih bahan" /></div>
      <div><label className="label">Dari tempat</label><LocPick value={loc} set={setLoc} locs={['GUDANG', 'BAR', 'KITCHEN']} />{sel && <p className="text-xs text-gray-400 mt-1">Sisa di {LOC_LABEL[loc]}: {stockAt(sel, loc)} {sel.unit}</p>}</div>
      <div><label className="label">Jumlah {sel ? `(${sel.unit})` : ''}</label><input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="input text-base py-3" /></div>
      <div><label className="label">Alasan (opsional)</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className="input text-base py-3" placeholder="cth. tumpah" /></div>
      <button onClick={submit} disabled={busy || !ingredientId || !qty} className="btn btn-lg btn-danger w-full">{busy ? 'Memproses...' : 'Catat pembuangan'}</button>
    </div>
  );
}

function ReceivePO({ busy, setBusy, onDone }: any) {
  const [pos, setPos] = useState<any[]>([]);
  const load = useCallback(async () => { try { const d = await api.get<any[]>('/api/purchase-orders?status=DRAFT'); setPos(d); } catch (e) { console.error(e); } }, []);
  useEffect(() => { load(); }, [load]);
  const receive = async (id: string) => { if (!confirm('Barang sudah datang & sesuai? Stok gudang akan ditambah.')) return; setBusy(true); try { await api.patch('/api/purchase-orders', { id, action: 'complete' }); onDone('Barang diterima ✓'); load(); } catch (e: any) { alert(e.message || 'Gagal'); } finally { setBusy(false); } };
  return (
    <div className="space-y-3 mt-2">
      <p className="text-sm text-gray-500">Pesanan yang belum diterima. Tandai "Terima" kalau barang sudah datang.</p>
      {pos.map((po) => (
        <div key={po.id} className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex justify-between"><span className="font-medium">{po.supplier?.name || po.poNumber}</span><span className="text-xs text-gray-400">{po.poNumber}</span></div>
          <div className="text-xs text-gray-500 mt-1">{(po.items || []).map((it: any) => `${it.ingredient?.name} ${it.quantity}`).join(', ')}</div>
          <button onClick={() => receive(po.id)} disabled={busy} className="btn btn-sm btn-primary w-full mt-2">Terima barang ini</button>
        </div>
      ))}
      {pos.length === 0 && <p className="text-center text-gray-400 py-6">Tidak ada pesanan menunggu</p>}
    </div>
  );
}

function Opname({ canApply, busy, setBusy, onDone }: any) {
  const [loc, setLoc] = useState('BAR'); const [tier, setTier] = useState('');
  const [draft, setDraft] = useState<any>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const create = async () => { setBusy(true); try { const o = await api.post<any>('/api/stock-opname', { action: 'create', location: loc, tier: tier || undefined }); setDraft(o); setCounts({}); } catch (e: any) { alert(e.message || 'Gagal'); } finally { setBusy(false); } };
  const saveCounts = async () => {
    if (!draft) return; setBusy(true);
    try {
      const items = draft.items.map((it: any) => ({ id: it.id, systemQty: it.systemQty, actualQty: counts[it.id] !== undefined ? parseFloat(counts[it.id]) || 0 : it.systemQty }));
      await api.post('/api/stock-opname', { action: 'update', opnameId: draft.id, items });
      onDone('Hitungan tersimpan ✓'); if (!canApply) setDraft(null);
    } catch (e: any) { alert(e.message || 'Gagal'); } finally { setBusy(false); }
  };
  const apply = async () => { if (!draft || !confirm('Selesaikan opname? Selisih akan dipotong ke stok.')) return; setBusy(true); try { await api.post('/api/stock-opname', { action: 'complete', opnameId: draft.id }); onDone('Opname selesai ✓'); setDraft(null); } catch (e: any) { alert(e.message || 'Gagal'); } finally { setBusy(false); } };

  if (!draft) return (
    <div className="space-y-4 mt-2">
      <p className="text-sm text-gray-500">Hitung stok fisik. Pilih tempat & jenis hitungan.</p>
      <div><label className="label">Tempat</label><LocPick value={loc} set={setLoc} locs={['GUDANG', 'BAR', 'KITCHEN']} /></div>
      <div><label className="label">Jenis</label><div className="flex gap-2">{[['', 'Semua'], ['A', 'Harian'], ['B', 'Mingguan'], ['C', 'Bulanan']].map(([v, l]) => <button key={v} onClick={() => setTier(v)} className={`flex-1 py-2.5 rounded-xl border text-sm ${tier === v ? 'bg-green-50 border-green-500 text-green-700' : 'border-gray-200 text-gray-600'}`}>{l}</button>)}</div></div>
      <button onClick={create} disabled={busy} className="btn btn-lg btn-primary w-full">{busy ? '...' : 'Mulai hitung'}</button>
    </div>
  );
  return (
    <div className="space-y-3 mt-2">
      <p className="text-sm text-gray-500">Masukkan jumlah hasil hitungan fisik. Jangan diisi = dianggap sama.</p>
      {draft.items.map((it: any) => (
        <div key={it.id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-3">
          <span className="flex-1 text-sm font-medium">{it.ingredient?.name}</span>
          <input type="number" value={counts[it.id] ?? ''} onChange={(e) => setCounts({ ...counts, [it.id]: e.target.value })} placeholder="hitung" className="input w-28 text-base" />
          <span className="text-xs text-gray-400 w-10">{it.ingredient?.unit}</span>
        </div>
      ))}
      {draft.items.length === 0 && <p className="text-center text-gray-400 py-4">Tidak ada bahan di tempat/jenis ini</p>}
      <div className="flex gap-2">
        <button onClick={saveCounts} disabled={busy} className="btn btn-md btn-secondary flex-1">Simpan hitungan</button>
        {canApply && <button onClick={apply} disabled={busy} className="btn btn-md btn-primary flex-1">Selesai & potong</button>}
      </div>
      {!canApply && <p className="text-xs text-gray-400 text-center">Admin yang akan menyelesaikan & memotong selisih.</p>}
    </div>
  );
}

function MenuView() {
  const [products, setProducts] = useState<any[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => { api.get<any[]>('/api/products?active=true').then(setProducts).catch(() => {}); }, []);
  const list = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3 mt-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari menu..." className="input text-base py-3" />
      {list.map((p) => (
        <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex justify-between"><span className="font-medium">{p.name}</span><span className="font-bold text-green-600">{formatCurrency(p.price)}</span></div>
          {p.recipe?.items?.length > 0 && <p className="text-xs text-gray-400 mt-1">{p.recipe.items.map((ri: any) => `${ri.quantity}${ri.ingredient.unit} ${ri.ingredient.name}`).join(' + ')}</p>}
        </div>
      ))}
      {list.length === 0 && <p className="text-center text-gray-400 py-6">Tidak ada menu</p>}
    </div>
  );
}

function ExpenseForm({ busy, setBusy, onDone }: any) {
  const [category, setCategory] = useState('Operasional'); const [description, setDesc] = useState(''); const [amount, setAmount] = useState('');
  const submit = async () => { if (!description || !amount) return; setBusy(true); try { await api.post('/api/expenses', { category, description, amount: parseFloat(amount) }); onDone('Pengeluaran dicatat ✓'); } catch (e: any) { alert(e.message || 'Gagal'); } finally { setBusy(false); } };
  return (
    <div className="space-y-4 mt-2">
      <p className="text-sm text-gray-500">Catat belanja kecil harian (galon, gas, dll).</p>
      <div><label className="label">Kategori</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="select text-base py-3">
          {['Operasional', 'Bahan', 'Utilitas', 'Lainnya'].map((c) => <option key={c} value={c}>{c}</option>)}
        </select></div>
      <div><label className="label">Untuk apa?</label><input value={description} onChange={(e) => setDesc(e.target.value)} className="input text-base py-3" placeholder="cth. Galon air 2x" /></div>
      <div><label className="label">Jumlah (Rp)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input text-base py-3" /></div>
      <button onClick={submit} disabled={busy || !description || !amount} className="btn btn-lg btn-primary w-full">{busy ? '...' : 'Catat'}</button>
    </div>
  );
}
