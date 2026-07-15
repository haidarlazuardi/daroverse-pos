'use client';
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/fetch';

const FORMS = [
  { id: 'so',        label: 'Stock Opname',          icon: '📋', desc: 'Cek stok aktual semua bahan & bahan olahan', orientation: 'landscape' },
  { id: 'produksi',  label: 'Produksi Batch',         icon: '🧪', desc: 'Pencatatan produksi bahan olahan', orientation: 'portrait' },
  { id: 'transfer',  label: 'Transfer Stok',          icon: '🔄', desc: 'Perpindahan stok antar lokasi', orientation: 'portrait' },
  { id: 'po',        label: 'Purchase Order Manual',  icon: '🛒', desc: 'Pembelian bahan ke supplier', orientation: 'landscape' },
  { id: 'terima',    label: 'Penerimaan Barang',      icon: '📦', desc: 'Cek barang masuk dari supplier', orientation: 'portrait' },
  { id: 'bon',       label: 'Bon Pengeluaran',        icon: '💸', desc: 'Pencatatan pengeluaran operasional', orientation: 'portrait' },
];

export default function FormsPage() {
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [suppliers, setSuppliers]     = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<any[]>('/api/ingredients?active=true'),
      api.get<any[]>('/api/suppliers'),
    ]).then(([ings, sups]) => {
      setIngredients(ings);
      setSuppliers(sups);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function printForm(id: string) {
    const raw     = ingredients.filter(i => i.type === 'RAW' && i.active);
    const prepped = ingredients.filter(i => i.type === 'PREPPED' && i.active);
    const gudang  = raw.filter(i => !i.defaultLocation || i.defaultLocation === 'GUDANG');
    const bar     = raw.filter(i => i.defaultLocation === 'BAR');
    const dapur   = raw.filter(i => i.defaultLocation === 'KITCHEN');

    const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    const LOGO = `<div style="display:flex;align-items:center;gap:12px">
      <div style="width:48px;height:48px;background:#48654D;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#F6EDDB;font-family:Arial">S</div>
      <div><div style="font-size:18px;font-weight:900;letter-spacing:-0.5px">SOEKA HOUSE</div><div style="font-size:10px;color:#666">Bogor</div></div>
    </div>`;

    const CSS = `<style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: Arial, sans-serif; font-size: 10px; color: #111; padding: 20px; }
      h1 { font-size: 14px; font-weight: 900; }
      h2 { font-size: 11px; font-weight: 700; margin: 12px 0 4px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1.5px solid #000; padding-bottom: 3px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
      th { background: #111; color: #fff; padding: 5px 6px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; }
      td { border: 1px solid #ccc; padding: 6px; font-size: 10px; }
      td.write { background: #fafafa; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 2px solid #000; padding-bottom: 12px; }
      .meta { display: flex; gap: 24px; margin-bottom: 12px; }
      .meta-item { display: flex; flex-direction: column; gap: 2px; }
      .meta-label { font-size: 8px; font-weight: 700; text-transform: uppercase; color: #666; }
      .meta-value { border-bottom: 1px solid #000; min-width: 120px; height: 16px; }
      .footer { margin-top: 16px; display: flex; gap: 40px; }
      .sign { flex: 1; text-align: center; }
      .sign-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 4px; font-size: 9px; }
      .small { font-size: 8px; color: #666; }
      @media print { body { padding: 10px; } }
    </style>`;

    const metaRow = (label: string, span = 1) =>
      `<div class="meta-item" style="flex:${span}"><div class="meta-label">${label}</div><div class="meta-value"></div></div>`;

    let html = '';

    if (id === 'so') {
      const section = (title: string, items: any[]) => `
        <h2>${title}</h2>
        <table>
          <thead><tr>
            <th style="width:30px">No</th>
            <th>Nama Bahan</th>
            <th style="width:60px">Satuan</th>
            <th style="width:80px">Qty Aktual</th>
            <th style="width:80px">Kondisi</th>
            <th>Keterangan</th>
          </tr></thead>
          <tbody>
            ${items.map((i, idx) => `<tr>
              <td style="text-align:center">${idx + 1}</td>
              <td>${i.name}</td>
              <td style="text-align:center">${i.unit}</td>
              <td class="write"></td>
              <td class="write"></td>
              <td class="write"></td>
            </tr>`).join('')}
          </tbody>
        </table>`;

      html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Stock Opname</title>${CSS}</head><body>
        <div class="header">
          ${LOGO}
          <div style="text-align:right">
            <h1>FORM STOCK OPNAME</h1>
            <div class="small">Tanggal cetak: ${today}</div>
          </div>
        </div>
        <div class="meta">
          ${metaRow('Tanggal Opname', 2)}
          ${metaRow('Dilakukan oleh', 2)}
          ${metaRow('Diverifikasi oleh', 2)}
        </div>
        ${gudang.length ? section('SECTION 1 — GUDANG', gudang) : ''}
        ${bar.length ? section('SECTION 2 — BAR', bar) : ''}
        ${dapur.length ? section('SECTION 3 — DAPUR', dapur) : ''}
        ${prepped.length ? section('SECTION 4 — BAHAN OLAHAN', prepped) : ''}
        <div class="footer">
          <div class="sign"><div class="sign-line">Petugas Opname</div></div>
          <div class="sign"><div class="sign-line">Manager / Owner</div></div>
        </div>
      </body></html>`;
    }

    else if (id === 'produksi') {
      html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Produksi Batch</title>${CSS}</head><body>
        <div class="header">
          ${LOGO}
          <div style="text-align:right"><h1>FORM PRODUKSI BATCH</h1><div class="small">Tanggal cetak: ${today}</div></div>
        </div>
        <div class="meta">
          ${metaRow('No. Batch')}
          ${metaRow('Tanggal Produksi')}
          ${metaRow('Diproduksi oleh')}
          ${metaRow('Shift')}
        </div>
        <div class="meta">
          ${metaRow('Nama Bahan Olahan', 3)}
          ${metaRow('Target Yield')}
          ${metaRow('Actual Yield')}
        </div>
        <h2>Bahan yang Digunakan</h2>
        <table>
          <thead><tr>
            <th style="width:30px">No</th>
            <th>Nama Bahan</th>
            <th style="width:60px">Satuan</th>
            <th style="width:80px">Qty Dipakai</th>
            <th style="width:80px">Sisa Bahan</th>
            <th>Keterangan</th>
          </tr></thead>
          <tbody>
            ${Array.from({length: 12}, (_, i) => `<tr>
              <td style="text-align:center">${i + 1}</td>
              <td class="write"></td>
              <td class="write"></td>
              <td class="write"></td>
              <td class="write"></td>
              <td class="write"></td>
            </tr>`).join('')}
          </tbody>
        </table>
        <h2>Hasil Produksi</h2>
        <div class="meta">
          ${metaRow('Qty Hasil')}
          ${metaRow('Satuan')}
          ${metaRow('Disimpan di')}
          ${metaRow('Shelf Life s/d')}
        </div>
        <div style="margin-top:8px"><div class="meta-label">Catatan</div><div style="border:1px solid #ccc;height:40px;margin-top:4px"></div></div>
        <div class="footer">
          <div class="sign"><div class="sign-line">Petugas Produksi</div></div>
          <div class="sign"><div class="sign-line">Manager / Owner</div></div>
        </div>
      </body></html>`;
    }

    else if (id === 'transfer') {
      html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Transfer Stok</title>${CSS}</head><body>
        <div class="header">
          ${LOGO}
          <div style="text-align:right"><h1>FORM TRANSFER STOK</h1><div class="small">Tanggal cetak: ${today}</div></div>
        </div>
        <div class="meta">
          ${metaRow('Tanggal Transfer')}
          ${metaRow('Dari Lokasi')}
          ${metaRow('Ke Lokasi')}
          ${metaRow('Dilakukan oleh')}
        </div>
        <h2>Detail Transfer</h2>
        <table>
          <thead><tr>
            <th style="width:30px">No</th>
            <th>Nama Bahan</th>
            <th style="width:60px">Satuan</th>
            <th style="width:80px">Qty Transfer</th>
            <th style="width:80px">Kondisi</th>
            <th>Keterangan</th>
          </tr></thead>
          <tbody>
            ${raw.concat(prepped).map((i, idx) => `<tr>
              <td style="text-align:center">${idx + 1}</td>
              <td>${i.name}</td>
              <td style="text-align:center">${i.unit}</td>
              <td class="write"></td>
              <td class="write"></td>
              <td class="write"></td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div class="footer">
          <div class="sign"><div class="sign-line">Pengirim</div></div>
          <div class="sign"><div class="sign-line">Penerima</div></div>
          <div class="sign"><div class="sign-line">Manager / Owner</div></div>
        </div>
      </body></html>`;
    }

    else if (id === 'po') {
      html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Purchase Order</title>${CSS}</head><body>
        <div class="header">
          ${LOGO}
          <div style="text-align:right"><h1>PURCHASE ORDER MANUAL</h1><div class="small">Tanggal cetak: ${today}</div></div>
        </div>
        <div class="meta">
          ${metaRow('No. PO')}
          ${metaRow('Tanggal')}
          ${metaRow('Tanggal Butuh')}
          ${metaRow('Dibuat oleh')}
        </div>
        <div class="meta">
          <div class="meta-item" style="flex:2"><div class="meta-label">Nama Supplier</div>
            <select style="border:none;border-bottom:1px solid #000;width:100%;font-size:10px;background:none">
              <option value="">— pilih supplier —</option>
              ${suppliers.map(s => `<option>${s.name}</option>`).join('')}
            </select>
          </div>
          ${metaRow('No. Telp Supplier', 2)}
        </div>
        <h2>Detail Pesanan</h2>
        <table>
          <thead><tr>
            <th style="width:30px">No</th>
            <th>Nama Bahan</th>
            <th style="width:60px">Satuan Beli</th>
            <th style="width:60px">Qty</th>
            <th style="width:80px">Harga Satuan</th>
            <th style="width:80px">Total</th>
            <th>Keterangan</th>
          </tr></thead>
          <tbody>
            ${Array.from({length: 15}, (_, i) => `<tr>
              <td style="text-align:center">${i + 1}</td>
              <td class="write"></td>
              <td class="write"></td>
              <td class="write"></td>
              <td class="write"></td>
              <td class="write"></td>
              <td class="write"></td>
            </tr>`).join('')}
            <tr>
              <td colspan="5" style="text-align:right;font-weight:700">TOTAL</td>
              <td class="write"></td>
              <td></td>
            </tr>
          </tbody>
        </table>
        <div style="margin-top:8px"><div class="meta-label">Catatan</div><div style="border:1px solid #ccc;height:36px;margin-top:4px"></div></div>
        <div class="footer">
          <div class="sign"><div class="sign-line">Dibuat oleh</div></div>
          <div class="sign"><div class="sign-line">Disetujui Manager/Owner</div></div>
          <div class="sign"><div class="sign-line">Diterima Supplier</div></div>
        </div>
      </body></html>`;
    }

    else if (id === 'terima') {
      html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Penerimaan Barang</title>${CSS}</head><body>
        <div class="header">
          ${LOGO}
          <div style="text-align:right"><h1>FORM PENERIMAAN BARANG</h1><div class="small">Tanggal cetak: ${today}</div></div>
        </div>
        <div class="meta">
          ${metaRow('Tanggal Terima')}
          ${metaRow('No. PO Referensi')}
          ${metaRow('Supplier')}
          ${metaRow('Diterima oleh')}
        </div>
        <h2>Detail Barang Diterima</h2>
        <table>
          <thead><tr>
            <th style="width:30px">No</th>
            <th>Nama Bahan</th>
            <th style="width:60px">Satuan</th>
            <th style="width:70px">Qty Pesan</th>
            <th style="width:70px">Qty Terima</th>
            <th style="width:70px">Selisih</th>
            <th style="width:70px">Kondisi</th>
            <th>Keterangan</th>
          </tr></thead>
          <tbody>
            ${raw.map((i, idx) => `<tr>
              <td style="text-align:center">${idx + 1}</td>
              <td>${i.name}</td>
              <td style="text-align:center">${i.unit}</td>
              <td class="write"></td>
              <td class="write"></td>
              <td class="write"></td>
              <td class="write"></td>
              <td class="write"></td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div class="footer">
          <div class="sign"><div class="sign-line">Penerima Barang</div></div>
          <div class="sign"><div class="sign-line">Kurir / Supplier</div></div>
          <div class="sign"><div class="sign-line">Manager / Owner</div></div>
        </div>
      </body></html>`;
    }

    else if (id === 'bon') {
      // 2 bon per A4
      const bon = `<div style="border:1px solid #000;padding:16px;margin-bottom:16px">
        <div class="header" style="border-bottom:1px solid #000;padding-bottom:8px;margin-bottom:12px">
          ${LOGO}
          <div style="text-align:right"><h1 style="font-size:12px">BON PENGELUARAN</h1></div>
        </div>
        <div class="meta">
          ${metaRow('Tanggal')}
          ${metaRow('No. Bon')}
        </div>
        <div class="meta" style="margin-top:8px">
          ${metaRow('Keperluan', 3)}
          ${metaRow('Kategori')}
        </div>
        <h2 style="margin-top:12px">Detail Pengeluaran</h2>
        <table>
          <thead><tr>
            <th style="width:30px">No</th>
            <th>Keterangan</th>
            <th style="width:80px">Jumlah (Rp)</th>
          </tr></thead>
          <tbody>
            ${Array.from({length: 6}, (_, i) => `<tr>
              <td style="text-align:center">${i + 1}</td>
              <td class="write"></td>
              <td class="write"></td>
            </tr>`).join('')}
            <tr>
              <td colspan="2" style="text-align:right;font-weight:700">TOTAL</td>
              <td class="write"></td>
            </tr>
          </tbody>
        </table>
        <div style="margin-top:8px"><div class="meta-label">Bukti (nota/foto)</div><div style="border:1px solid #ccc;height:30px;margin-top:4px"></div></div>
        <div class="footer" style="margin-top:12px">
          <div class="sign"><div class="sign-line">Dibuat oleh</div></div>
          <div class="sign"><div class="sign-line">Disetujui oleh</div></div>
        </div>
      </div>`;

      html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bon Pengeluaran</title>${CSS}
        <style>.page-break { page-break-before: always; }</style>
      </head><body>${bon}${bon}</body></html>`;
    }

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto">
        <div className="page-header">
          <div>
            <h1 className="page-title">Form Operasional</h1>
            <p className="page-subtitle">Form fisik untuk pencatatan sementara sebelum diinput ke sistem</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {FORMS.map(f => (
              <div key={f.id} className="card p-5 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{f.icon}</span>
                  <div className="flex-1">
                    <p className="font-bold" style={{ color: 'var(--text-1)' }}>{f.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{f.desc}</p>
                    <p className="text-xs mt-1 font-medium" style={{ color: 'var(--text-3)' }}>
                      {f.orientation === 'landscape' ? '📄 A4 Landscape' : '📄 A4 Portrait'}
                    </p>
                  </div>
                </div>
                <button onClick={() => printForm(f.id)}
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
                  style={{ background: 'var(--brand)' }}>
                  🖨️ Print Form
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 p-4 rounded-xl border border-amber-200 bg-amber-50">
          <p className="text-sm font-semibold text-amber-800 mb-1">📌 Cara penggunaan</p>
          <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
            <li>Klik "Print Form" — form langsung terbuka dan siap dicetak</li>
            <li>Form Stock Opname, Transfer, dan Penerimaan sudah pre-filled dengan nama bahan dari database</li>
            <li>Isi kolom yang kosong secara manual di lapangan</li>
            <li>Setelah selesai, input data ke sistem dan simpan form fisik sebagai arsip</li>
          </ol>
        </div>
      </div>
    </AdminLayout>
  );
}
