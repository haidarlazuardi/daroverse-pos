export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, withAuth } from '@/lib/api-helpers';
import { SENIOR_ROLES } from '@/lib/auth';

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const entity = searchParams.get('entity');
  const userId = searchParams.get('userId');
  const from   = searchParams.get('from');
  const to     = searchParams.get('to');
  const limit  = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(entity ? { entity } : {}),
      ...(userId ? { userId } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to + 'T23:59:59Z') } : {}) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return success({ logs });
}, SENIOR_ROLES);
