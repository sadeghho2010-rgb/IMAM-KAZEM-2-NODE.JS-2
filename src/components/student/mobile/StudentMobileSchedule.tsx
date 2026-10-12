import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  BookOpen, 
  Sparkles, 
  User, 
  DoorOpen, 
  CalendarDays,
  ChevronLeft,
  Layers
} from 'lucide-react';
import { cn, WEEK_DAYS } from '../../../lib/utils';
import { localDb } from '../../../lib/localDb';
import { useAuth } from '../../../context/AuthContext';
import { Program, Student, Enrollment } from '../../../types';
import { getTodayShamsi, getShamsiDayOfWeekName } from '../../../lib/jalali';

interface StudentMobileScheduleProps {
  onNavigateTab?: (tab: string, studentId?: string) => void;
}

export const StudentMobileSchedule: React.FC<StudentMobileScheduleProps> = ({
  onNavigateTab
}) => {
  const { currentUser } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [studentObj, setStudentObj] = useState<Student | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const todayShamsi = useMemo(() => getTodayShamsi(), []);
  const todayDayName = useMemo(() => getShamsiDayOfWeekName(todayShamsi), [todayShamsi]);
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    return WEEK_DAYS.includes(todayDayName as any) ? todayDayName : 'شنبه';
  });

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [allProgs, allStudents, allEnrolls] = await Promise.all([
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<Student>('students'),
        localDb.getDocs<Enrollment>('enrollments')
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

      setPrograms(allProgs);
      setEnrollments(allEnrolls);
    } catch (err) {
      console.warn('Error loading schedule:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const studentGrade = studentObj?.grade || currentUser?.gradeLabel || 'پایه ۷';
  const sId = studentObj?.id || currentUser?.studentId || currentUser?.id;

  // Filter student's programs
  const enrolledPrograms = useMemo(() => {
    const myEnrolls = enrollments.filter(e => e.studentId === sId);
    const enrolledIds = new Set(myEnrolls.map(e => e.programId));

    return programs.filter(p => {
      const matchGrade = !p.grade || p.grade === studentGrade || p.grade === 'همه پایه‌ها';
      const matchEnroll = enrolledIds.has(p.id) || 
        (Array.isArray((p as any).studentIds) && (p as any).studentIds.includes(sId));
      return matchEnroll || matchGrade;
    });
  }, [programs, enrollments, studentGrade, sId]);

  // Group programs by day
  const scheduleByDay = useMemo(() => {
    const map: Record<string, Program[]> = {
      'شنبه': [],
      'یکشنبه': [],
      'دوشنبه': [],
      'سه‌شنبه': [],
      'چهارشنبه': [],
      'پنجشنبه': []
    };

    enrolledPrograms.forEach(p => {
      const days = Array.isArray(p.days) 
        ? p.days 
        : (p.day ? [p.day] : []);

      days.forEach(d => {
        if (map[d]) {
          map[d].push(p);
        }
      });
    });

    // Sort classes of each day by time
    Object.keys(map).forEach(d => {
      map[d].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    });

    return map;
  }, [enrolledPrograms]);

  const currentDayClasses = scheduleByDay[selectedDay] || [];

  if (isLoading) {
    return (
      <div className="p-6 bg-white rounded-3xl border border-slate-200 text-center font-vazir shadow-xs" dir="rtl">
        <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold text-slate-700">در حال بارگذاری برنامه کلاسی...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 font-vazir text-right pb-10" dir="rtl">
      {/* 1. Header Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white shadow-md border border-indigo-500/20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 text-sky-300 backdrop-blur-md flex items-center justify-center font-bold shadow-xs border border-white/20">
              <Calendar size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-white">برنامه کلاسی هفتگی</h2>
              <p className="text-[10px] text-indigo-200/80 font-medium">
                {studentObj?.name || currentUser?.name || 'طلبه گرامی'} • {studentGrade}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-sky-500/20 text-sky-200 border border-sky-400/30">
            امروز: {todayDayName}
          </span>
        </div>
      </div>

      {/* 2. Day Tabs Selector */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200/90 shadow-2xs">
        <div className="grid grid-cols-6 gap-1">
          {WEEK_DAYS.map(day => {
            const isToday = day === todayDayName;
            const isSelected = day === selectedDay;
            const classCount = (scheduleByDay[day] || []).length;

            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "py-2 px-1 rounded-xl text-center transition-all cursor-pointer flex flex-col items-center justify-center relative",
                  isSelected
                    ? "bg-indigo-600 text-white shadow-xs"
                    : isToday
                      ? "bg-indigo-50 text-indigo-800 border border-indigo-200"
                      : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {isToday && !isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 absolute top-1 right-1" />
                )}
                <span className="text-[11px] font-black truncate block w-full">{day}</span>
                <span className={cn(
                  "text-[9px] font-mono mt-0.5",
                  isSelected ? "text-indigo-200" : "text-slate-400"
                )}>
                  {classCount} درس
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Class Timeline List */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
            <Clock size={14} className="text-indigo-600" />
            <span>کلاس‌های روز «{selectedDay}» ({currentDayClasses.length} کلاس)</span>
          </h3>
          {selectedDay === todayDayName && (
            <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              برنامه امروز
            </span>
          )}
        </div>

        {currentDayClasses.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs italic bg-slate-50 rounded-xl">
            در روز «{selectedDay}» هیچ کلاسی برای شما تعریف نشده است.
          </div>
        ) : (
          <div className="space-y-2">
            {currentDayClasses.map((p, idx) => (
              <div 
                key={p.id || idx}
                className="p-3 rounded-xl bg-slate-50/80 hover:bg-indigo-50/40 border border-slate-200/90 transition-all flex items-start justify-between gap-2.5"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-black text-slate-900">{p.title}</span>
                    {p.subjectBook && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 font-bold">
                        {p.subjectBook}
                      </span>
                    )}
                    {p.type && (
                      <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700 font-bold">
                        {p.type}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-slate-600 font-medium flex-wrap">
                    <span className="flex items-center gap-1">
                      <User size={11} className="text-slate-400" />
                      <span>استاد: {p.teacher || 'تعیین‌نشده'}</span>
                    </span>
                    {p.madrasRoom && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-indigo-700 font-bold">
                          <DoorOpen size={11} />
                          <span>مَدرَس {p.madrasRoom}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-left">
                  <span className="inline-block px-2 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-700 font-mono font-black text-[11px] shadow-2xs">
                    {p.time || 'نامشخص'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
