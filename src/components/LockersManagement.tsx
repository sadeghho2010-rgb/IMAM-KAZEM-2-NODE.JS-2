import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  KeyRound, 
  Search, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Clock, 
  UserCheck, 
  UserX, 
  AlertTriangle, 
  CheckCircle2, 
  FileSpreadsheet, 
  Printer, 
  Filter, 
  Lock, 
  Unlock, 
  Eye, 
  Layers, 
  Database, 
  Copy, 
  Check, 
  X, 
  ArrowRightLeft, 
  Sparkles,
  Info,
  Calendar,
  User,
  Wrench,
  ShieldAlert,
  ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { StudentLocker, LockerHistoryItem, Student } from '../types';
import { localDb } from '../lib/localDb';
import { useAuth } from '../context/AuthContext';
import { getTodayShamsi } from '../lib/jalali';
import { cn } from '../lib/utils';

interface LockersManagementProps {
  onNavigateTab?: (tab: string, studentId?: string) => void;
}

export default function LockersManagement({ onNavigateTab }: LockersManagementProps) {
  const { currentUser, isReadOnly, canEditTab } = useAuth();
  const canEdit = !isReadOnly && canEditTab('lockers');

  // Lockers and Students state
  const [lockers, setLockers] = useState<StudentLocker[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // View modes: 'split' (دو ستونه: خالی و پر), 'all-grid' (شبکه جامع ۱ تا ۲۰۰), 'inactive' (کمد‌های غیرفعال)
  const [viewMode, setViewMode] = useState<'split' | 'all-grid' | 'inactive'>('split');

  // Search and Filters
  const [emptySearchTerm, setEmptySearchTerm] = useState<string>('');
  const [occupiedSearchTerm, setOccupiedSearchTerm] = useState<string>('');
  const [globalSearchTerm, setGlobalSearchTerm] = useState<string>('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');

  // Modals state
  // 1. Assign/Change Student Modal
  const [assignModalLocker, setAssignModalLocker] = useState<StudentLocker | null>(null);
  const [studentSearchTerm, setStudentSearchTerm] = useState<string>('');
  const [selectedStudentForAssign, setSelectedStudentForAssign] = useState<Student | null>(null);
  const [assignmentDate, setAssignmentDate] = useState<string>(getTodayShamsi());
  const [assignmentNotes, setAssignmentNotes] = useState<string>('');

  // 2. History Modal (View last 3 holders or full history)
  const [historyModalLocker, setHistoryModalLocker] = useState<StudentLocker | null>(null);

  // 3. Mark Inactive Modal (Reason: Broken, Lost Key, etc.)
  const [inactiveModalLocker, setInactiveModalLocker] = useState<StudentLocker | null>(null);
  const [inactiveReasonPreset, setInactiveReasonPreset] = useState<string>('خرابی قفل');
  const [inactiveCustomReason, setInactiveCustomReason] = useState<string>('');

  // 4. Add Locker Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [addMode, setAddMode] = useState<'single' | 'range'>('single');
  const [singleLockerNum, setSingleLockerNum] = useState<string>('');
  const [rangeStartNum, setRangeStartNum] = useState<string>('');
  const [rangeEndNum, setRangeEndNum] = useState<string>('');

  // 5. Delete Confirm Modal
  const [lockerToDelete, setLockerToDelete] = useState<StudentLocker | null>(null);

  // 6. SQL Database Script Modal
  const [isSqlModalOpen, setIsSqlModalOpen] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Students
      const loadedStudents = await localDb.getDocs<Student>('students');
      setStudents(loadedStudents || []);

      // 2. Fetch Lockers
      let loadedLockers = await localDb.getDocs<StudentLocker>('student_lockers');
      
      // If no lockers exist in database yet, auto-initialize lockers 1 through 200!
      if (!loadedLockers || loadedLockers.length === 0) {
        const initial200: StudentLocker[] = [];
        const now = new Date().toISOString();
        for (let i = 1; i <= 200; i++) {
          initial200.push({
            id: `locker_${i}`,
            lockerNumber: i,
            status: 'empty',
            history: [],
            updatedAt: now
          });
        }
        await localDb.bulkPut('student_lockers', initial200);
        loadedLockers = initial200;
        showToast('تعداد ۲۰۰ کمد اولیه (شماره‌های ۱ تا ۲۰۰) به صورت خودکار ایجاد و بارگذاری شدند.', 'info');
      }

      // Sort numerically by lockerNumber
      loadedLockers.sort((a, b) => (a.lockerNumber || 0) - (b.lockerNumber || 0));
      setLockers(loadedLockers);
    } catch (err: any) {
      console.error('Error loading lockers:', err);
      showToast('خطا در بارگذاری اطلاعات کمدها', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Quick lookup: which student already has which locker(s)?
  const studentAssignedLockersMap = useMemo(() => {
    const map = new Map<string, number[]>();
    lockers.forEach(l => {
      if (l.status === 'occupied' && l.studentId) {
        const existing = map.get(l.studentId) || [];
        existing.push(l.lockerNumber);
        map.set(l.studentId, existing);
      }
    });
    return map;
  }, [lockers]);

  // Statistics
  const stats = useMemo(() => {
    const total = lockers.length;
    const emptyCount = lockers.filter(l => l.status === 'empty').length;
    const occupiedCount = lockers.filter(l => l.status === 'occupied').length;
    const inactiveCount = lockers.filter(l => l.status === 'inactive').length;
    const activeCount = emptyCount + occupiedCount;
    const occupancyRate = activeCount > 0 ? Math.round((occupiedCount / activeCount) * 100) : 0;

    return {
      total,
      emptyCount,
      occupiedCount,
      inactiveCount,
      activeCount,
      occupancyRate
    };
  }, [lockers]);

  // Filtered Empty Lockers
  const filteredEmptyLockers = useMemo(() => {
    return lockers.filter(l => {
      if (l.status !== 'empty') return false;
      if (emptySearchTerm.trim()) {
        const term = emptySearchTerm.trim().toLowerCase();
        const numStr = String(l.lockerNumber);
        return numStr.includes(term);
      }
      return true;
    });
  }, [lockers, emptySearchTerm]);

  // Filtered Occupied Lockers
  const filteredOccupiedLockers = useMemo(() => {
    return lockers.filter(l => {
      if (l.status !== 'occupied') return false;
      if (gradeFilter !== 'all' && l.studentGrade) {
        if (!l.studentGrade.includes(gradeFilter)) return false;
      }
      if (occupiedSearchTerm.trim()) {
        const term = occupiedSearchTerm.trim().toLowerCase();
        const numStr = String(l.lockerNumber);
        const nameStr = (l.studentName || '').toLowerCase();
        const gradeStr = (l.studentGrade || '').toLowerCase();
        return numStr.includes(term) || nameStr.includes(term) || gradeStr.includes(term);
      }
      return true;
    });
  }, [lockers, occupiedSearchTerm, gradeFilter]);

  // Filtered Inactive Lockers
  const filteredInactiveLockers = useMemo(() => {
    return lockers.filter(l => l.status === 'inactive');
  }, [lockers]);

  // Filtered All Lockers (Grid)
  const filteredAllLockers = useMemo(() => {
    return lockers.filter(l => {
      if (globalSearchTerm.trim()) {
        const term = globalSearchTerm.trim().toLowerCase();
        const numStr = String(l.lockerNumber);
        const nameStr = (l.studentName || '').toLowerCase();
        const gradeStr = (l.studentGrade || '').toLowerCase();
        const reasonStr = (l.inactiveReason || '').toLowerCase();
        return numStr.includes(term) || nameStr.includes(term) || gradeStr.includes(term) || reasonStr.includes(term);
      }
      return true;
    });
  }, [lockers, globalSearchTerm]);

  // Filter students for assignment modal
  const filteredStudentsForAssign = useMemo(() => {
    if (!studentSearchTerm.trim()) {
      return students.slice(0, 15); // Show first 15 as suggestion
    }
    const term = studentSearchTerm.trim().toLowerCase();
    return students.filter(s => {
      const name = (s.name || '').toLowerCase();
      const code = (s.studentCode || '').toLowerCase();
      const nationalId = (s.nationalId || '').toLowerCase();
      const grade = (s.grade || '').toLowerCase();
      return name.includes(term) || code.includes(term) || nationalId.includes(term) || grade.includes(term);
    }).slice(0, 30);
  }, [students, studentSearchTerm]);

  // -------------------------------------------------------------
  // ACTIONS
  // -------------------------------------------------------------

  // 1. Open Assign Modal for Empty Locker or Reassign
  const handleOpenAssignModal = (locker: StudentLocker) => {
    setAssignModalLocker(locker);
    setStudentSearchTerm('');
    setSelectedStudentForAssign(null);
    setAssignmentDate(getTodayShamsi());
    setAssignmentNotes(locker.notes || '');
  };

  // 2. Perform Assignment
  const handleConfirmAssignment = async (student: Student) => {
    if (!assignModalLocker) return;

    try {
      const now = new Date().toISOString();
      const currentHistory = [...(assignModalLocker.history || [])];

      // If locker was previously occupied by someone else, archive them into history
      if (assignModalLocker.status === 'occupied' && assignModalLocker.studentId && assignModalLocker.studentId !== student.id) {
        currentHistory.unshift({
          id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          studentId: assignModalLocker.studentId,
          studentName: assignModalLocker.studentName || 'نامشخص',
          studentGrade: assignModalLocker.studentGrade,
          assignedAt: assignModalLocker.assignedAt || getTodayShamsi(),
          releasedAt: getTodayShamsi(),
          assignedBy: currentUser?.name || currentUser?.username || 'مسئول آموزش',
          notes: 'تغییر امانت‌گیرنده به طلبه جدید'
        });
      }

      const updatedLocker: StudentLocker = {
        ...assignModalLocker,
        status: 'occupied',
        studentId: student.id,
        studentName: student.name,
        studentGrade: student.grade,
        assignedAt: assignmentDate || getTodayShamsi(),
        notes: assignmentNotes.trim() || undefined,
        inactiveReason: undefined,
        history: currentHistory,
        updatedAt: now
      };

      await localDb.saveDoc('student_lockers', updatedLocker);

      setLockers(prev => prev.map(l => l.id === updatedLocker.id ? updatedLocker : l));
      setAssignModalLocker(null);
      showToast(`کمد شماره ${updatedLocker.lockerNumber} با موفقیت به «${student.name}» واگذار گردید.`, 'success');
    } catch (err) {
      console.error('Error assigning locker:', err);
      showToast('خطا در ثبت واگذاری کمد', 'error');
    }
  };

  // 3. Release / Vacate Locker (تخلیه کمد و دریافت کلید)
  const handleReleaseLocker = async (locker: StudentLocker) => {
    if (!window.confirm(`آیا از تخلیه کمد شماره ${locker.lockerNumber} و دریافت کلید از «${locker.studentName}» اطمینان دارید؟`)) {
      return;
    }

    try {
      const now = new Date().toISOString();
      const currentHistory = [...(locker.history || [])];

      if (locker.studentId) {
        currentHistory.unshift({
          id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          studentId: locker.studentId,
          studentName: locker.studentName || 'نامشخص',
          studentGrade: locker.studentGrade,
          assignedAt: locker.assignedAt || getTodayShamsi(),
          releasedAt: getTodayShamsi(),
          assignedBy: currentUser?.name || currentUser?.username || 'مسئول آموزش',
          notes: 'تخلیه عادی و تحویل کلید به آموزش'
        });
      }

      const updatedLocker: StudentLocker = {
        ...locker,
        status: 'empty',
        studentId: undefined,
        studentName: undefined,
        studentGrade: undefined,
        assignedAt: undefined,
        notes: undefined,
        inactiveReason: undefined,
        history: currentHistory,
        updatedAt: now
      };

      await localDb.saveDoc('student_lockers', updatedLocker);

      setLockers(prev => prev.map(l => l.id === updatedLocker.id ? updatedLocker : l));
      showToast(`کمد شماره ${locker.lockerNumber} تخلیه شد و اکنون در وضعیت «خالی و آماده تحویل» قرار دارد.`, 'success');
    } catch (err) {
      console.error('Error releasing locker:', err);
      showToast('خطا در تخلیه کمد', 'error');
    }
  };

  // 4. Mark Inactive (خرابی، گم شدن کلید، و...)
  const handleConfirmMarkInactive = async () => {
    if (!inactiveModalLocker) return;

    try {
      const reason = inactiveReasonPreset === 'سایر' 
        ? (inactiveCustomReason.trim() || 'نیاز به تعمیر و بررسی') 
        : (inactiveCustomReason.trim() ? `${inactiveReasonPreset} - ${inactiveCustomReason.trim()}` : inactiveReasonPreset);

      const now = new Date().toISOString();
      const currentHistory = [...(inactiveModalLocker.history || [])];

      // If it had a student, we can either archive the student into history or keep note
      if (inactiveModalLocker.studentId) {
        currentHistory.unshift({
          id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          studentId: inactiveModalLocker.studentId,
          studentName: inactiveModalLocker.studentName || 'نامشخص',
          studentGrade: inactiveModalLocker.studentGrade,
          assignedAt: inactiveModalLocker.assignedAt || getTodayShamsi(),
          releasedAt: getTodayShamsi(),
          assignedBy: currentUser?.name || currentUser?.username || 'مسئول آموزش',
          notes: `غیرفعال‌سازی کمد به علت: ${reason}`
        });
      }

      const updatedLocker: StudentLocker = {
        ...inactiveModalLocker,
        status: 'inactive',
        inactiveReason: reason,
        studentId: undefined,
        studentName: undefined,
        studentGrade: undefined,
        assignedAt: undefined,
        history: currentHistory,
        updatedAt: now
      };

      await localDb.saveDoc('student_lockers', updatedLocker);

      setLockers(prev => prev.map(l => l.id === updatedLocker.id ? updatedLocker : l));
      setInactiveModalLocker(null);
      showToast(`کمد شماره ${updatedLocker.lockerNumber} به عنوان «غیرفعال (${reason})» علامت‌گذاری شد.`, 'info');
    } catch (err) {
      console.error('Error marking locker inactive:', err);
      showToast('خطا در غیرفعال‌سازی کمد', 'error');
    }
  };

  // 5. Reactivate Locker (فعال‌سازی مجدد کمد پس از تعمیر یا یافتن کلید)
  const handleReactivateLocker = async (locker: StudentLocker) => {
    try {
      const now = new Date().toISOString();
      const updatedLocker: StudentLocker = {
        ...locker,
        status: 'empty',
        inactiveReason: undefined,
        updatedAt: now
      };

      await localDb.saveDoc('student_lockers', updatedLocker);

      setLockers(prev => prev.map(l => l.id === updatedLocker.id ? updatedLocker : l));
      showToast(`کمد شماره ${locker.lockerNumber} با موفقیت فعال و آماده تحویل گردید.`, 'success');
    } catch (err) {
      console.error('Error reactivating locker:', err);
      showToast('خطا در فعال‌سازی کمد', 'error');
    }
  };

  // 6. Delete Locker
  const handleConfirmDeleteLocker = async () => {
    if (!lockerToDelete) return;

    try {
      await localDb.deleteDoc('student_lockers', lockerToDelete.id);
      setLockers(prev => prev.filter(l => l.id !== lockerToDelete.id));
      showToast(`کمد شماره ${lockerToDelete.lockerNumber} به طور کامل از سیستم حذف گردید.`, 'success');
      setLockerToDelete(null);
    } catch (err) {
      console.error('Error deleting locker:', err);
      showToast('خطا در حذف کمد', 'error');
    }
  };

  // 7. Add New Locker(s)
  const handleAddLockers = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const existingNumbers = new Set(lockers.map(l => l.lockerNumber));
      const newItems: StudentLocker[] = [];
      const now = new Date().toISOString();

      if (addMode === 'single') {
        const num = parseInt(singleLockerNum, 10);
        if (isNaN(num) || num <= 0) {
          alert('لطفاً یک شماره معتبر وارد کنید.');
          return;
        }
        if (existingNumbers.has(num)) {
          alert(`کمد شماره ${num} در حال حاضر وجود دارد.`);
          return;
        }
        newItems.push({
          id: `locker_${num}`,
          lockerNumber: num,
          status: 'empty',
          history: [],
          updatedAt: now
        });
      } else {
        const start = parseInt(rangeStartNum, 10);
        const end = parseInt(rangeEndNum, 10);
        if (isNaN(start) || isNaN(end) || start <= 0 || end < start) {
          alert('لطفاً بازه شماره‌های معتبر وارد نمایید.');
          return;
        }
        if (end - start > 100) {
          alert('حداکثر ۱۰۰ شماره در هر بار افزودن مجاز است.');
          return;
        }

        for (let i = start; i <= end; i++) {
          if (!existingNumbers.has(i)) {
            newItems.push({
              id: `locker_${i}`,
              lockerNumber: i,
              status: 'empty',
              history: [],
              updatedAt: now
            });
          }
        }

        if (newItems.length === 0) {
          alert('تمامی شماره‌های این بازه از قبل در سیستم وجود دارند.');
          return;
        }
      }

      await localDb.bulkPut('student_lockers', newItems);

      const combined = [...lockers, ...newItems].sort((a, b) => a.lockerNumber - b.lockerNumber);
      setLockers(combined);
      setIsAddModalOpen(false);
      setSingleLockerNum('');
      setRangeStartNum('');
      setRangeEndNum('');
      showToast(`تعداد ${newItems.length} کمد جدید با موفقیت به سیستم اضافه شد.`, 'success');
    } catch (err) {
      console.error('Error adding lockers:', err);
      showToast('خطا در افزودن کمد جدید', 'error');
    }
  };

  // 8. Re-seed default 1..200
  const handleResetToDefault200 = async () => {
    if (!window.confirm('آیا مطمئن هستید؟ این عملیات شماره کمدهای ۱ تا ۲۰۰ را که در سیستم موجود نیستند، اضافه می‌کند.')) {
      return;
    }
    try {
      const existingNumbers = new Set(lockers.map(l => l.lockerNumber));
      const missingItems: StudentLocker[] = [];
      const now = new Date().toISOString();

      for (let i = 1; i <= 200; i++) {
        if (!existingNumbers.has(i)) {
          missingItems.push({
            id: `locker_${i}`,
            lockerNumber: i,
            status: 'empty',
            history: [],
            updatedAt: now
          });
        }
      }

      if (missingItems.length === 0) {
        showToast('تمامی شماره‌های ۱ تا ۲۰۰ هم‌اکنون در سیستم موجودند.', 'info');
        return;
      }

      await localDb.bulkPut('student_lockers', missingItems);
      const combined = [...lockers, ...missingItems].sort((a, b) => a.lockerNumber - b.lockerNumber);
      setLockers(combined);
      showToast(`تعداد ${missingItems.length} کمد از دست رفته (بین ۱ تا ۲۰۰) بازسازی شدند.`, 'success');
    } catch (err) {
      console.error('Error rebuilding 200 lockers:', err);
      showToast('خطا در بازسازی کمدها', 'error');
    }
  };

  // -------------------------------------------------------------
  // EXPORT FUNCTIONS (EXCEL & PRINT)
  // -------------------------------------------------------------

  // Export Occupied Lockers
  const exportOccupiedLockers = () => {
    const occupied = lockers.filter(l => l.status === 'occupied');
    if (occupied.length === 0) {
      alert('هیچ کمد پری برای خروجی وجود ندارد.');
      return;
    }

    const rows = occupied.map((l, idx) => ({
      'ردیف': idx + 1,
      'شماره کمد': l.lockerNumber,
      'وضعیت': 'پر (واگذار شده)',
      'نام و نام خانوادگی طلبه': l.studentName || 'نامشخص',
      'پایه تحصیلی': l.studentGrade || '-',
      'تاریخ واگذاری': l.assignedAt || '-',
      'تعداد سوابق قبلی': l.history?.length || 0,
      'توضیحات و یادداشت': l.notes || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'کمدهای_پر_و_صاحب_کمد');
    XLSX.writeFile(wb, `گزارش_کمدهای_پر_طلاب_${getTodayShamsi().replace(/\//g, '-')}.xlsx`);
    showToast('فایل اکسل کمدهای پر با موفقیت صادر شد.', 'success');
  };

  // Export Empty Lockers
  const exportEmptyLockers = () => {
    const empties = lockers.filter(l => l.status === 'empty');
    if (empties.length === 0) {
      alert('هیچ کمد خالی‌ای وجود ندارد.');
      return;
    }

    const rows = empties.map((l, idx) => {
      const lastHolder = l.history && l.history.length > 0 ? l.history[0] : null;
      return {
        'ردیف': idx + 1,
        'شماره کمد': l.lockerNumber,
        'وضعیت': 'خالی و آماده واگذاری',
        'آخرین امانت‌گیرنده': lastHolder ? lastHolder.studentName : 'بدون سابقه',
        'پایه آخرین امانت‌گیرنده': lastHolder?.studentGrade || '-',
        'تاریخ آخرین عودت کلید': lastHolder?.releasedAt || '-'
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'کمدهای_خالی_آماده_تحویل');
    XLSX.writeFile(wb, `گزارش_کمدهای_خالی_${getTodayShamsi().replace(/\//g, '-')}.xlsx`);
    showToast('فایل اکسل کمدهای خالی با موفقیت صادر شد.', 'success');
  };

  // Export Inactive Lockers
  const exportInactiveLockers = () => {
    const inactives = lockers.filter(l => l.status === 'inactive');
    if (inactives.length === 0) {
      alert('هیچ کمد غیرفعالی وجود ندارد.');
      return;
    }

    const rows = inactives.map((l, idx) => ({
      'ردیف': idx + 1,
      'شماره کمد': l.lockerNumber,
      'وضعیت': 'غیرفعال / خارج از سرویس',
      'علت غیرفعال بودن': l.inactiveReason || 'خرابی یا گم شدن کلید',
      'تاریخ آخرین ویرایش': l.updatedAt ? new Date(l.updatedAt).toLocaleDateString('fa-IR') : '-'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'کمدهای_غیرفعال');
    XLSX.writeFile(wb, `گزارش_کمدهای_غیرفعال_${getTodayShamsi().replace(/\//g, '-')}.xlsx`);
    showToast('فایل اکسل کمدهای غیرفعال با موفقیت صادر شد.', 'success');
  };

  // Export Comprehensive Summary
  const exportAllLockersSummary = () => {
    const rows = lockers.map((l, idx) => {
      let statusFa = 'خالی';
      if (l.status === 'occupied') statusFa = 'پر';
      if (l.status === 'inactive') statusFa = `غیرفعال (${l.inactiveReason || 'خرابی'})`;

      return {
        'ردیف': idx + 1,
        'شماره کمد': l.lockerNumber,
        'وضعیت کمد': statusFa,
        'نام طلبه امانت‌گیرنده': l.status === 'occupied' ? (l.studentName || '-') : '-',
        'پایه طلبه': l.status === 'occupied' ? (l.studentGrade || '-') : '-',
        'تاریخ تحویل کلید': l.status === 'occupied' ? (l.assignedAt || '-') : '-',
        'علت در صورت غیرفعال': l.status === 'inactive' ? (l.inactiveReason || '-') : '-',
        'تعداد سوابق قبلی': l.history?.length || 0
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'کل_کمدها');
    XLSX.writeFile(wb, `گزارش_جامع_کلیه_کمدها_${getTodayShamsi().replace(/\//g, '-')}.xlsx`);
    showToast('فایل اکسل جامع کمدها با موفقیت صادر شد.', 'success');
  };

  // SQL Script Content
  const SQL_SCRIPT_CONTENT = `-- ==============================================================================
-- اسکریپت پایگاه داده اختصاص کمد و امانت کلید (PostgreSQL / Supabase)
-- Database Script: Lockers Management & Key Lending System
-- ==============================================================================

-- ۱. ساخت جدول کمدهای طلاب
CREATE TABLE IF NOT EXISTS public.student_lockers (
  id TEXT PRIMARY KEY,
  locker_number INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'empty', -- 'empty', 'occupied', 'inactive'
  student_id TEXT REFERENCES public.students(id) ON DELETE SET NULL,
  student_name TEXT,
  student_grade TEXT,
  assigned_at TEXT, -- تاریخ شمسی تحویل کلید
  inactive_reason TEXT, -- علت غیرفعال بودن (خرابی قفل، مفقودی کلید و...)
  notes TEXT,
  history JSONB DEFAULT '[]'::jsonb, -- سوابق امانت‌گیرندگان قبلی (نام، تاریخ تحویل، تاریخ عودت)
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ۲. ساخت ایندکس‌های بهینه‌سازی جستجو و مرتب‌سازی
CREATE INDEX IF NOT EXISTS idx_student_lockers_number ON public.student_lockers(locker_number);
CREATE INDEX IF NOT EXISTS idx_student_lockers_status ON public.student_lockers(status);
CREATE INDEX IF NOT EXISTS idx_student_lockers_student_id ON public.student_lockers(student_id);

-- ۳. فعال‌سازی RLS و امنیت دسترسی
ALTER TABLE public.student_lockers ENABLE ROW LEVEL SECURITY;

-- سیاست مشاهده: همه کاربران احراز هویت شده می‌توانند کمدها را ببینند
CREATE POLICY "Allow read student_lockers" ON public.student_lockers
  FOR SELECT TO authenticated, anon USING (true);

-- سیاست مدیریت: کادر آموزش و مدیران می‌توانند کمدها را واگذار یا ویرایش کنند
CREATE POLICY "Allow manage student_lockers" ON public.student_lockers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ۴. تزریق خودکار ۲۰۰ کمد اولیه (شماره‌های ۱ تا ۲۰۰) در صورت عدم وجود
INSERT INTO public.student_lockers (id, locker_number, status, history, data, created_at, updated_at)
SELECT 
  'locker_' || i,
  i,
  'empty',
  '[]'::jsonb,
  '{}'::jsonb,
  NOW(),
  NOW()
FROM generate_series(1, 200) AS i
ON CONFLICT (locker_number) DO NOTHING;
`;

  return (
    <div className="space-y-6 pb-24 font-vazir text-slate-800" dir="rtl">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-bold border",
              toastMessage.type === 'success' && "bg-emerald-600 text-white border-emerald-500",
              toastMessage.type === 'info' && "bg-sky-600 text-white border-sky-500",
              toastMessage.type === 'error' && "bg-rose-600 text-white border-rose-500"
            )}
          >
            {toastMessage.type === 'success' && <CheckCircle2 size={18} />}
            {toastMessage.type === 'info' && <Info size={18} />}
            {toastMessage.type === 'error' && <AlertTriangle size={18} />}
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute left-6 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none hidden sm:block">
          <KeyRound size={220} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-amber-500/30 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold border border-amber-400/30">
              <KeyRound size={14} className="text-amber-200" />
              <span>امانت و مدیریت کلید کمدها به طلاب</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              اختصاص کمد به طلاب
            </h1>
            <p className="text-amber-100 text-sm max-w-2xl leading-relaxed">
              سامانه هوشمند و سریع واگذاری کمدها از شماره ۱ تا ۲۰۰. با کلیک بر روی هر کمد خالی، طلبه را جستجو کرده و کلید را واگذار کنید. سوابق ۳ نفر قبلی با دکمه ریز تاریخچه قابل مشاهده است.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {canEdit && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2.5 bg-white text-amber-900 hover:bg-amber-50 rounded-2xl font-bold text-sm shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus size={18} className="text-amber-600" />
                <span>افزودن شماره کمد</span>
              </button>
            )}

            {/* Export Dropdown */}
            <div className="relative group">
              <button
                className="px-4 py-2.5 bg-amber-500/40 hover:bg-amber-500/60 backdrop-blur-md border border-amber-300/30 text-white rounded-2xl font-bold text-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <FileSpreadsheet size={18} className="text-emerald-300" />
                <span>خروجی اکسل و گزارش</span>
                <ChevronDown size={14} />
              </button>
              <div className="absolute left-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 hidden group-hover:block z-30 font-medium text-xs text-slate-700">
                <button
                  onClick={exportOccupiedLockers}
                  className="w-full text-right px-4 py-2.5 hover:bg-amber-50 flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                    خروجی کمدهای پر (با نام صاحب)
                  </span>
                  <span className="text-slate-400">({stats.occupiedCount})</span>
                </button>
                <button
                  onClick={exportEmptyLockers}
                  className="w-full text-right px-4 py-2.5 hover:bg-amber-50 flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    خروجی کمدهای خالی
                  </span>
                  <span className="text-slate-400">({stats.emptyCount})</span>
                </button>
                <button
                  onClick={exportInactiveLockers}
                  className="w-full text-right px-4 py-2.5 hover:bg-amber-50 flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    خروجی کمدهای غیرفعال
                  </span>
                  <span className="text-slate-400">({stats.inactiveCount})</span>
                </button>
                <div className="border-t border-slate-100 my-1"></div>
                <button
                  onClick={exportAllLockersSummary}
                  className="w-full text-right px-4 py-2.5 hover:bg-slate-50 font-bold text-amber-800 flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet size={14} className="text-emerald-600" />
                  <span>خروجی جامع تمام کمدها (Excel)</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="w-full text-right px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 text-slate-600 cursor-pointer"
                >
                  <Printer size={14} className="text-slate-500" />
                  <span>چاپ لیست کمدها (Print)</span>
                </button>
              </div>
            </div>

            {/* SQL Script Viewer */}
            <button
              onClick={() => setIsSqlModalOpen(true)}
              className="px-3.5 py-2.5 bg-black/20 hover:bg-black/30 backdrop-blur-md border border-white/20 text-white rounded-2xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
              title="مشاهده اسکریپت SQL جهت ساخت دیتابیس"
            >
              <Database size={16} className="text-amber-300" />
              <span>اسکریپت دیتابیس</span>
            </button>
          </div>
        </div>

        {/* Statistical Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-6 border-t border-amber-500/30">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
            <span className="text-xs text-amber-200 block mb-1">کل کمدهای تعریف‌شده</span>
            <span className="text-2xl font-black text-white">{stats.total}</span>
          </div>
          <div className="bg-emerald-500/20 backdrop-blur-md rounded-2xl p-3 border border-emerald-400/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-emerald-200">کمد‌های خالی و آماده</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <span className="text-2xl font-black text-emerald-200">{stats.emptyCount}</span>
          </div>
          <div className="bg-sky-500/20 backdrop-blur-md rounded-2xl p-3 border border-sky-400/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-sky-200">کمد‌های پر (دست طلاب)</span>
              <span className="w-2 h-2 rounded-full bg-sky-400"></span>
            </div>
            <span className="text-2xl font-black text-sky-200">{stats.occupiedCount}</span>
          </div>
          <div className="bg-rose-500/20 backdrop-blur-md rounded-2xl p-3 border border-rose-400/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-rose-200">کمد‌های غیرفعال (خراب)</span>
              {stats.inactiveCount > 0 && <span className="w-2 h-2 rounded-full bg-rose-400"></span>}
            </div>
            <span className="text-2xl font-black text-rose-200">{stats.inactiveCount}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 col-span-2 sm:col-span-1">
            <span className="text-xs text-amber-200 block mb-1">درصد اشغال کمدها</span>
            <span className="text-2xl font-black text-white">{stats.occupancyRate}%</span>
          </div>
        </div>
      </div>

      {/* View Switcher Tabs & Helpers */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setViewMode('split')}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
              viewMode === 'split' 
                ? "bg-white text-slate-800 shadow-sm" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <ArrowRightLeft size={15} className="text-amber-600" />
            <span>نمای دو ستونه تفکیکی (خالی و پر)</span>
            <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full text-[10px]">پیش‌فرض</span>
          </button>

          <button
            onClick={() => setViewMode('all-grid')}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
              viewMode === 'all-grid' 
                ? "bg-white text-slate-800 shadow-sm" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Layers size={15} className="text-indigo-600" />
            <span>نمای شبکه جامع (۱ تا ۲۰۰)</span>
          </button>

          <button
            onClick={() => setViewMode('inactive')}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
              viewMode === 'inactive' 
                ? "bg-white text-slate-800 shadow-sm" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Wrench size={15} className="text-rose-600" />
            <span>غیرفعال‌ها ({stats.inactiveCount})</span>
          </button>
        </div>

        {/* Reset / Helper Button */}
        {canEdit && lockers.length < 200 && (
          <button
            onClick={handleResetToDefault200}
            className="text-xs text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 transition-all cursor-pointer self-end sm:self-auto"
          >
            <RotateCcw size={14} />
            <span>تکمیل شماره‌های ۱ تا ۲۰۰</span>
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-sm">
          <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h3 className="font-bold text-slate-700 text-base">در حال بارگذاری اطلاعات کمدها و طلاب...</h3>
          <p className="text-slate-400 text-xs mt-1">لطفاً شکیبا باشید</p>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* VIEW 1: SPLIT VIEW (دو سمت جداگانه: کمد های خالی و کمد های پر)            */}
          {/* ========================================================================= */}
          {viewMode === 'split' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              
              {/* سمت راست: کمدهای خالی (آماده واگذاری) */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-emerald-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                      <Unlock size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                        <span>کمد‌های خالی و آماده تحویل</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                          {filteredEmptyLockers.length} کمد
                        </span>
                      </h2>
                      <p className="text-xs text-slate-400">
                        جهت اختصاص کمد به طلبه، روی هر کمد کلیک کنید 🔑
                      </p>
                    </div>
                  </div>
                </div>

                {/* Search in Empty Lockers */}
                <div className="relative">
                  <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={emptySearchTerm}
                    onChange={(e) => setEmptySearchTerm(e.target.value)}
                    placeholder="جستجوی شماره کمد خالی (مثلاً: 25)..."
                    className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                  {emptySearchTerm && (
                    <button
                      onClick={() => setEmptySearchTerm('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Empty Lockers Grid */}
                {filteredEmptyLockers.length === 0 ? (
                  <div className="p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                    {emptySearchTerm ? 'کمد خالی با این شماره یافت نشد.' : 'در حال حاضر هیچ کمد خالی‌ای در سیستم ثبت نشده است.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[700px] overflow-y-auto pr-1">
                    {filteredEmptyLockers.map((locker) => (
                      <div
                        key={locker.id}
                        className="group relative bg-emerald-50/40 hover:bg-emerald-50 border border-emerald-200/80 hover:border-emerald-400 rounded-2xl p-3 transition-all duration-200 flex flex-col justify-between hover:shadow-md cursor-pointer"
                        onClick={() => canEdit && handleOpenAssignModal(locker)}
                      >
                        {/* Top: Locker Number & History Button */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span className="text-lg font-black text-emerald-900 tracking-tight">
                              #{locker.lockerNumber}
                            </span>
                          </div>

                          {/* Small History Icon Button (دکمه ریز مشاهده سوابق ۳ نفر قبلی) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHistoryModalLocker(locker);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-amber-700 hover:bg-amber-100/60 transition-all cursor-pointer"
                            title="مشاهده سوابق و ۳ نفر قبلی که کلید را داشتند 🕒"
                          >
                            <Clock size={14} />
                          </button>
                        </div>

                        {/* Middle: Empty Status Label */}
                        <div className="my-3 text-center">
                          <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-white/80 px-2 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                            <Unlock size={11} />
                            <span>خالی</span>
                          </div>
                        </div>

                        {/* Bottom Actions */}
                        <div className="pt-2 border-t border-emerald-100 flex items-center justify-between text-[10px]">
                          <span className="text-emerald-800 font-bold group-hover:underline flex items-center gap-1">
                            <span>واگذاری کلید</span>
                            <span>🔑</span>
                          </span>

                          {canEdit && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInactiveModalLocker(locker);
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                title="اعلام خرابی یا گم شدن کلید"
                              >
                                <Wrench size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLockerToDelete(locker);
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                title="حذف کمد"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* سمت چپ: کمدهای پر (در دست طلاب) */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-sky-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                      <Lock size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                        <span>کمد‌های پر (در اختیار طلاب)</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-xs font-bold">
                          {filteredOccupiedLockers.length} کمد
                        </span>
                      </h2>
                      <p className="text-xs text-slate-400">
                        مشاهده نام صاحب کمد، تاریخ واگذاری، تغییر طلبه و تخلیه
                      </p>
                    </div>
                  </div>
                </div>

                {/* Filters & Search for Occupied Lockers */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="relative sm:col-span-2">
                    <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={occupiedSearchTerm}
                      onChange={(e) => setOccupiedSearchTerm(e.target.value)}
                      placeholder="جستجوی شماره کمد یا نام طلبه..."
                      className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                    />
                    {occupiedSearchTerm && (
                      <button
                        onClick={() => setOccupiedSearchTerm('')}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div>
                    <select
                      value={gradeFilter}
                      onChange={(e) => setGradeFilter(e.target.value)}
                      className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 text-slate-700 font-medium"
                    >
                      <option value="all">همه پایه‌ها</option>
                      <option value="۷">پایه ۷</option>
                      <option value="۸">پایه ۸</option>
                      <option value="۹">پایه ۹</option>
                      <option value="۱۰">پایه ۱۰</option>
                    </select>
                  </div>
                </div>

                {/* Occupied Lockers List / Grid */}
                {filteredOccupiedLockers.length === 0 ? (
                  <div className="p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                    {occupiedSearchTerm || gradeFilter !== 'all' ? 'کمد پری با این مشخصات یافت نشد.' : 'هیچ کمد واگذار شده‌ای وجود ندارد.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[700px] overflow-y-auto pr-1">
                    {filteredOccupiedLockers.map((locker) => (
                      <div
                        key={locker.id}
                        className="bg-sky-50/30 hover:bg-sky-50 border border-sky-200/80 rounded-2xl p-3.5 transition-all duration-200 flex flex-col justify-between shadow-2xs hover:shadow-md"
                      >
                        {/* Header: Number & History Button */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                            <span className="text-lg font-black text-sky-950">
                              #{locker.lockerNumber}
                            </span>
                            {locker.studentGrade && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                                {locker.studentGrade}
                              </span>
                            )}
                          </div>

                          {/* Small History Icon Button (دکمه ریز مشاهده سوابق ۳ نفر قبلی) */}
                          <button
                            type="button"
                            onClick={() => setHistoryModalLocker(locker)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-amber-800 hover:bg-amber-100/60 transition-all cursor-pointer flex items-center gap-1"
                            title="مشاهده سوابق و ۳ نفر قبلی که کلید را داشتند 🕒"
                          >
                            <Clock size={14} />
                            {locker.history && locker.history.length > 0 && (
                              <span className="text-[10px] font-bold bg-amber-200/80 text-amber-900 px-1 rounded-md">
                                {locker.history.length}
                              </span>
                            )}
                          </button>
                        </div>

                        {/* Student Info Box */}
                        <div className="my-2.5 bg-white p-2.5 rounded-xl border border-sky-100 shadow-2xs">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                              {(locker.studentName || 'ط').charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-extrabold text-slate-800 truncate" title={locker.studentName}>
                                {locker.studentName}
                              </h4>
                              {locker.assignedAt && (
                                <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                  <Calendar size={10} />
                                  <span>واگذاری: {locker.assignedAt}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Footer Quick Actions */}
                        <div className="pt-2 border-t border-sky-100 flex items-center justify-between text-xs gap-1.5">
                          {canEdit ? (
                            <>
                              <button
                                onClick={() => handleOpenAssignModal(locker)}
                                className="px-2 py-1 text-[11px] font-bold text-sky-700 hover:bg-sky-100/80 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                title="تغییر فردی که کمد به او اختصاص یافته است"
                              >
                                <ArrowRightLeft size={12} />
                                <span>تغییر طلبه</span>
                              </button>

                              <button
                                onClick={() => handleReleaseLocker(locker)}
                                className="px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                title="تخلیه کمد و دریافت کلید"
                              >
                                <UserX size={12} />
                                <span>تخلیه</span>
                              </button>

                              <button
                                onClick={() => setInactiveModalLocker(locker)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                title="اعلام خرابی یا گم شدن کلید"
                              >
                                <Wrench size={12} />
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-400">واگذار شده</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 2: ALL LOCKERS GRID (نمای جامع شبکه ۱ تا ۲۰۰)                        */}
          {/* ========================================================================= */}
          {viewMode === 'all-grid' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-extrabold text-slate-800">
                    نمای جامع کلیه کمدها (۱ تا ۲۰۰)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    رنگ سبز: خالی | رنگ آبی: پر / در دست طلبه | رنگ قرمز: غیرفعال یا خراب
                  </p>
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-72">
                  <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={globalSearchTerm}
                    onChange={(e) => setGlobalSearchTerm(e.target.value)}
                    placeholder="جستجو بر اساس شماره کمد یا نام..."
                    className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                  {globalSearchTerm && (
                    <button
                      onClick={() => setGlobalSearchTerm('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Grid 1 to 200 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2.5 max-h-[750px] overflow-y-auto pr-1">
                {filteredAllLockers.map((locker) => {
                  const isEmpty = locker.status === 'empty';
                  const isOccupied = locker.status === 'occupied';
                  const isInactive = locker.status === 'inactive';

                  return (
                    <div
                      key={locker.id}
                      onClick={() => {
                        if (!canEdit) return;
                        if (isEmpty || isOccupied) {
                          handleOpenAssignModal(locker);
                        } else if (isInactive) {
                          handleReactivateLocker(locker);
                        }
                      }}
                      className={cn(
                        "relative p-2.5 rounded-2xl border transition-all text-center flex flex-col justify-between cursor-pointer group",
                        isEmpty && "bg-emerald-50/50 hover:bg-emerald-50 border-emerald-200 text-emerald-900 hover:shadow-md",
                        isOccupied && "bg-sky-50/60 hover:bg-sky-50 border-sky-200 text-sky-950 hover:shadow-md",
                        isInactive && "bg-rose-50/60 hover:bg-rose-50 border-rose-200 text-rose-900"
                      )}
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-black text-sm">#{locker.lockerNumber}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHistoryModalLocker(locker);
                          }}
                          className="text-slate-400 hover:text-amber-800 p-0.5 rounded"
                          title="مشاهده سوابق و ۳ نفر قبلی 🕒"
                        >
                          <Clock size={12} />
                        </button>
                      </div>

                      <div className="my-1.5">
                        {isEmpty && (
                          <span className="text-[10px] text-emerald-700 font-bold bg-white/70 px-1.5 py-0.5 rounded-md">
                            خالی
                          </span>
                        )}
                        {isOccupied && (
                          <div className="truncate">
                            <span className="text-[11px] font-bold text-slate-800 block truncate" title={locker.studentName}>
                              {locker.studentName}
                            </span>
                            <span className="text-[9px] text-sky-700 font-medium">
                              {locker.studentGrade || 'طلبه'}
                            </span>
                          </div>
                        )}
                        {isInactive && (
                          <span className="text-[10px] text-rose-700 font-bold block truncate" title={locker.inactiveReason}>
                            {locker.inactiveReason || 'خراب'}
                          </span>
                        )}
                      </div>

                      <div className="text-[9px] text-slate-400 border-t border-slate-200/40 pt-1">
                        {isEmpty && <span className="text-emerald-700">کلیک: واگذاری</span>}
                        {isOccupied && <span className="text-sky-700">کلیک: تغییر</span>}
                        {isInactive && <span className="text-rose-700">کلیک: فعال‌سازی</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 3: INACTIVE LOCKERS (کمدهای غیرفعال: خرابی، مفقودی کلید و...)          */}
          {/* ========================================================================= */}
          {viewMode === 'inactive' && (
            <div className="bg-white rounded-3xl p-6 border border-rose-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                    <ShieldAlert size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                      <span>کمد‌های غیرفعال (خرابی، گم شدن کلید یا در دست تعمیر)</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-xs font-bold">
                        {filteredInactiveLockers.length} کمد
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      این کمدها به علت مشکلات فنی از چرخه واگذاری خارج شده‌اند. پس از رفع نقص می‌توانید با یک کلیک فعال کنید.
                    </p>
                  </div>
                </div>

                <button
                  onClick={exportInactiveLockers}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet size={15} />
                  <span>خروجی اکسل غیرفعال‌ها</span>
                </button>
              </div>

              {filteredInactiveLockers.length === 0 ? (
                <div className="p-16 text-center bg-emerald-50/40 rounded-2xl border border-dashed border-emerald-200 text-emerald-800">
                  <CheckCircle2 size={36} className="mx-auto mb-2 text-emerald-600" />
                  <h3 className="font-bold text-sm">هیچ کمد خرابی در سامانه ثبت نشده است.</h3>
                  <p className="text-xs text-emerald-600 mt-1">تمامی کمدها فعال و آماده بهره‌برداری هستند.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredInactiveLockers.map((locker) => (
                    <div
                      key={locker.id}
                      className="bg-rose-50/40 border border-rose-200 rounded-2xl p-4 flex flex-col justify-between shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xl font-black text-rose-950">
                          #{locker.lockerNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => setHistoryModalLocker(locker)}
                          className="p-1 text-slate-400 hover:text-amber-800 rounded"
                          title="مشاهده سوابق و ۳ نفر قبلی 🕒"
                        >
                          <Clock size={16} />
                        </button>
                      </div>

                      <div className="my-3 space-y-1">
                        <span className="text-xs text-rose-600 font-bold block">علت غیرفعال بودن:</span>
                        <p className="text-xs font-medium text-slate-800 bg-white/80 p-2 rounded-xl border border-rose-100">
                          {locker.inactiveReason || 'خرابی قفل یا مفقودی کلید'}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-rose-200/60 flex items-center justify-between">
                        {canEdit && (
                          <button
                            onClick={() => handleReactivateLocker(locker)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <CheckCircle2 size={14} />
                            <span>تعمیر شد / فعال‌سازی</span>
                          </button>
                        )}

                        {canEdit && (
                          <button
                            onClick={() => setLockerToDelete(locker)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-100 transition-colors"
                            title="حذف شماره کمد"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ASSIGN / CHANGE STUDENT TO LOCKER (جستجوی سریع طلاب و واگذاری)     */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {assignModalLocker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-5 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold">
                    <KeyRound size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base">
                      اختصاص کمد شماره #{assignModalLocker.lockerNumber} به طلبه
                    </h3>
                    <p className="text-xs text-amber-100">
                      {assignModalLocker.status === 'occupied' 
                        ? `امانت‌گیرنده فعلی: ${assignModalLocker.studentName} (برای تغییر، طلبه جدید را انتخاب کنید)`
                        : 'با تایپ بخشی از نام طلبه، نتیجه فیلتر شده و با کلیک کمد واگذار می‌شود.'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setAssignModalLocker(null)}
                  className="p-2 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Search Bar Input */}
              <div className="p-4 bg-amber-50/50 border-b border-amber-100 space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Search size={14} className="text-amber-600" />
                  <span>نوار جستجوی سریع طلاب (نام یا کد طلبه را تایپ کنید):</span>
                </label>
                <div className="relative">
                  <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    autoFocus
                    value={studentSearchTerm}
                    onChange={(e) => setStudentSearchTerm(e.target.value)}
                    placeholder="مثلاً: حسینی، علی، محمد..."
                    className="w-full pl-4 pr-10 py-3 bg-white border border-amber-300 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 shadow-xs"
                  />
                  {studentSearchTerm && (
                    <button
                      onClick={() => setStudentSearchTerm('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* Optional Date & Notes */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">تاریخ واگذاری:</label>
                    <input
                      type="text"
                      value={assignmentDate}
                      onChange={(e) => setAssignmentDate(e.target.value)}
                      placeholder="۱۴۰۳/۰۷/۱۰"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">یادداشت / شماره کلید یدک:</label>
                    <input
                      type="text"
                      value={assignmentNotes}
                      onChange={(e) => setAssignmentNotes(e.target.value)}
                      placeholder="توضیحات اختیاری..."
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Students Search Results List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <div className="text-xs font-bold text-slate-500 mb-2">
                  {studentSearchTerm.trim() 
                    ? `نتایج جستجو (${filteredStudentsForAssign.length} طلبه یافت شد):` 
                    : 'لیست پیشنهادی طلاب جهت واگذاری (یا نام طلبه را تایپ کنید):'}
                </div>

                {filteredStudentsForAssign.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 text-xs">
                    طلبه‌ای با این مشخصات یافت نشد.
                  </div>
                ) : (
                  filteredStudentsForAssign.map((s) => {
                    const existingLockers = studentAssignedLockersMap.get(s.id);
                    const alreadyHasLocker = existingLockers && existingLockers.length > 0;

                    return (
                      <div
                        key={s.id}
                        onClick={() => handleConfirmAssignment(s)}
                        className="p-3 bg-white hover:bg-amber-50/70 border border-slate-200 hover:border-amber-400 rounded-2xl transition-all cursor-pointer flex items-center justify-between group shadow-2xs hover:shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-black text-sm">
                            {s.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-slate-800 group-hover:text-amber-900">
                                {s.name}
                              </span>
                              {s.grade && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                  {s.grade}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                              {s.studentCode && <span>کد: {s.studentCode}</span>}
                              {s.nationalId && <span>کدملی: {s.nationalId}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <button
                            type="button"
                            className="px-3 py-1.5 bg-amber-600 group-hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                          >
                            <span>واگذاری</span>
                            <Check size={14} />
                          </button>

                          {alreadyHasLocker && (
                            <span className="text-[10px] text-amber-700 font-bold bg-amber-100/70 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <AlertTriangle size={10} />
                              <span>دارای کمد #{existingLockers.join(', #')}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  با کلیک روی نام طلبه، کمد به نام او ثبت می‌شود.
                </span>
                <button
                  onClick={() => setAssignModalLocker(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  انصراف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 2: LOCKER HISTORY MODAL (سوابق و ۳ نفر قبلی که کلید را داشتند)        */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {historyModalLocker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-5 bg-gradient-to-r from-slate-800 to-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center font-bold text-amber-400">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base">
                      سابقه امانت کلید کمد شماره #{historyModalLocker.lockerNumber}
                    </h3>
                    <p className="text-xs text-slate-300">
                      مشاهده سوابق و ۳ نفر قبلی که کلید این کمد را در اختیار داشته‌اند
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setHistoryModalLocker(null)}
                  className="p-2 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Current Status Box */}
              <div className="p-4 bg-slate-50 border-b border-slate-100">
                <div className="text-xs text-slate-500 font-bold mb-1">وضعیت فعلی کمد:</div>
                <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "w-3 h-3 rounded-full",
                      historyModalLocker.status === 'occupied' && "bg-sky-500",
                      historyModalLocker.status === 'empty' && "bg-emerald-500",
                      historyModalLocker.status === 'inactive' && "bg-rose-500"
                    )}></span>
                    <span className="font-bold text-sm text-slate-800">
                      {historyModalLocker.status === 'occupied' ? `در اختیار «${historyModalLocker.studentName}»` :
                       historyModalLocker.status === 'empty' ? 'خالی و آماده تحویل' :
                       `غیرفعال (${historyModalLocker.inactiveReason || 'خراب'})`}
                    </span>
                  </div>

                  {historyModalLocker.status === 'occupied' && historyModalLocker.assignedAt && (
                    <span className="text-xs text-slate-500">
                      از تاریخ: {historyModalLocker.assignedAt}
                    </span>
                  )}
                </div>
              </div>

              {/* History Timeline */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <Clock size={14} className="text-amber-600" />
                    <span>سوابق افراد قبلی (۳ نفر آخر):</span>
                  </h4>
                  <span className="text-xs text-slate-400">
                    کل سوابق ثبت‌شده: {historyModalLocker.history?.length || 0}
                  </span>
                </div>

                {(!historyModalLocker.history || historyModalLocker.history.length === 0) ? (
                  <div className="p-10 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    تاکنون هیچ سابقه‌ای برای این کمد ثبت نشده است. با تخلیه یا تغییر کمد، سوابق به صورت خودکار در این بخش بایگانی می‌شوند.
                  </div>
                ) : (
                  <div className="relative border-r-2 border-amber-200 mr-3 pr-4 space-y-4">
                    {historyModalLocker.history.map((item, idx) => (
                      <div key={item.id || idx} className="relative">
                        {/* Dot */}
                        <div className={cn(
                          "absolute -right-[23px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs",
                          idx < 3 ? "bg-amber-600 ring-2 ring-amber-200" : "bg-slate-400"
                        )}></div>

                        <div className="bg-slate-50 hover:bg-slate-100/70 p-3.5 rounded-2xl border border-slate-200 transition-all">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-slate-800">
                                {idx + 1}. {item.studentName}
                              </span>
                              {item.studentGrade && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200">
                                  {item.studentGrade}
                                </span>
                              )}
                            </div>

                            {idx < 3 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                                نفر {idx === 0 ? 'اول' : idx === 1 ? 'دوم' : 'سوم'} قبلی
                              </span>
                            )}
                          </div>

                          <div className="mt-2 text-xs text-slate-500 space-y-1">
                            <div className="flex items-center gap-3">
                              <span>از تاریخ: <strong className="text-slate-700">{item.assignedAt || 'نامشخص'}</strong></span>
                              <span>تا تاریخ: <strong className="text-slate-700">{item.releasedAt || 'نامشخص'}</strong></span>
                            </div>
                            {item.assignedBy && (
                              <div className="text-[11px] text-slate-400">
                                ثبت توسط: {item.assignedBy}
                              </div>
                            )}
                            {item.notes && (
                              <div className="text-[11px] text-amber-800 bg-amber-50/80 p-1.5 rounded-lg border border-amber-100">
                                یادداشت: {item.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
                <button
                  onClick={() => setHistoryModalLocker(null)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  بستن
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 3: MARK INACTIVE (خرابی قفل، گم شدن کلید و...)                       */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {inactiveModalLocker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden"
            >
              <div className="p-5 bg-gradient-to-r from-rose-600 to-rose-700 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench size={20} />
                  <h3 className="font-extrabold text-base">
                    اعلام خرابی کمد #{inactiveModalLocker.lockerNumber}
                  </h3>
                </div>
                <button
                  onClick={() => setInactiveModalLocker(null)}
                  className="text-white/70 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-xs text-slate-600">
                  با غیرفعال‌سازی، این کمد از لیست کمدهای آماده تحویل خارج می‌شود تا رفع نقص یا پیدا شدن کلید انجام گیرد.
                </p>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">علت غیرفعال شدن:</label>
                  <select
                    value={inactiveReasonPreset}
                    onChange={(e) => setInactiveReasonPreset(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="خرابی قفل">خرابی قفل (گیر کردن یا شکستگی مغزی)</option>
                    <option value="گم شدن کلید">گم شدن کلید توسط طلبه یا مسئول</option>
                    <option value="شکستگی لولا یا دستگیره">شکستگی لولا یا درب کمد</option>
                    <option value="نیاز به نقاشی و تعمیرات اساسی">نیاز به رنگ‌آمیزی و تعمیرات اساسی</option>
                    <option value="سایر">سایر موارد...</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">توضیحات تکمیلی:</label>
                  <textarea
                    rows={3}
                    value={inactiveCustomReason}
                    onChange={(e) => setInactiveCustomReason(e.target.value)}
                    placeholder="جزئیات خرابی، زمان ارسال برای تعمیر و..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>

                {inactiveModalLocker.studentId && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                    توجه: این کمد هم‌اکنون در دست طلبه «{inactiveModalLocker.studentName}» است. با غیرفعال کردن، اطلاعات او به بخش سوابق منتقل شده و کمد مسدود می‌شود.
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setInactiveModalLocker(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  onClick={handleConfirmMarkInactive}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm"
                >
                  ثبت غیرفعال‌سازی
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 4: ADD LOCKER (افزودن شماره کمد تکی یا بازه‌ای)                       */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden"
            >
              <div className="p-5 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Plus size={20} />
                  <h3 className="font-extrabold text-base">افزودن شماره کمد جدید</h3>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-white/70 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddLockers} className="p-5 space-y-4">
                {/* Single vs Range Mode */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setAddMode('single')}
                    className={cn(
                      "py-2 rounded-lg transition-all",
                      addMode === 'single' ? "bg-white text-slate-800 shadow-xs" : "text-slate-600"
                    )}
                  >
                    یک شماره تکی
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddMode('range')}
                    className={cn(
                      "py-2 rounded-lg transition-all",
                      addMode === 'range' ? "bg-white text-slate-800 shadow-xs" : "text-slate-600"
                    )}
                  >
                    بازه چند شماره (مثلاً 201 تا 210)
                  </button>
                </div>

                {addMode === 'single' ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">شماره کمد:</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={singleLockerNum}
                      onChange={(e) => setSingleLockerNum(e.target.value)}
                      placeholder="مثلاً: 201"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-center"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 block">از شماره:</label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={rangeStartNum}
                        onChange={(e) => setRangeStartNum(e.target.value)}
                        placeholder="مثلاً: 201"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-center"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 block">تا شماره:</label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={rangeEndNum}
                        onChange={(e) => setRangeEndNum(e.target.value)}
                        placeholder="مثلاً: 220"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-center"
                      />
                    </div>
                  </div>
                )}

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                  کمد جدید با وضعیت «خالی و آماده تحویل» به فهرست کمدها اضافه خواهد شد.
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm"
                  >
                    افزودن کمد(ها)
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 5: DELETE CONFIRM (حذف قطعی کمد)                                     */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {lockerToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-sm overflow-hidden p-6 text-center space-y-4"
            >
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>

              <div className="space-y-1">
                <h3 className="font-extrabold text-base text-slate-800">
                  حذف کمد شماره #{lockerToDelete.lockerNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  آیا مطمئن هستید که می‌خواهید این شماره کمد را به کلی از سیستم حذف کنید؟ این عمل غیرقابل بازگشت است.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setLockerToDelete(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  onClick={handleConfirmDeleteLocker}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm"
                >
                  بله، حذف شود
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 6: SQL SCRIPT VIEWER (اسکریپت دیتابیس)                                */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isSqlModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-5 bg-gradient-to-r from-slate-800 to-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database size={20} className="text-amber-400" />
                  <h3 className="font-extrabold text-base">
                    اسکریپت کامل پایگاه داده (PostgreSQL / Supabase)
                  </h3>
                </div>
                <button
                  onClick={() => setIsSqlModalOpen(false)}
                  className="text-white/70 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 bg-amber-50 text-amber-900 text-xs border-b border-amber-200 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span>
                    این اسکریپت جدول اختصاصی <code className="font-bold text-amber-950">student_lockers</code>، ایندکس‌ها، امنیت RLS و تولید خودکار ۲۰۰ کمد اولیه را می‌سازد.
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(SQL_SCRIPT_CONTENT);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 2500);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                  >
                    {copiedSql ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedSql ? 'کپی شد!' : 'کپی اسکریپت SQL'}</span>
                  </button>
                </div>
                <div className="bg-amber-100/70 p-2.5 rounded-xl text-[11px] text-amber-900 leading-relaxed border border-amber-300/60">
                  <span className="font-bold">💡 نکته بسیار مهم: </span>
                  سامانه به صورت مستقل و هیبریدی طراحی شده و <strong>هیچ نیازی به اجرای اجباری این اسکریپت نیست</strong>؛ داده‌ها در پایگاه داده محلی (IndexedDB) و جدول ابری app_collections ذخیره می‌شوند.
                  اگر در محیط Supabase با خطای <code className="bg-white/80 px-1 py-0.5 rounded font-mono text-rose-700">Failed to fetch (api.supabase.com)</code> روبرو شدید، به دلیل فیلترینگ یا تحریم دامنه api.supabase.com در ایران است. با فعال‌سازی فیلترشکن، DNS شکن یا بدون اجرای اسکریپت، برنامه بدون هیچ مشکلی به طور کامل کار می‌کند.
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed" dir="ltr">
                <pre>{SQL_SCRIPT_CONTENT}</pre>
              </div>

              <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-sans">
                  همچنین فایل اختصاصی <code className="font-bold text-slate-700">lockers_database_schema.sql</code> در ریشه پروژه ذخیره گردید.
                </span>
                <button
                  onClick={() => setIsSqlModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-white font-bold rounded-xl cursor-pointer"
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
