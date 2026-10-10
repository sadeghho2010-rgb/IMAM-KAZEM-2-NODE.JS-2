import { useState, useCallback, useEffect } from 'react';
import { localDb, PendingMutation } from '../lib/dexieDb';
import { useCsrfToken } from './useCsrfToken';
import axios from 'axios';

export interface ConflictState {
  isOpen: boolean;
  entity: string;
  entityId: string;
  myChanges: Record<string, any>;
  serverState: Record<string, any>;
  expectedVersion: number;
  idempotencyKey: string;
}

export function useOptimisticMutation(entityName: string) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const csrfToken = useCsrfToken();

  // Update pending queue count
  const updatePendingCount = useCallback(async () => {
    const count = await localDb.mutation_queue.count();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 3000);
    return () => clearInterval(interval);
  }, [updatePendingCount]);

  /**
   * Process Offline Mutation Queue sequentially with exponential backoff
   */
  const processMutationQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);

    try {
      const pendingMutations = await localDb.mutation_queue
        .where('status')
        .equals('PENDING')
        .sortBy('timestamp');

      for (const item of pendingMutations) {
        // Mark as SYNCING
        await localDb.mutation_queue.update(item.idempotencyKey, { status: 'SYNCING' });

        try {
          const res = await axios.post(`/api/v1/${item.entity}`, {
            id: item.entityId,
            op: item.op,
            version: item.expectedVersion,
            payload: item.payload
          }, {
            headers: {
              'Idempotency-Key': item.idempotencyKey,
              'X-CSRF-Token': csrfToken || (window as any).__CSRF_TOKEN__ || ''
            }
          });

          if (res.status === 200) {
            // Update local Dexie record with server's incremented version
            const table = (localDb as any)[item.entity];
            if (table) {
              if (item.op === 'DELETE') {
                await table.delete(item.entityId);
              } else {
                await table.update(item.entityId, {
                  version: res.data.newVersion,
                  isPendingLocal: false
                });
              }
            }

            // Remove from queue
            await localDb.mutation_queue.delete(item.idempotencyKey);
          }
        } catch (err: any) {
          if (err.response?.status === 409) {
            // Handle 409 Conflict
            await localDb.mutation_queue.update(item.idempotencyKey, { status: 'FAILED' });
            setConflict({
              isOpen: true,
              entity: item.entity,
              entityId: item.entityId,
              myChanges: item.payload,
              serverState: err.response.data.currentServerState || {},
              expectedVersion: item.expectedVersion,
              idempotencyKey: item.idempotencyKey
            });
            break; // Stop processing queue on conflict
          } else {
            // Transient error: Revert to PENDING with incremented retry count
            await localDb.mutation_queue.update(item.idempotencyKey, {
              status: 'PENDING',
              retryCount: item.retryCount + 1
            });
          }
        }
      }
    } finally {
      setIsSyncing(false);
      await updatePendingCount();
    }
  }, [updatePendingCount]);

  // Handle Online listener
  useEffect(() => {
    const handleOnline = () => {
      processMutationQueue();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [processMutationQueue]);

  /**
   * Execute Optimistic Mutation (<16ms perceived latency)
   */
  const executeMutation = useCallback(async (
    entityId: string,
    op: 'CREATE' | 'UPDATE' | 'DELETE',
    expectedVersion: number,
    payload: Record<string, any>
  ) => {
    const idempotencyKey = `${entityName}_${entityId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const table = (localDb as any)[entityName];

    // 1. Immediate <16ms Local Dexie Optimistic Mutation
    if (table) {
      if (op === 'DELETE') {
        await table.delete(entityId);
      } else {
        await table.put({
          id: entityId,
          version: expectedVersion,
          ...payload,
          updatedAt: new Date().toISOString(),
          isPendingLocal: true
        });
      }
    }

    // 2. Enqueue in mutation queue
    const mutationRecord: PendingMutation = {
      idempotencyKey,
      entity: entityName,
      entityId,
      op,
      expectedVersion,
      payload,
      timestamp: Date.now(),
      status: 'PENDING',
      retryCount: 0
    };

    await localDb.mutation_queue.add(mutationRecord);
    await updatePendingCount();

    // 3. Trigger immediate background flush if online
    if (navigator.onLine) {
      processMutationQueue();
    }

    return idempotencyKey;
  }, [entityName, processMutationQueue, updatePendingCount]);

  return {
    executeMutation,
    processMutationQueue,
    isSyncing,
    pendingCount,
    conflict,
    setConflict
  };
}
