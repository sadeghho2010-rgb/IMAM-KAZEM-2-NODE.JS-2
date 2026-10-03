import { Request, Response, NextFunction } from 'express';
import { ExpenseService } from '../services/ExpenseService';
import { verifyAccessToken } from '../lib/serverAuth';

export class ExpenseController {
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
      const caller = ExpenseController.extractCaller(req);
      const items = await ExpenseService.getAllExpenses(caller);
      return res.status(200).json({ success: true, count: items.length, items });
    } catch (error) {
      next(error);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = ExpenseController.extractCaller(req);
      const expense = await ExpenseService.createExpense(req.body, caller);
      return res.status(200).json({ success: true, message: 'سند هزینه با موفقیت ثبت شد.', expense });
    } catch (error) {
      next(error);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const caller = ExpenseController.extractCaller(req);
      await ExpenseService.deleteExpense(id, caller);
      return res.status(200).json({ success: true, message: 'سند هزینه با موفقیت حذف گردید.' });
    } catch (error) {
      next(error);
    }
  }

  public static async getReport(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = ExpenseController.extractCaller(req);
      const report = await ExpenseService.getExpenseReport(req.query, caller);
      return res.status(200).json({ success: true, ...report });
    } catch (error) {
      next(error);
    }
  }
}
