'use client';
import { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/fetch';

type Status = 'ok'|'warn'|'error';
type Check  = { name:string; status:Status; message:string; count?:number; items?:string[] };
type Result = { checks:Check[]; summary:{ ok:number; warn:number; error:number; total:number }; runAt:string };

const ICON: Record<Status, string>  = { ok:'✅', warn:'⚠️', error:'❌' };
const COLOR: Record<Status, string> = {
  ok:    '#16A34A',
  warn:  '#D97706',
  error: '#DC2626',
};
const BG: Record<Status, string> = {
  ok:    '#F0FDF4',
  warn:  '#FFFBEB',
  error: '#FEF2F2',
};

export default function DebugPage() {
  const [result, setResult] = useState<Result|null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string|null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const data = await api.get<Result>('/api/debug');
      setResult(data);
    } catch(e: any) {
      alert('Gagal: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black" style={{ color:'var(--text-1)' }}>System Health Check</h1>
            <p className="text-sm mt-1" style={{ color:'var(--text-3)' }}>
              Deteksi anomali dan bug di seluruh sistem secara otomatis
            </p>
          </div>
          <button onClick={run} disabled={loading}
            className="btn btn-primary px-6 py-2.5 disabled:opacity-60 flex items-center gap-2">
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                Scanning...
              </>
            ) : (
              <>🔍 Jalankan Check</>
            )}
          </button>
        </div>

        {/* Summary */}
        {result && (
          <>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label:'Total Check', value:result.summary.total, color:'var(--text-1)', bg:'var(--surface-2)' },
                { label:'OK', value:result.summary.ok, color:'#16A34A', bg:'#F0FDF4' },
                { label:'Warning', value:result.summary.warn, color:'#D97706', bg:'#FFFBEB' },
                { label:'Error', value:result.summary.error, color:'#DC2626', bg:'#FEF2F2' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-4 text-center" style={{ background:s.bg }}>
                  <p className="text-xs font-bold mb-1" style={{ color:'#888' }}>{s.label}</p>
                  <p className="text-3xl font-black" style={{ color:s.color }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Overall status */}
            <div className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: result.summary.error > 0 ? '#FEF2F2' : result.summary.warn > 0 ? '#FFFBEB' : '#F0FDF4' }}>
              <span className="text-2xl">
                {result.summary.error > 0 ? '❌' : result.summary.warn > 0 ? '⚠️' : '✅'}
              </span>
              <div>
                <p className="font-black" style={{ color: result.summary.error > 0 ? '#DC2626' : result.summary.warn > 0 ? '#D97706' : '#16A34A' }}>
                  {result.summary.error > 0 ? `${result.summary.error} masalah kritis ditemukan` :
                   result.summary.warn  > 0 ? `${result.summary.warn} peringatan perlu diperhatikan` :
                   'Semua sistem normal!'}
                </p>
                <p className="text-xs mt-0.5" style={{ color:'#888' }}>
                  Dijalankan {new Date(result.runAt).toLocaleString('id-ID')}
                </p>
              </div>
            </div>

            {/* Check list */}
            <div className="space-y-2">
              {result.checks.map(check => (
                <div key={check.name} className="rounded-xl overflow-hidden border"
                  style={{ borderColor: check.status === 'ok' ? '#E5E7EB' : COLOR[check.status]+'40' }}>
                  <button onClick={() => setExpanded(expanded===check.name ? null : check.name)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                    style={{ background: check.status !== 'ok' ? BG[check.status] : 'white' }}>
                    <span className="text-lg flex-shrink-0">{ICON[check.status]}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm" style={{ color:'var(--text-1)' }}>{check.name}</p>
                        {check.count != null && check.count > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-bold text-white"
                            style={{ background:COLOR[check.status] }}>{check.count}</span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color:'var(--text-3)' }}>{check.message}</p>
                    </div>
                    {check.items?.length ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"
                        style={{ transform: expanded===check.name ? 'rotate(180deg)' : 'none', transition:'transform 0.2s', flexShrink:0 }}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    ) : null}
                  </button>
                  {expanded === check.name && check.items?.length && (
                    <div className="px-4 pb-3 border-t" style={{ borderColor:COLOR[check.status]+'30', background:BG[check.status] }}>
                      <div className="mt-2 space-y-1">
                        {check.items.map((item, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs" style={{ color:'var(--text-2)' }}>
                            <span className="text-gray-300 flex-shrink-0 mt-0.5">→</span>
                            <span className="font-mono">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Run again */}
            <div className="text-center pt-2">
              <button onClick={run} className="text-sm font-medium" style={{ color:'var(--brand)' }}>
                🔄 Jalankan ulang
              </button>
            </div>
          </>
        )}

        {/* Empty state */}
        {!result && !loading && (
          <div className="card p-12 text-center">
            <p className="text-5xl mb-4">🔍</p>
            <p className="font-bold text-lg mb-2" style={{ color:'var(--text-1)' }}>System Health Check</p>
            <p className="text-sm mb-6" style={{ color:'var(--text-3)' }}>
              Cek otomatis 15+ aspek sistem: data integrity, logic anomali, stok, payroll, dan lainnya.
            </p>
            <button onClick={run}
              className="btn btn-primary px-8 py-3">
              🔍 Mulai Scan
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
