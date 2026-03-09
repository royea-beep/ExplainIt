/**
 * Singleton Playwright browser pool with circuit breaker.
 *
 * Reuses a single Chromium instance across requests. Each caller gets an
 * isolated BrowserContext (separate cookies, storage, viewport).
 *
 * Auto-closes after IDLE_TIMEOUT_MS of no activity to free resources.
 * Circuit breaker prevents cascading failures when Chromium crashes.
 */

import { chromium, type Browser, type BrowserContext } from 'playwright';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Circuit breaker state
const FAILURE_THRESHOLD = 3;
const RESET_TIMEOUT_MS = 60_000; // 1 minute
let failures = 0;
let circuitOpenUntil = 0;

let browser: Browser | null = null;
let activeContexts = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function clearIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function scheduleIdleClose() {
  clearIdleTimer();
  idleTimer = setTimeout(async () => {
    if (activeContexts === 0 && browser) {
      const b = browser;
      browser = null;
      await b.close().catch(() => {});
    }
  }, IDLE_TIMEOUT_MS);
}

async function getBrowser(): Promise<Browser> {
  if (browser && browser.isConnected()) return browser;
  // Force cleanup of dead reference
  browser = null;
  browser = await chromium.launch({ headless: true });
  return browser;
}

export interface PoolContext {
  context: BrowserContext;
  /** Call when done. Closes the context and returns the browser to the pool. */
  release: () => Promise<void>;
}

/**
 * Acquire an isolated browser context from the pool.
 * Always call `release()` when done (use try/finally).
 *
 * Throws if the circuit breaker is open (too many recent failures).
 */
export async function acquireContext(viewport?: { width: number; height: number }): Promise<PoolContext> {
  // Circuit breaker check
  if (Date.now() < circuitOpenUntil) {
    const waitSec = Math.ceil((circuitOpenUntil - Date.now()) / 1000);
    throw new Error(`Browser temporarily unavailable (circuit breaker open). Retry in ${waitSec}s.`);
  }

  try {
    clearIdleTimer();
    const b = await getBrowser();
    const context = await b.newContext({ viewport: viewport ?? { width: 1080, height: 1920 } });
    activeContexts++;

    // Success — reset failure count
    failures = 0;

    const release = async () => {
      activeContexts = Math.max(0, activeContexts - 1);
      await context.close().catch(() => {});
      if (activeContexts === 0) scheduleIdleClose();
    };

    return { context, release };
  } catch (err) {
    failures++;
    if (failures >= FAILURE_THRESHOLD) {
      circuitOpenUntil = Date.now() + RESET_TIMEOUT_MS;
      console.error(`[browser-pool] Circuit breaker OPEN after ${failures} failures. Will retry in ${RESET_TIMEOUT_MS / 1000}s.`);
      // Force-kill potentially corrupted browser
      if (browser) {
        const b = browser;
        browser = null;
        await b.close().catch(() => {});
      }
    }
    throw err;
  }
}

/**
 * Force-close the browser. Use during graceful shutdown.
 */
export async function closeBrowserPool(): Promise<void> {
  clearIdleTimer();
  if (browser) {
    const b = browser;
    browser = null;
    await b.close().catch(() => {});
  }
}
