export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES, SENIOR_ROLES } from '@/lib/auth';

export const GET = withAuth(async () => {
  const templates = await (prisma as any).shiftTemplate.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  return success(templates);
});

export const POST = withAuth(async (req: NextRequest) => {
  const { name, startTime, endTime } = await req.json();
  if (!name || !startTime || !endTime) return error('name, startTime, endTime wajib');
  const t = await (prisma as any).shiftTemplate.create({ data: { name, startTime, endTime } });
  return success(t, 201);
}, SENIOR_ROLES);
