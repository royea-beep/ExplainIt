import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword, signToken, buildAuthCookie } from '@/lib/auth';
import { registerSchema } from '@/lib/validation';
import { checkRateLimit, getClientIp } from '@royea/shared-utils/rate-limit';

// Strict rate limit for registration: 5 per hour per IP
const REGISTER_LIMIT = { maxRequests: 5, windowMs: 60 * 60 * 1000 };

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = checkRateLimit(`auth:register:${ip}`, REGISTER_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  try {
    const body = await req.json();
    const data = registerSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const passwordHash = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name || null,
      },
    });

    const token = await signToken({ userId: user.id, email: user.email });

    const res = NextResponse.json(
      { user: { id: user.id, email: user.email }, token },
      { status: 201 },
    );
    res.headers.set('Set-Cookie', buildAuthCookie(token));
    return res;
  } catch (err) {
    if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    console.error('Register error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
