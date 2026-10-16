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
  Layers, 
  X, 
  RefreshCw,
  Sparkles,
  Filter,
  Users,
  CheckSquare
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
  
  // Access authorization check
  const isSuperAdmin = currentUser?.role === 'super_admin' || currentUser?.level === 1;
  const isEducationManager = currentUser?.role === 'education_manager' || currentUser?.level === 2;

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

  // Student Details Modal State
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<Student | null>(null);

  // Finalize In-Progress Courses Modal
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState<boolean>(false);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);

  // Custom Student Passed Course Form
  const [customSubjectTitle, setCustomSubjectTitle] = useState<string>('اصول فقه');
  const [customBookTitle, setCustomBookTitle] = useState<string>('');
  const [customChapterTitle, setCustomChapterTitle] = useState<string>('');
  const [isAddingCustomCourse, setIsAddingCustomCourse] = useState<boolean>(false);

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
      // Ensure seed data and purge non-allowed subjects / duplicates
      const seed = await StudentCourseProgressService.ensureDefaultCurriculumData();
      
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

  const getStudentFullName = (s: Student): string => {
    if (s.firstName || s.lastName) {
      return `${s.firstName || ''} ${s.lastName || ''}`.trim();
    }
    return s.name || 'طلبه نامشخص';
  };

  // Filtered Students List
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (selectedGradeFilter !== 'all' && s.grade !== selectedGradeFilter) {
        return false;
      }
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

  // Compute student summary progress stats map (Count of COURSES, NO CREDITS / NO UNITHA)
  const studentStatsMap = useMemo(() => {
    const map: Record<string, {
      passedCount: number;
      inProgressCount: number;
      remainingCount: number;
      totalCount: number;
      percentCompleted: number;
    }> = {};

    const totalChaptersCount = chapters.length;

    students.forEach(s => {
      const studentProgs = progressRecords.filter(p => p.studentId === s.id);

      let passedCount = 0;
      let inProgressCount = 0;

      chapters.forEach(ch => {
        const progRec = studentProgs.find(p => p.chapterId === ch.id || p.chapterTitle === ch.title);
        if (progRec?.status === 'passed') {
          passedCount++;
        } else if (progRec?.status === 'in_progress') {
          inProgressCount++;
        }
      });

      // Count custom passed courses that might not be in standard chapter list
      const customPassed = studentProgs.filter(p => p.status === 'passed' && !chapters.some(ch => ch.id === p.chapterId));
      passedCount += customPassed.length;

      const remainingCount = Math.max(0, totalChaptersCount - passedCount - inProgressCount);
      const denominator = Math.max(1, totalChaptersCount);
      const percentCompleted = Math.min(100, Math.round((passedCount / denominator) * 100));

      map[s.id] = {
        passedCount,
        inProgressCount,
        remainingCount,
        totalCount: totalChaptersCount,
        percentCompleted
      };
    });

    return map;
  }, [students, chapters, progressRecords]);

  // Total System Stats (NO CREDITS)
  const systemTotalStats = useMemo(() => {
    let totalPassed = 0;
    let totalInProgress = 0;
    let totalRemaining = 0;

    Object.values(studentStatsMap).forEach(st => {
      totalPassed += st.passedCount;
      totalInProgress += st.inProgressCount;
      totalRemaining += st.remainingCount;
    });

    return {
      totalPassed,
      totalInProgress,
      totalRemaining
    };
  }, [studentStatsMap]);

  // Finalize all in-progress courses for end of year
  const handleFinalizeInProgressCourses = async () => {
    setIsFinalizing(true);
    try {
      const updatedUser = currentUser?.fullName || currentUser?.name || currentUser?.username || 'مسئول آموزش';
      const nowIso = new Date().toISOString();

      let convertedCount = 0;

      // 1. Convert all existing in_progress records to passed
      const allProgress = await localDb.getDocs<StudentCourseProgress>('student_course_progress');

      for (const rec of allProgress) {
        if (rec.status === 'in_progress') {
          const updatedDoc: StudentCourseProgress = {
            ...rec,
            status: 'passed',
            passedAt: nowIso,
            passedByName: updatedUser,
            updatedAt: nowIso
          };
          await localDb.setDoc('student_course_progress', updatedDoc);
          convertedCount++;
        }
      }

      // 2. For active enrolled main programs, mark their course status as passed in student records
      for (const st of students) {
        const myEnrolls = enrollments.filter(e => e.studentId === st.id);
        const enrolledProgIds = new Set(myEnrolls.map(e => e.programId));
        const myMainProgs = programs.filter(p => p.type === 'اصلی' && (enrolledProgIds.has(p.id) || p.grade === st.grade));

        for (const prog of myMainProgs) {
          const matchedChap = chapters.find(c => prog.title.includes(c.title) || prog.title.includes(c.bookTitle)) || chapters[0];
          if (matchedChap) {
            const recId = `progress_${st.id}_${matchedChap.id}`;
            const existing = allProgress.find(p => p.id === recId || (p.studentId === st.id && p.chapterId === matchedChap.id));

            if (!existing || existing.status !== 'passed') {
              const newDoc: StudentCourseProgress = {
                id: existing?.id || recId,
                studentId: st.id,
                subjectId: matchedChap.subjectId,
                subjectTitle: matchedChap.subjectTitle,
                bookId: matchedChap.bookId,
                bookTitle: matchedChap.bookTitle,
                chapterId: matchedChap.id,
                chapterTitle: matchedChap.title,
                status: 'passed',
                passedAt: nowIso,
                passedByName: updatedUser,
                updatedAt: nowIso
              };
              await localDb.setDoc('student_course_progress', newDoc);
              convertedCount++;
            }
          }
        }
      }

      setIsFinalizeModalOpen(false);
      await loadAllData();
      alert(`✅ با موفقیت تمامی درس‌های در حال جریان طلاب (${convertedCount} مورد) نهایی گردیده و در سابقه علمی طلاب به عنوان «گذرانده شده» ثبت شد.`);
    } catch (err: any) {
      console.error('Error finalizing in-progress courses:', err);
      alert('خطا در نهایی‌سازی دروس در حال جریان: ' + (err?.message || ''));
    } finally {
      setIsFinalizing(false);
    }
  };

  // Toggle status of a chapter for a student directly
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

      setProgressRecords(prev => {
        const filtered = prev.filter(p => p.id !== updatedRecord.id && !(p.studentId === studentId && p.chapterId === chapter.id));
        return [...filtered, updatedRecord];
      });
    } catch (err) {
      console.error('Error updating course progress status:', err);
      alert('خطا در ذخیره وضعیت درس.');
    }
  };

  // Add custom passed course to student
  const handleAddCustomPassedCourse = async (studentId: string) => {
    if (!customBookTitle.trim() || !customChapterTitle.trim()) {
      alert('لطفاً عنوان کتاب و بخش را وارد نمایید.');
      return;
    }

    try {
      const recId = `custom_prog_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const newRec: StudentCourseProgress = {
        id: recId,
        studentId,
        subjectId: `subj_${Date.now()}`,
        subjectTitle: customSubjectTitle.trim(),
        bookId: `book_${Date.now()}`,
        bookTitle: customBookTitle.trim(),
        chapterId: `chap_${Date.now()}`,
        chapterTitle: customChapterTitle.trim(),
        status: 'passed',
        passedAt: new Date().toISOString(),
        passedByName: currentUser?.fullName || currentUser?.name || currentUser?.username || 'مسئول آموزش',
        updatedAt: new Date().toISOString()
      };

      await localDb.setDoc('student_course_progress', newRec);
      setProgressRecords(prev => [...prev, newRec]);
      setCustomBookTitle('');
      setCustomChapterTitle('');
      setIsAddingCustomCourse(false);
      alert('✅ درس گذرانده جدید با موفقیت در سابقه علمی طلبه ثبت گردید.');
    } catch (err) {
      console.error('Error adding custom course:', err);
      alert('خطا در ثبت درس.');
    }
  };

  // Handlers for Curriculum Bank Modals with full cascading sync & real-time notification
  const handleSaveSubject = async () => {
    if (!editingSubject?.title?.trim()) {
      alert('لطفاً عنوان ماده درسی را وارد کنید.');
      return;
    }

    try {
      const oldSubject = subjects.find(s => s.id === editingSubject.id);
      const oldTitle = oldSubject?.title;
      const newTitle = editingSubject.title.trim();

      const doc: CurriculumSubject = {
        id: editingSubject.id || `subj_${Date.now()}`,
        title: newTitle,
        code: editingSubject.code || '',
        description: editingSubject.description || '',
        orderIndex: editingSubject.orderIndex || subjects.length + 1,
        color: editingSubject.color || 'indigo',
        createdAt: editingSubject.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await localDb.setDoc('curriculum_subjects', doc);

      // Cascading update if title changed
      if (oldTitle && oldTitle !== newTitle) {
        // 1. Update books
        const allBooks = await localDb.getDocs<CurriculumBook>('curriculum_books');
        for (const b of allBooks) {
          if (b.subjectId === doc.id || b.subjectTitle === oldTitle) {
            await localDb.setDoc('curriculum_books', { ...b, subjectTitle: newTitle, updatedAt: new Date().toISOString() });
          }
        }
        // 2. Update chapters
        const allChapters = await localDb.getDocs<CurriculumChapter>('curriculum_chapters');
        for (const ch of allChapters) {
          if (ch.subjectId === doc.id || ch.subjectTitle === oldTitle) {
            await localDb.setDoc('curriculum_chapters', { ...ch, subjectTitle: newTitle, updatedAt: new Date().toISOString() });
          }
        }
        // 3. Update student course progress
        const allProgress = await localDb.getDocs<StudentCourseProgress>('student_course_progress');
        for (const p of allProgress) {
          if (p.subjectId === doc.id || p.subjectTitle === oldTitle) {
            await localDb.setDoc('student_course_progress', { ...p, subjectTitle: newTitle, updatedAt: new Date().toISOString() });
          }
        }
        // 4. Update programs
        const allPrograms = await localDb.getDocs<Program>('programs');
        for (const pr of allPrograms) {
          if (pr.subjectCategory === oldTitle) {
            await localDb.setDoc('programs', { ...pr, subjectCategory: newTitle, updatedAt: new Date().toISOString() });
          }
        }
      }

      window.dispatchEvent(new CustomEvent('collection_change_curriculum_subjects'));
      window.dispatchEvent(new CustomEvent('app_data_change'));

      setIsSubjectModalOpen(false);
      setEditingSubject(null);
      await loadAllData();
    } catch (err) {
      console.error(err);
      alert('خطا در ذخیره ماده درسی.');
    }
  };

  const handleSaveBook = async () => {
    if (!editingBook?.title?.trim() || !editingBook?.subjectId) {
      alert('لطفاً عنوان کتاب و عنوان درسی مربوطه را تعیین کنید.');
      return;
    }

    const parentSubj = subjects.find(s => s.id === editingBook.subjectId);

    try {
      const oldBook = books.find(b => b.id === editingBook.id);
      const oldTitle = oldBook?.title;
      const newTitle = editingBook.title.trim();

      const doc: CurriculumBook = {
        id: editingBook.id || `book_${Date.now()}`,
        subjectId: editingBook.subjectId,
        subjectTitle: parentSubj?.title || editingBook.subjectTitle || 'اصول',
        title: newTitle,
        credits: 1,
        orderIndex: editingBook.orderIndex || books.length + 1,
        description: editingBook.description || '',
        createdAt: editingBook.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await localDb.setDoc('curriculum_books', doc);

      // Cascading update if title changed
      if (oldTitle && oldTitle !== newTitle) {
        // 1. Update chapters
        const allChapters = await localDb.getDocs<CurriculumChapter>('curriculum_chapters');
        for (const ch of allChapters) {
          if (ch.bookId === doc.id || ch.bookTitle === oldTitle) {
            await localDb.setDoc('curriculum_chapters', { ...ch, bookTitle: newTitle, updatedAt: new Date().toISOString() });
          }
        }
        // 2. Update student course progress
        const allProgress = await localDb.getDocs<StudentCourseProgress>('student_course_progress');
        for (const p of allProgress) {
          if (p.bookId === doc.id || p.bookTitle === oldTitle) {
            await localDb.setDoc('student_course_progress', { ...p, bookTitle: newTitle, updatedAt: new Date().toISOString() });
          }
        }
        // 3. Update programs
        const allPrograms = await localDb.getDocs<Program>('programs');
        for (const pr of allPrograms) {
          if (pr.subjectBook === oldTitle) {
            await localDb.setDoc('programs', { ...pr, subjectBook: newTitle, updatedAt: new Date().toISOString() });
          }
        }
      }

      window.dispatchEvent(new CustomEvent('collection_change_curriculum_books'));
      window.dispatchEvent(new CustomEvent('app_data_change'));

      setIsBookModalOpen(false);
      setEditingBook(null);
      await loadAllData();
    } catch (err) {
      console.error(err);
      alert('خطا در ذخیره کتاب.');
    }
  };

  const handleSaveChapter = async () => {
    if (!editingChapter?.title?.trim() || !editingChapter?.bookId) {
      alert('لطفاً عنوان بخش و کتاب مربوطه را تعیین کنید.');
      return;
    }

    const parentBook = books.find(b => b.id === editingChapter.bookId);

    try {
      const oldChapter = chapters.find(c => c.id === editingChapter.id);
      const oldTitle = oldChapter?.title;
      const newTitle = editingChapter.title.trim();

      const doc: CurriculumChapter = {
        id: editingChapter.id || `chap_${Date.now()}`,
        bookId: editingChapter.bookId,
        bookTitle: parentBook?.title || editingChapter.bookTitle || '',
        subjectId: parentBook?.subjectId || editingChapter.subjectId || '',
        subjectTitle: parentBook?.subjectTitle || editingChapter.subjectTitle || '',
        title: newTitle,
        credits: 1,
        orderIndex: editingChapter.orderIndex || chapters.length + 1,
        description: editingChapter.description || '',
        createdAt: editingChapter.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await localDb.setDoc('curriculum_chapters', doc);

      // Cascading update if title changed
      if (oldTitle && oldTitle !== newTitle) {
        // 1. Update student course progress
        const allProgress = await localDb.getDocs<StudentCourseProgress>('student_course_progress');
        for (const p of allProgress) {
          if (p.chapterId === doc.id || p.chapterTitle === oldTitle) {
            await localDb.setDoc('student_course_progress', { ...p, chapterTitle: newTitle, updatedAt: new Date().toISOString() });
          }
        }
        // 2. Update programs
        const allPrograms = await localDb.getDocs<Program>('programs');
        for (const pr of allPrograms) {
          if (pr.chapterId === doc.id || pr.subjectChapter === oldTitle) {
            await localDb.setDoc('programs', { ...pr, subjectChapter: newTitle, updatedAt: new Date().toISOString() });
          }
        }
      }

      window.dispatchEvent(new CustomEvent('collection_change_curriculum_chapters'));
      window.dispatchEvent(new CustomEvent('app_data_change'));

      setIsChapterModalOpen(false);
      setEditingChapter(null);
      await loadAllData();
    } catch (err) {
      console.error(err);
      alert('خطا در ذخیره بخش درسی.');
    }
  };

  const handleDeleteItem = async (collection: 'curriculum_subjects' | 'curriculum_books' | 'curriculum_chapters', id: string, title: string) => {
    if (!window.confirm(`آیا از حذف «${title}» اطمینان دارید؟`)) return;
    try {
      await localDb.deleteDoc(collection, id);

      if (collection === 'curriculum_subjects') {
        const childBooks = books.filter(b => b.subjectId === id || b.subjectTitle === title);
        for (const b of childBooks) {
          await localDb.deleteDoc('curriculum_books', b.id);
          const childChaps = chapters.filter(c => c.bookId === b.id || c.bookTitle === b.title);
          for (const ch of childChaps) {
            await localDb.deleteDoc('curriculum_chapters', ch.id);
          }
        }
      } else if (collection === 'curriculum_books') {
        const childChaps = chapters.filter(c => c.bookId === id || c.bookTitle === title);
        for (const ch of childChaps) {
          await localDb.deleteDoc('curriculum_chapters', ch.id);
        }
      }

      window.dispatchEvent(new CustomEvent(`collection_change_${collection}`));
      window.dispatchEvent(new CustomEvent('app_data_change'));

      await loadAllData();
    } catch (err) {
      console.error(err);
      alert('خطا در حذف آیتم.');
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center font-vazir text-slate-600 bg-white rounded-3xl border border-slate-200">
        <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold">در حال بارگذاری بانک دروس گذرانده شده...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 font-vazir text-slate-800 dir-rtl">
      {/* Top Header & Navigation Tabs */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white rounded-2xl shadow-md shadow-indigo-200">
            <BookOpen size={26} />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              دروس گذرانده شده و بانک سرفصل‌های آموزشی
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              مدیریت کارنامه دروس گذرانده، در جریان و مانده طلاب با ساختار «عنوان / کتاب / بخش»
            </p>
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
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
            <span>بانک دروس مصوب (اصول، فقه، فلسفه)</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: STUDENTS COURSE PROGRESS LIST */}
      {activeTab === 'students_progress' && (
        <div className="space-y-5">
          {/* Action Ribbon: Finalize End-of-Year Courses Button */}
          {(isSuperAdmin || isEducationManager) && (
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-5 rounded-3xl text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 border border-indigo-900/40">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <Sparkles size={16} />
                  <span>عملیات پایان سال تحصیلی مسئول آموزش</span>
                </div>
                <h3 className="text-sm sm:text-base font-black text-white">
                  نهایی‌سازی کلی دروس در حال جریان کلیه طلاب
                </h3>
                <p className="text-xs text-indigo-200/80 font-medium">
                  تبدیل خودکار تمامی دروس در حال جریان (آبی) به وضعیت «گذرانده شده» (سبز) و ثبت دائم در سابقه علمی.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsFinalizeModalOpen(true)}
                className="px-5 py-3 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-slate-950 font-black text-xs sm:text-sm rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shrink-0 border border-emerald-300/40"
              >
                <CheckSquare size={18} className="text-slate-950" />
                <span>نهایی کردن درس‌های در حال جریان و ثبت در سابقه علمی طلاب</span>
              </button>
            </div>
          )}

          {/* Summary KPI Cards Ribbon (NO CREDITS) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold text-emerald-100 block">دروس گذرانده شده (کل طلاب)</span>
                <span className="text-2xl font-black mt-1 block">{systemTotalStats.totalPassed} <span className="text-xs font-bold opacity-80">درس</span></span>
              </div>
              <div className="p-3 bg-white/15 rounded-xl backdrop-blur-sm">
                <CheckCircle2 size={24} className="text-emerald-100" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-sky-500 to-blue-700 text-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold text-sky-100 block">دروس در حال گذراندن (در جریان)</span>
                <span className="text-2xl font-black mt-1 block">{systemTotalStats.totalInProgress} <span className="text-xs font-bold opacity-80">درس</span></span>
              </div>
              <div className="p-3 bg-white/15 rounded-xl backdrop-blur-sm">
                <Circle size={24} className="text-sky-100 fill-sky-200/30" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-rose-500 to-red-700 text-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold text-rose-100 block">دروس باقی‌مانده (مانده)</span>
                <span className="text-2xl font-black mt-1 block">{systemTotalStats.totalRemaining} <span className="text-xs font-bold opacity-80">درس</span></span>
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

          {/* Students Table (NO CREDITS / NO UNITHA) */}
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
                    <th className="p-3.5 text-center">پیشرفت درصد</th>
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
                        totalCount: 0,
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
                              <span>{stats.passedCount} درس گذرانده</span>
                            </span>
                          </td>

                          <td className="p-3.5">
                            <span className="px-2.5 py-1 bg-sky-50 text-sky-800 border border-sky-200 rounded-lg font-black text-[11px] inline-flex items-center gap-1">
                              <Circle size={12} className="text-sky-600 fill-sky-300/40" />
                              <span>{stats.inProgressCount} درس در جریان</span>
                            </span>
                          </td>

                          <td className="p-3.5">
                            <span className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg font-black text-[11px] inline-flex items-center gap-1">
                              <XCircle size={13} className="text-rose-600" />
                              <span>{stats.remainingCount} درس مانده</span>
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
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-black shadow-xs transition-all flex items-center gap-1.5 mx-auto cursor-pointer"
                            >
                              <BookOpen size={13} />
                              <span>مشاهده و ویرایش سابقه علمی</span>
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

      {/* SUB-TAB 2: CURRICULUM COURSES BANK (ONLY TITLE / BOOK / CHAPTER) */}
      {activeTab === 'curriculum_bank' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                مرجع اصلی بانک دروس و سرفصل‌های مصوب
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                قالب ثبت: <strong>عنوان</strong> (اصول، فقه، فلسفه) ← <strong>کتاب</strong> (مثلاً رسائل) ← <strong>بخش</strong> (مثلاً قطع و ظن)
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
                <span>افزودن عنوان درسی جدید</span>
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
                          <span>عنوان: {subject.title}</span>
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
                          setEditingBook({ subjectId: subject.id, subjectTitle: subject.title, credits: 1 });
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
                        title="ویرایش عنوان"
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
                        هنوز هیچ کتابی برای عنوان «{subject.title}» تعریف نشده است.
                      </div>
                    ) : (
                      subjectBooks.map(book => {
                        const bookChapters = chapters.filter(c => c.bookId === book.id || c.bookTitle === book.title);

                        return (
                          <div key={book.id} className="bg-slate-50/60 border border-slate-200 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-xs sm:text-sm text-slate-900">📖 کتاب: {book.title}</span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingChapter({ bookId: book.id, bookTitle: book.title, subjectId: subject.id, subjectTitle: subject.title, credits: 1 });
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

                            {/* Chapters Chips List (NO CREDITS) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                              {bookChapters.length === 0 ? (
                                <div className="col-span-full text-[11px] text-slate-400 italic">
                                  بخشی برای این کتاب درج نشده است.
                                </div>
                              ) : (
                                bookChapters.map(chap => (
                                  <div key={chap.id} className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between shadow-2xs">
                                    <div>
                                      <span className="font-bold text-xs text-slate-800 block">📌 بخش: {chap.title}</span>
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

      {/* MODAL: FINALIZE IN-PROGRESS COURSES */}
      {isFinalizeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl w-full max-w-lg space-y-4 dir-rtl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="text-emerald-600" />
                <h3 className="text-base font-black text-slate-900">
                  نهایی کردن درس‌های در حال جریان و ثبت در سابقه علمی طلاب
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFinalizeModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl text-xs text-emerald-950 font-medium leading-relaxed space-y-2">
              <p>
                <strong>راهنمای مسئول آموزش و سوپر ادمین:</strong>
              </p>
              <p>
                با فشردن این دکمه در پایان سال تحصیلی، تمامی دروس در حال جریان (آبی) طلاب به عنوان «گذرانده شده» (سبز 🟢) نهایی می‌گردند و به طور دائم در کارنامه و سابقه علمی تک‌تک طلاب ثبت خواهند شد.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsFinalizeModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isFinalizing}
                onClick={handleFinalizeInProgressCourses}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 size={16} />
                <span>{isFinalizing ? 'در حال ثبت نهایی...' : 'تایید و نهایی کردن در سابقه علمی'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT DETAILS & COURSE PROGRESS MODAL (INDIVIDUAL EDITING) */}
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
                  totalCount: 0,
                  percentCompleted: 0
                };

                return (
                  <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div className="text-center p-2.5 bg-emerald-50 text-emerald-900 rounded-xl border border-emerald-200">
                      <span className="text-[11px] font-bold text-emerald-700 block">🟢 گذرانده شده</span>
                      <span className="text-lg font-black mt-0.5 block">{stats.passedCount} درس</span>
                    </div>

                    <div className="text-center p-2.5 bg-sky-50 text-sky-900 rounded-xl border border-sky-200">
                      <span className="text-[11px] font-bold text-sky-700 block">🔵 در جریان (تحصیل)</span>
                      <span className="text-lg font-black mt-0.5 block">{stats.inProgressCount} درس</span>
                    </div>

                    <div className="text-center p-2.5 bg-rose-50 text-rose-900 rounded-xl border border-rose-200">
                      <span className="text-[11px] font-bold text-rose-700 block">🔴 مانده (باقی‌مانده)</span>
                      <span className="text-lg font-black mt-0.5 block">{stats.remainingCount} درس</span>
                    </div>
                  </div>
                );
              })()}

              {/* Add Custom Course Form toggle */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800">ثبت درس گذرانده جدید خارج از سرفصل‌های عمومی برای این طلبه:</span>
                  <button
                    type="button"
                    onClick={() => setIsAddingCustomCourse(!isAddingCustomCourse)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    {isAddingCustomCourse ? 'بستن فرم' : '+ افزودن درس دلخواه'}
                  </button>
                </div>

                {isAddingCustomCourse && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">عنوان:</label>
                      <input
                        type="text"
                        value={customSubjectTitle}
                        onChange={(e) => setCustomSubjectTitle(e.target.value)}
                        placeholder="اصول / فقه / فلسفه"
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">کتاب:</label>
                      <input
                        type="text"
                        value={customBookTitle}
                        onChange={(e) => setCustomBookTitle(e.target.value)}
                        placeholder="مثلاً رسائل"
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">بخش:</label>
                      <input
                        type="text"
                        value={customChapterTitle}
                        onChange={(e) => setCustomChapterTitle(e.target.value)}
                        placeholder="مثلاً قطع و ظن"
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                      />
                    </div>

                    <div className="sm:col-span-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleAddCustomPassedCourse(selectedStudentForModal.id)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                      >
                        ثبت نهایی درس گذرانده برای این طلبه
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Curriculum Tree with Instant Status Toggles */}
              <div className="space-y-5">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={15} className="text-indigo-600" />
                  <span>جدول ریز تفکیکی سابقه علمی طلبه (قابل ویرایش توسط مسئول آموزش)</span>
                </h4>

                {subjects.map(subject => {
                  const subjectBooks = books.filter(b => b.subjectId === subject.id || b.subjectTitle === subject.title);

                  return (
                    <div key={subject.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                      <div className="bg-slate-100/90 p-3 font-black text-xs text-slate-900 border-b border-slate-200 flex items-center justify-between">
                        <span>📚 عنوان: {subject.title}</span>
                      </div>

                      <div className="p-3 space-y-4">
                        {subjectBooks.map(book => {
                          const bookChapters = chapters.filter(c => c.bookId === book.id || c.bookTitle === book.title);

                          return (
                            <div key={book.id} className="space-y-2">
                              <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                <span>📖 کتاب: {book.title}</span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {bookChapters.map(chap => {
                                  const progRec = progressRecords.find(p => p.studentId === selectedStudentForModal.id && (p.chapterId === chap.id || p.chapterTitle === chap.title));
                                  const currentStatus: CourseProgressStatus = progRec?.status || 'remaining';

                                  return (
                                    <div key={chap.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <span className="font-bold text-xs text-slate-900 block truncate">📌 بخش: {chap.title}</span>
                                      </div>

                                      {/* Status Toggle Buttons */}
                                      <div className="flex items-center gap-1 shrink-0">
                                        {/* Passed button */}
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

                                        {/* In-Progress button */}
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

                                        {/* Remaining button */}
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
              {editingSubject.id ? 'ویرایش عنوان درسی' : 'افزودن عنوان درسی جدید'}
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">عنوان درسی (مثلا اصول، فقه، فلسفه)</label>
              <input
                type="text"
                value={editingSubject.title || ''}
                onChange={(e) => setEditingSubject({ ...editingSubject, title: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
                placeholder="عنوان درسی..."
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
                ذخیره عنوان درسی
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOOK MODAL (NO CREDITS / NO UNITHA) */}
      {isBookModalOpen && editingBook && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl w-full max-w-md space-y-4 dir-rtl">
            <h3 className="text-sm font-black text-slate-900">
              {editingBook.id ? 'ویرایش کتاب درسی' : 'افزودن کتاب درسی جدید'}
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">عنوان درسی مربوطه (مثلاً اصول)</label>
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
              <label className="block text-xs font-bold text-slate-600 mb-1">کتاب (مثلا رسائل، مکاسب، بدایه)</label>
              <input
                type="text"
                value={editingBook.title || ''}
                onChange={(e) => setEditingBook({ ...editingBook, title: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
                placeholder="عنوان کتاب..."
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

      {/* CHAPTER MODAL (NO CREDITS / NO UNITHA) */}
      {isChapterModalOpen && editingChapter && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl w-full max-w-md space-y-4 dir-rtl">
            <h3 className="text-sm font-black text-slate-900">
              {editingChapter.id ? 'ویرایش بخش/سرفصل درسی' : 'افزودن بخش/سرفصل درسی جدید'}
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">کتاب درسی مربوطه (مثلاً رسائل)</label>
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
              <label className="block text-xs font-bold text-slate-600 mb-1">بخش/سرفصل (مثلا قطع و ظن)</label>
              <input
                type="text"
                value={editingChapter.title || ''}
                onChange={(e) => setEditingChapter({ ...editingChapter, title: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
                placeholder="عنوان بخش..."
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
                ذخیره بخش
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
