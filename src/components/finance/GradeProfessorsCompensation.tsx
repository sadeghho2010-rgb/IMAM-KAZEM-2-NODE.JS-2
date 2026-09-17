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
  UtensilsCrossed
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

  // Active Period State
  const [activePeriodId, setActivePeriodId] = useState<string | null>(null);
  const [periodTitle, setPeriodTitle] = useState('حق‌الزحمه اساتید و مسئولین پایه - مهر ۱۴۰۳');
  const [startDate, setStartDate] = useState('۱۴۰۳/۰۷/۰۱');
  const [endDate, setEndDate] = useState('۱۴۰۳/۰۷/۳۰');
  const [lunchCostPerMeal, setLunchCostPerMeal] = useState<number>(45000);
  const [baseHourlyRate, setBaseHourlyRate] = useState<number>(200000);
  const [periodStatus, setPeriodStatus] = useState<'draft' | 'finalized' | 'paid'>('draft');
  const [items, setItems] = useState<GradeMentorCalculationItem[]>([]);
  const [claimsList, setClaimsList] = useState<StudentClaimRecord[]>([]);

  // Archived Periods
  const [periods, setPeriods] = useState<GradeMentorPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('all');

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GradeMentorCalculationItem | null>(null);
  const [singleSlipItem, setSingleSlipItem] = useState<GradeMentorCalculationItem | null>(null);
  const [isBatchSlipOpen, setIsBatchSlipOpen] = useState(false);
  const [isNewPeriodModalOpen, setIsNewPeriodModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // New Period Form State
  const [newModalTitle, setNewModalTitle] = useState('');
  const [newModalStart, setNewModalStart] = useState('');
  const [newModalEnd, setNewModalEnd] = useState('');

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

  // Find system users designated as Grade Professors / Grade Supervisors
  // Requirement: "مسول پایه = استاد پایه" & show all users designated by Super Admin
  const registeredGradeProfessors = useMemo(() => {
    return users.filter(u => {
      const title = (u.roleTitle || '').toLowerCase();
      const role = (u.role || '').toLowerCase();
      const scope = (u.scope || '').toLowerCase();
      const isGradeRole = role.includes('grade_') || role === 'grade_supervisor' || role === 'grade_mentor' || role.includes('mentor');
      const isGradeTitle = title.includes('استاد پایه') || title.includes('مسئول پایه') || title.includes('مسول پایه') || title.includes('پایه');
      const hasManagedGrades = u.managedGrades && u.managedGrades.length > 0;
      const isGradeScope = scope.startsWith('grade_') || scope === 'grade_7' || scope === 'grade_8' || scope === 'grade_9' || scope === 'grade_10';
      return isGradeRole || isGradeTitle || hasManagedGrades || isGradeScope;
    });
  }, [users]);

  // Find debt deduction for a given professor
  const getProfessorDebt = (userId: string, name: string, claims: StudentClaimRecord[]): { totalDebt: number; monthlyDed: number; notes: string } => {
    const matchedClaims = claims.filter(c => {
      const matchId = c.studentId === userId;
      const matchName = c.studentName && name && (c.studentName.trim() === name.trim() || name.includes(c.studentName) || c.studentName.includes(name));
      const isActive = c.status === 'active' || ((c.remainingAmount ?? c.totalDebtAmount) > 0);
      return (matchId || matchName) && isActive;
    });

    const totalDebt = matchedClaims.reduce((sum, c) => sum + (c.remainingAmount ?? c.totalDebtAmount ?? 0), 0);
    const monthlyDed = matchedClaims.reduce((sum, c) => sum + (c.monthlyDeductionAmount || c.remainingAmount || 0), 0);
    const notes = matchedClaims.map(c => c.notes || c.targetType || 'بدهی ثبت‌شده').join(' | ');

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
    const otherDed = Number(item.otherDeductions) || 0;
    const netPayable = Math.max(0, baseCompensation + bonus - lunchDeduction - debtDed - otherDed);

    return {
      ...item,
      hourlyRate: effectiveRate,
      baseCompensation,
      lunchCount: lunchMeals,
      lunchDeduction,
      bonusAmount: bonus,
      debtDeduction: debtDed,
      otherDeductions: otherDed,
      netPayable
    };
  };

  // Load Saved Periods, Claims, and Active Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [storedPeriods, storedClaims] = await Promise.all([
        localDb.getDocs<GradeMentorPeriod>('finance_grade_mentor_periods'),
        localDb.getDocs<StudentClaimRecord>('finance_student_claims')
      ]);
      
      const claims = storedClaims || [];
      setClaimsList(claims);

      let periodList = storedPeriods || [];
      if (periodList.length === 0) {
        // Build initial seed period if none exists
        const initialItems: GradeMentorCalculationItem[] = (
          registeredGradeProfessors.length > 0 
            ? registeredGradeProfessors 
            : [
                {
                  id: 'u-def-1',
                  fullName: 'استاد حیاتی (مسئول پایه ۷)',
                  roleTitle: 'مسئول پایه ۷',
                  managedGrades: ['پایه ۷']
                } as any,
                {
                  id: 'u-def-2',
                  fullName: 'استاد حسینی (مسئول پایه ۸)',
                  roleTitle: 'مسئول پایه ۸',
                  managedGrades: ['پایه ۸']
                } as any,
                {
                  id: 'u-def-3',
                  fullName: 'استاد سلیمانی (مسئول پایه ۹)',
                  roleTitle: 'مسئول پایه ۹',
                  managedGrades: ['پایه ۹']
                } as any,
                {
                  id: 'u-def-4',
                  fullName: 'استاد اسدی (مسئول پایه ۱۰)',
                  roleTitle: 'مسئول پایه ۱۰',
                  managedGrades: ['پایه ۱۰']
                } as any
              ]
        ).map((u, idx) => {
          const hours = 24 + (idx * 2);
          const rate = 200000;
          const base = hours * rate;
          const lunchMeals = 12 + idx;
          const lunchDed = lunchMeals * 45000;
          const bonus = idx % 2 === 0 ? 300000 : 0;
          const debtInfo = getProfessorDebt(u.id, u.fullName, claims);
          const debtDed = debtInfo.monthlyDed || (idx === 1 ? 250000 : 0);
          const otherDed = 0;
          const net = Math.max(0, base + bonus - lunchDed - debtDed - otherDed);
          const grades = getUserGradeString(u);

          return {
            id: `gmi-${u.id}-${Date.now() + idx}`,
            userId: u.id,
            name: u.fullName,
            gradesStr: grades,
            teacherCode: `PROF-${101 + idx}`,
            totalHours: hours,
            hourlyRate: rate,
            baseCompensation: base,
            lunchCount: lunchMeals,
            lunchDeduction: lunchDed,
            bonusAmount: bonus,
            debtDeduction: debtDed,
            debtNotes: debtInfo.notes || (debtDed > 0 ? 'بدهی ماهانه / قسط قرض‌الحسنه' : ''),
            otherDeductions: otherDed,
            netPayable: net,
            bankName: 'بانک تجارت',
            bankAccount: `۶۲۷۳-۸۱۱۰-${1000 + idx * 20}-${2000 + idx * 20}`,
            bankSheba: `IR98018000000000${1000000000 + idx * 100}`,
            status: 'approved',
            notes: 'محاسبه کارکرد بر اساس حضور و نظارت‌های ثبت‌شده'
          };
        });

        const initialPeriod: GradeMentorPeriod = {
          id: 'period-mentor-1403-07',
          title: 'حق‌الزحمه اساتید و مسئولین پایه - مهر ۱۴۰۳',
          startDate: '۱۴۰۳/۰۷/۰۱',
          endDate: '۱۴۰۳/۰۷/۳۰',
          status: 'draft',
          totalProfessors: initialItems.length,
          totalPayoutAmount: initialItems.reduce((acc, i) => acc + i.netPayable, 0),
          lunchCostPerMeal: 45000,
          baseHourlyRate: 200000,
          items: initialItems,
          createdAt: new Date().toISOString(),
          createdByName: currentUser?.fullName || 'مسئول مالی'
        };

        await localDb.setDoc('finance_grade_mentor_periods', initialPeriod);
        periodList = [initialPeriod];
      }

      setPeriods(periodList);

      // Load the most recent period into editor
      const latestPeriod = periodList[0];
      setActivePeriodId(latestPeriod.id);
      setPeriodTitle(latestPeriod.title);
      setStartDate(latestPeriod.startDate);
      setEndDate(latestPeriod.endDate);
      setLunchCostPerMeal(latestPeriod.lunchCostPerMeal || 45000);
      setBaseHourlyRate(latestPeriod.baseHourlyRate || 200000);
      setPeriodStatus(latestPeriod.status || 'draft');

      // Auto-merge any newly created system users assigned as Grade Professor/Supervisor
      let currentItems = [...(latestPeriod.items || [])];

      registeredGradeProfessors.forEach((u, idx) => {
        const exists = currentItems.some(item => item.userId === u.id || item.name === u.fullName);
        if (!exists) {
          const grades = getUserGradeString(u);
          const hours = 22;
          const rate = latestPeriod.baseHourlyRate || 200000;
          const base = hours * rate;
          const lunchMeals = 10;
          const lunchDed = lunchMeals * (latestPeriod.lunchCostPerMeal || 45000);
          const bonus = 0;
          const debtInfo = getProfessorDebt(u.id, u.fullName, claims);
          const debtDed = debtInfo.monthlyDed;
          const otherDed = 0;
          const net = Math.max(0, base + bonus - lunchDed - debtDed - otherDed);

          currentItems.push({
            id: `gmi-${u.id}-${Date.now() + idx}`,
            userId: u.id,
            name: u.fullName,
            gradesStr: grades,
            teacherCode: `PROF-${100 + currentItems.length + 1}`,
            totalHours: hours,
            hourlyRate: rate,
            baseCompensation: base,
            lunchCount: lunchMeals,
            lunchDeduction: lunchDed,
            bonusAmount: bonus,
            debtDeduction: debtDed,
            debtNotes: debtInfo.notes || (debtDed > 0 ? 'بدهی ماهانه' : ''),
            otherDeductions: otherDed,
            netPayable: net,
            bankName: 'بانک تجارت',
            bankAccount: '۶۲۷۳-۸۱۱۰-۰۰۰۰-۰۰۰۰',
            bankSheba: 'IR980180000000000000000000',
            status: 'approved',
            notes: `ثبت خودکار از کاربران سیستم (${u.roleTitle || 'استاد / مسئول پایه'})`
          });
        }
      });

      // Ensure debt deduction is up to date for existing rows
      currentItems = currentItems.map(item => {
        const debtInfo = getProfessorDebt(item.userId, item.name, claims);
        const debtDed = item.debtDeduction !== undefined ? item.debtDeduction : debtInfo.monthlyDed;
        const recalculated = recalculateItem({
          ...item,
          debtDeduction: debtDed,
          debtNotes: item.debtNotes || debtInfo.notes
        }, item.hourlyRate, latestPeriod.lunchCostPerMeal || 45000);
        return recalculated;
      });

      setItems(currentItems);

    } catch (err) {
      console.error('Error loading grade mentor periods:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [users.length, registeredGradeProfessors.length]);

  // Sync System Professors into the current period manually
  const handleSyncGradeProfessors = () => {
    if (registeredGradeProfessors.length === 0) {
      showToast('هیچ کاربری با نقش استاد یا مسئول پایه در مدیریت کاربران ثبت نشده است.');
      return;
    }

    const currentList = [...items];
    let addedCount = 0;

    registeredGradeProfessors.forEach((u, idx) => {
      const exists = currentList.some(item => item.userId === u.id || item.name === u.fullName);
      if (!exists) {
        const grades = getUserGradeString(u);
        const hours = 20;
        const base = hours * baseHourlyRate;
        const lunchCount = 10;
        const lunchDed = lunchCount * lunchCostPerMeal;
        const bonus = 0;
        const debtInfo = getProfessorDebt(u.id, u.fullName, claimsList);
        const debtDed = debtInfo.monthlyDed;
        const otherDed = 0;
        const net = Math.max(0, base + bonus - lunchDed - debtDed - otherDed);

        currentList.push({
          id: `gmi-${u.id}-${Date.now() + idx}`,
          userId: u.id,
          name: u.fullName,
          gradesStr: grades,
          teacherCode: `PROF-${100 + currentList.length + 1}`,
          totalHours: hours,
          hourlyRate: baseHourlyRate,
          baseCompensation: base,
          lunchCount,
          lunchDeduction: lunchDed,
          bonusAmount: bonus,
          debtDeduction: debtDed,
          debtNotes: debtInfo.notes,
          otherDeductions: otherDed,
          netPayable: net,
          bankName: 'بانک تجارت',
          bankAccount: '۶۲۷۳-۸۱۱۰-۰۰۰۰-۰۰۰۰',
          bankSheba: 'IR980180000000000000000000',
          status: 'approved',
          notes: `ثبت از کاربران سیستم (${u.roleTitle || 'استاد / مسئول پایه'})`
        });
        addedCount++;
      }
    });

    setItems(currentList);
    showToast(`تعداد ${addedCount} استاد/مسئول پایه جدید به جدول اضافه شد.`);
  };

  // Update item field directly
  const handleItemFieldChange = (itemId: string, field: keyof GradeMentorCalculationItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const updated = { ...item, [field]: value };
      return recalculateItem(updated, updated.hourlyRate, lunchCostPerMeal);
    }));
  };

  // Apply Global Settings to All Rows
  const handleApplySettings = (newHourlyRate: number, newMealPrice: number) => {
    setBaseHourlyRate(newHourlyRate);
    setLunchCostPerMeal(newMealPrice);
    setItems(prev => prev.map(item => recalculateItem({ ...item, hourlyRate: newHourlyRate }, newHourlyRate, newMealPrice)));
    setIsSettingsOpen(false);
    showToast('تنظیمات نرخ ساعتی و هزینه نهار با موفقیت به تمام اساتید اعمال شد.');
  };

  // Save Current Period to Archive
  const handleSavePeriod = async (status: 'draft' | 'finalized' | 'paid' = periodStatus) => {
    if (!periodTitle.trim()) {
      showToast('لطفاً عنوان دوره را وارد نمایید.');
      return;
    }
    if (items.length === 0) {
      showToast('هیچ استادی در جدول محاسبه این دوره وجود ندارد.');
      return;
    }

    const totalPayout = items.reduce((acc, i) => acc + i.netPayable, 0);

    const periodDocId = activePeriodId || `period-mentor-${Date.now()}`;
    const periodData: GradeMentorPeriod = {
      id: periodDocId,
      title: periodTitle.trim(),
      startDate,
      endDate,
      status,
      totalProfessors: items.length,
      totalPayoutAmount: totalPayout,
      lunchCostPerMeal,
      baseHourlyRate,
      items,
      createdAt: new Date().toISOString(),
      createdByName: currentUser?.fullName || 'مسئول مالی',
      finalizedAt: status === 'finalized' || status === 'paid' ? new Date().toISOString() : undefined,
      finalizedByName: status === 'finalized' || status === 'paid' ? (currentUser?.fullName || 'مسئول مالی') : undefined
    };

    await localDb.setDoc('finance_grade_mentor_periods', periodData);
    setActivePeriodId(periodDocId);
    setPeriodStatus(status);
    setPeriods(prev => {
      const idx = prev.findIndex(p => p.id === periodDocId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = periodData;
        return copy;
      }
      return [periodData, ...prev];
    });

    showToast(`دوره پرداخت «${periodTitle}» با موفقیت در بایگانی ذخیره شد.`);
  };

  // Load an Archived Period into the Editor
  const handleLoadArchivedPeriod = (period: GradeMentorPeriod) => {
    setActivePeriodId(period.id);
    setPeriodTitle(period.title);
    setStartDate(period.startDate);
    setEndDate(period.endDate);
    setLunchCostPerMeal(period.lunchCostPerMeal || 45000);
    setBaseHourlyRate(period.baseHourlyRate || 200000);
    setPeriodStatus(period.status || 'draft');
    setItems(period.items || []);
    setActiveView('create_period');
    showToast(`دوره «${period.title}» بارگذاری شد.`);
  };

  // Create brand new blank period
  const handleCreateNewPeriod = () => {
    const today = getTodayShamsi();
    const parts = today.split('/');
    const year = parts[0] || '۱۴۰۳';
    const month = parts[1] || '۰۷';
    const monthNames: Record<string, string> = {
      '۰۱': 'فروردین', '۰۲': 'اردیبهشت', '۰۳': 'خرداد',
      '۰۴': 'تیر', '۰۵': 'مرداد', '۰۶': 'شهریور',
      '۰۷': 'مهر', '۰۸': 'آبان', '۰۹': 'آذر',
      '۱۰': 'دی', '۱۱': 'بهمن', '۱۲': 'اسفند'
    };
    const mName = monthNames[month] || 'ماه جاری';
    setNewModalTitle(`حق‌الزحمه اساتید و مسئولین پایه - ${mName} ${year}`);
    setNewModalStart(`${year}/${month}/۰۱`);
    setNewModalEnd(`${year}/${month}/۳۰`);
    setIsNewPeriodModalOpen(true);
  };

  const handleConfirmNewPeriod = () => {
    if (!newModalTitle.trim()) {
      showToast('لطفاً عنوان دوره را وارد نمایید.');
      return;
    }

    const newId = `period-mentor-${Date.now()}`;
    const initialItems: GradeMentorCalculationItem[] = registeredGradeProfessors.map((u, idx) => {
      const grades = getUserGradeString(u);
      const hours = 24;
      const base = hours * baseHourlyRate;
      const lunchMeals = 12;
      const lunchDed = lunchMeals * lunchCostPerMeal;
      const bonus = 0;
      const debtInfo = getProfessorDebt(u.id, u.fullName, claimsList);
      const debtDed = debtInfo.monthlyDed;
      const otherDed = 0;
      const net = Math.max(0, base + bonus - lunchDed - debtDed - otherDed);

      return {
        id: `gmi-${u.id}-${Date.now() + idx}`,
        userId: u.id,
        name: u.fullName,
        gradesStr: grades,
        teacherCode: `PROF-${101 + idx}`,
        totalHours: hours,
        hourlyRate: baseHourlyRate,
        baseCompensation: base,
        lunchCount: lunchMeals,
        lunchDeduction: lunchDed,
        bonusAmount: bonus,
        debtDeduction: debtDed,
        debtNotes: debtInfo.notes,
        otherDeductions: otherDed,
        netPayable: net,
        bankName: 'بانک تجارت',
        bankAccount: '۶۲۷۳-۸۱۱۰-۰۰۰۰-۰۰۰۰',
        bankSheba: 'IR980180000000000000000000',
        status: 'approved',
        notes: 'دوره جدید'
      };
    });

    setActivePeriodId(newId);
    setPeriodTitle(newModalTitle);
    setStartDate(newModalStart);
    setEndDate(newModalEnd);
    setPeriodStatus('draft');
    setItems(initialItems);
    setIsNewPeriodModalOpen(false);
    setActiveView('create_period');
    showToast(`دوره جدید «${newModalTitle}» ایجاد شد.`);
  };

  // Delete an item from active period
  const handleDeleteItem = (itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
    showToast('استاد مورد نظر از این دوره حذف شد.');
  };

  // Delete archived period
  const handleDeleteArchivedPeriod = async (periodId: string) => {
    if (!window.confirm('آیا از حذف این دوره از بایگانی اطمینان دارید؟')) return;
    await localDb.deleteDoc('finance_grade_mentor_periods', periodId);
    setPeriods(prev => prev.filter(p => p.id !== periodId));
    if (activePeriodId === periodId) {
      setActivePeriodId(null);
    }
    showToast('دوره با موفقیت از بایگانی حذف شد.');
  };

  // Filter items in active table
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchSearch = 
        !searchQuery || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.gradesStr && item.gradesStr.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.teacherCode && item.teacherCode.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchGrade = selectedGradeFilter === 'all' || (item.gradesStr && item.gradesStr.includes(selectedGradeFilter));

      return matchSearch && matchGrade;
    });
  }, [items, searchQuery, selectedGradeFilter]);

  // Aggregate Metrics for Header
  const summaryStats = useMemo(() => {
    const totalProfessors = filteredItems.length;
    const totalHours = filteredItems.reduce((acc, i) => acc + (Number(i.totalHours) || 0), 0);
    const totalBase = filteredItems.reduce((acc, i) => acc + (Number(i.baseCompensation) || 0), 0);
    const totalLunchCount = filteredItems.reduce((acc, i) => acc + (Number(i.lunchCount) || 0), 0);
    const totalLunchDeductions = filteredItems.reduce((acc, i) => acc + (Number(i.lunchDeduction) || 0), 0);
    const totalDebts = filteredItems.reduce((acc, i) => acc + (Number(i.debtDeduction) || 0), 0);
    const totalBonuses = filteredItems.reduce((acc, i) => acc + (Number(i.bonusAmount) || 0), 0);
    const totalNetPayable = filteredItems.reduce((acc, i) => acc + (Number(i.netPayable) || 0), 0);

    return {
      totalProfessors,
      totalHours,
      totalBase,
      totalLunchCount,
      totalLunchDeductions,
      totalDebts,
      totalBonuses,
      totalNetPayable
    };
  }, [filteredItems]);

  // Export to Excel
  const handleExportExcel = () => {
    const data = filteredItems.map((item, idx) => ({
      'ردیف': idx + 1,
      'نام استاد / مسئول پایه': item.name,
      'پایه‌های تحت اشراف': item.gradesStr,
      'کد استادی': item.teacherCode || '-',
      'ساعت حضور و کارکرد': item.totalHours,
      'نرخ ساعتی (تومان)': item.hourlyRate,
      'ناخالص کارکرد (تومان)': item.baseCompensation,
      'تعداد وعده نهار': item.lunchCount,
      'کسر هزینه نهار (تومان)': item.lunchDeduction,
      'کسر بدهی و مطالبات (تومان)': item.debtDeduction || 0,
      'پاداش و اضافات (تومان)': item.bonusAmount,
      'سایر کسورات (تومان)': item.otherDeductions,
      'خالص پرداختی (تومان)': item.netPayable,
      'بانک': item.bankName || 'تجارت',
      'شماره حساب': item.bankAccount,
      'شماره شبا': item.bankSheba || '-',
      'وضعیت': item.status === 'paid' ? 'پرداخت شده' : item.status === 'approved' ? 'تایید شده' : 'در انتظار',
      'توضیحات': item.notes || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'حق‌الزحمه اساتید پایه');
    XLSX.writeFile(wb, `${periodTitle.replace(/\s+/g, '_')}_${getTodayShamsi().replace(/\//g, '_')}.xlsx`);
    showToast('خروجی اکسل با موفقیت دانلود شد.');
  };

  // Print All Slips
  const handlePrintSlips = () => {
    setIsBatchSlipOpen(true);
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

      {/* Main Header & Top Navigation */}
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
                محاسبه ساعات کارکرد، کسر نهار مصرفی، اعمال و کسر بدهی‌های ثبت‌شده، چاپ فیش حقوقی و بایگانی
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCreateNewPeriod}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>ایجاد دوره پرداخت جدید</span>
            </button>

            {activeView === 'create_period' && (
              <>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-all cursor-pointer"
                  title="تنظیمات نرخ ساعتی و هزینه نهار"
                >
                  <SlidersHorizontal size={16} />
                  <span>تنظیمات دوره</span>
                </button>

                <button
                  onClick={() => handleSavePeriod('draft')}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 transition-all cursor-pointer"
                  title="ذخیره دوره در بایگانی"
                >
                  <Save size={16} />
                  <span>ذخیره در بایگانی</span>
                </button>

                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 transition-all cursor-pointer"
                  title="خروجی فایل اکسل"
                >
                  <FileSpreadsheet size={16} />
                  <span>اکسل</span>
                </button>

                <button
                  onClick={handlePrintSlips}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-all cursor-pointer"
                  title="چاپ فیش‌های حقوقی"
                >
                  <Printer size={16} />
                  <span>چاپ فیش‌ها</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Two Top-Level Primary Navigation Buttons */}
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
            <span>محاسبه دوره پرداخت حق‌الزحمه اساتید پایه</span>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-black", activeView === 'create_period' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700")}>
              {items.length} استاد/مسئول پایه
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

      {/* VIEW 1: CREATE & CALCULATE PERIOD */}
      {activeView === 'create_period' && (
        <div className="space-y-6">
          {/* Active Period Details Strip */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Title & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">عنوان دوره پرداخت</label>
                  <input
                    type="text"
                    value={periodTitle}
                    onChange={(e) => setPeriodTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">تاریخ شروع دوره</label>
                  <input
                    type="text"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">تاریخ پایان دوره</label>
                  <input
                    type="text"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Status & Sync Button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSyncGradeProfessors}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 transition-all cursor-pointer"
                  title="همگام‌سازی اساتید مصوب سوپر ادمین"
                >
                  <RotateCcw size={14} />
                  <span>همگام‌سازی اساتید پایه</span>
                </button>

                <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold">
                  <span className="text-slate-500">وضعیت:</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-black",
                    periodStatus === 'paid' ? "bg-emerald-100 text-emerald-800" :
                    periodStatus === 'finalized' ? "bg-blue-100 text-blue-800" :
                    "bg-amber-100 text-amber-800"
                  )}>
                    {periodStatus === 'paid' ? 'پرداخت شده' : periodStatus === 'finalized' ? 'نهایی‌شده' : 'پیش‌نویس'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metric Cards Strip */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] text-slate-500 font-medium">تعداد اساتید و مسئولین پایه</span>
              <div className="text-base font-black text-slate-800">
                {summaryStats.totalProfessors} <span className="text-[10px] font-normal text-slate-500">نفر</span>
              </div>
              <div className="text-[10px] text-indigo-600 font-bold">
                شناسایی شده از مدیریت کاربران
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] text-slate-500 font-medium">مجموع ناخالص کارکرد</span>
              <div className="text-base font-black text-slate-800">
                {summaryStats.totalBase.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-slate-500">تومان</span>
              </div>
              <div className="text-[10px] text-slate-500">
                {summaryStats.totalHours} ساعت کارکرد
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] text-slate-500 font-medium">کسورات نهار مصرفی</span>
              <div className="text-base font-black text-rose-600">
                {summaryStats.totalLunchDeductions.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-slate-500">تومان</span>
              </div>
              <div className="text-[10px] text-rose-500 font-medium">
                مجموع {summaryStats.totalLunchCount} وعده نهار
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[11px] text-slate-500 font-medium">کسر بدهی‌ها و مطالبات</span>
              <div className="text-base font-black text-amber-700">
                {summaryStats.totalDebts.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-slate-500">تومان</span>
              </div>
              <div className="text-[10px] text-amber-600 font-medium">
                کسر از بخش مطالبات و بدهی‌ها
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1 bg-linear-to-br from-indigo-50/50 to-indigo-100/30">
              <span className="text-[11px] text-indigo-700 font-bold">خالص کل پرداختی دوره</span>
              <div className="text-lg font-black text-indigo-900">
                {summaryStats.totalNetPayable.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-indigo-700">تومان</span>
              </div>
              <div className="text-[10px] text-indigo-600 font-bold">
                واریزی پایا به حساب اساتید
              </div>
            </div>
          </div>

          {/* Table Filters Toolbar */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative sm:col-span-2">
                <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجوی نام استاد پایه، کد استادی، پایه‌های تحت اشراف..."
                  className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 transition-all"
                />
              </div>

              <div>
                <select
                  value={selectedGradeFilter}
                  onChange={(e) => setSelectedGradeFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-indigo-500 transition-all"
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

          {/* Fully Editable Grade Professors Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={17} className="text-indigo-600" />
                <h2 className="text-xs font-black text-slate-800">
                  جدول تفصیلی حق‌الزحمه اساتید و مسئولین پایه ({filteredItems.length} نفر)
                </h2>
              </div>

              <div className="text-[11px] text-slate-500">
                کلیه مقادیر ساعت، نهار، بدهی، پاداش و نرخ ساعتی قابل ویرایش مستقیم است.
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-3">
                <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                  <Award size={28} />
                </div>
                <p className="text-xs font-bold text-slate-500">هیچ استادی برای نمایش در این دوره یافت نشد.</p>
                <button
                  onClick={handleSyncGradeProfessors}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all"
                >
                  بارگذاری مجدد اساتید و مسئولین پایه از سیستم
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200/80">
                    <tr>
                      <th className="py-3 px-2 w-8 text-center">ردیف</th>
                      <th className="py-3 px-3">استاد / مسئول پایه</th>
                      <th className="py-3 px-2 text-center">ساعت</th>
                      <th className="py-3 px-2 text-center">نرخ ساعتی</th>
                      <th className="py-3 px-2 text-center">ناخالص پایه</th>
                      <th className="py-3 px-2 text-center">نهار (وعده)</th>
                      <th className="py-3 px-2 text-center text-rose-700">کسر نهار</th>
                      <th className="py-3 px-2 text-center text-amber-800">کسر بدهی/مطالبات</th>
                      <th className="py-3 px-2 text-center text-emerald-700">پاداش/اضافه</th>
                      <th className="py-3 px-2 text-center">سایر کسورات</th>
                      <th className="py-3 px-3 text-center text-indigo-900 bg-indigo-50/50">خالص پرداختی</th>
                      <th className="py-3 px-3">حساب بانکی</th>
                      <th className="py-3 px-3 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="py-3 px-2 text-center text-slate-400 font-mono">
                          {(idx + 1).toLocaleString('fa-IR')}
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{item.name}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                            <span className="px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700 font-bold">
                              {item.gradesStr}
                            </span>
                            {item.teacherCode && (
                              <span className="font-mono text-slate-400">کد: {item.teacherCode}</span>
                            )}
                          </div>
                        </td>

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

                        {/* Editable Other Deductions */}
                        <td className="py-3 px-1 text-center">
                          <input
                            type="number"
                            value={item.otherDeductions}
                            onChange={(e) => handleItemFieldChange(item.id, 'otherDeductions', Number(e.target.value))}
                            className="w-16 px-1 py-1 text-center bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-800 outline-hidden focus:border-indigo-500"
                            min={0}
                          />
                        </td>

                        {/* Net Payable */}
                        <td className="py-3 px-3 text-center font-black text-indigo-700 bg-indigo-50/60 font-mono text-sm">
                          {item.netPayable.toLocaleString('fa-IR')}
                        </td>

                        {/* Bank Account */}
                        <td className="py-3 px-3">
                          <div className="text-[11px] font-mono text-slate-700 font-bold">{item.bankAccount}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{item.bankName || 'تجارت'}</div>
                        </td>

                        {/* Operations */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Print Single Slip */}
                            <button
                              onClick={() => setSingleSlipItem(item)}
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                              title="چاپ فیش حقوقی اختصاصی"
                            >
                              <Receipt size={13} />
                              <span>فیش</span>
                            </button>

                            {/* Full Modal Edit */}
                            <button
                              onClick={() => setEditingItem(item)}
                              className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-all cursor-pointer"
                              title="ویرایش کامل جزئیات"
                            >
                              <Edit3 size={14} />
                            </button>

                            {/* Delete Row */}
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 transition-all cursor-pointer"
                              title="حذف از این دوره"
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

      {/* VIEW 2: PERIODS ARCHIVE */}
      {activeView === 'periods_archive' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Archive size={18} className="text-indigo-600" />
                  <span>آرشیو دوره‌های پرداخت حق‌الزحمه اساتید و مسئولین پایه</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  دوره‌های ثبت‌شده قبلی، گزارشات تجمیعی، مشاهده مجدد و بازگشایی دوره‌ها
                </p>
              </div>

              <button
                onClick={handleCreateNewPeriod}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Plus size={15} />
                <span>تعریف دوره جدید</span>
              </button>
            </div>

            {periods.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-3">
                <Archive size={36} className="mx-auto text-slate-300" />
                <p className="text-xs font-bold text-slate-500">هیچ دوره‌ای در بایگانی ذخیره نشده است.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {periods.map((p) => {
                  const isCurrent = activePeriodId === p.id;
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "p-5 rounded-3xl border transition-all flex flex-col justify-between gap-4",
                        isCurrent 
                          ? "bg-indigo-50/40 border-indigo-300 ring-2 ring-indigo-600/10" 
                          : "bg-white hover:bg-slate-50/60 border-slate-200/80"
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-black text-slate-900 text-sm">{p.title}</h3>
                          <span className={cn(
                            "text-[10px] px-2.5 py-0.5 rounded-full font-black border",
                            p.status === 'paid' 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : p.status === 'finalized'
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                          )}>
                            {p.status === 'paid' ? 'پرداخت شده' : p.status === 'finalized' ? 'نهایی‌شده' : 'پیش‌نویس'}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                          <Calendar size={13} className="text-slate-400" />
                          <span>بازه: {p.startDate} تا {p.endDate}</span>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                          <div className="flex justify-between text-slate-600">
                            <span>تعداد اساتید:</span>
                            <span className="font-bold text-slate-800">{p.totalProfessors} نفر</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>نرخ هر ساعت / نهار:</span>
                            <span className="font-mono text-slate-700">
                              {(p.baseHourlyRate || 200000).toLocaleString('fa-IR')} ت / {(p.lunchCostPerMeal || 45000).toLocaleString('fa-IR')} ت
                            </span>
                          </div>
                          <div className="flex justify-between text-indigo-950 font-bold border-t border-slate-200/60 pt-1.5">
                            <span>خالص پرداختی دوره:</span>
                            <span className="font-mono font-black text-indigo-700 text-sm">
                              {p.totalPayoutAmount.toLocaleString('fa-IR')} تومان
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => handleLoadArchivedPeriod(p)}
                          className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs text-center cursor-pointer"
                        >
                          مشاهده و ویرایش دوره
                        </button>

                        <button
                          onClick={() => handleDeleteArchivedPeriod(p.id)}
                          className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold border border-rose-200 transition-all cursor-pointer"
                          title="حذف دوره از بایگانی"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Settings Modal (Hourly Rate & Lunch Cost Per Meal) */}
      {/* ------------------------------------------------------------- */}
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
                    <h3 className="text-sm font-black text-slate-900">تنظیمات محاسبه حق‌الزحمه دوره</h3>
                    <p className="text-[11px] text-slate-500">نرخ ساعتی و هزینه نهار مصرفی</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نرخ مصوب هر ساعت کارکرد استاد پایه (تومان) *
                  </label>
                  <input
                    type="number"
                    value={baseHourlyRate}
                    onChange={(e) => setBaseHourlyRate(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                    min={1000}
                  />
                  <span className="text-[10px] text-slate-400">
                    مبنای محاسبه ناخالص تدریس و حضور استاد
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    هزینه هر وعده نهار مصرفی استاد (تومان) *
                  </label>
                  <input
                    type="number"
                    value={lunchCostPerMeal}
                    onChange={(e) => setLunchCostPerMeal(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden"
                    min={0}
                  />
                  <span className="text-[10px] text-slate-400">
                    تعداد وعده‌های ثبت شده در سامانه نهار، در این مبلغ ضرب شده و از حق‌الزحمه کسر می‌شود.
                  </span>
                </div>

                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <UtensilsCrossed size={14} className="text-amber-700" />
                    <span>توجه به محاسبات:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    با اعمال این تنظیمات، تمام ردیف‌های اساتید در جدول بر اساس نرخ جدید ساعتی و هزینه نهار مجدداً محاسبه و به‌روزرسانی خواهند شد.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplySettings(baseHourlyRate, lunchCostPerMeal)}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm cursor-pointer"
                  >
                    اعمال و بازتولید محاسبات
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------- */}
      {/* Create New Period Modal */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {isNewPeriodModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900">ایجاد دوره جدید پرداخت حق‌الزحمه اساتید پایه</h3>
                <button
                  onClick={() => setIsNewPeriodModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">عنوان دوره پرداخت *</label>
                  <input
                    type="text"
                    value={newModalTitle}
                    onChange={(e) => setNewModalTitle(e.target.value)}
                    placeholder="مثال: حق‌الزحمه اساتید و مسئولین پایه - آبان ۱۴۰۳"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">تاریخ شروع *</label>
                    <input
                      type="text"
                      value={newModalStart}
                      onChange={(e) => setNewModalStart(e.target.value)}
                      placeholder="۱۴۰۳/۰۸/۰۱"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">تاریخ پایان *</label>
                    <input
                      type="text"
                      value={newModalEnd}
                      onChange={(e) => setNewModalEnd(e.target.value)}
                      placeholder="۱۴۰۳/۰۸/۳۰"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsNewPeriodModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmNewPeriod}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-sm cursor-pointer"
                  >
                    ایجاد و شروع محاسبه
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------- */}
      {/* Edit Single Item Modal */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 space-y-4"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900">
                  ویرایش اطلاعات و کارکرد استاد ({editingItem.name})
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
                  <label className="block font-bold text-slate-700 mb-1">ساعت کارکرد</label>
                  <input
                    type="number"
                    value={editingItem.totalHours}
                    onChange={(e) => setEditingItem({ ...editingItem, totalHours: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">نرخ ساعتی (تومان)</label>
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
                  <label className="block font-bold text-slate-700 mb-1">کسر بدهی/مطالبات (تومان)</label>
                  <input
                    type="number"
                    value={editingItem.debtDeduction || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, debtDeduction: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl font-bold text-amber-900 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">پاداش / اضافه کارکرد (تومان)</label>
                  <input
                    type="number"
                    value={editingItem.bonusAmount}
                    onChange={(e) => setEditingItem({ ...editingItem, bonusAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">سایر کسورات (تومان)</label>
                  <input
                    type="number"
                    value={editingItem.otherDeductions}
                    onChange={(e) => setEditingItem({ ...editingItem, otherDeductions: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-hidden"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">وضعیت پرداخت</label>
                  <select
                    value={editingItem.status || 'approved'}
                    onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-hidden"
                  >
                    <option value="pending">در انتظار</option>
                    <option value="approved">تایید شده</option>
                    <option value="paid">پرداخت شده</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">شماره حساب بانکی</label>
                  <input
                    type="text"
                    value={editingItem.bankAccount}
                    onChange={(e) => setEditingItem({ ...editingItem, bankAccount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold outline-hidden"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">توضیحات</label>
                  <input
                    type="text"
                    value={editingItem.notes || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden"
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
                  ذخیره
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------- */}
      {/* Printable Pay Slip Modal (Single or Batch) */}
      {/* ------------------------------------------------------------- */}
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
                  {singleSlipItem ? `فیش حقوقی استاد/مسئول پایه: ${singleSlipItem.name}` : `چاپ کلیه فیش‌های حقوقی (${filteredItems.length} استاد)`}
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
                {(singleSlipItem ? [singleSlipItem] : filteredItems).map((slip) => (
                  <div key={slip.id} className="border-2 border-slate-800 rounded-2xl p-5 space-y-4 bg-white break-after-page">
                    {/* Slip Header */}
                    <div className="text-center border-b-2 border-slate-800 pb-3 space-y-1">
                      <div className="text-base font-black text-slate-900">حوزه علمیه حضرت مهدی (عج)</div>
                      <div className="text-xs font-bold text-slate-700">فیش پرداخت حق‌الزحمه استاد و مسئول پایه</div>
                      <div className="text-[11px] text-slate-500">{periodTitle} (بازه: {startDate} تا {endDate})</div>
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
                        <span className="text-slate-500 text-[10px]">کد استادی:</span>
                        <div className="font-mono text-slate-700">{slip.teacherCode || '-'}</div>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px]">شماره حساب:</span>
                        <div className="font-mono text-slate-700">{slip.bankAccount}</div>
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
                            <td className="p-2 font-bold text-slate-800">ساعت حضور و نظارت مصوب</td>
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

                          {slip.otherDeductions > 0 && (
                            <tr>
                              <td className="p-2 font-bold text-slate-800">سایر کسورات قانونی / متفرقه</td>
                              <td className="p-2 text-center font-mono">-</td>
                              <td className="p-2 text-center font-mono">-</td>
                              <td className="p-2 text-center text-slate-400">-</td>
                              <td className="p-2 text-center font-mono font-bold text-rose-700">
                                {slip.otherDeductions.toLocaleString('fa-IR')}
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot className="bg-indigo-50/70 border-t-2 border-slate-300 font-bold">
                          <tr>
                            <td colSpan={3} className="p-2.5 text-slate-900 font-black">
                              خالص مبلغ قابل پرداخت به استاد:
                            </td>
                            <td colSpan={2} className="p-2.5 text-center font-black text-indigo-900 text-sm font-mono">
                              {slip.netPayable.toLocaleString('fa-IR')} تومان
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-2 gap-8 pt-6 text-center text-xs font-bold text-slate-700">
                      <div>
                        امضاء و مهر مسئول مالی مدرسه:
                        <div className="h-10 mt-2 border-b border-dashed border-slate-300"></div>
                      </div>
                      <div>
                        امضاء و تایید استاد محترم:
                        <div className="h-10 mt-2 border-b border-dashed border-slate-300"></div>
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
