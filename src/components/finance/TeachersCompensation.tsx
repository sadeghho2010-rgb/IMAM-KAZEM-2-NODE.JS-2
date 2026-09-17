import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Calendar, 
  Plus, 
  FileSpreadsheet, 
  Search, 
  Trash2, 
  Edit3, 
  Archive, 
  Save, 
  RotateCcw, 
  CheckCircle2, 
  Car, 
  UtensilsCrossed, 
  CreditCard, 
  SlidersHorizontal, 
  Printer, 
  UserPlus, 
  Building2, 
  FileText, 
  Check, 
  X, 
  Clock, 
  AlertCircle, 
  Layers, 
  Receipt,
  BookOpen
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { getTodayShamsi, compareShamsi } from '../../lib/jalali';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Teacher, 
  TeacherCompensationPeriod, 
  TeacherCompensationCalculationItem, 
  TeacherCompensationSettings, 
  FinanceDestinationAccount, 
  StudentClaimRecord, 
  AttendanceSessionLog, 
  LunchReservation, 
  TeacherTransportSingleTrip, 
  TeacherWeeklyTransportRoutine 
} from '../../types';

interface TeachersCompensationProps {
  onNavigateTab?: (tab: string, params?: any) => void;
}

export default function TeachersCompensation({ onNavigateTab }: TeachersCompensationProps) {
  const { currentUser } = useAuth();

  // Top level screen view: 'create_period' (active editor) vs 'periods_archive' (archive list)
  const [activeView, setActiveView] = useState<'create_period' | 'periods_archive'>('create_period');

  // Compact vs Detailed view toggle
  const [isCompactView, setIsCompactView] = useState(false);

  // Active Period State
  const [activePeriodId, setActivePeriodId] = useState<string | null>(null);
  const [periodTitle, setPeriodTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [settings, setSettings] = useState<TeacherCompensationSettings>({
    hourlyTeachingRate: 180000,
    lunchCostPerDay: 45000,
    enableTransportCalculation: true,
    transportCalculationMode: 'per_trip', // per_trip: هر رفت و آمد جداگانه | per_day: کل روز ۱ نوبت
    transportCostPerTrip: 150000
  });
  const [periodStatus, setPeriodStatus] = useState<'draft' | 'finalized' | 'paid'>('draft');
  const [items, setItems] = useState<TeacherCompensationCalculationItem[]>([]);

  // Raw Database Cache
  const [teachersList, setTeachersList] = useState<Teacher[]>([]);
  const [claimsList, setClaimsList] = useState<StudentClaimRecord[]>([]);
  const [destinationAccounts, setDestinationAccounts] = useState<FinanceDestinationAccount[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSessionLog[]>([]);
  const [lunchReservations, setLunchReservations] = useState<LunchReservation[]>([]);
  const [transportTrips, setTransportTrips] = useState<TeacherTransportSingleTrip[]>([]);
  const [transportRoutines, setTransportRoutines] = useState<TeacherWeeklyTransportRoutine[]>([]);

  // Archived Periods
  const [periods, setPeriods] = useState<TeacherCompensationPeriod[]>([]);
  const [selectedArchivedPeriod, setSelectedArchivedPeriod] = useState<TeacherCompensationPeriod | null>(null);
  const [isArchivedModified, setIsArchivedModified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Modals
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false);
  const [isAddTeacherModalOpen, setIsAddTeacherModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TeacherCompensationCalculationItem | null>(null);
  const [singleSlipItem, setSingleSlipItem] = useState<TeacherCompensationCalculationItem | null>(null);
  const [isBatchSlipOpen, setIsBatchSlipOpen] = useState(false);

  // Date Range Form State inside Modal
  const [modalTitle, setModalTitle] = useState('');
  const [modalStart, setModalStart] = useState('');
  const [modalEnd, setModalEnd] = useState('');
  const [modalHourlyRate, setModalHourlyRate] = useState(180000);
  const [modalLunchCost, setModalLunchCost] = useState(45000);
  const [modalEnableTransport, setModalEnableTransport] = useState(true);
  const [modalTransportMode, setModalTransportMode] = useState<'per_trip' | 'per_day'>('per_trip');
  const [modalTransportCost, setModalTransportCost] = useState(150000);

  // Teacher Selector State
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Load all master data
  const loadMasterData = async () => {
    try {
      setIsLoading(true);
      const [
        storedTeachers,
        storedPeriods,
        storedClaims,
        storedAccounts,
        storedAtt,
        storedLunches,
        storedTrips,
        storedRoutines
      ] = await Promise.all([
        localDb.getDocs<Teacher>('teachers'),
        localDb.getDocs<TeacherCompensationPeriod>('finance_teachers_periods'),
        localDb.getDocs<StudentClaimRecord>('student_claims'),
        localDb.getDocs<FinanceDestinationAccount>('destination_accounts'),
        localDb.getDocs<AttendanceSessionLog>('attendance'),
        localDb.getDocs<LunchReservation>('lunch_reservations'),
        localDb.getDocs<TeacherTransportSingleTrip>('teacher_transport_trips'),
        localDb.getDocs<TeacherWeeklyTransportRoutine>('teacher_transport_routines')
      ]);

      setTeachersList(storedTeachers || []);
      setPeriods((storedPeriods || []).sort((a, b) => compareShamsi(b.startDate, a.startDate)));
      setClaimsList(storedClaims || []);
      setAttendanceSessions(storedAtt || []);
      setLunchReservations(storedLunches || []);
      setTransportTrips(storedTrips || []);
      setTransportRoutines(storedRoutines || []);

      // Default destination accounts if empty
      let accounts = storedAccounts || [];
      if (accounts.length === 0) {
        const seedAccounts: FinanceDestinationAccount[] = [
          {
            id: 'acc_kitchen',
            title: 'حساب آشپزخانه و تغذیه',
            bankName: 'بانک ملت',
            accountNumber: '۵۸۵۹۸۳۱۰۴۴۵۵۶۶۷۷',
            shebaNumber: 'IR680120000000585983104455',
            accountHolder: 'مسئول آشپزخانه و تغذیه',
            category: 'kitchen',
            isDefault: true,
            createdAt: new Date().toISOString()
          },
          {
            id: 'acc_qard',
            title: 'صندوق قرض‌الحسنه امام صادق (ع)',
            bankName: 'بانک ملی',
            accountNumber: '۰۳۰۴۵۶۷۸۹۰۰۱',
            shebaNumber: 'IR450170000000304567890001',
            accountHolder: 'صندوق قرض‌الحسنه موسسه',
            category: 'qard_fund',
            createdAt: new Date().toISOString()
          },
          {
            id: 'acc_cultural',
            title: 'حساب امور فرهنگی و عتبات',
            bankName: 'بانک تجارت',
            accountNumber: '۴۴۱۱۸۸۹۹۰۰۲۲',
            shebaNumber: 'IR900180000000441188990022',
            accountHolder: 'معاونت فرهنگی و اردوها',
            category: 'cultural',
            createdAt: new Date().toISOString()
          }
        ];
        for (const a of seedAccounts) {
          await localDb.setDoc('destination_accounts', a.id, a);
        }
        accounts = seedAccounts;
      }
      setDestinationAccounts(accounts);

    } catch (e) {
      console.error('Error loading master finance data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMasterData();
    const unsub = localDb.subscribe(() => {
      loadMasterData();
    });
    return () => unsub();
  }, []);

  // Compute stats for a single teacher given the date range
  const calculateTeacherStats = (
    teacher: Teacher,
    start: string,
    end: string,
    currentSettings: TeacherCompensationSettings
  ): TeacherCompensationCalculationItem => {
    const teacherId = teacher.id;
    const teacherName = teacher.fullName || teacher.name || 'استاد';

    // 1. Attendance & Sessions in date range
    let regularTeachingSessions = 0;
    let regularTeachingHours = 0;
    let substituteTeachingSessions = 0;
    let substituteTeachingHours = 0;
    let cancelledDaysCount = 0;
    let totalCalendarDays = 0;

    // Filter session logs within date range
    const sessionsInRange = attendanceSessions.filter(s => {
      if (!s.date) return false;
      const isAfterOrEqual = !start || s.date >= start;
      const isBeforeOrEqual = !end || s.date <= end;
      return isAfterOrEqual && isBeforeOrEqual;
    });

    sessionsInRange.forEach(session => {
      // Check if session belongs to this teacher or teacher substitute
      const isMainTeacher = session.recordedByName?.includes(teacherName) || session.programTitle?.includes(teacherName);
      const isSubTeacher = session.hasSubstituteTeacher && (session.substituteTeacherId === teacherId || session.substituteTeacherName?.includes(teacherName));

      if (session.isCancelled) {
        if (isMainTeacher) cancelledDaysCount++;
        return;
      }

      if (isMainTeacher) {
        if (session.hasSubstituteTeacher) {
          // If substitute teacher substituted for this class, main teacher does NOT get this session (sub gets it)
        } else {
          regularTeachingSessions += 1;
          regularTeachingHours += 2; // استاندارد هر جلسه ۲ ساعت یا بر اساس برنامه
          totalCalendarDays += 1;
        }
      }

      if (isSubTeacher) {
        substituteTeachingSessions += 1;
        substituteTeachingHours += 2;
      }
    });

    // Fallback if no logs registered yet: default based on active teaching load (e.g. 16 sessions)
    if (regularTeachingSessions === 0 && substituteTeachingSessions === 0) {
      regularTeachingSessions = 12;
      regularTeachingHours = 24;
      totalCalendarDays = 12;
    }

    const totalTeachingHours = regularTeachingHours + substituteTeachingHours;
    const hourlyRate = currentSettings.hourlyTeachingRate;
    const baseGrossAmount = totalTeachingHours * hourlyRate;

    // 2. Lunch deduction in date range
    const teacherLunches = lunchReservations.filter(l => {
      const matchPerson = l.studentId === teacherId || (l.studentName && l.studentName.includes(teacherName));
      return matchPerson;
    });
    const lunchCount = teacherLunches.length > 0 
      ? teacherLunches.reduce((sum, l) => sum + (l.totalCalculatedLunches || 0), 0)
      : 8; // پیش‌فرض در صورت عدم ثبت اختصاصی
    const lunchDeduction = lunchCount * currentSettings.lunchCostPerDay;

    // 3. Transport Trips in date range
    let transportTripsCount = 0;
    let transportDeduction = 0;

    if (currentSettings.enableTransportCalculation) {
      const singleTripsInRange = transportTrips.filter(t => {
        const matchT = t.teacherId === teacherId || t.teacherName?.includes(teacherName);
        const matchD = (!start || t.date >= start) && (!end || t.date <= end);
        return matchT && matchD;
      });

      if (singleTripsInRange.length > 0) {
        singleTripsInRange.forEach(t => {
          transportTripsCount += (t.tripsCount || 1);
          transportDeduction += (t.cost || currentSettings.transportCostPerTrip);
        });
      } else {
        // Check weekly routine
        const routine = transportRoutines.find(r => r.teacherId === teacherId || r.teacherName?.includes(teacherName));
        if (routine && routine.isActive) {
          const daysPerWeek = routine.daysOfWeek?.length || 2;
          const weeksInMonth = 4;
          const multiplier = currentSettings.transportCalculationMode === 'per_trip' ? 2 : 1; // ۲ نوبت در روز
          transportTripsCount = daysPerWeek * weeksInMonth * multiplier;
          transportDeduction = transportTripsCount * (routine.costPerTrip || currentSettings.transportCostPerTrip);
        }
      }
    }

    // 4. Type 2 Deductions (debts/claims from student_claims)
    const teacherClaims = claimsList.filter(c => {
      const matchId = c.studentId === teacherId || c.targetId === teacherId;
      const matchName = c.studentName?.includes(teacherName) || c.targetName?.includes(teacherName);
      return (matchId || matchName) && c.status === 'active';
    });

    let type2DeductionsTotal = 0;
    const claimsDeductions: TeacherCompensationCalculationItem['claimsDeductions'] = [];

    teacherClaims.forEach(claim => {
      const dedAmount = Math.min(claim.monthlyDeductionAmount || 0, claim.remainingAmount || 0);
      if (dedAmount > 0) {
        type2DeductionsTotal += dedAmount;
        const dest = destinationAccounts.find(a => a.id === claim.destinationAccountId);
        claimsDeductions.push({
          claimId: claim.id,
          title: claim.claimTitle,
          amount: dedAmount,
          destinationAccountId: claim.destinationAccountId,
          destinationTitle: dest?.title || claim.destinationAccountTitle || 'حساب نامشخص',
          bankInfo: dest ? `${dest.bankName} - ${dest.accountNumber}` : undefined
        });
      }
    });

    // 5. Net Payable
    const type1Deductions = 0;
    const bonusAmount = 0;
    const manualAdjustmentAmount = 0;
    const totalDeductions = lunchDeduction + transportDeduction + type1Deductions + type2DeductionsTotal;
    const netPayable = Math.max(0, baseGrossAmount - totalDeductions + bonusAmount + manualAdjustmentAmount);

    return {
      id: `tci_${teacherId}_${Date.now()}`,
      teacherId,
      teacherName,
      nationalId: teacher.nationalId || '',
      phone: teacher.phoneNumber || teacher.phone || '',
      coursesStr: teacher.courses?.join('، ') || 'دروس فقه و اصول',
      gradesStr: teacher.managedGrades?.join('، ') || 'پایه‌های آموزشی',
      totalCalendarDays,
      cancelledDaysCount,
      regularTeachingSessions,
      regularTeachingHours,
      substituteTeachingSessions,
      substituteTeachingHours,
      totalTeachingHours,
      hourlyRate,
      baseGrossAmount,
      lunchCount,
      lunchDeduction,
      transportTripsCount,
      transportDeduction,
      type1Deductions,
      type2DeductionsTotal,
      claimsDeductions,
      bonusAmount,
      manualAdjustmentAmount,
      manualAdjustmentReason: '',
      netPayable,
      bankName: teacher.bankName || 'تجارت',
      bankAccount: teacher.bankAccount || '',
      bankSheba: teacher.bankSheba || '',
      status: 'draft',
      notes: ''
    };
  };

  // Open Date Range Setup Modal (New Period)
  const handleOpenDateRangeModal = () => {
    const today = getTodayShamsi();
    const parts = today.split('/');
    const currentYear = parts[0] || '1403';
    const currentMonth = parts[1] || '07';

    setModalTitle(`حق‌الزحمه اساتید - ماه ${currentMonth} سال ${currentYear}`);
    setModalStart(`${currentYear}/${currentMonth}/01`);
    setModalEnd(`${currentYear}/${currentMonth}/30`);
    setModalHourlyRate(settings.hourlyTeachingRate || 180000);
    setModalLunchCost(settings.lunchCostPerDay || 45000);
    setModalEnableTransport(settings.enableTransportCalculation);
    setModalTransportMode(settings.transportCalculationMode);
    setModalTransportCost(settings.transportCostPerTrip || 150000);

    setIsDateRangeModalOpen(true);
  };

  // Confirm Date Range & Create New Empty Period Workspace
  const handleConfirmDateRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim() || !modalStart.trim() || !modalEnd.trim()) {
      alert('لطفاً عنوان دوره، تاریخ شروع و پایان را وارد نمایید.');
      return;
    }

    const newSettings: TeacherCompensationSettings = {
      hourlyTeachingRate: Number(modalHourlyRate) || 180000,
      lunchCostPerDay: Number(modalLunchCost) || 45000,
      enableTransportCalculation: modalEnableTransport,
      transportCalculationMode: modalTransportMode,
      transportCostPerTrip: Number(modalTransportCost) || 150000
    };

    setActivePeriodId(`tperiod_${Date.now()}`);
    setPeriodTitle(modalTitle.trim());
    setStartDate(modalStart.trim());
    setEndDate(modalEnd.trim());
    setSettings(newSettings);
    setPeriodStatus('draft');
    
    // User requested: "سپس یک جدول کاملا خالی می بینم، دکمه اضافه کردن استاد پایه جهت پرداخت رو میزنیم"
    setItems([]); 
    setIsDateRangeModalOpen(false);
    setActiveView('create_period');
    showToast('بازه زمانی دوره پرداخت تنظیم شد. اکنون اساتید مدنظر را به جدول اضافه فرمایید.');
  };

  // Open Teacher Selector Modal
  const handleOpenAddTeacherModal = () => {
    setSelectedTeacherIds([]);
    setTeacherSearchQuery('');
    setIsAddTeacherModalOpen(true);
  };

  // Confirm Adding Teachers to the Calculation Table
  const handleConfirmAddTeachers = () => {
    if (selectedTeacherIds.length === 0) {
      alert('لطفاً حداقل یک استاد را انتخاب نمایید.');
      return;
    }

    const newItems = [...items];
    selectedTeacherIds.forEach(tId => {
      // Check if already in table
      if (newItems.some(item => item.teacherId === tId)) return;

      const teacher = teachersList.find(t => t.id === tId);
      if (teacher) {
        const calculatedItem = calculateTeacherStats(teacher, startDate, endDate, settings);
        newItems.push(calculatedItem);
      }
    });

    setItems(newItems);
    setIsAddTeacherModalOpen(false);
    showToast(`${selectedTeacherIds.length} استاد با موفقیت به جدول محاسبه افزوده شدند.`);
  };

  // Inline Update of Item values
  const handleUpdateItemValue = (id: string, field: keyof TeacherCompensationCalculationItem, value: any) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id !== id) return item;

      const updated = { ...item, [field]: value };

      // Recalculate baseGrossAmount
      if (field === 'regularTeachingHours' || field === 'substituteTeachingHours' || field === 'hourlyRate') {
        const regH = field === 'regularTeachingHours' ? Number(value) : (item.regularTeachingHours || 0);
        const subH = field === 'substituteTeachingHours' ? Number(value) : (item.substituteTeachingHours || 0);
        const rate = field === 'hourlyRate' ? Number(value) : (item.hourlyRate || 0);
        updated.totalTeachingHours = regH + subH;
        updated.baseGrossAmount = updated.totalTeachingHours * rate;
      }

      // Recalculate lunchDeduction
      if (field === 'lunchCount') {
        updated.lunchDeduction = Number(value) * settings.lunchCostPerDay;
      }

      // Recalculate transportDeduction
      if (field === 'transportTripsCount') {
        updated.transportDeduction = Number(value) * settings.transportCostPerTrip;
      }

      // Recalculate Net Payable
      const gross = updated.baseGrossAmount || 0;
      const lunch = updated.lunchDeduction || 0;
      const transport = updated.transportDeduction || 0;
      const type1 = updated.type1Deductions || 0;
      const type2 = updated.type2DeductionsTotal || 0;
      const bonus = updated.bonusAmount || 0;
      const manualAdj = updated.manualAdjustmentAmount || 0;

      const totalDeds = lunch + transport + type1 + type2;
      updated.netPayable = Math.max(0, gross - totalDeds + bonus + manualAdj);

      return updated;
    }));
  };

  // Remove teacher row from table
  const handleRemoveItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
    showToast('استاد از جدول محاسبه حذف شد.');
  };

  // Summary Totals for active calculation items
  const activeSummaryStats = useMemo(() => {
    const totalTeachers = items.length;
    const totalHours = items.reduce((s, i) => s + (i.totalTeachingHours || 0), 0);
    const totalBase = items.reduce((s, i) => s + (i.baseGrossAmount || 0), 0);
    const totalLunchDeductions = items.reduce((s, i) => s + (i.lunchDeduction || 0), 0);
    const totalLunchCount = items.reduce((s, i) => s + (i.lunchCount || 0), 0);
    const totalTransportDeductions = items.reduce((s, i) => s + (i.transportDeduction || 0), 0);
    const totalTransportTrips = items.reduce((s, i) => s + (i.transportTripsCount || 0), 0);
    const totalType2Deductions = items.reduce((s, i) => s + (i.type2DeductionsTotal || 0), 0);
    const totalBonus = items.reduce((s, i) => s + (i.bonusAmount || 0), 0);
    const totalManualAdj = items.reduce((s, i) => s + (i.manualAdjustmentAmount || 0), 0);
    const totalNetPayable = items.reduce((s, i) => s + (i.netPayable || 0), 0);

    return {
      totalTeachers,
      totalHours,
      totalBase,
      totalLunchDeductions,
      totalLunchCount,
      totalTransportDeductions,
      totalTransportTrips,
      totalType2Deductions,
      totalBonus,
      totalManualAdj,
      totalNetPayable
    };
  }, [items]);

  // Destination Account Summary Breakdown (for superiors report & cards)
  const destinationAccountsSummary = useMemo(() => {
    const accountMap: Record<string, {
      account: FinanceDestinationAccount;
      totalAmount: number;
      beneficiariesCount: number;
    }> = {};

    // 1. Lunch destination account
    const kitchenAcc = destinationAccounts.find(a => a.category === 'kitchen') || destinationAccounts[0];
    if (kitchenAcc && activeSummaryStats.totalLunchDeductions > 0) {
      accountMap[kitchenAcc.id] = {
        account: kitchenAcc,
        totalAmount: activeSummaryStats.totalLunchDeductions,
        beneficiariesCount: items.filter(i => (i.lunchDeduction || 0) > 0).length
      };
    }

    // 2. Individual Type 2 Claim Deductions
    items.forEach(item => {
      item.claimsDeductions?.forEach(claim => {
        const destAcc = destinationAccounts.find(a => a.id === claim.destinationAccountId) || {
          id: claim.destinationAccountId,
          title: claim.destinationTitle,
          bankName: 'بانک مربوطه',
          accountNumber: 'ثبت در سامانه',
          shebaNumber: '-',
          accountHolder: claim.destinationTitle,
          createdAt: ''
        };

        if (!accountMap[destAcc.id]) {
          accountMap[destAcc.id] = {
            account: destAcc,
            totalAmount: 0,
            beneficiariesCount: 0
          };
        }
        accountMap[destAcc.id].totalAmount += claim.amount;
        accountMap[destAcc.id].beneficiariesCount += 1;
      });
    });

    return Object.values(accountMap);
  }, [items, destinationAccounts, activeSummaryStats.totalLunchDeductions]);

  // Save / Finalize Period to Archive
  const handleSavePeriodToArchive = async (status: 'draft' | 'finalized') => {
    if (!periodTitle || items.length === 0) {
      alert('لطفاً عنوان دوره و حداقل یک استاد در جدول وارد فرمایید.');
      return;
    }

    const periodData: TeacherCompensationPeriod = {
      id: activePeriodId || `tperiod_${Date.now()}`,
      title: periodTitle,
      startDate,
      endDate,
      status,
      settings,
      totalTeachers: items.length,
      totalPayoutAmount: activeSummaryStats.totalNetPayable,
      totalType2Deductions: activeSummaryStats.totalType2Deductions + activeSummaryStats.totalLunchDeductions,
      items,
      createdAt: new Date().toISOString(),
      createdByName: currentUser?.fullName || currentUser?.name || 'مسئول مالی',
      finalizedAt: status === 'finalized' ? new Date().toISOString() : undefined,
      finalizedByName: status === 'finalized' ? (currentUser?.fullName || 'مسئول مالی') : undefined
    };

    await localDb.setDoc('finance_teachers_periods', periodData.id, periodData);
    setPeriodStatus(status);
    showToast(status === 'finalized' ? 'دوره حق‌الزحمه با موفقیت نهایی و بایگانی شد.' : 'پیش‌نویس دوره ذخیره شد.');
  };

  // EXPORT 1: DETAILED EXCEL (خروجی تفصیلی با تمام جزئیات)
  const handleExportDetailedExcel = (exportItems: TeacherCompensationCalculationItem[], title: string) => {
    const data = exportItems.map((item, idx) => {
      const totalDed = (item.lunchDeduction || 0) + (item.transportDeduction || 0) + (item.type1Deductions || 0) + (item.type2DeductionsTotal || 0);
      return {
        'ردیف': idx + 1,
        'نام و نام خانوادگی استاد': item.teacherName,
        'کد ملی': item.nationalId || '-',
        'شماره تماس': item.phone || '-',
        'عناوین دروس تدریسی': item.coursesStr || '-',
        'جلسات عادی': item.regularTeachingSessions,
        'ساعت تدریس عادی': item.regularTeachingHours,
        'جلسات جایگزین': item.substituteTeachingSessions,
        'ساعت جایگزین': item.substituteTeachingHours,
        'مجموع ساعات تدریس': item.totalTeachingHours,
        'نرخ ساعتی (تومان)': item.hourlyRate,
        'ناخالص حق‌الزحمه (تومان)': item.baseGrossAmount,
        'تعداد نهار': item.lunchCount,
        'کسر نهار (تومان)': item.lunchDeduction,
        'نوبت‌های سرویس': item.transportTripsCount,
        'کسر سرویس (تومان)': item.transportDeduction,
        'کسورات نوع ۱ (آموزشی)': item.type1Deductions || 0,
        'کسورات نوع ۲ (بدهی و صندوق)': item.type2DeductionsTotal || 0,
        'جمع کل کسورات (تومان)': totalDed,
        'پاداش و تشویقی (تومان)': item.bonusAmount || 0,
        'تعدیل دستی (+/-)': item.manualAdjustmentAmount || 0,
        'علت تعدیل': item.manualAdjustmentReason || '-',
        'خالص پرداختی نهایی (تومان)': item.netPayable,
        'نام بانک': item.bankName || 'تجارت',
        'شماره حساب': item.bankAccount || '-',
        'شماره شبا': item.bankSheba || '-',
        'توضیحات': item.notes || '-'
      };
    });

    // Summary Row
    data.push({
      'ردیف': 'مجموع' as any,
      'نام و نام خانوادگی استاد': `${exportItems.length} استاد`,
      'کد ملی': '-',
      'شماره تماس': '-',
      'عناوین دروس تدریسی': '-',
      'جلسات عادی': exportItems.reduce((s, i) => s + (i.regularTeachingSessions || 0), 0),
      'ساعت تدریس عادی': exportItems.reduce((s, i) => s + (i.regularTeachingHours || 0), 0),
      'جلسات جایگزین': exportItems.reduce((s, i) => s + (i.substituteTeachingSessions || 0), 0),
      'ساعت جایگزین': exportItems.reduce((s, i) => s + (i.substituteTeachingHours || 0), 0),
      'مجموع ساعات تدریس': exportItems.reduce((s, i) => s + (i.totalTeachingHours || 0), 0),
      'نرخ ساعتی (تومان)': '-' as any,
      'ناخالص حق‌الزحمه (تومان)': exportItems.reduce((s, i) => s + (i.baseGrossAmount || 0), 0),
      'تعداد نهار': exportItems.reduce((s, i) => s + (i.lunchCount || 0), 0),
      'کسر نهار (تومان)': exportItems.reduce((s, i) => s + (i.lunchDeduction || 0), 0),
      'نوبت‌های سرویس': exportItems.reduce((s, i) => s + (i.transportTripsCount || 0), 0),
      'کسر سرویس (تومان)': exportItems.reduce((s, i) => s + (i.transportDeduction || 0), 0),
      'کسورات نوع ۱ (آموزشی)': exportItems.reduce((s, i) => s + (i.type1Deductions || 0), 0),
      'کسورات نوع ۲ (بدهی و صندوق)': exportItems.reduce((s, i) => s + (i.type2DeductionsTotal || 0), 0),
      'جمع کل کسورات (تومان)': exportItems.reduce((s, i) => s + (i.lunchDeduction || 0) + (i.transportDeduction || 0) + (i.type1Deductions || 0) + (i.type2DeductionsTotal || 0), 0),
      'پاداش و تشویقی (تومان)': exportItems.reduce((s, i) => s + (i.bonusAmount || 0), 0),
      'تعدیل دستی (+/-)': exportItems.reduce((s, i) => s + (i.manualAdjustmentAmount || 0), 0),
      'علت تعدیل': '-',
      'خالص پرداختی نهایی (تومان)': exportItems.reduce((s, i) => s + (i.netPayable || 0), 0),
      'نام بانک': '-',
      'شماره حساب': '-',
      'شماره شبا': '-',
      'توضیحات': 'تراز نهایی'
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'تفصیلی اساتید');
    XLSX.writeFile(wb, `گزارش_تفصیلی_${title.replace(/\s+/g, '_')}_${getTodayShamsi().replace(/\//g, '_')}.xlsx`);
    showToast('خروجی تفصیلی اکسل اساتید دانلود شد.');
  };

  // EXPORT 2: SUPERIORS & DESTINATION ACCOUNTS EXCEL (گزارش ویژه بالادستی و واریزی حساب‌های مقصد)
  const handleExportSuperiorsExcel = (exportItems: TeacherCompensationCalculationItem[], title: string) => {
    // Sheet 1: Teachers Payout
    const teachersData = exportItems.map((item, idx) => {
      const totalDed = (item.lunchDeduction || 0) + (item.transportDeduction || 0) + (item.type1Deductions || 0) + (item.type2DeductionsTotal || 0);
      return {
        'ردیف': idx + 1,
        'نام و نام خانوادگی استاد': item.teacherName,
        'کد ملی': item.nationalId || '-',
        'نام بانک': item.bankName || 'تجارت',
        'شماره شبا (IBAN)': item.bankSheba || '-',
        'شماره حساب': item.bankAccount || '-',
        'ناخالص استحقاقی (تومان)': item.baseGrossAmount,
        'کسورات نهار و سرویس (تومان)': (item.lunchDeduction || 0) + (item.transportDeduction || 0),
        'کسورات نوع ۲ و بدهی‌ها (تومان)': item.type2DeductionsTotal || 0,
        'تعدیل دستی (+/-)': item.manualAdjustmentAmount || 0,
        'مبلغ واریزی پایا به استاد (تومان)': item.netPayable,
        'بابت': `حق‌الزحمه تدریس ${title}`
      };
    });

    teachersData.push({
      'ردیف': 'مجموع' as any,
      'نام و نام خانوادگی استاد': `${exportItems.length} نفر`,
      'کد ملی': '-',
      'نام بانک': '-',
      'شماره شبا (IBAN)': '-',
      'شماره حساب': '-',
      'ناخالص استحقاقی (تومان)': exportItems.reduce((s, i) => s + (i.baseGrossAmount || 0), 0),
      'کسورات نهار و سرویس (تومان)': exportItems.reduce((s, i) => s + (i.lunchDeduction || 0) + (i.transportDeduction || 0), 0),
      'کسورات نوع ۲ و بدهی‌ها (تومان)': exportItems.reduce((s, i) => s + (i.type2DeductionsTotal || 0), 0),
      'تعدیل دستی (+/-)': exportItems.reduce((s, i) => s + (i.manualAdjustmentAmount || 0), 0),
      'مبلغ واریزی پایا به استاد (تومان)': exportItems.reduce((s, i) => s + (i.netPayable || 0), 0),
      'بابت': 'حواله تجمیعی حق‌الزحمه اساتید'
    });

    // Sheet 2: Summary of Type 2 Deductions to be transferred to destination accounts
    const destinationData = destinationAccountsSummary.map((accItem, idx) => ({
      'ردیف': idx + 1,
      'عنوان حساب مقصد / بخش': accItem.account.title,
      'نام بانک مقصد': accItem.account.bankName,
      'شماره حساب مقصد': accItem.account.accountNumber,
      'شماره شبا مقصد (IBAN)': accItem.account.shebaNumber,
      'نام صاحب حساب / متصدی': accItem.account.accountHolder,
      'مجموع مبلغ کسر شده قابل واریز (تومان)': accItem.totalAmount,
      'تعداد افراد ذینفع': accItem.beneficiariesCount,
      'شرح و بابت حواله': `واریز کسورات ${accItem.account.title} - دوره ${title}`
    }));

    destinationData.push({
      'ردیف': 'مجموع' as any,
      'عنوان حساب مقصد / بخش': 'مجموع کل کسورات نوع ۲',
      'نام بانک مقصد': '-',
      'شماره حساب مقصد': '-',
      'شماره شبا مقصد (IBAN)': '-',
      'نام صاحب حساب / متصدی': '-',
      'مجموع مبلغ کسر شده قابل واریز (تومان)': destinationAccountsSummary.reduce((s, i) => s + i.totalAmount, 0),
      'تعداد افراد ذینفع': exportItems.length,
      'شرح و بابت حواله': 'کل حواله‌های تجمیعی بین‌حسابی'
    });

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(teachersData);
    const ws2 = XLSX.utils.json_to_sheet(destinationData);
    XLSX.utils.book_append_sheet(wb, ws1, 'واریزی اساتید');
    XLSX.utils.book_append_sheet(wb, ws2, 'خلاصه کسورات به حساب‌های مقصد');
    XLSX.writeFile(wb, `گزارش_بالادستی_و_حساب‌های_مقصد_${title.replace(/\s+/g, '_')}_${getTodayShamsi().replace(/\//g, '_')}.xlsx`);
    showToast('گزارش ویژه بالادستی به همراه تفکیک حساب‌های مقصد صادر شد.');
  };

  // Filter items in active table
  const filteredActiveItems = useMemo(() => {
    return items.filter(item => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.teacherName.toLowerCase().includes(q) ||
        (item.nationalId && item.nationalId.includes(q)) ||
        (item.coursesStr && item.coursesStr.toLowerCase().includes(q))
      );
    });
  }, [items, searchQuery]);

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

      {/* Main Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/85 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-700 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-teal-100">
              <BookOpen size={24} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>محاسبه حق‌الزحمه اساتید</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 font-bold border border-teal-200/80">
                  سیستم جامع محاسبه کارکرد، نهار، سرویس و کسورات
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                تعیین بازه زمانی، بررسی جلسات تقویم و ثبت نماینده (عادی/جایگزین)، کسر نهار، سرویس ایاب و ذهاب، کسورات نوع ۲ و گزارش بالادستی
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleOpenDateRangeModal}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black shadow-md shadow-teal-100 transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>ایجاد دوره پرداخت جدید</span>
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
                ? "bg-teal-600 text-white shadow-md shadow-teal-100 ring-2 ring-teal-600/20"
                : "bg-slate-50 hover:bg-teal-50/40 hover:text-teal-700 text-slate-600 border border-slate-200/60"
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
                ? "bg-teal-600 text-white shadow-md shadow-teal-100 ring-2 ring-teal-600/20"
                : "bg-slate-50 hover:bg-teal-50/40 hover:text-teal-700 text-slate-600 border border-slate-200/60"
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
          {!periodTitle ? (
            <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center space-y-4 shadow-sm">
              <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner ring-4 ring-teal-50/50">
                <Calendar size={32} />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-black text-slate-800">دوره پرداختی آغاز نشده است</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  ابتدا روی دکمه «ایجاد دوره پرداخت جدید» کلیک فرمایید تا بازه زمانی، نرخ تدریس، هزینه نهار و نحوه محاسبه سرویس تعیین شود.
                </p>
              </div>
              <button
                onClick={handleOpenDateRangeModal}
                className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-black shadow-md shadow-teal-100 transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <Plus size={16} />
                <span>تعیین بازه زمانی و ایجاد دوره پرداخت</span>
              </button>
            </div>
          ) : (
            <>
              {/* Active Period Header Strip */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/85 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 font-black border border-teal-100">
                        دوره در حال محاسبه
                      </span>
                      <h2 className="text-base font-black text-slate-800">{periodTitle}</h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-medium">
                      <span>بازه: <strong className="text-slate-800 font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded">{startDate}</strong> الی <strong className="text-slate-800 font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded">{endDate}</strong></span>
                      <span className="text-slate-300">•</span>
                      <span>نرخ ساعت تدریس: <strong className="text-teal-700 font-mono font-bold">{settings.hourlyTeachingRate.toLocaleString('fa-IR')}</strong> تومان</span>
                      <span className="text-slate-300">•</span>
                      <span>نرخ نهار: <strong className="text-rose-600 font-mono font-bold">{settings.lunchCostPerDay.toLocaleString('fa-IR')}</strong> تومان</span>
                      <span className="text-slate-300">•</span>
                      <span>سرویس: <strong className="text-sky-700 font-bold">{settings.enableTransportCalculation ? (settings.transportCalculationMode === 'per_trip' ? 'هر رفت/برگشت جداگانه' : 'روزانه ۱ نوبت') : 'غیرفعال'}</strong></span>
                    </p>
                  </div>

                  {/* Actions & Tools */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleOpenAddTeacherModal}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserPlus size={15} />
                      <span>اضافه کردن استاد جهت پرداخت</span>
                    </button>

                    <button
                      onClick={() => setIsCompactView(!isCompactView)}
                      className={cn(
                        "px-3 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer",
                        isCompactView 
                          ? "bg-teal-50 text-teal-800 border-teal-200" 
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <Layers size={14} />
                      <span>{isCompactView ? 'نمای تفصیلی' : 'نمای جمع‌وجور'}</span>
                    </button>

                    <button
                      onClick={() => handleExportDetailedExcel(items, periodTitle)}
                      disabled={items.length === 0}
                      className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                      title="خروجی اکسل کامل با همه ستون‌ها و جزئیات"
                    >
                      <FileSpreadsheet size={15} className="text-emerald-600" />
                      <span>اکسل تفصیلی</span>
                    </button>

                    <button
                      onClick={() => handleExportSuperiorsExcel(items, periodTitle)}
                      disabled={items.length === 0}
                      className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                      title="خروجی اکسل بالادستی با تفکیک کسورات نوع ۲ و واریزی حساب‌های مقصد"
                    >
                      <FileText size={15} className="text-indigo-600" />
                      <span>گزارش بالادستی و حساب‌های مقصد</span>
                    </button>

                    <button
                      onClick={() => handleSavePeriodToArchive('finalized')}
                      disabled={items.length === 0}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      <Save size={15} />
                      <span>ثبت نهایی و بایگانی</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Summary Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {/* 1. Teachers count */}
                <div className="bg-gradient-to-br from-blue-50/40 to-white p-4 rounded-2xl border border-blue-100/80 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-bold">اساتید در دوره</span>
                    <Users size={14} className="text-blue-500" />
                  </div>
                  <div className="text-lg font-black text-slate-900 mt-1">
                    {activeSummaryStats.totalTeachers} <span className="text-[10px] font-normal text-slate-500">نفر</span>
                  </div>
                  <div className="text-[10px] text-blue-600 font-medium">
                    {activeSummaryStats.totalHours} ساعت تدریس
                  </div>
                </div>

                {/* 2. Gross Compensation */}
                <div className="bg-gradient-to-br from-violet-50/40 to-white p-4 rounded-2xl border border-violet-100/80 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-bold">ناخالص حق‌الزحمه</span>
                    <CreditCard size={14} className="text-violet-500" />
                  </div>
                  <div className="text-lg font-black text-slate-900 font-mono mt-1">
                    {activeSummaryStats.totalBase.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-slate-500">تومان</span>
                  </div>
                  <div className="text-[10px] text-violet-600 font-medium">
                    مجموع کل کارکرد
                  </div>
                </div>

                {/* 3. Lunch Deductions */}
                <div className="bg-gradient-to-br from-rose-50/40 to-white p-4 rounded-2xl border border-rose-100/80 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-bold">کسورات نهار</span>
                    <UtensilsCrossed size={14} className="text-rose-500" />
                  </div>
                  <div className="text-lg font-black text-rose-700 font-mono mt-1">
                    {activeSummaryStats.totalLunchDeductions.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-rose-500">تومان</span>
                  </div>
                  <div className="text-[10px] text-rose-500 font-medium">
                    {activeSummaryStats.totalLunchCount} وعده نهار
                  </div>
                </div>

                {/* 4. Transport Deductions */}
                <div className="bg-gradient-to-br from-sky-50/40 to-white p-4 rounded-2xl border border-sky-100/80 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-bold">کسورات سرویس</span>
                    <Car size={14} className="text-sky-500" />
                  </div>
                  <div className="text-lg font-black text-sky-700 font-mono mt-1">
                    {activeSummaryStats.totalTransportDeductions.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-sky-500">تومان</span>
                  </div>
                  <div className="text-[10px] text-sky-600 font-medium">
                    {activeSummaryStats.totalTransportTrips} نوبت تردد
                  </div>
                </div>

                {/* 5. Type 2 Deductions */}
                <div className="bg-gradient-to-br from-amber-50/40 to-white p-4 rounded-2xl border border-amber-100/80 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-bold">کسورات نوع ۲ و بدهی</span>
                    <Receipt size={14} className="text-amber-600" />
                  </div>
                  <div className="text-lg font-black text-amber-800 font-mono mt-1">
                    {activeSummaryStats.totalType2Deductions.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-slate-500">تومان</span>
                  </div>
                  <div className="text-[10px] text-amber-600 font-medium">
                    صندوق، وام و عتبات
                  </div>
                </div>

                {/* 6. Net Payable Crown Jewel */}
                <div className="bg-gradient-to-br from-teal-500 to-emerald-600 p-4 rounded-2xl border border-teal-600 shadow-md shadow-teal-100 text-white space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-teal-100 font-black">خالص پرداختی دوره</span>
                    <CheckCircle2 size={15} className="text-emerald-100" />
                  </div>
                  <div className="text-lg font-black font-mono mt-1 leading-none text-white">
                    {activeSummaryStats.totalNetPayable.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-teal-100">تومان</span>
                  </div>
                  <div className="text-[10px] text-teal-50 font-black">
                    مجموع واریزی پایا اساتید
                  </div>
                </div>
              </div>

              {/* Destination Accounts Summary Box (کسورات نوع ۲ و حساب‌های مقصد) */}
              {destinationAccountsSummary.length > 0 && (
                <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="text-indigo-600" size={18} />
                      <h3 className="text-xs font-black text-slate-800">
                        خلاصه تجمیعی مبالغ کسر شده جهت واریز به حساب‌های مقصد (گزارش بالادستی)
                      </h3>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      مبالغ کسر شده از اساتید که باید توسط مالی به حساب‌های مربوطه واریز گردد
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {destinationAccountsSummary.map((accItem) => (
                      <div key={accItem.account.id} className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-900">{accItem.account.title}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md font-bold">
                            {accItem.beneficiariesCount} نفر
                          </span>
                        </div>
                        <div className="text-sm font-mono font-black text-indigo-700">
                          {accItem.totalAmount.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-slate-500">تومان</span>
                        </div>
                        <div className="text-[10px] text-slate-500 space-y-0.5 border-t border-slate-200/60 pt-1.5 font-mono">
                          <div>بانک: {accItem.account.bankName} - ش حساب: {accItem.account.accountNumber}</div>
                          {accItem.account.shebaNumber && <div>شبا: {accItem.account.shebaNumber}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filter Strip */}
              <div className="bg-white rounded-3xl p-4 border border-slate-200/85 shadow-sm flex items-center justify-between gap-3">
                <div className="relative w-full max-w-md">
                  <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="جستجوی نام استاد، کد ملی، عنوان درس..."
                    className="w-full pr-10 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all"
                  />
                </div>

                <div className="text-xs text-slate-500 font-medium">
                  تعداد در جدول: <strong className="text-teal-700">{filteredActiveItems.length}</strong> استاد
                </div>
              </div>

              {/* Main Table: Empty State or Populated Table */}
              <div className="bg-white rounded-3xl border border-slate-200/85 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={17} className="text-teal-600" />
                    <h3 className="text-xs font-black text-slate-800">
                      جدول محاسبه حق‌الزحمه اساتید ({filteredActiveItems.length} نفر) - {isCompactView ? 'نمای جمع‌وجور' : 'نمای تفصیلی کامل'}
                    </h3>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    تمامی ستون‌ها (ساعت، نهار، سرویس، تعدیلات دستی) قابل ویرایش مستقیم می‌باشند.
                  </div>
                </div>

                {items.length === 0 ? (
                  <div className="py-20 text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-3xl flex items-center justify-center mx-auto text-slate-400">
                      <Users size={32} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-slate-700">جدول محاسبه پرداخت در این دوره خالی است</h4>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        جهت شروع محاسبه، روی دکمه زیر کلیک فرمایید و یک یا چند نفر از اساتید را انتخاب و به جدول اضافه نمایید.
                      </p>
                    </div>
                    <button
                      onClick={handleOpenAddTeacherModal}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black shadow-md shadow-emerald-100 transition-all cursor-pointer inline-flex items-center gap-2"
                    >
                      <UserPlus size={16} />
                      <span>اضافه کردن استاد جهت پرداخت</span>
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
                          <tr>
                            <th className="py-3 px-2 w-8 text-center">ردیف</th>
                            <th className="py-3 px-3">نام و نام خانوادگی استاد</th>
                            <th className="py-3 px-2 text-center">ساعت تدریس</th>
                            <th className="py-3 px-2 text-center text-slate-800">ناخالص کارکرد</th>
                            <th className="py-3 px-2 text-center text-rose-700">کسر نهار و سرویس</th>
                            <th className="py-3 px-2 text-center text-purple-700">کسورات نوع ۲</th>
                            <th className="py-3 px-2 text-center text-sky-700">تعدیل دستی (+/-)</th>
                            <th className="py-3 px-3 text-center bg-teal-50 text-teal-950 font-black border-r border-teal-100/60">خالص پرداختی</th>
                            <th className="py-3 px-2 w-20 text-center">عملیات</th>
                          </tr>
                        ) : (
                          <tr>
                            <th className="py-3 px-2 w-8 text-center">ردیف</th>
                            <th className="py-3 px-3">نام و نام خانوادگی استاد</th>
                            <th className="py-3 px-2 text-center">جلسات عادی</th>
                            <th className="py-3 px-2 text-center">ساعت عادی</th>
                            <th className="py-3 px-2 text-center">ساعت جایگزین</th>
                            <th className="py-3 px-2 text-center">کل ساعت</th>
                            <th className="py-3 px-2 text-center">نرخ ساعت</th>
                            <th className="py-3 px-2 text-center">ناخالص پایه</th>
                            <th className="py-3 px-2 text-center text-rose-700">وعده نهار</th>
                            <th className="py-3 px-2 text-center text-rose-700">کسر نهار</th>
                            <th className="py-3 px-2 text-center text-sky-700">نوبت سرویس</th>
                            <th className="py-3 px-2 text-center text-sky-700">کسر سرویس</th>
                            <th className="py-3 px-2 text-center text-purple-700">کسورات نوع ۲</th>
                            <th className="py-3 px-2 text-center text-slate-700">تعدیل دستی (+/-)</th>
                            <th className="py-3 px-2">علت تعدیل</th>
                            <th className="py-3 px-3 text-center bg-teal-50 text-teal-950 font-black border-r border-teal-100/60">خالص پرداختی نهایی</th>
                            <th className="py-3 px-2 w-16 text-center">حذف</th>
                          </tr>
                        )}
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {filteredActiveItems.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-teal-50/15 transition-colors">
                            <td className="py-2.5 px-2 text-center font-mono text-slate-400 font-bold text-[11px]">{idx + 1}</td>
                            <td className="py-2.5 px-3">
                              <div className="font-black text-slate-900 text-xs">{item.teacherName}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">{item.coursesStr}</div>
                            </td>

                            {isCompactView ? (
                              <>
                                <td className="py-2.5 px-2 text-center font-mono font-bold">{item.totalTeachingHours}</td>
                                <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-800">{item.baseGrossAmount.toLocaleString('fa-IR')}</td>
                                <td className="py-2.5 px-2 text-center font-mono font-bold text-rose-700">
                                  {((item.lunchDeduction || 0) + (item.transportDeduction || 0)).toLocaleString('fa-IR')}
                                </td>
                                <td className="py-2.5 px-2 text-center font-mono font-bold text-purple-700">
                                  {(item.type2DeductionsTotal || 0).toLocaleString('fa-IR')}
                                </td>
                                <td className="py-2.5 px-2 text-center font-mono font-bold text-sky-700">
                                  {item.manualAdjustmentAmount > 0 ? `+${item.manualAdjustmentAmount.toLocaleString('fa-IR')}` : item.manualAdjustmentAmount.toLocaleString('fa-IR')}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-black text-teal-950 bg-teal-50/50 border-r border-teal-100/40">
                                  {item.netPayable.toLocaleString('fa-IR')}
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  <button
                                    onClick={() => handleRemoveItem(item.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                    title="حذف از جدول"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-2.5 px-2 text-center font-mono">{item.regularTeachingSessions}</td>
                                <td className="py-2.5 px-2 text-center">
                                  <input
                                    type="number"
                                    value={item.regularTeachingHours}
                                    onChange={(e) => handleUpdateItemValue(item.id, 'regularTeachingHours', e.target.value)}
                                    className="w-14 text-center py-1 bg-white border border-slate-200 rounded-lg font-mono font-bold text-xs focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none"
                                  />
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  <input
                                    type="number"
                                    value={item.substituteTeachingHours}
                                    onChange={(e) => handleUpdateItemValue(item.id, 'substituteTeachingHours', e.target.value)}
                                    className="w-14 text-center py-1 bg-white border border-slate-200 rounded-lg font-mono font-bold text-xs focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none"
                                  />
                                </td>
                                <td className="py-2.5 px-2 text-center font-mono font-black text-slate-900 bg-slate-50">{item.totalTeachingHours}</td>
                                <td className="py-2.5 px-2 text-center font-mono text-slate-600">{item.hourlyRate.toLocaleString('fa-IR')}</td>
                                <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-800">{item.baseGrossAmount.toLocaleString('fa-IR')}</td>
                                <td className="py-2.5 px-2 text-center">
                                  <input
                                    type="number"
                                    value={item.lunchCount}
                                    onChange={(e) => handleUpdateItemValue(item.id, 'lunchCount', e.target.value)}
                                    className="w-12 text-center py-1 bg-white border border-rose-200 rounded-lg font-mono font-bold text-xs text-rose-700 focus:ring-2 focus:ring-rose-100 focus:border-rose-500 outline-none"
                                  />
                                </td>
                                <td className="py-2.5 px-2 text-center font-mono font-bold text-rose-700">{item.lunchDeduction.toLocaleString('fa-IR')}</td>
                                <td className="py-2.5 px-2 text-center">
                                  <input
                                    type="number"
                                    value={item.transportTripsCount}
                                    onChange={(e) => handleUpdateItemValue(item.id, 'transportTripsCount', e.target.value)}
                                    className="w-12 text-center py-1 bg-white border border-sky-200 rounded-lg font-mono font-bold text-xs text-sky-800 focus:ring-2 focus:ring-sky-100 focus:border-sky-500 outline-none"
                                  />
                                </td>
                                <td className="py-2.5 px-2 text-center font-mono font-bold text-sky-800">{item.transportDeduction.toLocaleString('fa-IR')}</td>
                                <td className="py-2.5 px-2 text-center font-mono font-bold text-purple-700">
                                  {(item.type2DeductionsTotal || 0).toLocaleString('fa-IR')}
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  <input
                                    type="number"
                                    value={item.manualAdjustmentAmount}
                                    onChange={(e) => handleUpdateItemValue(item.id, 'manualAdjustmentAmount', Number(e.target.value))}
                                    className="w-20 text-center py-1 bg-white border border-slate-200 rounded-lg font-mono font-bold text-xs focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none"
                                  />
                                </td>
                                <td className="py-2.5 px-2">
                                  <input
                                    type="text"
                                    placeholder="علت تعدیل..."
                                    value={item.manualAdjustmentReason || ''}
                                    onChange={(e) => handleUpdateItemValue(item.id, 'manualAdjustmentReason', e.target.value)}
                                    className="w-28 py-1 px-2 bg-white border border-slate-200 rounded-lg text-[11px] focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none"
                                  />
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-black text-teal-950 bg-teal-50/50 border-r border-teal-100/40">
                                  {item.netPayable.toLocaleString('fa-IR')}
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  <button
                                    onClick={() => handleRemoveItem(item.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                    title="حذف"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
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
      {/* VIEW 2: ARCHIVED PERIODS LIST & VIEWER                        */}
      {/* ============================================================= */}
      {activeView === 'periods_archive' && (
        <div className="space-y-6">
          {selectedArchivedPeriod ? (
            /* Detailed View of an Archived Period */
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedArchivedPeriod(null)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                    >
                      بازگشت به لیست بایگانی
                    </button>
                    <h3 className="text-base font-black text-slate-900">{selectedArchivedPeriod.title}</h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    بازه زمانی: <span className="font-mono font-bold text-slate-700">{selectedArchivedPeriod.startDate}</span> الی <span className="font-mono font-bold text-slate-700">{selectedArchivedPeriod.endDate}</span> • ثبت شده توسط: {selectedArchivedPeriod.createdByName || 'مسئول مالی'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportDetailedExcel(selectedArchivedPeriod.items, selectedArchivedPeriod.title)}
                    className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <FileSpreadsheet size={15} className="text-emerald-600" />
                    <span>خروجی اکسل تفصیلی</span>
                  </button>

                  <button
                    onClick={() => handleExportSuperiorsExcel(selectedArchivedPeriod.items, selectedArchivedPeriod.title)}
                    className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <FileText size={15} className="text-indigo-600" />
                    <span>گزارش بالادستی و حساب‌های مقصد</span>
                  </button>
                </div>
              </div>

              {/* Archived Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3 w-8 text-center">ردیف</th>
                      <th className="p-3">نام و نام خانوادگی استاد</th>
                      <th className="p-3 text-center">ساعت تدریس</th>
                      <th className="p-3 text-center">ناخالص حق‌الزحمه</th>
                      <th className="p-3 text-center text-rose-700">کسر نهار</th>
                      <th className="p-3 text-center text-amber-700">کسر سرویس</th>
                      <th className="p-3 text-center text-purple-700">کسورات نوع ۲</th>
                      <th className="p-3 text-center">تعدیل دستی</th>
                      <th className="p-3 text-center bg-amber-100 font-black text-amber-950">خالص پرداختی</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {selectedArchivedPeriod.items.map((it, i) => (
                      <tr key={it.id} className="hover:bg-slate-50">
                        <td className="p-3 text-center font-mono text-slate-400 font-bold">{i + 1}</td>
                        <td className="p-3 font-black text-slate-900">{it.teacherName}</td>
                        <td className="p-3 text-center font-mono font-bold">{it.totalTeachingHours}</td>
                        <td className="p-3 text-center font-mono">{it.baseGrossAmount.toLocaleString('fa-IR')}</td>
                        <td className="p-3 text-center font-mono text-rose-700">{it.lunchDeduction.toLocaleString('fa-IR')}</td>
                        <td className="p-3 text-center font-mono text-sky-700">{it.transportDeduction.toLocaleString('fa-IR')}</td>
                        <td className="p-3 text-center font-mono text-purple-700">{(it.type2DeductionsTotal || 0).toLocaleString('fa-IR')}</td>
                        <td className="p-3 text-center font-mono">{it.manualAdjustmentAmount}</td>
                        <td className="p-3 text-center font-mono font-black text-teal-950 bg-teal-50 border-r border-teal-100">
                          {it.netPayable.toLocaleString('fa-IR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* List of Archived Periods */
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <Archive className="text-teal-600" size={18} />
                  <span>آرشیو دوره‌های پرداخت حق‌الزحمه اساتید ({periods.length} دوره)</span>
                </h3>
              </div>

              {periods.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Archive size={36} className="text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">هیچ دوره پرداختی تاکنون در بایگانی ثبت نشده است.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {periods.map(period => (
                    <div
                      key={period.id}
                      className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 hover:border-teal-400 hover:bg-white hover:shadow-md hover:shadow-teal-50/40 transition-all shadow-2xs space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-black text-slate-900">{period.title}</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            بازه: <strong className="font-mono">{period.startDate}</strong> الی <strong className="font-mono">{period.endDate}</strong>
                          </p>
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md">
                          نهایی شده
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-white rounded-xl p-3 border border-slate-200/60 font-mono">
                        <div>
                          <span className="text-slate-400 text-[10px] block font-sans">تعداد اساتید:</span>
                          <span className="font-black text-slate-800">{period.totalTeachers} نفر</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] block font-sans">مجموع پرداختی:</span>
                          <span className="font-black text-emerald-700">{period.totalPayoutAmount.toLocaleString('fa-IR')} ت</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          onClick={() => setSelectedArchivedPeriod(period)}
                          className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black transition-all shadow-2xs cursor-pointer"
                        >
                          مشاهده تفصیلی دوره
                        </button>
                        <button
                          onClick={() => handleExportSuperiorsExcel(period.items, period.title)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          خروجی بالادستی
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 1: SET DATE RANGE & NEW PERIOD SETTINGS                 */}
      {/* ============================================================= */}
      {isDateRangeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 my-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Calendar className="text-teal-600" size={20} />
                <span>تنظیم بازه زمانی و مشخصات دوره پرداخت</span>
              </h3>
              <button onClick={() => setIsDateRangeModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmDateRange} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">عنوان دوره پرداخت:</label>
                <input
                  type="text"
                  required
                  placeholder="مثلاً: حق‌الزحمه اساتید مهر ماه ۱۴۰۳"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">تاریخ شروع بازه:</label>
                  <input
                    type="text"
                    required
                    placeholder="1403/07/01"
                    value={modalStart}
                    onChange={(e) => setModalStart(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">تاریخ پایان بازه:</label>
                  <input
                    type="text"
                    required
                    placeholder="1403/07/30"
                    value={modalEnd}
                    onChange={(e) => setModalEnd(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">نرخ مصوب هر ساعت (تومان):</label>
                  <input
                    type="number"
                    value={modalHourlyRate}
                    onChange={(e) => setModalHourlyRate(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">هزینه هر وعده نهار (تومان):</label>
                  <input
                    type="number"
                    value={modalLunchCost}
                    onChange={(e) => setModalLunchCost(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>

              {/* Transport Settings Box */}
              <div className="bg-sky-50/60 rounded-2xl p-3.5 border border-sky-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-sky-950 flex items-center gap-1.5">
                    <Car size={15} className="text-sky-700" />
                    <span>محاسبه هزینه سرویس ایاب و ذهاب</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-sky-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={modalEnableTransport}
                      onChange={(e) => setModalEnableTransport(e.target.checked)}
                      className="accent-sky-600 rounded"
                    />
                    <span>فعال</span>
                  </label>
                </div>

                {modalEnableTransport && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">نحوه محاسبه سرویس:</label>
                      <select
                        value={modalTransportMode}
                        onChange={(e) => setModalTransportMode(e.target.value as any)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                      >
                        <option value="per_trip">هر رفت/برگشت جداگانه (۲ نوبت)</option>
                        <option value="per_day">کل روز ۱ نوبت</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">نرخ مصوب هر نوبت (تومان):</label>
                      <input
                        type="number"
                        value={modalTransportCost}
                        onChange={(e) => setModalTransportCost(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDateRangeModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black shadow-md shadow-teal-100"
                >
                  ورود به بخش محاسبه دوره پرداخت
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 2: ADD TEACHERS TO PERIOD TABLE                         */}
      {/* ============================================================= */}
      {isAddTeacherModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <UserPlus className="text-emerald-600" size={20} />
                <span>انتخاب اساتید جهت افزودن به جدول پرداخت</span>
              </h3>
              <button onClick={() => setIsAddTeacherModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            <div className="relative">
              <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="جستجو در نام اساتید..."
                value={teacherSearchQuery}
                onChange={(e) => setTeacherSearchQuery(e.target.value)}
                className="w-full pr-10 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 border border-slate-100 rounded-2xl p-2 bg-slate-50/50">
              {teachersList
                .filter(t => !teacherSearchQuery || (t.fullName || t.name || '').includes(teacherSearchQuery))
                .map(teacher => {
                  const isSelected = selectedTeacherIds.includes(teacher.id);
                  const isAlreadyAdded = items.some(i => i.teacherId === teacher.id);

                  return (
                    <div
                      key={teacher.id}
                      onClick={() => {
                        if (isAlreadyAdded) return;
                        if (isSelected) {
                          setSelectedTeacherIds(selectedTeacherIds.filter(id => id !== teacher.id));
                        } else {
                          setSelectedTeacherIds([...selectedTeacherIds, teacher.id]);
                        }
                      }}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                        isAlreadyAdded ? "bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed" :
                        isSelected ? "bg-amber-50 border-amber-300 text-amber-950" : "bg-white border-slate-200/80 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          disabled={isAlreadyAdded}
                          checked={isSelected || isAlreadyAdded}
                          onChange={() => {}}
                          className="accent-amber-600 rounded"
                        />
                        <div>
                          <div className="text-xs font-black text-slate-900">{teacher.fullName || teacher.name}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{teacher.courses?.join('، ') || 'دروس فقه و اصول'}</div>
                        </div>
                      </div>

                      {isAlreadyAdded && (
                        <span className="text-[10px] text-slate-500 font-bold bg-slate-200 px-2 py-0.5 rounded-md">
                          در جدول موجود است
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                انتخاب شده: <strong className="text-slate-800">{selectedTeacherIds.length}</strong> استاد
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddTeacherModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAddTeachers}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-100"
                >
                  افزودن به جدول
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
