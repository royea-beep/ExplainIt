/**
 * Public API endpoint: POST /api/v1/explain
 *
 * Authenticates via x-api-key header (hashed lookup against api_keys table).
 * Rate-limited to 100 requests/day per user.
 * Does NOT call the full pipeline yet — returns a "processing" stub.
 * Pipeline integration is a follow-up task.
 *
 * Request:
 *   Headers: x-api-key: explainit_sk_...
 *   Body:    { "url": "https://example.com" }
 *
 * Response (202):
 *   { "url": "...", "status": "processing", "message": "Pipeline started" }
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';

const DAILY_RATE_LIMIT = 100;

/** Hash an API key the same way we store it. */
function hashKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Look up the API key, return the userId if valid, otherwise null.
 * Also bumps lastUsedAt.
 */
async function authenticateApiKey(
  apiKey: string,
): Promise<{ userId: string } | null> {
  const hash = hashKey(apiKey);

  const record = await prisma.apiKey.findFirst({
    where: { hash, revokedAt: null },
    select: { id: true, userId: true },
  });

  if (!record) return null;

  // Fire-and-forget: update lastUsedAt (non-blocking)
  prisma.apiKey
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { userId: record.userId };
}

/**
 * Simple daily rate limit: count pipelines created today by this user
 * via the API (we count Pipeline records created in the last 24 h).
 */
async function checkDailyRateLimit(
  userId: string,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const used = await prisma.pipeline.count({
    where: {
      userId,
      createdAt: { gte: since },
    },
  });

  return { allowed: used < DAILY_RATE_LIMIT, used, limit: DAILY_RATE_LIMIT };
}

// ---------------------------------------------------------------------------
// POST /api/v1/explain
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  // --- Auth ---
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing API key. Pass it via the x-api-key header.' },
      { status: 401 },
    );
  }

  const auth = await authenticateApiKey(apiKey);
  if (!auth) {
    return NextResponse.json(
      { error: 'Invalid or revoked API key' },
      { status: 401 },
    );
  }

  // --- Rate limit ---
  const rateLimit = await checkDailyRateLimit(auth.userId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Daily rate limit exceeded',
        used: rateLimit.used,
        limit: rateLimit.limit,
      },
      { status: 429 },
    );
  }

  // --- Validate body ---
  let url: string;
  try {
    const body = await req.json();
    url = typeof body?.url === 'string' ? body.url.trim() : '';
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (!url) {
    return NextResponse.json(
      { error: 'URL is required in the request body' },
      { status: 400 },
    );
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return NextResponse.json(
      { error: 'Invalid URL format' },
      { status: 400 },
    );
  }

  // --- Stub response (pipeline integration is a follow-up) ---
  return NextResponse.json(
    {
      url,
      status: 'processing',
      message: 'Pipeline started',
    },
    { status: 202 },
  );
}
