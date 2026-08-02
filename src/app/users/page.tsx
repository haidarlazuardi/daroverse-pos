'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, Button, Modal } from '@/components/ui';
import { SlideOver } from '@/components/ui/SlideOver';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Toolbar } from '@/components/ui/Toolbar';
import { api } from '@/lib/fetch';
import * as XLSX from 'xlsx';

interface User { id: string; name: string; email: string; role: string; active: boolean; createdAt: string; }

const ROLES = [
  { value:'STAFF',     label:'Kasir' },
  { value:'STAFF',    label:'Staff' },
  { value:'INVENTORY',   label:'Inventory' },
  { value:'MANAGER',     label:'Manager' },
  { value:'OWNER',       label:'Owner' },
  { value:'SUPER_ADMIN', label:'Super Admin' },
];
const ROLE_LABEL: Record<string,string> = { SUPER_ADMIN:'Super Admin', OWNER:'Owner', MANAGER:'Manager', STAFF:'Staff', KITCHEN:'Dapur', INVENTORY:'Inventory' };
const ROLE_VARIANT: Record<string,any> = { SUPER_ADMIN:'danger', OWNER:'info', MANAGER:'success', STAFF:'default', KITCHEN:'warning', INVENTORY:'default' };
const EMPTY_FORM = { name:'', email:'', password:'', role:'STAFF' };

export default function UsersPage() {
  const [users, setUsers]     = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm]       = useState({ ...EMPTY_FORM });
  const [saving, setSaving]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setUsers(await api.get<User[]>('/api/users')); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setForm({ ...EMPTY_FORM }); setSlideOpen(true); }
  function openEdit(u: User) {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role });
    setSlideOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.email) return;
    if (!editing && !form.password) { alert('Password wajib diisi untuk user baru'); return; }
    setSaving(true);
    try {
      if (editing) {
        const payload: any = { id: editing.id, name: form.name, email: form.email, role: form.role };
        if (form.password) payload.password = form.password;
        await api.patch('/api/users', payload);
      } else {
        await api.post('/api/users', form);
      }
      setSlideOpen(false); load();
    } catch (e: any) { alert(e.message || 'Gagal'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await api.delete(`/api/users?id=${deleteTarget.id}`); setDeleteTarget(null); load(); }
    catch (e: any) { alert(e.message || 'Gagal'); }
    finally { setDeleting(false); }
  }

  async function togglePosAccess(u: any) {
    try {
      await api.patch('/api/users', { id: u.id, hasPosAccess: !u.hasPosAccess });
      setUsers((prev: any[]) => prev.map(x => x.id === u.id ? { ...x, hasPosAccess: !u.hasPosAccess } : x));
    } catch(e: any) { alert(e.message); }
  }

  async function toggleActive(u: User) {
    try { await api.patch('/api/users', { id: u.id, active: !u.active }); load(); }
    catch (e) { console.error(e); }
  }

  function handleExport() {
    const rows = users.map(u => ({ Nama: u.name, Email: u.email, Role: ROLE_LABEL[u.role]||u.role, Status: u.active ? 'Aktif' : 'Nonaktif', 'Bergabung': new Date(u.createdAt).toLocaleDateString('id-ID') }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Users');
    XLSX.writeFile(wb, 'users-soeka.xlsx');
  }

  const filtered = users.filter(u => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole   = !filterRole || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const columns: Column<User>[] = [
    { key:'name', label:'Staff', sortable:true, render: u => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm flex-shrink-0">{u.name.charAt(0).toUpperCase()}</div>
        <div><p className="font-semibold text-gray-900">{u.name}</p><p className="text-xs text-gray-400">{u.email}</p></div>
      </div>
    )},
    { key:'role', label:'Role', render: u => <Badge variant={ROLE_VARIANT[u.role]}>{ROLE_LABEL[u.role]||u.role}</Badge> },
    { key:'active', label:'Status', render: u => <Badge variant={u.active ? 'success' : 'danger'}>{u.active ? 'Aktif' : 'Nonaktif'}</Badge> },
    { key:'createdAt', label:'Bergabung', sortable:true, render: u => <span className="text-gray-400 text-sm">{new Date(u.createdAt).toLocaleDateString('id-ID')}</span> },
  ];

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto">
        <div className="page-header">
          <div><h1 className="page-title">Pengguna</h1><p className="page-subtitle">Kelola akun staff dan hak akses</p></div>
          <div className="flex items-center gap-2">
            <span className="badge badge-default">{users.filter(u=>u.active).length} aktif</span>
          </div>
        </div>

        <Toolbar
          search={search} onSearch={setSearch} searchPlaceholder="Cari nama atau email..."
          filters={[{ key:'role', label:'Role', value:filterRole, onChange:setFilterRole, options: ROLES }]}
          onExport={handleExport} onAdd={openAdd} addLabel="Tambah User"
        />

        <DataTable data={filtered} columns={columns} keyField="id" loading={loading} emptyMessage="Belum ada pengguna"
          rowActions={u => (
            <div className="flex gap-1">
              {(u as any).role === 'STAFF' && (
                <button onClick={() => togglePosAccess(u)}
                  title={(u as any).hasPosAccess ? 'Cabut akses POS' : 'Beri akses POS'}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-colors ${(u as any).hasPosAccess ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-500'}`}>
                  POS
                </button>
              )}
              <button onClick={() => toggleActive(u)} title={u.active ? 'Nonaktifkan' : 'Aktifkan'}
                className={`p-1.5 rounded-lg text-gray-400 transition-colors ${u.active ? 'hover:bg-red-50 hover:text-red-500' : 'hover:bg-emerald-50 hover:text-emerald-600'}`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  {u.active ? <><path d="M18.36 6.64a9 9 0 11-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></> : <polyline points="20 6 9 17 4 12"/>}
                </svg>
              </button>
              <button onClick={() => openEdit(u)} className="p-1.5 hover:bg-brand-50 rounded-lg text-gray-400 hover:text-brand-600">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button onClick={() => setDeleteTarget(u)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              </button>
            </div>
          )}
        />
      </div>

      <SlideOver open={slideOpen} onClose={() => setSlideOpen(false)}
        title={editing ? `Edit: ${editing.name}` : 'Tambah User'}
        footer={<div className="flex justify-end gap-3"><button onClick={() => setSlideOpen(false)} className="btn btn-secondary btn-md">Batal</button><Button onClick={handleSave} disabled={saving||!form.name||!form.email}>{saving ? 'Menyimpan...' : 'Simpan'}</Button></div>}>
        <div className="space-y-4">
          <div><label className="label">Nama Lengkap *</label><input className="input" value={form.name} onChange={e => f('name',e.target.value)} placeholder="cth. Budi Santoso" /></div>
          <div><label className="label">Email *</label><input className="input" type="email" value={form.email} onChange={e => f('email',e.target.value)} placeholder="budi@soeka.id" /></div>
          <div><label className="label">{editing ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password *'}</label><input className="input" type="password" value={form.password} onChange={e => f('password',e.target.value)} placeholder="••••••••" /></div>
          <div><label className="label">Role *</label>
            <select className="select" value={form.role} onChange={e => f('role',e.target.value)}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {form.role === 'STAFF' ? 'Hanya bisa akses POS' :
               form.role === 'STAFF' ? 'Akses Staff Hub + Logbook' :
               form.role === 'INVENTORY' ? 'Akses POS + Stok & Transfer' :
               form.role === 'MANAGER' ? 'Semua akses kecuali Settings' :
               'Akses penuh ke semua fitur'}
            </p>
          </div>
        </div>
      </SlideOver>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus Pengguna">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Yakin hapus akun <span className="font-bold">{deleteTarget?.name}</span>? Data transaksi yang dibuat user ini tetap tersimpan.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteTarget(null)} className="btn btn-secondary btn-md">Batal</button>
            <button onClick={handleDelete} disabled={deleting} className="btn btn-danger btn-md">{deleting ? 'Menghapus...' : 'Hapus'}</button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
