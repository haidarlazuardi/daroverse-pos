export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ALL_ROLES, SENIOR_ROLES, ADMIN_ROLES } from '@/lib/auth';

// GET — list requests
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'PENDING';

  const requests = await (prisma as any).purchaseRequest.findMany({
    where: { status },
    include: {
      user: { select: { name: true } },
      items: {
        include: {
          ingredient: { select: { name: true, unit: true, purchaseUnit: true, conversionRate: true, latestPrice: true, defaultSupplierId: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
  });
  return success(requests);
}, ALL_ROLES);

// POST — create request (staff)
export const POST = withAuth(async (req: NextRequest, user) => {
  const { items, notes } = await req.json();
  if (!items?.length) return error('Minimal 1 item');

  const request = await (prisma as any).purchaseRequest.create({
    data: {
      requestedBy: user.userId,
      notes: notes || null,
      items: {
        create: items.map((i: any) => ({
          ingredientId: i.ingredientId,
          quantity: parseFloat(i.quantity),
          unit: i.unit,
        })),
      },
    },
    include: {
      items: { include: { ingredient: { select: { name: true, unit: true } } } }
    },
  });
  return success(request, 201);
}, ALL_ROLES);

// PATCH — update status (manager)
export const PATCH = withAuth(async (req: NextRequest) => {
  const { id, status } = await req.json();
  if (!id || !status) return error('id dan status wajib');

  const updated = await (prisma as any).purchaseRequest.update({
    where: { id },
    data: { status },
  });
  return success(updated);
}, ADMIN_ROLES);
