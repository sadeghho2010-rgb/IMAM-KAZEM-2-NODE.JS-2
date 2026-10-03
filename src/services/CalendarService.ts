import { z } from 'zod';
import { serverQueryCollection, serverSaveDoc, serverDeleteDoc, authorizeCollectionAccess } from '../lib/serverDataApi';
import { AppError } from '../lib/errorHandler';
import { logServerAudit } from '../lib/serverAuth';
import { logger } from '../lib/logger';
import { AcademicCalendarPeriod, AcademicHolidayItem, AcademicWeeklyProgram } from '../types';

export const CalendarPeriodSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2, 'عنوان سال یا ترم تحصیلی الزامی است.'),
  startDate: z.string().min(1, 'تاریخ شروع الزامی است.'),
  endDate: z.string().min(1, 'تاریخ پایان الزامی است.'),
  description: z.string().optional(),
  defaultThursdayMode: z.enum(['special_program', 'main_class', 'off']).default('off'),
  includeFridayAsStudyDay: z.boolean().default(false)
});

export const HolidaySchema = z.object({
  id: z.string().optional(),
  periodId: z.string().min(1, 'شناسه دوره الزامی است.'),
  title: z.string().min(2, 'عنوان تعطیلی الزامی است.'),
  typeId: z.string().default('official'),
  typeName: z.string().default('تعطیلی رسمی'),
  startDate: z.string().min(1, 'تاریخ شروع تعطیلی الزامی است.'),
  endDate: z.string().min(1, 'تاریخ پایان تعطیلی الزامی است.'),
  description: z.string().optional()
});

export const WeeklyProgramSchema = z.object({
  id: z.string().optional(),
  periodId: z.string().min(1, 'شناسه دوره الزامی است.'),
  title: z.string().min(2, 'عنوان برنامه هفتگی الزامی است.'),
  dayOfWeek: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  time: z.string().optional(),
  locationOrTeacher: z.string().optional(),
  grade: z.string().optional(),
  isPublic: z.boolean().default(true),
  description: z.string().optional(),
  color: z.string().optional()
});

export class CalendarService {
  public static async getAllPeriods(callerUser?: any): Promise<AcademicCalendarPeriod[]> {
    const authCheck = authorizeCollectionAccess(callerUser, 'academic_calendar_periods', 'read');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما دسترسی به تقویم آموزشی را ندارید.', { statusCode: 403 });
    }

    const items = await serverQueryCollection('academic_calendar_periods', callerUser);
    return Array.isArray(items) ? (items as AcademicCalendarPeriod[]) : [];
  }

  public static async getPeriodById(id: string, callerUser?: any): Promise<AcademicCalendarPeriod> {
    const periods = await this.getAllPeriods(callerUser);
    const period = periods.find(p => p.id === id);
    if (!period) {
      throw new AppError('دوره تقویم آموزشی یافت نشد.', { statusCode: 404 });
    }
    return period;
  }

  public static async savePeriod(rawData: unknown, callerUser?: any): Promise<AcademicCalendarPeriod> {
    const authCheck = authorizeCollectionAccess(callerUser, 'academic_calendar_periods', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز تعریف دوره تقویم آموزشی را ندارید.', { statusCode: 403 });
    }

    const parsed = CalendarPeriodSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || 'اطلاعات وارد شده نامعتبر است.';
      throw new AppError(errorMsg, { statusCode: 400 });
    }

    const validData = parsed.data;
    const id = validData.id || `cal_p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const record: AcademicCalendarPeriod = {
      id,
      title: validData.title.trim(),
      startDate: validData.startDate,
      endDate: validData.endDate,
      description: validData.description?.trim(),
      defaultThursdayMode: validData.defaultThursdayMode,
      includeFridayAsStudyDay: validData.includeFridayAsStudyDay,
      createdAt: (rawData as any)?.createdAt || nowIso,
      updatedAt: nowIso
    };

    await serverSaveDoc('academic_calendar_periods', record, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: validData.id ? 'UPDATE_CALENDAR_PERIOD' : 'CREATE_CALENDAR_PERIOD',
      entityType: 'calendar_period',
      entityId: id,
      description: `ثبت دوره تقویم آموزشی: ${record.title}`,
      newState: record as unknown as Record<string, unknown>
    });

    return record;
  }

  public static async getAllHolidays(periodId?: string, callerUser?: any): Promise<AcademicHolidayItem[]> {
    const items = await serverQueryCollection('academic_calendar_holidays', callerUser);
    const holidays = Array.isArray(items) ? (items as AcademicHolidayItem[]) : [];
    return periodId ? holidays.filter(h => h.periodId === periodId) : holidays;
  }

  public static async saveHoliday(rawData: unknown, callerUser?: any): Promise<AcademicHolidayItem> {
    const authCheck = authorizeCollectionAccess(callerUser, 'academic_calendar_holidays', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز ثبت تعطیلی را ندارید.', { statusCode: 403 });
    }

    const parsed = HolidaySchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || 'اطلاعات وارد شده نامعتبر است.';
      throw new AppError(errorMsg, { statusCode: 400 });
    }

    const validData = parsed.data;
    const id = validData.id || `hol_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const record: AcademicHolidayItem = {
      id,
      periodId: validData.periodId,
      title: validData.title.trim(),
      typeId: validData.typeId,
      typeName: validData.typeName,
      startDate: validData.startDate,
      endDate: validData.endDate,
      description: validData.description?.trim(),
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await serverSaveDoc('academic_calendar_holidays', record, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'SAVE_HOLIDAY',
      entityType: 'holiday',
      entityId: id,
      description: `ثبت تعطیلی در تقویم: ${record.title} (${record.startDate})`
    });

    return record;
  }

  public static async deleteHoliday(id: string, callerUser?: any): Promise<boolean> {
    const authCheck = authorizeCollectionAccess(callerUser, 'academic_calendar_holidays', 'delete');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز حذف تعطیلی را ندارید.', { statusCode: 403 });
    }

    await serverDeleteDoc('academic_calendar_holidays', id, callerUser);
    return true;
  }

  public static async getAllWeeklyPrograms(periodId?: string, callerUser?: any): Promise<AcademicWeeklyProgram[]> {
    const items = await serverQueryCollection('academic_calendar_weekly_programs', callerUser);
    const programs = Array.isArray(items) ? (items as AcademicWeeklyProgram[]) : [];
    return periodId ? programs.filter(p => p.periodId === periodId) : programs;
  }

  public static async saveWeeklyProgram(rawData: unknown, callerUser?: any): Promise<AcademicWeeklyProgram> {
    const authCheck = authorizeCollectionAccess(callerUser, 'academic_calendar_weekly_programs', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز ثبت برنامه هفتگی تقویم را ندارید.', { statusCode: 403 });
    }

    const parsed = WeeklyProgramSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || 'اطلاعات برنامه هفتگی نامعتبر است.';
      throw new AppError(errorMsg, { statusCode: 400 });
    }

    const validData = parsed.data;
    const id = validData.id || `wp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const record: AcademicWeeklyProgram = {
      id,
      periodId: validData.periodId,
      title: validData.title.trim(),
      dayOfWeek: validData.dayOfWeek,
      startDate: validData.startDate || '',
      endDate: validData.endDate || '',
      time: validData.time,
      locationOrTeacher: validData.locationOrTeacher,
      grade: validData.grade,
      isPublic: validData.isPublic,
      description: validData.description?.trim(),
      color: validData.color,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await serverSaveDoc('academic_calendar_weekly_programs', record, callerUser);
    return record;
  }

  public static async deleteWeeklyProgram(id: string, callerUser?: any): Promise<boolean> {
    const authCheck = authorizeCollectionAccess(callerUser, 'academic_calendar_weekly_programs', 'delete');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز حذف برنامه هفتگی را ندارید.', { statusCode: 403 });
    }

    await serverDeleteDoc('academic_calendar_weekly_programs', id, callerUser);
    return true;
  }
}
