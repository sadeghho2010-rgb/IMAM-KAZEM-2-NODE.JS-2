import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  CalendarDays,
  Search,
  Download,
  Users,
  Layers,
  Calculator,
  GraduationCap,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { CounselingSessionGrade, Program, Student, CounselingScore } from '../../types';
import { ShamsiDatePicker } from '../ShamsiDatePicker';
import {
  getTodayShamsi,
  parseShamsiDate,
  formatShamsiDate,
  getDaysInShamsiMonth,
  normalizeShamsiDateStr,
  toPersianDigits
} from '../../lib/jalali';
import { cn } from '../../lib/utils';

interface CounselingReportsTabProps {
  grades: CounselingSessionGrade[];
  students: Student[];
  counselingClasses: Program[];
  isAdminMobile?: boolean;
}

const REPORT_SCORE_BADGES: Record<string, string> = {
  'الف': 'bg-emerald-50 text-emerald-800 border-emerald-200',
  'ب': 'bg-blue-50 text-blue-800 border-blue-200',
  'ج': 'bg-amber-50 text-amber-800 border-amber-200',
  'د': 'bg-rose-50 text-rose-800 border-rose-200',
  'غیبت': 'bg-slate-100 text-slate-700 border-slate-300',
  'عدم انجام تکلیف': 'bg-slate-100 text-slate-700 border-slate-300'
};

function normalizeResearchScoreDisplay(score?: CounselingScore | ''): string {
  if (!score) return '';
  if (score === 'غیبت') return 'عدم انجام تکلیف';
  return score;
}

function isMatchingGradeFilter(itemGrade: string | undefined | null, targetGrade: string): boolean {
  if (!targetGrade || targetGrade === 'all') return true;
  if (!itemGrade) return false;
  const cleanItem = toPersianDigits(String(itemGrade)).trim();
  const cleanTarget = toPersianDigits(String(targetGrade)).trim();
  if (cleanItem === cleanTarget) return true;
  for (const d of ['۷', '۸', '۹', '۱۰']) {
    if (cleanTarget.includes(d) && cleanItem.includes(d)) return true;
  }
  return false;
}

export default function CounselingReportsTab({
  grades,
  students,
  counselingClasses,
  isAdminMobile = false
}: CounselingReportsTabProps) {
  const todayShamsi = useMemo(() => getTodayShamsi(), []);
  const todayParts = useMemo(() => parseShamsiDate(todayShamsi), [todayShamsi]);
  const startOfCurrentMonth = useMemo(
    () => formatShamsiDate(todayParts.year, todayParts.month, 1),
    [todayParts]
  );

  // Date range & presets
  const [datePreset, setDatePreset] = useState<'current_month' | 'last_month' | 'all_year' | 'custom'>('current_month');
  const [startDate, setStartDate] = useState<string>(startOfCurrentMonth);
  const [endDate, setEndDate] = useState<string>(todayShamsi);

  // Report model & ordering
  const [reportModel, setReportModel] = useState<'finance' | 'education'>('finance');
  const [educationSortBy, setEducationSortBy] = useState<'student' | 'class'>('student');
  const [includeZeroStudents, setIncludeZeroStudents] = useState<boolean>(false);

  // Filters
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const applyDatePreset = (preset: 'current_month' | 'last_month' | 'all_year') => {
    setDatePreset(preset);
    if (preset === 'current_month') {
      setStartDate(startOfCurrentMonth);
      setEndDate(todayShamsi);
    } else if (preset === 'last_month') {
      let y = todayParts.year;
      let m = todayParts.month - 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
      const maxDay = getDaysInShamsiMonth(y, m);
      setStartDate(formatShamsiDate(y, m, 1));
      setEndDate(formatShamsiDate(y, m, maxDay));
    } else {
      const academicYear = todayParts.month >= 7 ? todayParts.year : todayParts.year - 1;
      setStartDate(formatShamsiDate(academicYear, 7, 1));
      setEndDate(todayShamsi);
    }
  };

  // All available counseling course titles for dropdown
  const courseOptions = useMemo(() => {
    const set = new Set<string>();
    counselingClasses.forEach(c => {
      if (c.title) set.add(c.title.trim());
    });
    grades.forEach(g => {
      if (g.courseTitle) set.add(g.courseTitle.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fa'));
  }, [counselingClasses, grades]);

  // Deduplicated & date-range-filtered grades
  const rangeGrades = useMemo(() => {
    const normStart = normalizeShamsiDateStr(startDate || '');
    const normEnd = normalizeShamsiDateStr(endDate || '');
    const uniqueMap = new Map<string, CounselingSessionGrade>();

    grades.forEach(g => {
      const normDate = normalizeShamsiDateStr(g.sessionDate || '');
      if (!normDate) return;
      if (normStart && normDate < normStart) return;
      if (normEnd && normDate > normEnd) return;

      const key = `${g.studentId || g.studentName}::${(g.courseTitle || '').trim()}::${normDate}`;
      const existing = uniqueMap.get(key);
      if (!existing) {
        uniqueMap.set(key, { ...g, sessionDate: normDate });
      } else {
        const curTime = new Date(g.updatedAt || g.createdAt || 0).getTime();
        const oldTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const curVer = Number((g as any).version || 0);
        const oldVer = Number((existing as any).version || 0);
        if (curVer > oldVer || (curVer === oldVer && curTime >= oldTime)) {
          uniqueMap.set(key, { ...g, sessionDate: normDate });
        }
      }
    });

    const q = searchQuery.trim().toLowerCase();

    return Array.from(uniqueMap.values()).filter(g => {
      if (gradeFilter !== 'all' && !isMatchingGradeFilter(g.grade, gradeFilter)) return false;
      if (courseFilter !== 'all' && (g.courseTitle || '').trim() !== courseFilter) return false;
      if (q) {
        const hay = `${g.studentName || ''} ${g.courseTitle || ''} ${g.counselorTeacherName || ''} ${g.grade || ''} ${g.counselorFeedback || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [grades, startDate, endDate, gradeFilter, courseFilter, searchQuery]);

  // MODEL 1: Finance Summary per Student (تجمیعی الف، ب، ج، د)
  const financeRows = useMemo(() => {
    const activeStudents = students.filter(
      s => s.isActive !== false && (s as any).status !== 'deleted' && !(s as any).isDeleted && !(s as any).deletedAt
    );
    const studentMapById = new Map<string, Student>();
    activeStudents.forEach(s => studentMapById.set(s.id, s));

    interface FinanceRow {
      studentId: string;
      studentName: string;
      studentCode: string;
      grade: string;
      alf: number;
      beh: number;
      jim: number;
      dal: number;
      absent: number;
      noHomework: number;
      sessionsCount: number;
      totalScoredItems: number;
    }

    const rowMap = new Map<string, FinanceRow>();

    if (includeZeroStudents) {
      const q = searchQuery.trim().toLowerCase();
      activeStudents.forEach(s => {
        if (gradeFilter !== 'all' && !isMatchingGradeFilter(s.grade, gradeFilter)) return;
        if (q && !(s.name || '').toLowerCase().includes(q) && !(s.studentCode || '').toLowerCase().includes(q)) return;
        rowMap.set(s.id, {
          studentId: s.id,
          studentName: s.name,
          studentCode: s.studentCode || s.nationalId || '—',
          grade: s.grade || '—',
          alf: 0,
          beh: 0,
          jim: 0,
          dal: 0,
          absent: 0,
          noHomework: 0,
          sessionsCount: 0,
          totalScoredItems: 0
        });
      });
    }

    const addLetterScore = (row: FinanceRow, score: CounselingScore | '' | undefined, isResearch: boolean) => {
      if (!score) return;
      if (score === 'الف') {
        row.alf += 1;
        row.totalScoredItems += 1;
      } else if (score === 'ب') {
        row.beh += 1;
        row.totalScoredItems += 1;
      } else if (score === 'ج') {
        row.jim += 1;
        row.totalScoredItems += 1;
      } else if (score === 'د') {
        row.dal += 1;
        row.totalScoredItems += 1;
      } else if (score === 'عدم انجام تکلیف' || (isResearch && score === 'غیبت')) {
        row.noHomework += 1;
      } else if (score === 'غیبت') {
        row.absent += 1;
      }
    };

    rangeGrades.forEach(g => {
      const key = g.studentId || g.studentName;
      let row = rowMap.get(key);
      if (!row) {
        const stObj = studentMapById.get(g.studentId);
        row = {
          studentId: key,
          studentName: stObj?.name || g.studentName || 'طلبه ناشناس',
          studentCode: stObj?.studentCode || stObj?.nationalId || '—',
          grade: stObj?.grade || g.grade || '—',
          alf: 0,
          beh: 0,
          jim: 0,
          dal: 0,
          absent: 0,
          noHomework: 0,
          sessionsCount: 0,
          totalScoredItems: 0
        };
        rowMap.set(key, row);
      }

      row.sessionsCount += 1;
      addLetterScore(row, g.participationScore, false);
      addLetterScore(row, g.researchScore, true);
    });

    return Array.from(rowMap.values()).sort((a, b) => a.studentName.localeCompare(b.studentName, 'fa'));
  }, [rangeGrades, students, includeZeroStudents, gradeFilter, searchQuery]);

  const financeTotals = useMemo(() => {
    return financeRows.reduce(
      (acc, r) => ({
        alf: acc.alf + r.alf,
        beh: acc.beh + r.beh,
        jim: acc.jim + r.jim,
        dal: acc.dal + r.dal,
        absent: acc.absent + r.absent,
        noHomework: acc.noHomework + r.noHomework,
        sessionsCount: acc.sessionsCount + r.sessionsCount
      }),
      { alf: 0, beh: 0, jim: 0, dal: 0, absent: 0, noHomework: 0, sessionsCount: 0 }
    );
  }, [financeRows]);

  // MODEL 2: Education Detailed Rows sorted either by Student or by Class
  const educationRows = useMemo(() => {
    const list = [...rangeGrades];
    if (educationSortBy === 'student') {
      list.sort((a, b) => {
        const nameCmp = (a.studentName || '').localeCompare(b.studentName || '', 'fa');
        if (nameCmp !== 0) return nameCmp;
        const classCmp = (a.courseTitle || '').localeCompare(b.courseTitle || '', 'fa');
        if (classCmp !== 0) return classCmp;
        return (a.sessionDate || '').localeCompare(b.sessionDate || '');
      });
    } else {
      list.sort((a, b) => {
        const classCmp = (a.courseTitle || '').localeCompare(b.courseTitle || '', 'fa');
        if (classCmp !== 0) return classCmp;
        const dateCmp = (a.sessionDate || '').localeCompare(b.sessionDate || '');
        if (dateCmp !== 0) return dateCmp;
        return (a.studentName || '').localeCompare(b.studentName || '', 'fa');
      });
    }
    return list;
  }, [rangeGrades, educationSortBy]);

  // Grouped view for Education Model on-screen inspection
  const educationGrouped = useMemo(() => {
    const groups = new Map<string, { title: string; subtitle: string; items: CounselingSessionGrade[] }>();
    educationRows.forEach(g => {
      const groupKey = educationSortBy === 'student'
        ? (g.studentId || g.studentName || 'unknown')
        : (g.courseTitle || 'کلاس نامشخص');
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          title: educationSortBy === 'student' ? (g.studentName || 'طلبه ناشناس') : (g.courseTitle || 'کلاس مشاوره'),
          subtitle: educationSortBy === 'student'
            ? (g.grade || 'پایه نامشخص')
            : `استاد مشاور: ${g.counselorTeacherName || '—'}`,
          items: []
        });
      }
      groups.get(groupKey)!.items.push(g);
    });
    return Array.from(groups.values());
  }, [educationRows, educationSortBy]);

  const showExportFeedback = (msg: string) => {
    setExportNotice(msg);
    setTimeout(() => setExportNotice(null), 4000);
  };

  // Export Model 1: Finance Excel
  const handleExportFinanceExcel = () => {
    if (financeRows.length === 0) {
      showExportFeedback('در بازه زمانی انتخاب‌شده رکوردی برای خروجی مالی وجود ندارد.');
      return;
    }

    const excelData = financeRows.map((row, idx) => ({
      'ردیف': idx + 1,
      'نام و نام خانوادگی طلبه': row.studentName,
      'کد طلبه / ملی': row.studentCode,
      'پایه تحصیلی': row.grade,
      'تعداد الف': row.alf,
      'تعداد ب': row.beh,
      'تعداد ج': row.jim,
      'تعداد د': row.dal,
      'تعداد غیبت کلاسی': row.absent,
      'عدم انجام تکلیف پژوهش': row.noHomework,
      'جمع کل نمرات (الف تا د)': row.totalScoredItems,
      'تعداد جلسات ارزیابی': row.sessionsCount
    }));

    excelData.push({
      'ردیف': financeRows.length + 1,
      'نام و نام خانوادگی طلبه': 'جمع کل',
      'کد طلبه / ملی': `بازه ${startDate} تا ${endDate}`,
      'پایه تحصیلی': `${financeRows.length} طلبه`,
      'تعداد الف': financeTotals.alf,
      'تعداد ب': financeTotals.beh,
      'تعداد ج': financeTotals.jim,
      'تعداد د': financeTotals.dal,
      'تعداد غیبت کلاسی': financeTotals.absent,
      'عدم انجام تکلیف پژوهش': financeTotals.noHomework,
      'جمع کل نمرات (الف تا د)': financeTotals.alf + financeTotals.beh + financeTotals.jim + financeTotals.dal,
      'تعداد جلسات ارزیابی': financeTotals.sessionsCount
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    ws['!cols'] = [
      { wch: 7 },
      { wch: 24 },
      { wch: 16 },
      { wch: 12 },
      { wch: 11 },
      { wch: 11 },
      { wch: 11 },
      { wch: 11 },
      { wch: 16 },
      { wch: 20 },
      { wch: 20 },
      { wch: 18 }
    ];
    ws['!views'] = [{ rightToLeft: true }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'گزارش مالی ارزیابی');
    const safeStart = (startDate || 'start').replace(/\//g, '-');
    const safeEnd = (endDate || 'end').replace(/\//g, '-');
    XLSX.writeFile(wb, `گزارش_مالی_ارزیابی_مشاوره_${safeStart}_تا_${safeEnd}.xlsx`);
    showExportFeedback('فایل اکسل ویژه مسئول مالی با موفقیت دانلود شد.');
  };

  // Export Model 2: Education Excel (honors student/class ordering)
  const handleExportEducationExcel = () => {
    if (educationRows.length === 0) {
      showExportFeedback('در بازه زمانی انتخاب‌شده رکوردی برای خروجی آموزشی وجود ندارد.');
      return;
    }

    const excelData = educationRows.map((g, idx) => {
      const partText = g.participationScore || '—';
      const resText = normalizeResearchScoreDisplay(g.researchScore) || '—';

      if (educationSortBy === 'student') {
        return {
          'ردیف': idx + 1,
          'نام و نام خانوادگی طلبه': g.studentName,
          'پایه تحصیلی': g.grade || '—',
          'عنوان کلاس مشاوره': g.courseTitle || '—',
          'استاد مشاور': g.counselorTeacherName || '—',
          'تاریخ جلسه': g.sessionDate,
          'شماره جلسه': g.sessionNumber || '—',
          'نمره مشارکت و حضور': partText,
          'نمره پژوهش و تقریر': resText,
          'یادداشت و بازخورد استاد': g.counselorFeedback || ''
        };
      }

      return {
        'ردیف': idx + 1,
        'عنوان کلاس مشاوره': g.courseTitle || '—',
        'استاد مشاور': g.counselorTeacherName || '—',
        'تاریخ جلسه': g.sessionDate,
        'شماره جلسه': g.sessionNumber || '—',
        'نام و نام خانوادگی طلبه': g.studentName,
        'پایه تحصیلی': g.grade || '—',
        'نمره مشارکت و حضور': partText,
        'نمره پژوهش و تقریر': resText,
        'یادداشت و بازخورد استاد': g.counselorFeedback || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    ws['!cols'] = educationSortBy === 'student'
      ? [
          { wch: 7 },
          { wch: 24 },
          { wch: 11 },
          { wch: 24 },
          { wch: 20 },
          { wch: 13 },
          { wch: 12 },
          { wch: 18 },
          { wch: 20 },
          { wch: 32 }
        ]
      : [
          { wch: 7 },
          { wch: 24 },
          { wch: 20 },
          { wch: 13 },
          { wch: 12 },
          { wch: 24 },
          { wch: 11 },
          { wch: 18 },
          { wch: 20 },
          { wch: 32 }
        ];
    ws['!views'] = [{ rightToLeft: true }];

    const wb = XLSX.utils.book_new();
    const sheetName = educationSortBy === 'student' ? 'گزارش آموزشی (طلاب)' : 'گزارش آموزشی (کلاس‌ها)';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const safeStart = (startDate || 'start').replace(/\//g, '-');
    const safeEnd = (endDate || 'end').replace(/\//g, '-');
    const orderTag = educationSortBy === 'student' ? 'بر_اساس_طلاب' : 'بر_اساس_کلاس';
    XLSX.writeFile(wb, `گزارش_آموزشی_ارزیابی_مشاوره_${orderTag}_${safeStart}_تا_${safeEnd}.xlsx`);
    showExportFeedback(`فایل اکسل ویژه مسئول آموزش (${educationSortBy === 'student' ? 'مرتب‌شده بر اساس طلاب' : 'مرتب‌شده بر اساس کلاس'}) دانلود شد.`);
  };

  return (
    <div className="space-y-5">
      {/* Date Range & Filters Control Card */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">گزارش‌گیری و خروجی اکسل ارزیابی مشاوره‌ها</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                بازه زمانی را مشخص کنید تا آمار و نمرات را مستقیماً مشاهده کرده یا خروجی اکسل ویژه مسئول مالی و مسئول آموزش دریافت نمایید.
              </p>
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'current_month', label: 'ماه جاری' },
              { id: 'last_month', label: 'ماه گذشته' },
              { id: 'all_year', label: 'کل سال تحصیلی' }
            ].map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyDatePreset(preset.id as 'current_month' | 'last_month' | 'all_year')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border',
                  datePreset === preset.id
                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Pickers + Secondary Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <ShamsiDatePicker
              label="از تاریخ (شمسی)"
              value={startDate}
              onChange={(val) => {
                setStartDate(val);
                setDatePreset('custom');
              }}
            />
          </div>
          <div>
            <ShamsiDatePicker
              label="تا تاریخ (شمسی)"
              value={endDate}
              onChange={(val) => {
                setEndDate(val);
                setDatePreset('custom');
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 block">پایه تحصیلی</label>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">همه پایه‌ها</option>
              <option value="پایه ۷">پایه ۷</option>
              <option value="پایه ۸">پایه ۸</option>
              <option value="پایه ۹">پایه ۹</option>
              <option value="پایه ۱۰">پایه ۱۰</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 block">کلاس مشاوره</label>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">همه کلاس‌های مشاوره</option>
              {courseOptions.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 block">جستجو</label>
            <div className="relative">
              <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="نام طلبه، کلاس یا استاد..."
                className="w-full h-[42px] pr-9 pl-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Direct Export Action Strip + Model Switcher */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {/* Model 1 Card: Finance */}
          <div
            onClick={() => setReportModel('finance')}
            className={cn(
              'rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between gap-3',
              reportModel === 'finance'
                ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-200/70 shadow-xs'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-50'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                  reportModel === 'finance' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-emerald-700'
                )}>
                  <Calculator size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">مدل ۱: گزارش تجمیعی ویژه مسئول مالی</h4>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    مجموع تعداد نمرات <strong className="text-emerald-700">الف</strong>، <strong className="text-blue-700">ب</strong>، <strong className="text-amber-700">ج</strong> و <strong className="text-rose-700">د</strong> هر طلبه در بازه انتخابی
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-black tabular-nums px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700 shrink-0">
                {toPersianDigits(financeRows.length)} طلبه
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-500">
                {reportModel === 'finance' ? 'در حال نمایش در جدول پایین' : 'برای مشاهده در صفحه کلیک کنید'}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExportFinanceExcel();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs"
              >
                <Download size={14} />
                <span>خروجی اکسل مسئول مالی</span>
              </button>
            </div>
          </div>

          {/* Model 2 Card: Education */}
          <div
            onClick={() => setReportModel('education')}
            className={cn(
              'rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between gap-3',
              reportModel === 'education'
                ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-200/70 shadow-xs'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-50'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                  reportModel === 'education' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-indigo-700'
                )}>
                  <GraduationCap size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">مدل ۲: گزارش تفصیلی ویژه مسئول آموزش</h4>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    ریز نمرات هر طلبه در هر جلسه از هر کلاس (قابل مرتب‌سازی بر اساس طلاب یا بر اساس کلاس)
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-black tabular-nums px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700 shrink-0">
                {toPersianDigits(educationRows.length)} رکورد
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
              <span className="text-[11px] font-bold text-slate-500">
                {reportModel === 'education' ? 'در حال نمایش در جدول پایین' : 'برای مشاهده در صفحه کلیک کنید'}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExportEducationExcel();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs"
              >
                <Download size={14} />
                <span>خروجی اکسل مسئول آموزش</span>
              </button>
            </div>
          </div>
        </div>

        {exportNotice && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold">
            <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
            <span>{exportNotice}</span>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* ON-SCREEN REPORT VIEW: MODEL 1 (FINANCE SUMMARY)                      */}
      {/* ===================================================================== */}
      {reportModel === 'finance' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
            <div>
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Calculator size={16} className="text-emerald-600" />
                <span>جدول تجمیعی نمرات طلاب — ویژه مسئول مالی</span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                بازه زمانی: {startDate} تا {endDate} • مجموع الف: {toPersianDigits(financeTotals.alf)} | ب: {toPersianDigits(financeTotals.beh)} | ج: {toPersianDigits(financeTotals.jim)} | د: {toPersianDigits(financeTotals.dal)}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-xl cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeZeroStudents}
                  onChange={(e) => setIncludeZeroStudents(e.target.checked)}
                  className="rounded accent-emerald-600"
                />
                <span>نمایش همه طلاب فعال (حتی بدون نمره)</span>
              </label>
            </div>
          </div>

          {financeRows.length === 0 ? (
            <div className="p-10 text-center text-xs font-bold text-slate-400">
              هیچ ارزیابی در بازه زمانی و فیلترهای انتخاب‌شده ثبت نشده است.
            </div>
          ) : isAdminMobile ? (
            <div className="p-3 space-y-2.5">
              {financeRows.map((row, idx) => (
                <div key={row.studentId} className="bg-slate-50/70 border border-slate-200 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-black text-slate-900 block truncate">
                        {toPersianDigits(idx + 1)}. {row.studentName}
                      </span>
                      <span className="text-[10px] text-slate-500">{row.grade} • {toPersianDigits(row.sessionsCount)} جلسه</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 text-center text-xs font-black tabular-nums">
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl py-1.5">
                      <span className="block text-[10px] font-bold">الف</span>
                      {toPersianDigits(row.alf)}
                    </div>
                    <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl py-1.5">
                      <span className="block text-[10px] font-bold">ب</span>
                      {toPersianDigits(row.beh)}
                    </div>
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl py-1.5">
                      <span className="block text-[10px] font-bold">ج</span>
                      {toPersianDigits(row.jim)}
                    </div>
                    <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl py-1.5">
                      <span className="block text-[10px] font-bold">د</span>
                      {toPersianDigits(row.dal)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black">
                    <th className="p-3 w-12 text-center">ردیف</th>
                    <th className="p-3">نام و نام خانوادگی طلبه</th>
                    <th className="p-3">پایه</th>
                    <th className="p-3 text-center bg-emerald-50/70 text-emerald-800">تعداد الف</th>
                    <th className="p-3 text-center bg-blue-50/70 text-blue-800">تعداد ب</th>
                    <th className="p-3 text-center bg-amber-50/70 text-amber-800">تعداد ج</th>
                    <th className="p-3 text-center bg-rose-50/70 text-rose-800">تعداد د</th>
                    <th className="p-3 text-center text-slate-500">غیبت</th>
                    <th className="p-3 text-center text-slate-500">عدم انجام تکلیف</th>
                    <th className="p-3 text-center">تعداد جلسات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700 tabular-nums">
                  {financeRows.map((row, idx) => (
                    <tr key={row.studentId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 text-center text-slate-400 font-bold">{toPersianDigits(idx + 1)}</td>
                      <td className="p-3 font-black text-slate-900">{row.studentName}</td>
                      <td className="p-3">
                        <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-bold">
                          {row.grade}
                        </span>
                      </td>
                      <td className="p-3 text-center font-black text-emerald-700 bg-emerald-50/30">{toPersianDigits(row.alf)}</td>
                      <td className="p-3 text-center font-black text-blue-700 bg-blue-50/30">{toPersianDigits(row.beh)}</td>
                      <td className="p-3 text-center font-black text-amber-700 bg-amber-50/30">{toPersianDigits(row.jim)}</td>
                      <td className="p-3 text-center font-black text-rose-700 bg-rose-50/30">{toPersianDigits(row.dal)}</td>
                      <td className="p-3 text-center text-slate-500 font-bold">{toPersianDigits(row.absent)}</td>
                      <td className="p-3 text-center text-slate-500 font-bold">{toPersianDigits(row.noHomework)}</td>
                      <td className="p-3 text-center font-bold text-slate-700">{toPersianDigits(row.sessionsCount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-black tabular-nums">
                    <td colSpan={3} className="p-3.5 text-right">
                      مجموع کل ({toPersianDigits(financeRows.length)} طلبه)
                    </td>
                    <td className="p-3.5 text-center text-emerald-300">{toPersianDigits(financeTotals.alf)}</td>
                    <td className="p-3.5 text-center text-blue-300">{toPersianDigits(financeTotals.beh)}</td>
                    <td className="p-3.5 text-center text-amber-300">{toPersianDigits(financeTotals.jim)}</td>
                    <td className="p-3.5 text-center text-rose-300">{toPersianDigits(financeTotals.dal)}</td>
                    <td className="p-3.5 text-center text-slate-300">{toPersianDigits(financeTotals.absent)}</td>
                    <td className="p-3.5 text-center text-slate-300">{toPersianDigits(financeTotals.noHomework)}</td>
                    <td className="p-3.5 text-center text-white">{toPersianDigits(financeTotals.sessionsCount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* ON-SCREEN REPORT VIEW: MODEL 2 (EDUCATION DETAILED)                   */}
      {/* ===================================================================== */}
      {reportModel === 'education' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
            <div>
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <GraduationCap size={16} className="text-indigo-600" />
                <span>گزارش تفصیلی جلسات و نمرات — ویژه مسئول آموزش</span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                بازه زمانی: {startDate} تا {endDate} • تعداد کل رکوردها: {toPersianDigits(educationRows.length)} ({toPersianDigits(educationGrouped.length)} {educationSortBy === 'student' ? 'طلبه' : 'کلاس'})
              </p>
            </div>

            {/* Sort / Grouping Mode Switcher (Applied both On-Screen and to Excel Export) */}
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-slate-200 w-fit">
              <button
                type="button"
                onClick={() => setEducationSortBy('student')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer',
                  educationSortBy === 'student'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                <Users size={14} />
                <span>مرتب‌سازی بر اساس طلاب</span>
              </button>
              <button
                type="button"
                onClick={() => setEducationSortBy('class')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer',
                  educationSortBy === 'class'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                <Layers size={14} />
                <span>مرتب‌سازی بر اساس کلاس</span>
              </button>
            </div>
          </div>

          {educationGrouped.length === 0 ? (
            <div className="p-10 text-center text-xs font-bold text-slate-400">
              هیچ ارزیابی در بازه زمانی و فیلترهای انتخاب‌شده ثبت نشده است.
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {educationGrouped.map((group, gIdx) => (
                <div key={`${group.title}-${gIdx}`} className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="bg-slate-50/90 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-800 text-[11px] font-black flex items-center justify-center shrink-0 tabular-nums">
                        {toPersianDigits(gIdx + 1)}
                      </span>
                      <span className="text-xs font-black text-slate-900 truncate">{group.title}</span>
                      <span className="text-[11px] text-slate-500 font-bold truncate hidden sm:inline">({group.subtitle})</span>
                    </div>
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-lg shrink-0 tabular-nums">
                      {toPersianDigits(group.items.length)} ارزیابی
                    </span>
                  </div>

                  {isAdminMobile ? (
                    <div className="p-3 space-y-2 bg-white">
                      {group.items.map(item => {
                        const partScore = item.participationScore || '';
                        const resScore = normalizeResearchScoreDisplay(item.researchScore);
                        return (
                          <div key={item.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-black text-slate-900 truncate">
                                {educationSortBy === 'student' ? item.courseTitle : item.studentName}
                              </span>
                              <span className="font-mono text-[10px] text-slate-500 tabular-nums shrink-0">
                                {item.sessionDate} ({item.sessionNumber || 'جلسه'})
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="text-slate-500 truncate">
                                {educationSortBy === 'student' ? `استاد: ${item.counselorTeacherName || '—'}` : (item.grade || '—')}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={cn(
                                  'px-2 py-0.5 rounded-md border text-[10px] font-black',
                                  partScore ? (REPORT_SCORE_BADGES[partScore] || 'bg-slate-100 text-slate-700 border-slate-200') : 'bg-white text-slate-400 border-slate-200'
                                )}>
                                  مشارکت: {partScore || '—'}
                                </span>
                                <span className={cn(
                                  'px-2 py-0.5 rounded-md border text-[10px] font-black',
                                  resScore ? (REPORT_SCORE_BADGES[resScore] || 'bg-slate-100 text-slate-700 border-slate-200') : 'bg-white text-slate-400 border-slate-200'
                                )}>
                                  پژوهش: {resScore || '—'}
                                </span>
                              </div>
                            </div>
                            {item.counselorFeedback && (
                              <p className="text-[11px] text-slate-600 pt-1 border-t border-slate-200/70">
                                {item.counselorFeedback}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="overflow-x-auto bg-white">
                      <table className="w-full text-right border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-500 text-[11px] font-black">
                            {educationSortBy === 'student' ? (
                              <>
                                <th className="p-2.5">کلاس مشاوره</th>
                                <th className="p-2.5">استاد مشاور</th>
                              </>
                            ) : (
                              <>
                                <th className="p-2.5">نام طلبه</th>
                                <th className="p-2.5">پایه</th>
                              </>
                            )}
                            <th className="p-2.5">تاریخ و جلسه</th>
                            <th className="p-2.5 text-center">نمره مشارکت و حضور</th>
                            <th className="p-2.5 text-center">نمره پژوهش و تقریر</th>
                            <th className="p-2.5">یادداشت استاد</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {group.items.map(item => {
                            const partScore = item.participationScore || '';
                            const resScore = normalizeResearchScoreDisplay(item.researchScore);
                            return (
                              <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                                {educationSortBy === 'student' ? (
                                  <>
                                    <td className="p-2.5 font-bold text-amber-900">{item.courseTitle}</td>
                                    <td className="p-2.5 text-slate-600">{item.counselorTeacherName || '—'}</td>
                                  </>
                                ) : (
                                  <>
                                    <td className="p-2.5 font-bold text-slate-900">{item.studentName}</td>
                                    <td className="p-2.5 text-slate-500">{item.grade || '—'}</td>
                                  </>
                                )}
                                <td className="p-2.5 font-mono text-[11px] text-slate-600 tabular-nums">
                                  {item.sessionDate} • {item.sessionNumber || 'جلسه'}
                                </td>
                                <td className="p-2.5 text-center">
                                  {partScore ? (
                                    <span className={cn('px-2.5 py-0.5 rounded-lg text-[10px] font-black border', REPORT_SCORE_BADGES[partScore])}>
                                      {partScore}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[11px]">—</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-center">
                                  {resScore ? (
                                    <span className={cn('px-2.5 py-0.5 rounded-lg text-[10px] font-black border', REPORT_SCORE_BADGES[resScore])}>
                                      {resScore}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[11px]">—</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-slate-500 text-[11px] max-w-xs truncate" title={item.counselorFeedback || ''}>
                                  {item.counselorFeedback || '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
