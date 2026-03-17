/**
 * In-Memory Rate Limiter — zero dependencies.
 * Extracted from ExplainIt + KeyDrop.
 *
 * Works in Node.js (Express, Next.js, Fastify, etc.) and Electron.
 * For browser-side throttling, use the debounce/throttle utilities instead.
 *
 * Usage:
 *   import { checkRateLimit, getClientIp } from '@royea/shared-utils/rate-limit';
 *
 *   const ip = getClientIp(request);
 *   const result = checkRateLimit(`login:${ip}`, { maxRequests: 5, windowMs: 15 * 60 * 1000 });
 *   if (!result.allowed) return new Response('Too many requests', { status: 429 });
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 60s
let cleanupStarted = false;
function startCleanup() {
  if (cleanupStarted) return;
  cleanupStarted = true;
  setInterval(() => {
    const now = Date.now();
    store.forEach((entry, key) => {
      if (entry.resetAt <= now) store.delete(key);
    });
  }, 60_000).unref?.();
}

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Milliseconds until the window resets (0 if allowed) */
  retryAfterMs: number;
  /** Remaining requests in the current window */
  remaining: number;
}

export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  startCleanup();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, retryAfterMs: 0, remaining: config.maxRequests - 1 };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0, remaining: config.maxRequests - entry.count };
}

/** Reset a specific rate limit key (e.g., after successful auth) */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

/** Extract client IP from standard request headers */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

// --- Pre-configured profiles ---

/** Login: 5 attempts per 15 minutes */
export const LOGIN_LIMIT: RateLimitConfig = { maxRequests: 5, windowMs: 15 * 60 * 1000 };

/** Registration: 3 attempts per hour */
export const REGISTER_LIMIT: RateLimitConfig = { maxRequests: 3, windowMs: 60 * 60 * 1000 };

/** API reads: 60 per minute */
export const API_READ_LIMIT: RateLimitConfig = { maxRequests: 60, windowMs: 60 * 1000 };

/** API writes: 10 per hour */
export const API_WRITE_LIMIT: RateLimitConfig = { maxRequests: 10, windowMs: 60 * 60 * 1000 };

/** Heavy operations (generation, export): 5 per hour */
export const HEAVY_LIMIT: RateLimitConfig = { maxRequests: 5, windowMs: 60 * 60 * 1000 };
