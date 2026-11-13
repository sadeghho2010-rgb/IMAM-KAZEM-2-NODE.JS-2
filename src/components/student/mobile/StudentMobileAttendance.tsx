import React, { useState, useEffect, useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  BookOpen,
  Info,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { localDb } from '../../../lib/localDb';
import { useAuth } from '../../../context/AuthContext';
import { Program, AttendanceSessionLog, Student } from '../../../types';
import { StudentSelfReportingModal } from '../../attendance/StudentSelfReportingModal';
import { AnimatedRingGauge } from './AnimatedRingGauge';
import { GlyphAttendanceCheck, GlyphSelfReportSpark } from './StudentMobileIcons';
import {
  isProgramActiveAndValid,
  isStudentEnrolledInProgram,
  buildStudentCandidateIds,
} from '../../study/studyUtils';

interface StudentMobileAttendanceProps {
  onNavigateTab?: (tab: string, studentId?: string) => void;
}

export const StudentMobileAttendance: React.FC<StudentMobileAttendanceProps> = () => {
  const { currentUser } = useAuth();
  const prefersReducedMotion = useReducedMotion();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceSessionLog[]>([]);
  const [studentObj, setStudentObj] = useState<Student | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'absent' | 'late' | 'excused'>('all');
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<string>('all');
  const [isSelfReportingModalOpen, setIsSelfReportingModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const initialLoadDoneRef = React.useRef(false);

  useEffect(() => {
    loadData(true);

    const handleUpdate = () => loadData(false);
    const unsub = localDb.subscribe(handleUpdate);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'programs_updated_at') loadData(false);
    };

    window.addEventListener('app_data_change', handleUpdate);
    window.addEventListener('attendance_updated', handleUpdate);
    window.addEventListener('collection_change_programs', handleUpdate);
    window.addEventListener('collection_change_enrollments', handleUpdate);
    window.addEventListener('storage', handleStorage);

    return () => {
      unsub();
      window.removeEventListener('app_data_change', handleUpdate);
      window.removeEventListener('attendance_updated', handleUpdate);
      window.removeEventListener('collection_change_programs', handleUpdate);
      window.removeEventListener('collection_change_enrollments', handleUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, [currentUser]);

  const loadData = async (isInitial = false) => {
    try {
      if (isInitial && !initialLoadDoneRef.current) {
        setIsLoading(true);
      }
      const [allProgs, allRecords, allStudents, allEnrollments, legacyEnrolls] = await Promise.all([
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<AttendanceSessionLog>('attendance'),
        localDb.getDocs<Student>('students'),
        localDb.getDocs<any>('course_enrollments'),
        localDb.getDocs<any>('enrollments'),
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

      setPrograms(allProgs || []);
      setEnrollments([...(allEnrollments || []), ...(legacyEnrolls || [])]);
      setAttendanceRecords(allRecords || []);
    } catch (err) {
      console.warn('Error loading student attendance:', err);
    } finally {
      initialLoadDoneRef.current = true;
      setIsLoading(false);
    }
  };

  const studentIdentifiers = useMemo(() => {
    const list: string[] = [];
    if (studentObj?.id) list.push(String(studentObj.id));
    if (studentObj?.nationalId) list.push(studentObj.nationalId);
    if (studentObj?.studentCode) list.push(studentObj.studentCode);
    if (currentUser?.id) list.push(String(currentUser.id));
    if (currentUser?.studentId) list.push(String(currentUser.studentId));
    if (currentUser?.username) list.push(currentUser.username);
    return Array.from(new Set(list));
  }, [studentObj, currentUser]);

  const studentGrade = studentObj?.grade || currentUser?.gradeLabel || 'پایه ۷';

  const enrolledPrograms = useMemo(() => {
    const idSet = buildStudentCandidateIds(studentObj, studentIdentifiers.map(String));
    return programs.filter(
      (p) => isProgramActiveAndValid(p) && isStudentEnrolledInProgram(p, studentObj, enrollments, idSet)
    );
  }, [programs, studentIdentifiers, enrollments, studentObj]);

  const enrolledProgramIdSet = useMemo(() => {
    return new Set(enrolledPrograms.map((p) => String(p.id)));
  }, [enrolledPrograms]);

  const selfReportingCourses = useMemo(() => {
    return enrolledPrograms.filter((p) => p.attendanceType === 'self_reporting');
  }, [enrolledPrograms]);

  const studentEvents = useMemo(() => {
    const events: Array<{
      id: string;
      date: string;
      dayOfWeek: string;
      programTitle: string;
      programId: string;
      status: 'present' | 'absent' | 'late' | 'excused' | 'unspecified';
      lateMinutes?: number;
      excuseReason?: string;
      notes?: string;
    }> = [];

    const idSetLower = new Set(studentIdentifiers.map((x) => String(x).toLowerCase().trim()));

    attendanceRecords.forEach((rec) => {
      if (rec.programId && !enrolledProgramIdSet.has(String(rec.programId))) return;
      const detail = rec.students?.find(
        (st) =>
          idSetLower.has(String(st.studentId).toLowerCase().trim()) ||
          (studentObj?.name && st.studentName?.toLowerCase().includes(studentObj.name.toLowerCase()))
      );

      if (detail) {
        let finalStatus: 'present' | 'absent' | 'late' | 'excused' | 'unspecified' = 'present';
        if (detail.status === 'absent') {
          finalStatus = detail.isExcused ? 'excused' : 'absent';
        } else if (detail.status === 'late') {
          finalStatus = 'late';
        } else if (detail.status === 'present') {
          finalStatus = 'present';
        } else {
          finalStatus = 'unspecified';
        }

        events.push({
          id: `${rec.id}_${detail.studentId}`,
          date: rec.date,
          dayOfWeek: rec.dayOfWeek || '',
          programTitle: rec.programTitle || 'درس حوزوی',
          programId: rec.programId,
          status: finalStatus,
          lateMinutes: detail.lateMinutes,
          excuseReason: detail.excuseReason,
          notes: rec.notes,
        });
      }
    });

    return events.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [attendanceRecords, studentIdentifiers, studentObj, enrolledProgramIdSet]);

  const metrics = useMemo(() => {
    let present = 0;
    let absent = 0;
    let excused = 0;
    let late = 0;
    studentEvents.forEach((e) => {
      if (e.status === 'present') present++;
      else if (e.status === 'absent') absent++;
      else if (e.status === 'excused') excused++;
      else if (e.status === 'late') late++;
    });
    return {
      total: studentEvents.length,
      present,
      absent,
      excused,
      late,
      attendanceRate: studentEvents.length > 0 ? Math.round(((present + late) / studentEvents.length) * 100) : 100,
    };
  }, [studentEvents]);

  const filteredEvents = useMemo(() => {
    return studentEvents.filter((e) => {
      if (selectedProgramFilter !== 'all' && e.programId !== selectedProgramFilter) return false;
      if (selectedFilter === 'absent') return e.status === 'absent';
      if (selectedFilter === 'late') return e.status === 'late';
      if (selectedFilter === 'excused') return e.status === 'excused';
      return true;
    });
  }, [studentEvents, selectedFilter, selectedProgramFilter]);

  const courseSummaries = useMemo(() => {
    return enrolledPrograms.map((p) => {
      const courseEvents = studentEvents.filter((e) => e.programId === p.id);
      const abs = courseEvents.filter((e) => e.status === 'absent').length;
      const exc = courseEvents.filter((e) => e.status === 'excused').length;
      const pres = courseEvents.filter((e) => e.status === 'present').length;
      const lt = courseEvents.filter((e) => e.status === 'late').length;
      return {
        id: p.id,
        title: p.title,
        teacher: p.teacher || 'استاد تعیین‌نشده',
        madrasRoom: p.madrasRoom,
        total: courseEvents.length,
        absent: abs,
        excused: exc,
        present: pres,
        late: lt,
        hasWarning: abs >= 3,
      };
    });
  }, [enrolledPrograms, studentEvents]);

  const filterTabs: Array<{ id: 'all' | 'absent' | 'late' | 'excused'; label: string }> = [
    { id: 'all', label: `همه (${metrics.total})` },
    { id: 'absent', label: `غیبت (${metrics.absent})` },
    { id: 'late', label: `تاخیر (${metrics.late})` },
    { id: 'excused', label: `موجه (${metrics.excused})` },
  ];

  if (isLoading) {
    return (
      <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center font-vazir shadow-2xs" dir="rtl">
        <div className="w-9 h-9 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold text-slate-600">در حال بارگذاری کارنامه حضور و غیاب...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 font-vazir text-right" dir="rtl">
      {/* 1. Luminous Attendance Overview Hero Card */}
      <div className="relative overflow-hidden p-4 rounded-[26px] bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white shadow-[0_14px_34px_-12px_rgba(30,27,75,0.55)] border border-indigo-400/25 space-y-3">
        <div
          className="pointer-events-none absolute -top-14 -left-10 w-40 h-40 rounded-full opacity-35 student-microwave-ripple"
          style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.45) 0%, transparent 70%)' }}
          aria-hidden="true"
        />
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/10 text-emerald-300 flex items-center justify-center border border-white/20 shrink-0">
              <GlyphAttendanceCheck size={20} active />
            </div>
            <AnimatedRingGauge
              percentage={metrics.attendanceRate}
              size={58}
              strokeWidth={5.5}
              progressClassName={metrics.attendanceRate >= 85 ? 'text-emerald-400' : 'text-amber-400'}
              label={studentGrade}
              valueText="نرخ حضور در کلاس‌ها"
              subText={`${metrics.total} جلسه ثبت‌شده`}
            />
          </div>
          <div className="text-left shrink-0">
            <div className="text-xs font-black text-white">{studentObj?.name || currentUser?.name || 'طلبه گرامی'}</div>
            <div className="text-[10px] text-emerald-300 font-bold mt-0.5 tabular-nums">
              {metrics.present} حاضر · {metrics.absent} غیبت
            </div>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-4 gap-2 pt-3 border-t border-white/10 text-center">
          <div className="p-2 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-sm font-black text-white font-mono tabular-nums">{metrics.total}</div>
            <div className="text-[9.5px] text-slate-300 font-medium">جلسات</div>
          </div>
          <div className="p-2 rounded-2xl bg-emerald-500/15 border border-emerald-400/20">
            <div className="text-sm font-black text-emerald-300 font-mono tabular-nums">{metrics.present}</div>
            <div className="text-[9.5px] text-emerald-200 font-medium">حاضر</div>
          </div>
          <div className="p-2 rounded-2xl bg-rose-500/15 border border-rose-400/20">
            <div className="text-sm font-black text-rose-300 font-mono tabular-nums">{metrics.absent}</div>
            <div className="text-[9.5px] text-rose-200 font-medium">غیبت</div>
          </div>
          <div className="p-2 rounded-2xl bg-amber-500/15 border border-amber-400/20">
            <div className="text-sm font-black text-amber-300 font-mono tabular-nums">{metrics.late}</div>
            <div className="text-[9.5px] text-amber-200 font-medium">تاخیر</div>
          </div>
        </div>
      </div>

      {/* Self-Reporting CTA */}
      {selfReportingCourses.length > 0 && (
        <motion.div
          whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
          className="relative overflow-hidden student-card-wave-selfreport rounded-[22px] p-3.5 text-white shadow-md flex items-center justify-between gap-3 border border-teal-300/35"
        >
          {!prefersReducedMotion && (
            <div className="student-electric-beam student-electric-beam-delay-1" aria-hidden="true" />
          )}
          <div className="relative z-10 flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 border border-white/25">
              <GlyphSelfReportSpark size={20} className="text-teal-100" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-black block truncate">ثبت خوداظهاری حضور و غیاب</span>
              <span className="text-[10.5px] text-emerald-100 truncate block tabular-nums">
                {selfReportingCourses.length} درس دارای خوداظهاری فعال
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSelfReportingModalOpen(true)}
            className="relative z-10 min-h-[44px] px-3.5 py-2 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <span>ثبت فوری</span>
          </button>
        </motion.div>
      )}

      {/* 2. Course-by-Course Breakdown */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <BookOpen size={15} className="text-indigo-600" />
            <span>وضعیت به تفکیک دروس</span>
          </h3>
          {selectedProgramFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedProgramFilter('all')}
              className="text-[10.5px] font-black text-indigo-600 cursor-pointer"
            >
              نمایش همه دروس
            </button>
          )}
        </div>

        {courseSummaries.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
            درسی برای نمایش یافت نشد.
          </div>
        ) : (
          <div className="space-y-2">
            {courseSummaries.map((c) => {
              const courseRate = c.total > 0 ? Math.round(((c.present + c.late) / c.total) * 100) : 100;
              const isSelectedCourse = selectedProgramFilter === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedProgramFilter(isSelectedCourse ? 'all' : c.id)}
                  className={cn(
                    'w-full text-right p-3 rounded-2xl border transition-all text-xs space-y-2 cursor-pointer',
                    isSelectedCourse
                      ? 'bg-indigo-50/60 border-indigo-300 shadow-2xs'
                      : c.hasWarning
                        ? 'bg-rose-50/50 border-rose-200'
                        : 'bg-slate-50/70 border-slate-200/80 hover:border-indigo-200'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-black text-slate-900 truncate block">{c.title}</span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        استاد: {c.teacher} {c.madrasRoom ? `· مَدرَس ${c.madrasRoom}` : ''}
                      </span>
                    </div>
                    {c.hasWarning && (
                      <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 text-[9.5px] font-black border border-rose-300 shrink-0">
                        مرز اخطار
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[10px]">
                    <div className="flex-1 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', c.hasWarning ? 'bg-rose-500' : 'bg-emerald-500')}
                        style={{ width: `${courseRate}%` }}
                      />
                    </div>
                    <span className="font-mono font-bold text-slate-700 shrink-0 tabular-nums">{courseRate}٪</span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium tabular-nums">
                    <span className="text-emerald-700 font-bold">{c.present} حاضر</span>
                    <span className="text-slate-300">·</span>
                    <span className={cn(c.absent > 0 ? 'text-rose-700 font-bold' : '')}>{c.absent} غیبت غیرموجه</span>
                    {c.excused > 0 && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="text-sky-700 font-bold">{c.excused} موجه</span>
                      </>
                    )}
                    {c.late > 0 && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="text-amber-700 font-bold">{c.late} تاخیر</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Session Records History */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <Clock size={15} className="text-indigo-600" />
            <span>ریز جلسات ثبت‌شده ({filteredEvents.length})</span>
          </h3>
        </div>

        {/* Segmented Filter Tabs */}
        <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-2xl">
          {filterTabs.map((ft) => {
            const isActive = selectedFilter === ft.id;
            return (
              <button
                key={ft.id}
                type="button"
                onClick={() => setSelectedFilter(ft.id)}
                className={cn(
                  'relative min-h-[38px] px-1 rounded-xl text-[10px] font-black transition-colors cursor-pointer truncate',
                  isActive ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId={prefersReducedMotion ? undefined : 'attendanceFilterPill'}
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    className={cn(
                      'absolute inset-0 rounded-xl shadow-2xs',
                      ft.id === 'absent'
                        ? 'bg-rose-600'
                        : ft.id === 'late'
                          ? 'bg-amber-500'
                          : ft.id === 'excused'
                            ? 'bg-sky-600'
                            : 'bg-indigo-600'
                    )}
                  />
                )}
                <span className="relative z-10 tabular-nums">{ft.label}</span>
              </button>
            );
          })}
        </div>

        {filteredEvents.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-slate-100">
            هیچ جلسه‌ای با این فیلتر ثبت نشده است.
          </div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-0.5">
            {filteredEvents.map((ev) => {
              const isPresent = ev.status === 'present';
              const isAbsent = ev.status === 'absent';
              const isLate = ev.status === 'late';
              const isExcused = ev.status === 'excused';

              return (
                <div
                  key={ev.id}
                  className={cn(
                    'p-3 rounded-2xl border flex items-center justify-between gap-2.5',
                    isPresent && 'bg-white border-slate-200/80',
                    isAbsent && 'bg-rose-50/60 border-rose-200 text-rose-950',
                    isLate && 'bg-amber-50/60 border-amber-200 text-amber-950',
                    isExcused && 'bg-sky-50/60 border-sky-200 text-sky-950'
                  )}
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-xs font-black text-slate-900 truncate">{ev.programTitle}</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium font-mono tabular-nums flex-wrap">
                      <span>{ev.dayOfWeek}</span>
                      <span className="text-slate-300">·</span>
                      <span>{ev.date}</span>
                      {ev.lateMinutes ? (
                        <span className="text-amber-700 font-bold font-sans">({ev.lateMinutes} دقیقه تاخیر)</span>
                      ) : null}
                      {ev.excuseReason ? (
                        <span className="text-sky-700 font-sans truncate">({ev.excuseReason})</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isPresent && (
                      <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        <span>حاضر</span>
                      </span>
                    )}
                    {isAbsent && (
                      <span className="px-2.5 py-1 rounded-xl bg-rose-100 text-rose-800 text-[10px] font-black border border-rose-200 flex items-center gap-1">
                        <XCircle size={12} />
                        <span>غیبت</span>
                      </span>
                    )}
                    {isLate && (
                      <span className="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-800 text-[10px] font-black border border-amber-200 flex items-center gap-1">
                        <Clock size={12} />
                        <span>تاخیر</span>
                      </span>
                    )}
                    {isExcused && (
                      <span className="px-2.5 py-1 rounded-xl bg-sky-100 text-sky-800 text-[10px] font-black border border-sky-200 flex items-center gap-1">
                        <Info size={12} />
                        <span>موجه</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Self-Reporting Modal */}
      <StudentSelfReportingModal
        isOpen={isSelfReportingModalOpen}
        onClose={() => setIsSelfReportingModalOpen(false)}
        currentUser={currentUser}
        studentObj={studentObj}
        programs={programs}
        enrollments={enrollments}
        onAttendanceSaved={() => loadData(false)}
      />
    </div>
  );
};
