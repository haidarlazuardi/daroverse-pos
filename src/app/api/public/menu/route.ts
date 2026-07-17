export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tableId = searchParams.get('table') || '1';

  const [products, categories, settings] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      include: { category: { select: { id: true, name: true, color: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.category.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    (prisma as any).qRMenuSettings.findFirst(),
  ]);

  return success({ products, categories, settings, tableId });
}
