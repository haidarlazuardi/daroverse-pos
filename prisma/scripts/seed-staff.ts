import prisma from '../../src/lib/prisma';
import bcrypt from 'bcryptjs';

const staff = [
  {
    name: 'Ahmad Muhpid',
    email: 'Ahmadmuhpid1@gmail.com',
    password: 'soeka2024',
    bankName: 'Bank Mandiri',
    bankAccount: '1330034947655',
    bankAccountName: 'AHMAD MUHPID',
  },
  {
    name: 'Aknal Arsana',
    email: 'Aknalrsn60@gmail.com',
    password: 'soeka2024',
    bankName: 'BCA',
    bankAccount: '0954337495',
    bankAccountName: 'Aknal Arsana',
  },
  {
    name: 'Muhammad Juanda',
    email: 'juandamuhammad87@gmail.com',
    password: 'soeka2024',
    bankName: 'BCA',
    bankAccount: '8721552926',
    bankAccountName: 'Muhammad Juanda',
  },
];

async function main() {
  for (const s of staff) {
    const existing = await prisma.user.findUnique({ where: { email: s.email } });
    if (existing) { console.log(`⏭  ${s.name} sudah ada`); continue; }
    const hashed = await bcrypt.hash(s.password, 10);
    const user = await prisma.user.create({
      data: {
        name: s.name,
        email: s.email,
        password: hashed,
        role: 'STAFF',
        active: true,
        bankName: s.bankName,
        bankAccount: s.bankAccount,
        bankAccountName: s.bankAccountName,
        hasPosAccess: false,
      },
    });
    console.log(`✅ ${user.name} (${user.email}) — id: ${user.id}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
