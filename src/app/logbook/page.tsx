'use client';
import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Button, Modal } from '@/components/ui';
import { api } from '@/lib/fetch';
import { useAuthStore } from '@/store';
import clsx from 'clsx';

const TAG_CONFIG = {
  INFO:    { label: 'Info',    color: '#1D6F99', bg: '#EBF5FB' },
  WARNING: { label: 'Warning', color: '#D4851A', bg: '#FEF9E7' },
  URGENT:  { label: 'Urgent',  color: '#C0392B', bg: '#FDEDEC' },
};
const ROLE_LABEL: Record<string, string> = { SUPER_ADMIN:'Super Admin', OWNER:'Owner', MANAGER:'Manager', CASHIER:'Kasir', KITCHEN:'Dapur' };

export default function LogbookPage() {
  const { user } = useAuthStore();
  const [entries, setEntries]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [form, setForm]         = useState({ title: '', body: '', tag: 'INFO' });
  const [saving, setSaving]     = useState(false);
  const [filterTag, setFilterTag] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setEntries(await api.get<any[]>('/api/logbook?limit=50')); }
    catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markRead(id: string) {
    try {
      await api.patch('/api/logbook', { id, action: 'read' });
      setEntries(p => p.map(e => e.id === id ? { ...e, isRead: true } : e));
    } catch { /* silent */ }
  }

  async function handleSubmit() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await api.post('/api/logbook', form);
      setModal(false); setForm({ title: '', body: '', tag: 'INFO' }); load();
    } catch (e: any) { alert(e.message || 'Gagal'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus entry ini?')) return;
    try { await api.delete(`/api/logbook?id=${id}`); load(); }
    catch (e: any) { alert(e.message || 'Gagal'); }
  }

  const filtered = entries.filter(e => !filterTag || e.tag === filterTag);
  const unreadCount = entries.filter(e => !e.isRead).length;

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto">
        <div className="page-header">
          <div>
            <h1 className="page-title">Logbook</h1>
            <p className="page-subtitle">Catatan kondisi & informasi untuk semua tim</p>
          </div>
          <Button onClick={() => setModal(true)}>+ Tambah Catatan</Button>
        </div>

        {/* Filter tags */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {['', 'INFO', 'WARNING', 'URGENT'].map(t => (
            <button key={t} onClick={() => setFilterTag(t)}
              className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                filterTag === t ? 'text-white border-transparent' : 'border-gray-200 text-gray-600 bg-white hover:border-gray-400')}
              style={filterTag === t ? { background: t ? TAG_CONFIG[t as keyof typeof TAG_CONFIG].color : '#374840', borderColor: 'transparent' } : {}}>
              {t || 'Semua'} {t === '' && unreadCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-red-500 text-white">{unreadCount}</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p className="text-3xl mb-3">📋</p><p className="empty-title">Belum ada catatan</p></div>
        ) : (
          <div className="space-y-3">
            {filtered.map(entry => {
              const tag = TAG_CONFIG[entry.tag as keyof typeof TAG_CONFIG];
              return (
                <div key={entry.id} onClick={() => !entry.isRead && markRead(entry.id)}
                  className={clsx('card p-4 cursor-pointer transition-all', !entry.isRead && 'ring-2 ring-offset-1')}
                  style={!entry.isRead ? { ringColor: tag.color } : {}}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {!entry.isRead && <div className="w-2.5 h-2.5 rounded-full" style={{ background: tag.color }} />}
                      {entry.isRead && <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: tag.bg, color: tag.color }}>{tag.label}</span>
                        {entry.pinned && <span className="text-xs">📌</span>}
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>{entry.title}</span>
                      </div>
                      {entry.body && <p className="text-sm mt-1 whitespace-pre-line" style={{ color: 'var(--text-2)' }}>{entry.body}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>{entry.userName}</span>
                        <span className="text-xs" style={{ color: 'var(--text-3)' }}>·</span>
                        <span className="text-xs" style={{ color: 'var(--text-3)' }}>{ROLE_LABEL[entry.userRole] || entry.userRole}</span>
                        <span className="text-xs" style={{ color: 'var(--text-3)' }}>·</span>
                        <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                          {new Date(entry.createdAt).toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                        </span>
                        {(entry.userId === user?.id || ['SUPER_ADMIN','OWNER','MANAGER'].includes(user?.role || '')) && (
                          <button onClick={e => { e.stopPropagation(); handleDelete(entry.id); }}
                            className="ml-auto text-xs text-gray-400 hover:text-red-500">Hapus</button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Tambah Catatan Logbook">
        <div className="space-y-4">
          <div>
            <label className="label">Tag</label>
            <div className="flex gap-2">
              {Object.entries(TAG_CONFIG).map(([k, v]) => (
                <button key={k} onClick={() => setForm(p => ({ ...p, tag: k }))}
                  className="flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all"
                  style={form.tag === k ? { background: v.bg, borderColor: v.color, color: v.color } : { borderColor: 'var(--border-md)', color: 'var(--text-2)' }}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Judul *</label>
            <input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="cth. Kulkas bar mati, perlu dicek" autoFocus />
          </div>
          <div>
            <label className="label">Detail</label>
            <textarea className="input" rows={3} value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} placeholder="Informasi tambahan..." />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setModal(false)} className="btn btn-secondary btn-md">Batal</button>
            <Button onClick={handleSubmit} disabled={saving || !form.title.trim()}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
