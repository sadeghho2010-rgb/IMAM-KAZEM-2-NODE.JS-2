import React, { useState, useEffect, useMemo } from 'react';
import { 
  Receipt, 
  Users, 
  DollarSign, 
  FileSpreadsheet, 
  Plus, 
  Search, 
  Check, 
  X, 
  CheckCircle2, 
  Printer, 
  TrendingUp, 
  TrendingDown, 
  Building2, 
  Wallet,
  Calendar,
  Layers,
  Edit3,
  ShieldCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { getTodayShamsi } from '../../lib/jalali';
import { motion, AnimatePresence } from 'motion/react';

interface StaffSalaryItem {
  id: string;
  name: string;
  role: string;
  baseSalary: number; // حقوق پایه (تومان)
  overtimeHours: number; // اضافه کاری (ساعت)
  overtimeRate: number; // نرخ هر ساعت اضافه کاری
  bonus: number; // پاداش
  deductions: number; // بیمه و کسورات
  bankAccount: string;
  status: 'pending' | 'paid';
  lastUpdated?: string;
}

interface OperationalExpenseItem {
  id: string;
  title: string;
  category: 'utilities' | 'maintenance' | 'supplies' | 'events' | 'other';
  amount: number;
  date: string;
  recipient: string;
  invoiceNumber?: string;
  paidBy: string;
  notes?: string;
}

interface ExpensesAndReportsProps {
  onNavigateTab?: (tab: string, params?: any) => void;
}

export default function ExpensesAndReports({ onNavigateTab }: ExpensesAndReportsProps) {
  const { currentUser } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<'expenses' | 'staff' | 'balance_sheet'>('expenses');
  const [staffList, setStaffList] = useState<StaffSalaryItem[]>([]);
  const [expenses, setExpenses] = useState<OperationalExpenseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('مهر ۱۴۰۳');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Modals
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);

  // New Expense Form
  const [newExpTitle, setNewExpTitle] = useState('');
  const [newExpCategory, setNewExpCategory] = useState<OperationalExpenseItem['category']>('utilities');
  const [newExpAmount, setNewExpAmount] = useState('3500000');
  const [newExpDate, setNewExpDate] = useState(getTodayShamsi());
  const [newExpRecipient, setNewExpRecipient] = useState('');
  const [newExpInvoice, setNewExpInvoice] = useState('');
  const [newExpNotes, setNewExpNotes] = useState('');

  // New Staff Form
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('مسئول امور اجرایی');
  const [newStaffBase, setNewStaffBase] = useState('8500000');
  const [newStaffOvertime, setNewStaffOvertime] = useState('10');
  const [newStaffAccount, setNewStaffAccount] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [storedStaff, storedExpenses] = await Promise.all([
        localDb.getDocs<StaffSalaryItem>('finance_staff_salaries'),
        localDb.getDocs<OperationalExpenseItem>('finance_operational_expenses')
      ]);

      if (storedStaff && storedStaff.length > 0) {
        setStaffList(storedStaff);
      } else {
        const initialStaff: StaffSalaryItem[] = [
          {
            id: 'staff-1',
            name: 'آقای احمدی',
            role: 'مدیر امور اداری و دفتری',
            baseSalary: 11000000,
            overtimeHours: 15,
            overtimeRate: 80000,
            bonus: 500000,
            deductions: 900000,
            bankAccount: '۶۰۳۷-۹۹۱۱-۱۲۳۴-۵۶۷۸',
            status: 'paid'
          },
          {
            id: 'staff-2',
            name: 'آقای حسینی',
            role: 'مسئول تاسیسات و نگهداری ساختمان',
            baseSalary: 9500000,
            overtimeHours: 20,
            overtimeRate: 70000,
            bonus: 300000,
            deductions: 800000,
            bankAccount: '۶۰۳۷-۹۹۱۱-۸۷۶۵-۴۳۲۱',
            status: 'paid'
          },
          {
            id: 'staff-3',
            name: 'آقای موسوی',
            role: 'مسئول خدمات و پشتیبانی کتابخانه',
            baseSalary: 8500000,
            overtimeHours: 8,
            overtimeRate: 65000,
            bonus: 200000,
            deductions: 700000,
            bankAccount: '۶۰۳۷-۹۹۱۱-۱۱۴۴-۷۷۸۸',
            status: 'pending'
          }
        ];
        for (const s of initialStaff) {
          await localDb.setDoc('finance_staff_salaries', s);
        }
        setStaffList(initialStaff);
      }

      if (storedExpenses && storedExpenses.length > 0) {
        setExpenses(storedExpenses);
      } else {
        const initialExpenses: OperationalExpenseItem[] = [
          {
            id: 'exp-1',
            title: 'قبض گاز ساختمان آموزشی و خوابگاه',
            category: 'utilities',
            amount: 4200000,
            date: '۱۴۰۳/۰۷/۰۵',
            recipient: 'شرکت ملی گاز ایران',
            invoiceNumber: 'GAS-98412',
            paidBy: 'تنخواه‌گردان مدرسه',
            notes: 'دوره شهریور ماه'
          },
          {
            id: 'exp-2',
            title: 'خرید لوازم‌التحریر و کاغذ A4 برای امتحانات',
            category: 'supplies',
            amount: 2800000,
            date: '۱۴۰۳/۰۷/۰۸',
            recipient: 'فروشگاه فرهنگ',
            invoiceNumber: 'INV-4412',
            paidBy: 'مسئول خرید',
            notes: '۱۰ بسته کاغذ و کارتریج پرینتر اداری'
          },
          {
            id: 'exp-3',
            title: 'تعمیر پمپ آب و تاسیسات موتورخانه',
            category: 'maintenance',
            amount: 3600000,
            date: '۱۴۰۳/۰۷/۱۲',
            recipient: 'تاسیساتی برادران کریمی',
            invoiceNumber: 'FAC-102',
            paidBy: 'مسئول تاسیسات',
            notes: 'تعویض پروانه و سرویس دوره‌ای پمپ'
          },
          {
            id: 'exp-4',
            title: 'پذیرایی و برگزاری مراسم آغاز سال تحصیلی حوزه',
            category: 'events',
            amount: 6500000,
            date: '۱۴۰۳/۰۷/۰۱',
            recipient: 'قنادی و پذیرایی بهار',
            invoiceNumber: 'EV-889',
            paidBy: 'امور فرهنگی',
            notes: 'شیرینی، میوه و پک فرهنگی طلاب جدیدالورود'
          }
        ];
        for (const exp of initialExpenses) {
          await localDb.setDoc('finance_operational_expenses', exp);
        }
        setExpenses(initialExpenses);
      }
    } catch (e) {
      console.error('Error loading operational expenses & staff:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const calculateStaffNet = (s: StaffSalaryItem) => {
    const overtime = (s.overtimeHours || 0) * (s.overtimeRate || 0);
    return (s.baseSalary || 0) + overtime + (s.bonus || 0) - (s.deductions || 0);
  };

  const metrics = useMemo(() => {
    const totalExpensesSum = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    const totalStaffPayroll = staffList.reduce((acc, s) => acc + calculateStaffNet(s), 0);
    const totalOutflows = totalExpensesSum + totalStaffPayroll;

    return {
      totalExpensesSum,
      totalStaffPayroll,
      totalOutflows,
      staffCount: staffList.length
    };
  }, [expenses, staffList]);

  // Add Expense
  const handleAddExpense = async () => {
    if (!newExpTitle.trim()) {
      alert('لطفاً عنوان هزینه را وارد کنید.');
      return;
    }
    const newDoc: OperationalExpenseItem = {
      id: `exp-${Date.now()}`,
      title: newExpTitle.trim(),
      category: newExpCategory,
      amount: Number(newExpAmount) || 0,
      date: newExpDate,
      recipient: newExpRecipient,
      invoiceNumber: newExpInvoice,
      paidBy: 'مسئول مالی',
      notes: newExpNotes
    };
    await localDb.setDoc('finance_operational_expenses', newDoc);
    setExpenses(prev => [newDoc, ...prev]);
    showToast('هزینه جاری جدید با موفقیت ثبت شد.');
    setIsAddExpenseOpen(false);
    setNewExpTitle('');
    setNewExpRecipient('');
    setNewExpNotes('');
  };

  // Add Staff
  const handleAddStaff = async () => {
    if (!newStaffName.trim()) {
      alert('لطفاً نام کارمند را وارد کنید.');
      return;
    }
    const newDoc: StaffSalaryItem = {
      id: `staff-${Date.now()}`,
      name: newStaffName.trim(),
      role: newStaffRole,
      baseSalary: Number(newStaffBase) || 0,
      overtimeHours: Number(newStaffOvertime) || 0,
      overtimeRate: 75000,
      bonus: 0,
      deductions: 700000,
      bankAccount: newStaffAccount,
      status: 'pending'
    };
    await localDb.setDoc('finance_staff_salaries', newDoc);
    setStaffList(prev => [...prev, newDoc]);
    showToast(`کارمند جدید (${newStaffName}) ثبت شد.`);
    setIsAddStaffOpen(false);
    setNewStaffName('');
    setNewStaffAccount('');
  };

  // Toggle staff payment
  const handleToggleStaffStatus = async (staff: StaffSalaryItem) => {
    const nextStatus: StaffSalaryItem['status'] = staff.status === 'paid' ? 'pending' : 'paid';
    const updated = { ...staff, status: nextStatus };
    await localDb.setDoc('finance_staff_salaries', updated);
    setStaffList(prev => prev.map(s => s.id === staff.id ? updated : s));
    showToast(`وضعیت حقوق ${staff.name} به "${nextStatus === 'paid' ? 'پرداخت شده' : 'معوقه'}" تغییر یافت.`);
  };

  // Export Excel
  const handleExportExcel = () => {
    if (activeSubTab === 'expenses') {
      const data = expenses.map((e, idx) => ({
        'ردیف': idx + 1,
        'شرح هزینه': e.title,
        'دسته‌بندی': e.category,
        'مبلغ (تومان)': e.amount,
        'تاریخ پرداخت': e.date,
        'دریافت‌کننده / فروشنده': e.recipient,
        'شماره فاکتور': e.invoiceNumber || '---',
        'پرداخت‌کننده': e.paidBy,
        'توضیحات': e.notes || ''
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'هزینه‌های جاری حوزه');
      XLSX.writeFile(wb, `هزینه_های_جاری_${selectedPeriod.replace(/\s+/g, '_')}.xlsx`);
    } else {
      const data = staffList.map((s, idx) => ({
        'ردیف': idx + 1,
        'نام کارمند': s.name,
        'سمت': s.role,
        'حقوق پایه (تومان)': s.baseSalary,
        'ساعت اضافه کاری': s.overtimeHours,
        'مبلغ اضافه کاری (تومان)': s.overtimeHours * s.overtimeRate,
        'پاداش (تومان)': s.bonus,
        'کسورات و بیمه (تومان)': s.deductions,
        'خالص پرداختی (تومان)': calculateStaffNet(s),
        'شماره حساب': s.bankAccount,
        'وضعیت': s.status === 'paid' ? 'پرداخت شده' : 'در انتظار'
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'حقوق کارمندان');
      XLSX.writeFile(wb, `حقوق_کارمندان_${selectedPeriod.replace(/\s+/g, '_')}.xlsx`);
    }
    showToast('فایل اکسل با موفقیت صادر گردید.');
  };

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-3 font-vazir" dir="rtl">
        <div className="w-8 h-8 border-3 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-bold">در حال بارگذاری گزارش‌ها و هزینه‌های مالی...</p>
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
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center shadow-xs border border-slate-200">
            <Receipt size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900">سایر هزینه‌ها و تراز مالی حوزه</h1>
              <span className="px-2.5 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-black rounded-lg">
                هزینه‌های جاری، حقوق و ترازنامه
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              ثبت قبوض و تعمیرات، حقوق کادر اجرایی و اداری، صدور صورت‌حساب مالی و ترازنامه جامع مدرسه
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
            <span>خروجی اکسل</span>
          </button>

          {activeSubTab === 'expenses' ? (
            <button
              type="button"
              onClick={() => setIsAddExpenseOpen(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={15} />
              <span>ثبت هزینه جاری جدید</span>
            </button>
          ) : activeSubTab === 'staff' ? (
            <button
              type="button"
              onClick={() => setIsAddStaffOpen(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={15} />
              <span>ثبت کارمند جدید</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={15} />
              <span>چاپ ترازنامه دوره</span>
            </button>
          )}
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">کل هزینه‌های جاری ثبت‌شده</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
              <TrendingDown size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-700 font-mono">
            {metrics.totalExpensesSum.toLocaleString('fa-IR')} <span className="text-xs font-medium text-rose-600">تومان</span>
          </div>
          <p className="text-[11px] text-slate-400">قبوض، تعمیرات، نگهداری و تشریفات</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">حقوق و دستمزد کادر اجرایی</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Users size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-900 font-mono">
            {metrics.totalStaffPayroll.toLocaleString('fa-IR')} <span className="text-xs font-medium text-indigo-700">تومان</span>
          </div>
          <p className="text-[11px] text-slate-400">{metrics.staffCount} پرسنل اداری، خدمات و تاسیسات</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">مجموع مصارف این بخش</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Wallet size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {metrics.totalOutflows.toLocaleString('fa-IR')} <span className="text-xs font-medium text-slate-500">تومان</span>
          </div>
          <p className="text-[11px] text-slate-400">دوره مالی: {selectedPeriod}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">وضعیت انطباق با بودجه</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">
            مجاز <span className="text-xs font-medium text-slate-500">طبق ردیف بودجه</span>
          </div>
          <p className="text-[11px] text-slate-400">انحراف از سقف بودجه: ۰٪</p>
        </div>
      </div>

      {/* Sub-Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('expenses')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer",
            activeSubTab === 'expenses'
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          )}
        >
          <Receipt size={15} />
          <span>هزینه‌های جاری، قبوض و نگهداری ({expenses.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('staff')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer",
            activeSubTab === 'staff'
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          )}
        >
          <Users size={15} />
          <span>حقوق و دستمزد کادر اجرایی ({staffList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('balance_sheet')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer",
            activeSubTab === 'balance_sheet'
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          )}
        >
          <TrendingUp size={15} />
          <span>ترازنامه مالی جامع و مقایسه‌ای</span>
        </button>
      </div>

      {/* VIEW 1: Operational Expenses */}
      {activeSubTab === 'expenses' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                  <th className="p-3.5">شرح هزینه</th>
                  <th className="p-3.5 text-center">دسته‌بندی</th>
                  <th className="p-3.5 text-center">تاریخ پرداخت</th>
                  <th className="p-3.5 text-center font-black text-rose-700 bg-rose-50/50">مبلغ هزینه</th>
                  <th className="p-3.5">دریافت‌کننده / فروشنده</th>
                  <th className="p-3.5 text-center">شماره فاکتور</th>
                  <th className="p-3.5">توضیحات و بابت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">{e.title}</td>
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-bold text-[10px]">
                        {e.category === 'utilities' ? 'قبوض آب/برق/گاز' :
                         e.category === 'maintenance' ? 'تعمیرات و نگهداری' :
                         e.category === 'supplies' ? 'اقلام مصرفی و ملزومات' :
                         e.category === 'events' ? 'مراسمات و مناسبت‌ها' : 'سایر'}
                      </span>
                    </td>
                    <td className="p-3.5 text-center font-mono text-slate-600 text-[11px]">{e.date}</td>
                    <td className="p-3.5 text-center font-mono font-black text-rose-700 text-sm bg-rose-50/30">
                      {e.amount.toLocaleString('fa-IR')} تومان
                    </td>
                    <td className="p-3.5 text-slate-800 font-medium">{e.recipient}</td>
                    <td className="p-3.5 text-center font-mono text-slate-500 text-[11px]">{e.invoiceNumber || '---'}</td>
                    <td className="p-3.5 text-slate-500 text-[11px]">{e.notes || '---'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: Staff Salaries */}
      {activeSubTab === 'staff' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                  <th className="p-3.5">نام کارمند</th>
                  <th className="p-3.5">سمت و مسئولیت</th>
                  <th className="p-3.5 text-center">حقوق پایه</th>
                  <th className="p-3.5 text-center">اضافه کاری</th>
                  <th className="p-3.5 text-center text-emerald-800">پاداش</th>
                  <th className="p-3.5 text-center text-rose-700">کسورات و بیمه</th>
                  <th className="p-3.5 text-center font-black text-slate-900 bg-slate-200/50">خالص پرداختی</th>
                  <th className="p-3.5 text-center">وضعیت پرداخت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffList.map(s => {
                  const net = calculateStaffNet(s);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{s.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{s.bankAccount}</div>
                      </td>
                      <td className="p-3.5 text-slate-700 font-medium">{s.role}</td>
                      <td className="p-3.5 text-center font-mono text-slate-700">{s.baseSalary.toLocaleString('fa-IR')}</td>
                      <td className="p-3.5 text-center font-mono text-slate-800 font-bold">{s.overtimeHours} س</td>
                      <td className="p-3.5 text-center font-mono text-emerald-700 font-bold">+{s.bonus.toLocaleString('fa-IR')}</td>
                      <td className="p-3.5 text-center font-mono text-rose-600 font-bold">-{s.deductions.toLocaleString('fa-IR')}</td>
                      <td className="p-3.5 text-center font-mono font-black text-indigo-900 text-sm bg-indigo-50/40">
                        {net.toLocaleString('fa-IR')} تومان
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStaffStatus(s)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer transition-all",
                            s.status === 'paid'
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          )}
                        >
                          {s.status === 'paid' ? 'پرداخت شده' : 'معوقه'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: Comprehensive Balance Sheet */}
      {activeSubTab === 'balance_sheet' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900">ترازنامه مالی مدرسه و حوزه علمیه</h3>
              <p className="text-xs text-slate-500 mt-0.5">صورت سود و زیان و گردش نقدینگی - دوره {selectedPeriod}</p>
            </div>
            <span className="px-3 py-1 bg-slate-100 text-slate-800 rounded-xl text-xs font-mono font-bold">
              تاریخ گزارش: {getTodayShamsi()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Left: Revenues */}
            <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-3">
              <div className="flex items-center gap-2 font-black text-emerald-900 text-sm border-b border-emerald-200 pb-2">
                <TrendingUp size={16} />
                <span>منابع ورودی و درآمدهای حوزه (تومان)</span>
              </div>
              <div className="space-y-2 divide-y divide-emerald-100">
                <div className="flex justify-between pt-1.5">
                  <span className="text-slate-700">۱. شهریه دریافتی از مرکز مدیریت و مراجع:</span>
                  <span className="font-mono font-black text-emerald-800">۸۵,۰۰۰,۰۰۰</span>
                </div>
                <div className="flex justify-between pt-1.5">
                  <span className="text-slate-700">۲. وجوهات شرعیه و موقوفات مدرسه:</span>
                  <span className="font-mono font-black text-emerald-800">۴۵,۰۰۰,۰۰۰</span>
                </div>
                <div className="flex justify-between pt-1.5">
                  <span className="text-slate-700">۳. کمک‌های خیرین و حامیان:</span>
                  <span className="font-mono font-black text-emerald-800">۳۰,۰۰۰,۰۰۰</span>
                </div>
                <div className="flex justify-between pt-1.5">
                  <span className="text-slate-700">۴. بازگشت اقساط وام‌های صندوق:</span>
                  <span className="font-mono font-black text-emerald-800">۸,۰۰۰,۰۰۰</span>
                </div>
                <div className="flex justify-between pt-2 border-t-2 border-emerald-300 font-black text-emerald-950 text-sm">
                  <span>مجموع کل منابع ورودی:</span>
                  <span className="font-mono text-base">۱۶۸,۰۰۰,۰۰۰ تومان</span>
                </div>
              </div>
            </div>

            {/* Right: Expenses */}
            <div className="p-4 bg-rose-50/60 rounded-2xl border border-rose-200 space-y-3">
              <div className="flex items-center gap-2 font-black text-rose-900 text-sm border-b border-rose-200 pb-2">
                <TrendingDown size={16} />
                <span>مصارف، پرداختی‌ها و هزینه‌ها (تومان)</span>
              </div>
              <div className="space-y-2 divide-y divide-rose-100">
                <div className="flex justify-between pt-1.5">
                  <span className="text-slate-700">۱. شهریه پرداختی به طلاب:</span>
                  <span className="font-mono font-black text-rose-800">۵۲,۰۰۰,۰۰۰</span>
                </div>
                <div className="flex justify-between pt-1.5">
                  <span className="text-slate-700">۲. حق‌الزحمه اساتید و مدرسین:</span>
                  <span className="font-mono font-black text-rose-800">۲۸,۵۰۰,۰۰۰</span>
                </div>
                <div className="flex justify-between pt-1.5">
                  <span className="text-slate-700">۳. حق سرپرستی و پیگیری اساتید پایه:</span>
                  <span className="font-mono font-black text-rose-800">۱۸,۵۰۰,۰۰۰</span>
                </div>
                <div className="flex justify-between pt-1.5">
                  <span className="text-slate-700">۴. حقوق و دستمزد کادر اجرایی:</span>
                  <span className="font-mono font-black text-rose-800">{metrics.totalStaffPayroll.toLocaleString('fa-IR')}</span>
                </div>
                <div className="flex justify-between pt-1.5">
                  <span className="text-slate-700">۵. هزینه‌های جاری و قبوض:</span>
                  <span className="font-mono font-black text-rose-800">{metrics.totalExpensesSum.toLocaleString('fa-IR')}</span>
                </div>
                <div className="flex justify-between pt-2 border-t-2 border-rose-300 font-black text-rose-950 text-sm">
                  <span>مجموع کل مصارف و هزینه‌ها:</span>
                  <span className="font-mono text-base">
                    {(52000000 + 28500000 + 18500000 + metrics.totalStaffPayroll + metrics.totalExpensesSum).toLocaleString('fa-IR')} تومان
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {isAddExpenseOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Plus size={16} className="text-slate-800" />
                <span>ثبت هزینه جاری جدید</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddExpenseOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-600 font-bold">شرح هزینه:</label>
                <input
                  type="text"
                  value={newExpTitle}
                  onChange={(e) => setNewExpTitle(e.target.value)}
                  placeholder="مثلاً: قبض برق خوابگاه طلاب"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-600 font-bold">دسته‌بندی:</label>
                  <select
                    value={newExpCategory}
                    onChange={(e: any) => setNewExpCategory(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    <option value="utilities">قبوض آب/برق/گاز</option>
                    <option value="maintenance">تعمیرات و نگهداری</option>
                    <option value="supplies">اقلام مصرفی و ملزومات</option>
                    <option value="events">مراسمات و مناسبت‌ها</option>
                    <option value="other">سایر</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-600 font-bold">مبلغ (تومان):</label>
                  <input
                    type="number"
                    value={newExpAmount}
                    onChange={(e) => setNewExpAmount(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-600 font-bold">دریافت‌کننده / فروشگاه:</label>
                  <input
                    type="text"
                    value={newExpRecipient}
                    onChange={(e) => setNewExpRecipient(e.target.value)}
                    placeholder="شرکت برق..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-600 font-bold">شماره فاکتور / پیگیری:</label>
                  <input
                    type="text"
                    value={newExpInvoice}
                    onChange={(e) => setNewExpInvoice(e.target.value)}
                    placeholder="INV-..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 font-bold">توضیحات و بابت:</label>
                <input
                  type="text"
                  value={newExpNotes}
                  onChange={(e) => setNewExpNotes(e.target.value)}
                  placeholder="جزئیات هزینه..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddExpenseOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleAddExpense}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                ثبت هزینه
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Plus size={16} className="text-slate-800" />
                <span>ثبت کارمند جدید حوزه</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddStaffOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-600 font-bold">نام و نام خانوادگی:</label>
                <input
                  type="text"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="مثلاً: آقای کاظمی"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 font-bold">سمت و مسئولیت:</label>
                <input
                  type="text"
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value)}
                  placeholder="مسئول کتابخانه، انباردار..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-600 font-bold">حقوق پایه (تومان):</label>
                  <input
                    type="number"
                    value={newStaffBase}
                    onChange={(e) => setNewStaffBase(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-600 font-bold">اضافه کاری (ساعت):</label>
                  <input
                    type="number"
                    value={newStaffOvertime}
                    onChange={(e) => setNewStaffOvertime(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 font-bold">شماره کارت یا حساب:</label>
                <input
                  type="text"
                  value={newStaffAccount}
                  onChange={(e) => setNewStaffAccount(e.target.value)}
                  placeholder="۶۰۳۷-..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddStaffOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleAddStaff}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                ثبت کارمند
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
