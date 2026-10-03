import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  RefreshCw, 
  Search, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  Terminal, 
  Filter,
  X,
  Trash2,
  PlusCircle,
  Download,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { localDb } from '../lib/localDb';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

export interface AppLogEntry {
  id: string;
  level: 'error' | 'warn' | 'info';
  message: string;
  path?: string;
  trace_id: string;
  stack?: string;
  created_at: string;
  user_name?: string;
  user_role?: string;
  metadata?: any;
}

export default function LogViewer() {
  const { currentUser } = useAuth();
  const [logs, setLogs] = useState<AppLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedTraceId, setCopiedTraceId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Helper to generate Trace ID
  const generateTraceId = () => {
    return 'tr_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
  };

  // Seed default initial logs if database is empty
  const getInitialSeedLogs = (): AppLogEntry[] => {
    const now = new Date();
    return [
      {
        id: 'log_seed_1',
        level: 'info',
        message: 'سامانه مانیتورینگ و لاگ‌گیر پیشرفته سیستم با موفقیت راه‌اندازی گردید.',
        path: '/src/components/LogViewer.tsx',
        trace_id: generateTraceId(),
        created_at: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
        user_name: currentUser?.name || 'مدیر سیستم',
        user_role: currentUser?.roleTitle || 'سوپر ادمین',
        metadata: { status: 'initialized', env: 'production' }
      },
      {
        id: 'log_seed_2',
        level: 'info',
        message: 'بررسی وضعیت اتصال به دیتابیس محلی (IndexedDB) و سرور؛ ارتباط پایدار است.',
        path: '/src/lib/localDb.ts',
        trace_id: generateTraceId(),
        created_at: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
        user_name: 'سیستم',
        user_role: 'بررسی سلامت سیستم',
        metadata: { dbEngine: 'IndexedDB / Express Proxy', latencyMs: 14 }
      },
      {
        id: 'log_seed_3',
        level: 'warn',
        message: 'هشدار عدم انطباق نشست: توکن جلسه کاربر به‌روزرسانی شد.',
        path: '/src/context/AuthContext.tsx',
        trace_id: generateTraceId(),
        created_at: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
        user_name: currentUser?.username || 'کاربر',
        user_role: currentUser?.roleTitle || 'کاربر',
        metadata: { action: 'token_refreshed', retryCount: 1 }
      }
    ];
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // 1. Load from localDb
      let dbLogs = await localDb.getDocs<AppLogEntry>('app_logs').catch(() => []);
      
      // 2. Load from localStorage fallback
      let storageLogs: AppLogEntry[] = [];
      try {
        const saved = localStorage.getItem('app_system_logs');
        if (saved) {
          storageLogs = JSON.parse(saved);
        }
      } catch {}

      // Combine and deduplicate by ID
      const map = new Map<string, AppLogEntry>();
      [...dbLogs, ...storageLogs].forEach(item => {
        if (item && item.id) map.set(item.id, item);
      });

      let combined = Array.from(map.values());

      // If completely empty, insert seeds
      if (combined.length === 0) {
        combined = getInitialSeedLogs();
        // Save seeds to storage
        for (const seed of combined) {
          await localDb.saveDoc('app_logs', seed).catch(() => {});
        }
      }

      // Sort by timestamp descending
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setLogs(combined);
    } catch (err: any) {
      console.error('Error loading app logs:', err);
      setStatusMsg({ type: 'error', text: 'خطا در بارگذاری لاگ‌ها' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    // Attach global window error listener to capture unhandled runtime exceptions automatically
    const handleGlobalError = (event: ErrorEvent) => {
      const newEntry: AppLogEntry = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        level: 'error',
        message: event.message || 'خطای فرانتاند ثبت نشده در برنامه',
        path: window.location.pathname + (event.filename ? ` (${event.filename}:${event.lineno})` : ''),
        trace_id: generateTraceId(),
        stack: event.error?.stack || `Line ${event.lineno}, Col ${event.colno}`,
        created_at: new Date().toISOString(),
        user_name: currentUser?.name || 'کاربر سیستم',
        user_role: currentUser?.roleTitle || 'ناشناس'
      };

      setLogs(prev => [newEntry, ...prev]);
      localDb.saveDoc('app_logs', newEntry).catch(() => {});
    };

    window.addEventListener('error', handleGlobalError);
    return () => {
      window.removeEventListener('error', handleGlobalError);
    };
  }, []);

  const handleAddTestLog = async (level: 'error' | 'warn' | 'info') => {
    const testMessages = {
      error: 'خطای تست دسترسی: تلاش ناموفق برای فراخوانی API محدودشده',
      warn: 'هشدار کندی شبکه: پاسخ سرور بیش از ۱۲۰۰ میلی‌ثانیه زمان برد',
      info: 'رویداد سیستم: ورود موفق سوپرادمین و بررسی وضعیت ماژول‌ها'
    };

    const newLog: AppLogEntry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      level,
      message: testMessages[level],
      path: window.location.pathname,
      trace_id: generateTraceId(),
      stack: level === 'error' ? 'Error: Failed permission assertion at auth.check (AuthContext.tsx:102)\n    at fetchPermissions (UserManagement.tsx:45)' : undefined,
      created_at: new Date().toISOString(),
      user_name: currentUser?.name || 'تست‌کننده سیستم',
      user_role: currentUser?.roleTitle || 'مدیر'
    };

    setLogs(prev => [newLog, ...prev]);
    await localDb.saveDoc('app_logs', newLog).catch(() => {});
    setStatusMsg({ type: 'success', text: `لاگ تست از نوع ${level.toUpperCase()} با موفقیت ثبت شد.` });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleClearLogs = async () => {
    if (!window.confirm('آیا از پاکسازی تمام لاگ‌های ثبت‌شده سیستم اطمینان دارید؟')) return;
    try {
      for (const log of logs) {
        await localDb.deleteDoc('app_logs', log.id).catch(() => {});
      }
      localStorage.removeItem('app_system_logs');
      setLogs([]);
      setStatusMsg({ type: 'info', text: 'تمام لاگ‌های سیستم پاکسازی شدند.' });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch {
      setStatusMsg({ type: 'error', text: 'خطا در پاکسازی لاگ‌ها' });
    }
  };

  const handleCopyTraceId = (traceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(traceId);
    setCopiedTraceId(traceId);
    setTimeout(() => setCopiedTraceId(null), 2000);
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `app_system_logs_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesLevel = levelFilter === 'all' || log.level?.toLowerCase() === levelFilter.toLowerCase();
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        !q || 
        (log.message && log.message.toLowerCase().includes(q)) || 
        (log.trace_id && log.trace_id.toLowerCase().includes(q)) ||
        (log.path && log.path.toLowerCase().includes(q)) ||
        (log.user_name && log.user_name.toLowerCase().includes(q));

      return matchesLevel && matchesSearch;
    });
  }, [logs, levelFilter, searchQuery]);

  const getLevelBadge = (level: string) => {
    const lvl = (level || 'info').toLowerCase();
    if (lvl === 'error') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
          <AlertCircle size={13} className="text-rose-600 shrink-0" />
          ERROR
        </span>
      );
    }
    if (lvl === 'warn') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
          <AlertTriangle size={13} className="text-amber-600 shrink-0" />
          WARN
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs">
        <Info size={13} className="text-sky-600 shrink-0" />
        INFO
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 font-vazir relative" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-indigo-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner shrink-0">
              <Terminal className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">مرکز مانیتورینگ لاگ‌ها و خطاهای سیستم (System Logs)</h1>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                پایش لحظه‌ای استک‌تریس خطاهای کلاینت، هشدارهای امنیتی و رویدادهای سیستم به تفکیک Trace ID
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer border border-white/20"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span>بروزرسانی لاگ‌ها</span>
            </button>

            <button
              onClick={handleExportJSON}
              disabled={logs.length === 0}
              className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold transition-all border border-white/20 cursor-pointer"
              title="خروجی فایل JSON"
            >
              <Download size={15} />
              <span className="hidden sm:inline">دانلود JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Status Notice Toast */}
      {statusMsg && (
        <div className={cn(
          "p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs border animate-in fade-in duration-200",
          statusMsg.type === 'success' ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
          statusMsg.type === 'error' ? "bg-rose-50 text-rose-800 border-rose-200" : "bg-blue-50 text-blue-800 border-blue-200"
        )}>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-slate-500 hover:text-slate-800 cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Filters and Test Actions Bar */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در پیام خطا، Trace ID، کاربر یا مسیر..."
              className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-bold"
            />
          </div>

          {/* Level Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 shrink-0">
            <span className="text-xs text-slate-400 font-bold shrink-0 flex items-center gap-1 ml-1">
              <Filter size={13} />
              <span>سطح:</span>
            </span>
            {[
              { id: 'all', label: 'همه' },
              { id: 'error', label: 'خطا (Error)' },
              { id: 'warn', label: 'هشدار (Warn)' },
              { id: 'info', label: 'اطلاعات (Info)' }
            ].map((lvl) => (
              <button
                key={lvl.id}
                onClick={() => setLevelFilter(lvl.id as any)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border",
                  levelFilter === lvl.id
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                )}
              >
                {lvl.label}
              </button>
            ))}
          </div>
        </div>

        {/* Test Log Creators and Clear Button */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400 font-bold">ثبت لاگ آزمایشی:</span>
            <button
              onClick={() => handleAddTestLog('error')}
              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <PlusCircle size={12} />
              <span>تست ERROR</span>
            </button>
            <button
              onClick={() => handleAddTestLog('warn')}
              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <PlusCircle size={12} />
              <span>تست WARN</span>
            </button>
            <button
              onClick={() => handleAddTestLog('info')}
              className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <PlusCircle size={12} />
              <span>تست INFO</span>
            </button>
          </div>

          <button
            onClick={handleClearLogs}
            disabled={logs.length === 0}
            className="px-3 py-1 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <Trash2 size={13} />
            <span>پاکسازی کامل لاگ‌ها</span>
          </button>
        </div>
      </div>

      {/* Logs Table / List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-xs font-bold text-slate-600">در حال دریافت لاگ‌های سیستم...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-2">
            <Terminal className="w-10 h-10 text-slate-300" />
            <p className="text-sm font-bold text-slate-700">هیچ لاگی بر اساس فیلترهای انتخابی پیدا نشد.</p>
            <p className="text-xs text-slate-400">می‌توانید با دکمه‌های بالای جدول، لاگ آزمایشی ثبت کنید.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              return (
                <div key={log.id} className="transition-colors hover:bg-slate-50/80">
                  <div
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5 shrink-0">{getLevelBadge(log.level)}</div>
                      <div className="flex flex-col min-w-0 space-y-1">
                        <p className="text-xs font-bold text-slate-800 break-words leading-relaxed">
                          {log.message}
                        </p>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium flex-wrap">
                          {log.path && (
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg font-mono">
                              {log.path}
                            </span>
                          )}
                          {log.user_name && (
                            <span className="text-indigo-600 font-bold">
                              کاربر: {log.user_name}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {formatDate(log.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={(e) => handleCopyTraceId(log.trace_id, e)}
                        className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer border border-slate-200"
                        title="کپی Trace ID"
                      >
                        {copiedTraceId === log.trace_id ? (
                          <>
                            <Check size={12} className="text-emerald-600" />
                            <span className="text-emerald-600">کپی شد</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>{log.trace_id}</span>
                          </>
                        )}
                      </button>

                      <div className="p-1 text-slate-400 hover:text-slate-600">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail Tray */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 bg-slate-900 text-slate-100 border-t border-slate-800 text-xs space-y-3 font-mono dir-ltr text-left">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2">
                        <span>TRACE ID: {log.trace_id}</span>
                        <span>TIMESTAMP: {log.created_at}</span>
                      </div>

                      <div>
                        <span className="text-emerald-400 font-bold text-[11px] block mb-1">RAW LOG MESSAGE:</span>
                        <p className="bg-slate-950 p-3 rounded-xl text-emerald-300 break-words whitespace-pre-wrap font-mono text-[11px]">
                          {log.message}
                        </p>
                      </div>

                      {log.stack && (
                        <div>
                          <span className="text-rose-400 font-bold text-[11px] block mb-1">STACK TRACE:</span>
                          <pre className="bg-slate-950 p-3 rounded-xl text-rose-300 overflow-x-auto text-[10px] font-mono leading-relaxed">
                            {log.stack}
                          </pre>
                        </div>
                      )}

                      {log.metadata && (
                        <div>
                          <span className="text-amber-400 font-bold text-[11px] block mb-1">METADATA / CONTEXT:</span>
                          <pre className="bg-slate-950 p-3 rounded-xl text-amber-200 overflow-x-auto text-[10px] font-mono">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
