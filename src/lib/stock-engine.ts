import prisma from './prisma';
import { Prisma } from '@prisma/client';

interface OrderItemInput {
  productId: string;
  quantity: number;
}

type TxClient = Prisma.TransactionClient;

/**
 * BATCHED cost + deduction computation.
 * Fetches ALL recipes for the order in ONE query (including prepped sub-recipes),
 * computes costs and per-ingredient deduction totals in memory.
 * This replaces the old per-item-per-ingredient query loops (40+ queries → 2 queries).
 */
export async function computeOrderRequirements(items: OrderItemInput[]) {
  const productIds = items.map(i => i.productId);

  // ONE query: all recipes with items, ingredients, and prepped sub-recipes
  const recipes = await prisma.recipe.findMany({
    where: { productId: { in: productIds } },
    include: {
      items: {
        include: {
          ingredient: {
            include: {
              prepRecipe: { include: { items: { include: { ingredient: true } } } },
            },
          },
        },
      },
    },
  });

  const recipeByProduct = new Map(recipes.map(r => [r.productId as string, r]));
  const itemCosts = new Map<string, number>();          // productId → unit cost
  const deductions = new Map<string, number>();          // ingredientId → total qty to deduct
  const costPerUnit = new Map<string, number>();         // ingredientId → cost/unit (for movement log)
  let totalCost = 0;

  for (const item of items) {
    const recipe = recipeByProduct.get(item.productId);
    if (!recipe) { itemCosts.set(item.productId, 0); continue; }

    let unitCost = 0;
    for (const ri of recipe.items) {
      const ing: any = ri.ingredient;

      // Cost: prepped ingredients expand their sub-recipe
      let ingCostPerUnit = ing.latestPrice;
      if (ing.type === 'PREPPED' && ing.prepRecipe) {
        const prepCost = ing.prepRecipe.items.reduce(
          (s: number, pi: any) => s + pi.quantity * pi.ingredient.latestPrice, 0);
        ingCostPerUnit = ing.prepRecipe.yieldQty ? prepCost / ing.prepRecipe.yieldQty : prepCost;
      }
      unitCost += ri.quantity * ingCostPerUnit;
      costPerUnit.set(ing.id, ingCostPerUnit);

      // Deduction: aggregate per ingredient across the whole order
      const needed = ri.quantity * item.quantity;
      deductions.set(ing.id, (deductions.get(ing.id) || 0) + needed);
    }

    itemCosts.set(item.productId, unitCost);
    totalCost += unitCost * item.quantity;
  }

  return { totalCost, itemCosts, deductions, costPerUnit };
}

/**
 * Apply stock deductions INSIDE a transaction (pass the tx client).
 * Uses atomic decrements — safe against the read-then-write race condition.
 */
export async function applyDeductionsInTx(
  tx: TxClient,
  outletId: string,
  deductions: Map<string, number>,
  costPerUnit: Map<string, number>,
  orderId: string,
  userId: string
) {
  const ingredientIds = Array.from(deductions.keys());
  if (ingredientIds.length === 0) return;

  // Atomic decrements (no read-then-write race)
  for (const [ingredientId, qty] of deductions) {
    await tx.stockLevel.updateMany({
      where: { outletId, ingredientId },
      data: { quantity: { decrement: qty }, lastUpdated: new Date() },
    });
  }

  // ONE batched insert for all movement logs
  await tx.stockMovement.createMany({
    data: ingredientIds.map(ingredientId => ({
      outletId,
      ingredientId,
      type: 'SALE' as const,
      quantity: -(deductions.get(ingredientId) || 0),
      reference: orderId,
      notes: 'Sale deduction',
      costPerUnit: costPerUnit.get(ingredientId) ?? null,
      createdBy: userId,
    })),
  });
}

/**
 * Reverse stock for refunded order — batched, transactional.
 */
export async function reverseStockForOrder(
  outletId: string,
  items: OrderItemInput[],
  orderId: string,
  userId: string
) {
  const { deductions } = await computeOrderRequirements(items);

  await prisma.$transaction(async (tx) => {
    for (const [ingredientId, qty] of deductions) {
      await tx.stockLevel.upsert({
        where: { outletId_ingredientId: { outletId, ingredientId } },
        update: { quantity: { increment: qty }, lastUpdated: new Date() },
        create: { outletId, ingredientId, quantity: qty },
      });
    }
    await tx.stockMovement.createMany({
      data: Array.from(deductions.keys()).map(ingredientId => ({
        outletId, ingredientId,
        type: 'REFUND' as const,
        quantity: deductions.get(ingredientId) || 0,
        reference: orderId,
        notes: 'Refund stock reversal',
        createdBy: userId,
      })),
    });
  });
}

/**
 * Receive purchase order: increase stock + update ingredient prices.
 * NOTE: No longer creates an Expense record — ingredient purchases are
 * inventory, not opex. Their cost is recognized at sale time via COGS.
 */
export async function receivePurchaseOrder(poId: string, userId: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { items: { include: { ingredient: true } } },
  });
  if (!po) throw new Error('PO not found');
  if (po.status === 'COMPLETED') throw new Error('Already completed');

  await prisma.$transaction(async (tx) => {
    for (const item of po.items) {
      const conv = item.ingredient.conversionRate && item.ingredient.purchaseUnit
        ? item.ingredient.conversionRate : 1;
      const stockQty = item.quantity * conv;
      const pricePerUnit = item.unitPrice / conv;

      await tx.stockLevel.upsert({
        where: { outletId_ingredientId: { outletId: po.outletId, ingredientId: item.ingredientId } },
        update: { quantity: { increment: stockQty }, lastUpdated: new Date() },
        create: { outletId: po.outletId, ingredientId: item.ingredientId, quantity: stockQty },
      });
      await tx.ingredient.update({
        where: { id: item.ingredientId },
        data: { latestPrice: pricePerUnit },
      });
      await tx.purchaseOrderItem.update({
        where: { id: item.id },
        data: { receivedQty: item.quantity },
      });
    }

    await tx.stockMovement.createMany({
      data: po.items.map(item => {
        const conv = item.ingredient.conversionRate && item.ingredient.purchaseUnit
          ? item.ingredient.conversionRate : 1;
        return {
          outletId: po.outletId,
          ingredientId: item.ingredientId,
          type: 'PURCHASE' as const,
          quantity: item.quantity * conv,
          reference: po.id,
          notes: `PO ${po.poNumber}`,
          costPerUnit: item.unitPrice / conv,
          createdBy: userId,
        };
      }),
    });

    await tx.purchaseOrder.update({
      where: { id: poId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  });

  await recalculateProductCosts(po.items.map(i => i.ingredientId));
}

/**
 * Recalculate product costs — now uses the SAME prepped-aware logic
 * as checkout (fixes the COGS divergence bug).
 */
export async function recalculateProductCosts(ingredientIds: string[]) {
  const recipes = await prisma.recipe.findMany({
    where: {
      productId: { not: null },
      items: { some: { ingredientId: { in: ingredientIds } } },
    },
    include: {
      items: {
        include: {
          ingredient: {
            include: { prepRecipe: { include: { items: { include: { ingredient: true } } } } },
          },
        },
      },
    },
  });

  for (const recipe of recipes) {
    let cost = 0;
    for (const ri of recipe.items) {
      const ing: any = ri.ingredient;
      let unitPrice = ing.latestPrice;
      if (ing.type === 'PREPPED' && ing.prepRecipe) {
        const prepCost = ing.prepRecipe.items.reduce(
          (s: number, pi: any) => s + pi.quantity * pi.ingredient.latestPrice, 0);
        unitPrice = ing.prepRecipe.yieldQty ? prepCost / ing.prepRecipe.yieldQty : prepCost;
      }
      cost += ri.quantity * unitPrice;
    }
    if (recipe.productId) {
      await prisma.product.update({ where: { id: recipe.productId }, data: { cost } });
    }
  }
}

// ─── Alerts (unchanged logic, kept for compatibility) ─

export async function getLowStockAlerts(outletId: string) {
  const stockLevels = await prisma.stockLevel.findMany({
    where: { outletId },
    include: { ingredient: true },
  });
  return stockLevels
    .filter((sl: any) => sl.ingredient.active && sl.quantity <= sl.ingredient.minStock)
    .map((sl: any) => ({
      ingredientId: sl.ingredientId,
      name: sl.ingredient.name,
      unit: sl.ingredient.unit,
      type: sl.ingredient.type,
      currentStock: sl.quantity,
      minStock: sl.ingredient.minStock,
      deficit: sl.ingredient.minStock - sl.quantity,
      severity: sl.quantity <= 0 ? 'critical' : sl.quantity <= sl.ingredient.minStock * 0.5 ? 'high' : 'medium',
    }));
}

export async function getPredictedStockouts(outletId: string) {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Aggregate in the DATABASE instead of pulling all rows
  const usage = await prisma.stockMovement.groupBy({
    by: ['ingredientId'],
    where: { outletId, type: 'SALE', createdAt: { gte: fourteenDaysAgo } },
    _sum: { quantity: true },
  });
  const usageMap = new Map(usage.map(u => [u.ingredientId, Math.abs(u._sum.quantity || 0)]));

  const stockLevels = await prisma.stockLevel.findMany({
    where: { outletId },
    include: { ingredient: true },
  });

  const predictions: Array<{
    ingredientId: string; name: string; unit: string; currentStock: number;
    avgDailyUsage: number; daysUntilOut: number; stockoutDate: string; severity: string;
  }> = [];

  for (const sl of stockLevels) {
    if (!(sl as any).ingredient.active) continue;
    const avgDailyUsage = (usageMap.get(sl.ingredientId) || 0) / 14;
    if (avgDailyUsage <= 0) continue;
    const daysUntilOut = sl.quantity / avgDailyUsage;
    if (daysUntilOut > 14) continue;
    predictions.push({
      ingredientId: sl.ingredientId,
      name: (sl as any).ingredient.name,
      unit: (sl as any).ingredient.unit,
      currentStock: sl.quantity,
      avgDailyUsage: Math.round(avgDailyUsage * 100) / 100,
      daysUntilOut: Math.round(daysUntilOut * 10) / 10,
      stockoutDate: new Date(Date.now() + daysUntilOut * 86400000).toISOString().slice(0, 10),
      severity: daysUntilOut <= 2 ? 'critical' : daysUntilOut <= 5 ? 'high' : 'medium',
    });
  }
  return predictions.sort((a, b) => a.daysUntilOut - b.daysUntilOut);
}

// ─── Backward-compat wrappers (old function names) ────
// Kept so any file still importing the old names won't break.

export async function calculateOrderCost(items: OrderItemInput[]) {
  const { totalCost, itemCosts } = await computeOrderRequirements(items);
  return { totalCost, itemCosts };
}

export async function deductStockForOrder(
  outletId: string, items: OrderItemInput[], orderId: string, userId: string
) {
  const { deductions, costPerUnit } = await computeOrderRequirements(items);
  await prisma.$transaction(async (tx) => {
    await applyDeductionsInTx(tx, outletId, deductions, costPerUnit, orderId, userId);
  });
  return { success: true, errors: [] as string[] };
}
