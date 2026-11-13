import React, { useMemo, useState } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  FileText,
  CalendarDays,
  Clock,
  MapPin,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AcademicCalendarPeriod,
  AcademicHolidayItem,
  AcademicHolidayType,
  AcademicSubPeriod,
  AcademicWeeklyProgram,
  ThursdayMode
} from '../../../types';
import {
  getTodayShamsi,
  parseShamsiDate,
  generateShamsiDateRange,
  getShamsiDayOfWeekName,
  toPersianDigits
} from '../../../lib/jalali';
import { cn } from '../../../lib/utils';
import {
  GlyphCalendarTimeline,
  GlyphStudyBook,
  GlyphAttendanceCheck,
  GlyphReportCard
} from './StudentMobileIcons';

export interface MobileCalendarDayDetail {
  dateStr: string;
  dayOfWeek: number;
  dayName: string;
  isThu: boolean;
  isFri: boolean;
  isHoliday: boolean;
  isSubPeriod: boolean;
  isStudyDay: boolean;
  isSpecialAcademicDay: boolean;
  isWeekend: boolean;
  thursdayMode?: ThursdayMode;
  thursdayTitle?: string;
  holidayInfo?: { holiday: AcademicHolidayItem; type: AcademicHolidayType | undefined };
  subPeriodInfo?: AcademicSubPeriod;
}

export interface MobileCalendarMonthGroup {
  key: string;
  year: number;
  month: number;
  monthName: string;
  title: string;
  days: MobileCalendarDayDetail[];
}

export interface MobileWeeklyProgramStats {
  wp: AcademicWeeklyProgram;
  totalPotentialSessions: number;
  cancelledSessionsCount: number;
  heldSessionsCount: number;
  heldRate: number;
  sessionsList: Array<{
    sessionIndex: number;
    dateStr: string;
    dayName: string;
    isCancelled: boolean;
    cancellationReason: string;
  }>;
}

interface StudentMobileCalendarProps {
  periods: AcademicCalendarPeriod[];
  selectedPeriodId: string;
  onSelectPeriod: (periodId: string) => void;
  selectedPeriod: AcademicCalendarPeriod | null;
  periodDateList: string[];
  periodMonthsGrouped: MobileCalendarMonthGroup[];
  selectedMonthIndex: number;
  onSelectMonthIndex: (idx: number) => void;
  dateAnalysis: {
    totalDays: number;
    studyDays: number;
    specialAcademicDays: number;
    totalAcademicPresenceDays: number;
    weekendDays: number;
    holidayDaysCount: number;
    thursdayTotalCount: number;
    thursdaySpecialCount: number;
    thursdayMainClassCount: number;
    thursdayOffCount: number;
    thursdayHolidayCount: number;
  };
  periodHolidays: AcademicHolidayItem[];
  holidayTypes: AcademicHolidayType[];
  periodSubPeriods: AcademicSubPeriod[];
  periodWeeklyPrograms: AcademicWeeklyProgram[];
  getWeeklyProgramStats: (wp: AcademicWeeklyProgram) => MobileWeeklyProgramStats;
  dateWeeklyProgramMap: Map<string, AcademicWeeklyProgram[]>;
  userAssignedGrade: string | null;
  isStudentUser: boolean;
  isCalendarEditor: boolean;
  onSelectDay: (dayItem: MobileCalendarDayDetail) => void;
  onOpenPdfPreview: () => void;
  onExportBackup?: () => void;
}

type MobileCalendarTab = 'calendar' | 'holidays' | 'sub_periods' | 'weekly';

const SHORT_WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

export const StudentMobileCalendar: React.FC<StudentMobileCalendarProps> = ({
  periods,
  selectedPeriodId,
  onSelectPeriod,
  selectedPeriod,
  periodDateList,
  periodMonthsGrouped,
  selectedMonthIndex,
  onSelectMonthIndex,
  dateAnalysis,
  periodHolidays,
  holidayTypes,
  periodSubPeriods,
  periodWeeklyPrograms,
  getWeeklyProgramStats,
  dateWeeklyProgramMap,
  userAssignedGrade,
  isStudentUser,
  isCalendarEditor,
  onSelectDay,
  onOpenPdfPreview,
  onExportBackup
}) => {
  const [mobileTab, setMobileTab] = useState<MobileCalendarTab>('calendar');
  const [holidayFilterType, setHolidayFilterType] = useState<string>('all');
  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null);

  const todayStr = getTodayShamsi();

  const progressPercent = useMemo(() => {
    if (!selectedPeriod || periodDateList.length === 0) return 0;
    const idx = periodDateList.indexOf(todayStr);
    if (idx >= 0) {
      return Math.round(((idx + 1) / periodDateList.length) * 100);
    }
    return todayStr > selectedPeriod.endDate ? 100 : 0;
  }, [selectedPeriod, periodDateList, todayStr]);

  const activeMonth = periodMonthsGrouped[selectedMonthIndex] || null;

  const todayMonthIndex = useMemo(() => {
    return periodMonthsGrouped.findIndex((m) => m.days.some((d) => d.dateStr === todayStr));
  }, [periodMonthsGrouped, todayStr]);

  const activeMonthEvents = useMemo(() => {
    if (!activeMonth) return [];
    const seenKeys = new Set<string>();
    const list: Array<{
      id: string;
      kind: 'holiday' | 'sub_period' | 'thursday_special' | 'thursday_main';
      title: string;
      subtitle: string;
      dateRange: string;
      description?: string;
      dayItem: MobileCalendarDayDetail;
    }> = [];

    for (const day of activeMonth.days) {
      if (day.isHoliday && day.holidayInfo) {
        const h = day.holidayInfo.holiday;
        const key = `hol-${h.id}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          list.push({
            id: key,
            kind: 'holiday',
            title: h.title,
            subtitle: h.typeName || 'تعطیلی رسمی',
            dateRange: h.endDate && h.endDate !== h.startDate ? `${h.startDate} تا ${h.endDate}` : h.startDate,
            description: h.description,
            dayItem: day
          });
        }
      } else if (day.isSubPeriod && day.subPeriodInfo) {
        const sp = day.subPeriodInfo;
        const key = `sp-${sp.id}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          list.push({
            id: key,
            kind: 'sub_period',
            title: sp.title,
            subtitle: sp.isStandardClassDay ? 'تدریس عادی + برنامه ویژه' : 'حضور تحصیلی (غیردرسی)',
            dateRange: sp.endDate && sp.endDate !== sp.startDate ? `${sp.startDate} تا ${sp.endDate}` : sp.startDate,
            description: sp.description,
            dayItem: day
          });
        }
      } else if (day.isThu && (day.thursdayMode === 'special_program' || day.thursdayMode === 'main_class')) {
        list.push({
          id: `thu-${day.dateStr}`,
          kind: day.thursdayMode === 'main_class' ? 'thursday_main' : 'thursday_special',
          title: day.thursdayTitle || (day.thursdayMode === 'main_class' ? 'پنج‌شنبه کلاس درسی' : 'برنامه ویژه پنج‌شنبه'),
          subtitle: day.dayName,
          dateRange: day.dateStr,
          dayItem: day
        });
      }
    }
    return list;
  }, [activeMonth]);

  const filteredHolidays = useMemo(() => {
    if (holidayFilterType === 'all') return periodHolidays;
    return periodHolidays.filter((h) => h.typeId === holidayFilterType || h.typeName === holidayFilterType);
  }, [periodHolidays, holidayFilterType]);

  return (
    <div className="space-y-4 pb-6" dir="rtl">
      {/* 1. Mobile Hero Header Card */}
      <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4 text-white shadow-xl border border-indigo-400/20">
        <div
          className="pointer-events-none absolute -top-12 -left-10 w-44 h-44 rounded-full blur-2xl opacity-35"
          style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.55) 0%, rgba(99,102,241,0) 70%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-14 -right-10 w-44 h-44 rounded-full blur-2xl opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.5) 0%, rgba(16,185,129,0) 70%)' }}
        />

        <div className="relative z-10 space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 text-sky-300 shadow-inner">
                <GlyphCalendarTimeline size={23} active />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-sky-300/90 block">
                  {userAssignedGrade ? `سالنامه اختصاصی ${userAssignedGrade}` : 'سالنامه آموزشی و تعطیلات'}
                </span>
                <h1 className="text-base font-black text-white truncate">تقویم آموزشی دوره</h1>
              </div>
            </div>

            {/* PDF Export Button - Always available for students */}
            <button
              type="button"
              onClick={onOpenPdfPreview}
              className="min-h-[42px] px-3 py-2 rounded-2xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white text-[11px] font-black flex items-center gap-1.5 shadow-lg shadow-rose-950/40 border border-rose-300/30 transition-transform shrink-0"
            >
              <FileText size={15} />
              <span>خروجی PDF</span>
            </button>
          </div>

          {/* Period Switcher */}
          {periods.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-2xl px-3 py-1.5">
                <CalendarDays size={15} className="text-indigo-300 shrink-0" />
                <select
                  value={selectedPeriodId}
                  onChange={(e) => {
                    onSelectPeriod(e.target.value);
                    onSelectMonthIndex(0);
                  }}
                  aria-label="انتخاب دوره تحصیلی"
                  className="w-full min-h-[36px] bg-transparent text-white text-xs font-bold focus:outline-none"
                >
                  {periods.map((p) => (
                    <option key={p.id} value={p.id} className="text-slate-900 bg-white">
                      {p.title} ({toPersianDigits(p.startDate)} تا {toPersianDigits(p.endDate)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Period Timeline Bar */}
          {selectedPeriod && (
            <div className="pt-2 border-t border-white/10 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-indigo-200 font-bold">
                <span>
                  {toPersianDigits(selectedPeriod.startDate)} تا {toPersianDigits(selectedPeriod.endDate)}
                </span>
                <span className="text-amber-300 font-black tabular-nums">
                  {toPersianDigits(progressPercent)}٪ سپری شده
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-emerald-400 via-sky-400 to-indigo-400 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Strictly hide backup buttons from students */}
          {!isStudentUser && isCalendarEditor && onExportBackup && (
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={onExportBackup}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1.5 border border-emerald-400/30"
              >
                <Download size={14} />
                <span>پشتیبان JSON</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. 4 Key Summary KPI Cards (2x2 Grid) */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-white p-3.5 border border-indigo-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 block">کل ایام حضور</span>
            <span className="text-lg font-black text-indigo-700 tabular-nums">
              {toPersianDigits(dateAnalysis.totalAcademicPresenceDays)}
            </span>
            <span className="text-[10px] font-bold text-slate-400 mr-1">روز</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <GlyphAttendanceCheck size={19} active />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-3.5 border border-emerald-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 block">روز درسی کتاب</span>
            <span className="text-lg font-black text-emerald-700 tabular-nums">
              {toPersianDigits(dateAnalysis.studyDays)}
            </span>
            <span className="text-[10px] font-bold text-slate-400 mr-1">روز</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <GlyphStudyBook size={19} active />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-3.5 border border-violet-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 block">دوره‌ها و ۵شنبه ویژه</span>
            <span className="text-lg font-black text-violet-700 tabular-nums">
              {toPersianDigits(dateAnalysis.specialAcademicDays)}
            </span>
            <span className="text-[10px] font-bold text-slate-400 mr-1">روز</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
            <Sparkles size={18} />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-3.5 border border-rose-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 block">تعطیلات رسمی/مناسبتی</span>
            <span className="text-lg font-black text-rose-700 tabular-nums">
              {toPersianDigits(dateAnalysis.holidayDaysCount)}
            </span>
            <span className="text-[10px] font-bold text-slate-400 mr-1">روز</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <GlyphReportCard size={19} />
          </div>
        </div>
      </div>

      {/* 3. Segmented Navigation Bar */}
      <div className="grid grid-cols-4 gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80">
        {[
          { id: 'calendar', label: 'ماهنامه' },
          { id: 'holidays', label: `تعطیلات (${toPersianDigits(periodHolidays.length)})` },
          { id: 'sub_periods', label: 'دوره‌ها' },
          { id: 'weekly', label: 'برنامه‌ها' }
        ].map((tab) => {
          const isActive = mobileTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMobileTab(tab.id as MobileCalendarTab)}
              className={cn(
                'min-h-[42px] px-1.5 py-2 rounded-xl text-[11px] font-black transition-all active:scale-95 text-center',
                isActive
                  ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100'
                  : 'text-slate-600 hover:text-slate-800'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 4. Tab Content */}
      <AnimatePresence mode="wait">
        {mobileTab === 'calendar' && (
          <motion.div
            key="mob-cal-grid"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {activeMonth ? (
              <div className="bg-white rounded-[26px] border border-slate-200 shadow-sm p-3.5 space-y-3.5">
                {/* Month Switcher */}
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={selectedMonthIndex <= 0}
                    onClick={() => onSelectMonthIndex(Math.max(0, selectedMonthIndex - 1))}
                    aria-label="ماه قبل"
                    className="w-11 h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 disabled:opacity-35 flex items-center justify-center text-slate-700 active:scale-95 transition-all"
                  >
                    <ChevronRight size={20} />
                  </button>

                  <div className="text-center">
                    <h2 className="text-base font-black text-slate-800">
                      {toPersianDigits(activeMonth.title)}
                    </h2>
                    <span className="text-[10px] font-bold text-slate-400">
                      برای جزئیات، روی هر روز لمس کنید
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={selectedMonthIndex >= periodMonthsGrouped.length - 1}
                    onClick={() =>
                      onSelectMonthIndex(Math.min(periodMonthsGrouped.length - 1, selectedMonthIndex + 1))
                    }
                    aria-label="ماه بعد"
                    className="w-11 h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 disabled:opacity-35 flex items-center justify-center text-slate-700 active:scale-95 transition-all"
                  >
                    <ChevronLeft size={20} />
                  </button>
                </div>

                {/* Jump to Today chip if needed */}
                {todayMonthIndex >= 0 && todayMonthIndex !== selectedMonthIndex && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => onSelectMonthIndex(todayMonthIndex)}
                      className="min-h-[36px] px-3.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-black active:scale-95"
                    >
                      پرش به ماه جاری ({toPersianDigits(todayStr)})
                    </button>
                  </div>
                )}

                {/* Compact Legend */}
                <div className="flex items-center justify-between flex-wrap gap-2 px-2 py-2 bg-slate-50 rounded-2xl text-[10px] font-bold text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>درسی</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-violet-600" />
                    <span>دوره ویژه</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span>۵شنبه ویژه</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span>تعطیل</span>
                  </div>
                </div>

                {/* Weekday Headers */}
                <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-black text-slate-500">
                  {SHORT_WEEKDAYS.map((wd, idx) => (
                    <div
                      key={wd}
                      className={cn(
                        'py-1',
                        idx === 6 ? 'text-rose-600' : idx === 5 ? 'text-amber-600' : 'text-slate-600'
                      )}
                    >
                      {wd}
                    </div>
                  ))}
                </div>

                {/* Touch-Friendly 7-Col Grid */}
                <div className="grid grid-cols-7 gap-1.5">
                  {(() => {
                    const firstDay = activeMonth.days[0];
                    const offset = firstDay ? firstDay.dayOfWeek : 0;
                    return Array.from({ length: offset }).map((_, i) => (
                      <div key={`mob-empty-${i}`} className="min-h-[50px] rounded-2xl bg-slate-50/50" />
                    ));
                  })()}

                  {activeMonth.days.map((dayItem) => {
                    const dayParts = parseShamsiDate(dayItem.dateStr);
                    const isToday = dayItem.dateStr === todayStr;
                    const isThuSpecial =
                      dayItem.isThu &&
                      dayItem.thursdayMode === 'special_program' &&
                      !dayItem.isHoliday &&
                      !dayItem.isSubPeriod;
                    const hasWeeklyProg = (dateWeeklyProgramMap.get(dayItem.dateStr)?.length || 0) > 0;

                    let tileStyle = 'bg-emerald-50/60 border-emerald-200/80 text-emerald-900';
                    let dotColor = 'bg-emerald-500';

                    if (dayItem.isHoliday) {
                      tileStyle = 'bg-rose-50 border-rose-300 text-rose-800 shadow-2xs';
                      dotColor = 'bg-rose-500';
                    } else if (dayItem.isSubPeriod) {
                      tileStyle = 'bg-violet-50 border-violet-300 text-violet-900 shadow-2xs';
                      dotColor = 'bg-violet-600';
                    } else if (isThuSpecial) {
                      tileStyle = 'bg-amber-50 border-amber-300 text-amber-900';
                      dotColor = 'bg-amber-500';
                    } else if (dayItem.isWeekend) {
                      tileStyle = 'bg-slate-100/80 border-slate-200 text-slate-500';
                      dotColor = 'bg-slate-300';
                    }

                    return (
                      <button
                        key={dayItem.dateStr}
                        type="button"
                        onClick={() => onSelectDay(dayItem)}
                        className={cn(
                          'min-h-[50px] rounded-2xl border flex flex-col items-center justify-center gap-1 p-1 transition-transform active:scale-90 relative',
                          tileStyle,
                          isToday && 'ring-2 ring-indigo-600 ring-offset-1 font-black'
                        )}
                      >
                        <span className="text-[13px] font-black tabular-nums leading-none">
                          {toPersianDigits(dayParts.day)}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <span className={cn('w-1.5 h-1.5 rounded-full', dotColor)} />
                          {hasWeeklyProg && !dayItem.isHoliday && (
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          )}
                        </div>
                        {isToday && (
                          <span className="absolute -top-1 left-1/2 -translate-x-1/2 px-1 bg-indigo-600 text-white text-[8px] font-black rounded-md leading-tight">
                            امروز
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-8 text-center text-slate-400 text-xs font-bold border border-slate-200">
                دوره‌ای برای نمایش در تقویم انتخاب نشده است.
              </div>
            )}

            {/* Events & Holidays inside Selected Month */}
            {activeMonth && (
              <div className="bg-white rounded-[26px] border border-slate-200 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <Info size={16} className="text-indigo-600" />
                    <span>مناسبت‌ها و برنامه‌های {toPersianDigits(activeMonth.monthName)}</span>
                  </h3>
                  <span className="text-[11px] font-black text-indigo-700 tabular-nums">
                    {toPersianDigits(activeMonthEvents.length)} مورد
                  </span>
                </div>

                {activeMonthEvents.length === 0 ? (
                  <p className="text-xs text-slate-500 font-medium bg-slate-50 p-3.5 rounded-2xl text-center">
                    در این ماه تعطیلی مناسبتی یا دوره ویژه ثبت نشده است و کلاس‌ها طبق روال عادی برگزار می‌شوند.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {activeMonthEvents.map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => onSelectDay(ev.dayItem)}
                        className={cn(
                          'w-full text-right p-3.5 rounded-2xl border transition-transform active:scale-[0.98] space-y-1',
                          ev.kind === 'holiday'
                            ? 'bg-rose-50/70 border-rose-200'
                            : ev.kind === 'sub_period'
                            ? 'bg-violet-50/70 border-violet-200'
                            : ev.kind === 'thursday_main'
                            ? 'bg-emerald-50/70 border-emerald-200'
                            : 'bg-amber-50/70 border-amber-200'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-slate-900">{ev.title}</span>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0',
                              ev.kind === 'holiday'
                                ? 'bg-rose-600 text-white'
                                : ev.kind === 'sub_period'
                                ? 'bg-violet-600 text-white'
                                : ev.kind === 'thursday_main'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-amber-500 text-white'
                            )}
                          >
                            {ev.subtitle}
                          </span>
                        </div>
                        <div className="text-[11px] font-bold text-slate-600 tabular-nums">
                          تاریخ: {toPersianDigits(ev.dateRange)}
                        </div>
                        {ev.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-2">{ev.description}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {mobileTab === 'holidays' && (
          <motion.div
            key="mob-cal-holidays"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {/* PDF Banner CTA */}
            <div className="bg-gradient-to-l from-rose-50 to-white border border-rose-200 rounded-2xl p-3.5 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h3 className="text-xs font-black text-rose-950">دریافت جدول رسمی تعطیلات (PDF)</h3>
                <p className="text-[11px] text-rose-700/80">
                  فهرست کامل تعطیلات دوره را در قالب فایل PDF دریافت کنید.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenPdfPreview}
                className="min-h-[42px] px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 active:scale-95"
              >
                <FileText size={15} />
                <span>پیش‌نمایش PDF</span>
              </button>
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setHolidayFilterType('all')}
                className={cn(
                  'min-h-[38px] px-3 py-1.5 rounded-xl text-[11px] font-black shrink-0 border transition-colors',
                  holidayFilterType === 'all'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200'
                )}
              >
                همه ({toPersianDigits(periodHolidays.length)})
              </button>
              {holidayTypes.map((t) => {
                const count = periodHolidays.filter((h) => h.typeId === t.id || h.typeName === t.name).length;
                if (count === 0) return null;
                const active = holidayFilterType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setHolidayFilterType(t.id)}
                    className={cn(
                      'min-h-[38px] px-3 py-1.5 rounded-xl text-[11px] font-black shrink-0 border transition-colors',
                      active
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-600 border-slate-200'
                    )}
                  >
                    {t.name} ({toPersianDigits(count)})
                  </button>
                );
              })}
            </div>

            {/* Holidays Cards */}
            {filteredHolidays.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 text-xs font-bold text-slate-400">
                موردی برای نمایش یافت نشد.
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredHolidays.map((h) => {
                  const daysCount = generateShamsiDateRange(h.startDate, h.endDate || h.startDate).length;
                  return (
                    <div
                      key={h.id}
                      className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-black text-slate-800">{h.title}</h4>
                        <span className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black shrink-0">
                          {h.typeName}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-xl tabular-nums">
                        <span>
                          {h.endDate && h.endDate !== h.startDate
                            ? `${toPersianDigits(h.startDate)} الی ${toPersianDigits(h.endDate)}`
                            : `${getShamsiDayOfWeekName(h.startDate)} ${toPersianDigits(h.startDate)}`}
                        </span>
                        <span className="text-indigo-700 font-black">{toPersianDigits(daysCount)} روز</span>
                      </div>
                      {h.description && <p className="text-[11px] text-slate-500 leading-relaxed">{h.description}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {mobileTab === 'sub_periods' && (
          <motion.div
            key="mob-cal-subperiods"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {periodSubPeriods.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 text-xs font-bold text-slate-400">
                دوره ویژه (مانند هفته پژوهش یا کارگاه‌های خاص) در این بازه ثبت نشده است.
              </div>
            ) : (
              periodSubPeriods.map((sp) => {
                const daysCount = generateShamsiDateRange(sp.startDate, sp.endDate || sp.startDate).length;
                return (
                  <div
                    key={sp.id}
                    className="bg-white rounded-3xl border border-violet-200 p-4 shadow-xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-violet-600 block">
                          {sp.isPublic !== false
                            ? 'عمومی (تمامی پایه‌ها)'
                            : sp.targetGrades?.join('، ') || sp.grade || 'مخصوص پایه'}
                        </span>
                        <h3 className="text-sm font-black text-slate-900">{sp.title}</h3>
                      </div>
                      <span className="px-2.5 py-1 rounded-xl bg-violet-100 text-violet-800 text-[11px] font-black tabular-nums shrink-0">
                        {toPersianDigits(daysCount)} روز
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-bold bg-violet-50/70 text-violet-950 px-3 py-2 rounded-xl tabular-nums">
                      <span>
                        {toPersianDigits(sp.startDate)} تا {toPersianDigits(sp.endDate || sp.startDate)}
                      </span>
                      <span className="flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 size={13} />
                        {sp.isStandardClassDay ? 'کلاس عادی' : 'حضور غیردرسی'}
                      </span>
                    </div>

                    {sp.description && (
                      <p className="text-xs text-slate-600 leading-relaxed">{sp.description}</p>
                    )}
                  </div>
                );
              })
            )}
          </motion.div>
        )}

        {mobileTab === 'weekly' && (
          <motion.div
            key="mob-cal-weekly"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {/* Thursday Policy Summary Card */}
            {selectedPeriod && (
              <div className="bg-amber-50/80 border border-amber-200 rounded-3xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-950">وضعیت عمومی پنج‌شنبه‌ها در دوره</span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-amber-600 text-white text-[10px] font-black">
                    {selectedPeriod.defaultThursdayMode === 'main_class' || selectedPeriod.includeThursdayAsStudyDay
                      ? 'روز درسی کتاب'
                      : selectedPeriod.defaultThursdayMode === 'special_program'
                      ? 'برنامه ویژه هفتگی'
                      : 'تعطیل آخر هفته'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-bold pt-1">
                  <div className="bg-white/80 rounded-xl p-2 border border-amber-100">
                    <span className="text-slate-500 block text-[10px]">کل ۵شنبه‌ها</span>
                    <span className="text-slate-900 font-black tabular-nums">
                      {toPersianDigits(dateAnalysis.thursdayTotalCount)}
                    </span>
                  </div>
                  <div className="bg-white/80 rounded-xl p-2 border border-amber-100">
                    <span className="text-amber-700 block text-[10px]">برنامه ویژه</span>
                    <span className="text-amber-800 font-black tabular-nums">
                      {toPersianDigits(dateAnalysis.thursdaySpecialCount)}
                    </span>
                  </div>
                  <div className="bg-white/80 rounded-xl p-2 border border-amber-100">
                    <span className="text-emerald-700 block text-[10px]">درس اصلی</span>
                    <span className="text-emerald-800 font-black tabular-nums">
                      {toPersianDigits(dateAnalysis.thursdayMainClassCount)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Weekly Programs */}
            {periodWeeklyPrograms.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 text-xs font-bold text-slate-400">
                برنامه هفتگی یا کارگاه مهارتی برای این دوره ثبت نشده است.
              </div>
            ) : (
              periodWeeklyPrograms.map((wp) => {
                const stats = getWeeklyProgramStats(wp);
                const isExpanded = expandedProgramId === wp.id;
                return (
                  <div
                    key={wp.id}
                    className="bg-white rounded-3xl border border-slate-200 p-4 shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-800 text-[10px] font-black">
                            {wp.dayOfWeek}ها
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold">
                            {wp.isPublic !== false
                              ? 'عمومی'
                              : wp.targetGrades?.join('، ') || wp.grade || 'اختصاصی'}
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-slate-900">{wp.title}</h4>
                      </div>
                      <span className="text-xs font-black text-purple-700 tabular-nums shrink-0">
                        ٪{toPersianDigits(stats.heldRate)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-600 bg-slate-50 p-2.5 rounded-2xl">
                      <div className="flex items-center gap-1.5">
                        <Clock size={13} className="text-indigo-500 shrink-0" />
                        <span className="truncate">{wp.time || 'زمان نامشخص'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin size={13} className="text-purple-500 shrink-0" />
                        <span className="truncate">{wp.locationOrTeacher || 'عمومی'}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 tabular-nums">
                        <span>جلسات برگزارشده: {toPersianDigits(stats.heldSessionsCount)} از {toPersianDigits(stats.totalPotentialSessions)}</span>
                        <span className="text-rose-600">لغو: {toPersianDigits(stats.cancelledSessionsCount)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${stats.heldRate}%` }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedProgramId(isExpanded ? null : wp.id)}
                      className="w-full min-h-[40px] rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-black flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>{isExpanded ? 'بستن تقویم جلسات' : 'مشاهده تاریخ جلسات'}</span>
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>

                    {isExpanded && (
                      <div className="max-h-56 overflow-y-auto space-y-1.5 pt-1 border-t border-slate-100">
                        {stats.sessionsList.map((sess) => (
                          <div
                            key={sess.dateStr}
                            className={cn(
                              'flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-bold',
                              sess.isCancelled ? 'bg-rose-50 text-rose-800' : 'bg-slate-50 text-slate-700'
                            )}
                          >
                            <span className="tabular-nums">
                              جلسه {toPersianDigits(sess.sessionIndex)} — {sess.dayName} {toPersianDigits(sess.dateStr)}
                            </span>
                            <span className="text-[10px] font-black">
                              {sess.isCancelled ? 'تعطیل / لغو' : 'برگزار می‌شود'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
