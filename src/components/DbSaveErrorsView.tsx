import React, { useState, useEffect, useMemo } from 'react';
import { 
  Database, 
  Search, 
  Filter, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  User, 
  ShieldAlert, 
  Layers, 
  Trash2, 
  Download, 
  PlusCircle, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  WifiOff, 
  Table, 
  Lock, 
  Hourglass,
  ArrowRight,
  Eye,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { localDb } from '../lib/localDb';
import { DbSaveErrorLog, recordDatabaseSaveError } from '../lib/dbErrorLogger';
import { cn } from '../lib/utils';
import AnimatedCounter from './AnimatedCounter';

export default function DbSaveErrorsView() {
  const { currentUser } = useAuth();

  // Check if current user is manager (Education Manager, Finance Manager, or Super Admin)
  const isGlobalManager = useMemo(() => {
    if (!currentUser) return false;
    const uname = (currentUser.username || '').toUpperCase();
    return (
      currentUser.level === 1 ||
      currentUser.role === 'super_admin' ||
      currentUser.role === 'education_manager' ||
      currentUser.role === 'finance_manager' ||
      uname === 'SHAH' ||
      uname === 'MALI' ||
      uname === 'SADEGH'
    );
  }, [currentUser]);

  const [errorLogs, setErrorLogs] = useState<DbSaveErrorLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCause, setSelectedCause] = useState<string>('all');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'unresolved' | 'resolved'>('all');

  const [expandedId, setExpandedLogId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Seed sample initial logs if empty
  const getSampleSeedLogs = (): DbSaveErrorLog[] => {
    const now = new Date();
    return [
      {
        id: 'dberr_seed_1',
        collectionName: 'student_requests',
        moduleLabel: 'پنل رسیدگی به درخواست طلاب',
        recordId: 'req_fa_8921',
        recordSummary: 'ثبت موافقت با درخواست مرخصی تحصیلی برای طلبه علیرضا جلیلی',
        causeType: 'no_connection',
        causeTitle: 'عدم اتصال به دیتابیس (قطع بودن اینترنت یا سرور)',
        causeDescription: 'ارتباط دستگاه کاربر با دیتابیس ابری/سرور در حین نگارش قطع شده است. اطلاعات در حالت مرورگر باقی ماند ولی تا ۴ ثانیه در سرور ثبت نگردید.',
        rawErrorMessage: 'TypeError: fetch failed at saveToCloudWithTimeout (localDb.ts:931)',
        timestamp: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
        userId: 'user_shah',
        userName: 'استاد شاهپوری (مدیر آموزش)',
        userRole: 'مدیر آموزش و امتحانات',
        userLevel: 2,
        isResolved: false
      },
      {
        id: 'dberr_seed_2',
        collectionName: 'attendance',
        moduleLabel: 'حضور و غیاب طلاب',
        recordId: 'att_2026_10_03_g1',
        recordSummary: 'ثبت لیست حضور و غیاب کلاس فقه پایه ۹ (۱۰ طلبه)',
        causeType: 'table_not_found',
        causeTitle: 'عدم وجود جدول/مجموعه مربوطه در دیتابیس (Table or Collection Not Found)',
        causeDescription: 'جدول attendance_history در پایگاه داده سرور یافت نشد یا نام آن اصلاح نشده است.',
        rawErrorMessage: 'PostgresError: relation "public.attendance_history" does not exist (code: 42P01)',
        timestamp: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
        userId: 'user_sol',
        userName: 'استاد سلیمانی (مسئول پایه ۹)',
        userRole: 'مسئول پایه ۹',
        userLevel: 2,
        isResolved: false
      },
      {
        id: 'dberr_seed_3',
        collectionName: 'student_activity_tuition',
        moduleLabel: 'محاسبه شهریه طلاب',
        recordId: 'tui_fa_1405_07',
        recordSummary: 'محاسبه شهریه مهرماه طلاب پایه ۱۰ (تعداد ۱۵ طلبه)',
        causeType: 'timeout',
        causeTitle: 'خطای تایم‌اوت و کندی دیتابیس (Database Timeout)',
        causeDescription: 'عملیات ذخیره‌سازی بیش از مهلت ۴ ثانیه‌ای زمان برد و به علت افت سرعت خط ارتباطی متوقف شد.',
        rawErrorMessage: 'TimeoutError: Cloud write exceeded 4000ms threshold',
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        userId: 'user_mali',
        userName: 'مسئول مالی و اداری',
        userRole: 'مسئول مالی و کارکرد',
        userLevel: 2,
        isResolved: true,
        resolutionNote: 'اینترنت مجدداً وصل شد و محاسبه شهریه دوباره ثبت شد.'
      },
      {
        id: 'dberr_seed_4',
        collectionName: 'student_meals',
        moduleLabel: 'رزرو نهار و شام طلاب',
        recordId: 'meal_res_8812',
        recordSummary: 'رزرو غذای سلف برای روزهای شنبه تا چهارشنبه',
        causeType: 'permission_denied',
        causeTitle: 'عدم لغو دسترسی / سطح دسترسی ناکافی (Permission Denied / RLS)',
        causeDescription: 'حساب کاربری یا توکن منقضی‌شده اجازه نگارش در جدول سفارشات غذا را نداشت.',
        rawErrorMessage: 'PostgresError: new row violates row-level security policy for table "student_meals" (code: 42501)',
        timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
        userId: 'user_jalili',
        userName: 'علیرضا جلیلی',
        userRole: 'طلبه پایه',
        userLevel: 3,
        isResolved: false
      }
    ];
  };

  const fetchErrors = async () => {
    setLoading(true);
    try {
      let logs = await localDb.getDocs<DbSaveErrorLog>('db_save_errors').catch(() => []);
      
      // Fallback load
      try {
        const fallbackRaw = localStorage.getItem('db_save_errors_fallback');
        if (fallbackRaw) {
          const fallbackArr = JSON.parse(fallbackRaw);
          const map = new Map<string, DbSaveErrorLog>();
          [...logs, ...fallbackArr].forEach(item => {
            if (item && item.id) map.set(item.id, item);
          });
          logs = Array.from(map.values());
        }
      } catch {}

      // If completely empty, populate seed samples
      if (logs.length === 0) {
        logs = getSampleSeedLogs();
        for (const seed of logs) {
          await localDb.saveDoc('db_save_errors', seed).catch(() => {});
        }
      }

      // Filter by RBAC permissions
      if (!isGlobalManager && currentUser) {
        const curId = currentUser.id || currentUser.username;
        logs = logs.filter(l => l.userId === curId || l.userName?.includes(currentUser.name));
      }

      // Sort by timestamp descending
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setErrorLogs(logs);
    } catch (e) {
      console.error('Error fetching db save error logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchErrors();

    const handleLogged = () => fetchErrors();
    window.addEventListener('db_save_error_logged', handleLogged);
    return () => {
      window.removeEventListener('db_save_error_logged', handleLogged);
    };
  }, [currentUser, isGlobalManager]);

  const handleToggleResolved = async (log: DbSaveErrorLog, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = {
      ...log,
      isResolved: !log.isResolved,
      resolutionNote: !log.isResolved ? `بررسی و رفع گردید توسط ${currentUser?.name || 'مدیر'}` : undefined
    };

    setErrorLogs(prev => prev.map(l => l.id === log.id ? updated : l));
    await localDb.saveDoc('db_save_errors', updated).catch(() => {});
    setStatusNotice({
      type: 'success',
      text: updated.isResolved ? 'خطا به عنوان «بررسی و حل‌شده» علامت‌گذاری شد.' : 'وضعیت خطا به «در انتظار بررسی» تغییر کرد.'
    });
    setTimeout(() => setStatusNotice(null), 3000);
  };

  const handleDeleteLog = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('آیا از حذف این گزارش خطای دیتابیس اطمینان دارید؟')) return;
    try {
      setErrorLogs(prev => prev.filter(l => l.id !== id));
      await localDb.deleteDoc('db_save_errors', id).catch(() => {});
      setStatusNotice({ type: 'info', text: 'گزارش خطای انتخاب‌شده حذف گردید.' });
      setTimeout(() => setStatusNotice(null), 3000);
    } catch {
      setStatusNotice({ type: 'error', text: 'خطا در حذف گزارش' });
    }
  };

  const handleCreateTestError = async (type: 'no_connection' | 'table_not_found' | 'permission_denied' | 'timeout') => {
    const testConfigs = {
      no_connection: {
        col: 'student_requests',
        summary: 'آزمایش ثبت درخواست مرخصی - قطع ارتباط شبکه',
        raw: 'TypeError: fetch failed (Failed to connect to MySQL/Express backend)'
      },
      table_not_found: {
        col: 'attendance',
        summary: 'آزمایش ثبت حضور و غیاب - عدم وجود جدول attendance_daily',
        raw: 'PostgresError: relation "public.attendance_daily" does not exist'
      },
      permission_denied: {
        col: 'system_users',
        summary: 'آزمایش ویرایش دسترسی کاربر - عدم داشتن مجوّز سوپر ادمین',
        raw: 'PostgresError: new row violates row-level security policy for table "system_users"'
      },
      timeout: {
        col: 'student_activity_tuition',
        summary: 'آزمایش محاسبه شهریه - تایم‌اوت ۴ ثانیه‌ای شبکه',
        raw: 'TimeoutError: Database operation exceeded 4000ms timeout threshold'
      }
    };

    const cfg = testConfigs[type];
    await recordDatabaseSaveError({
      collectionName: cfg.col,
      recordSummary: cfg.summary,
      rawError: cfg.raw,
      causeType: type
    });

    fetchErrors();
    setStatusNotice({ type: 'success', text: `لاگ خطای آزمایشی از نوع «${type}» با موفقیت ثبت شد.` });
    setTimeout(() => setStatusNotice(null), 3000);
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const anchor = document.createElement('a');
    anchor.setAttribute("href", dataStr);
    anchor.setAttribute("download", `db_save_errors_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  // Unique list of users for dropdown filter
  const userOptions = useMemo(() => {
    const set = new Set<string>();
    errorLogs.forEach(l => {
      if (l.userName) set.add(l.userName);
    });
    return Array.from(set);
  }, [errorLogs]);

  // Unique list of modules for dropdown filter
  const moduleOptions = useMemo(() => {
    const set = new Set<string>();
    errorLogs.forEach(l => {
      if (l.moduleLabel) set.add(l.moduleLabel);
    });
    return Array.from(set);
  }, [errorLogs]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return errorLogs.filter(log => {
      // Cause filter
      if (selectedCause !== 'all' && log.causeType !== selectedCause) return false;
      
      // Status filter
      if (selectedStatus === 'unresolved' && log.isResolved) return false;
      if (selectedStatus === 'resolved' && !log.isResolved) return false;

      // User filter
      if (selectedUserFilter !== 'all' && log.userName !== selectedUserFilter) return false;

      // Module filter
      if (selectedModule !== 'all' && log.moduleLabel !== selectedModule) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches = 
          (log.moduleLabel && log.moduleLabel.toLowerCase().includes(q)) ||
          (log.collectionName && log.collectionName.toLowerCase().includes(q)) ||
          (log.userName && log.userName.toLowerCase().includes(q)) ||
          (log.causeTitle && log.causeTitle.toLowerCase().includes(q)) ||
          (log.recordSummary && log.recordSummary.toLowerCase().includes(q)) ||
          (log.recordId && log.recordId.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [errorLogs, selectedCause, selectedStatus, selectedUserFilter, selectedModule, searchQuery]);

  const unresolvedCount = useMemo(() => {
    return errorLogs.filter(l => !l.isResolved).length;
  }, [errorLogs]);

  const getCauseIcon = (type: string) => {
    switch (type) {
      case 'no_connection':
        return <WifiOff className="w-4 h-4 text-rose-600" />;
      case 'table_not_found':
        return <Table className="w-4 h-4 text-orange-600" />;
      case 'permission_denied':
        return <Lock className="w-4 h-4 text-purple-600" />;
      case 'timeout':
        return <Hourglass className="w-4 h-4 text-amber-600" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-slate-600" />;
    }
  };

  const getCauseBadge = (type: string) => {
    switch (type) {
      case 'no_connection':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200">
            <WifiOff size={13} className="text-rose-600" />
            <span>عدم اتصال شبکه/سرور</span>
          </span>
        );
      case 'table_not_found':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-orange-50 text-orange-700 border border-orange-200">
            <Table size={13} className="text-orange-600" />
            <span>جدول وجود ندارد</span>
          </span>
        );
      case 'permission_denied':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-purple-50 text-purple-700 border border-purple-200">
            <Lock size={13} className="text-purple-600" />
            <span>عدم لغو دسترسی</span>
          </span>
        );
      case 'timeout':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-50 text-amber-700 border border-amber-200">
            <Hourglass size={13} className="text-amber-600" />
            <span>تایم‌اوت ۴ ثانیه‌ای</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-slate-100 text-slate-700 border border-slate-200">
            <AlertTriangle size={13} />
            <span>خطای دیتابیس</span>
          </span>
        );
    }
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-red-700 text-white flex items-center justify-center border border-white/20 shadow-lg shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">پایش و بازرسی خطاهای ثبت در دیتابیس (DB Save Errors)</h1>
                {unresolvedCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                    <AnimatedCounter value={unresolvedCount} /> مورد جدید
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 font-medium mt-1">
                {isGlobalManager 
                  ? 'مشاهده کامل خطاهای تمامی کاربران و مسئولین جهت تشخیص دقیق علت عدم ثبت اطلاعات (قطعی شبکه یا نبود جدول)'
                  : 'مشاهده گزارش‌های خطای ثبت دیتابیس مربوط به حساب شما به همراه علت مشخص خطا'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={fetchErrors}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer border border-white/20"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span>بروزرسانی لاگ‌ها</span>
            </button>

            <button
              onClick={handleExportJSON}
              disabled={errorLogs.length === 0}
              className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold transition-all border border-white/20 cursor-pointer"
              title="خروجی گزارش JSON"
            >
              <Download size={15} />
              <span className="hidden sm:inline">دانلود JSON</span>
            </button>
          </div>
        </div>

        {/* RBAC Notice Badge */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-indigo-200">
          <div className="flex items-center gap-2">
            <ShieldAlert size={14} className="text-amber-400 shrink-0" />
            <span className="font-bold">
              {isGlobalManager
                ? `دسترسی ویژه مدیر ارشد/آموزش/مالی فعال است: شما در حال مشاهده خطاهای تمام کاربران (${errorLogs.length} مورد) هستید.`
                : `مشاهده محدود: لاگ‌های عدم ثبت دیتابیس مربوط به کاربر «${currentUser?.name}»`}
            </span>
          </div>
        </div>
      </div>

      {/* Notice Toast */}
      {statusNotice && (
        <div className={cn(
          "p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs border animate-in fade-in duration-200",
          statusNotice.type === 'success' ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
          statusNotice.type === 'error' ? "bg-rose-50 text-rose-800 border-rose-200" : "bg-blue-50 text-blue-800 border-blue-200"
        )}>
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 shrink-0" />
            <span>{statusNotice.text}</span>
          </div>
          <button onClick={() => setStatusNotice(null)} className="text-slate-500 hover:text-slate-800 cursor-pointer">
            <XCircle size={16} />
          </button>
        </div>
      )}

      {/* Filters & Control Panel */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        
        {/* Cause Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-xs text-slate-400 font-bold shrink-0 flex items-center gap-1 ml-1">
            <Filter size={13} />
            <span>تفکیک علت خطا:</span>
          </span>

          {[
            { id: 'all', label: 'همه علت‌ها' },
            { id: 'no_connection', label: 'عدم اتصال (شبکه/سرور)' },
            { id: 'table_not_found', label: 'جدول وجود ندارد' },
            { id: 'permission_denied', label: 'عدم لغو دسترسی' },
            { id: 'timeout', label: 'تایم‌اوت ۴ ثانیه‌ای' }
          ].map(cause => (
            <button
              key={cause.id}
              onClick={() => setSelectedCause(cause.id)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border flex items-center gap-1.5",
                selectedCause === cause.id
                  ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              )}
            >
              {cause.id !== 'all' && getCauseIcon(cause.id)}
              <span>{cause.label}</span>
            </button>
          ))}
        </div>

        {/* Search & Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Search Query */}
          <div className="relative">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در نام کاربر، بخش، رکورد یا متن خطا..."
              className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-bold"
            />
          </div>

          {/* User Filter Dropdown (Manager only) */}
          {isGlobalManager && (
            <div>
              <select
                value={selectedUserFilter}
                onChange={(e) => setSelectedUserFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-bold cursor-pointer"
              >
                <option value="all">همه کاربران و مسئولین ({userOptions.length})</option>
                {userOptions.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          )}

          {/* Module Filter Dropdown */}
          <div>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-bold cursor-pointer"
            >
              <option value="all">همه بخش‌های نرم‌افزار ({moduleOptions.length})</option>
              {moduleOptions.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-bold cursor-pointer"
            >
              <option value="all">همه وضعیت‌ها (حل‌شده و جدید)</option>
              <option value="unresolved">فقط موارد حل‌نشده (جدید)</option>
              <option value="resolved">فقط موارد بررسی و حل‌شده</option>
            </select>
          </div>
        </div>

        {/* Test Log Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400 font-bold">ثبت خطای دیتابیس آزمایشی جهت تست:</span>
            <button
              onClick={() => handleCreateTestError('no_connection')}
              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <PlusCircle size={12} />
              <span>تست عدم اتصال</span>
            </button>
            <button
              onClick={() => handleCreateTestError('table_not_found')}
              className="px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <PlusCircle size={12} />
              <span>تست عدم وجود جدول</span>
            </button>
            <button
              onClick={() => handleCreateTestError('timeout')}
              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <PlusCircle size={12} />
              <span>تست تایم‌اوت</span>
            </button>
          </div>

          <span className="text-slate-400 font-bold text-[11px]">
            تعداد نتایج یافت‌شده: <AnimatedCounter value={filteredLogs.length} /> مورد
          </span>
        </div>
      </div>

      {/* Main Error Log Cards List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-xs font-bold text-slate-600">در حال دریافت و تحلیل خطاهای ثبت دیتابیس...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            <p className="text-sm font-black text-slate-800">هیچ خطای دیتابیسی با فیلترهای انتخابی یافت نشد.</p>
            <p className="text-xs text-slate-400 font-medium">تمام عملیات‌های نگارش دیتابیس با موفقیت ثبت شده و پایدار هستند.</p>
          </div>
        ) : (
          filteredLogs.map(log => {
            const isExpanded = expandedId === log.id;
            return (
              <div
                key={log.id}
                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                className={cn(
                  "bg-white rounded-3xl border text-right transition-all duration-200 overflow-hidden cursor-pointer shadow-2xs hover:shadow-md",
                  log.isResolved ? "border-slate-200 opacity-75" : "border-rose-200/90 ring-1 ring-rose-500/10"
                )}
              >
                {/* Primary Visible Row */}
                <div className="p-4 sm:p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Module & Cause Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {getCauseBadge(log.causeType)}
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] font-black rounded-full">
                        بخش: {log.moduleLabel}
                      </span>
                      {log.recordId && (
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-mono font-bold rounded-md">
                          کد رکورد: {log.recordId}
                        </span>
                      )}
                    </div>

                    {/* Action Tools */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleToggleResolved(log, e)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer shadow-2xs",
                          log.isResolved
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                        )}
                      >
                        <Check size={14} className={log.isResolved ? "text-emerald-600" : "text-slate-400"} />
                        <span>{log.isResolved ? 'حل‌شده' : 'علامت‌گذاری به عنوان حل‌شده'}</span>
                      </button>

                      {isGlobalManager && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteLog(log.id, e)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                          title="حذف لاگ"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}

                      <div className="p-1 text-slate-400">
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>
                  </div>

                  {/* Summary & Cause Title */}
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-black text-slate-900 leading-snug">
                      {log.causeTitle}
                    </h3>
                    <p className="text-xs font-medium text-slate-600 leading-relaxed">
                      {log.causeDescription}
                    </p>
                  </div>

                  {/* Record Summary Kicker */}
                  <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-bold text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-indigo-600 shrink-0" />
                      <span>اقدام مورد نظر: {log.recordSummary}</span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium shrink-0">
                      <span className="flex items-center gap-1 text-slate-600 font-bold">
                        <User size={12} className="text-slate-400" />
                        {log.userName} ({log.userRole})
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDate(log.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div className="p-5 bg-slate-900 text-slate-100 border-t border-slate-800 text-xs space-y-3 font-mono dir-ltr text-left">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2">
                      <span>ERROR LOG ID: {log.id}</span>
                      <span>COLLECTION: {log.collectionName}</span>
                    </div>

                    <div>
                      <span className="text-rose-400 font-bold text-[11px] block mb-1">RAW DATABASE EXCEPTION MESSAGE:</span>
                      <pre className="bg-slate-950 p-3 rounded-xl text-rose-300 overflow-x-auto text-[11px] font-mono leading-relaxed whitespace-pre-wrap">
                        {log.rawErrorMessage || 'No raw stack trace recorded.'}
                      </pre>
                    </div>

                    {log.resolutionNote && (
                      <div className="dir-rtl text-right font-vazir">
                        <span className="text-emerald-400 font-bold text-[11px] block mb-1">یادداشت بررسی و حل مشکل:</span>
                        <p className="bg-slate-950 p-2.5 rounded-xl text-emerald-200 text-xs font-bold">
                          {log.resolutionNote}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
