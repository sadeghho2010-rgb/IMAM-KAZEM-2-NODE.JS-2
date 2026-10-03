import { Request, Response, NextFunction } from 'express';
import { TeacherService } from '../services/TeacherService';
import { verifyAccessToken } from '../lib/serverAuth';

export class TeacherController {
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
      const caller = TeacherController.extractCaller(req);
      const items = await TeacherService.getAllTeachers(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const caller = TeacherController.extractCaller(req);
      const teacher = await TeacherService.getTeacherById(id, caller);
      return res.status(200).json({ success: true, teacher });
    } catch (error) {
      next(error);
    }
  }

  public static async save(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = TeacherController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) {
        payload.id = req.params.id;
      }
      const teacher = await TeacherService.saveTeacher(payload, caller);
      return res.status(200).json({ success: true, message: 'اطلاعات استاد با موفقیت ذخیره شد.', teacher });
    } catch (error) {
      next(error);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const caller = TeacherController.extractCaller(req);
      await TeacherService.deleteTeacher(id, caller);
      return res.status(200).json({ success: true, message: 'پرونده استاد با موفقیت حذف گردید.' });
    } catch (error) {
      next(error);
    }
  }

  public static async getSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const caller = TeacherController.extractCaller(req);
      const schedule = await TeacherService.getTeacherSchedule(id, caller);
      return res.status(200).json({ success: true, schedule });
    } catch (error) {
      next(error);
    }
  }
}
