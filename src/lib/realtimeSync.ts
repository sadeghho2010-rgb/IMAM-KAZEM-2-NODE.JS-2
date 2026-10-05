/**
 * Independent Real-time Synchronization Engine (Server-Sent Events & Polling)
 * Replaces Supabase Realtime with a 100% database-agnostic, lightweight mechanism
 * that works seamlessly on MySQL, VPS, Docker, or Dedicated Hosting.
 */

export interface RealtimeChangeEvent {
  collection: string;
  id: string;
  action: 'upsert' | 'delete';
  timestamp: number;
}

type ChangeCallback = (event: RealtimeChangeEvent) => void;

class RealtimeSyncManager {
  private eventSource: EventSource | null = null;
  private listeners = new Set<ChangeCallback>();
  private lastTimestamp = Date.now();
  private isConnecting = false;
  private reconnectTimer: any = null;
  private pollingTimer: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public init() {
    if (typeof window === 'undefined') return;
    this.connectSSE();
    this.startFallbackPolling();
  }

  /**
   * Connect to Server-Sent Events stream
   */
  private connectSSE() {
    if (this.isConnecting || (this.eventSource && this.eventSource.readyState === EventSource.OPEN)) {
      return;
    }

    try {
      this.isConnecting = true;
      this.eventSource = new EventSource('/api/sync/events');

      this.eventSource.onopen = () => {
        this.isConnecting = false;
      };

      const handlePayload = (eventData: string) => {
        try {
          const payload: RealtimeChangeEvent = JSON.parse(eventData);
          if (payload && payload.collection) {
            this.lastTimestamp = Math.max(this.lastTimestamp, payload.timestamp || Date.now());
            this.dispatchChange(payload);
          }
        } catch (e) {
          console.warn('[RealtimeSync] Error parsing change event:', e);
        }
      };

      this.eventSource.onmessage = (event: MessageEvent) => {
        handlePayload(event.data);
      };

      this.eventSource.addEventListener('data_change', (event: MessageEvent) => {
        handlePayload(event.data);
      });

      this.eventSource.onerror = () => {
        this.isConnecting = false;
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        // Reconnect after 4 seconds
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connectSSE();
          }, 4000);
        }
      };
    } catch (e) {
      this.isConnecting = false;
    }
  }

  /**
   * Low-frequency heartbeat polling fallback (every 10s) to catch up if SSE is interrupted by proxy
   */
  private startFallbackPolling() {
    if (this.pollingTimer) clearInterval(this.pollingTimer);

    this.pollingTimer = setInterval(async () => {
      // Only poll if SSE is not active or as safety catchup
      if (this.eventSource && this.eventSource.readyState === EventSource.OPEN) {
        return;
      }

      try {
        const res = await fetch(`/api/sync/changes?since=${this.lastTimestamp}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.changes)) {
            data.changes.forEach((change: RealtimeChangeEvent) => {
              this.lastTimestamp = Math.max(this.lastTimestamp, change.timestamp);
              this.dispatchChange(change);
            });
          }
        }
      } catch (e) {}
    }, 10000);
  }

  private dispatchChange(change: RealtimeChangeEvent) {
    // Notify all registered in-memory listeners
    this.listeners.forEach(cb => {
      try { cb(change); } catch (e) {}
    });

    // Dispatch global DOM event for components and localDb
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app_data_change', { detail: change }));
      window.dispatchEvent(new CustomEvent(`collection_change_${change.collection}`, { detail: change }));
    }
  }

  /**
   * Subscribe to changes for a specific collection or all collections
   */
  public subscribe(callback: ChangeCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public destroy() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    this.listeners.clear();
  }
}

export const realtimeSync = new RealtimeSyncManager();
