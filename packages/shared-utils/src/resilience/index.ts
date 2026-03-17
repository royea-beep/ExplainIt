/**
 * Resilience utilities — CircuitBreaker + RetryWithBackoff.
 * Ported from cryptowhale's battle-tested Python CircuitBreaker.
 *
 * Usage:
 *   import { CircuitBreaker, retryWithBackoff } from '@royea/shared-utils/resilience';
 *
 *   const breaker = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 300_000 });
 *   if (!breaker.isAllowed()) throw new Error('Service unavailable');
 *   try {
 *     const result = await callExternalApi();
 *     breaker.recordSuccess();
 *   } catch (err) {
 *     breaker.recordFailure();
 *     throw err;
 *   }
 *
 *   // Or use the retry wrapper:
 *   const data = await retryWithBackoff(() => fetch(url), { maxRetries: 3 });
 */

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerConfig {
  /** Number of failures before circuit opens. Default: 5 */
  failureThreshold?: number;
  /** Milliseconds before an open circuit transitions to half-open. Default: 300000 (5 min) */
  resetTimeoutMs?: number;
  /** Optional callback when state changes */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private state: CircuitState = 'closed';
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly onStateChange?: (from: CircuitState, to: CircuitState) => void;

  constructor(config: CircuitBreakerConfig = {}) {
    this.failureThreshold = config.failureThreshold ?? 5;
    this.resetTimeoutMs = config.resetTimeoutMs ?? 300_000;
    this.onStateChange = config.onStateChange;
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold && this.state !== 'open') {
      this.transition('open');
    }
  }

  recordSuccess(): void {
    this.failureCount = 0;
    if (this.state !== 'closed') {
      this.transition('closed');
    }
  }

  isAllowed(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.transition('half_open');
        return true;
      }
      return false;
    }
    return true; // half_open: allow one test request
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = null;
    if (this.state !== 'closed') this.transition('closed');
  }

  private transition(to: CircuitState): void {
    const from = this.state;
    this.state = to;
    this.onStateChange?.(from, to);
  }
}

// --- Retry with exponential backoff ---

export interface RetryConfig {
  /** Max number of retries. Default: 3 */
  maxRetries?: number;
  /** Initial delay in ms. Default: 1000 */
  initialDelayMs?: number;
  /** Backoff multiplier. Default: 2 */
  backoffMultiplier?: number;
  /** Max delay cap in ms. Default: 30000 */
  maxDelayMs?: number;
  /** Add random jitter (0-50% of delay). Default: true */
  jitter?: boolean;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    backoffMultiplier = 2,
    maxDelayMs = 30_000,
    jitter = true,
  } = config;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries) break;
      let delay = Math.min(initialDelayMs * backoffMultiplier ** attempt, maxDelayMs);
      if (jitter) delay += Math.random() * delay * 0.5;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}
