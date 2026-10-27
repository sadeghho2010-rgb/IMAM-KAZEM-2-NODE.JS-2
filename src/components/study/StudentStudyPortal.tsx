import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Student, StudyPeriod, PeriodicStudyLog, StudyDailyEntry, Program, Enrollment, CourseStudyDetail } from '../../types';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import FreeStudyRulesModal from './FreeStudyRulesModal';
import { 
  getLogMetrics, 
  calculatePeriodAverages, 
  isPeriodClosed, 
  isStudentExempt, 
  formatMinutesToHoursAndMinutes,
  addStudyDailyEntry,
  updateStudyDailyEntry,
  deleteStudyDailyEntry,
  getStudyWarningStatus
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

  // Track if user explicitly clicked a specific period in the dropdown
  const [userSelectedPeriodId, setUserSelectedPeriodId] = useState<string | null>(null);

  // Directly fetch/maintain periods to ensure strict synchronization with "لیست دوره‌های مطالعاتی ثبت‌شده"
  const [directPeriods, setDirectPeriods] = useState<StudyPeriod[]>([]);

  const loadDirectPeriods = useCallback(async () => {
    try {
      const allP = await localDb.getDocs<StudyPeriod>('study_periods');
      if (Array.isArray(allP)) {
        setDirectPeriods(allP);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadDirectPeriods();
  }, [loadDirectPeriods]);

  // Combined authoritative source: direct database query (if loaded) or prop periods
  const sourcePeriods = useMemo(() => {
    if (directPeriods.length > 0) return directPeriods;
    return periods || [];
  }, [directPeriods, periods]);

  // Filter out any deleted periods strictly
  const validPeriods = useMemo(() => {
    return (sourcePeriods || []).filter(p => 
      p && 
      p.id && 
      p.status !== 'deleted' && 
      !(p as any).isDeleted && 
      !(p as any).deletedAt
    );
  }, [sourcePeriods]);

  // Selected period for daily registration - automatically prefers open period
  const [activePeriodId, setActivePeriodId] = useState<string>(() => {
    const openP = validPeriods.find(p => !isPeriodClosed(p) && !isStudentExempt(p, student))
               || validPeriods.find(p => !isPeriodClosed(p));
    return openP?.id || validPeriods[0]?.id || '';
  });

  // Ensure activePeriodId is synchronized:
  // 1. If activePeriod was deleted -> auto-switch to open period
  // 2. "اگر بسته بود بسته بشه و اتومات بره روی دوره باز به صورت پیش فرض"
  useEffect(() => {
    if (validPeriods.length === 0) {
      if (activePeriodId) setActivePeriodId('');
      return;
    }

    const currentP = validPeriods.find(p => p.id === activePeriodId);
    const openP = validPeriods.find(p => !isPeriodClosed(p) && !isStudentExempt(p, student))
               || validPeriods.find(p => !isPeriodClosed(p));

    // If current selected period is deleted or does not exist:
    if (!currentP) {
      setActivePeriodId(openP?.id || validPeriods[0]?.id || '');
      return;
    }

    // If current period is closed and an open period exists, and student didn't manually pick this closed period:
    if (isPeriodClosed(currentP) && openP && activePeriodId !== openP.id && userSelectedPeriodId !== currentP.id) {
      setActivePeriodId(openP.id);
    }
  }, [validPeriods, activePeriodId, student, userSelectedPeriodId]);

  // Daily entries list state
  const [dailyEntries, setDailyEntries] = useState<StudyDailyEntry[]>([]);

  // Programs and Enrollments for student classes
  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  // Free Study Rules Modal
  const [showFreeRulesModal, setShowFreeRulesModal] = useState<boolean>(false);

  // Minutes-based entry inputs: per course study & discussion minutes
  const [courseStudyMinutes, setCourseStudyMinutes] = useState<Record<string, string>>({});
  const [courseDiscussionMinutes, setCourseDiscussionMinutes] = useState<Record<string, string>>({});
  const [freeStudyMinutesInput, setFreeStudyMinutesInput] = useState<string>('');
  const [entryNoteInput, setEntryNoteInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string>('');

  // Editing state for an existing daily entry
  const [editingEntry, setEditingEntry] = useState<StudyDailyEntry | null>(null);
  const [editCourseStudyMinutes, setEditCourseStudyMinutes] = useState<Record<string, string>>({});
  const [editCourseDiscussionMinutes, setEditCourseDiscussionMinutes] = useState<Record<string, string>>({});
  const [editFreeStudyMinutes, setEditFreeStudyMinutes] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');
  const [isUpdatingEntry, setIsUpdatingEntry] = useState<boolean>(false);

  const [chartViewMode, setChartViewMode] = useState<'TOTAL' | 'SPLIT'>('TOTAL');

  // Fetch programs and enrollments
  useEffect(() => {
    const fetchProgramsAndEnrollments = async () => {
      try {
        const [progList, enrList] = await Promise.all([
          localDb.getDocs<Program>('programs'),
          localDb.getDocs<Enrollment>('enrollments')
        ]);
        setPrograms(progList || []);
        setEnrollments(enrList || []);
      } catch (err) {
        console.warn('Error loading programs or enrollments:', err);
      }
    };
    fetchProgramsAndEnrollments();
  }, []);

  // Compute student's main classes
  const studentMainCourses = useMemo(() => {
    const studentEnrollments = enrollments.filter(e => e.studentId === student.id);
    const enrolledProgramIds = new Set(studentEnrollments.map(e => e.programId));

    let userProgs = programs.filter(p => 
      enrolledProgramIds.has(p.id) || 
      p.grade === student.grade || 
      (p as any).studentIds?.includes(student.id) ||
      (p as any).studentId === student.id
    );

    // Filter main courses strictly (ONLY core courses 'اصلی')
    const mainOnly = userProgs.filter(p => {
      if (p.type && p.type !== 'اصلی') return false;
      const typeStr = (p.type || '').trim();
      const titleStr = (p.title || '').trim();
      const isExcluded = ['مشاوره', 'پژوهش', 'دروس 5 شنبه', 'دروس ۵ شنبه', 'دروس پنج شنبه', 'دروس پنج‌شنبه', 'پنج شنبه', 'پنج‌شنبه', 'سایر'].some(k => typeStr.includes(k) || titleStr.includes(k));
      if (isExcluded) return false;
      return p.type === 'اصلی' || !p.type;
    });
    if (mainOnly.length > 0) {
      const seen = new Set<string>();
      const list: { id: string; title: string }[] = [];
      for (const p of mainOnly) {
        const cleanTitle = p.title.trim();
        if (!seen.has(cleanTitle)) {
          seen.add(cleanTitle);
          list.push({ id: p.id, title: cleanTitle });
        }
      }
      return list;
    }

    return [];
  }, [programs, enrollments, student]);

  // Active period object
  const currentPeriod = useMemo(() => {
    if (validPeriods.length === 0) return null;
    return validPeriods.find(p => p.id === activePeriodId) || validPeriods[0] || null;
  }, [validPeriods, activePeriodId]);

  // Load daily entries for this student & active period
  const loadDailyEntries = async () => {
    try {
      const allDaily = await localDb.getDocs<StudyDailyEntry>('study_daily_entries');
      const stIdStr = String(student.id || '').trim();
      const stNat = String(student.nationalId || '').trim();
      const uIdStr = String(currentUser?.id || '').trim();
      const uLinkedStr = String(currentUser?.linkedStudentId || '').trim();
      const uUsernameStr = String(currentUser?.username || '').trim();

      const filtered = allDaily.filter(e => {
        const pMatch = String(e.periodId || (e as any).period_id || '').trim() === String(activePeriodId || '').trim();
        if (!pMatch) return false;

        const eStId = String(e.studentId || (e as any).student_id || '').trim();
        const eNat = String((e as any).nationalId || (e as any).nationalCode || '').trim();
        const eUser = String((e as any).userId || '').trim();

        return (
          (stIdStr && eStId === stIdStr) ||
          (stNat && eNat === stNat) ||
          (stNat && eStId === stNat) ||
          (uIdStr && (eStId === uIdStr || eUser === uIdStr)) ||
          (uLinkedStr && eStId === uLinkedStr) ||
          (uUsernameStr && (eNat === uUsernameStr || eStId === uUsernameStr))
        );
      });

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
  }, [activePeriodId, student.id, currentUser?.id]);

  // Real-time synchronization for daily entries & logs across panels
  useEffect(() => {
    const handleDataChange = () => {
      loadDirectPeriods();
      loadDailyEntries();
      if (onRefresh) onRefresh();
    };

    const unsub = localDb.subscribe(handleDataChange);
    window.addEventListener('app_data_change', handleDataChange);
    window.addEventListener('collection_change_study_periods', handleDataChange);
    window.addEventListener('collection_change_study_daily_entries', handleDataChange);
    window.addEventListener('collection_change_periodic_study_logs', handleDataChange);
    window.addEventListener('storage', handleDataChange);

    const pollInterval = setInterval(() => {
      loadDirectPeriods();
      if (onRefresh) onRefresh();
    }, 5000);

    return () => {
      unsub();
      window.removeEventListener('app_data_change', handleDataChange);
      window.removeEventListener('collection_change_study_periods', handleDataChange);
      window.removeEventListener('collection_change_study_daily_entries', handleDataChange);
      window.removeEventListener('collection_change_periodic_study_logs', handleDataChange);
      window.removeEventListener('storage', handleDataChange);
      clearInterval(pollInterval);
    };
  }, [activePeriodId, student.id, onRefresh]);

  // Find existing aggregated log for current student & active period
  const currentPeriodLog = useMemo(() => {
    if (!currentPeriod) return null;
    const stIdStr = String(student.id || '').trim();
    const stNat = String(student.nationalId || '').trim();

    return allLogs.find(l => {
      const pMatch = String(l.periodId || (l as any).period_id || '').trim() === String(currentPeriod.id || '').trim();
      if (!pMatch) return false;

      const lStId = String(l.studentId || (l as any).student_id || '').trim();
      const lNat = String((l as any).nationalId || (l as any).nationalCode || '').trim();

      return (stIdStr && lStId === stIdStr) || (stNat && lNat === stNat) || (stNat && lStId === stNat);
    }) || null;
  }, [allLogs, student.id, student.nationalId, currentPeriod]);

  // Parsed minutes per course and free study
  const calculatedCoreStudyMinutes = useMemo(() => {
    return studentMainCourses.reduce((sum, c) => sum + (parseInt(courseStudyMinutes[c.id] || '0') || 0), 0);
  }, [studentMainCourses, courseStudyMinutes]);

  const calculatedCoreDiscussionMinutes = useMemo(() => {
    return studentMainCourses.reduce((sum, c) => sum + (parseInt(courseDiscussionMinutes[c.id] || '0') || 0), 0);
  }, [studentMainCourses, courseDiscussionMinutes]);

  const calculatedCoreTotalMinutes = calculatedCoreStudyMinutes + calculatedCoreDiscussionMinutes;
  const parsedFreeStudyMinutes = parseInt(freeStudyMinutesInput || '0') || 0;
  const calculatedTotalMinutes = calculatedCoreTotalMinutes + parsedFreeStudyMinutes;

  const calculatedTotalHours = Math.round((calculatedTotalMinutes / 60) * 10) / 10;

  const isCurrentPeriodClosed = isPeriodClosed(currentPeriod);
  const isCurrentStudentExempt = isStudentExempt(currentPeriod, student, currentPeriodLog);

  // When a period is closed or exempt, registration is strictly locked
  const isReadOnlyForUser = isCurrentPeriodClosed || isCurrentStudentExempt || (currentUser?.level === 3 && !currentPeriod);

  // Quick preset minute addition helpers for courses and free study
  const handleQuickAddCourseStudy = (courseId: string, amountMinutes: number) => {
    if (isReadOnlyForUser) return;
    const currentVal = parseInt(courseStudyMinutes[courseId] || '0') || 0;
    setCourseStudyMinutes(prev => ({
      ...prev,
      [courseId]: (currentVal + amountMinutes).toString()
    }));
  };

  const handleQuickAddCourseDisc = (courseId: string, amountMinutes: number) => {
    if (isReadOnlyForUser) return;
    const currentVal = parseInt(courseDiscussionMinutes[courseId] || '0') || 0;
    setCourseDiscussionMinutes(prev => ({
      ...prev,
      [courseId]: (currentVal + amountMinutes).toString()
    }));
  };

  const handleQuickAddFreeStudy = (amountMinutes: number) => {
    if (isReadOnlyForUser) return;
    const currentVal = parseInt(freeStudyMinutesInput || '0') || 0;
    setFreeStudyMinutesInput((currentVal + amountMinutes).toString());
  };

  // Handle Cumulative Submission (به دقیقه، با تفکیک کلاس‌های اصلی و مطالعه آزاد)
  const handleSaveHours = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPeriod || isReadOnlyForUser || isCurrentPeriodClosed) {
      alert('این دوره مطالعاتی بسته شده است و امکان ثبت ساعت کارکرد وجود ندارد.');
      return;
    }
    if (calculatedTotalMinutes <= 0) {
      alert('لطفاً حداقل مقدار برای یکی از دروس اصلی یا مطالعه آزاد را به دقیقه وارد نمایید.');
      return;
    }
    if (calculatedTotalMinutes > 2400) {
      alert('سقف مقدار قابل ثبت در یک نوبت حداکثر ۲۴۰۰ دقیقه (۴۰ ساعت) می‌باشد.');
      return;
    }

    setIsSaving(true);
    try {
      const coursesBreakdown: CourseStudyDetail[] = studentMainCourses.map(c => ({
        courseId: c.id,
        courseTitle: c.title,
        studyMinutes: parseInt(courseStudyMinutes[c.id] || '0') || 0,
        discussionMinutes: parseInt(courseDiscussionMinutes[c.id] || '0') || 0
      }));

      // Create new daily entry (Cumulative)
      await addStudyDailyEntry({
        periodId: currentPeriod.id,
        studentId: student.id,
        nationalId: student.nationalId || currentUser?.username,
        studentName: student.name || currentUser?.name,
        userId: currentUser?.id,
        studyHours: calculatedCoreStudyMinutes / 60,
        discussionHours: calculatedCoreDiscussionMinutes / 60,
        coursesBreakdown,
        freeStudyMinutes: parsedFreeStudyMinutes,
        coreTotalMinutes: calculatedCoreTotalMinutes,
        totalMinutes: calculatedTotalMinutes,
        submittedBy: currentUser?.level === 3 ? 'student' : 'officer',
        note: entryNoteInput.trim()
      } as any);

      // Clear input boxes immediately after success
      setCourseStudyMinutes({});
      setCourseDiscussionMinutes({});
      setFreeStudyMinutesInput('');
      setEntryNoteInput('');

      setSaveSuccessMessage('دقایق جدید با موفقیت ثبت شد و به مجموع کارکرد شما در این دوره افزوده گردید.');
      await loadDailyEntries();
      if (onRefresh) {
        setTimeout(() => onRefresh(), 50);
      }

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
    
    const studyMap: Record<string, string> = {};
    const discMap: Record<string, string> = {};

    if (Array.isArray(entry.coursesBreakdown) && entry.coursesBreakdown.length > 0) {
      entry.coursesBreakdown.forEach(c => {
        if (c.studyMinutes > 0) studyMap[c.courseId] = c.studyMinutes.toString();
        if (c.discussionMinutes > 0) discMap[c.courseId] = c.discussionMinutes.toString();
      });
    } else {
      // Legacy fallback
      const sMin = Math.round((entry.studyHours || 0) * 60);
      const dMin = Math.round((entry.discussionHours || 0) * 60);
      const firstCourseId = studentMainCourses[0]?.id || 'c_usul';
      if (sMin > 0) studyMap[firstCourseId] = sMin.toString();
      if (dMin > 0) discMap[firstCourseId] = dMin.toString();
    }

    setEditCourseStudyMinutes(studyMap);
    setEditCourseDiscussionMinutes(discMap);
    setEditFreeStudyMinutes(entry.freeStudyMinutes ? entry.freeStudyMinutes.toString() : '');
    setEditNote(entry.note || '');
  };

  const handleSaveEditEntry = async () => {
    if (!editingEntry || !currentPeriod) return;

    let editCoreStudyMin = 0;
    let editCoreDiscMin = 0;
    const coursesBreakdown: CourseStudyDetail[] = studentMainCourses.map(c => {
      const sMin = parseInt(editCourseStudyMinutes[c.id] || '0') || 0;
      const dMin = parseInt(editCourseDiscussionMinutes[c.id] || '0') || 0;
      editCoreStudyMin += sMin;
      editCoreDiscMin += dMin;
      return {
        courseId: c.id,
        courseTitle: c.title,
        studyMinutes: sMin,
        discussionMinutes: dMin
      };
    });

    const editCoreTotalMin = editCoreStudyMin + editCoreDiscMin;
    const editFreeMin = parseInt(editFreeStudyMinutes || '0') || 0;
    const editTotalMin = editCoreTotalMin + editFreeMin;

    setIsUpdatingEntry(true);
    try {
      await updateStudyDailyEntry(
        editingEntry.id,
        {
          studyHours: editCoreStudyMin / 60,
          discussionHours: editCoreDiscMin / 60,
          coursesBreakdown,
          freeStudyMinutes: editFreeMin,
          coreTotalMinutes: editCoreTotalMin,
          totalMinutes: editTotalMin,
          note: editNote.trim()
        },
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
    const totalMinutesLabel = entry.totalMinutes ? `${entry.totalMinutes} دقیقه` : `${entry.totalHours} ساعت`;
    if (!window.confirm(`آیا از حذف این ثبت (${totalMinutesLabel}) اطمینان دارید؟`)) return;

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
    let totalCoreStudyMin = 0;
    let totalCoreDiscMin = 0;
    let totalFreeMin = 0;
    let totalSumMin = 0;

    dailyEntries.forEach(e => {
      totalFreeMin += Number(e.freeStudyMinutes) || 0;
      if (Array.isArray(e.coursesBreakdown) && e.coursesBreakdown.length > 0) {
        e.coursesBreakdown.forEach(c => {
          totalCoreStudyMin += Number(c.studyMinutes) || 0;
          totalCoreDiscMin += Number(c.discussionMinutes) || 0;
        });
      } else {
        totalCoreStudyMin += Math.round((Number(e.studyHours) || 0) * 60);
        totalCoreDiscMin += Math.round((Number(e.discussionHours) || 0) * 60);
      }
    });

    const totalCoreMin = totalCoreStudyMin + totalCoreDiscMin;
    totalSumMin = totalCoreMin + totalFreeMin;

    const mandatoryTotalMin = currentPeriod?.mandatoryMinutes || Math.round((currentPeriod?.mandatoryHours || 0) * 60);
    const mandatoryCoreMin = currentPeriod?.mandatoryCoreMinutes ?? Math.round(mandatoryTotalMin * 0.75);

    const diffTotalMin = totalSumMin - mandatoryTotalMin;
    const diffCoreMin = totalCoreMin - mandatoryCoreMin;

    const isCoreFulfilled = totalCoreMin >= mandatoryCoreMin;
    const isTotalFulfilled = totalSumMin >= mandatoryTotalMin;
    const isFullyFulfilled = isCoreFulfilled && isTotalFulfilled && mandatoryTotalMin > 0;

    return {
      totalCoreStudyMin,
      totalCoreDiscMin,
      totalCoreMin,
      totalFreeMin,
      totalSumMin,
      totalStudyHours: Math.round((totalCoreStudyMin / 60) * 10) / 10,
      totalDiscHours: Math.round((totalCoreDiscMin / 60) * 10) / 10,
      totalSumHours: Math.round((totalSumMin / 60) * 10) / 10,
      mandatoryTotalMin,
      mandatoryCoreMin,
      diffTotalMin,
      diffCoreMin,
      isCoreFulfilled,
      isTotalFulfilled,
      isFullyFulfilled
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
                  onChange={(e) => {
                    setActivePeriodId(e.target.value);
                    setUserSelectedPeriodId(e.target.value);
                  }}
                  className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer min-w-[210px]"
                >
                  {validPeriods.map(p => {
                    const closed = isPeriodClosed(p);
                    const exempt = isStudentExempt(p, student);
                    return (
                      <option key={p.id} value={p.id}>
                        {p.title} {closed ? '(🔒 بسته)' : exempt ? '(🛡️ معاف)' : '(🟢 باز / فعال)'}
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
                      موظفی کل دوره: <b className="text-indigo-600 font-black">{currentPeriod.mandatoryMinutes || Math.round((currentPeriod.mandatoryHours || 0) * 60)} دقیقه</b> ({((currentPeriod.mandatoryMinutes || Math.round((currentPeriod.mandatoryHours || 0) * 60)) / 60).toFixed(1)} ساعت)
                    </span>

                    <span className="px-3 py-1 bg-amber-50 border border-amber-200 rounded-xl font-bold text-amber-900 shadow-2xs">
                      حداقل دروس اصلی: <b className="text-amber-700 font-black">{currentPeriod.mandatoryCoreMinutes ?? Math.round(((currentPeriod.mandatoryMinutes || Math.round((currentPeriod.mandatoryHours || 0) * 60)) * 0.75))} دقیقه</b>
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

                {/* --- Section 1: Main Seminary Classes (فیلد مطالعه و مباحثه به دقیقه به ازای هر کلاس اصلی) --- */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <BookOpen size={16} className="text-indigo-600" />
                      <h4 className="text-xs sm:text-sm font-black text-slate-900">
                        ۱. ثبت کارکرد دروس اصلی طلبه (به دقیقه)
                      </h4>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">
                      تعداد دروس اصلی شناسایی‌شده: {studentMainCourses.length} درس
                    </span>
                  </div>

                  <div className="space-y-4">
                    {studentMainCourses.map((course, idx) => {
                      const sVal = courseStudyMinutes[course.id] || '';
                      const dVal = courseDiscussionMinutes[course.id] || '';
                      const sNum = parseInt(sVal) || 0;
                      const dNum = parseInt(dVal) || 0;

                      return (
                        <div
                          key={course.id}
                          className="bg-slate-50/70 border border-slate-200/90 hover:border-indigo-200 rounded-2xl p-4 transition-all space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-indigo-950 flex items-center gap-2">
                              <span className="w-5 h-5 rounded-lg bg-indigo-100 text-indigo-800 text-[11px] font-bold flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <span>درس اصلی: {course.title}</span>
                            </span>
                            <span className="text-[11px] font-bold text-slate-500">
                              مجموع این درس: <b className="text-indigo-700">{sNum + dNum} دقیقه</b> {sNum + dNum > 0 ? `(${((sNum + dNum) / 60).toFixed(1)} ساعت)` : ''}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Study Minutes Input */}
                            <div className="bg-indigo-50/50 border border-indigo-200/70 rounded-xl p-3 space-y-2 focus-within:border-indigo-500 transition-all">
                              <div className="flex items-center justify-between">
                                <label className="text-[11px] font-black text-indigo-900 flex items-center gap-1.5">
                                  <BookOpen size={14} className="text-indigo-600" />
                                  <span>ساعت مطالعه {course.title} (دقیقه)</span>
                                </label>
                                {sNum > 0 && (
                                  <span className="text-[10px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-indigo-100">
                                    {(sNum / 60).toFixed(1)} ساعت
                                  </span>
                                )}
                              </div>

                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  max="1440"
                                  disabled={isReadOnlyForUser}
                                  value={sVal}
                                  onChange={(e) => setCourseStudyMinutes(prev => ({ ...prev, [course.id]: e.target.value }))}
                                  placeholder="مثلاً ۹۰ یا ۶۰ دقیقه"
                                  className="w-full pr-3 pl-12 py-2.5 bg-white border border-indigo-200 rounded-xl text-slate-900 font-black text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                                />
                                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400 pointer-events-none">
                                  دقیقه
                                </span>
                              </div>

                              {!isReadOnlyForUser && (
                                <div className="flex items-center gap-1 pt-0.5 flex-wrap">
                                  <span className="text-[10px] text-slate-400 font-bold ml-1">افزودن:</span>
                                  {[30, 45, 60, 90].map(mins => (
                                    <button
                                      key={mins}
                                      type="button"
                                      onClick={() => handleQuickAddCourseStudy(course.id, mins)}
                                      className="px-2 py-0.5 bg-white hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg border border-indigo-200 transition-all cursor-pointer"
                                    >
                                      +{mins}د
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Discussion Minutes Input */}
                            <div className="bg-emerald-50/50 border border-emerald-200/70 rounded-xl p-3 space-y-2 focus-within:border-emerald-500 transition-all">
                              <div className="flex items-center justify-between">
                                <label className="text-[11px] font-black text-emerald-950 flex items-center gap-1.5">
                                  <MessageSquare size={14} className="text-emerald-600" />
                                  <span>ساعت مباحثه {course.title} (دقیقه)</span>
                                </label>
                                {dNum > 0 && (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-100">
                                    {(dNum / 60).toFixed(1)} ساعت
                                  </span>
                                )}
                              </div>

                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  max="1440"
                                  disabled={isReadOnlyForUser}
                                  value={dVal}
                                  onChange={(e) => setCourseDiscussionMinutes(prev => ({ ...prev, [course.id]: e.target.value }))}
                                  placeholder="مثلاً ۶۰ یا ۴۵ دقیقه"
                                  className="w-full pr-3 pl-12 py-2.5 bg-white border border-emerald-200 rounded-xl text-slate-900 font-black text-sm outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
                                />
                                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400 pointer-events-none">
                                  دقیقه
                                </span>
                              </div>

                              {!isReadOnlyForUser && (
                                <div className="flex items-center gap-1 pt-0.5 flex-wrap">
                                  <span className="text-[10px] text-slate-400 font-bold ml-1">افزودن:</span>
                                  {[30, 45, 60, 90].map(mins => (
                                    <button
                                      key={mins}
                                      type="button"
                                      onClick={() => handleQuickAddCourseDisc(course.id, mins)}
                                      className="px-2 py-0.5 bg-white hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-200 transition-all cursor-pointer"
                                    >
                                      +{mins}د
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* --- Section 2: Free Study (مطالعه آزاد به دقیقه) & Guidelines Button --- */}
                <div className="bg-gradient-to-r from-teal-50/70 via-emerald-50/50 to-teal-50/70 border-2 border-teal-200/90 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-teal-200/60">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-teal-700" />
                      <label className="text-xs sm:text-sm font-black text-teal-950">
                        ۲. میزان مطالعه آزاد (به دقیقه)
                      </label>
                    </div>

                    {/* Button for Free Study Guidelines & Rules */}
                    <button
                      type="button"
                      onClick={() => setShowFreeRulesModal(true)}
                      title="مشاهده و ویرایش ضوابط و قوانین مطالعه آزاد"
                      className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-1.5 cursor-pointer self-start sm:self-auto hover:shadow-teal-600/20"
                    >
                      <Info size={14} />
                      <span>توضیحات و قوانین مطالعه آزاد</span>
                    </button>
                  </div>

                  <div className="p-3 bg-white border border-teal-200 rounded-xl space-y-1 text-xs text-teal-950 font-medium leading-relaxed">
                    <p>
                      برای مطالعه دروس اصلی مجموعه حداقل 800 دقیقه قرار داده شده است ، دوستان طلبه می توانند پس از پرکردن این حداقل به انجام مطالعه آزاد بپردازند.
                    </p>
                    <p className="text-[11px] text-teal-700 font-bold pt-1 border-t border-teal-100">
                      جهت اطلاع از قوانین مطالعه آزاد بر روی توضیحات مطالعه آزاد کلیک فرمایید.
                    </p>
                  </div>

                  <div className="pt-1">
                    <div className="space-y-2">
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          disabled={isReadOnlyForUser}
                          value={freeStudyMinutesInput}
                          onChange={(e) => setFreeStudyMinutesInput(e.target.value)}
                          placeholder="مثلاً ۱۲۰ یا ۲۴۰ دقیقه (بدون محدودیت)"
                          className="w-full pr-3 pl-12 py-3 bg-white border border-teal-300 rounded-xl text-slate-900 font-black text-base outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                        <span className="absolute left-3 top-3 text-xs font-bold text-slate-400 pointer-events-none">
                          دقیقه
                        </span>
                      </div>

                      {!isReadOnlyForUser && (
                        <div className="flex items-center gap-1 pt-0.5 flex-wrap">
                          <span className="text-[10px] text-slate-400 font-bold ml-1">افزودن سریع:</span>
                          {[30, 60, 90, 120, 180, 240].map(mins => (
                            <button
                              key={mins}
                              type="button"
                              onClick={() => handleQuickAddFreeStudy(mins)}
                              className="px-2.5 py-0.5 bg-white hover:bg-teal-100 text-teal-800 text-[10.5px] font-bold rounded-lg border border-teal-300 transition-all cursor-pointer"
                            >
                              +{mins}د
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* --- Section 3: Real-Time Registration Summary Card --- */}
                <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 space-y-4 shadow-lg border border-indigo-900/50">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <Calculator size={18} className="text-amber-400" />
                      <h4 className="text-xs sm:text-sm font-black text-white">
                        ۳. پیش‌نمایش و خلاصه کارکرد این نوبت ثبت
                      </h4>
                    </div>
                    <span className="text-[11px] font-bold text-amber-300 bg-amber-400/20 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                      محاسبه خودکار به دقیقه
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {/* Core Classes Sum */}
                    <div className="bg-white/10 border border-white/15 rounded-xl p-3.5 space-y-1">
                      <span className="text-[11px] font-bold text-indigo-200 block">مجموع دروس اصلی (مطالعه + مباحثه)</span>
                      <div className="text-xl font-black text-white">
                        {calculatedCoreTotalMinutes} <span className="text-xs font-normal text-indigo-200">دقیقه</span>
                      </div>
                      <p className="text-[10px] text-indigo-300 font-medium">
                        معادل {((calculatedCoreTotalMinutes) / 60).toFixed(1)} ساعت
                        (مطالعه: {calculatedCoreStudyMinutes}د • مباحثه: {calculatedCoreDiscussionMinutes}د)
                      </p>
                    </div>

                    {/* Free Study Sum */}
                    <div className="bg-white/10 border border-white/15 rounded-xl p-3.5 space-y-1">
                      <span className="text-[11px] font-bold text-teal-200 block">سهم مطالعه آزاد</span>
                      <div className="text-xl font-black text-teal-300">
                        {parsedFreeStudyMinutes} <span className="text-xs font-normal text-teal-200">دقیقه</span>
                      </div>
                      <p className="text-[10px] text-teal-200/80 font-medium">
                        معادل {((parsedFreeStudyMinutes) / 60).toFixed(1)} ساعت
                      </p>
                    </div>

                    {/* Grand Total */}
                    <div className="bg-white/15 border border-amber-400/30 rounded-xl p-3.5 space-y-1">
                      <span className="text-[11px] font-bold text-amber-300 block">مجموع کل این ثبت (اصلی + آزاد)</span>
                      <div className="text-xl font-black text-amber-300">
                        {calculatedTotalMinutes} <span className="text-xs font-normal text-amber-200">دقیقه</span>
                      </div>
                      <p className="text-[10px] text-slate-300 font-medium">
                        معادل {calculatedTotalHours} ساعت کارکرد
                      </p>
                    </div>
                  </div>
                </div>

                {/* Optional Note / Description input */}
                {!isReadOnlyForUser && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 block">
                      توضیحات، مبحث یا عنوان کتاب مطالعه آزاد (اختیاری):
                    </label>
                    <input
                      type="text"
                      placeholder="مثلاً: مطالعه کتاب مکاسب محرمه - مباحثه کفایه - مطالعه آزاد تفسیر المیزان جلد ۳..."
                      value={entryNoteInput}
                      onChange={(e) => setEntryNoteInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
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
                        : 'با زدن دکمه ثبت، دقایق وارد شده به کارکرد کل دوره افزوده شده و فیلدها پاک می‌شوند.'}
                    </span>
                  </div>

                  {isReadOnlyForUser ? (
                    <div className="w-full sm:w-auto px-6 py-3 bg-rose-50 border border-rose-200 text-rose-800 font-black text-xs rounded-2xl flex items-center justify-center gap-2">
                      <Lock size={16} className="text-rose-600" />
                      <span>{isCurrentPeriodClosed ? 'دوره مطالعاتی بسته شده است (ثبت کارکرد غیرفعال)' : 'معاف از ثبت موظفی'}</span>
                    </div>
                  ) : (
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
          <div className="bg-gradient-to-br from-indigo-50 via-slate-50 to-indigo-50/40 p-5 md:p-6 rounded-3xl border border-indigo-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100 pb-3">
              <div className="flex items-center gap-2">
                <Calculator size={18} className="text-indigo-600" />
                <h4 className="text-sm font-black text-indigo-950">
                  خلاصه مجموع ثبت‌شده‌ها و مجموع کارکرد دوره «{currentPeriod?.title}»
                </h4>
              </div>
              <span className="text-xs font-bold text-indigo-800 bg-white px-3.5 py-1 rounded-xl border border-indigo-200 shadow-2xs self-start sm:self-auto">
                تعداد ثبت‌های انجام‌شده: {dailyEntries.length} مورد
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Core Courses Total */}
              <div className="bg-white p-4 rounded-2xl border border-indigo-200/80 shadow-2xs space-y-1">
                <span className="text-[11px] font-bold text-indigo-900 block">مجموع دروس اصلی</span>
                <div className="text-xl font-black text-indigo-700">
                  {activePeriodTotals.totalCoreMin.toLocaleString('fa-IR')} <span className="text-xs font-normal text-slate-500">دقیقه</span>
                </div>
                <p className="text-[10px] text-indigo-900/70 font-bold">
                  معادل {(activePeriodTotals.totalCoreMin / 60).toFixed(1)} ساعت
                  <span className="block text-[9.5px] text-slate-500 font-medium">(مطالعه: {activePeriodTotals.totalCoreStudyMin}د • مباحثه: {activePeriodTotals.totalCoreDiscMin}د)</span>
                </p>
              </div>

              {/* Free Study Total */}
              <div className="bg-white p-4 rounded-2xl border border-teal-200/80 shadow-2xs space-y-1">
                <span className="text-[11px] font-bold text-teal-900 block">سهم مطالعه آزاد</span>
                <div className="text-xl font-black text-teal-700">
                  {activePeriodTotals.totalFreeMin.toLocaleString('fa-IR')} <span className="text-xs font-normal text-slate-500">دقیقه</span>
                </div>
                <p className="text-[10px] text-teal-900/70 font-bold">
                  معادل {(activePeriodTotals.totalFreeMin / 60).toFixed(1)} ساعت
                </p>
              </div>

              {/* Grand Total Overall */}
              <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 text-white p-4 rounded-2xl border border-indigo-800 shadow-md col-span-1 sm:col-span-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-indigo-200 block">مجموع کل کارکرد (دروس اصلی + مطالعه آزاد)</span>
                  {activePeriodTotals.mandatoryTotalMin > 0 && (
                    <span className={cn(
                      "text-[10px] font-black px-2.5 py-0.5 rounded-full border",
                      activePeriodTotals.isFullyFulfilled 
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30" 
                        : "bg-amber-500/20 text-amber-300 border-amber-400/30"
                    )}>
                      {activePeriodTotals.diffTotalMin >= 0 
                        ? `+${Math.round(activePeriodTotals.diffTotalMin / 60)} ساعت مازاد موظفی` 
                        : `${Math.round(Math.abs(activePeriodTotals.diffTotalMin) / 60)} ساعت کسری موظفی`}
                    </span>
                  )}
                </div>
                <div className="text-2xl font-black text-amber-300 flex items-baseline gap-2">
                  <span>{activePeriodTotals.totalSumMin.toLocaleString('fa-IR')} <span className="text-xs font-normal text-indigo-200">دقیقه</span></span>
                  <span className="text-sm text-white font-bold">({activePeriodTotals.totalSumHours.toLocaleString('fa-IR')} ساعت کارکرد کل)</span>
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
                      <th className="py-3 px-3">تاریخ و ساعت دقیق</th>
                      <th className="py-3 px-3">ریز دروس اصلی (مطالعه و مباحثه)</th>
                      <th className="py-3 px-3 text-center">مطالعه آزاد</th>
                      <th className="py-3 px-3 text-center">مجموع دروس اصلی</th>
                      <th className="py-3 px-3 text-center bg-indigo-50/50 text-indigo-950 font-black">مجموع کل ثبت</th>
                      <th className="py-3 px-3">توضیحات</th>
                      {!isReadOnlyForUser && <th className="py-3 px-3 text-center">عملیات</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {dailyEntries.map((entry, idx) => {
                      const breakdown = entry.coursesBreakdown || [];
                      const freeMin = entry.freeStudyMinutes || 0;
                      let entryCoreStudy = 0;
                      let entryCoreDisc = 0;

                      if (breakdown.length > 0) {
                        breakdown.forEach(c => {
                          entryCoreStudy += c.studyMinutes || 0;
                          entryCoreDisc += c.discussionMinutes || 0;
                        });
                      } else {
                        entryCoreStudy = Math.round((entry.studyHours || 0) * 60);
                        entryCoreDisc = Math.round((entry.discussionHours || 0) * 60);
                      }

                      const entryCoreTotal = entry.coreTotalMinutes ?? (entryCoreStudy + entryCoreDisc);
                      const entryTotal = entry.totalMinutes ?? (entryCoreTotal + freeMin);

                      return (
                        <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-3 text-slate-400 font-bold">{idx + 1}</td>
                          <td className="py-3.5 px-3 text-slate-800 font-bold whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Clock size={13} className="text-indigo-600 shrink-0" />
                              <span>{entry.entryDate || '---'}</span>
                              <span className="text-[10px] text-slate-400 font-normal">({entry.entryTime || '---'})</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            {breakdown.length > 0 ? (
                              <div className="space-y-1">
                                {breakdown.filter(c => c.studyMinutes > 0 || c.discussionMinutes > 0).map(c => (
                                  <div key={c.courseId} className="flex items-center gap-2 text-[11px]">
                                    <span className="font-bold text-slate-700">{c.courseTitle}:</span>
                                    <span className="text-indigo-700 font-bold">مطالعه: {c.studyMinutes}د</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-emerald-700 font-bold">مباحثه: {c.discussionMinutes}د</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-600">
                                <span className="text-indigo-700 font-bold">مطالعه: {entryCoreStudy}د</span>
                                <span className="text-slate-300 mx-1">•</span>
                                <span className="text-emerald-700 font-bold">مباحثه: {entryCoreDisc}د</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-center font-bold text-teal-700 bg-teal-50/30 whitespace-nowrap">
                            {freeMin > 0 ? `${freeMin} دقیقه (${(freeMin / 60).toFixed(1)}س)` : <span className="text-slate-300 font-normal">۰</span>}
                          </td>
                          <td className="py-3.5 px-3 text-center font-bold text-slate-800 whitespace-nowrap">
                            {entryCoreTotal} دقیقه
                            <span className="block text-[10px] text-slate-400 font-normal">
                              ({(entryCoreTotal / 60).toFixed(1)} ساعت)
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-center font-black text-indigo-900 bg-indigo-50/40 whitespace-nowrap">
                            {entryTotal} دقیقه
                            <span className="block text-[10px] text-indigo-600 font-bold">
                              ({(entryTotal / 60).toFixed(1)} ساعت)
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-slate-600 text-[11px] max-w-xs">
                            {entry.note || <span className="text-slate-300">بدون توضیح</span>}
                          </td>
                          {!isReadOnlyForUser && (
                            <td className="py-3.5 px-3 text-center whitespace-nowrap">
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
                      );
                    })}
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
              className="bg-white rounded-3xl p-6 md:p-8 max-w-xl w-full shadow-2xl border border-slate-100 space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Edit size={18} className="text-indigo-600" />
                  <h3 className="text-sm font-black text-slate-900">ویرایش ثبت مطالعه و مباحثه (به دقیقه)</h3>
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

                {/* Edit inputs per main course */}
                <div className="space-y-3">
                  <span className="text-xs font-black text-slate-800 block">دقایق دروس اصلی:</span>
                  {studentMainCourses.map(course => (
                    <div key={course.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <span className="text-xs font-bold text-slate-900 block">{course.title}</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold block mb-1">دقیقه مطالعه:</label>
                          <input
                            type="number"
                            min="0"
                            value={editCourseStudyMinutes[course.id] || ''}
                            onChange={(e) => setEditCourseStudyMinutes(prev => ({ ...prev, [course.id]: e.target.value }))}
                            placeholder="دقیقه مطالعه"
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold block mb-1">دقیقه مباحثه:</label>
                          <input
                            type="number"
                            min="0"
                            value={editCourseDiscussionMinutes[course.id] || ''}
                            onChange={(e) => setEditCourseDiscussionMinutes(prev => ({ ...prev, [course.id]: e.target.value }))}
                            placeholder="دقیقه مباحثه"
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Edit Free Study */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-teal-900 block">دقیقه مطالعه آزاد:</label>
                  <input
                    type="number"
                    min="0"
                    value={editFreeStudyMinutes}
                    onChange={(e) => setEditFreeStudyMinutes(e.target.value)}
                    placeholder="دقیقه مطالعه آزاد"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-teal-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
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

      {/* Free Study Guidelines & Rules Modal */}
      <FreeStudyRulesModal
        isOpen={showFreeRulesModal}
        onClose={() => setShowFreeRulesModal(false)}
        periodRuleOverride={currentPeriod?.freeStudyRuleText}
      />
    </div>
  );
}
