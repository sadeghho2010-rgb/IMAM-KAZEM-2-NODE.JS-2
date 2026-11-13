import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarCheck,
  Calendar,
  UserCheck,
  Users,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  ChevronLeft,
  Clock,
  BookOpen,
  Sparkles,
  CheckCircle2,
  X,
  Info,
  Printer,
  RefreshCw,
  CalendarDays,
  UserPlus
} from 'lucide-react';
import { localDb } from '../../lib/localDb';
import {
  Program,
  AcademicCalendarPeriod,
  AcademicHolidayItem,
  AcademicSubPeriod,
  AttendanceSessionLog
} from '../../types';
import {
  getTodayShamsi,
  parseShamsiDate,
  formatShamsiDate,
  generateShamsiDateRange,
  getShamsiDayOfWeek,
  getShamsiDayOfWeekName,
  isDateBetween,
  compareShamsi,
  toPersianDigits,
  normalizeShamsiDateStr,
  getConsolidatedSessionLog,
  SHAMSI_MONTH_NAMES
} from '../../lib/jalali';
import ShamsiDatePicker from '../ShamsiDatePicker';
import { cn } from '../../lib/utils';

interface SessionDetailRow {
  date: string;
  dayOfWeekName: string;
  status: 'held_main' | 'held_substitute' | 'cancelled_class' | 'official_holiday' | 'outside_period' | 'upcoming';
  statusLabel: string;
  teacherName: string;
  isSubstitute: boolean;
  substituteTeacherName?: string;
  holidayReason?: string;
  cancelReason?: string;
  hasAttendanceLog: boolean;
  presentCount: number;
  lateCount: number;
  absentCount: number;
}

interface ClassHeldSummary {
  program: Program;
  scheduledDays: string[];
  totalScheduledDaysInRange: number;
  heldMainCount: number;
  heldSubCount: number;
  totalHeldCount: number;
  cancelledClassCount: number;
  officialHolidayCount: number;
  upcomingCount: number;
  substituteBreakdown: { name: string; count: number; dates: string[] }[];
  sessions: SessionDetailRow[];
}

function getProgramDaysList(p: Program): string[] {
  if (Array.isArray(p.days) && p.days.length > 0) {
    return p.days.map(d => d.trim()).filter(Boolean);
  }
  if (p.day && typeof p.day === 'string') {
    if (p.day.includes('شنبه تا چهارشنبه')) {
      return ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه'];
    }
    if (p.day.includes('هر روز')) {
      return ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه'];
    }
    return p.day.split(/[,،\- و]+/).map(s => s.trim()).filter(Boolean);
  }
  return ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه'];
}

function getDefault20To20Cycle(todayShamsi: string, monthOffset: number = 0): { start: string; end: string; label: string } {
  const parts = parseShamsiDate(todayShamsi);
  let startYear = parts.year;
  let startMonth = parts.month;

  if (parts.day < 20) {
    if (startMonth === 1) {
      startMonth = 12;
      startYear -= 1;
    } else {
      startMonth -= 1;
    }
  }

  startMonth += monthOffset;
  while (startMonth > 12) {
    startMonth -= 12;
    startYear += 1;
  }
  while (startMonth < 1) {
    startMonth += 12;
    startYear -= 1;
  }

  let endYear = startYear;
  let endMonth = startMonth + 1;
  if (endMonth > 12) {
    endMonth = 1;
    endYear += 1;
  }

  const start = formatShamsiDate(startYear, startMonth, 20);
  const end = formatShamsiDate(endYear, endMonth, 20);
  const startMonthName = SHAMSI_MONTH_NAMES[startMonth - 1] || '';
  const endMonthName = SHAMSI_MONTH_NAMES[endMonth - 1] || '';
  const label = `۲۰ ${startMonthName} الی ۲۰ ${endMonthName} ${toPersianDigits(endYear)}`;

  return { start, end, label };
}

export default function HeldSessionsReport() {
  const todayShamsi = useMemo(() => getTodayShamsi(), []);
  const defaultCycle = useMemo(() => getDefault20To20Cycle(todayShamsi, 0), [todayShamsi]);

  const [fromDate, setFromDate] = useState<string>(defaultCycle.start);
  const [toDate, setToDate] = useState<string>(defaultCycle.end);
  const [includeFutureDatesAsHeld, setIncludeFutureDatesAsHeld] = useState<boolean>(false);

  const [programs, setPrograms] = useState<Program[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceSessionLog[]>([]);
  const [periods, setPeriods] = useState<AcademicCalendarPeriod[]>([]);
  const [holidays, setHolidays] = useState<AcademicHolidayItem[]>([]);
  const [subPeriods, setSubPeriods] = useState<AcademicSubPeriod[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('all');
  const [selectedClassSummary, setSelectedClassSummary] = useState<ClassHeldSummary | null>(null);
  const [sessionFilterInModal, setSessionFilterInModal] = useState<string>('all');

  const loadData = async () => {
    try {
      const [progsData, attData, periodsData, holidaysData, subPeriodsData] = await Promise.all([
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<AttendanceSessionLog>('attendance'),
        localDb.getDocs<AcademicCalendarPeriod>('academic_calendar_periods'),
        localDb.getDocs<AcademicHolidayItem>('academic_holidays'),
        localDb.getDocs<AcademicSubPeriod>('academic_sub_periods')
      ]);

      const validPrograms = (Array.isArray(progsData) ? progsData : []).filter(
        p => p && p.id && !(p as any).isDeleted && (p as any).status !== 'deleted' && p.title
      );

      setPrograms(validPrograms);
      setAttendanceLogs(Array.isArray(attData) ? attData : []);
      setPeriods(Array.isArray(periodsData) ? periodsData : []);
      setHolidays(Array.isArray(holidaysData) ? holidaysData : []);
      setSubPeriods(Array.isArray(subPeriodsData) ? subPeriodsData : []);
    } catch (err) {
      console.error('Error loading held sessions report data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = localDb.subscribe(() => {
      loadData();
    });
    return () => unsub();
  }, []);

  const applyPresetCycle = (offset: number) => {
    const cycle = getDefault20To20Cycle(todayShamsi, offset);
    setFromDate(cycle.start);
    setToDate(cycle.end);
  };

  const applyCurrentMonthPreset = () => {
    const parts = parseShamsiDate(todayShamsi);
    setFromDate(formatShamsiDate(parts.year, parts.month, 1));
    const endDay = parts.month <= 6 ? 31 : parts.month <= 11 ? 30 : 29;
    setToDate(formatShamsiDate(parts.year, parts.month, endDay));
  };

  const applyUpToTodayPreset = () => {
    const cycle = getDefault20To20Cycle(todayShamsi, 0);
    setFromDate(cycle.start);
    setToDate(todayShamsi);
  };

  // Precompute calendar status for every date in [fromDate, toDate]
  const dateRangeList = useMemo(() => {
    const normStart = normalizeShamsiDateStr(fromDate);
    const normEnd = normalizeShamsiDateStr(toDate);
    if (!normStart || !normEnd || compareShamsi(normStart, normEnd) > 0) return [];
    return generateShamsiDateRange(normStart, normEnd);
  }, [fromDate, toDate]);

  const calendarDayEvaluationMap = useMemo(() => {
    const map = new Map<
      string,
      {
        isOfficialHoliday: boolean;
        holidayReason?: string;
        isOutsidePeriod: boolean;
        dayOfWeekName: string;
        isThursday: boolean;
        isFriday: boolean;
      }
    >();

    // Map holidays by date
    const holidayByDate = new Map<string, AcademicHolidayItem>();
    for (const h of holidays) {
      if (!h || !h.startDate) continue;
      const hStart = normalizeShamsiDateStr(h.startDate);
      const hEnd = normalizeShamsiDateStr(h.endDate || h.startDate);
      const hDates = generateShamsiDateRange(hStart, hEnd);
      for (const hd of hDates) {
        holidayByDate.set(hd, h);
      }
    }

    // Map sub-periods by date
    const subPeriodByDate = new Map<string, AcademicSubPeriod>();
    for (const sp of subPeriods) {
      if (!sp || !sp.startDate) continue;
      const spStart = normalizeShamsiDateStr(sp.startDate);
      const spEnd = normalizeShamsiDateStr(sp.endDate || sp.startDate);
      const spDates = generateShamsiDateRange(spStart, spEnd);
      for (const spd of spDates) {
        subPeriodByDate.set(spd, sp);
      }
    }

    for (const d of dateRangeList) {
      const dow = getShamsiDayOfWeek(d); // 0=Sat ... 5=Thu, 6=Fri
      const dowName = getShamsiDayOfWeekName(d);
      const isThu = dow === 5;
      const isFri = dow === 6;

      // Check matching academic period
      const matchedPeriod = periods.find(p => {
        const pStart = normalizeShamsiDateStr(p.startDate);
        const pEnd = normalizeShamsiDateStr(p.endDate);
        return pStart && pEnd && isDateBetween(d, pStart, pEnd);
      });

      const holidayItem = holidayByDate.get(d);
      const subPeriodItem = subPeriodByDate.get(d);

      let isOfficialHoliday = false;
      let holidayReason: string | undefined = undefined;
      let isOutsidePeriod = false;

      if (holidayItem) {
        isOfficialHoliday = true;
        holidayReason = holidayItem.title || 'تعطیل رسمی تقویم آموزشی';
      } else if (subPeriodItem) {
        const spType = (subPeriodItem as any).type || (subPeriodItem as any).category || '';
        if (spType === 'holiday' || (!subPeriodItem.isStandardClassDay && subPeriodItem.isAcademicPresence === false)) {
          isOfficialHoliday = true;
          holidayReason = subPeriodItem.title || 'بازه تعطیل در تقویم آموزشی';
        } else if (spType === 'exams' && !subPeriodItem.isStandardClassDay) {
          isOfficialHoliday = true;
          holidayReason = `ایام امتحانات (${subPeriodItem.title || 'بدون کلاس عادی'})`;
        }
      } else if (isFri && !matchedPeriod?.includeFridayAsStudyDay) {
        isOfficialHoliday = true;
        holidayReason = 'تعطیلی آخر هفته (جمعه)';
      } else if (periods.length > 0 && !matchedPeriod) {
        // If academic calendar periods are defined and this date falls outside all defined periods, check if it's still within normal range
        // We don't block calculation if the user explicitly selected this range, unless it's Friday
        isOutsidePeriod = false;
      }

      map.set(d, {
        isOfficialHoliday,
        holidayReason,
        isOutsidePeriod,
        dayOfWeekName: dowName,
        isThursday: isThu,
        isFriday: isFri
      });
    }

    return map;
  }, [dateRangeList, periods, holidays, subPeriods]);

  const classSummaries = useMemo<ClassHeldSummary[]>(() => {
    return programs.map(program => {
      const scheduledDays = getProgramDaysList(program);
      const mainTeacherName = (program.teacher || (program as any).teacherName || 'تعیین نشده').trim();

      let totalScheduledDaysInRange = 0;
      let heldMainCount = 0;
      let heldSubCount = 0;
      let cancelledClassCount = 0;
      let officialHolidayCount = 0;
      let upcomingCount = 0;

      const subMap = new Map<string, { name: string; count: number; dates: string[] }>();
      const sessions: SessionDetailRow[] = [];

      for (const d of dateRangeList) {
        const calInfo = calendarDayEvaluationMap.get(d);
        if (!calInfo) continue;

        const isScheduledWeekday = scheduledDays.includes(calInfo.dayOfWeekName);
        const attLog = getConsolidatedSessionLog(attendanceLogs, program.id, d, program.title);

        // Even if not a scheduled weekday, if an explicit attendance log was recorded for this class on date `d`, include it!
        if (!isScheduledWeekday && !attLog) {
          continue;
        }

        totalScheduledDaysInRange++;

        const isFutureDate = compareShamsi(d, todayShamsi) > 0;
        const hasStudentsRecorded = Boolean(
          attLog &&
            Array.isArray(attLog.students) &&
            attLog.students.some((s: any) => s && s.status && s.status !== 'unspecified')
        );
        const presentCount = attLog?.presentCount ?? 0;
        const lateCount = attLog?.lateCount ?? 0;
        const absentCount = attLog?.absentCount ?? 0;

        // 1. Check if class was explicitly cancelled in Attendance
        if (attLog?.isCancelled) {
          cancelledClassCount++;
          sessions.push({
            date: d,
            dayOfWeekName: calInfo.dayOfWeekName,
            status: 'cancelled_class',
            statusLabel: 'لغو شده اختصاصی کلاس',
            teacherName: mainTeacherName,
            isSubstitute: false,
            cancelReason: attLog.cancelReason || 'عدم تشکیل جلسه کلاس',
            hasAttendanceLog: true,
            presentCount: 0,
            lateCount: 0,
            absentCount: 0
          });
          continue;
        }

        // 2. Check if an explicit attendance log says it was held with a substitute teacher
        if (attLog?.hasSubstituteTeacher) {
          const subName = (attLog.substituteTeacherName || 'استاد جایگزین').trim();
          heldSubCount++;
          const existingSub = subMap.get(subName) || { name: subName, count: 0, dates: [] };
          existingSub.count += 1;
          existingSub.dates.push(d);
          subMap.set(subName, existingSub);

          sessions.push({
            date: d,
            dayOfWeekName: calInfo.dayOfWeekName,
            status: 'held_substitute',
            statusLabel: `برگزار شده با استاد جایگزین (${subName})`,
            teacherName: subName,
            isSubstitute: true,
            substituteTeacherName: subName,
            hasAttendanceLog: true,
            presentCount,
            lateCount,
            absentCount
          });
          continue;
        }

        // 3. If it's an official holiday in Academic Calendar (and no explicit active attendance override was logged)
        if (calInfo.isOfficialHoliday && !hasStudentsRecorded) {
          officialHolidayCount++;
          sessions.push({
            date: d,
            dayOfWeekName: calInfo.dayOfWeekName,
            status: 'official_holiday',
            statusLabel: 'تعطیل رسمی تقویم آموزشی',
            teacherName: mainTeacherName,
            isSubstitute: false,
            holidayReason: calInfo.holidayReason || 'تعطیل رسمی تقویم آموزشی',
            hasAttendanceLog: false,
            presentCount: 0,
            lateCount: 0,
            absentCount: 0
          });
          continue;
        }

        // 4. Future date check (unless user opted to include future dates in range or attendance was already recorded)
        if (isFutureDate && !includeFutureDatesAsHeld && !hasStudentsRecorded) {
          upcomingCount++;
          sessions.push({
            date: d,
            dayOfWeekName: calInfo.dayOfWeekName,
            status: 'upcoming',
            statusLabel: 'جلسه آتی (در انتظار برگزاری)',
            teacherName: mainTeacherName,
            isSubstitute: false,
            hasAttendanceLog: false,
            presentCount: 0,
            lateCount: 0,
            absentCount: 0
          });
          continue;
        }

        // 5. Held with Main Teacher!
        heldMainCount++;
        sessions.push({
          date: d,
          dayOfWeekName: calInfo.dayOfWeekName,
          status: 'held_main',
          statusLabel: 'برگزار شده با استاد اصلی',
          teacherName: mainTeacherName,
          isSubstitute: false,
          hasAttendanceLog: Boolean(attLog),
          presentCount,
          lateCount,
          absentCount
        });
      }

      return {
        program,
        scheduledDays,
        totalScheduledDaysInRange,
        heldMainCount,
        heldSubCount,
        totalHeldCount: heldMainCount + heldSubCount,
        cancelledClassCount,
        officialHolidayCount,
        upcomingCount,
        substituteBreakdown: Array.from(subMap.values()),
        sessions
      };
    });
  }, [programs, dateRangeList, calendarDayEvaluationMap, attendanceLogs, todayShamsi, includeFutureDatesAsHeld]);

  // Keep selectedClassSummary synced if data updates
  useEffect(() => {
    if (selectedClassSummary) {
      const updated = classSummaries.find(c => c.program.id === selectedClassSummary.program.id);
      if (updated) {
        setSelectedClassSummary(updated);
      }
    }
  }, [classSummaries]);

  const availableGrades = useMemo(() => {
    const set = new Set<string>();
    programs.forEach(p => {
      if (p.grade) set.add(p.grade);
    });
    return Array.from(set);
  }, [programs]);

  const availableTeachers = useMemo(() => {
    const set = new Set<string>();
    programs.forEach(p => {
      const t = (p.teacher || (p as any).teacherName || '').trim();
      if (t) set.add(t);
    });
    return Array.from(set);
  }, [programs]);

  const filteredSummaries = useMemo(() => {
    return classSummaries.filter(item => {
      const p = item.program;
      if (selectedGrade !== 'all' && p.grade !== selectedGrade) return false;
      const tName = (p.teacher || (p as any).teacherName || '').trim();
      if (selectedTeacher !== 'all' && tName !== selectedTeacher) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matchTitle = (p.title || '').toLowerCase().includes(q);
        const matchBook = (p.subjectBook || '').toLowerCase().includes(q);
        const matchTeacher = tName.toLowerCase().includes(q);
        const matchRoom = (p.madrasRoom || '').toLowerCase().includes(q);
        if (!matchTitle && !matchBook && !matchTeacher && !matchRoom) return false;
      }
      return true;
    });
  }, [classSummaries, selectedGrade, selectedTeacher, searchTerm]);

  const aggregateStats = useMemo(() => {
    return filteredSummaries.reduce(
      (acc, cur) => {
        acc.totalClasses += 1;
        acc.totalHeld += cur.totalHeldCount;
        acc.heldMain += cur.heldMainCount;
        acc.heldSub += cur.heldSubCount;
        acc.cancelled += cur.cancelledClassCount;
        acc.holidays += cur.officialHolidayCount;
        return acc;
      },
      { totalClasses: 0, totalHeld: 0, heldMain: 0, heldSub: 0, cancelled: 0, holidays: 0 }
    );
  }, [filteredSummaries]);

  const filteredModalSessions = useMemo(() => {
    if (!selectedClassSummary) return [];
    if (sessionFilterInModal === 'all') return selectedClassSummary.sessions;
    if (sessionFilterInModal === 'held_all') {
      return selectedClassSummary.sessions.filter(
        s => s.status === 'held_main' || s.status === 'held_substitute'
      );
    }
    return selectedClassSummary.sessions.filter(s => s.status === sessionFilterInModal);
  }, [selectedClassSummary, sessionFilterInModal]);

  return (
    <div className="space-y-6 font-vazir text-right pb-12" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-violet-950 rounded-3xl p-5 sm:p-7 text-white shadow-xl border border-indigo-500/30 relative overflow-hidden">
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-black text-amber-300">
              <CalendarCheck size={15} />
              <span>گزارش هوشمند آموزش و تقویم تحصیلی</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              تعداد جلسات برگزار شده کلاس‌های درس
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100/90 font-medium max-w-3xl leading-relaxed">
              محاسبه دقیق جلسات تشکیل‌شده هر کلاس بر اساس تقویم آموزشی (ایام دایر و تعطیلات رسمی)، برنامه هفتگی کلاس، جلسات لغوشده اختصاصی در حضور و غیاب، و تفکیک کامل جلسات استاد اصلی و استاد جایگزین.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-center">
            <button
              type="button"
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-black transition-all cursor-pointer active:scale-95"
            >
              <RefreshCw size={15} className={cn(isLoading && 'animate-spin')} />
              <span>بروزرسانی آمار</span>
            </button>
          </div>
        </div>
      </div>

      {/* Date Range & Filter Control Panel */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
              <CalendarDays size={18} className="text-indigo-600" />
              <span>انتخاب بازه زمانی محاسبه جلسات (مثلاً ۲۰ به ۲۰ هر ماه)</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              بازه تاریخ شمسی مورد نظر خود را انتخاب کنید و سپس روی هر کلاس کلیک نمایید تا ریز جلسات آن را مشاهده کنید.
            </p>
          </div>

          {/* Quick Cycle Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => applyPresetCycle(0)}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-black transition-all cursor-pointer"
            >
              دوره ۲۰ تا ۲۰ جاری
            </button>
            <button
              type="button"
              onClick={() => applyPresetCycle(-1)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition-all cursor-pointer"
            >
              دوره ۲۰ تا ۲۰ ماه قبل
            </button>
            <button
              type="button"
              onClick={applyUpToTodayPreset}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all cursor-pointer"
            >
              ۲۰ ماه قبل تا امروز ({toPersianDigits(todayShamsi)})
            </button>
            <button
              type="button"
              onClick={applyCurrentMonthPreset}
              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-all cursor-pointer"
            >
              کل ماه جاری
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <ShamsiDatePicker
              label="از تاریخ (شروع بازه)"
              value={fromDate}
              onChange={setFromDate}
            />
          </div>
          <div>
            <ShamsiDatePicker
              label="تا تاریخ (پایان بازه)"
              value={toDate}
              onChange={setToDate}
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-700 mb-1.5">فیلتر پایه تحصیلی</label>
            <select
              value={selectedGrade}
              onChange={e => setSelectedGrade(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">همه پایه‌ها ({toPersianDigits(programs.length)} کلاس)</option>
              {availableGrades.map(g => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-700 mb-1.5">فیلتر استاد اصلی</label>
            <select
              value={selectedTeacher}
              onChange={e => setSelectedTeacher(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">همه اساتید</option>
              {availableTeachers.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-700 mb-1.5">جستجوی نام کلاس یا استاد</label>
            <div className="relative">
              <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="جستجو در نام درس، کتاب، استاد..."
                className="w-full pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Option for future dates inside range */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2 text-slate-600 font-bold">
            <Info size={15} className="text-indigo-600 shrink-0" />
            <span>
              تعداد کل روزهای تقویمی در بازه انتخابی ({toPersianDigits(fromDate)} تا {toPersianDigits(toDate)}):{' '}
              <strong className="text-indigo-700 font-black">{toPersianDigits(dateRangeList.length)} روز</strong>
            </span>
          </div>

          <label className="inline-flex items-center gap-2 cursor-pointer select-none font-bold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              checked={includeFutureDatesAsHeld}
              onChange={e => setIncludeFutureDatesAsHeld(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>شمارش روزهای آیندهِ داخل بازه (بعد از امروز {toPersianDigits(todayShamsi)}) به عنوان جلسه برگزار شده فرضی</span>
          </label>
        </div>
      </div>

      {/* Aggregate Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black shrink-0">
            <BookOpen size={20} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500">تعداد کلاس‌ها</div>
            <div className="text-lg font-black text-slate-900">
              {toPersianDigits(aggregateStats.totalClasses)} <span className="text-xs font-bold text-slate-400">کلاس</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-4 text-white shadow-md flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/20 text-white flex items-center justify-center font-black shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-emerald-100">مجموع جلسات برگزار شده</div>
            <div className="text-lg font-black text-white">
              {toPersianDigits(aggregateStats.totalHeld)} <span className="text-xs font-bold text-emerald-100">جلسه</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-emerald-200 shadow-2xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black shrink-0">
            <UserCheck size={20} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500">با استاد اصلی</div>
            <div className="text-lg font-black text-emerald-700">
              {toPersianDigits(aggregateStats.heldMain)} <span className="text-xs font-bold text-slate-400">جلسه</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-2xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-black shrink-0">
            <UserPlus size={20} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500">با استاد جایگزین</div>
            <div className="text-lg font-black text-amber-700">
              {toPersianDigits(aggregateStats.heldSub)} <span className="text-xs font-bold text-slate-400">جلسه</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-rose-200 shadow-2xs flex items-center gap-3 col-span-2 md:col-span-1">
          <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center font-black shrink-0">
            <XCircle size={20} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500">لغو اختصاصی / تعطیل رسمی</div>
            <div className="text-sm font-black text-rose-700">
              {toPersianDigits(aggregateStats.cancelled)} لغو • {toPersianDigits(aggregateStats.holidays)} تعطیل
            </div>
          </div>
        </div>
      </div>

      {/* Classes Grid */}
      {isLoading ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-500 font-bold">
          در حال محاسبه جلسات برگزار شده کلاس‌ها...
        </div>
      ) : filteredSummaries.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-2">
          <p className="text-sm font-black text-slate-700">هیچ کلاسی مطابق با فیلترهای انتخابی یافت نشد.</p>
          <p className="text-xs text-slate-400">لطفاً فیلتر پایه یا عبارت جستجو را تغییر دهید.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredSummaries.map(item => {
            const { program } = item;
            const mainTeacher = program.teacher || (program as any).teacherName || 'تعیین نشده';
            return (
              <div
                key={program.id}
                onClick={() => {
                  setSessionFilterInModal('all');
                  setSelectedClassSummary(item);
                }}
                className="bg-white hover:bg-indigo-50/20 rounded-3xl p-5 border border-slate-200/90 hover:border-indigo-400 shadow-xs hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Top Row: Grade & Time */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-black">
                      {program.grade || 'عمومی'}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                      <Clock size={13} className="text-indigo-500" />
                      <span>{program.time || 'ساعت نامشخص'}</span>
                      {program.madrasRoom && (
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-black">
                          مَدرَس {program.madrasRoom}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Class Title & Main Teacher */}
                  <div>
                    <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-700 transition-colors">
                      {program.title}
                      {program.subjectBook ? ` (${program.subjectBook})` : ''}
                    </h3>
                    <p className="text-xs font-bold text-slate-600 mt-1 flex items-center gap-1.5">
                      <UserCheck size={14} className="text-emerald-600 shrink-0" />
                      <span>استاد اصلی:</span>
                      <span className="text-slate-900 font-black">{mainTeacher}</span>
                    </p>
                  </div>

                  {/* Scheduled Days */}
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-400 ml-1">روزهای برگزاری:</span>
                    {item.scheduledDays.map(day => (
                      <span
                        key={day}
                        className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200/80"
                      >
                        {day}
                      </span>
                    ))}
                  </div>

                  {/* Explicit Narrative Summary inside Card */}
                  <div className="p-3 rounded-2xl bg-gradient-to-l from-emerald-50/90 via-teal-50/60 to-indigo-50/50 border border-emerald-200/80 text-xs leading-relaxed text-slate-800 font-bold">
                    <span className="text-emerald-800 font-black">
                      {toPersianDigits(item.heldMainCount)} جلسه
                    </span>{' '}
                    با استاد اصلی و{' '}
                    <span className="text-amber-700 font-black">
                      {toPersianDigits(item.heldSubCount)} جلسه
                    </span>{' '}
                    با استاد جایگزین برگزار شده است و{' '}
                    <span className="text-indigo-800 font-black underline decoration-indigo-300 underline-offset-4">
                      مجموعاً {toPersianDigits(item.totalHeldCount)} جلسه برگزار شده است
                    </span>
                    .
                  </div>

                  {/* Substitute Teachers Chip if any */}
                  {item.substituteBreakdown.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] font-black text-amber-700">اساتید جایگزین:</span>
                      {item.substituteBreakdown.map(sub => (
                        <span
                          key={sub.name}
                          className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black"
                        >
                          {sub.name} ({toPersianDigits(sub.count)} جلسه)
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Metrics Bar */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[11px] font-bold">
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-100/80 text-emerald-800 font-black">
                      برگزار شده: {toPersianDigits(item.totalHeldCount)}
                    </span>
                    {item.cancelledClassCount > 0 && (
                      <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 font-black">
                        لغو کلاس: {toPersianDigits(item.cancelledClassCount)}
                      </span>
                    )}
                    {item.officialHolidayCount > 0 && (
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-bold">
                        تعطیل رسمی: {toPersianDigits(item.officialHolidayCount)}
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-black text-indigo-600 group-hover:translate-x-[-2px] transition-transform flex items-center gap-0.5 shrink-0">
                    <span>ریز جلسات</span>
                    <ChevronLeft size={15} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed Modal for Selected Class */}
      {selectedClassSummary && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto font-vazir"
          dir="rtl"
          onClick={() => setSelectedClassSummary(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-xs font-black">
                    {selectedClassSummary.program.grade || 'عمومی'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-black">
                    بازه: {toPersianDigits(fromDate)} تا {toPersianDigits(toDate)}
                  </span>
                  {selectedClassSummary.program.time && (
                    <span className="text-xs text-slate-300 font-bold">
                      ساعت {selectedClassSummary.program.time}
                    </span>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white">
                  گزارش تفصیلی جلسات کلاس «{selectedClassSummary.program.title}»
                </h2>
                <p className="text-xs text-indigo-200 font-bold">
                  استاد اصلی کلاس:{' '}
                  <span className="text-white font-black">
                    {selectedClassSummary.program.teacher || (selectedClassSummary.program as any).teacherName || 'تعیین نشده'}
                  </span>{' '}
                  • روزهای هفتگی: {selectedClassSummary.scheduledDays.join('، ')}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedClassSummary(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {/* Primary Highlight Statement */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-l from-emerald-50 via-teal-50/70 to-indigo-50 border-2 border-emerald-300/80 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-900 font-black text-sm sm:text-base leading-relaxed">
                  <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                  <span>
                    در بازه زمانی {toPersianDigits(fromDate)} تا {toPersianDigits(toDate)}، این کلاس{' '}
                    <strong className="text-emerald-700 underline decoration-emerald-400 underline-offset-4">
                      {toPersianDigits(selectedClassSummary.heldMainCount)} جلسه با استاد اصلی (
                      {selectedClassSummary.program.teacher || (selectedClassSummary.program as any).teacherName || 'تعیین نشده'})
                    </strong>{' '}
                    و{' '}
                    <strong className="text-amber-700 underline decoration-amber-400 underline-offset-4">
                      {toPersianDigits(selectedClassSummary.heldSubCount)} جلسه با استاد جایگزین
                    </strong>{' '}
                    برگزار شده است و{' '}
                    <strong className="text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded-lg">
                      مجموعاً {toPersianDigits(selectedClassSummary.totalHeldCount)} جلسه برگزار شده است
                    </strong>
                    .
                  </span>
                </div>

                {selectedClassSummary.substituteBreakdown.length > 0 && (
                  <div className="pt-2 border-t border-emerald-200/70 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-black text-amber-800">تفکیک جلسات اساتید جایگزین:</span>
                    {selectedClassSummary.substituteBreakdown.map(sub => (
                      <span
                        key={sub.name}
                        className="px-2.5 py-1 rounded-xl bg-white text-amber-900 border border-amber-300 font-black shadow-2xs"
                      >
                        {sub.name}: {toPersianDigits(sub.count)} جلسه (تاریخ‌ها:{' '}
                        {sub.dates.map(d => toPersianDigits(d)).join('، ')})
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Filter Pills for Session Table */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSessionFilterInModal('all')}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer',
                    sessionFilterInModal === 'all'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  )}
                >
                  همه روزهای برنامه‌ریزی‌شده در بازه ({toPersianDigits(selectedClassSummary.sessions.length)})
                </button>
                <button
                  type="button"
                  onClick={() => setSessionFilterInModal('held_all')}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer',
                    sessionFilterInModal === 'held_all'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                  )}
                >
                  مجموع برگزار شده ({toPersianDigits(selectedClassSummary.totalHeldCount)})
                </button>
                <button
                  type="button"
                  onClick={() => setSessionFilterInModal('held_main')}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer',
                    sessionFilterInModal === 'held_main'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  )}
                >
                  با استاد اصلی ({toPersianDigits(selectedClassSummary.heldMainCount)})
                </button>
                <button
                  type="button"
                  onClick={() => setSessionFilterInModal('held_substitute')}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer',
                    sessionFilterInModal === 'held_substitute'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  )}
                >
                  با استاد جایگزین ({toPersianDigits(selectedClassSummary.heldSubCount)})
                </button>
                <button
                  type="button"
                  onClick={() => setSessionFilterInModal('cancelled_class')}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer',
                    sessionFilterInModal === 'cancelled_class'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  )}
                >
                  لغو اختصاصی کلاس ({toPersianDigits(selectedClassSummary.cancelledClassCount)})
                </button>
                <button
                  type="button"
                  onClick={() => setSessionFilterInModal('official_holiday')}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer',
                    sessionFilterInModal === 'official_holiday'
                      ? 'bg-slate-700 text-white border-slate-700'
                      : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                  )}
                >
                  تعطیل رسمی تقویم ({toPersianDigits(selectedClassSummary.officialHolidayCount)})
                </button>
              </div>

              {/* Session-by-Session Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4 w-12 text-center">#</th>
                        <th className="py-3 px-4">تاریخ شمسی</th>
                        <th className="py-3 px-4">روز هفته</th>
                        <th className="py-3 px-4">وضعیت جلسه</th>
                        <th className="py-3 px-4">استاد جلسه / علت عدم تشکیل</th>
                        <th className="py-3 px-4 text-center">ثبت حضور و غیاب</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredModalSessions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                            موردی با این فیلتر در بازه انتخابی وجود ندارد.
                          </td>
                        </tr>
                      ) : (
                        filteredModalSessions.map((s, idx) => (
                          <tr
                            key={s.date}
                            className={cn(
                              'transition-colors',
                              s.status === 'held_main' && 'bg-white hover:bg-emerald-50/30',
                              s.status === 'held_substitute' && 'bg-amber-50/40 hover:bg-amber-50/70',
                              s.status === 'cancelled_class' && 'bg-rose-50/40 hover:bg-rose-50/70',
                              s.status === 'official_holiday' && 'bg-slate-50/80 text-slate-500',
                              s.status === 'upcoming' && 'bg-sky-50/30 text-slate-600'
                            )}
                          >
                            <td className="py-3 px-4 text-center font-black text-slate-400">
                              {toPersianDigits(idx + 1)}
                            </td>
                            <td className="py-3 px-4 font-mono font-black text-slate-900">
                              {toPersianDigits(s.date)}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-700">{s.dayOfWeekName}</td>
                            <td className="py-3 px-4">
                              {s.status === 'held_main' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-black">
                                  <CheckCircle2 size={13} />
                                  <span>برگزار شده (استاد اصلی)</span>
                                </span>
                              )}
                              {s.status === 'held_substitute' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-black border border-amber-300">
                                  <UserPlus size={13} />
                                  <span>برگزار شده (استاد جایگزین)</span>
                                </span>
                              )}
                              {s.status === 'cancelled_class' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 font-black border border-rose-200">
                                  <XCircle size={13} />
                                  <span>لغو اختصاصی کلاس</span>
                                </span>
                              )}
                              {s.status === 'official_holiday' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200 text-slate-700 font-bold">
                                  <Calendar size={13} />
                                  <span>تعطیل رسمی تقویم آموزشی</span>
                                </span>
                              )}
                              {s.status === 'upcoming' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-100 text-sky-800 font-bold">
                                  <Clock size={13} />
                                  <span>جلسه آتی</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-bold">
                              {s.status === 'held_main' && (
                                <span className="text-slate-800">استاد اصلی: {s.teacherName}</span>
                              )}
                              {s.status === 'held_substitute' && (
                                <span className="text-amber-900 font-black">
                                  استاد جایگزین: {s.substituteTeacherName}
                                </span>
                              )}
                              {s.status === 'cancelled_class' && (
                                <span className="text-rose-700">علت لغو: {s.cancelReason}</span>
                              )}
                              {s.status === 'official_holiday' && (
                                <span className="text-slate-500">مناسبت/علت: {s.holidayReason}</span>
                              )}
                              {s.status === 'upcoming' && (
                                <span className="text-slate-500">استاد: {s.teacherName}</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {s.hasAttendanceLog && (s.status === 'held_main' || s.status === 'held_substitute') ? (
                                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold">
                                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    حاضر: {toPersianDigits(s.presentCount)}
                                  </span>
                                  {s.lateCount > 0 && (
                                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                      تاخیر: {toPersianDigits(s.lateCount)}
                                    </span>
                                  )}
                                  {s.absentCount > 0 && (
                                    <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                      غایب: {toPersianDigits(s.absentCount)}
                                    </span>
                                  )}
                                </div>
                              ) : s.status === 'held_main' ? (
                                <span className="text-[11px] text-emerald-700 font-bold">
                                  دایر طبق تقویم آموزشی
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs font-bold text-slate-600">
                مجموع جلسات برگزار شده:{' '}
                <strong className="text-emerald-700 font-black">
                  {toPersianDigits(selectedClassSummary.totalHeldCount)} جلسه
                </strong>{' '}
                ({toPersianDigits(selectedClassSummary.heldMainCount)} اصلی +{' '}
                {toPersianDigits(selectedClassSummary.heldSubCount)} جایگزین)
              </div>
              <button
                type="button"
                onClick={() => setSelectedClassSummary(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition-all cursor-pointer"
              >
                بستن پنجره
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
