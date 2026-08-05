'use client';
import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/fetch';



function Modal({ open, onClose, title, children }: { open:boolean; onClose:()=>void; title?:string; children:React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor:'var(--border)' }}>
            <p className="font-black text-base" style={{ color:'var(--text-1)' }}>{title}</p>
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600" style={{ background:'var(--surface-2)' }}>✕</button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

const EMP_TYPES = [
  { value: 'HELPER',  label: 'Helper',        color: '#D97706', bg: '#FFFBEB' },
  { value: 'STAFF',   label: 'Staff',         color: '#2563EB', bg: '#EFF6FF' },
  { value: 'MANAGER', label: 'Manager',       color: '#7C3AED', bg: '#F5F3FF' },
];
const POSITIONS = ['Barista','Helper','Kitchen','Kitchen Helper','Barista Helper','Manager','Kasir'];
const BANKS = ['BCA','Mandiri','BNI','BRI','BSI','OCBC','Jago','SeaBank','Dana','GoPay','OVO','Lainnya'];

const EMPTY = {
  name:'', nik:'', phone:'', address:'',
  position:'', employeeType:'STAFF',
  joinDate: new Date().toISOString().slice(0,10),
  dailyRate: 0, serviceChargeEligible: true,
  bankName:'', bankAccount:'', bankAccountName:'',
  emergencyContact:'', emergencyPhone:'', notes:'',
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<'active'|'inactive'>('active');
  const [search, setSearch]       = useState('');

  const [formOpen, setFormOpen]   = useState(false);
  const [editing, setEditing]     = useState<any>(null);
  const [form, setForm]           = useState<any>({ ...EMPTY });
  const [saving, setSaving]       = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail]         = useState<any>(null);

  const [accountModal, setAccountModal] = useState(false);
  const [accEmail, setAccEmail]   = useState('');
  const [accPass, setAccPass]     = useState('soeka2024');
  const [accRole, setAccRole]     = useState('STAFF');
  const [accSaving, setAccSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<any[]>('/api/employees');
      setEmployees(Array.isArray(r) ? r : []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = employees
    .filter(e => tab === 'active' ? e.active : !e.active)
    .filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.position?.toLowerCase().includes(search.toLowerCase()));

  function openAdd() { setEditing(null); setForm({ ...EMPTY }); setFormOpen(true); }
  function openEdit(emp: any) {
    setEditing(emp);
    setForm({
      name: emp.name, nik: emp.nik || '', phone: emp.phone || '',
      address: emp.address || '', position: emp.position || '',
      employeeType: emp.employeeType || 'STAFF',
      joinDate: emp.joinDate ? new Date(emp.joinDate).toISOString().slice(0,10) : '',
      dailyRate: emp.dailyRate || 0,
      serviceChargeEligible: emp.serviceChargeEligible !== false,
      bankName: emp.bankName || '', bankAccount: emp.bankAccount || '',
      bankAccountName: emp.bankAccountName || '',
      emergencyContact: emp.emergencyContact || '',
      emergencyPhone: emp.emergencyPhone || '', notes: emp.notes || '',
    });
    setFormOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) await api.patch('/api/employees', { id: editing.id, ...form });
      else await api.post('/api/employees', form);
      await load();
      setFormOpen(false);
    } catch(e: any) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function toggleActive(emp: any) {
    if (!confirm(emp.active ? `Nonaktifkan ${emp.name}?` : `Aktifkan ${emp.name}?`)) return;
    await api.patch('/api/employees', { id: emp.id, active: !emp.active });
    load();
  }

  async function createAccount() {
    if (!detail || !accEmail || !accPass) return;
    setAccSaving(true);
    try {
      const updated = await api.patch<any>('/api/employees', {
        id: detail.id, action: 'create_account',
        email: accEmail, password: accPass, role: accRole,
      });
      setDetail(updated);
      setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
      setAccountModal(false);
      alert(`✅ Akun berhasil dibuat\nEmail: ${accEmail}\nPassword: ${accPass}`);
    } catch(e: any) { alert(e.message); }
    finally { setAccSaving(false); }
  }

  function openDetail(emp: any) { setDetail(emp); setDetailOpen(true); }

  const f = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black" style={{ color:'var(--text-1)' }}>Data Karyawan</h1>
            <p className="text-sm" style={{ color:'var(--text-3)' }}>Master data HR — terpisah dari akun login</p>
          </div>
          <button onClick={openAdd} className="btn btn-primary btn-md">+ Tambah Karyawan</button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {EMP_TYPES.map(et => (
            <div key={et.value} className="card p-3 text-center">
              <p className="text-2xl font-black" style={{ color: et.color }}>
                {employees.filter(e => e.active && e.employeeType === et.value).length}
              </p>
              <p className="text-xs font-semibold mt-0.5" style={{ color:'var(--text-2)' }}>{et.label}</p>
            </div>
          ))}
        </div>

        {/* Search + Tabs */}
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background:'var(--surface-2)' }}>
            {(['active','inactive'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={tab===t?{background:'white',color:'var(--text-1)',boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}:{color:'var(--text-3)'}}>
                {t==='active'?'Aktif':'Nonaktif'} ({employees.filter(e=>t==='active'?e.active:!e.active).length})
              </button>
            ))}
          </div>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            className="input flex-1 min-w-32" placeholder="Cari nama atau posisi..."/>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor:'var(--brand)', borderTopColor:'transparent' }}/>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-gray-400">{search ? `Tidak ada hasil untuk "${search}"` : 'Belum ada karyawan'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(emp => {
              const et = EMP_TYPES.find(e => e.value === emp.employeeType);
              return (
                <div key={emp.id} className="card p-4 flex items-center gap-4 cursor-pointer hover:border-brand transition-colors"
                  style={{ borderColor:'var(--border)' }}
                  onClick={() => openDetail(emp)}>
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full flex items-center justify-center font-black text-base text-white flex-shrink-0"
                    style={{ background: et?.color || 'var(--brand)' }}>
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-bold text-sm" style={{ color:'var(--text-1)' }}>{emp.name}</p>
                      {emp.position && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: et?.bg||'#f3f4f6', color: et?.color||'#374151' }}>
                          {emp.position}
                        </span>
                      )}
                      {emp.user ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background:'#E1F5EE', color:'#0F6E56' }}>
                          ✓ Punya akun
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background:'#F5F5F5', color:'#888' }}>
                          Belum ada akun
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      <p className="text-xs" style={{ color:'var(--text-3)' }}>Rp {Number(emp.dailyRate||0).toLocaleString('id-ID')}/hari</p>
                      {emp.bankAccount && <p className="text-xs" style={{ color:'var(--text-3)' }}>{emp.bankName} {emp.bankAccount}</p>}
                      {emp.phone && <p className="text-xs" style={{ color:'var(--text-3)' }}>{emp.phone}</p>}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0" onClick={e=>e.stopPropagation()}>
                    <button onClick={() => openEdit(emp)}
                      className="btn btn-sm btn-secondary text-xs">Edit</button>
                    <button onClick={() => toggleActive(emp)}
                      className="btn btn-sm text-xs"
                      style={{ background:'#FEF2F2', color:'#DC2626', border:'1px solid #FECACA' }}>
                      {emp.active ? 'Nonaktif' : 'Aktif'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form Modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? `Edit: ${editing.name}` : 'Tambah Karyawan'}>
        <div className="space-y-4">
          {/* Identitas */}
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color:'var(--text-3)' }}>Identitas</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Nama Lengkap *</label>
              <input value={form.name} onChange={e=>f('name',e.target.value)} className="input w-full mt-1" placeholder="Nama sesuai KTP"/>
            </div>
            <div><label className="label">No. HP</label>
              <input value={form.phone} onChange={e=>f('phone',e.target.value)} className="input w-full mt-1" placeholder="08xx"/>
            </div>
            <div><label className="label">No. KTP / NIK</label>
              <input value={form.nik} onChange={e=>f('nik',e.target.value)} className="input w-full mt-1" placeholder="16 digit"/>
            </div>
          </div>

          {/* Posisi */}
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color:'var(--text-3)' }}>Posisi & Kerja</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Posisi</label>
              <select value={form.position} onChange={e=>f('position',e.target.value)} className="select w-full mt-1">
                <option value="">Pilih posisi...</option>
                {POSITIONS.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div><label className="label">Tipe Karyawan</label>
              <select value={form.employeeType} onChange={e=>f('employeeType',e.target.value)} className="select w-full mt-1">
                {EMP_TYPES.map(et=><option key={et.value} value={et.value}>{et.label}</option>)}
              </select>
            </div>
            <div><label className="label">Tanggal Bergabung</label>
              <input type="date" value={form.joinDate} onChange={e=>f('joinDate',e.target.value)} className="input w-full mt-1"/>
            </div>
            <div><label className="label">Daily Rate (Rp)</label>
              <input type="number" value={form.dailyRate} onChange={e=>f('dailyRate',e.target.value)} className="input w-full mt-1"/>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="sc" checked={form.serviceChargeEligible}
              onChange={e=>f('serviceChargeEligible',e.target.checked)} className="rounded"/>
            <label htmlFor="sc" className="text-sm" style={{ color:'var(--text-1)' }}>Berhak atas service charge</label>
          </div>

          {/* Bank */}
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color:'var(--text-3)' }}>Info Bank</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Bank</label>
              <select value={form.bankName} onChange={e=>f('bankName',e.target.value)} className="select w-full mt-1">
                <option value="">Pilih bank...</option>
                {BANKS.map(b=><option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div><label className="label">No. Rekening</label>
              <input value={form.bankAccount} onChange={e=>f('bankAccount',e.target.value)} className="input w-full mt-1"/>
            </div>
            <div className="col-span-2"><label className="label">Nama di Rekening</label>
              <input value={form.bankAccountName} onChange={e=>f('bankAccountName',e.target.value)} className="input w-full mt-1"/>
            </div>
          </div>

          {/* Kontak darurat */}
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color:'var(--text-3)' }}>Kontak Darurat</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Nama</label>
              <input value={form.emergencyContact} onChange={e=>f('emergencyContact',e.target.value)} className="input w-full mt-1"/>
            </div>
            <div><label className="label">No. HP</label>
              <input value={form.emergencyPhone} onChange={e=>f('emergencyPhone',e.target.value)} className="input w-full mt-1"/>
            </div>
          </div>

          <div><label className="label">Catatan</label>
            <textarea value={form.notes} onChange={e=>f('notes',e.target.value)} className="input w-full mt-1 resize-none" rows={2}/>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setFormOpen(false)} className="btn btn-secondary flex-1">Batal</button>
            <button onClick={save} disabled={saving||!form.name.trim()} className="btn btn-primary flex-1">
              {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Tambah Karyawan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={detail?.name || ''}>
        {detail && (
          <div className="space-y-4">
            {/* Account status */}
            <div className="rounded-xl p-4" style={{ background: detail.user ? '#E1F5EE' : '#F5F5F5' }}>
              {detail.user ? (
                <div>
                  <p className="font-bold text-sm" style={{ color:'#0F6E56' }}>✓ Sudah punya akun login</p>
                  <p className="text-xs mt-1" style={{ color:'#888' }}>Email: {detail.user.email} · Role: {detail.user.role}</p>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm" style={{ color:'#888' }}>Belum punya akun login</p>
                    <p className="text-xs mt-0.5" style={{ color:'#aaa' }}>Karyawan belum bisa login ke sistem</p>
                  </div>
                  <button onClick={() => {
                    setAccEmail('');
                    setAccPass('soeka2024');
                    setAccRole('STAFF');
                    setAccountModal(true);
                  }} className="btn btn-primary btn-sm">Buat Akun</button>
                </div>
              )}
            </div>

            {/* Data grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Posisi', detail.position || '—'],
                ['Tipe', detail.employeeType || '—'],
                ['Daily Rate', `Rp ${Number(detail.dailyRate||0).toLocaleString('id-ID')}`],
                ['Bergabung', detail.joinDate ? new Date(detail.joinDate).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) : '—'],
                ['No. HP', detail.phone || '—'],
                ['NIK', detail.nik || '—'],
                ['Bank', detail.bankName || '—'],
                ['No. Rekening', detail.bankAccount || '—'],
                ['Nama Rekening', detail.bankAccountName || '—'],
                ['SC Eligible', detail.serviceChargeEligible ? '✓ Ya' : '✗ Tidak'],
                ['Kontak Darurat', detail.emergencyContact || '—'],
                ['HP Darurat', detail.emergencyPhone || '—'],
              ].map(([label, val]) => (
                <div key={label as string}>
                  <p className="text-xs" style={{ color:'var(--text-3)' }}>{label}</p>
                  <p className="font-medium mt-0.5" style={{ color:'var(--text-1)' }}>{val}</p>
                </div>
              ))}
            </div>

            {detail.notes && (
              <div className="rounded-xl p-3" style={{ background:'var(--surface-2)' }}>
                <p className="text-xs" style={{ color:'var(--text-3)' }}>Catatan</p>
                <p className="text-sm mt-1" style={{ color:'var(--text-1)' }}>{detail.notes}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => { setDetailOpen(false); openEdit(detail); }} className="btn btn-secondary flex-1">Edit</button>
              <button onClick={() => { setDetailOpen(false); toggleActive(detail); }}
                className="btn flex-1" style={{ background:'#FEF2F2', color:'#DC2626', border:'1px solid #FECACA' }}>
                {detail.active ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Account Modal */}
      <Modal open={accountModal} onClose={() => setAccountModal(false)} title={`Buat Akun — ${detail?.name}`}>
        <div className="space-y-3">
          <p className="text-sm" style={{ color:'var(--text-3)' }}>Data karyawan akan langsung tersimpan di akun ini.</p>
          <div><label className="label">Email *</label>
            <input value={accEmail} onChange={e=>setAccEmail(e.target.value)} className="input w-full mt-1" placeholder="email@gmail.com"/>
          </div>
          <div><label className="label">Password awal *</label>
            <input value={accPass} onChange={e=>setAccPass(e.target.value)} className="input w-full mt-1"/>
          </div>
          <div><label className="label">Role</label>
            <select value={accRole} onChange={e=>setAccRole(e.target.value)} className="select w-full mt-1">
              <option value="STAFF">Staff</option>
              <option value="MANAGER">Manager</option>
              <option value="OWNER">Owner</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setAccountModal(false)} className="btn btn-secondary flex-1">Batal</button>
            <button onClick={createAccount} disabled={accSaving||!accEmail||!accPass} className="btn btn-primary flex-1">
              {accSaving ? 'Membuat...' : 'Buat Akun Login'}
            </button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
