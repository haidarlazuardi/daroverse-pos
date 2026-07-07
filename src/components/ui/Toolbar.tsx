'use client';

import { ReactNode, useRef } from 'react';
import clsx from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FilterOption {
  label: string;
  value: string;
}

export interface ToolbarProps {
  // Search
  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  // Filters (simple selects)
  filters?: Array<{
    key: string;
    label: string;
    value: string;
    options: FilterOption[];
    onChange: (v: string) => void;
  }>;
  // Import / Export / Template
  onImport?: (file: File) => void;
  onExport?: () => void;
  onDownloadTemplate?: () => void;
  importAccept?: string;
  // Add button
  onAdd?: () => void;
  addLabel?: string;
  // Bulk actions (shown when items selected)
  selected?: string[];
  bulkActions?: ReactNode;
  // Extra right-side content
  extra?: ReactNode;
}

// ─── Icon helpers ─────────────────────────────────────────────────────────────

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function Toolbar({
  search, onSearch, searchPlaceholder = 'Cari...',
  filters = [],
  onImport, onExport, onDownloadTemplate, importAccept = '.xlsx,.csv',
  onAdd, addLabel = 'Tambah',
  selected = [], bulkActions,
  extra,
}: ToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && onImport) onImport(file);
    e.target.value = ''; // reset so same file can be re-imported
  }

  const hasSelected = selected.length > 0;

  return (
    <div className="flex flex-col gap-3 mb-4">
      {/* Main toolbar row */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* Search */}
        {onSearch !== undefined && (
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <Icon d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
            </div>
            <input
              type="text"
              value={search}
              onChange={e => onSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors"
            />
            {search && (
              <button
                onClick={() => onSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
              >
                <Icon d="M6 18L18 6M6 6l12 12" size={14} />
              </button>
            )}
          </div>
        )}

        {/* Filters */}
        {filters.map(f => (
          <select
            key={f.key}
            value={f.value}
            onChange={e => f.onChange(e.target.value)}
            className="py-2 pl-3 pr-8 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors"
          >
            <option value="">{f.label}: Semua</option>
            {f.options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Secondary actions */}
        <div className="flex items-center gap-2">
          {onDownloadTemplate && (
            <button
              onClick={onDownloadTemplate}
              title="Download Template"
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Icon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              <span className="hidden sm:inline">Template</span>
            </button>
          )}
          {onImport && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept={importAccept}
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                title="Import"
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <Icon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                <span className="hidden sm:inline">Import</span>
              </button>
            </>
          )}
          {onExport && (
            <button
              onClick={onExport}
              title="Export"
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Icon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}
          {extra}
          {onAdd && (
            <button
              onClick={onAdd}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-sm transition-colors"
            >
              <Icon d="M12 5v14M5 12h14" />
              {addLabel}
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {hasSelected && bulkActions && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-brand-50 border border-brand-200 rounded-xl">
          <span className="text-sm font-medium text-brand-700">
            {selected.length} dipilih
          </span>
          <div className="h-4 w-px bg-brand-200" />
          <div className="flex items-center gap-2">
            {bulkActions}
          </div>
        </div>
      )}
    </div>
  );
}
