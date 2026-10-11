import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Download,
  ShieldAlert,
  Server,
  Zap,
  CheckCircle2,
  User,
  ArrowRight,
  LifeBuoy,
  Wrench,
  Database,
  HardDrive
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { localDb } from '../lib/localDb';

export interface MonitoringEventItem {
  id: string | number;
  created_at: string;
  event_type: string;
  severity: 'critical' | 'error' | 'warn' | 'info';
  fingerprint?: string;
  section_name: string;
  route_path?: string;
  status_code?: number;
  duration_ms?: number;
  request_id?: string;
  user_id?: string;
  user_role?: string;
  display_name?: string;
  short_message: string;
  short_stack?: string;
  app_version?: string;
  metadata_json?: any;
}

export default function LogViewer() {
  const { currentUser } = useAuth();
  const [events, setEvents] = useState<MonitoringEventItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'error' | 'warn' | 'info'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | number | null>(null);
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Maintenance Mode & Backup states
  const [maintenanceState, setMaintenanceState] = useState<{
    enabled: boolean;
    message: string;
    enabledAt: string | null;
    enabledBy: string | null;
    estimatedDuration: string | null;
  }>({
    enabled: false,
    message: '',
    enabledAt: null,
    enabledBy: null,
    estimatedDuration: null
  });
  const [isTogglingMaintenance, setIsTogglingMaintenance] = useState(false);
  const [isTakingBackup, setIsTakingBackup] = useState(false);

  // Fetch monitoring events from server API
  const fetchEvents = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/monitor/events?limit=150&severity=${severityFilter}&eventType=${typeFilter}`, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          setEvents(data.events || []);
          setTotalCount(data.total || data.events?.length || 0);
          return;
        }
      }

      // Fallback: load from client storage
      const localLogs = await localDb.getDocs<any>('app_logs').catch(() => []);
      const mapped: MonitoringEventItem[] = (localLogs || []).map((item: any, idx: number) => ({
        id: item.id || `local_${idx}`,
        created_at: item.created_at || new Date().toISOString(),
        event_type: 'client_log',
        severity: (item.level as any) || 'info',
        section_name: item.path || 'مرورگر کلاینت',
        route_path: item.path,
        short_message: item.message || 'پیام ثبت شده',
        display_name: item.user_name || 'کاربر سیستم',
        user_role: item.user_role || 'ناشناس',
        request_id: item.trace_id || item.id,
        short_stack: item.stack
      }));
      setEvents(mapped);
      setTotalCount(mapped.length);
    } catch (err: any) {
      setNotice({ type: 'error', text: 'خطا در برقراری ارتباط با پایشگر سرور: ' + (err?.message || 'ناشناخته') });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();

    // Auto-refresh every 30 seconds only while page is open (Rule 3)
    autoRefreshTimerRef.current = setInterval(() => {
      fetchEvents(true);
    }, 30000);

    return () => {
      if (autoRefreshTimerRef.current) clearInterval(autoRefreshTimerRef.current);
    };
  }, [severityFilter, typeFilter]);

  // Retention Purge Action
  const handlePurge = async () => {
    if (!window.confirm('آیا از پاکسازی داده‌های قدیمی پایش (رویدادهای قدیمی‌تر از ۱۴ روز یا مازاد بر سقف حافظه) اطمینان دارید؟')) {
      return;
    }

    setPurging(true);
    try {
      const res = await fetch('/api/monitor/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data && data.success) {
        setNotice({ type: 'success', text: data.message || 'پاکسازی خودکار با موفقیت پایان یافت.' });
        fetchEvents();
      } else {
        setNotice({ type: 'error', text: data.message || 'خطا در اجرای پاکسازی' });
      }
    } catch (err: any) {
      setNotice({ type: 'error', text: 'خطا در ارتباط با سرور جهت پاکسازی: ' + err?.message });
    } finally {
      setPurging(false);
    }
  };

  // Fetch Maintenance Mode state
  const fetchMaintenanceState = async () => {
    try {
      const res = await fetch('/api/monitor/maintenance');
      const data = await res.json();
      if (data && data.success && data.state) {
        setMaintenanceState(data.state);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchMaintenanceState();
  }, []);

  // Toggle Maintenance Mode
  const handleToggleMaintenance = async () => {
    const nextEnabled = !maintenanceState.enabled;
    const confirmMsg = nextEnabled
      ? 'آیا از فعال‌سازی «حالت تعمیر و بروزرسانی» سامانه اطمینان دارید؟\nدر این حالت کاربران عادی پیام محترمانه بروزرسانی را مشاهده می‌کنند و فقط مدیران ارشد، آموزش و مالی به سامانه دسترسی خواهند داشت.'
      : 'آیا مایلید حالت تعمیر غیرفعال شده و سامانه برای کلیه کاربران بازگشایی شود؟';

    if (!window.confirm(confirmMsg)) return;

    setIsTogglingMaintenance(true);
    try {
      const res = await fetch('/api/monitor/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: nextEnabled,
          message: 'سامانه در حال بروزرسانی و پشتیبان‌گیری دوره‌ای می‌باشد. لطفاً دقایقی دیگر مراجعه فرمایید.',
          estimatedDuration: '۱۵ دقیقه'
        })
      });
      const data = await res.json();
      if (data && data.success) {
        setMaintenanceState(data.state);
        setNotice({
          type: 'success',
          text: data.message || (nextEnabled ? 'حالت تعمیر فعال شد.' : 'حالت تعمیر غیرفعال شد.')
        });
      } else {
        setNotice({ type: 'error', text: data.message || 'خطا در تغییر وضعیت حالت تعمیر' });
      }
    } catch (err: any) {
      setNotice({ type: 'error', text: 'خطا در ارتباط با سرور: ' + err?.message });
    } finally {
      setIsTogglingMaintenance(false);
    }
  };

  // One-click Immediate Backup from Monitoring Dashboard
  const handleTakeImmediateBackup = async () => {
    setIsTakingBackup(true);
    try {
      const res = await fetch('/api/database/scheduled-backups/run-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotice({
          type: 'success',
          text: data.message || 'نسخه پشتیبان کامل پایگاه داده با موفقیت ایجاد و ذخیره شد.'
        });
      } else {
        setNotice({ type: 'error', text: data.message || 'خطا در ایجاد نسخه پشتیبان.' });
      }
    } catch (err: any) {
      setNotice({ type: 'error', text: 'خطا در ایجاد نسخه پشتیبان: ' + err?.message });
    } finally {
      setIsTakingBackup(false);
    }
  };

  // Direct Download of Full Database Snapshot from Monitoring Dashboard
  const handleDownloadBackupSnapshot = async () => {
    setIsTakingBackup(true);
    try {
      const res = await fetch('/api/database/snapshot');
      if (!res.ok) throw new Error('خطا در دریافت فایل پشتیبان از سرور.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `madrasah_backup_${new Date().toISOString().substring(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setNotice({
        type: 'success',
        text: 'فایل پشتیبان کامل دیتابیس با موفقیت دانلود شد و عملیات در لاگ امنیتی ثبت گردید.'
      });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'خطا در دانلود نسخه پشتیبان.' });
    } finally {
      setIsTakingBackup(false);
    }
  };

  // Helper to suggest actionable guidance for non-technical managers
  const getActionGuidance = (ev: MonitoringEventItem): string => {
    const msg = (ev.short_message || '').toLowerCase();
    const type = ev.event_type;

    if (type === 'slow_request' || type === 'slow_query') {
      return 'درخواست زمان‌بر بوده اما با موفقیت پایان یافته است. نیازی به اقدام فوری نیست؛ در ساعات شلوغی طبیعی است.';
    }
    if (type === 'failed_login') {
      return 'تلاش ناموفق برای ورود. در صورت تکرار مکرر، با کاربر تماس بگیرید یا رمز عبور ایشان را بازنشانی کنید.';
    }
    if (type === 'chunk_load_failed') {
      return 'نسخه جدید در سرور مستقر شده یا کش مرورگر قدیمی است. از کاربر بخواهید صفحه را با دکمه رفرش نوسازی کند.';
    }
    if (type === 'db_save_failure' || msg.includes('duplicate')) {
      return 'ثبت تکراری یا تعارض در ذخیره‌سازی رخ داده است. داده‌های صفحه را مجدداً بررسی کنید.';
    }
    if (ev.status_code === 401 || ev.status_code === 403 || msg.includes('دسترسی') || msg.includes('auth')) {
      return 'نشست یا مجوز کاربر منقضی شده است. از کاربر بخواهید یک بار از حساب خارج شده و مجدداً وارد شود.';
    }
    if (ev.severity === 'critical') {
      return 'خطای مهم نیازمند بررسی. دکمه «کپی گزارش برای هوش مصنوعی / پشتیبان» را فشرده و برای تیم فنی ارسال کنید.';
    }
    return 'خطای موقت در پردازش کلاینت. با بارگذاری مجدد بخش حل می‌شود.';
  };

  // One-click Copy Full Diagnostic Summary for Developer / AI Studio
  const handleCopyDiagnosticSummary = () => {
    const nowPersian = formatShamsiDate(new Date().toISOString());
    const criticalEvents = events.filter(e => e.severity === 'critical' || e.severity === 'error');
    
    let report = `### گزارش وضعیت و پایش سامانه مدرسه علمیه امام کاظم (ع)
**تاریخ گزارش:** ${nowPersian}
**گزارش‌دهنده:** ${currentUser?.name || 'مدیر سامانه'} (${currentUser?.roleTitle || 'مسئول'})
**تعداد کل رویدادهای ثبت‌شده:** ${totalCount}
**تعداد خطاهای نیازمند توجه:** ${criticalEvents.length}

---
#### آخرین رویدادها و خطاهای شناسایی‌شده:
`;

    const sample = events.slice(0, 8);
    if (sample.length === 0) {
      report += '\nهیچ خطایی در سامانه ثبت نشده و کلیه بخش‌ها پایدار هستند.\n';
    } else {
      sample.forEach((e, idx) => {
        report += `\n${idx + 1}. **[${e.severity.toUpperCase()}] در بخش ${e.section_name}**
- زمان: ${formatShamsiDate(e.created_at)}
- کاربر: ${e.display_name || 'نامشخص'} (نقش: ${e.user_role || '-'})
- مسیر: ${e.route_path || '-'} | کد وضعیت: ${e.status_code || '-'} | پیگیری: ${e.request_id || '-'}
- پیام فنی: ${e.short_message}
- راهکار پیشنهادی: ${getActionGuidance(e)}
`;
      });
    }

    report += `\n---\n*این گزارش توسط سامانه پایش یکپارچه و به صورت امن و پالایش‌شده تهیه گردیده است.*`;

    navigator.clipboard.writeText(report).then(() => {
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 3000);
    }).catch(() => {});
  };

  const formatShamsiDate = (dateStr: string) => {
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

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const inMsg = (ev.short_message || '').toLowerCase().includes(q);
        const inSec = (ev.section_name || '').toLowerCase().includes(q);
        const inUser = (ev.display_name || '').toLowerCase().includes(q);
        const inReq = (ev.request_id || '').toLowerCase().includes(q);
        const inRoute = (ev.route_path || '').toLowerCase().includes(q);
        if (!inMsg && !inSec && !inUser && !inReq && !inRoute) return false;
      }
      return true;
    });
  }, [events, searchQuery]);

  // Quick KPI calculation
  const stats = useMemo(() => {
    const errorCount = events.filter(e => e.severity === 'error' || e.severity === 'critical').length;
    const slowCount = events.filter(e => e.event_type === 'slow_request' || e.event_type === 'slow_query').length;
    const clientCount = events.filter(e => e.event_type === 'client_error' || e.event_type === 'chunk_load_failed').length;
    const isHealthy = errorCount === 0;

    return { errorCount, slowCount, clientCount, isHealthy };
  }, [events]);

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
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">سامانه پایش، عیب‌یابی و پشتیبانی هوشمند</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  سبک و ایمن (نسخه ۲.۰)
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                مشاهده لحظه‌ای: «آیا چیزی خراب است؟»، «کجا و برای چه کسی؟» و «چه باید کرد؟» بدون نیاز به تخصص برنامه‌نویسی
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={() => fetchEvents()}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer border border-white/20"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span>بروزرسانی</span>
            </button>

            <button
              onClick={handleCopyDiagnosticSummary}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer border border-indigo-400/40"
              title="کپی متن کامل جهت ارسال به برنامه‌نویس یا هوش مصنوعی"
            >
              {copiedSummary ? <Check size={15} className="text-emerald-300" /> : <Copy size={15} />}
              <span>{copiedSummary ? 'گزارش کپی شد' : 'کپی گزارش برای هوش مصنوعی'}</span>
            </button>

            <button
              onClick={handlePurge}
              disabled={purging}
              className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white/10 hover:bg-rose-600/80 text-white rounded-2xl text-xs font-bold transition-all border border-white/20 cursor-pointer"
              title="پاکسازی خودکار رکوردهای مازاد و قدیمی‌تر از ۱۴ روز"
            >
              <Trash2 size={15} />
              <span className="hidden sm:inline">آزادسازی فضا (Purge)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notice alert */}
      {notice && (
        <div className={cn(
          "p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs border animate-in fade-in duration-200",
          notice.type === 'success' ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
          notice.type === 'error' ? "bg-rose-50 text-rose-800 border-rose-200" : "bg-blue-50 text-blue-800 border-blue-200"
        )}>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>{notice.text}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-slate-500 hover:text-slate-800 cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* THREE ESSENTIAL QUESTIONS (QUESTION 1: «چیزی خراب است؟») */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Status Card */}
        <div className={cn(
          "p-5 rounded-3xl border shadow-xs transition-all flex items-center gap-4",
          stats.isHealthy ? "bg-white border-emerald-200" : "bg-rose-50/50 border-rose-200"
        )}>
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border",
            stats.isHealthy ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-rose-100 text-rose-600 border-rose-300"
          )}>
            {stats.isHealthy ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500">وضعیت کلی سامانه</div>
            <div className={cn("text-base font-black mt-0.5", stats.isHealthy ? "text-emerald-700" : "text-rose-700")}>
              {stats.isHealthy ? 'پایدار و بدون خطای فعال' : `${stats.errorCount} خطا نیازمند بررسی`}
            </div>
          </div>
        </div>

        {/* Server Critical Errors */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
            <Server size={22} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500">خطاهای سرور</div>
            <div className="text-lg font-black text-slate-800 mt-0.5">{stats.errorCount} مورد</div>
          </div>
        </div>

        {/* Slow Requests / Processing */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
            <Zap size={22} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500">پردازش‌های کند ({'>'} ۸۰۰ms)</div>
            <div className="text-lg font-black text-slate-800 mt-0.5">{stats.slowCount} مورد</div>
          </div>
        </div>

        {/* Browser / Client Errors */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center shrink-0">
            <LifeBuoy size={22} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500">گزارش‌های مرورگر کاربران</div>
            <div className="text-lg font-black text-slate-800 mt-0.5">{stats.clientCount} مورد</div>
          </div>
        </div>
      </div>

      {/* OPERATIONS & CONTROLS BAR: Maintenance Mode & Instant Backup */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Maintenance Mode Card */}
        <div className={cn(
          "p-5 rounded-3xl border shadow-xs transition-all flex flex-col justify-between space-y-3",
          maintenanceState.enabled ? "bg-amber-50/60 border-amber-300" : "bg-white border-slate-200"
        )}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border",
                maintenanceState.enabled ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-slate-100 text-slate-600 border-slate-200"
              )}>
                <Wrench size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black text-slate-900">حالت تعمیر و بروزرسانی سامانه</h3>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                    maintenanceState.enabled 
                      ? "bg-amber-100 text-amber-800 border-amber-300" 
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  )}>
                    {maintenanceState.enabled ? 'روشن (دسترسی عمومی مسدود)' : 'خاموش (سامانه عمومی فعال)'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  هنگام بروزرسانی، کاربران پیام محترمانه مشاهده می‌کنند؛ مدیران (ارشد، آموزش، مالی) دسترسی کامل دارند.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-[11px] text-slate-400 font-medium">
              {maintenanceState.enabled && maintenanceState.enabledBy 
                ? `فعال‌شده توسط: ${maintenanceState.enabledBy}` 
                : 'تغییر وضعیت در لاگ‌های امنیتی ثبت می‌شود'}
            </span>
            <button
              type="button"
              onClick={handleToggleMaintenance}
              disabled={isTogglingMaintenance}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 border",
                maintenanceState.enabled
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-xs"
                  : "bg-amber-600 hover:bg-amber-700 text-white border-amber-600 shadow-xs"
              )}
            >
              <Wrench size={13} />
              <span>{maintenanceState.enabled ? 'خاموش کردن حالت تعمیر' : 'روشن کردن حالت تعمیر'}</span>
            </button>
          </div>
        </div>

        {/* Database Backup Quick Action Card */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center shrink-0">
                <Database size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black text-slate-900">پشتیبان‌گیری سریع پایگاه داده</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    امضای SHA-256
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  تهیه فایل پشتیبان فوری کامل از تمامی جداول بدون قطعی یا کند شدن سامانه.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleDownloadBackupSnapshot}
              disabled={isTakingBackup}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              title="دانلود فایل پشتیبان کامل روی رایانه"
            >
              <Download size={13} />
              <span>دانلود اسنپ‌شات (JSON)</span>
            </button>
            <button
              type="button"
              onClick={handleTakeImmediateBackup}
              disabled={isTakingBackup}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-xs"
              title="اجرای پشتیبان‌گیری خودکار و نگهداری در سرور"
            >
              <HardDrive size={13} />
              <span>پشتیبان‌گیری در سرور</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو بر اساس بخش، کاربر، کد پیگیری، یا متن رویداد..."
              className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-bold"
            />
          </div>

          {/* Severity Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 shrink-0">
            <span className="text-xs text-slate-400 font-bold shrink-0 flex items-center gap-1 ml-1">
              <Filter size={13} />
              <span>شدت:</span>
            </span>
            {[
              { id: 'all', label: 'همه' },
              { id: 'critical', label: 'بحرانی' },
              { id: 'error', label: 'خطا' },
              { id: 'warn', label: 'هشدار / کندی' },
              { id: 'info', label: 'اطلاعات' }
            ].map((lvl) => (
              <button
                key={lvl.id}
                onClick={() => setSeverityFilter(lvl.id as any)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border",
                  severityFilter === lvl.id
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                )}
              >
                {lvl.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* QUESTION 2 & 3: «کجا؟» و «چه کنم؟» Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-xs font-bold text-slate-600">در حال دریافت داده‌های پایش...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            <p className="text-base font-black text-slate-800">هیچ رویداد خطایی ثبت نشده است!</p>
            <p className="text-xs text-slate-500">تمامی بخش‌های مدرسه علمیه پایدار و در وضعیت سالم هستند.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-3 px-4">شدت</th>
                  <th className="py-3 px-4">کجا؟ (بخش سامانه)</th>
                  <th className="py-3 px-4">چه کسی؟ (کاربر و نقش)</th>
                  <th className="py-3 px-4">چه اتفاقی افتاد؟</th>
                  <th className="py-3 px-4">چه کنم؟ (اقدام پیشنهادی)</th>
                  <th className="py-3 px-4 text-center">زمان</th>
                  <th className="py-3 px-4 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredEvents.map((ev) => {
                  const isExpanded = expandedId === ev.id;
                  const guidance = getActionGuidance(ev);

                  return (
                    <React.Fragment key={ev.id}>
                      <tr 
                        onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                        className={cn(
                          "hover:bg-slate-50/80 transition-colors cursor-pointer",
                          ev.severity === 'critical' ? "bg-rose-50/20" :
                          ev.severity === 'error' ? "bg-rose-50/10" : ""
                        )}
                      >
                        {/* Severity Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {ev.severity === 'critical' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white">
                              بحرانی
                            </span>
                          ) : ev.severity === 'error' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200">
                              خطا
                            </span>
                          ) : ev.severity === 'warn' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 border border-amber-200">
                              هشدار
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-sky-100 text-sky-700 border border-sky-200">
                              اطلاعات
                            </span>
                          )}
                        </td>

                        {/* Section Name («کجا؟») */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-black text-slate-800">{ev.section_name}</div>
                          {ev.route_path && (
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5 ltr text-right">
                              {ev.route_path}
                            </div>
                          )}
                        </td>

                        {/* User & Role («چه کسی؟») */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                            <User size={13} className="text-slate-400" />
                            <span>{ev.display_name || 'کاربر ناشناس'}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {ev.user_role || 'بدون نقش ثبت‌شده'}
                          </div>
                        </td>

                        {/* Message («چه اتفاقی افتاد؟») */}
                        <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                          <div className="text-slate-700 font-bold truncate" title={ev.short_message}>
                            {ev.short_message}
                          </div>
                          {ev.request_id && (
                            <div className="text-[10px] font-mono text-indigo-600 mt-0.5">
                              کد پیگیری: {ev.request_id}
                            </div>
                          )}
                        </td>

                        {/* Guidance («چه کنم؟») */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700 font-bold leading-relaxed">
                            {guidance}
                          </div>
                        </td>

                        {/* Date & Time */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-center text-slate-500 text-[11px]">
                          {formatShamsiDate(ev.created_at)}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const copyText = `کد پیگیری: ${ev.request_id || '-'}\nبخش: ${ev.section_name}\nخطا: ${ev.short_message}\nزمان: ${formatShamsiDate(ev.created_at)}`;
                              navigator.clipboard.writeText(copyText);
                              setCopiedId(ev.id);
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors cursor-pointer"
                            title="کپی جزئیات خطا"
                          >
                            {copiedId === ev.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Technical Details */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b border-slate-200">
                          <td colSpan={7} className="p-4 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                              <div className="p-3 bg-white rounded-xl border border-slate-200">
                                <span className="font-bold text-slate-500">کد پیگیری درخواست:</span>
                                <span className="font-mono font-bold text-slate-800 mr-2">{ev.request_id || 'ندارد'}</span>
                              </div>
                              <div className="p-3 bg-white rounded-xl border border-slate-200">
                                <span className="font-bold text-slate-500">مدت زمان پردازش:</span>
                                <span className="font-mono font-bold text-slate-800 mr-2">{ev.duration_ms ? `${ev.duration_ms} ms` : '-'}</span>
                              </div>
                              <div className="p-3 bg-white rounded-xl border border-slate-200">
                                <span className="font-bold text-slate-500">کد پاسخ HTTP:</span>
                                <span className="font-mono font-bold text-slate-800 mr-2">{ev.status_code || '-'}</span>
                              </div>
                            </div>

                            {ev.short_stack && (
                              <div className="space-y-1">
                                <span className="text-[11px] font-bold text-slate-600">ردیابی فنی (Stack Trace پالایش‌شده):</span>
                                <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-x-auto ltr text-left leading-relaxed">
                                  {ev.short_stack}
                                </pre>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
