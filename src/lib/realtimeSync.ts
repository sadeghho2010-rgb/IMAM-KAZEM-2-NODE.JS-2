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
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel('madrasah_realtime_broadcast_v1');
        this.broadcastChannel.onmessage = (event: MessageEvent) => {
          if (event.data && event.data.collection) {
            this.dispatchChange(event.data, true);
          }
        };
      } catch (e) {}

      window.addEventListener('storage', (e: StorageEvent) => {
        if (e.key === 'app_realtime_sync_event' && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            if (parsed && parsed.collection) {
              this.dispatchChange(parsed, true);
            }
          } catch (err) {}
        }
      });
    }
  }

  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') ||
           localStorage.getItem('auth_access_token') || sessionStorage.getItem('auth_access_token') ||
           localStorage.getItem('access_token') || sessionStorage.getItem('access_token') ||
           localStorage.getItem('token') || sessionStorage.getItem('token');
  }

  /**
   * Start SSE connection only after user is authenticated
   */
  public start() {
    if (typeof window === 'undefined') return;
    const token = this.getAuthToken();
    if (!token) return;

    this.connectSSE();
    this.startFallbackPolling();
    this.pollChangesNow();

    window.addEventListener('focus', this.handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', this.handleVisibilityOrFocus);
  }

  private handleVisibilityOrFocus = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      this.pollChangesNow();
      if (!this.eventSource || this.eventSource.readyState !== EventSource.OPEN) {
        this.connectSSE();
      }
    }
  };

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
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', this.handleVisibilityOrFocus);
    }
    this.isConnecting = false;
    this.backoffDelayMs = 2000;
  }

  /**
   * Connect to Server-Sent Events stream with token query parameter and credentials
   */
  private connectSSE() {
    const token = this.getAuthToken();
    if (!token || this.isConnecting || (this.eventSource && this.eventSource.readyState === EventSource.OPEN)) {
      return;
    }

    try {
      this.isConnecting = true;
      const sseUrl = `/api/sync/events?token=${encodeURIComponent(token)}`;
      this.eventSource = new EventSource(sseUrl, { withCredentials: true });

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
            const currentToken = this.getAuthToken();
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
   * Immediately poll server for delta changes with anti-cache headers
   */
  public async pollChangesNow(): Promise<void> {
    const token = this.getAuthToken();
    if (!token) return;

    try {
      const antiCacheTime = Date.now();
      const res = await fetch(`/api/sync/changes?since=${this.lastTimestamp}&_t=${antiCacheTime}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.changes) && data.changes.length > 0) {
          data.changes.forEach((change: RealtimeChangeEvent) => {
            this.lastTimestamp = Math.max(this.lastTimestamp, change.timestamp);
            this.dispatchChange(change);
          });
        }
      }
    } catch (e) {}
  }

  /**
   * Active polling fallback every 3 seconds (ensures guaranteed <= 3-5s latency on other devices)
   */
  private startFallbackPolling() {
    if (this.pollingTimer) clearInterval(this.pollingTimer);

    this.pollingTimer = setInterval(async () => {
      const token = this.getAuthToken();
      if (!token) {
        this.stop();
        return;
      }

      await this.pollChangesNow();
    }, 3000);
  }

  public dispatchChange(change: RealtimeChangeEvent, fromBroadcast = false) {
    // Notify all registered in-memory listeners
    this.listeners.forEach(cb => {
      try { cb(change); } catch (e) {}
    });

    // Propagate across tabs in the same browser session
    if (!fromBroadcast && typeof window !== 'undefined') {
      try {
        if (this.broadcastChannel) {
          this.broadcastChannel.postMessage(change);
        }
        localStorage.setItem('app_realtime_sync_event', JSON.stringify({ ...change, _broadcastTime: Date.now() }));
      } catch (e) {}
    }

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
