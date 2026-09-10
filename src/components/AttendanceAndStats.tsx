import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckSquare, 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  UserCheck, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Clock3, 
  FileText, 
  Save, 
  BookOpen, 
  ChevronRight, 
  ChevronLeft, 
  GraduationCap, 
  ShieldAlert, 
  Sparkles,
  Info,
  RotateCcw,
  Copy,
  DoorOpen,
  UserX
} from 'lucide-react';
import { cn } from '../lib/utils';
import { localDb } from '../lib/localDb';
import { useAuth } from '../context/AuthContext';
import { ShamsiDatePicker } from './ShamsiDatePicker';
import { 
  getTodayShamsi, 
  getShamsiDayOfWeekName, 
  parseShamsiDate, 
  formatShamsiDate,
  shamsiToDate,
  dateToShamsi
} from '../lib/jalali';
import { motion, AnimatePresence } from 'motion/react';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface StudentAttendanceItem {
  studentId: string;
  studentName: string;
  nationalId?: string;
  status: AttendanceStatus;
  note?: string;
  lateMinutes?: number;
}

export interface AttendanceRecord {
  id: string; // `${programId}_${date}`
  programId: string;
  programTitle: string;
  grade?: string;
  date: string; // "1405/06/15"
  dayOfWeek: string;
  isCancelled: boolean; // عدم برگزاری کلاس
  cancellationReason?: string;
  notes: string;
  recordedBy: string;
  recordedAt: string;
  students: StudentAttendanceItem[];
}

export default function AttendanceAndStats() {
  const { currentUser } = useAuth();

  // Data states
  const [programs, setPrograms] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active selections
  const [selectedDate, setSelectedDate] = useState<string>(getTodayShamsi());
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  
  // Current session edit state
  const [isCancelled, setIsCancelled] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [studentsAttendance, setStudentsAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [studentNotes, setStudentNotes] = useState<Record<string, string>>({});
  const [isSavedRecently, setIsSavedRecently] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load all initial data from localDb
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [progs, studs, enrolls, atts] = await Promise.all([
        localDb.getDocs('programs'),
        localDb.getDocs('students'),
        localDb.getDocs('enrollments'),
        localDb.getDocs<AttendanceRecord>('attendance')
      ]);
      setPrograms(progs || []);
      setStudents(studs || []);
      setEnrollments(enrolls || []);
      setAttendanceRecords(atts || []);
    } catch (e) {
      console.error('Error loading attendance data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = localDb.subscribe(() => {
      loadData();
    });
    return () => unsub();
  }, []);

  // Check which programs the current user is a representative of
  const representativePrograms = useMemo(() => {
    if (!currentUser) return [];
    
    // Admins or Education Managers have access to all programs
    const isAdmin = ['super_admin', 'education_manager', 'school_manager', 'education_officer'].includes(currentUser.role) ||
      currentUser.username?.toUpperCase() === 'SADEGH' ||
      currentUser.username?.toUpperCase() === 'SHAH';

    if (isAdmin) {
      return programs;
    }

    const currentUserName = (currentUser.name || '').trim().toLowerCase();
    const currentStudentName = (currentUser.studentName || '').trim().toLowerCase();
    const currentStudentId = currentUser.studentId || '';

    return programs.filter(p => {
      // 1. Direct match by representativeStudentIds
      if (currentStudentId && Array.isArray(p.representativeStudentIds) && p.representativeStudentIds.includes(currentStudentId)) {
        return true;
      }
      // 2. Match by student ID from matched student record
      const matchedStudent = students.find(s => 
        (currentStudentId && s.id === currentStudentId) ||
        (s.name && (s.name.trim().toLowerCase() === currentUserName || s.name.trim().toLowerCase() === currentStudentName))
      );
      if (matchedStudent && Array.isArray(p.representativeStudentIds) && p.representativeStudentIds.includes(matchedStudent.id)) {
        return true;
      }
      // 3. Match by representativeNames
      if (Array.isArray(p.representativeNames)) {
        const hasNameMatch = p.representativeNames.some((repName: string) => {
          const norm = repName.trim().toLowerCase();
          return norm === currentUserName || 
                 norm === currentStudentName ||
                 (currentUserName && currentUserName.includes(norm)) ||
                 (currentStudentName && currentStudentName.includes(norm));
        });
        if (hasNameMatch) return true;
      }

      // If user is designated as class_representative role and no specific program set, allow all or class scoped
      if (currentUser.role === 'class_representative' && currentUser.scope === 'all') {
        return true;
      }

      return false;
    });
  }, [currentUser, programs, students]);

  // Determine if current user is an admin or full viewer
  const isFullAdmin = useMemo(() => {
    if (!currentUser) return false;
    return ['super_admin', 'education_manager', 'school_manager', 'grade_mentor'].includes(currentUser.role) ||
      currentUser.username?.toUpperCase() === 'SADEGH' ||
      currentUser.username?.toUpperCase() === 'SHAH';
  }, [currentUser]);

  // Set default selected program when programs are loaded
  useEffect(() => {
    if (!selectedProgramId) {
      if (representativePrograms.length > 0) {
        setSelectedProgramId(representativePrograms[0].id);
      } else if (programs.length > 0 && isFullAdmin) {
        setSelectedProgramId(programs[0].id);
      }
    }
  }, [representativePrograms, programs, selectedProgramId, isFullAdmin]);

  // Get active selected program
  const currentProgram = useMemo(() => {
    return programs.find(p => p.id === selectedProgramId) || null;
  }, [programs, selectedProgramId]);

  // Get students enrolled in current program
  const enrolledStudents = useMemo(() => {
    if (!selectedProgramId) return [];
    const studentIdSet = new Set<string>();

    enrollments.forEach(e => {
      if (e.programId === selectedProgramId) {
        studentIdSet.add(e.studentId);
      }
    });

    if (currentProgram && Array.isArray(currentProgram.studentIds)) {
      currentProgram.studentIds.forEach((sid: string) => studentIdSet.add(sid));
    }

    return students
      .filter(s => studentIdSet.has(s.id))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fa'));
  }, [selectedProgramId, enrollments, currentProgram, students]);

  // Current Day of Week Name for selected date
  const dayOfWeekName = useMemo(() => {
    return getShamsiDayOfWeekName(selectedDate);
  }, [selectedDate]);

  // Load or initialize attendance record when date or program changes
  useEffect(() => {
    if (!selectedProgramId || !selectedDate) return;

    const existingRecord = attendanceRecords.find(
      r => r.programId === selectedProgramId && r.date === selectedDate
    );

    if (existingRecord) {
      setIsCancelled(existingRecord.isCancelled || false);
      setCancellationReason(existingRecord.cancellationReason || '');
      setSessionNotes(existingRecord.notes || '');

      const attMap: Record<string, AttendanceStatus> = {};
      const noteMap: Record<string, string> = {};

      existingRecord.students?.forEach(item => {
        attMap[item.studentId] = item.status || 'present';
        if (item.note) noteMap[item.studentId] = item.note;
      });

      // For any enrolled student not yet in record, default to 'present'
      enrolledStudents.forEach(s => {
        if (!attMap[s.id]) {
          attMap[s.id] = 'present';
        }
      });

      setStudentsAttendance(attMap);
      setStudentNotes(noteMap);
    } else {
      // Initialize default session: all present, not cancelled
      setIsCancelled(false);
      setCancellationReason('');
      setSessionNotes('');

      const defaultMap: Record<string, AttendanceStatus> = {};
      enrolledStudents.forEach(s => {
        defaultMap[s.id] = 'present';
      });
      setStudentsAttendance(defaultMap);
      setStudentNotes({});
    }
    setIsSavedRecently(false);
  }, [selectedProgramId, selectedDate, attendanceRecords, enrolledStudents]);

  // Fast Bulk actions
  const handleMarkAll = (status: AttendanceStatus) => {
    const updated: Record<string, AttendanceStatus> = {};
    enrolledStudents.forEach(s => {
      updated[s.id] = status;
    });
    setStudentsAttendance(updated);
  };

  const handleSetStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setStudentsAttendance(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  // Date Navigation (Previous day, Next day)
  const handleShiftDate = (days: number) => {
    try {
      const gDate = shamsiToDate(selectedDate);
      gDate.setDate(gDate.getDate() + days);
      const newShamsi = dateToShamsi(gDate);
      setSelectedDate(newShamsi);
    } catch (e) {
      console.error(e);
    }
  };

  // Save Attendance to Database
  const handleSaveAttendance = async () => {
    if (!currentProgram || !selectedDate) return;
    setIsSaving(true);

    try {
      const recordId = `${currentProgram.id}_${selectedDate.replace(/\//g, '-')}`;

      const studentItems: StudentAttendanceItem[] = enrolledStudents.map(s => ({
        studentId: s.id,
        studentName: s.name,
        nationalId: s.nationalId || '',
        status: studentsAttendance[s.id] || 'present',
        note: studentNotes[s.id] || ''
      }));

      const newRecord: AttendanceRecord = {
        id: recordId,
        programId: currentProgram.id,
        programTitle: currentProgram.title,
        grade: currentProgram.grade || '',
        date: selectedDate,
        dayOfWeek: dayOfWeekName,
        isCancelled,
        cancellationReason: isCancelled ? cancellationReason : '',
        notes: sessionNotes,
        recordedBy: currentUser?.name || currentUser?.username || 'نماینده کلاس',
        recordedAt: new Date().toISOString(),
        students: studentItems
      };

      await localDb.setDoc('attendance', newRecord);

      // Update local state
      setAttendanceRecords(prev => {
        const filtered = prev.filter(r => r.id !== recordId);
        return [newRecord, ...filtered];
      });

      setIsSavedRecently(true);
      setTimeout(() => setIsSavedRecently(false), 4000);
    } catch (err) {
      console.error('Failed to save attendance:', err);
      alert('خطا در ذخیره‌سازی حضور و غیاب. لطفاً دوباره تلاش کنید.');
    } finally {
      setIsSaving(false);
    }
  };

  // Compute statistics for current view
  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    enrolledStudents.forEach(s => {
      const st = studentsAttendance[s.id] || 'present';
      if (st === 'present') present++;
      else if (st === 'absent') absent++;
      else if (st === 'late') late++;
      else if (st === 'excused') excused++;
    });

    return { present, absent, late, excused, total: enrolledStudents.length };
  }, [enrolledStudents, studentsAttendance]);

  // Check if today matches class schedule
  const isScheduledDay = useMemo(() => {
    if (!currentProgram || !currentProgram.day) return true;
    return currentProgram.day.includes(dayOfWeekName);
  }, [currentProgram, dayOfWeekName]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12 font-vazir" dir="rtl">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
              <CheckSquare size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <span>ثبت حضور و غیاب کلاس‌ها</span>
                {currentUser?.role === 'class_representative' && (
                  <span className="text-xs bg-teal-100 text-teal-900 font-bold px-2.5 py-0.5 rounded-full border border-teal-200">
                    پنل نماینده کلاس
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                ثبت سریع حضور، غیبت، تاخیر و عدم تشکیل کلاس در روزهای تقویمی
              </p>
            </div>
          </div>
        </div>

        {/* Quick Save Status Button */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={handleSaveAttendance}
            disabled={isSaving || !currentProgram}
            className={cn(
              "flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs transition-all shadow-md cursor-pointer",
              isSavedRecently 
                ? "bg-emerald-600 text-white shadow-emerald-200" 
                : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-indigo-200"
            )}
          >
            {isSavedRecently ? (
              <>
                <CheckCircle2 size={16} />
                <span>با موفقیت ذخیره شد</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>{isSaving ? 'در حال ثبت...' : 'ذخیره حضور و غیاب'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Class and Date Selector Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Program / Class Selector */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2 md:col-span-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <BookOpen size={15} className="text-indigo-600" />
              <span>انتخاب کلاس درس:</span>
            </label>
            {representativePrograms.length > 0 && !isFullAdmin && (
              <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200 flex items-center gap-1">
                <UserCheck size={12} />
                <span>{representativePrograms.length} کلاس تحت نمایندگی شما</span>
              </span>
            )}
          </div>

          <select
            className="w-full px-3.5 py-2.5 text-xs font-black border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
            value={selectedProgramId}
            onChange={(e) => setSelectedProgramId(e.target.value)}
          >
            {representativePrograms.length === 0 && !isFullAdmin && (
              <option value="">-- کلاسی با نمایندگی شما یافت نشد --</option>
            )}

            {/* Representative classes first */}
            {representativePrograms.length > 0 && (
              <optgroup label="🌟 کلاس‌های تحت نمایندگی شما">
                {representativePrograms.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.title} {p.grade ? `(${p.grade})` : ''} - استاد: {p.teacher || 'تعیین‌نشده'} | مَدرَس: {p.madrasRoom || p.classroom || 'نامشخص'}
                  </option>
                ))}
              </optgroup>
            )}

            {/* All other classes for admin/mentors */}
            {isFullAdmin && (
              <optgroup label="📚 تمامی کلاس‌های مدرسه">
                {programs.filter(p => !representativePrograms.some(rp => rp.id === p.id)).map(p => (
                  <option key={p.id} value={p.id}>
                    {p.title} {p.grade ? `(${p.grade})` : ''} - استاد: {p.teacher || 'تعیین‌نشده'}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {/* Program Info Chips */}
          {currentProgram && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-600">
              {currentProgram.grade && (
                <span className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-md">
                  <GraduationCap size={12} />
                  <span>{currentProgram.grade}</span>
                </span>
              )}
              <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md font-medium text-slate-700">
                <Clock size={12} className="text-slate-500" />
                <span>روز: {currentProgram.day || 'نامشخص'} - ساعت: {currentProgram.time || 'نامشخص'}</span>
              </span>
              {(currentProgram.madrasRoom || currentProgram.classroom) && (
                <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md font-bold text-slate-700">
                  <DoorOpen size={12} className="text-indigo-600" />
                  <span>مَدرَس: {currentProgram.madrasRoom || currentProgram.classroom}</span>
                </span>
              )}
              {currentProgram.representativeNames && currentProgram.representativeNames.length > 0 && (
                <span className="flex items-center gap-1 bg-teal-50 border border-teal-200 text-teal-800 font-bold px-2 py-0.5 rounded-md">
                  <UserCheck size={12} className="text-teal-600" />
                  <span>نماینده: {currentProgram.representativeNames.join(' ، ')}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* 2. Date Selector with Quick Navigation */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <CalendarIcon size={15} className="text-indigo-600" />
              <span>تاریخ جلسه ({dayOfWeekName}):</span>
            </label>
            <button
              type="button"
              onClick={() => setSelectedDate(getTodayShamsi())}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline decoration-indigo-300 cursor-pointer"
            >
              امروز
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleShiftDate(-1)}
              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
              title="روز قبل"
            >
              <ChevronRight size={16} />
            </button>

            <div className="flex-1">
              <ShamsiDatePicker
                value={selectedDate}
                onChange={(d) => setSelectedDate(d)}
                placeholder="انتخاب تاریخ..."
              />
            </div>

            <button
              type="button"
              onClick={() => handleShiftDate(1)}
              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
              title="روز بعد"
            >
              <ChevronLeft size={16} />
            </button>
          </div>

          {!isScheduledDay && (
            <p className="text-[10px] text-amber-700 bg-amber-50 p-1.5 rounded-lg border border-amber-200 flex items-center gap-1">
              <AlertCircle size={12} className="shrink-0" />
              <span>طبق برنامه، این درس در روز {dayOfWeekName} تعریف نشده است (برگزاری جبرانی یا اختیاری).</span>
            </p>
          )}
        </div>
      </div>

      {/* Class Cancellation Toggle (عدم برگزاری کلاس) */}
      <div className={cn(
        "p-4 sm:p-5 rounded-2xl border transition-all space-y-3",
        isCancelled 
          ? "bg-rose-50/90 border-rose-200 shadow-xs" 
          : "bg-white border-slate-200 shadow-xs"
      )}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCancelled(!isCancelled)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                isCancelled ? "bg-rose-600" : "bg-slate-200"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                  isCancelled ? "-translate-x-5" : "translate-x-0"
                )}
              />
            </button>
            <div>
              <h4 className={cn("text-xs font-black", isCancelled ? "text-rose-900" : "text-slate-800")}>
                گزینه عدم برگزاری کلاس (تعطیل / لغو شده)
              </h4>
              <p className="text-[11px] text-slate-500 font-medium">
                در صورتی که کلاس در این تاریخ به هر دلیلی تشکیل نشده، این گزینه را فعال نمایید.
              </p>
            </div>
          </div>

          {isCancelled && (
            <span className="px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-black border border-rose-200 flex items-center gap-1 self-start sm:self-auto">
              <UserX size={14} />
              <span>کلاس برگزار نگردید</span>
            </span>
          )}
        </div>

        {isCancelled && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }}
            className="pt-2 border-t border-rose-200/80"
          >
            <label className="block text-xs font-bold text-rose-900 mb-1">
              علت عدم برگزاری کلاس:
            </label>
            <input
              type="text"
              placeholder="مثلاً: تعطیلی رسمی، عدم حضور استاد محترم، برگزاری مراسم عمومی مدرسه..."
              className="w-full px-3.5 py-2 text-xs border border-rose-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-rose-500 font-medium text-slate-800"
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
            />
          </motion.div>
        )}
      </div>

      {/* Main Attendance Marking Section */}
      {!isCancelled ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4">
          {/* Section Toolbar and Stats */}
          <div className="bg-slate-50/90 p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Users className="text-indigo-600" size={18} />
                <span>لیست طلاب حاضر در کلاس ({enrolledStudents.length} نفر)</span>
              </h3>

              {/* Status Counters */}
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <span className="px-2.5 py-1 bg-emerald-100/80 text-emerald-900 font-black rounded-lg border border-emerald-200">
                  {stats.present} حاضر
                </span>
                <span className="px-2.5 py-1 bg-rose-100/80 text-rose-900 font-black rounded-lg border border-rose-200">
                  {stats.absent} غایب
                </span>
                <span className="px-2.5 py-1 bg-amber-100/80 text-amber-900 font-black rounded-lg border border-amber-200">
                  {stats.late} تاخیر
                </span>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-800 font-bold rounded-lg border border-slate-200">
                  {stats.excused} مرخصی
                </span>
              </div>
            </div>

            {/* Quick Bulk Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-400">تیک سریع:</span>
              <button
                type="button"
                onClick={() => handleMarkAll('present')}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1"
              >
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span>حضور همه</span>
              </button>
              <button
                type="button"
                onClick={() => handleMarkAll('absent')}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1"
              >
                <XCircle size={13} className="text-rose-600" />
                <span>غیبت همه</span>
              </button>
            </div>
          </div>

          {/* Student Roster Table */}
          {enrolledStudents.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <AlertCircle size={36} className="text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">هیچ طلبه‌ای برای این کلاس ثبت‌نام نشده است.</p>
              <p className="text-[11px] text-slate-400">
                جهت ثبت‌نام طلاب در این کلاس، از بخش «برنامه‌های مدرسه و کلاس‌ها» گزینه مدیریت و افزودن طالبان را انتخاب نمایید.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 px-3 sm:px-5">
              {enrolledStudents.map((student, index) => {
                const currentStatus = studentsAttendance[student.id] || 'present';
                const studentNote = studentNotes[student.id] || '';

                return (
                  <div 
                    key={student.id}
                    className="py-3 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-xl transition-colors"
                  >
                    {/* Student Info */}
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-mono text-[11px] flex items-center justify-center font-bold">
                        {index + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900">{student.name}</span>
                          {student.grade && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded border border-indigo-100">
                              {student.grade}
                            </span>
                          )}
                        </div>
                        {student.phoneNumber && (
                          <span className="text-[10px] text-slate-400 font-mono">{student.phoneNumber}</span>
                        )}
                      </div>
                    </div>

                    {/* Interactive Status Buttons & Individual Note */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Status Toggle Buttons */}
                      <div className="inline-flex rounded-xl p-1 bg-slate-100/90 border border-slate-200">
                        {/* 1. Present */}
                        <button
                          type="button"
                          onClick={() => handleSetStudentStatus(student.id, 'present')}
                          className={cn(
                            "px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer",
                            currentStatus === 'present'
                              ? "bg-emerald-600 text-white shadow-xs scale-102"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                          )}
                        >
                          <CheckCircle2 size={13} />
                          <span>حاضر</span>
                        </button>

                        {/* 2. Absent */}
                        <button
                          type="button"
                          onClick={() => handleSetStudentStatus(student.id, 'absent')}
                          className={cn(
                            "px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer",
                            currentStatus === 'absent'
                              ? "bg-rose-600 text-white shadow-xs scale-102"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                          )}
                        >
                          <XCircle size={13} />
                          <span>غایب</span>
                        </button>

                        {/* 3. Late */}
                        <button
                          type="button"
                          onClick={() => handleSetStudentStatus(student.id, 'late')}
                          className={cn(
                            "px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer",
                            currentStatus === 'late'
                              ? "bg-amber-500 text-white shadow-xs scale-102"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                          )}
                        >
                          <Clock3 size={13} />
                          <span>تاخیر</span>
                        </button>

                        {/* 4. Excused */}
                        <button
                          type="button"
                          onClick={() => handleSetStudentStatus(student.id, 'excused')}
                          className={cn(
                            "px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer",
                            currentStatus === 'excused'
                              ? "bg-indigo-600 text-white shadow-xs scale-102"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                          )}
                        >
                          <span>مرخصی</span>
                        </button>
                      </div>

                      {/* Optional note input for this student */}
                      <input
                        type="text"
                        placeholder="توضیح غیبت / تاخیر..."
                        className="w-36 sm:w-44 px-2.5 py-1 text-[11px] border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                        value={studentNote}
                        onChange={(e) => setStudentNotes({ ...studentNotes, [student.id]: e.target.value })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-rose-50/50 p-8 rounded-2xl border border-rose-200 text-center space-y-2">
          <UserX size={40} className="text-rose-400 mx-auto" />
          <h4 className="text-sm font-black text-rose-900">کلاس در تاریخ {selectedDate} لغو شده است</h4>
          <p className="text-xs text-rose-700 font-medium">
            علت ثبت‌شده: {cancellationReason || 'بدون درج علت مشخص'}
          </p>
          <button
            type="button"
            onClick={() => setIsCancelled(false)}
            className="mt-2 text-xs font-bold text-rose-700 underline hover:text-rose-900 cursor-pointer"
          >
            لغو وضعیت عدم برگزاری و ثبت حضور و غیاب عادی
          </button>
        </div>
      )}

      {/* Class Notes & Daily Feedback (امکان نوشتن توضیحات در پایین صفحه) */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <FileText size={16} className="text-indigo-600" />
            <span>توضیحات و گزارش برگزاری کلاس:</span>
          </span>
          <span className="text-[10px] text-slate-400 font-normal">
            (مباحث تدریس‌شده، تذکرات استاد، گزارش غیبت‌ها و موارد انضباطی)
          </span>
        </label>
        <textarea
          rows={4}
          placeholder="توضیحات و نکات مربوط به این جلسه از کلاس را بنویسید..."
          className="w-full p-3.5 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 focus:bg-white transition-all resize-y font-medium text-slate-800 leading-relaxed"
          value={sessionNotes}
          onChange={(e) => setSessionNotes(e.target.value)}
        />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <span className="text-[11px] text-slate-400 font-medium">
            ثبت‌کننده: {currentUser?.name || currentUser?.username || 'کاربر سیستم'}
          </span>
          <button
            type="button"
            onClick={handleSaveAttendance}
            disabled={isSaving || !currentProgram}
            className={cn(
              "w-full sm:w-auto px-8 py-2.5 rounded-xl font-black text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-2",
              isSavedRecently 
                ? "bg-emerald-600 text-white shadow-emerald-200" 
                : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-indigo-200"
            )}
          >
            <Save size={16} />
            <span>{isSaving ? 'در حال ثبت...' : 'ثبت نهایی حضور و غیاب و توضیحات'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
