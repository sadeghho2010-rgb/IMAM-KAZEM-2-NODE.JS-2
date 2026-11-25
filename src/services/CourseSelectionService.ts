import { z } from 'zod';
import {
  serverQueryCollection,
  serverSaveDoc,
  authorizeCollectionAccess,
  isStudentLevelUser,
  resolveAuthoritativeStudentIdentity,
  getRawExistingDocById
} from '../lib/serverDataApi';
import { AppError } from '../lib/errorHandler';
import { logServerAudit } from '../lib/serverAuth';
import { logger } from '../lib/logger';
import { CourseSelectionPeriod, CourseSelectionRequest, ProgramType } from '../types';

export const CourseSelectionPeriodSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2, 'عنوان دوره انتخاب واحد الزامی است.'),
  academicYear: z.string().optional(),
  term: z.string().optional(),
  allowedProgramTypes: z.array(z.string()).default(['اصلی', 'مشاوره']),
  allowedGrades: z.array(z.string()).default([]),
  startDate: z.string().min(1, 'تاریخ شروع انتخاب واحد الزامی است.'),
  endDate: z.string().min(1, 'تاریخ پایان انتخاب واحد الزامی است.'),
  isActive: z.boolean().default(true),
  allowCrossGradeSelection: z.boolean().default(true),
  description: z.string().optional()
});

export const SubmitCourseSelectionSchema = z.object({
  id: z.string().optional(),
  periodId: z.string().min(1, 'شناسه دوره الزامی است.'),
  periodTitle: z.string().min(1, 'عنوان دوره الزامی است.'),
  studentId: z.string().min(1, 'شناسه طلبه الزامی است.'),
  studentName: z.string().min(1, 'نام طلبه الزامی است.'),
  studentGrade: z.string().min(1, 'پایه طلبه الزامی است.'),
  nationalId: z.string().optional(),
  selectedCourses: z.array(z.object({
    programId: z.string(),
    programTitle: z.string(),
    programType: z.string(),
    teacherName: z.string().optional(),
    teacherPhone: z.string().optional(),
    day: z.string().optional(),
    time: z.string().optional(),
    madrasRoom: z.string().optional(),
    grade: z.string().optional()
  })).min(1, 'حداقل باید یک درس انتخاب شود.')
});

export class CourseSelectionService {
  public static async getAllPeriods(callerUser?: any): Promise<CourseSelectionPeriod[]> {
    const authCheck = authorizeCollectionAccess(callerUser, 'course_selection_periods', 'read');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما دسترسی به دوره‌های انتخاب واحد را ندارید.', { statusCode: 403 });
    }

    const items = await serverQueryCollection('course_selection_periods', callerUser);
    return Array.isArray(items) ? (items as CourseSelectionPeriod[]) : [];
  }

  public static async savePeriod(rawData: unknown, callerUser?: any): Promise<CourseSelectionPeriod> {
    const authCheck = authorizeCollectionAccess(callerUser, 'course_selection_periods', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز تعریف دوره انتخاب واحد را ندارید.', { statusCode: 403 });
    }

    const parsed = CourseSelectionPeriodSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || 'اطلاعات دوره انتخاب واحد نامعتبر است.';
      throw new AppError(errorMsg, { statusCode: 400 });
    }

    const valid = parsed.data;
    const id = valid.id || `cs_period_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const record: CourseSelectionPeriod = {
      id,
      title: valid.title.trim(),
      academicYear: valid.academicYear,
      term: valid.term,
      allowedProgramTypes: valid.allowedProgramTypes as ProgramType[],
      allowedGrades: valid.allowedGrades,
      startDate: valid.startDate,
      endDate: valid.endDate,
      isActive: valid.isActive,
      allowCrossGradeSelection: valid.allowCrossGradeSelection,
      description: valid.description?.trim(),
      createdAt: (rawData as any)?.createdAt || nowIso,
      createdByUserName: callerUser?.username || 'system',
      updatedAt: nowIso
    };

    await serverSaveDoc('course_selection_periods', record, callerUser);
    return record;
  }

  public static async getAllRequests(periodId?: string, callerUser?: any): Promise<CourseSelectionRequest[]> {
    const authCheck = authorizeCollectionAccess(callerUser, 'course_selection_requests', 'read');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما دسترسی به درخواست‌های انتخاب واحد را ندارید.', { statusCode: 403 });
    }

    const items = await serverQueryCollection('course_selection_requests', callerUser);
    let requests = Array.isArray(items) ? (items as CourseSelectionRequest[]) : [];
    if (isStudentLevelUser(callerUser)) {
      const identity = await resolveAuthoritativeStudentIdentity(callerUser);
      requests = requests.filter(r => identity.candidates.includes(String(r.studentId || '').trim().toLowerCase()));
    }
    if (periodId) requests = requests.filter(r => r.periodId === periodId);
    return requests;
  }

  public static async getRequestByStudent(studentId: string, periodId?: string, callerUser?: any): Promise<CourseSelectionRequest | null> {
    if (isStudentLevelUser(callerUser)) {
      const identity = await resolveAuthoritativeStudentIdentity(callerUser);
      if (studentId && !identity.candidates.includes(String(studentId).trim().toLowerCase())) {
        throw new AppError('شما تنها مجاز به مشاهده انتخاب واحد خود هستید.', { statusCode: 403 });
      }
      const requests = await this.getAllRequests(periodId, callerUser);
      return requests.find(r => identity.candidates.includes(String(r.studentId || '').trim().toLowerCase())) || null;
    }

    const requests = await this.getAllRequests(periodId, callerUser);
    return requests.find(r => r.studentId === studentId) || null;
  }

  public static async submitCourseSelection(rawData: unknown, callerUser?: any): Promise<CourseSelectionRequest> {
    const authCheck = authorizeCollectionAccess(callerUser, 'course_selection_requests', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز ثبت فرم انتخاب واحد را ندارید.', { statusCode: 403 });
    }

    const parsed = SubmitCourseSelectionSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || 'اطلاعات فرم انتخاب واحد نامعتبر است.';
      throw new AppError(errorMsg, { statusCode: 400 });
    }

    const valid = parsed.data;
    const isStudent = isStudentLevelUser(callerUser);
    const identity = isStudent ? await resolveAuthoritativeStudentIdentity(callerUser) : null;

    const effectiveStudentId = isStudent && identity?.studentId ? identity.studentId : valid.studentId;
    const effectiveStudentName = isStudent && identity?.studentName ? identity.studentName : valid.studentName.trim();
    const effectiveNationalId = isStudent && identity?.nationalCode ? identity.nationalCode : valid.nationalId;

    let id = valid.id || `cs_req_${valid.periodId}_${effectiveStudentId}`;
    if (isStudent && valid.id) {
      const existing = await getRawExistingDocById('course_selection_requests', valid.id);
      if (existing && !identity!.candidates.includes(String(existing.studentId || '').trim().toLowerCase())) {
        throw new AppError('شما مجاز به تغییر فرم انتخاب واحد طلبه دیگر نیستید.', { statusCode: 403 });
      }
      if (!existing && valid.id.startsWith(`cs_req_${valid.periodId}_`)) {
        const suffix = valid.id.slice(`cs_req_${valid.periodId}_`.length).trim().toLowerCase();
        if (!identity!.candidates.includes(suffix)) {
          id = `cs_req_${valid.periodId}_${effectiveStudentId}`;
        }
      }
    }

    const nowIso = new Date().toISOString();

    const record: CourseSelectionRequest = {
      id,
      periodId: valid.periodId,
      periodTitle: valid.periodTitle,
      studentId: effectiveStudentId,
      studentName: effectiveStudentName,
      studentGrade: valid.studentGrade,
      nationalId: effectiveNationalId,
      selectedCourses: valid.selectedCourses as any,
      status: 'pending',
      submittedAt: nowIso
    };

    await serverSaveDoc('course_selection_requests', record, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'SUBMIT_COURSE_SELECTION',
      entityType: 'course_selection',
      entityId: id,
      description: `ثبت فرم انتخاب واحد برای طلبه: ${record.studentName} (${record.selectedCourses.length} درس)`
    });

    return record;
  }

  public static async reviewRequest(
    id: string,
    status: 'approved' | 'rejected',
    adminNotes?: string,
    callerUser?: any
  ): Promise<CourseSelectionRequest> {
    if (!callerUser || isStudentLevelUser(callerUser)) {
      throw new AppError('طلبه مجاز به تایید یا رد انتخاب واحد نیست.', { statusCode: 403 });
    }

    const authCheck = authorizeCollectionAccess(callerUser, 'course_selection_requests', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز تایید یا رد انتخاب واحد را ندارید.', { statusCode: 403 });
    }

    const allRequests = await this.getAllRequests(undefined, callerUser);
    const req = allRequests.find(r => r.id === id);
    if (!req) {
      throw new AppError('فرم انتخاب واحد مورد نظر یافت نشد.', { statusCode: 404 });
    }

    const updated: CourseSelectionRequest = {
      ...req,
      status,
      adminNotes: adminNotes || req.adminNotes,
      reviewedAt: new Date().toISOString(),
      reviewedBy: callerUser?.username || 'مسئول آموزش'
    };

    await serverSaveDoc('course_selection_requests', updated, callerUser);
    return updated;
  }
}
