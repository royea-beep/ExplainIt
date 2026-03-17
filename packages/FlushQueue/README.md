# @royea/flush-queue

**FlushQueue** is a client-side event buffer: queue events in memory (or persist to storage when offline), batch POST them to a configurable URL on an interval or on demand, with a single retry on failure and optional offline support via a storage adapter. Use it in the browser (localStorage by default) or in React Native by supplying your own storage (e.g. MMKV).

**Install**

```bash
npm install @royea/flush-queue
```

**Usage**

```ts
import { createFlushQueue } from "@royea/flush-queue";

const queue = createFlushQueue({
  endpoint: "/api/events",
  batchSize: 10,
  flushIntervalMs: 5000,
});

queue.push({ type: "click", payload: { button: "submit" } });
queue.push({ type: "view", payload: { page: "/home" } });
queue.start(); // flush every 5s

// Later:
queue.stop();
await queue.flush(); // manual flush
```

For **React Native** (or any environment without `localStorage`), pass a `storage` adapter (e.g. MMKV) so events are persisted and flushed when back online:

```ts
createFlushQueue({
  endpoint: "https://api.example.com/events",
  storage: myStorageAdapter, // { getItem, setItem } returning Promises
  storageKey: "flush_queue",
});
```
