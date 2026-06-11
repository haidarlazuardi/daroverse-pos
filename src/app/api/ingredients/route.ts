import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';

export const GET = withAuth(async (req, user) => {
  const { searchParams } = new URL(req.url);
  const outletId = searchParams.get('outletId') || user.outletId;
  const type = searchParams.get('type'); // RAW | PREPPED
  const search = searchParams.get('search');

  const where: Record<string, unknown> = { active: true };
  if (type) where.type = type;
  if (search) where.name = { contains: search, mode: 'insensitive' };

  const ingredients = await prisma.ingredient.findMany({
    where,
    include: {
      stockLevels: outletId ? { where: { outletId } } : true,
      prepRecipe: { include: { items: { include: { ingredient: true } } } },
    },
    orderBy: { name: 'asc' },
  });

  return success(ingredients);
}, ['ADMIN']);

export const POST = withAuth(async (req) => {
  try {
    const body = await req.json();
    const { name, type, unit, purchaseUnit, conversionRate, minStock, latestPrice, prepRecipe } = body;

    if (!name || !unit) return error('Name and unit are required');

    const createData: Record<string, unknown> = {
      name,
      unit,
    };

    // Only set optional fields if they have values
    if (type && (type === 'RAW' || type === 'PREPPED')) createData.type = type;
    if (purchaseUnit && purchaseUnit.trim()) createData.purchaseUnit = purchaseUnit.trim();
    if (conversionRate && parseFloat(String(conversionRate)) > 0) createData.conversionRate = parseFloat(String(conversionRate));
    if (minStock !== undefined && minStock !== '') createData.minStock = parseFloat(String(minStock)) || 0;
    if (latestPrice !== undefined && latestPrice !== '') createData.latestPrice = parseFloat(String(latestPrice)) || 0;

    const ingredient = await prisma.ingredient.create({ data: createData as any });

    // If PREPPED, create sub-recipe
    if (type === 'PREPPED' && prepRecipe?.items?.length) {
      await prisma.recipe.create({
        data: {
          ingredientId: ingredient.id,
          yieldQty: prepRecipe.yieldQty ? parseFloat(prepRecipe.yieldQty) : null,
          yieldUnit: prepRecipe.yieldUnit || unit,
          items: {
            create: prepRecipe.items.map((item: any) => ({
              ingredientId: item.ingredientId,
              quantity: parseFloat(item.quantity),
            })),
          },
        },
      });

      // Auto-calculate cost from sub-recipe
      const rawIngredients = await prisma.ingredient.findMany({
        where: { id: { in: prepRecipe.items.map((i: any) => i.ingredientId) } },
      });
      let totalCost = 0;
      for (const ri of prepRecipe.items) {
        const raw = rawIngredients.find((i: any) => i.id === ri.ingredientId);
        if (raw) totalCost += parseFloat(ri.quantity) * raw.latestPrice;
      }
      const costPerUnit = prepRecipe.yieldQty ? totalCost / parseFloat(prepRecipe.yieldQty) : totalCost;
      await prisma.ingredient.update({ where: { id: ingredient.id }, data: { latestPrice: costPerUnit } });
    }

    // Create stock levels for all outlets
    const outlets = await prisma.outlet.findMany();
    if (outlets.length) {
      await prisma.stockLevel.createMany({
        data: outlets.map((o: any) => ({ outletId: o.id, ingredientId: ingredient.id, quantity: 0 })),
        skipDuplicates: true,
      });
    }

    return success(ingredient, 201);
  } catch (e: any) {
    console.error('Ingredient create error:', e);
    return error(e?.message || 'Failed to create ingredient', 500);
  }
}, ['ADMIN']);

export const PUT = withAuth(async (req) => {
  const { id, prepRecipe, ...data } = await req.json();
  if (!id) return error('ID is required');

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.unit !== undefined) updateData.unit = data.unit;
  if (data.purchaseUnit !== undefined) updateData.purchaseUnit = data.purchaseUnit || null;
  if (data.conversionRate !== undefined) updateData.conversionRate = data.conversionRate ? parseFloat(data.conversionRate) : null;
  if (data.minStock !== undefined) updateData.minStock = parseFloat(data.minStock);
  if (data.latestPrice !== undefined) updateData.latestPrice = parseFloat(data.latestPrice);

  const ingredient = await prisma.ingredient.update({
    where: { id },
    data: updateData,
  });

  return success(ingredient);
}, ['ADMIN']);

export const DELETE = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return error('ID is required');

  await prisma.ingredient.update({ where: { id }, data: { active: false } });
  return success({ deleted: true });
}, ['ADMIN']);
