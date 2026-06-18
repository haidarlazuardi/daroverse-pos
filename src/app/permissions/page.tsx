'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card, Button, Badge, Loader } from '@/components/ui';
import { api } from '@/lib/fetch';
import clsx from 'clsx';

interface Feature { label: string; default: boolean; group: string }

const LOCKED_LABELS: Record<string, string> = {
  manage_users: 'Kelola user', settings: 'Pengaturan sistem', refund: 'Refund / void',
  view_finance: 'Lihat profit / laporan keuangan', manage_supplier: 'Kelola supplier',
};

export default function PermissionsPage() {
  const [features, setFeatures] = useState<Record<string, Feature>>({});
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [locked, setLocked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.get<any>('/api/permissions');
      setFeatures(d.features); setPerms(d.permissions); setLocked(d.locked || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = (k: string) => { setPerms({ ...perms, [k]: !perms[k] }); setSaved(false); };

  const save = async () => {
    setSaving(true);
    try { await api.put('/api/permissions', { permissions: perms }); setSaved(true); }
    catch (e: any) { alert(e.message || 'Gagal'); } finally { setSaving(false); }
  };

  // group features
  const groups: Record<string, string[]> = {};
  for (const [k, f] of Object.entries(features)) (groups[f.group] ||= []).push(k);

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-2xl">
        <div className="page-header">
          <div><h2 className="page-title">Hak Akses Kasir</h2><p className="page-subtitle">Atur fitur apa yang bisa dipakai kasir/staff. Berlaku langsung setelah disimpan.</p></div>
        </div>

        {loading ? <Loader /> : (
          <>
            {Object.entries(groups).map(([group, keys]) => (
              <Card key={group}>
                <h3 className="font-bold text-gray-900 mb-3">{group}</h3>
                <div className="divide-y divide-gray-100">
                  {keys.map((k) => (
                    <div key={k} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{features[k].label}</p>
                        {!features[k].default && <p className="text-xs text-gray-400">Default: nonaktif (sensitif)</p>}
                      </div>
                      <button onClick={() => toggle(k)}
                        className={clsx('relative w-12 h-7 rounded-full transition-colors', perms[k] ? 'bg-green-500' : 'bg-gray-300')}>
                        <span className={clsx('absolute top-1 w-5 h-5 bg-white rounded-full transition-transform', perms[k] ? 'translate-x-6' : 'translate-x-1')} />
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            ))}

            <Card>
              <h3 className="font-bold text-gray-900 mb-1">Selalu khusus admin</h3>
              <p className="text-xs text-gray-400 mb-3">Fitur sensitif ini tidak bisa dibuka untuk kasir, demi keamanan.</p>
              <div className="flex flex-wrap gap-2">
                {locked.map((k) => <Badge key={k} variant="default">{LOCKED_LABELS[k] || k}</Badge>)}
              </div>
            </Card>

            <div className="flex items-center gap-3 sticky bottom-4">
              <Button onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan perubahan'}</Button>
              {saved && <span className="text-sm text-green-600">✓ Tersimpan — nav kasir langsung menyesuaikan</span>}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
