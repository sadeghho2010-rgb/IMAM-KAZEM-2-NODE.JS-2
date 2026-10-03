import { Request, Response, NextFunction } from 'express';
import { OralExamService } from '../services/OralExamService';
import { verifyAccessToken } from '../lib/serverAuth';

export class OralExamController {
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
      const caller = OralExamController.extractCaller(req);
      const periods = await OralExamService.getAllPeriods(caller);
      return res.status(200).json({ success: true, count: periods.length, periods });
    } catch (error) {
      next(error);
    }
  }

  public static async getPeriodById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const caller = OralExamController.extractCaller(req);
      const period = await OralExamService.getPeriodById(id, caller);
      return res.status(200).json({ success: true, period });
    } catch (error) {
      next(error);
    }
  }

  public static async savePeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = OralExamController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) payload.id = req.params.id;
      const period = await OralExamService.savePeriod(payload, caller);
      return res.status(200).json({ success: true, message: 'دوره آزمون شفاهی با موفقیت ذخیره شد.', period });
    } catch (error) {
      next(error);
    }
  }

  public static async getRecordsByPeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const { periodId } = req.params;
      const caller = OralExamController.extractCaller(req);
      const records = await OralExamService.getRecordsByPeriod(periodId, caller);
      return res.status(200).json({ success: true, count: records.length, records });
    } catch (error) {
      next(error);
    }
  }

  public static async saveStudentRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = OralExamController.extractCaller(req);
      const record = await OralExamService.saveStudentRecord(req.body, caller);
      return res.status(200).json({ success: true, message: 'نمرات آزمون شفاهی با موفقیت ثبت شد.', record });
    } catch (error) {
      next(error);
    }
  }

  public static async getReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { periodId } = req.params;
      const caller = OralExamController.extractCaller(req);
      const report = await OralExamService.getExamReport(periodId, caller);
      return res.status(200).json({ success: true, ...report });
    } catch (error) {
      next(error);
    }
  }
}
