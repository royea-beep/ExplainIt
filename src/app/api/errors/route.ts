import { NextRequest, NextResponse } from 'next/server';

/**
 * Client error logging endpoint.
 * Accepts error reports from the ErrorReporter component.
 * Logs to console (visible in server logs / hosting dashboard).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Log to server console for visibility in production logs
    console.error('[client-error]', JSON.stringify({
      type: body.type,
      message: body.message,
      source: body.source,
      line: body.line,
      url: body.url,
      timestamp: body.timestamp,
    }));

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // Always 200 — error reporter should never fail
  }
}
