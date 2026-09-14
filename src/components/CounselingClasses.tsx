import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { localDb } from '../lib/localDb';
import { Student, Teacher, CounselingSessionGrade, CounselingScore, Program, Enrollment, ClassSessionAttendance } from '../types';
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
  Check
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const SCORE_BADGES: Record<CounselingScore, { label: string; badgeClass: string; bg: string }> = {
  'الف': { label: 'الف (سطح عالی)', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-black', bg: 'bg-emerald-50' },
  'ب': { label: 'ب (سطح متوسط)', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 font-black', bg: 'bg-amber-50' },
  'ج': { label: 'ج (سطح ضعیف)', badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-black', bg: 'bg-rose-50' }
};

const DEFAULT_COURSES = [
  'مشاوره اصول',
  'مشاوره فقه',
  'مشاوره فلسفه و منطق',
  'مشاوره پژوهش و مقاله‌نویسی',
  'مشاوره تربیتی و اخلاق',
  'سایر کلاس‌های مشاوره'
];

export default function CounselingClasses() {
  const { currentUser, isReadOnly } = useAuth();

  // Data states
  const [grades, setGrades] = useState<CounselingSessionGrade[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<ClassSessionAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  // Active View Tab
  const [activeView, setActiveView] = useState<'sessions' | 'student_summary'>('sessions');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('all');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<CounselingSessionGrade | null>(null);

  // Form Fields
  const [formStudentId, setFormStudentId] = useState('');
  const [formTeacherName, setFormTeacherName] = useState('');
  const [formCourseTitle, setFormCourseTitle] = useState(DEFAULT_COURSES[0]);
  const [formCustomCourse, setFormCustomCourse] = useState('');

  // Date Selection Mode ('preset' | 'custom')
  const [formDateMode, setFormDateMode] = useState<'preset' | 'custom'>('preset');
  const [formSessionDate, setFormSessionDate] = useState(() => {
    return new Date().toLocaleDateString('fa-IR');
  });
  const [formSessionNumber, setFormSessionNumber] = useState('جلسه ۱');
  const [formParticipationScore, setFormParticipationScore] = useState<CounselingScore>('الف');
  const [formResearchScore, setFormResearchScore] = useState<CounselingScore>('الف');
  const [formCounselorFeedback, setFormCounselorFeedback] = useState('');

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

  // Filtered Students based on User Grade Scope (for grade mentors)
  const scopedStudents = useMemo(() => {
    if (!currentUser) return students;
    if (currentUser.level === 1 || currentUser.role === 'education_manager' || currentUser.role === 'research_manager') {
      return students;
    }
    if (currentUser.scope && currentUser.scope.startsWith('grade_')) {
      const targetGradeNumber = currentUser.scope.replace('grade_', '');
      return students.filter(s => s.grade && s.grade.includes(targetGradeNumber));
    }
    return students;
  }, [students, currentUser]);

  // Selected student object
  const selectedStudentObj = useMemo(() => {
    return students.find(s => s.id === formStudentId);
  }, [students, formStudentId]);

  // Dynamically calculate counseling classes available for the selected student
  const studentCounselingClasses = useMemo(() => {
    if (!selectedStudentObj) {
      return { enrolled: [], gradeBased: [], defaults: DEFAULT_COURSES };
    }

    // 1. Programs student is directly enrolled in (via enrollments)
    const enrolledProgramIds = new Set(
      enrollments.filter(e => e.studentId === selectedStudentObj.id).map(e => e.programId)
    );

    const enrolledPrograms = programs.filter(p => enrolledProgramIds.has(p.id));
    const enrolledCounselingClasses = enrolledPrograms
      .filter(p => p.type === 'مشاوره' || p.title.includes('مشاوره') || p.title.includes('درس'))
      .map(p => ({
        title: p.title,
        teacher: p.teacher || '',
        isEnrolled: true
      }));

    // 2. Programs belonging to student's grade
    const gradePrograms = programs
      .filter(p => p.grade === selectedStudentObj.grade && !enrolledProgramIds.has(p.id))
      .filter(p => p.type === 'مشاوره' || p.title.includes('مشاوره'))
      .map(p => ({
        title: p.title,
        teacher: p.teacher || '',
        isEnrolled: false
      }));

    // 3. Previously recorded session grades for this student
    const prevStudentGrades = grades.filter(g => g.studentId === selectedStudentObj.id);
    const prevTitles = Array.from(new Set(prevStudentGrades.map(g => g.courseTitle)));

    return {
      enrolled: enrolledCounselingClasses,
      gradeBased: gradePrograms,
      prevTitles,
      defaults: DEFAULT_COURSES
    };
  }, [selectedStudentObj, enrollments, programs, grades]);

  // Dynamically calculate session dates held in the system for selected student & course
  const heldSessionDates = useMemo(() => {
    const dates: { date: string; label: string; source: string }[] = [];
    const dateSet = new Set<string>();

    // Today's Shamsi date
    const todayShamsi = new Date().toLocaleDateString('fa-IR');
    dateSet.add(todayShamsi);
    dates.push({
      date: todayShamsi,
      label: `امروز (${todayShamsi})`,
      source: 'امروز'
    });

    if (formStudentId) {
      // Dates from attendance sessions held in system
      attendanceSessions.forEach(att => {
        if (!att.isCancelled && att.date) {
          const includesStudent = att.records && att.records[formStudentId];
          const isMatchingCourse = formCourseTitle && (att.programTitle.includes(formCourseTitle) || formCourseTitle.includes(att.programTitle));
          
          if ((includesStudent || isMatchingCourse) && !dateSet.has(att.date)) {
            dateSet.add(att.date);
            dates.push({
              date: att.date,
              label: `جلسه ${att.programTitle || 'کلاس'} - ${att.date}`,
              source: 'حضور و غیاب'
            });
          }
        }
      });

      // Dates from previously recorded counseling grades for this student
      grades.filter(g => g.studentId === formStudentId).forEach(g => {
        if (g.sessionDate && !dateSet.has(g.sessionDate)) {
          dateSet.add(g.sessionDate);
          dates.push({
            date: g.sessionDate,
            label: `جلسه ثبت‌شده ${g.courseTitle} - ${g.sessionDate}`,
            source: 'ارزیابی قبلی'
          });
        }
      });
    }

    return dates;
  }, [formStudentId, formCourseTitle, attendanceSessions, grades]);

  // Handle student selection change in modal
  const handleStudentSelect = (studentId: string) => {
    setFormStudentId(studentId);
    const st = students.find(s => s.id === studentId);
    if (!st) return;

    // Find student's enrolled counseling classes
    const enrolledProgramIds = new Set(
      enrollments.filter(e => e.studentId === st.id).map(e => e.programId)
    );
    const enrolledProg = programs.find(p => enrolledProgramIds.has(p.id) && (p.type === 'مشاوره' || p.title.includes('مشاوره')));

    if (enrolledProg) {
      setFormCourseTitle(enrolledProg.title);
      setFormCustomCourse('');
      if (enrolledProg.teacher) {
        setFormTeacherName(enrolledProg.teacher);
      }
    } else {
      // Check if student has previous counseling grades
      const prevGrade = grades.find(g => g.studentId === st.id);
      if (prevGrade) {
        setFormCourseTitle(prevGrade.courseTitle);
        setFormTeacherName(prevGrade.counselorTeacherName);
      } else {
        setFormCourseTitle(DEFAULT_COURSES[0]);
        setFormTeacherName(teachers[0]?.fullName || 'استاد مشاور');
      }
    }
  };

  // Handle course title selection change in modal
  const handleCourseTitleSelect = (courseTitle: string) => {
    setFormCourseTitle(courseTitle);

    // Auto update teacher name if program matches course title
    const matchingProg = programs.find(p => p.title === courseTitle);
    if (matchingProg && matchingProg.teacher) {
      setFormTeacherName(matchingProg.teacher);
    } else {
      const matchingPrevGrade = grades.find(g => g.studentId === formStudentId && g.courseTitle === courseTitle);
      if (matchingPrevGrade && matchingPrevGrade.counselorTeacherName) {
        setFormTeacherName(matchingPrevGrade.counselorTeacherName);
      }
    }
  };

  // Open Modal for Create or Edit
  const handleOpenModal = (itemToEdit?: CounselingSessionGrade) => {
    if (itemToEdit) {
      setEditingGrade(itemToEdit);
      setFormStudentId(itemToEdit.studentId);
      setFormTeacherName(itemToEdit.counselorTeacherName);
      if (DEFAULT_COURSES.includes(itemToEdit.courseTitle)) {
        setFormCourseTitle(itemToEdit.courseTitle);
        setFormCustomCourse('');
      } else {
        setFormCourseTitle('سایر کلاس‌های مشاوره');
        setFormCustomCourse(itemToEdit.courseTitle);
      }
      setFormDateMode('preset');
      setFormSessionDate(itemToEdit.sessionDate);
      setFormSessionNumber(String(itemToEdit.sessionNumber || 'جلسه ۱'));
      setFormParticipationScore(itemToEdit.participationScore);
      setFormResearchScore(itemToEdit.researchScore);
      setFormCounselorFeedback(itemToEdit.counselorFeedback || '');
    } else {
      setEditingGrade(null);
      const initialStudent = scopedStudents[0];
      const initialStudentId = initialStudent?.id || '';
      setFormStudentId(initialStudentId);

      // Auto-set initial course & teacher
      if (initialStudent) {
        const enrolledProgramIds = new Set(
          enrollments.filter(e => e.studentId === initialStudent.id).map(e => e.programId)
        );
        const enrolledProg = programs.find(p => enrolledProgramIds.has(p.id) && (p.type === 'مشاوره' || p.title.includes('مشاوره')));
        if (enrolledProg) {
          setFormCourseTitle(enrolledProg.title);
          setFormTeacherName(enrolledProg.teacher || teachers[0]?.fullName || 'استاد مشاور');
        } else {
          setFormCourseTitle(DEFAULT_COURSES[0]);
          setFormTeacherName(teachers[0]?.fullName || 'استاد مشاور');
        }
      } else {
        setFormCourseTitle(DEFAULT_COURSES[0]);
        setFormTeacherName(teachers[0]?.fullName || 'استاد مشاور');
      }

      setFormCustomCourse('');
      setFormDateMode('preset');
      setFormSessionDate(new Date().toLocaleDateString('fa-IR'));
      setFormSessionNumber('جلسه ۱');
      setFormParticipationScore('الف');
      setFormResearchScore('الف');
      setFormCounselorFeedback('');
    }
    setIsModalOpen(true);
  };

  // Save Record
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStudentId) {
      alert('لطفاً طلبه مورد نظر را انتخاب نمایید.');
      return;
    }

    const selectedStudent = students.find(s => s.id === formStudentId);
    if (!selectedStudent) {
      alert('طلبه انتخاب شده در سیستم یافت نشد.');
      return;
    }

    const resolvedCourse = formCourseTitle === 'سایر کلاس‌های مشاوره' && formCustomCourse.trim() 
      ? formCustomCourse.trim() 
      : formCourseTitle;

    const payload: Partial<CounselingSessionGrade> = {
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      grade: selectedStudent.grade || 'پایه نامشخص',
      counselorTeacherName: formTeacherName.trim() || 'استاد مشاور',
      courseTitle: resolvedCourse,
      sessionDate: formSessionDate.trim() || new Date().toLocaleDateString('fa-IR'),
      sessionNumber: formSessionNumber.trim() || 'جلسه ۱',
      participationScore: formParticipationScore,
      researchScore: formResearchScore,
      counselorFeedback: formCounselorFeedback.trim(),
      createdByName: currentUser?.name || currentUser?.username || 'مدیریت',
      createdByRole: currentUser?.roleTitle || 'مسئول سامانه',
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingGrade) {
        await localDb.updateDoc('counseling_session_grades', editingGrade.id, payload);
      } else {
        await localDb.addDoc('counseling_session_grades', {
          ...payload,
          createdAt: new Date().toISOString()
        });
      }

      // Log Audit Entry
      await localDb.addDoc('audit_logs', {
        action: editingGrade ? 'ویرایش نمره‌دهی مشاوره' : 'ثبت نمره‌دهی مشاوره',
        details: `ثبت نمرات مشارکت (${formParticipationScore}) و پژوهش (${formResearchScore}) برای طلبه ${selectedStudent.name} در درس ${resolvedCourse}`,
        userId: currentUser?.id || 'sys',
        userName: currentUser?.name || currentUser?.username || 'سیستم',
        createdAt: new Date().toISOString()
      });

      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error saving counseling grade:', err);
      alert('خطا در ثبت نمره جلسه مشاوره.');
    }
  };

  // Delete Record
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
      fetchData();
    } catch (err) {
      console.error('Error deleting counseling grade:', err);
      alert('خطا در حذف ارزیابی.');
    }
  };

  // Filtered List for Table
  const filteredGrades = useMemo(() => {
    return grades.filter(item => {
      if (selectedGrade !== 'all' && item.grade !== selectedGrade) {
        return false;
      }
      if (selectedCourse !== 'all' && item.courseTitle !== selectedCourse) {
        return false;
      }
      if (selectedTeacher !== 'all' && item.counselorTeacherName !== selectedTeacher) {
        return false;
      }
      if (selectedStudentId !== 'all' && item.studentId !== selectedStudentId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = 
          item.studentName.toLowerCase().includes(q) ||
          item.counselorTeacherName.toLowerCase().includes(q) ||
          item.courseTitle.toLowerCase().includes(q) ||
          (item.counselorFeedback && item.counselorFeedback.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [grades, selectedGrade, selectedCourse, selectedTeacher, selectedStudentId, searchQuery]);

  // Aggregated Summary by Student
  const studentSummaries = useMemo(() => {
    const map = new Map<string, {
      studentId: string;
      studentName: string;
      grade: string;
      totalSessions: number;
      partAlpha: number;
      partBeta: number;
      partGamma: number;
      resAlpha: number;
      resBeta: number;
      resGamma: number;
      feedbacks: { date: string; teacher: string; course: string; feedback: string }[];
    }>();

    filteredGrades.forEach(g => {
      if (!map.has(g.studentId)) {
        map.set(g.studentId, {
          studentId: g.studentId,
          studentName: g.studentName,
          grade: g.grade || 'نامشخص',
          totalSessions: 0,
          partAlpha: 0,
          partBeta: 0,
          partGamma: 0,
          resAlpha: 0,
          resBeta: 0,
          resGamma: 0,
          feedbacks: []
        });
      }

      const rec = map.get(g.studentId)!;
      rec.totalSessions += 1;

      if (g.participationScore === 'الف') rec.partAlpha += 1;
      else if (g.participationScore === 'ب') rec.partBeta += 1;
      else if (g.participationScore === 'ج') rec.partGamma += 1;

      if (g.researchScore === 'الف') rec.resAlpha += 1;
      else if (g.researchScore === 'ب') rec.resBeta += 1;
      else if (g.researchScore === 'ج') rec.resGamma += 1;

      if (g.counselorFeedback) {
        rec.feedbacks.push({
          date: g.sessionDate,
          teacher: g.counselorTeacherName,
          course: g.courseTitle,
          feedback: g.counselorFeedback
        });
      }
    });

    return Array.from(map.values());
  }, [filteredGrades]);

  // Unique Teacher Names from Data
  const uniqueTeachers = useMemo(() => {
    const set = new Set<string>();
    teachers.forEach(t => set.add(t.fullName));
    grades.forEach(g => {
      if (g.counselorTeacherName) set.add(g.counselorTeacherName);
    });
    return Array.from(set);
  }, [teachers, grades]);

  // Unique Courses from Data
  const uniqueCourses = useMemo(() => {
    const set = new Set<string>(DEFAULT_COURSES);
    grades.forEach(g => {
      if (g.courseTitle) set.add(g.courseTitle);
    });
    return Array.from(set);
  }, [grades]);

  return (
    <div className="p-4 md:p-6 space-y-6 dir-rtl font-vazir max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl">
                <BookCheck className="w-6 h-6 text-indigo-300" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-white">کلاس‌های مشاوره (ارزیابی و نمرات)</h1>
                <p className="text-xs text-indigo-200 mt-1">
                  ثبت نظرات، نمره‌دهی مشارکت و پژوهش/تقریر طلاب در کلاس‌های استاد مشاور (ویژه مسئولین آموزش، پژوهش و پایه)
                </p>
              </div>
            </div>
          </div>

          {!isReadOnly && (
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-md hover:scale-105 active:scale-95 cursor-pointer shrink-0"
            >
              <Plus size={16} />
              <span>ثبت جدید ارزیابی کلاس مشاوره</span>
            </button>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 mt-5 border-t border-indigo-700/50 text-xs">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
            <span className="text-indigo-200 text-[11px] font-bold block">کل ارزیابی‌های ثبت‌شده</span>
            <span className="text-xl font-black text-white mt-1 block">{grades.length} جلسه</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
            <span className="text-indigo-200 text-[11px] font-bold block">تعداد طلاب ارزیابی‌شده</span>
            <span className="text-xl font-black text-white mt-1 block">
              {new Set(grades.map(g => g.studentId)).size} نفر
            </span>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
            <span className="text-emerald-300 text-[11px] font-bold block">سطح الف مشارکت</span>
            <span className="text-xl font-black text-emerald-200 mt-1 block">
              {grades.filter(g => g.participationScore === 'الف').length} مورد
            </span>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
            <span className="text-amber-300 text-[11px] font-bold block">سطح الف پژوهش و تقریر</span>
            <span className="text-xl font-black text-amber-200 mt-1 block">
              {grades.filter(g => g.researchScore === 'الف').length} مورد
            </span>
          </div>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* View Tabs Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveView('sessions')}
              className={cn(
                "py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                activeView === 'sessions'
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
              )}
            >
              <FileText size={15} />
              <span>فهرست جلسات و نمرات ({filteredGrades.length})</span>
            </button>
            <button
              onClick={() => setActiveView('student_summary')}
              className={cn(
                "py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                activeView === 'student_summary'
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
              )}
            >
              <User size={15} />
              <span>کارنامه تجمیعی طلاب ({studentSummaries.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="py-2 px-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={14} />
              <span>چاپ گزارش</span>
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="p-4 bg-slate-50/80 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="جستجوی نام طلبه، استاد یا نظرات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Grade Filter */}
          <div>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">🎓 همه پایه‌ها</option>
              <option value="پایه ۷">پایه ۷</option>
              <option value="پایه ۸">پایه ۸</option>
              <option value="پایه ۹">پایه ۹</option>
              <option value="پایه ۱۰">پایه ۱۰</option>
            </select>
          </div>

          {/* Course Filter */}
          <div>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">📚 همه عنوان درس‌های مشاوره</option>
              {uniqueCourses.map((c, i) => (
                <option key={i} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Teacher Filter */}
          <div>
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">👨‍🏫 همه اساتید مشاور</option>
              {uniqueTeachers.map((t, i) => (
                <option key={i} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-center">
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedGrade('all');
                setSelectedCourse('all');
                setSelectedTeacher('all');
                setSelectedStudentId('all');
              }}
              className="w-full py-2 px-3 border border-slate-200 hover:bg-slate-200/60 text-slate-600 rounded-xl text-xs font-bold cursor-pointer transition-colors"
            >
              پاکسازی فیلترها
            </button>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-bold text-sm">
            در حال بارگذاری ارزیابی‌ها و نمرات کلاس‌های مشاوره...
          </div>
        ) : activeView === 'sessions' ? (
          /* Table of Session Grades */
          filteredGrades.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-bold space-y-2">
              <BookCheck size={40} className="mx-auto text-slate-300" />
              <p>هیچ ارزیابی برای کلاس‌های مشاوره با فیلترهای انتخابی یافت نشد.</p>
              {!isReadOnly && (
                <button
                  onClick={() => handleOpenModal()}
                  className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  ثبت اولین ارزیابی
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">مشخصات طلبه</th>
                    <th className="py-3.5 px-4">استاد مشاور و درس</th>
                    <th className="py-3.5 px-4">تاریخ و عنوان جلسه</th>
                    <th className="py-3.5 px-4 text-center">نمره مشارکت</th>
                    <th className="py-3.5 px-4 text-center">نمره پژوهش و تقریر</th>
                    <th className="py-3.5 px-4">ملاحظات و ارزیابی استاد</th>
                    <th className="py-3.5 px-4 text-center">ثبت‌کننده</th>
                    {!isReadOnly && <th className="py-3.5 px-4 text-center">عملیات</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredGrades.map((g) => {
                    const partBadge = SCORE_BADGES[g.participationScore] || SCORE_BADGES['الف'];
                    const resBadge = SCORE_BADGES[g.researchScore] || SCORE_BADGES['الف'];

                    return (
                      <tr key={g.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Student Info */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-center font-black text-indigo-700">
                              {g.studentName.charAt(0)}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-black text-slate-900 text-xs">{g.studentName}</span>
                              <span className="text-[10px] text-slate-400 font-bold">{g.grade || 'پایه نامشخص'}</span>
                            </div>
                          </div>
                        </td>

                        {/* Counselor Teacher & Course */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-black text-slate-800 text-xs flex items-center gap-1">
                              <GraduationCap size={13} className="text-indigo-600" />
                              <span>{g.counselorTeacherName}</span>
                            </span>
                            <span className="text-[11px] text-indigo-600 font-bold mt-0.5">
                              {g.courseTitle}
                            </span>
                          </div>
                        </td>

                        {/* Date & Session */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 text-xs flex items-center gap-1">
                              <Calendar size={13} className="text-slate-400" />
                              <span>{g.sessionDate}</span>
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                              {g.sessionNumber}
                            </span>
                          </div>
                        </td>

                        {/* Participation Score */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className={cn("px-2.5 py-1 rounded-lg border text-xs inline-block", partBadge.badgeClass)}>
                            نمره {g.participationScore}
                          </span>
                        </td>

                        {/* Research Score */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className={cn("px-2.5 py-1 rounded-lg border text-xs inline-block", resBadge.badgeClass)}>
                            نمره {g.researchScore}
                          </span>
                        </td>

                        {/* Counselor Feedback */}
                        <td className="py-3.5 px-4 max-w-xs">
                          {g.counselorFeedback ? (
                            <p className="text-slate-700 text-[11px] font-medium leading-relaxed bg-slate-50 p-2 rounded-xl border border-slate-200/60 line-clamp-2">
                              {g.counselorFeedback}
                            </p>
                          ) : (
                            <span className="text-slate-300 text-[11px] font-bold">بدون ملاحظات</span>
                          )}
                        </td>

                        {/* Created By */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap text-[10px] text-slate-400">
                          <div>{g.createdByName || 'مدیریت'}</div>
                          <div className="text-[9px] text-slate-300">{g.createdByRole}</div>
                        </td>

                        {/* Actions */}
                        {!isReadOnly && (
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenModal(g)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                                title="ویرایش"
                              >
                                <Edit size={15} />
                              </button>
                              <button
                                onClick={() => handleDelete(g.id, g.studentName)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                title="حذف"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Student Summary Cards View */
          studentSummaries.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-bold">
              هیچ طلبه‌ای با نمرات مشاوره ثبت‌شده یافت نشد.
            </div>
          ) : (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {studentSummaries.map((st) => (
                <div key={st.studentId} className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3 relative hover:shadow-sm transition-all">
                  {/* Student Title */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-sm">
                        {st.studentName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 text-sm">{st.studentName}</h3>
                        <span className="text-[10px] text-slate-400 font-bold">{st.grade}</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-lg font-black text-xs">
                      {st.totalSessions} جلسه مشاوره
                    </span>
                  </div>

                  {/* Score Breakdown Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    {/* Participation Box */}
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold block">نمره‌دهی مشارکت</span>
                      <div className="flex items-center justify-between text-[11px] font-black">
                        <span className="text-emerald-700">الف: {st.partAlpha}</span>
                        <span className="text-amber-700">ب: {st.partBeta}</span>
                        <span className="text-rose-700">ج: {st.partGamma}</span>
                      </div>
                    </div>

                    {/* Research Box */}
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold block">نمره‌دهی پژوهش/تقریر</span>
                      <div className="flex items-center justify-between text-[11px] font-black">
                        <span className="text-emerald-700">الف: {st.resAlpha}</span>
                        <span className="text-amber-700">ب: {st.resBeta}</span>
                        <span className="text-rose-700">ج: {st.resGamma}</span>
                      </div>
                    </div>
                  </div>

                  {/* Feedback Snippets */}
                  {st.feedbacks.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                        <MessageSquare size={12} className="text-indigo-600" />
                        <span>آخرین ارزیابی و نظرات استاد مشاور:</span>
                      </span>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 text-[11px] text-slate-700 font-medium space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                          <span>{st.feedbacks[st.feedbacks.length - 1].teacher} ({st.feedbacks[st.feedbacks.length - 1].course})</span>
                          <span>{st.feedbacks[st.feedbacks.length - 1].date}</span>
                        </div>
                        <p className="line-clamp-2 leading-relaxed">
                          "{st.feedbacks[st.feedbacks.length - 1].feedback}"
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs dir-rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden font-vazir"
            >
              {/* Modal Header */}
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookCheck className="text-indigo-400" size={20} />
                  <h2 className="font-black text-sm">
                    {editingGrade ? 'ویرایش نمرات جلسه مشاوره' : 'ثبت نمره‌دهی و ارزیابی جدید جلسه مشاوره'}
                  </h2>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
                
                {/* STEP 1: Select Student */}
                <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <label className="font-black text-slate-800 block text-xs flex items-center justify-between">
                    <span>۱. انتخاب طلبه *</span>
                    {selectedStudentObj && (
                      <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                        {selectedStudentObj.grade || 'پایه نامشخص'}
                      </span>
                    )}
                  </label>
                  <select
                    value={formStudentId}
                    onChange={(e) => handleStudentSelect(e.target.value)}
                    required
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- لطفاً طلبه مورد نظر را انتخاب کنید --</option>
                    {scopedStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.grade || 'پایه نامشخص'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* STEP 2: Select Counseling Class for this Student */}
                <div className="space-y-1 bg-indigo-50/50 p-3 rounded-xl border border-indigo-200/70">
                  <label className="font-black text-indigo-900 block text-xs flex items-center justify-between">
                    <span>۲. لیست کلاس‌های مشاوره طلبه *</span>
                    <span className="text-[10px] text-indigo-600 font-normal">
                      (کلاس‌های ثبت‌نام شده یا اختصاصی طلبه)
                    </span>
                  </label>
                  
                  <select
                    value={formCourseTitle}
                    onChange={(e) => handleCourseTitleSelect(e.target.value)}
                    required
                    className="w-full p-2.5 border border-indigo-200 rounded-xl font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {/* Student's Direct Enrolled Counseling Classes */}
                    {studentCounselingClasses.enrolled.length > 0 && (
                      <optgroup label="⭐ کلاس‌های اختصاصی / ثبت‌نام شده طلبه">
                        {studentCounselingClasses.enrolled.map((item, idx) => (
                          <option key={`enrolled-${idx}`} value={item.title}>
                            {item.title} {item.teacher ? `(استاد: ${item.teacher})` : ''} [ثبت‌نام شده]
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {/* Grade-based Counseling Classes */}
                    {studentCounselingClasses.gradeBased.length > 0 && (
                      <optgroup label={`📚 کلاس‌های مشاوره پایه ${selectedStudentObj?.grade || ''}`}>
                        {studentCounselingClasses.gradeBased.map((item, idx) => (
                          <option key={`grade-${idx}`} value={item.title}>
                            {item.title} {item.teacher ? `(استاد: ${item.teacher})` : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {/* Standard Default Counseling Classes */}
                    <optgroup label="📖 کلاس‌ها و عناوین عمومی مشاوره">
                      {DEFAULT_COURSES.map((c, i) => (
                        <option key={`def-${i}`} value={c}>{c}</option>
                      ))}
                    </optgroup>
                  </select>

                  {formCourseTitle === 'سایر کلاس‌های مشاوره' && (
                    <div className="pt-2">
                      <input
                        type="text"
                        value={formCustomCourse}
                        onChange={(e) => setFormCustomCourse(e.target.value)}
                        placeholder="عنوان سفارشی کلاس مشاوره را وارد کنید..."
                        required
                        className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                </div>

                {/* Counselor Teacher Name */}
                <div className="space-y-1">
                  <label className="font-black text-slate-800 block">
                    نام استاد مشاور *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formTeacherName}
                      onChange={(e) => setFormTeacherName(e.target.value)}
                      placeholder="نام استاد مشاور"
                      required
                      className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* STEP 3: Select Held Session Date */}
                <div className="space-y-1 bg-amber-50/50 p-3 rounded-xl border border-amber-200/70">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-black text-amber-900 block text-xs flex items-center gap-1">
                      <Calendar size={14} className="text-amber-600" />
                      <span>۳. تاریخ جلسه (برگزارشده در سامانه) *</span>
                    </label>
                    
                    <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-amber-200">
                      <button
                        type="button"
                        onClick={() => setFormDateMode('preset')}
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all",
                          formDateMode === 'preset' ? "bg-amber-500 text-white" : "text-amber-800 hover:bg-amber-50"
                        )}
                      >
                        از جلسات برگزارشده
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormDateMode('custom')}
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all",
                          formDateMode === 'custom' ? "bg-amber-500 text-white" : "text-amber-800 hover:bg-amber-50"
                        )}
                      >
                        تاریخ دستی
                      </button>
                    </div>
                  </div>

                  {formDateMode === 'preset' ? (
                    <select
                      value={formSessionDate}
                      onChange={(e) => {
                        if (e.target.value === 'custom_entry') {
                          setFormDateMode('custom');
                        } else {
                          setFormSessionDate(e.target.value);
                        }
                      }}
                      className="w-full p-2.5 border border-amber-200 rounded-xl font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <optgroup label="📅 تاریخ‌های جلسات در سامانه">
                        {heldSessionDates.map((item, idx) => (
                          <option key={idx} value={item.date}>
                            {item.label}
                          </option>
                        ))}
                      </optgroup>
                      <option value="custom_entry">✍️ ورود تاریخ سفارشی دیگر...</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formSessionDate}
                      onChange={(e) => setFormSessionDate(e.target.value)}
                      placeholder="تاریخ شمسی جلسه (مثال: 1405/06/15)"
                      required
                      className="w-full p-2.5 border border-amber-300 rounded-xl font-mono font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  )}

                  <div className="pt-2">
                    <label className="font-bold text-slate-700 block text-[11px] mb-1">
                      شماره یا عنوان جلسه
                    </label>
                    <input
                      type="text"
                      value={formSessionNumber}
                      onChange={(e) => setFormSessionNumber(e.target.value)}
                      placeholder="مثال: جلسه ۱، جلسه ۲، جلسه جبرانی"
                      className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* STEP 4: Grades Block: Participation & Research */}
                <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl space-y-3">
                  <span className="font-black text-indigo-900 block text-xs flex items-center gap-1">
                    <Award size={15} className="text-indigo-600" />
                    <span>۴. نمره‌دهی استانداردهای مشاوره (الف / ب / ج):</span>
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Participation Score */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                      <label className="font-black text-slate-800 block text-xs">
                        ۱. نمره مشارکت در جلسه
                      </label>
                      <div className="flex items-center gap-2">
                        {(['الف', 'ب', 'ج'] as CounselingScore[]).map((score) => (
                          <button
                            key={score}
                            type="button"
                            onClick={() => setFormParticipationScore(score)}
                            className={cn(
                              "flex-1 py-2 rounded-lg font-black text-xs transition-all cursor-pointer border",
                              formParticipationScore === score
                                ? SCORE_BADGES[score].badgeClass + " ring-2 ring-indigo-500/40"
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            )}
                          >
                            {score}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Research Score */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                      <label className="font-black text-slate-800 block text-xs">
                        ۲. نمره پژوهش و تقریر
                      </label>
                      <div className="flex items-center gap-2">
                        {(['الف', 'ب', 'ج'] as CounselingScore[]).map((score) => (
                          <button
                            key={score}
                            type="button"
                            onClick={() => setFormResearchScore(score)}
                            className={cn(
                              "flex-1 py-2 rounded-lg font-black text-xs transition-all cursor-pointer border",
                              formResearchScore === score
                                ? SCORE_BADGES[score].badgeClass + " ring-2 ring-indigo-500/40"
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            )}
                          >
                            {score}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Counselor Feedback */}
                <div className="space-y-1">
                  <label className="font-black text-slate-800 block">
                    نظرات و ارزیابی استاد مشاور نسبت به عملکرد و وضعیت طلبه
                  </label>
                  <textarea
                    rows={3}
                    value={formCounselorFeedback}
                    onChange={(e) => setFormCounselorFeedback(e.target.value)}
                    placeholder="ملاحظات استاد مشاور درباره میزان نظم، آمادگی قبل از جلسه، کیفیت تقریرنویسی، روحیه و پیشنهادهای اصلاحی..."
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-medium text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-md transition-all cursor-pointer"
                  >
                    {editingGrade ? 'بروزرسانی نمره' : 'ثبت نمره و بایگانی'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
