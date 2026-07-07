'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card, Button, Badge, Modal, Input, Select, Loader } from '@/components/ui';
import { api } from '@/lib/fetch';

interface User {
  id: string; name: string; email: string; role: string; active: boolean; createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'CASHIER' });

  const load = useCallback(async () => {
    try {
      const u = await api.get<User[]>('/api/users');
      setUsers(u);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    try {
      await api.post('/api/users', form);
      setShowAdd(false);
      setForm({ name: '', email: '', password: '', role: 'CASHIER' });
      load();
    } catch (e) { console.error(e); }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-surface-900">Users</h2>
            <p className="text-surface-500 text-sm mt-1">Kelola akun staff dan role</p>
          </div>
          <Button onClick={() => setShowAdd(true)}>+ Tambah user</Button>
        </div>

        {loading ? <Loader /> : (
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-200">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Nama</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Email</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Role</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Status</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Bergabung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-surface-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm">{u.name.charAt(0)}</div>
                          <span className="text-sm font-medium text-surface-900">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-surface-600">{u.email}</td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant={['SUPER_ADMIN','OWNER'].includes(u.role) ? 'info' : ['MANAGER'].includes(u.role) ? 'success' : 'default'}>
                          {{ SUPER_ADMIN:'Super Admin', OWNER:'Owner', MANAGER:'Manager', CASHIER:'Kasir', KITCHEN:'Dapur', INVENTORY:'Inventory' }[u.role] ?? u.role}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant={u.active ? 'success' : 'danger'}>{u.active ? 'Aktif' : 'Nonaktif'}</Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-surface-400">{new Date(u.createdAt).toLocaleDateString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && <div className="py-12 text-center text-surface-400">Belum ada user</div>}
            </div>
          </Card>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Tambah user">
        <div className="space-y-4">
          <Input label="Nama lengkap" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          <Input label="Password" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
          <Select label="Role" value={form.role} onChange={e => setForm({...form, role: e.target.value})}
            options={[
              { value: 'CASHIER',     label: 'Kasir' },
              { value: 'KITCHEN',     label: 'Dapur' },
              { value: 'INVENTORY',   label: 'Inventory' },
              { value: 'MANAGER',     label: 'Manager' },
              { value: 'OWNER',       label: 'Owner' },
              { value: 'SUPER_ADMIN', label: 'Super Admin' },
            ]} />
          <Button onClick={handleAdd} className="w-full">Buat user</Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}
