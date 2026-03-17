/**
 * URL Validation with SSRF Protection.
 * Extracted from ExplainIt.
 *
 * Prevents Server-Side Request Forgery by blocking:
 * - Private/internal IP ranges (IPv4 + IPv6)
 * - Localhost and loopback
 * - Cloud metadata endpoints
 * - DNS rebinding attacks
 *
 * Usage:
 *   import { validateUrl, validateResolvedIp } from '@royea/shared-utils/validate-url';
 *
 *   const check = validateUrl(userInput);
 *   if (!check.valid) return res.status(400).json({ error: check.error });
 *
 *   // Optional: DNS rebinding protection
 *   const dns = await validateResolvedIp(new URL(check.url).hostname);
 *   if (!dns.safe) return res.status(400).json({ error: dns.error });
 */

import dns from 'node:dns/promises';

const BLOCKED_HOSTNAMES = new Set([
  'localhost', '127.0.0.1', '[::1]', '0.0.0.0',
  'metadata.google.internal',
]);

const PRIVATE_IP_PATTERNS = [
  /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^169\.254\./,
  /^127\./, /^0\./, /^fc00:/i, /^fd/i, /^fe80:/i, /^::1$/,
  /^::ffff:10\./i, /^::ffff:172\.(1[6-9]|2\d|3[01])\./i,
  /^::ffff:192\.168\./i, /^::ffff:127\./i, /^::ffff:169\.254\./i, /^::ffff:0\./i,
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_PATTERNS.some((p) => p.test(ip));
}

type ValidResult = { valid: true; url: string };
type InvalidResult = { valid: false; error: string };

/** Validate a URL string for safety (blocks SSRF vectors) */
export function validateUrl(input: string): ValidResult | InvalidResult {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { valid: false, error: 'Invalid URL format. Include protocol (e.g. https://example.com)' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: `Protocol "${parsed.protocol}" not allowed. Use http:// or https://` };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { valid: false, error: 'Internal/localhost URLs are not allowed' };
  }

  if (isPrivateIp(hostname)) {
    return { valid: false, error: 'Private network IP addresses are not allowed' };
  }

  if (hostname.endsWith('.internal') || hostname.endsWith('.local')) {
    return { valid: false, error: 'Internal network hostnames are not allowed' };
  }

  return { valid: true, url: parsed.href };
}

type SafeResult = { safe: true };
type UnsafeResult = { safe: false; error: string };

/** Resolve hostname and verify resolved IPs are not private (DNS rebinding protection) */
export async function validateResolvedIp(hostname: string): Promise<SafeResult | UnsafeResult> {
  try {
    const [ipv4, ipv6] = await Promise.allSettled([
      dns.resolve4(hostname),
      dns.resolve6(hostname),
    ]);

    const all: string[] = [];
    if (ipv4.status === 'fulfilled') all.push(...ipv4.value);
    if (ipv6.status === 'fulfilled') all.push(...ipv6.value);

    if (all.length === 0) return { safe: false, error: 'DNS resolution failed' };

    for (const addr of all) {
      if (isPrivateIp(addr)) {
        return { safe: false, error: `Hostname "${hostname}" resolves to private IP ${addr}` };
      }
    }
    return { safe: true };
  } catch {
    return { safe: false, error: 'DNS resolution failed' };
  }
}

export { isPrivateIp };

/** Clamp maxScreens (or similar) to a safe range — use after parsing query/body */
export function clampMaxScreens(value: unknown, defaultVal = 5, max = 30): number {
  const n = typeof value === 'number' ? value : defaultVal;
  return Math.max(1, Math.min(n, max));
}
