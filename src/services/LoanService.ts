import { z } from 'zod';
import { serverQueryCollection, serverSaveDoc, serverDeleteDoc, authorizeCollectionAccess } from '../lib/serverDataApi';
import { AppError } from '../lib/errorHandler';
import { logServerAudit } from '../lib/serverAuth';
import { logger } from '../lib/logger';
import { StudentClaimRecord } from '../types';

export const LoanInputSchema = z.object({
  id: z.string().optional(),
  studentId: z.string().min(1, 'شناسه طلبه الزامی است.'),
  studentName: z.string().min(1, 'نام طلبه الزامی است.'),
  claimTitle: z.string().min(2, 'عنوان وام یا درخواست الزامی است.').default('وام قرض‌الحسنه'),
  totalDebtAmount: z.number().positive('مبلغ کل وام باید مثبت باشد.'),
  monthlyDeductionAmount: z.number().positive('مبلغ قسط ماهانه باید مثبت باشد.'),
  destinationAccountId: z.string().optional().default('account_qard_fund'),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional()
});

export class LoanService {
  /**
   * Fetch all loans and claims records
   */
  public static async getAllLoans(callerUser?: any): Promise<StudentClaimRecord[]> {
    const authCheck = authorizeCollectionAccess(callerUser, 'loans', 'read');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما دسترسی به صندوق وام و مطالبات را ندارید.', { statusCode: 403 });
    }

    const items = await serverQueryCollection('loans', callerUser);
    return Array.isArray(items) ? (items as StudentClaimRecord[]) : [];
  }

  /**
   * Fetch active loans for a student
   */
  public static async getLoansByStudent(studentId: string, callerUser?: any): Promise<StudentClaimRecord[]> {
    const loans = await this.getAllLoans(callerUser);
    return loans.filter(l => l.studentId === studentId);
  }

  /**
   * Grant a new loan to a student with validation and audit log
   */
  public static async createLoan(rawData: unknown, callerUser?: any): Promise<StudentClaimRecord> {
    const authCheck = authorizeCollectionAccess(callerUser, 'loans', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز پرداخت یا ثبت وام را ندارید.', { statusCode: 403 });
    }

    const parsed = LoanInputSchema.safeParse(rawData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'اطلاعات وارد شده برای وام نامعتبر است.';
      throw new AppError(firstError, { statusCode: 400 });
    }

    const validData = parsed.data;
    const id = validData.id || `loan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const loanRecord: StudentClaimRecord = {
      id,
      claimCategoryId: 'cat_qard_loan',
      claimTitle: validData.claimTitle,
      studentId: validData.studentId,
      studentName: validData.studentName,
      destinationAccountId: validData.destinationAccountId || 'account_qard_fund',
      totalDebtAmount: validData.totalDebtAmount,
      monthlyDeductionAmount: validData.monthlyDeductionAmount,
      paidAmount: 0,
      remainingAmount: validData.totalDebtAmount,
      status: 'active',
      startDate: validData.startDate || new Date().toLocaleDateString('fa-IR'),
      notes: validData.notes || '',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await serverSaveDoc('loans', loanRecord, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'CREATE_LOAN',
      entityType: 'loan',
      entityId: id,
      description: `اعطای وام به مبلغ ${validData.totalDebtAmount.toLocaleString()} تومان به طلبه: ${validData.studentName}`,
      newState: loanRecord as unknown as Record<string, unknown>
    });

    logger.info(`[LoanService] Created loan ${id} for student ${validData.studentName}`);
    return loanRecord;
  }

  /**
   * Record installment repayment
   */
  public static async recordInstallmentPayment(loanId: string, amount: number, callerUser?: any): Promise<StudentClaimRecord> {
    const authCheck = authorizeCollectionAccess(callerUser, 'loans', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز ثبت قسط وام را ندارید.', { statusCode: 403 });
    }

    if (!amount || amount <= 0) {
      throw new AppError('مبلغ بازپرداخت قسط باید عدد مثبت باشد.', { statusCode: 400 });
    }

    const loans = await this.getAllLoans(callerUser);
    const loan = loans.find(l => l.id === loanId);
    if (!loan) {
      throw new AppError('وام مورد نظر یافت نشد.', { statusCode: 404 });
    }

    const newPaidAmount = (loan.paidAmount || 0) + amount;
    const newRemainingAmount = Math.max(0, loan.totalDebtAmount - newPaidAmount);
    const isCompleted = newRemainingAmount <= 0;

    const updatedLoan: StudentClaimRecord = {
      ...loan,
      paidAmount: newPaidAmount,
      remainingAmount: newRemainingAmount,
      status: isCompleted ? 'completed' : loan.status,
      updatedAt: new Date().toISOString()
    };

    await serverSaveDoc('loans', updatedLoan, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'RECORD_LOAN_INSTALLMENT',
      entityType: 'loan',
      entityId: loanId,
      description: `ثبت بازپرداخت قسط وام به مبلغ ${amount.toLocaleString()} تومان برای طلبه: ${loan.studentName} (مانده: ${newRemainingAmount.toLocaleString()})`
    });

    return updatedLoan;
  }

  /**
   * Get overdue loans (active loans with past due date or remaining balance exceeding threshold)
   */
  public static async getOverdueLoans(callerUser?: any): Promise<StudentClaimRecord[]> {
    const loans = await this.getAllLoans(callerUser);
    return loans.filter(l => l.status === 'active' && l.remainingAmount > 0 && (l as any).isOverdue);
  }

  /**
   * Generate loan portfolio summary report
   */
  public static async getLoanReport(callerUser?: any) {
    const loans = await this.getAllLoans(callerUser);
    let totalLent = 0;
    let totalRepaid = 0;
    let totalRemaining = 0;
    let activeCount = 0;
    let completedCount = 0;

    loans.forEach(l => {
      totalLent += Number(l.totalDebtAmount || 0);
      totalRepaid += Number(l.paidAmount || 0);
      totalRemaining += Number(l.remainingAmount || 0);
      if (l.status === 'active') activeCount++;
      else if (l.status === 'completed') completedCount++;
    });

    return {
      totalLoans: loans.length,
      activeCount,
      completedCount,
      totalLent,
      totalRepaid,
      totalRemaining,
      loans
    };
  }
}
