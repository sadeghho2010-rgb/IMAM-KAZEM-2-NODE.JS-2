import { z } from 'zod';
import { serverQueryCollection, serverSaveDoc, serverDeleteDoc, authorizeCollectionAccess } from '../lib/serverDataApi';
import { AppError } from '../lib/errorHandler';
import { logServerAudit } from '../lib/serverAuth';
import { logger } from '../lib/logger';
import { TuitionCalculationBreakdown, TuitionCalculationSettings, StudentFinancialProfile } from '../types';

export const TuitionCalculationInputSchema = z.object({
  studentId: z.string().min(1, 'شناسه طلبه الزامی است.'),
  studentName: z.string().min(1, 'نام طلبه الزامی است.'),
  maritalStatus: z.enum(['مجرد', 'متاهل']).optional(),
  isMarried: z.boolean().optional(),
  childrenCount: z.number().nonnegative().optional(),
  livingStatus: z.string().optional(),
  isTammam: z.boolean().optional(),
  bankAccount: z.string().optional(),
  bankSheba: z.string().optional(),
  tuitionCode: z.string().optional(),
  
  // Custom manual overrides / additions
  manualAdjustmentAmount: z.number().optional(),
  manualAdjustmentReason: z.string().optional(),
  educationAdjustmentAmount: z.number().optional(),
  educationAdjustmentReason: z.string().optional()
});

export class TuitionService {
  /**
   * Pure Business Logic: Calculate full tuition breakdown according to BUSINESS_RULES
   */
  public static calculateTuition(
    profile: StudentFinancialProfile,
    settings?: Partial<TuitionCalculationSettings>
  ): TuitionCalculationBreakdown {
    const isMarried = profile.maritalStatus === 'متاهل' || Boolean(profile.isMarried);
    
    // 1. Base Tuition
    const baseTuition = isMarried 
      ? (settings?.marriedBaseTuition || settings?.baseMarriedTuition || 3000000)
      : (settings?.singleBaseTuition || settings?.baseSingleTuition || 2000000);

    // 2. Marriage Bonus
    let maritalBonus = 0;
    if (isMarried && settings?.hasMarriageBonus) {
      if (settings.marriageBonusType === 'percentage' && settings.marriageBonusPercent) {
        maritalBonus = Math.round((baseTuition * settings.marriageBonusPercent) / 100);
      } else if (settings.marriageBonusAmount) {
        maritalBonus = settings.marriageBonusAmount;
      }
    }

    // 3. Child Allowance
    const children = profile.childrenCount || 0;
    const childRate = settings?.hasChildAllowance ? (settings.childAllowance || settings.childAllowancePerChild || 300000) : 0;
    const childAllowanceTotal = children * childRate;

    // 4. Turban Allowance (معمم بودن)
    const turbanAllowance = (profile.isTammam || profile.isRobed) && settings?.hasTurbanAllowance
      ? (settings.turbanAllowance || settings.clericalHabitBonus || 400000)
      : 0;

    // 5. Housing Allowance (کمک هزینه مسکن)
    let housingAllowance = 0;
    if (settings?.hasHousingAllowance) {
      if (profile.livingStatus === 'اجاره ای') {
        housingAllowance = settings.housingAllowanceRented || settings.housingSubsidy || 500000;
      } else if (profile.livingStatus === 'خوابگاه') {
        housingAllowance = settings.housingAllowanceDorm || 200000;
      }
    }

    // 6. Study Bonus / Penalty
    let studyBonusAmount = 0;
    let studyPenaltyAmount = 0;
    const studyLogged = profile.studyHoursLogged || 0;
    const mandatoryHours = 40; // standard 40h
    if (studyLogged > mandatoryHours && settings?.studyBonusEnabled) {
      const extraHours = studyLogged - mandatoryHours;
      studyBonusAmount = Math.round(extraHours * (settings.studyBonusPerHour || settings.studyBonusRatePerHour || 20000));
    } else if (studyLogged < mandatoryHours && settings?.studyPenaltyEnabled) {
      const shortageHours = mandatoryHours - studyLogged;
      studyPenaltyAmount = Math.round(shortageHours * (settings.studyPenaltyPerHour || settings.studyPenaltyRatePerHour || 15000));
    }

    // 7. Absence Penalty (جریمه غیبت)
    let absencePenaltyAmount = 0;
    const unexcused = profile.unexcusedAbsences || 0;
    if (unexcused > 0 && settings?.absenceDeductionEnabled) {
      absencePenaltyAmount = Math.round(unexcused * (settings.absencePenaltyPerSession || settings.absencePenaltyUnexcusedAmount || 50000));
    }

    // 8. General Incentive (پاداش تشویقی عمومی)
    let generalIncentiveAmount = 0;
    if (settings?.enableGeneralIncentive) {
      if (settings.generalIncentiveType === 'percentage' && settings.generalIncentivePercent) {
        generalIncentiveAmount = Math.round((baseTuition * settings.generalIncentivePercent) / 100);
      } else if (settings.generalIncentiveAmount) {
        generalIncentiveAmount = settings.generalIncentiveAmount;
      }
    }

    // Sum of Additions
    const totalAdditions = maritalBonus + childAllowanceTotal + turbanAllowance + housingAllowance + studyBonusAmount + generalIncentiveAmount;
    
    // Type 1 Deductions (Absence & Study Penalties)
    const type1DeductionsTotal = absencePenaltyAmount + studyPenaltyAmount;

    // Gross Earned Tuition (استحقاقی ناخالص)
    const grossEarnedTuition = Math.max(0, baseTuition + totalAdditions - type1DeductionsTotal);

    // 9. Type 2 Deductions (کسورات واریزی به حساب‌های مقصد)
    const lunchDeductionAmount = Math.round((profile.lunchDaysCount || profile.monthlyLunchDays || 0) * (settings?.lunchCostPerDay || settings?.dailyLunchCost || 35000));
    const dinnerDeductionAmount = Math.round((profile.dinnerDaysCount || profile.monthlyDinnerDays || 0) * (settings?.dinnerCostPerDay || settings?.dailyDinnerCost || 25000));
    const totalMealDeduction = lunchDeductionAmount + dinnerDeductionAmount;

    const loanInstallmentDeduction = profile.monthlyLoanInstallment || profile.activeLoanInstallment || 0;
    const fundContributionDeduction = profile.fundContributionMonthly || profile.fundContribution || 0;

    const type2DeductionsTotal = totalMealDeduction + loanInstallmentDeduction + fundContributionDeduction;

    // Net Payable
    const netPayableTuition = Math.max(0, grossEarnedTuition - type2DeductionsTotal);

    return {
      studentId: profile.studentId,
      studentName: profile.studentName,
      nationalId: profile.nationalId,
      grade: profile.grade,
      maritalStatus: profile.maritalStatus || (isMarried ? 'متاهل' : 'مجرد'),
      livingStatus: profile.livingStatus,
      isTammam: profile.isTammam,
      bankAccount: profile.bankAccount,
      bankSheba: profile.bankSheba,
      tuitionCode: (profile as any).tuitionCode || '',
      
      baseTuition,
      baseAmount: baseTuition,
      maritalBonus,
      childAllowanceTotal,
      childAllowance: childAllowanceTotal,
      turbanAllowance,
      housingAllowance,
      
      studyBonusAmount,
      studyBonus: studyBonusAmount,
      studyPenaltyAmount,
      
      unexcusedAbsenceCount: unexcused,
      absencePenaltyAmount,
      absenceDeduction: absencePenaltyAmount,
      
      lunchDaysCount: profile.lunchDaysCount || 0,
      lunchDeductionAmount,
      lunchDeduction: lunchDeductionAmount,
      dinnerDaysCount: profile.dinnerDaysCount || 0,
      dinnerDeductionAmount,
      dinnerDeduction: dinnerDeductionAmount,
      totalMealDeduction,
      
      loanInstallmentDeduction,
      loanDeduction: loanInstallmentDeduction,
      fundContributionDeduction,
      fundDeduction: fundContributionDeduction,
      
      generalIncentiveAmount,
      totalAdditions,
      totalEarnings: baseTuition + totalAdditions,
      type1DeductionsTotal,
      grossEarnedTuition,
      type2DeductionsTotal,
      netPayableTuition,
      netPayable: netPayableTuition
    };
  }

  /**
   * Fetch all tuition records or periods
   */
  public static async getAllTuitionRecords(filters?: any, callerUser?: any) {
    const authCheck = authorizeCollectionAccess(callerUser, 'tuition_records', 'read');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما دسترسی به امور مالی و شهریه را ندارید.', { statusCode: 403 });
    }

    const items = await serverQueryCollection('tuition_records', callerUser);
    const records = Array.isArray(items) ? items : [];

    if (filters?.periodId) {
      return records.filter((r: any) => r.periodId === filters.periodId);
    }
    if (filters?.status) {
      return records.filter((r: any) => r.status === filters.status);
    }

    return records;
  }

  /**
   * Fetch tuition history for a single student
   */
  public static async getTuitionByStudent(studentId: string, callerUser?: any) {
    const records = await this.getAllTuitionRecords({}, callerUser);
    return records.filter((r: any) => r.studentId === studentId);
  }

  /**
   * Save / Issue a tuition calculation record
   */
  public static async saveTuitionRecord(rawData: unknown, callerUser?: any) {
    const authCheck = authorizeCollectionAccess(callerUser, 'tuition_records', 'write');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'شما مجوز ثبت یا ویرایش محاسبات شهریه را ندارید.', { statusCode: 403 });
    }

    const id = (rawData as any).id || `tui_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const record = {
      ...(rawData as object),
      id,
      updatedAt: new Date().toISOString()
    };

    await serverSaveDoc('tuition_records', record, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'SAVE_TUITION_RECORD',
      entityType: 'tuition_record',
      entityId: id,
      description: `ثبت فاکتور شهریه برای طلبه: ${(rawData as any).studentName || id}`
    });

    logger.info(`[TuitionService] Saved tuition record ${id} by ${callerUser?.username || 'system'}`);
    return record;
  }

  /**
   * Delete a tuition record
   */
  public static async deleteTuitionRecord(id: string, callerUser?: any) {
    const authCheck = authorizeCollectionAccess(callerUser, 'tuition_records', 'delete');
    if (!authCheck.allowed) {
      throw new AppError(authCheck.reason || 'تنها مسئول مالی یا مدیر ارشد مجاز به حذف سند شهریه است.', { statusCode: 403 });
    }

    await serverDeleteDoc('tuition_records', id, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'DELETE_TUITION_RECORD',
      entityType: 'tuition_record',
      entityId: id,
      description: `حذف فاکتور شهریه با شناسه ${id}`
    });

    return true;
  }

  /**
   * Mark a tuition record as paid
   */
  public static async markAsPaid(recordId: string, callerUser?: any) {
    const records = await this.getAllTuitionRecords({}, callerUser);
    const target = records.find((r: any) => r.id === recordId);
    if (!target) {
      throw new AppError('فاکتور شهریه مورد نظر یافت نشد.', { statusCode: 404 });
    }

    const updated = {
      ...target,
      status: 'paid',
      paidAt: new Date().toISOString(),
      paidBy: callerUser?.username || 'system'
    };

    await serverSaveDoc('tuition_records', updated, callerUser);

    await logServerAudit({
      userId: callerUser?.userId || callerUser?.id,
      username: callerUser?.username || 'system',
      userRole: callerUser?.role,
      action: 'MARK_TUITION_PAID',
      entityType: 'tuition_record',
      entityId: recordId,
      description: `تغییر وضعیت فاکتور شهریه به "پرداخت شده" برای طلبه: ${target.studentName}`
    });

    return updated;
  }

  /**
   * Generate comprehensive financial summary report
   */
  public static async getTuitionReport(periodId?: string, filters?: any, callerUser?: any) {
    const records = await this.getAllTuitionRecords({ periodId, ...filters }, callerUser);
    
    let totalGrossEarned = 0;
    let totalType2Deductions = 0;
    let totalNetPayable = 0;
    let paidCount = 0;
    let pendingCount = 0;

    records.forEach((r: any) => {
      totalGrossEarned += Number(r.grossEarnedTuition || r.totalEarnings || 0);
      totalType2Deductions += Number(r.type2DeductionsTotal || 0);
      totalNetPayable += Number(r.netPayableTuition || r.netPayable || 0);
      if (r.status === 'paid') paidCount++;
      else pendingCount++;
    });

    return {
      periodId: periodId || 'all',
      totalRecords: records.length,
      paidCount,
      pendingCount,
      totalGrossEarned,
      totalType2Deductions,
      totalNetPayable,
      records
    };
  }
}
