import React, { useState, useEffect, useMemo } from 'react';
import { 
  Award, 
  Users, 
  Clock, 
  FileSpreadsheet, 
  Plus, 
  Search, 
  X, 
  CheckCircle2, 
  Printer, 
  SlidersHorizontal,
  Calendar,
  Trash2,
  Edit3,
  Archive,
  Save,
  RotateCcw,
  Receipt,
  UtensilsCrossed,
  Layers,
  FileText,
  UserPlus,
  Check,
  Building2,
  ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { getTodayShamsi } from '../../lib/jalali';
import { motion, AnimatePresence } from 'motion/react';
import { GradeMentorCalculationItem, GradeMentorPeriod, StudentClaimRecord } from '../../types';
import { AppUser } from '../../types/auth';

interface GradeProfessorsCompensationProps {
  onNavigateTab?: (tab: string, params?: any) => void;
}

export default function GradeProfessorsCompensation({ onNavigateTab }: GradeProfessorsCompensationProps) {
  const { currentUser, users } = useAuth();

  // Top level screen view: 'create_period' (active editor) vs 'periods_archive' (archive list)
  const [activeView, setActiveView] = useState<'create_period' | 'periods_archive'>('create_period');

  // Compact vs Detailed view toggle
  const [isCompactView, setIsCompactView] = useState(false);

  // Active Period State
  const [activePeriodId, setActivePeriodId] = useState<string | null>(null);
  const [periodTitle, setPeriodTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lunchCostPerMeal, setLunchCostPerMeal] = useState<number>(45000);
  const [baseHourlyRate, setBaseHourlyRate] = useState<number>(250000);
  const [periodStatus, setPeriodStatus] = useState<'draft' | 'finalized' | 'paid'>('draft');
  const [items, setItems] = useState<GradeMentorCalculationItem[]>([]);
  const [claimsList, setClaimsList] = useState<StudentClaimRecord[]>([]);

  // Archived Periods
  const [periods, setPeriods] = useState<GradeMentorPeriod[]>([]);
  const [selectedArchivedPeriod, setSelectedArchivedPeriod] = useState<GradeMentorPeriod | null>(null);
  const [isArchivedModified, setIsArchivedModified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('all');

  // Modals
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false);
  const [isAddProfessorModalOpen, setIsAddProfessorModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GradeMentorCalculationItem | null>(null);
  const [singleSlipItem, setSingleSlipItem] = useState<GradeMentorCalculationItem | null>(null);
  const [isBatchSlipOpen, setIsBatchSlipOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Date Range Form State
  const [modalTitle, setModalTitle] = useState('');
  const [modalStart, setModalStart] = useState('');
  const [modalEnd, setModalEnd] = useState('');
  const [modalHourlyRate, setModalHourlyRate] = useState(250000);
  const [modalLunchCost, setModalLunchCost] = useState(45000);

  // Professor Selector State
  const [selectedProfessorIds, setSelectedProfessorIds] = useState<string[]>([]);
  const [profSearchQuery, setProfSearchQuery] = useState('');
  const [profGradeFilter, setProfGradeFilter] = useState('all');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Helper to extract grade string from user
  const getUserGradeString = (u: AppUser) => {
    if (u.managedGrades && u.managedGrades.length > 0) {
      return u.managedGrades.join('، ');
    }
    const r = (u.role || '').toLowerCase();
    const t = (u.roleTitle || '').toLowerCase();
    const s = (u.scope || '').toLowerCase();
    if (r.includes('7') || t.includes('7') || t.includes('۷') || s.includes('7')) return 'پایه ۷';
    if (r.includes('8') || t.includes('8') || t.includes('۸') || s.includes('8')) return 'پایه ۸';
    if (r.includes('9') || t.includes('9') || t.includes('۹') || s.includes('9')) return 'پایه ۹';
    if (r.includes('10') || t.includes('10') || t.includes('۱۰') || s.includes('10')) return 'پایه ۱۰';
    if (r.includes('11') || t.includes('11') || t.includes('۱۱') || s.includes('11')) return 'پایه ۱۱';
    return 'پایه ۷';
  };

  // Registered Grade Professors / Supervisors in system
  const registeredGradeProfessors = useMemo(() => {
    return users.filter(u => {
      const title = (u.roleTitle || '').toLowerCase();
      const role = (u.role || '').toLowerCase();
      const scope = (u.scope || '').toLowerCase();
      const isGradeRole = role.includes('grade_') || role === 'grade_supervisor' || role === 'grade_mentor' || role === 'teacher' || role.includes('mentor');
      const isGradeTitle = title.includes('استاد') || title.includes('مسئول پایه') || title.includes('مسول پایه') || title.includes('پایه');
      const hasManagedGrades = u.managedGrades && u.managedGrades.length > 0;
      const isGradeScope = scope.startsWith('grade_') || scope.includes('grade');
      return isGradeRole || isGradeTitle || hasManagedGrades || isGradeScope;
    });
  }, [users]);

  // Find debt deduction for a given professor
  const getProfessorDebt = (userId: string, name: string, claims: StudentClaimRecord[]): { totalDebt: number; monthlyDed: number; notes: string } => {
    const matchedClaims = claims.filter(c => {
      const matchId = c.studentId === userId || c.targetId === userId;
      const matchName = c.studentName && name && (c.studentName.trim() === name.trim() || name.includes(c.studentName) || c.studentName.includes(name));
      const isActive = c.status === 'active' || ((c.remainingAmount ?? c.totalDebtAmount) > 0);
      return (matchId || matchName) && isActive;
    });

    const totalDebt = matchedClaims.reduce((sum, c) => sum + (c.remainingAmount ?? c.totalDebtAmount ?? 0), 0);
    const monthlyDed = matchedClaims.reduce((sum, c) => sum + (c.monthlyDeductionAmount || c.remainingAmount || 0), 0);
    const notes = matchedClaims.map(c => c.notes || c.claimTitle || 'بدهی ثبت‌شده').join(' | ');

    return { totalDebt, monthlyDed, notes };
  };

  // Recalculate Row Totals Helper
  const recalculateItem = (
    item: GradeMentorCalculationItem, 
    rate: number = item.hourlyRate, 
    mealPrice: number = lunchCostPerMeal
  ): GradeMentorCalculationItem => {
    const hours = Number(item.totalHours) || 0;
    const effectiveRate = Number(rate) || 0;
    const baseCompensation = hours * effectiveRate;
    const lunchMeals = Number(item.lunchCount) || 0;
    const lunchDeduction = lunchMeals * Number(mealPrice);
    const bonus = Number(item.bonusAmount) || 0;
    const debtDed = Number(item.debtDeduction) || 0;
    const loanDed = Number(item.loanInstallment) || 0;
    const fundDed = Number(item.fundContribution) || 0;
    const otherDed = Number(item.otherDeductions) || 0;
    const manualAdj = Number(item.manualAdjustmentAmount) || 0;

    const totalDeductions = lunchDeduction + debtDed + loanDed + fundDed + otherDed;
    const netPayable = Math.max(0, baseCompensation + bonus + manualAdj - totalDeductions);

    return {
      ...item,
      hourlyRate: effectiveRate,
      baseCompensation,
      lunchCount: lunchMeals,
      lunchDeduction,
      debtDeduction: debtDed,
      loanInstallment: loanDed,
      fundContribution: fundDed,
      bonusAmount: bonus,
      manualAdjustmentAmount: manualAdj,
      otherDeductions: otherDed,
      netPayable
    };
  };

  // Load Saved Periods & Claims
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [storedPeriods, storedClaims] = await Promise.all([
        localDb.getDocs<GradeMentorPeriod>('finance_grade_mentor_periods'),
        localDb.getDocs<StudentClaimRecord>('finance_student_claims')
      ]);
      
      const claims = storedClaims || [];
      setClaimsList(claims);

      const periodList = storedPeriods || [];
      setPeriods(periodList);

      if (periodList.length > 0) {
        setSelectedArchivedPeriod(periodList[0]);
      }
    } catch (err) {
      console.error('Error loading grade mentor periods:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Step 1: Trigger Calculation Date Range Modal
  const handleOpenDateRangeModal = () => {
    const today = getTodayShamsi();
    const parts = today.split('/');
    const year = parts[0] || '۱۴۰۳';
    const month = parts[1] || '۰۸';
    const monthNames: Record<string, string> = {
      '۰۱': 'فروردین', '۰۲': 'اردیبهشت', '۰۳': 'خرداد',
      '۰۴': 'تیر', '۰۵': 'مرداد', '۰۶': 'شهریور',
      '۰۷': 'مهر', '۰۸': 'آبان', '۰۹': 'آذر',
      '۱۰': 'دی', '۱۱': 'بهمن', '۱۲': 'اسفند'
    };
    const mName = monthNames[month] || 'ماه جاری';
    
    setModalTitle(`حق‌الزحمه اساتید و مسئولین پایه - ${mName} ${year}`);
    setModalStart(`${year}/${month}/۰۱`);
    setModalEnd(`${year}/${month}/۳۰`);
    setModalHourlyRate(baseHourlyRate || 250000);
    setModalLunchCost(lunchCostPerMeal || 45000);
    setIsDateRangeModalOpen(true);
  };

  // Step 2: Confirm Date Range and Enter Workspace with Empty Table
  const handleConfirmDateRange = () => {
    if (!modalTitle.trim()) {
      showToast('لطفاً عنوان دوره پرداخت را وارد نمایید.');
      return;
    }
    if (!modalStart.trim() || !modalEnd.trim()) {
      showToast('لطفاً تاریخ شروع و پایان بازه ارزیابی را وارد نمایید.');
      return;
    }

    const newId = `period-mentor-${Date.now()}`;
    setActivePeriodId(newId);
    setPeriodTitle(modalTitle.trim());
    setStartDate(modalStart.trim());
    setEndDate(modalEnd.trim());
    setBaseHourlyRate(modalHourlyRate);
    setLunchCostPerMeal(modalLunchCost);
    setPeriodStatus('draft');
    
    // Per user specification: MUST BE COMPLETELY EMPTY INITIALLY
    setItems([]);

    setIsDateRangeModalOpen(false);
    setActiveView('create_period');
    showToast('بازه زمانی ثبت شد. لطفاً اساتید پایه مورد نظر را جهت پرداخت اضافه نمایید.');
  };

  // Step 3: Open Professor Selector Modal
  const handleOpenAddProfessorModal = () => {
    // Exclude already added professors
    const currentAddedIds = new Set(items.map(i => i.userId));
    setSelectedProfessorIds([]);
    setIsAddProfessorModalOpen(true);
  };

  // Step 4: Add Selected Professors to the Table
  const handleConfirmAddProfessors = () => {
    if (selectedProfessorIds.length === 0) {
      showToast('لطفاً حداقل یک استاد را انتخاب نمایید.');
      return;
    }

    const selectedUsers = users.filter(u => selectedProfessorIds.includes(u.id));
    const newItems: GradeMentorCalculationItem[] = [];

    selectedUsers.forEach((u, idx) => {
      // Avoid duplicate
      if (items.some(it => it.userId === u.id)) return;

      const grades = getUserGradeString(u);
      const hours = 24; // Default standard hours per month
      const rate = baseHourlyRate;
      const baseComp = hours * rate;
      const lunchMeals = 12; // Default lunch meals
      const lunchDed = lunchMeals * lunchCostPerMeal;
      const debtInfo = getProfessorDebt(u.id, u.fullName, claimsList);
      const debtDed = debtInfo.monthlyDed || 0;
      const loanDed = 0;
      const fundDed = 0;
      const otherDed = 0;
      const bonus = 0;
      const manualAdj = 0;
      const totalDed = lunchDed + debtDed + loanDed + fundDed + otherDed;
      const net = Math.max(0, baseComp + bonus + manualAdj - totalDed);

      newItems.push({
        id: `gmi-${u.id}-${Date.now() + idx}`,
        userId: u.id,
        name: u.fullName,
        gradesStr: grades,
        teacherCode: u.personnelCode || `PROF-${101 + items.length + idx}`,
        nationalId: u.nationalId || '',
        phone: u.phone || '',
        totalHours: hours,
        hourlyRate: rate,
        baseCompensation: baseComp,
        lunchCount: lunchMeals,
        lunchDeduction: lunchDed,
        debtDeduction: debtDed,
        debtNotes: debtInfo.notes || (debtDed > 0 ? 'بدهی ماهانه / قسط وام' : ''),
        loanInstallment: loanDed,
        fundContribution: fundDed,
        bonusAmount: bonus,
        manualAdjustmentAmount: manualAdj,
        manualAdjustmentReason: '',
        otherDeductions: otherDed,
        netPayable: net,
        bankName: u.bankName || 'بانک تجارت',
        bankAccount: u.bankAccount || `۶۲۷۳-۸۱۱۰-${1000 + (items.length + idx) * 10}-${2000 + (items.length + idx) * 10}`,
        bankSheba: u.bankSheba || `IR98018000000000${1000000000 + (items.length + idx) * 100}`,
        status: 'approved',
        notes: `افزوده شده در بازه ${startDate} تا ${endDate}`
      });
    });

    setItems(prev => [...prev, ...newItems]);
    setIsAddProfessorModalOpen(false);
    showToast(`تعداد ${newItems.length} استاد پایه با موفقیت به جدول اضافه شدند.`);
  };

  // Direct Inline Edit for Items
  const handleItemFieldChange = (itemId: string, field: keyof GradeMentorCalculationItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const updated = { ...item, [field]: value };
      return recalculateItem(updated, updated.hourlyRate, lunchCostPerMeal);
    }));
  };

  // Direct Inline Edit for Archived Items
  const handleArchivedItemFieldChange = (itemId: string, field: keyof GradeMentorCalculationItem, value: any) => {
    if (!selectedArchivedPeriod) return;
    const mealPrice = selectedArchivedPeriod.lunchCostPerMeal || 45000;
    const updatedItems = selectedArchivedPeriod.items.map(item => {
      if (item.id !== itemId) return item;
      const updated = { ...item, [field]: value };
      return recalculateItem(updated, updated.hourlyRate, mealPrice);
    });
    
    setSelectedArchivedPeriod({
      ...selectedArchivedPeriod,
      items: updatedItems,
      totalPayoutAmount: updatedItems.reduce((sum, i) => sum + i.netPayable, 0),
      totalProfessors: updatedItems.length
    });
    setIsArchivedModified(true);
  };

  // Save changes to selected archived period
  const handleSaveArchivedChanges = async () => {
    if (!selectedArchivedPeriod) return;
    await localDb.setDoc('finance_grade_mentor_periods', selectedArchivedPeriod);
    setPeriods(prev => prev.map(p => p.id === selectedArchivedPeriod.id ? selectedArchivedPeriod : p));
    setIsArchivedModified(false);
    showToast(`تغییرات دوره «${selectedArchivedPeriod.title}» در بایگانی با موفقیت ذخیره شد.`);
  };

  // Delete an item from active period
  const handleDeleteItem = (itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
    showToast('استاد مورد نظر از جدول این دوره حذف شد.');
  };

  // Delete an item from archived period
  const handleDeleteArchivedItem = (itemId: string) => {
    if (!selectedArchivedPeriod) return;
    const updatedItems = selectedArchivedPeriod.items.filter(i => i.id !== itemId);
    setSelectedArchivedPeriod({
      ...selectedArchivedPeriod,
      items: updatedItems,
      totalProfessors: updatedItems.length,
      totalPayoutAmount: updatedItems.reduce((sum, i) => sum + i.netPayable, 0)
    });
    setIsArchivedModified(true);
    showToast('استاد مورد نظر از این دوره بایگانی حذف شد (جهت ثبت نهایی، ذخیره تغییرات را بزنید).');
  };

  // Finalize Period & Transfer to Archive
  const handleFinalizeAndArchive = async () => {
    if (!periodTitle.trim()) {
      showToast('لطفاً ابتدا بازه زمانی و عنوان دوره را ثبت فرمایید.');
      return;
    }
    if (items.length === 0) {
      showToast('هیچ استادی در جدول محاسبه وجود ندارد. ابتدا اساتید را اضافه نمایید.');
      return;
    }

    const totalPayout = items.reduce((acc, i) => acc + i.netPayable, 0);
    const periodDocId = activePeriodId || `period-mentor-${Date.now()}`;

    const periodData: GradeMentorPeriod = {
      id: periodDocId,
      title: periodTitle.trim(),
      startDate,
      endDate,
      status: 'finalized',
      totalProfessors: items.length,
      totalPayoutAmount: totalPayout,
      lunchCostPerMeal,
      baseHourlyRate,
      items,
      createdAt: new Date().toISOString(),
      createdByName: currentUser?.fullName || 'مسئول مالی',
      finalizedAt: new Date().toISOString(),
      finalizedByName: currentUser?.fullName || 'مسئول مالی'
    };

    await localDb.setDoc('finance_grade_mentor_periods', periodData);
    
    // Update local state
    setPeriods(prev => {
      const idx = prev.findIndex(p => p.id === periodDocId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = periodData;
        return copy;
      }
      return [periodData, ...prev];
    });

    setSelectedArchivedPeriod(periodData);
    setActivePeriodId(periodDocId);
    setPeriodStatus('finalized');
    setIsArchivedModified(false);

    // Switch to Archive view as requested
    setActiveView('periods_archive');
    showToast(`دوره پرداخت «${periodTitle}» با موفقیت نهایی و به بایگانی منتقل شد.`);
  };

  // Delete an archived period
  const handleDeleteArchivedPeriod = async (periodId: string) => {
    if (!window.confirm('آیا از حذف این دوره از بایگانی اطمینان دارید؟')) return;
    await localDb.deleteDoc('finance_grade_mentor_periods', periodId);
    setPeriods(prev => prev.filter(p => p.id !== periodId));
    if (selectedArchivedPeriod?.id === periodId) {
      const remaining = periods.filter(p => p.id !== periodId);
      setSelectedArchivedPeriod(remaining[0] || null);
    }
    showToast('دوره با موفقیت از بایگانی حذف شد.');
  };

  // Filter items in active table
  const filteredActiveItems = useMemo(() => {
    return items.filter(item => {
      const matchSearch = 
        !searchQuery || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.gradesStr && item.gradesStr.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.teacherCode && item.teacherCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.nationalId && item.nationalId.includes(searchQuery));

      const matchGrade = selectedGradeFilter === 'all' || (item.gradesStr && item.gradesStr.includes(selectedGradeFilter));
      return matchSearch && matchGrade;
    });
  }, [items, searchQuery, selectedGradeFilter]);

  // Aggregate Metrics for Header
  const activeSummaryStats = useMemo(() => {
    const totalProfessors = filteredActiveItems.length;
    const totalHours = filteredActiveItems.reduce((acc, i) => acc + (Number(i.totalHours) || 0), 0);
    const totalBase = filteredActiveItems.reduce((acc, i) => acc + (Number(i.baseCompensation) || 0), 0);
    const totalLunchCount = filteredActiveItems.reduce((acc, i) => acc + (Number(i.lunchCount) || 0), 0);
    const totalLunchDeductions = filteredActiveItems.reduce((acc, i) => acc + (Number(i.lunchDeduction) || 0), 0);
    const totalDebts = filteredActiveItems.reduce((acc, i) => acc + (Number(i.debtDeduction) || 0) + (Number(i.loanInstallment) || 0) + (Number(i.fundContribution) || 0), 0);
    const totalManualAdj = filteredActiveItems.reduce((acc, i) => acc + (Number(i.manualAdjustmentAmount) || 0), 0);
    const totalNetPayable = filteredActiveItems.reduce((acc, i) => acc + (Number(i.netPayable) || 0), 0);

    return {
      totalProfessors,
      totalHours,
      totalBase,
      totalLunchCount,
      totalLunchDeductions,
      totalDebts,
      totalManualAdj,
      totalNetPayable
    };
  }, [filteredActiveItems]);

  // Export 1: Detailed Internal Excel
  const handleExportDetailedExcel = (exportItems: GradeMentorCalculationItem[], title: string) => {
    const data = exportItems.map((item, idx) => {
      const totalDed = (item.lunchDeduction || 0) + (item.debtDeduction || 0) + (item.loanInstallment || 0) + (item.fundContribution || 0) + (item.otherDeductions || 0);
      return {
        'ردیف': idx + 1,
        'نام و نام خانوادگی استاد': item.name,
        'پایه‌های تحت اشراف': item.gradesStr,
        'کد استادی': item.teacherCode || '-',
        'کد ملی': item.nationalId || '-',
        'ساعت حضور و کارکرد': item.totalHours,
        'نرخ ساعتی (تومان)': item.hourlyRate,
        'ناخالص کارکرد (تومان)': item.baseCompensation,
        'تعداد وعده نهار': item.lunchCount,
        'کسر هزینه نهار (تومان)': item.lunchDeduction,
        'کسر اقساط وام و صندوق (تومان)': (item.loanInstallment || 0) + (item.fundContribution || 0),
        'کسر بدهی و مطالبات (تومان)': item.debtDeduction || 0,
        'سایر کسورات (تومان)': item.otherDeductions || 0,
        'جمع کل کسورات (تومان)': totalDed,
        'پاداش و اضافات (تومان)': item.bonusAmount || 0,
        'افزایش / کاهش دستی (+/-)': item.manualAdjustmentAmount || 0,
        'علت تعدیل دستی': item.manualAdjustmentReason || '-',
        'خالص پرداختی نهایی (تومان)': item.netPayable,
        'بانک': item.bankName || 'تجارت',
        'شماره حساب': item.bankAccount,
        'شماره شبا': item.bankSheba || '-',
        'توضیحات': item.notes || '-'
      };
    });

    // Summary footer row
    const totalHours = exportItems.reduce((s, i) => s + (i.totalHours || 0), 0);
    const totalBase = exportItems.reduce((s, i) => s + (i.baseCompensation || 0), 0);
    const totalLunch = exportItems.reduce((s, i) => s + (i.lunchDeduction || 0), 0);
    const totalDebts = exportItems.reduce((s, i) => s + (i.debtDeduction || 0) + (i.loanInstallment || 0) + (i.fundContribution || 0), 0);
    const totalAdj = exportItems.reduce((s, i) => s + (i.manualAdjustmentAmount || 0), 0);
    const totalNet = exportItems.reduce((s, i) => s + (i.netPayable || 0), 0);

    data.push({
      'ردیف': 'مجموع' as any,
      'نام و نام خانوادگی استاد': `${exportItems.length} استاد`,
      'پایه‌های تحت اشراف': '-',
      'کد استادی': '-',
      'کد ملی': '-',
      'ساعت حضور و کارکرد': totalHours,
      'نرخ ساعتی (تومان)': '-' as any,
      'ناخالص کارکرد (تومان)': totalBase,
      'تعداد وعده نهار': exportItems.reduce((s, i) => s + (i.lunchCount || 0), 0),
      'کسر هزینه نهار (تومان)': totalLunch,
      'کسر اقساط وام و صندوق (تومان)': exportItems.reduce((s, i) => s + (i.loanInstallment || 0) + (i.fundContribution || 0), 0),
      'کسر بدهی و مطالبات (تومان)': totalDebts,
      'سایر کسورات (تومان)': exportItems.reduce((s, i) => s + (i.otherDeductions || 0), 0),
      'جمع کل کسورات (تومان)': exportItems.reduce((s, i) => s + (i.lunchDeduction || 0) + (i.debtDeduction || 0) + (i.loanInstallment || 0) + (i.fundContribution || 0) + (i.otherDeductions || 0), 0),
      'پاداش و اضافات (تومان)': exportItems.reduce((s, i) => s + (i.bonusAmount || 0), 0),
      'افزایش / کاهش دستی (+/-)': totalAdj,
      'علت تعدیل دستی': '-',
      'خالص پرداختی نهایی (تومان)': totalNet,
      'بانک': '-',
      'شماره حساب': '-',
      'شماره شبا': '-',
      'توضیحات': 'تراز نهایی دوره'
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'تفصیلی اساتید پایه');
    XLSX.writeFile(wb, `گزارش_تفصیلی_${title.replace(/\s+/g, '_')}_${getTodayShamsi().replace(/\//g, '_')}.xlsx`);
    showToast('خروجی تفصیلی اکسل با موفقیت دانلود شد.');
  };

  // Export 2: Upper Management / Bank Transfer Excel
  const handleExportUpperManagementExcel = (exportItems: GradeMentorCalculationItem[], title: string) => {
    const data = exportItems.map((item, idx) => {
      const totalDed = (item.lunchDeduction || 0) + (item.debtDeduction || 0) + (item.loanInstallment || 0) + (item.fundContribution || 0) + (item.otherDeductions || 0);
      return {
        'ردیف': idx + 1,
        'نام و نام خانوادگی ذینفع': item.name,
        'پایه تحت مسئولیت': item.gradesStr,
        'کد ملی': item.nationalId || '-',
        'نام بانک': item.bankName || 'تجارت',
        'شماره شبا (IBAN)': item.bankSheba || '-',
        'شماره حساب': item.bankAccount,
        'ناخالص استحقاقی (تومان)': item.baseCompensation,
        'کسورات قانونی و نهار (تومان)': totalDed,
        'تعدیل دستی (+/-)': item.manualAdjustmentAmount || 0,
        'مبلغ واریزی پایا (تومان)': item.netPayable,
        'شناسه پرداخت / بابت': `حق‌الزحمه ${title}`
      };
    });

    const totalGross = exportItems.reduce((s, i) => s + (i.baseCompensation || 0), 0);
    const totalDeds = exportItems.reduce((s, i) => s + (i.lunchDeduction || 0) + (i.debtDeduction || 0) + (i.loanInstallment || 0) + (i.fundContribution || 0) + (i.otherDeductions || 0), 0);
    const totalNet = exportItems.reduce((s, i) => s + (i.netPayable || 0), 0);

    data.push({
      'ردیف': 'مجموع' as any,
      'نام و نام خانوادگی ذینفع': `${exportItems.length} نفر`,
      'پایه تحت مسئولیت': '-',
      'کد ملی': '-',
      'نام بانک': '-',
      'شماره شبا (IBAN)': '-',
      'شماره حساب': '-',
      'ناخالص استحقاقی (تومان)': totalGross,
      'کسورات قانونی و نهار (تومان)': totalDeds,
      'تعدیل دستی (+/-)': exportItems.reduce((s, i) => s + (i.manualAdjustmentAmount || 0), 0),
      'مبلغ واریزی پایا (تومان)': totalNet,
      'شناسه پرداخت / بابت': 'حواله تجمیعی بالادستی'
    });

    // Summary of Type 2 Deductions transferred to specific Destination Accounts
    const totalLunch = exportItems.reduce((s, i) => s + (i.lunchDeduction || 0), 0);
    const totalDebtsAndLoans = exportItems.reduce((s, i) => s + (i.debtDeduction || 0) + (i.loanInstallment || 0) + (i.fundContribution || 0), 0);

    const destinationSummary = [
      {
        'ردیف': 1,
        'عنوان بخش / بابت کسورات': 'کسورات تغذیه و نهار',
        'نام بانک مقصد': 'بانک ملت',
        'شماره حساب مقصد': '۵۸۵۹۸۳۱۰۴۴۵۵۶۶۷۷',
        'شماره شبا (IBAN)': 'IR680120000000585983104455',
        'نام صاحب حساب': 'حساب آشپزخانه و تغذیه',
        'مجموع مبلغ واریزی (تومان)': totalLunch,
        'تعداد نفرات کسر شده': exportItems.filter(i => (i.lunchDeduction || 0) > 0).length,
        'شرح': `واریز کسورات نهار اساتید پایه - دوره ${title}`
      },
      {
        'ردیف': 2,
        'عنوان بخش / بابت کسورات': 'کسورات اقساط وام و صندوق قرض‌الحسنه',
        'نام بانک مقصد': 'بانک ملی',
        'شماره حساب مقصد': '۰۳۰۴۵۶۷۸۹۰۰۱',
        'شماره شبا (IBAN)': 'IR450170000000304567890001',
        'نام صاحب حساب': 'صندوق قرض‌الحسنه امام صادق (ع)',
        'مجموع مبلغ واریزی (تومان)': totalDebtsAndLoans,
        'تعداد نفرات کسر شده': exportItems.filter(i => ((i.debtDeduction || 0) + (i.loanInstallment || 0) + (i.fundContribution || 0)) > 0).length,
        'شرح': `واریز کسورات اقساط و بدهی اساتید پایه - دوره ${title}`
      },
      {
        'ردیف': 'مجموع' as any,
        'عنوان بخش / بابت کسورات': 'مجموع کل کسورات نوع ۲',
        'نام بانک مقصد': '-',
        'شماره حساب مقصد': '-',
        'شماره شبا (IBAN)': '-',
        'نام صاحب حساب': '-',
        'مجموع مبلغ واریزی (تومان)': totalLunch + totalDebtsAndLoans,
        'تعداد نفرات کسر شده': exportItems.length,
        'شرح': 'کل حواله‌های تجمیعی بین‌حسابی'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const ws2 = XLSX.utils.json_to_sheet(destinationSummary);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'حواله پایا اساتید پایه');
    XLSX.utils.book_append_sheet(wb, ws2, 'خلاصه واریزی به حساب‌های مقصد');
    XLSX.writeFile(wb, `حواله_بالادستی_و_حساب‌های_مقصد_${title.replace(/\s+/g, '_')}_${getTodayShamsi().replace(/\//g, '_')}.xlsx`);
    showToast('خروجی اکسل ویژه بالادستی به همراه تفکیک واریزی حساب‌های مقصد دانلود شد.');
  };

  // Filter professors in selector modal
  const eligibleProfessors = useMemo(() => {
    return users.filter(u => {
      const title = (u.roleTitle || '').toLowerCase();
      const role = (u.role || '').toLowerCase();
      const scope = (u.scope || '').toLowerCase();
      const isGradeRole = role.includes('grade_') || role === 'grade_supervisor' || role === 'grade_mentor' || role === 'teacher' || role.includes('mentor');
      const isGradeTitle = title.includes('استاد') || title.includes('مسئول پایه') || title.includes('مسول پایه') || title.includes('پایه');
      const hasManagedGrades = u.managedGrades && u.managedGrades.length > 0;
      const isGradeScope = scope.startsWith('grade_') || scope.includes('grade');

      const matchesRole = isGradeRole || isGradeTitle || hasManagedGrades || isGradeScope;
      if (!matchesRole) return false;

      const matchesSearch = 
        !profSearchQuery || 
        u.fullName.toLowerCase().includes(profSearchQuery.toLowerCase()) ||
        (u.phone && u.phone.includes(profSearchQuery)) ||
        (u.roleTitle && u.roleTitle.toLowerCase().includes(profSearchQuery.toLowerCase()));

      const gradesStr = getUserGradeString(u);
      const matchesGrade = profGradeFilter === 'all' || gradesStr.includes(profGradeFilter);

      return matchesSearch && matchesGrade;
    });
  }, [users, profSearchQuery, profGradeFilter]);

  return (
    <div className="space-y-6 font-vazir pb-16" dir="rtl">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2 text-xs font-bold"
          >
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header & Navigation */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-linear-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <Award size={24} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>محاسبه حق‌الزحمه اساتید و مسئولین پایه</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                  مسئول پایه = استاد پایه
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                تنظیم بازه زمانی، انتخاب اساتید، محاسبه ساعات حضور، کسر نهار، بدهی‌ها، افزایش/کاهش دستی، خروجی اکسل بالادستی و ثبت نهایی در بایگانی
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleOpenDateRangeModal}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Calendar size={16} />
              <span>محاسبه حق‌الزحمه (شروع دوره جدید)</span>
            </button>
          </div>
        </div>

        {/* Top-Level Primary Navigation Tabs */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <button
            onClick={() => setActiveView('create_period')}
            className={cn(
              "flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl font-bold text-xs transition-all cursor-pointer",
              activeView === 'create_period'
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 ring-2 ring-indigo-600/20"
                : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60"
            )}
          >
            <Clock size={17} />
            <span>بخش محاسبه دوره پرداخت حق‌الزحمه</span>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-black", activeView === 'create_period' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700")}>
              {items.length} استاد
            </span>
          </button>

          <button
            onClick={() => setActiveView('periods_archive')}
            className={cn(
              "flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl font-bold text-xs transition-all cursor-pointer",
              activeView === 'periods_archive'
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 ring-2 ring-indigo-600/20"
                : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60"
            )}
          >
            <Archive size={17} />
            <span>مشاهده دوره‌های حق‌الزحمه {`{بایگانی}`}</span>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-black", activeView === 'periods_archive' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700")}>
              {periods.length} دوره
            </span>
          </button>
        </div>
      </div>

      {/* ============================================================= */}
      {/* VIEW 1: ACTIVE CALCULATION WORKSPACE                          */}
      {/* ============================================================= */}
      {activeView === 'create_period' && (
        <div className="space-y-6">
          {/* If no date range configured yet, show attractive landing banner */}
          {!periodTitle ? (
            <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center space-y-4 shadow-xs">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                <Calendar size={32} />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-black text-slate-800">هنوز دوره پرداختی آغاز نشده است</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  برای محاسبه حق‌الزحمه اساتید و مسئولین پایه، ابتدا دکمه «شروع محاسبه و تعیین بازه زمانی» را کلیک کنید تا تاریخ شروع و پایان دوره ثبت شود.
                </p>
              </div>
              <button
                onClick={handleOpenDateRangeModal}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black shadow-md shadow-indigo-100 transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <Plus size={16} />
                <span>شروع محاسبه و تعیین بازه زمانی</span>
              </button>
            </div>
          ) : (
            <>
              {/* Active Period Header Strip */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-black text-slate-900">{periodTitle}</h2>
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-black border",
                        periodStatus === 'finalized' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {periodStatus === 'finalized' ? 'نهایی‌شده' : 'پیش‌نویس در حال ویرایش'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1 font-mono font-bold text-slate-700">
                        <Calendar size={13} className="text-slate-400" />
                        بازه زمانی: {startDate} تا {endDate}
                      </span>
                      <span>•</span>
                      <span>نرخ ساعت: <strong className="text-slate-800 font-mono">{baseHourlyRate.toLocaleString('fa-IR')}</strong> ت</span>
                      <span>•</span>
                      <span>هزینه نهار: <strong className="text-slate-800 font-mono">{lunchCostPerMeal.toLocaleString('fa-IR')}</strong> ت</span>
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Add Professor Button */}
                    <button
                      onClick={handleOpenAddProfessorModal}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer"
                    >
                      <UserPlus size={15} />
                      <span>اضافه کردن استاد پایه جهت پرداخت</span>
                    </button>

                    {/* Compact / Detailed Toggle */}
                    <button
                      onClick={() => setIsCompactView(!isCompactView)}
                      className={cn(
                        "flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                        isCompactView 
                          ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-black"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      )}
                    >
                      <Layers size={15} />
                      <span>{isCompactView ? 'نمایش تفصیلی کامل' : 'نمایش جمع و جور'}</span>
                    </button>

                    {/* Settings Modal Button */}
                    <button
                      onClick={() => setIsSettingsOpen(true)}
                      className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-all cursor-pointer"
                      title="تنظیمات نرخ ساعتی و هزینه نهار"
                    >
                      <SlidersHorizontal size={15} />
                    </button>

                    {/* Detailed Excel Export */}
                    <button
                      onClick={() => handleExportDetailedExcel(filteredActiveItems, periodTitle)}
                      disabled={items.length === 0}
                      className="flex items-center gap-1 px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 transition-all cursor-pointer disabled:opacity-50"
                      title="خروجی اکسل تفصیلی داخلی با تمام جزئیات"
                    >
                      <FileSpreadsheet size={15} />
                      <span>اکسل تفصیلی</span>
                    </button>

                    {/* Upper Management Excel Export */}
                    <button
                      onClick={() => handleExportUpperManagementExcel(filteredActiveItems, periodTitle)}
                      disabled={items.length === 0}
                      className="flex items-center gap-1 px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-xs font-bold border border-blue-200 transition-all cursor-pointer disabled:opacity-50"
                      title="خروجی ویژه حواله بالادستی و واریز پایا"
                    >
                      <Building2 size={15} />
                      <span>اکسل بالادستی</span>
                    </button>

                    {/* Print Slips */}
                    <button
                      onClick={() => setIsBatchSlipOpen(true)}
                      disabled={items.length === 0}
                      className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
                      title="چاپ فیش‌های حقوقی اساتید"
                    >
                      <Printer size={15} />
                    </button>

                    {/* Finalize & Transfer to Archive Button */}
                    <button
                      onClick={handleFinalizeAndArchive}
                      disabled={items.length === 0}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-100 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Save size={15} />
                      <span>ثبت نهایی و انتقال به بایگانی</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Summary Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                  <span className="text-[11px] text-slate-500 font-medium">تعداد اساتید در جدول</span>
                  <div className="text-base font-black text-slate-800">
                    {activeSummaryStats.totalProfessors} <span className="text-[10px] font-normal text-slate-500">نفر</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {activeSummaryStats.totalHours} ساعت کارکرد
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                  <span className="text-[11px] text-slate-500 font-medium">ناخالص کارکرد اساتید</span>
                  <div className="text-base font-black text-slate-800 font-mono">
                    {activeSummaryStats.totalBase.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-slate-500">تومان</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    ساعت × نرخ مصوب
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                  <span className="text-[11px] text-slate-500 font-medium">کسورات نهار مصرفی</span>
                  <div className="text-base font-black text-rose-600 font-mono">
                    {activeSummaryStats.totalLunchDeductions.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-slate-500">تومان</span>
                  </div>
                  <div className="text-[10px] text-rose-500">
                    {activeSummaryStats.totalLunchCount} وعده نهار
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                  <span className="text-[11px] text-slate-500 font-medium">کسر بدهی‌ها و مطالبات</span>
                  <div className="text-base font-black text-amber-700 font-mono">
                    {activeSummaryStats.totalDebts.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-slate-500">تومان</span>
                  </div>
                  <div className="text-[10px] text-amber-600">
                    صندوق و اقساط وام
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                  <span className="text-[11px] text-slate-500 font-medium">تعدیلات دستی مسئول</span>
                  <div className={cn(
                    "text-base font-black font-mono",
                    activeSummaryStats.totalManualAdj > 0 ? "text-emerald-700" : activeSummaryStats.totalManualAdj < 0 ? "text-rose-700" : "text-slate-700"
                  )}>
                    {activeSummaryStats.totalManualAdj > 0 ? `+${activeSummaryStats.totalManualAdj.toLocaleString('fa-IR')}` : activeSummaryStats.totalManualAdj.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-slate-500">تومان</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    افزایش یا کاهش دستی
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1 bg-linear-to-br from-indigo-50/50 to-indigo-100/30">
                  <span className="text-[11px] text-indigo-700 font-bold">خالص کل پرداختی دوره</span>
                  <div className="text-base font-black text-indigo-900 font-mono">
                    {activeSummaryStats.totalNetPayable.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-indigo-700">تومان</span>
                  </div>
                  <div className="text-[10px] text-indigo-600 font-bold">
                    مجموع واریزی پایا
                  </div>
                </div>
              </div>

              {/* Filter Strip */}
              <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="relative sm:col-span-2">
                    <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="جستجوی نام استاد، کدملی، پایه تحت اشراف..."
                      className="w-full pr-10 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <div>
                    <select
                      value={selectedGradeFilter}
                      onChange={(e) => setSelectedGradeFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-indigo-500 transition-all"
                    >
                      <option value="all">همه پایه‌ها</option>
                      <option value="پایه ۷">پایه ۷</option>
                      <option value="پایه ۸">پایه ۸</option>
                      <option value="پایه ۹">پایه ۹</option>
                      <option value="پایه ۱۰">پایه ۱۰</option>
                      <option value="پایه ۱۱">پایه ۱۱</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Main Table: Empty State or Populated Table */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={17} className="text-indigo-600" />
                    <h3 className="text-xs font-black text-slate-800">
                      جدول محاسبه حق‌الزحمه ({filteredActiveItems.length} استاد) - {isCompactView ? 'نمای جمع و جور' : 'نمای تفصیلی کامل'}
                    </h3>
                  </div>

                  <div className="text-[11px] text-slate-500">
                    تمامی ستون‌ها از جمله ساعت، نهار، بدهی‌ها و تعدیلات دستی قابل ویرایش مستقیم می‌باشند.
                  </div>
                </div>

                {items.length === 0 ? (
                  /* User explicitly asked: "سپس یک جدول کاملا خالی می بینم، دکمه اضافه کردن استاد پایه جهت پرداخت رو میزنیم" */
                  <div className="py-20 text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-3xl flex items-center justify-center mx-auto text-slate-400">
                      <Users size={32} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-slate-700">جدول محاسبه پرداخت در این دوره خالی است</h4>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        جهت شروع محاسبه، روی دکمه زیر کلیک کرده و یک یا چند نفر از اساتید پایه ثبت‌شده در نرم‌افزار را انتخاب و اضافه نمایید.
                      </p>
                    </div>
                    <button
                      onClick={handleOpenAddProfessorModal}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black shadow-md shadow-emerald-100 transition-all cursor-pointer inline-flex items-center gap-2"
                    >
                      <UserPlus size={16} />
                      <span>اضافه کردن استاد پایه جهت پرداخت</span>
                    </button>
                  </div>
                ) : filteredActiveItems.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    استادی با مشخصات جستجو شده یافت نشد.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                        {isCompactView ? (
                          /* Compact View Header */
                          <tr>
                            <th className="py-3 px-2 w-8 text-center">ردیف</th>
                            <th className="py-3 px-3">استاد / مسئول پایه</th>
                            <th className="py-3 px-2 text-center">ساعت</th>
                            <th className="py-3 px-2 text-center">ناخالص کارکرد</th>
                            <th className="py-3 px-2 text-center text-rose-700">جمع کسورات و بدهی‌ها</th>
                            <th className="py-3 px-2 text-center text-indigo-700">تعدیل دستی (+/-)</th>
                            <th className="py-3 px-2 text-center">علت تعدیل</th>
                            <th className="py-3 px-3 text-center text-emerald-900 bg-emerald-50/60 font-black">خالص پرداختی</th>
                            <th className="py-3 px-3">شماره شبا</th>
                            <th className="py-3 px-3 text-center">عملیات</th>
                          </tr>
                        ) : (
                          /* Detailed View Header */
                          <tr>
                            <th className="py-3 px-2 w-8 text-center">ردیف</th>
                            <th className="py-3 px-3">استاد / مسئول پایه</th>
                            <th className="py-3 px-2 text-center">ساعت کارکرد</th>
                            <th className="py-3 px-2 text-center">نرخ ساعتی</th>
                            <th className="py-3 px-2 text-center">ناخالص کارکرد</th>
                            <th className="py-3 px-2 text-center">تعداد نهار</th>
                            <th className="py-3 px-2 text-center text-rose-700">کسر نهار</th>
                            <th className="py-3 px-2 text-center text-amber-800">کسر بدهی/وام</th>
                            <th className="py-3 px-2 text-center text-emerald-700">پاداش</th>
                            <th className="py-3 px-2 text-center text-indigo-700">تعدیل دستی (+/-)</th>
                            <th className="py-3 px-2">علت تعدیل دستی</th>
                            <th className="py-3 px-3 text-center text-emerald-900 bg-emerald-50/60 font-black">خالص پرداختی</th>
                            <th className="py-3 px-3">حساب بانکی / شبا</th>
                            <th className="py-3 px-3 text-center">عملیات</th>
                          </tr>
                        )}
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredActiveItems.map((item, idx) => {
                          const totalDed = (item.lunchDeduction || 0) + (item.debtDeduction || 0) + (item.loanInstallment || 0) + (item.fundContribution || 0) + (item.otherDeductions || 0);

                          return (
                            <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors">
                              <td className="py-3 px-2 text-center text-slate-400 font-mono">
                                {(idx + 1).toLocaleString('fa-IR')}
                              </td>

                              {/* Professor Name & Info */}
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-900">{item.name}</div>
                                <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                  <span className="px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700 font-bold">
                                    {item.gradesStr}
                                  </span>
                                  {item.teacherCode && (
                                    <span className="font-mono text-slate-400">کد: {item.teacherCode}</span>
                                  )}
                                  {item.nationalId && (
                                    <span className="font-mono text-slate-400">کدملی: {item.nationalId}</span>
                                  )}
                                </div>
                              </td>

                              {isCompactView ? (
                                /* Compact Row Cells */
                                <>
                                  <td className="py-3 px-2 text-center font-mono font-bold text-slate-800">
                                    <input
                                      type="number"
                                      value={item.totalHours}
                                      onChange={(e) => handleItemFieldChange(item.id, 'totalHours', Number(e.target.value))}
                                      className="w-14 px-1 py-1 text-center bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-800 outline-hidden"
                                    />
                                  </td>
                                  <td className="py-3 px-2 text-center font-bold text-slate-700 font-mono">
                                    {item.baseCompensation.toLocaleString('fa-IR')}
                                  </td>
                                  <td className="py-3 px-2 text-center font-bold text-rose-600 font-mono">
                                    {totalDed.toLocaleString('fa-IR')}
                                  </td>
                                  <td className="py-3 px-2 text-center">
                                    <input
                                      type="number"
                                      value={item.manualAdjustmentAmount || 0}
                                      onChange={(e) => handleItemFieldChange(item.id, 'manualAdjustmentAmount', Number(e.target.value))}
                                      className={cn(
                                        "w-20 px-1 py-1 text-center rounded-lg font-mono font-bold outline-hidden transition-all text-xs",
                                        (item.manualAdjustmentAmount || 0) > 0
                                          ? "bg-emerald-50 border border-emerald-300 text-emerald-800"
                                          : (item.manualAdjustmentAmount || 0) < 0
                                          ? "bg-rose-50 border border-rose-300 text-rose-800"
                                          : "bg-slate-50 border border-slate-200 text-slate-700"
                                      )}
                                    />
                                  </td>
                                  <td className="py-3 px-2">
                                    <input
                                      type="text"
                                      value={item.manualAdjustmentReason || ''}
                                      onChange={(e) => handleItemFieldChange(item.id, 'manualAdjustmentReason', e.target.value)}
                                      placeholder="علت تعدیل..."
                                      className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] outline-hidden focus:border-indigo-500"
                                    />
                                  </td>
                                  <td className="py-3 px-3 text-center font-mono font-black text-emerald-800 bg-emerald-50/50 text-xs">
                                    {item.netPayable.toLocaleString('fa-IR')}
                                  </td>
                                  <td className="py-3 px-3 text-[11px] font-mono text-slate-600">
                                    {item.bankSheba || item.bankAccount}
                                  </td>
                                </>
                              ) : (
                                /* Detailed Row Cells */
                                <>
                                  {/* Editable Hours */}
                                  <td className="py-3 px-1 text-center">
                                    <input
                                      type="number"
                                      value={item.totalHours}
                                      onChange={(e) => handleItemFieldChange(item.id, 'totalHours', Number(e.target.value))}
                                      className="w-14 px-1 py-1 text-center bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-800 outline-hidden focus:border-indigo-500"
                                      min={0}
                                    />
                                  </td>

                                  {/* Editable Rate */}
                                  <td className="py-3 px-1 text-center">
                                    <input
                                      type="number"
                                      value={item.hourlyRate}
                                      onChange={(e) => handleItemFieldChange(item.id, 'hourlyRate', Number(e.target.value))}
                                      className="w-20 px-1 py-1 text-center bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-800 outline-hidden focus:border-indigo-500"
                                      min={0}
                                    />
                                  </td>

                                  {/* Base Compensation */}
                                  <td className="py-3 px-2 text-center font-bold text-slate-700 font-mono">
                                    {item.baseCompensation.toLocaleString('fa-IR')}
                                  </td>

                                  {/* Editable Lunch Count */}
                                  <td className="py-3 px-1 text-center">
                                    <input
                                      type="number"
                                      value={item.lunchCount}
                                      onChange={(e) => handleItemFieldChange(item.id, 'lunchCount', Number(e.target.value))}
                                      className="w-12 px-1 py-1 text-center bg-amber-50/50 hover:bg-white focus:bg-white border border-amber-200 rounded-lg font-mono font-bold text-amber-900 outline-hidden focus:border-amber-500"
                                      min={0}
                                    />
                                  </td>

                                  {/* Lunch Deduction Amount */}
                                  <td className="py-3 px-2 text-center font-bold text-rose-600 font-mono">
                                    {item.lunchDeduction.toLocaleString('fa-IR')}
                                  </td>

                                  {/* Editable Debt Deduction */}
                                  <td className="py-3 px-1 text-center">
                                    <input
                                      type="number"
                                      value={item.debtDeduction || 0}
                                      onChange={(e) => handleItemFieldChange(item.id, 'debtDeduction', Number(e.target.value))}
                                      className={cn(
                                        "w-20 px-1 py-1 text-center rounded-lg font-mono font-bold outline-hidden transition-all",
                                        (item.debtDeduction || 0) > 0 
                                          ? "bg-amber-50 border border-amber-300 text-amber-900" 
                                          : "bg-slate-50 border border-slate-200 text-slate-700 focus:bg-white"
                                      )}
                                      min={0}
                                      title={item.debtNotes || 'کسر بدهی ثبت‌شده'}
                                    />
                                  </td>

                                  {/* Editable Bonus */}
                                  <td className="py-3 px-1 text-center">
                                    <input
                                      type="number"
                                      value={item.bonusAmount}
                                      onChange={(e) => handleItemFieldChange(item.id, 'bonusAmount', Number(e.target.value))}
                                      className="w-16 px-1 py-1 text-center bg-emerald-50/50 hover:bg-white focus:bg-white border border-emerald-200 rounded-lg font-mono font-bold text-emerald-900 outline-hidden focus:border-emerald-500"
                                      min={0}
                                    />
                                  </td>

                                  {/* Editable Manual Adjustment Amount */}
                                  <td className="py-3 px-1 text-center">
                                    <input
                                      type="number"
                                      value={item.manualAdjustmentAmount || 0}
                                      onChange={(e) => handleItemFieldChange(item.id, 'manualAdjustmentAmount', Number(e.target.value))}
                                      className={cn(
                                        "w-20 px-1 py-1 text-center rounded-lg font-mono font-bold outline-hidden transition-all text-xs",
                                        (item.manualAdjustmentAmount || 0) > 0
                                          ? "bg-emerald-50 border border-emerald-300 text-emerald-800"
                                          : (item.manualAdjustmentAmount || 0) < 0
                                          ? "bg-rose-50 border border-rose-300 text-rose-800"
                                          : "bg-slate-50 border border-slate-200 text-slate-700"
                                      )}
                                      placeholder="+/-"
                                    />
                                  </td>

                                  {/* Editable Manual Adjustment Reason */}
                                  <td className="py-3 px-2">
                                    <input
                                      type="text"
                                      value={item.manualAdjustmentReason || ''}
                                      onChange={(e) => handleItemFieldChange(item.id, 'manualAdjustmentReason', e.target.value)}
                                      placeholder="علت افزایش/کاهش دستی..."
                                      className="w-28 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] outline-hidden focus:border-indigo-500"
                                    />
                                  </td>

                                  {/* Net Payable */}
                                  <td className="py-3 px-3 text-center font-black text-emerald-800 bg-emerald-50/60 font-mono text-xs">
                                    {item.netPayable.toLocaleString('fa-IR')}
                                  </td>

                                  {/* Bank Account / Sheba */}
                                  <td className="py-3 px-3">
                                    <div className="text-[11px] font-mono text-slate-700 font-bold">{item.bankAccount}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">{item.bankSheba || item.bankName}</div>
                                  </td>
                                </>
                              )}

                              {/* Operations */}
                              <td className="py-3 px-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  {/* Pay Slip */}
                                  <button
                                    onClick={() => setSingleSlipItem(item)}
                                    className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                                    title="مشاهده فیش حقوقی"
                                  >
                                    <Receipt size={13} />
                                    <span>فیش</span>
                                  </button>

                                  {/* Full Modal Edit */}
                                  <button
                                    onClick={() => setEditingItem(item)}
                                    className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-all cursor-pointer"
                                    title="ویرایش کامل مشخصات"
                                  >
                                    <Edit3 size={13} />
                                  </button>

                                  {/* Delete Row */}
                                  <button
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 transition-all cursor-pointer"
                                    title="حذف از جدول"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* VIEW 2: PERIODS ARCHIVE                                       */}
      {/* ============================================================= */}
      {activeView === 'periods_archive' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Archive size={18} className="text-indigo-600" />
                  <span>بایگانی دوره‌های پرداخت حق‌الزحمه اساتید پایه</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  مشاهده دوره‌های ثبت‌شده، ویرایش اطلاعات، خروجی اکسل تفصیلی و بالادستی
                </p>
              </div>

              <button
                onClick={handleOpenDateRangeModal}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Plus size={15} />
                <span>تعریف دوره جدید</span>
              </button>
            </div>

            {periods.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-3">
                <Archive size={36} className="mx-auto text-slate-300" />
                <p className="text-xs font-bold text-slate-500">هنوز هیچ دوره‌ای در بایگانی ذخیره نشده است.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Period Selector Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-100">
                  {periods.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedArchivedPeriod(p);
                        setIsArchivedModified(false);
                      }}
                      className={cn(
                        "px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2",
                        selectedArchivedPeriod?.id === p.id
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 ring-2 ring-indigo-600/20"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200"
                      )}
                    >
                      <Calendar size={14} />
                      <span>{p.title}</span>
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-black",
                        selectedArchivedPeriod?.id === p.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                      )}>
                        {p.totalProfessors} استاد
                      </span>
                    </button>
                  ))}
                </div>

                {/* Selected Archived Period Workspace */}
                {selectedArchivedPeriod && (
                  <div className="space-y-4">
                    {/* Archived Period Bar */}
                    <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-black text-slate-900">{selectedArchivedPeriod.title}</h3>
                          <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                            بایگانی‌شده
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                          <span>بازه: <strong className="text-slate-700 font-mono">{selectedArchivedPeriod.startDate}</strong> تا <strong className="text-slate-700 font-mono">{selectedArchivedPeriod.endDate}</strong></span>
                          <span>•</span>
                          <span>خالص کل پرداختی: <strong className="text-emerald-700 font-mono font-black">{selectedArchivedPeriod.totalPayoutAmount.toLocaleString('fa-IR')}</strong> تومان</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Compact view switch */}
                        <button
                          onClick={() => setIsCompactView(!isCompactView)}
                          className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Layers size={14} />
                          <span>{isCompactView ? 'نمایش تفصیلی' : 'نمایش جمع و جور'}</span>
                        </button>

                        {/* Save Archived Changes */}
                        {isArchivedModified && (
                          <button
                            onClick={handleSaveArchivedChanges}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <Save size={14} />
                            <span>ذخیره تغییرات در بایگانی</span>
                          </button>
                        )}

                        {/* Detailed Excel */}
                        <button
                          onClick={() => handleExportDetailedExcel(selectedArchivedPeriod.items, selectedArchivedPeriod.title)}
                          className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <FileSpreadsheet size={14} />
                          <span>اکسل تفصیلی</span>
                        </button>

                        {/* Upper Management Excel */}
                        <button
                          onClick={() => handleExportUpperManagementExcel(selectedArchivedPeriod.items, selectedArchivedPeriod.title)}
                          className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-xs font-bold border border-blue-200 transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Building2 size={14} />
                          <span>اکسل بالادستی</span>
                        </button>

                        {/* Delete from archive */}
                        <button
                          onClick={() => handleDeleteArchivedPeriod(selectedArchivedPeriod.id)}
                          className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl border border-rose-200 transition-all cursor-pointer"
                          title="حذف این دوره از بایگانی"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Table of Selected Archived Period */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                            {isCompactView ? (
                              <tr>
                                <th className="py-3 px-2 w-8 text-center">ردیف</th>
                                <th className="py-3 px-3">استاد پایه</th>
                                <th className="py-3 px-2 text-center">ساعت</th>
                                <th className="py-3 px-2 text-center">ناخالص</th>
                                <th className="py-3 px-2 text-center text-rose-700">کسورات و بدهی</th>
                                <th className="py-3 px-2 text-center text-indigo-700">تعدیل دستی (+/-)</th>
                                <th className="py-3 px-2">علت تعدیل</th>
                                <th className="py-3 px-3 text-center text-emerald-900 bg-emerald-50/60 font-black">خالص پرداختی</th>
                                <th className="py-3 px-3">شماره شبا</th>
                                <th className="py-3 px-3 text-center">عملیات</th>
                              </tr>
                            ) : (
                              <tr>
                                <th className="py-3 px-2 w-8 text-center">ردیف</th>
                                <th className="py-3 px-3">استاد پایه</th>
                                <th className="py-3 px-2 text-center">ساعت کارکرد</th>
                                <th className="py-3 px-2 text-center">نرخ ساعتی</th>
                                <th className="py-3 px-2 text-center">ناخالص</th>
                                <th className="py-3 px-2 text-center">تعداد نهار</th>
                                <th className="py-3 px-2 text-center text-rose-700">کسر نهار</th>
                                <th className="py-3 px-2 text-center text-amber-800">کسر بدهی/وام</th>
                                <th className="py-3 px-2 text-center text-emerald-700">پاداش</th>
                                <th className="py-3 px-2 text-center text-indigo-700">تعدیل دستی (+/-)</th>
                                <th className="py-3 px-2">علت تعدیل دستی</th>
                                <th className="py-3 px-3 text-center text-emerald-900 bg-emerald-50/60 font-black">خالص پرداختی</th>
                                <th className="py-3 px-3">شماره حساب / شبا</th>
                                <th className="py-3 px-3 text-center">عملیات</th>
                              </tr>
                            )}
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedArchivedPeriod.items.map((item, idx) => {
                              const totalDed = (item.lunchDeduction || 0) + (item.debtDeduction || 0) + (item.loanInstallment || 0) + (item.fundContribution || 0) + (item.otherDeductions || 0);

                              return (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-3 px-2 text-center text-slate-400 font-mono">
                                    {(idx + 1).toLocaleString('fa-IR')}
                                  </td>
                                  <td className="py-3 px-3">
                                    <div className="font-bold text-slate-900">{item.name}</div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">{item.gradesStr}</div>
                                  </td>

                                  {isCompactView ? (
                                    <>
                                      <td className="py-3 px-2 text-center font-mono font-bold">{item.totalHours}</td>
                                      <td className="py-3 px-2 text-center font-mono font-bold">{item.baseCompensation.toLocaleString('fa-IR')}</td>
                                      <td className="py-3 px-2 text-center font-mono text-rose-700 font-bold">{totalDed.toLocaleString('fa-IR')}</td>
                                      <td className="py-3 px-2 text-center">
                                        <input
                                          type="number"
                                          value={item.manualAdjustmentAmount || 0}
                                          onChange={(e) => handleArchivedItemFieldChange(item.id, 'manualAdjustmentAmount', Number(e.target.value))}
                                          className="w-20 px-1 py-1 text-center border rounded-lg font-mono font-bold text-xs"
                                        />
                                      </td>
                                      <td className="py-3 px-2">
                                        <input
                                          type="text"
                                          value={item.manualAdjustmentReason || ''}
                                          onChange={(e) => handleArchivedItemFieldChange(item.id, 'manualAdjustmentReason', e.target.value)}
                                          placeholder="علت تعدیل..."
                                          className="w-24 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px]"
                                        />
                                      </td>
                                      <td className="py-3 px-3 text-center font-mono font-black text-emerald-800 bg-emerald-50/50">
                                        {item.netPayable.toLocaleString('fa-IR')}
                                      </td>
                                      <td className="py-3 px-3 text-[11px] font-mono text-slate-600">
                                        {item.bankSheba || item.bankAccount}
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="py-3 px-1 text-center">
                                        <input
                                          type="number"
                                          value={item.totalHours}
                                          onChange={(e) => handleArchivedItemFieldChange(item.id, 'totalHours', Number(e.target.value))}
                                          className="w-14 px-1 py-1 text-center bg-white border border-slate-200 rounded-lg font-mono font-bold"
                                        />
                                      </td>
                                      <td className="py-3 px-1 text-center font-mono text-slate-700">
                                        {item.hourlyRate.toLocaleString('fa-IR')}
                                      </td>
                                      <td className="py-3 px-2 text-center font-bold text-slate-700 font-mono">
                                        {item.baseCompensation.toLocaleString('fa-IR')}
                                      </td>
                                      <td className="py-3 px-1 text-center">
                                        <input
                                          type="number"
                                          value={item.lunchCount}
                                          onChange={(e) => handleArchivedItemFieldChange(item.id, 'lunchCount', Number(e.target.value))}
                                          className="w-12 px-1 py-1 text-center bg-white border border-slate-200 rounded-lg font-mono font-bold"
                                        />
                                      </td>
                                      <td className="py-3 px-2 text-center font-bold text-rose-600 font-mono">
                                        {item.lunchDeduction.toLocaleString('fa-IR')}
                                      </td>
                                      <td className="py-3 px-1 text-center">
                                        <input
                                          type="number"
                                          value={item.debtDeduction || 0}
                                          onChange={(e) => handleArchivedItemFieldChange(item.id, 'debtDeduction', Number(e.target.value))}
                                          className="w-20 px-1 py-1 text-center bg-white border border-slate-200 rounded-lg font-mono font-bold"
                                        />
                                      </td>
                                      <td className="py-3 px-1 text-center font-mono text-emerald-700">
                                        {item.bonusAmount.toLocaleString('fa-IR')}
                                      </td>
                                      <td className="py-3 px-1 text-center">
                                        <input
                                          type="number"
                                          value={item.manualAdjustmentAmount || 0}
                                          onChange={(e) => handleArchivedItemFieldChange(item.id, 'manualAdjustmentAmount', Number(e.target.value))}
                                          className="w-20 px-1 py-1 text-center bg-white border border-slate-200 rounded-lg font-mono font-bold text-xs"
                                        />
                                      </td>
                                      <td className="py-3 px-2">
                                        <input
                                          type="text"
                                          value={item.manualAdjustmentReason || ''}
                                          onChange={(e) => handleArchivedItemFieldChange(item.id, 'manualAdjustmentReason', e.target.value)}
                                          placeholder="علت تعدیل..."
                                          className="w-28 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px]"
                                        />
                                      </td>
                                      <td className="py-3 px-3 text-center font-mono font-black text-emerald-800 bg-emerald-50/50">
                                        {item.netPayable.toLocaleString('fa-IR')}
                                      </td>
                                      <td className="py-3 px-3 text-[11px] font-mono text-slate-700">
                                        {item.bankAccount}
                                      </td>
                                    </>
                                  )}

                                  <td className="py-3 px-3 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        onClick={() => setSingleSlipItem(item)}
                                        className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-all cursor-pointer text-[10px] font-bold flex items-center gap-1"
                                      >
                                        <Receipt size={12} />
                                        <span>فیش</span>
                                      </button>
                                      <button
                                        onClick={() => handleDeleteArchivedItem(item.id)}
                                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 transition-all cursor-pointer"
                                        title="حذف از این دوره بایگانی"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 1: STEP 1 - DATE RANGE & PERIOD CONFIGURATION MODAL     */}
      {/* ============================================================= */}
      <AnimatePresence>
        {isDateRangeModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 space-y-5"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">تعیین بازه زمانی و مشخصات دوره حق‌الزحمه</h3>
                    <p className="text-[11px] text-slate-500">گام اول: ثبت بازه ارزیابی و ورود به جدول محاسبه</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsDateRangeModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">عنوان دوره پرداخت حق‌الزحمه *</label>
                  <input
                    type="text"
                    value={modalTitle}
                    onChange={(e) => setModalTitle(e.target.value)}
                    placeholder="مثال: حق‌الزحمه اساتید و مسئولین پایه - آبان ۱۴۰۳"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">از تاریخ (شروع بازه ارزیابی) *</label>
                    <input
                      type="text"
                      value={modalStart}
                      onChange={(e) => setModalStart(e.target.value)}
                      placeholder="۱۴۰۳/۰۸/۰۱"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 outline-hidden focus:border-indigo-500 text-center"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">تا تاریخ (پایان بازه ارزیابی) *</label>
                    <input
                      type="text"
                      value={modalEnd}
                      onChange={(e) => setModalEnd(e.target.value)}
                      placeholder="۱۴۰۳/۰۸/۳۰"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 outline-hidden focus:border-indigo-500 text-center"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">نرخ مصوب هر ساعت کارکرد (تومان)</label>
                    <input
                      type="number"
                      value={modalHourlyRate}
                      onChange={(e) => setModalHourlyRate(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 outline-hidden"
                      step={10000}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">هزینه هر وعده نهار (تومان)</label>
                    <input
                      type="number"
                      value={modalLunchCost}
                      onChange={(e) => setModalLunchCost(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 outline-hidden"
                      step={5000}
                    />
                  </div>
                </div>

                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-[11px] text-indigo-900 leading-relaxed">
                  پس از ثبت، وارد صفحه محاسبه با جدول خالی می‌شوید و می‌توانید با زدن دکمه <strong>«اضافه کردن استاد پایه جهت پرداخت»</strong> اساتید مورد نظر را از لیست انتخاب فرمایید.
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsDateRangeModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDateRange}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-md shadow-indigo-100 cursor-pointer"
                  >
                    ثبت بازه زمانی و ورود به جدول محاسبه
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================= */}
      {/* MODAL 2: PROFESSOR PICKER (افزودن اساتید پایه به جدول)        */}
      {/* ============================================================= */}
      <AnimatePresence>
        {isAddProfessorModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] flex flex-col"
              dir="rtl"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                    <UserPlus size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">انتخاب اساتید و مسئولین پایه جهت پرداخت</h3>
                    <p className="text-[11px] text-slate-500">انتخاب از لیست اساتید ثبت‌شده در نرم‌افزار</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsAddProfessorModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Filters in Picker */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="relative sm:col-span-2">
                  <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={profSearchQuery}
                    onChange={(e) => setProfSearchQuery(e.target.value)}
                    placeholder="جستجوی نام استاد، عنوان، تلفن..."
                    className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-hidden"
                  />
                </div>

                <div>
                  <select
                    value={profGradeFilter}
                    onChange={(e) => setProfGradeFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-hidden"
                  >
                    <option value="all">همه پایه‌ها</option>
                    <option value="پایه ۷">پایه ۷</option>
                    <option value="پایه ۸">پایه ۸</option>
                    <option value="پایه ۹">پایه ۹</option>
                    <option value="پایه ۱۰">پایه ۱۰</option>
                    <option value="پایه ۱۱">پایه ۱۱</option>
                  </select>
                </div>
              </div>

              {/* Select All Row */}
              <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs">
                <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eligibleProfessors.length > 0 && eligibleProfessors.every(p => selectedProfessorIds.includes(p.id) || items.some(it => it.userId === p.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const allAvailableIds = eligibleProfessors
                          .filter(p => !items.some(it => it.userId === p.id))
                          .map(p => p.id);
                        setSelectedProfessorIds(allAvailableIds);
                      } else {
                        setSelectedProfessorIds([]);
                      }
                    }}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span>انتخاب همه اساتید قابل افزودن ({eligibleProfessors.filter(p => !items.some(it => it.userId === p.id)).length} نفر)</span>
                </label>

                <span className="text-[11px] text-slate-500 font-bold">
                  {selectedProfessorIds.length} نفر انتخاب شده
                </span>
              </div>

              {/* Professors List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100 max-h-72">
                {eligibleProfessors.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 text-xs">
                    استادی با مشخصات جستجو شده یافت نشد.
                  </div>
                ) : (
                  eligibleProfessors.map((prof) => {
                    const isAlreadyAdded = items.some(it => it.userId === prof.id);
                    const isChecked = selectedProfessorIds.includes(prof.id) || isAlreadyAdded;
                    const grades = getUserGradeString(prof);

                    return (
                      <div
                        key={prof.id}
                        onClick={() => {
                          if (isAlreadyAdded) return;
                          if (selectedProfessorIds.includes(prof.id)) {
                            setSelectedProfessorIds(prev => prev.filter(id => id !== prof.id));
                          } else {
                            setSelectedProfessorIds(prev => [...prev, prof.id]);
                          }
                        }}
                        className={cn(
                          "p-3 rounded-2xl flex items-center justify-between gap-3 transition-all pt-2.5",
                          isAlreadyAdded
                            ? "bg-slate-50 opacity-60 cursor-not-allowed"
                            : isChecked
                            ? "bg-emerald-50/70 border border-emerald-200 cursor-pointer"
                            : "hover:bg-slate-50 border border-transparent cursor-pointer"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isAlreadyAdded}
                            onChange={() => {}}
                            className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                          />
                          <div>
                            <div className="font-bold text-slate-900 text-xs">{prof.fullName}</div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span className="px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700 font-bold">
                                {grades}
                              </span>
                              {prof.roleTitle && <span>{prof.roleTitle}</span>}
                              {prof.phone && <span className="font-mono">{prof.phone}</span>}
                            </div>
                          </div>
                        </div>

                        <div>
                          {isAlreadyAdded ? (
                            <span className="px-2.5 py-0.5 bg-slate-200 text-slate-700 rounded-full text-[10px] font-bold">
                              در جدول موجود است
                            </span>
                          ) : isChecked ? (
                            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold flex items-center gap-1">
                              <Check size={12} />
                              آماده افزودن
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddProfessorModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAddProfessors}
                  disabled={selectedProfessorIds.length === 0}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-100 cursor-pointer disabled:opacity-50"
                >
                  افزودن اساتید انتخاب‌شده به جدول ({selectedProfessorIds.length} نفر)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================= */}
      {/* MODAL 3: FULL EDIT ITEM MODAL                                 */}
      {/* ============================================================= */}
      <AnimatePresence>
        {editingItem && (
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
                  ویرایش کامل مشخصات و کارکرد: {editingItem.name}
                </h3>
                <button
                  onClick={() => setEditingItem(null)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ساعت حضور و کارکرد</label>
                  <input
                    type="number"
                    value={editingItem.totalHours}
                    onChange={(e) => setEditingItem({ ...editingItem, totalHours: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">نرخ هر ساعت (تومان)</label>
                  <input
                    type="number"
                    value={editingItem.hourlyRate}
                    onChange={(e) => setEditingItem({ ...editingItem, hourlyRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">تعداد وعده نهار</label>
                  <input
                    type="number"
                    value={editingItem.lunchCount}
                    onChange={(e) => setEditingItem({ ...editingItem, lunchCount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">کسر بدهی و مطالبات (تومان)</label>
                  <input
                    type="number"
                    value={editingItem.debtDeduction || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, debtDeduction: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl font-bold text-amber-900 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">افزایش / کاهش دستی (+/- تومان)</label>
                  <input
                    type="number"
                    value={editingItem.manualAdjustmentAmount || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, manualAdjustmentAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl font-bold text-indigo-900 outline-hidden"
                    placeholder="مثلاً 200000 یا -150000"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">علت افزایش / کاهش دستی</label>
                  <input
                    type="text"
                    value={editingItem.manualAdjustmentReason || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, manualAdjustmentReason: e.target.value })}
                    placeholder="شرح علت تعدیل مالی..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">پاداش / تشویقی (تومان)</label>
                  <input
                    type="number"
                    value={editingItem.bonusAmount || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, bonusAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">سایر کسورات (تومان)</label>
                  <input
                    type="number"
                    value={editingItem.otherDeductions || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, otherDeductions: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-hidden"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">شماره شبا بانکی</label>
                  <input
                    type="text"
                    value={editingItem.bankSheba || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, bankSheba: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold outline-hidden"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">شماره حساب بانکی</label>
                  <input
                    type="text"
                    value={editingItem.bankAccount || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, bankAccount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const recalculated = recalculateItem(editingItem, editingItem.hourlyRate, lunchCostPerMeal);
                    setItems(prev => prev.map(i => i.id === recalculated.id ? recalculated : i));
                    setEditingItem(null);
                    showToast('تغییرات با موفقیت ذخیره شد.');
                  }}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm cursor-pointer"
                >
                  ذخیره تغییرات
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================= */}
      {/* MODAL 4: SETTINGS MODAL (HOURLY RATE & LUNCH MEAL PRICE)      */}
      {/* ============================================================= */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-5"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    <SlidersHorizontal size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">تنظیمات سراسری حق‌الزحمه اساتید</h3>
                    <p className="text-[11px] text-slate-500">نرخ ساعت کارکرد و هزینه نهار</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    نرخ مصوب هر ساعت کارکرد استاد پایه (تومان)
                  </label>
                  <input
                    type="number"
                    value={baseHourlyRate}
                    onChange={(e) => setBaseHourlyRate(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-hidden"
                    min={1000}
                    step={10000}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    هزینه هر وعده نهار مصرفی استاد (تومان)
                  </label>
                  <input
                    type="number"
                    value={lunchCostPerMeal}
                    onChange={(e) => setLunchCostPerMeal(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-hidden"
                    min={0}
                    step={5000}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setItems(prev => prev.map(item => recalculateItem({ ...item, hourlyRate: baseHourlyRate }, baseHourlyRate, lunchCostPerMeal)));
                      setIsSettingsOpen(false);
                      showToast('تنظیمات جدید به تمام اساتید جدول اعمال گردید.');
                    }}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-sm cursor-pointer"
                  >
                    اعمال به تمام اساتید جدول
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================= */}
      {/* MODAL 5: PRINT PAY SLIP (SINGLE OR BATCH)                     */}
      {/* ============================================================= */}
      <AnimatePresence>
        {(singleSlipItem || isBatchSlipOpen) && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-slate-100 space-y-6 my-8 print:shadow-none print:border-none print:my-0 print:p-0"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 print:hidden">
                <h3 className="text-sm font-black text-slate-900">
                  {singleSlipItem ? `فیش حقوقی: ${singleSlipItem.name}` : `چاپ کلیه فیش‌ها (${filteredActiveItems.length} استاد)`}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer size={15} />
                    <span>چاپ برگه فیش</span>
                  </button>
                  <button
                    onClick={() => { setSingleSlipItem(null); setIsBatchSlipOpen(false); }}
                    className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Slips Content */}
              <div className="space-y-6">
                {(singleSlipItem ? [singleSlipItem] : filteredActiveItems).map((slip) => (
                  <div key={slip.id} className="border-2 border-slate-800 rounded-2xl p-5 space-y-4 bg-white break-after-page">
                    {/* Slip Header */}
                    <div className="text-center border-b-2 border-slate-800 pb-3 space-y-1">
                      <div className="text-base font-black text-slate-900">حوزه علمیه حضرت مهدی (عج)</div>
                      <div className="text-xs font-bold text-slate-700">فیش پرداخت حق‌الزحمه استاد و مسئول پایه</div>
                      <div className="text-[11px] text-slate-500">{periodTitle || 'دوره حق‌الزحمه'} (بازه: {startDate} تا {endDate})</div>
                    </div>

                    {/* Professor Info Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-slate-500 text-[10px]">نام و نام خانوادگی:</span>
                        <div className="font-black text-slate-900">{slip.name}</div>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px]">پایه‌های تحت اشراف:</span>
                        <div className="font-bold text-indigo-700">{slip.gradesStr}</div>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px]">کد استادی / ملی:</span>
                        <div className="font-mono text-slate-700">{slip.teacherCode || slip.nationalId || '-'}</div>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px]">شماره حساب / شبا:</span>
                        <div className="font-mono text-slate-700 text-[11px]">{slip.bankAccount}</div>
                      </div>
                    </div>

                    {/* Breakdown Table */}
                    <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-right divide-y divide-slate-200">
                        <thead className="bg-slate-100 text-slate-700 font-bold">
                          <tr>
                            <th className="p-2">شرح آیتم مالی</th>
                            <th className="p-2 text-center">تعداد / ساعت</th>
                            <th className="p-2 text-center">نرخ واحد (تومان)</th>
                            <th className="p-2 text-center">مبلغ بستانکار (+)</th>
                            <th className="p-2 text-center">مبلغ بدهکار (-)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="p-2 font-bold text-slate-800">ساعت حضور و کارکرد نظارت</td>
                            <td className="p-2 text-center font-mono">{slip.totalHours} ساعت</td>
                            <td className="p-2 text-center font-mono">{slip.hourlyRate.toLocaleString('fa-IR')}</td>
                            <td className="p-2 text-center font-mono font-bold text-emerald-700">
                              {slip.baseCompensation.toLocaleString('fa-IR')}
                            </td>
                            <td className="p-2 text-center text-slate-400">-</td>
                          </tr>

                          {slip.lunchCount > 0 && (
                            <tr>
                              <td className="p-2 font-bold text-slate-800">کسر هزینه نهار مصرفی</td>
                              <td className="p-2 text-center font-mono">{slip.lunchCount} وعده</td>
                              <td className="p-2 text-center font-mono">{lunchCostPerMeal.toLocaleString('fa-IR')}</td>
                              <td className="p-2 text-center text-slate-400">-</td>
                              <td className="p-2 text-center font-mono font-bold text-rose-700">
                                {slip.lunchDeduction.toLocaleString('fa-IR')}
                              </td>
                            </tr>
                          )}

                          {(slip.debtDeduction || 0) > 0 && (
                            <tr>
                              <td className="p-2 font-bold text-slate-800">
                                <span>کسر بدهی و مطالبات ثبت‌شده</span>
                                {slip.debtNotes && <span className="text-[10px] text-slate-400 block font-normal">({slip.debtNotes})</span>}
                              </td>
                              <td className="p-2 text-center font-mono">-</td>
                              <td className="p-2 text-center font-mono">-</td>
                              <td className="p-2 text-center text-slate-400">-</td>
                              <td className="p-2 text-center font-mono font-bold text-amber-800">
                                {(slip.debtDeduction || 0).toLocaleString('fa-IR')}
                              </td>
                            </tr>
                          )}

                          {(slip.manualAdjustmentAmount || 0) !== 0 && (
                            <tr>
                              <td className="p-2 font-bold text-slate-800">
                                <span>تعدیل دستی مسئول مالی ({slip.manualAdjustmentAmount! > 0 ? 'افزایش' : 'کاهش'})</span>
                                {slip.manualAdjustmentReason && <span className="text-[10px] text-slate-500 block font-normal">({slip.manualAdjustmentReason})</span>}
                              </td>
                              <td className="p-2 text-center font-mono">-</td>
                              <td className="p-2 text-center font-mono">-</td>
                              <td className="p-2 text-center font-mono font-bold text-emerald-700">
                                {slip.manualAdjustmentAmount! > 0 ? slip.manualAdjustmentAmount!.toLocaleString('fa-IR') : '-'}
                              </td>
                              <td className="p-2 text-center font-mono font-bold text-rose-700">
                                {slip.manualAdjustmentAmount! < 0 ? Math.abs(slip.manualAdjustmentAmount!).toLocaleString('fa-IR') : '-'}
                              </td>
                            </tr>
                          )}

                          {slip.bonusAmount > 0 && (
                            <tr>
                              <td className="p-2 font-bold text-slate-800">پاداش و اضافه کارکرد</td>
                              <td className="p-2 text-center font-mono">-</td>
                              <td className="p-2 text-center font-mono">-</td>
                              <td className="p-2 text-center font-mono font-bold text-emerald-700">
                                {slip.bonusAmount.toLocaleString('fa-IR')}
                              </td>
                              <td className="p-2 text-center text-slate-400">-</td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot className="bg-emerald-50/80 border-t-2 border-slate-300 font-bold">
                          <tr>
                            <td colSpan={3} className="p-2.5 text-slate-900 font-black">
                              خالص مبلغ قابل پرداخت به استاد:
                            </td>
                            <td colSpan={2} className="p-2.5 text-center font-black text-emerald-900 text-sm font-mono">
                              {slip.netPayable.toLocaleString('fa-IR')} تومان
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-2 gap-8 pt-4 text-center text-xs font-bold text-slate-700">
                      <div>
                        امضاء و مهر مسئول مالی حوزه:
                        <div className="h-8 mt-2 border-b border-dashed border-slate-300"></div>
                      </div>
                      <div>
                        امضاء و تایید استاد محترم:
                        <div className="h-8 mt-2 border-b border-dashed border-slate-300"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
