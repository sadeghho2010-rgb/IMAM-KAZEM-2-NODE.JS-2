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
  BookOpen,
  Settings
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
  TeacherWeeklyTransportRoutine,
  Program,
  TeacherCoursePresenceItem,
  TeacherCourseType,
  TeacherDebtCategory
} from '../../types';
import { TeacherCompensationTabbedView } from './teachers/TeacherCompensationTabbedView';
import { TeacherCompensationSlipModal } from './teachers/TeacherCompensationSlipModal';
import { TeacherCompensationSettingsModal } from './teachers/TeacherCompensationSettingsModal';

interface TeachersCompensationProps {
  onNavigateTab?: (tab: string, params?: any) => void;
}

export default function TeachersCompensation({ onNavigateTab }: TeachersCompensationProps) {
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
  const [settings, setSettings] = useState<TeacherCompensationSettings>({
    hourlyTeachingRate: 180000,
    useUniformCourseRate: true,
    mainCoursesHourlyRate: 180000,
    counselingCoursesHourlyRate: 200000,
    thursdayCoursesHourlyRate: 220000,
    enableTransportCalculation: true,
    transportCalculationMode: 'per_trip', // per_trip: هر رفت و آمد جداگانه | per_day: کل روز ۱ نوبت
    transportCostPerTrip: 150000,
    enableLunchCalculation: true,
    lunchCostPerDay: 45000,
    dinnerCostPerMeal: 40000,
    enableDebtsCalculation: true,
    includedDebtCategories: ['installment', 'qard_loan', 'advance', 'cultural', 'other'],
    enableFundContributionCalculation: true,
  });
  const [periodStatus, setPeriodStatus] = useState<'draft' | 'finalized' | 'paid'>('draft');
  const [items, setItems] = useState<TeacherCompensationCalculationItem[]>([]);

  // Raw Database Cache
  const [teachersList, setTeachersList] = useState<Teacher[]>([]);
  const [programsList, setProgramsList] = useState<Program[]>([]);
  const [claimsList, setClaimsList] = useState<StudentClaimRecord[]>([]);
  const [destinationAccounts, setDestinationAccounts] = useState<FinanceDestinationAccount[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSessionLog[]>([]);
  const [lunchReservations, setLunchReservations] = useState<LunchReservation[]>([]);
  const [transportTrips, setTransportTrips] = useState<TeacherTransportSingleTrip[]>([]);
  const [transportRoutines, setTransportRoutines] = useState<TeacherWeeklyTransportRoutine[]>([]);
  const [fundDonationConfigs, setFundDonationConfigs] = useState<any[]>([]);

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
        storedRoutines,
        storedDonations
      ] = await Promise.all([
        localDb.getDocs<Teacher>('teachers'),
        localDb.getDocs<TeacherCompensationPeriod>('finance_teachers_periods'),
        localDb.getDocs<StudentClaimRecord>('student_claims'),
        localDb.getDocs<FinanceDestinationAccount>('destination_accounts'),
        localDb.getDocs<AttendanceSessionLog>('attendance'),
        localDb.getDocs<LunchReservation>('lunch_reservations'),
        localDb.getDocs<TeacherTransportSingleTrip>('teacher_transport_trips'),
        localDb.getDocs<TeacherWeeklyTransportRoutine>('teacher_transport_routines'),
        localDb.getDocs<any>('fund_donation_configs')
      ]);

      const baseTeachers = storedTeachers || [];
      // Combine with users marked as Grade Professors by Super Admin
      const gradeProfessorsFromUsers: Teacher[] = (users || [])
        .filter(u => {
          const role = (u.role || '').toLowerCase();
          const title = (u.roleTitle || '').toLowerCase();
          const username = (u.username || '').toUpperCase();
          const isGradeSupervisorRole = role === 'grade_mentor' || role === 'grade_supervisor' || role.startsWith('grade_supervisor_');
          const isGradeTitle = title.includes('استاد پایه') || title.includes('مسئول پایه') || title.includes('مسول پایه');
          const isKnownSupervisor = ['ISJ', 'HO', 'SOL', 'ASADI', 'SADEGH', 'RAHNAMA'].includes(username);
          return isGradeSupervisorRole || isGradeTitle || isKnownSupervisor || (u.managedGrades && u.managedGrades.length > 0);
        })
        .map(u => ({
          id: u.id,
          fullName: u.fullName || u.name || u.username,
          name: u.fullName || u.name || u.username,
          categories: ['grade_mentor' as any],
          phoneNumber: u.phone,
          courses: (u.managedGrades && u.managedGrades.length > 0) ? u.managedGrades : [u.roleTitle || 'استاد و مسئول پایه'],
          managedGrades: u.managedGrades,
          teacherCode: u.personnelCode || `PROF-${u.username}`,
          priority: 1 as const,
          isActive: true,
          createdAt: new Date().toISOString()
        }));

      const combinedTeachers = [...baseTeachers];
      gradeProfessorsFromUsers.forEach(gp => {
        if (!combinedTeachers.some(t => t.id === gp.id || (t.fullName && t.fullName === gp.fullName))) {
          combinedTeachers.push(gp);
        }
      });

      setTeachersList(combinedTeachers);
      setPeriods((storedPeriods || []).sort((a, b) => compareShamsi(b.startDate, a.startDate)));
      setClaimsList(storedClaims || []);
      setAttendanceSessions(storedAtt || []);
      setLunchReservations(storedLunches || []);
      setTransportTrips(storedTrips || []);
      setTransportRoutines(storedRoutines || []);
      setFundDonationConfigs(storedDonations || []);

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

    // 1. Attendance & Sessions in date range (میزان ساعت حضور)
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
      const isMainTeacher = session.recordedByName?.includes(teacherName) || session.programTitle?.includes(teacherName);
      const isSubTeacher = session.hasSubstituteTeacher && (session.substituteTeacherId === teacherId || session.substituteTeacherName?.includes(teacherName));

      if (session.isCancelled) {
        if (isMainTeacher) cancelledDaysCount++;
        return;
      }

      if (isMainTeacher) {
        if (!session.hasSubstituteTeacher) {
          regularTeachingSessions += 1;
          regularTeachingHours += 2;
          totalCalendarDays += 1;
        }
      }

      if (isSubTeacher) {
        substituteTeachingSessions += 1;
        substituteTeachingHours += 2;
      }
    });

    // Fallback if no logs registered yet: default based on active teaching load (e.g. 12 sessions)
    if (regularTeachingSessions === 0 && substituteTeachingSessions === 0) {
      regularTeachingSessions = 12;
      regularTeachingHours = 24;
      totalCalendarDays = 12;
    }

    // Build courses breakdown for this teacher (پشتیبانی از چندین درس و وضعیت حضور در هر درس)
    let teacherCourseNames: string[] = [];
    if (teacher.courses && teacher.courses.length > 0) {
      teacherCourseNames = teacher.courses.filter(Boolean);
    } else {
      const teacherProgs = programsList.filter(p => 
        (p.teacher && p.teacher.includes(teacherName)) || 
        (p.title && teacherName && p.title.includes(teacherName))
      );
      if (teacherProgs.length > 0) {
        teacherCourseNames = Array.from(new Set(teacherProgs.map(p => p.title).filter(Boolean)));
      }
    }

    if (teacherCourseNames.length === 0) {
      teacherCourseNames = ['فقه (مکاسب)', 'اصول (رسائل)'];
    }

    const courseBreakdown: TeacherCoursePresenceItem[] = teacherCourseNames.map((cName, idx) => {
      let cType: TeacherCourseType = 'main';
      const lower = cName.toLowerCase();
      if (lower.includes('مشاور')) cType = 'counseling';
      else if (lower.includes('پنج‌شنبه') || lower.includes('پنج شنبه') || lower.includes('اخلاق')) cType = 'thursday';

      let cRate = currentSettings.hourlyTeachingRate;
      if (!currentSettings.useUniformCourseRate) {
        if (cType === 'counseling') cRate = currentSettings.counselingCoursesHourlyRate || currentSettings.hourlyTeachingRate;
        else if (cType === 'thursday') cRate = currentSettings.thursdayCoursesHourlyRate || currentSettings.hourlyTeachingRate;
        else cRate = currentSettings.mainCoursesHourlyRate || currentSettings.hourlyTeachingRate;
      }

      // Check attendance logs for this specific course
      const courseSessions = sessionsInRange.filter(s => 
        (s.recordedByName?.includes(teacherName) || s.programTitle?.includes(teacherName)) &&
        (s.programTitle?.includes(cName) || cName.includes(s.programTitle || ''))
      );

      let cScheduled = 0;
      let cCancelled = 0;
      let cSubstitute = 0;
      let cRegular = 0;

      if (courseSessions.length > 0) {
        courseSessions.forEach(s => {
          if (s.isCancelled) cCancelled++;
          else if (s.hasSubstituteTeacher) cSubstitute++;
          else cRegular++;
        });
        cScheduled = cRegular + cCancelled + cSubstitute;
      } else {
        const share = Math.max(4, Math.floor(regularTeachingSessions / teacherCourseNames.length));
        cCancelled = Math.floor(cancelledDaysCount / teacherCourseNames.length);
        cSubstitute = Math.floor(substituteTeachingSessions / teacherCourseNames.length);
        cScheduled = share + cCancelled;
        cRegular = Math.max(0, cScheduled - cCancelled);
      }

      const cHours = cRegular * 2;
      const cGross = cHours * cRate;

      return {
        id: `course_${teacherId}_${idx}_${Date.now()}`,
        courseTitle: cName,
        courseType: cType,
        calendarScheduledCount: cScheduled,
        cancelledSessionsCount: cCancelled,
        substituteSessionsCount: cSubstitute,
        regularSessionsCount: cRegular,
        teachingHours: cHours,
        hourlyRate: cRate,
        grossAmount: cGross
      };
    });

    const calendarScheduledClassesCount = courseBreakdown.reduce((s, c) => s + c.calendarScheduledCount, 0);
    const effectiveCancelled = courseBreakdown.reduce((s, c) => s + c.cancelledSessionsCount, 0);
    const effectiveSubSessions = courseBreakdown.reduce((s, c) => s + c.substituteSessionsCount, 0);
    const effectiveRegularSessions = courseBreakdown.reduce((s, c) => s + c.regularSessionsCount, 0);
    const effectiveRegularHours = courseBreakdown.reduce((s, c) => s + c.teachingHours, 0);
    const overtimeHours = 0;
    const totalTeachingHours = effectiveRegularHours + substituteTeachingHours + overtimeHours;
    const hourlyRate = currentSettings.hourlyTeachingRate;
    const baseGrossAmount = courseBreakdown.reduce((s, c) => s + c.grossAmount, 0) || (totalTeachingHours * hourlyRate);

    // 2. Debts / Claims (بدهی‌ها)
    let debtTotalAmount = 0;
    let debtMonthlyDeduction = 0;
    const claimsDeductions: TeacherCompensationCalculationItem['claimsDeductions'] = [];

    if (currentSettings.enableDebtsCalculation) {
      const allowedCategories = currentSettings.includedDebtCategories || ['installment', 'qard_loan', 'advance', 'cultural', 'other'];

      const teacherClaims = claimsList.filter(c => {
        const matchId = c.studentId === teacherId || c.targetId === teacherId;
        const matchName = c.studentName?.includes(teacherName) || c.targetName?.includes(teacherName);
        if (!((matchId || matchName) && c.status === 'active')) return false;

        const cTitle = (c.claimTitle || '').toLowerCase();
        let cat: TeacherDebtCategory = 'other';
        if (cTitle.includes('قرض') || cTitle.includes('وام')) cat = 'qard_loan';
        else if (cTitle.includes('مساعده') || cTitle.includes('پیش‌دریافت')) cat = 'advance';
        else if (cTitle.includes('عتبات') || cTitle.includes('فرهنگ') || cTitle.includes('اردو')) cat = 'cultural';
        else if (cTitle.includes('قسط')) cat = 'installment';

        return allowedCategories.includes(cat);
      });

      teacherClaims.forEach(claim => {
        debtTotalAmount += (claim.remainingAmount || claim.totalDebtAmount || 0);
        const dedAmount = Math.min(claim.monthlyDeductionAmount || 0, claim.remainingAmount || 0);
        if (dedAmount > 0) {
          debtMonthlyDeduction += dedAmount;
          const dest = destinationAccounts.find(a => a.id === claim.destinationAccountId);
          claimsDeductions.push({
            claimId: claim.id,
            title: claim.claimTitle,
            amount: dedAmount,
            destinationAccountId: claim.destinationAccountId,
            destinationTitle: dest?.title || claim.destinationAccountTitle || 'حساب مطالبات',
            bankInfo: dest ? `${dest.bankName} - ${dest.accountNumber}` : undefined
          });
        }
      });
    }

    const debtDestinationAccountId = destinationAccounts.find(a => a.category === 'cultural')?.id || destinationAccounts[0]?.id || 'acc_cultural';
    const debtDestinationTitle = claimsDeductions[0]?.destinationTitle || destinationAccounts.find(a => a.id === debtDestinationAccountId)?.title || 'حساب بدهی‌ها و مطالبات';
    const remainingDebtAfterDeduction = Math.max(0, debtTotalAmount - debtMonthlyDeduction);

    // 3. Fund Contribution (کمک به صندوق)
    const donationCfg = (fundDonationConfigs || []).find((c: any) => c.personId === teacherId || (c.personName && c.personName.includes(teacherName)));
    const fundContributionRequested = donationCfg?.monthlyAmount || 0;
    const fundContributionDeduction = currentSettings.enableFundContributionCalculation ? fundContributionRequested : 0;
    const fundDestinationAccountId = destinationAccounts.find(a => a.category === 'qard_fund' || a.id === 'acc_qard')?.id || 'acc_qard';
    const fundDestinationTitle = destinationAccounts.find(a => a.id === fundDestinationAccountId)?.title || 'صندوق قرض‌الحسنه امام صادق (ع)';
    const fundContributionNotes = fundContributionRequested > 0 ? 'مبلغ درخواستی کسر ماهانه کمک به صندوق' : '';

    // 4. Transport Trips (سرویس)
    let transportTripsCount = 0;
    const transportCostPerTrip = currentSettings.transportCostPerTrip;
    const transportManualDiscount = 0;
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
        const routine = transportRoutines.find(r => r.teacherId === teacherId || r.teacherName?.includes(teacherName));
        if (routine && routine.isActive) {
          const daysPerWeek = routine.daysOfWeek?.length || 2;
          const weeksInMonth = 4;
          const multiplier = currentSettings.transportCalculationMode === 'per_trip' ? 2 : 1;
          transportTripsCount = daysPerWeek * weeksInMonth * multiplier;
          transportDeduction = transportTripsCount * (routine.costPerTrip || currentSettings.transportCostPerTrip);
        }
      }
    }

    // 5. Meals (نهار و شام)
    const teacherLunches = lunchReservations.filter(l => {
      return l.studentId === teacherId || (l.studentName && l.studentName.includes(teacherName));
    });
    const lunchCount = teacherLunches.length > 0 
      ? teacherLunches.reduce((sum, l) => sum + (l.totalCalculatedLunches || 0), 0)
      : 8;
    const dinnerCount = 0;
    const totalMealsCount = lunchCount + dinnerCount;
    const mealPricePerUnit = currentSettings.lunchCostPerDay;
    const lunchDeduction = currentSettings.enableLunchCalculation ? (lunchCount * mealPricePerUnit) : 0;
    const dinnerDeduction = currentSettings.enableLunchCalculation ? (dinnerCount * (currentSettings.dinnerCostPerMeal || mealPricePerUnit)) : 0;
    const mealsDeductionTotal = lunchDeduction + dinnerDeduction;
    const mealsDestinationAccountId = destinationAccounts.find(a => a.category === 'kitchen' || a.id === 'acc_kitchen')?.id || 'acc_kitchen';

    // 6. Manual Adjustments (اضافه / کاهش دستی)
    const manualAdditionAmount = 0;
    const manualAdditionReason = '';
    const manualReductionAmount = 0;
    const manualReductionReason = '';
    const manualAdjustmentAmount = 0;
    const manualAdjustmentReason = '';
    const bonusAmount = 0;
    const type1Deductions = 0;

    // 7. Net Payable
    const totalDeductionsAll = debtMonthlyDeduction + fundContributionDeduction + transportDeduction + mealsDeductionTotal + type1Deductions;
    const netPayable = Math.max(0, baseGrossAmount - totalDeductionsAll + manualAdjustmentAmount);

    return {
      id: `tci_${teacherId}_${Date.now()}`,
      teacherId,
      teacherName,
      nationalId: teacher.nationalId || '',
      phone: teacher.phoneNumber || teacher.phone || '',
      coursesStr: teacherCourseNames.join('، ') || teacher.courses?.join('، ') || 'دروس فقه و اصول',
      courseBreakdown,
      gradesStr: teacher.managedGrades?.join('، ') || 'پایه‌های آموزشی',
      calendarScheduledClassesCount,
      totalCalendarDays,
      cancelledDaysCount,
      regularTeachingSessions,
      regularTeachingHours,
      substituteTeachingSessions,
      substituteTeachingHours,
      overtimeHours,
      totalTeachingHours,
      hourlyRate,
      baseGrossAmount,
      debtTotalAmount,
      debtMonthlyDeduction,
      debtDestinationAccountId,
      debtDestinationTitle,
      remainingDebtAfterDeduction,
      debtNotes: claimsDeductions[0]?.title || '',
      fundContributionRequested,
      fundContributionDeduction,
      fundDestinationAccountId,
      fundDestinationTitle,
      fundContributionNotes,
      transportTripsCount,
      transportCostPerTrip,
      transportManualDiscount,
      transportDeduction,
      transportNotes: '',
      lunchCount,
      dinnerCount,
      totalMealsCount,
      mealPricePerUnit,
      lunchDeduction,
      dinnerDeduction,
      mealsDeductionTotal,
      mealsDestinationAccountId,
      manualAdditionAmount,
      manualAdditionReason,
      manualReductionAmount,
      manualReductionReason,
      manualAdjustmentAmount,
      manualAdjustmentReason,
      bonusAmount,
      type1Deductions,
      type2DeductionsTotal: debtMonthlyDeduction,
      claimsDeductions,
      totalDeductionsAll,
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
      ...settings,
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

  // Inline Update of Item values across all 7 tabs
  const handleUpdateItemValue = (id: string, field: keyof TeacherCompensationCalculationItem, value: any) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id !== id) return item;

      const updated = { ...item, [field]: value };

      // 1. Recalculate Teaching Hours & Base Gross
      if (['regularTeachingHours', 'substituteTeachingHours', 'overtimeHours', 'hourlyRate'].includes(field as string)) {
        const regH = field === 'regularTeachingHours' ? Number(value) : (updated.regularTeachingHours || 0);
        const subH = field === 'substituteTeachingHours' ? Number(value) : (updated.substituteTeachingHours || 0);
        const overtime = field === 'overtimeHours' ? Number(value) : (updated.overtimeHours || 0);
        const rate = field === 'hourlyRate' ? Number(value) : (updated.hourlyRate || settings.hourlyTeachingRate);
        updated.totalTeachingHours = regH + subH + overtime;
        updated.baseGrossAmount = updated.totalTeachingHours * rate;
      } else if (field === 'totalTeachingHours') {
        const rate = updated.hourlyRate || settings.hourlyTeachingRate;
        updated.baseGrossAmount = Number(value) * rate;
      } else if (field === 'calendarScheduledClassesCount' || field === 'cancelledDaysCount') {
        const sched = field === 'calendarScheduledClassesCount' ? Number(value) : (updated.calendarScheduledClassesCount || 0);
        const canc = field === 'cancelledDaysCount' ? Number(value) : (updated.cancelledDaysCount || 0);
        const netSessions = Math.max(0, sched - canc);
        updated.regularTeachingSessions = netSessions;
        updated.regularTeachingHours = netSessions * 2;
        const overtime = updated.overtimeHours || 0;
        const subH = updated.substituteTeachingHours || 0;
        updated.totalTeachingHours = updated.regularTeachingHours + subH + overtime;
        updated.baseGrossAmount = updated.totalTeachingHours * (updated.hourlyRate || settings.hourlyTeachingRate);
      }

      // 2. Recalculate Debts
      if (field === 'debtTotalAmount' || field === 'debtMonthlyDeduction') {
        const tot = field === 'debtTotalAmount' ? Number(value) : (updated.debtTotalAmount || 0);
        const ded = field === 'debtMonthlyDeduction' ? Number(value) : (updated.debtMonthlyDeduction || 0);
        updated.remainingDebtAfterDeduction = Math.max(0, tot - ded);
        updated.type2DeductionsTotal = ded;
      }

      // 3. Recalculate Fund Contribution
      if (field === 'fundContributionRequested' && updated.fundContributionDeduction === undefined) {
        updated.fundContributionDeduction = Number(value);
      }

      // 4. Recalculate Transport
      if (['transportTripsCount', 'transportCostPerTrip', 'transportManualDiscount'].includes(field as string)) {
        const trips = field === 'transportTripsCount' ? Number(value) : (updated.transportTripsCount || 0);
        const cost = field === 'transportCostPerTrip' ? Number(value) : (updated.transportCostPerTrip || settings.transportCostPerTrip);
        const disc = field === 'transportManualDiscount' ? Number(value) : (updated.transportManualDiscount || 0);
        updated.transportDeduction = Math.max(0, (trips * cost) - disc);
      }

      // 5. Recalculate Meals
      if (['lunchCount', 'dinnerCount', 'mealPricePerUnit'].includes(field as string)) {
        const lCount = field === 'lunchCount' ? Number(value) : (updated.lunchCount || 0);
        const dCount = field === 'dinnerCount' ? Number(value) : (updated.dinnerCount || 0);
        const price = field === 'mealPricePerUnit' ? Number(value) : (updated.mealPricePerUnit || settings.lunchCostPerDay);
        updated.lunchDeduction = lCount * price;
        updated.dinnerDeduction = dCount * price;
        updated.totalMealsCount = lCount + dCount;
        updated.mealsDeductionTotal = updated.lunchDeduction + updated.dinnerDeduction;
      }

      // 6. Recalculate Manual Adjustments
      if (['manualAdditionAmount', 'manualReductionAmount'].includes(field as string)) {
        const add = field === 'manualAdditionAmount' ? Number(value) : (updated.manualAdditionAmount || 0);
        const red = field === 'manualReductionAmount' ? Number(value) : (updated.manualReductionAmount || 0);
        updated.manualAdjustmentAmount = add - red;
        updated.bonusAmount = add;
      }

      // 7. Recalculate Net Payable & Deductions Total
      const gross = updated.baseGrossAmount || 0;
      const debtDeduction = updated.debtMonthlyDeduction ?? updated.type2DeductionsTotal ?? 0;
      const fundDeduction = updated.fundContributionDeduction || 0;
      const transportDeduction = updated.transportDeduction || 0;
      const mealDeduction = updated.mealsDeductionTotal ?? updated.lunchDeduction ?? 0;
      const type1 = updated.type1Deductions || 0;

      const totalDeds = debtDeduction + fundDeduction + transportDeduction + mealDeduction + type1;
      updated.totalDeductionsAll = totalDeds;

      const manualAdj = updated.manualAdjustmentAmount || 0;
      updated.netPayable = Math.max(0, gross - totalDeds + manualAdj);

      return updated;
    }));
  };

  // Remove teacher row from table
  const handleRemoveItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
    showToast('استاد از جدول محاسبه حذف شد.');
  };

  // Update Course Breakdown field for a teacher
  const handleUpdateTeacherCourse = (
    teacherCalcId: string, 
    courseId: string, 
    field: keyof TeacherCoursePresenceItem, 
    value: any
  ) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id !== teacherCalcId) return item;

      const courses = (item.courseBreakdown || []).map(course => {
        if (course.id !== courseId) return course;

        const updatedCourse = { ...course, [field]: value };

        // If courseType changed and separate rates enabled, update hourly rate
        if (field === 'courseType' && !settings.useUniformCourseRate) {
          if (value === 'counseling') updatedCourse.hourlyRate = settings.counselingCoursesHourlyRate || settings.hourlyTeachingRate;
          else if (value === 'thursday') updatedCourse.hourlyRate = settings.thursdayCoursesHourlyRate || settings.hourlyTeachingRate;
          else updatedCourse.hourlyRate = settings.mainCoursesHourlyRate || settings.hourlyTeachingRate;
        }

        // If sessions changed, recalculate regular sessions and hours
        if (field === 'calendarScheduledCount' || field === 'cancelledSessionsCount') {
          const sched = field === 'calendarScheduledCount' ? Number(value) : (updatedCourse.calendarScheduledCount || 0);
          const canc = field === 'cancelledSessionsCount' ? Number(value) : (updatedCourse.cancelledSessionsCount || 0);
          updatedCourse.regularSessionsCount = Math.max(0, sched - canc);
          updatedCourse.teachingHours = updatedCourse.regularSessionsCount * 2;
        }

        // Recalculate grossAmount for course
        const rate = updatedCourse.hourlyRate || item.hourlyRate;
        updatedCourse.grossAmount = (updatedCourse.teachingHours || 0) * rate;

        return updatedCourse;
      });

      // Recalculate teacher totals from the updated courseBreakdown
      const totSched = courses.reduce((s, c) => s + (c.calendarScheduledCount || 0), 0);
      const totCanc = courses.reduce((s, c) => s + (c.cancelledSessionsCount || 0), 0);
      const totSub = courses.reduce((s, c) => s + (c.substituteSessionsCount || 0), 0);
      const totHours = courses.reduce((s, c) => s + (c.teachingHours || 0), 0);
      const totGross = courses.reduce((s, c) => s + (c.grossAmount || 0), 0);

      const overtime = item.overtimeHours || 0;
      const subHours = item.substituteTeachingHours || 0;
      const totalTeachingHours = totHours + subHours + overtime;
      const baseGrossAmount = totGross;

      const totalDeds = (item.debtMonthlyDeduction || item.type2DeductionsTotal || 0) +
        (item.fundContributionDeduction || 0) +
        (item.transportDeduction || 0) +
        (item.mealsDeductionTotal || item.lunchDeduction || 0) +
        (item.type1Deductions || 0);

      const manualAdj = item.manualAdjustmentAmount || 0;
      const netPayable = Math.max(0, baseGrossAmount - totalDeds + manualAdj);

      return {
        ...item,
        courseBreakdown: courses,
        coursesStr: courses.map(c => c.courseTitle).filter(Boolean).join('، '),
        calendarScheduledClassesCount: totSched,
        cancelledDaysCount: totCanc,
        substituteTeachingSessions: totSub,
        regularTeachingHours: totHours,
        totalTeachingHours,
        baseGrossAmount,
        totalDeductionsAll: totalDeds,
        netPayable
      };
    }));
  };

  // Add a new course to a teacher
  const handleAddTeacherCourse = (teacherCalcId: string) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id !== teacherCalcId) return item;

      const cType: TeacherCourseType = 'main';
      const cRate = settings.useUniformCourseRate 
        ? settings.hourlyTeachingRate 
        : (settings.mainCoursesHourlyRate || settings.hourlyTeachingRate);
      const cScheduled = 8;
      const cCancelled = 0;
      const cSub = 0;
      const cRegular = 8;
      const cHours = 16;
      const cGross = cHours * cRate;

      const newCourse: TeacherCoursePresenceItem = {
        id: `course_${item.teacherId}_${Date.now()}`,
        courseTitle: `درس جدید ${(item.courseBreakdown?.length || 0) + 1}`,
        courseType: cType,
        calendarScheduledCount: cScheduled,
        cancelledSessionsCount: cCancelled,
        substituteSessionsCount: cSub,
        regularSessionsCount: cRegular,
        teachingHours: cHours,
        hourlyRate: cRate,
        grossAmount: cGross
      };

      const updatedCourses = [...(item.courseBreakdown || []), newCourse];

      const totSched = updatedCourses.reduce((s, c) => s + (c.calendarScheduledCount || 0), 0);
      const totCanc = updatedCourses.reduce((s, c) => s + (c.cancelledSessionsCount || 0), 0);
      const totSub = updatedCourses.reduce((s, c) => s + (c.substituteSessionsCount || 0), 0);
      const totHours = updatedCourses.reduce((s, c) => s + (c.teachingHours || 0), 0);
      const totGross = updatedCourses.reduce((s, c) => s + (c.grossAmount || 0), 0);

      const overtime = item.overtimeHours || 0;
      const subHours = item.substituteTeachingHours || 0;
      const totalTeachingHours = totHours + subHours + overtime;
      const baseGrossAmount = totGross;

      const totalDeds = (item.debtMonthlyDeduction || item.type2DeductionsTotal || 0) +
        (item.fundContributionDeduction || 0) +
        (item.transportDeduction || 0) +
        (item.mealsDeductionTotal || item.lunchDeduction || 0) +
        (item.type1Deductions || 0);

      const manualAdj = item.manualAdjustmentAmount || 0;
      const netPayable = Math.max(0, baseGrossAmount - totalDeds + manualAdj);

      return {
        ...item,
        courseBreakdown: updatedCourses,
        coursesStr: updatedCourses.map(c => c.courseTitle).filter(Boolean).join('، '),
        calendarScheduledClassesCount: totSched,
        cancelledDaysCount: totCanc,
        substituteTeachingSessions: totSub,
        regularTeachingHours: totHours,
        totalTeachingHours,
        baseGrossAmount,
        totalDeductionsAll: totalDeds,
        netPayable
      };
    }));
  };

  // Remove a course from a teacher
  const handleRemoveTeacherCourse = (teacherCalcId: string, courseId: string) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id !== teacherCalcId) return item;
      const updatedCourses = (item.courseBreakdown || []).filter(c => c.id !== courseId);
      if (updatedCourses.length === 0) return item; // Keep at least one course

      const totSched = updatedCourses.reduce((s, c) => s + (c.calendarScheduledCount || 0), 0);
      const totCanc = updatedCourses.reduce((s, c) => s + (c.cancelledSessionsCount || 0), 0);
      const totSub = updatedCourses.reduce((s, c) => s + (c.substituteSessionsCount || 0), 0);
      const totHours = updatedCourses.reduce((s, c) => s + (c.teachingHours || 0), 0);
      const totGross = updatedCourses.reduce((s, c) => s + (c.grossAmount || 0), 0);

      const overtime = item.overtimeHours || 0;
      const subHours = item.substituteTeachingHours || 0;
      const totalTeachingHours = totHours + subHours + overtime;
      const baseGrossAmount = totGross;

      const totalDeds = (item.debtMonthlyDeduction || item.type2DeductionsTotal || 0) +
        (item.fundContributionDeduction || 0) +
        (item.transportDeduction || 0) +
        (item.mealsDeductionTotal || item.lunchDeduction || 0) +
        (item.type1Deductions || 0);

      const manualAdj = item.manualAdjustmentAmount || 0;
      const netPayable = Math.max(0, baseGrossAmount - totalDeds + manualAdj);

      return {
        ...item,
        courseBreakdown: updatedCourses,
        coursesStr: updatedCourses.map(c => c.courseTitle).filter(Boolean).join('، '),
        calendarScheduledClassesCount: totSched,
        cancelledDaysCount: totCanc,
        substituteTeachingSessions: totSub,
        regularTeachingHours: totHours,
        totalTeachingHours,
        baseGrossAmount,
        totalDeductionsAll: totalDeds,
        netPayable
      };
    }));
  };

  // Save Settings and apply to current period & all items in table
  const handleSaveSettings = (newSettings: TeacherCompensationSettings) => {
    setSettings(newSettings);

    // Apply new settings to items currently in the calculation table
    setItems(prevItems => prevItems.map(item => {
      // 1. Recalculate course rates
      const courses = (item.courseBreakdown || []).map(c => {
        let cRate = newSettings.hourlyTeachingRate;
        if (!newSettings.useUniformCourseRate) {
          if (c.courseType === 'counseling') cRate = newSettings.counselingCoursesHourlyRate || newSettings.hourlyTeachingRate;
          else if (c.courseType === 'thursday') cRate = newSettings.thursdayCoursesHourlyRate || newSettings.hourlyTeachingRate;
          else cRate = newSettings.mainCoursesHourlyRate || newSettings.hourlyTeachingRate;
        }
        return {
          ...c,
          hourlyRate: cRate,
          grossAmount: (c.teachingHours || 0) * cRate
        };
      });

      const totGross = courses.length > 0 
        ? courses.reduce((s, c) => s + (c.grossAmount || 0), 0)
        : (item.totalTeachingHours || 0) * newSettings.hourlyTeachingRate;

      // 2. Transport
      let transportDeduction = 0;
      if (newSettings.enableTransportCalculation) {
        const ratePerTrip = newSettings.transportCostPerTrip;
        transportDeduction = Math.max(0, ((item.transportTripsCount || 0) * ratePerTrip) - (item.transportManualDiscount || 0));
      }

      // 3. Meals
      let lunchDeduction = 0;
      let dinnerDeduction = 0;
      if (newSettings.enableLunchCalculation) {
        lunchDeduction = (item.lunchCount || 0) * newSettings.lunchCostPerDay;
        dinnerDeduction = (item.dinnerCount || 0) * (newSettings.dinnerCostPerMeal || newSettings.lunchCostPerDay);
      }
      const mealsDeductionTotal = lunchDeduction + dinnerDeduction;

      // 4. Debts
      let debtMonthlyDeduction = 0;
      if (newSettings.enableDebtsCalculation) {
        debtMonthlyDeduction = item.debtMonthlyDeduction || item.type2DeductionsTotal || 0;
      }
      const remainingDebtAfterDeduction = Math.max(0, (item.debtTotalAmount || 0) - debtMonthlyDeduction);

      // 5. Fund Contribution
      let fundContributionDeduction = 0;
      if (newSettings.enableFundContributionCalculation) {
        fundContributionDeduction = item.fundContributionRequested || 0;
      }

      // 6. Net
      const totalDeds = debtMonthlyDeduction + fundContributionDeduction + transportDeduction + mealsDeductionTotal + (item.type1Deductions || 0);
      const manualAdj = item.manualAdjustmentAmount || 0;
      const netPayable = Math.max(0, totGross - totalDeds + manualAdj);

      return {
        ...item,
        courseBreakdown: courses,
        hourlyRate: newSettings.hourlyTeachingRate,
        baseGrossAmount: totGross,
        transportCostPerTrip: newSettings.transportCostPerTrip,
        transportDeduction,
        mealPricePerUnit: newSettings.lunchCostPerDay,
        lunchDeduction,
        dinnerDeduction,
        mealsDeductionTotal,
        debtMonthlyDeduction,
        type2DeductionsTotal: debtMonthlyDeduction,
        remainingDebtAfterDeduction,
        fundContributionDeduction,
        totalDeductionsAll: totalDeds,
        netPayable
      };
    }));

    showToast('تنظیمات محاسبه حق‌الزحمه با موفقیت ذخیره و در جدول اعمال گردید.');
  };

  // Summary Totals for active calculation items
  const activeSummaryStats = useMemo(() => {
    const totalTeachers = items.length;
    const totalHours = items.reduce((s, i) => s + (i.totalTeachingHours || 0), 0);
    const totalBase = items.reduce((s, i) => s + (i.baseGrossAmount || 0), 0);
    const totalLunchDeductions = items.reduce((s, i) => s + (i.mealsDeductionTotal ?? i.lunchDeduction ?? 0), 0);
    const totalLunchCount = items.reduce((s, i) => s + (i.lunchCount || 0) + (i.dinnerCount || 0), 0);
    const totalTransportDeductions = items.reduce((s, i) => s + (i.transportDeduction || 0), 0);
    const totalTransportTrips = items.reduce((s, i) => s + (i.transportTripsCount || 0), 0);
    const totalDebtDeductions = items.reduce((s, i) => s + (i.debtMonthlyDeduction ?? i.type2DeductionsTotal ?? 0), 0);
    const totalFundDeductions = items.reduce((s, i) => s + (i.fundContributionDeduction || 0), 0);
    const totalType2Deductions = totalDebtDeductions + totalFundDeductions;
    const totalBonus = items.reduce((s, i) => s + (i.manualAdditionAmount ?? i.bonusAmount ?? 0), 0);
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
      totalDebtDeductions,
      totalFundDeductions,
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

    // 1. Meals (Lunch/Dinner) destination account
    const kitchenAcc = destinationAccounts.find(a => a.category === 'kitchen' || a.id === 'acc_kitchen') || destinationAccounts[0];
    const totalMealDed = items.reduce((s, i) => s + (i.mealsDeductionTotal ?? i.lunchDeduction ?? 0), 0);
    if (kitchenAcc && totalMealDed > 0) {
      accountMap[kitchenAcc.id] = {
        account: kitchenAcc,
        totalAmount: totalMealDed,
        beneficiariesCount: items.filter(i => (i.mealsDeductionTotal ?? i.lunchDeduction ?? 0) > 0).length
      };
    }

    // 2. Fund Contribution destination account
    const fundAcc = destinationAccounts.find(a => a.category === 'qard_fund' || a.id === 'acc_qard') || {
      id: 'acc_qard',
      title: 'صندوق قرض‌الحسنه امام صادق (ع)',
      bankName: 'بانک ملی',
      accountNumber: '۰۳۰۴۵۶۷۸۹۰۰۱',
      shebaNumber: 'IR450170000000304567890001',
      accountHolder: 'صندوق قرض‌الحسنه موسسه',
      createdAt: ''
    };
    const totalFundDed = items.reduce((s, i) => s + (i.fundContributionDeduction || 0), 0);
    if (totalFundDed > 0) {
      if (!accountMap[fundAcc.id]) {
        accountMap[fundAcc.id] = {
          account: fundAcc,
          totalAmount: 0,
          beneficiariesCount: 0
        };
      }
      accountMap[fundAcc.id].totalAmount += totalFundDed;
      accountMap[fundAcc.id].beneficiariesCount += items.filter(i => (i.fundContributionDeduction || 0) > 0).length;
    }

    // 3. Debts destination accounts
    items.forEach(item => {
      const ded = item.debtMonthlyDeduction ?? item.type2DeductionsTotal ?? 0;
      if (ded > 0) {
        const destId = item.debtDestinationAccountId || 'acc_cultural';
        const destAcc = destinationAccounts.find(a => a.id === destId) || {
          id: destId,
          title: item.debtDestinationTitle || 'حساب مطالبات و بدهی‌ها',
          bankName: 'بانک مربوطه',
          accountNumber: 'ثبت در سامانه',
          shebaNumber: '-',
          accountHolder: item.debtDestinationTitle || 'حساب مطالبات',
          createdAt: ''
        };

        if (!accountMap[destAcc.id]) {
          accountMap[destAcc.id] = {
            account: destAcc,
            totalAmount: 0,
            beneficiariesCount: 0
          };
        }
        accountMap[destAcc.id].totalAmount += ded;
        accountMap[destAcc.id].beneficiariesCount += 1;
      }
    });

    return Object.values(accountMap);
  }, [items, destinationAccounts]);

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

  // EXPORT 1: DETAILED EXCEL (خروجی تفصیلی خودمان با تمام ستون‌های هر ۷ سربرگ)
  const handleExportDetailedExcel = (exportItems: TeacherCompensationCalculationItem[], title: string) => {
    const data = exportItems.map((item, idx) => {
      const debtDed = item.debtMonthlyDeduction ?? item.type2DeductionsTotal ?? 0;
      const fundDed = item.fundContributionDeduction ?? 0;
      const transDed = item.transportDeduction ?? 0;
      const mealDed = item.mealsDeductionTotal ?? item.lunchDeduction ?? 0;
      const totalDed = debtDed + fundDed + transDed + mealDed + (item.type1Deductions || 0);

      return {
        'ردیف': idx + 1,
        'نام و نام خانوادگی استاد': item.teacherName,
        'کد ملی': item.nationalId || '-',
        'شماره تماس': item.phone || '-',
        'عناوین دروس تدریسی': item.coursesStr || '-',
        // سربرگ ۱: ساعت حضور
        'جلسات مقرر تقویم': item.calendarScheduledClassesCount ?? item.totalCalendarDays ?? 0,
        'جلسات تعطیل شده': item.cancelledDaysCount ?? 0,
        'جلسات استاد جایگزین': item.substituteTeachingSessions ?? 0,
        'ساعت اضافه تدریس': item.overtimeHours ?? 0,
        'مجموع ساعات تدریس': item.totalTeachingHours,
        'نرخ ساعتی (تومان)': item.hourlyRate,
        'ناخالص کارکرد (تومان)': item.baseGrossAmount,
        // سربرگ ۲: بدهی‌ها
        'کل بدهی (تومان)': item.debtTotalAmount ?? 0,
        'کسر بدهی ماهانه (تومان)': debtDed,
        'حساب واریز بدهی': item.debtDestinationTitle || '-',
        'مانده بدهی (تومان)': item.remainingDebtAfterDeduction ?? Math.max(0, (item.debtTotalAmount ?? 0) - debtDed),
        // سربرگ ۳: کمک به صندوق
        'مبلغ درخواستی کمک به صندوق (تومان)': item.fundContributionRequested ?? 0,
        'کسر کمک به صندوق (تومان)': fundDed,
        'حساب مقصد صندوق': item.fundDestinationTitle || 'صندوق قرض‌الحسنه',
        // سربرگ ۴: سرویس
        'نوبت‌های سرویس': item.transportTripsCount,
        'کسر سرویس (تومان)': transDed,
        // سربرگ ۵: نهار و شام
        'تعداد نهار': item.lunchCount ?? 0,
        'تعداد شام': item.dinnerCount ?? 0,
        'مجموع وعده‌ها': (item.lunchCount ?? 0) + (item.dinnerCount ?? 0),
        'کسر نهار و شام (تومان)': mealDed,
        // سربرگ ۶: تعدیلات دستی
        'اضافه دستی / پاداش (تومان)': item.manualAdditionAmount ?? item.bonusAmount ?? 0,
        'علت افزایش': item.manualAdditionReason || '-',
        'کاهش دستی / جریمه (تومان)': item.manualReductionAmount ?? 0,
        'علت کاهش': item.manualReductionReason || '-',
        'خالص تعدیل دستی (+/-)': item.manualAdjustmentAmount ?? 0,
        // سربرگ ۷: جمع‌بندی
        'جمع کل کسورات (تومان)': totalDed,
        'خالص پرداختی نهایی پایا (تومان)': item.netPayable,
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
      'جلسات مقرر تقویم': exportItems.reduce((s, i) => s + (i.calendarScheduledClassesCount ?? i.totalCalendarDays ?? 0), 0),
      'جلسات تعطیل شده': exportItems.reduce((s, i) => s + (i.cancelledDaysCount ?? 0), 0),
      'جلسات استاد جایگزین': exportItems.reduce((s, i) => s + (i.substituteTeachingSessions ?? 0), 0),
      'ساعت اضافه تدریس': exportItems.reduce((s, i) => s + (i.overtimeHours ?? 0), 0),
      'مجموع ساعات تدریس': exportItems.reduce((s, i) => s + (i.totalTeachingHours || 0), 0),
      'نرخ ساعتی (تومان)': '-' as any,
      'ناخالص کارکرد (تومان)': exportItems.reduce((s, i) => s + (i.baseGrossAmount || 0), 0),
      'کل بدهی (تومان)': exportItems.reduce((s, i) => s + (i.debtTotalAmount || 0), 0),
      'کسر بدهی ماهانه (تومان)': exportItems.reduce((s, i) => s + (i.debtMonthlyDeduction ?? i.type2DeductionsTotal ?? 0), 0),
      'حساب واریز بدهی': '-',
      'مانده بدهی (تومان)': exportItems.reduce((s, i) => s + (i.remainingDebtAfterDeduction || 0), 0),
      'مبلغ درخواستی کمک به صندوق (تومان)': exportItems.reduce((s, i) => s + (i.fundContributionRequested || 0), 0),
      'کسر کمک به صندوق (تومان)': exportItems.reduce((s, i) => s + (i.fundContributionDeduction || 0), 0),
      'حساب مقصد صندوق': '-',
      'نوبت‌های سرویس': exportItems.reduce((s, i) => s + (i.transportTripsCount || 0), 0),
      'کسر سرویس (تومان)': exportItems.reduce((s, i) => s + (i.transportDeduction || 0), 0),
      'تعداد نهار': exportItems.reduce((s, i) => s + (i.lunchCount || 0), 0),
      'تعداد شام': exportItems.reduce((s, i) => s + (i.dinnerCount || 0), 0),
      'مجموع وعده‌ها': exportItems.reduce((s, i) => s + (i.lunchCount || 0) + (i.dinnerCount || 0), 0),
      'کسر نهار و شام (تومان)': exportItems.reduce((s, i) => s + (i.mealsDeductionTotal ?? i.lunchDeduction ?? 0), 0),
      'اضافه دستی / پاداش (تومان)': exportItems.reduce((s, i) => s + (i.manualAdditionAmount ?? i.bonusAmount ?? 0), 0),
      'علت افزایش': '-',
      'کاهش دستی / جریمه (تومان)': exportItems.reduce((s, i) => s + (i.manualReductionAmount ?? 0), 0),
      'علت کاهش': '-',
      'خالص تعدیل دستی (+/-)': exportItems.reduce((s, i) => s + (i.manualAdjustmentAmount ?? 0), 0),
      'جمع کل کسورات (تومان)': exportItems.reduce((s, i) => s + (i.debtMonthlyDeduction ?? i.type2DeductionsTotal ?? 0) + (i.fundContributionDeduction || 0) + (i.transportDeduction || 0) + (i.mealsDeductionTotal ?? i.lunchDeduction ?? 0) + (i.type1Deductions || 0), 0),
      'خالص پرداختی نهایی پایا (تومان)': exportItems.reduce((s, i) => s + (i.netPayable || 0), 0),
      'نام بانک': '-',
      'شماره حساب': '-',
      'شماره شبا': '-',
      'توضیحات': 'تراز نهایی دوره'
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'تفصیلی اساتید (داخلی)');
    XLSX.writeFile(wb, `گزارش_تفصیلی_داخلی_${title.replace(/\s+/g, '_')}_${getTodayShamsi().replace(/\//g, '_')}.xlsx`);
    showToast('خروجی تفصیلی اکسل اساتید (داخلی) دانلود شد.');
  };

  // EXPORT 2: SUPERIORS & DESTINATION ACCOUNTS EXCEL (گزارش ویژه بالادستی و واریزی حساب‌های مقصد)
  const handleExportSuperiorsExcel = (exportItems: TeacherCompensationCalculationItem[], title: string) => {
    // Sheet 1: Teachers Payout
    const teachersData = exportItems.map((item, idx) => {
      const debtDed = item.debtMonthlyDeduction ?? item.type2DeductionsTotal ?? 0;
      const fundDed = item.fundContributionDeduction ?? 0;
      const transDed = item.transportDeduction ?? 0;
      const mealDed = item.mealsDeductionTotal ?? item.lunchDeduction ?? 0;

      return {
        'ردیف': idx + 1,
        'نام و نام خانوادگی استاد': item.teacherName,
        'کد ملی': item.nationalId || '-',
        'نام بانک': item.bankName || 'تجارت',
        'شماره شبا (IBAN)': item.bankSheba || '-',
        'شماره حساب': item.bankAccount || '-',
        'ناخالص استحقاقی (تومان)': item.baseGrossAmount,
        'کسورات تغذیه و سرویس (تومان)': transDed + mealDed,
        'کسورات بدهی و کمک به صندوق (تومان)': debtDed + fundDed,
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
      'کسورات تغذیه و سرویس (تومان)': exportItems.reduce((s, i) => s + (i.transportDeduction || 0) + (i.mealsDeductionTotal ?? i.lunchDeduction ?? 0), 0),
      'کسورات بدهی و کمک به صندوق (تومان)': exportItems.reduce((s, i) => s + (i.debtMonthlyDeduction ?? i.type2DeductionsTotal ?? 0) + (i.fundContributionDeduction || 0), 0),
      'تعدیل دستی (+/-)': exportItems.reduce((s, i) => s + (i.manualAdjustmentAmount || 0), 0),
      'مبلغ واریزی پایا به استاد (تومان)': exportItems.reduce((s, i) => s + (i.netPayable || 0), 0),
      'بابت': 'حواله تجمیعی حق‌الزحمه اساتید'
    });

    // Sheet 2: Summary of Deductions to be transferred to destination accounts
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
      'عنوان حساب مقصد / بخش': 'مجموع کل کسورات واریزی بین‌حسابی',
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
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200/80 shadow-2xs"
              title="تنظیم نرخ ساعات حضور، کلاس‌های مشاوره/اصلی/پنج‌شنبه، سرویس، نهار، بدهی‌ها و صندوق"
            >
              <Settings size={16} className="text-slate-600" />
              <span>تنظیمات محاسبه حق‌الزحمه</span>
            </button>
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
            <TeacherCompensationTabbedView
              items={items}
              onUpdateItemValue={handleUpdateItemValue}
              onRemoveItem={handleRemoveItem}
              onOpenAddTeacherModal={handleOpenAddTeacherModal}
              periodTitle={periodTitle}
              startDate={startDate}
              endDate={endDate}
              settings={settings}
              destinationAccounts={destinationAccounts}
              onExportDetailedExcel={handleExportDetailedExcel}
              onExportSuperiorsExcel={handleExportSuperiorsExcel}
              onSaveToArchive={handleSavePeriodToArchive}
              onOpenSlipDetail={(item) => setSingleSlipItem(item)}
              isCompactView={isCompactView}
              setIsCompactView={setIsCompactView}
              onOpenSettingsModal={() => setIsSettingsOpen(true)}
              onUpdateTeacherCourse={handleUpdateTeacherCourse}
              onAddTeacherCourse={handleAddTeacherCourse}
              onRemoveTeacherCourse={handleRemoveTeacherCourse}
            />
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
                      <th className="p-3 text-center">فیش پرداختی</th>
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
                        <td className="p-3 text-center">
                          <button
                            onClick={() => setSingleSlipItem(it)}
                            className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                          >
                            <FileText size={13} className="text-teal-600" />
                            <span>مشاهده فیش</span>
                          </button>
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-slate-900">{teacher.fullName || teacher.name}</span>
                            {teacher.categories?.includes('grade_mentor' as any) && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                                استاد پایه
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{teacher.courses?.join('، ') || 'دروس فقه و اصول و اشراف پایه'}</div>
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
      {/* Single Teacher Pay Slip Modal */}
      {singleSlipItem && (
        <TeacherCompensationSlipModal
          item={singleSlipItem}
          periodTitle={periodTitle || selectedArchivedPeriod?.title || 'دوره پرداخت حق‌الزحمه'}
          startDate={startDate || selectedArchivedPeriod?.startDate || ''}
          endDate={endDate || selectedArchivedPeriod?.endDate || ''}
          settings={settings}
          onClose={() => setSingleSlipItem(null)}
        />
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <TeacherCompensationSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onSave={handleSaveSettings}
        />
      )}
    </div>
  );
}
