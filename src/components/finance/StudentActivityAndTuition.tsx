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
  ArrowLeftRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { ShamsiDatePicker } from '../ShamsiDatePicker';
import { getTodayShamsi } from '../../lib/jalali';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Student, 
  TuitionCalculationSettings, 
  StudentFinancialProfile, 
  TuitionCalculationBreakdown, 
  TuitionPeriod,
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

  // Sub-tab: 'activity_info' (اطلاعات حضور و فعالیت طلاب) | 'tuition_calc' (محاسبه و فیش‌های شهریه)
  const [currentSubTab, setCurrentSubTab] = useState<'activity_info' | 'tuition_calc'>('activity_info');

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
    marriageBonusType: 'percentage',
    marriageBonusPercent: 25,
    marriageBonusAmount: 1000000,
    childAllowance: 350000,
    childAllowancePerChild: 350000,
    hasChildAllowance: true,
    turbanAllowance: 500000,
    clericalHabitBonus: 500000,
    hasTurbanAllowance: true,
    housingAllowanceRented: 600000,
    housingAllowanceDorm: 250000,
    housingSubsidy: 500000,
    hasHousingAllowance: true,
    studyBonusEnabled: true,
    studyBonusThresholdMinutes: 60,
    studyBonusCalculationType: 'per_hour',
    studyBonusPerHour: 30000,
    studyBonusRatePerHour: 30000,
    studyBonusFixedAmount: 150000,
    studyPenaltyEnabled: true,
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
    enableGeneralIncentive: false,
    generalIncentiveType: 'fixed',
    generalIncentiveAmount: 200000,
    generalIncentivePercent: 5,
    generalIncentiveTitle: 'پاداش تشویقی عمومی ماهانه',
    updatedAt: new Date().toISOString()
  });

  // Table view mode: 'detailed' (default) or 'compact'
  const [isCompactView, setIsCompactView] = useState(false);

  // Dual Reporting Mode: 'upper_management' (صورت‌وضعیت تفکیکی بالادستی و حواله‌ها) | 'internal_detailed' (گزارش تفصیلی داخلی)
  const [reportViewMode, setReportViewMode] = useState<'upper_management' | 'internal_detailed'>('upper_management');

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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Load all required collections
  const loadAllData = async () => {
    setIsLoading(true);
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
        cRecs,
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
      setClaimsList(cRecs || []);
      setClaimCategories(cCats || []);
      setDestinationAccounts(dAccs || []);
      setEducationReports(eduReports || []);
    } catch (err) {
      console.error('Error loading finance data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
    const unsub = localDb.subscribe(() => {
      loadAllData();
    });
    return () => unsub();
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

  // 3. Counseling Session Grades Aggregation (الف، ب، ج)
  const counselingAggregations = useMemo(() => {
    const map: Record<string, { countA: number; countB: number; countC: number; total: number }> = {};

    students.forEach(s => {
      map[s.id] = { countA: 0, countB: 0, countC: 0, total: 0 };
    });

    counselingGrades.forEach(cg => {
      if (cg.sessionDate >= startDate && cg.sessionDate <= endDate) {
        if (!map[cg.studentId]) {
          map[cg.studentId] = { countA: 0, countB: 0, countC: 0, total: 0 };
        }
        map[cg.studentId].total += 2; // participation + research
        if (cg.participationScore === 'الف') map[cg.studentId].countA++;
        else if (cg.participationScore === 'ب') map[cg.studentId].countB++;
        else if (cg.participationScore === 'ج') map[cg.studentId].countC++;

        if (cg.researchScore === 'الف') map[cg.studentId].countA++;
        else if (cg.researchScore === 'ب') map[cg.studentId].countB++;
        else if (cg.researchScore === 'ج') map[cg.studentId].countC++;
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
  }, [students, gradeFilter, searchQuery]);

  // -------------------------------------------------------------
  // Tuition Calculation Engine for Filtered Students
  // -------------------------------------------------------------
  const calculatedTuitions: TuitionCalculationBreakdown[] = useMemo(() => {
    return filteredStudents.map(student => {
      const prof = profiles.find(p => p.studentId === student.id);
      const att = attendanceAggregations[student.id] || { present: 0, absentUnexcused: 0, absentExcused: 0, late: 0, unspecified: 0, warningCount: 0, totalSessions: 0 };
      const studyMins = studyAggregations.minutesMap[student.id] || (42 * 60);
      const studyWarn = studyAggregations.warningMap[student.id] || false;
      const cGrades = counselingAggregations[student.id] || { countA: 2, countB: 1, countC: 0, total: 3 };
      const loansInfo = financialInstallmentsMap[student.id] || { totalActive: 0, monthlyDeduction: 0 };

      // Life Status
      const isMarried = student.maritalStatus === 'متاهل' || !!prof?.isMarried;
      const childrenCount = student.childrenCount || prof?.childrenCount || 0;
      const isRobed = student.tammomStatus === 'معمم' || !!prof?.isRobed || !!prof?.isTammam;
      const livingStatus = student.livingStatus || prof?.livingStatus || 'پدری';

      // 1. Base Tuition
      let baseAmount = 0;
      if (settings.isBaseTuitionEqualForMarried) {
        baseAmount = settings.singleBaseTuition || settings.baseSingleTuition || 2000000;
      } else {
        baseAmount = isMarried
          ? (settings.marriedBaseTuition || settings.baseMarriedTuition || 3200000)
          : (settings.singleBaseTuition || settings.baseSingleTuition || 2000000);
      }

      // 2. Marital Bonus
      let maritalBonus = 0;
      if (isMarried) {
        if (settings.marriageBonusType === 'percentage') {
          maritalBonus = Math.round(baseAmount * ((settings.marriageBonusPercent || 25) / 100));
        } else if (settings.marriageBonusAmount) {
          maritalBonus = settings.marriageBonusAmount;
        } else {
          maritalBonus = Math.max(0, (settings.baseMarriedTuition || 0) - (settings.baseSingleTuition || 0));
        }
      }

      // 3. Child Allowance
      const childAllowanceTotal = childrenCount * (settings.childAllowancePerChild || settings.childAllowance || 350000);

      // 4. Robed Bonus
      const turbanAllowance = isRobed ? (settings.turbanAllowance || settings.clericalHabitBonus || 500000) : 0;

      // 5. Housing Allowance
      let housingAllowance = 0;
      if (livingStatus === 'اجاره ای') {
        housingAllowance = settings.housingAllowanceRented || settings.housingSubsidy || 600000;
      } else if (livingStatus === 'خوابگاه') {
        housingAllowance = settings.housingAllowanceDorm || 250000;
      }

      // 6. Study Bonus & Penalty
      const mandatoryMins = studyAggregations.mandatoryMinutes;
      const avgMins = studyAggregations.avgMinutes;
      const studyDiff = studyMins - mandatoryMins;
      const isAboveStudyRequired = studyDiff > 0;
      const isAboveStudyAverage = studyMins >= avgMins;

      let studyBonusAmount = 0;
      if (settings.studyBonusEnabled) {
        const threshold = settings.studyBonusThresholdMinutes || 0;
        const aboveThresholdMinutes = Math.max(0, studyDiff - threshold);
        if (aboveThresholdMinutes > 0) {
          const hours = aboveThresholdMinutes / 60;
          const rate = settings.studyBonusRatePerHour || settings.studyBonusPerHour || 30000;
          studyBonusAmount = Math.round(hours * rate);
        }
      }

      let studyPenaltyAmount = 0;
      if (settings.studyPenaltyEnabled) {
        let deficitMinutes = 0;
        if (settings.studyPenaltyThreshold === 'below_average') {
          deficitMinutes = Math.max(0, avgMins - studyMins);
        } else {
          deficitMinutes = Math.max(0, mandatoryMins - studyMins);
        }
        if (deficitMinutes > 0) {
          const hours = deficitMinutes / 60;
          const rate = settings.studyPenaltyRatePerHour || settings.studyPenaltyPerHour || 25000;
          studyPenaltyAmount = Math.round(hours * rate);
        }
      }

      // 7. Attendance Penalties
      let absencePenaltyAmount = 0;
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

      // 8. Counseling Bonus
      const gradeABonus = (cGrades.countA || 0) * (settings.counselingGradeABonus || 30000);
      const gradeBBonus = (cGrades.countB || 0) * (settings.counselingGradeBBonus || 15000);
      const gradeCBonus = (cGrades.countC || 0) * (settings.counselingGradeCBonus || 0);
      const counselingBonusAmount = gradeABonus + gradeBBonus + gradeCBonus;

      // ==============================================================
      // TYPE 1 DEDUCTIONS (کسورات مستقیم از شهریه)
      // غیبت‌ها و جریمه مطالعه که از استحقاقی کسر شده و تمام می‌شود
      // ==============================================================
      const type1DeductionsTotal = studyPenaltyAmount + absencePenaltyAmount;
      const totalAdditions = maritalBonus + childAllowanceTotal + turbanAllowance + housingAllowance + studyBonusAmount + counselingBonusAmount;
      
      // شهریه استحقاقی خالص (مبلغ فاکتور مصوب ارسالی به بالادستی)
      const grossEarnedTuition = Math.max(0, baseAmount + totalAdditions - type1DeductionsTotal);

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
        kitchenTransferAmount = lunchDaysCount * (settings.dailyLunchCost || settings.lunchCostPerDay || 45000);
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
        (c.remainingAmount ?? c.totalDebtAmount) > 0
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
    claimsList
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
  // Save/Create Tuition Period
  // -------------------------------------------------------------
  const handleCreateTuitionPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPeriodTitle) {
      alert('لطفاً عنوان دوره شهریه را وارد کنید.');
      return;
    }

    const periodId = `period-${Date.now()}`;
    const periodDoc: TuitionPeriod = {
      id: periodId,
      title: newPeriodTitle,
      startDate: newPeriodStartDate,
      endDate: newPeriodEndDate,
      status: 'draft',
      totalStudentsCalculated: calculatedTuitions.length,
      totalPayoutAmount: totalNetPayoutSum,
      calculations: calculatedTuitions,
      createdAt: new Date().toISOString(),
      createdByName: currentUser?.fullName || currentUser?.name || currentUser?.username
    };

    await localDb.setDoc('tuition_periods', periodDoc);
    setTuitionPeriods(prev => [periodDoc, ...prev]);
    setSelectedPeriodId(periodId);
    setIsNewPeriodModalOpen(false);
    setCurrentSubTab('tuition_calc');
    showToast(`دوره جدید «${newPeriodTitle}» با موفقیت ایجاد و شهریه‌ها ذخیره گردید.`);
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

      {/* Top Banner & Title */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shadow-xs border border-emerald-100 shrink-0">
            <Users size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900">اطلاعات حضور و فعالیت طلاب و محاسبه شهریه</h2>
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black rounded-lg">
                واحد مالی و بودجه
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              مشاهده تمامی اطلاعات پایه، زندگی، مطالعه، حضور و غیاب، مشاوره‌ها، نهار، وام و محاسبه مکانیزه شهریه
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(true)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <SlidersHorizontal size={14} />
            <span>تنظیمات جامع محاسبه شهریه</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewPeriodModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} />
            <span>ایجاد دوره پرداخت شهریه</span>
          </button>

          <button
            type="button"
            onClick={handleExportUpperManagementExcel}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            <span>خروجی اکسل بالادستی</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setCurrentSubTab('activity_info')}
          className={cn(
            "flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer",
            currentSubTab === 'activity_info'
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          )}
        >
          <Users size={16} />
          <span>۱. پرونده و اطلاعات حضور و فعالیت طلاب</span>
          <span className={cn(
            "px-2 py-0.5 rounded-md text-[11px] font-bold font-mono",
            currentSubTab === 'activity_info' ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"
          )}>
            {filteredStudents.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentSubTab('tuition_calc')}
          className={cn(
            "flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer",
            currentSubTab === 'tuition_calc'
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          )}
        >
          <DollarSign size={16} />
          <span>۲. محاسبه مکانیزه و لیست فیش‌های شهریه</span>
          <span className={cn(
            "px-2 py-0.5 rounded-md text-[11px] font-bold font-mono",
            currentSubTab === 'tuition_calc' ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"
          )}>
            {totalNetPayoutSum.toLocaleString('fa-IR')} ت
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

      {/* TAB 1: اطلاعات حضور و فعالیت طلاب */}
      {currentSubTab === 'activity_info' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <Users size={16} className="text-emerald-600" />
              <span>فهرست جامع اطلاعات، حضور، مطالعه و تسهیلات طلاب ({filteredStudents.length} طلبه)</span>
            </h3>
            <span className="text-xs text-slate-400">
              داده‌های بازه: {startDate} تا {endDate}
            </span>
          </div>

          <div className="space-y-3">
            {calculatedTuitions.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-2">
                <Users size={32} className="mx-auto text-slate-300" />
                <p className="text-xs font-bold text-slate-500">هیچ طلبه‌ای با فیلترهای انتخابی یافت نشد.</p>
              </div>
            ) : (
              calculatedTuitions.map((item, index) => {
                const s = students.find(st => st.id === item.studentId);
                const prof = profiles.find(p => p.studentId === item.studentId);

                return (
                  <div
                    key={item.studentId}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all p-5 space-y-4"
                  >
                    {/* Top Row: Basic Info & Badges */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 font-black flex items-center justify-center text-sm border border-slate-200">
                          {item.studentName[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-900">{item.studentName}</span>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md">
                              {item.grade}
                            </span>
                            {item.isTammam && (
                              <span className="px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-bold rounded-md">
                                معمم
                              </span>
                            )}
                            {item.maritalStatus === 'متاهل' ? (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-md">
                                متاهل {item.childrenCount ? `(${item.childrenCount} فرزند)` : ''}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded-md">
                                مجرد
                              </span>
                            )}
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-md">
                              سکونت: {item.livingStatus || 'پدری'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono mt-0.5">
                            <span>کد موسسه: {item.instituteCode || '---'}</span>
                            <span>•</span>
                            <span>کد ملی: {item.nationalId || '---'}</span>
                            {item.phoneNumber && (
                              <>
                                <span>•</span>
                                <span>تماس: {item.phoneNumber}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Financial info & Edit Profile Button */}
                      <div className="flex items-center gap-2 self-start md:self-auto">
                        <div className="text-left hidden sm:block">
                          <span className="text-[10px] text-slate-400 block font-sans">اطلاعات حساب / شبا</span>
                          <span className="text-xs font-bold text-slate-700 font-mono">
                            {item.bankSheba || item.bankAccount || 'شماره حساب ثبت‌نشده'}
                          </span>
                        </div>
                        {s && (
                          <button
                            type="button"
                            onClick={() => openEditProfile(s)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 size={13} />
                            <span>ویرایش پرونده</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedSlipDetail(item)}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Eye size={13} />
                          <span>مشاهده فیش</span>
                        </button>
                      </div>
                    </div>

                    {/* Middle Grid: Detailed Stats in the period */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      {/* 1. آمار مطالعه */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-700 flex items-center gap-1">
                            <Clock size={13} className="text-indigo-600" />
                            <span>آمار مطالعه در بازه</span>
                          </span>
                          <span className="font-mono font-bold text-slate-800">
                            {Math.floor((item.studyMinutesTotal || 0) / 60)}س و {(item.studyMinutesTotal || 0) % 60}د
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">نسبت به موظفی ({Math.round((item.studyRequiredMinutes || 2400) / 60)}س):</span>
                          {(item.studyDiffMinutes || 0) >= 0 ? (
                            <span className="text-emerald-600 font-bold font-mono">
                              +{(item.studyDiffMinutes || 0)} دقیقه بالای موظفی
                            </span>
                          ) : (
                            <span className="text-rose-600 font-bold font-mono">
                              {item.studyDiffMinutes} دقیقه زیر موظفی
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">نسبت به میانگین:</span>
                          {item.isAboveStudyAverage ? (
                            <span className="text-emerald-700 font-bold">بالای میانگین</span>
                          ) : (
                            <span className="text-amber-700 font-bold">زیر میانگین</span>
                          )}
                        </div>
                        {item.studyWarningIssued && (
                          <div className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                            <AlertCircle size={11} />
                            <span>دارای اخطار ثبت‌شده ساعت مطالعه</span>
                          </div>
                        )}
                      </div>

                      {/* 2. حضور و غیاب */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-700 flex items-center gap-1">
                            <CheckSquare size={13} className="text-emerald-600" />
                            <span>حضور و غیاب کلاس‌ها</span>
                          </span>
                          <span className="font-mono text-emerald-700 font-black">
                            {item.totalPresentSessions || 0} حضور
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">غیبت غیرموجه:</span>
                          <span className={cn("font-bold font-mono", (item.unexcusedAbsenceCount || 0) > 0 ? "text-rose-600" : "text-slate-600")}>
                            {item.unexcusedAbsenceCount || 0} جلسه
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">غیبت موجه:</span>
                          <span className="font-mono text-slate-700">{item.excusedAbsenceCount || 0} جلسه</span>
                        </div>
                        {(item.totalEducationalWarnings || 0) > 0 && (
                          <div className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                            <AlertTriangle size={11} />
                            <span>{item.totalEducationalWarnings} اخطار آموزشی حضور و غیاب</span>
                          </div>
                        )}
                      </div>

                      {/* 3. ارزیابی کلاس‌های مشاوره */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-700 flex items-center gap-1">
                            <BookCheck size={13} className="text-teal-600" />
                            <span>ارزیابی مشاوره‌ها</span>
                          </span>
                          <span className="text-[11px] text-slate-400">الف / ب / ج</span>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <div className="flex-1 bg-emerald-100 text-emerald-800 text-center py-1 rounded font-bold">
                            <span className="block text-[10px]">الف</span>
                            <span className="font-mono text-xs">{item.counselingGradeACount || 0}</span>
                          </div>
                          <div className="flex-1 bg-amber-100 text-amber-800 text-center py-1 rounded font-bold">
                            <span className="block text-[10px]">ب</span>
                            <span className="font-mono text-xs">{item.counselingGradeBCount || 0}</span>
                          </div>
                          <div className="flex-1 bg-slate-200 text-slate-700 text-center py-1 rounded font-bold">
                            <span className="block text-[10px]">ج</span>
                            <span className="font-mono text-xs">{item.counselingGradeCCount || 0}</span>
                          </div>
                        </div>
                      </div>

                      {/* 4. تسهیلات، وام و صندوق */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-700 flex items-center gap-1">
                            <Coins size={13} className="text-amber-600" />
                            <span>تسهیلات و کسورات</span>
                          </span>
                          <span className="text-[11px] text-slate-500">نهار: {item.lunchDaysCount || 0} روز</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">قسط وام فعال:</span>
                          <span className="font-mono font-bold text-slate-700">
                            {(item.loanInstallmentDeduction || 0).toLocaleString('fa-IR')} ت
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">کمک به صندوق:</span>
                          <span className="font-mono font-bold text-slate-700">
                            {(item.fundContributionDeduction || 0).toLocaleString('fa-IR')} ت
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-0.5 border-t border-slate-200">
                          <span className="font-bold text-emerald-800">خالص شهریه:</span>
                          <span className="font-mono font-black text-emerald-700 text-xs">
                            {(item.netPayableTuition || 0).toLocaleString('fa-IR')} تومان
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: محاسبه و فیش‌های شهریه */}
      {currentSubTab === 'tuition_calc' && (
        <div className="space-y-4">
          {/* Header Strip with Mode Switcher & Period Actions */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <DollarSign size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">محاسبه مکانیزه و صدور فیش‌های شهریه دوره</h3>
                <p className="text-[11px] text-slate-500">
                  بازه زمانی محاسبات: {startDate} تا {endDate} • {calculatedTuitions.length} طلبه تحت پوشش
                </p>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1">
              <button
                type="button"
                onClick={() => setReportViewMode('upper_management')}
                className={cn(
                  "py-2 px-3.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
                  reportViewMode === 'upper_management'
                    ? "bg-white text-emerald-800 shadow-xs"
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
                    ? "bg-white text-emerald-800 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <BookOpen size={14} className={reportViewMode === 'internal_detailed' ? "text-emerald-600" : "text-slate-400"} />
                <span>۲. گزارش تفصیلی داخلی مدرسه</span>
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {reportViewMode === 'upper_management' ? (
                <>
                  <button
                    type="button"
                    onClick={handleExportUpperManagementExcel}
                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download size={14} />
                    <span>اکسل بالادستی و پایا</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsUpperManagementPrintOpen(true)}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Printer size={14} />
                    <span>چاپ رسمی صورت‌وضعیت بالادستی</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleExportInternalExcel}
                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download size={14} />
                    <span>اکسل گزارش تفصیلی</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintSlip}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer size={14} />
                    <span>چاپ کارنامه کلی</span>
                  </button>
                </>
              )}
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

          {/* VIEW 2: INTERNAL DETAILED AUDIT */}
          {reportViewMode === 'internal_detailed' && (
            <div className="space-y-4">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black">
                        <th className="py-3 px-3">ردیف</th>
                        <th className="py-3 px-3">نام طلبه</th>
                        <th className="py-3 px-3">پایه</th>
                        <th className="py-3 px-3">وضعیت زندگی</th>
                        <th className="py-3 px-3">شهریه پایه</th>
                        <th className="py-3 px-3">جمع اضافات (+)</th>
                        <th className="py-3 px-3">کسورات نوع ۱ (-)</th>
                        <th className="py-3 px-3 text-amber-900">شهریه استحقاقی</th>
                        <th className="py-3 px-3">کسورات نوع ۲ (-)</th>
                        <th className="py-3 px-3 font-black text-emerald-900">خالص پرداختی</th>
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
                            <td className="py-3 px-3">
                              <div className="text-[11px] space-y-0.5">
                                <span className="text-slate-700 font-medium">
                                  {calc.maritalStatus} {calc.childrenCount ? `(${calc.childrenCount}ف)` : ''}
                                </span>
                                {calc.isTammam && (
                                  <span className="text-teal-700 font-bold block text-[10px]">• معمم</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-700">
                              {(calc.baseTuition || 0).toLocaleString('fa-IR')}
                            </td>
                            <td className="py-3 px-3 font-mono text-emerald-700 font-bold">
                              +{(calc.totalAdditions || 0).toLocaleString('fa-IR')}
                            </td>
                            <td className="py-3 px-3 font-mono text-rose-700 font-bold">
                              -{(calc.type1DeductionsTotal || 0).toLocaleString('fa-IR')}
                            </td>
                            <td className="py-3 px-3 font-mono text-amber-900 font-bold">
                              {(calc.grossEarnedTuition || 0).toLocaleString('fa-IR')}
                            </td>
                            <td className="py-3 px-3 font-mono text-rose-700 font-bold">
                              -{(calc.type2DeductionsTotal || 0).toLocaleString('fa-IR')}
                            </td>
                            <td className="py-3 px-3 font-mono font-black text-emerald-800 text-sm">
                              {(calc.netPayableTuition || 0).toLocaleString('fa-IR')}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedSlipDetail(calc)}
                                className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                              >
                                ریز فاکتور
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
                <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
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

                  {/* نحوه اضافه تاهل */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">نوع اضافه بابت تاهل:</label>
                      <select
                        value={settings.marriageBonusType || 'percentage'}
                        onChange={e => setSettings({ ...settings, marriageBonusType: e.target.value as any })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
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
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 outline-none focus:border-emerald-500"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">مبلغ اضافه بابت تاهل (تومان):</label>
                        <input
                          type="number"
                          value={settings.marriageBonusAmount || 1000000}
                          onChange={e => setSettings({ ...settings, marriageBonusAmount: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 outline-none focus:border-emerald-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* حق اولاد، تلبس، مسکن */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">حق اولاد هر فرزند (تومان):</label>
                      <input
                        type="number"
                        value={settings.childAllowancePerChild || 350000}
                        onChange={e => setSettings({ ...settings, childAllowancePerChild: Number(e.target.value), childAllowance: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">پاداش تلبس / معمم بودن:</label>
                      <input
                        type="number"
                        value={settings.turbanAllowance || 500000}
                        onChange={e => setSettings({ ...settings, turbanAllowance: Number(e.target.value), clericalHabitBonus: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">کمک هزینه مسکن اجاره‌ای:</label>
                      <input
                        type="number"
                        value={settings.housingAllowanceRented || 600000}
                        onChange={e => setSettings({ ...settings, housingAllowanceRented: Number(e.target.value), housingSubsidy: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. ضوابط ساعت مطالعه */}
                <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                    <Clock size={16} className="text-indigo-600" />
                    <span>۲. ضوابط پاداش و جریمه ساعت مطالعه</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={settings.studyBonusEnabled}
                        onChange={e => setSettings({ ...settings, studyBonusEnabled: e.target.checked })}
                        className="rounded text-emerald-600 w-4 h-4"
                      />
                      <span>آیا مطالعه بالای موظفی موجب افزایش شهریه شود؟</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={settings.studyPenaltyEnabled}
                        onChange={e => setSettings({ ...settings, studyPenaltyEnabled: e.target.checked })}
                        className="rounded text-rose-600 w-4 h-4"
                      />
                      <span>آیا کسری مطالعه موجب کسر از شهریه شود؟</span>
                    </label>
                  </div>

                  {settings.studyBonusEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">
                          چند دقیقه بالای موظفی موجب افزایش شود؟
                        </label>
                        <input
                          type="number"
                          value={settings.studyBonusThresholdMinutes || 60}
                          onChange={e => setSettings({ ...settings, studyBonusThresholdMinutes: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">
                          پاداش هر ساعت مازاد بر موظفی (تومان):
                        </label>
                        <input
                          type="number"
                          value={settings.studyBonusRatePerHour || 30000}
                          onChange={e => setSettings({ ...settings, studyBonusRatePerHour: Number(e.target.value), studyBonusPerHour: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {settings.studyPenaltyEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">مبنای جریمه کسری مطالعه:</label>
                        <select
                          value={settings.studyPenaltyThreshold || 'below_mandatory'}
                          onChange={e => setSettings({ ...settings, studyPenaltyThreshold: e.target.value as any })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
                        >
                          <option value="below_mandatory">زیر موظفی بودن</option>
                          <option value="below_average">زیر میانگین بودن</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">
                          جریمه کسر به ازای هر ساعت کسری (تومان):
                        </label>
                        <input
                          type="number"
                          value={settings.studyPenaltyRatePerHour || 25000}
                          onChange={e => setSettings({ ...settings, studyPenaltyRatePerHour: Number(e.target.value), studyPenaltyPerHour: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. ضوابط غیبت و حضور و غیاب */}
                <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                    <CheckSquare size={16} className="text-rose-600" />
                    <span>۳. ضوابط کسر غیبت‌های کلاسی</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">روش کسر غیبت:</label>
                      <select
                        value={settings.absenceDeductionMode || 'unexcused_only'}
                        onChange={e => setSettings({ ...settings, absenceDeductionMode: e.target.value as any })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
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
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
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
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 outline-none"
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
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 outline-none"
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
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 outline-none"
                        />
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

                {/* 5. نهار، وام و صندوق قرض‌الحسنه */}
                <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                    <UtensilsCrossed size={16} className="text-amber-600" />
                    <span>۵. ضوابط نهار، اقساط وام و صندوق قرض‌الحسنه</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

              <form onSubmit={handleCreateTuitionPeriod} className="p-6 space-y-4 text-xs">
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
                    <span>پنجره زمانی محاسبات:</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    تنها اطلاعات مطالعه، غیبت‌ها، ارزیابی مشاوره‌ها و کارکردهای ثبت شده در این بازه زمانی ملاک محاسبه شهریه خواهد بود.
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
                    <span>محاسبه و ایجاد دوره</span>
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
