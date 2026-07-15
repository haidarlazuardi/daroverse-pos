'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, Button, Modal, formatCurrency, formatNumber } from '@/components/ui';
import { SlideOver } from '@/components/ui/SlideOver';
import { Toolbar } from '@/components/ui/Toolbar';
import { api } from '@/lib/fetch';
import clsx from 'clsx';
import * as XLSX from 'xlsx';

interface Customer {
  id: string; name: string; phone: string | null;
  points: number; totalSpent: number; visitCount: number;
  lastVisitAt: string | null; createdAt: string;
}

function tierLabel(spent: number): { label: string; color: string } {
  if (spent >= 1000000) return { label: '⭐ VIP',    color: 'text-yellow-600 bg-yellow-50' };
  if (spent >= 500000)  return { label: '🥈 Regular', color: 'text-blue-600 bg-blue-50' };
  return { label: '🆕 Baru', color: 'text-gray-600 bg-gray-100' };
}

function daysSince(date: string | null): string {
  if (!date) return '—';
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 864e5);
  if (days === 0) return 'Hari ini';
  if (days === 1) return 'Kemarin';
  if (days < 7)   return `${days} hari lalu`;
  if (days < 30)  return `${Math.floor(days/7)} minggu lalu`;
  return `${Math.floor(days/30)} bulan lalu`;
}

export default function CustomersPage() {
  const [data, setData]         = useState<Customer[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [history, setHistory]   = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing]   = useState<Customer | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '' });
  const [saving, setSaving]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Promo
  const [promoOpen, setPromoOpen]         = useState(false);
  const [promoTarget, setPromoTarget]     = useState<Customer | null>(null);
  const [promoTemplates, setPromoTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [templateModal, setTemplateModal] = useState(false);
  const [templateForm, setTemplateForm]   = useState({ name: '', headline: '', subline: '', body: '', tnc: '' });

  useEffect(() => {
    api.get<any[]>('/api/promo-templates').then(setPromoTemplates).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = search
        ? `/api/customers?phone=${encodeURIComponent(search)}`
        : '/api/customers';
      const res = await api.get<any>(url);
      if (search) {
        setData(res.found ? [res.customer] : []);
      } else {
        setData(Array.isArray(res) ? res : []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function openDetail(c: Customer) {
    setSelected(c);
    setLoadingHistory(true);
    try {
      const res = await api.get<any>(`/api/orders?customerPhone=${c.phone}&limit=10`);
      setHistory(res.orders || []);
    } catch { setHistory([]); }
    finally { setLoadingHistory(false); }
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setEditForm({ name: c.name, phone: c.phone || '' });
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!editing || !editForm.name) return;
    setSaving(true);
    try {
      await api.patch('/api/customers', { id: editing.id, name: editForm.name, phone: editForm.phone || null });
      setEditOpen(false); load();
      if (selected?.id === editing.id) setSelected(prev => prev ? { ...prev, ...editForm } : null);
    } catch (e: any) { alert(e.message || 'Gagal'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await api.delete(`/api/customers?id=${deleteTarget.id}`); setDeleteTarget(null); if (selected?.id === deleteTarget.id) setSelected(null); load(); }
    catch (e: any) { alert(e.message || 'Gagal'); }
    finally { setDeleting(false); }
  }

  function handleExport() {
    const rows = data.map(c => ({
      name: c.name, phone: c.phone ?? '', points: c.points,
      total_spent: c.totalSpent, visit_count: c.visitCount,
      last_visit: c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString('id-ID') : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    XLSX.writeFile(wb, 'customers-export.xlsx');
  }

  // Stats
  const totalCustomers    = data.length;
  const totalPoints       = data.reduce((s, c) => s + c.points, 0);
  const repeatCustomers   = data.filter(c => c.visitCount > 1).length;
  const totalRevenue      = data.reduce((s, c) => s + c.totalSpent, 0);

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Pelanggan</h1>
          <p className="text-sm text-gray-500 mt-1">Data pelanggan terdaftar dan riwayat transaksi</p>
        </div>

        {/* Summary cards - tablet: 2x2, desktop: 4 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Pelanggan', value: formatNumber(totalCustomers), sub: 'terdaftar', color: 'bg-brand-50 text-brand-700' },
            { label: 'Pelanggan Repeat', value: formatNumber(repeatCustomers), sub: `${totalCustomers ? Math.round(repeatCustomers/totalCustomers*100) : 0}% dari total`, color: 'bg-emerald-50 text-emerald-700' },
            { label: 'Total Poin Aktif', value: formatNumber(totalPoints), sub: 'belum ditukar', color: 'bg-amber-50 text-amber-700' },
            { label: 'Total Belanja', value: formatCurrency(totalRevenue), sub: 'semua pelanggan', color: 'bg-purple-50 text-purple-700' },
          ].map(s => (
            <div key={s.label} className={clsx('rounded-xl p-4', s.color)}>
              <p className="text-xs font-medium opacity-70">{s.label}</p>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
              <p className="text-xs opacity-60 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        <Toolbar
          search={search} onSearch={setSearch}
          searchPlaceholder="Cari nomor HP..."
          onExport={handleExport}
        />

        {loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : data.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-sm">Belum ada pelanggan terdaftar.</p>
            <p className="text-sm">Pelanggan akan muncul saat kasir input nama/HP di POS.</p>
          </div>
        ) : (
          /* Card list - tablet friendly */
          <div className="space-y-2">
            {data.map(c => {
              const tier = tierLabel(c.totalSpent);
              return (
                <button key={c.id} onClick={() => openDetail(c)}
                  className="w-full bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-300 hover:shadow-sm transition-all text-left">
                  <div className="flex items-center justify-between gap-4">
                    {/* Avatar + info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                        <p className="text-sm text-gray-400">{c.phone || 'Tanpa HP'}</p>
                      </div>
                    </div>

                    {/* Stats - tablet shows all, phone hides some */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="hidden sm:block text-right">
                        <p className="text-xs text-gray-400">Kunjungan</p>
                        <p className="font-bold text-gray-900">{c.visitCount}×</p>
                      </div>
                      <div className="hidden sm:block text-right">
                        <p className="text-xs text-gray-400">Total belanja</p>
                        <p className="font-bold text-gray-900">{formatCurrency(c.totalSpent)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Poin</p>
                        <p className="font-bold text-amber-600">{formatNumber(c.points)}</p>
                      </div>
                      <span className={clsx('text-xs font-semibold px-2 py-1 rounded-full hidden md:inline-block', tier.color)}>
                        {tier.label}
                      </span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300 flex-shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                  </div>

                  {/* Bottom row - last visit + actions */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                    <span className="text-xs text-gray-400">Terakhir: {daysSince(c.lastVisitAt)}</span>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      {c.phone && (
                        <button onClick={() => { setPromoTarget(c); setSelectedTemplate(null); setPromoOpen(true); }}
                          className="p-1.5 rounded-lg hover:bg-green-50 text-gray-300 hover:text-green-600 transition-colors" title="Kirim Promo WA">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                        </button>
                      )}
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-brand-50 text-gray-300 hover:text-brand-600 transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={() => setDeleteTarget(c)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                      </button>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail slide-in */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end items-end sm:items-stretch">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative bg-white w-full sm:max-w-md max-h-[90vh] sm:max-h-full flex flex-col shadow-2xl animate-slide-in-right">
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-lg">
                  {selected.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">{selected.name}</h2>
                  <p className="text-sm text-gray-400">{selected.phone || 'Tanpa nomor HP'}</p>
                  <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full inline-block mt-1', tierLabel(selected.totalSpent).color)}>
                    {tierLabel(selected.totalSpent).label}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-0 border-b border-gray-100">
              {[
                { label: 'Total Belanja', value: formatCurrency(selected.totalSpent) },
                { label: 'Kunjungan', value: `${selected.visitCount}×` },
                { label: 'Poin Aktif', value: formatNumber(selected.points) },
              ].map((s, i) => (
                <div key={s.label} className={clsx('px-4 py-4 text-center', i > 0 && 'border-l border-gray-100')}>
                  <p className="text-xs text-gray-400">{s.label}</p>
                  <p className="font-bold text-gray-900 mt-1">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Transaction history */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Riwayat Transaksi</p>
              {loadingHistory ? (
                <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : history.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Belum ada transaksi tercatat</p>
              ) : (
                <div className="space-y-2">
                  {history.map(o => (
                    <div key={o.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{o.orderNumber}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(o.createdAt).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}
                          {' · '}{o.items?.length || 0} item
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{formatCurrency(o.total)}</p>
                        {o.pointsEarned > 0 && <p className="text-xs text-amber-500">+{o.pointsEarned} poin</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 text-center">Bergabung {new Date(selected.createdAt).toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' })}</p>
            </div>
          </div>
        </div>
      )}

      {/* Edit SlideOver */}
      {editOpen && (
        <SlideOver open={editOpen} onClose={() => setEditOpen(false)} title="Edit Pelanggan"
          footer={<div className="flex justify-end gap-3"><button onClick={() => setEditOpen(false)} className="btn btn-secondary btn-md">Batal</button><Button onClick={handleSaveEdit} disabled={saving||!editForm.name}>{saving ? 'Menyimpan...' : 'Simpan'}</Button></div>}>
          <div className="space-y-4">
            <div><label className="label">Nama *</label><input className="input" value={editForm.name} onChange={e => setEditForm(p => ({...p, name: e.target.value}))} /></div>
            <div><label className="label">Nomor HP</label><input className="input" value={editForm.phone} onChange={e => setEditForm(p => ({...p, phone: e.target.value}))} placeholder="08xx..." /></div>
          </div>
        </SlideOver>
      )}

      {/* Delete Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus Pelanggan">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Yakin hapus pelanggan <span className="font-bold">{deleteTarget?.name}</span>? Data transaksi tetap tersimpan.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteTarget(null)} className="btn btn-secondary btn-md">Batal</button>
            <button onClick={handleDelete} disabled={deleting} className="btn btn-danger btn-md">{deleting ? 'Menghapus...' : 'Hapus'}</button>
          </div>
        </div>
      </Modal>
      {/* ── Promo Modal ──────────────────────────────────────────────── */}
      <Modal open={promoOpen} onClose={() => setPromoOpen(false)} title={`Kirim Promo ke ${promoTarget?.name}`}>
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>Pilih template promo yang akan dikirim via WhatsApp</p>

          {promoTemplates.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400 mb-3">Belum ada template promo</p>
              <Button onClick={() => { setPromoOpen(false); setTemplateModal(true); }}>+ Buat Template</Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {promoTemplates.map(t => (
                <button key={t.id} onClick={() => setSelectedTemplate(t)}
                  className="w-full text-left p-3 rounded-xl border-2 transition-all"
                  style={{ borderColor: selectedTemplate?.id === t.id ? 'var(--brand)' : 'var(--border)', background: selectedTemplate?.id === t.id ? 'var(--surface-2)' : 'white' }}>
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{t.headline}</p>
                </button>
              ))}
            </div>
          )}

          {selectedTemplate && (
            <div className="p-3 rounded-xl bg-gray-50 border text-sm space-y-1">
              <p className="font-black">{selectedTemplate.headline}</p>
              {selectedTemplate.subline && <p className="italic text-gray-600">{selectedTemplate.subline}</p>}
              <p className="whitespace-pre-line">{selectedTemplate.body}</p>
              {selectedTemplate.tnc && <p className="text-xs text-gray-400 mt-2 whitespace-pre-line">S&K: {selectedTemplate.tnc}</p>}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => { setPromoOpen(false); setTemplateModal(true); }}
              className="btn btn-secondary btn-md">+ Template Baru</button>
            <Button
              disabled={!selectedTemplate || !promoTarget?.phone}
              onClick={() => {
                if (!selectedTemplate || !promoTarget?.phone) return;
                const phone = promoTarget.phone.replace(/^0/, '62').replace(/[^0-9]/g, '');
                const msg = [
                  `*${selectedTemplate.headline}*`,
                  selectedTemplate.subline ? `_${selectedTemplate.subline}_` : '',
                  '',
                  selectedTemplate.body,
                  selectedTemplate.tnc ? `\n_S&K:_\n${selectedTemplate.tnc}` : '',
                ].filter(Boolean).join('\n');
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                setPromoOpen(false);
              }}>
              📱 Buka WhatsApp
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Template Modal ───────────────────────────────────────────── */}
      <Modal open={templateModal} onClose={() => setTemplateModal(false)} title="Buat Template Promo">
        <div className="space-y-3">
          <div>
            <label className="label">Nama Template (internal) *</label>
            <input className="input" value={templateForm.name} onChange={e => setTemplateForm(p => ({...p, name: e.target.value}))} placeholder="cth. Promo Ulang Tahun Juli" />
          </div>
          <div>
            <label className="label">Headline *</label>
            <input className="input" value={templateForm.headline} onChange={e => setTemplateForm(p => ({...p, headline: e.target.value}))} placeholder="cth. 🎉 PROMO SPESIAL SOEKA HOUSE" />
          </div>
          <div>
            <label className="label">Subline</label>
            <input className="input" value={templateForm.subline} onChange={e => setTemplateForm(p => ({...p, subline: e.target.value}))} placeholder="cth. Khusus pelanggan setia kami" />
          </div>
          <div>
            <label className="label">Body *</label>
            <textarea className="input" rows={4} value={templateForm.body} onChange={e => setTemplateForm(p => ({...p, body: e.target.value}))} placeholder="Dapatkan diskon 20% untuk semua minuman! Berlaku 14-21 Juli 2026." />
          </div>
          <div>
            <label className="label">Terms & Conditions</label>
            <textarea className="input" rows={2} value={templateForm.tnc} onChange={e => setTemplateForm(p => ({...p, tnc: e.target.value}))} placeholder="Tidak berlaku bersamaan dengan promo lain. Maks 1x per customer." />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setTemplateModal(false)} className="btn btn-secondary btn-md">Batal</button>
            <Button disabled={!templateForm.name || !templateForm.headline || !templateForm.body}
              onClick={async () => {
                try {
                  const t = await api.post<any>('/api/promo-templates', templateForm);
                  setPromoTemplates(p => [t, ...p]);
                  setTemplateForm({ name: '', headline: '', subline: '', body: '', tnc: '' });
                  setTemplateModal(false);
                } catch (e: any) { alert(e.message || 'Gagal'); }
              }}>
              Simpan Template
            </Button>
          </div>
        </div>
      </Modal>

    </AdminLayout>
  );
}
