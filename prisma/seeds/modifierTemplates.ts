import { PrismaClient } from '@prisma/client';

export async function seedModifierTemplates(prisma: PrismaClient) {
  // Sesuai schema.prisma, model ModifierGroup mewajibkan 'productId' (String).
  // Karena production seed tidak boleh membuat dummy product, 
  // modifier tidak bisa dibuat mandiri tanpa product. File ini sengaja kosong (no-op).
}