import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword, signToken, buildAuthCookie } from '@/lib/auth';
import { loginSchema } from '@/lib/validation';
import { checkRateLimit, getClientIp } from '@royea/shared-utils/rate-limit';

// Strict rate limit for login: 10 attempts per minute per IP
const LOGIN_LIMIT = { maxRequests: 10, windowMs: 60_000 };

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = checkRateLimit(`auth:login:${ip}`, LOGIN_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  try {
    const body = await req.json();
    const data = loginSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await verifyPassword(data.password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await signToken({ userId: user.id, email: user.email });

    const res = NextResponse.json({
      user: { id: user.id, email: user.email },
      token,
    });
    res.headers.set('Set-Cookie', buildAuthCookie(token));
    return res;
  } catch (err) {
    if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    console.error('Login failed');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
