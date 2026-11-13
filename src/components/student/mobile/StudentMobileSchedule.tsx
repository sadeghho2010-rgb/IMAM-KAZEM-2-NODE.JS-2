import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Clock, User, DoorOpen, BookOpen } from 'lucide-react';
import { cn, getProgramDays } from '../../../lib/utils';
import { localDb } from '../../../lib/localDb';
import { useAuth } from '../../../context/AuthContext';
import { Program, Student, Enrollment } from '../../../types';
import { getTodayShamsi, getShamsiDayOfWeekName, toEnglishDigits } from '../../../lib/jalali';
import { GlyphScheduleGrid } from './StudentMobileIcons';
import {
  isProgramActiveAndValid,
  isStudentEnrolledInProgram,
  buildStudentCandidateIds,
} from '../../study/studyUtils';

interface StudentMobileScheduleProps {
  onNavigateTab?: (tab: string, studentId?: string) => void;
}

const SEMINARY_DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه'] as const;

function parseTimeStart(timeStr?: string): { start: number; end: number } | null {
  if (!timeStr) return null;
  const eng = toEnglishDigits(timeStr);
  const matches = eng.match(/\d{1,2}[:：]\d{1,2}/g);
  if (!matches || matches.length === 0) return null;
  const toMin = (t: string) => {
    const [hStr, mStr] = t.replace('：', ':').split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
  };
  const s = toMin(matches[0]);
  if (s === null) return null;
  const e = matches.length > 1 ? toMin(matches[1]) ?? s + 60 : s + 60;
  return { start: s, end: e };
}

export const StudentMobileSchedule: React.FC<StudentMobileScheduleProps> = () => {
  const { currentUser } = useAuth();
  const prefersReducedMotion = useReducedMotion();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [studentObj, setStudentObj] = useState<Student | null>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const initialLoadDoneRef = React.useRef(false);

  const todayShamsi = useMemo(() => getTodayShamsi(), []);
  const todayDayName = useMemo(() => getShamsiDayOfWeekName(todayShamsi), [todayShamsi]);

  const [selectedDay, setSelectedDay] = useState<string>(() => {
    return (SEMINARY_DAYS as readonly string[]).includes(todayDayName) ? todayDayName : 'شنبه';
  });

  useEffect(() => {
    loadData(true);

    const handleSync = () => loadData(false);
    const unsub = localDb.subscribe(handleSync);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'programs_updated_at') loadData(false);
    };

    window.addEventListener('collection_change_programs', handleSync);
    window.addEventListener('collection_change_enrollments', handleSync);
    window.addEventListener('app_data_change', handleSync);
    window.addEventListener('storage', handleStorage);

    return () => {
      unsub();
      window.removeEventListener('collection_change_programs', handleSync);
      window.removeEventListener('collection_change_enrollments', handleSync);
      window.removeEventListener('app_data_change', handleSync);
      window.removeEventListener('storage', handleStorage);
    };
  }, [currentUser]);

  const loadData = async (isInitial = false) => {
    try {
      if (isInitial && !initialLoadDoneRef.current) {
        setIsLoading(true);
      }

      const [allProgs, allStudents, courseEnrolls, legacyEnrolls] = await Promise.all([
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<Student>('students'),
        localDb.getDocs<any>('course_enrollments'),
        localDb.getDocs<Enrollment>('enrollments'),
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
      setEnrollments([...(courseEnrolls || []), ...(legacyEnrolls || [])]);
    } catch (err) {
      console.warn('Error loading schedule:', err);
    } finally {
      initialLoadDoneRef.current = true;
      setIsLoading(false);
    }
  };

  const studentGrade = studentObj?.grade || currentUser?.gradeLabel || 'پایه ۷';

  // Strictly active & enrolled courses
  const enrolledPrograms = useMemo(() => {
    const idSet = buildStudentCandidateIds(
      studentObj,
      [currentUser?.id, currentUser?.studentId, currentUser?.linkedStudentId, currentUser?.username].filter(
        Boolean
      ) as string[]
    );
    return programs.filter(
      (p) => isProgramActiveAndValid(p) && isStudentEnrolledInProgram(p, studentObj, enrollments, idSet)
    );
  }, [programs, enrollments, studentObj, currentUser]);

  // Group programs by normalized seminary day
  const scheduleByDay = useMemo(() => {
    const map: Record<string, Program[]> = {
      شنبه: [],
      یکشنبه: [],
      دوشنبه: [],
      سه‌شنبه: [],
      چهارشنبه: [],
      'پنج‌شنبه': [],
    };
    const norm = (s: string) => s.replace(/[\u200c\s]/g, '').trim();

    enrolledPrograms.forEach((p) => {
      const pDays = getProgramDays(p);
      SEMINARY_DAYS.forEach((dayKey) => {
        if (pDays.some((pd) => norm(pd) === norm(dayKey))) {
          map[dayKey].push(p);
        }
      });
    });

    SEMINARY_DAYS.forEach((d) => {
      map[d].sort((a, b) => {
        const rA = parseTimeStart(a.time);
        const rB = parseTimeStart(b.time);
        return (rA?.start ?? 9999) - (rB?.start ?? 9999);
      });
    });

    return map;
  }, [enrolledPrograms]);

  const currentDayClasses = scheduleByDay[selectedDay] || [];
  const nowMinutes = useMemo(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }, [selectedDay, currentDayClasses]);

  if (isLoading) {
    return (
      <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center font-vazir shadow-2xs" dir="rtl">
        <div className="w-9 h-9 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold text-slate-600">در حال بارگذاری برنامه کلاسی...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 font-vazir text-right" dir="rtl">
      {/* 1. Luminous Week Overview Hero Card */}
      <div className="relative overflow-hidden p-4 rounded-[26px] bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white shadow-[0_14px_34px_-12px_rgba(30,27,75,0.55)] border border-indigo-400/25">
        <div
          className="pointer-events-none absolute -top-14 -left-10 w-40 h-40 rounded-full opacity-35 student-microwave-ripple"
          style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.45) 0%, transparent 70%)' }}
          aria-hidden="true"
        />
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/10 text-sky-300 flex items-center justify-center border border-white/20 shrink-0">
              <GlyphScheduleGrid size={20} active />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-white truncate">برنامه کلاسی هفتگی</h2>
              <p className="text-[10.5px] text-indigo-200/85 font-medium truncate">
                {studentGrade} · {enrolledPrograms.length} درس فعال ثبت‌شده
              </p>
            </div>
          </div>
          <span className="text-[10.5px] font-black px-2.5 py-1 rounded-xl bg-sky-500/20 text-sky-200 border border-sky-400/30 shrink-0">
            امروز: {todayDayName}
          </span>
        </div>
      </div>

      {/* 2. Interactive 6-Day Selector with Layout Indicator */}
      <div className="bg-white rounded-2xl p-1.5 border border-slate-200/90 shadow-2xs">
        <div className="grid grid-cols-6 gap-1">
          {SEMINARY_DAYS.map((day) => {
            const isToday = day === todayDayName;
            const isSelected = day === selectedDay;
            const classCount = (scheduleByDay[day] || []).length;

            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={cn(
                  'relative min-h-[50px] py-1.5 px-1 rounded-xl text-center transition-colors cursor-pointer flex flex-col items-center justify-center',
                  isSelected ? 'text-white' : isToday ? 'text-indigo-800 bg-indigo-50/70' : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                {isSelected && (
                  <motion.div
                    layoutId={prefersReducedMotion ? undefined : 'scheduleDayPill'}
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-indigo-600 shadow-xs"
                  />
                )}
                {isToday && !isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 absolute top-1 right-1" />
                )}
                <span className="relative z-10 text-[10.5px] font-black truncate w-full">{day}</span>
                <span
                  className={cn(
                    'relative z-10 text-[9.5px] tabular-nums mt-0.5',
                    isSelected ? 'text-indigo-100 font-bold' : 'text-slate-400 font-medium'
                  )}
                >
                  {classCount} کلاس
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Day Class Timeline */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <Clock size={15} className="text-indigo-600" />
            <span>کلاس‌های روز {selectedDay}</span>
          </h3>
          <span className="text-[10.5px] font-bold text-slate-500 tabular-nums">
            {currentDayClasses.length} کلاس
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={selectedDay}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
          >
            {currentDayClasses.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-slate-100">
                در روز «{selectedDay}» کلاسی برای شما تعریف نشده است.
              </div>
            ) : (
              <div className="space-y-2.5">
                {currentDayClasses.map((p, idx) => {
                  const range = parseTimeStart(p.time);
                  const isTodaySelected = selectedDay === todayDayName;
                  const isLive = isTodaySelected && range ? nowMinutes >= range.start && nowMinutes <= range.end : false;
                  const isPassed = isTodaySelected && range ? nowMinutes > range.end : false;

                  return (
                    <div
                      key={p.id || idx}
                      className={cn(
                        'p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3',
                        isLive
                          ? 'bg-indigo-50/70 border-indigo-300 shadow-2xs'
                          : isPassed
                            ? 'bg-slate-50/50 border-slate-200/70 opacity-75'
                            : 'bg-slate-50/80 border-slate-200/90'
                      )}
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-slate-900">{p.title}</span>
                          {isLive && (
                            <span className="text-[9.5px] px-2 py-0.5 rounded-md bg-indigo-600 text-white font-black">
                              در حال برگزاری
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[10.5px] text-slate-600 font-medium flex-wrap">
                          <span className="flex items-center gap-1">
                            <User size={12} className="text-slate-400 shrink-0" />
                            <span>استاد: {p.teacher || 'تعیین‌نشده'}</span>
                          </span>
                          {p.madrasRoom && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="flex items-center gap-1 text-indigo-700 font-bold">
                                <DoorOpen size={12} className="shrink-0" />
                                <span>مَدرَس {p.madrasRoom}</span>
                              </span>
                            </>
                          )}
                          {p.subjectBook && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="flex items-center gap-1 text-slate-500">
                                <BookOpen size={11} className="shrink-0" />
                                <span>{p.subjectBook}</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        <span className="inline-block px-2.5 py-1 rounded-xl bg-white border border-indigo-200 text-indigo-700 font-mono font-black text-[11px] tabular-nums shadow-2xs">
                          {p.time || 'نامشخص'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
