import { Request, Response, NextFunction } from 'express';
import { AttendanceService } from '../services/AttendanceService';
import { verifyAccessToken } from '../lib/serverAuth';

export class AttendanceController {
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

  public static async recordSession(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = AttendanceController.extractCaller(req);
      const session = await AttendanceService.recordAttendanceSession(req.body, caller);
      return res.status(200).json({ success: true, message: 'جلسه حضور و غیاب با موفقیت ثبت شد.', session });
    } catch (error) {
      next(error);
    }
  }

  public static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = AttendanceController.extractCaller(req);
      const sessions = await AttendanceService.getAllSessions(caller);
      return res.status(200).json({ success: true, count: sessions.length, sessions });
    } catch (error) {
      next(error);
    }
  }

  public static async getByProgram(req: Request, res: Response, next: NextFunction) {
    try {
      const { programId } = req.params;
      const caller = AttendanceController.extractCaller(req);
      const sessions = await AttendanceService.getAttendanceByProgram(programId, caller);
      return res.status(200).json({ success: true, count: sessions.length, sessions });
    } catch (error) {
      next(error);
    }
  }

  public static async getByStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId } = req.params;
      const caller = AttendanceController.extractCaller(req);
      const data = await AttendanceService.getAttendanceByStudent(studentId, caller);
      return res.status(200).json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  public static async justifyAbsence(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId, studentId, reason } = req.body;
      const caller = AttendanceController.extractCaller(req);
      const session = await AttendanceService.justifyAbsence(sessionId, studentId, reason || 'موجه شد', caller);
      return res.status(200).json({ success: true, message: 'غیبت با موفقیت موجه ثبت شد.', session });
    } catch (error) {
      next(error);
    }
  }

  public static async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = AttendanceController.extractCaller(req);
      const grade = req.query.grade as string;
      const programId = req.query.programId as string;
      const stats = await AttendanceService.getAttendanceStats({ grade, programId }, caller);
      return res.status(200).json({ success: true, stats });
    } catch (error) {
      next(error);
    }
  }
}
