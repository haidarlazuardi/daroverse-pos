import prisma from './prisma';
import { TokenPayload, ADMIN_ROLES } from './auth';

// Catalog of features that CAN be toggled for cashier/staff (with default state).
export const CASHIER_FEATURES: Record<string, { label: string; default: boolean; group: string }> = {
  batch: { label: 'Bikin batch', default: true, group: 'Operasional stok' },
  transfer: { label: 'Ambil bahan (transfer)', default: true, group: 'Operasional stok' },
  waste: { label: 'Buang stok', default: true, group: 'Operasional stok' },
  check_stock: { label: 'Cek stok', default: true, group: 'Operasional stok' },
  receive_po: { label: 'Terima barang dari supplier', default: true, group: 'Operasional stok' },
  opname_input: { label: 'Input hitungan opname', default: true, group: 'Operasional stok' },
  opname_apply: { label: 'Apply opname (potong selisih ke stok)', default: true, group: 'Operasional stok' },
  view_menu: { label: 'Lihat menu & resep', default: true, group: 'Menu & transaksi' },
  use_discount: { label: 'Pakai diskon yang ada', default: true, group: 'Menu & transaksi' },
  create_discount: { label: 'Bikin / edit diskon', default: false, group: 'Menu & transaksi' },
  edit_product: { label: 'Edit produk & harga', default: false, group: 'Menu & transaksi' },
  expense: { label: 'Catat pengeluaran', default: false, group: 'Keuangan' },
};

// Permanently admin-only — never grantable to cashier (safety).
export const LOCKED_FEATURES = ['manage_users', 'settings', 'refund', 'view_finance', 'manage_supplier'];

const SETTING_KEY = 'cashier_permissions';

export function defaultPermissions(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(CASHIER_FEATURES)) out[k] = v.default;
  return out;
}

export async function getCashierPermissions(): Promise<Record<string, boolean>> {
  const defaults = defaultPermissions();
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
    if (!row?.value) return defaults;
    const parsed = JSON.parse(row.value);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

// Returns an error message if denied, or null if allowed.
// ADMIN_ROLES (SUPER_ADMIN, OWNER, MANAGER) always allowed.
// INVENTORY and KITCHEN also allowed for stock operations.
export async function ensureCan(user: TokenPayload, feature: string): Promise<string | null> {
  if (ADMIN_ROLES.includes(user.role as any)) return null;
  if (['INVENTORY', 'KITCHEN'].includes(user.role)) return null; // label roles always have full op access
  if (LOCKED_FEATURES.includes(feature)) return 'Fitur ini khusus admin.';
  const perms = await getCashierPermissions();
  return perms[feature] ? null : 'Kamu belum diberi akses untuk ini. Minta admin mengaktifkan di Hak Akses.';
}
