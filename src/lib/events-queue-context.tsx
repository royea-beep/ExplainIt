'use client';

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { createFlushQueue, type QueueEvent } from '@royea/flush-queue';

type PushEvent = (event: Omit<QueueEvent, 'id' | 'timestamp'> & { type: string; payload?: object; timestamp?: number }) => void;

const EventsQueueContext = createContext<PushEvent | null>(null);

export function EventsQueueProvider({ children }: { children: ReactNode }) {
  const pushRef = useRef<PushEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const queue = createFlushQueue({
      endpoint: '/api/events',
      batchSize: 10,
      flushIntervalMs: 10000,
    });
    queue.start();
    pushRef.current = (event) => queue.push(event);

    queue.push({ type: 'app_load' });

    return () => {
      queue.stop();
      pushRef.current = null;
    };
  }, []);

  const push: PushEvent = (event) => {
    if (pushRef.current) pushRef.current(event);
  };

  return (
    <EventsQueueContext.Provider value={push}>
      {children}
    </EventsQueueContext.Provider>
  );
}

export function useEventsQueue(): PushEvent {
  const ctx = useContext(EventsQueueContext);
  if (!ctx) return () => {};
  return ctx;
}
