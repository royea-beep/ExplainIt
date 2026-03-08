import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const newToken = await signToken({ userId: payload.userId, email: payload.email });

    return NextResponse.json({ user: { id: payload.userId, email: payload.email }, token: newToken });
  } catch (err) {
    console.error('Refresh token error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
