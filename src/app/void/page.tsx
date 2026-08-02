'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, Button, Modal, formatCurrency } from '@/components/ui';
import { Toolbar } from '@/components/ui/Toolbar';
import { api } from '@/lib/fetch';
import clsx from 'clsx';

const VOID_REASONS = [
  { value: 'WRONG_ITEM',      label: 'Item salah / salah input' },
  { value: 'CUSTOMER_CANCEL', label: 'Customer cancel' },
  { value: 'OVERCHARGE',      label: 'Kelebihan charge' },
  { value: 'SYSTEM_ERROR',    label: 'Error sistem' },
  { value: 'OTHER',           label: 'Lainnya' },
];

export default function VoidPage() {
  const [tab, setTab]           = useState<'requests'|'manual'>('requests');
  const [voidRequests, setVoidReqs] = useState<any[]>([]);
  const [reviewing, setReviewing]   = useState<any>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [search, setSearch]     = useState('');
  const [orderNo, setOrderNo]   = useState('');
  const [found, setFound]       = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [voidHistory, setVoidHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [confirmModal, setConfirmModal] = useState(false);
  const [voidReason, setVoidReason]     = useState('WRONG_ITEM');
  const [stockReturned, setStockReturned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().slice(0,10));
  const [toDate, setToDate]     = useState(() => new Date().toISOString().slice(0,10));

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get<any>(`/api/void?from=${fromDate}&to=${toDate}`);
      setVoidHistory(res.orders || []);
    } catch { /* silent */ }
    finally { setLoadingHistory(false); }
  }, [fromDate, toDate]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  async function handleSearch() {
    if (!orderNo.trim()) return;
    setSearching(true); setFound(null);
    try {
      const res = await api.get<any>(`/api/orders?orderNumber=${orderNo.trim()}`);
      const order = res.orders?.[0];
      if (!order) { alert('Order tidak ditemukan'); return; }
      if (!['COMPLETED','REFUNDED'].includes(order.status)) { alert(`Order status "${order.status}" tidak bisa di-void`); return; }
      setFound(order);
    } catch (e: any) { alert(e.message || 'Gagal mencari'); }
    finally { setSearching(false); }
  }

  async function handleVoid() {
    if (!found) return;
    setProcessing(true);
    try {
      await api.post('/api/void', { orderId: found.id, voidReason, stockReturned });
      setConfirmModal(false); setFound(null); setOrderNo('');
      alert('✅ Order berhasil di-void');
      loadHistory();
    } catch (e: any) { alert(e.message || 'Gagal void'); }
    finally { setProcessing(false); }
  }

  const filteredHistory = voidHistory.filter(o =>
    !search || o.orderNumber?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto">
        <div className="page-header">
          <div><h1 className="page-title">Void Order</h1><p className="page-subtitle">Batalkan transaksi yang sudah selesai</p></div>
        </div>

        {/* Search order */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
          <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-1)' }}>Cari Order untuk di-Void</h2>
          <div className="flex gap-3">
            <input className="input flex-1" value={orderNo} onChange={e => setOrderNo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Masukkan nomor order (cth. ORD-2507001)" />
            <Button onClick={handleSearch} disabled={searching || !orderNo.trim()}>
              {searching ? 'Mencari...' : 'Cari'}
            </Button>
          </div>

          {found && (
            <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-gray-900">{found.orderNumber}</p>
                  <p className="text-sm text-gray-600">{new Date(found.createdAt).toLocaleString('id-ID')} · {found.user?.name}</p>
                </div>
                <p className="text-xl font-black text-gray-900">{formatCurrency(found.total)}</p>
              </div>
              <div className="space-y-1 mb-3">
                {(found.items || []).map((item: any) => (
                  <p key={item.id} className="text-sm text-gray-700">{item.quantity}× {item.product?.name} — {formatCurrency(item.price * item.quantity)}</p>
                ))}
              </div>
              <button onClick={() => setConfirmModal(true)}
                className="w-full py-2.5 text-sm font-bold text-red-600 border border-red-300 bg-white rounded-xl hover:bg-red-50 transition-colors">
                Void Order Ini
              </button>
            </div>
          )}
        </div>

        {/* History */}
        <div>
          <div className="flex gap-3 mb-3 flex-wrap items-end">
            <h2 className="text-base font-bold" style={{ color: 'var(--text-1)' }}>Riwayat Void</h2>
            <div className="flex gap-2 ml-auto">
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="input text-sm" />
              <span className="self-center" style={{ color: 'var(--text-2)' }}>—</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="input text-sm" />
            </div>
          </div>

          <Toolbar search={search} onSearch={setSearch} searchPlaceholder="Cari nomor order..." />

          {loadingHistory ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : filteredHistory.length === 0 ? (
            <div className="empty-state"><p className="empty-title">Belum ada void di periode ini</p></div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Order</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase hidden sm:table-cell">Alasan</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase hidden md:table-cell">Di-void oleh</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Waktu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredHistory.map(o => (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono font-bold text-xs" style={{ color: 'var(--text-1)' }}>{o.orderNumber}</td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <Badge variant="danger">{VOID_REASONS.find(r => r.value === o.voidReason)?.label || o.voidReason}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(o.total)}</td>
                        <td className="px-4 py-3 text-sm hidden md:table-cell" style={{ color: 'var(--text-2)' }}>{o.user?.name || '—'}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-2)' }}>
                          {o.voidedAt ? new Date(o.voidedAt).toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm void modal */}
      <Modal open={confirmModal} onClose={() => setConfirmModal(false)} title="Konfirmasi Void Order">
        <div className="space-y-4">
          {found && (
            <div className="p-3 rounded-xl bg-gray-50 text-sm">
              <p className="font-bold" style={{ color: 'var(--text-1)' }}>{found.orderNumber} — {formatCurrency(found.total)}</p>
              <p style={{ color: 'var(--text-2)' }}>{new Date(found.createdAt).toLocaleString('id-ID')}</p>
            </div>
          )}
          <div>
            <label className="label">Alasan Void *</label>
            <select className="select" value={voidReason} onChange={e => setVoidReason(e.target.value)}>
              {VOID_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
            <input type="checkbox" id="stockReturn" checked={stockReturned} onChange={e => setStockReturned(e.target.checked)}
              className="w-4 h-4 accent-brand-600" />
            <label htmlFor="stockReturn" className="text-sm cursor-pointer" style={{ color: 'var(--text-1)' }}>
              Kembalikan stok bahan ke Bar
            </label>
          </div>
          <p className="text-xs p-3 rounded-xl bg-red-50 border border-red-100 text-red-700">
            ⚠️ Tindakan ini tidak bisa dibalik. Order akan ditandai VOIDED dan laporan akan diupdate.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setConfirmModal(false)} className="btn btn-secondary btn-md">Batal</button>
            <button onClick={handleVoid} disabled={processing}
              className="btn btn-danger btn-md">{processing ? 'Memproses...' : 'Ya, Void Order'}</button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
