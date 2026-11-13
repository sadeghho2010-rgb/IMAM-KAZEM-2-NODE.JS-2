import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  ChevronRight,
  X,
  Send,
  Sliders,
  Bug,
  Monitor,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { localDb } from '../../../lib/localDb';
import { cn } from '../../../lib/utils';
import { getTodayShamsi, getShamsiDayOfWeekName } from '../../../lib/jalali';
import { PWAInstallButton } from '../../PWAInstallButton';
import {
  GlyphHome,
  GlyphStudyBook,
  GlyphAttendanceCheck,
  GlyphScheduleGrid,
  GlyphAllServices,
  GlyphSelfReportSpark,
  GlyphRepShieldCrown,
  GlyphDiscussionGroup,
  GlyphCourseSelect,
  GlyphCalendarTimeline,
  GlyphReportCard,
  GlyphGraduationScroll,
  GlyphResearchQuill,
  GlyphRequestPaperPlane,
  GlyphDiningBowl,
  GlyphWalletVault,
  GlyphPersonalTasks,
  GlyphSecurityKey,
  MobileGlyphProps,
} from './StudentMobileIcons';

interface StudentMobileShellProps {
  activeTab: string;
  tabTitle: string;
  onNavigateTab: (tab: string, studentId?: string) => void;
  onBack: () => void;
  onSwitchToDesktopView: () => void;
  onOpenSettings: () => void;
  onOpenBugReport: () => void;
  children: React.ReactNode;
}

interface DrawerServiceItem {
  id: string;
  tabId: string;
  title: string;
  subtitle: string;
  icon: React.FC<MobileGlyphProps>;
  accentClass: string;
  category: 'academic' | 'personal' | 'welfare' | 'portal';
}

const ALL_DRAWER_SERVICES: DrawerServiceItem[] = [
  {
    id: 'srv-study',
    tabId: 'stats',
    title: 'ساعت مطالعه من',
    subtitle: 'ثبت کارکرد روزانه و پیشرفت دوره',
    icon: GlyphStudyBook,
    accentClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    category: 'personal',
  },
  {
    id: 'srv-attendance',
    tabId: 'attendance',
    title: 'حضور و غیاب من',
    subtitle: 'گزارش حضور، تاخیر و غیبت دروس',
    icon: GlyphAttendanceCheck,
    accentClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    category: 'personal',
  },
  {
    id: 'srv-self-reporting',
    tabId: 'self-reporting',
    title: 'ثبت خوداظهاری',
    subtitle: 'اعلام آنلاین حضور در دروس خوداظهاری',
    icon: GlyphSelfReportSpark,
    accentClass: 'bg-teal-50 text-teal-700 border-teal-200',
    category: 'personal',
  },
  {
    id: 'srv-rep-attendance',
    tabId: 'rep-attendance',
    title: 'ثبت حضور نماینده',
    subtitle: 'ثبت حضور و غیاب کلاس برای نمایندگان',
    icon: GlyphRepShieldCrown,
    accentClass: 'bg-purple-50 text-purple-700 border-purple-200',
    category: 'personal',
  },
  {
    id: 'srv-schedule',
    tabId: 'student-schedule',
    title: 'برنامه کلاسی هفتگی',
    subtitle: 'ساعت دروس، اساتید و مَدرَس‌ها',
    icon: GlyphScheduleGrid,
    accentClass: 'bg-sky-50 text-sky-700 border-sky-200',
    category: 'academic',
  },
  {
    id: 'srv-discussion',
    tabId: 'discussion',
    title: 'گروه مباحثه من',
    subtitle: 'هم‌مباحثه‌ای‌ها و معرفی گروه',
    icon: GlyphDiscussionGroup,
    accentClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    category: 'academic',
  },
  {
    id: 'srv-course-selection',
    tabId: 'course-selection',
    title: 'انتخاب واحد دروس',
    subtitle: 'ثبت‌نام واحدهای دوره جدید',
    icon: GlyphCourseSelect,
    accentClass: 'bg-lime-50 text-lime-700 border-lime-200',
    category: 'academic',
  },
  {
    id: 'srv-calendar',
    tabId: 'academic-calendar',
    title: 'تقویم آموزشی',
    subtitle: 'تعطیلات رسمی و مناسبت‌های مدرسه',
    icon: GlyphCalendarTimeline,
    accentClass: 'bg-blue-50 text-blue-700 border-blue-200',
    category: 'academic',
  },
  {
    id: 'srv-portal',
    tabId: 'student-portal',
    title: 'کارنامه و پرونده علمی',
    subtitle: 'نمرات شفاهی، ارزیابی و توصیه‌ها',
    icon: GlyphReportCard,
    accentClass: 'bg-amber-50 text-amber-700 border-amber-200',
    category: 'portal',
  },
  {
    id: 'srv-passed',
    tabId: 'passed-courses',
    title: 'دروس گذرانده شده',
    subtitle: 'سوابق تحصیلی و دروس باقی‌مانده',
    icon: GlyphGraduationScroll,
    accentClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    category: 'portal',
  },
  {
    id: 'srv-research',
    tabId: 'research',
    title: 'پژوهش و مقالات',
    subtitle: 'سوابق پژوهشی و ارسال مقاله علمی',
    icon: GlyphResearchQuill,
    accentClass: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
    category: 'portal',
  },
  {
    id: 'srv-requests',
    tabId: 'student-requests',
    title: 'ثبت تقاضا و درخواست',
    subtitle: 'مرخصی، گواهی، امور آموزشی و مالی',
    icon: GlyphRequestPaperPlane,
    accentClass: 'bg-sky-50 text-sky-700 border-sky-200',
    category: 'welfare',
  },
  {
    id: 'srv-meals',
    tabId: 'student-meals',
    title: 'رزرو ناهار و شام',
    subtitle: 'ثبت یا لغو وعده‌های غذایی سلف',
    icon: GlyphDiningBowl,
    accentClass: 'bg-orange-50 text-orange-700 border-orange-200',
    category: 'welfare',
  },
  {
    id: 'srv-payments',
    tabId: 'student-payments',
    title: 'پرداختی‌ها و امور مالی',
    subtitle: 'وضعیت حساب، شهریه و کمک‌هزینه',
    icon: GlyphWalletVault,
    accentClass: 'bg-teal-50 text-teal-700 border-teal-200',
    category: 'welfare',
  },
  {
    id: 'srv-todos',
    tabId: 'todos',
    title: 'کارها و پیگیری‌های شخصی',
    subtitle: 'فهرست کارهای روزانه و ارجاعات',
    icon: GlyphPersonalTasks,
    accentClass: 'bg-slate-100 text-slate-700 border-slate-200',
    category: 'welfare',
  },
];

export const StudentMobileShell: React.FC<StudentMobileShellProps> = ({
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
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const todayShamsi = useMemo(() => getTodayShamsi(), []);
  const todayDayName = useMemo(() => getShamsiDayOfWeekName(todayShamsi), [todayShamsi]);

  const displayName = (currentUser?.name || currentUser?.fullName || currentUser?.username || 'دانش‌پژوه')
    .split('(')[0]
    .trim();

  // Scroll to top cleanly ONLY when switching tabs, never on background syncs
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [activeTab]);

  // Load light badge count for pending requests
  useEffect(() => {
    let active = true;
    const loadCounts = async () => {
      try {
        const reqs = await localDb.getDocs<any>('student_requests');
        if (!active || !Array.isArray(reqs)) return;
        const ids = [currentUser?.studentId, currentUser?.linkedStudentId, currentUser?.id].filter(Boolean).map(String);
        const uName = (currentUser?.username || '').toLowerCase();
        const mine = reqs.filter(
          (r) =>
            r.status === 'pending' &&
            ((r.studentId && ids.includes(String(r.studentId))) ||
              (r.nationalId && uName && String(r.nationalId).toLowerCase() === uName))
        );
        setPendingRequestsCount(mine.length);
      } catch (err) {
        console.warn('Could not load student request counts:', err);
      }
    };
    loadCounts();
    const unsub = localDb.subscribe(() => loadCounts());
    const handleEvt = () => loadCounts();
    window.addEventListener('app_data_change', handleEvt);
    return () => {
      active = false;
      unsub();
      window.removeEventListener('app_data_change', handleEvt);
    };
  }, [currentUser]);

  const navTabs = useMemo(() => {
    const items: Array<{ id: string; label: string; icon: React.FC<MobileGlyphProps> }> = [
      { id: 'dashboard', label: 'پیشخوان', icon: GlyphHome },
    ];
    if (isTabAllowed('stats')) {
      items.push({ id: 'stats', label: 'مطالعه', icon: GlyphStudyBook });
    }
    if (isTabAllowed('attendance')) {
      items.push({ id: 'attendance', label: 'حضور', icon: GlyphAttendanceCheck });
    }
    if (isTabAllowed('student-schedule')) {
      items.push({ id: 'student-schedule', label: 'کلاس‌ها', icon: GlyphScheduleGrid });
    }
    return items;
  }, [isTabAllowed]);

  const drawerCategories = useMemo(() => {
    const allowed = ALL_DRAWER_SERVICES.filter((srv) => {
      if (srv.tabId === 'rep-attendance') return isTabAllowed('rep-attendance');
      if (srv.tabId === 'self-reporting') return isTabAllowed('self-reporting');
      return isTabAllowed(srv.tabId);
    });
    return [
      { key: 'personal', label: 'امور فردی و حضور', items: allowed.filter((s) => s.category === 'personal') },
      { key: 'academic', label: 'برنامه درسی و مباحثه', items: allowed.filter((s) => s.category === 'academic') },
      { key: 'portal', label: 'کارنامه و پژوهش', items: allowed.filter((s) => s.category === 'portal') },
      { key: 'welfare', label: 'درخواست‌ها، رفاهی و مالی', items: allowed.filter((s) => s.category === 'welfare') },
    ].filter((g) => g.items.length > 0);
  }, [isTabAllowed]);

  const activeServiceMeta = useMemo(() => {
    const targetId = activeTab === 'summary' ? 'student-portal' : activeTab;
    return ALL_DRAWER_SERVICES.find((s) => s.tabId === targetId);
  }, [activeTab]);

  const isDashboard = activeTab === 'dashboard';
  const normalizedActiveNav = activeTab === 'summary' ? 'student-portal' : activeTab;

  const handleSelectTab = (tabId: string) => {
    setIsDrawerOpen(false);
    onNavigateTab(tabId);
  };

  const ActiveGlyph = activeServiceMeta?.icon;

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900 font-vazir flex flex-col relative overflow-x-clip selection:bg-indigo-600 selection:text-white"
      dir="rtl"
    >
      {/* Compact Sticky Top App Bar (56px height) */}
      <header className="h-14 sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3 flex items-center justify-between gap-2 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
        {/* Right side: Back button (on subtabs) or Student Avatar (on dashboard) */}
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
              {displayName[0] || 'ط'}
            </div>
          )}

          <div className="min-w-0 flex-1 flex items-center gap-2">
            {!isDashboard && ActiveGlyph && (
              <div className={cn('w-8 h-8 rounded-xl border flex items-center justify-center shrink-0', activeServiceMeta.accentClass)}>
                <ActiveGlyph size={17} active />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-[13px] font-black text-slate-900 truncate leading-tight">
                {isDashboard ? displayName : tabTitle}
              </h1>
              <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5 tabular-nums">
                {isDashboard
                  ? `${currentUser?.gradeLabel || 'طلبه'} · ${todayDayName} ${todayShamsi}`
                  : `${displayName} · ${currentUser?.gradeLabel || 'سطح ۳'}`}
              </p>
            </div>
          </div>
        </div>

        {/* Left side: Quick actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <PWAInstallButton variant="header" />

          {isTabAllowed('student-requests') && pendingRequestsCount > 0 && isDashboard && (
            <motion.button
              type="button"
              whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
              onClick={() => handleSelectTab('student-requests')}
              className="min-h-[42px] px-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-[10.5px] font-black flex items-center gap-1 cursor-pointer tabular-nums"
              title="درخواست‌های در جریان"
            >
              <Send size={13} className="text-amber-600" />
              <span>{pendingRequestsCount}</span>
            </motion.button>
          )}

          <motion.button
            type="button"
            whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
            onClick={() => setIsDrawerOpen(true)}
            className="min-h-[42px] min-w-[42px] px-2.5 rounded-2xl bg-gradient-to-tr from-indigo-50 to-sky-50 hover:from-indigo-100 hover:to-sky-100 text-indigo-800 border border-indigo-200/80 flex items-center justify-center gap-1.5 text-xs font-black cursor-pointer transition-colors"
            aria-label="فهرست تمام خدمات"
          >
            <GlyphAllServices size={18} active={isDrawerOpen} />
            <span className="hidden xs:inline text-[11px]">خدمات</span>
          </motion.button>
        </div>
      </header>

      {/* Main Scrollable Viewport (>85% screen height) — Instant tab mount without blocking exit transitions */}
      <main className="flex-1 w-full max-w-xl mx-auto px-3 pt-3 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))]">
        <div className="w-full">
          {children}
        </div>
      </main>

      {/* Floating Curved Glassmorphic Thumb-Zone Navigation Dock */}
      <div className="fixed bottom-0 inset-x-0 z-40 pointer-events-none px-2.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
        <nav
          aria-label="ناوبری سریع پنل طلاب"
          className="pointer-events-auto max-w-xl mx-auto rounded-[24px] bg-white/95 backdrop-blur-lg border border-slate-200/90 shadow-[0_10px_30px_-8px_rgba(15,23,42,0.18)] px-1.5 py-1.5"
        >
          <div className="flex items-center justify-around gap-1">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive =
                tab.id === normalizedActiveNav ||
                (tab.id === 'attendance' && (activeTab === 'rep-attendance' || activeTab === 'self-reporting'));
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
                      layoutId={prefersReducedMotion ? undefined : 'studentMobileBottomNavDock'}
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

            {/* More / All Services Drawer Trigger */}
            <motion.button
              type="button"
              whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
              onClick={() => setIsDrawerOpen(true)}
              className={cn(
                'relative flex-1 min-h-[48px] rounded-[18px] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer px-1',
                isDrawerOpen ? 'text-indigo-700 bg-indigo-50 border border-indigo-200' : 'text-slate-500 hover:text-slate-900'
              )}
            >
              <GlyphAllServices size={19} active={isDrawerOpen} className="shrink-0" />
              <span className="text-[10px] font-bold">بخش‌ها</span>
              {pendingRequestsCount > 0 && (
                <span className="absolute top-1.5 left-1/4 w-2 h-2 rounded-full bg-amber-500" />
              )}
            </motion.button>
          </div>
        </nav>
      </div>

      {/* Bottom Sheet All-Services Drawer */}
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
              className="relative z-10 w-full max-w-xl bg-white rounded-t-3xl shadow-2xl max-h-[86vh] flex flex-col overflow-hidden"
            >
              {/* Drag Handle */}
              <div className="pt-2.5 pb-1 flex justify-center shrink-0">
                <div className="w-10 h-1 rounded-full bg-slate-300" />
              </div>

              {/* Drawer Header */}
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
                <div>
                  <h2 className="text-sm font-black text-slate-900">فهرست کامل بخش‌های سامانه</h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {displayName} · {currentUser?.gradeLabel || 'طلبه'}
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

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                {drawerCategories.map((cat) => (
                  <div key={cat.key} className="space-y-2">
                    <h3 className="text-[11px] font-black text-slate-500 px-1">{cat.label}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {cat.items.map((srv, idx) => {
                        const Icon = srv.icon;
                        const isActive = activeTab === srv.tabId || (srv.tabId === 'student-portal' && activeTab === 'summary');
                        return (
                          <motion.button
                            key={srv.id}
                            type="button"
                            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: prefersReducedMotion ? 0 : 0.16, delay: prefersReducedMotion ? 0 : idx * 0.02 }}
                            onClick={() => handleSelectTab(srv.tabId)}
                            className={cn(
                              'min-h-[54px] p-2.5 rounded-2xl border text-right flex items-center gap-3 transition-all cursor-pointer active:scale-[0.98]',
                              isActive
                                ? 'bg-indigo-50/90 border-indigo-300 shadow-2xs'
                                : 'bg-white border-slate-200/90 hover:border-indigo-200 hover:bg-slate-50/70'
                            )}
                          >
                            <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center shrink-0', srv.accentClass)}>
                              <Icon size={19} active={isActive} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-black text-slate-900 truncate">{srv.title}</div>
                              <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">{srv.subtitle}</div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Account & System Tools */}
                <div className="space-y-2 pt-2 border-t border-slate-100 pb-4">
                  <h3 className="text-[11px] font-black text-slate-500 px-1">تنظیمات و امنیت حساب</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectTab('security-pin-settings')}
                      className="min-h-[46px] px-3 py-2 rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 text-slate-800 text-xs font-bold flex items-center gap-2 cursor-pointer"
                    >
                      <GlyphSecurityKey size={17} className="text-indigo-600 shrink-0" />
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
                      <span className="truncate">نمای دسکتاپ</span>
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
