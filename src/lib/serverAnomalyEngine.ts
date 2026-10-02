import { AnomalyLog, AnomalySeverity } from '../types';
import { serverSaveDoc, serverQueryCollection } from './serverDataApi';
import { logServerAudit } from './serverAuth';

/**
 * Checks mutations against anomaly detection heuristics.
 */
export async function evaluateMutationForAnomaly(params: {
  userId: string;
  userName: string;
  collection: string;
  action: 'save' | 'delete' | 'bulk_update';
  recordsCount?: number;
  docId?: string;
  newData?: any;
  oldData?: any;
  ipAddress?: string;
}): Promise<AnomalyLog | null> {
  const { userId, userName, collection, action, recordsCount = 1, docId, newData, oldData, ipAddress } = params;

  let severity: AnomalySeverity | null = null;
  let reason = '';
  let description = '';

  // 1. Bulk Mutations rule (> 10 records affected or bulk deletion)
  if (recordsCount >= 10 || (action === 'delete' && recordsCount > 1)) {
    severity = 'high';
    reason = `تغییر دسته‌جمعی و با حجم بالا در جدول ${collection} (${recordsCount} رکورد)`;
    description = `کاربر ${userName} اقدام به عملیات دسته‌جمعی (${action}) بر روی ${recordsCount} رکورد در بخش ${collection} نمود.`;
  }

  // 2. High Financial Value Modifications (e.g. amount > 50,000,000 Tomans or high change)
  if (newData && typeof newData === 'object') {
    const amount = Number(newData.amount || newData.totalAmount || newData.totalPayoutAmount || 0);
    const oldAmount = oldData ? Number(oldData.amount || oldData.totalAmount || oldData.totalPayoutAmount || 0) : 0;
    
    if (amount >= 50000000 || Math.abs(amount - oldAmount) >= 25000000) {
      severity = severity === 'critical' ? 'critical' : 'medium';
      reason = `تغییر مبلغ مالی فراتر از آستانه مجاز عادی (${amount.toLocaleString('fa-IR')} تومان)`;
      description = `تغییر حساس در مبالغ مالی در سند ${docId || ''} توسط کاربر ${userName} ثبت شد.`;
    }
  }

  // 3. Off-hours Critical Mutation (11 PM to 5 AM)
  const hour = new Date().getHours();
  if (hour >= 23 || hour <= 5) {
    if (['system_users', 'backup_snapshots', 'finance_tuition', 'presence_hours'].includes(collection)) {
      severity = 'high';
      reason = `ویرایش بخش‌های حیاتی (${collection}) در خارج از ساعات اداری (${hour}:00 بامداد)`;
      description = `عملیات خارج از شیفت کاری اداری در بخش ${collection} توسط ${userName} صورت گرفت.`;
    }
  }

  if (!severity) {
    return null;
  }

  const anomalyId = 'anom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const anomalyRecord: AnomalyLog = {
    id: anomalyId,
    action_type: `${action}:${collection}`,
    user_id: userId,
    user_name: userName,
    severity,
    description,
    detection_reason: reason,
    original_state: {
      collection,
      docId,
      previousData: oldData || null
    },
    affected_records_count: recordsCount,
    is_resolved: false,
    created_at: new Date().toISOString()
  };

  try {
    await serverSaveDoc('anomaly_logs', anomalyId, anomalyRecord);
  } catch (err) {
    console.warn('Could not save anomaly log:', err);
  }

  return anomalyRecord;
}

/**
 * Executes a one-click rollback of an anomaly to restore the original state.
 */
export async function executeAnomalyRollback(params: {
  anomalyId: string;
  operatorId: string;
  operatorName: string;
  ipAddress?: string;
}): Promise<{ success: boolean; message: string }> {
  const { anomalyId, operatorId, operatorName, ipAddress } = params;

  const anomalies = (await serverQueryCollection('anomaly_logs')) as AnomalyLog[];
  const targetAnomaly = anomalies.find(a => a.id === anomalyId);

  if (!targetAnomaly) {
    return { success: false, message: 'لاگ ناهنجاری مورد نظر یافت نشد.' };
  }

  if (targetAnomaly.is_resolved) {
    return { success: false, message: 'این ناهنجاری قبلاً بازگردانی و مختومه شده است.' };
  }

  const originalState = targetAnomaly.original_state;
  if (!originalState || !originalState.collection) {
    return { success: false, message: 'اطلاعات وضعیت پیشین (Original State) برای این رکورد ثبت نشده است.' };
  }

  const { collection, docId, previousData } = originalState;

  try {
    if (previousData && docId) {
      // Revert doc to previous data
      await serverSaveDoc(collection, docId, previousData);
    } else if (docId && !previousData) {
      // It was an unwanted addition, delete it
      const { serverDeleteDoc } = await import('./serverDataApi');
      await serverDeleteDoc(collection, docId);
    }

    // Mark anomaly as resolved
    const updatedAnomaly: AnomalyLog = {
      ...targetAnomaly,
      is_resolved: true,
      resolved_by: operatorName,
      resolved_at: new Date().toISOString()
    };
    await serverSaveDoc('anomaly_logs', anomalyId, updatedAnomaly);

    // Record in Audit Log
    await logServerAudit({
      userId: operatorId,
      username: operatorName,
      action: 'ANOMALY_ROLLBACK_EXECUTED',
      entityType: 'anomaly_detection',
      entityId: anomalyId,
      description: `بازگردانی هوشمند به وضعیت امن برای ناهنجاری ${anomalyId} در جدول ${collection}`,
      ipAddress: ipAddress || '0.0.0.0'
    });

    return {
      success: true,
      message: `اطلاعات بخش ${collection} با موفقیت به حالت پیشین قبل از ناهنجاری بازگردانی شد.`
    };
  } catch (err: any) {
    console.error('Error executing anomaly rollback:', err);
    return { success: false, message: err?.message || 'خطا در اجرای بازگردانی رولبک.' };
  }
}
