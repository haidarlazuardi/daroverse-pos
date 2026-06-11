import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error } from '@/lib/api-helpers';
import { authenticate } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = authenticate(req);
  if (!user) return error('Unauthorized', 401);

  const categories = await prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { sortOrder: 'asc' },
  });

  return success(categories);
}

export async function POST(req: NextRequest) {
  const user = authenticate(req);
  if (!user || user.role !== 'ADMIN') return error('Forbidden', 403);

  const { name, color, icon, sortOrder } = await req.json();
  if (!name) return error('Name is required');

  const category = await prisma.category.create({
    data: { name, color, icon, sortOrder: sortOrder || 0 },
  });

  return success(category, 201);
}
