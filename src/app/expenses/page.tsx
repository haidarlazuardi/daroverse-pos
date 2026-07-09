'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card, Button, Badge, Modal, Input, Select, Loader, StatCard, formatCurrency } from '@/components/ui';
import { api } from '@/lib/fetch';

const CATEGORIES = [
  { value: 'UTILITIES', label: 'Utilities (Listrik, Air, Internet)' },
  { value: 'SUPPLIES', label: 'Supplies (Gas, Tissue, Sabun)' },
  { value: 'OPERATIONAL', label: 'Operational (Parkir, Ojol)' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'SALARY', label: 'Salary' },
  { value: 'OTHER', label: 'Other' },
];

export default function ExpensesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ category: 'OPERATIONAL', description: '', amount: '', paidBy: '' });
  const [fromDate, setFromDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get(`/api/expenses?from=${fromDate}&to=${toDate}`);
      setData(d);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    try {
      await api.post('/api/expenses', form);
      setShowAdd(false); setForm({ category: 'OPERATIONAL', description: '', amount: '', paidBy: '' }); load();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    try { await api.delete(`/api/expenses?id=${id}`); load(); } catch (e) { console.error(e); }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div><h2 className="text-xl sm:text-2xl font-bold text-surface-900">Expenses</h2><p className="text-surface-500 text-sm mt-1">Track daily operational expenses</p></div>
          <Button onClick={() => setShowAdd(true)}>+ Add Expense</Button>
        </div>

        <Card>
          <div className="flex gap-4 items-end">
            <div><label className="block text-xs font-medium text-surface-500 mb-1">From</label><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="px-3 py-2 border border-surface-300 rounded-xl text-sm" /></div>
            <div><label className="block text-xs font-medium text-surface-500 mb-1">To</label><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="px-3 py-2 border border-surface-300 rounded-xl text-sm" /></div>
          </div>
        </Card>

        {loading || !data ? <Loader /> : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Expenses" value={formatCurrency(data.total)} />
              {Object.entries(data.byCategory as Record<string, number>).slice(0, 3).map(([cat, amount]) => (
                <StatCard key={cat} label={cat} value={formatCurrency(amount)} />
              ))}
            </div>

            <Card padding={false}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-surface-200">
                    <th className="text-left px-3 sm:px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Date</th>
                    <th className="text-left px-3 sm:px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Category</th>
                    <th className="text-left px-3 sm:px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Description</th>
                    <th className="text-right px-3 sm:px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Amount</th>
                    <th className="text-left px-3 sm:px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Paid By</th>
                    <th className="px-3 sm:px-6 py-3"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-surface-100">
                    {(data.expenses || []).map((e: any) => (
                      <tr key={e.id} className="hover:bg-surface-50">
                        <td className="px-3 sm:px-6 py-3 text-sm text-surface-500">{new Date(e.createdAt).toLocaleDateString('id-ID')}</td>
                        <td className="px-3 sm:px-6 py-3"><Badge>{e.category}</Badge></td>
                        <td className="px-3 sm:px-6 py-3 text-sm text-surface-900">{e.description}</td>
                        <td className="px-3 sm:px-6 py-3 text-sm font-bold text-red-600 text-right">{formatCurrency(e.amount)}</td>
                        <td className="px-3 sm:px-6 py-3 text-sm text-surface-500">{e.paidBy || '—'}</td>
                        <td className="px-3 sm:px-6 py-3"><button onClick={() => handleDelete(e.id)} className="text-red-400 hover:text-red-600 text-sm">Delete</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.expenses?.length === 0 && <div className="py-12 text-center text-surface-400">No expenses recorded</div>}
              </div>
            </Card>
          </>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Expense">
        <div className="space-y-4">
          <Select label="Category" value={form.category} onChange={e => setForm({...form, category: e.target.value})} options={CATEGORIES} />
          <Input label="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="e.g. Beli gas 3kg" />
          <Input label="Amount (IDR)" type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
          <Input label="Paid By" value={form.paidBy} onChange={e => setForm({...form, paidBy: e.target.value})} placeholder="Optional" />
          <Button onClick={handleAdd} className="w-full">Add Expense</Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}
