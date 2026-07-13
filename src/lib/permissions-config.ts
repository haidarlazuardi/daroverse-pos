export const FEATURES = [
  { href: '/pos',             label: 'POS',               section: 'Operasional' },
  { href: '/shift',           label: 'Shift',             section: 'Operasional' },
  { href: '/logbook',         label: 'Logbook',           section: 'Operasional' },
  { href: '/staff',           label: 'Staff Hub',         section: 'Operasional' },
  { href: '/expenses-input',  label: 'Input Pengeluaran', section: 'Operasional' },
  { href: '/production',      label: 'Produksi',          section: 'Dapur & Stok' },
  { href: '/menu-view',       label: 'Menu & Resep',      section: 'Dapur & Stok' },
  { href: '/inventory',       label: 'Stok & Bahan',      section: 'Dapur & Stok' },
  { href: '/bahan-baku',      label: 'Bahan Baku',        section: 'Dapur & Stok' },
  { href: '/transfers',       label: 'Transfer Stok',     section: 'Dapur & Stok' },
  { href: '/stock-opname',    label: 'Stock Opname',      section: 'Dapur & Stok' },
  { href: '/purchase-orders', label: 'Purchase Order',    section: 'Purchasing' },
  { href: '/suppliers',       label: 'Supplier',          section: 'Purchasing' },
  { href: '/products',        label: 'Produk & Menu',     section: 'Manajemen' },
  { href: '/categories',      label: 'Kategori',          section: 'Manajemen' },
  { href: '/discounts',       label: 'Diskon',            section: 'Manajemen' },
  { href: '/customers',       label: 'Pelanggan',         section: 'Manajemen' },
  { href: '/expenses',        label: 'Pengeluaran',       section: 'Manajemen' },
  { href: '/analytics',       label: 'Analitik',          section: 'Laporan' },
  { href: '/reports',         label: 'Laporan',           section: 'Laporan' },
  { href: '/void',            label: 'Void Order',        section: 'Laporan' },
  { href: '/assets',          label: 'Aset',              section: 'Laporan' },
];

export const CONFIGURABLE_ROLES = ['MANAGER', 'CASHIER', 'STAFF'] as const;

export const ROLE_DEFAULTS: Record<string, Record<string, boolean>> = {
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
  STAFF: {
    '/pos': true, '/shift': true, '/logbook': true, '/staff': true, '/expenses-input': true,
    '/production': true, '/menu-view': true, '/inventory': false, '/bahan-baku': false,
    '/transfers': false, '/stock-opname': false, '/purchase-orders': false, '/suppliers': false,
    '/products': false, '/categories': false, '/discounts': false, '/customers': false,
    '/expenses': false, '/analytics': false, '/reports': false, '/void': false, '/assets': false,
  },
};
