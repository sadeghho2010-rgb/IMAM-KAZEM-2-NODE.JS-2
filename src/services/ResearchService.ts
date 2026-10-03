import { z } from 'zod';
import { serverQueryCollection, serverSaveDoc, serverDeleteDoc, authorizeCollectionAccess } from '../lib/serverDataApi';
import { AppError } from '../lib/errorHandler';
import { logServerAudit } from '../lib/serverAuth';
import { logger } from '../lib/logger';
import { ReceivedArticle, ArticleEvaluationSession } from '../types';

export const ArticleInputSchema = z.object({
  id: z.string().optional(),
  studentId: z.string().min(1, 'شناسه طلبه الزامی است.'),
  studentName: z.string().min(1, 'نام طلبه الزامی است.'),
  studentGrade: z.string().optional(),
  title: z.string().min(2, 'عنوان مقاله الزامی است.'),
  summary: z.string().optional(),
  type: z.enum(['individual', 'group']).default('individual'),
  deliveryYear: z.string().optional(),
  pageCount: z.union([z.number(), z.string()]).optional(),
  evaluationScores: z.string().optional(),
  evaluatorComments: z.string().optional(),
  isCompleted: z.boolean().optional()
});

export const EvaluationSessionInputSchema = z.object({
  id: z.string().optional(),
  articleId: z.string().optional(),
  title: z.string().min(2, 'عنوان جلسه ارزیابی الزامی است.'),
  presenterStudentId: z.string().optional(),
  presenterName: z.string().min(1, 'نام ارائه‌دهنده الزامی است.'),
  studentGrade: z.string().optional(),
  refereeCount: z.number().nonnegative().default(1),
  criticCount: z.number().nonnegative().default(1),
  allowedRoleRegistration: z.enum(['critic', 'referee', 'both']).default('both'),
  hasAbstract: z.boolean().default(false),
  abstractText: z.string().optional(),
  hasDownloadLink: z.boolean().default(false),
  downloadUrl: z.string().optional(),
  status: z.enum(['active', 'completed', 'archived']).default('active')
});

export class ResearchService {
  /**
   * Fetch all received articles
   */
  public static async getAllArticles(callerUser?: any): Promise<ReceivedArticle[]> {
    const authCheck = authorizeCollectionAccess(callerUser, 'received_articles', 'read');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما دسترسی به بخش پژوهش و مقالات را ندارید.', { statusCode: 403 });
    }

    const items = await serverQueryCollection('received_articles', callerUser);
    return Array.isArray(items) ? (items as ReceivedArticle[]) : [];
  }

  /**
   * Fetch articles for a specific student
   */
  public static async getArticlesByStudent(studentId: string, callerUser?: any): Promise<ReceivedArticle[]> {
    const articles = await this.getAllArticles(callerUser);
    return articles.filter(a => a.studentId === studentId);
  }

  /**
   * Save / Submit an article
   */
  public static async saveArticle(rawData: unknown, callerUser?: any): Promise<ReceivedArticle> {
    const authCheck = authorizeCollectionAccess(callerUser, 'received_articles', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز ثبت مقاله پژوهشی را ندارید.', { statusCode: 403 });
    }

    const parsed = ArticleInputSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || 'اطلاعات مقاله نامعتبر است.';
      throw new AppError(errorMsg, { statusCode: 400 });
    }

    const validData = parsed.data;
    const id = validData.id || `art_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const articleRecord: ReceivedArticle = {
      id,
      studentId: validData.studentId,
      studentName: validData.studentName.trim(),
      studentGrade: validData.studentGrade?.trim(),
      title: validData.title.trim(),
      summary: validData.summary?.trim(),
      type: validData.type,
      deliveryYear: validData.deliveryYear,
      pageCount: validData.pageCount,
      evaluationScores: validData.evaluationScores,
      evaluatorComments: validData.evaluatorComments,
      isCompleted: Boolean(validData.isCompleted),
      createdAt: (rawData as any)?.createdAt || nowIso,
      updatedAt: nowIso
    };

    await serverSaveDoc('received_articles', articleRecord, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: validData.id ? 'UPDATE_ARTICLE' : 'CREATE_ARTICLE',
      entityType: 'article',
      entityId: id,
      description: `ثبت مقاله پژوهشی: «${articleRecord.title}» اثر طلبه: ${articleRecord.studentName}`,
      newState: articleRecord as unknown as Record<string, unknown>
    });

    logger.info(`[ResearchService] Saved article ${id} (${articleRecord.title})`);
    return articleRecord;
  }

  /**
   * Delete an article
   */
  public static async deleteArticle(id: string, callerUser?: any): Promise<boolean> {
    const authCheck = authorizeCollectionAccess(callerUser, 'received_articles', 'delete');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز حذف مقاله پژوهشی را ندارید.', { statusCode: 403 });
    }

    await serverDeleteDoc('received_articles', id, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'DELETE_ARTICLE',
      entityType: 'article',
      entityId: id,
      description: `حذف مقاله پژوهشی با شناسه ${id}`
    });

    return true;
  }

  /**
   * Fetch all evaluation sessions
   */
  public static async getAllEvaluationSessions(callerUser?: any): Promise<ArticleEvaluationSession[]> {
    const items = await serverQueryCollection('article_evaluation_sessions', callerUser);
    return Array.isArray(items) ? (items as ArticleEvaluationSession[]) : [];
  }

  /**
   * Save an evaluation session
   */
  public static async saveEvaluationSession(rawData: unknown, callerUser?: any): Promise<ArticleEvaluationSession> {
    const authCheck = authorizeCollectionAccess(callerUser, 'article_evaluation_sessions', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز تعریف جلسه ارزیابی را ندارید.', { statusCode: 403 });
    }

    const parsed = EvaluationSessionInputSchema.safeParse(rawData);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues[0]?.message || 'اطلاعات جلسه ارزیابی نامعتبر است.';
      throw new AppError(errorMsg, { statusCode: 400 });
    }

    const validData = parsed.data;
    const id = validData.id || `eval_sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const sessionRecord: ArticleEvaluationSession = {
      id,
      articleId: validData.articleId,
      title: validData.title.trim(),
      presenterStudentId: validData.presenterStudentId,
      presenterName: validData.presenterName.trim(),
      studentGrade: validData.studentGrade?.trim(),
      refereeCount: validData.refereeCount,
      criticCount: validData.criticCount,
      allowedRoleRegistration: validData.allowedRoleRegistration,
      hasAbstract: validData.hasAbstract,
      abstractText: validData.abstractText,
      hasDownloadLink: validData.hasDownloadLink,
      downloadUrl: validData.downloadUrl,
      status: validData.status,
      approvedCriticStudentIds: (rawData as any)?.approvedCriticStudentIds || [],
      approvedRefereeStudentIds: (rawData as any)?.approvedRefereeStudentIds || [],
      createdAt: (rawData as any)?.createdAt || nowIso
    };

    await serverSaveDoc('article_evaluation_sessions', sessionRecord, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: validData.id ? 'UPDATE_EVALUATION_SESSION' : 'CREATE_EVALUATION_SESSION',
      entityType: 'evaluation_session',
      entityId: id,
      description: `ثبت کرسی ارزیابی مقاله: «${sessionRecord.title}» با ارائه ${sessionRecord.presenterName}`,
      newState: sessionRecord as unknown as Record<string, unknown>
    });

    return sessionRecord;
  }

  /**
   * Register role (critic or referee) for a student in an evaluation session
   */
  public static async registerRoleForSession(
    sessionId: string,
    studentId: string,
    role: 'critic' | 'referee',
    callerUser?: any
  ): Promise<ArticleEvaluationSession> {
    const sessions = await this.getAllEvaluationSessions(callerUser);
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      throw new AppError('جلسه ارزیابی مورد نظر یافت نشد.', { statusCode: 404 });
    }

    if (role === 'critic') {
      const list = session.approvedCriticStudentIds || [];
      if (!list.includes(studentId)) list.push(studentId);
      session.approvedCriticStudentIds = list;
    } else {
      const list = session.approvedRefereeStudentIds || [];
      if (!list.includes(studentId)) list.push(studentId);
      session.approvedRefereeStudentIds = list;
    }

    await serverSaveDoc('article_evaluation_sessions', session, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'REGISTER_SESSION_ROLE',
      entityType: 'evaluation_session',
      entityId: sessionId,
      description: `ثبت‌نام طلبه ${studentId} به عنوان ${role === 'critic' ? 'ناقد' : 'داور'} در جلسه: ${session.title}`
    });

    return session;
  }
}
