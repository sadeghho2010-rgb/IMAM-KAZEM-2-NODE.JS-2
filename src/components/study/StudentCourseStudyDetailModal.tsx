import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  User,
  BookOpen,
  MessageSquare,
  Sparkles,
  Calendar,
  Award,
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Student,
  StudyPeriod,
  PeriodicStudyLog,
  Program,
  Enrollment,
  StudyDailyEntry
} from '../../types';
import { localDb } from '../../lib/localDb';
import { cn } from '../../lib/utils';
import {
  getLogMetrics,
  getStudentCoreCourses,
  formatMinutesToHoursAndMinutes,
  normalizeGradeLabel,
  isStudentExempt
} from './studyUtils';

interface StudentCourseStudyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  periods: StudyPeriod[];
  allLogs: PeriodicStudyLog[];
  initialPeriodId?: string;
  programs?: Program[];
  enrollments?: Enrollment[];
}

export default function StudentCourseStudyDetailModal({
  isOpen,
  onClose,
  student,
  periods,
  allLogs,
  initialPeriodId,
  programs: propPrograms,
  enrollments: propEnrollments
}: StudentCourseStudyDetailModalProps) {
  const [selectedScope, setSelectedScope] = useState<string>(initialPeriodId || 'ALL');
  const [programs, setPrograms] = useState<Program[]>(propPrograms || []);
  const [enrollments, setEnrollments] = useState<Enrollment[]>(propEnrollments || []);
  const [dailyEntries, setDailyEntries] = useState<StudyDailyEntry[]>([]);

  useEffect(() => {
    if (initialPeriodId) {
      setSelectedScope(initialPeriodId);
    } else if (periods.length > 0) {
      setSelectedScope(periods[0].id);
    } else {
      setSelectedScope('ALL');
    }
  }, [initialPeriodId, student?.id, isOpen, periods]);

  useEffect(() => {
    if (!isOpen || !student) return;
    let isMounted = true;
    const loadExtra = async () => {
      try {
        const [pList, eList, ceList, dList] = await Promise.all([
          propPrograms && propPrograms.length > 0 ? Promise.resolve(propPrograms) : localDb.getDocs<Program>('programs'),
          propEnrollments && propEnrollments.length > 0 ? Promise.resolve(propEnrollments) : localDb.getDocs<Enrollment>('enrollments'),
          localDb.getDocs<Enrollment>('course_enrollments'),
          localDb.getDocs<StudyDailyEntry>('study_daily_entries')
        ]);
        if (!isMounted) return;
        setPrograms(pList || []);
        setEnrollments([...(eList || []), ...(ceList || [])]);
        const myDaily = (dList || []).filter(
          d =>
            String(d.studentId || (d as any).student_id || '').trim() === String(student.id).trim() ||
            (student.nationalId && String((d as any).nationalId || '').trim() === String(student.nationalId).trim())
        );
        setDailyEntries(
          myDaily.sort((a, b) => String(b.entryDate || b.createdAt || '').localeCompare(String(a.entryDate || a.createdAt || '')))
        );
      } catch (e) {
        console.warn('Error loading student course study modal details:', e);
      }
    };
    loadExtra();
    return () => {
      isMounted = false;
    };
  }, [isOpen, student, propPrograms, propEnrollments]);

  const enrolledCoreCourses = useMemo(() => {
    if (!student) return [];
    return getStudentCoreCourses(student, programs, enrollments);
  }, [student, programs, enrollments]);

  const studentLogs = useMemo(() => {
    if (!student) return [];
    return allLogs.filter(l => String(l.studentId) === String(student.id));
  }, [allLogs, student]);

  const scopedLogs = useMemo(() => {
    if (selectedScope === 'ALL') return studentLogs;
    return studentLogs.filter(l => String(l.periodId) === String(selectedScope));
  }, [studentLogs, selectedScope]);

  const selectedPeriodObj = useMemo(() => {
    if (selectedScope === 'ALL') return null;
    return periods.find(p => String(p.id) === String(selectedScope)) || null;
  }, [periods, selectedScope]);

  // Compute per-course study and discussion breakdown for the selected scope
  const courseBreakdownData = useMemo(() => {
    if (!student) {
      return {
        rows: [] as Array<{
          courseId: string;
          courseTitle: string;
          subjectType: string;
          isEnrolled: boolean;
          studyMinutes: number;
          discussionMinutes: number;
          totalMinutes: number;
        }>,
        freeStudyMinutes: 0,
        freeStudyBooks: [] as string[],
        coreStudyTotal: 0,
        coreDiscussionTotal: 0,
        coreTotal: 0,
        grandTotal: 0
      };
    }

    const map = new Map<
      string,
      {
        courseId: string;
        courseTitle: string;
        subjectType: string;
        isEnrolled: boolean;
        studyMinutes: number;
        discussionMinutes: number;
      }
    >();

    // Seed with student's currently enrolled core courses
    enrolledCoreCourses.forEach(c => {
      const key = c.title.trim();
      map.set(key, {
        courseId: c.id,
        courseTitle: key,
        subjectType: c.subjectType || 'درس اصلی',
        isEnrolled: true,
        studyMinutes: 0,
        discussionMinutes: 0
      });
    });

    const enrolledTitlesSet = new Set(enrolledCoreCourses.map(c => c.title.trim()));
    let freeStudyMinutes = 0;
    const freeBooksSet = new Set<string>();
    let fallbackUnassignedStudy = 0;
    let fallbackUnassignedDisc = 0;

    scopedLogs.forEach(log => {
      const metrics = getLogMetrics(log);
      freeStudyMinutes += metrics.freeStudyMinutes || 0;
      if (log.freeStudyBookTitle && log.freeStudyBookTitle.trim()) {
        log.freeStudyBookTitle
          .split('،')
          .map(s => s.trim())
          .filter(Boolean)
          .forEach(b => freeBooksSet.add(b));
      }

      if (Array.isArray(metrics.coursesBreakdown) && metrics.coursesBreakdown.length > 0) {
        metrics.coursesBreakdown.forEach(cd => {
          const title = (cd.courseTitle || '').trim();
          if (!title) return;
          // Only show courses the student is enrolled in (if programs exist), or if student has no enrolled courses
          if (programs.length > 0 && enrolledTitlesSet.size > 0 && !enrolledTitlesSet.has(title)) {
            return;
          }
          const existing = map.get(title);
          if (existing) {
            existing.studyMinutes += Math.round(Number(cd.studyMinutes) || 0);
            existing.discussionMinutes += Math.round(Number(cd.discussionMinutes) || 0);
          } else {
            map.set(title, {
              courseId: cd.courseId || `c_${title}`,
              courseTitle: title,
              subjectType: 'درس اصلی',
              isEnrolled: enrolledTitlesSet.has(title),
              studyMinutes: Math.round(Number(cd.studyMinutes) || 0),
              discussionMinutes: Math.round(Number(cd.discussionMinutes) || 0)
            });
          }
        });
      } else {
        fallbackUnassignedStudy += metrics.coreStudyMinutes || 0;
        fallbackUnassignedDisc += metrics.coreDiscussionMinutes || 0;
      }
    });

    // If there are aggregate core minutes without per-course breakdown, distribute or show as general core entry
    if (fallbackUnassignedStudy > 0 || fallbackUnassignedDisc > 0) {
      if (map.size > 0) {
        const count = map.size;
        const perCourseStudy = Math.floor(fallbackUnassignedStudy / count);
        const remStudy = fallbackUnassignedStudy - perCourseStudy * count;
        const perCourseDisc = Math.floor(fallbackUnassignedDisc / count);
        const remDisc = fallbackUnassignedDisc - perCourseDisc * count;
        let idx = 0;
        map.forEach(val => {
          val.studyMinutes += perCourseStudy + (idx === 0 ? remStudy : 0);
          val.discussionMinutes += perCourseDisc + (idx === 0 ? remDisc : 0);
          idx++;
        });
      } else {
        map.set('مجموع دروس اصلی (ثبت تجمیعی)', {
          courseId: 'core_general',
          courseTitle: 'مجموع دروس اصلی (ثبت تجمیعی)',
          subjectType: 'دروس اصلی',
          isEnrolled: true,
          studyMinutes: fallbackUnassignedStudy,
          discussionMinutes: fallbackUnassignedDisc
        });
      }
    }

    const rows = Array.from(map.values()).map(r => ({
      ...r,
      totalMinutes: r.studyMinutes + r.discussionMinutes
    }));

    const coreStudyTotal = rows.reduce((s, r) => s + r.studyMinutes, 0);
    const coreDiscussionTotal = rows.reduce((s, r) => s + r.discussionMinutes, 0);
    const coreTotal = coreStudyTotal + coreDiscussionTotal;
    const grandTotal = coreTotal + freeStudyMinutes;

    return {
      rows,
      freeStudyMinutes,
      freeStudyBooks: Array.from(freeBooksSet),
      coreStudyTotal,
      coreDiscussionTotal,
      coreTotal,
      grandTotal
    };
  }, [student, enrolledCoreCourses, scopedLogs, programs.length]);

  // Period-by-period summary for this student
  const periodByPeriodRows = useMemo(() => {
    if (!student) return [];
    return periods.map(p => {
      const log = studentLogs.find(l => String(l.periodId) === String(p.id));
      const metrics = getLogMetrics(log);
      const exempt = isStudentExempt(p, student, log);
      const mandatoryMins =
        p.mandatoryMinutes !== undefined ? Number(p.mandatoryMinutes) : Math.round((Number(p.mandatoryHours) || 0) * 60);

      // Map each enrolled course's study & discussion in this period
      const perCourseMap: Record<string, { study: number; disc: number; total: number }> = {};
      enrolledCoreCourses.forEach(c => {
        perCourseMap[c.title] = { study: 0, disc: 0, total: 0 };
      });

      if (Array.isArray(metrics.coursesBreakdown) && metrics.coursesBreakdown.length > 0) {
        metrics.coursesBreakdown.forEach(cd => {
          const t = (cd.courseTitle || '').trim();
          if (perCourseMap[t]) {
            const s = Math.round(Number(cd.studyMinutes) || 0);
            const d = Math.round(Number(cd.discussionMinutes) || 0);
            perCourseMap[t].study += s;
            perCourseMap[t].disc += d;
            perCourseMap[t].total += s + d;
          }
        });
      } else if ((metrics.coreStudyMinutes > 0 || metrics.coreDiscussionMinutes > 0) && enrolledCoreCourses.length > 0) {
        const cnt = enrolledCoreCourses.length;
        enrolledCoreCourses.forEach((c, idx) => {
          const s = Math.floor(metrics.coreStudyMinutes / cnt) + (idx === 0 ? metrics.coreStudyMinutes % cnt : 0);
          const d = Math.floor(metrics.coreDiscussionMinutes / cnt) + (idx === 0 ? metrics.coreDiscussionMinutes % cnt : 0);
          perCourseMap[c.title] = { study: s, disc: d, total: s + d };
        });
      }

      return {
        period: p,
        metrics,
        exempt,
        mandatoryMins,
        isMet: exempt || (mandatoryMins > 0 && metrics.totalMinutes >= mandatoryMins),
        perCourseMap
      };
    });
  }, [periods, studentLogs, student, enrolledCoreCourses]);

  const scopedDailyEntries = useMemo(() => {
    if (selectedScope === 'ALL') return dailyEntries;
    return dailyEntries.filter(d => String(d.periodId) === String(selectedScope));
  }, [dailyEntries, selectedScope]);

  if (!isOpen || !student) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[80] flex items-center justify-center p-3 sm:p-6 lg:p-10"
        dir="rtl"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-[32px] shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
        >
          {/* Top Header */}
          <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-amber-300 font-black text-xl shadow-inner shrink-0">
                {student.name?.charAt(0) || <User size={26} />}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="text-lg sm:text-xl font-black text-white">{student.name}</h3>
                  <span className="px-3 py-1 rounded-xl bg-indigo-500/30 border border-indigo-400/30 text-indigo-100 text-xs font-black">
                    {normalizeGradeLabel(student.grade) || 'نامشخص'}
                  </span>
                  {student.nationalId && (
                    <span className="px-2.5 py-1 rounded-xl bg-white/10 text-slate-200 text-[11px] font-bold">
                      کد ملی: {student.nationalId}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 font-medium mt-1.5 flex items-center gap-2 flex-wrap">
                  <span>پرونده تفصیلی کارکرد مطالعه و مباحثه به تفکیک کلاس‌های ثبت‌نام‌شده و مطالعه آزاد</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end md:self-auto">
              {/* Period Filter Select inside Modal */}
              <div className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-2xl px-3 py-2">
                <Calendar size={15} className="text-indigo-300 shrink-0" />
                <select
                  value={selectedScope}
                  onChange={e => setSelectedScope(e.target.value)}
                  className="bg-transparent text-white text-xs font-black outline-none cursor-pointer pr-1 pl-3"
                >
                  <option value="ALL" className="text-slate-900 font-black">
                    📊 تجمیع کل دوره‌ها ({periods.length.toLocaleString('fa-IR')} دوره)
                  </option>
                  {periods.map(p => (
                    <option key={p.id} value={p.id} className="text-slate-900 font-bold">
                      📅 {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-rose-500/80 text-white flex items-center justify-center transition-all cursor-pointer"
                title="بستن پنجره"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="p-5 sm:p-7 overflow-y-auto space-y-6 flex-1 bg-slate-50/60">
            {/* Enrolled Classes Strip */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Layers size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800">کلاس‌ها و دروس اصلی فعال طلبه</h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    تنها کلاس‌های فعال و حذف‌نشده‌ای که این طلبه عضو آن‌هاست در جدول زیر محاسبه می‌شوند
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {enrolledCoreCourses.length === 0 ? (
                  <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
                    عضو هیچ کلاس اصلی فعالی نیست
                  </span>
                ) : (
                  enrolledCoreCourses.map(c => (
                    <span
                      key={c.id}
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-black flex items-center gap-1.5"
                    >
                      <BookOpen size={13} className="text-indigo-600" />
                      <span>{c.title}</span>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* 4 Summary Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-500">مطالعه دروس اصلی</span>
                  <BookOpen size={16} className="text-indigo-600" />
                </div>
                <div className="text-lg sm:text-xl font-black text-indigo-700">
                  {courseBreakdownData.coreStudyTotal.toLocaleString('fa-IR')}{' '}
                  <span className="text-xs font-bold text-slate-500">دقیقه</span>
                </div>
                <div className="text-[11px] font-bold text-slate-400 mt-1">
                  معادل {formatMinutesToHoursAndMinutes(courseBreakdownData.coreStudyTotal)}
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-500">مباحثه دروس اصلی</span>
                  <MessageSquare size={16} className="text-emerald-600" />
                </div>
                <div className="text-lg sm:text-xl font-black text-emerald-700">
                  {courseBreakdownData.coreDiscussionTotal.toLocaleString('fa-IR')}{' '}
                  <span className="text-xs font-bold text-slate-500">دقیقه</span>
                </div>
                <div className="text-[11px] font-bold text-slate-400 mt-1">
                  معادل {formatMinutesToHoursAndMinutes(courseBreakdownData.coreDiscussionTotal)}
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-500">مطالعه آزاد (فوق برنامه)</span>
                  <Sparkles size={16} className="text-amber-600" />
                </div>
                <div className="text-lg sm:text-xl font-black text-amber-700">
                  {courseBreakdownData.freeStudyMinutes.toLocaleString('fa-IR')}{' '}
                  <span className="text-xs font-bold text-slate-500">دقیقه</span>
                </div>
                <div className="text-[11px] font-bold text-slate-400 mt-1">
                  معادل {formatMinutesToHoursAndMinutes(courseBreakdownData.freeStudyMinutes)}
                </div>
              </div>

              <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-4 rounded-2xl text-white shadow-md">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-indigo-200">مجموع کل کارکرد</span>
                  <Award size={16} className="text-amber-400" />
                </div>
                <div className="text-lg sm:text-xl font-black text-white">
                  {courseBreakdownData.grandTotal.toLocaleString('fa-IR')}{' '}
                  <span className="text-xs font-bold text-indigo-200">دقیقه</span>
                </div>
                <div className="text-[11px] font-bold text-emerald-300 mt-1">
                  معادل {formatMinutesToHoursAndMinutes(courseBreakdownData.grandTotal)}
                </div>
              </div>
            </div>

            {/* Table 1: Per-Course Study & Discussion Breakdown + Free Study */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <BookOpen size={18} className="text-indigo-600" />
                  <h4 className="text-sm font-black text-slate-800">
                    جدول تفکیک مطالعه و مباحثه به ازای هر درس و مطالعه آزاد (
                    {selectedPeriodObj ? selectedPeriodObj.title : 'تجمیع کل دوره‌ها'})
                  </h4>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  مجموع دروس اصلی: {courseBreakdownData.coreTotal.toLocaleString('fa-IR')} دقیقه | آزاد:{' '}
                  {courseBreakdownData.freeStudyMinutes.toLocaleString('fa-IR')} دقیقه
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-xs">
                      <th className="py-3.5 px-4 font-black w-12 text-center">ردیف</th>
                      <th className="py-3.5 px-4 font-black">عنوان درس / بخش مطالعاتی</th>
                      <th className="py-3.5 px-4 font-black text-center">نوع</th>
                      <th className="py-3.5 px-4 font-black text-center bg-indigo-950/60">میزان مطالعه</th>
                      <th className="py-3.5 px-4 font-black text-center bg-emerald-950/60">میزان مباحثه</th>
                      <th className="py-3.5 px-4 font-black text-center bg-slate-800">مجموع کارکرد</th>
                      <th className="py-3.5 px-4 font-black text-center w-44">سهم از کل کارکرد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {courseBreakdownData.rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400 font-bold">
                          هیچ درس اصلی فعالی برای این طلبه ثبت نشده است.
                        </td>
                      </tr>
                    ) : (
                      courseBreakdownData.rows.map((row, idx) => {
                        const sharePct =
                          courseBreakdownData.grandTotal > 0
                            ? Math.round((row.totalMinutes / courseBreakdownData.grandTotal) * 100)
                            : 0;
                        return (
                          <tr key={row.courseId + idx} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="py-3.5 px-4 text-center font-black text-slate-400">
                              {(idx + 1).toLocaleString('fa-IR')}
                            </td>
                            <td className="py-3.5 px-4 font-black text-slate-800">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                                <span>{row.courseTitle}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-[11px]">
                                درس اصلی ({row.subjectType})
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center bg-indigo-50/20">
                              <div className="font-black text-indigo-700 text-sm">
                                {row.studyMinutes.toLocaleString('fa-IR')} <span className="text-[10px]">دقیقه</span>
                              </div>
                              <div className="text-[10px] font-bold text-slate-400">
                                {formatMinutesToHoursAndMinutes(row.studyMinutes)}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center bg-emerald-50/20">
                              <div className="font-black text-emerald-700 text-sm">
                                {row.discussionMinutes.toLocaleString('fa-IR')} <span className="text-[10px]">دقیقه</span>
                              </div>
                              <div className="text-[10px] font-bold text-slate-400">
                                {formatMinutesToHoursAndMinutes(row.discussionMinutes)}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center bg-slate-50/80">
                              <div className="font-black text-slate-900 text-sm">
                                {row.totalMinutes.toLocaleString('fa-IR')} <span className="text-[10px]">دقیقه</span>
                              </div>
                              <div className="text-[10px] font-bold text-slate-500">
                                {formatMinutesToHoursAndMinutes(row.totalMinutes)}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-indigo-600 rounded-full"
                                    style={{ width: `${Math.min(100, sharePct)}%` }}
                                  />
                                </div>
                                <span className="font-black text-slate-700 w-9 text-left">
                                  {sharePct.toLocaleString('fa-IR')}٪
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}

                    {/* Free Study Dedicated Row */}
                    <tr className="bg-amber-50/40 hover:bg-amber-50/70 transition-colors border-t-2 border-amber-200/70">
                      <td className="py-3.5 px-4 text-center font-black text-amber-600">★</td>
                      <td className="py-3.5 px-4 font-black text-amber-900">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <Sparkles size={15} className="text-amber-600 shrink-0" />
                            <span>مطالعه آزاد (فوق برنامه و کتابخوانی)</span>
                          </div>
                          {courseBreakdownData.freeStudyBooks.length > 0 && (
                            <span className="text-[11px] font-bold text-amber-700 pr-5">
                              کتب ثبت‌شده: {courseBreakdownData.freeStudyBooks.join(' ، ')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 font-bold text-[11px]">
                          مطالعه آزاد
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="font-black text-amber-800 text-sm">
                          {courseBreakdownData.freeStudyMinutes.toLocaleString('fa-IR')}{' '}
                          <span className="text-[10px]">دقیقه</span>
                        </div>
                        <div className="text-[10px] font-bold text-amber-600">
                          {formatMinutesToHoursAndMinutes(courseBreakdownData.freeStudyMinutes)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-400 font-bold">---</td>
                      <td className="py-3.5 px-4 text-center bg-amber-100/40">
                        <div className="font-black text-amber-900 text-sm">
                          {courseBreakdownData.freeStudyMinutes.toLocaleString('fa-IR')}{' '}
                          <span className="text-[10px]">دقیقه</span>
                        </div>
                        <div className="text-[10px] font-bold text-amber-700">
                          {formatMinutesToHoursAndMinutes(courseBreakdownData.freeStudyMinutes)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {(() => {
                          const freeShare =
                            courseBreakdownData.grandTotal > 0
                              ? Math.round((courseBreakdownData.freeStudyMinutes / courseBreakdownData.grandTotal) * 100)
                              : 0;
                          return (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-amber-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-amber-500 rounded-full"
                                  style={{ width: `${Math.min(100, freeShare)}%` }}
                                />
                              </div>
                              <span className="font-black text-amber-800 w-9 text-left">
                                {freeShare.toLocaleString('fa-IR')}٪
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-black text-xs">
                      <td colSpan={3} className="py-3.5 px-4 text-left">
                        جمع کل کارکرد طلبه (دروس اصلی + مطالعه آزاد):
                      </td>
                      <td className="py-3.5 px-4 text-center text-indigo-200">
                        {(courseBreakdownData.coreStudyTotal + courseBreakdownData.freeStudyMinutes).toLocaleString('fa-IR')} د
                      </td>
                      <td className="py-3.5 px-4 text-center text-emerald-200">
                        {courseBreakdownData.coreDiscussionTotal.toLocaleString('fa-IR')} د
                      </td>
                      <td className="py-3.5 px-4 text-center text-amber-300 text-sm">
                        {courseBreakdownData.grandTotal.toLocaleString('fa-IR')} دقیقه
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-300">
                        {formatMinutesToHoursAndMinutes(courseBreakdownData.grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Table 2: Comparison Across All Periods for This Student */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <TrendingUp size={18} className="text-emerald-600" />
                  <h4 className="text-sm font-black text-slate-800">
                    روند کارکرد طلبه در تمامی دوره‌های مطالعاتی به تفکیک هر درس و مطالعه آزاد
                  </h4>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  {periods.length.toLocaleString('fa-IR')} دوره ثبت‌شده
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-white text-[11px]">
                      <th className="py-3 px-3.5 font-black">عنوان دوره</th>
                      {enrolledCoreCourses.map(c => (
                        <th key={c.id} className="py-3 px-3 font-black text-center bg-indigo-950/50">
                          <div>{c.title}</div>
                          <div className="text-[9px] text-indigo-200 font-normal mt-0.5">(مطالعه + مباحثه)</div>
                        </th>
                      ))}
                      <th className="py-3 px-3 font-black text-center">مجموع دروس اصلی</th>
                      <th className="py-3 px-3 font-black text-center bg-amber-950/40">مطالعه آزاد</th>
                      <th className="py-3 px-3.5 font-black text-center bg-slate-900">کل کارکرد دوره</th>
                      <th className="py-3 px-3.5 font-black text-center">وضعیت نسبت به موظفی</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {periodByPeriodRows.map(({ period, metrics, exempt, mandatoryMins, isMet, perCourseMap }) => (
                      <tr
                        key={period.id}
                        onClick={() => setSelectedScope(period.id)}
                        className={cn(
                          'hover:bg-indigo-50/40 transition-colors cursor-pointer',
                          selectedScope === period.id && 'bg-indigo-50/60'
                        )}
                      >
                        <td className="py-3 px-3.5 font-black text-slate-800">{period.title}</td>
                        {enrolledCoreCourses.map(c => {
                          const cell = perCourseMap[c.title] || { study: 0, disc: 0, total: 0 };
                          return (
                            <td key={c.id} className="py-3 px-3 text-center bg-indigo-50/15">
                              <div className="font-black text-slate-800">
                                {cell.total.toLocaleString('fa-IR')} <span className="text-[10px] text-slate-400">د</span>
                              </div>
                              <div className="text-[10px] font-bold text-slate-500">
                                م: {cell.study.toLocaleString('fa-IR')} | مب: {cell.disc.toLocaleString('fa-IR')}
                              </div>
                            </td>
                          );
                        })}
                        <td className="py-3 px-3 text-center font-black text-indigo-700">
                          {metrics.coreTotalMinutes.toLocaleString('fa-IR')} د
                        </td>
                        <td className="py-3 px-3 text-center font-black text-amber-700 bg-amber-50/20">
                          {metrics.freeStudyMinutes.toLocaleString('fa-IR')} د
                        </td>
                        <td className="py-3 px-3.5 text-center font-black text-slate-900 bg-slate-50">
                          {metrics.totalMinutes.toLocaleString('fa-IR')} دقیقه
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          {exempt ? (
                            <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-[11px] font-black">
                              معاف از موظفی
                            </span>
                          ) : isMet ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-black">
                              <CheckCircle2 size={13} />
                              <span>کامل ({mandatoryMins.toLocaleString('fa-IR')} د)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 text-[11px] font-black">
                              <AlertTriangle size={13} />
                              <span>
                                کسری {(mandatoryMins - metrics.totalMinutes).toLocaleString('fa-IR')} د
                              </span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 3: Granular Daily Logs if any */}
            {scopedDailyEntries.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <FileText size={18} className="text-indigo-600" />
                    <h4 className="text-sm font-black text-slate-800">ریز ثبت‌های روزانه طلبه</h4>
                  </div>
                  <span className="text-xs font-bold text-slate-500">
                    {scopedDailyEntries.length.toLocaleString('fa-IR')} نوبت ثبت روزانه
                  </span>
                </div>
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 text-[11px]">
                        <th className="py-2.5 px-4 font-black">تاریخ ثبت</th>
                        <th className="py-2.5 px-4 font-black">جزئیات دروس ثبت‌شده</th>
                        <th className="py-2.5 px-4 font-black text-center">مطالعه آزاد</th>
                        <th className="py-2.5 px-4 font-black text-center">مجموع نوبت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {scopedDailyEntries.map(entry => {
                        const coreSum = (entry.coursesBreakdown || []).reduce(
                          (acc, c) => acc + (Number(c.studyMinutes) || 0) + (Number(c.discussionMinutes) || 0),
                          0
                        );
                        const freeMin = Number(entry.freeStudyMinutes) || 0;
                        const totalEntry = coreSum + freeMin || Number(entry.studyMinutes || 0) + Number(entry.discussionMinutes || 0);
                        return (
                          <tr key={entry.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 font-black text-slate-700">{entry.entryDate}</td>
                            <td className="py-2.5 px-4">
                              <div className="flex flex-wrap gap-1.5">
                                {(entry.coursesBreakdown || []).map((c, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 font-bold text-[11px]"
                                  >
                                    {c.courseTitle}: م {(c.studyMinutes || 0).toLocaleString('fa-IR')} / مب{' '}
                                    {(c.discussionMinutes || 0).toLocaleString('fa-IR')} د
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-center font-bold text-amber-700">
                              {freeMin > 0
                                ? `${freeMin.toLocaleString('fa-IR')} د ${entry.freeStudyBookTitle ? `(${entry.freeStudyBookTitle})` : ''}`
                                : '---'}
                            </td>
                            <td className="py-2.5 px-4 text-center font-black text-slate-900">
                              {totalEntry.toLocaleString('fa-IR')} دقیقه
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 sm:p-5 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <Clock size={15} className="text-indigo-500" />
              <span>با کلیک روی هر ردیف از جدول دوره‌ها می‌توانید جزئیات همان دوره را مشاهده کنید.</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition-all cursor-pointer"
            >
              بستن پنجره
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
