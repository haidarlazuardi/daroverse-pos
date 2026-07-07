'use client';

import { ReactNode } from 'react';
import clsx from 'clsx';

// ─── Badge ───────────────────────────────────────────
export function Badge({ children, variant = 'default', className }: {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}) {
  const v: Record<string, string> = {
    default: 'badge-default', success: 'badge-success', warning: 'badge-warning',
    danger: 'badge-danger', info: 'badge-info',
  };
  return <span className={clsx('badge', v[variant], className)}>{children}</span>;
}

// ─── Card ────────────────────────────────────────────
export function Card({ children, className, padding = true }: {
  children: ReactNode; className?: string; padding?: boolean;
}) {
  return <div className={clsx('card', padding && 'card-padded', className)}>{children}</div>;
}

// ─── Stat Card ───────────────────────────────────────
export function StatCard({ label, value, sub, icon }: {
  label: string; value: string; sub?: string; icon?: ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value">{value}</p>
          {sub && <p className="stat-sub">{sub}</p>}
        </div>
        {icon && <div className="p-2.5 rounded-xl bg-gray-50 text-gray-400">{icon}</div>}
      </div>
    </Card>
  );
}

// ─── Button ──────────────────────────────────────────
export function Button({ children, variant = 'primary', size = 'md', className, ...props }: {
  children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg'; className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={clsx('btn', `btn-${size}`, `btn-${variant}`, className)} {...props}>
      {children}
    </button>
  );
}

// ─── Modal ───────────────────────────────────────────
export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className={clsx('modal-content', maxWidth)}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ─── Input ───────────────────────────────────────────
export function Input({ label, error, className, ...props }: {
  label?: string; error?: string; className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <input className={clsx('input', error && 'input-error')} {...props} />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ─── Select ──────────────────────────────────────────
export function Select({ label, options, className, ...props }: {
  label?: string; options: { value: string; label: string }[]; className?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <select className="select" {...props}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── Loader ──────────────────────────────────────────
export function Loader({ className }: { className?: string }) {
  return (
    <div className={clsx('flex items-center justify-center py-12', className)}>
      <svg className="animate-spin w-8 h-8 text-green-600" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.2"/>
        <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/>
      </svg>
    </div>
  );
}

// ─── Format helpers ──────────────────────────────────
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('id-ID').format(n);
}

// ─── Composite components (separate files) ───────────────────────────────────
export { SlideOver } from './SlideOver';
export type { SlideOverProps } from './SlideOver';
export { DataTable } from './DataTable';
export type { Column, DataTableProps } from './DataTable';
export { Toolbar } from './Toolbar';
export type { ToolbarProps, FilterOption } from './Toolbar';
