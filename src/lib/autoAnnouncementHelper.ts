import {
  Announcement,
  MealReservationPeriod,
  StudyPeriod
} from '../types';
import {
  dateToShamsi,
  normalizeShamsiDateStr,
  shamsiToDate,
  toEnglishDigits
} from './jalali';

export const AUTO_STUDY_PERIOD_PREFIX = 'auto_study_period_';
export const AUTO_MEAL_PERIOD_PREFIX = 'auto_meal_period_';

export function getStudyPeriodAnnouncementId(periodId: string): string {
  return `${AUTO_STUDY_PERIOD_PREFIX}${String(periodId).trim()}`;
}

export function getMealPeriodAnnouncementId(periodId: string): string {
  return `${AUTO_MEAL_PERIOD_PREFIX}${String(periodId).trim()}`;
}

/**
 * Shared authorization check matching backend RBAC in serverDataApi.ts:
 * Strictly non-read-only Super Admin (excluding school_manager/RAHNAMA) and Education Officer.
 */
export function canUserManageAnnouncements(user: any): boolean {
  if (!user) return false;
  if (user.isReadOnly === true || user.canEdit === false) return false;
  const uName = String(user.username || '').toUpperCase().trim();
  const role = String(user.role || '').trim();
  const level = Number(user.level) || 0;
  if (role === 'school_manager' || role === 'manager_principal' || uName === 'RAHNAMA') {
    return false;
  }
  return (
    role === 'super_admin' ||
    uName === 'SADEGH' ||
    (level === 1 && role !== 'school_manager') ||
    role === 'education_manager' ||
    role === 'education_officer' ||
    uName === 'SHAH' ||
    uName === 'SHAHPOORI'
  );
}

function formatReadableShamsiDate(raw?: string | null): string {
  if (!raw) return '';
  const str = String(raw).trim();
  if (!str) return '';
  const eng = toEnglishDigits(str);
  if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(eng)) {
    return normalizeShamsiDateStr(eng);
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    try {
      return parsed.toLocaleDateString('fa-IR');
    } catch {
      return dateToShamsi(parsed);
    }
  }
  return str;
}

/**
 * Evaluates whether a StudyPeriod is currently open for registration.
 * Mirrors logic in src/components/study/studyUtils.ts (isPeriodClosed).
 */
export function isStudyPeriodCurrentlyOpen(period?: Partial<StudyPeriod> | null): boolean {
  if (!period) return false;
  if ((period as any).isDeleted === true || (period as any).status === 'deleted') {
    return false;
  }
  if (
    period.isClosed === true ||
    (period as any).isClosed === 'true' ||
    period.status === 'closed' ||
    period.isActive === false ||
    (period as any).status === 'inactive' ||
    (period as any).status === 'locked'
  ) {
    return false;
  }
  if ((period as any).manuallyOpened === true && period.isClosed === false) {
    return true;
  }
  if (period.deadlineDate) {
    try {
      const dStr = toEnglishDigits(String(period.deadlineDate)).trim();
      const now = new Date();
      let deadline: Date | null = null;
      if (dStr.includes('/') || dStr.includes('-')) {
        const parts = dStr.replace(/-/g, '/').split('/');
        if (parts.length === 3 && parseInt(parts[0], 10) < 1700) {
          deadline = shamsiToDate(dStr);
          deadline.setHours(23, 59, 59, 999);
        } else {
          deadline = new Date(dStr);
        }
      } else {
        deadline = new Date(dStr);
      }
      if (deadline && !isNaN(deadline.getTime())) {
        return now.getTime() <= deadline.getTime();
      }
    } catch {
      return true;
    }
  }
  return true;
}

/**
 * Evaluates whether a MealReservationPeriod is currently open for reservation.
 * Mirrors logic in src/components/finance/LunchManagement.tsx (getPeriodStatusInfo).
 */
export function isMealPeriodCurrentlyOpen(period?: Partial<MealReservationPeriod> | null): boolean {
  if (!period) return false;
  if ((period as any).isDeleted === true || (period as any).status === 'deleted') {
    return false;
  }
  if (period.isManuallyClosed === true || period.status !== 'open') {
    return false;
  }
  if (period.deadlineDate) {
    const todayShamsi = normalizeShamsiDateStr(dateToShamsi(new Date()));
    const normDeadline = normalizeShamsiDateStr(period.deadlineDate);
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(normDeadline) && todayShamsi > normDeadline) {
      return false;
    }
  }
  return true;
}

export function buildDefaultStudyPeriodAnnouncementContent(period: Partial<StudyPeriod>): {
  title: string;
  message: string;
} {
  const periodTitle = String(period.title || 'دوره جدید').trim();
  const startLabel = formatReadableShamsiDate(period.startDate);
  const endLabel = formatReadableShamsiDate(period.endDate);
  const deadlineLabel = formatReadableShamsiDate(period.deadlineDate);

  const lines: string[] = [
    `به اطلاع تمامی کاربران گرامی می‌رساند دوره ثبت مطالعه «${periodTitle}» هم‌اکنون باز شده است.`
  ];
  if (startLabel && endLabel) {
    lines.push(`بازه مطالعاتی: ${startLabel} تا ${endLabel}`);
  }
  if (deadlineLabel) {
    lines.push(`مهلت ثبت گزارش مطالعه: تا پایان ${deadlineLabel}`);
  }
  lines.push('لطفاً در بازه زمانی مقرر نسبت به ثبت ساعات مطالعه در سامانه اقدام فرمایید.');

  return {
    title: `آغاز ثبت مطالعه: ${periodTitle}`,
    message: lines.join('\n')
  };
}

export function buildDefaultMealPeriodAnnouncementContent(period: Partial<MealReservationPeriod>): {
  title: string;
  message: string;
} {
  const periodTitle = String(period.title || 'دوره جدید').trim();
  const hasLunch = period.enableLunch !== false;
  const hasDinner = period.enableDinner !== false;
  const mealTypeLabel =
    hasLunch && hasDinner ? 'نهار و شام' : hasLunch ? 'نهار' : hasDinner ? 'شام' : 'غذا';

  const startLabel = formatReadableShamsiDate(period.startDate);
  const endLabel = formatReadableShamsiDate(period.endDate);
  const deadlineLabel = formatReadableShamsiDate(period.deadlineDate);

  const lines: string[] = [
    `به اطلاع تمامی کاربران گرامی می‌رساند سامانه رزرو ${mealTypeLabel} برای «${periodTitle}» هم‌اکنون باز شد.`
  ];
  if (startLabel && endLabel) {
    lines.push(`بازه زمانی دوره: ${startLabel} تا ${endLabel}`);
  }
  if (deadlineLabel) {
    lines.push(`مهلت نهایی ثبت یا تغییر رزرو: تا پایان ${deadlineLabel}`);
  }
  lines.push('لطفاً در مهلت تعیین‌شده نسبت به ثبت رزرو وعده‌های خود اقدام فرمایید.');

  return {
    title: `آغاز رزرو ${mealTypeLabel}: ${periodTitle}`,
    message: lines.join('\n')
  };
}

export interface AutoAnnouncementTransitionResult {
  action: 'upsert' | 'delete' | 'noop';
  id: string;
  announcement?: Announcement;
}

/**
 * Computes whether a period change (study_periods or finance_meal_periods) should create,
 * update, deactivate, or delete an automatic announcement, while strictly honoring
 * Education Officer / Super Admin edits (isCustomized) and manual deactivations (manuallyDeactivated).
 */
export function computePeriodAutoAnnouncementUpdate(params: {
  kind: 'study_period' | 'meal_period';
  period: any;
  previousPeriod?: any;
  existingAnnouncement?: Announcement | null;
  actorUser?: any;
  nowIso?: string;
}): AutoAnnouncementTransitionResult {
  const { kind, period, previousPeriod, existingAnnouncement, actorUser } = params;
  const nowIso = params.nowIso || new Date().toISOString();
  const periodId = String(period?.id || previousPeriod?.id || '').trim();
  const annId =
    kind === 'study_period'
      ? getStudyPeriodAnnouncementId(periodId)
      : getMealPeriodAnnouncementId(periodId);

  if (!periodId) {
    return { action: 'noop', id: annId };
  }

  // Period was deleted or soft-deleted
  if (!period || period.isDeleted === true || period.status === 'deleted') {
    if (existingAnnouncement) {
      return { action: 'delete', id: annId };
    }
    return { action: 'noop', id: annId };
  }

  const wasOpen =
    kind === 'study_period'
      ? isStudyPeriodCurrentlyOpen(previousPeriod)
      : isMealPeriodCurrentlyOpen(previousPeriod);
  const isNowOpen =
    kind === 'study_period'
      ? isStudyPeriodCurrentlyOpen(period)
      : isMealPeriodCurrentlyOpen(period);

  const defaultContent =
    kind === 'study_period'
      ? buildDefaultStudyPeriodAnnouncementContent(period)
      : buildDefaultMealPeriodAnnouncementContent(period);

  const actorUsername = String(
    actorUser?.username || period?.createdBy || 'system'
  );
  const actorName = String(
    actorUser?.fullName ||
      actorUser?.name ||
      period?.createdByName ||
      (kind === 'meal_period' ? 'سامانه تغذیه (خودکار)' : 'سامانه آموزش (خودکار)')
  );

  // 1. Newly created open period OR explicit closed -> open transition
  if (!wasOpen && isNowOpen) {
    if (!existingAnnouncement) {
      return {
        action: 'upsert',
        id: annId,
        announcement: {
          id: annId,
          title: defaultContent.title,
          message: defaultContent.message,
          priority: 'important',
          targetAudience: 'all',
          isActive: true,
          autoSourceType: kind,
          sourcePeriodId: periodId,
          isCustomized: false,
          manuallyDeactivated: false,
          createdAt: nowIso,
          createdBy: actorUsername,
          createdByName: actorName,
          updated_at: nowIso,
          version: 1
        }
      };
    }

    // If Education Officer / Super Admin manually deactivated this announcement, respect their decision
    if (existingAnnouncement.manuallyDeactivated === true) {
      return { action: 'noop', id: annId };
    }

    const nextVersion = (Number(existingAnnouncement.version) || 0) + 1;
    const keepCustom = existingAnnouncement.isCustomized === true;
    return {
      action: 'upsert',
      id: annId,
      announcement: {
        ...existingAnnouncement,
        id: annId,
        title: keepCustom ? existingAnnouncement.title : defaultContent.title,
        message: keepCustom ? existingAnnouncement.message : defaultContent.message,
        targetAudience: keepCustom ? existingAnnouncement.targetAudience : 'all',
        isActive: true,
        autoSourceType: kind,
        sourcePeriodId: periodId,
        manuallyDeactivated: false,
        updated_at: nowIso,
        version: nextVersion
      }
    };
  }

  // 2. Period was already open and remains open (e.g., deadline/hours/price edited)
  if (wasOpen && isNowOpen) {
    if (!existingAnnouncement) {
      // Do not resurrect if admin deleted it
      return { action: 'noop', id: annId };
    }
    if (
      existingAnnouncement.isCustomized === true ||
      existingAnnouncement.manuallyDeactivated === true ||
      existingAnnouncement.isActive === false
    ) {
      return { action: 'noop', id: annId };
    }
    if (
      existingAnnouncement.title !== defaultContent.title ||
      existingAnnouncement.message !== defaultContent.message
    ) {
      const nextVersion = (Number(existingAnnouncement.version) || 0) + 1;
      return {
        action: 'upsert',
        id: annId,
        announcement: {
          ...existingAnnouncement,
          title: defaultContent.title,
          message: defaultContent.message,
          updated_at: nowIso,
          version: nextVersion
        }
      };
    }
    return { action: 'noop', id: annId };
  }

  // 3. Open -> Closed transition: deactivate announcement (preserve custom text & manuallyDeactivated flag)
  if (wasOpen && !isNowOpen) {
    if (existingAnnouncement && existingAnnouncement.isActive !== false) {
      const nextVersion = (Number(existingAnnouncement.version) || 0) + 1;
      return {
        action: 'upsert',
        id: annId,
        announcement: {
          ...existingAnnouncement,
          isActive: false,
          updated_at: nowIso,
          version: nextVersion
        }
      };
    }
  }

  return { action: 'noop', id: annId };
}
