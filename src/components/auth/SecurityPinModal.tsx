import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Lock, ShieldAlert, KeyRound, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SecurityPinModalProps {
  onSuccess?: () => void;
}

export default function SecurityPinModal({ onSuccess }: SecurityPinModalProps) {
  const { currentUser, logout } = useAuth();
  const [isLocked, setIsLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Challenge Interval in minutes (default: 15)
  const intervalMinutes = currentUser?.pinChallengeInterval || 15;
  const isPinEnabled = Boolean(currentUser?.securityPinEnabled);

  useEffect(() => {
    if (!isPinEnabled || !currentUser) {
      setIsLocked(false);
      return;
    }

    let lastActive = Date.now();

    const handleActivity = () => {
      lastActive = Date.now();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);

    const intervalCheck = setInterval(() => {
      const elapsedMinutes = (Date.now() - lastActive) / (1000 * 60);
      if (elapsedMinutes >= intervalMinutes && !isLocked) {
        setIsLocked(true);
      }
    }, 15000); // Check every 15s

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      clearInterval(intervalCheck);
    };
  }, [isPinEnabled, intervalMinutes, isLocked, currentUser]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) {
      setErrorMessage(`به دلیل تلاش‌های ناموفق مکرر، ورود پین تا ${lockoutSeconds} ثانیه دیگر مسدود است.`);
      return;
    }

    const cleanPin = pin.trim();
    if (cleanPin.length < 4 || cleanPin.length > 8) {
      setErrorMessage('کد پین باید بین ۴ تا ۸ رقم باشد.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {

      // 2. Client-side fallback / local hash verification
      let isValid = false;
      try {
        const res = await fetch('/api/auth/pin/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ pin: cleanPin })
        });
        const data = await res.json().catch(() => ({ success: false }));
        if (res.ok && data.success && data.verified) {
          isValid = true;
        }
      } catch (err) {
        // Fallback to local salted hash verification
        const { verifySecurityPin } = await import('./AccountSecurityPinModal');
        isValid = await verifySecurityPin(cleanPin, currentUser?.specialSecurityPinHash);
      }

      // If server fetch wasn't valid, also test client-side hash
      if (!isValid && currentUser?.specialSecurityPinHash) {
        const { verifySecurityPin } = await import('./AccountSecurityPinModal');
        isValid = await verifySecurityPin(cleanPin, currentUser.specialSecurityPinHash);
      }

      setIsLoading(false);

      if (isValid) {
        setIsLocked(false);
        setPin('');
        setFailedAttempts(0);
        if (onSuccess) onSuccess();
      } else {
        const nextFailed = failedAttempts + 1;
        setFailedAttempts(nextFailed);
        if (nextFailed >= 3) {
          setErrorMessage('۳ بار ورود کد پین نادرست انجام شد. به دلایل امنیتی از حساب کاربری خارج می‌شوید...');
          setTimeout(() => {
            logout();
          }, 1500);
        } else {
          setErrorMessage(`کد پین امنیتی نادرست است. (${3 - nextFailed} بار تلاش مجاز باقی‌مانده)`);
        }
      }
    } catch (err: unknown) {
      setIsLoading(false);
      const errMsg = err instanceof Error ? err.message : 'خطا در ارتباط با سرور تایید پین.';
      setErrorMessage(errMsg);
    }
  };

  if (!isLocked) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 15 }}
        className="w-full max-w-md bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden font-vazir"
      >
        {/* Glow Header */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500" />

        <div className="text-center space-y-3 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 mx-auto flex items-center justify-center shadow-lg">
            <Lock size={30} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">چالش امنیتی پین (Security PIN)</h2>
            <p className="text-xs text-slate-300 mt-1">
              به دلیل عدم فعالیت بیش از {intervalMinutes} دقیقه، سامانه موقتاً قفل شده است.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-[11px] text-slate-300 font-medium">
            <span>کاربر فعال:</span>
            <strong className="text-indigo-300 font-mono">@{currentUser?.username}</strong>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-500/20 border border-rose-400/40 rounded-xl text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-rose-300" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleVerifyPin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 text-right">
              کد پین امنیتی خود را وارد فرمایید:
            </label>
            <div className="relative flex items-center">
              <input
                type="password"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="پین ۴ تا ۸ رقمی"
                disabled={isLoading || lockoutSeconds > 0}
                autoFocus
                className="w-full py-3.5 px-4 bg-white/10 border border-white/20 rounded-2xl text-center text-xl tracking-[0.4em] font-mono text-white placeholder-white/30 focus:border-indigo-400 focus:bg-white/15 outline-none transition-all disabled:opacity-50"
              />
              <KeyRound size={18} className="absolute right-3 text-slate-400 pointer-events-none" />
            </div>
            <p className="text-[10px] text-slate-400 mt-1 text-right">
              نکته: در صورت فراموشی پین، سوپر ادمین می‌تواند از بخش مدیریت کاربران آن را ریست کند.
            </p>
          </div>

          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={isLoading || lockoutSeconds > 0 || pin.length < 4}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin text-white" />
                  <span>در حال بررسی پین...</span>
                </>
              ) : lockoutSeconds > 0 ? (
                <span>قفل موقت ({lockoutSeconds} ثانیه)</span>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>تأیید و بازگشایی سامانه</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={logout}
              className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer"
            >
              خروج کامل از حساب کاربری
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
