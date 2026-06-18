import prisma from './prisma';
import { Prisma, StockLocation, IngredientType } from '@prisma/client';

type TxClient = Prisma.TransactionClient;

// ─────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────

export interface OrderModifierInput {
  effect: 'ADJUST' | 'ADD';
  targetIngredientId: string | null;
  multiplier?: number | null; // ADJUST: 1 = normal, 0.5 = less, 0 = none
  addQty?: number | null; // ADD: base-unit qty added
}

export interface OrderItemInput {
  productId: string;
  quantity: number;
  modifiers?: OrderModifierInput[];
}

export interface OrderRequirements {
  totalCost: number;
  lines: { productId: string; unitCost: number; quantity: number }[];
  // location → (ingredientId → qty to deduct), in base units
  deductions: Map<StockLocation, Map<string, number>>;
  costPerUnit: Map<string, number>; // ingredientId → cost per base unit (for movement log)
  warnings: string[];
}

const MAX_RECIPE_DEPTH = 6;

// ─────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────

// A DRINK is made/stocked at the BAR; FOOD at the KITCHEN.
function locationForStation(station: 'FOOD' | 'DRINK'): StockLocation {
  return station === 'FOOD' ? StockLocation.KITCHEN : StockLocation.BAR;
}

// Build a recursive unit-cost resolver over the prepped sub-recipe tree.
// Depth is conditional: it stops at RAW ingredients, so a 1-level recipe
// resolves in 1 level and a nested batch keeps descending — guarded against
// cycles and runaway depth.
function makeUnitCostResolver(
  ingredientMap: Map<string, { type: IngredientType; latestPrice: number; name: string }>,
  prepRecipeMap: Map<string, { yieldQty: number | null; items: { ingredientId: string; quantity: number }[] }>,
  warnings: string[]
) {
  function resolve(id: string, stack: Set<string>, depth: number): number {
    const ing = ingredientMap.get(id);
    if (!ing) return 0;

    const prep = prepRecipeMap.get(id);
    const isExpandable = ing.type === IngredientType.PREPPED && !!prep;

    if (!isExpandable) return ing.latestPrice || 0;
    if (stack.has(id)) {
      warnings.push(`Resep melingkar terdeteksi pada "${ing.name}" — pakai harga terakhir.`);
      return ing.latestPrice || 0;
    }
    if (depth >= MAX_RECIPE_DEPTH) {
      warnings.push(`Resep terlalu dalam pada "${ing.name}" — dipotong di level ${MAX_RECIPE_DEPTH}.`);
      return ing.latestPrice || 0;
    }

    stack.add(id);
    let cost = 0;
    for (const it of prep!.items) {
      cost += it.quantity * resolve(it.ingredientId, stack, depth + 1);
    }
    stack.delete(id);

    return prep!.yieldQty && prep!.yieldQty > 0 ? cost / prep!.yieldQty : cost;
  }
  return (id: string) => resolve(id, new Set<string>(), 0);
}

function roundToStep(qty: number, step?: number | null): number {
  if (!step || step <= 0) return qty;
  return Math.ceil(qty / step) * step;
}

// ─────────────────────────────────────────────────────────
//  Order requirements — cost (recursive) + deduction (1-level,
//  modifier- and location-aware). Cost expands prepped → raw;
//  deduction hits the serving-level ingredient as its own stock.
// ─────────────────────────────────────────────────────────

export async function computeOrderRequirements(
  items: OrderItemInput[],
  orderType: 'DINE_IN' | 'TAKEAWAY' = 'DINE_IN'
): Promise<OrderRequirements> {
  const warnings: string[] = [];
  const productIds = items.map((i) => i.productId);

  const [products, prepRecipes, allIngredients] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { recipe: { include: { items: true } } },
    }),
    prisma.recipe.findMany({
      where: { ingredientId: { not: null } },
      include: { items: true },
    }),
    prisma.ingredient.findMany({ select: { id: true, type: true, latestPrice: true, name: true } }),
  ]);

  const productMap = new Map(products.map((p) => [p.id, p]));
  const ingredientMap = new Map(allIngredients.map((i) => [i.id, i]));
  const prepRecipeMap = new Map(
    prepRecipes
      .filter((r) => r.ingredientId)
      .map((r) => [r.ingredientId as string, { yieldQty: r.yieldQty, items: r.items.map((it) => ({ ingredientId: it.ingredientId, quantity: it.quantity })) }])
  );

  const unitCostOf = makeUnitCostResolver(ingredientMap, prepRecipeMap, warnings);

  const deductions = new Map<StockLocation, Map<string, number>>();
  const costPerUnit = new Map<string, number>();
  const lines: { productId: string; unitCost: number; quantity: number }[] = [];
  let totalCost = 0;

  const addDeduction = (loc: StockLocation, ingredientId: string, qty: number) => {
    if (qty <= 0) return;
    let m = deductions.get(loc);
    if (!m) { m = new Map(); deductions.set(loc, m); }
    m.set(ingredientId, (m.get(ingredientId) || 0) + qty);
  };

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product || !product.recipe) {
      lines.push({ productId: item.productId, unitCost: 0, quantity: item.quantity });
      continue;
    }

    const loc = locationForStation(product.station as 'FOOD' | 'DRINK');

    // Effective per-portion requirement (serving recipe + modifiers).
    const req = new Map<string, number>();
    for (const ri of product.recipe.items) req.set(ri.ingredientId, ri.quantity);

    for (const mod of item.modifiers || []) {
      if (!mod.targetIngredientId) continue;
      if (mod.effect === 'ADJUST' && mod.multiplier != null) {
        if (req.has(mod.targetIngredientId)) {
          req.set(mod.targetIngredientId, req.get(mod.targetIngredientId)! * mod.multiplier);
        }
      } else if (mod.effect === 'ADD' && mod.addQty != null) {
        req.set(mod.targetIngredientId, (req.get(mod.targetIngredientId) || 0) + mod.addQty);
      }
    }

    // Take-away packaging (food box). Drinks add their cup via an ADD modifier.
    if (orderType === 'TAKEAWAY' && product.packagingIngredientId) {
      req.set(product.packagingIngredientId, (req.get(product.packagingIngredientId) || 0) + 1);
    }

    // Cost per portion (expands prepped recursively) + aggregate deduction.
    let unitCost = 0;
    for (const [ingredientId, qtyPerPortion] of req) {
      if (qtyPerPortion <= 0) continue;
      const cpu = unitCostOf(ingredientId);
      costPerUnit.set(ingredientId, cpu);
      unitCost += qtyPerPortion * cpu;
      addDeduction(loc, ingredientId, qtyPerPortion * item.quantity);
    }

    lines.push({ productId: item.productId, unitCost, quantity: item.quantity });
    totalCost += unitCost * item.quantity;
  }

  return { totalCost, lines, deductions, costPerUnit, warnings };
}

// ─────────────────────────────────────────────────────────
//  Apply deductions INSIDE a transaction.
//  Atomic + guarded: the `quantity >= qty` filter blocks overselling
//  AND the read-then-write race in one shot. count === 0 → insufficient.
// ─────────────────────────────────────────────────────────

export async function applyDeductionsInTx(
  tx: TxClient,
  deductions: Map<StockLocation, Map<string, number>>,
  costPerUnit: Map<string, number>,
  orderId: string,
  userId: string
) {
  const movementRows: Prisma.StockMovementCreateManyInput[] = [];

  for (const [location, ingredients] of deductions) {
    for (const [ingredientId, qty] of ingredients) {
      if (qty <= 0) continue;
      const res = await tx.stockLevel.updateMany({
        where: { ingredientId, location, quantity: { gte: qty } },
        data: { quantity: { decrement: qty }, lastUpdated: new Date() },
      });
      if (res.count === 0) {
        const ing = await tx.ingredient.findUnique({ where: { id: ingredientId }, select: { name: true } });
        throw new Error(`Stok tidak cukup: ${ing?.name || ingredientId} di ${location}`);
      }
      movementRows.push({
        ingredientId,
        location,
        type: 'SALE',
        quantity: -qty,
        reference: orderId,
        notes: 'Sale deduction',
        costPerUnit: costPerUnit.get(ingredientId) ?? null,
        createdBy: userId,
      });
    }
  }

  if (movementRows.length) await tx.stockMovement.createMany({ data: movementRows });
}

// ─────────────────────────────────────────────────────────
//  Reverse stock for a refunded order (re-credit each location).
// ─────────────────────────────────────────────────────────

export async function reverseStockForOrder(
  items: OrderItemInput[],
  orderType: 'DINE_IN' | 'TAKEAWAY',
  orderId: string,
  userId: string
) {
  const { deductions } = await computeOrderRequirements(items, orderType);

  await prisma.$transaction(async (tx) => {
    const rows: Prisma.StockMovementCreateManyInput[] = [];
    for (const [location, ingredients] of deductions) {
      for (const [ingredientId, qty] of ingredients) {
        if (qty <= 0) continue;
        await tx.stockLevel.upsert({
          where: { ingredientId_location: { ingredientId, location } },
          update: { quantity: { increment: qty }, lastUpdated: new Date() },
          create: { ingredientId, location, quantity: qty },
        });
        rows.push({
          ingredientId, location, type: 'REFUND', quantity: qty,
          reference: orderId, notes: 'Refund stock reversal', createdBy: userId,
        });
      }
    }
    if (rows.length) await tx.stockMovement.createMany({ data: rows });
  });
}

// ─────────────────────────────────────────────────────────
//  Production order — the raw→prepped link.
//  Consumes raw at `location` (guarded), produces PREPPED stock there.
//  actualYield lets staff record real output (variance/waste tracked).
// ─────────────────────────────────────────────────────────

export async function executeProductionOrder(productionOrderId: string, userId: string, actualYield?: number) {
  const po = await prisma.productionOrder.findUnique({
    where: { id: productionOrderId },
    include: { items: true, ingredient: true },
  });
  if (!po) throw new Error('Production order tidak ditemukan');
  if (po.status === 'COMPLETED') throw new Error('Production order sudah selesai');

  const yieldQty = actualYield != null && actualYield > 0 ? actualYield : po.plannedYield;

  await prisma.$transaction(async (tx) => {
    const rows: Prisma.StockMovementCreateManyInput[] = [];

    // 1) consume raw (guarded against overselling)
    for (const it of po.items) {
      if (it.quantity <= 0) continue;
      const res = await tx.stockLevel.updateMany({
        where: { ingredientId: it.ingredientId, location: po.location, quantity: { gte: it.quantity } },
        data: { quantity: { decrement: it.quantity }, lastUpdated: new Date() },
      });
      if (res.count === 0) {
        const ing = await tx.ingredient.findUnique({ where: { id: it.ingredientId }, select: { name: true } });
        throw new Error(`Bahan tidak cukup untuk produksi: ${ing?.name || it.ingredientId} di ${po.location}`);
      }
      rows.push({
        ingredientId: it.ingredientId, location: po.location, type: 'PRODUCTION',
        quantity: -it.quantity, reference: po.id, notes: `Produksi ${po.number} (bahan)`, createdBy: userId,
      });
    }

    // 2) produce the prepped ingredient
    await tx.stockLevel.upsert({
      where: { ingredientId_location: { ingredientId: po.ingredientId, location: po.location } },
      update: { quantity: { increment: yieldQty }, lastUpdated: new Date() },
      create: { ingredientId: po.ingredientId, location: po.location, quantity: yieldQty },
    });
    rows.push({
      ingredientId: po.ingredientId, location: po.location, type: 'PRODUCTION',
      quantity: yieldQty, reference: po.id, notes: `Produksi ${po.number} (hasil)`, createdBy: userId,
    });

    await tx.stockMovement.createMany({ data: rows });
    await tx.productionOrder.update({
      where: { id: po.id },
      data: { status: 'COMPLETED', actualYield: yieldQty, completedAt: new Date() },
    });
  });
}

// Build a production order draft from a prepped ingredient's batch recipe.
export async function buildProductionDraft(ingredientId: string, batchMultiplier: number, location: StockLocation) {
  const recipe = await prisma.recipe.findUnique({
    where: { ingredientId },
    include: { items: true, ingredient: true },
  });
  if (!recipe || !recipe.ingredient) throw new Error('Bahan prepped ini belum punya resep batch');

  const plannedYield = (recipe.yieldQty || 0) * batchMultiplier;
  const items = recipe.items.map((it) => ({ ingredientId: it.ingredientId, quantity: it.quantity * batchMultiplier }));

  return { ingredientId, location, batchMultiplier, plannedYield, items };
}

// ─────────────────────────────────────────────────────────
//  Transfer GUDANG → BAR/KITCHEN (rounded to pack step).
// ─────────────────────────────────────────────────────────

export async function transferStock(
  ingredientId: string,
  toLocation: StockLocation,
  requestedQty: number,
  userId: string,
  fromLocation: StockLocation = StockLocation.GUDANG
) {
  if (toLocation === fromLocation) throw new Error('Lokasi asal dan tujuan sama');

  const ing = await prisma.ingredient.findUnique({
    where: { id: ingredientId },
    select: { name: true, transferStep: true },
  });
  if (!ing) throw new Error('Bahan tidak ditemukan');

  const qty = roundToStep(requestedQty, ing.transferStep);

  await prisma.$transaction(async (tx) => {
    const res = await tx.stockLevel.updateMany({
      where: { ingredientId, location: fromLocation, quantity: { gte: qty } },
      data: { quantity: { decrement: qty }, lastUpdated: new Date() },
    });
    if (res.count === 0) throw new Error(`Stok tidak cukup di ${fromLocation}: ${ing.name}`);

    await tx.stockLevel.upsert({
      where: { ingredientId_location: { ingredientId, location: toLocation } },
      update: { quantity: { increment: qty }, lastUpdated: new Date() },
      create: { ingredientId, location: toLocation, quantity: qty },
    });

    await tx.stockMovement.createMany({
      data: [
        { ingredientId, location: fromLocation, toLocation, type: 'TRANSFER', quantity: -qty, notes: `Transfer ke ${toLocation}`, createdBy: userId },
        { ingredientId, location: toLocation, type: 'TRANSFER', quantity: qty, notes: `Transfer dari ${fromLocation}`, createdBy: userId },
      ],
    });
  });

  return { transferred: qty };
}

// ─────────────────────────────────────────────────────────
//  Receive a purchase order into GUDANG (carton → base conversion).
// ─────────────────────────────────────────────────────────

export async function receivePurchaseOrder(poId: string, userId: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { items: { include: { ingredient: true } } },
  });
  if (!po) throw new Error('PO tidak ditemukan');
  if (po.status === 'COMPLETED') throw new Error('PO sudah selesai');

  await prisma.$transaction(async (tx) => {
    const rows: Prisma.StockMovementCreateManyInput[] = [];
    for (const item of po.items) {
      const conv = item.ingredient.conversionRate && item.ingredient.purchaseUnit ? item.ingredient.conversionRate : 1;
      const baseQty = item.quantity * conv; // carton → base unit
      const pricePerBase = item.unitPrice / conv;

      await tx.stockLevel.upsert({
        where: { ingredientId_location: { ingredientId: item.ingredientId, location: StockLocation.GUDANG } },
        update: { quantity: { increment: baseQty }, lastUpdated: new Date() },
        create: { ingredientId: item.ingredientId, location: StockLocation.GUDANG, quantity: baseQty },
      });
      await tx.ingredient.update({ where: { id: item.ingredientId }, data: { latestPrice: pricePerBase } });
      await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { receivedQty: item.quantity } });

      rows.push({
        ingredientId: item.ingredientId, location: StockLocation.GUDANG, type: 'PURCHASE',
        quantity: baseQty, reference: po.id, notes: `PO ${po.poNumber}`, costPerUnit: pricePerBase, createdBy: userId,
      });
    }
    await tx.stockMovement.createMany({ data: rows });
    await tx.purchaseOrder.update({ where: { id: poId }, data: { status: 'COMPLETED', completedAt: new Date() } });
  });

  await recalculateProductCosts(po.items.map((i) => i.ingredientId));
}

// ─────────────────────────────────────────────────────────
//  Recalculate cached product costs — same recursive resolver as
//  checkout (no divergence between the two code paths).
// ─────────────────────────────────────────────────────────

export async function recalculateProductCosts(changedIngredientIds?: string[]) {
  const [productRecipes, prepRecipes, allIngredients] = await Promise.all([
    prisma.recipe.findMany({ where: { productId: { not: null } }, include: { items: true } }),
    prisma.recipe.findMany({ where: { ingredientId: { not: null } }, include: { items: true } }),
    prisma.ingredient.findMany({ select: { id: true, type: true, latestPrice: true, name: true } }),
  ]);

  const ingredientMap = new Map(allIngredients.map((i) => [i.id, i]));
  const prepRecipeMap = new Map(
    prepRecipes
      .filter((r) => r.ingredientId)
      .map((r) => [r.ingredientId as string, { yieldQty: r.yieldQty, items: r.items.map((it) => ({ ingredientId: it.ingredientId, quantity: it.quantity })) }])
  );
  const warnings: string[] = [];
  const unitCostOf = makeUnitCostResolver(ingredientMap, prepRecipeMap, warnings);

  const updates: Promise<unknown>[] = [];
  for (const recipe of productRecipes) {
    if (changedIngredientIds && changedIngredientIds.length) {
      const touched = recipe.items.some((it) => changedIngredientIds.includes(it.ingredientId));
      const usesPrepped = recipe.items.some((it) => prepRecipeMap.has(it.ingredientId));
      if (!touched && !usesPrepped) continue;
    }
    let cost = 0;
    for (const it of recipe.items) cost += it.quantity * unitCostOf(it.ingredientId);
    if (recipe.productId) updates.push(prisma.product.update({ where: { id: recipe.productId }, data: { cost } }));
  }
  await Promise.all(updates);
  return { warnings };
}

// ─────────────────────────────────────────────────────────
//  Alerts (per location now)
// ─────────────────────────────────────────────────────────

export async function getLowStockAlerts(location?: StockLocation) {
  const stockLevels = await prisma.stockLevel.findMany({
    where: location ? { location } : {},
    include: { ingredient: true },
  });
  return stockLevels
    .filter((sl) => sl.ingredient.active && sl.quantity <= sl.ingredient.minStock)
    .map((sl) => ({
      ingredientId: sl.ingredientId,
      name: sl.ingredient.name,
      unit: sl.ingredient.unit,
      type: sl.ingredient.type,
      location: sl.location,
      currentStock: sl.quantity,
      minStock: sl.ingredient.minStock,
      deficit: sl.ingredient.minStock - sl.quantity,
      severity: sl.quantity <= 0 ? 'critical' : sl.quantity <= sl.ingredient.minStock * 0.5 ? 'high' : 'medium',
    }));
}

export async function getPredictedStockouts() {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const usage = await prisma.stockMovement.groupBy({
    by: ['ingredientId'],
    where: { type: 'SALE', createdAt: { gte: fourteenDaysAgo } },
    _sum: { quantity: true },
  });
  const usageMap = new Map(usage.map((u) => [u.ingredientId, Math.abs(u._sum.quantity || 0)]));

  const stock = await prisma.stockLevel.groupBy({
    by: ['ingredientId'],
    _sum: { quantity: true },
  });

  const ingredients = await prisma.ingredient.findMany({ where: { active: true }, select: { id: true, name: true, unit: true } });
  const ingMap = new Map(ingredients.map((i) => [i.id, i]));

  const predictions: Array<Record<string, unknown>> = [];
  for (const s of stock) {
    const ing = ingMap.get(s.ingredientId);
    if (!ing) continue;
    const avgDailyUsage = (usageMap.get(s.ingredientId) || 0) / 14;
    if (avgDailyUsage <= 0) continue;
    const current = s._sum.quantity || 0;
    const daysUntilOut = current / avgDailyUsage;
    if (daysUntilOut > 14) continue;
    predictions.push({
      ingredientId: s.ingredientId,
      name: ing.name,
      unit: ing.unit,
      currentStock: current,
      avgDailyUsage: Math.round(avgDailyUsage * 100) / 100,
      daysUntilOut: Math.round(daysUntilOut * 10) / 10,
      stockoutDate: new Date(Date.now() + daysUntilOut * 86400000).toISOString().slice(0, 10),
      severity: daysUntilOut <= 2 ? 'critical' : daysUntilOut <= 5 ? 'high' : 'medium',
    });
  }
  return predictions.sort((a, b) => (a.daysUntilOut as number) - (b.daysUntilOut as number));
}
