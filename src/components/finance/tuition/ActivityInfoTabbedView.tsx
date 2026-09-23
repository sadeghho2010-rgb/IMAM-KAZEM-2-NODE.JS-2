import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  CalendarCheck, 
  Utensils, 
  Award, 
  CreditCard, 
  PiggyBank, 
  Receipt, 
  Sliders, 
  Search, 
  Filter, 
  ArrowLeft, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Info,
  User,
  Sparkles
} from 'lucide-react';
import {
  Student,
  TuitionCalculationSettings,
  StudentFinancialProfile,
  TuitionCalculationBreakdown,
  StudyPeriod,
  PeriodicStudyLog,
  AttendanceSessionLog,
  CounselingSessionGrade,
  StudentClaimRecord,
  FinanceClaimCategory,
  FinanceDestinationAccount,
  StudentMealReservation
} from '../../../types';

interface StudentLunchItem {
  id: string;
  studentId: string;
  studentName: string;
  nationalId: string;
  grade: string;
  monthlyMealsCount: number;
  mealPrice: number;
  subsidyDiscount?: number;
}

interface ActivityInfoTabbedViewProps {
  students: Student[];
  profiles: StudentFinancialProfile[];
  calculatedTuitions: TuitionCalculationBreakdown[];
  studyPeriods: StudyPeriod[];
  studyLogs: PeriodicStudyLog[];
  attendanceLogs: AttendanceSessionLog[];
  counselingGrades: CounselingSessionGrade[];
  mealReservations: StudentMealReservation[];
  lunchItems: StudentLunchItem[];
  claimsList: StudentClaimRecord[];
  claimCategories: FinanceClaimCategory[];
  destinationAccounts: FinanceDestinationAccount[];
  loans: any[];
  settings: TuitionCalculationSettings;
  startDate: string;
  endDate: string;
  gradeFilter: string;
  setGradeFilter: (val: string) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  studentOverrides: Record<string, {
    manualAdjustmentAmount?: number;
    manualAdjustmentReason?: string;
    overrideStudyBonus?: number;
    ignoreAbsencePenalty?: boolean;
    overrideBaseTuition?: number;
  }>;
  setStudentOverrides: React.Dispatch<React.SetStateAction<Record<string, {
    manualAdjustmentAmount?: number;
    manualAdjustmentReason?: string;
    overrideStudyBonus?: number;
    ignoreAbsencePenalty?: boolean;
    overrideBaseTuition?: number;
  }>>>;
  onOpenSlipDetail: (item: TuitionCalculationBreakdown) => void;
  onOpenEditProfile: (student: Student) => void;
  onNavigateToMechanized: () => void;
  onOpenDebtModal: (student: Student) => void;
}

type TabType = 
  | 'summary'
  | 'study_hours'
  | 'attendance'
  | 'meals'
  | 'counseling'
  | 'debts'
  | 'fund_contribution'
  | 'loans'
  | 'manual_adjustments';

export const ActivityInfoTabbedView: React.FC<ActivityInfoTabbedViewProps> = ({
  students,
  profiles,
  calculatedTuitions,
  studyPeriods,
  studyLogs,
  attendanceLogs,
  counselingGrades,
  lunchItems,
  claimsList,
  destinationAccounts,
  loans,
  startDate,
  endDate,
  gradeFilter,
  setGradeFilter,
  searchQuery,
  setSearchQuery,
  studentOverrides,
  setStudentOverrides,
  onOpenSlipDetail,
  onOpenEditProfile,
  onNavigateToMechanized,
  onOpenDebtModal
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  
  // Study Tab Specific Filters
  const [selectedStudyPeriodId, setSelectedStudyPeriodId] = useState<string>('all');
  const [studyFilterBelowAvgAndReq, setStudyFilterBelowAvgAndReq] = useState<boolean>(false);

  // Closed study periods in the date range
  const closedStudyPeriods = useMemo(() => {
    return studyPeriods.filter(p => {
      if (!p.isClosed && !p.closedManually) return false;
      if (startDate && p.startDate < startDate) return false;
      if (endDate && p.endDate > endDate) return false;
      return true;
    });
  }, [studyPeriods, startDate, endDate]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter(st => {
      if (gradeFilter !== 'all' && st.grade !== gradeFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchName = (st.name || '').toLowerCase().includes(query);
        const matchCode = (st.nationalId || '').includes(query) || (st.managementCenterCode || '').includes(query);
        if (!matchName && !matchCode) return false;
      }
      return true;
    });
  }, [students, gradeFilter, searchQuery]);

  // Unique Grades for dropdown
  const uniqueGrades = useMemo(() => {
    const grades = new Set<string>();
    students.forEach(s => {
      if (s.grade) grades.add(s.grade);
    });
    return Array.from(grades).sort();
  }, [students]);

  // Calculations map for fast access
  const calcMap = useMemo(() => {
    const map = new Map<string, TuitionCalculationBreakdown>();
    calculatedTuitions.forEach(c => map.set(c.studentId, c));
    return map;
  }, [calculatedTuitions]);

  // Profiles map
  const profileMap = useMemo(() => {
    const map = new Map<string, StudentFinancialProfile>();
    profiles.forEach(p => map.set(p.studentId, p));
    return map;
  }, [profiles]);

  return (
    <div className="space-y-6">
      {/* Top Banner Notice & Jump Button */}
      <div className="bg-linear-to-r from-indigo-50 via-slate-50 to-emerald-50 p-4 sm:p-5 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
            <Info size={20} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900">سربرگ‌های تفکیک شده اطلاعات و فعالیت‌های طلاب</h4>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              تغییرات و تنظیمات انجام شده در این بخش صرفاً برای پیش‌نمایش و محاسبه مکانیزه اعمال می‌شوند و اطلاعات اصلی را مخدوش نمی‌کنند.
            </p>
          </div>
        </div>
        <button
          onClick={onNavigateToMechanized}
          className="shrink-0 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
        >
          <span>ورود به مرحله محاسبه مکانیزه</span>
          <ArrowLeft size={16} />
        </button>
      </div>

      {/* Global Filter Bar (Grade & Search) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="جستجوی نام، کد ملی یا کد طلبه..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>

          {/* Grade Selector */}
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-slate-400" />
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
            >
              <option value="all">همه پایه‌ها</option>
              {uniqueGrades.map(g => (
                <option key={g} value={g}>پایه {g}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          تعداد طلاب مطابق فیلتر: <span className="font-bold text-indigo-700 font-mono">{filteredStudents.length}</span> نفر
        </div>
      </div>

      {/* Navigation Sub-Tabs (9 Categories) */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1 min-w-max">
          {[
            { id: 'summary', label: 'خلاصه کلی', icon: Sliders },
            { id: 'study_hours', label: 'ساعت مطالعه و مباحثه', icon: BookOpen },
            { id: 'attendance', label: 'حضور و غیاب', icon: CalendarCheck },
            { id: 'meals', label: 'آمار نهار و شام', icon: Utensils },
            { id: 'counseling', label: 'ارزیابی کلاس مشاوره', icon: Award },
            { id: 'debts', label: 'بدهی‌ها و مطالبات', icon: Receipt },
            { id: 'fund_contribution', label: 'حق عضویت صندوق', icon: PiggyBank },
            { id: 'loans', label: 'اقساط وام‌ها', icon: CreditCard },
            { id: 'manual_adjustments', label: 'پاداش و جرایم دستی', icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: خلاصه کلی */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-medium">کل طلاب واجد شرایط</span>
              <div className="text-xl font-black text-slate-800 mt-1 font-mono">{filteredStudents.length} نفر</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-medium">دوره‌های مطالعه بسته شده</span>
              <div className="text-xl font-black text-indigo-600 mt-1 font-mono">{closedStudyPeriods.length} دوره</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-medium">جلسات حضور و غیاب ثبت‌شده</span>
              <div className="text-xl font-black text-emerald-600 mt-1 font-mono">{attendanceLogs.length} جلسه</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-medium">تعداد کل رکورد‌های بدهی</span>
              <div className="text-xl font-black text-rose-600 mt-1 font-mono">{claimsList.length} رکورد</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800">پیش‌نمایش لیست طلاب و وضعیت آمادگی محاسبه</h4>
              <span className="text-[11px] text-slate-500">برای جزئیات هر بخش به سربرگ مربوطه مراجعه کنید</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="p-3">ردیف</th>
                    <th className="p-3">نام طلبه</th>
                    <th className="p-3">پایه</th>
                    <th className="p-3">کد ملی</th>
                    <th className="p-3">وضعیت تاهل</th>
                    <th className="p-3">مبلغ نهایی محاسبه‌شده</th>
                    <th className="p-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((st, idx) => {
                    const calc = calcMap.get(st.id);
                    const prof = profileMap.get(st.id);
                    const isMarried = prof?.isMarried || prof?.maritalStatus === 'متاهل' || st.maritalStatus === 'متاهل';

                    return (
                      <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">{st.name}</td>
                        <td className="p-3 text-slate-600">{st.grade || 'نامشخص'}</td>
                        <td className="p-3 text-slate-500 font-mono">{st.nationalId || '-'}</td>
                        <td className="p-3 text-slate-600">
                          {isMarried ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-bold text-[10px]">متاهل</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold text-[10px]">مجرد</span>
                          )}
                        </td>
                        <td className="p-3 font-black font-mono text-emerald-700">
                          {calc ? calc.netPayableTuition.toLocaleString('fa-IR') : 'در انتظار'} تومان
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {calc && (
                              <button
                                onClick={() => onOpenSlipDetail(calc)}
                                className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer"
                                title="مشاهده فیش تفصیلی"
                              >
                                <Eye size={15} />
                              </button>
                            )}
                            <button
                              onClick={() => onOpenEditProfile(st)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                              title="پروفایل مالی طلبه"
                            >
                              <User size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: ساعت مطالعه و مباحثه */}
      {activeTab === 'study_hours' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-slate-700">انتخاب دوره مطالعاتی بسته شده:</span>
                <select
                  value={selectedStudyPeriodId}
                  onChange={(e) => setSelectedStudyPeriodId(e.target.value)}
                  className="text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900"
                >
                  <option value="all">همه دوره‌های بسته شده ({closedStudyPeriods.length} دوره)</option>
                  {closedStudyPeriods.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.startDate} الی {p.endDate})
                    </option>
                  ))}
                </select>
              </div>

              {/* Special Filter: Below Average AND Below Mandatory */}
              <label className="flex items-center gap-2 cursor-pointer bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl text-rose-800 text-xs font-bold select-none hover:bg-rose-100 transition-colors">
                <input
                  type="checkbox"
                  checked={studyFilterBelowAvgAndReq}
                  onChange={(e) => setStudyFilterBelowAvgAndReq(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <span>فقط نمایش افراد «زیر میانگین و زیر موظفی»</span>
              </label>
            </div>
          </div>

          {/* Render Tables for Periods */}
          {(selectedStudyPeriodId === 'all' ? closedStudyPeriods : closedStudyPeriods.filter(p => p.id === selectedStudyPeriodId)).map(period => {
            // Logs for this period
            const periodLogs = studyLogs.filter(l => l.periodId === period.id);
            const logsMap = new Map<string, PeriodicStudyLog>();
            periodLogs.forEach(l => logsMap.set(l.studentId, l));

            // Calculate Period Average in hours
            const totalHours = periodLogs.reduce((acc, curr) => acc + (curr.hours || ((curr.studyHours || 0) + (curr.discussionHours || 0))), 0);
            const avgHours = periodLogs.length > 0 ? (totalHours / periodLogs.length) : 0;
            const mandatoryHours = period.mandatoryHours || 0;

            const periodStudents = filteredStudents.filter(st => {
              const log = logsMap.get(st.id);
              const actual = log ? (log.hours || ((log.studyHours || 0) + (log.discussionHours || 0))) : 0;
              const isBelowAvg = actual < avgHours;
              const isBelowReq = actual < mandatoryHours;

              if (studyFilterBelowAvgAndReq) {
                return isBelowAvg && isBelowReq;
              }
              return true;
            });

            return (
              <div key={period.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                      <BookOpen size={16} className="text-indigo-600" />
                      <span>{period.title}</span>
                      <span className="text-[11px] text-slate-500 font-normal">({period.startDate} تا {period.endDate})</span>
                    </h4>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="text-slate-600">موظفی دوره: <b className="text-slate-900">{mandatoryHours} ساعت</b></span>
                    <span className="text-slate-600">میانگین طلاب: <b className="text-indigo-700">{avgHours.toFixed(1)} ساعت</b></span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                      <tr>
                        <th className="p-3">ردیف</th>
                        <th className="p-3">نام و نام خانوادگی</th>
                        <th className="p-3">کد ملی</th>
                        <th className="p-3">پایه</th>
                        <th className="p-3">ثبت شده؟</th>
                        <th className="p-3">میزان مطالعه</th>
                        <th className="p-3">وضعیت نسبت به میانگین</th>
                        <th className="p-3">وضعیت نسبت به موظفی</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {periodStudents.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-slate-400">
                            هیچ رکوردی مطابق فیلترهای انتخابی یافت نشد.
                          </td>
                        </tr>
                      ) : (
                        periodStudents.map((st, idx) => {
                          const log = logsMap.get(st.id);
                          const actual = log ? (log.hours || ((log.studyHours || 0) + (log.discussionHours || 0))) : 0;
                          const hasSubmitted = !!log;
                          const diffAvg = actual - avgHours;
                          const diffReq = actual - mandatoryHours;

                          return (
                            <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                              <td className="p-3 font-bold text-slate-900">{st.name}</td>
                              <td className="p-3 text-slate-500 font-mono">{st.nationalId || '-'}</td>
                              <td className="p-3 text-slate-600">{st.grade || '-'}</td>
                              <td className="p-3">
                                {hasSubmitted ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                                    <CheckCircle size={14} /> بله
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-rose-500 font-bold text-[11px]">
                                    <XCircle size={14} /> خیر
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-mono font-bold text-slate-800">
                                {actual.toFixed(1)} ساعت
                              </td>
                              <td className="p-3">
                                {diffAvg >= 0 ? (
                                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                    +{diffAvg.toFixed(1)}h بالای میانگین
                                  </span>
                                ) : (
                                  <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                    {diffAvg.toFixed(1)}h زیر میانگین
                                  </span>
                                )}
                              </td>
                              <td className="p-3">
                                {diffReq >= 0 ? (
                                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                    +{diffReq.toFixed(1)}h بالای موظفی
                                  </span>
                                ) : (
                                  <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                    {diffReq.toFixed(1)}h زیر موظفی
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 3: حضور و غیاب */}
      {activeTab === 'attendance' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs space-y-2">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800">تفکیک حضور و غیاب طلاب در بازه زمانی انتخابی</h4>
            <span className="text-[11px] text-slate-500 font-mono">تعداد کل جلسات ثبت شده: {attendanceLogs.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                <tr>
                  <th className="p-3">ردیف</th>
                  <th className="p-3">نام طلبه</th>
                  <th className="p-3">پایه</th>
                  <th className="p-3 text-center">حاضر</th>
                  <th className="p-3 text-center">غیبت غیرموجه</th>
                  <th className="p-3 text-center">غیبت موجه</th>
                  <th className="p-3 text-center">تاخیر (دقیقه)</th>
                  <th className="p-3 text-center">مشمول جریمه؟</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((st, idx) => {
                  let presentCount = 0;
                  let unexcusedCount = 0;
                  let excusedCount = 0;
                  let lateMinutesTotal = 0;

                  attendanceLogs.forEach(session => {
                    const rec = session.students?.find(s => s.studentId === st.id);
                    if (rec) {
                      if (rec.status === 'present') presentCount++;
                      else if (rec.status === 'absent') {
                        if (rec.isExcused) excusedCount++;
                        else unexcusedCount++;
                      } else if (rec.status === 'late') {
                        lateMinutesTotal += rec.lateMinutes || 0;
                      }
                    }
                  });

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-900">{st.name}</td>
                      <td className="p-3 text-slate-600">{st.grade || '-'}</td>
                      <td className="p-3 text-center font-bold text-emerald-600 font-mono">{presentCount}</td>
                      <td className="p-3 text-center font-bold text-rose-600 font-mono">{unexcusedCount}</td>
                      <td className="p-3 text-center font-bold text-amber-600 font-mono">{excusedCount}</td>
                      <td className="p-3 text-center font-mono text-slate-700">{lateMinutesTotal}m</td>
                      <td className="p-3 text-center">
                        {unexcusedCount > 0 ? (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded-md font-bold text-[10px]">
                            {unexcusedCount} جلسه کسر
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">بدون جریمه</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: آمار نهار و شام */}
      {activeTab === 'meals' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800">آمار ژتون‌های نهار و شام و مبالغ کسر از شهریه</h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                <tr>
                  <th className="p-3">ردیف</th>
                  <th className="p-3">نام طلبه</th>
                  <th className="p-3">پایه</th>
                  <th className="p-3 text-center">تعداد وعده نهار</th>
                  <th className="p-3 text-center">تعداد وعده شام</th>
                  <th className="p-3 text-center">مجموع وعده‌ها</th>
                  <th className="p-3 text-left">مبلغ کسر از شهریه (تومان)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((st, idx) => {
                  const lunch = lunchItems.find(l => l.studentId === st.id);
                  const totalMeals = lunch?.monthlyMealsCount || 0;
                  const estimatedLunch = Math.round(totalMeals * 0.6);
                  const estimatedDinner = totalMeals - estimatedLunch;
                  const totalCost = (lunch?.mealPrice || 0) * totalMeals;

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-900">{st.name}</td>
                      <td className="p-3 text-slate-600">{st.grade || '-'}</td>
                      <td className="p-3 text-center font-mono font-bold text-slate-800">{estimatedLunch}</td>
                      <td className="p-3 text-center font-mono font-bold text-slate-800">{estimatedDinner}</td>
                      <td className="p-3 text-center font-mono font-bold text-indigo-700">{totalMeals}</td>
                      <td className="p-3 text-left font-mono font-bold text-rose-600">
                        {totalCost.toLocaleString('fa-IR')} تومان
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: ارزیابی کلاس مشاوره */}
      {activeTab === 'counseling' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800">تعداد رتبه‌های کسب‌شده در کلاس‌های مشاوره</h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                <tr>
                  <th className="p-3">ردیف</th>
                  <th className="p-3">نام طلبه</th>
                  <th className="p-3">پایه</th>
                  <th className="p-3 text-center">رتبه الف</th>
                  <th className="p-3 text-center">رتبه ب</th>
                  <th className="p-3 text-center">رتبه ج</th>
                  <th className="p-3 text-center">رتبه د</th>
                  <th className="p-3 text-left">امتیاز تشویقی مشاوره</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((st, idx) => {
                  let countA = 0;
                  let countB = 0;
                  let countC = 0;
                  let countD = 0;

                  counselingGrades.forEach(g => {
                    if (g.studentId === st.id) {
                      if (g.grade === 'الف') countA++;
                      else if (g.grade === 'ب') countB++;
                      else if (g.grade === 'ج') countC++;
                      else if (g.grade === 'د') countD++;
                    }
                  });

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-900">{st.name}</td>
                      <td className="p-3 text-slate-600">{st.grade || '-'}</td>
                      <td className="p-3 text-center font-bold text-emerald-600 font-mono">{countA}</td>
                      <td className="p-3 text-center font-bold text-indigo-600 font-mono">{countB}</td>
                      <td className="p-3 text-center font-bold text-amber-600 font-mono">{countC}</td>
                      <td className="p-3 text-center font-bold text-rose-600 font-mono">{countD}</td>
                      <td className="p-3 text-left font-mono font-bold text-emerald-700">
                        {countA + countB > 0 ? `${countA + countB} نمره عالی` : 'فاقد تشویقی'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: بدهی‌ها و مطالبات */}
      {activeTab === 'debts' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs space-y-2">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-slate-800">عناوین بدهی طلاب و حساب‌های مقصد واریز</h4>
              <p className="text-[11px] text-slate-500">برای مشاهده ریز بدهی‌ها یا افزودن بدهی جدید بر روی دکمه مدیریت کلیک کنید.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                <tr>
                  <th className="p-3">ردیف</th>
                  <th className="p-3">نام طلبه</th>
                  <th className="p-3">پایه</th>
                  <th className="p-3">عناوین بدهی</th>
                  <th className="p-3">حساب‌های مقصد</th>
                  <th className="p-3 text-left">مانده کل بدهی</th>
                  <th className="p-3 text-left">قسط کسر در این دوره</th>
                  <th className="p-3 text-center">مدیریت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((st, idx) => {
                  const studentClaims = claimsList.filter(c => c.studentId === st.id && (c.remainingAmount || 0) > 0);
                  const totalDebt = studentClaims.reduce((a, b) => a + (b.remainingAmount || 0), 0);
                  const monthlyDeduct = studentClaims.reduce((a, b) => a + (b.monthlyDeductionAmount || b.remainingAmount || 0), 0);

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-900">{st.name}</td>
                      <td className="p-3 text-slate-600">{st.grade || '-'}</td>
                      <td className="p-3">
                        {studentClaims.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {studentClaims.map(c => (
                              <span key={c.id} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px]">
                                {c.claimTitle}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">فاقد بدهی</span>
                        )}
                      </td>
                      <td className="p-3">
                        {studentClaims.length > 0 ? (
                          <div className="text-[11px] text-slate-600">
                            {destinationAccounts.find(d => d.id === studentClaims[0]?.destinationAccountId)?.title || 'حساب پیش‌فرض صندوق'}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-3 text-left font-mono font-bold text-rose-600">
                        {totalDebt.toLocaleString('fa-IR')} تومان
                      </td>
                      <td className="p-3 text-left font-mono font-bold text-slate-800">
                        {monthlyDeduct.toLocaleString('fa-IR')} تومان
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => onOpenDebtModal(st)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[10px] transition-colors cursor-pointer"
                        >
                          ریز بدهی
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 7: حق عضویت صندوق */}
      {activeTab === 'fund_contribution' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800">حق عضویت و پس‌انداز ماهانه در صندوق قرض‌الحسنه</h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                <tr>
                  <th className="p-3">ردیف</th>
                  <th className="p-3">نام طلبه</th>
                  <th className="p-3">پایه</th>
                  <th className="p-3 text-center">عضو صندوق؟</th>
                  <th className="p-3 text-left">مبلغ پس‌انداز ماهانه</th>
                  <th className="p-3 text-left">شماره حساب پس‌انداز</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((st, idx) => {
                  const prof = profileMap.get(st.id);
                  const amount = prof?.fundContributionMonthly ?? prof?.fundContribution ?? 0;
                  const isMember = amount > 0;

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-900">{st.name}</td>
                      <td className="p-3 text-slate-600">{st.grade || '-'}</td>
                      <td className="p-3 text-center">
                        {isMember ? (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-bold text-[10px]">بله</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md font-bold text-[10px]">خیر</span>
                        )}
                      </td>
                      <td className="p-3 text-left font-mono font-bold text-indigo-700">
                        {isMember ? `${amount.toLocaleString('fa-IR')} تومان` : '۰'}
                      </td>
                      <td className="p-3 text-left font-mono text-slate-600">
                        {prof?.bankAccount || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 8: اقساط وام‌ها */}
      {activeTab === 'loans' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800">اقساط وام‌های فعال صندوق قرض‌الحسنه طلاب</h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                <tr>
                  <th className="p-3">ردیف</th>
                  <th className="p-3">نام طلبه</th>
                  <th className="p-3">پایه</th>
                  <th className="p-3">عنوان وام</th>
                  <th className="p-3 text-left">مبلغ هر قسط</th>
                  <th className="p-3 text-left">مانده کل وام</th>
                  <th className="p-3 text-center">اقساط باقیمانده</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((st, idx) => {
                  const studentLoans = loans.filter((l: any) => l.studentId === st.id && (l.remainingBalance || 0) > 0);
                  const totalLoanInstallment = studentLoans.reduce((a: number, b: any) => a + (b.monthlyInstallment || 0), 0);
                  const totalLoanBalance = studentLoans.reduce((a: number, b: any) => a + (b.remainingBalance || 0), 0);

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-900">{st.name}</td>
                      <td className="p-3 text-slate-600">{st.grade || '-'}</td>
                      <td className="p-3">
                        {studentLoans.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {studentLoans.map((l: any) => (
                              <span key={l.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px]">
                                {l.title || 'وام صندوق'}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">فاقد وام فعال</span>
                        )}
                      </td>
                      <td className="p-3 text-left font-mono font-bold text-slate-800">
                        {totalLoanInstallment.toLocaleString('fa-IR')} تومان
                      </td>
                      <td className="p-3 text-left font-mono font-bold text-rose-600">
                        {totalLoanBalance.toLocaleString('fa-IR')} تومان
                      </td>
                      <td className="p-3 text-center font-mono text-slate-600">
                        {studentLoans.length > 0 ? studentLoans[0].remainingInstallmentsCount || 1 : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 9: پاداش و جرایم دستی */}
      {activeTab === 'manual_adjustments' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800">اصلاحات، پاداش‌ها و جرایم موردی دستی برای این دوره</h4>
            <span className="text-[11px] text-slate-500">می‌توانید مبالغ تشویقی یا کسورات خاص را مستقیم ویرایش کنید</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                <tr>
                  <th className="p-3">ردیف</th>
                  <th className="p-3">نام طلبه</th>
                  <th className="p-3">پایه</th>
                  <th className="p-3">مبلغ اصلاحیه (تومان، مثبت=پاداش، منفی=جریمه)</th>
                  <th className="p-3">علت یا شرح اصلاحیه</th>
                  <th className="p-3 text-center">پاداش مازاد مطالعه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((st, idx) => {
                  const override = studentOverrides[st.id] || {};
                  const amount = override.manualAdjustmentAmount ?? 0;
                  const reason = override.manualAdjustmentReason ?? '';

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-900">{st.name}</td>
                      <td className="p-3 text-slate-600">{st.grade || '-'}</td>
                      <td className="p-3">
                        <input
                          type="number"
                          placeholder="0"
                          value={amount || ''}
                          onChange={(e) => {
                            const val = e.target.value ? Number(e.target.value) : 0;
                            setStudentOverrides(prev => ({
                              ...prev,
                              [st.id]: {
                                ...prev[st.id],
                                manualAdjustmentAmount: val
                              }
                            }));
                          }}
                          className="w-36 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          placeholder="علت پاداش یا جریمه..."
                          value={reason}
                          onChange={(e) => {
                            const text = e.target.value;
                            setStudentOverrides(prev => ({
                              ...prev,
                              [st.id]: {
                                ...prev[st.id],
                                manualAdjustmentReason: text
                              }
                            }));
                          }}
                          className="w-full max-w-xs px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          placeholder="پاداش مطالعه"
                          value={override.overrideStudyBonus ?? ''}
                          onChange={(e) => {
                            const val = e.target.value ? Number(e.target.value) : undefined;
                            setStudentOverrides(prev => ({
                              ...prev,
                              [st.id]: {
                                ...prev[st.id],
                                overrideStudyBonus: val
                              }
                            }));
                          }}
                          className="w-28 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono text-center focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityInfoTabbedView;
