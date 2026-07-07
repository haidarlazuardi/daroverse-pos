'use client';

import { ReactNode, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store';
import { ADMIN_ROLES, KITCHEN_ROLES, STOCK_ROLES, SENIOR_ROLES, ROLE_LABELS, ROLE_HOME, type Role } from '@/lib/auth';
import clsx from 'clsx';

// ─── NAV STRUCTURE ────────────────────────────────────────────────────────────
// Each item has an `allow` list — if user role isn't in it, item is hidden.
// `all` means every role sees it.

type NavItem = {
  href: string;
  label: string;
  icon: string;
  allow: Role[] | 'all';
};

type NavGroup = {
  section: string;
  allow: Role[] | 'all'; // hides whole section if role not allowed
  items: NavItem[];
};

const ALL_ROLES: Role[] = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER', 'KITCHEN', 'INVENTORY'];

const NAV_GROUPS: NavGroup[] = [
  {
    section: 'Operasional',
    allow: 'all',
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        allow: ADMIN_ROLES,
        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      },
      {
        href: '/pos',
        label: 'POS',
        allow: 'all',
        icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
      },
      {
        href: '/staff',
        label: 'Staff Hub',
        allow: ALL_ROLES,
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
      },
    ],
  },
  {
    section: 'Dapur',
    allow: KITCHEN_ROLES,
    items: [
      {
        href: '/production',
        label: 'Produksi',
        allow: KITCHEN_ROLES,
        icon: 'M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
      },
    ],
  },
  {
    section: 'Inventory',
    allow: STOCK_ROLES,
    items: [
      {
        href: '/inventory',
        label: 'Stok & Bahan',
        allow: STOCK_ROLES,
        icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
      },
      {
        href: '/transfers',
        label: 'Transfer',
        allow: STOCK_ROLES,
        icon: 'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4',
      },
      {
        href: '/stock-opname',
        label: 'Stock Opname',
        allow: STOCK_ROLES,
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      },
    ],
  },
  {
    section: 'Purchasing',
    allow: STOCK_ROLES,
    items: [
      {
        href: '/purchase-orders',
        label: 'Purchase Order',
        allow: STOCK_ROLES,
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      },
      {
        href: '/suppliers',
        label: 'Supplier',
        allow: STOCK_ROLES,
        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      },
    ],
  },
  {
    section: 'Master Data',
    allow: ADMIN_ROLES,
    items: [
      {
        href: '/products',
        label: 'Produk & Menu',
        allow: ADMIN_ROLES,
        icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
      },
      {
        href: '/discounts',
        label: 'Diskon',
        allow: ADMIN_ROLES,
        icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z',
      },
      {
        href: '/assets',
        label: 'Aset',
        allow: ADMIN_ROLES,
        icon: 'M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3zm5 2h6m-6 4h6m-6 4h4',
      },
    ],
  },
  {
    section: 'Laporan',
    allow: ADMIN_ROLES,
    items: [
      {
        href: '/analytics',
        label: 'Analitik',
        allow: ADMIN_ROLES,
        icon: 'M3 3v18h18M9 17V9m4 8V5m4 12v-6',
      },
      {
        href: '/reports',
        label: 'Laporan',
        allow: ADMIN_ROLES,
        icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      },
      {
        href: '/expenses',
        label: 'Pengeluaran',
        allow: ADMIN_ROLES,
        icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
      },
    ],
  },
  {
    section: 'Pengaturan',
    allow: SENIOR_ROLES,
    items: [
      {
        href: '/users',
        label: 'Pengguna',
        allow: SENIOR_ROLES,
        icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
      },
      {
        href: '/permissions',
        label: 'Hak Akses',
        allow: SENIOR_ROLES,
        icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
      },
    ],
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function canAccess(allow: Role[] | 'all', role: Role): boolean {
  if (allow === 'all') return true;
  return allow.includes(role);
}

function getVisibleGroups(role: Role): NavGroup[] {
  return NAV_GROUPS
    .filter(g => canAccess(g.allow, role))
    .map(g => ({
      ...g,
      items: g.items.filter(i => canAccess(i.allow, role)),
    }))
    .filter(g => g.items.length > 0);
}

// ─── NAV ITEM COMPONENT ───────────────────────────────────────────────────────

function NavButton({ item, active, collapsed, onClick }: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={clsx(
        'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all',
        active
          ? 'bg-brand-50 text-brand-700'
          : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900',
        collapsed && 'justify-center px-0'
      )}
    >
      <svg
        width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.75"
        strokeLinecap="round" strokeLinejoin="round"
        className="flex-shrink-0"
      >
        <path d={item.icon} />
      </svg>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, hydrate } = useAuthStore();

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (!user) {
      const timer = setTimeout(() => {
        const u = useAuthStore.getState().user;
        if (!u) router.replace('/login');
        else {
          const home = ROLE_HOME[u.role as Role] ?? '/pos';
          if (pathname === '/') router.replace(home);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
    // CASHIER & KITCHEN can only be in POS or production, not admin pages
    const restrictedToHome = ['CASHIER'];
    if (user && restrictedToHome.includes(user.role as Role) && pathname !== '/pos' && !pathname.startsWith('/pos')) {
      router.replace('/pos');
    }
  }, [user, router, pathname]);

  const handleLogout = () => { logout(); router.replace('/login'); };

  if (!user) return null;

  const userRole = user.role as Role;
  const visibleGroups = getVisibleGroups(userRole);
  const roleLabel = ROLE_LABELS[userRole] ?? user.role;

  // ─── SIDEBAR CONTENT (shared between desktop + mobile) ─────────────────────
  function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <nav className="flex-1 py-3 px-3 overflow-y-auto space-y-4">
        {visibleGroups.map(group => (
          <div key={group.section}>
            {!collapsed && (
              <p className="px-3 mb-1 text-[10px] font-semibold tracking-widest uppercase text-surface-400">
                {group.section}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <NavButton
                    key={item.href}
                    item={item}
                    active={active}
                    collapsed={collapsed}
                    onClick={() => { router.push(item.href); onNavigate?.(); }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    );
  }

  return (
    <div className="flex h-screen bg-surface-50">

      {/* ── Desktop Sidebar ─────────────────────────────────────────────── */}
      <aside className={clsx(
        'hidden lg:flex flex-col bg-white border-r border-surface-200 transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-[240px]'
      )}>
        {/* Logo */}
        <div className={clsx(
          'flex items-center h-14 px-4 border-b border-surface-100 flex-shrink-0',
          collapsed && 'justify-center'
        )}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cream flex items-center justify-center flex-shrink-0 overflow-hidden border border-cream-dark">
              <img src="/soeka-logo.png" alt="Soeka House" className="w-full h-full object-contain" />
            </div>
            {!collapsed && (
              <span className="font-bold text-surface-900 text-base tracking-tight leading-tight">
                Soeka House
              </span>
            )}
          </div>
        </div>

        <SidebarNav />

        {/* Footer */}
        <div className={clsx('p-3 border-t border-surface-100 space-y-1', collapsed && 'flex flex-col items-center')}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center p-2 text-surface-400 hover:text-surface-600 rounded-lg hover:bg-surface-50 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {collapsed ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
            </svg>
          </button>
          <button
            onClick={handleLogout}
            className={clsx('w-full flex items-center gap-3 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors', collapsed && 'justify-center')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ── Mobile Drawer ───────────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[260px] bg-white shadow-2xl flex flex-col">
            {/* Mobile header */}
            <div className="flex items-center justify-between h-14 px-4 border-b border-surface-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg overflow-hidden border border-cream-dark">
                  <img src="/soeka-logo.png" alt="Soeka House" className="w-full h-full object-contain" />
                </div>
                <span className="font-bold text-surface-900 text-base">Soeka House</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-2 hover:bg-surface-100 rounded-lg">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Mobile nav — collapsed=false always on mobile */}
            <nav className="flex-1 py-3 px-3 overflow-y-auto space-y-4">
              {visibleGroups.map(group => (
                <div key={group.section}>
                  <p className="px-3 mb-1 text-[10px] font-semibold tracking-widest uppercase text-surface-400">
                    {group.section}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map(item => {
                      const active = pathname === item.href || pathname.startsWith(item.href + '/');
                      return (
                        <NavButton
                          key={item.href}
                          item={item}
                          active={active}
                          collapsed={false}
                          onClick={() => { router.push(item.href); setMobileOpen(false); }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="p-3 border-t">
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-xl">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main Area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-surface-200 flex items-center justify-between px-4 lg:px-5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 hover:bg-surface-100 rounded-lg">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <h1 className="text-base font-semibold text-surface-900 capitalize">
              {pathname.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-surface-900 leading-tight">{user.name}</p>
              <p className="text-xs text-surface-400">{roleLabel}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs">
              {user.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-5">
          {children}
        </main>
      </div>
    </div>
  );
}
