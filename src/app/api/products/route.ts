import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { authenticate } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = authenticate(req);
    if (!user) return error('Unauthorized', 401);

    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('categoryId');
    const active = searchParams.get('active');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    if (categoryId) where.categoryId = categoryId;
    if (active !== null && active !== undefined) where.active = active !== 'false';
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        recipe: { include: { items: { include: { ingredient: true } } } },
        modifierGroups: { orderBy: { sortOrder: 'asc' }, include: { options: { orderBy: { sortOrder: 'asc' } } } },
      },
      orderBy: { name: 'asc' },
    });

    return success(user.role === 'CASHIER' ? products.map(({ cost, recipe, ...p }: any) => p) : products);
  } catch (e: any) {
    console.error('Products GET error:', e);
    return error(e.message || 'Failed', 500);
  }
}

export const POST = withAuth(async (req) => {
  try {
    const body = await req.json();
    const { name, sku, categoryId, price, image, recipe, station, takeawayCharge, packagingIngredientId, modifierGroups } = body;

    if (!name || (!categoryId && !body.recommendOnly)) return error('Name and category are required');

    // Calculate cost from recipe
    let calculatedCost = 0;
    if (recipe?.items?.length) {
      const ingredientIds = recipe.items.map((i: any) => i.ingredientId);
      const ingredients = await prisma.ingredient.findMany({
        where: { id: { in: ingredientIds } },
        include: { prepRecipe: { include: { items: { include: { ingredient: true } } } } },
      });

      for (const ri of recipe.items) {
        const ing = ingredients.find((i: any) => i.id === ri.ingredientId);
        if (!ing) continue;
        if ((ing as any).type === 'PREPPED' && (ing as any).prepRecipe) {
          const prepCost = (ing as any).prepRecipe.items.reduce((s: number, pi: any) => s + pi.quantity * pi.ingredient.latestPrice, 0);
          const costPerUnit = (ing as any).prepRecipe.yieldQty ? prepCost / (ing as any).prepRecipe.yieldQty : prepCost;
          calculatedCost += parseFloat(ri.quantity) * costPerUnit;
        } else {
          calculatedCost += parseFloat(ri.quantity) * ing.latestPrice;
        }
      }
    }

    // Recommendation only mode
    if (body.recommendOnly) {
      return success({
        cost: calculatedCost,
        recommendations: {
          margin30: Math.ceil((calculatedCost / 0.7) / 1000) * 1000,
          margin40: Math.ceil((calculatedCost / 0.6) / 1000) * 1000,
          margin50: Math.ceil((calculatedCost / 0.5) / 1000) * 1000,
          margin60: Math.ceil((calculatedCost / 0.4) / 1000) * 1000,
          margin70: Math.ceil((calculatedCost / 0.3) / 1000) * 1000,
        },
      });
    }

    const finalPrice = price ? parseFloat(price) : Math.ceil((calculatedCost / 0.6) / 1000) * 1000;

    const product = await prisma.product.create({
      data: {
        name, sku: sku || null, categoryId, price: finalPrice, cost: calculatedCost, image: image || null,
        station: station === 'FOOD' ? 'FOOD' : 'DRINK',
        takeawayCharge: takeawayCharge ? parseFloat(String(takeawayCharge)) : 0,
        packagingIngredientId: packagingIngredientId || null,
      },
    });

    if (recipe?.items?.length) {
      await prisma.recipe.create({
        data: {
          productId: product.id,
          items: { create: recipe.items.map((item: any) => ({ ingredientId: item.ingredientId, quantity: parseFloat(item.quantity) })) },
        },
      });
    }

    if (Array.isArray(modifierGroups) && modifierGroups.length) {
      await createModifierGroups(product.id, modifierGroups);
    }

    return success(product, 201);
  } catch (e: any) {
    console.error('Product create error:', e);
    return error(e.message || 'Failed to create product', 500);
  }
}, ['SUPER_ADMIN']);

export const PUT = withAuth(async (req) => {
  try {
    const { id, recipe: newRecipe, modifierGroups: newGroups, ...data } = await req.json();
    if (!id) return error('Product ID is required');

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.sku !== undefined) updateData.sku = data.sku || null;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.price !== undefined) updateData.price = parseFloat(data.price);
    if (data.image !== undefined) updateData.image = data.image;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.station !== undefined) updateData.station = data.station === 'FOOD' ? 'FOOD' : 'DRINK';
    if (data.takeawayCharge !== undefined) updateData.takeawayCharge = parseFloat(data.takeawayCharge) || 0;
    if (data.packagingIngredientId !== undefined) updateData.packagingIngredientId = data.packagingIngredientId || null;

    if (newRecipe) {
      await prisma.recipe.deleteMany({ where: { productId: id } });
      if (newRecipe.items?.length) {
        await prisma.recipe.create({
          data: {
            productId: id,
            items: { create: newRecipe.items.map((item: any) => ({ ingredientId: item.ingredientId, quantity: parseFloat(item.quantity) })) },
          },
        });
        const ingredients = await prisma.ingredient.findMany({
          where: { id: { in: newRecipe.items.map((i: any) => i.ingredientId) } },
        });
        let cost = 0;
        for (const ri of newRecipe.items) {
          const ing = ingredients.find((i: any) => i.id === ri.ingredientId);
          if (ing) cost += parseFloat(ri.quantity) * ing.latestPrice;
        }
        updateData.cost = cost;
      }
    }

    if (Array.isArray(newGroups)) {
      await prisma.modifierGroup.deleteMany({ where: { productId: id } });
      if (newGroups.length) await createModifierGroups(id, newGroups);
    }

    const product = await prisma.product.update({
      where: { id }, data: updateData,
      include: { category: true, recipe: { include: { items: { include: { ingredient: true } } } }, modifierGroups: { include: { options: true } } },
    });

    return success(product);
  } catch (e: any) {
    return error(e.message || 'Failed to update product', 500);
  }
}, ['SUPER_ADMIN']);

// DELETE: Soft delete - deactivate instead of hard delete
export async function DELETE(req: NextRequest) {
  try {
    const user = authenticate(req);
    if (!user || user.role !== 'SUPER_ADMIN') return error('Forbidden', 403);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return error('ID is required');

    await prisma.product.update({ where: { id }, data: { active: false } });
    return success({ deleted: true });
  } catch (e: any) {
    console.error('Product delete error:', e);
    return error(e.message || 'Failed to delete', 500);
  }
}


// Create per-product modifier groups + options from a payload array.
async function createModifierGroups(productId: string, groups: any[]) {
  for (const [gi, g] of groups.entries()) {
    await prisma.modifierGroup.create({
      data: {
        productId,
        name: g.name,
        selectionType: g.selectionType === 'MULTI' ? 'MULTI' : 'SINGLE',
        required: !!g.required,
        sortOrder: g.sortOrder ?? gi,
        options: {
          create: (g.options || []).map((o: any, oi: number) => ({
            name: o.name,
            effect: o.effect === 'ADD' ? 'ADD' : 'ADJUST',
            targetIngredientId: o.targetIngredientId || null,
            multiplier: o.multiplier !== undefined && o.multiplier !== '' && o.multiplier !== null ? parseFloat(String(o.multiplier)) : null,
            addQty: o.addQty !== undefined && o.addQty !== '' && o.addQty !== null ? parseFloat(String(o.addQty)) : null,
            priceDelta: o.priceDelta ? parseFloat(String(o.priceDelta)) : 0,
            isDefault: !!o.isDefault,
            sortOrder: o.sortOrder ?? oi,
          })),
        },
      },
    });
  }
}
