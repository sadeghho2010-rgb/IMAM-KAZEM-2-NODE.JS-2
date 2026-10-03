import { Request, Response, NextFunction } from 'express';
import { LoanService } from '../services/LoanService';
import { verifyAccessToken } from '../lib/serverAuth';

export class LoanController {
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
      const caller = LoanController.extractCaller(req);
      const items = await LoanService.getAllLoans(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async getByStudent(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId } = req.params;
      const caller = LoanController.extractCaller(req);
      const items = await LoanService.getLoansByStudent(studentId, caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = LoanController.extractCaller(req);
      const loan = await LoanService.createLoan(req.body, caller);
      return res.status(200).json({ success: true, message: 'وام با موفقیت اعطا و ثبت گردید.', loan });
    } catch (error) {
      next(error);
    }
  }

  public static async recordPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { amount } = req.body;
      const caller = LoanController.extractCaller(req);
      const updated = await LoanService.recordInstallmentPayment(id, Number(amount), caller);
      return res.status(200).json({ success: true, message: 'پرداخت قسط با موفقیت ثبت گردید.', loan: updated });
    } catch (error) {
      next(error);
    }
  }

  public static async getOverdue(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = LoanController.extractCaller(req);
      const items = await LoanService.getOverdueLoans(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async getReport(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = LoanController.extractCaller(req);
      const report = await LoanService.getLoanReport(caller);
      return res.status(200).json({ success: true, ...report });
    } catch (error) {
      next(error);
    }
  }
}
