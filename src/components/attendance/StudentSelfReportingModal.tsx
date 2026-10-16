import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertCircle, 
  Sparkles, 
  Calendar, 
  BookOpen, 
  User, 
  X, 
  Check, 
  Send, 
  CheckSquare,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Program, AttendanceSessionLog, StudentAttendanceDetail, AttendanceStatus } from '../../types';
import { localDb } from '../../lib/localDb';
import { getTodayShamsi, getShamsiDayOfWeek } from '../../lib/jalali';
import { cn } from '../../lib/utils';

interface StudentSelfReportingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  studentObj?: any;
  programs: Program[];
  enrollments: any[];
  onAttendanceSaved?: () => void;
}

export const StudentSelfReportingModal: React.FC<StudentSelfReportingModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  studentObj,
  programs,
  enrollments,
  onAttendanceSaved
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayShamsi());
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>('present');
  const [lateMinutes, setLateMinutes] = useState<number>(10);
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [existingRecordForSession, setExistingRecordForSession] = useState<StudentAttendanceDetail | null>(null);

  const studentId = String(studentObj?.id || currentUser?.studentId || currentUser?.linkedStudentId || currentUser?.id || '').trim();
  const studentUsername = String(currentUser?.username || '').trim();
  const studentNationalId = String(studentObj?.nationalId || currentUser?.nationalCode || currentUser?.nationalId || studentUsername || '').trim();
  const studentName = String(studentObj?.name || currentUser?.studentName || currentUser?.fullName || currentUser?.name || 'طلبه گرامی').trim();
  const studentGrade = String(studentObj?.grade || currentUser?.gradeLabel || '').trim();

  // Strict Course Filter:
  // A student CANNOT see other courses they do not participate in!
  // ONLY programs where:
  // 1) attendanceType === 'self_reporting'
  // 2) The student is enrolled or assigned to it
  const selfReportingCourses = useMemo(() => {
    const isMatchingGrade = (pGrade?: string, sGrade?: string) => {
      if (!pGrade || pGrade === 'همه پایه‌ها' || pGrade === 'همه') return true;
      if (!sGrade) return true;
      const pNorm = String(pGrade).replace(/[0-9]/g, d => String.fromCharCode(d.charCodeAt(0) + 1728)).trim();
      const sNorm = String(sGrade).replace(/[0-9]/g, d => String.fromCharCode(d.charCodeAt(0) + 1728)).trim();
      if (pNorm === sNorm) return true;
      const digitsP = pNorm.match(/\d+/)?.[0];
      const digitsS = sNorm.match(/\d+/)?.[0];
      if (digitsP && digitsS && digitsP === digitsS) return true;
      return false;
    };

    return programs.filter(p => {
      if (p.attendanceType !== 'self_reporting') return false;

      const inEnroll = enrollments.some(e => 
        String(e.programId) === String(p.id) && (
          String(e.studentId) === String(studentId) ||
          String(e.studentId) === String(studentUsername)
        )
      );
      if (inEnroll) return true;

      const inArray = Array.isArray((p as any).studentIds) && (
        (p as any).studentIds.includes(String(studentId)) ||
        (p as any).studentIds.includes(String(studentUsername))
      );
      if (inArray) return true;

      const hasExplicitList = Boolean((p as any).hasExplicitEnrollment) || (Array.isArray((p as any).studentIds) && (p as any).studentIds.length > 0);
      if (!hasExplicitList || isMatchingGrade(p.grade, studentGrade)) {
        return isMatchingGrade(p.grade, studentGrade);
      }

      return false;
    });
  }, [programs, enrollments, studentId, studentUsername, studentGrade]);

  // Set default selected program
  useEffect(() => {
    if (selfReportingCourses.length > 0) {
      if (!selectedProgramId || !selfReportingCourses.some(c => c.id === selectedProgramId)) {
        setSelectedProgramId(selfReportingCourses[0].id);
      }
    } else {
      setSelectedProgramId('');
    }
  }, [selfReportingCourses, selectedProgramId]);

  // Check if student already has a recorded status for selected course & date
  useEffect(() => {
    let isCancelled = false;

    const checkExistingStatus = async () => {
      if (!selectedProgramId || !selectedDate) {
        setExistingRecordForSession(null);
        return;
      }

      try {
        const cleanDate = selectedDate.replace(/\//g, '-');
        const logId = `${selectedProgramId}_${cleanDate}`;
        const allLogs = await localDb.getDocs<AttendanceSessionLog>('attendance');
        const log = allLogs.find(l => l.id === logId || (l.programId === selectedProgramId && l.date === selectedDate));

        if (!isCancelled && log && Array.isArray(log.students)) {
          const myDetail = log.students.find(s => 
            String(s.studentId) === String(studentId) ||
            (s.nationalId && String(s.nationalId) === String(studentNationalId)) ||
            (s.studentName && s.studentName === studentName)
          );

          if (myDetail) {
            setExistingRecordForSession(myDetail);
            setSelectedStatus(myDetail.status || 'present');
            if (myDetail.lateMinutes) setLateMinutes(myDetail.lateMinutes);
            if (myDetail.note) setNote(myDetail.note);
            return;
          }
        }

        if (!isCancelled) {
          setExistingRecordForSession(null);
        }
      } catch (err) {
        if (!isCancelled) setExistingRecordForSession(null);
      }
    };

    checkExistingStatus();

    return () => {
      isCancelled = true;
    };
  }, [selectedProgramId, selectedDate, studentId, studentNationalId, studentName]);

  const currentProgram = selfReportingCourses.find(p => p.id === selectedProgramId);
  const dayName = getShamsiDayOfWeek(selectedDate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProgram) {
      alert('لطفاً درس مورد نظر را برای ثبت خوداظهاری انتخاب فرمایید.');
      return;
    }
    if (!selectedDate.trim()) {
      alert('لطفاً تاریخ جلسه را مشخص فرمایید.');
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanDate = selectedDate.replace(/\//g, '-');
      const logId = `${currentProgram.id}_${cleanDate}`;
      const nowIso = new Date().toISOString();

      // Retrieve existing logs
      const allLogs = await localDb.getDocs<AttendanceSessionLog>('attendance');
      let existingLog = allLogs.find(l => l.id === logId || (l.programId === currentProgram.id && l.date === selectedDate));

      const myStudentDetail: StudentAttendanceDetail = {
        studentId,
        studentName,
        nationalId: studentNationalId,
        status: selectedStatus,
        lateMinutes: selectedStatus === 'late' ? Number(lateMinutes) || 10 : undefined,
        note: note.trim() || 'ثبت خوداظهاری توسط طلبه',
        recordedMethod: 'self_reporting',
        selfReportedAt: nowIso
      };

      if (existingLog) {
        // Update student in existing session log
        const currentStudents = [...(existingLog.students || [])];
        const sIdx = currentStudents.findIndex(s => 
          String(s.studentId) === String(studentId) ||
          (s.nationalId && String(s.nationalId) === String(studentNationalId)) ||
          (s.studentName && s.studentName === studentName)
        );

        if (sIdx >= 0) {
          currentStudents[sIdx] = {
            ...currentStudents[sIdx],
            ...myStudentDetail
          };
        } else {
          currentStudents.push(myStudentDetail);
        }

        const updatedLog: AttendanceSessionLog = {
          ...existingLog,
          students: currentStudents,
          updatedAt: nowIso
        } as any;

        await localDb.setDoc('attendance', updatedLog);
      } else {
        // Create new session log for that date and class
        const newLog: AttendanceSessionLog = {
          id: logId,
          programId: currentProgram.id,
          programTitle: currentProgram.title,
          grade: currentProgram.grade || '',
          date: selectedDate,
          dayOfWeek: dayName,
          isCancelled: false,
          attendanceType: 'self_reporting',
          recordedByName: `خوداظهاری طلبه (${studentName})`,
          recordedAt: nowIso,
          students: [myStudentDetail]
        } as any;

        await localDb.setDoc('attendance', newLog);
      }

      // Dispatch real-time events
      window.dispatchEvent(new CustomEvent('app_data_change'));
      window.dispatchEvent(new CustomEvent('attendance_updated'));

      alert(`✅ وضعیت «${selectedStatus === 'present' ? 'حاضر' : selectedStatus === 'late' ? 'با تاخیر' : 'غایب'}» با موفقیت در درس «${currentProgram.title}» برای تاریخ ${selectedDate} ثبت گردید.`);
      
      if (onAttendanceSaved) {
        onAttendanceSaved();
      }
      onClose();
    } catch (err: any) {
      alert('خطا در ثبت خوداظهاری: ' + (err?.message || 'خطای نامشخص'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm dir-rtl font-vazir">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl w-full max-w-lg border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center font-black text-amber-300 shadow-inner">
                <CheckSquare size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-black">ثبت خوداظهاری حضور و غیاب</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 font-bold border border-emerald-400/40">
                    ویژه طلبه
                  </span>
                </div>
                <p className="text-[11px] text-emerald-100/90 mt-0.5">
                  {studentName} {studentGrade && `• ${studentGrade}`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
            {selfReportingCourses.length === 0 ? (
              <div className="p-6 text-center space-y-3 bg-amber-50/70 border border-amber-200 rounded-2xl">
                <AlertCircle size={36} className="text-amber-600 mx-auto" />
                <h4 className="text-xs font-bold text-amber-900">
                  هیچ کلاسی با شیوه «خوداظهاری» برای شما فعال نیست.
                </h4>
                <p className="text-[11px] text-amber-800/80 leading-relaxed">
                  کلاس‌های شما توسط نماینده محترم کلاس یا مسئول آموزش حضور و غیاب می‌شوند. به محض اینکه استادی یا کلاسی حالت خوداظهاری را برای شما فعال کند، در این قسمت لیست خواهد شد.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Notice Card */}
                <div className="p-3 bg-emerald-50/70 border border-emerald-200/90 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-950">
                  <Info size={17} className="text-emerald-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold block">قوانین و شیوه ثبت خوداظهاری:</span>
                    <p className="text-[11px] text-emerald-900/90 leading-relaxed">
                      شما فقط مجاز به ثبت وضعیت حضور برای شخص خودتان در دروس دارای خوداظهاری هستید. پس از ثبت، برچسب «شیوه ثبت: خوداظهاری» در کارنامه شما برای اطلاع آموزش درج می‌شود.
                    </p>
                  </div>
                </div>

                {/* 1. Select Course */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <BookOpen size={14} className="text-indigo-600" />
                    <span>انتخاب درس / کلاس دارای خوداظهاری:</span>
                  </label>
                  <select
                    value={selectedProgramId}
                    onChange={(e) => setSelectedProgramId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-500 outline-none cursor-pointer"
                  >
                    {selfReportingCourses.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.title} {c.grade ? `(${c.grade})` : ''} {c.teacher ? `• استاد: ${c.teacher}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Select Date */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Calendar size={14} className="text-indigo-600" />
                    <span>تاریخ جلسه درس (شمسی):</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      placeholder="۱۴۰۴/۰۷/۱۵"
                      dir="ltr"
                      className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 text-center focus:bg-white focus:border-emerald-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedDate(getTodayShamsi())}
                      className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
                    >
                      امروز ({dayName})
                    </button>
                  </div>
                </div>

                {/* Existing Record Indicator */}
                {existingRecordForSession && (
                  <div className="p-2.5 bg-indigo-50/80 border border-indigo-200 rounded-xl text-[11px] text-indigo-900 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Clock size={13} className="text-indigo-600" />
                      <span>قبلاً برای این تاریخ وضعیت «<strong>{existingRecordForSession.status === 'present' ? 'حاضر' : existingRecordForSession.status === 'late' ? 'تاخیر' : 'غایب'}</strong>» ثبت شده بود (امکان ویرایش دارید).</span>
                    </span>
                  </div>
                )}

                {/* 3. Status Selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    وضعیت حضور خود در این جلسه:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {/* Present */}
                    <button
                      type="button"
                      onClick={() => setSelectedStatus('present')}
                      className={cn(
                        "p-3 rounded-2xl text-xs font-black transition-all flex flex-col items-center gap-1.5 cursor-pointer border",
                        selectedStatus === 'present'
                          ? "bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-500/30 scale-102"
                          : "bg-slate-50 hover:bg-emerald-50/50 text-slate-700 border-slate-200"
                      )}
                    >
                      <CheckCircle2 size={20} className={selectedStatus === 'present' ? 'text-white' : 'text-emerald-600'} />
                      <span>حاضر بودم</span>
                    </button>

                    {/* Late */}
                    <button
                      type="button"
                      onClick={() => setSelectedStatus('late')}
                      className={cn(
                        "p-3 rounded-2xl text-xs font-black transition-all flex flex-col items-center gap-1.5 cursor-pointer border",
                        selectedStatus === 'late'
                          ? "bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-400/30 scale-102"
                          : "bg-slate-50 hover:bg-amber-50/50 text-slate-700 border-slate-200"
                      )}
                    >
                      <Clock size={20} className={selectedStatus === 'late' ? 'text-white' : 'text-amber-600'} />
                      <span>با تاخیر</span>
                    </button>

                    {/* Absent */}
                    <button
                      type="button"
                      onClick={() => setSelectedStatus('absent')}
                      className={cn(
                        "p-3 rounded-2xl text-xs font-black transition-all flex flex-col items-center gap-1.5 cursor-pointer border",
                        selectedStatus === 'absent'
                          ? "bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-500/30 scale-102"
                          : "bg-slate-50 hover:bg-rose-50/50 text-slate-700 border-slate-200"
                      )}
                    >
                      <XCircle size={20} className={selectedStatus === 'absent' ? 'text-white' : 'text-rose-600'} />
                      <span>غایب بودم</span>
                    </button>
                  </div>
                </div>

                {/* Late Minutes (If Late Selected) */}
                {selectedStatus === 'late' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-2 text-xs"
                  >
                    <label className="block font-bold text-amber-900">
                      میزان تاخیر به دقیقه:
                    </label>
                    <div className="flex items-center gap-2">
                      {[5, 10, 15, 20, 30].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setLateMinutes(m)}
                          className={cn(
                            "flex-1 py-1.5 rounded-xl font-mono font-bold text-xs transition-all border cursor-pointer",
                            lateMinutes === m
                              ? "bg-amber-600 text-white border-amber-700 shadow-xs"
                              : "bg-white text-slate-700 border-amber-200 hover:bg-amber-100"
                          )}
                        >
                          {m} دقیقه
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* 4. Optional Note */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    توضیحات یا یادداشت (اختیاری):
                  </label>
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="توضیحات در صورت نیاز (مثلاً علت تاخیر یا غیبت)..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-emerald-500 outline-none resize-none leading-relaxed"
                  />
                </div>

                {/* Submit Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-700/20 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Send size={14} />
                    <span>{isSubmitting ? 'در حال ثبت...' : 'ثبت قطعی خوداظهاری'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
