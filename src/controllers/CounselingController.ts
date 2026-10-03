import { Request, Response, NextFunction } from 'express';
import { CounselingService } from '../services/CounselingService';
import { verifyAccessToken } from '../lib/serverAuth';

export class CounselingController {
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

  public static async getAllGrades(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId, courseTitle } = req.query;
      const caller = CounselingController.extractCaller(req);
      const items = await CounselingService.getAllGrades({ studentId: studentId as string, courseTitle: courseTitle as string }, caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async getByStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId } = req.params;
      const caller = CounselingController.extractCaller(req);
      const items = await CounselingService.getGradesByStudent(studentId, caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async saveGrade(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = CounselingController.extractCaller(req);
      const payload = { ...req.body };
      if (req.params.id) payload.id = req.params.id;
      const grade = await CounselingService.saveCounselingGrade(payload, caller);
      return res.status(200).json({ success: true, message: 'ارزیابی کلاس مشاوره با موفقیت ثبت شد.', grade });
    } catch (error) {
      next(error);
    }
  }

  public static async deleteGrade(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const caller = CounselingController.extractCaller(req);
      await CounselingService.deleteCounselingGrade(id, caller);
      return res.status(200).json({ success: true, message: 'نمره مشاوره با موفقیت حذف گردید.' });
    } catch (error) {
      next(error);
    }
  }

  public static async getProposals(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = CounselingController.extractCaller(req);
      const items = await CounselingService.getAdvisorProposals(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async saveProposal(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = CounselingController.extractCaller(req);
      const proposal = await CounselingService.saveAdvisorProposal(req.body, caller);
      return res.status(200).json({ success: true, message: 'طرح پیشنهادی مشاور ثبت گردید.', proposal });
    } catch (error) {
      next(error);
    }
  }
}
