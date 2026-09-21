/**
 * Global Database Toast / Notification Bus
 * Dispatches instant real-time alerts when database write operations fail or timeout.
 */

export interface DatabaseToastState {
  id: string;
  type: 'error' | 'warning' | 'success' | 'info';
  message: string;
  duration?: number;
}

type ToastListener = (toast: DatabaseToastState | null) => void;

const listeners: Set<ToastListener> = new Set();
let currentToast: DatabaseToastState | null = null;
let toastTimeout: any = null;

export function subscribeDatabaseToast(listener: ToastListener): () => void {
  listeners.add(listener);
  listener(currentToast);
  return () => {
    listeners.delete(listener);
  };
}

export function dispatchDatabaseErrorToast(
  message = 'فعلا اتصال به پایگاه داده مقدور نیست، اطلاعات ثبت نشد. لطفاً مجدداً اقدام کنید.',
  duration = 6000
) {
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }

  const toast: DatabaseToastState = {
    id: `db_toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type: 'error',
    message,
    duration
  };

  currentToast = toast;
  listeners.forEach(l => l(currentToast));

  if (duration > 0) {
    toastTimeout = setTimeout(() => {
      dismissDatabaseToast();
    }, duration);
  }
}

export function dispatchDatabaseToast(
  message: string,
  type: 'error' | 'warning' | 'success' | 'info' = 'info',
  duration = 4000
) {
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }

  const toast: DatabaseToastState = {
    id: `db_toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type,
    message,
    duration
  };

  currentToast = toast;
  listeners.forEach(l => l(currentToast));

  if (duration > 0) {
    toastTimeout = setTimeout(() => {
      dismissDatabaseToast();
    }, duration);
  }
}

export function dismissDatabaseToast() {
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
  currentToast = null;
  listeners.forEach(l => l(null));
}
