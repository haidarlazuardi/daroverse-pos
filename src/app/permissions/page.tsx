'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/fetch';
import clsx from 'clsx';

const ROLES = [
  { key: 'MANAGER', label: 'Manager', color: '#2D6A4F' },
  { key: 'CASHIER', label: 'Kasir',   color: '#1D3557' },
  { key: 'KITCHEN', label: 'Dapur',   color: '#7B2D8B' },
];

const SECTIONS = ['Operasional','Dapur & Stok','Purchasing','Manajemen','Laporan'];

export default function PermissionsPage() {
  const [perms, setPerms]     = useState<Record<string, Record<string, boolean>>>({});
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState<string | null>(null); // "ROLE/href"
  const [activeRole, setActiveRole] = useState('MANAGER');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, f] = await Promise.all([
        api.get<Record<string, Record<string, boolean>>>('/api/role-permissions'),
        fetch('/api/role-permissions').then(r => r.json()).then(d => d.data),
      ]);
      setPerms(p);
      // Get feature list from API
      const res = await fetch('/api/role-permissions/features');
      if (res.ok) {
        const data = await res.json();
        setFeatures(data.features || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle(role: string, href: string, current: boolean) {
    const key = `${role}/${href}`;
    setSaving(key);
    const newVal = !current;
    // Optimistic update
    setPerms(p => ({ ...p, [role]: { ...p[role], [href]: newVal } }));
    try {
      await api.patch('/api/role-permissions', { role, feature: href, enabled: newVal });
    } catch {
      // Revert
      setPerms(p => ({ ...p, [role]: { ...p[role], [href]: current } }));
    }
    setSaving(null);
  }

  const grouped = SECTIONS.map(sec => ({
    section: sec,
    items: features.filter((f: any) => f.section === sec),
  })).filter(g => g.items.length > 0);

  const activeRoleData = ROLES.find(r => r.key === activeRole)!;

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto">
        <div className="page-header">
          <div>
            <h1 className="page-title">Hak Akses</h1>
            <p className="page-subtitle">Konfigurasi fitur yang bisa diakses per role</p>
          </div>
        </div>

        <div className="info-box mb-5">
          <strong>Owner & Super Admin</strong> selalu punya akses penuh ke semua fitur dan tidak bisa dikonfigurasi di sini.
        </div>

        {/* Role tabs */}
        <div className="flex gap-2 mb-6">
          {ROLES.map(r => (
            <button key={r.key} onClick={() => setActiveRole(r.key)}
              className={clsx('px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all', activeRole === r.key ? 'text-white' : 'bg-white')}
              style={activeRole === r.key
                ? { background: r.color, borderColor: r.color }
                : { borderColor: 'var(--border-md)', color: 'var(--text-2)' }}>
              {r.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
          </div>
        ) : features.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">Loading fitur...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(({ section, items }) => (
              <div key={section} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-gray-100" style={{ background: 'var(--surface-2)' }}>
                  <p className="text-xs font-black uppercase tracking-[0.1em]" style={{ color: 'var(--text-3)' }}>{section}</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {items.map((feature: any) => {
                    const enabled = perms[activeRole]?.[feature.href] ?? false;
                    const key = `${activeRole}/${feature.href}`;
                    const isSaving = saving === key;
                    return (
                      <div key={feature.href} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{feature.label}</p>
                          <p className="text-xs" style={{ color: 'var(--text-3)' }}>{feature.href}</p>
                        </div>
                        <button
                          onClick={() => toggle(activeRole, feature.href, enabled)}
                          disabled={isSaving}
                          className={clsx(
                            'relative w-11 h-6 rounded-full transition-all duration-200 flex-shrink-0',
                            isSaving ? 'opacity-50' : '',
                            enabled ? '' : 'bg-gray-200'
                          )}
                          style={enabled ? { background: activeRoleData.color } : {}}>
                          <span className={clsx(
                            'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200',
                            enabled ? 'left-[22px]' : 'left-0.5'
                          )} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
