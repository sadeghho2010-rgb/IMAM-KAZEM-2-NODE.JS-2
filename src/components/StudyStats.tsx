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
  AlertTriangle
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

  // Grade supervisor: Exempt their grade from this period
  const handleToggleGradeExemption = async (period: StudyPeriod) => {
    if (!mentorGradeLabel) return;
    try {
      const currentExemptGrades = period.exemptGrades || [];
      const isExempt = currentExemptGrades.includes(mentorGradeLabel);
      const updated = isExempt
        ? currentExemptGrades.filter(g => g !== mentorGradeLabel)
        : [...currentExemptGrades, mentorGradeLabel];

      await localDb.updateDoc('study_periods', period.id, {
        exemptGrades: updated,
        updatedAt: new Date().toISOString()
      });
      await fetchData();
    } catch (err) {
      console.error("Error updating grade exemption:", err);
    }
  };

  // Grade supervisor: Clear their grade logs for this period
  const handleClearGradeLogsInPeriod = async (period: StudyPeriod) => {
    if (!mentorGradeLabel) return;
    const confirmClear = window.confirm(`آیا از پاک کردن تمامی ساعت‌های ثبت‌شده طلاب ${mentorGradeLabel} در دوره «${period.title}» اطمینان دارید؟`);
    if (!confirmClear) return;

    try {
      const gradeStudents = students.filter(s => s.grade === mentorGradeLabel || s.grade?.includes(mentorGradeLabel.replace('پایه ', '')));
      const gradeStudentIds = new Set(gradeStudents.map(s => s.id));
      const logsToDelete = allLogs.filter(l => l.periodId === period.id && gradeStudentIds.has(l.studentId));

      for (const log of logsToDelete) {
        await localDb.deleteDoc('periodic_study_logs', log.id);
      }
      await fetchData();
    } catch (err) {
      console.error("Error clearing grade logs:", err);
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
    <div className="space-y-8 pb-16 font-vazir" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <BarChart2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-800">مدیریت و آمار مطالعه و مباحثه طلاب</h2>
                {isGradeMentor && mentorGradeLabel && (
                  <span className="px-3 py-1 bg-purple-50 border border-purple-200 text-purple-700 text-xs font-black rounded-full">
                    محدوده: {mentorGradeLabel}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {isGradeMentor 
                  ? `مشاهده و مدیریت ساعت مطالعه و مباحثه طلاب ${mentorGradeLabel}` 
                  : 'تعریف دوره‌ها، ثبت مستقل دقایق مطالعه و مباحثه، ارزیابی موظفی و مقایسه تراز طلاب'}
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

          {!isGradeMentor && (
            <button
              type="button"
              onClick={handleOpenCreatePeriod}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-200 cursor-pointer"
            >
              <Plus size={18} />
              <span>تعریف دوره مطالعاتی جدید</span>
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

                {/* Grade Supervisor Specific Actions */}
                {isGradeMentor && mentorGradeLabel && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleGradeExemption(selectedPeriod)}
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer",
                        isGradeExemptForSelected
                          ? "bg-purple-600 text-white"
                          : "bg-white border border-purple-200 text-purple-700 hover:bg-purple-50"
                      )}
                    >
                      <ShieldCheck size={14} />
                      <span>{isGradeExemptForSelected ? `لغو معافیت ${mentorGradeLabel}` : `معاف کردن ${mentorGradeLabel}`}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleClearGradeLogsInPeriod(selectedPeriod)}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl text-xs font-black transition-all cursor-pointer"
                      title="پاک‌کردن ثبت‌های این دوره برای طلاب پایه"
                    >
                      <span>پاک‌کردن ساعات این دوره</span>
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

