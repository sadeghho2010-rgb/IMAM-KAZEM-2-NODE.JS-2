import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  GraduationCap, 
  Calendar, 
  CalendarDays, 
  Clock, 
  BookOpen, 
  BookCheck, 
  CheckCircle2, 
  LogOut, 
  User, 
  ChevronDown, 
  Sparkles, 
  Save, 
  MessageSquare, 
  Award, 
  AlertCircle,
  Check,
  DoorOpen,
  Users,
  CalendarCheck,
  XCircle,
  HelpCircle,
  Info,
  RefreshCw,
  RotateCw,
  WifiOff,
  Layers,
  ArrowRightLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { localDb, CollectionName } from '../lib/localDb';
import { 
  Teacher, 
  Program, 
  Student, 
  Enrollment, 
  CounselingSessionGrade, 
  CounselingScore, 
  AcademicHolidayItem, 
  AcademicCalendarPeriod,
  TeacherManualSchedule
} from '../types';
import { 
  getTodayShamsi, 
  getShamsiDayOfWeekName, 
  compareShamsi, 
  parseShamsiDate, 
  formatShamsiDate, 
  generateShamsiDateRange,
  toPersianDigits,
  shamsiToDate,
  dateToShamsi
} from '../lib/jalali';
import { cn, getProgramDays } from '../lib/utils';
import { 
  normalizeTeacherName, 
  findMatchingTeacher, 
  isProgramAssignedToTeacher, 
  isManualScheduleAssignedToTeacher,
  isGradeMatch,
  normalizeGrade
} from '../lib/teacherMatching';

export default function TeacherPortal() {
  const { currentUser, logout } = useAuth();

  // Initial detection if user is related to counseling to default immediately to counseling tab
  const initialCounselingHint = Boolean(
    (currentUser as any)?.canEditCounseling ||
    (currentUser as any)?.canViewCounseling ||
    currentUser?.roleTitle?.includes('مشاوره') ||
    currentUser?.fullName?.includes('مشاور') ||
    currentUser?.name?.includes('مشاور')
  );

  // Active Mobile View Tab (Defaults directly to 'counseling' so teachers immediately see counseling & evaluations)
  const [activeTab, setActiveTab] = useState<'schedule' | 'counseling' | 'calendar'>('counseling');

  // Flag to track whether initial auto-direction to counseling was performed
  const [hasAutoDirected, setHasAutoDirected] = useState<boolean>(true);

  // Database Data States
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [manualSchedules, setManualSchedules] = useState<TeacherManualSchedule[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [grades, setGrades] = useState<CounselingSessionGrade[]>([]);
  const [holidays, setHolidays] = useState<AcademicHolidayItem[]>([]);
  const [periods, setPeriods] = useState<AcademicCalendarPeriod[]>([]);

  // Loading, Sync, and Error States (Three-State UI Pattern)
  const [loadingState, setLoadingState] = useState<'loading' | 'error' | 'success'>('success');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isSavingAll, setIsSavingAll] = useState<boolean>(false);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

  // Counseling Evaluation State
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedSessionDate, setSelectedSessionDate] = useState<string>('');
  const [teacherNotesMap, setTeacherNotesMap] = useState<Record<string, string>>({});
  const [feedbackSavedStudentId, setFeedbackSavedStudentId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Helper to read local database cache directly into React state
  const loadLocalCachedData = useCallback(async () => {
    try {
      const [
        storedTeachers, 
        storedPrograms, 
        storedManual,
        storedStudents, 
        storedEnrollments, 
        storedGrades,
        storedHolidays,
        storedPeriods
      ] = await Promise.all([
        localDb.getDocs<Teacher>('teachers'),
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<TeacherManualSchedule>('teacher_schedules'),
        localDb.getDocs<Student>('students'),
        localDb.getDocs<Enrollment>('enrollments'),
        localDb.getDocs<CounselingSessionGrade>('counseling_session_grades'),
        localDb.getDocs<AcademicHolidayItem>('academic_holidays'),
        localDb.getDocs<AcademicCalendarPeriod>('academic_calendar_periods')
      ]);

      if (storedTeachers && storedTeachers.length > 0) setTeachers(storedTeachers);
      if (storedPrograms && storedPrograms.length > 0) setPrograms(storedPrograms);
      if (storedManual && storedManual.length > 0) setManualSchedules(storedManual);
      if (storedStudents && storedStudents.length > 0) {
        setStudents(storedStudents.filter(s => s.isActive !== false));
      }
      if (storedEnrollments) setEnrollments(storedEnrollments);
      if (storedGrades) setGrades(storedGrades);
      if (storedHolidays) setHolidays(storedHolidays);
      if (storedPeriods) setPeriods(storedPeriods);
      setLoadingState('success');
    } catch (e) {
      console.warn('Error reading local cache:', e);
      setLoadingState('success');
    }
  }, []);

  /**
   * Eager Cloud Hydration: Non-blocking background sync from server / Supabase.
   * Never hangs or freezes the user interface.
   */
  const syncPortalData = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setIsSyncing(true);
      }
      setSyncErrorMessage(null);

      // 1. Immediately populate from local cache so UI is interactive in 0ms
      await loadLocalCachedData();

      // 2. Proactively hydrate key collections from Server / Cloud
      const coreCollections: CollectionName[] = [
        'teachers',
        'programs',
        'teacher_schedules',
        'students',
        'enrollments',
        'counseling_session_grades',
        'academic_holidays',
        'academic_calendar_periods'
      ];

      const syncPromise = Promise.allSettled(
        coreCollections.map(col => localDb.syncCollectionFromCloud(col))
      );
      const syncTimeout = new Promise(resolve => setTimeout(resolve, 3500));

      await Promise.race([syncPromise, syncTimeout]);

      // 3. Re-read freshly hydrated records
      const [
        storedTeachers, 
        storedPrograms, 
        storedManual,
        storedStudents, 
        storedEnrollments, 
        storedGrades,
        storedHolidays,
        storedPeriods
      ] = await Promise.all([
        localDb.getDocs<Teacher>('teachers'),
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<TeacherManualSchedule>('teacher_schedules'),
        localDb.getDocs<Student>('students'),
        localDb.getDocs<Enrollment>('enrollments'),
        localDb.getDocs<CounselingSessionGrade>('counseling_session_grades'),
        localDb.getDocs<AcademicHolidayItem>('academic_holidays'),
        localDb.getDocs<AcademicCalendarPeriod>('academic_calendar_periods')
      ]);

      setTeachers(storedTeachers || []);
      setPrograms(storedPrograms || []);
      setManualSchedules(storedManual || []);
      setStudents((storedStudents || []).filter(s => s.isActive !== false));
      setEnrollments(storedEnrollments || []);
      setGrades(storedGrades || []);
      setHolidays(storedHolidays || []);
      setPeriods(storedPeriods || []);

      setLoadingState('success');
      if (isManualRefresh) {
        showToast('اطلاعات برنامه و ارزیابی‌ها با موفقیت بروزرسانی شد.');
      }
    } catch (err: any) {
      console.error('Error hydrating teacher portal data:', err);
      // Gracefully fall back to local data without blocking
      setLoadingState('success');
    } finally {
      setIsSyncing(false);
    }
  }, [loadLocalCachedData]);

  // Initial load and live database listener
  useEffect(() => {
    syncPortalData();
    const unsub = localDb.subscribe(() => {
      Promise.all([
        localDb.getDocs<Teacher>('teachers'),
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<TeacherManualSchedule>('teacher_schedules'),
        localDb.getDocs<Student>('students'),
        localDb.getDocs<Enrollment>('enrollments'),
        localDb.getDocs<CounselingSessionGrade>('counseling_session_grades'),
        localDb.getDocs<AcademicHolidayItem>('academic_holidays'),
        localDb.getDocs<AcademicCalendarPeriod>('academic_calendar_periods')
      ]).then(([t, p, m, s, e, g, h, per]) => {
        setTeachers(t || []);
        setPrograms(p || []);
        setManualSchedules(m || []);
        setStudents((s || []).filter(item => item.isActive !== false));
        setEnrollments(e || []);
        setGrades(g || []);
        setHolidays(h || []);
        setPeriods(per || []);
      }).catch(() => {});
    });

    return () => unsub();
  }, [syncPortalData, currentUser?.id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  /**
   * Identifies the Teacher profile using multi-tier ID, National ID,
   * Teacher Code, Phone, and normalized name matching.
   */
  const currentTeacherObj = useMemo<Teacher | undefined>(() => {
    if (!currentUser) return undefined;

    const matched = findMatchingTeacher(currentUser, teachers);
    if (matched) return matched;

    // Fallback: create teacher object from currentUser
    return {
      id: currentUser.id || 'teacher_current',
      fullName: (currentUser as any).fullName || currentUser.name || 'استاد محترم',
      name: currentUser.name || (currentUser as any).fullName,
      teacherCode: (currentUser as any).teacherCode || (currentUser as any).teacherId || currentUser.username,
      phoneNumber: (currentUser as any).phone || (currentUser as any).phoneNumber,
      nationalId: (currentUser as any).nationalId || (currentUser as any).nationalCode,
      categories: ['ویژه'],
      priority: 1,
      isActive: true,
      createdAt: new Date().toISOString()
    };
  }, [currentUser, teachers]);

  /**
   * All teaching programs assigned to this teacher (combining regular programs & manual schedules)
   */
  const teacherPrograms = useMemo(() => {
    if (!currentTeacherObj && !currentUser) return [];

    const list: Program[] = [];

    // 1. From regular school programs
    programs.forEach(p => {
      const isMatch = isProgramAssignedToTeacher(p, currentTeacherObj, currentUser);
      if (isMatch) {
        list.push({
          ...p,
          days: getProgramDays(p)
        });
      }
    });

    // 2. From manual teacher schedules
    manualSchedules.forEach(m => {
      const isMatch = isManualScheduleAssignedToTeacher(m, currentTeacherObj, currentUser);
      if (isMatch) {
        list.push({
          id: m.id,
          title: m.title,
          type: 'counseling' as any,
          teacher: m.teacherName,
          grade: m.grade || 'عمومی',
          days: m.days && m.days.length > 0 ? m.days : (m.day ? [m.day] : []),
          time: m.time || 'نامشخص',
          madrasRoom: m.madrasRoom || 'نامشخص',
          notes: m.notes
        });
      }
    });

    return list;
  }, [programs, manualSchedules, currentTeacherObj, currentUser]);

  /**
   * Is this teacher a Counseling Teacher?
   */
  const isCounselingTeacher = useMemo(() => {
    if (!currentTeacherObj && !currentUser) return false;

    // Check categories in teacher profile
    if (currentTeacherObj?.categories) {
      const hasCategory = currentTeacherObj.categories.some(cat => 
        cat.includes('مشاوره') || cat === 'مشاوره اصول' || cat === 'مشاوره فقه' || cat === 'مشاوره فلسفه'
      );
      if (hasCategory) return true;
    }

    // Check programs
    const hasCounselingProgram = teacherPrograms.some(p => 
      p.title?.includes('مشاوره') || 
      (p.type as string) === 'مشاوره' || 
      (p.type as string) === 'counseling' || 
      (p as any).category?.includes('مشاوره')
    );
    if (hasCounselingProgram) return true;

    // Check specialties
    const spec = currentTeacherObj?.detailedSpecialties;
    if (spec && (spec.usul?.length || spec.fiqh?.length || spec.falsafa?.length)) return true;

    // Check currentUser flags and role titles
    if ((currentUser as any)?.canEditCounseling || (currentUser as any)?.canViewCounseling) return true;
    if (currentUser?.roleTitle?.includes('مشاوره')) return true;
    if (currentUser?.fullName?.includes('مشاور') || currentUser?.name?.includes('مشاور')) return true;

    return true; // Default to allowing counseling access for all teachers
  }, [currentTeacherObj, teacherPrograms, currentUser]);

  // Auto-switch directly into counseling registration for counseling teachers upon login
  useEffect(() => {
    if (loadingState === 'success' && !hasAutoDirected) {
      if (isCounselingTeacher) {
        setActiveTab('counseling');
      }
      setHasAutoDirected(true);
    }
  }, [loadingState, isCounselingTeacher, hasAutoDirected]);

  /**
   * All counseling courses taught by this teacher (Strict: ONLY counseling classes, never main classes)
   */
  const counselingPrograms = useMemo(() => {
    // 1. All explicit counseling programs taught by this teacher
    const explicitCounseling = teacherPrograms.filter(p => 
      p.title?.includes('مشاوره') || 
      (p.type as string) === 'مشاوره' || 
      (p.type as string) === 'counseling' || 
      (p as any).category?.includes('مشاوره')
    );

    if (explicitCounseling.length > 0) return explicitCounseling;

    // 2. Dynamic grade slots based on teacher's managedGrades or default grades if teacher is marked as counselor
    const teacherManagedGrades = currentTeacherObj?.managedGrades || (currentUser as any)?.managedGrades || [];
    const teacherDisplayName = currentTeacherObj?.fullName || currentTeacherObj?.name || currentUser?.name || 'استاد مشاور';

    if (teacherManagedGrades.length > 0) {
      return teacherManagedGrades.map((g, idx) => ({
        id: `counseling-${g}-${currentTeacherObj?.id || idx}`,
        title: `کلاس مشاوره (${g})`,
        type: 'مشاوره' as any,
        teacher: teacherDisplayName,
        grade: g,
        days: ['شنبه', 'دوشنبه', 'چهارشنبه'],
        time: 'ساعت مشاوره',
        madrasRoom: 'مدرس مشاوره'
      }));
    }

    return [
      {
        id: `counseling-p7-${currentTeacherObj?.id || 'main'}`,
        title: 'کلاس مشاوره و ارزیابی تحصیلی (پایه ۷)',
        type: 'مشاوره' as any,
        teacher: teacherDisplayName,
        grade: 'پایه ۷',
        days: ['شنبه', 'دوشنبه', 'چهارشنبه'],
        time: 'ساعت مشاوره',
        madrasRoom: 'مدرس مشاوره'
      },
      {
        id: `counseling-p8-${currentTeacherObj?.id || 'main'}`,
        title: 'کلاس مشاوره و ارزیابی تحصیلی (پایه ۸)',
        type: 'مشاوره' as any,
        teacher: teacherDisplayName,
        grade: 'پایه ۸',
        days: ['یکشنبه', 'سه‌شنبه'],
        time: 'ساعت مشاوره',
        madrasRoom: 'مدرس مشاوره'
      },
      {
        id: `counseling-p9-${currentTeacherObj?.id || 'main'}`,
        title: 'کلاس مشاوره و ارزیابی تحصیلی (پایه ۹ و ۱۰)',
        type: 'مشاوره' as any,
        teacher: teacherDisplayName,
        grade: 'پایه ۹',
        days: ['شنبه', 'چهارشنبه'],
        time: 'ساعت مشاوره',
        madrasRoom: 'مدرس مشاوره'
      }
    ];
  }, [teacherPrograms, currentTeacherObj, currentUser]);

  // Set default selected counseling course
  useEffect(() => {
    if (counselingPrograms.length > 0 && (!selectedCourseId || !counselingPrograms.some(p => p.id === selectedCourseId))) {
      setSelectedCourseId(counselingPrograms[0].id);
    }
  }, [counselingPrograms, selectedCourseId]);

  const activeCounselingCourse = useMemo(() => {
    return counselingPrograms.find(p => p.id === selectedCourseId) || counselingPrograms[0];
  }, [counselingPrograms, selectedCourseId]);

  /**
   * Calculate ONLY the dates when this counseling class had sessions:
   * 1. Show maximum the last 4 classes they had
   * 2. Do NOT show unheld classes (no holidays, no future dates)
   * 3. The class of that same day (today) and 3 sessions before it
   */
  const classSessionDates = useMemo(() => {
    if (!activeCounselingCourse) return [];

    const rawCourseDays = getProgramDays(activeCounselingCourse);
    const courseDays = (rawCourseDays && rawCourseDays.length > 0)
      ? rawCourseDays
      : (Array.isArray(activeCounselingCourse.days) && activeCounselingCourse.days.length > 0)
        ? activeCounselingCourse.days
        : (activeCounselingCourse as any).day
          ? [(activeCounselingCourse as any).day]
          : ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه'];

    const today = getTodayShamsi();

    // Check if a date falls in holidays (official or school holidays)
    const isHolidayOnDate = (dateStr: string) => {
      return holidays.some(h => {
        if (h.startDate && h.endDate) {
          return dateStr >= h.startDate && dateStr <= h.endDate;
        }
        return (h as any).date === dateStr || h.startDate === dateStr;
      });
    };

    // Look back up to 150 days from today (covers whole academic semester up to today)
    const todayDate = shamsiToDate(today);
    const pastDate = new Date(todayDate.getTime());
    pastDate.setDate(pastDate.getDate() - 150);
    const startDate = dateToShamsi(pastDate);

    // Generate dates strictly up to today (strictly <= today, NO FUTURE DATES)
    const allDays = generateShamsiDateRange(startDate, today);

    // Filter only the days when this class was scheduled and actually held
    const heldDates = allDays.filter(dateStr => {
      if (compareShamsi(dateStr, today) > 0) return false;
      const weekdayName = getShamsiDayOfWeekName(dateStr);
      if (!courseDays.includes(weekdayName)) return false;
      if (isHolidayOnDate(dateStr)) return false;
      return true;
    });

    const recentHeldDates = heldDates.slice(-4);

    const sessions = recentHeldDates.map(dateStr => {
      const semesterSessionIndex = heldDates.indexOf(dateStr);
      const sessionNumber = semesterSessionIndex >= 0 ? semesterSessionIndex + 1 : 1;
      const isToday = dateStr === today;
      return {
        date: dateStr,
        weekday: getShamsiDayOfWeekName(dateStr),
        sessionNumber,
        isToday
      };
    });

    const sorted = sessions.reverse();

    // Fallback if calendar unseeded or empty
    if (sorted.length === 0 && !isHolidayOnDate(today)) {
      return [{
        date: today,
        weekday: getShamsiDayOfWeekName(today),
        sessionNumber: 1,
        isToday: true
      }];
    }

    return sorted;
  }, [activeCounselingCourse, holidays]);

  // Default selected session date
  useEffect(() => {
    if (classSessionDates.length > 0) {
      const exists = classSessionDates.some(s => s.date === selectedSessionDate);
      if (!exists) {
        const todaySession = classSessionDates.find(s => s.isToday);
        setSelectedSessionDate(todaySession ? todaySession.date : classSessionDates[0].date);
      }
    } else {
      setSelectedSessionDate('');
    }
  }, [classSessionDates, selectedSessionDate]);

  /**
   * STRICT FILTER: Enrolled students of THIS class ONLY.
   * Matches exclusively by explicit enrollments, course grade matching, or course title grade indicators.
   * Never displays students from other grades or general school students.
   */
  const enrolledStudents = useMemo(() => {
    if (!activeCounselingCourse) return [];

    // 1. Direct enrollments or explicit studentIds for this specific counseling class
    if (activeCounselingCourse.studentIds && activeCounselingCourse.studentIds.length > 0) {
      const ids = new Set(activeCounselingCourse.studentIds);
      const direct = students.filter(s => ids.has(s.id) && s.isActive !== false);
      if (direct.length > 0) {
        return direct.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fa'));
      }
    }

    const courseEnrollments = enrollments.filter(e => 
      e.programId === activeCounselingCourse.id
    );
    if (courseEnrollments.length > 0) {
      const ids = new Set(courseEnrollments.map(e => e.studentId));
      const direct = students.filter(s => ids.has(s.id) && s.isActive !== false);
      if (direct.length > 0) {
        return direct.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fa'));
      }
    }

    // 2. Grade-based strict filtering (e.g. all students of 'پایه ۷', 'پایه 7', 'پایه هفتم')
    if (activeCounselingCourse.grade && activeCounselingCourse.grade !== 'عمومی' && activeCounselingCourse.grade !== 'همه') {
      const gradeStudents = students.filter(s => 
        isGradeMatch(s.grade, activeCounselingCourse.grade) && s.isActive !== false
      );
      if (gradeStudents.length > 0) {
        return gradeStudents.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fa'));
      }
    }

    // 3. Extract grade from course title if title mentions "پایه ۷", "پایه ۸", etc.
    const title = activeCounselingCourse.title || '';
    const gradeMatches = [
      'پایه ۷', 'پایه ۸', 'پایه ۹', 'پایه ۱۰', 'پایه ۱', 'پایه ۲', 'پایه ۳', 'پایه ۴', 'پایه ۵', 'پایه ۶',
      'پایه 7', 'پایه 8', 'پایه 9', 'پایه 10', 'پایه 1', 'پایه 2', 'پایه 3', 'پایه 4', 'پایه 5', 'پایه 6',
      'پایه هفتم', 'پایه هشتم', 'پایه نهم', 'پایه دهم', 'پایه اول', 'پایه دوم', 'پایه سوم', 'پایه چهارم', 'پایه پنجم', 'پایه ششم'
    ];
    for (const g of gradeMatches) {
      if (title.includes(g)) {
        const found = students.filter(s => isGradeMatch(s.grade, g) && s.isActive !== false);
        if (found.length > 0) {
          return found.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fa'));
        }
      }
    }

    // If no matching students found for this class, strictly return empty list
    return [];
  }, [activeCounselingCourse, enrollments, students]);

  // Existing grades for the selected course and selected session date
  const sessionGradesMap = useMemo(() => {
    if (!activeCounselingCourse || !selectedSessionDate) return new Map<string, CounselingSessionGrade>();

    const map = new Map<string, CounselingSessionGrade>();
    grades.forEach(g => {
      if (
        g.sessionDate === selectedSessionDate &&
        (g.courseTitle === activeCounselingCourse.title || !g.courseTitle)
      ) {
        map.set(g.studentId, g);
      }
    });
    return map;
  }, [grades, activeCounselingCourse, selectedSessionDate]);

  // Grade completion status for each held session date
  const sessionGradingStats = useMemo(() => {
    const stats: Record<string, { gradedCount: number; totalCount: number; isComplete: boolean }> = {};
    const totalCount = enrolledStudents.length;

    classSessionDates.forEach(session => {
      let graded = 0;
      grades.forEach(g => {
        if (
          g.sessionDate === session.date &&
          (g.courseTitle === activeCounselingCourse?.title || !g.courseTitle)
        ) {
          if (enrolledStudents.some(s => s.id === g.studentId)) {
            if (g.participationScore || g.researchScore) {
              graded++;
            }
          }
        }
      });
      stats[session.date] = {
        gradedCount: graded,
        totalCount,
        isComplete: totalCount > 0 && graded >= totalCount
      };
    });

    return stats;
  }, [classSessionDates, enrolledStudents, grades, activeCounselingCourse]);

  const getSessionRelativeLabel = (session: { date: string; isToday?: boolean }, idx: number) => {
    if (session.isToday) return 'کلاس همان روز (امروز)';
    if (idx === 0) return 'آخرین جلسه برگزارشده';
    if (idx === 1) return 'یک جلسه قبل';
    if (idx === 2) return 'دو جلسه قبل';
    if (idx === 3) return 'سه جلسه قبل';
    return `جلسه ${toPersianDigits(idx + 1)}`;
  };

  /**
   * Separate factor grading handler for Participation and Research/Summary scores.
   * Completely decoupled: setting participation does not force research, and vice versa.
   */
  const handleSetStudentFactorScore = async (
    student: Student,
    factor: 'participation' | 'research',
    score: CounselingScore
  ) => {
    if (!activeCounselingCourse || !selectedSessionDate) return;

    try {
      const teacherName = currentTeacherObj?.fullName || currentTeacherObj?.name || currentUser?.name || 'استاد مشاور';
      const existing = sessionGradesMap.get(student.id);

      const feedback = teacherNotesMap[student.id] !== undefined 
        ? teacherNotesMap[student.id] 
        : (existing?.counselorFeedback || '');

      const docId = existing?.id || `csg-${student.id}-${selectedSessionDate.replace(/\//g, '-')}-${Date.now()}`;

      const updatedParticipation = factor === 'participation' 
        ? score 
        : existing?.participationScore;

      const updatedResearch = factor === 'research' 
        ? score 
        : existing?.researchScore;

      const gradeDoc: CounselingSessionGrade = {
        id: docId,
        studentId: student.id,
        studentName: student.name,
        grade: student.grade || activeCounselingCourse.grade || 'عمومی',
        counselorTeacherName: teacherName,
        courseTitle: activeCounselingCourse.title,
        sessionDate: selectedSessionDate,
        sessionNumber: `جلسه ${classSessionDates.find(s => s.date === selectedSessionDate)?.sessionNumber || 1}`,
        participationScore: updatedParticipation as CounselingScore,
        researchScore: updatedResearch as CounselingScore,
        counselorFeedback: feedback.trim() || undefined,
        createdAt: existing?.createdAt || new Date().toISOString(),
        createdByName: currentUser?.name || teacherName,
        createdByRole: 'استاد',
        updatedAt: new Date().toISOString()
      };

      await localDb.setDoc('counseling_session_grades', gradeDoc);
      setGrades(prev => [...prev.filter(g => g.id !== docId), gradeDoc]);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app_data_change', { detail: { collection: 'counseling_session_grades' } }));
      }

      setFeedbackSavedStudentId(student.id);
      setTimeout(() => setFeedbackSavedStudentId(null), 1500);
    } catch (err) {
      console.error('Error saving counseling factor score:', err);
      showToast('خطا در ثبت نمره ارزیابی');
    }
  };

  /**
   * Master Save Action (دکمه ثبت نهایی بالا و پایین صفحه):
   * Explicitly commits all evaluations, attendance, and notes to database & cloud.
   */
  const handleSaveAllEvaluations = async () => {
    if (!activeCounselingCourse || !selectedSessionDate) {
      showToast('لطفاً ابتدا یک جلسه را انتخاب فرمایید.');
      return;
    }
    if (enrolledStudents.length === 0) {
      showToast('طلبه‌ای در این کلاس یافت نشد.');
      return;
    }

    try {
      setIsSavingAll(true);
      const teacherName = currentTeacherObj?.fullName || currentTeacherObj?.name || currentUser?.name || 'استاد مشاور';
      const sessionInfo = classSessionDates.find(s => s.date === selectedSessionDate);
      const sessionLabel = `جلسه ${sessionInfo?.sessionNumber || 1}`;

      const updates: CounselingSessionGrade[] = [];

      for (const student of enrolledStudents) {
        const existing = sessionGradesMap.get(student.id);
        const pendingNote = teacherNotesMap[student.id];
        const feedback = pendingNote !== undefined ? pendingNote.trim() : (existing?.counselorFeedback || '');

        if (existing || pendingNote !== undefined) {
          const docId = existing?.id || `csg-${student.id}-${selectedSessionDate.replace(/\//g, '-')}-${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
          const gradeDoc: CounselingSessionGrade = {
            id: docId,
            studentId: student.id,
            studentName: student.name,
            grade: student.grade || activeCounselingCourse.grade || 'عمومی',
            counselorTeacherName: teacherName,
            courseTitle: activeCounselingCourse.title,
            sessionDate: selectedSessionDate,
            sessionNumber: sessionLabel,
            participationScore: existing?.participationScore as CounselingScore,
            researchScore: existing?.researchScore as CounselingScore,
            counselorFeedback: feedback || undefined,
            createdAt: existing?.createdAt || new Date().toISOString(),
            createdByName: currentUser?.name || teacherName,
            createdByRole: 'استاد',
            updatedAt: new Date().toISOString()
          };
          await localDb.setDoc('counseling_session_grades', gradeDoc);
          updates.push(gradeDoc);
        }
      }

      if (updates.length > 0) {
        setGrades(prev => {
          const idSet = new Set(updates.map(u => u.id));
          return [...prev.filter(g => !idSet.has(g.id)), ...updates];
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('app_data_change', { detail: { collection: 'counseling_session_grades' } }));
        }
        showToast(`✓ ارزیابی ${toPersianDigits(updates.length)} طلبه برای جلسه ${selectedSessionDate} با موفقیت در دیتابیس ثبت شد.`);
      } else {
        showToast('لطفاً نمره حداقل یک طلبه را تعیین فرمایید و سپس ثبت را بزنید.');
      }
    } catch (err) {
      console.error('Error saving all evaluations:', err);
      showToast('خطا در ثبت و ذخیره ارزیابی‌ها در دیتابیس.');
    } finally {
      setIsSavingAll(false);
    }
  };

  // Save Counselor Feedback note
  const handleSaveStudentNote = async (studentId: string, studentName: string) => {
    const existing = sessionGradesMap.get(studentId);
    const note = teacherNotesMap[studentId];
    if (note === undefined) return;

    if (existing) {
      const updated: CounselingSessionGrade = {
        ...existing,
        counselorFeedback: note.trim() || undefined,
        updatedAt: new Date().toISOString()
      };
      await localDb.setDoc('counseling_session_grades', updated);
      setGrades(prev => prev.map(g => g.id === existing.id ? updated : g));
      setFeedbackSavedStudentId(studentId);
      setTimeout(() => setFeedbackSavedStudentId(null), 1500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/90 text-slate-800 pb-28 font-vazir antialiased select-none" dir="rtl">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 inset-x-4 max-w-sm mx-auto z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center justify-between text-xs font-bold"
          >
            <span>{toastMessage}</span>
            <Check size={16} className="text-emerald-400 shrink-0" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- TOP MOBILE APP BAR --- */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 py-3 shadow-xs">
        <div className="max-w-md sm:max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white font-black flex items-center justify-center shadow-md shadow-indigo-100 text-lg">
              {currentTeacherObj?.fullName?.[0] || 'ا'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                  {currentTeacherObj?.fullName || currentUser?.name || 'استاد محترم'}
                </h1>
                <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full font-bold">
                  استاد مدرسه
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-medium">
                {currentTeacherObj?.teacherCode && (
                  <span className="font-mono font-bold bg-slate-100 px-1.5 py-0.2 rounded text-[10px] text-slate-700">
                    کد: {currentTeacherObj.teacherCode}
                  </span>
                )}
                {currentTeacherObj?.phoneNumber && (
                  <span className="font-mono">
                    همراه: {currentTeacherObj.phoneNumber}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Sync / Refresh Button */}
            <button
              onClick={() => syncPortalData(true)}
              disabled={isSyncing || loadingState === 'loading'}
              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold disabled:opacity-50"
              title="همگام‌سازی و بروزرسانی برنامه از سرور"
            >
              <RotateCw size={17} className={cn("transition-transform", isSyncing && "animate-spin text-indigo-700")} />
              <span className="hidden sm:inline text-[11px]">همگام‌سازی</span>
            </button>

            {/* Logout Button */}
            <button
              onClick={logout}
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
              title="خروج از حساب کاربری"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>

        {/* --- CLEAN MOBILE SEGMENTED TABS --- */}
        <div className="max-w-md sm:max-w-xl mx-auto mt-3">
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/70 text-xs font-bold">
            <button
              onClick={() => setActiveTab('schedule')}
              className={cn(
                "py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                activeTab === 'schedule'
                  ? "bg-white text-indigo-700 shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Calendar size={15} />
              <span>برنامه درسی</span>
            </button>

            <button
              onClick={() => setActiveTab('counseling')}
              className={cn(
                "py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer relative",
                activeTab === 'counseling'
                  ? "bg-emerald-600 text-white shadow-xs font-black"
                  : "text-emerald-800 hover:bg-emerald-50"
              )}
            >
              <BookCheck size={15} />
              <span>ارزیابی مشاوره</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 absolute top-1.5 left-2" />
            </button>

            <button
              onClick={() => setActiveTab('calendar')}
              className={cn(
                "py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                activeTab === 'calendar'
                  ? "bg-white text-indigo-700 shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <CalendarDays size={15} />
              <span>تقویم مدرسه</span>
            </button>
          </div>
        </div>
      </header>

      {/* --- MAIN VERTICAL CONTENT CONTAINER --- */}
      <main className="max-w-md sm:max-w-xl mx-auto p-4 space-y-4">
        {/* Loading State Spinner */}
        {loadingState === 'loading' ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-200/90 shadow-xs space-y-3 my-8">
            <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <h3 className="text-sm font-black text-slate-800">در حال دریافت و همگام‌سازی برنامه تدریس شما...</h3>
            <p className="text-xs text-slate-500">
              لطفاً چند لحظه صبر نمایید؛ اطلاعات از سرور مرکزی در حال بارگذاری است.
            </p>
          </div>
        ) : loadingState === 'error' ? (
          /* Error State Banner with Retry Button */
          <div className="bg-white rounded-3xl p-8 text-center border border-rose-200 shadow-xs space-y-3 my-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <WifiOff size={24} />
            </div>
            <h3 className="text-sm font-black text-slate-800">خطا در دریافت اطلاعات از سرور</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {syncErrorMessage || 'ارتباط با سرور برقرار نشد. لطفاً اتصال اینترنت خود را بررسی کنید.'}
            </p>
            <button
              onClick={() => syncPortalData(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
            >
              <RotateCw size={14} />
              <span>تلاش مجدد برای دریافت برنامه</span>
            </button>
          </div>
        ) : (
          <>
            {/* ========================================================= */}
            {/* TAB 1: PROGRAM & TEACHING SCHEDULE (برنامه درسی استاد)       */}
            {/* ========================================================= */}
            {activeTab === 'schedule' && (
              <div className="space-y-4">
                <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Calendar size={18} className="text-indigo-600" />
                      <span>برنامه هفتگی تدریس شما</span>
                    </h2>
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-xl">
                      {toPersianDigits(teacherPrograms.length)} درس / سرفصل
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    جدول جلسات، ساعت‌ها و کلاس‌های اختصاص‌یافته به شما بر اساس تقویم آموزشی مدرسه:
                  </p>
                </div>

                {teacherPrograms.length === 0 ? (
                  <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 space-y-3">
                    <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto border border-indigo-100">
                      <GraduationCap size={28} />
                    </div>
                    <h3 className="text-sm font-black text-slate-800">برنامه درسی اختصاص‌یافته‌ای یافت نشد</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                      استاد محترم ({currentTeacherObj?.fullName || currentUser?.name})؛ برنامه درسی برای نام کاربری یا شناسه شما در جدول دروس ثبت نشده است.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                      <button
                        onClick={() => syncPortalData(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        <RotateCw size={14} />
                        <span>بروزرسانی مجدد برنامه از سرور</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('counseling')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                      >
                        <BookCheck size={14} />
                        <span>ورود به بخش ارزیابی مشاوره</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {teacherPrograms.map((prog, idx) => (
                      <div
                        key={prog.id || idx}
                        className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-3 relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
                              {prog.grade || 'پایه عمومی'}
                            </span>
                            <h3 className="text-sm font-black text-slate-900 pt-0.5">
                              {prog.title}
                            </h3>
                          </div>

                          {prog.title?.includes('مشاوره') && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full">
                              کلاس مشاوره
                            </span>
                          )}
                        </div>

                        {/* Schedule Meta: Days, Time, Room */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-700 font-bold bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <Clock size={14} className="text-indigo-600 shrink-0" />
                            <span className="font-mono text-[11px]">{prog.time || 'ساعت تعیین‌نشده'}</span>
                          </div>

                          <div className="flex items-center gap-1.5 text-slate-700 font-bold bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <DoorOpen size={14} className="text-amber-600 shrink-0" />
                            <span className="truncate">{prog.madrasRoom || 'مدرس نامشخص'}</span>
                          </div>
                        </div>

                        {/* Days of week chips */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <span className="text-[11px] font-bold text-slate-400">روزهای برگزاری:</span>
                          {(prog.days || []).map(day => (
                            <span
                              key={day}
                              className="text-[11px] font-black bg-indigo-50 text-indigo-800 px-2.5 py-0.5 rounded-lg border border-indigo-100"
                            >
                              {day}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB 2: COUNSELING EVALUATIONS (ثبت سریع ارزیابی مشاوره)     */}
            {/* ========================================================= */}
            {activeTab === 'counseling' && (
              <div className="space-y-4">
                {/* --- CLASS SHIFTER (جابجایی آسان بین کلاس‌های مشاوره استاد) --- */}
                {counselingPrograms.length > 1 && (
                  <div className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
                      <span className="flex items-center gap-1.5 text-indigo-700">
                        <ArrowRightLeft size={15} />
                        <span>انتخاب کلاس مشاوره (تغییر کلاس):</span>
                      </span>
                      <span className="text-[11px] text-slate-400 font-normal">
                        {toPersianDigits(counselingPrograms.length)} کلاس اختصاص‌یافته
                      </span>
                    </div>

                    {/* Horizontal Class Selector Tabs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {counselingPrograms.map(prog => {
                        const isSelected = selectedCourseId === prog.id;
                        
                        return (
                          <button
                            key={prog.id}
                            type="button"
                            onClick={() => {
                              setSelectedCourseId(prog.id);
                              setSelectedSessionDate('');
                            }}
                            className={cn(
                              "p-3 rounded-2xl border text-right transition-all flex items-center justify-between gap-2 cursor-pointer shadow-2xs",
                              isSelected 
                                ? "bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-300 font-black scale-[1.01]"
                                : "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100"
                            )}
                          >
                            <div className="space-y-0.5 truncate">
                              <div className="text-xs font-black truncate">{prog.title}</div>
                              <div className={cn(
                                "text-[10px] font-mono",
                                isSelected ? "text-emerald-100" : "text-slate-500"
                              )}>
                                {prog.grade || 'پایه عمومی'} {prog.time ? `• ${prog.time}` : ''}
                              </div>
                            </div>
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0",
                              isSelected ? "bg-white/20 text-white" : "bg-white border border-slate-200 text-slate-600"
                            )}>
                              {isSelected ? 'کلاس انتخابی' : 'انتخاب'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* HELD SESSIONS SELECTOR WITH LIVE STATUS */}
                <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 text-xs font-black text-slate-900">
                        <CalendarCheck size={16} className="text-emerald-600" />
                        <span>انتخاب جلسه کلاس:</span>
                        <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                          {selectedSessionDate || 'جلسه‌ای انتخاب نشده'}
                        </span>
                        {classSessionDates.find(s => s.date === selectedSessionDate)?.isToday && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                            کلاس امروز
                          </span>
                        )}
                      </div>
                    </div>

                    {/* TOP SAVE BUTTON (دکمه ثبت ارزیابی‌ها در بالای صفحه) */}
                    <button
                      type="button"
                      onClick={handleSaveAllEvaluations}
                      disabled={isSavingAll || !selectedSessionDate || enrolledStudents.length === 0}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md disabled:opacity-50"
                    >
                      <Save size={15} />
                      <span>{isSavingAll ? 'در حال ثبت...' : 'ثبت ارزیابی‌ها'}</span>
                    </button>
                  </div>

                  {/* 4 Held Sessions Selector */}
                  <div className="space-y-2 pt-1">
                    {classSessionDates.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">
                        هیچ جلسه برگزارشده‌ای در تقویم آموزشی برای این کلاس یافت نشد.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {classSessionDates.map((session, idx) => {
                          const stats = sessionGradingStats[session.date] || { 
                            gradedCount: 0, 
                            totalCount: enrolledStudents.length, 
                            isComplete: false 
                          };
                          const isSelected = selectedSessionDate === session.date;
                          const relLabel = getSessionRelativeLabel(session, idx);

                          return (
                            <button
                              key={session.date}
                              type="button"
                              onClick={() => setSelectedSessionDate(session.date)}
                              className={cn(
                                "p-3 rounded-2xl border text-right transition-all flex flex-col justify-between cursor-pointer shadow-2xs",
                                isSelected 
                                  ? "bg-emerald-600 text-white border-emerald-700 shadow-md scale-102 ring-2 ring-emerald-300 font-black"
                                  : stats.isComplete
                                    ? "bg-white border-emerald-300 text-slate-800 hover:bg-emerald-50/70"
                                    : "bg-white border-amber-300 text-slate-800 hover:bg-amber-50/70 ring-1 ring-amber-200/80"
                              )}
                            >
                              <div className="flex items-center justify-between gap-1 mb-1.5">
                                <span className={cn(
                                  "text-[10px] font-black px-2 py-0.5 rounded-lg",
                                  isSelected 
                                    ? "bg-white/20 text-white" 
                                    : session.isToday
                                      ? "bg-emerald-600 text-white shadow-2xs"
                                      : "bg-slate-100 text-slate-700"
                                )}>
                                  {relLabel}
                                </span>
                                {stats.isComplete ? (
                                  <CheckCircle2 size={15} className={isSelected ? "text-emerald-200" : "text-emerald-600"} />
                                ) : (
                                  <AlertCircle size={15} className={isSelected ? "text-amber-200" : "text-amber-600 animate-pulse"} />
                                )}
                              </div>
                              <div className="font-mono text-xs font-black">{session.date}</div>
                              <div className="text-[10px] opacity-80 mt-0.5">
                                {session.weekday} (جلسه {toPersianDigits(session.sessionNumber)})
                              </div>
                              <div className={cn(
                                "text-[10px] mt-2 font-black pt-1 border-t",
                                isSelected 
                                  ? "border-white/20 text-emerald-100" 
                                  : stats.isComplete 
                                    ? "border-emerald-100 text-emerald-700" 
                                    : "border-amber-100 text-amber-700"
                              )}>
                                {stats.isComplete 
                                  ? `✓ ثبت شده (${toPersianDigits(stats.gradedCount)} طلبه)`
                                  : `⚠️ نیاز به نمره (${toPersianDigits(stats.totalCount - stats.gradedCount)} مانده)`
                                }
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Students Evaluation List (فقط طلبه‌های کلاس مشاوره همین استاد) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                      <Users size={14} className="text-slate-400" />
                      <span>
                        فهرست طلاب کلاس {activeCounselingCourse?.title || ''} ({toPersianDigits(enrolledStudents.length)} نفر):
                      </span>
                    </span>
                    <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                      {toPersianDigits(sessionGradesMap.size)} از {toPersianDigits(enrolledStudents.length)} ارزیابی شدند
                    </span>
                  </div>

                  {enrolledStudents.length === 0 ? (
                    <div className="bg-white rounded-3xl p-8 text-center text-slate-500 text-xs font-bold border border-slate-200 space-y-2">
                      <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                        <Users size={22} />
                      </div>
                      <p className="text-slate-800">هیچ طلبه‌ای برای کلاس «{activeCounselingCourse?.title}» ثبت نشده است.</p>
                      <p className="text-[11px] text-slate-400">
                        جهت اختصاص طلاب به این کلاس، از سامانه مدیریت برنامه‌ها یا انتخاب واحد استفاده نمایید.
                      </p>
                    </div>
                  ) : (
                    enrolledStudents.map(student => {
                      const existingGrade = sessionGradesMap.get(student.id);
                      const partScore = existingGrade?.participationScore;
                      const resScore = existingGrade?.researchScore;
                      const isFeedbackSaved = feedbackSavedStudentId === student.id;

                      return (
                        <div
                          key={student.id}
                          className={cn(
                            "bg-white rounded-3xl p-4 border transition-all space-y-3.5 shadow-xs",
                            (partScore || resScore) 
                              ? "border-emerald-200 bg-white" 
                              : "border-slate-200/90"
                          )}
                        >
                          {/* Student Header */}
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 font-black text-sm flex items-center justify-center border border-indigo-100 overflow-hidden">
                                {(student.photoUrl || (student as any).photo) ? (
                                  <img 
                                    src={student.photoUrl || (student as any).photo} 
                                    alt={student.name} 
                                    className="w-full h-full object-cover rounded-2xl" 
                                  />
                                ) : (
                                  student.name[0] || 'ط'
                                )}
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-slate-900">
                                  {student.name}
                                </h4>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  {student.nationalId || student.studentCode || student.grade || 'دانش‌پژوه'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Factor 1: نمره مشارکت (حضور و فعالیت کلاسی) */}
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 px-0.5">
                              <span className="flex items-center gap-1 text-emerald-800 font-black">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                                <span>نمره مشارکت و حضور کلاسی:</span>
                              </span>
                            </div>
                            <div className="grid grid-cols-5 gap-1.5">
                              {[
                                { key: 'الف', label: 'عالی', idle: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200', active: 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-300' },
                                { key: 'ب', label: 'خوب', idle: 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200', active: 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-300' },
                                { key: 'ج', label: 'متوسط', idle: 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200', active: 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-300' },
                                { key: 'د', label: 'ضعیف', idle: 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200', active: 'bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-300' },
                                { key: 'غیبت', label: 'عدم‌حضور', idle: 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200', active: 'bg-slate-700 text-white border-slate-800 shadow-md ring-2 ring-slate-400' }
                              ].map(item => {
                                const isSelected = partScore === item.key;
                                return (
                                  <button
                                    key={`part-${item.key}`}
                                    type="button"
                                    onClick={() => handleSetStudentFactorScore(student, 'participation', item.key as CounselingScore)}
                                    className={cn(
                                      "py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center border active:scale-95",
                                      isSelected ? item.active : item.idle
                                    )}
                                  >
                                    <span className="text-xs">{item.key}</span>
                                    <span className="text-[9px] opacity-80">{item.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Factor 2: نمره پژوهش و تقریر (تکلیف و خلاصه) */}
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 px-0.5">
                              <span className="flex items-center gap-1 text-blue-800 font-black">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"></span>
                                <span>نمره پژوهش و تقریر:</span>
                              </span>
                            </div>
                            <div className="grid grid-cols-5 gap-1.5">
                              {[
                                { key: 'الف', label: 'عالی', idle: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200', active: 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-300' },
                                { key: 'ب', label: 'خوب', idle: 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200', active: 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-300' },
                                { key: 'ج', label: 'متوسط', idle: 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200', active: 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-300' },
                                { key: 'د', label: 'ضعیف', idle: 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200', active: 'bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-300' },
                                { key: 'غیبت', label: 'عدم‌حضور', idle: 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200', active: 'bg-slate-700 text-white border-slate-800 shadow-md ring-2 ring-slate-400' }
                              ].map(item => {
                                const isSelected = resScore === item.key;
                                return (
                                  <button
                                    key={`res-${item.key}`}
                                    type="button"
                                    onClick={() => handleSetStudentFactorScore(student, 'research', item.key as CounselingScore)}
                                    className={cn(
                                      "py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center border active:scale-95",
                                      isSelected ? item.active : item.idle
                                    )}
                                  >
                                    <span className="text-xs">{item.key}</span>
                                    <span className="text-[9px] opacity-80">{item.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Optional Quick Note field */}
                          <div className="pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-1.5">
                              <MessageSquare size={13} className="text-slate-400 shrink-0" />
                              <input
                                type="text"
                                placeholder="یادداشت یا ملاحظه استاد درباره طلبه (اختیاری)..."
                                value={teacherNotesMap[student.id] !== undefined ? teacherNotesMap[student.id] : (existingGrade?.counselorFeedback || '')}
                                onChange={(e) => setTeacherNotesMap({ ...teacherNotesMap, [student.id]: e.target.value })}
                                onBlur={() => handleSaveStudentNote(student.id, student.name)}
                                className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                              />
                              {isFeedbackSaved && (
                                <span className="text-[10px] text-emerald-600 font-bold shrink-0 flex items-center gap-0.5">
                                  <Check size={12} />
                                  <span>ثبت شد</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* --- BOTTOM ACTION BAR WITH PROMINENT SAVE BUTTON (دکمه ثبت در پایین صفحه) --- */}
                {enrolledStudents.length > 0 && (
                  <div className="sticky bottom-4 z-30 pt-2">
                    <button
                      type="button"
                      onClick={handleSaveAllEvaluations}
                      disabled={isSavingAll}
                      className="w-full py-3.5 px-5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-2xl text-sm font-black transition-all cursor-pointer shadow-xl flex items-center justify-center gap-2 border border-emerald-700 disabled:opacity-50"
                      style={{ backgroundColor: '#059669', color: '#ffffff' }}
                    >
                      <Save size={18} className="text-white shrink-0" />
                      <span className="text-white font-black">{isSavingAll ? 'در حال ثبت در پایگاه داده...' : 'ثبت و ذخیره نهایی ارزیابی‌های این جلسه'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB 3: ACADEMIC CALENDAR (تقویم آموزشی فقط خواندنی)        */}
            {/* ========================================================= */}
            {activeTab === 'calendar' && (
              <div className="space-y-4">
                <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <CalendarDays size={18} className="text-indigo-600" />
                      <span>تقویم آموزشی مدرسه</span>
                    </h2>
                    <span className="text-[10px] px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full font-bold">
                      مشاهده بدون ویرایش
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    سالنامه مصوب، تعطیلات رسمی و حوزوی، زمان‌بندی جلسات و مناسبت‌های مدرسه علمیه:
                  </p>
                </div>

                {/* Calendar Periods Info */}
                {periods.length > 0 && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-4 space-y-2">
                    <span className="text-xs font-black text-indigo-900 block">دوره و سال تحصیلی جاری:</span>
                    {periods.map(p => (
                      <div key={p.id} className="text-xs text-indigo-800 font-medium flex items-center justify-between">
                        <span>{p.title}</span>
                        <span className="font-mono text-[11px] font-bold">{p.startDate} تا {p.endDate}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Holidays List */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-700 px-1">
                    تعطیلات و رویدادهای تقویم ({toPersianDigits(holidays.length)} مورد):
                  </h3>

                  {holidays.length === 0 ? (
                    <div className="bg-white rounded-2xl p-6 text-center text-slate-400 text-xs font-bold border border-slate-200">
                      رویداد خاصی در تقویم ثبت نشده است.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {holidays.map(h => {
                        const dateLabel = h.startDate === h.endDate || !h.endDate 
                          ? (h.startDate || (h as any).date || 'نامشخص')
                          : `${h.startDate} تا ${h.endDate}`;
                        const typeLabel = h.typeName || (h as any).type || 'تعطیلی / رویداد';
                        return (
                          <div
                            key={h.id}
                            className="bg-white rounded-2xl p-3 border border-slate-200 flex items-center justify-between gap-2 shadow-2xs"
                          >
                            <div className="space-y-0.5">
                              <span className="text-xs font-black text-slate-800 block">{h.title}</span>
                              <span className="text-[10px] text-slate-400">{typeLabel}</span>
                            </div>
                            <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg shrink-0">
                              {dateLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
