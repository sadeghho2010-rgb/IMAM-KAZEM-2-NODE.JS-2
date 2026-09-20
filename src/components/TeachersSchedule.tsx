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
  ArrowRight,
  ChevronLeft,
  Phone,
  LayoutGrid, 
  Table, 
  Printer, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  X,
  User,
  ExternalLink,
  Layers,
  Copy,
  Check
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
  '08:00 الی 09:30',
  '10:00 الی 11:30',
  '14:00 الی 15:30',
  '15:45 الی 17:15',
];

export interface ScheduledCourseItem {
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
}

export interface TeacherScheduleGroup {
  id: string; // Teacher Bank ID
  name: string;
  teacherObj: Teacher;
  items: ScheduledCourseItem[];
  classesCount: number;
  activeDays: string[];
  grades: string[];
  rooms: string[];
  totalHoursApprox: number;
}

// Utility to match teacher name in programs with registered teachers in the bank
function matchTeacherWithBank(teacherName: string, bankTeachers: Teacher[]): Teacher | undefined {
  if (!teacherName) return undefined;
  const clean = (s: string) => 
    s.replace(/^استاد\s+/, '')
     .replace(/^حجت\s*الاسلام(\s+و\s*المسلمین)?\s+/, '')
     .replace(/^شیخ\s+/, '')
     .replace(/^دکتر\s+/, '')
     .replace(/^آیت\s*الله\s+/, '')
     .replace(/[\u064B-\u065F\u0670]/g, '') // remove Arabic diacritics
     .replace(/[ي]/g, 'ی')
     .replace(/[ك]/g, 'ک')
     .replace(/\u200c/g, '')
     .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
     .replace(/\s+/g, ' ')
     .trim()
     .toLowerCase();

  const target = clean(teacherName);
  if (!target) return undefined;

  // 1. Exact match on fullName or cleaned fullName
  const direct = bankTeachers.find(t => {
    const tClean = clean(t.fullName || t.name || '');
    return tClean === target || (t.fullName && t.fullName.trim().toLowerCase() === teacherName.trim().toLowerCase());
  });
  if (direct) return direct;

  // 2. Substring matching for compound names
  return bankTeachers.find(t => {
    const tClean = clean(t.fullName || t.name || '');
    if (tClean.length < 3) return false;
    return target.includes(tClean) || tClean.includes(target);
  });
}

export default function TeachersSchedule() {
  const { currentUser } = useAuth();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [manualSchedules, setManualSchedules] = useState<TeacherManualSchedule[]>([]);
  const [rooms, setRooms] = useState<MadrasRoom[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Selected teacher for master-detail view: null = showing teacher list; string = teacher ID
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);

  // Filters for teachers list view
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('all');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('all');

  // Single Teacher View sub-mode
  const [singleViewMode, setSingleViewMode] = useState<'all' | 'timetable' | 'courses'>('all');

  // Manual Schedule Modal State
  const [showAddManualModal, setShowAddManualModal] = useState<boolean>(false);
  const [manualTeacherId, setManualTeacherId] = useState<string>('');
  const [manualSubject, setManualSubject] = useState<string>('');
  const [manualGrade, setManualGrade] = useState<string>('پایه 7');
  const [manualDays, setManualDays] = useState<string[]>(['شنبه']);
  const [manualTime, setManualTime] = useState<string>('08:00 الی 09:00');
  const [manualRoom, setManualRoom] = useState<string>('');
  const [manualNotes, setManualNotes] = useState<string>('');

  // Delete Confirmation
  const [scheduleToDelete, setScheduleToDelete] = useState<{
    id: string;
    title: string;
    teacher: string;
    isManual: boolean;
  } | null>(null);

  // PDF Export
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const allTeachersPrintRef = useRef<HTMLDivElement>(null);
  const singleTeacherPrintRef = useRef<HTMLDivElement>(null);

  // Phone multi-copy state (Level 2)
  const isLevel2User = currentUser?.level === 1 || currentUser?.level === 2;
  const [isMultiCopyMode, setIsMultiCopyMode] = useState<boolean>(false);
  const [selectedMultiPhoneIds, setSelectedMultiPhoneIds] = useState<string[]>([]);
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  // Authorization check: Only Education Officer / Manager / SuperAdmin can edit/add
  const isAuthorizedToEdit = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.isReadOnly) return false;
    if (currentUser.level === 1 && currentUser.role === 'super_admin') return true;
    if (
      currentUser.role === 'education_manager' || 
      currentUser.role === 'education_officer' || 
      currentUser.username?.toUpperCase() === 'SHAH'
    ) return true;
    return false;
  }, [currentUser]);

  // View authorization: Level 1 and 2 can view; Level 3 cannot by default
  const isAuthorizedToView = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.level === 1) return true;
    if (currentUser.level === 2) return true;
    if (currentUser.level === 3) return false;
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

  // Consolidate all scheduled items from regular programs + manual schedules
  const allScheduledItems = useMemo(() => {
    const items: ScheduledCourseItem[] = [];

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

  // Strictly filter and group ONLY teachers who:
  // 1) Are registered in the Teachers Bank (`teachers`)
  // 2) Have at least one scheduled class/program
  const registeredTeachersWithClasses = useMemo(() => {
    const result: TeacherScheduleGroup[] = [];

    teachers.forEach(teacherObj => {
      if (!teacherObj.fullName) return;

      // Find all items belonging to this registered teacher
      const matchedItems = allScheduledItems.filter(item => {
        const matched = matchTeacherWithBank(item.teacherName, [teacherObj]);
        return !!matched;
      });

      if (matchedItems.length > 0) {
        // Collect active days
        const daysSet = new Set<string>();
        matchedItems.forEach(it => it.days.forEach(d => daysSet.add(d)));
        const activeDays = WEEK_DAYS.filter(d => daysSet.has(d));

        // Collect grades
        const gradesSet = new Set<string>();
        matchedItems.forEach(it => {
          if (it.grade && it.grade !== 'نامشخص') gradesSet.add(it.grade);
        });

        // Collect rooms
        const roomsSet = new Set<string>();
        matchedItems.forEach(it => {
          if (it.madrasRoom && it.madrasRoom !== 'نامشخص') roomsSet.add(it.madrasRoom);
        });

        result.push({
          id: teacherObj.id,
          name: teacherObj.fullName.trim(),
          teacherObj,
          items: matchedItems,
          classesCount: matchedItems.length,
          activeDays,
          grades: Array.from(gradesSet),
          rooms: Array.from(roomsSet),
          totalHoursApprox: Number((matchedItems.length * 1.5).toFixed(1))
        });
      }
    });

    // Also capture any teachers present in scheduled items who may not yet be in the bank
    const matchedItemIds = new Set<string>();
    result.forEach(r => r.items.forEach(it => matchedItemIds.add(it.id)));

    const unmatchedItems = allScheduledItems.filter(it => !matchedItemIds.has(it.id));
    if (unmatchedItems.length > 0) {
      const unmatchedByTeacher = new Map<string, typeof unmatchedItems>();
      unmatchedItems.forEach(it => {
        const rawName = (it.teacherName || '').trim();
        if (!rawName || rawName === 'نامشخص') return;
        if (!unmatchedByTeacher.has(rawName)) {
          unmatchedByTeacher.set(rawName, []);
        }
        unmatchedByTeacher.get(rawName)!.push(it);
      });

      unmatchedByTeacher.forEach((itemsList, teacherName) => {
        const daysSet = new Set<string>();
        itemsList.forEach(it => it.days.forEach(d => daysSet.add(d)));
        const activeDays = WEEK_DAYS.filter(d => daysSet.has(d));

        const gradesSet = new Set<string>();
        itemsList.forEach(it => {
          if (it.grade && it.grade !== 'نامشخص') gradesSet.add(it.grade);
        });

        const roomsSet = new Set<string>();
        itemsList.forEach(it => {
          if (it.madrasRoom && it.madrasRoom !== 'نامشخص') roomsSet.add(it.madrasRoom);
        });

        result.push({
          id: `unregistered_${teacherName}`,
          name: teacherName,
          teacherObj: {
            id: `unregistered_${teacherName}`,
            fullName: teacherName,
            name: teacherName,
            priority: 2,
            isActive: true
          } as Teacher,
          items: itemsList,
          classesCount: itemsList.length,
          activeDays,
          grades: Array.from(gradesSet),
          rooms: Array.from(roomsSet),
          totalHoursApprox: Number((itemsList.length * 1.5).toFixed(1))
        });
      });
    }

    // Sort by priority (1 first) then alphabetically
    return result.sort((a, b) => {
      const pA = Number(a.teacherObj.priority) || 3;
      const pB = Number(b.teacherObj.priority) || 3;
      if (pA !== pB) return pA - pB;
      return a.name.localeCompare(b.name, 'fa');
    });
  }, [teachers, allScheduledItems]);

  // Filtered teachers list for main directory view
  const displayedTeachers = useMemo(() => {
    return registeredTeachersWithClasses.filter(t => {
      // Day filter
      if (selectedDayFilter !== 'all') {
        const hasDay = t.activeDays.includes(selectedDayFilter);
        if (!hasDay) return false;
      }
      // Grade filter
      if (selectedGradeFilter !== 'all') {
        const hasGrade = t.grades.includes(selectedGradeFilter);
        if (!hasGrade) return false;
      }
      // Priority filter
      if (selectedPriorityFilter !== 'all') {
        if (String(t.teacherObj.priority) !== selectedPriorityFilter) return false;
      }
      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchesName = t.name.toLowerCase().includes(term);
        const matchesSpecialty = (t.teacherObj.categories || []).some(cat => cat.toLowerCase().includes(term));
        const matchesSubject = t.items.some(it => 
          it.title.toLowerCase().includes(term) || 
          it.grade.toLowerCase().includes(term) || 
          it.madrasRoom.toLowerCase().includes(term)
        );
        if (!matchesName && !matchesSpecialty && !matchesSubject) return false;
      }
      return true;
    });
  }, [registeredTeachersWithClasses, selectedDayFilter, selectedGradeFilter, selectedPriorityFilter, searchTerm]);

  // The active selected teacher object (when in detail view)
  const currentSelectedTeacher = useMemo(() => {
    if (!selectedTeacherId) return null;
    return registeredTeachersWithClasses.find(t => t.id === selectedTeacherId) || null;
  }, [selectedTeacherId, registeredTeachersWithClasses]);

  // Available grades for filtering
  const allAvailableGrades = useMemo(() => {
    const gradesSet = new Set<string>();
    registeredTeachersWithClasses.forEach(t => t.grades.forEach(g => gradesSet.add(g)));
    return Array.from(gradesSet).sort();
  }, [registeredTeachersWithClasses]);

  // Save manual schedule
  const handleSaveManualSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedT = teachers.find(t => t.id === manualTeacherId);
    if (!selectedT) {
      alert('لطفاً یک استاد را از بانک اساتید انتخاب فرمایید.');
      return;
    }
    if (!manualSubject.trim()) {
      alert('لطفاً عنوان درس یا فعالیت آموزشی را وارد فرمایید.');
      return;
    }
    if (manualDays.length === 0) {
      alert('لطفاً حداقل یک روز برای برگزاری کلاس انتخاب فرمایید.');
      return;
    }

    try {
      const newManual: TeacherManualSchedule = {
        id: `ts_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        teacherName: selectedT.fullName.trim(),
        title: manualSubject.trim(),
        grade: manualGrade,
        days: manualDays,
        time: manualTime,
        madrasRoom: manualRoom || 'نامشخص',
        notes: manualNotes.trim() || undefined,
        createdAt: new Date().toISOString()
      };

      await localDb.setDoc('teacher_schedules', newManual);
      setShowAddManualModal(false);
      setManualSubject('');
      setManualNotes('');
      fetchData();
    } catch (err) {
      console.error('Error saving manual schedule:', err);
      alert('خطا در ثبت برنامه استاد.');
    }
  };

  // Delete schedule
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

  // Open modal prefilled with teacher
  const openAddScheduleModal = (preselectedTeacherId?: string) => {
    if (preselectedTeacherId) {
      setManualTeacherId(preselectedTeacherId);
    } else if (selectedTeacherId) {
      setManualTeacherId(selectedTeacherId);
    } else if (teachers.length > 0) {
      setManualTeacherId(teachers[0].id);
    }
    setManualSubject('');
    setManualNotes('');
    setManualDays(['شنبه']);
    setShowAddManualModal(true);
  };

  // Export ALL teachers to Excel
  const handleExportAllExcel = () => {
    const rows: any[] = [];

    registeredTeachersWithClasses.forEach(t => {
      t.items.forEach(item => {
        rows.push({
          'نام استاد': t.name,
          'تلفن همراه': t.teacherObj.phoneNumber || '-',
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
    XLSX.utils.book_append_sheet(workbook, worksheet, 'برنامه کلی اساتید');
    XLSX.writeFile(workbook, `Barname_Koli_Asatid_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export ALL teachers to PDF
  const handleExportAllPdf = async () => {
    if (!allTeachersPrintRef.current) return;
    try {
      setIsExportingPdf(true);
      await exportElementToPdf({
        element: allTeachersPrintRef.current,
        filename: `Gozaresh_Koli_Barname_Asatid_${new Date().toISOString().slice(0, 10)}.pdf`,
        orientation: 'landscape'
      });
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('خطا در ایجاد خروجی PDF کلیه اساتید.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Export SINGLE teacher to Excel
  const handleExportSingleTeacherExcel = (teacher: TeacherScheduleGroup) => {
    const rows = teacher.items.map(item => ({
      'نام استاد': teacher.name,
      'تلفن همراه': teacher.teacherObj.phoneNumber || '-',
      'عنوان درس / کلاس': item.title,
      'نوع کلاس': item.type,
      'پایه تحصیلی': item.grade,
      'روزهای برگزاری': item.days.join(' - '),
      'ساعت برگزاری': item.time,
      'شماره مَدرَس': item.madrasRoom,
      'توضیحات': item.notes || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `برنامه استاد ${teacher.name}`);
    XLSX.writeFile(workbook, `Barname_Ostad_${teacher.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export SINGLE teacher to PDF
  const handleExportSingleTeacherPdf = async (teacher: TeacherScheduleGroup) => {
    if (!singleTeacherPrintRef.current) return;
    try {
      setIsExportingPdf(true);
      await exportElementToPdf({
        element: singleTeacherPrintRef.current,
        filename: `Barname_Darsi_Ostad_${teacher.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`,
        orientation: 'portrait'
      });
    } catch (err) {
      console.error('Error exporting single teacher PDF:', err);
      alert('خطا در ایجاد خروجی PDF برنامه استاد.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Handle copying all selected teacher phone numbers
  const handleCopySelectedPhones = () => {
    const selectedTeachers = registeredTeachersWithClasses.filter(t => selectedMultiPhoneIds.includes(t.id));
    const phones = selectedTeachers
      .map(t => t.teacherObj.phoneNumber?.trim())
      .filter((p): p is string => !!p && p.length > 3);

    if (phones.length === 0) {
      alert('هیچ شماره تلفنی برای اساتید انتخاب‌شده یافت نشد.');
      return;
    }

    const textToCopy = phones.join('\n');
    navigator.clipboard.writeText(textToCopy);
    alert(`${phones.length.toLocaleString('fa-IR')} شماره تلفن اساتید با موفقیت کپی شد! می‌توانید همگی را در یکجا Paste کنید.`);
  };

  // Access denied guard
  if (!isAuthorizedToView) {
    return (
      <div className="p-8 max-w-2xl mx-auto bg-white rounded-3xl border border-amber-200 shadow-xs text-center space-y-3 font-vazir" dir="rtl">
        <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-700 mx-auto">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-base font-black text-slate-900">عدم دسترسی به بخش برنامه درسی اساتید</h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          مشاهده این بخش بر اساس سطوح دسترسی سامانه برای حساب کاربری شما فعال نمی‌باشد. در صورت نیاز با مسئول آموزش یا مدیریت تماس بگیرید.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-vazir" dir="rtl">
      
      {/* ========================================================================= */}
      {/* 1. TOP BANNER / NAVIGATION HEADER */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs mb-1">
            <GraduationCap size={16} />
            <span>سامانه مدیریت آموزشی مدرسه علمیه</span>
            {selectedTeacherId && currentSelectedTeacher && (
              <>
                <ChevronLeft size={14} className="text-slate-400" />
                <span className="text-slate-600">برنامه اختصاصی استاد</span>
              </>
            )}
          </div>

          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>{currentSelectedTeacher ? `برنامه درسی و ساعات حضور: استاد ${currentSelectedTeacher.name}` : 'لیست و برنامه درسی اساتید'}</span>
            {!currentSelectedTeacher && (
              <span className="text-xs font-bold px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                {registeredTeachersWithClasses.length} استاد ثبت‌شده دارای برنامه
              </span>
            )}
          </h2>

          <p className="text-xs text-slate-500 font-medium mt-1">
            {currentSelectedTeacher 
              ? 'مشاهده دروس، زمان‌بندی هفتگی، مَدرَس‌ها و دریافت خروجی‌های اختصاصی این استاد'
              : 'صرفاً اساتید ثبت‌شده در بانک اساتید مدرسه که کلاس درسی فعال دارند در این بخش نمایش داده می‌شوند.'}
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Back button when inside single teacher view */}
          {currentSelectedTeacher ? (
            <button
              type="button"
              onClick={() => setSelectedTeacherId(null)}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <ArrowRight size={15} />
              <span>بازگشت به لیست اساتید</span>
            </button>
          ) : (
            <>
              {/* Reports for ALL teachers */}
              {isLevel2User && (
                <button
                  type="button"
                  onClick={() => setIsMultiCopyMode(prev => !prev)}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs",
                    isMultiCopyMode 
                      ? "bg-amber-500 text-white border-amber-600" 
                      : "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100"
                  )}
                  title="انتخاب و کپی چندگانه شماره تلفن اساتید جهت خروج و Paste خارج از سامانه"
                >
                  <Copy size={15} />
                  <span>{isMultiCopyMode ? 'بستن کپی چندگانه' : 'کپی کردن چندگانه شماره تلفن'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExportAllExcel}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="خروجی اکسل برنامه کلی همه اساتید"
              >
                <FileSpreadsheet size={15} className="text-emerald-600" />
                <span>خروجی Excel کل اساتید</span>
              </button>

              <button
                type="button"
                onClick={handleExportAllPdf}
                disabled={isExportingPdf}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="خروجی PDF برنامه کلی همه اساتید"
              >
                <FileText size={15} className="text-indigo-600" />
                <span>{isExportingPdf ? 'در حال تهیه...' : 'خروجی PDF کل اساتید'}</span>
              </button>
            </>
          )}

          {/* Add schedule button for Education Officer */}
          {isAuthorizedToEdit && (
            <button
              type="button"
              onClick={() => openAddScheduleModal(currentSelectedTeacher?.id)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shadow-indigo-100 cursor-pointer"
            >
              <Plus size={15} />
              <span>{currentSelectedTeacher ? 'افزودن درس برای این استاد' : 'افزودن برنامه برای استاد'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN VIEW SWITCH: EITHER LIST OF TEACHERS OR SINGLE TEACHER VIEW */}
      {/* ========================================================================= */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-500">در حال بارگذاری اطلاعات اساتید و برنامه‌های درسی...</p>
        </div>
      ) : !currentSelectedTeacher ? (
        /* ===================================================================== */
        /* VIEW A: LIST OF REGISTERED TEACHERS ONLY                              */
        /* ===================================================================== */
        <div className="space-y-5">
          {/* Filter Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center flex-wrap gap-2.5 flex-1">
              {/* Search */}
              <div className="relative flex-1 min-w-[220px]">
                <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="جستجوی نام استاد، تخصص، عنوان درس..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              {/* Day filter */}
              <div className="min-w-[140px]">
                <select
                  value={selectedDayFilter}
                  onChange={(e) => setSelectedDayFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">همه روزهای حضور</option>
                  {WEEK_DAYS.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>

              {/* Grade filter */}
              {allAvailableGrades.length > 0 && (
                <div className="min-w-[120px]">
                  <select
                    value={selectedGradeFilter}
                    onChange={(e) => setSelectedGradeFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="all">همه پایه‌ها</option>
                    {allAvailableGrades.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Priority filter */}
              <div className="min-w-[120px]">
                <select
                  value={selectedPriorityFilter}
                  onChange={(e) => setSelectedPriorityFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">همه اولویت‌ها</option>
                  <option value="1">اولویت ۱</option>
                  <option value="2">اولویت ۲</option>
                  <option value="3">اولویت ۳</option>
                </select>
              </div>

              {(searchTerm || selectedDayFilter !== 'all' || selectedGradeFilter !== 'all' || selectedPriorityFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedDayFilter('all');
                    setSelectedGradeFilter('all');
                    setSelectedPriorityFilter('all');
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold px-2 py-1 cursor-pointer"
                >
                  پاکسازی فیلترها
                </button>
              )}
            </div>

            <div className="text-xs font-bold text-slate-500 shrink-0 self-end md:self-auto">
              نمایش {displayedTeachers.length} از {registeredTeachersWithClasses.length} استاد
            </div>
          </div>

          {/* Multi-copy Phone Action Banner */}
          {isLevel2User && isMultiCopyMode && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-amber-900">
                  انتخاب اساتید جهت کپی شماره تلفن: ({selectedMultiPhoneIds.length} از {displayedTeachers.length} استاد)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedMultiPhoneIds.length === displayedTeachers.length) {
                      setSelectedMultiPhoneIds([]);
                    } else {
                      setSelectedMultiPhoneIds(displayedTeachers.map(t => t.id));
                    }
                  }}
                  className="text-xs text-amber-800 underline font-bold cursor-pointer hover:text-amber-950"
                >
                  {selectedMultiPhoneIds.length === displayedTeachers.length ? 'لغو انتخاب همه' : 'انتخاب همه اساتید'}
                </button>
              </div>
              <button
                type="button"
                onClick={handleCopySelectedPhones}
                disabled={selectedMultiPhoneIds.length === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Copy size={15} />
                <span>کپی یکجای شماره‌ها ({selectedMultiPhoneIds.length})</span>
              </button>
            </div>
          )}

          {/* Teachers Grid / List */}
          {displayedTeachers.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mx-auto">
                <GraduationCap size={24} />
              </div>
              <h4 className="text-sm font-bold text-slate-800">هیچ استادی مطابق با فیلتر یافت نشد</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                تنها اساتید ثبت‌شده در بانک اساتید که دارای برنامه درسی فعال هستند در این بخش نمایش داده می‌شوند.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {displayedTeachers.map(teacherGroup => {
                const tObj = teacherGroup.teacherObj;
                const priorityNum = Number(tObj.priority) || 3;
                const isSelectedForMulti = selectedMultiPhoneIds.includes(teacherGroup.id);

                return (
                  <div
                    key={teacherGroup.id}
                    onClick={() => {
                      if (isMultiCopyMode) {
                        setSelectedMultiPhoneIds(prev => 
                          prev.includes(teacherGroup.id)
                            ? prev.filter(i => i !== teacherGroup.id)
                            : [...prev, teacherGroup.id]
                        );
                      } else {
                        setSelectedTeacherId(teacherGroup.id);
                      }
                    }}
                    className={cn(
                      "group bg-white rounded-3xl p-5 border transition-all cursor-pointer flex flex-col justify-between space-y-4",
                      isMultiCopyMode && isSelectedForMulti
                        ? "border-amber-500 bg-amber-50/40 shadow-md ring-2 ring-amber-400"
                        : "border-slate-200 hover:border-indigo-400 hover:shadow-md"
                    )}
                  >
                    {/* Header: Name, Specialty, Priority */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {isMultiCopyMode ? (
                            <input
                              type="checkbox"
                              checked={isSelectedForMulti}
                              onChange={() => {}}
                              className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-base flex items-center justify-center shadow-xs group-hover:bg-indigo-700 transition-colors">
                              {teacherGroup.name[0] || 'ا'}
                            </div>
                          )}
                          <div>
                            <h3 className="text-sm font-black text-slate-900 group-hover:text-indigo-700 transition-colors flex items-center gap-1.5">
                              <span>استاد {teacherGroup.name}</span>
                            </h3>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 font-medium">
                              {tObj.categories && tObj.categories.length > 0 ? (
                                <span>{tObj.categories.slice(0, 2).join(' • ')}</span>
                              ) : (
                                <span>عضو هیئت علمی / اساتید</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {priorityNum === 1 ? (
                          <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-bold">
                            اولویت ۱
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-full font-bold">
                            اولویت {priorityNum}
                          </span>
                        )}
                      </div>

                      {/* Phone & Info if available */}
                      {tObj.phoneNumber ? (
                        <div className="flex items-center justify-between gap-1.5 text-[11px] font-medium pt-1">
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <Phone size={12} className="text-slate-400" />
                            <span className="font-mono">{tObj.phoneNumber}</span>
                          </div>
                          {isLevel2User && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(tObj.phoneNumber!.trim());
                                setCopiedPhoneId(tObj.id);
                                setTimeout(() => setCopiedPhoneId(null), 2000);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-[10px] font-bold transition-all cursor-pointer shadow-2xs"
                              title="کپی شماره تلفن این استاد"
                            >
                              {copiedPhoneId === tObj.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                              <span>{copiedPhoneId === tObj.id ? 'کپی شد' : 'کپی شماره'}</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 italic">بدون شماره تماس ثبت‌شده</div>
                      )}

                      {/* Badges: Total Classes, Active Days */}
                      <div className="space-y-2 pt-1 border-t border-slate-100">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-500 flex items-center gap-1">
                            <BookOpen size={13} className="text-indigo-600" />
                            <span>کلاس‌های فعال:</span>
                          </span>
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg text-[11px]">
                            {teacherGroup.classesCount} درس / سرفصل
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-500 flex items-center gap-1">
                            <Clock size={13} className="text-slate-400" />
                            <span>ساعات تقریبی تدریس:</span>
                          </span>
                          <span className="text-slate-800 font-mono text-[11px]">
                            {teacherGroup.totalHoursApprox} ساعت در هفته
                          </span>
                        </div>

                        {/* Days of presence */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400">روزهای حضور در مدرسه:</span>
                          <div className="flex items-center flex-wrap gap-1">
                            {teacherGroup.activeDays.map(day => (
                              <span key={day} className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                                {day}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Grades preview */}
                        {teacherGroup.grades.length > 0 && (
                          <div className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-500 font-medium">
                            <span className="text-[10px] text-slate-400 font-bold">پایه‌ها:</span>
                            <span className="text-slate-700 font-bold">{teacherGroup.grades.join(' ، ')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button: View schedule */}
                    <div className="pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTeacherId(teacherGroup.id);
                        }}
                        className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>مشاهده برنامه درسی استاد</span>
                        <ChevronLeft size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ===================================================================== */
        /* VIEW B: DETAILED SCHEDULE FOR ONE SELECTED TEACHER                    */
        /* ===================================================================== */
        <div className="space-y-6">
          {/* Teacher Profile Summary Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white font-black text-2xl flex items-center justify-center shadow-md shadow-indigo-100">
                  {currentSelectedTeacher.name[0] || 'ا'}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-black text-slate-900">
                      استاد {currentSelectedTeacher.name}
                    </h3>
                    <span className="text-[10px] px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-bold">
                      ثبت‌شده در بانک اساتید
                    </span>
                    {Number(currentSelectedTeacher.teacherObj.priority) === 1 && (
                      <span className="text-[10px] px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full font-bold">
                        استاد اولویت ۱
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-600 font-medium flex-wrap">
                    {currentSelectedTeacher.teacherObj.categories && currentSelectedTeacher.teacherObj.categories.length > 0 && (
                      <span className="flex items-center gap-1">
                        <BookOpen size={14} className="text-indigo-600" />
                        <span>تخصص: {currentSelectedTeacher.teacherObj.categories.join(' ، ')}</span>
                      </span>
                    )}
                    {currentSelectedTeacher.teacherObj.phoneNumber && (
                      <span className="flex items-center gap-1 font-mono">
                        <Phone size={14} className="text-slate-400" />
                        <span>{currentSelectedTeacher.teacherObj.phoneNumber}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Single Teacher Specific Export Buttons */}
              <div className="flex items-center flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleExportSingleTeacherExcel(currentSelectedTeacher)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="خروجی فایل اکسل برنامه این استاد"
                >
                  <FileSpreadsheet size={15} className="text-emerald-600" />
                  <span>خروجی اکسل این استاد</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportSingleTeacherPdf(currentSelectedTeacher)}
                  disabled={isExportingPdf}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="چاپ و خروجی PDF برنامه این استاد"
                >
                  <FileText size={15} className="text-indigo-600" />
                  <span>{isExportingPdf ? 'در حال صدور...' : 'چاپ / PDF برنامه استاد'}</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics of this Teacher */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <span className="block text-[11px] font-bold text-slate-500 mb-1">تعداد کل کلاس‌ها:</span>
                <span className="text-base font-black text-indigo-900">{currentSelectedTeacher.classesCount} عنوان کلاس</span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <span className="block text-[11px] font-bold text-slate-500 mb-1">روزهای حضور در هفته:</span>
                <span className="text-base font-black text-slate-900">{currentSelectedTeacher.activeDays.length} روز</span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <span className="block text-[11px] font-bold text-slate-500 mb-1">مجموع ساعات هفتگی:</span>
                <span className="text-base font-black text-emerald-800">{currentSelectedTeacher.totalHoursApprox} ساعت</span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <span className="block text-[11px] font-bold text-slate-500 mb-1">مَدرَس‌های کلاس‌ها:</span>
                <span className="text-xs font-black text-slate-800 truncate block">
                  {currentSelectedTeacher.rooms.length > 0 ? currentSelectedTeacher.rooms.join(' ، ') : 'تعیین‌نشده'}
                </span>
              </div>
            </div>

            {/* Sub-view switcher within single teacher view */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">حالت نمایش برنامه:</span>
                <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSingleViewMode('all')}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      singleViewMode === 'all' ? "bg-white text-indigo-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    نمایش کامل (جدول + کارت‌ها)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSingleViewMode('timetable')}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      singleViewMode === 'timetable' ? "bg-white text-indigo-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    فقط جدول هفتگی
                  </button>
                  <button
                    type="button"
                    onClick={() => setSingleViewMode('courses')}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      singleViewMode === 'courses' ? "bg-white text-indigo-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    فقط لیست دروس
                  </button>
                </div>
              </div>

              {/* Quick switch between teachers dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 hidden sm:inline">تغییر استاد:</span>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {registeredTeachersWithClasses.map(t => (
                    <option key={t.id} value={t.id}>
                      استاد {t.name} ({t.classesCount} درس)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Printable Container for THIS specific teacher */}
          <div ref={singleTeacherPrintRef} className="space-y-6">
            
            {/* Header specifically for print */}
            <div className="hidden print:block text-center border-b pb-4 mb-4">
              <h1 className="text-xl font-black text-slate-900">برنامه هفتگی و ساعات حضور استاد در مدرسه علمیه</h1>
              <h2 className="text-base font-black text-indigo-900 mt-1">استاد {currentSelectedTeacher.name}</h2>
              <p className="text-xs text-slate-500 mt-1">
                تلفن تماس: {currentSelectedTeacher.teacherObj.phoneNumber || '—'} • تاریخ صدور: {new Date().toLocaleDateString('fa-IR')}
              </p>
            </div>

            {/* 1. Weekly Timetable Matrix for this Teacher */}
            {(singleViewMode === 'all' || singleViewMode === 'timetable') && (
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4 overflow-x-auto">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Calendar className="text-indigo-600" size={16} />
                    <span>جدول زمانی برنامه هفتگی استاد {currentSelectedTeacher.name}</span>
                  </h4>
                  <span className="text-[11px] font-bold text-slate-500">
                    حضور در روزهای: {currentSelectedTeacher.activeDays.join(' ، ')}
                  </span>
                </div>

                <table className="w-full border-collapse min-w-[700px] text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-3 text-right font-black text-slate-700 w-32">روز هفته</th>
                      <th className="p-3 text-right font-black text-slate-700">کلاس‌ها، ساعات برگزاری و مَدرَس</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {WEEK_DAYS.map(day => {
                      const dayClasses = currentSelectedTeacher.items.filter(item => item.days.includes(day));
                      const isPresent = dayClasses.length > 0;

                      return (
                        <tr 
                          key={day} 
                          className={cn(
                            "transition-colors",
                            isPresent ? "bg-white hover:bg-slate-50/60" : "bg-slate-50/40 text-slate-400"
                          )}
                        >
                          <td className="p-3.5 font-black text-slate-900 align-top">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "w-2.5 h-2.5 rounded-full",
                                isPresent ? "bg-indigo-600" : "bg-slate-300"
                              )} />
                              <span>{day}</span>
                            </div>
                          </td>

                          <td className="p-3 align-top">
                            {dayClasses.length === 0 ? (
                              <span className="text-xs text-slate-400 font-medium">بدون برنامه درسی در این روز</span>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                {dayClasses.map(c => (
                                  <div
                                    key={c.id}
                                    className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl space-y-1.5"
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="font-black text-xs text-indigo-950 truncate">{c.title}</span>
                                      <span className="text-[10px] px-1.5 py-0.5 bg-white text-slate-700 border border-slate-200 rounded font-bold">
                                        {c.grade}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2 text-[11px] text-slate-600 font-mono">
                                      <Clock size={12} className="text-slate-400" />
                                      <span>{c.time}</span>
                                    </div>

                                    {c.madrasRoom && c.madrasRoom !== 'نامشخص' && (
                                      <div className="flex items-center gap-1 text-[11px] text-emerald-800 font-bold">
                                        <DoorOpen size={12} />
                                        <span>مَدرَس: {c.madrasRoom}</span>
                                      </div>
                                    )}

                                    {c.notes && (
                                      <p className="text-[10px] text-slate-500 font-medium pt-1 border-t border-indigo-100">
                                        {c.notes}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 2. Detailed Course Cards for this Teacher */}
            {(singleViewMode === 'all' || singleViewMode === 'courses') && (
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <BookOpen className="text-indigo-600" size={16} />
                    <span>فهرست تفصیلی سرفصل‌ها و کلاس‌های در حال تدریس ({currentSelectedTeacher.items.length} درس)</span>
                  </h4>

                  {isAuthorizedToEdit && (
                    <button
                      type="button"
                      onClick={() => openAddScheduleModal(currentSelectedTeacher.id)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>افزودن کلاس جدید</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {currentSelectedTeacher.items.map(item => (
                    <div
                      key={item.id}
                      className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/80 hover:bg-slate-100/70 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <h5 className="text-sm font-black text-slate-900">{item.title}</h5>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn(
                                "text-[10px] px-2 py-0.5 rounded-md font-bold",
                                item.type === 'اصلی' ? "bg-indigo-50 text-indigo-700 border border-indigo-200" :
                                item.type === 'مشاوره' ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                item.type === 'پژوهش' ? "bg-teal-50 text-teal-700 border border-teal-200" :
                                "bg-purple-50 text-purple-700 border border-purple-200"
                              )}>
                                {item.type}
                              </span>
                              <span className="text-[10px] bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-bold">
                                {item.grade}
                              </span>
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
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="حذف این برنامه"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>

                        <div className="space-y-1.5 text-xs text-slate-600 font-medium pt-1">
                          <div className="flex items-center gap-2">
                            <CalendarDays size={13} className="text-indigo-600 shrink-0" />
                            <span>روزهای برگزاری: <strong>{item.days.join(' ، ')}</strong></span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Clock size={13} className="text-slate-400 shrink-0" />
                            <span>ساعت برگزاری: <strong className="font-mono">{item.time}</strong></span>
                          </div>

                          {item.madrasRoom && (
                            <div className="flex items-center gap-2">
                              <DoorOpen size={13} className="text-emerald-700 shrink-0" />
                              <span>محل تشکیل (مَدرَس): <strong className="text-emerald-800">{item.madrasRoom}</strong></span>
                            </div>
                          )}

                          {item.notes && (
                            <p className="text-[11px] text-slate-500 bg-white p-2 rounded-xl border border-slate-200/60 mt-1">
                              {item.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. HIDDEN PRINT CONTAINER FOR ALL TEACHERS COMBINED                       */}
      {/* ========================================================================= */}
      <div className="hidden">
        <div ref={allTeachersPrintRef} className="p-8 space-y-6 bg-white font-vazir text-slate-900" dir="rtl">
          <div className="text-center border-b pb-4 mb-4">
            <h1 className="text-2xl font-black text-slate-900">گزارش جامع برنامه درسی و هفتگی اساتید</h1>
            <p className="text-xs text-slate-500 mt-1">
              مدرسه علمیه • تاریخ صدور: {new Date().toLocaleDateString('fa-IR')} • تعداد اساتید: {registeredTeachersWithClasses.length} نفر
            </p>
          </div>

          <table className="w-full text-xs text-right border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-black">
                <th className="p-2.5 border-r border-slate-300">ردیف</th>
                <th className="p-2.5 border-r border-slate-300">نام استاد</th>
                <th className="p-2.5 border-r border-slate-300">عنوان درس</th>
                <th className="p-2.5 border-r border-slate-300">پایه</th>
                <th className="p-2.5 border-r border-slate-300">روزهای برگزاری</th>
                <th className="p-2.5 border-r border-slate-300">ساعت برگزاری</th>
                <th className="p-2.5 border-r border-slate-300">شماره مَدرَس</th>
                <th className="p-2.5">توضیحات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {registeredTeachersWithClasses.flatMap((t, tIndex) => 
                t.items.map((item, iIndex) => (
                  <tr key={`${t.id}_${item.id}`} className="hover:bg-slate-50">
                    <td className="p-2 border-r border-slate-200 text-center font-mono">
                      {iIndex === 0 ? tIndex + 1 : ''}
                    </td>
                    <td className="p-2 border-r border-slate-200 font-bold">
                      {iIndex === 0 ? `استاد ${t.name}` : ''}
                    </td>
                    <td className="p-2 border-r border-slate-200 font-black text-indigo-950">{item.title}</td>
                    <td className="p-2 border-r border-slate-200">{item.grade}</td>
                    <td className="p-2 border-r border-slate-200">{item.days.join(' ، ')}</td>
                    <td className="p-2 border-r border-slate-200 font-mono">{item.time}</td>
                    <td className="p-2 border-r border-slate-200 font-bold">{item.madrasRoom}</td>
                    <td className="p-2 text-slate-500">{item.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MODALS: ADD MANUAL SCHEDULE & CONFIRM DELETE                           */}
      {/* ========================================================================= */}

      {/* Add Manual Schedule Modal */}
      <AnimatePresence>
        {showAddManualModal && (
          <div className="fixed inset-0 bg-[#00000080] flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto font-vazir"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <GraduationCap className="text-indigo-600" size={18} />
                  <span>افزودن برنامه درسی برای استاد</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddManualModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveManualSchedule} className="space-y-4">
                {/* Teacher Selector strictly from Teachers Bank */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    انتخاب استاد (ثبت‌شده در بانک اساتید) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    className="w-full px-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold bg-white text-slate-800"
                    value={manualTeacherId}
                    onChange={(e) => setManualTeacherId(e.target.value)}
                    required
                  >
                    <option value="">-- انتخاب استاد از بانک اساتید --</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>
                        استاد {t.fullName} {t.phoneNumber ? `(${t.phoneNumber})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subject and Grade */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">عنوان درس / برنامه <span className="text-rose-500">*</span></label>
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
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">روزهای برگزاری کلاس:</label>
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
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 font-vazir"
              dir="rtl"
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
