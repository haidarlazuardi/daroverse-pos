import { PrismaClient } from '@prisma/client';

export async function seedUnits(prisma: PrismaClient) {
  // Units di schema bertipe 'String' (misal: 'pcs', 'gr') pada model Ingredient.
  // Tidak ada tabel master Units untuk di-seed. File sengaja kosong (no-op).
}