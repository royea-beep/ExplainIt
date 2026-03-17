/**
 * @royea/flush-queue — client-side event buffer with batch POST, retry, and optional offline persist.
 */

export type QueueEvent = {
  id?: string;
  type: string;
  payload?: Record<string, unknown>;
  timestamp?: number;
};

export type StorageAdapter = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export type FlushQueueConfig = {
  endpoint: string;
  batchSize?: number;
  flushIntervalMs?: number;
  storageKey?: string;
  storage?: StorageAdapter;
};

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_FLUSH_INTERVAL_MS = 5000;
const DEFAULT_STORAGE_KEY = "flush_queue";
const RETRY_DELAY_MS = 2000;

type FlushQueueInstance = {
  push(event: QueueEvent): void;
  flush(): Promise<void>;
  start(): void;
  stop(): void;
};

function getDefaultStorage(): StorageAdapter | null {
  const g = globalThis as unknown as { window?: { localStorage?: { getItem(k: string): string | null; setItem(k: string, v: string): void } } };
  if (typeof g.window === "undefined" || !g.window?.localStorage) return null;
  const ls = g.window.localStorage;
  return {
    getItem: (key: string) => Promise.resolve(ls.getItem(key)),
    setItem: (key: string, value: string) => {
      ls.setItem(key, value);
      return Promise.resolve();
    },
  };
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function createFlushQueue(config: FlushQueueConfig): FlushQueueInstance {
  const {
    endpoint,
    batchSize = DEFAULT_BATCH_SIZE,
    flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS,
    storageKey = DEFAULT_STORAGE_KEY,
    storage: configStorage,
  } = config;

  const storage = configStorage ?? getDefaultStorage();
  let buffer: QueueEvent[] = [];
  let flushTimer: ReturnType<typeof setInterval> | null = null;

  async function persistBuffer(): Promise<void> {
    if (!storage) return;
    await storage.setItem(storageKey, JSON.stringify(buffer));
  }

  async function loadFromStorage(): Promise<void> {
    if (!storage) return;
    try {
      const raw = await storage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as QueueEvent[];
        if (Array.isArray(parsed)) buffer = parsed;
      }
    } catch {
      // ignore corrupt or missing storage
    }
  }

  async function doFlush(batch: QueueEvent[]): Promise<boolean> {
    const body = JSON.stringify({ events: batch });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) return true;
      // 5xx or other failure
      if (res.status >= 500) return false;
      // 4xx: treat as success (server rejected, don't retry same events)
      return true;
    } catch {
      clearTimeout(timeout);
      return false;
    }
  }

  async function flush(): Promise<void> {
    if (buffer.length === 0) return;
    const batch = buffer.slice(0, batchSize);
    const success = await doFlush(batch);
    if (success) {
      buffer = buffer.slice(batch.length);
      await persistBuffer();
      return;
    }
    // Retry once after 2s
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    const retrySuccess = await doFlush(batch);
    if (retrySuccess) {
      buffer = buffer.slice(batch.length);
      await persistBuffer();
    }
    // else: re-queue is implicit (batch stays in buffer)
  }

  function push(event: QueueEvent): void {
    const e: QueueEvent = {
      ...event,
      id: event.id ?? generateId(),
      timestamp: event.timestamp ?? Date.now(),
    };
    buffer.push(e);
    void persistBuffer();
  }

  function start(): void {
    stop();
    flushTimer = setInterval(() => void flush(), flushIntervalMs);
  }

  function stop(): void {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
  }

  // Init: load from storage and try to flush
  void loadFromStorage().then(() => void flush());

  return { push, flush, start, stop };
}
