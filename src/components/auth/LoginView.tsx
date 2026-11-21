import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth, DEFAULT_USERS } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  BookOpen,
  KeyRound,
  Loader2,
  Users,
  ChevronDown,
  X,
  Check,
  Wrench
} from 'lucide-react';
import { AppUser } from '../../types/auth';
import { Teacher } from '../../types';
import { localDb } from '../../lib/localDb';
import { cn, normalizeDigits } from '../../lib/utils';
import { PWAInstallButton } from '../PWAInstallButton';

interface LoginViewProps {
  onLoginSuccess?: () => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const { login, users } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showIntroFlare, setShowIntroFlare] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!showIntroFlare) return;
    const timer = window.setTimeout(() => setShowIntroFlare(false), 1300);
    return () => window.clearTimeout(timer);
  }, [showIntroFlare]);

  // 2-Step PIN verification modal state
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinInputValue, setPinInputValue] = useState('');
  const [pinErrorMessage, setPinErrorMessage] = useState<string | null>(null);

  // Brute force protection: 3 failed attempts => 5s cooldown
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Quick preset helper modal/drawer for testing
  const [showQuickPresets, setShowQuickPresets] = useState(false);
  const [selectedLevelTab, setSelectedLevelTab] = useState<1 | 2 | 3>(1);
  const [bankTeachers, setBankTeachers] = useState<Teacher[]>([]);
  const [maintenanceBanner, setMaintenanceBanner] = useState<{ enabled: boolean; message?: string; estimatedDuration?: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/system/maintenance-status', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (active && d && d.enabled) {
          setMaintenanceBanner({ enabled: true, message: d.message, estimatedDuration: d.estimatedDuration });
        }
      })
      .catch((err) => {
        console.error('[STORAGE_FAILURE][login_maintenance_probe]', err);
      });
    return () => { active = false; };
  }, []);

  // Load teachers from database only when quick presets drawer is active and opened
  useEffect(() => {
    if (import.meta.env.VITE_ENABLE_QUICK_LOGIN === 'true' && showQuickPresets) {
      localDb.getDocs<Teacher>('teachers').then(tList => {
        if (Array.isArray(tList) && tList.length > 0) {
          setBankTeachers(tList);
        }
      }).catch(() => {});
    }
  }, [showQuickPresets]);

  // Clean up any legacy background keys from localStorage on mount
  useEffect(() => {
    try {
      localStorage.removeItem('custom_login_bg');
      localStorage.removeItem('custom_mobile_bg');
    } catch {}
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cooldownSeconds > 0) {
      setErrorMessage(`لطفاً تا اتمام زمان تأمل (${cooldownSeconds} ثانیه دیگر) شکیبا باشید.`);
      return;
    }

    const cleanUser = normalizeDigits(username).trim();
    const cleanPass = normalizeDigits(password).trim();

    if (!cleanUser || !cleanPass) {
      setErrorMessage('لطفاً نام کاربری و رمز عبور را به صورت کامل وارد فرمایید.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      // Perform robust application login
      const result = await login(cleanUser, cleanPass);
      setIsLoading(false);

      if (result.mustChangePassword) {
        setErrorMessage(result.message || 'جهت حفظ امنیت سامانه، تغییر رمز عبور در اولین ورود الزامی است.');
        return;
      }

      if (result.requirePin) {
        setShowPinPrompt(true);
        setPinErrorMessage(null);
        setPinInputValue('');
        return;
      }

      if (result.success) {
        setFailedAttempts(0);
        if (onLoginSuccess) {
          onLoginSuccess();
        }
      } else {
        const nextFailed = failedAttempts + 1;
        setFailedAttempts(nextFailed);

        if (nextFailed >= 3) {
          setCooldownSeconds(5);
          setErrorMessage('تعداد ۳ بار تلاش ناموفق ثبت گردید. به منظور حفظ امنیت، دکمه ورود به مدت ۵ ثانیه غیرفعال شد.');
        } else {
          setErrorMessage(result.message || 'نام کاربری یا رمز عبور اشتباه است.');
        }
      }
    } catch (err: unknown) {
      setIsLoading(false);
      const nextFailed = failedAttempts + 1;
      setFailedAttempts(nextFailed);

      const errMsg = err instanceof Error ? err.message : 'خطا در برقراری ارتباط با سامانه ورود.';
      if (nextFailed >= 3) {
        setCooldownSeconds(5);
        setErrorMessage('۳ بار تلاش ناموفق انجام شد. ۵ ثانیه درنگ الزامی است.');
      } else {
        setErrorMessage(errMsg);
      }
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pinInputValue.trim();
    if (!cleanPin) {
      setPinErrorMessage('لطفاً پین ۴ رقمی امنیتی را وارد فرمایید.');
      return;
    }
    setIsLoading(true);
    setPinErrorMessage(null);
    try {
      const res = await login(username.trim(), password.trim(), cleanPin);
      setIsLoading(false);
      if (res.success) {
        setShowPinPrompt(false);
        setFailedAttempts(0);
        if (onLoginSuccess) onLoginSuccess();
      } else {
        setPinErrorMessage(res.message || 'کد پین ۴ رقمی امنیتی وارد شده نادرست است.');
      }
    } catch (err) {
      setIsLoading(false);
      setPinErrorMessage('خطا در بررسی و تایید کد پین.');
    }
  };

  const handleSelectPreset = (user: AppUser) => {
    setUsername(user.username);
    setPassword(user.password || '');
    setErrorMessage(null);
    setShowQuickPresets(false);
  };

  const handleDirectLogin = async (user: AppUser) => {
    const uName = user.username;
    const uPass = user.password || '';
    setUsername(uName);
    setPassword(uPass);
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const res = await login(uName, uPass);
      setIsLoading(false);
      if (res.success) {
        setFailedAttempts(0);
        if (onLoginSuccess) onLoginSuccess();
      } else {
        setErrorMessage(res.message || 'خطا در ورود.');
      }
    } catch (e: unknown) {
      setIsLoading(false);
      setErrorMessage(e instanceof Error ? e.message : 'خطا در ورود مستقیم.');
    }
  };

  const availableUsers = (users && users.length ? users : DEFAULT_USERS);
  
  const filteredUsers = useMemo(() => {
    const directUsers = availableUsers.filter((u) => u.level === selectedLevelTab);

    // If on Level 3 (Teachers), also include any teachers from TeacherBank not already present as users
    if (selectedLevelTab === 3 && bankTeachers.length > 0) {
      const existingUsernames = new Set(directUsers.map(u => u.username.toUpperCase()));
      const existingNames = new Set(directUsers.map(u => (u.name || u.fullName || '').toLowerCase().trim()));

      const additionalTeacherUsers: AppUser[] = [];
      bankTeachers.forEach(t => {
        const tName = (t.fullName || t.name || '').trim();
        const tUsername = (t.teacherCode || t.nationalId || t.phoneNumber || tName).toUpperCase();

        if (!existingUsernames.has(tUsername) && !existingNames.has(tName.toLowerCase())) {
          additionalTeacherUsers.push({
            id: t.id,
            username: tUsername,
            password: '',
            name: tName,
            fullName: tName,
            level: 3,
            role: 'teacher',
            roleTitle: 'استاد مدرسه',
            scope: 'self',
            teacherId: t.id,
            linkedTeacherId: t.id,
            nationalId: t.nationalId,
            phone: t.phoneNumber,
            allowedTabs: ['teacher-portal'],
            editableTabs: ['teacher-portal'],
            modulePermissions: { 'teacher-portal': 'edit' },
            isReadOnly: false,
            canEdit: true,
            isActive: t.isActive !== false,
            createdAt: t.createdAt
          });
        }
      });

      return [...directUsers, ...additionalTeacherUsers];
    }

    return directUsers;
  }, [availableUsers, selectedLevelTab, bankTeachers]);

  return (
    <div
      id="login-page-root"
      dir="rtl"
      className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden font-vazir bg-[#050b19] select-none"
    >
      {/* 1. Architectural Seminary Backdrop: Midnight Sapphire Depth + Geometric Star Lattice + Warm Zenith Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Base atmospheric radial gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 55% at 50% 18%, rgba(217, 169, 86, 0.14) 0%, rgba(15, 36, 77, 0.45) 45%, rgba(5, 11, 25, 0.98) 100%)'
          }}
        />

        {/* Delicate Islamic 8-point geometric architectural lattice */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.06]"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <pattern id="seminary-lattice" width="84" height="84" patternUnits="userSpaceOnUse">
              <path
                d="M42 6 L52 32 L78 42 L52 52 L42 78 L32 52 L6 42 L32 32 Z"
                fill="none"
                stroke="#f5d08a"
                strokeWidth="0.7"
              />
              <rect
                x="18"
                y="18"
                width="48"
                height="48"
                fill="none"
                stroke="#93c5fd"
                strokeWidth="0.45"
                transform="rotate(45 42 42)"
              />
              <circle cx="42" cy="42" r="2.2" fill="#f5d08a" opacity="0.65" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#seminary-lattice)" />
        </svg>

        {/* Quiet ambient light orbs */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[620px] h-[340px] bg-amber-400/10 rounded-full blur-[110px]" />
        <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[640px] h-[360px] bg-sky-600/12 rounded-full blur-[120px]" />
      </div>

      {/* 2. Main Login Box: Centered Exactly in the Middle */}
      <div className="relative z-10 w-full max-w-[440px] flex items-center justify-center">
        <div className="relative group/card w-full">
          {/* The Login Glassmorphic Window with Continuous White Neon Tube Border */}
          <motion.div
            id="login-glass-card"
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full rounded-[27px] bg-[#0a1328]/94 backdrop-blur-2xl border-[1.5px] border-white/90 p-6 sm:p-8 text-white shadow-[0_0_5px_rgba(255,255,255,0.75),0_0_14px_rgba(255,255,255,0.30),0_0_26px_rgba(255,255,255,0.12),inset_0_0_8px_rgba(255,255,255,0.14),0_28px_80px_-20px_rgba(0,0,0,0.85)] overflow-hidden max-h-[92vh] overflow-y-auto"
          >
            {/* Top gold architectural hairline reflection */}
            <div className="absolute top-0 inset-x-10 h-[2px] bg-gradient-to-r from-transparent via-amber-300/80 to-transparent pointer-events-none" />

            {/* Subtle internal corner glow */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-36 bg-amber-400/12 rounded-full blur-3xl pointer-events-none" />

            {/* Header: Seminary identity */}
            <div className="relative text-center space-y-3 mb-6 pt-1">
              {/* Subtle Horizontal Prism Flare (Auto-unmounts after reveal so nothing lingers on laptop) */}
              {showIntroFlare && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-[5.25rem] left-1/2 w-full h-[2px] login-horizon-flare"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent 0%, rgba(253, 230, 138, 0.35) 20%, rgba(255, 255, 255, 0.98) 50%, rgba(253, 230, 138, 0.35) 80%, transparent 100%)',
                    boxShadow: '0 0 22px 4px rgba(251, 191, 36, 0.55)'
                  }}
                />
              )}

              {/* Geometric Seminary Emblem */}
              <motion.div
                initial={{ opacity: 0, scale: 0.72, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 flex justify-center"
              >
                <div className="relative w-16 h-16 sm:w-[68px] sm:h-[68px] rounded-2xl bg-gradient-to-b from-amber-400/20 via-[#132347] to-[#0b152d] border border-amber-300/35 shadow-[0_12px_30px_-8px_rgba(245,158,11,0.35)] flex items-center justify-center">
                  {/* Subtle inner octagonal accent frame */}
                  <div className="absolute inset-1.5 rounded-xl border border-amber-200/15 pointer-events-none" />
                  <BookOpen size={28} className="text-amber-200 drop-shadow-[0_0_12px_rgba(251,191,36,0.45)]" />
                </div>
              </motion.div>

              {/* Illuminated School Name Reveal */}
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.96, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                transition={{ duration: 0.85, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 space-y-2"
              >
                <h1 className="text-xl sm:text-[23px] font-black tracking-tight leading-snug login-title-luminous drop-shadow-[0_2px_18px_rgba(251,191,36,0.22)]">
                  مدرسه تخصصی فقه امام کاظم (ع)
                </h1>

                {/* Clean ornamental subtitle (Zero-pill discipline) */}
                <div className="flex items-center justify-center gap-2.5 pt-0.5">
                  <span className="h-[1px] w-8 bg-gradient-to-l from-amber-300/55 to-transparent" />
                  <p className="text-[11.5px] text-slate-300/90 font-medium tracking-wide">
                    سامانه جامع مدیریت آموزشی، پژوهشی و مالی
                  </p>
                  <span className="h-[1px] w-8 bg-gradient-to-r from-amber-300/55 to-transparent" />
                </div>
              </motion.div>
            </div>

        {/* In-App PWA Install Banner on Login View */}
        <div className="mb-4">
          <PWAInstallButton variant="sidebar" />
        </div>

        {/* Maintenance Mode Active Banner */}
        {maintenanceBanner?.enabled && (
          <div className="mb-4 p-3.5 rounded-xl bg-amber-500/15 border border-amber-400/45 backdrop-blur-md text-amber-100 text-xs flex items-start gap-2.5 shadow-lg">
            <Wrench size={18} className="text-amber-300 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1 leading-relaxed">
              <div className="font-black text-amber-200">سامانه در حال تعمیر و نگهداری فنی است</div>
              <p className="text-amber-100/90 text-[11px]">{maintenanceBanner.message}</p>
              <p className="text-[10.5px] text-amber-200/80">
                در این وضعیت فقط مسئول آموزش و مدیر ارشد امکان استفاده از سامانه را دارند.
                {maintenanceBanner.estimatedDuration ? ` (زمان تقریبی: ${maintenanceBanner.estimatedDuration})` : ''}
              </p>
            </div>
          </div>
        )}

        {/* Success Toast */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.96 }}
              transition={{ duration: 0.25 }}
              className="mb-5 p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-400/45 backdrop-blur-md text-white text-xs sm:text-sm font-medium flex items-start gap-2.5 shadow-lg"
              role="alert"
            >
              <CheckCircle2 size={18} className="text-emerald-300 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed text-emerald-100">{successMessage}</div>
              <button
                type="button"
                onClick={() => setSuccessMessage(null)}
                className="text-white/60 hover:text-white transition-colors p-0.5 rounded"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Glassmorphic Error Toast Message */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.96 }}
              transition={{ duration: 0.25 }}
              className="mb-5 p-3.5 rounded-xl bg-rose-500/20 border border-rose-400/45 backdrop-blur-md text-white text-xs sm:text-sm font-medium flex items-start gap-2.5 shadow-lg"
              role="alert"
            >
              <AlertCircle size={18} className="text-rose-300 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed text-rose-100">{errorMessage}</div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-white/60 hover:text-white transition-colors p-0.5 rounded"
                title="بستن پیام"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-200 text-right">
              نام کاربری یا شناسه سازمانی
            </label>
            <div className="relative flex items-center group/input">
              <div className="absolute right-3.5 text-slate-400 group-focus-within/input:text-amber-300 transition-colors pointer-events-none flex items-center justify-center">
                <User size={18} />
              </div>
              <input
                id="login-username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="نام کاربری یا شناسه سازمانی"
                autoComplete="username"
                dir="ltr"
                disabled={isLoading || cooldownSeconds > 0}
                className="w-full py-3 pr-10 pl-4 bg-[#101c38]/85 border border-white/15 rounded-xl text-white placeholder-slate-400/70 text-sm font-medium focus:bg-[#142346] focus:border-amber-300/70 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all disabled:opacity-50 text-right"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-200 text-right">
              کلمه عبور
            </label>
            <div className="relative flex items-center group/input">
              <div className="absolute right-3.5 text-slate-400 group-focus-within/input:text-amber-300 transition-colors pointer-events-none flex items-center justify-center">
                <Lock size={18} />
              </div>
              <input
                id="login-password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="رمز عبور حساب کاربری"
                autoComplete="current-password"
                dir="ltr"
                disabled={isLoading || cooldownSeconds > 0}
                className="w-full py-3 pr-10 pl-11 bg-[#101c38]/85 border border-white/15 rounded-xl text-white placeholder-slate-400/70 text-sm font-medium focus:bg-[#142346] focus:border-amber-300/70 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all disabled:opacity-50 text-right"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute left-3 text-slate-400 hover:text-amber-200 p-1 rounded-md transition-colors cursor-pointer"
                title={showPassword ? 'مخفی‌سازی رمز عبور' : 'نمایش رمز عبور'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit Button & 1-Click Fast Login */}
          <div className="pt-2.5 space-y-2">
            <button
              id="login-submit-button"
              type="submit"
              disabled={isLoading || cooldownSeconds > 0}
              className="relative overflow-hidden w-full py-3.5 px-4 rounded-xl font-black text-slate-950 text-sm bg-gradient-to-l from-amber-400 via-amber-300 to-yellow-200 hover:from-amber-300 hover:via-amber-200 hover:to-yellow-100 active:scale-[0.99] shadow-[0_12px_30px_-8px_rgba(245,158,11,0.45)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group"
            >
              {/* Sweeping shimmer beam across primary button */}
              <span className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden rounded-xl">
                <span className="absolute top-0 bottom-0 left-0 w-32 bg-gradient-to-r from-transparent via-white/55 to-transparent skew-x-[-20deg] animate-login-shine pointer-events-none" />
              </span>

              <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/40 group-hover:ring-white/60 transition-all pointer-events-none" />

              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin text-slate-950 relative z-10" />
                  <span className="relative z-10">در حال احراز هویت و ورود...</span>
                </>
              ) : cooldownSeconds > 0 ? (
                <>
                  <Lock size={16} className="relative z-10" />
                  <span className="relative z-10">صبر فرمایید ({cooldownSeconds} ثانیه)...</span>
                </>
              ) : (
                <>
                  <LogIn size={18} className="relative z-10" />
                  <span className="relative z-10">ورود به سامانه مدیریت</span>
                </>
              )}
            </button>

            {/* Quick 1-Click Master Login for Testing (Only when ENABLE_QUICK_LOGIN is true) */}
            {import.meta.env.VITE_ENABLE_QUICK_LOGIN === 'true' && (
              <button
                type="button"
                onClick={() => {
                  const adminUser = availableUsers.find(u => u.username === 'SADEGH') || DEFAULT_USERS[0];
                  handleDirectLogin(adminUser);
                }}
                disabled={isLoading}
                className="w-full py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/40 transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.99] cursor-pointer"
              >
                <Sparkles size={14} className="text-emerald-300 animate-pulse" />
                <span>⚡ ورود سریع با یک کلیک (حالت آزمایشی - صادق)</span>
              </button>
            )}
          </div>
        </form>

        {/* Quick Presets Toggle & Drawer (Only when ENABLE_QUICK_LOGIN is true) */}
        {import.meta.env.VITE_ENABLE_QUICK_LOGIN === 'true' && (
          <div className="mt-5 pt-4 border-t border-white/15 text-center">
            <button
              type="button"
              onClick={() => setShowQuickPresets(!showQuickPresets)}
              className="inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-white transition-colors font-medium py-1.5 px-3 rounded-lg hover:bg-white/10 border border-white/10"
            >
              <Users size={14} className="text-blue-300" />
              <span>انتخاب یا ورود مستقیم با سایر نقش‌ها و اساتید</span>
              <ChevronDown
                size={13}
                className={`transition-transform duration-200 ${showQuickPresets ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Collapsible Quick Users Drawer */}
            <AnimatePresence>
              {showQuickPresets && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden mt-3 text-right bg-black/40 rounded-xl p-3 border border-white/15 space-y-2.5"
                >
                  <div className="flex items-center justify-around border-b border-white/10 pb-2 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setSelectedLevelTab(1)}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        selectedLevelTab === 1 ? 'bg-indigo-600 text-white' : 'text-white/60 hover:text-white'
                      }`}
                    >
                      سطح ۱ (مدیریت کل)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedLevelTab(2)}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        selectedLevelTab === 2 ? 'bg-indigo-600 text-white' : 'text-white/60 hover:text-white'
                      }`}
                    >
                      سطح ۲ (آموزش و مالی)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedLevelTab(3)}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        selectedLevelTab === 3 ? 'bg-indigo-600 text-white' : 'text-white/60 hover:text-white'
                      }`}
                    >
                      سطح ۳ (اساتید)
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {filteredUsers.map((u) => (
                      <div
                        key={u.id || u.username}
                        className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/15 border border-white/5 transition-all text-xs text-white/90 text-right group"
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectPreset(u)}
                          className="flex-1 flex items-center gap-2 text-right cursor-pointer"
                          title="انتخاب نام کاربری و رمز"
                        >
                          <span className="w-6 h-6 rounded-md bg-indigo-500/30 text-indigo-200 flex items-center justify-center font-mono text-[10px] font-bold">
                            {u.username.substring(0, 3)}
                          </span>
                          <span className="font-medium group-hover:text-white">{u.name}</span>
                          {u.roleTitle && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/10 text-white/70">
                              {u.roleTitle}
                            </span>
                          )}
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDirectLogin(u)}
                            disabled={isLoading}
                            className="px-2 py-1 rounded-md bg-emerald-600/80 hover:bg-emerald-600 text-white text-[10px] font-bold transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1"
                            title="ورود مستقیم و فوری با این کاربر"
                          >
                            <LogIn size={11} />
                            <span>ورود فوری</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Footer credits */}
        <div className="mt-5 text-center text-[11px] text-white/50 flex items-center justify-center gap-1.5">
          <Sparkles size={12} className="text-amber-300" />
          <span>نسخه ۵.۲.۰ • ارتباط امن و رمزنگاری داده‌ها</span>
        </div>
          </motion.div>
        </div>
      </div>

      {/* 2-Step PIN Verification Modal (ورود دو مرحله‌ای با پین ۴ رقمی) */}
      <AnimatePresence>
        {showPinPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              className="w-full max-w-md bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden font-vazir"
            >
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
              
              <div className="text-center space-y-3 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 mx-auto flex items-center justify-center shadow-lg">
                  <ShieldCheck size={32} className="animate-pulse text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">تایید هویت دو مرحله‌ای (پین امنیتی)</h3>
                  <p className="text-xs text-slate-300 mt-1">
                    این حساب دارای سطح امنیتی بالاست. لطفاً رمز پین ۴ رقمی خود را وارد فرمایید:
                  </p>
                </div>
              </div>

              {pinErrorMessage && (
                <div className="mb-4 p-3 bg-rose-500/20 border border-rose-400/40 rounded-xl text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0 text-rose-300" />
                  <span>{pinErrorMessage}</span>
                </div>
              )}

              <form onSubmit={handlePinSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 text-right">
                    کد پین ۴ رقمی حساب کاربری:
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="password"
                      maxLength={4}
                      value={pinInputValue}
                      onChange={(e) => setPinInputValue(e.target.value.replace(/\D/g, ''))}
                      placeholder="۴۷۴۲"
                      disabled={isLoading}
                      autoFocus
                      className="w-full py-3.5 px-4 bg-white/10 border border-white/20 rounded-2xl text-center text-2xl tracking-[0.5em] font-mono text-white placeholder-white/30 focus:border-indigo-400 focus:bg-white/15 outline-none transition-all disabled:opacity-50"
                    />
                    <KeyRound size={20} className="absolute right-3.5 text-indigo-400 pointer-events-none" />
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <button
                    type="submit"
                    disabled={isLoading || pinInputValue.length !== 4}
                    className="w-full py-3.5 px-4 rounded-2xl font-black text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={18} className="animate-spin text-white" />
                        <span>در حال بررسی پین...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        <span>ورود به سامانه</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowPinPrompt(false);
                      setIsLoading(false);
                    }}
                    className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    انصراف
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
