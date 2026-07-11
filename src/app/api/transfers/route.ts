export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error } from '@/lib/api-helpers';
import { authenticate } from '@/lib/auth';
import { transferStock } from '@/lib/stock-engine';
type StockLocation = Parameters<typeof transferStock>[1];
import { ensureCan } from '@/lib/permissions';


// GET — recent transfer movements (incoming side, per destination)
export async function GET(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return error('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const location = searchParams.get('location');

  const movements = await prisma.stockMovement.findMany({
    where: {
      type: 'TRANSFER',
      quantity: { gt: 0 }, // incoming rows only (one per transfer)
      ...(location ? { location: location as StockLocation } : {}),
    },
    include: { ingredient: { select: { name: true, unit: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return success({ transfers: movements });
}

// POST — "Ambil bahan": transfer from GUDANG to BAR/KITCHEN.
// Quantity is rounded up to the ingredient's pack step inside the engine.
export async function POST(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return error('Unauthorized', 401);
  { const d = await ensureCan(user, 'transfer'); if (d) return error(d, 403); }

  try {
    const { ingredientId, toLocation, quantity, fromLocation } = await req.json();
    if (!ingredientId || !toLocation || !quantity) {
      return error('ingredientId, toLocation, dan quantity wajib diisi');
    }
    if (quantity <= 0) return error('Jumlah harus lebih dari 0');

    const result = await transferStock(
      ingredientId,
      toLocation as StockLocation,
      quantity,
      user.userId,
      ((fromLocation as string) || 'GUDANG') as StockLocation
    );
    return success(result, 201);
  } catch (e: any) {
    console.error('Transfer error:', e);
    return error(e.message || 'Gagal transfer', 500);
  }
}
