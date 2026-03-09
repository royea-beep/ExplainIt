import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'node:fs';
import * as path from 'node:path';

type IncomingEvent = { type: string; payload?: object; timestamp?: number };

const ANALYTICS_FILE = path.join(process.cwd(), 'exports', 'analytics.jsonl');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const events = Array.isArray(body?.events) ? (body.events as IncomingEvent[]) : [];
    if (events.length === 0) return NextResponse.json({ ok: true, count: 0 });

    // Add timestamp if missing
    const enriched = events.map((e) => ({
      ...e,
      timestamp: e.timestamp || Date.now(),
    }));

    // Log to console in dev
    console.log('[api/events] received', enriched.length, 'events', enriched.map((e) => e.type));

    // Append to JSONL file
    try {
      const dir = path.dirname(ANALYTICS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const lines = enriched.map((e) => JSON.stringify(e)).join('\n') + '\n';
      fs.appendFileSync(ANALYTICS_FILE, lines, 'utf-8');
    } catch (fileErr) {
      console.error('[api/events] file write error:', fileErr);
      // Don't fail the request if file write fails
    }

    return NextResponse.json({ ok: true, count: enriched.length });
  } catch (err) {
    console.error('[api/events]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
