/**
 * API Key management for ExplainIt Pro users.
 *
 * GET  — list user's API keys (prefix + metadata, never the full key)
 * POST — generate a new API key (hash stored in DB, raw returned once)
 * DELETE — revoke a key by id
 *
 * Requires: PRO or TEAM plan.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getUserIdFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getUserPlan } from '@/lib/plan-guard';

const MAX_KEYS_PER_USER = 5;

/** Generate a prefixed API key, its SHA-256 hash, and display prefix. */
function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = `explainit_sk_${crypto.randomBytes(24).toString('base64url')}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const prefix = raw.slice(0, 16);
  return { raw, hash, prefix };
}

// ---------------------------------------------------------------------------
// GET — list keys
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const keys = await prisma.apiKey.findMany({
    where: { userId, revokedAt: null },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ keys });
}

// ---------------------------------------------------------------------------
// POST — create key
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only PRO / TEAM can create API keys
  const plan = await getUserPlan(userId);
  if (plan === 'FREE') {
    return NextResponse.json(
      { error: 'API keys require a Pro or Team plan' },
      { status: 403 },
    );
  }

  // Enforce max keys limit
  const existing = await prisma.apiKey.count({
    where: { userId, revokedAt: null },
  });
  if (existing >= MAX_KEYS_PER_USER) {
    return NextResponse.json(
      { error: `Maximum ${MAX_KEYS_PER_USER} active keys allowed` },
      { status: 400 },
    );
  }

  // Optional name from body
  let name = 'Default';
  try {
    const body = await req.json();
    if (typeof body?.name === 'string' && body.name.trim()) {
      name = body.name.trim().slice(0, 64);
    }
  } catch {
    // no body is fine
  }

  const { raw, hash, prefix } = generateApiKey();

  await prisma.apiKey.create({
    data: {
      userId,
      name,
      prefix,
      hash,
    },
  });

  // Return the raw key ONCE — it cannot be retrieved again.
  return NextResponse.json({ key: raw, prefix, name }, { status: 201 });
}

// ---------------------------------------------------------------------------
// DELETE — revoke key
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const keyId = searchParams.get('id');
  if (!keyId) {
    return NextResponse.json({ error: 'Missing key id' }, { status: 400 });
  }

  // Ensure the key belongs to this user
  const key = await prisma.apiKey.findFirst({
    where: { id: keyId, userId, revokedAt: null },
  });
  if (!key) {
    return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  }

  await prisma.apiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
