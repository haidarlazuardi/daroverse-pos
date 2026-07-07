import { PrismaClient } from '@prisma/client';

export async function seedPaymentMethods(prisma: PrismaClient) {
  // PaymentMethod adalah Enum (CASH, QRIS, CARD, TRANSFER).
  // Tidak ada tabel database independen untuk ini. File sengaja kosong (no-op).
}