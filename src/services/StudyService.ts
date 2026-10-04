import { z } from 'zod';
import { serverQueryCollection, serverGetDocByCandidateIds, serverSaveDoc, authorizeCollectionAccess } from '../lib/serverDataApi';
import { AppError } from '../lib/errorHandler';
import { logServerAudit } from '../lib/serverAuth';
import { logger } from '../lib/logger';
import { StudyPeriod, PeriodicStudyLog } from '../types';

export const StudyPeriodSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2, 'عنوان دوره مطالعاتی الزامی است.'),
  startDate: z.string().min(1, 'تاریخ شروع دوره الزامی است.'),
  endDate: z.string().min(1, 'تاریخ پایان دوره الزامی است.'),
  mandatoryHours: z.number().positive('ساعت موظفی مطالعه باید یک عدد مثبت باشد.').default(40),
  deadlineDate: z.string().optional(),
  isClosed: z.boolean().default(false),
  closedManually: z.boolean().optional(),
  targetGrades: z.array(z.string()).optional(),
  exemptGrades: z.array(z.string()).optional(),
  exemptStudentIds: z.array(z.string()).optional(),
  warningRule: z.enum(['none', 'below_mandatory', 'below_mandatory_and_avg']).default('below_mandatory')
});

export const StudyLogEntrySchema = z.object({
  id: z.string().optional(),
  periodId: z.string().min(1, 'شناسه دوره مطالعاتی الزامی است.'),
  studentId: z.string().min(1, 'شناسه طلبه الزامی است.'),
  hours: z.number().nonnegative('ساعت مطالعه نمی‌تواند منفی باشد.'),
  studyHours: z.number().nonnegative().optional(),
  discussionHours: z.number().nonnegative().optional(),
  isExempt: z.boolean().optional(),
  exemptionReason: z.string().optional()
});

export class StudyService {
  /**
   * Fetch all study periods
   */
  public static async getAllStudyPeriods(callerUser?: any): Promise<StudyPeriod[]> {
    const authCheck = authorizeCollectionAccess(callerUser, 'study_periods', 'read');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما دسترسی به دوره‌های مطالعاتی را ندارید.', { statusCode: 403 });
    }

    const items = await serverQueryCollection('study_periods', callerUser);
    return Array.isArray(items) ? (items as StudyPeriod[]) : [];
  }

  /**
   * Fetch single study period by ID
   */
  public static async getStudyPeriodById(id: string, callerUser?: any): Promise<StudyPeriod> {
    const periods = await this.getAllStudyPeriods(callerUser);
    const period = periods.find(p => p.id === id);
    if (!period) {
      throw new AppError('دوره مطالعاتی مورد نظر یافت نشد.', { statusCode: 404 });
    }
    return period;
  }

  /**
   * Create or update a study period
   */
  public static async saveStudyPeriod(rawData: unknown, callerUser?: any): Promise<StudyPeriod> {
    const authCheck = authorizeCollectionAccess(callerUser, 'study_periods', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز تعریف یا ویرایش دوره مطالعاتی را ندارید.', { statusCode: 403 });
    }

    const parsed = StudyPeriodSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || 'اطلاعات وارد شده نامعتبر است.';
      throw new AppError(errorMsg, { statusCode: 400 });
    }

    const validData = parsed.data;
    const id = validData.id || `period_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const periodRecord: StudyPeriod = {
      id,
      title: validData.title.trim(),
      startDate: validData.startDate,
      endDate: validData.endDate,
      mandatoryHours: validData.mandatoryHours,
      deadlineDate: validData.deadlineDate,
      isClosed: validData.isClosed,
      closedManually: validData.closedManually,
      targetGrades: validData.targetGrades || [],
      exemptGrades: validData.exemptGrades || [],
      exemptStudentIds: validData.exemptStudentIds || [],
      warningRule: validData.warningRule,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await serverSaveDoc('study_periods', periodRecord, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: validData.id ? 'UPDATE_STUDY_PERIOD' : 'CREATE_STUDY_PERIOD',
      entityType: 'study_period',
      entityId: id,
      description: `ثبت دوره مطالعاتی: ${periodRecord.title} (ساعت موظفی: ${periodRecord.mandatoryHours})`,
      newState: periodRecord as unknown as Record<string, unknown>
    });

    logger.info(`[StudyService] Saved study period ${id} (${periodRecord.title})`);
    return periodRecord;
  }

  /**
   * Log study and discussion hours for a student in a period
   */
  public static async logStudyHours(rawData: unknown, callerUser?: any): Promise<PeriodicStudyLog> {
    const authCheck = authorizeCollectionAccess(callerUser, 'periodic_study_logs', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز ثبت ساعت مطالعه را ندارید.', { statusCode: 403 });
    }

    const parsed = StudyLogEntrySchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || 'اطلاعات وارد شده نامعتبر است.';
      throw new AppError(errorMsg, { statusCode: 400 });
    }

    const valid = parsed.data;
    const id = valid.id || `log_${valid.periodId}_${valid.studentId}`;
    const nowIso = new Date().toISOString();

    const logRecord: PeriodicStudyLog = {
      id,
      periodId: valid.periodId,
      studentId: valid.studentId,
      hours: valid.hours,
      studyHours: valid.studyHours || valid.hours,
      discussionHours: valid.discussionHours || 0,
      isExempt: valid.isExempt,
      exemptionReason: valid.exemptionReason,
      submittedBy: callerUser?.role === 'student' ? 'student' : 'officer',
      lastModifiedAt: nowIso
    };

    await serverSaveDoc('periodic_study_logs', logRecord, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'LOG_STUDY_HOURS',
      entityType: 'study_log',
      entityId: id,
      description: `ثبت ساعت مطالعه (${logRecord.hours} ساعت) برای طلبه: ${logRecord.studentId}`
    });

    return logRecord;
  }

  /**
   * Fetch study stats and evaluation for a specific student in a period
   */
  public static async getStudentStudyStats(studentId: string, periodId: string, callerUser?: any) {
    // ۱. بررسی دسترسی سطح ردیف: اگر فراخوان‌کننده طلبه باشد، فقط مجاز به دریافت کارنامه خودش است
    if (callerUser && (callerUser.role === 'student' || callerUser.level === 3)) {
      const uStudentId = String(callerUser.studentId || callerUser.linkedStudentId || callerUser.id || '').trim();
      if (uStudentId && studentId !== uStudentId) {
        throw new AppError('شما تنها مجاز به مشاهده آمار مطالعه خود هستید.', { statusCode: 403 });
      }
    }

    const period = await this.getStudyPeriodById(periodId, callerUser);
    
    // ۲. خواندن مستقیم دو کلید ممکن با یک کوئری سریع IN ('log_{periodId}_{studentId}', 'studylog_{periodId}_{studentId}')
    const candidateIds = [
      `log_${periodId}_${studentId}`,
      `studylog_${periodId}_${studentId}`
    ];
    let studentLog = await serverGetDocByCandidateIds('periodic_study_logs', candidateIds, callerUser);

    // ۳. بررسی انطباق فیلدهای periodId و studentId با ورودی تابع
    if (studentLog && (studentLog.periodId !== periodId || studentLog.studentId !== studentId)) {
      studentLog = null;
    }

    // اگر رکوردی با دو کلید ممکن پیدا نشد، بدون بارگذاری کل کالکشن، همان null فرض می‌شود
    const loggedHours = studentLog?.hours || 0;
    const studyHours = studentLog?.studyHours || loggedHours;
    const discussionHours = studentLog?.discussionHours || 0;
    const mandatory = period.mandatoryHours || 40;
    const diffHours = loggedHours - mandatory;
    const isBelowMandatory = diffHours < 0;

    return {
      studentId,
      periodId,
      periodTitle: period.title,
      mandatoryHours: mandatory,
      loggedHours,
      studyHours,
      discussionHours,
      diffHours,
      status: isBelowMandatory ? 'shortage' : 'surplus',
      hasWarning: isBelowMandatory && period.warningRule !== 'none',
      isExempt: Boolean(studentLog?.isExempt)
    };
  }

  /**
   * Generate leaderboard ranked by total study and discussion hours
   */
  public static async getStudyLeaderboard(periodId: string, grade?: string, callerUser?: any) {
    const period = await this.getStudyPeriodById(periodId, callerUser);
    const allLogs = await serverQueryCollection('periodic_study_logs', callerUser);
    const allStudents = await serverQueryCollection('students', callerUser);

    const logsInPeriod = Array.isArray(allLogs) ? allLogs.filter((l: any) => l.periodId === periodId) : [];
    const studentsList = Array.isArray(allStudents) ? allStudents : [];

    // Map and filter by grade
    const ranked = logsInPeriod
      .map((log: any) => {
        const student = studentsList.find((s: any) => s.id === log.studentId);
        return {
          studentId: log.studentId,
          studentName: student?.name || student?.fullName || log.studentId,
          grade: student?.grade || 'عمومی',
          totalHours: Number(log.hours || 0),
          studyHours: Number(log.studyHours || log.hours || 0),
          discussionHours: Number(log.discussionHours || 0)
        };
      })
      .filter(item => !grade || item.grade === grade)
      .sort((a, b) => b.totalHours - a.totalHours)
      .map((item, index) => ({
        rank: index + 1,
        ...item
      }));

    return {
      periodId,
      periodTitle: period.title,
      grade: grade || 'all',
      totalParticipants: ranked.length,
      leaderboard: ranked
    };
  }
}
