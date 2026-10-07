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
  Image as ImageIcon,
  UploadCloud,
  Check,
  Monitor,
  Smartphone,
  RotateCcw
} from 'lucide-react';
import { AppUser } from '../../types/auth';
import { Teacher } from '../../types';
import { localDb } from '../../lib/localDb';
import { cn } from '../../lib/utils';
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

  // Load teachers from database whenever quick presets drawer is used
  useEffect(() => {
    localDb.getDocs<Teacher>('teachers').then(tList => {
      if (Array.isArray(tList) && tList.length > 0) {
        setBankTeachers(tList);
      }
    }).catch(() => {});
  }, [showQuickPresets]);

  // Mobile preview mode for viewing background image without form
  const [hideFormForPreview, setHideFormForPreview] = useState(false);

  // Screen orientation / Mobile portrait detection
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window !== 'undefined') {
        const isPortrait = window.innerHeight > window.innerWidth && window.innerWidth < 768;
        setIsMobilePortrait(isPortrait);
      }
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // Primary Background Images
  const [currentBgUrl, setCurrentBgUrl] = useState<string>('/000.webp');
  const [customMobileBg, setCustomMobileBg] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<'desktop' | 'mobile'>('desktop');
  const [showBgSettingsModal, setShowBgSettingsModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preload images asynchronously after initial form render
  useEffect(() => {
    try {
      const savedMobile = localStorage.getItem('custom_mobile_bg');
      if (savedMobile) setCustomMobileBg(savedMobile);

      const savedDesktop = localStorage.getItem('custom_login_bg');
      if (savedDesktop) setCurrentBgUrl(savedDesktop);
    } catch {}

    const timer = setTimeout(() => {
      const imgDesktop = new Image();
      imgDesktop.src = '/000.webp';
      imgDesktop.onload = () => {
        setImageLoaded(true);
      };
      imgDesktop.onerror = () => {
        setImageLoaded(true);
      };

      const imgMobile = new Image();
      imgMobile.src = '/000-mobile.webp';
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

  // Handle direct file upload for background (desktop or mobile)
  const handleBgFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingBg(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;

      if (uploadTarget === 'mobile') {
        setCustomMobileBg(base64);
        localStorage.setItem('custom_mobile_bg', base64);
      } else {
        setCurrentBgUrl(base64);
        localStorage.setItem('custom_login_bg', base64);
      }
      setImageLoaded(true);

      // Save to server
      try {
        await fetch('/api/upload-login-bg', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            imageBase64: base64,
            target: uploadTarget 
          })
        });
      } catch (err) {
        console.warn('Could not persist to server disk, kept in browser cache:', err);
      }

      setIsUploadingBg(false);
      setShowBgSettingsModal(false);
      setSuccessMessage(
        uploadTarget === 'mobile'
          ? 'عکس عمودی مخصوص صفحه گوشی (موبایل) با موفقیت ذخیره و اعمال گردید.'
          : 'عکس افقی مخصوص صفحه دسکتاپ با موفقیت ذخیره و اعمال گردید.'
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    };
    reader.readAsDataURL(file);
  };

  // Reset to default school images
  const handleResetToDefaultImages = () => {
    try {
      localStorage.removeItem('custom_login_bg');
      localStorage.removeItem('custom_mobile_bg');
    } catch {}
    setCurrentBgUrl('/000.webp');
    setCustomMobileBg(null);
    setShowBgSettingsModal(false);
    setSuccessMessage('تصاویر پس‌زمینه به حالت پیش‌فرض مدرسه (000.webp و 000-mobile.webp) بازگردانی شدند.');
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Determine active background image URL
  const effectiveBgUrl = isMobilePortrait 
    ? (customMobileBg || '/000-mobile.webp') 
    : currentBgUrl;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cooldownSeconds > 0) {
      setErrorMessage(`لطفاً تا اتمام زمان تأمل (${cooldownSeconds} ثانیه دیگر) شکیبا باشید.`);
      return;
    }

    const cleanUser = username.trim();
    const cleanPass = password.trim();

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
        setShowChangePasswordModal(true);
        setErrorMessage('جهت حفظ امنیت سامانه، تغییر رمز عبور در اولین ورود الزامی است.');
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
      className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden font-vazir bg-slate-900 select-none cursor-pointer"
      onClick={() => {
        if (hideFormForPreview) {
          setHideFormForPreview(false);
        }
      }}
    >
      {/* Hidden file input for uploading the exact background image */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleBgFileSelect}
        className="hidden"
      />

      {/* 1. Full Screen Background Image with Cover & Center */}
      <div
        id="login-bg-container"
        className="absolute inset-0 w-full h-full bg-slate-900 transition-opacity duration-1000 ease-out"
        style={{
          backgroundImage: `url(${effectiveBgUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: isMobilePortrait ? 'center top' : 'center center',
          backgroundRepeat: 'no-repeat',
          opacity: imageLoaded ? 1 : 0
        }}
      />

      {/* Dark semi-transparent overlay to ensure contrast and readability */}
      <div
        id="login-bg-overlay"
        className={cn(
          "absolute inset-0 transition-all duration-500 pointer-events-none",
          hideFormForPreview 
            ? "bg-black/10 backdrop-brightness-[0.95]" 
            : isMobilePortrait 
            ? "bg-black/35 backdrop-brightness-[0.85]" 
            : "bg-black/40 backdrop-brightness-[0.8] backdrop-saturate-[1.1]"
        )}
      />

      {/* Atmospheric ambient lighting effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-10 right-10 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Discreet floating button in top-left (desktop) or top bar (mobile) to select/upload background or preview it */}
      {!isMobilePortrait ? (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowBgSettingsModal(true);
            }}
            disabled={isUploadingBg}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 text-white/80 hover:text-white border border-white/20 backdrop-blur-md text-xs font-medium transition-all shadow-lg active:scale-95 cursor-pointer"
            title="مدیریت و بارگذاری عکس زمینه دسکتاپ و موبایل"
          >
            {isUploadingBg ? (
              <Loader2 size={14} className="animate-spin text-blue-400" />
            ) : (
              <ImageIcon size={14} className="text-blue-300" />
            )}
            <span>تنظیمات عکس پس‌زمینه</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setHideFormForPreview(true);
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 text-white/80 hover:text-white border border-white/20 backdrop-blur-md text-xs font-medium transition-all shadow-lg active:scale-95 cursor-pointer"
            title="مشاهده کامل و تمام صفحه عکس پس‌زمینه"
          >
            <Eye size={14} className="text-emerald-300" />
            <span>مشاهده کامل عکس</span>
          </button>
        </div>
      ) : !hideFormForPreview ? (
        /* Mobile Top Bar to ensure user can always see photo and control view */
        <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowBgSettingsModal(true);
            }}
            className="px-2.5 py-1 rounded-xl bg-black/45 hover:bg-black/65 text-white/90 border border-white/20 backdrop-blur-md text-[11px] font-bold flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
          >
            <ImageIcon size={13} className="text-blue-300" />
            <span>تنظیمات عکس</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setHideFormForPreview(true);
            }}
            className="px-3 py-1 rounded-xl bg-emerald-600/85 hover:bg-emerald-600 text-white border border-emerald-400/50 backdrop-blur-md text-[11px] font-bold flex items-center gap-1.5 shadow-md animate-pulse active:scale-95 cursor-pointer"
          >
            <Eye size={13} />
            <span>دیدن کامل عکس ساختمان</span>
          </button>
        </div>
      ) : null}

      {/* 2. Glassmorphic Login Window (Center aligned) */}
      <motion.div
        id="login-glass-card"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ 
          opacity: hideFormForPreview ? 0 : 1, 
          scale: hideFormForPreview ? 0.90 : 1, 
          y: hideFormForPreview ? 30 : 0,
          pointerEvents: hideFormForPreview ? 'none' : 'auto'
        }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        className={cn(
          "relative z-10 w-full max-w-md rounded-3xl bg-white/10 sm:bg-white/15 backdrop-blur-[8px] sm:backdrop-blur-xl border border-white/25 sm:border-white/30 shadow-2xl p-5 sm:p-8 text-white transition-all duration-300",
          isMobilePortrait ? "mt-auto mb-2 mx-auto max-h-[85vh] overflow-y-auto" : "my-auto mx-4"
        )}
      >
        {/* Top subtle highlight reflection */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent rounded-t-2xl pointer-events-none" />

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
                placeholder="مثال: SADEGH یا SHAH"
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
              className="w-full py-3.5 px-4 rounded-xl font-bold text-white text-sm bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 active:scale-[0.99] shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin text-white" />
                  <span>در حال احراز هویت و ورود...</span>
                </>
              ) : cooldownSeconds > 0 ? (
                <>
                  <Lock size={16} />
                  <span>صبر فرمایید ({cooldownSeconds} ثانیه)...</span>
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>ورود به سامانه مدیریت</span>
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

      {/* Background Settings Modal (Desktop & Mobile customization) */}
      <AnimatePresence>
        {showBgSettingsModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            onClick={(e) => {
              e.stopPropagation();
              setShowBgSettingsModal(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-white/20 rounded-3xl p-6 w-full max-w-md shadow-2xl text-white space-y-5"
              dir="rtl"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                    <ImageIcon size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">تنظیمات تصاویر پس‌زمینه ورود</h3>
                    <p className="text-[11px] text-white/60">تفکیک عکس برای صفحه عریض (دسکتاپ) و عمودی (موبایل)</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowBgSettingsModal(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Notice */}
              <div className="p-3 bg-blue-500/15 border border-blue-400/30 rounded-2xl text-[11px] leading-relaxed text-blue-200">
                در صفحه عمودی موبایل به دلیل کشیدگی تصویر، می‌توانید <strong>عکس عمودی اختصاصی</strong> آپلود کنید یا اجازه دهید سامانه به طور خودکار نسخه متناسب‌سازی شده عمودی (000-mobile.webp) را نمایش دهد.
              </div>

              {/* Target Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/80 block">انتخاب جهت آپلود تصویر جدید:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUploadTarget('desktop')}
                    className={cn(
                      "p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-2 transition-all cursor-pointer",
                      uploadTarget === 'desktop'
                        ? "bg-indigo-600/40 border-indigo-400 text-white shadow-md shadow-indigo-600/20"
                        : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                    )}
                  >
                    <Monitor size={22} className={uploadTarget === 'desktop' ? 'text-indigo-300' : 'text-white/50'} />
                    <span>عکس دسکتاپ (افقی ۱۶:۹)</span>
                    <span className="text-[10px] text-white/50">فایل 000.webp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUploadTarget('mobile')}
                    className={cn(
                      "p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-2 transition-all cursor-pointer",
                      uploadTarget === 'mobile'
                        ? "bg-indigo-600/40 border-indigo-400 text-white shadow-md shadow-indigo-600/20"
                        : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                    )}
                  >
                    <Smartphone size={22} className={uploadTarget === 'mobile' ? 'text-indigo-300' : 'text-white/50'} />
                    <span>عکس موبایل (عمودی ۹:۱۶)</span>
                    <span className="text-[10px] text-white/50">فایل 000-mobile.webp</span>
                  </button>
                </div>
              </div>

              {/* Upload Trigger Button */}
              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingBg}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-xs font-black shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                >
                  {isUploadingBg ? (
                    <Loader2 size={16} className="animate-spin text-white" />
                  ) : (
                    <UploadCloud size={16} />
                  )}
                  <span>
                    بارگذاری عکس جدید برای {uploadTarget === 'mobile' ? 'گوشی همراه (عمودی)' : 'رایانه و لپ‌تاپ (افقی)'}
                  </span>
                </button>
              </div>

              {/* Actions Footer */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleResetToDefaultImages}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>بازنشانی به تصاویر پیش‌فرض مدرسه</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowBgSettingsModal(false);
                    setHideFormForPreview(true);
                  }}
                  className="px-3 py-2 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-400/30 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye size={13} />
                  <span>پیش‌نمایش تمام‌صفحه</span>
                </button>
              </div>
            </motion.div>
          </div>
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
