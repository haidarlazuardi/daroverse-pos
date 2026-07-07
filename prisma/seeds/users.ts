import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export async function seedUsers(prisma: PrismaClient) {
  const password = await bcrypt.hash('Bogor123!!', 10);

  await prisma.user.upsert({
    where: { email: 'lazuardi723@gmail.com' },
    update: {
      name: 'Haidar Lazuardi',
      password,
      role: 'SUPER_ADMIN',
    },
    create: {
      email: 'lazuardi723@gmail.com',
      name: 'Haidar Lazuardi',
      password,
      role: 'SUPER_ADMIN',
    },
  });
}