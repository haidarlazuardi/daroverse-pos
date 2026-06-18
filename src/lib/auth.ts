import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'daroverse-fallback-secret';

export type Role = 'SUPER_ADMIN' | 'CASHIER';

export interface TokenPayload {
  userId: string;
  email: string;
  role: Role;
  name: string;
}

// Cost 10: ~80ms vs ~300-500ms at cost 12. Plenty for an internal POS,
// and matters a lot on serverless cold starts (Vercel free tier).
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  const cookie = req.cookies.get('token');
  return cookie?.value || null;
}

export function authenticate(req: NextRequest): TokenPayload | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return verifyToken(token);
}

export function requireAuth(req: NextRequest, allowedRoles?: Role[]): TokenPayload {
  const user = authenticate(req);
  if (!user) throw new AuthError('Unauthorized', 401);
  if (allowedRoles && !allowedRoles.includes(user.role)) throw new AuthError('Forbidden', 403);
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
