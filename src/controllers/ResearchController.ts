import { Request, Response, NextFunction } from 'express';
import { ResearchService } from '../services/ResearchService';
import { verifyAccessToken } from '../lib/serverAuth';

export class ResearchController {
  private static extractCaller(req: Request) {
    let token = req.cookies?.auth_access_token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }
    if (token) {
      const v = verifyAccessToken(token);
      if (v.valid && v.decoded) return v.decoded;
    }
    return null;
  }

  public static async getAllArticles(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = ResearchController.extractCaller(req);
      const items = await ResearchService.getAllArticles(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async getArticlesByStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId } = req.params;
      const caller = ResearchController.extractCaller(req);
      const items = await ResearchService.getArticlesByStudent(studentId, caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async saveArticle(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = ResearchController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) payload.id = req.params.id;
      const article = await ResearchService.saveArticle(payload, caller);
      return res.status(200).json({ success: true, message: 'مقاله با موفقیت ذخیره شد.', article });
    } catch (error) {
      next(error);
    }
  }

  public static async deleteArticle(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const caller = ResearchController.extractCaller(req);
      await ResearchService.deleteArticle(id, caller);
      return res.status(200).json({ success: true, message: 'مقاله با موفقیت حذف گردید.' });
    } catch (error) {
      next(error);
    }
  }

  public static async getAllSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = ResearchController.extractCaller(req);
      const sessions = await ResearchService.getAllEvaluationSessions(caller);
      return res.status(200).json({ success: true, count: sessions.length, sessions });
    } catch (error) {
      next(error);
    }
  }

  public static async saveSession(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = ResearchController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) payload.id = req.params.id;
      const session = await ResearchService.saveEvaluationSession(payload, caller);
      return res.status(200).json({ success: true, message: 'جلسه ارزیابی با موفقیت ثبت شد.', session });
    } catch (error) {
      next(error);
    }
  }

  public static async registerRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { studentId, role } = req.body;
      const caller = ResearchController.extractCaller(req);
      const updated = await ResearchService.registerRoleForSession(id, studentId, role, caller);
      return res.status(200).json({ success: true, message: 'ثبت‌نام نقش با موفقیت انجام شد.', session: updated });
    } catch (error) {
      next(error);
    }
  }
}
