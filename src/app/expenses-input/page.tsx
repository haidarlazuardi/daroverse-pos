'use client';

import { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui';
import { api } from '@/lib/fetch';

const CATEGORIES = [
  { value: 'SUPPLIES',    label: '🧴 Supplies',    desc: 'Gas, sabun, tissue, dll' },
  { value: 'OPERATIONAL', label: '🚗 Operasional',  desc: 'Parkir, ongkir, dll' },
  { value: 'UTILITIES',   label: '💡 Utilities',    desc: 'Token listrik, air' },
  { value: 'TRANSPORT',   label: '🚕 Transport',    desc: 'Ojol, bensin' },
  { value: 'OTHER',       label: '📦 Lainnya',      desc: 'Pengeluaran lain' },
];

export default function ExpensesInputPage() {
  const [category, setCategory] = useState('SUPPLIES');
  const [description, setDesc]  = useState('');
  const [amount, setAmount]     = useState('');
  const [saving, setSaving]     = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  async function handleSave() {
    if (!description || !amount) return;
    setSaving(true);
    try {
      await api.post('/api/expenses', { category, description, amount: parseFloat(amount) });
      setLastSaved(`${description} — Rp ${parseFloat(amount).toLocaleString('id-ID')}`);
      setDesc(''); setAmount(''); setCategory('SUPPLIES');
    } catch (e: any) { alert(e.message || 'Gagal simpan'); }
    finally { setSaving(false); }
  }

  return (
    <AdminLayout>
      <div className="max-w-lg mx-auto">
        <div className="page-header">
          <div>
            <h1 className="page-title">Input Pengeluaran</h1>
            <p className="page-subtitle">Catat pengeluaran operasional harian</p>
          </div>
        </div>

        {lastSaved && (
          <div className="success-box mb-4 animate-fade-in">
            ✅ Tersimpan: <strong>{lastSaved}</strong>
          </div>
        )}

        <div className="card card-padded space-y-5">
          <div>
            <label className="label">Kategori</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map(c => (
                <button key={c.value} onClick={() => setCategory(c.value)}
                  className="p-3 rounded-xl border text-left transition-all"
                  style={category === c.value
                    ? { background: 'rgba(72,101,77,0.08)', borderColor: 'var(--brand)', color: 'var(--brand-dark)' }
                    : { background: 'var(--surface-1)', borderColor: 'var(--border-md)', color: 'var(--text-2)' }}>
                  <p className="font-semibold text-sm">{c.label}</p>
                  <p className="text-xs mt-0.5 opacity-70">{c.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Keterangan *</label>
            <input className="input" value={description} onChange={e => setDesc(e.target.value)}
              placeholder="cth. Beli gas 3kg, bayar parkir..." />
          </div>

          <div>
            <label className="label">Jumlah (Rp) *</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: 'var(--text-2)' }}>Rp</span>
              <input className="input pl-10" type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0" onKeyDown={e => e.key === 'Enter' && handleSave()} />
            </div>
            {amount && (
              <p className="text-xs mt-1 font-semibold" style={{ color: 'var(--brand)' }}>
                Rp {parseFloat(amount).toLocaleString('id-ID')}
              </p>
            )}
          </div>

          <Button onClick={handleSave} disabled={saving || !description || !amount} className="w-full btn-lg">
            {saving ? 'Menyimpan...' : 'Simpan Pengeluaran'}
          </Button>
        </div>

        <p className="text-xs text-center mt-4" style={{ color: 'var(--text-3)' }}>
          Pengeluaran akan masuk ke laporan harian manager/owner
        </p>
      </div>
    </AdminLayout>
  );
}
