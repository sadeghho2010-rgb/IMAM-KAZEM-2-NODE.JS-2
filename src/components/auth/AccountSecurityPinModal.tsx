import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AppUser } from '../../types/auth';
import { localDb } from '../../lib/localDb';
import { 
  ShieldCheck, 
  ShieldAlert, 
  KeyRound, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  X, 
  Check, 
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface AccountSecurityPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser?: AppUser | null;
  onUpdated?: () => void;
}

// Client-side SHA-256 salted PIN hash function (Anti-tamper & F12 inspection safe)
export async function hashSecurityPin(pin: string): Promise<string> {
  const cleanPin = pin.trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(`sem_security_pin_salt_2026_${cleanPin}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifySecurityPin(enteredPin: string, storedHash?: string): Promise<boolean> {
  const clean = enteredPin.trim();
  if (!storedHash) return false;
  const computed = await hashSecurityPin(clean);
  return computed === storedHash || storedHash === clean;
}

export default function AccountSecurityPinModal({
  isOpen,
  onClose,
  targetUser: propTargetUser,
  onUpdated
}: AccountSecurityPinModalProps) {
  const { currentUser, updateUser, isSuperAdmin } = useAuth();
  const userToEdit = propTargetUser || currentUser;

  const isEditingSelf = currentUser?.id === userToEdit?.id;
  const isSuperAdminEditingOthers = isSuperAdmin && !isEditingSelf;

  const isPinEnabled = Boolean(userToEdit?.securityPinEnabled);

  // Form State
  const [pinInput1, setPinInput1] = useState('');
  const [pinInput2, setPinInput2] = useState('');
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [challengeInterval, setChallengeInterval] = useState<number>(userToEdit?.pinChallengeInterval || 5);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !userToEdit) return null;

  // Handle Enable or Update PIN
  const handleEnableOrUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // If changing PIN and PIN was already enabled (and not super admin editing others), verify current PIN
    if (isPinEnabled && !isSuperAdminEditingOthers) {
      if (!currentPinInput.trim()) {
        setErrorMessage('لطفاً پین ۴ رقمی فعلی حساب خود را وارد فرمايید.');
        return;
      }
      const isCurrentValid = await verifySecurityPin(currentPinInput, userToEdit.specialSecurityPinHash);
      if (!isCurrentValid) {
        setErrorMessage('کد پین فعلی وارد شده نادرست است.');
        return;
      }
    }

    const clean1 = pinInput1.trim();
    const clean2 = pinInput2.trim();

    if (!/^\d{4}$/.test(clean1)) {
      setErrorMessage('کد پین باید دقیقاً یک عدد ۴ رقمی (مثلاً ۴۷۴۲) باشد.');
      return;
    }

    if (clean1 !== clean2) {
      setErrorMessage('کد پین وارد شده در دو کادر با یکدیگر مطابقت ندارند.');
      return;
    }

    setIsSubmitting(true);
    try {
      const pinHash = await hashSecurityPin(clean1);

      const payload: Partial<AppUser> = {
        securityPinEnabled: true,
        specialSecurityPinHash: pinHash,
        pinChallengeInterval: Number(challengeInterval) || 5,
        updatedAt: new Date().toISOString()
      };

      // Update in AuthContext & LocalDb & DB
      updateUser(userToEdit.id, payload);
      await localDb.updateDoc('system_users', userToEdit.id, payload);

      setIsSubmitting(false);
      setSuccessMessage('سطح امنیتی حساب کاربری با موفقیت افزایش یافت و کد پین ۴ رقمی فعال گردید.');
      setPinInput1('');
      setPinInput2('');
      setCurrentPinInput('');

      if (onUpdated) onUpdated();
    } catch (err) {
      setIsSubmitting(false);
      setErrorMessage('خطا در ذخیره‌سازی تنظیمات امنیتی.');
    }
  };

  // Handle Disable / Turn Off PIN
  const handleDisablePin = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // If super admin editing others, no PIN required to disable!
    if (!isSuperAdminEditingOthers) {
      if (!currentPinInput.trim()) {
        setErrorMessage('جهت غیرفعال‌سازی سطح امنیتی، لطفاً کد پین ۴ رقمی فعلی را وارد فرمایید.');
        return;
      }
      const isCurrentValid = await verifySecurityPin(currentPinInput, userToEdit.specialSecurityPinHash);
      if (!isCurrentValid) {
        setErrorMessage('کد پین فعلی وارد شده اشتباه است.');
        return;
      }
    }

    if (!confirm('آیا از خاموش کردن و غیرفعال‌سازی سطح امنیتی پین ۴ رقمی اطمینان دارید؟')) {
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<AppUser> = {
        securityPinEnabled: false,
        specialSecurityPinHash: '',
        updatedAt: new Date().toISOString()
      };

      updateUser(userToEdit.id, payload);
      await localDb.updateDoc('system_users', userToEdit.id, payload);

      setIsSubmitting(false);
      setSuccessMessage('سطح امنیتی پین با موفقیت غیرفعال شد.');
      setCurrentPinInput('');

      if (onUpdated) onUpdated();
    } catch (err) {
      setIsSubmitting(false);
      setErrorMessage('خطا در غیرفعال‌سازی سطح امنیتی.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" dir="rtl">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5 relative overflow-hidden"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900">
                افزایش سطح امنیتی حساب (تنظیم پین ۴ رقمی)
              </h3>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                کاربر: <strong className="text-indigo-900">{userToEdit.name || userToEdit.fullName}</strong> ({userToEdit.roleTitle || 'مسئول'})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Current Status Banner */}
        <div className={cn(
          "p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold",
          isPinEnabled
            ? "bg-emerald-50 border-emerald-200 text-emerald-950"
            : "bg-amber-50 border-amber-200 text-amber-950"
        )}>
          <div className="flex items-center gap-2">
            {isPinEnabled ? <Lock size={18} className="text-emerald-600 shrink-0" /> : <Unlock size={18} className="text-amber-600 shrink-0" />}
            <div>
              <span className="block font-black">
                وضعیت فعلی: {isPinEnabled ? 'سطح امنیتی پین فعال می‌باشد ✅' : 'سطح امنیتی پین فعال نیست ⚠️'}
              </span>
              <span className="text-[11px] font-normal opacity-80 block mt-0.5">
                {isPinEnabled
                  ? `قفل خودکار در صورت عدم فعالیت: هر ${userToEdit.pinChallengeInterval || 5} دقیقه`
                  : 'با فعال‌سازی پین، علاوه بر رمز عبور، تایید پین ۴ رقمی الزامی خواهد بود.'}
              </span>
            </div>
          </div>
        </div>

        {/* Messages */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* PIN Setup / Update Form */}
        <form onSubmit={handleEnableOrUpdatePin} className="space-y-4 text-xs font-bold text-slate-800">
          
          {/* Current PIN required if user is changing their own enabled PIN */}
          {isPinEnabled && !isSuperAdminEditingOthers && (
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1">
              <label className="text-slate-700 block text-xs">کد پین ۴ رقمی فعلی جهت احراز هویت:</label>
              <input
                type="password"
                maxLength={4}
                value={currentPinInput}
                onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="****"
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-center font-mono text-lg tracking-[0.5em] text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* New PIN & Repeat PIN Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-slate-700 text-xs">
                {isPinEnabled ? 'کد پین ۴ رقمی جدید:' : 'تعیین کد پین ۴ رقمی امنیتی:'}
              </label>
              <input
                type="password"
                maxLength={4}
                required
                value={pinInput1}
                onChange={(e) => setPinInput1(e.target.value.replace(/\D/g, ''))}
                placeholder="مثلاً ۴۷۴۲"
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-center font-mono text-lg tracking-[0.5em] text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-slate-700 text-xs">تکرار کد پین ۴ رقمی:</label>
              <input
                type="password"
                maxLength={4}
                required
                value={pinInput2}
                onChange={(e) => setPinInput2(e.target.value.replace(/\D/g, ''))}
                placeholder="تکرار ۴ رقم"
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-center font-mono text-lg tracking-[0.5em] text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Challenge Interval Selector */}
          <div className="space-y-1">
            <label className="block text-slate-700 text-xs">
              زمان‌بندی درخواست مجدد پین در صورت عدم فعالیت:
            </label>
            <select
              value={challengeInterval}
              onChange={(e) => setChallengeInterval(Number(e.target.value))}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value={5}>هر ۵ دقیقه عدم فعالیت (پیش‌فرض پیشنهادی)</option>
              <option value={10}>هر ۱۰ دقیقه عدم فعالیت</option>
              <option value={15}>هر ۱۵ دقیقه عدم فعالیت</option>
              <option value={30}>هر ۳۰ دقیقه عدم فعالیت</option>
            </select>
          </div>

          {/* Actions Bar */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="submit"
              disabled={isSubmitting || pinInput1.length !== 4 || pinInput2.length !== 4}
              className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-200"
            >
              <CheckCircle2 size={16} />
              <span>{isPinEnabled ? 'ذخیره و به‌روزرسانی پین' : 'تایید و افزایش سطح امنیتی حساب'}</span>
            </button>

            {isPinEnabled && (
              <button
                type="button"
                onClick={handleDisablePin}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Unlock size={15} />
                <span>خاموش کردن و غیرفعال‌سازی پین</span>
              </button>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  );
}
