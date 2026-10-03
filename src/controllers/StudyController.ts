import { Request, Response, NextFunction } from 'express';
import { StudyService } from '../services/StudyService';
import { verifyAccessToken } from '../lib/serverAuth';

export class StudyController {
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

  public static async getAllPeriods(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = StudyController.extractCaller(req);
      const periods = await StudyService.getAllStudyPeriods(caller);
      return res.status(200).json({ success: true, count: periods.length, periods });
    } catch (error) {
      next(error);
    }
  }

  public static async getPeriodById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const caller = StudyController.extractCaller(req);
      const period = await StudyService.getStudyPeriodById(id, caller);
      return res.status(200).json({ success: true, period });
    } catch (error) {
      next(error);
    }
  }

  public static async savePeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = StudyController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) payload.id = req.params.id;
      const period = await StudyService.saveStudyPeriod(payload, caller);
      return res.status(200).json({ success: true, message: 'دوره مطالعاتی با موفقیت ذخیره شد.', period });
    } catch (error) {
      next(error);
    }
  }

  public static async logHours(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = StudyController.extractCaller(req);
      const log = await StudyService.logStudyHours(req.body, caller);
      return res.status(200).json({ success: true, message: 'ساعت مطالعه با موفقیت ثبت شد.', log });
    } catch (error) {
      next(error);
    }
  }

  public static async getStudentStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId } = req.params;
      const periodId = req.query.periodId as string;
      const caller = StudyController.extractCaller(req);
      const stats = await StudyService.getStudentStudyStats(studentId, periodId, caller);
      return res.status(200).json({ success: true, stats });
    } catch (error) {
      next(error);
    }
  }

  public static async getLeaderboard(req: Request, res: Response, next: NextFunction) {
    try {
      const periodId = req.query.periodId as string;
      const grade = req.query.grade as string;
      const caller = StudyController.extractCaller(req);
      const result = await StudyService.getStudyLeaderboard(periodId, grade, caller);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}
