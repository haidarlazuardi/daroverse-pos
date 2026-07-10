'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, Button, Modal, StatCard, formatCurrency } from '@/components/ui';
import { SlideOver } from '@/components/ui/SlideOver';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Toolbar } from '@/components/ui/Toolbar';
import { api } from '@/lib/fetch';
import * as XLSX from 'xlsx';

const CATS = ['Peralatan Dapur','Elektronik','Furnitur','Peralatan Bar','Kebersihan','Lainnya'];
const CONDS = [{ value:'GOOD',label:'Baik' },{ value:'FAIR',label:'Cukup' },{ value:'POOR',label:'Buruk' },{ value:'BROKEN',label:'Rusak' }];
const EMPTY = { name:'', code:'', category:'Peralatan Dapur', condition:'GOOD', purchaseDate:'', purchasePrice:'', location:'', supplier:'', notes:'' };
const condVariant: Record<string, any> = { GOOD:'success', FAIR:'warning', POOR:'danger', BROKEN:'danger', DISPOSED:'default' };
const condLabel:   Record<string, string> = { GOOD:'Baik', FAIR:'Cukup', POOR:'Buruk', BROKEN:'Rusak', DISPOSED:'Disposed' };

export default function AssetsPage() {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterCond, setFilterCond] = useState('');
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm]       = useState({ ...EMPTY });
  const [saving, setSaving]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/assets?';
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (filterCat) url += `category=${encodeURIComponent(filterCat)}&`;
      setData(await api.get(url));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, filterCat]);

  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setForm({ ...EMPTY }); setSlideOpen(true); }
  function openEdit(a: any) {
    setEditing(a);
    setForm({ name: a.name, code: a.code||'', category: a.category, condition: a.condition, purchaseDate: a.purchaseDate?.slice(0,10)||'', purchasePrice: a.purchasePrice ? String(a.purchasePrice) : '', location: a.location||'', supplier: a.supplier||'', notes: a.notes||'' });
    setSlideOpen(true);
  }

  async function handleSave() {
    if (!form.name) return;
    setSaving(true);
    try {
      const payload = { ...form, purchasePrice: form.purchasePrice ? parseFloat(form.purchasePrice) : undefined, currentValue: form.purchasePrice ? parseFloat(form.purchasePrice) : undefined };
      if (editing) await api.patch('/api/assets', { id: editing.id, ...payload });
      else await api.post('/api/assets', payload);
      setSlideOpen(false); load();
    } catch (e: any) { alert(e.message || 'Gagal'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await api.delete(`/api/assets?id=${deleteTarget.id}`); setDeleteTarget(null); load(); }
    catch (e: any) { alert(e.message || 'Gagal'); }
    finally { setDeleting(false); }
  }

  function handleExport() {
    const rows = (data?.assets || []).map((a: any) => ({ Nama: a.name, Kode: a.code||'', Kategori: a.category, Kondisi: condLabel[a.condition]||a.condition, Lokasi: a.location||'', 'Harga Beli': a.purchasePrice||'', 'Nilai Sekarang': a.currentValue||'', 'Tgl Beli': a.purchaseDate?.slice(0,10)||'', Supplier: a.supplier||'', Catatan: a.notes||'' }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Assets');
    XLSX.writeFile(wb, 'assets-soeka.xlsx');
  }

  const assets = (data?.assets || []).filter((a: any) => !filterCond || a.condition === filterCond);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const columns: Column<any>[] = [
    { key:'name', label:'Aset', sortable:true, render: a => <div><p className="font-semibold text-gray-900">{a.name}</p>{a.code && <p className="text-xs text-gray-400">{a.code}</p>}</div> },
    { key:'category', label:'Kategori', render: a => <span className="text-gray-600 text-sm">{a.category}</span> },
    { key:'location', label:'Lokasi', render: a => <span className="text-gray-500 text-sm">{a.location||'—'}</span> },
    { key:'condition', label:'Kondisi', render: a => <Badge variant={condVariant[a.condition]}>{condLabel[a.condition]||a.condition}</Badge> },
    { key:'currentValue', label:'Nilai', sortable:true, render: a => <span className="font-semibold text-gray-900">{a.currentValue ? formatCurrency(a.currentValue) : '—'}</span> },
    { key:'purchaseDate', label:'Tgl Beli', render: a => <span className="text-gray-400 text-sm">{a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString('id-ID') : '—'}</span> },
  ];

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <div className="page-header">
          <div><h1 className="page-title">Aset</h1><p className="page-subtitle">Kelola peralatan dan inventaris kafe</p></div>
        </div>

        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatCard label="Total Aset" value={String(data.assets?.length || 0)} />
            <StatCard label="Total Nilai" value={formatCurrency(data.totalValue || 0)} />
            {Object.entries(data.byCategory as Record<string,any>||{}).slice(0,2).map(([cat, info]: any) => (
              <StatCard key={cat} label={cat} value={`${info.count} item`} sub={formatCurrency(info.value)} />
            ))}
          </div>
        )}

        <Toolbar
          search={search} onSearch={setSearch} searchPlaceholder="Cari nama aset..."
          filters={[
            { key:'cat', label:'Kategori', value:filterCat, onChange:setFilterCat, options: CATS.map(c=>({value:c,label:c})) },
            { key:'cond', label:'Kondisi', value:filterCond, onChange:setFilterCond, options: CONDS },
          ]}
          onExport={handleExport} onAdd={openAdd} addLabel="Tambah Aset"
        />

        <DataTable data={assets} columns={columns} keyField="id" loading={loading} emptyMessage="Belum ada aset tercatat"
          rowActions={a => (
            <div className="flex gap-1">
              <button onClick={() => openEdit(a)} className="p-1.5 hover:bg-brand-50 rounded-lg text-gray-400 hover:text-brand-600">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button onClick={() => setDeleteTarget(a)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              </button>
            </div>
          )}
        />
      </div>

      <SlideOver open={slideOpen} onClose={() => setSlideOpen(false)} title={editing ? 'Edit Aset' : 'Tambah Aset'} width="lg"
        footer={<div className="flex justify-end gap-3"><button onClick={() => setSlideOpen(false)} className="btn btn-secondary btn-md">Batal</button><Button onClick={handleSave} disabled={saving||!form.name}>{saving ? 'Menyimpan...' : 'Simpan'}</Button></div>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Nama Aset *</label><input className="input" value={form.name} onChange={e => f('name',e.target.value)} placeholder="cth. Blender Philips" /></div>
            <div><label className="label">Kode Aset</label><input className="input" value={form.code} onChange={e => f('code',e.target.value)} placeholder="cth. EQ-001" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Kategori</label><select className="select" value={form.category} onChange={e => f('category',e.target.value)}>{CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="label">Kondisi</label><select className="select" value={form.condition} onChange={e => f('condition',e.target.value)}>{CONDS.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Tanggal Beli</label><input className="input" type="date" value={form.purchaseDate} onChange={e => f('purchaseDate',e.target.value)} /></div>
            <div><label className="label">Harga Beli (Rp)</label><input className="input" type="number" value={form.purchasePrice} onChange={e => f('purchasePrice',e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Lokasi</label><input className="input" value={form.location} onChange={e => f('location',e.target.value)} placeholder="cth. Dapur, Bar" /></div>
            <div><label className="label">Supplier</label><input className="input" value={form.supplier} onChange={e => f('supplier',e.target.value)} /></div>
          </div>
          <div><label className="label">Catatan</label><textarea className="input" rows={2} value={form.notes} onChange={e => f('notes',e.target.value)} /></div>
        </div>
      </SlideOver>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus Aset">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Yakin hapus aset <span className="font-bold">{deleteTarget?.name}</span>?</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteTarget(null)} className="btn btn-secondary btn-md">Batal</button>
            <button onClick={handleDelete} disabled={deleting} className="btn btn-danger btn-md">{deleting ? 'Menghapus...' : 'Hapus'}</button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
