export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES } from '@/lib/auth';


export const GET = withAuth(async (req: NextRequest, _user: any) => {
  const [ingredients, products] = await Promise.all([
    prisma.ingredient.findMany({
      where: { active: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      include: {
        stockLevels: true,
        prepRecipe: {
          include: {
            items: { include: { ingredient: { select: { name: true, unit: true } } } },
          },
        },
      },
    }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
      include: {
        category: { select: { name: true, color: true } },
        recipe: {
          include: {
            items: {
              include: { ingredient: { select: { name: true, unit: true } } },
            },
          },
        },
      },
    }),
  ]);
  return success({ ingredients, products });
}, ADMIN_ROLES);
