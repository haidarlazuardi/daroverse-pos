export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, withAuth } from '@/lib/api-helpers';
import { ALL_ROLES } from '@/lib/auth';

// Return role-based permissions — currently all features enabled for all roles
// Future: look up per-user permission overrides from DB
export const GET = withAuth(async (_req: NextRequest, user) => {
  const isAdmin = ['SUPER_ADMIN','OWNER','MANAGER'].includes(user.role);
  return success({
    batch_production: true,
    take_stock:       true,
    view_stock:       true,
    waste_stock:      true,
    receive_stock:    isAdmin,
    stock_opname:     true,
    apply_opname:     isAdmin,
    view_menu:        true,
    expense:          true,
    receive_po:       isAdmin,
  });
}, ALL_ROLES);
