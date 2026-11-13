import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  BarChart2,
  Users,
  Layers,
  Calendar,
  BookOpen,
  MessageSquare,
  Sparkles,
  Award,
  Filter,
  Search,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Activity
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import {
  Student,
  StudyPeriod,
  PeriodicStudyLog,
  Program,
  Enrollment
} from '../../types';
import { localDb } from '../../lib/localDb';
import { cn } from '../../lib/utils';
import { toEnglishDigits } from '../../lib/jalali';
import DashboardAnalytics from './DashboardAnalytics';
import PeriodAnalytics from './PeriodAnalytics';
import StudentBreakoutSection from './StudentBreakoutSection';
import { RankingModalData } from './RankingModal';
import {
  getLogMetrics,
  getAllSystemGrades,
  normalizeGradeLabel,
  getStudentCoreCourses,
  formatMinutesToHoursAndMinutes,
  isStudentExempt
} from './studyUtils';

interface StudyChartsAndAnalyticsSectionProps {
  periods: StudyPeriod[];
  students: Student[];
  allLogs: PeriodicStudyLog[];
  selectedPeriodId: string;
  onSelectPeriodId: (id: string) => void;
  onOpenStudentCourseModal: (student: Student, periodId?: string) => void;
  onOpenRankingModal: (data: RankingModalData) => void;
  selectedStudentId: string | null;
  onSelectStudent: (studentId: string | null) => void;
}

type ChartMode = 'COMPARE_GRADES' | 'GRADE_OVER_TIME' | 'COMPARE_STUDENTS_IN_GRADE';
type MetricType = 'avgTotal' | 'avgCoreStudy' | 'avgCoreDisc' | 'avgFreeStudy' | 'complianceRate';
type SeasonFilter = 'ALL' | 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER';

const GRADE_COLORS: Record<string, string> = {
  'پایه ۷': '#4f46e5', // Indigo
  'پایه ۸': '#10b981', // Emerald
  'پایه ۹': '#f59e0b', // Amber
  'پایه ۱۰': '#ec4899' // Pink
};

const STUDENT_LINE_COLORS = [
  '#4f46e5',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
  '#8b5cf6',
  '#ef4444',
  '#14b8a6'
];

function detectPeriodSeason(period: StudyPeriod): SeasonFilter {
  const title = (period.title || '').trim();
  if (title.includes('بهار') || title.includes('فروردین') || title.includes('اردیبهشت') || title.includes('خرداد')) {
    return 'SPRING';
  }
  if (title.includes('تابستان') || title.includes('تیر') || title.includes('مرداد') || title.includes('شهریور')) {
    return 'SUMMER';
  }
  if (title.includes('پاییز') || title.includes('مهر') || title.includes('آبان') || title.includes('آذر')) {
    return 'AUTUMN';
  }
  if (title.includes('زمستان') || title.includes('دی') || title.includes('بهمن') || title.includes('اسفند')) {
    return 'WINTER';
  }

  const dStr = toEnglishDigits(String(period.startDate || '')).trim();
  const parts = dStr.replace(/-/g, '/').split('/');
  if (parts.length >= 2) {
    const yearOrMonth = parseInt(parts[0], 10);
    const month = yearOrMonth < 1700 ? parseInt(parts[1], 10) : ((parseInt(parts[1], 10) + 9) % 12) + 1;
    if (month >= 1 && month <= 3) return 'SPRING';
    if (month >= 4 && month <= 6) return 'SUMMER';
    if (month >= 7 && month <= 9) return 'AUTUMN';
    if (month >= 10 && month <= 12) return 'WINTER';
  }
  return 'AUTUMN';
}

const SEASON_LABELS: Record<SeasonFilter, string> = {
  ALL: 'همه فصل‌ها و زمان‌ها',
  SPRING: 'فصل بهار',
  SUMMER: 'فصل تابستان',
  AUTUMN: 'فصل پاییز',
  WINTER: 'فصل زمستان'
};

export default function StudyChartsAndAnalyticsSection({
  periods,
  students,
  allLogs,
  selectedPeriodId,
  onSelectPeriodId,
  onOpenStudentCourseModal,
  onOpenRankingModal,
  selectedStudentId,
  onSelectStudent
}: StudyChartsAndAnalyticsSectionProps) {
  const allGrades = useMemo(() => getAllSystemGrades(students), [students]);

  const [chartMode, setChartMode] = useState<ChartMode>('COMPARE_GRADES');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('avgTotal');
  const [selectedGradeForTrend, setSelectedGradeForTrend] = useState<string>('پایه ۷');
  const [seasonFilter, setSeasonFilter] = useState<SeasonFilter>('ALL');
  const [selectedStudentIdsForChart, setSelectedStudentIdsForChart] = useState<string[]>([]);

  // Course Breakdown Table states
  const [tableGradeFilter, setTableGradeFilter] = useState<string>('ALL');
  const [tablePeriodScope, setTablePeriodScope] = useState<string>('ALL');
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');

  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadPrograms = async () => {
      try {
        const [pList, eList, ceList] = await Promise.all([
          localDb.getDocs<Program>('programs'),
          localDb.getDocs<Enrollment>('enrollments'),
          localDb.getDocs<Enrollment>('course_enrollments')
        ]);
        if (!isMounted) return;
        setPrograms(pList || []);
        setEnrollments([...(eList || []), ...(ceList || [])]);
      } catch (e) {
        console.warn('Error loading programs in StudyChartsAndAnalyticsSection:', e);
      }
    };
    loadPrograms();
    const unsub = localDb.subscribe(loadPrograms);
    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  // Chronological periods (oldest to newest for trend charts)
  const chronologicalPeriods = useMemo(() => {
    return [...periods].reverse();
  }, [periods]);

  const filteredPeriodsBySeason = useMemo(() => {
    if (seasonFilter === 'ALL') return chronologicalPeriods;
    return chronologicalPeriods.filter(p => detectPeriodSeason(p) === seasonFilter);
  }, [chronologicalPeriods, seasonFilter]);

  // Students belonging to selectedGradeForTrend
  const studentsInSelectedGrade = useMemo(() => {
    return students.filter(s => normalizeGradeLabel(s.grade) === selectedGradeForTrend);
  }, [students, selectedGradeForTrend]);

  useEffect(() => {
    if (studentsInSelectedGrade.length > 0) {
      setSelectedStudentIdsForChart(studentsInSelectedGrade.slice(0, 5).map(s => s.id));
    } else {
      setSelectedStudentIdsForChart([]);
    }
  }, [selectedGradeForTrend, studentsInSelectedGrade]);

  // 1. Data for Chart Mode 1: Compare Grades (پایه ۷، ۸، ۹، ۱۰) across periods
  const compareGradesChartData = useMemo(() => {
    return filteredPeriodsBySeason.map(period => {
      const mandatoryMins =
        period.mandatoryMinutes !== undefined
          ? Number(period.mandatoryMinutes)
          : Math.round((Number(period.mandatoryHours) || 0) * 60);

      const row: Record<string, any> = {
        periodId: period.id,
        name: period.title,
        سقف_موظفی: mandatoryMins
      };

      allGrades.forEach(grade => {
        const gradeStudents = students.filter(s => normalizeGradeLabel(s.grade) === grade);
        if (gradeStudents.length === 0) {
          row[grade] = 0;
          return;
        }

        let sumTotal = 0;
        let sumCoreStudy = 0;
        let sumCoreDisc = 0;
        let sumFree = 0;
        let compliantCount = 0;
        let activeCount = 0;

        gradeStudents.forEach(st => {
          const log = allLogs.find(l => l.periodId === period.id && l.studentId === st.id);
          const exempt = isStudentExempt(period, st, log);
          if (exempt) return;
          activeCount++;
          const m = getLogMetrics(log);
          sumTotal += m.totalMinutes;
          sumCoreStudy += m.coreStudyMinutes;
          sumCoreDisc += m.coreDiscussionMinutes;
          sumFree += m.freeStudyMinutes;
          if (mandatoryMins > 0 && m.totalMinutes >= mandatoryMins) {
            compliantCount++;
          }
        });

        const denom = activeCount > 0 ? activeCount : 1;
        if (selectedMetric === 'avgTotal') row[grade] = Math.round(sumTotal / denom);
        else if (selectedMetric === 'avgCoreStudy') row[grade] = Math.round(sumCoreStudy / denom);
        else if (selectedMetric === 'avgCoreDisc') row[grade] = Math.round(sumCoreDisc / denom);
        else if (selectedMetric === 'avgFreeStudy') row[grade] = Math.round(sumFree / denom);
        else if (selectedMetric === 'complianceRate') row[grade] = Math.round((compliantCount / denom) * 100);
      });

      return row;
    });
  }, [filteredPeriodsBySeason, allGrades, students, allLogs, selectedMetric]);

  // 2. Data for Chart Mode 2: Single Grade across Periods & Seasons
  const singleGradeTimeChartData = useMemo(() => {
    const gradeStudents = students.filter(s => normalizeGradeLabel(s.grade) === selectedGradeForTrend);
    return filteredPeriodsBySeason.map(period => {
      const mandatoryMins =
        period.mandatoryMinutes !== undefined
          ? Number(period.mandatoryMinutes)
          : Math.round((Number(period.mandatoryHours) || 0) * 60);

      let sumTotal = 0;
      let sumCoreStudy = 0;
      let sumCoreDisc = 0;
      let sumFree = 0;
      let activeCount = 0;

      gradeStudents.forEach(st => {
        const log = allLogs.find(l => l.periodId === period.id && l.studentId === st.id);
        if (isStudentExempt(period, st, log)) return;
        activeCount++;
        const m = getLogMetrics(log);
        sumTotal += m.totalMinutes;
        sumCoreStudy += m.coreStudyMinutes;
        sumCoreDisc += m.coreDiscussionMinutes;
        sumFree += m.freeStudyMinutes;
      });

      const denom = activeCount > 0 ? activeCount : 1;
      const seasonKey = detectPeriodSeason(period);

      return {
        periodId: period.id,
        name: period.title,
        seasonLabel: SEASON_LABELS[seasonKey],
        کل_کارکرد: gradeStudents.length > 0 ? Math.round(sumTotal / denom) : 0,
        مطالعه_اصلی: gradeStudents.length > 0 ? Math.round(sumCoreStudy / denom) : 0,
        مباحثه_اصلی: gradeStudents.length > 0 ? Math.round(sumCoreDisc / denom) : 0,
        مطالعه_آزاد: gradeStudents.length > 0 ? Math.round(sumFree / denom) : 0,
        سقف_موظفی: mandatoryMins
      };
    });
  }, [filteredPeriodsBySeason, students, selectedGradeForTrend, allLogs]);

  // Seasonal Summary Cards for Mode 2
  const seasonalSummaryForGrade = useMemo(() => {
    const seasons: Array<{ key: SeasonFilter; label: string; color: string }> = [
      { key: 'SPRING', label: 'بهار', color: 'emerald' },
      { key: 'SUMMER', label: 'تابستان', color: 'amber' },
      { key: 'AUTUMN', label: 'پاییز', color: 'orange' },
      { key: 'WINTER', label: 'زمستان', color: 'indigo' }
    ];
    const gradeStudents = students.filter(s => normalizeGradeLabel(s.grade) === selectedGradeForTrend);

    return seasons.map(s => {
      const sPeriods = chronologicalPeriods.filter(p => detectPeriodSeason(p) === s.key);
      let totalMins = 0;
      let count = 0;
      sPeriods.forEach(p => {
        gradeStudents.forEach(st => {
          const log = allLogs.find(l => l.periodId === p.id && l.studentId === st.id);
          if (!isStudentExempt(p, st, log)) {
            totalMins += getLogMetrics(log).totalMinutes;
            count++;
          }
        });
      });
      return {
        ...s,
        periodsCount: sPeriods.length,
        avgMinutes: count > 0 ? Math.round(totalMins / count) : 0
      };
    });
  }, [chronologicalPeriods, students, selectedGradeForTrend, allLogs]);

  // 3. Data for Chart Mode 3: Compare Students within a Grade across Periods
  const compareStudentsInGradeChartData = useMemo(() => {
    const targetStudents = studentsInSelectedGrade.filter(s => selectedStudentIdsForChart.includes(s.id));
    return filteredPeriodsBySeason.map(period => {
      const mandatoryMins =
        period.mandatoryMinutes !== undefined
          ? Number(period.mandatoryMinutes)
          : Math.round((Number(period.mandatoryHours) || 0) * 60);

      const row: Record<string, any> = {
        periodId: period.id,
        name: period.title,
        سقف_موظفی: mandatoryMins
      };

      targetStudents.forEach(st => {
        const log = allLogs.find(l => l.periodId === period.id && l.studentId === st.id);
        const m = getLogMetrics(log);
        if (selectedMetric === 'avgTotal') row[st.name] = m.totalMinutes;
        else if (selectedMetric === 'avgCoreStudy') row[st.name] = m.coreStudyMinutes;
        else if (selectedMetric === 'avgCoreDisc') row[st.name] = m.coreDiscussionMinutes;
        else if (selectedMetric === 'avgFreeStudy') row[st.name] = m.freeStudyMinutes;
        else row[st.name] = m.totalMinutes;
      });

      return row;
    });
  }, [filteredPeriodsBySeason, studentsInSelectedGrade, selectedStudentIdsForChart, allLogs, selectedMetric]);

  // 4. Detailed Grade & Student Per-Course Breakdown Table Data
  const studentCourseBreakdownTableRows = useMemo(() => {
    const filteredSt = students.filter(s => {
      if (tableGradeFilter !== 'ALL' && normalizeGradeLabel(s.grade) !== tableGradeFilter) {
        return false;
      }
      if (tableSearchQuery.trim()) {
        const q = tableSearchQuery.trim().toLowerCase();
        if (!(s.name || '').toLowerCase().includes(q) && !(s.nationalId || '').includes(q)) {
          return false;
        }
      }
      return true;
    });

    return filteredSt.map(st => {
      const enrolledCourses = getStudentCoreCourses(st, programs, enrollments);
      const enrolledTitlesSet = new Set(enrolledCourses.map(c => c.title.trim()));

      const stLogs = allLogs.filter(l => {
        if (String(l.studentId) !== String(st.id)) return false;
        if (tablePeriodScope !== 'ALL' && String(l.periodId) !== String(tablePeriodScope)) return false;
        return true;
      });

      const courseMap = new Map<string, { title: string; study: number; disc: number; total: number }>();
      enrolledCourses.forEach(c => {
        courseMap.set(c.title.trim(), { title: c.title.trim(), study: 0, disc: 0, total: 0 });
      });

      let freeStudy = 0;
      let unassignedCoreStudy = 0;
      let unassignedCoreDisc = 0;

      stLogs.forEach(log => {
        const m = getLogMetrics(log);
        freeStudy += m.freeStudyMinutes || 0;
        if (Array.isArray(m.coursesBreakdown) && m.coursesBreakdown.length > 0) {
          m.coursesBreakdown.forEach(cd => {
            const t = (cd.courseTitle || '').trim();
            if (!t) return;
            if (programs.length > 0 && enrolledTitlesSet.size > 0 && !enrolledTitlesSet.has(t)) return;
            const s = Math.round(Number(cd.studyMinutes) || 0);
            const d = Math.round(Number(cd.discussionMinutes) || 0);
            const existing = courseMap.get(t);
            if (existing) {
              existing.study += s;
              existing.disc += d;
              existing.total += s + d;
            } else {
              courseMap.set(t, { title: t, study: s, disc: d, total: s + d });
            }
          });
        } else {
          unassignedCoreStudy += m.coreStudyMinutes || 0;
          unassignedCoreDisc += m.coreDiscussionMinutes || 0;
        }
      });

      if ((unassignedCoreStudy > 0 || unassignedCoreDisc > 0) && courseMap.size > 0) {
        const cnt = courseMap.size;
        let idx = 0;
        courseMap.forEach(val => {
          const s = Math.floor(unassignedCoreStudy / cnt) + (idx === 0 ? unassignedCoreStudy % cnt : 0);
          const d = Math.floor(unassignedCoreDisc / cnt) + (idx === 0 ? unassignedCoreDisc % cnt : 0);
          val.study += s;
          val.disc += d;
          val.total += s + d;
          idx++;
        });
      }

      const coursesList = Array.from(courseMap.values());
      const coreStudySum = coursesList.reduce((acc, c) => acc + c.study, 0) + (courseMap.size === 0 ? unassignedCoreStudy : 0);
      const coreDiscSum = coursesList.reduce((acc, c) => acc + c.disc, 0) + (courseMap.size === 0 ? unassignedCoreDisc : 0);
      const coreTotalSum = coreStudySum + coreDiscSum;
      const grandTotal = coreTotalSum + freeStudy;

      return {
        student: st,
        grade: normalizeGradeLabel(st.grade) || 'نامشخص',
        coursesList,
        coreStudySum,
        coreDiscSum,
        coreTotalSum,
        freeStudy,
        grandTotal
      };
    });
  }, [students, tableGradeFilter, tableSearchQuery, programs, enrollments, allLogs, tablePeriodScope]);

  const currentSelectedPeriod = useMemo(
    () => periods.find(p => p.id === selectedPeriodId) || periods[0] || null,
    [periods, selectedPeriodId]
  );

  const currentPeriodLogs = useMemo(
    () => (currentSelectedPeriod ? allLogs.filter(l => l.periodId === currentSelectedPeriod.id) : []),
    [allLogs, currentSelectedPeriod]
  );

  return (
    <div className="space-y-8" dir="rtl">
      {/* 1. Interactive LineCharts Hub */}
      <div className="bg-white rounded-[32px] border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Header & Mode Switcher */}
        <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-13 h-13 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-amber-300 shrink-0">
                <Activity size={26} />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black text-white">
                  مرکز نمودارهای خطی و تحلیل روند مطالعاتی (LineChart)
                </h3>
                <p className="text-xs text-slate-300 font-medium mt-1">
                  مقایسه پایه‌ها با یکدیگر، تحلیل روند هر پایه در فصول مختلف، و مقایسه طلاب هر پایه
                </p>
              </div>
            </div>

            {/* 3 Chart Mode Buttons */}
            <div className="flex flex-wrap items-center gap-2 bg-white/10 p-1.5 rounded-2xl border border-white/10">
              <button
                type="button"
                onClick={() => setChartMode('COMPARE_GRADES')}
                className={cn(
                  'px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer',
                  chartMode === 'COMPARE_GRADES'
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'text-slate-200 hover:bg-white/10'
                )}
              >
                <Layers size={15} />
                <span>۱. مقایسه پایه‌ها با هم</span>
              </button>

              <button
                type="button"
                onClick={() => setChartMode('GRADE_OVER_TIME')}
                className={cn(
                  'px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer',
                  chartMode === 'GRADE_OVER_TIME'
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'text-slate-200 hover:bg-white/10'
                )}
              >
                <Calendar size={15} />
                <span>۲. روند یک پایه در زمان و فصل‌ها</span>
              </button>

              <button
                type="button"
                onClick={() => setChartMode('COMPARE_STUDENTS_IN_GRADE')}
                className={cn(
                  'px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer',
                  chartMode === 'COMPARE_STUDENTS_IN_GRADE'
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'text-slate-200 hover:bg-white/10'
                )}
              >
                <Users size={15} />
                <span>۳. مقایسه طلاب یک پایه با هم</span>
              </button>
            </div>
          </div>

          {/* Secondary Filter Bar inside Chart Header */}
          <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Season Filter */}
              <div className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-xl px-3 py-1.5">
                <Calendar size={14} className="text-amber-300" />
                <span className="text-[11px] font-bold text-slate-300">بازه فصلی:</span>
                <select
                  value={seasonFilter}
                  onChange={e => setSeasonFilter(e.target.value as SeasonFilter)}
                  className="bg-transparent text-white text-xs font-black outline-none cursor-pointer"
                >
                  <option value="ALL" className="text-slate-900">همه فصل‌ها و زمان‌ها</option>
                  <option value="SPRING" className="text-slate-900">🌱 فصل بهار</option>
                  <option value="SUMMER" className="text-slate-900">☀️ فصل تابستان</option>
                  <option value="AUTUMN" className="text-slate-900">🍂 فصل پاییز</option>
                  <option value="WINTER" className="text-slate-900">❄️ فصل زمستان</option>
                </select>
              </div>

              {/* Grade Selector (when Mode 2 or Mode 3 is active) */}
              {(chartMode === 'GRADE_OVER_TIME' || chartMode === 'COMPARE_STUDENTS_IN_GRADE') && (
                <div className="flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-xl p-1">
                  {allGrades.map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setSelectedGradeForTrend(g)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer',
                        selectedGradeForTrend === g
                          ? 'bg-amber-400 text-slate-950 shadow-xs'
                          : 'text-slate-200 hover:bg-white/10'
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Metric Selector (when Mode 1 or Mode 3 is active) */}
            {(chartMode === 'COMPARE_GRADES' || chartMode === 'COMPARE_STUDENTS_IN_GRADE') && (
              <div className="flex flex-wrap items-center gap-1.5 bg-white/10 p-1 rounded-xl border border-white/15">
                {(
                  [
                    { id: 'avgTotal', label: 'کل کارکرد (دقیقه)' },
                    { id: 'avgCoreStudy', label: 'مطالعه دروس اصلی' },
                    { id: 'avgCoreDisc', label: 'مباحثه دروس اصلی' },
                    { id: 'avgFreeStudy', label: 'مطالعه آزاد' },
                    ...(chartMode === 'COMPARE_GRADES' ? [{ id: 'complianceRate', label: 'درصد تحقق موظفی' }] : [])
                  ] as Array<{ id: MetricType; label: string }>
                ).map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMetric(m.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer',
                      selectedMetric === m.id
                        ? 'bg-indigo-500 text-white shadow-xs'
                        : 'text-slate-300 hover:text-white'
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chart Canvas Area */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Student chips selector for Mode 3 */}
          {chartMode === 'COMPARE_STUDENTS_IN_GRADE' && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700">
                  انتخاب طلاب {selectedGradeForTrend} برای مقایسه روی نمودار خطی:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedStudentIdsForChart(studentsInSelectedGrade.map(s => s.id))}
                    className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    انتخاب همه ({studentsInSelectedGrade.length.toLocaleString('fa-IR')})
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedStudentIdsForChart(studentsInSelectedGrade.slice(0, 3).map(s => s.id))}
                    className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                  >
                    ۳ نفر اول
                  </button>
                </div>
              </div>
              {studentsInSelectedGrade.length === 0 ? (
                <p className="text-xs font-bold text-amber-600">
                  هیچ طلبه‌ای در {selectedGradeForTrend} ثبت نشده است.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {studentsInSelectedGrade.map((st, idx) => {
                    const isSelected = selectedStudentIdsForChart.includes(st.id);
                    const color = STUDENT_LINE_COLORS[idx % STUDENT_LINE_COLORS.length];
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedStudentIdsForChart(prev => prev.filter(id => id !== st.id));
                          } else {
                            setSelectedStudentIdsForChart(prev => [...prev, st.id]);
                          }
                        }}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-xs font-black border transition-all flex items-center gap-2 cursor-pointer',
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        )}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span>{st.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Seasonal Cards for Mode 2 */}
          {chartMode === 'GRADE_OVER_TIME' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              {seasonalSummaryForGrade.map(s => (
                <div
                  key={s.key}
                  onClick={() => setSeasonFilter(seasonFilter === s.key ? 'ALL' : s.key)}
                  className={cn(
                    'p-4 rounded-2xl border transition-all cursor-pointer',
                    seasonFilter === s.key
                      ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-500/20'
                      : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/70'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-slate-800">فصل {s.label}</span>
                    <span className="text-[11px] font-bold text-slate-500">
                      {s.periodsCount.toLocaleString('fa-IR')} دوره
                    </span>
                  </div>
                  <div className="text-lg font-black text-indigo-700">
                    {s.avgMinutes.toLocaleString('fa-IR')}{' '}
                    <span className="text-xs font-bold text-slate-500">دقیقه میانگین</span>
                  </div>
                  <div className="text-[11px] font-bold text-slate-400 mt-0.5">
                    {formatMinutesToHoursAndMinutes(s.avgMinutes)} به ازای هر طلبه
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recharts LineChart Container */}
          <div className="h-[370px] w-full bg-slate-50/50 rounded-3xl p-4 border border-slate-100" dir="ltr">
            {filteredPeriodsBySeason.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 font-bold text-sm" dir="rtl">
                هیچ دوره مطالعاتی در این بازه زمانی یافت نشد.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {chartMode === 'COMPARE_GRADES' ? (
                  <LineChart data={compareGradesChartData} margin={{ top: 15, right: 25, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} />
                    <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '16px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                        direction: 'rtl',
                        textAlign: 'right',
                        fontWeight: 800,
                        fontSize: '12px'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 800, paddingTop: '10px' }} />
                    {allGrades.map(grade => (
                      <Line
                        key={grade}
                        type="monotone"
                        dataKey={grade}
                        name={grade}
                        stroke={GRADE_COLORS[grade] || '#6366f1'}
                        strokeWidth={3}
                        dot={{ r: 5, strokeWidth: 2 }}
                        activeDot={{ r: 7 }}
                      />
                    ))}
                    {selectedMetric === 'avgTotal' && (
                      <Line
                        type="monotone"
                        dataKey="سقف_موظفی"
                        name="سقف موظفی دوره"
                        stroke="#94a3b8"
                        strokeDasharray="6 6"
                        strokeWidth={2}
                        dot={false}
                      />
                    )}
                  </LineChart>
                ) : chartMode === 'GRADE_OVER_TIME' ? (
                  <LineChart data={singleGradeTimeChartData} margin={{ top: 15, right: 25, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} />
                    <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '16px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                        direction: 'rtl',
                        textAlign: 'right',
                        fontWeight: 800,
                        fontSize: '12px'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 800, paddingTop: '10px' }} />
                    <Line
                      type="monotone"
                      dataKey="کل_کارکرد"
                      name={`کل کارکرد (${selectedGradeForTrend})`}
                      stroke="#4f46e5"
                      strokeWidth={3.5}
                      dot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="مطالعه_اصلی"
                      name="مطالعه دروس اصلی"
                      stroke="#0ea5e9"
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="مباحثه_اصلی"
                      name="مباحثه دروس اصلی"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="مطالعه_آزاد"
                      name="مطالعه آزاد"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="سقف_موظفی"
                      name="سقف موظفی دوره"
                      stroke="#ef4444"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                ) : (
                  <LineChart data={compareStudentsInGradeChartData} margin={{ top: 15, right: 25, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} />
                    <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '16px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                        direction: 'rtl',
                        textAlign: 'right',
                        fontWeight: 800,
                        fontSize: '12px'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 800, paddingTop: '10px' }} />
                    {studentsInSelectedGrade
                      .filter(s => selectedStudentIdsForChart.includes(s.id))
                      .map((st, idx) => (
                        <Line
                          key={st.id}
                          type="monotone"
                          dataKey={st.name}
                          name={st.name}
                          stroke={STUDENT_LINE_COLORS[idx % STUDENT_LINE_COLORS.length]}
                          strokeWidth={3}
                          dot={{ r: 4.5 }}
                          activeDot={{ r: 7 }}
                        />
                      ))}
                    <Line
                      type="monotone"
                      dataKey="سقف_موظفی"
                      name="سقف موظفی"
                      stroke="#94a3b8"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* 2. Detailed Grade & Student Per-Course Study & Discussion Breakdown Table */}
      <div className="bg-white rounded-[32px] border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-6 sm:p-7 border-b border-slate-100 bg-slate-50/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
              <BookOpen size={22} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                جدول جامع تفکیک دروس و مطالعه آزاد به تفکیک هر پایه و هر طلبه
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                مشاهده کلاس‌های فعال هر طلبه و میزان مطالعه و مباحثه در هر درس + مطالعه آزاد (برای مشاهده پرونده کامل، روی نام طلبه کلیک کنید)
              </p>
            </div>
          </div>

          {/* Filters for Grade, Period, Search */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Grade Filter with all 4 grades */}
            <select
              value={tableGradeFilter}
              onChange={e => setTableGradeFilter(e.target.value)}
              className="px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-black text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">همه پایه‌ها ({allGrades.join('، ')})</option>
              {allGrades.map(g => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            {/* Period Scope Filter */}
            <select
              value={tablePeriodScope}
              onChange={e => setTablePeriodScope(e.target.value)}
              className="px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-black text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">📊 تجمیع کل دوره‌ها ({periods.length.toLocaleString('fa-IR')} دوره)</option>
              {periods.map(p => (
                <option key={p.id} value={p.id}>
                  📅 {p.title}
                </option>
              ))}
            </select>

            {/* Search Student */}
            <div className="relative">
              <Search size={15} className="absolute right-3 top-3 text-slate-400" />
              <input
                type="text"
                value={tableSearchQuery}
                onChange={e => setTableSearchQuery(e.target.value)}
                placeholder="جستجوی نام طلبه..."
                className="pr-9 pl-3 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 w-48"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-xs">
                <th className="py-4 px-4 font-black w-12 text-center">ردیف</th>
                <th className="py-4 px-4 font-black">نام طلبه (کلیک برای جزئیات)</th>
                <th className="py-4 px-4 font-black text-center w-24">پایه</th>
                <th className="py-4 px-4 font-black">ریز کارکرد در هر درس اصلی ثبت‌نام‌شده (مطالعه / مباحثه)</th>
                <th className="py-4 px-4 font-black text-center bg-indigo-950/60">مجموع دروس اصلی</th>
                <th className="py-4 px-4 font-black text-center bg-amber-950/50">مطالعه آزاد</th>
                <th className="py-4 px-4 font-black text-center bg-slate-800">کل کارکرد</th>
                <th className="py-4 px-4 font-black text-center w-28">پرونده درس‌به‌درس</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {studentCourseBreakdownTableRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400 font-bold">
                    هیچ طلبه‌ای با این فیلتر یافت نشد.
                  </td>
                </tr>
              ) : (
                studentCourseBreakdownTableRows.map((row, idx) => (
                  <tr
                    key={row.student.id}
                    onClick={() =>
                      onOpenStudentCourseModal(
                        row.student,
                        tablePeriodScope === 'ALL' ? undefined : tablePeriodScope
                      )
                    }
                    className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 text-center font-black text-slate-400">
                      {(idx + 1).toLocaleString('fa-IR')}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-2">
                        <span>{row.student.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 font-black text-[11px]">
                        {row.grade}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {row.coursesList.length === 0 ? (
                        <span className="text-[11px] font-bold text-slate-400">
                          بدون کلاس اصلی فعال
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {row.coursesList.map(c => (
                            <div
                              key={c.title}
                              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2"
                            >
                              <span className="font-black text-slate-800 text-[11px]">{c.title}:</span>
                              <span className="text-[11px] font-bold text-indigo-700">
                                م {c.study.toLocaleString('fa-IR')}
                              </span>
                              <span className="text-slate-300">|</span>
                              <span className="text-[11px] font-bold text-emerald-700">
                                مب {c.disc.toLocaleString('fa-IR')}
                              </span>
                              <span className="px-1.5 py-0.5 rounded-md bg-slate-200/80 text-slate-900 font-black text-[10px]">
                                کل: {c.total.toLocaleString('fa-IR')} د
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center bg-indigo-50/20">
                      <div className="font-black text-indigo-700 text-sm">
                        {row.coreTotalSum.toLocaleString('fa-IR')} <span className="text-[10px]">د</span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-500">
                        م: {row.coreStudySum.toLocaleString('fa-IR')} | مب: {row.coreDiscSum.toLocaleString('fa-IR')}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center bg-amber-50/20">
                      <div className="font-black text-amber-700 text-sm">
                        {row.freeStudy.toLocaleString('fa-IR')} <span className="text-[10px]">د</span>
                      </div>
                      <div className="text-[10px] font-bold text-amber-600">
                        {formatMinutesToHoursAndMinutes(row.freeStudy)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center bg-slate-50">
                      <div className="font-black text-slate-900 text-sm">
                        {row.grandTotal.toLocaleString('fa-IR')} <span className="text-[10px]">دقیقه</span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-500">
                        {formatMinutesToHoursAndMinutes(row.grandTotal)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onOpenStudentCourseModal(
                            row.student,
                            tablePeriodScope === 'ALL' ? undefined : tablePeriodScope
                          );
                        }}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-black text-[11px] transition-all inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye size={13} />
                        <span>مشاهده</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Overall & Period KPIs and Top Performers (Moved from Section 2 to Section 3) */}
      <DashboardAnalytics periods={periods} students={students} allLogs={allLogs} onOpenRankingModal={onOpenRankingModal} />

      {currentSelectedPeriod && (
        <div className="space-y-4">
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Award size={20} className="text-indigo-600" />
              <h4 className="text-sm font-black text-slate-800">
                شاخص‌های آماری و برترین‌های دوره انتخابی: «{currentSelectedPeriod.title}»
              </h4>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">تغییر دوره:</span>
              <select
                value={currentSelectedPeriod.id}
                onChange={e => onSelectPeriodId(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-black text-slate-800 outline-none"
              >
                {periods.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <PeriodAnalytics
            period={currentSelectedPeriod}
            students={students}
            allLogs={allLogs}
            onOpenRankingModal={onOpenRankingModal}
          />
        </div>
      )}

      {/* 4. Individual Student Breakout Section */}
      <StudentBreakoutSection 
        periods={periods} 
        students={students} 
        allLogs={allLogs}
        selectedStudentId={selectedStudentId}
        onSelectStudent={onSelectStudent}
      />
    </div>
  );
}
