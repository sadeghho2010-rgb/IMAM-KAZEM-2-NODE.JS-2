import React, { useState } from 'react';
import { useAuth, DEFAULT_USERS } from '../../context/AuthContext';
import { 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  LogIn, 
  ShieldCheck, 
  Sparkles, 
  KeyRound, 
  AlertCircle,
  GraduationCap,
  BookOpen,
  UserCheck,
  ChevronLeft,
  School,
  CheckCircle2,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { AppUser } from '../../types/auth';

export default function LoginPage() {
  const { login, users } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activePresetTab, setActivePresetTab] = useState<1 | 2 | 3>(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      const res = login(username, password);
      if (!res.success) {
        setError(res.message || 'خطا در ورود به سامانه');
        setIsLoading(false);
      }
    }, 300);
  };

  const handleQuickLogin = (user: AppUser) => {
    setUsername(user.username);
    setPassword(user.password || '8411924');
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      login(user.username, user.password || '8411924');
    }, 250);
  };

  const level1Users = (users.length ? users : DEFAULT_USERS).filter(u => u.level === 1);
  const level2Users = (users.length ? users : DEFAULT_USERS).filter(u => u.level === 2);
  const level3Users = (users.length ? users : DEFAULT_USERS).filter(u => u.level === 3);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-vazir select-none" dir="rtl">
      {/* Background Animated Gradient Mesh & Glass Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Large atmospheric glowing orbs */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-600/25 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '12s' }} />
        
        {/* Subtle geometric grid background */}
        <div 
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }}
        />
      </div>

      <div className="w-full max-w-5xl z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        
        {/* Left/Main Column: Glassmorphic Login Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-6 w-full max-w-md mx-auto"
        >
          <div className="relative rounded-3xl p-7 sm:p-9 backdrop-blur-2xl bg-white/[0.88] border border-white/60 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] overflow-hidden">
            
            {/* Top Glowing Accent Line */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />

            {/* Brand Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white shadow-lg shadow-indigo-600/30 mb-3.5 border border-indigo-400/30">
                <School size={28} className="text-indigo-50" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                سامانه جامع طلاب پایه
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-1">
                پرتال ورود با تفکیک سطوح دسترسی (۱، ۲ و ۳)
              </p>
            </div>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 font-bold"
                >
                  <AlertCircle size={16} className="text-rose-500 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  نام کاربری (انگلیسی)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="مثال: SADEGH یا SHAH یا JALILI"
                    required
                    dir="ltr"
                    className="w-full pl-3.5 pr-10 py-3 bg-white/70 backdrop-blur-sm border border-slate-200/90 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-right uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رمز عبور
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="رمز عبور شما"
                    required
                    dir="ltr"
                    className="w-full pl-10 pr-10 py-3 bg-white/70 backdrop-blur-sm border border-slate-200/90 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-right"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span>مرا به خاطر بسپار</span>
                </label>
                <span className="text-[11px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-lg">
                  رمز پیش‌فرض: 8411924
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 active:scale-[0.99] text-white text-sm font-black rounded-2xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn size={18} />
                    <span>ورود به سامانه</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-200/60 text-center">
              <p className="text-[11px] text-slate-400 font-medium">
                سیستم جامع مدیریت آموزشی، پژوهشی و تربیتی • نسخه ۲.۰
              </p>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Interactive Quick-Login User Switcher for Testing */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-6 space-y-4"
        >
          <div className="backdrop-blur-2xl bg-slate-900/70 border border-white/10 rounded-3xl p-6 shadow-2xl text-white">
            
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <KeyRound size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">ورود سریع آزمایشی</h3>
                  <p className="text-[10px] text-slate-400">انتخاب هر کاربر برای تست آنی منو و سطح دسترسی</p>
                </div>
              </div>

              {/* Level Selector Tabs */}
              <div className="flex bg-slate-800/80 p-1 rounded-xl border border-white/5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setActivePresetTab(1)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition-all",
                    activePresetTab === 1 ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                  )}
                >
                  سطح ۱ (مدیریت)
                </button>
                <button
                  type="button"
                  onClick={() => setActivePresetTab(2)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition-all",
                    activePresetTab === 2 ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                  )}
                >
                  سطح ۲ (مسئولین)
                </button>
                <button
                  type="button"
                  onClick={() => setActivePresetTab(3)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition-all",
                    activePresetTab === 3 ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                  )}
                >
                  سطح ۳ (طلاب)
                </button>
              </div>
            </div>

            {/* User Cards Grid based on active level */}
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
              {activePresetTab === 1 && (
                <div className="space-y-2">
                  <div className="text-[11px] text-amber-400 font-bold flex items-center gap-1.5 mb-1">
                    <ShieldCheck size={14} />
                    <span>سطح ۱: مدیریت ارشد و دسترسی‌های کلان سیستم</span>
                  </div>
                  {level1Users.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleQuickLogin(u)}
                      className="w-full text-right p-3 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-2xl flex items-center justify-between group transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("w-9 h-9 rounded-xl text-white font-black flex items-center justify-center text-xs shadow-sm", u.avatarBg)}>
                          {(u.name || u.username || 'ک')[0]}
                        </div>
                        <div>
                          <div className="text-xs font-black text-white flex items-center gap-1.5">
                            <span>{u.name}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              نام کاربری: {u.username}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {u.roleTitle} {u.isReadOnly ? '• فقط مشاهده بدون ویرایش' : '• دسترسی کامل + مدیریت کاربران'}
                          </p>
                        </div>
                      </div>
                      <ChevronLeft size={16} className="text-slate-500 group-hover:text-white group-hover:-translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
              )}

              {activePresetTab === 2 && (
                <div className="space-y-2">
                  <div className="text-[11px] text-indigo-400 font-bold flex items-center gap-1.5 mb-1">
                    <GraduationCap size={14} />
                    <span>سطح ۲: کادر اجرایی، آموزش، اساتید پایه و پژوهش</span>
                  </div>
                  {level2Users.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleQuickLogin(u)}
                      className="w-full text-right p-2.5 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-2xl flex items-center justify-between group transition-all"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn("w-8 h-8 rounded-xl text-white font-black flex items-center justify-center text-xs shadow-sm", u.avatarBg)}>
                          {(u.name || u.username || 'ک')[0]}
                        </div>
                        <div>
                          <div className="text-xs font-black text-white flex items-center gap-1.5">
                            <span>{u.name}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                              کاربری: {u.username}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {u.roleTitle} {u.gradeLabel ? `(${u.gradeLabel})` : ''}
                          </p>
                        </div>
                      </div>
                      <ChevronLeft size={15} className="text-slate-500 group-hover:text-white group-hover:-translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
              )}

              {activePresetTab === 3 && (
                <div className="space-y-2">
                  <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1.5 mb-1">
                    <UserCheck size={14} />
                    <span>سطح ۳: پرتال اختصاصی طلاب و نمایندگان کلاس</span>
                  </div>
                  {level3Users.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleQuickLogin(u)}
                      className="w-full text-right p-3 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-2xl flex items-center justify-between group transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("w-9 h-9 rounded-xl text-white font-black flex items-center justify-center text-xs shadow-sm", u.avatarBg)}>
                          {(u.name || u.username || 'ک')[0]}
                        </div>
                        <div>
                          <div className="text-xs font-black text-white flex items-center gap-1.5">
                            <span>{u.name}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              کاربری: {u.username}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {u.roleTitle} {u.role === 'class_representative' ? '• ثبت و مشاهده حضور، برنامه و مطالعه' : '• پرتال شخصی، مطالعه، مباحثه و برنامه'}
                          </p>
                        </div>
                      </div>
                      <ChevronLeft size={16} className="text-slate-500 group-hover:text-white group-hover:-translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
              <span>جهت لاگین کافیست روی هر کاربر کلیک کنید.</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 size={12} />
                تفکیک خودکار منو و دسترسی
              </span>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
