import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export type Role = 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'STAFF';

export const ADMIN_ROLES: Role[]   = ['SUPER_ADMIN', 'OWNER', 'MANAGER'];
export const SENIOR_ROLES: Role[]  = ['SUPER_ADMIN', 'OWNER'];
export const ALL_ROLES: Role[]     = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'STAFF'];
export const STOCK_ROLES: Role[]   = ['SUPER_ADMIN', 'OWNER', 'MANAGER'];
export const STAFF_ROLES: Role[]   = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'STAFF'];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  OWNER:       'Owner',
  MANAGER:     'Manager',
  STAFF:       'Staff',
};

export const ROLE_HOME: Record<Role, string> = {
  SUPER_ADMIN: '/dashboard',
  OWNER:       '/dashboard',
  MANAGER:     '/dashboard',
  STAFF:       '/staff-dashboard',
};

export type TokenPayload = {
  userId: string;
  name:   string;
  email:  string;
  role:   Role;
};

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
    this.name = 'AuthError';
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

const JWT_SECRET = process.env.JWT_SECRET || 'soeka-secret-key';

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function requireAuth(token: string | undefined): TokenPayload {
  if (!token) throw new AuthError('No token');
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    throw new AuthError('Invalid token');
  }
}

export function authenticate(req: { headers: { get: (k: string) => string | null } }): TokenPayload | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try { return requireAuth(auth.slice(7)); } catch { return null; }
}
