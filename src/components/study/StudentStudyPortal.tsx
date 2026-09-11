import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, 
  BookOpen, 
  MessageSquare, 
  Calculator, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  Unlock, 
  ShieldCheck, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Award, 
  Calendar, 
  Layers, 
  Info, 
  ArrowUpRight, 
  ArrowDownRight, 
  Save, 
  RefreshCw, 
  Sparkles,
  HelpCircle,
  BarChart2,
  Check,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend, 
  ReferenceLine 
} from 'recharts';
import { Student, StudyPeriod, PeriodicStudyLog } from '../../types';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import { 
  getLogMetrics, 
  calculatePeriodAverages, 
  isPeriodClosed, 
  isStudentExempt, 
  formatMinutesToHoursAndMinutes 
} from './studyUtils';

interface StudentStudyPortalProps {
  student: Student;
  periods: StudyPeriod[];
  allLogs: PeriodicStudyLog[];
  allStudents?: Student[];
  onRefresh?: () => void;
}

export default function StudentStudyPortal({
  student,
  periods,
  allLogs,
  allStudents = [],
  onRefresh
}: StudentStudyPortalProps) {
  const { currentUser } = useAuth();

  // Selected period for registration
  const [activePeriodId, setActivePeriodId] = useState<string>(() => {
    // Default to the first open period, or the latest period
    const openP = periods.find(p => !isPeriodClosed(p) && !isStudentExempt(p, student));
    return openP?.id || periods[0]?.id || '';
  });

  // Entry inputs (in hours, e.g. "12.5" or "8")
  const [studyHoursInput, setStudyHoursInput] = useState<string>('');
  const [discussionHoursInput, setDiscussionHoursInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string>('');
  const [chartViewMode, setChartViewMode] = useState<'TOTAL' | 'SPLIT' | 'DIFF'>('TOTAL');

  // Find active period object
  const currentPeriod = useMemo(() => {
    return periods.find(p => p.id === activePeriodId) || periods[0] || null;
  }, [periods, activePeriodId]);

  // Find existing log for the current student & active period
  const currentPeriodLog = useMemo(() => {
    if (!currentPeriod) return null;
    return allLogs.find(l => l.studentId === student.id && l.periodId === currentPeriod.id) || null;
  }, [allLogs, student.id, currentPeriod]);

  // Sync inputs whenever active period or currentPeriodLog changes
  useEffect(() => {
    if (currentPeriodLog) {
      const sHours = currentPeriodLog.studyHours !== undefined 
        ? currentPeriodLog.studyHours 
        : (currentPeriodLog.hours || 0);
      const dHours = currentPeriodLog.discussionHours !== undefined 
        ? currentPeriodLog.discussionHours 
        : 0;

      setStudyHoursInput(sHours > 0 ? sHours.toString() : '');
      setDiscussionHoursInput(dHours > 0 ? dHours.toString() : '');
    } else {
      setStudyHoursInput('');
      setDiscussionHoursInput('');
    }
    setSaveSuccessMessage('');
  }, [activePeriodId, currentPeriodLog]);

  // Calculated numbers for current form inputs
  const parsedStudyHours = Math.max(0, parseFloat(studyHoursInput) || 0);
  const parsedDiscussionHours = Math.max(0, parseFloat(discussionHoursInput) || 0);
  const calculatedTotalHours = Math.round((parsedStudyHours + parsedDiscussionHours) * 100) / 100;
  const calculatedTotalMinutes = Math.round(calculatedTotalHours * 60);

  const isCurrentPeriodClosed = isPeriodClosed(currentPeriod);
  const isCurrentStudentExempt = isStudentExempt(currentPeriod, student, currentPeriodLog);

  // Can the student edit? (Level 1/2 can always edit; Level 3 only if not closed and not exempt)
  const isReadOnlyForUser = currentUser?.level === 3 && (isCurrentPeriodClosed || isCurrentStudentExempt);

  // Handle Save
  const handleSaveHours = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPeriod || isReadOnlyForUser) return;

    setIsSaving(true);
    try {
      const sHours = parsedStudyHours;
      const dHours = parsedDiscussionHours;
      const totHours = calculatedTotalHours;

      if (currentPeriodLog) {
        if (totHours > 0) {
          await localDb.updateDoc('periodic_study_logs', currentPeriodLog.id, {
            hours: totHours,
            studyHours: sHours,
            discussionHours: dHours,
            submittedBy: currentUser?.level === 3 ? 'student' : 'officer',
            lastModifiedAt: new Date().toISOString()
          });
        } else {
          await localDb.deleteDoc('periodic_study_logs', currentPeriodLog.id);
        }
      } else if (totHours > 0) {
        await localDb.addDoc('periodic_study_logs', {
          periodId: currentPeriod.id,
          studentId: student.id,
          hours: totHours,
          studyHours: sHours,
          discussionHours: dHours,
          submittedBy: currentUser?.level === 3 ? 'student' : 'officer',
          lastModifiedAt: new Date().toISOString()
        });
      }

      setSaveSuccessMessage('ساعات مطالعه و مباحثه شما با موفقیت در سامانه ثبت و بروزرسانی شد.');
      if (onRefresh) onRefresh();
      setTimeout(() => setSaveSuccessMessage(''), 4500);
    } catch (err) {
      console.error('Error saving student study log:', err);
      alert('خطا در ذخیره‌سازی ساعات مطالعه و مباحثه');
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------
  // Comprehensive Statistical Calculations for this Student
  // -------------------------------------------------------------
  const studentStatsSummary = useMemo(() => {
    const studentLogs = allLogs.filter(l => l.studentId === student.id);
    
    let totalRegisteredStudyHours = 0;
    let totalRegisteredDiscHours = 0;
    let totalRegisteredHours = 0;
    let totalMandatoryHours = 0;
    let fulfilledPeriodsCount = 0;
    let participatedPeriodsCount = 0;
    let totalWarningsCount = 0;

    const periodsData = periods.map(p => {
      const log = studentLogs.find(l => l.periodId === p.id);
      const m = getLogMetrics(log);
      const isExempt = isStudentExempt(p, student, log);
      const isClosed = isPeriodClosed(p);
      const pMandatoryHours = p.mandatoryHours || 0;
      const pMandatoryMinutes = Math.round(pMandatoryHours * 60);

      // Grade average for this period
      const gradePeers = allStudents.filter(s => s.grade === student.grade);
      const gradePeerIds = gradePeers.length > 0 ? gradePeers.map(s => s.id) : undefined;
      const gradeAvg = calculatePeriodAverages(p.id, allLogs, gradePeerIds);
      const schoolAvg = calculatePeriodAverages(p.id, allLogs);

      const effectiveAvgHours = gradeAvg.activeCount > 0 ? gradeAvg.totalAvgHours : schoolAvg.totalAvgHours;
      const effectiveAvgMinutes = gradeAvg.activeCount > 0 ? gradeAvg.totalAvgMinutes : schoolAvg.totalAvgMinutes;

      const diffMandatoryHours = Math.round((m.totalHours - pMandatoryHours) * 10) / 10;
      const diffMandatoryMinutes = m.totalMinutes - pMandatoryMinutes;
      const diffAvgHours = Math.round((m.totalHours - effectiveAvgHours) * 10) / 10;
      const diffAvgMinutes = m.totalMinutes - effectiveAvgMinutes;

      const hasRegistered = m.totalMinutes > 0;
      const isFulfilled = m.totalMinutes >= pMandatoryMinutes && pMandatoryMinutes > 0;

      if (hasRegistered) {
        participatedPeriodsCount++;
        totalRegisteredStudyHours += m.studyHours;
        totalRegisteredDiscHours += m.discussionHours;
        totalRegisteredHours += m.totalHours;
      }

      if (!isExempt) {
        totalMandatoryHours += pMandatoryHours;
        if (isFulfilled) {
          fulfilledPeriodsCount++;
        }
      }

      const warnings = log?.warningsCount || 0;
      totalWarningsCount += warnings;

      return {
        period: p,
        log,
        metrics: m,
        isExempt,
        isClosed,
        mandatoryHours: pMandatoryHours,
        mandatoryMinutes: pMandatoryMinutes,
        avgHours: effectiveAvgHours,
        avgMinutes: effectiveAvgMinutes,
        diffMandatoryHours,
        diffMandatoryMinutes,
        diffAvgHours,
        diffAvgMinutes,
        hasRegistered,
        isFulfilled,
        warnings
      };
    });

    const totalPeriodsCount = periods.length;
    const participationRate = totalPeriodsCount > 0 ? Math.round((participatedPeriodsCount / totalPeriodsCount) * 100) : 0;
    const overallDutyDiffHours = Math.round((totalRegisteredHours - totalMandatoryHours) * 10) / 10;
    const overallDutyDiffMinutes = Math.round((totalRegisteredHours - totalMandatoryHours) * 60);

    // Calculate Growth/Decline over past 3 periods
    let growthRate: number | null = null;
    if (periodsData.length >= 2) {
      // Look at chronological order (oldest to newest)
      const sortedChronological = [...periodsData].sort((a, b) => new Date(a.period.startDate).getTime() - new Date(b.period.startDate).getTime());
      const recent3 = sortedChronological.slice(-3);
      if (recent3.length >= 2) {
        const firstOfRecent = recent3[0].metrics.totalHours;
        const lastOfRecent = recent3[recent3.length - 1].metrics.totalHours;
        if (firstOfRecent > 0) {
          growthRate = Math.round(((lastOfRecent - firstOfRecent) / firstOfRecent) * 100);
        } else if (lastOfRecent > 0) {
          growthRate = 100;
        } else {
          growthRate = 0;
        }
      }
    }

    return {
      totalRegisteredHours: Math.round(totalRegisteredHours * 10) / 10,
      totalRegisteredStudyHours: Math.round(totalRegisteredStudyHours * 10) / 10,
      totalRegisteredDiscHours: Math.round(totalRegisteredDiscHours * 10) / 10,
      totalMandatoryHours: Math.round(totalMandatoryHours * 10) / 10,
      overallDutyDiffHours,
      overallDutyDiffMinutes,
      participatedPeriodsCount,
      totalPeriodsCount,
      participationRate,
      fulfilledPeriodsCount,
      totalWarningsCount,
      growthRate,
      periodsData
    };
  }, [allLogs, student, periods, allStudents]);

  // Chart Data Preparation (Chronological)
  const chartData = useMemo(() => {
    const list = [...studentStatsSummary.periodsData].sort((a, b) => 
      new Date(a.period.startDate).getTime() - new Date(b.period.startDate).getTime()
    );

    return list.map(item => ({
      name: item.period.title,
      totalHours: item.metrics.totalHours,
      studyHours: item.metrics.studyHours,
      discussionHours: item.metrics.discussionHours,
      mandatoryHours: item.mandatoryHours,
      avgHours: Math.round(item.avgHours * 10) / 10,
      diffMandatoryHours: item.diffMandatoryHours,
      isFulfilled: item.isFulfilled
    }));
  }, [studentStatsSummary.periodsData]);

  return (
    <div className="space-y-6 text-right font-vazir" dir="rtl">
      {/* Top Student Welcome & Overview Card */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-100 shrink-0">
              {student.name ? student.name[0] : 'ط'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-slate-900">{student.name}</h2>
                {student.grade && (
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs border border-indigo-100">
                    {student.grade}
                  </span>
                )}
                {student.nationalId && (
                  <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                    کد ملی: {student.nationalId}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                سامانه ثبت مستقل ساعات مطالعه، مباحثه و ارزیابی تراز عملکرد و موظفی تحصیلی
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-2.5 flex items-center gap-3">
              <Clock size={18} className="text-indigo-600" />
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 block">کل ساعت کارکرد</span>
                <span className="text-sm font-black text-slate-800">
                  {studentStatsSummary.totalRegisteredHours.toLocaleString('fa-IR')} ساعت
                </span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-2.5 flex items-center gap-3">
              <Target size={18} className="text-emerald-600" />
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 block">نرخ مشارکت</span>
                <span className="text-sm font-black text-slate-800">
                  {studentStatsSummary.participationRate}٪ ({studentStatsSummary.participatedPeriodsCount} از {studentStatsSummary.totalPeriodsCount})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Card 1: Total Hours Split */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold">مجموع ساعات</span>
            <Calculator size={16} className="text-indigo-600" />
          </div>
          <div className="text-lg font-black text-slate-900">
            {studentStatsSummary.totalRegisteredHours.toLocaleString('fa-IR')} <span className="text-xs font-normal text-slate-500">ساعت</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">
            مطالعه: {studentStatsSummary.totalRegisteredStudyHours}س • مباحثه: {studentStatsSummary.totalRegisteredDiscHours}س
          </p>
        </div>

        {/* Card 2: Duty Fulfillment Status */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold">وضعیت موظفی</span>
            <Target size={16} className="text-emerald-600" />
          </div>
          <div className={cn(
            "text-lg font-black flex items-center gap-1",
            studentStatsSummary.overallDutyDiffMinutes >= 0 ? "text-emerald-600" : "text-rose-600"
          )}>
            <span>
              {studentStatsSummary.overallDutyDiffHours > 0 ? '+' : ''}
              {studentStatsSummary.overallDutyDiffHours.toLocaleString('fa-IR')}
            </span>
            <span className="text-xs font-normal">ساعت</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium truncate">
            {studentStatsSummary.overallDutyDiffMinutes >= 0 ? 'تکمیل موظفی دوره‌ها' : 'کسری کلی از موظفی'}
          </p>
        </div>

        {/* Card 3: Participated Periods */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold">تعهد به ثبت</span>
            <CheckCircle2 size={16} className="text-sky-600" />
          </div>
          <div className="text-lg font-black text-slate-900">
            {studentStatsSummary.participationRate}٪
          </div>
          <p className="text-[10px] text-slate-400 font-medium truncate">
            {studentStatsSummary.participatedPeriodsCount} دوره ثبت‌شده
          </p>
        </div>

        {/* Card 4: Fulfilled Count */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold">دوره‌های موفق</span>
            <Award size={16} className="text-amber-600" />
          </div>
          <div className="text-lg font-black text-slate-900">
            {studentStatsSummary.fulfilledPeriodsCount} <span className="text-xs font-normal text-slate-400">دوره</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium truncate">
            رسیدن به سقف موظفی
          </p>
        </div>

        {/* Card 5: Growth / Trend */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold">رشد (۳ دوره اخیر)</span>
            {studentStatsSummary.growthRate !== null && studentStatsSummary.growthRate >= 0 ? (
              <TrendingUp size={16} className="text-emerald-600" />
            ) : (
              <TrendingDown size={16} className="text-rose-600" />
            )}
          </div>
          <div className={cn(
            "text-lg font-black",
            studentStatsSummary.growthRate !== null && studentStatsSummary.growthRate >= 0 ? "text-emerald-600" : "text-rose-600"
          )}>
            {studentStatsSummary.growthRate !== null ? (
              `${studentStatsSummary.growthRate > 0 ? '+' : ''}${studentStatsSummary.growthRate}٪`
            ) : (
              '---'
            )}
          </div>
          <p className="text-[10px] text-slate-400 font-medium truncate">
            {studentStatsSummary.growthRate !== null && studentStatsSummary.growthRate >= 0 ? 'روند صعودی' : 'روند نزولی'}
          </p>
        </div>

        {/* Card 6: Warnings Count */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold">اخطارهای سامانه</span>
            <AlertTriangle size={16} className={studentStatsSummary.totalWarningsCount > 0 ? "text-rose-600" : "text-slate-400"} />
          </div>
          <div className={cn(
            "text-lg font-black",
            studentStatsSummary.totalWarningsCount > 0 ? "text-rose-600" : "text-slate-900"
          )}>
            {studentStatsSummary.totalWarningsCount} <span className="text-xs font-normal text-slate-400">مورد</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium truncate">
            {studentStatsSummary.totalWarningsCount === 0 ? 'فاقد اخطار انضباطی' : 'نیاز به پیگیری آموزشی'}
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN REGISTRATION FORM (باکس مطالعه، باکس مباحثه و محاسبه اتوماتیک مجموع) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-indigo-600 animate-pulse" />
              <h3 className="text-base font-black text-slate-900">فرم ثبت ساعت مطالعه و مباحثه</h3>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              لطفاً ساعات مطالعه و مباحثه خود را در کادرهای زیر وارد کنید؛ مجموع به‌طور خودکار محاسبه و ثبت می‌شود.
            </p>
          </div>

          {/* Period Selection Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 shrink-0">دوره انتخابی:</span>
            <select
              value={activePeriodId}
              onChange={(e) => setActivePeriodId(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer min-w-[200px]"
            >
              {periods.map(p => {
                const closed = isPeriodClosed(p);
                const exempt = isStudentExempt(p, student);
                return (
                  <option key={p.id} value={p.id}>
                    {p.title} {closed ? '(🔒 بسته شده)' : exempt ? '(🛡️ معاف)' : '(🟢 باز)'}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {currentPeriod ? (
          <form onSubmit={handleSaveHours} className="space-y-6">
            {/* Period Info Banner */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Calendar size={18} className="text-indigo-600 shrink-0" />
                <div>
                  <span className="font-black text-slate-900">{currentPeriod.title}</span>
                  <span className="text-slate-400 mr-2">
                    (بازه: {currentPeriod.startDate ? new Date(currentPeriod.startDate).toLocaleDateString('fa-IR') : '---'} تا {currentPeriod.endDate ? new Date(currentPeriod.endDate).toLocaleDateString('fa-IR') : '---'})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 shadow-2xs">
                  موظفی دوره: <span className="text-indigo-600 font-black">{currentPeriod.mandatoryHours || 0} ساعت</span> ({Math.round((currentPeriod.mandatoryHours || 0) * 60)} دقیقه)
                </span>

                {isCurrentStudentExempt ? (
                  <span className="px-3 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-xl font-black flex items-center gap-1">
                    <ShieldCheck size={14} />
                    شما از این دوره معاف شده‌اید
                  </span>
                ) : isCurrentPeriodClosed ? (
                  <span className="px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-black flex items-center gap-1">
                    <Lock size={14} />
                    مهلت ثبت به پایان رسیده (بسته شده)
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-black flex items-center gap-1">
                    <Unlock size={14} />
                    امکان ثبت و ویرایش فعال است
                  </span>
                )}
              </div>
            </div>

            {/* The 3 Core Entry Boxes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Box 1: Study Hours */}
              <div className="bg-indigo-50/50 border-2 border-indigo-200/80 rounded-2xl p-4 space-y-2 relative transition-all focus-within:border-indigo-500 focus-within:bg-indigo-50/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                    <BookOpen size={16} className="text-indigo-600" />
                    <span>۱. ساعت مطالعه</span>
                  </label>
                  <span className="text-[10px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded-full border border-indigo-100">
                    باکس اول
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="300"
                    disabled={isReadOnlyForUser}
                    value={studyHoursInput}
                    onChange={(e) => setStudyHoursInput(e.target.value)}
                    placeholder="مثلاً 14 یا 14.5"
                    className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl text-slate-900 font-black text-base outline-none focus:ring-2 focus:ring-indigo-500 transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                  />
                  <span className="absolute left-3 top-3.5 text-xs font-bold text-slate-400 pointer-events-none">
                    ساعت
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  {parsedStudyHours > 0 ? `معادل ${Math.round(parsedStudyHours * 60)} دقیقه مطالعه فردی` : 'ساعت مطالعه انفرادی را وارد کنید'}
                </div>
              </div>

              {/* Box 2: Discussion Hours */}
              <div className="bg-emerald-50/50 border-2 border-emerald-200/80 rounded-2xl p-4 space-y-2 relative transition-all focus-within:border-emerald-500 focus-within:bg-emerald-50/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                    <MessageSquare size={16} className="text-emerald-600" />
                    <span>۲. ساعت مباحثه</span>
                  </label>
                  <span className="text-[10px] font-bold text-emerald-600 bg-white px-2 py-0.5 rounded-full border border-emerald-100">
                    باکس دوم
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="300"
                    disabled={isReadOnlyForUser}
                    value={discussionHoursInput}
                    onChange={(e) => setDiscussionHoursInput(e.target.value)}
                    placeholder="مثلاً 8 یا 8.5"
                    className="w-full px-4 py-3 bg-white border border-emerald-200 rounded-xl text-slate-900 font-black text-base outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                  />
                  <span className="absolute left-3 top-3.5 text-xs font-bold text-slate-400 pointer-events-none">
                    ساعت
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  {parsedDiscussionHours > 0 ? `معادل ${Math.round(parsedDiscussionHours * 60)} دقیقه مباحثه گروهی` : 'ساعت مباحثه با هم‌بحث را وارد کنید'}
                </div>
              </div>

              {/* Box 3: Automatic Total Hours (سیستم به طور اتومات مجموع رو در باکس سوم نشون میده) */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4 space-y-2 relative shadow-md">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                    <Calculator size={16} className="text-amber-400" />
                    <span>۳. مجموع کل (محاسبه خودکار)</span>
                  </label>
                  <span className="text-[10px] font-black bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30">
                    اتوماتیک
                  </span>
                </div>
                <div className="px-4 py-3 bg-white/10 rounded-xl flex items-center justify-between border border-white/10">
                  <span className="text-2xl font-black text-white">
                    {calculatedTotalHours.toLocaleString('fa-IR')}
                  </span>
                  <span className="text-xs font-bold text-slate-300">ساعت</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span>معادل {calculatedTotalMinutes.toLocaleString('fa-IR')} دقیقه</span>
                  {currentPeriod.mandatoryHours > 0 && (
                    <span className={cn(
                      "font-black text-xs",
                      calculatedTotalHours >= currentPeriod.mandatoryHours ? "text-emerald-400" : "text-rose-400"
                    )}>
                      {calculatedTotalHours >= currentPeriod.mandatoryHours 
                        ? `+${(calculatedTotalHours - currentPeriod.mandatoryHours).toFixed(1)} مازاد`
                        : `${(calculatedTotalHours - currentPeriod.mandatoryHours).toFixed(1)} کسری`}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Bar & Submit */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <Info size={16} className="text-indigo-600 shrink-0" />
                <span>
                  {isReadOnlyForUser
                    ? 'این دوره قفل شده است و امکان ویرایش ساعات وجود ندارد.'
                    : 'شما می‌توانید تا زمان بسته شدن دوره توسط مسئول آموزش، هر زمان خواستید ساعت‌های ثبت‌شده را تغییر دهید.'}
                </span>
              </div>

              {!isReadOnlyForUser && (
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>{currentPeriodLog ? 'بروزرسانی و ثبت تغییرات' : 'تأیید و ثبت نهایی ساعت‌ها'}</span>
                </button>
              )}
            </div>

            {/* Success Toast / Alert */}
            <AnimatePresence>
              {saveSuccessMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-black flex items-center gap-2.5 shadow-sm"
                >
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                  <span>{saveSuccessMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            هیچ دوره‌ای در سیستم یافت نشد.
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* BREAKDOWN TABLE ACROSS ALL PERIODS (تفکیک شده و تجمیعی برای طلبه) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900">جدول سوابق و کارکرد تفکیکی در تمام دوره‌ها</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              وضعیت انجام موظفی، کسر از موظفی، و مقایسه با میانگین در هر یک از دوره‌ها
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              تعداد دوره‌ها: {studentStatsSummary.totalPeriodsCount}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-black border-y border-slate-200/80">
                <th className="py-3 px-3">ردیف</th>
                <th className="py-3 px-3">عنوان دوره مطالعاتی</th>
                <th className="py-3 px-3">بازه زمانی</th>
                <th className="py-3 px-3 text-center">ساعت مطالعه</th>
                <th className="py-3 px-3 text-center">ساعت مباحثه</th>
                <th className="py-3 px-3 text-center">مجموع ساعات</th>
                <th className="py-3 px-3 text-center">ساعت موظفی</th>
                <th className="py-3 px-3 text-center">کسر / مازاد موظفی</th>
                <th className="py-3 px-3 text-center">نسبت به میانگین</th>
                <th className="py-3 px-3 text-center">وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {studentStatsSummary.periodsData.map((item, idx) => {
                const isSelected = item.period.id === activePeriodId;
                return (
                  <tr 
                    key={item.period.id}
                    onClick={() => setActivePeriodId(item.period.id)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      isSelected ? "bg-indigo-50/70 font-bold" : "hover:bg-slate-50/80"
                    )}
                  >
                    <td className="py-3.5 px-3 text-slate-400 font-bold">{idx + 1}</td>
                    <td className="py-3.5 px-3 font-bold text-slate-800">
                      <div className="flex items-center gap-1.5">
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                        <span>{item.period.title}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-slate-500 text-[11px]">
                      {item.period.startDate ? new Date(item.period.startDate).toLocaleDateString('fa-IR') : '---'} تا {item.period.endDate ? new Date(item.period.endDate).toLocaleDateString('fa-IR') : '---'}
                    </td>
                    <td className="py-3.5 px-3 text-center font-bold text-indigo-700 bg-indigo-50/30">
                      {item.metrics.studyHours > 0 ? `${item.metrics.studyHours} س` : <span className="text-slate-300">۰</span>}
                    </td>
                    <td className="py-3.5 px-3 text-center font-bold text-emerald-700 bg-emerald-50/30">
                      {item.metrics.discussionHours > 0 ? `${item.metrics.discussionHours} س` : <span className="text-slate-300">۰</span>}
                    </td>
                    <td className="py-3.5 px-3 text-center font-black text-slate-900 bg-slate-50">
                      {item.metrics.totalHours > 0 ? `${item.metrics.totalHours} س` : <span className="text-slate-300">۰</span>}
                    </td>
                    <td className="py-3.5 px-3 text-center text-slate-700 font-bold">
                      {item.mandatoryHours > 0 ? `${item.mandatoryHours} س` : '---'}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      {item.isExempt ? (
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">معاف</span>
                      ) : item.metrics.totalHours > 0 && item.mandatoryHours > 0 ? (
                        <span className={cn(
                          "font-bold text-[11px] inline-flex items-center gap-0.5",
                          item.diffMandatoryHours >= 0 ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {item.diffMandatoryHours > 0 ? '+' : ''}{item.diffMandatoryHours} س
                          {item.diffMandatoryHours >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                        </span>
                      ) : (
                        <span className="text-slate-300">---</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      {item.metrics.totalHours > 0 ? (
                        <span className={cn(
                          "text-[11px] font-bold",
                          item.diffAvgHours >= 0 ? "text-emerald-600" : "text-amber-600"
                        )}>
                          {item.diffAvgHours > 0 ? '+' : ''}{item.diffAvgHours} س
                        </span>
                      ) : (
                        <span className="text-slate-300">---</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      {item.isExempt ? (
                        <span className="text-[10px] bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full font-black border border-purple-100">
                          معاف
                        </span>
                      ) : item.isFulfilled ? (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-black border border-emerald-100">
                          تکمیل موظفی
                        </span>
                      ) : item.metrics.totalHours === 0 ? (
                        <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-bold">
                          ثبت نشده
                        </span>
                      ) : (
                        <span className="text-[10px] bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full font-black border border-rose-100">
                          کسری موظفی
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COMPARATIVE CHARTS & VISUAL ANALYTICS (نمودار مقایسه‌ای موظفی، میانگین و نوسانات) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <BarChart2 size={18} className="text-indigo-600" />
              <h3 className="text-base font-black text-slate-900">نمودار مقایسه‌ای عملکرد تحصیلی و نوسانات</h3>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              مقایسه ساعت ثبت‌شده دانشجو نسبت به خط موظفی، میانگین مدرسه و نمایش رشد و افت دوره‌ها
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setChartViewMode('TOTAL')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                chartViewMode === 'TOTAL' ? "bg-white text-indigo-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              مجموع و موظفی
            </button>
            <button
              type="button"
              onClick={() => setChartViewMode('SPLIT')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                chartViewMode === 'SPLIT' ? "bg-white text-indigo-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              تفکیک مطالعه و مباحثه
            </button>
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="h-80 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            {chartViewMode === 'TOTAL' ? (
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  dy={10} 
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  unit=" س" 
                  dx={-10} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    borderRadius: '16px', 
                    border: '1px solid #e2e8f0', 
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                    direction: 'rtl',
                    textAlign: 'right',
                    fontSize: '12px'
                  }}
                  formatter={(val: any, name: string) => {
                    const labelMap: Record<string, string> = {
                      totalHours: 'مجموع ساعت ثبت‌شده',
                      mandatoryHours: 'ساعت موظفی دوره',
                      avgHours: 'میانگین هم‌پایه‌ای‌ها'
                    };
                    return [`${val} ساعت`, labelMap[name] || name];
                  }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  formatter={(val) => {
                    const map: Record<string, string> = {
                      totalHours: 'مجموع ساعت شما',
                      mandatoryHours: 'خط موظفی دوره',
                      avgHours: 'میانگین پایه'
                    };
                    return <span className="text-xs font-bold text-slate-700">{map[val] || val}</span>;
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="totalHours" 
                  stroke="#4f46e5" 
                  strokeWidth={3} 
                  dot={{ r: 6, fill: '#4f46e5' }} 
                  activeDot={{ r: 8 }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="mandatoryHours" 
                  stroke="#10b981" 
                  strokeWidth={2} 
                  strokeDasharray="5 5" 
                  dot={{ r: 4, fill: '#10b981' }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="avgHours" 
                  stroke="#f59e0b" 
                  strokeWidth={2} 
                  strokeDasharray="3 3" 
                  dot={{ r: 3, fill: '#f59e0b' }} 
                />
              </LineChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  dy={10} 
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  unit=" س" 
                  dx={-10} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    borderRadius: '16px', 
                    border: '1px solid #e2e8f0', 
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                    direction: 'rtl',
                    textAlign: 'right',
                    fontSize: '12px'
                  }}
                  formatter={(val: any, name: string) => {
                    const labelMap: Record<string, string> = {
                      studyHours: 'ساعت مطالعه انفرادی',
                      discussionHours: 'ساعت مباحثه با هم‌بحث',
                      mandatoryHours: 'موظفی دوره'
                    };
                    return [`${val} ساعت`, labelMap[name] || name];
                  }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  formatter={(val) => {
                    const map: Record<string, string> = {
                      studyHours: 'ساعت مطالعه',
                      discussionHours: 'ساعت مباحثه',
                      mandatoryHours: 'ساعت موظفی'
                    };
                    return <span className="text-xs font-bold text-slate-700">{map[val] || val}</span>;
                  }}
                />
                <Bar dataKey="studyHours" fill="#6366f1" radius={[8, 8, 0, 0]} />
                <Bar dataKey="discussionHours" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
