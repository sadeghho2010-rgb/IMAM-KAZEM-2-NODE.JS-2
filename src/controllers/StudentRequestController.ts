import { Request, Response, NextFunction } from 'express';
import { StudentRequestService } from '../services/StudentRequestService';
import { verifyAccessToken } from '../lib/serverAuth';

export class StudentRequestController {
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
      const caller = StudentRequestController.extractCaller(req);
      const items = await StudentRequestService.getAllRequests(req.query, caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const caller = StudentRequestController.extractCaller(req);
      const requestItem = await StudentRequestService.getRequestById(id, caller);
      return res.status(200).json({ success: true, request: requestItem });
    } catch (error) {
      next(error);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = StudentRequestController.extractCaller(req);
      const requestItem = await StudentRequestService.createRequest(req.body, caller);
      return res.status(200).json({ success: true, message: 'درخواست شما با موفقیت ثبت شد.', request: requestItem });
    } catch (error) {
      next(error);
    }
  }

  public static async reply(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const caller = StudentRequestController.extractCaller(req);
      const updated = await StudentRequestService.replyRequest(id, req.body, caller);
      return res.status(200).json({ success: true, message: 'پاسخ درخواست با موفقیت ثبت شد.', request: updated });
    } catch (error) {
      next(error);
    }
  }

  public static async getConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = StudentRequestController.extractCaller(req);
      const config = await StudentRequestService.getGlobalConfig(caller);
      return res.status(200).json({ success: true, config });
    } catch (error) {
      next(error);
    }
  }

  public static async saveConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = StudentRequestController.extractCaller(req);
      const config = await StudentRequestService.saveGlobalConfig(req.body, caller);
      return res.status(200).json({ success: true, message: 'تنظیمات سامانه ذخیره شد.', config });
    } catch (error) {
      next(error);
    }
  }
}
