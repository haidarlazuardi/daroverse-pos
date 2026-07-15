export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES } from '@/lib/auth';

export const GET = withAuth(async () => {
  const templates = await (prisma as any).promoTemplate.findMany({
    where: { active: true },
    orderBy: { createdAt: 'desc' },
  });
  return success(templates);
});

export const POST = withAuth(async (req: NextRequest, user) => {
  const { name, headline, subline, body, tnc } = await req.json();
  if (!name || !headline || !body) return error('name, headline, body wajib');
  const template = await (prisma as any).promoTemplate.create({
    data: { name, headline, subline: subline || null, body, tnc: tnc || null, createdBy: user.userId },
  });
  return success(template, 201);
}, ADMIN_ROLES);

export const PATCH = withAuth(async (req: NextRequest) => {
  const { id, ...data } = await req.json();
  if (!id) return error('id wajib');
  const template = await (prisma as any).promoTemplate.update({ where: { id }, data });
  return success(template);
}, ADMIN_ROLES);

export const DELETE = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return error('id wajib');
  await (prisma as any).promoTemplate.update({ where: { id }, data: { active: false } });
  return success({ deleted: true });
}, ADMIN_ROLES);
