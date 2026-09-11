import { Student, StudyPeriod, PeriodicStudyLog } from '../../types';

export interface LogMetric {
  studyHours: number;
  discussionHours: number;
  totalHours: number;
  studyMinutes: number;
  discussionMinutes: number;
  totalMinutes: number;
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
      totalMinutes: 0
    };
  }

  const sHours = log.studyHours !== undefined ? (Number(log.studyHours) || 0) : (Number(log.hours) || 0);
  const dHours = log.discussionHours !== undefined ? (Number(log.discussionHours) || 0) : 0;
  const tHours = (log.hours !== undefined && log.hours !== null) ? Number(log.hours) || (sHours + dHours) : (sHours + dHours);

  return {
    studyHours: sHours,
    discussionHours: dHours,
    totalHours: tHours,
    studyMinutes: Math.round(sHours * 60),
    discussionMinutes: Math.round(dHours * 60),
    totalMinutes: Math.round(tHours * 60)
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
