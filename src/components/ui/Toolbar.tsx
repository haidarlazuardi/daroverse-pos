'use client';

import { ReactNode, useRef } from 'react';
import clsx from 'clsx';

export interface FilterOption { label: string; value: string; }
export interface ToolbarProps {
  search?: string; onSearch?: (v: string) => void; searchPlaceholder?: string;
  filters?: Array<{ key: string; label: string; value: string; options: FilterOption[]; onChange: (v: string) => void; }>;
  onImport?: (file: File) => void; onExport?: () => void; onDownloadTemplate?: () => void; importAccept?: string;
  onAdd?: () => void; addLabel?: string;
  selected?: string[]; bulkActions?: ReactNode;
  extra?: ReactNode;
}

function Icon({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function GhostBtn({ onClick, title, children }: { onClick?: () => void; title?: string; children: ReactNode }) {
  return (
    <button onClick={onClick} title={title}
      className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-all"
      style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}>
      {children}
    </button>
  );
}

export function Toolbar({
  search, onSearch, searchPlaceholder = 'Cari...',
  filters = [],
  onImport, onExport, onDownloadTemplate, importAccept = '.xlsx,.csv',
  onAdd, addLabel = 'Tambah',
  selected = [], bulkActions,
  extra,
}: ToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-3 mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        {onSearch !== undefined && (
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-3)' }}>
              <Icon d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
            </div>
            <input type="text" value={search} onChange={e => onSearch(e.target.value)} placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg transition-all outline-none"
              style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              onFocus={e => (e.target.style.borderColor = 'var(--brand)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')} />
            {search && (
              <button onClick={() => onSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-3)' }}>
                <Icon d="M6 18L18 6M6 6l12 12" size={13} />
              </button>
            )}
          </div>
        )}
        {filters.map(f => (
          <select key={f.key} value={f.value} onChange={e => f.onChange(e.target.value)}
            className="py-2 pl-3 pr-8 text-sm rounded-lg outline-none"
            style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-1)' }}>
            <option value="">{f.label}: Semua</option>
            {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          {onDownloadTemplate && (
            <GhostBtn onClick={onDownloadTemplate} title="Download Template">
              <Icon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              <span className="hidden sm:inline">Template</span>
            </GhostBtn>
          )}
          {onImport && (
            <>
              <input ref={fileRef} type="file" accept={importAccept}
                onChange={e => { const f = e.target.files?.[0]; if (f && onImport) onImport(f); e.target.value = ''; }}
                className="hidden" />
              <GhostBtn onClick={() => fileRef.current?.click()} title="Import">
                <Icon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                <span className="hidden sm:inline">Import</span>
              </GhostBtn>
            </>
          )}
          {onExport && (
            <GhostBtn onClick={onExport} title="Export">
              <Icon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              <span className="hidden sm:inline">Export</span>
            </GhostBtn>
          )}
          {extra}
          {onAdd && (
            <button onClick={onAdd}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all text-white"
              style={{ background: 'var(--brand)', boxShadow: '0 2px 8px var(--brand-glow)' }}
              onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.1)')}
              onMouseLeave={e => (e.currentTarget.style.filter = 'none')}>
              <Icon d="M12 5v14M5 12h14" />
              {addLabel}
            </button>
          )}
        </div>
      </div>
      {selected.length > 0 && bulkActions && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
          style={{ background: 'rgba(72,101,77,0.08)', border: '1px solid rgba(72,101,77,0.2)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--brand)' }}>{selected.length} dipilih</span>
          <div className="h-4 w-px" style={{ background: 'rgba(74,222,128,0.2)' }} />
          <div className="flex items-center gap-2">{bulkActions}</div>
        </div>
      )}
    </div>
  );
}
