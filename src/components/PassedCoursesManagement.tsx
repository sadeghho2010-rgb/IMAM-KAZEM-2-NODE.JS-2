import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, 
  CheckCircle2, 
  XCircle, 
  Circle, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  FolderPlus, 
  Layers, 
  UserCheck, 
  Award, 
  BarChart3, 
  X, 
  Save, 
  HelpCircle,
  RefreshCw,
  Sparkles,
  ChevronRight,
  Filter,
  Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { localDb } from '../lib/localDb';
import { cn } from '../lib/utils';
import { 
  Student, 
  CurriculumSubject, 
  CurriculumBook, 
  CurriculumChapter, 
  StudentCourseProgress,
  CourseProgressStatus,
  Program,
  Enrollment
} from '../types';
import { StudentCourseProgressService } from '../services/StudentCourseProgressService';

export default function PassedCoursesManagement() {
  const { currentUser } = useAuth();
  
  // Access authorization check (Super Admin, Education Manager, Grade Supervisors - Level 1 & 2)
  const isSuperAdmin = currentUser?.role === 'super_admin' || currentUser?.level === 1;
  const isEducationManager = currentUser?.role === 'education_manager' || currentUser?.level === 2;
  const isGradeSupervisor = currentUser?.level === 2;

  // Active Main Sub-Tab
  const [activeTab, setActiveTab] = useState<'students_progress' | 'curriculum_bank'>('students_progress');

  // Core Data States
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [books, setBooks] = useState<CurriculumBook[]>([]);
  const [chapters, setChapters] = useState<CurriculumChapter[]>([]);
  const [progressRecords, setProgressRecords] = useState<StudentCourseProgress[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Student Progress Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'passed' | 'remaining'>('all');

  // Student Details Modal State
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<Student | null>(null);

  // Curriculum Bank Modals
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState<boolean>(false);
  const [editingSubject, setEditingSubject] = useState<Partial<CurriculumSubject> | null>(null);

  const [isBookModalOpen, setIsBookModalOpen] = useState<boolean>(false);
  const [editingBook, setEditingBook] = useState<Partial<CurriculumBook> | null>(null);

  const [isChapterModalOpen, setIsChapterModalOpen] = useState<boolean>(false);
  const [editingChapter, setEditingChapter] = useState<Partial<CurriculumChapter> | null>(null);

  // Load All Data
  const loadAllData = async () => {
    setIsLoading(true);
    try {
      // 1. Ensure default curriculum items exist
      const seed = await StudentCourseProgressService.ensureDefaultCurriculumData();
      
      // 2. Fetch all collections
      const [stList, subList, bkList, chList, prgList, enrList, progList] = await Promise.all([
        localDb.getDocs<Student>('students'),
        localDb.getDocs<CurriculumSubject>('curriculum_subjects'),
        localDb.getDocs<CurriculumBook>('curriculum_books'),
        localDb.getDocs<CurriculumChapter>('curriculum_chapters'),
        localDb.getDocs<StudentCourseProgress>('student_course_progress'),
        localDb.getDocs<Enrollment>('enrollments'),
        localDb.getDocs<Program>('programs'),
      ]);

      setStudents(stList.filter(s => s.isActive !== false));
      setSubjects(subList.length > 0 ? subList : seed.subjects);
      setBooks(bkList.length > 0 ? bkList : seed.books);
      setChapters(chList.length > 0 ? chList : seed.chapters);
      setProgressRecords(prgList);
      setEnrollments(enrList);
      setPrograms(progList);
    } catch (err) {
      console.error('Error loading curriculum data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Compute Full Name Helper
  const getStudentFullName = (s: Student): string => {
    if (s.firstName || s.lastName) {
      return `${s.firstName || ''} ${s.lastName || ''}`.trim();
    }
    return s.name || 'طلبه نامشخص';
  };

  // Filtered Students List
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      // Grade filter
      if (selectedGradeFilter !== 'all' && s.grade !== selectedGradeFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName = getStudentFullName(s).toLowerCase();
        const nationalId = s.nationalId || '';
        const studentCode = s.studentCode || '';
        if (!fullName.includes(q) && !nationalId.includes(q) && !studentCode.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [students, selectedGradeFilter, searchQuery]);

  // Compute student summary progress stats map
  const studentStatsMap = useMemo(() => {
    const map: Record<string, {
      passedCount: number;
      inProgressCount: number;
      remainingCount: number;
      passedCredits: number;
      inProgressCredits: number;
      remainingCredits: number;
      totalCredits: number;
      percentCompleted: number;
    }> = {};

    const totalChaptersCount = chapters.length;
    const totalCurriculumCredits = chapters.reduce((acc, c) => acc + (c.credits || 2), 0);

    students.forEach(s => {
      const studentProgs = progressRecords.filter(p => p.studentId === s.id);

      let passedCount = 0;
      let inProgressCount = 0;
      let passedCredits = 0;
      let inProgressCredits = 0;

      chapters.forEach(ch => {
        const progRec = studentProgs.find(p => p.chapterId === ch.id);
        const credits = ch.credits || 2;

        if (progRec?.status === 'passed') {
          passedCount++;
          passedCredits += credits;
        } else if (progRec?.status === 'in_progress') {
          inProgressCount++;
          inProgressCredits += credits;
        }
      });

      const remainingCount = Math.max(0, totalChaptersCount - passedCount - inProgressCount);
      const remainingCredits = Math.max(0, totalCurriculumCredits - passedCredits - inProgressCredits);
      const percentCompleted = totalCurriculumCredits > 0 ? Math.round((passedCredits / totalCurriculumCredits) * 100) : 0;

      map[s.id] = {
        passedCount,
        inProgressCount,
        remainingCount,
        passedCredits,
        inProgressCredits,
        remainingCredits,
        totalCredits: totalCurriculumCredits,
        percentCompleted
      };
    });

    return map;
  }, [students, chapters, progressRecords]);

  // Total System Credits Stats
  const systemTotalStats = useMemo(() => {
    let totalPassedCredits = 0;
    let totalInProgressCredits = 0;
    let totalRemainingCredits = 0;

    Object.values(studentStatsMap).forEach(st => {
      totalPassedCredits += st.passedCredits;
      totalInProgressCredits += st.inProgressCredits;
      totalRemainingCredits += st.remainingCredits;
    });

    return {
      totalPassedCredits,
      totalInProgressCredits,
      totalRemainingCredits
    };
  }, [studentStatsMap]);

  // Handler to toggle status of a chapter for a student
  const handleToggleChapterStatus = async (
    studentId: string, 
    chapter: CurriculumChapter, 
    newStatus: CourseProgressStatus
  ) => {
    try {
      const progressId = `progress_${studentId}_${chapter.id}`;
      const existing = progressRecords.find(p => p.id === progressId || (p.studentId === studentId && p.chapterId === chapter.id));

      const updatedRecord: StudentCourseProgress = {
        id: existing?.id || progressId,
        studentId,
        subjectId: chapter.subjectId,
        subjectTitle: chapter.subjectTitle,
        bookId: chapter.bookId,
        bookTitle: chapter.bookTitle,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        status: newStatus,
        passedAt: newStatus === 'passed' ? new Date().toISOString() : undefined,
        passedByUserId: newStatus === 'passed' ? currentUser?.id : undefined,
        passedByName: newStatus === 'passed' ? (currentUser?.fullName || currentUser?.name || currentUser?.username) : undefined,
        updatedAt: new Date().toISOString()
      };

      await localDb.setDoc('student_course_progress', updatedRecord);

      // Local state update
      setProgressRecords(prev => {
        const filtered = prev.filter(p => p.id !== updatedRecord.id && !(p.studentId === studentId && p.chapterId === chapter.id));
        return [...filtered, updatedRecord];
      });
    } catch (err) {
      console.error('Error updating course progress status:', err);
      alert('خطا در ذخیره وضعیت درس.');
    }
  };

  // Handler to save/edit Subject
  const handleSaveSubject = async () => {
    if (!editingSubject?.title?.trim()) {
      alert('لطفاً عنوان ماده درسی را وارد کنید.');
      return;
    }

    try {
      const doc: CurriculumSubject = {
        id: editingSubject.id || `subj_${Date.now()}`,
        title: editingSubject.title.trim(),
        code: editingSubject.code || '',
        description: editingSubject.description || '',
        orderIndex: editingSubject.orderIndex || subjects.length + 1,
        color: editingSubject.color || 'indigo',
        createdAt: editingSubject.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await localDb.setDoc('curriculum_subjects', doc);
      setIsSubjectModalOpen(false);
      setEditingSubject(null);
      await loadAllData();
    } catch (err) {
      console.error(err);
      alert('خطا در ذخیره ماده درسی.');
    }
  };

  // Handler to save/edit Book
  const handleSaveBook = async () => {
    if (!editingBook?.title?.trim() || !editingBook?.subjectId) {
      alert('لطفاً عنوان کتاب و ماده درسی مربوطه را تعیین کنید.');
      return;
    }

    const parentSubj = subjects.find(s => s.id === editingBook.subjectId);

    try {
      const doc: CurriculumBook = {
        id: editingBook.id || `book_${Date.now()}`,
        subjectId: editingBook.subjectId,
        subjectTitle: parentSubj?.title || editingBook.subjectTitle || '',
        title: editingBook.title.trim(),
        credits: Number(editingBook.credits) || 4,
        orderIndex: editingBook.orderIndex || books.length + 1,
        description: editingBook.description || '',
        createdAt: editingBook.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await localDb.setDoc('curriculum_books', doc);
      setIsBookModalOpen(false);
      setEditingBook(null);
      await loadAllData();
    } catch (err) {
      console.error(err);
      alert('خطا در ذخیره کتاب.');
    }
  };

  // Handler to save/edit Chapter
  const handleSaveChapter = async () => {
    if (!editingChapter?.title?.trim() || !editingChapter?.bookId) {
      alert('لطفاً عنوان سرفصل و کتاب مربوطه را تعیین کنید.');
      return;
    }

    const parentBook = books.find(b => b.id === editingChapter.bookId);

    try {
      const doc: CurriculumChapter = {
        id: editingChapter.id || `chap_${Date.now()}`,
        bookId: editingChapter.bookId,
        bookTitle: parentBook?.title || editingChapter.bookTitle || '',
        subjectId: parentBook?.subjectId || editingChapter.subjectId || '',
        subjectTitle: parentBook?.subjectTitle || editingChapter.subjectTitle || '',
        title: editingChapter.title.trim(),
        credits: Number(editingChapter.credits) || 2,
        orderIndex: editingChapter.orderIndex || chapters.length + 1,
        description: editingChapter.description || '',
        createdAt: editingChapter.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await localDb.setDoc('curriculum_chapters', doc);
      setIsChapterModalOpen(false);
      setEditingChapter(null);
      await loadAllData();
    } catch (err) {
      console.error(err);
      alert('خطا در ذخیره سرفصل درسی.');
    }
  };

  // Handler Delete Items
  const handleDeleteItem = async (collection: 'curriculum_subjects' | 'curriculum_books' | 'curriculum_chapters', id: string, title: string) => {
    if (!window.confirm(`آیا از حذف «${title}» اطمینان دارید؟`)) return;
    try {
      await localDb.deleteDoc(collection, id);
      await loadAllData();
    } catch (err) {
      console.error(err);
      alert('خطا در حذف آیتم.');
    }
  };

  return (
    <div className="space-y-6 pb-12 font-vazir text-slate-800 dir-rtl">
      {/* Top Header & Page Navigation Tabs */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white rounded-2xl shadow-md shadow-indigo-200">
            <BookOpen size={26} />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              دروس گذرانده شده و سرفصل‌های آموزشی
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              مدیریت کارنامه دروس گذرانده، در جریان و مانده طلاب همراه با بانک سرفصل‌های دروس حوزه
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="p-1 bg-slate-100 rounded-2xl flex items-center border border-slate-200/80 shrink-0 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('students_progress')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'students_progress'
                ? "bg-white text-indigo-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Users size={15} />
            <span>وضعیت دروس گذرانده طلاب</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('curriculum_bank')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'curriculum_bank'
                ? "bg-white text-indigo-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Layers size={15} />
            <span>بانک دروس مصوب و سرفصل‌ها</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: STUDENTS COURSE PROGRESS LIST */}
      {activeTab === 'students_progress' && (
        <div className="space-y-5">
          {/* Summary KPI Cards Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold text-emerald-100 block">واحد‌های گذرانده شده (کل طلاب)</span>
                <span className="text-2xl font-black mt-1 block">{systemTotalStats.totalPassedCredits} <span className="text-xs font-bold opacity-80">واحد</span></span>
              </div>
              <div className="p-3 bg-white/15 rounded-xl backdrop-blur-sm">
                <CheckCircle2 size={24} className="text-emerald-100" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-sky-500 to-blue-700 text-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold text-sky-100 block">واحد‌های در حال گذراندن (در جریان)</span>
                <span className="text-2xl font-black mt-1 block">{systemTotalStats.totalInProgressCredits} <span className="text-xs font-bold opacity-80">واحد</span></span>
              </div>
              <div className="p-3 bg-white/15 rounded-xl backdrop-blur-sm">
                <Circle size={24} className="text-sky-100 fill-sky-200/30" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-rose-500 to-red-700 text-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold text-rose-100 block">واحد‌های باقی‌مانده (مانده)</span>
                <span className="text-2xl font-black mt-1 block">{systemTotalStats.totalRemainingCredits} <span className="text-xs font-bold opacity-80">واحد</span></span>
              </div>
              <div className="p-3 bg-white/15 rounded-xl backdrop-blur-sm">
                <XCircle size={24} className="text-rose-100" />
              </div>
            </div>
          </div>

          {/* Filters & Search Toolbar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="جستجوی طلبه (نام، نام خانوادگی، کد ملی)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 flex-wrap">
              <div className="flex items-center gap-1 text-xs font-bold text-slate-600">
                <Filter size={14} className="text-indigo-600" />
                <span>پایه:</span>
              </div>
              <select
                value={selectedGradeFilter}
                onChange={(e) => setSelectedGradeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">همه پایه‌های تحصیلی</option>
                <option value="پایه 1">پایه 1</option>
                <option value="پایه 2">پایه 2</option>
                <option value="پایه 3">پایه 3</option>
                <option value="پایه 4">پایه 4</option>
                <option value="پایه 5">پایه 5</option>
                <option value="پایه 6">پایه 6</option>
                <option value="پایه 7">پایه 7</option>
                <option value="پایه 8">پایه 8</option>
                <option value="پایه 9">پایه 9</option>
                <option value="پایه 10">پایه 10</option>
              </select>

              <button
                type="button"
                onClick={loadAllData}
                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="بروزرسانی داده‌ها"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {/* Students Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-extrabold">
                  <tr>
                    <th className="p-3.5 pr-5">طلبه (نام و نام خانوادگی)</th>
                    <th className="p-3.5">پایه تحصیلی</th>
                    <th className="p-3.5">🟢 گذرانده شده</th>
                    <th className="p-3.5">🔵 در حال گذراندن</th>
                    <th className="p-3.5">🔴 باقی‌مانده</th>
                    <th className="p-3.5 text-center">پیشرفت</th>
                    <th className="p-3.5 text-center pl-5">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                        هیچ طلبی با فیلترهای انتخابی یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(student => {
                      const stats = studentStatsMap[student.id] || {
                        passedCount: 0,
                        inProgressCount: 0,
                        remainingCount: 0,
                        passedCredits: 0,
                        inProgressCredits: 0,
                        remainingCredits: 0,
                        percentCompleted: 0
                      };

                      const fullName = getStudentFullName(student);

                      return (
                        <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5 pr-5">
                            <div className="flex items-center gap-3">
                              {student.photoUrl ? (
                                <img src={student.photoUrl} alt={fullName} className="w-9 h-9 rounded-full object-cover border border-slate-200" />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-black flex items-center justify-center text-xs">
                                  {fullName.charAt(0)}
                                </div>
                              )}
                              <div>
                                <span className="font-black text-slate-900 block text-xs sm:text-sm">{fullName}</span>
                                <span className="text-[10px] text-slate-400 font-mono font-semibold">
                                  کد ملی: {student.nationalId || 'نامشخص'} {student.studentCode ? `• کد: ${student.studentCode}` : ''}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="p-3.5">
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-black">
                              {student.grade || 'عمومی'}
                            </span>
                          </td>

                          <td className="p-3.5">
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-black text-[11px] inline-flex items-center gap-1">
                              <CheckCircle2 size={13} className="text-emerald-600" />
                              <span>{stats.passedCredits} واحد ({stats.passedCount} درس)</span>
                            </span>
                          </td>

                          <td className="p-3.5">
                            <span className="px-2.5 py-1 bg-sky-50 text-sky-800 border border-sky-200 rounded-lg font-black text-[11px] inline-flex items-center gap-1">
                              <Circle size={12} className="text-sky-600 fill-sky-300/40" />
                              <span>{stats.inProgressCredits} واحد ({stats.inProgressCount} درس)</span>
                            </span>
                          </td>

                          <td className="p-3.5">
                            <span className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg font-black text-[11px] inline-flex items-center gap-1">
                              <XCircle size={13} className="text-rose-600" />
                              <span>{stats.remainingCredits} واحد ({stats.remainingCount} درس)</span>
                            </span>
                          </td>

                          <td className="p-3.5 text-center">
                            <div className="w-24 mx-auto space-y-1">
                              <div className="flex items-center justify-between text-[10px] font-black text-slate-600">
                                <span>{stats.percentCompleted}٪</span>
                              </div>
                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div 
                                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                                  style={{ width: `${stats.percentCompleted}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="p-3.5 text-center pl-5">
                            <button
                              type="button"
                              onClick={() => setSelectedStudentForModal(student)}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-black shadow-xs transition-all flex items-center gap-1.5 mx-auto cursor-pointer"
                            >
                              <BookOpen size={13} />
                              <span>مشاهده و ویرایش ریز دروس</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: CURRICULUM COURSES BANK */}
      {activeTab === 'curriculum_bank' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                مرجع اصلی بانک دروس و سرفصل‌های مصوب
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                تعریف دسته‌بندی موضوعی (اصول، فقه، فلسفه و...)، کتب درسی و مجلدات/سرفصل‌ها جهت استفاده در برنامه‌ریزی دروس
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setEditingSubject({});
                  setIsSubjectModalOpen(true);
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} />
                <span>افزودن ماده درسی جدید</span>
              </button>
            </div>
          </div>

          {/* Subjects Grid & Tree View */}
          <div className="space-y-6">
            {subjects.map(subject => {
              const subjectBooks = books.filter(b => b.subjectId === subject.id || b.subjectTitle === subject.title);

              return (
                <div key={subject.id} className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
                  {/* Subject Header */}
                  <div className="bg-slate-50/90 p-4 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl font-black">
                        <BookOpen size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                          <span>{subject.title}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full font-bold">
                            {subjectBooks.length} کتاب
                          </span>
                        </h3>
                        {subject.description && <p className="text-[11px] text-slate-500 font-medium">{subject.description}</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBook({ subjectId: subject.id, subjectTitle: subject.title, credits: 4 });
                          setIsBookModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>افزودن کتاب به «{subject.title}»</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingSubject(subject);
                          setIsSubjectModalOpen(true);
                        }}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                        title="ویرایش ماده درسی"
                      >
                        <Edit3 size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteItem('curriculum_subjects', subject.id, subject.title)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="حذف"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Books List inside Subject */}
                  <div className="p-4 sm:p-5 space-y-4">
                    {subjectBooks.length === 0 ? (
                      <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-medium">
                        هنوز هیچ کتابی برای ماده درسی «{subject.title}» تعریف نشده است.
                      </div>
                    ) : (
                      subjectBooks.map(book => {
                        const bookChapters = chapters.filter(c => c.bookId === book.id || c.bookTitle === book.title);

                        return (
                          <div key={book.id} className="bg-slate-50/60 border border-slate-200 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-xs sm:text-sm text-slate-900">📖 {book.title}</span>
                                <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md font-extrabold">
                                  {book.credits} واحد
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingChapter({ bookId: book.id, bookTitle: book.title, subjectId: subject.id, subjectTitle: subject.title, credits: 2 });
                                    setIsChapterModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus size={12} />
                                  <span>افزودن بخش/سرفصل</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingBook(book);
                                    setIsBookModalOpen(true);
                                  }}
                                  className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg cursor-pointer"
                                  title="ویرایش کتاب"
                                >
                                  <Edit3 size={14} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem('curriculum_books', book.id, book.title)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                                  title="حذف کتاب"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            {/* Chapters Chips List */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                              {bookChapters.length === 0 ? (
                                <div className="col-span-full text-[11px] text-slate-400 italic">
                                  بخشی برای این کتاب درج نشده است.
                                </div>
                              ) : (
                                bookChapters.map(chap => (
                                  <div key={chap.id} className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between shadow-2xs">
                                    <div>
                                      <span className="font-bold text-xs text-slate-800 block">{chap.title}</span>
                                      <span className="text-[10px] text-slate-400 font-medium">{chap.credits} واحد</span>
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingChapter(chap);
                                          setIsChapterModalOpen(true);
                                        }}
                                        className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                                      >
                                        <Edit3 size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteItem('curriculum_chapters', chap.id, chap.title)}
                                        className="p-1 text-slate-300 hover:text-rose-600 rounded cursor-pointer"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STUDENT DETAILS & COURSE PROGRESS MODAL */}
      {selectedStudentForModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                {selectedStudentForModal.photoUrl ? (
                  <img src={selectedStudentForModal.photoUrl} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-indigo-400" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-indigo-600 text-white font-black flex items-center justify-center text-lg">
                    {getStudentFullName(selectedStudentForModal).charAt(0)}
                  </div>
                )}
                <div>
                  <h3 className="text-base sm:text-lg font-black">{getStudentFullName(selectedStudentForModal)}</h3>
                  <div className="flex items-center gap-3 text-xs text-slate-300 font-medium mt-0.5">
                    <span>{selectedStudentForModal.grade || 'پایه عمومی'}</span>
                    <span>• کد ملی: {selectedStudentForModal.nationalId || 'نامشخص'}</span>
                    {selectedStudentForModal.phoneNumber && <span>• همراه: {selectedStudentForModal.phoneNumber}</span>}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStudentForModal(null)}
                className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-6 flex-1">
              {/* Progress KPI Ribbon */}
              {(() => {
                const stats = studentStatsMap[selectedStudentForModal.id] || {
                  passedCount: 0,
                  inProgressCount: 0,
                  remainingCount: 0,
                  passedCredits: 0,
                  inProgressCredits: 0,
                  remainingCredits: 0,
                  percentCompleted: 0
                };

                return (
                  <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div className="text-center p-2.5 bg-emerald-50 text-emerald-900 rounded-xl border border-emerald-200">
                      <span className="text-[11px] font-bold text-emerald-700 block">🟢 گذرانده شده</span>
                      <span className="text-lg font-black mt-0.5 block">{stats.passedCredits} واحد <span className="text-xs font-normal">({stats.passedCount} درس)</span></span>
                    </div>

                    <div className="text-center p-2.5 bg-sky-50 text-sky-900 rounded-xl border border-sky-200">
                      <span className="text-[11px] font-bold text-sky-700 block">🔵 در جریان (تحصیل)</span>
                      <span className="text-lg font-black mt-0.5 block">{stats.inProgressCredits} واحد <span className="text-xs font-normal">({stats.inProgressCount} درس)</span></span>
                    </div>

                    <div className="text-center p-2.5 bg-rose-50 text-rose-900 rounded-xl border border-rose-200">
                      <span className="text-[11px] font-bold text-rose-700 block">🔴 مانده (باقی‌مانده)</span>
                      <span className="text-lg font-black mt-0.5 block">{stats.remainingCredits} واحد <span className="text-xs font-normal">({stats.remainingCount} درس)</span></span>
                    </div>
                  </div>
                );
              })()}

              {/* Curriculum Tree with Status Toggles */}
              <div className="space-y-5">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={15} className="text-indigo-600" />
                  <span>جدول ریز تفکیکی دروس و سرفصل‌ها (قابل ویرایش توسط مسئول آموزش)</span>
                </h4>

                {subjects.map(subject => {
                  const subjectBooks = books.filter(b => b.subjectId === subject.id || b.subjectTitle === subject.title);

                  return (
                    <div key={subject.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                      <div className="bg-slate-100/90 p-3 font-black text-xs text-slate-900 border-b border-slate-200 flex items-center justify-between">
                        <span>📚 {subject.title}</span>
                      </div>

                      <div className="p-3 space-y-4">
                        {subjectBooks.map(book => {
                          const bookChapters = chapters.filter(c => c.bookId === book.id || c.bookTitle === book.title);

                          return (
                            <div key={book.id} className="space-y-2">
                              <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                <span>📖 {book.title} ({book.credits} واحد)</span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {bookChapters.map(chap => {
                                  const progRec = progressRecords.find(p => p.studentId === selectedStudentForModal.id && p.chapterId === chap.id);
                                  const currentStatus: CourseProgressStatus = progRec?.status || 'remaining';

                                  return (
                                    <div key={chap.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <span className="font-bold text-xs text-slate-900 block truncate">{chap.title}</span>
                                        <span className="text-[10px] text-slate-400 font-medium">{chap.credits} واحد</span>
                                      </div>

                                      {/* Status Toggle Buttons */}
                                      <div className="flex items-center gap-1 shrink-0">
                                        {/* Passed button (Green Check) */}
                                        <button
                                          type="button"
                                          onClick={() => handleToggleChapterStatus(selectedStudentForModal.id, chap, 'passed')}
                                          className={cn(
                                            "p-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[10px] font-black",
                                            currentStatus === 'passed'
                                              ? "bg-emerald-600 text-white shadow-xs"
                                              : "bg-slate-200 hover:bg-emerald-100 text-slate-600 hover:text-emerald-800"
                                          )}
                                          title="علامت‌گذاری به عنوان گذرانده شده"
                                        >
                                          <CheckCircle2 size={14} />
                                          <span className="hidden sm:inline">گذرانده</span>
                                        </button>

                                        {/* In-Progress button (Blue Circle) */}
                                        <button
                                          type="button"
                                          onClick={() => handleToggleChapterStatus(selectedStudentForModal.id, chap, 'in_progress')}
                                          className={cn(
                                            "p-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[10px] font-black",
                                            currentStatus === 'in_progress'
                                              ? "bg-sky-600 text-white shadow-xs"
                                              : "bg-slate-200 hover:bg-sky-100 text-slate-600 hover:text-sky-800"
                                          )}
                                          title="علامت‌گذاری به عنوان در جریان تحصیل"
                                        >
                                          <Circle size={13} className={currentStatus === 'in_progress' ? 'fill-white' : ''} />
                                          <span className="hidden sm:inline">در جریان</span>
                                        </button>

                                        {/* Remaining button (Red Cross) */}
                                        <button
                                          type="button"
                                          onClick={() => handleToggleChapterStatus(selectedStudentForModal.id, chap, 'remaining')}
                                          className={cn(
                                            "p-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[10px] font-black",
                                            currentStatus === 'remaining'
                                              ? "bg-rose-600 text-white shadow-xs"
                                              : "bg-slate-200 hover:bg-rose-100 text-slate-600 hover:text-rose-800"
                                          )}
                                          title="علامت‌گذاری به عنوان مانده"
                                        >
                                          <XCircle size={14} />
                                          <span className="hidden sm:inline">مانده</span>
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedStudentForModal(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                بستن پنجره
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBJECT MODAL */}
      {isSubjectModalOpen && editingSubject && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl w-full max-w-md space-y-4 dir-rtl">
            <h3 className="text-sm font-black text-slate-900">
              {editingSubject.id ? 'ویرایش ماده درسی' : 'افزودن ماده درسی جدید'}
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">عنوان ماده درسی (مثلا اصول فقه، فقه، فلسفه)</label>
              <input
                type="text"
                value={editingSubject.title || ''}
                onChange={(e) => setEditingSubject({ ...editingSubject, title: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
                placeholder="عنوان ماده درسی..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">توضیحات تکمیلی</label>
              <textarea
                value={editingSubject.description || ''}
                onChange={(e) => setEditingSubject({ ...editingSubject, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
                rows={3}
                placeholder="توضیحات کوتاه..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSubjectModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveSubject}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black"
              >
                ذخیره ماده درسی
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOOK MODAL */}
      {isBookModalOpen && editingBook && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl w-full max-w-md space-y-4 dir-rtl">
            <h3 className="text-sm font-black text-slate-900">
              {editingBook.id ? 'ویرایش کتاب درسی' : 'افزودن کتاب درسی جدید'}
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">ماده درسی مربوطه</label>
              <select
                value={editingBook.subjectId || ''}
                onChange={(e) => setEditingBook({ ...editingBook, subjectId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
              >
                <option value="">انتخاب کنید...</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">عنوان کتاب (مثلا رسائل، مکاسب، کفایه)</label>
              <input
                type="text"
                value={editingBook.title || ''}
                onChange={(e) => setEditingBook({ ...editingBook, title: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
                placeholder="عنوان کتاب..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">تعداد واحدها</label>
              <input
                type="number"
                value={editingBook.credits || 4}
                onChange={(e) => setEditingBook({ ...editingBook, credits: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBookModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveBook}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black"
              >
                ذخیره کتاب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHAPTER MODAL */}
      {isChapterModalOpen && editingChapter && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl w-full max-w-md space-y-4 dir-rtl">
            <h3 className="text-sm font-black text-slate-900">
              {editingChapter.id ? 'ویرایش سرفصل/بخش درسی' : 'افزودن سرفصل/بخش درسی جدید'}
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">کتاب درسی مربوطه</label>
              <select
                value={editingChapter.bookId || ''}
                onChange={(e) => setEditingChapter({ ...editingChapter, bookId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
              >
                <option value="">انتخاب کنید...</option>
                {books.map(b => (
                  <option key={b.id} value={b.id}>{b.subjectTitle} ← {b.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">عنوان سرفصل/بخش (مثلا بخش قطع و ظن)</label>
              <input
                type="text"
                value={editingChapter.title || ''}
                onChange={(e) => setEditingChapter({ ...editingChapter, title: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
                placeholder="عنوان سرفصل..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">تعداد واحدها</label>
              <input
                type="number"
                value={editingChapter.credits || 2}
                onChange={(e) => setEditingChapter({ ...editingChapter, credits: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsChapterModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveChapter}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black"
              >
                ذخیره سرفصل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
