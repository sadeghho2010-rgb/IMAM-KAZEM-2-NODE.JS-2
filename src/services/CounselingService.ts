import { z } from 'zod';
import { serverQueryCollection, serverSaveDoc, serverDeleteDoc, authorizeCollectionAccess } from '../lib/serverDataApi';
import { AppError } from '../lib/errorHandler';
import { logServerAudit } from '../lib/serverAuth';
import { logger } from '../lib/logger';
import { CounselingSessionGrade, CounselingScore, ConsultationAdvisorProposal } from '../types';

export const CounselingGradeSchema = z.object({
  id: z.string().optional(),
  studentId: z.string().min(1, 'شناسه طلبه الزامی است.'),
  studentName: z.string().min(1, 'نام طلبه الزامی است.'),
  grade: z.string().optional(),
  counselorTeacherName: z.string().min(1, 'نام استاد مشاور الزامی است.'),
  courseTitle: z.string().min(1, 'عنوان کلاس مشاوره الزامی است.'),
  sessionDate: z.string().min(1, 'تاریخ جلسه الزامی است.'),
  sessionNumber: z.union([z.number(), z.string()]).optional(),
  participationScore: z.enum(['الف', 'ب', 'ج', 'د', 'غیبت']).default('الف'),
  researchScore: z.enum(['الف', 'ب', 'ج', 'د', 'غیبت']).default('الف'),
  counselorFeedback: z.string().optional()
});

export class CounselingService {
  public static async getAllGrades(filters?: { studentId?: string; courseTitle?: string }, callerUser?: any): Promise<CounselingSessionGrade[]> {
    const authCheck = authorizeCollectionAccess(callerUser, 'counseling_grades', 'read');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما دسترسی به نمرات و ارزیابی مشاوره را ندارید.', { statusCode: 403 });
    }

    const items = await serverQueryCollection('counseling_grades', callerUser);
    let grades = Array.isArray(items) ? (items as CounselingSessionGrade[]) : [];
    if (filters?.studentId) grades = grades.filter(g => g.studentId === filters.studentId);
    if (filters?.courseTitle) grades = grades.filter(g => g.courseTitle === filters.courseTitle);
    return grades;
  }

  public static async getGradesByStudent(studentId: string, callerUser?: any): Promise<CounselingSessionGrade[]> {
    return this.getAllGrades({ studentId }, callerUser);
  }

  public static async saveCounselingGrade(rawData: unknown, callerUser?: any): Promise<CounselingSessionGrade> {
    const authCheck = authorizeCollectionAccess(callerUser, 'counseling_grades', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز ثبت ارزیابی و نمره مشاوره را ندارید.', { statusCode: 403 });
    }

    const parsed = CounselingGradeSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || 'اطلاعات ارزیابی مشاوره نامعتبر است.';
      throw new AppError(errorMsg, { statusCode: 400 });
    }

    const valid = parsed.data;
    const id = valid.id || `c_grade_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const record: CounselingSessionGrade = {
      id,
      studentId: valid.studentId,
      studentName: valid.studentName.trim(),
      grade: valid.grade,
      counselorTeacherName: valid.counselorTeacherName.trim(),
      courseTitle: valid.courseTitle.trim(),
      sessionDate: valid.sessionDate,
      sessionNumber: valid.sessionNumber,
      participationScore: valid.participationScore as CounselingScore,
      researchScore: valid.researchScore as CounselingScore,
      counselorFeedback: valid.counselorFeedback,
      createdAt: (rawData as any)?.createdAt || nowIso,
      createdByName: callerUser?.username || 'استاد مشاور',
      createdByRole: callerUser?.role || 'teacher',
      updatedAt: nowIso
    };

    await serverSaveDoc('counseling_grades', record, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: valid.id ? 'UPDATE_COUNSELING_GRADE' : 'CREATE_COUNSELING_GRADE',
      entityType: 'counseling_grade',
      entityId: id,
      description: `ثبت نمره مشاوره برای طلبه ${record.studentName} در درس ${record.courseTitle} (مشارکت: ${record.participationScore}، پژوهش: ${record.researchScore})`
    });

    return record;
  }

  public static async deleteCounselingGrade(id: string, callerUser?: any): Promise<boolean> {
    const authCheck = authorizeCollectionAccess(callerUser, 'counseling_grades', 'delete');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز حذف نمره مشاوره را ندارید.', { statusCode: 403 });
    }

    await serverDeleteDoc('counseling_grades', id, callerUser);
    return true;
  }

  public static async getAdvisorProposals(callerUser?: any): Promise<ConsultationAdvisorProposal[]> {
    const items = await serverQueryCollection('consultation_advisor_proposals', callerUser);
    return Array.isArray(items) ? (items as ConsultationAdvisorProposal[]) : [];
  }

  public static async saveAdvisorProposal(rawData: unknown, callerUser?: any): Promise<ConsultationAdvisorProposal> {
    const authCheck = authorizeCollectionAccess(callerUser, 'consultation_advisor_proposals', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز ثبت پیشنهاد گروه‌بندی مشاوره را ندارید.', { statusCode: 403 });
    }

    const id = (rawData as any).id || `adv_prop_${Date.now()}`;
    const record = {
      ...(rawData as object),
      id,
      createdAt: new Date().toISOString(),
      createdByUserName: callerUser?.username || 'system'
    } as ConsultationAdvisorProposal;

    await serverSaveDoc('consultation_advisor_proposals', record, callerUser);
    return record;
  }
}
