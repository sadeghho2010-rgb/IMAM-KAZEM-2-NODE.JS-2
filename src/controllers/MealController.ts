import { Request, Response, NextFunction } from 'express';
import { MealService } from '../services/MealService';
import { verifyAccessToken } from '../lib/serverAuth';

export class MealController {
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
      const caller = MealController.extractCaller(req);
      const items = await MealService.getAllPeriods(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async savePeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = MealController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) payload.id = req.params.id;
      const period = await MealService.savePeriod(payload, caller);
      return res.status(200).json({ success: true, message: 'دوره تغذیه با موفقیت ذخیره شد.', period });
    } catch (error) {
      next(error);
    }
  }

  public static async getReservations(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId, periodId } = req.query;
      const caller = MealController.extractCaller(req);
      const items = await MealService.getStudentReservations(studentId as string, periodId as string, caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async saveReservation(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = MealController.extractCaller(req);
      const record = await MealService.saveReservation(req.body, caller);
      return res.status(200).json({ success: true, message: 'رزرو غذا با موفقیت ثبت شد.', record });
    } catch (error) {
      next(error);
    }
  }

  public static async getCancelledDays(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = MealController.extractCaller(req);
      const items = await MealService.getMealCancelledDays(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async saveCancelledDay(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = MealController.extractCaller(req);
      const record = await MealService.saveMealCancelledDay(req.body, caller);
      return res.status(200).json({ success: true, message: 'تعطیلی وعده غذایی ثبت شد.', record });
    } catch (error) {
      next(error);
    }
  }

  public static async getKitchenStats(req: Request, res: Response, next: NextFunction) {
    try {
      const date = req.query.date as string || new Date().toLocaleDateString('fa-IR');
      const caller = MealController.extractCaller(req);
      const stats = await MealService.getDailyKitchenStats(date, caller);
      return res.status(200).json({ success: true, ...stats });
    } catch (error) {
      next(error);
    }
  }
}
