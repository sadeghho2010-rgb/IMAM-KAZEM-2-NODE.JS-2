import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, 
  Clock, 
  Sparkles, 
  Plus, 
  Trash2, 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Calendar,
  Layers,
  ChevronDown,
  Info,
  MessageSquare,
  FileText
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { localDb } from '../../../lib/localDb';
import { useAuth } from '../../../context/AuthContext';
import { Student, StudyPeriod, StudyDailyEntry, Program, Enrollment, PeriodicStudyLog, CourseStudyDetail } from '../../../types';
import { getTodayShamsi } from '../../../lib/jalali';
import { formatMinutesToHoursAndMinutes, getStudyWarningStatus, syncAggregatePeriodicStudyLog, isPeriodClosed } from '../../study/studyUtils';
import FreeStudyRulesModal from '../../study/FreeStudyRulesModal';

interface StudentMobileStudyProps {
  onNavigateTab?: (tab: string, studentId?: string) => void;
}

export const StudentMobileStudy: React.FC<StudentMobileStudyProps> = ({
  onNavigateTab
}) => {
  const { currentUser } = useAuth();
  const [studentObj, setStudentObj] = useState<Student | null>(null);
  const [periods, setPeriods] = useState<StudyPeriod[]>([]);
  const [activePeriodId, setActivePeriodId] = useState<string>('');
  const [userSelectedPeriodId, setUserSelectedPeriodId] = useState<string | null>(null);
  const [dailyEntries, setDailyEntries] = useState<StudyDailyEntry[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [allLogs, setAllLogs] = useState<PeriodicStudyLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Per-course minute input states (Record courseId -> minute string)
  const [courseStudyMinutes, setCourseStudyMinutes] = useState<Record<string, string>>({});
  const [courseDiscussionMinutes, setCourseDiscussionMinutes] = useState<Record<string, string>>({});
  const [freeStudyMinutesInput, setFreeStudyMinutesInput] = useState<string>('');
  const [freeStudyBookTitle, setFreeStudyBookTitle] = useState<string>('');
  const [entryDate, setEntryDate] = useState<string>(() => getTodayShamsi());
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');
  const [showFreeRulesModal, setShowFreeRulesModal] = useState<boolean>(false);

  useEffect(() => {
    loadAllData();

    const unsub = localDb.subscribe(() => {
      loadAllData();
    });

    const handleDataChange = (e: any) => {
      const col = e?.detail?.collection;
      if (!col || col === 'study_periods' || col === 'study_daily_entries' || col === 'periodic_study_logs' || col === 'all') {
        loadAllData();
      }
    };

    window.addEventListener('app_data_change', handleDataChange);
    window.addEventListener('collection_change_study_periods', loadAllData);
    window.addEventListener('collection_change_study_daily_entries', loadAllData);
    window.addEventListener('collection_change_periodic_study_logs', loadAllData);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'study_periods_updated_at' || e.key === 'study_logs_updated_at' || (e.key && e.key.includes('study'))) {
        loadAllData();
      }
    };
    window.addEventListener('storage', handleStorage);

    const pollInterval = setInterval(async () => {
      try {
        await localDb.syncCollectionFromCloud('study_periods', false);
        await localDb.syncCollectionFromCloud('study_daily_entries', false);
        await localDb.syncCollectionFromCloud('periodic_study_logs', false);
      } catch (e) {}
    }, 5000);

    return () => {
      unsub();
      window.removeEventListener('app_data_change', handleDataChange);
      window.removeEventListener('collection_change_study_periods', loadAllData);
      window.removeEventListener('collection_change_study_daily_entries', loadAllData);
      window.removeEventListener('collection_change_periodic_study_logs', loadAllData);
      window.removeEventListener('storage', handleStorage);
      clearInterval(pollInterval);
    };
  }, [currentUser]);

  const loadAllData = async () => {
    try {
      setIsLoading(true);
      const [allStudents, allPeriods, allProgs, allEnrolls, allDaily, allL] = await Promise.all([
        localDb.getDocs<Student>('students'),
        localDb.getDocs<StudyPeriod>('study_periods'),
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<Enrollment>('enrollments'),
        localDb.getDocs<StudyDailyEntry>('study_daily_entries'),
        localDb.getDocs<PeriodicStudyLog>('periodic_study_logs')
      ]);

      const sId = currentUser?.studentId || currentUser?.linkedStudentId || currentUser?.id;
      const uName = (currentUser?.username || '').trim().toLowerCase();
      const cName = (currentUser?.name || currentUser?.fullName || '').trim().toLowerCase();

      const matched = allStudents.find(s => 
        (sId && String(s.id) === String(sId)) ||
        (uName && (s.nationalId?.toLowerCase() === uName || s.studentCode?.toLowerCase() === uName)) ||
        (cName && s.name?.toLowerCase().includes(cName))
      );
      if (matched) {
        setStudentObj(matched);
      }

      const validPeriods = (allPeriods || []).filter(p => 
        p && 
        p.id && 
        p.status !== 'deleted' && 
        !(p as any).isDeleted && 
        !(p as any).deletedAt
      );

      const sortedPeriods = [...validPeriods].sort((a, b) => 
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );
      setPeriods(sortedPeriods);

      setActivePeriodId(prev => {
        const currentP = sortedPeriods.find(p => p.id === prev);
        const openP = sortedPeriods.find(p => !isPeriodClosed(p));
        // If no period selected, or selected period was deleted (!currentP):
        if (!prev || !currentP) {
          return openP?.id || sortedPeriods[0]?.id || '';
        }
        // "اگر بسته بود بسته بشه و اتومات بره روی دوره باز به صورت پیش فرض"
        // If current period is closed and an open period exists, and student did not explicitly click this closed period:
        if (isPeriodClosed(currentP) && openP && userSelectedPeriodId !== prev) {
          return openP.id;
        }
        return prev;
      });

      setPrograms(allProgs);
      setEnrollments(allEnrolls);
      setAllLogs(allL);

      const targetStudentId = matched?.id || sId || currentUser?.id;
      const candidateIds = [
        targetStudentId,
        matched?.id,
        matched?.studentCode,
        matched?.nationalId,
        sId,
        currentUser?.id,
        currentUser?.username
      ].filter(Boolean).map(x => String(x).toLowerCase().trim());

      const myEntries = allDaily.filter(e => {
        const eIds = [
          e.studentId,
          (e as any).student_id,
          (e as any).userId,
          (e as any).nationalId,
          (e as any).studentCode
        ].filter(Boolean).map(x => String(x).toLowerCase().trim());
        return candidateIds.some(cid => eIds.includes(cid));
      });

      setDailyEntries(myEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      console.warn('Error loading study data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const studentId = studentObj?.id || currentUser?.studentId || currentUser?.id || '';

  // Student's core seminary courses
  const studentCourses = useMemo(() => {
    if (!studentObj) return [];
    const activeProgs = programs.filter(p => p.status !== 'deleted' && !(p as any).isDeleted);
    const myEnrolls = enrollments.filter(e => e.studentId === studentObj.id && e.status !== 'deleted' && e.status !== 'inactive');
    const enrolledProgIds = new Set(myEnrolls.map(e => e.programId));

    const matchedProgs = activeProgs.filter(p => 
      enrolledProgIds.has(p.id) || 
      (Array.isArray((p as any).studentIds) && (p as any).studentIds.includes(studentObj.id)) ||
      (enrolledProgIds.size === 0 && (!p.grade || p.grade === studentObj.grade || p.grade === 'همه پایه‌ها'))
    );

    const mainOnly = matchedProgs.filter(p => {
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
        const title = p.title.trim();
        if (!seen.has(title)) {
          seen.add(title);
          list.push({ id: p.id, title });
        }
      }
      return list;
    }

    return [];
  }, [programs, enrollments, studentObj]);

  const activePeriod = useMemo(() => {
    return periods.find(p => p.id === activePeriodId) || periods[0] || null;
  }, [periods, activePeriodId]);

  const isCurrentPeriodClosed = isPeriodClosed(activePeriod);

  // Current period entries for student
  const currentPeriodEntries = useMemo(() => {
    return dailyEntries.filter(e => e.periodId === activePeriodId);
  }, [dailyEntries, activePeriodId]);

  // Totals for current period
  const totals = useMemo(() => {
    let coreStudy = 0;
    let coreDisc = 0;
    let free = 0;

    currentPeriodEntries.forEach(entry => {
      if (entry.coursesBreakdown && Array.isArray(entry.coursesBreakdown)) {
        entry.coursesBreakdown.forEach(cd => {
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

    // Synthetic log to accurately evaluate warning and commendation status
    const syntheticLog: PeriodicStudyLog = {
      id: `synth_${studentId}_${activePeriod?.id}`,
      periodId: activePeriod?.id || '',
      studentId,
      hours: Math.round((overallTotal / 60) * 10) / 10,
      studyHours: Math.round((coreStudy / 60) * 10) / 10,
      discussionHours: Math.round((coreDisc / 60) * 10) / 10,
      totalMinutes: overallTotal,
      coreTotalMinutes: coreTotal,
      freeStudyMinutes: free
    };

    const warningStatus = activePeriod
      ? getStudyWarningStatus(
          activePeriod,
          syntheticLog,
          studentObj || undefined
        )
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
          mandatoryTotalMinutes: 0,
          mandatoryCoreMinutes: 0
        };

    return {
      coreStudy,
      coreDisc,
      coreTotal,
      free,
      overallTotal,
      warningStatus
    };
  }, [currentPeriodEntries, studentObj, studentId, currentUser, activePeriod]);

  // Quick increment helper per course
  const addCourseMinutes = (courseId: string, type: 'study' | 'disc', delta: number) => {
    if (isCurrentPeriodClosed) return;
    if (type === 'study') {
      const currentVal = parseInt(courseStudyMinutes[courseId] || '0') || 0;
      setCourseStudyMinutes(prev => ({
        ...prev,
        [courseId]: (currentVal + delta).toString()
      }));
    } else {
      const currentVal = parseInt(courseDiscussionMinutes[courseId] || '0') || 0;
      setCourseDiscussionMinutes(prev => ({
        ...prev,
        [courseId]: (currentVal + delta).toString()
      }));
    }
  };

  const addFreeMinutes = (delta: number) => {
    if (isCurrentPeriodClosed) return;
    const currentVal = parseInt(freeStudyMinutesInput || '0') || 0;
    setFreeStudyMinutesInput((currentVal + delta).toString());
  };

  // Submit daily study entry
  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePeriod || isCurrentPeriodClosed) {
      alert('این دوره مطالعاتی توسط مسئول آموزش بسته شده است و امکان ثبت ساعت وجود ندارد.');
      return;
    }

    let totalCoreStudyMin = 0;
    let totalCoreDiscMin = 0;

    const breakdown: CourseStudyDetail[] = studentCourses.map(course => {
      const sMin = parseInt(courseStudyMinutes[course.id] || '0') || 0;
      const dMin = parseInt(courseDiscussionMinutes[course.id] || '0') || 0;
      totalCoreStudyMin += sMin;
      totalCoreDiscMin += dMin;
      return {
        courseId: course.id,
        courseTitle: course.title,
        studyMinutes: sMin,
        discussionMinutes: dMin
      };
    });

    const parsedFreeMin = parseInt(freeStudyMinutesInput || '0') || 0;
    const totalMin = totalCoreStudyMin + totalCoreDiscMin + parsedFreeMin;

    if (totalMin <= 0) {
      alert('لطفاً حداقل برای یکی از دروس یا مطالعه آزاد، میزان دقیقه کارکرد را وارد کنید.');
      return;
    }

    try {
      setIsSaving(true);

      const effectiveStudentId = String(studentObj?.id || studentId || currentUser?.id);
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
        note: freeStudyBookTitle.trim() ? `کتاب آزاد: ${freeStudyBookTitle.trim()}` : `ثبت کارکرد روزانه دروس اصلی`,
        createdAt: new Date().toISOString(),
        studentCode: studentObj?.studentCode || currentUser?.username,
        nationalId: studentObj?.nationalId || currentUser?.username,
        studentName: studentObj?.name || currentUser?.name || currentUser?.fullName || '',
        userId: currentUser?.id
      };

      await localDb.setDoc('study_daily_entries', newEntry);

      // Re-aggregate and update periodic_study_logs so Education Manager tables update immediately
      try {
        await syncAggregatePeriodicStudyLog(activePeriod.id, effectiveStudentId, 'student');
        if (studentObj?.id && String(studentObj.id) !== effectiveStudentId) {
          await syncAggregatePeriodicStudyLog(activePeriod.id, String(studentObj.id), 'student');
        }
      } catch (aggErr) {
        console.warn('Error syncing aggregate periodic log:', aggErr);
      }

      localDb.flushSyncQueue().catch(() => {});

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app_data_change', { detail: { collection: 'study_daily_entries' } }));
        window.dispatchEvent(new CustomEvent('app_data_change', { detail: { collection: 'periodic_study_logs' } }));
        window.dispatchEvent(new CustomEvent('collection_change_periodic_study_logs'));
        window.dispatchEvent(new CustomEvent('collection_change_study_daily_entries'));
        try {
          localStorage.setItem('study_logs_updated_at', String(Date.now()));
        } catch (e) {}
      }

      // Update state
      setDailyEntries(prev => [newEntry, ...prev]);
      setSaveSuccessMsg('کارکرد روزانه شما با موفقیت ثبت شد!');
      setTimeout(() => setSaveSuccessMsg(''), 3500);

      // CRITICAL REQUIREMENT: Reset ALL numbers, inputs, and fields so they are completely EMPTY
      setCourseStudyMinutes({});
      setCourseDiscussionMinutes({});
      setFreeStudyMinutesInput('');
      setFreeStudyBookTitle('');
    } catch (err) {
      console.error('Error saving study entry:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('آیا از حذف این رکورد مطالعه اطمینان دارید؟')) return;
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
        } catch (e) {}
      }
      setDailyEntries(prev => prev.filter(e => e.id !== entryId));
    } catch (err) {
      console.warn('Error deleting daily entry:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-white rounded-3xl border border-slate-200 text-center font-vazir shadow-xs" dir="rtl">
        <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold text-slate-700">در حال بارگذاری ساعت مطالعه...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 font-vazir text-right pb-10" dir="rtl">
      {/* 1. Header Banner & Period Selector */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white shadow-md border border-indigo-500/20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 text-cyan-300 backdrop-blur-md flex items-center justify-center font-bold shadow-xs border border-white/20">
              <BookOpen size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-white">ساعت مطالعه من</h2>
              <p className="text-[10px] text-indigo-200/80 font-medium">
                {studentObj?.name || currentUser?.name || 'طلبه گرامی'} • بدون سقف و محدودیت
              </p>
            </div>
          </div>

          {/* Period selector dropdown */}
          {periods.length > 0 && (
            <select
              value={activePeriodId}
              onChange={(e) => {
                setActivePeriodId(e.target.value);
                setUserSelectedPeriodId(e.target.value);
              }}
              className="bg-white/15 text-white border border-white/20 rounded-xl px-2 py-1 text-[11px] font-bold focus:outline-hidden"
            >
              {periods.map(p => {
                const closed = isPeriodClosed(p);
                return (
                  <option key={p.id} value={p.id} className="text-slate-900">
                    {p.title} {closed ? '(🔒 بسته)' : '(🟢 باز / فعال)'}
                  </option>
                );
              })}
            </select>
          )}
        </div>

        {/* Commendation Badge */}
        {totals.warningStatus.isCommended && (
          <div className="mt-3 p-2 rounded-xl bg-gradient-to-r from-emerald-500/30 to-teal-500/30 border border-emerald-400/40 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-black text-emerald-200">
              <Sparkles size={14} className="text-amber-300" />
              <span>⭐ شایسته تشویق: بالاتر از حداقل موظفی دوره</span>
            </div>
            <span className="text-[10px] bg-emerald-400 text-slate-950 px-2 py-0.5 rounded-full font-black">
              مازاد مطالعه
            </span>
          </div>
        )}

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/10 text-center">
          <div className="p-2 rounded-xl bg-white/5 border border-white/10">
            <div className="text-base font-black text-white font-mono">
              {totals.overallTotal}
            </div>
            <div className="text-[9px] text-slate-300 font-medium">
              مجموع کل ({formatMinutesToHoursAndMinutes(totals.overallTotal)})
            </div>
          </div>
          <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-400/20">
            <div className="text-base font-black text-cyan-300 font-mono">
              {totals.coreTotal}
            </div>
            <div className="text-[9px] text-cyan-200 font-medium">
              دروس اصلی ({formatMinutesToHoursAndMinutes(totals.coreTotal)})
            </div>
          </div>
          <div className="p-2 rounded-xl bg-teal-500/15 border border-teal-400/20">
            <div className="text-base font-black text-teal-300 font-mono">
              {totals.free}
            </div>
            <div className="text-[9px] text-teal-200 font-medium">
              مطالعه آزاد ({formatMinutesToHoursAndMinutes(totals.free)})
            </div>
          </div>
        </div>
      </div>

      {/* 2. Detailed Multi-Course Registration Form (جدول تفکیکی هر درس در موبایل) */}
      <form onSubmit={handleSubmitEntry} className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
            <Plus size={14} className="text-indigo-600" />
            <span>ثبت تفصیلی کارکرد دروس و مطالعه آزاد</span>
          </h3>
          <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-md">
            تاریخ: {entryDate}
          </span>
        </div>

        {saveSuccessMsg && (
          <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {isCurrentPeriodClosed && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>این دوره مطالعاتی توسط مسئول آموزش بسته شده است و امکان ثبت ساعت وجود ندارد.</span>
          </div>
        )}

        {/* Detailed Course Tables / Card Grids */}
        <div className="space-y-3">
          {studentCourses.map((course, idx) => {
            const studyVal = courseStudyMinutes[course.id] || '';
            const discVal = courseDiscussionMinutes[course.id] || '';
            const studyNum = parseInt(studyVal) || 0;
            const discNum = parseInt(discVal) || 0;

            return (
              <div 
                key={course.id} 
                className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 space-y-2.5 shadow-2xs"
              >
                {/* Header row for course */}
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-lg bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-black text-slate-900">{course.title}</span>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                    مجموع این درس: {studyNum + discNum} د
                  </span>
                </div>

                {/* Table Grid inputs for this course */}
                <div className="grid grid-cols-1 gap-2">
                  {/* Row 1: Study Minutes */}
                  <div className="p-2 bg-white rounded-xl border border-indigo-100 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-indigo-950">
                      <span className="flex items-center gap-1">
                        <BookOpen size={12} className="text-indigo-600" />
                        <span>مدت مطالعه (دقیقه):</span>
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="1440"
                        disabled={isCurrentPeriodClosed}
                        value={studyVal}
                        onChange={(e) => setCourseStudyMinutes({
                          ...courseStudyMinutes,
                          [course.id]: e.target.value
                        })}
                        placeholder="تایپ کنید (مثلاً ۶۰)"
                        className="w-28 px-2 py-1 bg-slate-50 border border-indigo-200 rounded-lg text-slate-900 font-mono font-black text-xs text-center focus:bg-white focus:border-indigo-500 outline-hidden disabled:bg-slate-200 disabled:text-slate-400"
                      />
                    </div>

                    <div className="flex items-center gap-1 pt-1">
                      {[15, 30, 45, 60].map(inc => (
                        <button
                          key={inc}
                          type="button"
                          disabled={isCurrentPeriodClosed}
                          onClick={() => addCourseMinutes(course.id, 'study', inc)}
                          className="flex-1 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 border border-slate-200 text-[10px] font-black text-slate-700 hover:text-indigo-700 active:scale-95 cursor-pointer disabled:opacity-40"
                        >
                          +{inc}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={isCurrentPeriodClosed}
                        onClick={() => setCourseStudyMinutes({ ...courseStudyMinutes, [course.id]: '' })}
                        className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-[10px] font-black text-rose-700 active:scale-95 cursor-pointer shrink-0 disabled:opacity-40"
                      >
                        صفر
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Discussion Minutes */}
                  <div className="p-2 bg-white rounded-xl border border-purple-100 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-purple-950">
                      <span className="flex items-center gap-1">
                        <MessageSquare size={12} className="text-purple-600" />
                        <span>مدت مباحثه (دقیقه):</span>
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="1440"
                        disabled={isCurrentPeriodClosed}
                        value={discVal}
                        onChange={(e) => setCourseDiscussionMinutes({
                          ...courseDiscussionMinutes,
                          [course.id]: e.target.value
                        })}
                        placeholder="تایپ کنید (مثلاً ۴۵)"
                        className="w-28 px-2 py-1 bg-slate-50 border border-purple-200 rounded-lg text-slate-900 font-mono font-black text-xs text-center focus:bg-white focus:border-purple-500 outline-hidden disabled:bg-slate-200 disabled:text-slate-400"
                      />
                    </div>

                    <div className="flex items-center gap-1 pt-1">
                      {[15, 30, 45, 60].map(inc => (
                        <button
                          key={inc}
                          type="button"
                          disabled={isCurrentPeriodClosed}
                          onClick={() => addCourseMinutes(course.id, 'disc', inc)}
                          className="flex-1 py-1 rounded-lg bg-slate-100 hover:bg-purple-50 border border-slate-200 text-[10px] font-black text-slate-700 hover:text-purple-700 active:scale-95 cursor-pointer disabled:opacity-40"
                        >
                          +{inc}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={isCurrentPeriodClosed}
                        onClick={() => setCourseDiscussionMinutes({ ...courseDiscussionMinutes, [course.id]: '' })}
                        className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-[10px] font-black text-rose-700 active:scale-95 cursor-pointer shrink-0 disabled:opacity-40"
                      >
                        صفر
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Free Study Section (مطالعه آزاد) */}
        <div className="space-y-2.5 p-3 bg-teal-50/60 rounded-2xl border border-teal-200/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles size={15} className="text-teal-700" />
              <span className="text-xs font-black text-teal-950">مطالعه آزاد جانبی</span>
            </div>

            {/* Dedicated Button for Free Study Guidelines */}
            <button
              type="button"
              onClick={() => setShowFreeRulesModal(true)}
              className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-[10.5px] font-black flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
            >
              <Info size={13} />
              <span>توضیحات مطالعه آزاد</span>
            </button>
          </div>

          {/* EXACT TEXT REPLACEMENT REQUIREMENT */}
          <div className="p-2.5 bg-white/90 border border-teal-200/80 rounded-xl space-y-1 text-[11px] text-teal-900 leading-relaxed font-medium">
            <p>
              برای مطالعه دروس اصلی مجموعه حداقل 800 دقیقه قرار داده شده است ، دوستان طلبه می توانند پس از پرکردن این حداقل به انجام مطالعه آزاد بپردازند.
            </p>
            <p className="text-[10.5px] text-teal-700 font-bold pt-0.5 border-t border-teal-100">
              جهت اطلاع از قوانین مطالعه آزاد بر روی توضیحات مطالعه آزاد کلیک فرمایید.
            </p>
          </div>

          {/* Free study minutes input with typing & quick buttons */}
          <div className="p-2 bg-white rounded-xl border border-teal-200 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-teal-950">
              <span>مدت مطالعه آزاد (دقیقه):</span>
              <input
                type="number"
                min="0"
                disabled={isCurrentPeriodClosed}
                value={freeStudyMinutesInput}
                onChange={(e) => setFreeStudyMinutesInput(e.target.value)}
                placeholder="تایپ کنید (مثلاً ۱۲۰)"
                className="w-28 px-2 py-1 bg-slate-50 border border-teal-300 rounded-lg text-slate-900 font-mono font-black text-xs text-center focus:bg-white focus:border-teal-500 outline-hidden disabled:bg-slate-200 disabled:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-1 pt-1">
              {[30, 60, 90, 120].map(inc => (
                <button
                  key={inc}
                  type="button"
                  disabled={isCurrentPeriodClosed}
                  onClick={() => addFreeMinutes(inc)}
                  className="flex-1 py-1 rounded-lg bg-teal-50 border border-teal-200 text-[10px] font-black text-teal-800 hover:bg-teal-100 active:scale-95 cursor-pointer disabled:opacity-40"
                >
                  +{inc}
                </button>
              ))}
              <button
                type="button"
                disabled={isCurrentPeriodClosed}
                onClick={() => setFreeStudyMinutesInput('')}
                className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-[10px] font-black text-rose-700 active:scale-95 cursor-pointer shrink-0 disabled:opacity-40"
              >
                صفر
              </button>
            </div>

            {parseInt(freeStudyMinutesInput || '0') > 0 && (
              <input
                type="text"
                disabled={isCurrentPeriodClosed}
                placeholder="عنوان کتاب مطالعه آزاد (اختیاری)"
                value={freeStudyBookTitle}
                onChange={(e) => setFreeStudyBookTitle(e.target.value)}
                className="w-full mt-1.5 bg-slate-50 border border-teal-200 rounded-lg p-1.5 text-[11px] text-teal-950 focus:outline-hidden disabled:bg-slate-200"
              />
            )}
          </div>
        </div>

        {/* Save Button */}
        {isCurrentPeriodClosed ? (
          <div className="w-full py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-black text-xs flex items-center justify-center gap-1.5">
            <AlertCircle size={15} className="text-rose-600" />
            <span>دوره مطالعاتی بسته شده است (غیرقابل ثبت)</span>
          </div>
        ) : (
          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-600/25 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <Save size={15} />
            <span>{isSaving ? 'در حال ثبت...' : 'ثبت نهایی کارکرد روزانه'}</span>
          </button>
        )}
      </form>

      {/* 3. Recent Daily Entries History */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs space-y-2.5">
        <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
          <Clock size={14} className="text-indigo-600" />
          <span>سوابق کارکرد ثبت‌شده شما ({currentPeriodEntries.length})</span>
        </h3>

        {currentPeriodEntries.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs italic bg-slate-50 rounded-xl">
            تاکنون برای این دوره کارکرد روزانه‌ای ثبت نکرده‌اید.
          </div>
        ) : (
          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-0.5">
            {currentPeriodEntries.map(entry => {
              const activeBreakdown = (entry.coursesBreakdown || []).filter(c => (c.studyMinutes || 0) > 0 || (c.discussionMinutes || 0) > 0);
              const cStudy = (entry.coursesBreakdown || []).reduce((sum, c) => sum + (c.studyMinutes || 0), 0) || (entry.studyHours ? Math.round(entry.studyHours * 60) : 0);
              const cDisc = (entry.coursesBreakdown || []).reduce((sum, c) => sum + (c.discussionMinutes || 0), 0) || (entry.discussionHours ? Math.round(entry.discussionHours * 60) : 0);
              const cFree = entry.freeStudyMinutes || 0;
              const cTotal = entry.totalMinutes || (cStudy + cDisc + cFree);

              const courseSummaryTitle = activeBreakdown.length > 0 
                ? activeBreakdown.map(c => c.courseTitle).join(' و ')
                : (entry.note || 'کارکرد روزانه');

              return (
                <div 
                  key={entry.id} 
                  className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-slate-900 truncate">
                        {courseSummaryTitle}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 font-bold bg-white px-1.5 py-0.2 rounded border border-slate-200">
                        {entry.entryDate || (entry.createdAt ? entry.createdAt.slice(0, 10) : '')}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-600 font-medium">
                      {activeBreakdown.length > 0 ? (
                        activeBreakdown.map((ab, i) => (
                          <span key={i} className="inline-flex items-center gap-1 bg-indigo-50/60 text-indigo-900 px-1.5 py-0.5 rounded border border-indigo-100">
                            <span className="font-bold">{ab.courseTitle}:</span>
                            <span>مطالعه {ab.studyMinutes || 0}د</span>
                            <span>/</span>
                            <span>مباحثه {ab.discussionMinutes || 0}د</span>
                          </span>
                        ))
                      ) : (
                        <>
                          <span>مطالعه: {cStudy} د</span>
                          <span>•</span>
                          <span>مباحثه: {cDisc} د</span>
                        </>
                      )}
                      {cFree > 0 && (
                        <span className="text-teal-700 font-bold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                          آزاد: {cFree} د
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-lg">
                      {cTotal} د
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer transition-all"
                      title="حذف این رکورد"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Free Study Rules Modal */}
      <FreeStudyRulesModal
        isOpen={showFreeRulesModal}
        onClose={() => setShowFreeRulesModal(false)}
      />
    </div>
  );
};
