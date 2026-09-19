import React, { useState, useEffect, useMemo } from 'react';
import { 
  Receipt, 
  Users, 
  DollarSign, 
  FileSpreadsheet, 
  Plus, 
  Search, 
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
  Trash2,
  PieChart as PieChartIcon,
  BarChart3,
  Paperclip,
  ExternalLink,
  Filter,
  Check,
  AlertTriangle,
  FileText,
  UserCheck,
  Tag,
  ArrowUpRight
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip, 
  Legend, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { getTodayShamsi } from '../../lib/jalali';
import { motion, AnimatePresence } from 'motion/react';
import { BudgetRow, ExpenseRecord } from '../../types';

interface ExpensesAndReportsProps {
  onNavigateTab?: (tab: string, params?: any) => void;
}

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b', '#ef4444'];

export default function ExpensesAndReports({ onNavigateTab }: ExpensesAndReportsProps) {
  const { currentUser, users } = useAuth();

  // Active Sub-Tab: 'budget_rows' | 'expenses' | 'statistics'
  const [activeSubTab, setActiveSubTab] = useState<'budget_rows' | 'expenses' | 'statistics'>('budget_rows');

  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // Filters for Expenses Table
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBudgetFilter, setSelectedBudgetFilter] = useState('all');
  const [selectedPayerFilter, setSelectedPayerFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  // Filters for Statistics Tab
  const [statsPeriodFilter, setStatsPeriodFilter] = useState('all');
  const [statsBudgetFilter, setStatsBudgetFilter] = useState('all');
  const [statsPayerFilter, setStatsPayerFilter] = useState('all');

  // Modals
  const [isAddBudgetOpen, setIsAddBudgetOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetRow | null>(null);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [viewingExpense, setViewingExpense] = useState<ExpenseRecord | null>(null);

  // Budget Row Form States
  const [budgetCode, setBudgetCode] = useState('');
  const [budgetTitle, setBudgetTitle] = useState('');
  const [budgetAllocated, setBudgetAllocated] = useState('');
  const [budgetPeriod, setBudgetPeriod] = useState('سال تحصیلی ۱۴۰۳-۱۴۰۴');
  const [budgetDesc, setBudgetDesc] = useState('');

  // Expense Form States
  const [expTitle, setExpTitle] = useState('');
  const [expDate, setExpDate] = useState(getTodayShamsi());
  const [expAmount, setExpAmount] = useState('');
  const [expBudgetMode, setExpBudgetMode] = useState<'select' | 'manual'>('select');
  const [expSelectedBudgetRowId, setExpSelectedBudgetRowId] = useState('');
  const [expManualBudgetTitle, setExpManualBudgetTitle] = useState('');
  const [expManualBudgetCode, setExpManualBudgetCode] = useState('');
  const [expPayer, setExpPayer] = useState('');
  const [expCategory, setExpCategory] = useState('تغذیه و پذیرایی');
  const [expRecipient, setExpRecipient] = useState('');
  const [expInvoiceNum, setExpInvoiceNum] = useState('');
  const [expAttachmentUrl, setExpAttachmentUrl] = useState('');
  const [expDesc, setExpDesc] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Load Budget Rows and Expenses from Database
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [storedBudgets, storedExpenses] = await Promise.all([
        localDb.getDocs<BudgetRow>('finance_budget_rows'),
        localDb.getDocs<ExpenseRecord>('finance_operational_expenses')
      ]);

      let bList = storedBudgets || [];
      if (bList.length === 0) {
        // Initial Seed Budget Rows
        bList = [
          {
            id: 'b-013',
            code: '013',
            title: 'ردیف تغذیه، نهار و پذیرایی طلاب و اساتید',
            allocatedAmount: 180000000,
            period: 'سال تحصیلی ۱۴۰۳-۱۴۰۴',
            description: 'بودجه مصوب خرید اقلام غذایی، نهار، پذیرایی جلسات و مراسمات',
            createdAt: new Date().toISOString()
          },
          {
            id: 'b-014',
            code: '014',
            title: 'ردیف تاسیسات، تعمیرات و نگهداری ساختمان',
            allocatedAmount: 95000000,
            period: 'سال تحصیلی ۱۴۰۳-۱۴۰۴',
            description: 'هزینه‌های تاسیساتی موتورخانه، برق، گاز، رنگ‌آمیزی و سرویس‌ها',
            createdAt: new Date().toISOString()
          },
          {
            id: 'b-015',
            code: '015',
            title: 'ردیف امور فرهنگی، مراسمات و اردوهای زیارتی',
            allocatedAmount: 120000000,
            period: 'سال تحصیلی ۱۴۰۳-۱۴۰۴',
            description: 'برگزاری مراسم‌های مذهبی، اردوهای مشهد و عتبات و جوایز',
            createdAt: new Date().toISOString()
          },
          {
            id: 'b-016',
            code: '016',
            title: 'ردیف ملزومات اداری، چاپی و مصرفی مدرسه',
            allocatedAmount: 45000000,
            period: 'سال تحصیلی ۱۴۰۳-۱۴۰۴',
            description: 'کاغذ، لوازم‌التحریر، شارژ کارتریج و ملزومات آموزشی',
            createdAt: new Date().toISOString()
          },
          {
            id: 'b-017',
            code: '017',
            title: 'ردیف فناوری اطلاعات، اینترنت و تجهیزات صوتی و تصویری',
            allocatedAmount: 50000000,
            period: 'سال تحصیلی ۱۴۰۳-۱۴۰۴',
            description: 'تجهیزات رایانه، شبکه، ارتقاء دوربین‌ها و اشتراک سامانه‌ها',
            createdAt: new Date().toISOString()
          }
        ];
        for (const b of bList) {
          await localDb.setDoc('finance_budget_rows', b);
        }
      }
      setBudgetRows(bList);

      let eList = storedExpenses || [];
      if (eList.length === 0) {
        // Initial Seed Expenses
        eList = [
          {
            id: 'exp-101',
            title: 'خرید برنج و روغن جهت آشپزخانه مدرسه',
            date: '۱۴۰۳/۰۷/۱۰',
            amount: 24500000,
            budgetRowId: 'b-013',
            budgetRowTitle: 'ردیف تغذیه، نهار و پذیرایی طلاب و اساتید',
            budgetCode: '013',
            payer: 'مسئول خرید و تدارکات (آقای رضایی)',
            category: 'تغذیه و پذیرایی',
            recipient: 'فروشگاه عمده مواد غذایی مروارید',
            invoiceNumber: 'INV-8841',
            attachmentUrl: 'https://example.com/invoices/inv-8841.pdf',
            description: 'خرید ۲۰ کیسه برنج طارم و ۴ کارتن روغن مایع',
            status: 'approved',
            createdAt: new Date().toISOString(),
            createdByName: 'مسئول مالی'
          },
          {
            id: 'exp-102',
            title: 'سرویس و تعویض پمپ موتورخانه خوابگاه',
            date: '۱۴۰۳/۰۷/۱۵',
            amount: 14200000,
            budgetRowId: 'b-014',
            budgetRowTitle: 'ردیف تاسیسات، تعمیرات و نگهداری ساختمان',
            budgetCode: '014',
            payer: 'مسئول تاسیسات (آقای حسینی)',
            category: 'تاسیسات و نگهداری',
            recipient: 'خدمات فنی تاسیسات البرز',
            invoiceNumber: 'INV-9023',
            attachmentUrl: '',
            description: 'تعمیر اضطراری پمپ شوفاژ و تعویض پروانه',
            status: 'approved',
            createdAt: new Date().toISOString(),
            createdByName: 'مسئول مالی'
          },
          {
            id: 'exp-103',
            title: 'هزینه پذیرایی مراسم ولادت حضرت رسول (ص)',
            date: '۱۴۰۳/۰۷/۲۱',
            amount: 9800000,
            budgetRowId: 'b-015',
            budgetRowTitle: 'ردیف امور فرهنگی، مراسمات و اردوهای زیارتی',
            budgetCode: '015',
            payer: 'مسئول فرهنگی (حجت‌الاسلام موسوی)',
            category: 'فرهنگی و مناسبت‌ها',
            recipient: 'شیرینی‌سرای نخل',
            invoiceNumber: 'INV-9110',
            attachmentUrl: '',
            description: 'خرید شیرینی، شربت و ظروف یکبار مصرف جشن',
            status: 'approved',
            createdAt: new Date().toISOString(),
            createdByName: 'مسئول مالی'
          },
          {
            id: 'exp-104',
            title: 'خرید کاغذ A4 و کارتریج چاپگرهای اداری',
            date: '۱۴۰۳/۰۷/۲۵',
            amount: 6700000,
            budgetRowId: 'b-016',
            budgetRowTitle: 'ردیف ملزومات اداری، چاپی و مصرفی مدرسه',
            budgetCode: '016',
            payer: 'مسئول اداری (آقای احمدی)',
            category: 'اداری و ملزومات',
            recipient: 'لوازم‌التحریر نگین',
            invoiceNumber: 'INV-9204',
            attachmentUrl: '',
            description: '۱۰ بسته کاغذ A4 دبل آ و ۲ عدد شارژ تونر',
            status: 'approved',
            createdAt: new Date().toISOString(),
            createdByName: 'مسئول مالی'
          },
          {
            id: 'exp-105',
            title: 'شارژ اشتراک اینترنت اختصاصی و پهنای باند مدرسه',
            date: '۱۴۰۳/۰۷/۲۸',
            amount: 4500000,
            budgetRowId: 'b-017',
            budgetRowTitle: 'ردیف فناوری اطلاعات، اینترنت و تجهیزات صوتی و تصویری',
            budgetCode: '017',
            payer: 'مسئول انفورماتیک',
            category: 'فناوری و ارتباطات',
            recipient: 'شرکت ارتباطات شاتل',
            invoiceNumber: 'INV-9311',
            attachmentUrl: '',
            description: 'اشتراک اینترنت ۳ ماهه پهنای باند اختصاصی',
            status: 'approved',
            createdAt: new Date().toISOString(),
            createdByName: 'مسئول مالی'
          }
        ];
        for (const e of eList) {
          await localDb.setDoc('finance_operational_expenses', e);
        }
      }
      setExpenses(eList);

    } catch (err) {
      console.error('Error loading expenses and budgets:', err);
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

  // Compute spent and remaining per budget row
  const budgetRowsWithMetrics = useMemo(() => {
    return budgetRows.map(b => {
      const relatedExp = expenses.filter(e => e.budgetRowId === b.id || (e.budgetCode && e.budgetCode === b.code));
      const spent = relatedExp.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const remaining = Math.max(0, b.allocatedAmount - spent);
      const percent = b.allocatedAmount > 0 ? Math.min(100, Math.round((spent / b.allocatedAmount) * 100)) : 0;
      return {
        ...b,
        spentAmount: spent,
        remainingAmount: remaining,
        consumptionPercent: percent,
        expenseCount: relatedExp.length
      };
    });
  }, [budgetRows, expenses]);

  // Total summary metrics
  const totalAllocatedBudget = useMemo(() => budgetRows.reduce((acc, b) => acc + (Number(b.allocatedAmount) || 0), 0), [budgetRows]);
  const totalSpentExpenses = useMemo(() => expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0), [expenses]);
  const totalRemainingBudget = Math.max(0, totalAllocatedBudget - totalSpentExpenses);
  const totalPercentUsed = totalAllocatedBudget > 0 ? Math.round((totalSpentExpenses / totalAllocatedBudget) * 100) : 0;

  // Filtered Expenses List
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const matchSearch = 
        !searchQuery || 
        exp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (exp.recipient && exp.recipient.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (exp.payer && exp.payer.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (exp.budgetRowTitle && exp.budgetRowTitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (exp.invoiceNumber && exp.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchBudget = 
        selectedBudgetFilter === 'all' || 
        exp.budgetRowId === selectedBudgetFilter || 
        exp.budgetCode === selectedBudgetFilter;

      const matchPayer = 
        selectedPayerFilter === 'all' || 
        exp.payer === selectedPayerFilter;

      const matchCategory = 
        selectedCategoryFilter === 'all' || 
        exp.category === selectedCategoryFilter;

      return matchSearch && matchBudget && matchPayer && matchCategory;
    });
  }, [expenses, searchQuery, selectedBudgetFilter, selectedPayerFilter, selectedCategoryFilter]);

  // Unique lists for filter dropdowns
  const uniquePayers = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach(e => { if (e.payer) set.add(e.payer); });
    return Array.from(set);
  }, [expenses]);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach(e => { if (e.category) set.add(e.category); });
    return Array.from(set);
  }, [expenses]);

  // Pie Chart Data: Budget breakdown
  const pieChartData = useMemo(() => {
    return budgetRowsWithMetrics.map((b) => ({
      name: `ردیف ${b.code}: ${b.title.length > 20 ? b.title.slice(0, 20) + '...' : b.title}`,
      fullName: b.title,
      code: b.code,
      value: b.spentAmount || 0,
      allocated: b.allocatedAmount,
      remaining: b.remainingAmount
    })).filter(d => d.value > 0);
  }, [budgetRowsWithMetrics]);

  // Bar Chart Data: Allocated vs Spent
  const barChartData = useMemo(() => {
    return budgetRowsWithMetrics.map((b) => ({
      name: `کد ${b.code}`,
      title: b.title,
      مصوب: b.allocatedAmount / 1000000,
      مصرف_شده: (b.spentAmount || 0) / 1000000,
      مانده: (b.remainingAmount || 0) / 1000000
    }));
  }, [budgetRowsWithMetrics]);

  // Payer Statistics
  const payerStats = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    expenses.forEach(e => {
      const p = e.payer || 'نامشخص';
      if (!map[p]) map[p] = { total: 0, count: 0 };
      map[p].total += Number(e.amount) || 0;
      map[p].count += 1;
    });
    return Object.entries(map).map(([payer, data]) => ({
      payer,
      total: data.total,
      count: data.count,
      percent: totalSpentExpenses > 0 ? Math.round((data.total / totalSpentExpenses) * 100) : 0
    })).sort((a, b) => b.total - a.total);
  }, [expenses, totalSpentExpenses]);

  // Category Statistics
  const categoryStats = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    expenses.forEach(e => {
      const c = e.category || 'متفرقه';
      if (!map[c]) map[c] = { total: 0, count: 0 };
      map[c].total += Number(e.amount) || 0;
      map[c].count += 1;
    });
    return Object.entries(map).map(([category, data]) => ({
      category,
      total: data.total,
      count: data.count,
      percent: totalSpentExpenses > 0 ? Math.round((data.total / totalSpentExpenses) * 100) : 0
    })).sort((a, b) => b.total - a.total);
  }, [expenses, totalSpentExpenses]);

  // Handle Save Budget Row
  const handleSaveBudgetRow = async () => {
    if (!budgetCode.trim() || !budgetTitle.trim()) {
      showToast('لطفاً کد و عنوان ردیف بودجه را وارد نمایید.');
      return;
    }
    const alloc = Number(budgetAllocated) || 0;
    if (alloc <= 0) {
      showToast('لطفاً مبلغ مصوب بودجه را به درستی وارد نمایید.');
      return;
    }

    const docId = editingBudget ? editingBudget.id : `b-${budgetCode.trim()}-${Date.now()}`;
    const newBudget: BudgetRow = {
      id: docId,
      code: budgetCode.trim(),
      title: budgetTitle.trim(),
      allocatedAmount: alloc,
      period: budgetPeriod.trim() || 'سال تحصیلی ۱۴۰۳-۱۴۰۴',
      description: budgetDesc.trim(),
      createdAt: editingBudget?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await localDb.setDoc('finance_budget_rows', newBudget);
    setBudgetRows(prev => {
      const idx = prev.findIndex(b => b.id === docId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newBudget;
        return copy;
      }
      return [...prev, newBudget];
    });

    setIsAddBudgetOpen(false);
    setEditingBudget(null);
    setBudgetCode('');
    setBudgetTitle('');
    setBudgetAllocated('');
    setBudgetDesc('');
    showToast(`ردیف بودجه «${newBudget.title}» با موفقیت ذخیره شد.`);
  };

  // Handle Save Expense
  const handleSaveExpense = async () => {
    if (!expTitle.trim()) {
      showToast('لطفاً عنوان هزینه را وارد نمایید.');
      return;
    }
    const amt = Number(expAmount) || 0;
    if (amt <= 0) {
      showToast('لطفاً مبلغ معتبر برای هزینه وارد نمایید.');
      return;
    }

    let bRowId = '';
    let bRowTitle = '';
    let bCode = '';

    if (expBudgetMode === 'select') {
      const found = budgetRows.find(b => b.id === expSelectedBudgetRowId);
      if (found) {
        bRowId = found.id;
        bRowTitle = found.title;
        bCode = found.code;
      } else {
        bRowTitle = 'ردیف عمومی';
        bCode = '000';
      }
    } else {
      bRowTitle = expManualBudgetTitle.trim() || 'ردیف دستی';
      bCode = expManualBudgetCode.trim() || '000';
    }

    const docId = editingExpense ? editingExpense.id : `exp-${Date.now()}`;
    const newExp: ExpenseRecord = {
      id: docId,
      title: expTitle.trim(),
      date: expDate.trim() || getTodayShamsi(),
      amount: amt,
      budgetRowId: bRowId || undefined,
      budgetRowTitle: bRowTitle,
      budgetCode: bCode,
      payer: expPayer.trim() || currentUser?.fullName || 'تنخواه‌دار مدرسه',
      category: expCategory.trim() || 'متفرقه',
      recipient: expRecipient.trim(),
      invoiceNumber: expInvoiceNum.trim(),
      attachmentUrl: expAttachmentUrl.trim(),
      description: expDesc.trim(),
      status: 'approved',
      createdAt: editingExpense?.createdAt || new Date().toISOString(),
      createdByName: currentUser?.fullName || 'مسئول مالی'
    };

    await localDb.setDoc('finance_operational_expenses', newExp);
    setExpenses(prev => {
      const idx = prev.findIndex(e => e.id === docId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newExp;
        return copy;
      }
      return [newExp, ...prev];
    });

    setIsAddExpenseOpen(false);
    setEditingExpense(null);
    setExpTitle('');
    setExpAmount('');
    setExpRecipient('');
    setExpInvoiceNum('');
    setExpAttachmentUrl('');
    setExpDesc('');
    showToast(`هزینه «${newExp.title}» با موفقیت ثبت شد.`);
  };

  // Delete Budget Row
  const handleDeleteBudgetRow = async (id: string) => {
    if (!window.confirm('آیا از حذف این ردیف بودجه اطمینان دارید؟')) return;
    await localDb.deleteDoc('finance_budget_rows', id);
    setBudgetRows(prev => prev.filter(b => b.id !== id));
    showToast('ردیف بودجه با موفقیت حذف شد.');
  };

  // Delete Expense
  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm('آیا از حذف این سند هزینه اطمینان دارید؟')) return;
    await localDb.deleteDoc('finance_operational_expenses', id);
    setExpenses(prev => prev.filter(e => e.id !== id));
    showToast('سند هزینه با موفقیت حذف شد.');
  };

  // Open Edit Modal for Budget Row
  const handleOpenEditBudget = (b: BudgetRow) => {
    setEditingBudget(b);
    setBudgetCode(b.code);
    setBudgetTitle(b.title);
    setBudgetAllocated(b.allocatedAmount.toString());
    setBudgetPeriod(b.period);
    setBudgetDesc(b.description || '');
    setIsAddBudgetOpen(true);
  };

  // Open Edit Modal for Expense
  const handleOpenEditExpense = (e: ExpenseRecord) => {
    setEditingExpense(e);
    setExpTitle(e.title);
    setExpDate(e.date);
    setExpAmount(e.amount.toString());
    if (e.budgetRowId) {
      setExpBudgetMode('select');
      setExpSelectedBudgetRowId(e.budgetRowId);
    } else {
      setExpBudgetMode('manual');
      setExpManualBudgetTitle(e.budgetRowTitle || '');
      setExpManualBudgetCode(e.budgetCode || '');
    }
    setExpPayer(e.payer);
    setExpCategory(e.category);
    setExpRecipient(e.recipient || '');
    setExpInvoiceNum(e.invoiceNumber || '');
    setExpAttachmentUrl(e.attachmentUrl || '');
    setExpDesc(e.description || '');
    setIsAddExpenseOpen(true);
  };

  // Export Expenses to Excel
  const handleExportExpensesExcel = () => {
    const data = filteredExpenses.map((exp, idx) => ({
      'ردیف': idx + 1,
      'عنوان هزینه': exp.title,
      'تاریخ': exp.date,
      'کد ردیف بودجه': exp.budgetCode || '-',
      'ردیف بودجه': exp.budgetRowTitle || '-',
      'پرداخت‌کننده / تنخواه‌دار': exp.payer,
      'موضوع / دسته‌بندی': exp.category,
      'مبلغ (تومان)': exp.amount,
      'طرف حساب / فروشنده': exp.recipient || '-',
      'شماره فاکتور / سند': exp.invoiceNumber || '-',
      'پیوست / لینک فاکتور': exp.attachmentUrl || '-',
      'توضیحات': exp.description || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'گزارش هزینه‌ها');
    XLSX.writeFile(wb, `گزارش_هزینه‌ها_${getTodayShamsi().replace(/\//g, '_')}.xlsx`);
    showToast('فایل اکسل هزینه‌ها با موفقیت دانلود شد.');
  };

  // Export Budget Rows to Excel
  const handleExportBudgetExcel = () => {
    const data = budgetRowsWithMetrics.map((b, idx) => ({
      'ردیف': idx + 1,
      'کد ردیف': b.code,
      'عنوان ردیف بودجه': b.title,
      'دوره زمانی': b.period,
      'سقف مصوب بودجه (تومان)': b.allocatedAmount,
      'مبلغ مصرف‌شده (تومان)': b.spentAmount,
      'مانده بودجه (تومان)': b.remainingAmount,
      'درصد مصرف': `${b.consumptionPercent}%`,
      'تعداد اسناد هزینه': b.expenseCount,
      'توضیحات': b.description || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ردیف‌های بودجه');
    XLSX.writeFile(wb, `ردیف‌های_بودجه_${getTodayShamsi().replace(/\//g, '_')}.xlsx`);
    showToast('فایل اکسل ردیف‌های بودجه با موفقیت دانلود شد.');
  };

  return (
    <div className="space-y-6 font-vazir pb-16" dir="rtl">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2 text-sm font-bold"
          >
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header & Sub-Tabs Navigation */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-linear-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <Receipt size={24} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>مدیریت هزینه‌ها و ردیف‌های بودجه</span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                تعریف سرفصل‌های بودجه با کد اختصاصی، ثبت اسناد هزینه با پیوست فاکتور، پیگیری تنخواه‌داران و تحلیل آماری
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeSubTab === 'budget_rows' && (
              <>
                <button
                  onClick={() => {
                    setEditingBudget(null);
                    setBudgetCode(`0${budgetRows.length + 13}`);
                    setBudgetTitle('');
                    setBudgetAllocated('');
                    setBudgetPeriod('سال تحصیلی ۱۴۰۳-۱۴۰۴');
                    setBudgetDesc('');
                    setIsAddBudgetOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  <Plus size={16} />
                  <span>تعریف ردیف بودجه جدید</span>
                </button>

                <button
                  onClick={handleExportBudgetExcel}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 transition-all cursor-pointer"
                >
                  <FileSpreadsheet size={16} />
                  <span>اکسل ردیف‌ها</span>
                </button>
              </>
            )}

            {activeSubTab === 'expenses' && (
              <>
                <button
                  onClick={() => {
                    setEditingExpense(null);
                    setExpTitle('');
                    setExpDate(getTodayShamsi());
                    setExpAmount('');
                    setExpBudgetMode('select');
                    setExpSelectedBudgetRowId(budgetRows[0]?.id || '');
                    setExpPayer(currentUser?.fullName || 'مسئول خرید');
                    setExpCategory('تغذیه و پذیرایی');
                    setExpRecipient('');
                    setExpInvoiceNum('');
                    setExpAttachmentUrl('');
                    setExpDesc('');
                    setIsAddExpenseOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  <Plus size={16} />
                  <span>ثبت سند هزینه جدید</span>
                </button>

                <button
                  onClick={handleExportExpensesExcel}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 transition-all cursor-pointer"
                >
                  <FileSpreadsheet size={16} />
                  <span>اکسل هزینه‌ها</span>
                </button>
              </>
            )}

            {activeSubTab === 'statistics' && (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <Printer size={16} />
                <span>چاپ گزارش تحلیلی</span>
              </button>
            )}
          </div>
        </div>

        {/* 3 Primary Navigation Sub-Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <button
            onClick={() => setActiveSubTab('budget_rows')}
            className={cn(
              "flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-xs transition-all cursor-pointer",
              activeSubTab === 'budget_rows'
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 ring-2 ring-indigo-600/20"
                : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60"
            )}
          >
            <Layers size={17} />
            <span>ردیف‌های بودجه</span>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-black", activeSubTab === 'budget_rows' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700")}>
              {budgetRows.length} ردیف
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('expenses')}
            className={cn(
              "flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-xs transition-all cursor-pointer",
              activeSubTab === 'expenses'
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 ring-2 ring-indigo-600/20"
                : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60"
            )}
          >
            <Receipt size={17} />
            <span>ثبت و مدیریت هزینه‌ها</span>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-black", activeSubTab === 'expenses' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700")}>
              {expenses.length} سند
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('statistics')}
            className={cn(
              "flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-xs transition-all cursor-pointer",
              activeSubTab === 'statistics'
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 ring-2 ring-indigo-600/20"
                : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60"
            )}
          >
            <BarChart3 size={17} />
            <span>آمارها و گزارشات تحلیلی</span>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-black", activeSubTab === 'statistics' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700")}>
              نمودار و تفکیک
            </span>
          </button>
        </div>
      </div>

      {/* Global Top Aggregate Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] text-slate-500 font-medium">کل بودجه مصوب مدرسه</span>
          <div className="text-base font-black text-slate-800">
            {totalAllocatedBudget.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-slate-500">تومان</span>
          </div>
          <div className="text-[10px] text-slate-400">
            مجموع {budgetRows.length} ردیف مصوب
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] text-slate-500 font-medium">مجموع هزینه‌های مصرف‌شده</span>
          <div className="text-base font-black text-rose-600">
            {totalSpentExpenses.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-slate-500">تومان</span>
          </div>
          <div className="text-[10px] text-rose-500 font-medium">
            تعداد {expenses.length} سند فاکتور ثبت‌شده
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] text-slate-500 font-medium">مانده کل بودجه</span>
          <div className="text-base font-black text-emerald-700">
            {totalRemainingBudget.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-slate-500">تومان</span>
          </div>
          <div className="text-[10px] text-emerald-600 font-medium">
            قابل تخصیص تا پایان سال تحصیلی
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1 bg-linear-to-br from-indigo-50/50 to-indigo-100/30">
          <span className="text-[11px] text-indigo-700 font-bold">درصد مصرف کل بودجه</span>
          <div className="text-lg font-black text-indigo-900">
            {totalPercentUsed.toLocaleString('fa-IR')}٪
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
            <div 
              className={cn("h-full transition-all", totalPercentUsed > 90 ? "bg-rose-500" : totalPercentUsed > 70 ? "bg-amber-500" : "bg-indigo-600")}
              style={{ width: `${Math.min(100, totalPercentUsed)}%` }}
            />
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* SUB-TAB 1: BUDGET ROWS (ردیف‌های بودجه) */}
      {/* ----------------------------------------------------------------- */}
      {activeSubTab === 'budget_rows' && (
        <div className="space-y-6">
          {/* Visual Pie Chart & Progress Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
                  <PieChartIcon size={16} className="text-indigo-600" />
                  <span>نمودار دایره‌ای مصرف ردیف‌های بودجه</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  سهم هر یک از سرفصل‌های بودجه از کل مخارج ثبت‌شده
                </p>
              </div>

              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      innerRadius={45}
                      paddingAngle={3}
                    >
                      {pieChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(val: any) => [`${Number(val).toLocaleString('fa-IR')} تومان`, 'مصرف شده']}
                      contentStyle={{ fontFamily: 'vazir', borderRadius: '12px', fontSize: '12px', direction: 'rtl' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="text-[10px] text-center text-slate-400">
                مجموع هزینه‌کرد: {totalSpentExpenses.toLocaleString('fa-IR')} تومان
              </div>
            </div>

            {/* Quick Rows Visual Progress List */}
            <div className="lg:col-span-2 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
                  <TrendingUp size={16} className="text-indigo-600" />
                  <span>وضعیت مصرف در برابر سقف مصوب هر ردیف</span>
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">سال تحصیلی ۱۴۰۳-۱۴۰۴</span>
              </div>

              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {budgetRowsWithMetrics.map((b, idx) => (
                  <div key={b.id} className="p-3 bg-slate-50/80 hover:bg-slate-50 rounded-2xl border border-slate-200/60 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md font-mono font-bold text-[11px]">
                          کد {b.code}
                        </span>
                        <span className="font-bold text-slate-800">{b.title}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-slate-500 font-mono">
                          {b.spentAmount?.toLocaleString('fa-IR')} از {b.allocatedAmount.toLocaleString('fa-IR')} تومان
                        </span>
                        <span className={cn(
                          "px-2 py-0.2 rounded-full font-black text-[10px]",
                          (b.consumptionPercent || 0) > 90 ? "bg-rose-100 text-rose-800" :
                          (b.consumptionPercent || 0) > 70 ? "bg-amber-100 text-amber-800" :
                          "bg-emerald-100 text-emerald-800"
                        )}>
                          {b.consumptionPercent}٪
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all rounded-full",
                          (b.consumptionPercent || 0) > 90 ? "bg-rose-500" :
                          (b.consumptionPercent || 0) > 70 ? "bg-amber-500" :
                          "bg-indigo-600"
                        )}
                        style={{ width: `${Math.min(100, b.consumptionPercent || 0)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Budget Rows Master Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers size={17} className="text-indigo-600" />
                <h2 className="text-xs font-black text-slate-800">
                  جدول سرفصل‌ها و ردیف‌های بودجه مصوب ({budgetRows.length} ردیف)
                </h2>
              </div>
              <div className="text-[11px] text-slate-500">
                مبالغ مصرف‌شده به صورت لحظه‌ای از اسناد هزینه کسر و محاسبه می‌شود.
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3 px-3 text-center">کد ردیف</th>
                    <th className="py-3 px-4">عنوان ردیف بودجه</th>
                    <th className="py-3 px-3 text-center">دوره / مدت زمان</th>
                    <th className="py-3 px-3 text-center">سقف مصوب (تومان)</th>
                    <th className="py-3 px-3 text-center text-rose-700">مصرف‌شده (تومان)</th>
                    <th className="py-3 px-3 text-center text-emerald-700">مانده بودجه (تومان)</th>
                    <th className="py-3 px-3 text-center">درصد مصرف</th>
                    <th className="py-3 px-3 text-center">اسناد</th>
                    <th className="py-3 px-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {budgetRowsWithMetrics.map((b) => (
                    <tr key={b.id} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="py-3 px-3 text-center font-mono font-black text-indigo-700">
                        {b.code}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{b.title}</div>
                        {b.description && (
                          <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{b.description}</div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center text-slate-600 font-medium">
                        {b.period}
                      </td>

                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                        {b.allocatedAmount.toLocaleString('fa-IR')}
                      </td>

                      <td className="py-3 px-3 text-center font-mono font-bold text-rose-600">
                        {b.spentAmount?.toLocaleString('fa-IR')}
                      </td>

                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700">
                        {b.remainingAmount?.toLocaleString('fa-IR')}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full font-mono font-black text-[10px]",
                          (b.consumptionPercent || 0) > 90 ? "bg-rose-100 text-rose-800" :
                          (b.consumptionPercent || 0) > 70 ? "bg-amber-100 text-amber-800" :
                          "bg-emerald-100 text-emerald-800"
                        )}>
                          {b.consumptionPercent}٪
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center text-slate-500 font-mono">
                        {b.expenseCount} فاکتور
                      </td>

                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditBudget(b)}
                            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-all cursor-pointer"
                            title="ویرایش ردیف بودجه"
                          >
                            <Edit3 size={14} />
                          </button>

                          <button
                            onClick={() => handleDeleteBudgetRow(b.id)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 transition-all cursor-pointer"
                            title="حذف ردیف بودجه"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* SUB-TAB 2: EXPENSES MANAGEMENT (ثبت و مدیریت هزینه‌ها) */}
      {/* ----------------------------------------------------------------- */}
      {activeSubTab === 'expenses' && (
        <div className="space-y-6">
          {/* Filters Strip */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative sm:col-span-1">
                <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجوی عنوان هزینه، فروشنده، فاکتور..."
                  className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Filter Budget Row */}
              <div>
                <select
                  value={selectedBudgetFilter}
                  onChange={(e) => setSelectedBudgetFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-indigo-500 transition-all"
                >
                  <option value="all">همه ردیف‌های بودجه</option>
                  {budgetRows.map(b => (
                    <option key={b.id} value={b.id}>
                      کد {b.code} - {b.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Payer */}
              <div>
                <select
                  value={selectedPayerFilter}
                  onChange={(e) => setSelectedPayerFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-indigo-500 transition-all"
                >
                  <option value="all">همه پرداخت‌کنندگان / اشخاص</option>
                  {uniquePayers.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Filter Category */}
              <div>
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-indigo-500 transition-all"
                >
                  <option value="all">همه موضوعات و دسته‌بندی‌ها</option>
                  {uniqueCategories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Expenses Records Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt size={17} className="text-indigo-600" />
                <h2 className="text-xs font-black text-slate-800">
                  فهرست اسناد هزینه ثبت‌شده ({filteredExpenses.length} سند)
                </h2>
              </div>
              <div className="text-[11px] text-slate-500">
                جمع مبالغ نمایش داده شده: {filteredExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0).toLocaleString('fa-IR')} تومان
              </div>
            </div>

            {filteredExpenses.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-3">
                <Receipt size={36} className="mx-auto text-slate-300" />
                <p className="text-xs font-bold text-slate-500">هیچ سند هزینه‌ای مطابق با فیلترهای انتخابی یافت نشد.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200/80">
                    <tr>
                      <th className="py-3 px-2 w-8 text-center">ردیف</th>
                      <th className="py-3 px-3">عنوان هزینه</th>
                      <th className="py-3 px-2 text-center">تاریخ</th>
                      <th className="py-3 px-3">ردیف بودجه (کد)</th>
                      <th className="py-3 px-3">پرداخت‌کننده / شخص</th>
                      <th className="py-3 px-2 text-center">موضوع</th>
                      <th className="py-3 px-3 text-center text-rose-700">مبلغ (تومان)</th>
                      <th className="py-3 px-2 text-center">پیوست / فاکتور</th>
                      <th className="py-3 px-3 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredExpenses.map((exp, idx) => (
                      <tr key={exp.id} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="py-3 px-2 text-center text-slate-400 font-mono">
                          {(idx + 1).toLocaleString('fa-IR')}
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{exp.title}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                            {exp.recipient && <span>طرف حساب: {exp.recipient}</span>}
                            {exp.invoiceNumber && <span className="font-mono">سند: {exp.invoiceNumber}</span>}
                          </div>
                        </td>

                        <td className="py-3 px-2 text-center font-mono text-slate-600">
                          {exp.date}
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            {exp.budgetCode && (
                              <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 font-mono font-bold rounded-sm text-[10px]">
                                {exp.budgetCode}
                              </span>
                            )}
                            <span className="font-bold text-slate-800 text-[11px]">{exp.budgetRowTitle || 'ردیف عمومی'}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-slate-700 font-medium">
                          {exp.payer}
                        </td>

                        <td className="py-3 px-2 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                            {exp.category}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center font-black text-rose-600 font-mono text-xs">
                          {exp.amount.toLocaleString('fa-IR')}
                        </td>

                        <td className="py-3 px-2 text-center">
                          {exp.attachmentUrl ? (
                            <a
                              href={exp.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold border border-indigo-200 transition-all"
                            >
                              <Paperclip size={12} />
                              <span>فاکتور</span>
                            </a>
                          ) : (
                            <span className="text-slate-300 text-[10px]">-</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditExpense(exp)}
                              className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-all cursor-pointer"
                              title="ویرایش هزینه"
                            >
                              <Edit3 size={14} />
                            </button>

                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 transition-all cursor-pointer"
                              title="حذف هزینه"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* SUB-TAB 3: STATISTICS & ANALYTICS (آمارها و گزارشات) */}
      {/* ----------------------------------------------------------------- */}
      {activeSubTab === 'statistics' && (
        <div className="space-y-6">
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bar Chart: Budget vs Spent */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
                  <BarChart3 size={16} className="text-indigo-600" />
                  <span>مقایسه سقف مصوب و مصرف ردیف‌های بودجه (میلیون تومان)</span>
                </h3>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'vazir' }} />
                    <YAxis tick={{ fontSize: 10, fontFamily: 'vazir' }} />
                    <RechartsTooltip 
                      formatter={(val: any) => [`${Number(val).toLocaleString('fa-IR')} میلیون تومان`]}
                      contentStyle={{ fontFamily: 'vazir', borderRadius: '12px', fontSize: '12px', direction: 'rtl' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'vazir', paddingTop: '10px' }} />
                    <Bar dataKey="مصوب" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="مصرف_شده" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Payer Breakdown */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
                  <Users size={16} className="text-indigo-600" />
                  <span>گزارش هزینه‌کرد به تفکیک اشخاص و تنخواه‌داران</span>
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">{payerStats.length} شخص</span>
              </div>

              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {payerStats.map((p, idx) => (
                  <div key={idx} className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/60 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-xs">{p.payer}</div>
                        <div className="text-[10px] text-slate-400">{p.count} فاکتور ثبت شده</div>
                      </div>
                    </div>

                    <div className="text-left">
                      <div className="font-mono font-black text-xs text-indigo-900">
                        {p.total.toLocaleString('fa-IR')} تومان
                      </div>
                      <div className="text-[10px] text-slate-500 font-bold">{p.percent}٪ از کل مخارج</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Category Breakdown Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag size={17} className="text-indigo-600" />
                <h2 className="text-xs font-black text-slate-800">
                  گزارش تجمیعی بر اساس موضوعات و سرفصل‌های هزینه
                </h2>
              </div>
              <div className="text-[11px] text-slate-500">
                تفکیک درصدی و ریالی مصارف
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3 px-3 text-center">ردیف</th>
                    <th className="py-3 px-4">موضوع و دسته‌بندی</th>
                    <th className="py-3 px-3 text-center">تعداد اسناد</th>
                    <th className="py-3 px-3 text-center">مجموع مبلغ (تومان)</th>
                    <th className="py-3 px-3 text-center">سهم از کل مخارج</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categoryStats.map((c, idx) => (
                    <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="py-3 px-3 text-center text-slate-400 font-mono">
                        {(idx + 1).toLocaleString('fa-IR')}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {c.category}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600">
                        {c.count} سند
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-black text-rose-600">
                        {c.total.toLocaleString('fa-IR')}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-mono font-bold text-slate-700">{c.percent}٪</span>
                          <div className="w-16 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${c.percent}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Modal: Add/Edit Budget Row */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {isAddBudgetOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900">
                  {editingBudget ? 'ویرایش ردیف بودجه' : 'تعریف ردیف بودجه جدید'}
                </h3>
                <button
                  onClick={() => setIsAddBudgetOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">کد ردیف *</label>
                    <input
                      type="text"
                      value={budgetCode}
                      onChange={(e) => setBudgetCode(e.target.value)}
                      placeholder="مثال: 013"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 outline-hidden focus:border-indigo-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">عنوان ردیف بودجه *</label>
                    <input
                      type="text"
                      value={budgetTitle}
                      onChange={(e) => setBudgetTitle(e.target.value)}
                      placeholder="مثال: ردیف تغذیه و پذیرایی طلاب"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-hidden focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">سقف مصوب بودجه (تومان) *</label>
                  <input
                    type="number"
                    value={budgetAllocated}
                    onChange={(e) => setBudgetAllocated(e.target.value)}
                    placeholder="مثال: 150000000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">دوره / مدت زمان تخصیص</label>
                  <input
                    type="text"
                    value={budgetPeriod}
                    onChange={(e) => setBudgetPeriod(e.target.value)}
                    placeholder="مثال: سال تحصیلی ۱۴۰۳-۱۴۰۴"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">توضیحات و شرح سرفصل</label>
                  <textarea
                    rows={2}
                    value={budgetDesc}
                    onChange={(e) => setBudgetDesc(e.target.value)}
                    placeholder="توضیحات تکمیلی پیرامون مصارف مجاز این ردیف..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddBudgetOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveBudgetRow}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-sm cursor-pointer"
                  >
                    ذخیره ردیف بودجه
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------- */}
      {/* Modal: Add/Edit Expense Record */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {isAddExpenseOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 space-y-4 my-8"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900">
                  {editingExpense ? 'ویرایش سند هزینه' : 'ثبت سند هزینه جدید'}
                </h3>
                <button
                  onClick={() => setIsAddExpenseOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">عنوان هزینه *</label>
                  <input
                    type="text"
                    value={expTitle}
                    onChange={(e) => setExpTitle(e.target.value)}
                    placeholder="مثال: خرید مواد شوینده و بهداشتی خوابگاه"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">مبلغ هزینه (تومان) *</label>
                    <input
                      type="number"
                      value={expAmount}
                      onChange={(e) => setExpAmount(e.target.value)}
                      placeholder="مثال: 4500000"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 outline-hidden focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">تاریخ سند *</label>
                    <input
                      type="text"
                      value={expDate}
                      onChange={(e) => setExpDate(e.target.value)}
                      placeholder="۱۴۰۳/۰۷/۱۵"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 outline-hidden focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Budget Source Selector / Manual Entry */}
                <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-indigo-950">ردیف بودجه منبع *</label>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setExpBudgetMode('select')}
                        className={cn("px-2 py-0.5 rounded-lg font-bold transition-all", expBudgetMode === 'select' ? "bg-indigo-600 text-white" : "text-indigo-700 hover:bg-indigo-100")}
                      >
                        انتخاب از ردیف‌ها
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpBudgetMode('manual')}
                        className={cn("px-2 py-0.5 rounded-lg font-bold transition-all", expBudgetMode === 'manual' ? "bg-indigo-600 text-white" : "text-indigo-700 hover:bg-indigo-100")}
                      >
                        ورود دستی
                      </button>
                    </div>
                  </div>

                  {expBudgetMode === 'select' ? (
                    <select
                      value={expSelectedBudgetRowId}
                      onChange={(e) => setExpSelectedBudgetRowId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl font-bold text-slate-800 outline-hidden focus:border-indigo-500"
                    >
                      {budgetRows.map(b => (
                        <option key={b.id} value={b.id}>
                          کد {b.code} - {b.title} (مانده: {((b.allocatedAmount - (b.spentAmount || 0))).toLocaleString('fa-IR')} ت)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <input
                          type="text"
                          value={expManualBudgetCode}
                          onChange={(e) => setExpManualBudgetCode(e.target.value)}
                          placeholder="کد ردیف مثلا 013"
                          className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl font-mono font-bold text-slate-800 outline-hidden"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={expManualBudgetTitle}
                          onChange={(e) => setExpManualBudgetTitle(e.target.value)}
                          placeholder="عنوان ردیف بودجه دستی"
                          className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl font-bold text-slate-800 outline-hidden"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">پرداخت‌کننده / شخص *</label>
                    <input
                      type="text"
                      value={expPayer}
                      onChange={(e) => setExpPayer(e.target.value)}
                      placeholder="مثال: آقای رضایی (تنخواه‌دار)"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-hidden focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">موضوع / دسته‌بندی</label>
                    <select
                      value={expCategory}
                      onChange={(e) => setExpCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-hidden focus:border-indigo-500"
                    >
                      <option value="تغذیه و پذیرایی">تغذیه و پذیرایی</option>
                      <option value="تاسیسات و نگهداری">تاسیسات و نگهداری</option>
                      <option value="فرهنگی و مناسبت‌ها">فرهنگی و مناسبت‌ها</option>
                      <option value="اداری و ملزومات">اداری و ملزومات</option>
                      <option value="فناوری و ارتباطات">فناوری و ارتباطات</option>
                      <option value="حق‌الزحمه و دستمزد">حق‌الزحمه و دستمزد</option>
                      <option value="متفرقه">متفرقه</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">طرف حساب / فروشنده</label>
                    <input
                      type="text"
                      value={expRecipient}
                      onChange={(e) => setExpRecipient(e.target.value)}
                      placeholder="مثال: شرکت تاسیساتی البرز"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">شماره سند / فاکتور</label>
                    <input
                      type="text"
                      value={expInvoiceNum}
                      onChange={(e) => setExpInvoiceNum(e.target.value)}
                      placeholder="مثال: INV-1049"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">لینک فایل پیوست یا فاکتور</label>
                  <input
                    type="text"
                    value={expAttachmentUrl}
                    onChange={(e) => setExpAttachmentUrl(e.target.value)}
                    placeholder="https://... یا نام فایل فاکتور"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">توضیحات و شرح هزینه</label>
                  <textarea
                    rows={2}
                    value={expDesc}
                    onChange={(e) => setExpDesc(e.target.value)}
                    placeholder="شرح اقلام خریداری‌شده یا خدمات ارائه‌شده..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddExpenseOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveExpense}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-sm cursor-pointer"
                  >
                    ذخیره سند هزینه
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
