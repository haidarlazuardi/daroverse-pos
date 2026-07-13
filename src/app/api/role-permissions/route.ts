export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { SENIOR_ROLES } from '@/lib/auth';

// All configurable features with labels
export const FEATURES = [
  // Operasional
  { href: '/pos',              label: 'POS',                section: 'Operasional' },
  { href: '/shift',            label: 'Shift',              section: 'Operasional' },
  { href: '/logbook',          label: 'Logbook',            section: 'Operasional' },
  { href: '/staff',            label: 'Staff Hub',          section: 'Operasional' },
  { href: '/expenses-input',   label: 'Input Pengeluaran',  section: 'Operasional' },
  // Dapur & Stok
  { href: '/production',       label: 'Produksi',           section: 'Dapur & Stok' },
  { href: '/menu-view',        label: 'Menu & Resep',       section: 'Dapur & Stok' },
  { href: '/inventory',        label: 'Stok & Bahan',       section: 'Dapur & Stok' },
  { href: '/bahan-baku',       label: 'Bahan Baku',         section: 'Dapur & Stok' },
  { href: '/transfers',        label: 'Transfer Stok',      section: 'Dapur & Stok' },
  { href: '/stock-opname',     label: 'Stock Opname',       section: 'Dapur & Stok' },
  // Purchasing
  { href: '/purchase-orders',  label: 'Purchase Order',     section: 'Purchasing' },
  { href: '/suppliers',        label: 'Supplier',           section: 'Purchasing' },
  // Manajemen
  { href: '/products',         label: 'Produk & Menu',      section: 'Manajemen' },
  { href: '/categories',       label: 'Kategori',           section: 'Manajemen' },
  { href: '/discounts',        label: 'Diskon',             section: 'Manajemen' },
  { href: '/customers',        label: 'Pelanggan',          section: 'Manajemen' },
  { href: '/expenses',         label: 'Pengeluaran',        section: 'Manajemen' },
  // Laporan
  { href: '/analytics',        label: 'Analitik',           section: 'Laporan' },
  { href: '/reports',          label: 'Laporan',            section: 'Laporan' },
  { href: '/void',             label: 'Void Order',         section: 'Laporan' },
  { href: '/assets',           label: 'Aset',               section: 'Laporan' },
  // Pengaturan (OWNER only, not configurable for other roles)
];

// Configurable roles (OWNER + SUPER_ADMIN always full access)
export const CONFIGURABLE_ROLES = ['MANAGER', 'CASHIER', 'KITCHEN'] as const;

// Default access per role (fallback if no DB record)
const ROLE_DEFAULTS: Record<string, Record<string, boolean>> = {
  MANAGER: {
    '/pos': true, '/shift': true, '/logbook': true, '/staff': true, '/expenses-input': false,
    '/production': true, '/menu-view': true, '/inventory': true, '/bahan-baku': true,
    '/transfers': true, '/stock-opname': true, '/purchase-orders': true, '/suppliers': true,
    '/products': true, '/categories': true, '/discounts': true, '/customers': true,
    '/expenses': true, '/analytics': true, '/reports': true, '/void': true, '/assets': true,
  },
  CASHIER: {
    '/pos': true, '/shift': true, '/logbook': true, '/staff': true, '/expenses-input': true,
    '/production': false, '/menu-view': false, '/inventory': false, '/bahan-baku': false,
    '/transfers': false, '/stock-opname': false, '/purchase-orders': false, '/suppliers': false,
    '/products': false, '/categories': false, '/discounts': false, '/customers': false,
    '/expenses': false, '/analytics': false, '/reports': false, '/void': false, '/assets': false,
  },
  KITCHEN: {
    '/pos': true, '/shift': true, '/logbook': true, '/staff': true, '/expenses-input': true,
    '/production': true, '/menu-view': true, '/inventory': false, '/bahan-baku': false,
    '/transfers': false, '/stock-opname': false, '/purchase-orders': false, '/suppliers': false,
    '/products': false, '/categories': false, '/discounts': false, '/customers': false,
    '/expenses': false, '/analytics': false, '/reports': false, '/void': false, '/assets': false,
  },
};

export const GET = withAuth(async () => {
  const perms = await (prisma as any).rolePermission.findMany();

  // Build result: merge DB records with defaults
  const result: Record<string, Record<string, boolean>> = {};
  for (const role of CONFIGURABLE_ROLES) {
    result[role] = { ...ROLE_DEFAULTS[role] };
    for (const perm of perms.filter((p: any) => p.role === role)) {
      result[role][perm.feature] = perm.enabled;
    }
  }
  return success(result);
});

export const PATCH = withAuth(async (req: NextRequest, user) => {
  const { role, feature, enabled } = await req.json();
  if (!role || !feature || enabled === undefined) return error('role, feature, enabled wajib');
  if (!CONFIGURABLE_ROLES.includes(role)) return error('Role tidak bisa dikonfigurasi');

  await (prisma as any).rolePermission.upsert({
    where: { role_feature: { role, feature } },
    create: { role, feature, enabled, updatedBy: user.userId },
    update: { enabled, updatedBy: user.userId },
  });

  return success({ role, feature, enabled });
}, ['SUPER_ADMIN'] as any);
