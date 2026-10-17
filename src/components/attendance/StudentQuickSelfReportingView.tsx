import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ArrowRight, 
  Save, 
  BookOpen, 
  User, 
  Info,
  Check
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { 
  Program, 
  Student, 
  AttendanceSessionLog, 
  StudentAttendanceDetail, 
  AttendanceStatus, 
  AttendanceSettings 
} from '../../types';
import { getTodayShamsi, getShamsiDayOfWeekName, subtractDaysShamsi } from '../../lib/jalali';

interface StudentQuickSelfReportingViewProps {
  onNavigateTab?: (tab: string, studentId?: string) => void;
}

export const StudentQuickSelfReportingView: React.FC<StudentQuickSelfReportingViewProps> = ({
  onNavigateTab
}) => {
  const { currentUser } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSettings | null>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceSessionLog[]>([]);
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const todayShamsi = useMemo(() => getTodayShamsi(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayShamsi);

  // Draft status per self-reporting programId: { status: 'present'|'absent'|'late', lateMinutes: number, note: string }
  const [draftCourseStatus, setDraftCourseStatus] = useState<Record<string, {
    status: AttendanceStatus;
    lateMinutes: number;
    note: string;
  }>>({});

  const [savingProgramId, setSavingProgramId] = useState<string | null>(null);
  const [successMessages, setSuccessMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();

    const unsub = localDb.subscribe(() => loadData());
    const handleDataChange = () => loadData();

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

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [allProgs, allStudents, allEnrolls, allSettings, allLogs] = await Promise.all([
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<Student>('students'),
        localDb.getDocs<any>('course_enrollments'),
        localDb.getDocs<AttendanceSettings>('attendance_settings'),
        localDb.getDocs<AttendanceSessionLog>('attendance')
      ]);

      const sId = currentUser?.studentId || currentUser?.linkedStudentId || currentUser?.id;
      const uName = (currentUser?.username || '').trim().toLowerCase();
      const cName = (currentUser?.name || currentUser?.fullName || '').trim().toLowerCase();

      const matchedSt = (allStudents || []).find(s => 
        (sId && String(s.id) === String(sId)) ||
        (uName && (s.nationalId?.toLowerCase() === uName || s.studentCode?.toLowerCase() === uName)) ||
        (cName && s.name?.toLowerCase().includes(cName))
      );
      setMatchedStudent(matchedSt || null);

      setPrograms((allProgs || []).filter(p => p.status !== 'deleted' && !(p as any).isDeleted));
      setStudents(allStudents || []);
      setEnrollments(allEnrolls || []);
      setAttendanceLogs(allLogs || []);
      if (allSettings && allSettings.length > 0) {
        setAttendanceSettings(allSettings[0]);
      }
    } catch (e) {
      console.warn('Error loading self-reporting data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const candidateIds = useMemo(() => {
    const list: string[] = [];
    if (currentUser?.id) list.push(String(currentUser.id));
    if (currentUser?.studentId) list.push(String(currentUser.studentId));
    if (currentUser?.linkedStudentId) list.push(String(currentUser.linkedStudentId));
    if (currentUser?.username) list.push(currentUser.username);
    if (matchedStudent?.id) list.push(String(matchedStudent.id));
    if (matchedStudent?.studentCode) list.push(matchedStudent.studentCode);
    if (matchedStudent?.nationalId) list.push(matchedStudent.nationalId);
    return Array.from(new Set(list)).map(x => x.trim().toLowerCase());
  }, [currentUser, matchedStudent]);

  // Strict Filter: ONLY active programs that have attendanceType === 'self_reporting' AND this student is enrolled in or matched by grade
  const selfReportingPrograms = useMemo(() => {
    const activeProgs = programs.filter(p => p.status !== 'deleted' && !(p as any).isDeleted);

    return activeProgs.filter(p => {
      if (p.attendanceType !== 'self_reporting') return false;

      // 1. Check course_enrollments
      const inEnroll = enrollments.some(e => 
        String(e.programId) === String(p.id) && 
        candidateIds.includes(String(e.studentId).trim().toLowerCase()) &&
        e.status !== 'deleted' && 
        e.status !== 'inactive'
      );
      if (inEnroll) return true;

      // 2. Check program studentIds array
      if (Array.isArray((p as any).studentIds)) {
        const pStudentIds = (p as any).studentIds.map((x: any) => String(x).trim().toLowerCase());
        if (candidateIds.some(cid => pStudentIds.includes(cid))) {
          return true;
        }
      }

      // 3. Grade-based fallback when explicit enrollments or studentIds are not specified for the program
      const hasExplicitEnrollment = enrollments.some(e => String(e.programId) === String(p.id) && e.status !== 'deleted') ||
        (Array.isArray((p as any).studentIds) && (p as any).studentIds.length > 0);

      if (!hasExplicitEnrollment && matchedStudent?.grade) {
        if (!p.grade || p.grade === matchedStudent.grade || p.grade === 'همه' || p.grade === 'همه پایه‌ها') {
          return true;
        }
      }

      return false;
    });
  }, [programs, enrollments, candidateIds, matchedStudent]);

  // Helper: check if a course is scheduled to meet on a specific date (matching day of week)
  const isCourseHeldOnDate = (prog: Program, dateStr: string): boolean => {
    if (!prog) return false;
    if ((prog as any).status === 'deleted' || (prog as any).isDeleted) return false;

    const days = (prog.days && Array.isArray(prog.days) && prog.days.length > 0)
      ? prog.days
      : (prog.day ? (prog.day.includes('شنبه تا چهارشنبه') || prog.day.includes('هر روز')
          ? ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه']
          : [prog.day]) : []);

    if (!days || days.length === 0) return true; // Default open if unspecified

    const dayName = getShamsiDayOfWeekName(dateStr); // e.g. 'شنبه', 'پنج‌شنبه', 'جمعه'
    const norm = (s: string) => s.replace(/[\u200c\s]/g, '').trim().toLowerCase();
    const targetNorm = norm(dayName);

    return days.some(d => {
      const dNorm = norm(d);
      return dNorm === targetNorm || dNorm.includes(targetNorm) || targetNorm.includes(dNorm);
    });
  };

  // Filter programs held on the selectedDate
  const selfReportingProgramsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return selfReportingPrograms.filter(p => isCourseHeldOnDate(p, selectedDate));
  }, [selfReportingPrograms, selectedDate]);

  // Allowed days window from education settings
  const allowedDaysCount = attendanceSettings?.studentSelfReportingWindowDays || 
    attendanceSettings?.representativeEditWindowDays || 7;

  const allowedDates = useMemo(() => {
    const dates: { dateStr: string; label: string; dayName: string; isClassDay: boolean }[] = [];
    for (let i = 0; i < allowedDaysCount; i++) {
      const d = subtractDaysShamsi(todayShamsi, i);
      const dayName = getShamsiDayOfWeekName(d);
      const hasClass = selfReportingPrograms.some(p => isCourseHeldOnDate(p, d));

      let lbl = d;
      if (i === 0) lbl = 'امروز';
      else if (i === 1) lbl = 'دیروز';
      else lbl = `${i} روز پیش`;

      dates.push({ 
        dateStr: d, 
        label: lbl, 
        dayName,
        isClassDay: hasClass
      });
    }
    return dates;
  }, [todayShamsi, allowedDaysCount, selfReportingPrograms]);

  // Smart date default: If today or selectedDate is an off-day without held classes, auto-select most recent held class date (e.g. Wednesday)
  useEffect(() => {
    if (allowedDates.length === 0) return;

    const isCurrentDateClassDay = selfReportingPrograms.some(p => isCourseHeldOnDate(p, selectedDate));
    if (!isCurrentDateClassDay) {
      const firstClassDay = allowedDates.find(ad => ad.isClassDay);
      if (firstClassDay) {
        setSelectedDate(firstClassDay.dateStr);
      }
    }
  }, [allowedDates, selfReportingPrograms]);

  const loadedDateKeyRef = React.useRef<string>('');

  // Populate draft status for each course on date change or log change
  useEffect(() => {
    if (selfReportingProgramsForSelectedDate.length === 0 || !selectedDate) return;

    const sessionKey = `${selectedDate}_${selfReportingProgramsForSelectedDate.map(p => p.id).sort().join('_')}`;
    if (loadedDateKeyRef.current === sessionKey) {
      return;
    }
    loadedDateKeyRef.current = sessionKey;

    const newDraft: Record<string, { status: AttendanceStatus; lateMinutes: number; note: string }> = {};

    selfReportingProgramsForSelectedDate.forEach(prog => {
      const cleanDate = selectedDate.replace(/\//g, '-');
      const expectedLogId = `${prog.id}_${cleanDate}`;

      const sessionLog = attendanceLogs.find(l => 
        l.id === expectedLogId || 
        (l.programId === prog.id && l.date === selectedDate)
      );

      const studentRec = sessionLog?.students?.find(st => 
        candidateIds.includes(String(st.studentId).trim().toLowerCase()) ||
        (matchedStudent?.name && st.studentName?.includes(matchedStudent.name)) ||
        (currentUser?.name && st.studentName?.includes(currentUser.name))
      );

      if (studentRec) {
        newDraft[prog.id] = {
          status: studentRec.status || 'present',
          lateMinutes: studentRec.lateMinutes || 10,
          note: studentRec.note || ''
        };
      } else {
        newDraft[prog.id] = {
          status: 'present',
          lateMinutes: 10,
          note: ''
        };
      }
    });

    setDraftCourseStatus(newDraft);
  }, [selfReportingProgramsForSelectedDate, selectedDate, attendanceLogs, candidateIds, matchedStudent, currentUser]);

  const handleSetStatus = (progId: string, status: AttendanceStatus) => {
    setDraftCourseStatus(prev => ({
      ...prev,
      [progId]: {
        ...(prev[progId] || { lateMinutes: 10, note: '' }),
        status
      }
    }));
  };

  const handleSetLateMinutes = (progId: string, mins: number) => {
    setDraftCourseStatus(prev => ({
      ...prev,
      [progId]: {
        ...(prev[progId] || { status: 'late', note: '' }),
        status: 'late',
        lateMinutes: mins
      }
    }));
  };

  const handleSaveCourseAttendance = async (prog: Program) => {
    const studentId = String(matchedStudent?.id || currentUser?.studentId || currentUser?.linkedStudentId || currentUser?.id);
    const studentName = matchedStudent?.name || currentUser?.name || currentUser?.fullName || 'طلبه گرامی';
    const studentNationalId = matchedStudent?.nationalId || currentUser?.username;

    const currentDraft = draftCourseStatus[prog.id] || { status: 'present', lateMinutes: 10, note: '' };

    try {
      setSavingProgramId(prog.id);
      const cleanDate = selectedDate.replace(/\//g, '-');
      const logId = `${prog.id}_${cleanDate}`;
      const dayName = getShamsiDayOfWeekName(selectedDate);
      const nowIso = new Date().toISOString();

      const myStudentDetail: StudentAttendanceDetail = {
        studentId,
        studentName,
        nationalId: studentNationalId,
        status: currentDraft.status,
        lateMinutes: currentDraft.status === 'late' ? currentDraft.lateMinutes : undefined,
        note: currentDraft.note.trim() || 'ثبت خوداظهاری توسط طلبه',
        recordedMethod: 'self_reporting',
        selfReportedAt: nowIso
      };

      const existingLog = attendanceLogs.find(l => 
        l.id === logId || 
        (l.programId === prog.id && l.date === selectedDate)
      );

      let updatedLog: AttendanceSessionLog;

      if (existingLog) {
        const currentStudents = [...(existingLog.students || [])];
        const sIdx = currentStudents.findIndex(s => 
          candidateIds.includes(String(s.studentId).trim().toLowerCase()) ||
          (studentNationalId && s.nationalId === studentNationalId) ||
          (s.studentName && s.studentName === studentName)
        );

        if (sIdx >= 0) {
          currentStudents[sIdx] = {
            ...currentStudents[sIdx],
            ...myStudentDetail
          };
        } else {
          currentStudents.push(myStudentDetail);
        }

        updatedLog = {
          ...existingLog,
          students: currentStudents,
          updatedAt: nowIso
        } as any;
      } else {
        updatedLog = {
          id: logId,
          programId: prog.id,
          programTitle: prog.title,
          grade: prog.grade || '',
          date: selectedDate,
          dayOfWeek: dayName,
          isCancelled: false,
          attendanceType: 'self_reporting',
          recordedByName: `خوداظهاری طلبه (${studentName})`,
          recordedAt: nowIso,
          students: [myStudentDetail]
        } as any;
      }

      const presentCount = (updatedLog.students || []).filter(s => s.status === 'present').length;
      const absentCount = (updatedLog.students || []).filter(s => s.status === 'absent').length;
      const lateCount = (updatedLog.students || []).filter(s => s.status === 'late').length;

      updatedLog = {
        ...updatedLog,
        presentCount,
        absentCount,
        lateCount
      };

      if (existingLog) {
        await localDb.updateDoc('attendance', existingLog.id, updatedLog);
      } else {
        await localDb.setDoc('attendance', updatedLog);
      }

      setAttendanceLogs(prev => {
        const filtered = prev.filter(l => l.id !== logId && !(l.programId === prog.id && l.date === selectedDate));
        return [updatedLog, ...filtered];
      });

      setSuccessMessages(prev => ({
        ...prev,
        [prog.id]: `خوداظهاری «${prog.title}» برای تاریخ ${selectedDate} با موفقیت ثبت شد.`
      }));

      setTimeout(() => {
        setSuccessMessages(prev => {
          const c = { ...prev };
          delete c[prog.id];
          return c;
        });
      }, 4000);

      window.dispatchEvent(new CustomEvent('app_data_change', { detail: { collection: 'attendance', id: logId } }));
      window.dispatchEvent(new CustomEvent('attendance_updated', { detail: { logId, programId: prog.id, date: selectedDate } }));
    } catch (e: any) {
      console.error('Error saving self-reporting:', e);
      alert('خطا در ثبت خوداظهاری: ' + (e?.message || 'لطفاً مجدداً امتحان کنید'));
    } finally {
      setSavingProgramId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center font-vazir shadow-xs max-w-3xl mx-auto my-6" dir="rtl">
        <div className="w-10 h-10 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold text-slate-700">در حال بررسی و بارگذاری دروس خوداظهاری...</p>
      </div>
    );
  }

  // If student has NO self-reporting courses
  if (selfReportingPrograms.length === 0) {
    return (
      <div className="max-w-2xl mx-auto my-8 p-6 sm:p-8 bg-white rounded-3xl border border-slate-200 shadow-lg text-center font-vazir space-y-5" dir="rtl">
        <div className="w-16 h-16 rounded-3xl bg-teal-50 text-teal-600 border border-teal-200 flex items-center justify-center mx-auto shadow-sm">
          <Sparkles size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-black text-slate-800">
            همه کلاس‌های شما توسط نماینده حضور و غیاب می‌شود
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
            شما در حال حاضر در هیچ کلاسی با قابلیت خوداظهاری عضویت ندارید. حضور و غیاب تمامی جلسات کلاسی شما توسط نماینده منتخب کلاس ثبت می‌گردد.
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
    <div className="max-w-3xl mx-auto font-vazir text-right space-y-4 pb-16" dir="rtl">
      {/* 1. Header Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-200">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-800">
                ثبت خوداظهاری حضور در کلاس
              </h1>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                {selfReportingPrograms.length} درس دارای خوداظهاری
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              اعلام سریع و ساده وضعیت حضور شما در جلسات درسی
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

      {/* 2. Date Selection (Allowed window) */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
            <Calendar size={14} className="text-teal-600" />
            <span>انتخاب تاریخ جلسه (مجاز تا {allowedDaysCount} روز گذشته):</span>
          </label>
          <span className="text-[11px] font-bold text-teal-700 font-mono">
            {getShamsiDayOfWeekName(selectedDate)} ({selectedDate})
          </span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {allowedDates.map(({ dateStr, label, dayName, isClassDay }) => {
            const isDateSelected = dateStr === selectedDate;
            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => setSelectedDate(dateStr)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5",
                  isDateSelected
                    ? "bg-teal-600 text-white border-teal-600 shadow-xs font-black"
                    : isClassDay
                      ? "bg-teal-50/80 hover:bg-teal-100/80 text-teal-900 border-teal-200/90"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-400 border-slate-200"
                )}
              >
                <span>{label}</span>
                <span className="text-[10px] opacity-85 font-mono">({dayName})</span>
                {!isClassDay && <span className="text-[9px] px-1 bg-slate-200/80 text-slate-600 rounded">تعطیل</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Self-Reporting Course Cards (Only courses that meet on the selected date) */}
      <div className="space-y-3.5">
        {selfReportingProgramsForSelectedDate.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
              <Calendar size={24} />
            </div>
            <h3 className="text-sm font-black text-slate-800">
              در تاریخ {selectedDate} ({getShamsiDayOfWeekName(selectedDate)}) کلاسی برای خوداظهاری تشکیل نمی‌شود
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              کلاس‌های شما در این روز برنامه تشکیل جلسه ندارند. جهت ثبت خوداظهاری حضور، لطفا روزهای تشکیل کلاس (مانند شنبه تا چهارشنبه) را از نوار بالای تاریخ انتخاب نمایید.
            </p>
            {allowedDates.find(ad => ad.isClassDay) && (
              <button
                type="button"
                onClick={() => {
                  const lastHeld = allowedDates.find(ad => ad.isClassDay);
                  if (lastHeld) setSelectedDate(lastHeld.dateStr);
                }}
                className="mt-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Clock size={14} />
                <span>انتقال به آخرین جلسه تشکیل شده ({allowedDates.find(ad => ad.isClassDay)?.dayName} {allowedDates.find(ad => ad.isClassDay)?.dateStr})</span>
              </button>
            )}
          </div>
        ) : (
          selfReportingProgramsForSelectedDate.map(prog => {
            const draft = draftCourseStatus[prog.id] || { status: 'present', lateMinutes: 10, note: '' };
            const isSavingThis = savingProgramId === prog.id;
            const successMsg = successMessages[prog.id];

            return (
              <div 
                key={prog.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-4"
              >
              {/* Course Title & Teacher */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-3 gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center font-bold">
                    <BookOpen size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900">
                      {prog.title}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      استاد: {prog.teacher || 'تعیین‌نشده'} • {prog.grade || 'درس حوزوی'}
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-teal-50 text-teal-800 border border-teal-200">
                  خوداظهاری
                </span>
              </div>

              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Status Buttons: [حضور], [غایب], [تاخیر] */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">
                  وضعیت حضور شما در این جلسه ({selectedDate}):
                </label>

                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {/* حضور */}
                  <button
                    type="button"
                    onClick={() => handleSetStatus(prog.id, 'present')}
                    className={cn(
                      "py-3 px-2 rounded-2xl border text-xs sm:text-sm font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1",
                      draft.status === 'present'
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200"
                        : "bg-slate-50 hover:bg-emerald-50 text-slate-700 border-slate-200 hover:text-emerald-800"
                    )}
                  >
                    <CheckCircle2 size={18} />
                    <span>حاضر بودم</span>
                  </button>

                  {/* غایب */}
                  <button
                    type="button"
                    onClick={() => handleSetStatus(prog.id, 'absent')}
                    className={cn(
                      "py-3 px-2 rounded-2xl border text-xs sm:text-sm font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1",
                      draft.status === 'absent'
                        ? "bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-200"
                        : "bg-slate-50 hover:bg-rose-50 text-slate-700 border-slate-200 hover:text-rose-800"
                    )}
                  >
                    <XCircle size={18} />
                    <span>غایب بودم</span>
                  </button>

                  {/* تاخیر */}
                  <button
                    type="button"
                    onClick={() => handleSetStatus(prog.id, 'late')}
                    className={cn(
                      "py-3 px-2 rounded-2xl border text-xs sm:text-sm font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1",
                      draft.status === 'late'
                        ? "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-200"
                        : "bg-slate-50 hover:bg-amber-50 text-slate-700 border-slate-200 hover:text-amber-800"
                    )}
                  >
                    <Clock size={18} />
                    <span>با تاخیر رسیدم</span>
                  </button>
                </div>

                {/* Late Minutes Quick Toggle */}
                {draft.status === 'late' && (
                  <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200 flex items-center justify-between gap-2 mt-2">
                    <span className="text-xs font-bold text-amber-900">میزان تاخیر شما به دقیقه:</span>
                    <div className="flex items-center gap-1.5">
                      {[10, 15, 20, 30].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handleSetLateMinutes(prog.id, m)}
                          className={cn(
                            "px-2.5 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all border",
                            draft.lateMinutes === m
                              ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                              : "bg-white text-amber-900 border-amber-200 hover:bg-amber-100"
                          )}
                        >
                          {m} دقیقه
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

                {/* Save Button for this course */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={isSavingThis}
                    onClick={() => handleSaveCourseAttendance(prog)}
                    className="w-full sm:w-auto px-6 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-black text-xs rounded-xl shadow-md shadow-teal-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-40"
                  >
                    <Save size={15} />
                    <span>{isSavingThis ? 'در حال ثبت...' : 'ثبت خوداظهاری این درس'}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
