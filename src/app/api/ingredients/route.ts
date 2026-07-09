export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { ADMIN_ROLES, STOCK_ROLES } from '@/lib/auth';

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const type   = searchParams.get('type');
  const search = searchParams.get('search');
  const low    = searchParams.get('low'); // low=1 → only below minStock

  const where: Record<string, unknown> = { active: true };
  if (type)   where.type = type;
  if (search) where.name = { contains: search, mode: 'insensitive' };

  const ingredients = await prisma.ingredient.findMany({
    where,
    include: {
      stockLevels: true,
      prepRecipe: { include: { items: { include: { ingredient: true } } } },
    },
    orderBy: { name: 'asc' },
  });

  if (low === '1') {
    return success(ingredients.filter(ing => {
      const total = ing.stockLevels.reduce((s, sl) => s + sl.quantity, 0);
      return total <= ing.minStock;
    }));
  }

  return success(ingredients);
});

export const POST = withAuth(async (req) => {
  try {
    const body = await req.json();
    const { name, type, unit, purchaseUnit, conversionRate, packUnit, packFactor,
            transferStep, defaultLocation, countTier, opnameTolerance, isPackaging,
            minStock, latestPrice, prepRecipe } = body;

    if (!name?.trim() || !unit) return error('Nama dan satuan wajib diisi');

    const exists = await prisma.ingredient.findFirst({ where: { name: { equals: name.trim(), mode: 'insensitive' }, active: true } });
    if (exists) return error('Nama bahan sudah ada');

    const createData: Record<string, unknown> = { name: name.trim(), unit };
    if (type && ['RAW','PREPPED'].includes(type)) createData.type = type;
    if (purchaseUnit?.trim())                     createData.purchaseUnit   = purchaseUnit.trim();
    if (conversionRate > 0)                       createData.conversionRate = parseFloat(String(conversionRate));
    if (packUnit?.trim())                         createData.packUnit       = packUnit.trim();
    if (packFactor > 0)                           createData.packFactor     = parseFloat(String(packFactor));
    if (transferStep > 0)                         createData.transferStep   = parseFloat(String(transferStep));
    if (defaultLocation && ['GUDANG','BAR','KITCHEN'].includes(defaultLocation)) createData.defaultLocation = defaultLocation;
    if (countTier && ['A','B','C'].includes(countTier)) createData.countTier = countTier;
    if (opnameTolerance !== undefined && opnameTolerance !== '') createData.opnameTolerance = parseFloat(String(opnameTolerance)) || 0;
    if (isPackaging !== undefined) createData.isPackaging = !!isPackaging;
    createData.minStock    = parseFloat(String(minStock))    || 0;
    createData.latestPrice = parseFloat(String(latestPrice)) || 0;

    const ingredient = await prisma.ingredient.create({ data: createData as any });

    if (type === 'PREPPED' && prepRecipe?.items?.length) {
      await prisma.recipe.create({
        data: {
          ingredientId: ingredient.id,
          yieldQty:  prepRecipe.yieldQty  ? parseFloat(prepRecipe.yieldQty)  : null,
          yieldUnit: prepRecipe.yieldUnit || unit,
          items: { create: prepRecipe.items.map((i: any) => ({ ingredientId: i.ingredientId, quantity: parseFloat(i.quantity) })) },
        },
      });
      const raws = await prisma.ingredient.findMany({ where: { id: { in: prepRecipe.items.map((i: any) => i.ingredientId) } } });
      let cost = 0;
      for (const ri of prepRecipe.items) {
        const r = raws.find((x: any) => x.id === ri.ingredientId);
        if (r) cost += parseFloat(ri.quantity) * r.latestPrice;
      }
      const costPerUnit = prepRecipe.yieldQty ? cost / parseFloat(prepRecipe.yieldQty) : cost;
      await prisma.ingredient.update({ where: { id: ingredient.id }, data: { latestPrice: costPerUnit } });
    }

    await prisma.stockLevel.createMany({
      data: (['GUDANG','BAR','KITCHEN'] as const).map(location => ({ location, ingredientId: ingredient.id, quantity: 0 })),
      skipDuplicates: true,
    });

    return success(ingredient, 201);
  } catch (e: any) {
    return error(e?.message || 'Gagal membuat bahan', 500);
  }
}, ADMIN_ROLES);

export const PATCH = withAuth(async (req) => {
  const { id, prepRecipe, ...data } = await req.json();
  if (!id) return error('ID wajib diisi');

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined)            updateData.name           = data.name;
  if (data.unit !== undefined)            updateData.unit           = data.unit;
  if (data.purchaseUnit !== undefined)    updateData.purchaseUnit   = data.purchaseUnit || null;
  if (data.conversionRate !== undefined)  updateData.conversionRate = data.conversionRate ? parseFloat(data.conversionRate) : null;
  if (data.minStock !== undefined)        updateData.minStock       = parseFloat(data.minStock);
  if (data.latestPrice !== undefined)     updateData.latestPrice    = parseFloat(data.latestPrice);
  if (data.defaultLocation !== undefined) updateData.defaultLocation = data.defaultLocation || null;
  if (data.isPackaging !== undefined)     updateData.isPackaging    = !!data.isPackaging;

  const ingredient = await prisma.ingredient.update({ where: { id }, data: updateData, include: { stockLevels: true } });
  return success(ingredient);
}, ADMIN_ROLES);

export const DELETE = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return error('ID wajib diisi');
  await prisma.ingredient.update({ where: { id }, data: { active: false } });
  return success({ deleted: true });
}, ADMIN_ROLES);
