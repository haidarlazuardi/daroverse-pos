import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';

export const GET = withAuth(async (req, user) => {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const condition = searchParams.get('condition');
  const search = searchParams.get('search');

  const where: Record<string, unknown> = { active: true };
  if (category) where.category = category;
  if (condition) where.condition = condition;
  if (search) where.name = { contains: search, mode: 'insensitive' };

  const assets = await prisma.asset.findMany({
    where,
    orderBy: { name: 'asc' },
  });

  const totalValue = assets.reduce((s, a) => s + (a.currentValue || 0), 0);
  const byCategory: Record<string, { count: number; value: number }> = {};
  assets.forEach(a => {
    if (!byCategory[a.category]) byCategory[a.category] = { count: 0, value: 0 };
    byCategory[a.category].count++;
    byCategory[a.category].value += a.currentValue || 0;
  });

  return success({ assets, totalValue, byCategory });
}, ['SUPER_ADMIN']);

export const POST = withAuth(async (req, user) => {
  const body = await req.json();

  const asset = await prisma.asset.create({
    data: {
      name: body.name,
      code: body.code || null,
      category: body.category || 'Lainnya',
      condition: body.condition || 'GOOD',
      purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
      purchasePrice: body.purchasePrice ? parseFloat(body.purchasePrice) : null,
      currentValue: body.currentValue ? parseFloat(body.currentValue) : body.purchasePrice ? parseFloat(body.purchasePrice) : null,
      supplier: body.supplier || null,
      location: body.location || null,
      notes: body.notes || null,
    },
  });
  return success(asset, 201);
}, ['SUPER_ADMIN']);

export const PUT = withAuth(async (req) => {
  const { id, ...data } = await req.json();
  if (!id) return error('ID is required');

  const asset = await prisma.asset.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.condition !== undefined && { condition: data.condition }),
      ...(data.currentValue !== undefined && { currentValue: parseFloat(data.currentValue) }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.active !== undefined && { active: data.active }),
    },
  });
  return success(asset);
}, ['SUPER_ADMIN']);
