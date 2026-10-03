import { Request, Response, NextFunction } from 'express';
import { StudentService } from '../services/StudentService';
import { verifyAccessToken } from '../lib/serverAuth';

export class StudentController {
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
      const caller = StudentController.extractCaller(req);
      const items = await StudentService.getAllStudents(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const caller = StudentController.extractCaller(req);
      const student = await StudentService.getStudentById(id, caller);
      return res.status(200).json({ success: true, student });
    } catch (error) {
      next(error);
    }
  }

  public static async save(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = StudentController.extractCaller(req);
      const student = await StudentService.saveStudent(req.body, caller);
      return res.status(200).json({ success: true, message: 'پرونده با موفقیت ذخیره شد.', student });
    } catch (error) {
      next(error);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const caller = StudentController.extractCaller(req);
      await StudentService.deleteStudent(id, caller);
      return res.status(200).json({ success: true, message: 'پرونده با موفقیت حذف گردید.' });
    } catch (error) {
      next(error);
    }
  }
}
