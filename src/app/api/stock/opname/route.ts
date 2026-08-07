export const dynamic = 'force-dynamic';
// Quick stock adjustment — untuk staff hub
// Full opname session ada di /api/stock-opname
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ALL_ROLES, ADMIN_ROLES } from '@/lib/auth';

export const POST = withAuth(async (req: NextRequest, user) => {
  const { entries, apply = true } = await req.json(); // default apply: true
  if (!entries?.length) return error('entries wajib');

  // Staff bisa apply opname mereka sendiri, ADMIN bisa apply untuk semua
  // Tidak perlu restrict apply — opname adalah koreksi stok yang sah

  const results: any[] = [];
  for (const entry of entries) {
    const { ingredientId, location, actualQty } = entry;
    if (!ingredientId || !location || actualQty === undefined) continue;

    const current = await (prisma as any).stockLevel.findFirst({
      where: { ingredientId, location },
    });
    const currentQty = current?.quantity ?? 0;
    const diff = actualQty - currentQty;
    const result: any = { ingredientId, location, currentQty, actualQty, diff, applied: false };

    if (apply) {
      await prisma.$transaction(async (tx) => {
        await (tx as any).stockLevel.upsert({
          where: { ingredientId_location: { ingredientId, location } },
          create: { ingredientId, location, quantity: actualQty },
          update: { quantity: actualQty },
        });
        if (diff !== 0) {
          await (tx as any).stockMovement.create({
            data: { ingredientId, location, type: 'OPNAME', quantity: diff,
              notes: `Quick opname by ${user.name || user.userId}`, createdBy: user.userId },
          });
        }
      });
      result.applied = true;
    }
    results.push(result);
  }

  return success({ results, applied: apply });
}, ALL_ROLES);
