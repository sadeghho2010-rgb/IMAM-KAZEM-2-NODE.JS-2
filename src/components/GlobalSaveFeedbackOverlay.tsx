import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, AlertTriangle, XCircle, X, ShieldCheck, Loader2 } from 'lucide-react';
import {
  SaveFeedbackDetail,
  ActiveWriteEntry,
  getActiveWrites,
} from '../lib/saveFeedback';
import { cn } from '../lib/utils';

export const GlobalSaveFeedbackOverlay: React.FC = () => {
  const [feedback, setFeedback] = useState<SaveFeedbackDetail | null>(null);
  const [activeWrites, setActiveWrites] = useState<ActiveWriteEntry[]>(() => getActiveWrites());

  useEffect(() => {
    let dismissTimer: ReturnType<typeof setTimeout> | null = null;

    const handleConfirmation = (e: Event) => {
      const detail = (e as CustomEvent<SaveFeedbackDetail>).detail;
      if (!detail || !detail.message) return;

      if (dismissTimer) clearTimeout(dismissTimer);
      setFeedback(detail);

      const duration = detail.durationMs ?? 6000;
      if (duration > 0) {
        dismissTimer = setTimeout(() => {
          setFeedback((curr) => (curr?.id === detail.id ? null : curr));
        }, duration);
      }
    };

    const handleWriteProgress = (e: Event) => {
      const list = (e as CustomEvent<{ activeWrites: ActiveWriteEntry[] }>).detail?.activeWrites;
      setActiveWrites(Array.isArray(list) ? list : getActiveWrites());
    };

    window.addEventListener('app_save_confirmation', handleConfirmation as EventListener);
    window.addEventListener('app_write_progress_change', handleWriteProgress as EventListener);

    return () => {
      if (dismissTimer) clearTimeout(dismissTimer);
      window.removeEventListener('app_save_confirmation', handleConfirmation as EventListener);
      window.removeEventListener('app_write_progress_change', handleWriteProgress as EventListener);
    };
  }, []);

  const dismiss = () => setFeedback(null);

  const variant = feedback?.variant || 'success';

  const variantStyles = {
    success: {
      topBanner: 'bg-emerald-950/95 text-emerald-50 border-emerald-400/50 shadow-emerald-950/30',
      iconBg: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      ring: 'border-emerald-200',
      headerBg: 'from-emerald-600 via-teal-600 to-emerald-700',
      buttonBg: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25',
      progressBg: 'bg-emerald-500',
      Icon: CheckCircle2,
    },
    warning: {
      topBanner: 'bg-amber-950/95 text-amber-50 border-amber-400/50 shadow-amber-950/30',
      iconBg: 'bg-amber-100 text-amber-700 border-amber-200',
      ring: 'border-amber-200',
      headerBg: 'from-amber-600 via-orange-600 to-amber-700',
      buttonBg: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/25',
      progressBg: 'bg-amber-500',
      Icon: AlertTriangle,
    },
    error: {
      topBanner: 'bg-rose-950/95 text-rose-50 border-rose-400/50 shadow-rose-950/30',
      iconBg: 'bg-rose-100 text-rose-700 border-rose-200',
      ring: 'border-rose-200',
      headerBg: 'from-rose-600 via-red-600 to-rose-700',
      buttonBg: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/25',
      progressBg: 'bg-rose-500',
      Icon: XCircle,
    },
  }[variant];

  const ActiveIcon = variantStyles.Icon;

  return (
    <>
      {/* 1. Active Write Protection Banner (while saving to server) */}
      <AnimatePresence>
        {activeWrites.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[140] w-[92%] max-w-md bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-indigo-400/40 flex items-center gap-3 font-vazir"
            dir="rtl"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-500/25 border border-indigo-400/30 flex items-center justify-center shrink-0">
              <Loader2 size={18} className="animate-spin text-indigo-300" />
            </div>
            <div className="min-w-0 flex-1 text-right">
              <p className="text-xs font-black text-white truncate">
                {activeWrites[0]?.label || 'در حال ثبت نهایی در سرور...'}
              </p>
              <p className="text-[10.5px] text-amber-300 font-bold mt-0.5">
                لطفاً تا نمایش پیام تایید نهایی از برنامه خارج نشوید.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Top-of-Screen Confirmation Banner (Toast بالای صفحه) */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            key={`top-${feedback.id}`}
            initial={{ opacity: 0, y: -24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.96 }}
            transition={{ duration: 0.22 }}
            className={cn(
              'fixed top-4 left-1/2 -translate-x-1/2 z-[130] w-[94%] max-w-xl px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-md flex items-center gap-3 font-vazir',
              variantStyles.topBanner
            )}
            dir="rtl"
          >
            <ActiveIcon size={20} className="shrink-0 text-white" />
            <div className="flex-1 min-w-0 text-right">
              <div className="text-xs font-black truncate">{feedback.title}</div>
              <div className="text-[11px] opacity-90 font-medium line-clamp-2 leading-relaxed">
                {feedback.message}
              </div>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0 cursor-pointer"
              aria-label="بستن اعلان"
            >
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Center-Screen Confirmation Popup Modal (پاپ‌آپ تایید در وسط صفحه) */}
      <AnimatePresence>
        {feedback && (
          <div
            key={`modal-${feedback.id}`}
            className="fixed inset-0 z-[135] flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-[2px] font-vazir"
            dir="rtl"
            onClick={dismiss}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 12 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'relative w-full max-w-md bg-white rounded-3xl shadow-2xl border-2 overflow-hidden text-center',
                variantStyles.ring
              )}
            >
              {/* Colored Top Accent Header */}
              <div className={cn('bg-gradient-to-r px-6 pt-6 pb-5 text-white relative', variantStyles.headerBg)}>
                <button
                  type="button"
                  onClick={dismiss}
                  className="absolute left-3.5 top-3.5 p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
                  aria-label="بستن پنجره تایید"
                >
                  <X size={16} />
                </button>
                <div className="w-16 h-16 mx-auto rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-lg mb-3">
                  <ActiveIcon size={36} className="text-white drop-shadow-sm" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-white leading-snug">
                  {feedback.title}
                </h3>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <p className="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed">
                  {feedback.message}
                </p>

                {feedback.subtitle && (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-[11.5px] font-bold text-slate-600 flex items-center justify-center gap-2">
                    <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
                    <span>{feedback.subtitle}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={dismiss}
                  className={cn(
                    'w-full py-3 px-6 rounded-2xl font-black text-xs sm:text-sm shadow-lg transition-all active:scale-[0.98] cursor-pointer',
                    variantStyles.buttonBg
                  )}
                >
                  متوجه شدم و تایید
                </button>
              </div>

              {/* Auto-close progress bar */}
              {(feedback.durationMs ?? 6000) > 0 && (
                <div className="h-1 w-full bg-slate-100 overflow-hidden">
                  <motion.div
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: (feedback.durationMs ?? 6000) / 1000, ease: 'linear' }}
                    className={cn('h-full', variantStyles.progressBg)}
                  />
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
