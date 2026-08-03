// Public page — no auth needed, opened from QR scan
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function ScanPage({ params }: { params: { id: string } }) {
  const ing = await prisma.ingredient.findUnique({
    where: { id: params.id },
    include: { stockLevels: true },
  }).catch(() => null);

  if (!ing) return notFound();

  const totalStock = ing.stockLevels.reduce((s, l) => s + l.quantity, 0);

  return (
    <html lang="id">
      <head>
        <title>{ing.name} — Soeka House</title>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, sans-serif; background: #f5f5f5; color: #1a1a1a; }
          .card { background: white; border-radius: 16px; padding: 24px; margin: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
          .label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin-bottom: 4px; }
          .value { font-size: 20px; font-weight: 800; color: #1a1a1a; }
          .value.big { font-size: 32px; color: #48654D; }
          .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
          .row:last-child { border-bottom: none; }
          h1 { font-size: 28px; font-weight: 900; color: #48654D; }
          .tag { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; background: #E8F0E9; color: #48654D; margin-top: 4px; }
        `}</style>
      </head>
      <body>
        <div className="card" style={{marginTop: 32}}>
          <div className="label">Bahan</div>
          <h1>{ing.name}</h1>
          <span className="tag">{ing.type}</span>
        </div>

        <div className="card">
          <div className="label">Total Stok</div>
          <div className="value big">{totalStock.toLocaleString('id-ID')} {ing.unit}</div>
        </div>

        {ing.stockLevels.length > 0 && (
          <div className="card">
            <div className="label" style={{marginBottom: 8}}>Per Lokasi</div>
            {ing.stockLevels.map((sl: any) => (
              <div className="row" key={sl.id}>
                <span style={{fontWeight: 600}}>{sl.location}</span>
                <span style={{fontWeight: 700, color: sl.quantity < 0 ? '#dc2626' : '#48654D'}}>
                  {sl.quantity.toLocaleString('id-ID')} {ing.unit}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="card">
          {[
            ['Unit Beli', ing.purchaseUnit || '—'],
            ['Konversi', ing.conversionRate ? `1 ${ing.purchaseUnit} = ${ing.conversionRate} ${ing.unit}` : '—'],
            ['Harga / unit', ing.latestPrice ? `Rp${ing.latestPrice.toLocaleString('id-ID')}` : '—'],
          ].map(([label, val]) => (
            <div className="row" key={label as string}>
              <span style={{color: '#888'}}>{label}</span>
              <span style={{fontWeight: 600}}>{val}</span>
            </div>
          ))}
        </div>

        <p style={{textAlign: 'center', color: '#bbb', fontSize: 12, padding: '8px 0 24px'}}>
          Soeka House POS · {new Date().toLocaleDateString('id-ID')}
        </p>
      </body>
    </html>
  );
}
