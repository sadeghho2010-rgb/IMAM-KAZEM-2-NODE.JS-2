import React, { useState, useMemo } from 'react';
import { 
  Clock, 
  Receipt, 
  HeartHandshake, 
  Car, 
  UtensilsCrossed, 
  TrendingUp, 
  SlidersHorizontal,
  Search,
  Trash2,
  Printer,
  FileSpreadsheet,
  FileText,
  UserPlus,
  Save,
  CheckCircle2,
  Building2,
  Calendar,
  AlertCircle,
  Eye,
  Info,
  Layers,
  ChevronDown,
  ChevronUp,
  Settings,
  Plus,
  BookOpen,
  Sparkles
} from 'lucide-react';
import { 
  TeacherCompensationCalculationItem, 
  TeacherCompensationSettings, 
  FinanceDestinationAccount,
  TeacherCoursePresenceItem
} from '../../../types';
import { cn } from '../../../lib/utils';

export type CompensationTabType = 
  | 'presence_hours'
  | 'debts'
  | 'fund_contribution'
  | 'transport'
  | 'meals'
  | 'adjustments'
  | 'summary';

interface TeacherCompensationTabbedViewProps {
  items: TeacherCompensationCalculationItem[];
  onUpdateItemValue: (id: string, field: keyof TeacherCompensationCalculationItem, value: any) => void;
  onRemoveItem: (id: string) => void;
  onOpenAddTeacherModal: () => void;
  periodTitle: string;
  startDate: string;
  endDate: string;
  settings: TeacherCompensationSettings;
  destinationAccounts: FinanceDestinationAccount[];
  onExportDetailedExcel: (items: TeacherCompensationCalculationItem[], title: string) => void;
  onExportSuperiorsExcel: (items: TeacherCompensationCalculationItem[], title: string) => void;
  onSaveToArchive: (status: 'draft' | 'finalized') => void;
  onOpenSlipDetail: (item: TeacherCompensationCalculationItem) => void;
  isCompactView: boolean;
  setIsCompactView: (val: boolean) => void;
  onOpenSettingsModal?: () => void;
  onUpdateTeacherCourse?: (teacherId: string, courseId: string, field: keyof TeacherCoursePresenceItem, value: any) => void;
  onAddTeacherCourse?: (teacherId: string) => void;
  onRemoveTeacherCourse?: (teacherId: string, courseId: string) => void;
}

export const TeacherCompensationTabbedView: React.FC<TeacherCompensationTabbedViewProps> = ({
  items,
  onUpdateItemValue,
  onRemoveItem,
  onOpenAddTeacherModal,
  periodTitle,
  startDate,
  endDate,
  settings,
  destinationAccounts,
  onExportDetailedExcel,
  onExportSuperiorsExcel,
  onSaveToArchive,
  onOpenSlipDetail,
  isCompactView,
  setIsCompactView,
  onOpenSettingsModal,
  onUpdateTeacherCourse,
  onAddTeacherCourse,
  onRemoveTeacherCourse
}) => {
  const [activeTab, setActiveTab] = useState<CompensationTabType>('presence_hours');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTeacherIds, setExpandedTeacherIds] = useState<string[]>([]);

  const toggleExpandTeacher = (teacherId: string) => {
    setExpandedTeacherIds(prev => 
      prev.includes(teacherId) ? prev.filter(id => id !== teacherId) : [...prev, teacherId]
    );
  };

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.trim().toLowerCase();
    return items.filter(item => 
      (item.teacherName || '').toLowerCase().includes(q) ||
      (item.nationalId || '').includes(q) ||
      (item.coursesStr || '').toLowerCase().includes(q) ||
      (item.phone || '').includes(q)
    );
  }, [items, searchQuery]);

  // Comprehensive summary totals across all items
  const summaryTotals = useMemo(() => {
    const totalTeachers = items.length;
    const totalScheduledClasses = items.reduce((s, i) => s + (i.calendarScheduledClassesCount || 0), 0);
    const totalCancelledClasses = items.reduce((s, i) => s + (i.cancelledDaysCount || 0), 0);
    const totalSubSessions = items.reduce((s, i) => s + (i.substituteTeachingSessions || 0), 0);
    const totalOvertime = items.reduce((s, i) => s + (i.overtimeHours || 0), 0);
    const totalHours = items.reduce((s, i) => s + (i.totalTeachingHours || 0), 0);
    const totalGross = items.reduce((s, i) => s + (i.baseGrossAmount || 0), 0);

    const totalDebts = items.reduce((s, i) => s + (i.debtTotalAmount || 0), 0);
    const totalDebtDeductions = items.reduce((s, i) => s + (i.debtMonthlyDeduction || i.type2DeductionsTotal || 0), 0);

    const totalFundRequests = items.reduce((s, i) => s + (i.fundContributionRequested || 0), 0);
    const totalFundDeductions = items.reduce((s, i) => s + (i.fundContributionDeduction || 0), 0);

    const totalTransportTrips = items.reduce((s, i) => s + (i.transportTripsCount || 0), 0);
    const totalTransportDeductions = items.reduce((s, i) => s + (i.transportDeduction || 0), 0);

    const totalLunch = items.reduce((s, i) => s + (i.lunchCount || 0), 0);
    const totalDinner = items.reduce((s, i) => s + (i.dinnerCount || 0), 0);
    const totalMeals = totalLunch + totalDinner;
    const totalMealDeductions = items.reduce((s, i) => s + (i.mealsDeductionTotal || i.lunchDeduction || 0), 0);

    const totalAdditions = items.reduce((s, i) => s + (i.manualAdditionAmount || i.bonusAmount || 0), 0);
    const totalReductions = items.reduce((s, i) => s + (i.manualReductionAmount || 0), 0);
    const totalNetAdjustments = items.reduce((s, i) => s + (i.manualAdjustmentAmount || 0), 0);

    const totalNetPayable = items.reduce((s, i) => s + (i.netPayable || 0), 0);

    return {
      totalTeachers,
      totalScheduledClasses,
      totalCancelledClasses,
      totalSubSessions,
      totalOvertime,
      totalHours,
      totalGross,
      totalDebts,
      totalDebtDeductions,
      totalFundRequests,
      totalFundDeductions,
      totalTransportTrips,
      totalTransportDeductions,
      totalLunch,
      totalDinner,
      totalMeals,
      totalMealDeductions,
      totalAdditions,
      totalReductions,
      totalNetAdjustments,
      totalNetPayable
    };
  }, [items]);

  // Tab definitions matching the user's specific request
  const tabsList = [
    { 
      id: 'presence_hours' as const, 
      label: 'میزان ساعت حضور', 
      icon: Clock, 
      count: `${summaryTotals.totalHours} ساعت`,
      badgeColor: 'bg-teal-50 text-teal-700 border-teal-200'
    },
    { 
      id: 'debts' as const, 
      label: 'بدهی‌ها', 
      icon: Receipt, 
      count: `${summaryTotals.totalDebtDeductions.toLocaleString('fa-IR')} ت`,
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200'
    },
    { 
      id: 'fund_contribution' as const, 
      label: 'کمک به صندوق', 
      icon: HeartHandshake, 
      count: `${summaryTotals.totalFundDeductions.toLocaleString('fa-IR')} ت`,
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200'
    },
    { 
      id: 'transport' as const, 
      label: 'هزینه سرویس', 
      icon: Car, 
      count: `${summaryTotals.totalTransportTrips} نوبت`,
      badgeColor: 'bg-sky-50 text-sky-800 border-sky-200'
    },
    { 
      id: 'meals' as const, 
      label: 'نهار و شام', 
      icon: UtensilsCrossed, 
      count: `${summaryTotals.totalMeals} وعده`,
      badgeColor: 'bg-orange-50 text-orange-800 border-orange-200'
    },
    { 
      id: 'adjustments' as const, 
      label: 'اضافه / کاهش حقوق', 
      icon: TrendingUp, 
      count: summaryTotals.totalNetAdjustments !== 0 ? `${summaryTotals.totalNetAdjustments > 0 ? '+' : ''}${summaryTotals.totalNetAdjustments.toLocaleString('fa-IR')} ت` : 'بدون تعدیل',
      badgeColor: 'bg-purple-50 text-purple-800 border-purple-200'
    },
    { 
      id: 'summary' as const, 
      label: 'جمع‌بندی تمامی پارامترها', 
      icon: SlidersHorizontal, 
      count: `${summaryTotals.totalNetPayable.toLocaleString('fa-IR')} ت`,
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-300'
    }
  ];

  return (
    <div className="space-y-5">
      {/* Top Banner & Control Ribbon */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/85 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] px-3 py-1 rounded-xl bg-teal-50 text-teal-800 font-black border border-teal-200/80">
                جدول محاسبه چندسربرگه حق‌الزحمه
              </span>
              <h2 className="text-base font-black text-slate-800">{periodTitle}</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-medium">
              <span>بازه زمانی: <strong className="text-slate-800 font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded">{startDate}</strong> الی <strong className="text-slate-800 font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded">{endDate}</strong></span>
              <span className="text-slate-300">•</span>
              <span>نرخ ساعت تدریس: <strong className="text-teal-700 font-mono font-bold">{settings.hourlyTeachingRate.toLocaleString('fa-IR')}</strong> تومان</span>
              <span className="text-slate-300">•</span>
              <span>نرخ نهار: <strong className="text-rose-600 font-mono font-bold">{settings.lunchCostPerDay.toLocaleString('fa-IR')}</strong> تومان</span>
              <span className="text-slate-300">•</span>
              <span>نرخ سرویس: <strong className="text-sky-700 font-mono font-bold">{settings.transportCostPerTrip.toLocaleString('fa-IR')}</strong> تومان</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {onOpenSettingsModal && (
              <button
                onClick={onOpenSettingsModal}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 rounded-xl text-xs font-black transition-all border border-slate-200/90 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="تنظیم نرخ هر ساعت، تفکیک کلاس‌ها، سرویس، نهار، بدهی‌ها و صندوق"
              >
                <Settings size={15} className="text-slate-600" />
                <span>تنظیمات محاسبه</span>
              </button>
            )}

            <button
              onClick={onOpenAddTeacherModal}
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus size={15} />
              <span>افزودن استاد به جدول</span>
            </button>

            <button
              onClick={() => onExportDetailedExcel(items, periodTitle)}
              disabled={items.length === 0}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              title="خروجی اکسل تفصیلی با تمامی سربرگ‌ها و ستون‌ها برای امور داخلی"
            >
              <FileSpreadsheet size={15} className="text-emerald-600" />
              <span>اکسل تفصیلی داخلی (خودمان)</span>
            </button>

            <button
              onClick={() => onExportSuperiorsExcel(items, periodTitle)}
              disabled={items.length === 0}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              title="خروجی ویژه بالادستی شامل واریزی پایا اساتید و تفکیک حساب‌های مقصد کسورات"
            >
              <FileText size={15} className="text-indigo-600" />
              <span>گزارش بالادستی و حساب‌های مقصد</span>
            </button>

            <button
              onClick={() => onSaveToArchive('finalized')}
              disabled={items.length === 0}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Save size={15} />
              <span>ثبت نهایی و بایگانی</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 min-w-max">
          {tabsList.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                  isActive
                    ? "bg-teal-600 text-white border-teal-600 shadow-sm shadow-teal-100 font-black ring-2 ring-teal-600/20"
                    : "bg-slate-50/70 hover:bg-teal-50/50 text-slate-700 border-slate-200/80 hover:text-teal-900"
                )}
              >
                <Icon size={16} className={isActive ? "text-white" : "text-slate-500"} />
                <span>{tab.label}</span>
                <span className={cn(
                  "text-[10px] px-2 py-0.5 rounded-md font-mono font-bold border",
                  isActive ? "bg-white/20 text-white border-white/30" : tab.badgeColor
                )}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Search Ribbon */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/85 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجوی نام استاد، کد ملی، درس..."
            className="w-full pr-10 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all"
          />
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'summary' && (
            <button
              onClick={() => setIsCompactView(!isCompactView)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer",
                isCompactView 
                  ? "bg-teal-50 text-teal-800 border-teal-200" 
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              <Layers size={14} />
              <span>{isCompactView ? 'نمای تفصیلی' : 'نمای جمع‌وجور'}</span>
            </button>
          )}

          <div className="text-xs text-slate-500 font-medium">
            تعداد اساتید در جدول: <strong className="text-teal-700 font-bold font-mono">{filteredItems.length}</strong> نفر
          </div>
        </div>
      </div>

      {/* Empty State when no teachers in table */}
      {items.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner ring-4 ring-teal-50/50">
            <Clock size={32} />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h4 className="text-sm font-black text-slate-800">جدول محاسبه در این دوره خالی است</h4>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              جهت ورود اطلاعات کارکرد و اعمال کسورات، ابتدا اساتید مدنظر را انتخاب و به جدول اضافه فرمایید.
            </p>
          </div>
          <button
            onClick={onOpenAddTeacherModal}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-2xl text-xs font-black shadow-md shadow-emerald-100 transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <UserPlus size={16} />
            <span>افزودن اساتید جهت پرداخت</span>
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center text-slate-400 text-xs">
          استادی با مشخصات جستجو شده یافت نشد.
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/85 shadow-sm overflow-hidden">
          {/* ========================================================================= */}
          {/* TAB 1: میزان ساعت حضور (Presence Hours Tab)                                */}
          {/* ========================================================================= */}
          {activeTab === 'presence_hours' && (
            <div>
              <div className="p-3.5 bg-teal-50/50 border-b border-teal-100/70 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-teal-700" />
                  <span className="font-black text-slate-800">سربرگ میزان ساعت حضور و کارکرد تقویمی</span>
                  <span className="text-[11px] text-slate-500">
                    (آمار جلسات مقرر تقویم، تعطیل شده، جایگزین، اضافه کاری و مجموع کل ساعات تدریس)
                  </span>
                </div>
                <div className="text-[11px] text-teal-800 font-bold bg-white px-2.5 py-1 rounded-lg border border-teal-200/60 shadow-2xs">
                  تمامی ستون‌ها قابل ویرایش دستی و بازنگری هستند.
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-2 w-8 text-center">ردیف</th>
                      <th className="py-3 px-3">نام و مشخصات استاد</th>
                      <th className="py-3 px-2 text-center text-teal-800" title="تفکیک وضعیت و ساعات تک‌تک دروس استاد">
                        تفکیک دروس
                      </th>
                      <th className="py-3 px-2 text-center text-slate-800" title="میزان جلسات درسی که می‌توانسته کلاس‌های او برگزار بشه طبق تقویم آموزشی">
                        جلسات مقرر تقویم
                      </th>
                      <th className="py-3 px-2 text-center text-rose-700" title="تعداد جلساتی که کلاس به هر دلیل تعطیل شده">
                        جلسات تعطیل شده
                      </th>
                      <th className="py-3 px-2 text-center text-indigo-700" title="تعداد جلساتی که استاد جایگزین آمده">
                        جلسات استاد جایگزین
                      </th>
                      <th className="py-3 px-2 text-center text-emerald-700" title="ساعت اضافه تدریس (پیش‌فرض ۰ و قابل تغییر دستی)">
                        ساعت اضافه تدریس
                      </th>
                      <th className="py-3 px-2 text-center bg-teal-50/80 text-teal-950 font-black border-r border-teal-100">
                        مجموع نهایی ساعت حضور
                      </th>
                      <th className="py-3 px-2 text-center text-slate-600">نرخ ساعت (تومان)</th>
                      <th className="py-3 px-2 text-center text-emerald-800 font-black">ناخالص کارکرد</th>
                      <th className="py-3 px-2 w-14 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredItems.map((item, idx) => {
                      const isExpanded = expandedTeacherIds.includes(item.id);
                      const courses = item.courseBreakdown && item.courseBreakdown.length > 0 ? item.courseBreakdown : [];

                      return (
                        <React.Fragment key={item.id}>
                          <tr className={cn("transition-colors", isExpanded ? "bg-teal-50/30" : "hover:bg-teal-50/15")}>
                            <td className="py-2.5 px-2 text-center font-mono text-slate-400 font-bold text-[11px]">{idx + 1}</td>
                            <td className="py-2.5 px-3">
                              <div className="font-black text-slate-900 text-xs">{item.teacherName}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">{item.coursesStr || 'دروس فقه و اصول'}</div>
                            </td>

                            {/* دکمه باز و بسته کردن تفکیک دروس استاد */}
                            <td className="py-2.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => toggleExpandTeacher(item.id)}
                                className={cn(
                                  "px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 mx-auto cursor-pointer border shadow-2xs",
                                  isExpanded 
                                    ? "bg-teal-600 text-white border-teal-600" 
                                    : "bg-teal-50 hover:bg-teal-100 text-teal-800 border-teal-200"
                                )}
                                title="مشاهده و ویرایش تک‌تک دروس استاد"
                              >
                                <BookOpen size={13} />
                                <span>{courses.length > 0 ? `${courses.length} درس` : 'ثبت درس'}</span>
                                <ChevronDown size={13} className={cn("transition-transform duration-200", isExpanded && "rotate-180")} />
                              </button>
                            </td>

                            {/* جلسات مقرر تقویم */}
                            <td className="py-2.5 px-2 text-center">
                              <input
                                type="number"
                                min="0"
                                value={item.calendarScheduledClassesCount ?? item.totalCalendarDays ?? 0}
                                onChange={(e) => onUpdateItemValue(item.id, 'calendarScheduledClassesCount', Number(e.target.value))}
                                className="w-16 text-center py-1 bg-white border border-slate-200 rounded-lg font-mono font-bold text-xs focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none"
                              />
                            </td>

                            {/* جلسات تعطیل شده */}
                            <td className="py-2.5 px-2 text-center">
                              <input
                                type="number"
                                min="0"
                                value={item.cancelledDaysCount ?? 0}
                                onChange={(e) => onUpdateItemValue(item.id, 'cancelledDaysCount', Number(e.target.value))}
                                className="w-14 text-center py-1 bg-white border border-rose-200 text-rose-700 rounded-lg font-mono font-bold text-xs focus:ring-2 focus:ring-rose-100 focus:border-rose-500 outline-none"
                              />
                            </td>

                            {/* جلسات استاد جایگزین */}
                            <td className="py-2.5 px-2 text-center">
                              <input
                                type="number"
                                min="0"
                                value={item.substituteTeachingSessions ?? 0}
                                onChange={(e) => onUpdateItemValue(item.id, 'substituteTeachingSessions', Number(e.target.value))}
                                className="w-14 text-center py-1 bg-white border border-indigo-200 text-indigo-700 rounded-lg font-mono font-bold text-xs focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                              />
                            </td>

                            {/* ساعت اضافه */}
                            <td className="py-2.5 px-2 text-center">
                              <input
                                type="number"
                                min="0"
                                value={item.overtimeHours ?? 0}
                                onChange={(e) => onUpdateItemValue(item.id, 'overtimeHours', Number(e.target.value))}
                                className="w-14 text-center py-1 bg-white border border-emerald-300 text-emerald-800 rounded-lg font-mono font-bold text-xs focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none"
                              />
                            </td>

                            {/* مجموع نهایی ساعت حضور */}
                            <td className="py-2.5 px-2 text-center font-mono font-black text-teal-950 bg-teal-50/60 border-r border-teal-100">
                              <input
                                type="number"
                                min="0"
                                value={item.totalTeachingHours ?? 0}
                                onChange={(e) => onUpdateItemValue(item.id, 'totalTeachingHours', Number(e.target.value))}
                                className="w-16 text-center py-1 bg-white border border-teal-300 rounded-lg font-mono font-black text-teal-900 text-xs focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none"
                              />
                            </td>

                            {/* نرخ ساعت */}
                            <td className="py-2.5 px-2 text-center">
                              <input
                                type="number"
                                min="0"
                                value={item.hourlyRate ?? settings.hourlyTeachingRate}
                                onChange={(e) => onUpdateItemValue(item.id, 'hourlyRate', Number(e.target.value))}
                                className="w-20 text-center py-1 bg-white border border-slate-200 rounded-lg font-mono text-slate-700 text-xs focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none"
                              />
                            </td>

                            {/* ناخالص کارکرد */}
                            <td className="py-2.5 px-2 text-center font-mono font-black text-emerald-700">
                              {item.baseGrossAmount.toLocaleString('fa-IR')}
                            </td>

                            {/* عملیات */}
                            <td className="py-2.5 px-2 text-center">
                              <button
                                onClick={() => onRemoveItem(item.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                title="حذف استاد از دوره"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>

                          {/* بخش جزئیات و تفکیک تک تک دروس استاد */}
                          {isExpanded && (
                            <tr className="bg-teal-50/25 border-b-2 border-teal-200/90">
                              <td colSpan={11} className="p-3 sm:p-4">
                                <div className="bg-white rounded-2xl border border-teal-200 shadow-sm p-4 space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-100 pb-2.5">
                                    <div className="flex items-center gap-2">
                                      <BookOpen size={16} className="text-teal-700" />
                                      <span className="font-black text-slate-800 text-xs">
                                        وضعیت حضور، جلسات و کارکرد به تفکیک تک‌تک دروس استاد {item.teacherName}:
                                      </span>
                                      <span className="text-[11px] text-slate-500 font-medium">
                                        (تمامی مشخصات، تعداد جلسات و ساعات هر درس به صورت مجزا قابل ویرایش است)
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => onAddTeacherCourse?.(item.id)}
                                      className="px-3 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-teal-200/80 shadow-2xs"
                                    >
                                      <Plus size={13} />
                                      <span>+ افزودن درس جدید به این استاد</span>
                                    </button>
                                  </div>

                                  {courses.length === 0 ? (
                                    <div className="py-6 text-center text-slate-400 text-xs">
                                      درسی برای این استاد ثبت نشده است. روی «افزودن درس جدید به این استاد» کلیک کنید.
                                    </div>
                                  ) : (
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-right text-xs">
                                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                          <tr>
                                            <th className="py-2 px-2 w-8 text-center">#</th>
                                            <th className="py-2 px-3">عنوان درس</th>
                                            <th className="py-2 px-2 text-center">نوع کلاس</th>
                                            <th className="py-2 px-2 text-center">جلسات مقرر تقویم</th>
                                            <th className="py-2 px-2 text-center text-rose-700">جلسات تعطیل شده</th>
                                            <th className="py-2 px-2 text-center text-indigo-700">جلسات جایگزین</th>
                                            <th className="py-2 px-2 text-center text-teal-900 bg-teal-50 font-black">ساعت تدریس درس</th>
                                            <th className="py-2 px-2 text-center text-slate-700">نرخ مصوب ساعتی</th>
                                            <th className="py-2 px-2 text-center text-emerald-800 font-black">ناخالص حق‌الزحمه</th>
                                            <th className="py-2 px-2 w-12 text-center">حذف</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium">
                                          {courses.map((course, cIdx) => (
                                            <tr key={course.id || cIdx} className="hover:bg-slate-50/80">
                                              <td className="py-2 px-2 text-center font-mono text-slate-400 text-[11px]">{cIdx + 1}</td>
                                              <td className="py-2 px-3">
                                                <input
                                                  type="text"
                                                  value={course.courseTitle}
                                                  onChange={(e) => onUpdateTeacherCourse?.(item.id, course.id, 'courseTitle', e.target.value)}
                                                  className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-teal-500 focus:bg-white"
                                                  placeholder="عنوان درس..."
                                                />
                                              </td>
                                              <td className="py-2 px-2 text-center">
                                                <select
                                                  value={course.courseType || 'main'}
                                                  onChange={(e) => onUpdateTeacherCourse?.(item.id, course.id, 'courseType', e.target.value as any)}
                                                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold outline-none"
                                                >
                                                  <option value="main">اصلی (فقه/اصول)</option>
                                                  <option value="counseling">کلاس مشاوره</option>
                                                  <option value="thursday">درس پنج‌شنبه</option>
                                                  <option value="other">متفرقه / سایر</option>
                                                </select>
                                              </td>
                                              <td className="py-2 px-2 text-center">
                                                <input
                                                  type="number"
                                                  min="0"
                                                  value={course.calendarScheduledCount ?? 0}
                                                  onChange={(e) => onUpdateTeacherCourse?.(item.id, course.id, 'calendarScheduledCount', Number(e.target.value))}
                                                  className="w-16 text-center py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-xs outline-none focus:border-teal-500 focus:bg-white"
                                                />
                                              </td>
                                              <td className="py-2 px-2 text-center">
                                                <input
                                                  type="number"
                                                  min="0"
                                                  value={course.cancelledSessionsCount ?? 0}
                                                  onChange={(e) => onUpdateTeacherCourse?.(item.id, course.id, 'cancelledSessionsCount', Number(e.target.value))}
                                                  className="w-14 text-center py-1 bg-slate-50 border border-rose-200 text-rose-700 rounded-lg font-mono font-bold text-xs outline-none focus:border-rose-500 focus:bg-white"
                                                />
                                              </td>
                                              <td className="py-2 px-2 text-center">
                                                <input
                                                  type="number"
                                                  min="0"
                                                  value={course.substituteSessionsCount ?? 0}
                                                  onChange={(e) => onUpdateTeacherCourse?.(item.id, course.id, 'substituteSessionsCount', Number(e.target.value))}
                                                  className="w-14 text-center py-1 bg-slate-50 border border-indigo-200 text-indigo-700 rounded-lg font-mono font-bold text-xs outline-none focus:border-indigo-500 focus:bg-white"
                                                />
                                              </td>
                                              <td className="py-2 px-2 text-center bg-teal-50/40">
                                                <input
                                                  type="number"
                                                  min="0"
                                                  value={course.teachingHours ?? 0}
                                                  onChange={(e) => onUpdateTeacherCourse?.(item.id, course.id, 'teachingHours', Number(e.target.value))}
                                                  className="w-16 text-center py-1 bg-white border border-teal-300 text-teal-950 font-black rounded-lg font-mono text-xs outline-none focus:ring-2 focus:ring-teal-100"
                                                />
                                              </td>
                                              <td className="py-2 px-2 text-center">
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="1000"
                                                  value={course.hourlyRate ?? item.hourlyRate}
                                                  onChange={(e) => onUpdateTeacherCourse?.(item.id, course.id, 'hourlyRate', Number(e.target.value))}
                                                  className="w-24 text-center py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs outline-none focus:border-teal-500 focus:bg-white"
                                                />
                                              </td>
                                              <td className="py-2 px-2 text-center font-mono font-black text-emerald-700">
                                                {(course.grossAmount ?? (course.teachingHours * (course.hourlyRate || item.hourlyRate))).toLocaleString('fa-IR')}
                                              </td>
                                              <td className="py-2 px-2 text-center">
                                                {courses.length > 1 && (
                                                  <button
                                                    type="button"
                                                    onClick={() => onRemoveTeacherCourse?.(item.id, course.id)}
                                                    className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                                    title="حذف این درس"
                                                  >
                                                    <Trash2 size={13} />
                                                  </button>
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                        <tfoot className="bg-slate-100/70 font-bold border-t border-slate-200">
                                          <tr>
                                            <td colSpan={3} className="py-2.5 px-3 text-slate-700">
                                              جمع کل ساعات و ناخالص دروس این استاد ({courses.length} درس):
                                            </td>
                                            <td className="py-2 px-2 text-center font-mono">{courses.reduce((s, c) => s + (c.calendarScheduledCount || 0), 0)}</td>
                                            <td className="py-2 px-2 text-center font-mono text-rose-600">{courses.reduce((s, c) => s + (c.cancelledSessionsCount || 0), 0)}</td>
                                            <td className="py-2 px-2 text-center font-mono text-indigo-600">{courses.reduce((s, c) => s + (c.substituteSessionsCount || 0), 0)}</td>
                                            <td className="py-2 px-2 text-center font-mono font-black text-teal-950 bg-teal-100/60">
                                              {courses.reduce((s, c) => s + (c.teachingHours || 0), 0)} ساعت
                                            </td>
                                            <td className="py-2 px-2 text-center text-slate-400">-</td>
                                            <td className="py-2 px-2 text-center font-mono font-black text-emerald-800">
                                              {courses.reduce((s, c) => s + (c.grossAmount || 0), 0).toLocaleString('fa-IR')} تومان
                                            </td>
                                            <td></td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  {/* Total Row */}
                  <tfoot className="bg-slate-100/90 font-bold border-t border-slate-300">
                    <tr>
                      <td colSpan={3} className="py-3 px-3 text-slate-700">مجموع کل ({filteredItems.length} استاد)</td>
                      <td className="py-3 px-2 text-center font-mono text-slate-800">{summaryTotals.totalScheduledClasses}</td>
                      <td className="py-3 px-2 text-center font-mono text-rose-700">{summaryTotals.totalCancelledClasses}</td>
                      <td className="py-3 px-2 text-center font-mono text-indigo-700">{summaryTotals.totalSubSessions}</td>
                      <td className="py-3 px-2 text-center font-mono text-emerald-700">{summaryTotals.totalOvertime}</td>
                      <td className="py-3 px-2 text-center font-mono font-black text-teal-950 bg-teal-100/60 border-r border-teal-200">{summaryTotals.totalHours} س</td>
                      <td className="py-3 px-2 text-center text-slate-400">-</td>
                      <td className="py-3 px-2 text-center font-mono font-black text-emerald-800">{summaryTotals.totalGross.toLocaleString('fa-IR')} ت</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: بدهی‌ها (Debts & Loans Tab)                                         */}
          {/* ========================================================================= */}
          {activeTab === 'debts' && (
            <div>
              <div className="p-3.5 bg-amber-50/50 border-b border-amber-100/70 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Receipt size={16} className="text-amber-700" />
                  <span className="font-black text-slate-800">سربرگ بدهی‌ها و مطالبات اساتید</span>
                  <span className="text-[11px] text-slate-500">
                    (کل بدهی، مبلغ کسر ماهانه از حقوق، حساب مقصد جهت واریز و مانده پس از کسر)
                  </span>
                </div>
                <div className="text-[11px] text-amber-800 font-bold bg-white px-2.5 py-1 rounded-lg border border-amber-200/60 shadow-2xs">
                  مبالغ کسر شده به حساب‌های مقصد واریز خواهند شد.
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-2 w-8 text-center">ردیف</th>
                      <th className="py-3 px-3">نام و مشخصات استاد</th>
                      <th className="py-3 px-2 text-center text-slate-800">بدهی کل استاد (تومان)</th>
                      <th className="py-3 px-2 text-center text-rose-700 font-black">مبلغ کسر ماهانه از حقوق</th>
                      <th className="py-3 px-3 text-center text-indigo-700">حساب مقصد جهت واریز</th>
                      <th className="py-3 px-2 text-center text-slate-600">مانده بدهی پس از کسر</th>
                      <th className="py-3 px-3">شرح / عنوان بدهی</th>
                      <th className="py-3 px-2 w-14 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredItems.map((item, idx) => {
                      const totalDebt = item.debtTotalAmount ?? 0;
                      const monthlyDed = item.debtMonthlyDeduction ?? item.type2DeductionsTotal ?? 0;
                      const remDebt = Math.max(0, totalDebt - monthlyDed);

                      return (
                        <tr key={item.id} className="hover:bg-amber-50/15 transition-colors">
                          <td className="py-2.5 px-2 text-center font-mono text-slate-400 font-bold text-[11px]">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-black text-slate-900 text-xs">{item.teacherName}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{item.phone || item.nationalId || '-'}</div>
                          </td>

                          {/* بدهی کل */}
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={totalDebt}
                              onChange={(e) => onUpdateItemValue(item.id, 'debtTotalAmount', Number(e.target.value))}
                              className="w-28 text-center py-1 bg-white border border-slate-200 rounded-lg font-mono font-bold text-xs focus:ring-2 focus:ring-amber-100 focus:border-amber-500 outline-none"
                            />
                          </td>

                          {/* مبلغ کسر ماهانه */}
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={monthlyDed}
                              onChange={(e) => onUpdateItemValue(item.id, 'debtMonthlyDeduction', Number(e.target.value))}
                              className="w-28 text-center py-1 bg-white border border-rose-300 text-rose-700 font-black rounded-lg font-mono text-xs focus:ring-2 focus:ring-rose-100 focus:border-rose-500 outline-none"
                            />
                          </td>

                          {/* حساب مقصد */}
                          <td className="py-2.5 px-3 text-center">
                            <select
                              value={item.debtDestinationAccountId || (destinationAccounts[0]?.id || '')}
                              onChange={(e) => {
                                const acc = destinationAccounts.find(a => a.id === e.target.value);
                                onUpdateItemValue(item.id, 'debtDestinationAccountId', e.target.value);
                                if (acc) {
                                  onUpdateItemValue(item.id, 'debtDestinationTitle', acc.title);
                                }
                              }}
                              className="w-48 py-1 px-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-100 outline-none"
                            >
                              {destinationAccounts.map(acc => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.title} ({acc.bankName})
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* مانده پس از کسر */}
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700">
                            {remDebt.toLocaleString('fa-IR')}
                          </td>

                          {/* شرح بدهی */}
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              placeholder="مثلاً: قسط وام ضروری، عتبات، مساعده..."
                              value={item.debtNotes || ''}
                              onChange={(e) => onUpdateItemValue(item.id, 'debtNotes', e.target.value)}
                              className="w-full py-1 px-2 bg-white border border-slate-200 rounded-lg text-[11px] focus:ring-2 focus:ring-amber-100 outline-none"
                            />
                          </td>

                          {/* عملیات */}
                          <td className="py-2.5 px-2 text-center">
                            <button
                              onClick={() => onRemoveItem(item.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                              title="حذف استاد از دوره"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100/90 font-bold border-t border-slate-300">
                    <tr>
                      <td colSpan={2} className="py-3 px-3 text-slate-700">مجموع کل بدهی‌ها</td>
                      <td className="py-3 px-2 text-center font-mono font-black text-slate-800">{summaryTotals.totalDebts.toLocaleString('fa-IR')} ت</td>
                      <td className="py-3 px-2 text-center font-mono font-black text-rose-700">{summaryTotals.totalDebtDeductions.toLocaleString('fa-IR')} ت</td>
                      <td colSpan={4} className="py-3 px-3 text-xs text-slate-500">
                        مجموع مبالغ کسر شده این دوره جهت واریز به حساب‌های مربوطه
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: کمک به صندوق (Fund Contribution Tab)                                */}
          {/* ========================================================================= */}
          {activeTab === 'fund_contribution' && (
            <div>
              <div className="p-3.5 bg-rose-50/50 border-b border-rose-100/70 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <HeartHandshake size={16} className="text-rose-700" />
                  <span className="font-black text-slate-800">سربرگ کمک اختیاری به صندوق خیریه / قرض‌الحسنه</span>
                  <span className="text-[11px] text-slate-500">
                    (میزان درخواست استاد جهت کسر ماهانه، مبلغ کسر شده در این دوره و حساب مقصد صندوق)
                  </span>
                </div>
                <div className="text-[11px] text-rose-800 font-bold bg-white px-2.5 py-1 rounded-lg border border-rose-200/60 shadow-2xs">
                  بر اساس فرم‌های تکمیل‌شده یا تمایل استاد
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-2 w-8 text-center">ردیف</th>
                      <th className="py-3 px-3">نام و مشخصات استاد</th>
                      <th className="py-3 px-2 text-center text-slate-800 font-bold">مبلغ درخواستی کمک به صندوق (تومان)</th>
                      <th className="py-3 px-2 text-center text-rose-700 font-black">مبلغ کسر از حقوق در این ماه</th>
                      <th className="py-3 px-3 text-center text-indigo-700">حساب مقصد صندوق</th>
                      <th className="py-3 px-3">وضعیت و توضیحات درخواست</th>
                      <th className="py-3 px-2 w-14 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-rose-50/15 transition-colors">
                        <td className="py-2.5 px-2 text-center font-mono text-slate-400 font-bold text-[11px]">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-black text-slate-900 text-xs">{item.teacherName}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{item.coursesStr || '-'}</div>
                        </td>

                        {/* مبلغ درخواستی */}
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={item.fundContributionRequested ?? 0}
                            onChange={(e) => onUpdateItemValue(item.id, 'fundContributionRequested', Number(e.target.value))}
                            className="w-28 text-center py-1 bg-white border border-slate-200 rounded-lg font-mono font-bold text-xs focus:ring-2 focus:ring-rose-100 focus:border-rose-500 outline-none"
                          />
                        </td>

                        {/* مبلغ کسر این ماه */}
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={item.fundContributionDeduction ?? 0}
                            onChange={(e) => onUpdateItemValue(item.id, 'fundContributionDeduction', Number(e.target.value))}
                            className="w-28 text-center py-1 bg-white border border-rose-300 text-rose-700 font-black rounded-lg font-mono text-xs focus:ring-2 focus:ring-rose-100 focus:border-rose-500 outline-none"
                          />
                        </td>

                        {/* حساب مقصد صندوق */}
                        <td className="py-2.5 px-3 text-center">
                          <select
                            value={item.fundDestinationAccountId || 'acc_qard'}
                            onChange={(e) => {
                              const acc = destinationAccounts.find(a => a.id === e.target.value);
                              onUpdateItemValue(item.id, 'fundDestinationAccountId', e.target.value);
                              if (acc) onUpdateItemValue(item.id, 'fundDestinationTitle', acc.title);
                            }}
                            className="w-48 py-1 px-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                          >
                            {destinationAccounts
                              .filter(a => a.category === 'qard_fund' || a.id === 'acc_qard' || a.title.includes('صندوق'))
                              .concat(destinationAccounts.filter(a => a.category !== 'qard_fund' && a.id !== 'acc_qard' && !a.title.includes('صندوق')))
                              .map(acc => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.title} ({acc.bankName})
                                </option>
                              ))}
                          </select>
                        </td>

                        {/* توضیحات */}
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            placeholder="مثلاً: کسر دائم ماهانه با رضایت استاد..."
                            value={item.fundContributionNotes || ''}
                            onChange={(e) => onUpdateItemValue(item.id, 'fundContributionNotes', e.target.value)}
                            className="w-full py-1 px-2 bg-white border border-slate-200 rounded-lg text-[11px] focus:ring-2 focus:ring-rose-100 outline-none"
                          />
                        </td>

                        {/* عملیات */}
                        <td className="py-2.5 px-2 text-center">
                          <button
                            onClick={() => onRemoveItem(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            title="حذف استاد از دوره"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100/90 font-bold border-t border-slate-300">
                    <tr>
                      <td colSpan={2} className="py-3 px-3 text-slate-700">مجموع کل کمک به صندوق</td>
                      <td className="py-3 px-2 text-center font-mono font-black text-slate-800">{summaryTotals.totalFundRequests.toLocaleString('fa-IR')} ت</td>
                      <td className="py-3 px-2 text-center font-mono font-black text-rose-700">{summaryTotals.totalFundDeductions.toLocaleString('fa-IR')} ت</td>
                      <td colSpan={3} className="py-3 px-3 text-xs text-slate-500">
                        مجموع وجوه کسر شده این دوره که باید به حساب صندوق قرض‌الحسنه / خیریه منتقل شود
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: هزینه سرویس (Transport Service Tab)                                 */}
          {/* ========================================================================= */}
          {activeTab === 'transport' && (
            <div>
              <div className="p-3.5 bg-sky-50/50 border-b border-sky-100/70 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Car size={16} className="text-sky-700" />
                  <span className="font-black text-slate-800">سربرگ هزینه سرویس ایاب و ذهاب اساتید</span>
                  <span className="text-[11px] text-slate-500">
                    (تعداد نوبت‌های تردد در بازه، نرخ مصوب، تخفیف/یارانه و جمع کل هزینه سرویس)
                  </span>
                </div>
                <div className="text-[11px] text-sky-800 font-bold bg-white px-2.5 py-1 rounded-lg border border-sky-200/60 shadow-2xs">
                  نرخ پیش‌فرض هر نوبت: {settings.transportCostPerTrip.toLocaleString('fa-IR')} تومان
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-2 w-8 text-center">ردیف</th>
                      <th className="py-3 px-3">نام و مشخصات استاد</th>
                      <th className="py-3 px-2 text-center text-sky-800 font-bold">تعداد نوبت‌های تردد در بازه</th>
                      <th className="py-3 px-2 text-center text-slate-700">نرخ مصوب هر نوبت</th>
                      <th className="py-3 px-2 text-center text-emerald-700">یارانه / تخفیف (تومان)</th>
                      <th className="py-3 px-2 text-center text-rose-700 font-black">جمع کل کسر سرویس (تومان)</th>
                      <th className="py-3 px-3">شرح مسیر / توضیحات سرویس</th>
                      <th className="py-3 px-2 w-14 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-sky-50/15 transition-colors">
                        <td className="py-2.5 px-2 text-center font-mono text-slate-400 font-bold text-[11px]">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-black text-slate-900 text-xs">{item.teacherName}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{item.phone || '-'}</div>
                        </td>

                        {/* تعداد نوبت‌های تردد */}
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={item.transportTripsCount ?? 0}
                            onChange={(e) => onUpdateItemValue(item.id, 'transportTripsCount', Number(e.target.value))}
                            className="w-16 text-center py-1 bg-white border border-sky-300 text-sky-900 font-black rounded-lg font-mono text-xs focus:ring-2 focus:ring-sky-100 focus:border-sky-500 outline-none"
                          />
                        </td>

                        {/* نرخ مصوب هر نوبت */}
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={item.transportCostPerTrip ?? settings.transportCostPerTrip}
                            onChange={(e) => onUpdateItemValue(item.id, 'transportCostPerTrip', Number(e.target.value))}
                            className="w-24 text-center py-1 bg-white border border-slate-200 rounded-lg font-mono text-xs focus:ring-2 focus:ring-sky-100 outline-none"
                          />
                        </td>

                        {/* تخفیف / یارانه */}
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={item.transportManualDiscount ?? 0}
                            onChange={(e) => onUpdateItemValue(item.id, 'transportManualDiscount', Number(e.target.value))}
                            className="w-24 text-center py-1 bg-white border border-emerald-200 text-emerald-800 rounded-lg font-mono text-xs focus:ring-2 focus:ring-emerald-100 outline-none"
                          />
                        </td>

                        {/* جمع کل کسر سرویس */}
                        <td className="py-2.5 px-2 text-center font-mono font-black text-rose-700">
                          <input
                            type="number"
                            min="0"
                            value={item.transportDeduction ?? 0}
                            onChange={(e) => onUpdateItemValue(item.id, 'transportDeduction', Number(e.target.value))}
                            className="w-28 text-center py-1 bg-white border border-rose-300 text-rose-700 font-black rounded-lg font-mono text-xs focus:ring-2 focus:ring-rose-100 focus:border-rose-500 outline-none"
                          />
                        </td>

                        {/* توضیحات مسیر */}
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            placeholder="مسیر رفت و برگشت یا نام راننده..."
                            value={item.transportNotes || ''}
                            onChange={(e) => onUpdateItemValue(item.id, 'transportNotes', e.target.value)}
                            className="w-full py-1 px-2 bg-white border border-slate-200 rounded-lg text-[11px] focus:ring-2 focus:ring-sky-100 outline-none"
                          />
                        </td>

                        {/* عملیات */}
                        <td className="py-2.5 px-2 text-center">
                          <button
                            onClick={() => onRemoveItem(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            title="حذف استاد از دوره"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100/90 font-bold border-t border-slate-300">
                    <tr>
                      <td colSpan={2} className="py-3 px-3 text-slate-700">مجموع کل سرویس</td>
                      <td className="py-3 px-2 text-center font-mono font-black text-sky-900">{summaryTotals.totalTransportTrips} نوبت</td>
                      <td colSpan={2} className="text-center text-slate-400">-</td>
                      <td className="py-3 px-2 text-center font-mono font-black text-rose-700">{summaryTotals.totalTransportDeductions.toLocaleString('fa-IR')} ت</td>
                      <td colSpan={2} className="py-3 px-3 text-xs text-slate-500">مجموع هزینه سرویس کسر شده از حقوق اساتید</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: آمار نهار و شام (Meals - Lunch & Dinner Tab)                         */}
          {/* ========================================================================= */}
          {activeTab === 'meals' && (
            <div>
              <div className="p-3.5 bg-orange-50/50 border-b border-orange-100/70 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed size={16} className="text-orange-700" />
                  <span className="font-black text-slate-800">سربرگ آمار نهار و شام اساتید</span>
                  <span className="text-[11px] text-slate-500">
                    (تعداد وعده‌های نهار و شام در بازه زمانی، نرخ هر وعده و جمع کل کسر غذا)
                  </span>
                </div>
                <div className="text-[11px] text-orange-800 font-bold bg-white px-2.5 py-1 rounded-lg border border-orange-200/60 shadow-2xs">
                  مبلغ کسر شده به حساب آشپزخانه واریز می‌گردد.
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-2 w-8 text-center">ردیف</th>
                      <th className="py-3 px-3">نام و مشخصات استاد</th>
                      <th className="py-3 px-2 text-center text-orange-800 font-bold">تعداد وعده نهار</th>
                      <th className="py-3 px-2 text-center text-amber-800 font-bold">تعداد وعده شام</th>
                      <th className="py-3 px-2 text-center bg-orange-50 text-orange-950 font-black">مجموع وعده‌ها</th>
                      <th className="py-3 px-2 text-center text-slate-700">نرخ هر وعده (تومان)</th>
                      <th className="py-3 px-2 text-center text-rose-700 font-black">جمع کل کسر غذا (تومان)</th>
                      <th className="py-3 px-3 text-center text-indigo-700">حساب مقصد واریز</th>
                      <th className="py-3 px-2 w-14 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredItems.map((item, idx) => {
                      const totalMeals = (item.lunchCount || 0) + (item.dinnerCount || 0);
                      const mealDeduction = item.mealsDeductionTotal ?? (item.lunchDeduction || 0);

                      return (
                        <tr key={item.id} className="hover:bg-orange-50/15 transition-colors">
                          <td className="py-2.5 px-2 text-center font-mono text-slate-400 font-bold text-[11px]">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-black text-slate-900 text-xs">{item.teacherName}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{item.coursesStr || '-'}</div>
                          </td>

                          {/* وعده نهار */}
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={item.lunchCount ?? 0}
                              onChange={(e) => onUpdateItemValue(item.id, 'lunchCount', Number(e.target.value))}
                              className="w-14 text-center py-1 bg-white border border-orange-300 text-orange-900 font-black rounded-lg font-mono text-xs focus:ring-2 focus:ring-orange-100 focus:border-orange-500 outline-none"
                            />
                          </td>

                          {/* وعده شام */}
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={item.dinnerCount ?? 0}
                              onChange={(e) => onUpdateItemValue(item.id, 'dinnerCount', Number(e.target.value))}
                              className="w-14 text-center py-1 bg-white border border-amber-300 text-amber-900 font-black rounded-lg font-mono text-xs focus:ring-2 focus:ring-amber-100 focus:border-amber-500 outline-none"
                            />
                          </td>

                          {/* مجموع وعده‌ها */}
                          <td className="py-2.5 px-2 text-center font-mono font-black text-orange-950 bg-orange-50/60">
                            {totalMeals}
                          </td>

                          {/* نرخ هر وعده */}
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={item.mealPricePerUnit ?? settings.lunchCostPerDay}
                              onChange={(e) => onUpdateItemValue(item.id, 'mealPricePerUnit', Number(e.target.value))}
                              className="w-20 text-center py-1 bg-white border border-slate-200 rounded-lg font-mono text-xs focus:ring-2 focus:ring-orange-100 outline-none"
                            />
                          </td>

                          {/* جمع کل کسر غذا */}
                          <td className="py-2.5 px-2 text-center font-mono font-black text-rose-700">
                            <input
                              type="number"
                              min="0"
                              value={mealDeduction}
                              onChange={(e) => onUpdateItemValue(item.id, 'mealsDeductionTotal', Number(e.target.value))}
                              className="w-28 text-center py-1 bg-white border border-rose-300 text-rose-700 font-black rounded-lg font-mono text-xs focus:ring-2 focus:ring-rose-100 focus:border-rose-500 outline-none"
                            />
                          </td>

                          {/* حساب مقصد */}
                          <td className="py-2.5 px-3 text-center">
                            <select
                              value={item.mealsDestinationAccountId || 'acc_kitchen'}
                              onChange={(e) => onUpdateItemValue(item.id, 'mealsDestinationAccountId', e.target.value)}
                              className="w-44 py-1 px-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                            >
                              {destinationAccounts
                                .filter(a => a.category === 'kitchen' || a.id === 'acc_kitchen')
                                .concat(destinationAccounts.filter(a => a.category !== 'kitchen' && a.id !== 'acc_kitchen'))
                                .map(acc => (
                                  <option key={acc.id} value={acc.id}>
                                    {acc.title}
                                  </option>
                                ))}
                            </select>
                          </td>

                          {/* عملیات */}
                          <td className="py-2.5 px-2 text-center">
                            <button
                              onClick={() => onRemoveItem(item.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                              title="حذف استاد از دوره"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100/90 font-bold border-t border-slate-300">
                    <tr>
                      <td colSpan={2} className="py-3 px-3 text-slate-700">مجموع کل تغذیه</td>
                      <td className="py-3 px-2 text-center font-mono font-black text-orange-900">{summaryTotals.totalLunch} وعده</td>
                      <td className="py-3 px-2 text-center font-mono font-black text-amber-900">{summaryTotals.totalDinner} وعده</td>
                      <td className="py-3 px-2 text-center font-mono font-black text-orange-950 bg-orange-100/70">{summaryTotals.totalMeals} وعده</td>
                      <td className="text-center text-slate-400">-</td>
                      <td className="py-3 px-2 text-center font-mono font-black text-rose-700">{summaryTotals.totalMealDeductions.toLocaleString('fa-IR')} ت</td>
                      <td colSpan={2} className="py-3 px-3 text-xs text-slate-500">واریز به حساب آشپزخانه و تغذیه</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: اضافه / کاهش حقوق (Adjustments Tab)                                 */}
          {/* ========================================================================= */}
          {activeTab === 'adjustments' && (
            <div>
              <div className="p-3.5 bg-purple-50/50 border-b border-purple-100/70 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-purple-700" />
                  <span className="font-black text-slate-800">سربرگ اضافه / کاهش حقوق (تعدیلات دستی)</span>
                  <span className="text-[11px] text-slate-500">
                    (ثبت دستی مبالغ افزایشی مانند پاداش و مبالغ کاهشی مانند جریمه همراه با دلایل)
                  </span>
                </div>
                <div className="text-[11px] text-purple-800 font-bold bg-white px-2.5 py-1 rounded-lg border border-purple-200/60 shadow-2xs">
                  خالص تعدیل = مبلغ اضافه منهای مبلغ کاهش
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-2 w-8 text-center">ردیف</th>
                      <th className="py-3 px-3">نام و مشخصات استاد</th>
                      <th className="py-3 px-2 text-center text-emerald-700 font-bold">اضافه به حقوق / پاداش (+)</th>
                      <th className="py-3 px-3">علت یا شرح افزایش</th>
                      <th className="py-3 px-2 text-center text-rose-700 font-bold">کاهش از حقوق / جریمه (-)</th>
                      <th className="py-3 px-3">علت یا شرح کاهش</th>
                      <th className="py-3 px-2 text-center bg-purple-50 text-purple-950 font-black border-r border-purple-100">خالص تعدیل دستی</th>
                      <th className="py-3 px-2 w-14 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredItems.map((item, idx) => {
                      const netAdj = item.manualAdjustmentAmount ?? 0;

                      return (
                        <tr key={item.id} className="hover:bg-purple-50/15 transition-colors">
                          <td className="py-2.5 px-2 text-center font-mono text-slate-400 font-bold text-[11px]">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-black text-slate-900 text-xs">{item.teacherName}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{item.coursesStr || '-'}</div>
                          </td>

                          {/* اضافه به حقوق */}
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={item.manualAdditionAmount ?? item.bonusAmount ?? 0}
                              onChange={(e) => onUpdateItemValue(item.id, 'manualAdditionAmount', Number(e.target.value))}
                              className="w-28 text-center py-1 bg-white border border-emerald-300 text-emerald-800 font-black rounded-lg font-mono text-xs focus:ring-2 focus:ring-emerald-100 outline-none"
                            />
                          </td>

                          {/* علت افزایش */}
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              placeholder="مثلاً: تدریس کارگاهی، مصاحبه طلاب، پاداش پژوهش..."
                              value={item.manualAdditionReason || ''}
                              onChange={(e) => onUpdateItemValue(item.id, 'manualAdditionReason', e.target.value)}
                              className="w-full py-1 px-2 bg-white border border-slate-200 rounded-lg text-[11px] focus:ring-2 focus:ring-emerald-100 outline-none"
                            />
                          </td>

                          {/* کاهش از حقوق */}
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={item.manualReductionAmount ?? 0}
                              onChange={(e) => onUpdateItemValue(item.id, 'manualReductionAmount', Number(e.target.value))}
                              className="w-28 text-center py-1 bg-white border border-rose-300 text-rose-700 font-black rounded-lg font-mono text-xs focus:ring-2 focus:ring-rose-100 outline-none"
                            />
                          </td>

                          {/* علت کاهش */}
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              placeholder="مثلاً: تاخیر ورود، عدم تکمیل نمرات، جبران خسارت..."
                              value={item.manualReductionReason || ''}
                              onChange={(e) => onUpdateItemValue(item.id, 'manualReductionReason', e.target.value)}
                              className="w-full py-1 px-2 bg-white border border-slate-200 rounded-lg text-[11px] focus:ring-2 focus:ring-rose-100 outline-none"
                            />
                          </td>

                          {/* خالص تعدیل دستی */}
                          <td className="py-2.5 px-2 text-center font-mono font-black bg-purple-50/60 border-r border-purple-100">
                            <span className={cn(
                              "px-2 py-0.5 rounded-md",
                              netAdj > 0 ? "text-emerald-800 bg-emerald-100" : netAdj < 0 ? "text-rose-800 bg-rose-100" : "text-slate-600"
                            )}>
                              {netAdj > 0 ? `+${netAdj.toLocaleString('fa-IR')}` : netAdj.toLocaleString('fa-IR')}
                            </span>
                          </td>

                          {/* عملیات */}
                          <td className="py-2.5 px-2 text-center">
                            <button
                              onClick={() => onRemoveItem(item.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                              title="حذف استاد از دوره"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100/90 font-bold border-t border-slate-300">
                    <tr>
                      <td colSpan={2} className="py-3 px-3 text-slate-700">مجموع تعدیلات دستی</td>
                      <td className="py-3 px-2 text-center font-mono font-black text-emerald-800">+{summaryTotals.totalAdditions.toLocaleString('fa-IR')} ت</td>
                      <td className="text-center text-slate-400">-</td>
                      <td className="py-3 px-2 text-center font-mono font-black text-rose-700">-{summaryTotals.totalReductions.toLocaleString('fa-IR')} ت</td>
                      <td className="text-center text-slate-400">-</td>
                      <td className="py-3 px-2 text-center font-mono font-black bg-purple-100/80 text-purple-950 border-r border-purple-200">
                        {summaryTotals.totalNetAdjustments > 0 ? `+${summaryTotals.totalNetAdjustments.toLocaleString('fa-IR')}` : summaryTotals.totalNetAdjustments.toLocaleString('fa-IR')} ت
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 7: جمع‌بندی تمامی پارامترها (Summary Consolidation Tab)                  */}
          {/* ========================================================================= */}
          {activeTab === 'summary' && (
            <div>
              <div className="p-3.5 bg-emerald-50/50 border-b border-emerald-100/70 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={16} className="text-emerald-700" />
                  <span className="font-black text-slate-800">سربرگ جمع‌بندی و تراز نهایی تمامی پارامترها</span>
                  <span className="text-[11px] text-slate-500">
                    (تلفیق ساعات کارکرد، بدهی، صندوق، سرویس، تغذیه و خالص پرداختی نهایی)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-white border border-emerald-200 text-emerald-900 font-black font-mono">
                    خالص کل: {summaryTotals.totalNetPayable.toLocaleString('fa-IR')} تومان
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    {isCompactView ? (
                      /* Compact Header */
                      <tr>
                        <th className="py-3 px-2 w-8 text-center">ردیف</th>
                        <th className="py-3 px-3">نام و مشخصات استاد</th>
                        <th className="py-3 px-2 text-center">ساعت تدریس</th>
                        <th className="py-3 px-2 text-center text-slate-800">ناخالص کارکرد</th>
                        <th className="py-3 px-2 text-center text-amber-700">کسر بدهی</th>
                        <th className="py-3 px-2 text-center text-rose-700">کسر صندوق</th>
                        <th className="py-3 px-2 text-center text-sky-700">کسر سرویس</th>
                        <th className="py-3 px-2 text-center text-orange-700">کسر نهار و شام</th>
                        <th className="py-3 px-2 text-center text-purple-700">تعدیل دستی (+/-)</th>
                        <th className="py-3 px-3 text-center bg-teal-50 text-teal-950 font-black border-r border-teal-100/60">خالص پرداختی پایا</th>
                        <th className="py-3 px-2 text-center">فیش حقوقی</th>
                        <th className="py-3 px-2 w-12 text-center">حذف</th>
                      </tr>
                    ) : (
                      /* Detailed Header */
                      <tr>
                        <th className="py-3 px-2 w-8 text-center">ردیف</th>
                        <th className="py-3 px-3">نام و مشخصات استاد</th>
                        <th className="py-3 px-2 text-center">جلسات تقویم</th>
                        <th className="py-3 px-2 text-center text-rose-700">تعطیل</th>
                        <th className="py-3 px-2 text-center text-indigo-700">جایگزین</th>
                        <th className="py-3 px-2 text-center text-emerald-700">اضافه</th>
                        <th className="py-3 px-2 text-center font-black">کل ساعت</th>
                        <th className="py-3 px-2 text-center text-slate-800">ناخالص استحقاقی</th>
                        <th className="py-3 px-2 text-center text-amber-700">کسر بدهی</th>
                        <th className="py-3 px-2 text-center text-rose-700">کسر صندوق</th>
                        <th className="py-3 px-2 text-center text-sky-700">کسر سرویس</th>
                        <th className="py-3 px-2 text-center text-orange-700">کسر تغذیه</th>
                        <th className="py-3 px-2 text-center text-purple-700">تعدیل دستی</th>
                        <th className="py-3 px-3 text-center bg-teal-50 text-teal-950 font-black border-r border-teal-100/60">خالص پرداختی نهایی</th>
                        <th className="py-3 px-2 text-center">شماره حساب / شبا</th>
                        <th className="py-3 px-2 text-center">فیش</th>
                        <th className="py-3 px-2 w-12 text-center">حذف</th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredItems.map((item, idx) => {
                      const debtDed = item.debtMonthlyDeduction ?? item.type2DeductionsTotal ?? 0;
                      const fundDed = item.fundContributionDeduction ?? 0;
                      const transportDed = item.transportDeduction ?? 0;
                      const mealDed = item.mealsDeductionTotal ?? item.lunchDeduction ?? 0;
                      const manualAdj = item.manualAdjustmentAmount ?? 0;

                      return (
                        <tr key={item.id} className="hover:bg-teal-50/15 transition-colors">
                          <td className="py-2.5 px-2 text-center font-mono text-slate-400 font-bold text-[11px]">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-black text-slate-900 text-xs">{item.teacherName}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{item.coursesStr || '-'}</div>
                          </td>

                          {isCompactView ? (
                            <>
                              <td className="py-2.5 px-2 text-center font-mono font-bold">{item.totalTeachingHours}</td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-800">{item.baseGrossAmount.toLocaleString('fa-IR')}</td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-amber-700">{debtDed.toLocaleString('fa-IR')}</td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-rose-700">{fundDed.toLocaleString('fa-IR')}</td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-sky-700">{transportDed.toLocaleString('fa-IR')}</td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-orange-700">{mealDed.toLocaleString('fa-IR')}</td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-purple-700">
                                {manualAdj > 0 ? `+${manualAdj.toLocaleString('fa-IR')}` : manualAdj.toLocaleString('fa-IR')}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-black text-teal-950 bg-teal-50/60 border-r border-teal-100/60">
                                {item.netPayable.toLocaleString('fa-IR')}
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <button
                                  onClick={() => onOpenSlipDetail(item)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-800 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer"
                                  title="مشاهده و چاپ فیش حقوقی"
                                >
                                  <Eye size={12} />
                                  <span>فیش</span>
                                </button>
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <button
                                  onClick={() => onRemoveItem(item.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                  title="حذف"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-2.5 px-2 text-center font-mono">{item.calendarScheduledClassesCount ?? item.totalCalendarDays ?? 0}</td>
                              <td className="py-2.5 px-2 text-center font-mono text-rose-700">{item.cancelledDaysCount ?? 0}</td>
                              <td className="py-2.5 px-2 text-center font-mono text-indigo-700">{item.substituteTeachingSessions ?? 0}</td>
                              <td className="py-2.5 px-2 text-center font-mono text-emerald-700">{item.overtimeHours ?? 0}</td>
                              <td className="py-2.5 px-2 text-center font-mono font-black text-slate-900 bg-slate-50">{item.totalTeachingHours}</td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-800">{item.baseGrossAmount.toLocaleString('fa-IR')}</td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-amber-700">{debtDed.toLocaleString('fa-IR')}</td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-rose-700">{fundDed.toLocaleString('fa-IR')}</td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-sky-700">{transportDed.toLocaleString('fa-IR')}</td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-orange-700">{mealDed.toLocaleString('fa-IR')}</td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-purple-700">
                                {manualAdj > 0 ? `+${manualAdj.toLocaleString('fa-IR')}` : manualAdj.toLocaleString('fa-IR')}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-black text-teal-950 bg-teal-50/60 border-r border-teal-100/60">
                                {item.netPayable.toLocaleString('fa-IR')}
                              </td>
                              <td className="py-2.5 px-2 text-center text-[10px] font-mono text-slate-500">
                                {item.bankSheba || item.bankAccount || `${item.bankName || 'تجارت'}`}
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <button
                                  onClick={() => onOpenSlipDetail(item)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-800 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer"
                                  title="مشاهده فیش حقوقی"
                                >
                                  <Eye size={12} />
                                  <span>فیش</span>
                                </button>
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <button
                                  onClick={() => onRemoveItem(item.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                  title="حذف"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Summary Footer */}
                  <tfoot className="bg-slate-100/90 font-bold border-t border-slate-300">
                    <tr>
                      <td colSpan={2} className="py-3 px-3 text-slate-700">تراز نهایی کل اساتید</td>
                      {isCompactView ? (
                        <>
                          <td className="py-3 px-2 text-center font-mono text-slate-800">{summaryTotals.totalHours}</td>
                          <td className="py-3 px-2 text-center font-mono text-slate-900">{summaryTotals.totalGross.toLocaleString('fa-IR')}</td>
                          <td className="py-3 px-2 text-center font-mono text-amber-700">{summaryTotals.totalDebtDeductions.toLocaleString('fa-IR')}</td>
                          <td className="py-3 px-2 text-center font-mono text-rose-700">{summaryTotals.totalFundDeductions.toLocaleString('fa-IR')}</td>
                          <td className="py-3 px-2 text-center font-mono text-sky-700">{summaryTotals.totalTransportDeductions.toLocaleString('fa-IR')}</td>
                          <td className="py-3 px-2 text-center font-mono text-orange-700">{summaryTotals.totalMealDeductions.toLocaleString('fa-IR')}</td>
                          <td className="py-3 px-2 text-center font-mono text-purple-700">{summaryTotals.totalNetAdjustments.toLocaleString('fa-IR')}</td>
                          <td className="py-3 px-3 text-center font-mono font-black text-teal-950 bg-teal-100/80 border-r border-teal-200">
                            {summaryTotals.totalNetPayable.toLocaleString('fa-IR')} ت
                          </td>
                          <td colSpan={2}></td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 px-2 text-center font-mono">{summaryTotals.totalScheduledClasses}</td>
                          <td className="py-3 px-2 text-center font-mono text-rose-700">{summaryTotals.totalCancelledClasses}</td>
                          <td className="py-3 px-2 text-center font-mono text-indigo-700">{summaryTotals.totalSubSessions}</td>
                          <td className="py-3 px-2 text-center font-mono text-emerald-700">{summaryTotals.totalOvertime}</td>
                          <td className="py-3 px-2 text-center font-mono font-black">{summaryTotals.totalHours}</td>
                          <td className="py-3 px-2 text-center font-mono font-black text-slate-900">{summaryTotals.totalGross.toLocaleString('fa-IR')}</td>
                          <td className="py-3 px-2 text-center font-mono font-bold text-amber-700">{summaryTotals.totalDebtDeductions.toLocaleString('fa-IR')}</td>
                          <td className="py-3 px-2 text-center font-mono font-bold text-rose-700">{summaryTotals.totalFundDeductions.toLocaleString('fa-IR')}</td>
                          <td className="py-3 px-2 text-center font-mono font-bold text-sky-700">{summaryTotals.totalTransportDeductions.toLocaleString('fa-IR')}</td>
                          <td className="py-3 px-2 text-center font-mono font-bold text-orange-700">{summaryTotals.totalMealDeductions.toLocaleString('fa-IR')}</td>
                          <td className="py-3 px-2 text-center font-mono font-bold text-purple-700">{summaryTotals.totalNetAdjustments.toLocaleString('fa-IR')}</td>
                          <td className="py-3 px-3 text-center font-mono font-black text-teal-950 bg-teal-100/80 border-r border-teal-200">
                            {summaryTotals.totalNetPayable.toLocaleString('fa-IR')} ت
                          </td>
                          <td colSpan={3}></td>
                        </>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
