import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  X, 
  Palette, 
  Zap, 
  Moon, 
  Sun, 
  LayoutGrid, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Check, 
  ShieldCheck, 
  RotateCcw,
  Sliders,
  Monitor
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

export interface AppPreferences {
  theme: 'default' | 'emerald' | 'dark' | 'amber' | 'violet';
  disableAnimations: boolean;
  compactMode: boolean;
  highContrast: boolean;
  soundEffects: boolean;
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  theme: 'default',
  disableAnimations: false,
  compactMode: false,
  highContrast: false,
  soundEffects: false
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPreferencesChange?: (prefs: AppPreferences) => void;
}

export default function SettingsModal({ isOpen, onClose, onPreferencesChange }: SettingsModalProps) {
  const { currentUser } = useAuth();

  const [prefs, setPrefs] = useState<AppPreferences>(() => {
    try {
      const saved = localStorage.getItem('user_app_preferences');
      if (saved) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
      }
    } catch (e) {}
    return DEFAULT_PREFERENCES;
  });

  const [isSavedToastVisible, setIsSavedToastVisible] = useState(false);

  // Apply preferences to DOM whenever changed
  useEffect(() => {
    try {
      localStorage.setItem('user_app_preferences', JSON.stringify(prefs));
      
      // Theme Application
      document.documentElement.setAttribute('data-theme', prefs.theme);
      if (prefs.theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      // Animation speed / Reduction
      if (prefs.disableAnimations) {
        document.documentElement.classList.add('disable-animations');
        document.body.classList.add('reduce-motion');
      } else {
        document.documentElement.classList.remove('disable-animations');
        document.body.classList.remove('reduce-motion');
      }

      // Compact view
      if (prefs.compactMode) {
        document.documentElement.classList.add('compact-mode');
      } else {
        document.documentElement.classList.remove('compact-mode');
      }

      if (onPreferencesChange) {
        onPreferencesChange(prefs);
      }
    } catch (e) {}
  }, [prefs]);

  const updatePreference = <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => {
    setPrefs(prev => ({
      ...prev,
      [key]: value
    }));
    setIsSavedToastVisible(true);
    setTimeout(() => setIsSavedToastVisible(false), 2000);
  };

  const handleResetDefaults = () => {
    if (window.confirm('آیا از بازگردانی تنظیمات به حالت اولیه پیش‌فرض اطمینان دارید؟')) {
      setPrefs(DEFAULT_PREFERENCES);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-100 my-8"
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black">
                <Settings size={22} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">تنظیمات و شخصی‌سازی سامانه</h3>
                <p className="text-xs text-slate-500">انتخاب تم رنگی، بهینه‌سازی سرعت و تنظیم انیمیشن‌ها</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-6 text-xs">
            {/* 1. Theme Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Palette size={16} className="text-indigo-600" />
                  <span>تم رنگی سامانه</span>
                </label>
                <span className="text-[11px] text-slate-400 font-medium">پوسته ظاهری دلخواه</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { id: 'default', label: 'نیلی کلاسیک (Indigo)', color: 'bg-indigo-600', border: 'border-indigo-200' },
                  { id: 'emerald', label: 'سبز زمردی (Emerald)', color: 'bg-emerald-600', border: 'border-emerald-200' },
                  { id: 'amber', label: 'کهربایی گرم (Amber)', color: 'bg-amber-600', border: 'border-amber-200' },
                  { id: 'violet', label: 'بنفش فاخر (Violet)', color: 'bg-violet-600', border: 'border-violet-200' },
                  { id: 'dark', label: 'حالت شب / تیره (Dark)', color: 'bg-slate-900', border: 'border-slate-700' }
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => updatePreference('theme', t.id as any)}
                    className={cn(
                      "p-3 rounded-2xl border text-right transition-all flex items-center justify-between cursor-pointer group",
                      prefs.theme === t.id 
                        ? "border-indigo-600 bg-indigo-50/70 font-black shadow-xs ring-2 ring-indigo-600/20" 
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn("w-4 h-4 rounded-full shadow-xs shrink-0", t.color)} />
                      <span className="text-xs text-slate-800">{t.label}</span>
                    </div>
                    {prefs.theme === t.id && (
                      <Check size={14} className="text-indigo-600 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Performance & Animations Toggle */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-black text-slate-900">
                    <Zap size={16} className="text-amber-600" />
                    <span>بهینه‌سازی سرعت و غیرفعال‌سازی انیمیشن‌ها (حالت توربو)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-normal">
                    اگر مایلید سامانه بدون هیچ‌گونه تاخیر، موشن یا انیمیشن اجرا شود و سرعت باز شدن صفحات به حداکثر برسد، این گزینه را فعال کنید.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => updatePreference('disableAnimations', !prefs.disableAnimations)}
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 mt-1",
                    prefs.disableAnimations ? "bg-amber-600" : "bg-slate-300"
                  )}
                >
                  <span className={cn(
                    "w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-xs",
                    prefs.disableAnimations ? "right-1" : "right-6"
                  )} />
                </button>
              </div>

              {/* Compact layout toggle */}
              <div className="pt-3 border-t border-slate-200/80 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <LayoutGrid size={15} className="text-indigo-600" />
                    <span>حالت فشرده (Compact Mode)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-normal">
                    کاهش فواصل کارت‌ها و جداول جهت نمایش بیشترین اطلاعات ممکن در یک صفحه.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => updatePreference('compactMode', !prefs.compactMode)}
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 mt-1",
                    prefs.compactMode ? "bg-indigo-600" : "bg-slate-300"
                  )}
                >
                  <span className={cn(
                    "w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-xs",
                    prefs.compactMode ? "right-1" : "right-6"
                  )} />
                </button>
              </div>
            </div>

            {/* Status Feedback Toast */}
            {isSavedToastVisible && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-center font-bold text-xs animate-in fade-in flex items-center justify-center gap-1.5">
                <Check size={14} className="text-emerald-600" />
                <span>تنظیمات با موفقیت اعمال و ذخیره شد.</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-[11px] text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>بازنشانی به پیش‌فرض</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              بستن و ذخیره
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
