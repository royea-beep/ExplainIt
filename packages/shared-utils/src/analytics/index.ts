/**
 * Universal Analytics Tracker — drop-in event tracking for any web app.
 * Extracted from ftable's ftTracker.js.
 *
 * Auto-tracks: page views, clicks, scroll depth, visibility, session duration.
 * Sends events to any POST endpoint (Supabase, custom API, etc.).
 * Survives page navigation via keepalive + sendBeacon fallback.
 *
 * Usage:
 *   import { initTracker, track } from '@royea/shared-utils/analytics';
 *   initTracker({
 *     endpoint: 'https://your-supabase.co/rest/v1/analytics_events',
 *     headers: { apikey: '...', Authorization: 'Bearer ...' },
 *   });
 *
 *   // Custom event
 *   track('button_click', { button_id: 'signup' });
 */

export interface TrackerConfig {
  /** POST endpoint for events */
  endpoint: string;
  /** Headers for the POST request */
  headers?: Record<string, string>;
  /** Flush buffer every N events (default: 5) */
  bufferSize?: number;
  /** Flush interval in ms (default: 30000) */
  flushInterval?: number;
  /** Scroll depth thresholds to track (default: [25, 50, 75, 90, 100]) */
  scrollThresholds?: number[];
  /** Enable click tracking (default: true) */
  trackClicks?: boolean;
  /** Enable scroll tracking (default: true) */
  trackScroll?: boolean;
  /** Enable visibility/time-on-page tracking (default: true) */
  trackVisibility?: boolean;
  /** Enable debug logging (default: false) */
  debug?: boolean;
  /** Max flush retries before dropping (default: 3) */
  maxRetries?: number;
  /** Custom click selectors (default: 'a, button, [data-track]') */
  clickSelector?: string;
}

interface AnalyticsEvent {
  event_name: string;
  properties: Record<string, unknown>;
  session_id: string;
  user_id: string | null;
  page_path: string;
  created_at: string;
  _retries?: number;
}

interface TrackerState {
  sessionId: string;
  userId: string | null;
  pageLoadTime: number;
  buffer: AnalyticsEvent[];
  scrollMax: number;
  scrollTracked: Set<number>;
  pageVisible: boolean;
  timeOnPage: number;
  visibilityStart: number;
  flushTimer: ReturnType<typeof setInterval> | null;
}

let config: Required<TrackerConfig>;
let state: TrackerState;
let initialized = false;

function getOrCreateSession(): string {
  let sid = sessionStorage.getItem('_tracker_session_id');
  if (!sid) {
    sid = 'ses_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    sessionStorage.setItem('_tracker_session_id', sid);
    sessionStorage.setItem('_tracker_session_start', Date.now().toString());
    sessionStorage.setItem('_tracker_pages', '0');
  }
  const pv = parseInt(sessionStorage.getItem('_tracker_pages') || '0') + 1;
  sessionStorage.setItem('_tracker_pages', pv.toString());
  return sid;
}

function getDeviceInfo() {
  const ua = navigator.userAgent;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua);
  return {
    device_type: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop',
    screen_width: screen.width,
    screen_height: screen.height,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    language: navigator.language,
    is_touch: 'ontouchstart' in window,
  };
}

function getPageInfo() {
  const params = new URLSearchParams(location.search);
  const ref = document.referrer || '';
  let referrer_type = 'direct';
  if (/google\.|bing\.|yahoo\./.test(ref)) referrer_type = 'search';
  else if (/facebook\.|instagram\.|t\.co|twitter\.|tiktok\./.test(ref)) referrer_type = 'social';
  else if (/wa\.me|whatsapp\./.test(ref)) referrer_type = 'whatsapp';
  else if (/t\.me|telegram\./.test(ref)) referrer_type = 'telegram';
  else if (ref) referrer_type = 'referral';

  // First-touch attribution
  const utmSource = params.get('utm_source');
  if (utmSource && !localStorage.getItem('_tracker_first_utm')) {
    localStorage.setItem('_tracker_first_utm', utmSource);
    localStorage.setItem('_tracker_first_landing', location.pathname);
  }

  return {
    page_path: location.pathname,
    page_title: document.title,
    referrer: document.referrer || null,
    referrer_type,
    utm_source: utmSource,
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    first_utm: localStorage.getItem('_tracker_first_utm') || null,
  };
}

/** Track a custom event */
export function track(eventName: string, properties: Record<string, unknown> = {}): void {
  if (!initialized) return;

  const event: AnalyticsEvent = {
    event_name: eventName,
    properties,
    session_id: state.sessionId,
    user_id: state.userId,
    page_path: location.pathname,
    created_at: new Date().toISOString(),
  };

  state.buffer.push(event);
  if (config.debug) console.log('[Tracker]', eventName, properties);
  if (state.buffer.length >= config.bufferSize) flush();
}

/** Flush buffered events to the endpoint */
export async function flush(): Promise<void> {
  if (!initialized || state.buffer.length === 0) return;

  const events = [...state.buffer];
  const count = events.length;

  try {
    const resp = await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...config.headers },
      body: JSON.stringify(events.map(({ _retries, ...e }) => e)),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    state.buffer.splice(0, count);
  } catch {
    for (let i = events.length - 1; i >= 0; i--) {
      events[i]._retries = (events[i]._retries || 0) + 1;
      if (events[i]._retries! >= config.maxRetries) {
        const idx = state.buffer.indexOf(events[i]);
        if (idx !== -1) state.buffer.splice(idx, 1);
      }
    }
    if (config.debug) console.warn('[Tracker] Flush failed');
  }
}

/** Synchronous flush for page exit (survives navigation) */
function flushSync(): void {
  if (state.buffer.length === 0) return;

  const events = state.buffer.map(({ _retries, ...e }) => e);
  state.buffer = [];
  const body = JSON.stringify(events);

  try {
    fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...config.headers },
      body,
      keepalive: true,
    });
    return;
  } catch {}

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(config.endpoint, blob);
  }
}

/** Set the current user ID (call after authentication) */
export function setUserId(userId: string | null): void {
  if (state) state.userId = userId;
}

/** Initialize the tracker — call once on app load */
export function initTracker(userConfig: TrackerConfig): void {
  if (typeof window === 'undefined') return;
  if (initialized) return;

  config = {
    bufferSize: 5,
    flushInterval: 30000,
    scrollThresholds: [25, 50, 75, 90, 100],
    trackClicks: true,
    trackScroll: true,
    trackVisibility: true,
    debug: false,
    maxRetries: 3,
    clickSelector: 'a, button, [data-track]',
    headers: {},
    ...userConfig,
  };

  state = {
    sessionId: getOrCreateSession(),
    userId: null,
    pageLoadTime: Date.now(),
    buffer: [],
    scrollMax: 0,
    scrollTracked: new Set(),
    pageVisible: true,
    timeOnPage: 0,
    visibilityStart: Date.now(),
    flushTimer: null,
  };

  initialized = true;

  // Page view
  track('page_view', { ...getPageInfo(), ...getDeviceInfo() });

  // Click tracking
  if (config.trackClicks) {
    document.addEventListener('click', (e) => {
      const target = (e.target as Element)?.closest?.(config.clickSelector);
      if (!target) return;
      track(target.getAttribute('data-track') || 'click', {
        tag: target.tagName,
        text: (target.textContent || '').trim().substring(0, 50),
        id: (target as HTMLElement).id || null,
        href: (target as HTMLAnchorElement).href || null,
      });
    }, { passive: true });
  }

  // Scroll tracking
  if (config.trackScroll) {
    window.addEventListener('scroll', () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const pct = Math.round((window.scrollY / docHeight) * 100);
      state.scrollMax = Math.max(state.scrollMax, pct);
      for (const t of config.scrollThresholds) {
        if (pct >= t && !state.scrollTracked.has(t)) {
          state.scrollTracked.add(t);
          track('scroll_depth', { depth: t });
        }
      }
    }, { passive: true });
  }

  // Visibility tracking
  if (config.trackVisibility) {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        state.timeOnPage += Date.now() - state.visibilityStart;
        state.pageVisible = false;
      } else {
        state.visibilityStart = Date.now();
        state.pageVisible = true;
      }
    });
  }

  // Page exit
  let exitFired = false;
  const handleExit = () => {
    if (exitFired) return;
    exitFired = true;
    if (state.pageVisible) state.timeOnPage += Date.now() - state.visibilityStart;
    track('page_exit', { time_on_page_s: Math.round(state.timeOnPage / 1000), scroll_max: state.scrollMax });
    flushSync();
  };
  window.addEventListener('beforeunload', handleExit);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') handleExit();
  });

  // Periodic flush
  state.flushTimer = setInterval(flush, config.flushInterval);
}
