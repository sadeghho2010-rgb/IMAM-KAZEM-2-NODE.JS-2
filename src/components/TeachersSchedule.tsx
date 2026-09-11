import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  GraduationCap, 
  Clock, 
  Calendar, 
  CalendarDays, 
  BookOpen, 
  Search, 
  Filter, 
  DoorOpen, 
  FileSpreadsheet, 
  FileText, 
  Plus, 
  Trash2, 
  Edit3, 
  Layers, 
  LayoutGrid, 
  Table, 
  UserCheck, 
  Printer, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  X,
  ChevronDown,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { Program, Teacher, MadrasRoom, TeacherManualSchedule } from '../types';
import { localDb } from '../lib/localDb';
import { useAuth } from '../context/AuthContext';
import { cn, WEEK_DAYS, getProgramDays } from '../lib/utils';
import { exportElementToPdf } from '../lib/pdfExport';

const TIME_SLOTS_HOURLY = [
  '07:00 الی 08:00',
  '08:00 الی 09:00',
  '09:00 الی 10:00',
  '10:00 الی 11:00',
  '11:00 الی 12:00',
  '12:00 الی 13:00',
  '13:00 الی 14:00',
  '14:00 الی 15:00',
  '15:00 الی 16:00',
  '16:00 الی 17:00',
];

const PRESET_HOURS = [
  '08:00 الی 09:00',
  '08:00 الی 09:30',
  '09:00 الی 10:00',
  '10:00 الی 11:00',
  '10:00 الی 11:30',
  '11:00 الی 12:00',
  '11:45 الی 12:45',
  '14:00 الی 15:30',
  '15:00 الی 16:00',
  '15:45 الی 17:15',
  '16:00 الی 17:00',
];

export default function TeachersSchedule() {
  const { currentUser } = useAuth();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [manualSchedules, setManualSchedules] = useState<TeacherManualSchedule[]>([]);
  const [rooms, setRooms] = useState<MadrasRoom[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [selectedTeacherName, setSelectedTeacherName] = useState<string>('all');
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'timetable' | 'cards' | 'table'>('cards');

  // Manual Schedule Modal
  const [showAddManualModal, setShowAddManualModal] = useState<boolean>(false);
  const [manualTeacherName, setManualTeacherName] = useState<string>('');
  const [isCustomTeacherName, setIsCustomTeacherName] = useState<boolean>(false);
  const [manualSubject, setManualSubject] = useState<string>('');
  const [manualGrade, setManualGrade] = useState<string>('پایه 7');
  const [manualDays, setManualDays] = useState<string[]>(['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه']);
  const [manualTime, setManualTime] = useState<string>('08:00 الی 09:00');
  const [manualRoom, setManualRoom] = useState<string>('');
  const [manualNotes, setManualNotes] = useState<string>('');

  // Delete Confirmation Modal
  const [scheduleToDelete, setScheduleToDelete] = useState<{ id: string; title: string; teacher: string; isManual: boolean } | null>(null);

  // Export PDF State
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const printContainerRef = useRef<HTMLDivElement>(null);

  const isAuthorizedToEdit = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.level === 1) return true;
    if (currentUser.role === 'education_officer' || currentUser.role === 'education_manager') return true;
    return false;
  }, [currentUser]);

  // Check if Level 3 user has access
  const isAuthorizedToView = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.level === 1) return true;
    // Level 2: Education Officer, Grade Supervisors, Research Officer
    if (currentUser.level === 2) {
      return (
        currentUser.role === 'education_manager' || 
        currentUser.role === 'education_officer' || 
        currentUser.role === 'grade_mentor' || 
        currentUser.role === 'grade_supervisor' || 
        currentUser.role === 'research_manager' || 
        currentUser.role === 'research_officer' ||
        currentUser.allowedTabs?.includes('teachers-schedule')
      );
    }
    // Level 3: Only if explicitly allowed
    if (currentUser.level === 3) {
      return currentUser.allowedTabs?.includes('teachers-schedule') || false;
    }
    return false;
  }, [currentUser]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rawPrograms, rawTeachers, rawManual, rawRooms] = await Promise.all([
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<Teacher>('teachers'),
        localDb.getDocs<TeacherManualSchedule>('teacher_schedules'),
        localDb.getDocs<MadrasRoom>('classrooms')
      ]);

      setPrograms(rawPrograms || []);
      setTeachers(rawTeachers || []);
      setManualSchedules(rawManual || []);
      setRooms(rawRooms || []);
    } catch (err) {
      console.error('Error fetching teachers schedule data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const unsub = localDb.subscribe(() => fetchData());
    return () => unsub();
  }, []);

  // Consolidate all teacher scheduled items from programs + manual entries
  const allScheduledItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      teacherName: string;
      grade: string;
      days: string[];
      time: string;
      madrasRoom: string;
      type: string;
      isManual: boolean;
      notes?: string;
    }> = [];

    // 1. From regular programs
    programs.forEach(p => {
      const teacherName = (p.teacher || '').trim();
      if (teacherName) {
        items.push({
          id: p.id,
          title: p.title,
          teacherName,
          grade: p.grade || 'نامشخص',
          days: getProgramDays(p),
          time: p.time || 'نامشخص',
          madrasRoom: p.madrasRoom || p.classroom || 'نامشخص',
          type: p.type || 'اصلی',
          isManual: false
        });
      }
    });

    // 2. From manual teacher schedules
    manualSchedules.forEach(m => {
      const teacherName = (m.teacherName || '').trim();
      if (teacherName) {
        items.push({
          id: m.id,
          title: m.title,
          teacherName,
          grade: m.grade || 'عمومی',
          days: m.days && m.days.length > 0 ? m.days : (m.day ? [m.day] : []),
          time: m.time || 'نامشخص',
          madrasRoom: m.madrasRoom || 'نامشخص',
          type: 'برنامه اختصاصی استاد',
          isManual: true,
          notes: m.notes
        });
      }
    });

    return items;
  }, [programs, manualSchedules]);

  // List of teachers who actually have defined classes/programs
  const teachersWithClasses = useMemo(() => {
    const teacherMap = new Map<string, {
      name: string;
      classesCount: number;
      teacherObj?: Teacher;
      items: typeof allScheduledItems;
    }>();

    allScheduledItems.forEach(item => {
      const existing = teacherMap.get(item.teacherName) || {
        name: item.teacherName,
        classesCount: 0,
        teacherObj: teachers.find(t => t.fullName.trim() === item.teacherName.trim()),
        items: []
      };
      existing.classesCount += 1;
      existing.items.push(item);
      teacherMap.set(item.teacherName, existing);
    });

    return Array.from(teacherMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'fa'));
  }, [allScheduledItems, teachers]);

  // Filtered list of teachers to display
  const displayedTeachers = useMemo(() => {
    return teachersWithClasses.filter(t => {
      if (selectedTeacherName !== 'all' && t.name !== selectedTeacherName) {
        return false;
      }
      if (selectedDayFilter !== 'all') {
        const hasDay = t.items.some(item => item.days.includes(selectedDayFilter));
        if (!hasDay) return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = t.name.toLowerCase().includes(term);
        const matchesSubject = t.items.some(item => 
          item.title.toLowerCase().includes(term) || 
          item.grade.toLowerCase().includes(term) || 
          item.madrasRoom.toLowerCase().includes(term)
        );
        if (!matchesName && !matchesSubject) return false;
      }
      return true;
    });
  }, [teachersWithClasses, selectedTeacherName, selectedDayFilter, searchTerm]);

  // Handle Save Manual Schedule
  const handleSaveManualSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTeacherName = manualTeacherName.trim();
    if (!finalTeacherName) {
      alert('لطفاً نام استاد را مشخص فرمایید.');
      return;
    }
    if (!manualSubject.trim()) {
      alert('لطفاً عنوان درس یا فعالیت آموزشی را وارد فرمایید.');
      return;
    }
    if (manualDays.length === 0) {
      alert('لطفاً حداقل یک روز را انتخاب فرمایید.');
      return;
    }

    try {
      await localDb.addDoc('teacher_schedules', {
        teacherName: finalTeacherName,
        title: manualSubject.trim(),
        grade: manualGrade,
        days: manualDays,
        day: manualDays.join(' ، '),
        time: manualTime,
        madrasRoom: manualRoom.trim(),
        notes: manualNotes.trim(),
        createdAt: new Date().toISOString()
      });

      setShowAddManualModal(false);
      setManualSubject('');
      setManualNotes('');
      setManualRoom('');
      fetchData();
    } catch (err) {
      console.error('Error saving manual teacher schedule:', err);
      alert('خطا در ثبت برنامه دستی استاد.');
    }
  };

  // Handle Delete
  const handleDeleteSchedule = async () => {
    if (!scheduleToDelete) return;
    try {
      if (scheduleToDelete.isManual) {
        await localDb.deleteDoc('teacher_schedules', scheduleToDelete.id);
      } else {
        await localDb.deleteDoc('programs', scheduleToDelete.id);
      }
      setScheduleToDelete(null);
      fetchData();
    } catch (err) {
      console.error('Error deleting schedule item:', err);
      alert('خطا در حذف برنامه');
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const rows: any[] = [];

    displayedTeachers.forEach(t => {
      t.items.forEach(item => {
        rows.push({
          'نام استاد': t.name,
          'عنوان درس / کلاس': item.title,
          'نوع کلاس': item.type,
          'پایه تحصیلی': item.grade,
          'روزهای برگزاری': item.days.join(' - '),
          'ساعت برگزاری': item.time,
          'شماره مَدرَس': item.madrasRoom,
          'توضیحات': item.notes || '-'
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'برنامه اساتید');
    XLSX.writeFile(workbook, `Barname_Asatid_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export to PDF
  const handleExportPdf = async () => {
    if (!printContainerRef.current) return;
    try {
      setIsExportingPdf(true);
      await exportElementToPdf({
        element: printContainerRef.current,
        filename: `Barname_Darsi_Asatid_${new Date().toISOString().slice(0, 10)}.pdf`,
        orientation: 'landscape'
      });
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('خطا در ایجاد خروجی PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (!isAuthorizedToView) {
    return (
      <div className="p-8 max-w-2xl mx-auto bg-white rounded-3xl border border-amber-200 shadow-sm text-center space-y-3 font-vazir" dir="rtl">
        <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-700 mx-auto">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-base font-black text-slate-900">عدم دسترسی به بخش برنامه درسی اساتید</h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          مشاهده این بخش بر اساس سطوح دسترسی سامانه برای حساب کاربری شما فعال نمی‌باشد. در صورت نیاز با مدیریت یا مسئول آموزش مدرسه تماس بگیرید.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-vazir" dir="rtl">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs mb-1">
            <GraduationCap size={16} />
            <span>سامانه مدیریت آموزشی مدرسه علمیه</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>برنامه درسی اساتید</span>
            <span className="text-xs font-bold px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
              {teachersWithClasses.length} استاد دارای برنامه فعال
            </span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            مشاهده دروس تعریف‌شده، روزها و ساعات حضور اساتید در مدرسه و برنامه مَدرَس‌ها
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {isAuthorizedToEdit && (
            <button
              type="button"
              onClick={() => {
                setManualTeacherName(teachers[0]?.fullName || '');
                setIsCustomTeacherName(false);
                setShowAddManualModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-100 cursor-pointer"
            >
              <Plus size={15} />
              <span>افزودن برنامه دستی برای استاد</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="خروجی اکسل برنامه اساتید"
          >
            <FileSpreadsheet size={15} className="text-emerald-600" />
            <span>خروجی Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="خروجی PDF برنامه اساتید"
          >
            <FileText size={15} className="text-indigo-600" />
            <span>{isExportingPdf ? 'در حال تهیه...' : 'خروجی PDF'}</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center flex-wrap gap-2.5 flex-1">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="جستجوی استاد، نام درس، پایه یا مَدرَس..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>

          {/* Teacher Selector Filter */}
          <div className="min-w-[180px]">
            <select
              value={selectedTeacherName}
              onChange={(e) => setSelectedTeacherName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">تمام اساتید دارای کلاس ({teachersWithClasses.length} نفر)</option>
              {teachersWithClasses.map(t => (
                <option key={t.name} value={t.name}>
                  استاد {t.name} ({t.classesCount} درس)
                </option>
              ))}
            </select>
          </div>

          {/* Day of Week Filter */}
          <div className="min-w-[130px]">
            <select
              value={selectedDayFilter}
              onChange={(e) => setSelectedDayFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">همه روزهای هفته</option>
              {WEEK_DAYS.map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0 self-end md:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
              viewMode === 'cards' ? "bg-white text-indigo-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <LayoutGrid size={14} />
            <span>کارت اساتید</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('timetable')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
              viewMode === 'timetable' ? "bg-white text-indigo-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Calendar size={14} />
            <span>جدول هفتگی حضور</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
              viewMode === 'table' ? "bg-white text-indigo-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Table size={14} />
            <span>جدول لیست دروس</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div ref={printContainerRef} className="space-y-6">
        {/* Printable Title Header */}
        <div className="hidden print:block text-center border-b pb-4 mb-4">
          <h1 className="text-xl font-black text-slate-900">برنامه درسی و حضور هفتگی اساتید</h1>
          <p className="text-xs text-slate-500 mt-1">سامانه آموزشی مدرسه علمیه • تاریخ صدور: {new Date().toLocaleDateString('fa-IR')}</p>
        </div>

        {loading ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">در حال بارگذاری برنامه درسی اساتید...</p>
          </div>
        ) : displayedTeachers.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mx-auto">
              <GraduationCap size={24} />
            </div>
            <h4 className="text-sm font-bold text-slate-800">هیچ برنامه‌ای برای نمایش یافت نشد</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              تنها اساتیدی که کلاس درسی در بخش برنامه‌های مدرسه برای آن‌ها تعریف شده باشد در این قسمت نمایش داده می‌شوند.
            </p>
          </div>
        ) : viewMode === 'cards' ? (
          // ================= VIEW: TEACHER CARDS =================
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {displayedTeachers.map(teacherGroup => {
              const teacherObj = teacherGroup.teacherObj;
              // Extract all active days for this teacher
              const allDaysSet = new Set<string>();
              teacherGroup.items.forEach(item => item.days.forEach(d => allDaysSet.add(d)));
              const activeDays = Array.from(allDaysSet);

              return (
                <div 
                  key={teacherGroup.name}
                  className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  {/* Teacher Profile Head */}
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-indigo-600 text-white rounded-2xl font-black text-base flex items-center justify-center shadow-xs">
                        {teacherGroup.name[0] || 'ا'}
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                          <span>استاد {teacherGroup.name}</span>
                          {teacherObj?.priority === 1 && (
                            <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-bold">
                              استاد اولویت ۱
                            </span>
                          )}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-medium">
                          <span className="flex items-center gap-1">
                            <BookOpen size={12} className="text-indigo-600" />
                            <span>{teacherGroup.items.length} کلاس تعریف‌شده</span>
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock size={12} className="text-slate-400" />
                            <span>حضور: {activeDays.join(' ، ') || 'تعیین‌نشده'}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {teacherObj?.phoneNumber && (
                      <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-xl">
                        {teacherObj.phoneNumber}
                      </span>
                    )}
                  </div>

                  {/* Classes List */}
                  <div className="space-y-2 flex-1">
                    <h5 className="text-[11px] font-bold text-slate-400">کلاس‌ها و دروس در حال تدریس:</h5>
                    <div className="space-y-2">
                      {teacherGroup.items.map(item => (
                        <div 
                          key={item.id}
                          className="bg-slate-50/90 rounded-2xl p-3 border border-slate-200/80 hover:bg-slate-100/80 transition-colors flex items-center justify-between gap-2"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-slate-900 truncate">{item.title}</span>
                              <span className={cn(
                                "text-[10px] px-2 py-0.5 rounded-md font-bold",
                                item.type === 'اصلی' ? "bg-indigo-50 text-indigo-700 border border-indigo-200" :
                                item.type === 'مشاوره' ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                item.type === 'پژوهش' ? "bg-teal-50 text-teal-700 border border-teal-200" :
                                "bg-purple-50 text-purple-700 border border-purple-200"
                              )}>
                                {item.type}
                              </span>
                              <span className="text-[10px] bg-white text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 font-bold">
                                {item.grade}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium flex-wrap">
                              <span className="flex items-center gap-1 font-bold text-slate-700">
                                <CalendarDays size={12} className="text-indigo-600" />
                                <span>{item.days.join(' ، ')}</span>
                              </span>
                              <span className="flex items-center gap-1 font-mono font-bold text-indigo-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                <Clock size={11} className="text-slate-400" />
                                <span>{item.time}</span>
                              </span>
                              {item.madrasRoom && item.madrasRoom !== 'نامشخص' && (
                                <span className="flex items-center gap-1 text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-bold text-[10px]">
                                  <DoorOpen size={11} />
                                  <span>{item.madrasRoom}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {isAuthorizedToEdit && (
                            <button
                              type="button"
                              onClick={() => setScheduleToDelete({
                                id: item.id,
                                title: item.title,
                                teacher: item.teacherName,
                                isManual: item.isManual
                              })}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="حذف این برنامه"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Presence Summary footer */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>تعداد روزهای حضور در هفته: <strong className="text-slate-800">{activeDays.length} روز</strong></span>
                    <span className="text-indigo-700 font-bold">مجموع ساعات: {teacherGroup.items.length * 1.5} ساعت تقریبی</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : viewMode === 'timetable' ? (
          // ================= VIEW: WEEKLY TIMETABLE MATRIX =================
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4 overflow-x-auto">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="text-indigo-600" size={16} />
              <span>ماتریس برنامه هفتگی و ساعت حضور اساتید در مدرسه</span>
            </h4>

            <table className="w-full border-collapse min-w-[750px] text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-3 text-right font-black text-slate-700 w-36">نام استاد</th>
                  {WEEK_DAYS.map(day => (
                    <th key={day} className="p-3 text-center font-black text-slate-700 border-r border-slate-200">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedTeachers.map(teacherGroup => (
                  <tr key={teacherGroup.name} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-bold text-slate-900 bg-slate-50/40">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-indigo-600 text-white rounded-xl text-xs font-black flex items-center justify-center shrink-0">
                          {teacherGroup.name[0]}
                        </div>
                        <div>
                          <div className="truncate font-black">{teacherGroup.name}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{teacherGroup.items.length} درس</div>
                        </div>
                      </div>
                    </td>

                    {WEEK_DAYS.map(day => {
                      const dayClasses = teacherGroup.items.filter(item => item.days.includes(day));
                      return (
                        <td key={day} className="p-2 border-r border-slate-100 align-top">
                          {dayClasses.length === 0 ? (
                            <span className="text-[10px] text-slate-300 block text-center py-2">—</span>
                          ) : (
                            <div className="space-y-1.5">
                              {dayClasses.map(c => (
                                <div 
                                  key={c.id} 
                                  className="p-1.5 bg-indigo-50/80 rounded-xl border border-indigo-200/90 text-indigo-950 space-y-0.5"
                                >
                                  <div className="font-black text-[11px] truncate">{c.title}</div>
                                  <div className="flex items-center justify-between text-[10px] text-slate-600 font-mono">
                                    <span>{c.time}</span>
                                    <span className="font-bold font-vazir text-slate-500">{c.grade}</span>
                                  </div>
                                  {c.madrasRoom && (
                                    <div className="text-[9px] text-emerald-700 font-bold truncate">
                                      مدرَس: {c.madrasRoom}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          // ================= VIEW: DETAILED TABLE =================
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black">
                    <th className="p-3.5">نام استاد</th>
                    <th className="p-3.5">عنوان درس / کلاس</th>
                    <th className="p-3.5">نوع کلاس</th>
                    <th className="p-3.5">پایه تحصیلی</th>
                    <th className="p-3.5">روزهای حضور</th>
                    <th className="p-3.5">ساعت برگزاری</th>
                    <th className="p-3.5">شماره مَدرَس</th>
                    {isAuthorizedToEdit && <th className="p-3.5 text-center">عملیات</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedTeachers.flatMap(t => 
                    t.items.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 font-bold text-slate-900">
                          استاد {t.name}
                        </td>
                        <td className="p-3.5 font-black text-indigo-950">
                          {item.title}
                        </td>
                        <td className="p-3.5">
                          <span className={cn(
                            "px-2 py-0.5 rounded-md font-bold text-[10px]",
                            item.type === 'اصلی' ? "bg-indigo-50 text-indigo-700 border border-indigo-200" :
                            item.type === 'مشاوره' ? "bg-amber-50 text-amber-700 border border-amber-200" :
                            "bg-teal-50 text-teal-700 border border-teal-200"
                          )}>
                            {item.type}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-slate-700">
                          {item.grade}
                        </td>
                        <td className="p-3.5 font-bold text-slate-800">
                          {item.days.join(' ، ')}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-indigo-900">
                          {item.time}
                        </td>
                        <td className="p-3.5 font-bold text-emerald-800">
                          {item.madrasRoom || 'تعیین‌نشده'}
                        </td>
                        {isAuthorizedToEdit && (
                          <td className="p-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => setScheduleToDelete({
                                id: item.id,
                                title: item.title,
                                teacher: item.teacherName,
                                isManual: item.isManual
                              })}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="حذف برنامه"
                            >
                              <Trash2 size={15} />
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
        )}
      </div>

      {/* Add Manual Schedule Modal */}
      <AnimatePresence>
        {showAddManualModal && (
          <div className="fixed inset-0 bg-[#00000080] flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <GraduationCap className="text-indigo-600" size={18} />
                  <span>افزودن برنامه و ساعت حضور استاد</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddManualModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveManualSchedule} className="space-y-4">
                {/* Teacher Selector with Other option */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">نام استاد</label>
                    <button
                      type="button"
                      onClick={() => setIsCustomTeacherName(!isCustomTeacherName)}
                      className="text-[11px] font-bold text-indigo-600 underline"
                    >
                      {isCustomTeacherName ? 'انتخاب از بانک اساتید' : 'سایر (ورود دستی)'}
                    </button>
                  </div>

                  {!isCustomTeacherName ? (
                    <select
                      className="w-full px-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold bg-white text-slate-800"
                      value={manualTeacherName}
                      onChange={(e) => {
                        if (e.target.value === '__OTHER__') {
                          setIsCustomTeacherName(true);
                          setManualTeacherName('');
                        } else {
                          setManualTeacherName(e.target.value);
                        }
                      }}
                    >
                      <option value="">-- انتخاب استاد از بانک اساتید --</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.fullName}>
                          {t.fullName} {t.phoneNumber ? `(${t.phoneNumber})` : ''}
                        </option>
                      ))}
                      <option value="__OTHER__">➕ سایر (ورود دستی نام استاد)...</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="نام کامل استاد را وارد نمایید..."
                      value={manualTeacherName}
                      onChange={(e) => setManualTeacherName(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    />
                  )}
                </div>

                {/* Subject and Grade */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">عنوان درس / برنامه</label>
                    <input
                      type="text"
                      placeholder="مثلاً اصول فقه، مکاسب..."
                      value={manualSubject}
                      onChange={(e) => setManualSubject(e.target.value)}
                      className="w-full px-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">پایه تحصیلی</label>
                    <select
                      value={manualGrade}
                      onChange={(e) => setManualGrade(e.target.value)}
                      className="w-full px-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold bg-white"
                    >
                      <option value="پایه 7">پایه 7</option>
                      <option value="پایه 8">پایه 8</option>
                      <option value="پایه 9">پایه 9</option>
                      <option value="پایه 10">پایه 10</option>
                      <option value="پایه 11">پایه 11</option>
                      <option value="عمومی">عمومی / کل پایه‌ها</option>
                    </select>
                  </div>
                </div>

                {/* Days of Week Checkboxes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">روزهای حضور و برگزاری:</label>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    {WEEK_DAYS.map(day => {
                      const isChecked = manualDays.includes(day);
                      return (
                        <label 
                          key={day}
                          className={cn(
                            "flex items-center gap-1.5 p-2 rounded-lg border text-xs font-bold cursor-pointer select-none transition-all",
                            isChecked ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setManualDays([...manualDays, day]);
                              } else {
                                setManualDays(manualDays.filter(d => d !== day));
                              }
                            }}
                            className="w-3.5 h-3.5 rounded border-slate-300 accent-indigo-600"
                          />
                          <span className="text-[11px]">{day}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Time & Madras Room */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ساعت برگزاری</label>
                    <select
                      value={manualTime}
                      onChange={(e) => setManualTime(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold bg-white"
                    >
                      {PRESET_HOURS.map(slot => (
                        <option key={slot} value={slot}>{slot}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">شماره مدرَس</label>
                    <select
                      value={manualRoom}
                      onChange={(e) => setManualRoom(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold bg-white"
                    >
                      <option value="">-- انتخاب مَدرَس --</option>
                      {rooms.map(r => (
                        <option key={r.id} value={r.name}>{r.name}</option>
                      ))}
                      <option value="مدرس ۱ (شیخ انصاری)">مدرس ۱ (شیخ انصاری)</option>
                      <option value="مدرس ۲ (علامه حلی)">مدرس ۲ (علامه حلی)</option>
                      <option value="مدرس ۳ (شهید بهشتی)">مدرس ۳ (شهید بهشتی)</option>
                      <option value="مدرس ۴ (ملاصدرا)">مدرس ۴ (ملاصدرا)</option>
                      <option value="مدرس ۵ (شیخ طوسی)">مدرس ۵ (شیخ طوسی)</option>
                      <option value="مدرس ۶ (علامه طباطبایی)">مدرس ۶ (علامه طباطبایی)</option>
                      <option value="سالن اجتماعات (شهید مطهری)">سالن اجتماعات (شهید مطهری)</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">یادداشت و توضیحات (اختیاری)</label>
                  <input
                    type="text"
                    placeholder="مثلاً حضور در دفتر آموزش قبل از کلاس..."
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    className="w-full px-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-100 transition-all cursor-pointer"
                  >
                    ذخیره برنامه استاد
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddManualModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                  >
                    انصراف
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {scheduleToDelete && (
          <div className="fixed inset-0 bg-[#00000080] flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-base font-black text-slate-900">تأیید حذف برنامه درس استاد</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  آیا از حذف درس <strong>«{scheduleToDelete.title}»</strong> مربوط به <strong>استاد {scheduleToDelete.teacher}</strong> اطمینان دارید؟
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDeleteSchedule}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm cursor-pointer"
                >
                  بله، حذف شود
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleToDelete(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  انصراف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
