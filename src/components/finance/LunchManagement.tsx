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
  SlidersHorizontal, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Edit3, 
  Trash2,
  Printer, 
  ChefHat,
  ShoppingBag,
  TrendingUp,
  Receipt,
  Sun,
  Moon,
  Ban,
  CalendarOff,
  Filter,
  UserCheck,
  UserPlus,
  RefreshCw,
  Sparkles,
  Layers,
  ArrowUpDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { getTodayShamsi } from '../../lib/jalali';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Student, 
  MealReservationPeriod, 
  StudentMealReservation, 
  MealCancelledDay 
} from '../../types';

interface KitchenDailyInvoice {
  id: string;
  date: string;
  dayOfWeek: string;
  lunchPortions: number;
  dinnerPortions: number;
  lunchUnitPrice: number;
  dinnerUnitPrice: number;
  totalCost: number;
  supplierName: string;
  isSettled: boolean;
  notes?: string;
}

interface LunchManagementProps {
  onNavigateTab?: (tab: string, params?: any) => void;
}

const WEEK_DAYS = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'] as const;

export default function LunchManagement({ onNavigateTab }: LunchManagementProps) {
  const { currentUser, isReadOnly } = useAuth();
  const isStudentLevel3 = currentUser?.level === 3;

  // Active Sub-tab for managers
  const [activeSubTab, setActiveSubTab] = useState<'reservations_list' | 'stats_reports' | 'period_settings' | 'kitchen_holidays' | 'kitchen_invoices'>(
    isStudentLevel3 ? 'reservations_list' : 'reservations_list'
  );

  const [periods, setPeriods] = useState<MealReservationPeriod[]>([]);
  const [activePeriodId, setActivePeriodId] = useState<string>('');
  const [reservations, setReservations] = useState<StudentMealReservation[]>([]);
  const [kitchenHolidays, setKitchenHolidays] = useState<MealCancelledDay[]>([]);
  const [kitchenInvoices, setKitchenInvoices] = useState<KitchenDailyInvoice[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('all');
  const [selectedDormFilter, setSelectedDormFilter] = useState<'all' | 'dorm' | 'non_dorm'>('all');

  // Modals
  const [isNewPeriodModalOpen, setIsNewPeriodModalOpen] = useState(false);
  const [isAddReservationModalOpen, setIsAddReservationModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<StudentMealReservation | null>(null);
  const [isAddHolidayModalOpen, setIsAddHolidayModalOpen] = useState(false);
  const [isAddInvoiceModalOpen, setIsAddInvoiceModalOpen] = useState(false);

  // Student Reservation Form in Portal (For Level 3 or Manager editing for student)
  const [mySelectedLunchDays, setMySelectedLunchDays] = useState<string[]>(['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه']);
  const [mySelectedDinnerDays, setMySelectedDinnerDays] = useState<string[]>(['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه']);
  const [myReservationNotes, setMyReservationNotes] = useState('');

  // Period Form
  const [periodTitle, setPeriodTitle] = useState('رزرو نهار و شام مهر ۱۴۰۳');
  const [periodStartDate, setPeriodStartDate] = useState('۱۴۰۳/۰۷/۰۱');
  const [periodEndDate, setPeriodEndDate] = useState('۱۴۰۳/۰۷/۳۰');
  const [periodLunchPrice, setPeriodLunchPrice] = useState<number>(45000);
  const [periodDinnerPrice, setPeriodDinnerPrice] = useState<number>(35000);
  const [periodLunchDisabledDays, setPeriodLunchDisabledDays] = useState<string[]>(['جمعه']); // Friday always disabled for lunch
  const [periodDinnerDisabledDays, setPeriodDinnerDisabledDays] = useState<string[]>(['جمعه']);

  // Manual Add Reservation Form
  const [manualStudentMode, setManualStudentMode] = useState<'from_list' | 'custom_name'>('from_list');
  const [manualSelectedStudentId, setManualSelectedStudentId] = useState('');
  const [manualStudentName, setManualStudentName] = useState('');
  const [manualNationalId, setManualNationalId] = useState('');
  const [manualGrade, setManualGrade] = useState('پایه ۷');
  const [manualIsDorm, setManualIsDorm] = useState(false);
  const [manualLunchDays, setManualLunchDays] = useState<string[]>(['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه']);
  const [manualDinnerDays, setManualDinnerDays] = useState<string[]>(['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه']);
  const [manualNotes, setManualNotes] = useState('');

  // Holiday / Kitchen Cancellation Form
  const [holidayDate, setHolidayDate] = useState(getTodayShamsi());
  const [holidayMealType, setHolidayMealType] = useState<'lunch' | 'dinner' | 'both'>('lunch');
  const [holidayReason, setHolidayReason] = useState('تعطیلی آشپزخانه و عدم پخت غذا');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Active Period Object
  const currentPeriod = useMemo(() => {
    return periods.find(p => p.id === activePeriodId) || periods[0] || null;
  }, [periods, activePeriodId]);

  // Load All Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [storedPeriods, storedRes, storedHolidays, storedInvoices, storedStudents] = await Promise.all([
        localDb.getDocs<MealReservationPeriod>('finance_meal_periods'),
        localDb.getDocs<StudentMealReservation>('finance_student_meal_reservations'),
        localDb.getDocs<MealCancelledDay>('finance_meal_holidays'),
        localDb.getDocs<KitchenDailyInvoice>('finance_kitchen_invoices'),
        localDb.getDocs<Student>('students')
      ]);

      setStudents(storedStudents || []);

      // Seed Initial Period if empty
      let currentPeriodsList = storedPeriods || [];
      if (!currentPeriodsList || currentPeriodsList.length === 0) {
        const defaultPeriod: MealReservationPeriod = {
          id: 'meal-period-1403-07',
          title: 'رزرو نهار و شام مهرماه ۱۴۰۳',
          startDate: '۱۴۰۳/۰۷/۰۱',
          endDate: '۱۴۰۳/۰۷/۳۰',
          lunchPrice: 45000,
          dinnerPrice: 35000,
          status: 'open',
          lunchDisabledDays: ['جمعه'], // Friday is strictly forbidden for lunch
          dinnerDisabledDays: [], // Dinner available all days or configured
          createdAt: new Date().toISOString()
        };
        await localDb.setDoc('finance_meal_periods', defaultPeriod);
        currentPeriodsList = [defaultPeriod];
      }
      setPeriods(currentPeriodsList);
      setActivePeriodId(currentPeriodsList[0].id);

      // Seed Initial Holidays if empty
      let currentHolidays = storedHolidays || [];
      if (!currentHolidays || currentHolidays.length === 0) {
        const defaultHolidays: MealCancelledDay[] = [
          {
            id: 'hol-1',
            date: '۱۴۰۳/۰۷/۱۴',
            mealType: 'lunch',
            reason: 'تعطیلی آشپزخانه به علت تعمیرات دیگ بخار',
            registeredAt: new Date().toISOString(),
            registeredByName: 'مسئول مالی'
          }
        ];
        for (const h of defaultHolidays) {
          await localDb.setDoc('finance_meal_holidays', h);
        }
        currentHolidays = defaultHolidays;
      }
      setKitchenHolidays(currentHolidays);

      // Seed Initial Reservations
      if (storedRes && storedRes.length > 0) {
        setReservations(storedRes);
      } else {
        const activeStuds = (storedStudents || []).filter(s => s.isActive);
        const initialReservations: StudentMealReservation[] = [];

        const studsToSeed = activeStuds.length > 0 ? activeStuds.slice(0, 12) : [
          { id: 'st-1', name: 'محمدحسین حسینی', nationalId: '1270001122', grade: 'پایه ۷', livingStatus: 'خوابگاه' },
          { id: 'st-2', name: 'علی‌رضا محمدی', nationalId: '1270003344', grade: 'پایه ۷', livingStatus: 'شخصی' },
          { id: 'st-3', name: 'مهدی کریمی', nationalId: '1270005566', grade: 'پایه ۸', livingStatus: 'خوابگاه' },
          { id: 'st-4', name: 'سید رضا موسوی', nationalId: '1270007788', grade: 'پایه ۸', livingStatus: 'خوابگاه' },
          { id: 'st-5', name: 'امیرحسین صادقی', nationalId: '1270009900', grade: 'پایه ۹', livingStatus: 'پدری' }
        ];

        studsToSeed.forEach((s, idx) => {
          const isDorm = s.livingStatus === 'خوابگاه';
          const lunchDays = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه'];
          const dinnerDays = isDorm ? ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه'] : (idx % 2 === 0 ? ['شنبه', 'دوشنبه'] : []);
          
          // 4 weeks approx per month => 20 lunch, 24 dinner minus 1 holiday lunch
          const totalLunches = Math.max(0, lunchDays.length * 4 - 1);
          const totalDinners = dinnerDays.length * 4;
          const lunchCost = totalLunches * 45000;
          const dinnerCost = totalDinners * 35000;
          const totalCost = lunchCost + dinnerCost;

          initialReservations.push({
            id: `res-${currentPeriodsList[0].id}-${s.id}`,
            periodId: currentPeriodsList[0].id,
            studentId: s.id,
            studentName: s.name,
            nationalId: s.nationalId,
            grade: s.grade,
            isDormitory: isDorm,
            selectedLunchDays: lunchDays,
            selectedDinnerDays: dinnerDays,
            totalCalculatedLunches: totalLunches,
            totalCalculatedDinners: totalDinners,
            totalLunchCost: lunchCost,
            totalDinnerCost: dinnerCost,
            totalMealCost: totalCost,
            finalDeductionAmount: totalCost,
            notes: isDorm ? 'ساکن خوابگاه - رزرو کامل' : 'ترددی',
            updatedAt: new Date().toISOString()
          });
        });

        for (const r of initialReservations) {
          await localDb.setDoc('finance_student_meal_reservations', r);
        }
        setReservations(initialReservations);
      }

      // Seed Initial Kitchen Invoices
      if (storedInvoices && storedInvoices.length > 0) {
        setKitchenInvoices(storedInvoices);
      } else {
        const initialInvoices: KitchenDailyInvoice[] = [
          {
            id: 'inv-1',
            date: '۱۴۰۳/۰۷/۰۱',
            dayOfWeek: 'شنبه',
            lunchPortions: 85,
            dinnerPortions: 48,
            lunchUnitPrice: 45000,
            dinnerUnitPrice: 35000,
            totalCost: (85 * 45000) + (48 * 35000),
            supplierName: 'کیترینگ و آشپزخانه کوثر',
            isSettled: true,
            notes: 'نهار: چلو جوجه کباب / شام: خوراک لوبیا با قارچ'
          },
          {
            id: 'inv-2',
            date: '۱۴۰۳/۰۷/۰۲',
            dayOfWeek: 'یک‌شنبه',
            lunchPortions: 88,
            dinnerPortions: 50,
            lunchUnitPrice: 45000,
            dinnerUnitPrice: 35000,
            totalCost: (88 * 45000) + (50 * 35000),
            supplierName: 'کیترینگ و آشپزخانه کوثر',
            isSettled: true,
            notes: 'نهار: زرشک پلو با مرغ / شام: کوکو سبزی با نان'
          }
        ];
        for (const inv of initialInvoices) {
          await localDb.setDoc('finance_kitchen_invoices', inv);
        }
        setKitchenInvoices(initialInvoices);
      }
    } catch (err) {
      console.error('Error loading lunch data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Reservations for the Active Period
  const activePeriodReservations = useMemo(() => {
    return reservations.filter(r => r.periodId === (currentPeriod?.id || activePeriodId));
  }, [reservations, currentPeriod, activePeriodId]);

  const filteredReservations = useMemo(() => {
    return activePeriodReservations.filter(r => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = r.studentName?.toLowerCase().includes(q);
        const matchNat = r.nationalId?.includes(q);
        if (!matchName && !matchNat) return false;
      }
      if (selectedGradeFilter !== 'all' && r.grade !== selectedGradeFilter) {
        return false;
      }
      if (selectedDormFilter === 'dorm' && !r.isDormitory) return false;
      if (selectedDormFilter === 'non_dorm' && r.isDormitory) return false;
      return true;
    });
  }, [activePeriodReservations, searchQuery, selectedGradeFilter, selectedDormFilter]);

  // Statistics
  const stats = useMemo(() => {
    let totalLunches = 0;
    let totalDinners = 0;
    let totalLunchCost = 0;
    let totalDinnerCost = 0;
    let dormCount = 0;

    activePeriodReservations.forEach(r => {
      totalLunches += r.totalCalculatedLunches || 0;
      totalDinners += r.totalCalculatedDinners || 0;
      totalLunchCost += r.totalLunchCost || 0;
      totalDinnerCost += r.totalDinnerCost || 0;
      if (r.isDormitory) dormCount++;
    });

    const totalMealCost = totalLunchCost + totalDinnerCost;

    return {
      totalStudents: activePeriodReservations.length,
      totalLunches,
      totalDinners,
      totalMeals: totalLunches + totalDinners,
      totalLunchCost,
      totalDinnerCost,
      totalMealCost,
      dormCount,
      nonDormCount: activePeriodReservations.length - dormCount
    };
  }, [activePeriodReservations]);

  // Check if student user has reservation in active period
  const myCurrentReservation = useMemo(() => {
    if (!currentUser) return null;
    const linkedId = currentUser.linkedStudentId;
    return activePeriodReservations.find(r => 
      (linkedId && r.studentId === linkedId) || 
      (r.studentName && r.studentName.includes(currentUser.name || currentUser.fullName))
    );
  }, [currentUser, activePeriodReservations]);

  useEffect(() => {
    if (myCurrentReservation) {
      setMySelectedLunchDays(myCurrentReservation.selectedLunchDays || []);
      setMySelectedDinnerDays(myCurrentReservation.selectedDinnerDays || []);
      setMyReservationNotes(myCurrentReservation.notes || '');
    }
  }, [myCurrentReservation]);

  // Helper to calculate total lunches and dinners given selected days, weeks in month and holidays
  const calculateMealsCounts = (
    lunchDays: string[], 
    dinnerDays: string[], 
    weeksCount = 4
  ) => {
    const rawLunches = lunchDays.length * weeksCount;
    const rawDinners = dinnerDays.length * weeksCount;

    // Subtract kitchen holidays for this period
    const lunchHolidaysCount = kitchenHolidays.filter(h => h.mealType === 'lunch' || h.mealType === 'both').length;
    const dinnerHolidaysCount = kitchenHolidays.filter(h => h.mealType === 'dinner' || h.mealType === 'both').length;

    const finalLunches = Math.max(0, rawLunches - lunchHolidaysCount);
    const finalDinners = Math.max(0, rawDinners - dinnerHolidaysCount);

    const lPrice = currentPeriod?.lunchPrice || 45000;
    const dPrice = currentPeriod?.dinnerPrice || 35000;

    const totalLCost = finalLunches * lPrice;
    const totalDCost = finalDinners * dPrice;

    return {
      totalCalculatedLunches: finalLunches,
      totalCalculatedDinners: finalDinners,
      totalLunchCost: totalLCost,
      totalDinnerCost: totalDCost,
      totalMealCost: totalLCost + totalDCost,
      finalDeductionAmount: totalLCost + totalDCost
    };
  };

  // Level 3 Student Submit or Update Meal Reservation
  const handleStudentSaveReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPeriod || currentPeriod.status !== 'open') {
      showToast('دوره رزرو غذا در حال حاضر بسته است.');
      return;
    }

    const calc = calculateMealsCounts(mySelectedLunchDays, mySelectedDinnerDays);
    const stId = currentUser?.linkedStudentId || `st-user-${currentUser?.id}`;
    const stName = currentUser?.fullName || currentUser?.name || 'طلبه';

    const newRes: StudentMealReservation = {
      id: myCurrentReservation?.id || `res-${currentPeriod.id}-${stId}`,
      periodId: currentPeriod.id,
      studentId: stId,
      studentName: stName,
      grade: currentUser?.gradeLabel || 'پایه نامشخص',
      isDormitory: myCurrentReservation?.isDormitory || false,
      selectedLunchDays: mySelectedLunchDays,
      selectedDinnerDays: mySelectedDinnerDays,
      ...calc,
      notes: myReservationNotes,
      updatedAt: new Date().toISOString()
    };

    await localDb.setDoc('finance_student_meal_reservations', newRes);
    setReservations(prev => {
      const idx = prev.findIndex(r => r.id === newRes.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newRes;
        return copy;
      }
      return [newRes, ...prev];
    });

    showToast('رزرو نهار و شام شما با موفقیت ثبت گردید.');
  };

  // Financial Manager: Create New Period
  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodTitle.trim()) {
      showToast('لطفاً عنوان دوره را وارد کنید.');
      return;
    }

    const newPer: MealReservationPeriod = {
      id: `meal-period-${Date.now()}`,
      title: periodTitle.trim(),
      startDate: periodStartDate,
      endDate: periodEndDate,
      lunchPrice: Number(periodLunchPrice),
      dinnerPrice: Number(periodDinnerPrice),
      status: 'open',
      lunchDisabledDays: periodLunchDisabledDays,
      dinnerDisabledDays: periodDinnerDisabledDays,
      createdAt: new Date().toISOString(),
      createdByName: currentUser?.name || 'مسئول مالی'
    };

    await localDb.setDoc('finance_meal_periods', newPer);
    setPeriods(prev => [newPer, ...prev]);
    setActivePeriodId(newPer.id);
    setIsNewPeriodModalOpen(false);
    showToast(`دوره جدید "${newPer.title}" بازگشایی شد.`);
  };

  // Financial Manager: Toggle Period Status (open / closed)
  const handleTogglePeriodStatus = async (per: MealReservationPeriod) => {
    const newStatus = per.status === 'open' ? 'closed' : 'open';
    const updated: MealReservationPeriod = {
      ...per,
      status: newStatus,
      updatedAt: new Date().toISOString()
    };
    await localDb.setDoc('finance_meal_periods', updated);
    setPeriods(prev => prev.map(p => p.id === updated.id ? updated : p));
    showToast(`وضعیت دوره به "${newStatus === 'open' ? 'باز' : 'بسته'}" تغییر یافت.`);
  };

  // Add / Edit Reservation by Manager
  const handleSaveManualReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPeriod) return;

    let targetStudentId = '';
    let targetStudentName = '';
    let targetNationalId = '';
    let targetGrade = '';
    let targetIsDorm = manualIsDorm;

    if (manualStudentMode === 'from_list') {
      const foundSt = students.find(s => s.id === manualSelectedStudentId);
      if (!foundSt) {
        showToast('لطفاً طلبه مورد نظر را از لیست انتخاب کنید.');
        return;
      }
      targetStudentId = foundSt.id;
      targetStudentName = foundSt.name;
      targetNationalId = foundSt.nationalId || '';
      targetGrade = foundSt.grade || 'پایه ۷';
      targetIsDorm = foundSt.livingStatus === 'خوابگاه';
    } else {
      if (!manualStudentName.trim()) {
        showToast('لطفاً نام طلبه را وارد کنید.');
        return;
      }
      targetStudentId = `st-custom-${Date.now()}`;
      targetStudentName = manualStudentName.trim();
      targetNationalId = manualNationalId.trim();
      targetGrade = manualGrade;
    }

    const calc = calculateMealsCounts(manualLunchDays, manualDinnerDays);

    const newRes: StudentMealReservation = {
      id: `res-${currentPeriod.id}-${targetStudentId}`,
      periodId: currentPeriod.id,
      studentId: targetStudentId,
      studentName: targetStudentName,
      nationalId: targetNationalId,
      grade: targetGrade,
      isDormitory: targetIsDorm,
      selectedLunchDays: manualLunchDays,
      selectedDinnerDays: manualDinnerDays,
      ...calc,
      notes: manualNotes,
      updatedAt: new Date().toISOString()
    };

    await localDb.setDoc('finance_student_meal_reservations', newRes);
    setReservations(prev => {
      const idx = prev.findIndex(r => r.id === newRes.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newRes;
        return copy;
      }
      return [newRes, ...prev];
    });

    setIsAddReservationModalOpen(false);
    showToast(`رزرو نهار و شام برای ${targetStudentName} ثبت گردید.`);
  };

  // Update Existing Reservation
  const handleSaveEditReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReservation) return;

    const calc = calculateMealsCounts(
      editingReservation.selectedLunchDays || [],
      editingReservation.selectedDinnerDays || []
    );

    const updated: StudentMealReservation = {
      ...editingReservation,
      ...calc,
      updatedAt: new Date().toISOString()
    };

    await localDb.setDoc('finance_student_meal_reservations', updated);
    setReservations(prev => prev.map(r => r.id === updated.id ? updated : r));
    setEditingReservation(null);
    showToast('رزرو طلبه با موفقیت ویرایش و هزینه‌ها بازسنجی شد.');
  };

  const handleDeleteReservation = async (resId: string) => {
    if (window.confirm('آیا از حذف این رزرو غذا اطمینان دارید؟')) {
      await localDb.deleteDoc('finance_student_meal_reservations', resId);
      setReservations(prev => prev.filter(r => r.id !== resId));
      showToast('رزرو با موفقیت حذف شد.');
    }
  };

  // Kitchen Holiday / Cancellation Handler (لغو غذا / تعطیلی آشپزخانه)
  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayDate.trim()) {
      showToast('لطفاً تاریخ تعطیلی را وارد کنید.');
      return;
    }

    const newHol: MealCancelledDay = {
      id: `hol-${Date.now()}`,
      date: holidayDate.trim(),
      mealType: holidayMealType,
      reason: holidayReason.trim() || 'عدم پخت غذا در آشپزخانه',
      registeredAt: new Date().toISOString(),
      registeredByName: currentUser?.name || 'مسئول مالی'
    };

    await localDb.setDoc('finance_meal_holidays', newHol);
    const updatedHolidays = [newHol, ...kitchenHolidays];
    setKitchenHolidays(updatedHolidays);

    // Recalculate all active reservations with the new holiday!
    const reCalculated = reservations.map(r => {
      const calc = calculateMealsCounts(r.selectedLunchDays || [], r.selectedDinnerDays || []);
      return {
        ...r,
        ...calc,
        updatedAt: new Date().toISOString()
      };
    });

    for (const r of reCalculated) {
      await localDb.setDoc('finance_student_meal_reservations', r);
    }
    setReservations(reCalculated);

    setIsAddHolidayModalOpen(false);
    showToast(`روز ${newHol.date} به عنوان عدم پخت ${newHol.mealType === 'lunch' ? 'نهار' : newHol.mealType === 'dinner' ? 'شام' : 'نهار و شام'} ثبت شد و مبالغ شهریه بازنگری گردید.`);
  };

  const handleDeleteHoliday = async (holId: string) => {
    if (window.confirm('آیا از حذف این رکورد تعطیلی آشپزخانه اطمینان دارید؟ مبالغ مجدداً محاسبه می‌شوند.')) {
      await localDb.deleteDoc('finance_meal_holidays', holId);
      const updatedHolidays = kitchenHolidays.filter(h => h.id !== holId);
      setKitchenHolidays(updatedHolidays);

      // Recalculate
      const reCalculated = reservations.map(r => {
        const rawLunches = (r.selectedLunchDays?.length || 0) * 4;
        const rawDinners = (r.selectedDinnerDays?.length || 0) * 4;
        const lHols = updatedHolidays.filter(h => h.mealType === 'lunch' || h.mealType === 'both').length;
        const dHols = updatedHolidays.filter(h => h.mealType === 'dinner' || h.mealType === 'both').length;
        const finalL = Math.max(0, rawLunches - lHols);
        const finalD = Math.max(0, rawDinners - dHols);
        const lCost = finalL * (currentPeriod?.lunchPrice || 45000);
        const dCost = finalD * (currentPeriod?.dinnerPrice || 35000);

        return {
          ...r,
          totalCalculatedLunches: finalL,
          totalCalculatedDinners: finalD,
          totalLunchCost: lCost,
          totalDinnerCost: dCost,
          totalMealCost: lCost + dCost,
          finalDeductionAmount: lCost + dCost
        };
      });

      for (const r of reCalculated) {
        await localDb.setDoc('finance_student_meal_reservations', r);
      }
      setReservations(reCalculated);
      showToast('رکورد تعطیلی آشپزخانه حذف شد.');
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    const data = filteredReservations.map((r, idx) => ({
      'ردیف': idx + 1,
      'نام طلبه': r.studentName,
      'کد ملی': r.nationalId || '-',
      'پایه': r.grade || '-',
      'وضعیت سکونت': r.isDormitory ? 'خوابگاهی' : 'ترددی',
      'روزهای انتخابی نهار': (r.selectedLunchDays || []).join('، ') || 'بدون نهار',
      'روزهای انتخابی شام': (r.selectedDinnerDays || []).join('، ') || 'بدون شام',
      'تعداد وعده نهار در دوره': r.totalCalculatedLunches,
      'نرخ نهار (تومان)': currentPeriod?.lunchPrice || 45000,
      'هزینه نهار (تومان)': r.totalLunchCost,
      'تعداد وعده شام در دوره': r.totalCalculatedDinners,
      'نرخ شام (تومان)': currentPeriod?.dinnerPrice || 35000,
      'هزینه شام (تومان)': r.totalDinnerCost,
      'جمع کل هزینه غذا (تومان)': r.totalMealCost,
      'مبلغ نهایی کسر از شهریه (تومان)': r.finalDeductionAmount,
      'یادداشت': r.notes || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'آمار رزرو نهار و شام');
    XLSX.writeFile(wb, `آمار_نهار_و_شام_${currentPeriod?.title.replace(/\s+/g, '_') || 'دوره'}.xlsx`);
    showToast('فایل اکسل با موفقیت ایجاد و دانلود شد.');
  };

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 font-vazir pb-16" dir="rtl">
      {/* Toast */}
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

      {/* Main Header & Period Switcher */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-linear-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-amber-100">
              <UtensilsCrossed size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-slate-900">سامانه رزرو و مدیریت نهار و شام طلاب</h1>
                {currentPeriod && (
                  <span className={cn(
                    "text-xs px-2.5 py-0.5 rounded-full font-bold border",
                    currentPeriod.status === 'open' 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                      : "bg-rose-50 text-rose-700 border-rose-200"
                  )}>
                    {currentPeriod.status === 'open' ? 'دوره فعال و باز جهت رزرو' : 'دوره بسته شده'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                رزرو هفتگی نهار و شام، اعمال تعطیلی آشپزخانه، آمار دوره‌ای و محاسبه خودکار کسورات نوع دوم در شهریه
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Period Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-2xl border border-slate-200">
              <Calendar size={15} className="text-slate-400 mr-2" />
              <select
                value={activePeriodId}
                onChange={(e) => setActivePeriodId(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 outline-hidden pr-2 pl-4 py-1"
              >
                {periods.map(p => (
                  <option key={p.id} value={p.id}>{p.title} ({p.status === 'open' ? 'باز' : 'بسته'})</option>
                ))}
              </select>
            </div>

            {!isStudentLevel3 && (
              <>
                <button
                  onClick={() => setIsNewPeriodModalOpen(true)}
                  className="flex items-center gap-1 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  <Plus size={15} />
                  <span>دوره جدید</span>
                </button>

                <button
                  onClick={() => setIsAddReservationModalOpen(true)}
                  className="flex items-center gap-1 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  <UserPlus size={15} />
                  <span>ثبت رزرو طلبه</span>
                </button>

                <button
                  onClick={() => setIsAddHolidayModalOpen(true)}
                  className="flex items-center gap-1 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold border border-rose-200 transition-all cursor-pointer"
                  title="ثبت تعطیلی آشپزخانه / لغو غذا"
                >
                  <CalendarOff size={15} />
                  <span>ثبت تعطیلی آشپزخانه</span>
                </button>
              </>
            )}

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-all cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              <span>اکسل</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-all cursor-pointer"
            >
              <Printer size={15} />
              <span>چاپ</span>
            </button>
          </div>
        </div>

        {/* Pricing Info Banner */}
        {currentPeriod && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/60">
              <Sun size={16} className="text-amber-600 shrink-0" />
              <div>
                <span className="text-slate-500 font-normal">نرخ هر وعده نهار: </span>
                <span className="font-black text-amber-900">{currentPeriod.lunchPrice.toLocaleString('fa-IR')} تومان</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-200/60">
              <Moon size={16} className="text-indigo-600 shrink-0" />
              <div>
                <span className="text-slate-500 font-normal">نرخ هر وعده شام: </span>
                <span className="font-black text-indigo-900">{currentPeriod.dinnerPrice.toLocaleString('fa-IR')} تومان</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs bg-rose-50/60 p-2.5 rounded-xl border border-rose-200/60">
              <Ban size={16} className="text-rose-600 shrink-0" />
              <div>
                <span className="text-slate-500 font-normal">روزهای مسدود نهار: </span>
                <span className="font-bold text-rose-800">{currentPeriod.lunchDisabledDays?.join('، ') || 'جمعه'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <CalendarOff size={16} className="text-slate-500 shrink-0" />
              <div>
                <span className="text-slate-500 font-normal">تعطیلی‌های آشپزخانه: </span>
                <span className="font-bold text-slate-800">{kitchenHolidays.length} روز لغو شده</span>
              </div>
            </div>
          </div>
        )}

        {/* Sub-tabs Navigation */}
        {!isStudentLevel3 && (
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2 overflow-x-auto">
            <button
              onClick={() => setActiveSubTab('reservations_list')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                activeSubTab === 'reservations_list' ? "bg-amber-600 text-white shadow-xs" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              )}
            >
              <Users size={15} />
              <span>لیست رزروهای طلاب ({activePeriodReservations.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('stats_reports')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                activeSubTab === 'stats_reports' ? "bg-amber-600 text-white shadow-xs" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              )}
            >
              <TrendingUp size={15} />
              <span>آمار و تحلیل مصرف غذا</span>
            </button>

            <button
              onClick={() => setActiveSubTab('kitchen_holidays')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                activeSubTab === 'kitchen_holidays' ? "bg-amber-600 text-white shadow-xs" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              )}
            >
              <CalendarOff size={15} />
              <span>تعطیلی آشپزخانه و لغو غذا ({kitchenHolidays.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('kitchen_invoices')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                activeSubTab === 'kitchen_invoices' ? "bg-amber-600 text-white shadow-xs" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              )}
            >
              <Receipt size={15} />
              <span>فاکتورها و تسویه آشپزخانه</span>
            </button>
          </div>
        )}
      </div>

      {/* SECTION FOR LEVEL 3 STUDENTS (پرتال انتخاب روزهای نهار و شام طلبه) */}
      <div className="bg-white rounded-3xl p-6 border border-amber-200/90 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-amber-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <ChefHat size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">
                {isStudentLevel3 ? 'فرم رزرو هفتگی نهار و شام من' : 'فرم رزرو و شبیه‌ساز پرتال طلبه'}
              </h2>
              <p className="text-[11px] text-slate-500">
                مشخص کنید در این دوره برای چه روزهایی از هفته نهار و برای چه روزهایی شام می‌خواهید (روزهای جمعه کلاً نهار نیست)
              </p>
            </div>
          </div>

          {currentPeriod && (
            <div className="text-left text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
              <span>دوره انتخابی: {currentPeriod.title}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleStudentSaveReservation} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lunch Days Picker */}
            <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sun size={18} className="text-amber-600" />
                  <span className="text-xs font-black text-slate-900">روزهای انتخابی نهار در هفته</span>
                </div>
                <span className="text-[10px] text-amber-700 font-bold">
                  {mySelectedLunchDays.length} روز ({currentPeriod?.lunchPrice.toLocaleString('fa-IR')} ت/وعده)
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {WEEK_DAYS.map(day => {
                  const isFriday = day === 'جمعه'; // Friday is strictly forbidden for lunch
                  const isBlockedByManager = (currentPeriod?.lunchDisabledDays || []).includes(day);
                  const isForbidden = isFriday || isBlockedByManager;
                  const isSelected = mySelectedLunchDays.includes(day) && !isForbidden;

                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={isForbidden}
                      onClick={() => {
                        if (isForbidden) return;
                        setMySelectedLunchDays(prev => 
                          prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                        );
                      }}
                      className={cn(
                        "p-2.5 rounded-xl text-xs font-bold flex items-center justify-between border transition-all cursor-pointer",
                        isForbidden 
                          ? "bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed" 
                          : isSelected 
                            ? "bg-amber-500 text-white border-amber-600 shadow-xs" 
                            : "bg-white text-slate-700 border-slate-200 hover:bg-amber-50"
                      )}
                    >
                      <span>{day}</span>
                      {isForbidden ? (
                        <span className="text-[9px] text-rose-500 font-normal">(تعطیل)</span>
                      ) : isSelected ? (
                        <Check size={14} />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-slate-300" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dinner Days Picker */}
            <div className="bg-indigo-50/40 p-4 rounded-2xl border border-indigo-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Moon size={18} className="text-indigo-600" />
                  <span className="text-xs font-black text-slate-900">روزهای انتخابی شام در هفته</span>
                </div>
                <span className="text-[10px] text-indigo-700 font-bold">
                  {mySelectedDinnerDays.length} روز ({currentPeriod?.dinnerPrice.toLocaleString('fa-IR')} ت/وعده)
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {WEEK_DAYS.map(day => {
                  const isBlockedByManager = (currentPeriod?.dinnerDisabledDays || []).includes(day);
                  const isForbidden = isBlockedByManager;
                  const isSelected = mySelectedDinnerDays.includes(day) && !isForbidden;

                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={isForbidden}
                      onClick={() => {
                        if (isForbidden) return;
                        setMySelectedDinnerDays(prev => 
                          prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                        );
                      }}
                      className={cn(
                        "p-2.5 rounded-xl text-xs font-bold flex items-center justify-between border transition-all cursor-pointer",
                        isForbidden 
                          ? "bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed" 
                          : isSelected 
                            ? "bg-indigo-600 text-white border-indigo-700 shadow-xs" 
                            : "bg-white text-slate-700 border-slate-200 hover:bg-indigo-50"
                      )}
                    >
                      <span>{day}</span>
                      {isForbidden ? (
                        <span className="text-[9px] text-rose-500 font-normal">(بسته)</span>
                      ) : isSelected ? (
                        <Check size={14} />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-slate-300" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Real-time Calculation Summary */}
          {(() => {
            const previewCalc = calculateMealsCounts(mySelectedLunchDays, mySelectedDinnerDays);
            return (
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <span className="text-slate-400">نهار دوره: </span>
                    <span className="font-bold text-amber-800">{previewCalc.totalCalculatedLunches} وعده ({previewCalc.totalLunchCost.toLocaleString('fa-IR')} تومان)</span>
                  </div>
                  <div>
                    <span className="text-slate-400">شام دوره: </span>
                    <span className="font-bold text-indigo-800">{previewCalc.totalCalculatedDinners} وعده ({previewCalc.totalDinnerCost.toLocaleString('fa-IR')} تومان)</span>
                  </div>
                  <div>
                    <span className="text-slate-400">جمع کل کسر از شهریه: </span>
                    <span className="font-black text-emerald-700 text-sm">{previewCalc.finalDeductionAmount.toLocaleString('fa-IR')} تومان</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={myReservationNotes}
                    onChange={(e) => setMyReservationNotes(e.target.value)}
                    placeholder="توضیحات و یادداشت اختیاری..."
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-hidden w-48"
                  />
                  <button
                    type="submit"
                    disabled={currentPeriod?.status !== 'open'}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all cursor-pointer shadow-xs"
                  >
                    ثبت نهایی رزرو غذا
                  </button>
                </div>
              </div>
            );
          })()}
        </form>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">تعداد کل طلاب رزروکننده</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-black text-slate-900">{stats.totalStudents.toLocaleString('fa-IR')}</span>
            <span className="text-[10px] text-slate-400 font-bold">نفر</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">{stats.dormCount} خوابگاهی • {stats.nonDormCount} ترددی</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">مجموع وعده‌های نهار دوره</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Sun size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-black text-amber-700">{stats.totalLunches.toLocaleString('fa-IR')}</span>
            <span className="text-[10px] text-slate-400 font-bold">وعده</span>
          </div>
          <p className="text-[10px] text-amber-600 font-medium mt-1">مبلغ: {stats.totalLunchCost.toLocaleString('fa-IR')} تومان</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">مجموع وعده‌های شام دوره</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Moon size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-black text-indigo-700">{stats.totalDinners.toLocaleString('fa-IR')}</span>
            <span className="text-[10px] text-slate-400 font-bold">وعده</span>
          </div>
          <p className="text-[10px] text-indigo-600 font-medium mt-1">مبلغ: {stats.totalDinnerCost.toLocaleString('fa-IR')} تومان</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">کل کسورات غذا (واریز به آشپزخانه)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-black text-emerald-700">{stats.totalMealCost.toLocaleString('fa-IR')}</span>
            <span className="text-[10px] text-slate-400 font-bold">تومان</span>
          </div>
          <p className="text-[10px] text-emerald-600 font-medium mt-1">کسورات نوع دوم قابل واریز به بالادستی</p>
        </div>
      </div>

      {/* Sub-tab 1: Reservations Table */}
      {activeSubTab === 'reservations_list' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[300px]">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجو در نام طلبه، کد ملی..."
                  className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden focus:bg-white focus:border-amber-500"
                />
              </div>

              <select
                value={selectedGradeFilter}
                onChange={(e) => setSelectedGradeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-hidden"
              >
                <option value="all">همه پایه‌ها</option>
                <option value="پایه ۷">پایه ۷</option>
                <option value="پایه ۸">پایه ۸</option>
                <option value="پایه ۹">پایه ۹</option>
                <option value="پایه ۱۰">پایه ۱۰</option>
              </select>

              <select
                value={selectedDormFilter}
                onChange={(e) => setSelectedDormFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-hidden"
              >
                <option value="all">همه وضعیت‌های سکونت</option>
                <option value="dorm">فقط خوابگاهی</option>
                <option value="non_dorm">فقط ترددی</option>
              </select>
            </div>

            <div className="text-xs text-slate-400 font-bold">
              نمایش {filteredReservations.length} از {activePeriodReservations.length} طلبه رزروکننده
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-black">
                    <th className="py-3.5 px-3">ردیف</th>
                    <th className="py-3.5 px-3">نام و مشخصات طلبه</th>
                    <th className="py-3.5 px-3">سکونت</th>
                    <th className="py-3.5 px-3">روزهای انتخابی نهار</th>
                    <th className="py-3.5 px-3">روزهای انتخابی شام</th>
                    <th className="py-3.5 px-3 text-center">تعداد نهار</th>
                    <th className="py-3.5 px-3 text-center">تعداد شام</th>
                    <th className="py-3.5 px-3 text-center">هزینه نهار</th>
                    <th className="py-3.5 px-3 text-center">هزینه شام</th>
                    <th className="py-3.5 px-3 text-center">مجموع کسر از شهریه</th>
                    {!isStudentLevel3 && <th className="py-3.5 px-3 text-center">عملیات</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredReservations.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400">
                        <UtensilsCrossed size={36} className="mx-auto text-slate-300 mb-2" />
                        <p className="font-bold">هیچ رزروی در این دوره ثبت نشده است.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredReservations.map((r, idx) => (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-3">
                          <div className="font-black text-slate-900">{r.studentName}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>{r.grade || 'پایه نامشخص'}</span>
                            {r.nationalId && <span>• کد ملی: {r.nationalId}</span>}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-md font-bold",
                            r.isDormitory ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                          )}>
                            {r.isDormitory ? 'خوابگاهی' : 'ترددی'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1 max-w-[170px]">
                            {(r.selectedLunchDays || []).length > 0 ? (
                              r.selectedLunchDays.map(d => (
                                <span key={d} className="text-[9px] px-1.5 py-0.2 bg-amber-50 text-amber-800 border border-amber-200 rounded">
                                  {d}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-400">بدون نهار</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1 max-w-[170px]">
                            {(r.selectedDinnerDays || []).length > 0 ? (
                              r.selectedDinnerDays.map(d => (
                                <span key={d} className="text-[9px] px-1.5 py-0.2 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded">
                                  {d}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-400">بدون شام</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-amber-900">
                          {r.totalCalculatedLunches}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-indigo-900">
                          {r.totalCalculatedDinners}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-700">
                          {r.totalLunchCost.toLocaleString('fa-IR')}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-700">
                          {r.totalDinnerCost.toLocaleString('fa-IR')}
                        </td>
                        <td className="py-3 px-3 text-center font-black text-emerald-700 bg-emerald-50/30">
                          {r.finalDeductionAmount.toLocaleString('fa-IR')}
                          <span className="text-[9px] text-slate-400 font-normal mr-1">تومان</span>
                        </td>
                        {!isStudentLevel3 && (
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setEditingReservation(r)}
                                className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 cursor-pointer"
                                title="ویرایش روزها و مقادیر"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteReservation(r.id)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 cursor-pointer"
                                title="حذف رزرو"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab 2: Stats & Reports */}
      {activeSubTab === 'stats_reports' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-sm font-black text-slate-900">تحلیل آماری و تفکیک مصرف وعده‌های غذایی</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200">
                <span className="text-xs font-bold text-amber-800">میانگین نهار به ازای هر طلبه</span>
                <div className="text-2xl font-black text-amber-900 mt-2">
                  {stats.totalStudents > 0 ? (stats.totalLunches / stats.totalStudents).toFixed(1) : 0} وعده
                </div>
                <p className="text-[10px] text-slate-500 mt-1">نرخ روزانه نهار: {currentPeriod?.lunchPrice.toLocaleString('fa-IR')} تومان</p>
              </div>

              <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-200">
                <span className="text-xs font-bold text-indigo-800">میانگین شام به ازای هر طلبه</span>
                <div className="text-2xl font-black text-indigo-900 mt-2">
                  {stats.totalStudents > 0 ? (stats.totalDinners / stats.totalStudents).toFixed(1) : 0} وعده
                </div>
                <p className="text-[10px] text-slate-500 mt-1">نرخ روزانه شام: {currentPeriod?.dinnerPrice.toLocaleString('fa-IR')} تومان</p>
              </div>

              <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200">
                <span className="text-xs font-bold text-emerald-800">مجموع سرانه کسر غذای هر طلبه</span>
                <div className="text-2xl font-black text-emerald-900 mt-2">
                  {stats.totalStudents > 0 ? Math.round(stats.totalMealCost / stats.totalStudents).toLocaleString('fa-IR') : 0} تومان
                </div>
                <p className="text-[10px] text-slate-500 mt-1">کسر خودکار از شهریه ماهانه</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab 3: Kitchen Holidays / Cancellations (تعطیلی آشپزخانه و لغو غذا) */}
      {activeSubTab === 'kitchen_holidays' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-900">لیست روزهای تعطیلی آشپزخانه و لغو وعده غذایی</h2>
                <p className="text-xs text-slate-500">
                  در روزهایی که آشپزخانه اعلام می‌کند غذا نیست، ثبت تعطیلی موجب می‌شود هزینه آن روز از شهریه طلبه کسر نگردد
                </p>
              </div>

              <button
                onClick={() => setIsAddHolidayModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Plus size={15} />
                <span>ثبت روز عدم پخت جدید</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {kitchenHolidays.map(hol => (
                <div key={hol.id} className="bg-rose-50/50 p-4 rounded-2xl border border-rose-200 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-rose-900 font-mono">{hol.date}</span>
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded font-bold",
                        hol.mealType === 'lunch' ? "bg-amber-100 text-amber-800" :
                        hol.mealType === 'dinner' ? "bg-indigo-100 text-indigo-800" :
                        "bg-rose-200 text-rose-900"
                      )}>
                        {hol.mealType === 'lunch' ? 'لغو نهار' : hol.mealType === 'dinner' ? 'لغو شام' : 'لغو هر دو (نهار و شام)'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 font-medium pt-1">
                      {hol.reason || 'تعطیلی آشپزخانه'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-rose-200/60 text-[10px] text-slate-400">
                    <span>ثبت: {hol.registeredByName || 'مسئول مالی'}</span>
                    <button
                      onClick={() => handleDeleteHoliday(hol.id)}
                      className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                    >
                      حذف تعطیلی
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab 4: Kitchen Invoices */}
      {activeSubTab === 'kitchen_invoices' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-900">صورت وضعیت و صورت‌حساب‌های آشپزخانه / کیترینگ</h2>
                <p className="text-xs text-slate-500">کنترل مبالغ وارده و تسویه شده با تامین‌کننده غذا</p>
              </div>

              <button
                onClick={() => setIsAddInvoiceModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Plus size={15} />
                <span>ثبت فاکتور روزانه آشپزخانه</span>
              </button>
            </div>

            <div className="space-y-3">
              {kitchenInvoices.map(inv => (
                <div key={inv.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900">{inv.supplierName}</span>
                      <span className="text-[10px] text-slate-500 font-mono">({inv.date} - {inv.dayOfWeek})</span>
                      <span className={cn(
                        "text-[9px] px-2 py-0.2 rounded font-bold",
                        inv.isSettled ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      )}>
                        {inv.isSettled ? 'تسویه شده' : 'در انتظار تسویه'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{inv.notes}</p>
                    <div className="text-[11px] text-slate-400 flex items-center gap-3">
                      <span>نهار: {inv.lunchPortions} پرس</span>
                      <span>شام: {inv.dinnerPortions} پرس</span>
                    </div>
                  </div>

                  <div className="text-left">
                    <div className="text-base font-black text-slate-900">
                      {inv.totalCost.toLocaleString('fa-IR')} <span className="text-[10px] font-normal text-slate-400">تومان</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Create New Period */}
      <AnimatePresence>
        {isNewPeriodModalOpen && (
          <div className="fixed inset-0 bg-[#00000055] backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900">بازگشایی دوره جدید رزرو نهار و شام</h3>
                <button onClick={() => setIsNewPeriodModalOpen(false)} className="p-1 rounded-lg text-slate-400">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreatePeriod} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">عنوان دوره *</label>
                  <input
                    type="text"
                    value={periodTitle}
                    onChange={(e) => setPeriodTitle(e.target.value)}
                    placeholder="مثلاً: رزرو نهار و شام آبان ۱۴۰۳"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">تاریخ شروع</label>
                    <input
                      type="text"
                      value={periodStartDate}
                      onChange={(e) => setPeriodStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">تاریخ پایان</label>
                    <input
                      type="text"
                      value={periodEndDate}
                      onChange={(e) => setPeriodEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-amber-50/50 p-3 rounded-2xl border border-amber-200/60">
                  <div>
                    <label className="block text-xs font-bold text-amber-900 mb-1">نرخ هر وعده نهار (تومان) *</label>
                    <input
                      type="number"
                      value={periodLunchPrice}
                      onChange={(e) => setPeriodLunchPrice(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-black text-amber-900"
                      min={0}
                      step={1000}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-indigo-900 mb-1">نرخ هر وعده شام (تومان) *</label>
                    <input
                      type="number"
                      value={periodDinnerPrice}
                      onChange={(e) => setPeriodDinnerPrice(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-black text-indigo-900"
                      min={0}
                      step={1000}
                      required
                    />
                  </div>
                </div>

                {/* Blocked Days Setup for Period */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">روزهای مسدود برای نهار در هفته</label>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEK_DAYS.map(day => {
                      const isSelected = periodLunchDisabledDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            if (day === 'جمعه') return; // Friday must remain blocked
                            setPeriodLunchDisabledDays(prev => 
                              prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                            );
                          }}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer",
                            isSelected ? "bg-rose-500 text-white border-rose-600" : "bg-slate-50 text-slate-700 border-slate-200"
                          )}
                        >
                          {day} {day === 'جمعه' && '(همیشه بسته)'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsNewPeriodModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-sm"
                  >
                    افتتاح دوره رزرو
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Manual Add Reservation by Manager */}
      <AnimatePresence>
        {isAddReservationModalOpen && (
          <div className="fixed inset-0 bg-[#00000055] backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900">ثبت رزرو نهار و شام برای طلبه</h3>
                <button onClick={() => setIsAddReservationModalOpen(false)} className="p-1 rounded-lg text-slate-400">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveManualReservation} className="space-y-4">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setManualStudentMode('from_list')}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                      manualStudentMode === 'from_list' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                    )}
                  >
                    انتخاب از لیست طلاب
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualStudentMode('custom_name')}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                      manualStudentMode === 'custom_name' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                    )}
                  >
                    ثبت نام دستی متفرقه
                  </button>
                </div>

                {manualStudentMode === 'from_list' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">انتخاب طلبه *</label>
                    <select
                      value={manualSelectedStudentId}
                      onChange={(e) => setManualSelectedStudentId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                      required
                    >
                      <option value="">-- انتخاب طلبه --</option>
                      {students.filter(s => s.isActive).map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.grade || 'پایه ۷'})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">نام و نام خانوادگی *</label>
                      <input
                        type="text"
                        value={manualStudentName}
                        onChange={(e) => setManualStudentName(e.target.value)}
                        placeholder="نام و نام خانوادگی"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">کد ملی</label>
                        <input
                          type="text"
                          value={manualNationalId}
                          onChange={(e) => setManualNationalId(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">پایه تحصیلی</label>
                        <select
                          value={manualGrade}
                          onChange={(e) => setManualGrade(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                        >
                          <option value="پایه ۷">پایه ۷</option>
                          <option value="پایه ۸">پایه ۸</option>
                          <option value="پایه ۹">پایه ۹</option>
                          <option value="پایه ۱۰">پایه ۱۰</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Lunch Days */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">روزهای هفتگی نهار</label>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEK_DAYS.filter(d => d !== 'جمعه').map(day => {
                      const isSelected = manualLunchDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setManualLunchDays(prev => 
                            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                          )}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-bold border transition-all",
                            isSelected ? "bg-amber-500 text-white border-amber-600" : "bg-slate-50 text-slate-700 border-slate-200"
                          )}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dinner Days */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">روزهای هفتگی شام</label>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEK_DAYS.map(day => {
                      const isSelected = manualDinnerDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setManualDinnerDays(prev => 
                            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                          )}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-bold border transition-all",
                            isSelected ? "bg-indigo-600 text-white border-indigo-700" : "bg-slate-50 text-slate-700 border-slate-200"
                          )}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">یادداشت</label>
                  <input
                    type="text"
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    placeholder="توضیحات اختیاری..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddReservationModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black shadow-sm"
                  >
                    ثبت رزرو
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Add Kitchen Holiday (تعطیلی آشپزخانه / لغو غذا) */}
      <AnimatePresence>
        {isAddHolidayModalOpen && (
          <div className="fixed inset-0 bg-[#00000055] backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-rose-700">
                  <CalendarOff size={18} />
                  <h3 className="text-sm font-black text-slate-900">ثبت تعطیلی آشپزخانه و لغو غذا</h3>
                </div>
                <button onClick={() => setIsAddHolidayModalOpen(false)} className="p-1 rounded-lg text-slate-400">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveHoliday} className="space-y-3">
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
                  با ثبت این تاریخ، مبلغ وعده غذایی لغو شده به صورت خودکار از محاسبات کسر شهریه همه طلاب خارج می‌شود.
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاریخ لغو غذا (شمسی) *</label>
                  <input
                    type="text"
                    value={holidayDate}
                    onChange={(e) => setHolidayDate(e.target.value)}
                    placeholder="۱۴۰۳/۰۷/۱۵"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">وعده لغو شده *</label>
                  <select
                    value={holidayMealType}
                    onChange={(e) => setHolidayMealType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="lunch">فقط نهار لغو است</option>
                    <option value="dinner">فقط شام لغو است</option>
                    <option value="both">هم نهار و هم شام لغو است</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">علت عدم پخت غذا</label>
                  <input
                    type="text"
                    value={holidayReason}
                    onChange={(e) => setHolidayReason(e.target.value)}
                    placeholder="مثلاً: اعلام آشپزخانه، اردوی عمومی، تعطیلی رسمی و..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddHolidayModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-sm"
                  >
                    ثبت و اعمال در شهریه
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Edit Single Reservation */}
      <AnimatePresence>
        {editingReservation && (
          <div className="fixed inset-0 bg-[#00000055] backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900">ویرایش رزرو غذای: {editingReservation.studentName}</h3>
                <button onClick={() => setEditingReservation(null)} className="p-1 rounded-lg text-slate-400">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveEditReservation} className="space-y-4">
                {/* Lunch Days */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">روزهای هفتگی نهار</label>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEK_DAYS.filter(d => d !== 'جمعه').map(day => {
                      const isSelected = (editingReservation.selectedLunchDays || []).includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            const current = editingReservation.selectedLunchDays || [];
                            const updated = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
                            setEditingReservation({ ...editingReservation, selectedLunchDays: updated });
                          }}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-bold border transition-all",
                            isSelected ? "bg-amber-500 text-white border-amber-600" : "bg-slate-50 text-slate-700 border-slate-200"
                          )}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dinner Days */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">روزهای هفتگی شام</label>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEK_DAYS.map(day => {
                      const isSelected = (editingReservation.selectedDinnerDays || []).includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            const current = editingReservation.selectedDinnerDays || [];
                            const updated = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
                            setEditingReservation({ ...editingReservation, selectedDinnerDays: updated });
                          }}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-bold border transition-all",
                            isSelected ? "bg-indigo-600 text-white border-indigo-700" : "bg-slate-50 text-slate-700 border-slate-200"
                          )}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">یادداشت</label>
                  <input
                    type="text"
                    value={editingReservation.notes || ''}
                    onChange={(e) => setEditingReservation({ ...editingReservation, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingReservation(null)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-sm"
                  >
                    ذخیره و بازسنجی هزینه
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
