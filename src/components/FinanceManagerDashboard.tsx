import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, 
  Users, 
  Clock, 
  Briefcase, 
  Coins, 
  Receipt, 
  UtensilsCrossed, 
  CheckCircle2, 
  Plus, 
  FileText, 
  Calendar, 
  Search, 
  Printer, 
  SlidersHorizontal, 
  Check, 
  X, 
  Download,
  BookOpen,
  Award,
  CreditCard,
  Building2,
  PieChart,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Layers,
  GraduationCap,
  HandCoins
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';
import { localDb } from '../lib/localDb';
import { useAuth } from '../context/AuthContext';
import { getTodayShamsi } from '../lib/jalali';
import { motion, AnimatePresence } from 'motion/react';
import StudentActivityAndTuition from './finance/StudentActivityAndTuition';
import GradeProfessorsCompensation from './finance/GradeProfessorsCompensation';
import TeachersCompensation from './finance/TeachersCompensation';
import LunchManagement from './finance/LunchManagement';
import ClaimsManagement from './finance/ClaimsManagement';
import FundAndActiveLoans from './finance/FundAndActiveLoans';
import ExpensesAndReports from './finance/ExpensesAndReports';
import StaffBank from './finance/StaffBank';
import FundDonations from './finance/FundDonations';
import { 
  TuitionCalculationSettings, 
  PresenceReport, 
  StudentFinancialProfile, 
  TuitionCalculationBreakdown 
} from '../types';

interface FinanceManagerDashboardProps {
  onNavigateTab?: (tab: string, params?: any) => void;
}

type FinanceTabType = 
  | 'students_activity_tuition'
  | 'teachers'
  | 'grade_professors'
  | 'staff_bank'
  | 'staff'
  | 'lunch'
  | 'claims'
  | 'expenses'
  | 'loans'
  | 'qard_fund'
  | 'fund_donations'
  | 'financial_reports';

export default function FinanceManagerDashboard({ onNavigateTab }: FinanceManagerDashboardProps) {
  const { currentUser } = useAuth();

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<FinanceTabType>('students_activity_tuition');

  // Core data states
  const [students, setStudents] = useState<any[]>([]);
  const [presenceReports, setPresenceReports] = useState<PresenceReport[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [gradeMentors, setGradeMentors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // Modals
  const [isNewExpenseModalOpen, setIsNewExpenseModalOpen] = useState(false);
  const [isNewLoanModalOpen, setIsNewLoanModalOpen] = useState(false);

  // New Expense form
  const [newExpenseTitle, setNewExpenseTitle] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState('قبوض و انشعابات');
  const [newExpenseDate, setNewExpenseDate] = useState(getTodayShamsi());
  const [newExpenseNotes, setNewExpenseNotes] = useState('');

  // New Loan form
  const [newLoanStudentId, setNewLoanStudentId] = useState('');
  const [newLoanAmount, setNewLoanAmount] = useState('5000000');
  const [newLoanInstallment, setNewLoanInstallment] = useState('500000');
  const [newLoanPurpose, setNewLoanPurpose] = useState('ضروری / درمان');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Load Database Records
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [studs, reps, exps, lns, stf, gMentors] = await Promise.all([
        localDb.getDocs('students'),
        localDb.getDocs<PresenceReport>('presence_reports'),
        localDb.getDocs('finance_expenses'),
        localDb.getDocs('finance_loans'),
        localDb.getDocs('finance_staff'),
        localDb.getDocs('finance_grade_mentors')
      ]);

      setStudents(studs || []);
      setPresenceReports(reps || []);
      setExpenses(exps || []);
      setLoans(lns || []);
      
      setStaffMembers(stf && stf.length > 0 ? stf : [
        { id: 'st-1', name: 'حجت‌الاسلام حسینی', role: 'مدیر مدرسه', baseSalary: 18000000, overtime: 1200000, deductions: 0, bankAccount: '۶۰۳۷-۹۹۱۱-۲۲۳۳-۴۴۵۵' },
        { id: 'st-2', name: 'استاد شاه‌فضل', role: 'مسئول آموزش', baseSalary: 15000000, overtime: 800000, deductions: 0, bankAccount: '۶۰۳۷-۹۹۱۱-۵۵۶۶-۷۷۸۸' },
        { id: 'st-3', name: 'آقای صادقی', role: 'مسئول امور مالی و شهریه', baseSalary: 14000000, overtime: 600000, deductions: 0, bankAccount: '۶۰۳۷-۹۹۱۱-۹۹۰۰-۱۱۲۲' },
        { id: 'st-4', name: 'آقای محمدی', role: 'کادر اجرایی و خادم', baseSalary: 11000000, overtime: 1500000, deductions: 200000, bankAccount: '۶۰۳۷-۹۹۱۱-۳۳۴۴-۵۵۶۶' }
      ]);

      setGradeMentors(gMentors && gMentors.length > 0 ? gMentors : [
        { id: 'gm-1', name: 'حجت‌الاسلام والمسلمین موسوی', grade: 'پایه ۷', baseMentoringFee: 4000000, hourlyRate: 150000, totalHours: 24, bankAccount: 'IR120120000000001234567801' },
        { id: 'gm-2', name: 'استاد رضایی', grade: 'پایه ۸', baseMentoringFee: 4000000, hourlyRate: 150000, totalHours: 28, bankAccount: 'IR120120000000001234567802' },
        { id: 'gm-3', name: 'حجت‌الاسلام کریمی', grade: 'پایه ۹', baseMentoringFee: 4500000, hourlyRate: 160000, totalHours: 30, bankAccount: 'IR120120000000001234567803' },
        { id: 'gm-4', name: 'استاد فلاحتی', grade: 'پایه ۱۰', baseMentoringFee: 5000000, hourlyRate: 180000, totalHours: 26, bankAccount: 'IR120120000000001234567804' }
      ]);
    } catch (err) {
      console.error('Error loading finance data:', err);
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

  // Summary metrics
  const summaryMetrics = useMemo(() => {
    const totalTeachersWork = presenceReports.reduce((acc, curr) => acc + (curr.totalHours || 0), 0);
    const totalExpenses = expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const totalLoansActive = loans.reduce((acc, curr) => acc + (Number(curr.remainingAmount) || 0), 0);
    const totalStaffSalaries = staffMembers.reduce((acc, curr) => acc + (curr.baseSalary + curr.overtime - curr.deductions), 0);

    return {
      studentCount: students.length,
      totalTeachersWork,
      totalExpenses,
      totalLoansActive,
      totalStaffSalaries
    };
  }, [students, presenceReports, expenses, loans, staffMembers]);

  // Add new Expense
  const handleAddExpense = async () => {
    if (!newExpenseTitle || !newExpenseAmount) {
      alert('لطفاً عنوان و مبلغ هزینه را وارد کنید.');
      return;
    }
    const expDoc = {
      id: `exp-${Date.now()}`,
      title: newExpenseTitle,
      amount: Number(newExpenseAmount),
      category: newExpenseCategory,
      date: newExpenseDate,
      notes: newExpenseNotes,
      registeredBy: currentUser?.fullName || currentUser?.name || currentUser?.username,
      createdAt: new Date().toISOString()
    };
    await localDb.setDoc('finance_expenses', expDoc);
    setExpenses(prev => [expDoc, ...prev]);
    showToast('هزینه با موفقیت در دفاتر ثبت شد.');
    setIsNewExpenseModalOpen(false);
    setNewExpenseTitle('');
    setNewExpenseAmount('');
    setNewExpenseNotes('');
  };

  // Add new Loan
  const handleAddLoan = async () => {
    const stud = students.find(s => s.id === newLoanStudentId);
    if (!stud) {
      alert('لطفاً طلبه متقاضی وام را انتخاب کنید.');
      return;
    }
    const loanDoc = {
      id: `loan-${Date.now()}`,
      studentId: stud.id,
      studentName: stud.name,
      amount: Number(newLoanAmount),
      monthlyInstallment: Number(newLoanInstallment),
      remainingAmount: Number(newLoanAmount),
      purpose: newLoanPurpose,
      status: 'active',
      startDate: getTodayShamsi(),
      createdAt: new Date().toISOString()
    };
    await localDb.setDoc('finance_loans', loanDoc);
    setLoans(prev => [loanDoc, ...prev]);
    showToast(`وام برای طلبه ${stud.name} ثبت گردید.`);
    setIsNewLoanModalOpen(false);
  };

  // Teacher report approval
  const handleAcknowledgeTeacherReport = async (report: PresenceReport) => {
    const updated = { ...report, status: 'received' as const };
    await localDb.setDoc('presence_reports', updated);
    setPresenceReports(prev => prev.map(r => r.id === report.id ? updated : r));
    showToast(`گزارش کارکرد استاد ${report.teacherName} تایید و در محاسبات حق‌الزحمه ثبت گردید.`);
  };

  if (isLoading) {
    return (
      <div className="p-10 flex flex-col items-center justify-center space-y-3 font-vazir" dir="rtl">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-bold">در حال بارگذاری سامانه جامع مالی و اداری...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-vazir" dir="rtl">
      {/* Toast Notification */}
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

      {/* Main Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shadow-xs border border-emerald-100">
            <DollarSign size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900">سامانه جامع مدیریت مالی، شهریه و کارکرد</h1>
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-black rounded-lg">
                پنل مسئول مالی
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              محاسبه و تنظیم شهریه طلاب، حق‌الزحمه اساتید، حقوق کارمندان، نهار، وام، صندوق قرض‌الحسنه و هزینه‌های مجموعه
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="text-left">
            <span className="text-[10px] text-slate-400 block">کاربر جاری</span>
            <span className="text-xs font-bold text-slate-800">{currentUser?.fullName || currentUser?.name || 'مسئول بخش مالی'}</span>
          </div>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">تعداد کل طلاب تحت پوشش</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Users size={16} />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            {summaryMetrics.studentCount} <span className="text-xs font-medium text-slate-500">نفر</span>
          </div>
          <p className="text-[11px] text-slate-400">واجد شرایط دریافت شهریه و تسهیلات</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">کارکرد ثبت‌شده اساتید</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            {summaryMetrics.totalTeachersWork} <span className="text-xs font-medium text-slate-500">ساعت</span>
          </div>
          <p className="text-[11px] text-slate-400">{presenceReports.length} فقره گزارش دریافتی</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">مانده وام‌های فعال طلاب</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Coins size={16} />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            {summaryMetrics.totalLoansActive.toLocaleString('fa-IR')} <span className="text-xs font-medium text-slate-500">تومان</span>
          </div>
          <p className="text-[11px] text-slate-400">کسر خودکار ماهیانه از شهریه</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">هزینه‌های جاری و قبوض</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
              <Receipt size={16} />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            {summaryMetrics.totalExpenses.toLocaleString('fa-IR')} <span className="text-xs font-medium text-slate-500">تومان</span>
          </div>
          <p className="text-[11px] text-slate-400">ثبت‌شده در اسناد مالی مدرسه</p>
        </div>
      </div>

      {/* Primary Tabs Navigation Bar matching exactly the user prompt */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-1.5 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('students_activity_tuition')}
          className={cn(
            "px-3.5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
            activeTab === 'students_activity_tuition'
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          )}
        >
          <GraduationCap size={15} />
          <span>اطلاعات حضور و فعالیت طلاب و محاسبه شهریه</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('teachers')}
          className={cn(
            "px-3.5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
            activeTab === 'teachers'
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          )}
        >
          <Clock size={15} />
          <span>اطلاعات و حق‌الزحمه اساتید</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('grade_professors')}
          className={cn(
            "px-3.5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
            activeTab === 'grade_professors'
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          )}
        >
          <BookOpen size={15} />
          <span>اطلاعات و حق‌الزحمه اساتید پایه</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('staff_bank')}
          className={cn(
            "px-3.5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
            activeTab === 'staff_bank'
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          )}
        >
          <Building2 size={15} />
          <span>بانک کارکنان مجموعه</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('staff')}
          className={cn(
            "px-3.5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
            activeTab === 'staff'
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          )}
        >
          <Briefcase size={15} />
          <span>اطلاعات و حقوق کارمندان</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('lunch')}
          className={cn(
            "px-3.5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
            activeTab === 'lunch'
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          )}
        >
          <UtensilsCrossed size={15} />
          <span>اطلاعات نهار و شام</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('claims')}
          className={cn(
            "px-3.5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
            activeTab === 'claims'
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          )}
        >
          <HandCoins size={15} />
          <span>مطالبات و بدهی‌ها</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('expenses')}
          className={cn(
            "px-3.5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
            activeTab === 'expenses'
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          )}
        >
          <Receipt size={15} />
          <span>سایر هزینه‌های مجموعه</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('loans')}
          className={cn(
            "px-3.5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
            activeTab === 'loans'
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          )}
        >
          <Coins size={15} />
          <span>وام</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('qard_fund')}
          className={cn(
            "px-3.5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
            activeTab === 'qard_fund'
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          )}
        >
          <Building2 size={15} />
          <span>صندوق قرض‌الحسنه</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fund_donations')}
          className={cn(
            "px-3.5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
            activeTab === 'fund_donations'
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          )}
        >
          <HandCoins size={15} />
          <span>کمک به صندوق</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('financial_reports')}
          className={cn(
            "px-3.5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
            activeTab === 'financial_reports'
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          )}
        >
          <PieChart size={15} />
          <span>گزارش‌ها و صورت‌حساب‌های مالی</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. اطلاعات حضور و فعالیت طلاب و محاسبه شهریه                               */}
      {/* ========================================================================= */}
      {activeTab === 'students_activity_tuition' && (
        <StudentActivityAndTuition onNavigateTab={onNavigateTab} />
      )}

      {/* ========================================================================= */}
      {/* 2. اطلاعات و حق‌الزحمه اساتید                                            */}
      {/* ========================================================================= */}
      {activeTab === 'teachers' && (
        <TeachersCompensation onNavigateTab={onNavigateTab} />
      )}

      {/* ========================================================================= */}
      {/* 3. اطلاعات و حق‌الزحمه اساتید پایه                                       */}
      {/* ========================================================================= */}
      {activeTab === 'grade_professors' && (
        <GradeProfessorsCompensation onNavigateTab={onNavigateTab} />
      )}

      {/* ========================================================================= */}
      {/* 3.1 بانک کارکنان مجموعه                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'staff_bank' && (
        <StaffBank />
      )}

      {/* ========================================================================= */}
      {/* 4. اطلاعات و حقوق کارمندان                                               */}
      {/* ========================================================================= */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900">لیست حقوق و دستمزد کادر اجرایی و اداری مدرسه</h3>
                <p className="text-xs text-slate-500 mt-0.5">محاسبه حقوق پایه، اضافه‌کاری، حق ماموریت و کسورات قانونی</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100/70 text-slate-700 font-black border-b border-slate-200">
                    <th className="p-3.5">نام کارمند</th>
                    <th className="p-3.5">سمت سازمانی</th>
                    <th className="p-3.5 text-center">حقوق پایه (تومان)</th>
                    <th className="p-3.5 text-center text-emerald-800">اضافه کار و مزایا</th>
                    <th className="p-3.5 text-center text-rose-700">کسورات</th>
                    <th className="p-3.5 text-center font-black text-slate-900">خالص پرداختی</th>
                    <th className="p-3.5 text-center">شماره حساب بانکی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffMembers.map(st => {
                    const net = st.baseSalary + st.overtime - st.deductions;
                    return (
                      <tr key={st.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3.5 font-bold text-slate-900">{st.name}</td>
                        <td className="p-3.5 text-slate-600">{st.role}</td>
                        <td className="p-3.5 text-center font-mono text-slate-700">{st.baseSalary.toLocaleString('fa-IR')}</td>
                        <td className="p-3.5 text-center font-mono text-emerald-700 font-bold">+{st.overtime.toLocaleString('fa-IR')}</td>
                        <td className="p-3.5 text-center font-mono text-rose-600 font-bold">-{st.deductions.toLocaleString('fa-IR')}</td>
                        <td className="p-3.5 text-center font-mono font-black text-emerald-800 text-sm">{net.toLocaleString('fa-IR')} تومان</td>
                        <td className="p-3.5 text-center font-mono text-slate-500 text-[11px]">{st.bankAccount || '---'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. اطلاعات نهار و شام                                                     */}
      {/* ========================================================================= */}
      {activeTab === 'lunch' && (
        <LunchManagement onNavigateTab={onNavigateTab} />
      )}

      {/* ========================================================================= */}
      {/* 5.1 مطالبات و بدهی‌های طلاب                                               */}
      {/* ========================================================================= */}
      {activeTab === 'claims' && (
        <ClaimsManagement onNavigateTab={onNavigateTab} />
      )}

      {/* ========================================================================= */}
      {/* 6. سایر هزینه‌های مجموعه                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-black text-slate-900">دفتر اسناد هزینه‌ها و مخارج جاری مدرسه</h3>
              <p className="text-[11px] text-slate-500">قبوض، نگهداری ساختمان، مراسمات، اقلام اداری و آموزشی</p>
            </div>
            <button
              type="button"
              onClick={() => setIsNewExpenseModalOpen(true)}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Plus size={14} />
              <span>ثبت سند هزینه جدید</span>
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                    <th className="p-3.5">عنوان و شرح هزینه</th>
                    <th className="p-3.5">دسته‌بندی</th>
                    <th className="p-3.5 font-mono text-center">مبلغ (تومان)</th>
                    <th className="p-3.5 font-mono text-center">تاریخ</th>
                    <th className="p-3.5">ثبت‌کننده</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">
                        سند هزینه‌ای ثبت نشده است.
                      </td>
                    </tr>
                  ) : (
                    expenses.map(exp => (
                      <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3.5 font-bold text-slate-900">{exp.title}</td>
                        <td className="p-3.5">
                          <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold">
                            {exp.category}
                          </span>
                        </td>
                        <td className="p-3.5 text-center font-mono font-bold text-rose-700">
                          {Number(exp.amount).toLocaleString('fa-IR')}
                        </td>
                        <td className="p-3.5 text-center font-mono text-slate-500">{exp.date}</td>
                        <td className="p-3.5 text-slate-500">{exp.registeredBy || 'مسئول مالی'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. وام                                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'loans' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-black text-slate-900">مدیریت تسهیلات و وام‌های اعطایی طلاب</h3>
              <p className="text-[11px] text-slate-500">اقساط ماهانه به صورت خودکار از شهریه محاسبه‌شده هر طلبه کسر می‌گردد.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsNewLoanModalOpen(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Plus size={14} />
              <span>اعطای وام جدید</span>
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                    <th className="p-3.5">نام طلبه</th>
                    <th className="p-3.5 font-mono text-center">مبلغ کل وام</th>
                    <th className="p-3.5 font-mono text-center">قسط ماهانه</th>
                    <th className="p-3.5 font-mono text-center">مانده بدهی</th>
                    <th className="p-3.5">علت / موضوع وام</th>
                    <th className="p-3.5 text-center">وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loans.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                        وامی در جریان ثبت نشده است.
                      </td>
                    </tr>
                  ) : (
                    loans.map(ln => (
                      <tr key={ln.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3.5 font-bold text-slate-900">{ln.studentName}</td>
                        <td className="p-3.5 text-center font-mono">{Number(ln.amount).toLocaleString('fa-IR')} تومان</td>
                        <td className="p-3.5 text-center font-mono text-emerald-700 font-bold">
                          {Number(ln.monthlyInstallment).toLocaleString('fa-IR')}
                        </td>
                        <td className="p-3.5 text-center font-mono text-amber-700 font-bold">
                          {Number(ln.remainingAmount).toLocaleString('fa-IR')}
                        </td>
                        <td className="p-3.5 text-slate-600">{ln.purpose}</td>
                        <td className="p-3.5 text-center">
                          <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md">
                            فعال در گردش
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. صندوق قرض‌الحسنه                                                       */}
      {/* ========================================================================= */}
      {activeTab === 'qard_fund' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
            <div>
              <h3 className="text-sm font-black text-slate-900">دفتر صندوق قرض‌الحسنه داخلی مدرسه</h3>
              <p className="text-xs text-slate-500 mt-1">
                صندوق با تجمیع پس‌انداز ماهانه داوطلبانه طلاب و کمک‌های خیرین، تسهیلات قرض‌الحسنه ضروری را اعطا می‌نماید.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-1">
                <span className="text-xs text-emerald-800 font-bold">موجودی نقدی صندوق</span>
                <div className="text-xl font-black text-emerald-700 font-mono">۴۸,۵۰۰,۰۰۰ تومان</div>
                <span className="text-[10px] text-emerald-600">آماده اعطای وام به طلاب</span>
              </div>
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-center space-y-1">
                <span className="text-xs text-amber-800 font-bold">تسهیلات در جریان بازپرداخت</span>
                <div className="text-xl font-black text-amber-700 font-mono">
                  {summaryMetrics.totalLoansActive.toLocaleString('fa-IR')} تومان
                </div>
                <span className="text-[10px] text-amber-600">{loans.length} فقره وام فعال</span>
              </div>
              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-200 text-center space-y-1">
                <span className="text-xs text-indigo-800 font-bold">سرمایه کل در گردش صندوق</span>
                <div className="text-xl font-black text-indigo-700 font-mono">
                  {(48500000 + summaryMetrics.totalLoansActive).toLocaleString('fa-IR')} تومان
                </div>
                <span className="text-[10px] text-indigo-600">مجموع پس‌انداز اعضا و خیرین</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">تعداد طلاب مشارکت‌کننده در پس‌انداز ماهانه صندوق:</span>
              <span className="font-mono font-black text-slate-800">{students.length} طلبه</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8.1 کمک به صندوق                                                         */}
      {/* ========================================================================= */}
      {activeTab === 'fund_donations' && (
        <FundDonations />
      )}

      {/* ========================================================================= */}
      {/* 9. گزارش‌ها و صورت‌حساب‌های مالی                                          */}
      {/* ========================================================================= */}
      {activeTab === 'financial_reports' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">ترازنامه و صورت‌حساب مالی جامع مدرسه</h3>
                <p className="text-xs text-slate-500 mt-1">
                  خلاصه کل منابع، مصارف، شهریه‌ها، حق‌الزحمه‌ها، حقوق، تغذیه و هزینه‌های جاری
                </p>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <Printer size={14} />
                <span>چاپ صورت‌حساب مالی</span>
              </button>
            </div>

            {/* Financial Ledger Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 text-xs">
              <div className="p-3 bg-slate-50 font-black text-slate-800 flex items-center justify-between">
                <span>سرفصل مالی</span>
                <span>گردش بدهکار / بستانکار (تومان)</span>
              </div>

              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-700 font-bold">۱. کل شهریه مصوب و پرداختی طلاب</span>
                <span className="font-mono font-bold text-rose-700">-۸۵,۴۰۰,۰۰۰ تومان</span>
              </div>

              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-700 font-bold">۲. کل حق‌الزحمه تدریس اساتید</span>
                <span className="font-mono font-bold text-rose-700">
                  -{(summaryMetrics.totalTeachersWork * 180000).toLocaleString('fa-IR')} تومان
                </span>
              </div>

              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-700 font-bold">۳. کل حق‌الزحمه اساتید پایه</span>
                <span className="font-mono font-bold text-rose-700">-۳۱,۸۰۰,۰۰۰ تومان</span>
              </div>

              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-700 font-bold">۴. حقوق و دستمزد کادر اجرایی</span>
                <span className="font-mono font-bold text-rose-700">
                  -{summaryMetrics.totalStaffSalaries.toLocaleString('fa-IR')} تومان
                </span>
              </div>

              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-700 font-bold">۵. کل هزینه تغذیه و نهار مدرسه</span>
                <span className="font-mono font-bold text-rose-700">-۶۴,۳۵۰,۰۰۰ تومان</span>
              </div>

              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-700 font-bold">۶. سایر مخارج، قبوض و نگهداری</span>
                <span className="font-mono font-bold text-rose-700">
                  -{summaryMetrics.totalExpenses.toLocaleString('fa-IR')} تومان
                </span>
              </div>

              <div className="p-3 flex items-center justify-between bg-emerald-50/50">
                <span className="text-emerald-900 font-black">۷. بازگشت اقساط وام و کسورات تغذیه به صندوق</span>
                <span className="font-mono font-black text-emerald-700">+۷۲,۴۰۰,۰۰۰ تومان</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Modal: New Expense Modal                                                  */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isNewExpenseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-vazir" dir="rtl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-black text-slate-900">ثبت سند هزینه جدید</h3>
                <button
                  type="button"
                  onClick={() => setIsNewExpenseModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">شرح و عنوان هزینه:</label>
                  <input
                    type="text"
                    placeholder="مثلاً: قبض گاز مدرسه، خرید مایحتاج دفتر، تعمیرات شوفاژ..."
                    value={newExpenseTitle}
                    onChange={(e) => setNewExpenseTitle(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">مبلغ (تومان):</label>
                  <input
                    type="number"
                    value={newExpenseAmount}
                    onChange={(e) => setNewExpenseAmount(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50 font-mono font-bold outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">دسته‌بندی:</label>
                  <select
                    value={newExpenseCategory}
                    onChange={(e) => setNewExpenseCategory(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50 font-bold outline-none"
                  >
                    <option value="قبوض و انشعابات">قبوض و انشعابات</option>
                    <option value="تعمیرات و نگهداری">تعمیرات و نگهداری</option>
                    <option value="پذیرایی و تشریفات">پذیرایی و تشریفات</option>
                    <option value="ملزومات اداری و آموزشی">ملزومات اداری و آموزشی</option>
                    <option value="فوق‌برنامه و اردوها">فوق‌برنامه و اردوها</option>
                    <option value="سایر">سایر</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewExpenseModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleAddExpense}
                  className="px-4 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold cursor-pointer shadow-md"
                >
                  ثبت هزینه
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* Modal: New Loan Modal                                                     */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isNewLoanModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-vazir" dir="rtl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-black text-slate-900">اعطای وام قرض‌الحسنه</h3>
                <button
                  type="button"
                  onClick={() => setIsNewLoanModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">انتخاب طلبه:</label>
                  <select
                    value={newLoanStudentId}
                    onChange={(e) => setNewLoanStudentId(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50 font-bold outline-none"
                  >
                    <option value="">-- انتخاب کنید --</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.grade || '---'})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">مبلغ وام (تومان):</label>
                  <input
                    type="number"
                    value={newLoanAmount}
                    onChange={(e) => setNewLoanAmount(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50 font-mono font-bold outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">مبلغ هر قسط ماهانه (تومان):</label>
                  <input
                    type="number"
                    value={newLoanInstallment}
                    onChange={(e) => setNewLoanInstallment(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50 font-mono font-bold outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">موضوع / علت وام:</label>
                  <input
                    type="text"
                    value={newLoanPurpose}
                    onChange={(e) => setNewLoanPurpose(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewLoanModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleAddLoan}
                  className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer shadow-md"
                >
                  تصویب و ثبت وام
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
