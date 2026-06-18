'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Card, Button, Badge, Loader, formatNumber } from '@/components/ui';
import { api } from '@/lib/fetch';
import clsx from 'clsx';

export default function StockOpnamePage() {
  const [opnames, setOpnames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOpname, setActiveOpname] = useState<any>(null);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState(false); // true = viewing completed, false = editing draft
  const [newLoc, setNewLoc] = useState('BAR');
  const [newTier, setNewTier] = useState('');

  const load = useCallback(async () => {
    try { setOpnames(await api.get('/api/stock-opname')); } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createOpname = async () => {
    try {
      const opname = await api.post('/api/stock-opname', { action: 'create', location: newLoc, tier: newTier || undefined });
      setActiveOpname(opname); setEditItems((opname as any).items || []); setViewMode(false);
    } catch (e: any) { alert(e.message || 'Failed'); }
  };

  const openOpname = (opname: any) => {
    setActiveOpname(opname); setEditItems(opname.items || []);
    setViewMode(opname.status === 'COMPLETED');
  };

  const updateActualQty = (itemId: string, value: string) => {
    setEditItems(prev => prev.map(i => i.id === itemId ? { ...i, actualQty: parseFloat(value) || 0, difference: (parseFloat(value) || 0) - i.systemQty } : i));
  };

  const saveOpname = async () => {
    try { await api.post('/api/stock-opname', { action: 'update', opnameId: activeOpname.id, items: editItems }); alert('Saved!'); } catch (e: any) { alert(e.message); }
  };

  const completeOpname = async () => {
    if (!confirm('Complete stock opname? This will adjust all stock to your actual counts.')) return;
    try {
      await api.post('/api/stock-opname', { action: 'update', opnameId: activeOpname.id, items: editItems });
      const result = await api.post<any>('/api/stock-opname', { action: 'complete', opnameId: activeOpname.id });
      alert(`Done! ${result.adjustments} adjustments applied.`);
      setActiveOpname(null); load();
    } catch (e: any) { alert(e.message || 'Failed'); }
  };

  const diffItems = editItems.filter(i => i.difference !== 0);
  const matchItems = editItems.filter(i => i.difference === 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h2 className="page-title">Stock Opname</h2>
            <p className="page-subtitle">Physical stock count — the single source of truth for adjustments</p>
          </div>
          {!activeOpname && (
            <div className="flex items-end gap-2">
              <div>
                <label className="label">Lokasi</label>
                <select value={newLoc} onChange={e => setNewLoc(e.target.value)} className="select">
                  <option value="GUDANG">Gudang</option><option value="BAR">Bar</option><option value="KITCHEN">Dapur</option>
                </select>
              </div>
              <div>
                <label className="label">Tier (opsional)</label>
                <select value={newTier} onChange={e => setNewTier(e.target.value)} className="select">
                  <option value="">Semua</option><option value="A">A (harian)</option><option value="B">B (mingguan)</option><option value="C">C (bulanan)</option>
                </select>
              </div>
              <Button onClick={createOpname}>+ Hitung stok</Button>
            </div>
          )}
        </div>

        {loading ? <Loader /> : !activeOpname ? (
          /* List view */
          <Card padding={false}><div className="table-wrapper"><table className="table">
            <thead><tr><th>Date</th><th className="center">Items</th><th className="center">Differences</th><th className="center">Status</th><th></th></tr></thead>
            <tbody>
              {opnames.map(o => {
                const diffs = (o.items || []).filter((i: any) => i.difference !== 0).length;
                return (
                  <tr key={o.id} className="cursor-pointer" onClick={() => openOpname(o)}>
                    <td className="font-medium">{new Date(o.createdAt).toLocaleString('id-ID')}</td>
                    <td className="center muted">{(o.items || []).length}</td>
                    <td className="center">{diffs > 0 ? <Badge variant="warning">{diffs} diff</Badge> : <Badge variant="success">All match</Badge>}</td>
                    <td className="center"><Badge variant={o.status === 'COMPLETED' ? 'success' : 'warning'}>{o.status}</Badge></td>
                    <td className="right"><button className="btn btn-sm btn-ghost">{o.status === 'COMPLETED' ? 'View Results' : 'Edit'}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
          {opnames.length === 0 && <div className="empty-state"><p className="empty-title">No stock counts yet</p><p className="empty-text">Start a new count to reconcile physical stock with system records</p></div>}
          </Card>
        ) : (
          /* Detail / Edit view */
          <div className="space-y-4">
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900">
                    {viewMode ? '📋 Stock Count Results' : '✏️ Counting in Progress'} — {new Date(activeOpname.createdAt).toLocaleDateString('id-ID')}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {viewMode ? `${diffItems.length} differences found, ${matchItems.length} matched` : 'Enter actual counts for each ingredient'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setActiveOpname(null)}>← Back</Button>
                  {!viewMode && (
                    <>
                      <Button variant="secondary" onClick={saveOpname}>Save Draft</Button>
                      <Button onClick={completeOpname}>Complete & Apply</Button>
                    </>
                  )}
                </div>
              </div>
            </Card>

            {/* Summary for completed */}
            {viewMode && diffItems.length > 0 && (
              <Card>
                <h4 className="font-bold text-gray-900 mb-3">⚠️ Differences Found ({diffItems.length})</h4>
                <div className="space-y-2">
                  {diffItems.map(item => (
                    <div key={item.id} className={clsx('flex items-center justify-between p-3 rounded-lg',
                      item.difference > 0 ? 'bg-emerald-50' : 'bg-red-50')}>
                      <div>
                        <span className="font-medium">{item.ingredient?.name}</span>
                        <span className="text-xs text-gray-500 ml-2">System: {formatNumber(item.systemQty)} → Actual: {formatNumber(item.actualQty)}</span>
                      </div>
                      <span className={clsx('font-bold', item.difference > 0 ? 'text-emerald-600' : 'text-red-600')}>
                        {item.difference > 0 ? '+' : ''}{formatNumber(item.difference)} {item.ingredient?.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Full table */}
            <Card padding={false}><div className="table-wrapper"><table className="table">
              <thead><tr>
                <th>Ingredient</th><th>Unit</th><th className="right">System</th>
                <th className="center">{viewMode ? 'Actual' : 'Actual Count'}</th>
                <th className="right">Difference</th>
                {!viewMode && <th>Notes</th>}
              </tr></thead>
              <tbody>
                {editItems.map(item => {
                  const diff = item.actualQty - item.systemQty;
                  return (
                    <tr key={item.id} className={diff !== 0 ? (diff > 0 ? 'bg-emerald-50/30' : 'bg-red-50/30') : ''}>
                      <td className="font-medium">{item.ingredient?.name}</td>
                      <td className="muted">{item.ingredient?.unit}</td>
                      <td className="right muted">{formatNumber(item.systemQty)}</td>
                      <td className="center">
                        {viewMode ? (
                          <span className="font-bold">{formatNumber(item.actualQty)}</span>
                        ) : (
                          <input type="number" value={item.actualQty} onChange={e => updateActualQty(item.id, e.target.value)}
                            className="input w-28 text-center font-bold mx-auto" />
                        )}
                      </td>
                      <td className={clsx('right font-bold', diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-gray-400')}>
                        {diff > 0 ? '+' : ''}{formatNumber(diff)}
                      </td>
                      {!viewMode && (
                        <td><input type="text" value={item.notes || ''} placeholder="Note..."
                          onChange={e => setEditItems(prev => prev.map(i => i.id === item.id ? { ...i, notes: e.target.value } : i))}
                          className="input" /></td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table></div></Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
