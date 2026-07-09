'use client';

import { ReactNode, useState } from 'react';
import clsx from 'clsx';

export interface Column<T> {
  key: string; label: string; sortable?: boolean; width?: string;
  render: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  data: T[]; columns: Column<T>[]; keyField: keyof T;
  loading?: boolean; emptyMessage?: string;
  sortKey?: string; sortDir?: 'asc' | 'desc';
  onSort?: (key: string, dir: 'asc' | 'desc') => void;
  page?: number; pageSize?: number; total?: number;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => ReactNode;
  selected?: string[]; onSelectChange?: (ids: string[]) => void;
}

function EmptyState({ message }: { message: string }) {
  return (
    <tr>
      <td colSpan={99} className="px-6 py-16 text-center">
        <div className="flex flex-col items-center gap-2">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
            style={{ color: 'var(--text-3)' }}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="9" x2="9" y2="21" />
          </svg>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>{message}</p>
        </div>
      </td>
    </tr>
  );
}

function SkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)', width: `${60 + Math.random() * 30}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir?: 'asc' | 'desc' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      style={{ color: active ? 'var(--brand-light)' : 'var(--text-muted)', flexShrink: 0 }}>
      {active && dir === 'asc' ? <polyline points="18 15 12 9 6 15" />
        : active && dir === 'desc' ? <polyline points="6 9 12 15 18 9" />
        : <><polyline points="18 15 12 9 6 15" /><polyline points="6 9 12 15 18 9" /></>}
    </svg>
  );
}

function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);
  const pages: (number | '...')[] = [];
  if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
  else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page-1); i <= Math.min(totalPages-1, page+1); i++) pages.push(i);
    if (page < totalPages-2) pages.push('...');
    pages.push(totalPages);
  }
  return (
    <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
      <p className="text-xs" style={{ color: 'var(--text-3)' }}>{from}–{to} dari {total.toLocaleString('id-ID')}</p>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(page-1)} disabled={page===1}
          className="p-1.5 rounded-lg disabled:opacity-30 transition-colors"
          style={{ color: 'var(--text-3)' }}
          onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        {pages.map((p, i) => p === '...'
          ? <span key={`e${i}`} className="px-2 text-xs" style={{ color: 'var(--text-3)' }}>…</span>
          : <button key={p} onClick={() => onChange(p as number)}
              className="min-w-[28px] h-7 rounded-lg text-xs font-medium transition-all"
              style={p === page
                ? { background: 'var(--green-2)', color: '#000', boxShadow: '0 0 8px var(--green-glow)' }
                : { color: 'var(--text-2)' }}
              onMouseEnter={e => { if (p !== page) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={e => { if (p !== page) e.currentTarget.style.background = 'transparent'; }}>
              {p}
            </button>
        )}
        <button onClick={() => onChange(page+1)} disabled={page===totalPages}
          className="p-1.5 rounded-lg disabled:opacity-30 transition-colors"
          style={{ color: 'var(--text-3)' }}
          onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
  );
}

export function DataTable<T extends Record<string, any>>({
  data, columns, keyField, loading = false, emptyMessage = 'Belum ada data',
  sortKey, sortDir, onSort,
  page = 1, pageSize = 20, total, onPageChange,
  onRowClick, rowActions,
  selected, onSelectChange,
}: DataTableProps<T>) {
  const [localSort, setLocalSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const activeSortKey = sortKey ?? localSort?.key;
  const activeSortDir = sortDir ?? localSort?.dir;

  function handleSort(key: string) {
    const newDir = activeSortKey === key && activeSortDir === 'asc' ? 'desc' : 'asc';
    if (onSort) onSort(key, newDir);
    else setLocalSort({ key, dir: newDir });
  }

  let rows = [...data];
  if (!onSort && localSort) {
    rows.sort((a, b) => {
      const cmp = a[localSort.key] < b[localSort.key] ? -1 : a[localSort.key] > b[localSort.key] ? 1 : 0;
      return localSort.dir === 'asc' ? cmp : -cmp;
    });
  }

  const allIds      = rows.map(r => String(r[keyField]));
  const allSelected = selected && allIds.length > 0 && allIds.every(id => selected.includes(id));
  const someSelected = selected && selected.length > 0 && !allSelected;
  const showSelect  = !!onSelectChange;
  const showActions = !!rowActions;
  const effectiveTotal = total ?? data.length;

  return (
    <div className="overflow-hidden rounded-xl" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)' }}>
              {showSelect && (
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={!!allSelected}
                    ref={el => { if (el) el.indeterminate = !!someSelected; }}
                    onChange={() => onSelectChange!(allSelected ? [] : allIds)}
                    className="rounded" style={{ accentColor: 'var(--brand)' }} />
                </th>
              )}
              {columns.map(col => (
                <th key={col.key}
                  className={clsx('px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap', col.sortable && 'cursor-pointer select-none', col.width)}
                  style={{ color: 'var(--text-3)' }}
                  onClick={() => col.sortable && handleSort(col.key)}>
                  <div className="flex items-center gap-1.5">
                    {col.label}
                    {col.sortable && <SortIcon active={activeSortKey === col.key} dir={activeSortKey === col.key ? activeSortDir : undefined} />}
                  </div>
                </th>
              ))}
              {showActions && <th className="px-4 py-3 w-16" />}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows cols={columns.length + (showSelect?1:0) + (showActions?1:0)} />
            ) : rows.length === 0 ? (
              <EmptyState message={emptyMessage} />
            ) : (
              rows.map(row => {
                const id = String(row[keyField]);
                const isSelected = selected?.includes(id);
                return (
                  <tr key={id}
                    className={clsx(onRowClick && 'cursor-pointer')}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: isSelected ? 'rgba(92,138,98,0.1)' : undefined,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    onClick={() => onRowClick?.(row)}>
                    {showSelect && (
                      <td className="px-4 py-3 w-10" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={!!isSelected}
                          onChange={() => {
                            if (!onSelectChange || !selected) return;
                            onSelectChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
                          }}
                          className="rounded" style={{ accentColor: 'var(--brand)' }} />
                      </td>
                    )}
                    {columns.map(col => (
                      <td key={col.key} className="px-3 sm:px-4 py-2.5 align-middle" style={{ color: 'var(--text-2)' }}>
                        {col.render(row)}
                      </td>
                    ))}
                    {showActions && (
                      <td className="px-4 py-3 w-16" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">{rowActions(row)}</div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {onPageChange && <Pagination page={page} pageSize={pageSize} total={effectiveTotal} onChange={onPageChange} />}
    </div>
  );
}
