import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'daroverse-fallback-secret';

export type Role = 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'CASHIER' | 'KITCHEN';

export const ADMIN_ROLES: Role[]   = ['SUPER_ADMIN', 'OWNER', 'MANAGER'];
export const SENIOR_ROLES: Role[]  = ['SUPER_ADMIN', 'OWNER'];
export const ALL_ROLES: Role[]     = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER', 'KITCHEN'];
export const STOCK_ROLES: Role[]   = ['SUPER_ADMIN', 'OWNER', 'MANAGER'];
export const KITCHEN_ROLES: Role[] = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'KITCHEN'];
export const CASHIER_ALL: Role[]   = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER'];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  OWNER: 'Owner',
  MANAGER: 'Manager',
  CASHIER: 'Kasir',
  KITCHEN: 'Dapur',
};

export const ROLE_HOME: Record<Role, string> = {
  SUPER_ADMIN: '/dashboard',
  OWNER: '/dashboard',
  MANAGER: '/dashboard',
  CASHIER: '/pos',
  KITCHEN: '/production',
};

export interface TokenPayload {
  userId: string;
  email: string;
  role: Role;
  name: string;
}

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
  try { return jwt.verify(token, JWT_SECRET) as TokenPayload; }
  catch { return null; }
}
export function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return req.cookies.get('token')?.value || null;
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
  constructor(message: string, status: number) { super(message); this.status = status; }
}
