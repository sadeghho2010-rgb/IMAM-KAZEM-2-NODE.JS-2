import React, { useState, useEffect } from 'react';
import {
  Activity,
  Search,
  Filter,
  RotateCcw,
  Trash2,
  Edit3,
  PlusCircle,
  RefreshCw,
  UserCheck,
  ShieldAlert,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Download,
  AlertTriangle,
  Info,
  ChevronLeft,
  X,
  FileText,
  Users,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { localDb } from '../lib/localDb';
import { revertAuditActivity } from '../lib/auditLogger';
import { AuditLog, AuditActionType, UserLevel } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const ALL_SITE_MODULES = [
  { id: 'students', label: 'مدیریت کل طلاب', icon: '👤', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
  { id: 'programs', label: 'برنامه‌های آموزشی و سرفصل‌ها', icon: '📚', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
  { id: 'attendance', label: 'حضور و غیاب طلاب', icon: '📋', color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
  { id: 'stats', label: 'آمار و گزارشات مطالعه', icon: '📊', color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
  { id: 'research', label: 'بخش پژوهش و مقالات', icon: '🔬', color: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100' },
  { id: 'discussion', label: 'گروه‌های بحثی', icon: '👥', color: 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100' },
  { id: 'comments', label: 'نظرات و ارزیابی تربیتی', icon: '💬', color: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' },
  { id: 'todos', label: 'پیگیری‌ها و تسک‌ها', icon: '✅', color: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' },
  { id: 'academic-calendar', label: 'تقویم آموزشی', icon: '🗓️', color: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100' },
  { id: 'teachers-bank', label: 'بانک اساتید', icon: '🎓', color: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100' },
  { id: 'presence-hours', label: 'ساعت حضور و کارکرد', icon: '⏱️', color: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' },
  { id: 'classrooms', label: 'مدرس‌ها و فضاهای درسی', icon: '🏛️', color: 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100' },
  { id: 'workflow', label: 'جریان کار و کارتابل', icon: '⚡', color: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100' },
  { id: 'student-schedule', label: 'برنامه درسی طلاب', icon: '📅', color: 'bg-lime-50 text-lime-700 border-lime-200 hover:bg-lime-100' },
  { id: 'user-management', label: 'مدیریت کاربران و دسترسی‌ها', icon: '🔐', color: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100' },
  { id: 'backup', label: 'پشتیبان‌گیری دیتابیس', icon: '💾', color: 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100' },
];

export default function SiteAuditLogs() {
  const { currentUser } = useAuth();

  // Check access permissions
  const isAuthorized = currentUser && (
    currentUser.level === 1 ||
    currentUser.role === 'super_admin' ||
    currentUser.role === 'education_manager' ||
    currentUser.role === 'education_officer' ||
    currentUser.username.toUpperCase() === 'SHAH'
  );

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedRoleGroup, setSelectedRoleGroup] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Modal States
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<AuditLog | null>(null);
  const [selectedLogForRevert, setSelectedLogForRevert] = useState<AuditLog | null>(null);
  const [isReverting, setIsReverting] = useState<boolean>(false);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const records = await localDb.getDocs<AuditLog>('audit_logs');
      // Sort by timestamp descending (newest first)
      records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(records);
    } catch (e) {
      console.error('Error fetching audit logs:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    const unsubscribe = localDb.subscribe(() => {
      loadLogs();
    });
    return () => unsubscribe();
  }, []);

  if (!isAuthorized) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-rose-200 shadow-sm text-rose-700 font-bold max-w-2xl mx-auto space-y-3" dir="rtl">
        <ShieldAlert size={48} className="mx-auto text-rose-500" />
        <h2 className="text-lg font-black">عدم دسترسی به بخش فعالیت‌های سایت</h2>
        <p className="text-xs text-rose-600 leading-relaxed">
          مشاهده و مدیریت ثبت کلیه تغییرات و فعالیت‌های سایت تنها در انحصار کاربران سطح ۱ (مدیریت کل و سوپر ادمین) و مسئول محترم آموزش سامانه می‌باشد.
        </p>
      </div>
    );
  }

  // Get list of unique users from logs for user dropdown filter
  const userOptions = Array.from(
    new Set(logs.map(l => JSON.stringify({ username: l.username, name: l.userName, roleTitle: l.userRoleTitle })))
  ).map(str => JSON.parse(str));

  // Combined module options (Static ALL_SITE_MODULES + dynamically discovered modules)
  const combinedModuleOptions = [...ALL_SITE_MODULES];
  logs.forEach(l => {
    if (l.module && !combinedModuleOptions.some(m => m.id === l.module)) {
      combinedModuleOptions.push({
        id: l.module,
        label: l.moduleTitle || l.module,
        icon: '📁',
        color: 'bg-slate-50 text-slate-700 border-slate-200'
      });
    }
  });

  // Filtering Logic
  const filteredLogs = logs.filter(log => {
    // Search Term
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      const matchText = (
        (log.description || '').toLowerCase().includes(term) ||
        (log.userName || '').toLowerCase().includes(term) ||
        (log.username || '').toLowerCase().includes(term) ||
        (log.entityName || '').toLowerCase().includes(term) ||
        (log.moduleTitle || '').toLowerCase().includes(term)
      );
      if (!matchText) return false;
    }

    // Role Group Filter
    if (selectedRoleGroup === 'level_1' && log.userLevel !== 1) return false;
    if (selectedRoleGroup === 'education' && log.userRole !== 'education_manager' && log.userRole !== 'education_officer' && log.username?.toUpperCase() !== 'SHAH') return false;
    if (selectedRoleGroup === 'research' && log.userRole !== 'research_manager' && log.userRole !== 'research_officer' && log.username?.toUpperCase() !== 'YAZDANI') return false;
    if (selectedRoleGroup === 'finance' && log.userRole !== 'finance_manager' && log.userRole !== 'financial_officer' && log.username?.toUpperCase() !== 'MALI') return false;
    if (selectedRoleGroup === 'mentors' && !['grade_mentor', 'grade_supervisor_7', 'grade_supervisor_8', 'grade_supervisor_9', 'grade_supervisor_10'].includes(log.userRole)) return false;
    if (selectedRoleGroup === 'level_3' && log.userLevel !== 3) return false;

    // Specific User Filter
    if (selectedUser !== 'all' && log.username?.toUpperCase() !== selectedUser.toUpperCase()) return false;

    // Module Filter
    if (selectedModule !== 'all') {
      const targetMod = selectedModule.toLowerCase();
      const logMod = (log.module || '').toLowerCase();
      const logTitle = (log.moduleTitle || '').toLowerCase();

      const isMatch = (
        logMod === targetMod ||
        logTitle.includes(targetMod) ||
        (targetMod === 'students' && (logMod === 'students' || logMod === 'active-students')) ||
        (targetMod === 'programs' && (logMod === 'programs' || logMod === 'enrollments')) ||
        (targetMod === 'research' && logMod.includes('research')) ||
        (targetMod === 'stats' && (logMod.includes('study') || logMod === 'stats')) ||
        (targetMod === 'academic-calendar' && logMod.includes('academic')) ||
        (targetMod === 'comments' && (logMod === 'comments' || logMod === 'oral_exams'))
      );
      if (!isMatch) return false;
    }

    // Action Filter
    if (selectedAction !== 'all' && log.actionType !== selectedAction) return false;

    // Date Range Filter
    if (selectedDateFilter !== 'all') {
      const logDate = new Date(log.timestamp).getTime();
      const now = Date.now();
      if (selectedDateFilter === 'today') {
        const oneDayAgo = now - 24 * 3600 * 1000;
        if (logDate < oneDayAgo) return false;
      } else if (selectedDateFilter === 'week') {
        const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;
        if (logDate < sevenDaysAgo) return false;
      } else if (selectedDateFilter === 'month') {
        const thirtyDaysAgo = now - 30 * 24 * 3600 * 1000;
        if (logDate < thirtyDaysAgo) return false;
      }
    }

    return true;
  });

  // Execute Revert Action
  const handleConfirmRevert = async () => {
    if (!selectedLogForRevert) return;
    setIsReverting(true);
    setStatusMessage(null);

    try {
      const currentName = currentUser ? (currentUser.name || currentUser.fullName || currentUser.username) : 'مدیریت سامانه';
      const result = await revertAuditActivity(selectedLogForRevert.id, currentName);

      if (result.success) {
        setStatusMessage({
          type: 'success',
          text: result.message
        });
        setSelectedLogForRevert(null);
        await loadLogs();
      } else {
        setStatusMessage({
          type: 'error',
          text: result.message
        });
      }
    } catch (err: any) {
      console.error('Error in handleConfirmRevert:', err);
      setStatusMessage({
        type: 'error',
        text: `خطا در بازگردانی تغییرات: ${err?.message || 'مشکل غیرمنتظره'}`
      });
    } finally {
      setIsReverting(false);
    }
  };

  // Export Audit Logs as JSON
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `site_activity_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Helper Badge Renderers
  const getActionBadge = (action: AuditActionType) => {
    switch (action) {
      case 'delete':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold">
            <Trash2 size={13} />
            <span>حذف 🗑️</span>
          </span>
        );
      case 'update':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-bold">
            <Edit3 size={13} />
            <span>ویرایش ✏️</span>
          </span>
        );
      case 'create':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold">
            <PlusCircle size={13} />
            <span>ایجاد ➕</span>
          </span>
        );
      case 'status_change':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-50 text-sky-800 border border-sky-200 rounded-lg text-[11px] font-bold">
            <RefreshCw size={13} />
            <span>تغییر وضعیت 🔄</span>
          </span>
        );
      case 'revert':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-lg text-[11px] font-bold">
            <RotateCcw size={13} />
            <span>استرداد / بازگردانی ↩️</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-bold">
            {action}
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 text-right font-vazir" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute -left-12 -top-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-bold backdrop-blur-md border border-white/15">
              <Activity size={14} className="text-emerald-400" />
              <span>سامانه ثبت فعالیت‌ها و ردپای تغییرات (Audit Log)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              فعالیت‌های سایت و مانیتورینگ تغییرات
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              کلیه اقدامات حذفی، ویرایشی و تغییرات انجام شده توسط تمامی کاربران سامانه ثبت و ضبط شده و امکان فیلتر بر اساس نقش و قابلیت استرداد (بازگردانی) فراهم می‌باشد.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/10 p-3.5 rounded-2xl backdrop-blur-md border border-white/15 shrink-0">
            <div className="text-center px-3 py-1">
              <span className="block text-2xl font-black text-white">{logs.length}</span>
              <span className="text-[11px] text-slate-300">کل فعالیت‌ها</span>
            </div>
            <div className="w-px h-8 bg-white/20"></div>
            <div className="text-center px-3 py-1">
              <span className="block text-2xl font-black text-rose-400">
                {logs.filter(l => l.actionType === 'delete').length}
              </span>
              <span className="text-[11px] text-slate-300">موارد حذفی</span>
            </div>
            <div className="w-px h-8 bg-white/20"></div>
            <div className="text-center px-3 py-1">
              <span className="block text-2xl font-black text-emerald-400">
                {logs.filter(l => l.isReverted).length}
              </span>
              <span className="text-[11px] text-slate-300">استرداد شده</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Alert Banner */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              "p-4 rounded-2xl flex items-start gap-3 shadow-sm border text-xs sm:text-sm font-bold",
              statusMessage.type === 'success' && "bg-emerald-50 border-emerald-200 text-emerald-900",
              statusMessage.type === 'error' && "bg-rose-50 border-rose-200 text-rose-900",
              statusMessage.type === 'info' && "bg-sky-50 border-sky-200 text-sky-900"
            )}
          >
            {statusMessage.type === 'success' && <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={20} />}
            {statusMessage.type === 'error' && <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20} />}
            {statusMessage.type === 'info' && <Info className="text-sky-600 shrink-0 mt-0.5" size={20} />}
            <div className="flex-1">{statusMessage.text}</div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FILTER PANEL */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Filter size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">فیلترهای پیشرفته جستجو</h2>
              <p className="text-xs text-slate-500 mt-0.5">مشاهده تغییرات بر اساس کاربر، مسئولیت، بخش و بازه زمانی</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJSON}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={14} />
              <span>خروجی JSON</span>
            </button>
            <button
              onClick={loadLogs}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span>بروزرسانی</span>
            </button>
          </div>
        </div>

        {/* Search Bar & Primary Selects */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Text Search Input */}
          <div className="relative">
            <Search size={16} className="absolute right-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجو در شرح تغییرات، نام کاربر..."
              className="w-full pr-10 pl-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* User Select */}
          <div>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">👤 همه کاربران ثبت‌کننده</option>
              {userOptions.map((u, idx) => (
                <option key={idx} value={u.username}>
                  {u.name} ({u.roleTitle})
                </option>
              ))}
            </select>
          </div>

          {/* Module Select */}
          <div>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">📂 همه بخش‌های سایت (All Modules)</option>
              {combinedModuleOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.icon} {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Action Select */}
          <div>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">⚡ همه انواع عملیات</option>
              <option value="delete">🗑️ حذف (Delete)</option>
              <option value="update">✏️ ویرایش (Update)</option>
              <option value="create">➕ ایجاد (Create)</option>
              <option value="status_change">🔄 تغییر وضعیت</option>
              <option value="revert">↩️ بازگردانی و استرداد</option>
            </select>
          </div>
        </div>

        {/* Visual Module Selection Chips Bar */}
        <div className="pt-3 border-t border-slate-100 space-y-2 text-xs font-bold">
          <div className="flex items-center justify-between">
            <span className="text-slate-800 font-black text-xs flex items-center gap-1.5">
              <Layers size={16} className="text-indigo-600" />
              <span>انتخاب مستقیم بخش‌های اصلی سایت (برای فیلتر آنی روی بخش کلیک کنید):</span>
            </span>
            {selectedModule !== 'all' && (
              <button
                onClick={() => setSelectedModule('all')}
                className="text-[11px] text-rose-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <X size={13} />
                <span>نمایش همه بخش‌ها</span>
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <button
              onClick={() => setSelectedModule('all')}
              className={cn(
                "py-1.5 px-3 rounded-xl transition-all cursor-pointer border text-xs font-bold flex items-center gap-1.5 shadow-2xs",
                selectedModule === 'all'
                  ? "bg-slate-900 text-white border-slate-950 font-black shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              )}
            >
              <span>🏢 همه بخش‌ها</span>
            </button>
            {ALL_SITE_MODULES.map((mod) => {
              const isSelected = selectedModule === mod.id;
              const moduleLogCount = logs.filter(l => {
                const targetMod = mod.id.toLowerCase();
                const logMod = (l.module || '').toLowerCase();
                const logTitle = (l.moduleTitle || '').toLowerCase();
                return (
                  logMod === targetMod ||
                  logTitle.includes(targetMod) ||
                  (targetMod === 'students' && (logMod === 'students' || logMod === 'active-students')) ||
                  (targetMod === 'programs' && (logMod === 'programs' || logMod === 'enrollments')) ||
                  (targetMod === 'research' && logMod.includes('research')) ||
                  (targetMod === 'stats' && (logMod.includes('study') || logMod === 'stats')) ||
                  (targetMod === 'academic-calendar' && logMod.includes('academic')) ||
                  (targetMod === 'comments' && (logMod === 'comments' || logMod === 'oral_exams'))
                );
              }).length;

              return (
                <button
                  key={mod.id}
                  onClick={() => setSelectedModule(isSelected ? 'all' : mod.id)}
                  className={cn(
                    "py-1.5 px-3 rounded-xl transition-all cursor-pointer border text-xs font-bold flex items-center gap-1.5 shadow-2xs",
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-700 font-black shadow-md ring-2 ring-indigo-400/30"
                      : `${mod.color}`
                  )}
                >
                  <span>{mod.icon} {mod.label}</span>
                  {moduleLogCount > 0 && (
                    <span className={cn(
                      "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                      isSelected ? "bg-white/25 text-white" : "bg-black/10 text-slate-800"
                    )}>
                      {moduleLogCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Role Group Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs font-bold">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 text-[11px] ml-1">گروه نقشی:</span>
            <button
              onClick={() => setSelectedRoleGroup('all')}
              className={cn(
                "py-1.5 px-3 rounded-xl transition-all cursor-pointer",
                selectedRoleGroup === 'all' ? "bg-slate-900 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              همه مسئولیت‌ها
            </button>
            <button
              onClick={() => setSelectedRoleGroup('level_1')}
              className={cn(
                "py-1.5 px-3 rounded-xl transition-all cursor-pointer",
                selectedRoleGroup === 'level_1' ? "bg-indigo-600 text-white shadow-xs" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              )}
            >
              کاربران سطح ۱ (مدیریت)
            </button>
            <button
              onClick={() => setSelectedRoleGroup('education')}
              className={cn(
                "py-1.5 px-3 rounded-xl transition-all cursor-pointer",
                selectedRoleGroup === 'education' ? "bg-amber-600 text-white shadow-xs" : "bg-amber-50 text-amber-800 hover:bg-amber-100"
              )}
            >
              مسئول آموزش (SHAH)
            </button>
            <button
              onClick={() => setSelectedRoleGroup('research')}
              className={cn(
                "py-1.5 px-3 rounded-xl transition-all cursor-pointer",
                selectedRoleGroup === 'research' ? "bg-teal-600 text-white shadow-xs" : "bg-teal-50 text-teal-800 hover:bg-teal-100"
              )}
            >
              مسئول پژوهش (YAZDANI)
            </button>
            <button
              onClick={() => setSelectedRoleGroup('finance')}
              className={cn(
                "py-1.5 px-3 rounded-xl transition-all cursor-pointer",
                selectedRoleGroup === 'finance' ? "bg-cyan-700 text-white shadow-xs" : "bg-cyan-50 text-cyan-800 hover:bg-cyan-100"
              )}
            >
              مسئول مالی (MALI)
            </button>
            <button
              onClick={() => setSelectedRoleGroup('mentors')}
              className={cn(
                "py-1.5 px-3 rounded-xl transition-all cursor-pointer",
                selectedRoleGroup === 'mentors' ? "bg-emerald-600 text-white shadow-xs" : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              )}
            >
              مسئولین پایه (سطح ۲)
            </button>
            <button
              onClick={() => setSelectedRoleGroup('level_3')}
              className={cn(
                "py-1.5 px-3 rounded-xl transition-all cursor-pointer",
                selectedRoleGroup === 'level_3' ? "bg-blue-600 text-white shadow-xs" : "bg-blue-50 text-blue-800 hover:bg-blue-100"
              )}
            >
              طلاب و نمایندگان (سطح ۳)
            </button>
          </div>

          {/* Quick Date Range Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setSelectedDateFilter('all')}
              className={cn(
                "py-1 px-2.5 rounded-lg transition-all text-[11px]",
                selectedDateFilter === 'all' ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              )}
            >
              همه زمان‌ها
            </button>
            <button
              onClick={() => setSelectedDateFilter('today')}
              className={cn(
                "py-1 px-2.5 rounded-lg transition-all text-[11px]",
                selectedDateFilter === 'today' ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              )}
            >
              ۲۴ ساعت گذشته
            </button>
            <button
              onClick={() => setSelectedDateFilter('week')}
              className={cn(
                "py-1 px-2.5 rounded-lg transition-all text-[11px]",
                selectedDateFilter === 'week' ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              )}
            >
              ۷ روز گذشته
            </button>
            <button
              onClick={() => setSelectedDateFilter('month')}
              className={cn(
                "py-1 px-2.5 rounded-lg transition-all text-[11px]",
                selectedDateFilter === 'month' ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              )}
            >
              ۳۰ روز گذشته
            </button>
          </div>
        </div>
      </div>

      {/* LOGS DATA TABLE */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">تعداد نتایج یافت‌شده:</span>
            <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-black text-xs">
              {filteredLogs.length} فعالیت
            </span>
          </div>

          {(searchTerm || selectedRoleGroup !== 'all' || selectedUser !== 'all' || selectedModule !== 'all' || selectedAction !== 'all' || selectedDateFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedRoleGroup('all');
                setSelectedUser('all');
                setSelectedModule('all');
                setSelectedAction('all');
                setSelectedDateFilter('all');
              }}
              className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <X size={14} />
              <span>پاکسازی همه فیلترها</span>
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="py-16 text-center space-y-3 text-slate-400">
            <RefreshCw size={28} className="animate-spin mx-auto text-indigo-600" />
            <p className="text-xs font-bold">در حال بارگذاری و فراخوانی کلیه فعالیت‌های سایت...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center bg-slate-50/50 space-y-3 text-slate-400">
            <Activity size={40} className="mx-auto text-slate-300" />
            <p className="text-xs font-bold">هیچ فعالیتی با مشخصات فیلتر شده در دیتابیس یافت نشد.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-bold">
                <tr>
                  <th className="py-3.5 px-4 text-right">تاریخ و زمان</th>
                  <th className="py-3.5 px-4 text-right">کاربر انجام‌دهنده</th>
                  <th className="py-3.5 px-4 text-center">نوع عملیات</th>
                  <th className="py-3.5 px-4 text-right">بخش مربوطه</th>
                  <th className="py-3.5 px-4 text-right">شرح دقیق تغییرات</th>
                  <th className="py-3.5 px-4 text-center">استرداد / جزئیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredLogs.map((log) => {
                  const canRevert = !log.isReverted && (log.actionType === 'delete' || log.actionType === 'update' || log.actionType === 'create' || log.actionType === 'status_change');

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Date & Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{log.shamsiDate || 'نامشخص'}</span>
                          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                            <Clock size={11} /> {log.shamsiTime}
                          </span>
                        </div>
                      </td>

                      {/* User Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedUser(log.username)}
                          className="flex items-center gap-2 text-right hover:opacity-80 transition-opacity cursor-pointer group/user"
                          title={`فیلتر سریع بر اساس فعالیت‌های ${log.userName}`}
                        >
                          <div className={cn(
                            "w-7 h-7 rounded-xl text-white font-black flex items-center justify-center text-[10px] shrink-0 shadow-2xs group-hover/user:scale-105 transition-transform",
                            log.userLevel === 1 ? "bg-indigo-600" :
                            log.userLevel === 2 ? "bg-amber-600" : "bg-blue-600"
                          )}>
                            {(log.userName || log.username || 'ک')[0]}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-slate-900 text-xs group-hover/user:text-indigo-600">{log.userName}</span>
                            <span className="text-[10px] text-slate-400">
                              سطح {log.userLevel}: {log.userRoleTitle} (@{log.username})
                            </span>
                          </div>
                        </button>
                      </td>

                      {/* Action Type Badge */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedAction(log.actionType)}
                          className="cursor-pointer hover:scale-105 transition-transform"
                          title="فیلتر بر اساس این نوع عملیات"
                        >
                          {getActionBadge(log.actionType)}
                        </button>
                      </td>

                      {/* Module Title */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedModule(log.module)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1 shadow-2xs",
                            selectedModule === log.module
                              ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                              : "bg-slate-100 hover:bg-indigo-50 hover:text-indigo-800 text-slate-800 border-slate-200/80"
                          )}
                          title="فیلتر بر اساس این بخش"
                        >
                          <Layers size={12} className="opacity-70" />
                          <span>{log.moduleTitle || log.module}</span>
                        </button>
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 max-w-md">
                        <div className="space-y-1">
                          <p className="font-bold text-slate-800 text-xs leading-relaxed">
                            {log.description}
                          </p>
                          {log.entityName && (
                            <span className="text-[10px] text-indigo-600 font-bold block truncate">
                              مورد: {log.entityName}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action Controls & Revert Button */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          {/* View Detail Modal Button */}
                          <button
                            onClick={() => setSelectedLogForDetail(log)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                            title="مشاهده جزئیات فنی تغییرات"
                          >
                            <Eye size={16} />
                          </button>

                          {/* Revert Button / Status Badge */}
                          {log.isReverted ? (
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-bold flex items-center gap-1" title={`بازگردانده شده توسط ${log.revertedByUserName} در ${log.revertedAt}`}>
                              <CheckCircle2 size={12} className="text-emerald-600" />
                              <span>بازگردانده شد</span>
                            </span>
                          ) : canRevert ? (
                            <button
                              onClick={() => setSelectedLogForRevert(log)}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                              title="بازگرداندن تغییرات به حالت قبل"
                            >
                              <RotateCcw size={12} />
                              <span>بازگردانی</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">غیرقابل استرداد</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REVERT CONFIRMATION MODAL */}
      <AnimatePresence>
        {selectedLogForRevert && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full border border-slate-200 shadow-2xl space-y-5 text-right"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold shrink-0">
                  <RotateCcw size={24} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">تأیید استرداد و بازگردانی تغییرات</h3>
                  <p className="text-xs text-slate-500 mt-0.5">احیا و جایگزینی وضعیت قبلی در دیتابیس سامانه</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-4 space-y-2 text-xs text-amber-900">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                  <span>هشدار اقدام حسّاس:</span>
                </div>
                <p className="leading-relaxed text-[11px]">
                  با تأیید این عملیات، تغییرات انجام‌شده توسط کاربر «<strong className="text-slate-900">{selectedLogForRevert.userName}</strong>» در بخش «<strong className="text-slate-900">{selectedLogForRevert.moduleTitle}</strong>» بازگردانده شده و اطلاعات قبلی مجدداً در سیستم فعال خواهند شد.
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>نوع عملیات اصلی:</span>
                  <span className="font-bold">{getActionBadge(selectedLogForRevert.actionType)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>شرح تغییر:</span>
                  <span className="font-bold text-slate-900 max-w-[250px] truncate">{selectedLogForRevert.description}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>زمان وقوع:</span>
                  <span>{selectedLogForRevert.shamsiDate} - {selectedLogForRevert.shamsiTime}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmRevert}
                  disabled={isReverting}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isReverting ? <RefreshCw size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                  <span>تأیید نهایی و بازگرداندن تغییرات</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLogForRevert(null)}
                  disabled={isReverting}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  انصراف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAIL VIEW MODAL */}
      <AnimatePresence>
        {selectedLogForDetail && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-7 max-w-2xl w-full border border-slate-200 shadow-2xl space-y-5 text-right max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">جزئیات کامل شناسه فعالیت</h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedLogForDetail.id}</p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedLogForDetail(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl bg-slate-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto space-y-4 pr-1 text-xs">
                {/* Meta info grid */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                  <div>
                    <span className="text-slate-400 block text-[11px]">کاربر ثبت‌کننده:</span>
                    <span className="font-bold text-slate-900">{selectedLogForDetail.userName} (@{selectedLogForDetail.username})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">نقش و سطح کاربر:</span>
                    <span className="font-bold text-slate-900">سطح {selectedLogForDetail.userLevel}: {selectedLogForDetail.userRoleTitle}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">بخش مربوطه:</span>
                    <span className="font-bold text-slate-900">{selectedLogForDetail.moduleTitle}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">زمان ثبت:</span>
                    <span className="font-bold text-slate-900">{selectedLogForDetail.shamsiDate} - {selectedLogForDetail.shamsiTime}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-bold block mb-1">شرح دقیق رخداد:</span>
                  <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-slate-800 font-medium leading-relaxed">
                    {selectedLogForDetail.description}
                  </div>
                </div>

                {/* State Diff Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedLogForDetail.previousState && (
                    <div className="space-y-1">
                      <span className="text-rose-600 font-bold text-[11px] block">وضعیت قبلی (Previous State):</span>
                      <pre className="p-3 bg-slate-900 text-rose-300 rounded-xl text-[10px] font-mono overflow-x-auto dir-ltr max-h-48 leading-normal">
                        {JSON.stringify(selectedLogForDetail.previousState, null, 2)}
                      </pre>
                    </div>
                  )}

                  {selectedLogForDetail.newState && (
                    <div className="space-y-1">
                      <span className="text-emerald-600 font-bold text-[11px] block">وضعیت جدید (New State):</span>
                      <pre className="p-3 bg-slate-900 text-emerald-300 rounded-xl text-[10px] font-mono overflow-x-auto dir-ltr max-h-48 leading-normal">
                        {JSON.stringify(selectedLogForDetail.newState, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end shrink-0">
                <button
                  onClick={() => setSelectedLogForDetail(null)}
                  className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
                >
                  بستن
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
