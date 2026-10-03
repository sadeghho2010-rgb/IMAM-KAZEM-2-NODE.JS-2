import { Request, Response, NextFunction } from 'express';
import { ProgramService } from '../services/ProgramService';
import { verifyAccessToken } from '../lib/serverAuth';

export class ProgramController {
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
      const caller = ProgramController.extractCaller(req);
      const items = await ProgramService.getAllPrograms(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const caller = ProgramController.extractCaller(req);
      const program = await ProgramService.getProgramById(id, caller);
      return res.status(200).json({ success: true, program });
    } catch (error) {
      next(error);
    }
  }

  public static async save(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = ProgramController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) {
        payload.id = req.params.id;
      }
      const program = await ProgramService.saveProgram(payload, caller);
      return res.status(200).json({ success: true, message: 'برنامه درسی با موفقیت ذخیره شد.', program });
    } catch (error) {
      next(error);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const caller = ProgramController.extractCaller(req);
      await ProgramService.deleteProgram(id, caller);
      return res.status(200).json({ success: true, message: 'برنامه درسی با موفقیت حذف گردید.' });
    } catch (error) {
      next(error);
    }
  }

  public static async getWeeklySchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = ProgramController.extractCaller(req);
      const schedule = await ProgramService.getWeeklySchedule(caller);
      return res.status(200).json({ success: true, ...schedule });
    } catch (error) {
      next(error);
    }
  }

  public static async getByGrade(req: Request, res: Response, next: NextFunction) {
    try {
      const { grade } = req.params;
      const caller = ProgramController.extractCaller(req);
      const items = await ProgramService.getProgramsByGrade(grade, caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async getByTeacher(req: Request, res: Response, next: NextFunction) {
    try {
      const { teacherId } = req.params;
      const caller = ProgramController.extractCaller(req);
      const items = await ProgramService.getProgramsByTeacher(teacherId, caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }
}
