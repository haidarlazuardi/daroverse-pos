'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, Button, Modal } from '@/components/ui';
import { SlideOver } from '@/components/ui/SlideOver';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Toolbar } from '@/components/ui/Toolbar';
import { api } from '@/lib/fetch';
import { formatNumber } from '@/components/ui';
import * as XLSX from 'xlsx';

interface PO { id: string; number: string; status: string; plannedYield: number; actualYield: number | null; location: string; notes: string | null; createdAt: string; ingredient: { name: string; unit: string }; }
interface Ingredient { id: string; name: string; unit: string; type: string; }

const STATUS_VARIANT: Record<string, any> = { COMPLETED:'success', CANCELLED:'danger', IN_PROGRESS:'warning', PLANNED:'default' };
const STATUS_LABEL:   Record<string, string> = { COMPLETED:'Selesai', CANCELLED:'Dibatal', IN_PROGRESS:'Proses', PLANNED:'Rencana' };
const LOCATIONS = [{ value:'BAR', label:'Bar' }, { value:'KITCHEN', label:'Dapur' }, { value:'GUDANG', label:'Gudang' }];

export default function ProductionPage() {
  const [orders, setOrders]   = useState<PO[]>([]);
  const [prepped, setPrepped] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [slideOpen, setSlideOpen] = useState(false);
  const [form, setForm]       = useState({ ingredientId:'', batchMultiplier:'1', location:'BAR', actualYield:'', notes:'' });
  const [saving, setSaving]   = useState(false);
  const [editing, setEditing] = useState<PO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PO | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [po, ings] = await Promise.all([
        api.get<any>('/api/production'),
        api.get<Ingredient[]>('/api/ingredients?type=PREPPED'),
      ]);
      setOrders(po.productionOrders || []);
      setPrepped(ings.filter(i => i.type === 'PREPPED'));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm({ ingredientId:'', batchMultiplier:'1', location:'BAR', actualYield:'', notes:'' });
    setSlideOpen(true);
  }

  function openEdit(po: PO) {
    setEditing(po);
    const ing = prepped.find(i => i.name === po.ingredient?.name);
    setForm({
      ingredientId: ing?.id || '',
      batchMultiplier: '1',
      location: po.location,
      actualYield: po.actualYield ? String(po.actualYield) : '',
      notes: po.notes || '',
    });
    setSlideOpen(true);
  }

  async function handleSubmit() {
    if (!form.ingredientId) return;
    setSaving(true);
    try {
      if (editing) {
        // Edit — update location, notes, actualYield
        await api.patch('/api/production', {
          id: editing.id,
          action: 'update',
          location: form.location,
          actualYield: form.actualYield ? parseFloat(form.actualYield) : null,
          notes: form.notes || null,
        });
      } else {
        await api.post('/api/production', {
          ingredientId: form.ingredientId,
          batchMultiplier: parseFloat(form.batchMultiplier) || 1,
          location: form.location,
          actualYield: form.actualYield ? parseFloat(form.actualYield) : undefined,
          notes: form.notes || undefined,
          execute: true,
        });
      }
      setSlideOpen(false);
      setEditing(null);
      setForm({ ingredientId:'', batchMultiplier:'1', location:'BAR', actualYield:'', notes:'' });
      load();
    } catch (e: any) { alert(e.message || 'Gagal'); }
    finally { setSaving(false); }
  }

  async function handleCancel(po: PO) {
    if (!confirm(`Batalkan produksi ${po.number}?`)) return;
    try { await api.patch('/api/production', { id: po.id, action: 'cancel' }); load(); }
    catch (e: any) { alert(e.message || 'Gagal'); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await api.delete(`/api/production?id=${deleteTarget.id}`); setDeleteTarget(null); load(); }
    catch (e: any) { alert(e.message || 'Gagal'); }
    finally { setDeleting(false); }
  }

  function handleExport() {
    const rows = orders.map(o => ({ 'No': o.number, 'Olahan': o.ingredient?.name, 'Lokasi': o.location, 'Rencana': o.plannedYield + ' ' + o.ingredient?.unit, 'Hasil Aktual': o.actualYield ? o.actualYield + ' ' + o.ingredient?.unit : '—', 'Status': STATUS_LABEL[o.status]||o.status, 'Tanggal': new Date(o.createdAt).toLocaleDateString('id-ID'), 'Catatan': o.notes||'' }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Produksi');
    XLSX.writeFile(wb, 'produksi-soeka.xlsx');
  }

  const filtered = orders.filter(o => {
    const matchSearch = !search || o.ingredient?.name?.toLowerCase().includes(search.toLowerCase()) || o.number.includes(search);
    const matchStatus = !filterStatus || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const columns: Column<PO>[] = [
    { key:'number',    label:'No', render: o => <span className="font-mono text-xs text-gray-400">{o.number}</span> },
    { key:'ingredient',label:'Olahan', sortable:true, render: o => <span className="font-semibold text-gray-900">{o.ingredient?.name}</span> },
    { key:'location',  label:'Lokasi', render: o => <Badge variant="info">{o.location}</Badge> },
    { key:'plannedYield', label:'Rencana', sortable:true, render: o => <span className="text-gray-700">{formatNumber(o.plannedYield)} {o.ingredient?.unit}</span> },
    { key:'actualYield',  label:'Hasil', render: o => <span className={o.actualYield ? 'font-semibold text-gray-900' : 'text-gray-300'}>{o.actualYield ? `${formatNumber(o.actualYield)} ${o.ingredient?.unit}` : '—'}</span> },
    { key:'status',    label:'Status', render: o => <Badge variant={STATUS_VARIANT[o.status]}>{STATUS_LABEL[o.status]||o.status}</Badge> },
    { key:'createdAt', label:'Tanggal', sortable:true, render: o => <span className="text-gray-400 text-xs">{new Date(o.createdAt).toLocaleDateString('id-ID')}</span> },
  ];

  const selectedIng = prepped.find(i => i.id === form.ingredientId);

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <div className="page-header">
          <div><h1 className="page-title">Produksi</h1><p className="page-subtitle">Racik stok olahan dari bahan mentah</p></div>
        </div>

        <Toolbar
          search={search} onSearch={setSearch} searchPlaceholder="Cari nama olahan atau no produksi..."
          filters={[{ key:'status', label:'Status', value:filterStatus, onChange:setFilterStatus, options:[{value:'PLANNED',label:'Rencana'},{value:'IN_PROGRESS',label:'Proses'},{value:'COMPLETED',label:'Selesai'},{value:'CANCELLED',label:'Dibatal'}] }]}
          onExport={handleExport} onAdd={openAdd} addLabel="Bikin Batch"
        />

        <DataTable data={filtered} columns={columns} keyField="id" loading={loading} emptyMessage="Belum ada produksi"
          rowActions={o => (
            <div className="flex gap-1">
              <button onClick={() => openEdit(o)} className="p-1.5 hover:bg-brand-50 rounded-lg text-gray-400 hover:text-brand-600" title="Edit">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              {o.status === 'PLANNED' && (
                <button onClick={() => handleCancel(o)} className="p-1.5 hover:bg-orange-50 rounded-lg text-gray-400 hover:text-orange-500" title="Batalkan">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                </button>
              )}
              <button onClick={() => setDeleteTarget(o)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500" title="Hapus">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              </button>
            </div>
          )}
        />
      </div>

      <SlideOver open={slideOpen} onClose={() => { setSlideOpen(false); setEditing(null); }} title={editing ? `Edit Produksi ${editing.number}` : 'Bikin Batch Produksi'}
        footer={<div className="flex justify-end gap-3"><button onClick={() => { setSlideOpen(false); setEditing(null); }} className="btn btn-secondary btn-md">Batal</button><Button onClick={handleSubmit} disabled={saving || (!editing && !form.ingredientId)}>{saving ? 'Memproses...' : editing ? 'Simpan Perubahan' : 'Bikin & Potong Stok'}</Button></div>}>
        <div className="space-y-4">
          <div><label className="label">Olahan *</label>
            <select className="select" value={form.ingredientId} onChange={e => f('ingredientId',e.target.value)}>
              <option value="">Pilih olahan</option>
              {prepped.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select></div>
          <div><label className="label">Jumlah Batch</label>
            <input className="input" type="number" min="0.5" step="0.5" value={form.batchMultiplier} onChange={e => f('batchMultiplier',e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">1 batch = 1 resep standar. Isi 2 untuk bikin 2x</p></div>
          <div><label className="label">Lokasi Hasil</label>
            <select className="select" value={form.location} onChange={e => f('location',e.target.value)}>
              {LOCATIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select></div>
          <div><label className="label">Hasil Aktual ({selectedIng?.unit || 'unit'}) — Opsional</label>
            <input className="input" type="number" value={form.actualYield} onChange={e => f('actualYield',e.target.value)} placeholder="Kosongkan = sesuai rencana" /></div>
          <div><label className="label">Catatan</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => f('notes',e.target.value)} placeholder="Opsional" /></div>
        </div>
      </SlideOver>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus Produksi">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Hapus record produksi <span className="font-bold">{deleteTarget?.number}</span>?</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteTarget(null)} className="btn btn-secondary btn-md">Batal</button>
            <button onClick={handleDelete} disabled={deleting} className="btn btn-danger btn-md">{deleting ? 'Menghapus...' : 'Hapus'}</button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
