'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, Button } from '@/components/ui';
import { DataTable, Column } from '@/components/ui/DataTable';
import { SlideOver } from '@/components/ui/SlideOver';
import { Toolbar } from '@/components/ui/Toolbar';
import { api } from '@/lib/fetch';
import * as XLSX from 'xlsx';

interface Supplier {
  id: string; name: string; contactPerson: string | null;
  phone: string | null; email: string | null; address: string | null;
  active: boolean; _count: { purchaseOrders: number };
}

const emptyForm = { name: '', contactPerson: '', phone: '', email: '', address: '' };

export default function SuppliersPage() {
  const [data, setData]       = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm]       = useState(emptyForm);
  const [saving, setSaving]   = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      setData(await api.get<Supplier[]>(`/api/suppliers${params}`));
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  function openAdd()  { setEditing(null); setForm(emptyForm); setFormError(''); setSlideOpen(true); }
  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({ name: s.name, contactPerson: s.contactPerson ?? '', phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '' });
    setFormError(''); setSlideOpen(true);
  }
  function closeSlide() { setSlideOpen(false); setEditing(null); setFormError(''); }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('Nama supplier wajib diisi'); return; }
    setSaving(true); setFormError('');
    try {
      if (editing) await api.patch('/api/suppliers', { id: editing.id, ...form });
      else         await api.post('/api/suppliers', form);
      closeSlide(); load();
    } catch (e: any) { setFormError(e?.message || 'Gagal menyimpan'); }
    finally { setSaving(false); }
  }

  async function handleDelete(s: Supplier) {
    if (s._count.purchaseOrders > 0) { alert(`Supplier "${s.name}" masih memiliki ${s._count.purchaseOrders} PO.`); return; }
    if (!confirm(`Nonaktifkan supplier "${s.name}"?`)) return;
    try { await api.delete('/api/suppliers', { id: s.id }); load(); }
    catch (e: any) { alert(e?.message || 'Gagal'); }
  }

  function handleExport() {
    const rows = data.map(s => ({ id: s.id, name: s.name, contact_person: s.contactPerson ?? '', phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '', po_count: s._count.purchaseOrders }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Suppliers');
    XLSX.writeFile(wb, 'suppliers-export.xlsx');
  }

  function handleDownloadTemplate() {
    const rows = [{ name: 'Nama Supplier', contact_person: 'Nama PIC', phone: '08xx', email: 'email@supplier.com', address: 'Alamat' }];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Suppliers');
    XLSX.writeFile(wb, 'suppliers-template.xlsx');
  }

  async function handleImport(file: File) {
    try {
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf);
      const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]]);
      if (!rows.length) { alert('File kosong'); return; }
      let ok = 0; const errors: string[] = [];
      for (const [i, row] of rows.entries()) {
        if (!row.name) { errors.push(`Baris ${i+2}: name wajib`); continue; }
        try { await api.post('/api/suppliers', { name: String(row.name).trim(), contactPerson: row.contact_person || null, phone: row.phone || null, email: row.email || null, address: row.address || null }); ok++; }
        catch (e: any) { errors.push(`Baris ${i+2} "${row.name}": ${e?.message}`); }
      }
      alert(`Import selesai: ${ok} berhasil${errors.length ? `\n\nGagal:\n${errors.join('\n')}` : ''}`);
      load();
    } catch { alert('Gagal membaca file'); }
  }

  const columns: Column<Supplier>[] = [
    {
      key: 'name', label: 'Nama', sortable: true,
      render: s => <span className="font-medium text-gray-900">{s.name}</span>,
    },
    {
      key: 'contactPerson', label: 'PIC', sortable: true,
      render: s => <span className="text-gray-600">{s.contactPerson || '—'}</span>,
    },
    {
      key: 'phone', label: 'Telepon',
      render: s => s.phone ? <a href={`tel:${s.phone}`} className="text-brand-600 hover:underline">{s.phone}</a> : <span className="text-gray-400">—</span>,
    },
    {
      key: 'email', label: 'Email',
      render: s => s.email ? <a href={`mailto:${s.email}`} className="text-brand-600 hover:underline text-sm">{s.email}</a> : <span className="text-gray-400">—</span>,
    },
    {
      key: 'orders', label: 'PO', width: 'w-20', sortable: true,
      render: s => <Badge variant={s._count.purchaseOrders > 0 ? 'success' : 'default'}>{s._count.purchaseOrders}</Badge>,
    },
  ];

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Supplier</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola daftar pemasok bahan baku</p>
        </div>

        <Toolbar
          search={search} onSearch={setSearch} searchPlaceholder="Cari supplier..."
          onAdd={openAdd} addLabel="Supplier Baru"
          onExport={handleExport} onDownloadTemplate={handleDownloadTemplate} onImport={handleImport}
          selected={selected}
        />

        <DataTable
          data={data} columns={columns} keyField="id" loading={loading}
          emptyMessage="Belum ada supplier. Klik 'Supplier Baru' untuk menambah."
          selected={selected} onSelectChange={setSelected}
          rowActions={s => (
            <>
              <button onClick={() => openEdit(s)} title="Edit"
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button onClick={() => handleDelete(s)} title="Nonaktifkan"
                className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
              </button>
            </>
          )}
        />
      </div>

      <SlideOver open={slideOpen} onClose={closeSlide} title={editing ? 'Edit Supplier' : 'Supplier Baru'} subtitle={editing ? editing.name : undefined}
        footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={closeSlide} disabled={saving}>Batal</Button><Button onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : editing ? 'Simpan' : 'Buat Supplier'}</Button></div>}
      >
        {formError && <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{formError}</div>}
        <div>
          <label className="label">Nama Supplier <span className="text-red-400">*</span></label>
          <input className="input w-full" placeholder="cth. PT Sumber Bahan" value={form.name} autoFocus onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Nama PIC</label>
          <input className="input w-full" placeholder="cth. Budi Santoso" value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">No. Telepon</label>
            <input className="input w-full" type="tel" placeholder="08xx" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input w-full" type="email" placeholder="email@supplier.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Alamat</label>
          <textarea className="input w-full" rows={3} placeholder="Alamat lengkap supplier" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
        </div>
      </SlideOver>
    </AdminLayout>
  );
}
