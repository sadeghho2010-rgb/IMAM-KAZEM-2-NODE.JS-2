import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  ChevronRight,
  X,
  Search,
  Sliders,
  Bug,
  Monitor,
  LogOut,
  KeyRound,
  Inbox,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { localDb } from '../../../lib/localDb';
import { cn } from '../../../lib/utils';
import { getTodayShamsi, getShamsiDayOfWeekName } from '../../../lib/jalali';
import { PWAInstallButton } from '../../PWAInstallButton';
import {
  GlyphAdminHome,
  GlyphActiveStudents,
  GlyphProgramsBook,
  GlyphAttendanceShield,
  GlyphStudyAnalytics,
  GlyphTeachersCap,
  GlyphRequestsInbox,
  GlyphWorkflowFlow,
  GlyphFinanceCoins,
  GlyphSecurityLock,
  GlyphAllModules,
  AdminGlyphProps,
} from './AdminMobileIcons';

interface AdminMobileShellProps {
  activeTab: string;
  tabTitle: string;
  onNavigateTab: (tab: string, studentId?: string) => void;
  onBack: () => void;
  onSwitchToDesktopView: () => void;
  onOpenSettings: () => void;
  onOpenBugReport: () => void;
  children: React.ReactNode;
}

interface AdminDrawerModuleItem {
  tabId: string;
  title: string;
  subtitle: string;
  icon: React.FC<AdminGlyphProps>;
  accentClass: string;
  category: 'students' | 'education' | 'requests' | 'research' | 'finance' | 'system';
}

const ALL_ADMIN_DRAWER_MODULES: AdminDrawerModuleItem[] = [
  // Students (طلاب)
  { tabId: 'active-students', title: 'طلاب فعال', subtitle: 'فهرست طلاب در حال تحصیل', icon: GlyphActiveStudents, accentClass: 'bg-teal-50 text-teal-700 border-teal-200', category: 'students' },
  { tabId: 'students', title: 'مدیریت کل طلاب', subtitle: 'پرونده جامع و مشخصات طلاب', icon: GlyphActiveStudents, accentClass: 'bg-sky-50 text-sky-700 border-sky-200', category: 'students' },
  { tabId: 'attendance', title: 'حضور و غیاب طلاب', subtitle: 'ثبت، پایش و گزارش حضور کلاسی', icon: GlyphAttendanceShield, accentClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', category: 'students' },
  { tabId: 'stats', title: 'ساعت مطالعه', subtitle: 'آمار مطالعه و مباحثه طلاب', icon: GlyphStudyAnalytics, accentClass: 'bg-amber-50 text-amber-700 border-amber-200', category: 'students' },
  { tabId: 'warnings-management', title: 'مدیریت اخطارها', subtitle: 'ثبت، پیگیری و فرم تعهد اخطار', icon: GlyphSecurityLock, accentClass: 'bg-rose-50 text-rose-700 border-rose-200', category: 'students' },
  { tabId: 'student-access-management', title: 'مدیریت دسترسی پنل طلاب', subtitle: 'فعال/غیرفعال‌سازی بخش‌های طلاب', icon: GlyphSecurityLock, accentClass: 'bg-indigo-50 text-indigo-700 border-indigo-200', category: 'students' },
  { tabId: 'discussion', title: 'گروه‌های مباحثه و پایش', subtitle: 'پایش دروس و گروه‌های مباحثه', icon: GlyphActiveStudents, accentClass: 'bg-purple-50 text-purple-700 border-purple-200', category: 'students' },
  { tabId: 'summary', title: 'پرونده علمی طلاب', subtitle: 'جمع‌بندی نمرات و سوابق علمی', icon: GlyphStudyAnalytics, accentClass: 'bg-violet-50 text-violet-700 border-violet-200', category: 'students' },
  { tabId: 'comments', title: 'نظرات تربیتی', subtitle: 'ارزیابی‌ها و گفتگوهای تربیتی', icon: GlyphRequestsInbox, accentClass: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200', category: 'students' },

  // Education (آموزش)
  { tabId: 'programs', title: 'برنامه‌ها و کلاس‌های درس', subtitle: 'مدیریت دروس، ساعات و اعضا', icon: GlyphProgramsBook, accentClass: 'bg-indigo-50 text-indigo-700 border-indigo-200', category: 'education' },
  { tabId: 'teachers-bank', title: 'بانک اساتید', subtitle: 'اطلاعات و سوابق اساتید', icon: GlyphTeachersCap, accentClass: 'bg-sky-50 text-sky-700 border-sky-200', category: 'education' },
  { tabId: 'classrooms', title: 'مدرس‌ها و فضاهای کلاس', subtitle: 'چینش فضاهای آموزشی و مباحثه', icon: GlyphProgramsBook, accentClass: 'bg-blue-50 text-blue-700 border-blue-200', category: 'education' },
  { tabId: 'student-schedule', title: 'برنامه هفتگی طلاب', subtitle: 'تقویم کلاسی هفتگی پایه‌ها', icon: GlyphProgramsBook, accentClass: 'bg-cyan-50 text-cyan-700 border-cyan-200', category: 'education' },
  { tabId: 'teachers-schedule', title: 'برنامه درسی اساتید', subtitle: 'زمان‌بندی تدریس اساتید', icon: GlyphTeachersCap, accentClass: 'bg-indigo-50 text-indigo-700 border-indigo-200', category: 'education' },
  { tabId: 'course-selection', title: 'انتخاب واحد', subtitle: 'بازه‌ها و تایید انتخاب واحد', icon: GlyphProgramsBook, accentClass: 'bg-teal-50 text-teal-700 border-teal-200', category: 'education' },
  { tabId: 'oral-exams', title: 'آزمون شفاهی', subtitle: 'برنامه‌ریزی و ثبت نمرات شفاهی', icon: GlyphTeachersCap, accentClass: 'bg-cyan-50 text-cyan-700 border-cyan-200', category: 'education' },
  { tabId: 'held-sessions', title: 'تعداد جلسات برگزار شده', subtitle: 'گزارش جلسات اصلی، جایگزین و لغو', icon: GlyphAttendanceShield, accentClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', category: 'education' },
  { tabId: 'passed-courses', title: 'دروس گذرانده شده', subtitle: 'کارنامه و تطبیق دروس', icon: GlyphTeachersCap, accentClass: 'bg-green-50 text-green-700 border-green-200', category: 'education' },
  { tabId: 'academic-calendar', title: 'تقویم آموزشی', subtitle: 'تعطیلات و زمان‌بندی ترم‌ها', icon: GlyphProgramsBook, accentClass: 'bg-purple-50 text-purple-700 border-purple-200', category: 'education' },

  // Requests & Workflow (کارتابل)
  { tabId: 'student-requests', title: 'رسیدگی به درخواست‌ها', subtitle: 'پاسخ‌دهی به تقاضاهای طلاب', icon: GlyphRequestsInbox, accentClass: 'bg-rose-50 text-rose-700 border-rose-200', category: 'requests' },
  { tabId: 'workflow', title: 'جریان کار و کارتابل تاییدات', subtitle: 'تایید درخواست‌ها و تغییرات مباحثه', icon: GlyphWorkflowFlow, accentClass: 'bg-purple-50 text-purple-700 border-purple-200', category: 'requests' },
  { tabId: 'todos', title: 'پیگیری‌ها و تسک‌ها', subtitle: 'مدیریت امور و یادداشت‌های روزانه', icon: GlyphAttendanceShield, accentClass: 'bg-indigo-50 text-indigo-700 border-indigo-200', category: 'requests' },

  // Research (پژوهش)
  { tabId: 'research', title: 'پژوهش و مقالات', subtitle: 'آثار علمی و کرسی‌های پژوهشی', icon: GlyphStudyAnalytics, accentClass: 'bg-amber-50 text-amber-700 border-amber-200', category: 'research' },
  { tabId: 'counseling-classes', title: 'کلاس‌های مشاوره', subtitle: 'ارزیابی و نمرات اساتید مشاور', icon: GlyphTeachersCap, accentClass: 'bg-orange-50 text-orange-700 border-orange-200', category: 'research' },
  { tabId: 'article-evaluations', title: 'ارزیابی مقالات علمی', subtitle: 'داوری و نمره‌دهی مقالات', icon: GlyphStudyAnalytics, accentClass: 'bg-yellow-50 text-yellow-700 border-yellow-200', category: 'research' },
  { tabId: 'consultation-advisor', title: 'دستیار کلاس‌های مشاوره', subtitle: 'چینش هوشمند جلسات مشاوره', icon: GlyphProgramsBook, accentClass: 'bg-amber-50 text-amber-700 border-amber-200', category: 'research' },

  // Finance & Welfare (مالی و رفاهی)
  { tabId: 'finance-tuition', title: 'محاسبه شهریه طلاب', subtitle: 'محاسبه و پرداختی شهریه', icon: GlyphFinanceCoins, accentClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', category: 'finance' },
  { tabId: 'finance-grade-mentors', title: 'حق‌الزحمه اساتید پایه', subtitle: 'کارکرد سرپرستی و پیگیری‌ها', icon: GlyphFinanceCoins, accentClass: 'bg-teal-50 text-teal-700 border-teal-200', category: 'finance' },
  { tabId: 'finance-teachers', title: 'حق‌التدریس اساتید', subtitle: 'ساعات تدریس و فیش حق‌التدریس', icon: GlyphFinanceCoins, accentClass: 'bg-green-50 text-green-700 border-green-200', category: 'finance' },
  { tabId: 'finance-lunch', title: 'اطلاعات نهار و شام', subtitle: 'آمار پخت و کسر وعده‌های سلف', icon: GlyphFinanceCoins, accentClass: 'bg-cyan-50 text-cyan-700 border-cyan-200', category: 'finance' },
  { tabId: 'finance-loans-fund', title: 'صندوق قرض‌الحسنه', subtitle: 'وام‌ها، اقساط و گردش مالی', icon: GlyphFinanceCoins, accentClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', category: 'finance' },
  { tabId: 'finance-claims', title: 'مطالبات و بدهی‌ها', subtitle: 'مانده حساب‌ها و تسویه‌ها', icon: GlyphFinanceCoins, accentClass: 'bg-teal-50 text-teal-700 border-teal-200', category: 'finance' },
  { tabId: 'finance-expenses-reports', title: 'هزینه‌ها و بودجه', subtitle: 'ثبت اسناد هزینه و تراز مالی', icon: GlyphFinanceCoins, accentClass: 'bg-green-50 text-green-700 border-green-200', category: 'finance' },
  { tabId: 'presence-hours', title: 'ساعت حضور و کارکرد', subtitle: 'کارکرد کادر و اساتید', icon: GlyphStudyAnalytics, accentClass: 'bg-blue-50 text-blue-700 border-blue-200', category: 'finance' },
  { tabId: 'staff-bank', title: 'بانک کارکنان', subtitle: 'مشخصات پرسنل اجرایی', icon: GlyphActiveStudents, accentClass: 'bg-indigo-50 text-indigo-700 border-indigo-200', category: 'finance' },
  { tabId: 'education-financial-report', title: 'گزارش مالی طلاب', subtitle: 'تنظیم گزارش‌های مالی آموزش', icon: GlyphFinanceCoins, accentClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', category: 'finance' },
  { tabId: 'lockers', title: 'اختصاص کمد و کلید', subtitle: 'مدیریت کمدها و امانات', icon: GlyphSecurityLock, accentClass: 'bg-cyan-50 text-cyan-700 border-cyan-200', category: 'finance' },
  { tabId: 'teacher-transport', title: 'ایاب و ذهاب اساتید', subtitle: 'روتین هفتگی و ترابری', icon: GlyphProgramsBook, accentClass: 'bg-teal-50 text-teal-700 border-teal-200', category: 'finance' },

  // System & Security (امنیت و سیستم)
  { tabId: 'user-management', title: 'مدیریت کاربران و دسترسی‌ها', subtitle: 'تعریف نقش‌ها و سطوح RBAC', icon: GlyphSecurityLock, accentClass: 'bg-slate-100 text-slate-800 border-slate-200', category: 'system' },
  { tabId: 'user-credentials', title: 'مدیریت ورود کاربران', subtitle: 'گذرواژه‌ها و نشست‌های فعال', icon: GlyphSecurityLock, accentClass: 'bg-blue-50 text-blue-700 border-blue-200', category: 'system' },
  { tabId: 'backup', title: 'پشتیبان‌گیری دیتابیس', subtitle: 'تهیه نسخه پشتیبان و بازیابی', icon: GlyphSecurityLock, accentClass: 'bg-slate-100 text-slate-800 border-slate-200', category: 'system' },
  { tabId: 'system-health', title: 'پایش سلامت سرور', subtitle: 'مصرف CPU، RAM و وضعیت سرویس‌ها', icon: GlyphStudyAnalytics, accentClass: 'bg-rose-50 text-rose-700 border-rose-200', category: 'system' },
  { tabId: 'anomaly-detection', title: 'تشخیص ناهنجاری‌ها', subtitle: 'بازرسی امنیت و هشدارها', icon: GlyphSecurityLock, accentClass: 'bg-rose-50 text-rose-700 border-rose-200', category: 'system' },
  { tabId: 'audit-logs', title: 'فعالیت‌های سایت (Audit)', subtitle: 'لاگ تغییرات و عملیات کاربران', icon: GlyphSecurityLock, accentClass: 'bg-slate-100 text-slate-700 border-slate-200', category: 'system' },
  { tabId: 'db-save-errors', title: 'خطاهای ثبت دیتابیس', subtitle: 'بررسی علل خطاهای ذخیره‌سازی', icon: GlyphSecurityLock, accentClass: 'bg-rose-50 text-rose-700 border-rose-200', category: 'system' },
  { tabId: 'db-connection-test', title: 'تست اتصال دیتابیس', subtitle: 'بررسی سلامت ارتباط و همگام‌سازی', icon: GlyphSecurityLock, accentClass: 'bg-cyan-50 text-cyan-700 border-cyan-200', category: 'system' },
];

export const AdminMobileShell: React.FC<AdminMobileShellProps> = ({
  activeTab,
  tabTitle,
  onNavigateTab,
  onBack,
  onSwitchToDesktopView,
  onOpenSettings,
  onOpenBugReport,
  children,
}) => {
  const { currentUser, logout, isTabAllowed } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerSearch, setDrawerSearch] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  const todayShamsi = useMemo(() => getTodayShamsi(), []);
  const todayDayName = useMemo(() => getShamsiDayOfWeekName(todayShamsi), [todayShamsi]);

  const displayName = (currentUser?.name || currentUser?.fullName || currentUser?.username || 'مدیریت')
    .split('(')[0]
    .trim();

  // Scroll to top cleanly when switching tabs
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [activeTab]);

  // Load light inbox badge count
  useEffect(() => {
    let active = true;
    const loadCounts = async () => {
      try {
        const [reqs, workflows] = await Promise.all([
          localDb.getLocalDocsSnapshot<any>('student_requests'),
          localDb.getLocalDocsSnapshot<any>('workflow_items'),
        ]);
        if (!active) return;
        const unreadReqs = (reqs || []).filter((r: any) => r.isReadByOfficer === false).length;
        const pendingWf = (workflows || []).filter((w: any) => w.status === 'pending').length;
        setPendingCount(unreadReqs + pendingWf);
      } catch (err) {
        console.warn('[AdminMobileShell] Could not load inbox count:', err);
      }
    };
    loadCounts();
    const unsub = localDb.subscribe(loadCounts);
    window.addEventListener('app_data_change', loadCounts);
    return () => {
      active = false;
      unsub();
      window.removeEventListener('app_data_change', loadCounts);
    };
  }, [currentUser]);

  // Quick bottom dock tabs prioritizing اصلاح ۲۸ (طلاب فعال، برنامه‌ها، حضور و غیاب) within allowed tabs
  const navTabs = useMemo(() => {
    const items: Array<{ id: string; label: string; icon: React.FC<AdminGlyphProps> }> = [
      { id: 'dashboard', label: 'پیشخوان', icon: GlyphAdminHome },
    ];
    const candidates: Array<{ id: string; label: string; icon: React.FC<AdminGlyphProps> }> = [
      { id: 'active-students', label: 'طلاب فعال', icon: GlyphActiveStudents },
      { id: 'programs', label: 'برنامه‌ها', icon: GlyphProgramsBook },
      { id: 'attendance', label: 'حضور', icon: GlyphAttendanceShield },
      { id: 'stats', label: 'مطالعه', icon: GlyphStudyAnalytics },
      { id: 'teachers-bank', label: 'اساتید', icon: GlyphTeachersCap },
      { id: 'student-requests', label: 'درخواست‌ها', icon: GlyphRequestsInbox },
    ];
    for (const c of candidates) {
      if (items.length >= 4) break;
      if (isTabAllowed(c.id)) {
        items.push(c);
      }
    }
    return items;
  }, [isTabAllowed]);

  const drawerCategories = useMemo(() => {
    const q = drawerSearch.trim().toLowerCase();
    const allowed = ALL_ADMIN_DRAWER_MODULES.filter((m) => {
      if (!isTabAllowed(m.tabId)) return false;
      if (q) {
        return (
          m.title.toLowerCase().includes(q) ||
          m.subtitle.toLowerCase().includes(q) ||
          m.tabId.toLowerCase().includes(q)
        );
      }
      return true;
    });
    return [
      { key: 'students', label: 'امور طلاب و پایش', items: allowed.filter((s) => s.category === 'students') },
      { key: 'education', label: 'آموزش و کلاس‌های درس', items: allowed.filter((s) => s.category === 'education') },
      { key: 'requests', label: 'کارتابل و رسیدگی', items: allowed.filter((s) => s.category === 'requests') },
      { key: 'research', label: 'پژوهش و مشاوره', items: allowed.filter((s) => s.category === 'research') },
      { key: 'finance', label: 'مالی، حقوق و رفاهی', items: allowed.filter((s) => s.category === 'finance') },
      { key: 'system', label: 'مدیریت و امنیت سایت', items: allowed.filter((s) => s.category === 'system') },
    ].filter((g) => g.items.length > 0);
  }, [isTabAllowed, drawerSearch]);

  const isDashboard = activeTab === 'dashboard';

  const handleSelectTab = (tabId: string) => {
    setIsDrawerOpen(false);
    setDrawerSearch('');
    onNavigateTab(tabId);
  };

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900 font-vazir flex flex-col relative overflow-x-clip selection:bg-indigo-600 selection:text-white"
      dir="rtl"
    >
      {/* Compact Sticky Executive Top App Bar (56px height) */}
      <header className="h-14 sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/85 px-3 flex items-center justify-between gap-2 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {!isDashboard ? (
            <motion.button
              type="button"
              whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
              onClick={onBack}
              className="min-h-[42px] px-2.5 -mr-0.5 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 flex items-center gap-1 text-xs font-black shrink-0 cursor-pointer transition-colors"
              aria-label="بازگشت به پیشخوان"
            >
              <ChevronRight size={17} className="text-indigo-600" />
              <span>بازگشت</span>
            </motion.button>
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-950 via-indigo-900 to-teal-700 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm border border-indigo-400/30">
              {displayName[0] || 'م'}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="text-[13px] font-black text-slate-900 truncate leading-tight">
              {isDashboard ? displayName : tabTitle}
            </h1>
            <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5 tabular-nums">
              {isDashboard
                ? `${currentUser?.roleTitle || 'مسئول'} · ${todayDayName} ${todayShamsi}`
                : `${displayName} · ${currentUser?.roleTitle || 'مدیریت'}`}
            </p>
          </div>
        </div>

        {/* Left Quick Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <PWAInstallButton variant="header" />

          {isTabAllowed('student-requests') && pendingCount > 0 && isDashboard && (
            <motion.button
              type="button"
              whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
              onClick={() => handleSelectTab('student-requests')}
              className="min-h-[42px] px-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-[10.5px] font-black flex items-center gap-1 cursor-pointer tabular-nums"
              title="موارد در انتظار بررسی"
            >
              <Inbox size={13} className="text-amber-600" />
              <span>{pendingCount}</span>
            </motion.button>
          )}

          <motion.button
            type="button"
            whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
            onClick={() => setIsDrawerOpen(true)}
            className="min-h-[42px] min-w-[42px] px-2.5 rounded-2xl bg-gradient-to-tr from-indigo-50 to-sky-50 hover:from-indigo-100 hover:to-sky-100 text-indigo-800 border border-indigo-200/80 flex items-center justify-center gap-1.5 text-xs font-black cursor-pointer transition-colors"
            aria-label="فهرست تمامی بخش‌ها"
          >
            <GlyphAllModules size={18} active={isDrawerOpen} />
            <span className="hidden xs:inline text-[11px]">بخش‌ها</span>
          </motion.button>
        </div>
      </header>

      {/* Main Scrollable Viewport — Scoped mobile sub-page table/scroll adaptation */}
      <main
        className={cn(
          'flex-1 w-full mx-auto px-3 pt-3 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))]',
          isDashboard ? 'max-w-xl' : 'max-w-2xl admin-mobile-viewport'
        )}
      >
        <div className="w-full min-w-0">
          {children}
        </div>
      </main>

      {/* Floating Curved Glassmorphic Bottom Thumb-Zone Dock */}
      <div className="fixed bottom-0 inset-x-0 z-40 pointer-events-none px-2.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
        <nav
          aria-label="ناوبری سریع مدیریت"
          className="pointer-events-auto max-w-xl mx-auto rounded-[24px] bg-white/95 backdrop-blur-lg border border-slate-200/90 shadow-[0_10px_30px_-8px_rgba(15,23,42,0.18)] px-1.5 py-1.5"
        >
          <div className="flex items-center justify-around gap-1">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  type="button"
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
                  onClick={() => handleSelectTab(tab.id)}
                  className={cn(
                    'relative flex-1 min-h-[48px] rounded-[18px] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer px-1',
                    isActive ? 'text-white' : 'text-slate-500 hover:text-slate-900'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId={prefersReducedMotion ? undefined : 'adminMobileBottomDock'}
                      transition={{ type: 'spring', stiffness: 440, damping: 32 }}
                      className="absolute inset-0 rounded-[18px] bg-gradient-to-tr from-slate-950 via-indigo-900 to-teal-700 shadow-md shadow-indigo-900/20"
                    >
                      <span className="absolute top-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-cyan-300/90" />
                    </motion.div>
                  )}
                  <Icon size={19} active={isActive} className="relative z-10 shrink-0" />
                  <span
                    className={cn(
                      'relative z-10 text-[10px] truncate max-w-full',
                      isActive ? 'font-black text-white' : 'font-bold text-slate-600'
                    )}
                  >
                    {tab.label}
                  </span>
                </motion.button>
              );
            })}

            {/* All Modules Sheet Trigger */}
            <motion.button
              type="button"
              whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
              onClick={() => setIsDrawerOpen(true)}
              className={cn(
                'relative flex-1 min-h-[48px] rounded-[18px] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer px-1',
                isDrawerOpen ? 'text-indigo-700 bg-indigo-50 border border-indigo-200' : 'text-slate-500 hover:text-slate-900'
              )}
            >
              <GlyphAllModules size={19} active={isDrawerOpen} className="shrink-0" />
              <span className="text-[10px] font-bold">سایر</span>
              {pendingCount > 0 && (
                <span className="absolute top-1.5 left-1/4 w-2 h-2 rounded-full bg-amber-500" />
              )}
            </motion.button>
          </div>
        </nav>
      </div>

      {/* Bottom Sheet All-Modules Directory Drawer with Search */}
      <AnimatePresence>
        {isDrawerOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" dir="rtl">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            />

            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { y: '100%' }}
              animate={prefersReducedMotion ? { opacity: 1 } : { y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { y: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              className="relative z-10 w-full max-w-xl bg-white rounded-t-3xl shadow-2xl max-h-[88vh] flex flex-col overflow-hidden"
            >
              {/* Drag Handle */}
              <div className="pt-2.5 pb-1 flex justify-center shrink-0">
                <div className="w-10 h-1 rounded-full bg-slate-300" />
              </div>

              {/* Drawer Header */}
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
                <div>
                  <h2 className="text-sm font-black text-slate-900">فهرست کامل بخش‌های مدیریت</h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {displayName} · {currentUser?.roleTitle || 'مسئول'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="min-h-[44px] min-w-[44px] rounded-xl text-slate-500 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                  aria-label="بستن منو"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Instant Drawer Search */}
              <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 shrink-0">
                <div className="relative">
                  <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={drawerSearch}
                    onChange={(e) => setDrawerSearch(e.target.value)}
                    placeholder="جستجو بین بخش‌ها (مثلاً طلاب، مالی، تقویم، اساتید)..."
                    className="w-full min-h-[40px] pr-9 pl-8 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500"
                  />
                  {drawerSearch && (
                    <button
                      type="button"
                      onClick={() => setDrawerSearch('')}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label="پاک کردن"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                {drawerCategories.map((cat) => (
                  <div key={cat.key} className="space-y-2">
                    <h3 className="text-[11px] font-black text-slate-500 px-1">{cat.label}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {cat.items.map((mod) => {
                        const Icon = mod.icon;
                        const isActive = activeTab === mod.tabId;
                        return (
                          <button
                            key={mod.tabId}
                            type="button"
                            onClick={() => handleSelectTab(mod.tabId)}
                            className={cn(
                              'min-h-[54px] p-2.5 rounded-2xl border text-right flex items-center gap-3 transition-all cursor-pointer active:scale-[0.98]',
                              isActive
                                ? 'bg-indigo-50/90 border-indigo-300 shadow-2xs'
                                : 'bg-white border-slate-200/90 hover:border-indigo-200 hover:bg-slate-50/70'
                            )}
                          >
                            <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center shrink-0', mod.accentClass)}>
                              <Icon size={19} active={isActive} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-black text-slate-900 truncate">{mod.title}</div>
                              <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">{mod.subtitle}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* System & Account Tools */}
                <div className="space-y-2 pt-2 border-t border-slate-100 pb-4">
                  <h3 className="text-[11px] font-black text-slate-500 px-1">ابزارهای نمایش و حساب کاربری</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectTab('security-pin-settings')}
                      className="min-h-[46px] px-3 py-2 rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 text-slate-800 text-xs font-bold flex items-center gap-2 cursor-pointer"
                    >
                      <KeyRound size={16} className="text-indigo-600 shrink-0" />
                      <span className="truncate">پین امنیتی حساب</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsDrawerOpen(false);
                        onOpenSettings();
                      }}
                      className="min-h-[46px] px-3 py-2 rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 text-slate-800 text-xs font-bold flex items-center gap-2 cursor-pointer"
                    >
                      <Sliders size={16} className="text-indigo-600 shrink-0" />
                      <span className="truncate">تنظیمات نمایش</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsDrawerOpen(false);
                        onSwitchToDesktopView();
                      }}
                      className="min-h-[46px] px-3 py-2 rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 text-slate-800 text-xs font-bold flex items-center gap-2 cursor-pointer"
                    >
                      <Monitor size={16} className="text-slate-600 shrink-0" />
                      <span className="truncate">نمای دسکتاپ/لپ‌تاپ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsDrawerOpen(false);
                        onOpenBugReport();
                      }}
                      className="min-h-[46px] px-3 py-2 rounded-2xl bg-rose-50/70 hover:bg-rose-100 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 cursor-pointer"
                    >
                      <Bug size={16} className="text-rose-600 shrink-0" />
                      <span className="truncate">گزارش مشکل</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawerOpen(false);
                      logout();
                    }}
                    className="w-full min-h-[46px] mt-1 px-4 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogOut size={16} />
                    <span>خروج از حساب کاربری</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
