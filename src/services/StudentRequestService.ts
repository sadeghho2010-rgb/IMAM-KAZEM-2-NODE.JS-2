import { z } from 'zod';
import { serverQueryCollection, serverSaveDoc, authorizeCollectionAccess } from '../lib/serverDataApi';
import { AppError } from '../lib/errorHandler';
import { logServerAudit } from '../lib/serverAuth';
import { logger } from '../lib/logger';
import { StudentRequest, GlobalRequestsConfig, RequestTargetUnit } from '../types';

export const CreateStudentRequestSchema = z.object({
  id: z.string().optional(),
  studentId: z.string().min(1, 'شناسه طلبه الزامی است.'),
  studentName: z.string().min(1, 'نام طلبه الزامی است.'),
  nationalCode: z.string().optional(),
  grade: z.string().optional(),
  unit: z.enum(['education', 'finance', 'cultural_welfare']),
  category: z.string().min(1, 'موضوع درخواست الزامی است.'),
  title: z.string().min(2, 'عنوان درخواست الزامی است.'),
  description: z.string().min(5, 'شرح درخواست باید حداقل ۵ کاراکتر باشد.'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium')
});

export const ReplyRequestSchema = z.object({
  replyText: z.string().min(2, 'متن پاسخ الزامی است.'),
  status: z.enum(['pending', 'in_progress', 'resolved', 'rejected']).default('resolved'),
  rejectionReason: z.string().optional()
});

export class StudentRequestService {
  /**
   * Fetch requests with department and student scoping
   */
  public static async getAllRequests(filters?: any, callerUser?: any): Promise<StudentRequest[]> {
    const authCheck = authorizeCollectionAccess(callerUser, 'student_requests', 'read');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما دسترسی به سامانه درخواست‌ها را ندارید.', { statusCode: 403 });
    }

    const items = await serverQueryCollection('student_requests', callerUser);
    let requests = Array.isArray(items) ? (items as StudentRequest[]) : [];

    // Scoping: Level 3 student only sees their own requests
    if (callerUser && callerUser.level === 3) {
      const studentId = callerUser.linkedStudentId || callerUser.id;
      return requests.filter(r => r.studentId === studentId);
    }

    // Scoping by unit for officers
    if (filters?.unit) {
      requests = requests.filter(r => r.unit === filters.unit);
    }
    if (filters?.status) {
      requests = requests.filter(r => r.status === filters.status);
    }

    return requests;
  }

  public static async getRequestById(id: string, callerUser?: any): Promise<StudentRequest> {
    const requests = await this.getAllRequests({}, callerUser);
    const req = requests.find(r => r.id === id);
    if (!req) {
      throw new AppError('درخواست مورد نظر یافت نشد یا شما دسترسی به آن را ندارید.', { statusCode: 404 });
    }
    return req;
  }

  public static async createRequest(rawData: unknown, callerUser?: any): Promise<StudentRequest> {
    const authCheck = authorizeCollectionAccess(callerUser, 'student_requests', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز ثبت درخواست را ندارید.', { statusCode: 403 });
    }

    const parsed = CreateStudentRequestSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || 'اطلاعات درخواست نامعتبر است.';
      throw new AppError(errorMsg, { statusCode: 400 });
    }

    const validData = parsed.data;
    const id = validData.id || `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const record: StudentRequest = {
      id,
      studentId: validData.studentId,
      studentName: validData.studentName.trim(),
      nationalCode: validData.nationalCode,
      grade: validData.grade,
      unit: validData.unit,
      category: validData.category,
      title: validData.title.trim(),
      description: validData.description.trim(),
      priority: validData.priority,
      status: 'pending',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await serverSaveDoc('student_requests', record, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'CREATE_STUDENT_REQUEST',
      entityType: 'student_request',
      entityId: id,
      description: `ثبت درخواست جدید: «${record.title}» توسط طلبه: ${record.studentName}`
    });

    return record;
  }

  public static async replyRequest(
    id: string,
    replyData: { replyText: string; status?: any; rejectionReason?: string },
    callerUser?: any
  ): Promise<StudentRequest> {
    const authCheck = authorizeCollectionAccess(callerUser, 'student_requests', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز پاسخگویی به درخواست را ندارید.', { statusCode: 403 });
    }

    const req = await this.getRequestById(id, callerUser);
    const nowIso = new Date().toISOString();

    const updated: StudentRequest = {
      ...req,
      officialReply: replyData.replyText.trim(),
      status: replyData.status || 'resolved',
      rejectionReason: replyData.rejectionReason?.trim(),
      repliedBy: callerUser?.userId || callerUser?.id,
      repliedByName: callerUser?.fullName || callerUser?.username || 'مسئول مربوطه',
      repliedAt: nowIso,
      updatedAt: nowIso
    };

    await serverSaveDoc('student_requests', updated, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'REPLY_STUDENT_REQUEST',
      entityType: 'student_request',
      entityId: id,
      description: `پاسخگویی به درخواست شماره ${id} (وضعیت: ${updated.status})`
    });

    return updated;
  }

  public static async getGlobalConfig(callerUser?: any): Promise<GlobalRequestsConfig> {
    const items = await serverQueryCollection('global_requests_config', callerUser);
    if (Array.isArray(items) && items.length > 0) {
      return items[0] as GlobalRequestsConfig;
    }

    return {
      id: 'global_requests_config',
      isGlobalVisibleForStudents: true,
      isGlobalEnabled: true,
      officersStatus: {
        education: { isAccepting: true, officerTitle: 'مسئول آموزش' },
        finance: { isAccepting: true, officerTitle: 'مسئول مالی' },
        cultural_welfare: { isAccepting: true, officerTitle: 'مسئول امور فرهنگی و رفاهی' }
      }
    };
  }

  public static async saveGlobalConfig(rawData: unknown, callerUser?: any): Promise<GlobalRequestsConfig> {
    const authCheck = authorizeCollectionAccess(callerUser, 'global_requests_config', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'تنها مدیر ارشد مجاز به تغییر تنظیمات عمومی درخواست‌ها است.', { statusCode: 403 });
    }

    const config = {
      ...(rawData as object),
      id: 'global_requests_config',
      updatedAt: new Date().toISOString(),
      updatedBy: callerUser?.username || 'system'
    } as GlobalRequestsConfig;

    await serverSaveDoc('global_requests_config', config, callerUser);
    return config;
  }
}
