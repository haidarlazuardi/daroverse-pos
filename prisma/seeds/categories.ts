import { PrismaClient } from '@prisma/client';

export async function seedCategories(prisma: PrismaClient) {
  const categories = [
    { id: 'cat_coffee', name: 'Coffee', color: '#3B6D11', sortOrder: 1 },
    { id: 'cat_non_coffee', name: 'Non Coffee', color: '#22c55e', sortOrder: 2 },
    { id: 'cat_tea', name: 'Tea', color: '#10b981', sortOrder: 3 },
    { id: 'cat_food', name: 'Food', color: '#993C1D', sortOrder: 4 },
    { id: 'cat_dessert', name: 'Dessert', color: '#f43f5e', sortOrder: 5 },
    { id: 'cat_snack', name: 'Snack', color: '#f59e0b', sortOrder: 6 },
    { id: 'cat_merchandise', name: 'Merchandise', color: '#6366f1', sortOrder: 7 },
    { id: 'cat_other', name: 'Other', color: '#64748b', sortOrder: 8 },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {
        name: cat.name,
        color: cat.color,
        sortOrder: cat.sortOrder,
      },
      create: cat,
    });
  }
}