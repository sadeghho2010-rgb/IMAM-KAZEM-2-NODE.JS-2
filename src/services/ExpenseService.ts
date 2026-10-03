import { z } from 'zod';
import { serverQueryCollection, serverSaveDoc, serverDeleteDoc, authorizeCollectionAccess } from '../lib/serverDataApi';
import { AppError } from '../lib/errorHandler';
import { logServerAudit } from '../lib/serverAuth';
import { logger } from '../lib/logger';
import { ExpenseRecord } from '../types';

export const ExpenseInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2, 'عنوان هزینه الزامی است.'),
  date: z.string().min(1, 'تاریخ سند هزینه الزامی است.'),
  amount: z.number().positive('مبلغ هزینه باید یک عدد مثبت باشد.'),
  payer: z.string().min(1, 'پرداخت‌کننده یا تنخواه‌دار الزامی است.'),
  category: z.string().min(1, 'دسته‌بندی یا موضوع هزینه الزامی است.'),
  budgetRowId: z.string().optional(),
  budgetRowTitle: z.string().optional(),
  budgetCode: z.string().optional(),
  description: z.string().optional(),
  recipient: z.string().optional(),
  invoiceNumber: z.string().optional(),
  attachmentUrl: z.string().optional()
});

export class ExpenseService {
  /**
   * Fetch all expense records
   */
  public static async getAllExpenses(callerUser?: any): Promise<ExpenseRecord[]> {
    const authCheck = authorizeCollectionAccess(callerUser, 'expenses', 'read');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما دسترسی به ثبت یا مشاهده هزینه‌ها را ندارید.', { statusCode: 403 });
    }

    const items = await serverQueryCollection('expenses', callerUser);
    return Array.isArray(items) ? (items as ExpenseRecord[]) : [];
  }

  /**
   * Create a new expense entry
   */
  public static async createExpense(rawData: unknown, callerUser?: any): Promise<ExpenseRecord> {
    const authCheck = authorizeCollectionAccess(callerUser, 'expenses', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز ثبت سند هزینه را ندارید.', { statusCode: 403 });
    }

    const parsed = ExpenseInputSchema.safeParse(rawData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'اطلاعات هزینه وارد شده نامعتبر است.';
      throw new AppError(firstError, { statusCode: 400 });
    }

    const validData = parsed.data;
    const id = validData.id || `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const expenseRecord: ExpenseRecord = {
      id,
      title: validData.title.trim(),
      date: validData.date,
      amount: validData.amount,
      payer: validData.payer.trim(),
      category: validData.category.trim(),
      budgetRowId: validData.budgetRowId,
      budgetRowTitle: validData.budgetRowTitle,
      budgetCode: validData.budgetCode,
      description: validData.description?.trim() || '',
      recipient: validData.recipient?.trim() || '',
      invoiceNumber: validData.invoiceNumber?.trim() || '',
      attachmentUrl: validData.attachmentUrl || '',
      status: 'approved',
      createdAt: nowIso,
      createdByName: callerUser?.username || 'system'
    };

    await serverSaveDoc('expenses', expenseRecord, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'CREATE_EXPENSE',
      entityType: 'expense',
      entityId: id,
      description: `ثبت سند هزینه به مبلغ ${validData.amount.toLocaleString()} تومان با عنوان: ${validData.title}`,
      newState: expenseRecord as unknown as Record<string, unknown>
    });

    logger.info(`[ExpenseService] Created expense ${id} (${validData.title}) by ${callerUser?.username || 'system'}`);
    return expenseRecord;
  }

  /**
   * Delete an expense record
   */
  public static async deleteExpense(id: string, callerUser?: any): Promise<boolean> {
    const authCheck = authorizeCollectionAccess(callerUser, 'expenses', 'delete');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'تنها مسئول مالی یا مدیر ارشد مجاز به حذف سند هزینه هستند.', { statusCode: 403 });
    }

    await serverDeleteDoc('expenses', id, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'DELETE_EXPENSE',
      entityType: 'expense',
      entityId: id,
      description: `حذف سند هزینه با شناسه ${id}`
    });

    logger.warn(`[ExpenseService] Deleted expense ${id} by ${callerUser?.username || 'system'}`);
    return true;
  }

  /**
   * Get expense summary report grouped by category
   */
  public static async getExpenseReport(filters?: any, callerUser?: any) {
    const expenses = await this.getAllExpenses(callerUser);
    
    let totalExpenseAmount = 0;
    const categoryTotals: Record<string, number> = {};

    expenses.forEach(e => {
      const amt = Number(e.amount || 0);
      totalExpenseAmount += amt;
      const cat = e.category || 'متفرقه';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    });

    return {
      totalRecords: expenses.length,
      totalExpenseAmount,
      categoryTotals,
      expenses
    };
  }
}
