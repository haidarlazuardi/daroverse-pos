'use client';
import { useState, useRef, useEffect } from 'react';

interface Ingredient { id: string; name: string; unit?: string; type?: string; [key: string]: any; }

interface Props {
  ingredients: Ingredient[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  showUnit?: boolean;
  showType?: boolean;
  filterType?: string; // 'RAW' | 'PREPPED'
}

export default function IngredientPicker({ ingredients, value, onChange, placeholder = 'Pilih bahan...', showUnit = true, showType = false, filterType }: Props) {
  const [query, setQuery]   = useState('');
  const [open,  setOpen]    = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = ingredients
    .filter(i => !filterType || i.type === filterType)
    .filter(i => i.name.toLowerCase().includes(query.toLowerCase()));

  const selected = ingredients.find(i => i.id === value);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function pick(id: string) {
    onChange(id);
    setQuery('');
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button type="button" onClick={() => setOpen(o => !o)}
        className="select w-full text-left flex items-center justify-between"
        style={{ color: selected ? 'var(--text-1)' : 'var(--text-3)', minHeight: 40 }}>
        <span className="truncate">
          {selected ? (
            <>
              {showType && selected.type === 'PREPPED' && <span style={{ color:'#854F0B', marginRight: 4 }}>🔸</span>}
              {selected.name}
              {showUnit && selected.unit && <span style={{ color:'var(--text-3)', marginLeft: 4 }}>({selected.unit})</span>}
            </>
          ) : placeholder}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 999,
          background: 'white', borderRadius: 12, border: '1px solid var(--border)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden',
        }}>
          {/* Search input */}
          <div style={{ padding: '8px 10px', borderBottom: '0.5px solid var(--border)', position: 'relative' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2"
              style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Cari bahan..." className="input"
              style={{ paddingLeft: 32, width: '100%', height: 34, fontSize: 13 }}/>
          </div>

          {/* Clear option */}
          {value && (
            <button type="button" onClick={() => pick('')}
              className="w-full px-3 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors"
              style={{ color: 'var(--text-3)', borderBottom: '0.5px solid var(--border)' }}>
              — Kosongkan pilihan
            </button>
          )}

          {/* Results */}
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm" style={{ color: 'var(--text-3)' }}>
                Tidak ada bahan "{query}"
              </p>
            ) : filtered.map(i => (
              <button type="button" key={i.id} onClick={() => pick(i.id)}
                className="w-full px-3 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors flex items-center justify-between"
                style={{ background: i.id === value ? 'var(--surface-2)' : 'white' }}>
                <span style={{ color: 'var(--text-1)' }}>
                  {showType && i.type === 'PREPPED' && <span style={{ color:'#854F0B', marginRight: 4 }}>🔸</span>}
                  {i.name}
                </span>
                {showUnit && i.unit && (
                  <span className="text-xs ml-2 flex-shrink-0" style={{ color: 'var(--text-3)' }}>{i.unit}</span>
                )}
                {i.id === value && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
