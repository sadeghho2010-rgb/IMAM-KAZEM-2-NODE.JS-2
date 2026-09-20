import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, 
  Clock, 
  User, 
  Users, 
  Search, 
  FileSpreadsheet, 
  FileText, 
  BookOpen, 
  MessageSquare, 
  Sparkles, 
  GitFork, 
  GraduationCap, 
  CalendarDays, 
  Printer, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  Check, 
  CheckCircle2, 
  HelpCircle, 
  Layers, 
  Plus, 
  Trash2, 
  ExternalLink, 
  ShieldAlert,
  Phone
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Student, Program, Enrollment, CustomStudentSchedule, Teacher } from '../types';
import { localDb } from '../lib/localDb';
import { useMentor, getStudentMentorKey } from '../context/MentorContext';
import { useAuth } from '../context/AuthContext';
import { cn, WEEK_DAYS, getProgramDays } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { exportElementToPdf } from '../lib/pdfExport';

interface StudentScheduleProps {
  initialStudentId?: string;
}

export default function StudentSchedule({ initialStudentId }: StudentScheduleProps) {
  const { filterStudents, currentMentorId, currentMentor, shahpooriFilter } = useMentor();
  const { currentUser } = useAuth();
  
  const [students, setStudents] = useState<Student[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [customSchedules, setCustomSchedules] = useState<CustomStudentSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal for adding manual custom schedule for a student
  const [showAddCustomModal, setShowAddCustomModal] = useState<boolean>(false);
  const [newCustomSchedule, setNewCustomSchedule] = useState<{
    title: string;
    days: string[];
    startTime: string;
    endTime: string;
    locationOrNotes: string;
    isExternal: boolean;
  }>({
    title: '',
    days: ['شنبه'],
    startTime: '10:00',
    endTime: '11:30',
    locationOrNotes: '',
    isExternal: true
  });

  // Initialize grade filter based on user role
  const getInitialGradeFilter = (): string => {
    if (!currentUser) return 'all';
    if (currentUser.role === 'grade_mentor' || currentUser.role === 'grade_supervisor') {
      if (currentUser.scope === 'grade_7' || currentUser.gradeLabel?.includes('۷') || currentUser.gradeLabel?.includes('7')) return '۷';
      if (currentUser.scope === 'grade_8' || currentUser.gradeLabel?.includes('۸') || currentUser.gradeLabel?.includes('8')) return '۸';
      if (currentUser.scope === 'grade_9' || currentUser.gradeLabel?.includes('۹') || currentUser.gradeLabel?.includes('9')) return '۹';
      if (currentUser.scope === 'grade_10' || currentUser.gradeLabel?.includes('۱۰') || currentUser.gradeLabel?.includes('10')) return '۱۰';
    }
    return 'all';
  };

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(initialStudentId || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>(getInitialGradeFilter);

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const studentSchedulePrintRef = useRef<HTMLDivElement>(null);

  const isLevel3Student = currentUser?.level === 3;

  const fetchData = async () => {
    setLoading(true);
    try {
      const rawStudents = await localDb.getDocs<Student>('students');
      const rawPrograms = await localDb.getDocs<Program>('programs');
      const rawTeachers = await localDb.getDocs<Teacher>('teachers');
      const rawEnrollments = await localDb.getDocs<Enrollment>('enrollments');
      const rawCustoms = await localDb.getDocs<CustomStudentSchedule>('custom_student_schedules');

      setStudents(rawStudents);
      setPrograms(rawPrograms);
      setTeachers(rawTeachers || []);
      setEnrollments(rawEnrollments);
      setCustomSchedules(rawCustoms || []);

      // If Level 3 user, lock to their own student record
      if (currentUser && currentUser.level === 3) {
        const ownStudent = rawStudents.find(s => 
          (currentUser.linkedStudentId && s.id === currentUser.linkedStudentId) ||
          (currentUser.studentName && s.name.trim() === currentUser.studentName.trim()) ||
          (currentUser.name && s.name.trim() === currentUser.name.trim()) ||
          (s.nationalId && s.nationalId === currentUser.username)
        );
        if (ownStudent) {
          setSelectedStudentId(ownStudent.id);
          return;
        }
      }

      // Default select the first active student if none selected
      const activeFiltered = filterStudents(rawStudents, true);
      if (!selectedStudentId && activeFiltered.length > 0) {
        setSelectedStudentId(activeFiltered[0].id);
      }
    } catch (error) {
      console.error("Error fetching data for student schedules:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const unsub = localDb.subscribe(() => fetchData());
    return () => unsub();
  }, [currentMentorId, shahpooriFilter, currentUser]);

  useEffect(() => {
    if (initialStudentId && !isLevel3Student) {
      setSelectedStudentId(initialStudentId);
    }
  }, [initialStudentId, isLevel3Student]);

  // Filter students based on active mentor
  const availableStudents = React.useMemo(() => {
    if (isLevel3Student) {
      const own = students.filter(s => 
        (currentUser?.linkedStudentId && s.id === currentUser.linkedStudentId) ||
        (currentUser?.studentName && s.name.trim() === currentUser.studentName.trim()) ||
        (currentUser?.name && s.name.trim() === currentUser.name.trim()) ||
        (s.nationalId && s.nationalId === currentUser?.username)
      );
      return own.length > 0 ? own : students.slice(0, 1);
    }

    return filterStudents(students, true).filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (s.nationalId && s.nationalId.includes(searchTerm));
      const matchesGrade = gradeFilter === 'all' || s.grade === gradeFilter;
      return matchesSearch && matchesGrade;
    });
  }, [students, isLevel3Student, currentUser, filterStudents, searchTerm, gradeFilter]);

  const selectedStudent = isLevel3Student 
    ? (availableStudents[0] || students.find(s => s.id === selectedStudentId))
    : (students.find(s => s.id === selectedStudentId) || availableStudents[0]);

  // Get enrolled programs for the selected student
  const studentEnrollments = enrollments.filter(e => e.studentId === selectedStudent?.id);
  const enrolledProgramIds = new Set(studentEnrollments.map(e => e.programId));
  const studentPrograms = programs.filter(p => enrolledProgramIds.has(p.id));

  // Helper to get custom manual schedules for selected student
  const studentCustomSchedules = customSchedules.filter(cs => cs.studentId === selectedStudent?.id);

  const getCustomSchedulesForDay = (dayName: string) => {
    return studentCustomSchedules.filter(cs => {
      if (cs.days && Array.isArray(cs.days) && cs.days.length > 0) {
        return cs.days.includes(dayName);
      }
      return cs.day === dayName || cs.day?.includes(dayName);
    });
  };

  const isAuthorizedToManageSchedule = currentUser?.level !== 3;

  const handleSaveCustomSchedule = async () => {
    if (!selectedStudent) return;
    if (!newCustomSchedule.title.trim()) {
      alert('لطفاً عنوان برنامه را وارد کنید.');
      return;
    }
    if (!newCustomSchedule.days || newCustomSchedule.days.length === 0) {
      alert('لطفاً حداقل یک روز برگزاری را انتخاب کنید.');
      return;
    }

    const scheduleDoc: CustomStudentSchedule = {
      id: `custom_sched_${Date.now()}`,
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      title: newCustomSchedule.title.trim(),
      day: newCustomSchedule.days.join(' - '),
      days: newCustomSchedule.days,
      time: `${newCustomSchedule.startTime} - ${newCustomSchedule.endTime}`,
      startTime: newCustomSchedule.startTime,
      endTime: newCustomSchedule.endTime,
      locationOrNotes: newCustomSchedule.locationOrNotes,
      isExternal: newCustomSchedule.isExternal,
      createdAt: new Date().toISOString(),
      createdByName: currentUser?.name || currentUser?.username || 'مسئول آموزش'
    };

    try {
      await localDb.addDoc('custom_student_schedules', scheduleDoc);
      setShowAddCustomModal(false);
      setNewCustomSchedule({
        title: '',
        days: ['شنبه'],
        startTime: '10:00',
        endTime: '11:30',
        locationOrNotes: '',
        isExternal: true
      });
      fetchData();
    } catch (err) {
      console.error('Error saving custom schedule:', err);
      alert('خطا در ذخیره‌سازی برنامه درسی دستی.');
    }
  };

  const handleDeleteCustomSchedule = async (id: string) => {
    if (!confirm('آیا از حذف این برنامه درسی اختصاصی اطمینان دارید؟')) return;
    try {
      await localDb.deleteDoc('custom_student_schedules', id);
      fetchData();
    } catch (err) {
      console.error('Error deleting custom schedule:', err);
    }
  };

  // Helper to categorize programs
  const mainClasses = studentPrograms.filter(p => p.type === 'اصلی');
  const counselingClasses = studentPrograms.filter(p => p.type === 'مشاوره');
  const researchClasses = studentPrograms.filter(p => p.type === 'پژوهش');
  const thursdayClasses = studentPrograms.filter(p => p.type === 'دروس 5 شنبه');
  const otherClasses = studentPrograms.filter(p => p.type === 'سایر');

  // Helper to get programs on a specific day
  const getProgramsForDay = (dayName: string) => {
    return studentPrograms.filter(p => {
      const days = getProgramDays(p);
      return days.includes(dayName);
    });
  };

  // Helper to find parent program title for counseling classes
  const getParentProgramTitle = (parentProgramId?: string) => {
    if (!parentProgramId) return null;
    const parent = programs.find(p => p.id === parentProgramId);
    return parent ? parent.title : null;
  };

  // Helper to find teacher phone number from teacher's bank
  const getTeacherPhone = (teacherName?: string) => {
    if (!teacherName) return null;
    const clean = teacherName.trim();
    const t = teachers.find(item => item.fullName.trim() === clean || clean.includes(item.fullName.trim()) || item.fullName.trim().includes(clean));
    return t?.phoneNumber || null;
  };

  // Export Single Student Schedule to Excel
  const exportStudentExcel = () => {
    if (!selectedStudent) return;

    const data = [
      ["برنامه هفتگی و برنامه‌های آموزشی طلبه"],
      ["نام و نام خانوادگی", selectedStudent.name],
      ["پایه تحصیلی", `پایه ${selectedStudent.grade || '---'}`],
      ["کد ملی", selectedStudent.nationalId || '---'],
      ["شماره تماس", selectedStudent.phoneNumber || '---'],
      ["تعداد کلاس‌های ثبت‌نام شده", studentPrograms.length],
      ["تاریخ گزارش", new Date().toLocaleDateString('fa-IR-u-nu-latn')],
      [],
      ["ردیف", "عنوان کلاس", "نوع برنامه", "روز برگزاری", "ساعت برگزاری", "استاد محترم", "درس اصلی مرتبط (در صورت مشاوره)"]
    ];

    studentPrograms.forEach((p, idx) => {
      const parentTitle = getParentProgramTitle(p.parentProgramId);
      data.push([
        (idx + 1).toString(),
        p.title,
        p.type,
        p.day || 'نامشخص',
        p.time || 'نامشخص',
        p.teacher || '---',
        parentTitle || '---'
      ]);
    });

    data.push([]);
    data.push(["جدول تفکیکی روزانه برنامه هفتگی"]);
    data.push(["روز هفته", "برنامه‌ها و کلاس‌های دایر"]);

    WEEK_DAYS.forEach(day => {
      const dayProgs = getProgramsForDay(day);
      const desc = dayProgs.length > 0 
        ? dayProgs.map(p => `«${p.title}» (${p.time || 'زمان نامشخص'} - استاد: ${p.teacher || '---'})`).join(' | ')
        : 'بدون کلاس ثبت شده';
      data.push([day, desc]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 25 }];
    const wb = XLSX.utils.book_new();
    const sheetName = selectedStudent.name.replace(/[\\/*?:[\]]/g, '_').slice(0, 25) || 'برنامه_طلبه';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `برنامه_هفتگی_${selectedStudent.name.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('fa-IR-u-nu-latn').replace(/\//g, '-')}.xlsx`);
  };

  // Export Master Workbook of ALL Students' Schedules to Excel
  const exportAllStudentsExcel = () => {
    if (availableStudents.length === 0) {
      alert('هیچ طلبی برای خروجی وجود ندارد.');
      return;
    }

    const wb = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
      ["گزارش جامع برنامه هفتگی و کلاس‌های تمام طلاب"],
      ["تاریخ گزارش", new Date().toLocaleDateString('fa-IR-u-nu-latn')],
      ["تعداد طلاب", availableStudents.length],
      [],
      ["ردیف", "نام و نام خانوادگی", "پایه تحصیلی", "تعداد کلاس‌ها", "لیست کلاس‌های اصلی", "لیست کلاس‌های مشاوره"]
    ];

    availableStudents.forEach((st, idx) => {
      const stEnrollments = enrollments.filter(e => e.studentId === st.id);
      const stProgIds = new Set(stEnrollments.map(e => e.programId));
      const stProgs = programs.filter(p => stProgIds.has(p.id));

      const mains = stProgs.filter(p => p.type === 'اصلی').map(p => p.title).join(' ، ') || '---';
      const counselings = stProgs.filter(p => p.type === 'مشاوره').map(p => p.title).join(' ، ') || '---';

      summaryData.push([
        (idx + 1).toString(),
        st.name,
        `پایه ${st.grade || '---'}`,
        stProgs.length.toString(),
        mains,
        counselings
      ]);
    });

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 35 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'خلاصه کل طلاب');

    XLSX.writeFile(wb, `گزارش_جامع_برنامه_هفتگی_طلاب_${new Date().toLocaleDateString('fa-IR-u-nu-latn').replace(/\//g, '-')}.xlsx`);
  };

  // PDF Export for Selected Student
  const handleExportPdf = async () => {
    if (!studentSchedulePrintRef.current || !selectedStudent) return;
    setIsExportingPdf(true);
    try {
      await exportElementToPdf({
        element: studentSchedulePrintRef.current,
        filename: `برنامه_هفتگی_${selectedStudent.name.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('fa-IR-u-nu-latn').replace(/\//g, '-')}.pdf`,
        orientation: 'portrait',
        marginMM: 8
      });
    } catch (err) {
      console.error('PDF Export error:', err);
      alert('خطا در تولید فایل PDF برنامه طلبه');
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]" dir="rtl">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-500 font-bold">در حال بارگذاری برنامه‌های طلاب...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" dir="rtl">
      {/* Top Bar Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <CalendarDays className="text-indigo-600" size={28} />
            <span>برنامه درسی طلاب</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            مشاهده کامل برنامه کلاس‌های اصلی، مشاوره، پژوهش و ۵شنبه‌های هر طلبه به تفکیک زمان و روز
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isLevel3Student && (
            <button 
              onClick={exportAllStudentsExcel}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer"
              title="خروجی اکسل خلاصه برنامه‌های تمام طلاب"
            >
              <FileSpreadsheet size={16} />
              <span>خروجی اکسل همه طلاب</span>
            </button>
          )}

          {selectedStudent && (
            <>
              <button 
                onClick={exportStudentExcel}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 rounded-xl font-black text-xs transition-all shadow-sm cursor-pointer"
                title="دانلود اکسل برنامه این طلبه"
              >
                <FileSpreadsheet size={16} />
                <span>اکسل برنامه طلبه</span>
              </button>

              <button 
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-black text-xs transition-all shadow-md disabled:opacity-50 cursor-pointer"
                title="دانلود PDF برنامه هفتگی این طلبه"
              >
                <FileText size={16} />
                <span>{isExportingPdf ? 'در حال خروجی...' : 'خروجی PDF برنامه'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Grid: Left Sidebar Selector + Right Schedule View */}
      <div className={cn("grid gap-6 items-start", isLevel3Student ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-4")}>
        {/* Student Selector Sidebar (1 col) */}
        {!isLevel3Student && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 shadow-xs lg:sticky lg:top-20">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
                <Users size={18} className="text-indigo-600" />
                <span>انتخاب طلبه ({availableStudents.length} نفر)</span>
              </h3>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="جستجوی نام یا کد ملی..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </div>

            {/* Grade Filter */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
              <button 
                onClick={() => setGradeFilter('all')}
                className={cn("flex-1 py-1 rounded-lg transition-all cursor-pointer", gradeFilter === 'all' ? "bg-white text-indigo-900 shadow-2xs font-black" : "text-slate-500 hover:text-slate-800")}
              >
                همه
              </button>
              {['۷', '۸', '۹', '۱۰'].map(g => (
                <button 
                  key={g}
                  onClick={() => setGradeFilter(g)}
                  className={cn("flex-1 py-1 rounded-lg transition-all cursor-pointer", gradeFilter === g ? "bg-white text-indigo-900 shadow-2xs font-black" : "text-slate-500 hover:text-slate-800")}
                >
                  پایه {g}
                </button>
              ))}
            </div>

            {/* Students Scrollable List */}
            <div className="max-h-[500px] overflow-y-auto space-y-1.5 pr-1">
              {availableStudents.map(student => {
                const isSelected = selectedStudent?.id === student.id;
                const stEnrollmentsCount = enrollments.filter(e => e.studentId === student.id).length;

                return (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={cn(
                      "w-full text-right p-3 rounded-xl border transition-all flex items-center justify-between group cursor-pointer",
                      isSelected 
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                        : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-200"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0",
                        isSelected ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-700"
                      )}>
                        {student.name.split(' ')[0]?.[0] || 'ط'}
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-black truncate">{student.name}</p>
                        <p className={cn("text-[10px] font-medium", isSelected ? "text-indigo-100" : "text-slate-400")}>
                          پایه {student.grade || '---'}
                        </p>
                      </div>
                    </div>

                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border",
                      isSelected ? "bg-white/20 text-white border-white/30" : "bg-slate-100 text-slate-600 border-slate-200"
                    )}>
                      {stEnrollmentsCount} کلاس
                    </span>
                  </button>
                );
              })}

              {availableStudents.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400 italic">
                  طلبه‌ای با این مشخصات یافت نشد.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selected Student Schedule Area */}
        <div className={cn("space-y-6", isLevel3Student ? "lg:col-span-1" : "lg:col-span-3")}>
          {selectedStudent ? (
            <>
              {/* Selected Student Profile Banner */}
              <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-sm border border-indigo-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-800/80 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-700/80 rounded-2xl border border-indigo-500 flex items-center justify-center text-white font-black text-lg shadow-sm">
                      <GraduationCap size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-white">{selectedStudent.name}</h3>
                        <span className="text-xs font-bold px-2.5 py-0.5 bg-indigo-800 text-indigo-100 rounded-lg border border-indigo-600">
                          پایه {selectedStudent.grade || '---'}
                        </span>
                        {selectedStudent.tammomStatus === 'معمم' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-md border border-emerald-500/40">
                            معمم
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-indigo-200/80 font-medium mt-1">
                        کد ملی: <span className="font-bold text-white">{selectedStudent.nationalId || '---'}</span> | شماره تماس: <span className="font-bold text-white">{selectedStudent.phoneNumber || '---'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-indigo-900/60 p-3 rounded-2xl border border-indigo-700/60 self-start sm:self-auto text-xs">
                    <BookOpen size={18} className="text-indigo-300" />
                    <div>
                      <p className="text-[10px] text-indigo-300 font-bold">تعداد کلاس‌های ثبت‌نامی:</p>
                      <p className="text-base font-black text-white">{studentPrograms.length} کلاس</p>
                    </div>
                  </div>
                </div>

                {/* Quick Summary Badges */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="px-3 py-1 bg-indigo-800/60 text-indigo-100 rounded-xl border border-indigo-700/60 font-bold">
                      دروس اصلی: <b className="text-white">{mainClasses.length}</b>
                    </span>
                    <span className="px-3 py-1 bg-amber-500/20 text-amber-200 rounded-xl border border-amber-500/40 font-bold">
                      مشاوره‌ها: <b className="text-white">{counselingClasses.length}</b>
                    </span>
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-200 rounded-xl border border-emerald-500/40 font-bold">
                      پژوهش: <b className="text-white">{researchClasses.length}</b>
                    </span>
                    <span className="px-3 py-1 bg-purple-500/20 text-purple-200 rounded-xl border border-purple-500/40 font-bold">
                      ۵ شنبه‌ها: <b className="text-white">{thursdayClasses.length}</b>
                    </span>
                    <span className="px-3 py-1 bg-rose-500/20 text-rose-200 rounded-xl border border-rose-500/40 font-bold">
                      برنامه‌های دستی/خارج موسسه: <b className="text-white">{studentCustomSchedules.length}</b>
                    </span>
                  </div>

                  {isAuthorizedToManageSchedule && (
                    <button
                      onClick={() => setShowAddCustomModal(true)}
                      className="flex items-center gap-2 px-3.5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                      <Plus size={16} />
                      <span>ثبت برنامه درسی دستی / خارج از موسسه</span>
                    </button>
                  )}
                </div>
              </div>

              {/* WEEKLY TIMETABLE MATRIX GRID */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-indigo-100 text-indigo-800 rounded-xl">
                      <Calendar size={20} />
                    </span>
                    <h3 className="text-lg font-black text-slate-900">جدول زمان‌بندی هفته (Weekly Timetable)</h3>
                  </div>
                  <span className="text-xs text-slate-500 font-bold">برنامه کلاس‌ها در طول روزهای هفته</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {WEEK_DAYS.map(dayName => {
                    const dayProgs = getProgramsForDay(dayName);
                    const dayCustoms = getCustomSchedulesForDay(dayName);
                    const totalDayItems = dayProgs.length + dayCustoms.length;

                    return (
                      <div key={dayName} className="bg-slate-50/80 rounded-2xl border border-slate-200 p-4 space-y-3 flex flex-col">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <h4 className="font-black text-sm text-slate-800 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                            <span>{dayName}</span>
                          </h4>
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                            totalDayItems > 0 ? "bg-indigo-50 text-indigo-800 border-indigo-200" : "bg-slate-200/60 text-slate-500 border-slate-200"
                          )}>
                            {totalDayItems} برنامه
                          </span>
                        </div>

                        <div className="space-y-2 flex-1">
                          {/* Institutional Programs */}
                          {dayProgs.map(prog => {
                            const parentTitle = getParentProgramTitle(prog.parentProgramId);

                            return (
                              <div 
                                key={prog.id} 
                                className={cn(
                                  "p-3 rounded-xl border text-xs space-y-1.5 shadow-2xs transition-all",
                                  prog.type === 'اصلی' ? "bg-indigo-950 text-white border-indigo-900" :
                                  prog.type === 'مشاوره' ? "bg-amber-50 text-amber-950 border-amber-300" :
                                  prog.type === 'پژوهش' ? "bg-emerald-50 text-emerald-950 border-emerald-300" :
                                  prog.type === 'دروس 5 شنبه' ? "bg-purple-50 text-purple-950 border-purple-300" :
                                  "bg-white text-slate-800 border-slate-200"
                                )}
                              >
                                <div className="flex items-center justify-between font-black">
                                  <span className="text-xs truncate">{prog.title}</span>
                                  <span className={cn(
                                    "text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0",
                                    prog.type === 'اصلی' ? "bg-indigo-800 text-indigo-100 border-indigo-700" :
                                    prog.type === 'مشاوره' ? "bg-amber-200 text-amber-950 border-amber-300" :
                                    prog.type === 'پژوهش' ? "bg-emerald-200 text-emerald-950 border-emerald-300" :
                                    prog.type === 'دروس 5 شنبه' ? "bg-purple-200 text-purple-950 border-purple-300" :
                                    "bg-slate-100 text-slate-700 border-slate-300"
                                  )}>
                                    {prog.type}
                                  </span>
                                </div>

                                <div className={cn(
                                  "flex flex-col gap-1 text-[10px] font-bold pt-1",
                                  prog.type === 'اصلی' ? "text-indigo-200" : "text-slate-600"
                                )}>
                                  <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1">
                                      <Clock size={11} /> {prog.time || 'زمان مشخص‌نشده'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <User size={11} /> {prog.teacher || 'استاد ثبت‌نشده'}
                                    </span>
                                  </div>
                                  {getTeacherPhone(prog.teacher) && (
                                    <div className="flex items-center justify-end gap-1 text-[9px] font-mono opacity-90">
                                      <Phone size={9} />
                                      <a 
                                        href={`tel:${getTeacherPhone(prog.teacher)}`}
                                        className="hover:underline tracking-tight"
                                        title={`تماس با استاد ${prog.teacher}`}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {getTeacherPhone(prog.teacher)}
                                      </a>
                                    </div>
                                  )}
                                </div>

                                {prog.type === 'مشاوره' && parentTitle && (
                                  <div className="pt-1 border-t border-amber-200/80 text-[10px] font-bold text-amber-900 flex items-center gap-1">
                                    <GitFork size={11} className="text-amber-700" />
                                    <span>درس اصلی مرتبط: «{parentTitle}»</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Custom External / Manual Programs */}
                          {dayCustoms.map(cs => (
                            <div key={cs.id} className="p-3 rounded-xl border text-xs space-y-1.5 shadow-2xs bg-rose-50 text-rose-950 border-rose-200">
                              <div className="flex items-center justify-between font-black">
                                <span className="text-xs truncate flex items-center gap-1">
                                  <ExternalLink size={12} className="text-rose-600" />
                                  {cs.title}
                                </span>
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded border bg-rose-100 text-rose-800 border-rose-300">
                                  دستی / خارج موسسه
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[10px] font-bold text-rose-800">
                                <span className="flex items-center gap-1">
                                  <Clock size={11} /> {cs.time || `${cs.startTime} - ${cs.endTime}`}
                                </span>
                                {isAuthorizedToManageSchedule && (
                                  <button 
                                    onClick={() => handleDeleteCustomSchedule(cs.id)}
                                    className="p-1 hover:bg-rose-200 rounded text-rose-700 transition-colors cursor-pointer"
                                    title="حذف این برنامه دستی"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>

                              {cs.locationOrNotes && (
                                <div className="text-[10px] text-rose-900 pt-1 border-t border-rose-200">
                                  ملاحظات: {cs.locationOrNotes}
                                </div>
                              )}
                            </div>
                          ))}

                          {totalDayItems === 0 && (
                            <div className="py-6 text-center text-slate-400 text-xs italic">
                              کلاسی برای {dayName} ثبت نشده است.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DETAILED CATEGORIZED CLASSES BREAKDOWN */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Layers size={20} className="text-indigo-600" />
                    <span>دسته‌بندی برنامه‌ها و دروس ثبت‌نام شده</span>
                  </h3>
                  <span className="text-xs text-slate-500 font-bold">تفکیک کامل تمام برنامه‌ها</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Main Classes Section */}
                  <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
                    <div className="flex items-center justify-between font-black text-indigo-950 text-sm border-b border-indigo-200 pb-2">
                      <span className="flex items-center gap-2">
                        <BookOpen size={16} className="text-indigo-700" />
                        <span>دروس اصلی ({mainClasses.length} درس)</span>
                      </span>
                    </div>

                    <div className="space-y-2">
                      {mainClasses.map(p => {
                        const phone = getTeacherPhone(p.teacher);
                        return (
                          <div key={p.id} className="bg-white p-3 rounded-xl border border-indigo-200 space-y-1.5 text-xs shadow-2xs">
                            <div className="font-black text-indigo-950 text-sm">{p.title}</div>
                            <div className="flex flex-wrap items-center justify-between text-slate-600 font-bold text-[11px] gap-2">
                              <div className="flex items-center gap-1.5">
                                <span>استاد: {p.teacher || '---'}</span>
                                {phone && (
                                  <a 
                                    href={`tel:${phone}`} 
                                    className="flex items-center gap-0.5 text-indigo-600 font-mono text-[10px] bg-indigo-50 px-1.5 py-0.5 rounded hover:underline"
                                    title="تماس با استاد"
                                  >
                                    <Phone size={9} />
                                    <span>{phone}</span>
                                  </a>
                                )}
                              </div>
                              <span>زمان: {p.day || ''} {p.time || ''}</span>
                            </div>
                          </div>
                        );
                      })}
                      {mainClasses.length === 0 && (
                        <p className="text-xs text-indigo-400 italic text-center py-2">هیچ درس اصلی ثبت‌نام نشده است.</p>
                      )}
                    </div>
                  </div>

                  {/* Counseling Classes Section */}
                  <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100 space-y-3">
                    <div className="flex items-center justify-between font-black text-amber-950 text-sm border-b border-amber-200 pb-2">
                      <span className="flex items-center gap-2">
                        <MessageSquare size={16} className="text-amber-700" />
                        <span>کلاس‌های مشاوره ({counselingClasses.length} کلاس)</span>
                      </span>
                    </div>

                    <div className="space-y-2">
                      {counselingClasses.map(p => {
                        const parentTitle = getParentProgramTitle(p.parentProgramId);
                        const phone = getTeacherPhone(p.teacher);
                        return (
                          <div key={p.id} className="bg-white p-3 rounded-xl border border-amber-200 space-y-1.5 text-xs shadow-2xs">
                            <div className="font-black text-amber-950 text-sm">{p.title}</div>
                            <div className="flex flex-wrap items-center justify-between text-slate-600 font-bold text-[11px] gap-2">
                              <div className="flex items-center gap-1.5">
                                <span>استاد: {p.teacher || '---'}</span>
                                {phone && (
                                  <a 
                                    href={`tel:${phone}`} 
                                    className="flex items-center gap-0.5 text-amber-800 font-mono text-[10px] bg-amber-50 px-1.5 py-0.5 rounded hover:underline"
                                    title="تماس با استاد"
                                  >
                                    <Phone size={9} />
                                    <span>{phone}</span>
                                  </a>
                                )}
                              </div>
                              <span>زمان: {p.day || ''} {p.time || ''}</span>
                            </div>
                            {parentTitle && (
                              <div className="text-[10px] font-bold text-amber-800 pt-1 border-t border-amber-100 flex items-center gap-1">
                                <GitFork size={10} />
                                <span>مرتبط با درس اصلی: «{parentTitle}»</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {counselingClasses.length === 0 && (
                        <p className="text-xs text-amber-500 italic text-center py-2">کلاس مشاوره‌ای ثبت‌نام نشده است.</p>
                      )}
                    </div>
                  </div>

                  {/* Research & Thursday Classes Section */}
                  <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-3">
                    <div className="flex items-center justify-between font-black text-emerald-950 text-sm border-b border-emerald-200 pb-2">
                      <span className="flex items-center gap-2">
                        <Sparkles size={16} className="text-emerald-700" />
                        <span>واحد پژوهش و برنامه‌های ۵ شنبه ({researchClasses.length + thursdayClasses.length} مورد)</span>
                      </span>
                    </div>

                    <div className="space-y-2">
                      {[...researchClasses, ...thursdayClasses].map(p => {
                        const phone = getTeacherPhone(p.teacher);
                        return (
                          <div key={p.id} className="bg-white p-3 rounded-xl border border-emerald-200 space-y-1.5 text-xs shadow-2xs">
                            <div className="font-black text-emerald-950 text-sm flex items-center justify-between">
                              <span>{p.title}</span>
                              <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded font-bold">{p.type}</span>
                            </div>
                            <div className="flex flex-wrap items-center justify-between text-slate-600 font-bold text-[11px] gap-2">
                              <div className="flex items-center gap-1.5">
                                <span>استاد/مسئول: {p.teacher || '---'}</span>
                                {phone && (
                                  <a 
                                    href={`tel:${phone}`} 
                                    className="flex items-center gap-0.5 text-emerald-800 font-mono text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded hover:underline"
                                    title="تماس با استاد"
                                  >
                                    <Phone size={9} />
                                    <span>{phone}</span>
                                  </a>
                                )}
                              </div>
                              <span>زمان: {p.day || ''} {p.time || ''}</span>
                            </div>
                          </div>
                        );
                      })}
                      {researchClasses.length === 0 && thursdayClasses.length === 0 && (
                        <p className="text-xs text-emerald-500 italic text-center py-2">برنامه‌ای در این بخش ثبت نشده است.</p>
                      )}
                    </div>
                  </div>

                  {/* Custom External / Manual Classes Section */}
                  <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-200 space-y-3 col-span-full">
                    <div className="flex items-center justify-between font-black text-rose-950 text-sm border-b border-rose-200 pb-2">
                      <span className="flex items-center gap-2">
                        <ExternalLink size={16} className="text-rose-700" />
                        <span>برنامه‌های اختصاصی، دستی و خارج از موسسه ({studentCustomSchedules.length} مورد)</span>
                      </span>
                      {isAuthorizedToManageSchedule && (
                        <button
                          onClick={() => setShowAddCustomModal(true)}
                          className="flex items-center gap-1 text-xs text-rose-800 hover:text-rose-950 font-bold bg-white px-2.5 py-1 rounded-lg border border-rose-300 hover:bg-rose-100 transition-colors cursor-pointer"
                        >
                          <Plus size={14} />
                          <span>افزودن برنامه جدید</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {studentCustomSchedules.map(cs => (
                        <div key={cs.id} className="bg-white p-3 rounded-xl border border-rose-200 space-y-1.5 text-xs shadow-2xs">
                          <div className="font-black text-rose-950 text-sm flex items-center justify-between">
                            <span>{cs.title}</span>
                            <span className="text-[10px] px-2 py-0.5 bg-rose-100 text-rose-900 rounded font-bold">
                              {cs.isExternal ? 'خارج از موسسه' : 'اختصاصی'}
                            </span>
                          </div>
                          <div className="flex justify-between text-slate-600 font-bold text-[11px]">
                            <span>روز: {cs.day}</span>
                            <span>ساعت: {cs.time || `${cs.startTime} - ${cs.endTime}`}</span>
                          </div>
                          {cs.locationOrNotes && (
                            <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                              ملاحظات: {cs.locationOrNotes}
                            </div>
                          )}
                          {isAuthorizedToManageSchedule && (
                            <div className="pt-2 border-t border-rose-100 flex justify-end">
                              <button
                                onClick={() => handleDeleteCustomSchedule(cs.id)}
                                className="flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                              >
                                <Trash2 size={12} />
                                <span>حذف برنامه</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                      {studentCustomSchedules.length === 0 && (
                        <p className="text-xs text-rose-400 italic text-center py-2 col-span-full">
                          هیچ برنامه درسی دستی یا خارج از موسسه‌ای برای این طلبه ثبت نشده است.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 space-y-3">
              <Users size={36} className="mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-600">لطفا یک طلبه را از منوی سمت راست انتخاب کنید.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal for adding manual custom student schedule */}
      <AnimatePresence>
        {showAddCustomModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 shadow-xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                    <Plus size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-900">ثبت برنامه درسی دستی / خارج از موسسه</h3>
                    <p className="text-xs text-slate-500">برای {selectedStudent?.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAddCustomModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs font-bold text-slate-700">
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 text-[11px] leading-relaxed">
                  💡 برنامه‌های درسی که برای طلبه به صورت دستی ثبت می‌شوند، در دستیار هوشمند چینش کلاس‌های مشاوره لحاظ شده و از پیشنهاد کلاس مشاوره در این ساعات جلوگیری خواهد شد.
                </div>

                <div>
                  <label className="block mb-1 text-slate-600">عنوان برنامه / کلاس:</label>
                  <input 
                    type="text" 
                    placeholder="مثال: درس فقه خارج (موسسه دیگر)، کلاس زبان، برنامه شخصی" 
                    value={newCustomSchedule.title}
                    onChange={(e) => setNewCustomSchedule({ ...newCustomSchedule, title: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-slate-600">نوع برنامه:</label>
                  <select 
                    value={newCustomSchedule.isExternal ? 'external' : 'internal'}
                    onChange={(e) => setNewCustomSchedule({ ...newCustomSchedule, isExternal: e.target.value === 'external' })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-xs font-bold"
                  >
                    <option value="external">خارج از موسسه (مستقل)</option>
                    <option value="internal">اختصاصی داخل موسسه</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-1.5 text-slate-600 font-bold">روزهای برگزاری (امکان انتخاب چند روز):</label>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    {WEEK_DAYS.map(d => {
                      const isSelected = newCustomSchedule.days.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            const current = newCustomSchedule.days;
                            const updated = isSelected
                              ? current.filter(x => x !== d)
                              : [...current, d];
                            setNewCustomSchedule({ ...newCustomSchedule, days: updated });
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border shadow-2xs",
                            isSelected
                              ? "bg-amber-500 text-slate-950 border-amber-600 font-black"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                          )}
                        >
                          <Check size={12} className={cn(isSelected ? "opacity-100 text-slate-950" : "opacity-0")} />
                          <span>{d}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-slate-600">ساعت شروع:</label>
                    <input 
                      type="text" 
                      placeholder="08:00" 
                      value={newCustomSchedule.startTime}
                      onChange={(e) => setNewCustomSchedule({ ...newCustomSchedule, startTime: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-xs font-bold text-center dir-ltr"
                    />
                  </div>

                  <div>
                    <label className="block mb-1 text-slate-600">ساعت پایان:</label>
                    <input 
                      type="text" 
                      placeholder="09:30" 
                      value={newCustomSchedule.endTime}
                      onChange={(e) => setNewCustomSchedule({ ...newCustomSchedule, endTime: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-xs font-bold text-center dir-ltr"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1 text-slate-600">مکان / توضیحات تداخلی:</label>
                  <textarea 
                    rows={2}
                    placeholder="محل برگزاری، نام استاد یا ملاحظات خاص..." 
                    value={newCustomSchedule.locationOrNotes}
                    onChange={(e) => setNewCustomSchedule({ ...newCustomSchedule, locationOrNotes: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowAddCustomModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button 
                  type="button"
                  onClick={handleSaveCustomSchedule}
                  className="px-5 py-2.5 text-xs font-black bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  ثبت برنامه
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HIDDEN PRINTABLE CONTAINER FOR PDF EXPORT */}
      <div style={{ position: 'fixed', left: '-9999px', top: '0px', width: '850px', zIndex: -1000, pointerEvents: 'none', opacity: 0 }}>
        {selectedStudent && (
          <div ref={studentSchedulePrintRef} className="p-8 bg-white font-vazir text-slate-900 space-y-6" dir="rtl">
            <div className="text-center border-b-2 border-indigo-600 pb-4 space-y-2">
              <h1 className="text-2xl font-black text-indigo-950">گزارش رسمی برنامه هفتگی و کلاس‌های درسی طلبه</h1>
              <p className="text-xs text-slate-600">
                استاد/مسئول: <span className="font-bold text-slate-800">{currentMentor.name}</span> | تاریخ تنظیم: <span className="font-bold text-slate-800">{new Date().toLocaleDateString('fa-IR-u-nu-latn')}</span>
              </p>
            </div>

            {/* Student Specifications Table */}
            <div className="bg-indigo-50/80 p-4 rounded-xl border border-indigo-200 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div><b>نام و نام خانوادگی طلبه:</b> <span className="text-indigo-950 font-black">{selectedStudent.name}</span></div>
                <div><b>پایه تحصیلی:</b> <span className="text-indigo-900 font-bold">پایه {selectedStudent.grade || '---'}</span></div>
                <div><b>کد ملی:</b> <span>{selectedStudent.nationalId || '---'}</span></div>
                <div><b>شماره تماس:</b> <span>{selectedStudent.phoneNumber || '---'}</span></div>
                <div><b>وضعیت معممی:</b> <span>{selectedStudent.tammomStatus || '---'}</span></div>
                <div><b>تعداد کلاس‌های ثبت‌نامی:</b> <span className="font-black text-indigo-900">{studentPrograms.length} کلاس</span></div>
              </div>
            </div>

            {/* Weekly Timetable Table */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-indigo-900 border-b border-indigo-200 pb-1">جدول برنامه هفتگی:</h3>
              <table className="w-full text-right text-xs border-collapse border border-slate-300 bg-white">
                <thead>
                  <tr className="bg-slate-100 font-black text-slate-800">
                    <th className="p-2.5 border border-slate-300 w-24 text-center">روز هفته</th>
                    <th className="p-2.5 border border-slate-300">برنامه‌ها و کلاس‌های دایر</th>
                  </tr>
                </thead>
                <tbody>
                  {WEEK_DAYS.map(day => {
                    const dayProgs = getProgramsForDay(day);
                    return (
                      <tr key={day} className="border-b border-slate-200">
                        <td className="p-2.5 border border-slate-300 font-black text-slate-900 text-center bg-slate-50">{day}</td>
                        <td className="p-2.5 border border-slate-300">
                          {dayProgs.length > 0 ? (
                            <div className="space-y-1.5">
                              {dayProgs.map(p => {
                                const parentTitle = getParentProgramTitle(p.parentProgramId);
                                return (
                                  <div key={p.id} className="text-xs font-medium border-b border-slate-100 last:border-0 pb-1">
                                    <span className="font-black text-slate-900">«{p.title}»</span>{' '}
                                    <span className="text-indigo-800 font-bold">({p.type})</span> -{' '}
                                    <span>ساعت: <b>{p.time || '---'}</b></span> | {' '}
                                    <span>استاد: <b>{p.teacher || '---'}</b></span>
                                    {parentTitle && <span className="text-amber-900 font-bold"> (مرتبط با {parentTitle})</span>}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">بدون کلاس ثبت‌شده</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Complete Classes Table */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-indigo-900 border-b border-indigo-200 pb-1">لیست تفکیکی کلیه برنامه‌های آموزشی:</h3>
              <table className="w-full text-right text-xs border-collapse border border-slate-300 bg-white">
                <thead>
                  <tr className="bg-slate-100 font-black text-slate-800">
                    <th className="p-2 border border-slate-300 w-10 text-center">ردیف</th>
                    <th className="p-2 border border-slate-300">عنوان کلاس</th>
                    <th className="p-2 border border-slate-300">نوع برنامه</th>
                    <th className="p-2 border border-slate-300">استاد مربوطه</th>
                    <th className="p-2 border border-slate-300">روز و زمان</th>
                    <th className="p-2 border border-slate-300">توضیحات / ارتباط</th>
                  </tr>
                </thead>
                <tbody>
                  {studentPrograms.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center italic text-slate-400">کلاسی برای این طلبه ثبت نشده است.</td>
                    </tr>
                  ) : (
                    studentPrograms.map((p, idx) => {
                      const parentTitle = getParentProgramTitle(p.parentProgramId);
                      return (
                        <tr key={p.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                          <td className="p-2 border border-slate-300 text-center font-bold">{idx + 1}</td>
                          <td className="p-2 border border-slate-300 font-black text-slate-900">{p.title}</td>
                          <td className="p-2 border border-slate-300 font-bold text-indigo-900">{p.type}</td>
                          <td className="p-2 border border-slate-300">{p.teacher || '---'}</td>
                          <td className="p-2 border border-slate-300">{p.day || ''} - {p.time || ''}</td>
                          <td className="p-2 border border-slate-300 text-slate-600">
                            {parentTitle ? `مرتبط با درس اصلی: ${parentTitle}` : '---'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
