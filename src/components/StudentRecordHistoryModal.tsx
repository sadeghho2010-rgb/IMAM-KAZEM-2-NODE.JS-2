import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  XCircle, 
  User, 
  GraduationCap, 
  BookOpen, 
  CheckCircle2, 
  XCircle as AbsentIcon, 
  Clock, 
  Calendar, 
  Award, 
  FileText, 
  MessageSquare, 
  Users, 
  Printer, 
  CreditCard, 
  Phone, 
  ShieldCheck, 
  AlertCircle,
  Building,
  Home,
  Heart,
  ChevronLeft,
  Filter
} from 'lucide-react';
import { 
  Student, 
  Program, 
  Enrollment, 
  OralExam, 
  StudentComment, 
  DiscussionGroup, 
  ResearchRecord 
} from '../types';
import { localDb, isStudentActive } from '../lib/localDb';
import { cn } from '../lib/utils';
import { AttendanceRecord, StudentAttendanceItem } from './AttendanceAndStats';

interface StudentRecordHistoryModalProps {
  isOpen: boolean;
  student: Student | null;
  onClose: () => void;
}

export default function StudentRecordHistoryModal({
  isOpen,
  student,
  onClose
}: StudentRecordHistoryModalProps) {
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [activeTabSection, setActiveTabSection] = useState<'programs' | 'attendance' | 'exams' | 'research' | 'discussions' | 'comments' | 'financial'>('programs');
  
  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [oralExams, setOralExams] = useState<OralExam[]>([]);
  const [studentComments, setStudentComments] = useState<StudentComment[]>([]);
  const [discussionGroups, setDiscussionGroups] = useState<DiscussionGroup[]>([]);
  const [researchRecords, setResearchRecords] = useState<ResearchRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  // Fetch all related records when student changes
  useEffect(() => {
    if (!isOpen || !student) return;

    let isMounted = true;
    const loadStudentData = async () => {
      setLoading(true);
      try {
        const [
          allProgs, 
          allEnrolls, 
          allAtts, 
          allExams, 
          allComments, 
          allGroups,
          allResearch
        ] = await Promise.all([
          localDb.getDocs<Program>('programs'),
          localDb.getDocs<Enrollment>('enrollments'),
          localDb.getDocs<AttendanceRecord>('attendance'),
          localDb.getDocs<OralExam>('oral_exams'),
          localDb.getDocs<StudentComment>('student_comments'),
          localDb.getDocs<DiscussionGroup>('discussion_groups'),
          localDb.getDocs<ResearchRecord>('research_records')
        ]);

        if (isMounted) {
          setPrograms(allProgs || []);
          setEnrollments(allEnrolls || []);
          setAttendanceRecords(allAtts || []);
          setOralExams(allExams || []);
          setStudentComments(allComments || []);
          setDiscussionGroups(allGroups || []);
          setResearchRecords(allResearch || []);
        }
      } catch (err) {
        console.error('Error loading student comprehensive records:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadStudentData();
    return () => {
      isMounted = false;
    };
  }, [isOpen, student]);

  // Derived available grades for this student
  const availableGrades = useMemo(() => {
    const gradesSet = new Set<string>();
    
    // Student's current grade
    if (student?.grade) gradesSet.add(student.grade.trim());
    if (student?.pastGrades) {
      student.pastGrades.forEach(g => gradesSet.add(g.trim()));
    }

    // From student's enrolled programs
    if (student) {
      const studentEnrolls = enrollments.filter(e => e.studentId === student.id);
      studentEnrolls.forEach(e => {
        const prog = programs.find(p => p.id === e.programId);
        if (prog?.grade) gradesSet.add(prog.grade.trim());
      });
    }

    // Default seminary grades if none found
    ['پایه 7', 'پایه 8', 'پایه 9', 'پایه 10'].forEach(g => gradesSet.add(g));

    return Array.from(gradesSet).sort();
  }, [student, enrollments, programs]);

  // Filtered enrolled programs
  const studentPrograms = useMemo(() => {
    if (!student) return [];
    const studentEnrolls = enrollments.filter(e => e.studentId === student.id);
    let list = programs.filter(p => studentEnrolls.some(e => e.programId === p.id));
    if (selectedGrade !== 'all') {
      list = list.filter(p => p.grade && p.grade.trim() === selectedGrade.trim());
    }
    return list;
  }, [student, enrollments, programs, selectedGrade]);

  // Filtered attendance records for student
  const studentAttendanceList = useMemo(() => {
    if (!student) return [];
    const results: Array<{
      record: AttendanceRecord;
      item: StudentAttendanceItem;
    }> = [];

    attendanceRecords.forEach(rec => {
      if (selectedGrade !== 'all') {
        const p = programs.find(pr => pr.id === rec.programId);
        if (p?.grade && p.grade.trim() !== selectedGrade.trim()) return;
      }
      const foundItem = rec.students?.find(s => s.studentId === student.id);
      if (foundItem) {
        results.push({ record: rec, item: foundItem });
      }
    });

    return results.sort((a, b) => b.record.date.localeCompare(a.record.date));
  }, [student, attendanceRecords, programs, selectedGrade]);

  // Attendance stats
  const attendanceStats = useMemo(() => {
    const total = studentAttendanceList.length;
    const present = studentAttendanceList.filter(s => s.item.status === 'present').length;
    const absent = studentAttendanceList.filter(s => s.item.status === 'absent').length;
    const late = studentAttendanceList.filter(s => s.item.status === 'late').length;
    const excused = studentAttendanceList.filter(s => s.item.status === 'excused').length;
    const rate = total > 0 ? Math.round(((present + excused + (late * 0.5)) / total) * 100) : 100;
    return { total, present, absent, late, excused, rate };
  }, [studentAttendanceList]);

  // Filtered Oral Exams
  const studentOralExams = useMemo(() => {
    if (!student) return [];
    let list = oralExams.filter(o => o.studentId === student.id);
    return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [student, oralExams]);

  // Average exam score
  const avgExamScore = useMemo(() => {
    if (studentOralExams.length === 0) return null;
    const sum = studentOralExams.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);
    return (sum / studentOralExams.length).toFixed(1);
  }, [studentOralExams]);

  // Filtered Research Records
  const studentResearch = useMemo(() => {
    if (!student) return [];
    return researchRecords.filter(r => r.studentId === student.id);
  }, [student, researchRecords]);

  // Filtered Discussion Groups
  const studentDiscussionGroups = useMemo(() => {
    if (!student) return [];
    return discussionGroups.filter(g => g.memberStudentIds?.includes(student.id));
  }, [student, discussionGroups]);

  // Filtered Comments
  const studentCommentsList = useMemo(() => {
    if (!student) return [];
    return studentComments.filter(c => c.studentId === student.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [student, studentComments]);

  if (!isOpen || !student) return null;

  const isActive = isStudentActive(student.isActive);

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
        dir="rtl"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          className="bg-slate-50 rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-300 max-h-[92vh] flex flex-col overflow-hidden"
        >
          {/* Top Modal Header */}
          <div className="p-5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-indigo-50 border-2 border-indigo-200 shadow-sm flex items-center justify-center shrink-0">
                {student.photoUrl ? (
                  <img src={student.photoUrl} alt={student.name} className="w-full h-full object-cover" />
                ) : (
                  <User size={28} className="text-indigo-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-black text-slate-900 leading-tight">
                    پرونده و کارنامه جامع سوابق: {student.name}
                  </h2>
                  
                  {/* Active vs Inactive Status Badge */}
                  {isActive ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>طلبه حاضر مدرسه (فعال در سامانه)</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-300 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      <span>طلبه سابق (غیرفعال در سامانه) - {student.deactivationReason || 'صرفا غیر فعال'}</span>
                    </span>
                  )}

                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {student.grade || 'پایه نامشخص'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  کد ملی: <span className="font-mono font-bold text-slate-700">{student.nationalId || '---'}</span> | 
                  شماره تماس: <span className="font-mono font-bold text-slate-700">{student.phoneNumber || '---'}</span> |
                  کد مرکز مدیریت: <span className="font-mono font-bold text-indigo-700">{student.managementCenterCode || '---'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                title="چاپ کارنامه و پرونده سوابق طلبه"
              >
                <Printer size={15} />
                <span className="hidden sm:inline">چاپ سوابق</span>
              </button>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <XCircle size={24} />
              </button>
            </div>
          </div>

          {/* Grade Selector & Filter Bar */}
          <div className="bg-slate-100/90 border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-700 ml-2 flex items-center gap-1">
                <Filter size={14} className="text-indigo-600" />
                <span>فیلتر و مشاهده به تفکیک پایه:</span>
              </span>

              <button
                type="button"
                onClick={() => setSelectedGrade('all')}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer",
                  selectedGrade === 'all'
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-200"
                )}
              >
                📌 همه پایه‌ها (پرونده کلی)
              </button>

              {availableGrades.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSelectedGrade(g)}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer",
                    selectedGrade === g
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-200"
                  )}
                >
                  {g}
                </button>
              ))}
            </div>

            {/* Quick KPI Stat Chips */}
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <div className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-bold text-slate-700">
                دروس: <span className="text-indigo-600 font-mono">{studentPrograms.length}</span>
              </div>
              <div className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-bold text-slate-700">
                انضباط حضور: <span className="text-emerald-600 font-mono">{attendanceStats.rate}٪</span>
              </div>
              {avgExamScore && (
                <div className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-bold text-slate-700">
                  معدل شفاهی: <span className="text-amber-600 font-mono">{avgExamScore}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tab Navigation for Detailed Sections */}
          <div className="bg-white px-5 pt-2 border-b border-slate-200 flex items-center gap-2 overflow-x-auto shrink-0">
            <button
              onClick={() => setActiveTabSection('programs')}
              className={cn(
                "px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
                activeTabSection === 'programs'
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              <BookOpen size={15} />
              <span>دروس و برنامه‌ها ({studentPrograms.length})</span>
            </button>

            <button
              onClick={() => setActiveTabSection('attendance')}
              className={cn(
                "px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
                activeTabSection === 'attendance'
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              <Clock size={15} />
              <span>کارنامه حضور و غیاب ({studentAttendanceList.length})</span>
            </button>

            <button
              onClick={() => setActiveTabSection('exams')}
              className={cn(
                "px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
                activeTabSection === 'exams'
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              <Award size={15} />
              <span>امتحانات و ارزیابی شفاهی ({studentOralExams.length})</span>
            </button>

            <button
              onClick={() => setActiveTabSection('research')}
              className={cn(
                "px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
                activeTabSection === 'research'
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              <FileText size={15} />
              <span>سوابق پژوهشی ({studentResearch.length})</span>
            </button>

            <button
              onClick={() => setActiveTabSection('discussions')}
              className={cn(
                "px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
                activeTabSection === 'discussions'
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              <Users size={15} />
              <span>گروه‌های مباحثه ({studentDiscussionGroups.length})</span>
            </button>

            <button
              onClick={() => setActiveTabSection('comments')}
              className={cn(
                "px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
                activeTabSection === 'comments'
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              <MessageSquare size={15} />
              <span>نظرات اساتید و مدیران ({studentCommentsList.length})</span>
            </button>

            <button
              onClick={() => setActiveTabSection('financial')}
              className={cn(
                "px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
                activeTabSection === 'financial'
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              <CreditCard size={15} />
              <span>اطلاعات مالی و شناسنامه‌ای</span>
            </button>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6" ref={printRef}>
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-sm font-bold">
                در حال بارگذاری و تحلیل سوابق طلبه...
              </div>
            ) : (
              <>
                {/* 1. PROGRAMS TAB */}
                {activeTabSection === 'programs' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <BookOpen size={16} className="text-indigo-600" />
                        <span>دروس و برنامه‌های ثبت‌شده در {selectedGrade === 'all' ? 'کلیه پایه‌ها' : selectedGrade}</span>
                      </h4>
                      <span className="text-xs text-slate-500">تعداد: {studentPrograms.length} عنوان درس</span>
                    </div>

                    {studentPrograms.length === 0 ? (
                      <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 text-xs italic">
                        هیچ درسی برای این طلبه در پایه انتخابی ثبت نگردیده است.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {studentPrograms.map((prog, idx) => (
                          <div 
                            key={prog.id} 
                            className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs hover:border-indigo-300 transition-all space-y-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  {prog.type || 'اصلی'}
                                </span>
                                <h5 className="text-sm font-black text-slate-900 mt-1">{idx + 1}. {prog.title}</h5>
                              </div>
                              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg font-mono">
                                {prog.grade || '---'}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                              <div>
                                <span className="text-slate-400 block text-[10px]">استاد:</span>
                                <span className="font-bold text-slate-800">{prog.teacher || 'تعیین‌نشده'}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">مَدرَس (کلاس درس):</span>
                                <span className="font-bold text-slate-800">{prog.classroom || prog.madrasRoom || 'نامشخص'}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">روزها:</span>
                                <span className="font-bold text-slate-800">{prog.days?.join('، ') || prog.day || '---'}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">ساعت برگزاری:</span>
                                <span className="font-mono font-bold text-slate-800">{prog.startTime ? `${prog.startTime} - ${prog.endTime}` : (prog.time || '---')}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. ATTENDANCE TAB */}
                {activeTabSection === 'attendance' && (
                  <div className="space-y-4">
                    {/* Attendance KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      <div className="bg-white p-3 rounded-2xl border border-slate-200 text-center">
                        <span className="text-[10px] font-bold text-slate-400 block">کل جلسات</span>
                        <span className="text-base font-black text-slate-800 font-mono">{attendanceStats.total}</span>
                      </div>
                      <div className="bg-emerald-50/60 p-3 rounded-2xl border border-emerald-200 text-center">
                        <span className="text-[10px] font-bold text-emerald-600 block">حاضر</span>
                        <span className="text-base font-black text-emerald-700 font-mono">{attendanceStats.present}</span>
                      </div>
                      <div className="bg-rose-50/60 p-3 rounded-2xl border border-rose-200 text-center">
                        <span className="text-[10px] font-bold text-rose-600 block">غایب</span>
                        <span className="text-base font-black text-rose-700 font-mono">{attendanceStats.absent}</span>
                      </div>
                      <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200 text-center">
                        <span className="text-[10px] font-bold text-amber-600 block">تاخیر</span>
                        <span className="text-base font-black text-amber-700 font-mono">{attendanceStats.late}</span>
                      </div>
                      <div className="bg-indigo-50/60 p-3 rounded-2xl border border-indigo-200 text-center">
                        <span className="text-[10px] font-bold text-indigo-600 block">درصد انضباط</span>
                        <span className="text-base font-black text-indigo-700 font-mono">{attendanceStats.rate}٪</span>
                      </div>
                    </div>

                    {/* Attendance Table */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                      <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-700">
                        <span>ریز جلسات ثبت‌شده حضور و غیاب</span>
                        <span className="text-[11px] text-slate-400 font-normal">تعداد: {studentAttendanceList.length} جلسه</span>
                      </div>

                      {studentAttendanceList.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs italic">
                          هیچ جلسه کلاسی ثبت‌شده‌ای در این بازه یافت نشد.
                        </div>
                      ) : (
                        <div className="overflow-x-auto max-h-96">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                              <tr>
                                <th className="p-2.5">#</th>
                                <th className="p-2.5">تاریخ</th>
                                <th className="p-2.5">روز</th>
                                <th className="p-2.5">عنوان درس</th>
                                <th className="p-2.5">وضعیت حضور</th>
                                <th className="p-2.5">میزان تاخیر / یادداشت</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {studentAttendanceList.map((item, i) => {
                                const st = item.item.status;
                                return (
                                  <tr key={`${item.record.id}_${i}`} className="hover:bg-slate-50/80">
                                    <td className="p-2.5 text-slate-400 font-mono">{i + 1}</td>
                                    <td className="p-2.5 font-mono font-bold text-slate-800">{item.record.date}</td>
                                    <td className="p-2.5 text-slate-600">{item.record.dayOfWeek || '---'}</td>
                                    <td className="p-2.5 font-bold text-indigo-950">{item.record.programTitle}</td>
                                    <td className="p-2.5">
                                      {st === 'present' && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                          حاضر
                                        </span>
                                      )}
                                      {st === 'absent' && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                          غایب
                                        </span>
                                      )}
                                      {st === 'late' && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                          تاخیر ({item.item.lateMinutes || 0} دقیقه)
                                        </span>
                                      )}
                                      {st === 'excused' && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
                                          مرخصی موجه
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-2.5 text-slate-500 text-[11px]">
                                      {item.item.note || item.record.notes || '---'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. EXAMS TAB */}
                {activeTabSection === 'exams' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <Award size={16} className="text-indigo-600" />
                        <span>کارنامه آزمون‌ها و ارزیابی‌های شفاهی</span>
                      </h4>
                      {avgExamScore && (
                        <span className="text-xs font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded-xl border border-amber-300">
                          معدل کل شفاهی: {avgExamScore} از ۲۰
                        </span>
                      )}
                    </div>

                    {studentOralExams.length === 0 ? (
                      <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 text-xs italic">
                        هیچ نمره یا ارزیابی شفاهی برای این طلبه ثبت نشده است.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {studentOralExams.map((exam, idx) => (
                          <div key={exam.id || idx} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                                  {exam.subjectType || 'ارزیابی شفاهی'}
                                </span>
                                <h5 className="text-sm font-black text-slate-900 mt-1">{exam.title}</h5>
                              </div>
                              <div className="text-center">
                                <span className="text-lg font-black font-mono text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-200">
                                  {exam.score}
                                </span>
                                <span className="text-[9px] text-slate-400 block mt-0.5">از ۲۰</span>
                              </div>
                            </div>

                            <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                              <div className="flex justify-between">
                                <span className="text-slate-400">استاد ممتحن:</span>
                                <span className="font-bold text-slate-800">{exam.examinerName || '---'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">تاریخ آزمون:</span>
                                <span className="font-mono font-bold text-slate-800">{exam.date || '---'}</span>
                              </div>
                              {exam.notes && (
                                <div className="pt-1 text-slate-500 border-t border-slate-200/60">
                                  <span className="text-slate-400">توضیحات: </span>
                                  {exam.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. RESEARCH TAB */}
                {activeTabSection === 'research' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <FileText size={16} className="text-indigo-600" />
                        <span>سوابق پژوهشی و مقالات</span>
                      </h4>
                      <span className="text-xs text-slate-500">تعداد: {studentResearch.length} عنوان</span>
                    </div>

                    {studentResearch.length === 0 ? (
                      <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 text-xs italic">
                        هیچ فعالیت پژوهشی یا مقاله‌ای برای این طلبه ثبت نشده است.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {studentResearch.map((r, idx) => (
                          <div key={r.id || idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                            <div className="flex items-center justify-between">
                              <h5 className="text-sm font-black text-slate-900">{idx + 1}. {r.topic || 'پژوهش علمی'}</h5>
                              {r.score && (
                                <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-200">
                                  نمره: {r.score}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                              <div>مرحله: <span className="font-bold text-slate-800">{r.stage || 'در حال انجام'}</span></div>
                              <div>نوع: <span className="font-bold text-slate-800">{r.type === 'group' ? 'گروهی' : 'فردی'}</span></div>
                              <div>تاریخ بروزرسانی: <span className="font-mono font-bold text-slate-800">{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('fa-IR') : '---'}</span></div>
                            </div>
                            {(r.description || r.supervisorNotes) && (
                              <p className="text-xs text-slate-500 leading-relaxed pt-1">
                                {r.description || r.supervisorNotes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 5. DISCUSSIONS TAB */}
                {activeTabSection === 'discussions' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <Users size={16} className="text-indigo-600" />
                        <span>گروه‌ها و حلقه‌های مباحثه</span>
                      </h4>
                      <span className="text-xs text-slate-500">تعداد گروه‌ها: {studentDiscussionGroups.length}</span>
                    </div>

                    {studentDiscussionGroups.length === 0 ? (
                      <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 text-xs italic">
                        این طلبه در هیچ گروه یا حلقه مباحثه‌ای عضویت ندارد.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {studentDiscussionGroups.map((g, idx) => (
                          <div key={g.id || idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                            <div className="flex justify-between items-center">
                              <h5 className="text-sm font-black text-indigo-950">{g.title}</h5>
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">
                                {g.grade || 'پایه نامشخص'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600">
                              <b>موضوع مباحثه:</b> {g.subject || g.programTitle || 'عمومی'}
                            </p>
                            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                              <span>تعداد اعضای گروه: {g.memberStudentIds?.length || 0} نفر</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 6. COMMENTS TAB */}
                {activeTabSection === 'comments' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <MessageSquare size={16} className="text-indigo-600" />
                        <span>نظرات اساتید و مسئولین آموزشی</span>
                      </h4>
                      <span className="text-xs text-slate-500">تعداد نظرات: {studentCommentsList.length}</span>
                    </div>

                    {studentCommentsList.length === 0 ? (
                      <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 text-xs italic">
                        هیچ نظر یا بازخوردی برای این طلبه ثبت نشده است.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {studentCommentsList.map((c, idx) => (
                          <div key={c.id || idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">{c.authorName}</span>
                                {c.category && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                                    {c.category}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 font-mono">{c.date}</span>
                            </div>
                            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                              {c.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 7. FINANCIAL & IDENTIFICATION TAB */}
                {activeTabSection === 'financial' && (
                  <div className="space-y-6">
                    {/* Educational Info Box */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                      <h4 className="text-xs font-black text-indigo-700 uppercase tracking-wider flex items-center gap-2 border-b border-indigo-50 pb-2">
                        <Building size={16} />
                        <span>باکس اطلاعات آموزشی</span>
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 block">کد مرکز مدیریت</span>
                          <span className="text-sm font-bold font-mono text-indigo-900">{student.managementCenterCode || 'ثبت نشده'}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 block">کد موسسه</span>
                          <span className="text-sm font-bold font-mono text-indigo-900">{student.instituteCode || 'ثبت نشده'}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 block">کد مرکز خدمات</span>
                          <span className="text-sm font-bold font-mono text-indigo-900">{student.servicesCenterCode || 'ثبت نشده'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Identity & Family */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                      <h4 className="text-xs font-black text-indigo-700 uppercase tracking-wider flex items-center gap-2 border-b border-indigo-50 pb-2">
                        <User size={16} />
                        <span>باکس اطلاعات هویتی و خانوادگی</span>
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 block">تاریخ تولد</span>
                          <span className="font-mono font-bold text-slate-800">{student.birthDate || '---'}</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 block">اهل کجاست</span>
                          <span className="font-bold text-slate-800">{student.birthPlace || '---'}</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 block">شغل پدر</span>
                          <span className="font-bold text-slate-800">{student.fatherOccupation || student.fatherJob || '---'}</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 block">وضعیت تعمم</span>
                          <span className="font-bold text-slate-800">{student.tammomStatus || 'غیر معمم'}</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 block">وضعیت تاهل</span>
                          <span className="font-bold text-slate-800">{student.maritalStatus || 'مجرد'}</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 block">تعداد فرزندان</span>
                          <span className="font-bold text-slate-800">{student.childrenCount ?? 0}</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 col-span-2">
                          <span className="text-[10px] text-slate-400 block">وضعیت سکونت</span>
                          <span className="font-bold text-slate-800">
                            {student.livingStatus || 'پدری'}
                            {student.livingStatus === 'سایر' && student.livingStatusOther ? ` (${student.livingStatusOther})` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Educational History */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                      <h4 className="text-xs font-black text-indigo-700 uppercase tracking-wider flex items-center gap-2 border-b border-indigo-50 pb-2">
                        <GraduationCap size={16} />
                        <span>باکس سوابق تحصیلی</span>
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 block">تحصیلات کلاسیک</span>
                          <span className="font-bold text-slate-800">{student.classicEducation || '---'}</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 block">سال ورود به حوزه</span>
                          <span className="font-mono font-bold text-slate-800">{student.howzaEntryYear || '---'}</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 block">سال ورود به موسسه</span>
                          <span className="font-mono font-bold text-slate-800">{student.instituteEntryYear || '---'}</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 block">مدرسه سطح یک</span>
                          <span className="font-bold text-slate-800">{student.levelOneSchool || '---'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Financial & Banking Info */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                      <h4 className="text-xs font-black text-emerald-700 uppercase tracking-wider flex items-center gap-2 border-b border-emerald-50 pb-2">
                        <CreditCard size={16} />
                        <span>بخش اطلاعات مالی و حساب‌های بانکی</span>
                      </h4>
                      <div className="space-y-3">
                        <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                          <span className="text-[10px] font-bold text-emerald-700 block">کد شهریه</span>
                          <span className="text-sm font-bold font-mono text-emerald-950">{student.tuitionCode || 'ثبت نشده'}</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Account 1 */}
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 text-xs">
                            <span className="text-[11px] font-bold text-slate-700 block border-b border-slate-200 pb-1">
                              حساب بانکی شماره ۱ {student.bankName1 ? `(${student.bankName1})` : ''}
                            </span>
                            <div>شماره حساب: <span className="font-mono font-bold text-slate-900">{student.bankAccount1 || '---'}</span></div>
                            <div>شماره شبا: <span className="font-mono font-bold text-slate-900" dir="ltr">{student.bankSheba1 || '---'}</span></div>
                          </div>

                          {/* Account 2 */}
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 text-xs">
                            <span className="text-[11px] font-bold text-slate-700 block border-b border-slate-200 pb-1">
                              حساب بانکی شماره ۲ {student.bankName2 ? `(${student.bankName2})` : ''}
                            </span>
                            <div>شماره حساب: <span className="font-mono font-bold text-slate-900">{student.bankAccount2 || '---'}</span></div>
                            <div>شماره شبا: <span className="font-mono font-bold text-slate-900" dir="ltr">{student.bankSheba2 || '---'}</span></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
            <div className="text-xs text-slate-500">
              {isActive ? (
                <span className="text-emerald-700 font-bold">🟢 طلبه حاضر در مدرسه</span>
              ) : (
                <span className="text-slate-600 font-bold">
                  ⚪ طلبه سابق مدرسه (علت: {student.deactivationReason || 'صرفا غیر فعال'})
                </span>
              )}
            </div>

            <button
              onClick={onClose}
              className="py-2 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              بستن
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
