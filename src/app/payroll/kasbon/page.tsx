'use client';
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/fetch';
import { formatCurrency, Modal, Button } from '@/components/ui';

export default function KasbonPage() {
  const [kasbons, setKasbons]   = useState<any[]>([]);
  const [users, setUsers]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [addOpen, setAddOpen]   = useState(false);
  const [payOpen, setPayOpen]   = useState<any>(null);
  const [form, setForm]         = useState({ userId: '', amount: '', reason: '' });
  const [payAmount, setPayAmount] = useState('');

  async function load() {
    const [k, u] = await Promise.all([
      api.get<any[]>('/api/kasbon'),
      api.get<any[]>('/api/users'),
    ]);
    setKasbons(k||[]); setUsers(u||[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function addKasbon() {
    await api.post('/api/kasbon', { userId: form.userId, amount: parseFloat(form.amount), reason: form.reason });
    setAddOpen(false); setForm({ userId: '', amount: '', reason: '' });
    load();
  }

  async function payKasbon() {
    if (!payOpen) return;
    await api.patch('/api/kasbon', { kasbonId: payOpen.id, payAmount: parseFloat(payAmount) });
    setPayOpen(null); setPayAmount('');
    load();
  }

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black" style={{ color: 'var(--text-1)' }}>Kasbon</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Hutang karyawan yang dicicil dari gaji</p>
          </div>
          <button onClick={() => setAddOpen(true)} className="btn btn-primary btn-md">+ Kasbon Baru</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }}/></div>
        ) : kasbons.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-3xl mb-2">💰</p>
            <p style={{ color: 'var(--text-3)' }}>Tidak ada kasbon aktif</p>
          </div>
        ) : (
          <div className="space-y-3">
            {kasbons.map(k => (
              <div key={k.id} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-bold" style={{ color: 'var(--text-1)' }}>{k.user?.name}</p>
                    {k.reason && <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{k.reason}</p>}
                  </div>
                  <button onClick={() => { setPayOpen(k); setPayAmount(''); }}
                    className="btn btn-secondary btn-sm">Cicil</button>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>Total</p>
                    <p className="font-bold" style={{ color: 'var(--text-1)' }}>{formatCurrency(k.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>Sisa</p>
                    <p className="font-bold text-red-500">{formatCurrency(k.remaining)}</p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>Sudah Dibayar</p>
                    <p className="font-bold text-green-600">{formatCurrency(k.amount - k.remaining)}</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-green-500" style={{ width: `${((k.amount - k.remaining) / k.amount) * 100}%` }}/>
                </div>
                {/* Payment history */}
                {k.payments?.length > 0 && (
                  <div className="mt-3 pt-3 border-t space-y-1" style={{ borderColor: 'var(--border)' }}>
                    {k.payments.map((p: any) => (
                      <div key={p.id} className="flex justify-between text-xs" style={{ color: 'var(--text-3)' }}>
                        <span>{new Date(p.createdAt).toLocaleDateString('id-ID')}</span>
                        <span className="text-green-600 font-medium">-{formatCurrency(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add kasbon modal */}
        <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Kasbon Baru">
          <div className="space-y-3">
            <div>
              <label className="label">Karyawan</label>
              <select value={form.userId} onChange={e => setForm(p => ({...p, userId: e.target.value}))} className="input">
                <option value="">Pilih karyawan</option>
                {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Jumlah (Rp)</label>
              <input type="number" value={form.amount} onChange={e => setForm(p => ({...p, amount: e.target.value}))} className="input" placeholder="500000"/>
            </div>
            <div>
              <label className="label">Keterangan</label>
              <input value={form.reason} onChange={e => setForm(p => ({...p, reason: e.target.value}))} className="input" placeholder="Alasan kasbon"/>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setAddOpen(false)} className="btn btn-secondary btn-md flex-1">Batal</button>
              <Button disabled={!form.userId || !form.amount} onClick={addKasbon} className="flex-1">Simpan</Button>
            </div>
          </div>
        </Modal>

        {/* Pay kasbon modal */}
        <Modal open={!!payOpen} onClose={() => setPayOpen(null)} title={`Cicil — ${payOpen?.user?.name}`}>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-3)' }}>Sisa Kasbon</span>
              <span className="font-bold text-red-500">{formatCurrency(payOpen?.remaining||0)}</span>
            </div>
            <div>
              <label className="label">Jumlah Cicilan Bulan Ini (Rp)</label>
              <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="input" placeholder="0"/>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setPayOpen(null)} className="btn btn-secondary btn-md flex-1">Batal</button>
              <Button disabled={!payAmount} onClick={payKasbon} className="flex-1">Catat Cicilan</Button>
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
