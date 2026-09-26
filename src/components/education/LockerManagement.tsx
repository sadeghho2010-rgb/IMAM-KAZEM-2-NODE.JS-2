import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  KeyRound, 
  Search, 
  Plus, 
  Trash2, 
  UserCheck, 
  UserX, 
  AlertTriangle, 
  RotateCcw, 
  FileSpreadsheet, 
  Printer, 
  History, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  X, 
  Filter, 
  ArrowUpDown, 
  UserPlus, 
  Edit3, 
  SlidersHorizontal, 
  Layers, 
  Download, 
  Sparkles,
  ShieldCheck,
  Check,
  Unlock,
  Lock,
  DoorClosed,
  DoorOpen,
  Info,
  Calendar,
  GraduationCap
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { Student, StudentLocker, LockerHistoryItem } from '../../types';
import { getTodayShamsi } from '../../lib/jalali';
import { motion, AnimatePresence } from 'motion/react';

const LOCKERS_COLLECTION = 'student_lockers';
const TOTAL_DEFAULT_LOCKERS = 200;

const COMMON_INACTIVE_REASONS = [
  'خرابی قفل کمد',
  'گم شدن کلید و نیاز به تعویض مغزی',
  'شکستگی لولا یا درب کمد',
  'در دست تعمیرات و رنگ‌آمیزی',
  'کلید یدک موجود نیست',
  'سایر موارد فنی'
];

export default function LockerManagement() {
  const { canEditModule, isReadOnly, currentUser } = useAuth();
  const canEdit = canEditModule('lockers') && !isReadOnly;

  // Main data state
  const [lockers, setLockers] = useState<StudentLocker[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterView, setFilterView] = useState<'two_columns' | 'empty' | 'occupied' | 'inactive'>('two_columns');
  const [sortBy, setSortBy] = useState<'number_asc' | 'number_desc'>('number_asc');

  // Modals state
  const [assigningLocker, setAssigningLocker] = useState<StudentLocker | null>(null);
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [selectedStudentForAssign, setSelectedStudentForAssign] = useState<Student | null>(null);
  const [assignDate, setAssignDate] = useState(getTodayShamsi());
  const [assignNotes, setAssignNotes] = useState('');

  const [reassigningLocker, setReassigningLocker] = useState<StudentLocker | null>(null);
  const [reassignActionType, setReassignActionType] = useState<'release' | 'transfer'>('release');

  const [historyLocker, setHistoryLocker] = useState<StudentLocker | null>(null);
  const [inactiveLockerTarget, setInactiveLockerTarget] = useState<StudentLocker | null>(null);
  const [inactiveReasonInput, setInactiveReasonInput] = useState(COMMON_INACTIVE_REASONS[0]);
  const [customInactiveReason, setCustomInactiveReason] = useState('');

  const [isAddLockerOpen, setIsAddLockerOpen] = useState(false);
  const [newLockerNumber, setNewLockerNumber] = useState<number>(201);

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportFilter, setExportFilter] = useState<'all' | 'occupied' | 'empty' | 'inactive'>('all');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Initial Load of Lockers & Students
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Load students
        const allStudents = await localDb.getDocs<Student>('students');
        if (isMounted) {
          setStudents(allStudents || []);
        }

        // Load lockers
        const savedLockers = await localDb.getDocs<StudentLocker>(LOCKERS_COLLECTION);
        if (savedLockers && savedLockers.length > 0) {
          if (isMounted) {
            setLockers(savedLockers.sort((a, b) => a.lockerNumber - b.lockerNumber));
          }
        } else {
          // Initialize 200 lockers
          const initialList: StudentLocker[] = Array.from({ length: TOTAL_DEFAULT_LOCKERS }, (_, i) => ({
            id: `locker_${i + 1}`,
            lockerNumber: i + 1,
            status: 'empty',
            history: [],
            updatedAt: new Date().toISOString()
          }));

          for (const l of initialList) {
            await localDb.setDoc(LOCKERS_COLLECTION, l.id, l).catch(() => {});
          }

          if (isMounted) {
            setLockers(initialList);
          }
        }
      } catch (err) {
        console.error('Error loading lockers:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();

    // Subscribe to DB changes
    const unsubscribe = localDb.subscribe(() => {
      localDb.getDocs<StudentLocker>(LOCKERS_COLLECTION).then(items => {
        if (items && items.length > 0 && isMounted) {
          setLockers(items.sort((a, b) => a.lockerNumber - b.lockerNumber));
        }
      }).catch(() => {});
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Update max locker number suggestion when adding
  useEffect(() => {
    if (lockers.length > 0) {
      const maxNum = Math.max(...lockers.map(l => l.lockerNumber));
      setNewLockerNumber(maxNum + 1);
    }
  }, [lockers]);

  // Focus search input when assign modal opens
  useEffect(() => {
    if (assigningLocker) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
    }
  }, [assigningLocker]);

  // Save single locker to database & local state
  const persistLocker = async (updatedLocker: StudentLocker) => {
    setLockers(prev => prev.map(l => l.id === updatedLocker.id ? updatedLocker : l));
    try {
      await localDb.setDoc(LOCKERS_COLLECTION, updatedLocker.id, updatedLocker);
    } catch (e) {
      console.warn('Locker save fallback:', e);
    }
  };

  // Reset to default 200 lockers
  const handleResetToDefault200 = async () => {
    if (!window.confirm('آیا از بازنشانی کلیه کمدها به ۲۰۰ کمد اولیه اطمینان دارید؟ تمام واگذاری‌ها و سوابق پاک خواهند شد.')) {
      return;
    }

    const resetList: StudentLocker[] = Array.from({ length: TOTAL_DEFAULT_LOCKERS }, (_, i) => ({
      id: `locker_${i + 1}`,
      lockerNumber: i + 1,
      status: 'empty',
      history: [],
      updatedAt: new Date().toISOString()
    }));

    setLockers(resetList);
    try {
      // Clear old and save new
      for (const l of resetList) {
        await localDb.setDoc(LOCKERS_COLLECTION, l.id, l).catch(() => {});
      }
      showToast('۲۰۰ کمد با موفقیت بازنشانی و آماده واگذاری شدند.');
    } catch (e) {
      showToast('خطا در بازنشانی کمدها', 'error');
    }
  };

  // Open assign modal for an empty locker
  const handleOpenAssign = (locker: StudentLocker) => {
    if (!canEdit) {
      showToast('شما فقط دسترسی مشاهده کمدها را دارید.', 'info');
      return;
    }
    if (locker.status === 'inactive') {
      showToast(`کمد شماره ${locker.lockerNumber} در وضعیت غیرفعال (${locker.inactiveReason || 'خرابی'}) قرار دارد.`, 'error');
      return;
    }
    setAssigningLocker(locker);
    setSelectedStudentForAssign(null);
    setStudentSearchInput('');
    setAssignDate(getTodayShamsi());
    setAssignNotes('');
  };

  // Confirm assign locker to student
  const handleConfirmAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningLocker || !selectedStudentForAssign) {
      showToast('لطفاً طلبه مورد نظر را انتخاب نمایید.', 'error');
      return;
    }

    const newHistoryItem: LockerHistoryItem = {
      id: `hist_${Date.now()}`,
      studentId: selectedStudentForAssign.id,
      studentName: selectedStudentForAssign.name,
      studentGrade: selectedStudentForAssign.grade,
      assignedAt: assignDate || getTodayShamsi(),
      assignedBy: currentUser?.name || 'مسئول آموزش',
      notes: assignNotes.trim() || undefined
    };

    const updated: StudentLocker = {
      ...assigningLocker,
      status: 'occupied',
      studentId: selectedStudentForAssign.id,
      studentName: selectedStudentForAssign.name,
      studentGrade: selectedStudentForAssign.grade,
      assignedAt: assignDate || getTodayShamsi(),
      notes: assignNotes.trim() || undefined,
      history: [newHistoryItem, ...(assigningLocker.history || [])],
      updatedAt: new Date().toISOString()
    };

    await persistLocker(updated);
    setAssigningLocker(null);
    showToast(`کمد شماره ${updated.lockerNumber} با موفقیت به «${selectedStudentForAssign.name}» اختصاص یافت.`);
  };

  // Open Reassign / Release modal for an occupied locker
  const handleOpenReassign = (locker: StudentLocker) => {
    if (!canEdit) {
      showToast('شما فقط دسترسی مشاهده دارید.', 'info');
      return;
    }
    setReassigningLocker(locker);
    setReassignActionType('release');
    setSelectedStudentForAssign(null);
    setStudentSearchInput('');
    setAssignDate(getTodayShamsi());
    setAssignNotes('');
  };

  // Confirm release or transfer
  const handleConfirmReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassigningLocker) return;

    const today = assignDate || getTodayShamsi();

    if (reassignActionType === 'release') {
      // Release locker back to empty
      const updatedHistory = (reassigningLocker.history || []).map((item, idx) => {
        if (idx === 0 && !item.releasedAt) {
          return { ...item, releasedAt: today };
        }
        return item;
      });

      const updated: StudentLocker = {
        ...reassigningLocker,
        status: 'empty',
        studentId: undefined,
        studentName: undefined,
        studentGrade: undefined,
        assignedAt: undefined,
        notes: undefined,
        history: updatedHistory,
        updatedAt: new Date().toISOString()
      };

      await persistLocker(updated);
      setReassigningLocker(null);
      showToast(`کمد شماره ${updated.lockerNumber} تخلیه و کلید تحویل گرفته شد.`);
    } else {
      // Transfer to another student
      if (!selectedStudentForAssign) {
        showToast('لطفاً طلبه جدید را انتخاب کنید.', 'error');
        return;
      }

      // Close previous occupant's record
      const updatedHistory = (reassigningLocker.history || []).map((item, idx) => {
        if (idx === 0 && !item.releasedAt) {
          return { ...item, releasedAt: today };
        }
        return item;
      });

      // Add new occupant
      const newHistoryItem: LockerHistoryItem = {
        id: `hist_${Date.now()}`,
        studentId: selectedStudentForAssign.id,
        studentName: selectedStudentForAssign.name,
        studentGrade: selectedStudentForAssign.grade,
        assignedAt: today,
        assignedBy: currentUser?.name || 'مسئول آموزش',
        notes: assignNotes.trim() ? `انتقال: ${assignNotes.trim()}` : 'انتقال کمد'
      };

      const updated: StudentLocker = {
        ...reassigningLocker,
        status: 'occupied',
        studentId: selectedStudentForAssign.id,
        studentName: selectedStudentForAssign.name,
        studentGrade: selectedStudentForAssign.grade,
        assignedAt: today,
        notes: assignNotes.trim() || undefined,
        history: [newHistoryItem, ...updatedHistory],
        updatedAt: new Date().toISOString()
      };

      await persistLocker(updated);
      setReassigningLocker(null);
      showToast(`کمد شماره ${updated.lockerNumber} با موفقیت به «${selectedStudentForAssign.name}» منتقل گردید.`);
    }
  };

  // Toggle active/inactive state
  const handleToggleInactive = (locker: StudentLocker) => {
    if (!canEdit) {
      showToast('شما فقط دسترسی مشاهده دارید.', 'info');
      return;
    }

    if (locker.status === 'inactive') {
      // Reactivate locker
      const updated: StudentLocker = {
        ...locker,
        status: 'empty',
        inactiveReason: undefined,
        updatedAt: new Date().toISOString()
      };
      persistLocker(updated);
      showToast(`کمد شماره ${locker.lockerNumber} مجدداً فعال و به کمدهای خالی اضافه شد.`);
    } else {
      // Prompt for reason
      setInactiveLockerTarget(locker);
      setInactiveReasonInput(COMMON_INACTIVE_REASONS[0]);
      setCustomInactiveReason('');
    }
  };

  // Confirm inactivate
  const handleConfirmInactive = async () => {
    if (!inactiveLockerTarget) return;

    const reason = customInactiveReason.trim() || inactiveReasonInput;

    // If occupied, close active history item
    let updatedHistory = inactiveLockerTarget.history || [];
    if (inactiveLockerTarget.status === 'occupied') {
      const today = getTodayShamsi();
      updatedHistory = updatedHistory.map((item, idx) => {
        if (idx === 0 && !item.releasedAt) {
          return { ...item, releasedAt: today, notes: `${item.notes || ''} (خروج به علت غیرفعال‌سازی: ${reason})` };
        }
        return item;
      });
    }

    const updated: StudentLocker = {
      ...inactiveLockerTarget,
      status: 'inactive',
      studentId: undefined,
      studentName: undefined,
      studentGrade: undefined,
      assignedAt: undefined,
      inactiveReason: reason,
      history: updatedHistory,
      updatedAt: new Date().toISOString()
    };

    await persistLocker(updated);
    setInactiveLockerTarget(null);
    showToast(`کمد شماره ${updated.lockerNumber} به علت «${reason}» غیرفعال گردید.`);
  };

  // Delete a locker
  const handleDeleteLocker = async (locker: StudentLocker) => {
    if (!canEdit) return;

    if (!window.confirm(`آیا از حذف دائم کمد شماره ${locker.lockerNumber} اطمینان دارید؟`)) {
      return;
    }

    setLockers(prev => prev.filter(l => l.id !== locker.id));
    try {
      await localDb.deleteDoc(LOCKERS_COLLECTION, locker.id);
      showToast(`کمد شماره ${locker.lockerNumber} حذف شد.`);
    } catch (e) {
      showToast('خطا در حذف کمد', 'error');
    }
  };

  // Add new locker number
  const handleAddLocker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    if (!newLockerNumber || newLockerNumber <= 0) {
      showToast('شماره کمد نامعتبر است.', 'error');
      return;
    }

    if (lockers.some(l => l.lockerNumber === newLockerNumber)) {
      showToast(`کمد شماره ${newLockerNumber} از قبل در سیستم وجود دارد.`, 'error');
      return;
    }

    const newLocker: StudentLocker = {
      id: `locker_${newLockerNumber}`,
      lockerNumber: newLockerNumber,
      status: 'empty',
      history: [],
      updatedAt: new Date().toISOString()
    };

    await persistLocker(newLocker);
    setIsAddLockerOpen(false);
    showToast(`کمد شماره ${newLockerNumber} با موفقیت به لیست اضافه گردید.`);
  };

  // Filter & Search results
  const filteredStudents = useMemo(() => {
    if (!studentSearchInput.trim()) return students.slice(0, 8);
    const q = studentSearchInput.trim().toLowerCase();
    return students.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.nationalId && s.nationalId.includes(q)) ||
      (s.studentCode && s.studentCode.includes(q)) ||
      (s.grade && s.grade.toLowerCase().includes(q))
    ).slice(0, 15);
  }, [students, studentSearchInput]);

  // Which student currently occupies which locker?
  const studentOccupiedLockerMap = useMemo(() => {
    const map = new Map<string, number>();
    lockers.forEach(l => {
      if (l.status === 'occupied' && l.studentId) {
        map.set(l.studentId, l.lockerNumber);
      }
    });
    return map;
  }, [lockers]);

  // Filtered lockers based on search query
  const searchedLockers = useMemo(() => {
    let list = [...lockers];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(l => 
        l.lockerNumber.toString().includes(q) ||
        (l.studentName && l.studentName.toLowerCase().includes(q)) ||
        (l.studentGrade && l.studentGrade.toLowerCase().includes(q)) ||
        (l.inactiveReason && l.inactiveReason.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => {
      return sortBy === 'number_asc' 
        ? a.lockerNumber - b.lockerNumber 
        : b.lockerNumber - a.lockerNumber;
    });
  }, [lockers, searchQuery, sortBy]);

  // Split into empty, occupied, and inactive
  const emptyLockers = useMemo(() => searchedLockers.filter(l => l.status === 'empty'), [searchedLockers]);
  const occupiedLockers = useMemo(() => searchedLockers.filter(l => l.status === 'occupied'), [searchedLockers]);
  const inactiveLockers = useMemo(() => searchedLockers.filter(l => l.status === 'inactive'), [searchedLockers]);

  // Global counts (unfiltered)
  const totalCount = lockers.length;
  const totalEmpty = lockers.filter(l => l.status === 'empty').length;
  const totalOccupied = lockers.filter(l => l.status === 'occupied').length;
  const totalInactive = lockers.filter(l => l.status === 'inactive').length;

  // Export to Excel
  const handleExportExcel = () => {
    let exportData: any[] = [];
    let title = 'گزارش کمدهای طلاب';

    let targetLockers = lockers;
    if (exportFilter === 'occupied') {
      targetLockers = lockers.filter(l => l.status === 'occupied');
      title = 'لیست کمدهای پر و واگذار شده';
    } else if (exportFilter === 'empty') {
      targetLockers = lockers.filter(l => l.status === 'empty');
      title = 'لیست کمدهای خالی و آماده واگذاری';
    } else if (exportFilter === 'inactive') {
      targetLockers = lockers.filter(l => l.status === 'inactive');
      title = 'لیست کمدهای غیرفعال و دارای نقص';
    }

    exportData = targetLockers.map((l, index) => ({
      'ردیف': index + 1,
      'شماره کمد': l.lockerNumber,
      'وضعیت': l.status === 'occupied' ? 'واگذار شده (پر)' : l.status === 'empty' ? 'خالی (آماده واگذاری)' : 'غیرفعال / در دست تعمیر',
      'نام و نام خانوادگی طلبه': l.studentName || '-',
      'پایه تحصیلی': l.studentGrade || '-',
      'تاریخ واگذاری': l.assignedAt || '-',
      'علت غیرفعال بودن': l.inactiveReason || '-',
      'توضیحات': l.notes || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'کمدها');
    XLSX.writeFile(wb, `${title}_${getTodayShamsi().replace(/\//g, '-')}.xlsx`);
    setIsExportOpen(false);
    showToast('فایل اکسل با موفقیت دانلود شد.');
  };

  // Print Report
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-vazir" dir="rtl">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 font-bold text-xs border text-white",
              toast.type === 'error' ? "bg-rose-700 border-rose-500" :
              toast.type === 'info' ? "bg-sky-700 border-sky-500" :
              "bg-emerald-700 border-emerald-500"
            )}
          >
            {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black shadow-md shadow-amber-500/20 shrink-0">
            <KeyRound size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900">
                سامانه اختصاص و امانت کمدهای طلاب
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
                مسئول آموزش
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              مدیریت ۲۰۰ کمد، تحویل امانت کلید به طلاب، سوابق تحویل، و تفکیک بلادرنگ کمدهای خالی و پر
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          {canEdit && (
            <>
              <button
                onClick={() => setIsAddLockerOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                title="افزودن شماره کمد جدید"
              >
                <Plus size={15} />
                <span>افزودن کمد جدید</span>
              </button>

              <button
                onClick={handleResetToDefault200}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                title="بازنشانی به ۲۰۰ کمد اولیه"
              >
                <RotateCcw size={14} />
                <span>بازنشانی ۲۰۰ کمد</span>
              </button>
            </>
          )}

          <button
            onClick={() => setIsExportOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-2xl text-xs font-bold transition-all cursor-pointer"
            title="خروجی اکسل و چاپ"
          >
            <Download size={14} />
            <span>خروجی و گزارش</span>
          </button>
        </div>
      </div>

      {/* Quick Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 print:hidden">
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400">کل کمدهای سامانه</span>
            <p className="text-xl sm:text-2xl font-black text-slate-800 mt-0.5">{totalCount} کمد</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
            <DoorClosed size={20} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-3xl border border-emerald-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-700">کمدهای خالی (آماده واگذاری)</span>
            <p className="text-xl sm:text-2xl font-black text-emerald-800 mt-0.5">{totalEmpty} کمد</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
            <DoorOpen size={20} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-sky-50 to-white p-4 rounded-3xl border border-sky-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-sky-700">کمدهای پر (واگذار شده)</span>
            <p className="text-xl sm:text-2xl font-black text-sky-900 mt-0.5">{totalOccupied} کمد</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-bold shadow-xs">
            <KeyRound size={20} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-white p-4 rounded-3xl border border-rose-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-rose-700">کمدهای غیرفعال (خرابی/نقص)</span>
            <p className="text-xl sm:text-2xl font-black text-rose-800 mt-0.5">{totalInactive} کمد</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center font-bold shadow-xs">
            <AlertTriangle size={20} />
          </div>
        </div>
      </div>

      {/* Search and Display Controls */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجوی شماره کمد، نام طلبه، پایه..."
            className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-amber-500"
          />
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* View Mode Filters */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setFilterView('two_columns')}
              className={cn(
                "px-3 py-1 rounded-lg transition-all cursor-pointer",
                filterView === 'two_columns' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
              )}
            >
              نمایش دو ستونه (خالی و پر)
            </button>
            <button
              onClick={() => setFilterView('empty')}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1",
                filterView === 'empty' ? "bg-emerald-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-900"
              )}
            >
              <span>خالی</span>
              <span className="text-[10px]">({emptyLockers.length})</span>
            </button>
            <button
              onClick={() => setFilterView('occupied')}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1",
                filterView === 'occupied' ? "bg-sky-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-900"
              )}
            >
              <span>پر</span>
              <span className="text-[10px]">({occupiedLockers.length})</span>
            </button>
            <button
              onClick={() => setFilterView('inactive')}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1",
                filterView === 'inactive' ? "bg-rose-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-900"
              )}
            >
              <span>غیرفعال</span>
              <span className="text-[10px]">({inactiveLockers.length})</span>
            </button>
          </div>

          <button
            onClick={() => setSortBy(prev => prev === 'number_asc' ? 'number_desc' : 'number_asc')}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
            title="تغییر ترتیب شماره کمدها"
          >
            <ArrowUpDown size={14} />
          </button>
        </div>
      </div>

      {/* PRINT VIEW (Clean official printable table) */}
      <div className="hidden print:block font-vazir text-black">
        <div className="text-center border-b-2 border-black pb-4 mb-4">
          <h2 className="text-xl font-black">گزارش وضعیت و واگذاری کمدهای طلاب حوزه علمیه</h2>
          <p className="text-xs mt-1">تاریخ صدور گزارش: {getTodayShamsi()} • تعداد کل کمدهای ثبت شده: {lockers.length}</p>
        </div>

        <table className="w-full text-right text-xs border-collapse border border-black">
          <thead>
            <tr className="bg-slate-200 border-b border-black">
              <th className="p-2 border border-black text-center w-12">شماره</th>
              <th className="p-2 border border-black">وضعیت کمد</th>
              <th className="p-2 border border-black">نام طلبه صاحب کمد</th>
              <th className="p-2 border border-black text-center">پایه تحصیلی</th>
              <th className="p-2 border border-black text-center">تاریخ واگذاری</th>
              <th className="p-2 border border-black">علت نقص / توضیحات</th>
              <th className="p-2 border border-black text-center w-20">امضا و تایید</th>
            </tr>
          </thead>
          <tbody>
            {(exportFilter === 'occupied' ? occupiedLockers :
              exportFilter === 'empty' ? emptyLockers :
              exportFilter === 'inactive' ? inactiveLockers : searchedLockers).map(l => (
              <tr key={l.id} className="border-b border-black">
                <td className="p-2 border border-black text-center font-bold">{l.lockerNumber}</td>
                <td className="p-2 border border-black">
                  {l.status === 'occupied' ? 'واگذار شده (پر)' : l.status === 'empty' ? 'خالی' : 'غیرفعال'}
                </td>
                <td className="p-2 border border-black font-bold">{l.studentName || '-'}</td>
                <td className="p-2 border border-black text-center">{l.studentGrade || '-'}</td>
                <td className="p-2 border border-black text-center">{l.assignedAt || '-'}</td>
                <td className="p-2 border border-black text-[10px]">{l.inactiveReason || l.notes || '-'}</td>
                <td className="p-2 border border-black"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* TWO-COLUMN MAIN DISPLAY (خالی و پر در دو سمت جداگانه) */}
      {filterView === 'two_columns' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
          
          {/* RIGHT COLUMN: کمدهای خالی (آماده واگذاری) */}
          <div className="space-y-3">
            <div className="bg-emerald-700 text-white px-4 py-3 rounded-2xl shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DoorOpen size={20} className="text-emerald-200" />
                <h3 className="font-black text-sm">کمدهای خالی و آماده واگذاری</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-800 text-emerald-100 text-xs font-bold border border-emerald-600">
                {emptyLockers.length} کمد آزاد
              </span>
            </div>

            {emptyLockers.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 border border-dashed border-slate-300 text-center text-slate-400 text-xs font-bold">
                کمد خالی یافت نشد.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[700px] overflow-y-auto p-2 bg-slate-50/70 rounded-3xl border border-slate-200 custom-scrollbar">
                {emptyLockers.map(locker => (
                  <div
                    key={locker.id}
                    onClick={() => handleOpenAssign(locker)}
                    className="group bg-white hover:bg-emerald-50/80 border border-slate-200 hover:border-emerald-300 rounded-2xl p-3 flex flex-col justify-between transition-all shadow-2xs hover:shadow-md cursor-pointer relative"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base font-black text-slate-900 group-hover:text-emerald-800">
                        کمد {locker.lockerNumber}
                      </span>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" title="آماده واگذاری" />
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                      <span className="text-emerald-700 font-bold group-hover:underline flex items-center gap-0.5">
                        <Plus size={11} />
                        <span>اختصاص کمد</span>
                      </span>

                      <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setHistoryLocker(locker)}
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                          title="مشاهده سابقه کمد"
                        >
                          <History size={12} />
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleToggleInactive(locker)}
                            className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                            title="ثبت خرابی یا گم شدن کلید (غیرفعال)"
                          >
                            <AlertTriangle size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* LEFT COLUMN: کمدهای پر (واگذار شده به طلاب) */}
          <div className="space-y-3">
            <div className="bg-sky-800 text-white px-4 py-3 rounded-2xl shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound size={20} className="text-sky-200" />
                <h3 className="font-black text-sm">کمدهای پر و واگذار شده به طلاب</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-sky-900 text-sky-100 text-xs font-bold border border-sky-700">
                {occupiedLockers.length} کمد در دست طلاب
              </span>
            </div>

            {occupiedLockers.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 border border-dashed border-slate-300 text-center text-slate-400 text-xs font-bold">
                در حال حاضر هیچ کمدی واگذار نشده است.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[700px] overflow-y-auto p-2 bg-slate-50/70 rounded-3xl border border-slate-200 custom-scrollbar">
                {occupiedLockers.map(locker => (
                  <div
                    key={locker.id}
                    className="bg-white border border-sky-100 hover:border-sky-300 rounded-2xl p-3.5 space-y-2.5 shadow-2xs hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center font-black text-xs">
                          {locker.lockerNumber}
                        </div>
                        <div>
                          <span className="text-xs font-black text-slate-900 block truncate">
                            {locker.studentName}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold block">
                            {locker.studentGrade || 'طلبه'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setHistoryLocker(locker)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="مشاهده ۳ سابقه قبلی کمد"
                        >
                          <History size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1 rounded-xl">
                      <span>تاریخ تحویل کلید:</span>
                      <span className="font-bold text-slate-800">{locker.assignedAt || '-'}</span>
                    </div>

                    {canEdit && (
                      <div className="pt-1 flex items-center justify-end gap-1.5 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleOpenReassign(locker)}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          title="تغییر فرد یا تخلیه کمد"
                        >
                          <Edit3 size={12} />
                          <span>تغییر / تحویل</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleInactive(locker)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="ثبت نقص فنی / غیرفعال‌سازی"
                        >
                          <AlertTriangle size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      ) : (
        /* SINGLE TAB VIEW (Empty / Occupied / Inactive) */
        <div className="space-y-4 print:hidden">
          <div className="flex items-center justify-between bg-slate-900 text-white px-5 py-3 rounded-2xl">
            <h3 className="font-bold text-sm">
              {filterView === 'empty' ? 'کمدهای خالی و آماده واگذاری' :
               filterView === 'occupied' ? 'کمدهای پر و در دست طلاب' :
               'کمدهای غیرفعال (خرابی قفل یا مفقودی کلید)'}
            </h3>
            <span className="text-xs bg-slate-800 px-3 py-1 rounded-xl font-bold">
              {filterView === 'empty' ? emptyLockers.length :
               filterView === 'occupied' ? occupiedLockers.length : inactiveLockers.length} مورد
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {(filterView === 'empty' ? emptyLockers :
              filterView === 'occupied' ? occupiedLockers : inactiveLockers).map(locker => (
              <div
                key={locker.id}
                className={cn(
                  "bg-white rounded-2xl p-4 border flex flex-col justify-between space-y-2 shadow-2xs hover:shadow-md transition-all",
                  locker.status === 'empty' ? "border-emerald-200 hover:border-emerald-400" :
                  locker.status === 'occupied' ? "border-sky-200 hover:border-sky-400" :
                  "border-rose-200 bg-rose-50/30"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-black text-slate-900">کمد {locker.lockerNumber}</span>
                  <span className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    locker.status === 'empty' ? "bg-emerald-500" :
                    locker.status === 'occupied' ? "bg-sky-500" : "bg-rose-500"
                  )} />
                </div>

                {locker.status === 'occupied' && (
                  <div>
                    <span className="text-xs font-black text-slate-800 block truncate">{locker.studentName}</span>
                    <span className="text-[10px] text-slate-500 block truncate">{locker.studentGrade}</span>
                    <span className="text-[10px] text-slate-400 block mt-1">{locker.assignedAt}</span>
                  </div>
                )}

                {locker.status === 'inactive' && (
                  <div className="text-[10px] text-rose-700 bg-rose-50 p-1.5 rounded-lg border border-rose-200 font-bold">
                    {locker.inactiveReason || 'خرابی قفل'}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  {locker.status === 'empty' && (
                    <button
                      onClick={() => handleOpenAssign(locker)}
                      className="text-emerald-700 font-bold text-xs hover:underline cursor-pointer"
                    >
                      اختصاص کمد
                    </button>
                  )}

                  {locker.status === 'occupied' && canEdit && (
                    <button
                      onClick={() => handleOpenReassign(locker)}
                      className="text-sky-700 font-bold text-xs hover:underline cursor-pointer"
                    >
                      تغییر / تحویل
                    </button>
                  )}

                  {locker.status === 'inactive' && canEdit && (
                    <button
                      onClick={() => handleToggleInactive(locker)}
                      className="text-emerald-700 font-bold text-xs hover:underline cursor-pointer"
                    >
                      فعال‌سازی مجدد
                    </button>
                  )}

                  <button
                    onClick={() => setHistoryLocker(locker)}
                    className="p-1 text-slate-400 hover:text-indigo-600 rounded-md"
                    title="سوابق کمد"
                  >
                    <History size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION: کمدهای غیرفعال در انتهای صفحه (همواره قابل مشاهده) */}
      {filterView === 'two_columns' && inactiveLockers.length > 0 && (
        <div className="bg-white rounded-3xl p-5 border border-rose-200 shadow-xs space-y-3 print:hidden">
          <div className="flex items-center justify-between border-b border-rose-100 pb-3">
            <div className="flex items-center gap-2 text-rose-800 font-black text-sm">
              <AlertTriangle size={18} className="text-rose-600" />
              <span>کمدهای غیرفعال (خرابی قفل، گم شدن کلید یا در دست تعمیر)</span>
            </div>
            <span className="text-xs bg-rose-100 text-rose-800 font-bold px-3 py-0.5 rounded-full">
              {inactiveLockers.length} کمد نیازمند رسیدگی
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {inactiveLockers.map(l => (
              <div key={l.id} className="bg-rose-50/50 border border-rose-200 rounded-2xl p-3 flex items-center justify-between">
                <div>
                  <span className="font-black text-sm text-slate-900 block">کمد شماره {l.lockerNumber}</span>
                  <span className="text-[11px] text-rose-700 font-bold block mt-0.5">{l.inactiveReason || 'خرابی قفل'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setHistoryLocker(l)}
                    className="p-1.5 text-slate-400 hover:text-slate-700"
                    title="مشاهده سوابق"
                  >
                    <History size={14} />
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => handleToggleInactive(l)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                      title="رفع مشکل و فعال‌سازی مجدد کمد"
                    >
                      فعال‌سازی
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: نوار جستجو و اختصاص سریع کمد به طلبه (Assign Modal) */}
      {/* ============================================================== */}
      <AnimatePresence>
        {assigningLocker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-5 sm:p-7 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 my-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md shadow-emerald-600/20">
                    <KeyRound size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      اختصاص کمد شماره {assigningLocker.lockerNumber}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      جستجوی سریع نام طلبه و امانت دادن کلید
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setAssigningLocker(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleConfirmAssign} className="space-y-4">
                
                {/* Search Bar for Students */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    جستجوی طلبه (تایپ بخشی از نام، نام خانوادگی یا پایه):
                  </label>
                  <div className="relative">
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={studentSearchInput}
                      onChange={(e) => setStudentSearchInput(e.target.value)}
                      placeholder="تایپ کنید: مثلاً 'محمدی' یا 'سرلک'..."
                      className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-500"
                    />
                    <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                {/* Instant Search Results */}
                <div className="space-y-1 max-h-48 overflow-y-auto p-1 bg-slate-50 rounded-2xl border border-slate-200 custom-scrollbar">
                  {filteredStudents.length === 0 ? (
                    <div className="text-center py-5 text-slate-400 text-xs font-bold">
                      طلبه‌ای با این مشخصات یافت نشد.
                    </div>
                  ) : (
                    filteredStudents.map(student => {
                      const isSelected = selectedStudentForAssign?.id === student.id;
                      const hasLocker = studentOccupiedLockerMap.get(student.id);

                      return (
                        <div
                          key={student.id}
                          onClick={() => setSelectedStudentForAssign(student)}
                          className={cn(
                            "flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                              : "bg-white hover:bg-slate-100 border-slate-100 text-slate-800"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black",
                              isSelected ? "bg-emerald-700 text-white" : "bg-slate-200 text-slate-700"
                            )}>
                              {(student.name || 'ط')[0]}
                            </span>
                            <span>{student.name}</span>
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded",
                              isSelected ? "bg-emerald-700 text-emerald-100" : "bg-slate-100 text-slate-500"
                            )}>
                              {student.grade || 'پایه نامشخص'}
                            </span>
                          </div>

                          {hasLocker && (
                            <span className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full font-bold",
                              isSelected ? "bg-amber-400 text-amber-950" : "bg-amber-100 text-amber-800"
                            )} title="این طلبه در حال حاضر کمد دارد">
                              کمد {hasLocker} دارد
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Selected Student Confirmation Badge */}
                {selectedStudentForAssign && (
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-emerald-900 font-black block">طلبه انتخاب شده: {selectedStudentForAssign.name}</span>
                      <span className="text-[11px] text-emerald-700 block mt-0.5">{selectedStudentForAssign.grade} • کد ملی: {selectedStudentForAssign.nationalId || '-'}</span>
                    </div>
                    <CheckCircle2 size={20} className="text-emerald-600" />
                  </div>
                )}

                {/* Assignment Date & Optional Note */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      تاریخ تحویل کلید:
                    </label>
                    <input
                      type="text"
                      value={assignDate}
                      onChange={(e) => setAssignDate(e.target.value)}
                      placeholder="۱۴۰۳/۰۷/۰۱"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      یادداشت اختیاری:
                    </label>
                    <input
                      type="text"
                      value={assignNotes}
                      onChange={(e) => setAssignNotes(e.target.value)}
                      placeholder="مثلاً تحویل ۱ نسخه کلید یدک..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setAssigningLocker(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedStudentForAssign}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5"
                  >
                    <Check size={16} />
                    <span>تایید و واگذاری کلید کمد</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* MODAL 2: تغییر فرد یا آزادسازی کمد (Reassign / Release) */}
      {/* ============================================================== */}
      <AnimatePresence>
        {reassigningLocker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-5 sm:p-7 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 my-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-black shadow-md shadow-sky-600/20">
                    <KeyRound size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      مدیریت کمد شماره {reassigningLocker.lockerNumber}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      صاحب فعلی: «{reassigningLocker.studentName}» ({reassigningLocker.studentGrade})
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setReassigningLocker(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Action Selection Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setReassignActionType('release')}
                  className={cn(
                    "flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                    reassignActionType === 'release' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <Unlock size={14} />
                  <span>تخلیه و تحویل کلید (آزادسازی)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReassignActionType('transfer')}
                  className={cn(
                    "flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                    reassignActionType === 'transfer' ? "bg-white text-sky-800 shadow-xs" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <UserPlus size={14} />
                  <span>انتقال به طلبه دیگر</span>
                </button>
              </div>

              <form onSubmit={handleConfirmReassign} className="space-y-4">
                
                {reassignActionType === 'release' ? (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-2">
                    <div className="flex items-center gap-2 font-black">
                      <Info size={16} className="text-amber-600" />
                      <span>آیا کلید کمد از «{reassigningLocker.studentName}» تحویل گرفته شد؟</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-800">
                      با تایید این بخش، کمد مجدداً در وضعیت <b>خالی</b> قرار گرفته و تاریخ ترخیص در سابقه کمد ثبت خواهد شد.
                    </p>
                    <div className="pt-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        تاریخ عودت کلید:
                      </label>
                      <input
                        type="text"
                        value={assignDate}
                        onChange={(e) => setAssignDate(e.target.value)}
                        placeholder={getTodayShamsi()}
                        className="w-full px-3 py-1.5 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        جستجوی طلبه جدید جهت انتقال کمد:
                      </label>
                      <input
                        type="text"
                        value={studentSearchInput}
                        onChange={(e) => setStudentSearchInput(e.target.value)}
                        placeholder="نام طلبه جدید..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-sky-500"
                      />
                    </div>

                    <div className="space-y-1 max-h-40 overflow-y-auto p-1 bg-slate-50 rounded-2xl border border-slate-200 custom-scrollbar">
                      {filteredStudents.map(student => (
                        <div
                          key={student.id}
                          onClick={() => setSelectedStudentForAssign(student)}
                          className={cn(
                            "flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                            selectedStudentForAssign?.id === student.id
                              ? "bg-sky-600 text-white border-sky-600"
                              : "bg-white hover:bg-slate-100 text-slate-800"
                          )}
                        >
                          <span>{student.name} ({student.grade})</span>
                          {selectedStudentForAssign?.id === student.id && <Check size={14} />}
                        </div>
                      ))}
                    </div>

                    {selectedStudentForAssign && (
                      <div className="p-2.5 bg-sky-50 rounded-xl text-xs font-black text-sky-900 border border-sky-200">
                        انتقال به: {selectedStudentForAssign.name} ({selectedStudentForAssign.grade})
                      </div>
                    )}
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setReassigningLocker(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/20 cursor-pointer flex items-center gap-1.5"
                  >
                    <Check size={16} />
                    <span>{reassignActionType === 'release' ? 'تایید تخلیه و ترخیص کمد' : 'تایید انتقال کمد'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* MODAL 3: سابقه کمد و ۳ نفر قبلی (History Modal) */}
      {/* ============================================================== */}
      <AnimatePresence>
        {historyLocker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-5 sm:p-7 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 my-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-600/20">
                    <History size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      سوابق امانت کلید کمد شماره {historyLocker.lockerNumber}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      مشاهده آخرین افراد و تا ۳ نفر قبلی که کلید دست آنها بوده است
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setHistoryLocker(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Current Status Box */}
              <div className={cn(
                "p-3 rounded-2xl border text-xs flex items-center justify-between",
                historyLocker.status === 'occupied' ? "bg-sky-50 border-sky-200 text-sky-900" :
                historyLocker.status === 'empty' ? "bg-emerald-50 border-emerald-200 text-emerald-900" :
                "bg-rose-50 border-rose-200 text-rose-900"
              )}>
                <div>
                  <span className="font-bold block">وضعیت فعلی کمد:</span>
                  <span className="text-[11px] mt-0.5 block">
                    {historyLocker.status === 'occupied' ? `در دست «${historyLocker.studentName}» از تاریخ ${historyLocker.assignedAt}` :
                     historyLocker.status === 'empty' ? 'خالی و در انبار کلیدها' : `غیرفعال (${historyLocker.inactiveReason || 'خرابی'})`}
                  </span>
                </div>
                <div className="px-2.5 py-1 rounded-xl bg-white font-black text-[11px] shadow-2xs">
                  کمد {historyLocker.lockerNumber}
                </div>
              </div>

              {/* History Timeline */}
              <div className="space-y-2.5 pt-1">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Clock size={14} className="text-indigo-600" />
                  <span>افرادی که کلید این کمد را داشته‌اند (تا ۳ نفر قبلی):</span>
                </h4>

                {(!historyLocker.history || historyLocker.history.length === 0) ? (
                  <div className="text-center py-6 bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs font-bold">
                    هنوز سابقه‌ای برای این کمد ثبت نشده است.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto p-1 custom-scrollbar">
                    {historyLocker.history.slice(0, 5).map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className={cn(
                          "p-3 rounded-2xl border text-xs space-y-1 relative",
                          idx === 0 && historyLocker.status === 'occupied'
                            ? "bg-sky-50/70 border-sky-200"
                            : "bg-slate-50/80 border-slate-200"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-black flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-black text-slate-900">{item.studentName}</span>
                            <span className="text-[10px] text-slate-500">({item.studentGrade || 'طلبه'})</span>
                          </div>

                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-bold",
                            !item.releasedAt ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                          )}>
                            {!item.releasedAt ? 'صاحب فعلی' : 'تحویل داده شده'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                          <span>تاریخ تحویل: <b className="text-slate-700">{item.assignedAt || '-'}</b></span>
                          <span>تاریخ عودت: <b className="text-slate-700">{item.releasedAt || 'هنوز دست طلبه است'}</b></span>
                        </div>

                        {item.notes && (
                          <p className="text-[10px] text-slate-500 bg-white p-1 rounded-lg border border-slate-100 mt-1">
                            توضیحات: {item.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setHistoryLocker(null)}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  بستن
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* MODAL 4: غیرفعال‌سازی کمد (Inactive Reason Modal) */}
      {/* ============================================================== */}
      <AnimatePresence>
        {inactiveLockerTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-5 sm:p-7 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 my-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center font-black">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      غیرفعال‌سازی کمد شماره {inactiveLockerTarget.lockerNumber}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      ثبت خرابی یا گم شدن کلید کمد
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setInactiveLockerTarget(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    انتخاب علت نقص یا غیرفعال بودن:
                  </label>
                  <div className="space-y-1.5">
                    {COMMON_INACTIVE_REASONS.map(reason => (
                      <label
                        key={reason}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all",
                          inactiveReasonInput === reason ? "bg-rose-50 border-rose-300 text-rose-900 font-bold" : "bg-white border-slate-200 text-slate-700"
                        )}
                      >
                        <input
                          type="radio"
                          name="inactive_reason"
                          checked={inactiveReasonInput === reason}
                          onChange={() => setInactiveReasonInput(reason)}
                          className="w-4 h-4 text-rose-600 focus:ring-rose-500"
                        />
                        <span>{reason}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    توضیحات تکمیلی اختیاری:
                  </label>
                  <input
                    type="text"
                    value={customInactiveReason}
                    onChange={(e) => setCustomInactiveReason(e.target.value)}
                    placeholder="توضیح بیشتر در صورت نیاز..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setInactiveLockerTarget(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleConfirmInactive}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  تایید غیرفعال‌سازی
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* MODAL 5: افزودن شماره کمد جدید (Add Locker Modal) */}
      {/* ============================================================== */}
      <AnimatePresence>
        {isAddLockerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-5 sm:p-7 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4 my-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black">
                    <Plus size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      افزودن شماره کمد جدید
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      ثبت کمد فیزیکی جدید در سیستم
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsAddLockerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddLocker} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    شماره کمد:
                  </label>
                  <input
                    type="number"
                    value={newLockerNumber}
                    onChange={(e) => setNewLockerNumber(parseInt(e.target.value) || 0)}
                    min={1}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    کمد به صورت پیش‌فرض با وضعیت «خالی و آماده واگذاری» ثبت می‌گردد.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddLockerOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    افزودن کمد
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* MODAL 6: خروجی و گزارش‌گیری (Export / Print Modal) */}
      {/* ============================================================== */}
      <AnimatePresence>
        {isExportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-5 sm:p-7 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 my-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black">
                    <Download size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      دریافت خروجی و چاپ لیست کمدها
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      فایل اکسل و نسخه چاپی با رعایت کامل فیلترها
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsExportOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    محتوای گزارش را مشخص کنید:
                  </label>
                  <div className="space-y-1.5">
                    <label className={cn(
                      "flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all",
                      exportFilter === 'all' ? "bg-indigo-50 border-indigo-300 text-indigo-950 font-bold" : "bg-white border-slate-200 text-slate-700"
                    )}>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="export_filter"
                          checked={exportFilter === 'all'}
                          onChange={() => setExportFilter('all')}
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>گزارش جامع تمام کمدها</span>
                      </div>
                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-md font-bold">{totalCount} کمد</span>
                    </label>

                    <label className={cn(
                      "flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all",
                      exportFilter === 'occupied' ? "bg-sky-50 border-sky-300 text-sky-950 font-bold" : "bg-white border-slate-200 text-slate-700"
                    )}>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="export_filter"
                          checked={exportFilter === 'occupied'}
                          onChange={() => setExportFilter('occupied')}
                          className="w-4 h-4 text-sky-600 focus:ring-sky-500"
                        />
                        <span>فقط کمدهای پر (همراه با نام صاحب کمد و پایه)</span>
                      </div>
                      <span className="text-[10px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded-md font-bold">{totalOccupied} کمد</span>
                    </label>

                    <label className={cn(
                      "flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all",
                      exportFilter === 'empty' ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-bold" : "bg-white border-slate-200 text-slate-700"
                    )}>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="export_filter"
                          checked={exportFilter === 'empty'}
                          onChange={() => setExportFilter('empty')}
                          className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>فقط کمدهای خالی (آماده واگذاری)</span>
                      </div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold">{totalEmpty} کمد</span>
                    </label>

                    <label className={cn(
                      "flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all",
                      exportFilter === 'inactive' ? "bg-rose-50 border-rose-300 text-rose-950 font-bold" : "bg-white border-slate-200 text-slate-700"
                    )}>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="export_filter"
                          checked={exportFilter === 'inactive'}
                          onChange={() => setExportFilter('inactive')}
                          className="w-4 h-4 text-rose-600 focus:ring-rose-500"
                        />
                        <span>کمدهای غیرفعال (همراه با علت خرابی)</span>
                      </div>
                      <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md font-bold">{totalInactive} کمد</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <FileSpreadsheet size={16} />
                    <span>دریافت اکسل (Excel)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrint}
                    className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Printer size={16} />
                    <span>چاپ رسمی / PDF</span>
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
