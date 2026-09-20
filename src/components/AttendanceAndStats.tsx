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
  DoorOpen,
  UserX,
  SlidersHorizontal,
  HelpCircle,
  AlertTriangle,
  FileCheck2,
  Search,
  Filter,
  Download,
  CalendarDays,
  X,
  Check,
  Award,
  FileSpreadsheet,
  Printer,
  CalendarCheck,
  AlertOctagon,
  UserPlus,
  UserCheck2,
  Edit3,
  User
} from 'lucide-react';
import * as XLSX from 'xlsx';
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
import { 
  AttendanceStatus, 
  AttendanceSessionLog, 
  StudentAttendanceDetail, 
  AttendanceSettings, 
  WorkflowItem,
  AcademicHolidayItem,
  AcademicCalendarPeriod,
  Teacher
} from '../types';

export type AttendanceRecord = AttendanceSessionLog;
export type StudentAttendanceItem = StudentAttendanceDetail;

interface AttendanceAndStatsProps {
  initialStudentId?: string;
}

export default function AttendanceAndStats({ initialStudentId }: AttendanceAndStatsProps = {}) {
  const { currentUser } = useAuth();

  // Active view tab: 'record' (ثبت حضور و غیاب) or 'report' (گزارش‌ها و آمار غیبت)
  const [activeTab, setActiveTab] = useState<'record' | 'report'>('record');

  // Data states
  const [programs, setPrograms] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceSessionLog[]>([]);
  const [academicHolidays, setAcademicHolidays] = useState<AcademicHolidayItem[]>([]);
  const [academicPeriods, setAcademicPeriods] = useState<AcademicCalendarPeriod[]>([]);
  const [settings, setSettings] = useState<AttendanceSettings>({
    id: 'default_attendance_settings',
    representativeEditWindowDays: 7,
    unspecifiedCountAs: 'unspecified',
    unexcusedWarningThreshold: 3
  });
  const [isLoading, setIsLoading] = useState(true);

  // Active selections for Record tab
  const [selectedDate, setSelectedDate] = useState<string>(getTodayShamsi());
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  
  // Current session edit state
  const [isCancelled, setIsCancelled] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [hasSubstituteTeacher, setHasSubstituteTeacher] = useState(false);
  const [substituteTeacherId, setSubstituteTeacherId] = useState<string | undefined>(undefined);
  const [substituteTeacherName, setSubstituteTeacherName] = useState<string>('');
  const [substituteTeacherNotes, setSubstituteTeacherNotes] = useState<string>('');
  const [isSubstituteModalOpen, setIsSubstituteModalOpen] = useState(false);
  const [substituteTeacherSearch, setSubstituteTeacherSearch] = useState('');
  const [manualSubstituteName, setManualSubstituteName] = useState('');
  const [manualSubstituteNotes, setManualSubstituteNotes] = useState('');
  const [selectedTeacherFromList, setSelectedTeacherFromList] = useState<Teacher | null>(null);

  const [sessionNotes, setSessionNotes] = useState('');
  const [studentsAttendance, setStudentsAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [studentNotes, setStudentNotes] = useState<Record<string, string>>({});
  const [studentLateMinutes, setStudentLateMinutes] = useState<Record<string, number>>({});
  const [studentWarnings, setStudentWarnings] = useState<Record<string, boolean>>({});
  const [studentExcused, setStudentExcused] = useState<Record<string, { isExcused: boolean; reason: string }>>({});
  const [isSavedRecently, setIsSavedRecently] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [educationBypassLock, setEducationBypassLock] = useState(false);

  // Modals & Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [justifyingStudent, setJustifyingStudent] = useState<{ studentId: string; studentName: string } | null>(null);
  const [justificationReasonInput, setJustificationReasonInput] = useState('');

  // Educational Warning Modal state
  const [issuingWarningStudent, setIssuingWarningStudent] = useState<{
    student: any;
    absentCount: number;
    programTitle?: string;
  } | null>(null);
  const [warningReasonInput, setWarningReasonInput] = useState('');

  // Report filters
  const [reportGradeFilter, setReportGradeFilter] = useState<string>('all');
  const [reportProgramFilter, setReportProgramFilter] = useState<string>('all');
  const [reportSearchQuery, setReportSearchQuery] = useState<string>('');
  const [reportStartDate, setReportStartDate] = useState<string>('1403/07/01');
  const [reportEndDate, setReportEndDate] = useState<string>(getTodayShamsi());
  const [reportWarningOnlyFilter, setReportWarningOnlyFilter] = useState<boolean>(false);
  const [selectedStudentDrilldown, setSelectedStudentDrilldown] = useState<any | null>(null);

  // Check roles
  const isSuperAdmin = currentUser?.level === 1 && currentUser?.role === 'super_admin';
  const isEducationManager = 
    currentUser?.role === 'education_manager' || 
    currentUser?.role === 'education_officer' || 
    currentUser?.username?.toUpperCase() === 'SHAH';
  const isGradeSupervisor = 
    currentUser?.role === 'grade_mentor' || 
    currentUser?.role === 'grade_supervisor' || 
    currentUser?.role?.startsWith('grade_supervisor_');
  const isRepresentative = currentUser?.role === 'class_representative';
  const isStudent = currentUser?.role === 'student';

  const canManageSettings = isSuperAdmin || isEducationManager;

  // Toast helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Load all initial data from localDb
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [progs, studs, teaList, enrolls, atts, settList, hols, periods] = await Promise.all([
        localDb.getDocs('programs'),
        localDb.getDocs('students'),
        localDb.getDocs<Teacher>('teachers'),
        localDb.getDocs('enrollments'),
        localDb.getDocs<AttendanceSessionLog>('attendance'),
        localDb.getDocs<AttendanceSettings>('attendance_settings'),
        localDb.getDocs<AcademicHolidayItem>('academic_holidays'),
        localDb.getDocs<AcademicCalendarPeriod>('academic_calendar_periods')
      ]);
      setPrograms(progs || []);
      setStudents(studs || []);
      setTeachers(teaList || []);
      setEnrollments(enrolls || []);
      setAttendanceRecords(atts || []);
      setAcademicHolidays(hols || []);
      setAcademicPeriods(periods || []);
      if (settList && settList.length > 0) {
        setSettings(settList[0]);
      }
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

  // Save Settings
  const handleSaveSettings = async (newSettings: AttendanceSettings) => {
    setSettings(newSettings);
    await localDb.setDoc('attendance_settings', newSettings);
    showToast('تنظیمات حضور و غیاب با موفقیت ذخیره شد.');
    setIsSettingsOpen(false);
  };

  // Check which programs the current user is a representative of
  const representativePrograms = useMemo(() => {
    if (!currentUser) return [];
    
    // Admins or Education Managers or Grade Supervisors have access to programs
    if (isSuperAdmin || isEducationManager || isGradeSupervisor) {
      if (isGradeSupervisor && currentUser.gradeLabel) {
        return programs.filter(p => !p.grade || p.grade === currentUser.gradeLabel || p.grade === 'همه پایه‌ها');
      }
      return programs;
    }

    const currentUserName = (currentUser.name || '').trim().toLowerCase();
    const currentStudentName = (currentUser.studentName || '').trim().toLowerCase();
    const currentStudentId = currentUser.studentId || currentUser.linkedStudentId || '';

    return programs.filter(p => {
      if (currentStudentId && Array.isArray(p.representativeStudentIds) && p.representativeStudentIds.includes(currentStudentId)) {
        return true;
      }
      const matchedStudent = students.find(s => 
        (currentStudentId && s.id === currentStudentId) ||
        (s.name && (s.name.trim().toLowerCase() === currentUserName || s.name.trim().toLowerCase() === currentStudentName))
      );
      if (matchedStudent && Array.isArray(p.representativeStudentIds) && p.representativeStudentIds.includes(matchedStudent.id)) {
        return true;
      }
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
      if (currentUser.role === 'class_representative' && currentUser.scope === 'all') {
        return true;
      }
      return false;
    });
  }, [currentUser, programs, students, isSuperAdmin, isEducationManager, isGradeSupervisor]);

  // Set default selected program
  useEffect(() => {
    if (initialStudentId && programs.length > 0) {
      const progWithStudent = programs.find(p => {
        const inEnroll = enrollments.some(e => e.programId === p.id && String(e.studentId) === String(initialStudentId));
        const inArray = Array.isArray(p.studentIds) && p.studentIds.includes(initialStudentId);
        return inEnroll || inArray;
      });
      if (progWithStudent) {
        setSelectedProgramId(progWithStudent.id);
        setTimeout(() => {
          const el = document.getElementById(`attendance-student-${initialStudentId}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 400);
        return;
      }
    }

    if (!selectedProgramId) {
      if (representativePrograms.length > 0) {
        setSelectedProgramId(representativePrograms[0].id);
      } else if (programs.length > 0) {
        setSelectedProgramId(programs[0].id);
      }
    }
  }, [representativePrograms, programs, selectedProgramId, initialStudentId, enrollments]);

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

  // Check if selected date is an official school holiday according to Academic Calendar
  const currentHoliday = useMemo(() => {
    if (!selectedDate || academicHolidays.length === 0) return null;
    return academicHolidays.find(h => {
      if (h.startDate && h.endDate) {
        return selectedDate >= h.startDate && selectedDate <= h.endDate;
      }
      return h.startDate === selectedDate;
    }) || null;
  }, [selectedDate, academicHolidays]);

  // Helper to check holiday for any given Shamsi date string
  const getHolidayForDate = (dateStr: string) => {
    if (!dateStr || academicHolidays.length === 0) return null;
    return academicHolidays.find(h => {
      if (h.startDate && h.endDate) {
        return dateStr >= h.startDate && dateStr <= h.endDate;
      }
      return h.startDate === dateStr;
    }) || null;
  };

  // Check if today is a scheduled day of week for current program
  const isScheduledDayForProgram = useMemo(() => {
    if (!currentProgram) return true;
    if (!Array.isArray(currentProgram.daysOfWeek) || currentProgram.daysOfWeek.length === 0) {
      // Default: Saturday to Wednesday are class days
      return dayOfWeekName !== 'جمعه';
    }
    return currentProgram.daysOfWeek.includes(dayOfWeekName as any);
  }, [currentProgram, dayOfWeekName]);

  // Recent / Upcoming Class Sessions based on school schedule and calendar
  const recentProgramSessions = useMemo(() => {
    if (!currentProgram) return [];
    const sessions: Array<{
      date: string;
      dayOfWeek: string;
      isHoliday: boolean;
      holidayTitle?: string;
      record?: AttendanceSessionLog;
      status: 'recorded' | 'cancelled' | 'holiday' | 'pending';
      summary?: string;
    }> = [];

    try {
      const today = getTodayShamsi();
      const todayObj = shamsiToDate(today);

      for (let offset = -14; offset <= 3; offset++) {
        const d = new Date(todayObj);
        d.setDate(d.getDate() + offset);
        const dateStr = dateToShamsi(d);
        const dayName = getShamsiDayOfWeekName(dateStr);

        const isClassDay = Array.isArray(currentProgram.daysOfWeek) && currentProgram.daysOfWeek.length > 0
          ? currentProgram.daysOfWeek.includes(dayName as any)
          : (dayName !== 'جمعه' && dayName !== 'پنج‌شنبه');

        if (isClassDay) {
          const hol = getHolidayForDate(dateStr);
          const rec = attendanceRecords.find(r => r.programId === currentProgram.id && r.date === dateStr);

          let status: 'recorded' | 'cancelled' | 'holiday' | 'pending' = 'pending';
          let summary = '';

          if (rec) {
            if (rec.isCancelled) {
              status = 'cancelled';
              summary = rec.cancellationReason || 'عدم تشکیل کلاس';
            } else {
              status = 'recorded';
              const pCount = rec.students?.filter(s => s.status === 'present').length || 0;
              const aCount = rec.students?.filter(s => s.status === 'absent').length || 0;
              summary = `${pCount} حاضر، ${aCount} غایب` + (rec.hasSubstituteTeacher ? ` (استاد جایگزین: ${rec.substituteTeacherName || 'دارد'})` : '');
            }
          } else if (hol) {
            status = 'holiday';
            summary = `تعطیلی تقویم: ${hol.title}`;
          } else {
            status = 'pending';
            summary = 'در انتظار ثبت';
          }

          sessions.push({
            date: dateStr,
            dayOfWeek: dayName,
            isHoliday: !!hol,
            holidayTitle: hol?.title,
            record: rec,
            status,
            summary
          });
        }
      }
    } catch (err) {
      console.error('Error generating recent sessions:', err);
    }

    return sessions;
  }, [currentProgram, attendanceRecords, academicHolidays]);

  // Calculate if date is locked for representative
  const isDateLockedForRepresentative = useMemo(() => {
    if (isSuperAdmin || isEducationManager || educationBypassLock) return false;
    if (!isRepresentative) return false;

    try {
      const todayDate = shamsiToDate(getTodayShamsi());
      const recordDate = shamsiToDate(selectedDate);
      const diffTime = todayDate.getTime() - recordDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const allowedDays = settings.representativeEditWindowDays || 7;
      return diffDays > allowedDays;
    } catch {
      return false;
    }
  }, [selectedDate, isSuperAdmin, isEducationManager, educationBypassLock, isRepresentative, settings]);

  // Load or initialize attendance record when date or program changes
  useEffect(() => {
    if (!selectedProgramId || !selectedDate) return;

    const existingRecord = attendanceRecords.find(
      r => r.programId === selectedProgramId && r.date === selectedDate
    );

    if (existingRecord) {
      setIsCancelled(existingRecord.isCancelled || false);
      setCancellationReason(existingRecord.cancellationReason || '');
      setHasSubstituteTeacher(existingRecord.hasSubstituteTeacher || false);
      setSubstituteTeacherId(existingRecord.substituteTeacherId);
      setSubstituteTeacherName(existingRecord.substituteTeacherName || '');
      setSubstituteTeacherNotes(existingRecord.substituteTeacherNotes || '');
      setSessionNotes(existingRecord.notes || '');

      const attMap: Record<string, AttendanceStatus> = {};
      const noteMap: Record<string, string> = {};
      const lateMap: Record<string, number> = {};
      const warnMap: Record<string, boolean> = {};
      const excMap: Record<string, { isExcused: boolean; reason: string }> = {};

      existingRecord.students?.forEach(item => {
        if (item.status) {
          attMap[item.studentId] = item.status;
        }
        if (item.note) noteMap[item.studentId] = item.note;
        if (item.lateMinutes) lateMap[item.studentId] = item.lateMinutes;
        if (item.hasEducationalWarning) warnMap[item.studentId] = true;
        if (item.isExcused) {
          excMap[item.studentId] = { isExcused: true, reason: item.excuseReason || '' };
        }
      });

      // Keep unrecorded students undefined (do NOT default to present)
      setStudentsAttendance(attMap);
      setStudentNotes(noteMap);
      setStudentLateMinutes(lateMap);
      setStudentWarnings(warnMap);
      setStudentExcused(excMap);
    } else {
      setIsCancelled(false);
      setCancellationReason('');
      setHasSubstituteTeacher(false);
      setSubstituteTeacherId(undefined);
      setSubstituteTeacherName('');
      setSubstituteTeacherNotes('');
      setSessionNotes('');

      // Fresh session: start empty without pre-selecting present or absent
      setStudentsAttendance({});
      setStudentNotes({});
      setStudentLateMinutes({});
      setStudentWarnings({});
      setStudentExcused({});
    }
    setIsSavedRecently(false);
  }, [selectedProgramId, selectedDate, attendanceRecords, enrolledStudents]);

  // Bulk actions
  const handleMarkAll = (status: AttendanceStatus) => {
    if (isDateLockedForRepresentative) return;
    const updated: Record<string, AttendanceStatus> = {};
    enrolledStudents.forEach(s => {
      updated[s.id] = status;
    });
    setStudentsAttendance(updated);
  };

  const handleSetStudentStatus = (studentId: string, status: AttendanceStatus) => {
    if (isDateLockedForRepresentative) return;
    setStudentsAttendance(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  // Date Navigation
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
    if (isDateLockedForRepresentative) {
      alert("مهلت ثبت و ویرایش توسط نماینده کلاس به پایان رسیده است.");
      return;
    }
    setIsSaving(true);

    try {
      const recordId = `${currentProgram.id}_${selectedDate.replace(/\//g, '-')}`;

      const studentItems: StudentAttendanceDetail[] = enrolledStudents.map(s => ({
        studentId: s.id,
        studentName: s.name,
        nationalId: s.nationalId || '',
        status: studentsAttendance[s.id] || 'unspecified',
        note: studentNotes[s.id] || '',
        lateMinutes: studentLateMinutes[s.id] || undefined,
        isExcused: studentExcused[s.id]?.isExcused || false,
        excuseReason: studentExcused[s.id]?.reason || '',
        hasEducationalWarning: studentWarnings[s.id] || false,
        warningRegisteredBy: studentWarnings[s.id] ? (currentUser?.fullName || currentUser?.name || currentUser?.username) : undefined,
        warningRegisteredAt: studentWarnings[s.id] ? new Date().toISOString() : undefined
      }));

      const newRecord: AttendanceSessionLog = {
        id: recordId,
        programId: currentProgram.id,
        programTitle: currentProgram.title,
        grade: currentProgram.grade || '',
        date: selectedDate,
        dayOfWeek: dayOfWeekName,
        isCancelled,
        cancellationReason: isCancelled ? cancellationReason : '',
        hasSubstituteTeacher,
        substituteTeacherId: hasSubstituteTeacher ? substituteTeacherId : undefined,
        substituteTeacherName: hasSubstituteTeacher ? substituteTeacherName : undefined,
        substituteTeacherNotes: hasSubstituteTeacher ? substituteTeacherNotes : undefined,
        notes: sessionNotes,
        recordedByUserId: currentUser?.id,
        recordedByName: currentUser?.fullName || currentUser?.name || currentUser?.username || 'نماینده کلاس',
        recordedAt: new Date().toISOString(),
        students: studentItems
      };

      await localDb.setDoc('attendance', newRecord);

      // Create workflow item if any student has educational warning
      for (const s of enrolledStudents) {
        if (studentWarnings[s.id]) {
          const wfItem: WorkflowItem = {
            id: `wf-att-warn-${s.id}-${Date.now()}`,
            type: 'notice',
            category: 'unexcused_absence_warning',
            title: `اخطار آموزشی حضور و غیاب: ${s.name}`,
            description: `اخطار آموزشی برای طلبه ${s.name} (${currentProgram.grade || ''}) در درس ${currentProgram.title} به علت غیبت در تاریخ ${selectedDate} ثبت گردید.`,
            status: 'pending',
            grade: currentProgram.grade || 'عمومی',
            studentId: s.id,
            studentName: s.name,
            requiresEducationApproval: false,
            createdByUserId: currentUser?.id,
            createdByName: currentUser?.fullName || currentUser?.name || currentUser?.username,
            createdAt: new Date().toISOString(),
            details: {
              programTitle: currentProgram.title,
              date: selectedDate,
              reason: studentNotes[s.id] || 'غیبت غیرموجه در کلاس'
            }
          };
          await localDb.setDoc('workflow_items', wfItem);
        }
      }

      setAttendanceRecords(prev => {
        const filtered = prev.filter(r => r.id !== recordId);
        return [newRecord, ...filtered];
      });

      setIsSavedRecently(true);
      showToast("حضور و غیاب با موفقیت در سیستم ثبت گردید.");
    } catch (err) {
      console.error('Error saving attendance:', err);
      alert('خطا در ذخیره حضور و غیاب.');
    } finally {
      setIsSaving(false);
    }
  };

  // Absence Justification handler
  const handleConfirmJustification = () => {
    if (!justifyingStudent) return;
    const sid = justifyingStudent.studentId;
    setStudentExcused(prev => ({
      ...prev,
      [sid]: { isExcused: true, reason: justificationReasonInput }
    }));
    setStudentsAttendance(prev => ({
      ...prev,
      [sid]: 'excused'
    }));
    setJustifyingStudent(null);
    setJustificationReasonInput('');
    showToast(`غیبت طلبه ${justifyingStudent.studentName} موجه گردید.`);
  };

  // Quick stats for current active session
  const activeSessionStats = useMemo(() => {
    const list = Object.values(studentsAttendance);
    return {
      present: list.filter(s => s === 'present').length,
      absent: list.filter(s => s === 'absent').length,
      late: list.filter(s => s === 'late').length,
      excused: list.filter(s => s === 'excused').length,
      unspecified: list.filter(s => s === 'unspecified').length,
    };
  }, [studentsAttendance]);

  // =========================================================================
  // Report Analytics & Missing Attendance Detection
  // =========================================================================

  // Filtered attendance records for report tab
  const filteredReportRecords = useMemo(() => {
    return attendanceRecords.filter(r => {
      if (reportGradeFilter !== 'all' && r.grade !== reportGradeFilter) return false;
      if (reportProgramFilter !== 'all' && r.programId !== reportProgramFilter) return false;
      if (reportStartDate && r.date < reportStartDate) return false;
      if (reportEndDate && r.date > reportEndDate) return false;
      return true;
    });
  }, [attendanceRecords, reportGradeFilter, reportProgramFilter, reportStartDate, reportEndDate]);

  // Overall Report Metrics
  const overallReportMetrics = useMemo(() => {
    let totalSessions = filteredReportRecords.length;
    let heldSessions = filteredReportRecords.filter(r => !r.isCancelled).length;
    let cancelledSessions = filteredReportRecords.filter(r => r.isCancelled).length;

    let totalPresents = 0;
    let totalAbsents = 0;
    let totalLates = 0;
    let totalExcused = 0;
    let totalUnspecified = 0;
    let totalWarnings = 0;

    filteredReportRecords.forEach(r => {
      if (!r.isCancelled && Array.isArray(r.students)) {
        r.students.forEach(s => {
          if (s.status === 'present') totalPresents++;
          else if (s.status === 'absent') totalAbsents++;
          else if (s.status === 'late') totalLates++;
          else if (s.status === 'excused') totalExcused++;
          else if (s.status === 'unspecified') totalUnspecified++;
          if (s.hasEducationalWarning) totalWarnings++;
        });
      }
    });

    return {
      totalSessions,
      heldSessions,
      cancelledSessions,
      totalPresents,
      totalAbsents,
      totalLates,
      totalExcused,
      totalUnspecified,
      totalWarnings
    };
  }, [filteredReportRecords]);

  // Aggregated Per-Student Report Data
  const studentReportList = useMemo(() => {
    const studentMap: Record<string, {
      student: any;
      heldSessionsEnrolled: number;
      presentCount: number;
      absentCount: number;
      lateCount: number;
      excusedCount: number;
      unspecifiedCount: number;
      warningCount: number;
      history: { date: string; programTitle: string; status: AttendanceStatus; isCancelled: boolean; note?: string; excuseReason?: string; hasWarning?: boolean }[];
    }> = {};

    // Initialize students matching filter
    students.forEach(s => {
      if (reportGradeFilter !== 'all' && s.grade !== reportGradeFilter) return;
      if (reportSearchQuery && !s.name?.toLowerCase().includes(reportSearchQuery.toLowerCase()) && !s.nationalId?.includes(reportSearchQuery)) return;

      studentMap[s.id] = {
        student: s,
        heldSessionsEnrolled: 0,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        excusedCount: 0,
        unspecifiedCount: 0,
        warningCount: 0,
        history: []
      };
    });

    filteredReportRecords.forEach(rec => {
      if (Array.isArray(rec.students)) {
        rec.students.forEach(stItem => {
          if (studentMap[stItem.studentId]) {
            const entry = studentMap[stItem.studentId];
            if (!rec.isCancelled) {
              entry.heldSessionsEnrolled++;
              if (stItem.status === 'present') entry.presentCount++;
              else if (stItem.status === 'absent') entry.absentCount++;
              else if (stItem.status === 'late') entry.lateCount++;
              else if (stItem.status === 'excused') entry.excusedCount++;
              else if (stItem.status === 'unspecified') {
                if (settings.unspecifiedCountAs === 'absent') entry.absentCount++;
                else if (settings.unspecifiedCountAs === 'present') entry.presentCount++;
                else if (settings.unspecifiedCountAs === 'late') entry.lateCount++;
                else entry.unspecifiedCount++;
              }
              if (stItem.hasEducationalWarning) entry.warningCount++;
            }
            entry.history.push({
              date: rec.date,
              programTitle: rec.programTitle,
              status: stItem.status,
              isCancelled: rec.isCancelled,
              note: stItem.note,
              excuseReason: stItem.excuseReason,
              hasWarning: stItem.hasEducationalWarning
            });
          }
        });
      }
    });

    const list = Object.values(studentMap).sort((a, b) => b.absentCount - a.absentCount || a.student.name.localeCompare(b.student.name, 'fa'));

    if (reportWarningOnlyFilter) {
      const threshold = settings.unexcusedWarningThreshold || 3;
      return list.filter(item => item.absentCount >= threshold || item.warningCount > 0);
    }

    return list;
  }, [students, filteredReportRecords, reportGradeFilter, reportSearchQuery, reportWarningOnlyFilter, settings]);

  // Handler to issue educational warning
  const handleConfirmIssueWarning = async () => {
    if (!issuingWarningStudent) return;
    const s = issuingWarningStudent.student;
    const progTitle = issuingWarningStudent.programTitle || 'دروس مدرسه';
    const reason = warningReasonInput.trim() || `ثبت اخطار آموزشی برای طلبه ${s.name} (${s.grade || 'عمومی'}) به علت داشتن ${issuingWarningStudent.absentCount} جلسه غیبت غیرموجه در درس ${progTitle}.`;

    try {
      const wfItem: WorkflowItem = {
        id: `wf_warn_${s.id}_${Date.now()}`,
        type: 'notice',
        category: 'unexcused_absence_warning',
        title: `اخطار آموزشی غیبت غیرموجه: ${s.name}`,
        description: reason,
        status: 'pending',
        grade: s.grade || 'عمومی',
        studentId: s.id,
        studentName: s.name,
        nationalId: s.nationalId,
        requiresEducationApproval: false,
        createdByUserId: currentUser?.id,
        createdByName: currentUser?.fullName || currentUser?.name || currentUser?.roleTitle || 'مسئول آموزش',
        createdAt: new Date().toISOString(),
        details: {
          absentCount: issuingWarningStudent.absentCount,
          programTitle: progTitle,
          reason
        }
      };

      await localDb.setDoc('workflow_items', wfItem);
      setIssuingWarningStudent(null);
      setWarningReasonInput('');
      showToast(`اخطار آموزشی برای ${s.name} با موفقیت در جریان کار ثبت شد.`);
    } catch (err) {
      console.error('Error creating warning item:', err);
      alert('خطا در ثبت اخطار آموزشی.');
    }
  };

  // Handler to export report to Excel
  const handleExportReportToExcel = () => {
    try {
      const rows = studentReportList.map((item, idx) => ({
        'ردیف': idx + 1,
        'نام و نام خانوادگی طلبه': item.student.name,
        'کد ملی': item.student.nationalId || '',
        'پایه تحصیلی': item.student.grade || '',
        'تعداد جلسات برگزار شده': item.heldSessionsEnrolled,
        'تعداد حضور': item.presentCount,
        'غیبت غیرموجه': item.absentCount,
        'غیبت موجه': item.excusedCount,
        'تاخیر در ورود': item.lateCount,
        'نامشخص': item.unspecifiedCount,
        'تعداد اخطارهای آموزشی': item.warningCount,
        'درصد حضور': item.heldSessionsEnrolled > 0 ? `${Math.round((item.presentCount / item.heldSessionsEnrolled) * 100)}%` : '۰%'
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'آمار حضور و غیاب');
      const fileName = `گزارش_حضور_و_غیاب_طلاب_${selectedDate.replace(/\//g, '-')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      showToast('فایل اکسل گزارش با موفقیت دریافت شد.');
    } catch (err) {
      console.error('Export error:', err);
      alert('خطا در ایجاد فایل اکسل.');
    }
  };

  if (isLoading) {
    return (
      <div className="p-10 flex flex-col items-center justify-center space-y-3 font-vazir" dir="rtl">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-bold">در حال بارگذاری سیستم حضور و غیاب...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-vazir" dir="rtl">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border border-slate-700"
          >
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center shadow-xs border border-indigo-100">
            <CheckSquare size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900">سامانه حضور و غیاب و آمار کلاس‌ها</h1>
              <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-black rounded-lg">
                نسخه هوشمند مدرسه
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              ثبت روزانه توسط نمایندگان کلاس‌ها و مسئولین آموزش همراه با گزارش‌گیری جامع، اخطار آموزشی و موجه‌سازی
            </p>
          </div>
        </div>

        {/* View Switcher & Settings */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="p-1 bg-slate-100 rounded-2xl flex items-center border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('record')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
                activeTab === 'record'
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <CheckSquare size={15} />
              <span>ثبت و ویرایش جلسه</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('report')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
                activeTab === 'report'
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <FileCheck2 size={15} />
              <span>گزارش‌ها و آمار غیبت</span>
            </button>
          </div>

          {canManageSettings && (
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl transition-all shadow-2xs hover:border-slate-300 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="تنظیمات مهلت ویرایش و گزارش‌ها"
            >
              <SlidersHorizontal size={16} className="text-indigo-600" />
              <span className="hidden sm:inline">تنظیمات</span>
            </button>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: RECORD ATTENDANCE (ثبت و ویرایش جلسه) */}
      {/* ===================================================================== */}
      {activeTab === 'record' && (
        <div className="space-y-6">
          {/* Warning Banner if locked for Representative */}
          {isDateLockedForRepresentative && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-900 text-xs font-bold">
              <ShieldAlert size={20} className="text-amber-600 shrink-0" />
              <div>
                <span>مهلت ویرایش توسط نماینده کلاس ({settings.representativeEditWindowDays || 7} روز) برای این تاریخ به پایان رسیده است.</span>
                <span className="block text-[11px] text-amber-700 font-medium mt-0.5">
                  اطلاعات این جلسه فقط خواندنی است. در صورت نیاز به تغییر، با مسئول آموزش هماهنگ فرمایید.
                </span>
              </div>
            </div>
          )}

          {/* Top Controls: Program Selector & Date Picker */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Class Program Selector */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <BookOpen size={15} className="text-indigo-600" />
                <span>انتخاب کلاس درس:</span>
              </label>
              <select
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
                className="w-full p-2.5 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-800 cursor-pointer"
              >
                {(representativePrograms.length > 0 ? representativePrograms : programs).map(p => {
                  const titleStr = p.title || p.name || 'کلاس بدون عنوان';
                  const gradeStr = p.grade ? ` (${p.grade})` : '';
                  const teacherStr = (p.teacher || p.teacherName) ? ` - استاد ${p.teacher || p.teacherName}` : '';
                  return (
                    <option key={p.id} value={p.id}>
                      {titleStr}{gradeStr}{teacherStr}
                    </option>
                  );
                })}
              </select>

              {currentProgram && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                  {currentProgram.grade && (
                    <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-md border border-indigo-100">
                      {currentProgram.grade}
                    </span>
                  )}
                  {(currentProgram.teacher || currentProgram.teacherName) && (
                    <span className="bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-md">
                      استاد: {currentProgram.teacher || currentProgram.teacherName}
                    </span>
                  )}
                  {(currentProgram.madrasRoom || currentProgram.classroom) && (
                    <span className="bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
                      <DoorOpen size={12} className="text-indigo-600" />
                      <span>مَدرَس: {currentProgram.madrasRoom || currentProgram.classroom}</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 2. Date Selector */}
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
            </div>
          </div>

          {/* Academic Calendar Holiday Alert Banner */}
          {currentHoliday && (
            <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <div className="text-xs font-black">
                    📌 تقویم آموزشی مدرسه: این تاریخ به عنوان «{currentHoliday.title}» ({currentHoliday.typeName || 'تعطیل رسمی'}) در تقویم آموزشی ثبت شده است.
                  </div>
                  {currentHoliday.description && (
                    <div className="text-[11px] text-amber-800 mt-0.5">{currentHoliday.description}</div>
                  )}
                </div>
              </div>
              {!isCancelled && !isDateLockedForRepresentative && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCancelled(true);
                    setCancellationReason(`تعطیلی تقویم آموزشی: ${currentHoliday.title}`);
                  }}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <UserX size={14} />
                  <span>ثبت عدم تشکیل کلاس به دلیل تعطیلی</span>
                </button>
              )}
            </div>
          )}

          {/* Program Schedule Day notice */}
          {!isScheduledDayForProgram && currentProgram?.daysOfWeek && currentProgram.daysOfWeek.length > 0 && dayOfWeekName !== 'جمعه' && (
            <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-center gap-2.5 text-blue-900 text-xs font-medium">
              <Info size={16} className="text-blue-600 shrink-0" />
              <span>
                توجه: روز {dayOfWeekName} جزو روزهای مصوب هفتگی برگزاری این کلاس نیست (روزهای مصوب: {currentProgram.daysOfWeek.join('، ')}).
              </span>
            </div>
          )}

          {/* Recent Scheduled Sessions Timeline Strip */}
          {recentProgramSessions.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <CalendarCheck size={16} className="text-indigo-600" />
                  <span>جلسات درسی این کلاس طبق تقویم و برنامه هفتگی:</span>
                </span>
                <span className="text-[11px] text-slate-400 font-bold">
                  (جهت انتخاب سریع تاریخ روی هر جلسه کلیک فرمایید)
                </span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {recentProgramSessions.map(sess => {
                  const isSelected = sess.date === selectedDate;
                  return (
                    <button
                      key={sess.date}
                      type="button"
                      onClick={() => setSelectedDate(sess.date)}
                      className={cn(
                        "flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all min-w-[110px] shrink-0 cursor-pointer",
                        isSelected 
                          ? "bg-indigo-50 border-indigo-500 shadow-xs ring-2 ring-indigo-400/40"
                          : sess.status === 'recorded'
                            ? "bg-emerald-50/50 hover:bg-emerald-50 border-emerald-200 text-emerald-900"
                            : sess.status === 'cancelled'
                              ? "bg-rose-50/50 hover:bg-rose-50 border-rose-200 text-rose-900"
                              : sess.status === 'holiday'
                                ? "bg-amber-50/50 hover:bg-amber-50 border-amber-200 text-amber-900"
                                : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                      )}
                    >
                      <span className="text-[10px] text-slate-500 font-bold">{sess.dayOfWeek}</span>
                      <span className="text-xs font-black font-mono mt-0.5">{sess.date.slice(5)}</span>
                      <div className="mt-1 flex flex-col items-center gap-0.5">
                        {sess.status === 'recorded' && (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[9px] font-bold">
                            ثبت شد
                          </span>
                        )}
                        {sess.record?.hasSubstituteTeacher && (
                          <span className="px-1 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[8px] font-black">
                            استاد جایگزین
                          </span>
                        )}
                        {sess.status === 'cancelled' && (
                          <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded-md text-[9px] font-bold">
                            عدم تشکیل
                          </span>
                        )}
                        {sess.status === 'holiday' && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[9px] font-bold">
                            تعطیل تقویم
                          </span>
                        )}
                        {sess.status === 'pending' && (
                          <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded-md text-[9px] font-bold">
                            ثبت نشده
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unrecorded Attendance Notice Banner */}
          {!attendanceRecords.some(r => r.programId === selectedProgramId && r.date === selectedDate) && !isCancelled && !currentHoliday && (
            <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-950 shadow-xs animate-pulse">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-600 text-white rounded-xl shrink-0">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <div className="text-xs font-black flex items-center gap-1.5">
                    <span>⚠️ عدم انجام حضور و غیاب برای این جلسه:</span>
                    <span className="text-rose-700 bg-rose-100 px-2 py-0.5 rounded-lg border border-rose-200">وضعیت: هنوز ثبت نهایی نشده است</span>
                  </div>
                  <div className="text-[11px] text-rose-800 mt-0.5 font-medium">
                    {isRepresentative 
                      ? 'نماینده محترم، لطفاً وضعیت حضور، غیبت یا تاخیر طلاب را تعیین کرده و دکمه «ثبت نهایی حضور و غیاب» را بفشارید.'
                      : 'این جلسه توسط نماینده کلاس یا استاد هنوز ثبت نهایی نشده است و در گزارش‌های آموزشی به عنوان «عدم ثبت» مشخص می‌شود.'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Education Manager Special Toolbar */}
          {(isEducationManager || isSuperAdmin) && (
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <GraduationCap size={18} className="text-indigo-700" />
                <span className="font-black text-indigo-950">پنل مدیریت آموزش فعال است:</span>
                <span className="text-indigo-700 text-[11px]">امکان اصلاح، ثبت دستی و موجه‌سازی برای کلیه جلسات</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleMarkAll('present')}
                  disabled={isCancelled}
                  className="px-3 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1 text-[11px]"
                >
                  <UserCheck size={13} />
                  <span>ثبت همه به عنوان حاضر</span>
                </button>
              </div>
            </div>
          )}

          {/* Class Status Controls: Class Cancellation & Substitute Teacher */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Class Cancellation Toggle (اعلام عدم تشکیل کلاس) */}
            <div className={cn(
              "p-4 sm:p-5 rounded-2xl border transition-all space-y-3 flex flex-col justify-between",
              isCancelled 
                ? "bg-rose-50/90 border-rose-200 shadow-xs" 
                : "bg-white border-slate-200 shadow-xs"
            )}>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={isDateLockedForRepresentative}
                      onClick={() => {
                        const nextCancelled = !isCancelled;
                        setIsCancelled(nextCancelled);
                        if (nextCancelled && hasSubstituteTeacher) {
                          setHasSubstituteTeacher(false);
                          setSubstituteTeacherId(undefined);
                          setSubstituteTeacherName('');
                          setSubstituteTeacherNotes('');
                        }
                      }}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                        isCancelled ? "bg-rose-600" : "bg-slate-200",
                        isDateLockedForRepresentative && "opacity-50 cursor-not-allowed"
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
                        اعلام عدم برگزاری کلاس (تعطیلی / لغو)
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        در صورت تعطیلی رسمی، عدم تشکیل یا لغو کامل جلسه
                      </p>
                    </div>
                  </div>

                  {isCancelled && (
                    <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full text-[11px] font-black border border-rose-200 flex items-center gap-1 shrink-0">
                      <UserX size={13} />
                      <span>کلاس لغو شد</span>
                    </span>
                  )}
                </div>

                {isCancelled && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }}
                    className="pt-2 border-t border-rose-200/80 space-y-2"
                  >
                    <label className="block text-xs font-bold text-rose-900">
                      علت عدم برگزاری کلاس:
                    </label>
                    <input
                      type="text"
                      disabled={isDateLockedForRepresentative}
                      placeholder="مثلاً: تعطیلی رسمی، مراسم، فوق‌برنامه..."
                      className="w-full px-3.5 py-2 text-xs border border-rose-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-rose-500 font-medium text-slate-800"
                      value={cancellationReason}
                      onChange={(e) => setCancellationReason(e.target.value)}
                    />
                  </motion.div>
                )}
              </div>
            </div>

            {/* 2. Substitute Teacher (حضور استاد جایگزین) */}
            <div className={cn(
              "p-4 sm:p-5 rounded-2xl border transition-all space-y-3 flex flex-col justify-between",
              hasSubstituteTeacher 
                ? "bg-amber-50/90 border-amber-300 shadow-xs" 
                : "bg-white border-slate-200 shadow-xs"
            )}>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={isDateLockedForRepresentative || isCancelled}
                      onClick={() => {
                        if (isCancelled) return;
                        if (isEducationManager || isSuperAdmin) {
                          // Open modal directly for education manager
                          setIsSubstituteModalOpen(true);
                        } else {
                          // Class representative toggle
                          const nextState = !hasSubstituteTeacher;
                          setHasSubstituteTeacher(nextState);
                          if (!nextState) {
                            setSubstituteTeacherId(undefined);
                            setSubstituteTeacherName('');
                            setSubstituteTeacherNotes('');
                          }
                        }
                      }}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                        hasSubstituteTeacher ? "bg-amber-600" : "bg-slate-200",
                        (isDateLockedForRepresentative || isCancelled) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                          hasSubstituteTeacher ? "-translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                    <div>
                      <h4 className={cn("text-xs font-black", hasSubstituteTeacher ? "text-amber-950" : "text-slate-800")}>
                        حضور استاد جایگزین
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        در صورت حضور استاد دیگر به جای استاد اصلی کلاس
                      </p>
                    </div>
                  </div>

                  {hasSubstituteTeacher && (
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-full text-[11px] font-black border border-amber-300 flex items-center gap-1 shrink-0">
                      <UserCheck2 size={13} />
                      <span>استاد جایگزین حاضر</span>
                    </span>
                  )}
                </div>

                {hasSubstituteTeacher && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }}
                    className="pt-2 border-t border-amber-200/80 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs">
                        <span className="text-slate-500 font-medium ml-1">استاد حاضر شده:</span>
                        <span className="font-black text-amber-900">
                          {substituteTeacherName ? substituteTeacherName : 'استاد جایگزین (ثبت شده توسط نماینده)'}
                        </span>
                        {substituteTeacherNotes && (
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            توضیحات: {substituteTeacherNotes}
                          </p>
                        )}
                      </div>

                      {(isEducationManager || isSuperAdmin) && (
                        <button
                          type="button"
                          onClick={() => setIsSubstituteModalOpen(true)}
                          className="px-2.5 py-1 bg-white hover:bg-amber-100/60 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-colors shrink-0"
                        >
                          <Edit3 size={12} />
                          <span>انتخاب / ویرایش استاد</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          {/* Main Attendance Marking Section */}
          {!isCancelled ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4">
              {/* Section Toolbar and Stats */}
              <div className="bg-slate-50/90 p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex flex-col">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Users className="text-indigo-600" size={18} />
                      <span>لیست طلاب درس: «{currentProgram?.title}» ({enrolledStudents.length} نفر)</span>
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium mt-0.5">
                      <span>{currentProgram?.grade ? `پایه ${currentProgram.grade}` : ''}</span>
                      {currentProgram?.teacherName && <span>• استاد: {currentProgram.teacherName}</span>}
                      {currentProgram?.madrasRoom && <span>• مَدرَس: {currentProgram.madrasRoom}</span>}
                    </div>
                  </div>

                  {/* Status Counters */}
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <span className="px-2.5 py-1 bg-emerald-100/80 text-emerald-900 font-black rounded-lg border border-emerald-200">
                      {activeSessionStats.present} حاضر
                    </span>
                    <span className="px-2.5 py-1 bg-rose-100/80 text-rose-900 font-black rounded-lg border border-rose-200">
                      {activeSessionStats.absent} غایب
                    </span>
                    <span className="px-2.5 py-1 bg-amber-100/80 text-amber-900 font-black rounded-lg border border-amber-200">
                      {activeSessionStats.late} تاخیر
                    </span>
                    <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 font-bold rounded-lg border border-indigo-200">
                      {activeSessionStats.excused} موجه
                    </span>
                    {activeSessionStats.unspecified > 0 && (
                      <span className="px-2.5 py-1 bg-amber-100/90 text-amber-900 font-bold rounded-lg border border-amber-300">
                        {activeSessionStats.unspecified} نامشخص / تعیین‌نشده
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Bulk Actions & Top Save Button */}
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {!isDateLockedForRepresentative && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-400">تیک همگانی:</span>
                      <button
                        type="button"
                        onClick={() => handleMarkAll('present')}
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                      >
                        <CheckCircle2 size={13} className="text-emerald-600" />
                        <span>حضور همه</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMarkAll('absent')}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                      >
                        <XCircle size={13} className="text-rose-600" />
                        <span>غیبت همه</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setStudentsAttendance({})}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                        title="ریست وضعیت همه طلاب به نامشخص"
                      >
                        <span>پاکسازی تیک‌ها</span>
                      </button>
                    </div>
                  )}

                  {/* Top Final Save Button */}
                  <button
                    type="button"
                    onClick={handleSaveAttendance}
                    disabled={isSaving || !currentProgram || isDateLockedForRepresentative}
                    className={cn(
                      "px-4 py-2 rounded-xl font-black text-xs transition-all shadow-sm cursor-pointer flex items-center gap-1.5 shrink-0",
                      isDateLockedForRepresentative
                        ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                        : isSavedRecently 
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200" 
                          : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-indigo-200"
                    )}
                  >
                    <Save size={15} />
                    <span>{isSaving ? 'در حال ثبت...' : 'ثبت نهایی حضور و غیاب'}</span>
                  </button>
                </div>
              </div>

              {/* Student Roster Table */}
              {enrolledStudents.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <AlertCircle size={36} className="text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-600">هیچ طلبه‌ای برای این کلاس ثبت‌نام نشده است.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 px-3 sm:px-5">
                  {enrolledStudents.map((student, index) => {
                    const currentStatus = studentsAttendance[student.id]; // undefined if not chosen yet
                    const studentNote = studentNotes[student.id] || '';
                    const hasWarning = !!studentWarnings[student.id];
                    const isExc = studentExcused[student.id]?.isExcused;
                    const isHighlighted = initialStudentId && String(student.id) === String(initialStudentId);

                    return (
                      <div 
                        key={student.id}
                        id={`attendance-student-${student.id}`}
                        className={cn(
                          "py-3 sm:py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-2 rounded-xl transition-all duration-300",
                          isHighlighted 
                            ? "bg-amber-50/90 ring-2 ring-amber-400 shadow-sm" 
                            : !currentStatus
                              ? "bg-slate-50/40 hover:bg-slate-50/80"
                              : "hover:bg-slate-50/80"
                        )}
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
                              {(!currentStatus || currentStatus === 'unspecified') && (
                                <span className="text-[10px] bg-amber-50 text-amber-800 font-bold px-1.5 py-0.2 rounded border border-amber-200">
                                  تعیین‌نشده (نامشخص)
                                </span>
                              )}
                              {hasWarning && (
                                <span className="text-[10px] bg-rose-100 text-rose-800 font-black px-1.5 py-0.2 rounded border border-rose-200 flex items-center gap-0.5">
                                  <AlertTriangle size={10} />
                                  <span>اخطار آموزشی</span>
                                </span>
                              )}
                            </div>
                            {student.nationalId && (
                              <span className="text-[10px] text-slate-400 font-mono">کد ملی: {student.nationalId}</span>
                            )}
                          </div>
                        </div>

                        {/* Interactive Status Buttons & Individual Note */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Status Options - Role Aware */}
                          <div className="inline-flex rounded-xl p-1 bg-slate-100/90 border border-slate-200">
                            {/* 1. Present */}
                            <button
                              type="button"
                              disabled={isDateLockedForRepresentative}
                              onClick={() => handleSetStudentStatus(student.id, 'present')}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer",
                                currentStatus === 'present'
                                  ? "bg-emerald-600 text-white shadow-xs scale-102"
                                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                              )}
                            >
                              <CheckCircle2 size={12} />
                              <span>حاضر</span>
                            </button>

                            {/* 2. Absent */}
                            <button
                              type="button"
                              disabled={isDateLockedForRepresentative}
                              onClick={() => handleSetStudentStatus(student.id, 'absent')}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer",
                                currentStatus === 'absent'
                                  ? "bg-rose-600 text-white shadow-xs scale-102"
                                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                              )}
                            >
                              <XCircle size={12} />
                              <span>غایب</span>
                            </button>

                            {/* 3. Late */}
                            <button
                              type="button"
                              disabled={isDateLockedForRepresentative}
                              onClick={() => handleSetStudentStatus(student.id, 'late')}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer",
                                currentStatus === 'late'
                                  ? "bg-amber-500 text-white shadow-xs scale-102"
                                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                              )}
                            >
                              <Clock3 size={12} />
                              <span>تاخیر</span>
                            </button>

                            {/* 4. Excused - ONLY for Education Manager & Super Admin */}
                            {(isSuperAdmin || isEducationManager || isGradeSupervisor) && (
                              <button
                                type="button"
                                disabled={isDateLockedForRepresentative}
                                onClick={() => handleSetStudentStatus(student.id, 'excused')}
                                className={cn(
                                  "px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer",
                                  currentStatus === 'excused'
                                    ? "bg-indigo-600 text-white shadow-xs scale-102"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                                )}
                              >
                                <span>موجه</span>
                              </button>
                            )}

                            {/* 5. Unspecified - ONLY for Education Manager & Super Admin */}
                            {(isSuperAdmin || isEducationManager || isGradeSupervisor) && (
                              <button
                                type="button"
                                disabled={isDateLockedForRepresentative}
                                onClick={() => handleSetStudentStatus(student.id, 'unspecified')}
                                className={cn(
                                  "px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                                  currentStatus === 'unspecified'
                                    ? "bg-slate-700 text-white shadow-xs"
                                    : "text-slate-500 hover:text-slate-800"
                                )}
                              >
                                <span>نامشخص</span>
                              </button>
                            )}
                          </div>

                          {/* Badge for unrecorded status */}
                          {(!currentStatus || currentStatus === 'unspecified') && (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 text-[10px] font-bold rounded-lg border border-amber-200">
                              ثبت‌نشده
                            </span>
                          )}

                          {/* Justify Absence Button for Admins & Supervisors */}
                          {(isSuperAdmin || isEducationManager || isGradeSupervisor) && (
                            <button
                              type="button"
                              onClick={() => {
                                setJustifyingStudent({ studentId: student.id, studentName: student.name });
                                setJustificationReasonInput(studentExcused[student.id]?.reason || '');
                              }}
                              className="px-2 py-1 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                              title="موجه کردن غیبت با ذکر دلیل"
                            >
                              {isExc ? 'ویرایش موجهی' : 'موجه‌سازی'}
                            </button>
                          )}

                          {/* Educational Warning Checkbox for Admins & Supervisors */}
                          {(isSuperAdmin || isEducationManager || isGradeSupervisor) && (
                            <label className="flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50/80 px-2 py-1 rounded-lg border border-rose-200 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={hasWarning}
                                onChange={(e) => setStudentWarnings({ ...studentWarnings, [student.id]: e.target.checked })}
                                className="w-3.5 h-3.5 accent-rose-600 rounded cursor-pointer"
                              />
                              <span>اخطار آموزشی</span>
                            </label>
                          )}

                          {/* Optional note input for this student */}
                          <input
                            type="text"
                            disabled={isDateLockedForRepresentative}
                            placeholder="توضیح غیبت / علت..."
                            className="w-32 sm:w-40 px-2.5 py-1 text-[11px] border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
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
            </div>
          )}

          {/* Session Notes & Save Button */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText size={16} className="text-indigo-600" />
                <span>توضیحات و گزارش برگزاری جلسه:</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                (مباحث تدریس‌شده، تذکرات استاد، گزارش غیبت‌ها و موارد انضباطی)
              </span>
            </label>
            <textarea
              rows={3}
              disabled={isDateLockedForRepresentative}
              placeholder="توضیحات و نکات مربوط به این جلسه را بنویسید..."
              className="w-full p-3.5 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 focus:bg-white transition-all resize-y font-medium text-slate-800 leading-relaxed"
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
            />

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <span className="text-[11px] text-slate-400 font-medium">
                ثبت‌کننده: {currentUser?.fullName || currentUser?.name || currentUser?.username}
              </span>
              <button
                type="button"
                onClick={handleSaveAttendance}
                disabled={isSaving || !currentProgram || isDateLockedForRepresentative}
                className={cn(
                  "w-full sm:w-auto px-8 py-2.5 rounded-xl font-black text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-2",
                  isDateLockedForRepresentative
                    ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                    : isSavedRecently 
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
      )}

      {/* ===================================================================== */}
      {/* TAB 2: COMPREHENSIVE REPORTS (گزارش‌ها و آمار غیبت) */}
      {/* ===================================================================== */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <div className="text-[11px] font-bold text-slate-500">کل جلسات</div>
              <div className="text-lg font-black text-slate-900 font-mono">{overallReportMetrics.totalSessions}</div>
            </div>
            <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-100 shadow-2xs space-y-1">
              <div className="text-[11px] font-bold text-emerald-800">تشکیل شده</div>
              <div className="text-lg font-black text-emerald-700 font-mono">{overallReportMetrics.heldSessions}</div>
            </div>
            <div className="bg-rose-50/70 p-3.5 rounded-2xl border border-rose-100 shadow-2xs space-y-1">
              <div className="text-[11px] font-bold text-rose-800">تشکیل نشده</div>
              <div className="text-lg font-black text-rose-700 font-mono">{overallReportMetrics.cancelledSessions}</div>
            </div>
            <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200 shadow-2xs space-y-1">
              <div className="text-[11px] font-bold text-emerald-800">کل حضورها</div>
              <div className="text-lg font-black text-emerald-700 font-mono">{overallReportMetrics.totalPresents}</div>
            </div>
            <div className="bg-rose-50 p-3.5 rounded-2xl border border-rose-200 shadow-2xs space-y-1">
              <div className="text-[11px] font-bold text-rose-800">غیبت غیرموجه</div>
              <div className="text-lg font-black text-rose-700 font-mono">{overallReportMetrics.totalAbsents}</div>
            </div>
            <div className="bg-indigo-50 p-3.5 rounded-2xl border border-indigo-200 shadow-2xs space-y-1">
              <div className="text-[11px] font-bold text-indigo-800">غیبت موجه</div>
              <div className="text-lg font-black text-indigo-700 font-mono">{overallReportMetrics.totalExcused}</div>
            </div>
            <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 shadow-2xs space-y-1">
              <div className="text-[11px] font-bold text-amber-800">کل تاخیرها</div>
              <div className="text-lg font-black text-amber-700 font-mono">{overallReportMetrics.totalLates}</div>
            </div>
            <div className="bg-rose-100/60 p-3.5 rounded-2xl border border-rose-300 shadow-2xs space-y-1">
              <div className="text-[11px] font-bold text-rose-900">اخطار آموزشی</div>
              <div className="text-lg font-black text-rose-800 font-mono">{overallReportMetrics.totalWarnings}</div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Filter size={15} className="text-indigo-600" />
                <span>فیلترهای گزارش حضور و غیاب:</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                تعداد طلاب یافته شده: {studentReportList.length} نفر
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute right-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="جستجوی نام طلبه یا کد ملی..."
                  value={reportSearchQuery}
                  onChange={(e) => setReportSearchQuery(e.target.value)}
                  className="w-full pr-8 pl-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Grade Filter */}
              <div>
                <select
                  value={reportGradeFilter}
                  onChange={(e) => setReportGradeFilter(e.target.value)}
                  className="w-full p-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 focus:bg-white outline-none"
                >
                  <option value="all">همه پایه‌های تحصیلی</option>
                  <option value="پایه ۷">پایه ۷</option>
                  <option value="پایه ۸">پایه ۸</option>
                  <option value="پایه ۹">پایه ۹</option>
                  <option value="پایه ۱۰">پایه ۱۰</option>
                  <option value="پایه ۱۱">پایه ۱۱</option>
                </select>
              </div>

              {/* Program Filter */}
              <div>
                <select
                  value={reportProgramFilter}
                  onChange={(e) => setReportProgramFilter(e.target.value)}
                  className="w-full p-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 focus:bg-white outline-none"
                >
                  <option value="all">همه کلاس‌های درسی</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.title} {p.grade ? `(${p.grade})` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Start Date */}
              <div>
                <ShamsiDatePicker
                  value={reportStartDate}
                  onChange={(d) => setReportStartDate(d)}
                  placeholder="از تاریخ..."
                />
              </div>

              {/* End Date */}
              <div>
                <ShamsiDatePicker
                  value={reportEndDate}
                  onChange={(d) => setReportEndDate(d)}
                  placeholder="تا تاریخ..."
                />
              </div>
            </div>
          </div>

          {/* Student Analytics Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-2">
                <Users size={16} className="text-indigo-600" />
                <span>جدول آماری وضعیت حضور و غیاب طلاب</span>
              </h3>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setReportWarningOnlyFilter(!reportWarningOnlyFilter)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer",
                    reportWarningOnlyFilter
                      ? "bg-rose-600 text-white border-rose-700 shadow-xs"
                      : "bg-white hover:bg-rose-50 text-rose-700 border-rose-200"
                  )}
                >
                  <AlertOctagon size={14} />
                  <span>فقط مشمولین اخطار آموزشی</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportReportToExcel}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <FileSpreadsheet size={14} />
                  <span>خروجی اکسل (Excel)</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                    <th className="p-3">ردیف</th>
                    <th className="p-3">نام طلبه</th>
                    <th className="p-3">پایه</th>
                    <th className="p-3 text-center">جلسات مشمول</th>
                    <th className="p-3 text-center text-emerald-800">حاضر</th>
                    <th className="p-3 text-center text-rose-700">غیبت غیرموجه</th>
                    <th className="p-3 text-center text-indigo-700">غیبت موجه</th>
                    <th className="p-3 text-center text-amber-700">تاخیر</th>
                    <th className="p-3 text-center text-rose-800">اخطار آموزشی</th>
                    <th className="p-3 text-center">عملیات و جزئیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentReportList.map((item, idx) => {
                    const isOverThreshold = item.absentCount >= (settings.unexcusedWarningThreshold || 3);
                    return (
                      <tr key={item.student.id} className={cn(
                        "transition-colors",
                        isOverThreshold ? "bg-rose-50/40 hover:bg-rose-50/70" : "hover:bg-slate-50/80"
                      )}>
                        <td className="p-3 font-mono text-slate-400 font-bold">{idx + 1}</td>
                        <td className="p-3 font-black text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span>{item.student.name}</span>
                            {isOverThreshold && (
                              <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-black rounded-md border border-rose-200">
                                مشمول اخطار
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-slate-600 font-bold">{item.student.grade || '---'}</td>
                        <td className="p-3 text-center font-mono font-bold">{item.heldSessionsEnrolled}</td>
                        <td className="p-3 text-center font-mono font-black text-emerald-700">{item.presentCount}</td>
                        <td className="p-3 text-center font-mono font-black text-rose-600">
                          {item.absentCount > 0 ? (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md">
                              {item.absentCount}
                            </span>
                          ) : '0'}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-indigo-700">{item.excusedCount}</td>
                        <td className="p-3 text-center font-mono font-bold text-amber-700">{item.lateCount}</td>
                        <td className="p-3 text-center font-mono font-black text-rose-800">
                          {item.warningCount > 0 ? (
                            <span className="px-2 py-0.5 bg-rose-600 text-white rounded-md">
                              {item.warningCount}
                            </span>
                          ) : '---'}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedStudentDrilldown(item)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-[11px] border border-indigo-200 transition-colors cursor-pointer"
                            >
                              ریز جلسات
                            </button>

                            {(isEducationManager || isSuperAdmin || isGradeSupervisor) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIssuingWarningStudent({
                                    student: item.student,
                                    absentCount: item.absentCount,
                                    programTitle: reportProgramFilter !== 'all' ? programs.find(p => p.id === reportProgramFilter)?.title : 'دروس مدرسه'
                                  });
                                  setWarningReasonInput(`اخطار آموزشی به دلیل ${item.absentCount} جلسه غیبت غیرموجه در درس.`);
                                }}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold text-[11px] border border-rose-200 transition-colors cursor-pointer flex items-center gap-1"
                                title="صدور اخطار آموزشی رسمی"
                              >
                                <AlertTriangle size={11} />
                                <span>صدور اخطار</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Modal 1: Attendance Settings Modal */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-vazir" dir="rtl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={18} className="text-indigo-600" />
                  <h3 className="text-sm font-black text-slate-900">تنظیمات حضور و غیاب</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    مهلت ثبت و ویرایش توسط نماینده کلاس (روز):
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={settings.representativeEditWindowDays}
                    onChange={(e) => setSettings({ ...settings, representativeEditWindowDays: parseInt(e.target.value) || 7 })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-mono font-bold"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    نماینده کلاس تا این تعداد روز فرصت ثبت و ویرایش دارد. پس از آن تنها مسئول آموزش مجاز خواهد بود.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    حد نصاب غیبت غیرموجه برای اخطار آموزشی (جلسه):
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={settings.unexcusedWarningThreshold || 3}
                    onChange={(e) => setSettings({ ...settings, unexcusedWarningThreshold: parseInt(e.target.value) || 3 })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-mono font-bold"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    طلابی که به این تعداد غیبت غیرموجه برسند در گزارش به عنوان مشمول اخطار آموزشی مشخص می‌شوند.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    نحوه محاسبه وضعیت «نامشخص» در آمار و گزارش‌ها:
                  </label>
                  <select
                    value={settings.unspecifiedCountAs}
                    onChange={(e) => setSettings({ ...settings, unspecifiedCountAs: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-bold"
                  >
                    <option value="unspecified">جداگانه به عنوان نامشخص درج شود</option>
                    <option value="absent">به عنوان غیبت محاسبه شود</option>
                    <option value="present">به عنوان حضور محاسبه شود</option>
                    <option value="late">به عنوان تاخیر محاسبه شود</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveSettings(settings)}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                >
                  ذخیره تنظیمات
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* Modal 2: Absence Justification Modal */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {justifyingStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-vazir" dir="rtl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>موجه‌سازی غیبت طلبه {justifyingStudent.studentName}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setJustifyingStudent(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800">علت یا مستندات موجه بودن غیبت:</label>
                <textarea
                  rows={3}
                  placeholder="مثلاً: ارائه گواهی پزشکی، مرخصی تحصیلی مصوب، هماهنگی قبلی با مسئول آموزش..."
                  value={justificationReasonInput}
                  onChange={(e) => setJustificationReasonInput(e.target.value)}
                  className="w-full p-3 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setJustifyingStudent(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleConfirmJustification}
                  className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  تایید و موجه کردن غیبت
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* Modal 3: Student History Drilldown Modal */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedStudentDrilldown && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-vazir" dir="rtl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    ریز گزارش حضور و غیاب: {selectedStudentDrilldown.student.name}
                  </h3>
                  <p className="text-[11px] text-slate-500">{selectedStudentDrilldown.student.grade || '---'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudentDrilldown(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 space-y-2">
                {selectedStudentDrilldown.history.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">رکوردی برای این طلبه یافت نشد.</p>
                ) : (
                  selectedStudentDrilldown.history.map((h: any, i: number) => (
                    <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-150 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-bold text-slate-800">{h.programTitle}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{h.date}</div>
                        {h.excuseReason && (
                          <div className="text-[10px] text-indigo-700 mt-0.5">علت موجهی: {h.excuseReason}</div>
                        )}
                        {h.note && (
                          <div className="text-[10px] text-slate-600 mt-0.5">توضیح: {h.note}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {h.isCancelled ? (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-bold rounded">کلاس لغو شد</span>
                        ) : h.status === 'present' ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">حاضر</span>
                        ) : h.status === 'absent' ? (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-black rounded">غایب</span>
                        ) : h.status === 'excused' ? (
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded">موجه</span>
                        ) : h.status === 'late' ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">تاخیر</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">نامشخص</span>
                        )}
                        {h.hasWarning && (
                          <span className="px-1.5 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded">اخطار</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedStudentDrilldown(null)}
                  className="px-4 py-1.5 text-xs bg-slate-800 text-white rounded-xl font-bold cursor-pointer"
                >
                  بستن
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* Modal 4: Issue Educational Warning Modal */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {issuingWarningStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-vazir" dir="rtl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-rose-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                    <AlertOctagon size={18} />
                  </div>
                  <h3 className="text-sm font-black text-rose-950">صدور اخطار آموزشی غیبت غیرموجه</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIssuingWarningStudent(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-2xl space-y-1">
                  <div className="font-bold text-rose-900">نام طلبه: {issuingWarningStudent.student.name}</div>
                  <div className="text-[11px] text-rose-700">
                    تعداد غیبت غیرموجه: <strong className="font-black text-rose-950 font-mono">{issuingWarningStudent.absentCount} جلسه</strong> (حد نصاب اخطار: {settings.unexcusedWarningThreshold || 3} جلسه)
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    متن و علت صدور اخطار آموزشی:
                  </label>
                  <textarea
                    rows={3}
                    value={warningReasonInput}
                    onChange={(e) => setWarningReasonInput(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white text-xs outline-none resize-none font-medium leading-relaxed"
                    placeholder="توضیحات و علت اخطار..."
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    با صدور این اخطار، یک کارتابل پیگیری آموزشی در جریان کار مدرسه ایجاد شده و به مسئول آموزش ارسال می‌گردد.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIssuingWarningStudent(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleConfirmIssueWarning}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <AlertTriangle size={14} />
                  <span>تایید و ارسال اخطار آموزشی</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* Modal 5: Substitute Teacher Selection Modal (انتخاب یا درج استاد جایگزین) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isSubstituteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-vazir" dir="rtl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-amber-200 space-y-4 max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-amber-100 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                    <UserPlus size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-amber-950">ثبت حضور استاد جایگزین</h3>
                    <p className="text-[11px] text-amber-800">
                      انتخاب از بانک اساتید یا درج دستی نام استاد جایگزین
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSubstituteModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="space-y-4 text-xs overflow-y-auto flex-1 pr-1">
                {/* Search in Teacher Bank */}
                <div className="space-y-2">
                  <label className="block font-bold text-slate-800">
                    جستجو و انتخاب از بانک اساتید:
                  </label>
                  <div className="relative">
                    <Search className="absolute right-3 top-2.5 text-slate-400" size={14} />
                    <input
                      type="text"
                      placeholder="نام استاد، کد، یا تخصص..."
                      value={substituteTeacherSearch}
                      onChange={(e) => setSubstituteTeacherSearch(e.target.value)}
                      className="w-full pr-8 pl-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white text-xs outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {/* Teachers list */}
                  <div className="border border-slate-200 rounded-xl p-2 max-h-40 overflow-y-auto space-y-1.5 bg-slate-50/50">
                    {teachers.filter(t => {
                      if (!substituteTeacherSearch.trim()) return true;
                      const q = substituteTeacherSearch.toLowerCase();
                      return (
                        t.fullName?.toLowerCase().includes(q) ||
                        t.subjectSpecialty?.toLowerCase().includes(q) ||
                        t.teacherCode?.toLowerCase().includes(q) ||
                        t.phone?.includes(q)
                      );
                    }).length === 0 ? (
                      <p className="text-[11px] text-slate-400 text-center py-3">
                        استادی با این مشخصات در بانک اساتید یافت نشد. می‌توانید از کادر زیر نام استاد را دستی وارد کنید.
                      </p>
                    ) : (
                      teachers
                        .filter(t => {
                          if (!substituteTeacherSearch.trim()) return true;
                          const q = substituteTeacherSearch.toLowerCase();
                          return (
                            t.fullName?.toLowerCase().includes(q) ||
                            t.subjectSpecialty?.toLowerCase().includes(q) ||
                            t.teacherCode?.toLowerCase().includes(q) ||
                            t.phone?.includes(q)
                          );
                        })
                        .map(t => {
                          const isSelected = selectedTeacherFromList?.id === t.id || (substituteTeacherId === t.id && !selectedTeacherFromList && !manualSubstituteName);
                          return (
                            <div
                              key={t.id}
                              onClick={() => {
                                setSelectedTeacherFromList(t);
                                setManualSubstituteName('');
                              }}
                              className={cn(
                                "p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-all text-xs",
                                isSelected 
                                  ? "bg-amber-100/80 border-amber-300 text-amber-950 font-bold shadow-2xs" 
                                  : "bg-white border-slate-200 hover:bg-slate-100 text-slate-700"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <User size={14} className={isSelected ? "text-amber-700" : "text-slate-400"} />
                                <div>
                                  <div className="font-bold">{t.fullName}</div>
                                  {t.subjectSpecialty && (
                                    <div className="text-[10px] text-slate-400">{t.subjectSpecialty}</div>
                                  )}
                                </div>
                              </div>
                              {isSelected && (
                                <Check size={14} className="text-amber-700 font-black shrink-0" />
                              )}
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* Manual entry fallback */}
                <div className="pt-2 border-t border-slate-150 space-y-2">
                  <label className="block font-bold text-slate-800">
                    یا درج دستی نام استاد (در صورتی که در بانک اساتید نباشد):
                  </label>
                  <input
                    type="text"
                    placeholder="مثلاً: حجت‌الاسلام والمسلمین حسینی..."
                    value={manualSubstituteName}
                    onChange={(e) => {
                      setManualSubstituteName(e.target.value);
                      if (e.target.value) {
                        setSelectedTeacherFromList(null);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white text-xs outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="block font-bold text-slate-800">
                    توضیحات و علت جایگزینی (اختیاری):
                  </label>
                  <input
                    type="text"
                    placeholder="مثلاً: به جای استاد اصلی به دلیل کسالت..."
                    value={manualSubstituteNotes}
                    onChange={(e) => setManualSubstituteNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white text-xs outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Information banner */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                  <p className="font-bold flex items-center gap-1 mb-0.5">
                    <Info size={13} className="text-amber-700" />
                    <span>محاسبه حق‌الزحمه:</span>
                  </p>
                  با ثبت استاد جایگزین، حق‌الزحمه تدریس این جلسه برای استاد حاضر ثبت و محاسبه خواهد شد.
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 shrink-0">
                {hasSubstituteTeacher && (
                  <button
                    type="button"
                    onClick={() => {
                      setHasSubstituteTeacher(false);
                      setSubstituteTeacherId(undefined);
                      setSubstituteTeacherName('');
                      setSubstituteTeacherNotes('');
                      setSelectedTeacherFromList(null);
                      setManualSubstituteName('');
                      setManualSubstituteNotes('');
                      setIsSubstituteModalOpen(false);
                      showToast("وضعیت استاد جایگزین لغو گردید.");
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 cursor-pointer"
                  >
                    حذف استاد جایگزین
                  </button>
                )}
                
                <div className="flex items-center gap-2 mr-auto">
                  <button
                    type="button"
                    onClick={() => setIsSubstituteModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const finalName = selectedTeacherFromList?.fullName || manualSubstituteName.trim();
                      if (!finalName && !hasSubstituteTeacher) {
                        alert("لطفاً یک استاد از لیست انتخاب کنید یا نام استاد را دستی وارد فرمایید.");
                        return;
                      }

                      setHasSubstituteTeacher(true);
                      setSubstituteTeacherId(selectedTeacherFromList?.id || undefined);
                      setSubstituteTeacherName(finalName || 'استاد جایگزین');
                      setSubstituteTeacherNotes(manualSubstituteNotes);
                      setIsSubstituteModalOpen(false);
                      showToast(`استاد جایگزین (${finalName}) برای این جلسه تعیین شد.`);
                    }}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Check size={14} />
                    <span>ثبت و تایید استاد جایگزین</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
