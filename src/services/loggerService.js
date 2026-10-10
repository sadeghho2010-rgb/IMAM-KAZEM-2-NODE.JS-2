// Logger Service for application monitoring

const SENSITIVE_KEYS = [
  'password',
  'pass',
  'token',
  'nationalid',
  'mellicode',
  'cardnumber',
  'cvv',
  'otp'
];

const VALID_LEVELS = ['error', 'warn', 'info'];

/**
 * Recursive sanitizer to mask sensitive fields in objects and arrays
 */
function maskSensitiveData(obj, seen = new WeakSet()) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Handle circular references
  if (seen.has(obj)) {
    return '[Circular Reference]';
  }
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map(item => maskSensitiveData(item, seen));
  }

  const masked = {};
  for (const [key, value] of Object.entries(obj)) {
    const normalizedKey = key.toLowerCase().replace(/[_-]/g, '');
    const isSensitive = SENSITIVE_KEYS.some(k => normalizedKey.includes(k));

    if (isSensitive) {
      masked[key] = '******';
    } else if (value !== null && typeof value === 'object') {
      masked[key] = maskSensitiveData(value, seen);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

class LoggerService {
  constructor() {
    this.setupGlobalHandlers();
  }

  setupGlobalHandlers() {
    if (typeof window === 'undefined') return;

    // 1. Capture uncaught JavaScript errors
    window.onerror = (message, source, lineno, colno, error) => {
      const traceId = this.createTraceId();
      this.log({
        traceId,
        level: 'error',
        message: (typeof message === 'string' && message.trim()) ? message : (error?.message || 'Uncaught Error'),
        stackTrace: error?.stack || `at ${source}:${lineno}:${colno}`,
        context: { source, lineno, colno },
        path: window.location.pathname
      });
    };

    // 2. Capture unhandled Promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const traceId = this.createTraceId();
      const reason = event.reason;
      this.log({
        traceId,
        level: 'error',
        message: reason?.message || (typeof reason === 'string' && reason.trim() ? reason : 'Unhandled Promise Rejection'),
        stackTrace: reason?.stack || null,
        context: { reason: typeof reason === 'object' ? reason : { value: reason } },
        path: window.location.pathname
      });
    });
  }

  createTraceId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Log entry (Console and Server API)
   */
  async log({ level = 'error', message, stackTrace = null, context = null, traceId = null, userId = null, path = null } = {}) {
    // 1. Level validation
    const normalizedLevel = typeof level === 'string' ? level.toLowerCase().trim() : '';
    const safeLevel = VALID_LEVELS.includes(normalizedLevel) ? normalizedLevel : 'error';

    // 2. Message validation
    let safeMessage = 'Unknown error';
    if (typeof message === 'string' && message.trim().length > 0) {
      safeMessage = message.trim();
    } else if (message !== null && message !== undefined) {
      safeMessage = String(message);
    }

    const activeTraceId = traceId || this.createTraceId();
    const activePath = path || (typeof window !== 'undefined' ? window.location.pathname : null);
    const sanitizedContext = context ? maskSensitiveData(context) : null;

    // Dev environment console output
    if (import.meta.env && import.meta.env.DEV) {
      const color = safeLevel === 'error' ? 'color: #ef4444; font-weight: bold;' : safeLevel === 'warn' ? 'color: #f59e0b; font-weight: bold;' : 'color: #3b82f6; font-weight: bold;';
      console.log(`%c[${safeLevel.toUpperCase()}] [${activeTraceId}] ${safeMessage}`, color, sanitizedContext || '');
    }

    // Server audit stream
    try {
      if (typeof window !== 'undefined' && safeLevel === 'error') {
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        fetch('/api/audit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            action: 'CLIENT_ERROR',
            description: safeMessage,
            details: { traceId: activeTraceId, path: activePath, stackTrace, context: sanitizedContext }
          })
        }).catch(() => {});
      }
    } catch (err) {
      // Golden Rule: Logging must never crash the main application
    }
  }

  error(message, context = null, stackTrace = null) {
    return this.log({ level: 'error', message, context, stackTrace });
  }

  warn(message, context = null) {
    return this.log({ level: 'warn', message, context });
  }

  info(message, context = null) {
    return this.log({ level: 'info', message, context });
  }
}

// Singleton Instance
export const logger = new LoggerService();
export default logger;
