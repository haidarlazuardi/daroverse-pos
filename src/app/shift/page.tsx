'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, Button, Modal, StatCard, formatCurrency } from '@/components/ui';
import { api } from '@/lib/fetch';
import { useAuthStore } from '@/store';
import { SENIOR_ROLES } from '@/lib/auth';
import clsx from 'clsx';

const STATUS_LABEL: Record<string, string> = { OPEN: 'Berjalan', PENDING_CLOSE: 'Menunggu Approve', CLOSED: 'Selesai' };
const STATUS_VARIANT: Record<string, any> = { OPEN: 'success', PENDING_CLOSE: 'warning', CLOSED: 'default' };

export default function ShiftPage() {
  const { user } = useAuthStore();
  const [activeShift, setActiveShift] = useState<any>(null);
  const [pendingShifts, setPendingShifts] = useState<any[]>([]);
  const [history, setHistory]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [openModal, setOpenModal]   = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [closeNotes, setCloseNotes]   = useState('');
  const [saving, setSaving]   = useState(false);

  const isManager = user && (SENIOR_ROLES as string[]).includes(user.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [active, all] = await Promise.all([
        api.get<any>('/api/shifts?active=true'),
        api.get<any>('/api/shifts?limit=20'),
      ]);
      setActiveShift(active.shift);
      const pending = (all.shifts || []).filter((s: any) => s.status === 'PENDING_CLOSE');
      const closed  = (all.shifts || []).filter((s: any) => s.status === 'CLOSED');
      setPendingShifts(pending);
      setHistory(closed.slice(0, 10));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleOpenShift() {
    setSaving(true);
    try {
      await api.post('/api/shifts', { openingCash: parseFloat(openingCash) || 0 });
      setOpenModal(false); setOpeningCash(''); load();
    } catch (e: any) { alert(e.message || 'Gagal'); }
    finally { setSaving(false); }
  }

  async function handleRequestClose() {
    if (!activeShift) return;
    setSaving(true);
    try {
      await api.patch('/api/shifts', { id: activeShift.id, action: 'request_close', closingCash: parseFloat(closingCash) || 0, notes: closeNotes });
      setCloseModal(false); setClosingCash(''); setCloseNotes(''); load();
    } catch (e: any) { alert(e.message || 'Gagal'); }
    finally { setSaving(false); }
  }

  async function handleApprove(shiftId: string) {
    setSaving(true);
    try {
      await api.patch('/api/shifts', { id: shiftId, action: 'approve_close' });
      load();
    } catch (e: any) { alert(e.message || 'Gagal'); }
    finally { setSaving(false); }
  }

  function duration(from: string, to?: string) {
    const ms = (to ? new Date(to) : new Date()).getTime() - new Date(from).getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}j ${m}m`;
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto">
        <div className="page-header">
          <div><h1 className="page-title">Shift</h1><p className="page-subtitle">Kelola sesi kerja kasir</p></div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-6">

            {/* Active Shift */}
            {activeShift ? (
              <div className="bg-white border-2 border-brand-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-sm font-bold text-emerald-700">Shift Aktif</span>
                    </div>
                    <h2 className="text-xl font-black" style={{ color: 'var(--text-1)' }}>{activeShift.user?.name}</h2>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>
                      Buka: {new Date(activeShift.openedAt).toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })} · {duration(activeShift.openedAt)}
                    </p>
                  </div>
                  <Button onClick={() => setCloseModal(true)}>Tutup Shift</Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Modal Awal" value={formatCurrency(activeShift.openingCash)} />
                  <StatCard label="Total Penjualan" value={formatCurrency(activeShift.totalSales || 0)} />
                  <StatCard label="Cash" value={formatCurrency(activeShift.cashSales || 0)} />
                  <StatCard label="QRIS" value={formatCurrency(activeShift.qrisSales || 0)} />
                </div>
              </div>
            ) : (
              <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center">
                <p className="text-lg font-bold mb-1" style={{ color: 'var(--text-1)' }}>Belum ada shift aktif</p>
                <p className="text-sm mb-4" style={{ color: 'var(--text-2)' }}>Buka shift untuk mulai menerima transaksi</p>
                <Button onClick={() => setOpenModal(true)}>Buka Shift</Button>
              </div>
            )}

            {/* Pending Approval (manager only) */}
            {isManager && pendingShifts.length > 0 && (
              <div>
                <h2 className="text-base font-bold mb-3" style={{ color: 'var(--text-1)' }}>⏳ Menunggu Approval</h2>
                <div className="space-y-3">
                  {pendingShifts.map(s => (
                    <div key={s.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold" style={{ color: 'var(--text-1)' }}>{s.user?.name}</p>
                          <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
                            Buka: {new Date(s.openedAt).toLocaleString('id-ID')} · Durasi: {duration(s.openedAt, s.updatedAt)}
                          </p>
                          <div className="flex gap-4 mt-2 text-sm">
                            <span>Modal: <strong>{formatCurrency(s.openingCash)}</strong></span>
                            <span>Hitung kasir: <strong>{formatCurrency(s.closingCash || 0)}</strong></span>
                            <span>Sistem: <strong>{formatCurrency(s.expectedCash || 0)}</strong></span>
                            <span className={clsx('font-bold', (s.difference || 0) < 0 ? 'text-red-600' : 'text-emerald-600')}>
                              Selisih: {formatCurrency(s.difference || 0)}
                            </span>
                          </div>
                        </div>
                        <Button onClick={() => handleApprove(s.id)} disabled={saving}>Approve Tutup</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History */}
            {history.length > 0 && (
              <div>
                <h2 className="text-base font-bold mb-3" style={{ color: 'var(--text-1)' }}>Riwayat Shift</h2>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Kasir</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Buka</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Penjualan</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase hidden sm:table-cell">Selisih</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {history.map(s => (
                          <tr key={s.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-1)' }}>{s.user?.name}</td>
                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-2)' }}>
                              {new Date(s.openedAt).toLocaleDateString('id-ID', { day:'2-digit', month:'short' })}
                              <span className="ml-1 text-xs" style={{ color: 'var(--text-3)' }}>{duration(s.openedAt, s.closedAt)}</span>
                            </td>
                            <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--text-1)' }}>{formatCurrency(s.totalSales)}</td>
                            <td className={clsx('px-4 py-3 text-right font-semibold text-sm hidden sm:table-cell', (s.difference || 0) < -1000 ? 'text-red-600' : (s.difference || 0) > 1000 ? 'text-emerald-600' : 'text-gray-400')}>
                              {s.difference != null ? formatCurrency(s.difference) : '—'}
                            </td>
                            <td className="px-4 py-3 text-center"><Badge variant={STATUS_VARIANT[s.status]}>{STATUS_LABEL[s.status]}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Open Shift Modal */}
      <Modal open={openModal} onClose={() => setOpenModal(false)} title="Buka Shift">
        <div className="space-y-4">
          <div>
            <label className="label">Modal Awal Cash (Rp)</label>
            <input className="input" type="number" value={openingCash} onChange={e => setOpeningCash(e.target.value)} placeholder="Masukkan jumlah uang di laci kasir" autoFocus />
            <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>Hitung uang fisik di laci kasir sekarang</p>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setOpenModal(false)} className="btn btn-secondary btn-md">Batal</button>
            <Button onClick={handleOpenShift} disabled={saving}>{saving ? 'Membuka...' : 'Buka Shift'}</Button>
          </div>
        </div>
      </Modal>

      {/* Close Shift Modal */}
      <Modal open={closeModal} onClose={() => setCloseModal(false)} title="Tutup Shift">
        <div className="space-y-4">
          {activeShift && (
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-sm space-y-1">
              <div className="flex justify-between"><span style={{ color: 'var(--text-2)' }}>Modal awal</span><span className="font-bold" style={{ color: 'var(--text-1)' }}>{formatCurrency(activeShift.openingCash)}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-2)' }}>Total penjualan cash</span><span className="font-bold" style={{ color: 'var(--text-1)' }}>{formatCurrency(activeShift.cashSales || 0)}</span></div>
              <div className="flex justify-between border-t border-gray-200 pt-1 mt-1"><span className="font-bold" style={{ color: 'var(--text-1)' }}>Seharusnya ada</span><span className="font-black text-brand-700">{formatCurrency((activeShift.openingCash || 0) + (activeShift.cashSales || 0))}</span></div>
            </div>
          )}
          <div>
            <label className="label">Uang Cash Fisik yang Dihitung (Rp)</label>
            <input className="input" type="number" value={closingCash} onChange={e => setClosingCash(e.target.value)} placeholder="Hitung semua uang di laci kasir" autoFocus />
          </div>
          <div>
            <label className="label">Catatan (opsional)</label>
            <textarea className="input" rows={2} value={closeNotes} onChange={e => setCloseNotes(e.target.value)} placeholder="Misal: Ada pengembalian Rp 5000 dari customer" />
          </div>
          <p className="text-xs p-3 rounded-lg bg-amber-50 border border-amber-100 text-amber-700">
            ⚠️ Shift tidak langsung tutup — menunggu approval Manager/Owner terlebih dahulu.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setCloseModal(false)} className="btn btn-secondary btn-md">Batal</button>
            <Button onClick={handleRequestClose} disabled={saving || !closingCash}>{saving ? 'Mengirim...' : 'Ajukan Tutup Shift'}</Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
