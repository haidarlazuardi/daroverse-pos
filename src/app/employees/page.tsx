'use client';
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/fetch';
import { Button, Modal } from '@/components/ui';

const EMP_TYPES = [
  { value: 'HELPER',  label: 'Helper',  rate: 50000, desc: 'Rp 50.000/hari' },
  { value: 'STAFF',   label: 'Staff Kitchen/Bar', rate: 60000, desc: 'Rp 60.000/hari' },
  { value: 'MANAGER', label: 'Manager', rate: 0,     desc: 'Rate custom' },
];
const EMP_COLOR: Record<string, string> = { HELPER: '#f59e0b', STAFF: '#3b82f6', MANAGER: '#8b5cf6' };

const EMPTY: any = {
  name: '', email: '', password: '', role: 'STAFF',
  employeeType: 'STAFF', dailyRate: 60000,
  bankName: '', bankAccount: '', bankAccountName: '',
  joinDate: new Date().toISOString().slice(0,10),
  active: true,
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [open, setOpen]           = useState(false);
  const [editing, setEditing]     = useState<any>(null);
  const [form, setForm]           = useState({ ...EMPTY });
  const [saving, setSaving]       = useState(false);
  const [tab, setTab]             = useState<'active'|'inactive'>('active');

  async function load() {
    const users = await api.get<any[]>('/api/users');
    // Filter hanya yang punya employeeType
    setEmployees((users || []).filter((u: any) => u.employeeType));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY, password: '' });
    setOpen(true);
  }

  function openEdit(u: any) {
    setEditing(u);
    setForm({
      name: u.name, email: u.email, password: '',
      role: u.role, employeeType: u.employeeType || 'STAFF',
      dailyRate: u.dailyRate || 60000,
      bankName: u.bankName || '', bankAccount: u.bankAccount || '',
      bankAccountName: u.bankAccountName || '',
      joinDate: u.joinDate ? u.joinDate.slice(0,10) : new Date().toISOString().slice(0,10),
      active: u.active,
    });
    setOpen(true);
  }

  const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const payload: any = {
        name: form.name, email: form.email, role: form.role,
        employeeType: form.employeeType,
        dailyRate: parseFloat(String(form.dailyRate)) || 0,
        bankName: form.bankName || null,
        bankAccount: form.bankAccount || null,
        bankAccountName: form.bankAccountName || null,
        joinDate: form.joinDate || null,
        active: form.active,
      };
      if (form.password) payload.password = form.password;
      if (editing) {
        payload.id = editing.id;
        await api.patch('/api/users', payload);
      } else {
        if (!form.password) { alert('Password wajib untuk karyawan baru'); setSaving(false); return; }
        await api.post('/api/users', payload);
      }
      setOpen(false);
      load();
    } catch(e: any) { alert(e.message || 'Gagal'); }
    finally { setSaving(false); }
  }

  const filtered = employees.filter(e => tab === 'active' ? e.active : !e.active);

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black" style={{ color: 'var(--text-1)' }}>Data Karyawan</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Karyawan operasional Soeka House</p>
          </div>
          <button onClick={openAdd} className="btn btn-primary btn-md">+ Tambah Karyawan</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--surface-2)' }}>
          {(['active','inactive'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={tab === t ? { background: 'white', color: 'var(--text-1)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: 'var(--text-3)' }}>
              {t === 'active' ? `Aktif (${employees.filter(e=>e.active).length})` : `Nonaktif (${employees.filter(e=>!e.active).length})`}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          {EMP_TYPES.map(et => {
            const count = employees.filter(e => e.active && e.employeeType === et.value).length;
            return (
              <div key={et.value} className="card p-3 text-center">
                <p className="text-2xl font-black" style={{ color: EMP_COLOR[et.value] }}>{count}</p>
                <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-2)' }}>{et.label}</p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>{et.desc}</p>
              </div>
            );
          })}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }}/>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-3xl mb-2">👤</p>
            <p style={{ color: 'var(--text-3)' }}>Belum ada karyawan {tab === 'active' ? 'aktif' : 'nonaktif'}</p>
            {tab === 'active' && <button onClick={openAdd} className="btn btn-primary btn-sm mt-4 mx-auto">+ Tambah Karyawan</button>}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(emp => (
              <div key={emp.id} className="card p-4 flex items-center gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-black text-lg text-white flex-shrink-0"
                  style={{ background: EMP_COLOR[emp.employeeType] || 'var(--brand)' }}>
                  {emp.name.charAt(0).toUpperCase()}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-bold" style={{ color: 'var(--text-1)' }}>{emp.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: `${EMP_COLOR[emp.employeeType]||'#6b7280'}18`, color: EMP_COLOR[emp.employeeType]||'#6b7280' }}>
                      {EMP_TYPES.find(e=>e.value===emp.employeeType)?.label || emp.employeeType}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>Rp {Number(emp.dailyRate||0).toLocaleString('id-ID')}/hari</p>
                    {emp.bankAccount && <p className="text-xs" style={{ color: 'var(--text-3)' }}>{emp.bankName} · {emp.bankAccount}</p>}
                    {emp.joinDate && <p className="text-xs" style={{ color: 'var(--text-3)' }}>Masuk: {new Date(emp.joinDate).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</p>}
                  </div>
                </div>
                {/* Actions */}
                <button onClick={() => openEdit(emp)}
                  className="btn btn-secondary btn-sm flex-shrink-0">Edit</button>
              </div>
            ))}
          </div>
        )}

        {/* Form Modal */}
        <Modal open={open} onClose={() => setOpen(false)}
          title={editing ? `Edit — ${editing.name}` : 'Tambah Karyawan Baru'}>
          <div className="space-y-4">
            {/* Basic info */}
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Informasi Dasar</p>
              <div>
                <label className="label">Nama Lengkap *</label>
                <input className="input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="cth. Budi Santoso"/>
              </div>
              <div>
                <label className="label">Email * (untuk login)</label>
                <input className="input" type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="budi@soeka.house"/>
              </div>
              <div>
                <label className="label">{editing ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password *'}</label>
                <input className="input" type="password" value={form.password} onChange={e => f('password', e.target.value)} placeholder={editing ? '(kosongkan jika tidak diubah)' : 'min 6 karakter'}/>
              </div>
              <div>
                <label className="label">Tanggal Bergabung</label>
                <input className="input" type="date" value={form.joinDate} onChange={e => f('joinDate', e.target.value)}/>
              </div>
            </div>

            {/* Employee type */}
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Tipe Karyawan & Gaji</p>
              <div className="grid grid-cols-3 gap-2">
                {EMP_TYPES.map(et => (
                  <button key={et.value} onClick={() => {
                    f('employeeType', et.value);
                    if (et.rate > 0) f('dailyRate', et.rate);
                    f('role', et.value === 'MANAGER' ? 'MANAGER' : 'STAFF');
                  }}
                    className="py-3 px-2 rounded-xl border-2 text-center transition-all"
                    style={{ borderColor: form.employeeType === et.value ? EMP_COLOR[et.value] : 'var(--border)', background: form.employeeType === et.value ? `${EMP_COLOR[et.value]}10` : 'white' }}>
                    <p className="text-xs font-bold" style={{ color: form.employeeType === et.value ? EMP_COLOR[et.value] : 'var(--text-2)' }}>{et.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{et.desc}</p>
                  </button>
                ))}
              </div>
              <div>
                <label className="label">Rate Harian (Rp)</label>
                <input className="input" type="number" value={form.dailyRate} onChange={e => f('dailyRate', e.target.value)}/>
                <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Bisa diubah untuk rate custom (part-time, dll)</p>
              </div>
            </div>

            {/* Bank info */}
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Info Rekening (untuk transfer gaji)</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Bank</label>
                  <input className="input" value={form.bankName} onChange={e => f('bankName', e.target.value)} placeholder="BCA, BRI, dll"/>
                </div>
                <div>
                  <label className="label">No. Rekening</label>
                  <input className="input" value={form.bankAccount} onChange={e => f('bankAccount', e.target.value)} placeholder="1234567890"/>
                </div>
              </div>
              <div>
                <label className="label">Atas Nama</label>
                <input className="input" value={form.bankAccountName} onChange={e => f('bankAccountName', e.target.value)} placeholder="Nama sesuai buku tabungan"/>
              </div>
            </div>

            {/* Status */}
            {editing && (
              <div className="flex items-center gap-3">
                <label className="label mb-0">Status</label>
                <button onClick={() => f('active', !form.active)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all"
                  style={{ borderColor: form.active ? '#16a34a' : '#dc2626', color: form.active ? '#16a34a' : '#dc2626', background: form.active ? '#f0fdf4' : '#fef2f2' }}>
                  {form.active ? '✓ Aktif' : '✗ Nonaktif'}
                </button>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={() => setOpen(false)} className="btn btn-secondary btn-md flex-1">Batal</button>
              <Button onClick={save} disabled={saving || !form.name || !form.email} className="flex-1">
                {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Tambah Karyawan'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
