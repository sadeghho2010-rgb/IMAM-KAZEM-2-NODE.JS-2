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
  Info
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { localDb } from '../../../lib/localDb';
import { useAuth } from '../../../context/AuthContext';
import { Student, StudyPeriod, StudyDailyEntry, Program, Enrollment, PeriodicStudyLog } from '../../../types';
import { getTodayShamsi } from '../../../lib/jalali';
import { formatMinutesToHoursAndMinutes, getStudyWarningStatus } from '../../study/studyUtils';

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
  const [dailyEntries, setDailyEntries] = useState<StudyDailyEntry[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [allLogs, setAllLogs] = useState<PeriodicStudyLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [studyMinutes, setStudyMinutes] = useState<number>(60);
  const [discussionMinutes, setDiscussionMinutes] = useState<number>(45);
  const [freeStudyMinutes, setFreeStudyMinutes] = useState<number>(0);
  const [freeStudyBookTitle, setFreeStudyBookTitle] = useState<string>('');
  const [entryDate, setEntryDate] = useState<string>(() => getTodayShamsi());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');

  useEffect(() => {
    loadAllData();
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

      const sortedPeriods = [...allPeriods].sort((a, b) => 
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );
      setPeriods(sortedPeriods);
      if (sortedPeriods.length > 0) {
        setActivePeriodId(sortedPeriods[0].id);
      }

      setPrograms(allProgs);
      setEnrollments(allEnrolls);
      setAllLogs(allL);

      const studentId = matched?.id || sId || currentUser?.id;
      const myEntries = allDaily.filter(e => e.studentId === studentId);
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
    const myEnrolls = enrollments.filter(e => e.studentId === studentObj.id);
    const enrolledProgIds = new Set(myEnrolls.map(e => e.programId));

    const matchedProgs = programs.filter(p => 
      enrolledProgIds.has(p.id) || 
      p.grade === studentObj.grade ||
      (p as any).studentIds?.includes(studentObj.id)
    );

    const mainOnly = matchedProgs.filter(p => p.type === 'اصلی' || !p.type || (!['مشاوره', 'پژوهش', 'دروس 5 شنبه'].includes(p.type)));
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

    return [
      { id: 'c_usul', title: 'اصول فقه' },
      { id: 'c_fiqh', title: 'فقه' },
      { id: 'c_falsafa', title: 'فلسفه و کلام' }
    ];
  }, [programs, enrollments, studentObj]);

  useEffect(() => {
    if (studentCourses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(studentCourses[0].id);
    }
  }, [studentCourses, selectedCourseId]);

  const activePeriod = useMemo(() => {
    return periods.find(p => p.id === activePeriodId) || periods[0] || null;
  }, [periods, activePeriodId]);

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

    // Check commendation status
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

  // Quick increment helper
  const addMinutes = (type: 'study' | 'disc' | 'free', delta: number) => {
    if (type === 'study') setStudyMinutes(prev => Math.max(0, prev + delta));
    if (type === 'disc') setDiscussionMinutes(prev => Math.max(0, prev + delta));
    if (type === 'free') setFreeStudyMinutes(prev => Math.max(0, prev + delta));
  };

  // Submit daily study entry
  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePeriod) return;

    try {
      setIsSaving(true);
      const chosenCourse = studentCourses.find(c => c.id === selectedCourseId);
      const courseTitle = chosenCourse?.title || 'درس اصلی';

      const newEntry: StudyDailyEntry = {
        id: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        studentId,
        periodId: activePeriod.id,
        entryDate,
        studyHours: Math.round((studyMinutes / 60) * 10) / 10,
        discussionHours: Math.round((discussionMinutes / 60) * 10) / 10,
        totalHours: Math.round(((studyMinutes + discussionMinutes + freeStudyMinutes) / 60) * 10) / 10,
        totalMinutes: studyMinutes + discussionMinutes + freeStudyMinutes,
        coreTotalMinutes: studyMinutes + discussionMinutes,
        coursesBreakdown: [
          {
            courseId: selectedCourseId || 'course_default',
            courseTitle,
            studyMinutes,
            discussionMinutes
          }
        ],
        freeStudyMinutes,
        note: freeStudyBookTitle.trim() ? `کتاب آزاد: ${freeStudyBookTitle.trim()}` : `ثبت کارکرد روزانه: ${courseTitle}`,
        createdAt: new Date().toISOString()
      };

      await localDb.setDoc('study_daily_entries', newEntry);

      // Update state
      setDailyEntries(prev => [newEntry, ...prev]);
      setSaveSuccessMsg('کارکرد روزانه شما با موفقیت ثبت شد!');
      setTimeout(() => setSaveSuccessMsg(''), 3500);

      // Reset fields
      setFreeStudyMinutes(0);
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
              onChange={(e) => setActivePeriodId(e.target.value)}
              className="bg-white/15 text-white border border-white/20 rounded-xl px-2 py-1 text-[11px] font-bold focus:outline-hidden"
            >
              {periods.map(p => (
                <option key={p.id} value={p.id} className="text-slate-900">
                  {p.title}
                </option>
              ))}
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

      {/* 2. Fast Registration Form */}
      <form onSubmit={handleSubmitEntry} className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
            <Plus size={14} className="text-indigo-600" />
            <span>ثبت سریع کارکرد روزانه</span>
          </h3>
          <span className="text-[10px] text-slate-400 font-bold">
            تاریخ: {entryDate}
          </span>
        </div>

        {saveSuccessMsg && (
          <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Select Course */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-700 block">
            عنوان درس اصلی:
          </label>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-indigo-500"
          >
            {studentCourses.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>

        {/* Study Minutes Input */}
        <div className="space-y-1.5 p-2.5 bg-slate-50/70 rounded-xl border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700">مدت مطالعه فردی (دقیقه):</span>
            <span className="font-mono font-black text-indigo-700 text-sm">
              {studyMinutes} دقیقه ({formatMinutesToHoursAndMinutes(studyMinutes)})
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {[15, 30, 45, 60].map(inc => (
              <button
                key={inc}
                type="button"
                onClick={() => addMinutes('study', inc)}
                className="flex-1 py-1 rounded-lg bg-white border border-slate-200 text-[10px] font-black text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 active:scale-95 cursor-pointer"
              >
                +{inc}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setStudyMinutes(0)}
              className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-[10px] font-black text-rose-700 active:scale-95 cursor-pointer"
            >
              صفر
            </button>
          </div>
        </div>

        {/* Discussion Minutes Input */}
        <div className="space-y-1.5 p-2.5 bg-slate-50/70 rounded-xl border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700">مدت مباحثه هم‌بحثی (دقیقه):</span>
            <span className="font-mono font-black text-purple-700 text-sm">
              {discussionMinutes} دقیقه ({formatMinutesToHoursAndMinutes(discussionMinutes)})
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {[15, 30, 45, 60].map(inc => (
              <button
                key={inc}
                type="button"
                onClick={() => addMinutes('disc', inc)}
                className="flex-1 py-1 rounded-lg bg-white border border-slate-200 text-[10px] font-black text-slate-700 hover:bg-purple-50 hover:text-purple-700 active:scale-95 cursor-pointer"
              >
                +{inc}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDiscussionMinutes(0)}
              className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-[10px] font-black text-rose-700 active:scale-95 cursor-pointer"
            >
              صفر
            </button>
          </div>
        </div>

        {/* Free Study Section (Optional) */}
        <div className="space-y-2 p-2.5 bg-teal-50/40 rounded-xl border border-teal-200/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-teal-900">مطالعه آزاد جانبی (بدون سقف):</span>
            <span className="font-mono font-black text-teal-800 text-sm">
              {freeStudyMinutes} دقیقه
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {[15, 30, 45, 60].map(inc => (
              <button
                key={inc}
                type="button"
                onClick={() => addMinutes('free', inc)}
                className="flex-1 py-1 rounded-lg bg-white border border-teal-200 text-[10px] font-black text-teal-800 hover:bg-teal-50 active:scale-95 cursor-pointer"
              >
                +{inc}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFreeStudyMinutes(0)}
              className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-[10px] font-black text-rose-700 active:scale-95 cursor-pointer"
            >
              صفر
            </button>
          </div>
          {freeStudyMinutes > 0 && (
            <input
              type="text"
              placeholder="عنوان کتاب مطالعه آزاد (اختیاری)"
              value={freeStudyBookTitle}
              onChange={(e) => setFreeStudyBookTitle(e.target.value)}
              className="w-full bg-white border border-teal-200 rounded-lg p-1.5 text-[11px] text-teal-900 focus:outline-hidden"
            />
          )}
        </div>

        {/* Save Button */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-600/25 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
        >
          <Save size={15} />
          <span>{isSaving ? 'در حال ثبت...' : 'ثبت نهایی کارکرد روزانه'}</span>
        </button>
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
              const detail = entry.coursesBreakdown?.[0];
              const cStudy = detail?.studyMinutes || (entry.studyHours ? Math.round(entry.studyHours * 60) : 0);
              const cDisc = detail?.discussionMinutes || (entry.discussionHours ? Math.round(entry.discussionHours * 60) : 0);
              const cFree = entry.freeStudyMinutes || 0;
              const cTotal = cStudy + cDisc + cFree;

              return (
                <div 
                  key={entry.id} 
                  className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-slate-900 truncate">
                        {detail?.courseTitle || 'درس اصلی'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 font-bold">
                        {entry.entryDate || entry.createdAt.slice(0, 10)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-600 font-medium">
                      <span>مطالعه: {cStudy} د</span>
                      <span>•</span>
                      <span>مباحثه: {cDisc} د</span>
                      {cFree > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-teal-700 font-bold">آزاد: {cFree} د</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
                      {cTotal} د
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer transition-all"
                      title="حذف"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
