import { useEffect, useRef, useState } from 'react';
import { localDb } from '../lib/dexieDb';

export function useSseClient() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastSeq, setLastSeq] = useState<number>(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<any>(null);

  useEffect(() => {
    let active = true;

    async function initSse() {
      // Get last applied sequence from metadata
      const meta = await localDb.sync_metadata.get('last_applied_seq');
      const startSeq = meta?.value || 0;
      setLastSeq(startSeq);

      function connect() {
        if (!active) return;

        // Build SSE URL with sequence query fallback if header not sent by EventSource
        const sseUrl = `/api/v1/events?since=${startSeq}`;
        const es = new EventSource(sseUrl, { withCredentials: true });
        eventSourceRef.current = es;

        es.onopen = () => {
          if (active) setIsConnected(true);
        };

        es.addEventListener('mutation', async (e: MessageEvent) => {
          try {
            const eventData = JSON.parse(e.data);
            const { seq, entity, entityId, op, payload } = eventData;

            // Idempotency check: ignore if seq <= lastSeq
            const currentMeta = await localDb.sync_metadata.get('last_applied_seq');
            const currentSeq = currentMeta?.value || 0;

            if (seq <= currentSeq) return;

            const table = (localDb as any)[entity];
            if (table) {
              if (op === 'DELETE') {
                await table.delete(entityId);
              } else {
                await table.put({
                  id: entityId,
                  ...payload,
                  isPendingLocal: false
                });
              }
            }

            // Save new sequence position
            await localDb.sync_metadata.put({ key: 'last_applied_seq', value: seq });
            setLastSeq(seq);

          } catch (err) {
            console.error('[SSE Event Processing Error]', err);
          }
        });

        es.onerror = () => {
          if (active) {
            setIsConnected(false);
            es.close();
            // Reconnect after 3 seconds backoff
            retryTimeoutRef.current = setTimeout(connect, 3000);
          }
        };
      }

      connect();
    }

    initSse();

    return () => {
      active = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return { isConnected, lastSeq };
}
