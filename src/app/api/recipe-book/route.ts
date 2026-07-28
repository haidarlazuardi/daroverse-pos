export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES } from '@/lib/auth';


export const GET = withAuth(async (req: NextRequest, _user: any) => {
  const products = await prisma.product.findMany({
    where: { active: true },
    include: {
      category: { select: { name: true } },
      recipe: {
        include: {
          items: {
            include: { ingredient: { select: { name: true, unit: true } } },
          },
        },
      },
    },
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
  });

  const grouped: Record<string, any[]> = {};
  for (const p of products) {
    const cat = p.category?.name || 'Lainnya';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({
      name: p.name,
      description: p.description || '',
      serving: '1 porsi',
      ingredients: (p.recipe?.items || []).map((ri: any) => ({
        name: ri.ingredient.name,
        qty: ri.quantity % 1 === 0 ? ri.quantity.toString() : ri.quantity.toFixed(1),
        unit: ri.ingredient.unit,
      })),
      steps: p.recipe?.instructions
        ? p.recipe.instructions.split('\n').filter((s: string) => s.trim())
        : [],
    });
  }

  const result = Object.entries(grouped).map(([category, items]) => ({
    category: category.toUpperCase(), items,
  }));

  const { NextResponse } = await import("next/server");
  return NextResponse.json({ data: result });
}, ADMIN_ROLES);
