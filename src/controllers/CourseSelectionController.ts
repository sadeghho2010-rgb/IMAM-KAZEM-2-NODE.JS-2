import { Request, Response, NextFunction } from 'express';
import { CourseSelectionService } from '../services/CourseSelectionService';
import { verifyAccessToken } from '../lib/serverAuth';

export class CourseSelectionController {
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
      const caller = CourseSelectionController.extractCaller(req);
      const items = await CourseSelectionService.getAllPeriods(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async savePeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = CourseSelectionController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) payload.id = req.params.id;
      const period = await CourseSelectionService.savePeriod(payload, caller);
      return res.status(200).json({ success: true, message: 'دوره انتخاب واحد ذخیره شد.', period });
    } catch (error) {
      next(error);
    }
  }

  public static async getAllRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const periodId = req.query.periodId as string;
      const caller = CourseSelectionController.extractCaller(req);
      const items = await CourseSelectionService.getAllRequests(periodId, caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async getRequestByStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId } = req.params;
      const periodId = req.query.periodId as string;
      const caller = CourseSelectionController.extractCaller(req);
      const item = await CourseSelectionService.getRequestByStudent(studentId, periodId, caller);
      return res.status(200).json({ success: true, request: item });
    } catch (error) {
      next(error);
    }
  }

  public static async submit(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = CourseSelectionController.extractCaller(req);
      const record = await CourseSelectionService.submitCourseSelection(req.body, caller);
      return res.status(200).json({ success: true, message: 'انتخاب واحد با موفقیت ارسال شد.', request: record });
    } catch (error) {
      next(error);
    }
  }

  public static async review(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, adminNotes } = req.body;
      const caller = CourseSelectionController.extractCaller(req);
      const updated = await CourseSelectionService.reviewRequest(id, status, adminNotes, caller);
      return res.status(200).json({ success: true, message: `وضعیت انتخاب واحد به ${status} تغییر یافت.`, request: updated });
    } catch (error) {
      next(error);
    }
  }
}
