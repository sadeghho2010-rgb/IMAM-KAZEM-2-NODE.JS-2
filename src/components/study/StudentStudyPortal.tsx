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
  Save, 
  RefreshCw, 
  Sparkles,
  BarChart2,
  Check,
  X,
  Plus,
  Trash2,
  Edit,
  History,
  FileSpreadsheet,
  Info,
  ArrowUpRight,
  ArrowDownRight
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
  Legend 
} from 'recharts';
import { Student, StudyPeriod, PeriodicStudyLog, StudyDailyEntry } from '../../types';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import { 
  getLogMetrics, 
  calculatePeriodAverages, 
  isPeriodClosed, 
  isStudentExempt, 
  formatMinutesToHoursAndMinutes,
  addStudyDailyEntry,
  updateStudyDailyEntry,
  deleteStudyDailyEntry
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

  // Top Student Sub-Tab State: 'daily_entry' (ثبت کارکرد روزانه) | 'stats_reports' (آمار و گزارشات جامع)
  const [activeSubTab, setActiveSubTab] = useState<'daily_entry' | 'stats_reports'>('daily_entry');

  // Selected period for daily registration
  const [activePeriodId, setActivePeriodId] = useState<string>(() => {
    const openP = periods.find(p => !isPeriodClosed(p) && !isStudentExempt(p, student));
    return openP?.id || periods[0]?.id || '';
  });

  // Daily entries list state
  const [dailyEntries, setDailyEntries] = useState<StudyDailyEntry[]>([]);

  // Entry inputs (in hours, e.g. "2" or "1.5")
  const [studyHoursInput, setStudyHoursInput] = useState<string>('');
  const [discussionHoursInput, setDiscussionHoursInput] = useState<string>('');
  const [entryNoteInput, setEntryNoteInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string>('');

  // Editing state for an existing daily entry
  const [editingEntry, setEditingEntry] = useState<StudyDailyEntry | null>(null);
  const [editStudyHours, setEditStudyHours] = useState<string>('');
  const [editDiscussionHours, setEditDiscussionHours] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');
  const [isUpdatingEntry, setIsUpdatingEntry] = useState<boolean>(false);

  const [chartViewMode, setChartViewMode] = useState<'TOTAL' | 'SPLIT'>('TOTAL');

  // Active period object
  const currentPeriod = useMemo(() => {
    return periods.find(p => p.id === activePeriodId) || periods[0] || null;
  }, [periods, activePeriodId]);

  // Load daily entries for this student & active period
  const loadDailyEntries = async () => {
    try {
      const allDaily = await localDb.getDocs<StudyDailyEntry>('study_daily_entries');
      const filtered = allDaily.filter(e => e.studentId === student.id && e.periodId === activePeriodId);
      // Sort newest first
      const sorted = filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setDailyEntries(sorted);
    } catch (err) {
      console.warn('Error loading daily entries:', err);
    }
  };

  useEffect(() => {
    if (activePeriodId) {
      loadDailyEntries();
    }
  }, [activePeriodId, student.id]);

  // Real-time synchronization for daily entries & logs across panels
  useEffect(() => {
    const handleDataChange = () => {
      loadDailyEntries();
      if (onRefresh) onRefresh();
    };

    const unsub = localDb.subscribe(handleDataChange);
    window.addEventListener('app_data_change', handleDataChange);
    return () => {
      unsub();
      window.removeEventListener('app_data_change', handleDataChange);
    };
  }, [activePeriodId, student.id]);

  // Find existing aggregated log for current student & active period
  const currentPeriodLog = useMemo(() => {
    if (!currentPeriod) return null;
    return allLogs.find(l => l.studentId === student.id && l.periodId === currentPeriod.id) || null;
  }, [allLogs, student.id, currentPeriod]);

  // Parsed input numbers
  const parsedStudyHours = Math.max(0, parseFloat(studyHoursInput) || 0);
  const parsedDiscussionHours = Math.max(0, parseFloat(discussionHoursInput) || 0);
  const calculatedTotalHours = Math.round((parsedStudyHours + parsedDiscussionHours) * 100) / 100;
  const calculatedTotalMinutes = Math.round(calculatedTotalHours * 60);

  const isCurrentPeriodClosed = isPeriodClosed(currentPeriod);
  const isCurrentStudentExempt = isStudentExempt(currentPeriod, student, currentPeriodLog);

  // Can the student edit? (Level 1/2 can always edit; Level 3 only if not closed and not exempt)
  const isReadOnlyForUser = currentUser?.level === 3 && (isCurrentPeriodClosed || isCurrentStudentExempt);

  // Quick preset hour addition helpers
  const handleQuickAddStudy = (amountHours: number) => {
    if (isReadOnlyForUser) return;
    const currentVal = parseFloat(studyHoursInput) || 0;
    const newVal = Math.round((currentVal + amountHours) * 10) / 10;
    setStudyHoursInput(newVal.toString());
  };

  const handleQuickAddDiscussion = (amountHours: number) => {
    if (isReadOnlyForUser) return;
    const currentVal = parseFloat(discussionHoursInput) || 0;
    const newVal = Math.round((currentVal + amountHours) * 10) / 10;
    setDiscussionHoursInput(newVal.toString());
  };

  // Handle Cumulative Submission (اصلاح ۱ و ۲ و ۹)
  const handleSaveHours = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPeriod || isReadOnlyForUser) return;
    if (parsedStudyHours <= 0 && parsedDiscussionHours <= 0) {
      alert('لطفاً حداقل مقدار برای مطالعه یا مباحثه وارد نمایید.');
      return;
    }
    if (parsedStudyHours > 40 || parsedDiscussionHours > 40) {
      alert('سقف مقدار قابل ثبت در هر باکس حداکثر ۴۰ ساعت می‌باشد.');
      return;
    }

    setIsSaving(true);
    try {
      // Create new daily entry (Cumulative)
      await addStudyDailyEntry({
        periodId: currentPeriod.id,
        studentId: student.id,
        studyHours: parsedStudyHours,
        discussionHours: parsedDiscussionHours,
        submittedBy: currentUser?.level === 3 ? 'student' : 'officer',
        note: entryNoteInput.trim()
      });

      // Clear input boxes immediately after success (اصلاح ۲)
      setStudyHoursInput('');
      setDiscussionHoursInput('');
      setEntryNoteInput('');

      setSaveSuccessMessage('ساعات جدید با موفقیت ثبت شد و به مجموع کارکرد شما در این دوره افزوده گردید.');
      await loadDailyEntries();
      if (onRefresh) onRefresh();

      setTimeout(() => setSaveSuccessMessage(''), 4500);
    } catch (err) {
      console.error('Error adding study daily entry:', err);
      alert('خطا در ثبت ساعت مطالعه');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Editing an Entry
  const handleStartEditEntry = (entry: StudyDailyEntry) => {
    if (isReadOnlyForUser) return;
    setEditingEntry(entry);
    setEditStudyHours(entry.studyHours.toString());
    setEditDiscussionHours(entry.discussionHours.toString());
    setEditNote(entry.note || '');
  };

  const handleSaveEditEntry = async () => {
    if (!editingEntry || !currentPeriod) return;
    const sH = Math.max(0, parseFloat(editStudyHours) || 0);
    const dH = Math.max(0, parseFloat(editDiscussionHours) || 0);

    setIsUpdatingEntry(true);
    try {
      await updateStudyDailyEntry(
        editingEntry.id,
        { studyHours: sH, discussionHours: dH, note: editNote.trim() },
        currentPeriod.id,
        student.id,
        currentUser?.level === 3 ? 'student' : 'officer'
      );

      setEditingEntry(null);
      await loadDailyEntries();
      if (onRefresh) onRefresh();
      setSaveSuccessMessage('ثبت انتخابی با موفقیت ویرایش شد.');
      setTimeout(() => setSaveSuccessMessage(''), 3500);
    } catch (err) {
      console.error('Error updating entry:', err);
      alert('خطا در ویرایش ثبت');
    } finally {
      setIsUpdatingEntry(false);
    }
  };

  // Handle Deleting an Entry
  const handleDeleteEntry = async (entry: StudyDailyEntry) => {
    if (isReadOnlyForUser) return;
    if (!window.confirm(`آیا از حذف این ثبت (${entry.totalHours} ساعت) اطمینان دارید؟`)) return;

    try {
      await deleteStudyDailyEntry(
        entry.id,
        entry.periodId,
        student.id,
        currentUser?.level === 3 ? 'student' : 'officer'
      );
      await loadDailyEntries();
      if (onRefresh) onRefresh();
      setSaveSuccessMessage('ثبت مورد نظر با موفقیت حذف گردید.');
      setTimeout(() => setSaveSuccessMessage(''), 3500);
    } catch (err) {
      console.error('Error deleting entry:', err);
      alert('خطا در حذف ثبت');
    }
  };

  // Cumulative Totals for current active period
  const activePeriodTotals = useMemo(() => {
    const totalStudy = Math.round(dailyEntries.reduce((acc, e) => acc + (Number(e.studyHours) || 0), 0) * 10) / 10;
    const totalDisc = Math.round(dailyEntries.reduce((acc, e) => acc + (Number(e.discussionHours) || 0), 0) * 10) / 10;
    const totalSum = Math.round((totalStudy + totalDisc) * 10) / 10;
    const mandatory = currentPeriod?.mandatoryHours || 0;
    const diff = Math.round((totalSum - mandatory) * 10) / 10;

    return {
      totalStudy,
      totalDisc,
      totalSum,
      mandatory,
      diff,
      isFulfilled: totalSum >= mandatory && mandatory > 0
    };
  }, [dailyEntries, currentPeriod]);

  // Comprehensive Statistical Calculations across all periods
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

      const gradePeers = allStudents.filter(s => s.grade === student.grade);
      const gradePeerIds = gradePeers.length > 0 ? gradePeers.map(s => s.id) : undefined;
      const gradeAvg = calculatePeriodAverages(p.id, allLogs, gradePeerIds);
      const schoolAvg = calculatePeriodAverages(p.id, allLogs);

      const effectiveAvgHours = gradeAvg.activeCount > 0 ? gradeAvg.totalAvgHours : schoolAvg.totalAvgHours;
      const effectiveAvgMinutes = gradeAvg.activeCount > 0 ? gradeAvg.totalAvgMinutes : schoolAvg.totalAvgMinutes;

      const diffMandatoryHours = Math.round((m.totalHours - pMandatoryHours) * 10) / 10;
      const diffMandatoryMinutes = m.totalMinutes - pMandatoryMinutes;
      const diffAvgHours = Math.round((m.totalHours - effectiveAvgHours) * 10) / 10;

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
        hasRegistered,
        isFulfilled,
        warnings
      };
    });

    const totalPeriodsCount = periods.length;
    const participationRate = totalPeriodsCount > 0 ? Math.round((participatedPeriodsCount / totalPeriodsCount) * 100) : 0;
    const overallDutyDiffHours = Math.round((totalRegisteredHours - totalMandatoryHours) * 10) / 10;

    let growthRate: number | null = null;
    if (periodsData.length >= 2) {
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
      participatedPeriodsCount,
      totalPeriodsCount,
      participationRate,
      fulfilledPeriodsCount,
      totalWarningsCount,
      growthRate,
      periodsData
    };
  }, [allLogs, student, periods, allStudents]);

  // Chart Data
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
      {/* Top Student Welcome & Header Card */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center font-black text-xl shadow-lg shrink-0">
              {student.name ? student.name[0] : 'ط'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-white">{student.name}</h2>
                {student.grade && (
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-indigo-100 font-bold text-xs border border-white/20">
                    {student.grade}
                  </span>
                )}
              </div>
              <p className="text-xs text-indigo-200/90 font-medium mt-1">
                سامانه ثبت کارکرد روزانه مطالعه، مباحثه و ارزیابی تراز تحصیلی
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-white/10 border border-white/15 rounded-2xl px-4 py-2.5 flex items-center gap-3 shadow-inner">
              <Clock size={18} className="text-amber-400" />
              <div className="text-right">
                <span className="text-[10px] font-bold text-indigo-200 block">کل ساعت کارکرد</span>
                <span className="text-sm font-black text-white">
                  {studentStatsSummary.totalRegisteredHours.toLocaleString('fa-IR')} ساعت
                </span>
              </div>
            </div>

            <div className="bg-white/10 border border-white/15 rounded-2xl px-4 py-2.5 flex items-center gap-3 shadow-inner">
              <Target size={18} className="text-emerald-400" />
              <div className="text-right">
                <span className="text-[10px] font-bold text-indigo-200 block">وضعیت موظفی</span>
                <span className="text-sm font-black text-emerald-300">
                  {studentStatsSummary.overallDutyDiffHours > 0 ? '+' : ''}
                  {studentStatsSummary.overallDutyDiffHours.toLocaleString('fa-IR')} ساعت
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Navigation Sub-Tabs (اصلاح ۷) */}
        <div className="mt-6 pt-5 border-t border-white/10 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('daily_entry')}
            className={cn(
              "px-5 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border shadow-sm shrink-0",
              activeSubTab === 'daily_entry'
                ? "bg-white text-indigo-900 border-white shadow-lg shadow-white/10"
                : "bg-white/10 hover:bg-white/20 text-indigo-100 border-white/10"
            )}
          >
            <Clock size={16} />
            <span>۱. ثبت کارکرد روزانه و دوره فعال</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('stats_reports')}
            className={cn(
              "px-5 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border shadow-sm shrink-0",
              activeSubTab === 'stats_reports'
                ? "bg-white text-indigo-900 border-white shadow-lg shadow-white/10"
                : "bg-white/10 hover:bg-white/20 text-indigo-100 border-white/10"
            )}
          >
            <BarChart2 size={16} />
            <span>۲. آمار و گزارشات جامع و نمودارها</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: DAILY REGISTRATION & ACTIVE PERIOD (اصلاح ۱، ۲، ۳، ۴، ۶، ۷) */}
      {/* ========================================================================= */}
      {activeSubTab === 'daily_entry' && (
        <div className="space-y-6">
          {/* Main Entry Card */}
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-base font-black text-slate-900">فرم ثبت ساعت مطالعه و مباحثه</h3>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  هر بار که ساعت جدیدی وارد می‌کنید، به صورت تجمیعی به کارکرد قبلی شما اضافه می‌شود.
                </p>
              </div>

              {/* Active Period Dropdown Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 shrink-0">انتخاب دوره:</span>
                <select
                  value={activePeriodId}
                  onChange={(e) => setActivePeriodId(e.target.value)}
                  className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer min-w-[210px]"
                >
                  {periods.map(p => {
                    const closed = isPeriodClosed(p);
                    const exempt = isStudentExempt(p, student);
                    return (
                      <option key={p.id} value={p.id}>
                        {p.title} {closed ? '(🔒 بسته)' : exempt ? '(🛡️ معاف)' : '(🟢 فعال)'}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {currentPeriod ? (
              <form onSubmit={handleSaveHours} className="space-y-6">
                {/* Active Period Info Banner */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <Calendar size={18} className="text-indigo-600 shrink-0" />
                    <div>
                      <span className="font-black text-slate-900">{currentPeriod.title}</span>
                      <span className="text-slate-500 mr-2 text-[11px]">
                        (شروع: {currentPeriod.startDate ? new Date(currentPeriod.startDate).toLocaleDateString('fa-IR') : '---'} | پایان: {currentPeriod.endDate ? new Date(currentPeriod.endDate).toLocaleDateString('fa-IR') : '---'})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-3 py-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 shadow-2xs">
                      موظفی دوره: <b className="text-indigo-600 font-black">{currentPeriod.mandatoryHours || 0} ساعت</b>
                    </span>

                    {isCurrentStudentExempt ? (
                      <span className="px-3 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-xl font-black flex items-center gap-1">
                        <ShieldCheck size={14} />
                        معاف شده‌اید
                      </span>
                    ) : isCurrentPeriodClosed ? (
                      <span className="px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-black flex items-center gap-1">
                        <Lock size={14} />
                        دوره بسته شده (🔒)
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-black flex items-center gap-1">
                        <Unlock size={14} />
                        امکان ثبت فعال است (🟢)
                      </span>
                    )}
                  </div>
                </div>

                {/* Input Fields & Quick Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Box 1: Study Hours Input */}
                  <div className="bg-indigo-50/60 border-2 border-indigo-200/80 rounded-2xl p-4 space-y-2.5 relative focus-within:border-indigo-500 transition-all">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                        <BookOpen size={16} className="text-indigo-600" />
                        <span>۱. ساعت مطالعه جدید</span>
                      </label>
                      <span className="text-[10px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded-full border border-indigo-100">
                        مطالعه
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="40"
                        disabled={isReadOnlyForUser}
                        value={studyHoursInput}
                        onChange={(e) => setStudyHoursInput(e.target.value)}
                        placeholder="مثلاً 2 یا 1.5"
                        className="w-full pr-4 pl-12 py-3 bg-white border border-indigo-200 rounded-xl text-slate-900 font-black text-base outline-none focus:ring-2 focus:ring-indigo-500 transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                      />
                      <span className="absolute left-3 top-3.5 text-xs font-bold text-slate-400 pointer-events-none">
                        ساعت
                      </span>
                    </div>

                    {/* Quick Add Buttons */}
                    {!isReadOnlyForUser && (
                      <div className="flex items-center gap-1 pt-1">
                        <span className="text-[10px] text-slate-400 font-bold ml-1">افزودن سریع:</span>
                        <button
                          type="button"
                          onClick={() => handleQuickAddStudy(0.5)}
                          className="px-2 py-0.5 bg-white hover:bg-indigo-100 text-indigo-700 text-[10.5px] font-bold rounded-lg border border-indigo-200 transition-all"
                        >
                          +۰.۵س
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAddStudy(1)}
                          className="px-2 py-0.5 bg-white hover:bg-indigo-100 text-indigo-700 text-[10.5px] font-bold rounded-lg border border-indigo-200 transition-all"
                        >
                          +۱س
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAddStudy(2)}
                          className="px-2 py-0.5 bg-white hover:bg-indigo-100 text-indigo-700 text-[10.5px] font-bold rounded-lg border border-indigo-200 transition-all"
                        >
                          +۲س
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Box 2: Discussion Hours Input */}
                  <div className="bg-emerald-50/60 border-2 border-emerald-200/80 rounded-2xl p-4 space-y-2.5 relative focus-within:border-emerald-500 transition-all">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                        <MessageSquare size={16} className="text-emerald-600" />
                        <span>۲. ساعت مباحثه جدید</span>
                      </label>
                      <span className="text-[10px] font-bold text-emerald-600 bg-white px-2 py-0.5 rounded-full border border-emerald-100">
                        مباحثه
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="40"
                        disabled={isReadOnlyForUser}
                        value={discussionHoursInput}
                        onChange={(e) => setDiscussionHoursInput(e.target.value)}
                        placeholder="مثلاً 1.5 یا 2"
                        className="w-full pr-4 pl-12 py-3 bg-white border border-emerald-200 rounded-xl text-slate-900 font-black text-base outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                      />
                      <span className="absolute left-3 top-3.5 text-xs font-bold text-slate-400 pointer-events-none">
                        ساعت
                      </span>
                    </div>

                    {/* Quick Add Buttons */}
                    {!isReadOnlyForUser && (
                      <div className="flex items-center gap-1 pt-1">
                        <span className="text-[10px] text-slate-400 font-bold ml-1">افزودن سریع:</span>
                        <button
                          type="button"
                          onClick={() => handleQuickAddDiscussion(0.5)}
                          className="px-2 py-0.5 bg-white hover:bg-emerald-100 text-emerald-700 text-[10.5px] font-bold rounded-lg border border-emerald-200 transition-all"
                        >
                          +۰.۵س
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAddDiscussion(1)}
                          className="px-2 py-0.5 bg-white hover:bg-emerald-100 text-emerald-700 text-[10.5px] font-bold rounded-lg border border-emerald-200 transition-all"
                        >
                          +۱س
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAddDiscussion(2)}
                          className="px-2 py-0.5 bg-white hover:bg-emerald-100 text-emerald-700 text-[10.5px] font-bold rounded-lg border border-emerald-200 transition-all"
                        >
                          +۲س
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Box 3: Total Sum Preview */}
                  <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-4 space-y-2.5 relative shadow-md">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                        <Calculator size={16} className="text-amber-400" />
                        <span>۳. کارکرد این ثبت</span>
                      </label>
                      <span className="text-[10px] font-black bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30">
                        تجمیعی
                      </span>
                    </div>

                    <div className="px-4 py-3 bg-white/10 rounded-xl flex items-center justify-between border border-white/10">
                      <span className="text-2xl font-black text-white">
                        {calculatedTotalHours.toLocaleString('fa-IR')}
                      </span>
                      <span className="text-xs font-bold text-slate-300">ساعت</span>
                    </div>

                    <div className="text-[11px] text-slate-300">
                      پس از ثبت، به مجموع کارکرد دوره افزوده خواهد شد.
                    </div>
                  </div>
                </div>

                {/* Optional Note / Description input */}
                {!isReadOnlyForUser && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 block">
                      توضیحات یا مبحث مورد مطالعه (اختیاری):
                    </label>
                    <input
                      type="text"
                      placeholder="مثلاً: مطالعه کتاب مکاسب - مباحثه اصول الکفایه..."
                      value={entryNoteInput}
                      onChange={(e) => setEntryNoteInput(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                )}

                {/* Submit Action Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-100">
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <Info size={16} className="text-indigo-600 shrink-0" />
                    <span>
                      {isReadOnlyForUser
                        ? '🔒 این دوره مطالعاتی بسته‌شده است و امکان ثبت جدید یا ویرایش وجود ندارد.'
                        : 'با زدن دکمه ثبت، ساعت جدید وارد شده به کارکرد کل دوره افزوده شده و باکس پاک می‌شود.'}
                    </span>
                  </div>

                  {!isReadOnlyForUser && (
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={18} />}
                      <span>ثبت و افزوده شدن به کارکرد دوره</span>
                    </button>
                  )}
                </div>

                {/* Success Alert Banner */}
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
                هیچ دوره‌ای انتخاب نشده است.
              </div>
            )}
          </div>

          {/* Cumulative Totals Widget for Active Period */}
          <div className="bg-gradient-to-br from-indigo-50 via-slate-50 to-indigo-50/30 p-5 md:p-6 rounded-3xl border border-indigo-100 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100/80 pb-3">
              <div className="flex items-center gap-2">
                <Calculator size={18} className="text-indigo-600" />
                <h4 className="text-sm font-black text-indigo-950">
                  جمع کل کارکرد ثبت‌شده تا این لحظه در دوره «{currentPeriod?.title}»
                </h4>
              </div>
              <span className="text-xs font-bold text-indigo-700 bg-white px-3 py-1 rounded-xl border border-indigo-200 shadow-2xs self-start sm:self-auto">
                تعداد ثبت‌ها: {dailyEntries.length} مورد
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 block">مجموع مطالعه انفرادی</span>
                <div className="text-xl font-black text-indigo-700 mt-1">
                  {activePeriodTotals.totalStudy.toLocaleString('fa-IR')} <span className="text-xs font-normal text-slate-500">ساعت</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 block">مجموع مباحثه گروهی</span>
                <div className="text-xl font-black text-emerald-700 mt-1">
                  {activePeriodTotals.totalDisc.toLocaleString('fa-IR')} <span className="text-xs font-normal text-slate-500">ساعت</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 block">کل کارکرد دوره</span>
                <div className="text-xl font-black text-slate-900 mt-1 flex items-baseline gap-1.5">
                  <span>{activePeriodTotals.totalSum.toLocaleString('fa-IR')}</span>
                  <span className="text-xs font-normal text-slate-500">ساعت</span>
                  {activePeriodTotals.mandatory > 0 && (
                    <span className={cn(
                      "text-xs font-bold mr-auto px-2 py-0.5 rounded-lg text-[10.5px]",
                      activePeriodTotals.isFulfilled ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    )}>
                      {activePeriodTotals.diff >= 0 ? `+${activePeriodTotals.diff} مازاد` : `${activePeriodTotals.diff} کسری`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ACTIVE PERIOD GRANULAR BREAKDOWN TABLE (اصلاح ۳ و ۴) */}
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">ریز سوابق و جزئیات ثبت‌های دوره فعال</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  تاریخ، ساعت دقیق، میزان مطالعه و مباحثه ثبت‌شده در هر نوبت برای دوره «{currentPeriod?.title}»
                </p>
              </div>

              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-xl self-start sm:self-auto">
                {dailyEntries.length} ثبت ثبت‌شده
              </span>
            </div>

            {dailyEntries.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-1">
                <History size={32} className="mx-auto text-slate-300 mb-2" />
                <p>هنوز هیچ ساعتی برای این دوره ثبت نکرده‌اید.</p>
                <p className="text-[11px] text-slate-400">از فرم بالا می‌توانید اولین کارکرد روزانه خود را ثبت کنید.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-black border-y border-slate-200 text-[11px]">
                      <th className="py-3 px-3">ردیف</th>
                      <th className="py-3 px-3">تاریخ و ساعت دقیق ثبت</th>
                      <th className="py-3 px-3 text-center">ساعت مطالعه</th>
                      <th className="py-3 px-3 text-center">ساعت مباحثه</th>
                      <th className="py-3 px-3 text-center">جمع این ثبت</th>
                      <th className="py-3 px-3">توضیحات</th>
                      {!isReadOnlyForUser && <th className="py-3 px-3 text-center">عملیات</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {dailyEntries.map((entry, idx) => (
                      <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-3 text-slate-400 font-bold">{idx + 1}</td>
                        <td className="py-3.5 px-3 text-slate-800 font-bold">
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-indigo-600 shrink-0" />
                            <span>{entry.entryDate || '---'}</span>
                            <span className="text-[11px] text-slate-400 font-normal">({entry.entryTime || '---'})</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold text-indigo-700 bg-indigo-50/20">
                          {entry.studyHours > 0 ? `${entry.studyHours} س` : '۰'}
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold text-emerald-700 bg-emerald-50/20">
                          {entry.discussionHours > 0 ? `${entry.discussionHours} س` : '۰'}
                        </td>
                        <td className="py-3.5 px-3 text-center font-black text-slate-900 bg-slate-50">
                          {entry.totalHours} ساعت
                        </td>
                        <td className="py-3.5 px-3 text-slate-600 text-[11px]">
                          {entry.note || <span className="text-slate-300">بدون توضیح</span>}
                        </td>
                        {!isReadOnlyForUser && (
                          <td className="py-3.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEditEntry(entry)}
                                title="ویرایش این ثبت"
                                className="p-1.5 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-all cursor-pointer"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteEntry(entry)}
                                title="حذف این ثبت"
                                className="p-1.5 hover:bg-rose-100 text-rose-700 rounded-lg transition-all cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: COMPREHENSIVE STATS & ANALYTICS (اصلاح ۶ و ۷) */}
      {/* ========================================================================= */}
      {activeSubTab === 'stats_reports' && (
        <div className="space-y-6">
          {/* KPI Summary Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
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

            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold">تفاضل موظفی</span>
                <Target size={16} className="text-emerald-600" />
              </div>
              <div className={cn(
                "text-lg font-black flex items-center gap-1",
                studentStatsSummary.overallDutyDiffHours >= 0 ? "text-emerald-600" : "text-rose-600"
              )}>
                <span>
                  {studentStatsSummary.overallDutyDiffHours > 0 ? '+' : ''}
                  {studentStatsSummary.overallDutyDiffHours.toLocaleString('fa-IR')}
                </span>
                <span className="text-xs font-normal">ساعت</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium truncate">
                {studentStatsSummary.overallDutyDiffHours >= 0 ? 'تکمیل موظفی' : 'کسری کلی'}
              </p>
            </div>

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

            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold">دوره‌های موفق</span>
                <Award size={16} className="text-amber-600" />
              </div>
              <div className="text-lg font-black text-slate-900">
                {studentStatsSummary.fulfilledPeriodsCount} <span className="text-xs font-normal text-slate-400">دوره</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium truncate">
                رسیدن به موظفی
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold">رشد دوره‌ای</span>
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
                روند عملکرد
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold">اخطارها</span>
                <AlertTriangle size={16} className={studentStatsSummary.totalWarningsCount > 0 ? "text-rose-600" : "text-slate-400"} />
              </div>
              <div className={cn(
                "text-lg font-black",
                studentStatsSummary.totalWarningsCount > 0 ? "text-rose-600" : "text-slate-900"
              )}>
                {studentStatsSummary.totalWarningsCount} <span className="text-xs font-normal text-slate-400">مورد</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium truncate">
                {studentStatsSummary.totalWarningsCount === 0 ? 'فاقد اخطار' : 'نیازمند پیگیری'}
              </p>
            </div>
          </div>

          {/* HISTORICAL BREAKDOWN TABLE ACROSS ALL PERIODS */}
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">جدول سوابق و کارکرد تفکیکی در تمام دوره‌ها</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  وضعیت انجام موظفی، کسر از موظفی و مقایسه با میانگین در هر یک از دوره‌ها
                </p>
              </div>

              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 self-start sm:self-auto">
                کل دوره‌ها: {studentStatsSummary.totalPeriodsCount}
              </span>
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
                    <th className="py-3 px-3 text-center">کسر / مازاد</th>
                    <th className="py-3 px-3 text-center">وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {studentStatsSummary.periodsData.map((item, idx) => (
                    <tr key={item.period.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-3 text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-3.5 px-3 font-bold text-slate-800">
                        {item.period.title}
                      </td>
                      <td className="py-3.5 px-3 text-slate-500 text-[11px]">
                        {item.period.startDate ? new Date(item.period.startDate).toLocaleDateString('fa-IR') : '---'} تا {item.period.endDate ? new Date(item.period.endDate).toLocaleDateString('fa-IR') : '---'}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-indigo-700 bg-indigo-50/30">
                        {item.metrics.studyHours > 0 ? `${item.metrics.studyHours} س` : '۰'}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-emerald-700 bg-emerald-50/30">
                        {item.metrics.discussionHours > 0 ? `${item.metrics.discussionHours} س` : '۰'}
                      </td>
                      <td className="py-3.5 px-3 text-center font-black text-slate-900 bg-slate-50">
                        {item.metrics.totalHours > 0 ? `${item.metrics.totalHours} س` : '۰'}
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* COMPARATIVE CHARTS */}
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart2 size={18} className="text-indigo-600" />
                  <h3 className="text-base font-black text-slate-900">نمودار مقایسه‌ای عملکرد تحصیلی</h3>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  مقایسه کارکرد شما نسبت به موظفی دوره‌ها و میانگین سایر هم‌پایه‌ای‌ها
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

            <div className="h-80 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                {chartViewMode === 'TOTAL' ? (
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit=" س" dx={-10} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#ffffff', 
                        borderRadius: '16px', 
                        border: '1px solid #e2e8f0', 
                        direction: 'rtl',
                        fontSize: '12px'
                      }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Line type="monotone" dataKey="totalHours" name="مجموع شما" stroke="#4f46e5" strokeWidth={3} dot={{ r: 6 }} />
                    <Line type="monotone" dataKey="mandatoryHours" name="موظفی دوره" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" />
                    <Line type="monotone" dataKey="avgHours" name="میانگین پایه" stroke="#f59e0b" strokeWidth={2} strokeDasharray="3 3" />
                  </LineChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit=" س" dx={-10} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#ffffff', 
                        borderRadius: '16px', 
                        border: '1px solid #e2e8f0', 
                        direction: 'rtl',
                        fontSize: '12px'
                      }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Bar dataKey="studyHours" name="مطالعه" fill="#6366f1" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="discussionHours" name="مباحثه" fill="#10b981" radius={[8, 8, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Edit Entry Modal */}
      <AnimatePresence>
        {editingEntry && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Edit size={18} className="text-indigo-600" />
                  <h3 className="text-sm font-black text-slate-900">ویرایش ثبت مطالعه و مباحثه</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="text-xs text-slate-500 font-medium">
                  تاریخ و ساعت این ثبت: <b className="text-slate-800">{editingEntry.entryDate} ({editingEntry.entryTime})</b>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">ساعت مطالعه جدید:</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={editStudyHours}
                    onChange={(e) => setEditStudyHours(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">ساعت مباحثه جدید:</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={editDiscussionHours}
                    onChange={(e) => setEditDiscussionHours(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">توضیحات (اختیاری):</label>
                  <input
                    type="text"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  disabled={isUpdatingEntry}
                  onClick={handleSaveEditEntry}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isUpdatingEntry ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>ذخیره تغییرات</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
