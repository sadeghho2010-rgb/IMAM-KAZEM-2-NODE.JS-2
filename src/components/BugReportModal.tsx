import React, { useState, useEffect } from 'react';
import { Bug, X, Send, AlertTriangle, CheckCircle2, Loader2, Monitor, Compass, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function detectSystemInfo() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let browser = 'Unknown';
  let os = 'Unknown';

  if (ua.includes('Firefox')) browser = 'Mozilla Firefox';
  else if (ua.includes('Edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome')) browser = 'Google Chrome';
  else if (ua.includes('Safari')) browser = 'Apple Safari';

  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';

  const screenRes = typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : '';
  const currentUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';

  return {
    browser,
    os,
    screenRes,
    currentUrl,
    userAgent: ua
  };
}

export default function BugReportModal({ isOpen, onClose }: BugReportModalProps) {
  const { currentUser } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [systemInfo, setSystemInfo] = useState(detectSystemInfo());

  useEffect(() => {
    if (isOpen) {
      setSystemInfo(detectSystemInfo());
      setSuccess(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      alert('لطفاً عنوان و شرح مشکل را تکمیل فرمایید.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        severity,
        pageUrl: systemInfo.currentUrl,
        browserInfo: `${systemInfo.browser} (${systemInfo.screenRes})`,
        osInfo: systemInfo.os,
        userAgent: systemInfo.userAgent,
        userId: currentUser?.id || 'anonymous',
        userName: currentUser?.name || currentUser?.username || 'کاربر مهمان',
      };

      const res = await fetch('/api/bug-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('خطا در ارسال گزارش به سرور.');
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setTitle('');
        setDescription('');
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      alert(err.message || 'خطا در ثبت گزارش خطا');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-vazir" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl p-6 w-full max-w-lg border border-slate-200 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-rose-600">
            <Bug size={22} />
            <h3 className="text-sm font-black text-slate-900">گزارش خطا یا اشکال در سامانه</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center space-y-2">
            <CheckCircle2 size={40} className="text-emerald-500 mx-auto animate-bounce" />
            <p className="text-sm font-black text-slate-800">گزارش شما با موفقیت ثبت شد!</p>
            <p className="text-xs text-slate-500">تیم فنی در اسرع وقت مشکل را بررسی و برطرف خواهد کرد.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Auto Detected System Info Notice */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-slate-600 text-[11px]">
              <div className="flex items-center justify-between font-bold text-slate-700">
                <span className="flex items-center gap-1"><Monitor size={13} /> سیستم و مرورگر شناسایی‌شده:</span>
                <span className="text-indigo-600 font-mono">{systemInfo.os} • {systemInfo.browser}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>مسیر صفحه فعلی:</span>
                <span className="font-mono text-slate-500 truncate max-w-[200px]">{systemInfo.currentUrl || '/'}</span>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">عنوان خلاصه مشکل:</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: خطا در ثبت حضور و غیاب یا عدم لود کارنامه..."
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:bg-white focus:border-rose-400"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">سطح اهمیت مشکل:</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'low', label: 'عادی', color: 'text-slate-600' },
                  { id: 'medium', label: 'متوسط', color: 'text-blue-600' },
                  { id: 'high', label: 'زیاد', color: 'text-amber-600' },
                  { id: 'critical', label: 'بحرانی', color: 'text-rose-600' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSeverity(s.id as any)}
                    className={cn(
                      "py-2 px-1 rounded-xl text-center font-bold border transition-all cursor-pointer text-[11px]",
                      severity === s.id
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">شرح دقیق خطا و مراحل ایجاد آن:</label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="توضیح دهید در حال انجام چه عملیاتی بودید و چه پیامی مشاهده کردید..."
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none resize-none leading-relaxed focus:bg-white focus:border-rose-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-md shadow-rose-600/20 cursor-pointer"
              >
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                <span>ارسال گزارش به تیم فنی</span>
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
