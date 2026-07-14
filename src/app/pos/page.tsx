'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useCartStore, CartLine, SelectedModifier, lineUnitPrice } from '@/store';
import { api } from '@/lib/fetch';
import { formatCurrency, Modal, Button, Input } from '@/components/ui';
import clsx from 'clsx';

interface ModOption {
  id: string; name: string; effect: 'ADJUST' | 'ADD';
  targetIngredientId: string | null; multiplier: number | null; addQty: number | null;
  priceDelta: number; isDefault: boolean;
}
interface ModGroup { id: string; name: string; selectionType: 'SINGLE' | 'MULTI'; options: ModOption[] }
interface RecipeItem { ingredientId: string; quantity: number }
interface Product {
  id: string; name: string; price: number; categoryId: string; station: 'FOOD' | 'DRINK';
  takeawayCharge: number; category: { id: string; name: string; color: string };
  modifierGroups: ModGroup[]; recipe?: { items: RecipeItem[] };
}
interface Category { id: string; name: string; color: string }
interface DiscountPreset { id: string; name: string; type: 'PERCENT' | 'FIXED'; value: number }
interface Settings { tax_rate?: string; service_rate?: string; loyalty_redeem_value?: string }
type Step = 'cart' | 'payment' | 'receipt';

const STATION_LOC: Record<string, string> = { FOOD: 'KITCHEN', DRINK: 'BAR' };

const toSelected = (g: ModGroup, o: ModOption): SelectedModifier => ({
  groupName: g.name, optionName: o.name, effect: o.effect,
  targetIngredientId: o.targetIngredientId, multiplier: o.multiplier, addQty: o.addQty, priceDelta: o.priceDelta,
});
function defaultModifiers(product: Product): SelectedModifier[] {
  const out: SelectedModifier[] = [];
  for (const g of product.modifierGroups || []) {
    if (g.selectionType === 'SINGLE') {
      const opt = g.options.find((o) => o.isDefault) || g.options[0];
      if (opt) out.push(toSelected(g, opt));
    } else { for (const o of g.options) if (o.isDefault) out.push(toSelected(g, o)); }
  }
  return out;
}

// ── QueueCard — compact, collapsible, swipe right to dismiss ─────────────
function QueueCard({ order: o, onServed }: { order: any; onServed: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [serving,  setServing]  = useState(false);
  const [tx, setTx]             = useState(0);
  const [leaving, setLeaving]   = useState(false);
  const startX = useRef(0);

  async function serve() {
    if (serving) return;
    setServing(true);
    try {
      await api.patch('/api/orders', { id: o.id, action: 'complete_serve' });
      setLeaving(true); setTx(400);
      setTimeout(onServed, 280);
    } catch (e: any) { alert(e.message || 'Gagal'); setServing(false); }
  }

  const elapsed = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000);
  const urgent  = elapsed >= 10;
  const name    = o.customer?.name || o.customerName || null;
  const count   = (o.items || []).reduce((s: number, i: any) => s + (i.quantity || 1), 0);

  return (
    <div className="relative overflow-hidden rounded-xl mb-2">
      {/* Swipe bg */}
      <div className="absolute inset-0 rounded-xl flex items-center justify-end pr-5"
        style={{ background: '#48654D' }}>
        <span className="text-white font-bold text-sm">✓ Selesai</span>
      </div>

      {/* Card */}
      <div className="relative bg-white border rounded-xl"
        style={{
          borderColor: urgent ? '#FCA5A5' : '#E5E7EB',
          transform: `translateX(${tx}px)`,
          transition: leaving ? 'transform 0.28s ease-in' : tx === 0 ? 'transform 0.18s ease-out' : undefined,
        }}
        onTouchStart={e => { startX.current = e.touches[0].clientX; }}
        onTouchMove={e => {
          const dx = e.touches[0].clientX - startX.current;
          if (dx > 0) setTx(Math.min(dx, 140));
        }}
        onTouchEnd={() => { if (tx >= 80) serve(); else setTx(0); }}>

        {/* Summary row — always visible */}
        <button onClick={() => setExpanded(p => !p)}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
          {/* Order no */}
          <span className="font-black text-sm flex-shrink-0" style={{ color: 'var(--brand)' }}>
            {o.orderNumber?.slice(-4)}
          </span>
          {/* Customer / no name */}
          <span className="text-sm font-medium truncate flex-1" style={{ color: 'var(--text-1)' }}>
            {name || <span className="text-gray-400 italic">Tanpa nama</span>}
          </span>
          {/* Item count */}
          <span className="text-xs font-semibold text-gray-400 flex-shrink-0">{count} item</span>
          {/* Urgent badge */}
          {urgent && <span className="text-xs font-bold text-red-500 flex-shrink-0">⏰{elapsed}m</span>}
          {/* TA badge */}
          {o.orderType === 'TAKEAWAY' && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold flex-shrink-0">TA</span>
          )}
          {/* Chevron */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={`flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            style={{ color: 'var(--text-3)' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {/* Expanded detail */}
        {expanded && (
          <div className="border-t px-3 pt-2 pb-3 space-y-1.5" style={{ borderColor: 'var(--border)' }}>
            {(o.items || []).map((item: any, i: number) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-sm text-gray-700">
                  <span className="font-bold">{item.quantity}×</span> {item.product?.name}
                </span>
                <span className="text-xs text-gray-400">{formatCurrency(item.price * item.quantity)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-1.5 border-t" style={{ borderColor: 'var(--border)' }}>
              <span className="text-xs font-semibold text-gray-400">Total</span>
              <span className="text-sm font-bold" style={{ color: 'var(--brand)' }}>{formatCurrency(o.total)}</span>
            </div>
            <button onClick={serve} disabled={serving}
              className="w-full mt-1 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-60 active:scale-95 transition-all"
              style={{ background: 'var(--brand)' }}>
              {serving ? 'Menyimpan...' : '✓ Diserahkan ke Customer'}
            </button>
            <p className="text-center text-xs text-gray-300">atau geser card ke kanan →</p>
          </div>
        )}
      </div>
    </div>
  );
}


