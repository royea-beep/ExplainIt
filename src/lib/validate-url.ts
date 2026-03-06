// URL validation to prevent SSRF attacks

import dns from 'node:dns/promises';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
  '0.0.0.0',
  'metadata.google.internal',
]);

const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,    // link-local
  /^127\./,          // loopback
  /^0\./,            // "this" network
  /^fc00:/i,         // unique local (IPv6)
  /^fd/i,            // unique local (IPv6)
  /^fe80:/i,         // link-local (IPv6)
  /^::1$/,           // IPv6 loopback
  /^::ffff:10\./i,           // IPv6-mapped 10.x
  /^::ffff:172\.(1[6-9]|2\d|3[01])\./i,  // IPv6-mapped 172.16-31.x
  /^::ffff:192\.168\./i,     // IPv6-mapped 192.168.x
  /^::ffff:127\./i,          // IPv6-mapped 127.x
  /^::ffff:169\.254\./i,     // IPv6-mapped link-local
  /^::ffff:0\./i,            // IPv6-mapped 0.x
];

function isPrivateIp(ip: string): boolean {
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(ip)) return true;
  }
  return false;
}

export function validateUrl(input: string): { valid: true; url: string } | { valid: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { valid: false, error: 'Invalid URL format. Include protocol (e.g. https://example.com)' };
  }

  // Only allow http and https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: `Protocol "${parsed.protocol}" not allowed. Use http:// or https://` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block known dangerous hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { valid: false, error: 'Internal/localhost URLs are not allowed' };
  }

  // Block private IP ranges (catches direct IP input)
  if (isPrivateIp(hostname)) {
    return { valid: false, error: 'Private network IP addresses are not allowed' };
  }

  // Block cloud metadata endpoints
  if (hostname.endsWith('.internal') || hostname.endsWith('.local')) {
    return { valid: false, error: 'Internal network hostnames are not allowed' };
  }

  return { valid: true, url: parsed.href };
}

/**
 * Resolve hostname and verify the resolved IP is not private (DNS rebinding protection).
 * Call this AFTER validateUrl passes, before making the actual request.
 */
export async function validateResolvedIp(hostname: string): Promise<{ safe: true } | { safe: false; error: string }> {
  try {
    const addresses = await dns.resolve4(hostname);
    for (const addr of addresses) {
      if (isPrivateIp(addr)) {
        return { safe: false, error: `Hostname "${hostname}" resolves to private IP ${addr}` };
      }
    }
    return { safe: true };
  } catch {
    // DNS resolution failed — could be a valid but offline host
    return { safe: true };
  }
}

/**
 * Clamp maxScreens to a safe range
 */
export function clampMaxScreens(value: unknown, defaultVal = 5, max = 30): number {
  const n = typeof value === 'number' ? value : defaultVal;
  return Math.max(1, Math.min(n, max));
}
