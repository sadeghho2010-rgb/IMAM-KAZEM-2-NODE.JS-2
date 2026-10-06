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
  private backoffDelayMs = 2000;

  constructor() {
    // Lazy initialization: Do NOT connect in constructor before authentication
  }

  /**
   * Start SSE connection only after user is authenticated
   */
  public start() {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') ||
                  localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
    if (!token) return;

    this.connectSSE();
    this.startFallbackPolling();
  }

  /**
   * Stop SSE connection on logout
   */
  public stop() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.isConnecting = false;
    this.backoffDelayMs = 2000;
  }

  /**
   * Connect to Server-Sent Events stream with exponential backoff
   */
  private connectSSE() {
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') ||
         localStorage.getItem('access_token') || sessionStorage.getItem('access_token'))
      : null;

    if (!token || this.isConnecting || (this.eventSource && this.eventSource.readyState === EventSource.OPEN)) {
      return;
    }

    try {
      this.isConnecting = true;
      this.eventSource = new EventSource('/api/sync/events');

      this.eventSource.onopen = () => {
        this.isConnecting = false;
        this.backoffDelayMs = 2000; // Reset backoff on successful open
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

        // Exponential backoff reconnect (2s -> 4s -> 8s -> 16s -> 30s max)
        if (!this.reconnectTimer) {
          const currentDelay = this.backoffDelayMs;
          this.backoffDelayMs = Math.min(30000, this.backoffDelayMs * 2);

          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            const currentToken = typeof window !== 'undefined'
              ? (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token'))
              : null;
            if (currentToken) {
              this.connectSSE();
            }
          }, currentDelay);
        }
      };
    } catch (e) {
      this.isConnecting = false;
    }
  }

  /**
   * Low-frequency heartbeat polling fallback (every 15s) when authenticated
   */
  private startFallbackPolling() {
    if (this.pollingTimer) clearInterval(this.pollingTimer);

    this.pollingTimer = setInterval(async () => {
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token'))
        : null;
      if (!token) {
        this.stop();
        return;
      }

      if (this.eventSource && this.eventSource.readyState === EventSource.OPEN) {
        return;
      }

      try {
        const res = await fetch(`/api/sync/changes?since=${this.lastTimestamp}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
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
    }, 15000);
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
