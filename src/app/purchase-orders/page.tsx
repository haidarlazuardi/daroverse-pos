'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, Button, formatCurrency } from '@/components/ui';
import { DataTable, Column } from '@/components/ui/DataTable';
import { SlideOver } from '@/components/ui/SlideOver';
import { Toolbar } from '@/components/ui/Toolbar';
import { api } from '@/lib/fetch';
import clsx from 'clsx';
import * as XLSX from 'xlsx';

interface POItem { id: string; quantity: number; unitPrice: number; totalPrice: number; ingredient: { id: string; name: string; unit: string } }
interface PO { id: string; poNumber: string; status: string; totalAmount: number; notes: string | null; createdAt: string; completedAt: string | null; supplier: { id: string; name: string }; items: POItem[] }
interface Supplier { id: string; name: string }
interface Ingredient { id: string; name: string; unit: string; latestPrice: number; purchaseUnit: string | null; conversionRate: number | null }

const STATUS_LABEL: Record<string, string> = { DRAFT: 'Draft', ORDERED: 'Dipesan', RECEIVED: 'Diterima', CANCELLED: 'Dibatalkan' };
const STATUS_VARIANT: Record<string, any>  = { DRAFT: 'warning', ORDERED: 'info', RECEIVED: 'success', CANCELLED: 'danger' };

export default function PurchaseOrdersPage() {
  const [data, setData]           = useState<PO[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading]     = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [slideOpen, setSlideOpen] = useState(false);
  const [detailPO, setDetailPO]   = useState<PO | null>(null);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState('');

  const [form, setForm] = useState({
    supplierId: '', notes: '', markComplete: false,
    items: [] as { ingredientId: string; quantity: string; unitPrice: string }[],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = statusFilter ? `/api/purchase-orders?status=${statusFilter}` : '/api/purchase-orders';
      const [p, s, i] = await Promise.all([api.get<PO[]>(url), api.get<Supplier[]>('/api/suppliers'), api.get<Ingredient[]>('/api/ingredients')]);
      setData(p); setSuppliers(s); setIngredients(i);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setDetailPO(null);
    setForm({ supplierId: '', notes: '', markComplete: false, items: [{ ingredientId: '', quantity: '', unitPrice: '' }] });
    setFormError(''); setSlideOpen(true);
  }

  function openDetail(po: PO) { setDetailPO(po); setSlideOpen(true); }
  function closeSlide() { setSlideOpen(false); setDetailPO(null); setFormError(''); }

  function addItem() { setForm({ ...form, items: [...form.items, { ingredientId: '', quantity: '', unitPrice: '' }] }); }
  function removeItem(i: number) { setForm({ ...form, items: form.items.filter((_, j) => j !== i) }); }
  function updateItem(i: number, field: string, value: string) {
    const items = [...form.items];
    (items[i] as any)[field] = value;
    // Auto-fill price from ingredient
    if (field === 'ingredientId') {
      const ing = ingredients.find(x => x.id === value);
      if (ing) items[i].unitPrice = String(ing.latestPrice);
    }
    setForm({ ...form, items });
  }

  const formTotal = form.items.reduce((sum, i) => sum + (parseFloat(i.quantity)||0)*(parseFloat(i.unitPrice)||0), 0);

  async function handleCreate() {
    if (!form.supplierId) { setFormError('Pilih supplier'); return; }
    if (!form.items.some(i => i.ingredientId && i.quantity)) { setFormError('Tambahkan minimal 1 item'); return; }
    setSaving(true); setFormError('');
    try {
      await api.post('/api/purchase-orders', {
        supplierId: form.supplierId, notes: form.notes, markComplete: form.markComplete,
        items: form.items.filter(i => i.ingredientId && i.quantity).map(i => ({ ingredientId: i.ingredientId, quantity: parseFloat(i.quantity), unitPrice: parseFloat(i.unitPrice)||0 })),
      });
      closeSlide(); load();
    } catch (e: any) { setFormError(e?.message || 'Gagal membuat PO'); }
    finally { setSaving(false); }
  }

  async function handleAction(po: PO, action: 'complete'|'cancel') {
    const label = action === 'complete' ? 'terima dan update stok' : 'batalkan';
    if (!confirm(`${label} PO ${po.poNumber}?`)) return;
    try { await api.patch('/api/purchase-orders', { id: po.id, action }); load(); closeSlide(); }
    catch (e: any) { alert(e?.message || 'Gagal'); }
  }

  function handleExport() {
    const rows = data.flatMap(po => po.items.map(item => ({
      po_number: po.poNumber, status: po.status, supplier: po.supplier.name,
      ingredient: item.ingredient.name, unit: item.ingredient.unit,
      quantity: item.quantity, unit_price: item.unitPrice, total: item.totalPrice,
      created_at: new Date(po.createdAt).toLocaleDateString('id-ID'),
      completed_at: po.completedAt ? new Date(po.completedAt).toLocaleDateString('id-ID') : '',
      notes: po.notes ?? '',
    })));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchase Orders');
    XLSX.writeFile(wb, 'purchase-orders-export.xlsx');
  }

  const columns: Column<PO>[] = [
    {
      key: 'poNumber', label: 'No. PO', sortable: true,
      render: po => <span className="font-mono font-medium text-gray-900 text-sm">{po.poNumber}</span>,
    },
    {
      key: 'supplier', label: 'Supplier', sortable: true,
      render: po => <span className="text-gray-700">{po.supplier.name}</span>,
    },
    {
      key: 'items', label: 'Item',
      render: po => <span className="text-gray-500 text-sm">{po.items.length} bahan</span>,
    },
    {
      key: 'totalAmount', label: 'Total', sortable: true, width: 'w-36',
      render: po => <span className="font-medium">{formatCurrency(po.totalAmount)}</span>,
    },
    {
      key: 'status', label: 'Status', width: 'w-28', sortable: true,
      render: po => <Badge variant={STATUS_VARIANT[po.status]}>{STATUS_LABEL[po.status] ?? po.status}</Badge>,
    },
    {
      key: 'createdAt', label: 'Tanggal', sortable: true, width: 'w-28',
      render: po => <span className="text-gray-500 text-sm">{new Date(po.createdAt).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}</span>,
    },
  ];

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Purchase Order</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola pembelian bahan dari supplier</p>
        </div>

        <Toolbar
          filters={[{ key: 'status', label: 'Status', value: statusFilter, onChange: setStatusFilter,
            options: Object.entries(STATUS_LABEL).map(([v,l]) => ({ value: v, label: l })) }]}
          onAdd={openCreate} addLabel="Buat PO"
          onExport={handleExport}
        />

        <DataTable
          data={data} columns={columns} keyField="id" loading={loading}
          emptyMessage="Belum ada purchase order."
          onRowClick={openDetail}
          rowActions={po => po.status === 'DRAFT' ? (
            <>
              <button onClick={e => { e.stopPropagation(); handleAction(po, 'complete'); }}
                className="px-2 py-1 text-xs bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-lg font-medium transition-colors">Terima</button>
              <button onClick={e => { e.stopPropagation(); handleAction(po, 'cancel'); }}
                className="px-2 py-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-medium transition-colors">Batal</button>
            </>
          ) : null}
        />
      </div>

      <SlideOver
        open={slideOpen} onClose={closeSlide} width="lg"
        title={detailPO ? `PO ${detailPO.poNumber}` : 'Buat Purchase Order'}
        subtitle={detailPO ? detailPO.supplier.name : 'Pilih supplier dan tambahkan bahan'}
        footer={detailPO ? (
          detailPO.status === 'DRAFT' ? (
            <div className="flex gap-3 justify-end">
              <Button variant="danger" size="sm" onClick={() => handleAction(detailPO, 'cancel')}>Batalkan PO</Button>
              <Button onClick={() => handleAction(detailPO, 'complete')}>Terima & Update Stok</Button>
            </div>
          ) : null
        ) : (
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={closeSlide} disabled={saving}>Batal</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Menyimpan...' : 'Buat PO'}</Button>
          </div>
        )}
      >
        {/* Detail view */}
        {detailPO ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-gray-400 text-xs">Status</p><Badge variant={STATUS_VARIANT[detailPO.status]}>{STATUS_LABEL[detailPO.status]}</Badge></div>
              <div><p className="text-gray-400 text-xs">Total</p><p className="font-bold text-gray-900">{formatCurrency(detailPO.totalAmount)}</p></div>
              <div><p className="text-gray-400 text-xs">Dibuat</p><p className="text-gray-700">{new Date(detailPO.createdAt).toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' })}</p></div>
              {detailPO.completedAt && <div><p className="text-gray-400 text-xs">Diterima</p><p className="text-gray-700">{new Date(detailPO.completedAt).toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' })}</p></div>}
              {detailPO.notes && <div className="col-span-2"><p className="text-gray-400 text-xs">Catatan</p><p className="text-gray-700">{detailPO.notes}</p></div>}
            </div>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 border-b border-gray-100"><th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Bahan</th><th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Qty</th><th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Harga</th><th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Total</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {detailPO.items.map(item => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">{item.ingredient.name}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{item.quantity} {item.ingredient.unit}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="border-t border-gray-200 bg-gray-50"><td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td><td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(detailPO.totalAmount)}</td></tr></tfoot>
              </table>
            </div>
          </div>
        ) : (
          /* Create form */
          <div className="space-y-4">
            {formError && <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{formError}</div>}
            <div>
              <label className="label">Supplier <span className="text-red-400">*</span></label>
              <select className="select w-full" value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })}>
                <option value="">— Pilih supplier —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Item Pembelian <span className="text-red-400">*</span></label>
                <button onClick={addItem} className="text-sm text-brand-600 font-medium hover:underline">+ Tambah item</button>
              </div>
              <div className="space-y-2">
                {form.items.map((item, i) => {
                  const ing = ingredients.find(x => x.id === item.ingredientId);
                  return (
                    <div key={i} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-5">
                        <select className="select w-full" value={item.ingredientId} onChange={e => updateItem(i, 'ingredientId', e.target.value)}>
                          <option value="">Pilih bahan</option>
                          {ingredients.map(x => <option key={x.id} value={x.id}>{x.name} ({x.unit})</option>)}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input className="input w-full" type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
                        {ing?.purchaseUnit && <p className="text-xs text-gray-400 mt-0.5">{ing.purchaseUnit}</p>}
                      </div>
                      <div className="col-span-3">
                        <input className="input w-full" type="number" placeholder="Harga/unit" value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', e.target.value)} />
                        {item.quantity && item.unitPrice && <p className="text-xs text-gray-400 mt-0.5">{formatCurrency((parseFloat(item.quantity)||0)*(parseFloat(item.unitPrice)||0))}</p>}
                      </div>
                      <div className="col-span-1 pt-2">
                        <button onClick={() => removeItem(i)} className="p-1.5 text-red-400 hover:text-red-600">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {form.items.length > 0 && (
                <div className="flex justify-end mt-3 pt-3 border-t border-gray-100">
                  <span className="text-sm font-semibold text-gray-900">Total: {formatCurrency(formTotal)}</span>
                </div>
              )}
            </div>

            <div>
              <label className="label">Catatan</label>
              <textarea className="input w-full" rows={2} placeholder="Catatan tambahan..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex items-center gap-3 p-3 bg-brand-50 rounded-xl">
              <input type="checkbox" id="markComplete" checked={form.markComplete} onChange={e => setForm({ ...form, markComplete: e.target.checked })} className="rounded border-gray-300 text-brand-600" />
              <label htmlFor="markComplete" className="text-sm text-brand-800 font-medium">Langsung terima & update stok sekarang</label>
            </div>
          </div>
        )}
      </SlideOver>
    </AdminLayout>
  );
}
