import { Request, Response, NextFunction } from 'express';
import { CalendarService } from '../services/CalendarService';
import { verifyAccessToken } from '../lib/serverAuth';

export class CalendarController {
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
      const caller = CalendarController.extractCaller(req);
      const items = await CalendarService.getAllPeriods(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async getPeriodById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const caller = CalendarController.extractCaller(req);
      const period = await CalendarService.getPeriodById(id, caller);
      return res.status(200).json({ success: true, period });
    } catch (error) {
      next(error);
    }
  }

  public static async savePeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = CalendarController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) payload.id = req.params.id;
      const period = await CalendarService.savePeriod(payload, caller);
      return res.status(200).json({ success: true, message: 'دوره تقویم آموزشی ذخیره شد.', period });
    } catch (error) {
      next(error);
    }
  }

  public static async getHolidays(req: Request, res: Response, next: NextFunction) {
    try {
      const periodId = req.query.periodId as string;
      const caller = CalendarController.extractCaller(req);
      const holidays = await CalendarService.getAllHolidays(periodId, caller);
      return res.status(200).json({ success: true, count: holidays.length, holidays });
    } catch (error) {
      next(error);
    }
  }

  public static async saveHoliday(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = CalendarController.extractCaller(req);
      const holiday = await CalendarService.saveHoliday(req.body, caller);
      return res.status(200).json({ success: true, message: 'تعطیلی در تقویم ثبت شد.', holiday });
    } catch (error) {
      next(error);
    }
  }

  public static async deleteHoliday(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const caller = CalendarController.extractCaller(req);
      await CalendarService.deleteHoliday(id, caller);
      return res.status(200).json({ success: true, message: 'تعطیلی با موفقیت حذف شد.' });
    } catch (error) {
      next(error);
    }
  }

  public static async getWeeklyPrograms(req: Request, res: Response, next: NextFunction) {
    try {
      const periodId = req.query.periodId as string;
      const caller = CalendarController.extractCaller(req);
      const programs = await CalendarService.getAllWeeklyPrograms(periodId, caller);
      return res.status(200).json({ success: true, count: programs.length, programs });
    } catch (error) {
      next(error);
    }
  }

  public static async saveWeeklyProgram(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = CalendarController.extractCaller(req);
      const program = await CalendarService.saveWeeklyProgram(req.body, caller);
      return res.status(200).json({ success: true, message: 'برنامه هفتگی تقویم ذخیره شد.', program });
    } catch (error) {
      next(error);
    }
  }

  public static async deleteWeeklyProgram(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const caller = CalendarController.extractCaller(req);
      await CalendarService.deleteWeeklyProgram(id, caller);
      return res.status(200).json({ success: true, message: 'برنامه با موفقیت حذف شد.' });
    } catch (error) {
      next(error);
    }
  }
}
