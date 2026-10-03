import { z } from 'zod';
import { serverQueryCollection, serverSaveDoc, authorizeCollectionAccess } from '../lib/serverDataApi';
import { AppError } from '../lib/errorHandler';
import { logServerAudit } from '../lib/serverAuth';
import { logger } from '../lib/logger';
import { LockerItem, LockerStatus, LockerDefectType } from '../types';

export const AssignLockerSchema = z.object({
  studentId: z.string().min(1, 'شناسه طلبه الزامی است.'),
  studentName: z.string().min(1, 'نام طلبه الزامی است.'),
  studentCode: z.string().optional(),
  grade: z.string().optional(),
  phoneNumber: z.string().optional()
});

export const ReportDefectSchema = z.object({
  defectType: z.enum(['lost_key', 'broken', 'other']).default('broken'),
  defectDescription: z.string().min(2, 'شرح نقص یا خرابی الزامی است.')
});

export class LockerService {
  /**
   * Fetch all lockers
   */
  public static async getAllLockers(callerUser?: any): Promise<LockerItem[]> {
    const authCheck = authorizeCollectionAccess(callerUser, 'lockers', 'read');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما دسترسی به مدیریت کمدها را ندارید.', { statusCode: 403 });
    }

    const items = await serverQueryCollection('lockers', callerUser);
    return Array.isArray(items) ? (items as LockerItem[]) : [];
  }

  /**
   * Fetch single locker by number
   */
  public static async getLockerByNumber(lockerNumber: number, callerUser?: any): Promise<LockerItem> {
    const lockers = await this.getAllLockers(callerUser);
    const locker = lockers.find(l => l.lockerNumber === lockerNumber);
    if (!locker) {
      throw new AppError(`کمد شماره ${lockerNumber} یافت نشد.`, { statusCode: 404 });
    }
    return locker;
  }

  /**
   * Assign locker to a student
   */
  public static async assignLocker(
    lockerNumber: number,
    assignData: { studentId: string; studentName: string; studentCode?: string; grade?: string; phoneNumber?: string },
    callerUser?: any
  ): Promise<LockerItem> {
    const authCheck = authorizeCollectionAccess(callerUser, 'lockers', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز تخصیص کمد را ندارید.', { statusCode: 403 });
    }

    const locker = await this.getLockerByNumber(lockerNumber, callerUser);
    if (locker.status === 'occupied') {
      throw new AppError(`کمد شماره ${lockerNumber} در حال حاضر توسط طلبه «${locker.studentName}» اشغال است.`, { statusCode: 409 });
    }

    const nowIso = new Date().toISOString();
    const updated: LockerItem = {
      ...locker,
      status: 'occupied',
      studentId: assignData.studentId,
      studentName: assignData.studentName.trim(),
      studentCode: assignData.studentCode,
      grade: assignData.grade,
      phoneNumber: assignData.phoneNumber,
      assignedDate: new Date().toLocaleDateString('fa-IR'),
      updatedAt: nowIso,
      updatedBy: callerUser?.username || 'system'
    };

    await serverSaveDoc('lockers', updated, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'ASSIGN_LOCKER',
      entityType: 'locker',
      entityId: String(lockerNumber),
      description: `واگذاری کمد شماره ${lockerNumber} به طلبه: ${assignData.studentName}`
    });

    return updated;
  }

  /**
   * Vacate / Release a locker
   */
  public static async vacateLocker(lockerNumber: number, callerUser?: any): Promise<LockerItem> {
    const authCheck = authorizeCollectionAccess(callerUser, 'lockers', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز تحویل یا تخلیه کمد را ندارید.', { statusCode: 403 });
    }

    const locker = await this.getLockerByNumber(lockerNumber, callerUser);
    const previousStudent = locker.studentName || 'نامشخص';

    const updated: LockerItem = {
      ...locker,
      status: 'vacant',
      studentId: undefined,
      studentName: undefined,
      studentCode: undefined,
      grade: undefined,
      phoneNumber: undefined,
      assignedDate: undefined,
      updatedAt: new Date().toISOString(),
      updatedBy: callerUser?.username || 'system'
    };

    await serverSaveDoc('lockers', updated, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'VACATE_LOCKER',
      entityType: 'locker',
      entityId: String(lockerNumber),
      description: `تخلیه و تحویل کمد شماره ${lockerNumber} (طلبه قبلی: ${previousStudent})`
    });

    return updated;
  }

  /**
   * Report a defect or broken key for a locker
   */
  public static async reportDefect(
    lockerNumber: number,
    defectType: LockerDefectType,
    description: string,
    callerUser?: any
  ): Promise<LockerItem> {
    const locker = await this.getLockerByNumber(lockerNumber, callerUser);
    const updated: LockerItem = {
      ...locker,
      status: 'defective',
      defectType,
      defectDescription: description,
      reportedAt: new Date().toLocaleDateString('fa-IR'),
      updatedAt: new Date().toISOString(),
      updatedBy: callerUser?.username || 'system'
    };

    await serverSaveDoc('lockers', updated, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'REPORT_LOCKER_DEFECT',
      entityType: 'locker',
      entityId: String(lockerNumber),
      description: `گزارش خرابی کمد شماره ${lockerNumber} (${defectType}): ${description}`
    });

    return updated;
  }

  /**
   * Resolve defect and set locker back to vacant (or occupied)
   */
  public static async resolveDefect(
    lockerNumber: number,
    repairNotes?: string,
    callerUser?: any
  ): Promise<LockerItem> {
    const authCheck = authorizeCollectionAccess(callerUser, 'lockers', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز رفع نقص کمد را ندارید.', { statusCode: 403 });
    }

    const locker = await this.getLockerByNumber(lockerNumber, callerUser);
    const updated: LockerItem = {
      ...locker,
      status: locker.studentId ? 'occupied' : 'vacant',
      defectType: undefined,
      defectDescription: undefined,
      repairNotes: repairNotes || 'تعمیر یا تعویض قفل انجام شد.',
      updatedAt: new Date().toISOString(),
      updatedBy: callerUser?.username || 'system'
    };

    await serverSaveDoc('lockers', updated, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'RESOLVE_LOCKER_DEFECT',
      entityType: 'locker',
      entityId: String(lockerNumber),
      description: `رفع نقص و تعمیر کمد شماره ${lockerNumber}`
    });

    return updated;
  }
}
