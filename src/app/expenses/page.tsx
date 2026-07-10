'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, Button, Modal, StatCard, formatCurrency } from '@/components/ui';
import { SlideOver } from '@/components/ui/SlideOver';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Toolbar } from '@/components/ui/Toolbar';
import { api } from '@/lib/fetch';
import clsx from 'clsx';
import * as XLSX from 'xlsx';

const CATEGORIES = [
  { value: 'UTILITIES',   label: 'Utilities (Listrik, Air, Internet)' },
  { value: 'SUPPLIES',    label: 'Supplies (Gas, Tissue, Sabun)' },
  { value: 'OPERATIONAL', label: 'Operasional (Parkir, Ojol)' },
  { value: 'TRANSPORT',   label: 'Transport' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'SALARY',      label: 'Gaji' },
  { value: 'OTHER',       label: 'Lainnya' },
];

const EMPTY = { category: 'OPERATIONAL', description: '', amount: '', paidBy: '' };

export default function ExpensesPage() {
  const [data, setData]         = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing]   = useState<any>(null);
  const [form, setForm]         = useState({ ...EMPTY });
  const [saving, setSaving]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [fromDate, setFromDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; });
  const [toDate, setToDate]     = useState(() => new Date().toISOString().slice(0,10));

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api.get(`/api/expenses?from=${fromDate}&to=${toDate}`)); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setForm({ ...EMPTY }); setSlideOpen(true); }
  function openEdit(e: any) {
    setEditing(e);
    setForm({ category: e.category, description: e.description, amount: String(e.amount), paidBy: e.paidBy || '' });
    setSlideOpen(true);
  }

  async function handleSave() {
    if (!form.description || !form.amount) return;
    setSaving(true);
    try {
      const payload = { ...form, amount: parseFloat(form.amount) };
      if (editing) await api.patch('/api/expenses', { id: editing.id, ...payload });
      else await api.post('/api/expenses', payload);
      setSlideOpen(false); load();
    } catch (e: any) { alert(e.message || 'Gagal'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await api.delete(`/api/expenses?id=${deleteTarget.id}`); setDeleteTarget(null); load(); }
    catch (e: any) { alert(e.message || 'Gagal'); }
    finally { setDeleting(false); }
  }

  function handleExport() {
    const rows = (filtered).map((e: any) => ({
      Tanggal: new Date(e.createdAt).toLocaleDateString('id-ID'),
      Kategori: e.category, Deskripsi: e.description,
      Jumlah: e.amount, 'Dibayar Oleh': e.paidBy || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    XLSX.writeFile(wb, `expenses-${fromDate}-${toDate}.xlsx`);
  }

  const expenses = data?.expenses || [];
  const filtered = expenses.filter((e: any) => {
    const matchSearch = !search || e.description?.toLowerCase().includes(search.toLowerCase());
    const matchCat    = !filterCat || e.category === filterCat;
    return matchSearch && matchCat;
  });

  const columns: Column<any>[] = [
    { key: 'createdAt', label: 'Tanggal', sortable: true, render: e => <span className="text-gray-500 text-sm">{new Date(e.createdAt).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}</span> },
    { key: 'category',  label: 'Kategori', render: e => <Badge variant="default">{CATEGORIES.find(c => c.value === e.category)?.label.split(' ')[0] || e.category}</Badge> },
    { key: 'description', label: 'Deskripsi', render: e => <span className="font-medium text-gray-900">{e.description}</span> },
    { key: 'amount', label: 'Jumlah', sortable: true, render: e => <span className="font-bold text-red-600">{formatCurrency(e.amount)}</span> },
    { key: 'paidBy', label: 'Dibayar Oleh', render: e => <span className="text-gray-500 text-sm">{e.paidBy || '—'}</span> },
  ];

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <div className="page-header">
          <div>
            <h1 className="page-title">Pengeluaran</h1>
            <p className="page-subtitle">Catat pengeluaran operasional harian</p>
          </div>
        </div>

        {/* Date filter */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex gap-3 flex-wrap items-end">
          <div><label className="label">Dari</label><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="input text-sm" /></div>
          <div><label className="label">Sampai</label><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="input text-sm" /></div>
        </div>

        {/* Summary */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatCard label="Total Pengeluaran" value={formatCurrency(data.total)} />
            {Object.entries(data.byCategory as Record<string,number>).slice(0,3).map(([cat, amount]) => (
              <StatCard key={cat} label={cat} value={formatCurrency(amount as number)} />
            ))}
          </div>
        )}

        <Toolbar
          search={search} onSearch={setSearch} searchPlaceholder="Cari deskripsi..."
          filters={[{ key: 'cat', label: 'Kategori', value: filterCat, onChange: setFilterCat, options: CATEGORIES }]}
          onExport={handleExport}
          onAdd={openAdd} addLabel="Tambah Pengeluaran"
        />

        <DataTable
          data={filtered} columns={columns} keyField="id"
          loading={loading} emptyMessage="Belum ada pengeluaran di periode ini"
          rowActions={e => (
            <div className="flex gap-1">
              <button onClick={() => openEdit(e)} className="p-1.5 hover:bg-brand-50 rounded-lg text-gray-400 hover:text-brand-600">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button onClick={() => setDeleteTarget(e)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              </button>
            </div>
          )}
        />
      </div>

      <SlideOver open={slideOpen} onClose={() => setSlideOpen(false)}
        title={editing ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}
        footer={<div className="flex justify-end gap-3"><button onClick={() => setSlideOpen(false)} className="btn btn-secondary btn-md">Batal</button><Button onClick={handleSave} disabled={saving || !form.description || !form.amount}>{saving ? 'Menyimpan...' : editing ? 'Simpan' : 'Tambah'}</Button></div>}>
        <div className="space-y-4">
          <div><label className="label">Kategori</label>
            <select className="select" value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select></div>
          <div><label className="label">Deskripsi *</label><input className="input" value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} placeholder="cth. Beli gas 3kg" /></div>
          <div><label className="label">Jumlah (Rp) *</label><input className="input" type="number" value={form.amount} onChange={e => setForm(p => ({...p, amount: e.target.value}))} placeholder="50000" /></div>
          <div><label className="label">Dibayar Oleh</label><input className="input" value={form.paidBy} onChange={e => setForm(p => ({...p, paidBy: e.target.value}))} placeholder="Nama kasir/staff" /></div>
        </div>
      </SlideOver>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus Pengeluaran">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Yakin hapus pengeluaran <span className="font-bold">{deleteTarget?.description}</span> ({formatCurrency(deleteTarget?.amount)})?</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteTarget(null)} className="btn btn-secondary btn-md">Batal</button>
            <button onClick={handleDelete} disabled={deleting} className="btn btn-danger btn-md">{deleting ? 'Menghapus...' : 'Hapus'}</button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
