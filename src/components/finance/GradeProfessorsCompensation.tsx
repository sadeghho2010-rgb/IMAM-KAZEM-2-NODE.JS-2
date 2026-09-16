import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, 
  Award, 
  Users, 
  Clock, 
  Download, 
  Printer, 
  Search, 
  Plus, 
  Check, 
  X, 
  SlidersHorizontal, 
  CheckCircle2, 
  DollarSign, 
  Calendar, 
  Edit3, 
  Eye, 
  FileSpreadsheet,
  Building2,
  HelpCircle,
  TrendingUp,
  CreditCard
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { getTodayShamsi } from '../../lib/jalali';
import { motion, AnimatePresence } from 'motion/react';

interface GradeMentorItem {
  id: string;
  name: string;
  grade: string;
  baseMentoringFee: number; // حق سرپرستی پایه (تومان)
  hourlyRate: number; // نرخ ساعتی پیگیری و مشاوره
  totalHours: number; // ساعات پیگیری و مشاوره در دوره
  bonusAmount?: number; // پاداش فعالیت ویژه پایه
  deductions?: number; // کسورات
  bankAccount: string;
  bankSheba?: string;
  status?: 'pending' | 'approved' | 'paid';
  notes?: string;
  lastUpdated?: string;
}

interface GradeProfessorsCompensationProps {
  onNavigateTab?: (tab: string, params?: any) => void;
}

export default function GradeProfessorsCompensation({ onNavigateTab }: GradeProfessorsCompensationProps) {
  const { currentUser } = useAuth();

  const [mentors, setMentors] = useState<GradeMentorItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('شهریور و مهر ۱۴۰۳');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('all');
  const [toastMessage, setToastMessage] = useState('');

  // Modals
  const [editingMentor, setEditingMentor] = useState<GradeMentorItem | null>(null);
  const [slipMentor, setSlipMentor] = useState<GradeMentorItem | null>(null);
  const [isAddMentorOpen, setIsAddMentorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // New mentor form state
  const [newMentorName, setNewMentorName] = useState('');
  const [newMentorGrade, setNewMentorGrade] = useState('پایه ۷');
  const [newMentorBaseFee, setNewMentorBaseFee] = useState('4000000');
  const [newMentorHourlyRate, setNewMentorHourlyRate] = useState('150000');
  const [newMentorHours, setNewMentorHours] = useState('25');
  const [newMentorAccount, setNewMentorAccount] = useState('');
  const [newMentorSheba, setNewMentorSheba] = useState('');

  // Default rate settings
  const [defaultBaseFee, setDefaultBaseFee] = useState(4000000);
  const [defaultHourlyRate, setDefaultHourlyRate] = useState(150000);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const loadMentorsData = async () => {
    setIsLoading(true);
    try {
      const stored = await localDb.getDocs<GradeMentorItem>('finance_grade_mentors');
      if (stored && stored.length > 0) {
        setMentors(stored);
      } else {
        const initialData: GradeMentorItem[] = [
          {
            id: 'gm-1',
            name: 'حجت‌الاسلام والمسلمین موسوی',
            grade: 'پایه ۷',
            baseMentoringFee: 4500000,
            hourlyRate: 160000,
            totalHours: 26,
            bonusAmount: 300000,
            deductions: 0,
            bankAccount: '۶۰۳۷-۹۹۱۱-۲۲۳۳-۴۴۵۵',
            bankSheba: 'IR120120000000001234567801',
            status: 'approved',
            notes: 'پیگیری منظم جلسات مباحثه و ارزیابی هفتگی طلاب پایه ۷'
          },
          {
            id: 'gm-2',
            name: 'استاد رضایی',
            grade: 'پایه ۸',
            baseMentoringFee: 4500000,
            hourlyRate: 160000,
            totalHours: 30,
            bonusAmount: 0,
            deductions: 0,
            bankAccount: '۶۰۳۷-۹۹۱۱-۵۵۶۶-۷۷۸۸',
            bankSheba: 'IR120120000000001234567802',
            status: 'approved',
            notes: 'رسیدگی به وضعیت درسی و نظارت بر حضور و غیاب پایه ۸'
          },
          {
            id: 'gm-3',
            name: 'حجت‌الاسلام کریمی',
            grade: 'پایه ۹',
            baseMentoringFee: 4800000,
            hourlyRate: 170000,
            totalHours: 28,
            bonusAmount: 400000,
            deductions: 100000,
            bankAccount: '۶۰۳۷-۹۹۱۱-۹۹۰۰-۱۱۲۲',
            bankSheba: 'IR120120000000001234567803',
            status: 'approved',
            notes: 'مشاوره‌های تحصیلی و ارزیابی پژوهشی طلاب پایه ۹'
          },
          {
            id: 'gm-4',
            name: 'استاد فلاحتی',
            grade: 'پایه ۱۰',
            baseMentoringFee: 5000000,
            hourlyRate: 180000,
            totalHours: 32,
            bonusAmount: 500000,
            deductions: 0,
            bankAccount: '۶۰۳۷-۹۹۱۱-۳۳۴۴-۵۵۶۶',
            bankSheba: 'IR120120000000001234567804',
            status: 'approved',
            notes: 'پیگیری امتحانات شفاهی و ساماندهی درس خارج طلاب پایه ۱۰'
          }
        ];
        for (const item of initialData) {
          await localDb.setDoc('finance_grade_mentors', item);
        }
        setMentors(initialData);
      }
    } catch (e) {
      console.error('Error loading grade mentors data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMentorsData();
  }, []);

  // Filtered mentors
  const filteredMentors = useMemo(() => {
    return mentors.filter(m => {
      const matchSearch = (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.grade || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.bankAccount || '').includes(searchQuery);
      const matchGrade = selectedGradeFilter === 'all' || m.grade === selectedGradeFilter;
      return matchSearch && matchGrade;
    });
  }, [mentors, searchQuery, selectedGradeFilter]);

  // Calculations
  const calculateTotal = (m: GradeMentorItem) => {
    const hourlyPart = (m.totalHours || 0) * (m.hourlyRate || 0);
    const basePart = m.baseMentoringFee || 0;
    const bonus = m.bonusAmount || 0;
    const ded = m.deductions || 0;
    return basePart + hourlyPart + bonus - ded;
  };

  const metrics = useMemo(() => {
    const count = mentors.length;
    const totalHours = mentors.reduce((acc, m) => acc + (m.totalHours || 0), 0);
    const totalPayable = mentors.reduce((acc, m) => acc + calculateTotal(m), 0);
    const paidCount = mentors.filter(m => m.status === 'paid').length;
    return { count, totalHours, totalPayable, paidCount };
  }, [mentors]);

  // Save edit
  const handleSaveEdit = async () => {
    if (!editingMentor) return;
    await localDb.setDoc('finance_grade_mentors', {
      ...editingMentor,
      lastUpdated: new Date().toISOString()
    });
    setMentors(prev => prev.map(m => m.id === editingMentor.id ? editingMentor : m));
    showToast(`اطلاعات و ارقام حق‌الزحمه استاد ${editingMentor.name} بروزرسانی شد.`);
    setEditingMentor(null);
  };

  // Add new mentor
  const handleAddMentor = async () => {
    if (!newMentorName.trim()) {
      alert('لطفاً نام استاد پایه را وارد کنید.');
      return;
    }
    const newDoc: GradeMentorItem = {
      id: `gm-${Date.now()}`,
      name: newMentorName.trim(),
      grade: newMentorGrade,
      baseMentoringFee: Number(newMentorBaseFee) || defaultBaseFee,
      hourlyRate: Number(newMentorHourlyRate) || defaultHourlyRate,
      totalHours: Number(newMentorHours) || 0,
      bonusAmount: 0,
      deductions: 0,
      bankAccount: newMentorAccount,
      bankSheba: newMentorSheba,
      status: 'approved',
      lastUpdated: new Date().toISOString()
    };
    await localDb.setDoc('finance_grade_mentors', newDoc);
    setMentors(prev => [...prev, newDoc]);
    showToast(`استاد پایه جدید (${newMentorName}) با موفقیت ثبت شد.`);
    setIsAddMentorOpen(false);
    setNewMentorName('');
    setNewMentorAccount('');
    setNewMentorSheba('');
  };

  // Toggle status
  const handleToggleStatus = async (mentor: GradeMentorItem) => {
    const nextStatus: GradeMentorItem['status'] = mentor.status === 'paid' ? 'approved' : 'paid';
    const updated = { ...mentor, status: nextStatus };
    await localDb.setDoc('finance_grade_mentors', updated);
    setMentors(prev => prev.map(m => m.id === mentor.id ? updated : m));
    showToast(`وضعیت پرداخت استاد ${mentor.name} به "${nextStatus === 'paid' ? 'واریز شده' : 'آماده پرداخت'}" تغییر یافت.`);
  };

  // Export Excel
  const handleExportExcel = () => {
    const data = filteredMentors.map((m, idx) => ({
      'ردیف': idx + 1,
      'نام و نام خانوادگی استاد پایه': m.name,
      'پایه تحصیلی': m.grade,
      'حق سرپرستی پایه (تومان)': m.baseMentoringFee,
      'ساعات مشاوره و پیگیری': m.totalHours,
      'نرخ ساعتی (تومان)': m.hourlyRate,
      'مبلغ حق پیگیری ساعتی (تومان)': m.totalHours * m.hourlyRate,
      'پاداش عملکرد (تومان)': m.bonusAmount || 0,
      'کسورات (تومان)': m.deductions || 0,
      'خالص دریافتی ماهانه (تومان)': calculateTotal(m),
      'وضعیت': m.status === 'paid' ? 'واریز شده' : 'در انتظار پرداخت',
      'شماره کارت / حساب': m.bankAccount || '',
      'شماره شبا': m.bankSheba || '',
      'یادداشت': m.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'حق‌الزحمه اساتید پایه');
    XLSX.writeFile(wb, `حق_الزحمه_اساتید_پایه_${selectedPeriod.replace(/\s+/g, '_')}.xlsx`);
    showToast('فایل اکسل حق‌الزحمه اساتید پایه با موفقیت صادر گردید.');
  };

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-3 font-vazir" dir="rtl">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-bold">در حال بارگذاری اطلاعات حق‌الزحمه اساتید پایه...</p>
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
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center shadow-xs border border-indigo-100">
            <BookOpen size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900">محاسبه حق‌الزحمه اساتید پایه</h1>
              <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 border border-indigo-200 text-[11px] font-black rounded-lg">
                امور اساتید راهنما و پایه
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              محاسبه مکانیزه بر مبنای حق سرپرستی پایه، ساعات مشاوره و پیگیری طلاب، نرخ مصوب ساعتی و صدور فیش پرداخت
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
            <span>خروجی اکسل اساتید پایه</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddMentorOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} />
            <span>ثبت استاد پایه جدید</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">تعداد اساتید پایه</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Users size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {metrics.count} <span className="text-xs font-medium text-slate-500">استاد</span>
          </div>
          <p className="text-[11px] text-slate-400">مسئولیت پایه‌های تحصیلی ۷ تا ۱۰</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">مجموع ساعات مشاوره و پیگیری</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {metrics.totalHours} <span className="text-xs font-medium text-slate-500">ساعت</span>
          </div>
          <p className="text-[11px] text-slate-400">میانگین {(metrics.totalHours / (metrics.count || 1)).toFixed(1)} ساعت برای هر استاد</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">کل حق‌الزحمه قابل پرداخت</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">
            {metrics.totalPayable.toLocaleString('fa-IR')} <span className="text-xs font-medium text-emerald-600">تومان</span>
          </div>
          <p className="text-[11px] text-slate-400">دوره: {selectedPeriod}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">وضعیت تسویه و واریز</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <CreditCard size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {metrics.paidCount} از {metrics.count} <span className="text-xs font-medium text-slate-500">پرداخت شده</span>
          </div>
          <p className="text-[11px] text-slate-400">{metrics.count - metrics.paidCount} مورد در انتظار صدور حواله بانکی</p>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی نام استاد، پایه، شماره حساب..."
              className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">پایه:</span>
            <select
              value={selectedGradeFilter}
              onChange={(e) => setSelectedGradeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-hidden cursor-pointer"
            >
              <option value="all">همه پایه‌ها</option>
              <option value="پایه ۷">پایه ۷</option>
              <option value="پایه ۸">پایه ۸</option>
              <option value="پایه ۹">پایه ۹</option>
              <option value="پایه ۱۰">پایه ۱۰</option>
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
          فرمول: <span className="font-mono text-indigo-700 font-black">مجموع = حق پایه + (ساعت × نرخ) + پاداش - کسر</span>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                <th className="p-3.5">استاد پایه</th>
                <th className="p-3.5 text-center">پایه</th>
                <th className="p-3.5 text-center">حق سرپرستی پایه</th>
                <th className="p-3.5 text-center">ساعات پیگیری</th>
                <th className="p-3.5 text-center">نرخ ساعتی</th>
                <th className="p-3.5 text-center">مبلغ کارکرد ساعتی</th>
                <th className="p-3.5 text-center text-emerald-800">پاداش</th>
                <th className="p-3.5 text-center text-rose-700">کسورات</th>
                <th className="p-3.5 text-center font-black text-slate-900 bg-slate-200/50">خالص پرداختی ماه</th>
                <th className="p-3.5 text-center">وضعیت پرداخت</th>
                <th className="p-3.5 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMentors.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-10 text-center text-slate-400 font-bold">
                    استادی با مشخصات جستجو شده یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredMentors.map((m) => {
                  const hourlyPart = (m.totalHours || 0) * (m.hourlyRate || 0);
                  const net = calculateTotal(m);
                  const isPaid = m.status === 'paid';

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{m.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {m.bankAccount || 'شماره حساب ثبت نشده'}
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg font-bold">
                          {m.grade}
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-mono text-slate-700">
                        {m.baseMentoringFee.toLocaleString('fa-IR')}
                      </td>
                      <td className="p-3.5 text-center font-mono font-bold text-indigo-900">
                        {m.totalHours} س
                      </td>
                      <td className="p-3.5 text-center font-mono text-slate-600">
                        {m.hourlyRate.toLocaleString('fa-IR')}
                      </td>
                      <td className="p-3.5 text-center font-mono text-slate-800 font-medium">
                        {hourlyPart.toLocaleString('fa-IR')}
                      </td>
                      <td className="p-3.5 text-center font-mono text-emerald-700 font-bold">
                        +{m.bonusAmount ? m.bonusAmount.toLocaleString('fa-IR') : '۰'}
                      </td>
                      <td className="p-3.5 text-center font-mono text-rose-600 font-bold">
                        -{m.deductions ? m.deductions.toLocaleString('fa-IR') : '۰'}
                      </td>
                      <td className="p-3.5 text-center font-mono font-black text-emerald-800 text-sm bg-emerald-50/40">
                        {net.toLocaleString('fa-IR')} تومان
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(m)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer transition-all",
                            isPaid 
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200" 
                              : "bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200"
                          )}
                        >
                          {isPaid ? 'واریز شده' : 'در انتظار واریز'}
                        </button>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSlipMentor(m)}
                            title="مشاهده و چاپ فیش حق‌الزحمه"
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                          >
                            <Printer size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingMentor(m)}
                            title="ویرایش ساعات و مبالغ"
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

      {/* Edit Modal */}
      {editingMentor && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Edit3 size={16} className="text-indigo-600" />
                <span>ویرایش ارقام حق‌الزحمه: {editingMentor.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingMentor(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-600 font-bold">حق سرپرستی پایه (تومان):</label>
                <input
                  type="number"
                  value={editingMentor.baseMentoringFee}
                  onChange={(e) => setEditingMentor({ ...editingMentor, baseMentoringFee: Number(e.target.value) })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 font-bold">ساعات پیگیری و مشاوره:</label>
                <input
                  type="number"
                  value={editingMentor.totalHours}
                  onChange={(e) => setEditingMentor({ ...editingMentor, totalHours: Number(e.target.value) })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 font-bold">نرخ هر ساعت مشاوره (تومان):</label>
                <input
                  type="number"
                  value={editingMentor.hourlyRate}
                  onChange={(e) => setEditingMentor({ ...editingMentor, hourlyRate: Number(e.target.value) })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 font-bold">پاداش عملکرد (تومان):</label>
                <input
                  type="number"
                  value={editingMentor.bonusAmount || 0}
                  onChange={(e) => setEditingMentor({ ...editingMentor, bonusAmount: Number(e.target.value) })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-emerald-700"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 font-bold">کسورات (تومان):</label>
                <input
                  type="number"
                  value={editingMentor.deductions || 0}
                  onChange={(e) => setEditingMentor({ ...editingMentor, deductions: Number(e.target.value) })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-rose-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 font-bold">شماره کارت / شبا:</label>
                <input
                  type="text"
                  value={editingMentor.bankAccount || ''}
                  onChange={(e) => setEditingMentor({ ...editingMentor, bankAccount: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-slate-600 font-bold">یادداشت و توضیحات:</label>
                <input
                  type="text"
                  value={editingMentor.notes || ''}
                  onChange={(e) => setEditingMentor({ ...editingMentor, notes: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>
            </div>

            {/* Live Net Preview */}
            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between text-xs font-bold">
              <span className="text-emerald-900">خالص محاسبه‌شده قابل پرداخت:</span>
              <span className="text-base font-black font-mono text-emerald-800">
                {calculateTotal(editingMentor).toLocaleString('fa-IR')} تومان
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingMentor(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                ثبت و ذخیره تغییرات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Payment Slip Modal */}
      {slipMentor && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">فیش پرداخت حق‌الزحمه استاد پایه</h3>
                <span className="text-[11px] text-slate-400">حوزه علمیه و مدرسه تخصصی طلاب</span>
              </div>
              <button
                type="button"
                onClick={() => setSlipMentor(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">نام استاد:</span>
                <span className="font-black text-slate-900">{slipMentor.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">پایه تحصیلی مربوطه:</span>
                <span className="font-bold text-indigo-700">{slipMentor.grade}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">دوره محاسباتی:</span>
                <span className="font-bold text-slate-700">{selectedPeriod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">شماره حساب / شبا:</span>
                <span className="font-mono text-slate-700 text-[11px]">{slipMentor.bankAccount}</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl p-3 space-y-2 text-xs divide-y divide-slate-100">
              <div className="flex justify-between pt-1">
                <span className="text-slate-600">۱. حق سرپرستی و مسئولیت پایه:</span>
                <span className="font-mono font-bold text-slate-800">{slipMentor.baseMentoringFee.toLocaleString('fa-IR')} ت</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-600">۲. حق پیگیری ({slipMentor.totalHours} ساعت × {slipMentor.hourlyRate.toLocaleString('fa-IR')}):</span>
                <span className="font-mono font-bold text-slate-800">
                  {((slipMentor.totalHours || 0) * (slipMentor.hourlyRate || 0)).toLocaleString('fa-IR')} ت
                </span>
              </div>
              {slipMentor.bonusAmount ? (
                <div className="flex justify-between pt-1">
                  <span className="text-emerald-700 font-bold">۳. پاداش ویژه عملکرد:</span>
                  <span className="font-mono font-bold text-emerald-700">+{slipMentor.bonusAmount.toLocaleString('fa-IR')} ت</span>
                </div>
              ) : null}
              {slipMentor.deductions ? (
                <div className="flex justify-between pt-1">
                  <span className="text-rose-600 font-bold">۴. کسورات قانونی:</span>
                  <span className="font-mono font-bold text-rose-600">-{slipMentor.deductions.toLocaleString('fa-IR')} ت</span>
                </div>
              ) : null}
            </div>

            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between text-xs font-bold">
              <span className="text-emerald-900">مبلغ خالص پرداختی:</span>
              <span className="text-lg font-black font-mono text-emerald-800">
                {calculateTotal(slipMentor).toLocaleString('fa-IR')} تومان
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

      {/* Add New Mentor Modal */}
      {isAddMentorOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Plus size={16} className="text-indigo-600" />
                <span>ثبت مشخصات استاد پایه جدید</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddMentorOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-600 font-bold">نام و نام خانوادگی استاد:</label>
                <input
                  type="text"
                  value={newMentorName}
                  onChange={(e) => setNewMentorName(e.target.value)}
                  placeholder="مثلاً: حجت‌الاسلام حسینی"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-600 font-bold">پایه تحصیلی:</label>
                  <select
                    value={newMentorGrade}
                    onChange={(e) => setNewMentorGrade(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold"
                  >
                    <option value="پایه ۷">پایه ۷</option>
                    <option value="پایه ۸">پایه ۸</option>
                    <option value="پایه ۹">پایه ۹</option>
                    <option value="پایه ۱۰">پایه ۱۰</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-600 font-bold">ساعات پیگیری ماه:</label>
                  <input
                    type="number"
                    value={newMentorHours}
                    onChange={(e) => setNewMentorHours(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-600 font-bold">حق سرپرستی پایه (تومان):</label>
                  <input
                    type="number"
                    value={newMentorBaseFee}
                    onChange={(e) => setNewMentorBaseFee(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-600 font-bold">نرخ ساعتی مشاوره (تومان):</label>
                  <input
                    type="number"
                    value={newMentorHourlyRate}
                    onChange={(e) => setNewMentorHourlyRate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 font-bold">شماره کارت یا حساب بانکی:</label>
                <input
                  type="text"
                  value={newMentorAccount}
                  onChange={(e) => setNewMentorAccount(e.target.value)}
                  placeholder="۶۰۳۷-..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddMentorOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleAddMentor}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                افزودن استاد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
