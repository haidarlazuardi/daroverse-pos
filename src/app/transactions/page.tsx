'use client';
import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/fetch';
import { formatCurrency, Badge } from '@/components/ui';

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: 'success', OPEN: 'warning', VOID: 'danger', CANCELLED: 'danger'
};
const PAY_LABEL: Record<string, string> = {
  CASH: 'Cash', QRIS: 'QRIS', TRANSFER: 'Transfer', OPEN_BILL: 'Open Bill'
};

export default function TransactionsPage() {
  const [orders, setOrders]     = useState<any[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [page, setPage]         = useState(0);
  const [search, setSearch]     = useState('');
  const [status, setStatus]     = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');

  const LIMIT = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(LIMIT));
      params.set('offset', String(page * LIMIT));
      if (status)   params.set('status', status);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo)   params.set('to', dateTo);
      const data = await api.get<any>(`/api/orders?${params}`);
      setOrders(data.orders || []);
      setTotal(data.total || 0);
    } catch {} finally { setLoading(false); }
  }, [page, status, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  // Filter by search client-side
  const filtered = search
    ? orders.filter(o =>
        o.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
        o.billName?.toLowerCase().includes(search.toLowerCase()) ||
        o.customer?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : orders;

  async function deleteOrder(id: string) {
    const order = orders.find(o => o.id === id);
    if (!confirm(`Hapus order #${order?.orderNumber}? Tindakan ini tidak bisa dibatalkan.`)) return;
    setDeleting(id);
    try {
      await api.delete(`/api/orders/${id}`);
      setOrders(p => p.filter(o => o.id !== id));
      setSelected(p => { const n = new Set(p); n.delete(id); return n; });
    } catch(e: any) { alert(e.message || 'Gagal hapus'); }
    finally { setDeleting(null); }
  }

  async function deleteSelected() {
    if (!selected.size) return;
    if (!confirm(`Hapus ${selected.size} order? Tindakan ini tidak bisa dibatalkan.`)) return;
    setBulkDeleting(true);
    try {
      for (const id of selected) {
        await api.delete(`/api/orders/${id}`).catch(() => {});
      }
      setOrders(p => p.filter(o => !selected.has(o.id)));
      setSelected(new Set());
    } finally { setBulkDeleting(false); }
  }

  function toggleSelect(id: string) {
    setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(o => o.id)));
    }
  }

  const fmt = (d: string) => new Date(d).toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black" style={{ color: 'var(--text-1)' }}>Data Transaksi</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>
              {total.toLocaleString('id-ID')} total transaksi
            </p>
          </div>
          {selected.size > 0 && (
            <button onClick={deleteSelected} disabled={bulkDeleting}
              className="btn btn-sm bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">
              {bulkDeleting ? 'Menghapus...' : `🗑 Hapus ${selected.size} Order`}
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="card p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input col-span-2 lg:col-span-1"
            placeholder="Cari order / nama..."
          />
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }} className="input">
            <option value="">Semua Status</option>
            <option value="COMPLETED">Completed</option>
            <option value="OPEN">Open Bill</option>
            <option value="VOID">Void</option>
          </select>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} className="input"/>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} className="input"/>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  <th className="px-3 py-2.5 text-left w-8">
                    <input type="checkbox"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={toggleAll}
                    />
                  </th>
                  {['Order #','Waktu','Customer','Items','Total','Bayar','Status',''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide"
                      style={{ color: 'var(--text-3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-10">
                    <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }}/>
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-10 text-gray-400">Tidak ada transaksi</td></tr>
                ) : filtered.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors"
                    style={{ background: selected.has(o.id) ? 'var(--brand)08' : undefined }}>
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)}/>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs font-bold" style={{ color: 'var(--text-1)' }}>
                      #{o.orderNumber}
                    </td>
                    <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-2)' }}>
                      {fmt(o.createdAt)}
                    </td>
                    <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-1)' }}>
                      {o.billName || o.customer?.name || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-3)' }}>
                      {(o.items || []).length} item
                    </td>
                    <td className="px-3 py-3 font-bold" style={{ color: 'var(--brand)' }}>
                      {formatCurrency(o.total)}
                    </td>
                    <td className="px-3 py-3 text-xs" style={{ color: 'var(--text-3)' }}>
                      {PAY_LABEL[o.payment?.method] || o.payment?.method || '—'}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={STATUS_COLOR[o.status] as any}>{o.status}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => deleteOrder(o.id)}
                        disabled={deleting === o.id}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold text-red-500 border border-red-200 hover:bg-red-50 disabled:opacity-40 transition-colors"
                      >
                        {deleting === o.id ? '...' : 'Hapus'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && total > LIMIT && (
            <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                {page * LIMIT + 1}–{Math.min((page+1) * LIMIT, total)} dari {total}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0}
                  className="btn btn-secondary btn-sm disabled:opacity-40">← Prev</button>
                <button onClick={() => setPage(p => p+1)} disabled={(page+1)*LIMIT >= total}
                  className="btn btn-secondary btn-sm disabled:opacity-40">Next →</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
