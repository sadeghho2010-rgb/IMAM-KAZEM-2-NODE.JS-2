import { z } from 'zod';
import { serverQueryCollection, serverSaveDoc, authorizeCollectionAccess } from '../lib/serverDataApi';
import { AppError } from '../lib/errorHandler';
import { logServerAudit } from '../lib/serverAuth';
import { logger } from '../lib/logger';
import { MealReservationPeriod, StudentMealReservation, MealCancelledDay } from '../types';

export const MealPeriodSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2, 'عنوان دوره رزرو غذا الزامی است.'),
  startDate: z.string().min(1, 'تاریخ شروع الزامی است.'),
  endDate: z.string().min(1, 'تاریخ پایان الزامی است.'),
  isActive: z.boolean().default(true),
  lunchPrice: z.number().nonnegative().optional(),
  dinnerPrice: z.number().nonnegative().optional()
});

export const StudentReservationSchema = z.object({
  id: z.string().optional(),
  periodId: z.string().min(1, 'شناسه دوره الزامی است.'),
  studentId: z.string().min(1, 'شناسه طلبه الزامی است.'),
  studentName: z.string().min(1, 'نام طلبه الزامی است.'),
  studentGrade: z.string().optional(),
  selectedLunchDays: z.array(z.string()).default([]),
  selectedDinnerDays: z.array(z.string()).default([]),
  notes: z.string().optional()
});

export const MealCancelledDaySchema = z.object({
  id: z.string().optional(),
  date: z.string().min(1, 'تاریخ تعطیلی وعده الزامی است.'),
  mealType: z.enum(['lunch', 'dinner', 'both']).default('both'),
  reason: z.string().min(2, 'علت عدم طبخ یا توزیع غذا الزامی است.')
});

export class MealService {
  public static async getAllPeriods(callerUser?: any): Promise<MealReservationPeriod[]> {
    const authCheck = authorizeCollectionAccess(callerUser, 'meal_periods', 'read');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما دسترسی به ماژول تغذیه را ندارید.', { statusCode: 403 });
    }

    const items = await serverQueryCollection('meal_periods', callerUser);
    return Array.isArray(items) ? (items as MealReservationPeriod[]) : [];
  }

  public static async savePeriod(rawData: unknown, callerUser?: any): Promise<MealReservationPeriod> {
    const authCheck = authorizeCollectionAccess(callerUser, 'meal_periods', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز تعریف دوره تغذیه را ندارید.', { statusCode: 403 });
    }

    const parsed = MealPeriodSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || 'اطلاعات دوره تغذیه نامعتبر است.';
      throw new AppError(errorMsg, { statusCode: 400 });
    }

    const validData = parsed.data;
    const id = validData.id || `meal_p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const record: MealReservationPeriod = {
      id,
      title: validData.title.trim(),
      startDate: validData.startDate,
      endDate: validData.endDate,
      enableLunch: true,
      enableDinner: true,
      lunchPrice: validData.lunchPrice || 45000,
      dinnerPrice: validData.dinnerPrice || 35000,
      status: validData.isActive ? 'open' : 'closed',
      lunchDisabledDays: ['جمعه'],
      dinnerDisabledDays: ['جمعه'],
      createdAt: (rawData as any)?.createdAt || nowIso
    };

    await serverSaveDoc('meal_periods', record, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: validData.id ? 'UPDATE_MEAL_PERIOD' : 'CREATE_MEAL_PERIOD',
      entityType: 'meal_period',
      entityId: id,
      description: `ثبت دوره رزرو وعده‌های غذایی: ${record.title}`,
      newState: record as unknown as Record<string, unknown>
    });

    return record;
  }

  public static async getStudentReservations(studentId?: string, periodId?: string, callerUser?: any): Promise<StudentMealReservation[]> {
    const items = await serverQueryCollection('student_meal_reservations', callerUser);
    let reservations = Array.isArray(items) ? (items as StudentMealReservation[]) : [];
    if (studentId) reservations = reservations.filter(r => r.studentId === studentId);
    if (periodId) reservations = reservations.filter(r => r.periodId === periodId);
    return reservations;
  }

  public static async saveReservation(rawData: unknown, callerUser?: any): Promise<StudentMealReservation> {
    const authCheck = authorizeCollectionAccess(callerUser, 'student_meal_reservations', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز ثبت یا ویرایش رزرو غذا را ندارید.', { statusCode: 403 });
    }

    const parsed = StudentReservationSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || 'اطلاعات رزرو نامعتبر است.';
      throw new AppError(errorMsg, { statusCode: 400 });
    }

    const validData = parsed.data;
    const id = validData.id || `res_${validData.periodId}_${validData.studentId}`;
    const nowIso = new Date().toISOString();

    const lunchCount = validData.selectedLunchDays.length;
    const dinnerCount = validData.selectedDinnerDays.length;
    const totalLunchCost = lunchCount * 45000;
    const totalDinnerCost = dinnerCount * 35000;
    const totalMealCost = totalLunchCost + totalDinnerCost;

    const record: StudentMealReservation = {
      id,
      periodId: validData.periodId,
      studentId: validData.studentId,
      studentName: validData.studentName.trim(),
      grade: validData.studentGrade,
      selectedLunchDays: validData.selectedLunchDays,
      selectedDinnerDays: validData.selectedDinnerDays,
      dinnerLocation: 'institute',
      totalCalculatedLunches: lunchCount,
      totalCalculatedDinners: dinnerCount,
      totalLunchCost,
      totalDinnerCost,
      totalMealCost,
      finalDeductionAmount: totalMealCost,
      notes: validData.notes,
      updatedAt: nowIso
    };

    await serverSaveDoc('student_meal_reservations', record, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'SAVE_MEAL_RESERVATION',
      entityType: 'meal_reservation',
      entityId: id,
      description: `ثبت رزرو غذا برای طلبه ${record.studentName} (نهار: ${lunchCount} روز، شام: ${dinnerCount} روز)`
    });

    return record;
  }

  public static async getMealCancelledDays(callerUser?: any): Promise<MealCancelledDay[]> {
    const items = await serverQueryCollection('meal_cancelled_days', callerUser);
    return Array.isArray(items) ? (items as MealCancelledDay[]) : [];
  }

  public static async saveMealCancelledDay(rawData: unknown, callerUser?: any): Promise<MealCancelledDay> {
    const authCheck = authorizeCollectionAccess(callerUser, 'meal_cancelled_days', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز ثبت تعطیلی پخت غذا را ندارید.', { statusCode: 403 });
    }

    const parsed = MealCancelledDaySchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || 'اطلاعات وارد شده نامعتبر است.';
      throw new AppError(errorMsg, { statusCode: 400 });
    }

    const validData = parsed.data;
    const id = validData.id || `canc_m_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const record: MealCancelledDay = {
      id,
      date: validData.date,
      mealType: validData.mealType,
      reason: validData.reason.trim(),
      registeredAt: nowIso,
      registeredByName: callerUser?.username || 'system'
    };

    await serverSaveDoc('meal_cancelled_days', record, callerUser);
    return record;
  }

  public static async getDailyKitchenStats(date: string, callerUser?: any) {
    const allReservations = await this.getStudentReservations(undefined, undefined, callerUser);
    const cancelledDays = await this.getMealCancelledDays(callerUser);

    const isDayCancelled = cancelledDays.find(c => c.date === date);

    let lunchPortions = 0;
    let dinnerPortions = 0;
    const beneficiaries: Array<{ studentName: string; grade?: string; lunch: boolean; dinner: boolean }> = [];

    allReservations.forEach(r => {
      const hasLunch = r.selectedLunchDays.includes(date);
      const hasDinner = r.selectedDinnerDays.includes(date);
      if (hasLunch || hasDinner) {
        if (hasLunch) lunchPortions++;
        if (hasDinner) dinnerPortions++;
        beneficiaries.push({
          studentName: r.studentName,
          grade: r.grade,
          lunch: hasLunch,
          dinner: hasDinner
        });
      }
    });

    return {
      date,
      isCancelled: Boolean(isDayCancelled),
      cancellationReason: isDayCancelled?.reason,
      cancelledMealType: isDayCancelled?.mealType,
      totalLunchPortions: isDayCancelled?.mealType === 'lunch' || isDayCancelled?.mealType === 'both' ? 0 : lunchPortions,
      totalDinnerPortions: isDayCancelled?.mealType === 'dinner' || isDayCancelled?.mealType === 'both' ? 0 : dinnerPortions,
      beneficiaries
    };
  }
}
