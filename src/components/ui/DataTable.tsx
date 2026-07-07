'use client';

import { ReactNode, useState } from 'react';
import clsx from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  render: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyField: keyof T;
  loading?: boolean;
  emptyMessage?: string;
  // Sorting (server or client)
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string, dir: 'asc' | 'desc') => void;
  // Pagination
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  // Row actions
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => ReactNode;
  // Bulk select
  selected?: string[];
  onSelectChange?: (ids: string[]) => void;
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <tr>
      <td colSpan={99} className="px-6 py-16 text-center">
        <div className="flex flex-col items-center gap-2">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
            <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="9" x2="9" y2="21" />
          </svg>
          <p className="text-sm text-gray-400">{message}</p>
        </div>
      </td>
    </tr>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-gray-100">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Sort Icon ────────────────────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir?: 'asc' | 'desc' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      className={clsx('flex-shrink-0 transition-colors', active ? 'text-brand-600' : 'text-gray-300')}>
      {active && dir === 'asc'
        ? <><polyline points="18 15 12 9 6 15" /></>
        : active && dir === 'desc'
          ? <><polyline points="6 9 12 15 18 9" /></>
          : <><polyline points="18 15 12 9 6 15" /><polyline points="6 9 12 15 18 9" /></>
      }
    </svg>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, pageSize, total, onChange }: {
  page: number; pageSize: number; total: number; onChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // Show window of 5 pages around current
  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
      <p className="text-xs text-gray-500">
        {from}–{to} dari {total.toLocaleString('id-ID')} data
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)} disabled={page === 1}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-xs text-gray-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className={clsx(
                'min-w-[28px] h-7 rounded-lg text-xs font-medium transition-colors',
                p === page ? 'bg-brand-600 text-white' : 'hover:bg-gray-100 text-gray-600'
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)} disabled={page === totalPages}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

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
    if (onSort) {
      onSort(key, newDir);
    } else {
      setLocalSort({ key, dir: newDir });
    }
  }

  // Client-side sort if no server sort handler
  let rows = [...data];
  if (!onSort && localSort) {
    rows.sort((a, b) => {
      const av = a[localSort.key]; const bv = b[localSort.key];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return localSort.dir === 'asc' ? cmp : -cmp;
    });
  }

  const allIds = rows.map(r => String(r[keyField]));
  const allSelected = selected && allIds.length > 0 && allIds.every(id => selected.includes(id));
  const someSelected = selected && selected.length > 0 && !allSelected;

  function toggleAll() {
    if (!onSelectChange) return;
    onSelectChange(allSelected ? [] : allIds);
  }

  function toggleOne(id: string) {
    if (!onSelectChange || !selected) return;
    onSelectChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  }

  const showSelect = !!onSelectChange;
  const showActions = !!rowActions;
  const effectiveTotal = total ?? data.length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              {showSelect && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={!!allSelected}
                    ref={el => { if (el) el.indeterminate = !!someSelected; }}
                    onChange={toggleAll}
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                </th>
              )}
              {columns.map(col => (
                <th
                  key={col.key}
                  className={clsx(
                    'px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap',
                    col.sortable && 'cursor-pointer hover:text-gray-700 select-none',
                    col.width
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1.5">
                    {col.label}
                    {col.sortable && (
                      <SortIcon
                        active={activeSortKey === col.key}
                        dir={activeSortKey === col.key ? activeSortDir : undefined}
                      />
                    )}
                  </div>
                </th>
              ))}
              {showActions && <th className="px-4 py-3 w-16" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <SkeletonRows cols={columns.length + (showSelect ? 1 : 0) + (showActions ? 1 : 0)} />
            ) : rows.length === 0 ? (
              <EmptyState message={emptyMessage} />
            ) : (
              rows.map(row => {
                const id = String(row[keyField]);
                const isSelected = selected?.includes(id);
                return (
                  <tr
                    key={id}
                    className={clsx(
                      'transition-colors',
                      onRowClick && 'cursor-pointer',
                      isSelected ? 'bg-brand-50/40' : 'hover:bg-gray-50/60'
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {showSelect && (
                      <td className="px-4 py-3 w-10" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={!!isSelected}
                          onChange={() => toggleOne(id)}
                          className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        />
                      </td>
                    )}
                    {columns.map(col => (
                      <td key={col.key} className="px-4 py-3 text-gray-700 align-middle">
                        {col.render(row)}
                      </td>
                    ))}
                    {showActions && (
                      <td className="px-4 py-3 w-16" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {rowActions(row)}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {onPageChange && (
        <Pagination page={page} pageSize={pageSize} total={effectiveTotal} onChange={onPageChange} />
      )}
    </div>
  );
}
