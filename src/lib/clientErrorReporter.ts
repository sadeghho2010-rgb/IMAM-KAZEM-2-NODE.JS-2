/**
 * Client Error Reporter
 * Non-blocking, privacy-preserving reporter that pushes client exceptions to /api/monitor/client-event
 * Rate-limited in memory, silent fallbacks, never crashes the app.
 */

interface ReportOptions {
  eventType?: 'client_error' | 'chunk_load_failed' | 'fetch_error';
  severity?: 'info' | 'warn' | 'error' | 'critical';
  sectionName?: string;
  routePath?: string;
  statusCode?: number;
  shortMessage: string;
  stack?: string;
  metadata?: any;
}

// Generate short user-friendly tracking code (e.g. ERR-7A9B)
export function generateTrackingCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = 'ERR-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Prevent spamming the same error repeatedly
const reportedSignatures = new Set<string>();

export function reportClientError(options: ReportOptions): string {
  const trackingCode = generateTrackingCode();

  try {
    const signature = `${options.sectionName || ''}_${options.shortMessage.substring(0, 50)}`;
    if (reportedSignatures.has(signature)) {
      return trackingCode;
    }
    reportedSignatures.add(signature);
    if (reportedSignatures.size > 50) {
      // Clear oldest to prevent memory growth
      reportedSignatures.clear();
    }

    // Try reading active user context from localStorage if available
    let userId: string | undefined;
    let userRole: string | undefined;
    let displayName: string | undefined;

    try {
      const stored = localStorage.getItem('system_auth_current_user_v2');
      if (stored) {
        const u = JSON.parse(stored);
        userId = u.id || u.username;
        userRole = u.roleTitle || u.role || `سطح ${u.level}`;
        displayName = u.name || u.username;
      }
    } catch {
      // Ignore
    }

    const payload = {
      eventType: options.eventType || 'client_error',
      severity: options.severity || 'error',
      sectionName: options.sectionName || window.location.pathname,
      routePath: options.routePath || window.location.pathname,
      statusCode: options.statusCode,
      shortMessage: options.shortMessage,
      stack: options.stack ? options.stack.substring(0, 1000) : undefined,
      appVersion: '1.0.1',
      userId,
      userRole,
      displayName,
      metadata: {
        ...(options.metadata || {}),
        trackingCode,
        clientTime: new Date().toISOString(),
        userAgent: navigator.userAgent?.substring(0, 120),
      }
    };

    // Use sendBeacon or non-blocking fetch
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/monitor/client-event', blob);
    } else {
      fetch('/api/monitor/client-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
    }
  } catch (e) {
    // Silent fail - monitoring must never throw
  }

  return trackingCode;
}

/**
 * Initializes global client listeners for uncaught errors and promise rejections
 */
export function initGlobalClientErrorMonitoring(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    try {
      const isChunkLoadFailed = event.message && (
        event.message.includes('Loading chunk') || 
        event.message.includes('dynamically imported module')
      );

      reportClientError({
        eventType: isChunkLoadFailed ? 'chunk_load_failed' : 'client_error',
        severity: 'error',
        sectionName: 'خطای کلی مرورگر',
        routePath: window.location.pathname,
        shortMessage: event.message || 'خطای ناشناخته در مرورگر',
        stack: event.error?.stack || event.filename ? `${event.filename}:${event.lineno}` : undefined
      });
    } catch {}
  });

  window.addEventListener('unhandledrejection', (event) => {
    try {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      
      reportClientError({
        eventType: 'client_error',
        severity: 'error',
        sectionName: 'پرامیس ناموفق در کلاینت',
        routePath: window.location.pathname,
        shortMessage: message || 'Unhandled Promise Rejection',
        stack: reason instanceof Error ? reason.stack : undefined
      });
    } catch {}
  });
}
