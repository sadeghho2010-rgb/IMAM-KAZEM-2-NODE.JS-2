import { Student, StudyPeriod, PeriodicStudyLog, CourseStudyDetail } from '../../types';

export interface LogMetric {
  studyHours: number;
  discussionHours: number;
  totalHours: number;
  studyMinutes: number;
  discussionMinutes: number;
  totalMinutes: number;
  coreStudyMinutes: number;
  coreDiscussionMinutes: number;
  coreTotalMinutes: number;
  freeStudyMinutes: number;
  coursesBreakdown: CourseStudyDetail[];
}

export function isPeriodClosed(period?: StudyPeriod | null): boolean {
  if (!period) return false;
  if (period.isClosed) return true;
  if (period.deadlineDate) {
    try {
      // Normalize deadline string (could be Shamsi 1403/08/10 or ISO)
      const dStr = period.deadlineDate.trim();
      // If deadline contains slash (Shamsi or date), compare
      const now = new Date();
      // Simple date check
      const deadline = new Date(dStr);
      if (!isNaN(deadline.getTime())) {
        return now.getTime() > deadline.getTime();
      }
    } catch {
      // fallback
    }
  }
  return false;
}

export function isStudentExempt(period?: StudyPeriod | null, student?: Student | null, log?: PeriodicStudyLog | null): boolean {
  if (!period || !student) return false;
  if (log?.isExempt) return true;
  if (period.exemptStudentIds && period.exemptStudentIds.includes(student.id)) return true;
  if (student.grade && period.exemptGrades && period.exemptGrades.includes(student.grade)) return true;
  return false;
}

export function formatMinutesToHoursAndMinutes(minutes: number): string {
  const isNeg = minutes < 0;
  const absMin = Math.abs(Math.round(minutes));
  const h = Math.floor(absMin / 60);
  const m = absMin % 60;
  
  let res = '';
  if (h > 0 && m > 0) res = `${h} ساعت و ${m} دقیقه`;
  else if (h > 0) res = `${h} ساعت`;
  else res = `${m} دقیقه`;

  return isNeg ? `-${res}` : res;
}

export function getLogMetrics(log?: PeriodicStudyLog): LogMetric {
  if (!log) {
    return {
      studyHours: 0,
      discussionHours: 0,
      totalHours: 0,
      studyMinutes: 0,
      discussionMinutes: 0,
      totalMinutes: 0,
      coreStudyMinutes: 0,
      coreDiscussionMinutes: 0,
      coreTotalMinutes: 0,
      freeStudyMinutes: 0,
      coursesBreakdown: []
    };
  }

  const sHours = log.studyHours !== undefined ? (Number(log.studyHours) || 0) : (Number(log.hours) || 0);
  const dHours = log.discussionHours !== undefined ? (Number(log.discussionHours) || 0) : 0;
  const tHours = (log.hours !== undefined && log.hours !== null) ? Number(log.hours) || (sHours + dHours) : (sHours + dHours);

  const studyMin = Math.round(sHours * 60);
  const discMin = Math.round(dHours * 60);
  const totalMin = log.totalMinutes !== undefined ? log.totalMinutes : Math.round(tHours * 60);

  const freeStudyMin = log.freeStudyMinutes !== undefined ? log.freeStudyMinutes : 0;
  const coreStudyMin = log.coreStudyMinutes !== undefined ? log.coreStudyMinutes : studyMin;
  const coreDiscMin = log.coreDiscussionMinutes !== undefined ? log.coreDiscussionMinutes : discMin;
  const coreTotalMin = log.coreTotalMinutes !== undefined ? log.coreTotalMinutes : (coreStudyMin + coreDiscMin);

  return {
    studyHours: sHours,
    discussionHours: dHours,
    totalHours: tHours,
    studyMinutes: studyMin,
    discussionMinutes: discMin,
    totalMinutes: totalMin,
    coreStudyMinutes: coreStudyMin,
    coreDiscussionMinutes: coreDiscMin,
    coreTotalMinutes: coreTotalMin,
    freeStudyMinutes: freeStudyMin,
    coursesBreakdown: log.coursesBreakdown || []
  };
}

export interface StudyWarningDetail {
  isExempt: boolean;
  hasWarning: boolean;
  isCoreDeficit: boolean;
  isTotalDeficit: boolean;
  isCommended: boolean; // طلابی که هم حداقل درس اصلی و هم کل موظفی را رد کرده و عملکرد مازاد/تشویقی دارند
  warningType: 'none' | 'deficit_both' | 'deficit_core_only' | 'deficit_total_only' | 'exempt' | 'commended';
  statusLabel: string;
  shortBadge: string;
  badgeClass: string;
  coreDeficitMinutes: number;
  totalDeficitMinutes: number;
  coreSurplusMinutes: number;
  totalSurplusMinutes: number;
  mandatoryTotalMinutes: number;
  mandatoryCoreMinutes: number;
}

export type StudyWarningStatus = StudyWarningDetail;

export function getStudyWarningStatus(
  period: StudyPeriod,
  log?: PeriodicStudyLog,
  student?: Student
): StudyWarningDetail {
  const exempt = isStudentExempt(period, student, log);
  const mandatoryTotal = period.mandatoryMinutes || Math.round((period.mandatoryHours || 0) * 60);
  const mandatoryCore = period.mandatoryCoreMinutes ?? Math.round(mandatoryTotal * 0.75);

  if (exempt) {
    return {
      isExempt: true,
      hasWarning: false,
      isCoreDeficit: false,
      isTotalDeficit: false,
      isCommended: false,
      warningType: 'exempt',
      statusLabel: 'معاف از موظفی',
      shortBadge: '🛡️ معاف',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
      coreDeficitMinutes: 0,
      totalDeficitMinutes: 0,
      coreSurplusMinutes: 0,
      totalSurplusMinutes: 0,
      mandatoryTotalMinutes: mandatoryTotal,
      mandatoryCoreMinutes: mandatoryCore
    };
  }

  const metrics = getLogMetrics(log);
  const coreMins = metrics.coreTotalMinutes;
  const totalMins = metrics.totalMinutes;

  const isCoreDeficit = coreMins < mandatoryCore;
  const isTotalDeficit = totalMins < mandatoryTotal;
  const coreDeficit = Math.max(0, mandatoryCore - coreMins);
  const totalDeficit = Math.max(0, mandatoryTotal - totalMins);

  const coreSurplus = Math.max(0, coreMins - mandatoryCore);
  const totalSurplus = Math.max(0, totalMins - mandatoryTotal);

  if (isCoreDeficit && isTotalDeficit) {
    return {
      isExempt: false,
      hasWarning: true,
      isCoreDeficit: true,
      isTotalDeficit: true,
      isCommended: false,
      warningType: 'deficit_both',
      statusLabel: `اخطار دوگانه (کسری دروس اصلی ${coreDeficit}د و کسری کل ${totalDeficit}د)`,
      shortBadge: '🔴⚠️ اخطار دوگانه',
      badgeClass: 'bg-rose-100 text-rose-900 border-rose-300 font-black',
      coreDeficitMinutes: coreDeficit,
      totalDeficitMinutes: totalDeficit,
      coreSurplusMinutes: 0,
      totalSurplusMinutes: 0,
      mandatoryTotalMinutes: mandatoryTotal,
      mandatoryCoreMinutes: mandatoryCore
    };
  }

  if (isCoreDeficit) {
    return {
      isExempt: false,
      hasWarning: true,
      isCoreDeficit: true,
      isTotalDeficit: false,
      isCommended: false,
      warningType: 'deficit_core_only',
      statusLabel: `اخطار کسری دروس اصلی (${coreDeficit} دقیقه کسری دروس اصلی)`,
      shortBadge: '🔴 اخطار دروس اصلی',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 font-bold',
      coreDeficitMinutes: coreDeficit,
      totalDeficitMinutes: 0,
      coreSurplusMinutes: 0,
      totalSurplusMinutes: totalSurplus,
      mandatoryTotalMinutes: mandatoryTotal,
      mandatoryCoreMinutes: mandatoryCore
    };
  }

  if (isTotalDeficit) {
    return {
      isExempt: false,
      hasWarning: true,
      isCoreDeficit: false,
      isTotalDeficit: true,
      isCommended: false,
      warningType: 'deficit_total_only',
      statusLabel: `اخطار کسری مجموع کل (${totalDeficit} دقیقه کسری کل)`,
      shortBadge: '🟠 اخطار مجموع کل',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 font-bold',
      coreDeficitMinutes: 0,
      totalDeficitMinutes: totalDeficit,
      coreSurplusMinutes: coreSurplus,
      totalSurplusMinutes: 0,
      mandatoryTotalMinutes: mandatoryTotal,
      mandatoryCoreMinutes: mandatoryCore
    };
  }

  // طلبه‌هایی که هر دو حداقل را گذرانده‌اند:
  // آیا مازاد دارد (مجموع کل بالای موظفی)؟ در این صورت مستحق تشویق است
  const isCommended = totalMins > mandatoryTotal && coreMins >= mandatoryCore;

  if (isCommended) {
    return {
      isExempt: false,
      hasWarning: false,
      isCoreDeficit: false,
      isTotalDeficit: false,
      isCommended: true,
      warningType: 'commended',
      statusLabel: `شایسته تشویق (مازاد کارکرد: +${totalSurplus} دقیقه کل | +${coreSurplus} دقیقه اصلی)`,
      shortBadge: '⭐ شایسته تشویق',
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-black shadow-2xs',
      coreDeficitMinutes: 0,
      totalDeficitMinutes: 0,
      coreSurplusMinutes: coreSurplus,
      totalSurplusMinutes: totalSurplus,
      mandatoryTotalMinutes: mandatoryTotal,
      mandatoryCoreMinutes: mandatoryCore
    };
  }

  return {
    isExempt: false,
    hasWarning: false,
    isCoreDeficit: false,
    isTotalDeficit: false,
    isCommended: false,
    warningType: 'none',
    statusLabel: 'تکمیل دقیق موظفی (فاقد اخطار)',
    shortBadge: '🟢 تکمیل موظفی',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold',
    coreDeficitMinutes: 0,
    totalDeficitMinutes: 0,
    coreSurplusMinutes: coreSurplus,
    totalSurplusMinutes: totalSurplus,
    mandatoryTotalMinutes: mandatoryTotal,
    mandatoryCoreMinutes: mandatoryCore
  };
}

export interface PeriodAverages {
  totalAvgHours: number;
  studyAvgHours: number;
  discussionAvgHours: number;
  totalAvgMinutes: number;
  studyAvgMinutes: number;
  discussionAvgMinutes: number;
  activeCount: number;
}

export function calculatePeriodAverages(periodId: string, allLogs: PeriodicStudyLog[], targetStudentIds?: string[]): PeriodAverages {
  let periodLogs = allLogs.filter(l => l.periodId === periodId);
  if (targetStudentIds) {
    periodLogs = periodLogs.filter(l => targetStudentIds.includes(l.studentId));
  }

  const activeLogs = periodLogs.filter(l => (l.hours || 0) > 0 || (l.studyHours || 0) > 0 || (l.discussionHours || 0) > 0);
  const count = activeLogs.length;

  if (count === 0) {
    return {
      totalAvgHours: 0,
      studyAvgHours: 0,
      discussionAvgHours: 0,
      totalAvgMinutes: 0,
      studyAvgMinutes: 0,
      discussionAvgMinutes: 0,
      activeCount: 0
    };
  }

  let sumTotal = 0;
  let sumStudy = 0;
  let sumDisc = 0;

  activeLogs.forEach(l => {
    const m = getLogMetrics(l);
    sumTotal += m.totalHours;
    sumStudy += m.studyHours;
    sumDisc += m.discussionHours;
  });

  const totAvgH = sumTotal / count;
  const sAvgH = sumStudy / count;
  const dAvgH = sumDisc / count;

  return {
    totalAvgHours: totAvgH,
    studyAvgHours: sAvgH,
    discussionAvgHours: dAvgH,
    totalAvgMinutes: Math.round(totAvgH * 60),
    studyAvgMinutes: Math.round(sAvgH * 60),
    discussionAvgMinutes: Math.round(dAvgH * 60),
    activeCount: count
  };
}

export function exportStudyStatsCSV(periods: StudyPeriod[], allLogs: PeriodicStudyLog[], students: Student[]) {
  if (periods.length === 0) {
    alert("هیچ دوره‌ای برای خروجی گرفتن وجود ندارد.");
    return;
  }
  
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
  csvContent += "عنوان دوره,تاریخ شروع,تاریخ پایان,نام طلبه,پایه,دقیقه مطالعه,دقیقه مباحثه,مجموع دقایق,دقیقه موظفی,اختلاف مجموع با موظفی,اختلاف مجموع با میانگین,اختلاف مطالعه با میانگین,اختلاف مباحثه با میانگین,وضعیت موظفی,وضعیت میانگین\n";

  const sortedPeriods = [...periods].reverse();

  sortedPeriods.forEach(p => {
    const pLogs = allLogs.filter(l => l.periodId === p.id);
    const avg = calculatePeriodAverages(p.id, allLogs);
    const pMandatoryMinutes = Math.round((p.mandatoryHours || 0) * 60);

    students.forEach(student => {
      const log = pLogs.find(l => l.studentId === student.id);
      const metrics = getLogMetrics(log);

      const diffMandatory = metrics.totalMinutes - pMandatoryMinutes;
      const diffTotalAvg = metrics.totalMinutes - avg.totalAvgMinutes;
      const diffStudyAvg = metrics.studyMinutes - avg.studyAvgMinutes;
      const diffDiscAvg = metrics.discussionMinutes - avg.discussionAvgMinutes;

      const statusMandatory = metrics.totalMinutes >= pMandatoryMinutes 
        ? "موفق موظفی" 
        : metrics.totalMinutes === 0 
          ? "ثبت نشده" 
          : "کسری موظفی";

      const statusAvg = metrics.totalMinutes >= avg.totalAvgMinutes ? "بالای میانگین" : "زیر میانگین";

      const startDateFa = p.startDate ? new Date(p.startDate).toLocaleDateString('fa-IR') : '';
      const endDateFa = p.endDate ? new Date(p.endDate).toLocaleDateString('fa-IR') : '';

      csvContent += `"${p.title}","${startDateFa}","${endDateFa}","${student.name}","${student.grade || ''}",${metrics.studyMinutes},${metrics.discussionMinutes},${metrics.totalMinutes},${pMandatoryMinutes},${diffMandatory},${diffTotalAvg},${diffStudyAvg},${diffDiscAvg},"${statusMandatory}","${statusAvg}"\n`;
    });
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `گزارش_جامع_مطالعات_و_مباحثات_طلاب.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// -------------------------------------------------------------
// Daily Granular Study Log Entries Helpers & Sync
// -------------------------------------------------------------
import { localDb } from '../../lib/localDb';
import { getTodayShamsi } from '../../lib/jalali';
import { StudyDailyEntry, Program } from '../../types';

export interface CoreCourseItem {
  id: string;
  title: string;
  subjectType: string;
}

export function getStudentCoreCourses(student?: Student | null, programs?: Program[]): CoreCourseItem[] {
  const grade = student?.grade || 'پایه ۷';

  // 1. If programs array is provided, filter active non-deleted programs matching student
  if (Array.isArray(programs)) {
    const activeProgs = programs.filter(p => p.status !== 'deleted' && !(p as any).isDeleted);
    const studentProgs = activeProgs.filter(p => {
      if (p.type && p.type !== 'اصلی') return false;
      const typeStr = (p.type || '').trim();
      const titleStr = (p.title || '').trim();
      const isExcluded = ['مشاوره', 'پژوهش', 'دروس 5 شنبه', 'دروس ۵ شنبه', 'دروس پنج شنبه', 'دروس پنج‌شنبه', 'پنج شنبه', 'پنج‌شنبه', 'سایر'].some(k => typeStr.includes(k) || titleStr.includes(k));
      if (isExcluded) return false;

      const matchesGrade = !p.grade || p.grade === grade || p.grade === 'همه پایه‌ها' || p.grade === 'همه';
      const matchesId = student?.id && (
        (Array.isArray((p as any).studentIds) && (p as any).studentIds.includes(student.id)) ||
        (Array.isArray((p as any).representativeStudentIds) && (p as any).representativeStudentIds.includes(student.id))
      );
      return matchesGrade || matchesId;
    });

    if (studentProgs.length > 0) {
      const courseMap = new Map<string, CoreCourseItem>();
      studentProgs.forEach(p => {
        const cleanTitle = (p.title || '').trim();
        if (cleanTitle && !courseMap.has(cleanTitle)) {
          let sType = 'سایر';
          if (/اصول|رسائل|کفایه|حلقه/i.test(cleanTitle)) sType = 'اصول';
          else if (/فقه|مکاسب|لمعه/i.test(cleanTitle)) sType = 'فقه';
          else if (/فلسفه|بدایه|نهایه/i.test(cleanTitle)) sType = 'فلسفه';
          
          courseMap.set(cleanTitle, {
            id: p.id || `c_${cleanTitle}`,
            title: cleanTitle,
            subjectType: sType
          });
        }
      });
      if (courseMap.size > 0) {
        return Array.from(courseMap.values());
      }
    }

    // If programs array was explicitly provided, do not fall back to fake deleted courses
    return [];
  }

  // 2. Fallback standard seminary courses per grade
  if (grade.includes('۷') || grade.includes('7')) {
    return [
      { id: 'c_usul_7', title: 'اصول {حلقه ثالثه}', subjectType: 'اصول' },
      { id: 'c_fiqh_7', title: 'فقه {مکاسب خیارات}', subjectType: 'فقه' },
      { id: 'c_phil_7', title: 'فلسفه {قسمت دوم نهایه}', subjectType: 'فلسفه' }
    ];
  }
  if (grade.includes('۸') || grade.includes('8')) {
    return [
      { id: 'c_usul_8', title: 'اصول {رسائل}', subjectType: 'اصول' },
      { id: 'c_fiqh_8', title: 'فقه {مکاسب بیع}', subjectType: 'فقه' },
      { id: 'c_phil_8', title: 'فلسفه {بدایة الحکمة}', subjectType: 'فلسفه' }
    ];
  }
  if (grade.includes('۹') || grade.includes('9')) {
    return [
      { id: 'c_usul_9', title: 'اصول {کفایه}', subjectType: 'اصول' },
      { id: 'c_fiqh_9', title: 'فقه {مکاسب خیارات}', subjectType: 'فقه' },
      { id: 'c_phil_9', title: 'فلسفه {نهایة الحکمة}', subjectType: 'فلسفه' }
    ];
  }
  return [
    { id: 'c_usul_10', title: 'اصول {کفایة الاصول جلد ۲}', subjectType: 'اصول' },
    { id: 'c_fiqh_10', title: 'فقه {مکاسب شروط و خیارات}', subjectType: 'فقه' },
    { id: 'c_phil_10', title: 'فلسفه {نهایة الحکمة - مرحله دوم}', subjectType: 'فلسفه' }
  ];
}

export interface StudentStudyComplianceStatus {
  isExempt: boolean;
  isMet: boolean;
  isWarning: boolean;
  deficitTotalMinutes: number;
  deficitCoreMinutes: number;
  warningType: 'none' | 'core_only' | 'total_only' | 'both';
  warningLabel: string;
}

export function evaluateStudentStudyCompliance(
  period: StudyPeriod,
  log?: PeriodicStudyLog | null,
  isExempt?: boolean
): StudentStudyComplianceStatus {
  if (isExempt) {
    return {
      isExempt: true,
      isMet: true,
      isWarning: false,
      deficitTotalMinutes: 0,
      deficitCoreMinutes: 0,
      warningType: 'none',
      warningLabel: 'معاف از موظفی'
    };
  }

  // Mandatory thresholds in minutes
  const mandatoryTotal = period.mandatoryMinutes ?? Math.round((period.mandatoryHours || 0) * 60);
  const mandatoryCore = period.mandatoryCoreMinutes ?? Math.round(mandatoryTotal * 0.75);

  const totalMin = log?.totalMinutes ?? (log ? Math.round((log.hours || 0) * 60) : 0);
  const coreMin = log?.coreTotalMinutes ?? (log ? Math.round(((log.studyHours || 0) + (log.discussionHours || 0)) * 60) : totalMin);

  const coreFailed = mandatoryCore > 0 && coreMin < mandatoryCore;
  const totalFailed = mandatoryTotal > 0 && totalMin < mandatoryTotal;

  const deficitCore = coreFailed ? (mandatoryCore - coreMin) : 0;
  const deficitTotal = totalFailed ? (mandatoryTotal - totalMin) : 0;

  if (coreFailed && totalFailed) {
    return {
      isExempt: false,
      isMet: false,
      isWarning: true,
      deficitTotalMinutes: deficitTotal,
      deficitCoreMinutes: deficitCore,
      warningType: 'both',
      warningLabel: 'مستحق اخطار: کسری دروس اصلی و مجموع کل'
    };
  }

  if (coreFailed && !totalFailed) {
    return {
      isExempt: false,
      isMet: false,
      isWarning: true,
      deficitTotalMinutes: 0,
      deficitCoreMinutes: deficitCore,
      warningType: 'core_only',
      warningLabel: 'مستحق اخطار: کسری دروس اصلی (با وجود تکمیل کل)'
    };
  }

  if (!coreFailed && totalFailed) {
    return {
      isExempt: false,
      isMet: false,
      isWarning: true,
      deficitTotalMinutes: deficitTotal,
      deficitCoreMinutes: 0,
      warningType: 'total_only',
      warningLabel: 'مستحق اخطار: کسری مجموع کل'
    };
  }

  return {
    isExempt: false,
    isMet: true,
    isWarning: false,
    deficitTotalMinutes: 0,
    deficitCoreMinutes: 0,
    warningType: 'none',
    warningLabel: 'رعایت کامل موظفی ✅'
  };
}

export async function addStudyDailyEntry(entry: {
  periodId: string;
  studentId: string;
  studyHours?: number;
  discussionHours?: number;
  coursesBreakdown?: CourseStudyDetail[];
  freeStudyMinutes?: number;
  totalMinutes?: number;
  coreTotalMinutes?: number;
  submittedBy?: string;
  note?: string;
}) {
  const breakdown = entry.coursesBreakdown || [];
  const freeMin = entry.freeStudyMinutes || 0;

  let coreStudyMin = 0;
  let coreDiscMin = 0;
  breakdown.forEach(c => {
    coreStudyMin += Number(c.studyMinutes) || 0;
    coreDiscMin += Number(c.discussionMinutes) || 0;
  });

  const coreTotalMin = entry.coreTotalMinutes ?? (coreStudyMin + coreDiscMin);
  const totalMin = entry.totalMinutes ?? (coreTotalMin + freeMin);

  const studyHours = Math.round((coreStudyMin / 60) * 100) / 100;
  const discussionHours = Math.round((coreDiscMin / 60) * 100) / 100;
  const totalHours = Math.round((totalMin / 60) * 100) / 100;

  const now = new Date();
  const todayShamsi = getTodayShamsi();
  const timeStr = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

  const payloadToSave = {
    periodId: entry.periodId,
    studentId: entry.studentId,
    student_id: entry.studentId,
    nationalId: (entry as any).nationalId || '',
    studentName: (entry as any).studentName || '',
    userId: (entry as any).userId || '',
    studyHours,
    discussionHours,
    totalHours,
    totalMinutes: totalMin,
    coreTotalMinutes: coreTotalMin,
    freeStudyMinutes: freeMin,
    coursesBreakdown: breakdown,
    entryDate: todayShamsi,
    entryTime: timeStr,
    createdAt: now.toISOString(),
    submittedBy: entry.submittedBy || 'student',
    note: entry.note || ''
  };

  const newDocId = await localDb.addDoc('study_daily_entries', payloadToSave);
  const createdDoc: StudyDailyEntry = {
    id: newDocId,
    ...payloadToSave
  };

  await syncAggregatePeriodicStudyLog(entry.periodId, entry.studentId, entry.submittedBy, createdDoc);
  return createdDoc;
}

export async function updateStudyDailyEntry(
  entryId: string, 
  updated: { 
    studyHours?: number; 
    discussionHours?: number; 
    coursesBreakdown?: CourseStudyDetail[];
    freeStudyMinutes?: number;
    totalMinutes?: number;
    coreTotalMinutes?: number;
    note?: string 
  },
  periodId: string,
  studentId: string,
  submittedBy?: string
) {
  const breakdown = updated.coursesBreakdown || [];
  const freeMin = updated.freeStudyMinutes || 0;

  let coreStudyMin = 0;
  let coreDiscMin = 0;
  breakdown.forEach(c => {
    coreStudyMin += Number(c.studyMinutes) || 0;
    coreDiscMin += Number(c.discussionMinutes) || 0;
  });

  const coreTotalMin = updated.coreTotalMinutes ?? (coreStudyMin + coreDiscMin);
  const totalMin = updated.totalMinutes ?? (coreTotalMin + freeMin);

  const studyHours = Math.round((coreStudyMin / 60) * 100) / 100;
  const discussionHours = Math.round((coreDiscMin / 60) * 100) / 100;
  const totalHours = Math.round((totalMin / 60) * 100) / 100;
  const now = new Date();

  await localDb.updateDoc('study_daily_entries', entryId, {
    studyHours,
    discussionHours,
    totalHours,
    totalMinutes: totalMin,
    coreTotalMinutes: coreTotalMin,
    freeStudyMinutes: freeMin,
    coursesBreakdown: breakdown,
    note: updated.note || '',
    updatedAt: now.toISOString()
  });

  await syncAggregatePeriodicStudyLog(periodId, studentId, submittedBy);
}

export async function deleteStudyDailyEntry(entryId: string, periodId: string, studentId: string, submittedBy?: string) {
  await localDb.deleteDoc('study_daily_entries', entryId);
  await syncAggregatePeriodicStudyLog(periodId, studentId, submittedBy);
}

export async function syncAggregatePeriodicStudyLog(
  periodId: string, 
  studentId: string, 
  submittedBy?: string, 
  freshDoc?: StudyDailyEntry
) {
  const targetStudentId = String(studentId || '').trim();
  if (!periodId || !targetStudentId) return;

  const [allEntries, allStudents, allUsers, existingLogs] = await Promise.all([
    localDb.getDocs<StudyDailyEntry>('study_daily_entries'),
    localDb.getDocs<Student>('students'),
    localDb.getDocs<any>('system_users'),
    localDb.getDocs<PeriodicStudyLog>('periodic_study_logs')
  ]);

  const matchedUser = allUsers.find((u: any) => 
    String(u.id || '').trim() === targetStudentId ||
    String(u.username || '').trim().toLowerCase() === targetStudentId.toLowerCase() ||
    String(u.linkedStudentId || '').trim() === targetStudentId
  );

  const studentObj = allStudents.find(s => 
    String(s.id).trim() === targetStudentId || 
    (matchedUser?.linkedStudentId && String(s.id).trim() === String(matchedUser.linkedStudentId).trim()) ||
    (s.nationalId && String(s.nationalId).trim() === targetStudentId) ||
    (matchedUser?.nationalId && String(s.nationalId).trim() === String(matchedUser.nationalId).trim()) ||
    (s.studentCode && String(s.studentCode).trim() === targetStudentId) ||
    (matchedUser?.username && (String(s.nationalId).trim() === String(matchedUser.username).trim() || String(s.studentCode).trim() === String(matchedUser.username).trim()))
  );

  const canonicalId = studentObj ? String(studentObj.id).trim() : (matchedUser?.linkedStudentId || targetStudentId);
  const canonicalNat = studentObj?.nationalId ? String(studentObj.nationalId).trim() : (matchedUser?.nationalId || matchedUser?.username || '');
  const canonicalCode = studentObj?.studentCode ? String(studentObj.studentCode).trim() : (matchedUser?.username || '');
  const canonicalName = studentObj?.name ? String(studentObj.name).trim() : (matchedUser?.name || '');

  const studentEntries = allEntries.filter(e => {
    const pMatch = String(e.periodId || (e as any).period_id || '').trim() === String(periodId).trim();
    if (!pMatch) return false;

    const eStId = String(e.studentId || (e as any).student_id || '').trim();
    const eNat = String((e as any).nationalId || (e as any).nationalCode || '').trim();
    const eCode = String((e as any).studentCode || '').trim();
    const eUser = String((e as any).userId || '').trim();
    const eName = String((e as any).studentName || '').trim().toLowerCase();

    return (
      (targetStudentId && eStId === targetStudentId) ||
      (canonicalId && eStId === canonicalId) ||
      (matchedUser && eStId === matchedUser.id) ||
      (matchedUser?.linkedStudentId && eStId === matchedUser.linkedStudentId) ||
      (canonicalNat && eNat === canonicalNat) ||
      (canonicalNat && eStId === canonicalNat) ||
      (canonicalCode && eCode === canonicalCode) ||
      (targetStudentId && eUser === targetStudentId) ||
      (matchedUser && eUser === matchedUser.id) ||
      (canonicalName && eName && eName.toLowerCase() === canonicalName.toLowerCase())
    );
  });

  if (freshDoc && freshDoc.id && !studentEntries.some(e => e.id === freshDoc.id)) {
    const freshP = String(freshDoc.periodId || (freshDoc as any).period_id || '').trim();
    if (freshP === String(periodId).trim()) {
      studentEntries.push(freshDoc);
    }
  }

  // Retroactively normalize matched entries so they store canonical studentId and nationalId
  for (const entry of studentEntries) {
    if (entry.id && (entry.studentId !== canonicalId || (canonicalNat && entry.nationalId !== canonicalNat))) {
      localDb.updateDoc('study_daily_entries', entry.id, {
        studentId: canonicalId,
        student_id: canonicalId,
        nationalId: canonicalNat || entry.nationalId || '',
        studentName: canonicalName || entry.studentName || ''
      }).catch(() => {});
    }
  }

  let totalMinutesSum = 0;
  let coreTotalMinutesSum = 0;
  let coreStudyMinutesSum = 0;
  let coreDiscussionMinutesSum = 0;
  let freeStudyMinutesSum = 0;

  // Aggregate breakdown by courseTitle (normalized)
  const coursesAggMap = new Map<string, CourseStudyDetail>();

  studentEntries.forEach(e => {
    const eFree = Number(e.freeStudyMinutes) || 0;
    freeStudyMinutesSum += eFree;

    if (Array.isArray(e.coursesBreakdown) && e.coursesBreakdown.length > 0) {
      e.coursesBreakdown.forEach(c => {
        const sMin = Number(c.studyMinutes) || 0;
        const dMin = Number(c.discussionMinutes) || 0;
        coreStudyMinutesSum += sMin;
        coreDiscussionMinutesSum += dMin;

        const rawTitle = (c.courseTitle || '').trim();
        const key = rawTitle ? rawTitle.toLowerCase() : (c.courseId || 'unknown_course').trim().toLowerCase();

        const existing = coursesAggMap.get(key) || {
          courseId: c.courseId || key,
          courseTitle: c.courseTitle || 'درس اصلی',
          studyMinutes: 0,
          discussionMinutes: 0
        };
        existing.studyMinutes += sMin;
        existing.discussionMinutes += dMin;
        coursesAggMap.set(key, existing);
      });
    } else {
      // Legacy fallback
      const legacyStudyMin = Math.round((Number(e.studyHours) || 0) * 60);
      const legacyDiscMin = Math.round((Number(e.discussionHours) || 0) * 60);
      coreStudyMinutesSum += legacyStudyMin;
      coreDiscussionMinutesSum += legacyDiscMin;
    }
  });

  coreTotalMinutesSum = coreStudyMinutesSum + coreDiscussionMinutesSum;
  totalMinutesSum = coreTotalMinutesSum + freeStudyMinutesSum;

  const totalSumHours = Math.round((totalMinutesSum / 60) * 100) / 100;
  const totalStudyHours = Math.round((coreStudyMinutesSum / 60) * 100) / 100;
  const totalDiscHours = Math.round((coreDiscussionMinutesSum / 60) * 100) / 100;

  const matchingLogs = existingLogs.filter(l => {
    const pMatch = String(l.periodId || (l as any).period_id || '').trim() === String(periodId).trim();
    if (!pMatch) return false;

    const lStId = String(l.studentId || (l as any).student_id || '').trim();
    const lNat = String((l as any).nationalId || (l as any).nationalCode || '').trim();
    const lName = String(l.studentName || '').trim().toLowerCase();

    return (
      (targetStudentId && lStId === targetStudentId) ||
      (canonicalId && lStId === canonicalId) ||
      (matchedUser && lStId === matchedUser.id) ||
      (matchedUser?.linkedStudentId && lStId === matchedUser.linkedStudentId) ||
      (canonicalNat && lNat === canonicalNat) ||
      (canonicalNat && lStId === canonicalNat) ||
      (canonicalName && lName && lName === canonicalName.toLowerCase())
    );
  });

  const payload: Partial<PeriodicStudyLog> = {
    periodId: String(periodId).trim(),
    studentId: canonicalId,
    studentName: canonicalName || matchingLogs[0]?.studentName || '',
    studentCode: canonicalCode || matchingLogs[0]?.studentCode || '',
    nationalId: canonicalNat || matchingLogs[0]?.nationalId || '',
    grade: studentObj?.grade || matchingLogs[0]?.grade || '',
    hours: totalSumHours,
    totalMinutes: totalMinutesSum,
    studyHours: totalStudyHours,
    discussionHours: totalDiscHours,
    coreStudyMinutes: coreStudyMinutesSum,
    coreDiscussionMinutes: coreDiscussionMinutesSum,
    coreTotalMinutes: coreTotalMinutesSum,
    freeStudyMinutes: freeStudyMinutesSum,
    coursesBreakdown: Array.from(coursesAggMap.values()),
    submittedBy: (submittedBy as any) || matchingLogs[0]?.submittedBy || 'student',
    lastModifiedAt: new Date().toISOString()
  };

  if (matchingLogs.length > 0) {
    const primaryLog = matchingLogs[0];
    await localDb.updateDoc('periodic_study_logs', primaryLog.id, payload);

    // Clean up duplicate periodic study log documents if any exist
    for (let i = 1; i < matchingLogs.length; i++) {
      await localDb.deleteDoc('periodic_study_logs', matchingLogs[i].id);
    }
  } else if (studentEntries.length > 0) {
    await localDb.addDoc('periodic_study_logs', payload);
  }

  // Flush sync queue in background without blocking UI event dispatch
  localDb.flushSyncQueue().catch(() => {});

  // Broadcast change event to trigger localDb listeners and active UI subscribers
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app_data_change', { detail: { collection: 'study_daily_entries' } }));
    window.dispatchEvent(new CustomEvent('app_data_change', { detail: { collection: 'periodic_study_logs' } }));
    window.dispatchEvent(new CustomEvent('collection_change_periodic_study_logs'));
    window.dispatchEvent(new CustomEvent('collection_change_study_daily_entries'));
    try {
      localStorage.setItem('study_logs_updated_at', String(Date.now()));
    } catch (e) {}
  }
}
