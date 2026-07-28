'use client';
import { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/fetch';

export default function RecipeBookPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus]   = useState('');

  async function generate() {
    setLoading(true);
    setStatus('Mengambil data resep...');
    try {
      const data = await api.get<any[]>('/api/recipe-book');
      if (!data?.length) { setStatus('Tidak ada resep ditemukan'); return; }

      setStatus('Membuat PDF...');

      // Build HTML for print
      const html = buildRecipeBookHTML(data);
      const win  = window.open('', '_blank');
      if (!win) { alert('Pop-up diblokir browser. Izinkan pop-up untuk halaman ini.'); return; }
      win.document.write(html);
      win.document.close();
      win.onload = () => { win.print(); };
      setStatus(`✅ PDF siap — ${data.reduce((s: number, c: any) => s + c.items.length, 0)} resep dari ${data.length} kategori`);
    } catch(e: any) {
      setStatus(`❌ ${e.message || 'Gagal generate'}`);
    } finally { setLoading(false); }
  }

  return (
    <AdminLayout>
      <div className="max-w-xl mx-auto space-y-6 py-8">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-1)' }}>Recipe Book</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
            Generate recipe book dari semua resep yang sudah diinput di sistem
          </p>
        </div>

        <div className="card p-5 space-y-4">
          <div className="space-y-2">
            {[
              '📋 Cover + Daftar Isi',
              '📂 Halaman separator per kategori',
              '🧪 Layout 2 kolom: Bahan | Cara Pembuatan',
              '✏️ Cara pembuatan kosong → diisi manual',
              '🖨️ Print-ready A4',
            ].map(f => (
              <div key={f} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-2)' }}>
                <span>{f}</span>
              </div>
            ))}
          </div>

          <button onClick={generate} disabled={loading}
            className="w-full btn btn-primary btn-lg">
            {loading ? '⏳ Generating...' : '🖨️ Generate & Print Recipe Book'}
          </button>

          {status && (
            <p className="text-sm text-center" style={{ color: status.startsWith('✅') ? '#16a34a' : status.startsWith('❌') ? '#dc2626' : 'var(--text-3)' }}>
              {status}
            </p>
          )}
        </div>

        <div className="card p-4 text-sm space-y-1" style={{ background: 'var(--surface-2)' }}>
          <p className="font-bold" style={{ color: 'var(--text-2)' }}>Tips:</p>
          <p style={{ color: 'var(--text-3)' }}>• Pastikan semua resep sudah diinput di halaman Menu & Resep</p>
          <p style={{ color: 'var(--text-3)' }}>• Cara pembuatan yang kosong akan tampil sebagai garis untuk diisi tangan</p>
          <p style={{ color: 'var(--text-3)' }}>• Print di kertas A4, bisa dijilid setelah print</p>
        </div>
      </div>
    </AdminLayout>
  );
}

function buildRecipeBookHTML(categories: any[]): string {
  const GREEN      = '#48654D';
  const GREEN_DARK = '#2D4A32';
  const CREAM      = '#F6EDDB';
  const CREAM_DARK = '#EDE5D0';
  const GRAY       = '#888888';

  const totalRecipes = categories.reduce((s, c) => s + c.items.length, 0);

  const coverPage = `
    <div class="page cover-page">
      <div class="cover-logo">S</div>
      <h1 class="cover-title">SOEKA HOUSE</h1>
      <h2 class="cover-sub">Recipe Book</h2>
      <div class="cover-line"></div>
      <p class="cover-meta">${totalRecipes} Resep &middot; ${categories.length} Kategori</p>
      <p class="cover-year">Bogor, 2026</p>
    </div>`;

  const tocPage = `
    <div class="page">
      <h2 class="toc-title">Daftar Isi</h2>
      <div class="toc-line"></div>
      ${categories.map((cat, ci) => `
        <div class="toc-cat">${String(ci+1).padStart(2,'0')}. ${cat.category}</div>
        ${cat.items.map((item: any) => `
          <div class="toc-item">• ${item.name}</div>
        `).join('')}
      `).join('')}
    </div>`;

  const recipePages = categories.map((cat, ci) => {
    const catPage = `
      <div class="page cat-page">
        <div class="cat-num">0${ci+1}</div>
        <div class="cat-title">${cat.category}</div>
        <div class="cat-line"></div>
        <div class="cat-count">${cat.items.length} resep</div>
      </div>`;

    const itemPages = cat.items.map((recipe: any) => `
      <div class="page recipe-page">
        <div class="recipe-header">
          <h2 class="recipe-name">${recipe.name}</h2>
          ${recipe.description ? `<p class="recipe-desc">${recipe.description}</p>` : ''}
          ${recipe.serving ? `<p class="recipe-serving">⬤ Porsi: ${recipe.serving}</p>` : ''}
        </div>
        <div class="recipe-divider"></div>
        <div class="recipe-cols">
          <div class="col-ingr">
            <div class="col-label">BAHAN-BAHAN</div>
            ${recipe.ingredients.map((ing: any, i: number) => `
              <div class="ingr-row ${i%2===0?'ingr-even':''}">
                <span class="ingr-name">${ing.name}</span>
                <span class="ingr-qty">${ing.qty} ${ing.unit}</span>
              </div>
            `).join('')}
          </div>
          <div class="col-divider"></div>
          <div class="col-steps">
            <div class="col-label">CARA PEMBUATAN</div>
            ${recipe.steps.length > 0
              ? recipe.steps.map((step: string, i: number) => `
                  <div class="step-row">
                    <span class="step-num">${i+1}</span>
                    <span class="step-text">${step}</span>
                  </div>
                `).join('')
              : Array(8).fill(0).map(() => `<div class="blank-line"></div>`).join('') +
                `<p class="blank-hint">(akan diisi oleh tim)</p>`
            }
            ${recipe.notes ? `
              <div class="recipe-note">📌 ${recipe.notes}</div>
            ` : ''}
          </div>
        </div>
      </div>`).join('');

    return catPage + itemPages;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Soeka House — Recipe Book</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; background: white; }

  @media print {
    .page { page-break-after: always; }
    .page:last-child { page-break-after: avoid; }
    @page { size: A4; margin: 15mm 20mm 18mm 20mm; }
  }
  @media screen {
    body { background: #eee; }
    .page { max-width: 210mm; margin: 8mm auto; box-shadow: 0 2px 12px rgba(0,0,0,0.15); }
  }

  .page {
    background: white;
    min-height: 267mm;
    padding: 12mm 18mm;
    position: relative;
    display: flex;
    flex-direction: column;
  }
  .page::after {
    content: 'SOEKA HOUSE — Recipe Book';
    position: absolute;
    bottom: 8mm;
    left: 18mm;
    font-size: 7pt;
    color: ${GRAY};
  }

  /* ── COVER ── */
  .cover-page {
    background: ${GREEN_DARK};
    align-items: center;
    justify-content: center;
    gap: 4mm;
    padding-top: 30mm;
  }
  .cover-page::after { color: rgba(255,255,255,0.3); }
  .cover-logo {
    width: 22mm; height: 22mm; border-radius: 50%;
    background: ${GREEN}; color: white;
    font-size: 20pt; font-weight: bold;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 4mm;
  }
  .cover-title { font-size: 28pt; font-weight: 900; color: white; letter-spacing: 2px; }
  .cover-sub { font-size: 16pt; color: #C8D9C9; font-weight: 300; }
  .cover-line { width: 50mm; height: 1px; background: #7BA07F; margin: 6mm 0; }
  .cover-meta { font-size: 11pt; color: #C8D9C9; }
  .cover-year { font-size: 9pt; color: #7BA07F; margin-top: 3mm; }

  /* ── TOC ── */
  .toc-title { font-size: 22pt; font-weight: 900; color: ${GREEN_DARK}; margin-bottom: 3mm; }
  .toc-line { height: 2px; background: ${GREEN}; margin-bottom: 6mm; }
  .toc-cat { font-size: 11pt; font-weight: bold; color: ${GREEN_DARK}; margin-top: 5mm; margin-bottom: 1mm; }
  .toc-item { font-size: 10pt; color: #333; margin-left: 6mm; line-height: 1.8; }

  /* ── CATEGORY ── */
  .cat-page {
    align-items: center; justify-content: center;
    background: ${CREAM};
  }
  .cat-num { font-size: 60pt; font-weight: 900; color: ${CREAM_DARK}; line-height: 1; }
  .cat-title { font-size: 24pt; font-weight: 900; color: ${GREEN_DARK}; margin-top: 4mm; text-align: center; }
  .cat-line { width: 30mm; height: 2px; background: ${GREEN}; margin: 4mm 0; }
  .cat-count { font-size: 11pt; color: ${GRAY}; }

  /* ── RECIPE ── */
  .recipe-header { margin-bottom: 3mm; }
  .recipe-name { font-size: 18pt; font-weight: 900; color: ${GREEN_DARK}; line-height: 1.2; margin-bottom: 2mm; }
  .recipe-desc { font-size: 10pt; font-style: italic; color: #666; margin-bottom: 1mm; }
  .recipe-serving { font-size: 9pt; color: ${GRAY}; margin-bottom: 2mm; }
  .recipe-divider { height: 1px; background: ${CREAM_DARK}; margin-bottom: 5mm; }

  .recipe-cols { display: flex; gap: 0; flex: 1; }
  .col-ingr { flex: 0 0 55%; padding-right: 6mm; }
  .col-divider { width: 1px; background: ${CREAM_DARK}; flex-shrink: 0; }
  .col-steps { flex: 1; padding-left: 6mm; }

  .col-label {
    font-size: 8pt; font-weight: bold; color: ${GREEN};
    letter-spacing: 1px; margin-bottom: 4mm;
    padding-bottom: 2mm; border-bottom: 1px solid ${CREAM_DARK};
  }

  .ingr-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 3mm 3mm; font-size: 10pt; border-bottom: 0.3px solid ${CREAM_DARK};
  }
  .ingr-even { background: ${CREAM}; }
  .ingr-name { color: #222; }
  .ingr-qty { font-weight: bold; color: ${GREEN_DARK}; text-align: right; }

  .step-row { display: flex; gap: 3mm; margin-bottom: 5mm; align-items: flex-start; }
  .step-num { font-size: 18pt; font-weight: 900; color: ${CREAM_DARK}; min-width: 8mm; text-align: center; line-height: 1; }
  .step-text { font-size: 10pt; color: #222; line-height: 1.5; padding-top: 2mm; }

  .blank-line { border-bottom: 0.5px solid ${CREAM_DARK}; margin-bottom: 9mm; }
  .blank-hint { font-size: 8pt; color: ${GRAY}; font-style: italic; margin-top: 2mm; }

  .recipe-note {
    font-size: 9pt; font-style: italic; color: #666;
    margin-top: 5mm; padding-top: 3mm;
    border-top: 0.5px solid ${CREAM_DARK};
  }
</style>
</head>
<body>
  ${coverPage}
  ${tocPage}
  ${recipePages}
</body>
</html>`;
}
