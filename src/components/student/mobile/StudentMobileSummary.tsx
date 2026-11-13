import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Award,
  FileText,
  Sparkles,
  GraduationCap,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { localDb } from '../../../lib/localDb';
import { useAuth } from '../../../context/AuthContext';
import {
  Student,
  OralExam,
  ResearchRecord,
  StudentComment,
  StudentCourseProgress,
} from '../../../types';
import { buildStudentCandidateIds } from '../../study/studyUtils';
import { GlyphReportCard } from './StudentMobileIcons';

interface StudentMobileSummaryProps {
  onNavigateTab?: (tab: string, studentId?: string) => void;
}

type SummarySubTab = 'overview' | 'exams' | 'research' | 'notes';

export const StudentMobileSummary: React.FC<StudentMobileSummaryProps> = ({
  onNavigateTab,
}) => {
  const { currentUser, isTabAllowed } = useAuth();
  const prefersReducedMotion = useReducedMotion();

  const [activeSubTab, setActiveSubTab] = useState<SummarySubTab>('overview');
  const [studentObj, setStudentObj] = useState<Student | null>(null);
  const [oralExams, setOralExams] = useState<OralExam[]>([]);
  const [researchList, setResearchList] = useState<ResearchRecord[]>([]);
  const [comments, setComments] = useState<StudentComment[]>([]);
  const [passedCourses, setPassedCourses] = useState<any[]>([]);
  const [courseProgress, setCourseProgress] = useState<StudentCourseProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const initialLoadDoneRef = React.useRef(false);

  useEffect(() => {
    loadData(true);
    const handleSync = () => loadData(false);
    const unsub = localDb.subscribe(handleSync);
    window.addEventListener('app_data_change', handleSync);
    return () => {
      unsub();
      window.removeEventListener('app_data_change', handleSync);
    };
  }, [currentUser]);

  const loadData = async (isInitial = false) => {
    try {
      if (isInitial && !initialLoadDoneRef.current) {
        setIsLoading(true);
      }
      const [allStudents, allOral, allResearch, allComments, allPassed, allProgress] = await Promise.all([
        localDb.getDocs<Student>('students'),
        localDb.getDocs<OralExam>('oral_exams'),
        localDb.getDocs<ResearchRecord>('research_records'),
        localDb.getDocs<StudentComment>('student_comments'),
        localDb.getDocs<any>('passed_courses'),
        localDb.getDocs<StudentCourseProgress>('student_course_progress'),
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

      setOralExams(allOral || []);
      setResearchList(allResearch || []);
      setComments(allComments || []);
      setPassedCourses(allPassed || []);
      setCourseProgress(allProgress || []);
    } catch (e) {
      console.warn('Error loading summary data:', e);
    } finally {
      initialLoadDoneRef.current = true;
      setIsLoading(false);
    }
  };

  const candidateIdSet = useMemo(() => {
    const rawSet = buildStudentCandidateIds(
      studentObj,
      [currentUser?.id, currentUser?.studentId, currentUser?.linkedStudentId, currentUser?.username].filter(
        Boolean
      ) as string[]
    );
    return new Set(Array.from(rawSet).map((x) => String(x).toLowerCase().trim()));
  }, [studentObj, currentUser]);

  const matchesStudent = (idVal?: string | number | null) => {
    if (!idVal) return false;
    return candidateIdSet.has(String(idVal).toLowerCase().trim());
  };

  const myOralExams = useMemo(() => oralExams.filter((o) => matchesStudent(o.studentId)), [oralExams, candidateIdSet]);
  const myResearch = useMemo(() => researchList.filter((r) => matchesStudent(r.studentId)), [researchList, candidateIdSet]);
  const myComments = useMemo(() => comments.filter((c) => matchesStudent(c.studentId)), [comments, candidateIdSet]);

  const myPassedCount = useMemo(() => {
    const progressPassed = courseProgress.filter(
      (cp) => matchesStudent(cp.studentId) && cp.status === 'passed'
    ).length;
    const legacyPassed = passedCourses.filter((p) => matchesStudent(p.studentId)).length;
    return Math.max(progressPassed, legacyPassed);
  }, [courseProgress, passedCourses, candidateIdSet]);

  const stats = useMemo(() => {
    const scores = myOralExams
      .map((o) => (typeof o.score === 'number' ? o.score : parseFloat(String(o.score))))
      .filter((n) => !Number.isNaN(n) && n > 0);

    const hasScores = scores.length > 0;
    const avgNum = hasScores ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const avgText = avgNum !== null ? avgNum.toFixed(2) : '—';

    return {
      average: avgText,
      passedCoursesCount: myPassedCount,
      totalExams: myOralExams.length,
      status: avgNum === null ? 'در حال تحصیل' : avgNum >= 17 ? 'ممتاز' : avgNum >= 14 ? 'خوب' : 'نیاز به تلاش',
    };
  }, [myOralExams, myPassedCount]);

  const studentGrade = studentObj?.grade || currentUser?.gradeLabel || 'پایه ۷';

  const subTabs: Array<{ id: SummarySubTab; label: string }> = [
    { id: 'overview', label: 'نمای کلی' },
    { id: 'exams', label: `آزمون‌ها (${myOralExams.length})` },
    { id: 'research', label: `پژوهش (${myResearch.length})` },
    { id: 'notes', label: `توصیه‌ها (${myComments.length})` },
  ];

  if (isLoading) {
    return (
      <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center font-vazir shadow-2xs" dir="rtl">
        <div className="w-9 h-9 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold text-slate-600">در حال بارگذاری پرونده علمی...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 font-vazir text-right" dir="rtl">
      {/* 1. Luminous Academic Profile Hero Card */}
      <div className="relative overflow-hidden p-4 rounded-[26px] bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white shadow-[0_14px_34px_-12px_rgba(30,27,75,0.55)] border border-indigo-400/25">
        <div
          className="pointer-events-none absolute -top-14 -left-10 w-40 h-40 rounded-full opacity-35 student-microwave-ripple"
          style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.38) 0%, transparent 70%)' }}
          aria-hidden="true"
        />
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/10 text-amber-300 flex items-center justify-center border border-white/20 shrink-0">
              <GlyphReportCard size={20} active />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-white truncate">کارنامه و پرونده علمی</h2>
              <p className="text-[10.5px] text-indigo-200/85 font-medium truncate">
                {studentObj?.name || currentUser?.name || 'طلبه گرامی'} · {studentGrade}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-200 border border-amber-400/30 shrink-0">
            {stats.status}
          </span>
        </div>

        {/* 3 Real Academic Metrics */}
        <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3 border-t border-white/10 text-center">
          <div className="p-2 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-base font-black text-amber-300 font-mono tabular-nums">{stats.average}</div>
            <div className="text-[9.5px] text-slate-300 font-medium">معدل شفاهی</div>
          </div>
          <div className="p-2 rounded-2xl bg-emerald-500/15 border border-emerald-400/20">
            <div className="text-base font-black text-emerald-300 font-mono tabular-nums">{stats.passedCoursesCount}</div>
            <div className="text-[9.5px] text-emerald-200 font-medium">دروس گذرانده</div>
          </div>
          <div className="p-2 rounded-2xl bg-indigo-500/15 border border-indigo-400/20">
            <div className="text-base font-black text-indigo-300 font-mono tabular-nums">{stats.totalExams}</div>
            <div className="text-[9.5px] text-indigo-200 font-medium">آزمون‌های ثبت‌شده</div>
          </div>
        </div>
      </div>

      {/* 2. Segmented Sub-Tab Switcher */}
      <div className="bg-white rounded-2xl p-1 border border-slate-200/90 shadow-2xs grid grid-cols-4 gap-1">
        {subTabs.map((t) => {
          const isActive = activeSubTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveSubTab(t.id)}
              className={cn(
                'relative min-h-[40px] px-1.5 py-1.5 rounded-xl text-[10.5px] font-black transition-colors cursor-pointer truncate',
                isActive ? 'text-white' : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId={prefersReducedMotion ? undefined : 'summarySubTabPill'}
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  className="absolute inset-0 rounded-xl bg-indigo-600 shadow-2xs"
                />
              )}
              <span className="relative z-10 tabular-nums">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Sub-Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
          className="space-y-3"
        >
          {(activeSubTab === 'overview' || activeSubTab === 'exams') && (
            <div className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Award size={15} className="text-indigo-600" />
                  <span>سوابق آزمون‌های شفاهی و کتبی</span>
                </h3>
                {isTabAllowed('passed-courses') && onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('passed-courses')}
                    className="text-[10.5px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl flex items-center gap-1 cursor-pointer"
                  >
                    <GraduationCap size={13} />
                    <span>دروس گذرانده</span>
                    <ChevronLeft size={12} />
                  </button>
                )}
              </div>

              {myOralExams.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-2xl text-center text-xs text-slate-400">
                  هنوز نمره آزمون شفاهی رسمی برای شما ثبت نهایی نشده است.
                </div>
              ) : (
                <div className="space-y-2">
                  {myOralExams.map((ex) => (
                    <div
                      key={ex.id}
                      className="p-3 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <span className="text-xs font-black text-slate-900 block truncate">
                          {ex.title || ex.subjectType || 'آزمون شفاهی فقه و اصول'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          ممتحن: {ex.examinerName || 'هیات ممتحنه'} · {ex.date || 'دوره جاری'}
                        </span>
                      </div>
                      <span
                        className={cn(
                          'px-2.5 py-1 rounded-xl font-mono font-black text-xs tabular-nums shrink-0',
                          Number(ex.score) >= 16
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        )}
                      >
                        {ex.score ?? '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {(activeSubTab === 'overview' || activeSubTab === 'research') && (
            <div className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <FileText size={15} className="text-indigo-600" />
                  <span>پژوهش‌ها و مقالات علمی ({myResearch.length})</span>
                </h3>
                {isTabAllowed('research') && onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('research')}
                    className="text-[10.5px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-xl flex items-center gap-1 cursor-pointer"
                  >
                    <span>بخش پژوهش</span>
                    <ChevronLeft size={12} />
                  </button>
                )}
              </div>

              {myResearch.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-2xl text-center text-xs text-slate-400">
                  پژوهش یا مقاله‌ای در این نیم‌سال ثبت نشده است.
                </div>
              ) : (
                <div className="space-y-2">
                  {myResearch.map((res) => (
                    <div key={res.id} className="p-3 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-slate-900 truncate">{res.topic || 'پژوهش علمی'}</span>
                        <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg shrink-0 tabular-nums">
                          نمره: {res.score || 'در حال داوری'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        وضعیت: {res.supervisorNotes || res.stage || 'ثبت شده'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {(activeSubTab === 'overview' || activeSubTab === 'notes') && (
            <div className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-2xs space-y-2.5">
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <Sparkles size={15} className="text-indigo-600" />
                <span>توصیه‌های تربیتی و ارزیابی استاد پایه</span>
              </h3>
              {myComments.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-2xl text-center text-xs text-slate-400">
                  توصیه یا یادداشت تربیتی جدیدی ثبت نشده است.
                </div>
              ) : (
                <div className="space-y-2">
                  {myComments.map((cm) => (
                    <div key={cm.id} className="p-3 rounded-2xl bg-indigo-50/40 border border-indigo-100 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-indigo-700 font-bold">
                        <span>{cm.authorName || 'استاد محترم پایه'}</span>
                        <span className="tabular-nums">{cm.date}</span>
                      </div>
                      <p className="text-slate-800 leading-relaxed font-medium">{cm.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
