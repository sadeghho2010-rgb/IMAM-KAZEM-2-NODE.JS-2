import React, { useState, useEffect, useMemo } from 'react';
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
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { localDb } from '../lib/localDb';
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

function cleanTeacherName(s: string): string {
  return (s || '')
    .replace(/^استاد\s+/, '')
    .replace(/^حجت\s*الاسلام(\s+و\s*المسلمین)?\s+/, '')
    .replace(/^شیخ\s+/, '')
    .replace(/^دکتر\s+/, '')
    .replace(/^آیت\s*الله\s+/, '')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/\u200c/g, '')
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

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

  // Active Mobile View Tab (Defaults directly to 'counseling' for counseling teachers)
  const [activeTab, setActiveTab] = useState<'schedule' | 'counseling' | 'calendar'>(
    initialCounselingHint ? 'counseling' : 'schedule'
  );

  // Flag to track whether initial auto-direction to counseling was performed
  const [hasAutoDirected, setHasAutoDirected] = useState<boolean>(false);

  // Database Data States
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [manualSchedules, setManualSchedules] = useState<TeacherManualSchedule[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [grades, setGrades] = useState<CounselingSessionGrade[]>([]);
  const [holidays, setHolidays] = useState<AcademicHolidayItem[]>([]);
  const [periods, setPeriods] = useState<AcademicCalendarPeriod[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Counseling Evaluation State
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedSessionDate, setSelectedSessionDate] = useState<string>('');
  const [teacherNotesMap, setTeacherNotesMap] = useState<Record<string, string>>({});
  const [feedbackSavedStudentId, setFeedbackSavedStudentId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Reset auto-direction when currentUser changes
  useEffect(() => {
    setHasAutoDirected(false);
  }, [currentUser?.id]);

  // Load all necessary data
  const loadPortalData = async () => {
    try {
      setLoading(true);
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
    } catch (err) {
      console.error('Error loading teacher portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortalData();
    const unsub = localDb.subscribe(() => {
      loadPortalData();
    });
    return () => unsub();
  }, [currentUser?.id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Match the logged-in user to their Teacher profile in TeacherBank
  const currentTeacherObj = useMemo<Teacher | undefined>(() => {
    if (!currentUser) return undefined;

    // 1. Direct link by linkedTeacherId / teacherId
    if (currentUser.linkedTeacherId) {
      const found = teachers.find(t => t.id === currentUser.linkedTeacherId);
      if (found) return found;
    }
    if (currentUser.teacherId) {
      const found = teachers.find(t => t.id === currentUser.teacherId);
      if (found) return found;
    }

    // 2. Match by National ID
    const cleanNat = (currentUser.nationalId || currentUser.username || '').trim().toUpperCase();
    if (cleanNat) {
      const found = teachers.find(t => t.nationalId && t.nationalId.trim().toUpperCase() === cleanNat);
      if (found) return found;
    }

    // 3. Match by Phone Number
    const cleanPhone = (currentUser.phone || currentUser.username || '').trim().replace(/^0/, '');
    if (cleanPhone) {
      const found = teachers.find(t => t.phoneNumber && t.phoneNumber.trim().replace(/^0/, '') === cleanPhone);
      if (found) return found;
    }

    // 4. Match by Full Name
    const cleanName = cleanTeacherName(currentUser.fullName || currentUser.name || '');
    if (cleanName) {
      const found = teachers.find(t => {
        const tName = cleanTeacherName(t.fullName || t.name || '');
        return tName === cleanName || cleanName.includes(tName) || tName.includes(cleanName);
      });
      if (found) return found;
    }

    // Fallback: create mock teacher from currentUser
    return {
      id: currentUser.id,
      fullName: currentUser.fullName || currentUser.name || 'استاد محترم',
      name: currentUser.name || currentUser.fullName,
      phoneNumber: currentUser.phone,
      nationalId: currentUser.nationalId,
      categories: ['ویژه'],
      priority: 1,
      isActive: true,
      createdAt: new Date().toISOString()
    };
  }, [currentUser, teachers]);

  // All teaching programs assigned to this teacher (combining regular programs & manual schedules)
  const teacherPrograms = useMemo(() => {
    if (!currentTeacherObj) return [];
    const tClean = cleanTeacherName(currentTeacherObj.fullName || currentTeacherObj.name || '');
    const tId = currentTeacherObj.id;

    const list: Program[] = [];

    // From regular school programs
    programs.forEach(p => {
      const pTeacher = cleanTeacherName(p.teacher || (p as any).teacherName || '');
      const pTeacherId = (p as any).teacherId;
      const match = (pTeacherId && pTeacherId === tId) || (pTeacher && (pTeacher === tClean || pTeacher.includes(tClean) || tClean.includes(pTeacher)));
      if (match) {
        list.push({
          ...p,
          days: getProgramDays(p)
        });
      }
    });

    // From manual teacher schedules
    manualSchedules.forEach(m => {
      const mTeacher = cleanTeacherName(m.teacherName || '');
      const mTeacherId = m.teacherId;
      const match = (mTeacherId && mTeacherId === tId) || (mTeacher && (mTeacher === tClean || mTeacher.includes(tClean) || tClean.includes(mTeacher)));
      if (match) {
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
  }, [programs, manualSchedules, currentTeacherObj]);

  // Is this teacher a Counseling Teacher?
  const isCounselingTeacher = useMemo(() => {
    if (!currentTeacherObj) return false;
    
    // Check categories in teacher profile
    const hasCategory = (currentTeacherObj.categories || []).some(cat => 
      cat.includes('مشاوره') || cat === 'مشاوره اصول' || cat === 'مشاوره فقه' || cat === 'مشاوره فلسفه'
    );
    if (hasCategory) return true;

    // Check programs
    const hasCounselingProgram = teacherPrograms.some(p => 
      p.title?.includes('مشاوره') || (p.type as string) === 'مشاوره' || (p.type as string) === 'counseling' || (p as any).category?.includes('مشاوره')
    );
    if (hasCounselingProgram) return true;

    // Check specialties
    const spec = currentTeacherObj.detailedSpecialties;
    if (spec && (spec.usul?.length || spec.fiqh?.length || spec.falsafa?.length)) return true;

    // Check currentUser flags and role titles
    if ((currentUser as any)?.canEditCounseling || (currentUser as any)?.canViewCounseling) return true;
    if (currentUser?.roleTitle?.includes('مشاوره')) return true;
    if (currentUser?.fullName?.includes('مشاور') || currentUser?.name?.includes('مشاور')) return true;

    return false;
  }, [currentTeacherObj, teacherPrograms, currentUser]);

  // Auto-switch directly into counseling registration for counseling teachers upon login
  useEffect(() => {
    if (!loading && !hasAutoDirected) {
      if (isCounselingTeacher) {
        setActiveTab('counseling');
      }
      setHasAutoDirected(true);
    }
  }, [loading, isCounselingTeacher, hasAutoDirected]);

  // Counseling courses taught by this teacher
  const counselingPrograms = useMemo(() => {
    const list = teacherPrograms.filter(p => 
      p.title?.includes('مشاوره') || (p.type as string) === 'مشاوره' || (p.type as string) === 'counseling' || (p as any).category?.includes('مشاوره')
    );
    // If no explicit counseling program exists but teacher is counseling teacher, expose all their programs or fallback
    if (list.length === 0 && isCounselingTeacher && teacherPrograms.length > 0) {
      return teacherPrograms;
    }
    if (list.length === 0 && isCounselingTeacher) {
      return [{
        id: `fallback-counseling-${currentTeacherObj?.id || 'default'}`,
        title: 'کلاس مشاوره و ارزیابی تحصیلی',
        type: 'counseling' as any,
        teacher: currentTeacherObj?.fullName || currentTeacherObj?.name || 'استاد مشاور',
        grade: 'پایه ۷',
        days: ['شنبه', 'دوشنبه', 'چهارشنبه'],
        time: 'ساعت مشاوره',
        madrasRoom: 'مدرس مشاوره'
      }];
    }
    return list;
  }, [teacherPrograms, isCounselingTeacher, currentTeacherObj]);

  // Set default selected counseling course
  useEffect(() => {
    if (counselingPrograms.length > 0 && !selectedCourseId) {
      setSelectedCourseId(counselingPrograms[0].id);
    }
  }, [counselingPrograms, selectedCourseId]);

  const activeCounselingCourse = useMemo(() => {
    return counselingPrograms.find(p => p.id === selectedCourseId) || counselingPrograms[0];
  }, [counselingPrograms, selectedCourseId]);

  // Calculate ONLY the dates when this counseling class had sessions:
  // Rules from user:
  // 1. Show maximum the last 4 classes they had (حداکثر 4 کلاس اخری که داشتند رو نشون بده)
  // 2. Do NOT show unheld classes (کلاسی که برگزار نشده رو هم نشون نده - no holidays, no future dates)
  // 3. The class of that same day (today) and 3 sessions before it (کلاس همان روز و سه جلسه قبلترش)
  const classSessionDates = useMemo(() => {
    if (!activeCounselingCourse) return [];

    const rawCourseDays = getProgramDays(activeCounselingCourse);
    const courseDays = (rawCourseDays && rawCourseDays.length > 0)
      ? rawCourseDays
      : (Array.isArray(activeCounselingCourse.days) && activeCounselingCourse.days.length > 0)
        ? activeCounselingCourse.days
        : (activeCounselingCourse as any).day
          ? [(activeCounselingCourse as any).day]
          : ['شنبه', 'دوشنبه', 'چهارشنبه'];

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
    // "کلاسی که برگزار نشده رو هم نشون نده"
    const heldDates = allDays.filter(dateStr => {
      // Must be on or before today
      if (compareShamsi(dateStr, today) > 0) return false;

      // Must be one of the course's scheduled weekdays
      const weekdayName = getShamsiDayOfWeekName(dateStr);
      if (!courseDays.includes(weekdayName)) return false;

      // Must NOT be a holiday (holiday = class not held!)
      if (isHolidayOnDate(dateStr)) return false;

      return true;
    });

    // "حداکثر 4 کلاس اخری که داشتند رو نشون بده"
    // "کلاس همان روز و سه جلسه قبلترش"
    // Take at most the last 4 held sessions (the latest being today's class if held today, plus 3 sessions before it):
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

    // Sort descending: today's class on top (if held today), followed by the 3 prior held sessions
    const sorted = sessions.reverse();

    // Fallback: If no dates were found (e.g. brand new term or calendar unseeded), fallback to today if today is not a holiday
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

  // Default selected session date to today if available in the 4 sessions, or the latest held session
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

  // Enrolled students in the active counseling course
  const enrolledStudents = useMemo(() => {
    if (!activeCounselingCourse) return [];

    // 1. Direct enrollments
    const courseEnrollments = enrollments.filter(e => e.programId === activeCounselingCourse.id);
    if (courseEnrollments.length > 0) {
      const ids = new Set(courseEnrollments.map(e => e.studentId));
      return students.filter(s => ids.has(s.id));
    }

    // 2. Grade-based fallback (e.g. all students of 'پایه ۷')
    if (activeCounselingCourse.grade) {
      const gradeStudents = students.filter(s => s.grade === activeCounselingCourse.grade);
      if (gradeStudents.length > 0) return gradeStudents;
    }

    return students.slice(0, 15);
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
            graded++;
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

  // Human-readable relative session label (e.g. کلاس همان روز، یک جلسه قبل، دو جلسه قبل، سه جلسه قبل)
  const getSessionRelativeLabel = (session: { date: string; isToday?: boolean }, idx: number) => {
    if (session.isToday) return 'کلاس همان روز (امروز)';
    if (idx === 0) return 'آخرین جلسه برگزارشده';
    if (idx === 1) return 'یک جلسه قبل';
    if (idx === 2) return 'دو جلسه قبل';
    if (idx === 3) return 'سه جلسه قبل';
    return `جلسه ${toPersianDigits(idx + 1)}`;
  };

  // Quick Instant Touch Grading Function (الف، ب، ج، د، غیبت)
  const handleSetStudentScore = async (student: Student, score: CounselingScore) => {
    if (!activeCounselingCourse || !selectedSessionDate) return;

    try {
      const teacherName = currentTeacherObj?.fullName || currentTeacherObj?.name || currentUser?.name || 'استاد مشاور';
      const existing = sessionGradesMap.get(student.id);

      const feedback = teacherNotesMap[student.id] !== undefined 
        ? teacherNotesMap[student.id] 
        : (existing?.counselorFeedback || '');

      const docId = existing?.id || `csg-${student.id}-${selectedSessionDate.replace(/\//g, '-')}-${Date.now()}`;

      const gradeDoc: CounselingSessionGrade = {
        id: docId,
        studentId: student.id,
        studentName: student.name,
        grade: student.grade || activeCounselingCourse.grade || 'عمومی',
        counselorTeacherName: teacherName,
        courseTitle: activeCounselingCourse.title,
        sessionDate: selectedSessionDate,
        sessionNumber: `جلسه ${classSessionDates.find(s => s.date === selectedSessionDate)?.sessionNumber || 1}`,
        participationScore: score,
        researchScore: score,
        counselorFeedback: feedback.trim() || undefined,
        createdAt: existing?.createdAt || new Date().toISOString(),
        createdByName: currentUser?.name || teacherName,
        createdByRole: 'استاد',
        updatedAt: new Date().toISOString()
      };

      await localDb.setDoc('counseling_session_grades', gradeDoc);
      setGrades(prev => [...prev.filter(g => g.id !== docId), gradeDoc]);

      setFeedbackSavedStudentId(student.id);
      setTimeout(() => setFeedbackSavedStudentId(null), 1500);
    } catch (err) {
      console.error('Error saving counseling score:', err);
      showToast('خطا در ثبت نمره ارزیابی');
    }
  };

  // Quick Action: Mark all ungraded students as "الف" (One-Tap Efficiency)
  const handleQuickGradeAllA = async () => {
    if (!activeCounselingCourse || !selectedSessionDate || enrolledStudents.length === 0) return;

    try {
      const teacherName = currentTeacherObj?.fullName || currentTeacherObj?.name || currentUser?.name || 'استاد مشاور';
      const sessionInfo = classSessionDates.find(s => s.date === selectedSessionDate);
      const sessionLabel = `جلسه ${sessionInfo?.sessionNumber || 1}`;

      const updates: CounselingSessionGrade[] = [];

      for (const student of enrolledStudents) {
        const existing = sessionGradesMap.get(student.id);
        if (!existing) {
          const docId = `csg-${student.id}-${selectedSessionDate.replace(/\//g, '-')}-${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
          const gradeDoc: CounselingSessionGrade = {
            id: docId,
            studentId: student.id,
            studentName: student.name,
            grade: student.grade || activeCounselingCourse.grade || 'عمومی',
            counselorTeacherName: teacherName,
            courseTitle: activeCounselingCourse.title,
            sessionDate: selectedSessionDate,
            sessionNumber: sessionLabel,
            participationScore: 'الف',
            researchScore: 'الف',
            counselorFeedback: undefined,
            createdAt: new Date().toISOString(),
            createdByName: currentUser?.name || teacherName,
            createdByRole: 'استاد',
            updatedAt: new Date().toISOString()
          };
          await localDb.setDoc('counseling_session_grades', gradeDoc);
          updates.push(gradeDoc);
        }
      }

      if (updates.length > 0) {
        setGrades(prev => [...prev, ...updates]);
        showToast(`${updates.length} دانش‌پژوه با نمره «الف» ثبت شدند.`);
      } else {
        showToast('تمام دانش‌پژوهان این جلسه قبلاً ارزیابی شده‌اند.');
      }
    } catch (err) {
      console.error('Error auto-grading students:', err);
      showToast('خطا در ثبت گروهی نمرات');
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
    <div className="min-h-screen bg-slate-100/90 text-slate-800 pb-16 font-vazir antialiased" dir="rtl">
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
                  {currentTeacherObj?.fullName || 'استاد محترم'}
                </h1>
                <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full font-bold">
                  استاد مدرسه
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {currentTeacherObj?.phoneNumber ? `همراه: ${currentTeacherObj.phoneNumber}` : 'سامانه آموزشی و ارزیابی اساتید'}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
            title="خروج از حساب کاربری"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline">خروج</span>
          </button>
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

            {isCounselingTeacher ? (
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
            ) : (
              <button
                onClick={() => {
                  showToast('شما کلاس مشاوره فعال ندارید.');
                }}
                className="py-2 rounded-xl text-slate-400 flex items-center justify-center gap-1.5 cursor-not-allowed opacity-60"
              >
                <BookCheck size={15} />
                <span>ارزیابی مشاوره</span>
              </button>
            )}

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
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs font-bold space-y-2">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>در حال بارگذاری اطلاعات پنل استاد...</p>
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
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl">
                      {teacherPrograms.length} درس / سرفصل
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    جدول جلسات، ساعت‌ها و کلاس‌های اختصاص‌یافته به شما بر اساس تقویم آموزشی مدرسه:
                  </p>
                </div>

                {teacherPrograms.length === 0 ? (
                  <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 space-y-2">
                    <GraduationCap size={36} className="text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">برنامه درسی ثبت‌شده‌ای یافت نشد.</p>
                    <p className="text-[11px] text-slate-400">
                      جهت تنظیم یا به‌روزرسانی ساعات تدریس با مسئول آموزش مدرسه تماس حاصل فرمایید.
                    </p>
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
                {/* Header Card */}
                <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-5 text-white shadow-md space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                      سامانه ثبت ارزیابی و مشاوره
                    </span>
                    <Award size={18} className="text-emerald-200" />
                  </div>
                  <h2 className="text-base font-black">
                    ثبت نمرات و مشارکت جلسات مشاوره
                  </h2>
                  <p className="text-xs text-emerald-100 leading-relaxed">
                    فقط جلسات برگزارشده کلاس شما در این بخش فعال است (کلاس امروز و حداکثر ۳ جلسه قبل). نمرات را با یک ضربه ثبت فرمایید.
                  </p>
                </div>

                {/* Course Switcher (If multiple counseling classes exist) */}
                {counselingPrograms.length > 1 && (
                  <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-500">انتخاب کلاس مشاوره:</label>
                    <select
                      value={selectedCourseId}
                      onChange={(e) => {
                        setSelectedCourseId(e.target.value);
                        setSelectedSessionDate('');
                      }}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {counselingPrograms.map(prog => (
                        <option key={prog.id} value={prog.id}>
                          {prog.title} ({prog.grade || 'پایه'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* PROMPT BANNER: Requested scoring for held class dates (Max 4 sessions: today + 3 prior sessions) */}
                <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-teal-500/10 border-2 border-emerald-500/30 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                      <Sparkles size={20} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-slate-900">
                          درخواست ثبت نمرات جلسات مشاوره
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                          اقدام استاد مشاور
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed font-medium">
                        استاد محترم؛ لطفاً برای تاریخ‌هایی که کلاس داشتید (کلاس همان روز و تا ۳ جلسه قبل‌تر)، وضعیت حضور و نمرات دانش‌پژوهان را ثبت فرمایید.
                      </p>
                    </div>
                  </div>

                  {/* 4 Held Sessions Selector with Live Evaluation Status */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
                      <span className="flex items-center gap-1.5">
                        <CalendarCheck size={15} className="text-emerald-600" />
                        <span>جلسات برگزارشده اخیر ({classSessionDates.length} جلسه):</span>
                      </span>
                      <span className="text-[11px] text-slate-500 font-normal">
                        برای انتخاب جلسه ضربه بزنید
                      </span>
                    </div>

                    {classSessionDates.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2 bg-white rounded-2xl p-4 text-center border border-slate-200">
                        هیچ جلسه برگزارشده‌ای در تقویم آموزشی برای این درس یافت نشد.
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

                {/* Selected Session Action & Fast Grade Controls */}
                <div className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                        <CalendarCheck size={16} className="text-emerald-600" />
                        <span>جلسه انتخابی: {selectedSessionDate}</span>
                        {classSessionDates.find(s => s.date === selectedSessionDate)?.isToday && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                            کلاس امروز
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {classSessionDates.find(s => s.date === selectedSessionDate)?.weekday} - جلسه {toPersianDigits(classSessionDates.find(s => s.date === selectedSessionDate)?.sessionNumber || 1)}
                      </p>
                    </div>

                    {/* Quick All-A Button */}
                    <button
                      onClick={handleQuickGradeAllA}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[11px] font-black transition-all cursor-pointer shadow-2xs"
                      title="ثبت خودکار نمره الف برای تمام طلاب ثبت‌نشده این جلسه"
                    >
                      <Sparkles size={14} />
                      <span>ثبت الف برای همه</span>
                    </button>
                  </div>

                  {/* Status alert for selected session */}
                  {selectedSessionDate && (
                    <div className={cn(
                      "p-2.5 rounded-2xl text-xs font-medium flex items-center justify-between border",
                      (sessionGradingStats[selectedSessionDate]?.isComplete)
                        ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                        : "bg-amber-50/70 border-amber-200 text-amber-900"
                    )}>
                      <div className="flex items-center gap-1.5">
                        {(sessionGradingStats[selectedSessionDate]?.isComplete) ? (
                          <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle size={15} className="text-amber-600 shrink-0" />
                        )}
                        <span>
                          {(sessionGradingStats[selectedSessionDate]?.isComplete)
                            ? 'نمرات تمام دانش‌پژوهان برای این جلسه ثبت شده است.'
                            : 'در این جلسه هنوز نمره برخی از دانش‌پژوهان ثبت نشده است. لطفاً نمرات را تعیین فرمایید.'
                          }
                        </span>
                      </div>
                      <span className="font-bold text-[11px] shrink-0">
                        {sessionGradingStats[selectedSessionDate]?.gradedCount || 0} از {enrolledStudents.length}
                      </span>
                    </div>
                  )}
                </div>

                {/* Students Evaluation List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                      <Users size={14} className="text-slate-400" />
                      <span>دانش‌پژوهان کلاس ({enrolledStudents.length} نفر):</span>
                    </span>
                    <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                      {sessionGradesMap.size} از {enrolledStudents.length} ارزیابی شدند
                    </span>
                  </div>

                  {enrolledStudents.length === 0 ? (
                    <div className="bg-white rounded-3xl p-8 text-center text-slate-400 text-xs font-bold border border-slate-200">
                      دانش‌پژوهی برای این کلاس یا پایه ثبت نشده است.
                    </div>
                  ) : (
                    enrolledStudents.map(student => {
                      const existingGrade = sessionGradesMap.get(student.id);
                      const currentScore = existingGrade?.participationScore;
                      const isFeedbackSaved = feedbackSavedStudentId === student.id;

                      return (
                        <div
                          key={student.id}
                          className={cn(
                            "bg-white rounded-3xl p-4 border transition-all space-y-3 shadow-xs",
                            currentScore 
                              ? "border-emerald-200 bg-white" 
                              : "border-slate-200/90"
                          )}
                        >
                          {/* Student Header */}
                          <div className="flex items-center justify-between">
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

                            {/* Current Grade Badge if assigned */}
                            {currentScore && (
                              <div className="flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 size={13} className="text-emerald-600" />
                                <span>نمره: {currentScore}</span>
                              </div>
                            )}
                          </div>

                          {/* Quick 5 Buttons: الف ، ب ، ج ، د ، غیبت */}
                          <div className="grid grid-cols-5 gap-1.5 pt-1">
                            {/* 1. الف (عالی) */}
                            <button
                              type="button"
                              onClick={() => handleSetStudentScore(student, 'الف')}
                              className={cn(
                                "py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center border active:scale-95",
                                currentScore === 'الف'
                                  ? "bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-300"
                                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200"
                              )}
                            >
                              <span className="text-sm">الف</span>
                              <span className="text-[9px] opacity-80">عالی</span>
                            </button>

                            {/* 2. ب (خوب) */}
                            <button
                              type="button"
                              onClick={() => handleSetStudentScore(student, 'ب')}
                              className={cn(
                                "py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center border active:scale-95",
                                currentScore === 'ب'
                                  ? "bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-300"
                                  : "bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200"
                              )}
                            >
                              <span className="text-sm">ب</span>
                              <span className="text-[9px] opacity-80">خوب</span>
                            </button>

                            {/* 3. ج (متوسط) */}
                            <button
                              type="button"
                              onClick={() => handleSetStudentScore(student, 'ج')}
                              className={cn(
                                "py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center border active:scale-95",
                                currentScore === 'ج'
                                  ? "bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-300"
                                  : "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200"
                              )}
                            >
                              <span className="text-sm">ج</span>
                              <span className="text-[9px] opacity-80">متوسط</span>
                            </button>

                            {/* 4. د (ضعیف) */}
                            <button
                              type="button"
                              onClick={() => handleSetStudentScore(student, 'د')}
                              className={cn(
                                "py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center border active:scale-95",
                                currentScore === 'د'
                                  ? "bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-300"
                                  : "bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200"
                              )}
                            >
                              <span className="text-sm">د</span>
                              <span className="text-[9px] opacity-80">ضعیف</span>
                            </button>

                            {/* 5. غیبت */}
                            <button
                              type="button"
                              onClick={() => handleSetStudentScore(student, 'غیبت')}
                              className={cn(
                                "py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center border active:scale-95",
                                currentScore === 'غیبت'
                                  ? "bg-slate-700 text-white border-slate-800 shadow-md ring-2 ring-slate-400"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                              )}
                            >
                              <span className="text-xs pt-0.5">غیبت</span>
                              <span className="text-[9px] opacity-80">عدم‌حضور</span>
                            </button>
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
                    تعطیلات و رویدادهای تقویم ({holidays.length} مورد):
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
