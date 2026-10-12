import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckSquare, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Users, 
  BookOpen, 
  Filter,
  ChevronDown,
  Info
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { localDb } from '../../../lib/localDb';
import { useAuth } from '../../../context/AuthContext';
import { Program, AttendanceSessionLog, Student } from '../../../types';

interface StudentMobileAttendanceProps {
  onNavigateTab?: (tab: string, studentId?: string) => void;
}

export const StudentMobileAttendance: React.FC<StudentMobileAttendanceProps> = ({
  onNavigateTab
}) => {
  const { currentUser } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceSessionLog[]>([]);
  const [studentObj, setStudentObj] = useState<Student | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'absent' | 'late' | 'excused'>('all');
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [allProgs, allRecords, allStudents] = await Promise.all([
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<AttendanceSessionLog>('attendance'),
        localDb.getDocs<Student>('students')
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
      setAttendanceRecords(allRecords);
    } catch (err) {
      console.warn('Error loading student attendance:', err);
    } finally {
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

  // Enrolled programs
  const enrolledPrograms = useMemo(() => {
    return programs.filter(p => {
      const matchGrade = !p.grade || p.grade === studentGrade || p.grade === 'همه پایه‌ها';
      const inStudentIds = Array.isArray((p as any).studentIds) && 
        studentIdentifiers.some(id => (p as any).studentIds.includes(id));
      return inStudentIds || matchGrade;
    });
  }, [programs, studentGrade, studentIdentifiers]);

  // Extract individual attendance events for this student
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

    attendanceRecords.forEach(rec => {
      // Find this student in session detail
      const detail = rec.students?.find(st => 
        studentIdentifiers.includes(String(st.studentId)) ||
        (studentObj && st.studentName?.toLowerCase().includes(studentObj.name?.toLowerCase()))
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
          notes: rec.notes
        });
      }
    });

    // Sort newest date first
    return events.sort((a, b) => b.date.localeCompare(a.date));
  }, [attendanceRecords, studentIdentifiers, studentObj]);

  // Aggregate stats
  const metrics = useMemo(() => {
    let present = 0;
    let absent = 0;
    let excused = 0;
    let late = 0;
    studentEvents.forEach(e => {
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
      attendanceRate: studentEvents.length > 0 
        ? Math.round(((present + late) / studentEvents.length) * 100) 
        : 100
    };
  }, [studentEvents]);

  // Filtered session records
  const filteredEvents = useMemo(() => {
    return studentEvents.filter(e => {
      if (selectedProgramFilter !== 'all' && e.programId !== selectedProgramFilter) {
        return false;
      }
      if (selectedFilter === 'absent') return e.status === 'absent';
      if (selectedFilter === 'late') return e.status === 'late';
      if (selectedFilter === 'excused') return e.status === 'excused';
      return true;
    });
  }, [studentEvents, selectedFilter, selectedProgramFilter]);

  // Course-by-course attendance summary
  const courseSummaries = useMemo(() => {
    return enrolledPrograms.map(p => {
      const courseEvents = studentEvents.filter(e => e.programId === p.id);
      const abs = courseEvents.filter(e => e.status === 'absent').length;
      const exc = courseEvents.filter(e => e.status === 'excused').length;
      const pres = courseEvents.filter(e => e.status === 'present').length;
      const lt = courseEvents.filter(e => e.status === 'late').length;
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
        hasWarning: abs >= 3
      };
    });
  }, [enrolledPrograms, studentEvents]);

  if (isLoading) {
    return (
      <div className="p-6 bg-white rounded-3xl border border-slate-200 text-center font-vazir shadow-xs" dir="rtl">
        <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold text-slate-700">در حال بارگذاری کارنامه حضور و غیاب...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 font-vazir text-right pb-10" dir="rtl">
      {/* 1. Header Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white shadow-md border border-indigo-500/20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 text-emerald-300 backdrop-blur-md flex items-center justify-center font-bold shadow-xs border border-white/20">
              <CheckSquare size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-white">کارنامه حضور و غیاب من</h2>
              <p className="text-[10px] text-indigo-200/80 font-medium">
                {studentObj?.name || currentUser?.name || 'طلبه گرامی'} • {studentGrade}
              </p>
            </div>
          </div>
          <div className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-black">
            {metrics.attendanceRate}٪ حضور
          </div>
        </div>

        {/* 4 Stat Badges */}
        <div className="grid grid-cols-4 gap-2 mt-3.5 pt-3 border-t border-white/10 text-center">
          <div className="p-1.5 rounded-xl bg-white/5 border border-white/10">
            <div className="text-sm font-black text-white font-mono">{metrics.total}</div>
            <div className="text-[9px] text-slate-300 font-medium">جلسات</div>
          </div>
          <div className="p-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/20">
            <div className="text-sm font-black text-emerald-300 font-mono">{metrics.present}</div>
            <div className="text-[9px] text-emerald-200 font-medium">حاضر</div>
          </div>
          <div className="p-1.5 rounded-xl bg-rose-500/15 border border-rose-400/20">
            <div className="text-sm font-black text-rose-300 font-mono">{metrics.absent}</div>
            <div className="text-[9px] text-rose-200 font-medium">غیبت</div>
          </div>
          <div className="p-1.5 rounded-xl bg-amber-500/15 border border-amber-400/20">
            <div className="text-sm font-black text-amber-300 font-mono">{metrics.late}</div>
            <div className="text-[9px] text-amber-200 font-medium">تاخیر</div>
          </div>
        </div>
      </div>

      {/* 2. Course-by-Course Attendance Breakdown */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs space-y-2.5">
        <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
          <BookOpen size={14} className="text-indigo-600" />
          <span>وضعیت حضور و غیاب به تفکیک دروس</span>
        </h3>

        <div className="space-y-2">
          {courseSummaries.map(c => {
            const courseRate = c.total > 0 ? Math.round(((c.present + c.late) / c.total) * 100) : 100;
            return (
              <div 
                key={c.id} 
                className={cn(
                  "p-2.5 rounded-xl border transition-all text-xs space-y-1.5",
                  c.hasWarning 
                    ? "bg-rose-50/50 border-rose-200" 
                    : "bg-slate-50/70 border-slate-200/80"
                )}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="min-w-0">
                    <span className="font-black text-slate-900 truncate block">{c.title}</span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      استاد: {c.teacher} {c.madrasRoom && `• مَدرَس ${c.madrasRoom}`}
                    </span>
                  </div>
                  {c.hasWarning && (
                    <span className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[9px] font-black border border-rose-300 shrink-0">
                      ⚠️ مرز اخطار
                    </span>
                  )}
                </div>

                {/* Micro progress bar */}
                <div className="flex items-center gap-2 text-[10px]">
                  <div className="flex-1 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all",
                        c.hasWarning ? "bg-rose-500" : "bg-emerald-500"
                      )}
                      style={{ width: `${courseRate}%` }}
                    />
                  </div>
                  <span className="font-mono font-bold text-slate-600 shrink-0">{courseRate}٪</span>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-0.5 font-medium">
                  <span className="text-emerald-700 font-bold">{c.present} حاضر</span>
                  <span>•</span>
                  <span className={cn(c.absent > 0 ? "text-rose-700 font-bold" : "")}>{c.absent} غیبت غیرموجه</span>
                  {c.excused > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-sky-700 font-bold">{c.excused} موجه</span>
                    </>
                  )}
                  {c.late > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-amber-700 font-bold">{c.late} تاخیر</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Session-by-Session Records History */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
            <Clock size={14} className="text-indigo-600" />
            <span>ریز جلسات ثبت‌شده ({filteredEvents.length})</span>
          </h3>

          {/* Filter Pills */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedFilter('all')}
              className={cn(
                "px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer transition-all",
                selectedFilter === 'all' 
                  ? "bg-indigo-600 text-white shadow-2xs" 
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              همه
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('absent')}
              className={cn(
                "px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer transition-all",
                selectedFilter === 'absent' 
                  ? "bg-rose-600 text-white shadow-2xs" 
                  : "bg-rose-50 text-rose-700 hover:bg-rose-100"
              )}
            >
              غیبت‌ها ({metrics.absent})
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('late')}
              className={cn(
                "px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer transition-all",
                selectedFilter === 'late' 
                  ? "bg-amber-500 text-white shadow-2xs" 
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100"
              )}
            >
              تاخیرها ({metrics.late})
            </button>
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs italic bg-slate-50 rounded-xl">
            هیچ جلسه یا رویدادی با این فیلتر ثبت نشده است.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-0.5">
            {filteredEvents.map(ev => {
              const isPresent = ev.status === 'present';
              const isAbsent = ev.status === 'absent';
              const isLate = ev.status === 'late';
              const isExcused = ev.status === 'excused';

              return (
                <div 
                  key={ev.id}
                  className={cn(
                    "p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all",
                    isPresent && "bg-white border-slate-200/80",
                    isAbsent && "bg-rose-50/60 border-rose-200 text-rose-950",
                    isLate && "bg-amber-50/60 border-amber-200 text-amber-950",
                    isExcused && "bg-sky-50/60 border-sky-200 text-sky-950"
                  )}
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-slate-900 truncate">
                        {ev.programTitle}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium font-mono">
                      <span>{ev.dayOfWeek}</span>
                      <span>•</span>
                      <span>{ev.date}</span>
                      {ev.lateMinutes ? (
                        <span className="text-amber-700 font-bold font-sans">({ev.lateMinutes} دقیقه تاخیر)</span>
                      ) : null}
                      {ev.excuseReason ? (
                        <span className="text-sky-700 font-sans truncate">({ev.excuseReason})</span>
                      ) : null}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0">
                    {isPresent && (
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 size={11} />
                        <span>حاضر</span>
                      </span>
                    )}
                    {isAbsent && (
                      <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 text-[10px] font-black border border-rose-200 flex items-center gap-1">
                        <XCircle size={11} />
                        <span>غیبت</span>
                      </span>
                    )}
                    {isLate && (
                      <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 text-[10px] font-black border border-amber-200 flex items-center gap-1">
                        <Clock size={11} />
                        <span>تاخیر</span>
                      </span>
                    )}
                    {isExcused && (
                      <span className="px-2 py-0.5 rounded-lg bg-sky-100 text-sky-800 text-[10px] font-black border border-sky-200 flex items-center gap-1">
                        <Info size={11} />
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
    </div>
  );
};
