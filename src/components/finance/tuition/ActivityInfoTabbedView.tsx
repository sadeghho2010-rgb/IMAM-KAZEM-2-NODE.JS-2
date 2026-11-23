import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  CalendarCheck, 
  Utensils, 
  Award, 
  CreditCard, 
  PiggyBank, 
  Receipt, 
  Sliders, 
  Search, 
  Filter, 
  ArrowLeft, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Info,
  User,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Calendar,
  MessageSquare
} from 'lucide-react';
import {
  Student,
  TuitionCalculationSettings,
  StudentFinancialProfile,
  TuitionCalculationBreakdown,
  StudyPeriod,
  PeriodicStudyLog,
  AttendanceSessionLog,
  AttendanceSettings,
  AcademicHolidayItem,
  CounselingSessionGrade,
  StudentClaimRecord,
  FinanceClaimCategory,
  FinanceDestinationAccount,
  StudentMealReservation,
  MealReservationPeriod,
  StudyDailyEntry
} from '../../../types';
import { normalizeShamsiDateStr, dateToShamsi, toPersianDigits } from '../../../lib/jalali';
import {
  resolveAttendanceRules,
  classifyAttendanceRecord,
  computeLateConvertedAbsences,
  consolidateAttendanceLogs,
  isDateOfficialHoliday,
  buildStudentCanonicalMatcher
} from '../../../lib/attendanceRules';
import { cn } from '../../../lib/utils';
import { useIsAdminMobile } from '../../admin/mobile/AdminMobileContext';
import { MobileHorizontalTabs, MobileSearchFilterBar } from '../../admin/mobile/MobileModulePrimitives';

interface StudentLunchItem {
  id: string;
  studentId: string;
  studentName: string;
  nationalId: string;
  grade: string;
  monthlyMealsCount: number;
  mealPrice: number;
  subsidyDiscount?: number;
}

interface ActivityInfoTabbedViewProps {
  students: Student[];
  profiles: StudentFinancialProfile[];
  calculatedTuitions: TuitionCalculationBreakdown[];
  studyPeriods: StudyPeriod[];
  studyLogs: PeriodicStudyLog[];
  studyDailyEntries?: StudyDailyEntry[];
  attendanceLogs: AttendanceSessionLog[];
  attendanceSettings?: AttendanceSettings | null;
  academicHolidays?: AcademicHolidayItem[];
  counselingGrades: CounselingSessionGrade[];
  mealReservations: StudentMealReservation[];
  mealPeriods?: MealReservationPeriod[];
  lunchItems: StudentLunchItem[];
  claimsList: StudentClaimRecord[];
  claimCategories: FinanceClaimCategory[];
  destinationAccounts: FinanceDestinationAccount[];
  loans: any[];
  settings: TuitionCalculationSettings;
  startDate: string;
  endDate: string;
  gradeFilter: string;
  setGradeFilter: (val: string) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  studentOverrides: Record<string, {
    manualAdjustmentAmount?: number;
    manualAdjustmentReason?: string;
    overrideStudyBonus?: number;
    ignoreAbsencePenalty?: boolean;
    overrideBaseTuition?: number;
  }>;
  setStudentOverrides: React.Dispatch<React.SetStateAction<Record<string, {
    manualAdjustmentAmount?: number;
    manualAdjustmentReason?: string;
    overrideStudyBonus?: number;
    ignoreAbsencePenalty?: boolean;
    overrideBaseTuition?: number;
  }>>>;
  onOpenSlipDetail: (item: TuitionCalculationBreakdown) => void;
  onOpenEditProfile: (student: Student) => void;
  onNavigateToMechanized: () => void;
  onOpenDebtModal: (student: Student) => void;
  onRefreshCounselingGrades?: () => void;
  isRefreshingCounseling?: boolean;
  onRefreshAttendance?: () => void;
  isRefreshingAttendance?: boolean;
}

type TabType = 
  | 'summary'
  | 'study_hours'
  | 'attendance'
  | 'meals'
  | 'counseling'
  | 'debts'
  | 'fund_contribution'
  | 'loans'
  | 'manual_adjustments';

export const ActivityInfoTabbedView: React.FC<ActivityInfoTabbedViewProps> = ({
  students,
  profiles,
  calculatedTuitions,
  studyPeriods,
  studyLogs,
  studyDailyEntries = [],
  attendanceLogs,
  attendanceSettings = null,
  academicHolidays = [],
  counselingGrades,
  mealReservations = [],
  mealPeriods = [],
  lunchItems,
  claimsList,
  destinationAccounts,
  loans,
  settings,
  startDate,
  endDate,
  gradeFilter,
  setGradeFilter,
  searchQuery,
  setSearchQuery,
  studentOverrides,
  setStudentOverrides,
  onOpenSlipDetail,
  onOpenEditProfile,
  onNavigateToMechanized,
  onOpenDebtModal,
  onRefreshCounselingGrades,
  isRefreshingCounseling = false,
  onRefreshAttendance,
  isRefreshingAttendance = false
}) => {
  const isAdminMobile = useIsAdminMobile();
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  
  // Study Tab Specific Filters
  const [selectedStudyPeriodId, setSelectedStudyPeriodId] = useState<string>('all');
  const [studyFilterBelowAvgAndReq, setStudyFilterBelowAvgAndReq] = useState<boolean>(false);

  // Counseling & Attendance Tab Specific UI State
  const [counselingOnlyEvaluated, setCounselingOnlyEvaluated] = useState<boolean>(false);
  const [expandedCounselingStudentId, setExpandedCounselingStudentId] = useState<string | null>(null);
  const [expandedAttendanceStudentId, setExpandedAttendanceStudentId] = useState<string | null>(null);

  const normStart = useMemo(() => normalizeShamsiDateStr(startDate), [startDate]);
  const normEnd = useMemo(() => normalizeShamsiDateStr(endDate), [endDate]);

  // Study periods in the selected date range
  const relevantStudyPeriods = useMemo(() => {
    return studyPeriods.filter(p => {
      const pStart = normalizeShamsiDateStr(p.startDate);
      const pEnd = normalizeShamsiDateStr(p.endDate);
      return (!normEnd || pStart <= normEnd) && (!normStart || pEnd >= normStart);
    });
  }, [studyPeriods, normStart, normEnd]);

  // Active attendance rules (configured by Education Officer)
  const attendanceRules = useMemo(() => resolveAttendanceRules(attendanceSettings), [attendanceSettings]);

  // Consolidated, non-cancelled, non-holiday attendance sessions in the selected date range
  const attendanceLogsInRange = useMemo(() => {
    const consolidated = consolidateAttendanceLogs(attendanceLogs);
    return consolidated.filter(session => {
      if (session.isCancelled) return false;
      const sDate = normalizeShamsiDateStr(session.date);
      if (!sDate) return false;
      const inRange = (!normStart || sDate >= normStart) && (!normEnd || sDate <= normEnd);
      if (!inRange) return false;
      if (isDateOfficialHoliday(sDate, session.grade, academicHolidays)) return false;
      return true;
    });
  }, [attendanceLogs, normStart, normEnd, academicHolidays]);

  // Complete, rule-aware Attendance Report per Student in Selected Date Range [normStart, normEnd]
  const attendanceRangeReport = useMemo(() => {
    const matchStudentId = buildStudentCanonicalMatcher(students);

    type StudentAttendanceRow = {
      presentCount: number;
      directUnexcusedCount: number;
      lateConvertedAbsences: number;
      unexcusedCount: number;
      excusedCount: number;
      lateCount: number;
      lateMinutesTotal: number;
      unspecifiedCount: number;
      totalSessions: number;
      sessions: Array<{
        date: string;
        programTitle: string;
        rawStatus: string;
        effectiveStatus: string;
        lateMinutes?: number;
        ignoredLate?: boolean;
        lateConvertedToAbsence?: boolean;
        excuseReason?: string;
      }>;
    };

    const byStudent: Record<string, StudentAttendanceRow> = {};
    const ensureRow = (sid: string): StudentAttendanceRow => {
      if (!byStudent[sid]) {
        byStudent[sid] = {
          presentCount: 0,
          directUnexcusedCount: 0,
          lateConvertedAbsences: 0,
          unexcusedCount: 0,
          excusedCount: 0,
          lateCount: 0,
          lateMinutesTotal: 0,
          unspecifiedCount: 0,
          totalSessions: 0,
          sessions: []
        };
      }
      return byStudent[sid];
    };

    attendanceLogsInRange.forEach(session => {
      if (!Array.isArray(session.students)) return;
      const normDate = normalizeShamsiDateStr(session.date);
      session.students.forEach(rec => {
        const canonicalId = matchStudentId(rec) || String(rec.studentId || '').trim();
        if (!canonicalId) return;
        const row = ensureRow(canonicalId);
        const classified = classifyAttendanceRecord(rec, attendanceRules);

        row.totalSessions++;
        if (classified.effectiveStatus === 'present') row.presentCount++;
        else if (classified.effectiveStatus === 'absent') row.directUnexcusedCount++;
        else if (classified.effectiveStatus === 'excused') row.excusedCount++;
        else if (classified.effectiveStatus === 'late') {
          row.lateCount++;
          row.lateMinutesTotal += classified.countedLateMinutes;
        } else {
          row.unspecifiedCount++;
        }

        row.sessions.push({
          date: normDate || session.date,
          programTitle: session.programTitle || 'کلاس درسی',
          rawStatus: rec.status || 'unspecified',
          effectiveStatus: classified.effectiveStatus,
          lateMinutes: rec.lateMinutes,
          ignoredLate: classified.ignoredLate,
          lateConvertedToAbsence: classified.lateConvertedToAbsence,
          excuseReason: rec.excuseReason
        });
      });
    });

    Object.values(byStudent).forEach(row => {
      row.lateConvertedAbsences = computeLateConvertedAbsences(row.lateCount, attendanceRules);
      row.unexcusedCount = row.directUnexcusedCount + row.lateConvertedAbsences;
      row.sessions.sort((a, b) => b.date.localeCompare(a.date));
    });

    return byStudent;
  }, [students, attendanceLogsInRange, attendanceRules]);

  // Overlapping meal periods in the selected date range
  const relevantMealPeriodIds = useMemo(() => {
    return new Set(
      mealPeriods.filter(mp => {
        const mpStart = normalizeShamsiDateStr(mp.startDate);
        const mpEnd = normalizeShamsiDateStr(mp.endDate);
        return (!normEnd || mpStart <= normEnd) && (!normStart || mpEnd >= normStart);
      }).map(mp => mp.id)
    );
  }, [mealPeriods, normStart, normEnd]);

  // Filtered Students (supports Persian/English grade digits seamlessly)
  const filteredStudents = useMemo(() => {
    const normalizeGradeVal = (val?: string) =>
      toPersianDigits(String(val || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim());
    const targetGradeNorm = normalizeGradeVal(gradeFilter);

    return students.filter(st => {
      if (gradeFilter !== 'all') {
        const stGradeNorm = normalizeGradeVal(st.grade);
        if (stGradeNorm !== targetGradeNorm) {
          const digits = ['۱۰', '۷', '۸', '۹', '۱', '۲', '۳', '۴', '۵', '۶'];
          const matchedDigit = digits.some(d => targetGradeNorm.includes(d) && stGradeNorm.includes(d));
          if (!matchedDigit) return false;
        }
      }
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchName = (st.name || '').toLowerCase().includes(query);
        const matchCode =
          (st.nationalId || '').includes(query) ||
          (st.managementCenterCode || '').includes(query) ||
          (st.studentCode || '').toLowerCase().includes(query);
        if (!matchName && !matchCode) return false;
      }
      return true;
    });
  }, [students, gradeFilter, searchQuery]);

  // Complete Counseling Evaluations Map & Summary in Selected Date Range [normStart, normEnd]
  const counselingRangeReport = useMemo(() => {
    const normalizePersian = (val?: string) =>
      String(val || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ').trim();

    const extractNormDate = (g: CounselingSessionGrade): string => {
      const raw = g.sessionDate || (g as any).date || (g as any).session_date || '';
      const trimmed = String(raw).trim();
      if (!trimmed) return '';
      if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
          return normalizeShamsiDateStr(dateToShamsi(parsed));
        }
      }
      return normalizeShamsiDateStr(trimmed);
    };

    const byId = new Map<string, Student>();
    const byCode = new Map<string, Student>();
    const byNational = new Map<string, Student>();
    const byName = new Map<string, Student>();

    students.forEach(s => {
      byId.set(String(s.id).trim(), s);
      if (s.studentCode) byCode.set(String(s.studentCode).trim().toLowerCase(), s);
      if (s.nationalId) byNational.set(String(s.nationalId).trim(), s);
      if (s.name) byName.set(normalizePersian(s.name), s);
    });

    const resolveStudent = (g: CounselingSessionGrade): Student | null => {
      const rawId = String(g.studentId || (g as any).student_id || '').trim();
      if (rawId && byId.has(rawId)) return byId.get(rawId)!;
      if (rawId && byCode.has(rawId.toLowerCase())) return byCode.get(rawId.toLowerCase())!;
      if (rawId && byNational.has(rawId)) return byNational.get(rawId)!;
      const rawCode = String((g as any).studentCode || '').trim().toLowerCase();
      if (rawCode && byCode.has(rawCode)) return byCode.get(rawCode)!;
      const rawNat = String((g as any).nationalId || '').trim();
      if (rawNat && byNational.has(rawNat)) return byNational.get(rawNat)!;
      const normName = normalizePersian(g.studentName);
      if (normName && byName.has(normName)) return byName.get(normName)!;
      return null;
    };

    // 1. Deduplicate all counseling grades within [normStart, normEnd]
    const dedupMap = new Map<string, { studentKey: string; matchedStudent: Student | null; grade: CounselingSessionGrade; normDate: string }>();
    (counselingGrades || []).forEach(g => {
      const normDate = extractNormDate(g);
      if (!normDate) return;
      if (normStart && normDate < normStart) return;
      if (normEnd && normDate > normEnd) return;

      const matched = resolveStudent(g);
      const studentKey = matched
        ? matched.id
        : String(g.studentId || (g as any).student_id || normalizePersian(g.studentName) || g.id).trim();
      if (!studentKey) return;

      const dedupKey = `${studentKey}::${normalizePersian(g.courseTitle || '')}::${normDate}`;
      const existing = dedupMap.get(dedupKey);
      if (!existing) {
        dedupMap.set(dedupKey, { studentKey, matchedStudent: matched, grade: { ...g, sessionDate: normDate }, normDate });
      } else {
        const curVer = Number((g as any).version || 0);
        const oldVer = Number((existing.grade as any).version || 0);
        const curTime = new Date(g.updatedAt || g.createdAt || 0).getTime();
        const oldTime = new Date(existing.grade.updatedAt || existing.grade.createdAt || 0).getTime();
        if (curVer > oldVer || (curVer === oldVer && curTime >= oldTime)) {
          dedupMap.set(dedupKey, { studentKey, matchedStudent: matched, grade: { ...g, sessionDate: normDate }, normDate });
        }
      }
    });

    interface StudentCounselingSummary {
      studentId: string;
      studentName: string;
      grade: string;
      nationalId?: string;
      sessions: CounselingSessionGrade[];
      sessionsCount: number;
      countA: number;
      countB: number;
      countC: number;
      countD: number;
      countAbsence: number;
      countNoHomework: number;
      bonusAmount: number;
    }

    const byStudentKey = new Map<string, StudentCounselingSummary>();

    const ensureEntry = (studentId: string, studentName: string, grade: string, nationalId?: string) => {
      let entry = byStudentKey.get(studentId);
      if (!entry) {
        entry = {
          studentId,
          studentName,
          grade,
          nationalId,
          sessions: [],
          sessionsCount: 0,
          countA: 0,
          countB: 0,
          countC: 0,
          countD: 0,
          countAbsence: 0,
          countNoHomework: 0,
          bonusAmount: 0
        };
        byStudentKey.set(studentId, entry);
      }
      return entry;
    };

    const bonusA = settings?.counselingGradeABonus ?? 30000;
    const bonusB = settings?.counselingGradeBBonus ?? 15000;
    const bonusC = settings?.counselingGradeCBonus ?? 0;

    dedupMap.forEach(({ studentKey, matchedStudent, grade: g }) => {
      const entry = ensureEntry(
        studentKey,
        matchedStudent?.name || g.studentName || 'طلبه ناشناس',
        matchedStudent?.grade || g.grade || '-',
        matchedStudent?.nationalId
      );

      entry.sessions.push(g);
      entry.sessionsCount += 1;

      const pScore = normalizePersian(String(g.participationScore || (g as any).score || ''));
      if (pScore === 'الف') entry.countA += 1;
      else if (pScore === 'ب') entry.countB += 1;
      else if (pScore === 'ج') entry.countC += 1;
      else if (pScore === 'د') entry.countD += 1;
      else if (pScore === 'غیبت') entry.countAbsence += 1;

      const rScore = normalizePersian(String(g.researchScore || ''));
      if (rScore === 'الف') entry.countA += 1;
      else if (rScore === 'ب') entry.countB += 1;
      else if (rScore === 'ج') entry.countC += 1;
      else if (rScore === 'د') entry.countD += 1;
      else if (rScore === 'عدم انجام تکلیف' || rScore === 'غیبت') entry.countNoHomework += 1;
    });

    byStudentKey.forEach(entry => {
      entry.sessions.sort((a, b) => (b.sessionDate || '').localeCompare(a.sessionDate || ''));
      entry.bonusAmount = entry.countA * bonusA + entry.countB * bonusB + entry.countC * bonusC;
    });

    // Build displayed rows based on filteredStudents (+ any unmatched students who actually have grades in range & match filters)
    const rows: StudentCounselingSummary[] = [];
    const includedIds = new Set<string>();

    filteredStudents.forEach(st => {
      includedIds.add(st.id);
      const found = byStudentKey.get(st.id);
      if (found) {
        rows.push(found);
      } else {
        rows.push({
          studentId: st.id,
          studentName: st.name,
          grade: st.grade || '-',
          nationalId: st.nationalId,
          sessions: [],
          sessionsCount: 0,
          countA: 0,
          countB: 0,
          countC: 0,
          countD: 0,
          countAbsence: 0,
          countNoHomework: 0,
          bonusAmount: 0
        });
      }
    });

    // Include any extra students from counseling_session_grades in range who weren't in filteredStudents (e.g., archived/legacy ID)
    const normalizeGradeVal = (val?: string) =>
      toPersianDigits(String(val || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim());
    const targetGradeNorm = normalizeGradeVal(gradeFilter);
    const q = searchQuery.trim().toLowerCase();

    byStudentKey.forEach((entry, key) => {
      if (includedIds.has(key)) return;
      if (gradeFilter !== 'all') {
        const entryGradeNorm = normalizeGradeVal(entry.grade);
        const digits = ['۱۰', '۷', '۸', '۹', '۱', '۲', '۳', '۴', '۵', '۶'];
        const matchedDigit = entryGradeNorm === targetGradeNorm || digits.some(d => targetGradeNorm.includes(d) && entryGradeNorm.includes(d));
        if (!matchedDigit) return;
      }
      if (q && !(entry.studentName || '').toLowerCase().includes(q)) return;
      rows.push(entry);
    });

    const visibleRows = counselingOnlyEvaluated ? rows.filter(r => r.sessionsCount > 0) : rows;

    const totals = rows.reduce(
      (acc, r) => ({
        totalSessions: acc.totalSessions + r.sessionsCount,
        evaluatedStudentsCount: acc.evaluatedStudentsCount + (r.sessionsCount > 0 ? 1 : 0),
        totalA: acc.totalA + r.countA,
        totalB: acc.totalB + r.countB,
        totalC: acc.totalC + r.countC,
        totalD: acc.totalD + r.countD,
        totalAbsence: acc.totalAbsence + r.countAbsence,
        totalNoHomework: acc.totalNoHomework + r.countNoHomework,
        totalBonus: acc.totalBonus + r.bonusAmount
      }),
      {
        totalSessions: 0,
        evaluatedStudentsCount: 0,
        totalA: 0,
        totalB: 0,
        totalC: 0,
        totalD: 0,
        totalAbsence: 0,
        totalNoHomework: 0,
        totalBonus: 0
      }
    );

    return {
      rows: visibleRows,
      allRowsCount: rows.length,
      totals
    };
  }, [counselingGrades, students, filteredStudents, normStart, normEnd, settings, counselingOnlyEvaluated, gradeFilter, searchQuery]);

  // Unique Grades for dropdown
  const uniqueGrades = useMemo(() => {
    const grades = new Set<string>();
    students.forEach(s => {
      if (s.grade) grades.add(s.grade);
    });
    return Array.from(grades).sort();
  }, [students]);

  // Calculations map for fast access
  const calcMap = useMemo(() => {
    const map = new Map<string, TuitionCalculationBreakdown>();
    calculatedTuitions.forEach(c => map.set(c.studentId, c));
    return map;
  }, [calculatedTuitions]);

  // Profiles map
  const profileMap = useMemo(() => {
    const map = new Map<string, StudentFinancialProfile>();
    profiles.forEach(p => map.set(p.studentId, p));
    return map;
  }, [profiles]);

  return (
    <div className={cn("space-y-6", isAdminMobile && "space-y-4")}>
      {/* Top Banner Notice & Jump Button */}
      {isAdminMobile ? (
        <div className="bg-white rounded-[22px] border border-indigo-200/80 p-3.5 shadow-xs space-y-3">
          <div className="flex items-start gap-2.5">
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shrink-0">
              <Info size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-black text-slate-900">اطلاعات و فعالیت‌های طلاب</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                اصلاحات این بخش صرفاً جهت پیش‌نمایش و محاسبه مکانیزه شهریه اعمال می‌شود.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateToMechanized}
            className="w-full min-h-[44px] px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>ورود به مرحله محاسبه مکانیزه</span>
            <ArrowLeft size={16} />
          </button>
        </div>
      ) : (
        <div className="bg-linear-to-r from-indigo-50 via-slate-50 to-emerald-50 p-4 sm:p-5 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
              <Info size={20} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">سربرگ‌های تفکیک شده اطلاعات و فعالیت‌های طلاب</h4>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                تغییرات و تنظیمات انجام شده در این بخش صرفاً برای پیش‌نمایش و محاسبه مکانیزه اعمال می‌شوند و اطلاعات اصلی را مخدوش نمی‌کنند.
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateToMechanized}
            className="shrink-0 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>ورود به مرحله محاسبه مکانیزه</span>
            <ArrowLeft size={16} />
          </button>
        </div>
      )}

      {/* Global Filter Bar (Grade & Search) */}
      {isAdminMobile ? (
        <div className="bg-white p-3 rounded-[20px] border border-slate-200 shadow-2xs space-y-2.5">
          <MobileSearchFilterBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="جستجوی نام، کدملی یا کد طلبه..."
            onToggleFilters={() => setMobileFiltersOpen(prev => !prev)}
            filtersOpen={mobileFiltersOpen}
            activeFilterCount={gradeFilter !== 'all' ? 1 : 0}
          />
          {mobileFiltersOpen && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="flex-1 min-h-[42px] text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-bold text-slate-700"
              >
                <option value="all">همه پایه‌های تحصیلی</option>
                {uniqueGrades.map(g => (
                  <option key={g} value={g}>پایه {g}</option>
                ))}
              </select>
              <span className="text-[11px] font-bold text-indigo-700 font-mono tabular-nums px-2 shrink-0">
                {filteredStudents.length} نفر
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-64">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="جستجوی نام، کد ملی یا کد طلبه..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </div>

            {/* Grade Selector */}
            <div className="flex items-center gap-2">
              <Filter size={15} className="text-slate-400" />
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
              >
                <option value="all">همه پایه‌ها</option>
                {uniqueGrades.map(g => (
                  <option key={g} value={g}>پایه {g}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            تعداد طلاب مطابق فیلتر: <span className="font-bold text-indigo-700 font-mono">{filteredStudents.length}</span> نفر
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs (9 Categories) */}
      {isAdminMobile ? (
        <MobileHorizontalTabs
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as TabType)}
          tabs={[
            { id: 'summary', label: 'خلاصه کلی', icon: <Sliders size={14} />, tone: 'indigo' },
            { id: 'study_hours', label: 'ساعت مطالعه', icon: <BookOpen size={14} />, tone: 'indigo' },
            { id: 'attendance', label: 'حضور و غیاب', icon: <CalendarCheck size={14} />, tone: 'emerald' },
            { id: 'meals', label: 'نهار و شام', icon: <Utensils size={14} />, tone: 'amber' },
            { id: 'counseling', label: 'مشاوره', icon: <Award size={14} />, tone: 'emerald' },
            { id: 'debts', label: 'بدهی‌ها', icon: <Receipt size={14} />, tone: 'rose' },
            { id: 'fund_contribution', label: 'حق عضویت صندوق', icon: <PiggyBank size={14} />, tone: 'indigo' },
            { id: 'loans', label: 'اقساط وام‌ها', icon: <CreditCard size={14} />, tone: 'amber' },
            { id: 'manual_adjustments', label: 'اصلاحات دستی', icon: <Sparkles size={14} />, tone: 'slate' },
          ]}
        />
      ) : (
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1 min-w-max">
            {[
              { id: 'summary', label: 'خلاصه کلی', icon: Sliders },
              { id: 'study_hours', label: 'ساعت مطالعه و مباحثه', icon: BookOpen },
              { id: 'attendance', label: 'حضور و غیاب', icon: CalendarCheck },
              { id: 'meals', label: 'آمار نهار و شام', icon: Utensils },
              { id: 'counseling', label: 'ارزیابی کلاس مشاوره', icon: Award },
              { id: 'debts', label: 'بدهی‌ها و مطالبات', icon: Receipt },
              { id: 'fund_contribution', label: 'حق عضویت صندوق', icon: PiggyBank },
              { id: 'loans', label: 'اقساط وام‌ها', icon: CreditCard },
              { id: 'manual_adjustments', label: 'پاداش و جرایم دستی', icon: Sparkles },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-indigo-600 text-white shadow-xs' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon size={15} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 1: خلاصه کلی */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          <div className={cn("grid gap-3", isAdminMobile ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4")}>
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] sm:text-xs text-slate-500 font-medium">کل طلاب واجد شرایط</span>
              <div className="text-lg sm:text-xl font-black text-slate-800 mt-1 font-mono tabular-nums">{filteredStudents.length} نفر</div>
            </div>
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] sm:text-xs text-slate-500 font-medium">دوره‌های مطالعه بازه</span>
              <div className="text-lg sm:text-xl font-black text-indigo-600 mt-1 font-mono tabular-nums">{relevantStudyPeriods.length} دوره</div>
            </div>
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] sm:text-xs text-slate-500 font-medium">جلسات حضور بازه</span>
              <div className="text-lg sm:text-xl font-black text-emerald-600 mt-1 font-mono tabular-nums">{attendanceLogsInRange.length} جلسه</div>
            </div>
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] sm:text-xs text-slate-500 font-medium">کل رکورد‌های بدهی</span>
              <div className="text-lg sm:text-xl font-black text-rose-600 mt-1 font-mono tabular-nums">{claimsList.length} رکورد</div>
            </div>
          </div>

          {isAdminMobile ? (
            <div className="space-y-2.5">
              {filteredStudents.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-400 font-bold">
                  طلبه‌ای یافت نشد.
                </div>
              ) : (
                filteredStudents.map((st, idx) => {
                  const calc = calcMap.get(st.id);
                  const prof = profileMap.get(st.id);
                  const isMarried = prof?.isMarried || prof?.maritalStatus === 'متاهل' || st.maritalStatus === 'متاهل';

                  return (
                    <div key={st.id} className="bg-white rounded-[20px] border border-slate-200 p-3.5 shadow-2xs space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h5 className="text-xs font-black text-slate-900 truncate">{idx + 1}. {st.name}</h5>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                            <span>{st.grade || 'نامشخص'}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">{st.nationalId || '-'}</span>
                            <span aria-hidden="true">·</span>
                            <span className={isMarried ? 'text-amber-700 font-bold' : 'text-slate-600 font-bold'}>
                              {isMarried ? 'متاهل' : 'مجرد'}
                            </span>
                          </div>
                        </div>
                        <div className="text-left shrink-0">
                          <span className="text-[10px] text-slate-400 block">خالص فعلی</span>
                          <span className="text-xs font-black font-mono tabular-nums text-emerald-700">
                            {calc ? `${calc.netPayableTuition.toLocaleString('fa-IR')} ت` : 'در انتظار'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        {calc && (
                          <button
                            type="button"
                            onClick={() => onOpenSlipDetail(calc)}
                            className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Eye size={14} />
                            <span>مشاهده فیش</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenEditProfile(st)}
                          className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <User size={14} />
                          <span>پروفایل مالی</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800">پیش‌نمایش لیست طلاب و وضعیت آمادگی محاسبه</h4>
                <span className="text-[11px] text-slate-500">برای جزئیات هر بخش به سربرگ مربوطه مراجعه کنید</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                    <tr>
                      <th className="p-3">ردیف</th>
                      <th className="p-3">نام طلبه</th>
                      <th className="p-3">پایه</th>
                      <th className="p-3">کد ملی</th>
                      <th className="p-3">وضعیت تاهل</th>
                      <th className="p-3">مبلغ نهایی محاسبه‌شده</th>
                      <th className="p-3 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((st, idx) => {
                      const calc = calcMap.get(st.id);
                      const prof = profileMap.get(st.id);
                      const isMarried = prof?.isMarried || prof?.maritalStatus === 'متاهل' || st.maritalStatus === 'متاهل';

                      return (
                        <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="p-3 font-bold text-slate-900">{st.name}</td>
                          <td className="p-3 text-slate-600">{st.grade || 'نامشخص'}</td>
                          <td className="p-3 text-slate-500 font-mono">{st.nationalId || '-'}</td>
                          <td className="p-3 text-slate-600">
                            {isMarried ? (
                              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-bold text-[10px]">متاهل</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold text-[10px]">مجرد</span>
                            )}
                          </td>
                          <td className="p-3 font-black font-mono text-emerald-700">
                            {calc ? calc.netPayableTuition.toLocaleString('fa-IR') : 'در انتظار'} تومان
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {calc && (
                                <button
                                  onClick={() => onOpenSlipDetail(calc)}
                                  className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer"
                                  title="مشاهده فیش تفصیلی"
                                >
                                  <Eye size={15} />
                                </button>
                              )}
                              <button
                                onClick={() => onOpenEditProfile(st)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                                title="پروفایل مالی طلبه"
                              >
                                <User size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: ساعت مطالعه و مباحثه */}
      {activeTab === 'study_hours' && (
        <div className="space-y-4">
          <div className={cn("bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3", isAdminMobile ? "p-3" : "p-4")}>
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <span className="text-xs font-bold text-slate-700">دوره مطالعاتی بازه انتخابی:</span>
                <select
                  value={selectedStudyPeriodId}
                  onChange={(e) => setSelectedStudyPeriodId(e.target.value)}
                  className={cn(
                    "text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900",
                    isAdminMobile && "w-full min-h-[42px]"
                  )}
                >
                  <option value="all">همه دوره‌های بازه انتخابی ({relevantStudyPeriods.length} دوره)</option>
                  {relevantStudyPeriods.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.startDate} الی {p.endDate})
                    </option>
                  ))}
                </select>
              </div>

              {/* Special Filter: Below Average AND Below Mandatory */}
              <label className={cn(
                "flex items-center gap-2 cursor-pointer bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl text-rose-800 text-xs font-bold select-none hover:bg-rose-100 transition-colors",
                isAdminMobile && "min-h-[42px]"
              )}>
                <input
                  type="checkbox"
                  checked={studyFilterBelowAvgAndReq}
                  onChange={(e) => setStudyFilterBelowAvgAndReq(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                <span>فقط نمایش افراد «زیر میانگین و زیر موظفی»</span>
              </label>
            </div>
          </div>

          {/* Render Tables / Mobile Cards for Periods */}
          {(selectedStudyPeriodId === 'all' ? relevantStudyPeriods : relevantStudyPeriods.filter(p => p.id === selectedStudyPeriodId)).map(period => {
            const periodLogs = studyLogs.filter(l => l.periodId === period.id);
            const logsMap = new Map<string, PeriodicStudyLog>();
            periodLogs.forEach(l => logsMap.set(l.studentId, l));

            const totalHours = periodLogs.reduce((acc, curr) => acc + (curr.hours || ((curr.studyHours || 0) + (curr.discussionHours || 0))), 0);
            const avgHours = periodLogs.length > 0 ? (totalHours / periodLogs.length) : 0;
            const mandatoryHours = period.mandatoryHours || 0;

            const periodStudents = filteredStudents.filter(st => {
              const log = logsMap.get(st.id);
              const actual = log ? (log.hours || ((log.studyHours || 0) + (log.discussionHours || 0))) : 0;
              const isBelowAvg = actual < avgHours;
              const isBelowReq = actual < mandatoryHours;

              if (studyFilterBelowAvgAndReq) {
                return isBelowAvg && isBelowReq;
              }
              return true;
            });

            if (isAdminMobile) {
              return (
                <div key={period.id} className="space-y-2.5">
                  <div className="bg-slate-900 text-white rounded-[20px] p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-black truncate flex items-center gap-1.5">
                        <BookOpen size={15} className="text-indigo-300 shrink-0" />
                        <span className="truncate">{period.title}</span>
                      </h4>
                      <span className="text-[10px] font-mono text-slate-300 shrink-0">{period.startDate} تا {period.endDate}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-200 pt-1.5 border-t border-white/10">
                      <span>موظفی: <b>{mandatoryHours} ساعت</b></span>
                      <span>میانگین: <b className="text-emerald-300">{avgHours.toFixed(1)} ساعت</b></span>
                    </div>
                  </div>

                  {periodStudents.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-xs text-slate-400 font-bold">
                      هیچ رکوردی مطابق فیلترهای انتخابی یافت نشد.
                    </div>
                  ) : (
                    periodStudents.map((st, idx) => {
                      const log = logsMap.get(st.id);
                      const actual = log ? (log.hours || ((log.studyHours || 0) + (log.discussionHours || 0))) : 0;
                      const hasSubmitted = !!log;
                      const diffAvg = actual - avgHours;
                      const diffReq = actual - mandatoryHours;

                      return (
                        <div key={st.id} className="bg-white rounded-[20px] border border-slate-200 p-3.5 shadow-2xs space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h5 className="text-xs font-black text-slate-900 truncate">{idx + 1}. {st.name}</h5>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                                <span>{st.grade || '-'}</span>
                                <span aria-hidden="true">·</span>
                                <span className={hasSubmitted ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
                                  {hasSubmitted ? 'ثبت شده' : 'ثبت نشده'}
                                </span>
                              </div>
                            </div>
                            <span className="text-sm font-black font-mono tabular-nums text-slate-900 shrink-0">
                              {actual.toFixed(1)} ساعت
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px] font-bold">
                            <div className={cn("p-2 rounded-xl text-center font-mono tabular-nums", diffAvg >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
                              {diffAvg >= 0 ? `+${diffAvg.toFixed(1)}h بالای میانگین` : `${diffAvg.toFixed(1)}h زیر میانگین`}
                            </div>
                            <div className={cn("p-2 rounded-xl text-center font-mono tabular-nums", diffReq >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
                              {diffReq >= 0 ? `+${diffReq.toFixed(1)}h بالای موظفی` : `${diffReq.toFixed(1)}h زیر موظفی`}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            }

            return (
              <div key={period.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                      <BookOpen size={16} className="text-indigo-600" />
                      <span>{period.title}</span>
                      <span className="text-[11px] text-slate-500 font-normal">({period.startDate} تا {period.endDate})</span>
                    </h4>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="text-slate-600">موظفی دوره: <b className="text-slate-900">{mandatoryHours} ساعت</b></span>
                    <span className="text-slate-600">میانگین طلاب: <b className="text-indigo-700">{avgHours.toFixed(1)} ساعت</b></span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                      <tr>
                        <th className="p-3">ردیف</th>
                        <th className="p-3">نام و نام خانوادگی</th>
                        <th className="p-3">کد ملی</th>
                        <th className="p-3">پایه</th>
                        <th className="p-3">ثبت شده؟</th>
                        <th className="p-3">میزان مطالعه</th>
                        <th className="p-3">وضعیت نسبت به میانگین</th>
                        <th className="p-3">وضعیت نسبت به موظفی</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {periodStudents.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-slate-400">
                            هیچ رکوردی مطابق فیلترهای انتخابی یافت نشد.
                          </td>
                        </tr>
                      ) : (
                        periodStudents.map((st, idx) => {
                          const log = logsMap.get(st.id);
                          const actual = log ? (log.hours || ((log.studyHours || 0) + (log.discussionHours || 0))) : 0;
                          const hasSubmitted = !!log;
                          const diffAvg = actual - avgHours;
                          const diffReq = actual - mandatoryHours;

                          return (
                            <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                              <td className="p-3 font-bold text-slate-900">{st.name}</td>
                              <td className="p-3 text-slate-500 font-mono">{st.nationalId || '-'}</td>
                              <td className="p-3 text-slate-600">{st.grade || '-'}</td>
                              <td className="p-3">
                                {hasSubmitted ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                                    <CheckCircle size={14} /> بله
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-rose-500 font-bold text-[11px]">
                                    <XCircle size={14} /> خیر
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-mono font-bold text-slate-800">
                                {actual.toFixed(1)} ساعت
                              </td>
                              <td className="p-3">
                                {diffAvg >= 0 ? (
                                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                    +{diffAvg.toFixed(1)}h بالای میانگین
                                  </span>
                                ) : (
                                  <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                    {diffAvg.toFixed(1)}h زیر میانگین
                                  </span>
                                )}
                              </td>
                              <td className="p-3">
                                {diffReq >= 0 ? (
                                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                    +{diffReq.toFixed(1)}h بالای موظفی
                                  </span>
                                ) : (
                                  <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                    {diffReq.toFixed(1)}h زیر موظفی
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 3: حضور و غیاب */}
      {activeTab === 'attendance' && (() => {
        const totals = filteredStudents.reduce(
          (acc, st) => {
            const r = attendanceRangeReport[st.id];
            if (r) {
              acc.present += r.presentCount;
              acc.unexcused += r.unexcusedCount;
              acc.excused += r.excusedCount;
              acc.late += r.lateCount;
              acc.lateConverted += r.lateConvertedAbsences;
              acc.unspecified += r.unspecifiedCount;
            }
            return acc;
          },
          { present: 0, unexcused: 0, excused: 0, late: 0, lateConverted: 0, unspecified: 0 }
        );

        const formatStatusLabel = (status: string, lateMins?: number, ignoredLate?: boolean, converted?: boolean) => {
          if (status === 'present') return ignoredLate ? `حاضر (تاخیر ${lateMins || 0}د بی‌اثر)` : 'حاضر';
          if (status === 'absent') return converted ? `غیبت (تاخیر ${lateMins || 0}د بالای سقف)` : 'غیبت غیرموجه';
          if (status === 'excused') return 'غیبت موجه';
          if (status === 'late') return `تاخیر (${lateMins || 0} دقیقه)`;
          return 'نامشخص';
        };

        return isAdminMobile ? (
          <div className="space-y-2.5">
            <div className="bg-white rounded-[20px] border border-slate-200 p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-black text-slate-800 block">تفکیک حضور و غیاب بازه</span>
                  <span className="text-[10px] text-slate-500 font-mono">{startDate} تا {endDate}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono tabular-nums font-bold text-indigo-700">{attendanceLogsInRange.length} جلسه</span>
                  {onRefreshAttendance && (
                    <button
                      type="button"
                      onClick={onRefreshAttendance}
                      disabled={isRefreshingAttendance}
                      className="p-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 cursor-pointer disabled:opacity-50"
                      title="بروزرسانی آمار حضور و غیاب"
                    >
                      <RefreshCw size={13} className={isRefreshingAttendance ? 'animate-spin' : ''} />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] pt-2 border-t border-slate-100">
                <div className="bg-emerald-50 rounded-xl p-1.5">
                  <span className="text-slate-500 block">حاضر</span>
                  <span className="font-mono font-black text-emerald-700">{totals.present}</span>
                </div>
                <div className="bg-rose-50 rounded-xl p-1.5">
                  <span className="text-slate-500 block">غیرموجه</span>
                  <span className="font-mono font-black text-rose-700">{totals.unexcused}</span>
                </div>
                <div className="bg-indigo-50 rounded-xl p-1.5">
                  <span className="text-slate-500 block">موجه</span>
                  <span className="font-mono font-black text-indigo-700">{totals.excused}</span>
                </div>
                <div className="bg-amber-50 rounded-xl p-1.5">
                  <span className="text-slate-500 block">تاخیر</span>
                  <span className="font-mono font-black text-amber-700">{totals.late}</span>
                </div>
              </div>
            </div>

            {filteredStudents.map((st, idx) => {
              const row = attendanceRangeReport[st.id];
              const presentCount = row?.presentCount || 0;
              const unexcusedCount = row?.unexcusedCount || 0;
              const lateConverted = row?.lateConvertedAbsences || 0;
              const excusedCount = row?.excusedCount || 0;
              const lateCount = row?.lateCount || 0;
              const lateMinutesTotal = row?.lateMinutesTotal || 0;
              const unspecifiedCount = row?.unspecifiedCount || 0;
              const isExpanded = expandedAttendanceStudentId === st.id;

              return (
                <div key={st.id} className="bg-white rounded-[20px] border border-slate-200 p-3.5 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h5 className="text-xs font-black text-slate-900 truncate">{idx + 1}. {st.name}</h5>
                      <span className="text-[11px] text-slate-500">{st.grade || '-'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={cn(
                        "text-[11px] font-black",
                        unexcusedCount > 0 ? "text-rose-700" : "text-emerald-700"
                      )}>
                        {unexcusedCount > 0 ? `${unexcusedCount} جلسه کسر` : 'بدون جریمه'}
                      </span>
                      {(row?.sessions?.length || 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedAttendanceStudentId(isExpanded ? null : st.id)}
                          className="p-1 rounded-lg bg-slate-100 text-slate-600 cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-1 text-center text-[10.5px] pt-2 border-t border-slate-100">
                    <div className="bg-emerald-50 rounded-xl p-1.5">
                      <span className="text-slate-500 block text-[9.5px]">حاضر</span>
                      <span className="font-mono tabular-nums font-black text-emerald-700">{presentCount}</span>
                    </div>
                    <div className="bg-rose-50 rounded-xl p-1.5">
                      <span className="text-slate-500 block text-[9.5px]">غیرموجه</span>
                      <span className="font-mono tabular-nums font-black text-rose-700">{unexcusedCount}</span>
                      {lateConverted > 0 && (
                        <span className="block text-[8.5px] font-bold text-amber-700">+{lateConverted} تاخیر</span>
                      )}
                    </div>
                    <div className="bg-indigo-50 rounded-xl p-1.5">
                      <span className="text-slate-500 block text-[9.5px]">موجه</span>
                      <span className="font-mono tabular-nums font-black text-indigo-700">{excusedCount}</span>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-1.5">
                      <span className="text-slate-500 block text-[9.5px]">تاخیر</span>
                      <span className="font-mono tabular-nums font-black text-amber-700">{lateCount}</span>
                      {lateMinutesTotal > 0 && (
                        <span className="block text-[8.5px] text-amber-800 font-mono">{lateMinutesTotal}د</span>
                      )}
                    </div>
                    <div className="bg-slate-50 rounded-xl p-1.5">
                      <span className="text-slate-500 block text-[9.5px]">نامشخص</span>
                      <span className="font-mono tabular-nums font-black text-slate-600">{unspecifiedCount}</span>
                    </div>
                  </div>

                  {isExpanded && row && row.sessions.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-1">
                      {row.sessions.map((sess, sIdx) => (
                        <div key={sIdx} className="flex items-center justify-between text-[10.5px] bg-slate-50 rounded-lg px-2 py-1">
                          <span className="text-slate-700 font-bold truncate max-w-[55%]">{sess.programTitle} <span className="font-mono text-slate-400">({sess.date})</span></span>
                          <span className={cn(
                            "font-bold px-1.5 py-0.5 rounded",
                            sess.effectiveStatus === 'present' ? "bg-emerald-100 text-emerald-800" :
                            sess.effectiveStatus === 'absent' ? "bg-rose-100 text-rose-800" :
                            sess.effectiveStatus === 'excused' ? "bg-indigo-100 text-indigo-800" :
                            sess.effectiveStatus === 'late' ? "bg-amber-100 text-amber-800" :
                            "bg-slate-200 text-slate-700"
                          )}>
                            {formatStatusLabel(sess.effectiveStatus, sess.lateMinutes, sess.ignoredLate, sess.lateConvertedToAbsence)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs space-y-0">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-black text-slate-800">تفکیک حضور و غیاب طلاب در بازه زمانی انتخابی ({startDate} تا {endDate})</h4>
                <p className="text-[10.5px] text-slate-500 mt-0.5">
                  ضوابط فعال: تاخیر زیر {attendanceRules.minLateMinutes} دقیقه بی‌اثر
                  {attendanceRules.maxLateAsAbsenceMinutes > 0 ? ` • تاخیر بالای ${attendanceRules.maxLateAsAbsenceMinutes} دقیقه = غیبت` : ''}
                  {attendanceRules.latesPerAbsence > 0 ? ` • هر ${attendanceRules.latesPerAbsence} تاخیر = ۱ غیبت` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-[11px] text-slate-600 font-mono bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-bold">
                  جلسات معتبر بازه: {attendanceLogsInRange.length}
                </span>
                {onRefreshAttendance && (
                  <button
                    type="button"
                    onClick={onRefreshAttendance}
                    disabled={isRefreshingAttendance}
                    className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw size={13} className={isRefreshingAttendance ? 'animate-spin' : ''} />
                    <span>{isRefreshingAttendance ? 'در حال همگام‌سازی...' : 'بروزرسانی از سرور'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* KPI Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-slate-50/50 border-b border-slate-100 text-center text-xs">
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-2">
                <span className="text-[10px] text-emerald-700 font-bold block">کل حضور</span>
                <span className="font-mono font-black text-emerald-800 text-sm">{totals.present}</span>
              </div>
              <div className="bg-rose-50/70 border border-rose-100 rounded-xl p-2">
                <span className="text-[10px] text-rose-700 font-bold block">کل غیبت غیرموجه (موثر)</span>
                <span className="font-mono font-black text-rose-800 text-sm">{totals.unexcused}</span>
                {totals.lateConverted > 0 && (
                  <span className="block text-[9.5px] text-amber-700 font-bold">شامل +{totals.lateConverted} معادل تاخیر</span>
                )}
              </div>
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-2">
                <span className="text-[10px] text-indigo-700 font-bold block">کل غیبت موجه</span>
                <span className="font-mono font-black text-indigo-800 text-sm">{totals.excused}</span>
              </div>
              <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-2">
                <span className="text-[10px] text-amber-700 font-bold block">کل تاخیر معتبر</span>
                <span className="font-mono font-black text-amber-800 text-sm">{totals.late}</span>
              </div>
              <div className="bg-slate-100/70 border border-slate-200 rounded-xl p-2">
                <span className="text-[10px] text-slate-600 font-bold block">کل نامشخص</span>
                <span className="font-mono font-black text-slate-700 text-sm">{totals.unspecified}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="p-3">ردیف</th>
                    <th className="p-3">نام طلبه</th>
                    <th className="p-3">پایه</th>
                    <th className="p-3 text-center text-emerald-700">حاضر</th>
                    <th className="p-3 text-center text-rose-700">غیبت غیرموجه</th>
                    <th className="p-3 text-center text-indigo-700">غیبت موجه</th>
                    <th className="p-3 text-center text-amber-700">تاخیر (تعداد / دقیقه)</th>
                    <th className="p-3 text-center text-slate-600">نامشخص</th>
                    <th className="p-3 text-center">مشمول جریمه؟</th>
                    <th className="p-3 text-center">ریز جلسات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((st, idx) => {
                    const row = attendanceRangeReport[st.id];
                    const presentCount = row?.presentCount || 0;
                    const unexcusedCount = row?.unexcusedCount || 0;
                    const lateConverted = row?.lateConvertedAbsences || 0;
                    const excusedCount = row?.excusedCount || 0;
                    const lateCount = row?.lateCount || 0;
                    const lateMinutesTotal = row?.lateMinutesTotal || 0;
                    const unspecifiedCount = row?.unspecifiedCount || 0;
                    const isExpanded = expandedAttendanceStudentId === st.id;

                    return (
                      <React.Fragment key={st.id}>
                        <tr className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="p-3 font-bold text-slate-900">{st.name}</td>
                          <td className="p-3 text-slate-600">{st.grade || '-'}</td>
                          <td className="p-3 text-center font-bold text-emerald-600 font-mono">{presentCount}</td>
                          <td className="p-3 text-center font-bold text-rose-600 font-mono">
                            <div className="inline-flex flex-col items-center gap-0.5">
                              <span>{unexcusedCount}</span>
                              {lateConverted > 0 && (
                                <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                                  شامل +{lateConverted} از تاخیر
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-center font-bold text-indigo-600 font-mono">{excusedCount}</td>
                          <td className="p-3 text-center font-mono text-amber-700 font-bold">
                            {lateCount > 0 ? (
                              <div className="inline-flex flex-col items-center">
                                <span>{lateCount} مورد</span>
                                {lateMinutesTotal > 0 && (
                                  <span className="text-[10px] text-slate-500 font-normal">({lateMinutesTotal} دقیقه)</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 font-normal">0</span>
                            )}
                          </td>
                          <td className="p-3 text-center font-mono text-slate-500 font-bold">{unspecifiedCount}</td>
                          <td className="p-3 text-center">
                            {unexcusedCount > 0 ? (
                              <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded-md font-bold text-[10px] border border-rose-200">
                                {unexcusedCount} جلسه کسر
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">بدون جریمه</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {(row?.sessions?.length || 0) > 0 ? (
                              <button
                                type="button"
                                onClick={() => setExpandedAttendanceStudentId(isExpanded ? null : st.id)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <span>{row.sessions.length} جلسه</span>
                                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              </button>
                            ) : (
                              <span className="text-slate-300 text-[10px]">---</span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && row && row.sessions.length > 0 && (
                          <tr className="bg-slate-50/80">
                            <td colSpan={10} className="p-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {row.sessions.map((sess, sIdx) => (
                                  <div key={sIdx} className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2 text-[11px]">
                                    <div className="min-w-0">
                                      <div className="font-bold text-slate-800 truncate">{sess.programTitle}</div>
                                      <div className="text-[10px] text-slate-400 font-mono">{sess.date}</div>
                                    </div>
                                    <span className={cn(
                                      "px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0",
                                      sess.effectiveStatus === 'present' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                      sess.effectiveStatus === 'absent' ? "bg-rose-50 text-rose-700 border border-rose-200" :
                                      sess.effectiveStatus === 'excused' ? "bg-indigo-50 text-indigo-700 border border-indigo-200" :
                                      sess.effectiveStatus === 'late' ? "bg-amber-50 text-amber-800 border border-amber-200" :
                                      "bg-slate-100 text-slate-600 border border-slate-200"
                                    )}>
                                      {formatStatusLabel(sess.effectiveStatus, sess.lateMinutes, sess.ignoredLate, sess.lateConvertedToAbsence)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Tab 4: آمار نهار و شام */}
      {activeTab === 'meals' && (
        isAdminMobile ? (
          <div className="space-y-2.5">
            {filteredStudents.map((st, idx) => {
              const stReservations = mealReservations.filter(mr =>
                mr.studentId === st.id && (relevantMealPeriodIds.size === 0 || relevantMealPeriodIds.has(mr.periodId))
              );
              let lunchCount = 0;
              let dinnerCount = 0;
              let totalCost = 0;

              if (stReservations.length > 0) {
                stReservations.forEach(r => {
                  lunchCount += r.totalCalculatedLunches || 0;
                  dinnerCount += r.totalCalculatedDinners || 0;
                  totalCost += (r.finalDeductionAmount || r.totalMealCost || 0);
                });
              } else if (relevantMealPeriodIds.size === 0) {
                const lunch = lunchItems.find(l => l.studentId === st.id);
                lunchCount = lunch?.monthlyMealsCount || 0;
                dinnerCount = 0;
                totalCost = Math.max(0, ((lunch?.monthlyMealsCount || 0) * (lunch?.mealPrice || 45000)) - (lunch?.subsidyDiscount || 0));
              }
              const totalMeals = lunchCount + dinnerCount;

              return (
                <div key={st.id} className="bg-white rounded-[20px] border border-slate-200 p-3.5 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h5 className="text-xs font-black text-slate-900 truncate">{idx + 1}. {st.name}</h5>
                      <span className="text-[11px] text-slate-500">{st.grade || '-'}</span>
                    </div>
                    <span className="text-xs font-black font-mono tabular-nums text-rose-600 shrink-0">
                      {totalCost.toLocaleString('fa-IR')} ت
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center text-[11px]">
                    <div className="bg-slate-50 rounded-xl p-1.5">
                      <span className="text-slate-500 block text-[10px]">نهار</span>
                      <span className="font-mono tabular-nums font-bold text-slate-800">{lunchCount}</span>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-1.5">
                      <span className="text-slate-500 block text-[10px]">شام</span>
                      <span className="font-mono tabular-nums font-bold text-slate-800">{dinnerCount}</span>
                    </div>
                    <div className="bg-indigo-50 rounded-xl p-1.5">
                      <span className="text-indigo-700 block text-[10px]">مجموع وعده</span>
                      <span className="font-mono tabular-nums font-black text-indigo-800">{totalMeals}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800">آمار ژتون‌های نهار و شام و مبالغ کسر از شهریه در بازه انتخابی</h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="p-3">ردیف</th>
                    <th className="p-3">نام طلبه</th>
                    <th className="p-3">پایه</th>
                    <th className="p-3 text-center">تعداد وعده نهار</th>
                    <th className="p-3 text-center">تعداد وعده شام</th>
                    <th className="p-3 text-center">مجموع وعده‌ها</th>
                    <th className="p-3 text-left">مبلغ کسر از شهریه (تومان)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((st, idx) => {
                    const stReservations = mealReservations.filter(mr => 
                      mr.studentId === st.id && (relevantMealPeriodIds.size === 0 || relevantMealPeriodIds.has(mr.periodId))
                    );

                    let lunchCount = 0;
                    let dinnerCount = 0;
                    let totalCost = 0;

                    if (stReservations.length > 0) {
                      stReservations.forEach(r => {
                        lunchCount += r.totalCalculatedLunches || 0;
                        dinnerCount += r.totalCalculatedDinners || 0;
                        totalCost += (r.finalDeductionAmount || r.totalMealCost || 0);
                      });
                    } else if (relevantMealPeriodIds.size === 0) {
                      const lunch = lunchItems.find(l => l.studentId === st.id);
                      lunchCount = lunch?.monthlyMealsCount || 0;
                      dinnerCount = 0;
                      totalCost = Math.max(0, ((lunch?.monthlyMealsCount || 0) * (lunch?.mealPrice || 45000)) - (lunch?.subsidyDiscount || 0));
                    }
                    const totalMeals = lunchCount + dinnerCount;

                    return (
                      <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">{st.name}</td>
                        <td className="p-3 text-slate-600">{st.grade || '-'}</td>
                        <td className="p-3 text-center font-mono font-bold text-slate-800">{lunchCount}</td>
                        <td className="p-3 text-center font-mono font-bold text-slate-800">{dinnerCount}</td>
                        <td className="p-3 text-center font-mono font-bold text-indigo-700">{totalMeals}</td>
                        <td className="p-3 text-left font-mono font-bold text-rose-600">
                          {totalCost.toLocaleString('fa-IR')} تومان
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Tab 5: ارزیابی کلاس مشاوره */}
      {activeTab === 'counseling' && (() => {
        const { rows: counselingRows, totals: cTotals } = counselingRangeReport;

        const renderScoreBadge = (score?: string, isResearch = false) => {
          const clean = String(score || '').trim();
          if (!clean) {
            return <span className="text-[10px] text-slate-400">—</span>;
          }
          const displayLabel = isResearch && clean === 'غیبت' ? 'عدم انجام تکلیف' : clean;
          const badgeCls =
            displayLabel === 'الف'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : displayLabel === 'ب'
                ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                : displayLabel === 'ج'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : displayLabel === 'د'
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : 'bg-slate-100 text-slate-700 border-slate-300';
          return (
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-black', badgeCls)}>
              {displayLabel}
            </span>
          );
        };

        return isAdminMobile ? (
          <div className="space-y-3">
            {/* Mobile Header & Summary Strip */}
            <div className="bg-white rounded-[20px] border border-slate-200 p-3.5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-black text-slate-900">ارزیابی کلاس‌های مشاوره</h4>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    بازه: {toPersianDigits(normStart || '—')} تا {toPersianDigits(normEnd || '—')}
                  </p>
                </div>
                {onRefreshCounselingGrades && (
                  <button
                    type="button"
                    onClick={onRefreshCounselingGrades}
                    disabled={isRefreshingCounseling}
                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={cn(isRefreshingCounseling && 'animate-spin')} />
                    <span>بروزرسانی</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">جلسات ثبت‌شده</span>
                  <span className="font-mono font-black text-slate-800">{toPersianDigits(cTotals.totalSessions)}</span>
                </div>
                <div className="bg-emerald-50 rounded-xl p-2 border border-emerald-100">
                  <span className="text-[10px] text-emerald-700 block">کل الف / ب</span>
                  <span className="font-mono font-black text-emerald-800">
                    {toPersianDigits(cTotals.totalA)} / {toPersianDigits(cTotals.totalB)}
                  </span>
                </div>
                <div className="bg-rose-50 rounded-xl p-2 border border-rose-100">
                  <span className="text-[10px] text-rose-700 block">غیبت / تکلیف</span>
                  <span className="font-mono font-black text-rose-800">
                    {toPersianDigits(cTotals.totalAbsence + cTotals.totalNoHomework)}
                  </span>
                </div>
              </div>

              <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={counselingOnlyEvaluated}
                  onChange={e => setCounselingOnlyEvaluated(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>فقط طلاب دارای ارزیابی در این بازه ({toPersianDigits(cTotals.evaluatedStudentsCount)} نفر)</span>
              </label>
            </div>

            {counselingRows.length === 0 ? (
              <div className="bg-white rounded-[20px] border border-slate-200 p-8 text-center text-xs text-slate-400 font-bold">
                هیچ ارزیابی مشاوره‌ای برای بازه زمانی انتخابی یافت نشد.
              </div>
            ) : (
              counselingRows.map((row, idx) => {
                const isExpanded = expandedCounselingStudentId === row.studentId;
                return (
                  <div key={row.studentId} className="bg-white rounded-[20px] border border-slate-200 p-3.5 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h5 className="text-xs font-black text-slate-900 truncate">
                          {toPersianDigits(idx + 1)}. {row.studentName}
                        </h5>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                          <span>{row.grade || '-'}</span>
                          <span>·</span>
                          <span className="font-bold text-indigo-700">
                            {toPersianDigits(row.sessionsCount)} جلسه ارزیابی
                          </span>
                        </div>
                      </div>
                      <div className="text-left shrink-0">
                        <span className={cn('text-[11px] font-black block', row.bonusAmount > 0 ? 'text-emerald-700' : 'text-slate-400')}>
                          {row.bonusAmount > 0 ? `+${row.bonusAmount.toLocaleString('fa-IR')} ت` : 'فاقد تشویقی'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5 text-center text-[11px] pt-2 border-t border-slate-100">
                      <div className="bg-emerald-50 rounded-xl p-1.5">
                        <span className="text-slate-500 block text-[10px]">الف</span>
                        <span className="font-mono tabular-nums font-black text-emerald-700">{toPersianDigits(row.countA)}</span>
                      </div>
                      <div className="bg-indigo-50 rounded-xl p-1.5">
                        <span className="text-slate-500 block text-[10px]">ب</span>
                        <span className="font-mono tabular-nums font-black text-indigo-700">{toPersianDigits(row.countB)}</span>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-1.5">
                        <span className="text-slate-500 block text-[10px]">ج</span>
                        <span className="font-mono tabular-nums font-black text-amber-700">{toPersianDigits(row.countC)}</span>
                      </div>
                      <div className="bg-rose-50 rounded-xl p-1.5">
                        <span className="text-slate-500 block text-[10px]">د</span>
                        <span className="font-mono tabular-nums font-black text-rose-700">{toPersianDigits(row.countD)}</span>
                      </div>
                      <div className="bg-slate-100 rounded-xl p-1.5">
                        <span className="text-slate-500 block text-[10px]">غیبت</span>
                        <span className="font-mono tabular-nums font-black text-slate-700">
                          {toPersianDigits(row.countAbsence + row.countNoHomework)}
                        </span>
                      </div>
                    </div>

                    {row.sessions.length > 0 && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setExpandedCounselingStudentId(isExpanded ? null : row.studentId)}
                          className="w-full py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200/80"
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          <span>{isExpanded ? 'بستن ریز جلسات' : `مشاهده ریز ${toPersianDigits(row.sessions.length)} جلسه`}</span>
                        </button>

                        {isExpanded && (
                          <div className="mt-2 space-y-2 pt-2 border-t border-slate-100">
                            {row.sessions.map(sess => (
                              <div key={sess.id} className="bg-slate-50/90 rounded-xl p-2.5 border border-slate-200/80 space-y-1.5 text-[11px]">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-black text-slate-800 truncate">{sess.courseTitle || 'کلاس مشاوره'}</span>
                                  <span className="font-mono text-[10px] text-slate-500 shrink-0">{toPersianDigits(sess.sessionDate)}</span>
                                </div>
                                <div className="text-[10px] text-slate-500 flex items-center justify-between">
                                  <span>استاد: {sess.counselorTeacherName || '—'}</span>
                                  {sess.sessionNumber && <span>{sess.sessionNumber}</span>}
                                </div>
                                <div className="flex items-center gap-3 pt-1">
                                  <span className="flex items-center gap-1 text-[10px] text-slate-600">
                                    مشارکت: {renderScoreBadge(sess.participationScore || (sess as any).score, false)}
                                  </span>
                                  <span className="flex items-center gap-1 text-[10px] text-slate-600">
                                    پژوهش: {renderScoreBadge(sess.researchScore, true)}
                                  </span>
                                </div>
                                {sess.counselorFeedback && (
                                  <div className="text-[10px] text-slate-600 bg-white rounded-lg p-1.5 border border-slate-200/70 flex items-start gap-1">
                                    <MessageSquare size={11} className="text-slate-400 mt-0.5 shrink-0" />
                                    <span>{sess.counselorFeedback}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary KPI Cards for Counseling Evaluations in Selected Range */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 block">کل جلسات ثبت‌شده</span>
                <div className="text-base font-black text-slate-900 font-mono mt-1">
                  {toPersianDigits(cTotals.totalSessions)} جلسه
                </div>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 block">طلاب ارزیابی‌شده</span>
                <div className="text-base font-black text-indigo-700 font-mono mt-1">
                  {toPersianDigits(cTotals.evaluatedStudentsCount)} نفر
                </div>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-emerald-200/80 shadow-2xs">
                <span className="text-[11px] font-bold text-emerald-700 block">مجموع رتبه الف</span>
                <div className="text-base font-black text-emerald-700 font-mono mt-1">
                  {toPersianDigits(cTotals.totalA)} مورد
                </div>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-indigo-200/80 shadow-2xs">
                <span className="text-[11px] font-bold text-indigo-700 block">مجموع رتبه ب</span>
                <div className="text-base font-black text-indigo-700 font-mono mt-1">
                  {toPersianDigits(cTotals.totalB)} مورد
                </div>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-amber-200/80 shadow-2xs">
                <span className="text-[11px] font-bold text-amber-700 block">رتبه‌های ج و د</span>
                <div className="text-base font-black text-amber-700 font-mono mt-1">
                  {toPersianDigits(cTotals.totalC)} ج · {toPersianDigits(cTotals.totalD)} د
                </div>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-rose-200/80 shadow-2xs">
                <span className="text-[11px] font-bold text-rose-700 block">غیبت / بدون تکلیف</span>
                <div className="text-base font-black text-rose-700 font-mono mt-1">
                  {toPersianDigits(cTotals.totalAbsence)} / {toPersianDigits(cTotals.totalNoHomework)}
                </div>
              </div>
            </div>

            {/* Main Table Card */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h4 className="text-xs font-black text-slate-800">
                    اطلاعات کامل ارزیابی کلاس‌های مشاوره طلاب در بازه انتخابی
                  </h4>
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <Calendar size={12} />
                    <span>از {toPersianDigits(normStart || '—')} تا {toPersianDigits(normEnd || '—')}</span>
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={counselingOnlyEvaluated}
                      onChange={e => setCounselingOnlyEvaluated(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>فقط طلاب دارای ارزیابی ({toPersianDigits(cTotals.evaluatedStudentsCount)})</span>
                  </label>

                  {onRefreshCounselingGrades && (
                    <button
                      type="button"
                      onClick={onRefreshCounselingGrades}
                      disabled={isRefreshingCounseling}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                      title="بروزرسانی لحظه‌ای ارزیابی‌های ثبت‌شده اساتید از سرور"
                    >
                      <RefreshCw size={13} className={cn(isRefreshingCounseling && 'animate-spin')} />
                      <span>{isRefreshingCounseling ? 'در حال دریافت...' : 'بروزرسانی ارزیابی‌ها'}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                    <tr>
                      <th className="p-3">ردیف</th>
                      <th className="p-3">نام طلبه</th>
                      <th className="p-3">پایه</th>
                      <th className="p-3 text-center">تعداد جلسات</th>
                      <th className="p-3 text-center text-emerald-700">رتبه الف</th>
                      <th className="p-3 text-center text-indigo-700">رتبه ب</th>
                      <th className="p-3 text-center text-amber-700">رتبه ج</th>
                      <th className="p-3 text-center text-rose-700">رتبه د</th>
                      <th className="p-3 text-center text-slate-600">غیبت / بدون تکلیف</th>
                      <th className="p-3 text-left">پاداش و امتیاز مشاوره</th>
                      <th className="p-3 text-center">ریز ارزیابی‌ها</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {counselingRows.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="p-8 text-center text-slate-400 font-bold">
                          در بازه زمانی از {toPersianDigits(normStart || '—')} تا {toPersianDigits(normEnd || '—')} هیچ رکورد ارزیابی کلاس مشاوره‌ای برای طلاب مطابق فیلتر یافت نشد.
                        </td>
                      </tr>
                    ) : (
                      counselingRows.map((row, idx) => {
                        const isExpanded = expandedCounselingStudentId === row.studentId;
                        return (
                          <React.Fragment key={row.studentId}>
                            <tr
                              className={cn(
                                'hover:bg-slate-50/80 transition-colors',
                                row.sessionsCount > 0 && 'cursor-pointer',
                                isExpanded && 'bg-emerald-50/40'
                              )}
                              onClick={() => {
                                if (row.sessionsCount > 0) {
                                  setExpandedCounselingStudentId(isExpanded ? null : row.studentId);
                                }
                              }}
                            >
                              <td className="p-3 text-slate-400 font-mono">{toPersianDigits(idx + 1)}</td>
                              <td className="p-3 font-bold text-slate-900">{row.studentName}</td>
                              <td className="p-3 text-slate-600">{row.grade || '-'}</td>
                              <td className="p-3 text-center font-mono font-bold">
                                <span className={cn(
                                  'px-2 py-0.5 rounded-lg text-[11px]',
                                  row.sessionsCount > 0 ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/70' : 'text-slate-400'
                                )}>
                                  {toPersianDigits(row.sessionsCount)} جلسه
                                </span>
                              </td>
                              <td className="p-3 text-center font-black text-emerald-600 font-mono">{toPersianDigits(row.countA)}</td>
                              <td className="p-3 text-center font-black text-indigo-600 font-mono">{toPersianDigits(row.countB)}</td>
                              <td className="p-3 text-center font-black text-amber-600 font-mono">{toPersianDigits(row.countC)}</td>
                              <td className="p-3 text-center font-black text-rose-600 font-mono">{toPersianDigits(row.countD)}</td>
                              <td className="p-3 text-center font-mono text-slate-600">
                                {row.countAbsence > 0 || row.countNoHomework > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200/70">
                                    {toPersianDigits(row.countAbsence)} غ · {toPersianDigits(row.countNoHomework)} ت
                                  </span>
                                ) : (
                                  <span className="text-slate-300">۰</span>
                                )}
                              </td>
                              <td className="p-3 text-left font-mono">
                                {row.bonusAmount > 0 ? (
                                  <div className="flex flex-col items-end">
                                    <span className="font-black text-emerald-700">+{row.bonusAmount.toLocaleString('fa-IR')} تومان</span>
                                    <span className="text-[10px] text-slate-500">
                                      {toPersianDigits(row.countA + row.countB)} نمره عالی
                                    </span>
                                  </div>
                                ) : row.countA + row.countB > 0 ? (
                                  <span className="font-bold text-emerald-700">{toPersianDigits(row.countA + row.countB)} نمره عالی</span>
                                ) : (
                                  <span className="text-slate-400 font-normal">فاقد تشویقی</span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {row.sessionsCount > 0 ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedCounselingStudentId(isExpanded ? null : row.studentId);
                                    }}
                                    className={cn(
                                      'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer border',
                                      isExpanded
                                        ? 'bg-emerald-600 text-white border-emerald-700'
                                        : 'bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border-slate-200'
                                    )}
                                  >
                                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                    <span>{isExpanded ? 'بستن' : 'ریز جلسات'}</span>
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-slate-300">—</span>
                                )}
                              </td>
                            </tr>

                            {isExpanded && row.sessions.length > 0 && (
                              <tr className="bg-slate-50/90">
                                <td colSpan={11} className="p-4 border-t border-emerald-200/70">
                                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                                    <div className="px-3.5 py-2.5 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between">
                                      <span className="text-[11px] font-black text-emerald-900">
                                        ریز ارزیابی‌های ثبت‌شده برای «{row.studentName}» ({toPersianDigits(row.sessions.length)} جلسه در بازه انتخابی)
                                      </span>
                                      <span className="text-[10px] font-mono text-emerald-700">
                                        {toPersianDigits(normStart || '—')} الی {toPersianDigits(normEnd || '—')}
                                      </span>
                                    </div>
                                    <table className="w-full text-right text-[11px]">
                                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                                        <tr>
                                          <th className="py-2 px-3">تاریخ جلسه</th>
                                          <th className="py-2 px-3">کلاس مشاوره</th>
                                          <th className="py-2 px-3">استاد مشاور</th>
                                          <th className="py-2 px-3 text-center">شماره جلسه</th>
                                          <th className="py-2 px-3 text-center">نمره مشارکت</th>
                                          <th className="py-2 px-3 text-center">نمره پژوهش و تقریر</th>
                                          <th className="py-2 px-3">بازخورد و توضیحات استاد</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {row.sessions.map(sess => (
                                          <tr key={sess.id} className="hover:bg-slate-50/70">
                                            <td className="py-2 px-3 font-mono font-bold text-slate-700">{toPersianDigits(sess.sessionDate)}</td>
                                            <td className="py-2 px-3 font-bold text-slate-900">{sess.courseTitle || 'کلاس مشاوره'}</td>
                                            <td className="py-2 px-3 text-slate-600">{sess.counselorTeacherName || '—'}</td>
                                            <td className="py-2 px-3 text-center text-slate-500">{sess.sessionNumber || '—'}</td>
                                            <td className="py-2 px-3 text-center">
                                              {renderScoreBadge(sess.participationScore || (sess as any).score, false)}
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                              {renderScoreBadge(sess.researchScore, true)}
                                            </td>
                                            <td className="py-2 px-3 text-slate-600 max-w-xs">
                                              {sess.counselorFeedback ? (
                                                <span className="leading-relaxed">{sess.counselorFeedback}</span>
                                              ) : (
                                                <span className="text-slate-300">—</span>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tab 6: بدهی‌ها و مطالبات */}
      {activeTab === 'debts' && (
        isAdminMobile ? (
          <div className="space-y-2.5">
            {filteredStudents.map((st, idx) => {
              const studentClaims = claimsList.filter(c => c.studentId === st.id && (c.remainingAmount || 0) > 0);
              const totalDebt = studentClaims.reduce((a, b) => a + (b.remainingAmount || 0), 0);
              const monthlyDeduct = studentClaims.reduce((a, b) => a + (b.monthlyDeductionAmount || b.remainingAmount || 0), 0);

              return (
                <div key={st.id} className="bg-white rounded-[20px] border border-slate-200 p-3.5 shadow-2xs space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-black text-slate-900 truncate">{idx + 1}. {st.name}</h5>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {st.grade || '-'} · {studentClaims.length > 0 ? studentClaims.map(c => c.claimTitle).join('، ') : 'فاقد بدهی'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenDebtModal(st)}
                      className="min-h-[40px] px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black rounded-xl text-xs cursor-pointer shrink-0"
                    >
                      ریز بدهی
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                    <div className="bg-rose-50 rounded-xl p-2 flex items-center justify-between">
                      <span className="text-slate-600">مانده کل</span>
                      <span className="font-mono tabular-nums font-black text-rose-700">{totalDebt.toLocaleString('fa-IR')} ت</span>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2 flex items-center justify-between">
                      <span className="text-slate-600">قسط دوره</span>
                      <span className="font-mono tabular-nums font-black text-slate-900">{monthlyDeduct.toLocaleString('fa-IR')} ت</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs space-y-2">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-800">عناوین بدهی طلاب و حساب‌های مقصد واریز</h4>
                <p className="text-[11px] text-slate-500">برای مشاهده ریز بدهی‌ها یا افزودن بدهی جدید بر روی دکمه مدیریت کلیک کنید.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="p-3">ردیف</th>
                    <th className="p-3">نام طلبه</th>
                    <th className="p-3">پایه</th>
                    <th className="p-3">عناوین بدهی</th>
                    <th className="p-3">حساب‌های مقصد</th>
                    <th className="p-3 text-left">مانده کل بدهی</th>
                    <th className="p-3 text-left">قسط کسر در این دوره</th>
                    <th className="p-3 text-center">مدیریت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((st, idx) => {
                    const studentClaims = claimsList.filter(c => c.studentId === st.id && (c.remainingAmount || 0) > 0);
                    const totalDebt = studentClaims.reduce((a, b) => a + (b.remainingAmount || 0), 0);
                    const monthlyDeduct = studentClaims.reduce((a, b) => a + (b.monthlyDeductionAmount || b.remainingAmount || 0), 0);

                    return (
                      <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">{st.name}</td>
                        <td className="p-3 text-slate-600">{st.grade || '-'}</td>
                        <td className="p-3">
                          {studentClaims.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {studentClaims.map(c => (
                                <span key={c.id} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px]">
                                  {c.claimTitle}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">فاقد بدهی</span>
                          )}
                        </td>
                        <td className="p-3">
                          {studentClaims.length > 0 ? (
                            <div className="text-[11px] text-slate-600">
                              {destinationAccounts.find(d => d.id === studentClaims[0]?.destinationAccountId)?.title || 'حساب پیش‌فرض صندوق'}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3 text-left font-mono font-bold text-rose-600">
                          {totalDebt.toLocaleString('fa-IR')} تومان
                        </td>
                        <td className="p-3 text-left font-mono font-bold text-slate-800">
                          {monthlyDeduct.toLocaleString('fa-IR')} تومان
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => onOpenDebtModal(st)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[10px] transition-colors cursor-pointer"
                          >
                            ریز بدهی
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Tab 7: حق عضویت صندوق */}
      {activeTab === 'fund_contribution' && (
        isAdminMobile ? (
          <div className="space-y-2.5">
            {filteredStudents.map((st, idx) => {
              const prof = profileMap.get(st.id);
              const amount = prof?.fundContributionMonthly ?? prof?.fundContribution ?? 0;
              const isMember = amount > 0;
              return (
                <div key={st.id} className="bg-white rounded-[20px] border border-slate-200 p-3.5 shadow-2xs flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h5 className="text-xs font-black text-slate-900 truncate">{idx + 1}. {st.name}</h5>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>{st.grade || '-'}</span>
                      <span aria-hidden="true">·</span>
                      <span className={isMember ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                        {isMember ? 'عضو صندوق' : 'غیرعضو'}
                      </span>
                      {prof?.bankAccount && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono break-all">{prof.bankAccount}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="font-mono tabular-nums text-xs font-black text-indigo-700 shrink-0">
                    {isMember ? `${amount.toLocaleString('fa-IR')} ت` : '۰'}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800">حق عضویت و پس‌انداز ماهانه در صندوق قرض‌الحسنه</h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="p-3">ردیف</th>
                    <th className="p-3">نام طلبه</th>
                    <th className="p-3">پایه</th>
                    <th className="p-3 text-center">عضو صندوق؟</th>
                    <th className="p-3 text-left">مبلغ پس‌انداز ماهانه</th>
                    <th className="p-3 text-left">شماره حساب پس‌انداز</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((st, idx) => {
                    const prof = profileMap.get(st.id);
                    const amount = prof?.fundContributionMonthly ?? prof?.fundContribution ?? 0;
                    const isMember = amount > 0;

                    return (
                      <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">{st.name}</td>
                        <td className="p-3 text-slate-600">{st.grade || '-'}</td>
                        <td className="p-3 text-center">
                          {isMember ? (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-bold text-[10px]">بله</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md font-bold text-[10px]">خیر</span>
                          )}
                        </td>
                        <td className="p-3 text-left font-mono font-bold text-indigo-700">
                          {isMember ? `${amount.toLocaleString('fa-IR')} تومان` : '۰'}
                        </td>
                        <td className="p-3 text-left font-mono text-slate-600">
                          {prof?.bankAccount || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Tab 8: اقساط وام‌ها */}
      {activeTab === 'loans' && (
        isAdminMobile ? (
          <div className="space-y-2.5">
            {filteredStudents.map((st, idx) => {
              const studentLoans = loans.filter((l: any) => l.studentId === st.id && (l.remainingBalance || 0) > 0);
              const totalLoanInstallment = studentLoans.reduce((a: number, b: any) => a + (b.monthlyInstallment || 0), 0);
              const totalLoanBalance = studentLoans.reduce((a: number, b: any) => a + (b.remainingBalance || 0), 0);

              return (
                <div key={st.id} className="bg-white rounded-[20px] border border-slate-200 p-3.5 shadow-2xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-black text-slate-900 truncate">{idx + 1}. {st.name}</h5>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {st.grade || '-'} · {studentLoans.length > 0 ? studentLoans.map((l: any) => l.title || 'وام صندوق').join('، ') : 'فاقد وام فعال'}
                      </p>
                    </div>
                    {studentLoans.length > 0 && (
                      <span className="text-[11px] font-mono tabular-nums text-indigo-700 font-bold shrink-0">
                        {studentLoans[0].remainingInstallmentsCount || 1} قسط مانده
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                    <div className="bg-slate-50 rounded-xl p-2 flex items-center justify-between">
                      <span className="text-slate-600">قسط</span>
                      <span className="font-mono tabular-nums font-black text-slate-900">{totalLoanInstallment.toLocaleString('fa-IR')} ت</span>
                    </div>
                    <div className="bg-rose-50 rounded-xl p-2 flex items-center justify-between">
                      <span className="text-slate-600">مانده کل</span>
                      <span className="font-mono tabular-nums font-black text-rose-700">{totalLoanBalance.toLocaleString('fa-IR')} ت</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800">اقساط وام‌های فعال صندوق قرض‌الحسنه طلاب</h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="p-3">ردیف</th>
                    <th className="p-3">نام طلبه</th>
                    <th className="p-3">پایه</th>
                    <th className="p-3">عنوان وام</th>
                    <th className="p-3 text-left">مبلغ هر قسط</th>
                    <th className="p-3 text-left">مانده کل وام</th>
                    <th className="p-3 text-center">اقساط باقیمانده</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((st, idx) => {
                    const studentLoans = loans.filter((l: any) => l.studentId === st.id && (l.remainingBalance || 0) > 0);
                    const totalLoanInstallment = studentLoans.reduce((a: number, b: any) => a + (b.monthlyInstallment || 0), 0);
                    const totalLoanBalance = studentLoans.reduce((a: number, b: any) => a + (b.remainingBalance || 0), 0);

                    return (
                      <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">{st.name}</td>
                        <td className="p-3 text-slate-600">{st.grade || '-'}</td>
                        <td className="p-3">
                          {studentLoans.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {studentLoans.map((l: any) => (
                                <span key={l.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px]">
                                  {l.title || 'وام صندوق'}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">فاقد وام فعال</span>
                          )}
                        </td>
                        <td className="p-3 text-left font-mono font-bold text-slate-800">
                          {totalLoanInstallment.toLocaleString('fa-IR')} تومان
                        </td>
                        <td className="p-3 text-left font-mono font-bold text-rose-600">
                          {totalLoanBalance.toLocaleString('fa-IR')} تومان
                        </td>
                        <td className="p-3 text-center font-mono text-slate-600">
                          {studentLoans.length > 0 ? studentLoans[0].remainingInstallmentsCount || 1 : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Tab 9: پاداش و جرایم دستی */}
      {activeTab === 'manual_adjustments' && (
        isAdminMobile ? (
          <div className="space-y-2.5">
            {filteredStudents.map((st, idx) => {
              const override = studentOverrides[st.id] || {};
              const amount = override.manualAdjustmentAmount ?? 0;
              const reason = override.manualAdjustmentReason ?? '';

              return (
                <div key={st.id} className="bg-white rounded-[20px] border border-slate-200 p-3.5 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h5 className="text-xs font-black text-slate-900 truncate">{idx + 1}. {st.name}</h5>
                    <span className="text-[11px] text-slate-500 shrink-0">{st.grade || '-'}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">اصلاحیه (+پاداش / -جریمه)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={amount || ''}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : 0;
                          setStudentOverrides(prev => ({
                            ...prev,
                            [st.id]: { ...prev[st.id], manualAdjustmentAmount: val }
                          }));
                        }}
                        className="w-full min-h-[42px] px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono tabular-nums focus:bg-white focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">پاداش مطالعه دستی</label>
                      <input
                        type="number"
                        placeholder="پاداش مطالعه"
                        value={override.overrideStudyBonus ?? ''}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : undefined;
                          setStudentOverrides(prev => ({
                            ...prev,
                            [st.id]: { ...prev[st.id], overrideStudyBonus: val }
                          }));
                        }}
                        className="w-full min-h-[42px] px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono tabular-nums focus:bg-white focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">علت یا شرح اصلاحیه</label>
                    <input
                      type="text"
                      placeholder="علت پاداش یا جریمه..."
                      value={reason}
                      onChange={(e) => {
                        const text = e.target.value;
                        setStudentOverrides(prev => ({
                          ...prev,
                          [st.id]: { ...prev[st.id], manualAdjustmentReason: text }
                        }));
                      }}
                      className="w-full min-h-[42px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800">اصلاحات، پاداش‌ها و جرایم موردی دستی برای این دوره</h4>
              <span className="text-[11px] text-slate-500">می‌توانید مبالغ تشویقی یا کسورات خاص را مستقیم ویرایش کنید</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="p-3">ردیف</th>
                    <th className="p-3">نام طلبه</th>
                    <th className="p-3">پایه</th>
                    <th className="p-3">مبلغ اصلاحیه (تومان، مثبت=پاداش، منفی=جریمه)</th>
                    <th className="p-3">علت یا شرح اصلاحیه</th>
                    <th className="p-3 text-center">پاداش مازاد مطالعه</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((st, idx) => {
                    const override = studentOverrides[st.id] || {};
                    const amount = override.manualAdjustmentAmount ?? 0;
                    const reason = override.manualAdjustmentReason ?? '';

                    return (
                      <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">{st.name}</td>
                        <td className="p-3 text-slate-600">{st.grade || '-'}</td>
                        <td className="p-3">
                          <input
                            type="number"
                            placeholder="0"
                            value={amount || ''}
                            onChange={(e) => {
                              const val = e.target.value ? Number(e.target.value) : 0;
                              setStudentOverrides(prev => ({
                                ...prev,
                                [st.id]: {
                                  ...prev[st.id],
                                  manualAdjustmentAmount: val
                                }
                              }));
                            }}
                            className="w-36 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            placeholder="علت پاداش یا جریمه..."
                            value={reason}
                            onChange={(e) => {
                              const text = e.target.value;
                              setStudentOverrides(prev => ({
                                ...prev,
                                [st.id]: {
                                  ...prev[st.id],
                                  manualAdjustmentReason: text
                                }
                              }));
                            }}
                            className="w-full max-w-xs px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="number"
                            placeholder="پاداش مطالعه"
                            value={override.overrideStudyBonus ?? ''}
                            onChange={(e) => {
                              const val = e.target.value ? Number(e.target.value) : undefined;
                              setStudentOverrides(prev => ({
                                ...prev,
                                [st.id]: {
                                  ...prev[st.id],
                                  overrideStudyBonus: val
                                }
                              }));
                            }}
                            className="w-28 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono text-center focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default ActivityInfoTabbedView;
