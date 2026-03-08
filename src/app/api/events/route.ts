import { NextRequest, NextResponse } from 'next/server';

type IncomingEvent = { type: string; payload?: object; timestamp?: number };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const events = Array.isArray(body?.events) ? (body.events as IncomingEvent[]) : [];
    if (events.length === 0) return NextResponse.json({ ok: true });

    if (process.env.NODE_ENV === 'development') {
      console.log('[api/events] received', events.length, 'events', events.map((e) => e.type));
    }
    // No persistence by default; add Prisma/DB or file store later if needed.

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/events]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
