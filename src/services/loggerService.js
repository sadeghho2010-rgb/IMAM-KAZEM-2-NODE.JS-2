import { supabase } from '../lib/supabase';

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
      this.log({
        level: 'error',
        message: typeof message === 'string' ? message : (error?.message || 'Uncaught Error'),
        stackTrace: error?.stack || `at ${source}:${lineno}:${colno}`,
        context: { source, lineno, colno },
        path: window.location.pathname
      });
    };

    // 2. Capture unhandled Promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      this.log({
        level: 'error',
        message: reason?.message || String(reason) || 'Unhandled Promise Rejection',
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
    // Fallback UUID generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Directly sends log to Supabase app_logs table
   */
  async log({ level = 'error', message, stackTrace = null, context = null, traceId = null, userId = null, path = null }) {
    const activeTraceId = traceId || this.createTraceId();
    const activePath = path || (typeof window !== 'undefined' ? window.location.pathname : null);
    const sanitizedContext = context ? maskSensitiveData(context) : null;

    // Dev environment console output
    if (import.meta.env && import.meta.env.DEV) {
      const color = level === 'error' ? 'color: #ef4444; font-weight: bold;' : level === 'warn' ? 'color: #f59e0b; font-weight: bold;' : 'color: #3b82f6; font-weight: bold;';
      console.log(`%c[${level.toUpperCase()}] [${activeTraceId}] ${message}`, color, sanitizedContext || '');
    }

    try {
      const { error } = await supabase.from('app_logs').insert([
        {
          trace_id: activeTraceId,
          user_id: userId,
          level,
          message: String(message || 'Unknown log message'),
          stack_trace: stackTrace ? String(stackTrace) : null,
          context: sanitizedContext,
          path: activePath
        }
      ]);

      if (error) {
        if (import.meta.env && import.meta.env.DEV) {
          console.warn('[LoggerService] Notice writing to app_logs:', error.message);
        }
      }
    } catch (err) {
      // Fail silently to prevent logging recursion
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

// Singleton instance
export const logger = new LoggerService();
export default logger;
