'use client';

import { ReactNode, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store';
import { ADMIN_ROLES, KITCHEN_ROLES, STOCK_ROLES, SENIOR_ROLES, CASHIER_ALL, ROLE_LABELS, ROLE_HOME, type Role } from '@/lib/auth';
import { LogbookBar } from '@/components/ui/LogbookBar';
import clsx from 'clsx';

type NavItem  = { href: string; label: string; icon: string; allow: Role[] | 'all' };
type NavGroup = { section: string; allow: Role[] | 'all'; defaultOpen?: boolean | ((role: Role) => boolean); items: NavItem[] };

const ALL_ROLES: Role[] = ['SUPER_ADMIN','OWNER','MANAGER','CASHIER','KITCHEN'];

const NAV_GROUPS: NavGroup[] = [
  // ── Semua role ──────────────────────────────────────────────────────────
  { section: 'Operasional', allow: 'all',
    defaultOpen: () => true, // selalu open untuk semua role
    items: [
    { href: '/dashboard', label: 'Dashboard', allow: ADMIN_ROLES,
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { href: '/pos', label: 'POS', allow: 'all',
      icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
    { href: '/shift', label: 'Shift', allow: 'all',
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { href: '/logbook', label: 'Logbook', allow: 'all',
      icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
    { href: '/staff', label: 'Staff Hub', allow: ALL_ROLES,
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  ]},

  // ── Kasir only ──────────────────────────────────────────────────────────
  { section: 'Kasir', allow: ['CASHIER','KITCHEN'] as Role[],
    defaultOpen: () => true,
    items: [
    { href: '/expenses-input', label: 'Input Pengeluaran', allow: ['CASHIER','KITCHEN'] as Role[],
      icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  ]},

  // ── Dapur & Stok (KITCHEN + MANAGER) ───────────────────────────────────
  { section: 'Dapur & Stok', allow: KITCHEN_ROLES,
    defaultOpen: (role) => role === 'KITCHEN', // open untuk kitchen, collapsed untuk manager
    items: [
    { href: '/production', label: 'Produksi', allow: KITCHEN_ROLES,
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
    { href: '/menu-view', label: 'Menu & Resep', allow: KITCHEN_ROLES,
      icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
    { href: '/inventory', label: 'Stok & Bahan', allow: STOCK_ROLES,
      icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
    { href: '/bahan-baku', label: 'Bahan Baku', allow: STOCK_ROLES,
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6m-3-3v6' },
    { href: '/transfers', label: 'Transfer', allow: STOCK_ROLES,
      icon: 'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4' },
    { href: '/stock-opname', label: 'Stock Opname', allow: STOCK_ROLES,
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  ]},

  // ── Purchasing ──────────────────────────────────────────────────────────
  { section: 'Purchasing', allow: STOCK_ROLES,
    defaultOpen: (role) => false, // collapsed default
    items: [
    { href: '/purchase-orders', label: 'Purchase Order', allow: STOCK_ROLES,
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { href: '/suppliers', label: 'Supplier', allow: STOCK_ROLES,
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  ]},

  // ── Manajemen (MANAGER + OWNER) ─────────────────────────────────────────
  { section: 'Manajemen', allow: ADMIN_ROLES,
    defaultOpen: (role) => ['SUPER_ADMIN','OWNER','MANAGER'].includes(role),
    items: [
    { href: '/products', label: 'Produk & Menu', allow: ADMIN_ROLES,
      icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
    { href: '/categories', label: 'Kategori', allow: ADMIN_ROLES,
      icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z' },
    { href: '/discounts', label: 'Diskon', allow: ADMIN_ROLES,
      icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z' },
    { href: '/customers', label: 'Pelanggan', allow: ADMIN_ROLES,
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { href: '/expenses', label: 'Pengeluaran', allow: ADMIN_ROLES,
      icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  ]},

  // ── Laporan ─────────────────────────────────────────────────────────────
  { section: 'Laporan', allow: ADMIN_ROLES,
    defaultOpen: (role) => false,
    items: [
    { href: '/analytics', label: 'Analitik', allow: ADMIN_ROLES,
      icon: 'M3 3v18h18M9 17V9m4 8V5m4 12v-6' },
    { href: '/reports', label: 'Laporan', allow: ADMIN_ROLES,
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { href: '/void', label: 'Void Order', allow: ADMIN_ROLES,
      icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
    { href: '/assets', label: 'Aset', allow: ADMIN_ROLES,
      icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
  ]},

  // ── Pengaturan (OWNER only) ─────────────────────────────────────────────
  { section: 'Pengaturan', allow: SENIOR_ROLES,
    defaultOpen: (role) => false,
    items: [
    { href: '/loyalty', label: 'Loyalty Rewards', allow: SENIOR_ROLES,
      icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7' },
    { href: '/users', label: 'Pengguna', allow: SENIOR_ROLES,
      icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { href: '/permissions', label: 'Hak Akses', allow: SENIOR_ROLES,
      icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
    { href: '/audit-log', label: 'Audit Log', allow: SENIOR_ROLES,
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  ]},
];

function canAccess(allow: Role[] | 'all', role: Role) {
  return allow === 'all' || (allow as Role[]).includes(role);
}
function getGroups(role: Role, perms: Record<string, boolean>) {
  const isFullAccess = ['SUPER_ADMIN','OWNER'].includes(role);
  return NAV_GROUPS
    .filter(g => canAccess(g.allow, role))
    .map(g => ({
      ...g,
      items: g.items.filter(i => {
        if (!canAccess(i.allow, role)) return false;
        // For configurable roles, check DB permissions
        if (!isFullAccess && Object.keys(perms).length > 0) {
          return perms[i.href] !== false; // default true if not set
        }
        return true;
      }),
    }))
    .filter(g => g.items.length > 0);
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
      <path d={d} />
    </svg>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [rolePerms, setRolePerms]   = useState<Record<string, boolean>>({});
  const router   = useRouter();
  const pathname = usePathname();
  const { user, logout, hydrate } = useAuthStore();

  // Fetch role permissions from DB (only for configurable roles)
  useEffect(() => {
    if (!user) return;
    if (['SUPER_ADMIN','OWNER'].includes(user.role)) return; // always full access
    fetch('/api/role-permissions')
      .then(r => r.json())
      .then(d => {
        if (d.data?.[user.role]) setRolePerms(d.data[user.role]);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (!user) {
      const t = setTimeout(() => {
        const u = useAuthStore.getState().user;
        if (!u) router.replace('/login');
        else if (pathname === '/') router.replace(ROLE_HOME[u.role as Role] ?? '/pos');
      }, 500);
      return () => clearTimeout(t);
    }
    if (pathname === '/') router.replace(ROLE_HOME[user.role as Role] ?? '/pos');

    if ((user?.role as string) === 'CASHIER') {
      const allowed = ['/pos', '/shift', '/expenses-input', '/staff', '/logbook'];
      if (!allowed.some(p => pathname.startsWith(p))) router.replace('/pos');
    }
    if ((user?.role as string) === 'KITCHEN') {
      const allowed = ['/pos', '/shift', '/production', '/menu-view', '/staff', '/logbook', '/expenses-input'];
      if (!allowed.some(p => pathname.startsWith(p))) router.replace('/production');
    }
    // Enforce DB permissions for configurable roles
    if (!['SUPER_ADMIN','OWNER'].includes(user?.role || '') && Object.keys(rolePerms).length > 0) {
      const isDisabled = rolePerms[pathname] === false;
      if (isDisabled) router.replace(ROLE_HOME[user?.role as Role] ?? '/pos');
    }
  }, [user, router, pathname]);

  const handleLogout = () => { logout(); router.replace('/login'); };
  if (!user) return null;

  const role   = user.role as Role;
  const groups = getGroups(role, rolePerms);
  const pageLabel = pathname.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Dashboard';

  function Sidebar({ onNav }: { onNav?: () => void }) {
    const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
      const init: Record<string, boolean> = {};
      NAV_GROUPS.forEach(g => {
        const def = g.defaultOpen;
        init[g.section] = typeof def === 'function' ? def(role) : (def !== false);
      });
      // Always open section containing current active path
      NAV_GROUPS.forEach(g => {
        if (g.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))) {
          init[g.section] = true;
        }
      });
      return init;
    });

    return (
      <div className="flex flex-col h-full" style={{ background: 'var(--surface-2)', borderRight: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 px-4 h-[60px] flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-extrabold tracking-tight" style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Soeka House</p>
            <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>POS System</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {groups.map(group => {
            const isOpen = !!openSections[group.section];
            const hasActive = group.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'));
            return (
              <div key={group.section} className="mb-1">
                <button
                  onClick={() => setOpenSections(p => ({ ...p, [group.section]: !p[group.section] }))}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors hover:bg-black/5">
                  <p className="text-[9px] font-black uppercase tracking-[0.12em]"
                    style={{ color: hasActive ? 'var(--brand)' : 'var(--text-3)' }}>
                    {group.section}
                  </p>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    className={clsx('transition-transform duration-200', isOpen ? 'rotate-180' : '')}
                    style={{ color: 'var(--text-3)' }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {isOpen && (
                  <div className="space-y-0.5 mb-1">
                    {group.items.map(item => {
                      const active = pathname === item.href || pathname.startsWith(item.href + '/');
                      return (
                        <button key={item.href}
                          onClick={() => { router.push(item.href); onNav?.(); }}
                          className={clsx('nav-item', active ? 'nav-item-active' : 'nav-item-inactive')}>
                          <NavIcon d={item.icon} />
                          <span className="truncate text-sm">{item.label}</span>
                          {active && <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--brand)' }} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2.5 px-3 py-2.5 mb-1 rounded-xl" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 text-white" style={{ background: 'var(--brand)' }}>
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate" style={{ color: 'var(--text-1)' }}>{user?.name}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>{ROLE_LABELS[role]}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-xl transition-all font-semibold"
            style={{ color: 'var(--red)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--red-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <aside className="hidden lg:flex flex-col w-[220px] flex-shrink-0">
        <Sidebar />
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[240px]">
            <Sidebar onNav={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-[60px] flex items-center justify-between px-4 flex-shrink-0"
          style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-md)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-lg" style={{ color: 'var(--text-3)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--text-3)' }}>Soeka House</p>
              <p className="text-sm font-bold capitalize leading-none mt-0.5" style={{ color: 'var(--text-1)', letterSpacing: '-0.01em' }}>{pageLabel}</p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white" style={{ background: 'var(--brand)' }}>
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
        </header>

        <LogbookBar />

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">
          {children}
        </main>
      </div>
    </div>
  );
}
