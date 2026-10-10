import { useEffect, useRef, useCallback, useState } from 'react';
import { localDb } from '../lib/dexieDb';

export interface SseEvent {
  seq: number;
  entity: string;
  entityId: string;
  op: 'CREATE' | 'UPDATE' | 'DELETE';
  payload_delta: Record<string, any>;
  createdAt: string;
}

export interface UseSseSyncOptions {
  onEvent?: (event: SseEvent) => void;
  onError?: (error: Error) => void;
}

export function useSseSync(options: UseSseSyncOptions = {}) {
  const [connected, setConnected] = useState(false);
  const [lastSeq, setLastSeq] = useState<number>(0);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const backoffTimerRef = useRef<NodeJS.Timeout | null>(null);
  const listenerRef = useRef<((event: SseEvent) => void) | null>(null);

  // Load last known sequence from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('lastEventSeq');
    if (stored) {
      setLastSeq(Number(stored));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (!navigator.onLine) {
      console.log('SSE: Not online, skipping connection');
      return;
    }

    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      console.log('SSE: Already connected');
      return;
    }

    disconnect(); // Clean up any existing connection

    try {
      const url = new URL('/api/v1/events', window.location.origin);
      url.searchParams.set('since', String(lastSeq));

      console.log(`SSE: Connecting with lastSeq=${lastSeq}`);

      const es = new EventSource(url.toString(), { withCredentials: true });

      es.addEventListener('open', () => {
        console.log('SSE: Connected');
        setConnected(true);
        setConnectionAttempts(0);
      });

      es.addEventListener('message', (event) => {
        try {
          const seq = Number(event.lastEventId || lastSeq);
          const payload: SseEvent = JSON.parse(event.data);

          console.log(`SSE: Received event seq=${seq} entity=${payload.entity} op=${payload.op}`);

          // STEP 1: Update local cache (Dexie)
          (async () => {
            try {
              const table = (localDb as any)[payload.entity];
              if (!table) return;

              if (payload.op === 'DELETE') {
                // Tombstone: remove from local cache
                await table.delete(payload.entityId);
              } else {
                // Create or update
                const existing = await table.get(payload.entityId);
                if (existing) {
                  // Only update if server version is newer (prevent stale overwrites)
                  if (payload.payload_delta && payload.payload_delta.version > existing.version) {
                    await table.update(payload.entityId, {
                      ...payload.payload_delta,
                      isPendingLocal: false,
                      updatedAt: payload.createdAt
                    });
                  }
                } else {
                  // New record
                  await table.put({
                    id: payload.entityId,
                    ...(payload.payload_delta || {}),
                    isPendingLocal: false,
                    updatedAt: payload.createdAt
                  });
                }
              }
            } catch (err) {
              console.error('SSE: Failed to update local cache:', err);
            }
          })();

          // STEP 2: Persist last sequence
          setLastSeq(seq);
          localStorage.setItem('lastEventSeq', String(seq));

          // STEP 3: Call user callback
          if (listenerRef.current) {
            listenerRef.current(payload);
          }
          if (options.onEvent) {
            options.onEvent(payload);
          }
        } catch (err) {
          console.error('SSE: Failed to parse event:', err);
        }
      });

      es.addEventListener('error', (event) => {
        console.error('SSE: Error', event);
        setConnected(false);

        // Exponential backoff on reconnection
        const backoff = Math.min(1000 * Math.pow(2, connectionAttempts), 30000);
        setConnectionAttempts((n) => n + 1);

        if (backoffTimerRef.current) clearTimeout(backoffTimerRef.current);
        backoffTimerRef.current = setTimeout(() => {
          console.log(`SSE: Attempting reconnect after ${backoff}ms`);
          connect();
        }, backoff);

        if (options.onError) {
          options.onError(new Error('SSE connection failed'));
        }
      });

      eventSourceRef.current = es;
    } catch (err) {
      console.error('SSE: Connection failed:', err);
      if (options.onError) {
        options.onError(err instanceof Error ? err : new Error('SSE connection failed'));
      }
    }
  }, [lastSeq, disconnect, options, connectionAttempts]);

  // Connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
      if (backoffTimerRef.current) clearTimeout(backoffTimerRef.current);
    };
  }, [connect, disconnect]);

  // Reconnect when coming online
  useEffect(() => {
    const handleOnline = () => {
      console.log('SSE: Network online, reconnecting...');
      connect();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [connect]);

  // Disconnect when going offline
  useEffect(() => {
    const handleOffline = () => {
      console.log('SSE: Network offline, disconnecting...');
      disconnect();
    };

    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, [disconnect]);

  const addListener = useCallback((listener: (event: SseEvent) => void) => {
    listenerRef.current = listener;
    return () => {
      listenerRef.current = null;
    };
  }, []);

  return {
    connected,
    lastSeq,
    connect,
    disconnect,
    addListener
  };
}
