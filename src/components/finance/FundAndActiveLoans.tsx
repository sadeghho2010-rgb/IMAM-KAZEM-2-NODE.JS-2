import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Wallet, 
  DollarSign, 
  Users, 
  Plus, 
  FileSpreadsheet, 
  Search, 
  Check, 
  X, 
  CheckCircle2, 
  Clock, 
  CreditCard, 
  Printer, 
  ShieldCheck, 
  AlertCircle,
  HelpCircle,
  PiggyBank,
  TrendingUp,
  Receipt,
  FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { getTodayShamsi } from '../../lib/jalali';
import { motion, AnimatePresence } from 'motion/react';
import { Student } from '../../types';

interface LoanItem {
  id: string;
  studentId: string;
  studentName: string;
  nationalId: string;
  grade: string;
  totalAmount: number; // کل مبلغ وام (تومان)
  totalInstallments: number; // تعداد کل اقساط
  monthlyInstallment: number; // قسط ماهانه (تومان)
  paidInstallments: number; // اقساط پرداخت / کسر شده
  remainingBalance: number; // مانده بدهی
  startDate: string; // تاریخ اعطا
  purpose: string; // علت: درمان، ضروری، مسکن، ازدواج...
  status: 'active' | 'settled';
  guarantorName?: string; // ضامن
  notes?: string;
  installmentHistory?: { date: string; amount: number; method: string }[];
}

interface FundContributionItem {
  id: string;
  studentId: string;
  studentName: string;
  nationalId: string;
  grade: string;
  monthlyContribution: number; // پس‌انداز ماهانه (تومان)
  totalAccumulatedSavings: number; // کل موجودی پس‌انداز طلبه در صندوق
  status: 'active' | 'paused';
}

interface FundAndActiveLoansProps {
  onNavigateTab?: (tab: string, params?: any) => void;
}

export default function FundAndActiveLoans({ onNavigateTab }: FundAndActiveLoansProps) {
  const { currentUser } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<'loans' | 'savings_fund'>('loans');
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [contributions, setContributions] = useState<FundContributionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'settled'>('active');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('all');
  const [toastMessage, setToastMessage] = useState('');

  // Modals
  const [isAddLoanOpen, setIsAddLoanOpen] = useState(false);
  const [selectedLoanBooklet, setSelectedLoanBooklet] = useState<LoanItem | null>(null);
  const [isDepositToFundOpen, setIsDepositToFundOpen] = useState(false);

  // Fund Capital Summary State
  const [fundCashBalance, setFundCashBalance] = useState(145000000); // موجودی نقد صندوق

  // New Loan Form
  const [newStudentName, setNewStudentName] = useState('');
  const [newNationalId, setNewNationalId] = useState('');
  const [newGrade, setNewGrade] = useState('پایه ۷');
  const [newLoanAmount, setNewLoanAmount] = useState('15000000');
  const [newInstallmentsCount, setNewInstallmentsCount] = useState('10');
  const [newPurpose, setNewPurpose] = useState('ضروری و معیشتی');
  const [newGuarantor, setNewGuarantor] = useState('حجت‌الاسلام شاپوری');
  const [newNotes, setNewNotes] = useState('');

  // New Donor Deposit Form
  const [donorName, setDonorName] = useState('حاج آقا محسنی (خیر حوزه)');
  const [depositAmount, setDepositAmount] = useState('20000000');
  const [depositNotes, setDepositNotes] = useState('کمک به سرمایه در گردش صندوق قرض‌الحسنه طلاب');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [storedLoans, storedContribs] = await Promise.all([
        localDb.getDocs<LoanItem>('finance_loans'),
        localDb.getDocs<FundContributionItem>('finance_fund_contributions')
      ]);

      if (storedLoans && storedLoans.length > 0) {
        setLoans(storedLoans);
      } else {
        const initialLoans: LoanItem[] = [
          {
            id: 'loan-1',
            studentId: 'st-1',
            studentName: 'محمدحسین حسینی',
            nationalId: '1270001122',
            grade: 'پایه ۷',
            totalAmount: 12000000,
            totalInstallments: 12,
            monthlyInstallment: 1000000,
            paidInstallments: 5,
            remainingBalance: 7000000,
            startDate: '۱۴۰۳/۰۱/۱۵',
            purpose: 'تهیه کتب درسی و لپ‌تاپ پژوهشی',
            status: 'active',
            guarantorName: 'استاد فلاحتی',
            notes: 'کسر ماهانه از شهریه',
            installmentHistory: [
              { date: '۱۴۰۳/۰۲/۲۵', amount: 1000000, method: 'کسر از شهریه اردیبهشت' },
              { date: '۱۴۰۳/۰۳/۲۵', amount: 1000000, method: 'کسر از شهریه خرداد' },
              { date: '۱۴۰۳/۰۴/۲۵', amount: 1000000, method: 'کسر از شهریه تیر' },
              { date: '۱۴۰۳/۰۵/۲۵', amount: 1000000, method: 'کسر از شهریه مرداد' },
              { date: '۱۴۰۳/۰۶/۲۵', amount: 1000000, method: 'کسر از شهریه شهریور' },
            ]
          },
          {
            id: 'loan-2',
            studentId: 'st-3',
            studentName: 'مهدی کریمی',
            nationalId: '1270005566',
            grade: 'پایه ۸',
            totalAmount: 20000000,
            totalInstallments: 10,
            monthlyInstallment: 2000000,
            paidInstallments: 4,
            remainingBalance: 12000000,
            startDate: '۱۴۰۳/۰۲/۱۰',
            purpose: 'ودیعه مسکن متأهلی',
            status: 'active',
            guarantorName: 'حجت‌الاسلام موسوی',
            notes: 'کسر ماهانه از شهریه',
            installmentHistory: [
              { date: '۱۴۰۳/۰۳/۲۵', amount: 2000000, method: 'کسر از شهریه خرداد' },
              { date: '۱۴۰۳/۰۴/۲۵', amount: 2000000, method: 'کسر از شهریه تیر' },
              { date: '۱۴۰۳/۰۵/۲۵', amount: 2000000, method: 'کسر از شهریه مرداد' },
              { date: '۱۴۰۳/۰۶/۲۵', amount: 2000000, method: 'کسر از شهریه شهریور' },
            ]
          },
          {
            id: 'loan-3',
            studentId: 'st-5',
            studentName: 'امیرحسین صادقی',
            nationalId: '1270009900',
            grade: 'پایه ۹',
            totalAmount: 8000000,
            totalInstallments: 8,
            monthlyInstallment: 1000000,
            paidInstallments: 8,
            remainingBalance: 0,
            startDate: '۱۴۰۲/۰۸/۰۱',
            purpose: 'هزینه‌های درمانی و دندانپزشکی',
            status: 'settled',
            guarantorName: 'استاد رضایی',
            notes: 'تسویه کامل شده است'
          }
        ];
        for (const loan of initialLoans) {
          await localDb.setDoc('finance_loans', loan);
        }
        setLoans(initialLoans);
      }

      if (storedContribs && storedContribs.length > 0) {
        setContributions(storedContribs);
      } else {
        const initialContribs: FundContributionItem[] = [
          {
            id: 'fc-1',
            studentId: 'st-1',
            studentName: 'محمدحسین حسینی',
            nationalId: '1270001122',
            grade: 'پایه ۷',
            monthlyContribution: 100000,
            totalAccumulatedSavings: 1200000,
            status: 'active'
          },
          {
            id: 'fc-2',
            studentId: 'st-2',
            studentName: 'علی‌رضا محمدی',
            nationalId: '1270003344',
            grade: 'پایه ۷',
            monthlyContribution: 150000,
            totalAccumulatedSavings: 1800000,
            status: 'active'
          },
          {
            id: 'fc-3',
            studentId: 'st-3',
            studentName: 'مهدی کریمی',
            nationalId: '1270005566',
            grade: 'پایه ۸',
            monthlyContribution: 200000,
            totalAccumulatedSavings: 2400000,
            status: 'active'
          },
          {
            id: 'fc-4',
            studentId: 'st-4',
            studentName: 'سید رضا موسوی',
            nationalId: '1270007788',
            grade: 'پایه ۸',
            monthlyContribution: 100000,
            totalAccumulatedSavings: 1000000,
            status: 'active'
          },
          {
            id: 'fc-5',
            studentId: 'st-6',
            studentName: 'حمیدرضا نجفی',
            nationalId: '1270001234',
            grade: 'پایه ۱۰',
            monthlyContribution: 200000,
            totalAccumulatedSavings: 3600000,
            status: 'active'
          }
        ];
        for (const c of initialContribs) {
          await localDb.setDoc('finance_fund_contributions', c);
        }
        setContributions(initialContribs);
      }
    } catch (e) {
      console.error('Error loading loans & fund data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = localDb.subscribe(() => {
      loadData();
    });
    return () => unsub();
  }, []);

  // Filtered loans
  const filteredLoans = useMemo(() => {
    return loans.filter(l => {
      const matchSearch = (l.studentName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.nationalId || '').includes(searchQuery) ||
        (l.purpose || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.guarantorName || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = selectedStatusFilter === 'all' || l.status === selectedStatusFilter;
      const matchGrade = selectedGradeFilter === 'all' || l.grade === selectedGradeFilter;
      return matchSearch && matchStatus && matchGrade;
    });
  }, [loans, searchQuery, selectedStatusFilter, selectedGradeFilter]);

  const metrics = useMemo(() => {
    const activeLoans = loans.filter(l => l.status === 'active');
    const totalActiveCount = activeLoans.length;
    const totalActiveBalance = activeLoans.reduce((acc, l) => acc + (l.remainingBalance || 0), 0);
    const monthlyInstallmentsSum = activeLoans.reduce((acc, l) => acc + (l.monthlyInstallment || 0), 0);
    const totalSavingsCapital = contributions.reduce((acc, c) => acc + (c.totalAccumulatedSavings || 0), 0);

    return {
      totalActiveCount,
      totalActiveBalance,
      monthlyInstallmentsSum,
      totalSavingsCapital,
      totalFundCapital: fundCashBalance + totalActiveBalance
    };
  }, [loans, contributions, fundCashBalance]);

  // Add new loan
  const handleAddLoan = async () => {
    if (!newStudentName.trim()) {
      alert('لطفاً نام طلبه را وارد کنید.');
      return;
    }
    const amount = Number(newLoanAmount) || 10000000;
    const count = Number(newInstallmentsCount) || 10;
    const monthly = Math.round(amount / count);

    const newLoan: LoanItem = {
      id: `loan-${Date.now()}`,
      studentId: `st-${Date.now()}`,
      studentName: newStudentName.trim(),
      nationalId: newNationalId.trim() || '---',
      grade: newGrade,
      totalAmount: amount,
      totalInstallments: count,
      monthlyInstallment: monthly,
      paidInstallments: 0,
      remainingBalance: amount,
      startDate: getTodayShamsi(),
      purpose: newPurpose,
      status: 'active',
      guarantorName: newGuarantor,
      notes: newNotes,
      installmentHistory: []
    };

    await localDb.setDoc('finance_loans', newLoan);
    setLoans(prev => [newLoan, ...prev]);
    setFundCashBalance(prev => Math.max(0, prev - amount));
    showToast(`وام جدید به مبلغ ${amount.toLocaleString('fa-IR')} تومان به ${newStudentName} اعطا گردید.`);
    setIsAddLoanOpen(false);
    setNewStudentName('');
    setNewNationalId('');
    setNewNotes('');
  };

  // Record an installment payment
  const handlePayInstallment = async (loan: LoanItem) => {
    if (loan.remainingBalance <= 0) return;
    const newPaid = loan.paidInstallments + 1;
    const newRemaining = Math.max(0, loan.remainingBalance - loan.monthlyInstallment);
    const newStatus = newRemaining === 0 ? 'settled' : 'active';

    const newHistory = [
      ...(loan.installmentHistory || []),
      {
        date: getTodayShamsi(),
        amount: loan.monthlyInstallment,
        method: 'کسر مکانیزه از شهریه دوره'
      }
    ];

    const updated: LoanItem = {
      ...loan,
      paidInstallments: newPaid,
      remainingBalance: newRemaining,
      status: newStatus,
      installmentHistory: newHistory
    };

    await localDb.setDoc('finance_loans', updated);
    setLoans(prev => prev.map(l => l.id === loan.id ? updated : l));
    if (selectedLoanBooklet && selectedLoanBooklet.id === loan.id) {
      setSelectedLoanBooklet(updated);
    }
    setFundCashBalance(prev => prev + loan.monthlyInstallment);
    showToast(`یک قسط به مبلغ ${loan.monthlyInstallment.toLocaleString('fa-IR')} تومان ثبت شد. مانده: ${newRemaining.toLocaleString('fa-IR')} ت`);
  };

  // Deposit donor funds to capital
  const handleDepositToFund = () => {
    const amt = Number(depositAmount) || 0;
    setFundCashBalance(prev => prev + amt);
    showToast(`مبلغ ${amt.toLocaleString('fa-IR')} تومان از طرف «${donorName}» به صندوق اضافه شد.`);
    setIsDepositToFundOpen(false);
  };

  // Export Excel
  const handleExportExcel = () => {
    if (activeSubTab === 'loans') {
      const data = filteredLoans.map((l, idx) => ({
        'ردیف': idx + 1,
        'نام و نام خانوادگی طلبه': l.studentName,
        'کد ملی': l.nationalId,
        'پایه تحصیلی': l.grade,
        'مبلغ کل وام (تومان)': l.totalAmount,
        'تعداد کل اقساط': l.totalInstallments,
        'قسط ماهانه (تومان)': l.monthlyInstallment,
        'اقساط پرداخت شده': l.paidInstallments,
        'مانده بدهی (تومان)': l.remainingBalance,
        'تاریخ اعطا': l.startDate,
        'علت دریافت وام': l.purpose,
        'ضامن': l.guarantorName || '---',
        'وضعیت': l.status === 'active' ? 'فعال در جریان' : 'تسویه شده',
        'توضیحات': l.notes || ''
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'تسهیلات و وام‌های فعال');
      XLSX.writeFile(wb, `گزارش_وام_های_فعال_${getTodayShamsi().replace(/\//g, '_')}.xlsx`);
    } else {
      const data = contributions.map((c, idx) => ({
        'ردیف': idx + 1,
        'نام طلبه': c.studentName,
        'کد ملی': c.nationalId,
        'پایه': c.grade,
        'پس‌انداز ماهانه (تومان)': c.monthlyContribution,
        'کل موجودی پس‌انداز در صندوق (تومان)': c.totalAccumulatedSavings,
        'وضعیت': c.status === 'active' ? 'فعال' : 'متوقف شده'
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'پس‌انداز اعضای صندوق');
      XLSX.writeFile(wb, `پس‌انداز_اعضای_صندوق_${getTodayShamsi().replace(/\//g, '_')}.xlsx`);
    }
    showToast('فایل اکسل با موفقیت صادر شد.');
  };

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-3 font-vazir" dir="rtl">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-bold">در حال بارگذاری اطلاعات صندوق و وام‌های فعال...</p>
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
            <Building2 size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900">گزارشات صندوق و وام‌های فعال</h1>
              <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 border border-indigo-200 text-[11px] font-black rounded-lg">
                صندوق قرض‌الحسنه طلاب
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              مدیریت تسهیلات قرض‌الحسنه، رهگیری اقساط کسرشده از شهریه، مانده بدهی و سرمایه در گردش صندوق
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
            <span>خروجی اکسل تسهیلات</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDepositToFundOpen(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <PiggyBank size={15} />
            <span>افزایش سرمایه / کمک خیرین</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddLoanOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} />
            <span>اعطای وام جدید به طلبه</span>
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">موجودی نقدی آماده پرداخت</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Wallet size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">
            {fundCashBalance.toLocaleString('fa-IR')} <span className="text-xs font-medium text-emerald-600">تومان</span>
          </div>
          <p className="text-[11px] text-slate-400">نقدینگی در حساب صندوق قرض‌الحسنه</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">تسهیلات فعال در جریان</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Users size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {metrics.totalActiveCount} <span className="text-xs font-medium text-slate-500">فقره وام فعال</span>
          </div>
          <p className="text-[11px] text-slate-400">مانده اصل وام: {metrics.totalActiveBalance.toLocaleString('fa-IR')} تومان</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">اقساط ماهانه کسر شده از شهریه</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Receipt size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-900 font-mono">
            {metrics.monthlyInstallmentsSum.toLocaleString('fa-IR')} <span className="text-xs font-medium text-indigo-700">تومان</span>
          </div>
          <p className="text-[11px] text-slate-400">بازگشت ماهانه به موجودی صندوق</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">مجموع پس‌انداز اعضا در صندوق</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <PiggyBank size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-900 font-mono">
            {metrics.totalSavingsCapital.toLocaleString('fa-IR')} <span className="text-xs font-medium text-purple-700">تومان</span>
          </div>
          <p className="text-[11px] text-slate-400">سرمایه در گردش کل: {metrics.totalFundCapital.toLocaleString('fa-IR')} ت</p>
        </div>
      </div>

      {/* Sub-Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('loans')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer",
            activeSubTab === 'loans'
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          )}
        >
          <CreditCard size={15} />
          <span>تسهیلات و وام‌های فعال طلاب ({loans.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('savings_fund')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer",
            activeSubTab === 'savings_fund'
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          )}
        >
          <PiggyBank size={15} />
          <span>پس‌انداز و مشارکت اعضا در صندوق ({contributions.length})</span>
        </button>
      </div>

      {/* VIEW 1: Loans */}
      {activeSubTab === 'loans' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[240px] flex-1 max-w-sm">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجوی نام وام‌گیرنده، علت وام، ضامن..."
                  className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">وضعیت:</span>
                <select
                  value={selectedStatusFilter}
                  onChange={(e: any) => setSelectedStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-hidden cursor-pointer"
                >
                  <option value="all">همه وام‌ها</option>
                  <option value="active">وام‌های در جریان (فعال)</option>
                  <option value="settled">تسویه شده کامل</option>
                </select>
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
            </div>

            <div className="text-xs font-bold text-slate-500">
              قسط: <span className="font-mono text-indigo-700 font-black">ماهانه خودکار از شهریه کسر می‌گردد</span>
            </div>
          </div>

          {/* Loans Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                    <th className="p-3.5">وام‌گیرنده</th>
                    <th className="p-3.5 text-center">پایه</th>
                    <th className="p-3.5 text-center">مبلغ کل وام</th>
                    <th className="p-3.5 text-center">قسط ماهانه</th>
                    <th className="p-3.5 text-center">اقساط پرداخت‌شده</th>
                    <th className="p-3.5 text-center font-black text-rose-700 bg-rose-50/60">مانده بدهی</th>
                    <th className="p-3.5 text-center">تاریخ اعطا</th>
                    <th className="p-3.5">علت دریافت</th>
                    <th className="p-3.5">ضامن</th>
                    <th className="p-3.5 text-center">وضعیت</th>
                    <th className="p-3.5 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLoans.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-10 text-center text-slate-400 font-bold">
                        تسهیلاتی مطابق با فیلترها یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    filteredLoans.map(l => {
                      const percentPaid = Math.round((l.paidInstallments / (l.totalInstallments || 1)) * 100);

                      return (
                        <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900">{l.studentName}</div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">کد ملی: {l.nationalId}</div>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-bold text-[10px]">
                              {l.grade}
                            </span>
                          </td>
                          <td className="p-3.5 text-center font-mono font-bold text-slate-900">
                            {l.totalAmount.toLocaleString('fa-IR')} ت
                          </td>
                          <td className="p-3.5 text-center font-mono font-black text-indigo-900">
                            {l.monthlyInstallment.toLocaleString('fa-IR')} ت
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-mono font-bold text-slate-800">
                                {l.paidInstallments} از {l.totalInstallments}
                              </span>
                              <div className="w-16 bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                                <div 
                                  className="bg-emerald-500 h-full rounded-full transition-all"
                                  style={{ width: `${Math.min(100, percentPaid)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 text-center font-mono font-black text-rose-700 text-sm bg-rose-50/40">
                            {l.remainingBalance.toLocaleString('fa-IR')} تومان
                          </td>
                          <td className="p-3.5 text-center font-mono text-slate-600 text-[11px]">
                            {l.startDate}
                          </td>
                          <td className="p-3.5 text-slate-700 font-medium">
                            {l.purpose}
                          </td>
                          <td className="p-3.5 text-slate-600 text-[11px]">
                            {l.guarantorName || '---'}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={cn(
                              "px-2.5 py-1 rounded-lg text-[10px] font-black",
                              l.status === 'active' 
                                ? "bg-blue-100 text-blue-800 border border-blue-200" 
                                : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            )}>
                              {l.status === 'active' ? 'در جریان' : 'تسویه شده'}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedLoanBooklet(l)}
                                title="مشاهده شناسنامه و دفترچه اقساط"
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                              >
                                <FileText size={15} />
                              </button>
                              {l.remainingBalance > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handlePayInstallment(l)}
                                  title="ثبت کسر یک قسط ماهانه"
                                  className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer font-bold text-[11px]"
                                >
                                  <Check size={15} />
                                </button>
                              )}
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
        </div>
      )}

      {/* VIEW 2: Fund Contributions & Member Savings */}
      {activeSubTab === 'savings_fund' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                    <th className="p-3.5">نام و مشخصات عضو صندوق</th>
                    <th className="p-3.5 text-center">پایه</th>
                    <th className="p-3.5 text-center">مبلغ پس‌انداز ماهانه (کسر از شهریه)</th>
                    <th className="p-3.5 text-center font-black text-emerald-800 bg-emerald-50/50">کل موجودی پس‌انداز در صندوق</th>
                    <th className="p-3.5 text-center">وضعیت مشارکت</th>
                    <th className="p-3.5 text-center">سهم از صندوق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contributions.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{c.studentName}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">کد ملی: {c.nationalId}</div>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-bold text-[10px]">
                          {c.grade}
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-mono font-bold text-indigo-900">
                        {c.monthlyContribution.toLocaleString('fa-IR')} تومان
                      </td>
                      <td className="p-3.5 text-center font-mono font-black text-emerald-800 text-sm bg-emerald-50/30">
                        {c.totalAccumulatedSavings.toLocaleString('fa-IR')} تومان
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-black">
                          {c.status === 'active' ? 'فعال' : 'متوقف شده'}
                        </span>
                      </td>
                      <td className="p-3.5 text-center text-slate-500 font-mono text-[11px]">
                        {((c.totalAccumulatedSavings / (metrics.totalSavingsCapital || 1)) * 100).toFixed(1)}٪
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Loan Booklet Modal */}
      {selectedLoanBooklet && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">شناسنامه و دفترچه اقساط تسهیلات</h3>
                <span className="text-[11px] text-slate-400">صندوق قرض‌الحسنه داخلی حوزه علمیه</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLoanBooklet(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500 font-bold">وام‌گیرنده: </span>
                <span className="font-black text-slate-900">{selectedLoanBooklet.studentName}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold">پایه: </span>
                <span className="font-bold text-indigo-700">{selectedLoanBooklet.grade}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold">مبلغ کل وام: </span>
                <span className="font-mono font-black text-slate-800">{selectedLoanBooklet.totalAmount.toLocaleString('fa-IR')} ت</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold">مبلغ هر قسط: </span>
                <span className="font-mono font-bold text-indigo-900">{selectedLoanBooklet.monthlyInstallment.toLocaleString('fa-IR')} ت</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold">اقساط پرداخت‌شده: </span>
                <span className="font-mono font-bold text-emerald-700">{selectedLoanBooklet.paidInstallments} از {selectedLoanBooklet.totalInstallments}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold">مانده بدهی: </span>
                <span className="font-mono font-black text-rose-700">{selectedLoanBooklet.remainingBalance.toLocaleString('fa-IR')} ت</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 font-bold">ضامن: </span>
                <span className="font-medium text-slate-800">{selectedLoanBooklet.guarantorName || '---'}</span>
              </div>
            </div>

            {/* Installment History */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-800">تاریخچه اقساط کسر شده از شهریه:</h4>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {(!selectedLoanBooklet.installmentHistory || selectedLoanBooklet.installmentHistory.length === 0) ? (
                  <p className="text-xs text-slate-400 italic">هنوز قسطی ثبت نشده است.</p>
                ) : (
                  selectedLoanBooklet.installmentHistory.map((item, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs font-medium">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        <span className="font-bold text-slate-800">قسط {idx + 1}</span>
                        <span className="text-[11px] text-slate-500 font-mono">({item.date})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500">{item.method}</span>
                        <span className="font-mono font-black text-emerald-800">{item.amount.toLocaleString('fa-IR')} ت</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              {selectedLoanBooklet.remainingBalance > 0 ? (
                <button
                  type="button"
                  onClick={() => handlePayInstallment(selectedLoanBooklet)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Check size={14} />
                  <span>ثبت وصول یک قسط جدید</span>
                </button>
              ) : (
                <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                  این تسهیلات به طور کامل تسویه شده است.
                </span>
              )}

              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} />
                <span>چاپ شناسنامه وام</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Loan Modal */}
      {isAddLoanOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Plus size={16} className="text-indigo-600" />
                <span>اعطای وام قرض‌الحسنه جدید به طلبه</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddLoanOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-600 font-bold">نام و نام خانوادگی طلبه:</label>
                  <input
                    type="text"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    placeholder="مثلاً: محمد کریمی"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-600 font-bold">کد ملی:</label>
                  <input
                    type="text"
                    value={newNationalId}
                    onChange={(e) => setNewNationalId(e.target.value)}
                    placeholder="۱۲۷۰۰۰..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-600 font-bold">پایه تحصیلی:</label>
                  <select
                    value={newGrade}
                    onChange={(e) => setNewGrade(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    <option value="پایه ۷">پایه ۷</option>
                    <option value="پایه ۸">پایه ۸</option>
                    <option value="پایه ۹">پایه ۹</option>
                    <option value="پایه ۱۰">پایه ۱۰</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-600 font-bold">مبلغ کل وام (تومان):</label>
                  <input
                    type="number"
                    value={newLoanAmount}
                    onChange={(e) => setNewLoanAmount(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-600 font-bold">تعداد اقساط:</label>
                  <input
                    type="number"
                    value={newInstallmentsCount}
                    onChange={(e) => setNewInstallmentsCount(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-600 font-bold">علت دریافت وام:</label>
                  <input
                    type="text"
                    value={newPurpose}
                    onChange={(e) => setNewPurpose(e.target.value)}
                    placeholder="درمان، مسکن، ضروری..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-600 font-bold">ضامن معتبر:</label>
                  <input
                    type="text"
                    value={newGuarantor}
                    onChange={(e) => setNewGuarantor(e.target.value)}
                    placeholder="نام استاد یا طلبه ضامن"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 font-bold">یادداشت و شرایط اعطا:</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="کسر خودکار از شهریه ماهانه..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>

              <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-200 flex items-center justify-between text-xs font-bold">
                <span className="text-indigo-900">محاسبه قسط ماهانه کسر از شهریه:</span>
                <span className="font-mono text-indigo-900 font-black">
                  {Math.round((Number(newLoanAmount) || 0) / (Number(newInstallmentsCount) || 1)).toLocaleString('fa-IR')} تومان
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddLoanOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleAddLoan}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                ثبت و پرداخت وام
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Increase Fund Capital Modal */}
      {isDepositToFundOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <PiggyBank size={16} className="text-emerald-600" />
                <span>افزایش سرمایه صندوق / کمک خیرین</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsDepositToFundOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-600 font-bold">نام و عنوان واریزکننده یا خیر:</label>
                <input
                  type="text"
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 font-bold">مبلغ واریزی به صندوق (تومان):</label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 font-bold">توضیحات و بابت:</label>
                <input
                  type="text"
                  value={depositNotes}
                  onChange={(e) => setDepositNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDepositToFundOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleDepositToFund}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                ثبت افزایش سرمایه
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
