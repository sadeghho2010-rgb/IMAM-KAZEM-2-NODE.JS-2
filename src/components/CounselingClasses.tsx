import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { localDb } from '../lib/localDb';
import { 
  Student, 
  Teacher, 
  CounselingSessionGrade, 
  CounselingScore, 
  Program, 
  Enrollment, 
  ClassSessionAttendance 
} from '../types';
import { 
  BookCheck, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  GraduationCap, 
  Award, 
  FileText, 
  Trash2, 
  Edit, 
  CheckCircle2, 
  X, 
  Layers, 
  BarChart2, 
  Printer, 
  Download, 
  MessageSquare,
  Sparkles,
  Info,
  Clock,
  ChevronDown,
  Check,
  AlertTriangle,
  CalendarDays,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  RefreshCw,
  Sliders,
  ArrowRight,
  Send,
  Eye,
  CheckSquare
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { ShamsiDatePicker } from './ShamsiDatePicker';
import { exportElementToPdf } from '../lib/pdfExport';

const SCORE_BADGES: Record<CounselingScore, { label: string; badgeClass: string; bg: string }> = {
  'الف': { label: 'الف (عالی)', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-black', bg: 'bg-emerald-50' },
  'ب': { label: 'ب (خوب)', badgeClass: 'bg-blue-100 text-blue-800 border-blue-300 font-black', bg: 'bg-blue-50' },
  'ج': { label: 'ج (متوسط)', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 font-black', bg: 'bg-amber-50' },
  'د': { label: 'د (ضعیف - نیازمند پیگیری)', badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-black', bg: 'bg-rose-50' },
  'غیبت': { label: 'غیبت در جلسه', badgeClass: 'bg-slate-200 text-slate-700 border-slate-300 font-black', bg: 'bg-slate-100' }
};

const DEFAULT_COURSES = [
  'مشاوره اصول',
  'مشاوره فقه',
  'مشاوره فلسفه و منطق',
  'مشاوره پژوهش و مقاله‌نویسی',
  'مشاوره تربیتی و اخلاق',
  'سایر کلاس‌های مشاوره'
];

interface StudentBatchRow {
  studentId: string;
  studentName: string;
  grade: string;
  participationScore: CounselingScore;
  researchScore: CounselingScore;
  counselorFeedback: string;
}

export default function CounselingClasses() {
  const { currentUser, isReadOnly, isSuperAdmin } = useAuth();

  const isEducationManager = currentUser?.role === 'education_manager' || currentUser?.role === 'education_officer' || currentUser?.username?.toUpperCase() === 'SHAH';
  const isResearchManager = currentUser?.role === 'research_manager' || currentUser?.username?.toUpperCase() === 'YAZDANI' || (currentUser?.name && currentUser.name.includes('پژوهش'));
  const isLevel3Student = currentUser?.level === 3;

  // Permissions check
  const canEditCounseling = useMemo(() => {
    if (isReadOnly) return false;
    if (isSuperAdmin || isResearchManager || currentUser?.level === 1) return true;
    const uAny = currentUser as any;
    if (isEducationManager && (uAny?.canEditCounseling || uAny?.permissions?.includes('counseling_edit'))) return true;
    return false;
  }, [currentUser, isReadOnly, isSuperAdmin, isResearchManager, isEducationManager]);

  // Data states
  const [grades, setGrades] = useState<CounselingSessionGrade[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<ClassSessionAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  // Active View Tab
  const [activeView, setActiveView] = useState<'status_monitoring' | 'professor_commitment' | 'sessions' | 'student_summary'>('status_monitoring');

  // Filters for Sessions view
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('all');

  // Filters for Status Monitoring view (Date range)
  const [statusFilterMode, setStatusFilterMode] = useState<'all' | 'evaluated' | 'not_evaluated'>('all');
  const [statusDisplayLayout, setStatusDisplayLayout] = useState<'two_column' | 'single_list'>('two_column');
  const [statusDatePreset, setStatusDatePreset] = useState<'current_month' | 'last_month' | 'all_year' | 'custom'>('current_month');
  const [statusStartDate, setStatusStartDate] = useState<string>('1403/07/01');
  const [statusEndDate, setStatusEndDate] = useState<string>('1403/12/29');

  // Modal 1: Batch Class Evaluation Modal State
  const [isClassBatchModalOpen, setIsClassBatchModalOpen] = useState(false);
  const [batchSelectedProgramId, setBatchSelectedProgramId] = useState<string>('');
  const [batchCourseTitle, setBatchCourseTitle] = useState<string>('');
  const [batchTeacherName, setBatchTeacherName] = useState<string>('');
  const [batchGrade, setBatchGrade] = useState<string>('پایه ۷');
  const [batchSessionDate, setBatchSessionDate] = useState<string>(() => new Date().toLocaleDateString('fa-IR'));
  const [batchSessionNumber, setBatchSessionNumber] = useState<string>('جلسه ۱');
  const [batchSessionTopic, setBatchSessionTopic] = useState<string>('');
  const [batchStudentsList, setBatchStudentsList] = useState<StudentBatchRow[]>([]);
  const [isSavingBatch, setIsSavingBatch] = useState(false);

  // Modal 2: Single Edit Modal State
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<CounselingSessionGrade | null>(null);
  const [formStudentId, setFormStudentId] = useState('');
  const [formTeacherName, setFormTeacherName] = useState('');
  const [formCourseTitle, setFormCourseTitle] = useState(DEFAULT_COURSES[0]);
  const [formSessionDate, setFormSessionDate] = useState(() => new Date().toLocaleDateString('fa-IR'));
  const [formSessionNumber, setFormSessionNumber] = useState('جلسه ۱');
  const [formParticipationScore, setFormParticipationScore] = useState<CounselingScore>('الف');
  const [formResearchScore, setFormResearchScore] = useState<CounselingScore>('الف');
  const [formCounselorFeedback, setFormCounselorFeedback] = useState('');

  // Modal 3: Teacher History Detail Drawer/Modal
  const [selectedTeacherForHistory, setSelectedTeacherForHistory] = useState<string | null>(null);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [fetchedGrades, fetchedStudents, fetchedTeachers, fetchedPrograms, fetchedEnrollments, fetchedAttendance] = await Promise.all([
        localDb.getDocs<CounselingSessionGrade>('counseling_session_grades'),
        localDb.getDocs<Student>('students'),
        localDb.getDocs<Teacher>('teachers'),
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<Enrollment>('enrollments'),
        localDb.getDocs<ClassSessionAttendance>('attendance')
      ]);

      setGrades(fetchedGrades.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setStudents(fetchedStudents.filter(s => s.isActive));
      setTeachers(fetchedTeachers.filter(t => t.isActive));
      setPrograms(fetchedPrograms || []);
      setEnrollments(fetchedEnrollments || []);
      setAttendanceSessions(fetchedAttendance || []);
    } catch (err) {
      console.error('Error fetching counseling grades:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered Counseling Programs (Classes) in the System
  const counselingClassesList = useMemo(() => {
    // 1. Programs explicitly marked with type='مشاوره' or title including 'مشاوره'
    const foundPrograms = programs.filter(p => 
      p.type === 'مشاوره' || 
      (p.title && p.title.includes('مشاوره')) ||
      (p.title && (p.title.includes('کارگاه') || p.title.includes('پژوهش') || p.title.includes('هدایت')))
    );

    // If programs exist, use them; otherwise provide default fallbacks
    if (foundPrograms.length > 0) {
      return foundPrograms;
    }

    // Fallback: create mock-like representation from default courses and active teachers
    return [
      { id: 'prog_counseling_1', title: 'مشاوره اصول و روش فقهی', teacher: 'استاد مشاور فقه و اصول', grade: 'پایه ۷', type: 'مشاوره' as any },
      { id: 'prog_counseling_2', title: 'مشاوره فقه و استنباط', teacher: 'استاد مشاور فقه', grade: 'پایه ۸', type: 'مشاوره' as any },
      { id: 'prog_counseling_3', title: 'مشاوره فلسفه و منطق', teacher: 'استاد مشاور فلسفه', grade: 'پایه ۹', type: 'مشاوره' as any },
      { id: 'prog_counseling_4', title: 'مشاوره پژوهش و مقاله‌نویسی', teacher: 'استاد مشاور پژوهش', grade: 'پایه ۱۰', type: 'مشاوره' as any }
    ] as Program[];
  }, [programs]);

  // Handle Class Selection in Batch Modal
  const handleBatchProgramChange = (programId: string) => {
    setBatchSelectedProgramId(programId);
    const selectedProg = counselingClassesList.find(p => p.id === programId);
    if (!selectedProg) return;

    setBatchCourseTitle(selectedProg.title);
    setBatchTeacherName(selectedProg.teacher || teachers[0]?.fullName || 'استاد مشاور');
    setBatchGrade(selectedProg.grade || 'پایه ۷');

    // Find enrolled students or grade students
    const enrolledStudentIds = new Set(
      enrollments.filter(e => e.programId === selectedProg.id).map(e => e.studentId)
    );

    let targetStudents = students.filter(s => enrolledStudentIds.has(s.id));
    if (targetStudents.length === 0 && selectedProg.grade) {
      targetStudents = students.filter(s => s.grade === selectedProg.grade);
    }
    if (targetStudents.length === 0) {
      targetStudents = students.slice(0, 15);
    }

    const rows: StudentBatchRow[] = targetStudents.map(s => ({
      studentId: s.id,
      studentName: s.name,
      grade: s.grade || selectedProg.grade || 'پایه ۷',
      participationScore: 'الف',
      researchScore: 'الف',
      counselorFeedback: ''
    }));

    setBatchStudentsList(rows);
  };

  // Open Batch Evaluation Modal for a Class
  const handleOpenClassBatchModal = (preselectedProgram?: Program) => {
    const prog = preselectedProgram || counselingClassesList[0];
    if (prog) {
      setBatchSelectedProgramId(prog.id);
      setBatchCourseTitle(prog.title);
      setBatchTeacherName(prog.teacher || teachers[0]?.fullName || 'استاد مشاور');
      setBatchGrade(prog.grade || 'پایه ۷');

      // Find enrolled students or grade students
      const enrolledStudentIds = new Set(
        enrollments.filter(e => e.programId === prog.id).map(e => e.studentId)
      );

      let targetStudents = students.filter(s => enrolledStudentIds.has(s.id));
      if (targetStudents.length === 0 && prog.grade) {
        targetStudents = students.filter(s => s.grade === prog.grade);
      }
      if (targetStudents.length === 0) {
        targetStudents = students.slice(0, 15);
      }

      const rows: StudentBatchRow[] = targetStudents.map(s => ({
        studentId: s.id,
        studentName: s.name,
        grade: s.grade || prog.grade || 'پایه ۷',
        participationScore: 'الف',
        researchScore: 'الف',
        counselorFeedback: ''
      }));

      setBatchStudentsList(rows);
    }

    setBatchSessionDate(new Date().toLocaleDateString('fa-IR'));
    setBatchSessionNumber('جلسه ۱');
    setBatchSessionTopic('');
    setIsClassBatchModalOpen(true);
  };

  // Quick Set All Scores in Batch Modal
  const handleBatchSetAllScores = (partScore: CounselingScore, resScore: CounselingScore) => {
    setBatchStudentsList(prev => prev.map(row => ({
      ...row,
      participationScore: partScore,
      researchScore: resScore
    })));
  };

  // Save Batch Evaluation
  const handleSaveBatchEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (batchStudentsList.length === 0) {
      alert('هیچ طلبه‌ای برای این کلاس انتخاب نشده است.');
      return;
    }

    setIsSavingBatch(true);
    try {
      const now = new Date().toISOString();
      const currentUserName = currentUser?.name || currentUser?.username || 'مسئول پژوهش';
      const currentUserRole = currentUser?.roleTitle || 'مسئول واحد پژوهش';

      const promises = batchStudentsList.map(row => {
        const payload: Partial<CounselingSessionGrade> = {
          studentId: row.studentId,
          studentName: row.studentName,
          grade: row.grade,
          counselorTeacherName: batchTeacherName.trim() || 'استاد مشاور',
          courseTitle: batchCourseTitle.trim() || 'کلاس مشاوره',
          sessionDate: batchSessionDate.trim() || new Date().toLocaleDateString('fa-IR'),
          sessionNumber: batchSessionNumber.trim() || 'جلسه ۱',
          participationScore: row.participationScore,
          researchScore: row.researchScore,
          counselorFeedback: row.counselorFeedback.trim() || (batchSessionTopic ? `موضوع: ${batchSessionTopic}` : ''),
          createdByName: currentUserName,
          createdByRole: currentUserRole,
          createdAt: now,
          updatedAt: now
        };
        return localDb.addDoc('counseling_session_grades', payload);
      });

      await Promise.all(promises);

      // Audit Log
      await localDb.addDoc('audit_logs', {
        action: 'ثبت گروهی ارزیابی کلاس مشاوره',
        details: `ثبت ارزیابی کلاسی جلسه مشاوره ${batchCourseTitle} (استاد ${batchTeacherName}) برای ${batchStudentsList.length} طلبه`,
        userId: currentUser?.id || 'sys',
        userName: currentUserName,
        createdAt: now
      });

      setIsClassBatchModalOpen(false);
      await fetchData();
      alert(`ارزیابی جلسه مشاوره برای ${batchStudentsList.length} طلبه با موفقیت ثبت گردید.`);
    } catch (err) {
      console.error('Error saving batch evaluation:', err);
      alert('خطا در ثبت گروهی ارزیابی کلاس مشاوره.');
    } finally {
      setIsSavingBatch(false);
    }
  };

  // Status Monitoring Computations (Evaluated vs Not Evaluated in date range)
  const statusAnalysis = useMemo(() => {
    // Filter grades in the chosen date range
    const filteredGradesInRange = grades.filter(g => {
      if (!g.sessionDate) return true;
      if (statusDatePreset === 'all_year') return true;
      return g.sessionDate >= statusStartDate && g.sessionDate <= statusEndDate;
    });

    const evaluatedClassesMap = new Map<string, {
      program: Program;
      gradesCount: number;
      studentsCount: number;
      dates: string[];
      teachers: string[];
      avgScores: { excellent: number; good: number; medium: number; weak: number; absent: number };
    }>();

    // Populate evaluated classes
    filteredGradesInRange.forEach(g => {
      const prog = counselingClassesList.find(p => p.title === g.courseTitle || (g.courseTitle && g.courseTitle.includes(p.title))) || {
        id: `prog_custom_${g.courseTitle}`,
        title: g.courseTitle,
        teacher: g.counselorTeacherName,
        grade: g.grade || 'پایه ۷',
        type: 'مشاوره' as any
      } as Program;

      const key = prog.title;
      if (!evaluatedClassesMap.has(key)) {
        evaluatedClassesMap.set(key, {
          program: prog,
          gradesCount: 0,
          studentsCount: 0,
          dates: [],
          teachers: [],
          avgScores: { excellent: 0, good: 0, medium: 0, weak: 0, absent: 0 }
        });
      }

      const item = evaluatedClassesMap.get(key)!;
      item.gradesCount++;
      if (g.sessionDate && !item.dates.includes(g.sessionDate)) item.dates.push(g.sessionDate);
      if (g.counselorTeacherName && !item.teachers.includes(g.counselorTeacherName)) item.teachers.push(g.counselorTeacherName);

      if (g.participationScore === 'الف') item.avgScores.excellent++;
      else if (g.participationScore === 'ب') item.avgScores.good++;
      else if (g.participationScore === 'ج') item.avgScores.medium++;
      else if (g.participationScore === 'د') item.avgScores.weak++;
      else if (g.participationScore === 'غیبت') item.avgScores.absent++;
    });

    const evaluatedList = Array.from(evaluatedClassesMap.values());
    const evaluatedTitles = new Set(evaluatedList.map(e => e.program.title));

    // Not evaluated classes: from counselingClassesList that have 0 evaluations in range
    const notEvaluatedList = counselingClassesList.filter(p => !evaluatedTitles.has(p.title)).map(p => {
      // Calculate students in this class
      const enrolledIds = new Set(enrollments.filter(e => e.programId === p.id).map(e => e.studentId));
      let stuCount = students.filter(s => enrolledIds.has(s.id)).length;
      if (stuCount === 0 && p.grade) {
        stuCount = students.filter(s => s.grade === p.grade).length;
      }
      return {
        program: p,
        studentsCount: stuCount || 10,
        teacher: p.teacher || 'نامشخص',
        grade: p.grade || 'عمومی'
      };
    });

    return {
      evaluatedList,
      notEvaluatedList,
      totalClasses: counselingClassesList.length,
      evaluatedCount: evaluatedList.length,
      notEvaluatedCount: notEvaluatedList.length
    };
  }, [grades, counselingClassesList, statusDatePreset, statusStartDate, statusEndDate, enrollments, students]);

  // Professor Commitment Analysis Computations
  const professorCommitmentStats = useMemo(() => {
    // Unique professors from counseling classes and teachers bank
    const teacherMap = new Map<string, {
      teacherName: string;
      counselingCourses: string[];
      grades: string[];
      totalHeldSessionsEstimated: number;
      totalRecordedSessions: number;
      uniqueDates: string[];
      totalStudentEvaluations: number;
      latestRecordedDate?: string;
      commitmentPercentage: number;
      status: 'excellent' | 'good' | 'medium' | 'weak' | 'none';
      recordedGradesList: CounselingSessionGrade[];
    }>();

    // 1. Initialize from counselingClassesList and teachers
    counselingClassesList.forEach(p => {
      const tName = p.teacher || 'استاد مشاور';
      if (!teacherMap.has(tName)) {
        teacherMap.set(tName, {
          teacherName: tName,
          counselingCourses: [],
          grades: [],
          totalHeldSessionsEstimated: 16, // Approx standard semester counseling sessions
          totalRecordedSessions: 0,
          uniqueDates: [],
          totalStudentEvaluations: 0,
          commitmentPercentage: 0,
          status: 'none',
          recordedGradesList: []
        });
      }
      const tData = teacherMap.get(tName)!;
      if (!tData.counselingCourses.includes(p.title)) tData.counselingCourses.push(p.title);
      if (p.grade && !tData.grades.includes(p.grade)) tData.grades.push(p.grade);
    });

    // 2. Aggregate from recorded grades
    grades.forEach(g => {
      const tName = g.counselorTeacherName || 'استاد مشاور';
      if (!teacherMap.has(tName)) {
        teacherMap.set(tName, {
          teacherName: tName,
          counselingCourses: [g.courseTitle],
          grades: [g.grade || 'پایه ۷'],
          totalHeldSessionsEstimated: 16,
          totalRecordedSessions: 0,
          uniqueDates: [],
          totalStudentEvaluations: 0,
          commitmentPercentage: 0,
          status: 'none',
          recordedGradesList: []
        });
      }

      const tData = teacherMap.get(tName)!;
      tData.totalStudentEvaluations++;
      tData.recordedGradesList.push(g);
      if (g.sessionDate && !tData.uniqueDates.includes(g.sessionDate)) {
        tData.uniqueDates.push(g.sessionDate);
      }
      if (!tData.latestRecordedDate || (g.sessionDate && g.sessionDate > tData.latestRecordedDate)) {
        tData.latestRecordedDate = g.sessionDate;
      }
    });

    // 3. Finalize percentages
    const result = Array.from(teacherMap.values()).map(t => {
      t.totalRecordedSessions = t.uniqueDates.length;
      const pct = Math.min(100, Math.round((t.totalRecordedSessions / Math.max(1, t.totalHeldSessionsEstimated)) * 100));
      t.commitmentPercentage = pct;

      if (t.totalRecordedSessions >= 14 || pct >= 85) t.status = 'excellent';
      else if (t.totalRecordedSessions >= 10 || pct >= 60) t.status = 'good';
      else if (t.totalRecordedSessions >= 5 || pct >= 30) t.status = 'medium';
      else if (t.totalRecordedSessions > 0) t.status = 'weak';
      else t.status = 'none';

      return t;
    });

    return result.sort((a, b) => b.commitmentPercentage - a.commitmentPercentage);
  }, [counselingClassesList, grades]);

  // Single Delete
  const handleDelete = async (id: string, studentName: string) => {
    if (isReadOnly) {
      alert('حساب شما در حالت صرفاً خواندنی قرار دارد.');
      return;
    }
    if (!window.confirm(`آیا از حذف ارزیابی و نمرات مشاوره مربوط به طلبه "${studentName}" اطمینان دارید؟`)) {
      return;
    }

    try {
      await localDb.deleteDoc('counseling_session_grades', id);
      await fetchData();
    } catch (err) {
      console.error('Error deleting counseling grade:', err);
      alert('خطا در حذف ارزیابی.');
    }
  };

  // Filtered Sessions List
  const filteredSessions = useMemo(() => {
    return grades.filter(g => {
      if (selectedGrade !== 'all' && g.grade !== selectedGrade) return false;
      if (selectedCourse !== 'all' && g.courseTitle !== selectedCourse) return false;
      if (selectedTeacher !== 'all' && g.counselorTeacherName !== selectedTeacher) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = (g.studentName || '').toLowerCase().includes(q) ||
                      (g.courseTitle || '').toLowerCase().includes(q) ||
                      (g.counselorTeacherName || '').toLowerCase().includes(q) ||
                      (g.counselorFeedback || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [grades, selectedGrade, selectedCourse, selectedTeacher, searchQuery]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-vazir" dir="rtl">
      
      {/* Top Banner & Action Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 shadow-xs">
            <BookCheck size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900">ارزیابی کلاس‌های مشاوره (پنل مسئول پژوهش)</h1>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black border border-amber-200">
                پایش جلسات و تعهد اساتید
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              ثبت کلاسی جلسات مشاوره، بررسی وضعیت برگزاری دوره‌ها و رصد درصد تعهد اساتید مشاور
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEditCounseling && (
            <button
              onClick={() => handleOpenClassBatchModal()}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl text-xs font-black shadow-md shadow-amber-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>ثبت جدید ارزیابی کلاس مشاوره (کلاسی)</span>
            </button>
          )}

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
            title="بروزرسانی داده‌ها"
          >
            <RefreshCw size={16} className={cn(loading && "animate-spin text-amber-600")} />
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveView('status_monitoring')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer",
            activeView === 'status_monitoring'
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          )}
        >
          <CalendarDays size={16} />
          <span>وضعیت و پایش ارزیابی کلاس‌ها</span>
          <span className={cn(
            "text-[10px] px-1.5 py-0.2 rounded-full font-black",
            activeView === 'status_monitoring' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
          )}>
            {statusAnalysis.evaluatedCount} از {statusAnalysis.totalClasses}
          </span>
        </button>

        <button
          onClick={() => setActiveView('professor_commitment')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer",
            activeView === 'professor_commitment'
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          )}
        >
          <TrendingUp size={16} />
          <span>سابقه ثبت و تعهد اساتید</span>
          <span className={cn(
            "text-[10px] px-1.5 py-0.2 rounded-full font-black",
            activeView === 'professor_commitment' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
          )}>
            {professorCommitmentStats.length} استاد
          </span>
        </button>

        <button
          onClick={() => setActiveView('sessions')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer",
            activeView === 'sessions'
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          )}
        >
          <FileText size={16} />
          <span>ریز جلسات و نمرات ثبت‌شده</span>
          <span className={cn(
            "text-[10px] px-1.5 py-0.2 rounded-full font-black",
            activeView === 'sessions' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
          )}>
            {grades.length}
          </span>
        </button>

        <button
          onClick={() => setActiveView('student_summary')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer",
            activeView === 'student_summary'
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          )}
        >
          <BarChart2 size={16} />
          <span>کارنامه و خلاصه عملکرد طلاب</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: STATUS & MONITORING (انجام شده / انجام نشده در بازه زمانی) */}
      {/* ========================================================================= */}
      {activeView === 'status_monitoring' && (
        <div className="space-y-6">
          {/* Filter & Date Range Toolbar */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Sliders size={18} className="text-amber-600 shrink-0" />
                <span className="text-xs font-black text-slate-800">بازه زمانی پایش ارزیابی کلاس‌ها:</span>
                
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setStatusDatePreset('current_month');
                      setStatusStartDate('1403/07/01');
                      setStatusEndDate('1403/07/30');
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-xl text-[11px] font-black transition-all cursor-pointer",
                      statusDatePreset === 'current_month' ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    ماه جاری (مهر)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusDatePreset('last_month');
                      setStatusStartDate('1403/08/01');
                      setStatusEndDate('1403/08/30');
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-xl text-[11px] font-black transition-all cursor-pointer",
                      statusDatePreset === 'last_month' ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    ماه گذشته (آبان)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusDatePreset('all_year');
                      setStatusStartDate('1403/07/01');
                      setStatusEndDate('1403/12/29');
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-xl text-[11px] font-black transition-all cursor-pointer",
                      statusDatePreset === 'all_year' ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    کل سال تحصیلی
                  </button>
                </div>
              </div>

              {/* View layout and filter selector */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setStatusFilterMode('all')}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      statusFilterMode === 'all' ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    همه کلاس‌ها ({statusAnalysis.totalClasses})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilterMode('evaluated')}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1",
                      statusFilterMode === 'evaluated' ? "bg-emerald-600 text-white shadow-xs" : "text-emerald-700 hover:text-emerald-900"
                    )}
                  >
                    <CheckCircle2 size={13} />
                    <span>انجام شده ({statusAnalysis.evaluatedCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilterMode('not_evaluated')}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1",
                      statusFilterMode === 'not_evaluated' ? "bg-rose-600 text-white shadow-xs" : "text-rose-700 hover:text-rose-900"
                    )}
                  >
                    <AlertTriangle size={13} />
                    <span>انجام نشده ({statusAnalysis.notEvaluatedCount})</span>
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setStatusDisplayLayout('two_column')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer",
                      statusDisplayLayout === 'two_column' ? "bg-white text-indigo-700 shadow-xs font-black" : "text-slate-500"
                    )}
                  >
                    نمایش دو ستونه
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusDisplayLayout('single_list')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer",
                      statusDisplayLayout === 'single_list' ? "bg-white text-indigo-700 shadow-xs font-black" : "text-slate-500"
                    )}
                  >
                    نمایش کارتی یکپارچه
                  </button>
                </div>
              </div>
            </div>

            {/* Custom Dates bar */}
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-500 font-bold">بازه دقیق:</span>
              <div className="flex items-center gap-2">
                <span>از تاریخ:</span>
                <input 
                  type="text" 
                  value={statusStartDate} 
                  onChange={(e) => {
                    setStatusStartDate(e.target.value);
                    setStatusDatePreset('custom');
                  }}
                  placeholder="1403/07/01" 
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold w-28 text-center"
                />
              </div>
              <div className="flex items-center gap-2">
                <span>تا تاریخ:</span>
                <input 
                  type="text" 
                  value={statusEndDate} 
                  onChange={(e) => {
                    setStatusEndDate(e.target.value);
                    setStatusDatePreset('custom');
                  }}
                  placeholder="1403/12/29" 
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold w-28 text-center"
                />
              </div>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 block">کل کلاس‌های مشاوره</span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">{statusAnalysis.totalClasses} کلاس</span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">در تمامی پایه‌های تحصیلی</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center font-black text-lg">
                <BookCheck size={24} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-emerald-200 shadow-xs flex items-center justify-between bg-emerald-50/20">
              <div>
                <span className="text-xs font-bold text-emerald-800 block">کلاس‌های ارزیابی‌شده</span>
                <span className="text-2xl font-black text-emerald-700 mt-1 block">{statusAnalysis.evaluatedCount} کلاس</span>
                <span className="text-[10px] text-emerald-600 mt-0.5 block font-bold">
                  {Math.round((statusAnalysis.evaluatedCount / Math.max(1, statusAnalysis.totalClasses)) * 100)}٪ پوشش در بازه انتخابی
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 size={24} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-rose-200 shadow-xs flex items-center justify-between bg-rose-50/20">
              <div>
                <span className="text-xs font-bold text-rose-800 block">کلاس‌های فاقد ارزیابی (انجام‌نشده)</span>
                <span className="text-2xl font-black text-rose-700 mt-1 block">{statusAnalysis.notEvaluatedCount} کلاس</span>
                <span className="text-[10px] text-rose-600 mt-0.5 block font-bold">نیازمند ثبت توسط استاد مشاور</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <AlertTriangle size={24} />
              </div>
            </div>
          </div>

          {/* Status Display Area */}
          {statusDisplayLayout === 'two_column' && statusFilterMode === 'all' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Column 1: Evaluated Classes */}
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-700" />
                    <h3 className="text-xs font-black text-emerald-950">
                      کلاس‌های ارزیابی‌شده در این بازه ({statusAnalysis.evaluatedCount})
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                    ثبت موفق
                  </span>
                </div>

                {statusAnalysis.evaluatedList.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-slate-300 text-xs text-slate-400">
                    در این بازه زمانی هیچ کلاسی ارزیابی نشده است.
                  </div>
                ) : (
                  statusAnalysis.evaluatedList.map(item => (
                    <div key={item.program.id} className="bg-white p-4 sm:p-5 rounded-3xl border border-emerald-100 shadow-xs hover:border-emerald-300 transition-all space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-slate-900">{item.program.title}</h4>
                            <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-md border border-emerald-200 font-bold">
                              {item.program.grade || 'پایه ۷'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                            <GraduationCap size={14} className="text-amber-600" />
                            <span>استاد مشاور: {item.teachers.join('، ') || item.program.teacher}</span>
                          </p>
                        </div>

                        <span className="text-xs font-black px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-xl border border-emerald-200 shrink-0">
                          {item.gradesCount} ارزیابی طلبه
                        </span>
                      </div>

                      {/* Dates and score breakdown */}
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                          <Calendar size={13} className="text-slate-400" />
                          <span>جلسات ثبت‌شده: {item.dates.join(' • ')}</span>
                        </div>

                        <div className="flex items-center gap-1 text-[10px] font-black">
                          <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">الف: {item.avgScores.excellent}</span>
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">ب: {item.avgScores.good}</span>
                          <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">ج: {item.avgScores.medium}</span>
                          {item.avgScores.weak > 0 && (
                            <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded border border-rose-200">د: {item.avgScores.weak}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Column 2: Not Evaluated Classes */}
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-rose-50 p-3.5 rounded-2xl border border-rose-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={18} className="text-rose-700" />
                    <h3 className="text-xs font-black text-rose-950">
                      کلاس‌های فاقد ارزیابی (انجام‌نشده) ({statusAnalysis.notEvaluatedCount})
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md">
                    نیازمند پیگیری
                  </span>
                </div>

                {statusAnalysis.notEvaluatedList.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-emerald-300 text-xs text-emerald-700 font-bold">
                    🎉 کلیه کلاس‌های مشاوره در این بازه زمانی دارای ارزیابی ثبت‌شده هستند.
                  </div>
                ) : (
                  statusAnalysis.notEvaluatedList.map(item => (
                    <div key={item.program.id} className="bg-white p-4 sm:p-5 rounded-3xl border border-rose-100 shadow-xs hover:border-rose-300 transition-all space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-slate-900">{item.program.title}</h4>
                            <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200 font-bold">
                              {item.grade}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                            <GraduationCap size={14} className="text-amber-600" />
                            <span>استاد مشاور: {item.teacher}</span>
                          </p>
                        </div>

                        {canEditCounseling && (
                          <button
                            onClick={() => handleOpenClassBatchModal(item.program)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer shrink-0"
                          >
                            <Plus size={14} />
                            <span>ثبت ارزیابی این کلاس</span>
                          </button>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-rose-700">
                        <span className="text-[11px] font-bold flex items-center gap-1">
                          <AlertTriangle size={12} />
                          هیچ جلسه‌ای برای این کلاس در این بازه ثبت نشده است
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">ظرفیت: ~{item.studentsCount} طلبه</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Single list view */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(statusFilterMode === 'evaluated' ? statusAnalysis.evaluatedList.map(e => ({ ...e, isEvaluated: true })) :
                statusFilterMode === 'not_evaluated' ? statusAnalysis.notEvaluatedList.map(e => ({ ...e, isEvaluated: false, dates: [], teachers: [e.teacher], gradesCount: 0 })) :
                [
                  ...statusAnalysis.evaluatedList.map(e => ({ ...e, isEvaluated: true })),
                  ...statusAnalysis.notEvaluatedList.map(e => ({ ...e, isEvaluated: false, dates: [], teachers: [e.teacher], gradesCount: 0 }))
                ]
              ).map((item, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "bg-white p-5 rounded-3xl border shadow-xs space-y-3 flex flex-col justify-between",
                    item.isEvaluated ? "border-emerald-200 bg-emerald-50/10" : "border-rose-200 bg-rose-50/10"
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-black text-slate-900">{item.program.title}</h4>
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-md font-bold",
                        item.isEvaluated ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                      )}>
                        {item.isEvaluated ? 'ارزیابی‌شده' : 'انجام‌نشده'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">استاد: {item.teachers?.join('، ') || item.program.teacher}</p>
                    <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded inline-block font-bold">
                      {item.program.grade || 'پایه ۷'}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    {item.isEvaluated ? (
                      <span className="text-xs font-black text-emerald-700">{item.gradesCount} ارزیابی طلبه</span>
                    ) : (
                      canEditCounseling && (
                        <button
                          onClick={() => handleOpenClassBatchModal(item.program)}
                          className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer text-center"
                        >
                          ➕ ثبت ارزیابی این کلاس
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PROFESSOR COMMITMENT & RECORD HISTORY (سابقه ثبت و تعهد اساتید) */}
      {/* ========================================================================= */}
      {activeView === 'professor_commitment' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-slate-900">سنجش میزان تعهد به ثبت اساتید مشاور</h3>
                <p className="text-xs text-slate-500 mt-1">
                  تعداد جلسات موظف / برگزارشده و تعداد جلسات ثبت و ارزیابی‌شده توسط هر استاد از ابتدای سال تحصیلی تا کنون
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">کل اساتید: {professorCommitmentStats.length} نفر</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {professorCommitmentStats.map((prof, idx) => (
              <div 
                key={idx} 
                className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 font-black text-base flex items-center justify-center border border-amber-200">
                        {prof.teacherName[0] || 'ا'}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900">{prof.teacherName}</h4>
                        <p className="text-[11px] text-slate-500 font-medium truncate max-w-[180px]">
                          {prof.counselingCourses.join('، ') || 'کلاس مشاوره'}
                        </p>
                      </div>
                    </div>

                    <span className={cn(
                      "text-[10px] font-black px-2.5 py-1 rounded-full border",
                      prof.status === 'excellent' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      prof.status === 'good' ? "bg-blue-50 text-blue-700 border-blue-200" :
                      prof.status === 'medium' ? "bg-amber-50 text-amber-700 border-amber-200" :
                      "bg-rose-50 text-rose-700 border-rose-200"
                    )}>
                      {prof.status === 'excellent' ? 'تعهد عالی' :
                       prof.status === 'good' ? 'تعهد مطلوب' :
                       prof.status === 'medium' ? 'نیازمند پیگیری' : 'فاقد ثبت کافی'}
                    </span>
                  </div>

                  {/* Commitment Progress Bar */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-600">میزان تعهد به ثبت:</span>
                      <span className="text-slate-900 font-black">{prof.commitmentPercentage}٪</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          prof.commitmentPercentage >= 80 ? "bg-emerald-500" :
                          prof.commitmentPercentage >= 50 ? "bg-blue-500" :
                          prof.commitmentPercentage >= 30 ? "bg-amber-500" : "bg-rose-500"
                        )}
                        style={{ width: `${prof.commitmentPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats matrix */}
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="bg-white p-2 rounded-xl border border-slate-200/60">
                      <span className="text-[10px] text-slate-400 block font-bold">جلسات ثبت‌شده</span>
                      <span className="text-base font-black text-slate-800">{prof.totalRecordedSessions} جلسه</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-200/60">
                      <span className="text-[10px] text-slate-400 block font-bold">ارزیابی ثبت‌شده</span>
                      <span className="text-base font-black text-amber-700">{prof.totalStudentEvaluations} طلبه</span>
                    </div>
                  </div>

                  {prof.latestRecordedDate && (
                    <div className="text-[10px] text-slate-400 font-medium flex items-center justify-between">
                      <span>آخرین ثبت: {prof.latestRecordedDate}</span>
                      <span>پایه‌ها: {prof.grades.join('، ')}</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedTeacherForHistory(prof.teacherName)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Eye size={14} />
                  <span>مشاهده سوابق و ریز جلسات این استاد</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SESSIONS & DETAILED GRADES LIST (ریز جلسات و نمرات ثبت‌شده) */}
      {/* ========================================================================= */}
      {activeView === 'sessions' && (
        <div className="space-y-6">
          {/* Search and Filters */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجوی طلبه، درس، استاد یا بازخورد..."
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
              >
                <option value="all">همه پایه‌ها</option>
                <option value="پایه ۷">پایه ۷</option>
                <option value="پایه ۸">پایه ۸</option>
                <option value="پایه ۹">پایه ۹</option>
                <option value="پایه ۱۰">پایه ۱۰</option>
              </select>

              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
              >
                <option value="all">همه کلاس‌های مشاوره</option>
                {Array.from(new Set(grades.map(g => g.courseTitle))).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
              >
                <option value="all">همه اساتید مشاور</option>
                {Array.from(new Set(grades.map(g => g.counselorTeacherName))).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-black">
                    <th className="p-3.5">نام طلبه</th>
                    <th className="p-3.5">پایه</th>
                    <th className="p-3.5">کلاس مشاوره</th>
                    <th className="p-3.5">استاد مشاور</th>
                    <th className="p-3.5">تاریخ / جلسه</th>
                    <th className="p-3.5 text-center">نمره مشارکت</th>
                    <th className="p-3.5 text-center">نمره پژوهش</th>
                    <th className="p-3.5">بازخورد و نکات استاد</th>
                    {canEditCounseling && <th className="p-3.5 text-center">عملیات</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        هیچ ارزیابی با این فیلترها یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map(g => (
                      <tr key={g.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3.5 font-bold text-slate-900">{g.studentName}</td>
                        <td className="p-3.5">
                          <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-bold">
                            {g.grade || 'پایه ۷'}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-amber-900">{g.courseTitle}</td>
                        <td className="p-3.5 text-slate-600">{g.counselorTeacherName}</td>
                        <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                          {g.sessionDate} • {g.sessionNumber || 'جلسه ۱'}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-black border", SCORE_BADGES[g.participationScore]?.badgeClass)}>
                            {g.participationScore}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-black border", SCORE_BADGES[g.researchScore]?.badgeClass)}>
                            {g.researchScore}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-500 text-[11px] max-w-xs truncate">
                          {g.counselorFeedback || '—'}
                        </td>
                        {canEditCounseling && (
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => handleDelete(g.id, g.studentName)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                              title="حذف رکورد"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: STUDENT SUMMARY (کارنامه و خلاصه عملکرد طلاب) */}
      {/* ========================================================================= */}
      {activeView === 'student_summary' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {students.map(s => {
              const studentGrades = grades.filter(g => g.studentId === s.id);
              const totalSessions = studentGrades.length;
              const excellentCount = studentGrades.filter(g => g.participationScore === 'الف' || g.researchScore === 'الف').length;

              return (
                <div key={s.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 font-black flex items-center justify-center text-sm">
                        {s.name[0]}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900">{s.name}</h4>
                        <span className="text-[10px] text-slate-400">{s.grade || 'پایه ۷'}</span>
                      </div>
                    </div>

                    <span className="text-xs font-black px-2 py-0.5 bg-amber-50 text-amber-800 rounded-md border border-amber-200">
                      {totalSessions} جلسه
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-500">عملکرد کیفی:</span>
                    <span className="text-emerald-700 font-black">{excellentCount} نمره الف</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: BATCH CLASS EVALUATION (ثبت جدید بر اساس کلاس مشاوره) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isClassBatchModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-100 my-8 max-h-[90vh] flex flex-col"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-black">
                    <BookCheck size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">ثبت جدید ارزیابی کلاسی جلسه مشاوره</h3>
                    <p className="text-xs text-slate-500">انتخاب کلاس مشاوره و نمره‌دهی یکجا به تمام طلاب آن کلاس</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsClassBatchModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveBatchEvaluation} className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1">
                {/* 1. Class and Teacher Selection */}
                <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-2xl space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                        <GraduationCap size={15} className="text-amber-700" />
                        <span>انتخاب کلاس مشاوره *</span>
                      </label>
                      <select
                        value={batchSelectedProgramId}
                        onChange={(e) => handleBatchProgramChange(e.target.value)}
                        className="w-full px-3.5 py-2 border border-amber-300 rounded-xl bg-white text-xs font-black text-slate-800 focus:ring-2 focus:ring-amber-500"
                      >
                        {counselingClassesList.map(prog => (
                          <option key={prog.id} value={prog.id}>
                            {prog.title} {prog.teacher ? `(استاد ${prog.teacher})` : ''} [{prog.grade || 'پایه ۷'}]
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">نام استاد مشاور:</label>
                      <input
                        type="text"
                        value={batchTeacherName}
                        onChange={(e) => setBatchTeacherName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white"
                        placeholder="استاد مشاور"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">تاریخ برگزاری جلسه:</label>
                      <input
                        type="text"
                        value={batchSessionDate}
                        onChange={(e) => setBatchSessionDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold bg-white text-center"
                        placeholder="1403/07/15"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">شماره / عنوان جلسه:</label>
                      <input
                        type="text"
                        value={batchSessionNumber}
                        onChange={(e) => setBatchSessionNumber(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white"
                        placeholder="جلسه ۱، جلسه ۲..."
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">موضوع جلسه (اختیاری):</label>
                      <input
                        type="text"
                        value={batchSessionTopic}
                        onChange={(e) => setBatchSessionTopic(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium bg-white"
                        placeholder="مثال: روش تقریرنویسی، مباحثه فقهی..."
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Students Matrix */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <UserCheck size={16} className="text-amber-700" />
                      <h4 className="text-xs font-black text-slate-900">
                        لیست طلاب این کلاس ({batchStudentsList.length} طلبه)
                      </h4>
                    </div>

                    {/* Quick batch score buttons */}
                    <div className="flex items-center gap-1.5 text-[10px] font-bold">
                      <span className="text-slate-400">تخصیص سریع:</span>
                      <button
                        type="button"
                        onClick={() => handleBatchSetAllScores('الف', 'الف')}
                        className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg transition-all cursor-pointer"
                      >
                        همه نمره الف
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBatchSetAllScores('ب', 'ب')}
                        className="px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg transition-all cursor-pointer"
                      >
                        همه نمره ب
                      </button>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                        <tr>
                          <th className="p-2.5">نام طلبه</th>
                          <th className="p-2.5">پایه</th>
                          <th className="p-2.5 text-center">نمره مشارکت</th>
                          <th className="p-2.5 text-center">نمره پژوهش</th>
                          <th className="p-2.5">یادداشت / بازخورد استاد</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {batchStudentsList.map((row, idx) => (
                          <tr key={row.studentId} className="hover:bg-amber-50/20">
                            <td className="p-2.5 font-bold text-slate-900">{row.studentName}</td>
                            <td className="p-2.5">
                              <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                                {row.grade}
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              <select
                                value={row.participationScore}
                                onChange={(e) => {
                                  const val = e.target.value as CounselingScore;
                                  setBatchStudentsList(prev => prev.map((r, i) => i === idx ? { ...r, participationScore: val } : r));
                                }}
                                className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-bold text-xs"
                              >
                                <option value="الف">الف (عالی)</option>
                                <option value="ب">ب (خوب)</option>
                                <option value="ج">ج (متوسط)</option>
                                <option value="د">د (ضعیف)</option>
                                <option value="غیبت">غیبت</option>
                              </select>
                            </td>
                            <td className="p-2.5 text-center">
                              <select
                                value={row.researchScore}
                                onChange={(e) => {
                                  const val = e.target.value as CounselingScore;
                                  setBatchStudentsList(prev => prev.map((r, i) => i === idx ? { ...r, researchScore: val } : r));
                                }}
                                className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-bold text-xs"
                              >
                                <option value="الف">الف (عالی)</option>
                                <option value="ب">ب (خوب)</option>
                                <option value="ج">ج (متوسط)</option>
                                <option value="د">د (ضعیف)</option>
                                <option value="غیبت">غیبت</option>
                              </select>
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                value={row.counselorFeedback}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBatchStudentsList(prev => prev.map((r, i) => i === idx ? { ...r, counselorFeedback: val } : r));
                                }}
                                placeholder="یادداشت اختصاصی..."
                                className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsClassBatchModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingBatch}
                    className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-md shadow-amber-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {isSavingBatch ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>در حال ذخیره...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>ذخیره ارزیابی کل جلسه ({batchStudentsList.length} طلبه)</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 3: TEACHER HISTORY DRAWER/MODAL (سوابق جلسات استاد) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedTeacherForHistory && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-black">
                    <GraduationCap size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">سوابق ارزیابی {selectedTeacherForHistory}</h3>
                    <p className="text-xs text-slate-500">ریز تمام جلسات و نمرات ثبت‌شده توسط این استاد</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedTeacherForHistory(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
                {grades.filter(g => g.counselorTeacherName === selectedTeacherForHistory).length === 0 ? (
                  <p className="text-xs text-slate-400 py-8 text-center">هیچ سابقه‌ای برای این استاد ثبت نشده است.</p>
                ) : (
                  grades.filter(g => g.counselorTeacherName === selectedTeacherForHistory).map(g => (
                    <div key={g.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{g.studentName}</span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-white text-slate-600 rounded border border-slate-200">{g.grade}</span>
                        </div>
                        <span className="text-[11px] text-amber-800 block mt-0.5">{g.courseTitle} • {g.sessionDate}</span>
                      </div>

                      <div className="flex items-center gap-1.5 font-bold">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px]">مشارکت: {g.participationScore}</span>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px]">پژوهش: {g.researchScore}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
