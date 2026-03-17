/**
 * Next.js App Router auth guard — wrap a route handler to require Bearer JWT.
 * Use with @royea/shared-utils/auth.
 *
 * Usage: export const GET = withAuth(async (req, userId) => { ... });
 * Requires peer "next" (Next.js 13+).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAccessToken, extractBearerToken } from './auth/index';

export type AuthRouteHandler = (
  req: NextRequest,
  userId: string,
) => Promise<ReturnType<typeof NextResponse.json> | NextResponse>;

export function withAuth(handler: AuthRouteHandler) {
  return async (req: NextRequest, _context?: unknown) => {
    const token = extractBearerToken(req.headers.get('authorization'));
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      const payload = verifyAccessToken(token);
      return handler(req, payload.userId);
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
  };
}
