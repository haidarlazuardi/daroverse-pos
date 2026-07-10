'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge } from '@/components/ui';
import { Toolbar } from '@/components/ui/Toolbar';
import { DataTable, Column } from '@/components/ui/DataTable';
import { api } from '@/lib/fetch';
import clsx from 'clsx';

const ACTION_VARIANT: Record<string, any> = { CREATE:'success', UPDATE:'info', DELETE:'danger', VOID:'danger', SHIFT_OPEN:'default', SHIFT_CLOSE:'default' };
const ENTITY_ICONS: Record<string, string> = { Order:'🧾', Ingredient:'🌿', Product:'☕', User:'👤', Shift:'⏱️', Discount:'🏷️', Asset:'🔧', Expense:'💸' };

export default function AuditLogPage() {
  const [logs, setLogs]         = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [fromDate, setFromDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; });
  const [toDate, setToDate]     = useState(() => new Date().toISOString().slice(0,10));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate, limit: '100' });
      if (filterEntity) params.set('entity', filterEntity);
      const res = await api.get<any>(`/api/audit-log?${params}`);
      setLogs(res.logs || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [fromDate, toDate, filterEntity]);

  useEffect(() => { load(); }, [load]);

  const filtered = logs.filter(l => {
    const matchSearch = !search || l.userName.toLowerCase().includes(search.toLowerCase()) || l.entity.toLowerCase().includes(search.toLowerCase());
    const matchAction = !filterAction || l.action === filterAction;
    return matchSearch && matchAction;
  });

  const columns: Column<any>[] = [
    { key:'createdAt', label:'Waktu', sortable:true, render: l => <span className="text-xs font-mono" style={{ color: 'var(--text-2)' }}>{new Date(l.createdAt).toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', second:'2-digit' })}</span> },
    { key:'userName', label:'User', render: l => <span className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{l.userName}</span> },
    { key:'action', label:'Aksi', render: l => <Badge variant={ACTION_VARIANT[l.action] || 'default'}>{l.action}</Badge> },
    { key:'entity', label:'Data', render: l => (
      <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-2)' }}>
        <span>{ENTITY_ICONS[l.entity] || '📄'}</span>
        <span>{l.entity}</span>
      </span>
    )},
    { key:'changes', label:'Perubahan', render: l => {
      if (!l.newValue && !l.oldValue) return <span style={{ color: 'var(--text-3)' }}>—</span>;
      const changes: string[] = [];
      if (l.oldValue && l.newValue) {
        for (const key of Object.keys(l.newValue)) {
          if (l.oldValue[key] !== l.newValue[key]) changes.push(`${key}: ${l.oldValue[key]} → ${l.newValue[key]}`);
        }
      }
      return <span className="text-xs font-mono" style={{ color: 'var(--text-2)' }}>{changes.slice(0,2).join(', ') || JSON.stringify(l.newValue || l.oldValue).slice(0,60)}</span>;
    }},
  ];

  const ENTITIES = ['Order','Ingredient','Product','User','Shift','Discount','Asset','Expense'];
  const ACTIONS  = ['CREATE','UPDATE','DELETE','VOID','SHIFT_OPEN','SHIFT_CLOSE'];

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <div className="page-header">
          <div><h1 className="page-title">Audit Log</h1><p className="page-subtitle">Rekam jejak semua perubahan data sistem</p></div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex gap-3 flex-wrap items-end">
          <div><label className="label">Dari</label><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="input text-sm" /></div>
          <div><label className="label">Sampai</label><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="input text-sm" /></div>
        </div>

        <Toolbar
          search={search} onSearch={setSearch} searchPlaceholder="Cari nama user atau data..."
          filters={[
            { key:'entity', label:'Data', value:filterEntity, onChange:setFilterEntity, options: ENTITIES.map(e=>({value:e,label:e})) },
            { key:'action', label:'Aksi', value:filterAction, onChange:setFilterAction, options: ACTIONS.map(a=>({value:a,label:a})) },
          ]}
        />

        <DataTable data={filtered} columns={columns} keyField="id" loading={loading} emptyMessage="Belum ada log di periode ini" />
      </div>
    </AdminLayout>
  );
}
