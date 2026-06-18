import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, withAuth } from '@/lib/api-helpers';
import { hashPassword } from '@/lib/auth';

export const GET = withAuth(async () => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return success(users);
}, ['SUPER_ADMIN']);

export const POST = withAuth(async (req) => {
  const { name, email, password, role, pin } = await req.json();

  if (!name || !email || !password) return error('Name, email, and password are required');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return error('Email already exists');

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: await hashPassword(password),
      role: role || 'CASHIER',
      pin,
    },
    select: { id: true, name: true, email: true, role: true },
  });

  return success(user, 201);
}, ['SUPER_ADMIN']);
