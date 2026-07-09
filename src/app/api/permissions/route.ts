export const dynamic = 'force-dynamic';

import { success, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES, SENIOR_ROLES } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { CASHIER_FEATURES, LOCKED_FEATURES, getCashierPermissions } from '@/lib/permissions';

// GET — feature catalog + current permission state (any authenticated user;
// the cashier drawer reads its own permissions from here).
export const GET = withAuth(async () => {
  const permissions = await getCashierPermissions();
  return success({ features: CASHIER_FEATURES, locked: LOCKED_FEATURES, permissions });
});

// PUT — save cashier permissions (admin only). Body: { permissions: { key: bool } }
export const PUT = withAuth(async (req) => {
  const body = await req.json();
  const incoming = body.permissions || {};
  const clean: Record<string, boolean> = {};
  for (const k of Object.keys(CASHIER_FEATURES)) clean[k] = !!incoming[k]; // ignore unknown/locked keys
  await prisma.appSetting.upsert({
    where: { key: 'cashier_permissions' },
    update: { value: JSON.stringify(clean) },
    create: { key: 'cashier_permissions', value: JSON.stringify(clean) },
  });
  return success({ saved: true, permissions: clean });
}, ADMIN_ROLES);
