import { Request, Response, NextFunction } from 'express';
import { LockerService } from '../services/LockerService';
import { verifyAccessToken } from '../lib/serverAuth';

export class LockerController {
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
      const caller = LockerController.extractCaller(req);
      const items = await LockerService.getAllLockers(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async getByNumber(req: Request, res: Response, next: NextFunction) {
    try {
      const num = parseInt(req.params.number, 10);
      const caller = LockerController.extractCaller(req);
      const locker = await LockerService.getLockerByNumber(num, caller);
      return res.status(200).json({ success: true, locker });
    } catch (error) {
      next(error);
    }
  }

  public static async assign(req: Request, res: Response, next: NextFunction) {
    try {
      const num = parseInt(req.params.number, 10);
      const caller = LockerController.extractCaller(req);
      const updated = await LockerService.assignLocker(num, req.body, caller);
      return res.status(200).json({ success: true, message: 'کمد با موفقیت واگذار شد.', locker: updated });
    } catch (error) {
      next(error);
    }
  }

  public static async vacate(req: Request, res: Response, next: NextFunction) {
    try {
      const num = parseInt(req.params.number, 10);
      const caller = LockerController.extractCaller(req);
      const updated = await LockerService.vacateLocker(num, caller);
      return res.status(200).json({ success: true, message: 'کمد با موفقیت تخلیه شد.', locker: updated });
    } catch (error) {
      next(error);
    }
  }

  public static async reportDefect(req: Request, res: Response, next: NextFunction) {
    try {
      const num = parseInt(req.params.number, 10);
      const { defectType, description } = req.body;
      const caller = LockerController.extractCaller(req);
      const updated = await LockerService.reportDefect(num, defectType, description, caller);
      return res.status(200).json({ success: true, message: 'گزارش خرابی کمد ثبت شد.', locker: updated });
    } catch (error) {
      next(error);
    }
  }

  public static async resolveDefect(req: Request, res: Response, next: NextFunction) {
    try {
      const num = parseInt(req.params.number, 10);
      const { repairNotes } = req.body;
      const caller = LockerController.extractCaller(req);
      const updated = await LockerService.resolveDefect(num, repairNotes, caller);
      return res.status(200).json({ success: true, message: 'نقص کمد برطرف شد.', locker: updated });
    } catch (error) {
      next(error);
    }
  }
}
