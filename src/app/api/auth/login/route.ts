import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPassword, signToken } from '@/lib/auth';
import { success, error } from '@/lib/api-helpers';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return error('Email and password are required', 400);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) {
      return error('Invalid credentials', 401);
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return error('Invalid credentials', 401);
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const token = signToken(payload);

    return success({
      token,
      user: payload,
      redirect: user.role === 'SUPER_ADMIN' ? '/dashboard' : '/pos',
    });
  } catch (e) {
    console.error('Login error:', e);
    return error('Login failed', 500);
  }
}
