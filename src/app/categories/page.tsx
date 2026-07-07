'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Badge, Button, Loader } from '@/components/ui';
import { DataTable, Column } from '@/components/ui/DataTable';
import { SlideOver } from '@/components/ui/SlideOver';
import { Toolbar } from '@/components/ui/Toolbar';
import { api } from '@/lib/fetch';
import * as XLSX from 'xlsx';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  sortOrder: number;
  createdAt: string;
  _count: { products: number };
}

const PRESET_COLORS = [
  '#22c55e','#3b82f6','#f59e0b','#ef4444','#8b5cf6',
  '#ec4899','#14b8a6','#f97316','#6366f1','#84cc16',
];

const emptyForm = { name: '', color: '#22c55e', icon: '', sortOrder: '' };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const [data, setData]         = useState<Category[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing]   = useState<Category | null>(null);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await api.get<Category[]>(`/api/categories${params}`);
      setData(res);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  // ── Form helpers ──────────────────────────────────────────────────────────

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setSlideOpen(true);
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    setForm({ name: cat.name, color: cat.color, icon: cat.icon ?? '', sortOrder: String(cat.sortOrder) });
    setError('');
    setSlideOpen(true);
  }

  function closeSlide() {
    setSlideOpen(false);
    setEditing(null);
    setError('');
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Nama kategori wajib diisi'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        name: form.name.trim(),
        color: form.color,
        icon: form.icon || null,
        sortOrder: parseInt(form.sortOrder) || 0,
      };
      if (editing) {
        await api.patch('/api/categories', { id: editing.id, ...payload });
      } else {
        await api.post('/api/categories', payload);
      }
      closeSlide();
      load();
    } catch (e: any) {
      setError(e?.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(cat: Category) {
    if (cat._count.products > 0) {
      alert(`Kategori "${cat.name}" masih dipakai ${cat._count.products} produk. Pindahkan produk dulu.`);
      return;
    }
    if (!confirm(`Hapus kategori "${cat.name}"?`)) return;
    try {
      await api.delete('/api/categories', { id: cat.id });
      load();
    } catch (e: any) {
      alert(e?.message || 'Gagal menghapus');
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────

  function handleExport() {
    const rows = data.map(c => ({
      id: c.id, name: c.name, color: c.color,
      icon: c.icon ?? '', sort_order: c.sortOrder,
      product_count: c._count.products,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kategori');
    XLSX.writeFile(wb, 'kategori-export.xlsx');
  }

  function handleDownloadTemplate() {
    const rows = [{ name: 'Contoh Kategori', color: '#22c55e', icon: '', sort_order: 0 }];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kategori');
    XLSX.writeFile(wb, 'kategori-template.xlsx');
  }

  async function handleImport(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]]);
      if (!rows.length) { alert('File kosong'); return; }

      let ok = 0; const errors: string[] = [];
      for (const [i, row] of rows.entries()) {
        if (!row.name) { errors.push(`Baris ${i + 2}: kolom 'name' wajib diisi`); continue; }
        try {
          await api.post('/api/categories', {
            name: String(row.name).trim(),
            color: row.color || '#22c55e',
            icon: row.icon || null,
            sortOrder: parseInt(row.sort_order) || 0,
          });
          ok++;
        } catch (e: any) {
          errors.push(`Baris ${i + 2} "${row.name}": ${e?.message}`);
        }
      }
      alert(`Import selesai: ${ok} berhasil${errors.length ? `\n\nGagal:\n${errors.join('\n')}` : ''}`);
      load();
    } catch {
      alert('Gagal membaca file. Pastikan format Excel (.xlsx).');
    }
  }

  // ── Bulk delete ───────────────────────────────────────────────────────────

  async function handleBulkDelete() {
    const toDelete = data.filter(c => selected.includes(c.id));
    const hasProducts = toDelete.filter(c => c._count.products > 0);
    if (hasProducts.length) {
      alert(`${hasProducts.map(c => `"${c.name}" (${c._count.products} produk)`).join(', ')} tidak bisa dihapus karena masih ada produk.`);
      return;
    }
    if (!confirm(`Hapus ${selected.length} kategori?`)) return;
    await Promise.all(selected.map(id => api.delete('/api/categories', { id })));
    setSelected([]);
    load();
  }

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns: Column<Category>[] = [
    {
      key: 'name', label: 'Nama', sortable: true,
      render: cat => (
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: cat.color }}>
            {cat.icon || cat.name.charAt(0).toUpperCase()}
          </div>
          <span className="font-medium text-gray-900">{cat.name}</span>
        </div>
      ),
    },
    {
      key: 'color', label: 'Warna', width: 'w-28',
      render: cat => (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: cat.color }} />
          <span className="text-xs text-gray-500 font-mono">{cat.color}</span>
        </div>
      ),
    },
    {
      key: 'products', label: 'Produk', sortable: true, width: 'w-24',
      render: cat => (
        <Badge variant={cat._count.products > 0 ? 'success' : 'default'}>
          {cat._count.products} produk
        </Badge>
      ),
    },
    {
      key: 'sortOrder', label: 'Urutan', sortable: true, width: 'w-20',
      render: cat => <span className="text-gray-500 text-sm">{cat.sortOrder}</span>,
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Kategori</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola kategori menu dan produk</p>
        </div>

        <Toolbar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Cari kategori..."
          onAdd={openAdd}
          addLabel="Kategori Baru"
          onExport={handleExport}
          onDownloadTemplate={handleDownloadTemplate}
          onImport={handleImport}
          selected={selected}
          bulkActions={
            <Button variant="danger" size="sm" onClick={handleBulkDelete}>
              Hapus {selected.length} dipilih
            </Button>
          }
        />

        <DataTable
          data={data}
          columns={columns}
          keyField="id"
          loading={loading}
          emptyMessage="Belum ada kategori. Klik 'Kategori Baru' untuk menambah."
          selected={selected}
          onSelectChange={setSelected}
          rowActions={cat => (
            <>
              <button onClick={() => openEdit(cat)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors" title="Edit">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button onClick={() => handleDelete(cat)}
                className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors" title="Hapus">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                </svg>
              </button>
            </>
          )}
        />
      </div>

      {/* SlideOver Form */}
      <SlideOver
        open={slideOpen}
        onClose={closeSlide}
        title={editing ? 'Edit Kategori' : 'Kategori Baru'}
        subtitle={editing ? editing.name : 'Isi detail kategori baru'}
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={closeSlide} disabled={saving}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Buat Kategori'}
            </Button>
          </div>
        }
      >
        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Name */}
        <div>
          <label className="label">Nama Kategori <span className="text-red-400">*</span></label>
          <input
            className="input w-full"
            placeholder="cth. Minuman, Makanan, Snack..."
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            autoFocus
          />
        </div>

        {/* Color */}
        <div>
          <label className="label">Warna</label>
          <div className="flex items-center gap-3 flex-wrap">
            {PRESET_COLORS.map(c => (
              <button key={c} type="button"
                onClick={() => setForm({ ...form, color: c })}
                className="w-7 h-7 rounded-full transition-transform hover:scale-110 border-2"
                style={{
                  backgroundColor: c,
                  borderColor: form.color === c ? 'white' : 'transparent',
                  boxShadow: form.color === c ? `0 0 0 2px ${c}` : undefined,
                }}
              />
            ))}
            <input
              type="color"
              value={form.color}
              onChange={e => setForm({ ...form, color: e.target.value })}
              className="w-7 h-7 rounded-full cursor-pointer border border-gray-200"
              title="Pilih warna custom"
            />
          </div>
          {/* Preview */}
          <div className="mt-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: form.color }}>
              {form.icon || form.name.charAt(0).toUpperCase() || '?'}
            </div>
            <span className="text-sm text-gray-600">Preview</span>
          </div>
        </div>

        {/* Icon (emoji/text) */}
        <div>
          <label className="label">Ikon <span className="text-gray-400 font-normal">(opsional, emoji atau huruf)</span></label>
          <input
            className="input w-full"
            placeholder="cth. ☕ atau M"
            value={form.icon}
            maxLength={4}
            onChange={e => setForm({ ...form, icon: e.target.value })}
          />
        </div>

        {/* Sort order */}
        <div>
          <label className="label">Urutan <span className="text-gray-400 font-normal">(angka lebih kecil = tampil duluan)</span></label>
          <input
            className="input w-full"
            type="number"
            placeholder="0"
            value={form.sortOrder}
            onChange={e => setForm({ ...form, sortOrder: e.target.value })}
          />
        </div>
      </SlideOver>
    </AdminLayout>
  );
}
