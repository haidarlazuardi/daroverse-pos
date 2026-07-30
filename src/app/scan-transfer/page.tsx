'use client';
import { useState, useEffect, useRef } from 'react';

type Location = 'GUDANG' | 'BAR' | 'KITCHEN';
type Step = 'scan' | 'confirm' | 'done';

interface ScannedData {
  ingredientId: string;
  name: string;
  qty: number;
  unit: string;
  purchaseUnit: string;
  batchDate: string;
  poNumber: string;
}

const LOC_LABEL: Record<Location, string> = { GUDANG: '🏭 Gudang', BAR: '☕ Bar', KITCHEN: '🍳 Kitchen' };
const LOC_COLOR: Record<Location, string> = { GUDANG: '#48654D', BAR: '#0369A1', KITCHEN: '#B45309' };

export default function ScanTransferPage() {
  const [step, setStep]           = useState<Step>('scan');
  const [scanned, setScanned]     = useState<ScannedData | null>(null);
  const [from, setFrom]           = useState<Location>('GUDANG');
  const [to, setTo]               = useState<Location>('BAR');
  const [qty, setQty]             = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]       = useState('');
  const [error, setError]         = useState('');
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);

  useEffect(() => {
    if (step === 'scan') startCamera();
    return () => stopCamera();
  }, [step]);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        scanningRef.current = true;
        scanFrames();
      }
    } catch { setError('Tidak bisa akses kamera'); }
  }

  function stopCamera() {
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach(t => t.stop());
  }

  async function scanFrames() {
    if (!scanningRef.current) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2) { setTimeout(scanFrames, 300); return; }

    try {
      // @ts-ignore
      const BarcodeDetector = (window as any).BarcodeDetector;
      if (BarcodeDetector) {
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0);
        const codes = await detector.detect(canvas);
        if (codes.length > 0) {
          handleScan(codes[0].rawValue);
          return;
        }
      }
    } catch {}
    if (scanningRef.current) setTimeout(scanFrames, 200);
  }

  function handleScan(raw: string) {
    try {
      const data = JSON.parse(raw) as ScannedData;
      if (!data.ingredientId || !data.name || !data.qty) throw new Error('QR tidak valid');
      setScanned(data);
      setQty(String(data.qty));
      stopCamera();
      setStep('confirm');
    } catch {
      setError('QR tidak dikenali. Pastikan scan label dari sistem Soeka House.');
      setTimeout(() => setError(''), 3000);
    }
  }

  async function confirmTransfer() {
    if (!scanned) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/stock/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredientId: scanned.ingredientId,
          fromLocation: from,
          toLocation: to,
          quantity: parseFloat(qty),
          notes: `Scan QR — ${scanned.poNumber}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal transfer');
      setResult(`✅ ${parseFloat(qty).toLocaleString('id-ID')} ${scanned.unit} ${scanned.name} dipindah dari ${from} ke ${to}`);
      setStep('done');
    } catch (e: any) {
      setError(e.message);
    } finally { setSubmitting(false); }
  }

  function reset() {
    setScanned(null); setQty(''); setResult(''); setError(''); setStep('scan');
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F6EDDB', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: '#48654D' }}>
        <a href="/staff" className="text-white opacity-70 text-xl">←</a>
        <h1 className="text-white font-black text-lg">Transfer Stok via QR</h1>
      </div>

      <div className="flex-1 p-4 space-y-4 max-w-sm mx-auto w-full">

        {/* SCAN STEP */}
        {step === 'scan' && (
          <>
            <div className="rounded-2xl overflow-hidden shadow-lg relative" style={{ background: '#000', aspectRatio: '1' }}>
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted/>
              {/* Crosshair */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div style={{ width: 180, height: 180, border: '3px solid #48654D', borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)' }}/>
              </div>
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <p className="text-white text-sm font-medium opacity-80">Arahkan kamera ke QR label</p>
              </div>
            </div>

            {error && (
              <div className="rounded-xl p-3 text-center text-sm font-medium" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                {error}
              </div>
            )}

            {/* Manual input fallback */}
            <div className="rounded-2xl p-4" style={{ background: 'white' }}>
              <p className="text-xs font-bold mb-2" style={{ color: '#888' }}>ATAU INPUT MANUAL</p>
              <a href="/transfer" className="text-sm font-semibold underline" style={{ color: '#48654D' }}>
                Buka halaman transfer manual →
              </a>
            </div>
          </>
        )}

        {/* CONFIRM STEP */}
        {step === 'confirm' && scanned && (
          <>
            <div className="rounded-2xl p-5" style={{ background: 'white' }}>
              <p className="text-xs font-bold mb-3" style={{ color: '#888' }}>BAHAN TERDETEKSI</p>
              <p className="font-black text-2xl mb-1" style={{ color: '#2D4A32' }}>{scanned.name}</p>
              <p className="text-sm mb-1" style={{ color: '#666' }}>Batch: {scanned.batchDate} · {scanned.poNumber}</p>
              <p className="text-sm" style={{ color: '#48654D', fontWeight: 700 }}>
                {scanned.qty.toLocaleString('id-ID')} {scanned.unit} per {scanned.purchaseUnit}
              </p>
            </div>

            {/* From → To */}
            <div className="rounded-2xl p-4" style={{ background: 'white' }}>
              <p className="text-xs font-bold mb-3" style={{ color: '#888' }}>TRANSFER DARI → KE</p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-xs mb-1" style={{ color: '#888' }}>Dari</p>
                  <select value={from} onChange={e => setFrom(e.target.value as Location)}
                    className="w-full rounded-xl border px-3 py-2.5 font-bold text-sm"
                    style={{ borderColor: '#EDE5D0', color: LOC_COLOR[from] }}>
                    {(Object.keys(LOC_LABEL) as Location[]).map(l => (
                      <option key={l} value={l}>{LOC_LABEL[l]}</option>
                    ))}
                  </select>
                </div>
                <div className="text-2xl mt-4">→</div>
                <div className="flex-1">
                  <p className="text-xs mb-1" style={{ color: '#888' }}>Ke</p>
                  <select value={to} onChange={e => setTo(e.target.value as Location)}
                    className="w-full rounded-xl border px-3 py-2.5 font-bold text-sm"
                    style={{ borderColor: '#EDE5D0', color: LOC_COLOR[to] }}>
                    {(Object.keys(LOC_LABEL) as Location[]).filter(l => l !== from).map(l => (
                      <option key={l} value={l}>{LOC_LABEL[l]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Qty */}
            <div className="rounded-2xl p-4" style={{ background: 'white' }}>
              <p className="text-xs font-bold mb-2" style={{ color: '#888' }}>JUMLAH ({scanned.unit})</p>
              <input type="number" value={qty} onChange={e => setQty(e.target.value)}
                className="w-full rounded-xl border px-4 py-3 text-2xl font-black text-center"
                style={{ borderColor: '#EDE5D0', color: '#2D4A32' }}/>
              <div className="flex gap-2 mt-2">
                {[1, 0.5, 0.25].map(factor => (
                  <button key={factor} onClick={() => setQty(String(scanned.qty * factor))}
                    className="flex-1 py-2 rounded-xl text-xs font-bold border"
                    style={{ borderColor: '#EDE5D0', color: '#48654D' }}>
                    {factor === 1 ? 'Full' : `${factor * 100}%`}
                    <br/>
                    <span style={{ color: '#888' }}>{(scanned.qty * factor).toLocaleString('id-ID')} {scanned.unit}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-xl p-3 text-center text-sm" style={{ background: '#FEE2E2', color: '#DC2626' }}>{error}</div>
            )}

            <div className="flex gap-3">
              <button onClick={reset} className="flex-1 py-3 rounded-2xl font-bold text-sm border"
                style={{ borderColor: '#EDE5D0', color: '#666', background: 'white' }}>
                ← Scan Ulang
              </button>
              <button onClick={confirmTransfer} disabled={submitting || !qty || from === to}
                className="flex-2 py-3 px-6 rounded-2xl font-black text-white text-sm disabled:opacity-50"
                style={{ background: '#48654D', flex: 2 }}>
                {submitting ? 'Memproses...' : `Transfer ${parseFloat(qty||'0').toLocaleString('id-ID')} ${scanned.unit}`}
              </button>
            </div>
          </>
        )}

        {/* DONE STEP */}
        {step === 'done' && (
          <div className="text-center py-8 space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl"
              style={{ background: '#D1FAE5' }}>✅</div>
            <p className="font-black text-lg" style={{ color: '#2D4A32' }}>Transfer Berhasil</p>
            <p className="text-sm" style={{ color: '#555' }}>{result}</p>
            <button onClick={reset}
              className="w-full py-4 rounded-2xl font-black text-white text-lg"
              style={{ background: '#48654D' }}>
              Scan Lagi
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
