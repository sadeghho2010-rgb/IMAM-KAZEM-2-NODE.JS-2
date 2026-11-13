import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Lock,
  Unlock,
  Users,
  UserCheck,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Sliders,
  Utensils,
  CalendarCheck,
  Clock,
  Send,
  Calendar,
  BookOpen,
  User,
  GraduationCap,
  Wallet,
  CalendarDays,
  BookPlus,
  ListTodo,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { localDb } from '../../lib/localDb';
import { Student } from '../../types';
import { cn } from '../../lib/utils';

export type StudentSectionOverrideState = 'default' | 'enabled' | 'disabled';

export interface StudentPortalAccessConfig {
  id: string;
  globalSections: Record<string, boolean>; // true = enabled (default), false = disabled for all students
  studentOverrides: Record<string, Record<string, StudentSectionOverrideState>>; // studentKey -> { sectionKey -> 'default' | 'enabled' | 'disabled' }
  updatedAt: string;
  updatedBy?: string;
}

export const STUDENT_PORTAL_CONFIG_DOC_ID = 'global_student_portal_access_v1';

export interface StudentSectionDefinition {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  icon: React.ElementType;
  color: string;
  relatedTabIds: string[];
  mobileTabIds: string[];
}

export const ALL_STUDENT_PORTAL_SECTIONS: StudentSectionDefinition[] = [
  {
    id: 'lunch_reservation',
    title: 'رزرو ناهار و تغذیه',
    subtitle: 'مشاهده برنامه غذایی هفتگی و ثبت یا لغو رزرو ناهار طلاب',
    category: 'رفاهی و مالی',
    icon: Utensils,
    color: 'from-orange-500 to-amber-600',
    relatedTabIds: ['lunch-reservation', 'student-meals'],
    mobileTabIds: ['meals']
  },
  {
    id: 'attendance_and_self_report',
    title: 'حضور و غیاب و ثبت خوداظهاری',
    subtitle: 'ثبت خوداظهاری حضور در کلاس‌ها، مشاهده وضعیت حضور، غیبت و تأخیر',
    category: 'آموزشی و انضباطی',
    icon: CalendarCheck,
    color: 'from-emerald-500 to-teal-600',
    relatedTabIds: ['attendance', 'presence-hours', 'self-reporting'],
    mobileTabIds: ['self_attendance']
  },
  {
    id: 'study_hours',
    title: 'ثبت مطالعه (ساعت مطالعه من)',
    subtitle: 'ثبت روزانه و دوره‌ای ساعات مطالعه و مشاهده آمار و نمودار مطالعه فردی',
    category: 'آموزشی و انضباطی',
    icon: Clock,
    color: 'from-indigo-500 to-blue-600',
    relatedTabIds: ['stats'],
    mobileTabIds: ['study']
  },
  {
    id: 'student_requests',
    title: 'ثبت تقاضا و درخواست‌ها',
    subtitle: 'ارسال درخواست‌های آموزشی، مالی، پژوهشی و مرخصی و پیگیری پاسخ مسئولین',
    category: 'اداری و مکاتبات',
    icon: Send,
    color: 'from-sky-500 to-cyan-600',
    relatedTabIds: ['student-requests'],
    mobileTabIds: ['requests']
  },
  {
    id: 'weekly_schedule',
    title: 'برنامه درسی و هفتگی من',
    subtitle: 'مشاهده جدول برنامه کلاسی هفتگی، اساتید، ساعات و مدرس‌های برگزاری',
    category: 'آموزشی و انضباطی',
    icon: Calendar,
    color: 'from-violet-500 to-purple-600',
    relatedTabIds: ['student-schedule', 'programs'],
    mobileTabIds: ['schedule']
  },
  {
    id: 'discussion_groups',
    title: 'گروه مباحثه و پایش درس',
    subtitle: 'مشاهده هم‌مباحثه‌ای‌ها، ثبت جلسات مباحثه و پایش مستمر دروس',
    category: 'آموزشی و انضباطی',
    icon: Users,
    color: 'from-teal-500 to-emerald-600',
    relatedTabIds: ['discussion'],
    mobileTabIds: ['discussion']
  },
  {
    id: 'student_profile_portal',
    title: 'پورتال اختصاصی پرونده و کارنامه',
    subtitle: 'مشاهده اطلاعات شناسنامه‌ای، وضعیت کلی پرونده، کمد شخصی و خلاصه عملکرد',
    category: 'پرونده و کارنامه',
    icon: User,
    color: 'from-blue-600 to-indigo-700',
    relatedTabIds: ['student-portal', 'summary'],
    mobileTabIds: ['profile']
  },
  {
    id: 'research_and_articles',
    title: 'بخش پژوهش و مقالات علمی',
    subtitle: 'ارسال مقالات علمی، مشاهده جلسات دفاع و ارزیابی مقالات و سوابق پژوهشی',
    category: 'پژوهش و علمی',
    icon: BookOpen,
    color: 'from-fuchsia-500 to-pink-600',
    relatedTabIds: ['research', 'article-evaluations'],
    mobileTabIds: ['articles']
  },
  {
    id: 'passed_courses_transcript',
    title: 'دروس گذرانده شده و کارنامه علمی',
    subtitle: 'مشاهده دروس گذرانده شده (سبز)، دروس در حال جریان (آبی) و دروس مانده (قرمز)',
    category: 'پرونده و کارنامه',
    icon: GraduationCap,
    color: 'from-amber-500 to-orange-600',
    relatedTabIds: ['passed-courses'],
    mobileTabIds: ['passed_courses']
  },
  {
    id: 'finance_and_tuition',
    title: 'امور مالی، شهریه و پرداخت‌ها',
    subtitle: 'مشاهده وضعیت واریز کمک‌هزینه/شهریه، وام‌ها و سوابق مالی طلبه',
    category: 'رفاهی و مالی',
    icon: Wallet,
    color: 'from-rose-500 to-red-600',
    relatedTabIds: ['finance', 'student-tuition', 'student-payments'],
    mobileTabIds: ['tuition']
  },
  {
    id: 'academic_calendar',
    title: 'تقویم آموزشی سالانه',
    subtitle: 'مشاهده نیمسال‌های تحصیلی، روزهای دایر، تعطیلات رسمی و مناسبت‌های مدرسه',
    category: 'آموزشی و انضباطی',
    icon: CalendarDays,
    color: 'from-cyan-500 to-blue-600',
    relatedTabIds: ['academic-calendar'],
    mobileTabIds: ['calendar']
  },
  {
    id: 'course_selection',
    title: 'انتخاب واحد دروس',
    subtitle: 'ثبت درخواست انتخاب واحد در دوره‌های فعال انتخاب واحد مدرسه',
    category: 'آموزشی و انضباطی',
    icon: BookPlus,
    color: 'from-lime-600 to-emerald-600',
    relatedTabIds: ['course-selection'],
    mobileTabIds: ['courses']
  },
  {
    id: 'personal_todos',
    title: 'مدیریت کارها و پیگیری‌های شخصی',
    subtitle: 'ثبت یادداشت‌ها، کارهای روزانه و مشاهده وظایف ارجاع‌شده',
    category: 'اداری و مکاتبات',
    icon: ListTodo,
    color: 'from-slate-600 to-slate-800',
    relatedTabIds: ['todos'],
    mobileTabIds: ['todos']
  }
];

export function createDefaultStudentPortalAccessConfig(): StudentPortalAccessConfig {
  const globalSections: Record<string, boolean> = {};
  ALL_STUDENT_PORTAL_SECTIONS.forEach(sec => {
    globalSections[sec.id] = true;
  });
  return {
    id: STUDENT_PORTAL_CONFIG_DOC_ID,
    globalSections,
    studentOverrides: {},
    updatedAt: new Date().toISOString()
  };
}

/**
 * Resolves whether a given sectionId or tabId or mobileTabId is enabled for a specific student.
 * Priority:
 * 1. Individual student override ('enabled' -> true, 'disabled' -> false)
 * 2. Global section setting (false -> false, true/undefined -> true)
 */
export function isStudentPortalTargetAllowed(
  config: StudentPortalAccessConfig | null | undefined,
  studentIdentifiers: (string | undefined | null)[],
  targetId: string
): boolean {
  if (!config) return true;

  // Find which section definition matches targetId
  const matchedSection = ALL_STUDENT_PORTAL_SECTIONS.find(
    sec =>
      sec.id === targetId ||
      sec.relatedTabIds.includes(targetId) ||
      sec.mobileTabIds.includes(targetId)
  );

  if (!matchedSection) {
    return true;
  }

  const sectionId = matchedSection.id;
  const cleanKeys = studentIdentifiers
    .filter(Boolean)
    .map(k => String(k).trim().toUpperCase());

  if (config.studentOverrides) {
    for (const key of cleanKeys) {
      const overrideMap = config.studentOverrides[key] || config.studentOverrides[key.toLowerCase()];
      if (overrideMap) {
        const state = overrideMap[sectionId];
        if (state === 'enabled') return true;
        if (state === 'disabled') return false;
      }
    }
  }

  if (config.globalSections && config.globalSections[sectionId] === false) {
    return false;
  }

  return true;
}

export default function StudentAccessManagement() {
  const { currentUser } = useAuth();

  const isAuthorized = Boolean(
    currentUser &&
      (currentUser.level === 1 ||
        currentUser.role === 'super_admin' ||
        currentUser.role === 'school_manager' ||
        currentUser.role === 'education_manager' ||
        currentUser.role === 'education_officer' ||
        currentUser.username?.toUpperCase() === 'SHAH' ||
        currentUser.username?.toUpperCase() === 'SHAHPOORI' ||
        currentUser.username?.toUpperCase() === 'SADEGH')
  );

  const [activeMode, setActiveMode] = useState<'global' | 'individual'>('global');
  const [config, setConfig] = useState<StudentPortalAccessConfig>(createDefaultStudentPortalAccessConfig);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async (forceCloud = false) => {
    try {
      if (forceCloud) {
        await Promise.all([
          localDb.syncCollectionFromCloud('student_portal_access_config', true),
          localDb.syncCollectionFromCloud('students', true)
        ]).catch(() => {});
      }

      const [configDocs, studentDocs] = await Promise.all([
        localDb.getDocs<StudentPortalAccessConfig>('student_portal_access_config'),
        localDb.getDocs<Student>('students')
      ]);

      const foundConfig =
        (configDocs || []).find(c => c.id === STUDENT_PORTAL_CONFIG_DOC_ID) ||
        (configDocs || [])[0];

      if (foundConfig) {
        const def = createDefaultStudentPortalAccessConfig();
        setConfig({
          ...def,
          ...foundConfig,
          globalSections: { ...def.globalSections, ...(foundConfig.globalSections || {}) },
          studentOverrides: foundConfig.studentOverrides || {}
        });
      }

      const activeStudents = (studentDocs || []).filter(s => s && s.isActive !== false);
      setStudents(activeStudents);
      if (!selectedStudentId && activeStudents.length > 0) {
        setSelectedStudentId(activeStudents[0].id);
      }
    } catch (err) {
      console.error('Error loading student access config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
    const unsub = localDb.subscribe(() => loadData(false));
    const handleConfigChange = () => loadData(false);
    window.addEventListener('collection_change_student_portal_access_config', handleConfigChange);
    return () => {
      unsub();
      window.removeEventListener('collection_change_student_portal_access_config', handleConfigChange);
    };
  }, []);

  const persistConfig = async (nextConfig: StudentPortalAccessConfig, successMsg?: string) => {
    setIsSaving(true);
    try {
      const payload: StudentPortalAccessConfig = {
        ...nextConfig,
        id: STUDENT_PORTAL_CONFIG_DOC_ID,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.fullName || currentUser?.name || currentUser?.username || 'مسئول آموزش'
      };
      setConfig(payload);
      await localDb.setDoc('student_portal_access_config', payload);
      window.dispatchEvent(new CustomEvent('collection_change_student_portal_access_config', { detail: payload }));
      window.dispatchEvent(new CustomEvent('app_data_change', { detail: { collection: 'student_portal_access_config' } }));
      if (successMsg) {
        showToast('success', successMsg);
      }
    } catch (err: any) {
      showToast('error', err?.message || 'خطا در ذخیره تنظیمات دسترسی طلاب');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleGlobalSection = async (sectionId: string, title: string) => {
    const currentVal = config.globalSections[sectionId] !== false;
    const nextVal = !currentVal;
    const nextConfig: StudentPortalAccessConfig = {
      ...config,
      globalSections: {
        ...config.globalSections,
        [sectionId]: nextVal
      }
    };
    await persistConfig(
      nextConfig,
      `بخش «${title}» برای کل طلاب ${nextVal ? 'فعال شد ✅' : 'غیرفعال شد 🔒'}`
    );
  };

  const handleToggleAllGlobal = async (enableAll: boolean) => {
    const nextGlobal: Record<string, boolean> = {};
    ALL_STUDENT_PORTAL_SECTIONS.forEach(sec => {
      nextGlobal[sec.id] = enableAll;
    });
    const nextConfig: StudentPortalAccessConfig = {
      ...config,
      globalSections: nextGlobal
    };
    await persistConfig(
      nextConfig,
      enableAll ? 'تمامی بخش‌های پنل برای کل طلاب فعال گردید ✅' : 'تمامی بخش‌های پنل برای کل طلاب غیرفعال گردید 🔒'
    );
  };

  const selectedStudent = useMemo(
    () => students.find(s => s.id === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  const getStudentCanonicalKeys = (student: Student): string[] => {
    return Array.from(
      new Set(
        [student.id, student.nationalId, student.studentCode]
          .filter(Boolean)
          .map(x => String(x).trim().toUpperCase())
      )
    );
  };

  const getStudentSectionOverride = (student: Student, sectionId: string): StudentSectionOverrideState => {
    const keys = getStudentCanonicalKeys(student);
    for (const k of keys) {
      const map = config.studentOverrides?.[k] || config.studentOverrides?.[k.toLowerCase()];
      if (map && map[sectionId]) {
        return map[sectionId];
      }
    }
    return 'default';
  };

  const handleSetStudentSectionOverride = async (
    student: Student,
    sectionId: string,
    sectionTitle: string,
    newState: StudentSectionOverrideState
  ) => {
    const keys = getStudentCanonicalKeys(student);
    const nextOverrides = { ...(config.studentOverrides || {}) };

    keys.forEach(k => {
      const currentMap = { ...(nextOverrides[k] || {}) };
      if (newState === 'default') {
        delete currentMap[sectionId];
      } else {
        currentMap[sectionId] = newState;
      }
      nextOverrides[k] = currentMap;
    });

    const nextConfig: StudentPortalAccessConfig = {
      ...config,
      studentOverrides: nextOverrides
    };

    const stateLabel =
      newState === 'enabled'
        ? 'فعال اختصاصی ✅'
        : newState === 'disabled'
        ? 'غیرفعال اختصاصی 🔒'
        : 'پیش‌فرض عمومی 🔄';

    await persistConfig(
      nextConfig,
      `بخش «${sectionTitle}» برای طلبه «${student.name}» در حالت «${stateLabel}» قرار گرفت.`
    );
  };

  const handleResetStudentOverrides = async (student: Student) => {
    const keys = getStudentCanonicalKeys(student);
    const nextOverrides = { ...(config.studentOverrides || {}) };
    keys.forEach(k => {
      delete nextOverrides[k];
      delete nextOverrides[k.toLowerCase()];
    });
    const nextConfig: StudentPortalAccessConfig = {
      ...config,
      studentOverrides: nextOverrides
    };
    await persistConfig(
      nextConfig,
      `تمامی تنظیمات اختصاصی طلبه «${student.name}» به حالت پیش‌فرض عمومی بازنشانی شد.`
    );
  };

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (gradeFilter !== 'all' && s.grade !== gradeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const nameMatch = (s.name || '').toLowerCase().includes(q);
        const natMatch = (s.nationalId || '').toLowerCase().includes(q);
        const codeMatch = (s.studentCode || '').toLowerCase().includes(q);
        if (!nameMatch && !natMatch && !codeMatch) return false;
      }
      return true;
    });
  }, [students, gradeFilter, searchQuery]);

  const uniqueGrades = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      if (s.grade) set.add(s.grade);
    });
    return Array.from(set);
  }, [students]);

  if (!isAuthorized) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-rose-200 shadow-sm text-rose-700 font-bold max-w-2xl mx-auto space-y-3" dir="rtl">
        <Lock size={48} className="mx-auto text-rose-500" />
        <h2 className="text-lg font-black">عدم دسترسی به مدیریت بخش‌های طلاب</h2>
        <p className="text-xs text-rose-600 leading-relaxed">
          این بخش منحصراً در اختیار مسئول آموزش و سوپر ادمین سامانه می‌باشد.
        </p>
      </div>
    );
  }

  const enabledGlobalCount = ALL_STUDENT_PORTAL_SECTIONS.filter(
    s => config.globalSections[s.id] !== false
  ).length;
  const disabledGlobalCount = ALL_STUDENT_PORTAL_SECTIONS.length - enabledGlobalCount;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 font-vazir text-right" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-indigo-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute -left-10 -top-10 w-52 h-52 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-bold border border-white/15">
              <ShieldCheck size={15} className="text-emerald-400" />
              <span>کنترل هوشمند دسترسی پنل طلاب (عمومی و تک‌به‌تک)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              مدیریت فعال و غیرفعال‌سازی بخش‌های پنل طلاب
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-3xl leading-relaxed">
              در این بخش می‌توانید هر یک از امکانات پنل طلاب (رزرو ناهار، حضور و غیاب، ثبت مطالعه، ثبت درخواست، برنامه درسی، گروه مباحثه، کارنامه، پژوهش، امور مالی، تقویم آموزشی و...) را به صورت سراسری برای کل طلاب یا به صورت اختصاصی برای یک طلبه خاص فعال یا مخفی نمایید.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/10 p-4 rounded-2xl border border-white/15 shrink-0">
            <div className="text-center px-3">
              <span className="block text-2xl font-black text-emerald-400">{enabledGlobalCount}</span>
              <span className="text-[11px] text-slate-300">بخش فعال عمومی</span>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center px-3">
              <span className="block text-2xl font-black text-rose-400">{disabledGlobalCount}</span>
              <span className="text-[11px] text-slate-300">بخش غیرفعال عمومی</span>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={cn(
            'p-4 rounded-2xl border text-xs sm:text-sm font-black flex items-center justify-between shadow-sm animate-in fade-in duration-200',
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          )}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            ) : (
              <XCircle size={18} className="text-rose-600 shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      {/* Mode Switcher Tabs */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveMode('global')}
            className={cn(
              'flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer',
              activeMode === 'global'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <Sliders size={16} />
            <span>۱. تنظیمات سراسری (کل طلاب)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('individual')}
            className={cn(
              'flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer',
              activeMode === 'individual'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <UserCheck size={16} />
            <span>۲. تنظیمات موردی و اختصاصی (تک‌تک طلاب)</span>
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {activeMode === 'global' && (
            <>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleToggleAllGlobal(true)}
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Unlock size={14} />
                <span>فعال‌سازی همه بخش‌ها</span>
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleToggleAllGlobal(false)}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Lock size={14} />
                <span>غیرفعال‌سازی همه بخش‌ها</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => loadData(true)}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
            title="بروزرسانی از سرور"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* TAB 1: GLOBAL ACCESS CONTROL FOR ALL STUDENTS */}
      {activeMode === 'global' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ALL_STUDENT_PORTAL_SECTIONS.map(sec => {
            const Icon = sec.icon;
            const isEnabled = config.globalSections[sec.id] !== false;

            return (
              <div
                key={sec.id}
                className={cn(
                  'rounded-3xl p-5 border transition-all flex flex-col justify-between gap-4 shadow-xs',
                  isEnabled
                    ? 'bg-white border-slate-200 hover:border-indigo-300'
                    : 'bg-rose-50/40 border-rose-200/80'
                )}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md bg-gradient-to-br shrink-0',
                          isEnabled ? sec.color : 'from-slate-400 to-slate-500'
                        )}
                      >
                        <Icon size={22} />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          {sec.category}
                        </span>
                        <h3 className="text-sm sm:text-base font-black text-slate-900 mt-1">
                          {sec.title}
                        </h3>
                      </div>
                    </div>

                    <span
                      className={cn(
                        'px-2.5 py-1 rounded-xl text-[11px] font-black border shrink-0 flex items-center gap-1',
                        isEnabled
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-100 text-rose-800 border-rose-300'
                      )}
                    >
                      {isEnabled ? (
                        <>
                          <Unlock size={12} />
                          <span>فعال</span>
                        </>
                      ) : (
                        <>
                          <Lock size={12} />
                          <span>غیرفعال</span>
                        </>
                      )}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    {sec.subtitle}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-500">
                    وضعیت نمایش در پنل طلاب:
                  </span>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleToggleGlobalSection(sec.id, sec.title)}
                    className={cn(
                      'px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs',
                      isEnabled
                        ? 'bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    )}
                  >
                    {isEnabled ? (
                      <>
                        <Lock size={14} />
                        <span>غیرفعال کردن برای طلاب</span>
                      </>
                    ) : (
                      <>
                        <Unlock size={14} />
                        <span>فعال کردن برای طلاب</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: PER-STUDENT INDIVIDUAL OVERRIDES */}
      {activeMode === 'individual' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Right Column: Student Selector List */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-4 space-y-4 shadow-xs h-fit">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Users size={17} className="text-indigo-600" />
                <span>انتخاب طلبه ({filteredStudents.length} نفر)</span>
              </h3>
            </div>

            <div className="space-y-2.5">
              <div className="relative">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="جستجوی نام، کد ملی یا کد طلبگی..."
                  className="w-full pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={gradeFilter}
                onChange={e => setGradeFilter(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
              >
                <option value="all">همه پایه‌های تحصیلی</option>
                {uniqueGrades.map(g => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="max-h-[520px] overflow-y-auto space-y-1.5 pr-1">
              {filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 font-bold border-2 border-dashed border-slate-200 rounded-2xl">
                  هیچ طلبه‌ای در لیست یافت نشد. پس از افزودن طلاب جدید در بخش مدیریت طلاب، اسامی آنان در این لیست نمایش داده می‌شود.
                </div>
              ) : (
                filteredStudents.map(st => {
                  const isSelected = st.id === selectedStudent?.id;
                  const keys = getStudentCanonicalKeys(st);
                  let customCount = 0;
                  keys.forEach(k => {
                    const m = config.studentOverrides?.[k];
                    if (m) {
                      customCount = Math.max(
                        customCount,
                        Object.values(m).filter(v => v === 'enabled' || v === 'disabled').length
                      );
                    }
                  });

                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSelectedStudentId(st.id)}
                      className={cn(
                        'w-full text-right p-3 rounded-2xl border transition-all flex items-center justify-between gap-2 cursor-pointer',
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                          : 'bg-slate-50/70 hover:bg-slate-100 text-slate-800 border-slate-200/80'
                      )}
                    >
                      <div className="min-w-0">
                        <div className="font-black text-xs sm:text-sm truncate">{st.name}</div>
                        <div
                          className={cn(
                            'text-[11px] font-medium mt-0.5 flex items-center gap-2',
                            isSelected ? 'text-indigo-100' : 'text-slate-500'
                          )}
                        >
                          <span>{st.grade || 'پایه نامشخص'}</span>
                          {st.nationalId && <span>• {st.nationalId}</span>}
                        </div>
                      </div>

                      {customCount > 0 && (
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-black shrink-0',
                            isSelected
                              ? 'bg-white text-indigo-700'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          )}
                        >
                          {customCount} تنظیم خاص
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Left Column: Selected Student Section Permissions */}
          <div className="lg:col-span-8 space-y-4">
            {!selectedStudent ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center text-slate-500 font-bold text-sm">
                لطفاً یک طلبه را از ستون سمت راست انتخاب نمایید تا دسترسی بخش‌های پنل او را به صورت اختصاصی تنظیم کنید.
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full mb-1.5">
                      <Sparkles size={13} />
                      <span>تنظیمات دسترسی اختصاصی طلبه</span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900">
                      {selectedStudent.name}{' '}
                      <span className="text-xs font-bold text-slate-500">
                        ({selectedStudent.grade || 'پایه عمومی'} • کد ملی: {selectedStudent.nationalId || '---'})
                      </span>
                    </h3>
                  </div>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleResetStudentOverrides(selectedStudent)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                  >
                    <RotateCcw size={14} />
                    <span>بازنشانی به پیش‌فرض کل طلاب</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {ALL_STUDENT_PORTAL_SECTIONS.map(sec => {
                    const Icon = sec.icon;
                    const overrideState = getStudentSectionOverride(selectedStudent, sec.id);
                    const globalEnabled = config.globalSections[sec.id] !== false;
                    const effectiveAllowed = isStudentPortalTargetAllowed(
                      config,
                      getStudentCanonicalKeys(selectedStudent),
                      sec.id
                    );

                    return (
                      <div
                        key={sec.id}
                        className={cn(
                          'p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4',
                          effectiveAllowed
                            ? 'bg-slate-50/60 border-slate-200'
                            : 'bg-rose-50/40 border-rose-200'
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              'w-10 h-10 rounded-xl flex items-center justify-center text-white bg-gradient-to-br shrink-0',
                              effectiveAllowed ? sec.color : 'from-slate-400 to-slate-500'
                            )}
                          >
                            <Icon size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-xs sm:text-sm text-slate-900">
                                {sec.title}
                              </span>
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded-lg text-[10px] font-black',
                                  effectiveAllowed
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                )}
                              >
                                {effectiveAllowed ? 'در پنل این طلبه: فعال ✅' : 'در پنل این طلبه: مخفی 🔒'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                              وضعیت عمومی کل طلاب:{' '}
                              <strong className={globalEnabled ? 'text-emerald-700' : 'text-rose-700'}>
                                {globalEnabled ? 'فعال' : 'غیرفعال'}
                              </strong>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 bg-white p-1 rounded-xl border border-slate-200">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() =>
                              handleSetStudentSectionOverride(selectedStudent, sec.id, sec.title, 'default')
                            }
                            className={cn(
                              'px-2.5 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer',
                              overrideState === 'default'
                                ? 'bg-slate-800 text-white shadow-xs'
                                : 'text-slate-600 hover:bg-slate-100'
                            )}
                          >
                            پیش‌فرض عمومی
                          </button>

                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() =>
                              handleSetStudentSectionOverride(selectedStudent, sec.id, sec.title, 'enabled')
                            }
                            className={cn(
                              'px-2.5 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center gap-1',
                              overrideState === 'enabled'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                            )}
                          >
                            <Unlock size={12} />
                            <span>فعال اختصاصی</span>
                          </button>

                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() =>
                              handleSetStudentSectionOverride(selectedStudent, sec.id, sec.title, 'disabled')
                            }
                            className={cn(
                              'px-2.5 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center gap-1',
                              overrideState === 'disabled'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                            )}
                          >
                            <Lock size={12} />
                            <span>غیرفعال اختصاصی</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
