'use client';

import { useState } from 'react';

function formatCurrency(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

const STATION_LABEL: Record<string, string> = { DRINK: '🥤 Minuman', FOOD: '🍔 Makanan', '': '🎁 Semua' };

export default function CekPoinPage() {
  const [phone, setPhone]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<any>(null);
  const [error, setError]       = useState('');

  async function handleCek() {
    if (!phone.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch(`/api/public/check-points?phone=${encodeURIComponent(phone.trim())}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Nomor tidak ditemukan'); return; }
      setResult(data.data);
    } catch { setError('Gagal menghubungi server'); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F6EDDB' }}>
      {/* Header */}
      <div className="px-5 pt-10 pb-6 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#48654D' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <h1 className="text-2xl font-black" style={{ color: '#2D4A32', letterSpacing: '-0.03em' }}>Soeka House</h1>
        <p className="text-sm mt-1" style={{ color: '#48654D' }}>Cek Poin Loyalty kamu</p>
      </div>

      <div className="flex-1 px-5 max-w-sm mx-auto w-full">
        {/* Input */}
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <label className="text-sm font-semibold block mb-2" style={{ color: '#374840' }}>Nomor HP</label>
          <input
            type="tel" value={phone}
            onChange={e => { setPhone(e.target.value); setError(''); setResult(null); }}
            onKeyDown={e => e.key === 'Enter' && handleCek()}
            placeholder="cth. 08123456789"
            className="w-full px-4 py-3 rounded-xl border-2 text-base outline-none transition-all"
            style={{ borderColor: phone ? '#48654D' : '#E0DDD8', background: '#FAFAF8' }}
          />
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          <button onClick={handleCek} disabled={loading || !phone.trim()}
            className="w-full mt-3 py-3 rounded-xl font-bold text-white text-base transition-all active:scale-95 disabled:opacity-50"
            style={{ background: '#48654D' }}>
            {loading ? 'Mengecek...' : 'Cek Poin'}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className="space-y-4 pb-10">
            {/* Customer card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-black text-white flex-shrink-0"
                  style={{ background: '#48654D' }}>
                  {result.customer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-lg" style={{ color: '#111816' }}>{result.customer.name}</p>
                  <p className="text-sm" style={{ color: '#6B7A6E' }}>{result.customer.phone}</p>
                </div>
              </div>

              {/* Points */}
              <div className="rounded-xl p-4 text-center mb-4" style={{ background: '#F6EDDB' }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#8A7A6B' }}>Total Poin</p>
                <p className="text-5xl font-black" style={{ color: '#48654D', letterSpacing: '-0.04em' }}>
                  {result.customer.points.toLocaleString('id-ID')}
                </p>
                <p className="text-sm mt-1" style={{ color: '#8A7A6B' }}>poin</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3" style={{ background: '#F5F4F0' }}>
                  <p className="text-xs" style={{ color: '#8A7A6B' }}>Total Belanja</p>
                  <p className="font-bold text-sm mt-0.5" style={{ color: '#111816' }}>{formatCurrency(result.customer.totalSpent)}</p>
                </div>
                <div className="rounded-xl p-3" style={{ background: '#F5F4F0' }}>
                  <p className="text-xs" style={{ color: '#8A7A6B' }}>Kunjungan</p>
                  <p className="font-bold text-sm mt-0.5" style={{ color: '#111816' }}>{result.customer.visitCount}×</p>
                </div>
              </div>
            </div>

            {/* Rewards */}
            {result.rewards.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <p className="font-bold mb-3" style={{ color: '#111816' }}>Reward yang Bisa Ditukar</p>
                <div className="space-y-2">
                  {result.rewards.map((r: any) => {
                    const canRedeem = r.canRedeem;
                    return (
                      <div key={r.id}
                        className="flex items-center justify-between p-3 rounded-xl border-2"
                        style={{ borderColor: canRedeem ? '#48654D' : '#E0DDD8', background: canRedeem ? '#F0F7F1' : '#FAFAF8', opacity: canRedeem ? 1 : 0.6 }}>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{r.rewardType === 'FREE_PRODUCT' ? (r.station === 'FOOD' ? '🍔' : '🥤') : '💰'}</span>
                          <div>
                            <p className="font-semibold text-sm" style={{ color: '#111816' }}>{r.name}</p>
                            <p className="text-xs" style={{ color: '#6B7A6E' }}>
                              {r.rewardType === 'FREE_PRODUCT'
                                ? `${STATION_LABEL[r.station || '']} gratis${r.maxPrice ? ` (max ${formatCurrency(r.maxPrice)})` : ''}`
                                : `Diskon ${formatCurrency(r.discountAmount)}`}
                            </p>
                            {canRedeem && r.timesRedeemable > 1 && (
                              <p className="text-xs font-semibold" style={{ color: '#48654D' }}>Bisa {r.timesRedeemable}× sekarang</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-base" style={{ color: canRedeem ? '#48654D' : '#9CA3AF' }}>{r.pointsRequired}</p>
                          <p className="text-xs" style={{ color: '#8A7A6B' }}>poin</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-center mt-3" style={{ color: '#8A7A6B' }}>
                  Tunjukkan halaman ini ke kasir untuk menukar reward
                </p>
              </div>
            )}

            {/* How to earn */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="font-bold mb-2" style={{ color: '#111816' }}>Cara Dapat Poin</p>
              <p className="text-sm" style={{ color: '#6B7A6E' }}>
                Setiap <strong>Rp 1.000</strong> belanja = <strong>1 poin</strong>
              </p>
              <p className="text-sm mt-1" style={{ color: '#6B7A6E' }}>
                Kasih tahu nomor HP kamu ke kasir setiap kali belanja.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
