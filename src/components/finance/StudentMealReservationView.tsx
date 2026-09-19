import React, { useState, useEffect, useMemo } from 'react';
import { 
  UtensilsCrossed, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Sun, 
  Moon, 
  Building2, 
  Bed, 
  Save, 
  RefreshCw, 
  Lock, 
  Unlock, 
  Sparkles,
  Info,
  CalendarDays,
  Check,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { 
  getTodayShamsi, 
  getShamsiDayOfWeekName, 
  generateShamsiDateRange, 
  compareShamsi 
} from '../../lib/jalali';
import { 
  Student, 
  MealReservationPeriod, 
  StudentMealReservation, 
  MealCancelledDay 
} from '../../types';

const WEEK_DAYS = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'] as const;

export default function StudentMealReservationView() {
  const { currentUser } = useAuth();

  const [periods, setPeriods] = useState<MealReservationPeriod[]>([]);
  const [activePeriodId, setActivePeriodId] = useState<string>('');
  const [student, setStudent] = useState<Student | null>(null);
  const [reservation, setReservation] = useState<StudentMealReservation | null>(null);
  const [kitchenHolidays, setKitchenHolidays] = useState<MealCancelledDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Student form state
  const [selectedLunchDays, setSelectedLunchDays] = useState<string[]>(['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه']);
  const [selectedDinnerDays, setSelectedDinnerDays] = useState<string[]>([]);
  const [dinnerLocation, setDinnerLocation] = useState<'institute' | 'dormitory'>('institute');
  const [reservationNotes, setReservationNotes] = useState('');

  const today = getTodayShamsi();

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Load Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [storedPeriods, storedRes, storedHolidays, storedStudents] = await Promise.all([
        localDb.getDocs<MealReservationPeriod>('finance_meal_periods'),
        localDb.getDocs<StudentMealReservation>('finance_student_meal_reservations'),
        localDb.getDocs<MealCancelledDay>('finance_meal_holidays'),
        localDb.getDocs<Student>('students')
      ]);

      setKitchenHolidays(storedHolidays || []);

      // Find matched student profile
      let matchedStudent: Student | null = null;
      if (currentUser?.linkedStudentId) {
        matchedStudent = storedStudents.find(s => s.id === currentUser.linkedStudentId) || null;
      }
      if (!matchedStudent && currentUser?.studentName) {
        matchedStudent = storedStudents.find(s => s.name.trim() === currentUser.studentName?.trim()) || null;
      }
      if (!matchedStudent && currentUser?.username) {
        matchedStudent = storedStudents.find(s => 
          s.name.includes(currentUser.username) || 
          (currentUser.fullName && s.name.includes(currentUser.fullName.split(' ')[0]))
        ) || null;
      }
      if (!matchedStudent && storedStudents.length > 0) {
        matchedStudent = storedStudents[0];
      }
      setStudent(matchedStudent);

      // Determine initial dinner location based on student dormitory status
      const isDorm = matchedStudent?.livingStatus === 'خوابگاه';
      const defaultDinnerLoc: 'institute' | 'dormitory' = isDorm ? 'dormitory' : 'institute';

      // Sort periods: open first, then newest
      const validPeriods = (storedPeriods || []).sort((a, b) => {
        if (a.status === 'open' && b.status !== 'open') return -1;
        if (a.status !== 'open' && b.status === 'open') return 1;
        return compareShamsi(b.startDate, a.startDate);
      });

      setPeriods(validPeriods);

      // Set active period
      const openPeriod = validPeriods.find(p => p.status === 'open') || validPeriods[0];
      if (openPeriod) {
        setActivePeriodId(openPeriod.id);
        
        // Find existing reservation for this student in this period
        if (matchedStudent) {
          const existingRes = (storedRes || []).find(r => r.periodId === openPeriod.id && r.studentId === matchedStudent?.id);
          if (existingRes) {
            setReservation(existingRes);
            setSelectedLunchDays(existingRes.selectedLunchDays || []);
            setSelectedDinnerDays(existingRes.selectedDinnerDays || []);
            setDinnerLocation(existingRes.dinnerLocation || defaultDinnerLoc);
            setReservationNotes(existingRes.notes || '');
          } else {
            setReservation(null);
            // Default choices for new reservation
            setSelectedLunchDays(['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه']);
            setSelectedDinnerDays(isDorm ? ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه'] : []);
            setDinnerLocation(defaultDinnerLoc);
            setReservationNotes('');
          }
        }
      }
    } catch (err) {
      console.error('Error loading student meal data:', err);
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
  }, [currentUser]);

  // Handle period change
  const handlePeriodSelect = (periodId: string) => {
    setActivePeriodId(periodId);
    const targetPeriod = periods.find(p => p.id === periodId);
    if (!targetPeriod || !student) return;

    localDb.getDocs<StudentMealReservation>('finance_student_meal_reservations').then(allRes => {
      const existingRes = (allRes || []).find(r => r.periodId === periodId && r.studentId === student.id);
      const isDorm = student.livingStatus === 'خوابگاه';
      const defaultDinnerLoc: 'institute' | 'dormitory' = isDorm ? 'dormitory' : 'institute';

      if (existingRes) {
        setReservation(existingRes);
        setSelectedLunchDays(existingRes.selectedLunchDays || []);
        setSelectedDinnerDays(existingRes.selectedDinnerDays || []);
        setDinnerLocation(existingRes.dinnerLocation || defaultDinnerLoc);
        setReservationNotes(existingRes.notes || '');
      } else {
        setReservation(null);
        setSelectedLunchDays(['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه']);
        setSelectedDinnerDays(isDorm ? ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه'] : []);
        setDinnerLocation(defaultDinnerLoc);
        setReservationNotes('');
      }
    });
  };

  const currentPeriod = useMemo(() => {
    return periods.find(p => p.id === activePeriodId) || periods[0] || null;
  }, [periods, activePeriodId]);

  // Is registration open for student right now?
  const isPeriodOpen = useMemo(() => {
    if (!currentPeriod) return false;
    if (currentPeriod.status !== 'open') return false;
    if (currentPeriod.isManuallyClosed) return false;
    if (currentPeriod.deadlineDate) {
      if (compareShamsi(today, currentPeriod.deadlineDate) > 0) {
        return false;
      }
    }
    return true;
  }, [currentPeriod, today]);

  // Generate day-by-day calendar data for current period
  const calendarDays = useMemo(() => {
    if (!currentPeriod) return [];
    const dates = generateShamsiDateRange(currentPeriod.startDate, currentPeriod.endDate);
    
    return dates.map(date => {
      const dayOfWeek = getShamsiDayOfWeekName(date);
      
      // Check if kitchen has cancelled meal on this date
      const holiday = kitchenHolidays.find(h => h.date === date);
      const isLunchCancelled = holiday?.mealType === 'lunch' || holiday?.mealType === 'both';
      const isDinnerCancelled = holiday?.mealType === 'dinner' || holiday?.mealType === 'both';

      const isLunchDaySelected = selectedLunchDays.includes(dayOfWeek) && !currentPeriod.lunchDisabledDays?.includes(dayOfWeek);
      const isDinnerDaySelected = selectedDinnerDays.includes(dayOfWeek) && !currentPeriod.dinnerDisabledDays?.includes(dayOfWeek);

      const hasLunch = isLunchDaySelected && !isLunchCancelled && (currentPeriod.enableLunch !== false);
      const hasDinner = isDinnerDaySelected && !isDinnerCancelled && (currentPeriod.enableDinner !== false);

      return {
        date,
        dayOfWeek,
        isLunchDaySelected,
        isDinnerDaySelected,
        isLunchCancelled,
        isDinnerCancelled,
        cancellationReason: holiday?.reason,
        hasLunch,
        hasDinner,
        dinnerLocation: dinnerLocation
      };
    });
  }, [currentPeriod, kitchenHolidays, selectedLunchDays, selectedDinnerDays, dinnerLocation]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalLunches = calendarDays.filter(d => d.hasLunch).length;
    const totalDinners = calendarDays.filter(d => d.hasDinner).length;
    const totalDinnersInst = calendarDays.filter(d => d.hasDinner && d.dinnerLocation === 'institute').length;
    const totalDinnersDorm = calendarDays.filter(d => d.hasDinner && d.dinnerLocation === 'dormitory').length;
    const totalAllMeals = totalLunches + totalDinners;

    return {
      totalLunches,
      totalDinners,
      totalDinnersInst,
      totalDinnersDorm,
      totalAllMeals
    };
  }, [calendarDays]);

  // Toggle Lunch Day
  const handleToggleLunchDay = (day: string) => {
    if (!isPeriodOpen) return;
    if (currentPeriod?.lunchDisabledDays?.includes(day)) return;

    setSelectedLunchDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  // Toggle Dinner Day
  const handleToggleDinnerDay = (day: string) => {
    if (!isPeriodOpen) return;
    if (currentPeriod?.dinnerDisabledDays?.includes(day)) return;

    setSelectedDinnerDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  // Save Reservation
  const handleSaveReservation = async () => {
    if (!currentPeriod || !student) {
      showToast('خطا: اطلاعات طلبه یا دوره معتبر نیست.');
      return;
    }

    if (!isPeriodOpen) {
      showToast('امکان تغییر رزرو وجود ندارد زیرا مهلت ثبت‌نام به پایان رسیده است.');
      return;
    }

    setIsSaving(true);
    try {
      const isDorm = student.livingStatus === 'خوابگاه';
      const lunchUnitCost = currentPeriod.lunchPrice || 45000;
      const dinnerUnitCost = currentPeriod.dinnerPrice || 35000;

      const totalLunchCost = stats.totalLunches * lunchUnitCost;
      const totalDinnerCost = stats.totalDinners * dinnerUnitCost;
      const totalMealCost = totalLunchCost + totalDinnerCost;

      const recordId = reservation?.id || `res_${currentPeriod.id}_${student.id}`;

      const updatedReservation: StudentMealReservation = {
        id: recordId,
        periodId: currentPeriod.id,
        studentId: student.id,
        studentName: student.name,
        nationalId: student.nationalId || '',
        grade: student.grade || 'پایه ۷',
        personRoleTitle: 'طلبه',
        isDormitory: isDorm,
        selectedLunchDays: selectedLunchDays,
        selectedDinnerDays: selectedDinnerDays,
        dinnerLocation: dinnerLocation,
        totalCalculatedLunches: stats.totalLunches,
        totalCalculatedDinners: stats.totalDinners,
        totalDinnersInstitute: stats.totalDinnersInst,
        totalDinnersDormitory: stats.totalDinnersDorm,
        totalLunchCost: totalLunchCost,
        totalDinnerCost: totalDinnerCost,
        totalMealCost: totalMealCost,
        subsidyDiscount: 0,
        finalDeductionAmount: totalMealCost,
        notes: reservationNotes.trim(),
        updatedAt: new Date().toISOString()
      };

      await localDb.setDoc('finance_student_meal_reservations', recordId, updatedReservation);
      setReservation(updatedReservation);
      showToast('رزرو نهار و شام شما با موفقیت در سیستم ثبت گردید.');
    } catch (err) {
      console.error('Error saving meal reservation:', err);
      showToast('خطا در ذخیره اطلاعات رزرو.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <RefreshCw className="animate-spin text-indigo-600" size={32} />
        <p className="text-xs font-bold text-slate-500">در حال بارگذاری اطلاعات رزرو غذا...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" dir="rtl">
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

      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center text-white shadow-md">
            <UtensilsCrossed size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span>رزرو نهار و شام</span>
              <span className="text-xs font-bold px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full">
                سامانه تغذیه طلاب
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              طلبه گرامی: <strong className="text-slate-800 font-black">{student?.name || currentUser?.fullName || 'کاربر'}</strong>
              {student?.grade && <span className="mr-2">({student.grade})</span>}
              {student?.livingStatus === 'خوابگاه' && (
                <span className="mr-2 px-2 py-0.2 text-[10px] bg-indigo-50 text-indigo-700 rounded-md font-bold">
                  ساکن خوابگاه
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Period Selector */}
        {periods.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-bold shrink-0">دوره رزرو:</span>
            <select
              value={activePeriodId}
              onChange={(e) => handlePeriodSelect(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-indigo-500 transition-all cursor-pointer"
            >
              {periods.map(p => (
                <option key={p.id} value={p.id}>
                  {p.title} {p.status === 'open' && !p.isManuallyClosed ? '🟢 (فعال)' : '🔴 (بسته)'}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Period Status Alert Banner */}
      {currentPeriod && (
        <div>
          {isPeriodOpen ? (
            <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200 flex items-start sm:items-center justify-between gap-3 text-xs text-emerald-900">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Unlock size={16} />
                </div>
                <div>
                  <h3 className="font-black text-emerald-950 flex items-center gap-1.5">
                    <span>امکان ثبت و ویرایش رزرو برای این دوره فعال است</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  </h3>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    بازه زمانی دوره: <strong>{currentPeriod.startDate}</strong> الی <strong>{currentPeriod.endDate}</strong>
                    {currentPeriod.deadlineDate && (
                      <span className="mr-3 text-rose-700 font-black">
                        (مهلت ثبت رزرو: تا {currentPeriod.deadlineDate})
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-block px-3 py-1 bg-emerald-600 text-white rounded-xl text-[10px] font-bold shrink-0">
                در حال ثبت‌نام
              </span>
            </div>
          ) : (
            <div className="p-4 bg-amber-50/90 rounded-2xl border border-amber-300 flex items-start sm:items-center justify-between gap-3 text-xs text-amber-950">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Lock size={16} />
                </div>
                <div>
                  <h3 className="font-black text-amber-950 flex items-center gap-1.5">
                    <span>امکان ثبت یا تغییر رزرو توسط مسئول مالی بسته شده است</span>
                  </h3>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    مهلت ثبت‌نام به پایان رسیده یا دوره توسط مسئول مالی مسدود گردیده است. شما فقط قادر به مشاهده برنامه غذایی رزرو شده خود هستید.
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-block px-3 py-1 bg-slate-800 text-white rounded-xl text-[10px] font-bold shrink-0">
                فقط مشاهده
              </span>
            </div>
          )}
        </div>
      )}

      {/* Summary KPI Cards (No Prices, Pure Count/Breakdown) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">تعداد وعده نهار</span>
            <Sun size={18} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            {stats.totalLunches.toLocaleString('fa-IR')} <span className="text-xs font-sans text-slate-500 font-normal">روز</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">شام در موسسه</span>
            <Building2 size={18} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-black font-mono text-indigo-700">
            {stats.totalDinnersInst.toLocaleString('fa-IR')} <span className="text-xs font-sans text-slate-500 font-normal">شب</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">شام در خوابگاه</span>
            <Bed size={18} className="text-purple-600" />
          </div>
          <div className="text-2xl font-black font-mono text-purple-700">
            {stats.totalDinnersDorm.toLocaleString('fa-IR')} <span className="text-xs font-sans text-slate-500 font-normal">شب</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-2xl shadow-md space-y-1">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-bold">مجموع کل وعده‌ها</span>
            <UtensilsCrossed size={18} className="text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-400">
            {stats.totalAllMeals.toLocaleString('fa-IR')} <span className="text-xs font-sans text-slate-300 font-normal">وعده</span>
          </div>
        </div>
      </div>

      {/* Main Reservation Selection Form (When Open) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <CalendarDays size={20} className="text-indigo-600" />
            <div>
              <h2 className="text-sm font-black text-slate-900">تنظیم و انتخاب روزهای رزرو هفتگی</h2>
              <p className="text-[11px] text-slate-500">روزهایی که مایل به صرف نهار یا شام در این دوره هستید را مشخص نمایید.</p>
            </div>
          </div>

          {isPeriodOpen && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedLunchDays(['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه']);
                  setSelectedDinnerDays(student?.livingStatus === 'خوابگاه' ? ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه'] : []);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                انتخاب روزهای کلاسی
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. Lunch Day Picker */}
          <div className="bg-amber-50/40 rounded-2xl p-4 border border-amber-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-900 font-black text-xs">
                <Sun size={16} className="text-amber-600" />
                <span>۱. روزهای دریافت نهار (هفتگی)</span>
              </div>
              <span className="text-[11px] font-bold text-amber-800">
                {selectedLunchDays.length} روز انتخاب شده
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {WEEK_DAYS.map(day => {
                const isSelected = selectedLunchDays.includes(day);
                const isDisabledByManager = currentPeriod?.lunchDisabledDays?.includes(day);

                return (
                  <button
                    key={day}
                    type="button"
                    disabled={!isPeriodOpen || isDisabledByManager}
                    onClick={() => handleToggleLunchDay(day)}
                    className={cn(
                      "p-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between border cursor-pointer",
                      isDisabledByManager
                        ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60"
                        : isSelected
                        ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:border-amber-300 hover:bg-amber-50/50"
                    )}
                  >
                    <span>{day}</span>
                    {isDisabledByManager ? (
                      <span className="text-[9px] text-slate-400">غیرفعال</span>
                    ) : isSelected ? (
                      <Check size={14} />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300"></span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-amber-800">
              * نهار در روزهای انتخاب شده برای کل بازه دوره محاسبه می‌گردد.
            </p>
          </div>

          {/* 2. Dinner Day Picker & Location */}
          <div className="bg-indigo-50/40 rounded-2xl p-4 border border-indigo-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-900 font-black text-xs">
                <Moon size={16} className="text-indigo-600" />
                <span>۲. روزهای دریافت شام (هفتگی)</span>
              </div>
              <span className="text-[11px] font-bold text-indigo-800">
                {selectedDinnerDays.length} شب انتخاب شده
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {WEEK_DAYS.map(day => {
                const isSelected = selectedDinnerDays.includes(day);
                const isDisabledByManager = currentPeriod?.dinnerDisabledDays?.includes(day);

                return (
                  <button
                    key={day}
                    type="button"
                    disabled={!isPeriodOpen || isDisabledByManager}
                    onClick={() => handleToggleDinnerDay(day)}
                    className={cn(
                      "p-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between border cursor-pointer",
                      isDisabledByManager
                        ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60"
                        : isSelected
                        ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50"
                    )}
                  >
                    <span>{day}</span>
                    {isDisabledByManager ? (
                      <span className="text-[9px] text-slate-400">غیرفعال</span>
                    ) : isSelected ? (
                      <Check size={14} />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300"></span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Dinner Location Choice */}
            {currentPeriod?.allowDinnerLocationSelect !== false && (
              <div className="pt-3 border-t border-indigo-100/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                    <Building2 size={14} className="text-indigo-600" />
                    <span>محل دریافت شام:</span>
                  </span>
                  <span className="text-[10px] text-indigo-700 font-bold">
                    {student?.livingStatus === 'خوابگاه' ? '(پیش‌فرض خوابگاه)' : '(پیش‌فرض موسسه)'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!isPeriodOpen}
                    onClick={() => setDinnerLocation('institute')}
                    className={cn(
                      "p-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer",
                      dinnerLocation === 'institute'
                        ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-indigo-50/60"
                    )}
                  >
                    <Building2 size={16} />
                    <span>موسسه</span>
                  </button>

                  <button
                    type="button"
                    disabled={!isPeriodOpen}
                    onClick={() => setDinnerLocation('dormitory')}
                    className={cn(
                      "p-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer",
                      dinnerLocation === 'dormitory'
                        ? "bg-purple-600 text-white border-purple-700 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-purple-50/60"
                    )}
                  >
                    <Bed size={16} />
                    <span>خوابگاه</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Button & Notes */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 font-medium">
            {reservation?.updatedAt ? (
              <span>آخرین ثبت در سامانه: {new Date(reservation.updatedAt).toLocaleDateString('fa-IR')}</span>
            ) : (
              <span>هنوز برای این دوره رزروی ثبت نشده است.</span>
            )}
          </div>

          {isPeriodOpen && (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveReservation}
              className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save size={16} />
              <span>{isSaving ? 'در حال ذخیره‌سازی...' : 'ثبت نهایی و تایید رزرو غذا'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Visual Calendar Breakdown of Selected Meals */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-indigo-600" />
            <div>
              <h2 className="text-sm font-black text-slate-900">تقویم روزانه وعده‌های غذایی شما در این دوره</h2>
              <p className="text-[11px] text-slate-500">مشاهده دقیق روزهایی که برای شما نهار یا شام ثبت شده است.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-bold">
            <span className="flex items-center gap-1 text-amber-700">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              نهار
            </span>
            <span className="flex items-center gap-1 text-indigo-700">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
              شام موسسه
            </span>
            <span className="flex items-center gap-1 text-purple-700">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
              شام خوابگاه
            </span>
            <span className="flex items-center gap-1 text-rose-700">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              تعطیل آشپزخانه
            </span>
          </div>
        </div>

        {/* Day Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
          {calendarDays.map((day, idx) => {
            const hasAnyMeal = day.hasLunch || day.hasDinner;

            return (
              <div
                key={day.date}
                className={cn(
                  "p-3 rounded-2xl border transition-all space-y-2",
                  hasAnyMeal
                    ? "bg-slate-50/90 border-slate-200 shadow-2xs"
                    : "bg-slate-50/30 border-slate-100 opacity-60"
                )}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-slate-800">{day.dayOfWeek}</span>
                  <span className="font-mono text-[10px] text-slate-500">{day.date.slice(5)}</span>
                </div>

                <div className="space-y-1.5 pt-1">
                  {/* Lunch Badge */}
                  {day.isLunchCancelled ? (
                    <div className="px-2 py-1 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-[10px] font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Sun size={11} className="text-rose-500" />
                        <span>نهار: تعطیل</span>
                      </span>
                    </div>
                  ) : day.hasLunch ? (
                    <div className="px-2 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-[10px] font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Sun size={11} className="text-amber-600" />
                        <span>نهار: رزرو شده</span>
                      </span>
                      <Check size={12} className="text-emerald-600" />
                    </div>
                  ) : (
                    <div className="px-2 py-0.5 text-slate-400 text-[9px]">بدون نهار</div>
                  )}

                  {/* Dinner Badge */}
                  {day.isDinnerCancelled ? (
                    <div className="px-2 py-1 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-[10px] font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Moon size={11} className="text-rose-500" />
                        <span>شام: تعطیل</span>
                      </span>
                    </div>
                  ) : day.hasDinner ? (
                    <div className={cn(
                      "px-2 py-1 border rounded-lg text-[10px] font-bold flex items-center justify-between",
                      day.dinnerLocation === 'dormitory'
                        ? "bg-purple-50 border-purple-200 text-purple-900"
                        : "bg-indigo-50 border-indigo-200 text-indigo-900"
                    )}>
                      <span className="flex items-center gap-1">
                        <Moon size={11} className={day.dinnerLocation === 'dormitory' ? "text-purple-600" : "text-indigo-600"} />
                        <span>شام: {day.dinnerLocation === 'dormitory' ? 'خوابگاه' : 'موسسه'}</span>
                      </span>
                      <Check size={12} className="text-emerald-600" />
                    </div>
                  ) : (
                    <div className="px-2 py-0.5 text-slate-400 text-[9px]">بدون شام</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
