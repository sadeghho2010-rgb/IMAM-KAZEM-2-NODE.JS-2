import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  BookOpen,
  Clock,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Save,
  Info,
  MessageSquare,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { localDb } from '../../../lib/localDb';
import { emitSaveConfirmation, setWriteInProgress } from '../../../lib/saveFeedback';
import { useAuth } from '../../../context/AuthContext';
import {
  Student,
  StudyPeriod,
  StudyDailyEntry,
  Program,
  Enrollment,
  PeriodicStudyLog,
  CourseStudyDetail,
} from '../../../types';
import { getTodayShamsi } from '../../../lib/jalali';
import {
  formatMinutesToHoursAndMinutes,
  getStudyWarningStatus,
  syncAggregatePeriodicStudyLog,
  isPeriodClosed,
  isCoreCurriculumProgram,
  isStudentEnrolledInProgram,
  buildStudentCandidateIds,
} from '../../study/studyUtils';
import FreeStudyRulesModal from '../../study/FreeStudyRulesModal';
import { AnimatedRingGauge } from './AnimatedRingGauge';

interface StudentMobileStudyProps {
  onNavigateTab?: (tab: string, studentId?: string) => void;
}

export const StudentMobileStudy: React.FC<StudentMobileStudyProps> = () => {
  const { currentUser } = useAuth();
  const prefersReducedMotion = useReducedMotion();

  const [studentObj, setStudentObj] = useState<Student | null>(null);
  const [periods, setPeriods] = useState<StudyPeriod[]>([]);
  const [activePeriodId, setActivePeriodId] = useState<string>('');
  const [userSelectedPeriodId, setUserSelectedPeriodId] = useState<string | null>(null);
  const [dailyEntries, setDailyEntries] = useState<StudyDailyEntry[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const initialLoadDoneRef = React.useRef(false);

  // Per-course minute input states
  const [courseStudyMinutes, setCourseStudyMinutes] = useState<Record<string, string>>({});
  const [courseDiscussionMinutes, setCourseDiscussionMinutes] = useState<Record<string, string>>({});
  const [freeStudyMinutesInput, setFreeStudyMinutesInput] = useState<string>('');
  const [freeStudyBookTitle, setFreeStudyBookTitle] = useState<string>('');
  const [entryDate] = useState<string>(() => getTodayShamsi());

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');
  const [showFreeRulesModal, setShowFreeRulesModal] = useState<boolean>(false);
  const [entryToDelete, setEntryToDelete] = useState<StudyDailyEntry | null>(null);

  useEffect(() => {
    loadAllData(true);

    const handleSilentRefresh = () => loadAllData(false);
    const unsub = localDb.subscribe(handleSilentRefresh);

    const handleDataChange = (e: any) => {
      const col = e?.detail?.collection;
      if (
        !col ||
        col === 'study_periods' ||
        col === 'study_daily_entries' ||
        col === 'periodic_study_logs' ||
        col === 'programs' ||
        col === 'enrollments' ||
        col === 'all'
      ) {
        loadAllData(false);
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === 'study_periods_updated_at' ||
        e.key === 'study_logs_updated_at' ||
        e.key === 'programs_updated_at' ||
        (e.key && e.key.includes('study'))
      ) {
        loadAllData(false);
      }
    };

    window.addEventListener('app_data_change', handleDataChange);
    window.addEventListener('collection_change_study_periods', handleSilentRefresh);
    window.addEventListener('collection_change_study_daily_entries', handleSilentRefresh);
    window.addEventListener('collection_change_periodic_study_logs', handleSilentRefresh);
    window.addEventListener('collection_change_programs', handleSilentRefresh);
    window.addEventListener('storage', handleStorage);

    return () => {
      unsub();
      window.removeEventListener('app_data_change', handleDataChange);
      window.removeEventListener('collection_change_study_periods', handleSilentRefresh);
      window.removeEventListener('collection_change_study_daily_entries', handleSilentRefresh);
      window.removeEventListener('collection_change_periodic_study_logs', handleSilentRefresh);
      window.removeEventListener('collection_change_programs', handleSilentRefresh);
      window.removeEventListener('storage', handleStorage);
    };
  }, [currentUser]);

  const loadAllData = async (isInitial = false) => {
    try {
      if (isInitial && !initialLoadDoneRef.current) {
        setIsLoading(true);
      }
      const [allStudents, allPeriods, allProgs, courseEnrolls, legacyEnrolls, allDaily] = await Promise.all([
        localDb.getDocs<Student>('students'),
        localDb.getDocs<StudyPeriod>('study_periods'),
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<any>('course_enrollments'),
        localDb.getDocs<Enrollment>('enrollments'),
        localDb.getDocs<StudyDailyEntry>('study_daily_entries'),
      ]);

      const sId = currentUser?.studentId || currentUser?.linkedStudentId || currentUser?.id;
      const uName = (currentUser?.username || '').trim().toLowerCase();
      const cName = (currentUser?.name || currentUser?.fullName || '').trim().toLowerCase();

      const matched = (allStudents || []).find(
        (s) =>
          (sId && String(s.id) === String(sId)) ||
          (uName && (s.nationalId?.toLowerCase() === uName || s.studentCode?.toLowerCase() === uName)) ||
          (cName && s.name?.toLowerCase().includes(cName))
      );
      if (matched) setStudentObj(matched);

      const validPeriods = (allPeriods || []).filter(
        (p) => p && p.id && p.status !== 'deleted' && !(p as any).isDeleted && !(p as any).deletedAt
      );

      const sortedPeriods = [...validPeriods].sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );
      setPeriods(sortedPeriods);

      setActivePeriodId((prev) => {
        const currentP = sortedPeriods.find((p) => p.id === prev);
        const openP = sortedPeriods.find((p) => !isPeriodClosed(p));
        if (!prev || !currentP) {
          return openP?.id || sortedPeriods[0]?.id || '';
        }
        if (isPeriodClosed(currentP) && openP && userSelectedPeriodId !== prev) {
          return openP.id;
        }
        return prev;
      });

      setPrograms(allProgs || []);
      setEnrollments([...(courseEnrolls || []), ...(legacyEnrolls || [])]);

      const targetStudentId = matched?.id || sId || currentUser?.id;
      const candidateIds = [
        targetStudentId,
        matched?.id,
        matched?.studentCode,
        matched?.nationalId,
        sId,
        currentUser?.id,
        currentUser?.username,
      ]
        .filter(Boolean)
        .map((x) => String(x).toLowerCase().trim());

      const myEntries = (allDaily || []).filter((e) => {
        const eIds = [
          e.studentId,
          (e as any).student_id,
          (e as any).userId,
          (e as any).nationalId,
          (e as any).studentCode,
        ]
          .filter(Boolean)
          .map((x) => String(x).toLowerCase().trim());
        return candidateIds.some((cid) => eIds.includes(cid));
      });

      setDailyEntries(myEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      console.warn('Error loading study data:', e);
    } finally {
      initialLoadDoneRef.current = true;
      setIsLoading(false);
    }
  };

  const studentId = studentObj?.id || currentUser?.studentId || currentUser?.id || '';

  const studentCourses = useMemo(() => {
    const candidateIds = buildStudentCandidateIds(
      studentObj,
      [currentUser?.id, currentUser?.studentId, currentUser?.linkedStudentId, currentUser?.username].filter(
        Boolean
      ) as string[]
    );

    const mainOnly = programs.filter(
      (p) => isCoreCurriculumProgram(p) && isStudentEnrolledInProgram(p, studentObj, enrollments, candidateIds)
    );
    const seen = new Set<string>();
    const list: { id: string; title: string }[] = [];
    for (const p of mainOnly) {
      const title = (p.title || '').trim();
      if (title && !seen.has(title)) {
        seen.add(title);
        list.push({ id: p.id, title });
      }
    }
    return list;
  }, [programs, enrollments, studentObj, currentUser]);

  const activePeriod = useMemo(() => {
    return periods.find((p) => p.id === activePeriodId) || periods[0] || null;
  }, [periods, activePeriodId]);

  const isCurrentPeriodClosed = isPeriodClosed(activePeriod);

  const currentPeriodEntries = useMemo(() => {
    return dailyEntries.filter((e) => e.periodId === activePeriodId);
  }, [dailyEntries, activePeriodId]);

  const totals = useMemo(() => {
    let coreStudy = 0;
    let coreDisc = 0;
    let free = 0;

    currentPeriodEntries.forEach((entry) => {
      if (entry.coursesBreakdown && Array.isArray(entry.coursesBreakdown)) {
        entry.coursesBreakdown.forEach((cd) => {
          coreStudy += cd.studyMinutes || 0;
          coreDisc += cd.discussionMinutes || 0;
        });
      } else {
        coreStudy += Math.round((entry.studyHours || 0) * 60);
        coreDisc += Math.round((entry.discussionHours || 0) * 60);
      }
      free += entry.freeStudyMinutes || 0;
    });

    const coreTotal = coreStudy + coreDisc;
    const overallTotal = coreTotal + free;

    const syntheticLog: PeriodicStudyLog = {
      id: `synth_${studentId}_${activePeriod?.id}`,
      periodId: activePeriod?.id || '',
      studentId,
      hours: Math.round((overallTotal / 60) * 10) / 10,
      studyHours: Math.round((coreStudy / 60) * 10) / 10,
      discussionHours: Math.round((coreDisc / 60) * 10) / 10,
      totalMinutes: overallTotal,
      coreTotalMinutes: coreTotal,
      freeStudyMinutes: free,
    };

    const warningStatus = activePeriod
      ? getStudyWarningStatus(activePeriod, syntheticLog, studentObj || undefined)
      : {
          isExempt: false,
          hasWarning: false,
          isCoreDeficit: false,
          isTotalDeficit: false,
          isCommended: false,
          warningType: 'none' as const,
          statusLabel: 'عادی',
          shortBadge: '',
          badgeClass: '',
          coreDeficitMinutes: 0,
          totalDeficitMinutes: 0,
          coreSurplusMinutes: 0,
          totalSurplusMinutes: 0,
          mandatoryTotalMinutes: 800,
          mandatoryCoreMinutes: 600,
        };

    const mandatoryTotal = warningStatus.mandatoryTotalMinutes || 800;
    const pct = mandatoryTotal > 0 ? Math.min(100, Math.round((overallTotal / mandatoryTotal) * 100)) : 0;

    return {
      coreStudy,
      coreDisc,
      coreTotal,
      free,
      overallTotal,
      mandatoryTotal,
      pct,
      warningStatus,
    };
  }, [currentPeriodEntries, studentObj, studentId, activePeriod]);

  const addCourseMinutes = (courseId: string, type: 'study' | 'disc', delta: number) => {
    if (isCurrentPeriodClosed) return;
    setValidationError('');
    if (type === 'study') {
      const currentVal = parseInt(courseStudyMinutes[courseId] || '0', 10) || 0;
      setCourseStudyMinutes((prev) => ({
        ...prev,
        [courseId]: (currentVal + delta).toString(),
      }));
    } else {
      const currentVal = parseInt(courseDiscussionMinutes[courseId] || '0', 10) || 0;
      setCourseDiscussionMinutes((prev) => ({
        ...prev,
        [courseId]: (currentVal + delta).toString(),
      }));
    }
  };

  const addFreeMinutes = (delta: number) => {
    if (isCurrentPeriodClosed) return;
    setValidationError('');
    const currentVal = parseInt(freeStudyMinutesInput || '0', 10) || 0;
    setFreeStudyMinutesInput((currentVal + delta).toString());
  };

  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!activePeriod || isCurrentPeriodClosed) {
      setValidationError('این دوره مطالعاتی بسته شده است و امکان ثبت ساعت وجود ندارد.');
      return;
    }

    let totalCoreStudyMin = 0;
    let totalCoreDiscMin = 0;

    const breakdown: CourseStudyDetail[] = studentCourses.map((course) => {
      const sMin = parseInt(courseStudyMinutes[course.id] || '0', 10) || 0;
      const dMin = parseInt(courseDiscussionMinutes[course.id] || '0', 10) || 0;
      totalCoreStudyMin += sMin;
      totalCoreDiscMin += dMin;
      return {
        courseId: course.id,
        courseTitle: course.title,
        studyMinutes: sMin,
        discussionMinutes: dMin,
      };
    });

    const parsedFreeMin = parseInt(freeStudyMinutesInput || '0', 10) || 0;
    const totalMin = totalCoreStudyMin + totalCoreDiscMin + parsedFreeMin;

    if (totalMin <= 0) {
      setValidationError('لطفاً حداقل برای یکی از دروس یا مطالعه آزاد، میزان دقیقه کارکرد را وارد کنید.');
      return;
    }

    try {
      setIsSaving(true);
      setWriteInProgress('study_save_mobile', true, 'در حال ثبت و ذخیره کارکرد مطالعه در سرور... لطفاً از صفحه خارج نشوید.');
      const effectiveStudentId = String(studentObj?.id || studentId || currentUser?.id);
      const nowIso = new Date().toISOString();
      const newEntry: StudyDailyEntry = {
        id: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        studentId: effectiveStudentId,
        periodId: activePeriod.id,
        entryDate,
        studyHours: Math.round((totalCoreStudyMin / 60) * 10) / 10,
        discussionHours: Math.round((totalCoreDiscMin / 60) * 10) / 10,
        totalHours: Math.round((totalMin / 60) * 10) / 10,
        totalMinutes: totalMin,
        coreTotalMinutes: totalCoreStudyMin + totalCoreDiscMin,
        coursesBreakdown: breakdown,
        freeStudyMinutes: parsedFreeMin,
        freeStudyBookTitle: freeStudyBookTitle.trim() || undefined,
        note: freeStudyBookTitle.trim() ? `کتاب آزاد: ${freeStudyBookTitle.trim()}` : 'ثبت کارکرد روزانه دروس اصلی',
        createdAt: nowIso,
        updatedAt: nowIso,
        version: 1,
        studentCode: studentObj?.studentCode || currentUser?.username,
        nationalId: studentObj?.nationalId || currentUser?.username,
        studentName: studentObj?.name || currentUser?.name || currentUser?.fullName || '',
        userId: currentUser?.id,
      } as StudyDailyEntry;

      // Parallel persistence of daily entry + aggregate periodic log (eliminates sequential round-trip & duplicate sync)
      await Promise.all([
        localDb.setDoc('study_daily_entries', newEntry),
        syncAggregatePeriodicStudyLog(activePeriod.id, effectiveStudentId, 'student', newEntry)
      ]);

      setDailyEntries((prev) => [newEntry, ...prev]);
      const msg = 'کارکرد روزانه شما با موفقیت ثبت شد و به مجموع دوره افزوده گردید!';
      setSaveSuccessMsg(msg);
      emitSaveConfirmation({
        variant: 'success',
        title: 'ثبت کارکرد مطالعاتی با موفقیت انجام شد',
        message: msg,
        subtitle: `دوره «${activePeriod.title}» — جمع ثبت‌شده: ${formatMinutesToHoursAndMinutes(totalMin)} (ذخیره قطعی در سرور)`
      });
      setTimeout(() => setSaveSuccessMsg(''), 3500);

      // Reset ALL inputs strictly
      setCourseStudyMinutes({});
      setCourseDiscussionMinutes({});
      setFreeStudyMinutesInput('');
      setFreeStudyBookTitle('');
    } catch (err: any) {
      console.error('Error saving study entry:', err);
      const errMsg = 'خطا در ذخیره‌سازی اطلاعات مطالعه. لطفاً دوباره تلاش کنید.';
      setValidationError(errMsg);
      emitSaveConfirmation({
        variant: 'error',
        title: 'خطا در ثبت ساعت مطالعه',
        message: err?.message || errMsg
      });
    } finally {
      setWriteInProgress('study_save_mobile', false);
      setIsSaving(false);
    }
  };

  const handleConfirmDeleteEntry = async () => {
    if (!entryToDelete) return;
    const entryId = entryToDelete.id;
    setEntryToDelete(null);
    try {
      await localDb.deleteDoc('study_daily_entries', entryId);
      if (activePeriod) {
        const effectiveStudentId = String(studentObj?.id || studentId || currentUser?.id);
        await syncAggregatePeriodicStudyLog(activePeriod.id, effectiveStudentId, 'student');
      }
      localDb.flushSyncQueue().catch(() => {});
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app_data_change', { detail: { collection: 'study_daily_entries' } }));
        window.dispatchEvent(new CustomEvent('app_data_change', { detail: { collection: 'periodic_study_logs' } }));
        window.dispatchEvent(new CustomEvent('collection_change_periodic_study_logs'));
        window.dispatchEvent(new CustomEvent('collection_change_study_daily_entries'));
        try {
          localStorage.setItem('study_logs_updated_at', String(Date.now()));
        } catch {}
      }
      setDailyEntries((prev) => prev.filter((e) => e.id !== entryId));
    } catch (err) {
      console.warn('Error deleting daily entry:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center font-vazir shadow-2xs" dir="rtl">
        <div className="w-9 h-9 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold text-slate-600">در حال بارگذاری ساعت مطالعه...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 font-vazir text-right" dir="rtl">
      {/* 1. Hero Card with Circular Progress Gauge & Period Selector */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white shadow-md border border-indigo-500/20 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <AnimatedRingGauge
            percentage={totals.pct}
            size={60}
            strokeWidth={6}
            progressClassName={totals.pct >= 100 ? 'text-emerald-400' : 'text-cyan-400'}
            label={activePeriod?.title || 'دوره جاری'}
            valueText={`${totals.overallTotal} دقیقه کل`}
            subText={`موظفی: ${totals.mandatoryTotal} د`}
          />

          {periods.length > 0 && (
            <select
              value={activePeriodId}
              onChange={(e) => {
                setActivePeriodId(e.target.value);
                setUserSelectedPeriodId(e.target.value);
              }}
              className="min-h-[40px] max-w-[140px] bg-white/15 text-white border border-white/20 rounded-xl px-2.5 py-1.5 text-[11px] font-bold focus:outline-hidden cursor-pointer"
            >
              {periods.map((p) => {
                const closed = isPeriodClosed(p);
                return (
                  <option key={p.id} value={p.id} className="text-slate-900">
                    {p.title} {closed ? '(بسته)' : '(فعال)'}
                  </option>
                );
              })}
            </select>
          )}
        </div>

        {totals.warningStatus.isCommended && (
          <div className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-400/35 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-black text-emerald-200">
              <Sparkles size={14} className="text-amber-300 shrink-0" />
              <span>شایسته تشویق · بالاتر از حداقل موظفی دوره</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/10 text-center">
          <div className="p-2 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-base font-black text-white font-mono tabular-nums">{totals.overallTotal}</div>
            <div className="text-[9.5px] text-slate-300 font-medium truncate">
              کل ({formatMinutesToHoursAndMinutes(totals.overallTotal)})
            </div>
          </div>
          <div className="p-2 rounded-2xl bg-cyan-500/15 border border-cyan-400/20">
            <div className="text-base font-black text-cyan-300 font-mono tabular-nums">{totals.coreTotal}</div>
            <div className="text-[9.5px] text-cyan-200 font-medium truncate">
              دروس اصلی ({formatMinutesToHoursAndMinutes(totals.coreTotal)})
            </div>
          </div>
          <div className="p-2 rounded-2xl bg-teal-500/15 border border-teal-400/20">
            <div className="text-base font-black text-teal-300 font-mono tabular-nums">{totals.free}</div>
            <div className="text-[9.5px] text-teal-200 font-medium truncate">
              آزاد ({formatMinutesToHoursAndMinutes(totals.free)})
            </div>
          </div>
        </div>
      </div>

      {/* 2. Daily Study Registration Form */}
      <form onSubmit={handleSubmitEntry} className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <Plus size={15} className="text-indigo-600" />
            <span>ثبت کارکرد دروس و مطالعه آزاد</span>
          </h3>
          <span className="text-[10.5px] text-slate-500 font-bold bg-slate-100 px-2.5 py-1 rounded-xl tabular-nums">
            {entryDate}
          </span>
        </div>

        <AnimatePresence>
          {saveSuccessMsg && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-bold flex items-center gap-2"
            >
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </motion.div>
          )}
          {validationError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs font-bold flex items-center gap-2"
            >
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {isCurrentPeriodClosed && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>این دوره مطالعاتی توسط مسئول آموزش بسته شده است و امکان ثبت ساعت وجود ندارد.</span>
          </div>
        )}

        {/* Courses Breakdown */}
        {studentCourses.length === 0 ? (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center text-xs text-slate-500">
            درس اصلی فعالی برای پایه شما یافت نشد؛ می‌توانید مطالعه آزاد ثبت فرمایید.
          </div>
        ) : (
          <div className="space-y-3">
            {studentCourses.map((course, idx) => {
              const studyVal = courseStudyMinutes[course.id] || '';
              const discVal = courseDiscussionMinutes[course.id] || '';
              const studyNum = parseInt(studyVal, 10) || 0;
              const discNum = parseInt(discVal, 10) || 0;

              return (
                <div
                  key={course.id}
                  className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center shrink-0 tabular-nums">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-black text-slate-900 truncate">{course.title}</span>
                    </div>
                    <span className="text-[10.5px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg tabular-nums shrink-0">
                      {studyNum + discNum} دقیقه
                    </span>
                  </div>

                  {/* Study Row */}
                  <div className="p-2.5 bg-white rounded-xl border border-indigo-100 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-indigo-950 gap-2">
                      <span className="flex items-center gap-1.5">
                        <BookOpen size={13} className="text-indigo-600 shrink-0" />
                        <span>مطالعه (دقیقه):</span>
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="1440"
                        inputMode="numeric"
                        disabled={isCurrentPeriodClosed}
                        value={studyVal}
                        onChange={(e) => {
                          setValidationError('');
                          setCourseStudyMinutes({ ...courseStudyMinutes, [course.id]: e.target.value });
                        }}
                        placeholder="مثلاً ۶۰"
                        className="w-28 min-h-[38px] px-2 py-1 bg-slate-50 border border-indigo-200 rounded-xl text-slate-900 font-mono font-black text-xs text-center focus:bg-white focus:border-indigo-500 outline-hidden disabled:bg-slate-200"
                      />
                    </div>

                    <div className="grid grid-cols-5 gap-1">
                      {[15, 30, 45, 60].map((inc) => (
                        <button
                          key={inc}
                          type="button"
                          disabled={isCurrentPeriodClosed}
                          onClick={() => addCourseMinutes(course.id, 'study', inc)}
                          className="min-h-[40px] rounded-xl bg-slate-100 hover:bg-indigo-50 border border-slate-200 text-[11px] font-black text-slate-700 hover:text-indigo-700 active:scale-95 cursor-pointer disabled:opacity-40 tabular-nums"
                        >
                          +{inc}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={isCurrentPeriodClosed}
                        onClick={() => setCourseStudyMinutes({ ...courseStudyMinutes, [course.id]: '' })}
                        className="min-h-[40px] rounded-xl bg-rose-50 border border-rose-200 text-[10.5px] font-black text-rose-700 active:scale-95 cursor-pointer disabled:opacity-40"
                      >
                        صفر
                      </button>
                    </div>
                  </div>

                  {/* Discussion Row */}
                  <div className="p-2.5 bg-white rounded-xl border border-purple-100 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-purple-950 gap-2">
                      <span className="flex items-center gap-1.5">
                        <MessageSquare size={13} className="text-purple-600 shrink-0" />
                        <span>مباحثه (دقیقه):</span>
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="1440"
                        inputMode="numeric"
                        disabled={isCurrentPeriodClosed}
                        value={discVal}
                        onChange={(e) => {
                          setValidationError('');
                          setCourseDiscussionMinutes({ ...courseDiscussionMinutes, [course.id]: e.target.value });
                        }}
                        placeholder="مثلاً ۴۵"
                        className="w-28 min-h-[38px] px-2 py-1 bg-slate-50 border border-purple-200 rounded-xl text-slate-900 font-mono font-black text-xs text-center focus:bg-white focus:border-purple-500 outline-hidden disabled:bg-slate-200"
                      />
                    </div>

                    <div className="grid grid-cols-5 gap-1">
                      {[15, 30, 45, 60].map((inc) => (
                        <button
                          key={inc}
                          type="button"
                          disabled={isCurrentPeriodClosed}
                          onClick={() => addCourseMinutes(course.id, 'disc', inc)}
                          className="min-h-[40px] rounded-xl bg-slate-100 hover:bg-purple-50 border border-slate-200 text-[11px] font-black text-slate-700 hover:text-purple-700 active:scale-95 cursor-pointer disabled:opacity-40 tabular-nums"
                        >
                          +{inc}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={isCurrentPeriodClosed}
                        onClick={() => setCourseDiscussionMinutes({ ...courseDiscussionMinutes, [course.id]: '' })}
                        className="min-h-[40px] rounded-xl bg-rose-50 border border-rose-200 text-[10.5px] font-black text-rose-700 active:scale-95 cursor-pointer disabled:opacity-40"
                      >
                        صفر
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Free Study Section */}
        <div className="space-y-2.5 p-3.5 bg-teal-50/60 rounded-2xl border border-teal-200/80">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Sparkles size={15} className="text-teal-700 shrink-0" />
              <span className="text-xs font-black text-teal-950">مطالعه آزاد جانبی</span>
            </div>
            <button
              type="button"
              onClick={() => setShowFreeRulesModal(true)}
              className="min-h-[36px] px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-[10.5px] font-black flex items-center gap-1 active:scale-95 cursor-pointer shrink-0"
            >
              <Info size={13} />
              <span>قوانین مطالعه آزاد</span>
            </button>
          </div>

          <p className="text-[11px] text-teal-900 leading-relaxed bg-white/90 p-2.5 rounded-xl border border-teal-200/70 font-medium">
            برای مطالعه دروس اصلی مجموعه حداقل ۸۰۰ دقیقه قرار داده شده است؛ طلاب پس از تکمیل این حداقل می‌توانند مطالعه آزاد ثبت کنند.
          </p>

          <div className="p-2.5 bg-white rounded-xl border border-teal-200 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-teal-950 gap-2">
              <span>مدت مطالعه آزاد (دقیقه):</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                disabled={isCurrentPeriodClosed}
                value={freeStudyMinutesInput}
                onChange={(e) => {
                  setValidationError('');
                  setFreeStudyMinutesInput(e.target.value);
                }}
                placeholder="مثلاً ۱۲۰"
                className="w-28 min-h-[38px] px-2 py-1 bg-slate-50 border border-teal-300 rounded-xl text-slate-900 font-mono font-black text-xs text-center focus:bg-white focus:border-teal-500 outline-hidden disabled:bg-slate-200"
              />
            </div>

            <div className="grid grid-cols-5 gap-1">
              {[30, 60, 90, 120].map((inc) => (
                <button
                  key={inc}
                  type="button"
                  disabled={isCurrentPeriodClosed}
                  onClick={() => addFreeMinutes(inc)}
                  className="min-h-[40px] rounded-xl bg-teal-50 border border-teal-200 text-[11px] font-black text-teal-800 hover:bg-teal-100 active:scale-95 cursor-pointer disabled:opacity-40 tabular-nums"
                >
                  +{inc}
                </button>
              ))}
              <button
                type="button"
                disabled={isCurrentPeriodClosed}
                onClick={() => setFreeStudyMinutesInput('')}
                className="min-h-[40px] rounded-xl bg-rose-50 border border-rose-200 text-[10.5px] font-black text-rose-700 active:scale-95 cursor-pointer disabled:opacity-40"
              >
                صفر
              </button>
            </div>

            {parseInt(freeStudyMinutesInput || '0', 10) > 0 && (
              <input
                type="text"
                disabled={isCurrentPeriodClosed}
                placeholder="عنوان کتاب مطالعه آزاد (اختیاری)"
                value={freeStudyBookTitle}
                onChange={(e) => setFreeStudyBookTitle(e.target.value)}
                className="w-full min-h-[40px] bg-slate-50 border border-teal-200 rounded-xl px-3 py-1.5 text-xs text-teal-950 focus:outline-hidden disabled:bg-slate-200"
              />
            )}
          </div>
        </div>

        {/* Save Button */}
        {isCurrentPeriodClosed ? (
          <div className="w-full min-h-[46px] py-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 font-black text-xs flex items-center justify-center gap-1.5">
            <AlertCircle size={15} className="text-rose-600" />
            <span>دوره مطالعاتی بسته شده است (غیرقابل ثبت)</span>
          </div>
        ) : (
          <motion.button
            type="submit"
            disabled={isSaving}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
            className="w-full min-h-[48px] py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save size={16} />
            <span>{isSaving ? 'در حال ثبت در سرور... لطفاً خارج نشوید' : 'ثبت نهایی کارکرد روزانه'}</span>
          </motion.button>
        )}
      </form>

      {/* 3. Recent Daily Entries History */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-2xs space-y-2.5">
        <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
          <Clock size={15} className="text-indigo-600" />
          <span>سوابق کارکرد دوره ({currentPeriodEntries.length})</span>
        </h3>

        {currentPeriodEntries.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-slate-100">
            تاکنون برای این دوره کارکرد روزانه‌ای ثبت نکرده‌اید.
          </div>
        ) : (
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-0.5">
            {currentPeriodEntries.map((entry) => {
              const activeBreakdown = (entry.coursesBreakdown || []).filter(
                (c) => (c.studyMinutes || 0) > 0 || (c.discussionMinutes || 0) > 0
              );
              const cStudy =
                (entry.coursesBreakdown || []).reduce((sum, c) => sum + (c.studyMinutes || 0), 0) ||
                (entry.studyHours ? Math.round(entry.studyHours * 60) : 0);
              const cDisc =
                (entry.coursesBreakdown || []).reduce((sum, c) => sum + (c.discussionMinutes || 0), 0) ||
                (entry.discussionHours ? Math.round(entry.discussionHours * 60) : 0);
              const cFree = entry.freeStudyMinutes || 0;
              const cTotal = entry.totalMinutes || cStudy + cDisc + cFree;

              const courseSummaryTitle =
                activeBreakdown.length > 0
                  ? activeBreakdown.map((c) => c.courseTitle).join(' و ')
                  : entry.note || 'کارکرد روزانه';

              return (
                <div
                  key={entry.id}
                  className="p-3 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-slate-900 truncate">{courseSummaryTitle}</span>
                      <span className="text-[10px] font-mono text-slate-500 font-bold tabular-nums">
                        {entry.entryDate || (entry.createdAt ? entry.createdAt.slice(0, 10) : '')}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-600 font-medium tabular-nums">
                      {activeBreakdown.length > 0 ? (
                        activeBreakdown.map((ab, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 bg-indigo-50/70 text-indigo-900 px-1.5 py-0.5 rounded-lg border border-indigo-100"
                          >
                            <span className="font-bold">{ab.courseTitle}:</span>
                            <span>مطالعه {ab.studyMinutes || 0}د</span>
                            <span>/</span>
                            <span>مباحثه {ab.discussionMinutes || 0}د</span>
                          </span>
                        ))
                      ) : (
                        <span>
                          مطالعه: {cStudy} د · مباحثه: {cDisc} د
                        </span>
                      )}
                      {cFree > 0 && (
                        <span className="text-teal-700 font-bold bg-teal-50 px-1.5 py-0.5 rounded-lg border border-teal-200">
                          آزاد: {cFree} د
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-xl tabular-nums">
                      {cTotal} د
                    </span>
                    <button
                      type="button"
                      onClick={() => setEntryToDelete(entry)}
                      className="min-h-[40px] min-w-[40px] rounded-xl text-rose-500 hover:bg-rose-50 flex items-center justify-center cursor-pointer"
                      aria-label="حذف رکورد مطالعه"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inline Delete Confirmation Modal (replaces window.confirm) */}
      <AnimatePresence>
        {entryToDelete && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEntryToDelete(null)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            />
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { y: 40, opacity: 0 }}
              className="relative z-10 w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4"
            >
              <div className="text-center space-y-1.5">
                <h3 className="text-sm font-black text-slate-900">حذف رکورد مطالعه</h3>
                <p className="text-xs text-slate-600 font-medium">
                  آیا از حذف این رکورد ({entryToDelete.entryDate}) اطمینان دارید؟ آمار دوره به طور خودکار بروزرسانی می‌شود.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setEntryToDelete(null)}
                  className="min-h-[44px] rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteEntry}
                  className="min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer"
                >
                  حذف شود
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Free Study Rules Modal */}
      <FreeStudyRulesModal isOpen={showFreeRulesModal} onClose={() => setShowFreeRulesModal(false)} />
    </div>
  );
};
