import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth, DEFAULT_USERS } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
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
  Check
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

  // Preview mode for desktop to view background image without form
  const [hideFormForPreview, setHideFormForPreview] = useState(false);

  // Screen size detection: Mobile (< 768px) vs Desktop/Laptop (>= 768px)
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth < 768);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Primary Official School Image for Desktop / Laptop
  const [currentBgUrl, setCurrentBgUrl] = useState<string>('/000.webp');
  const [imageLoaded, setImageLoaded] = useState(false);

  // Preload desktop background image asynchronously and clean any stale localStorage
  useEffect(() => {
    try {
      localStorage.removeItem('custom_login_bg');
      localStorage.removeItem('custom_mobile_bg');
    } catch {}

    const timer = setTimeout(() => {
      const imgDesktop = new Image();
      imgDesktop.src = '/000.webp';
      imgDesktop.onload = () => {
        setImageLoaded(true);
      };
      imgDesktop.onerror = () => {
        const fallbackImg = new Image();
        fallbackImg.src = '/000-mobile.webp';
        fallbackImg.onload = () => {
          setCurrentBgUrl('/000-mobile.webp');
          setImageLoaded(true);
        };
        fallbackImg.onerror = () => {
          setImageLoaded(true);
        };
      };
    }, 50);

    return () => clearTimeout(timer);
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
      // 1. Supabase Auth check if email is provided
      if (cleanUser.includes('@')) {
        try {
          const { error: sbError } = await supabase.auth.signInWithPassword({
            email: cleanUser,
            password: cleanPass
          });
          if (sbError) {
            console.warn('Supabase auth notice:', sbError.message);
          }
        } catch (sbErr) {
          console.warn('Supabase auth call skipped or error:', sbErr);
        }
      }

      // 2. Perform robust application login
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
      className="relative min-h-screen w-full flex items-center justify-center p-3 sm:p-6 overflow-hidden font-vazir bg-slate-950 select-none"
      onClick={() => {
        if (hideFormForPreview) {
          setHideFormForPreview(false);
        }
      }}
    >
      {/* 1. Desktop / Laptop: Full-Screen Background Image (100% Uncropped, 100% Complete) */}
      <div className="hidden md:block absolute inset-0 w-full h-full pointer-events-none overflow-hidden bg-slate-950">
        {/* Ambient blurred backdrop covering the widescreen edges */}
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-center filter blur-3xl scale-110 opacity-35"
          style={{ backgroundImage: `url('/000.webp')` }}
        />

        {/* Crisp, 100% Complete Uncropped Photo showcasing the school and both scholars */}
        <div
          className="absolute inset-0 w-full h-full bg-contain bg-center md:bg-[position:22%_center] bg-no-repeat transition-all duration-700"
          style={{
            backgroundImage: `url('/000.webp')`,
            opacity: imageLoaded ? 1 : 0
          }}
        />

        {/* Vignette gradient towards right side where the login card lives */}
        <div className="absolute inset-0 bg-gradient-to-l from-slate-950/85 via-slate-950/25 to-transparent pointer-events-none" />
      </div>

      {/* 2. Atmospheric ambient lighting effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 3. Desktop-only discrete full image preview toggle */}
      <div className="hidden md:block absolute top-4 left-4 z-20">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setHideFormForPreview(!hideFormForPreview);
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/45 hover:bg-black/65 text-white/80 hover:text-white border border-white/20 backdrop-blur-md text-xs font-medium transition-all shadow-lg active:scale-95 cursor-pointer"
          title={hideFormForPreview ? 'بازگشت به فرم ورود' : 'مشاهده تصویر تمام‌صفحه'}
        >
          <Eye size={14} className="text-emerald-300" />
          <span>{hideFormForPreview ? 'بازگشت به فرم ورود' : 'مشاهده تصویر تمام‌صفحه'}</span>
        </button>
      </div>

      {/* 4. Main Responsive Content: Positioned on the right on widescreen so the photo on the left is 100% visible */}
      <div className="relative z-10 w-full max-w-7xl mx-auto min-h-screen flex items-center justify-center md:justify-end px-4 sm:px-8 lg:px-20 py-8">
        {/* Glow halo & Illuminated Outer Neon Border around the login box */}
        <div className="relative group/card w-full max-w-md my-auto">
          {/* Animated Neon/Cyan-Indigo Glow Aura around the card */}
          <div className="absolute -inset-1.5 rounded-[32px] bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 opacity-70 blur-xl animate-border-glow group-hover/card:opacity-100 group-hover/card:blur-2xl transition-all duration-700 pointer-events-none" />

          {/* Secondary crystal gradient line border */}
          <div className="absolute -inset-[1px] rounded-[28px] bg-gradient-to-r from-blue-400/80 via-indigo-400/60 to-cyan-400/80 opacity-80 pointer-events-none" />

          {/* The Login Glassmorphic Window */}
          <motion.div
            id="login-glass-card"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ 
              opacity: hideFormForPreview ? 0 : 1, 
              scale: hideFormForPreview ? 0.90 : 1, 
              y: hideFormForPreview ? 30 : 0,
              pointerEvents: hideFormForPreview ? 'none' : 'auto'
            }}
            whileHover={{
              scale: 1.025,
              y: -6,
              transition: { type: "spring", stiffness: 350, damping: 20 }
            }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className={cn(
              "relative z-10 w-full rounded-[26px] bg-slate-950/85 sm:bg-slate-900/85 backdrop-blur-2xl border border-white/20 p-5 sm:p-8 text-white shadow-2xl overflow-hidden transition-all duration-300",
              isMobile ? "my-auto mx-auto max-h-[92vh] overflow-y-auto" : "my-auto"
            )}
          >
            {/* Sweeping Shimmer Sheen across the entire card */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[26px]">
              <div className="absolute top-0 bottom-0 left-0 w-48 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-25deg] animate-card-shine pointer-events-none" />
            </div>

            {/* Top Edge Prism Reflection with breathing pulse */}
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-300 to-transparent pointer-events-none animate-pulse" />

            {/* Subtle Corner Ambient Accents */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* Header: Seminary identity & Logo */}
        <div className="text-center space-y-2.5 mb-5">
          {/* Emblem Icon */}
          <div className="flex justify-center mb-1">
            <img 
              src="/pwa-192x192.png" 
              alt="سامانه جامع طلاب" 
              className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl shadow-2xl ring-2 ring-amber-400/40 hover:scale-105 transition-all duration-300 object-cover" 
            />
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-sm">
              مدرسه تخصصی فقه امام کاظم (ع)
            </h1>
            <p className="text-xs text-white/70 mt-1 font-medium leading-relaxed">
              تحت اشراف حضرت آیت‌الله العظمی مکارم شیرازی
            </p>
            <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-white/10 rounded-full border border-white/20 text-[11px] text-white/80 font-medium">
              <ShieldCheck size={13} className="text-blue-300" />
              <span>سامانه جامع مدیریت آموزشی، پژوهشی و مالی</span>
            </div>
          </div>
        </div>

        {/* In-App PWA Install Banner on Login View */}
        <div className="mb-4">
          <PWAInstallButton variant="sidebar" />
        </div>

        {/* Success Toast */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.96 }}
              transition={{ duration: 0.25 }}
              className="mb-5 p-3.5 rounded-xl bg-emerald-500/25 border border-emerald-400/50 backdrop-blur-md text-white text-xs sm:text-sm font-medium flex items-start gap-2.5 shadow-lg"
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
              className="mb-5 p-3.5 rounded-xl bg-rose-500/25 border border-rose-400/50 backdrop-blur-md text-white text-xs sm:text-sm font-medium flex items-start gap-2.5 shadow-lg"
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
            <label className="block text-xs font-semibold text-white/90 text-right">
              نام کاربری یا شناسه سازمانی
            </label>
            <div className="relative flex items-center">
              <div className="absolute right-3.5 text-white/60 pointer-events-none flex items-center justify-center">
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
                className="w-full py-3 pr-10 pl-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 text-sm font-medium focus:bg-white/20 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all disabled:opacity-50 text-right"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-white/90 text-right">
              کلمه عبور
            </label>
            <div className="relative flex items-center">
              <div className="absolute right-3.5 text-white/60 pointer-events-none flex items-center justify-center">
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
                className="w-full py-3 pr-10 pl-11 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 text-sm font-medium focus:bg-white/20 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all disabled:opacity-50 text-right"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute left-3 text-white/60 hover:text-white p-1 rounded-md transition-colors"
                title={showPassword ? 'مخفی‌سازی رمز عبور' : 'نمایش رمز عبور'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit Button & 1-Click Fast Login */}
          <div className="pt-2 space-y-2">
            <button
              id="login-submit-button"
              type="submit"
              disabled={isLoading || cooldownSeconds > 0}
              className="relative overflow-hidden w-full py-3.5 px-4 rounded-xl font-bold text-white text-sm bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] shadow-lg shadow-indigo-600/35 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group"
            >
              {/* Sweeping dynamic shimmer beam that travels periodically across button */}
              <span className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden rounded-xl">
                <span className="absolute top-0 bottom-0 left-0 w-32 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg] animate-login-shine pointer-events-none" />
              </span>

              {/* Gentle breathing glow border */}
              <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/30 group-hover:ring-white/50 transition-all pointer-events-none" />

              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin text-white relative z-10" />
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
                className="w-full py-2.5 px-3 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-400/40 transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.99] cursor-pointer"
              >
                <Sparkles size={14} className="text-amber-300 animate-pulse" />
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

      {/* Gentle helper message in preview mode */}
      <AnimatePresence>
        {hideFormForPreview && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={(e) => {
              e.stopPropagation();
              setHideFormForPreview(false);
            }}
            className="absolute bottom-10 z-30 px-6 py-3.5 rounded-2xl bg-black/75 border border-white/20 backdrop-blur-xl text-white text-xs font-bold text-center cursor-pointer shadow-2xl flex items-center gap-2 hover:bg-black/90 active:scale-95 transition-all"
          >
            <Sparkles size={16} className="text-amber-400 shrink-0" />
            <span>جهت بازگشت به فرم ورود، اینجا را لمس کنید یا کلیک نمایید.</span>
          </motion.div>
        )}
      </AnimatePresence>

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
