import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import {
  BookOpen,
  Calendar,
  CheckSquare,
  Clock,
  LogOut,
  Send,
  Sparkles,
  Users,
  UtensilsCrossed,
  BookCheck,
  ChevronLeft,
  LayoutDashboard,
  Wallet,
  BrainCircuit,
  CalendarDays,
  FileText,
  ListTodo,
  GraduationCap,
  KeyRound,
  Info,
  DoorOpen,
  ShieldCheck,
} from 'lucide-react';
import { cn, getProgramDays } from '../../lib/utils';
import { localDb } from '../../lib/localDb';
import {
  Program,
  StudentRequest,
  StudyPeriod,
  StudyDailyEntry,
  AttendanceSessionLog,
  Student,
} from '../../types';
import { getTodayShamsi, getShamsiDayOfWeekName, toEnglishDigits } from '../../lib/jalali';
import { StudentSelfReportingModal } from '../attendance/StudentSelfReportingModal';
import { AnimatedRingGauge } from './mobile/AnimatedRingGauge';
import {
  isProgramActiveAndValid,
  isStudentEnrolledInProgram,
  buildStudentCandidateIds,
  isPeriodClosed,
  formatMinutesToHoursAndMinutes,
} from '../study/studyUtils';

interface StudentMobilePanelProps {
  onNavigateTab: (tab: string, studentId?: string) => void;
  onSwitchToDesktopView?: () => void;
  isInsideShell?: boolean;
}

function parseProgramTimeRangeMinutes(timeStr?: string): { start: number; end: number } | null {
  if (!timeStr) return null;
  const eng = toEnglishDigits(timeStr);
  const matches = eng.match(/\d{1,2}[:：]\d{1,2}/g);
  if (!matches || matches.length === 0) return null;
  const toMin = (t: string) => {
    const [hStr, mStr] = t.replace('：', ':').split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
  };
  const s = toMin(matches[0]);
  if (s === null) return null;
  const e = matches.length > 1 ? toMin(matches[1]) ?? s + 60 : s + 60;
  return { start: s, end: e };
}

export const StudentMobilePanel: React.FC<StudentMobilePanelProps> = ({
  onNavigateTab,
  onSwitchToDesktopView,
  isInsideShell = false,
}) => {
  const { currentUser, logout, isTabAllowed } = useAuth();
  const prefersReducedMotion = useReducedMotion();

  const [todayPrograms, setTodayPrograms] = useState<Program[]>([]);
  const [allProgramsList, setAllProgramsList] = useState<Program[]>([]);
  const [enrollmentsList, setEnrollmentsList] = useState<any[]>([]);
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);
  const [selfReportingCount, setSelfReportingCount] = useState(0);
  const [isSelfReportingModalOpen, setIsSelfReportingModalOpen] = useState(false);
  const [noticeModal, setNoticeModal] = useState<{ title: string; message: string; subtext: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [myRequestsCount, setMyRequestsCount] = useState(0);

  // Live overview KPI metrics
  const [studyMinutes, setStudyMinutes] = useState(0);
  const [studyMandatoryMinutes, setStudyMandatoryMinutes] = useState(800);
  const [activePeriodTitle, setActivePeriodTitle] = useState('');
  const [attendanceRate, setAttendanceRate] = useState(100);
  const [attendanceSessionsCount, setAttendanceSessionsCount] = useState(0);

  const [hasRepProgram, setHasRepProgram] = useState(false);
  const [myRepProgramTitle, setMyRepProgramTitle] = useState('');

  const initialLoadDoneRef = React.useRef(false);

  const todayShamsi = useMemo(() => getTodayShamsi(), []);
  const todayDayName = useMemo(() => getShamsiDayOfWeekName(todayShamsi), [todayShamsi]);

  useEffect(() => {
    loadStudentData(true);

    const handleRefresh = () => loadStudentData(false);
    const unsub = localDb.subscribe(handleRefresh);
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === 'programs_updated_at' ||
        e.key === 'study_periods_updated_at' ||
        e.key === 'study_logs_updated_at'
      ) {
        loadStudentData(false);
      }
    };

    window.addEventListener('collection_change_programs', handleRefresh);
    window.addEventListener('collection_change_study_periods', handleRefresh);
    window.addEventListener('collection_change_study_daily_entries', handleRefresh);
    window.addEventListener('collection_change_periodic_study_logs', handleRefresh);
    window.addEventListener('attendance_updated', handleRefresh);
    window.addEventListener('app_data_change', handleRefresh);
    window.addEventListener('storage', handleStorage);

    return () => {
      unsub();
      window.removeEventListener('collection_change_programs', handleRefresh);
      window.removeEventListener('collection_change_study_periods', handleRefresh);
      window.removeEventListener('collection_change_study_daily_entries', handleRefresh);
      window.removeEventListener('collection_change_periodic_study_logs', handleRefresh);
      window.removeEventListener('attendance_updated', handleRefresh);
      window.removeEventListener('app_data_change', handleRefresh);
      window.removeEventListener('storage', handleStorage);
    };
  }, [currentUser, todayDayName]);

  const loadStudentData = async (isInitial = false) => {
    try {
      if (isInitial && !initialLoadDoneRef.current) {
        setIsLoading(true);
      }

      const [
        allProgs,
        allReqs,
        allStudents,
        courseEnrs,
        legacyEnrs,
        allPeriods,
        allDailyEntries,
        allAttendance,
      ] = await Promise.all([
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<StudentRequest>('student_requests'),
        localDb.getDocs<Student>('students'),
        localDb.getDocs<any>('course_enrollments'),
        localDb.getDocs<any>('enrollments'),
        localDb.getDocs<StudyPeriod>('study_periods'),
        localDb.getDocs<StudyDailyEntry>('study_daily_entries'),
        localDb.getDocs<AttendanceSessionLog>('attendance'),
      ]);

      const combinedEnrollments = [...(courseEnrs || []), ...(legacyEnrs || [])];
      const activeProgs = (allProgs || []).filter(isProgramActiveAndValid);
      setAllProgramsList(activeProgs);
      setEnrollmentsList(combinedEnrollments);

      const cName = (currentUser?.name || currentUser?.fullName || '').trim().toLowerCase();
      const sId = currentUser?.studentId || currentUser?.linkedStudentId || currentUser?.id;
      const uName = (currentUser?.username || '').trim().toLowerCase();

      const matchedSt = (allStudents || []).find(
        (s) =>
          (sId && String(s.id) === String(sId)) ||
          (uName && (s.nationalId?.toLowerCase() === uName || s.studentCode?.toLowerCase() === uName)) ||
          (cName && s.name?.toLowerCase().includes(cName))
      );
      setMatchedStudent(matchedSt || null);

      const candidateIdSet = buildStudentCandidateIds(
        matchedSt || null,
        [sId, currentUser?.id, currentUser?.linkedStudentId, currentUser?.username].filter(Boolean) as string[]
      );
      const candidateIdsLower = Array.from(candidateIdSet).map((x) => x.toLowerCase().trim());
      const candidateNames = [cName, matchedSt?.name?.toLowerCase()].filter(Boolean) as string[];

      // Active & enrolled courses for this student
      const myActiveCourses = activeProgs.filter((p) =>
        isStudentEnrolledInProgram(p, matchedSt || null, combinedEnrollments, candidateIdSet)
      );
      const myCourseIdSet = new Set(myActiveCourses.map((p) => String(p.id)));

      // Today's classes filtered strictly from active enrolled programs
      const normDay = (d: string) => d.replace(/[\u200c\s]/g, '').trim();
      const todayNorm = normDay(todayDayName);
      const filteredToday = myActiveCourses
        .filter((p) => getProgramDays(p).some((d) => normDay(d) === todayNorm))
        .sort((a, b) => {
          const rA = parseProgramTimeRangeMinutes(a.time);
          const rB = parseProgramTimeRangeMinutes(b.time);
          return (rA?.start ?? 9999) - (rB?.start ?? 9999);
        });
      setTodayPrograms(filteredToday);

      // Representative status check across active programs
      const repProg = activeProgs.find((p) => {
        const repIds = Array.isArray((p as any).representativeStudentIds)
          ? (p as any).representativeStudentIds.map((x: any) => String(x).toLowerCase().trim())
          : [];
        if (repIds.some((id: string) => candidateIdsLower.includes(id))) return true;
        const repNames = Array.isArray((p as any).representativeNames)
          ? (p as any).representativeNames
              .map((n: string) => n.replace(/\(.*?\)/g, '').trim().toLowerCase())
              .filter(Boolean)
          : [];
        if (repNames.some((rn: string) => candidateNames.some((cn) => cn.includes(rn) || rn.includes(cn)))) {
          return true;
        }
        if (p.customRepresentative) {
          const cust = String(p.customRepresentative).replace(/\(.*?\)/g, '').trim().toLowerCase();
          return candidateNames.some((cn) => cn.includes(cust) || cust.includes(cn));
        }
        return false;
      });
      setHasRepProgram(Boolean(repProg));
      setMyRepProgramTitle(repProg ? repProg.title || 'کلاس درس' : '');

      // Self-reporting courses count
      const selfProgs = myActiveCourses.filter((p) => p.attendanceType === 'self_reporting');
      setSelfReportingCount(selfProgs.length);

      // Pending requests count
      if (Array.isArray(allReqs)) {
        const myReqs = allReqs.filter(
          (r) =>
            (r.studentId && candidateIdsLower.includes(String(r.studentId).toLowerCase().trim())) ||
            ((r as any).nationalId &&
              (String((r as any).nationalId).toLowerCase() === uName ||
                (matchedSt && String((r as any).nationalId).toLowerCase() === String(matchedSt.nationalId).toLowerCase())))
        );
        setMyRequestsCount(myReqs.filter((r) => r.status === 'pending').length);
      }

      // Live Study Period KPI
      const validPeriods = (allPeriods || [])
        .filter((p) => p && p.id && p.status !== 'deleted' && !(p as any).isDeleted && !(p as any).deletedAt)
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      const openPeriod = validPeriods.find((p) => !isPeriodClosed(p)) || validPeriods[0];

      if (openPeriod) {
        setActivePeriodTitle(openPeriod.title || 'دوره جاری');
        const mandMin = openPeriod.mandatoryMinutes || Math.round((openPeriod.mandatoryHours || 0) * 60) || 800;
        setStudyMandatoryMinutes(mandMin);

        const myEntries = (allDailyEntries || []).filter((e) => {
          if (e.periodId !== openPeriod.id) return false;
          const eIds = [e.studentId, (e as any).student_id, (e as any).userId, (e as any).nationalId, (e as any).studentCode]
            .filter(Boolean)
            .map((x) => String(x).toLowerCase().trim());
          return candidateIdsLower.some((cid) => eIds.includes(cid));
        });

        let periodMin = 0;
        myEntries.forEach((entry) => {
          if (typeof entry.totalMinutes === 'number' && entry.totalMinutes > 0) {
            periodMin += entry.totalMinutes;
          } else {
            let core = 0;
            if (Array.isArray(entry.coursesBreakdown)) {
              entry.coursesBreakdown.forEach((c) => {
                core += (c.studyMinutes || 0) + (c.discussionMinutes || 0);
              });
            } else {
              core += Math.round(((entry.studyHours || 0) + (entry.discussionHours || 0)) * 60);
            }
            periodMin += core + (entry.freeStudyMinutes || 0);
          }
        });
        setStudyMinutes(periodMin);
      } else {
        setActivePeriodTitle('');
        setStudyMinutes(0);
      }

      // Live Attendance Rate KPI (for active enrolled courses)
      let presentOrLate = 0;
      let totalAtt = 0;
      (allAttendance || []).forEach((rec) => {
        if (rec.programId && !myCourseIdSet.has(String(rec.programId))) return;
        const detail = rec.students?.find(
          (st) =>
            candidateIdsLower.includes(String(st.studentId).toLowerCase().trim()) ||
            (matchedSt?.name && st.studentName?.toLowerCase().includes(matchedSt.name.toLowerCase()))
        );
        if (detail) {
          totalAtt++;
          if (detail.status === 'present' || detail.status === 'late') {
            presentOrLate++;
          }
        }
      });
      setAttendanceSessionsCount(totalAtt);
      setAttendanceRate(totalAtt > 0 ? Math.round((presentOrLate / totalAtt) * 100) : 100);
    } catch (e) {
      console.warn('Error loading mobile student data:', e);
    } finally {
      initialLoadDoneRef.current = true;
      setIsLoading(false);
    }
  };

  const displayName = (currentUser?.name || currentUser?.fullName || currentUser?.username || 'دانش‌پژوه')
    .split('(')[0]
    .trim();

  const studyPct = studyMandatoryMinutes > 0 ? Math.min(100, Math.round((studyMinutes / studyMandatoryMinutes) * 100)) : 0;

  const secondaryServices = useMemo(() => {
    const items = [
      {
        tab: 'student-portal',
        title: 'کارنامه علمی',
        subtitle: 'نمرات و پرونده تحصیلی',
        icon: BrainCircuit,
        iconBg: 'bg-amber-50 text-amber-700 border-amber-200',
      },
      {
        tab: 'student-schedule',
        title: 'برنامه هفتگی',
        subtitle: 'ساعات دروس و اساتید',
        icon: Calendar,
        iconBg: 'bg-sky-50 text-sky-700 border-sky-200',
      },
      {
        tab: 'student-meals',
        title: 'رزرو ناهار و شام',
        subtitle: 'سلف و وعده‌های غذایی',
        icon: UtensilsCrossed,
        iconBg: 'bg-orange-50 text-orange-700 border-orange-200',
      },
      {
        tab: 'student-payments',
        title: 'پرداختی‌ها و مالی',
        subtitle: 'شهریه و کمک‌هزینه',
        icon: Wallet,
        iconBg: 'bg-teal-50 text-teal-700 border-teal-200',
      },
      {
        tab: 'discussion',
        title: 'گروه مباحثه',
        subtitle: 'هم‌مباحثه‌ای‌ها و پایش',
        icon: Users,
        iconBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      },
      {
        tab: 'course-selection',
        title: 'انتخاب واحد',
        subtitle: 'ثبت دروس دوره جدید',
        icon: BookCheck,
        iconBg: 'bg-lime-50 text-lime-700 border-lime-200',
      },
      {
        tab: 'passed-courses',
        title: 'دروس گذرانده',
        subtitle: 'کارنامه دروس گذرانده',
        icon: GraduationCap,
        iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      },
      {
        tab: 'research',
        title: 'پژوهش و مقالات',
        subtitle: 'مقالات و ارزیابی علمی',
        icon: FileText,
        iconBg: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
      },
      {
        tab: 'academic-calendar',
        title: 'تقویم آموزشی',
        subtitle: 'تعطیلات و مناسبت‌ها',
        icon: CalendarDays,
        iconBg: 'bg-blue-50 text-blue-700 border-blue-200',
      },
      {
        tab: 'todos',
        title: 'کارهای شخصی',
        subtitle: 'فهرست پیگیری و یادداشت',
        icon: ListTodo,
        iconBg: 'bg-slate-100 text-slate-700 border-slate-200',
      },
    ];
    return items.filter((it) => isTabAllowed(it.tab));
  }, [isTabAllowed]);

  const nowMinutes = useMemo(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }, [todayPrograms]);

  return (
    <div
      className={cn(
        'font-vazir text-right text-slate-800 space-y-3.5',
        !isInsideShell && 'min-h-screen bg-slate-50 pb-24 p-3'
      )}
      dir="rtl"
    >
      {/* Fallback Header ONLY when rendered standalone outside StudentMobileShell */}
      {!isInsideShell && (
        <div className="bg-slate-950 text-white px-3.5 py-3 rounded-2xl flex items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-teal-500 flex items-center justify-center font-black text-sm shrink-0">
              {displayName[0] || 'ط'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black truncate">{displayName}</div>
              <div className="text-[10px] text-slate-300 truncate">
                {currentUser?.gradeLabel || 'سطح ۳'} · {todayDayName} {todayShamsi}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {onSwitchToDesktopView && (
              <button
                type="button"
                onClick={onSwitchToDesktopView}
                className="px-2.5 py-1.5 bg-white/10 text-white rounded-xl text-[10px] font-black cursor-pointer"
              >
                نمای لپ‌تاپ
              </button>
            )}
            <button
              type="button"
              onClick={logout}
              className="p-2 bg-rose-500/20 text-rose-200 rounded-xl cursor-pointer"
              aria-label="خروج"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      )}

      {/* 1. Live Academic Overview Hero Card */}
      <motion.section
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-4 shadow-lg border border-indigo-500/20"
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="min-w-0">
            <div className="text-[10px] text-indigo-300 font-bold">
              {hasRepProgram ? `نماینده کلاس · ${myRepProgramTitle}` : `${currentUser?.gradeLabel || 'طلبه'} · ${todayDayName}`}
            </div>
            <h2 className="text-sm font-black text-white truncate mt-0.5">
              وضعیت آموزشی {activePeriodTitle ? `(${activePeriodTitle})` : 'دوره جاری'}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('security-pin-settings')}
            className="min-h-[36px] px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-[10px] font-bold text-slate-200 flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <KeyRound size={12} className="text-amber-300" />
            <span>پین امنیتی</span>
          </button>
        </div>

        {/* Two Live SVG Circular Rings */}
        <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-white/10">
          <button
            type="button"
            onClick={() => isTabAllowed('stats') && onNavigateTab('stats')}
            className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-right transition-colors cursor-pointer"
          >
            <AnimatedRingGauge
              percentage={studyPct}
              size={54}
              strokeWidth={5.5}
              progressClassName={studyPct >= 100 ? 'text-emerald-400' : 'text-cyan-400'}
              label="مطالعه دوره"
              valueText={`${studyMinutes} دقیقه`}
              subText={`از ${studyMandatoryMinutes} د موظفی`}
            />
          </button>

          <button
            type="button"
            onClick={() => isTabAllowed('attendance') && onNavigateTab('attendance')}
            className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-right transition-colors cursor-pointer"
          >
            <AnimatedRingGauge
              percentage={attendanceRate}
              size={54}
              strokeWidth={5.5}
              progressClassName={attendanceRate >= 85 ? 'text-emerald-400' : 'text-amber-400'}
              label="حضور در کلاس"
              valueText={`${attendanceRate}٪`}
              subText={`${attendanceSessionsCount} جلسه ثبت‌شده`}
            />
          </button>
        </div>

        {/* Direct Attendance / Representative Quick Strip */}
        {isTabAllowed('attendance') && (
          <motion.button
            type="button"
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            onClick={() => onNavigateTab(hasRepProgram && isTabAllowed('rep-attendance') ? 'rep-attendance' : 'attendance')}
            className={cn(
              'mt-3 w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl flex items-center justify-between gap-2 text-right transition-all cursor-pointer border',
              hasRepProgram
                ? 'bg-emerald-500/20 hover:bg-emerald-500/25 border-emerald-400/35 text-emerald-100'
                : 'bg-white/10 hover:bg-white/15 border-white/15 text-slate-100'
            )}
          >
            <div className="min-w-0">
              <div className="text-xs font-black truncate">
                {hasRepProgram
                  ? `ثبت سریع حضور کلاس «${myRepProgramTitle}»`
                  : 'مشاهده جزئیات حضور و غیاب من'}
              </div>
              <div className="text-[10px] opacity-80 truncate">
                {hasRepProgram ? 'ثبت حاضر و غایب اعضا با یک لمس' : 'گزارش حضور، تاخیرها و دروس خوداظهاری'}
              </div>
            </div>
            <ChevronLeft size={16} className="shrink-0 opacity-80" />
          </motion.button>
        )}
      </motion.section>

      {/* 2. Four Core Action Bento Tiles */}
      <section aria-label="سامانه‌های اصلی و پرکاربرد" className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-black text-slate-900">سامانه‌های اصلی</h2>
          <span className="text-[10px] text-slate-400 font-bold">دسترسی سریع</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {isTabAllowed('stats') && (
            <motion.button
              type="button"
              whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
              onClick={() => onNavigateTab('stats')}
              className="relative overflow-hidden rounded-2xl p-3.5 text-white text-right shadow-md border border-cyan-400/25 student-card-wave-study flex flex-col justify-between min-h-[108px] cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/25">
                  <BookOpen size={18} />
                </div>
                <span className="text-[10px] font-black text-cyan-100 tabular-nums">
                  {studyMinutes > 0 ? formatMinutesToHoursAndMinutes(studyMinutes) : 'ثبت روزانه'}
                </span>
              </div>
              <div className="pt-2 space-y-0.5">
                <h3 className="text-xs font-black text-white truncate">ساعت مطالعه من</h3>
                <p className="text-[10px] text-cyan-100/85 font-medium truncate">ثبت مطالعه و مباحثه دروس</p>
              </div>
            </motion.button>
          )}

          {isTabAllowed('student-requests') && (
            <motion.button
              type="button"
              whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
              onClick={() => onNavigateTab('student-requests')}
              className="relative overflow-hidden rounded-2xl p-3.5 text-white text-right shadow-md border border-emerald-400/25 student-card-wave-requests flex flex-col justify-between min-h-[108px] cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/25">
                  <Send size={17} />
                </div>
                <span
                  className={cn(
                    'text-[10px] font-black px-2 py-0.5 rounded-lg tabular-nums',
                    myRequestsCount > 0 ? 'bg-amber-400 text-slate-950' : 'text-emerald-100'
                  )}
                >
                  {myRequestsCount > 0 ? `${myRequestsCount} جاری` : 'کارتابل'}
                </span>
              </div>
              <div className="pt-2 space-y-0.5">
                <h3 className="text-xs font-black text-white truncate">ثبت تقاضا و درخواست</h3>
                <p className="text-[10px] text-emerald-100/85 font-medium truncate">مرخصی، گواهی و رفاهی</p>
              </div>
            </motion.button>
          )}

          {isTabAllowed('self-reporting') && (
            <motion.button
              type="button"
              whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
              onClick={() => onNavigateTab('self-reporting')}
              className="relative overflow-hidden rounded-2xl p-3.5 text-white text-right shadow-md border border-teal-400/25 bg-gradient-to-br from-teal-700 via-emerald-800 to-slate-900 flex flex-col justify-between min-h-[108px] cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/25">
                  <Sparkles size={18} />
                </div>
                <span className="text-[10px] font-black text-teal-100 tabular-nums">
                  {selfReportingCount > 0 ? `${selfReportingCount} درس` : 'خوداظهاری'}
                </span>
              </div>
              <div className="pt-2 space-y-0.5">
                <h3 className="text-xs font-black text-white truncate">ثبت خوداظهاری</h3>
                <p className="text-[10px] text-teal-100/85 font-medium truncate">اعلام آنلاین حضور جلسه</p>
              </div>
            </motion.button>
          )}

          {isTabAllowed('rep-attendance') && (
            <motion.button
              type="button"
              whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
              onClick={() => {
                if (!hasRepProgram) {
                  setNoticeModal({
                    title: 'ویژه نمایندگان کلاس',
                    message: 'شما در حال حاضر به عنوان نماینده کلاسی در برنامه‌های فعال ثبت نشده‌اید.',
                    subtext: 'ثبت حضور و غیاب کل کلاس فقط توسط نماینده منتخب درس یا مسئولین آموزش انجام می‌شود.',
                  });
                  return;
                }
                onNavigateTab('rep-attendance');
              }}
              className={cn(
                'relative overflow-hidden rounded-2xl p-3.5 text-white text-right shadow-md border flex flex-col justify-between min-h-[108px] cursor-pointer',
                hasRepProgram
                  ? 'bg-gradient-to-br from-indigo-700 via-purple-800 to-slate-900 border-purple-400/30'
                  : 'bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border-slate-700/50 opacity-80'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/25">
                  <ShieldCheck size={18} />
                </div>
                <span className="text-[10px] font-black text-purple-200">
                  {hasRepProgram ? 'نماینده' : 'غیرفعال'}
                </span>
              </div>
              <div className="pt-2 space-y-0.5">
                <h3 className="text-xs font-black text-white truncate">ثبت حضور نماینده</h3>
                <p className="text-[10px] text-purple-200/85 font-medium truncate">
                  {hasRepProgram ? myRepProgramTitle : 'مخصوص نماینده منتخب'}
                </p>
              </div>
            </motion.button>
          )}
        </div>
      </section>

      {/* 3. Today's Classes Live Timeline */}
      <section className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Clock size={16} />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900">کلاس‌های امروز ({todayDayName})</h3>
              <p className="text-[10px] text-slate-400 font-medium tabular-nums">
                {todayPrograms.length} کلاس فعال در برنامه شما
              </p>
            </div>
          </div>

          {isTabAllowed('student-schedule') && (
            <button
              type="button"
              onClick={() => onNavigateTab('student-schedule')}
              className="min-h-[36px] px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-black flex items-center gap-1 cursor-pointer"
            >
              <span>جدول هفتگی</span>
              <ChevronLeft size={13} />
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="py-5 text-center text-xs text-slate-400 font-bold">در حال بارگذاری کلاس‌ها...</div>
        ) : todayPrograms.length === 0 ? (
          <div className="py-5 text-center text-xs text-slate-400 font-medium bg-slate-50 rounded-2xl border border-slate-100">
            امروز کلاسی در برنامه فعال شما ثبت نشده است.
          </div>
        ) : (
          <div className="space-y-2">
            {todayPrograms.map((p) => {
              const range = parseProgramTimeRangeMinutes(p.time);
              const isLive = range ? nowMinutes >= range.start && nowMinutes <= range.end : false;
              const isUpcoming = range ? nowMinutes < range.start : false;
              return (
                <div
                  key={p.id}
                  onClick={() => isTabAllowed('student-schedule') && onNavigateTab('student-schedule')}
                  className={cn(
                    'p-3 rounded-2xl border transition-all flex items-center justify-between gap-2.5 cursor-pointer',
                    isLive
                      ? 'bg-indigo-50/70 border-indigo-300 shadow-2xs'
                      : 'bg-slate-50/70 border-slate-200/80 hover:border-indigo-200'
                  )}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-slate-900 truncate">{p.title}</span>
                      {isLive && (
                        <span className="text-[9.5px] font-black text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-md shrink-0">
                          در حال برگزاری
                        </span>
                      )}
                      {!isLive && isUpcoming && (
                        <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md shrink-0">
                          در پیش
                        </span>
                      )}
                    </div>
                    <div className="text-[10.5px] text-slate-500 font-medium truncate">
                      <span>استاد: {p.teacher || 'تعیین‌نشده'}</span>
                      {p.madrasRoom && (
                        <>
                          <span className="mx-1.5 text-slate-300">·</span>
                          <span className="text-indigo-700 font-bold">مَدرَس {p.madrasRoom}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <span className="text-[11px] font-mono font-black text-indigo-700 bg-white px-2.5 py-1 rounded-xl border border-indigo-200/90 tabular-nums shrink-0">
                    {p.time || 'نامشخص'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. All Enabled Student Services Grid */}
      {secondaryServices.length > 0 && (
        <section className="space-y-2 pb-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-black text-slate-900">امور آموزشی، کارنامه و رفاهی</h2>
            <span className="text-[10px] text-slate-400 font-bold tabular-nums">{secondaryServices.length} بخش فعال</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {secondaryServices.map((srv, idx) => {
              const Icon = srv.icon;
              return (
                <motion.button
                  key={srv.tab}
                  type="button"
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.2, delay: prefersReducedMotion ? 0 : idx * 0.025 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
                  onClick={() => onNavigateTab(srv.tab)}
                  className="min-h-[68px] p-3 bg-white hover:bg-slate-50/90 rounded-2xl border border-slate-200/90 shadow-2xs text-right flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <div className={cn('w-9 h-9 rounded-xl border flex items-center justify-center shrink-0', srv.iconBg)}>
                    <Icon size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black text-slate-900 truncate">{srv.title}</div>
                    <div className="text-[9.5px] text-slate-500 font-medium truncate mt-0.5">{srv.subtitle}</div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>
      )}

      {/* Fallback Bottom Nav ONLY if standalone outside StudentMobileShell */}
      {!isInsideShell && (
        <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-2 px-3 z-40 flex items-center justify-around">
          <button
            type="button"
            onClick={() => onNavigateTab('dashboard')}
            className="min-h-[44px] flex flex-col items-center justify-center text-indigo-600 text-[10px] font-black cursor-pointer"
          >
            <LayoutDashboard size={17} />
            <span>پیشخوان</span>
          </button>
          {isTabAllowed('stats') && (
            <button
              type="button"
              onClick={() => onNavigateTab('stats')}
              className="min-h-[44px] flex flex-col items-center justify-center text-slate-600 text-[10px] font-bold cursor-pointer"
            >
              <BookOpen size={17} />
              <span>مطالعه</span>
            </button>
          )}
          {isTabAllowed('attendance') && (
            <button
              type="button"
              onClick={() => onNavigateTab('attendance')}
              className="min-h-[44px] flex flex-col items-center justify-center text-slate-600 text-[10px] font-bold cursor-pointer"
            >
              <CheckSquare size={17} />
              <span>حضور</span>
            </button>
          )}
          {isTabAllowed('student-schedule') && (
            <button
              type="button"
              onClick={() => onNavigateTab('student-schedule')}
              className="min-h-[44px] flex flex-col items-center justify-center text-slate-600 text-[10px] font-bold cursor-pointer"
            >
              <Calendar size={17} />
              <span>کلاس‌ها</span>
            </button>
          )}
        </div>
      )}

      {/* Animated In-App Notice Modal (Replaces window.alert) */}
      <AnimatePresence>
        {noticeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNoticeModal(null)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            />
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 10 }}
              transition={{ duration: 0.18 }}
              className="relative z-10 bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-center space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                <Info size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-black text-slate-900">{noticeModal.title}</h3>
                <p className="text-xs font-bold text-slate-800 leading-relaxed bg-amber-50/80 p-3 rounded-2xl border border-amber-200/80">
                  {noticeModal.message}
                </p>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{noticeModal.subtext}</p>
              </div>
              <button
                type="button"
                onClick={() => setNoticeModal(null)}
                className="w-full min-h-[44px] py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black cursor-pointer active:scale-95 transition-all"
              >
                متوجه شدم
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Student Self-Reporting Modal */}
      <StudentSelfReportingModal
        isOpen={isSelfReportingModalOpen}
        onClose={() => setIsSelfReportingModalOpen(false)}
        currentUser={currentUser}
        studentObj={matchedStudent}
        programs={allProgramsList}
        enrollments={enrollmentsList}
        onAttendanceSaved={() => loadStudentData(false)}
      />
    </div>
  );
};
