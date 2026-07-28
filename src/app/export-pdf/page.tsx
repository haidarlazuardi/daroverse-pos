'use client';
import { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/fetch';

type ExportType = 'bahan-olahan' | 'menu-resep';

function fmt(n: number) { return n % 1 === 0 ? n.toString() : n.toFixed(1); }
function rp(n: number) { return 'Rp\u00A0' + Math.round(n).toLocaleString('id-ID'); }

export default function ExportPDFPage() {
  const [loading, setLoading] = useState<ExportType | null>(null);

  async function generate(type: ExportType) {
    setLoading(type);
    try {
      const data = await api.get<any>('/api/export-pdf');
      const html = type === 'bahan-olahan' ? buildBahanHTML(data) : buildMenuHTML(data);
      const win  = window.open('', '_blank');
      if (!win) { alert('Izinkan pop-up di browser'); return; }
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 800);
    } catch(e: any) { alert('Gagal: ' + e.message); }
    finally { setLoading(null); }
  }

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto py-8 space-y-5">
        <div>
          <h1 className="text-2xl font-black" style={{ color:'var(--text-1)' }}>Export PDF</h1>
          <p className="text-sm mt-1" style={{ color:'var(--text-3)' }}>Generate dokumen print-ready dari data sistem</p>
        </div>

        {([
          {
            type: 'bahan-olahan' as ExportType,
            icon: '🧪',
            title: 'Bahan Baku & Olahan',
            desc: 'Master list semua bahan mentah + olahan dengan satuan, konversi, harga, dan komposisi resep olahan',
            tags: ['Landscape A4', 'Bahan mentah & harga', 'Resep olahan per bahan'],
          },
          {
            type: 'menu-resep' as ExportType,
            icon: '📋',
            title: 'Menu & Resep',
            desc: 'Recipe book per kategori menu dengan komposisi bahan dan kolom cara pembuatan',
            tags: ['Portrait A4', 'Grouped per kategori', 'Margin per menu', 'Kolom cara pembuatan'],
          },
        ] as const).map(({ type, icon, title, desc, tags }) => (
          <div key={type} className="card p-5">
            <div className="flex items-start gap-4">
              <span className="text-3xl flex-shrink-0">{icon}</span>
              <div className="flex-1">
                <h2 className="font-black text-lg mb-1" style={{ color:'var(--text-1)' }}>{title}</h2>
                <p className="text-sm mb-3" style={{ color:'var(--text-3)' }}>{desc}</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {tags.map(t => (
                    <span key={t} className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ background:'var(--surface-2)', color:'var(--text-2)' }}>{t}</span>
                  ))}
                </div>
                <button onClick={() => generate(type)} disabled={loading !== null}
                  className="btn btn-primary btn-md">
                  {loading === type ? '⏳ Generating...' : `🖨️ Export ${title}`}
                </button>
              </div>
            </div>
          </div>
        ))}

        <div className="rounded-xl p-4 text-sm" style={{ background:'var(--surface-2)', color:'var(--text-3)' }}>
          <p className="font-bold mb-1" style={{ color:'var(--text-2)' }}>Tips Print</p>
          <p>• Chrome → Print → aktifkan <strong>Background graphics</strong> agar warna muncul</p>
          <p>• Bahan Baku: print landscape · Menu Resep: print portrait</p>
          <p>• Scale 90-100% untuk hasil optimal</p>
        </div>
      </div>
    </AdminLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BAHAN BAKU & OLAHAN
// ─────────────────────────────────────────────────────────────────────────────
function buildBahanHTML(data: any): string {
  const raw     = (data.ingredients||[]).filter((i:any) => i.type==='RAW');
  const prepped = (data.ingredients||[]).filter((i:any) => i.type==='PREPPED');
  const now = new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});

  const css = `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#1C1C1C;font-size:8.5pt;background:#fff}
    @media print{@page{size:A4 landscape;margin:10mm 12mm}.page{page-break-after:always}.page:last-child{page-break-after:avoid}}
    .page{padding:8mm 10mm}
    .hdr{display:flex;align-items:center;justify-content:space-between;padding-bottom:3mm;margin-bottom:4mm;border-bottom:2px solid #48654D}
    .logo{width:9mm;height:9mm;background:#48654D;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:12pt;flex-shrink:0}
    .hdr-info{margin-left:3mm}
    .hdr-title{font-size:14pt;font-weight:900;color:#2D4A32;letter-spacing:-0.3px}
    .hdr-sub{font-size:7.5pt;color:#888;margin-top:0.5mm}
    .hdr-date{font-size:7.5pt;color:#888}
    .sec{background:#48654D;color:#F6EDDB;padding:2.5mm 4mm;margin-bottom:0;font-size:10pt;font-weight:900;letter-spacing:0.3px;display:flex;align-items:baseline;gap:3mm}
    .sec-count{font-size:7.5pt;opacity:0.75;font-weight:400}
    table{width:100%;border-collapse:collapse}
    th{background:#F6EDDB;color:#2D4A32;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:2mm 3mm;text-align:left;border-bottom:1.5px solid #D8CFC0}
    td{padding:2mm 3mm;font-size:8.5pt;border-bottom:0.5px solid #F0ECE4;vertical-align:top}
    tr:nth-child(even) td{background:#FAFAF8}
    .r{text-align:right;font-weight:600;color:#48654D;font-variant-numeric:tabular-nums}
    .tag{display:inline-block;padding:0.5mm 2mm;border-radius:3px;font-size:7pt;font-weight:700}
    .tg{background:#E8F5E9;color:#2E7D32}.tb{background:#E3F2FD;color:#1565C0}
    .muted{color:#999;font-size:8pt}
    .ri{font-size:7.5pt;display:flex;gap:4mm;padding:0.8mm 0;border-bottom:0.3px solid #F0ECE4;color:#555}
    .ri:last-child{border-bottom:none}
    .rq{font-weight:700;color:#48654D;min-width:16mm;text-align:right;flex-shrink:0}
    .ftr{margin-top:3mm;padding-top:2mm;border-top:0.5px solid #EDE5D0;display:flex;justify-content:space-between;font-size:7pt;color:#bbb}
  `;

  const rawPage = `<div class="page">
    <div class="hdr">
      <div style="display:flex;align-items:center">
        <div class="logo">S</div>
        <div class="hdr-info"><div class="hdr-title">Master Bahan Mentah</div><div class="hdr-sub">Soeka House — Bogor</div></div>
      </div>
      <div class="hdr-date">${now}</div>
    </div>
    <div class="sec">Bahan Mentah (RAW) <span class="sec-count">${raw.length} bahan</span></div>
    <table>
      <tr>
        <th style="width:5mm">#</th><th>Nama Bahan</th><th>Satuan Stok</th>
        <th>Satuan Beli</th><th>Isi / Satuan Beli</th>
        <th class="r">Harga / Unit</th><th class="r">Harga / Satuan Beli</th>
        <th class="r">Stok Min</th><th>Lokasi</th>
      </tr>
      ${raw.map((i:any,n:number) => `<tr>
        <td class="muted">${n+1}</td>
        <td><strong>${i.name}</strong></td>
        <td>${i.unit}</td>
        <td>${i.purchaseUnit||'—'}</td>
        <td>${i.conversionRate?`${fmt(i.conversionRate)} ${i.unit}`:'—'}</td>
        <td class="r">${i.latestPrice>0?rp(i.latestPrice):'—'}</td>
        <td class="r">${i.conversionRate&&i.latestPrice?rp(i.latestPrice*i.conversionRate):'—'}</td>
        <td class="r">${i.minStock>0?`${fmt(i.minStock)} ${i.unit}`:'—'}</td>
        <td><span class="tag tg">${i.defaultLocation||'GUDANG'}</span></td>
      </tr>`).join('')}
    </table>
    <div class="ftr"><span>SOEKA HOUSE — Dokumen Internal</span><span>Dicetak ${now}</span></div>
  </div>`;

  const preppedPage = `<div class="page">
    <div class="hdr">
      <div style="display:flex;align-items:center">
        <div class="logo">S</div>
        <div class="hdr-info"><div class="hdr-title">Master Bahan Olahan</div><div class="hdr-sub">Soeka House — Bogor</div></div>
      </div>
      <div class="hdr-date">${now}</div>
    </div>
    <div class="sec">Bahan Olahan (PREPPED) <span class="sec-count">${prepped.length} bahan</span></div>
    <table>
      <tr>
        <th style="width:5mm">#</th><th>Nama Olahan</th><th>Satuan</th>
        <th class="r">Harga / Unit</th><th class="r">Stok Min</th>
        <th>Lokasi</th><th>Komposisi (per satuan hasil)</th>
      </tr>
      ${prepped.map((i:any,n:number) => {
        const items = i.prepRecipe?.items||[];
        return `<tr>
          <td class="muted">${n+1}</td>
          <td><strong>${i.name}</strong></td>
          <td>${i.unit}</td>
          <td class="r">${i.latestPrice>0?rp(i.latestPrice):'—'}</td>
          <td class="r">${i.minStock>0?`${fmt(i.minStock)} ${i.unit}`:'—'}</td>
          <td><span class="tag tb">${i.defaultLocation||'—'}</span></td>
          <td>${items.length>0
            ? items.map((r:any)=>`<div class="ri"><span>${r.ingredient.name}</span><span class="rq">${fmt(r.quantity)} ${r.ingredient.unit}</span></div>`).join('')
            : '<span class="muted">Belum ada resep</span>'}</td>
        </tr>`;
      }).join('')}
    </table>
    <div class="ftr"><span>SOEKA HOUSE — Dokumen Internal</span><span>Dicetak ${now}</span></div>
  </div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bahan Baku — Soeka House</title><style>${css}</style></head><body>${rawPage}${preppedPage}</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MENU & RESEP
// ─────────────────────────────────────────────────────────────────────────────
function buildMenuHTML(data: any): string {
  const products = data.products||[];
  const now = new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});

  const grouped: Record<string,any[]> = {};
  for (const p of products) {
    const cat = p.category?.name||'Lainnya';
    if (!grouped[cat]) grouped[cat]=[];
    grouped[cat].push(p);
  }

  const css = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:8.5pt;color:#111}@media print{@page{size:A4 portrait;margin:10mm 12mm}.page{page-break-after:always}.page:last-child{page-break-after:avoid}}.page{padding:6mm 8mm}.hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #48654D;padding-bottom:2.5mm;margin-bottom:3mm}.logo{width:8mm;height:8mm;background:#48654D;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:10pt}.title{font-size:12pt;font-weight:900;color:#2D4A32;margin-left:2.5mm}.cat{background:#2D4A32;color:#F6EDDB;padding:2mm 4mm;font-size:10pt;font-weight:900;margin-bottom:2.5mm}.card{border:1px solid #EDE5D0;border-radius:3px;margin-bottom:2.5mm;overflow:hidden;break-inside:avoid}.ctop{padding:2mm 3mm;background:#FAFAF8;border-bottom:1px solid #EDE5D0}.rname{font-size:10pt;font-weight:900;color:#2D4A32}.body{display:flex}.ci{flex:0 0 42%;padding:2mm 3mm;border-right:1px solid #EDE5D0}.cs{flex:1;padding:2mm 3mm}.lbl{font-size:6.5pt;font-weight:700;color:#48654D;text-transform:uppercase;letter-spacing:0.8px;padding-bottom:1.5mm;border-bottom:1px solid #F0ECE4;margin-bottom:1.5mm}.ir{display:flex;justify-content:space-between;padding:0.8mm 0;border-bottom:0.3px solid #F5F3EE;font-size:8pt}.iq{font-weight:700;color:#48654D}.bl{border-bottom:0.5px solid #EDE5D0;margin-bottom:4.5mm}.bh{font-size:7pt;color:#bbb;font-style:italic;margin-top:1.5mm}.ftr{margin-top:2.5mm;padding-top:1.5mm;border-top:0.5px solid #EDE5D0;display:flex;justify-content:space-between;font-size:6.5pt;color:#ccc}`;

  const pages = Object.entries(grouped).map(([cat,items]:[string,any[]]) => {
    const cards = items.map((p:any) => {
      const ri = p.recipe?.items||[];
      const ingr = ri.length>0
        ? ri.map((r:any)=>`<div class="ir"><span>${r.ingredient.name}</span><span class="iq">${fmt(r.quantity)} ${r.ingredient.unit}</span></div>`).join('')
        : '<span style="font-size:7.5pt;color:#aaa">Belum ada resep</span>';
      const steps = Array(6).fill(0).map(()=>'<div class="bl"></div>').join('')+'<p class="bh">Diisi oleh tim operasional</p>';
      return `<div class="card"><div class="ctop"><div class="rname">${p.name}</div></div><div class="body"><div class="ci"><div class="lbl">Bahan</div>${ingr}</div><div class="cs"><div class="lbl">Cara Pembuatan</div>${steps}</div></div></div>`;
    }).join('');
    return `<div class="page"><div class="hdr"><div style="display:flex;align-items:center"><div class="logo">S</div><div class="title">Menu &amp; Resep</div></div><div style="font-size:7pt;color:#888">${now}</div></div><div class="cat">${cat} <span style="font-size:7.5pt;opacity:0.7;font-weight:400">${items.length} menu</span></div>${cards}<div class="ftr"><span>SOEKA HOUSE — Panduan Produksi</span><span>${now}</span></div></div>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Menu &amp; Resep — Soeka House</title><style>${css}</style></head><body>${pages}</body></html>`;
}