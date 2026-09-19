import React, { useState, useEffect, useMemo } from 'react';
import { 
  UtensilsCrossed, 
  Users, 
  Calendar, 
  DollarSign, 
  FileSpreadsheet, 
  Plus, 
  Search, 
  Check, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Edit3, 
  Trash2,
  Sun,
  Moon,
  Building2,
  Bed,
  Layers,
  Settings,
  Lock,
  Unlock,
  Eye,
  RefreshCw,
  Sparkles,
  Filter,
  CalendarOff,
  UserCheck,
  Tag,
  BarChart3,
  CalendarDays,
  ListOrdered
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { 
  getTodayShamsi, 
  getShamsiDayOfWeekName, 
  generateShamsiDateRange, 
  compareShamsi,
  SHAMSI_MONTH_NAMES,
  SHAMSI_WEEKDAY_NAMES_SHORT,
  getDaysInShamsiMonth,
  getShamsiDayOfWeek,
  formatShamsiDate,
  parseShamsiDate,
  dateToShamsi,
  isDateBetween
} from '../../lib/jalali';
import { 
  Student, 
  MealReservationPeriod, 
  StudentMealReservation, 
  MealCancelledDay,
  MealPersonCategory,
  Teacher,
  DriverInfo,
  StaffMember
} from '../../types';
import { AppUser } from '../../types/auth';

interface LunchManagementProps {
  onNavigateTab?: (tab: string, params?: any) => void;
}

const WEEK_DAYS = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'] as const;

const DEFAULT_PERSON_CATEGORIES: MealPersonCategory[] = [
  { id: 'cat_student', title: 'طلبه', defaultLunchPrice: 45000, defaultDinnerPrice: 35000, isDefault: true },
  { id: 'cat_teacher', title: 'استاد', defaultLunchPrice: 45000, defaultDinnerPrice: 35000 },
  { id: 'cat_staff', title: 'کارمند / کادر', defaultLunchPrice: 45000, defaultDinnerPrice: 35000 },
  { id: 'cat_servant', title: 'خادم', defaultLunchPrice: 45000, defaultDinnerPrice: 35000 },
  { id: 'cat_guest', title: 'مهمان', defaultLunchPrice: 45000, defaultDinnerPrice: 35000 },
];

export default function LunchManagement({ onNavigateTab }: LunchManagementProps) {
  const { currentUser, isReadOnly } = useAuth();

  // Two main primary tabs as requested:
  // 1. 'create_period' (ایجاد دوره رزرو نهار و شام)
  // 2. 'stats' (بخش آمار)
  const [mainTab, setMainTab] = useState<'create_period' | 'stats'>('create_period');

  // Stats view mode (दो روش نمایش آمار):
  // 1. 'student_breakdown' (آمار یک طلبه / تفصیلی)
  // 2. 'daily_summary' (آمار اجمالی / روزانه بر اساس تاریخ‌ها بدون نام افراد)
  const [statsViewMode, setStatsViewMode] = useState<'student_breakdown' | 'daily_summary'>('student_breakdown');

  // Data states
  const [periods, setPeriods] = useState<MealReservationPeriod[]>([]);
  const [activePeriodId, setActivePeriodId] = useState<string>('');
  const [reservations, setReservations] = useState<StudentMealReservation[]>([]);
  const [kitchenHolidays, setKitchenHolidays] = useState<MealCancelledDay[]>([]);
  const [personCategories, setPersonCategories] = useState<MealPersonCategory[]>(DEFAULT_PERSON_CATEGORIES);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachersList, setTeachersList] = useState<Teacher[]>([]);
  const [driversList, setDriversList] = useState<DriverInfo[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [gradeProfessorsList, setGradeProfessorsList] = useState<{ id: string; fullName: string; grade: string; roleTitle: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // Filters for Date Range and Meals in Stats Report
  const [dateFilterMode, setDateFilterMode] = useState<'period' | 'custom'>('period');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedMealTypeFilter, setSelectedMealTypeFilter] = useState<'all' | 'lunch' | 'dinner'>('all');

  // Filters for Student Breakdown in Stats
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedDormFilter, setSelectedDormFilter] = useState<'all' | 'dorm' | 'non_dorm'>('all');

  // Modals
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<MealReservationPeriod | null>(null);
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isManualReservationModalOpen, setIsManualReservationModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<StudentMealReservation | null>(null);
  const [selectedStudentForCalendar, setSelectedStudentForCalendar] = useState<StudentMealReservation | null>(null);

  // Period Form State
  const [periodFormTitle, setPeriodFormTitle] = useState('رزرو نهار و شام مهر ۱۴۰۳');
  const [periodFormStartDate, setPeriodFormStartDate] = useState('۱۴۰۳/۰۷/۰۱');
  const [periodFormEndDate, setPeriodFormEndDate] = useState('۱۴۰۳/۰۷/۳۰');
  const [periodFormDeadline, setPeriodFormDeadline] = useState('۱۴۰۳/۰۷/۰۵');
  const [periodFormEnableLunch, setPeriodFormEnableLunch] = useState(true);
  const [periodFormEnableDinner, setPeriodFormEnableDinner] = useState(true);
  const [periodFormAllowDinnerLocation, setPeriodFormAllowDinnerLocation] = useState(true);
  const [periodFormLunchPrice, setPeriodFormLunchPrice] = useState<number>(45000);
  const [periodFormDinnerPrice, setPeriodFormDinnerPrice] = useState<number>(35000);
  const [periodFormLunchDisabledDays, setPeriodFormLunchDisabledDays] = useState<string[]>(['جمعه']);
  const [periodFormDinnerDisabledDays, setPeriodFormDinnerDisabledDays] = useState<string[]>(['جمعه']);

  // Holiday Form State
  const [holidayDate, setHolidayDate] = useState(getTodayShamsi());
  const [holidayCalYear, setHolidayCalYear] = useState<number>(1403);
  const [holidayCalMonth, setHolidayCalMonth] = useState<number>(7);
  const [holidayMealType, setHolidayMealType] = useState<'lunch' | 'dinner' | 'both'>('lunch');
  const [holidayReason, setHolidayReason] = useState('تعطیلی آشپزخانه و عدم پخت غذا');

  // Category Form State
  const [newCategoryTitle, setNewCategoryTitle] = useState('');

  // Manual Reservation Form State
  const [manualStudentMode, setManualStudentMode] = useState<'from_list' | 'custom'>('from_list');
  const [manualRoleType, setManualRoleType] = useState<'student' | 'teacher' | 'grade_professor' | 'driver' | 'staff' | 'guest'>('student');
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [manualSelectedEntityId, setManualSelectedEntityId] = useState('');
  const [manualSelectedStudentId, setManualSelectedStudentId] = useState('');
  const [manualCustomName, setManualCustomName] = useState('');
  const [manualGrade, setManualGrade] = useState('پایه ۷');
  const [manualCategory, setManualCategory] = useState('طلبه');
  const [manualLunchDays, setManualLunchDays] = useState<string[]>(['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه']);
  const [manualDinnerDays, setManualDinnerDays] = useState<string[]>([]);
  const [manualDinnerLocation, setManualDinnerLocation] = useState<'institute' | 'dormitory'>('institute');
  const [manualNotes, setManualNotes] = useState('');

  const today = getTodayShamsi();

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Load All Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [
        storedPeriods, 
        storedRes, 
        storedHolidays, 
        storedCategories, 
        storedStudents,
        storedTeachers,
        storedDrivers,
        storedStaff,
        storedGradeMentors,
        storedUsers
      ] = await Promise.all([
        localDb.getDocs<MealReservationPeriod>('finance_meal_periods'),
        localDb.getDocs<StudentMealReservation>('finance_student_meal_reservations'),
        localDb.getDocs<MealCancelledDay>('finance_meal_holidays'),
        localDb.getDocs<MealPersonCategory>('finance_meal_person_categories'),
        localDb.getDocs<Student>('students'),
        localDb.getDocs<Teacher>('teachers'),
        localDb.getDocs<DriverInfo>('drivers'),
        localDb.getDocs<StaffMember>('staff'),
        localDb.getDocs<any>('finance_grade_mentors'),
        localDb.getDocs<AppUser>('users')
      ]);

      setStudents(storedStudents || []);
      setTeachersList(storedTeachers || []);
      setDriversList(storedDrivers || []);
      setStaffList(storedStaff || []);

      // Build grade professors list from finance_grade_mentors and users
      const gradeProfMap = new Map<string, { id: string; fullName: string; grade: string; roleTitle: string }>();

      (storedGradeMentors || []).forEach((gm: any) => {
        if (gm.name) {
          gradeProfMap.set(gm.id || gm.name, {
            id: gm.id || `gm_${gm.name}`,
            fullName: gm.name,
            grade: gm.grade || 'استاد پایه',
            roleTitle: 'مسئول پایه'
          });
        }
      });

      (storedUsers || []).forEach((u: AppUser) => {
        const title = u.roleTitle || '';
        const role = u.role || '';
        const isGradeRole = role.includes('grade_') || role === 'grade_supervisor';
        const isGradeTitle = title.includes('استاد پایه') || title.includes('مسئول پایه');
        const hasManagedGrades = u.managedGrades && u.managedGrades.length > 0;

        if (isGradeRole || isGradeTitle || hasManagedGrades) {
          const key = u.id || u.fullName || u.name;
          const gradeLabel = u.managedGrades?.join('، ') || u.gradeLabel || 'استاد پایه';
          gradeProfMap.set(key, {
            id: u.id,
            fullName: u.fullName || u.name,
            grade: gradeLabel,
            roleTitle: u.roleTitle || 'استاد پایه'
          });
        }
      });

      setGradeProfessorsList(Array.from(gradeProfMap.values()));
      setKitchenHolidays(storedHolidays || []);

      // Load or seed categories
      if (storedCategories && storedCategories.length > 0) {
        setPersonCategories(storedCategories);
      } else {
        setPersonCategories(DEFAULT_PERSON_CATEGORIES);
        for (const cat of DEFAULT_PERSON_CATEGORIES) {
          await localDb.setDoc('finance_meal_person_categories', cat.id, cat);
        }
      }

      // Seed initial period if empty
      let validPeriods = storedPeriods || [];
      if (validPeriods.length === 0) {
        const initialPeriod: MealReservationPeriod = {
          id: 'period_mehr_1403',
          title: 'رزرو نهار و شام مهر ۱۴۰۳',
          startDate: '۱۴۰۳/۰۷/۰۱',
          endDate: '۱۴۰۳/۰۷/۳۰',
          deadlineDate: '۱۴۰۳/۰۷/۰۶',
          enableLunch: true,
          enableDinner: true,
          allowDinnerLocationSelect: true,
          lunchPrice: 45000,
          dinnerPrice: 35000,
          status: 'open',
          isManuallyClosed: false,
          lunchDisabledDays: ['جمعه'],
          dinnerDisabledDays: ['جمعه'],
          createdAt: new Date().toISOString(),
          createdByName: currentUser?.fullName || 'مسئول مالی'
        };
        await localDb.setDoc('finance_meal_periods', initialPeriod.id, initialPeriod);
        validPeriods = [initialPeriod];
      }

      // Sort periods (newest first)
      validPeriods.sort((a, b) => compareShamsi(b.startDate, a.startDate));
      setPeriods(validPeriods);

      if (!activePeriodId || !validPeriods.find(p => p.id === activePeriodId)) {
        setActivePeriodId(validPeriods[0]?.id || '');
      }

      // Seed mock student reservations if empty
      let validRes = storedRes || [];
      if (validRes.length === 0 && storedStudents && storedStudents.length > 0 && validPeriods[0]) {
        const seedPeriod = validPeriods[0];
        const initialSeedRes: StudentMealReservation[] = storedStudents.slice(0, 8).map((st, idx) => {
          const isDorm = st.livingStatus === 'خوابگاه';
          const lunchDays = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه'];
          const dinnerDays = isDorm ? ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه'] : (idx % 2 === 0 ? ['دوشنبه', 'سه‌شنبه'] : []);
          const dinnerLoc: 'institute' | 'dormitory' = isDorm ? 'dormitory' : 'institute';
          
          return {
            id: `res_${seedPeriod.id}_${st.id}`,
            periodId: seedPeriod.id,
            studentId: st.id,
            studentName: st.name,
            nationalId: st.nationalId || '',
            grade: st.grade || 'پایه ۷',
            personRoleTitle: 'طلبه',
            isDormitory: isDorm,
            selectedLunchDays: lunchDays,
            selectedDinnerDays: dinnerDays,
            dinnerLocation: dinnerLoc,
            totalCalculatedLunches: lunchDays.length * 4,
            totalCalculatedDinners: dinnerDays.length * 4,
            totalDinnersInstitute: dinnerLoc === 'institute' ? dinnerDays.length * 4 : 0,
            totalDinnersDormitory: dinnerLoc === 'dormitory' ? dinnerDays.length * 4 : 0,
            totalLunchCost: lunchDays.length * 4 * 45000,
            totalDinnerCost: dinnerDays.length * 4 * 35000,
            totalMealCost: (lunchDays.length * 4 * 45000) + (dinnerDays.length * 4 * 35000),
            subsidyDiscount: 0,
            finalDeductionAmount: (lunchDays.length * 4 * 45000) + (dinnerDays.length * 4 * 35000),
            updatedAt: new Date().toISOString()
          };
        });

        for (const r of initialSeedRes) {
          await localDb.setDoc('finance_student_meal_reservations', r.id, r);
        }
        validRes = initialSeedRes;
      }

      setReservations(validRes);
    } catch (err) {
      console.error('Error loading lunch management data:', err);
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

  // Active Selected Period
  const currentPeriod = useMemo(() => {
    return periods.find(p => p.id === activePeriodId) || periods[0] || null;
  }, [periods, activePeriodId]);

  // Sync initial custom dates when period changes or is selected
  useEffect(() => {
    if (currentPeriod) {
      if (!customStartDate) setCustomStartDate(currentPeriod.startDate);
      if (!customEndDate) setCustomEndDate(currentPeriod.endDate);
    }
  }, [currentPeriod]);

  // Helper to compute date offset in Shamsi (e.g. 7 days ago)
  const getShamsiDaysOffset = (offsetDays: number): string => {
    try {
      const d = new Date();
      d.setDate(d.getDate() + offsetDays);
      return dateToShamsi(d);
    } catch (e) {
      return getTodayShamsi();
    }
  };

  // Effective Start Date for Stats/Reports
  const effectiveStartDate = useMemo(() => {
    if (dateFilterMode === 'custom' && customStartDate) {
      return customStartDate;
    }
    return currentPeriod?.startDate || getTodayShamsi();
  }, [dateFilterMode, customStartDate, currentPeriod]);

  // Effective End Date for Stats/Reports
  const effectiveEndDate = useMemo(() => {
    if (dateFilterMode === 'custom' && customEndDate) {
      return customEndDate;
    }
    return currentPeriod?.endDate || getTodayShamsi();
  }, [dateFilterMode, customEndDate, currentPeriod]);

  // Base reservations according to dateFilterMode
  const baseReservations = useMemo(() => {
    if (dateFilterMode === 'period' && currentPeriod) {
      return reservations.filter(r => r.periodId === currentPeriod.id);
    }
    // In custom mode, consider all reservations
    return reservations;
  }, [reservations, dateFilterMode, currentPeriod]);

  // Calculate student breakdown with recalculated counts for effective date range
  const studentBreakdownList = useMemo(() => {
    if (!effectiveStartDate || !effectiveEndDate) return [];
    const dateRange = generateShamsiDateRange(effectiveStartDate, effectiveEndDate);

    return baseReservations.map(r => {
      const p = periods.find(period => period.id === r.periodId) || currentPeriod;
      let rangeLunches = 0;
      let rangeDinnersInstitute = 0;
      let rangeDinnersDormitory = 0;

      dateRange.forEach(date => {
        // If reservation is bound to a period, ensure date falls within period bounds
        if (p && p.startDate && p.endDate && !isDateBetween(date, p.startDate, p.endDate)) {
          return;
        }

        const dayOfWeek = getShamsiDayOfWeekName(date);
        const holiday = kitchenHolidays.find(h => h.date === date);
        const isLunchCancelled = holiday?.mealType === 'lunch' || holiday?.mealType === 'both';
        const isDinnerCancelled = holiday?.mealType === 'dinner' || holiday?.mealType === 'both';

        const isLunchDayDisabledInPeriod = p?.lunchDisabledDays?.includes(dayOfWeek) || p?.enableLunch === false;
        const isDinnerDayDisabledInPeriod = p?.dinnerDisabledDays?.includes(dayOfWeek) || p?.enableDinner === false;

        if (selectedMealTypeFilter !== 'dinner' && !isLunchCancelled && !isLunchDayDisabledInPeriod && r.selectedLunchDays?.includes(dayOfWeek)) {
          rangeLunches++;
        }

        if (selectedMealTypeFilter !== 'lunch' && !isDinnerCancelled && !isDinnerDayDisabledInPeriod && r.selectedDinnerDays?.includes(dayOfWeek)) {
          const loc = r.dinnerLocation || (r.isDormitory ? 'dormitory' : 'institute');
          if (loc === 'dormitory') {
            rangeDinnersDormitory++;
          } else {
            rangeDinnersInstitute++;
          }
        }
      });

      const rangeDinners = rangeDinnersInstitute + rangeDinnersDormitory;
      const rangeTotalMeals = rangeLunches + rangeDinners;

      return {
        ...r,
        calculatedLunchesForRange: rangeLunches,
        calculatedDinnersForRange: rangeDinners,
        calculatedDinnersInstituteForRange: rangeDinnersInstitute,
        calculatedDinnersDormitoryForRange: rangeDinnersDormitory,
        calculatedTotalMealsForRange: rangeTotalMeals
      };
    });
  }, [effectiveStartDate, effectiveEndDate, baseReservations, periods, currentPeriod, kitchenHolidays, selectedMealTypeFilter]);

  // Filtered reservations for Student Breakdown Table
  const filteredReservations = useMemo(() => {
    return studentBreakdownList.filter(r => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = r.studentName.toLowerCase().includes(q);
        const matchesNational = r.nationalId?.includes(q);
        if (!matchesName && !matchesNational) return false;
      }
      if (selectedGradeFilter !== 'all' && r.grade !== selectedGradeFilter) {
        return false;
      }
      if (selectedCategoryFilter !== 'all') {
        const cat = r.personRoleTitle || 'طلبه';
        if (cat !== selectedCategoryFilter) return false;
      }
      if (selectedDormFilter === 'dorm' && !r.isDormitory) return false;
      if (selectedDormFilter === 'non_dorm' && r.isDormitory) return false;

      return true;
    });
  }, [studentBreakdownList, searchQuery, selectedGradeFilter, selectedCategoryFilter, selectedDormFilter]);

  // Generate Daily Summary Breakdown for Effective Date Range (Method 2: بدون نام افراد)
  const dailySummaryList = useMemo(() => {
    if (!effectiveStartDate || !effectiveEndDate) return [];
    const dateRange = generateShamsiDateRange(effectiveStartDate, effectiveEndDate);

    return dateRange.map((date, idx) => {
      const dayOfWeek = getShamsiDayOfWeekName(date);
      const holiday = kitchenHolidays.find(h => h.date === date);
      const isLunchCancelled = holiday?.mealType === 'lunch' || holiday?.mealType === 'both';
      const isDinnerCancelled = holiday?.mealType === 'dinner' || holiday?.mealType === 'both';

      let lunchCount = 0;
      let dinnerInstituteCount = 0;
      let dinnerDormitoryCount = 0;

      // Find active reservations for this date
      const activeResForDate = reservations.filter(r => {
        const p = periods.find(period => period.id === r.periodId) || currentPeriod;
        if (p && p.startDate && p.endDate && !isDateBetween(date, p.startDate, p.endDate)) {
          return false;
        }
        return true;
      });

      activeResForDate.forEach(r => {
        const p = periods.find(period => period.id === r.periodId) || currentPeriod;
        const isLunchDayDisabled = p?.lunchDisabledDays?.includes(dayOfWeek) || p?.enableLunch === false;
        const isDinnerDayDisabled = p?.dinnerDisabledDays?.includes(dayOfWeek) || p?.enableDinner === false;

        if (selectedMealTypeFilter !== 'dinner' && !isLunchCancelled && !isLunchDayDisabled && r.selectedLunchDays?.includes(dayOfWeek)) {
          lunchCount++;
        }

        if (selectedMealTypeFilter !== 'lunch' && !isDinnerCancelled && !isDinnerDayDisabled && r.selectedDinnerDays?.includes(dayOfWeek)) {
          const loc = r.dinnerLocation || (r.isDormitory ? 'dormitory' : 'institute');
          if (loc === 'dormitory') {
            dinnerDormitoryCount++;
          } else {
            dinnerInstituteCount++;
          }
        }
      });

      const totalDinnerDay = dinnerInstituteCount + dinnerDormitoryCount;
      const totalMealsDay = lunchCount + totalDinnerDay;

      return {
        rowNumber: idx + 1,
        date,
        dayOfWeek,
        isHoliday: !!holiday,
        holidayReason: holiday?.reason,
        isLunchCancelled,
        isDinnerCancelled,
        lunchCount,
        dinnerInstituteCount,
        dinnerDormitoryCount,
        totalDinnerDay,
        totalMealsDay
      };
    });
  }, [effectiveStartDate, effectiveEndDate, reservations, periods, currentPeriod, kitchenHolidays, selectedMealTypeFilter]);

  // Overall KPIs for current date range & filters
  const periodKPIs = useMemo(() => {
    let totalLunches = 0;
    let totalDinnersInstitute = 0;
    let totalDinnersDormitory = 0;

    dailySummaryList.forEach(d => {
      totalLunches += d.lunchCount;
      totalDinnersInstitute += d.dinnerInstituteCount;
      totalDinnersDormitory += d.dinnerDormitoryCount;
    });

    const totalDinners = totalDinnersInstitute + totalDinnersDormitory;
    const totalAllMeals = totalLunches + totalDinners;

    return {
      totalStudentsRegistered: filteredReservations.length,
      totalLunches,
      totalDinnersInstitute,
      totalDinnersDormitory,
      totalDinners,
      totalAllMeals
    };
  }, [dailySummaryList, filteredReservations]);

  // Period Open / Closed Status Check
  const getPeriodStatusInfo = (p: MealReservationPeriod) => {
    if (p.isManuallyClosed) {
      return { label: 'بسته شده دستی', color: 'bg-rose-50 text-rose-700 border-rose-200', isOpen: false };
    }
    if (p.status !== 'open') {
      return { label: 'بسته / پایان یافته', color: 'bg-slate-100 text-slate-700 border-slate-200', isOpen: false };
    }
    if (p.deadlineDate && compareShamsi(today, p.deadlineDate) > 0) {
      return { label: 'مهلت به پایان رسیده', color: 'bg-amber-50 text-amber-800 border-amber-200', isOpen: false };
    }
    return { label: 'در حال ثبت‌نام (فعال)', color: 'bg-emerald-50 text-emerald-800 border-emerald-200', isOpen: true };
  };

  // Toggle Period Manual Open / Close
  const handleTogglePeriodManualClose = async (period: MealReservationPeriod) => {
    if (isReadOnly) return;
    const newStatus = !period.isManuallyClosed;
    const updated: MealReservationPeriod = {
      ...period,
      isManuallyClosed: newStatus,
      status: newStatus ? 'closed' : 'open',
      updatedAt: new Date().toISOString()
    };

    try {
      await localDb.setDoc('finance_meal_periods', period.id, updated);
      setPeriods(prev => prev.map(p => p.id === period.id ? updated : p));
      showToast(newStatus ? 'امکان ثبت رزرو برای طلاب با موفقیت بسته شد.' : 'امکان ثبت رزرو برای طلاب مجدداً باز گردید.');
    } catch (err) {
      console.error('Error updating period status:', err);
      showToast('خطا در تغییر وضعیت دوره.');
    }
  };

  // Open Create/Edit Period Modal
  const handleOpenPeriodModal = (periodToEdit?: MealReservationPeriod) => {
    if (periodToEdit) {
      setEditingPeriod(periodToEdit);
      setPeriodFormTitle(periodToEdit.title);
      setPeriodFormStartDate(periodToEdit.startDate);
      setPeriodFormEndDate(periodToEdit.endDate);
      setPeriodFormDeadline(periodToEdit.deadlineDate || '');
      setPeriodFormEnableLunch(periodToEdit.enableLunch !== false);
      setPeriodFormEnableDinner(periodToEdit.enableDinner !== false);
      setPeriodFormAllowDinnerLocation(periodToEdit.allowDinnerLocationSelect !== false);
      setPeriodFormLunchPrice(periodToEdit.lunchPrice || 45000);
      setPeriodFormDinnerPrice(periodToEdit.dinnerPrice || 35000);
      setPeriodFormLunchDisabledDays(periodToEdit.lunchDisabledDays || ['جمعه']);
      setPeriodFormDinnerDisabledDays(periodToEdit.dinnerDisabledDays || ['جمعه']);
    } else {
      setEditingPeriod(null);
      setPeriodFormTitle('رزرو نهار و شام ماه جدید');
      setPeriodFormStartDate(getTodayShamsi());
      setPeriodFormEndDate(getTodayShamsi());
      setPeriodFormDeadline(getTodayShamsi());
      setPeriodFormEnableLunch(true);
      setPeriodFormEnableDinner(true);
      setPeriodFormAllowDinnerLocation(true);
      setPeriodFormLunchPrice(45000);
      setPeriodFormDinnerPrice(35000);
      setPeriodFormLunchDisabledDays(['جمعه']);
      setPeriodFormDinnerDisabledDays(['جمعه']);
    }
    setIsPeriodModalOpen(true);
  };

  // Save Period
  const handleSavePeriod = async () => {
    if (!periodFormTitle.trim() || !periodFormStartDate || !periodFormEndDate) {
      showToast('لطفاً عنوان و بازه زمانی دوره را تکمیل فرمایید.');
      return;
    }

    const id = editingPeriod?.id || `period_${Date.now()}`;
    const newPeriod: MealReservationPeriod = {
      id,
      title: periodFormTitle.trim(),
      startDate: periodFormStartDate.trim(),
      endDate: periodFormEndDate.trim(),
      deadlineDate: periodFormDeadline.trim() || undefined,
      enableLunch: periodFormEnableLunch,
      enableDinner: periodFormEnableDinner,
      allowDinnerLocationSelect: periodFormAllowDinnerLocation,
      lunchPrice: Number(periodFormLunchPrice) || 45000,
      dinnerPrice: Number(periodFormDinnerPrice) || 35000,
      status: editingPeriod?.status || 'open',
      isManuallyClosed: editingPeriod ? editingPeriod.isManuallyClosed : false,
      lunchDisabledDays: periodFormLunchDisabledDays,
      dinnerDisabledDays: periodFormDinnerDisabledDays,
      createdAt: editingPeriod?.createdAt || new Date().toISOString(),
      createdByName: editingPeriod?.createdByName || currentUser?.fullName || 'مسئول مالی',
      updatedAt: new Date().toISOString()
    };

    try {
      await localDb.setDoc('finance_meal_periods', id, newPeriod);
      if (editingPeriod) {
        setPeriods(prev => prev.map(p => p.id === id ? newPeriod : p));
      } else {
        setPeriods(prev => [newPeriod, ...prev]);
        setActivePeriodId(id);
      }
      setIsPeriodModalOpen(false);
      showToast('دوره رزرو نهار و شام با موفقیت ذخیره شد.');
    } catch (err) {
      console.error('Error saving period:', err);
      showToast('خطا در ذخیره دوره رزرو.');
    }
  };

  // Delete Period
  const handleDeletePeriod = async (periodId: string) => {
    if (!window.confirm('آیا از حذف این دوره و کلیه رزروهای ثبت شده در آن اطمینان دارید؟')) return;
    try {
      await localDb.deleteDoc('finance_meal_periods', periodId);
      const remainingPeriods = periods.filter(p => p.id !== periodId);
      setPeriods(remainingPeriods);
      if (activePeriodId === periodId && remainingPeriods.length > 0) {
        setActivePeriodId(remainingPeriods[0].id);
      }
      showToast('دوره با موفقیت حذف گردید.');
    } catch (err) {
      console.error('Error deleting period:', err);
      showToast('خطا در حذف دوره.');
    }
  };

  // Save Cancelled Kitchen Holiday
  const handleSaveHoliday = async () => {
    if (!holidayDate) return;
    const id = `holiday_${Date.now()}`;
    const newHoliday: MealCancelledDay = {
      id,
      date: holidayDate,
      mealType: holidayMealType,
      reason: holidayReason.trim() || 'تعطیلی آشپزخانه',
      registeredAt: new Date().toISOString(),
      registeredByName: currentUser?.fullName || 'مسئول مالی'
    };

    try {
      await localDb.setDoc('finance_meal_holidays', id, newHoliday);
      setKitchenHolidays(prev => [newHoliday, ...prev]);
      setIsHolidayModalOpen(false);
      showToast('روز تعطیلی آشپزخانه با موفقیت ثبت شد و از آمار کسر گردید.');
    } catch (err) {
      console.error('Error saving holiday:', err);
      showToast('خطا در ثبت روز تعطیل.');
    }
  };

  // Delete Holiday
  const handleDeleteHoliday = async (id: string) => {
    try {
      await localDb.deleteDoc('finance_meal_holidays', id);
      setKitchenHolidays(prev => prev.filter(h => h.id !== id));
      showToast('روز لغو شده با موفقیت حذف گردید.');
    } catch (err) {
      console.error('Error deleting holiday:', err);
    }
  };

  // Save Person Category
  const handleAddCategory = async () => {
    if (!newCategoryTitle.trim()) return;
    const id = `cat_${Date.now()}`;
    const newCat: MealPersonCategory = {
      id,
      title: newCategoryTitle.trim(),
      defaultLunchPrice: 45000,
      defaultDinnerPrice: 35000,
      createdAt: new Date().toISOString()
    };

    try {
      await localDb.setDoc('finance_meal_person_categories', id, newCat);
      setPersonCategories(prev => [...prev, newCat]);
      setNewCategoryTitle('');
      showToast(`عنوان «${newCat.title}» با موفقیت اضافه شد.`);
    } catch (err) {
      console.error('Error adding category:', err);
      showToast('خطا در افزودن عنوان.');
    }
  };

  // Delete Category
  const handleDeleteCategory = async (id: string) => {
    try {
      await localDb.deleteDoc('finance_meal_person_categories', id);
      setPersonCategories(prev => prev.filter(c => c.id !== id));
      showToast('عنوان حذف گردید.');
    } catch (err) {
      console.error('Error deleting category:', err);
    }
  };

  // Save / Update Manual Reservation
  const handleSaveManualReservation = async () => {
    if (!currentPeriod) {
      showToast('خطا: دوره‌ای انتخاب نشده است.');
      return;
    }

    let studentId = '';
    let studentName = '';
    let nationalId = '';
    let grade = manualGrade;
    let isDorm = false;
    let roleTitle = manualCategory;

    if (manualRoleType === 'student') {
      const found = students.find(s => s.id === manualSelectedEntityId || s.id === manualSelectedStudentId);
      if (!found) {
        showToast('لطفاً طلبه را از لیست انتخاب فرمایید.');
        return;
      }
      studentId = found.id;
      studentName = found.name;
      nationalId = found.nationalId || '';
      grade = found.grade || 'پایه ۷';
      isDorm = found.livingStatus === 'خوابگاه';
      roleTitle = 'طلبه';
    } else if (manualRoleType === 'teacher') {
      const found = teachersList.find(t => t.id === manualSelectedEntityId);
      if (!found) {
        showToast('لطفاً استاد را از لیست اساتید انتخاب فرمایید.');
        return;
      }
      studentId = found.id;
      studentName = found.fullName;
      nationalId = found.phoneNumber || '';
      grade = found.subjectSpecialty || 'کادر اساتید';
      isDorm = false;
      roleTitle = 'استاد';
    } else if (manualRoleType === 'grade_professor') {
      const found = gradeProfessorsList.find(gp => gp.id === manualSelectedEntityId);
      if (!found) {
        showToast('لطفاً استاد پایه را از لیست انتخاب فرمایید.');
        return;
      }
      studentId = found.id;
      studentName = found.fullName;
      nationalId = '';
      grade = found.grade || 'اساتید پایه';
      isDorm = false;
      roleTitle = 'استاد پایه';
    } else if (manualRoleType === 'driver') {
      const found = driversList.find(d => d.id === manualSelectedEntityId);
      if (!found) {
        showToast('لطفاً راننده را از لیست رانندگان انتخاب فرمایید.');
        return;
      }
      studentId = found.id;
      studentName = found.fullName || found.name || '';
      nationalId = found.phoneNumber || found.phone || '';
      grade = found.carModel ? `راننده (${found.carModel})` : 'راننده سرویس';
      isDorm = false;
      roleTitle = 'راننده';
    } else if (manualRoleType === 'staff') {
      const found = staffList.find(s => s.id === manualSelectedEntityId);
      if (!found) {
        showToast('لطفاً کارمند را از لیست پرسنل انتخاب فرمایید.');
        return;
      }
      studentId = found.id;
      studentName = found.fullName;
      nationalId = found.nationalId || found.phoneNumber || '';
      grade = found.roleTitle || 'کادر اجرایی';
      isDorm = false;
      roleTitle = found.roleTitle || 'کادر / پرسنل';
    } else { // guest
      if (!manualCustomName.trim()) {
        showToast('لطفاً نام و نام خانوادگی فرد مهمان را وارد فرمایید.');
        return;
      }
      studentId = editingReservation ? editingReservation.studentId : `guest_${Date.now()}`;
      studentName = manualCustomName.trim();
      grade = manualGrade.trim() || 'مهمان';
      isDorm = false;
      roleTitle = manualCategory || 'مهمان';
    }

    // Calculate portions for this student in current period
    const dateRange = generateShamsiDateRange(currentPeriod.startDate, currentPeriod.endDate);
    let lunchCount = 0;
    let dinnerCount = 0;

    dateRange.forEach(date => {
      const dayOfWeek = getShamsiDayOfWeekName(date);
      const holiday = kitchenHolidays.find(h => h.date === date);
      const isLunchCancelled = holiday?.mealType === 'lunch' || holiday?.mealType === 'both';
      const isDinnerCancelled = holiday?.mealType === 'dinner' || holiday?.mealType === 'both';

      if (manualLunchDays.includes(dayOfWeek) && !currentPeriod.lunchDisabledDays?.includes(dayOfWeek) && !isLunchCancelled) {
        lunchCount++;
      }
      if (manualDinnerDays.includes(dayOfWeek) && !currentPeriod.dinnerDisabledDays?.includes(dayOfWeek) && !isDinnerCancelled) {
        dinnerCount++;
      }
    });

    const lunchUnitCost = currentPeriod.lunchPrice || 45000;
    const dinnerUnitCost = currentPeriod.dinnerPrice || 35000;
    const totalLunchCost = lunchCount * lunchUnitCost;
    const totalDinnerCost = dinnerCount * dinnerUnitCost;
    const totalMealCost = totalLunchCost + totalDinnerCost;

    const recordId = editingReservation ? editingReservation.id : `res_${currentPeriod.id}_${studentId}`;

    const updatedRes: StudentMealReservation = {
      id: recordId,
      periodId: currentPeriod.id,
      studentId,
      studentName,
      nationalId,
      grade,
      personRoleTitle: roleTitle,
      isDormitory: isDorm,
      selectedLunchDays: manualLunchDays,
      selectedDinnerDays: manualDinnerDays,
      dinnerLocation: manualDinnerLocation,
      totalCalculatedLunches: lunchCount,
      totalCalculatedDinners: dinnerCount,
      totalDinnersInstitute: manualDinnerLocation === 'institute' ? dinnerCount : 0,
      totalDinnersDormitory: manualDinnerLocation === 'dormitory' ? dinnerCount : 0,
      totalLunchCost,
      totalDinnerCost,
      totalMealCost,
      subsidyDiscount: 0,
      finalDeductionAmount: totalMealCost,
      notes: manualNotes.trim(),
      updatedAt: new Date().toISOString()
    };

    try {
      await localDb.setDoc('finance_student_meal_reservations', recordId, updatedRes);
      setReservations(prev => {
        const idx = prev.findIndex(r => r.id === recordId);
        if (idx >= 0) {
          const clone = [...prev];
          clone[idx] = updatedRes;
          return clone;
        }
        return [updatedRes, ...prev];
      });
      setIsManualReservationModalOpen(false);
      showToast('رزرو فرد با موفقیت ثبت/ویرایش شد.');
    } catch (err) {
      console.error('Error saving manual reservation:', err);
      showToast('خطا در ذخیره رزرو فرد.');
    }
  };

  // Open Edit Manual Reservation Modal
  const handleEditReservation = (res: StudentMealReservation) => {
    setEditingReservation(res);
    setManualStudentMode('custom');
    setManualCustomName(res.studentName);
    setManualGrade(res.grade || 'پایه ۷');
    setManualCategory(res.personRoleTitle || 'طلبه');
    setManualLunchDays(res.selectedLunchDays || []);
    setManualDinnerDays(res.selectedDinnerDays || []);
    setManualDinnerLocation(res.dinnerLocation || (res.isDormitory ? 'dormitory' : 'institute'));
    setManualNotes(res.notes || '');
    setIsManualReservationModalOpen(true);
  };

  // Delete Reservation
  const handleDeleteReservation = async (id: string) => {
    if (!window.confirm('آیا از حذف این رزرو اطمینان دارید؟')) return;
    try {
      await localDb.deleteDoc('finance_student_meal_reservations', id);
      setReservations(prev => prev.filter(r => r.id !== id));
      showToast('رزرو فرد با موفقیت حذف گردید.');
    } catch (err) {
      console.error('Error deleting reservation:', err);
      showToast('خطا در حذف رزرو.');
    }
  };

  // EXCEL EXPORT 1: Student Breakdown (آمار تفصیلی طلاب)
  const exportStudentBreakdownToExcel = () => {
    const dataRows = filteredReservations.map((r, idx) => ({
      'ردیف': idx + 1,
      'نام و نام خانوادگی': r.studentName,
      'عنوان / سمت': r.personRoleTitle || 'طلبه',
      'پایه تحصیلی': r.grade || 'نامشخص',
      'کد ملی': r.nationalId || '-',
      'وضعیت سکونت': r.isDormitory ? 'خوابگاه' : 'منزل',
      'محل دریافت شام': r.dinnerLocation === 'dormitory' ? 'خوابگاه' : 'موسسه',
      'روزهای نهار': (r.selectedLunchDays || []).join('، ') || 'ندارد',
      'روزهای شام': (r.selectedDinnerDays || []).join('، ') || 'ندارد',
      'تعداد وعده نهار': r.calculatedLunchesForRange ?? (r.totalCalculatedLunches || 0),
      'تعداد شام موسسه': r.calculatedDinnersInstituteForRange ?? (r.totalDinnersInstitute || 0),
      'تعداد شام خوابگاه': r.calculatedDinnersDormitoryForRange ?? (r.totalDinnersDormitory || 0),
      'مجموع شام': r.calculatedDinnersForRange ?? (r.totalCalculatedDinners || 0),
      'جمع کل وعده‌ها در بازه': r.calculatedTotalMealsForRange ?? ((r.totalCalculatedLunches || 0) + (r.totalCalculatedDinners || 0)),
    }));

    const ws = XLSX.utils.json_to_sheet(dataRows);
    ws['!cols'] = [
      { wch: 6 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
      { wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 30 }, { wch: 14 },
      { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }
    ];

    const rangeTag = `${effectiveStartDate.replace(/\//g, '-')}_الی_${effectiveEndDate.replace(/\//g, '-')}`;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'آمار تفصیلی طلاب');
    XLSX.writeFile(wb, `گزارش_تفصیلی_تغذیه_${rangeTag}.xlsx`);
  };

  // EXCEL EXPORT 2: Daily Summary (آمار اجمالی و روزانه بدون نام افراد)
  const exportDailySummaryToExcel = () => {
    const dataRows: Record<string, any>[] = dailySummaryList.map((d) => ({
      'ردیف': d.rowNumber,
      'تاریخ شمسی': d.date,
      'روز هفته': d.dayOfWeek,
      'وضعیت آشپزخانه': d.isHoliday ? `تعطیل (${d.holidayReason || 'لغو پخت'})` : 'دایر و فعال',
      'تعداد نهار': d.lunchCount,
      'تعداد شام موسسه': d.dinnerInstituteCount,
      'تعداد شام خوابگاه': d.dinnerDormitoryCount,
      'مجموع شام': d.totalDinnerDay,
      'جمع کل وعده‌های روز': d.totalMealsDay
    }));

    // Add totals row at bottom
    dataRows.push({
      'ردیف': 'جمع کل',
      'تاریخ شمسی': `بازه ${effectiveStartDate} الی ${effectiveEndDate}`,
      'روز هفته': '-',
      'وضعیت آشپزخانه': '-',
      'تعداد نهار': periodKPIs.totalLunches,
      'تعداد شام موسسه': periodKPIs.totalDinnersInstitute,
      'تعداد شام خوابگاه': periodKPIs.totalDinnersDormitory,
      'مجموع شام': periodKPIs.totalDinners,
      'جمع کل وعده‌های روز': periodKPIs.totalAllMeals
    });

    const ws = XLSX.utils.json_to_sheet(dataRows);
    ws['!cols'] = [
      { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 22 },
      { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 18 }
    ];

    const rangeTag = `${effectiveStartDate.replace(/\//g, '-')}_الی_${effectiveEndDate.replace(/\//g, '-')}`;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'آمار اجمالی روزانه');
    XLSX.writeFile(wb, `گزارش_اجمالی_روزانه_تغذیه_${rangeTag}.xlsx`);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <RefreshCw className="animate-spin text-indigo-600" size={32} />
        <p className="text-xs font-bold text-slate-500">در حال بارگذاری اطلاعات نهار و شام...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-vazir" dir="rtl">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2.5 text-xs font-bold"
          >
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Header & Actions */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white shadow-md">
            <UtensilsCrossed size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span>مدیریت رزرو نهار و شام</span>
              <span className="text-xs font-bold px-2.5 py-0.5 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-full">
                امور مالی و تغذیه
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              ایجاد دوره‌های رزرو، زمان‌بندی مهلت ثبت‌نام طلاب، و آمار تفصیلی و اجمالی نهار و شام
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Categories Button */}
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center gap-1.5 cursor-pointer"
            title="تعریف و تنظیم عناوین پرسنلی (طلبه، استاد، کارمند، مهمان...)"
          >
            <Tag size={15} className="text-indigo-600" />
            <span>تنظیم عناوین افراد ({personCategories.length})</span>
          </button>

          {/* Kitchen Holidays Button */}
          <button
            onClick={() => setIsHolidayModalOpen(true)}
            className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center gap-1.5 cursor-pointer"
            title="ثبت تعطیلی آشپزخانه یا لغو پخت غذا"
          >
            <CalendarOff size={15} className="text-rose-600" />
            <span>تعطیلات آشپزخانه ({kitchenHolidays.length})</span>
          </button>

          {/* New Period Button */}
          <button
            onClick={() => handleOpenPeriodModal()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={16} />
            <span>ایجاد دوره رزرو جدید</span>
          </button>
        </div>
      </div>

      {/* 2 Main Primary Navigation Tabs (کلاً دو گزینه طبق دستور کاربر) */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setMainTab('create_period')}
          className={cn(
            "px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer",
            mainTab === 'create_period'
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          )}
        >
          <Calendar size={16} />
          <span>۱. ایجاد دوره رزرو نهار و شام و مدیریت دوره‌ها</span>
          <span className="px-2 py-0.2 rounded-full text-[10px] bg-white/20">
            {periods.length}
          </span>
        </button>

        <button
          onClick={() => setMainTab('stats')}
          className={cn(
            "px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer",
            mainTab === 'stats'
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
          )}
        >
          <BarChart3 size={16} />
          <span>۲. بخش آمار و گزارشات جامع نهار و شام</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ایجاد دوره رزرو نهار و شام و مدیریت دوره‌ها */}
      {/* ========================================================================= */}
      {mainTab === 'create_period' && (
        <div className="space-y-6">
          {/* Active Period Quick Status & Toggle */}
          {currentPeriod && (
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-indigo-300 font-bold">دوره فعال انتخابی:</span>
                  <h2 className="text-base font-black text-white">{currentPeriod.title}</h2>
                  <span className={cn(
                    "text-[10px] font-bold px-2.5 py-0.5 rounded-full border",
                    getPeriodStatusInfo(currentPeriod).color
                  )}>
                    {getPeriodStatusInfo(currentPeriod).label}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  بازه زمانی: <strong className="text-white">{currentPeriod.startDate}</strong> الی <strong className="text-white">{currentPeriod.endDate}</strong>
                  {currentPeriod.deadlineDate && (
                    <span className="mr-3 text-amber-300">
                      • مهلت ثبت‌نام طلاب: تا {currentPeriod.deadlineDate}
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                {/* Manual Toggle Close / Open */}
                <button
                  onClick={() => handleTogglePeriodManualClose(currentPeriod)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer",
                    currentPeriod.isManuallyClosed
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-rose-600 hover:bg-rose-700 text-white"
                  )}
                >
                  {currentPeriod.isManuallyClosed ? <Unlock size={14} /> : <Lock size={14} />}
                  <span>{currentPeriod.isManuallyClosed ? 'باز کردن مجدد امکان ثبت‌نام' : 'بستن دستی امکان ثبت‌نام طلاب'}</span>
                </button>

                {/* Switch directly to stats */}
                <button
                  onClick={() => {
                    setActivePeriodId(currentPeriod.id);
                    setMainTab('stats');
                  }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <BarChart3 size={14} />
                  <span>مشاهده آمار کامل این دوره</span>
                </button>
              </div>
            </div>
          )}

          {/* List of All Periods with Direct Stats Click (دوره‌های قبلی و جاری) */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900">لیست دوره‌های رزرو نهار و شام (قبلی و جاری)</h3>
                <p className="text-[11px] text-slate-500">
                  با کلیک روی هر دوره، وضعیت و آمار آن دوره را به طور کامل مشاهده نمایید.
                </p>
              </div>

              <button
                onClick={() => handleOpenPeriodModal()}
                className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all border border-indigo-200 flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} />
                <span>دوره جدید</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {periods.map(p => {
                const statusInfo = getPeriodStatusInfo(p);
                const isSelected = p.id === activePeriodId;
                const pResCount = reservations.filter(r => r.periodId === p.id).length;

                return (
                  <div
                    key={p.id}
                    onClick={() => setActivePeriodId(p.id)}
                    className={cn(
                      "p-4 rounded-2xl border transition-all cursor-pointer space-y-3 relative group",
                      isSelected
                        ? "bg-indigo-50/50 border-indigo-300 ring-2 ring-indigo-500/20 shadow-sm"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {p.title}
                        </h4>
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                          بازه: {p.startDate} الی {p.endDate}
                        </span>
                      </div>
                      <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border", statusInfo.color)}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl">
                      <span>تعداد طلاب ثبت‌شده:</span>
                      <strong className="font-mono text-slate-900">{pResCount} نفر</strong>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        {p.enableLunch !== false && <span className="text-amber-600 font-bold">نهار دایر</span>}
                        {p.enableLunch !== false && p.enableDinner !== false && <span>•</span>}
                        {p.enableDinner !== false && <span className="text-indigo-600 font-bold">شام دایر</span>}
                      </div>

                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setActivePeriodId(p.id);
                            setMainTab('stats');
                          }}
                          className="px-2 py-1 bg-indigo-600 text-white rounded-lg font-bold text-[10px] hover:bg-indigo-700"
                          title="مشاهده آمار دوره"
                        >
                          آمار دوره
                        </button>

                        <button
                          onClick={() => handleTogglePeriodManualClose(p)}
                          className={cn(
                            "p-1.5 rounded-lg border",
                            p.isManuallyClosed
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          )}
                          title={p.isManuallyClosed ? 'باز کردن رزرو' : 'بستن رزرو'}
                        >
                          {p.isManuallyClosed ? <Unlock size={12} /> : <Lock size={12} />}
                        </button>

                        <button
                          onClick={() => handleOpenPeriodModal(p)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                          title="ویرایش دوره"
                        >
                          <Edit3 size={12} />
                        </button>

                        <button
                          onClick={() => handleDeletePeriod(p.id)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg"
                          title="حذف دوره"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: بخش آمار و گزارشات جامع نهار و شام */}
      {/* ========================================================================= */}
      {mainTab === 'stats' && (
        <div className="space-y-6">
          {/* Enhanced Date Range & Filtering Control Bar */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              {/* Report Mode & Range Selection */}
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 ml-1">
                  <Filter size={15} className="text-indigo-600" />
                  <span>فیلتر زمان گزارش:</span>
                </span>

                <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
                  <button
                    onClick={() => setDateFilterMode('period')}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                      dateFilterMode === 'period'
                        ? "bg-white text-indigo-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <Layers size={14} />
                    <span>بر اساس دوره فعال</span>
                  </button>

                  <button
                    onClick={() => {
                      setDateFilterMode('custom');
                      if (!customStartDate && currentPeriod) setCustomStartDate(currentPeriod.startDate);
                      if (!customEndDate && currentPeriod) setCustomEndDate(currentPeriod.endDate);
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                      dateFilterMode === 'custom'
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <Calendar size={14} />
                    <span>بازه زمانی دلخواه</span>
                  </button>
                </div>

                {dateFilterMode === 'period' ? (
                  <div className="flex items-center gap-2 mr-2">
                    <select
                      value={activePeriodId}
                      onChange={(e) => setActivePeriodId(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3 py-1.5 outline-none focus:border-indigo-500 transition-all cursor-pointer"
                    >
                      {periods.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({p.startDate} الی {p.endDate})
                        </option>
                      ))}
                    </select>

                    {currentPeriod && (
                      <span className={cn(
                        "text-[10px] font-bold px-2.5 py-0.5 rounded-full border hidden sm:inline-block",
                        getPeriodStatusInfo(currentPeriod).color
                      )}>
                        {getPeriodStatusInfo(currentPeriod).label}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 bg-indigo-50/60 border border-indigo-100 p-2 rounded-2xl mr-1">
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-indigo-900 font-bold text-[11px]">از:</span>
                      <input
                        type="text"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        placeholder="1403/07/01"
                        className="w-24 bg-white border border-indigo-200 text-slate-900 text-xs font-mono font-bold rounded-lg px-2 py-1 text-center outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-indigo-900 font-bold text-[11px]">تا:</span>
                      <input
                        type="text"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        placeholder="1403/07/30"
                        className="w-24 bg-white border border-indigo-200 text-slate-900 text-xs font-mono font-bold rounded-lg px-2 py-1 text-center outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Presets */}
                    <div className="flex items-center gap-1 mr-2 border-r border-indigo-200 pr-2">
                      <button
                        onClick={() => {
                          setCustomStartDate(getTodayShamsi());
                          setCustomEndDate(getTodayShamsi());
                        }}
                        className="px-2 py-1 bg-white hover:bg-indigo-100 text-indigo-800 rounded-lg text-[10px] font-bold border border-indigo-200 cursor-pointer"
                      >
                        امروز
                      </button>
                      <button
                        onClick={() => {
                          setCustomStartDate(getShamsiDaysOffset(-6));
                          setCustomEndDate(getTodayShamsi());
                        }}
                        className="px-2 py-1 bg-white hover:bg-indigo-100 text-indigo-800 rounded-lg text-[10px] font-bold border border-indigo-200 cursor-pointer"
                      >
                        ۷ روز اخیر
                      </button>
                      <button
                        onClick={() => {
                          setCustomStartDate(getShamsiDaysOffset(-29));
                          setCustomEndDate(getTodayShamsi());
                        }}
                        className="px-2 py-1 bg-white hover:bg-indigo-100 text-indigo-800 rounded-lg text-[10px] font-bold border border-indigo-200 cursor-pointer"
                      >
                        ۳۰ روز اخیر
                      </button>
                      {currentPeriod && (
                        <button
                          onClick={() => {
                            setCustomStartDate(currentPeriod.startDate);
                            setCustomEndDate(currentPeriod.endDate);
                          }}
                          className="px-2 py-1 bg-white hover:bg-indigo-100 text-indigo-800 rounded-lg text-[10px] font-bold border border-indigo-200 cursor-pointer"
                        >
                          بازه دوره فعال
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* View Method Switcher */}
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl self-start lg:self-auto">
                <button
                  onClick={() => setStatsViewMode('student_breakdown')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer",
                    statsViewMode === 'student_breakdown'
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <Users size={14} />
                  <span>آمار تفصیلی افراد</span>
                </button>

                <button
                  onClick={() => setStatsViewMode('daily_summary')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer",
                    statsViewMode === 'daily_summary'
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <CalendarDays size={14} />
                  <span>آمار اجمالی روزانه</span>
                </button>
              </div>
            </div>

            {/* Filter Bar Row 2: Meal Type Selector & Active Info Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              {/* Meal Type Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">انتخاب وعده:</span>
                <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setSelectedMealTypeFilter('all')}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                      selectedMealTypeFilter === 'all'
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <UtensilsCrossed size={13} />
                    <span>همه (نهار و شام)</span>
                  </button>

                  <button
                    onClick={() => setSelectedMealTypeFilter('lunch')}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                      selectedMealTypeFilter === 'lunch'
                        ? "bg-amber-500 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <Sun size={13} />
                    <span>فقط نهار</span>
                  </button>

                  <button
                    onClick={() => setSelectedMealTypeFilter('dinner')}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                      selectedMealTypeFilter === 'dinner'
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <Moon size={13} />
                    <span>فقط شام</span>
                  </button>
                </div>
              </div>

              {/* Active Date Range Info Tag */}
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
                <Clock size={14} className="text-indigo-600" />
                <span>
                  بازه فعال گزارش: <strong className="text-slate-900 font-mono">{effectiveStartDate}</strong> الی <strong className="text-slate-900 font-mono">{effectiveEndDate}</strong>
                </span>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full text-[10px] font-bold font-mono">
                  {generateShamsiDateRange(effectiveStartDate, effectiveEndDate).length} روز
                </span>
              </div>
            </div>
          </div>

          {/* Separated KPI Summary Cards (کلاً آمار نهار و شام جدا) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* 1. Lunch */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold">کل وعده نهار</span>
                <Sun size={18} className="text-amber-500" />
              </div>
              <div className="text-2xl font-black font-mono text-slate-900">
                {periodKPIs.totalLunches.toLocaleString('fa-IR')} <span className="text-xs font-sans text-slate-500 font-normal">وعده</span>
              </div>
            </div>

            {/* 2. Dinner Institute */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold">شام در موسسه</span>
                <Building2 size={18} className="text-indigo-600" />
              </div>
              <div className="text-2xl font-black font-mono text-indigo-700">
                {periodKPIs.totalDinnersInstitute.toLocaleString('fa-IR')} <span className="text-xs font-sans text-slate-500 font-normal">وعده</span>
              </div>
            </div>

            {/* 3. Dinner Dormitory */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold">شام در خوابگاه</span>
                <Bed size={18} className="text-purple-600" />
              </div>
              <div className="text-2xl font-black font-mono text-purple-700">
                {periodKPIs.totalDinnersDormitory.toLocaleString('fa-IR')} <span className="text-xs font-sans text-slate-500 font-normal">وعده</span>
              </div>
            </div>

            {/* 4. Total Dinner */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold">مجموع کل شام</span>
                <Moon size={18} className="text-indigo-900" />
              </div>
              <div className="text-2xl font-black font-mono text-indigo-900">
                {periodKPIs.totalDinners.toLocaleString('fa-IR')} <span className="text-xs font-sans text-slate-500 font-normal">وعده</span>
              </div>
            </div>

            {/* 5. Total All Meals */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-2xl shadow-md space-y-1 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-xs font-bold">جمع کل نهار و شام</span>
                <UtensilsCrossed size={18} className="text-amber-400" />
              </div>
              <div className="text-2xl font-black font-mono text-amber-400">
                {periodKPIs.totalAllMeals.toLocaleString('fa-IR')} <span className="text-xs font-sans text-slate-300 font-normal">وعده</span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* METHOD 1: نمایش به صورت آمار یک طلبه (تفصیلی) */}
          {/* ========================================================================= */}
          {statsViewMode === 'student_breakdown' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    روش اول: آمار تفصیلی به ازای هر طلبه (تعداد روزهای رزرو شده و مجموع دوره)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    نمایش عناوین افراد، روزهای انتخابی، محل دریافت شام و مجموع کل وعده‌ها با قابلیت خروجی اکسل
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingReservation(null);
                      setManualStudentMode('from_list');
                      setManualSelectedStudentId(students[0]?.id || '');
                      setManualGrade('پایه ۷');
                      setManualCategory('طلبه');
                      setManualLunchDays(['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه']);
                      setManualDinnerDays([]);
                      setManualDinnerLocation('institute');
                      setManualNotes('');
                      setIsManualReservationModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>ثبت دستی رزرو برای فرد</span>
                  </button>

                  <button
                    onClick={exportStudentBreakdownToExcel}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet size={14} />
                    <span>خروجی اکسل آمار تفصیلی</span>
                  </button>
                </div>
              </div>

              {/* Filters Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
                <div className="relative">
                  <Search size={14} className="absolute right-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="جستجوی نام یا کدملی..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pr-9 pl-3 py-2 outline-none focus:border-indigo-500"
                  />
                </div>

                <select
                  value={selectedGradeFilter}
                  onChange={(e) => setSelectedGradeFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2 outline-none"
                >
                  <option value="all">همه پایه‌های تحصیلی</option>
                  <option value="پایه ۷">پایه ۷</option>
                  <option value="پایه ۸">پایه ۸</option>
                  <option value="پایه ۹">پایه ۹</option>
                  <option value="پایه ۱۰">پایه ۱۰</option>
                </select>

                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2 outline-none"
                >
                  <option value="all">همه عناوین (طلبه، استاد، کارمند...)</option>
                  {personCategories.map(cat => (
                    <option key={cat.id} value={cat.title}>{cat.title}</option>
                  ))}
                </select>

                <select
                  value={selectedDormFilter}
                  onChange={(e) => setSelectedDormFilter(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2 outline-none"
                >
                  <option value="all">همه وضعیت‌های سکونت</option>
                  <option value="dorm">فقط ساکنین خوابگاه</option>
                  <option value="non_dorm">غیر خوابگاهی (منزل)</option>
                </select>
              </div>

              {/* Two Separate Tables: Table 1 for Lunch, Table 2 for Dinner */}
              <div className="space-y-6 pt-2">
                {/* TABLE 1: LUNCH STATISTICS */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-amber-50/80 px-4 py-2.5 rounded-2xl border border-amber-200">
                    <div className="flex items-center gap-2">
                      <Sun size={18} className="text-amber-600" />
                      <h4 className="text-xs font-black text-amber-950">جدول شماره ۱: آمار و اطلاعات تفصیلی نهار</h4>
                    </div>
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-lg border border-amber-300">
                      مجموع نهار دوره: {filteredReservations.reduce((acc, r) => acc + (r.calculatedLunchesForRange ?? (r.totalCalculatedLunches || 0)), 0).toLocaleString('fa-IR')} وعده
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-amber-200/80 rounded-2xl bg-white shadow-xs">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-amber-100/50 text-amber-950 border-b border-amber-200 font-black">
                          <th className="py-3 px-3">ردیف</th>
                          <th className="py-3 px-3">نام و نام خانوادگی</th>
                          <th className="py-3 px-3">عنوان / سمت</th>
                          <th className="py-3 px-3">پایه تحصیلی</th>
                          <th className="py-3 px-3">روزهای رزرو نهار</th>
                          <th className="py-3 px-3 text-center">تعداد نهار در بازه</th>
                          <th className="py-3 px-3 text-center">مبلغ کسر نهار (تومان)</th>
                          <th className="py-3 px-3 text-center">عملیات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredReservations.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-6 text-center text-slate-400 font-bold">
                              هیچ داده‌ای برای نمایش اطلاعات نهار وجود ندارد.
                            </td>
                          </tr>
                        ) : (
                          filteredReservations.map((r, idx) => {
                            const rangeLunches = r.calculatedLunchesForRange ?? (r.totalCalculatedLunches || 0);
                            const lunchCost = rangeLunches * (currentPeriod?.lunchPrice || 45000);

                            return (
                              <tr key={`lunch_${r.id}`} className="hover:bg-amber-50/30 transition-colors">
                                <td className="py-2.5 px-3 font-mono text-slate-500">{idx + 1}</td>
                                <td className="py-2.5 px-3">
                                  <span className="font-black text-slate-900 block">{r.studentName}</span>
                                  {r.nationalId && <span className="text-[10px] font-mono text-slate-400">{r.nationalId}</span>}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-md text-[10px] font-bold border",
                                    r.personRoleTitle === 'استاد' ? "bg-amber-50 text-amber-800 border-amber-200" :
                                    r.personRoleTitle === 'کارمند / کادر' ? "bg-blue-50 text-blue-800 border-blue-200" :
                                    "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  )}>
                                    {r.personRoleTitle || 'طلبه'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 font-bold">{r.grade || '-'}</td>
                                <td className="py-2.5 px-3 text-slate-600 max-w-[180px] truncate text-[11px]" title={r.selectedLunchDays?.join('، ')}>
                                  {r.selectedLunchDays?.length ? r.selectedLunchDays.join('، ') : <span className="text-slate-300">بدون نهار</span>}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-black text-amber-700 bg-amber-50/40">
                                  {rangeLunches}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                                  {lunchCost.toLocaleString('fa-IR')}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => setSelectedStudentForCalendar(r)}
                                      className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg"
                                      title="مشاهده تقویم نهار"
                                    >
                                      <Calendar size={13} />
                                    </button>
                                    <button
                                      onClick={() => handleEditReservation(r)}
                                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                                      title="ویرایش رزرو"
                                    >
                                      <Edit3 size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-amber-900 text-white font-black text-xs">
                          <td colSpan={5} className="py-2.5 px-3 text-right">جمع کل نهار دوره:</td>
                          <td className="py-2.5 px-3 text-center font-mono text-amber-300 text-sm">
                            {filteredReservations.reduce((acc, r) => acc + (r.calculatedLunchesForRange ?? (r.totalCalculatedLunches || 0)), 0).toLocaleString('fa-IR')}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-amber-200">
                            {(filteredReservations.reduce((acc, r) => acc + (r.calculatedLunchesForRange ?? (r.totalCalculatedLunches || 0)), 0) * (currentPeriod?.lunchPrice || 45000)).toLocaleString('fa-IR')} تومان
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* TABLE 2: DINNER STATISTICS */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-indigo-50/80 px-4 py-2.5 rounded-2xl border border-indigo-200">
                    <div className="flex items-center gap-2">
                      <Moon size={18} className="text-indigo-600" />
                      <h4 className="text-xs font-black text-indigo-950">جدول شماره ۲: آمار و اطلاعات تفصیلی شام</h4>
                    </div>
                    <span className="text-[11px] font-bold text-indigo-800 bg-indigo-100/80 px-2.5 py-0.5 rounded-lg border border-indigo-300">
                      مجموع شام دوره: {filteredReservations.reduce((acc, r) => acc + (r.calculatedDinnersForRange ?? (r.totalCalculatedDinners || 0)), 0).toLocaleString('fa-IR')} وعده
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-indigo-200/80 rounded-2xl bg-white shadow-xs">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-indigo-100/50 text-indigo-950 border-b border-indigo-200 font-black">
                          <th className="py-3 px-3">ردیف</th>
                          <th className="py-3 px-3">نام و نام خانوادگی</th>
                          <th className="py-3 px-3">عنوان / سمت</th>
                          <th className="py-3 px-3">محل دریافت شام</th>
                          <th className="py-3 px-3">روزهای رزرو شام</th>
                          <th className="py-3 px-3 text-center">شام موسسه</th>
                          <th className="py-3 px-3 text-center">شام خوابگاه</th>
                          <th className="py-3 px-3 text-center">مجموع شام</th>
                          <th className="py-3 px-3 text-center">مبلغ کسر شام (تومان)</th>
                          <th className="py-3 px-3 text-center">عملیات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredReservations.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="py-6 text-center text-slate-400 font-bold">
                              هیچ داده‌ای برای نمایش اطلاعات شام وجود ندارد.
                            </td>
                          </tr>
                        ) : (
                          filteredReservations.map((r, idx) => {
                            const rangeDinners = r.calculatedDinnersForRange ?? (r.totalCalculatedDinners || 0);
                            const instDinners = r.dinnerLocation === 'institute' ? rangeDinners : 0;
                            const dormDinners = r.dinnerLocation === 'dormitory' ? rangeDinners : 0;
                            const dinnerCost = rangeDinners * (currentPeriod?.dinnerPrice || 35000);

                            return (
                              <tr key={`dinner_${r.id}`} className="hover:bg-indigo-50/30 transition-colors">
                                <td className="py-2.5 px-3 font-mono text-slate-500">{idx + 1}</td>
                                <td className="py-2.5 px-3">
                                  <span className="font-black text-slate-900 block">{r.studentName}</span>
                                  {r.nationalId && <span className="text-[10px] font-mono text-slate-400">{r.nationalId}</span>}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-md text-[10px] font-bold border",
                                    r.personRoleTitle === 'استاد' ? "bg-amber-50 text-amber-800 border-amber-200" :
                                    "bg-indigo-50 text-indigo-800 border-indigo-200"
                                  )}>
                                    {r.personRoleTitle || 'طلبه'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 w-fit",
                                    r.dinnerLocation === 'dormitory'
                                      ? "bg-purple-50 text-purple-800 border border-purple-200"
                                      : "bg-indigo-50 text-indigo-800 border border-indigo-200"
                                  )}>
                                    {r.dinnerLocation === 'dormitory' ? <Bed size={11} /> : <Building2 size={11} />}
                                    <span>{r.dinnerLocation === 'dormitory' ? 'خوابگاه' : 'موسسه'}</span>
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 max-w-[180px] truncate text-[11px]" title={r.selectedDinnerDays?.join('، ')}>
                                  {r.selectedDinnerDays?.length ? r.selectedDinnerDays.join('، ') : <span className="text-slate-300">بدون شام</span>}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-700">
                                  {instDinners}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-bold text-purple-700">
                                  {dormDinners}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-black text-indigo-950 bg-indigo-50/50">
                                  {rangeDinners}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                                  {dinnerCost.toLocaleString('fa-IR')}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => setSelectedStudentForCalendar(r)}
                                      className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-lg"
                                      title="مشاهده تقویم شام"
                                    >
                                      <Calendar size={13} />
                                    </button>
                                    <button
                                      onClick={() => handleEditReservation(r)}
                                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                                      title="ویرایش رزرو"
                                    >
                                      <Edit3 size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-indigo-950 text-white font-black text-xs">
                          <td colSpan={5} className="py-2.5 px-3 text-right">جمع کل شام دوره:</td>
                          <td className="py-2.5 px-3 text-center font-mono text-indigo-300">
                            {filteredReservations.reduce((acc, r) => acc + (r.dinnerLocation === 'institute' ? (r.calculatedDinnersForRange ?? (r.totalCalculatedDinners || 0)) : 0), 0).toLocaleString('fa-IR')}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-purple-300">
                            {filteredReservations.reduce((acc, r) => acc + (r.dinnerLocation === 'dormitory' ? (r.calculatedDinnersForRange ?? (r.totalCalculatedDinners || 0)) : 0), 0).toLocaleString('fa-IR')}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-amber-300 text-sm">
                            {filteredReservations.reduce((acc, r) => acc + (r.calculatedDinnersForRange ?? (r.totalCalculatedDinners || 0)), 0).toLocaleString('fa-IR')}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-indigo-200">
                            {(filteredReservations.reduce((acc, r) => acc + (r.calculatedDinnersForRange ?? (r.totalCalculatedDinners || 0)), 0) * (currentPeriod?.dinnerPrice || 35000)).toLocaleString('fa-IR')} تومان
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* METHOD 2: نمایش به صورت اجمالی / روزانه (خلاصه تاریخ‌ها بدون نام افراد) */}
          {/* ========================================================================= */}
          {statsViewMode === 'daily_summary' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    روش دوم: آمار اجمالی روزانه (فقط تاریخ‌ها و تعداد نهار و شام بدون نام افراد)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    مشاهده آمار روزانه به تفکیک روز هفته، تعداد نهار، شام موسسه و خوابگاه با خروجی اکسل
                  </p>
                </div>

                <button
                  onClick={exportDailySummaryToExcel}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet size={14} />
                  <span>خروجی اکسل آمار اجمالی</span>
                </button>
              </div>

              {/* Daily Summary Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                      <th className="py-3 px-3 text-center">ردیف</th>
                      <th className="py-3 px-3">تاریخ شمسی</th>
                      <th className="py-3 px-3">روز هفته</th>
                      <th className="py-3 px-3">وضعیت آشپزخانه</th>
                      <th className="py-3 px-3 text-center font-bold text-amber-900">تعداد نهار</th>
                      <th className="py-3 px-3 text-center font-bold text-indigo-900">شام موسسه</th>
                      <th className="py-3 px-3 text-center font-bold text-purple-900">شام خوابگاه</th>
                      <th className="py-3 px-3 text-center font-bold text-indigo-950">مجموع شام</th>
                      <th className="py-3 px-3 text-center font-black text-slate-900">جمع کل وعده‌های روز</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dailySummaryList.map((d) => (
                      <tr 
                        key={d.date} 
                        className={cn(
                          "transition-colors",
                          d.isHoliday ? "bg-rose-50/40 text-rose-900" : "hover:bg-slate-50/70"
                        )}
                      >
                        <td className="py-2.5 px-3 text-center font-mono text-slate-500">{d.rowNumber}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{d.date}</td>
                        <td className="py-2.5 px-3 font-black text-slate-900">{d.dayOfWeek}</td>
                        <td className="py-2.5 px-3">
                          {d.isHoliday ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              تعطیل ({d.holidayReason || 'لغو پخت'})
                            </span>
                          ) : (
                            <span className="text-[11px] text-emerald-700 font-bold">دایر و فعال</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-700">
                          {d.lunchCount}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-700">
                          {d.dinnerInstituteCount}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-purple-700">
                          {d.dinnerDormitoryCount}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-900 bg-indigo-50/30">
                          {d.totalDinnerDay}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-black text-slate-900 bg-slate-50">
                          {d.totalMealsDay}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Table Footer with Totals */}
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-700">
                      <td colSpan={4} className="py-3 px-3 text-right">
                        <span>جمع کل دوره ({currentPeriod?.title}):</span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-amber-400">
                        {periodKPIs.totalLunches.toLocaleString('fa-IR')}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-indigo-300">
                        {periodKPIs.totalDinnersInstitute.toLocaleString('fa-IR')}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-purple-300">
                        {periodKPIs.totalDinnersDormitory.toLocaleString('fa-IR')}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-indigo-200">
                        {periodKPIs.totalDinners.toLocaleString('fa-IR')}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-amber-300 text-sm">
                        {periodKPIs.totalAllMeals.toLocaleString('fa-IR')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: Create / Edit Period Modal */}
      {/* ========================================================================= */}
      {isPeriodModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Calendar size={18} className="text-indigo-600" />
                <span>{editingPeriod ? 'ویرایش دوره رزرو نهار و شام' : 'ایجاد دوره رزرو نهار و شام جدید'}</span>
              </h3>
              <button onClick={() => setIsPeriodModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">عنوان دوره:</label>
                <input
                  type="text"
                  value={periodFormTitle}
                  onChange={(e) => setPeriodFormTitle(e.target.value)}
                  placeholder="مثلاً: رزرو نهار و شام مهر ۱۴۰۳"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:border-indigo-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">تاریخ شروع دوره (شمسی):</label>
                  <input
                    type="text"
                    value={periodFormStartDate}
                    onChange={(e) => setPeriodFormStartDate(e.target.value)}
                    placeholder="۱۴۰۳/۰۷/۰۱"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">تاریخ پایان دوره (شمسی):</label>
                  <input
                    type="text"
                    value={periodFormEndDate}
                    onChange={(e) => setPeriodFormEndDate(e.target.value)}
                    placeholder="۱۴۰۳/۰۷/۳۰"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  مهلت ثبت‌نام طلاب (زمان بسته شدن خودکار):
                </label>
                <input
                  type="text"
                  value={periodFormDeadline}
                  onChange={(e) => setPeriodFormDeadline(e.target.value)}
                  placeholder="۱۴۰۳/۰۷/۰۵"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none font-mono font-bold"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  پس از این تاریخ، طلاب دیگر قادر به ثبت یا تغییر رزرو نخواهند بود.
                </p>
              </div>

              {/* Enable Lunch / Dinner / Location */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <span className="font-bold text-slate-800 block">وعده‌های فعال در این دوره:</span>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-bold">
                    <input
                      type="checkbox"
                      checked={periodFormEnableLunch}
                      onChange={(e) => setPeriodFormEnableLunch(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <span>امکان رزرو نهار</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-bold">
                    <input
                      type="checkbox"
                      checked={periodFormEnableDinner}
                      onChange={(e) => setPeriodFormEnableDinner(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <span>امکان رزرو شام</span>
                  </label>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-bold">
                    <input
                      type="checkbox"
                      checked={periodFormAllowDinnerLocation}
                      onChange={(e) => setPeriodFormAllowDinnerLocation(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <span>فعال‌سازی انتخاب محل دریافت شام توسط طلاب (موسسه / خوابگاه)</span>
                  </label>
                </div>
              </div>

              {/* Price Setup */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">نرخ هر وعده نهار (تومان):</label>
                  <input
                    type="number"
                    value={periodFormLunchPrice}
                    onChange={(e) => setPeriodFormLunchPrice(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">نرخ هر وعده شام (تومان):</label>
                  <input
                    type="number"
                    value={periodFormDinnerPrice}
                    onChange={(e) => setPeriodFormDinnerPrice(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsPeriodModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
              >
                انصراف
              </button>
              <button
                onClick={handleSavePeriod}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm"
              >
                ذخیره دوره
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Person Categories Management Modal */}
      {/* ========================================================================= */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Tag size={18} className="text-indigo-600" />
                <span>مدیریت عناوین افراد (طلبه، اساتید، کارمندان، مهمانان و...)</span>
              </h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-slate-500 text-[11px]">
                لیست عناوین جهت تفکیک طلاب، اساتید، کادر اجرایی، خادمین و مهمانان در گزارش‌ها و رزروها:
              </p>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="عنوان جدید (مثلاً: راننده سرویس، بازرس، مهمان ویژه...)"
                  value={newCategoryTitle}
                  onChange={(e) => setNewCategoryTitle(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none font-bold"
                />
                <button
                  onClick={handleAddCategory}
                  className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shrink-0"
                >
                  افزودن
                </button>
              </div>

              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {personCategories.map(cat => (
                  <div key={cat.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="font-black text-slate-800">{cat.title}</span>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg"
                      title="حذف عنوان"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-black"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: Kitchen Holiday Modal */}
      {/* ========================================================================= */}
      {isHolidayModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <CalendarOff size={18} className="text-rose-600" />
                <span>ثبت تعطیلی آشپزخانه و لغو پخت نهار یا شام</span>
              </h3>
              <button onClick={() => setIsHolidayModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Interactive Shamsi Calendar Picker for Kitchen Holiday */}
              <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <Calendar size={15} className="text-rose-600" />
                    <span>انتخاب روز تعطیلی روی تقویم شمسی:</span>
                  </label>
                  <span className="font-mono font-black text-rose-700 bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200 text-xs">
                    {holidayDate || 'تاریخی انتخاب نشده'}
                  </span>
                </div>

                {/* Calendar Month Navigation */}
                <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      if (holidayCalMonth === 1) {
                        setHolidayCalMonth(12);
                        setHolidayCalYear(y => y - 1);
                      } else {
                        setHolidayCalMonth(m => m - 1);
                      }
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                  >
                    ماه قبل
                  </button>

                  <div className="flex items-center gap-2">
                    <select
                      value={holidayCalMonth}
                      onChange={(e) => setHolidayCalMonth(Number(e.target.value))}
                      className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-lg px-2 py-1 outline-none"
                    >
                      {SHAMSI_MONTH_NAMES.map((mName, idx) => (
                        <option key={mName} value={idx + 1}>{mName}</option>
                      ))}
                    </select>

                    <select
                      value={holidayCalYear}
                      onChange={(e) => setHolidayCalYear(Number(e.target.value))}
                      className="bg-slate-50 border border-slate-200 text-xs font-mono font-bold rounded-lg px-2 py-1 outline-none"
                    >
                      {[1402, 1403, 1404, 1405, 1406].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (holidayCalMonth === 12) {
                        setHolidayCalMonth(1);
                        setHolidayCalYear(y => y + 1);
                      } else {
                        setHolidayCalMonth(m => m + 1);
                      }
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                  >
                    ماه بعد
                  </button>
                </div>

                {/* Weekday Headers */}
                <div className="grid grid-cols-7 text-center text-[10px] font-black text-slate-500 pb-1">
                  {SHAMSI_WEEKDAY_NAMES_SHORT.map((wd) => (
                    <div key={wd}>{wd}</div>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {(() => {
                    const totalDays = getDaysInShamsiMonth(holidayCalYear, holidayCalMonth);
                    const firstDayOfWeek = getShamsiDayOfWeek(formatShamsiDate(holidayCalYear, holidayCalMonth, 1));
                    const emptySlots = Array.from({ length: firstDayOfWeek });
                    const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);

                    return (
                      <>
                        {emptySlots.map((_, idx) => (
                          <div key={`empty_${idx}`} className="h-8"></div>
                        ))}
                        {daysArray.map((dNum) => {
                          const dateStr = formatShamsiDate(holidayCalYear, holidayCalMonth, dNum);
                          const isSelected = holidayDate === dateStr;
                          const isFriday = (firstDayOfWeek + dNum - 1) % 7 === 6;

                          return (
                            <button
                              key={`day_${dNum}`}
                              type="button"
                              onClick={() => setHolidayDate(dateStr)}
                              className={cn(
                                "h-8 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center border cursor-pointer",
                                isSelected
                                  ? "bg-rose-600 text-white border-rose-600 shadow-md scale-105"
                                  : isFriday
                                    ? "bg-rose-50/60 text-rose-700 border-rose-200 hover:bg-rose-100"
                                    : "bg-white text-slate-800 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300"
                              )}
                            >
                              {dNum}
                            </button>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">وعده لغو شده:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setHolidayMealType('lunch')}
                    className={cn(
                      "p-2 rounded-xl font-bold border",
                      holidayMealType === 'lunch' ? "bg-amber-500 text-white border-amber-600" : "bg-white text-slate-700 border-slate-200"
                    )}
                  >
                    فقط نهار
                  </button>
                  <button
                    type="button"
                    onClick={() => setHolidayMealType('dinner')}
                    className={cn(
                      "p-2 rounded-xl font-bold border",
                      holidayMealType === 'dinner' ? "bg-indigo-600 text-white border-indigo-700" : "bg-white text-slate-700 border-slate-200"
                    )}
                  >
                    فقط شام
                  </button>
                  <button
                    type="button"
                    onClick={() => setHolidayMealType('both')}
                    className={cn(
                      "p-2 rounded-xl font-bold border",
                      holidayMealType === 'both' ? "bg-rose-600 text-white border-rose-700" : "bg-white text-slate-700 border-slate-200"
                    )}
                  >
                    هر دو وعده
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">علت لغو:</label>
                <input
                  type="text"
                  value={holidayReason}
                  onChange={(e) => setHolidayReason(e.target.value)}
                  placeholder="مثلاً: اردوی عمومی، تعطیلی رسمی، تعمیرات آشپزخانه..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none font-bold"
                />
              </div>

              {/* List of existing holidays */}
              {kitchenHolidays.length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-1.5 max-h-40 overflow-y-auto">
                  <span className="font-bold text-slate-600 block">روزهای تعطیل ثبت شده:</span>
                  {kitchenHolidays.map(h => (
                    <div key={h.id} className="p-2 bg-rose-50/60 rounded-xl border border-rose-100 flex items-center justify-between text-[11px]">
                      <div>
                        <span className="font-mono font-bold text-rose-900">{h.date}</span>
                        <span className="mr-2 text-rose-700">({h.mealType === 'both' ? 'هر دو وعده' : h.mealType === 'lunch' ? 'نهار' : 'شام'})</span>
                        <span className="mr-2 text-slate-500">- {h.reason}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteHoliday(h.id)}
                        className="text-rose-700 hover:text-rose-900 p-1"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsHolidayModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
              >
                بستن
              </button>
              <button
                onClick={handleSaveHoliday}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-sm"
              >
                ثبت تعطیلی
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: Manual Reservation for a Person Modal */}
      {/* ========================================================================= */}
      {isManualReservationModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <UtensilsCrossed size={18} className="text-indigo-600" />
                <span>{editingReservation ? 'ویرایش رزرو غذا' : 'ثبت دستی رزرو نهار و شام بر اساس عنوان و نقش'}</span>
              </h3>
              <button onClick={() => setIsManualReservationModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Role Selector Grid */}
              <div>
                <label className="font-bold text-slate-800 block mb-1.5">۱. انتخاب عنوان / نقش فرد متقاضی:</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-1 bg-slate-100 rounded-2xl">
                  {[
                    { id: 'student', label: 'طلبه', icon: '🎓' },
                    { id: 'teacher', label: 'استاد', icon: '👨‍🏫' },
                    { id: 'grade_professor', label: 'استاد پایه', icon: '📖' },
                    { id: 'driver', label: 'راننده', icon: '🚗' },
                    { id: 'staff', label: 'کارکنان', icon: '💼' },
                    { id: 'guest', label: 'مهمان', icon: '👤' },
                  ].map(role => (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => {
                        setManualRoleType(role.id as any);
                        setManualSearchQuery('');
                        setManualSelectedEntityId('');
                      }}
                      className={cn(
                        "py-2 px-1 rounded-xl font-bold transition-all text-center flex flex-col items-center justify-center gap-1 text-[11px]",
                        manualRoleType === role.id ? "bg-white text-indigo-800 shadow-xs ring-1 ring-indigo-200 font-black" : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      <span className="text-sm">{role.icon}</span>
                      <span>{role.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Search & Selection Area based on Role */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                {manualRoleType === 'student' && (
                  <div>
                    <label className="font-bold text-slate-800 block mb-1">جستجو و انتخاب طلبه:</label>
                    <input
                      type="text"
                      value={manualSearchQuery}
                      onChange={(e) => setManualSearchQuery(e.target.value)}
                      placeholder="جستجوی نام یا شماره ملی طلبه..."
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 outline-none mb-2 font-medium"
                    />
                    <select
                      value={manualSelectedEntityId}
                      onChange={(e) => setManualSelectedEntityId(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none font-bold text-slate-800"
                    >
                      <option value="">-- انتخاب طلبه از بانک اطلاعات طلاب --</option>
                      {students
                        .filter(s => s.name.includes(manualSearchQuery) || (s.nationalId && s.nationalId.includes(manualSearchQuery)))
                        .map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.grade || 'نامشخص'}) {s.livingStatus === 'خوابگاه' ? '[خوابگاهی]' : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {manualRoleType === 'teacher' && (
                  <div>
                    <label className="font-bold text-slate-800 block mb-1">جستجو و انتخاب استاد از بانک اساتید:</label>
                    <input
                      type="text"
                      value={manualSearchQuery}
                      onChange={(e) => setManualSearchQuery(e.target.value)}
                      placeholder="جستجوی نام استاد یا تخصص..."
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 outline-none mb-2 font-medium"
                    />
                    <select
                      value={manualSelectedEntityId}
                      onChange={(e) => setManualSelectedEntityId(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none font-bold text-slate-800"
                    >
                      <option value="">-- انتخاب استاد از بانک اساتید --</option>
                      {teachersList
                        .filter(t => t.fullName.includes(manualSearchQuery) || (t.subjectSpecialty && t.subjectSpecialty.includes(manualSearchQuery)))
                        .map(t => (
                          <option key={t.id} value={t.id}>
                            {t.fullName} {t.subjectSpecialty ? `(${t.subjectSpecialty})` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {manualRoleType === 'grade_professor' && (
                  <div>
                    <label className="font-bold text-slate-800 block mb-1">جستجو و انتخاب استاد پایه (تعیین‌شده توسط سوپرادمین):</label>
                    <input
                      type="text"
                      value={manualSearchQuery}
                      onChange={(e) => setManualSearchQuery(e.target.value)}
                      placeholder="جستجوی نام مسئول/استاد پایه..."
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 outline-none mb-2 font-medium"
                    />
                    <select
                      value={manualSelectedEntityId}
                      onChange={(e) => setManualSelectedEntityId(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none font-bold text-slate-800"
                    >
                      <option value="">-- انتخاب استاد پایه --</option>
                      {gradeProfessorsList
                        .filter(gp => gp.fullName.includes(manualSearchQuery) || gp.grade.includes(manualSearchQuery))
                        .map(gp => (
                          <option key={gp.id} value={gp.id}>
                            {gp.fullName} ({gp.grade})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {manualRoleType === 'driver' && (
                  <div>
                    <label className="font-bold text-slate-800 block mb-1">جستجو و انتخاب راننده از بانک رانندگان:</label>
                    <input
                      type="text"
                      value={manualSearchQuery}
                      onChange={(e) => setManualSearchQuery(e.target.value)}
                      placeholder="جستجوی نام یا تلفن راننده..."
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 outline-none mb-2 font-medium"
                    />
                    <select
                      value={manualSelectedEntityId}
                      onChange={(e) => setManualSelectedEntityId(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none font-bold text-slate-800"
                    >
                      <option value="">-- انتخاب راننده --</option>
                      {driversList
                        .filter(d => (d.fullName || d.name || '').includes(manualSearchQuery) || (d.phoneNumber || d.phone || '').includes(manualSearchQuery))
                        .map(d => (
                          <option key={d.id} value={d.id}>
                            {d.fullName || d.name} {d.carModel ? `(${d.carModel})` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {manualRoleType === 'staff' && (
                  <div>
                    <label className="font-bold text-slate-800 block mb-1">جستجو و انتخاب از بانک کارکنان مجموعه:</label>
                    <input
                      type="text"
                      value={manualSearchQuery}
                      onChange={(e) => setManualSearchQuery(e.target.value)}
                      placeholder="جستجوی نام، سمت، کد پرسنلی..."
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 outline-none mb-2 font-medium"
                    />
                    <select
                      value={manualSelectedEntityId}
                      onChange={(e) => setManualSelectedEntityId(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none font-bold text-slate-800"
                    >
                      <option value="">-- انتخاب از لیست کارکنان --</option>
                      {staffList
                        .filter(s => s.fullName.includes(manualSearchQuery) || s.roleTitle.includes(manualSearchQuery) || (s.staffCode && s.staffCode.includes(manualSearchQuery)))
                        .map(s => (
                          <option key={s.id} value={s.id}>
                            {s.fullName} - {s.roleTitle} {s.staffCode ? `[${s.staffCode}]` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {manualRoleType === 'guest' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">نام و نام خانوادگی مهمان (*):</label>
                      <input
                        type="text"
                        value={manualCustomName}
                        onChange={(e) => setManualCustomName(e.target.value)}
                        placeholder="نام کامل فرد مهمان"
                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">سازمان / علت حضور:</label>
                      <input
                        type="text"
                        value={manualGrade}
                        onChange={(e) => setManualGrade(e.target.value)}
                        placeholder="مثلاً: سخنران، بازرس حوزه، استاد مدعو"
                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 outline-none font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Lunch Day Selector */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">روزهای هفتگی نهار:</label>
                <div className="grid grid-cols-3 sm:grid-cols-7 gap-1.5">
                  {WEEK_DAYS.map(day => {
                    const isSelected = manualLunchDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          setManualLunchDays(prev => 
                            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                          );
                        }}
                        className={cn(
                          "p-2 rounded-xl font-bold border transition-all text-xs text-center",
                          isSelected ? "bg-amber-500 text-white border-amber-600 shadow-2xs" : "bg-white text-slate-700 border-slate-200"
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dinner Day Selector */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">روزهای هفتگی شام:</label>
                <div className="grid grid-cols-3 sm:grid-cols-7 gap-1.5">
                  {WEEK_DAYS.map(day => {
                    const isSelected = manualDinnerDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          setManualDinnerDays(prev => 
                            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                          );
                        }}
                        className={cn(
                          "p-2 rounded-xl font-bold border transition-all text-xs text-center",
                          isSelected ? "bg-indigo-600 text-white border-indigo-700 shadow-2xs" : "bg-white text-slate-700 border-slate-200"
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dinner Location */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">محل دریافت شام:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setManualDinnerLocation('institute')}
                    className={cn(
                      "p-2.5 rounded-xl font-bold border flex items-center justify-center gap-1.5",
                      manualDinnerLocation === 'institute' ? "bg-indigo-600 text-white border-indigo-700" : "bg-white text-slate-700 border-slate-200"
                    )}
                  >
                    <Building2 size={14} />
                    <span>موسسه</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setManualDinnerLocation('dormitory')}
                    className={cn(
                      "p-2.5 rounded-xl font-bold border flex items-center justify-center gap-1.5",
                      manualDinnerLocation === 'dormitory' ? "bg-purple-600 text-white border-purple-700" : "bg-white text-slate-700 border-slate-200"
                    )}
                  >
                    <Bed size={14} />
                    <span>خوابگاه</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsManualReservationModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
              >
                انصراف
              </button>
              <button
                onClick={handleSaveManualReservation}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm"
              >
                ذخیره رزرو
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: Student Calendar Preview Modal */}
      {/* ========================================================================= */}
      {selectedStudentForCalendar && currentPeriod && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  تقویم تفصیلی روزهای رزرو شده: {selectedStudentForCalendar.studentName}
                </h3>
                <span className="text-[11px] text-slate-500">
                  دوره: {currentPeriod.title} ({currentPeriod.startDate} الی {currentPeriod.endDate})
                </span>
              </div>
              <button onClick={() => setSelectedStudentForCalendar(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[60vh] overflow-y-auto p-1">
              {generateShamsiDateRange(currentPeriod.startDate, currentPeriod.endDate).map(date => {
                const dayOfWeek = getShamsiDayOfWeekName(date);
                const holiday = kitchenHolidays.find(h => h.date === date);
                const isLunchCancelled = holiday?.mealType === 'lunch' || holiday?.mealType === 'both';
                const isDinnerCancelled = holiday?.mealType === 'dinner' || holiday?.mealType === 'both';

                const hasLunch = selectedStudentForCalendar.selectedLunchDays?.includes(dayOfWeek) && !isLunchCancelled;
                const hasDinner = selectedStudentForCalendar.selectedDinnerDays?.includes(dayOfWeek) && !isDinnerCancelled;

                return (
                  <div key={date} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-black text-slate-800">{dayOfWeek}</span>
                      <span className="font-mono text-[9px] text-slate-400">{date.slice(5)}</span>
                    </div>

                    <div className="space-y-1 text-[10px]">
                      {hasLunch && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded font-bold block text-center">
                          ☀️ نهار
                        </span>
                      )}
                      {hasDinner && (
                        <span className={cn(
                          "px-1.5 py-0.5 rounded font-bold block text-center",
                          selectedStudentForCalendar.dinnerLocation === 'dormitory'
                            ? "bg-purple-100 text-purple-900"
                            : "bg-indigo-100 text-indigo-900"
                        )}>
                          🌙 شام ({selectedStudentForCalendar.dinnerLocation === 'dormitory' ? 'خوابگاه' : 'موسسه'})
                        </span>
                      )}
                      {!hasLunch && !hasDinner && (
                        <span className="text-slate-300 block text-center">-</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedStudentForCalendar(null)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-black"
              >
                بستن تقویم
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
