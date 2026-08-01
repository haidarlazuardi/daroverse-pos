import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError, TokenPayload, Role } from './auth';

export function success(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function error(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

type HandlerFn = (req: NextRequest, user: TokenPayload, params?: Record<string, string>) => Promise<NextResponse>;

export function withAuth(handler: HandlerFn, allowedRoles?: Role[]) {
  return async (req: NextRequest, context?: { params: Record<string, string> }) => {
    try {
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
      const user = requireAuth(token);
      if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role as any)) {
        throw new AuthError('Forbidden', 403);
      }
      return await handler(req, user, context?.params);
    } catch (e: any) {
      if (e instanceof AuthError) {
        return error(e.message, e.status);
      }
      console.error('API Error:', e);
      const message = e?.message || 'Internal server error';
      // Show useful error in dev, generic in prod
      return error(
        process.env.NODE_ENV === 'development' ? message : 'Internal server error',
        500
      );
    }
  };
}

export function generateOrderNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${date}-${rand}`;
}

export function generatePONumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PO-${date}-${rand}`;
}
