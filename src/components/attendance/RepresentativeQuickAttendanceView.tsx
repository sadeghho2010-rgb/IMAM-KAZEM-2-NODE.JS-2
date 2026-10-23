import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckSquare, 
  Users, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ArrowRight, 
  Save, 
  ShieldCheck, 
  Sparkles, 
  AlertTriangle, 
  UserCheck, 
  Layers, 
  ChevronLeft,
  BookOpen
} from 'lucide-react';
import { cn, getProgramDays } from '../../lib/utils';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { 
  Program, 
  Student, 
  AttendanceSessionLog, 
  StudentAttendanceDetail, 
  AttendanceStatus, 
  AttendanceSettings,
  AcademicHolidayItem 
} from '../../types';
import { getTodayShamsi, getShamsiDayOfWeekName, subtractDaysShamsi, getConsolidatedSessionLog, normalizeShamsiDateStr, toEnglishDigits } from '../../lib/jalali';

interface RepresentativeQuickAttendanceViewProps {
  onNavigateTab?: (tab: string, studentId?: string) => void;
}

export const RepresentativeQuickAttendanceView: React.FC<RepresentativeQuickAttendanceViewProps> = ({
  onNavigateTab
}) => {
  const { currentUser } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSettings | null>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceSessionLog[]>([]);
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Selected Program & Date
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const todayShamsi = useMemo(() => getTodayShamsi(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayShamsi);

  // Session State
  const [isCancelled, setIsCancelled] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [hasSubstituteTeacher, setHasSubstituteTeacher] = useState(false);
  const [substituteTeacherName, setSubstituteTeacherName] = useState('');

  // Local draft attendance map: studentId -> detail
  const [draftAttendance, setDraftAttendance] = useState<Record<string, {
    status: AttendanceStatus;
    lateMinutes?: number;
    note?: string;
  }>>({});

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [academicHolidays, setAcademicHolidays] = useState<AcademicHolidayItem[]>([]);
  const loadedLogKeyRef = React.useRef<string>('');

  const initialLoadDoneRef = React.useRef(false);

  useEffect(() => {
    loadData(true);

    const unsub = localDb.subscribe(() => loadData(false));
    const handleDataChange = () => loadData(false);

    window.addEventListener('app_data_change', handleDataChange);
    window.addEventListener('collection_change_programs', handleDataChange);
    window.addEventListener('collection_change_enrollments', handleDataChange);

    return () => {
      unsub();
      window.removeEventListener('app_data_change', handleDataChange);
      window.removeEventListener('collection_change_programs', handleDataChange);
      window.removeEventListener('collection_change_enrollments', handleDataChange);
    };
  }, [currentUser]);

  const loadData = async (isInitial = false) => {
    try {
      if (isInitial && !initialLoadDoneRef.current) {
        setIsLoading(true);
      }
      const [allProgs, allStudents, allEnrolls, legacyEnrolls, allSettings, allLogs, allHols] = await Promise.all([
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<Student>('students'),
        localDb.getDocs<any>('course_enrollments'),
        localDb.getDocs<any>('enrollments'),
        localDb.getDocs<AttendanceSettings>('attendance_settings'),
        localDb.getDocs<AttendanceSessionLog>('attendance'),
        localDb.getDocs<AcademicHolidayItem>('academic_holidays')
      ]);

      setAcademicHolidays(allHols || []);

      const normalizeClean = (str?: string): string => {
        if (!str) return '';
        return String(str).trim()
          .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
          .replace(/[٠-٩]/g, d => '٠١٢٣۴٥٦٧۸٩'.indexOf(d).toString())
          .replace(/[ي]/g, 'ی').replace(/[ك]/g, 'ک')
          .replace(/^(سید|شیخ|استاد)\s+/g, '')
          .toLowerCase();
      };

      const sId = currentUser?.studentId || currentUser?.linkedStudentId || currentUser?.id;
      const uNameNorm = normalizeClean(currentUser?.username);
      const cNameNorm = normalizeClean(currentUser?.name || currentUser?.fullName);

      const matchedSt = allStudents.find(s => {
        const stId = String(s.id);
        const stNat = normalizeClean(s.nationalId);
        const stCode = normalizeClean(s.studentCode);
        const stName = normalizeClean(s.name);
        return (
          (sId && stId === String(sId)) ||
          (uNameNorm && (stNat === uNameNorm || stCode === uNameNorm)) ||
          (cNameNorm && stName && (stName.includes(cNameNorm) || cNameNorm.includes(stName)))
        );
      });
      setMatchedStudent(matchedSt || null);

      setPrograms((allProgs || []).filter(p => p.status !== 'deleted' && !(p as any).isDeleted));
      setStudents((allStudents || []).filter(s => s.status !== 'deleted'));
      const combinedEnrollments = [...(allEnrolls || []), ...(legacyEnrolls || [])];
      setEnrollments(combinedEnrollments);
      setAttendanceLogs(allLogs || []);
      if (allSettings && allSettings.length > 0) {
        setAttendanceSettings(allSettings[0]);
      }
    } catch (e) {
      console.warn('Error loading representative attendance data:', e);
    } finally {
      initialLoadDoneRef.current = true;
      setIsLoading(false);
    }
  };

  const normalizeClean = (str?: string): string => {
    if (!str) return '';
    return String(str).trim()
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
      .replace(/[٠-٩]/g, d => '٠١٢٣۴٥٦٧۸٩'.indexOf(d).toString())
      .replace(/[ي]/g, 'ی').replace(/[ك]/g, 'ک')
      .replace(/^(سید|شیخ|استاد)\s+/g, '')
      .toLowerCase();
  };

  // Build candidate IDs and names for current user
  const candidateIds = useMemo(() => {
    const list: string[] = [];
    if (currentUser?.id) list.push(String(currentUser.id));
    if (currentUser?.studentId) list.push(String(currentUser.studentId));
    if (currentUser?.linkedStudentId) list.push(String(currentUser.linkedStudentId));
    if (currentUser?.username) list.push(currentUser.username);
    if (matchedStudent?.id) list.push(String(matchedStudent.id));
    if (matchedStudent?.studentCode) list.push(matchedStudent.studentCode);
    if (matchedStudent?.nationalId) list.push(matchedStudent.nationalId);
    return Array.from(new Set(list)).map(x => normalizeClean(x));
  }, [currentUser, matchedStudent]);

  const candidateNames = useMemo(() => {
    const list: string[] = [];
    if (currentUser?.name) list.push(currentUser.name);
    if (currentUser?.fullName) list.push(currentUser.fullName);
    if (matchedStudent?.name) list.push(matchedStudent.name);
    return Array.from(new Set(list)).map(x => normalizeClean(x)).filter(Boolean);
  }, [currentUser, matchedStudent]);

  // Identify all active classes where current user is an assigned representative
  const representedPrograms = useMemo(() => {
    const activeProgs = programs.filter(p => p.status !== 'deleted' && !(p as any).isDeleted);

    // If Level 1 or 2 manager, return all active programs for full management access
    if (currentUser?.level && currentUser.level < 3) {
      return activeProgs;
    }

    return activeProgs.filter(p => {
      // 1. representativeStudentIds array on program (AUTHORITATIVE SOURCE OF TRUTH)
      const repIds = Array.isArray(p.representativeStudentIds) 
        ? p.representativeStudentIds.map(x => normalizeClean(String(x))).filter(Boolean)
        : [];
      
      // If program has assigned student IDs, ONLY those specific students are representatives
      if (repIds.length > 0) {
        return candidateIds.some(cid => repIds.includes(cid));
      }

      // 2. Only if NO representativeStudentIds are set, fallback to clean exact match in representativeNames
      const repNames = Array.isArray(p.representativeNames) 
        ? p.representativeNames.map(x => normalizeClean(String(x)).replace(/\(.*?\)/g, '').trim()).filter(Boolean)
        : [];
      if (repNames.length > 0) {
        if (candidateNames.some(cname => repNames.some(rn => rn === cname))) {
          return true;
        }
      }

      // 3. customRepresentative string (only if no repIds)
      if (p.customRepresentative) {
        const cust = normalizeClean(String(p.customRepresentative)).replace(/\(.*?\)/g, '').trim();
        if (candidateNames.some(cname => cust === cname)) {
          return true;
        }
      }

      return false;
    });
  }, [programs, currentUser, candidateIds, candidateNames]);

  // Select first represented program by default
  useEffect(() => {
    if (representedPrograms.length > 0 && (!selectedProgramId || !representedPrograms.some(p => p.id === selectedProgramId))) {
      setSelectedProgramId(representedPrograms[0].id);
    }
  }, [representedPrograms, selectedProgramId]);

  const currentProgram = useMemo(() => {
    return representedPrograms.find(p => p.id === selectedProgramId) || representedPrograms[0] || null;
  }, [representedPrograms, selectedProgramId]);

  // Helper: check if a course is scheduled to meet on a specific date (matching day of week)
  const isCourseHeldOnDate = (prog: Program | null, dateStr: string): boolean => {
    if (!prog) return false;
    if ((prog as any).status === 'deleted' || (prog as any).isDeleted) return false;

    const dayName = getShamsiDayOfWeekName(dateStr);
    const norm = (s: string) => s.replace(/[\u200c\s]/g, '').trim().toLowerCase();
    const targetNorm = norm(dayName);

    const isFriday = targetNorm === 'جمعه';

    const progDays = getProgramDays(prog);

    if (!progDays || progDays.length === 0) {
      return !isFriday && targetNorm !== 'پنجشنبه';
    }

    return progDays.some(d => {
      const dNorm = norm(d);
      return dNorm === targetNorm;
    });
  };

  // Allowed days window from education settings (default: 7 days)
  const allowedDaysCount = attendanceSettings?.representativeEditWindowDays || 7;

  // Allowed quick dates list with class day check
  const allowedDates = useMemo(() => {
    const dates: { dateStr: string; label: string; dayName: string; isClassDay: boolean }[] = [];
    for (let i = 0; i < allowedDaysCount; i++) {
      const d = subtractDaysShamsi(todayShamsi, i);
      const dayName = getShamsiDayOfWeekName(d);
      const isClassDay = isCourseHeldOnDate(currentProgram, d);

      let lbl = d;
      if (i === 0) lbl = 'امروز';
      else if (i === 1) lbl = 'دیروز';
      else lbl = `${i} روز پیش`;

      dates.push({ dateStr: d, label: lbl, dayName, isClassDay });
    }
    return dates;
  }, [todayShamsi, allowedDaysCount, currentProgram]);

  // Smart date selection: Auto-select most recent held class day if current selected date is an off-day (e.g. Friday)
  useEffect(() => {
    if (allowedDates.length === 0 || !currentProgram) return;

    const isCurrentDateClassDay = isCourseHeldOnDate(currentProgram, selectedDate);
    if (!isCurrentDateClassDay) {
      const firstClassDay = allowedDates.find(ad => ad.isClassDay);
      if (firstClassDay) {
        setSelectedDate(firstClassDay.dateStr);
      }
    }
  }, [allowedDates, currentProgram]);

  // Get enrolled students for the currently selected program
  const classStudents = useMemo(() => {
    if (!currentProgram) return [];

    const programGrade = currentProgram.grade || '';

    // If explicit enrollments exist in course_enrollments
    const directEnrollments = enrollments.filter(e => 
      String(e.programId) === String(currentProgram.id) && 
      e.status !== 'deleted' && 
      e.status !== 'inactive'
    );
    const directEnrolledIds = new Set(directEnrollments.map(e => String(e.studentId)));

    // If program has studentIds array
    const programStudentIds = new Set(
      Array.isArray((currentProgram as any).studentIds) 
        ? (currentProgram as any).studentIds.map(String) 
        : []
    );

    const hasProgramStudentIds = Array.isArray((currentProgram as any).studentIds);
    const hasExplicitProgramConfig = Boolean((currentProgram as any).hasExplicitEnrollment) || (hasProgramStudentIds && (currentProgram as any).studentIds.length > 0);

    return students.filter(s => {
      if (s.status === 'deleted' || (s as any).isDeleted) return false;
      const sIdStr = String(s.id);
      if (hasExplicitProgramConfig) {
        return programStudentIds.has(sIdStr);
      }
      if (directEnrolledIds.size > 0) {
        return directEnrolledIds.has(sIdStr);
      }
      // Grade-based matching fallback
      if (!programGrade || programGrade === 'همه پایه‌ها' || programGrade === 'همه') return true;
      return s.grade === programGrade;
    }).sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'fa'));
  }, [currentProgram, students, enrollments]);

  // Load existing session log for the selected program and date
  useEffect(() => {
    if (!currentProgram || !selectedDate) return;

    const cleanDate = selectedDate.replace(/\//g, '-');
    const expectedLogId = `${currentProgram.id}_${cleanDate}`;
    const sessionKey = `${currentProgram.id}_${selectedDate}`;

    if (loadedLogKeyRef.current === sessionKey) {
      // Already initialized for this class session. Preserve user's live edits!
      return;
    }
    loadedLogKeyRef.current = sessionKey;

    const existing = getConsolidatedSessionLog(attendanceLogs, currentProgram.id, selectedDate, currentProgram.title);

    if (existing) {
      setIsCancelled(existing.isCancelled || false);
      setCancellationReason(existing.cancellationReason || '');
      setHasSubstituteTeacher(existing.hasSubstituteTeacher || false);
      setSubstituteTeacherName(existing.substituteTeacherName || '');

      const draft: Record<string, { status: AttendanceStatus; lateMinutes?: number; note?: string }> = {};
      (existing.students || []).forEach(st => {
        draft[String(st.studentId)] = {
          status: st.status || 'present',
          lateMinutes: st.lateMinutes,
          note: st.note
        };
      });
      setDraftAttendance(draft);
    } else {
      setIsCancelled(false);
      setCancellationReason('');
      setHasSubstituteTeacher(false);
      setSubstituteTeacherName('');
      setDraftAttendance({});
    }
  }, [currentProgram?.id, selectedDate, attendanceLogs]);

  // Fast attendance status updater
  const handleSetStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setDraftAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        status,
        lateMinutes: status === 'late' ? (prev[studentId]?.lateMinutes || 10) : undefined
      }
    }));
  };

  const handleSetStudentLateMinutes = (studentId: string, mins: number) => {
    const capped = Math.max(1, Math.min(15, Number(mins) || 1));
    setDraftAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        status: 'late',
        lateMinutes: capped
      }
    }));
  };

  const handleMarkAllPresent = () => {
    const nextDraft: Record<string, { status: AttendanceStatus; lateMinutes?: number; note?: string }> = {};
    classStudents.forEach(st => {
      nextDraft[String(st.id)] = {
        status: 'present',
        note: draftAttendance[String(st.id)]?.note
      };
    });
    setDraftAttendance(nextDraft);
  };

  // Check if selected date is an official school holiday according to Academic Calendar
  const currentHoliday = useMemo(() => {
    if (!selectedDate || academicHolidays.length === 0) return null;
    const progGrade = currentProgram?.grade;
    return academicHolidays.find(h => {
      const isDateMatch = (h.startDate && h.endDate) 
        ? (selectedDate >= h.startDate && selectedDate <= h.endDate) 
        : (h.startDate === selectedDate);
      if (!isDateMatch) return false;
      if (!h.grades || h.grades.length === 0 || h.grades.includes('all')) return true;
      if (!progGrade) return true;
      return h.grades.some(g => g === 'all' || g === progGrade || progGrade.includes(g) || g.includes(progGrade));
    }) || null;
  }, [selectedDate, academicHolidays, currentProgram]);

  // Submit and save attendance
  const handleSaveAttendance = async () => {
    if (!currentProgram) return;

    if (currentHoliday) {
      alert(`تاریخ ${selectedDate} در تقویم آموزشی به عنوان روز تعطیل («${currentHoliday.title}») ثبت شده است و امکان ایجاد یا ثبت حضور و غیاب برای این روز وجود ندارد.`);
      return;
    }

    const isClassDay = isCourseHeldOnDate(currentProgram, selectedDate);
    if (!isClassDay) {
      const dayName = getShamsiDayOfWeekName(selectedDate);
      alert(`تاریخ ${selectedDate} (${dayName}) روز درسی برای کلاس «${currentProgram.title}» نیست و امکان ثبت حضور و غیاب برای آن وجود ندارد.`);
      return;
    }

    // Authorization check: Verify user is still an active representative of currentProgram
    const isLevelManager = currentUser?.level && currentUser.level < 3;
    const isAuthorizedForThisClass = isLevelManager || representedPrograms.some(p => String(p.id) === String(currentProgram.id));
    if (!isAuthorizedForThisClass) {
      alert(`شما دیگر نماینده کلاس «${currentProgram.title}» نیستید و امکان ثبت یا ویرایش حضور و غیاب برای این درس را ندارید.`);
      return;
    }

    try {
      setIsSaving(true);
      const normDate = normalizeShamsiDateStr(selectedDate);
      const cleanDate = toEnglishDigits(normDate).replace(/[\/\-]/g, '-');
      const targetCleanDigits = toEnglishDigits(normDate).replace(/[\/\-]/g, '');
      const logId = `${currentProgram.id}_${cleanDate}`;
      const dayName = getShamsiDayOfWeekName(selectedDate);
      const nowIso = new Date().toISOString();

      const studentsDetailList: StudentAttendanceDetail[] = classStudents.map(st => {
        const d = draftAttendance[String(st.id)];
        const currentStatus: AttendanceStatus = isCancelled ? 'unspecified' : (d?.status || 'present');

        return {
          studentId: String(st.id),
          studentName: st.name,
          nationalId: st.nationalId,
          status: currentStatus,
          lateMinutes: currentStatus === 'late' ? Math.min(15, Math.max(1, d?.lateMinutes || 10)) : undefined,
          note: d?.note || (isCancelled ? 'تعطیلی کلاس' : undefined),
          recordedMethod: 'representative',
          recordedAt: nowIso,
          updatedAt: nowIso
        };
      });

      const presentCount = isCancelled ? 0 : studentsDetailList.filter(s => s.status === 'present').length;
      const absentCount = isCancelled ? 0 : studentsDetailList.filter(s => s.status === 'absent').length;
      const lateCount = isCancelled ? 0 : studentsDetailList.filter(s => s.status === 'late').length;

      const existingInDb = getConsolidatedSessionLog(attendanceLogs || [], currentProgram.id, selectedDate, currentProgram.title);

      const sessionLog: AttendanceSessionLog = {
        ...(existingInDb || {}),
        id: logId,
        programId: currentProgram.id,
        programTitle: currentProgram.title,
        grade: currentProgram.grade || '',
        date: selectedDate,
        dayOfWeek: dayName,
        isCancelled,
        cancellationReason: isCancelled ? cancellationReason : undefined,
        hasSubstituteTeacher,
        substituteTeacherName: hasSubstituteTeacher ? substituteTeacherName : undefined,
        recordedByUserId: currentUser?.id,
        recordedByName: currentUser?.name || currentUser?.fullName || 'نماینده کلاس',
        recordedAt: existingInDb?.recordedAt || nowIso,
        updatedAt: nowIso,
        students: studentsDetailList,
        presentCount,
        absentCount,
        lateCount
      };

      // Always save to canonical logId
      await localDb.setDoc('attendance', logId, sessionLog);

      // Clean up any stale or duplicate logs for this exact class session in local database
      const allDbLogs = await localDb.getDocs<AttendanceSessionLog>('attendance');
      const duplicatesToDelete = allDbLogs.filter(l => {
        if (!l || l.id === logId) return false;
        const p1 = String(l.programId || (l as any).program_id || '').trim();
        const p2 = String(currentProgram.id || '').trim();
        const isProgMatch = p1 === p2 || (l.id && l.id.startsWith(`${p2}_`)) || (l.programTitle && l.programTitle === currentProgram.title);
        if (!isProgMatch) return false;
        const lClean = toEnglishDigits(normalizeShamsiDateStr(l.date)).replace(/[\/\-]/g, '');
        return lClean === targetCleanDigits;
      });

      for (const dup of duplicatesToDelete) {
        if (dup.id) {
          try {
            await localDb.deleteDoc('attendance', dup.id);
          } catch (e) {}
        }
      }

      // Update local state by removing duplicates and setting fresh sessionLog
      setAttendanceLogs(prev => {
        const filtered = prev.filter(l => {
          if (l.id === logId) return false;
          const p1 = String(l.programId || (l as any).program_id || '').trim();
          const p2 = String(currentProgram.id || '').trim();
          const isProgMatch = p1 === p2 || (l.id && l.id.startsWith(`${p2}_`)) || (l.programTitle && l.programTitle === currentProgram.title);
          if (!isProgMatch) return true;
          const lClean = toEnglishDigits(normalizeShamsiDateStr(l.date)).replace(/[\/\-]/g, '');
          return lClean !== targetCleanDigits;
        });
        return [sessionLog, ...filtered];
      });

      // Reset log key ref so fresh saved session log is acknowledged
      loadedLogKeyRef.current = `${currentProgram.id}_${selectedDate}`;

      setSaveSuccessMsg(`حضور و غیاب کلاس «${currentProgram.title}» برای تاریخ ${selectedDate} با موفقیت ثبت و ذخیره گردید.`);
      setTimeout(() => setSaveSuccessMsg(''), 4500);

      window.dispatchEvent(new CustomEvent('app_data_change', { detail: { collection: 'attendance', id: logId } }));
      window.dispatchEvent(new CustomEvent('attendance_updated', { detail: { logId, programId: currentProgram.id, date: selectedDate } }));
    } catch (e: any) {
      console.error('Error saving representative attendance:', e);
      alert('خطا در ذخیره حضور و غیاب: ' + (e?.message || 'مجدداً تلاش فرمایید'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center font-vazir shadow-xs max-w-4xl mx-auto my-6" dir="rtl">
        <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold text-slate-700">در حال بارگذاری سامانه ثبت حضور و غیاب نمایندگان...</p>
      </div>
    );
  }

  // If user is not a representative of ANY class
  if (representedPrograms.length === 0) {
    return (
      <div className="max-w-2xl mx-auto my-8 p-6 sm:p-8 bg-white rounded-3xl border border-slate-200 shadow-lg text-center font-vazir space-y-5" dir="rtl">
        <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-sm">
          <AlertCircle size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-black text-slate-800">
            شما نماینده هیچ کلاسی نیستید
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
            ثبت حضور و غیاب کلاس‌ها توسط نماینده منتخب هر کلاس انجام می‌پذیرد. در صورتی که به عنوان نماینده تعیین شده‌اید، با مسئول آموزش یا مدیر سامانه تماس حاصل فرمایید.
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => onNavigateTab ? onNavigateTab('dashboard') : window.history.back()}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer shadow-md"
          >
            <ArrowRight size={16} />
            <span>بازگشت به پیشخوان اصلی</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto font-vazir text-right space-y-4 pb-16" dir="rtl">
      {/* 1. Header Navigation Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
            <CheckSquare size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-800">
                ثبت حضور و غیاب (مخصوص نمایندگان کلاس)
              </h1>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {representedPrograms.length} کلاس تحت نمایندگی
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              محیط ساده، سریع و اختصاصی ثبت حضور و غیاب جلسات درسی
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab ? onNavigateTab('dashboard') : window.history.back()}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowRight size={15} />
          <span>بازگشت به پیشخوان</span>
        </button>
      </div>

      {saveSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-bold flex items-center gap-2 shadow-xs">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* 2. REQUISITE: Represented Classes as Compact, Beautiful Cards (کارت‌های کوچک و زیبا) */}
      <div className="space-y-2">
        <label className="text-xs font-black text-slate-700 flex items-center gap-1.5 px-1">
          <Sparkles size={14} className="text-indigo-600" />
          <span>کلاس‌های تحت نمایندگی شما (جهت شیفت و جابجایی سریع کلیک فرمایید):</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {representedPrograms.map(p => {
            const isSelected = p.id === currentProgram?.id;
            return (
              <div
                key={p.id}
                onClick={() => setSelectedProgramId(p.id)}
                className={cn(
                  "p-3 rounded-2xl border transition-all cursor-pointer relative overflow-hidden select-none flex flex-col justify-between gap-2",
                  isSelected
                    ? "bg-gradient-to-br from-indigo-700 via-indigo-800 to-indigo-950 text-white border-indigo-600 shadow-md shadow-indigo-950/20 scale-[1.02]"
                    : "bg-white text-slate-800 border-slate-200 hover:border-indigo-300 hover:bg-slate-50/80 shadow-2xs"
                )}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <span className={cn(
                    "text-[10px] font-black px-2 py-0.5 rounded-lg border",
                    isSelected 
                      ? "bg-white/20 text-white border-white/30"
                      : "bg-indigo-50 text-indigo-700 border-indigo-100"
                  )}>
                    {p.type || 'درس اصلی'}
                  </span>
                  {p.grade && (
                    <span className={cn(
                      "text-[10px] font-bold font-mono",
                      isSelected ? "text-indigo-200" : "text-slate-500"
                    )}>
                      {p.grade}
                    </span>
                  )}
                </div>

                <div>
                  <h4 className={cn("text-xs font-black truncate leading-snug", isSelected ? "text-white" : "text-slate-900")}>
                    {p.title}
                  </h4>
                  <p className={cn("text-[11px] truncate mt-0.5 font-medium", isSelected ? "text-indigo-200" : "text-slate-500")}>
                    استاد: {p.teacher || 'تعیین‌نشده'}
                  </p>
                </div>

                <div className={cn(
                  "pt-1.5 border-t text-[10px] flex items-center justify-between font-mono",
                  isSelected ? "border-white/15 text-indigo-200" : "border-slate-100 text-slate-400"
                )}>
                  <span>{p.time || 'زمان مشخص'}</span>
                  {isSelected && <span className="font-bold text-amber-300">● فعال</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Session Controls: Date Selector + Class Status (تعطیلی / استاد جایگزین) */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        {/* Date Selector restricted to allowed window */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Calendar size={14} className="text-indigo-600" />
              <span>انتخاب تاریخ جلسه (مجاز تا {allowedDaysCount} روز گذشته طبق مصوبه آموزش):</span>
            </label>
            <span className="text-[11px] font-bold text-indigo-600 font-mono">
              روز: {getShamsiDayOfWeekName(selectedDate)} ({selectedDate})
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {allowedDates.map(({ dateStr, label, dayName, isClassDay }) => {
              const isDateSelected = dateStr === selectedDate;
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setSelectedDate(dateStr)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5",
                    isDateSelected
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs font-black"
                      : isClassDay
                        ? "bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 border-indigo-200"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-400 border-slate-200"
                  )}
                >
                  <span>{label}</span>
                  <span className="text-[10px] font-mono opacity-80">({dayName})</span>
                  {!isClassDay && <span className="text-[9px] px-1 bg-slate-200 text-slate-600 rounded font-medium">تعطیل</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Off-day Notice (when selected date is not a class day for currentProgram) */}
        {!isCourseHeldOnDate(currentProgram, selectedDate) && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-200/80 text-slate-600 flex items-center justify-center shrink-0">
                <Calendar size={18} />
              </div>
              <div>
                <p className="font-black text-slate-900 text-sm">
                  در روز {getShamsiDayOfWeekName(selectedDate)} ({selectedDate}) کلاسی برای «{currentProgram?.title}» تشکیل نمی‌شود
                </p>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  برنامه این درس شامل روز {getShamsiDayOfWeekName(selectedDate)} نمی‌باشد. جهت ثبت حضور، روزهای تشکیل کلاس را انتخاب نمایید.
                </p>
              </div>
            </div>
            {allowedDates.find(ad => ad.isClassDay) && (
              <button
                type="button"
                onClick={() => {
                  const lastHeld = allowedDates.find(ad => ad.isClassDay);
                  if (lastHeld) setSelectedDate(lastHeld.dateStr);
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
              >
                <Clock size={14} />
                <span>آخرین جلسه برگزارشده ({allowedDates.find(ad => ad.isClassDay)?.dayName} {allowedDates.find(ad => ad.isClassDay)?.dateStr})</span>
              </button>
            )}
          </div>
        )}

        {/* Official Holiday Notice */}
        {currentHoliday && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-3">
            <AlertTriangle className="text-amber-600 shrink-0" size={22} />
            <div>
              <p className="font-black text-amber-950 text-sm">
                این تاریخ در تقویم آموزشی به عنوان روز تعطیل («{currentHoliday.title}») ثبت شده است
              </p>
              <p className="text-[11px] text-amber-800 mt-1">
                طبق تقویم آموزشی، این روز تعطیل رسمی است و حضور و غیاب برای آن ایجاد یا ثبت نمی‌شود.
              </p>
            </div>
          </div>
        )}

        {/* Quick Class Status Actions: کلاس تعطیل بود / استاد جایگزین آمد */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Class Cancelled Button */}
            <button
              type="button"
              onClick={() => setIsCancelled(!isCancelled)}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer",
                isCancelled
                  ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-rose-50 hover:text-rose-700"
              )}
            >
              <AlertTriangle size={15} />
              <span>کلاس در این تاریخ تعطیل بود</span>
              {isCancelled && <span className="text-[10px] bg-rose-700 px-1.5 py-0.2 rounded">فعال</span>}
            </button>

            {/* Substitute Teacher Button */}
            <button
              type="button"
              onClick={() => setHasSubstituteTeacher(!hasSubstituteTeacher)}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer",
                hasSubstituteTeacher
                  ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:text-amber-700"
              )}
            >
              <UserCheck size={15} />
              <span>استاد جایگزین آمد</span>
              {hasSubstituteTeacher && <span className="text-[10px] bg-amber-700 px-1.5 py-0.2 rounded">فعال</span>}
            </button>

            <button
              type="button"
              onClick={handleMarkAllPresent}
              disabled={isCancelled}
              className="mr-auto px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <CheckCircle2 size={15} className="text-emerald-600" />
              <span>حاضر کردن همه طلاب</span>
            </button>
          </div>

          {/* Conditional inputs */}
          {isCancelled && (
            <div className="pt-2 border-t border-slate-200">
              <input
                type="text"
                placeholder="علت تعطیلی کلاس (مثلاً: تعطیلی رسمی، ماموریت استاد و...)"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-rose-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          )}

          {hasSubstituteTeacher && (
            <div className="pt-2 border-t border-slate-200">
              <input
                type="text"
                placeholder="نام و نام خانوادگی استاد جایگزین این جلسه"
                value={substituteTeacherName}
                onChange={(e) => setSubstituteTeacherName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* 4. Student Attendance List (Clean, Ultra-Simple like TeacherPortal / ارزیابی استاد مشاوره) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <Users size={16} className="text-indigo-600" />
              <span>لیست طلاب کلاس «{currentProgram?.title}»</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              تعداد طلاب کلاس: {classStudents.length} نفر • وضعیت پیش‌فرض پس از ذخیره: حاضر
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500 font-mono">
            تاریخ: {selectedDate}
          </span>
        </div>

        {classStudents.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs italic">
            هیچ طلبه‌ای برای این کلاس ثبت‌نام نشده است.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {classStudents.map((st, idx) => {
              const studentDraft = draftAttendance[String(st.id)];
              const status: AttendanceStatus = studentDraft?.status || 'present';
              const lateMins = studentDraft?.lateMinutes || 10;

              return (
                <div 
                  key={st.id} 
                  className={cn(
                    "p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors",
                    status === 'absent' ? "bg-rose-50/30" :
                    status === 'late' ? "bg-amber-50/30" :
                    status === 'excused' ? "bg-blue-50/30" :
                    "hover:bg-slate-50/60"
                  )}
                >
                  {/* Student Info */}
                  <div className="flex items-center gap-2.5 min-w-[200px]">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-black flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-slate-900">
                        {st.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        کد طلبی: {st.studentCode || st.nationalId || '---'} {st.grade ? `(${st.grade})` : ''}
                      </p>
                    </div>
                  </div>

                  {/* 4 Status Quick Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* حاضر */}
                    <button
                      type="button"
                      disabled={isCancelled}
                      onClick={() => handleSetStudentStatus(String(st.id), 'present')}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1",
                        status === 'present' && !isCancelled
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs font-black"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-800"
                      )}
                    >
                      <span>حاضر</span>
                    </button>

                    {/* غایب */}
                    <button
                      type="button"
                      disabled={isCancelled}
                      onClick={() => handleSetStudentStatus(String(st.id), 'absent')}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1",
                        status === 'absent' && !isCancelled
                          ? "bg-rose-600 text-white border-rose-600 shadow-xs font-black"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-800"
                      )}
                    >
                      <span>غایب</span>
                    </button>

                    {/* تاخیر */}
                    <button
                      type="button"
                      disabled={isCancelled}
                      onClick={() => handleSetStudentStatus(String(st.id), 'late')}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1",
                        status === 'late' && !isCancelled
                          ? "bg-amber-500 text-white border-amber-500 shadow-xs font-black"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-800"
                      )}
                    >
                      <span>تاخیر</span>
                    </button>

                    {/* نامشخص */}
                    <button
                      type="button"
                      disabled={isCancelled}
                      onClick={() => handleSetStudentStatus(String(st.id), 'unspecified')}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1",
                        status === 'unspecified' || !status
                          ? "bg-slate-700 text-white border-slate-700 shadow-xs font-black"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-800"
                      )}
                    >
                      <span>نامشخص</span>
                    </button>

                    {/* Late Minutes Quick Toggle if late */}
                    {status === 'late' && !isCancelled && (
                      <div className="flex items-center gap-1 mr-2 bg-amber-50 px-2 py-1 rounded-xl border border-amber-200 text-[10px] font-bold text-amber-900 flex-wrap">
                        <span>تاخیر:</span>
                        {[5, 10, 15].map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => handleSetStudentLateMinutes(String(st.id), m)}
                            className={cn(
                              "px-1.5 py-0.5 rounded-md cursor-pointer transition-all",
                              lateMins === m ? "bg-amber-600 text-white" : "bg-white text-amber-800 hover:bg-amber-100"
                            )}
                          >
                            {m}
                          </button>
                        ))}
                        <div className="flex items-center gap-0.5 border-r border-amber-200 pr-1 mr-0.5">
                          <input
                            type="number"
                            min={1}
                            max={15}
                            value={lateMins || 10}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              const capped = isNaN(val) ? 1 : Math.max(1, Math.min(15, val));
                              handleSetStudentLateMinutes(String(st.id), capped);
                            }}
                            className="w-10 px-1 py-0.5 bg-white border border-amber-300 rounded text-center font-mono font-bold text-[11px] text-amber-950 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                          <span className="text-[9px] text-amber-700">دقیقه</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 5. Final Save Button */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            <span>پس از ثبت، اطلاعات به صورت برخط در سامانه ذخیره و در تمامی دستگاه‌ها سینک می‌شود.</span>
          </div>

          <button
            type="button"
            onClick={handleSaveAttendance}
            disabled={isSaving || classStudents.length === 0 || !isCourseHeldOnDate(currentProgram, selectedDate) || !!currentHoliday}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-indigo-600/20 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-40"
          >
            <Save size={16} />
            <span>{isSaving ? 'در حال ذخیره‌سازی...' : 'ثبت و ذخیره نهایی حضور و غیاب این جلسه'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
