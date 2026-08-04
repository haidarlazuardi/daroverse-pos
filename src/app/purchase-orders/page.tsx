'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, Button, formatCurrency } from '@/components/ui';
import { DataTable, Column } from '@/components/ui/DataTable';
import { SlideOver } from '@/components/ui/SlideOver';
import { Toolbar } from '@/components/ui/Toolbar';
import { api } from '@/lib/fetch';
import IngredientPicker from '@/components/ui/IngredientPicker';
import clsx from 'clsx';
import * as XLSX from 'xlsx';
import { isConnected, pairAndConnect, printData } from '@/lib/bluetooth-printer';
import { buildQRLabel } from '@/lib/escpos';

interface POItem { id: string; quantity: number; unitPrice: number; totalPrice: number; ingredient: { id: string; name: string; unit: string; purchaseUnit: string | null; conversionRate: number | null } }
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
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [slideOpen, setSlideOpen] = useState(false);
  const [detailPO, setDetailPO]   = useState<PO | null>(null);
  const [saving, setSaving]         = useState(false);
  const [printingLabels, setPrintingLabels] = useState(false);
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

  async function openDetail(po: PO) {
    // Re-fetch untuk pastikan items ter-include
    try {
      const full = await api.get<PO>(`/api/purchase-orders/${po.id}`);
      setDetailPO(full || po);
    } catch {
      setDetailPO(po);
    }
    setSlideOpen(true);
  }

  function printPO(po: PO) {
    if (!po.items || po.items.length === 0) {
      alert(`PO ${po.poNumber} tidak memiliki item. Kemungkinan item belum tersimpan saat PO dibuat.`);
      return;
    }
    const date = new Date(po.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const rows = po.items.map((item, i) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${i + 1}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${item.ingredient.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${item.quantity} ${item.ingredient.purchaseUnit || item.ingredient.unit}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">Rp ${item.unitPrice.toLocaleString('id-ID')}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">Rp ${(item.quantity * item.unitPrice).toLocaleString('id-ID')}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>PO ${po.poNumber}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; margin: 0; padding: 32px; }
  h1 { font-size: 22px; margin: 0 0 4px; color: #2D4A32; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; border-bottom: 2px solid #2D4A32; padding-bottom: 16px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: bold; background: #e8f5e9; color: #2D4A32; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  .info-box { background: #f9f9f7; border-radius: 8px; padding: 12px 16px; }
  .info-box p { margin: 0; line-height: 1.7; }
  .info-label { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; color: #888; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  thead tr { background: #2D4A32; color: white; }
  thead th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: bold; text-transform: uppercase; }
  thead th:last-child, thead th:nth-child(4), thead th:nth-child(3) { text-align: right; }
  thead th:nth-child(1) { text-align: center; }
  .total-row { background: #f0f4f0; font-weight: bold; }
  .total-row td { padding: 10px 12px; }
  .footer { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; }
  .sign-box { text-align: center; }
  .sign-line { border-top: 1px solid #ccc; margin-top: 60px; padding-top: 8px; font-size: 11px; color: #666; }
  @media print { body { padding: 16px; } }
</style></head><body>
<div class="header">
  <div>
    <h1>PURCHASE ORDER</h1>
    <p style="margin:4px 0 8px;color:#666">Soeka House — Jl. Raya Tajur, Bogor</p>
    <span class="badge">${po.status}</span>
  </div>
  <div style="text-align:right">
    <p style="font-size:20px;font-weight:bold;color:#2D4A32;margin:0">${po.poNumber}</p>
    <p style="margin:4px 0 0;color:#666">${date}</p>
  </div>
</div>

<div class="info-grid">
  <div class="info-box">
    <p class="info-label">Supplier</p>
    <p style="font-size:15px;font-weight:bold;margin-top:4px">${po.supplier.name}</p>
  </div>
  <div class="info-box">
    <p class="info-label">Catatan</p>
    <p style="margin-top:4px">${po.notes || '—'}</p>
  </div>
</div>

<table>
  <thead><tr>
    <th style="width:40px">No</th>
    <th>Nama Bahan</th>
    <th style="text-align:center">Qty</th>
    <th style="text-align:right">Harga Satuan</th>
    <th style="text-align:right">Subtotal</th>
  </tr></thead>
  <tbody>${rows}</tbody>
  <tfoot>
    <tr class="total-row">
      <td colspan="4" style="text-align:right;padding:10px 12px;font-weight:bold">TOTAL</td>
      <td style="text-align:right;padding:10px 12px;font-weight:bold;font-size:15px;color:#2D4A32">Rp ${po.totalAmount.toLocaleString('id-ID')}</td>
    </tr>
  </tfoot>
</table>

<div class="footer">
  <div class="sign-box"><div class="sign-line">Dibuat oleh</div></div>
  <div class="sign-box"><div class="sign-line">Disetujui oleh</div></div>
  <div class="sign-box"><div class="sign-line">Diterima oleh</div></div>
</div>

<script>window.onload = () => { window.print(); }</script>
</body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  }

  async function printLabels(po: PO) {
    if (!po.items?.length) { alert('Tidak ada item'); return; }
    setPrintingLabels(true);
    try {
    if (!isConnected()) {
      try { await pairAndConnect(); } catch { alert('Printer belum terhubung'); return; }
    }
    const batchDate = (po.completedAt || po.createdAt).slice(0, 10);
    for (const item of po.items) {
      const convRate = item.ingredient.conversionRate || 1;
      const pu = item.ingredient.purchaseUnit || item.ingredient.unit;
      const numLabels = Math.ceil(item.quantity);
      const baseUrl = window.location.origin;
      for (let i = 0; i < numLabels; i++) {
        // QR = URL yang bisa dibuka di HP langsung
        const qrText = `${baseUrl}/scan/${item.ingredient.id}`;
        const data = await buildQRLabel({
          name: item.ingredient.name,
          qrText,
          line1: convRate.toLocaleString('id-ID') + ' ' + item.ingredient.unit,
          line2: '1 ' + pu + ' · ' + batchDate,
          line3: po.poNumber.slice(-12),
        });
        await printData(data).catch(() => {});
      }
    }
    } finally { setPrintingLabels(false); }
  }


  function closeSlide() { setSlideOpen(false); setDetailPO(null); setFormError(''); }

  function addItem() { setForm({ ...form, items: [...form.items, { ingredientId: '', quantity: '', unitPrice: '' }] }); }
  function removeItem(i: number) { setForm({ ...form, items: form.items.filter((_, j) => j !== i) }); }
  function updateItem(i: number, field: string, value: string) {
    const items = [...form.items];
    (items[i] as any)[field] = value;
    // Auto-fill price dari ingredient — pakai harga per satuan BELI
    if (field === 'ingredientId') {
      const ing = ingredients.find(x => x.id === value);
      if (ing) {
        // harga per purchase unit = latestPrice (per base unit) × conversionRate
        const pricePerPurchaseUnit = ing.conversionRate
          ? Math.round(ing.latestPrice * ing.conversionRate)
          : ing.latestPrice;
        items[i].unitPrice = String(pricePerPurchaseUnit);
      }
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

  const [viewMode, setViewMode] = useState<'po'|'requests'>('po');
  const [requests, setRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  async function loadRequests() {
    setLoadingRequests(true);
    const r = await api.get<any[]>('/api/purchase-requests?status=PENDING').catch(() => []);
    setRequests(Array.isArray(r) ? r : []);
    setLoadingRequests(false);
  }

  useEffect(() => { if (viewMode === 'requests') loadRequests(); }, [viewMode]);

  async function generatePO(requestId: string, supplierId: string) {
    if (!supplierId) { alert('Pilih supplier dulu'); return; }
    try {
      // 1. Ambil detail request
      const reqs = await api.get<any[]>(`/api/purchase-requests?status=PENDING`).catch(() => []);
      const req = Array.isArray(reqs) ? reqs.find((r: any) => r.id === requestId) : null;
      if (!req) { alert('Request tidak ditemukan'); return; }

      // 2. Buat PO dari items request
      const items = req.items.map((item: any) => ({
        ingredientId: item.ingredientId,
        quantity: item.quantity,
        unitPrice: item.ingredient?.latestPrice && item.ingredient?.conversionRate
          ? item.ingredient.latestPrice * item.ingredient.conversionRate
          : 0,
      }));

      const po = await api.post<any>('/api/purchase-orders', {
        supplierId,
        notes: `Dari request staff: ${req.user?.name} — ${new Date(req.createdAt).toLocaleDateString('id-ID')}`,
        items,
      });

      // 3. Mark request as FULFILLED
      await api.patch('/api/purchase-requests', { id: requestId, status: 'FULFILLED' }).catch(() => {});

      alert(`✅ PO ${po.poNumber || po.po?.poNumber || ''} berhasil dibuat sebagai Draft`);
      loadRequests();
    } catch (e: any) { alert(e.message); }
  }

  async function rejectRequest(requestId: string) {
    if (!confirm('Tolak request ini?')) return;
    await api.patch('/api/purchase-requests', { id: requestId, status: 'REJECTED' });
    loadRequests();
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Purchase Order</h1>
            <p className="text-sm text-gray-500 mt-1">Kelola pembelian bahan dari supplier</p>
          </div>
          <div className="flex gap-1 p-1 rounded-xl" style={{ background:'var(--surface-2)' }}>
            <button onClick={() => setViewMode('po')}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={viewMode==='po' ? {background:'white',color:'var(--text-1)',boxShadow:'0 1px 3px rgba(0,0,0,0.1)'} : {color:'var(--text-3)'}}>
              Purchase Orders
            </button>
            <button onClick={() => setViewMode('requests')}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all relative"
              style={viewMode==='requests' ? {background:'white',color:'var(--text-1)',boxShadow:'0 1px 3px rgba(0,0,0,0.1)'} : {color:'var(--text-3)'}}>
              Requests Staff
              {requests.length > 0 && viewMode !== 'requests' && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs text-white flex items-center justify-center" style={{ background:'#DC2626' }}>{requests.length}</span>
              )}
            </button>
          </div>
        </div>

        {viewMode === 'requests' && (
          <RequestsView requests={requests} suppliers={suppliers} loading={loadingRequests} onRefresh={loadRequests}/>
        )}

        {viewMode === 'po' && (
          <div>
            <Toolbar
              search={search} onSearch={setSearch} searchPlaceholder="Cari no PO atau supplier..."
              filters={[{ key: 'status', label: 'Status', value: statusFilter, onChange: setStatusFilter,
                options: Object.entries(STATUS_LABEL).map(([v,l]) => ({ value: v, label: l as string })) }]}
              onAdd={openCreate} addLabel="Buat PO"
              onExport={handleExport}
            />

            <DataTable
              data={data.filter(po => !search || po.poNumber?.toLowerCase().includes(search.toLowerCase()) || po.supplier?.name?.toLowerCase().includes(search.toLowerCase()))} columns={columns} keyField="id" loading={loading}
              onRowClick={openDetail}
              rowActions={po => (
                <div className="flex gap-1">
                  <button onClick={e => { e.stopPropagation(); printPO(po); }}
                    className="px-2 py-1 text-xs bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">PDF</button>
                  {po.status === 'COMPLETED' && (
                    <button onClick={e => { e.stopPropagation(); printLabels(po); }}
                      disabled={printingLabels}
                      className="px-2 py-1 text-xs bg-green-50 text-green-700 hover:bg-green-100 rounded-lg font-medium transition-colors">
                      {printingLabels ? '...' : '🏷️'}
                    </button>
                  )}
                  {po.status === 'DRAFT' && <>
                    <button onClick={e => { e.stopPropagation(); handleAction(po, 'complete'); }}
                      className="px-2 py-1 text-xs bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-lg font-medium transition-colors">Terima</button>
                    <button onClick={e => { e.stopPropagation(); handleAction(po, 'cancel'); }}
                      className="px-2 py-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-medium transition-colors">Batal</button>
                  </>}
                </div>
              )}
            />
          </div>
        )}
      </div>

      <SlideOver
        open={slideOpen} onClose={closeSlide} width="lg"
        title={detailPO ? `PO ${detailPO.poNumber}` : 'Buat Purchase Order'}
        subtitle={detailPO ? detailPO.supplier.name : 'Pilih supplier dan tambahkan bahan'}
        footer={detailPO ? (
          detailPO.status === 'DRAFT' ? (
            <div className="flex gap-3 justify-end">
              <button onClick={() => printPO(detailPO)} className="btn btn-secondary btn-md">🖨️ Print PDF</button>
              <Button variant="danger" size="sm" onClick={() => handleAction(detailPO, 'cancel')}>Batalkan PO</Button>
              <Button onClick={() => handleAction(detailPO, 'complete')}>Terima & Update Stok</Button>
            </div>
          ) : (
            <div className="flex gap-3 justify-end">
              <button onClick={() => printPO(detailPO)} className="btn btn-secondary btn-md">🖨️ Print PDF</button>
              <button onClick={() => printLabels(detailPO)} disabled={printingLabels} className="btn btn-primary btn-md">
                {printingLabels ? '⏳ Generating QR...' : '🏷️ Print Label QR'}
              </button>
            </div>
          )
        ) : (
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={closeSlide}>Batal</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Menyimpan...' : 'Buat PO'}</Button>
          </div>
        )}
      >
        {detailPO ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-gray-400 text-xs">Status</p><p className="font-medium">{STATUS_LABEL[detailPO.status] || detailPO.status}</p></div>
              <div><p className="text-gray-400 text-xs">Total</p><p className="font-bold text-lg">{formatCurrency(detailPO.totalAmount)}</p></div>
              <div><p className="text-gray-400 text-xs">Dibuat</p><p className="font-medium">{new Date(detailPO.createdAt).toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' })}</p></div>
              {detailPO.completedAt && <div><p className="text-gray-400 text-xs">Diterima</p><p className="font-medium">{new Date(detailPO.completedAt).toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' })}</p></div>}
            </div>
            {detailPO.notes && <div><p className="text-gray-400 text-xs">Catatan</p><p className="text-sm">{detailPO.notes}</p></div>}
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-gray-50"><th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Bahan</th><th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th><th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Harga</th><th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th></tr></thead>
              <tbody>
                {(detailPO.items || []).map((item: any) => (
                  <tr key={item.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium">{item.ingredient.name}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {item.quantity} {item.ingredient.purchaseUnit || item.ingredient.unit}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.totalPrice)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-200 bg-gray-50"><td colSpan={3} className="px-4 py-2.5 text-right font-semibold">Total</td><td className="px-4 py-2.5 text-right font-bold">{formatCurrency(detailPO.totalAmount)}</td></tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="label">Supplier *</label>
              <select value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })} className="select w-full">
                <option value="">Pilih supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Catatan</label>
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="input w-full" placeholder="Opsional"/>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Item Pembelian *</label>
                <button type="button" onClick={addItem} className="text-sm text-brand-600 font-medium hover:text-brand-700">+ Tambah item</button>
              </div>
              <div className="space-y-2">
                {form.items.map((item, i) => {
                  const ing = ingredients.find(x => x.id === item.ingredientId);
                  const purchaseUnit = ing?.purchaseUnit || ing?.unit || 'unit';
                  const pricePerUnit = parseFloat(item.unitPrice) || 0;
                  const qty = parseFloat(item.quantity) || 0;
                  return (
                    <div key={i} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-5">
                        <IngredientPicker ingredients={ingredients} value={item.ingredientId}
                          onChange={v => updateItem(i, 'ingredientId', v)} showUnit={true}/>
                        {ing && <p className="text-xs text-gray-400 mt-0.5">Stok: {ing.unit} · Beli: {ing.purchaseUnit || ing.unit}</p>}
                      </div>
                      <div className="col-span-3">
                        <input className="input w-full" type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
                        <p className="text-xs text-gray-400 mt-0.5">{purchaseUnit}</p>
                      </div>
                      <div className="col-span-3">
                        <input className="input w-full" type="number" placeholder={`Harga/${purchaseUnit}`} value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', e.target.value)} />
                        <p className="text-xs text-gray-400 mt-0.5">
                          {qty > 0 && pricePerUnit > 0 ? formatCurrency(qty * pricePerUnit) : `per ${purchaseUnit}`}
                        </p>
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
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex justify-between font-semibold"><span>Total</span><span>{formatCurrency(formTotal)}</span></div>
              </div>
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

// ── RequestsView — flat item list with per-item supplier assignment ─────────
function RequestsView({ requests, suppliers, loading, onRefresh }: any) {
  // Flatten all items from all pending requests
  const [supplierMap, setSupplierMap] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [rejecting, setRejecting] = useState<string | null>(null);

  // Build flat item list: { key, requestId, requestedBy, ingredientId, name, qty, unit, estPrice }
  const allItems = requests.flatMap((req: any) =>
    req.items.map((item: any) => ({
      key:         `${req.id}-${item.id}`,
      requestId:   req.id,
      itemId:      item.id,
      requestedBy: req.user?.name || '—',
      createdAt:   req.createdAt,
      ingredientId: item.ingredientId,
      name:        item.ingredient?.name || '—',
      qty:         item.quantity,
      unit:        item.unit,
      estPrice:    (item.ingredient?.latestPrice || 0) * (item.ingredient?.conversionRate || 1) * item.quantity,
    }))
  );

  // Auto-assign dari defaultSupplierId per bahan
  useEffect(() => {
    if (!requests.length || !suppliers.length) return;
    const autoMap: Record<string, string> = {};
    requests.flatMap((req: any) => req.items).forEach((item: any) => {
      const key = `${item.requestId || ''}-${item.id}`;
      const defSup = item.ingredient?.defaultSupplierId;
      if (defSup) autoMap[key] = defSup;
    });
    if (Object.keys(autoMap).length > 0) {
      setSupplierMap(prev => ({ ...autoMap, ...prev })); // prev wins (user override)
    }
  }, [requests, suppliers]);

  const setSupplier = (key: string, supplierId: string) =>
    setSupplierMap(p => ({ ...p, [key]: supplierId }));

  // Preview: group by supplier
  const assignedItems = allItems.filter(i => supplierMap[i.key]);
  const unassignedCount = allItems.length - assignedItems.length;

  const preview = assignedItems.reduce((acc: any, item: any) => {
    const sid = supplierMap[item.key];
    if (!acc[sid]) acc[sid] = { name: suppliers.find((s: any) => s.id === sid)?.name || sid, items: [] };
    acc[sid].items.push(item);
    return acc;
  }, {} as Record<string, { name: string; items: any[] }>);

  async function generateAll() {
    if (unassignedCount > 0) {
      if (!confirm(`${unassignedCount} bahan belum di-assign supplier. Generate PO untuk yang sudah di-assign saja?`)) return;
    }
    if (Object.keys(preview).length === 0) { alert('Tidak ada item yang di-assign'); return; }
    setGenerating(true);
    try {
      const poNumbers: string[] = [];
      const fulfilledRequestIds = new Set<string>();

      for (const [supplierId, group] of Object.entries(preview) as [string, any][]) {
        // Build PO items
        const poItems = group.items.map((item: any) => ({
          ingredientId: item.ingredientId,
          quantity:     item.qty,
          unitPrice:    item.estPrice / item.qty || 0,
        }));

        const po = await api.post<any>('/api/purchase-orders', {
          supplierId,
          notes: `Dari request staff: ${[...new Set(group.items.map((i: any) => i.requestedBy))].join(', ')}`,
          items: poItems,
        });
        poNumbers.push(po.poNumber || po.po?.poNumber || supplierId);

        // Mark request IDs fulfilled
        group.items.forEach((i: any) => fulfilledRequestIds.add(i.requestId));
      }

      // Mark all fulfilled requests
      for (const rid of fulfilledRequestIds) {
        await api.patch('/api/purchase-requests', { id: rid, status: 'FULFILLED' }).catch(() => {});
      }

      setSupplierMap({});
      alert(`✅ ${poNumbers.length} PO berhasil dibuat:\n${poNumbers.join(', ')}`);
      onRefresh();
    } catch(e: any) {
      alert('Gagal: ' + e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function rejectRequest(requestId: string) {
    if (!confirm('Tolak seluruh request ini?')) return;
    setRejecting(requestId);
    try {
      await api.patch('/api/purchase-requests', { id: requestId, status: 'REJECTED' });
      onRefresh();
    } catch(e: any) { alert(e.message); }
    finally { setRejecting(null); }
  }

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor:'var(--brand)', borderTopColor:'transparent' }}/>
    </div>
  );

  if (allItems.length === 0) return (
    <div className="card text-center py-12">
      <p className="text-3xl mb-2">📋</p>
      <p style={{ color:'var(--text-3)' }}>Tidak ada request pending dari staff</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color:'var(--text-3)' }}>
        Assign supplier per bahan, lalu generate PO sekaligus. Bahan dari supplier yang sama otomatis digabung dalam 1 PO.
      </p>

      {/* Flat item table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b flex justify-between items-center" style={{ borderColor:'var(--border)', background:'var(--surface-2)' }}>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color:'var(--text-3)' }}>
            {allItems.length} item dari {requests.length} request
          </p>
          {unassignedCount > 0 && (
            <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background:'var(--surface-1)', color:'var(--text-3)' }}>
              {unassignedCount} belum di-assign
            </span>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background:'var(--surface-2)', borderBottom:'1px solid var(--border)' }}>
              {['Bahan','Qty','Diminta oleh','Est. Harga','Supplier',''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase" style={{ color:'var(--text-3)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor:'var(--border)' }}>
            {allItems.map(item => (
              <tr key={item.key} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-3 font-semibold" style={{ color:'var(--text-1)' }}>{item.name}</td>
                <td className="px-3 py-3 font-bold" style={{ color:'var(--brand)' }}>{item.qty} {item.unit}</td>
                <td className="px-3 py-3">
                  <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background:'var(--surface-2)', color:'var(--text-2)' }}>
                    {item.requestedBy}
                  </span>
                </td>
                <td className="px-3 py-3 text-sm" style={{ color:'var(--text-3)' }}>
                  {item.estPrice > 0 ? formatCurrency(Math.round(item.estPrice)) : '—'}
                </td>
                <td className="px-3 py-3" style={{ minWidth: 180 }}>
                  <select
                    value={supplierMap[item.key] || ''}
                    onChange={e => setSupplier(item.key, e.target.value)}
                    className="input text-sm w-full"
                    style={{
                      borderColor: supplierMap[item.key] ? 'var(--brand)' : 'var(--border)',
                      color: supplierMap[item.key] ? 'var(--brand)' : 'var(--text-3)',
                    }}>
                    <option value="">Pilih supplier...</option>
                    {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </td>
                <td className="px-3 py-3">
                  <button onClick={() => rejectRequest(item.requestId)}
                    disabled={rejecting === item.requestId}
                    className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors">
                    Tolak
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Preview grouping */}
      {Object.keys(preview).length > 0 && (
        <div className="rounded-xl p-4 border" style={{ borderColor:'var(--brand)', background:'var(--brand)08' }}>
          <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color:'var(--brand)' }}>
            Preview PO yang akan dibuat ({Object.keys(preview).length} PO)
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(preview).map(([sid, group]: [string, any]) => (
              <div key={sid} className="rounded-xl px-3 py-2 border bg-white" style={{ borderColor:'var(--border)' }}>
                <p className="text-sm font-bold" style={{ color:'var(--text-1)' }}>{group.name}</p>
                <p className="text-xs mt-0.5" style={{ color:'var(--text-3)' }}>
                  {group.items.length} bahan · {formatCurrency(Math.round(group.items.reduce((s: number, i: any) => s + i.estPrice, 0)))}
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {group.items.map((i: any) => (
                    <span key={i.key} className="text-xs px-1.5 py-0.5 rounded" style={{ background:'var(--surface-2)', color:'var(--text-2)' }}>
                      {i.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {unassignedCount > 0 && (
              <div className="rounded-xl px-3 py-2 border" style={{ borderColor:'var(--border)', background:'var(--surface-2)' }}>
                <p className="text-sm font-bold" style={{ color:'var(--text-3)' }}>{unassignedCount} bahan</p>
                <p className="text-xs mt-0.5" style={{ color:'var(--text-3)' }}>belum di-assign</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button onClick={() => setSupplierMap({})} className="btn btn-secondary btn-md">Reset</button>
        <Button
          onClick={generateAll}
          disabled={generating || Object.keys(preview).length === 0}>
          {generating ? 'Membuat PO...' : `🛒 Generate ${Object.keys(preview).length} PO`}
        </Button>
      </div>
    </div>
  );
}
