export const dynamic = 'force-dynamic';

import { success, error, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES, SENIOR_ROLES, ALL_ROLES } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET — all settings as a { key: value } map (any authenticated user)
export const GET = withAuth(async () => {
  const rows = await prisma.appSetting.findMany();
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return success(map);
});

// PUT — upsert settings (admin). Body: { key: value, ... }
export const PUT = withAuth(async (req) => {
  const body = (await req.json()) as Record<string, string>;
  const entries = Object.entries(body).filter(([k]) => k);
  if (!entries.length) return error('Tidak ada setting untuk disimpan');

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    )
  );
  return success({ saved: entries.length });
}, ALL_ROLES);
