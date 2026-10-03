import { z } from 'zod';
import { serverQueryCollection, serverSaveDoc, serverDeleteDoc, authorizeCollectionAccess } from '../lib/serverDataApi';
import { AppError } from '../lib/errorHandler';
import { logServerAudit } from '../lib/serverAuth';
import { logger } from '../lib/logger';
import { OralExamPeriod, OralExamStudentRecord } from '../types';

export const OralExamPeriodSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2, 'عنوان دوره آزمون شفاهی الزامی است.'),
  academicYear: z.string().optional(),
  grade: z.string().min(1, 'پایه تحصیلی الزامی است.'),
  hasUsul: z.boolean().default(true),
  usulBooks: z.array(z.string()).default([]),
  hasFiqh: z.boolean().default(true),
  fiqhBooks: z.array(z.string()).default([]),
  examDates: z.array(z.string()).optional(),
  examinerTeacherIds: z.array(z.string()).default([]),
  examinerTeacherNames: z.array(z.string()).default([]),
  status: z.enum(['draft', 'scheduled', 'conducting', 'finalized', 'archived']).default('draft'),
  notes: z.string().optional()
});

export const StudentExamRecordSchema = z.object({
  id: z.string().optional(),
  periodId: z.string().min(1, 'شناسه دوره آزمون الزامی است.'),
  studentId: z.string().min(1, 'شناسه طلبه الزامی است.'),
  studentName: z.string().min(1, 'نام طلبه الزامی است.'),
  grade: z.string().optional(),
  nationalId: z.string().optional(),
  phone: z.string().optional(),
  examTime: z.string().optional(),
  
  // Fiqh
  fiqhExaminerTeacherName: z.string().optional(),
  fiqhBookTitle: z.string().optional(),
  fiqhScore: z.number().nullable().optional(),
  fiqhTextMastery: z.number().optional(),
  fiqhExplanationMastery: z.number().optional(),
  fiqhExaminerNotes: z.string().optional(),
  fiqhIsRetake: z.boolean().optional(),

  // Usul
  usulExaminerTeacherName: z.string().optional(),
  usulBookTitle: z.string().optional(),
  usulScore: z.number().nullable().optional(),
  usulTextMastery: z.number().optional(),
  usulExplanationMastery: z.number().optional(),
  usulExaminerNotes: z.string().optional(),
  usulIsRetake: z.boolean().optional(),

  overallStatus: z.enum(['passed', 'failed', 'retake', 'absent', 'pending']).optional(),
  status: z.enum(['draft', 'finalized']).default('draft')
});

export class OralExamService {
  /**
   * Fetch all oral exam periods
   */
  public static async getAllPeriods(callerUser?: any): Promise<OralExamPeriod[]> {
    const authCheck = authorizeCollectionAccess(callerUser, 'oral_exam_periods', 'read');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما دسترسی به آزمون‌های شفاهی را ندارید.', { statusCode: 403 });
    }

    const items = await serverQueryCollection('oral_exam_periods', callerUser);
    return Array.isArray(items) ? (items as OralExamPeriod[]) : [];
  }

  /**
   * Fetch single oral exam period by ID
   */
  public static async getPeriodById(id: string, callerUser?: any): Promise<OralExamPeriod> {
    const periods = await this.getAllPeriods(callerUser);
    const period = periods.find(p => p.id === id);
    if (!period) {
      throw new AppError('دوره آزمون شفاهی مورد نظر یافت نشد.', { statusCode: 404 });
    }
    return period;
  }

  /**
   * Save an oral exam period
   */
  public static async savePeriod(rawData: unknown, callerUser?: any): Promise<OralExamPeriod> {
    const authCheck = authorizeCollectionAccess(callerUser, 'oral_exam_periods', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز تعریف دوره آزمون شفاهی را ندارید.', { statusCode: 403 });
    }

    const parsed = OralExamPeriodSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || 'اطلاعات وارد شده نامعتبر است.';
      throw new AppError(errorMsg, { statusCode: 400 });
    }

    const validData = parsed.data;
    const id = validData.id || `oral_p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const periodRecord: OralExamPeriod = {
      id,
      title: validData.title.trim(),
      academicYear: validData.academicYear,
      grade: validData.grade,
      hasUsul: validData.hasUsul,
      usulBooks: validData.usulBooks,
      hasFiqh: validData.hasFiqh,
      fiqhBooks: validData.fiqhBooks,
      examDates: validData.examDates || [],
      examinerTeacherIds: validData.examinerTeacherIds,
      examinerTeacherNames: validData.examinerTeacherNames,
      hasCustomScopes: false,
      scopes: [],
      participatingStudentIds: (rawData as any)?.participatingStudentIds || [],
      status: validData.status,
      notes: validData.notes,
      createdAt: (rawData as any)?.createdAt || nowIso
    };

    await serverSaveDoc('oral_exam_periods', periodRecord, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: validData.id ? 'UPDATE_ORAL_EXAM_PERIOD' : 'CREATE_ORAL_EXAM_PERIOD',
      entityType: 'oral_exam_period',
      entityId: id,
      description: `تعریف دوره آزمون شفاهی: ${periodRecord.title} (${periodRecord.grade})`,
      newState: periodRecord as unknown as Record<string, unknown>
    });

    return periodRecord;
  }

  /**
   * Fetch exam evaluation records for a period
   */
  public static async getRecordsByPeriod(periodId: string, callerUser?: any): Promise<OralExamStudentRecord[]> {
    const items = await serverQueryCollection('oral_exam_student_records', callerUser);
    const records = Array.isArray(items) ? (items as OralExamStudentRecord[]) : [];
    return records.filter(r => r.periodId === periodId);
  }

  /**
   * Save student exam score record
   */
  public static async saveStudentRecord(rawData: unknown, callerUser?: any): Promise<OralExamStudentRecord> {
    const authCheck = authorizeCollectionAccess(callerUser, 'oral_exam_student_records', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز ثبت نمرات آزمون شفاهی را ندارید.', { statusCode: 403 });
    }

    const parsed = StudentExamRecordSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || 'اطلاعات نمرات نامعتبر است.';
      throw new AppError(errorMsg, { statusCode: 400 });
    }

    const validData = parsed.data;
    const id = validData.id || `${validData.periodId}_${validData.studentId}`;
    const nowIso = new Date().toISOString();

    const record: OralExamStudentRecord = {
      id,
      periodId: validData.periodId,
      studentId: validData.studentId,
      studentName: validData.studentName.trim(),
      grade: validData.grade,
      nationalId: validData.nationalId,
      phone: validData.phone,
      examTime: validData.examTime,
      
      fiqhExaminerTeacherName: validData.fiqhExaminerTeacherName,
      fiqhBookTitle: validData.fiqhBookTitle,
      fiqhScore: validData.fiqhScore,
      fiqhTextMastery: validData.fiqhTextMastery,
      fiqhExplanationMastery: validData.fiqhExplanationMastery,
      fiqhExaminerNotes: validData.fiqhExaminerNotes,
      fiqhIsRetake: validData.fiqhIsRetake,

      usulExaminerTeacherName: validData.usulExaminerTeacherName,
      usulBookTitle: validData.usulBookTitle,
      usulScore: validData.usulScore,
      usulTextMastery: validData.usulTextMastery,
      usulExplanationMastery: validData.usulExplanationMastery,
      usulExaminerNotes: validData.usulExaminerNotes,
      usulIsRetake: validData.usulIsRetake,

      overallStatus: validData.overallStatus || (
        (validData.fiqhScore !== null && validData.fiqhScore !== undefined && validData.fiqhScore < 12) ||
        (validData.usulScore !== null && validData.usulScore !== undefined && validData.usulScore < 12)
          ? 'retake'
          : 'passed'
      ),
      status: validData.status,
      updatedAt: nowIso
    };

    await serverSaveDoc('oral_exam_student_records', record, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'SAVE_ORAL_EXAM_SCORE',
      entityType: 'oral_exam_record',
      entityId: id,
      description: `ثبت نمرات آزمون شفاهی طلبه ${record.studentName} (فقه: ${record.fiqhScore ?? '-'}، اصول: ${record.usulScore ?? '-'})`
    });

    return record;
  }

  /**
   * Generate comprehensive oral exam report for a period
   */
  public static async getExamReport(periodId: string, callerUser?: any) {
    const period = await this.getPeriodById(periodId, callerUser);
    const records = await this.getRecordsByPeriod(periodId, callerUser);

    let passedCount = 0;
    let failedCount = 0;
    let retakeCount = 0;
    let totalFiqh = 0;
    let fiqhCount = 0;
    let totalUsul = 0;
    let usulCount = 0;

    records.forEach(r => {
      if (r.overallStatus === 'passed') passedCount++;
      else if (r.overallStatus === 'failed') failedCount++;
      else if (r.overallStatus === 'retake') retakeCount++;

      if (typeof r.fiqhScore === 'number') {
        totalFiqh += r.fiqhScore;
        fiqhCount++;
      }
      if (typeof r.usulScore === 'number') {
        totalUsul += r.usulScore;
        usulCount++;
      }
    });

    return {
      periodId,
      periodTitle: period.title,
      grade: period.grade,
      totalStudents: records.length,
      passedCount,
      failedCount,
      retakeCount,
      averageFiqhScore: fiqhCount > 0 ? Number((totalFiqh / fiqhCount).toFixed(2)) : null,
      averageUsulScore: usulCount > 0 ? Number((totalUsul / usulCount).toFixed(2)) : null,
      records
    };
  }
}
