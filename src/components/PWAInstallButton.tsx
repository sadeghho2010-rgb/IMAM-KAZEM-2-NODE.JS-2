import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, Laptop, Share2, PlusSquare, X, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'sidebar' | 'banner';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className,
  variant = 'header'
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running as an installed standalone PWA, suppress the button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await install();
    } finally {
      setIsInstalling(false);
    }
  };

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    if (variant === 'sidebar') {
      return (
        <button
          type="button"
          onClick={handleInstallClick}
          disabled={isInstalling}
          className={cn(
            "w-full flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 hover:shadow-lg hover:from-indigo-700 hover:to-purple-800 transition-all active:scale-[0.98] cursor-pointer group",
            className
          )}
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Download size={15} className="text-white" />
            </div>
            <div className="text-right">
              <div className="text-[11px] font-black leading-tight">نصب نرم‌افزار روی دستگاه</div>
              <div className="text-[9px] text-indigo-100 font-medium leading-tight">قابل نصب در موبایل و لپ‌تاپ</div>
            </div>
          </div>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/25 text-white font-black shrink-0">
            PWA
          </span>
        </button>
      );
    }

    // Default Header Variant
    return (
      <button
        type="button"
        onClick={handleInstallClick}
        disabled={isInstalling}
        className={cn(
          "flex items-center gap-1.5 py-1.5 px-2.5 sm:px-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-2xl text-xs font-black transition-all cursor-pointer shadow-md shadow-indigo-600/20 shrink-0 group active:scale-95 animate-pulse hover:animate-none",
          className
        )}
        title="نصب نسخه مستقل نرم‌افزار روی موبایل یا لپ‌تاپ (بدون نیاز به مرورگر)"
      >
        <Download size={14} className="text-amber-300 group-hover:scale-110 transition-transform shrink-0" />
        <span className="hidden sm:inline">نصب اپلیکیشن</span>
        <span className="sm:hidden">نصب</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not fired on WebKit)
  if (isIOS) {
    return (
      <>
        {variant === 'sidebar' ? (
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            className={cn(
              "w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs shadow-sm hover:bg-slate-800 transition-all cursor-pointer group",
              className
            )}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <Smartphone size={15} className="text-amber-400" />
              </div>
              <div className="text-right">
                <div className="text-[11px] font-black leading-tight">نصب روی آیفون / آیپد</div>
                <div className="text-[9px] text-slate-400 font-medium leading-tight">راهنمای افزودن به صفحه اصلی</div>
              </div>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-800 text-amber-300 font-bold">
              iOS
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            className={cn(
              "flex items-center gap-1.5 py-1.5 px-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black transition-all cursor-pointer shadow-sm shrink-0",
              className
            )}
            title="نصب نرم‌افزار در آیفون / آیپد"
          >
            <Smartphone size={13} className="text-amber-400 shrink-0" />
            <span className="hidden sm:inline">نصب در iOS</span>
            <span className="sm:hidden">نصب</span>
          </button>
        )}

        {/* Guided iOS Modal */}
        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" dir="rtl">
            <div className="w-full max-w-sm rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-100 text-slate-800 relative">
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 left-4 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 shadow-2xs">
                  <Smartphone size={22} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">نصب برنامه روی آیفون و آیپد</h3>
                  <p className="text-[11px] text-slate-500 font-medium">اجرا با آیکون اختصاصی و تمام‌صفحه</p>
                </div>
              </div>

              <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs font-semibold text-slate-700 leading-relaxed">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    ۱
                  </div>
                  <div>
                    در نوار پایینی مرورگر سافاری روی دکمه <span className="inline-flex items-center gap-1 font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200"><Share2 size={12} /> اشتراک‌گذاری (Share)</span> ضربه بزنید.
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    ۲
                  </div>
                  <div>
                    صفحه را کمی به پایین اسکرول کرده و گزینه <span className="inline-flex items-center gap-1 font-bold text-slate-900 bg-slate-200/80 px-1.5 py-0.5 rounded"><PlusSquare size={12} /> Add to Home Screen (افزودن به صفحه اصلی)</span> را انتخاب کنید.
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    ۳
                  </div>
                  <div>
                    در گوشه بالا روی <span className="font-bold text-indigo-600">Add</span> بزنید. آیکون برنامه در صفحه اصلی گوشی شما با نماد زیبا ثبت خواهد شد!
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                متوجه شدم
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Generic fallback button if browser allows standalone or when previewing
  return (
    <button
      type="button"
      onClick={() => {
        // Provide friendly advice if browser doesn't expose prompt yet
        alert('برای نصب برنامه روی لپ‌تاپ یا گوشی:\nدر مرورگر کروم/اج/فایرفاکس، روی آیکون نصب (Install) در کنار نوار آدرس یا منوی سه‌نقطه مرورگر کلیک کرده و «نصب سامانه جامع طلاب» را انتخاب فرمایید.');
      }}
      className={cn(
        "flex items-center gap-1.5 py-1.5 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/90 rounded-2xl text-xs font-black transition-all cursor-pointer shadow-2xs shrink-0 group active:scale-95",
        className
      )}
      title="راهنمای نصب برنامه روی لپ‌تاپ یا موبایل"
    >
      <Laptop size={13} className="text-indigo-600 group-hover:scale-110 transition-transform shrink-0" />
      <span className="hidden sm:inline">نصب اپلیکیشن</span>
      <span className="sm:hidden">نصب</span>
    </button>
  );
};
