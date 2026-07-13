export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { CONFIGURABLE_ROLES, ROLE_DEFAULTS } from '@/lib/permissions-config';

export const GET = withAuth(async () => {
  const perms = await (prisma as any).rolePermission.findMany();
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
