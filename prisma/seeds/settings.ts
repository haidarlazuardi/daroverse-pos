import { PrismaClient } from '@prisma/client';

export async function seedSettings(prisma: PrismaClient) {
  const settings = [
    { key: 'business_name', value: 'Daroverse POS', label: 'Nama Bisnis' },
    { key: 'tax_rate', value: '0.10', label: 'Pajak (PB1)' },
    { key: 'service_rate', value: '0.05', label: 'Service Charge' },
    { key: 'loyalty_earn_divisor', value: '1000', label: 'Rp per 1 Poin' },
    { key: 'loyalty_redeem_value', value: '100', label: 'Nilai Tukar 1 Poin (Rp)' },
    { key: 'currency', value: 'IDR', label: 'Mata Uang' },
    { key: 'timezone', value: 'Asia/Jakarta', label: 'Zona Waktu' },
  ];

  for (const setting of settings) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: {}, 
      create: setting,
    });
  }
}