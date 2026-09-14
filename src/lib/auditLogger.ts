import { localDb } from './localDb';
import { AuditLog, AuditActionType, AppModuleId, UserRole, UserLevel } from '../types';

export interface LogActivityParams {
  userId?: string;
  userName?: string;
  username?: string;
  userRole?: UserRole;
  userRoleTitle?: string;
  userLevel?: UserLevel;
  actionType: AuditActionType;
  module: AppModuleId | string;
  moduleTitle: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  description: string;
  previousState?: any;
  newState?: any;
}

export function getFormattedShamsiNow(): { dateStr: string; timeStr: string; isoStr: string } {
  const now = new Date();
  const isoStr = now.toISOString();
  const timeStr = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  try {
    const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    const dateStr = `${year}/${month}/${day}`;
    return { dateStr, timeStr, isoStr };
  } catch (e) {
    return { dateStr: now.toLocaleDateString('fa-IR'), timeStr, isoStr };
  }
}

export async function logAuditActivity(params: LogActivityParams): Promise<string> {
  const { dateStr, timeStr, isoStr } = getFormattedShamsiNow();

  let uName = params.userName || 'کاربر سیستم';
  let uUsername = params.username || 'user';
  let uRole: UserRole = params.userRole || 'super_admin';
  let uRoleTitle = params.userRoleTitle || 'کاربر';
  let uLevel: UserLevel = params.userLevel || 1;

  try {
    const stored = localStorage.getItem('system_auth_current_user_v2');
    if (stored) {
      const p = JSON.parse(stored);
      if (p) {
        if (!params.userName) uName = p.name || p.fullName || p.username;
        if (!params.username) uUsername = p.username;
        if (!params.userRole) uRole = p.role;
        if (!params.userRoleTitle) uRoleTitle = p.roleTitle;
        if (!params.userLevel) uLevel = p.level;
      }
    }
  } catch (e) {
    // fallback ignore
  }

  const logEntry: AuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: isoStr,
    shamsiDate: dateStr,
    shamsiTime: timeStr,
    userId: params.userId,
    userName: uName,
    username: uUsername,
    userRole: uRole,
    userRoleTitle: uRoleTitle,
    userLevel: uLevel,
    actionType: params.actionType,
    module: params.module,
    moduleTitle: params.moduleTitle,
    entityType: params.entityType,
    entityId: params.entityId,
    entityName: params.entityName,
    description: params.description,
    previousState: params.previousState ? JSON.parse(JSON.stringify(params.previousState)) : undefined,
    newState: params.newState ? JSON.parse(JSON.stringify(params.newState)) : undefined,
    isReverted: false,
  };

  await localDb.addDoc('audit_logs', logEntry);
  return logEntry.id;
}

export async function revertAuditActivity(logId: string, currentUserName?: string): Promise<{ success: boolean; message: string }> {
  try {
    const log = await localDb.getDoc<AuditLog>('audit_logs', logId);
    if (!log) {
      return { success: false, message: 'رکورد فعالیت مورد نظر در سامانه یافت نشد.' };
    }
    if (log.isReverted) {
      return { success: false, message: 'این تغییرات قبلاً بازگردانده شده است.' };
    }

    const { entityType, entityId, actionType, previousState, newState, entityName, moduleTitle } = log;

    if (actionType === 'delete') {
      if (!previousState) {
        return { success: false, message: 'اطلاعات وضعیت قبلی برای استرداد حذف موجود نیست.' };
      }
      // Re-add deleted document
      await localDb.addDoc(entityType, previousState);
    } else if (actionType === 'create') {
      // Revert creation -> delete document
      await localDb.deleteDoc(entityType, entityId);
    } else if (actionType === 'update' || actionType === 'status_change') {
      if (!previousState) {
        return { success: false, message: 'اطلاعات وضعیت قبلی برای بازگردانی تغییرات موجود نیست.' };
      }
      await localDb.updateDoc(entityType, entityId, previousState);
    } else if (actionType === 'revert') {
      return { success: false, message: 'امکان استرداد مجدد یک عملیات بازگردانی وجود ندارد.' };
    }

    const { dateStr, timeStr } = getFormattedShamsiNow();
    await localDb.updateDoc('audit_logs', logId, {
      isReverted: true,
      revertedAt: `${dateStr} - ${timeStr}`,
      revertedByUserName: currentUserName || 'مدیریت سیستم'
    });

    // Log the revert action itself
    await logAuditActivity({
      userName: currentUserName,
      actionType: 'revert',
      module: log.module,
      moduleTitle,
      entityType,
      entityId,
      entityName,
      description: `استرداد و بازگردانی تغییرات: «${log.description}»`,
      previousState: newState,
      newState: previousState
    });

    return {
      success: true,
      message: `تغییرات با موفقیت بازگردانده شد و وضعیت قبلی سیستم احیا گردید.`
    };
  } catch (e: any) {
    console.error('Error reverting activity:', e);
    return { success: false, message: `خطا در استرداد تغییرات: ${e?.message || 'خطای غیرمنتظره'}` };
  }
}
