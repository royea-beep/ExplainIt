// Simple in-memory rate limiter (no external dependencies)

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  store.forEach((entry, key) => {
    if (entry.resetAt <= now) store.delete(key);
  });
}, 60_000);

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export function checkRateLimit(key: string, config: RateLimitConfig): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

// Pre-configured limiters
export const PIPELINE_POST_LIMIT: RateLimitConfig = { maxRequests: 5, windowMs: 60 * 60 * 1000 }; // 5/hour
export const PIPELINE_GET_LIMIT: RateLimitConfig = { maxRequests: 60, windowMs: 60 * 1000 }; // 60/min
export const GENERATE_LIMIT: RateLimitConfig = { maxRequests: 10, windowMs: 60 * 60 * 1000 }; // 10/hour
