import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  DollarSign, 
  Calendar, 
  Clock, 
  CheckSquare, 
  BookCheck, 
  UtensilsCrossed, 
  Coins, 
  HeartHandshake, 
  SlidersHorizontal, 
  Download, 
  Printer, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Info, 
  FileSpreadsheet, 
  Edit3, 
  Eye, 
  Plus, 
  CreditCard,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  FileText,
  MinusCircle,
  PlusCircle,
  CheckCheck,
  BookOpen,
  ArrowLeftRight,
  Trash2,
  HandCoins,
  ArrowLeft,
  CalendarPlus,
  Layers,
  Save
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { ShamsiDatePicker } from '../ShamsiDatePicker';
import { getTodayShamsi } from '../../lib/jalali';
import { motion, AnimatePresence } from 'motion/react';
import ActivityInfoTabbedView from './tuition/ActivityInfoTabbedView';
import { 
  Student, 
  TuitionCalculationSettings, 
  StudentFinancialProfile, 
  TuitionCalculationBreakdown, 
  TuitionPeriod,
  StudyTier,
  AttendanceSessionLog,
  PeriodicStudyLog,
  StudyPeriod,
  CounselingSessionGrade,
  EducationFinancialReport,
  FinanceDestinationAccount,
  FinanceClaimCategory,
  StudentClaimRecord,
  MealReservationPeriod,
  StudentMealReservation
} from '../../types';

interface StudentLunchItem {
  id: string;
  studentId: string;
  studentName: string;
  nationalId: string;
  grade: string;
  monthlyMealsCount: number;
  mealPrice: number;
  subsidyDiscount?: number;
  isDormitory: boolean;
  notes?: string;
  lastUpdated?: string;
}

interface StudentActivityAndTuitionProps {
  onNavigateTab?: (tab: string, params?: any) => void;
}

export default function StudentActivityAndTuition({ onNavigateTab }: StudentActivityAndTuitionProps) {
  const { currentUser } = useAuth();

  // Sub-tab: 'activity_info' (اطلاعات حضور و فعالیت طلاب) | 'mechanized_calc' (محاسبه مکانیزه)
  const [currentSubTab, setCurrentSubTab] = useState<'activity_info' | 'mechanized_calc'>('activity_info');

  // Archive sub-tab & Student Reports
  const [archiveSubTab, setArchiveSubTab] = useState<'period_list' | 'student_reports'>('period_list');
  const [reportSelectedStudentId, setReportSelectedStudentId] = useState<string>('');
  const [reportSelectedPeriodId, setReportSelectedPeriodId] = useState<string>('all_cumulative');
  const [reportViewType, setReportViewType] = useState<'summary_bill' | 'detailed'>('summary_bill');

  // Filters & Date Range
  const [gradeFilter, setGradeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Window of analysis (Default to 1st of current month to today or month end)
  const today = getTodayShamsi();
  const defaultStart = today.substring(0, 8) + '01';
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(today);

  // Core Data States
  const [students, setStudents] = useState<Student[]>([]);
  const [profiles, setProfiles] = useState<StudentFinancialProfile[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceSessionLog[]>([]);
  const [studyLogs, setStudyLogs] = useState<PeriodicStudyLog[]>([]);
  const [studyPeriods, setStudyPeriods] = useState<StudyPeriod[]>([]);
  const [counselingGrades, setCounselingGrades] = useState<CounselingSessionGrade[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [tuitionPeriods, setTuitionPeriods] = useState<TuitionPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('current');
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // Settings State
  const [settings, setSettings] = useState<TuitionCalculationSettings>({
    id: 'default_tuition_settings',
    isBaseTuitionEqualForMarried: false,
    singleBaseTuition: 2000000,
    baseSingleTuition: 2000000,
    marriedBaseTuition: 3200000,
    baseMarriedTuition: 3200000,
    hasMarriageBonus: true,
    marriageBonusType: 'percentage',
    marriageBonusPercent: 25,
    marriageBonusAmount: 1000000,
    hasChildAllowance: true,
    childAllowance: 350000,
    childAllowancePerChild: 350000,
    hasTurbanAllowance: true,
    turbanAllowance: 500000,
    clericalHabitBonus: 500000,
    hasHousingAllowance: true,
    housingAllowanceRented: 600000,
    housingAllowanceDorm: 250000,
    housingSubsidy: 500000,
    studyBonusEnabled: true,
    studyBonusBase: 'mandatory',
    studyBonusTiered: false,
    studyBonusTiers: [
      { id: '1', stepNumber: 1, minMinutes: 60, maxMinutes: 120, amount: 50000 },
      { id: '2', stepNumber: 2, minMinutes: 120, maxMinutes: 240, amount: 80000 },
      { id: '3', stepNumber: 3, minMinutes: 240, maxMinutes: 360, amount: 120000 }
    ],
    studyBonusThresholdMinutes: 60,
    studyBonusCalculationType: 'per_hour',
    studyBonusPerHour: 30000,
    studyBonusRatePerHour: 30000,
    studyBonusFixedAmount: 150000,
    studyPenaltyEnabled: true,
    studyPenaltyBase: 'mandatory',
    studyPenaltyTiered: false,
    studyPenaltyTiers: [
      { id: '1', stepNumber: 1, minMinutes: 60, maxMinutes: 120, amount: 40000 },
      { id: '2', stepNumber: 2, minMinutes: 120, maxMinutes: 240, amount: 70000 },
      { id: '3', stepNumber: 3, minMinutes: 240, maxMinutes: 360, amount: 100000 }
    ],
    studyPenaltyThreshold: 'below_mandatory',
    studyPenaltyCalculationType: 'per_hour',
    studyPenaltyPerHour: 25000,
    studyPenaltyRatePerHour: 25000,
    studyPenaltyFixedAmount: 100000,
    absenceDeductionEnabled: true,
    absenceDeductionMode: 'unexcused_only',
    absencePenaltyUnexcusedType: 'fixed',
    absencePenaltyPerSession: 90000,
    absencePenaltyUnexcusedAmount: 90000,
    absencePenaltyUnexcusedPercent: 4,
    absencePenaltyExcusedAmount: 25000,
    counselingGradeABonus: 30000,
    counselingGradeBBonus: 15000,
    counselingGradeCBonus: 0,
    dailyLunchCost: 45000,
    lunchCostPerDay: 45000,
    deductActiveLoans: true,
    defaultLoanInstallment: 300000,
    deductFundContribution: true,
    defaultFundContribution: 100000,
    deductClaims: true,
    enabledClaimCategoryIds: [],
    enableGeneralIncentive: false,
    generalIncentiveType: 'fixed',
    generalIncentiveAmount: 200000,
    generalIncentivePercent: 5,
    generalIncentiveTitle: 'پاداش تشویقی عمومی ماهانه',
    updatedAt: new Date().toISOString()
  });

  // Table view mode: 'detailed' (default) or 'compact'
  const [isCompactView, setIsCompactView] = useState(false);

  // Dual Reporting Mode: 'upper_management' (صورت‌وضعیت تفکیکی بالادستی و حواله‌ها) | 'internal_detailed' (گزارش تفصیلی داخلی با اصلاحات دستی)
  const [reportViewMode, setReportViewMode] = useState<'upper_management' | 'internal_detailed'>('internal_detailed');

  // Collections for Lunch, Meals, Claims, Destination Accounts, and Education Reports
  const [lunchItems, setLunchItems] = useState<StudentLunchItem[]>([]);
  const [mealReservations, setMealReservations] = useState<StudentMealReservation[]>([]);
  const [mealPeriods, setMealPeriods] = useState<MealReservationPeriod[]>([]);
  const [claimsList, setClaimsList] = useState<StudentClaimRecord[]>([]);
  const [claimCategories, setClaimCategories] = useState<FinanceClaimCategory[]>([]);
  const [destinationAccounts, setDestinationAccounts] = useState<FinanceDestinationAccount[]>([]);
  const [educationReports, setEducationReports] = useState<EducationFinancialReport[]>([]);

  // Modals
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isNewPeriodModalOpen, setIsNewPeriodModalOpen] = useState(false);
  const [selectedSlipDetail, setSelectedSlipDetail] = useState<TuitionCalculationBreakdown | null>(null);
  const [editingProfileStudent, setEditingProfileStudent] = useState<Student | null>(null);
  const [isGeneralPrintOpen, setIsGeneralPrintOpen] = useState(false);
  const [isUpperManagementPrintOpen, setIsUpperManagementPrintOpen] = useState(false);

  // Targeted Calculation Scope & Debt Detail Modals
  const [calcScopeMode, setCalcScopeMode] = useState<'all' | 'grade' | 'individual'>('all');
  const [selectedCalcGrade, setSelectedCalcGrade] = useState<string>('پایه ۷');
  const [selectedCalcStudentId, setSelectedCalcStudentId] = useState<string>('');
  const [isFinalizeWarningModalOpen, setIsFinalizeWarningModalOpen] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [selectedStudentForDebtDetail, setSelectedStudentForDebtDetail] = useState<any | null>(null);
  const [newDebtTitle, setNewDebtTitle] = useState('');
  const [newDebtAmount, setNewDebtAmount] = useState('');
  const [newDebtMonthly, setNewDebtMonthly] = useState('');
  const [newDebtCategory, setNewDebtCategory] = useState('سایر بدهی‌ها');
  
  // New Period Form
  const [newPeriodTitle, setNewPeriodTitle] = useState(`شهریه دوره ${today.substring(0, 7)}`);
  const [newPeriodStartDate, setNewPeriodStartDate] = useState(defaultStart);
  const [newPeriodEndDate, setNewPeriodEndDate] = useState(today);

  // Temporary edit profile states
  const [profIsMarried, setProfIsMarried] = useState(false);
  const [profChildren, setProfChildren] = useState(0);
  const [profIsRobed, setProfIsRobed] = useState(false);
  const [profLivingStatus, setProfLivingStatus] = useState<'پدری' | 'خوابگاه' | 'اجاره ای' | 'شخصی' | 'سایر'>('پدری');
  const [profLunchDays, setProfLunchDays] = useState(20);
  const [profFundContribution, setProfFundContribution] = useState(100000);
  const [profLoanInstallment, setProfLoanInstallment] = useState(0);
  const [profBankAccount, setProfBankAccount] = useState('');
  const [profBankSheba, setProfBankSheba] = useState('');
  const [profBankName1, setProfBankName1] = useState('');
  const [profBankAccount2, setProfBankAccount2] = useState('');
  const [profBankSheba2, setProfBankSheba2] = useState('');
  const [profBankName2, setProfBankName2] = useState('');
  const [profActiveDepositAccount, setProfActiveDepositAccount] = useState<'account1' | 'account2' | 'both'>('account1');
  const [profManualAdjustment, setProfManualAdjustment] = useState<number>(0);
  const [profManualAdjustmentReason, setProfManualAdjustmentReason] = useState<string>('');

  // Primary Page View Mode: 'initial_home' (صفحه آغازین دو گزینه‌ای) | 'active_period' (محیط ایجاد دوره و محاسبه شهریه) | 'archived_periods' (مشاهده دوره‌های شهریه {بایگانی})
  const [pageMode, setPageMode] = useState<'initial_home' | 'active_period' | 'archived_periods'>('initial_home');

  // Manual Overrides state per student (indexed by studentId)
  const [studentOverrides, setStudentOverrides] = useState<Record<string, {
    manualAdjustmentAmount?: number;
    manualAdjustmentReason?: string;
    overrideStudyBonus?: number;
    ignoreAbsencePenalty?: boolean;
    overrideBaseTuition?: number;
  }>>({});

  // Active student being edited in the overrides modal
  const [editingOverrideStudentId, setEditingOverrideStudentId] = useState<string | null>(null);

  // Active selected archived period for viewing details
  const [selectedArchivedPeriod, setSelectedArchivedPeriod] = useState<TuitionPeriod | null>(null);
  const [isArchivedCompactView, setIsArchivedCompactView] = useState(false);
  const [archivedSearchQuery, setArchivedSearchQuery] = useState('');
  const [archivedGradeFilter, setArchivedGradeFilter] = useState('all');
  const [isArchivedModified, setIsArchivedModified] = useState(false);

  const handleAddDebtDetail = async () => {
    if (!selectedStudentForDebtDetail) return;
    if (!newDebtTitle.trim() || !newDebtAmount.trim()) {
      showToast('لطفاً عنوان و مبلغ کل بدهی را وارد نمایید.');
      return;
    }
    const total = Number(newDebtAmount);
    const monthly = Number(newDebtMonthly || (total / 5).toFixed(0));
    if (isNaN(total) || total <= 0) {
      showToast('مبلغ کل بدهی باید یک عدد مثبت باشد.');
      return;
    }

    const newClaim: any = {
      id: `clm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      studentId: selectedStudentForDebtDetail.studentId,
      studentName: selectedStudentForDebtDetail.studentName,
      claimTitle: newDebtTitle.trim(),
      totalDebtAmount: total,
      remainingAmount: total,
      monthlyDeductionAmount: monthly,
      status: 'active',
      destinationAccountTitle: newDebtCategory,
      destinationAccountId: 'cultural_account',
      targetType: 'student',
      created_at: new Date().toISOString()
    };

    try {
      await localDb.addDoc('student_claims', newClaim);
      try {
        await localDb.addDoc('finance_student_claims', newClaim);
      } catch (e) {}
      setClaimsList(prev => [...prev, newClaim]);
      setNewDebtTitle('');
      setNewDebtAmount('');
      setNewDebtMonthly('');
      showToast(`بدهی جدید برای ${selectedStudentForDebtDetail.studentName} با موفقیت ثبت شد.`);
    } catch (e: any) {
      showToast(`خطا در ثبت بدهی: ${e?.message || 'مشکل در ذخیره‌سازی ابری'}`);
    }
  };

  const handleDeleteDebtDetail = async (claimId: string) => {
    if (!window.confirm('آیا از حذف این بدهی مطمئن هستید؟')) return;
    try {
      await localDb.deleteDoc('student_claims', claimId);
      try {
        await localDb.deleteDoc('finance_student_claims', claimId);
      } catch (e) {}
      setClaimsList(prev => prev.filter(c => c.id !== claimId));
      showToast('بدهی مورد نظر با موفقیت حذف شد.');
    } catch (e: any) {
      showToast(`خطا در حذف بدهی: ${e?.message || 'مشکل در ذخیره‌سازی ابری'}`);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Load all required collections
  const loadAllData = async (isInitial = false) => {
    if (isInitial) {
      setIsLoading(true);
    }
    try {
      const [
        studs, 
        profs, 
        settList, 
        atts, 
        pLogs, 
        sPeriods, 
        cGrades, 
        lns, 
        tPeriods,
        lnchItems,
        mRes,
        mPer,
        cRecs1,
        cRecs2,
        cCats,
        dAccs,
        eduReports
      ] = await Promise.all([
        localDb.getDocs<Student>('students'),
        localDb.getDocs<StudentFinancialProfile>('student_financial_profiles'),
        localDb.getDocs<TuitionCalculationSettings>('tuition_settings'),
        localDb.getDocs<AttendanceSessionLog>('attendance'),
        localDb.getDocs<PeriodicStudyLog>('periodic_study_logs'),
        localDb.getDocs<StudyPeriod>('study_periods'),
        localDb.getDocs<CounselingSessionGrade>('counseling_session_grades'),
        localDb.getDocs('finance_loans'),
        localDb.getDocs<TuitionPeriod>('tuition_periods'),
        localDb.getDocs<StudentLunchItem>('finance_lunch_students'),
        localDb.getDocs<StudentMealReservation>('meal_reservations'),
        localDb.getDocs<MealReservationPeriod>('meal_reservation_periods'),
        localDb.getDocs<StudentClaimRecord>('finance_student_claims'),
        localDb.getDocs<StudentClaimRecord>('student_claims'),
        localDb.getDocs<FinanceClaimCategory>('finance_claim_categories'),
        localDb.getDocs<FinanceDestinationAccount>('finance_destination_accounts'),
        localDb.getDocs<EducationFinancialReport>('education_financial_reports')
      ]);

      setStudents(studs || []);
      setProfiles(profs || []);
      if (settList && settList.length > 0) {
        setSettings(prev => ({ ...prev, ...settList[0] }));
      }
      setAttendanceLogs(atts || []);
      setStudyLogs(pLogs || []);
      setStudyPeriods(sPeriods || []);
      setCounselingGrades(cGrades || []);
      setLoans(lns || []);
      setTuitionPeriods(tPeriods || []);
      setLunchItems(lnchItems || []);
      setMealReservations(mRes || []);
      setMealPeriods(mPer || []);

      // Merge claims from both collections seamlessly
      const mergedClaimsMap = new Map<string, StudentClaimRecord>();
      (cRecs1 || []).forEach(c => mergedClaimsMap.set(c.id, c));
      (cRecs2 || []).forEach(c => mergedClaimsMap.set(c.id, c));
      setClaimsList(Array.from(mergedClaimsMap.values()));

      setClaimCategories(cCats || []);
      setDestinationAccounts(dAccs || []);
      setEducationReports(eduReports || []);
    } catch (err) {
      console.error('Error loading finance data:', err);
    } finally {
      if (isInitial) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadAllData(true);
    let debounceTimer: any = null;
    const unsub = localDb.subscribe(() => {
      // Debounce background refreshes so UI never flickers or re-mounts
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadAllData(false);
      }, 300);
    });
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsub();
    };
  }, []);

  // Save Settings Handler
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...settings,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.fullName || currentUser?.name || currentUser?.username
    };
    setSettings(updated);
    await localDb.setDoc('tuition_settings', updated);
    setIsSettingsModalOpen(false);
    showToast('تنظیمات فرمول و مبالغ محاسبه شهریه با موفقیت ذخیره شد.');
  };

  // Study Tiers Management Helpers
  const handleAddBonusTier = () => {
    const currentTiers = settings.studyBonusTiers || [];
    if (currentTiers.length >= 5) return;
    const nextStep = currentTiers.length + 1;
    const lastTier = currentTiers[currentTiers.length - 1];
    const minMins = lastTier ? lastTier.maxMinutes : 60;
    const maxMins = minMins + 60;
    const newTier: StudyTier = {
      id: `tier_b_${Date.now()}_${nextStep}`,
      stepNumber: nextStep,
      minMinutes: minMins,
      maxMinutes: maxMins,
      amount: 50000 * nextStep
    };
    setSettings({
      ...settings,
      studyBonusTiers: [...currentTiers, newTier]
    });
  };

  const handleRemoveBonusTier = (index: number) => {
    const currentTiers = [...(settings.studyBonusTiers || [])];
    currentTiers.splice(index, 1);
    const updated = currentTiers.map((t, idx) => ({ ...t, stepNumber: idx + 1 }));
    setSettings({ ...settings, studyBonusTiers: updated });
  };

  const handleUpdateBonusTier = (index: number, field: keyof StudyTier, value: number) => {
    const currentTiers = [...(settings.studyBonusTiers || [])];
    if (currentTiers[index]) {
      currentTiers[index] = { ...currentTiers[index], [field]: value };
      setSettings({ ...settings, studyBonusTiers: currentTiers });
    }
  };

  const handleAddPenaltyTier = () => {
    const currentTiers = settings.studyPenaltyTiers || [];
    if (currentTiers.length >= 5) return;
    const nextStep = currentTiers.length + 1;
    const lastTier = currentTiers[currentTiers.length - 1];
    const minMins = lastTier ? lastTier.maxMinutes : 60;
    const maxMins = minMins + 60;
    const newTier: StudyTier = {
      id: `tier_p_${Date.now()}_${nextStep}`,
      stepNumber: nextStep,
      minMinutes: minMins,
      maxMinutes: maxMins,
      amount: 40000 * nextStep
    };
    setSettings({
      ...settings,
      studyPenaltyTiers: [...currentTiers, newTier]
    });
  };

  const handleRemovePenaltyTier = (index: number) => {
    const currentTiers = [...(settings.studyPenaltyTiers || [])];
    currentTiers.splice(index, 1);
    const updated = currentTiers.map((t, idx) => ({ ...t, stepNumber: idx + 1 }));
    setSettings({ ...settings, studyPenaltyTiers: updated });
  };

  const handleUpdatePenaltyTier = (index: number, field: keyof StudyTier, value: number) => {
    const currentTiers = [...(settings.studyPenaltyTiers || [])];
    if (currentTiers[index]) {
      currentTiers[index] = { ...currentTiers[index], [field]: value };
      setSettings({ ...settings, studyPenaltyTiers: currentTiers });
    }
  };

  // Save Student Profile Handler
  const handleSaveStudentProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfileStudent) return;
    const sid = editingProfileStudent.id;

    const existingProf = profiles.find(p => p.studentId === sid) || {
      studentId: sid,
      studentName: editingProfileStudent.name,
      nationalId: editingProfileStudent.nationalId
    };

    const updatedProfile: StudentFinancialProfile = {
      ...existingProf,
      isMarried: profIsMarried,
      maritalStatus: profIsMarried ? 'متاهل' : 'مجرد',
      childrenCount: profChildren,
      isRobed: profIsRobed,
      isTammam: profIsRobed,
      livingStatus: profLivingStatus,
      monthlyLunchDays: profLunchDays,
      lunchDaysCount: profLunchDays,
      fundContribution: profFundContribution,
      fundContributionMonthly: profFundContribution,
      activeLoanInstallment: profLoanInstallment,
      updatedAt: new Date().toISOString()
    };

    await localDb.setDoc('student_financial_profiles', updatedProfile);

    // Also update student basic bank info if changed
    const updatedStudent: Student = {
      ...editingProfileStudent,
      maritalStatus: profIsMarried ? 'متاهل' : 'مجرد',
      childrenCount: profChildren,
      tammomStatus: profIsRobed ? 'معمم' : 'غیر معمم',
      livingStatus: profLivingStatus,
      bankAccount1: profBankAccount,
      bankSheba1: profBankSheba
    };
    await localDb.setDoc('students', updatedStudent);

    setProfiles(prev => {
      const idx = prev.findIndex(p => p.studentId === sid);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updatedProfile;
        return copy;
      }
      return [...prev, updatedProfile];
    });

    setStudents(prev => prev.map(s => s.id === sid ? updatedStudent : s));
    showToast(`اطلاعات پرونده و وضعیت زندگی ${editingProfileStudent.name} ذخیره گردید.`);
    setEditingProfileStudent(null);
  };

  // Open Edit Profile Modal
  const openEditProfile = (student: Student) => {
    const prof = profiles.find(p => p.studentId === student.id);
    setEditingProfileStudent(student);
    setProfIsMarried(student.maritalStatus === 'متاهل' || !!prof?.isMarried);
    setProfChildren(student.childrenCount || prof?.childrenCount || 0);
    setProfIsRobed(student.tammomStatus === 'معمم' || !!prof?.isRobed || !!prof?.isTammam);
    setProfLivingStatus(student.livingStatus || prof?.livingStatus || 'پدری');
    setProfLunchDays(prof?.monthlyLunchDays ?? prof?.lunchDaysCount ?? 20);
    setProfFundContribution(prof?.fundContributionMonthly ?? prof?.fundContribution ?? settings.defaultFundContribution ?? 100000);
    setProfLoanInstallment(prof?.activeLoanInstallment ?? 0);
    setProfBankAccount(student.bankAccount1 || '');
    setProfBankSheba(student.bankSheba1 || '');
  };

  // -------------------------------------------------------------
  // Data Aggregation in Selected Window [startDate, endDate]
  // -------------------------------------------------------------

  // 1. Attendance Aggregation
  const attendanceAggregations = useMemo(() => {
    const map: Record<string, {
      present: number;
      absentUnexcused: number;
      absentExcused: number;
      late: number;
      unspecified: number;
      warningCount: number;
      totalSessions: number;
    }> = {};

    students.forEach(s => {
      map[s.id] = { present: 0, absentUnexcused: 0, absentExcused: 0, late: 0, unspecified: 0, warningCount: 0, totalSessions: 0 };
    });

    attendanceLogs.forEach(log => {
      if (log.date >= startDate && log.date <= endDate && !log.isCancelled) {
        if (Array.isArray(log.students)) {
          log.students.forEach(st => {
            if (!map[st.studentId]) {
              map[st.studentId] = { present: 0, absentUnexcused: 0, absentExcused: 0, late: 0, unspecified: 0, warningCount: 0, totalSessions: 0 };
            }
            map[st.studentId].totalSessions++;
            if (st.status === 'present') {
              map[st.studentId].present++;
            } else if (st.status === 'absent') {
              if (st.isExcused) {
                map[st.studentId].absentExcused++;
              } else {
                map[st.studentId].absentUnexcused++;
              }
            } else if (st.status === 'excused') {
              map[st.studentId].absentExcused++;
            } else if (st.status === 'late') {
              map[st.studentId].late++;
            } else {
              map[st.studentId].unspecified++;
            }
            if (st.hasEducationalWarning) {
              map[st.studentId].warningCount++;
            }
          });
        }
      }
    });

    return map;
  }, [students, attendanceLogs, startDate, endDate]);

  // 2. Study Hours Aggregation
  const studyAggregations = useMemo(() => {
    const studentStudyMinutes: Record<string, number> = {};
    const studentWarningStatus: Record<string, boolean> = {};

    students.forEach(s => {
      studentStudyMinutes[s.id] = 0;
      studentWarningStatus[s.id] = false;
    });

    // Determine mandatory hours from overlapping study periods or default 40 hours
    let mandatoryHours = 40;
    const relevantPeriods = studyPeriods.filter(p => {
      return (p.startDate <= endDate && p.endDate >= startDate);
    });
    if (relevantPeriods.length > 0) {
      mandatoryHours = relevantPeriods.reduce((acc, curr) => acc + (curr.mandatoryHours || 40), 0) / relevantPeriods.length;
    }
    const mandatoryMinutes = Math.round(mandatoryHours * 60);

    // Sum hours from study logs matching student and periods
    studyLogs.forEach(log => {
      const p = studyPeriods.find(sp => sp.id === log.periodId);
      const isPeriodInRange = p ? (p.startDate <= endDate && p.endDate >= startDate) : true;
      if (isPeriodInRange && studentStudyMinutes[log.studentId] !== undefined) {
        const totalLogMinutes = Math.round(((log.studyHours || 0) + (log.discussionHours || 0) || (log.hours || 0)) * 60);
        studentStudyMinutes[log.studentId] += totalLogMinutes;
        if ((log.warningsCount || 0) > 0) {
          studentWarningStatus[log.studentId] = true;
        }
      }
    });

    // Provide baseline if no logs recorded yet (so data isn't artificially zero in test env)
    students.forEach(s => {
      if (studentStudyMinutes[s.id] === 0) {
        const prof = profiles.find(p => p.studentId === s.id);
        studentStudyMinutes[s.id] = (prof?.studyHoursLogged ? prof.studyHoursLogged * 60 : 42 * 60);
      }
    });

    // Calculate school average minutes
    const values = Object.values(studentStudyMinutes);
    const avgMinutes = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : mandatoryMinutes;

    return {
      minutesMap: studentStudyMinutes,
      warningMap: studentWarningStatus,
      mandatoryMinutes,
      avgMinutes
    };
  }, [students, studyLogs, studyPeriods, profiles, startDate, endDate]);

  // 3. Counseling Session Grades Aggregation (الف، ب، ج، د، غیبت)
  const counselingAggregations = useMemo(() => {
    const map: Record<string, { countA: number; countB: number; countC: number; countD: number; countAbsence: number; total: number }> = {};

    students.forEach(s => {
      map[s.id] = { countA: 0, countB: 0, countC: 0, countD: 0, countAbsence: 0, total: 0 };
    });

    counselingGrades.forEach(cg => {
      if (cg.sessionDate >= startDate && cg.sessionDate <= endDate) {
        if (!map[cg.studentId]) {
          map[cg.studentId] = { countA: 0, countB: 0, countC: 0, countD: 0, countAbsence: 0, total: 0 };
        }
        map[cg.studentId].total += 2; // participation + research
        if (cg.participationScore === 'الف') map[cg.studentId].countA++;
        else if (cg.participationScore === 'ب') map[cg.studentId].countB++;
        else if (cg.participationScore === 'ج') map[cg.studentId].countC++;
        else if (cg.participationScore === 'د') map[cg.studentId].countD++;
        else if (cg.participationScore === 'غیبت') map[cg.studentId].countAbsence++;

        if (cg.researchScore === 'الف') map[cg.studentId].countA++;
        else if (cg.researchScore === 'ب') map[cg.studentId].countB++;
        else if (cg.researchScore === 'ج') map[cg.studentId].countC++;
        else if (cg.researchScore === 'د') map[cg.studentId].countD++;
        else if (cg.researchScore === 'غیبت') map[cg.studentId].countAbsence++;
      }
    });

    return map;
  }, [students, counselingGrades, startDate, endDate]);

  // 4. Loans & Fund Aggregation
  const financialInstallmentsMap = useMemo(() => {
    const loanMap: Record<string, { totalActive: number; monthlyDeduction: number }> = {};
    students.forEach(s => {
      loanMap[s.id] = { totalActive: 0, monthlyDeduction: 0 };
    });

    loans.forEach(l => {
      if (l.status === 'active' && loanMap[l.studentId]) {
        loanMap[l.studentId].totalActive += Number(l.remainingAmount || l.amount || 0);
        loanMap[l.studentId].monthlyDeduction += Number(l.monthlyInstallment || 0);
      }
    });

    return loanMap;
  }, [students, loans]);

  // -------------------------------------------------------------
  // Filtered Students List
  // -------------------------------------------------------------
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      // Scope filtering for mechanized calculation
      if (currentSubTab === 'mechanized_calc') {
        if (calcScopeMode === 'grade' && s.grade !== selectedCalcGrade) return false;
        if (calcScopeMode === 'individual' && selectedCalcStudentId && s.id !== selectedCalcStudentId) return false;
      }
      if (gradeFilter !== 'all' && s.grade !== gradeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = s.name?.toLowerCase().includes(q);
        const matchNat = s.nationalId?.includes(q);
        const matchInst = s.instituteCode?.includes(q);
        if (!matchName && !matchNat && !matchInst) return false;
      }
      return true;
    });
  }, [students, gradeFilter, searchQuery, currentSubTab, calcScopeMode, selectedCalcGrade, selectedCalcStudentId]);

  // -------------------------------------------------------------
  // Tuition Calculation Engine for Filtered Students
  // -------------------------------------------------------------
  const calculatedTuitions: TuitionCalculationBreakdown[] = useMemo(() => {
    return filteredStudents.map(student => {
      const prof = profiles.find(p => p.studentId === student.id);
      const att = attendanceAggregations[student.id] || { present: 0, absentUnexcused: 0, absentExcused: 0, late: 0, unspecified: 0, warningCount: 0, totalSessions: 0 };
      const studyMins = studyAggregations.minutesMap[student.id] || (42 * 60);
      const studyWarn = studyAggregations.warningMap[student.id] || false;
      const cGrades = counselingAggregations[student.id] || { countA: 2, countB: 1, countC: 0, countD: 0, countAbsence: 0, total: 3 };
      const loansInfo = financialInstallmentsMap[student.id] || { totalActive: 0, monthlyDeduction: 0 };

      // Life Status
      const isMarried = student.maritalStatus === 'متاهل' || !!prof?.isMarried;
      const childrenCount = student.childrenCount || prof?.childrenCount || 0;
      const isRobed = student.tammomStatus === 'معمم' || !!prof?.isRobed || !!prof?.isTammam;
      const livingStatus = student.livingStatus || prof?.livingStatus || 'پدری';

      // Check for Manual Overrides for this student
      const ov = studentOverrides[student.id];

      // 1. Base Tuition
      let baseAmount = 0;
      if (ov?.overrideBaseTuition !== undefined) {
        baseAmount = ov.overrideBaseTuition;
      } else if (settings.isBaseTuitionEqualForMarried) {
        baseAmount = settings.singleBaseTuition || settings.baseSingleTuition || 2000000;
      } else {
        baseAmount = isMarried
          ? (settings.marriedBaseTuition || settings.baseMarriedTuition || 3200000)
          : (settings.singleBaseTuition || settings.baseSingleTuition || 2000000);
      }

      // 2. Marital Bonus
      let maritalBonus = 0;
      if (isMarried && settings.hasMarriageBonus) {
        if (settings.marriageBonusType === 'percentage') {
          maritalBonus = Math.round(baseAmount * ((settings.marriageBonusPercent || 25) / 100));
        } else if (settings.marriageBonusAmount) {
          maritalBonus = settings.marriageBonusAmount;
        } else {
          maritalBonus = Math.max(0, (settings.baseMarriedTuition || 0) - (settings.baseSingleTuition || 0));
        }
      }

      // 3. Child Allowance
      const childAllowanceTotal = (settings.hasChildAllowance && childrenCount > 0)
        ? childrenCount * (settings.childAllowancePerChild || settings.childAllowance || 350000)
        : 0;

      // 4. Robed Bonus
      const turbanAllowance = (settings.hasTurbanAllowance && isRobed)
        ? (settings.turbanAllowance || settings.clericalHabitBonus || 500000)
        : 0;

      // 5. Housing Allowance
      let housingAllowance = 0;
      if (settings.hasHousingAllowance) {
        if (livingStatus === 'اجاره ای') {
          housingAllowance = settings.housingAllowanceRented || settings.housingSubsidy || 600000;
        } else if (livingStatus === 'خوابگاه') {
          housingAllowance = settings.housingAllowanceDorm || 250000;
        }
      }

      // 6. Study Bonus & Penalty
      const mandatoryMins = studyAggregations.mandatoryMinutes;
      const avgMins = studyAggregations.avgMinutes;
      const studyDiff = studyMins - mandatoryMins;
      const isAboveStudyRequired = studyDiff > 0;
      const isAboveStudyAverage = studyMins >= avgMins;

      // مبنای پاداش: موظفی یا میانگین
      const bonusBaseMins = settings.studyBonusBase === 'average' ? avgMins : mandatoryMins;
      const bonusDiffMins = Math.max(0, studyMins - bonusBaseMins);

      let studyBonusAmount = 0;
      if (ov?.overrideStudyBonus !== undefined) {
        studyBonusAmount = ov.overrideStudyBonus;
      } else if (settings.studyBonusEnabled && bonusDiffMins > 0) {
        if (settings.studyBonusTiered && settings.studyBonusTiers && settings.studyBonusTiers.length > 0) {
          // محاسبه پله‌ای تجمعی پاداش مطالعه
          let cumulativeBonus = 0;
          const sortedTiers = [...settings.studyBonusTiers].sort((a, b) => a.minMinutes - b.minMinutes);
          for (const tier of sortedTiers) {
            if (bonusDiffMins >= tier.minMinutes) {
              cumulativeBonus += Number(tier.amount || 0);
            }
          }
          studyBonusAmount = cumulativeBonus;
        } else {
          const threshold = settings.studyBonusThresholdMinutes || 0;
          const aboveThresholdMinutes = Math.max(0, bonusDiffMins - threshold);
          if (aboveThresholdMinutes > 0) {
            if (settings.studyBonusCalculationType === 'fixed') {
              studyBonusAmount = settings.studyBonusFixedAmount || 150000;
            } else {
              const hours = aboveThresholdMinutes / 60;
              const rate = settings.studyBonusRatePerHour || settings.studyBonusPerHour || 30000;
              studyBonusAmount = Math.round(hours * rate);
            }
          }
        }
      }

      // مبنای جریمه: موظفی یا میانگین
      const penaltyBaseMins = settings.studyPenaltyBase === 'average' ? avgMins : mandatoryMins;
      const deficitMinutes = Math.max(0, penaltyBaseMins - studyMins);

      let studyPenaltyAmount = 0;
      if (settings.studyPenaltyEnabled && deficitMinutes > 0) {
        if (settings.studyPenaltyTiered && settings.studyPenaltyTiers && settings.studyPenaltyTiers.length > 0) {
          // محاسبه پله‌ای تجمعی جریمه مطالعه
          let cumulativePenalty = 0;
          const sortedTiers = [...settings.studyPenaltyTiers].sort((a, b) => a.minMinutes - b.minMinutes);
          for (const tier of sortedTiers) {
            if (deficitMinutes >= tier.minMinutes) {
              cumulativePenalty += Number(tier.amount || 0);
            }
          }
          studyPenaltyAmount = cumulativePenalty;
        } else {
          if (settings.studyPenaltyCalculationType === 'fixed') {
            studyPenaltyAmount = settings.studyPenaltyFixedAmount || 100000;
          } else {
            const hours = deficitMinutes / 60;
            const rate = settings.studyPenaltyRatePerHour || settings.studyPenaltyPerHour || 25000;
            studyPenaltyAmount = Math.round(hours * rate);
          }
        }
      }

      // 7. Attendance Penalties
      let absencePenaltyAmount = 0;
      if (settings.absenceDeductionEnabled && !ov?.ignoreAbsencePenalty) {
        if (settings.absenceDeductionMode === 'both_different') {
          const unexcusedCost = att.absentUnexcused * (settings.absencePenaltyUnexcusedAmount || settings.absencePenaltyPerSession || 90000);
          const excusedCost = att.absentExcused * (settings.absencePenaltyExcusedAmount || 25000);
          absencePenaltyAmount = unexcusedCost + excusedCost;
        } else {
          if (settings.absencePenaltyUnexcusedType === 'percentage') {
            absencePenaltyAmount = Math.round(baseAmount * ((settings.absencePenaltyUnexcusedPercent || 4) / 100) * att.absentUnexcused);
          } else {
            absencePenaltyAmount = att.absentUnexcused * (settings.absencePenaltyUnexcusedAmount || settings.absencePenaltyPerSession || 90000);
          }
        }
      }

      // 8. Counseling Bonus
      const gradeABonus = (cGrades.countA || 0) * (settings.counselingGradeABonus || 30000);
      const gradeBBonus = (cGrades.countB || 0) * (settings.counselingGradeBBonus || 15000);
      const gradeCBonus = (cGrades.countC || 0) * (settings.counselingGradeCBonus || 0);
      const counselingBonusAmount = gradeABonus + gradeBBonus + gradeCBonus;

      // 9. Manual Adjustments (افزایش / کاهش دستی و علت)
      const manualAdjustmentAmount = ov?.manualAdjustmentAmount ?? (prof?.manualAdjustmentAmount || 0);
      const manualAdjustmentReason = ov?.manualAdjustmentReason ?? (prof?.manualAdjustmentReason || '');

      // ==============================================================
      // TYPE 1 DEDUCTIONS (کسورات مستقیم از شهریه)
      // غیبت‌ها و جریمه مطالعه که از استحقاقی کسر شده و تمام می‌شود
      // ==============================================================
      const type1DeductionsTotal = studyPenaltyAmount + absencePenaltyAmount + (manualAdjustmentAmount < 0 ? Math.abs(manualAdjustmentAmount) : 0);
      const totalAdditions = maritalBonus + childAllowanceTotal + turbanAllowance + housingAllowance + studyBonusAmount + counselingBonusAmount + (manualAdjustmentAmount > 0 ? manualAdjustmentAmount : 0);
      
      // شهریه استحقاقی خالص (مبلغ فاکتور مصوب ارسالی به بالادستی)
      const grossEarnedTuition = Math.max(0, baseAmount + maritalBonus + childAllowanceTotal + turbanAllowance + housingAllowance + studyBonusAmount + counselingBonusAmount - (studyPenaltyAmount + absencePenaltyAmount) + manualAdjustmentAmount);

      // ==============================================================
      // TYPE 2 DEDUCTIONS (کسورات انتقالی و واریز به حساب‌های مقصد)
      // ==============================================================
      
      // 1. سهم آشپزخانه (نهار و شام)
      let kitchenTransferAmount = 0;
      const studentMealRes = mealReservations.find(mr => mr.studentId === student.id);
      const studentLunchItem = lunchItems.find(li => li.studentId === student.id);

      if (studentMealRes) {
        kitchenTransferAmount = studentMealRes.finalDeductionAmount || studentMealRes.totalMealCost || 0;
      } else if (studentLunchItem) {
        const count = studentLunchItem.monthlyMealsCount || 0;
        const price = studentLunchItem.mealPrice || settings.dailyLunchCost || 45000;
        const discount = studentLunchItem.subsidyDiscount || 0;
        kitchenTransferAmount = Math.max(0, (count * price) - discount);
      } else {
        const lunchDaysCount = prof?.monthlyLunchDays ?? prof?.lunchDaysCount ?? 20;
        const dinnerDaysCount = prof?.monthlyDinnerDays ?? prof?.dinnerDaysCount ?? 0;
        const lunchTotal = lunchDaysCount * (settings.dailyLunchCost || settings.lunchCostPerDay || 45000);
        const dinnerTotal = dinnerDaysCount * (settings.dailyDinnerCost || settings.dinnerCostPerDay || 35000);
        kitchenTransferAmount = lunchTotal + dinnerTotal;
      }

      // 2. سهم وام فعال صندوق قرض‌الحسنه
      const activeLoanMonthly = loansInfo.monthlyDeduction || prof?.activeLoanInstallment || 0;
      const loanInstallmentDeduction = settings.deductActiveLoans ? activeLoanMonthly : 0;

      // 3. سهم پس‌انداز و کمک ماهانه به صندوق
      const fundContributionMonthly = prof?.fundContributionMonthly ?? prof?.fundContribution ?? settings.defaultFundContribution ?? 100000;
      const fundContributionDeduction = settings.deductFundContribution ? fundContributionMonthly : 0;

      // 4. مطالبات ثبت‌شده و تفکیک مقاصد واریز
      const studentActiveClaims = claimsList.filter(c => 
        c.studentId === student.id && 
        c.status === 'active' && 
        (c.remainingAmount ?? c.totalDebtAmount) > 0 &&
        (!settings.enabledClaimCategoryIds || settings.enabledClaimCategoryIds.length === 0 || settings.enabledClaimCategoryIds.includes(c.claimCategoryId))
      );

      let culturalTransferAmount = 0;
      let qardFundClaimsAmount = 0;
      let otherTransferAmount = 0;

      const claimsDeductions = studentActiveClaims.map(claim => {
        const amount = Math.min(claim.monthlyDeductionAmount || 0, claim.remainingAmount ?? claim.totalDebtAmount);
        const titleLower = (claim.claimTitle + ' ' + (claim.destinationAccountTitle || '')).toLowerCase();

        if (titleLower.includes('فرهنگی') || titleLower.includes('عتبات') || titleLower.includes('اردو') || titleLower.includes('کربلا') || titleLower.includes('مشهد')) {
          culturalTransferAmount += amount;
        } else if (titleLower.includes('صندوق') || titleLower.includes('وام') || titleLower.includes('قرض')) {
          qardFundClaimsAmount += amount;
        } else {
          otherTransferAmount += amount;
        }

        return {
          claimId: claim.id,
          title: claim.claimTitle,
          amount,
          destinationAccountId: claim.destinationAccountId,
          destinationTitle: claim.destinationAccountTitle || 'حساب مقصد',
          bankInfo: claim.destinationBankInfo
        };
      });

      // Total Qard Fund = Loans + Contribution + Fund Claims
      const qardFundTransferAmount = loanInstallmentDeduction + fundContributionDeduction + qardFundClaimsAmount;

      // Total Type 2 Deductions
      const type2DeductionsTotal = kitchenTransferAmount + culturalTransferAmount + qardFundTransferAmount + otherTransferAmount;
      const totalDeductions = type1DeductionsTotal + type2DeductionsTotal;

      // Net payable to student's bank account
      const netPayableTuition = Math.max(0, grossEarnedTuition - type2DeductionsTotal);

      return {
        studentId: student.id,
        studentName: student.name,
        nationalId: student.nationalId,
        instituteCode: student.instituteCode,
        phoneNumber: student.phoneNumber,
        grade: student.grade || '',
        periodTitle: newPeriodTitle,
        maritalStatus: isMarried ? 'متاهل' : 'مجرد',
        childrenCount,
        livingStatus,
        isTammam: isRobed,
        bankAccount: student.bankAccount1 || prof?.bankAccount,
        bankSheba: student.bankSheba1 || prof?.bankSheba,
        tuitionCode: student.tuitionCode,
        baseTuition: baseAmount,
        baseAmount,
        maritalBonus,
        childAllowanceTotal,
        childAllowance: childAllowanceTotal,
        turbanAllowance,
        robedBonus: turbanAllowance,
        housingAllowance,
        studyMinutesTotal: studyMins,
        studyRequiredMinutes: mandatoryMins,
        studyDiffMinutes: studyDiff,
        isAboveStudyRequired,
        isAboveStudyAverage,
        studyWarningIssued: studyWarn,
        studyBonusAmount,
        studyBonus: studyBonusAmount,
        studyPenaltyAmount,
        totalPresentSessions: att.present,
        totalAbsentSessions: att.absentUnexcused + att.absentExcused,
        unexcusedAbsenceCount: att.absentUnexcused,
        excusedAbsenceCount: att.absentExcused,
        totalLateSessions: att.late,
        totalUnspecifiedSessions: att.unspecified,
        totalEducationalWarnings: att.warningCount,
        absencePenaltyAmount,
        absenceDeduction: absencePenaltyAmount,
        counselingGradeACount: cGrades.countA,
        counselingGradeBCount: cGrades.countB,
        counselingGradeCCount: cGrades.countC,
        counselingGradeDCount: cGrades.countD,
        counselingBonusAmount,
        
        // Type 1 Deductions
        type1DeductionsTotal,
        grossEarnedTuition,

        // Type 2 Deductions & Destination Transfers
        lunchDaysCount: prof?.monthlyLunchDays ?? 20,
        lunchDeductionAmount: kitchenTransferAmount,
        lunchDeduction: kitchenTransferAmount,
        kitchenTransferAmount,
        culturalTransferAmount,
        qardFundTransferAmount,
        otherTransferAmount,
        loanInstallmentDeduction,
        loanDeduction: loanInstallmentDeduction,
        fundContributionDeduction,
        fundDeduction: fundContributionDeduction,
        claimsDeductions,
        claimsTotalDeduction: culturalTransferAmount + qardFundClaimsAmount + otherTransferAmount,
        type2DeductionsTotal,

        // Totals
        totalAdditions,
        totalEarnings: totalAdditions,
        totalDeductions,
        netPayableTuition,
        netPayable: netPayableTuition
      };
    });
  }, [
    filteredStudents, 
    profiles, 
    attendanceAggregations, 
    studyAggregations, 
    counselingAggregations, 
    financialInstallmentsMap, 
    settings, 
    newPeriodTitle,
    mealReservations,
    lunchItems,
    claimsList,
    studentOverrides
  ]);

  // Aggregate Metrics for Current Calculation
  const totalGrossTuitionSum = useMemo(() => {
    return calculatedTuitions.reduce((acc, curr) => acc + (curr.grossEarnedTuition || 0), 0);
  }, [calculatedTuitions]);

  const totalKitchenTransferSum = useMemo(() => {
    return calculatedTuitions.reduce((acc, curr) => acc + (curr.kitchenTransferAmount || 0), 0);
  }, [calculatedTuitions]);

  const totalCulturalTransferSum = useMemo(() => {
    return calculatedTuitions.reduce((acc, curr) => acc + (curr.culturalTransferAmount || 0), 0);
  }, [calculatedTuitions]);

  const totalQardFundTransferSum = useMemo(() => {
    return calculatedTuitions.reduce((acc, curr) => acc + (curr.qardFundTransferAmount || 0), 0);
  }, [calculatedTuitions]);

  const totalOtherTransferSum = useMemo(() => {
    return calculatedTuitions.reduce((acc, curr) => acc + (curr.otherTransferAmount || 0), 0);
  }, [calculatedTuitions]);

  const totalNetPayoutSum = useMemo(() => {
    return calculatedTuitions.reduce((acc, curr) => acc + (curr.netPayableTuition || 0), 0);
  }, [calculatedTuitions]);

  const totalType2DeductionsSum = useMemo(() => {
    return calculatedTuitions.reduce((acc, curr) => acc + (curr.type2DeductionsTotal || 0), 0);
  }, [calculatedTuitions]);

  const totalType1DeductionsSum = useMemo(() => {
    return calculatedTuitions.reduce((acc, curr) => acc + (curr.type1DeductionsTotal || 0), 0);
  }, [calculatedTuitions]);

  const isFinancialReconciled = totalGrossTuitionSum === (totalNetPayoutSum + totalKitchenTransferSum + totalCulturalTransferSum + totalQardFundTransferSum + totalOtherTransferSum);

  // -------------------------------------------------------------
  // Confirm Period Range & Enter Active Calculation Session
  // -------------------------------------------------------------
  const handleConfirmPeriodRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPeriodTitle.trim()) {
      alert('لطفاً عنوان دوره شهریه را وارد کنید.');
      return;
    }

    setStartDate(newPeriodStartDate);
    setEndDate(newPeriodEndDate);
    setIsNewPeriodModalOpen(false);
    setPageMode('active_period');
    setCurrentSubTab('activity_info');
    showToast(`دوره شهریه «${newPeriodTitle}» با موفقیت تنظیم شد. اکنون می‌توانید اطلاعات طلاب را بررسی فرمایید.`);
  };

  // Finalize & Archive Current Calculation
  const handleFinalizeTuitionPeriod = async () => {
    if (!newPeriodTitle.trim()) {
      showToast('لطفاً عنوان دوره شهریه را وارد کنید.');
      return;
    }

    setIsFinalizing(true);
    try {
      const periodId = `period-${Date.now()}`;
      const finalizedDoc: TuitionPeriod = {
        id: periodId,
        title: newPeriodTitle,
        startDate,
        endDate,
        status: 'finalized',
        totalStudentsCalculated: calculatedTuitions.length,
        totalPayoutAmount: totalNetPayoutSum,
        calculations: calculatedTuitions,
        createdAt: new Date().toISOString(),
        createdByName: currentUser?.fullName || currentUser?.name || currentUser?.username,
        finalizedAt: new Date().toISOString(),
        finalizedByName: currentUser?.fullName || currentUser?.name || currentUser?.username
      };

      // 1. Save finalized period document
      await localDb.setDoc('tuition_periods', finalizedDoc);

      // 2. Prepare fund donations in bulk
      const fundDocsToSave: any[] = [];
      for (const calc of calculatedTuitions) {
        const fundAmount = calc.fundContributionDeduction || calc.fundDeduction || 0;
        if (fundAmount > 0) {
          fundDocsToSave.push({
            id: `fund-don-${calc.studentId}-${periodId}`,
            personId: calc.studentId,
            personType: 'student',
            personName: calc.studentName,
            amount: fundAmount,
            periodTitle: newPeriodTitle,
            deductionDate: getTodayShamsi(),
            isConfirmed: true,
            confirmedAt: new Date().toISOString(),
            confirmedByName: currentUser?.fullName || currentUser?.name || currentUser?.username
          });
        }
      }

      if (fundDocsToSave.length > 0) {
        await localDb.bulkPut('fund_donations', fundDocsToSave);
      }

      // 3. Deduct paid debts from claimsList and save in bulk
      const updatedClaimsMap = new Map<string, StudentClaimRecord>();
      for (const calc of calculatedTuitions) {
        const debtDeducted = (calc.culturalTransferAmount || 0) + (calc.otherTransferAmount || 0);
        if (debtDeducted > 0) {
          const studentClaims = claimsList.filter(c => c.studentId === calc.studentId && (c.remainingAmount || 0) > 0);
          let remDeduct = debtDeducted;
          for (const clm of studentClaims) {
            if (remDeduct <= 0) break;
            const currentRem = clm.remainingAmount ?? clm.totalDebtAmount;
            const apply = Math.min(remDeduct, currentRem);
            const updatedClm: StudentClaimRecord = {
              ...clm,
              paidAmount: (clm.paidAmount || 0) + apply,
              remainingAmount: Math.max(0, currentRem - apply),
              status: (currentRem - apply) <= 0 ? 'completed' as const : 'active' as const
            };
            updatedClaimsMap.set(updatedClm.id, updatedClm);
            remDeduct -= apply;
          }
        }
      }

      const claimsToUpdate = Array.from(updatedClaimsMap.values());
      if (claimsToUpdate.length > 0) {
        await localDb.bulkPut('student_claims', claimsToUpdate);
        try {
          await localDb.bulkPut('finance_student_claims', claimsToUpdate);
        } catch (e) {}
      }

      // 4. Deduct paid loan installments from active loans in finance_loans
      const updatedLoansMap = new Map<string, any>();
      for (const calc of calculatedTuitions) {
        const loanDeduct = calc.loanInstallmentDeduction || calc.loanDeduction || 0;
        if (loanDeduct > 0) {
          const studentLoans = loans.filter(l => l.studentId === calc.studentId && l.status === 'active' && ((l.remainingBalance ?? l.remainingAmount ?? l.amount ?? 0) > 0));
          let rem = loanDeduct;
          for (const l of studentLoans) {
            if (rem <= 0) break;
            const currentRem = l.remainingBalance ?? l.remainingAmount ?? l.amount ?? 0;
            const apply = Math.min(rem, currentRem);
            const updatedLoan = {
              ...l,
              paidInstallments: (l.paidInstallments || 0) + 1,
              remainingBalance: Math.max(0, currentRem - apply),
              status: (currentRem - apply) <= 0 ? 'settled' : 'active'
            };
            updatedLoansMap.set(l.id, updatedLoan);
            rem -= apply;
          }
        }
      }
      const loansToUpdate = Array.from(updatedLoansMap.values());
      if (loansToUpdate.length > 0) {
        await localDb.bulkPut('finance_loans', loansToUpdate);
      }

      setTuitionPeriods(prev => [finalizedDoc, ...prev]);
      setSelectedArchivedPeriod(finalizedDoc);
      setIsFinalizeWarningModalOpen(false);
      setPageMode('archived_periods');
      showToast(`دوره شهریه «${newPeriodTitle}» با موفقیت نهایی و در پایگاه داده ذخیره شد.`);
    } catch (err: any) {
      console.error('Error finalizing tuition period:', err);
      showToast(`خطا در ثبت نهایی دوره در پایگاه داده: ${err?.message || 'مشکل در ارتباط با سرور'}`);
    } finally {
      setIsFinalizing(false);
    }
  };

  // Delete Archived Period
  const handleDeleteArchivedPeriod = async (periodId: string, title: string) => {
    if (!window.confirm(`آیا از حذف دوره شهریه بایگانی شده «${title}» اطمینان دارید؟`)) return;
    await localDb.deleteDoc('tuition_periods', periodId);
    setTuitionPeriods(prev => prev.filter(p => p.id !== periodId));
    if (selectedArchivedPeriod?.id === periodId) {
      setSelectedArchivedPeriod(null);
    }
    showToast(`دوره بایگانی «${title}» با موفقیت حذف گردید.`);
  };

  // -------------------------------------------------------------
  // 1. Export Excel for Upper Management & Bank Transfers
  // -------------------------------------------------------------
  const handleExportUpperManagementExcel = () => {
    try {
      const rows = calculatedTuitions.map((item, index) => ({
        'ردیف': index + 1,
        'نام و نام خانوادگی طلبه': item.studentName,
        'پایه': item.grade,
        'کد ملی': item.nationalId || '-',
        'شماره شبا (بانک)': item.bankSheba || item.bankAccount || '-',
        'شهریه استحقاقی مصوب (فاکتور بالادستی)': item.grossEarnedTuition || 0,
        'کسر واریز به حساب آشپزخانه (نهار/شام)': item.kitchenTransferAmount || 0,
        'کسر واریز به امور فرهنگی (عتبات/اردو)': item.culturalTransferAmount || 0,
        'کسر واریز به صندوق قرض‌الحسنه (وام/پس‌انداز)': item.qardFundTransferAmount || 0,
        'کسر واریز به سایر حساب‌ها': item.otherTransferAmount || 0,
        'جمع کسورات و حواله‌های انتقالی': item.type2DeductionsTotal || 0,
        'خالص واریزی به حساب بانکی طلبه': item.netPayableTuition || 0
      }));

      // Append Summary / Balance Row
      rows.push({
        'ردیف': 'جمع کل' as any,
        'نام و نام خانوادگی طلبه': `تعداد: ${calculatedTuitions.length} نفر`,
        'پایه': '-',
        'کد ملی': '-',
        'شماره شبا (بانک)': '-',
        'شهریه استحقاقی مصوب (فاکتور بالادستی)': totalGrossTuitionSum,
        'کسر واریز به حساب آشپزخانه (نهار/شام)': totalKitchenTransferSum,
        'کسر واریز به امور فرهنگی (عتبات/اردو)': totalCulturalTransferSum,
        'کسر واریز به صندوق قرض‌الحسنه (وام/پس‌انداز)': totalQardFundTransferSum,
        'کسر واریز به سایر حساب‌ها': totalOtherTransferSum,
        'جمع کسورات و حواله‌های انتقالی': totalType2DeductionsSum,
        'خالص واریزی به حساب بانکی طلبه': totalNetPayoutSum
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'صورت‌وضعیت بالادستی و حواله‌ها');
      const fileName = `صورت_وضعیت_بالادستی_شهریه_${startDate.replace(/\//g, '-')}_تا_${endDate.replace(/\//g, '-')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      showToast('فایل اکسل رسمی بالادستی و حواله‌های تفکیکی با موفقیت صادر شد.');
    } catch (err) {
      console.error('Export upper management excel error:', err);
      alert('خطا در صدور فایل اکسل بالادستی.');
    }
  };

  // -------------------------------------------------------------
  // 2. Export Excel for Internal School Detailed Audit
  // -------------------------------------------------------------
  const handleExportInternalExcel = () => {
    try {
      const rows = calculatedTuitions.map((item, index) => ({
        'ردیف': index + 1,
        'نام طلبه': item.studentName,
        'پایه': item.grade,
        'کد ملی': item.nationalId || '-',
        'شماره حساب/شبا': item.bankSheba || item.bankAccount || '-',
        'وضعیت تاهل': item.maritalStatus,
        'تعداد فرزند': item.childrenCount || 0,
        'معمم': item.isTammam ? 'بله' : 'خیر',
        'سکونت': item.livingStatus || 'پدری',
        'شهریه پایه': item.baseTuition,
        'پاداش تاهل': item.maritalBonus,
        'حق اولاد': item.childAllowanceTotal,
        'پاداش تلبس': item.turbanAllowance,
        'کمک مسکن': item.housingAllowance,
        'ساعات مطالعه (دقیقه)': item.studyMinutesTotal,
        'پاداش مطالعه': item.studyBonusAmount,
        'جریمه مطالعه (نوع ۱)': item.studyPenaltyAmount,
        'غیبت غیرموجه': item.unexcusedAbsenceCount,
        'جریمه غیبت (نوع ۱)': item.absencePenaltyAmount,
        'جمع کسورات نوع ۱': item.type1DeductionsTotal || 0,
        'شهریه استحقاقی (فاکتور بالادستی)': item.grossEarnedTuition || 0,
        'کسر نهار/شام (نوع ۲)': item.kitchenTransferAmount || 0,
        'کسر عتبات/اردو (نوع ۲)': item.culturalTransferAmount || 0,
        'قسط وام و صندوق (نوع ۲)': item.qardFundTransferAmount || 0,
        'سایر کسورات نوع ۲': item.otherTransferAmount || 0,
        'جمع کسورات نوع ۲': item.type2DeductionsTotal || 0,
        'خالص پرداختی نهایی به طلبه': item.netPayableTuition
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'گزارش تفصیلی داخلی شهریه');
      const fileName = `گزارش_تفصیلی_داخلی_شهریه_${startDate.replace(/\//g, '-')}_تا_${endDate.replace(/\//g, '-')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      showToast('فایل اکسل گزارش تفصیلی داخلی با موفقیت صادر شد.');
    } catch (err) {
      console.error('Export internal excel error:', err);
      alert('خطا در صدور فایل اکسل تفصیلی.');
    }
  };

  // -------------------------------------------------------------
  // Archived Period Helpers: Detailed Excel Export, Upper Export, and Save Changes
  // -------------------------------------------------------------
  const handleExportArchivedDetailedExcel = () => {
    if (!selectedArchivedPeriod) return;
    try {
      const calcs = selectedArchivedPeriod.calculations || [];
      const rows = calcs.map((item, index) => ({
        'ردیف': index + 1,
        'نام طلبه': item.studentName,
        'پایه': item.grade,
        'کد ملی': item.nationalId || '-',
        'شماره حساب/شبا': item.bankSheba || item.bankAccount || '-',
        'وضعیت تاهل': item.maritalStatus,
        'تعداد فرزند': item.childrenCount || 0,
        'معمم': item.isTammam ? 'بله' : 'خیر',
        'سکونت': item.livingStatus || 'پدری',
        'شهریه پایه': item.baseTuition || 0,
        'پاداش تاهل': item.maritalBonus || 0,
        'حق اولاد': item.childAllowanceTotal || 0,
        'پاداش تلبس': item.turbanAllowance || 0,
        'کمک مسکن': item.housingAllowance || 0,
        'ساعات مطالعه (دقیقه)': item.studyMinutesTotal || 0,
        'پاداش مطالعه': item.studyBonusAmount || 0,
        'جریمه مطالعه (نوع ۱)': item.studyPenaltyAmount || 0,
        'غیبت غیرموجه': item.unexcusedAbsenceCount || 0,
        'جریمه غیبت (نوع ۱)': item.absencePenaltyAmount || 0,
        'جمع کسورات نوع ۱': item.type1DeductionsTotal || 0,
        'شهریه استحقاقی (فاکتور بالادستی)': item.grossEarnedTuition || 0,
        'کسر نهار/شام (نوع ۲)': item.kitchenTransferAmount || 0,
        'کسر عتبات/اردو (نوع ۲)': item.culturalTransferAmount || 0,
        'قسط وام و صندوق (نوع ۲)': item.qardFundTransferAmount || 0,
        'سایر کسورات نوع ۲': item.otherTransferAmount || 0,
        'افزایش/کاهش دستی': item.manualAdjustmentAmount || 0,
        'علت تعدیل دستی': item.manualAdjustmentReason || '',
        'جمع کسورات نوع ۲': item.type2DeductionsTotal || 0,
        'خالص پرداختی نهایی به طلبه': item.netPayableTuition || 0
      }));

      const totalGross = calcs.reduce((acc, c) => acc + (c.grossEarnedTuition || 0), 0);
      const totalNet = calcs.reduce((acc, c) => acc + (c.netPayableTuition || 0), 0);
      const totalType1 = calcs.reduce((acc, c) => acc + (c.type1DeductionsTotal || 0), 0);
      const totalType2 = calcs.reduce((acc, c) => acc + (c.type2DeductionsTotal || 0), 0);
      const totalKitchen = calcs.reduce((acc, c) => acc + (c.kitchenTransferAmount || 0), 0);
      const totalQard = calcs.reduce((acc, c) => acc + (c.qardFundTransferAmount || 0), 0);

      rows.push({
        'ردیف': 'جمع کل' as any,
        'نام طلبه': `تعداد: ${calcs.length} نفر`,
        'پایه': '-',
        'کد ملی': '-',
        'شماره حساب/شبا': '-',
        'وضعیت تاهل': '-' as any,
        'تعداد فرزند': '-' as any,
        'معمم': '-',
        'سکونت': '-',
        'شهریه پایه': '-' as any,
        'پاداش تاهل': '-' as any,
        'حق اولاد': '-' as any,
        'پاداش تلبس': '-' as any,
        'کمک مسکن': '-' as any,
        'ساعات مطالعه (دقیقه)': '-' as any,
        'پاداش مطالعه': '-' as any,
        'جریمه مطالعه (نوع ۱)': '-' as any,
        'غیبت غیرموجه': '-' as any,
        'جریمه غیبت (نوع ۱)': '-' as any,
        'جمع کسورات نوع ۱': totalType1,
        'شهریه استحقاقی (فاکتور بالادستی)': totalGross,
        'کسر نهار/شام (نوع ۲)': totalKitchen,
        'کسر عتبات/اردو (نوع ۲)': '-' as any,
        'قسط وام و صندوق (نوع ۲)': totalQard,
        'سایر کسورات نوع ۲': '-' as any,
        'افزایش/کاهش دستی': '-' as any,
        'علت تعدیل دستی': '',
        'جمع کسورات نوع ۲': totalType2,
        'خالص پرداختی نهایی به طلبه': totalNet
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'گزارش تفصیلی بایگانی');
      const fileName = `گزارش_تفصیلی_${(selectedArchivedPeriod.title || 'شهریه').replace(/\s+/g, '_')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      showToast('فایل اکسل جامع با تمامی جزئیات صادر گردید.');
    } catch (err) {
      console.error('Export archived detailed excel error:', err);
      alert('خطا در صدور فایل اکسل.');
    }
  };

  const handleExportArchivedUpperManagementExcel = () => {
    if (!selectedArchivedPeriod) return;
    try {
      const calcs = selectedArchivedPeriod.calculations || [];
      const rows = calcs.map((item, index) => ({
        'ردیف': index + 1,
        'نام و نام خانوادگی طلبه': item.studentName,
        'پایه': item.grade,
        'کد ملی': item.nationalId || '-',
        'شماره شبا / حساب بانکی': item.bankSheba || item.bankAccount || '-',
        'شهریه استحقاقی مصوب (فاکتور بالادستی)': item.grossEarnedTuition || 0,
        'کسر واریز به حساب آشپزخانه (نهار)': item.kitchenTransferAmount || 0,
        'کسر واریز به امور فرهنگی': item.culturalTransferAmount || 0,
        'کسر واریز به صندوق قرض‌الحسنه': item.qardFundTransferAmount || 0,
        'کسر واریز به سایر حساب‌ها': item.otherTransferAmount || 0,
        'افزایش/کاهش دستی': item.manualAdjustmentAmount || 0,
        'جمع کل کسورات': item.type2DeductionsTotal || 0,
        'خالص واریزی به حساب بانکی طلبه': item.netPayableTuition || 0
      }));

      const totalGross = calcs.reduce((acc, c) => acc + (c.grossEarnedTuition || 0), 0);
      const totalNet = calcs.reduce((acc, c) => acc + (c.netPayableTuition || 0), 0);
      const totalType2 = calcs.reduce((acc, c) => acc + (c.type2DeductionsTotal || 0), 0);

      rows.push({
        'ردیف': 'جمع کل' as any,
        'نام و نام خانوادگی طلبه': `تعداد: ${calcs.length} نفر`,
        'پایه': '-',
        'کد ملی': '-',
        'شماره شبا / حساب بانکی': '-',
        'شهریه استحقاقی مصوب (فاکتور بالادستی)': totalGross,
        'کسر واریز به حساب آشپزخانه (نهار)': '-' as any,
        'کسر واریز به امور فرهنگی': '-' as any,
        'کسر واریز به صندوق قرض‌الحسنه': '-' as any,
        'کسر واریز به سایر حساب‌ها': '-' as any,
        'افزایش/کاهش دستی': '-' as any,
        'جمع کل کسورات': totalType2,
        'خالص واریزی به حساب بانکی طلبه': totalNet
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'صورت‌وضعیت واریزی بالادستی');
      const fileName = `صورت‌وضعیت_واریزی_${(selectedArchivedPeriod.title || 'شهریه').replace(/\s+/g, '_')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      showToast('فایل اکسل حواله‌های بالادستی با موفقیت صادر شد.');
    } catch (err) {
      console.error('Export archived upper excel error:', err);
      alert('خطا در صدور فایل اکسل.');
    }
  };

  const handleSaveArchivedPeriodChanges = async () => {
    if (!selectedArchivedPeriod) return;
    try {
      const updatedTotalNet = (selectedArchivedPeriod.calculations || []).reduce((acc, c) => acc + (c.netPayableTuition || 0), 0);
      const updatedDoc: TuitionPeriod = {
        ...selectedArchivedPeriod,
        totalPayoutAmount: updatedTotalNet,
        totalStudentsCalculated: (selectedArchivedPeriod.calculations || []).length,
        finalizedAt: new Date().toISOString(),
        finalizedByName: currentUser?.fullName || currentUser?.name || currentUser?.username || 'مسئول مالی'
      };

      await localDb.setDoc('tuition_periods', updatedDoc);
      setTuitionPeriods(prev => prev.map(p => p.id === updatedDoc.id ? updatedDoc : p));
      setSelectedArchivedPeriod(updatedDoc);
      setIsArchivedModified(false);
      showToast('تغییرات دوره بایگانی با موفقیت ذخیره گردید.');
    } catch (err) {
      console.error('Save archived period changes error:', err);
      alert('خطا در ذخیره تغییرات دوره بایگانی.');
    }
  };

  const handleUpdateArchivedItemAdjustment = (studentId: string, amount: number | undefined, reason: string | undefined) => {
    if (!selectedArchivedPeriod) return;
    const updatedCalcs = (selectedArchivedPeriod.calculations || []).map(calc => {
      if (calc.studentId === studentId) {
        const manualAdj = amount !== undefined ? (amount || 0) : (calc.manualAdjustmentAmount || 0);
        const reasonText = reason !== undefined ? reason : (calc.manualAdjustmentReason || '');
        const gross = calc.grossEarnedTuition || 0;
        const deductions2 = calc.type2DeductionsTotal || 0;
        const net = Math.max(0, gross + manualAdj - deductions2);
        return {
          ...calc,
          manualAdjustmentAmount: amount !== undefined ? amount : calc.manualAdjustmentAmount,
          manualAdjustmentReason: reasonText,
          netPayableTuition: net
        };
      }
      return calc;
    });

    setSelectedArchivedPeriod({
      ...selectedArchivedPeriod,
      calculations: updatedCalcs
    });
    setIsArchivedModified(true);
  };

  const handleDeleteArchivedStudentRow = (studentId: string, studentName: string) => {
    if (!selectedArchivedPeriod) return;
    if (!window.confirm(`آیا از حذف اطلاعات «${studentName}» از این دوره بایگانی اطمینان دارید؟`)) return;
    const updatedCalcs = (selectedArchivedPeriod.calculations || []).filter(c => c.studentId !== studentId);
    setSelectedArchivedPeriod({
      ...selectedArchivedPeriod,
      calculations: updatedCalcs
    });
    setIsArchivedModified(true);
    showToast(`اطلاعات ${studentName} از دوره حذف گردید.`);
  };

  // Print slip handler
  const handlePrintSlip = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="p-10 flex flex-col items-center justify-center space-y-3 font-vazir" dir="rtl">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-bold">در حال بارگذاری اطلاعات فعالیت و محاسبه شهریه...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-vazir" dir="rtl">
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

      {/* ============================================================= */}
      {/* MODE 1: INITIAL CLEAN SLATE (دو گزینه کلی: ایجاد دوره و مشاهده بایگانی) */}
      {/* ============================================================= */}
      {pageMode === 'initial_home' && (
        <div className="space-y-6">
          {/* Top Banner & Title */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shadow-xs border border-emerald-100 shrink-0">
                <Coins size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-slate-900">سامانه محاسبه و پرداخت شهریه طلاب</h2>
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black rounded-lg">
                    واحد مالی و بودجه
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  مدیریت دوره‌های پرداخت، استخراج کارکرد و حضور طلاب، محاسبه مکانیزه و صدور اسناد
                </p>
              </div>
            </div>
          </div>

          {/* Clean Slate 2 Grand Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 max-w-4xl mx-auto">
            {/* گزینه ۱: ایجاد دوره پرداخت شهریه */}
            <button
              type="button"
              onClick={() => {
                setNewPeriodTitle(`شهریه دوره ${today.substring(0, 7)}`);
                setNewPeriodStartDate(defaultStart);
                setNewPeriodEndDate(today);
                setIsNewPeriodModalOpen(true);
              }}
              className="group text-right bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white p-8 rounded-3xl shadow-lg hover:shadow-xl hover:shadow-emerald-600/20 transition-all duration-200 cursor-pointer border border-emerald-500/30 flex flex-col justify-between min-h-[260px] relative overflow-hidden active:scale-[0.99]"
            >
              <div className="absolute top-0 left-0 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none -translate-x-12 -translate-y-12 group-hover:scale-125 transition-transform" />
              <div className="space-y-4 relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white border border-white/30 shadow-inner group-hover:scale-105 transition-transform">
                  <CalendarPlus size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">ایجاد دوره پرداخت شهریه</h3>
                  <p className="text-xs text-emerald-100 mt-2 leading-relaxed font-normal">
                    تنظیم بازه زمانی دوره پرداخت، بررسی پرونده و آمار فعالیت طلاب، محاسبه مکانیزه و اعمال افزایش یا کاهش دستی و ثبت نهایی دوره.
                  </p>
                </div>
              </div>

              <div className="pt-6 mt-4 border-t border-white/20 flex items-center justify-between text-xs font-bold text-white relative z-10">
                <span className="flex items-center gap-1.5 bg-white/20 px-3.5 py-1.5 rounded-xl backdrop-blur-xs">
                  <span>تنظیم بازه زمانی و ورود به دوره</span>
                  <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                </span>
                <span className="text-[11px] text-emerald-200">شروع فرآیند ←</span>
              </div>
            </button>

            {/* گزینه ۲: مشاهده دوره‌های شهریه {بایگانی} */}
            <button
              type="button"
              onClick={() => {
                setPageMode('archived_periods');
                setSelectedArchivedPeriod(null);
              }}
              className="group text-right bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-8 rounded-3xl shadow-lg hover:shadow-xl hover:shadow-indigo-950/20 transition-all duration-200 cursor-pointer border border-indigo-800/40 flex flex-col justify-between min-h-[260px] relative overflow-hidden active:scale-[0.99]"
            >
              <div className="absolute top-0 left-0 w-36 h-36 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none -translate-x-12 -translate-y-12 group-hover:scale-125 transition-transform" />
              <div className="space-y-4 relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center text-indigo-300 border border-white/20 shadow-inner group-hover:scale-105 transition-transform">
                  <BookOpen size={30} />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-white">مشاهده دوره‌های شهریه {"{بایگانی}"}</h3>
                    {tuitionPeriods.length > 0 && (
                      <span className="px-2.5 py-0.5 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-full text-xs font-mono font-bold">
                        {tuitionPeriods.length} دوره
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed font-normal">
                    مشاهده سوابق و اسناد دوره‌های نهایی شده، فیش‌های شهریه پرداخت شده، صورت‌وضعیت بالادستی و خروجی اکسل گزارش‌ها.
                  </p>
                </div>
              </div>

              <div className="pt-6 mt-4 border-t border-white/15 flex items-center justify-between text-xs font-bold text-white relative z-10">
                <span className="flex items-center gap-1.5 bg-white/10 px-3.5 py-1.5 rounded-xl backdrop-blur-xs text-indigo-200">
                  <span>مشاهده آرشیو و فیش‌ها</span>
                  <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                </span>
                <span className="text-[11px] text-slate-400">سوابق نهایی‌شده ←</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODE 2: ACTIVE PERIOD (ورود به بخش ایجاد دوره پرداخت شهریه)    */}
      {/* ============================================================= */}
      {pageMode === 'active_period' && (
        <div className="space-y-5">
          {/* Active Period Top Bar */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={() => setPageMode('initial_home')}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold shrink-0"
              >
                <ArrowLeft size={16} />
                <span>بازگشت به صفحه اصلی دوره‌ها</span>
              </button>
              <div className="border-r border-slate-200 pr-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-slate-900">{newPeriodTitle || 'دوره پرداخت شهریه'}</h2>
                  <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-black rounded-lg">
                    دوره در حال ویرایش و پردازش
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  بازه زمانی ارزیابی کارکرد: از {startDate} تا {endDate}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-bold hidden md:inline">مجموع واریزی خالص پایا:</span>
              <span className="px-3.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black font-mono">
                {totalNetPayoutSum.toLocaleString('fa-IR')} تومان
              </span>
            </div>
          </div>

          {/* The Two Grand Tabs Requested by User */}
          <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentSubTab('activity_info')}
              className={cn(
                "flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer",
                currentSubTab === 'activity_info'
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Users size={16} />
              <span>۱. اطلاعات حضور و فعالیت طلاب</span>
              <span className={cn(
                "px-2 py-0.5 rounded-md text-[11px] font-bold font-mono",
                currentSubTab === 'activity_info' ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"
              )}>
                {filteredStudents.length} طلبه
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentSubTab('mechanized_calc')}
              className={cn(
                "flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer",
                currentSubTab === 'mechanized_calc'
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <DollarSign size={16} />
              <span>۲. محاسبه مکانیزه</span>
              <span className={cn(
                "px-2 py-0.5 rounded-md text-[11px] font-bold font-mono",
                currentSubTab === 'mechanized_calc' ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"
              )}>
                با امکان اصلاح دستی
              </span>
            </button>
          </div>

      {/* Filter and Date Range Strip */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Grade and Search */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <Filter size={14} />
            <span>پایه تحصیلی:</span>
          </div>
          <select
            value={gradeFilter}
            onChange={e => setGradeFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">همه پایه‌ها</option>
            <option value="پایه ۷">پایه ۷</option>
            <option value="پایه ۸">پایه ۸</option>
            <option value="پایه ۹">پایه ۹</option>
            <option value="پایه ۱۰">پایه ۱۰</option>
          </select>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="جستجوی طلبه (نام، کدملی، کد موسسه)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pr-8 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Right: Date Range Selector */}
        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs font-bold">
          <Calendar size={14} className="text-slate-500 mr-1" />
          <span className="text-slate-600 text-[11px]">بازه ارزیابی:</span>
          <div className="w-28">
            <ShamsiDatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="از تاریخ"
            />
          </div>
          <span className="text-slate-400">تا</span>
          <div className="w-28">
            <ShamsiDatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder="تا تاریخ"
            />
          </div>
        </div>
      </div>

      {/* Summary Highlights Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500">تعداد طلاب واجد</span>
          <div className="text-base font-black text-slate-900 font-mono">{filteredStudents.length} نفر</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500">میانگین ساعت مطالعه</span>
          <div className="text-base font-black text-indigo-700 font-mono">
            {Math.round(studyAggregations.avgMinutes / 60)} ساعت
          </div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500">جلسات حضور ثبت‌شده</span>
          <div className="text-base font-black text-emerald-700 font-mono">
            {Object.values(attendanceAggregations).reduce((a, b) => a + b.present, 0)} جلسه
          </div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500">غیبت غیرموجه کل</span>
          <div className="text-base font-black text-rose-700 font-mono">
            {Object.values(attendanceAggregations).reduce((a, b) => a + b.absentUnexcused, 0)} جلسه
          </div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500">کل نمرات الف مشاوره</span>
          <div className="text-base font-black text-emerald-600 font-mono">
            {Object.values(counselingAggregations).reduce((a, b) => a + b.countA, 0)} مورد
          </div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500">کل شهریه قابل واریز</span>
          <div className="text-base font-black text-slate-900 font-mono">
            {totalNetPayoutSum.toLocaleString('fa-IR')} <span className="text-[10px] text-slate-500 font-normal">تومان</span>
          </div>
        </div>
      </div>

      {/* TAB 1: اطلاعات حضور و فعالیت طلاب (سربرگ‌های ۹ گانه تفکیک‌شده) */}
      {currentSubTab === 'activity_info' && (
        <ActivityInfoTabbedView
          students={students}
          profiles={profiles}
          calculatedTuitions={calculatedTuitions}
          studyPeriods={studyPeriods}
          studyLogs={studyLogs}
          attendanceLogs={attendanceLogs}
          counselingGrades={counselingGrades}
          mealReservations={mealReservations}
          lunchItems={lunchItems}
          claimsList={claimsList}
          claimCategories={claimCategories}
          destinationAccounts={destinationAccounts}
          loans={loans}
          settings={settings}
          startDate={startDate}
          endDate={endDate}
          gradeFilter={gradeFilter}
          setGradeFilter={setGradeFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          studentOverrides={studentOverrides}
          setStudentOverrides={setStudentOverrides}
          onOpenSlipDetail={(item) => setSelectedSlipDetail(item)}
          onOpenEditProfile={(s) => openEditProfile(s)}
          onNavigateToMechanized={() => setCurrentSubTab('mechanized_calc')}
          onOpenDebtModal={(st) => {
            setSelectedStudentForDebtDetail(st);
          }}
        />
      )}

      {/* TAB 2: محاسبه مکانیزه */}
      {currentSubTab === 'mechanized_calc' && (
        <div className="space-y-5">
          {/* Period Date & Formula Controls Header */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <DollarSign size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">محاسبه مکانیزه و اصلاحات دستی شهریه طلاب</h3>
                  <p className="text-[11px] text-slate-500">
                    شهریه‌ها به صورت هوشمند بر اساس آمار حضور و مطالعه محاسبه شده‌اند. می‌توانید مبالغ را بررسی و به صورت موردی تغییر دهید.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(true)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <SlidersHorizontal size={14} className="text-emerald-400" />
                  <span>تنظیمات فرمول محاسبه شهریه</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFinalizeWarningModalOpen(true)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCheck size={16} />
                  <span>ثبت نهایی شهریه</span>
                </button>
              </div>
            </div>

                {/* Targeted Calculation Scope Control Bar */}
                <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                      <Filter size={14} className="text-emerald-700" />
                      <span>دامنه محاسبه مکانیزه:</span>
                    </span>

                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-emerald-200 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setCalcScopeMode('all')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                          calcScopeMode === 'all'
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        همه طلاب ({students.length} نفر)
                      </button>

                      <button
                        type="button"
                        onClick={() => setCalcScopeMode('grade')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                          calcScopeMode === 'grade'
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        پایه تحصیلی خاص
                      </button>

                      <button
                        type="button"
                        onClick={() => setCalcScopeMode('individual')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                          calcScopeMode === 'individual'
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        یک طلبه خاص (دستی)
                      </button>
                    </div>
                  </div>

                  {calcScopeMode === 'grade' && (
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-emerald-200">
                      <span className="text-xs text-slate-700 font-bold">پایه تحصیلی:</span>
                      <select
                        value={selectedCalcGrade}
                        onChange={e => setSelectedCalcGrade(e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-900 outline-none cursor-pointer"
                      >
                        <option value="پایه ۷">پایه ۷</option>
                        <option value="پایه ۸">پایه ۸</option>
                        <option value="پایه ۹">پایه ۹</option>
                        <option value="پایه ۱۰">پایه ۱۰</option>
                        <option value="پایه ۱۱">پایه ۱۱</option>
                        <option value="پایه ۱۲">پایه ۱۲</option>
                      </select>
                    </div>
                  )}

                  {calcScopeMode === 'individual' && (
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-emerald-200">
                      <span className="text-xs text-slate-700 font-bold">انتخاب طلبه:</span>
                      <select
                        value={selectedCalcStudentId}
                        onChange={e => setSelectedCalcStudentId(e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-900 outline-none cursor-pointer max-w-xs"
                      >
                        <option value="">-- انتخاب طلبه --</option>
                        {students.map(s => (
                          <option key={s.id} value={s.id}>{s.name} (پایه {s.grade || ''})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Period Title & Dates Picker Form */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                  <div className="md:col-span-2 space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">عنوان دوره شهریه:</label>
                    <input
                      type="text"
                      value={newPeriodTitle}
                      onChange={e => setNewPeriodTitle(e.target.value)}
                      placeholder="مثلا: شهریه مهر ماه ۱۴۰۳"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">تاریخ شروع بازه:</label>
                    <ShamsiDatePicker
                      value={startDate}
                      onChange={setStartDate}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">تاریخ پایان بازه:</label>
                    <ShamsiDatePicker
                      value={endDate}
                      onChange={setEndDate}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Report View Mode Switcher Strip */}
              <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setReportViewMode('upper_management')}
                    className={cn(
                      "py-2 px-3.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
                      reportViewMode === 'upper_management'
                        ? "bg-white text-emerald-800 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <FileText size={14} className={reportViewMode === 'upper_management' ? "text-emerald-600" : "text-slate-400"} />
                    <span>۱. صورت‌وضعیت و فاکتور تفکیکی بالادستی</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReportViewMode('internal_detailed')}
                    className={cn(
                      "py-2 px-3.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
                      reportViewMode === 'internal_detailed'
                        ? "bg-white text-emerald-800 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <BookOpen size={14} className={reportViewMode === 'internal_detailed' ? "text-emerald-600" : "text-slate-400"} />
                    <span>۲. گزارش تفصیلی و اصلاحات دستی</span>
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportUpperManagementExcel}
                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download size={14} />
                    <span>اکسل بالادستی</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportInternalExcel}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download size={14} />
                    <span>اکسل تفصیلی</span>
                  </button>
                </div>
              </div>

          {/* VIEW 1: UPPER MANAGEMENT RECONCILIATION & 4-WAY TRANSFERS */}
          {reportViewMode === 'upper_management' && (
            <div className="space-y-4">
              {/* 5 KPI Cards for Transfers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                {/* 1. مجموع فاکتور بالادستی */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-3xl shadow-sm space-y-1.5">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="font-bold">مجموع فاکتور بالادستی</span>
                    <Coins size={16} className="text-amber-400" />
                  </div>
                  <div className="text-lg font-black font-mono text-amber-300">
                    {totalGrossTuitionSum.toLocaleString('fa-IR')} <span className="text-[10px] font-sans font-normal text-slate-300">تومان</span>
                  </div>
                  <p className="text-[10px] text-slate-400">شهریه استحقاقی پس از کسر غیبت‌ها</p>
                </div>

                {/* 2. حواله ۱: سهم آشپزخانه */}
                <div className="bg-white p-4 rounded-3xl border border-amber-200 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="font-bold flex items-center gap-1">
                      <UtensilsCrossed size={14} className="text-amber-600" />
                      <span>حواله ۱: سهم آشپزخانه</span>
                    </span>
                    <span className="text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded font-bold">نهار/شام</span>
                  </div>
                  <div className="text-base font-black font-mono text-amber-700">
                    {totalKitchenTransferSum.toLocaleString('fa-IR')} <span className="text-[10px] font-sans font-normal text-slate-500">تومان</span>
                  </div>
                  <p className="text-[10px] text-slate-500">واریز به حساب سلف و آشپزخانه</p>
                </div>

                {/* 3. حواله ۲: سهم امور فرهنگی و عتبات */}
                <div className="bg-white p-4 rounded-3xl border border-teal-200 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="font-bold flex items-center gap-1">
                      <BookOpen size={14} className="text-teal-600" />
                      <span>حواله ۲: امور فرهنگی</span>
                    </span>
                    <span className="text-[10px] bg-teal-50 text-teal-800 px-1.5 py-0.5 rounded font-bold">عتبات/اردو</span>
                  </div>
                  <div className="text-base font-black font-mono text-teal-700">
                    {totalCulturalTransferSum.toLocaleString('fa-IR')} <span className="text-[10px] font-sans font-normal text-slate-500">تومان</span>
                  </div>
                  <p className="text-[10px] text-slate-500">واریز به حساب امور فرهنگی و زیارتی</p>
                </div>

                {/* 4. حواله ۳: سهم صندوق قرض‌الحسنه */}
                <div className="bg-white p-4 rounded-3xl border border-indigo-200 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="font-bold flex items-center gap-1">
                      <CreditCard size={14} className="text-indigo-600" />
                      <span>حواله ۳: صندوق قرض‌الحسنه</span>
                    </span>
                    <span className="text-[10px] bg-indigo-50 text-indigo-800 px-1.5 py-0.5 rounded font-bold">وام/پس‌انداز</span>
                  </div>
                  <div className="text-base font-black font-mono text-indigo-700">
                    {totalQardFundTransferSum.toLocaleString('fa-IR')} <span className="text-[10px] font-sans font-normal text-slate-500">تومان</span>
                  </div>
                  <p className="text-[10px] text-slate-500">واریز اقساط وام و پس‌انداز طلاب</p>
                </div>

                {/* 5. حواله ۴: فایل پرداخت پایا طلاب */}
                <div className="bg-emerald-50/80 p-4 rounded-3xl border border-emerald-300 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between text-emerald-900">
                    <span className="font-black flex items-center gap-1">
                      <CheckCheck size={14} className="text-emerald-700" />
                      <span>حواله ۴: فایل پایا طلاب</span>
                    </span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded font-bold">خالص واریزی</span>
                  </div>
                  <div className="text-base font-black font-mono text-emerald-800">
                    {totalNetPayoutSum.toLocaleString('fa-IR')} <span className="text-[10px] font-sans font-normal text-emerald-900">تومان</span>
                  </div>
                  <p className="text-[10px] text-emerald-700 font-medium">واریز مستقیم به شماره حساب/شبا طلاب</p>
                </div>
              </div>

              {/* Accounting Balance Verification Bar */}
              <div className="p-3.5 bg-emerald-500/10 rounded-2xl border border-emerald-300 flex items-center justify-between text-xs text-emerald-950 font-bold">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>
                    تراز حسابداری ۱۰۰٪ معتبر است: فاکتور بالادستی ({totalGrossTuitionSum.toLocaleString('fa-IR')} ت) = پایا طلاب ({totalNetPayoutSum.toLocaleString('fa-IR')} ت) + آشپزخانه ({totalKitchenTransferSum.toLocaleString('fa-IR')} ت) + فرهنگی ({totalCulturalTransferSum.toLocaleString('fa-IR')} ت) + صندوق ({totalQardFundTransferSum.toLocaleString('fa-IR')} ت)
                  </span>
                </div>
                <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[11px] font-mono">
                  تراز برقرار ✓
                </span>
              </div>

              {/* Upper Management Table */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black">
                        <th className="py-3 px-3">ردیف</th>
                        <th className="py-3 px-3">نام و نام خانوادگی</th>
                        <th className="py-3 px-3">پایه</th>
                        <th className="py-3 px-3">شماره شبا بانکی</th>
                        <th className="py-3 px-3 text-amber-900 bg-amber-50/50">شهریه استحقاقی (فاکتور بالادستی)</th>
                        <th className="py-3 px-3 text-amber-800">کسر آشپزخانه</th>
                        <th className="py-3 px-3 text-teal-800">کسر فرهنگی</th>
                        <th className="py-3 px-3 text-indigo-800">کسر صندوق/وام</th>
                        <th className="py-3 px-3 text-slate-700">سایر حواله‌ها</th>
                        <th className="py-3 px-3 font-black text-emerald-900 bg-emerald-50/60">خالص واریز به طلبه (پایا)</th>
                        <th className="py-3 px-3 text-center">ریز فاکتور</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {calculatedTuitions.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="text-center py-10 text-slate-400 font-bold">
                            اطلاعاتی برای نمایش موجود نیست.
                          </td>
                        </tr>
                      ) : (
                        calculatedTuitions.map((calc, idx) => (
                          <tr key={calc.studentId} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-3 font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-3 px-3">
                              <span className="font-bold text-slate-900 block">{calc.studentName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {calc.nationalId || calc.instituteCode || '---'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-600 font-bold">{calc.grade}</td>
                            <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                              {calc.bankSheba ? (
                                <span className="text-slate-800 font-bold">{calc.bankSheba}</span>
                              ) : calc.bankAccount ? (
                                <span>حساب: {calc.bankAccount}</span>
                              ) : (
                                <span className="text-rose-400">ثبت نشده</span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-amber-900 bg-amber-50/30">
                              {(calc.grossEarnedTuition || 0).toLocaleString('fa-IR')}
                            </td>
                            <td className="py-3 px-3 font-mono text-amber-700 font-medium">
                              {(calc.kitchenTransferAmount || 0) > 0 ? (
                                `-${(calc.kitchenTransferAmount || 0).toLocaleString('fa-IR')}`
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono text-teal-700 font-medium">
                              {(calc.culturalTransferAmount || 0) > 0 ? (
                                `-${(calc.culturalTransferAmount || 0).toLocaleString('fa-IR')}`
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono text-indigo-700 font-medium">
                              {(calc.qardFundTransferAmount || 0) > 0 ? (
                                `-${(calc.qardFundTransferAmount || 0).toLocaleString('fa-IR')}`
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-600">
                              {(calc.otherTransferAmount || 0) > 0 ? (
                                `-${(calc.otherTransferAmount || 0).toLocaleString('fa-IR')}`
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono font-black text-emerald-800 text-sm bg-emerald-50/40">
                              {(calc.netPayableTuition || 0).toLocaleString('fa-IR')} تومان
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedSlipDetail(calc)}
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                              >
                                مشاهده
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Bottom Summary Bar for Upper Management */}
                <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                  <div className="flex flex-wrap items-center gap-4 text-slate-700 font-bold">
                    <span>تعداد طلاب: {calculatedTuitions.length} نفر</span>
                    <span>•</span>
                    <span className="text-amber-800">مجموع فاکتور بالادستی: {totalGrossTuitionSum.toLocaleString('fa-IR')} ت</span>
                    <span>•</span>
                    <span className="text-slate-600">مجموع حواله‌های انتقالی: {totalType2DeductionsSum.toLocaleString('fa-IR')} ت</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-700 font-bold">مجموع واریز پایا طلاب:</span>
                    <span className="text-base font-black text-emerald-800 font-mono">
                      {totalNetPayoutSum.toLocaleString('fa-IR')} تومان
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: INTERNAL DETAILED AUDIT WITH EDITABLE MANUAL ADJUSTMENTS */}
          {reportViewMode === 'internal_detailed' && (
            <div className="space-y-4">
              {/* Filter & View Mode Controls Strip */}
              <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Filter size={15} className="text-indigo-600" />
                    <span>فیلتر بر اساس پایه:</span>
                  </span>
                  {['all', 'پایه 7', 'پایه 8', 'پایه 9', 'پایه 10', 'پایه 11', 'پایه 12'].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGradeFilter(g)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                        gradeFilter === g
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                      )}
                    >
                      {g === 'all' ? 'همه پایه‌ها' : g}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {/* Search */}
                  <div className="relative">
                    <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="جستجوی نام یا کدملی..."
                      className="pr-8 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 outline-hidden focus:border-indigo-500 w-44"
                    />
                  </div>

                  {/* Compact / Detailed View Toggle */}
                  <button
                    type="button"
                    onClick={() => setIsCompactView(!isCompactView)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer",
                      isCompactView
                        ? "bg-amber-50 border-amber-300 text-amber-900"
                        : "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                    )}
                  >
                    <SlidersHorizontal size={14} />
                    <span>{isCompactView ? 'حالت نمایش جمع و جور (فعال)' : 'حالت نمایش تفصیلی کامل'}</span>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                  <div>
                    <span className="font-black text-xs block">
                      {isCompactView ? 'جدول تجمیعی شهریه (کسورات نوع ۱ و ۲ به صورت خلاصه)' : 'جدول تفصیلی شهریه با نمایش تمامی فاکتورها، بدهی‌ها، اضافات و کسورات مستقل'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      مسئول مالی می‌تواند مبالغ تعدیل دستی و سایر فاکتورها را مستقیماً ویرایش نماید.
                    </span>
                  </div>
                  <span className="font-mono text-xs text-emerald-400 font-bold">{calculatedTuitions.length} طلبه</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black">
                        <th className="py-3 px-2 text-center">ردیف</th>
                        <th className="py-3 px-2">نام طلبه و کدملی</th>
                        <th className="py-3 px-2 text-center">پایه</th>
                        <th className="py-3 px-2 text-center">شهریه پایه</th>

                        {isCompactView ? (
                          <>
                            <th className="py-3 px-2 text-center text-emerald-700">کل مزایا (+)</th>
                            <th className="py-3 px-2 text-center text-rose-700">کسورات نوع ۱ (-)</th>
                            <th className="py-3 px-2 text-center text-amber-900">شهریه استحقاقی</th>
                            <th className="py-3 px-2 text-center text-rose-700">کسورات نوع ۲ (انتقالی)</th>
                          </>
                        ) : (
                          <>
                            <th className="py-3 px-2 text-center text-emerald-700">تاهل/اولاد</th>
                            <th className="py-3 px-2 text-center text-emerald-700">معمم/مسکن</th>
                            <th className="py-3 px-2 text-center text-emerald-700">مطالعه مازاد</th>
                            <th className="py-3 px-2 text-center text-emerald-700">مشاوره</th>
                            <th className="py-3 px-2 text-center text-rose-700">کسری مطالعه</th>
                            <th className="py-3 px-2 text-center text-rose-700">غیبت غیرموجه</th>
                            <th className="py-3 px-2 text-center text-rose-700">کسر نهار</th>
                            <th className="py-3 px-2 text-center text-rose-700">وام/اقساط</th>
                            <th className="py-3 px-2 text-center text-teal-800">کمک به صندوق</th>
                            <th className="py-3 px-2 text-center text-rose-700">سایر بدهی‌ها</th>
                            <th className="py-3 px-2 text-center text-amber-900">شهریه استحقاقی</th>
                          </>
                        )}

                        <th className="py-3 px-2 text-center text-indigo-800 bg-indigo-50/50">تعدیل دستی (تومان)</th>
                        <th className="py-3 px-2 text-center text-indigo-800 bg-indigo-50/50">علت تعدیل دستی</th>
                        <th className="py-3 px-3 text-center font-black text-emerald-900 bg-emerald-50/40">خالص واریزی</th>
                        <th className="py-3 px-2 text-center">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {calculatedTuitions.length === 0 ? (
                        <tr>
                          <td colSpan={isCompactView ? 11 : 17} className="text-center py-10 text-slate-400 font-bold">
                            اطلاعاتی مطابق با فیلتر انتخابی موجود نیست.
                          </td>
                        </tr>
                      ) : (
                        calculatedTuitions.map((calc, idx) => (
                          <tr key={calc.studentId} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-2 text-center font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-3 px-2">
                              <span className="font-bold text-slate-900 block">{calc.studentName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {calc.nationalId || '---'}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center text-slate-600 font-bold">{calc.grade}</td>
                            <td className="py-3 px-2 text-center font-mono text-slate-700">
                              {(calc.baseTuition || 0).toLocaleString('fa-IR')}
                            </td>

                            {isCompactView ? (
                              <>
                                <td className="py-3 px-2 text-center font-mono text-emerald-700 font-bold">
                                  +{(calc.totalAdditions || 0).toLocaleString('fa-IR')}
                                </td>
                                <td className="py-3 px-2 text-center font-mono text-rose-700 font-bold">
                                  -{(calc.type1DeductionsTotal || 0).toLocaleString('fa-IR')}
                                </td>
                                <td className="py-3 px-2 text-center font-mono text-amber-900 font-bold">
                                  {(calc.grossEarnedTuition || 0).toLocaleString('fa-IR')}
                                </td>
                                <td className="py-3 px-2 text-center font-mono text-rose-700 font-bold">
                                  -{(calc.type2DeductionsTotal || 0).toLocaleString('fa-IR')}
                                </td>
                              </>
                            ) : (
                              <>
                                {/* تاهل و اولاد */}
                                <td className="py-3 px-2 text-center font-mono text-slate-600">
                                  {((calc.maritalBonus || 0) + (calc.childAllowanceTotal || 0)) > 0
                                    ? `+${((calc.maritalBonus || 0) + (calc.childAllowanceTotal || 0)).toLocaleString('fa-IR')}`
                                    : '-'}
                                </td>
                                {/* معمم و مسکن */}
                                <td className="py-3 px-2 text-center font-mono text-slate-600">
                                  {((calc.turbanAllowance || 0) + (calc.housingAllowance || 0)) > 0
                                    ? `+${((calc.turbanAllowance || 0) + (calc.housingAllowance || 0)).toLocaleString('fa-IR')}`
                                    : '-'}
                                </td>
                                {/* مطالعه مازاد */}
                                <td className="py-3 px-2 text-center font-mono text-emerald-700 font-bold">
                                  {(calc.studyBonusAmount || 0) > 0 ? `+${(calc.studyBonusAmount || 0).toLocaleString('fa-IR')}` : '-'}
                                </td>
                                {/* مشاوره (ارزیابی الف، ب، ج، د) */}
                                <td className="py-3 px-2 text-center font-mono text-slate-600">
                                  <div>
                                    <span>{(calc.counselingBonusAmount || 0) > 0 ? `+${(calc.counselingBonusAmount || 0).toLocaleString('fa-IR')}` : '-'}</span>
                                    {(calc.counselingGradeACount || calc.counselingGradeBCount || calc.counselingGradeCCount || calc.counselingGradeDCount) ? (
                                      <div className="text-[10px] text-slate-500 font-sans flex items-center justify-center gap-0.5 mt-0.5">
                                        {calc.counselingGradeACount > 0 && <span className="bg-emerald-100 text-emerald-800 px-1 rounded font-bold">{calc.counselingGradeACount}الف</span>}
                                        {calc.counselingGradeBCount > 0 && <span className="bg-blue-100 text-blue-800 px-1 rounded font-bold">{calc.counselingGradeBCount}ب</span>}
                                        {calc.counselingGradeCCount > 0 && <span className="bg-amber-100 text-amber-800 px-1 rounded font-bold">{calc.counselingGradeCCount}ج</span>}
                                        {calc.counselingGradeDCount > 0 && <span className="bg-rose-100 text-rose-800 px-1 rounded font-bold">{calc.counselingGradeDCount}د</span>}
                                      </div>
                                    ) : null}
                                  </div>
                                </td>
                                {/* کسری مطالعه */}
                                <td className="py-3 px-2 text-center font-mono text-rose-700">
                                  {(calc.studyPenaltyAmount || 0) > 0 ? `-${(calc.studyPenaltyAmount || 0).toLocaleString('fa-IR')}` : '-'}
                                </td>
                                {/* غیبت غیرموجه */}
                                <td className="py-3 px-2 text-center font-mono text-rose-700">
                                  {(calc.absencePenaltyAmount || 0) > 0 ? `-${(calc.absencePenaltyAmount || 0).toLocaleString('fa-IR')}` : '-'}
                                </td>
                                {/* کسر نهار */}
                                <td className="py-3 px-2 text-center font-mono text-rose-700">
                                  {(calc.kitchenTransferAmount || 0) > 0 ? `-${(calc.kitchenTransferAmount || 0).toLocaleString('fa-IR')}` : '-'}
                                </td>
                                {/* اقساط وام */}
                                <td className="py-3 px-2 text-center font-mono text-rose-700">
                                  {(calc.loanInstallmentDeduction || calc.qardFundTransferAmount || 0) > 0 ? `-${(calc.loanInstallmentDeduction || calc.qardFundTransferAmount || 0).toLocaleString('fa-IR')}` : '-'}
                                </td>
                                {/* کمک به صندوق */}
                                <td className="py-3 px-2 text-center font-mono text-teal-800 font-bold">
                                  {(calc.fundContributionDeduction || calc.fundDeduction || 0) > 0
                                    ? `-${(calc.fundContributionDeduction || calc.fundDeduction || 0).toLocaleString('fa-IR')}`
                                    : '-'}
                                </td>
                                {/* سایر بدهی‌ها (تفصیلی) */}
                                <td className="py-3 px-2 text-center font-mono text-rose-700">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedStudentForDebtDetail(calc)}
                                    className="hover:underline hover:text-rose-900 cursor-pointer font-bold inline-flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200"
                                    title="کلیک جهت مشاهده عناوین و ویرایش تفصیلی بدهی‌ها"
                                  >
                                    <span>
                                      {((calc.culturalTransferAmount || 0) + (calc.otherTransferAmount || 0)) > 0
                                        ? `-${((calc.culturalTransferAmount || 0) + (calc.otherTransferAmount || 0)).toLocaleString('fa-IR')}`
                                        : '۰'}
                                    </span>
                                    <Eye size={12} className="text-rose-600" />
                                  </button>
                                </td>
                                {/* شهریه استحقاقی */}
                                <td className="py-3 px-2 text-center font-mono text-amber-900 font-bold">
                                  {(calc.grossEarnedTuition || 0).toLocaleString('fa-IR')}
                                </td>
                              </>
                            )}

                            {/* Editable Manual Adjustment Amount */}
                            <td className="py-2.5 px-2 bg-indigo-50/20 text-center">
                              <input
                                type="number"
                                placeholder="0"
                                value={studentOverrides[calc.studentId]?.manualAdjustmentAmount ?? (calc.manualAdjustmentAmount || '')}
                                onChange={e => {
                                  const val = e.target.value === '' ? undefined : Number(e.target.value);
                                  setStudentOverrides(prev => ({
                                    ...prev,
                                    [calc.studentId]: {
                                      ...prev[calc.studentId],
                                      manualAdjustmentAmount: val
                                    }
                                  }));
                                }}
                                className={cn(
                                  "w-24 px-2 py-1.5 border rounded-lg text-xs font-mono font-bold outline-hidden transition-all text-center",
                                  (studentOverrides[calc.studentId]?.manualAdjustmentAmount || calc.manualAdjustmentAmount || 0) > 0
                                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                                    : (studentOverrides[calc.studentId]?.manualAdjustmentAmount || calc.manualAdjustmentAmount || 0) < 0
                                    ? "bg-rose-50 border-rose-300 text-rose-800"
                                    : "bg-white border-slate-200 text-slate-700 focus:border-indigo-500"
                                )}
                              />
                            </td>

                            {/* Editable Manual Adjustment Reason */}
                            <td className="py-2.5 px-2 bg-indigo-50/20">
                              <input
                                type="text"
                                placeholder="علت..."
                                value={studentOverrides[calc.studentId]?.manualAdjustmentReason ?? (calc.manualAdjustmentReason || '')}
                                onChange={e => {
                                  const val = e.target.value;
                                  setStudentOverrides(prev => ({
                                    ...prev,
                                    [calc.studentId]: {
                                      ...prev[calc.studentId],
                                      manualAdjustmentReason: val
                                    }
                                  }));
                                }}
                                className="w-28 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-hidden focus:border-indigo-500"
                              />
                            </td>

                            <td className="py-3 px-3 text-center font-mono font-black text-emerald-800 text-sm bg-emerald-50/40">
                              {(calc.netPayableTuition || 0).toLocaleString('fa-IR')}
                            </td>
                            <td className="py-3 px-2 text-center">
                              <button
                                type="button"
                                id={`btn-details-${calc.studentId}`}
                                onClick={() => setSelectedSlipDetail(calc)}
                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer mx-auto shadow-2xs"
                              >
                                <Eye size={13} className="text-indigo-600" />
                                <span>جزئیات</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Bottom Summary Bar for Internal */}
                <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-4 text-slate-600 font-bold">
                    <span>تعداد طلاب: {calculatedTuitions.length} نفر</span>
                    <span>•</span>
                    <span>جمع کل کسورات: {(totalType1DeductionsSum + totalType2DeductionsSum).toLocaleString('fa-IR')} تومان</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-bold">مجموع نهایی پرداختی شهریه:</span>
                    <span className="text-base font-black text-emerald-800 font-mono">
                      {totalNetPayoutSum.toLocaleString('fa-IR')} تومان
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Action Banner: Finalize Tuition Period */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-3xl shadow-lg border border-indigo-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={20} className="text-emerald-400" />
                <h3 className="font-black text-sm text-white">ثبت نهایی و انتقال دوره به بایگانی شهریه</h3>
              </div>
              <p className="text-xs text-slate-300">
                پس از بررسی و ویرایش‌های موردی، با کلیک بر روی این دکمه این دوره محاسباتی ثبات یافته و در بایگانی ذخیره خواهد شد.
              </p>
            </div>

            <button
              type="button"
              onClick={handleFinalizeTuitionPeriod}
              className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-95 shrink-0"
            >
              <CheckCheck size={18} />
              <span>تایید نهایی و انتقال دوره به بایگانی</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )}

      {/* ============================================================= */}
      {/* MODE 3: ARCHIVED PERIODS (مشاهده دوره‌های شهریه {بایگانی})     */}
      {/* ============================================================= */}
      {pageMode === 'archived_periods' && (
        <div className="space-y-5">
          {/* Top Header for Archive with Back Button */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={() => {
                  setPageMode('initial_home');
                  setSelectedArchivedPeriod(null);
                }}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold shrink-0"
              >
                <ArrowLeft size={16} />
                <span>بازگشت به صفحه اصلی دوره‌ها</span>
              </button>
              <div className="border-r border-slate-200 pr-3">
                <h2 className="text-base font-black text-slate-900">مشاهده دوره‌های شهریه {"{بایگانی}"}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  آرشیو دوره‌های ثبت نهایی شده، فیش‌های تفکیکی و دریافت فایل اکسل
                </p>
              </div>
            </div>

            <span className="px-3 py-1.5 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-bold font-mono">
              {tuitionPeriods.length} دوره بایگانی شده
            </span>
          </div>

          {/* Sub-tabs for Archive: Period List vs Student Reports */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-xs font-bold w-fit">
            <button
              type="button"
              onClick={() => {
                setArchiveSubTab('period_list');
                setSelectedArchivedPeriod(null);
              }}
              className={cn(
                "px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2",
                archiveSubTab === 'period_list' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <BookOpen size={15} />
              <span>لیست دوره‌های بایگانی‌شده</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setArchiveSubTab('student_reports');
                setSelectedArchivedPeriod(null);
                if (!reportSelectedStudentId && students.length > 0) {
                  setReportSelectedStudentId(students[0].id);
                }
              }}
              className={cn(
                "px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2",
                archiveSubTab === 'student_reports' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Users size={15} />
              <span>گزارش طلاب در بایگانی</span>
            </button>
          </div>

          {/* TAB 1 OF ARCHIVE: PERIOD LIST */}
          {archiveSubTab === 'period_list' && (
            <>
              {!selectedArchivedPeriod ? (
                /* List of Archived Tuition Periods */
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">بایگانی دوره‌های محاسباتی و پرداختی شهریه</h3>
                    <p className="text-[11px] text-slate-500">لیست تمامی دوره‌های شهریه ثبت نهایی شده به همراه جزئیات کامل</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-indigo-50 text-indigo-800 rounded-xl text-xs font-bold font-mono">
                  {tuitionPeriods.length} دوره بایگانی
                </span>
              </div>

              {tuitionPeriods.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <BookOpen size={40} className="mx-auto text-slate-300" />
                  <p className="text-xs text-slate-500 font-bold">هنوز هیچ دوره شهریه‌ای ثبت نهایی نشده است.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setNewPeriodTitle(`شهریه دوره ${today.substring(0, 7)}`);
                      setNewPeriodStartDate(defaultStart);
                      setNewPeriodEndDate(today);
                      setIsNewPeriodModalOpen(true);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <PlusCircle size={16} />
                    <span>ایجاد دوره پرداخت شهریه</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tuitionPeriods.map(period => (
                    <div
                      key={period.id}
                      className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl p-4 transition-all space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <h4 className="font-black text-sm text-slate-900">{period.title}</h4>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold">
                            نهایی‌شده
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono">
                          بازه: {period.startDate} تا {period.endDate}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 block">تعداد طلاب:</span>
                          <span className="font-bold font-mono text-slate-800">{period.totalStudentsCalculated} نفر</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">مجموع پرداخت:</span>
                          <span className="font-bold font-mono text-emerald-700">
                            {(period.totalPayoutAmount || 0).toLocaleString('fa-IR')} ت
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <button
                          type="button"
                          onClick={() => setSelectedArchivedPeriod(period)}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Eye size={14} />
                          <span>مشاهده و گزارش‌ها</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteArchivedPeriod(period.id, period.title)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                          title="حذف دوره"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Detailed View of Selected Archived Period */
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedArchivedPeriod(null);
                      setIsArchivedModified(false);
                    }}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
                    title="بازگشت به لیست بایگانی"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-slate-900">{selectedArchivedPeriod.title}</h3>
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-lg">
                        بایگانی نهایی
                      </span>
                      {isArchivedModified && (
                        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black rounded-lg animate-pulse">
                          تغییرات ذخیره‌نشده
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      بازه محاسباتی: {selectedArchivedPeriod.startDate} تا {selectedArchivedPeriod.endDate} • ثبت‌شده توسط: {selectedArchivedPeriod.createdByName || 'مسئول مالی'}
                    </p>
                  </div>
                </div>

                {/* Top Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Toggle Detailed / Compact */}
                  <button
                    type="button"
                    onClick={() => setIsArchivedCompactView(prev => !prev)}
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border",
                      isArchivedCompactView 
                        ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    <Layers size={14} />
                    <span>{isArchivedCompactView ? 'نمایش تفصیلی کامل' : 'نمایش جمع و جور'}</span>
                  </button>

                  {/* Save Changes button */}
                  {isArchivedModified && (
                    <button
                      type="button"
                      onClick={handleSaveArchivedPeriodChanges}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs animate-bounce"
                    >
                      <Save size={14} />
                      <span>ذخیره تغییرات در بایگانی</span>
                    </button>
                  )}

                  {/* Export Full Detailed Excel */}
                  <button
                    type="button"
                    onClick={handleExportArchivedDetailedExcel}
                    className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    title="خروجی اکسل با تمامی جزئیات و فاکتورها"
                  >
                    <FileSpreadsheet size={14} className="text-emerald-700" />
                    <span>اکسل تفصیلی کامل</span>
                  </button>

                  {/* Export Upper Management Excel */}
                  <button
                    type="button"
                    onClick={handleExportArchivedUpperManagementExcel}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    title="خروجی اکسل ویژه حواله بالادستی"
                  >
                    <Download size={14} />
                    <span>اکسل بالادستی</span>
                  </button>

                  {/* Print */}
                  <button
                    type="button"
                    onClick={handlePrintSlip}
                    className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Printer size={14} />
                    <span>چاپ فیش‌ها</span>
                  </button>
                </div>
              </div>

              {/* Filter Strip */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 flex-1 max-w-sm">
                  <Search size={14} className="text-slate-400" />
                  <input
                    type="text"
                    placeholder="جستجو در طلاب دوره بایگانی شده..."
                    value={archivedSearchQuery}
                    onChange={e => setArchivedSearchQuery(e.target.value)}
                    className="w-full bg-white px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-600">پایه:</span>
                  <select
                    value={archivedGradeFilter}
                    onChange={e => setArchivedGradeFilter(e.target.value)}
                    className="bg-white px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="all">همه پایه‌ها</option>
                    <option value="پایه ۷">پایه ۷</option>
                    <option value="پایه ۸">پایه ۸</option>
                    <option value="پایه ۹">پایه ۹</option>
                    <option value="پایه ۱۰">پایه ۱۰</option>
                  </select>
                </div>

                <div className="text-slate-500 font-bold">
                  تعداد: {(selectedArchivedPeriod.calculations || []).length} نفر | مجموع واریزی: {(selectedArchivedPeriod.totalPayoutAmount || 0).toLocaleString('fa-IR')} تومان
                </div>
              </div>

              {/* Comprehensive Detailed / Compact Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-black text-[11px]">
                      <th className="py-3 px-2 text-center w-10">#</th>
                      <th className="py-3 px-3">نام طلبه</th>
                      <th className="py-3 px-2 text-center">پایه</th>
                      <th className="py-3 px-2 text-center">شهریه پایه</th>

                      {isArchivedCompactView ? (
                        <>
                          <th className="py-3 px-2 text-center text-emerald-700 font-black">جمع اضافات (+)</th>
                          <th className="py-3 px-2 text-center text-rose-700 font-black">کسورات انضباطی نوع ۱ (-)</th>
                          <th className="py-3 px-2 text-center text-amber-900 font-black">شهریه استحقاقی</th>
                          <th className="py-3 px-2 text-center text-rose-700 font-black">کسورات انتقالی نوع ۲ (-)</th>
                        </>
                      ) : (
                        <>
                          <th className="py-3 px-2 text-center text-slate-600">تاهل و اولاد</th>
                          <th className="py-3 px-2 text-center text-slate-600">معمم و مسکن</th>
                          <th className="py-3 px-2 text-center text-emerald-700">مازاد مطالعه</th>
                          <th className="py-3 px-2 text-center text-rose-700">کسری مطالعه</th>
                          <th className="py-3 px-2 text-center text-rose-700">غیبت</th>
                          <th className="py-3 px-2 text-center text-amber-900 font-black">استحقاقی</th>
                          <th className="py-3 px-2 text-center text-rose-700">کسر نهار</th>
                          <th className="py-3 px-2 text-center text-rose-700">وام و صندوق</th>
                          <th className="py-3 px-2 text-center text-rose-700">سایر کسور</th>
                        </>
                      )}

                      <th className="py-3 px-2 text-center bg-indigo-50/60 text-indigo-900">افزایش/کاهش دستی</th>
                      <th className="py-3 px-2 bg-indigo-50/60 text-indigo-900">علت تعدیل</th>
                      <th className="py-3 px-3 text-center font-black text-emerald-800 bg-emerald-50/40">خالص پرداختی</th>
                      <th className="py-3 px-2 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedArchivedPeriod.calculations || [])
                      .filter(calc => {
                        const matchGrade = archivedGradeFilter === 'all' || calc.grade === archivedGradeFilter;
                        const matchSearch = !archivedSearchQuery || 
                          calc.studentName.toLowerCase().includes(archivedSearchQuery.toLowerCase()) ||
                          (calc.nationalId && calc.nationalId.includes(archivedSearchQuery));
                        return matchGrade && matchSearch;
                      })
                      .map((calc, idx) => (
                        <tr key={calc.studentId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-2 text-center font-mono text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-900 block">{calc.studentName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{calc.nationalId || '---'}</span>
                          </td>
                          <td className="py-3 px-2 text-center text-slate-600 font-bold">{calc.grade}</td>
                          <td className="py-3 px-2 text-center font-mono text-slate-700">
                            {(calc.baseTuition || 0).toLocaleString('fa-IR')}
                          </td>

                          {isArchivedCompactView ? (
                            <>
                              <td className="py-3 px-2 text-center font-mono text-emerald-700 font-bold">
                                +{(calc.totalAdditions || 0).toLocaleString('fa-IR')}
                              </td>
                              <td className="py-3 px-2 text-center font-mono text-rose-700 font-bold">
                                -{(calc.type1DeductionsTotal || 0).toLocaleString('fa-IR')}
                              </td>
                              <td className="py-3 px-2 text-center font-mono text-amber-900 font-bold">
                                {(calc.grossEarnedTuition || 0).toLocaleString('fa-IR')}
                              </td>
                              <td className="py-3 px-2 text-center font-mono text-rose-700 font-bold">
                                -{(calc.type2DeductionsTotal || 0).toLocaleString('fa-IR')}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-3 px-2 text-center font-mono text-slate-600">
                                {((calc.maritalBonus || 0) + (calc.childAllowanceTotal || 0)) > 0
                                  ? `+${((calc.maritalBonus || 0) + (calc.childAllowanceTotal || 0)).toLocaleString('fa-IR')}`
                                  : '-'}
                              </td>
                              <td className="py-3 px-2 text-center font-mono text-slate-600">
                                {((calc.turbanAllowance || 0) + (calc.housingAllowance || 0)) > 0
                                  ? `+${((calc.turbanAllowance || 0) + (calc.housingAllowance || 0)).toLocaleString('fa-IR')}`
                                  : '-'}
                              </td>
                              <td className="py-3 px-2 text-center font-mono text-emerald-700 font-bold">
                                {(calc.studyBonusAmount || 0) > 0 ? `+${(calc.studyBonusAmount || 0).toLocaleString('fa-IR')}` : '-'}
                              </td>
                              <td className="py-3 px-2 text-center font-mono text-rose-700">
                                {(calc.studyPenaltyAmount || 0) > 0 ? `-${(calc.studyPenaltyAmount || 0).toLocaleString('fa-IR')}` : '-'}
                              </td>
                              <td className="py-3 px-2 text-center font-mono text-rose-700">
                                {(calc.absencePenaltyAmount || 0) > 0 ? `-${(calc.absencePenaltyAmount || 0).toLocaleString('fa-IR')}` : '-'}
                              </td>
                              <td className="py-3 px-2 text-center font-mono text-amber-900 font-bold">
                                {(calc.grossEarnedTuition || 0).toLocaleString('fa-IR')}
                              </td>
                              <td className="py-3 px-2 text-center font-mono text-rose-700">
                                {(calc.kitchenTransferAmount || 0) > 0 ? `-${(calc.kitchenTransferAmount || 0).toLocaleString('fa-IR')}` : '-'}
                              </td>
                              <td className="py-3 px-2 text-center font-mono text-rose-700">
                                {(calc.qardFundTransferAmount || 0) > 0 ? `-${(calc.qardFundTransferAmount || 0).toLocaleString('fa-IR')}` : '-'}
                              </td>
                              <td className="py-3 px-2 text-center font-mono text-rose-700">
                                {((calc.culturalTransferAmount || 0) + (calc.otherTransferAmount || 0)) > 0
                                  ? `-${((calc.culturalTransferAmount || 0) + (calc.otherTransferAmount || 0)).toLocaleString('fa-IR')}`
                                  : '-'}
                              </td>
                            </>
                          )}

                          {/* Editable Manual Adjustment Amount in Archive */}
                          <td className="py-2.5 px-2 bg-indigo-50/20 text-center">
                            <input
                              type="number"
                              placeholder="0"
                              value={calc.manualAdjustmentAmount !== undefined ? calc.manualAdjustmentAmount : ''}
                              onChange={e => {
                                const val = e.target.value === '' ? undefined : Number(e.target.value);
                                handleUpdateArchivedItemAdjustment(calc.studentId, val, calc.manualAdjustmentReason);
                              }}
                              className={cn(
                                "w-24 px-2 py-1.5 border rounded-lg text-xs font-mono font-bold outline-hidden transition-all text-center",
                                (calc.manualAdjustmentAmount || 0) > 0
                                  ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                                  : (calc.manualAdjustmentAmount || 0) < 0
                                  ? "bg-rose-50 border-rose-300 text-rose-800"
                                  : "bg-white border-slate-200 text-slate-700 focus:border-indigo-500"
                              )}
                            />
                          </td>

                          {/* Editable Manual Adjustment Reason in Archive */}
                          <td className="py-2.5 px-2 bg-indigo-50/20">
                            <input
                              type="text"
                              placeholder="علت تعدیل..."
                              value={calc.manualAdjustmentReason || ''}
                              onChange={e => {
                                handleUpdateArchivedItemAdjustment(calc.studentId, calc.manualAdjustmentAmount, e.target.value);
                              }}
                              className="w-28 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-hidden focus:border-indigo-500"
                            />
                          </td>

                          {/* Net Payable */}
                          <td className="py-3 px-3 text-center font-mono font-black text-emerald-800 bg-emerald-50/40 text-xs">
                            {(calc.netPayableTuition || 0).toLocaleString('fa-IR')}
                          </td>

                          {/* Actions: View Slip Detail + Delete */}
                          <td className="py-3 px-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedSlipDetail(calc)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                title="مشاهده فیش تفصیلی"
                              >
                                <Eye size={12} />
                                <span>جزئیات</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteArchivedStudentRow(calc.studentId, calc.studentName)}
                                className="p-1 hover:bg-rose-50 text-rose-500 rounded-lg transition-all cursor-pointer"
                                title="حذف از دوره"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          </>
          )}

          {/* TAB 2 OF ARCHIVE: STUDENT INDIVIDUAL & CUMULATIVE REPORTS */}
          {archiveSubTab === 'student_reports' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
              {/* Report Controls Header */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                  {/* Student Selector */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-500">انتخاب طلبه:</label>
                    <select
                      value={reportSelectedStudentId}
                      onChange={e => setReportSelectedStudentId(e.target.value)}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[180px]"
                    >
                      {students.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.grade || 'عمومی'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Period Selector */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-500">دوره شهریه:</label>
                    <select
                      value={reportSelectedPeriodId}
                      onChange={e => setReportSelectedPeriodId(e.target.value)}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="all_cumulative">📊 تجمیعی برای تمام دوره‌های بایگانی‌شده</option>
                      {tuitionPeriods.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({p.startDate} تا {p.endDate})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Report View Type */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-500">حالت نمایش:</label>
                    <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 text-xs">
                      <button
                        type="button"
                        onClick={() => setReportViewType('summary_bill')}
                        className={cn(
                          "px-3 py-1 rounded-lg font-bold transition-all cursor-pointer",
                          reportViewType === 'summary_bill' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        صورت‌حساب و فاکتور
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportViewType('detailed')}
                        className={cn(
                          "px-3 py-1 rounded-lg font-bold transition-all cursor-pointer",
                          reportViewType === 'detailed' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        گزارش تفصیلی
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-all"
                >
                  <Printer size={15} />
                  <span>چاپ گزارش</span>
                </button>
              </div>

              {/* REPORT CONTENT BODY */}
              {(() => {
                const currentStudent = students.find(s => s.id === reportSelectedStudentId) || students[0];
                if (!currentStudent) {
                  return (
                    <div className="text-center py-10 text-slate-400 font-bold text-xs">
                      هیچ طلبی یافت نشد.
                    </div>
                  );
                }

                // Gather all archived calculation rows for this student
                const studentArchivedRows: { periodTitle: string; periodDates: string; calc: TuitionCalculationBreakdown }[] = [];
                tuitionPeriods.forEach(p => {
                  const match = (p.calculations || []).find(c => c.studentId === currentStudent.id || c.nationalId === currentStudent.nationalId);
                  if (match) {
                    studentArchivedRows.push({
                      periodTitle: p.title,
                      periodDates: `${p.startDate} تا ${p.endDate}`,
                      calc: match
                    });
                  }
                });

                if (studentArchivedRows.length === 0) {
                  return (
                    <div className="text-center py-12 space-y-2 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
                      <BookOpen size={36} className="mx-auto text-slate-300" />
                      <p className="text-xs text-slate-500 font-bold">
                        هیچ سابقه بایگانی‌شده‌ای برای «{currentStudent.name}» ثبت نشده است.
                      </p>
                    </div>
                  );
                }

                // If Cumulative Mode chosen:
                if (reportSelectedPeriodId === 'all_cumulative') {
                  const totalNet = studentArchivedRows.reduce((sum, r) => sum + (r.calc.netPayableTuition || 0), 0);
                  const totalGross = studentArchivedRows.reduce((sum, r) => sum + (r.calc.grossEarnedTuition || 0), 0);

                  return (
                    <div className="space-y-6">
                      {/* KPI Summary Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
                          <span className="text-slate-500 text-xs block font-bold">نام و پایه:</span>
                          <span className="text-sm font-black text-indigo-950 block mt-1">{currentStudent.name}</span>
                          <span className="text-[11px] text-indigo-700 font-bold block">{currentStudent.grade || 'عمومی'}</span>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                          <span className="text-slate-500 text-xs block font-bold">تعداد دوره‌های بایگانی:</span>
                          <span className="text-lg font-mono font-black text-emerald-900 block mt-1">{studentArchivedRows.length} دوره</span>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                          <span className="text-slate-500 text-xs block font-bold">جمع کل استحقاقی:</span>
                          <span className="text-lg font-mono font-black text-amber-950 block mt-1">{totalGross.toLocaleString('fa-IR')} تومان</span>
                        </div>
                        <div className="bg-emerald-600 text-white rounded-2xl p-4 shadow-md">
                          <span className="text-emerald-100 text-xs block font-bold">مجموع خالص واریزی تجمیعی:</span>
                          <span className="text-xl font-mono font-black block mt-1">{totalNet.toLocaleString('fa-IR')} تومان</span>
                        </div>
                      </div>

                      {/* Cumulative Table */}
                      <div className="border border-slate-200 rounded-2xl overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                            <tr>
                              <th className="p-3">عنوان دوره بایگانی</th>
                              <th className="p-3 text-center">بازه زمانی</th>
                              <th className="p-3 text-center">شهریه پایه</th>
                              <th className="p-3 text-center text-emerald-800">جمع افزایش و مزایا</th>
                              <th className="p-3 text-center text-rose-800">کسورات انضباطی</th>
                              <th className="p-3 text-center text-amber-900 font-black">شهریه استحقاقی</th>
                              <th className="p-3 text-center text-rose-800">کسورات رفاهی و بدهی</th>
                              <th className="p-3 text-center text-emerald-900 bg-emerald-100/60 font-black">خالص دریافتی</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {studentArchivedRows.map((r, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-3 font-bold text-slate-900">{r.periodTitle}</td>
                                <td className="p-3 text-center font-mono text-slate-500">{r.periodDates}</td>
                                <td className="p-3 text-center font-mono">{(r.calc.baseTuition || 0).toLocaleString('fa-IR')}</td>
                                <td className="p-3 text-center font-mono text-emerald-700 font-bold">+{(r.calc.totalAdditions || 0).toLocaleString('fa-IR')}</td>
                                <td className="p-3 text-center font-mono text-rose-700">-{(r.calc.type1DeductionsTotal || 0).toLocaleString('fa-IR')}</td>
                                <td className="p-3 text-center font-mono text-amber-900 font-bold">{(r.calc.grossEarnedTuition || 0).toLocaleString('fa-IR')}</td>
                                <td className="p-3 text-center font-mono text-rose-700">-{(r.calc.type2DeductionsTotal || 0).toLocaleString('fa-IR')}</td>
                                <td className="p-3 text-center font-mono font-black text-emerald-900 bg-emerald-50/50">{(r.calc.netPayableTuition || 0).toLocaleString('fa-IR')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                }

                // If specific period chosen:
                const selectedRow = studentArchivedRows.find(r => {
                  const periodObj = tuitionPeriods.find(p => p.id === reportSelectedPeriodId);
                  return periodObj && r.periodTitle === periodObj.title;
                }) || studentArchivedRows[0];

                const c = selectedRow.calc;

                return (
                  <div className="space-y-6">
                    {/* Compact Statement Bill (صورت حساب) */}
                    <div className="border-2 border-slate-900 rounded-3xl p-6 bg-white space-y-6 shadow-xs">
                      {/* Statement Header */}
                      <div className="flex flex-col sm:flex-row items-center justify-between border-b-2 border-slate-900 pb-4 gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-900 text-white flex items-center justify-center font-black text-lg">
                            م
                          </div>
                          <div>
                            <h3 className="text-base font-black text-slate-900">صورت‌حساب و فاکتور تفصیلی شهریه</h3>
                            <p className="text-xs text-slate-500 font-bold">{selectedRow.periodTitle} ({selectedRow.periodDates})</p>
                          </div>
                        </div>

                        <div className="text-left font-mono text-xs space-y-1">
                          <div className="font-bold text-slate-700">نام طلبه: <span className="text-slate-900 font-black">{c.studentName}</span></div>
                          <div className="text-slate-500">کد ملی: {c.nationalId || '---'} | پایه: {c.grade || '---'}</div>
                          <div className="text-slate-500">حساب/شبا: {c.bankSheba || c.bankAccount || '---'}</div>
                        </div>
                      </div>

                      {/* Statement Breakdown Table */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Column 1: Additions & Earned Tuition */}
                        <div className="border border-slate-200 rounded-2xl p-4 bg-emerald-50/30 space-y-3">
                          <h4 className="font-black text-emerald-900 text-xs border-b border-emerald-200 pb-2">۱. مزایا و موارد افزایش</h4>
                          <div className="space-y-2 text-xs font-medium">
                            <div className="flex justify-between"><span>شهریه پایه:</span><span className="font-mono font-bold">{(c.baseTuition || 0).toLocaleString('fa-IR')} تومان</span></div>
                            {(c.maritalBonus || 0) > 0 && <div className="flex justify-between text-emerald-800"><span>حق تاهل:</span><span className="font-mono font-bold">+{(c.maritalBonus || 0).toLocaleString('fa-IR')}</span></div>}
                            {(c.childAllowanceTotal || 0) > 0 && <div className="flex justify-between text-emerald-800"><span>حق اولاد:</span><span className="font-mono font-bold">+{(c.childAllowanceTotal || 0).toLocaleString('fa-IR')}</span></div>}
                            {(c.turbanAllowance || 0) > 0 && <div className="flex justify-between text-emerald-800"><span>پاداش معمم بودن:</span><span className="font-mono font-bold">+{(c.turbanAllowance || 0).toLocaleString('fa-IR')}</span></div>}
                            {(c.housingAllowance || 0) > 0 && <div className="flex justify-between text-emerald-800"><span>کمک هزینه مسکن:</span><span className="font-mono font-bold">+{(c.housingAllowance || 0).toLocaleString('fa-IR')}</span></div>}
                            {(c.studyBonusAmount || 0) > 0 && <div className="flex justify-between text-emerald-800"><span>پاداش ساعت مطالعه مازاد:</span><span className="font-mono font-bold">+{(c.studyBonusAmount || 0).toLocaleString('fa-IR')}</span></div>}
                            {(c.counselingBonusAmount || 0) > 0 && <div className="flex justify-between text-emerald-800"><span>پاداش کلاس‌های مشاوره:</span><span className="font-mono font-bold">+{(c.counselingBonusAmount || 0).toLocaleString('fa-IR')}</span></div>}
                          </div>
                          <div className="border-t border-emerald-200 pt-2 flex justify-between font-black text-amber-950 text-xs">
                            <span>مجموع شهریه استحقاقی:</span>
                            <span className="font-mono">{(c.grossEarnedTuition || 0).toLocaleString('fa-IR')} تومان</span>
                          </div>
                        </div>

                        {/* Column 2: Deductions & Transfers */}
                        <div className="border border-slate-200 rounded-2xl p-4 bg-rose-50/30 space-y-3">
                          <h4 className="font-black text-rose-900 text-xs border-b border-rose-200 pb-2">۲. کسورات و بازپرداخت‌ها</h4>
                          <div className="space-y-2 text-xs font-medium">
                            {(c.studyPenaltyAmount || 0) > 0 && <div className="flex justify-between text-rose-800"><span>جریمه کسری مطالعه:</span><span className="font-mono font-bold">-{(c.studyPenaltyAmount || 0).toLocaleString('fa-IR')}</span></div>}
                            {(c.absencePenaltyAmount || 0) > 0 && <div className="flex justify-between text-rose-800"><span>جریمه غیبت‌ها:</span><span className="font-mono font-bold">-{(c.absencePenaltyAmount || 0).toLocaleString('fa-IR')}</span></div>}
                            {(c.kitchenTransferAmount || 0) > 0 && <div className="flex justify-between text-rose-800"><span>هزینه نهار و شام:</span><span className="font-mono font-bold">-{(c.kitchenTransferAmount || 0).toLocaleString('fa-IR')}</span></div>}
                            {(c.loanInstallmentDeduction || 0) > 0 && <div className="flex justify-between text-rose-800"><span>قسط وام صندوق:</span><span className="font-mono font-bold">-{(c.loanInstallmentDeduction || 0).toLocaleString('fa-IR')}</span></div>}
                            {(c.qardFundTransferAmount || 0) > 0 && <div className="flex justify-between text-rose-800"><span>کمک به صندوق:</span><span className="font-mono font-bold">-{(c.qardFundTransferAmount || 0).toLocaleString('fa-IR')}</span></div>}
                            {((c.culturalTransferAmount || 0) + (c.otherTransferAmount || 0)) > 0 && <div className="flex justify-between text-rose-800"><span>سایر بدهی‌ها:</span><span className="font-mono font-bold">-{( (c.culturalTransferAmount || 0) + (c.otherTransferAmount || 0) ).toLocaleString('fa-IR')}</span></div>}
                            {(c.manualAdjustmentAmount || 0) !== 0 && (
                              <div className="flex justify-between text-indigo-900 font-bold border-t border-slate-200 pt-1">
                                <span>تعدیل دستی:</span>
                                <span className="font-mono">{(c.manualAdjustmentAmount || 0) > 0 ? `+${c.manualAdjustmentAmount}` : c.manualAdjustmentAmount}</span>
                              </div>
                            )}
                          </div>
                          <div className="border-t border-rose-200 pt-2 flex justify-between font-black text-rose-950 text-xs">
                            <span>مجموع کل کسورات:</span>
                            <span className="font-mono">-{(c.type2DeductionsTotal || 0).toLocaleString('fa-IR')} تومان</span>
                          </div>
                        </div>
                      </div>

                      {/* Net Total Payable Highlight Footer */}
                      <div className="bg-slate-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="text-xs font-bold">
                          خالص واریزی و قابل پرداخت این دوره به حساب طلبه:
                        </div>
                        <div className="text-2xl font-mono font-black text-emerald-400">
                          {(c.netPayableTuition || 0).toLocaleString('fa-IR')} <span className="text-xs font-normal text-white">تومان</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: تنظیمات جامع فرمول محاسبه شهریه                       */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {isSettingsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-8"
              dir="rtl"
            >
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <SlidersHorizontal size={20} className="text-emerald-400" />
                  <div>
                    <h3 className="text-base font-black">تنظیمات جامع فرمول و فاکتورهای محاسبه شهریه</h3>
                    <p className="text-xs text-slate-400 mt-0.5">تعیین ضوابط تاثیر تاهل، مطالعه، غیبت، مشاوره، نهار و وام</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveSettings} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
                {/* 1. شهریه پایه و تاهل */}
                <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                    <DollarSign size={16} className="text-emerald-600" />
                    <span>۱. ضوابط شهریه پایه و تاهل</span>
                  </h4>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={settings.isBaseTuitionEqualForMarried}
                        onChange={e => setSettings({ ...settings, isBaseTuitionEqualForMarried: e.target.checked })}
                        className="rounded text-emerald-600 w-4 h-4"
                      />
                      <span>آیا برای متاهلین و مجردین، شهریه پایه یکسان است؟</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">
                        شهریه پایه مجردین (تومان):
                      </label>
                      <input
                        type="number"
                        value={settings.singleBaseTuition || settings.baseSingleTuition || 2000000}
                        onChange={e => setSettings({ ...settings, singleBaseTuition: Number(e.target.value), baseSingleTuition: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 outline-none focus:border-emerald-500"
                      />
                    </div>

                    {!settings.isBaseTuitionEqualForMarried && (
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">
                          شهریه پایه متاهلین (تومان):
                        </label>
                        <input
                          type="number"
                          value={settings.marriedBaseTuition || settings.baseMarriedTuition || 3200000}
                          onChange={e => setSettings({ ...settings, marriedBaseTuition: Number(e.target.value), baseMarriedTuition: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 outline-none focus:border-emerald-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* شرط تاهل */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={settings.hasMarriageBonus ?? true}
                        onChange={e => setSettings({ ...settings, hasMarriageBonus: e.target.checked })}
                        className="rounded text-emerald-600 w-4 h-4"
                      />
                      <span className="text-slate-900">آیا تاهل سبب افزایش شهریه می‌شود؟</span>
                    </label>

                    {(settings.hasMarriageBonus ?? true) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">نوع محاسبه افزایش تاهل:</label>
                          <select
                            value={settings.marriageBonusType || 'percentage'}
                            onChange={e => setSettings({ ...settings, marriageBonusType: e.target.value as any })}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
                          >
                            <option value="percentage">افزایش درصدی از شهریه پایه</option>
                            <option value="fixed">مبلغ تومانی ثابت</option>
                          </select>
                        </div>

                        {settings.marriageBonusType === 'percentage' ? (
                          <div>
                            <label className="block text-slate-600 font-bold mb-1">درصد اضافه بابت تاهل (%):</label>
                            <input
                              type="number"
                              value={settings.marriageBonusPercent || 25}
                              onChange={e => setSettings({ ...settings, marriageBonusPercent: Number(e.target.value) })}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 outline-none focus:border-emerald-500"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-slate-600 font-bold mb-1">مبلغ اضافه بابت تاهل (تومان):</label>
                            <input
                              type="number"
                              value={settings.marriageBonusAmount || 1000000}
                              onChange={e => setSettings({ ...settings, marriageBonusAmount: Number(e.target.value) })}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 outline-none focus:border-emerald-500"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* حق اولاد */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={settings.hasChildAllowance ?? true}
                        onChange={e => setSettings({ ...settings, hasChildAllowance: e.target.checked })}
                        className="rounded text-emerald-600 w-4 h-4"
                      />
                      <span className="text-slate-900">آیا حق اولاد داریم؟</span>
                    </label>

                    {(settings.hasChildAllowance ?? true) && (
                      <div className="pt-2 border-t border-slate-100">
                        <label className="block text-slate-600 font-bold mb-1">مبلغ حق اولاد به ازای هر فرزند (تومان):</label>
                        <input
                          type="number"
                          value={settings.childAllowancePerChild || settings.childAllowance || 350000}
                          onChange={e => setSettings({ ...settings, childAllowancePerChild: Number(e.target.value), childAllowance: Number(e.target.value) })}
                          className="w-full sm:w-1/2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 outline-none focus:border-emerald-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* تلبس و معمم بودن */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={settings.hasTurbanAllowance ?? true}
                        onChange={e => setSettings({ ...settings, hasTurbanAllowance: e.target.checked })}
                        className="rounded text-emerald-600 w-4 h-4"
                      />
                      <span className="text-slate-900">آیا تلبس و معمم بودن سبب افزایش شهریه می‌شود؟</span>
                    </label>

                    {(settings.hasTurbanAllowance ?? true) && (
                      <div className="pt-2 border-t border-slate-100">
                        <label className="block text-slate-600 font-bold mb-1">مبلغ پاداش تلبس / معمم بودن (تومان):</label>
                        <input
                          type="number"
                          value={settings.turbanAllowance || settings.clericalHabitBonus || 500000}
                          onChange={e => setSettings({ ...settings, turbanAllowance: Number(e.target.value), clericalHabitBonus: Number(e.target.value) })}
                          className="w-full sm:w-1/2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 outline-none focus:border-emerald-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* کمک هزینه مسکن */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={settings.hasHousingAllowance ?? true}
                        onChange={e => setSettings({ ...settings, hasHousingAllowance: e.target.checked })}
                        className="rounded text-emerald-600 w-4 h-4"
                      />
                      <span className="text-slate-900">آیا کمک هزینه مسکن پرداخت می‌شود؟</span>
                    </label>

                    {(settings.hasHousingAllowance ?? true) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">کمک هزینه مسکن اجاره‌ای (تومان):</label>
                          <input
                            type="number"
                            value={settings.housingAllowanceRented || settings.housingSubsidy || 600000}
                            onChange={e => setSettings({ ...settings, housingAllowanceRented: Number(e.target.value), housingSubsidy: Number(e.target.value) })}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">کمک هزینه مسکن خوابگاهی / سایر (تومان):</label>
                          <input
                            type="number"
                            value={settings.housingAllowanceDorm || 250000}
                            onChange={e => setSettings({ ...settings, housingAllowanceDorm: Number(e.target.value) })}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. ضوابط ساعت مطالعه */}
                <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                    <Clock size={16} className="text-indigo-600" />
                    <span>۲. ضوابط پاداش و جریمه ساعت مطالعه</span>
                  </h4>

                  {/* بخش الف: پاداش مطالعه مازاد */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={settings.studyBonusEnabled}
                        onChange={e => setSettings({ ...settings, studyBonusEnabled: e.target.checked })}
                        className="rounded text-emerald-600 w-4 h-4"
                      />
                      <span className="text-slate-900">آیا مطالعه مازاد موجب افزایش و پاداش شهریه شود؟</span>
                    </label>

                    {settings.studyBonusEnabled && (
                      <div className="space-y-3 pt-2 border-t border-slate-100">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-600 font-bold mb-1">مبنای سنجش مطالعه مازاد:</label>
                            <select
                              value={settings.studyBonusBase || 'mandatory'}
                              onChange={e => setSettings({ ...settings, studyBonusBase: e.target.value as any })}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
                            >
                              <option value="mandatory">نسبت به موظفی استاندارد</option>
                              <option value="average">نسبت به میانگین مطالعه کل طلاب</option>
                            </select>
                          </div>

                          <div className="flex items-center pt-6">
                            <label className="flex items-center gap-2 cursor-pointer font-bold text-indigo-700">
                              <input
                                type="checkbox"
                                checked={settings.studyBonusTiered ?? false}
                                onChange={e => setSettings({ ...settings, studyBonusTiered: e.target.checked })}
                                className="rounded text-indigo-600 w-4 h-4"
                              />
                              <span>محاسبه پاداش به صورت پله‌ای انجام شود؟</span>
                            </label>
                          </div>
                        </div>

                        {settings.studyBonusTiered ? (
                          <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-indigo-950 text-xs">
                                تعریف پله‌های پاداش مطالعه (حداکثر ۵ پله) - تجمیعی:
                              </span>
                              {(settings.studyBonusTiers?.length || 0) < 5 && (
                                <button
                                  type="button"
                                  onClick={handleAddBonusTier}
                                  className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 cursor-pointer transition-all flex items-center gap-1"
                                >
                                  <Plus size={14} />
                                  <span>افزودن پله</span>
                                </button>
                              )}
                            </div>
                            <p className="text-[11px] text-indigo-800">
                              * در محاسبه تجمیعی، هر پله‌ای که طلبه حد نصاب آن را کسب کند پاداش آن پله به همراه پله‌های قبلی به او تعلق می‌گیرد.
                            </p>

                            <div className="space-y-2">
                              {(settings.studyBonusTiers || []).map((tier, idx) => (
                                <div key={tier.id || idx} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-white p-2.5 rounded-lg border border-indigo-200">
                                  <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded font-black text-xs min-w-[55px] text-center">
                                    پله {idx + 1}
                                  </span>
                                  <div className="flex items-center gap-1 text-xs text-slate-600 flex-1">
                                    <span>از</span>
                                    <input
                                      type="number"
                                      value={tier.minMinutes}
                                      onChange={e => handleUpdateBonusTier(idx, 'minMinutes', Number(e.target.value))}
                                      className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono text-center"
                                    />
                                    <span>تا</span>
                                    <input
                                      type="number"
                                      value={tier.maxMinutes}
                                      onChange={e => handleUpdateBonusTier(idx, 'maxMinutes', Number(e.target.value))}
                                      className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono text-center"
                                    />
                                    <span>دقیقه مازاد:</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs text-slate-700">
                                    <span className="font-bold">پاداش:</span>
                                    <input
                                      type="number"
                                      value={tier.amount}
                                      onChange={e => handleUpdateBonusTier(idx, 'amount', Number(e.target.value))}
                                      className="w-28 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono text-emerald-700 font-bold text-center"
                                    />
                                    <span>تومان</span>
                                  </div>
                                  {(settings.studyBonusTiers?.length || 0) > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveBonusTier(idx)}
                                      className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer transition-all"
                                      title="حذف پله"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-slate-600 font-bold mb-1">
                                حداقل دقیقه مازاد برای پاداش:
                              </label>
                              <input
                                type="number"
                                value={settings.studyBonusThresholdMinutes || 60}
                                onChange={e => setSettings({ ...settings, studyBonusThresholdMinutes: Number(e.target.value) })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-600 font-bold mb-1">نوع محاسبه پاداش خطی:</label>
                              <select
                                value={settings.studyBonusCalculationType || 'per_hour'}
                                onChange={e => setSettings({ ...settings, studyBonusCalculationType: e.target.value as any })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
                              >
                                <option value="per_hour">به ازای هر ساعت مازاد</option>
                                <option value="fixed">مبلغ ثابت کلی</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-slate-600 font-bold mb-1">
                                {settings.studyBonusCalculationType === 'fixed' ? 'مبلغ ثابت پاداش (تومان):' : 'پاداش هر ساعت مازاد (تومان):'}
                              </label>
                              <input
                                type="number"
                                value={settings.studyBonusCalculationType === 'fixed' ? (settings.studyBonusFixedAmount || 150000) : (settings.studyBonusRatePerHour || 30000)}
                                onChange={e => {
                                  if (settings.studyBonusCalculationType === 'fixed') {
                                    setSettings({ ...settings, studyBonusFixedAmount: Number(e.target.value) });
                                  } else {
                                    setSettings({ ...settings, studyBonusRatePerHour: Number(e.target.value), studyBonusPerHour: Number(e.target.value) });
                                  }
                                }}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* بخش ب: جریمه کسری مطالعه */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={settings.studyPenaltyEnabled}
                        onChange={e => setSettings({ ...settings, studyPenaltyEnabled: e.target.checked })}
                        className="rounded text-rose-600 w-4 h-4"
                      />
                      <span className="text-slate-900">آیا کسری مطالعه موجب کسر از شهریه شود؟</span>
                    </label>

                    {settings.studyPenaltyEnabled && (
                      <div className="space-y-3 pt-2 border-t border-slate-100">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-600 font-bold mb-1">مبنای سنجش کسری مطالعه:</label>
                            <select
                              value={settings.studyPenaltyBase || (settings.studyPenaltyThreshold === 'below_average' ? 'average' : 'mandatory')}
                              onChange={e => setSettings({ ...settings, studyPenaltyBase: e.target.value as any, studyPenaltyThreshold: e.target.value === 'average' ? 'below_average' : 'below_mandatory' })}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
                            >
                              <option value="mandatory">کسری نسبت به موظفی استاندارد</option>
                              <option value="average">کسری نسبت به میانگین مطالعه کل طلاب</option>
                            </select>
                          </div>

                          <div className="flex items-center pt-6">
                            <label className="flex items-center gap-2 cursor-pointer font-bold text-rose-700">
                              <input
                                type="checkbox"
                                checked={settings.studyPenaltyTiered ?? false}
                                onChange={e => setSettings({ ...settings, studyPenaltyTiered: e.target.checked })}
                                className="rounded text-rose-600 w-4 h-4"
                              />
                              <span>محاسبه کسر جریمه به صورت پله‌ای انجام شود؟</span>
                            </label>
                          </div>
                        </div>

                        {settings.studyPenaltyTiered ? (
                          <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-rose-950 text-xs">
                                تعریف پله‌های کسر کسری مطالعه (حداکثر ۵ پله) - تجمیعی:
                              </span>
                              {(settings.studyPenaltyTiers?.length || 0) < 5 && (
                                <button
                                  type="button"
                                  onClick={handleAddPenaltyTier}
                                  className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 cursor-pointer transition-all flex items-center gap-1"
                                >
                                  <Plus size={14} />
                                  <span>افزودن پله</span>
                                </button>
                              )}
                            </div>
                            <p className="text-[11px] text-rose-800">
                              * در محاسبه تجمیعی کسری، با عبور کسری مطالعه از هر پله، مبلغ آن پله به همراه پله‌های قبلی از شهریه کسر می‌گردد.
                            </p>

                            <div className="space-y-2">
                              {(settings.studyPenaltyTiers || []).map((tier, idx) => (
                                <div key={tier.id || idx} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-white p-2.5 rounded-lg border border-rose-200">
                                  <span className="px-2 py-1 bg-rose-100 text-rose-800 rounded font-black text-xs min-w-[55px] text-center">
                                    پله {idx + 1}
                                  </span>
                                  <div className="flex items-center gap-1 text-xs text-slate-600 flex-1">
                                    <span>از</span>
                                    <input
                                      type="number"
                                      value={tier.minMinutes}
                                      onChange={e => handleUpdatePenaltyTier(idx, 'minMinutes', Number(e.target.value))}
                                      className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono text-center"
                                    />
                                    <span>تا</span>
                                    <input
                                      type="number"
                                      value={tier.maxMinutes}
                                      onChange={e => handleUpdatePenaltyTier(idx, 'maxMinutes', Number(e.target.value))}
                                      className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono text-center"
                                    />
                                    <span>دقیقه کسری:</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs text-slate-700">
                                    <span className="font-bold">کسر جریمه:</span>
                                    <input
                                      type="number"
                                      value={tier.amount}
                                      onChange={e => handleUpdatePenaltyTier(idx, 'amount', Number(e.target.value))}
                                      className="w-28 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono text-rose-700 font-bold text-center"
                                    />
                                    <span>تومان</span>
                                  </div>
                                  {(settings.studyPenaltyTiers?.length || 0) > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePenaltyTier(idx)}
                                      className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer transition-all"
                                      title="حذف پله"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-slate-600 font-bold mb-1">نوع محاسبه جریمه خطی:</label>
                              <select
                                value={settings.studyPenaltyCalculationType || 'per_hour'}
                                onChange={e => setSettings({ ...settings, studyPenaltyCalculationType: e.target.value as any })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
                              >
                                <option value="per_hour">به ازای هر ساعت کسری</option>
                                <option value="fixed">مبلغ ثابت کلی</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-slate-600 font-bold mb-1">
                                {settings.studyPenaltyCalculationType === 'fixed' ? 'مبلغ ثابت کسر کسری (تومان):' : 'جریمه کسر هر ساعت کسری (تومان):'}
                              </label>
                              <input
                                type="number"
                                value={settings.studyPenaltyCalculationType === 'fixed' ? (settings.studyPenaltyFixedAmount || 100000) : (settings.studyPenaltyRatePerHour || 25000)}
                                onChange={e => {
                                  if (settings.studyPenaltyCalculationType === 'fixed') {
                                    setSettings({ ...settings, studyPenaltyFixedAmount: Number(e.target.value) });
                                  } else {
                                    setSettings({ ...settings, studyPenaltyRatePerHour: Number(e.target.value), studyPenaltyPerHour: Number(e.target.value) });
                                  }
                                }}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. ضوابط غیبت و حضور و غیاب */}
                <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                    <CheckSquare size={16} className="text-rose-600" />
                    <span>۳. ضوابط کسر غیبت‌های کلاسی</span>
                  </h4>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={settings.absenceDeductionEnabled ?? true}
                        onChange={e => setSettings({ ...settings, absenceDeductionEnabled: e.target.checked })}
                        className="rounded text-rose-600 w-4 h-4"
                      />
                      <span className="text-slate-900">آیا غیبت‌ها موجب کسر از شهریه بشود؟</span>
                    </label>

                    {(settings.absenceDeductionEnabled ?? true) && (
                      <div className="space-y-3 pt-2 border-t border-slate-100">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-600 font-bold mb-1">روش کسر غیبت:</label>
                            <select
                              value={settings.absenceDeductionMode || 'unexcused_only'}
                              onChange={e => setSettings({ ...settings, absenceDeductionMode: e.target.value as any })}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
                            >
                              <option value="unexcused_only">تنها غیبت‌های غیرموجه موجب کسر شهریه شود</option>
                              <option value="both_different">غیبت غیرموجه به یک میزان و غیبت موجه به میزانی دیگر کسر شود</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-slate-600 font-bold mb-1">نوع محاسبه کسر غیبت غیرموجه:</label>
                            <select
                              value={settings.absencePenaltyUnexcusedType || 'fixed'}
                              onChange={e => setSettings({ ...settings, absencePenaltyUnexcusedType: e.target.value as any })}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
                            >
                              <option value="fixed">مبلغ تومانی ثابت به ازای هر جلسه</option>
                              <option value="percentage">درصدی از شهریه پایه به ازای هر جلسه</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          {settings.absencePenaltyUnexcusedType === 'percentage' ? (
                            <div>
                              <label className="block text-slate-600 font-bold mb-1">
                                درصد کسر به ازای هر جلسه غیبت غیرموجه (%):
                              </label>
                              <input
                                type="number"
                                value={settings.absencePenaltyUnexcusedPercent || 4}
                                onChange={e => setSettings({ ...settings, absencePenaltyUnexcusedPercent: Number(e.target.value) })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 outline-none"
                              />
                            </div>
                          ) : (
                            <div>
                              <label className="block text-slate-600 font-bold mb-1">
                                مبلغ کسر هر جلسه غیبت غیرموجه (تومان):
                              </label>
                              <input
                                type="number"
                                value={settings.absencePenaltyUnexcusedAmount || 90000}
                                onChange={e => setSettings({ ...settings, absencePenaltyUnexcusedAmount: Number(e.target.value), absencePenaltyPerSession: Number(e.target.value) })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 outline-none"
                              />
                            </div>
                          )}

                          {settings.absenceDeductionMode === 'both_different' && (
                            <div>
                              <label className="block text-slate-600 font-bold mb-1">
                                مبلغ کسر هر جلسه غیبت موجه (تومان):
                              </label>
                              <input
                                type="number"
                                value={settings.absencePenaltyExcusedAmount || 25000}
                                onChange={e => setSettings({ ...settings, absencePenaltyExcusedAmount: Number(e.target.value) })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 outline-none"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. ارزیابی کلاس‌های مشاوره */}
                <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                    <BookCheck size={16} className="text-teal-600" />
                    <span>۴. پاداش نمرات ارزیابی کلاس‌های مشاوره</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    تعیین مبلغ اضافه به شهریه به ازای دریافت هر نمره الف، ب یا ج در کلاس‌های مشاوره
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">
                        پاداش هر نمره «الف» (تومان):
                      </label>
                      <input
                        type="number"
                        value={settings.counselingGradeABonus ?? 30000}
                        onChange={e => setSettings({ ...settings, counselingGradeABonus: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">
                        پاداش هر نمره «ب» (تومان):
                      </label>
                      <input
                        type="number"
                        value={settings.counselingGradeBBonus ?? 15000}
                        onChange={e => setSettings({ ...settings, counselingGradeBBonus: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">
                        پاداش هر نمره «ج» (تومان):
                      </label>
                      <input
                        type="number"
                        value={settings.counselingGradeCBonus ?? 0}
                        onChange={e => setSettings({ ...settings, counselingGradeCBonus: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. نهار، وام و صندوق قرض‌الحسنه و بانک بدهی‌ها */}
                <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                    <UtensilsCrossed size={16} className="text-amber-600" />
                    <span>۵. ضوابط نهار، اقساط وام، صندوق قرض‌الحسنه و بانک بدهی‌ها</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">
                        هزینه روزانه نهار (تومان):
                      </label>
                      <input
                        type="number"
                        value={settings.dailyLunchCost || 45000}
                        onChange={e => setSettings({ ...settings, dailyLunchCost: Number(e.target.value), lunchCostPerDay: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 font-bold mb-1">
                        هزینه روزانه شام (تومان):
                      </label>
                      <input
                        type="number"
                        value={settings.dailyDinnerCost || settings.dinnerCostPerDay || 35000}
                        onChange={e => setSettings({ ...settings, dailyDinnerCost: Number(e.target.value), dinnerCostPerDay: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 outline-none"
                      />
                    </div>

                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={settings.deductActiveLoans}
                          onChange={e => setSettings({ ...settings, deductActiveLoans: e.target.checked })}
                          className="rounded text-emerald-600 w-4 h-4"
                        />
                        <span>اعمال کسر اقساط وام‌های فعال</span>
                      </label>
                    </div>

                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={settings.deductFundContribution}
                          onChange={e => setSettings({ ...settings, deductFundContribution: e.target.checked })}
                          className="rounded text-emerald-600 w-4 h-4"
                        />
                        <span>اعمال کسر کمک مالی به صندوق</span>
                      </label>
                    </div>
                  </div>

                  {/* عناوینی که در بانک بدهی‌ها ایجاد شده است */}
                  <div className="pt-3 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <HandCoins size={14} className="text-emerald-600" />
                        <span>عناوین مجاز کسر از بانک بدهی‌ها در محاسبه این دوره:</span>
                      </label>
                      <span className="text-[10px] text-slate-500">
                        (عناوینی که تیک می‌خورند در کسر شهریه این دوره محاسبه خواهند شد)
                      </span>
                    </div>

                    {claimCategories.length === 0 ? (
                      <p className="text-slate-400 text-xs italic bg-white p-3 rounded-xl border border-slate-200">
                        هنوز عنوانی در بانک بدهی‌ها ثبت نشده است. عناوین ثبت‌شده در بخش مدیریت مطالبات در اینجا برای انتخاب ظاهر می‌شوند.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {claimCategories.map(cat => {
                          const isChecked = !settings.enabledClaimCategoryIds || settings.enabledClaimCategoryIds.length === 0 || settings.enabledClaimCategoryIds.includes(cat.id);
                          return (
                            <label key={cat.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-400 cursor-pointer transition-all">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={e => {
                                  const current = settings.enabledClaimCategoryIds && settings.enabledClaimCategoryIds.length > 0
                                    ? settings.enabledClaimCategoryIds
                                    : claimCategories.map(c => c.id);
                                  let nextList: string[];
                                  if (e.target.checked) {
                                    nextList = [...current, cat.id];
                                  } else {
                                    nextList = current.filter(id => id !== cat.id);
                                  }
                                  setSettings({ ...settings, enabledClaimCategoryIds: nextList });
                                }}
                                className="rounded text-emerald-600 w-4 h-4"
                              />
                              <div className="truncate">
                                <span className="font-bold text-slate-800 text-xs block truncate">{cat.title}</span>
                                <span className="text-[9px] text-slate-400">
                                  {cat.targetType === 'teacher' ? 'مربوط به اساتید' : cat.targetType === 'staff' ? 'مربوط به کارکنان' : 'مربوط به طلاب'}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsSettingsModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer transition-all"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer transition-all shadow-md flex items-center gap-1.5"
                  >
                    <Check size={16} />
                    <span>ذخیره و اعمال تنظیمات</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: ایجاد دوره پرداخت شهریه                             */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {isNewPeriodModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden"
              dir="rtl"
            >
              <div className="p-5 bg-emerald-700 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Calendar size={20} />
                  <div>
                    <h3 className="text-base font-black">ایجاد دوره جدید پرداخت شهریه</h3>
                    <p className="text-xs text-emerald-100">تعیین عنوان دوره و بازه زمانی استخراج فعالیت‌ها</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewPeriodModalOpen(false)}
                  className="p-1.5 text-emerald-100 hover:text-white rounded-xl hover:bg-emerald-600 transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleConfirmPeriodRange} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">عنوان دوره پرداخت:</label>
                  <input
                    type="text"
                    required
                    value={newPeriodTitle}
                    onChange={e => setNewPeriodTitle(e.target.value)}
                    placeholder="مثال: شهریه مهر ماه ۱۴۰۳"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5">تاریخ شروع دوره:</label>
                    <ShamsiDatePicker
                      value={newPeriodStartDate}
                      onChange={setNewPeriodStartDate}
                      placeholder="تاریخ شروع"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5">تاریخ پایان دوره:</label>
                    <ShamsiDatePicker
                      value={newPeriodEndDate}
                      onChange={setNewPeriodEndDate}
                      placeholder="تاریخ پایان"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <Info size={14} className="text-emerald-700" />
                    <span>پنجره زمانی محاسبات دوره:</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    با تایید این بخش، وارد فرآیند بررسی کارکرد طلاب و محاسبه مکانیزه شهریه برای این بازه زمانی خواهید شد.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsNewPeriodModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer shadow-md flex items-center gap-1.5"
                  >
                    <Check size={16} />
                    <span>تایید و ورود به دوره پرداخت شهریه</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: فیش تفکیکی و تمامی فاکتورهای موثر طلبه             */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {selectedSlipDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8"
              dir="rtl"
            >
              {/* Slip Header */}
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold block uppercase tracking-wider">
                    فیش رسمی پرداخت شهریه و کارکرد
                  </span>
                  <h3 className="text-base font-black mt-0.5">
                    {selectedSlipDetail.studentName} ({selectedSlipDetail.grade})
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-1">
                    <span>دوره: {selectedSlipDetail.periodTitle || 'شهریه جاری'}</span>
                    <span>•</span>
                    <span>کد ملی: {selectedSlipDetail.nationalId || '---'}</span>
                    <span>•</span>
                    <span>کد موسسه: {selectedSlipDetail.instituteCode || '---'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePrintSlip}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Printer size={14} />
                    <span>چاپ فیش</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSlipDetail(null)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Slip Body */}
              <div className="p-6 space-y-5 text-xs">
                {/* Banking & Identity Strip */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-slate-500 block text-[11px]">وضعیت تاهل و سکونت:</span>
                    <span className="font-bold text-slate-800">
                      {selectedSlipDetail.maritalStatus} {selectedSlipDetail.childrenCount ? `• ${selectedSlipDetail.childrenCount} فرزند` : ''} • سکونت: {selectedSlipDetail.livingStatus || 'پدری'} {selectedSlipDetail.isTammam ? '• معمم' : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">شماره حساب / شبا بانکی:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {selectedSlipDetail.bankSheba || selectedSlipDetail.bankAccount || 'ثبت نشده'}
                    </span>
                  </div>
                </div>

                {/* Section 1: Earnings / Additions Breakdown */}
                <div className="space-y-2">
                  <h4 className="font-black text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>۱. شهریه پایه، مزایا و پاداش‌ها (Earnings)</span>
                  </h4>
                  <div className="bg-emerald-50/50 rounded-2xl border border-emerald-100 divide-y divide-emerald-100/60 p-3 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-700">شهریه پایه مصوب دوره:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {(selectedSlipDetail.baseTuition || 0).toLocaleString('fa-IR')} تومان
                      </span>
                    </div>

                    {(selectedSlipDetail.maritalBonus || 0) > 0 && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-700">پاداش تاهل:</span>
                        <span className="font-mono font-bold text-emerald-700">
                          +{(selectedSlipDetail.maritalBonus || 0).toLocaleString('fa-IR')} تومان
                        </span>
                      </div>
                    )}

                    {(selectedSlipDetail.childAllowanceTotal || 0) > 0 && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-700">حق اولاد ({selectedSlipDetail.childrenCount} فرزند):</span>
                        <span className="font-mono font-bold text-emerald-700">
                          +{(selectedSlipDetail.childAllowanceTotal || 0).toLocaleString('fa-IR')} تومان
                        </span>
                      </div>
                    )}

                    {(selectedSlipDetail.turbanAllowance || 0) > 0 && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-700">پاداش تلبس / معمم بودن:</span>
                        <span className="font-mono font-bold text-emerald-700">
                          +{(selectedSlipDetail.turbanAllowance || 0).toLocaleString('fa-IR')} تومان
                        </span>
                      </div>
                    )}

                    {(selectedSlipDetail.housingAllowance || 0) > 0 && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-700">کمک هزینه مسکن ({selectedSlipDetail.livingStatus}):</span>
                        <span className="font-mono font-bold text-emerald-700">
                          +{(selectedSlipDetail.housingAllowance || 0).toLocaleString('fa-IR')} تومان
                        </span>
                      </div>
                    )}

                    {(selectedSlipDetail.studyBonusAmount || 0) > 0 && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-700">
                          پاداش مطالعه مازاد بر موظفی ({Math.floor((selectedSlipDetail.studyMinutesTotal || 0) / 60)} ساعت مطالعه):
                        </span>
                        <span className="font-mono font-bold text-emerald-700">
                          +{(selectedSlipDetail.studyBonusAmount || 0).toLocaleString('fa-IR')} تومان
                        </span>
                      </div>
                    )}

                    {(selectedSlipDetail.counselingBonusAmount || 0) > 0 && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-700">
                          پاداش ارزیابی کلاس‌های مشاوره ({selectedSlipDetail.counselingGradeACount} الف، {selectedSlipDetail.counselingGradeBCount} ب):
                        </span>
                        <span className="font-mono font-bold text-emerald-700">
                          +{(selectedSlipDetail.counselingBonusAmount || 0).toLocaleString('fa-IR')} تومان
                        </span>
                      </div>
                    )}

                    {(selectedSlipDetail.manualAdjustmentAmount || 0) > 0 && (
                      <div className="flex items-center justify-between pt-1 bg-emerald-100/40 p-1.5 rounded-lg">
                        <span className="text-emerald-900 font-bold">
                          افزایش دستی مسئول مالی {selectedSlipDetail.manualAdjustmentReason ? `(${selectedSlipDetail.manualAdjustmentReason})` : ''}:
                        </span>
                        <span className="font-mono font-bold text-emerald-800">
                          +{(selectedSlipDetail.manualAdjustmentAmount || 0).toLocaleString('fa-IR')} تومان
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1.5 font-bold text-slate-800 border-t border-emerald-200">
                      <span>جمع ناخالص و پاداش‌ها:</span>
                      <span className="font-mono font-black text-emerald-800">
                        {((selectedSlipDetail.baseTuition || 0) + (selectedSlipDetail.totalAdditions || 0)).toLocaleString('fa-IR')} تومان
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 2: Type 1 Direct Penalties */}
                <div className="space-y-2">
                  <h4 className="font-black text-rose-800 flex items-center gap-1">
                    <XCircle size={14} className="text-rose-600" />
                    <span>۲. کسورات نوع اول - مستقیم (کاهنده از استحقاقی)</span>
                  </h4>
                  <div className="bg-rose-50/50 rounded-2xl border border-rose-100 divide-y divide-rose-100/60 p-3 space-y-1.5 text-[11px]">
                    {(selectedSlipDetail.absencePenaltyAmount || 0) > 0 ? (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-700">
                          کسر غیبت کلاسی ({selectedSlipDetail.unexcusedAbsenceCount} غیرموجه، {selectedSlipDetail.excusedAbsenceCount} موجه):
                        </span>
                        <span className="font-mono font-bold text-rose-700">
                          -{(selectedSlipDetail.absencePenaltyAmount || 0).toLocaleString('fa-IR')} تومان
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-1 text-slate-400">
                        <span>کسر غیبت کلاسی:</span>
                        <span>۰ تومان</span>
                      </div>
                    )}

                    {(selectedSlipDetail.studyPenaltyAmount || 0) > 0 ? (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-700">جریمه کسری ساعت مطالعه نسبت به موظفی:</span>
                        <span className="font-mono font-bold text-rose-700">
                          -{(selectedSlipDetail.studyPenaltyAmount || 0).toLocaleString('fa-IR')} تومان
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-1 text-slate-400">
                        <span>جریمه کسری مطالعه:</span>
                        <span>۰ تومان</span>
                      </div>
                    )}

                    {(selectedSlipDetail.manualAdjustmentAmount || 0) < 0 && (
                      <div className="flex items-center justify-between pt-1 bg-rose-100/50 p-1.5 rounded-lg">
                        <span className="text-rose-900 font-bold">
                          کاهش دستی مسئول مالی {selectedSlipDetail.manualAdjustmentReason ? `(${selectedSlipDetail.manualAdjustmentReason})` : ''}:
                        </span>
                        <span className="font-mono font-bold text-rose-800">
                          {Math.abs(selectedSlipDetail.manualAdjustmentAmount || 0).toLocaleString('fa-IR')} تومان-
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1.5 font-bold text-rose-900 border-t border-rose-200">
                      <span>جمع کسورات نوع اول:</span>
                      <span className="font-mono font-black text-rose-800">
                        -{(selectedSlipDetail.type1DeductionsTotal || 0).toLocaleString('fa-IR')} تومان
                      </span>
                    </div>
                  </div>
                </div>

                {/* Gross Earned / Upper Management Invoiced Amount */}
                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-300 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-black text-amber-900 block">شهریه استحقاقی مصوب (فاکتور بالادستی):</span>
                    <span className="text-[10px] text-amber-700">پایه + اضافات - کسورات نوع اول</span>
                  </div>
                  <div className="font-mono font-black text-base text-amber-900">
                    {(selectedSlipDetail.grossEarnedTuition || 0).toLocaleString('fa-IR')} <span className="text-xs font-sans">تومان</span>
                  </div>
                </div>

                {/* Section 3: Type 2 Transfer Deductions to Destination Accounts */}
                <div className="space-y-2">
                  <h4 className="font-black text-indigo-900 flex items-center gap-1">
                    <ArrowLeftRight size={14} className="text-indigo-600" />
                    <span>۳. کسورات نوع دوم - حواله به حساب‌های مقصد</span>
                  </h4>
                  <div className="bg-indigo-50/40 rounded-2xl border border-indigo-100 divide-y divide-indigo-100/60 p-3 space-y-1.5 text-[11px]">
                    {(selectedSlipDetail.kitchenTransferAmount || 0) > 0 && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-700 flex items-center gap-1">
                          <UtensilsCrossed size={12} className="text-amber-600" />
                          <span>سهم آشپزخانه و نهار ({selectedSlipDetail.lunchDaysCount} روز):</span>
                        </span>
                        <span className="font-mono font-bold text-indigo-700">
                          -{(selectedSlipDetail.kitchenTransferAmount || 0).toLocaleString('fa-IR')} تومان
                        </span>
                      </div>
                    )}

                    {(selectedSlipDetail.culturalTransferAmount || 0) > 0 && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-700 flex items-center gap-1">
                          <BookOpen size={12} className="text-teal-600" />
                          <span>سهم امور فرهنگی و عتبات:</span>
                        </span>
                        <span className="font-mono font-bold text-indigo-700">
                          -{(selectedSlipDetail.culturalTransferAmount || 0).toLocaleString('fa-IR')} تومان
                        </span>
                      </div>
                    )}

                    {(selectedSlipDetail.qardFundTransferAmount || 0) > 0 && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-700 flex items-center gap-1">
                          <CreditCard size={12} className="text-indigo-600" />
                          <span>سهم صندوق قرض‌الحسنه (اقساط وام و پس‌انداز):</span>
                        </span>
                        <span className="font-mono font-bold text-indigo-700">
                          -{(selectedSlipDetail.qardFundTransferAmount || 0).toLocaleString('fa-IR')} تومان
                        </span>
                      </div>
                    )}

                    {(selectedSlipDetail.otherTransferAmount || 0) > 0 && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-700">سایر مطالبات و بدهی‌های انتقالی:</span>
                        <span className="font-mono font-bold text-indigo-700">
                          -{(selectedSlipDetail.otherTransferAmount || 0).toLocaleString('fa-IR')} تومان
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1.5 font-bold text-indigo-950 border-t border-indigo-200">
                      <span>مجموع حواله‌های انتقالی نوع دوم:</span>
                      <span className="font-mono font-black text-indigo-900">
                        -{(selectedSlipDetail.type2DeductionsTotal || 0).toLocaleString('fa-IR')} تومان
                      </span>
                    </div>
                  </div>
                </div>

                {/* Net Payable Highlight */}
                <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between shadow-lg">
                  <div>
                    <span className="text-xs text-slate-400 block font-bold">خالص نهایی واریز پایا به طلبه:</span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {selectedSlipDetail.bankSheba || 'حساب پیش‌فرض'}
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-400">
                    {(selectedSlipDetail.netPayableTuition || 0).toLocaleString('fa-IR')} <span className="text-xs text-slate-300 font-sans">تومان</span>
                  </div>
                </div>

                {/* Signature Strip */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <div>امضای امور مالی: {currentUser?.fullName || 'مسئول مالی'}</div>
                  <div>امضای معاونت آموزش</div>
                  <div>امضا و تایید مدیریت مدرسه</div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3.5: چاپ رسمی صورت‌وضعیت و حواله‌های تفکیکی بالادستی   */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {isUpperManagementPrintOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-6 printable-area"
              dir="rtl"
            >
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between print:hidden">
                <div className="flex items-center gap-2">
                  <FileText size={20} className="text-amber-400" />
                  <div>
                    <h3 className="text-base font-black">صورت‌وضعیت و فاکتور تفکیکی رسمی بالادستی</h3>
                    <p className="text-xs text-slate-400">حواله‌های مقاصد واریزی + لیست پایا طلاب</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Printer size={14} />
                    <span>چاپ یا ذخیره PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsUpperManagementPrintOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Official Invoice Sheet */}
              <div className="p-8 space-y-6 text-slate-800">
                {/* Official Header */}
                <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                  <div className="text-right space-y-1">
                    <h2 className="text-lg font-black text-slate-900">حوزه علمیه و موسسه تخصصی</h2>
                    <p className="text-xs text-slate-600">گزارش صورت‌وضعیت مالی و حواله‌های تفکیکی شهریه</p>
                    <p className="text-xs font-bold text-slate-800">دوره: {newPeriodTitle} (بازه {startDate} الی {endDate})</p>
                  </div>
                  <div className="text-left text-xs font-mono space-y-1">
                    <div>تاریخ صدور: {new Date().toLocaleDateString('fa-IR')}</div>
                    <div>شماره فاکتور: {Math.floor(100000 + Math.random() * 900000)}</div>
                    <div>وضعیت: <span className="text-emerald-700 font-bold">تراز شده و آماده پرداخت</span></div>
                  </div>
                </div>

                {/* Section A: 4-Way Transfer Orders Box */}
                <div className="space-y-2">
                  <h4 className="font-black text-sm text-slate-900">الف) جدول تفکیک حواله‌های بانکی (حساب‌های مقصد):</h4>
                  <table className="w-full text-right text-xs border border-slate-300">
                    <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                      <tr>
                        <th className="p-2 border-l border-slate-300">ردیف</th>
                        <th className="p-2 border-l border-slate-300">عنوان حساب مقصد</th>
                        <th className="p-2 border-l border-slate-300">نام بانک / شماره حساب / شبا</th>
                        <th className="p-2 border-l border-slate-300">نوع حواله</th>
                        <th className="p-2 text-left font-black">مبلغ حواله (تومان)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="p-2 border-l border-slate-300 font-mono">۱</td>
                        <td className="p-2 border-l border-slate-300 font-bold">حساب آشپزخانه و سلف (نهار و تغذیه)</td>
                        <td className="p-2 border-l border-slate-300 font-mono text-[11px]">
                          {destinationAccounts.find(a => a.category === 'kitchen')?.shebaNumber || 'حساب سلف مدرسه'}
                        </td>
                        <td className="p-2 border-l border-slate-300">حواله درون‌سازمانی</td>
                        <td className="p-2 font-mono font-bold text-left">{totalKitchenTransferSum.toLocaleString('fa-IR')}</td>
                      </tr>
                      <tr>
                        <td className="p-2 border-l border-slate-300 font-mono">۲</td>
                        <td className="p-2 border-l border-slate-300 font-bold">امور فرهنگی و زیارتی (عتبات و اردوها)</td>
                        <td className="p-2 border-l border-slate-300 font-mono text-[11px]">
                          {destinationAccounts.find(a => a.category === 'cultural')?.shebaNumber || 'حساب امور فرهنگی'}
                        </td>
                        <td className="p-2 border-l border-slate-300">حواله درون‌سازمانی</td>
                        <td className="p-2 font-mono font-bold text-left">{totalCulturalTransferSum.toLocaleString('fa-IR')}</td>
                      </tr>
                      <tr>
                        <td className="p-2 border-l border-slate-300 font-mono">۳</td>
                        <td className="p-2 border-l border-slate-300 font-bold">صندوق قرض‌الحسنه (اقساط وام و پس‌انداز)</td>
                        <td className="p-2 border-l border-slate-300 font-mono text-[11px]">
                          {destinationAccounts.find(a => a.category === 'qard_fund')?.shebaNumber || 'حساب صندوق قرض‌الحسنه'}
                        </td>
                        <td className="p-2 border-l border-slate-300">حواله تجمیعی صندوق</td>
                        <td className="p-2 font-mono font-bold text-left">{totalQardFundTransferSum.toLocaleString('fa-IR')}</td>
                      </tr>
                      <tr>
                        <td className="p-2 border-l border-slate-300 font-mono">۴</td>
                        <td className="p-2 border-l border-slate-300 font-bold">حساب‌های بانکی طلاب (فایل تسویه پایا)</td>
                        <td className="p-2 border-l border-slate-300 text-[11px]">واریز به شبای انفرادی طلاب ({calculatedTuitions.length} نفر)</td>
                        <td className="p-2 border-l border-slate-300">فایل پایا گروهی</td>
                        <td className="p-2 font-mono font-black text-emerald-800 text-left">{totalNetPayoutSum.toLocaleString('fa-IR')}</td>
                      </tr>
                      <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-400">
                        <td colSpan={4} className="p-2 text-right">جمع کل فاکتور مصوب استحقاقی ارسالی به بالادستی:</td>
                        <td className="p-2 font-mono text-left text-sm">{totalGrossTuitionSum.toLocaleString('fa-IR')} تومان</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Section B: Student List */}
                <div className="space-y-2">
                  <h4 className="font-black text-sm text-slate-900">ب) ریز اسامی، شماره شبا و خالص پرداختی پایا:</h4>
                  <table className="w-full text-right text-[11px] border border-slate-300">
                    <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                      <tr>
                        <th className="p-1.5 border-l border-slate-300">ردیف</th>
                        <th className="p-1.5 border-l border-slate-300">نام و نام خانوادگی</th>
                        <th className="p-1.5 border-l border-slate-300">پایه</th>
                        <th className="p-1.5 border-l border-slate-300">شماره شبا بانکی</th>
                        <th className="p-1.5 border-l border-slate-300">شهریه استحقاقی</th>
                        <th className="p-1.5 border-l border-slate-300">کسورات انتقالی</th>
                        <th className="p-1.5 font-black text-left">خالص پرداختی (تومان)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {calculatedTuitions.map((c, i) => (
                        <tr key={c.studentId}>
                          <td className="p-1.5 border-l border-slate-300 font-mono">{i + 1}</td>
                          <td className="p-1.5 border-l border-slate-300 font-bold">{c.studentName}</td>
                          <td className="p-1.5 border-l border-slate-300">{c.grade}</td>
                          <td className="p-1.5 border-l border-slate-300 font-mono text-[10px]">{c.bankSheba || c.bankAccount || '---'}</td>
                          <td className="p-1.5 border-l border-slate-300 font-mono">{c.grossEarnedTuition.toLocaleString('fa-IR')}</td>
                          <td className="p-1.5 border-l border-slate-300 font-mono text-rose-700">{c.type2DeductionsTotal.toLocaleString('fa-IR')}</td>
                          <td className="p-1.5 font-mono font-bold text-left">{c.netPayableTuition.toLocaleString('fa-IR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 3-Tier Signatures */}
                <div className="pt-8 grid grid-cols-3 gap-6 text-center text-xs font-bold text-slate-800">
                  <div className="space-y-12">
                    <div>مسئول امور مالی</div>
                    <div className="border-t border-slate-400 pt-2 font-normal text-slate-500">{currentUser?.fullName || 'مسئول مالی'}</div>
                  </div>
                  <div className="space-y-12">
                    <div>معاونت آموزش و پژوهش</div>
                    <div className="border-t border-slate-400 pt-2 font-normal text-slate-500">مهر و امضا</div>
                  </div>
                  <div className="space-y-12">
                    <div>ریاست و مدیریت عالی مدرسه</div>
                    <div className="border-t border-slate-400 pt-2 font-normal text-slate-500">تایید نهایی و صدور چک/پایا</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3.6: تفصیل و مدیریت بدهی‌های سایر کلاینت (تفصیل بدهی‌ها) */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {selectedStudentForDebtDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8"
              dir="rtl"
            >
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black">تفصیل و مدیریت بدهی‌های {selectedStudentForDebtDetail.studentName}</h3>
                  <span className="text-xs text-slate-400">پایه تحصیلی: {selectedStudentForDebtDetail.grade || 'نامشخص'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudentForDebtDetail(null);
                    setNewDebtTitle('');
                    setNewDebtAmount('');
                    setNewDebtMonthly('');
                  }}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Existing Debts list */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-800">لیست بدهی‌ها و مطالبات ثبت‌شده:</h4>
                  
                  {claimsList.filter(c => c.studentId === selectedStudentForDebtDetail.studentId).length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
                      <p className="text-xs text-slate-500 font-bold">هیچ بدهی فعالی برای این طلبه ثبت نشده است.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                            <th className="py-2.5 px-3">عنوان بدهی</th>
                            <th className="py-2.5 px-3 text-center">مبلغ کل (تومان)</th>
                            <th className="py-2.5 px-3 text-center">مانده (تومان)</th>
                            <th className="py-2.5 px-3 text-center">قسط این دوره (تومان)</th>
                            <th className="py-2.5 px-3 text-center">وضعیت</th>
                            <th className="py-2.5 px-3 text-center">حذف</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {claimsList
                            .filter(c => c.studentId === selectedStudentForDebtDetail.studentId)
                            .map((claim) => (
                              <tr key={claim.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="py-2.5 px-3 font-bold text-slate-800">{claim.claimTitle}</td>
                                <td className="py-2.5 px-3 text-center font-mono font-bold">
                                  {claim.totalDebtAmount.toLocaleString('fa-IR')}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono text-rose-600 font-bold">
                                  {(claim.remainingAmount ?? claim.totalDebtAmount).toLocaleString('fa-IR')}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono text-amber-900">
                                  {(claim.monthlyDeductionAmount || 0).toLocaleString('fa-IR')}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-bold",
                                    claim.status === 'active' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                    claim.status === 'completed' ? "bg-slate-100 text-slate-600 border border-slate-200" :
                                    "bg-amber-50 text-amber-700 border border-amber-200"
                                  )}>
                                    {claim.status === 'active' ? 'فعال' : claim.status === 'completed' ? 'تسویه شده' : 'متوقف'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteDebtDetail(claim.id)}
                                    className="p-1 text-rose-600 hover:text-rose-900 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                    title="حذف بدهی"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Add New Debt Form */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <PlusCircle size={16} className="text-indigo-600" />
                    <span>ثبت و انتساب بدهی جدید به طلبه</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 block">عنوان بدهی / کسر ماهانه</label>
                      <input
                        type="text"
                        placeholder="مثال: اقساط خرید کتب آموزشی"
                        value={newDebtTitle}
                        onChange={e => setNewDebtTitle(e.target.value)}
                        className="w-full p-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 block">دسته‌بندی بدهی</label>
                      <select
                        value={newDebtCategory}
                        onChange={e => setNewDebtCategory(e.target.value)}
                        className="w-full p-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                      >
                        <option value="سایر بدهی‌ها">سایر بدهی‌ها (عمومی)</option>
                        <option value="امور فرهنگی (عتبات/اردو)">امور فرهنگی (عتبات/اردو)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 block">مبلغ کل بدهی (تومان)</label>
                      <input
                        type="number"
                        placeholder="مثال: 500000"
                        value={newDebtAmount}
                        onChange={e => setNewDebtAmount(e.target.value)}
                        className="w-full p-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 block">مبلغ کسر قسط هر دوره (تومان)</label>
                      <input
                        type="number"
                        placeholder="خالی بگذارید تا خودکار در ۵ قسط محاسبه شود"
                        value={newDebtMonthly}
                        onChange={e => setNewDebtMonthly(e.target.value)}
                        className="w-full p-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddDebtDetail}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus size={16} />
                    <span>افزودن و ثبت نهایی بدهی روی پرونده مالی طلبه</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3.7: تایید نهایی و بایگانی کل دوره شهریه طلاب          */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {isFinalizeWarningModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden"
              dir="rtl"
            >
              <div className="p-5 bg-rose-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={20} className="text-amber-400 animate-pulse" />
                  <h3 className="text-sm font-black">تایید و ثبت نهایی دوره شهریه جاری</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFinalizeWarningModalOpen(false)}
                  className="p-1.5 text-rose-300 hover:text-white rounded-xl hover:bg-rose-800 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  آیا از بستن، ثبت نهایی و انتقال دوره شهریه <span className="font-bold text-slate-900">«{newPeriodTitle}»</span> به بایگانی اطمینان کامل دارید؟
                </p>
                
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-900 space-y-2">
                  <h4 className="text-[11px] font-bold">⚠️ توجه فرمایید:</h4>
                  <ul className="list-disc list-inside text-[11px] space-y-1">
                    <li>پس از تایید، کلیه محاسبات، کسری‌ها و پاداش‌های این دوره فریز خواهند شد.</li>
                    <li>مانده بدهی‌های طلاب به صورت خودکار بر اساس اقساط این دوره کسر و به‌روزرسانی خواهد شد.</li>
                    <li>گزارش اکسل رسمی پایا و گزارش‌های بالادستی این دوره قفل و بایگانی می‌شوند.</li>
                  </ul>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">تعداد پرونده‌های محاسبه شده:</span>
                    <span className="font-bold text-slate-800">{calculatedTuitions.length.toLocaleString('fa-IR')} نفر</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">مجموع خالص پرداختی طلاب:</span>
                    <span className="font-mono font-black text-slate-900">{totalNetPayoutSum.toLocaleString('fa-IR')} تومان</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 text-[11px]">
                    <span className="text-slate-500">سهم انتقالی به صندوق قرض‌الحسنه:</span>
                    <span className="font-mono text-teal-800 font-bold">{totalQardFundTransferSum.toLocaleString('fa-IR')} تومان</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleFinalizeTuitionPeriod}
                    disabled={isFinalizing}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {isFinalizing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>در حال ثبت نهایی و ذخیره در دیتابیس...</span>
                      </>
                    ) : (
                      <>
                        <CheckCheck size={16} />
                        <span>تایید و ثبت نهایی در دیتابیس</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => !isFinalizing && setIsFinalizeWarningModalOpen(false)}
                    disabled={isFinalizing}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    انصراف
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: ویرایش پرونده مالی و وضعیت زندگی طلبه                */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {editingProfileStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden"
              dir="rtl"
            >
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit3 size={18} className="text-emerald-400" />
                  <div>
                    <h3 className="text-base font-black">ویرایش پرونده زندگی و مالی {editingProfileStudent.name}</h3>
                    <span className="text-xs text-slate-400">{editingProfileStudent.grade}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingProfileStudent(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveStudentProfile} className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">وضعیت تاهل:</label>
                    <select
                      value={profIsMarried ? 'متاهل' : 'مجرد'}
                      onChange={e => setProfIsMarried(e.target.value === 'متاهل')}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
                    >
                      <option value="مجرد">مجرد</option>
                      <option value="متاهل">متاهل</option>
                    </select>
                  </div>

                  {profIsMarried && (
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">تعداد فرزندان:</label>
                      <input
                        type="number"
                        value={profChildren}
                        onChange={e => setProfChildren(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 outline-none"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">وضعیت سکونت:</label>
                    <select
                      value={profLivingStatus}
                      onChange={e => setProfLivingStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
                    >
                      <option value="پدری">منزل پدری / بومی</option>
                      <option value="خوابگاه">خوابگاه مدرسه</option>
                      <option value="اجاره ای">منزل اجاره‌ای</option>
                      <option value="شخصی">منزل شخصی</option>
                      <option value="سایر">سایر</option>
                    </select>
                  </div>

                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={profIsRobed}
                        onChange={e => setProfIsRobed(e.target.checked)}
                        className="rounded text-emerald-600 w-4 h-4"
                      />
                      <span>معمم (ملبس به لباس روحانیت)</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">روزهای استفاده از نهار در ماه:</label>
                    <input
                      type="number"
                      value={profLunchDays}
                      onChange={e => setProfLunchDays(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">کمک ماهانه به صندوق (تومان):</label>
                    <input
                      type="number"
                      value={profFundContribution}
                      onChange={e => setProfFundContribution(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">شماره حساب بانکی:</label>
                    <input
                      type="text"
                      value={profBankAccount}
                      onChange={e => setProfBankAccount(e.target.value)}
                      placeholder="مثال: ۱۲۳۴۵۶۷۸"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">شماره شبا (IBAN):</label>
                    <input
                      type="text"
                      value={profBankSheba}
                      onChange={e => setProfBankSheba(e.target.value)}
                      placeholder="IR..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingProfileStudent(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer shadow-md flex items-center gap-1.5"
                  >
                    <Check size={16} />
                    <span>ذخیره پرونده</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
