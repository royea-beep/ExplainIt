/**
 * Global Error Handler — catches unhandled errors and sends them to a backend.
 * Extracted from ftable/Heroes-Hadera/VenueKit.
 *
 * Works with Supabase REST, any POST endpoint, or a custom callback.
 *
 * Usage (Supabase):
 *   createErrorHandler({ supabaseUrl: '...', supabaseKey: '...', tableName: 'js_errors' });
 *
 * Usage (custom endpoint):
 *   createErrorHandler({ endpoint: 'https://api.example.com/errors', headers: { 'x-api-key': '...' } });
 *
 * Usage (callback):
 *   createErrorHandler({ onError: (payload) => myLogger.log(payload) });
 */

export interface ErrorPayload {
  message: string;
  source: string;
  line: number | null;
  col: number | null;
  stack: string;
  page: string;
  user_agent: string;
  timestamp: string;
}

export interface ErrorHandlerConfig {
  /** Supabase project URL */
  supabaseUrl?: string;
  /** Supabase anon key */
  supabaseKey?: string;
  /** Table name for error logging (default: 'js_errors') */
  tableName?: string;
  /** Custom POST endpoint (alternative to Supabase) */
  endpoint?: string;
  /** Custom headers for the endpoint */
  headers?: Record<string, string>;
  /** Custom error callback (alternative to HTTP) */
  onError?: (payload: ErrorPayload) => void;
  /** Max errors per session (default: 5) */
  maxErrors?: number;
}

export function createErrorHandler(config: ErrorHandlerConfig = {}): void {
  if (typeof window === 'undefined') return;

  const { supabaseUrl, supabaseKey, tableName = 'js_errors', endpoint, headers, onError, maxErrors = 5 } = config;

  const resolvedEndpoint = endpoint || (supabaseUrl ? `${supabaseUrl}/rest/v1/${tableName}` : null);
  const resolvedHeaders: Record<string, string> = headers || {};

  if (supabaseKey && supabaseUrl) {
    resolvedHeaders['apikey'] = supabaseKey;
    resolvedHeaders['Authorization'] = `Bearer ${supabaseKey}`;
    resolvedHeaders['Prefer'] = 'return=minimal';
  }
  resolvedHeaders['Content-Type'] = resolvedHeaders['Content-Type'] || 'application/json';

  if (!resolvedEndpoint && !onError) {
    console.warn('[shared-utils/errors] No endpoint or onError callback — error logging disabled');
    return;
  }

  let errorCount = 0;

  function sendError(data: Partial<ErrorPayload>) {
    if (errorCount >= maxErrors) return;
    errorCount++;

    const payload: ErrorPayload = {
      message: String(data.message || '').slice(0, 500),
      source: String(data.source || '').slice(0, 300),
      line: data.line ?? null,
      col: data.col ?? null,
      stack: String(data.stack || '').slice(0, 2000),
      page: typeof location !== 'undefined' ? location.pathname : '',
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : '',
      timestamp: new Date().toISOString(),
    };

    if (onError) {
      try { onError(payload); } catch {}
      return;
    }

    if (resolvedEndpoint) {
      fetch(resolvedEndpoint, {
        method: 'POST',
        headers: resolvedHeaders,
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  }

  window.addEventListener('error', (e: ErrorEvent) => {
    if (!e.filename || e.filename === '') return;
    if (e.filename.includes('extension://')) return;

    sendError({
      message: e.message,
      source: e.filename,
      line: e.lineno,
      col: e.colno,
      stack: e.error?.stack || '',
    });
  });

  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    const reason = e.reason;
    sendError({
      message: reason?.message || String(reason).slice(0, 500),
      source: 'unhandledrejection',
      stack: reason?.stack || '',
    });
  });
}
