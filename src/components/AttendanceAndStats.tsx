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
  User,
  LayoutGrid,
  Layers,
  Building2,
  Copy,
  Phone,
  PhoneCall
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn, getProgramDays, matchesGradeFilter } from '../lib/utils';
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
  Teacher,
  Program
} from '../types';

export type AttendanceRecord = AttendanceSessionLog;
export type StudentAttendanceItem = StudentAttendanceDetail;

interface AttendanceAndStatsProps {
  initialStudentId?: string;
}

export default function AttendanceAndStats({ initialStudentId }: AttendanceAndStatsProps = {}) {
  const { currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'record' | 'report' | 'class_status' | 'representatives_list'>(() => {
    if (currentUser?.role === 'class_representative' || currentUser?.roleTitle?.includes('نماینده') || (currentUser as any)?.managedClassId) {
      return 'record';
    }
    if (currentUser?.level === 3 || currentUser?.role === 'student') {
      return 'report';
    }
    return 'class_status';
  });

  // Class Status Overview filters
  const [classStatusGradeFilter, setClassStatusGradeFilter] = useState<string>('all');
  const [classStatusSearchQuery, setClassStatusSearchQuery] = useState<string>('');
  const [classStatusCategoryTab, setClassStatusCategoryTab] = useState<'all' | 'academic' | 'counseling'>('all');
  const [classStatusColorFilter, setClassStatusColorFilter] = useState<'all' | 'pending' | 'recorded' | 'substitute' | 'cancelled'>('all');

  // Quick Class Status Card Change Modal
  const [quickStatusModal, setQuickStatusModal] = useState<{ prog: any; initialMode?: string } | null>(null);
  const [quickCancelReason, setQuickCancelReason] = useState<string>('تعطیلی با هماهنگی آموزش');
  const [quickSubTeacherName, setQuickSubTeacherName] = useState<string>('');
  const [quickSubNotes, setQuickSubNotes] = useState<string>('');
  const [quickIsSubmitting, setQuickIsSubmitting] = useState(false);

  // Representatives tab state
  const [repSearchQuery, setRepSearchQuery] = useState<string>('');
  const [repNotesMap, setRepNotesMap] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<any[]>([]);

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
  const [reportShowAllStudents, setReportShowAllStudents] = useState<boolean>(false); // default false: show absents only!
  const [reportSortBy, setReportSortBy] = useState<'absent' | 'class'>('absent');
  const [reportCourseCategory, setReportCourseCategory] = useState<'all' | 'academic' | 'counseling' | 'thursday'>('all');
  const [reportViewMode, setReportViewMode] = useState<'student' | 'class' | 'summary'>('student');
  const [selectedStudentDrilldown, setSelectedStudentDrilldown] = useState<any | null>(null);

  // Check roles
  const isSuperAdmin = currentUser?.level === 1 && currentUser?.role === 'super_admin';
  const isEducationManager = 
    currentUser?.role === 'education_manager' || 
    currentUser?.role === 'education_officer' || 
    currentUser?.username?.toUpperCase() === 'SHAH';
  const isGradeSupervisor = 
    !isSuperAdmin &&
    !isEducationManager &&
    (currentUser?.role === 'grade_mentor' || 
    currentUser?.role === 'grade_supervisor' || 
    currentUser?.role?.startsWith('grade_supervisor_') ||
    currentUser?.roleTitle?.includes('استاد پایه') ||
    currentUser?.roleTitle?.includes('مسئول پایه') ||
    ['ISJ', 'HO', 'SOL', 'ASADI'].includes(currentUser?.username?.toUpperCase() || ''));

  // Toast helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Load all initial data from localDb
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [progs, studs, teaList, enrolls, atts, settList, hols, periods, userList, notesList] = await Promise.all([
        localDb.getDocs('programs'),
        localDb.getDocs('students'),
        localDb.getDocs<Teacher>('teachers'),
        localDb.getDocs('enrollments'),
        localDb.getDocs<AttendanceSessionLog>('attendance'),
        localDb.getDocs<AttendanceSettings>('attendance_settings'),
        localDb.getDocs<AcademicHolidayItem>('academic_holidays'),
        localDb.getDocs<AcademicCalendarPeriod>('academic_calendar_periods'),
        localDb.getDocs('users'),
        localDb.getDocs('representative_notes')
      ]);
      setPrograms(progs || []);
      setStudents(studs || []);
      setTeachers(teaList || []);
      setEnrollments(enrolls || []);
      setAttendanceRecords(atts || []);
      setAcademicHolidays(hols || []);
      setAcademicPeriods(periods || []);
      setUsers(userList || []);

      const notesMap: Record<string, string> = {};
      if (Array.isArray(notesList)) {
        notesList.forEach((n: any) => {
          if (n.repId) notesMap[n.repId] = n.noteText || n.note || '';
        });
      }
      setRepNotesMap(notesMap);

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

  // Check which programs the current user is a representative of (immediate recognition)
  const representativePrograms = useMemo(() => {
    if (!currentUser) return [];
    
    // Admins or Education Managers or Grade Supervisors have broader access
    if (isSuperAdmin || isEducationManager || isGradeSupervisor) {
      if (isGradeSupervisor && currentUser.gradeLabel) {
        return programs.filter(p => !p.grade || p.grade === currentUser.gradeLabel || p.grade === 'همه پایه‌ها');
      }
      return programs;
    }

    // 0. Direct Link via managedClassId or representativeProgramIds
    if ((currentUser as any).managedClassId) {
      const direct = programs.filter(p => p.id === (currentUser as any).managedClassId);
      if (direct.length > 0) return direct;
    }
    if (Array.isArray((currentUser as any).representativeProgramIds) && (currentUser as any).representativeProgramIds.length > 0) {
      const directList = programs.filter(p => (currentUser as any).representativeProgramIds.includes(p.id));
      if (directList.length > 0) return directList;
    }

    const cleanStr = (raw?: string) => {
      if (!raw) return '';
      return raw
        .replace(/\(.*?\)/g, '')
        .replace(/^(طلبه|دانش‌پژوه|سید|آقای|استاد|حجت\s*الاسلام)\s+/gi, '')
        .trim()
        .toLowerCase();
    };

    const currentUserName = (currentUser.name || '').trim().toLowerCase();
    const currentStudentName = (currentUser.studentName || '').trim().toLowerCase();
    const currentCleanName = cleanStr(currentUser.name || currentUser.fullName || currentUser.studentName || '');
    const currentStudentId = currentUser.studentId || currentUser.linkedStudentId || '';
    const currentUserId = currentUser.id || '';
    const currentUsername = (currentUser.username || '').trim().toLowerCase();

    // Match student from students list
    const matchedStudent = students.find(s => {
      if (currentStudentId && s.id === currentStudentId) return true;
      if (currentUserId && s.id === currentUserId) return true;
      if (s.nationalId && (s.nationalId.toLowerCase() === currentUsername || s.nationalId.toLowerCase() === currentStudentId.toLowerCase())) return true;
      if (s.studentCode && (s.studentCode.toLowerCase() === currentUsername || s.studentCode.toLowerCase() === currentStudentId.toLowerCase())) return true;
      const sClean = cleanStr(s.name);
      if (sClean && currentCleanName && (sClean === currentCleanName || sClean.includes(currentCleanName) || currentCleanName.includes(sClean))) return true;
      return false;
    });

    const candidateIds = [
      currentStudentId,
      currentUserId,
      matchedStudent?.id,
      matchedStudent?.studentCode,
      matchedStudent?.nationalId,
      (currentUser as any).uid
    ].filter(Boolean) as string[];

    const candidateNames = [
      currentUserName,
      currentStudentName,
      currentCleanName,
      cleanStr(matchedStudent?.name),
      matchedStudent?.name?.trim().toLowerCase()
    ].filter(Boolean) as string[];

    const managedClassId = (currentUser as any)?.managedClassId;
    const repProgramIds = Array.isArray((currentUser as any)?.representativeProgramIds) 
      ? (currentUser as any).representativeProgramIds 
      : [];

    const matchedProgs = programs.filter(p => {
      // 0. Direct match with managedClassId or representativeProgramIds from user profile
      if (managedClassId && p.id === managedClassId) return true;
      if (repProgramIds.includes(p.id)) return true;

      // 1. Direct ID match in representativeStudentIds
      if (Array.isArray(p.representativeStudentIds) && p.representativeStudentIds.length > 0) {
        if (p.representativeStudentIds.some(id => candidateIds.includes(id))) {
          return true;
        }
      }
      // 2. Name match in representativeNames
      if (Array.isArray(p.representativeNames) && p.representativeNames.length > 0) {
        const hasNameMatch = p.representativeNames.some((repName: string) => {
          const norm = repName.trim().toLowerCase();
          const clean = cleanStr(repName);
          return candidateNames.some(c => c && (norm.includes(c) || c.includes(norm) || (clean && (clean === c || clean.includes(c) || c.includes(clean)))));
        });
        if (hasNameMatch) return true;
      }
      // 3. Custom representative string match
      if (p.customRepresentative) {
        const norm = p.customRepresentative.trim().toLowerCase();
        const clean = cleanStr(p.customRepresentative);
        if (candidateNames.some(c => c && (norm.includes(c) || c.includes(norm) || (clean && clean.includes(c))))) {
          return true;
        }
      }
      return false;
    });

    if (matchedProgs.length > 0) {
      return matchedProgs;
    }

    // If user's role is class_representative or title contains نماینده, but program hasn't stored ID yet,
    // link strictly through enrolled classes of this student (NEVER return all classes of the grade)
    if (currentUser.role === 'class_representative' || currentUser.roleTitle?.includes('نماینده')) {
      const studentId = matchedStudent?.id || currentStudentId || currentUserId;
      if (studentId) {
        const enrolled = programs.filter(p => {
          const inEnroll = enrollments.some(e => e.programId === p.id && e.studentId === studentId);
          const inArray = Array.isArray(p.studentIds) && p.studentIds.includes(studentId);
          return inEnroll || inArray;
        });
        if (enrolled.length > 0) return enrolled;
      }
    }

    return [];
  }, [currentUser, programs, students, enrollments, isSuperAdmin, isEducationManager, isGradeSupervisor]);

  // Determine if the user is a class representative vs ordinary student
  const isRepresentative = !isSuperAdmin && !isEducationManager && !isGradeSupervisor && (
    currentUser?.role === 'class_representative' || 
    currentUser?.roleTitle?.includes('نماینده') || 
    Boolean((currentUser as any)?.managedClassId) ||
    representativePrograms.length > 0
  );

  const isOrdinaryStudent = !isSuperAdmin && !isEducationManager && !isGradeSupervisor && !isRepresentative && (
    currentUser?.role === 'student' || currentUser?.level === 3 || !currentUser
  );

  // Self-reporting programs for ordinary student
  const studentSelfReportingPrograms = useMemo(() => {
    if (!isOrdinaryStudent) return [];
    
    const loggedSid = currentUser?.studentId || currentUser?.linkedStudentId || currentUser?.id;
    const loggedUsername = currentUser?.username;
    
    return programs.filter(p => {
      if (p.attendanceType !== 'self_reporting') return false;
      const inEnroll = enrollments.some(e => String(e.programId) === String(p.id) && (
        String(e.studentId) === String(loggedSid) ||
        String(e.studentId) === String(loggedUsername)
      ));
      const inArray = Array.isArray(p.studentIds) && (
        p.studentIds.includes(String(loggedSid)) ||
        p.studentIds.includes(String(loggedUsername))
      );
      const stObj = students.find(s => String(s.id) === String(loggedSid) || s.nationalId === loggedUsername);
      const matchesGrade = Boolean(stObj?.grade && p.grade && String(stObj.grade).trim() === String(p.grade).trim());

      return inEnroll || inArray || matchesGrade;
    });
  }, [isOrdinaryStudent, currentUser, programs, enrollments, students]);

  const canManageSettings = isSuperAdmin || isEducationManager || (isGradeSupervisor && settings.allowGradeProfessorSettingsEdit);
  const isSettingsReadOnly = isGradeSupervisor && !settings.allowGradeProfessorSettingsEdit;
  const isAttendanceReadOnlyForGradeSupervisor = isGradeSupervisor && !settings.allowGradeProfessorAttendanceEdit;

  // Enforce tab access:
  // - Ordinary students default to 'report', but if they have self-reporting programs, they can also access 'record' for self-reporting
  // - Representatives MUST default directly to 'record' tab to immediately record attendance
  useEffect(() => {
    if (isRepresentative) {
      if (activeTab === 'class_status') {
        setActiveTab('record');
      }
    } else if (isOrdinaryStudent) {
      if (activeTab !== 'report' && activeTab !== 'record') {
        setActiveTab('report');
      }
    }
  }, [isOrdinaryStudent, isRepresentative, activeTab]);

  // When representative programs are loaded or user is recognized as representative,
  // immediately ensure they land on 'record' tab to record attendance directly!
  useEffect(() => {
    if (isRepresentative && representativePrograms.length > 0) {
      if (activeTab !== 'record') {
        setActiveTab('record');
      }
    }
  }, [isRepresentative, representativePrograms.length]);

  // Set default selected program strictly constrained to represented classes for class representatives
  useEffect(() => {
    if (isRepresentative) {
      if (representativePrograms.length > 0) {
        if (!selectedProgramId || !representativePrograms.some(p => p.id === selectedProgramId)) {
          setSelectedProgramId(representativePrograms[0].id);
        }
      } else {
        setSelectedProgramId('');
      }
      return;
    }

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

    if (!selectedProgramId && programs.length > 0) {
      setSelectedProgramId(programs[0].id);
    }
  }, [isRepresentative, representativePrograms, programs, selectedProgramId, initialStudentId, enrollments]);

  // Get active selected program - strictly limited to represented classes for representatives
  const currentProgram = useMemo(() => {
    if (isRepresentative) {
      return representativePrograms.find(p => p.id === selectedProgramId) || null;
    }
    return programs.find(p => p.id === selectedProgramId) || null;
  }, [programs, representativePrograms, selectedProgramId, isRepresentative]);

  // Get students enrolled in current program - ensures ALL members of the class are visible to the representative, BUT ordinary students ONLY see themselves
  const enrolledStudents = useMemo(() => {
    if (!selectedProgramId) return [];

    // If ordinary student, strictly return ONLY that logged-in student (cannot see other students or other classes)
    if (isOrdinaryStudent) {
      const loggedSid = currentUser?.studentId || currentUser?.linkedStudentId || currentUser?.id;
      const loggedUsername = currentUser?.username;
      
      const selfStudent = students.find(s => 
        String(s.id) === String(loggedSid) || 
        s.nationalId === loggedUsername || 
        s.studentCode === loggedUsername ||
        s.name === currentUser?.fullName ||
        s.name === currentUser?.name
      ) || {
        id: loggedSid || 'self-student',
        name: currentUser?.fullName || currentUser?.name || 'طلبه محترم',
        nationalId: loggedUsername || '',
        grade: currentProgram?.grade || 'عمومی'
      };

      return [selfStudent];
    }

    if (isRepresentative && !representativePrograms.some(p => p.id === selectedProgramId)) {
      return [];
    }

    const studentIdSet = new Set<string>();

    enrollments.forEach(e => {
      const pId = String(e.programId || e.program_id || '').trim();
      if (pId === String(selectedProgramId).trim()) {
        const sid = String(e.studentId || e.student_id || '').trim();
        if (sid) studentIdSet.add(sid);
      }
    });

    if (currentProgram && Array.isArray(currentProgram.studentIds)) {
      currentProgram.studentIds.forEach((sid: any) => {
        if (sid) studentIdSet.add(String(sid).trim());
      });
    }

    // Also include representative themselves if assigned in representativeStudentIds
    if (currentProgram && Array.isArray(currentProgram.representativeStudentIds)) {
      currentProgram.representativeStudentIds.forEach((sid: any) => {
        if (sid) studentIdSet.add(String(sid).trim());
      });
    }

    const matchedStudentsMap = new Map<string, any>();

    students.forEach(s => {
      const sId = String(s.id || '').trim();
      const sCode = String(s.studentCode || '').trim();
      const sNat = String(s.nationalId || s.nationalCode || '').trim();

      let isMatch = studentIdSet.has(sId) || (sCode && studentIdSet.has(sCode)) || (sNat && studentIdSet.has(sNat));
      if (!isMatch) {
        const sIdLower = sId.toLowerCase();
        for (const targetId of studentIdSet) {
          const tLower = targetId.toLowerCase();
          if (tLower === sIdLower || (sCode && tLower === sCode.toLowerCase()) || (sNat && tLower === sNat.toLowerCase())) {
            isMatch = true;
            break;
          }
        }
      }

      if (isMatch) {
        matchedStudentsMap.set(sId || sCode || sNat, s);
      }
    });

    // If an enrolled student ID is in studentIdSet but not yet populated in students list, ensure an entry exists
    studentIdSet.forEach(sid => {
      const alreadyMatched = Array.from(matchedStudentsMap.values()).some(s => 
        String(s.id).toLowerCase() === sid.toLowerCase() || 
        String(s.studentCode || '').toLowerCase() === sid.toLowerCase() || 
        String(s.nationalId || '').toLowerCase() === sid.toLowerCase()
      );
      if (!alreadyMatched) {
        const enr = enrollments.find(e => String(e.studentId) === sid && String(e.programId) === String(selectedProgramId));
        const placeholderName = enr?.studentName || enr?.name || `طلبه (${sid})`;
        matchedStudentsMap.set(sid, {
          id: sid,
          name: placeholderName,
          grade: currentProgram?.grade || 'پایه ۷',
          studentCode: sid
        });
      }
    });

    let result = Array.from(matchedStudentsMap.values());

    // Fallback: If no explicit enrollments were recorded in this program yet, match by grade
    if (result.length === 0 && currentProgram?.grade && currentProgram.grade !== 'همه پایه‌ها') {
      result = students.filter(s => String(s.grade || '').trim() === String(currentProgram.grade).trim());
    }

    return result.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fa'));
  }, [selectedProgramId, enrollments, currentProgram, students, isRepresentative, representativePrograms]);

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
    if (isDateLockedForRepresentative || isAttendanceReadOnlyForGradeSupervisor) return;
    const updated: Record<string, AttendanceStatus> = {};
    enrolledStudents.forEach(s => {
      updated[s.id] = status;
    });
    setStudentsAttendance(updated);
  };

  const handleSetStudentStatus = (studentId: string, status: AttendanceStatus) => {
    if (isDateLockedForRepresentative || isAttendanceReadOnlyForGradeSupervisor) return;
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
    if (isAttendanceReadOnlyForGradeSupervisor) {
      alert("ثبت و ویرایش حضور و غیاب توسط مسئول محترم آموزش برای اساتید پایه غیرفعال شده است (حالت فقط مشاهده).");
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

      // In representative mode, only notify the user without returning or resetting selection
      if (isRepresentative) {
        showToast("ثبت نهایی و ثبت در دیتابیس با موفقیت انجام شد.");
      }
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

  // Quick status handlers for Class Status Cards
  const handleQuickMarkCancelled = async (prog: any, reason: string) => {
    setQuickIsSubmitting(true);
    try {
      const recordId = `${prog.id}_${selectedDate.replace(/\//g, '-')}`;
      const existing = attendanceRecords.find(r => r.id === recordId);
      const updatedRecord: AttendanceSessionLog = {
        ...(existing || {}),
        id: recordId,
        programId: prog.id,
        programTitle: prog.title,
        grade: prog.grade || '',
        date: selectedDate,
        dayOfWeek: dayOfWeekName,
        isCancelled: true,
        cancellationReason: reason?.trim() || 'عدم تشکیل جلسه با هماهنگی آموزش',
        hasSubstituteTeacher: false,
        substituteTeacherName: undefined,
        substituteTeacherNotes: undefined,
        recordedByUserId: currentUser?.id,
        recordedByName: currentUser?.fullName || currentUser?.name || currentUser?.username || 'مسئول آموزش',
        recordedAt: new Date().toISOString(),
        students: existing?.students || []
      };
      await localDb.setDoc('attendance', updatedRecord);
      setAttendanceRecords(prev => [updatedRecord, ...prev.filter(r => r.id !== recordId)]);
      showToast(`وضعیت کلاس «${prog.title}» به تعطیل (کرمی) تغییر یافت.`);
      setQuickStatusModal(null);
    } catch (err) {
      console.error(err);
      alert('خطا در تغییر وضعیت کلاس.');
    } finally {
      setQuickIsSubmitting(false);
    }
  };

  const handleQuickMarkAllPresent = async (prog: any) => {
    setQuickIsSubmitting(true);
    try {
      const recordId = `${prog.id}_${selectedDate.replace(/\//g, '-')}`;
      const existing = attendanceRecords.find(r => r.id === recordId);
      
      const pEnrolls = enrollments.filter(e => String(e.programId) === String(prog.id));
      const sidSet = new Set<string>();
      pEnrolls.forEach(e => sidSet.add(String(e.studentId)));
      if (Array.isArray(prog.studentIds)) prog.studentIds.forEach((s: any) => sidSet.add(String(s)));
      
      let targetStuds = students.filter(s => sidSet.has(String(s.id)));
      if (targetStuds.length === 0 && prog.grade) {
        targetStuds = students.filter(s => s.grade === prog.grade);
      }

      const studentItems: StudentAttendanceDetail[] = targetStuds.map(s => ({
        studentId: s.id,
        studentName: s.name,
        nationalId: s.nationalId || '',
        status: 'present',
        note: ''
      }));

      const updatedRecord: AttendanceSessionLog = {
        ...(existing || {}),
        id: recordId,
        programId: prog.id,
        programTitle: prog.title,
        grade: prog.grade || '',
        date: selectedDate,
        dayOfWeek: dayOfWeekName,
        isCancelled: false,
        cancellationReason: '',
        hasSubstituteTeacher: false,
        recordedByUserId: currentUser?.id,
        recordedByName: currentUser?.fullName || currentUser?.name || currentUser?.username || 'مسئول آموزش',
        recordedAt: new Date().toISOString(),
        students: studentItems
      };
      await localDb.setDoc('attendance', updatedRecord);
      setAttendanceRecords(prev => [updatedRecord, ...prev.filter(r => r.id !== recordId)]);
      showToast(`حضور تمام طلاب در کلاس «${prog.title}» ثبت شد (سبز).`);
      setQuickStatusModal(null);
    } catch (err) {
      console.error(err);
      alert('خطا در ثبت حضور.');
    } finally {
      setQuickIsSubmitting(false);
    }
  };

  const handleQuickMarkSubstitute = async (prog: any, subName: string, subNotes: string) => {
    if (!subName.trim()) {
      alert('لطفاً نام استاد جایگزین را وارد نمایید.');
      return;
    }
    setQuickIsSubmitting(true);
    try {
      const recordId = `${prog.id}_${selectedDate.replace(/\//g, '-')}`;
      const existing = attendanceRecords.find(r => r.id === recordId);
      const updatedRecord: AttendanceSessionLog = {
        ...(existing || {}),
        id: recordId,
        programId: prog.id,
        programTitle: prog.title,
        grade: prog.grade || '',
        date: selectedDate,
        dayOfWeek: dayOfWeekName,
        isCancelled: false,
        cancellationReason: '',
        hasSubstituteTeacher: true,
        substituteTeacherName: subName.trim(),
        substituteTeacherNotes: subNotes.trim() || undefined,
        recordedByUserId: currentUser?.id,
        recordedByName: currentUser?.fullName || currentUser?.name || currentUser?.username || 'مسئول آموزش',
        recordedAt: new Date().toISOString(),
        students: existing?.students || []
      };
      await localDb.setDoc('attendance', updatedRecord);
      setAttendanceRecords(prev => [updatedRecord, ...prev.filter(r => r.id !== recordId)]);
      showToast(`استاد جایگزین برای کلاس «${prog.title}» با موفقیت ثبت شد (آبی).`);
      setQuickStatusModal(null);
    } catch (err) {
      console.error(err);
      alert('خطا در ثبت استاد جایگزین.');
    } finally {
      setQuickIsSubmitting(false);
    }
  };

  const handleQuickResetStatus = async (prog: any) => {
    setQuickIsSubmitting(true);
    try {
      const recordId = `${prog.id}_${selectedDate.replace(/\//g, '-')}`;
      await localDb.deleteDoc('attendance', recordId);
      setAttendanceRecords(prev => prev.filter(r => r.id !== recordId));
      showToast(`وضعیت کلاس «${prog.title}» بازنشانی شد و به حالت ثبت‌نشده (قرمز) برگشت.`);
      setQuickStatusModal(null);
    } catch (err) {
      console.error(err);
      alert('خطا در بازنشانی وضعیت کلاس.');
    } finally {
      setQuickIsSubmitting(false);
    }
  };

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

      // Course category filter: academic (دروس اصلی), counseling (دروس مشاوره), thursday (جلسات پنج‌شنبه)
      if (reportCourseCategory !== 'all') {
        const prog = programs.find(p => p.id === r.programId);
        const isCounseling = prog?.isCounseling || prog?.category === 'counseling' || prog?.type === 'counseling' || r.programTitle?.includes('مشاوره') || r.grade?.includes('مشاوره');
        const isThursday = r.dayOfWeek === 'پنج‌شنبه' || r.date?.includes('پنج‌شنبه') || (prog?.daysOfWeek && prog.daysOfWeek.includes('پنج‌شنبه'));

        if (reportCourseCategory === 'counseling' && !isCounseling) return false;
        if (reportCourseCategory === 'thursday' && !isThursday) return false;
        if (reportCourseCategory === 'academic' && (isCounseling || isThursday)) return false;
      }

      return true;
    });
  }, [attendanceRecords, reportGradeFilter, reportProgramFilter, reportStartDate, reportEndDate, reportCourseCategory, programs]);

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
    const isLevel3OrStudentOrRep = currentUser?.level === 3 || isOrdinaryStudent || isRepresentative;
    
    const currentStudentId = currentUser?.studentId || currentUser?.linkedStudentId || '';
    const currentStudentObj = students.find(s => 
      (currentStudentId && String(s.id) === String(currentStudentId)) ||
      (s.name && (s.name.trim() === currentUser?.name?.trim() || s.name.trim() === currentUser?.studentName?.trim())) ||
      (s.nationalId && currentUser?.username && s.nationalId.trim() === currentUser.username.trim())
    );

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
      // STRICT PRIVACY RULE: Regular students AND class representatives ONLY see THEIR OWN report!
      if (isLevel3OrStudentOrRep) {
        if (currentStudentObj) {
          if (String(s.id) !== String(currentStudentObj.id)) return;
        } else {
          // If student profile not matched yet, match by name or username
          const nameMatch = s.name && currentUser?.name && s.name.trim() === currentUser.name.trim();
          const natMatch = s.nationalId && currentUser?.username && s.nationalId.trim() === currentUser.username.trim();
          if (!nameMatch && !natMatch) return;
        }
      }

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

    // Compute program title summary and course breakdown for each student
    Object.values(studentMap).forEach(entry => {
      const courseMap: Record<string, { absent: number; excused: number; late: number; present: number }> = {};
      entry.history.forEach(h => {
        if (h.isCancelled) return;
        const pTitle = h.programTitle || 'درس عمومی';
        if (!courseMap[pTitle]) {
          courseMap[pTitle] = { absent: 0, excused: 0, late: 0, present: 0 };
        }
        if (h.status === 'absent') courseMap[pTitle].absent++;
        else if (h.status === 'excused') courseMap[pTitle].excused++;
        else if (h.status === 'late') courseMap[pTitle].late++;
        else if (h.status === 'present') courseMap[pTitle].present++;
      });

      (entry as any).courseBreakdown = courseMap;

      // Summary string e.g. "اصول: ۲ غیبت | فقه: ۱ غیبت"
      const parts: string[] = [];
      Object.entries(courseMap).forEach(([pTitle, counts]) => {
        if (counts.absent > 0 || counts.excused > 0) {
          parts.push(`${pTitle}: ${counts.absent} غیبت${counts.excused > 0 ? ` (+${counts.excused} موجه)` : ''}`);
        }
      });
      (entry as any).compactCourseSummary = parts.length > 0 ? parts.join(' | ') : 'بدون غیبت در دروس';

      const titles = Array.from(new Set(entry.history.map(h => h.programTitle).filter(Boolean)));
      if (titles.length > 0) {
        (entry as any).programTitleSummary = titles.join('، ');
      } else {
        const stProg = programs.find(p => Array.isArray((p as any).studentIds) && (p as any).studentIds.includes(entry.student.id));
        (entry as any).programTitleSummary = stProg?.title || entry.student.grade || 'کلاس عمومی';
      }
    });

    let list = Object.values(studentMap);

    // Default filter: show ONLY students who have absences ( غایبین ), unless reportShowAllStudents is true or user is viewing single student
    if (!reportShowAllStudents && !isOrdinaryStudent && list.length > 1) {
      list = list.filter(item => item.absentCount > 0 || item.excusedCount > 0);
    }

    if (reportWarningOnlyFilter) {
      const threshold = settings.unexcusedWarningThreshold || 3;
      list = list.filter(item => item.absentCount >= threshold || item.warningCount > 0);
    }

    if (reportSortBy === 'class') {
      list.sort((a, b) => {
        const titleA = (a as any).programTitleSummary || '';
        const titleB = (b as any).programTitleSummary || '';
        const comp = titleA.localeCompare(titleB, 'fa');
        if (comp !== 0) return comp;
        return b.absentCount - a.absentCount || a.student.name.localeCompare(b.student.name, 'fa');
      });
    } else {
      list.sort((a, b) => b.absentCount - a.absentCount || a.student.name.localeCompare(b.student.name, 'fa'));
    }

    return list;
  }, [students, filteredReportRecords, reportGradeFilter, reportSearchQuery, reportWarningOnlyFilter, reportShowAllStudents, reportSortBy, settings, programs]);

  // Grouped by Class Report Data (for reportViewMode === 'class')
  const classGroupedReportList = useMemo(() => {
    const classMap: Record<string, {
      programId: string;
      programTitle: string;
      teacherName: string;
      grade: string;
      studentsMap: Record<string, {
        student: any;
        absentCount: number;
        excusedCount: number;
        lateCount: number;
        presentCount: number;
        warningCount: number;
        history: any[];
      }>;
    }> = {};

    filteredReportRecords.forEach(rec => {
      if (rec.isCancelled) return;
      const progKey = rec.programId || rec.programTitle || 'عمومی';
      if (!classMap[progKey]) {
        const matchingProg = programs.find(p => p.id === rec.programId);
        classMap[progKey] = {
          programId: rec.programId,
          programTitle: rec.programTitle || 'کلاس درسی',
          teacherName: matchingProg?.teacher || matchingProg?.teacherName || (rec as any).teacherName || 'استاد محترم',
          grade: rec.grade || matchingProg?.grade || 'عمومی',
          studentsMap: {}
        };
      }

      const cEntry = classMap[progKey];
      if (Array.isArray(rec.students)) {
        rec.students.forEach(stItem => {
          const stObj = students.find(s => String(s.id) === String(stItem.studentId)) || {
            id: stItem.studentId,
            name: stItem.studentName,
            nationalId: stItem.nationalId,
            grade: rec.grade
          };

          if (reportGradeFilter !== 'all' && stObj.grade !== reportGradeFilter) return;
          if (reportSearchQuery && !stObj.name?.toLowerCase().includes(reportSearchQuery.toLowerCase()) && !stObj.nationalId?.includes(reportSearchQuery)) return;

          if (!cEntry.studentsMap[stItem.studentId]) {
            cEntry.studentsMap[stItem.studentId] = {
              student: stObj,
              absentCount: 0,
              excusedCount: 0,
              lateCount: 0,
              presentCount: 0,
              warningCount: 0,
              history: []
            };
          }

          const stMapEntry = cEntry.studentsMap[stItem.studentId];
          if (stItem.status === 'absent') stMapEntry.absentCount++;
          else if (stItem.status === 'excused') stMapEntry.excusedCount++;
          else if (stItem.status === 'late') stMapEntry.lateCount++;
          else if (stItem.status === 'present') stMapEntry.presentCount++;

          if (stItem.hasEducationalWarning) stMapEntry.warningCount++;

          stMapEntry.history.push({
            date: rec.date,
            status: stItem.status,
            note: stItem.note,
            excuseReason: stItem.excuseReason
          });
        });
      }
    });

    return Object.values(classMap).map(cGroup => {
      let stList = Object.values(cGroup.studentsMap);
      if (!reportShowAllStudents) {
        stList = stList.filter(s => s.absentCount > 0 || s.excusedCount > 0);
      }
      stList.sort((a, b) => b.absentCount - a.absentCount || a.student.name.localeCompare(b.student.name, 'fa'));
      return {
        ...cGroup,
        studentsList: stList
      };
    }).filter(cGroup => cGroup.studentsList.length > 0);
  }, [filteredReportRecords, programs, students, reportGradeFilter, reportSearchQuery, reportShowAllStudents]);

  // Aggregated Representatives List for Education Manager (اصلاح 8)
  const representativesList = useMemo(() => {
    const repMap = new Map<string, {
      id: string;
      name: string;
      studentCode?: string;
      nationalId?: string;
      mobile?: string;
      grade?: string;
      managedClasses: Program[];
      totalSessionsExpected: number;
      recordedSessionsCount: number;
      commitmentPercent: number;
    }>();

    programs.forEach(p => {
      // 1. representativeStudentIds
      if (Array.isArray(p.representativeStudentIds)) {
        p.representativeStudentIds.forEach(sid => {
          if (!sid) return;
          const st = students.find(s => String(s.id) === String(sid) || s.studentCode === sid || s.nationalId === sid);
          const repId = st?.id || String(sid);
          const repName = st?.name || `نماینده (${sid})`;
          const repMobile = st?.fatherMobile || st?.mobile || st?.phone || (st as any)?.fatherPhone || (st as any)?.parentMobile || '';

          if (!repMap.has(repId)) {
            repMap.set(repId, {
              id: repId,
              name: repName,
              studentCode: st?.studentCode,
              nationalId: st?.nationalId,
              mobile: repMobile,
              grade: st?.grade || p.grade,
              managedClasses: [p],
              totalSessionsExpected: 0,
              recordedSessionsCount: 0,
              commitmentPercent: 100
            });
          } else {
            const item = repMap.get(repId)!;
            if (!item.managedClasses.some(cp => cp.id === p.id)) {
              item.managedClasses.push(p);
            }
            if (!item.mobile && repMobile) item.mobile = repMobile;
          }
        });
      }

      // 2. representativeNames
      if (Array.isArray(p.representativeNames)) {
        p.representativeNames.forEach(rName => {
          if (!rName || !rName.trim()) return;
          const cleanName = rName.trim();
          const st = students.find(s => s.name?.trim() === cleanName);
          const repId = st?.id || `rep_name_${cleanName}`;
          const repMobile = st?.fatherMobile || st?.mobile || st?.phone || (st as any)?.fatherPhone || (st as any)?.parentMobile || '';

          if (!repMap.has(repId)) {
            repMap.set(repId, {
              id: repId,
              name: st?.name || cleanName,
              studentCode: st?.studentCode,
              nationalId: st?.nationalId,
              mobile: repMobile,
              grade: st?.grade || p.grade,
              managedClasses: [p],
              totalSessionsExpected: 0,
              recordedSessionsCount: 0,
              commitmentPercent: 100
            });
          } else {
            const item = repMap.get(repId)!;
            if (!item.managedClasses.some(cp => cp.id === p.id)) {
              item.managedClasses.push(p);
            }
            if (!item.mobile && repMobile) item.mobile = repMobile;
          }
        });
      }
    });

    // Also check users with class_representative role
    users.forEach(u => {
      if (u.role === 'class_representative' || u.roleTitle?.includes('نماینده')) {
        const uId = u.studentId || u.linkedStudentId || u.id;
        const st = students.find(s => String(s.id) === String(uId) || s.nationalId === u.username);
        const repId = st?.id || uId;
        const repName = st?.name || u.fullName || u.name || u.username;
        const repMobile = u.phone || u.mobile || st?.fatherMobile || st?.mobile || '';

        if (!repMap.has(repId)) {
          const userProgs = programs.filter(p => 
            p.representativeStudentIds?.includes(repId) ||
            p.representativeStudentIds?.includes(u.studentId) ||
            p.representativeNames?.includes(repName) ||
            p.id === u.managedClassId
          );

          if (userProgs.length > 0) {
            repMap.set(repId, {
              id: repId,
              name: repName,
              studentCode: st?.studentCode,
              nationalId: st?.nationalId || u.username,
              mobile: repMobile,
              grade: st?.grade,
              managedClasses: userProgs,
              totalSessionsExpected: 0,
              recordedSessionsCount: 0,
              commitmentPercent: 100
            });
          }
        } else {
          const item = repMap.get(repId)!;
          if (!item.mobile && repMobile) item.mobile = repMobile;
        }
      }
    });

    // Calculate commitment metrics for each rep
    const list = Array.from(repMap.values());
    list.forEach(rep => {
      let expected = 0;
      let recorded = 0;

      rep.managedClasses.forEach(p => {
        const classAtts = attendanceRecords.filter(r => r.programId === p.id);
        recorded += classAtts.length;
        expected += Math.max(classAtts.length, 1);
      });

      rep.totalSessionsExpected = expected;
      rep.recordedSessionsCount = recorded;
      rep.commitmentPercent = expected > 0 ? Math.min(100, Math.round((recorded / expected) * 100)) : 100;
    });

    // Filter by repSearchQuery if provided
    if (repSearchQuery.trim()) {
      const q = repSearchQuery.toLowerCase().trim();
      return list.filter(r => 
        r.name.toLowerCase().includes(q) || 
        r.mobile?.includes(q) || 
        r.nationalId?.includes(q) ||
        r.managedClasses.some(p => p.title.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => b.commitmentPercent - a.commitmentPercent || a.name.localeCompare(b.name, 'fa'));
  }, [programs, students, users, attendanceRecords, repSearchQuery]);

  // Handler to save Education Manager note for a representative
  const handleSaveRepNote = async (repId: string, text: string) => {
    setRepNotesMap(prev => ({ ...prev, [repId]: text }));
    try {
      const existing = await localDb.getDocs<any>('representative_notes');
      const match = existing.find(n => n.repId === repId || n.id === repId);
      if (match) {
        await localDb.updateDoc('representative_notes', match.id, { noteText: text, updatedAt: new Date().toISOString() });
      } else {
        await localDb.addDoc('representative_notes', { id: repId, repId, noteText: text, updatedAt: new Date().toISOString() });
      }
      showToast('توضیحات مسئول آموزش با موفقیت در دیتابیس ثبت گردید.');
    } catch (err) {
      console.warn('Error saving representative note:', err);
    }
  };

  // 4 Primary Metrics for Student / Overall Panel
  const studentMetrics = useMemo(() => {
    const isLevel3OrStudent = currentUser?.level === 3 || isOrdinaryStudent;

    if (isLevel3OrStudent && studentReportList.length > 0) {
      const myItem = studentReportList[0];
      return {
        heldSessions: myItem.heldSessionsEnrolled,
        presents: myItem.presentCount,
        absents: myItem.absentCount,
        excused: myItem.excusedCount,
        totalAbsences: myItem.absentCount + myItem.excusedCount,
        lates: myItem.lateCount,
        warnings: myItem.warningCount,
      };
    }

    return {
      heldSessions: overallReportMetrics.heldSessions,
      presents: overallReportMetrics.totalPresents,
      absents: overallReportMetrics.totalAbsents,
      excused: overallReportMetrics.totalExcused,
      totalAbsences: overallReportMetrics.totalAbsents + overallReportMetrics.totalExcused,
      lates: overallReportMetrics.totalLates,
      warnings: overallReportMetrics.totalWarnings,
    };
  }, [currentUser, isOrdinaryStudent, studentReportList, overallReportMetrics]);

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
      let rows: any[] = [];

      if (reportViewMode === 'class') {
        // Export by class groups
        let rowIdx = 1;
        classGroupedReportList.forEach(cGroup => {
          cGroup.studentsList.forEach(stItem => {
            rows.push({
              'ردیف': rowIdx++,
              'نام کلاس / درس': cGroup.programTitle,
              'استاد مربوطه': cGroup.teacherName,
              'پایه': cGroup.grade,
              'نام و نام خانوادگی طلبه': stItem.student.name,
              'کد ملی': stItem.student.nationalId || '',
              'غیبت غیرموجه': stItem.absentCount,
              'غیبت موجه': stItem.excusedCount,
              'تاخیر': stItem.lateCount,
              'تعداد اخطارها': stItem.warningCount
            });
          });
        });
      } else if (reportViewMode === 'summary') {
        // Export concise aggregated summary per student
        rows = studentReportList.map((item, idx) => ({
          'ردیف': idx + 1,
          'نام و نام خانوادگی طلبه': item.student.name,
          'کد ملی': item.student.nationalId || '',
          'پایه تحصیلی': item.student.grade || '',
          'خلاصه غیبت‌ها به تفکیک دروس': (item as any).compactCourseSummary || 'بدون غیبت',
          'مجموع غیبت غیرموجه': item.absentCount,
          'مجموع غیبت موجه': item.excusedCount,
          'کل تاخیرها': item.lateCount,
          'تعداد اخطارهای آموزشی': item.warningCount
        }));
      } else {
        // Export full per-student list
        rows = studentReportList.map((item, idx) => ({
          'ردیف': idx + 1,
          'نام و نام خانوادگی طلبه': item.student.name,
          'کد ملی': item.student.nationalId || '',
          'پایه تحصیلی': item.student.grade || '',
          'کلاس / درس مربوطه': (item as any).programTitleSummary || 'عمومی',
          'تعداد جلسات برگزار شده': item.heldSessionsEnrolled,
          'تعداد حضور': item.presentCount,
          'غیبت غیرموجه': item.absentCount,
          'غیبت موجه': item.excusedCount,
          'تاخیر در ورود': item.lateCount,
          'نامشخص': item.unspecifiedCount,
          'تعداد اخطارهای آموزشی': item.warningCount,
          'درصد حضور': item.heldSessionsEnrolled > 0 ? `${Math.round((item.presentCount / item.heldSessionsEnrolled) * 100)}%` : '۰%'
        }));
      }

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'آمار حضور و غیاب');
      const catTag = reportCourseCategory === 'academic' ? 'دروس_اصلی' : reportCourseCategory === 'counseling' ? 'مشاوره' : reportCourseCategory === 'thursday' ? 'پنجشنبه' : 'تجمیعی';
      const fileName = `گزارش_غیبت_طلاب_${catTag}_${selectedDate.replace(/\//g, '-')}.xlsx`;
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

      {/* Header Banner - Modern, Compact, High-Positioned */}
      <div className={cn(
        "rounded-2xl p-2.5 sm:p-3.5 border flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all -mt-2 sm:-mt-4 shadow-sm",
        isOrdinaryStudent
          ? "bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white border-indigo-500/25 shadow-indigo-950/20"
          : "bg-white text-slate-900 border-slate-200 shadow-xs"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black shadow-xs border shrink-0",
            isOrdinaryStudent
              ? "bg-white/10 text-amber-300 border-white/20"
              : "bg-indigo-50 text-indigo-700 border-indigo-100"
          )}>
            <CheckSquare size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={cn("text-xs sm:text-sm font-black", isOrdinaryStudent ? "text-white" : "text-slate-900")}>
                {isRepresentative ? 'ثبت حضور و غیاب کلاس' : isOrdinaryStudent ? 'کارنامه حضور و غیاب من' : 'سامانه حضور و غیاب و آمار کلاس‌ها'}
              </h1>
              {isRepresentative && (
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-[10px] font-black rounded-lg">
                  پنل نماینده کلاس
                </span>
              )}
              {!isOrdinaryStudent && !isRepresentative && (
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-black rounded-lg">
                  نسخه هوشمند مدرسه
                </span>
              )}
            </div>
            <p className={cn("text-[10.5px] mt-0.5 font-medium", isOrdinaryStudent ? "text-indigo-200/80" : "text-slate-500")}>
              {isRepresentative 
                ? 'ثبت و ویرایش وضعیت حضور، غیبت و تاخیر طلاب کلاس تحت نمایندگی شما' 
                : isOrdinaryStudent 
                ? 'مشاهده وضعیت حضور، تاخیرها، غیبت‌های موجه و غیرموجه شما در دوره‌های آموزشی'
                : 'ثبت روزانه توسط نمایندگان کلاس‌ها و مسئولین آموزش همراه با گزارش‌گیری جامع، اخطار آموزشی و موجه‌سازی'}
            </p>
          </div>
        </div>

        {/* View Switcher & Settings (Only shown when multiple tabs/options exist) */}
        {!isOrdinaryStudent && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Class Status tab - hidden for regular students & representatives */}
            {!isRepresentative && (
              <button
                type="button"
                onClick={() => setActiveTab('class_status')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border shadow-sm active:scale-95",
                  activeTab === 'class_status'
                    ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 text-white border-transparent shadow-md ring-2 ring-emerald-500/30"
                    : "bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-200"
                )}
              >
                <LayoutGrid size={15} className={activeTab === 'class_status' ? 'text-white animate-pulse' : 'text-emerald-600'} />
                <span>وضعیت کلاس‌ها</span>
              </button>
            )}

            <div className="p-1 bg-slate-100 rounded-xl flex items-center border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('record')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
                  activeTab === 'record'
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <CheckSquare size={14} />
                <span>{isRepresentative ? 'ثبت حضور و غیاب' : 'ثبت و ویرایش جلسه'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('report')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
                  activeTab === 'report'
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <FileCheck2 size={14} />
                <span>{isRepresentative ? 'آمار غیبت من' : 'گزارش‌ها و آمار غیبت'}</span>
              </button>

              {!isOrdinaryStudent && !isRepresentative && (
                <button
                  type="button"
                  onClick={() => setActiveTab('representatives_list')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
                    activeTab === 'representatives_list'
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <Users size={14} />
                  <span>لیست نمایندگان</span>
                </button>
              )}
            </div>

            {canManageSettings && (
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl transition-all shadow-2xs hover:border-slate-300 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                title="تنظیمات مهلت ویرایش و گزارش‌ها"
              >
                <SlidersHorizontal size={15} className="text-indigo-600" />
                <span className="hidden sm:inline">تنظیمات</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* TAB 3: CLASSROOM ATTENDANCE OVERVIEW (وضعیت کلاس‌ها) */}
      {/* ===================================================================== */}
      {activeTab === 'class_status' && !isOrdinaryStudent && !isRepresentative && (() => {
        // Date helpers
        const getOffsetShamsiDate = (offsetDays: number) => {
          try {
            const todayStr = getTodayShamsi();
            const dt = shamsiToDate(todayStr);
            dt.setDate(dt.getDate() + offsetDays);
            return dateToShamsi(dt);
          } catch {
            return getTodayShamsi();
          }
        };

        const handlePrevDay = () => {
          try {
            const dt = shamsiToDate(selectedDate);
            dt.setDate(dt.getDate() - 1);
            setSelectedDate(dateToShamsi(dt));
          } catch {}
        };

        const handleNextDay = () => {
          try {
            const dt = shamsiToDate(selectedDate);
            dt.setDate(dt.getDate() + 1);
            setSelectedDate(dateToShamsi(dt));
          } catch {}
        };

        // Get day of week name
        const currentDayName = getShamsiDayOfWeekName(selectedDate);

        // Filter programs scheduled for currentDayName (Class Representatives only see their own assigned classes)
        const availablePrograms = isRepresentative ? representativePrograms : programs;
        const scheduledOnDate = availablePrograms.filter(p => {
          const days = getProgramDays(p);
          if (days && days.length > 0) {
            return days.includes(currentDayName);
          }
          if (Array.isArray(p.daysOfWeek) && p.daysOfWeek.length > 0) {
            return p.daysOfWeek.includes(currentDayName as any);
          }
          // Fallback: Saturday to Wednesday
          return currentDayName !== 'جمعه' && currentDayName !== 'پنج‌شنبه';
        });

        // Card Helper Status Function
        const getStatusCardData = (prog: any) => {
          const hol = getHolidayForDate(selectedDate);
          const rec = attendanceRecords.find(r => r.programId === prog.id && r.date === selectedDate);

          if (rec) {
            if (rec.isCancelled) {
              return {
                statusKey: 'cancelled' as const,
                badgeText: 'تعطیل (کرمی)',
                badgeClass: 'bg-amber-950/20 text-[#5C4027] border border-amber-900/30 font-extrabold',
                cardBorder: 'bg-gradient-to-br from-[#FFFDF6]/95 via-[#FAF0E2]/95 to-[#F5E6CE]/95 text-[#5C4027] border-[#DFCEB7]/80 hover:border-[#D0BAA0] shadow-md shadow-amber-950/5 hover:shadow-amber-950/10 font-bold',
                gradePill: 'bg-[#5C4027]/10 text-[#5C4027] border border-[#5C4027]/15 font-black',
                statusIcon: <XCircle className="w-3 h-3 text-[#5C4027]" />,
                actionBtn: 'bg-[#5C4027]/10 hover:bg-[#5C4027]/20 text-[#5C4027] border border-[#5C4027]/15 shadow-xs font-black',
                boxBg: 'bg-[#5C4027]/5 backdrop-blur-xs rounded-lg p-1 border border-[#5C4027]/10 text-[#5C4027] font-bold text-[9px]',
                description: rec.cancellationReason || 'عدم تشکیل جلسه'
              };
            }

            if (rec.hasSubstituteTeacher) {
              return {
                statusKey: 'substitute' as const,
                badgeText: 'جایگزین (آبی)',
                badgeClass: 'bg-blue-950/40 text-blue-100 border border-blue-400/30 backdrop-blur-xs font-extrabold',
                cardBorder: 'bg-gradient-to-br from-blue-600/90 via-indigo-600/85 to-indigo-800/90 text-white border-blue-400/40 hover:border-blue-300/60 shadow-md shadow-blue-500/15 hover:shadow-blue-500/25 font-bold',
                gradePill: 'bg-blue-950/40 text-blue-100 border border-blue-400/20 font-black',
                statusIcon: <UserCheck2 className="w-3 h-3 text-blue-200" />,
                actionBtn: 'bg-white/15 hover:bg-white/25 text-white border border-white/20 hover:border-white/40 shadow-sm shadow-black/10 font-black',
                boxBg: 'bg-black/20 backdrop-blur-md rounded-lg p-1 border border-white/10 text-blue-50 font-bold text-[9px]',
                substituteName: rec.substituteTeacherName,
                notes: rec.substituteTeacherNotes
              };
            }

            // Normal recorded (GREEN)
            const presentCount = rec.students?.filter(s => s.status === 'present').length || 0;
            const absentCount = rec.students?.filter(s => s.status === 'absent').length || 0;
            const lateCount = rec.students?.filter(s => s.status === 'late').length || 0;
            const totalCount = rec.students?.length || 0;

            return {
              statusKey: 'recorded' as const,
              badgeText: 'ثبت‌شده (سبز)',
              badgeClass: 'bg-emerald-950/40 text-emerald-100 border border-emerald-400/30 backdrop-blur-xs font-extrabold',
              cardBorder: 'bg-gradient-to-br from-emerald-600/90 via-emerald-700/85 to-teal-850/90 text-white border-emerald-400/40 hover:border-emerald-300/60 shadow-md shadow-emerald-500/15 hover:shadow-emerald-500/25 font-bold',
              gradePill: 'bg-emerald-950/40 text-emerald-100 border border-emerald-400/20 font-black',
              statusIcon: <CheckCircle2 className="w-3 h-3 text-emerald-200" />,
              actionBtn: 'bg-white/15 hover:bg-white/25 text-white border border-white/20 hover:border-white/40 shadow-sm shadow-black/10 font-black',
              boxBg: 'bg-black/20 backdrop-blur-md rounded-lg p-1 border border-white/10 text-emerald-50 text-[9px] font-black',
              presentCount,
              absentCount,
              lateCount,
              totalCount
            };
          }

          if (hol) {
            return {
              statusKey: 'holiday' as const,
              badgeText: 'تعطیل (کرمی)',
              badgeClass: 'bg-amber-950/20 text-[#5C4027] border border-amber-900/30 font-extrabold',
              cardBorder: 'bg-gradient-to-br from-[#FFFDF6]/95 via-[#FAF0E2]/95 to-[#F5E6CE]/95 text-[#5C4027] border-[#DFCEB7]/80 hover:border-[#D0BAA0] shadow-md shadow-amber-950/5 hover:shadow-amber-950/10 font-bold',
              gradePill: 'bg-[#5C4027]/10 text-[#5C4027] border border-[#5C4027]/15 font-black',
              statusIcon: <AlertOctagon className="w-3 h-3 text-[#5C4027]" />,
              actionBtn: 'bg-[#5C4027]/10 hover:bg-[#5C4027]/20 text-[#5C4027] border border-[#5C4027]/15 shadow-xs font-black',
              boxBg: 'bg-[#5C4027]/5 backdrop-blur-xs rounded-lg p-1 border border-[#5C4027]/10 text-[#5C4027] font-bold text-[9px]',
              description: hol.title
            };
          }

          // Pending (Not recorded yet) = RED FULL COLOR as requested!
          return {
            statusKey: 'pending' as const,
            badgeText: 'ثبت‌نشده (قرمز)',
            badgeClass: 'bg-rose-950/40 text-rose-100 border border-rose-400/30 backdrop-blur-xs font-extrabold',
            cardBorder: 'bg-gradient-to-br from-rose-600/90 via-red-600/85 to-rose-800/90 text-white border-rose-400/40 hover:border-rose-300/60 shadow-md shadow-red-500/15 hover:shadow-red-500/25 animate-pulse-subtle font-bold',
            gradePill: 'bg-rose-950/40 text-rose-100 border border-rose-400/20 font-black',
            statusIcon: <AlertCircle className="w-3 h-3 text-rose-200 animate-bounce" />,
            actionBtn: 'bg-white/15 hover:bg-white/25 text-white border border-white/20 hover:border-white/40 shadow-sm shadow-black/10 font-black',
            boxBg: 'bg-black/20 backdrop-blur-md rounded-lg p-1 border border-white/10 text-rose-50 font-black text-[9px] text-center'
          };
        };

        // Base scheduled programs on this date filtered by grade and search query (before color filter)
        const basePrograms = scheduledOnDate.filter(p => {
          if (classStatusGradeFilter !== 'all' && !matchesGradeFilter(p.grade, classStatusGradeFilter)) {
            return false;
          }
          if (classStatusSearchQuery.trim()) {
            const q = classStatusSearchQuery.toLowerCase().trim();
            const matchTitle = p.title?.toLowerCase().includes(q);
            const matchTeacher = p.teacherName?.toLowerCase().includes(q);
            const matchRoom = p.classroomTitle?.toLowerCase().includes(q) || p.location?.toLowerCase().includes(q);
            if (!matchTitle && !matchTeacher && !matchRoom) return false;
          }
          return true;
        });

        // Accurate stats metrics calculated across all matching classes in this day
        let totalRec = 0;
        let totalSub = 0;
        let totalCanc = 0;
        let totalPend = 0;

        basePrograms.forEach(p => {
          const st = getStatusCardData(p);
          if (st.statusKey === 'recorded') totalRec++;
          else if (st.statusKey === 'substitute') totalSub++;
          else if (st.statusKey === 'cancelled' || st.statusKey === 'holiday') totalCanc++;
          else if (st.statusKey === 'pending') totalPend++;
        });

        // Apply Card Color / Status Filter
        const filteredPrograms = basePrograms.filter(p => {
          if (classStatusColorFilter === 'all') return true;
          const st = getStatusCardData(p);
          if (classStatusColorFilter === 'recorded') return st.statusKey === 'recorded';
          if (classStatusColorFilter === 'substitute') return st.statusKey === 'substitute';
          if (classStatusColorFilter === 'cancelled') return st.statusKey === 'cancelled' || st.statusKey === 'holiday';
          if (classStatusColorFilter === 'pending') return st.statusKey === 'pending';
          return true;
        });

        // Separate Academic and Counseling programs
        const academicProgs = filteredPrograms.filter(p => 
          !p.isCounseling && 
          p.category !== 'counseling' && 
          p.type !== 'counseling' && 
          !p.title?.includes('مشاوره') && 
          !p.grade?.includes('مشاوره')
        );

        const counselingProgs = filteredPrograms.filter(p => 
          p.isCounseling || 
          p.category === 'counseling' || 
          p.type === 'counseling' || 
          p.title?.includes('مشاوره') || 
          p.grade?.includes('مشاوره')
        );

        // Grade options extracted dynamically
        const gradeOptions = Array.from(new Set(programs.map(p => p.grade).filter(Boolean))).sort();

        return (
          <div className="space-y-6">
            {/* Top Date & Day Navigation Bar */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 text-white shadow-xl border border-indigo-500/20 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <LayoutGrid size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-black text-white">پایش کارتی وضعیت کلاس‌های روزانه</h2>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-white">
                        {currentDayName}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium mt-0.5">
                      نمایش هوشمند فقط کلاس‌های دارای برنامه در روز انتخاب‌شده، همراه با تفکیک کلاس‌های مشاوره و وضعیت حضور و غیاب
                    </p>
                  </div>
                </div>

                {/* Date Picker & Prev/Next Day Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handlePrevDay}
                    className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all border border-white/20 cursor-pointer flex items-center gap-1 text-xs font-bold"
                    title="روز قبل"
                  >
                    <ChevronRight size={16} />
                    <span className="hidden sm:inline">روز قبل</span>
                  </button>

                  <div className="w-44 text-slate-900">
                    <ShamsiDatePicker
                      value={selectedDate}
                      onChange={(d) => setSelectedDate(d)}
                      label=""
                      placeholder="انتخاب تاریخ"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleNextDay}
                    className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all border border-white/20 cursor-pointer flex items-center gap-1 text-xs font-bold"
                    title="روز بعد"
                  >
                    <span className="hidden sm:inline">روز بعد</span>
                    <ChevronLeft size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedDate(getTodayShamsi())}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs border border-white/20 cursor-pointer"
                  >
                    امروز
                  </button>
                </div>
              </div>

              {/* Quick Date Pills for Past Days */}
              <div className="pt-2 border-t border-white/10 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                <span className="text-[11px] font-bold text-slate-300 shrink-0 ml-1">دسترسی سریع به روزهای قبل:</span>
                {[
                  { label: 'امروز', date: getTodayShamsi() },
                  { label: 'دیروز', date: getOffsetShamsiDate(-1) },
                  { label: 'پریروز', date: getOffsetShamsiDate(-2) },
                  { label: '۳ روز قبل', date: getOffsetShamsiDate(-3) },
                  { label: '۴ روز قبل', date: getOffsetShamsiDate(-4) },
                  { label: '۱ هفته قبل', date: getOffsetShamsiDate(-7) }
                ].map(item => {
                  const isSel = item.date === selectedDate;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setSelectedDate(item.date)}
                      className={cn(
                        "px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all shrink-0 cursor-pointer border",
                        isSel
                          ? "bg-emerald-500 text-white border-emerald-400 shadow-xs"
                          : "bg-white/10 hover:bg-white/20 text-slate-200 border-white/15"
                      )}
                    >
                      {item.label} ({item.date.split('/')[2]})
                    </button>
                  );
                })}
              </div>

              {/* Day Notice & Stats Counter Strip */}
              <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-emerald-300 font-bold">
                  <Info size={14} className="shrink-0 text-emerald-400" />
                  <span>تضمین برنامه‌ریزی: کلاس‌هایی که در روز «{currentDayName}» درس ندارند کلاً از لیست مخفی شده‌اند.</span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-bold shrink-0">
                  <button
                    type="button"
                    onClick={() => setClassStatusColorFilter('all')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg transition-all cursor-pointer border flex items-center gap-1",
                      classStatusColorFilter === 'all'
                        ? "bg-white text-slate-900 border-white shadow-xs font-black ring-2 ring-white/60"
                        : "bg-white/10 hover:bg-white/20 text-white border-white/15"
                    )}
                    title="نمایش تمامی کلاس‌ها بدون محدودیت وضعیت یا رنگ"
                  >
                    <span>کل کلاس‌ها: {basePrograms.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setClassStatusColorFilter(classStatusColorFilter === 'recorded' ? 'all' : 'recorded')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg transition-all cursor-pointer border flex items-center gap-1",
                      classStatusColorFilter === 'recorded'
                        ? "bg-emerald-500 text-white border-emerald-400 shadow-xs font-black ring-2 ring-emerald-300"
                        : "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/30"
                    )}
                    title="فیلتر فقط کارت‌های ثبت‌شده (سبز) - کلیک مجدد برای لغو"
                  >
                    <CheckCircle2 size={12} />
                    <span>ثبت‌شده (سبز): {totalRec}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setClassStatusColorFilter(classStatusColorFilter === 'substitute' ? 'all' : 'substitute')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg transition-all cursor-pointer border flex items-center gap-1",
                      classStatusColorFilter === 'substitute'
                        ? "bg-blue-600 text-white border-blue-400 shadow-xs font-black ring-2 ring-blue-300"
                        : "bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-blue-500/30"
                    )}
                    title="فیلتر فقط کارت‌های دارای استاد جایگزین (آبی) - کلیک مجدد برای لغو"
                  >
                    <UserCheck2 size={12} />
                    <span>استاد جایگزین (آبی): {totalSub}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setClassStatusColorFilter(classStatusColorFilter === 'cancelled' ? 'all' : 'cancelled')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg transition-all cursor-pointer border flex items-center gap-1",
                      classStatusColorFilter === 'cancelled'
                        ? "bg-amber-600 text-white border-amber-400 shadow-xs font-black ring-2 ring-amber-300"
                        : "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/30"
                    )}
                    title="فیلتر فقط کارت‌های تعطیل‌شده (کرمی) - کلیک مجدد برای لغو"
                  >
                    <XCircle size={12} />
                    <span>تعطیل‌شده (کرمی): {totalCanc}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setClassStatusColorFilter(classStatusColorFilter === 'pending' ? 'all' : 'pending')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg transition-all cursor-pointer border flex items-center gap-1",
                      classStatusColorFilter === 'pending'
                        ? "bg-rose-600 text-white border-rose-400 shadow-xs font-black ring-2 ring-rose-300 animate-pulse"
                        : "bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/30"
                    )}
                    title="فیلتر فقط کارت‌های انجام‌نشده (قرمز) - کلیک مجدد برای لغو"
                  >
                    <AlertCircle size={12} />
                    <span>انجام‌نشده (قرمز): {totalPend}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap flex-1">
                {/* Search */}
                <div className="relative min-w-[200px] flex-1">
                  <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={classStatusSearchQuery}
                    onChange={(e) => setClassStatusSearchQuery(e.target.value)}
                    placeholder="جستجوی نام درس، استاد یا مدرس..."
                    className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-indigo-500"
                  />
                  {classStatusSearchQuery && (
                    <button onClick={() => setClassStatusSearchQuery('')} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Grade Filter */}
                <div className="min-w-[150px]">
                  <select
                    value={classStatusGradeFilter}
                    onChange={(e) => setClassStatusGradeFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="all">همه پایه‌های تحصیلی</option>
                    {gradeOptions.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                {/* Card Status / Color Filter Dropdown */}
                <div className="min-w-[170px]">
                  <select
                    value={classStatusColorFilter}
                    onChange={(e) => setClassStatusColorFilter(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="all">همه وضعیت‌ها (همه رنگ‌ها)</option>
                    <option value="pending">🔴 فقط انجام‌نشده / معوق (قرمز)</option>
                    <option value="recorded">🟢 فقط ثبت‌شده (سبز)</option>
                    <option value="substitute">🔵 فقط استاد جایگزین (آبی)</option>
                    <option value="cancelled">🟡 فقط تعطیل‌شده (کرمی)</option>
                  </select>
                </div>
              </div>

              {/* Category Tab Toggle (All / Academic / Counseling) */}
              <div className="p-1 bg-slate-100 rounded-2xl flex items-center border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setClassStatusCategoryTab('all')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                    classStatusCategoryTab === 'all' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  همه ({filteredPrograms.length})
                </button>
                <button
                  type="button"
                  onClick={() => setClassStatusCategoryTab('academic')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1",
                    classStatusCategoryTab === 'academic' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <BookOpen size={13} />
                  <span>درسی ({academicProgs.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setClassStatusCategoryTab('counseling')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1",
                    classStatusCategoryTab === 'counseling' ? "bg-white text-amber-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <Sparkles size={13} />
                  <span>مشاوره ({counselingProgs.length})</span>
                </button>
              </div>
            </div>

            {/* Empty State */}
            {filteredPrograms.length === 0 && (
              <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3">
                <CalendarIcon size={48} className="mx-auto text-slate-300" />
                <h3 className="text-base font-black text-slate-800">هیچ کلاسی برای نمایش در این روز وجود ندارد</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  طبق برنامه‌ریزی هفتگی، برای روز «{currentDayName}» ({selectedDate}) با فیلترهای انتخابی کلاسی تعریف نشده است.
                </p>
              </div>
            )}

            {/* SECTION 1: ACADEMIC CLASSES */}
            {(classStatusCategoryTab === 'all' || classStatusCategoryTab === 'academic') && academicProgs.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-indigo-50 text-indigo-700 rounded-lg">
                      <GraduationCap size={16} />
                    </div>
                    <h3 className="text-xs sm:text-sm font-black text-slate-900">کلاس‌های درسی و آموزشی اصلی</h3>
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-black rounded-full">
                      {academicProgs.length} کلاس
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                  {academicProgs.map(prog => {
                    const st = getStatusCardData(prog);
                    const totalAtt = (st.presentCount || 0) + (st.absentCount || 0) + (st.lateCount || 0);
                    const presenceRate = totalAtt > 0 ? Math.round(((st.presentCount || 0) / totalAtt) * 100) : 100;
                    return (
                      <div
                        key={prog.id}
                        className={cn(
                          "rounded-2xl sm:rounded-3xl p-4 sm:p-5 border transition-all duration-300 flex flex-col justify-between space-y-3.5 relative overflow-hidden text-xs shadow-md backdrop-blur-xl hover:border-white/60 hover:ring-2 hover:ring-white/30 hover:shadow-[0_12px_32px_rgba(0,0,0,0.22)] before:absolute before:inset-0 before:bg-gradient-to-tr before:from-transparent before:via-white/30 before:to-transparent before:translate-x-[-120%] hover:before:translate-x-[120%] before:transition-transform before:duration-1000 before:ease-in-out hover:scale-[1.02] cursor-default active:scale-[0.99] min-h-[195px]",
                          st.cardBorder
                        )}
                      >
                        {/* Bank Card Top Row: Grade Pill + Donut & Status Badge */}
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn("px-2.5 py-1 text-xs rounded-xl font-black truncate max-w-[110px] tracking-wide shadow-2xs", st.gradePill)}>
                            {prog.grade || 'عمومی'}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {st.statusKey === 'recorded' && (
                              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-black/30 backdrop-blur-md text-white/95 border border-white/15 shadow-2xs" title={`درصد حضور روزانه: ${presenceRate}٪`}>
                                <svg className="w-4 h-4 -rotate-90 shrink-0" viewBox="0 0 36 36">
                                  <path className="text-white/20" strokeWidth="4" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                  <path className={presenceRate >= 80 ? "text-emerald-300" : presenceRate >= 60 ? "text-amber-300" : "text-rose-300"} strokeDasharray={`${presenceRate}, 100`} strokeWidth="4" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                </svg>
                                <span className="text-[10px] font-black">{presenceRate}٪</span>
                              </div>
                            )}
                            <span className={cn("px-2.5 py-1 text-[10px] rounded-xl border flex items-center gap-1 font-extrabold shadow-2xs", st.badgeClass)}>
                              {st.statusIcon}
                              <span className="truncate max-w-[70px]">{st.badgeText}</span>
                            </span>
                          </div>
                        </div>

                        {/* Title & Teacher & Schedule Meta */}
                        <div className="space-y-1.5 flex-1">
                          <h4 className="text-sm sm:text-base font-black leading-snug line-clamp-1 drop-shadow-xs tracking-tight" title={prog.title}>
                            {prog.title}
                          </h4>
                          <div className="flex items-center gap-1.5 text-xs font-bold opacity-95">
                            <User size={13} className="shrink-0 opacity-80" />
                            <span className="truncate">استاد: {prog.teacherName || 'مشخص نشده'}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap pt-0.5">
                            {(prog.classroomTitle || prog.location) && (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/15 backdrop-blur-xs border border-white/10 text-[10.5px] opacity-90 font-medium">
                                <DoorOpen size={11} className="shrink-0" />
                                <span className="truncate max-w-[120px]">{prog.classroomTitle || prog.location}</span>
                              </div>
                            )}
                            {prog.timeSlot && (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/15 backdrop-blur-xs border border-white/10 text-[10.5px] opacity-90 font-medium">
                                <Clock size={11} className="shrink-0" />
                                <span className="truncate">{prog.timeSlot}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Middle Stats Ribbon / Status Details */}
                        {st.statusKey === 'recorded' && (
                          <div className={cn("grid grid-cols-3 divide-x divide-white/15 py-1.5 rounded-xl text-center font-black", st.boxBg)}>
                            <div>
                              <span className="block text-[9px] opacity-80">حاضر</span>
                              <span className="text-xs sm:text-sm font-black">{st.presentCount}</span>
                            </div>
                            <div>
                              <span className="block text-[9px] opacity-80">غایب</span>
                              <span className="text-xs sm:text-sm font-black">{st.absentCount}</span>
                            </div>
                            <div>
                              <span className="block text-[9px] opacity-80">تاخیر</span>
                              <span className="text-xs sm:text-sm font-black">{st.lateCount}</span>
                            </div>
                          </div>
                        )}

                        {st.statusKey === 'substitute' && (
                          <div className={cn("space-y-1 py-1.5 px-2.5 rounded-xl", st.boxBg)}>
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <UserCheck2 size={13} className="shrink-0" />
                              <span className="truncate font-extrabold">استاد جایگزین: {st.substituteName}</span>
                            </div>
                            {st.notes && <p className="text-[10px] opacity-85 font-medium line-clamp-1">{st.notes}</p>}
                          </div>
                        )}

                        {(st.statusKey === 'cancelled' || st.statusKey === 'holiday') && (
                          <div className={cn("py-1.5 px-2.5 rounded-xl line-clamp-1 text-[11px] font-bold", st.boxBg)}>
                            <span className="truncate">علت عدم تشکیل: {st.description}</span>
                          </div>
                        )}

                        {st.statusKey === 'pending' && (
                          <div className={cn("py-1.5 text-center text-[11px] font-extrabold rounded-xl", st.boxBg)}>
                            <span>در انتظار ثبت آمار حضور و غیاب امروز</span>
                          </div>
                        )}

                        {/* Card Action Buttons: Full Record & Quick Status Change */}
                        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProgramId(prog.id);
                              setActiveTab('record');
                            }}
                            className={cn("col-span-1 py-2 px-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer shadow-xs", st.actionBtn)}
                            title="ورود به فرم کامل ثبت و ویرایش حضور و غیاب این کلاس"
                          >
                            <CheckSquare size={12} className="shrink-0" />
                            <span className="truncate">ثبت و ویرایش</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setQuickStatusModal({ prog, initialMode: st.statusKey });
                            }}
                            className="col-span-1 py-2 px-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer shadow-xs bg-black/25 hover:bg-black/35 text-white border border-white/20 hover:border-white/40 backdrop-blur-xs"
                            title="تغییر سریع وضعیت کارت (تعطیلی، استاد جایگزین، حضور کامل یا بازنشانی)"
                          >
                            <SlidersHorizontal size={12} className="shrink-0" />
                            <span className="truncate">تغییر وضعیت</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SECTION 2: COUNSELING CLASSES */}
            {(classStatusCategoryTab === 'all' || classStatusCategoryTab === 'counseling') && counselingProgs.length > 0 && (
              <div className="space-y-2.5 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-amber-50 text-amber-700 rounded-lg">
                      <Sparkles size={16} />
                    </div>
                    <h3 className="text-xs sm:text-sm font-black text-slate-900">کلاس‌ها و جلسات مشاوره و تربیتی</h3>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black rounded-full">
                      {counselingProgs.length} کلاس
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                  {counselingProgs.map(prog => {
                    const st = getStatusCardData(prog);
                    const totalAtt = (st.presentCount || 0) + (st.absentCount || 0) + (st.lateCount || 0);
                    const presenceRate = totalAtt > 0 ? Math.round(((st.presentCount || 0) / totalAtt) * 100) : 100;
                    return (
                      <div
                        key={prog.id}
                        className={cn(
                          "rounded-2xl sm:rounded-3xl p-4 sm:p-5 border transition-all duration-300 flex flex-col justify-between space-y-3.5 relative overflow-hidden text-xs shadow-md backdrop-blur-xl hover:border-white/60 hover:ring-2 hover:ring-white/30 hover:shadow-[0_12px_32px_rgba(0,0,0,0.22)] before:absolute before:inset-0 before:bg-gradient-to-tr before:from-transparent before:via-white/30 before:to-transparent before:translate-x-[-120%] hover:before:translate-x-[120%] before:transition-transform before:duration-1000 before:ease-in-out hover:scale-[1.02] cursor-default active:scale-[0.99] min-h-[195px]",
                          st.cardBorder
                        )}
                      >
                        {/* Bank Card Top Row: Grade Pill + Donut & Status Badge */}
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn("px-2.5 py-1 text-xs rounded-xl font-black truncate max-w-[110px] tracking-wide shadow-2xs", st.gradePill)}>
                            {prog.grade || 'مشاوره'}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {st.statusKey === 'recorded' && (
                              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-black/30 backdrop-blur-md text-white/95 border border-white/15 shadow-2xs" title={`درصد حضور روزانه: ${presenceRate}٪`}>
                                <svg className="w-4 h-4 -rotate-90 shrink-0" viewBox="0 0 36 36">
                                  <path className="text-white/20" strokeWidth="4" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                  <path className={presenceRate >= 80 ? "text-emerald-300" : presenceRate >= 60 ? "text-amber-300" : "text-rose-300"} strokeDasharray={`${presenceRate}, 100`} strokeWidth="4" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                </svg>
                                <span className="text-[10px] font-black">{presenceRate}٪</span>
                              </div>
                            )}
                            <span className={cn("px-2.5 py-1 text-[10px] rounded-xl border flex items-center gap-1 font-extrabold shadow-2xs", st.badgeClass)}>
                              {st.statusIcon}
                              <span className="truncate max-w-[70px]">{st.badgeText}</span>
                            </span>
                          </div>
                        </div>

                        {/* Title & Teacher & Schedule Meta */}
                        <div className="space-y-1.5 flex-1">
                          <h4 className="text-sm sm:text-base font-black leading-snug line-clamp-1 drop-shadow-xs tracking-tight" title={prog.title}>
                            {prog.title}
                          </h4>
                          <div className="flex items-center gap-1.5 text-xs font-bold opacity-95">
                            <User size={13} className="shrink-0 opacity-80" />
                            <span className="truncate">مشاور: {prog.teacherName || 'مشخص نشده'}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap pt-0.5">
                            {(prog.classroomTitle || prog.location) && (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/15 backdrop-blur-xs border border-white/10 text-[10.5px] opacity-90 font-medium">
                                <DoorOpen size={11} className="shrink-0" />
                                <span className="truncate max-w-[120px]">{prog.classroomTitle || prog.location}</span>
                              </div>
                            )}
                            {prog.timeSlot && (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/15 backdrop-blur-xs border border-white/10 text-[10.5px] opacity-90 font-medium">
                                <Clock size={11} className="shrink-0" />
                                <span className="truncate">{prog.timeSlot}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Middle Stats Ribbon / Status Details */}
                        {st.statusKey === 'recorded' && (
                          <div className={cn("grid grid-cols-3 divide-x divide-white/15 py-1.5 rounded-xl text-center font-black", st.boxBg)}>
                            <div>
                              <span className="block text-[9px] opacity-80">حاضر</span>
                              <span className="text-xs sm:text-sm font-black">{st.presentCount}</span>
                            </div>
                            <div>
                              <span className="block text-[9px] opacity-80">غایب</span>
                              <span className="text-xs sm:text-sm font-black">{st.absentCount}</span>
                            </div>
                            <div>
                              <span className="block text-[9px] opacity-80">تاخیر</span>
                              <span className="text-xs sm:text-sm font-black">{st.lateCount}</span>
                            </div>
                          </div>
                        )}

                        {st.statusKey === 'substitute' && (
                          <div className={cn("space-y-1 py-1.5 px-2.5 rounded-xl", st.boxBg)}>
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <UserCheck2 size={13} className="shrink-0" />
                              <span className="truncate font-extrabold">استاد جایگزین: {st.substituteName}</span>
                            </div>
                            {st.notes && <p className="text-[10px] opacity-85 font-medium line-clamp-1">{st.notes}</p>}
                          </div>
                        )}

                        {(st.statusKey === 'cancelled' || st.statusKey === 'holiday') && (
                          <div className={cn("py-1.5 px-2.5 rounded-xl line-clamp-1 text-[11px] font-bold", st.boxBg)}>
                            <span className="truncate">علت عدم تشکیل: {st.description}</span>
                          </div>
                        )}

                        {st.statusKey === 'pending' && (
                          <div className={cn("py-1.5 text-center text-[11px] font-extrabold rounded-xl", st.boxBg)}>
                            <span>در انتظار ثبت آمار حضور و غیاب امروز</span>
                          </div>
                        )}

                        {/* Card Action Buttons: Full Record & Quick Status Change */}
                        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProgramId(prog.id);
                              setActiveTab('record');
                            }}
                            className={cn("col-span-1 py-2 px-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer shadow-xs", st.actionBtn)}
                            title="ورود به فرم کامل ثبت و ویرایش حضور و غیاب این جلسه مشاوره"
                          >
                            <CheckSquare size={12} className="shrink-0" />
                            <span className="truncate">ثبت و ویرایش</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setQuickStatusModal({ prog, initialMode: st.statusKey });
                            }}
                            className="col-span-1 py-2 px-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer shadow-xs bg-black/25 hover:bg-black/35 text-white border border-white/20 hover:border-white/40 backdrop-blur-xs"
                            title="تغییر سریع وضعیت کارت (تعطیلی، مشاور جایگزین، حضور کامل یا بازنشانی)"
                          >
                            <SlidersHorizontal size={12} className="shrink-0" />
                            <span className="truncate">تغییر وضعیت</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* TAB 1: RECORD ATTENDANCE (ثبت و ویرایش جلسه) */}
      {/* ===================================================================== */}
      {activeTab === 'record' && !isOrdinaryStudent && (
        <div className="space-y-6">
          {/* Notice if representative has no linked class */}
          {isRepresentative && representativePrograms.length === 0 && (
            <div className="p-5 bg-amber-50 border border-amber-200 rounded-3xl flex items-center gap-3 text-amber-950 text-xs">
              <AlertCircle size={24} className="text-amber-600 shrink-0" />
              <div>
                <h4 className="font-black text-sm">حساب شما به عنوان نماینده کلاس فعال است</h4>
                <p className="text-amber-800 text-xs mt-0.5">
                  کلاس درسی در سیستم به عنوان کلاس تحت نمایندگی شما ثبت نشده است. لطفاً از مدیر یا مسئول پایه درخواست فرمایید شما را در بخش برنامه هفتگی به عنوان نماینده کلاس تعیین نمایند.
                </p>
              </div>
            </div>
          )}
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

          {/* Fast-Track Dedicated Representative Header Banner */}
          {isRepresentative && representativePrograms.length > 0 && (
            <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 text-white rounded-3xl shadow-md border border-emerald-400/30 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/30 shadow-xs">
                    <CheckSquare size={22} className="text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/30 text-emerald-100 text-[10px] font-black border border-emerald-300/40">
                        دسترسی مستقیم نماینده کلاس
                      </span>
                      <h3 className="text-sm sm:text-base font-black text-white">
                        ثبت سریع حضور و غیاب: «{currentProgram?.title || 'کلاس تحت نمایندگی'}»
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-emerald-100/90 font-medium mt-1 flex-wrap">
                      {currentProgram?.grade && <span>پایه {currentProgram.grade}</span>}
                      {currentProgram?.teacher && <span>• استاد: {currentProgram.teacher}</span>}
                      {(currentProgram?.madrasRoom || currentProgram?.classroom) && <span>• مَدرَس: {currentProgram.madrasRoom || currentProgram.classroom}</span>}
                      <span>• تعداد کل اعضای کلاس: {enrolledStudents.length} نفر</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleMarkAll('present')}
                    disabled={isCancelled || isDateLockedForRepresentative}
                    className="px-3.5 py-2 bg-white hover:bg-emerald-50 text-emerald-800 rounded-xl text-xs font-black transition-all shadow-xs active:scale-95 cursor-pointer flex items-center gap-1.5"
                    title="ثبت حضور کلیه طلاب کلاس با ۱ کلیک"
                  >
                    <CheckCircle2 size={15} className="text-emerald-600" />
                    <span>حضور همه طلاب</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAttendance}
                    disabled={isSaving || !currentProgram || isDateLockedForRepresentative}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5",
                      isSavedRecently 
                        ? "bg-emerald-400 text-emerald-950" 
                        : "bg-amber-400 hover:bg-amber-300 text-slate-900"
                    )}
                  >
                    <Save size={15} />
                    <span>{isSaving ? 'در حال ثبت...' : isSavedRecently ? 'ثبت شد ✓' : 'ثبت نهایی'}</span>
                  </button>
                </div>
              </div>

              {/* If representative manages multiple classes, provide 1-tap quick pills */}
              {representativePrograms.length > 1 && (
                <div className="pt-2 border-t border-white/20 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  <span className="text-[11px] font-bold text-emerald-100 shrink-0">کلاس‌های تحت نمایندگی:</span>
                  {representativePrograms.map(p => {
                    const isSelected = p.id === selectedProgramId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedProgramId(p.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer",
                          isSelected 
                            ? "bg-white text-emerald-900 shadow-xs" 
                            : "bg-white/15 text-white hover:bg-white/25"
                        )}
                      >
                        {p.title} {p.grade ? `(${p.grade})` : ''}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Top Controls: Program Selector & Date Picker */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Class Program Selector */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <BookOpen size={15} className="text-indigo-600" />
                  <span>{isRepresentative ? 'کلاس تحت نمایندگی شما:' : 'انتخاب کلاس درس:'}</span>
                </label>
                {isRepresentative && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    منحصراً کلاس‌های تحت نمایندگی ({representativePrograms.length})
                  </span>
                )}
              </div>
              <select
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
                className="w-full p-2.5 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-800 cursor-pointer"
              >
                {isOrdinaryStudent ? (
                  studentSelfReportingPrograms.length === 0 ? (
                    <option value="" disabled>هیچ کلاس خوداظهاری برای شما فعال نشده است</option>
                  ) : (
                    studentSelfReportingPrograms.map(p => {
                      const titleStr = p.title || p.name || 'کلاس بدون عنوان';
                      const gradeStr = p.grade ? ` (${p.grade})` : '';
                      return (
                        <option key={p.id} value={p.id}>
                          {titleStr}{gradeStr} (کلاس خوداظهاری)
                        </option>
                      );
                    })
                  )
                ) : isRepresentative ? (
                  representativePrograms.length === 0 ? (
                    <option value="" disabled>هیچ کلاسی تحت نمایندگی شما یافت نشد</option>
                  ) : (
                    representativePrograms.map(p => {
                      const titleStr = p.title || p.name || 'کلاس بدون عنوان';
                      const gradeStr = p.grade ? ` (${p.grade})` : '';
                      const teacherStr = (p.teacher || p.teacherName) ? ` - استاد ${p.teacher || p.teacherName}` : '';
                      return (
                        <option key={p.id} value={p.id}>
                          {titleStr}{gradeStr}{teacherStr}
                        </option>
                      );
                    })
                  )
                ) : (
                  programs.map(p => {
                    const titleStr = p.title || p.name || 'کلاس بدون عنوان';
                    const gradeStr = p.grade ? ` (${p.grade})` : '';
                    const teacherStr = (p.teacher || p.teacherName) ? ` - استاد ${p.teacher || p.teacherName}` : '';
                    return (
                      <option key={p.id} value={p.id}>
                        {titleStr}{gradeStr}{teacherStr}
                      </option>
                    );
                  })
                )}
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

          {/* Informational banner for Grade Supervisor when in View-Only mode */}
          {isAttendanceReadOnlyForGradeSupervisor && (
            <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl flex items-center gap-2.5 text-xs text-amber-950 font-bold shadow-2xs">
              <AlertCircle size={18} className="text-amber-600 shrink-0" />
              <span>حالت فقط مشاهده: ثبت و ویرایش جلسات حضور و غیاب توسط مسئول محترم آموزش برای اساتید پایه غیرفعال شده است. شما می‌توانید اطلاعات، آمار، کارنامه و گزارش‌ها را مشاهده فرمایید.</span>
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
                      disabled={isDateLockedForRepresentative || isAttendanceReadOnlyForGradeSupervisor}
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
                        (isDateLockedForRepresentative || isAttendanceReadOnlyForGradeSupervisor) && "opacity-50 cursor-not-allowed"
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
                        (isDateLockedForRepresentative || isCancelled || isAttendanceReadOnlyForGradeSupervisor) && "opacity-50 cursor-not-allowed"
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
                  {!isDateLockedForRepresentative && !isAttendanceReadOnlyForGradeSupervisor && (
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
                    disabled={isSaving || !currentProgram || isDateLockedForRepresentative || isAttendanceReadOnlyForGradeSupervisor}
                    className={cn(
                      "px-4 py-2 rounded-xl font-black text-xs transition-all shadow-sm cursor-pointer flex items-center gap-1.5 shrink-0",
                      isDateLockedForRepresentative || isAttendanceReadOnlyForGradeSupervisor
                        ? "bg-slate-200 text-slate-500 cursor-not-allowed shadow-none"
                        : isSavedRecently 
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200" 
                          : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-indigo-200"
                    )}
                  >
                    <Save size={15} />
                    <span>
                      {isAttendanceReadOnlyForGradeSupervisor
                        ? 'حالت فقط مشاهده'
                        : isSaving 
                          ? 'در حال ثبت...' 
                          : 'ثبت نهایی حضور و غیاب'}
                    </span>
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
                              disabled={isDateLockedForRepresentative || isAttendanceReadOnlyForGradeSupervisor}
                              onClick={() => handleSetStudentStatus(student.id, 'present')}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer",
                                currentStatus === 'present'
                                  ? "bg-emerald-600 text-white shadow-xs scale-102"
                                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60",
                                (isDateLockedForRepresentative || isAttendanceReadOnlyForGradeSupervisor) && "opacity-60 cursor-not-allowed"
                              )}
                            >
                              <CheckCircle2 size={12} />
                              <span>حاضر</span>
                            </button>

                            {/* 2. Absent */}
                            <button
                              type="button"
                              disabled={isDateLockedForRepresentative || isAttendanceReadOnlyForGradeSupervisor}
                              onClick={() => handleSetStudentStatus(student.id, 'absent')}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer",
                                currentStatus === 'absent'
                                  ? "bg-rose-600 text-white shadow-xs scale-102"
                                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60",
                                (isDateLockedForRepresentative || isAttendanceReadOnlyForGradeSupervisor) && "opacity-60 cursor-not-allowed"
                              )}
                            >
                              <XCircle size={12} />
                              <span>غایب</span>
                            </button>

                            {/* 3. Late */}
                            <button
                              type="button"
                              disabled={isDateLockedForRepresentative || isAttendanceReadOnlyForGradeSupervisor}
                              onClick={() => handleSetStudentStatus(student.id, 'late')}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer",
                                currentStatus === 'late'
                                  ? "bg-amber-500 text-white shadow-xs scale-102"
                                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60",
                                (isDateLockedForRepresentative || isAttendanceReadOnlyForGradeSupervisor) && "opacity-60 cursor-not-allowed"
                              )}
                            >
                              <Clock3 size={12} />
                              <span>تاخیر</span>
                            </button>

                            {/* 4. Excused - ONLY for Education Manager & Super Admin (and Grade Supervisor if editable) */}
                            {(isSuperAdmin || isEducationManager || (isGradeSupervisor && !isAttendanceReadOnlyForGradeSupervisor)) && (
                              <button
                                type="button"
                                disabled={isDateLockedForRepresentative || isAttendanceReadOnlyForGradeSupervisor}
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
                            {(isSuperAdmin || isEducationManager || (isGradeSupervisor && !isAttendanceReadOnlyForGradeSupervisor)) && (
                              <button
                                type="button"
                                disabled={isDateLockedForRepresentative || isAttendanceReadOnlyForGradeSupervisor}
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
                          {(isSuperAdmin || isEducationManager || (isGradeSupervisor && !isAttendanceReadOnlyForGradeSupervisor)) && (
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
                disabled={isSaving || !currentProgram || isDateLockedForRepresentative || isAttendanceReadOnlyForGradeSupervisor}
                className={cn(
                  "w-full sm:w-auto px-8 py-2.5 rounded-xl font-black text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-2",
                  isDateLockedForRepresentative || isAttendanceReadOnlyForGradeSupervisor
                    ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                    : isSavedRecently 
                      ? "bg-emerald-600 text-white shadow-emerald-200" 
                      : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-indigo-200"
                )}
              >
                <Save size={16} />
                <span>
                  {isAttendanceReadOnlyForGradeSupervisor 
                    ? 'حالت فقط مشاهده (ویرایش محدود شده توسط آموزش)' 
                    : isSaving 
                      ? 'در حال ثبت...' 
                      : 'ثبت نهایی حضور و غیاب و توضیحات'}
                </span>
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
          {/* Summary Metric Cards - 4 Modern Sleek Boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {/* 1. Total Held Sessions */}
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white p-4 rounded-2xl border border-indigo-500/30 shadow-md shadow-indigo-950/20 group hover:border-indigo-400/50 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-indigo-200/90 block">کل جلسات {isOrdinaryStudent ? 'برگزار شده' : 'تشکیل شده'}</span>
                  <div className="text-2xl font-black font-mono text-white mt-1 flex items-baseline gap-1">
                    <span>{studentMetrics.heldSessions}</span>
                    <span className="text-[10px] text-indigo-300 font-medium font-vazir">جلسه</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner group-hover:scale-105 transition-transform">
                  <BookOpen size={20} />
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-indigo-200/70">
                <span>وضعیت حضور: {studentMetrics.presents} جلسه حاضر</span>
                <span className="font-mono text-emerald-300 font-bold">
                  {studentMetrics.heldSessions > 0 ? `${Math.round((studentMetrics.presents / studentMetrics.heldSessions) * 100)}%` : '۱۰۰%'}
                </span>
              </div>
            </div>

            {/* 2. Total Absences (Excused & Unexcused) */}
            <div className="relative overflow-hidden bg-gradient-to-br from-rose-950/90 via-slate-900 to-rose-900/80 text-white p-4 rounded-2xl border border-rose-500/30 shadow-md shadow-rose-950/20 group hover:border-rose-400/50 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-rose-200/90 block">غیبت‌ها (اعم از موجه و غیرموجه)</span>
                  <div className="text-2xl font-black font-mono text-white mt-1 flex items-baseline gap-1">
                    <span>{studentMetrics.totalAbsences}</span>
                    <span className="text-[10px] text-rose-300 font-medium font-vazir">جلسه</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-300 shadow-inner group-hover:scale-105 transition-transform">
                  <UserX size={20} />
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-rose-200/80">
                <span>غیرموجه: <strong className="text-rose-300 font-mono">{studentMetrics.absents}</strong></span>
                <span>موجه: <strong className="text-indigo-300 font-mono">{studentMetrics.excused}</strong></span>
              </div>
            </div>

            {/* 3. Total Delays */}
            <div className="relative overflow-hidden bg-gradient-to-br from-amber-950/90 via-slate-900 to-amber-900/80 text-white p-4 rounded-2xl border border-amber-500/30 shadow-md shadow-amber-950/20 group hover:border-amber-400/50 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-amber-200/90 block">تأخیرها</span>
                  <div className="text-2xl font-black font-mono text-white mt-1 flex items-baseline gap-1">
                    <span>{studentMetrics.lates}</span>
                    <span className="text-[10px] text-amber-300 font-medium font-vazir">مورد</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shadow-inner group-hover:scale-105 transition-transform">
                  <Clock3 size={20} />
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-amber-200/70">
                <span>ثبت تاخیر در ورود به کلاس</span>
                <span className="font-mono text-amber-300 font-bold">{studentMetrics.lates > 0 ? 'موجب کسر انضباط' : 'بدون تاخیر'}</span>
              </div>
            </div>

            {/* 4. Educational Warnings */}
            <div className="relative overflow-hidden bg-gradient-to-br from-purple-950/90 via-slate-900 to-rose-950/90 text-white p-4 rounded-2xl border border-purple-500/30 shadow-md shadow-purple-950/20 group hover:border-purple-400/50 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-purple-200/90 block">اخطارهای آموزشی</span>
                  <div className="text-2xl font-black font-mono text-white mt-1 flex items-baseline gap-1">
                    <span>{studentMetrics.warnings}</span>
                    <span className="text-[10px] text-purple-300 font-medium font-vazir">اخطار</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shadow-inner group-hover:scale-105 transition-transform">
                  <AlertTriangle size={20} />
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-purple-200/80">
                <span>تنها اخطارهای قطعی ثبت شده</span>
                <span className={cn("font-bold font-mono", studentMetrics.warnings > 0 ? "text-rose-400" : "text-emerald-400")}>
                  {studentMetrics.warnings > 0 ? 'نیازمند پیگیری' : 'بدون اخطار'}
                </span>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            {/* Top Toolbar: Course Categories & View Mode Selectors for Level 2 Officials */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              {/* Category Selector (اصلی، مشاوره، پنج‌شنبه، تجمیعی) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                <span className="text-xs font-black text-slate-800 shrink-0 flex items-center gap-1 ml-1">
                  <Layers size={14} className="text-indigo-600" />
                  <span>نوع درس:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setReportCourseCategory('all')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 border",
                    reportCourseCategory === 'all'
                      ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                  )}
                >
                  همه دروس (تجمیعی)
                </button>
                <button
                  type="button"
                  onClick={() => setReportCourseCategory('academic')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 border",
                    reportCourseCategory === 'academic'
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                      : "bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200"
                  )}
                >
                  دروس اصلی (فقه و اصول)
                </button>
                <button
                  type="button"
                  onClick={() => setReportCourseCategory('counseling')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 border",
                    reportCourseCategory === 'counseling'
                      ? "bg-purple-600 text-white border-purple-600 shadow-2xs"
                      : "bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-200"
                  )}
                >
                  دروس مشاوره و تهذیب
                </button>
                <button
                  type="button"
                  onClick={() => setReportCourseCategory('thursday')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 border",
                    reportCourseCategory === 'thursday'
                      ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                      : "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200"
                  )}
                >
                  جلسات پنج‌شنبه‌ها
                </button>
              </div>

              {/* View Mode Selector (بر اساس طلبه، به ترتیب کلاس، تجمیعی خلاصه) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                <span className="text-xs font-black text-slate-800 shrink-0 flex items-center gap-1 ml-1">
                  <SlidersHorizontal size={14} className="text-indigo-600" />
                  <span>چیدمان:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setReportViewMode('student')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 border flex items-center gap-1",
                    reportViewMode === 'student'
                      ? "bg-indigo-700 text-white border-indigo-700 shadow-2xs"
                      : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
                  )}
                  title="نمایش غیبت‌های هر طلبه کنار هم"
                >
                  <User size={13} />
                  <span>بر اساس طلبه</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReportViewMode('class')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 border flex items-center gap-1",
                    reportViewMode === 'class'
                      ? "bg-emerald-700 text-white border-emerald-700 shadow-2xs"
                      : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
                  )}
                  title="به ترتیب کلاس‌ها (مثلاً اول اصول استاد احمدی، سپس فقه و ...)"
                >
                  <BookOpen size={13} />
                  <span>تفکیک به ترتیب کلاس‌ها</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReportViewMode('summary')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 border flex items-center gap-1",
                    reportViewMode === 'summary'
                      ? "bg-teal-700 text-white border-teal-700 shadow-2xs"
                      : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
                  )}
                  title="یک سطر برای هر طلبه همراه با خلاصه غیبت در تمامی کلاس‌ها"
                >
                  <Layers size={13} />
                  <span>تجمیعی مختصر</span>
                </button>
              </div>
            </div>

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
                  {isRepresentative ? (
                    <>
                      {representativePrograms.length > 1 && <option value="all">همه کلاس‌های تحت نمایندگی شما</option>}
                      {representativePrograms.map(p => (
                        <option key={p.id} value={p.id}>{p.title} {p.grade ? `(${p.grade})` : ''}</option>
                      ))}
                    </>
                  ) : (
                    <>
                      <option value="all">همه کلاس‌های درسی</option>
                      {programs.map(p => (
                        <option key={p.id} value={p.id}>{p.title} {p.grade ? `(${p.grade})` : ''}</option>
                      ))}
                    </>
                  )}
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

          {/* Student Analytics Table / View Modes */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-2">
                <Users size={16} className="text-indigo-600" />
                <span>
                  {reportViewMode === 'class' 
                    ? 'گزارش غیبت‌ها به تفکیک و به ترتیب کلاس‌ها' 
                    : reportViewMode === 'summary' 
                    ? 'جدول تجمیعی خلاصه غیبت طلاب در تمامی کلاس‌ها' 
                    : 'جدول آماری وضعیت حضور و غیاب طلاب'}
                </span>
              </h3>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Default view toggle: Absents only vs All students */}
                <button
                  type="button"
                  onClick={() => setReportShowAllStudents(!reportShowAllStudents)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer",
                    reportShowAllStudents
                      ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                      : "bg-white hover:bg-indigo-50 text-indigo-700 border-indigo-200"
                  )}
                  title="تغییر حالت نمایش بین فقط غایبین و یا همه طلاب"
                >
                  <Users size={14} />
                  <span>{reportShowAllStudents ? 'نمایش همه طلاب (حاضر، غایب و تاخیر)' : 'نمایش فقط غایبین (پیش‌فرض)'}</span>
                </button>

                {/* Sort selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500">مرتب‌سازی:</span>
                  <select
                    value={reportSortBy}
                    onChange={(e) => setReportSortBy(e.target.value as 'absent' | 'class')}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="absent">بر اساس غیبت</option>
                    <option value="class">بر اساس نام کلاس / درس</option>
                  </select>
                </div>

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
                  <span>فقط مشمولین اخطار</span>
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

            {/* VIEW MODE 1: CLASS GROUPED (به ترتیب کلاس‌ها - مثلاً ابتدا اصول استاد احمدی، سپس فقه و ...) */}
            {reportViewMode === 'class' ? (
              <div className="p-4 space-y-6">
                {classGroupedReportList.length === 0 ? (
                  <div className="text-center py-10 space-y-2 text-slate-500">
                    <BookOpen size={32} className="mx-auto text-slate-300" />
                    <p className="text-xs font-bold">هیچ کلاسی با غایبین طبق فیلترهای انتخابی یافت نشد.</p>
                  </div>
                ) : (
                  classGroupedReportList.map(cGroup => (
                    <div key={cGroup.programId} className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white space-y-0">
                      {/* Class Group Banner Header */}
                      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <BookOpen size={16} className="text-amber-400 shrink-0" />
                          <span className="font-black text-xs sm:text-sm">کلاس: «{cGroup.programTitle}»</span>
                          {cGroup.grade && (
                            <span className="bg-white/10 text-indigo-200 px-2 py-0.5 rounded-lg text-[10px] font-bold border border-white/10">
                              پایه {cGroup.grade}
                            </span>
                          )}
                          {cGroup.teacherName && (
                            <span className="text-[11px] text-slate-300 font-medium">
                              • استاد: {cGroup.teacherName}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-bold bg-amber-400/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-400/30 self-start sm:self-auto">
                          تعداد طلاب: {cGroup.studentsList.length} نفر
                        </span>
                      </div>

                      {/* Class Student Sub-table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                              <th className="p-2.5">ردیف</th>
                              <th className="p-2.5">نام و نام خانوادگی طلبه</th>
                              <th className="p-2.5 text-center text-rose-700">غیبت غیرموجه</th>
                              <th className="p-2.5 text-center text-indigo-700">غیبت موجه</th>
                              <th className="p-2.5 text-center text-amber-700">تاخیر</th>
                              <th className="p-2.5 text-center text-rose-800">اخطار آموزشی</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {cGroup.studentsList.map((stItem, idx) => (
                              <tr key={stItem.student.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-2.5 font-mono text-slate-400 font-bold">{idx + 1}</td>
                                <td className="p-2.5 font-black text-slate-900">{stItem.student.name}</td>
                                <td className="p-2.5 text-center font-mono font-black text-rose-600">
                                  {stItem.absentCount > 0 ? (
                                    <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md">
                                      {stItem.absentCount} جلسه
                                    </span>
                                  ) : '0'}
                                </td>
                                <td className="p-2.5 text-center font-mono font-bold text-indigo-700">
                                  {stItem.excusedCount > 0 ? `${stItem.excusedCount} جلسه` : '0'}
                                </td>
                                <td className="p-2.5 text-center font-mono font-bold text-amber-700">
                                  {stItem.lateCount > 0 ? `${stItem.lateCount} مورد` : '0'}
                                </td>
                                <td className="p-2.5 text-center font-mono font-black text-rose-800">
                                  {stItem.warningCount > 0 ? (
                                    <span className="px-2 py-0.5 bg-rose-600 text-white rounded-md text-[10px]">
                                      {stItem.warningCount} اخطار
                                    </span>
                                  ) : '---'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : reportViewMode === 'summary' ? (
              /* VIEW MODE 2: AGGREGATED CONCISE SUMMARY (یک سطر برای هر طلبه + ستون خلاصه تفکیک دروس) */
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                      <th className="p-3">ردیف</th>
                      <th className="p-3">نام طلبه</th>
                      <th className="p-3">پایه</th>
                      <th className="p-3">خلاصه غیبت‌ها به تفکیک دروس</th>
                      <th className="p-3 text-center text-rose-700">کل غیرموجه</th>
                      <th className="p-3 text-center text-indigo-700">کل موجه</th>
                      <th className="p-3 text-center text-amber-700">تاخیرها</th>
                      <th className="p-3 text-center text-rose-800">اخطار آموزشی</th>
                      <th className="p-3 text-center">جزئیات</th>
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
                          <td className="p-3 font-black text-slate-900">{item.student.name}</td>
                          <td className="p-3 text-slate-600 font-bold">{item.student.grade || '---'}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {Object.entries((item as any).courseBreakdown || {}).length === 0 ? (
                                <span className="text-[11px] text-slate-400 font-medium">بدون غیبت</span>
                              ) : (
                                Object.entries((item as any).courseBreakdown || {}).map(([pTitle, counts]: [string, any]) => {
                                  if (counts.absent === 0 && counts.excused === 0) return null;
                                  return (
                                    <span key={pTitle} className="px-2 py-1 rounded-lg text-[10.5px] font-bold bg-slate-100 text-slate-800 border border-slate-200 flex items-center gap-1">
                                      <span>{pTitle}:</span>
                                      <span className="font-mono text-rose-700 font-black">{counts.absent} غیرموجه</span>
                                      {counts.excused > 0 && <span className="font-mono text-indigo-700 font-bold">(+{counts.excused} موجه)</span>}
                                    </span>
                                  );
                                })
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-center font-mono font-black text-rose-600">{item.absentCount}</td>
                          <td className="p-3 text-center font-mono font-bold text-indigo-700">{item.excusedCount}</td>
                          <td className="p-3 text-center font-mono font-bold text-amber-700">{item.lateCount}</td>
                          <td className="p-3 text-center font-mono font-black text-rose-800">{item.warningCount > 0 ? item.warningCount : '---'}</td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedStudentDrilldown(item)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-[11px] border border-indigo-200 transition-colors cursor-pointer"
                            >
                              ریز جلسات
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* VIEW MODE 3: DEFAULT PER-STUDENT LIST (بر اساس هر طلبه) */
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                      <th className="p-3">ردیف</th>
                      <th className="p-3">نام طلبه</th>
                      <th className="p-3">پایه</th>
                      <th className="p-3">کلاس / درس</th>
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
                          <td className="p-3 text-indigo-900 font-bold">
                            <span className="bg-indigo-50/80 text-indigo-800 px-2 py-0.5 rounded-lg border border-indigo-100 text-[11px]">
                              {(item as any).programTitleSummary || 'عمومی'}
                            </span>
                          </td>
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
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: REPRESENTATIVES LIST (لیست نمایندگان کلاس‌ها) */}
      {/* ===================================================================== */}
      {activeTab === 'representatives_list' && !isOrdinaryStudent && !isRepresentative && (
        <div className="space-y-6 font-vazir">
          {/* Summary Metric Cards Header */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-2xl border border-indigo-500/30 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-indigo-200/90 block">تعداد کل نمایندگان فعال</span>
                  <div className="text-2xl font-black font-mono text-white mt-1">
                    {representativesList.length} <span className="text-xs font-vazir text-indigo-300">نفر</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                  <Users size={20} />
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-white/10 text-[10.5px] text-indigo-200/70">
                <span>دارای دسترسی ثبت حضور و غیاب کلاس‌ها</span>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-900 text-white rounded-2xl border border-emerald-500/30 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-emerald-200/90 block">نمایندگان با تعهد بالای ۹۰٪</span>
                  <div className="text-2xl font-black font-mono text-white mt-1">
                    {representativesList.filter(r => r.commitmentPercent >= 90).length} <span className="text-xs font-vazir text-emerald-300">نفر</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                  <CheckCircle2 size={20} />
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-white/10 text-[10.5px] text-emerald-200/70">
                <span>ثبت به‌موقع حضور و غیاب در مهلت مقرر</span>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-br from-purple-950 via-slate-900 to-slate-900 text-white rounded-2xl border border-purple-500/30 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-purple-200/90 block">میانگین شاخص تعهد کل نمایندگان</span>
                  <div className="text-2xl font-black font-mono text-white mt-1">
                    {representativesList.length > 0 
                      ? `${Math.round(representativesList.reduce((acc, r) => acc + r.commitmentPercent, 0) / representativesList.length)}٪`
                      : '۱۰۰٪'}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
                  <Award size={20} />
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-white/10 text-[10.5px] text-purple-200/70">
                <span>نسبت جلسات ثبت‌شده به جلسات برگزار شده</span>
              </div>
            </div>
          </div>

          {/* Search & Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search size={15} className="absolute right-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="جستجوی نام نماینده، شماره همراه یا عنوان کلاس..."
                value={repSearchQuery}
                onChange={(e) => setRepSearchQuery(e.target.value)}
                className="w-full pr-9 pl-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
              />
            </div>
            <span className="text-xs text-slate-500 font-bold self-end sm:self-center">
              نمایش {representativesList.length} نماینده کلاس
            </span>
          </div>

          {/* Representatives Cards / Table List */}
          {representativesList.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3">
              <Users size={48} className="mx-auto text-slate-300" />
              <h3 className="text-base font-black text-slate-800">هیچ نماینده‌ای یافت نشد</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                می‌توانید در بخش «برنامه‌های درسی»، با ویرایش مشخصات هر کلاس، نماینده کلاس مربوطه را تعیین نمایید.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {representativesList.map(rep => {
                const noteVal = repNotesMap[rep.id] || '';
                return (
                  <div key={rep.id} className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4 hover:border-indigo-200 transition-all">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-3">
                      {/* Rep Info & Phone Number with Copy Button */}
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center font-black text-indigo-700 text-sm shrink-0">
                          <UserCheck size={22} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-black text-slate-900">{rep.name}</h3>
                            {rep.grade && (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-lg border border-slate-200">
                                {rep.grade}
                              </span>
                            )}
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-lg border border-indigo-100">
                              نماینده کلاس
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-1 flex-wrap">
                            {rep.nationalId && <span>کد ملی / شناسه: <strong className="font-mono text-slate-700">{rep.nationalId}</strong></span>}
                            {/* Copyable Phone Button */}
                            {rep.mobile ? (
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(rep.mobile || '');
                                  showToast(`شماره همراه ${rep.name} (${rep.mobile}) کپی گردید.`);
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[11px] font-bold border border-emerald-200 transition-all cursor-pointer shadow-2xs"
                                title="کلیک کنید تا شماره همراه کپی شود"
                              >
                                <PhoneCall size={12} className="text-emerald-600" />
                                <span className="font-mono dir-ltr">{rep.mobile}</span>
                                <Copy size={12} className="text-emerald-600 shrink-0 ml-0.5" />
                              </button>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">بدون شماره همراه ثبت‌شده</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Commitment Rating Badge */}
                      <div className="flex items-center gap-3 self-start lg:self-center bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 block">میزان تعهد نماینده به ثبت:</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-lg text-xs font-black border font-mono",
                              rep.commitmentPercent >= 90 
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : rep.commitmentPercent >= 70
                                ? "bg-amber-100 text-amber-900 border-amber-300"
                                : "bg-rose-100 text-rose-800 border-rose-300"
                            )}>
                              {rep.commitmentPercent}٪ تعهد
                            </span>
                            <span className="text-[11px] text-slate-600 font-bold font-mono">
                              ({rep.recordedSessionsCount} از {rep.totalSessionsExpected} جلسه)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Side-by-side Managed Classes List */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <BookOpen size={14} className="text-indigo-600" />
                        <span>کلاس‌های تحت مدیریت این نماینده ({rep.managedClasses.length} کلاس):</span>
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        {rep.managedClasses.map(p => (
                          <div
                            key={p.id}
                            className="p-2 px-3 rounded-xl bg-indigo-50/80 border border-indigo-200 text-indigo-950 text-xs font-bold flex items-center gap-2 shadow-2xs"
                          >
                            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                            <span>{p.title}</span>
                            {p.grade && (
                              <span className="px-1.5 py-0.5 bg-indigo-200/80 text-indigo-900 text-[10px] font-extrabold rounded-md">
                                {p.grade}
                              </span>
                            )}
                            {(p.teacher || (p as any).teacherName) && (
                              <span className="text-[10px] text-indigo-700 font-medium">
                                (استاد {p.teacher || (p as any).teacherName})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Education Manager Editable Notes Area (Saved to DB) */}
                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <FileText size={13} className="text-indigo-600" />
                          <span>توضیحات و یادداشت مسئول آموزش درباره این نماینده:</span>
                        </label>
                        <span className="text-[10px] text-slate-400 font-normal">
                          (ذخیره‌سازی در دیتابیس)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <textarea
                          rows={2}
                          placeholder="توضیحات انضباطی، تذکرات، نحوه عملکرد یا پیگیری‌های انجام‌شده برای این نماینده را بنویسید..."
                          className="flex-1 p-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/60 focus:bg-white transition-all font-medium text-slate-800 leading-relaxed resize-y"
                          value={noteVal}
                          onChange={(e) => setRepNotesMap({ ...repNotesMap, [rep.id]: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRepNote(rep.id, repNotesMap[rep.id] || '')}
                          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer flex items-center gap-1 shrink-0 self-end"
                        >
                          <Save size={14} />
                          <span>ثبت توضیحات</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
                {isGradeSupervisor && (
                  <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 text-[11px] font-bold">
                    {settings.allowGradeProfessorSettingsEdit 
                      ? '✓ شما به عنوان استاد پایه دسترسی ویرایش به تنظیمات حضور و غیاب را دارید.' 
                      : '🔒 شما به عنوان استاد پایه فقط مجاز به مشاهده تنظیمات حضور و غیاب هستید.'}
                  </div>
                )}

                <fieldset disabled={isSettingsReadOnly} className="space-y-4">
                  {/* 1. Class Representative Settings Section */}
                  <div className="p-3.5 bg-indigo-50/70 rounded-2xl border border-indigo-100 space-y-2">
                    <h4 className="font-black text-indigo-950 text-xs flex items-center gap-1.5">
                      <UserCheck size={15} className="text-indigo-600" />
                      <span>تنظیمات ثبت حضور و غیاب توسط نماینده کلاس:</span>
                    </h4>
                    <div>
                      <label className="block font-bold text-slate-800 text-[11px] mb-1">
                        مهلت ثبت و ویرایش توسط نماینده کلاس (روز):
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={settings.representativeEditWindowDays}
                        onChange={(e) => setSettings({ ...settings, representativeEditWindowDays: parseInt(e.target.value) || 7 })}
                        className="w-full p-2 border border-indigo-200 rounded-xl bg-white font-mono font-bold text-xs"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        نماینده کلاس تا این تعداد روز فرصت ثبت و ویرایش دارد. پس از آن تنها مسئول آموزش مجاز خواهد بود.
                      </p>
                    </div>
                  </div>

                  {/* 2. Isolated Student Self-Reporting Settings Section */}
                  <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-2.5">
                    <h4 className="font-black text-emerald-950 text-xs flex items-center gap-1.5">
                      <CheckCircle2 size={15} className="text-emerald-600" />
                      <span>تنظیمات حضور و غیاب خوداظهاری طلاب (منفک از نماینده):</span>
                    </h4>
                    <div>
                      <label className="block font-bold text-slate-800 text-[11px] mb-1">
                        مهلت ثبت خوداظهاری توسط خود طلبه (روز):
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={(settings as any).studentSelfReportingWindowDays || 3}
                        onChange={(e) => setSettings({ ...settings, studentSelfReportingWindowDays: parseInt(e.target.value) || 3 } as any)}
                        className="w-full p-2 border border-emerald-200 rounded-xl bg-white font-mono font-bold text-xs"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        طلبه برای کلاس‌های دارای نوع «خوداظهاری» تا این تعداد روز پس از جلسه فرصت اعلام دارد.
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-emerald-200/60">
                      <span className="text-[11px] font-bold text-emerald-900">امکان ویرایش ثبت خوداظهاری طلبه در مهلت مقرر:</span>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={(settings as any).allowStudentSelfReportingEdit ?? true}
                          onChange={(e) => setSettings({ ...settings, allowStudentSelfReportingEdit: e.target.checked } as any)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>

                    <div className="pt-2 border-t border-emerald-200/60">
                      <label className="block font-bold text-emerald-950 text-[11px] mb-1">
                        نحوه محاسبه «عدم ثبت خوداظهاری» توسط طلبه در آمار (منفک از نماینده):
                      </label>
                      <select
                        value={settings.unrecordedSelfReportingAs || 'absent'}
                        onChange={(e) => setSettings({ ...settings, unrecordedSelfReportingAs: e.target.value as any })}
                        className="w-full p-2 border border-emerald-200 rounded-xl bg-white font-bold text-xs"
                      >
                        <option value="absent">به عنوان «غیبت غیرموجه» محاسبه شود (پیش‌فرض)</option>
                        <option value="present">به عنوان «حضور» محاسبه شود</option>
                        <option value="unspecified">به عنوان «وضعیت نامشخص» درج شود</option>
                        <option value="late">به عنوان «تاخیر» محاسبه شود</option>
                      </select>
                      <p className="text-[10px] text-slate-500 mt-1">
                        چنانچه طلبه در مهلت خوداظهاری وضعیتی اعلام نکند، سیستم این حالت را ثبت می‌کند.
                      </p>
                    </div>
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

                  {/* Option for Education Manager / Admin to control Grade Professor Attendance Edit permission */}
                  {(isSuperAdmin || isEducationManager) && (
                    <div className="p-3 bg-purple-50/70 rounded-2xl border border-purple-200 flex items-center justify-between">
                      <div className="pl-2">
                        <div className="font-bold text-purple-900 text-xs">مجوز ثبت و ویرایش جلسات حضور و غیاب توسط اساتید پایه:</div>
                        <p className="text-[10px] text-purple-700 font-medium leading-relaxed mt-0.5">
                          در صورت فعال بودن، اساتید پایه می‌توانند حضور و غیاب کلاس‌های پایه خود را ثبت، ویرایش و موجه نمایند. در غیر این صورت، این بخش برای اساتید پایه فقط قابل مشاهده خواهد بود.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={settings.allowGradeProfessorAttendanceEdit || false}
                          onChange={(e) => setSettings({ ...settings, allowGradeProfessorAttendanceEdit: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                  )}

                  {/* Option for Education Manager / Admin to control Grade Professor Settings Edit permissions */}
                  {(isSuperAdmin || isEducationManager) && (
                    <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center justify-between">
                      <div className="pl-2">
                        <div className="font-bold text-indigo-900 text-xs">دسترسی اساتید پایه به تغییر همین صفحه تنظیمات:</div>
                        <p className="text-[10px] text-indigo-700 font-medium leading-relaxed mt-0.5">
                          اساتید پایه بتوانند تنظیمات حضور غیاب را تغییر دهند (در غیر این صورت فقط مشاهده می‌کنند).
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={settings.allowGradeProfessorSettingsEdit || false}
                          onChange={(e) => setSettings({ ...settings, allowGradeProfessorSettingsEdit: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                  )}
                </fieldset>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                {isSettingsReadOnly ? (
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
                  >
                    بستن صفحه تنظیمات
                  </button>
                ) : (
                  <>
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
                  </>
                )}
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

      {/* ========================================================================= */}
      {/* Modal 6: Quick Class Status Change Modal (پایش کارتی و تغییر مستقیم وضعیت کارت) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {quickStatusModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-vazir" dir="rtl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <SlidersHorizontal size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      تغییر وضعیت کارت: {quickStatusModal.prog.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      تاریخ جلسه: {selectedDate} • پایه: {quickStatusModal.prog.grade || 'عمومی'} • استاد: {quickStatusModal.prog.teacherName || quickStatusModal.prog.teacher || 'مشخص‌نشده'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickStatusModal(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-xl cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Status Action Options */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-700">
                  یکی از وضعیت‌های زیر را برای کارت این کلاس در تاریخ امروز اعمال کنید:
                </p>

                {/* Option 1: Mark Cancelled (Brown/Cream) */}
                <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#5C4027] flex items-center gap-1.5">
                      <XCircle size={15} />
                      <span>اعلام عدم تشکیل / تعطیلی جلسه (کارت کرمی)</span>
                    </span>
                    <button
                      type="button"
                      disabled={quickIsSubmitting}
                      onClick={() => handleQuickMarkCancelled(quickStatusModal.prog, quickCancelReason)}
                      className="px-3.5 py-1.5 bg-[#5C4027] hover:bg-[#47311D] text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      ثبت تعطیلی
                    </button>
                  </div>
                  <input
                    type="text"
                    value={quickCancelReason}
                    onChange={(e) => setQuickCancelReason(e.target.value)}
                    placeholder="علت عدم تشکیل (مثلاً کسالت استاد، تعطیلی رسمی، هماهنگی قبلی)..."
                    className="w-full px-3 py-2 text-xs border border-amber-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                  />
                </div>

                {/* Option 2: Mark All Present (Green) */}
                <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/50 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 size={15} className="text-emerald-600" />
                      <span>ثبت سریع حضور کامل تمام طلاب (کارت سبز)</span>
                    </span>
                    <p className="text-[10.5px] text-emerald-700 font-medium mt-0.5">
                      ثبت حضور ۱۰۰٪ برای کلیه طلاب کلاس بدون نیاز به علامت‌زدن تک‌تک
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={quickIsSubmitting}
                    onClick={() => handleQuickMarkAllPresent(quickStatusModal.prog)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
                  >
                    ثبت حضور همه
                  </button>
                </div>

                {/* Option 3: Substitute Teacher (Blue) */}
                <div className="p-3.5 rounded-2xl border border-blue-200 bg-blue-50/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                      <UserCheck2 size={15} className="text-blue-600" />
                      <span>ثبت استاد جایگزین (کارت آبی)</span>
                    </span>
                    <button
                      type="button"
                      disabled={quickIsSubmitting}
                      onClick={() => handleQuickMarkSubstitute(quickStatusModal.prog, quickSubTeacherName, quickSubNotes)}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      ثبت جایگزین
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={quickSubTeacherName}
                      onChange={(e) => setQuickSubTeacherName(e.target.value)}
                      placeholder="نام استاد جایگزین..."
                      className="w-full px-3 py-1.5 text-xs border border-blue-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                    />
                    <input
                      type="text"
                      value={quickSubNotes}
                      onChange={(e) => setQuickSubNotes(e.target.value)}
                      placeholder="توضیحات (اختیاری)..."
                      className="w-full px-3 py-1.5 text-xs border border-blue-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                    />
                  </div>
                </div>

                {/* Option 4: Reset back to Pending (Red) */}
                <div className="p-3.5 rounded-2xl border border-rose-200 bg-rose-50/50 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-black text-rose-900 flex items-center gap-1.5">
                      <AlertCircle size={15} className="text-rose-600" />
                      <span>بازنشانی به حالت انجام‌نشده (کارت قرمز)</span>
                    </span>
                    <p className="text-[10.5px] text-rose-700 font-medium mt-0.5">
                      پاکسازی اطلاعات ثبت‌شده امروز و بازگرداندن کارت به وضعیت معوق
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={quickIsSubmitting}
                    onClick={() => handleQuickResetStatus(quickStatusModal.prog)}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
                  >
                    بازنشانی به قرمز
                  </button>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const progId = quickStatusModal.prog.id;
                    setQuickStatusModal(null);
                    setSelectedProgramId(progId);
                    setActiveTab('record');
                  }}
                  className="text-xs font-black text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer"
                >
                  <CheckSquare size={13} />
                  <span>ورود به فرم کامل حضور و غیاب دستی</span>
                </button>

                <button
                  type="button"
                  onClick={() => setQuickStatusModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
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
}
