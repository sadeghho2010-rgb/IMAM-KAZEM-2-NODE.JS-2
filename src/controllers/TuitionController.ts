import { Request, Response, NextFunction } from 'express';
import { TuitionService } from '../services/TuitionService';
import { verifyAccessToken } from '../lib/serverAuth';

export class TuitionController {
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

  public static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = TuitionController.extractCaller(req);
      const items = await TuitionService.getAllTuitionRecords(req.query, caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async getByStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId } = req.params;
      const caller = TuitionController.extractCaller(req);
      const items = await TuitionService.getTuitionByStudent(studentId, caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async calculate(req: Request, res: Response, next: NextFunction) {
    try {
      const { profile, settings } = req.body;
      const result = TuitionService.calculateTuition(profile || req.body, settings);
      return res.status(200).json({ success: true, breakdown: result });
    } catch (error) {
      next(error);
    }
  }

  public static async save(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = TuitionController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) payload.id = req.params.id;
      const record = await TuitionService.saveTuitionRecord(payload, caller);
      return res.status(200).json({ success: true, message: 'فاکتور شهریه با موفقیت ثبت شد.', record });
    } catch (error) {
      next(error);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const caller = TuitionController.extractCaller(req);
      await TuitionService.deleteTuitionRecord(id, caller);
      return res.status(200).json({ success: true, message: 'فاکتور شهریه با موفقیت حذف گردید.' });
    } catch (error) {
      next(error);
    }
  }

  public static async markPaid(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const caller = TuitionController.extractCaller(req);
      const updated = await TuitionService.markAsPaid(id, caller);
      return res.status(200).json({ success: true, message: 'وضعیت پرداخت با موفقیت ثبت شد.', record: updated });
    } catch (error) {
      next(error);
    }
  }

  public static async getReport(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = TuitionController.extractCaller(req);
      const periodId = req.query.periodId as string;
      const report = await TuitionService.getTuitionReport(periodId, req.query, caller);
      return res.status(200).json({ success: true, ...report });
    } catch (error) {
      next(error);
    }
  }
}
