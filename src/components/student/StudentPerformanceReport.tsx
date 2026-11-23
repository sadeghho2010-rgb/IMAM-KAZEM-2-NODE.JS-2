import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  BookOpen,
  Utensils,
  Award,
  Sparkles,
  RefreshCw,
  Eye,
  X,
  Lock,
  ChevronLeft,
  MessageSquare,
  GraduationCap,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { ShamsiDatePicker } from '../ShamsiDatePicker';
import {
  getTodayShamsi,
  parseShamsiDate,
  normalizeShamsiDateStr,
  dateToShamsi,
  compareShamsi,
  toEnglishDigits
} from '../../lib/jalali';
import {
  resolveAttendanceRules,
  classifyAttendanceRecord,
  computeLateConvertedAbsences,
  consolidateAttendanceLogs,
  isDateOfficialHoliday
} from '../../lib/attendanceRules';
import {
  Student,
  Program,
  AttendanceSessionLog,
  AttendanceSettings,
  AcademicHolidayItem,
  CounselingSessionGrade,
  StudyPeriod,
  PeriodicStudyLog,
  StudyDailyEntry,
  StudentMealReservation,
  MealReservationPeriod,
  OralExam,
  WorkflowItem
} from '../../types';

type DetailModalType =
  | null
  | 'attendance'
  | 'counseling'
  | 'study'
  | 'meals'
  | 'oral_exams'
  | 'attendance_warnings'
  | 'study_warnings';

interface UnifiedDefinitiveWarning {
  id: string;
  category: 'attendance' | 'study';
  dateShamsi: string;
  title: string;
  description: string;
  courseOrPeriodTitle: string;
  issuerName?: string;
  absentCount?: number;
  deficitMinutes?: number;
  inRange: boolean;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function computeDefaultPerformanceRange(): { startDate: string; endDate: string; prevMonth21: string; cycle20: string; currentMonthStart: string; academicYearStart: string } {
  const today = normalizeShamsiDateStr(getTodayShamsi());
  const parsed = parseShamsiDate(today);
  const year = parsed?.year || 1404;
  const month = parsed?.month || 1;
  const day = parsed?.day || 1;

  // 21st of previous Shamsi month
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevMonth21 = `${prevYear}/${pad2(prevMonth)}/21`;

  // 20th of current Shamsi month (or 20th of next month if day >= 21)
  const cycle20 = `${year}/${pad2(month)}/20`;
  const currentMonthStart = `${year}/${pad2(month)}/01`;
  const academicYearStart = month >= 7 ? `${year}/07/01` : `${year - 1}/07/01`;

  return {
    startDate: prevMonth21,
    endDate: today,
    prevMonth21,
    cycle20: day <= 20 ? cycle20 : `${month === 12 ? year + 1 : year}/${pad2(month === 12 ? 1 : month + 1)}/20`,
    currentMonthStart,
    academicYearStart
  };
}

function formatMinutesFa(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes || 0));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} دقیقه`;
  if (m === 0) return `${h} ساعت`;
  return `${h} ساعت و ${m} دقیقه`;
}

function normalizePersianText(val?: string | null): string {
  return toEnglishDigits(String(val || ''))
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeAnyDateToShamsi(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return normalizeShamsiDateStr(dateToShamsi(parsed));
    }
  }
  const eng = toEnglishDigits(trimmed);
  if (/^1[34]\d{2}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(eng)) {
    return normalizeShamsiDateStr(eng.slice(0, 10));
  }
  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) {
    return normalizeShamsiDateStr(dateToShamsi(d));
  }
  return normalizeShamsiDateStr(trimmed);
}

export const StudentPerformanceReport: React.FC = () => {
  const { currentUser } = useAuth();
  const defaultRange = useMemo(() => computeDefaultPerformanceRange(), []);

  const [startDate, setStartDate] = useState<string>(defaultRange.startDate);
  const [endDate, setEndDate] = useState<string>(defaultRange.endDate);
  const [activeDetailModal, setActiveDetailModal] = useState<DetailModalType>(null);
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'absent' | 'late' | 'excused' | 'present'>('all');
  const [warningsScope, setWarningsScope] = useState<'range' | 'all_time'>('range');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Strictly read-only local state hydrated from localDb (ZERO writes anywhere in this component)
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceSessionLog[]>([]);
  const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSettings | null>(null);
  const [academicHolidays, setAcademicHolidays] = useState<AcademicHolidayItem[]>([]);
  const [counselingGrades, setCounselingGrades] = useState<CounselingSessionGrade[]>([]);
  const [studyPeriods, setStudyPeriods] = useState<StudyPeriod[]>([]);
  const [studyLogs, setStudyLogs] = useState<PeriodicStudyLog[]>([]);
  const [studyDailyEntries, setStudyDailyEntries] = useState<StudyDailyEntry[]>([]);
  const [mealReservations, setMealReservations] = useState<StudentMealReservation[]>([]);
  const [mealPeriods, setMealPeriods] = useState<MealReservationPeriod[]>([]);
  const [oralExams, setOralExams] = useState<OralExam[]>([]);
  const [oralExamRecords, setOralExamRecords] = useState<any[]>([]);
  const [oralExamPeriods, setOralExamPeriods] = useState<any[]>([]);
  const [workflowItems, setWorkflowItems] = useState<WorkflowItem[]>([]);

  const loadAllReadOnlyData = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    try {
      const [
        allStudents,
        allPrograms,
        allAttendance,
        allAttSettings,
        allHolidays,
        allCounselingPrimary,
        allCounselingLegacy,
        allStudyPeriods,
        allStudyLogs,
        allStudyDaily,
        allMealRes,
        allMealPeriods,
        allOralExams,
        allOralRecords,
        allOralPeriods,
        allWorkflows
      ] = await Promise.all([
        localDb.getDocs<Student>('students').catch(() => []),
        localDb.getDocs<Program>('programs').catch(() => []),
        localDb.getDocs<AttendanceSessionLog>('attendance').catch(() => []),
        localDb.getDocs<AttendanceSettings>('attendance_settings').catch(() => []),
        localDb.getDocs<AcademicHolidayItem>('academic_holidays').catch(() => []),
        localDb.getDocs<CounselingSessionGrade>('counseling_session_grades').catch(() => []),
        localDb.getDocs<CounselingSessionGrade>('counseling_grades' as any).catch(() => []),
        localDb.getDocs<StudyPeriod>('study_periods').catch(() => []),
        localDb.getDocs<PeriodicStudyLog>('periodic_study_logs').catch(() => []),
        localDb.getDocs<StudyDailyEntry>('study_daily_entries').catch(() => []),
        localDb.getDocs<StudentMealReservation>('meal_reservations').catch(() => []),
        localDb.getDocs<MealReservationPeriod>('meal_reservation_periods').catch(() => []),
        localDb.getDocs<OralExam>('oral_exams').catch(() => []),
        localDb.getDocs<any>('oral_exam_records' as any).catch(() => []),
        localDb.getDocs<any>('oral_exam_periods' as any).catch(() => []),
        localDb.getDocs<WorkflowItem>('workflow_items').catch(() => [])
      ]);

      // Strictly identify ONLY the logged-in student (no other student's profile is ever exposed)
      const userStId = currentUser?.studentId || currentUser?.linkedStudentId || '';
      const userId = currentUser?.id || '';
      const userUsername = toEnglishDigits(String(currentUser?.username || '')).trim().toLowerCase();
      const userNameNorm = normalizePersianText(currentUser?.studentName || currentUser?.name || currentUser?.fullName || '');

      const matched =
        (allStudents || []).find(s => {
          if (!s) return false;
          if (userStId && String(s.id).trim() === String(userStId).trim()) return true;
          if (userId && String(s.id).trim() === String(userId).trim()) return true;
          if (userUsername) {
            const nat = toEnglishDigits(String(s.nationalId || '')).trim().toLowerCase();
            const code = toEnglishDigits(String(s.studentCode || '')).trim().toLowerCase();
            const mgmt = toEnglishDigits(String(s.managementCenterCode || '')).trim().toLowerCase();
            if (nat && nat === userUsername) return true;
            if (code && code === userUsername) return true;
            if (mgmt && mgmt === userUsername) return true;
          }
          return false;
        }) ||
        (userNameNorm
          ? (allStudents || []).find(s => normalizePersianText(s.name) === userNameNorm)
          : undefined) ||
        null;

      setMatchedStudent(matched);
      setPrograms(allPrograms || []);
      setAttendanceLogs(allAttendance || []);
      setAttendanceSettings(allAttSettings && allAttSettings.length > 0 ? allAttSettings[0] : null);
      setAcademicHolidays(allHolidays || []);

      // Merge primary + legacy counseling session grades cleanly
      const counselingById = new Map<string, CounselingSessionGrade>();
      [...(allCounselingLegacy || []), ...(allCounselingPrimary || [])].forEach(item => {
        if (!item?.id) return;
        const prev = counselingById.get(item.id);
        if (!prev) {
          counselingById.set(item.id, item);
        } else {
          const curTs = new Date(item.updatedAt || item.createdAt || 0).getTime();
          const prevTs = new Date(prev.updatedAt || prev.createdAt || 0).getTime();
          if (curTs >= prevTs) counselingById.set(item.id, item);
        }
      });
      setCounselingGrades(Array.from(counselingById.values()));

      setStudyPeriods(allStudyPeriods || []);
      setStudyLogs(allStudyLogs || []);
      setStudyDailyEntries(allStudyDaily || []);
      setMealReservations(allMealRes || []);
      setMealPeriods(allMealPeriods || []);
      setOralExams(allOralExams || []);
      setOralExamRecords(allOralRecords || []);
      setOralExamPeriods(allOralPeriods || []);
      setWorkflowItems(allWorkflows || []);
    } catch (err) {
      console.warn('Error loading student performance report:', err);
    } finally {
      if (isInitial) setIsLoading(false);
    }
  }, [currentUser]);

  const syncFromCloudReadOnly = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsSyncing(true);
    try {
      await Promise.all([
        localDb.syncCollectionFromCloud('attendance', true).catch(() => {}),
        localDb.syncCollectionFromCloud('attendance_settings', true).catch(() => {}),
        localDb.syncCollectionFromCloud('counseling_session_grades', true).catch(() => {}),
        localDb.syncCollectionFromCloud('study_periods', true).catch(() => {}),
        localDb.syncCollectionFromCloud('periodic_study_logs', true).catch(() => {}),
        localDb.syncCollectionFromCloud('study_daily_entries', true).catch(() => {}),
        localDb.syncCollectionFromCloud('meal_reservations', true).catch(() => {}),
        localDb.syncCollectionFromCloud('meal_reservation_periods', true).catch(() => {}),
        localDb.syncCollectionFromCloud('oral_exams', true).catch(() => {}),
        localDb.syncCollectionFromCloud('workflow_items', true).catch(() => {})
      ]);
      await loadAllReadOnlyData(false);
    } catch (err) {
      console.warn('Read-only sync warning in StudentPerformanceReport:', err);
    } finally {
      if (showSpinner) setIsSyncing(false);
    }
  }, [loadAllReadOnlyData]);

  useEffect(() => {
    loadAllReadOnlyData(true);
    syncFromCloudReadOnly(false);

    let debounceTimer: any = null;
    const triggerRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadAllReadOnlyData(false);
      }, 300);
    };

    const unsub = localDb.subscribe(triggerRefresh);
    window.addEventListener('app_data_change', triggerRefresh);
    window.addEventListener('attendance_updated', triggerRefresh);
    window.addEventListener('workflow_items_updated', triggerRefresh);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsub();
      window.removeEventListener('app_data_change', triggerRefresh);
      window.removeEventListener('attendance_updated', triggerRefresh);
      window.removeEventListener('workflow_items_updated', triggerRefresh);
    };
  }, [loadAllReadOnlyData, syncFromCloudReadOnly]);

  // Strict single-student matcher (ONLY matches the logged-in student — zero leakage to others)
  const studentIdentity = useMemo(() => {
    const idSet = new Set<string>();
    const addKey = (val?: string | number | null) => {
      if (val === undefined || val === null) return;
      const clean = toEnglishDigits(String(val)).trim().toLowerCase();
      if (clean) idSet.add(clean);
    };

    addKey(matchedStudent?.id);
    addKey(matchedStudent?.studentCode);
    addKey(matchedStudent?.nationalId);
    addKey(matchedStudent?.managementCenterCode);
    addKey(currentUser?.studentId);
    addKey(currentUser?.linkedStudentId);
    addKey(currentUser?.id);
    addKey(currentUser?.username);

    const exactNames = new Set<string>();
    const addName = (n?: string | null) => {
      const norm = normalizePersianText(n);
      if (norm && norm.length >= 3) exactNames.add(norm);
    };
    addName(matchedStudent?.name);
    addName(currentUser?.studentName);
    addName(currentUser?.fullName);
    addName(currentUser?.name);

    return {
      idSet,
      exactNames,
      displayName: matchedStudent?.name || currentUser?.studentName || currentUser?.fullName || currentUser?.name || currentUser?.username || 'طلبه محترم',
      grade: matchedStudent?.grade || currentUser?.gradeLabel || '',
      code: matchedStudent?.studentCode || matchedStudent?.nationalId || currentUser?.username || ''
    };
  }, [matchedStudent, currentUser]);

  const belongsToMe = useCallback(
    (fields: { studentId?: any; nationalId?: any; studentCode?: any; userId?: any; studentName?: any }) => {
      const idCandidates = [fields.studentId, fields.nationalId, fields.studentCode, fields.userId];
      for (const c of idCandidates) {
        if (c !== undefined && c !== null && String(c).trim() !== '') {
          const clean = toEnglishDigits(String(c)).trim().toLowerCase();
          if (studentIdentity.idSet.has(clean)) return true;
        }
      }
      // Strict exact-name fallback only when ID fields didn't match (prevents cross-student leakage)
      if (fields.studentName) {
        const norm = normalizePersianText(fields.studentName);
        if (norm && studentIdentity.exactNames.has(norm)) return true;
      }
      return false;
    },
    [studentIdentity]
  );

  const normStart = useMemo(() => normalizeShamsiDateStr(startDate), [startDate]);
  const normEnd = useMemo(() => normalizeShamsiDateStr(endDate), [endDate]);

  const isDateInRange = useCallback(
    (rawDate?: string | null) => {
      const d = normalizeAnyDateToShamsi(rawDate);
      if (!d) return false;
      if (normStart && d < normStart) return false;
      if (normEnd && d > normEnd) return false;
      return true;
    },
    [normStart, normEnd]
  );

  const attendanceRules = useMemo(() => resolveAttendanceRules(attendanceSettings), [attendanceSettings]);

  // =========================================================================
  // 1. Attendance & Tardiness Stats (Rule-aware & Deduplicated)
  // =========================================================================
  const attendanceStats = useMemo(() => {
    const consolidated = consolidateAttendanceLogs(attendanceLogs);
    const activeProgramIds = new Set(
      programs
        .filter(p => !p.isDeleted && p.status !== 'inactive' && p.status !== 'deleted')
        .map(p => String(p.id))
    );

    let presentCount = 0;
    let directAbsentCount = 0;
    let excusedCount = 0;
    let lateCount = 0;
    let lateMinutesTotal = 0;
    let unspecifiedCount = 0;
    let ignoredLateCount = 0;
    let lateOverLimitAsAbsenceCount = 0;

    const sessions: Array<{
      date: string;
      programTitle: string;
      rawStatus: string;
      effectiveStatus: 'present' | 'absent' | 'excused' | 'late' | 'unspecified';
      lateMinutes?: number;
      ignoredLate: boolean;
      lateConvertedToAbsence: boolean;
      excuseReason?: string;
      note?: string;
    }> = [];

    consolidated.forEach(log => {
      if (log.isCancelled) return;
      if (log.programId && activeProgramIds.size > 0 && !activeProgramIds.has(String(log.programId))) return;
      const normDate = normalizeShamsiDateStr(log.date);
      if (!normDate || !isDateInRange(normDate)) return;
      if (isDateOfficialHoliday(normDate, log.grade, academicHolidays)) return;
      if (!Array.isArray(log.students)) return;

      const myRec = log.students.find(st =>
        belongsToMe({
          studentId: st.studentId,
          nationalId: st.nationalId,
          studentName: st.studentName
        })
      );
      if (!myRec) return;

      const classified = classifyAttendanceRecord(myRec, attendanceRules);
      if (classified.effectiveStatus === 'present') presentCount++;
      else if (classified.effectiveStatus === 'absent') {
        directAbsentCount++;
        if (classified.lateConvertedToAbsence) lateOverLimitAsAbsenceCount++;
      } else if (classified.effectiveStatus === 'excused') excusedCount++;
      else if (classified.effectiveStatus === 'late') {
        lateCount++;
        lateMinutesTotal += classified.countedLateMinutes;
      } else {
        unspecifiedCount++;
      }

      if (classified.ignoredLate) ignoredLateCount++;

      sessions.push({
        date: normDate,
        programTitle: log.programTitle || 'کلاس درسی',
        rawStatus: myRec.status || 'unspecified',
        effectiveStatus: classified.effectiveStatus,
        lateMinutes: myRec.lateMinutes,
        ignoredLate: classified.ignoredLate,
        lateConvertedToAbsence: classified.lateConvertedToAbsence,
        excuseReason: myRec.excuseReason,
        note: myRec.note
      });
    });

    const lateConvertedAbsences = computeLateConvertedAbsences(lateCount, attendanceRules);
    const effectiveAbsentCount = directAbsentCount + lateConvertedAbsences;
    sessions.sort((a, b) => compareShamsi(b.date, a.date));

    return {
      presentCount,
      directAbsentCount,
      lateConvertedAbsences,
      effectiveAbsentCount,
      excusedCount,
      lateCount,
      lateMinutesTotal,
      unspecifiedCount,
      ignoredLateCount,
      lateOverLimitAsAbsenceCount,
      totalSessions: sessions.length,
      sessions
    };
  }, [attendanceLogs, programs, academicHolidays, isDateInRange, belongsToMe, attendanceRules]);

  // =========================================================================
  // 2. Counseling Evaluations (Participation + Research/Taqrir Breakdown)
  // =========================================================================
  const counselingStats = useMemo(() => {
    const dedup = new Map<string, CounselingSessionGrade & { normDate: string }>();

    counselingGrades.forEach(g => {
      if (!g) return;
      if (
        !belongsToMe({
          studentId: g.studentId,
          nationalId: (g as any).nationalId,
          studentCode: (g as any).studentCode,
          studentName: g.studentName
        })
      ) {
        return;
      }

      const normDate = normalizeAnyDateToShamsi(g.sessionDate || (g as any).date || (g as any).session_date || g.createdAt);
      if (!normDate || !isDateInRange(normDate)) return;

      const progKey = String(g.programId || g.courseTitle || 'counseling').trim();
      const dedupKey = `${progKey}__${normDate}`;
      const existing = dedup.get(dedupKey);
      if (!existing) {
        dedup.set(dedupKey, { ...g, normDate });
      } else {
        const curTs = new Date(g.updatedAt || g.createdAt || 0).getTime();
        const prevTs = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        if (curTs >= prevTs) dedup.set(dedupKey, { ...g, normDate });
      }
    });

    const participation = { A: 0, B: 0, C: 0, D: 0, absent: 0 };
    const research = { A: 0, B: 0, C: 0, D: 0, noTask: 0 };

    const normalizeGradeVal = (val?: string | null) =>
      String(val || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim();

    const sessions = Array.from(dedup.values()).sort((a, b) => compareShamsi(b.normDate, a.normDate));

    sessions.forEach(s => {
      const pScore = normalizeGradeVal(s.participationScore);
      if (pScore === 'الف') participation.A++;
      else if (pScore === 'ب') participation.B++;
      else if (pScore === 'ج') participation.C++;
      else if (pScore === 'د') participation.D++;
      else if (pScore.includes('غیبت')) participation.absent++;

      const rScore = normalizeGradeVal(s.researchScore);
      if (rScore === 'الف') research.A++;
      else if (rScore === 'ب') research.B++;
      else if (rScore === 'ج') research.C++;
      else if (rScore === 'د') research.D++;
      else if (rScore.includes('عدم') || rScore.includes('تکلیف')) research.noTask++;
    });

    return {
      totalEvaluations: sessions.length,
      participation,
      research,
      sessions
    };
  }, [counselingGrades, belongsToMe, isDateInRange]);

  // =========================================================================
  // 3. Study Periods & Study Hours Stats
  // =========================================================================
  const studyStats = useMemo(() => {
    const validPeriods = (studyPeriods || []).filter(
      p => p && p.id && p.status !== 'deleted' && !p.isDeleted && !p.deletedAt
    );

    const overlappingPeriods = validPeriods
      .filter(p => {
        const pStart = normalizeShamsiDateStr(p.startDate);
        const pEnd = normalizeShamsiDateStr(p.endDate);
        return (!normEnd || pStart <= normEnd) && (!normStart || pEnd >= normStart);
      })
      .sort((a, b) => compareShamsi(b.startDate, a.startDate));

    const myDailyAll = (studyDailyEntries || []).filter(e =>
      belongsToMe({
        studentId: e.studentId,
        studentCode: e.studentCode,
        nationalId: e.nationalId,
        userId: e.userId,
        studentName: e.studentName
      })
    );

    const myLogsAll = (studyLogs || []).filter(l =>
      belongsToMe({
        studentId: l.studentId,
        studentCode: l.studentCode,
        nationalId: l.nationalId,
        studentName: l.studentName
      })
    );

    const getDailyEntryMinutes = (entry: StudyDailyEntry) => {
      if (typeof entry.totalMinutes === 'number' && entry.totalMinutes > 0) return entry.totalMinutes;
      let core = 0;
      if (Array.isArray(entry.coursesBreakdown) && entry.coursesBreakdown.length > 0) {
        entry.coursesBreakdown.forEach(c => {
          core += (c.studyMinutes || 0) + (c.discussionMinutes || 0);
        });
      } else {
        core += Math.round(((entry.studyHours || 0) + (entry.discussionHours || 0)) * 60);
      }
      return core + (entry.freeStudyMinutes || 0);
    };

    const getPeriodicLogMinutes = (log: PeriodicStudyLog) => {
      if (typeof log.totalMinutes === 'number' && log.totalMinutes > 0) return log.totalMinutes;
      const sum = (log.studyHours || 0) + (log.discussionHours || 0);
      if (sum > 0) return Math.round(sum * 60);
      return Math.round((log.hours || 0) * 60);
    };

    const periodBreakdowns: Array<{
      periodId: string;
      title: string;
      startDate: string;
      endDate: string;
      totalMinutes: number;
      coreStudyMinutes: number;
      coreDiscussionMinutes: number;
      freeStudyMinutes: number;
      mandatoryMinutes: number;
      isExempt: boolean;
      dailyEntriesCount: number;
    }> = [];

    let totalMinutesInRange = 0;
    let totalMandatoryMinutes = 0;
    const coveredPeriodIds = new Set<string>();

    overlappingPeriods.forEach(p => {
      coveredPeriodIds.add(p.id);
      const pDaily = myDailyAll.filter(e => e.periodId === p.id);
      const pLog = myLogsAll.find(l => l.periodId === p.id);

      const mandMins = p.mandatoryMinutes || Math.round((p.mandatoryHours || 0) * 60);

      let periodMins = 0;
      let coreStudy = 0;
      let coreDisc = 0;
      let freeMins = 0;

      if (pDaily.length > 0) {
        pDaily.forEach(e => {
          periodMins += getDailyEntryMinutes(e);
          if (Array.isArray(e.coursesBreakdown) && e.coursesBreakdown.length > 0) {
            e.coursesBreakdown.forEach(c => {
              coreStudy += c.studyMinutes || 0;
              coreDisc += c.discussionMinutes || 0;
            });
          } else {
            coreStudy += e.studyMinutes || Math.round((e.studyHours || 0) * 60);
            coreDisc += e.discussionMinutes || Math.round((e.discussionHours || 0) * 60);
          }
          freeMins += e.freeStudyMinutes || 0;
        });
      } else if (pLog) {
        periodMins = getPeriodicLogMinutes(pLog);
        coreStudy = pLog.coreStudyMinutes || Math.round((pLog.studyHours || 0) * 60);
        coreDisc = pLog.coreDiscussionMinutes || Math.round((pLog.discussionHours || 0) * 60);
        freeMins = pLog.freeStudyMinutes || 0;
      }

      const isExempt = Boolean(
        pLog?.isExempt ||
          (Array.isArray(p.exemptStudentIds) &&
            p.exemptStudentIds.some(id => studentIdentity.idSet.has(toEnglishDigits(String(id)).trim().toLowerCase())))
      );

      totalMinutesInRange += periodMins;
      if (!isExempt) totalMandatoryMinutes += mandMins;

      periodBreakdowns.push({
        periodId: p.id,
        title: p.title || 'دوره مطالعاتی',
        startDate: normalizeShamsiDateStr(p.startDate),
        endDate: normalizeShamsiDateStr(p.endDate),
        totalMinutes: periodMins,
        coreStudyMinutes: coreStudy,
        coreDiscussionMinutes: coreDisc,
        freeStudyMinutes: freeMins,
        mandatoryMinutes: mandMins,
        isExempt,
        dailyEntriesCount: pDaily.length
      });
    });

    // Include any standalone daily entries strictly inside [normStart, normEnd] whose period wasn't in overlappingPeriods
    const orphanDailyInRange = myDailyAll.filter(e => {
      if (e.periodId && coveredPeriodIds.has(e.periodId)) return false;
      const d = normalizeAnyDateToShamsi(e.entryDate || e.createdAt);
      return isDateInRange(d);
    });
    orphanDailyInRange.forEach(e => {
      totalMinutesInRange += getDailyEntryMinutes(e);
    });

    const dailyLogsInRange = myDailyAll
      .filter(e => {
        if (e.periodId && coveredPeriodIds.has(e.periodId)) return true;
        return isDateInRange(e.entryDate || e.createdAt);
      })
      .map(e => {
        const pObj = validPeriods.find(p => p.id === e.periodId);
        return {
          id: e.id,
          date: normalizeAnyDateToShamsi(e.entryDate || e.createdAt),
          periodTitle: pObj?.title || 'ثبت روزانه',
          minutes: getDailyEntryMinutes(e),
          freeMinutes: e.freeStudyMinutes || 0,
          note: e.note
        };
      })
      .sort((a, b) => compareShamsi(b.date, a.date));

    const recordedPeriodsCount = periodBreakdowns.filter(p => p.totalMinutes > 0).length;

    return {
      totalMinutes: totalMinutesInRange,
      totalMandatoryMinutes,
      overlappingPeriodsCount: periodBreakdowns.length,
      recordedPeriodsCount,
      periodBreakdowns,
      dailyLogsInRange
    };
  }, [studyPeriods, studyLogs, studyDailyEntries, normStart, normEnd, belongsToMe, studentIdentity.idSet, isDateInRange]);

  // =========================================================================
  // 4. Meals Stats (Lunch & Dinner Separately)
  // =========================================================================
  const mealStats = useMemo(() => {
    const periodMap = new Map<string, MealReservationPeriod>();
    (mealPeriods || []).forEach(mp => {
      if (mp?.id) periodMap.set(mp.id, mp);
    });

    const myRes = (mealReservations || []).filter(r =>
      belongsToMe({
        studentId: r.studentId,
        nationalId: r.nationalId,
        studentName: r.studentName
      })
    );

    const periodItems: Array<{
      id: string;
      periodTitle: string;
      startDate: string;
      endDate: string;
      lunches: number;
      dinners: number;
      dinnersInstitute: number;
      dinnersDormitory: number;
      lunchDays: string[];
      dinnerDays: string[];
      totalCost: number;
    }> = [];

    let totalLunches = 0;
    let totalDinners = 0;
    let totalDinnersInstitute = 0;
    let totalDinnersDormitory = 0;

    myRes.forEach(r => {
      const mp = periodMap.get(r.periodId);
      if (mp) {
        const pStart = normalizeShamsiDateStr(mp.startDate);
        const pEnd = normalizeShamsiDateStr(mp.endDate);
        const overlaps = (!normEnd || pStart <= normEnd) && (!normStart || pEnd >= normStart);
        if (!overlaps) return;
      } else {
        const upd = normalizeAnyDateToShamsi(r.updatedAt);
        if (upd && !isDateInRange(upd)) return;
      }

      const lunches = Number(r.totalCalculatedLunches || 0);
      const dinners = Number(r.totalCalculatedDinners || 0);
      const dinInst = Number(r.totalDinnersInstitute || (r.dinnerLocation === 'institute' ? dinners : 0));
      const dinDorm = Number(r.totalDinnersDormitory || (r.dinnerLocation === 'dormitory' ? dinners : 0));

      totalLunches += lunches;
      totalDinners += dinners;
      totalDinnersInstitute += dinInst;
      totalDinnersDormitory += dinDorm;

      periodItems.push({
        id: r.id,
        periodTitle: mp?.title || 'دوره رزرو تغذیه',
        startDate: mp ? normalizeShamsiDateStr(mp.startDate) : normalizeAnyDateToShamsi(r.updatedAt),
        endDate: mp ? normalizeShamsiDateStr(mp.endDate) : '',
        lunches,
        dinners,
        dinnersInstitute: dinInst,
        dinnersDormitory: dinDorm,
        lunchDays: Array.isArray(r.selectedLunchDays) ? r.selectedLunchDays : [],
        dinnerDays: Array.isArray(r.selectedDinnerDays) ? r.selectedDinnerDays : [],
        totalCost: Number(r.finalDeductionAmount || r.totalMealCost || 0)
      });
    });

    periodItems.sort((a, b) => compareShamsi(b.startDate, a.startDate));

    return {
      totalLunches,
      totalDinners,
      totalDinnersInstitute,
      totalDinnersDormitory,
      periodItems
    };
  }, [mealReservations, mealPeriods, normStart, normEnd, belongsToMe, isDateInRange]);

  // =========================================================================
  // 5. Oral Exams Stats
  // =========================================================================
  const oralExamStats = useMemo(() => {
    const periodMap = new Map<string, any>();
    (oralExamPeriods || []).forEach(p => {
      if (p?.id) periodMap.set(p.id, p);
    });

    const examsByKey = new Map<string, OralExam & { normDate: string }>();

    // Primary source: oral_exams
    (oralExams || []).forEach(ex => {
      if (!ex) return;
      if (!belongsToMe({ studentId: ex.studentId, nationalId: (ex as any).nationalId, studentName: (ex as any).studentName })) {
        return;
      }
      const normDate = normalizeAnyDateToShamsi(ex.date || ex.createdAt);
      if (!normDate || !isDateInRange(normDate)) return;

      const key = ex.id || `${ex.periodId || ex.title}_${ex.subjectType}_${normDate}`;
      examsByKey.set(key, { ...ex, normDate });
    });

    // Secondary fallback: oral_exam_records (in case a record wasn't mirrored into oral_exams yet)
    (oralExamRecords || []).forEach(rec => {
      if (!rec) return;
      if (!belongsToMe({ studentId: rec.studentId, nationalId: rec.nationalId, studentName: rec.studentName })) {
        return;
      }
      const pObj = periodMap.get(rec.periodId);
      const normDate = normalizeAnyDateToShamsi(rec.examDate || pObj?.examDate || pObj?.date || rec.updatedAt || rec.createdAt);
      if (!normDate || !isDateInRange(normDate)) return;

      if (typeof rec.fiqhScore === 'number') {
        const fiqhId = `oe_${rec.periodId}_${rec.studentId}_fiqh`;
        if (!examsByKey.has(fiqhId)) {
          examsByKey.set(fiqhId, {
            id: fiqhId,
            studentId: rec.studentId,
            title: `امتحان شفاهی فقه${pObj?.title ? ` - ${pObj.title}` : ''}`,
            subjectType: 'فقه',
            score: rec.fiqhScore,
            examinerName: rec.fiqhExaminerTeacherName || 'استاد ممتحن فقه',
            date: normDate,
            normDate,
            isRetake: Boolean(rec.fiqhIsRetake),
            periodId: rec.periodId,
            periodTitle: pObj?.title,
            scopeTitle: [rec.fiqhMainScopeTitle, rec.fiqhSubScopeTitle, rec.fiqhPages].filter(Boolean).join(' - '),
            examinerNotes: rec.fiqhExaminerNotes || rec.examinerNotes,
            createdAt: rec.createdAt || ''
          });
        }
      }

      if (typeof rec.usulScore === 'number') {
        const usulId = `oe_${rec.periodId}_${rec.studentId}_usul`;
        if (!examsByKey.has(usulId)) {
          examsByKey.set(usulId, {
            id: usulId,
            studentId: rec.studentId,
            title: `امتحان شفاهی اصول${pObj?.title ? ` - ${pObj.title}` : ''}`,
            subjectType: 'اصول',
            score: rec.usulScore,
            examinerName: rec.usulExaminerTeacherName || 'استاد ممتحن اصول',
            date: normDate,
            normDate,
            isRetake: Boolean(rec.usulIsRetake),
            periodId: rec.periodId,
            periodTitle: pObj?.title,
            scopeTitle: [rec.usulMainScopeTitle, rec.usulSubScopeTitle, rec.usulPages].filter(Boolean).join(' - '),
            examinerNotes: rec.usulExaminerNotes || rec.examinerNotes,
            createdAt: rec.createdAt || ''
          });
        }
      }
    });

    const list = Array.from(examsByKey.values()).sort((a, b) => compareShamsi(b.normDate, a.normDate));
    const numericScores = list
      .map(e => (typeof e.score === 'number' ? e.score : parseFloat(String(e.score))))
      .filter(n => !Number.isNaN(n));
    const averageScore =
      numericScores.length > 0
        ? (numericScores.reduce((a, b) => a + b, 0) / numericScores.length).toFixed(2)
        : null;

    return {
      count: list.length,
      averageScore,
      exams: list
    };
  }, [oralExams, oralExamRecords, oralExamPeriods, belongsToMe, isDateInRange]);

  // =========================================================================
  // 6. Definitive Warnings — Strictly Separated into Attendance vs Study
  // =========================================================================
  const warningsStats = useMemo(() => {
    const periodById = new Map<string, StudyPeriod>();
    (studyPeriods || []).forEach(p => {
      if (p?.id) periodById.set(p.id, p);
    });

    const attendanceWarningsAll: UnifiedDefinitiveWarning[] = [];
    const studyWarningsAll: UnifiedDefinitiveWarning[] = [];
    const seenAttKeys = new Set<string>();
    const seenStudyKeys = new Set<string>();

    // 1. Definitive (approved) warnings from workflow_items
    (workflowItems || []).forEach(w => {
      if (!w) return;
      // Only definitive approved warnings (exclude rejected, pending, and formal letter print logs)
      if (w.status !== 'approved') return;
      if (w.details?.isFormalNoticeLetter) return;
      if (
        !belongsToMe({
          studentId: w.studentId,
          nationalId: w.nationalId,
          studentName: w.studentName
        })
      ) {
        return;
      }

      const isStudyWarn =
        w.category === 'study_deficit_warning' ||
        (w.category !== 'unexcused_absence_warning' &&
          ((w.title && (w.title.includes('مطالعه') || w.title.includes('کسری'))) ||
            (w.description && w.description.includes('ساعت مطالعه'))));

      const isAttWarn =
        !isStudyWarn &&
        (w.category === 'unexcused_absence_warning' ||
          (w.title && w.title.includes('اخطار') && (w.title.includes('غیبت') || w.title.includes('حضور'))));

      if (isAttWarn) {
        const warnDate =
          normalizeAnyDateToShamsi(w.details?.date || w.details?.issuedDateShamsi) ||
          normalizeAnyDateToShamsi(w.approvedAt || w.createdAt);
        const progRef = String(w.details?.programId || w.details?.programTitle || '').trim();
        const dedupKey = warnDate && progRef ? `sess_${progRef}_${warnDate}` : `wf_${w.id}`;
        if (seenAttKeys.has(dedupKey)) return;
        seenAttKeys.add(dedupKey);
        if (w.details?.programTitle && warnDate) {
          seenAttKeys.add(`sess_${String(w.details.programTitle).trim()}_${warnDate}`);
        }

        attendanceWarningsAll.push({
          id: w.id,
          category: 'attendance',
          dateShamsi: warnDate,
          title: w.title || 'اخطار آموزشی حضور و غیاب',
          description: w.details?.reason || w.description || 'ثبت اخطار قطعی حضور و غیاب',
          courseOrPeriodTitle: w.details?.programTitle || 'کلاس درسی',
          issuerName: w.approvedByName || w.createdByName,
          absentCount: w.details?.absentCount,
          inRange: isDateInRange(warnDate)
        });
      } else if (isStudyWarn) {
        const linkedPeriodId = w.periodId || w.details?.periodId;
        const periodObj = linkedPeriodId ? periodById.get(linkedPeriodId) : undefined;
        const warnDate =
          normalizeAnyDateToShamsi(periodObj?.endDate || periodObj?.startDate) ||
          normalizeAnyDateToShamsi(w.approvedAt || w.createdAt);

        const studyKey = linkedPeriodId ? `study_${linkedPeriodId}` : `wf_${w.id}`;
        if (seenStudyKeys.has(studyKey)) return;
        seenStudyKeys.add(studyKey);

        studyWarningsAll.push({
          id: w.id,
          category: 'study',
          dateShamsi: warnDate,
          title: w.title || 'اخطار کسری ساعت مطالعه',
          description: w.description || 'ثبت اخطار قطعی مطالعاتی',
          courseOrPeriodTitle: w.periodTitle || w.details?.periodTitle || periodObj?.title || 'دوره مطالعاتی',
          issuerName: w.approvedByName || w.createdByName,
          deficitMinutes:
            w.details?.deficitMinutes || (w.details?.deficitHours ? Math.round(w.details.deficitHours * 60) : undefined),
          inRange: isDateInRange(warnDate)
        });
      }
    });

    // 2. Session-level definitive attendance warnings (hasEducationalWarning) in attendance logs
    const consolidatedLogs = consolidateAttendanceLogs(attendanceLogs);
    consolidatedLogs.forEach(rec => {
      if (rec.isCancelled || !Array.isArray(rec.students)) return;
      const normDate = normalizeShamsiDateStr(rec.date);
      if (!normDate || isDateOfficialHoliday(normDate, rec.grade, academicHolidays)) return;

      rec.students.forEach(stItem => {
        if (!stItem.hasEducationalWarning) return;
        if (
          !belongsToMe({
            studentId: stItem.studentId,
            nationalId: stItem.nationalId,
            studentName: stItem.studentName
          })
        ) {
          return;
        }

        const byIdKey = `sess_${rec.programId}_${normDate}`;
        const byTitleKey = `sess_${String(rec.programTitle || '').trim()}_${normDate}`;
        if (seenAttKeys.has(byIdKey) || seenAttKeys.has(byTitleKey)) return;
        seenAttKeys.add(byIdKey);

        attendanceWarningsAll.push({
          id: `att_log_${rec.id}`,
          category: 'attendance',
          dateShamsi: normDate,
          title: `اخطار آموزشی حضور و غیاب (${rec.programTitle || 'کلاس درسی'})`,
          description: stItem.note || 'ثبت اخطار قطعی در لیست حضور و غیاب جلسه',
          courseOrPeriodTitle: rec.programTitle || 'کلاس درسی',
          issuerName: stItem.warningRegisteredBy || rec.recordedByName,
          inRange: isDateInRange(normDate)
        });
      });
    });

    attendanceWarningsAll.sort((a, b) => compareShamsi(b.dateShamsi, a.dateShamsi));
    studyWarningsAll.sort((a, b) => compareShamsi(b.dateShamsi, a.dateShamsi));

    return {
      attendanceInRange: attendanceWarningsAll.filter(w => w.inRange),
      attendanceAllTime: attendanceWarningsAll,
      studyInRange: studyWarningsAll.filter(w => w.inRange),
      studyAllTime: studyWarningsAll
    };
  }, [workflowItems, attendanceLogs, studyPeriods, academicHolidays, belongsToMe, isDateInRange]);

  const formatAttendanceStatusLabel = (s: (typeof attendanceStats.sessions)[number]) => {
    if (s.effectiveStatus === 'present') {
      return s.ignoredLate ? `حاضر (تأخیر ${s.lateMinutes || 0}د بی‌اثر)` : 'حاضر';
    }
    if (s.effectiveStatus === 'absent') {
      return s.lateConvertedToAbsence ? `غیبت (تأخیر ${s.lateMinutes || 0}د بالای سقف)` : 'غیبت غیرموجه';
    }
    if (s.effectiveStatus === 'excused') return 'غیبت موجه';
    if (s.effectiveStatus === 'late') return `تأخیر (${s.lateMinutes || 0} دقیقه)`;
    return 'نامشخص';
  };

  const renderGradeBadge = (label: string, count: number, tone: 'emerald' | 'sky' | 'amber' | 'rose' | 'slate') => {
    const toneCls = {
      emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      sky: 'bg-sky-50 text-sky-800 border-sky-200',
      amber: 'bg-amber-50 text-amber-800 border-amber-200',
      rose: 'bg-rose-50 text-rose-800 border-rose-200',
      slate: 'bg-slate-100 text-slate-700 border-slate-200'
    }[tone];

    return (
      <div className={cn('rounded-xl border px-2 py-1.5 text-center', toneCls)}>
        <div className="text-[10px] font-bold opacity-85">{label}</div>
        <div className="text-sm font-black font-mono tabular-nums mt-0.5">{count}</div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center space-y-3 font-vazir" dir="rtl">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-bold text-slate-500">در حال آماده‌سازی گزارش عملکرد شخصی شما...</p>
      </div>
    );
  }

  const filteredAttendanceSessions = attendanceStats.sessions.filter(s => {
    if (attendanceFilter === 'all') return true;
    return s.effectiveStatus === attendanceFilter;
  });

  const activeAttWarningsList =
    warningsScope === 'range' ? warningsStats.attendanceInRange : warningsStats.attendanceAllTime;
  const activeStudyWarningsList =
    warningsScope === 'range' ? warningsStats.studyInRange : warningsStats.studyAllTime;

  return (
    <div className="space-y-5 font-vazir text-right pb-12" dir="rtl">
      {/* 1. Hero Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 shadow-lg border border-indigo-400/20">
        <div
          className="pointer-events-none absolute -top-20 -left-16 w-56 h-56 rounded-full opacity-25"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.55) 0%, transparent 70%)' }}
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
              <BarChart3 size={24} className="text-cyan-300" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-xl font-black tracking-tight text-white">
                  گزارش عملکرد من
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/35 text-emerald-200 text-[10px] font-bold">
                  <Lock size={11} />
                  <span>فقط مشاهده · اختصاصی شما</span>
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-indigo-200/90 leading-relaxed">
                (غیبت و تأخیر، ارزیابی کلاس‌های مشاوره، اخطارهای قطعی، مطالعه، آمار ناهار و شام، و آزمون‌های شفاهی)
              </p>
              <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px] text-slate-300 font-bold">
                <span className="px-2 py-0.5 rounded-lg bg-white/10 border border-white/10">
                  {studentIdentity.displayName}
                </span>
                {studentIdentity.grade && (
                  <span className="px-2 py-0.5 rounded-lg bg-white/10 border border-white/10">
                    {studentIdentity.grade}
                  </span>
                )}
                {studentIdentity.code && (
                  <span className="px-2 py-0.5 rounded-lg bg-white/10 border border-white/10 font-mono">
                    کد: {studentIdentity.code}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => syncFromCloudReadOnly(true)}
            disabled={isSyncing}
            className="self-start lg:self-center px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'در حال بروزرسانی...' : 'بروزرسانی آمار'}</span>
          </button>
        </div>
      </div>

      {/* 2. Date Range Filter Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
              <Calendar size={16} />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black text-slate-900">بازه زمانی گزارش عملکرد</h2>
              <p className="text-[10.5px] text-slate-500">
                بازه پیش‌فرض از بیست و یکم ماه قبل تا امروز تنظیم شده است؛ در صورت تمایل بازه دلخواه انتخاب کنید.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-600">از تاریخ:</span>
              <ShamsiDatePicker value={startDate} onChange={setStartDate} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-600">تا تاریخ:</span>
              <ShamsiDatePicker value={endDate} onChange={setEndDate} />
            </div>
          </div>
        </div>

        {/* Quick Preset Chips */}
        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100 text-[11px]">
          <span className="text-slate-400 font-bold ml-1">بازه‌های سریع:</span>
          <button
            type="button"
            onClick={() => {
              setStartDate(defaultRange.prevMonth21);
              setEndDate(defaultRange.endDate);
            }}
            className={cn(
              'px-2.5 py-1 rounded-xl font-bold border transition-all cursor-pointer',
              startDate === defaultRange.prevMonth21 && endDate === defaultRange.endDate
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700'
            )}
          >
            ۲۱ ماه قبل تا امروز (پیش‌فرض)
          </button>
          <button
            type="button"
            onClick={() => {
              setStartDate(defaultRange.prevMonth21);
              setEndDate(defaultRange.cycle20);
            }}
            className={cn(
              'px-2.5 py-1 rounded-xl font-bold border transition-all cursor-pointer',
              startDate === defaultRange.prevMonth21 && endDate === defaultRange.cycle20
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700'
            )}
          >
            ۲۱ ماه قبل تا ۲۰ ماه ({defaultRange.prevMonth21} تا {defaultRange.cycle20})
          </button>
          <button
            type="button"
            onClick={() => {
              setStartDate(defaultRange.currentMonthStart);
              setEndDate(defaultRange.endDate);
            }}
            className={cn(
              'px-2.5 py-1 rounded-xl font-bold border transition-all cursor-pointer',
              startDate === defaultRange.currentMonthStart && endDate === defaultRange.endDate
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700'
            )}
          >
            ماه جاری
          </button>
          <button
            type="button"
            onClick={() => {
              setStartDate(defaultRange.academicYearStart);
              setEndDate(defaultRange.endDate);
            }}
            className={cn(
              'px-2.5 py-1 rounded-xl font-bold border transition-all cursor-pointer',
              startDate === defaultRange.academicYearStart && endDate === defaultRange.endDate
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700'
            )}
          >
            کل سال تحصیلی
          </button>
        </div>
      </div>

      {/* 3. Main Performance Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CARD 1: Attendance & Tardiness */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">غیبت و تأخیر (حضور و غیاب)</h3>
                  <p className="text-[10.5px] text-slate-500">
                    از مجموع {attendanceStats.totalSessions} جلسه ثبت‌شده در این بازه
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAttendanceFilter('all');
                  setActiveDetailModal('attendance');
                }}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              >
                <Eye size={13} />
                <span>جزئیات</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-2xl bg-rose-50/80 border border-rose-200 p-3 text-center">
                <span className="text-[10.5px] font-bold text-rose-700 block">غیبت غیرموجه</span>
                <span className="text-xl font-black font-mono text-rose-700 tabular-nums mt-0.5 block">
                  {attendanceStats.effectiveAbsentCount}
                </span>
                {attendanceStats.lateConvertedAbsences > 0 && (
                  <span className="text-[9.5px] font-bold text-amber-800 block mt-0.5">
                    شامل +{attendanceStats.lateConvertedAbsences} از تأخیر
                  </span>
                )}
              </div>

              <div className="rounded-2xl bg-amber-50/80 border border-amber-200 p-3 text-center">
                <span className="text-[10.5px] font-bold text-amber-800 block">تأخیر معتبر</span>
                <span className="text-xl font-black font-mono text-amber-700 tabular-nums mt-0.5 block">
                  {attendanceStats.lateCount}
                </span>
                <span className="text-[9.5px] font-bold text-amber-700/80 block mt-0.5 font-mono">
                  {attendanceStats.lateMinutesTotal > 0 ? `${attendanceStats.lateMinutesTotal} دقیقه` : '۰ دقیقه'}
                </span>
              </div>

              <div className="rounded-2xl bg-indigo-50/80 border border-indigo-200 p-3 text-center">
                <span className="text-[10.5px] font-bold text-indigo-700 block">غیبت موجه</span>
                <span className="text-xl font-black font-mono text-indigo-700 tabular-nums mt-0.5 block">
                  {attendanceStats.excusedCount}
                </span>
              </div>

              <div className="rounded-2xl bg-emerald-50/80 border border-emerald-200 p-3 text-center">
                <span className="text-[10.5px] font-bold text-emerald-700 block">حاضر</span>
                <span className="text-xl font-black font-mono text-emerald-700 tabular-nums mt-0.5 block">
                  {attendanceStats.presentCount}
                </span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>ضوابط فعال:</span>
            <span>تاخیر زیر {attendanceRules.minLateMinutes} دقیقه بی‌اثر</span>
            {attendanceRules.maxLateAsAbsenceMinutes > 0 && (
              <span>• بالای {attendanceRules.maxLateAsAbsenceMinutes} دقیقه = غیبت</span>
            )}
            {attendanceRules.latesPerAbsence > 0 && (
              <span>• هر {attendanceRules.latesPerAbsence} تاخیر = ۱ غیبت</span>
            )}
          </div>
        </div>

        {/* CARD 2: Counseling Class Evaluations */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center shrink-0">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">ارزیابی کلاس‌های مشاوره</h3>
                  <p className="text-[10.5px] text-slate-500">
                    مجموع {counselingStats.totalEvaluations} جلسه ارزیابی ثبت‌شده در بازه
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveDetailModal('counseling')}
                className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              >
                <Eye size={13} />
                <span>جزئیات</span>
              </button>
            </div>

            {/* Sub-row A: Participation & Class Presence */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-black text-slate-700 flex items-center justify-between">
                <span>فعالیت و حضور در کلاس:</span>
                {counselingStats.participation.absent > 0 && (
                  <span className="text-[10px] font-bold text-rose-600">
                    غیبت در ارزیابی: {counselingStats.participation.absent}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {renderGradeBadge('الف', counselingStats.participation.A, 'emerald')}
                {renderGradeBadge('ب', counselingStats.participation.B, 'sky')}
                {renderGradeBadge('ج', counselingStats.participation.C, 'amber')}
                {renderGradeBadge('د', counselingStats.participation.D, 'rose')}
              </div>
            </div>

            {/* Sub-row B: Research & Taqrir */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="text-[11px] font-black text-slate-700">فعالیت پژوهش و تقریر:</div>
              <div className="grid grid-cols-5 gap-1.5">
                {renderGradeBadge('الف', counselingStats.research.A, 'emerald')}
                {renderGradeBadge('ب', counselingStats.research.B, 'sky')}
                {renderGradeBadge('ج', counselingStats.research.C, 'amber')}
                {renderGradeBadge('د', counselingStats.research.D, 'rose')}
                {renderGradeBadge('عدم تکلیف', counselingStats.research.noTask, 'slate')}
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3 (SEPARATE): Definitive Attendance Warnings */}
        <div className="bg-white rounded-3xl border border-rose-200/80 shadow-2xs p-5 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">اخطارهای قطعی حضور و غیابی</h3>
                <p className="text-[10.5px] text-slate-500 mt-0.5">
                  صرفاً اخطارهای قطعی ثبت‌شده در پرونده حضور و غیاب شما
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setWarningsScope(warningsStats.attendanceInRange.length > 0 ? 'range' : 'all_time');
                setActiveDetailModal('attendance_warnings');
              }}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors shrink-0"
            >
              <Eye size={13} />
              <span>جزئیات</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-rose-50/70 border border-rose-200 p-3 text-center">
              <span className="text-[10.5px] font-bold text-rose-800 block">تعداد در بازه انتخابی</span>
              <span className="text-2xl font-black font-mono text-rose-700 tabular-nums mt-0.5 block">
                {warningsStats.attendanceInRange.length}
              </span>
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-center">
              <span className="text-[10.5px] font-bold text-slate-600 block">کل اخطارهای حضور و غیابی</span>
              <span className="text-2xl font-black font-mono text-slate-800 tabular-nums mt-0.5 block">
                {warningsStats.attendanceAllTime.length}
              </span>
            </div>
          </div>
        </div>

        {/* CARD 4 (SEPARATE): Definitive Study Warnings */}
        <div className="bg-white rounded-3xl border border-amber-200/80 shadow-2xs p-5 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">اخطارهای قطعی مطالعاتی</h3>
                <p className="text-[10.5px] text-slate-500 mt-0.5">
                  صرفاً اخطارهای قطعی ثبت‌شده بابت دوره‌های مطالعاتی شما
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setWarningsScope(warningsStats.studyInRange.length > 0 ? 'range' : 'all_time');
                setActiveDetailModal('study_warnings');
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors shrink-0"
            >
              <Eye size={13} />
              <span>جزئیات</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-amber-50/70 border border-amber-200 p-3 text-center">
              <span className="text-[10.5px] font-bold text-amber-800 block">تعداد در بازه انتخابی</span>
              <span className="text-2xl font-black font-mono text-amber-700 tabular-nums mt-0.5 block">
                {warningsStats.studyInRange.length}
              </span>
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-center">
              <span className="text-[10.5px] font-bold text-slate-600 block">کل اخطارهای مطالعاتی</span>
              <span className="text-2xl font-black font-mono text-slate-800 tabular-nums mt-0.5 block">
                {warningsStats.studyAllTime.length}
              </span>
            </div>
          </div>
        </div>

        {/* CARD 5: Study Periods & Hours */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between gap-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-700 border border-sky-200 flex items-center justify-center shrink-0">
                <BookOpen size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">آمار مطالعه و دوره‌های مطالعاتی</h3>
                <p className="text-[10.5px] text-slate-500">
                  مجموع کارکرد ثبت‌شده شما در دوره‌های مطالعاتی این بازه
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveDetailModal('study')}
              className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors shrink-0"
            >
              <Eye size={13} />
              <span>جزئیات</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-sky-50/80 border border-sky-200 p-3 text-center">
              <span className="text-[10px] font-bold text-sky-800 block">مجموع مطالعه</span>
              <span className="text-sm sm:text-base font-black text-sky-900 mt-1 block">
                {formatMinutesFa(studyStats.totalMinutes)}
              </span>
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-center">
              <span className="text-[10px] font-bold text-slate-600 block">دوره‌های بازه</span>
              <span className="text-lg font-black font-mono text-slate-800 mt-0.5 block">
                {studyStats.overlappingPeriodsCount} دوره
              </span>
              <span className="text-[9.5px] text-slate-500 block">
                ({studyStats.recordedPeriodsCount} دوره ثبت‌شده)
              </span>
            </div>
            <div className="rounded-2xl bg-indigo-50/70 border border-indigo-200 p-3 text-center">
              <span className="text-[10px] font-bold text-indigo-800 block">موظفی دوره‌ها</span>
              <span className="text-sm sm:text-base font-black text-indigo-900 mt-1 block">
                {studyStats.totalMandatoryMinutes > 0 ? formatMinutesFa(studyStats.totalMandatoryMinutes) : '---'}
              </span>
            </div>
          </div>
        </div>

        {/* CARD 6: Meals (Lunch & Dinner) */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between gap-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-700 border border-orange-200 flex items-center justify-center shrink-0">
                <Utensils size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">آمار ناهار و شام (تغذیه)</h3>
                <p className="text-[10.5px] text-slate-500">
                  مجموع وعده‌های رزروشده شما به تفکیک ناهار و شام در این بازه
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveDetailModal('meals')}
              className="px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors shrink-0"
            >
              <Eye size={13} />
              <span>جزئیات</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-amber-50/80 border border-amber-200 p-3.5 text-center">
              <span className="text-[11px] font-bold text-amber-800 block">مجموع وعده‌های ناهار</span>
              <span className="text-2xl font-black font-mono text-amber-700 tabular-nums mt-1 block">
                {mealStats.totalLunches} <span className="text-xs font-bold">وعده</span>
              </span>
            </div>
            <div className="rounded-2xl bg-orange-50/80 border border-orange-200 p-3.5 text-center">
              <span className="text-[11px] font-bold text-orange-800 block">مجموع وعده‌های شام</span>
              <span className="text-2xl font-black font-mono text-orange-700 tabular-nums mt-1 block">
                {mealStats.totalDinners} <span className="text-xs font-bold">وعده</span>
              </span>
              {(mealStats.totalDinnersInstitute > 0 || mealStats.totalDinnersDormitory > 0) && (
                <span className="text-[9.5px] text-orange-700/80 font-bold block mt-0.5">
                  موسسه: {mealStats.totalDinnersInstitute} · خوابگاه: {mealStats.totalDinnersDormitory}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CARD 7 (Full Width): Oral Exams in Selected Range */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-5 space-y-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center shrink-0">
              <Award size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">امتحان‌های شفاهی در این بازه</h3>
              <p className="text-[10.5px] text-slate-500">
                نمرات امتحان‌های شفاهی ثبت‌شده برای شما از {startDate} تا {endDate}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveDetailModal('oral_exams')}
            className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors shrink-0"
          >
            <Eye size={13} />
            <span>جزئیات</span>
          </button>
        </div>

        {oralExamStats.count === 0 ? (
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-center text-xs text-slate-500 font-bold">
            در این بازه زمانی امتحان شفاهی برای شما ثبت نشده است.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-2xl bg-teal-50/80 border border-teal-200 p-3 text-center">
                <span className="text-[10.5px] font-bold text-teal-800 block">تعداد آزمون‌ها</span>
                <span className="text-xl font-black font-mono text-teal-700 mt-0.5 block">
                  {oralExamStats.count} آزمون
                </span>
              </div>
              <div className="rounded-2xl bg-emerald-50/80 border border-emerald-200 p-3 text-center">
                <span className="text-[10.5px] font-bold text-emerald-800 block">میانگین نمرات</span>
                <span className="text-xl font-black font-mono text-emerald-700 mt-0.5 block">
                  {oralExamStats.averageScore ?? '---'} <span className="text-[10px]">از ۲۰</span>
                </span>
              </div>
              <div className="col-span-2 rounded-2xl bg-slate-50 border border-slate-200 p-3 flex items-center gap-2 flex-wrap">
                {oralExamStats.exams.slice(0, 4).map(ex => (
                  <span
                    key={ex.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-[11px] font-bold text-slate-800"
                  >
                    <span>{ex.subjectType || ex.title}</span>
                    <span className="font-mono font-black text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded-md">
                      {ex.score}
                    </span>
                  </span>
                ))}
                {oralExamStats.exams.length > 4 && (
                  <span className="text-[10.5px] text-slate-500 font-bold">
                    +{oralExamStats.exams.length - 4} مورد دیگر
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* DRILLDOWN DETAILS MODAL (Read-Only Detailed Breakdown for Every Card)     */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {activeDetailModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/55 backdrop-blur-xs font-vazir"
            dir="rtl"
            onClick={() => setActiveDetailModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.18 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    {activeDetailModal === 'attendance' && 'جزئیات جلسات حضور، غیبت و تأخیر شما'}
                    {activeDetailModal === 'counseling' && 'جزئیات ارزیابی کلاس‌های مشاوره شما'}
                    {activeDetailModal === 'study' && 'جزئیات دوره‌های مطالعاتی و ثبت‌های روزانه شما'}
                    {activeDetailModal === 'meals' && 'جزئیات آمار ناهار و شام شما'}
                    {activeDetailModal === 'oral_exams' && 'جزئیات امتحان‌های شفاهی شما'}
                    {activeDetailModal === 'attendance_warnings' && 'جزئیات اخطارهای قطعی حضور و غیابی شما'}
                    {activeDetailModal === 'study_warnings' && 'جزئیات اخطارهای قطعی مطالعاتی شما'}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                    بازه گزارش: {startDate} تا {endDate}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDetailModal(null)}
                  className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 cursor-pointer"
                  aria-label="بستن"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
                {/* 1. ATTENDANCE DETAILS */}
                {activeDetailModal === 'attendance' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Filter size={13} className="text-slate-400 ml-1" />
                      {(
                        [
                          { id: 'all', label: `همه (${attendanceStats.totalSessions})` },
                          { id: 'absent', label: `غیبت غیرموجه (${attendanceStats.directAbsentCount})` },
                          { id: 'late', label: `تأخیر (${attendanceStats.lateCount})` },
                          { id: 'excused', label: `موجه (${attendanceStats.excusedCount})` },
                          { id: 'present', label: `حاضر (${attendanceStats.presentCount})` }
                        ] as const
                      ).map(tab => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setAttendanceFilter(tab.id)}
                          className={cn(
                            'px-2.5 py-1 rounded-xl font-bold border text-[11px] cursor-pointer transition-colors',
                            attendanceFilter === tab.id
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-indigo-50'
                          )}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {attendanceStats.lateConvertedAbsences > 0 && (
                      <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold">
                        توجه: با توجه به ضابطه «هر {attendanceRules.latesPerAbsence} تأخیر = ۱ غیبت»، از مجموع {attendanceStats.lateCount} تأخیر معتبر شما در این بازه، معادل {attendanceStats.lateConvertedAbsences} غیبت غیرموجه به جمع غیبت‌ها اضافه شده است.
                      </div>
                    )}

                    {filteredAttendanceSessions.length === 0 ? (
                      <div className="py-10 text-center text-slate-400 font-bold">
                        موردی مطابق فیلتر انتخابی در این بازه ثبت نشده است.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredAttendanceSessions.map((sess, idx) => (
                          <div
                            key={`${sess.date}-${sess.programTitle}-${idx}`}
                            className="p-3 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div className="space-y-0.5">
                              <div className="font-black text-slate-900 text-xs">{sess.programTitle}</div>
                              <div className="text-[11px] text-slate-500 font-mono">تاریخ جلسه: {sess.date}</div>
                              {sess.excuseReason && (
                                <div className="text-[10.5px] text-indigo-700 font-bold">دلیل توجیه: {sess.excuseReason}</div>
                              )}
                              {sess.note && (
                                <div className="text-[10.5px] text-slate-600">توضیح: {sess.note}</div>
                              )}
                            </div>
                            <span
                              className={cn(
                                'self-start sm:self-center px-2.5 py-1 rounded-xl text-[11px] font-black border shrink-0',
                                sess.effectiveStatus === 'present'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : sess.effectiveStatus === 'absent'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : sess.effectiveStatus === 'excused'
                                  ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                  : sess.effectiveStatus === 'late'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              )}
                            >
                              {formatAttendanceStatusLabel(sess)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. COUNSELING EVALUATIONS DETAILS */}
                {activeDetailModal === 'counseling' && (
                  <div className="space-y-3">
                    {counselingStats.sessions.length === 0 ? (
                      <div className="py-10 text-center text-slate-400 font-bold">
                        در این بازه زمانی ارزیابی کلاس مشاوره‌ای برای شما ثبت نشده است.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {counselingStats.sessions.map(s => (
                          <div
                            key={s.id}
                            className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="font-black text-slate-900 text-xs">
                                  {s.courseTitle || 'کلاس مشاوره'}
                                </div>
                                <div className="text-[11px] text-slate-600 font-bold mt-0.5 flex items-center gap-2 flex-wrap">
                                  <span>استاد مشاور: {s.counselorTeacherName || '---'}</span>
                                  <span>•</span>
                                  <span className="font-mono text-slate-500">تاریخ: {s.normDate}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] font-black">
                                  فعالیت و حضور: {s.participationScore || 'ثبت‌نشده'}
                                </span>
                                <span className="px-2.5 py-1 rounded-xl bg-purple-50 text-purple-800 border border-purple-200 text-[11px] font-black">
                                  پژوهش و تقریر: {s.researchScore || 'ثبت‌نشده'}
                                </span>
                              </div>
                            </div>
                            {s.counselorFeedback && (
                              <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-700 flex items-start gap-1.5">
                                <MessageSquare size={13} className="text-purple-500 shrink-0 mt-0.5" />
                                <span>{s.counselorFeedback}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. ATTENDANCE WARNINGS DETAILS */}
                {activeDetailModal === 'attendance_warnings' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setWarningsScope('range')}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-[11px] font-bold border cursor-pointer',
                          warningsScope === 'range'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        )}
                      >
                        بازه انتخابی ({warningsStats.attendanceInRange.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setWarningsScope('all_time')}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-[11px] font-bold border cursor-pointer',
                          warningsScope === 'all_time'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        )}
                      >
                        کل سوابق قطعی ({warningsStats.attendanceAllTime.length})
                      </button>
                    </div>

                    {activeAttWarningsList.length === 0 ? (
                      <div className="py-10 text-center text-emerald-700 bg-emerald-50/50 rounded-2xl border border-emerald-100 font-bold">
                        هیچ اخطار قطعی حضور و غیابی در این محدوده برای شما ثبت نشده است.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {activeAttWarningsList.map(w => (
                          <div key={w.id} className="p-3.5 rounded-2xl border border-rose-200 bg-rose-50/40 space-y-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-black text-rose-900 text-xs">{w.title}</span>
                              <span className="px-2 py-0.5 rounded-lg bg-white border border-rose-200 text-rose-700 font-mono text-[11px] font-bold">
                                {w.dateShamsi || '---'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-700 leading-relaxed">{w.description}</p>
                            <div className="flex items-center gap-3 flex-wrap text-[10.5px] text-slate-500 font-bold pt-1">
                              <span>کلاس / درس: {w.courseOrPeriodTitle}</span>
                              {typeof w.absentCount === 'number' && <span>تعداد غیبت: {w.absentCount} جلسه</span>}
                              {w.issuerName && <span>صادرکننده: {w.issuerName}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. STUDY WARNINGS DETAILS */}
                {activeDetailModal === 'study_warnings' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setWarningsScope('range')}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-[11px] font-bold border cursor-pointer',
                          warningsScope === 'range'
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        )}
                      >
                        بازه انتخابی ({warningsStats.studyInRange.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setWarningsScope('all_time')}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-[11px] font-bold border cursor-pointer',
                          warningsScope === 'all_time'
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        )}
                      >
                        کل سوابق قطعی ({warningsStats.studyAllTime.length})
                      </button>
                    </div>

                    {activeStudyWarningsList.length === 0 ? (
                      <div className="py-10 text-center text-emerald-700 bg-emerald-50/50 rounded-2xl border border-emerald-100 font-bold">
                        هیچ اخطار قطعی مطالعاتی در این محدوده برای شما ثبت نشده است.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {activeStudyWarningsList.map(w => (
                          <div key={w.id} className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/40 space-y-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-black text-amber-950 text-xs">{w.title}</span>
                              <span className="px-2 py-0.5 rounded-lg bg-white border border-amber-200 text-amber-800 font-mono text-[11px] font-bold">
                                {w.dateShamsi || '---'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-700 leading-relaxed">{w.description}</p>
                            <div className="flex items-center gap-3 flex-wrap text-[10.5px] text-slate-500 font-bold pt-1">
                              <span>دوره مطالعاتی: {w.courseOrPeriodTitle}</span>
                              {typeof w.deficitMinutes === 'number' && w.deficitMinutes > 0 && (
                                <span className="text-rose-700">میزان کسری: {formatMinutesFa(w.deficitMinutes)}</span>
                              )}
                              {w.issuerName && <span>صادرکننده: {w.issuerName}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 5. STUDY DETAILS */}
                {activeDetailModal === 'study' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-slate-800">تفکیک دوره‌های مطالعاتی بازه</h4>
                      {studyStats.periodBreakdowns.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 font-bold bg-slate-50 rounded-2xl">
                          دوره مطالعاتی منطبق با این بازه زمانی یافت نشد.
                        </div>
                      ) : (
                        studyStats.periodBreakdowns.map(p => {
                          const pct =
                            p.mandatoryMinutes > 0
                              ? Math.min(100, Math.round((p.totalMinutes / p.mandatoryMinutes) * 100))
                              : 100;
                          return (
                            <div
                              key={p.periodId}
                              className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <div className="font-black text-slate-900">{p.title}</div>
                                  <div className="text-[10.5px] text-slate-500 font-mono">
                                    {p.startDate} تا {p.endDate}
                                  </div>
                                </div>
                                <div className="text-left">
                                  <span className="font-black text-sky-800 text-xs block">
                                    {formatMinutesFa(p.totalMinutes)}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-bold">
                                    {p.isExempt ? 'معاف از موظفی' : `از ${formatMinutesFa(p.mandatoryMinutes)} موظفی (${pct}٪)`}
                                  </span>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-[10.5px] pt-2 border-t border-slate-200/70 text-center">
                                <div className="bg-white rounded-xl p-1.5 border border-slate-200">
                                  <span className="text-slate-500 block">مطالعه دروس</span>
                                  <span className="font-bold text-slate-800">{formatMinutesFa(p.coreStudyMinutes)}</span>
                                </div>
                                <div className="bg-white rounded-xl p-1.5 border border-slate-200">
                                  <span className="text-slate-500 block">مباحثه</span>
                                  <span className="font-bold text-slate-800">{formatMinutesFa(p.coreDiscussionMinutes)}</span>
                                </div>
                                <div className="bg-white rounded-xl p-1.5 border border-slate-200">
                                  <span className="text-slate-500 block">مطالعه آزاد</span>
                                  <span className="font-bold text-slate-800">{formatMinutesFa(p.freeStudyMinutes)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {studyStats.dailyLogsInRange.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-black text-slate-800">
                          ریز ثبت‌های روزانه ({studyStats.dailyLogsInRange.length} مورد)
                        </h4>
                        <div className="space-y-1.5">
                          {studyStats.dailyLogsInRange.map(d => (
                            <div
                              key={d.id}
                              className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-2 text-[11px]"
                            >
                              <div>
                                <span className="font-bold text-slate-800">{d.periodTitle}</span>
                                <span className="text-slate-400 font-mono mr-2">({d.date || '---'})</span>
                                {d.note && <span className="block text-[10px] text-slate-500 mt-0.5">{d.note}</span>}
                              </div>
                              <span className="font-black text-sky-700 shrink-0">{formatMinutesFa(d.minutes)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 6. MEALS DETAILS */}
                {activeDetailModal === 'meals' && (
                  <div className="space-y-3">
                    {mealStats.periodItems.length === 0 ? (
                      <div className="py-10 text-center text-slate-400 font-bold">
                        رزرو ناهار یا شامی در این بازه زمانی برای شما ثبت نشده است.
                      </div>
                    ) : (
                      mealStats.periodItems.map(item => (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="font-black text-slate-900">{item.periodTitle}</div>
                              <div className="text-[10.5px] text-slate-500 font-mono">
                                {item.startDate} {item.endDate ? `تا ${item.endDate}` : ''}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 font-black text-[11px]">
                                ناهار: {item.lunches} وعده
                              </span>
                              <span className="px-2.5 py-1 rounded-xl bg-orange-50 text-orange-800 border border-orange-200 font-black text-[11px]">
                                شام: {item.dinners} وعده
                              </span>
                            </div>
                          </div>

                          {(item.lunchDays.length > 0 || item.dinnerDays.length > 0) && (
                            <div className="text-[10.5px] text-slate-600 space-y-1 pt-2 border-t border-slate-200/70">
                              {item.lunchDays.length > 0 && (
                                <div>
                                  <span className="font-bold text-slate-700">روزهای ناهار: </span>
                                  <span>{item.lunchDays.join('، ')}</span>
                                </div>
                              )}
                              {item.dinnerDays.length > 0 && (
                                <div>
                                  <span className="font-bold text-slate-700">روزهای شام: </span>
                                  <span>{item.dinnerDays.join('، ')}</span>
                                  {(item.dinnersInstitute > 0 || item.dinnersDormitory > 0) && (
                                    <span className="text-slate-500 mr-2">
                                      (موسسه: {item.dinnersInstitute} · خوابگاه: {item.dinnersDormitory})
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 7. ORAL EXAMS DETAILS */}
                {activeDetailModal === 'oral_exams' && (
                  <div className="space-y-3">
                    {oralExamStats.exams.length === 0 ? (
                      <div className="py-10 text-center text-slate-400 font-bold">
                        در این بازه زمانی امتحان شفاهی برای شما ثبت نشده است.
                      </div>
                    ) : (
                      oralExamStats.exams.map(ex => (
                        <div
                          key={ex.id}
                          className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <GraduationCap size={16} className="text-teal-600 shrink-0" />
                              <div>
                                <div className="font-black text-slate-900">{ex.title || `امتحان شفاهی ${ex.subjectType}`}</div>
                                <div className="text-[10.5px] text-slate-500 flex items-center gap-2 flex-wrap mt-0.5">
                                  <span>استاد ممتحن: {ex.examinerName || '---'}</span>
                                  <span>•</span>
                                  <span className="font-mono">تاریخ: {ex.normDate}</span>
                                  {ex.isRetake && (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                                      آزمون مجدد
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <span
                              className={cn(
                                'px-3 py-1 rounded-xl font-mono font-black text-sm border',
                                Number(ex.score) >= 17
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : Number(ex.score) >= 14
                                  ? 'bg-sky-50 text-sky-800 border-sky-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              )}
                            >
                              نمره: {ex.score} از ۲۰
                            </span>
                          </div>
                          {ex.scopeTitle && (
                            <div className="text-[11px] text-slate-600">
                              <span className="font-bold text-slate-700">محدوده آزمون: </span>
                              {ex.scopeTitle}
                            </div>
                          )}
                          {(ex.examinerNotes || ex.notes) && (
                            <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-700">
                              <span className="font-bold text-slate-800">ملاحظات استاد ممتحن: </span>
                              {ex.examinerNotes || ex.notes}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <span className="text-[10.5px] text-slate-500 font-bold flex items-center gap-1">
                  <Lock size={12} />
                  <span>این گزارش صرفاً جهت رویت عملکرد شخصی شماست.</span>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveDetailModal(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
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
};

export default StudentPerformanceReport;
