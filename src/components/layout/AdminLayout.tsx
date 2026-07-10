'use client';

import { ReactNode, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store';
import { ADMIN_ROLES, KITCHEN_ROLES, STOCK_ROLES, SENIOR_ROLES, ROLE_LABELS, ROLE_HOME, type Role } from '@/lib/auth';
import clsx from 'clsx';

type NavItem  = { href: string; label: string; icon: string; allow: Role[] | 'all' };
type NavGroup = { section: string; allow: Role[] | 'all'; items: NavItem[] };

const ALL_ROLES: Role[] = ['SUPER_ADMIN','OWNER','MANAGER','CASHIER','KITCHEN','INVENTORY'];

const NAV_GROUPS: NavGroup[] = [
  { section: 'Operasional', allow: 'all', items: [
    { href: '/dashboard',    label: 'Dashboard',      allow: ADMIN_ROLES,
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { href: '/pos',          label: 'POS',            allow: 'all',
      icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
    { href: '/staff',        label: 'Staff Hub',      allow: ALL_ROLES,
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  ]},
  { section: 'Dapur', allow: KITCHEN_ROLES, items: [
    { href: '/production',   label: 'Produksi',       allow: KITCHEN_ROLES,
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ]},
  { section: 'Inventory', allow: STOCK_ROLES, items: [
    { href: '/inventory',    label: 'Stok & Bahan',   allow: STOCK_ROLES,
      icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
    { href: '/bahan-baku',   label: 'Bahan Baku',     allow: STOCK_ROLES,
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6m-3-3v6' },
    { href: '/transfers',    label: 'Transfer',        allow: STOCK_ROLES,
      icon: 'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4' },
    { href: '/stock-opname', label: 'Stock Opname',   allow: STOCK_ROLES,
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  ]},
  { section: 'Purchasing', allow: STOCK_ROLES, items: [
    { href: '/purchase-orders', label: 'Purchase Order', allow: STOCK_ROLES,
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { href: '/suppliers',    label: 'Supplier',        allow: STOCK_ROLES,
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  ]},
  { section: 'Master Data', allow: ADMIN_ROLES, items: [
    { href: '/categories',   label: 'Kategori',        allow: ADMIN_ROLES,
      icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z' },
    { href: '/products',     label: 'Produk & Menu',   allow: ADMIN_ROLES,
      icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
    { href: '/discounts',    label: 'Diskon',           allow: ADMIN_ROLES,
      icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z' },
    { href: '/assets',       label: 'Aset',             allow: ADMIN_ROLES,
      icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
  ]},
  { section: 'Laporan', allow: ADMIN_ROLES, items: [
    { href: '/analytics',    label: 'Analitik',         allow: ADMIN_ROLES,
      icon: 'M3 3v18h18M9 17V9m4 8V5m4 12v-6' },
    { href: '/reports',      label: 'Laporan',          allow: ADMIN_ROLES,
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { href: '/customers',    label: 'Pelanggan',        allow: ADMIN_ROLES,
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { href: '/expenses',     label: 'Pengeluaran',      allow: ADMIN_ROLES,
      icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  ]},
  { section: 'Pengaturan', allow: SENIOR_ROLES, items: [
    { href: '/users',        label: 'Pengguna',         allow: SENIOR_ROLES,
      icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { href: '/permissions',  label: 'Hak Akses',        allow: SENIOR_ROLES,
      icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
  ]},
];

function canAccess(allow: Role[] | 'all', role: Role) {
  return allow === 'all' || allow.includes(role);
}
function getGroups(role: Role) {
  return NAV_GROUPS
    .filter(g => canAccess(g.allow, role))
    .map(g => ({ ...g, items: g.items.filter(i => canAccess(i.allow, role)) }))
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
  const router   = useRouter();
  const pathname = usePathname();
  const { user, logout, hydrate } = useAuthStore();

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
    if (user?.role === 'CASHIER' && !pathname.startsWith('/pos')) router.replace('/pos');
  }, [user, router, pathname]);

  const handleLogout = () => { logout(); router.replace('/login'); };
  if (!user) return null;

  const currentUser = user; // non-null reference for use inside nested components
  const role   = currentUser.role as Role;
  const groups = getGroups(role);
  const pageLabel = pathname.split('/').filter(Boolean).pop()?.replace(/-/g,' ') || 'Dashboard';

  function Sidebar({ onNav }: { onNav?: () => void }) {
    return (
      <div className="flex flex-col h-full" style={{ background: 'var(--surface-2)', borderRight: '1px solid var(--border)' }}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-[60px] flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          {/* Logo mark — FocusFlow style: small geometric mark */}
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--green-2), var(--green))', boxShadow: '0 0 16px var(--green-glow)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-extrabold tracking-tight" style={{ color: 'var(--text-1)', letterSpacing: '-0.03em' }}>Soeka House</p>
            <p className="text-[10px] font-medium" style={{ color: 'var(--text-3)' }}>POS System</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
          {groups.map(group => (
            <div key={group.section}>
              <p className="px-2 mb-1 text-[9px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--text-3)' }}>
                {group.section}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const active = pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <button key={item.href} onClick={() => { router.push(item.href); onNav?.(); }}
                      className={clsx(
                        'w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-all text-left',
                        active
                          ? 'nav-item-active'
                          : 'nav-item-inactive'
                      )}
                      style={{ borderRadius: 'var(--r-sm)' }}>
                      <NavIcon d={item.icon} />
                      <span className="truncate">{item.label}</span>
                      {active && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: 'var(--green)', boxShadow: '0 0 6px var(--green)' }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          {user && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 mb-1 rounded-xl"
            style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 text-black"
              style={{ background: 'linear-gradient(135deg, var(--green-2), var(--green))' }}>
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate" style={{ color: 'var(--text-1)', letterSpacing: '-0.01em' }}>{currentUser.name}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>{ROLE_LABELS[currentUser.role as Role]}</p>
            </div>
          </div>
          )}
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-xl transition-all"
            style={{ color: 'var(--red)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--red-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span className="text-xs font-semibold">Logout</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-[220px] flex-shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.8)' }}
            onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[240px]">
            <Sidebar onNav={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-[60px] flex items-center justify-between px-3 sm:px-5 flex-shrink-0"
          style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-md)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-lg"
              style={{ color: 'var(--text-3)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            {/* Breadcrumb style page title */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--text-3)' }}>Soeka House</p>
              <p className="text-sm font-extrabold capitalize leading-none mt-0.5" style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}>{pageLabel}</p>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Search pill */}
            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
              style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-3)', minWidth: 180 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <span className="text-xs">Cari...</span>
            </div>
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-black cursor-pointer"
              style={{ background: 'linear-gradient(135deg, var(--green-2), var(--green))', boxShadow: '0 0 10px var(--green-glow-sm)' }}>
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">
          {children}
        </main>
      </div>
    </div>
  );
}
