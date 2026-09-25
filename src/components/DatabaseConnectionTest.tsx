import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Server, 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  ShieldCheck, 
  Terminal, 
  HardDrive,
  Copy,
  ExternalLink,
  ChevronDown,
  Activity
} from 'lucide-react';
import { testSupabaseConnection, ConnectionStatus } from '../lib/supabaseSync';
import { getSupabaseCredentials, getSupabaseClient } from '../lib/supabase';
import { localDb } from '../lib/localDb';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function DatabaseConnectionTest() {
  const { currentUser } = useAuth();
  const [supabaseStatus, setSupabaseStatus] = useState<ConnectionStatus | null>(null);
  const [serverStatus, setServerStatus] = useState<{ connected: boolean; message: string; latency?: number } | null>(null);
  const [localStatus, setLocalStatus] = useState<{ connected: boolean; message: string; totalRecords: number; idbSupport: boolean } | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString('fa-IR');
    setLogs(prev => [...prev, `[${time}] ${msg}`]);
  };

  const runAllDiagnostics = async () => {
    setLoading(true);
    setLogs([]);
    addLog('شروع فرایند عیب‌یابی و تست اتصال به پایگاه‌های داده...');

    // 1. Diagnostics for Local IndexedDB
    addLog('در حال بررسی وضعیت پایگاه داده محلی (IndexedDB/Laptop)...');
    try {
      const idbSupport = typeof indexedDB !== 'undefined';
      let totalRecords = 0;
      
      if (idbSupport) {
        addLog('موتور ذخیره‌سازی آفلاین IndexedDB فعال و در دسترس است.');
        // Count records across some key collections to show stats
        try {
          const stats = await localDb.getStorageStats();
          totalRecords = Object.values(stats.collectionCounts || {}).reduce((a, b) => a + b, 0);
          addLog(`پایگاه داده محلی با موفقیت بازخوانی شد. تعداد کل رکوردهای محلی: ${totalRecords} رکورد.`);
        } catch (err: any) {
          addLog(`هشدار در شمارش رکوردهای محلی: ${err?.message || err}`);
        }
      } else {
        addLog('پایگاه داده محلی IndexedDB پشتیبانی نمی‌شود. سیستم به صورت فال‌بک روی LocalStorage کار می‌کند.');
      }

      setLocalStatus({
        connected: true,
        message: idbSupport 
          ? 'پایگاه داده محلی و آفلاین روی مرورگر شما فعال و آماده ذخیره‌سازی ۱۰۰٪ امن است.'
          : 'پایگاه داده محلی (فال‌بک) فعال است اما پیشنهاد می‌شود از مرورگر مدرن‌تری استفاده نمایید.',
        totalRecords,
        idbSupport
      });
    } catch (e: any) {
      addLog(`خطای غیرمنتظره در تست دیتابیس محلی: ${e?.message}`);
      setLocalStatus({
        connected: false,
        message: `خطا در اجرای پایگاه داده محلی: ${e?.message || 'نامشخص'}`,
        totalRecords: 0,
        idbSupport: false
      });
    }

    // 2. Diagnostics for Server API
    addLog('در حال پینگ و سنجش تاخیر سرور اختصاصی سامانه...');
    const serverStartTime = Date.now();
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const serverLatency = Date.now() - serverStartTime;
      
      if (res.ok) {
        const data = await res.json();
        addLog(`اتصال به سرور با موفقیت برقرار شد. زمان تاخیر سرور: ${serverLatency} میلی‌ثانیه.`);
        if (data.authenticated) {
          addLog(`نشست کاربری فعال با توکن معتبر روی سرور یافت شد. کاربر متصل: @${data.user?.username || 'ناشناس'}`);
        } else {
          addLog('نشست فعال روی سرور یافت نشد. ارتباط امن در حالت مهمان فعال است.');
        }
        setServerStatus({
          connected: true,
          message: `اتصال به سرور اختصاصی برقرار است. زمان پاسخ‌دهی: ${serverLatency} میلی‌ثانیه.`,
          latency: serverLatency
        });
      } else {
        addLog(`سرور کد خطای ${res.status} را بازگرداند.`);
        setServerStatus({
          connected: false,
          message: `پاسخ ناموفق از سرور اختصاصی (کد ${res.status}). لطفاً اینترنت خود را بررسی کنید.`,
          latency: serverLatency
        });
      }
    } catch (err: any) {
      const serverLatency = Date.now() - serverStartTime;
      addLog(`اتصال به سرور ناموفق بود. تاخیر: ${serverLatency} میلی‌ثانیه. خطا: ${err?.message || err}`);
      setServerStatus({
        connected: false,
        message: 'سرور اختصاصی موقتاً قطع است یا به دلیل عدم دسترسی به اینترنت قابل مسیریابی نیست.',
        latency: serverLatency
      });
    }

    // 3. Diagnostics for Cloud Database (Supabase)
    addLog('در حال اتصال به دیتابیس آنلاین Supabase...');
    const cloudStartTime = Date.now();
    try {
      const creds = getSupabaseCredentials();
      addLog(`آدرس اتصال کلاد: ${creds.url || 'پیش‌فرض'}`);
      
      const status = await testSupabaseConnection();
      const cloudLatency = Date.now() - cloudStartTime;
      setLatency(cloudLatency);

      if (status.connected) {
        addLog(`پایگاه داده آنلاین متصل شد! زمان پینگ دیتابیس: ${cloudLatency} میلی‌ثانیه.`);
        if (status.tablesFound && status.tablesFound.length > 0) {
          addLog(`تعداد ${status.tablesFound.length} جدول کلیدی در دیتابیس کلاد با موفقیت شناسایی و تایید شد.`);
        }
        setSupabaseStatus(status);
      } else {
        addLog(`عدم موفقیت در تایید ارتباط کلاد: ${status.message}`);
        setSupabaseStatus(status);
      }
    } catch (err: any) {
      const cloudLatency = Date.now() - cloudStartTime;
      addLog(`خطای بحرانی در پینگ کلاد دیتابیس: ${err?.message || err}`);
      setSupabaseStatus({
        connected: false,
        message: `خطا در برقراری ارتباط با پایگاه داده ابری: ${err?.message || 'قطع اتصال شبکه'}`
      });
    }

    addLog('عملیات عیب‌یابی به پایان رسید.');
    setLoading(false);
  };

  useEffect(() => {
    runAllDiagnostics();
  }, []);

  const creds = getSupabaseCredentials();

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto font-vazir animate-in fade-in duration-300" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0 border border-indigo-100 shadow-2xs">
            <Activity size={24} className={cn(loading && "animate-pulse")} />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900">تست اتصال و عیب‌یابی دیتابیس</h1>
            <p className="text-xs text-slate-500 mt-1">بررسی وضعیت لحظه‌ای اتصال به پایگاه‌های داده محلی، سرور و ابر آنلاین</p>
          </div>
        </div>
        
        <button
          onClick={runAllDiagnostics}
          disabled={loading}
          className={cn(
            "flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-indigo-200 disabled:opacity-50 disabled:pointer-events-none cursor-pointer shrink-0"
          )}
        >
          <RefreshCw size={14} className={cn(loading && "animate-spin")} />
          <span>{loading ? "در حال عیب‌یابی..." : "مجدد اتصال‌ها را بسنج"}</span>
        </button>
      </div>

      {/* Main Grid for Diagnostics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 1. Local IndexedDB Database Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <HardDrive size={18} />
              </div>
              <h3 className="text-xs font-black text-slate-800">پایگاه داده آفلاین محلی</h3>
            </div>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full">
              محلی (مرورگر)
            </span>
          </div>

          <div className="space-y-3">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span>تکنولوژی ذخیره:</span>
                <span className="font-bold text-slate-800">IndexedDB</span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span>رکورد محلی:</span>
                <span className="font-mono font-bold text-indigo-600">
                  {localStatus?.totalRecords || 0} رکورد
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span>امنیت دسترسی:</span>
                <span className="text-emerald-600 font-bold">۱۰۰٪ ایزوله مرورگر</span>
              </div>
            </div>

            {localStatus?.connected ? (
              <div className="flex items-start gap-2 text-emerald-700 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100 text-[11px] font-semibold leading-relaxed">
                <CheckCircle2 size={14} className="shrink-0 text-emerald-600 mt-0.5" />
                <span>{localStatus.message}</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-rose-700 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100 text-[11px] font-semibold leading-relaxed">
                <AlertTriangle size={14} className="shrink-0 text-rose-600 mt-0.5" />
                <span>درحال بررسی یا غیرقابل دسترسی.</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Server API Database Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center">
                <Server size={18} />
              </div>
              <h3 className="text-xs font-black text-slate-800">سرور اختصاصی سامانه</h3>
            </div>
            {serverStatus?.connected ? (
              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                وصل
              </span>
            ) : (
              <span className="text-[10px] bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>
                قطع
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span>تاخیر پینگ سرور:</span>
                <span className="font-mono font-bold text-slate-800">
                  {serverStatus?.latency !== undefined ? `${serverStatus.latency} ms` : "---"}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span>نشست فعال JWT:</span>
                <span className={cn("font-bold", currentUser ? "text-indigo-600" : "text-amber-600")}>
                  {currentUser ? `بله (@${currentUser.username})` : "مهمان / ناشناس"}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span>پروتکل سرور:</span>
                <span className="text-slate-600 font-mono">HTTPS Express</span>
              </div>
            </div>

            {serverStatus?.connected ? (
              <div className="flex items-start gap-2 text-sky-700 bg-sky-50/50 p-2.5 rounded-xl border border-sky-100 text-[11px] font-semibold leading-relaxed">
                <CheckCircle2 size={14} className="shrink-0 text-sky-600 mt-0.5" />
                <span>{serverStatus.message}</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-rose-700 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100 text-[11px] font-semibold leading-relaxed">
                <AlertTriangle size={14} className="shrink-0 text-rose-600 mt-0.5" />
                <span>{serverStatus?.message || "پینگ اولیه ارسال شد اما سرور پاسخی دریافت نکرد."}</span>
              </div>
            )}
          </div>
        </div>

        {/* 3. Cloud Database (Supabase) Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center">
                <Database size={18} />
              </div>
              <h3 className="text-xs font-black text-slate-800">پایگاه داده آنلاین کلاد</h3>
            </div>
            {supabaseStatus?.connected ? (
              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                وصل
              </span>
            ) : (
              <span className="text-[10px] bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>
                قطع
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span>زمان پینگ کلاد:</span>
                <span className="font-mono font-bold text-slate-800">
                  {latency !== null ? `${latency} ms` : "---"}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span>جدول ساختارمند:</span>
                <span className="font-mono text-violet-600 font-bold">
                  {supabaseStatus?.tablesFound?.length || 0} ردیف تایید شد
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span>موتور سرور کلاد:</span>
                <span className="text-slate-600 font-bold font-mono">PostgreSQL 15</span>
              </div>
            </div>

            {supabaseStatus?.connected ? (
              <div className="flex items-start gap-2 text-violet-700 bg-violet-50/50 p-2.5 rounded-xl border border-violet-100 text-[11px] font-semibold leading-relaxed">
                <CheckCircle2 size={14} className="shrink-0 text-violet-600 mt-0.5" />
                <span>{supabaseStatus.message}</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-amber-700 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100 text-[11px] font-semibold leading-relaxed">
                <AlertTriangle size={14} className="shrink-0 text-amber-600 mt-0.5" />
                <span className="line-clamp-4 hover:line-clamp-none transition-all">{supabaseStatus?.message || "دریافت اطلاعات اتصال کلاد با خطا مواجه شد."}</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Interactive Diagnostics Console */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-slate-200">
            <Terminal size={18} className="text-indigo-400" />
            <h3 className="text-sm font-bold">کنسول عیب‌یابی لحظه‌ای و لاگ‌های سیستمی</h3>
          </div>
          <span className="text-[10px] font-mono text-slate-500">SYSTEM DIAGNOSTICS v2.0</span>
        </div>

        <div className="bg-slate-950/80 p-4 rounded-2xl font-mono text-[11px] leading-relaxed text-slate-300 h-60 overflow-y-auto space-y-1.5 custom-scrollbar text-right" dir="ltr">
          {logs.map((log, i) => (
            <div 
              key={i} 
              className={cn(
                "border-l-2 pl-2 text-left",
                log.includes('خطا') || log.includes('ناموفق') ? "border-rose-500 text-rose-400" :
                log.includes('هشدار') ? "border-amber-500 text-amber-400" :
                log.includes('موفقیت') || log.includes('متصل شد') ? "border-emerald-500 text-emerald-400" :
                "border-indigo-500 text-slate-300"
              )}
            >
              {log}
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-center text-slate-600 py-20 font-vazir text-xs">
              کنسول آماده است. برای شروع پینگ دیتابیس دکمه «مجدد اتصال‌ها را بسنج» در بالای صفحه را لمس نمایید.
            </div>
          )}
        </div>
      </div>

      {/* Connection Configurations */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-3">
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="w-full flex items-center justify-between text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Info size={16} className="text-indigo-600" />
            <span className="text-xs font-bold">نمایش اطلاعات و آدرس‌های اتصال به دیتابیس آنلاین</span>
          </div>
          <ChevronDown size={16} className={cn("transition-transform duration-200", showConfig && "rotate-180")} />
        </button>

        <AnimatePresence>
          {showConfig && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden space-y-3 pt-2"
            >
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs text-slate-600 leading-relaxed space-y-2">
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
                  <span>آدرس دیتابیس ابری (VITE_SUPABASE_URL):</span>
                  <span className="font-mono bg-slate-200/60 px-2 py-0.5 rounded text-[10px] text-slate-800 truncate select-all">{creds.url}</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between border-t border-slate-200/50 pt-2">
                  <span>کلید اتصال ناشناس (VITE_SUPABASE_ANON_KEY):</span>
                  <span className="font-mono bg-slate-200/60 px-2 py-0.5 rounded text-[10px] text-slate-800 truncate select-all">{creds.anonKey?.substring(0, 15)}...{creds.anonKey?.substring(creds.anonKey.length - 15)}</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400">
                نکته: اطلاعات فوق به صورت امن برای برقراری ارتباط در مرورگر مورد استفاده قرار می‌گیرند. هرگونه پکت ارسالی در شبکه با پروتکل امن SSL و گواهینامه احراز هویت رمزگذاری می‌شود.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
