import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';

// Test the webhook signature verification logic directly
// (extracting the logic to avoid needing a full Next.js request)

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!secret || !signature) return false;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const digest = hmac.digest('hex');
  try {
    const a = Buffer.from(digest, 'hex');
    const b = Buffer.from(signature.trim(), 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function createValidSignature(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('billing webhook signature verification', () => {
  const secret = 'test-webhook-secret';

  it('should accept valid signature', () => {
    const body = JSON.stringify({ meta: { event_name: 'subscription_created' } });
    const sig = createValidSignature(body, secret);
    expect(verifySignature(body, sig, secret)).toBe(true);
  });

  it('should reject wrong signature', () => {
    const body = JSON.stringify({ data: {} });
    expect(verifySignature(body, 'deadbeefdeadbeef', secret)).toBe(false);
  });

  it('should reject null signature', () => {
    const body = '{}';
    expect(verifySignature(body, null, secret)).toBe(false);
  });

  it('should reject empty secret', () => {
    const body = '{}';
    const sig = createValidSignature(body, secret);
    expect(verifySignature(body, sig, '')).toBe(false);
  });

  it('should reject tampered body', () => {
    const body = '{"original": true}';
    const sig = createValidSignature(body, secret);
    expect(verifySignature('{"original": false}', sig, secret)).toBe(false);
  });

  it('should handle non-hex signature gracefully', () => {
    expect(verifySignature('{}', 'not-hex-at-all', secret)).toBe(false);
  });
});

describe('billing webhook event classification', () => {
  // Test the plan determination logic
  function determinePlan(
    customPlan: string | undefined,
    variantId: number | undefined,
    teamVariantId: number,
  ): 'PRO' | 'TEAM' {
    const upper = customPlan?.toUpperCase();
    if (upper === 'TEAM' || upper === 'PRO') return upper as 'PRO' | 'TEAM';
    return variantId === teamVariantId ? 'TEAM' : 'PRO';
  }

  it('should use custom_data plan when provided', () => {
    expect(determinePlan('PRO', 999, 999)).toBe('PRO');
    expect(determinePlan('TEAM', 123, 999)).toBe('TEAM');
    expect(determinePlan('pro', 999, 999)).toBe('PRO');
    expect(determinePlan('team', 123, 999)).toBe('TEAM');
  });

  it('should fall back to variant ID when no custom plan', () => {
    expect(determinePlan(undefined, 100, 100)).toBe('TEAM');
    expect(determinePlan(undefined, 100, 200)).toBe('PRO');
  });

  it('should default to PRO when nothing matches', () => {
    expect(determinePlan(undefined, undefined, 100)).toBe('PRO');
  });
});
