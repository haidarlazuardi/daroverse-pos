'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/fetch';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  hasPosAccess: boolean;
  employee?: { id: string; name: string; position?: string };
}

const ROLES = [
  { value: 'STAFF', label: 'Staff' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'OWNER', label: 'Owner' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
];

const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN: '#DC2626', OWNER: '#2563EB', MANAGER: '#7C3AED', STAFF: '#374151',
};
const ROLE_BG: Record<string, string> = {
  SUPER_ADMIN: '#FEF2F2', OWNER: '#EFF6FF', MANAGER: '#F5F3FF', STAFF: '#F9FAFB',
};

export default function UsersPage() {
  const [users, setUsers]     = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [editModal, setEditModal]     = useState(false);
  const [editing, setEditing]         = useState<User | null>(null);
  const [form, setForm]       = useState({ email: '', password: '', role: 'STAFF', hasPosAccess: false });
  const [saving, setSaving]   = useState(false);
  const [resetPwModal, setResetPwModal] = useState(false);
  const [newPw, setNewPw]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<any>('/api/users');
      setUsers(Array.isArray(r) ? r : r?.users || []);
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u =>
    !search ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  function openEdit(u: User) {
    setEditing(u);
    setForm({ email: u.email, password: '', role: u.role, hasPosAccess: u.hasPosAccess || false });
    setEditModal(true);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      await api.patch('/api/users', {
        id: editing.id,
        email: form.email,
        role: form.role,
        hasPosAccess: form.hasPosAccess,
        ...(form.password ? { password: form.password } : {}),
      });
      await load();
      setEditModal(false);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: User) {
    if (!confirm(`${u.active ? 'Nonaktifkan' : 'Aktifkan'} akun ${u.name}?`)) return;
    await api.patch('/api/users', { id: u.id, active: !u.active });
    load();
  }

  async function togglePosAccess(u: User) {
    await api.patch('/api/users', { id: u.id, hasPosAccess: !u.hasPosAccess });
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, hasPosAccess: !u.hasPosAccess } : x));
  }

  async function deleteUser(u: User) {
    if (!confirm(`Hapus permanen akun "${u.name}"?\n\nTindakan ini tidak bisa dibatalkan.`)) return;
    try {
      const r = await api.delete<any>(`/api/users?id=${u.id}`);
      if (r?.deactivated) {
        // Punya order penting — tawarkan force delete
        const force = confirm(`⚠️ ${r.reason}\n\nHapus paksa tetap? (data transaksi akan tetap ada)`);
        if (force) {
          await api.delete(`/api/users?id=${u.id}&force=1`);
          setUsers(prev => prev.filter(x => x.id !== u.id));
        } else {
          setUsers(prev => prev.map(x => x.id === u.id ? { ...x, active: false } : x));
        }
      } else {
        setUsers(prev => prev.filter(x => x.id !== u.id));
      }
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function resetPassword() {
    if (!editing || !newPw) return;
    setSaving(true);
    try {
      await api.patch('/api/users', { id: editing.id, password: newPw });
      setResetPwModal(false);
      setNewPw('');
      alert('Password berhasil direset');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-4">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black" style={{ color: 'var(--text-1)' }}>Akun Pengguna</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
              Kelola akun login — data karyawan ada di menu Karyawan
            </p>
          </div>
        </div>

        <div className="rounded-xl p-3 text-sm" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8' }}>
          Untuk tambah akun baru, buka menu <strong>Karyawan</strong> lalu klik Buat Akun
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input w-full"
          placeholder="Cari nama atau email..."
        />

        {loading ? (
          <div className="flex justify-center py-10">
            <div
              className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }}
            />
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(u => (
              <div key={u.id} className="card p-4">
                <div className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0"
                    style={{ background: ROLE_BG[u.role] || '#F9FAFB', color: ROLE_COLOR[u.role] || '#374151' }}
                  >
                    {u.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>{u.name}</p>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: ROLE_BG[u.role], color: ROLE_COLOR[u.role] }}
                      >
                        {ROLES.find(r => r.value === u.role)?.label || u.role}
                      </span>
                      {!u.active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium">
                          Nonaktif
                        </span>
                      )}
                      {u.hasPosAccess && u.role === 'STAFF' && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                          POS
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{u.email}</p>
                    {u.employee && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                        {u.employee.position || 'Karyawan'}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                    {u.role === 'STAFF' && (
                      <button
                        onClick={() => togglePosAccess(u)}
                        className="btn btn-sm text-xs"
                        style={u.hasPosAccess
                          ? { background: '#E1F5EE', color: '#0F6E56', border: '1px solid #9FE1CB' }
                          : { background: 'var(--surface-2)', color: 'var(--text-3)', border: '1px solid var(--border)' }
                        }
                      >
                        POS {u.hasPosAccess ? 'ON' : 'OFF'}
                      </button>
                    )}
                    <button onClick={() => openEdit(u)} className="btn btn-sm btn-secondary text-xs">
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(u)}
                      className="btn btn-sm text-xs"
                      style={u.active
                        ? { background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }
                        : { background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }
                      }
                    >
                      {u.active ? 'Nonaktif' : 'Aktif'}
                    </button>
                    <button
                      onClick={() => deleteUser(u)}
                      title="Hapus permanen"
                      className="btn btn-sm text-xs"
                      style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="card text-center py-10 text-gray-400">
                {search ? `Tidak ada hasil untuk "${search}"` : 'Tidak ada akun'}
              </div>
            )}
          </div>
        )}

      </div>

      {editModal && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <p className="font-black text-base" style={{ color: 'var(--text-1)' }}>Edit Akun — {editing.name}</p>
              <button onClick={() => setEditModal(false)} className="text-gray-400 text-xl hover:text-gray-600">×</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="label">Email</label>
                <input
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className="input w-full mt-1"
                  type="email"
                />
              </div>
              <div>
                <label className="label">Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                  className="select w-full mt-1"
                >
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              {form.role === 'STAFF' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="posAccess"
                    checked={form.hasPosAccess}
                    onChange={e => setForm(p => ({ ...p, hasPosAccess: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="posAccess" className="text-sm" style={{ color: 'var(--text-1)' }}>
                    Akses POS (bisa buka kasir)
                  </label>
                </div>
              )}
              <div className="pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                <button
                  onClick={() => { setResetPwModal(true); setNewPw(''); }}
                  className="text-sm font-medium"
                  style={{ color: 'var(--brand)' }}
                >
                  Reset Password
                </button>
              </div>
            </div>
            <div className="px-5 py-4 border-t flex gap-3" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setEditModal(false)} className="btn btn-secondary flex-1">Batal</button>
              <button onClick={save} disabled={saving} className="btn btn-primary flex-1">
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetPwModal && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="font-black" style={{ color: 'var(--text-1)' }}>Reset Password — {editing.name}</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>Masukkan password baru:</p>
              <input
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                className="input w-full"
                type="text"
                placeholder="Password baru..."
              />
            </div>
            <div className="px-5 py-4 border-t flex gap-3" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setResetPwModal(false)} className="btn btn-secondary flex-1">Batal</button>
              <button onClick={resetPassword} disabled={saving || !newPw} className="btn btn-primary flex-1">
                {saving ? 'Mereset...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}
