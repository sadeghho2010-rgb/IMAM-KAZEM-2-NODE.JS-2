export type SaveFeedbackVariant = 'success' | 'warning' | 'error';

export interface SaveFeedbackDetail {
  id?: string;
  title: string;
  message: string;
  subtitle?: string;
  variant?: SaveFeedbackVariant;
  durationMs?: number;
}

export interface ActiveWriteEntry {
  key: string;
  label: string;
  startedAt: number;
}

const activeWritesMap = new Map<string, ActiveWriteEntry>();
let beforeUnloadAttached = false;

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (activeWritesMap.size > 0) {
    e.preventDefault();
    e.returnValue = 'در حال ثبت نهایی اطلاعات در سرور هستیم. لطفاً تا پایان ثبت از صفحه خارج نشوید.';
    return e.returnValue;
  }
  return undefined;
}

function syncBeforeUnloadListener() {
  if (typeof window === 'undefined') return;
  if (activeWritesMap.size > 0 && !beforeUnloadAttached) {
    window.addEventListener('beforeunload', handleBeforeUnload);
    beforeUnloadAttached = true;
  } else if (activeWritesMap.size === 0 && beforeUnloadAttached) {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    beforeUnloadAttached = false;
  }
}

export function setWriteInProgress(
  key: string,
  active: boolean,
  label = 'در حال ثبت نهایی اطلاعات در سرور... لطفاً از نرم‌افزار خارج نشوید.'
) {
  if (active) {
    activeWritesMap.set(key, { key, label, startedAt: Date.now() });
  } else {
    activeWritesMap.delete(key);
  }
  syncBeforeUnloadListener();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('app_write_progress_change', {
        detail: {
          activeWrites: Array.from(activeWritesMap.values()),
        },
      })
    );
  }
}

export function getActiveWrites(): ActiveWriteEntry[] {
  return Array.from(activeWritesMap.values());
}

export function hasActiveCriticalWrite(): boolean {
  return activeWritesMap.size > 0;
}

export async function waitForActiveWrites(maxWaitMs = 5000): Promise<void> {
  const start = Date.now();
  while (activeWritesMap.size > 0 && Date.now() - start < maxWaitMs) {
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}

export function emitSaveConfirmation(detail: SaveFeedbackDetail) {
  if (typeof window === 'undefined') return;
  const payload: SaveFeedbackDetail = {
    id: detail.id || `sf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    variant: detail.variant || 'success',
    durationMs: detail.durationMs ?? 6000,
    ...detail,
  };
  window.dispatchEvent(
    new CustomEvent<SaveFeedbackDetail>('app_save_confirmation', {
      detail: payload,
    })
  );
}
