import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, 
  Users, 
  Check, 
  X, 
  Plus, 
  FileSpreadsheet, 
  Printer, 
  Search, 
  SlidersHorizontal, 
  CheckCircle2, 
  DollarSign, 
  Calendar, 
  Edit3, 
  AlertCircle,
  FileText,
  CreditCard,
  Building2,
  TrendingUp
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { getTodayShamsi } from '../../lib/jalali';
import { motion, AnimatePresence } from 'motion/react';
import { PresenceReport } from '../../types';

interface TeacherFeeItem {
  id: string;
  name: string;
  courses: string;
  grade: string;
  hourlyRate: number;
  totalHours: number;
  bonusAmount: number;
  deductions: number;
  status: 'pending' | 'approved' | 'paid';
  bankAccount: string;
  bankSheba?: string;
  notes?: string;
  lastUpdated?: string;
}

interface TeachersCompensationProps {
  onNavigateTab?: (tab: string, params?: any) => void;
}

export default function TeachersCompensation({ onNavigateTab }: TeachersCompensationProps) {
  const { currentUser } = useAuth();

  const [reports, setReports] = useState<PresenceReport[]>([]);
  const [teachers, setTeachers] = useState<TeacherFeeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('شهریور و مهر ۱۴۰۳');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'pending' | 'approved' | 'paid'>('all');
  const [toastMessage, setToastMessage] = useState('');

  // Modals
  const [isAddTeachingHoursOpen, setIsAddTeachingHoursOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherFeeItem | null>(null);
  const [slipTeacher, setSlipTeacher] = useState<TeacherFeeItem | null>(null);

  // Default hourly teaching rate
  const [defaultHourlyRate, setDefaultHourlyRate] = useState(180000);

  // New manual teaching hours form
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherCourse, setNewTeacherCourse] = useState('فقه و اصول');
  const [newTeacherGrade, setNewTeacherGrade] = useState('پایه ۷');
  const [newTeacherHours, setNewTeacherHours] = useState('32');
  const [newTeacherHourlyRate, setNewTeacherHourlyRate] = useState('180000');
  const [newTeacherAccount, setNewTeacherAccount] = useState('');
  const [newTeacherNotes, setNewTeacherNotes] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [reps, storedTeachers] = await Promise.all([
        localDb.getDocs<PresenceReport>('presence_reports'),
        localDb.getDocs<TeacherFeeItem>('finance_teachers_fees')
      ]);

      setReports(reps || []);

      if (storedTeachers && storedTeachers.length > 0) {
        setTeachers(storedTeachers);
      } else {
        const initialTeachers: TeacherFeeItem[] = [
          {
            id: 'tf-1',
            name: 'استاد شاه‌فضل',
            courses: 'اصول فقه ۱ و ادبیات عرب',
            grade: 'پایه ۷ و ۸',
            hourlyRate: 190000,
            totalHours: 36,
            bonusAmount: 300000,
            deductions: 0,
            status: 'approved',
            bankAccount: '۶۰۳۷-۹۹۱۱-۴۴۳۳-۲۲۱۱',
            bankSheba: 'IR450120000000001234567811',
            notes: 'ارائه منظم طرح درس و آزمون‌های کلاسی'
          },
          {
            id: 'tf-2',
            name: 'حجت‌الاسلام شاپوری',
            courses: 'لمعه دمشقیه (کتاب الصوم و الصلاة)',
            grade: 'پایه ۸ و ۹',
            hourlyRate: 200000,
            totalHours: 40,
            bonusAmount: 400000,
            deductions: 0,
            status: 'approved',
            bankAccount: '۶۰۳۷-۹۹۱۱-۷۷۸۸-۹۹۰۰',
            bankSheba: 'IR450120000000001234567812',
            notes: 'برگزاری کارگاه‌های کاربردی متون فقهی'
          },
          {
            id: 'tf-3',
            name: 'استاد ابراهیمی',
            courses: 'منطق مظفر و بدایة الحکمة',
            grade: 'پایه ۷ و ۹',
            hourlyRate: 180000,
            totalHours: 28,
            bonusAmount: 0,
            deductions: 0,
            status: 'pending',
            bankAccount: '۶۰۳۷-۹۹۱۱-۱۱۲۲-۳۳۴۴',
            bankSheba: 'IR450120000000001234567813',
            notes: 'در انتظار تکمیل فرم حضور و غیاب پایان ماه'
          },
          {
            id: 'tf-4',
            name: 'حجت‌الاسلام والمسلمین جوادی',
            courses: 'مکاسب محرمه و رسائل',
            grade: 'پایه ۱۰',
            hourlyRate: 220000,
            totalHours: 34,
            bonusAmount: 500000,
            deductions: 0,
            status: 'paid',
            bankAccount: '۶۰۳۷-۹۹۱۱-۶۶۵۵-۴۴۳۳',
            bankSheba: 'IR450120000000001234567814',
            notes: 'تسویه با حواله بانکی به شماره رهگیری ۹۸۴۱۱۲'
          }
        ];
        for (const item of initialTeachers) {
          await localDb.setDoc('finance_teachers_fees', item);
        }
        setTeachers(initialTeachers);
      }
    } catch (e) {
      console.error('Error loading teachers compensation data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter teachers
  const filteredTeachers = useMemo(() => {
    return teachers.filter(t => {
      const matchSearch = (t.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.courses || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.grade || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.bankAccount || '').includes(searchQuery);
      const matchStatus = selectedStatusFilter === 'all' || t.status === selectedStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [teachers, searchQuery, selectedStatusFilter]);

  const calculateNetPayable = (t: TeacherFeeItem) => {
    const gross = (t.totalHours || 0) * (t.hourlyRate || 0);
    const bonus = t.bonusAmount || 0;
    const ded = t.deductions || 0;
    return gross + bonus - ded;
  };

  const metrics = useMemo(() => {
    const totalCount = teachers.length;
    const totalHours = teachers.reduce((acc, t) => acc + (t.totalHours || 0), 0);
    const totalPayable = teachers.reduce((acc, t) => acc + calculateNetPayable(t), 0);
    const paidSum = teachers
      .filter(t => t.status === 'paid')
      .reduce((acc, t) => acc + calculateNetPayable(t), 0);

    return {
      totalCount,
      totalHours,
      totalPayable,
      paidSum
    };
  }, [teachers]);

  // Acknowledge report
  const handleAcknowledgeReport = async (rep: PresenceReport) => {
    const updated = { ...rep, status: 'received' as const };
    await localDb.setDoc('presence_reports', updated);
    setReports(prev => prev.map(r => r.id === rep.id ? updated : r));

    // Check if teacher already exists in fees list
    const existing = teachers.find(t => t.name.trim() === rep.teacherName.trim());
    if (existing) {
      const updatedTeacher = {
        ...existing,
        totalHours: (existing.totalHours || 0) + (rep.totalHours || 0),
        status: 'approved' as const
      };
      await localDb.setDoc('finance_teachers_fees', updatedTeacher);
      setTeachers(prev => prev.map(t => t.id === existing.id ? updatedTeacher : t));
    } else {
      const newTeacher: TeacherFeeItem = {
        id: `tf-${Date.now()}`,
        name: rep.teacherName,
        courses: rep.grade ? `دروس ${rep.grade}` : 'دروس حوزوی',
        grade: rep.grade || 'عمومی',
        hourlyRate: defaultHourlyRate,
        totalHours: rep.totalHours || 0,
        bonusAmount: 0,
        deductions: 0,
        status: 'approved',
        bankAccount: '',
        notes: rep.notes || 'اضافه شده از طریق گزارش کارکرد استاد'
      };
      await localDb.setDoc('finance_teachers_fees', newTeacher);
      setTeachers(prev => [newTeacher, ...prev]);
    }

    showToast(`گزارش کارکرد استاد ${rep.teacherName} تایید و به لیست پرداخت افزوده شد.`);
  };

  // Add manual teaching hours
  const handleAddManualTeaching = async () => {
    if (!newTeacherName.trim()) {
      alert('لطفاً نام استاد را وارد کنید.');
      return;
    }
    const newDoc: TeacherFeeItem = {
      id: `tf-${Date.now()}`,
      name: newTeacherName.trim(),
      courses: newTeacherCourse,
      grade: newTeacherGrade,
      hourlyRate: Number(newTeacherHourlyRate) || defaultHourlyRate,
      totalHours: Number(newTeacherHours) || 0,
      bonusAmount: 0,
      deductions: 0,
      status: 'approved',
      bankAccount: newTeacherAccount,
      notes: newTeacherNotes,
      lastUpdated: new Date().toISOString()
    };
    await localDb.setDoc('finance_teachers_fees', newDoc);
    setTeachers(prev => [newDoc, ...prev]);
    showToast(`کارکرد آموزشی استاد ${newTeacherName} با موفقیت ثبت شد.`);
    setIsAddTeachingHoursOpen(false);
    setNewTeacherName('');
    setNewTeacherAccount('');
    setNewTeacherNotes('');
  };

  // Toggle status
  const handleToggleStatus = async (teacher: TeacherFeeItem) => {
    let nextStatus: TeacherFeeItem['status'] = 'pending';
    if (teacher.status === 'pending') nextStatus = 'approved';
    else if (teacher.status === 'approved') nextStatus = 'paid';
    else nextStatus = 'approved';

    const updated = { ...teacher, status: nextStatus };
    await localDb.setDoc('finance_teachers_fees', updated);
    setTeachers(prev => prev.map(t => t.id === teacher.id ? updated : t));
    showToast(`وضعیت استاد ${teacher.name} به "${nextStatus === 'paid' ? 'تسویه شده' : nextStatus === 'approved' ? 'تایید و آماده پرداخت' : 'در انتظار'}" تغییر یافت.`);
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!editingTeacher) return;
    await localDb.setDoc('finance_teachers_fees', {
      ...editingTeacher,
      lastUpdated: new Date().toISOString()
    });
    setTeachers(prev => prev.map(t => t.id === editingTeacher.id ? editingTeacher : t));
    showToast(`اطلاعات حق‌الزحمه استاد ${editingTeacher.name} با موفقیت ذخیره شد.`);
    setEditingTeacher(null);
  };

  // Export Excel
  const handleExportExcel = () => {
    const data = filteredTeachers.map((t, idx) => ({
      'ردیف': idx + 1,
      'نام و نام خانوادگی استاد': t.name,
      'عنوان دروس تدریس شده': t.courses,
      'پایه تحصیلی': t.grade,
      'مجموع ساعات تدریس': t.totalHours,
      'نرخ مصوب هر ساعت (تومان)': t.hourlyRate,
      'مبلغ حق‌التدریس (تومان)': t.totalHours * t.hourlyRate,
      'پاداش تدریس (تومان)': t.bonusAmount || 0,
      'کسورات (تومان)': t.deductions || 0,
      'خالص قابل پرداخت (تومان)': calculateNetPayable(t),
      'وضعیت': t.status === 'paid' ? 'تسویه شده' : t.status === 'approved' ? 'تایید و آماده پرداخت' : 'در انتظار تایید',
      'شماره حساب / شبا': t.bankAccount || '',
      'یادداشت': t.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'حق‌الزحمه اساتید');
    XLSX.writeFile(wb, `حق_الزحمه_اساتید_${selectedPeriod.replace(/\s+/g, '_')}.xlsx`);
    showToast('فایل اکسل حق‌الزحمه اساتید صادر گردید.');
  };

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-3 font-vazir" dir="rtl">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-bold">در حال بارگذاری اطلاعات حق‌الزحمه اساتید...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-vazir" dir="rtl">
      {/* Toast */}
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

      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shadow-xs border border-emerald-100">
            <Clock size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900">محاسبه حق‌الزحمه اساتید</h1>
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-black rounded-lg">
                حق‌التدریس و جلسات درسی
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              بررسی و تایید گزارش‌های ساعات تدریس، محاسبه دقیق حق‌التدریس بر مبنای نرخ ساعتی مصوب و صدور حواله‌های بانکی
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet size={15} />
            <span>خروجی اکسل اساتید</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddTeachingHoursOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} />
            <span>ثبت کارکرد دستی استاد</span>
          </button>
        </div>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">تعداد اساتید و مدرسین</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Users size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {metrics.totalCount} <span className="text-xs font-medium text-slate-500">استاد</span>
          </div>
          <p className="text-[11px] text-slate-400">مدرسین فقه، اصول، فلسفه و ادبیات</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">مجموع ساعات تدریس ثبت‌شده</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {metrics.totalHours} <span className="text-xs font-medium text-slate-500">ساعت</span>
          </div>
          <p className="text-[11px] text-slate-400">جلسات رسمی طبق تقویم آموزشی</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">کل حق‌الزحمه مصوب دوره</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {metrics.totalPayable.toLocaleString('fa-IR')} <span className="text-xs font-medium text-slate-500">تومان</span>
          </div>
          <p className="text-[11px] text-slate-400">دوره محاسباتی: {selectedPeriod}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">مجموع مبالغ تسویه شده</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <CreditCard size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">
            {metrics.paidSum.toLocaleString('fa-IR')} <span className="text-xs font-medium text-slate-500">تومان</span>
          </div>
          <p className="text-[11px] text-slate-400">مانده تعهد: {(metrics.totalPayable - metrics.paidSum).toLocaleString('fa-IR')} تومان</p>
        </div>
      </div>

      {/* Reports submitted by professors Section */}
      {reports.filter(r => r.status !== 'received').length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-3xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-amber-700" />
              <h3 className="text-xs font-black text-amber-900">
                گزارش‌های تدریس ثبت‌شده توسط اساتید که نیاز به تایید دارند ({reports.filter(r => r.status !== 'received').length} مورد)
              </h3>
            </div>
            <span className="text-[11px] text-amber-700">اساتید از منوی حضور و کارکرد خود ارسال نموده‌اند</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reports.filter(r => r.status !== 'received').map(rep => (
              <div key={rep.id} className="bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs flex items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{rep.teacherName}</span>
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] rounded-md font-bold">
                      {rep.grade || 'مدرس دروس فقه'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    بازه: {rep.dateRange} • کارکرد: <strong className="text-slate-800">{rep.totalHours} ساعت</strong>
                  </div>
                  {rep.notes && (
                    <p className="text-[10px] text-slate-500 italic truncate max-w-[280px]">
                      یادداشت: {rep.notes}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleAcknowledgeReport(rep)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold shadow-xs transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Check size={13} />
                  <span>تایید و ثبت حق‌الزحمه</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Control & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی نام استاد، عنوان درس، شماره حساب..."
              className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:border-emerald-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">وضعیت:</span>
            <select
              value={selectedStatusFilter}
              onChange={(e: any) => setSelectedStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-hidden cursor-pointer"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="pending">در انتظار تایید</option>
              <option value="approved">آماده واریز</option>
              <option value="paid">تسویه شده</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">دوره:</span>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-hidden cursor-pointer"
            >
              <option value="شهریور و مهر ۱۴۰۳">شهریور و مهر ۱۴۰۳</option>
              <option value="آبان ۱۴۰۳">آبان ۱۴۰۳</option>
              <option value="آذر ۱۴۰۳">آذر ۱۴۰۳</option>
              <option value="دی ۱۴۰۳">دی ۱۴۰۳</option>
            </select>
          </div>
        </div>

        <div className="text-xs font-bold text-slate-500">
          فرمول: <span className="font-mono text-emerald-700 font-black">حق‌الزحمه = (ساعات تدریس × نرخ ساعتی) + پاداش - کسورات</span>
        </div>
      </div>

      {/* Main Teachers Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                <th className="p-3.5">نام استاد</th>
                <th className="p-3.5">دروس تدریس شده</th>
                <th className="p-3.5 text-center">پایه</th>
                <th className="p-3.5 text-center">ساعات تدریس</th>
                <th className="p-3.5 text-center">نرخ ساعتی</th>
                <th className="p-3.5 text-center">مبلغ ناخالص</th>
                <th className="p-3.5 text-center text-emerald-800">پاداش</th>
                <th className="p-3.5 text-center text-rose-700">کسورات</th>
                <th className="p-3.5 text-center font-black text-slate-900 bg-slate-200/50">خالص پرداختی</th>
                <th className="p-3.5 text-center">وضعیت</th>
                <th className="p-3.5 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-10 text-center text-slate-400 font-bold">
                    موردی مطابق با فیلترها و جستجوی شما یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredTeachers.map(t => {
                  const gross = (t.totalHours || 0) * (t.hourlyRate || 0);
                  const net = calculateNetPayable(t);

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{t.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {t.bankAccount || 'فاقد شماره حساب'}
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-700 max-w-[200px] truncate" title={t.courses}>
                        {t.courses}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-bold text-[10px]">
                          {t.grade}
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-mono font-black text-indigo-900">
                        {t.totalHours} ساعت
                      </td>
                      <td className="p-3.5 text-center font-mono text-slate-600">
                        {t.hourlyRate.toLocaleString('fa-IR')}
                      </td>
                      <td className="p-3.5 text-center font-mono text-slate-800">
                        {gross.toLocaleString('fa-IR')}
                      </td>
                      <td className="p-3.5 text-center font-mono text-emerald-700 font-bold">
                        +{t.bonusAmount ? t.bonusAmount.toLocaleString('fa-IR') : '۰'}
                      </td>
                      <td className="p-3.5 text-center font-mono text-rose-600 font-bold">
                        -{t.deductions ? t.deductions.toLocaleString('fa-IR') : '۰'}
                      </td>
                      <td className="p-3.5 text-center font-mono font-black text-emerald-800 text-sm bg-emerald-50/40">
                        {net.toLocaleString('fa-IR')} تومان
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(t)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer transition-all",
                            t.status === 'paid' 
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200" 
                              : t.status === 'approved'
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          )}
                        >
                          {t.status === 'paid' ? 'تسویه شده' : t.status === 'approved' ? 'آماده واریز' : 'در انتظار'}
                        </button>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSlipTeacher(t)}
                            title="مشاهده فیش حق‌التدریس"
                            className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
                          >
                            <Printer size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTeacher(t)}
                            title="ویرایش ساعات و نرخ"
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                          >
                            <Edit3 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slip Modal */}
      {slipTeacher && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">فیش پرداخت حق‌التدریس استاد</h3>
                <span className="text-[11px] text-slate-400">حوزه علمیه و مرکز تخصصی فقه و اصول</span>
              </div>
              <button
                type="button"
                onClick={() => setSlipTeacher(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">نام استاد:</span>
                <span className="font-black text-slate-900">{slipTeacher.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">عناوین درسی:</span>
                <span className="font-bold text-slate-800">{slipTeacher.courses}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">دوره محاسباتی:</span>
                <span className="font-bold text-slate-700">{selectedPeriod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">شماره حساب و شبا:</span>
                <span className="font-mono text-slate-700 text-[11px]">{slipTeacher.bankAccount || '---'}</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl p-3 space-y-2 text-xs divide-y divide-slate-100">
              <div className="flex justify-between pt-1">
                <span className="text-slate-600">۱. حق‌التدریس ({slipTeacher.totalHours} ساعت × {slipTeacher.hourlyRate.toLocaleString('fa-IR')}):</span>
                <span className="font-mono font-bold text-slate-800">
                  {((slipTeacher.totalHours || 0) * (slipTeacher.hourlyRate || 0)).toLocaleString('fa-IR')} ت
                </span>
              </div>
              {slipTeacher.bonusAmount ? (
                <div className="flex justify-between pt-1">
                  <span className="text-emerald-700 font-bold">۲. پاداش و تشویقی تدریس:</span>
                  <span className="font-mono font-bold text-emerald-700">+{slipTeacher.bonusAmount.toLocaleString('fa-IR')} ت</span>
                </div>
              ) : null}
              {slipTeacher.deductions ? (
                <div className="flex justify-between pt-1">
                  <span className="text-rose-600 font-bold">۳. کسورات:</span>
                  <span className="font-mono font-bold text-rose-600">-{slipTeacher.deductions.toLocaleString('fa-IR')} ت</span>
                </div>
              ) : null}
            </div>

            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between text-xs font-bold">
              <span className="text-emerald-900">خالص پرداختی:</span>
              <span className="text-lg font-black font-mono text-emerald-800">
                {calculateNetPayable(slipTeacher).toLocaleString('fa-IR')} تومان
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} />
                <span>چاپ فیش</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingTeacher && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Edit3 size={16} className="text-emerald-600" />
                <span>ویرایش کارکرد و حق‌الزحمه: {editingTeacher.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingTeacher(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-600 font-bold">ساعات تدریس در دوره:</label>
                <input
                  type="number"
                  value={editingTeacher.totalHours}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, totalHours: Number(e.target.value) })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 font-bold">نرخ مصوب ساعتی (تومان):</label>
                <input
                  type="number"
                  value={editingTeacher.hourlyRate}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, hourlyRate: Number(e.target.value) })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 font-bold">پاداش یا فوق‌العاده (تومان):</label>
                <input
                  type="number"
                  value={editingTeacher.bonusAmount || 0}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, bonusAmount: Number(e.target.value) })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-emerald-700"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 font-bold">کسورات (تومان):</label>
                <input
                  type="number"
                  value={editingTeacher.deductions || 0}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, deductions: Number(e.target.value) })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-rose-600"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-slate-600 font-bold">شماره کارت یا شبا:</label>
                <input
                  type="text"
                  value={editingTeacher.bankAccount || ''}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, bankAccount: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                />
              </div>
            </div>

            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between text-xs font-bold">
              <span className="text-emerald-900">خالص محاسبه‌شده جدید:</span>
              <span className="text-base font-black font-mono text-emerald-800">
                {calculateNetPayable(editingTeacher).toLocaleString('fa-IR')} تومان
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingTeacher(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                ذخیره تغییرات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Manual Teaching Hours Modal */}
      {isAddTeachingHoursOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Plus size={16} className="text-emerald-600" />
                <span>ثبت کارکرد دستی استاد / مدرس مدعو</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddTeachingHoursOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-600 font-bold">نام و عنوان استاد:</label>
                <input
                  type="text"
                  value={newTeacherName}
                  onChange={(e) => setNewTeacherName(e.target.value)}
                  placeholder="مثلاً: حجت‌الاسلام والمسلمین طباطبایی"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-600 font-bold">عنوان درس:</label>
                  <input
                    type="text"
                    value={newTeacherCourse}
                    onChange={(e) => setNewTeacherCourse(e.target.value)}
                    placeholder="مثلاً: تفسیر قرآن کریم"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-600 font-bold">پایه تحصیلی:</label>
                  <input
                    type="text"
                    value={newTeacherGrade}
                    onChange={(e) => setNewTeacherGrade(e.target.value)}
                    placeholder="مثلاً: پایه ۸ و ۹"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-600 font-bold">ساعات تدریس:</label>
                  <input
                    type="number"
                    value={newTeacherHours}
                    onChange={(e) => setNewTeacherHours(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-600 font-bold">نرخ هر ساعت تدریس (تومان):</label>
                  <input
                    type="number"
                    value={newTeacherHourlyRate}
                    onChange={(e) => setNewTeacherHourlyRate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 font-bold">شماره کارت / حساب بانکی:</label>
                <input
                  type="text"
                  value={newTeacherAccount}
                  onChange={(e) => setNewTeacherAccount(e.target.value)}
                  placeholder="۶۰۳۷-..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 font-bold">یادداشت و جزئیات:</label>
                <input
                  type="text"
                  value={newTeacherNotes}
                  onChange={(e) => setNewTeacherNotes(e.target.value)}
                  placeholder="توضیحات تکمیلی..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddTeachingHoursOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleAddManualTeaching}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                ثبت کارکرد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
