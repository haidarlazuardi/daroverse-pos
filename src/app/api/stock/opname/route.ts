export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ALL_ROLES, ADMIN_ROLES } from '@/lib/auth';

export const POST = withAuth(async (req: NextRequest, user) => {
  const { entries, apply = false } = await req.json();
  if (!entries?.length) return error('entries wajib');

  // Kalau apply=true, harus ADMIN
  if (apply && !ADMIN_ROLES.includes(user.role as any)) return error('Hanya admin yang bisa apply opname', 403);

  const results: any[] = [];

  for (const entry of entries) {
    const { ingredientId, location, actualQty } = entry;
    if (!ingredientId || !location || actualQty === undefined) continue;

    const current = await (prisma as any).stockLevel.findFirst({
      where: { ingredientId, location },
    });
    const currentQty = current?.quantity || 0;
    const diff = actualQty - currentQty;

    const result = { ingredientId, location, currentQty, actualQty, diff, applied: false };

    if (apply) {
      await prisma.$transaction(async (tx) => {
        await (tx as any).stockLevel.upsert({
          where: { ingredientId_location: { ingredientId, location } },
          create: { ingredientId, location, quantity: actualQty },
          update: { quantity: actualQty },
        });
        if (diff !== 0) {
          await (tx as any).stockMovement.create({
            data: {
              ingredientId, location,
              type: diff > 0 ? 'OPNAME_PLUS' : 'OPNAME_MINUS',
              quantity: diff,
              notes: `Opname adjustment by ${user.name}`,
              createdBy: user.userId,
            },
          });
        }
      });
      result.applied = true;
    }

    results.push(result);
  }

  return success({ results, applied: apply, message: apply ? 'Opname diterapkan' : 'Opname dicatat (pending approval)' });
}, ALL_ROLES);
