import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  BarChart2, 
  Plus, 
  Calendar, 
  Clock, 
  TrendingUp, 
  Users, 
  Target, 
  ChevronDown, 
  FileSpreadsheet, 
  Download, 
  Edit3, 
  Edit,
  Trash2, 
  History,
  Layers,
  BookOpen,
  MessageSquare,
  Calculator,
  Sparkles,
  Check,
  Lock,
  Unlock,
  ShieldCheck,
  AlertTriangle,
  CalendarPlus,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { localDb } from '../lib/localDb';
import { Student, StudyPeriod, PeriodicStudyLog } from '../types';
import { useMentor, getStudentMentorKey } from '../context/MentorContext';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import StudyEntryModal from './study/StudyEntryModal';
import RankingModal, { RankingModalData } from './study/RankingModal';
import DeletePeriodModal from './study/DeletePeriodModal';
import PeriodViewTable from './study/PeriodViewTable';
import AllPeriodsTable from './study/AllPeriodsTable';
import StudentBreakoutSection from './study/StudentBreakoutSection';
import DashboardAnalytics from './study/DashboardAnalytics';
import PeriodAnalytics from './study/PeriodAnalytics';
import StudentStudyPortal from './study/StudentStudyPortal';
import { calculatePeriodAverages, exportStudyStatsCSV, isPeriodClosed, isStudentExempt } from './study/studyUtils';

interface StudyStatsProps {
  initialStudentId?: string;
}

export default function StudyStats({ initialStudentId }: StudyStatsProps) {
  const { currentMentor, currentMentorId, shahpooriFilter, filterStudents } = useMentor();
  const { currentUser } = useAuth();

  const [periods, setPeriods] = useState<StudyPeriod[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allStudentsRaw, setAllStudentsRaw] = useState<Student[]>([]);
  const [allLogs, setAllLogs] = useState<PeriodicStudyLog[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(initialStudentId || null);

  // Main table tab: 'PERIOD' (Single period) or 'ALL_PERIODS' (Aggregated all periods)
  const [activeMainTab, setActiveMainTab] = useState<'PERIOD' | 'ALL_PERIODS'>('PERIOD');

  // Period dropdown state
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const periodDropdownRef = useRef<HTMLDivElement>(null);

  // Modals state
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<StudyPeriod | null>(null);
  const [deleteConfirmPeriod, setDeleteConfirmPeriod] = useState<StudyPeriod | null>(null);
  const [rankingModalData, setRankingModalData] = useState<RankingModalData | null>(null);

  const isLevel3Student = currentUser?.level === 3;
  const isGradeMentor = currentUser?.role === 'grade_mentor' || currentUser?.role === 'grade_supervisor';

  const isEducationManager = 
    currentUser?.role === 'education_manager' || 
    currentUser?.role === 'education_officer' || 
    currentUser?.username?.toUpperCase() === 'SHAH' ||
    currentMentorId === 'shahpoori' ||
    currentMentor?.isHeadManager;

  const isLevel1Admin = 
    (currentUser?.role as string) === 'super_admin' || 
    currentUser?.level === 1 || 
    currentUser?.role === 'manager_principal' || 
    currentUser?.role === 'school_manager';

  // "به شرطی که کاربر مسول اموزش و یا کاربر سطح 1 با قابلیت انجام ویرایش باشه"
  const canManagePeriods = Boolean((isEducationManager || isLevel1Admin) && !currentUser?.isReadOnly);

  // The two distinct sections of Study Stats:
  // 1. 'manage_periods': ثبت دوره مطالعاتی و مدیریت دوره‌های ثبت شده
  // 2. 'view_stats': آمار ثبت شده برای مطالعه و مباحثه
  const [activeStudyStatsTab, setActiveStudyStatsTab] = useState<'manage_periods' | 'view_stats'>('manage_periods');
  const effectiveSection = canManagePeriods ? activeStudyStatsTab : 'view_stats';
  
  // Extract mentor grade label
  const mentorGradeLabel = useMemo(() => {
    if (!currentUser) return '';
    if (currentUser.scope === 'grade_7' || currentUser.gradeLabel?.includes('۷') || currentUser.gradeLabel?.includes('7')) return 'پایه ۷';
    if (currentUser.scope === 'grade_8' || currentUser.gradeLabel?.includes('۸') || currentUser.gradeLabel?.includes('8')) return 'پایه ۸';
    if (currentUser.scope === 'grade_9' || currentUser.gradeLabel?.includes('۹') || currentUser.gradeLabel?.includes('9')) return 'پایه ۹';
    if (currentUser.scope === 'grade_10' || currentUser.gradeLabel?.includes('۱۰') || currentUser.gradeLabel?.includes('10')) return 'پایه ۱۰';
    return currentUser.gradeLabel || '';
  }, [currentUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target as Node)) {
        setIsPeriodDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async () => {
    try {
      const allStudents = await localDb.getDocs<Student>('students');
      setAllStudentsRaw(allStudents);
      
      // Filter active students based on role
      let activeStudents = filterStudents(allStudents, true);
      
      // If Grade Mentor, strictly scope to their grade
      if (isGradeMentor && mentorGradeLabel) {
        activeStudents = activeStudents.filter(s => 
          s.grade && (s.grade === mentorGradeLabel || s.grade.includes(mentorGradeLabel.replace('پایه ', '')))
        );
      }
      setStudents(activeStudents);

      const allPeriods = await localDb.getDocs<StudyPeriod>('study_periods');
      const sortedPeriods = [...allPeriods].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      setPeriods(sortedPeriods);

      if (sortedPeriods.length > 0) {
        setSelectedPeriodId(prev => {
          if (prev && sortedPeriods.some(p => p.id === prev)) return prev;
          return sortedPeriods[0].id;
        });
      } else {
        setSelectedPeriodId(null);
      }

      const rawLogs = await localDb.getDocs<PeriodicStudyLog>('periodic_study_logs');
      setAllLogs(rawLogs);
    } catch (error) {
      console.error("Error fetching study stats data:", error);
    }
  };

  useEffect(() => {
    fetchData();
    const unsub = localDb.subscribe(() => {
      fetchData();
    });
    return () => unsub();
  }, [currentMentor.id, currentMentorId, shahpooriFilter, currentUser]);

  useEffect(() => {
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
    }
  }, [initialStudentId]);

  // Find student if user is level 3
  const currentStudentForLevel3 = useMemo(() => {
    if (!isLevel3Student || allStudentsRaw.length === 0) return null;
    return allStudentsRaw.find(s => 
      (currentUser?.linkedStudentId && s.id === currentUser.linkedStudentId) ||
      (currentUser?.studentName && s.name.trim() === currentUser.studentName.trim()) ||
      (currentUser?.name && s.name.trim() === currentUser.name.trim()) ||
      (s.nationalId && s.nationalId === currentUser?.username)
    ) || allStudentsRaw[0];
  }, [isLevel3Student, allStudentsRaw, currentUser]);

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId) || periods[0] || null;

  const handleOpenCreatePeriod = () => {
    setEditingPeriod(null);
    setShowEntryModal(true);
  };

  const handleOpenEditPeriod = (period: StudyPeriod) => {
    setEditingPeriod(period);
    setShowEntryModal(true);
  };

  // Toggle period open/closed lock status (For education officer & admins)
  const handleTogglePeriodLock = async (period: StudyPeriod) => {
    try {
      const updatedStatus = !period.isClosed;
      await localDb.updateDoc('study_periods', period.id, {
        isClosed: updatedStatus,
        updatedAt: new Date().toISOString()
      });
      await fetchData();
    } catch (err) {
      console.error("Error toggling period lock:", err);
      alert("خطا در تغییر وضعیت دسترسی دوره");
    }
  };

  // Education Officer / Super Admin: Toggle grade exemption
  const handleToggleGradeExemption = async (period: StudyPeriod, gradeName: string) => {
    if (isGradeMentor) {
      alert("استاد پایه مجاز به معاف کردن کل پایه نمی‌باشد. تنها مسئول آموزش این دسترسی را دارد. شما می‌توانید طلاب را به صورت موردی معاف فرمایید.");
      return;
    }
    try {
      const currentExemptGrades = period.exemptGrades || [];
      const isExempt = currentExemptGrades.includes(gradeName);
      const updated = isExempt
        ? currentExemptGrades.filter(g => g !== gradeName)
        : [...currentExemptGrades, gradeName];

      await localDb.updateDoc('study_periods', period.id, {
        exemptGrades: updated,
        updatedAt: new Date().toISOString()
      });
      await fetchData();
    } catch (err) {
      console.error("Error updating grade exemption:", err);
    }
  };

  // Education Officer / Super Admin: Clear logs for a period
  const handleClearPeriodLogs = async (period: StudyPeriod, targetGrade?: string) => {
    if (isGradeMentor) {
      alert("استاد پایه مجاز به پاک کردن ساعات دوره نمی‌باشد. تنها مسئول آموزش این دسترسی را دارد.");
      return;
    }
    const confirmMsg = targetGrade 
      ? `آیا از پاک کردن تمامی ساعت‌های ثبت‌شده طلاب «${targetGrade}» در دوره «${period.title}» اطمینان دارید؟`
      : `آیا از پاک کردن تمامی ساعت‌های ثبت‌شده در دوره «${period.title}» اطمینان دارید؟ این عملیات غیرقابل بازگشت است.`;
    
    if (!window.confirm(confirmMsg)) return;

    try {
      let logsToDelete: PeriodicStudyLog[] = [];
      if (targetGrade) {
        const gradeStudents = students.filter(s => s.grade === targetGrade || s.grade?.includes(targetGrade.replace('پایه ', '')));
        const gradeStudentIds = new Set(gradeStudents.map(s => s.id));
        logsToDelete = allLogs.filter(l => l.periodId === period.id && gradeStudentIds.has(l.studentId));
      } else {
        logsToDelete = allLogs.filter(l => l.periodId === period.id);
      }

      for (const log of logsToDelete) {
        await localDb.deleteDoc('periodic_study_logs', log.id);
      }
      await fetchData();
      alert(`ساعات دوره با موفقیت پاک‌سازی شد.`);
    } catch (err) {
      console.error("Error clearing logs:", err);
    }
  };

  const handleConfirmDeletePeriod = async () => {
    if (!deleteConfirmPeriod) return;
    try {
      await localDb.deleteDoc('study_periods', deleteConfirmPeriod.id);
      
      // Delete associated logs across all logs in database
      const rawLogs = await localDb.getDocs<PeriodicStudyLog>('periodic_study_logs');
      const associatedLogs = rawLogs.filter(l => l.periodId === deleteConfirmPeriod.id);
      for (const log of associatedLogs) {
        await localDb.deleteDoc('periodic_study_logs', log.id);
      }

      setDeleteConfirmPeriod(null);
      if (selectedPeriodId === deleteConfirmPeriod.id) {
        setSelectedPeriodId(null);
      }
      await fetchData();
    } catch (error) {
      console.error("Error deleting period:", error);
      alert("خطا در حذف دوره");
    }
  };

  const selectedPeriodAvg = selectedPeriod 
    ? calculatePeriodAverages(selectedPeriod.id, allLogs) 
    : null;

  // =========================================================================
  // IF LEVEL 3 STUDENT: DIRECT TO DEDICATED STUDENT STUDY PORTAL
  // =========================================================================
  if (isLevel3Student) {
    if (!currentStudentForLevel3) {
      return (
        <div className="p-8 bg-white rounded-3xl border border-slate-100 text-center font-vazir" dir="rtl">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
            <Clock size={24} />
          </div>
          <h3 className="text-base font-black text-slate-800">در حال بارگذاری اطلاعات مطالعاتی...</h3>
          <p className="text-xs text-slate-500 mt-1">لطفاً چند لحظه شکیبا باشید.</p>
        </div>
      );
    }

    return (
      <StudentStudyPortal
        student={currentStudentForLevel3}
        periods={periods}
        allLogs={allLogs}
        allStudents={allStudentsRaw}
        onRefresh={fetchData}
      />
    );
  }

  // =========================================================================
  // OFFICER / GRADE SUPERVISOR / ADMIN VIEW
  // =========================================================================
  const isPeriodClosedForSelected = isPeriodClosed(selectedPeriod);
  const isGradeExemptForSelected = Boolean(
    selectedPeriod && mentorGradeLabel && selectedPeriod.exemptGrades?.includes(mentorGradeLabel)
  );

  return (
    <div className="space-y-6 pb-16 font-vazir" dir="rtl">
      {/* TWO SECTIONS SELECTOR BAR (For Education Manager or Level 1 user with edit permission) */}
      {canManagePeriods && (
        <div className="bg-white p-2 sm:p-2.5 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveStudyStatsTab('manage_periods')}
            className={cn(
              "flex-1 py-3.5 px-5 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer",
              effectiveSection === 'manage_periods'
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60"
            )}
          >
            <CalendarPlus size={18} />
            <span>بخش اول: ثبت دوره مطالعاتی و مدیریت دوره‌های ثبت‌شده</span>
            <span className={cn(
              "px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold",
              effectiveSection === 'manage_periods' ? "bg-indigo-700 text-white" : "bg-slate-200 text-slate-700"
            )}>
              {periods.length} دوره
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStudyStatsTab('view_stats')}
            className={cn(
              "flex-1 py-3.5 px-5 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer",
              effectiveSection === 'view_stats'
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60"
            )}
          >
            <BarChart2 size={18} />
            <span>بخش دوم: مشاهده آمار ثبت‌شده برای مطالعه و مباحثه</span>
            <span className={cn(
              "px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold",
              effectiveSection === 'view_stats' ? "bg-emerald-700 text-white" : "bg-slate-200 text-slate-700"
            )}>
              {students.length} طلبه
            </span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. MANAGEMENT VIEW: ثبت دوره مطالعاتی و مدیریت دوره‌های ثبت‌شده             */}
      {/* ========================================================================= */}
      {effectiveSection === 'manage_periods' ? (
        <div className="space-y-6">
          {/* Header Banner for Period Management */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-6 sm:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 space-y-2">
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold">
                <ShieldCheck size={16} />
                <span>پنل مسئول آموزش و کاربر سطح ۱ با دسترسی ویرایش</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                ثبت دوره مطالعاتی و مدیریت دوره‌های ثبت‌شده
              </h2>
              <p className="text-xs sm:text-sm text-indigo-200/90 font-medium max-w-2xl leading-relaxed">
                تعریف دوره‌های جدید مطالعاتی، تعیین ساعت و دقیقه موظفی، انتخاب پایه‌های مشمول، ورود ساعات مطالعه و مباحثه طلاب و تنظیم اخطار خودکار.
              </p>
            </div>

            {!isGradeMentor && (
              <div className="relative z-10 flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleOpenCreatePeriod}
                  className="px-5 py-3.5 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white font-black text-xs sm:text-sm rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-950/40 hover:-translate-y-0.5 cursor-pointer"
                >
                  <Plus size={18} />
                  <span>ثبت دوره مطالعاتی جدید</span>
                </button>
              </div>
            )}
          </div>

          {/* Periods Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-indigo-600" />
                <h3 className="text-base font-black text-slate-800">لیست دوره‌های مطالعاتی ثبت‌شده</h3>
              </div>
              <span className="text-xs font-bold text-slate-500">
                مجموع: {periods.length} دوره
              </span>
            </div>

            {periods.length === 0 ? (
              <div className="p-12 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-sm">
                  <CalendarPlus size={32} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-black text-slate-800">هنوز هیچ دوره مطالعاتی ثبت نشده است</h4>
                  <p className="text-xs text-slate-500 font-medium">
                    {isGradeMentor 
                      ? 'موردی توسط مسئول آموزش ثبت نشده است.' 
                      : 'برای شروع، روی دکمه «ثبت دوره مطالعاتی جدید» کلیک فرمایید.'}
                  </p>
                </div>
                {!isGradeMentor && (
                  <button
                    type="button"
                    onClick={handleOpenCreatePeriod}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs transition-all shadow-md shadow-indigo-200 inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Plus size={16} />
                    <span>ثبت اولین دوره مطالعاتی</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {periods.map(period => {
                  const pLogs = allLogs.filter(l => l.periodId === period.id);
                  const pAvg = calculatePeriodAverages(period.id, allLogs);
                  const targetGrades = period.targetGrades && period.targetGrades.length > 0 ? period.targetGrades : ['پایه ۷', 'پایه ۸', 'پایه ۹', 'پایه ۱۰'];
                  const isAllGrades = targetGrades.length === 4;

                  return (
                    <div
                      key={period.id}
                      className="bg-white border-2 border-slate-100 hover:border-indigo-200 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                    >
                      <div className="space-y-3">
                        {/* Period Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-base font-black text-slate-800 group-hover:text-indigo-950 transition-colors leading-snug">
                              {period.title}
                            </h4>
                            <p className="text-xs text-slate-400 font-mono mt-1">
                              {period.startDate ? new Date(period.startDate).toLocaleDateString('fa-IR') : '---'} تا {period.endDate ? new Date(period.endDate).toLocaleDateString('fa-IR') : '---'}
                            </p>
                          </div>
                          <span className={cn(
                            "text-[10px] font-black px-2.5 py-1 rounded-xl border shrink-0",
                            period.isClosed
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          )}>
                            {period.isClosed ? '🔒 بسته شده' : '🟢 باز (فعال)'}
                          </span>
                        </div>

                        {/* Specs Card */}
                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2 text-xs">
                          <div className="flex items-center justify-between text-slate-600 font-medium">
                            <span>سقف موظفی دوره:</span>
                            <span className="font-black text-indigo-700">
                              {period.mandatoryHours ? `${(period.mandatoryHours).toFixed(1)} ساعت (${Math.round(period.mandatoryHours * 60)} دقیقه)` : 'نامشخص'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-slate-600 font-medium">
                            <span>تعداد رکوردهای ثبت‌شده:</span>
                            <span className="font-black text-slate-800">{pLogs.length} طلبه</span>
                          </div>

                          <div className="flex items-center justify-between text-slate-600 font-medium">
                            <span>میانگین کارکرد طلاب:</span>
                            <span className="font-bold text-slate-700">
                              {pAvg.totalAvgMinutes.toLocaleString('fa-IR')} دقیقه
                            </span>
                          </div>

                          <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between gap-1 text-[11px]">
                            <span className="text-slate-500 font-medium">پایه‌های مشمول:</span>
                            <div className="flex flex-wrap gap-1 justify-end">
                              {isAllGrades ? (
                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg font-black text-[10px] border border-indigo-100">
                                  همه پایه‌ها
                                </span>
                              ) : (
                                targetGrades.map(tg => (
                                  <span key={tg} className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded-md font-bold text-[10px]">
                                    {tg}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>

                          <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between gap-1 text-[11px]">
                            <span className="text-slate-500 font-medium">سیستم اخطار:</span>
                            <span className={cn(
                              "font-bold text-[10px] px-2 py-0.5 rounded-lg border",
                              period.warningRule === 'below_mandatory' ? "bg-amber-50 text-amber-800 border-amber-200" :
                              period.warningRule === 'below_mandatory_and_avg' ? "bg-rose-50 text-rose-800 border-rose-200" :
                              "bg-slate-100 text-slate-600 border-slate-200"
                            )}>
                              {period.warningRule === 'below_mandatory' ? '⚠️ زیر موظفی' :
                               period.warningRule === 'below_mandatory_and_avg' ? '🚨 زیر موظفی + میانگین' :
                               'بدون اخطار خودکار'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleOpenEditPeriod(period)}
                          className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Edit size={14} />
                          <span>{isGradeMentor ? 'مشاهده و پیگیری ساعات طلاب' : 'ویرایش و ثبت ساعات طلاب'}</span>
                        </button>

                        {!isGradeMentor && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleTogglePeriodLock(period)}
                              className={cn(
                                "p-2.5 rounded-xl text-xs font-bold transition-colors border cursor-pointer",
                                period.isClosed
                                  ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                                  : "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200"
                              )}
                              title={period.isClosed ? 'بازگشایی ثبت دوره' : 'قفل کردن دوره'}
                            >
                              {period.isClosed ? <Unlock size={15} /> : <Lock size={15} />}
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeleteConfirmPeriod(period)}
                              className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors border border-rose-200 cursor-pointer"
                              title="حذف دوره"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. STATS VIEW: آمار ثبت‌شده برای مطالعه و مباحثه طلاب                       */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* Top Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                  <BarChart2 size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-slate-800">آمار ثبت‌شده برای مطالعه و مباحثه</h2>
                    {isGradeMentor && mentorGradeLabel && (
                      <span className="px-3 py-1 bg-purple-50 border border-purple-200 text-purple-700 text-xs font-black rounded-full">
                        محدوده: {mentorGradeLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {isGradeMentor 
                      ? `مشاهده و بررسی ساعت مطالعه و مباحثه طلاب ${mentorGradeLabel}` 
                      : 'مشاهده گزارش تحلیلی، ارزیابی ساعات مطالعه و مباحثه دوره‌ای و رتبه‌بندی تراز طلاب'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => exportStudyStatsCSV(periods, allLogs, students)}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl flex items-center gap-2 transition-all cursor-pointer"
              >
                <Download size={16} />
                <span>خروجی اکسل / CSV</span>
              </button>

              {canManagePeriods && (
                <button
                  type="button"
                  onClick={() => setActiveStudyStatsTab('manage_periods')}
                  className="px-4 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-2xl flex items-center gap-2 transition-all border border-indigo-200 cursor-pointer"
                >
                  <CalendarPlus size={16} />
                  <span>مدیریت دوره‌های مطالعاتی</span>
                </button>
              )}
            </div>
          </div>

      {/* Top Analytics Widgets: Statistics across ALL periods */}
      <DashboardAnalytics
        students={students}
        periods={periods}
        allLogs={allLogs}
        onOpenRankingModal={setRankingModalData}
      />

      {/* Main Full-Width Content Area */}
      <div className="space-y-6">
        {/* Main View Tabs (Single Period vs All Periods) */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          {/* Top Control Bar: Tabs & Dropdown Period Selector */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            {/* View Mode Tabs */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveMainTab('PERIOD')}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer",
                  activeMainTab === 'PERIOD' 
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
                    : "text-slate-600 hover:text-slate-900 bg-slate-100"
                )}
              >
                <Clock size={15} />
                <span>جدول عملکرد دوره انتخابی</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMainTab('ALL_PERIODS')}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer",
                  activeMainTab === 'ALL_PERIODS' 
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
                    : "text-slate-600 hover:text-slate-900 bg-slate-100"
                )}
              >
                <Layers size={15} />
                <span>جدول تجمیعی تمام دوره‌ها ({periods.length})</span>
              </button>
            </div>

            {/* Dropdown Period Selector */}
            {activeMainTab === 'PERIOD' && (
              <div className="flex flex-wrap items-center gap-2.5">
                <div ref={periodDropdownRef} className="relative min-w-[260px]">
                  <button
                    type="button"
                    onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}
                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-2xl text-xs font-black text-slate-800 flex items-center justify-between gap-3 transition-all shadow-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <History size={15} className="text-indigo-600 shrink-0" />
                      <span className="truncate">
                        {selectedPeriod ? selectedPeriod.title : 'انتخاب دوره مطالعاتی...'}
                      </span>
                    </div>
                    <ChevronDown size={15} className={cn("text-slate-400 transition-transform shrink-0", isPeriodDropdownOpen && "rotate-180")} />
                  </button>

                  <AnimatePresence>
                    {isPeriodDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 mt-2 w-80 max-h-80 overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-2xl p-2 z-50 space-y-1"
                      >
                        <div className="px-3 py-2 text-[11px] font-black text-slate-400 border-b border-slate-100 flex items-center justify-between">
                          <span>لیست دوره‌های مطالعاتی</span>
                          <span>{periods.length} دوره</span>
                        </div>

                        {periods.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400">
                            هیچ دوره‌ای ثبت نشده است
                          </div>
                        ) : (
                          periods.map(period => {
                            const isSelected = selectedPeriod?.id === period.id;
                            const pAvg = calculatePeriodAverages(period.id, allLogs);
                            const pClosed = isPeriodClosed(period);

                            return (
                              <div
                                key={period.id}
                                onClick={() => {
                                  setSelectedPeriodId(period.id);
                                  setIsPeriodDropdownOpen(false);
                                }}
                                className={cn(
                                  "p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between group",
                                  isSelected ? "bg-indigo-50 text-indigo-900 font-black" : "hover:bg-slate-50 text-slate-700"
                                )}
                              >
                                <div className="space-y-0.5 truncate pr-1">
                                  <div className="flex items-center gap-1.5">
                                    {isSelected && <Check size={14} className="text-indigo-600" />}
                                    <span className="text-xs truncate">{period.title}</span>
                                    {pClosed && <span className="text-[10px] text-rose-500 font-bold">(بسته)</span>}
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-medium">
                                    موظفی: {Math.round((period.mandatoryHours || 0) * 60)} د • {pAvg.activeCount} ثبت
                                  </p>
                                </div>

                                {!isGradeMentor && (
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setIsPeriodDropdownOpen(false);
                                        handleOpenEditPeriod(period);
                                      }}
                                      className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-white"
                                      title="ویرایش"
                                    >
                                      <Edit3 size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setIsPeriodDropdownOpen(false);
                                        setDeleteConfirmPeriod(period);
                                      }}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white"
                                      title="حذف"
                                    >
                                      <Trash2 size={13} />
                                    </button>
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

                {selectedPeriod && !isGradeMentor && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditPeriod(selectedPeriod)}
                      className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="ویرایش این دوره"
                    >
                      <Edit3 size={14} />
                      <span className="hidden sm:inline">ویرایش</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmPeriod(selectedPeriod)}
                      className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="حذف این دوره"
                    >
                      <Trash2 size={14} />
                      <span className="hidden sm:inline">حذف</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Top Period Banner (if single period selected) */}
          {activeMainTab === 'PERIOD' && selectedPeriod && (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200/60">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                  <h3 className="text-base font-black text-slate-800">{selectedPeriod.title}</h3>
                  
                  {/* Lock/Closed Status Badge */}
                  {isPeriodClosedForSelected ? (
                    <span className="px-2.5 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[11px] font-black flex items-center gap-1 border border-rose-200">
                      <Lock size={12} />
                      بسته شده برای طلاب
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[11px] font-black flex items-center gap-1 border border-emerald-200">
                      <Unlock size={12} />
                      باز برای ثبت طلاب
                    </span>
                  )}

                  {isGradeExemptForSelected && (
                    <span className="px-2.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[11px] font-black flex items-center gap-1 border border-purple-200">
                      <ShieldCheck size={12} />
                      {mentorGradeLabel} معاف شده
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  بازه زمانی: {selectedPeriod.startDate ? new Date(selectedPeriod.startDate).toLocaleDateString('fa-IR') : '---'} تا {selectedPeriod.endDate ? new Date(selectedPeriod.endDate).toLocaleDateString('fa-IR') : '---'}
                  {selectedPeriod.deadlineDate && ` • مهلت ثبت: ${new Date(selectedPeriod.deadlineDate).toLocaleDateString('fa-IR')}`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black text-slate-800 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs">
                  موظفی دوره: {Math.round((selectedPeriod.mandatoryHours || 0) * 60).toLocaleString('fa-IR')} دقیقه
                </span>
                
                {selectedPeriodAvg && (
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3.5 py-2 rounded-xl border border-indigo-100">
                    میانگین دوره: {selectedPeriodAvg.totalAvgMinutes.toLocaleString('fa-IR')} د (مطالعه: {selectedPeriodAvg.studyAvgMinutes.toLocaleString('fa-IR')} د | مباحثه: {selectedPeriodAvg.discussionAvgMinutes.toLocaleString('fa-IR')} د)
                  </span>
                )}

                {/* Lock Toggle for Admin / Education Officer */}
                {!isGradeMentor && (
                  <button
                    type="button"
                    onClick={() => handleTogglePeriodLock(selectedPeriod)}
                    className={cn(
                      "px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer",
                      selectedPeriod.isClosed
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-rose-600 hover:bg-rose-700 text-white"
                    )}
                  >
                    {selectedPeriod.isClosed ? <Unlock size={14} /> : <Lock size={14} />}
                    <span>{selectedPeriod.isClosed ? 'بازگشایی ثبت برای طلاب' : 'بستن ثبت برای طلاب'}</span>
                  </button>
                )}

                {/* Informational badge for Grade Supervisor - Grade supervisors cannot clear hours or exempt entire grade */}
                {isGradeMentor && (
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-purple-50/90 border border-purple-200 text-purple-900 rounded-xl text-xs font-bold shadow-2xs">
                    <ShieldCheck size={14} className="text-purple-600 shrink-0" />
                    <span>معافیت موردی: جهت معاف کردن یک یا چند طلبه، از ستون «معافیت موردی» در جدول استفاده نمایید.</span>
                  </div>
                )}

                {/* Exemption and Period Management Controls Exclusively for Education Officer & Admin */}
                {!isGradeMentor && (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative group">
                      <button
                        type="button"
                        className="px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 shadow-xs cursor-pointer"
                        title="معافیت کلی پایه‌ها توسط مسئول آموزش"
                      >
                        <ShieldCheck size={14} className="text-purple-600" />
                        <span>معافیت کلی پایه‌ها ({selectedPeriod.exemptGrades?.length || 0})</span>
                        <ChevronDown size={12} className="text-purple-400" />
                      </button>
                      <div className="hidden group-hover:block absolute left-0 top-full mt-1 w-56 p-3 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 space-y-2">
                        <p className="text-[11px] font-black text-slate-700 border-b pb-1.5">معافیت کلی پایه از این دوره (توسط مسئول آموزش):</p>
                        {['پایه ۷', 'پایه ۸', 'پایه ۹', 'پایه ۱۰'].map(grade => {
                          const isExempt = (selectedPeriod.exemptGrades || []).includes(grade);
                          return (
                            <button
                              key={grade}
                              type="button"
                              onClick={() => handleToggleGradeExemption(selectedPeriod, grade)}
                              className={cn(
                                "w-full text-right px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition-colors cursor-pointer",
                                isExempt ? "bg-purple-100 text-purple-900 font-black" : "hover:bg-slate-100 text-slate-700"
                              )}
                            >
                              <span>{grade}</span>
                              <span className={cn("text-[10px] px-1.5 py-0.5 rounded", isExempt ? "bg-purple-600 text-white" : "bg-slate-200 text-slate-600")}>
                                {isExempt ? 'معاف' : 'فعال'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleClearPeriodLogs(selectedPeriod)}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1"
                      title="پاک کردن تمامی ساعت‌های ثبت‌شده این دوره (مخصوص مسئول آموزش)"
                    >
                      <Trash2 size={13} />
                      <span>پاک‌کردن ساعات دوره</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab Body */}
          {activeMainTab === 'PERIOD' && selectedPeriod ? (
            <PeriodViewTable
              period={selectedPeriod}
              students={students}
              allLogs={allLogs}
              selectedStudentId={selectedStudentId}
              onSelectStudent={setSelectedStudentId}
            />
          ) : (
            <AllPeriodsTable
              students={students}
              periods={periods}
              allLogs={allLogs}
              selectedStudentId={selectedStudentId}
              onSelectStudent={setSelectedStudentId}
            />
          )}

          {/* Period Specific Analytics - placed under the period table and above the chart! */}
          {activeMainTab === 'PERIOD' && selectedPeriod && (
            <PeriodAnalytics
              period={selectedPeriod}
              students={students}
              allLogs={allLogs}
              onOpenRankingModal={setRankingModalData}
            />
          )}
        </div>

        {/* Student Detailed Breakout & Chart Section */}
        <StudentBreakoutSection
          students={students}
          periods={periods}
          allLogs={allLogs}
          selectedStudentId={selectedStudentId}
          onSelectStudent={setSelectedStudentId}
        />
      </div>
    </div>
  )}

      {/* Entry Modal */}
      <StudyEntryModal
        isOpen={showEntryModal}
        onClose={() => setShowEntryModal(false)}
        editingPeriod={editingPeriod}
        students={students}
        allLogs={allLogs}
        currentMentorId={currentMentor.id}
        onSaveSuccess={fetchData}
      />

      {/* Ranking Modal */}
      <RankingModal
        data={rankingModalData}
        onClose={() => setRankingModalData(null)}
      />

      {/* Delete Confirmation Modal */}
      <DeletePeriodModal
        period={deleteConfirmPeriod}
        onClose={() => setDeleteConfirmPeriod(null)}
        onConfirm={handleConfirmDeletePeriod}
      />
    </div>
  );
}

