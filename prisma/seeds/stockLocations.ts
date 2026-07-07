import { PrismaClient } from '@prisma/client';

export async function seedStockLocations(prisma: PrismaClient) {
  // StockLocation adalah Enum (GUDANG, BAR, KITCHEN).
  // Tidak ada tabel database independen untuk ini. File sengaja kosong (no-op).
}