import React, { useEffect, useState } from 'react';
import { subscribeDatabaseToast, dismissDatabaseToast, DatabaseToastState } from '../lib/databaseToast';
import { AlertTriangle, WifiOff, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function DatabaseToastBanner() {
  const [toast, setToast] = useState<DatabaseToastState | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeDatabaseToast(newToast => {
      setToast(newToast);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none w-full max-w-lg px-4">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -25, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "pointer-events-auto shadow-2xl rounded-2xl p-4 border flex items-center justify-between gap-3 text-right font-vazir backdrop-blur-md",
              toast.type === 'error' && "bg-rose-950/95 border-rose-500/80 text-rose-100 shadow-rose-950/50",
              toast.type === 'warning' && "bg-amber-950/95 border-amber-500/80 text-amber-100 shadow-amber-950/50",
              toast.type === 'success' && "bg-emerald-950/95 border-emerald-500/80 text-emerald-100 shadow-emerald-950/50",
              toast.type === 'info' && "bg-slate-900/95 border-sky-500/80 text-sky-100 shadow-slate-950/50"
            )}
            dir="rtl"
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                toast.type === 'error' && "bg-rose-500/20 text-rose-400 border border-rose-500/30",
                toast.type === 'warning' && "bg-amber-500/20 text-amber-400 border border-amber-500/30",
                toast.type === 'success' && "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
                toast.type === 'info' && "bg-sky-500/20 text-sky-400 border border-sky-500/30"
              )}>
                {toast.type === 'error' && <WifiOff size={20} className="animate-pulse" />}
                {toast.type === 'warning' && <AlertTriangle size={20} />}
                {toast.type === 'success' && <CheckCircle2 size={20} />}
                {toast.type === 'info' && <AlertCircle size={20} />}
              </div>
              <div className="space-y-0.5">
                <div className="font-black text-sm text-white flex items-center gap-1.5">
                  {toast.type === 'error' && <span>خطای عدم ثبت در پایگاه داده</span>}
                  {toast.type === 'warning' && <span>هشدار سیستم</span>}
                  {toast.type === 'success' && <span>عملیات موفق</span>}
                  {toast.type === 'info' && <span>اطلاعیه پایگاه داده</span>}
                </div>
                <p className="text-xs text-rose-200/90 leading-relaxed font-medium">
                  {toast.message}
                </p>
              </div>
            </div>

            <button
              onClick={dismissDatabaseToast}
              className="p-2 text-rose-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors shrink-0"
              title="بستن پیام"
            >
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
