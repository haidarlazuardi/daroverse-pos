'use client';
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/fetch';
import { Badge } from '@/components/ui';

const TYPE_LABEL: Record<string,string> = { SICK:'Sakit', PERMISSION:'Izin', ANNUAL:'Cuti Tahunan', OTHER:'Lainnya' };
const STATUS_COLOR: Record<string,string> = { PENDING:'warning', APPROVED:'success', REJECTED:'danger' };

export default function LeavesPage() {
  const [leaves, setLeaves]   = useState<any[]>([]);
  const [status, setStatus]   = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [note, setNote]       = useState<Record<string,string>>({});

  async function load() {
    setLoading(true);
    try { const r = await api.get<any[]>(`/api/leaves?status=${status}`); setLeaves(Array.isArray(r)?r:[]); }
    catch {} finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [status]);

  async function process(id: string, action: 'APPROVED'|'REJECTED') {
    await api.patch('/api/leaves', { id, status: action, notes: note[id] || null });
    load();
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black" style={{ color:'var(--text-1)' }}>Izin & Cuti</h1>
          <div className="flex gap-2">
            {['PENDING','APPROVED','REJECTED'].map(s => (
              <button key={s} onClick={() => setStatus(s)}
                className="btn btn-sm" style={{ background: status===s ? 'var(--brand)' : 'var(--surface-2)', color: status===s ? 'white' : 'var(--text-2)' }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor:'var(--brand)', borderTopColor:'transparent' }}/></div>
        ) : leaves.length === 0 ? (
          <div className="card p-8 text-center text-gray-400">Tidak ada pengajuan {status.toLowerCase()}</div>
        ) : (
          <div className="space-y-3">
            {leaves.map(l => (
              <div key={l.id} className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-black" style={{ color:'var(--text-1)' }}>{l.user?.name}</p>
                      <Badge variant={STATUS_COLOR[l.status] as any}>{l.status}</Badge>
                    </div>
                    <p className="text-sm font-semibold" style={{ color:'var(--brand)' }}>{TYPE_LABEL[l.type]}</p>
                    <p className="text-sm" style={{ color:'var(--text-3)' }}>
                      {new Date(l.startDate).toLocaleDateString('id-ID')} – {new Date(l.endDate).toLocaleDateString('id-ID')} &nbsp;
                      ({Math.ceil((new Date(l.endDate).getTime() - new Date(l.startDate).getTime()) / 86400000) + 1} hari)
                    </p>
                    <p className="text-sm mt-1" style={{ color:'var(--text-2)' }}>{l.reason}</p>
                  </div>
                  {l.status === 'PENDING' && (
                    <div className="space-y-2 min-w-48">
                      <input value={note[l.id]||''} onChange={e => setNote(p=>({...p,[l.id]:e.target.value}))}
                        className="input text-xs w-full" placeholder="Catatan (opsional)"/>
                      <div className="flex gap-2">
                        <button onClick={() => process(l.id, 'REJECTED')} className="flex-1 btn btn-sm btn-secondary text-red-500">Tolak</button>
                        <button onClick={() => process(l.id, 'APPROVED')} className="flex-1 btn btn-sm btn-primary">Setujui</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
