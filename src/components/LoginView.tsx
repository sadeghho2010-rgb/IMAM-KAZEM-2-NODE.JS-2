import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Sparkles, 
  LogIn, 
  AlertCircle, 
  GraduationCap, 
  Layers, 
  CheckCircle2,
  BookOpen,
  Users,
  ChevronRight,
  KeyRound
} from 'lucide-react';
import { cn } from '../lib/utils';
import { AppUser } from '../types/auth';

interface LoginViewProps {
  onLoginSuccess?: () => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const { login, users } = useAuth();

  const [username, setUsername] = useState('SADEGH');
  const [password, setPassword] = useState('8411924');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedLevelTab, setSelectedLevelTab] = useState<1 | 2 | 3>(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    setTimeout(() => {
      const result = login(username, password);
      setIsLoading(false);

      if (result.success) {
        if (onLoginSuccess) onLoginSuccess();
      } else {
        setErrorMessage(result.message || (result as any).error || 'خطا در ورود به سامانه.');
      }
    }, 350);
  };

  const handleSelectQuickUser = (user: AppUser) => {
    setUsername(user.username);
    setPassword(user.password || '8411924');
    setErrorMessage(null);
  };

  // Filter users by Level for quick selection
  const levelUsers = users.filter(u => u.level === selectedLevelTab);

  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-vazir bg-slate-950 text-slate-100"
      dir="rtl"
    >
      {/* Dynamic Animated Ambient Background Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Deep mesh gradient */}
        <div className="absolute -top-[25%] -right-[15%] w-[650px] h-[650px] bg-indigo-600/25 rounded-full blur-[140px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute -bottom-[20%] -left-[15%] w-[600px] h-[600px] bg-emerald-600/20 rounded-full blur-[130px] animate-pulse" style={{ animationDuration: '11s' }} />
        <div className="absolute top-[40%] left-[30%] w-[450px] h-[450px] bg-amber-500/15 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '9s' }} />
        
        {/* Subtle grid line overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" 
        />
      </div>

      <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch relative z-10">
        
        {/* Left / Top Hero Info Column (SRS 2.0 Overview) */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-8 rounded-3xl backdrop-blur-2xl bg-white/[0.04] border border-white/10 shadow-2xl relative overflow-hidden"
        >
          {/* Subtle Accent Light */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

          <div className="space-y-6">
            {/* Header / Logo */}
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 border border-white/20 shrink-0">
                <GraduationCap size={26} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">مدیریت جامع طلاب</h1>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                    نسخه ۲.۰
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium mt-0.5">سامانه یکپارچه آموزشی، پژوهشی و تربیتی</p>
              </div>
            </div>

            {/* SRS 2.0 Core Architecture Highlights */}
            <div className="space-y-3 pt-2">
              <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-400" />
                <span>ساختار دسترسی سه‌سطحی (Role + Scope):</span>
              </div>

              <div className="space-y-2">
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-start gap-3 hover:bg-white/[0.06] transition-colors">
                  <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    ۱
                  </div>
                  <div className="text-xs leading-relaxed">
                    <span className="font-bold text-indigo-300">سطح ۱ (ستاد و مدیریت ارشد): </span>
                    <span className="text-slate-400">سوپر ادمین (اختیارات کامل و تعریف کاربران)، مدیر و معاون (نظارت کامل بدون ویرایش)</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-start gap-3 hover:bg-white/[0.06] transition-colors">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    ۲
                  </div>
                  <div className="text-xs leading-relaxed">
                    <span className="font-bold text-emerald-300">سطح ۲ (مسئولین آموزش، پژوهش و پایه‌ها): </span>
                    <span className="text-slate-400">منوی تخصصی آموزشی، پژوهشی و مسئولین پایه‌های ۷، ۸، ۹ و ۱۰ بر اساس حوزه دسترسی</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-start gap-3 hover:bg-white/[0.06] transition-colors">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    ۳
                  </div>
                  <div className="text-xs leading-relaxed">
                    <span className="font-bold text-cyan-300">سطح ۳ (طلاب و نمایندگان کلاس): </span>
                    <span className="text-slate-400">مشاهده پرونده، ساعات مطالعه، حضور و غیاب، برنامه درسی و ثبت کلاسی</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* System Footer Note */}
          <div className="pt-6 mt-6 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>پایگاه داده آفلاین محلی و ابری آماده</span>
            </div>
            <span className="text-slate-500 font-mono">SRS v2.0 ERP</span>
          </div>
        </motion.div>

        {/* Right / Main Glassmorphism Form Column */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-7 flex flex-col justify-between p-6 sm:p-10 rounded-3xl backdrop-blur-3xl bg-white/[0.07] border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden"
        >
          {/* Glass Specular Reflection Highlight */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          <div>
            {/* Form Title */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  <LogIn size={22} className="text-indigo-400" />
                  <span>ورود به سامانه</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">نام کاربری و رمز عبور اختصاصی خود را وارد نمایید</p>
              </div>

              <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                <KeyRound size={13} className="text-amber-400" />
                <span>رمز پیش‌فرض تستی: <strong className="text-amber-300 font-mono">8411924</strong></span>
              </div>
            </div>

            {/* Error Notification */}
            <AnimatePresence>
              {errorMessage && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-5 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2.5"
                >
                  <AlertCircle size={16} className="text-rose-400 shrink-0" />
                  <span>{errorMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  نام کاربری (انگلیسی / حروف بزرگ یا کوچک)
                </label>
                <div className="relative">
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="مثال: SADEGH ، SHAH ، HAYATI ، JALILI"
                    className="w-full bg-slate-900/60 border border-white/15 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30 rounded-2xl pr-10 pl-4 py-3 text-sm text-white placeholder-slate-500 transition-all font-mono tracking-wide"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 block">
                    رمز عبور
                  </label>
                  <span className="text-[11px] text-slate-400 sm:hidden">
                    رمز: <strong className="text-amber-300 font-mono">8411924</strong>
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-900/60 border border-white/15 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30 rounded-2xl pr-10 pl-11 py-3 text-sm text-white placeholder-slate-500 transition-all font-mono tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 active:scale-[0.99] text-white font-bold text-sm shadow-lg shadow-indigo-600/30 border border-indigo-400/30 transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>ورود به پنل مدیریت</span>
                    <ChevronRight size={18} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Quick Switcher / Role Selector for Test Users */}
          <div className="mt-8 pt-6 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                <Layers size={14} className="text-indigo-400" />
                <span>انتخاب سریع حساب‌های کاربری پیش‌فرض (تستی):</span>
              </div>
            </div>

            {/* Level Tabs (سطح ۱، ۲، ۳) */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-black/30 rounded-2xl border border-white/5">
              <button
                type="button"
                onClick={() => setSelectedLevelTab(1)}
                className={cn(
                  "py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                  selectedLevelTab === 1 
                    ? "bg-indigo-600 text-white shadow-sm" 
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                <span>سطح ۱ (مدیران ارشد)</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedLevelTab(2)}
                className={cn(
                  "py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                  selectedLevelTab === 2 
                    ? "bg-emerald-600 text-white shadow-sm" 
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                <span>سطح ۲ (مسئولین و پایه‌ها)</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedLevelTab(3)}
                className={cn(
                  "py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                  selectedLevelTab === 3 
                    ? "bg-cyan-600 text-white shadow-sm" 
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                <span>سطح ۳ (طلاب و نمایندگان)</span>
              </button>
            </div>

            {/* Users in selected level */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-0.5">
              {levelUsers.map((u) => {
                const isSelected = username.toUpperCase() === u.username.toUpperCase();
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectQuickUser(u)}
                    className={cn(
                      "p-2 rounded-xl border text-right transition-all flex flex-col justify-between group",
                      isSelected
                        ? "bg-indigo-600/30 border-indigo-400 text-white"
                        : "bg-white/[0.03] hover:bg-white/[0.08] border-white/5 text-slate-300"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-mono font-black text-xs text-indigo-300 group-hover:text-indigo-200">
                        {u.username}
                      </span>
                      {isSelected && <CheckCircle2 size={13} className="text-emerald-400" />}
                    </div>
                    <div className="mt-1">
                      <p className="text-[11px] font-bold text-slate-200 truncate">{u.fullName.split('(')[0]}</p>
                      <p className="text-[10px] text-slate-400 truncate">{u.roleTitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
