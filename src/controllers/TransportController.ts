import { Request, Response, NextFunction } from 'express';
import { TransportService } from '../services/TransportService';
import { verifyAccessToken } from '../lib/serverAuth';

export class TransportController {
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

  public static async getAllDrivers(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = TransportController.extractCaller(req);
      const items = await TransportService.getAllDrivers(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async saveDriver(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = TransportController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) payload.id = req.params.id;
      const driver = await TransportService.saveDriver(payload, caller);
      return res.status(200).json({ success: true, message: 'اطلاعات راننده ذخیره شد.', driver });
    } catch (error) {
      next(error);
    }
  }

  public static async deleteDriver(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const caller = TransportController.extractCaller(req);
      await TransportService.deleteDriver(id, caller);
      return res.status(200).json({ success: true, message: 'راننده با موفقیت حذف شد.' });
    } catch (error) {
      next(error);
    }
  }

  public static async getRoutines(req: Request, res: Response, next: NextFunction) {
    try {
      const teacherId = req.query.teacherId as string;
      const caller = TransportController.extractCaller(req);
      const routines = await TransportService.getWeeklyRoutines(teacherId, caller);
      return res.status(200).json({ success: true, count: routines.length, routines });
    } catch (error) {
      next(error);
    }
  }

  public static async saveRoutine(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = TransportController.extractCaller(req);
      const routine = await TransportService.saveWeeklyRoutine(req.body, caller);
      return res.status(200).json({ success: true, message: 'برنامه هفتگی سرویس ذخیره شد.', routine });
    } catch (error) {
      next(error);
    }
  }

  public static async getTrips(req: Request, res: Response, next: NextFunction) {
    try {
      const { teacherId, date } = req.query;
      const caller = TransportController.extractCaller(req);
      const trips = await TransportService.getAllTrips({ teacherId: teacherId as string, date: date as string }, caller);
      return res.status(200).json({ success: true, count: trips.length, trips });
    } catch (error) {
      next(error);
    }
  }

  public static async saveTrip(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = TransportController.extractCaller(req);
      const trip = await TransportService.saveSingleTrip(req.body, caller);
      return res.status(200).json({ success: true, message: 'سفر سرویس ثبت شد.', trip });
    } catch (error) {
      next(error);
    }
  }
}
