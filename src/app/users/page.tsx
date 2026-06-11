'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card, Button, Badge, Modal, Input, Select, Loader } from '@/components/ui';
import { api } from '@/lib/fetch';

interface User {
  id: string; name: string; email: string; role: string; active: boolean; outletId: string | null;
  outlet: { name: string } | null; createdAt: string;
}
interface Outlet { id: string; name: string }

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'CASHIER', outletId: '' });

  const load = useCallback(async () => {
    try {
      const [u, o] = await Promise.all([
        api.get<User[]>('/api/users'),
        api.get<Outlet[]>('/api/outlets'),
      ]);
      setUsers(u);
      setOutlets(o);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    try {
      await api.post('/api/users', { ...form, outletId: form.outletId || undefined });
      setShowAdd(false);
      setForm({ name: '', email: '', password: '', role: 'CASHIER', outletId: '' });
      load();
    } catch (e) { console.error(e); }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-surface-900">Users</h2>
            <p className="text-surface-500 text-sm mt-1">Manage staff accounts and roles</p>
          </div>
          <Button onClick={() => setShowAdd(true)}>+ Add User</Button>
        </div>

        {loading ? <Loader /> : (
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-200">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Name</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Email</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Role</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Outlet</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Status</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-surface-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm">
                            {u.name.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-surface-900">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-surface-600">{u.email}</td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant={u.role === 'ADMIN' ? 'info' : 'default'}>{u.role}</Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-surface-500">{u.outlet?.name || '—'}</td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant={u.active ? 'success' : 'danger'}>{u.active ? 'Active' : 'Inactive'}</Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-surface-400">{new Date(u.createdAt).toLocaleDateString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && <div className="py-12 text-center text-surface-400">No users yet</div>}
            </div>
          </Card>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add User">
        <div className="space-y-4">
          <Input label="Full Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          <Input label="Password" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
          <Select label="Role" value={form.role} onChange={e => setForm({...form, role: e.target.value})}
            options={[{ value: 'CASHIER', label: 'Cashier' }, { value: 'ADMIN', label: 'Admin' }]} />
          <Select label="Outlet" value={form.outletId} onChange={e => setForm({...form, outletId: e.target.value})}
            options={[{ value: '', label: 'No outlet' }, ...outlets.map(o => ({ value: o.id, label: o.name }))]} />
          <Button onClick={handleAdd} className="w-full">Create User</Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}
