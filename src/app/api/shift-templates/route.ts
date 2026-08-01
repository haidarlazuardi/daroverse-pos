export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, withAuth } from '@/lib/api-helpers';
import { ALL_ROLES } from '@/lib/auth';

export const GET = withAuth(async (_req: NextRequest) => {
  const templates = await (prisma as any).shiftTemplate.findMany({
    where: { active: true },
    orderBy: { startTime: 'asc' },
  });
  return success({ templates });
}, ALL_ROLES);
