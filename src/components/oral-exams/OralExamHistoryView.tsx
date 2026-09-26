import React, { useState, useMemo } from 'react';
import { 
  Archive, 
  Search, 
  Filter, 
  UserCheck, 
  BookOpen, 
  User, 
  FileSpreadsheet, 
  Printer, 
  Download, 
  Edit3, 
  Eye, 
  Calendar, 
  Award, 
  FileText, 
  TrendingUp, 
  X, 
  CheckCircle2, 
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { OralExamPeriod, OralExamStudentRecord, Student, Teacher, ScopeBook } from '../../types';
import { exportPeriodResultsExcel, exportReportWordDoc, toPersianDigits } from './OralExamDocGenerator';
import { localDb } from '../../lib/localDb';
import { cn } from '../../lib/utils';

interface OralExamHistoryViewProps {
  periods: OralExamPeriod[];
  records: Record<string, OralExamStudentRecord>;
  students: Student[];
  teachers: Teacher[];
  scopeBooks: ScopeBook[];
  canEdit: boolean;
  onEditPeriod: (period: OralExamPeriod) => void;
  onRefreshData: () => void;
}

export default function OralExamHistoryView({
  periods,
  records,
  students,
  teachers,
  scopeBooks,
  canEdit,
  onEditPeriod,
  onRefreshData
}: OralExamHistoryViewProps) {
  // Main view mode: 'list' (لیست دوره‌ها و سوابق) vs 'reports' (بخش گزارش‌گیری پیشرفته)
  const [activeTab, setActiveTab] = useState<'list' | 'reports'>('list');

  // Filters for Periods List
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [filterSubjectType, setFilterSubjectType] = useState<string>('all');
  const [filterBook, setFilterBook] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Selected period to view in detail modal
  const [viewingPeriod, setViewingPeriod] = useState<OralExamPeriod | null>(null);

  // Edit record inside modal
  const [editingStudentRecord, setEditingStudentRecord] = useState<OralExamStudentRecord | null>(null);
  const [editFiqhScore, setEditFiqhScore] = useState<string>('');
  const [editUsulScore, setEditUsulScore] = useState<string>('');
  const [editOverallStatus, setEditOverallStatus] = useState<string>('passed');
  const [editNotes, setEditNotes] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // -------------------------------------------------------------
  // REPORTS STATE
  // -------------------------------------------------------------
  const [reportType, setReportType] = useState<'teachers' | 'books' | 'students'>('teachers');
  
  // Teachers Report State
  const [selectedTeacherName, setSelectedTeacherName] = useState<string>('all');
  
  // Books Report State
  const [selectedBookName, setSelectedBookName] = useState<string>('all');

  // Students Report State
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentSearchInput, setStudentSearchInput] = useState<string>('');

  // Students Map for quick lookup
  const studentsMap = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach(s => map.set(s.id, s));
    return map;
  }, [students]);

  // All Academic Years available
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    periods.forEach(p => {
      if (p.academicYear) set.add(p.academicYear);
    });
    return Array.from(set).sort();
  }, [periods]);

  // All Teachers that have examined
  const examinerNamesList = useMemo(() => {
    const set = new Set<string>();
    teachers.forEach(t => set.add(t.name));
    periods.forEach(p => {
      p.examinerTeacherNames?.forEach(name => set.add(name));
      p.examiners?.forEach(e => set.add(e.teacherName));
    });
    Object.values(records).forEach(r => {
      if (r.fiqhExaminerTeacherName) set.add(r.fiqhExaminerTeacherName);
      if (r.usulExaminerTeacherName) set.add(r.usulExaminerTeacherName);
    });
    return Array.from(set).filter(Boolean).sort();
  }, [teachers, periods, records]);

  // Filtered Periods
  const filteredPeriods = useMemo(() => {
    return periods.filter(p => {
      if (filterGrade !== 'all') {
        if (filterGrade === 'امتحان ورودی' && p.grade !== 'امتحان ورودی' && p.examType !== 'entrance') return false;
        if (filterGrade !== 'امتحان ورودی' && p.grade !== filterGrade) return false;
      }

      if (filterSubjectType !== 'all') {
        if (filterSubjectType === 'usul' && !p.hasUsul) return false;
        if (filterSubjectType === 'fiqh' && !p.hasFiqh) return false;
        if (filterSubjectType === 'entrance' && p.examType !== 'entrance' && p.grade !== 'امتحان ورودی') return false;
      }

      if (filterBook !== 'all') {
        const matchesUsul = p.usulBooks?.some(b => b.includes(filterBook));
        const matchesFiqh = p.fiqhBooks?.some(b => b.includes(filterBook));
        const matchesTitle = p.title.includes(filterBook);
        if (!matchesUsul && !matchesFiqh && !matchesTitle) return false;
      }

      if (filterYear !== 'all') {
        if (p.academicYear && p.academicYear !== filterYear) return false;
      }

      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(term);
        const matchesGrade = p.grade.toLowerCase().includes(term);
        const matchesExaminer = p.examinerTeacherNames?.some(name => name.toLowerCase().includes(term));
        if (!matchesTitle && !matchesGrade && !matchesExaminer) return false;
      }

      return true;
    });
  }, [periods, filterGrade, filterSubjectType, filterBook, filterYear, searchTerm]);

  // Overall Statistics across all history
  const historyStats = useMemo(() => {
    const totalPeriodsCount = periods.length;
    let totalExaminees = 0;
    let totalPassed = 0;
    let totalScoresSum = 0;
    let totalScoresCount = 0;

    Object.values(records).forEach(r => {
      totalExaminees++;
      if (r.overallStatus === 'passed') totalPassed++;
      if (typeof r.fiqhScore === 'number' && !isNaN(r.fiqhScore)) {
        totalScoresSum += r.fiqhScore;
        totalScoresCount++;
      }
      if (typeof r.usulScore === 'number' && !isNaN(r.usulScore)) {
        totalScoresSum += r.usulScore;
        totalScoresCount++;
      }
    });

    const averageScore = totalScoresCount > 0 ? (totalScoresSum / totalScoresCount).toFixed(1) : '-';
    const passRate = totalExaminees > 0 ? Math.round((totalPassed / totalExaminees) * 100) : 0;

    return {
      totalPeriodsCount,
      totalExaminees,
      averageScore,
      passRate
    };
  }, [periods, records]);

  // Records for currently viewing period
  const viewingPeriodRecords = useMemo(() => {
    if (!viewingPeriod) return [];
    return (viewingPeriod.participatingStudentIds || []).map(stId => {
      const rec = records[`${viewingPeriod.id}_${stId}`];
      if (rec) return rec;
      const st = studentsMap.get(stId);
      return {
        id: `${viewingPeriod.id}_${stId}`,
        periodId: viewingPeriod.id,
        studentId: stId,
        studentName: st?.name || 'نامشخص',
        grade: st?.grade || viewingPeriod.grade,
        status: 'draft' as const,
        updatedAt: new Date().toISOString()
      };
    });
  }, [viewingPeriod, records, studentsMap]);

  // -------------------------------------------------------------
  // HANDLER: EDIT RECORD AFTER ARCHIVAL
  // -------------------------------------------------------------
  const handleOpenEditRecord = (rec: OralExamStudentRecord) => {
    setEditingStudentRecord(rec);
    setEditFiqhScore(rec.fiqhScore !== undefined && rec.fiqhScore !== null ? String(rec.fiqhScore) : '');
    setEditUsulScore(rec.usulScore !== undefined && rec.usulScore !== null ? String(rec.usulScore) : '');
    setEditOverallStatus(rec.overallStatus || 'passed');
    setEditNotes(rec.examinerNotes || rec.generalNotes || '');
  };

  const handleSaveEditRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudentRecord) return;

    setIsSavingEdit(true);
    try {
      const fiqhVal = editFiqhScore.trim() !== '' ? Number(editFiqhScore) : null;
      const usulVal = editUsulScore.trim() !== '' ? Number(editUsulScore) : null;

      const updatedRec: OralExamStudentRecord = {
        ...editingStudentRecord,
        fiqhScore: fiqhVal,
        usulScore: usulVal,
        overallStatus: editOverallStatus as any,
        examinerNotes: editNotes.trim() || undefined,
        updatedAt: new Date().toISOString()
      };

      await localDb.saveDoc('oral_exam_records', updatedRec);
      records[updatedRec.id] = updatedRec;
      setEditingStudentRecord(null);
      onRefreshData();
    } catch (err) {
      console.error('Error saving updated oral exam record:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // -------------------------------------------------------------
  // REPORT 1: TEACHERS PARTICIPATION REPORT
  // -------------------------------------------------------------
  const teachersReportData = useMemo(() => {
    const list: {
      teacherName: string;
      periodsCount: number;
      fiqhCount: number;
      usulCount: number;
      totalStudents: number;
      averageScore: string;
      evaluatedStudents: {
        studentName: string;
        grade: string;
        subject: string;
        score: number | string;
        periodTitle: string;
        date: string;
      }[];
    }[] = [];

    const targetNames = selectedTeacherName === 'all' 
      ? examinerNamesList 
      : [selectedTeacherName];

    targetNames.forEach(tName => {
      let fiqhCount = 0;
      let usulCount = 0;
      let scoreSum = 0;
      let scoreCount = 0;
      const periodSet = new Set<string>();
      const studentList: any[] = [];

      Object.values(records).forEach(rec => {
        const period = periods.find(p => p.id === rec.periodId);
        const dateStr = period?.examDate || period?.examDates?.[0] || '-';
        const pTitle = period?.title || 'دوره آزمون';

        if (rec.fiqhExaminerTeacherName === tName) {
          fiqhCount++;
          periodSet.add(rec.periodId);
          if (typeof rec.fiqhScore === 'number' && !isNaN(rec.fiqhScore)) {
            scoreSum += rec.fiqhScore;
            scoreCount++;
          }
          studentList.push({
            studentName: rec.studentName,
            grade: rec.grade || period?.grade || '-',
            subject: 'فقه',
            score: rec.fiqhScore !== null && rec.fiqhScore !== undefined ? rec.fiqhScore : '-',
            periodTitle: pTitle,
            date: dateStr
          });
        }

        if (rec.usulExaminerTeacherName === tName) {
          usulCount++;
          periodSet.add(rec.periodId);
          if (typeof rec.usulScore === 'number' && !isNaN(rec.usulScore)) {
            scoreSum += rec.usulScore;
            scoreCount++;
          }
          studentList.push({
            studentName: rec.studentName,
            grade: rec.grade || period?.grade || '-',
            subject: 'اصول',
            score: rec.usulScore !== null && rec.usulScore !== undefined ? rec.usulScore : '-',
            periodTitle: pTitle,
            date: dateStr
          });
        }
      });

      if (fiqhCount > 0 || usulCount > 0 || selectedTeacherName !== 'all') {
        list.push({
          teacherName: tName,
          periodsCount: periodSet.size,
          fiqhCount,
          usulCount,
          totalStudents: studentList.length,
          averageScore: scoreCount > 0 ? (scoreSum / scoreCount).toFixed(1) : '-',
          evaluatedStudents: studentList
        });
      }
    });

    return list;
  }, [selectedTeacherName, examinerNamesList, records, periods]);

  // Export Teacher Report Word
  const handleExportTeacherReportWord = () => {
    const reportTitle = selectedTeacherName === 'all' 
      ? 'گزارش جامع مشارکت اساتید در امتحانات شفاهی' 
      : `گزارش کارنامه و فعالیت امتحانی ${selectedTeacherName}`;

    const meta = [
      { label: 'استاد انتخابی', value: selectedTeacherName === 'all' ? 'کلیه اساتید ممتحن' : selectedTeacherName },
      { label: 'تاریخ تهیه', value: new Date().toLocaleDateString('fa-IR') }
    ];

    const headers = ['ردیف', 'نام استاد', 'دوره امتحانی', 'نام طلبه', 'پایه', 'درس امتحانی', 'نمره (از ۲۰)', 'تاریخ برگزاری'];
    const rows: any[][] = [];
    let rIdx = 1;

    teachersReportData.forEach(t => {
      t.evaluatedStudents.forEach(st => {
        rows.push([
          rIdx++,
          t.teacherName,
          st.periodTitle,
          st.studentName,
          st.grade,
          st.subject,
          st.score,
          st.date
        ]);
      });
    });

    exportReportWordDoc(reportTitle, meta, headers, rows);
  };

  // -------------------------------------------------------------
  // REPORT 2: BOOKS & COURSES ANALYTICS REPORT
  // -------------------------------------------------------------
  const booksReportData = useMemo(() => {
    const list: {
      bookTitle: string;
      category: string;
      examineesCount: number;
      averageScore: string;
      examiners: string[];
      recordsList: {
        studentName: string;
        grade: string;
        scopeStr: string;
        examinerName: string;
        score: number | string;
        periodTitle: string;
      }[];
    }[] = [];

    const targetBooks = selectedBookName === 'all' 
      ? scopeBooks 
      : scopeBooks.filter(b => b.title === selectedBookName);

    targetBooks.forEach(b => {
      let scoreSum = 0;
      let scoreCount = 0;
      const examinerSet = new Set<string>();
      const recs: any[] = [];

      Object.values(records).forEach(r => {
        const period = periods.find(p => p.id === r.periodId);
        const pTitle = period?.title || 'دوره آزمون';

        // Check fiqh match
        if (r.fiqhBookTitle === b.title || r.fiqhMainScopeTitle?.includes(b.title) || period?.fiqhBooks?.includes(b.title)) {
          if (r.fiqhExaminerTeacherName) examinerSet.add(r.fiqhExaminerTeacherName);
          if (typeof r.fiqhScore === 'number' && !isNaN(r.fiqhScore)) {
            scoreSum += r.fiqhScore;
            scoreCount++;
          }
          recs.push({
            studentName: r.studentName,
            grade: r.grade || period?.grade || '-',
            scopeStr: [r.fiqhMainScopeTitle, r.fiqhSubScopeTitle, r.fiqhPages].filter(Boolean).join(' - ') || '-',
            examinerName: r.fiqhExaminerTeacherName || '-',
            score: r.fiqhScore !== null && r.fiqhScore !== undefined ? r.fiqhScore : '-',
            periodTitle: pTitle
          });
        }

        // Check usul match
        if (r.usulBookTitle === b.title || r.usulMainScopeTitle?.includes(b.title) || period?.usulBooks?.includes(b.title)) {
          if (r.usulExaminerTeacherName) examinerSet.add(r.usulExaminerTeacherName);
          if (typeof r.usulScore === 'number' && !isNaN(r.usulScore)) {
            scoreSum += r.usulScore;
            scoreCount++;
          }
          recs.push({
            studentName: r.studentName,
            grade: r.grade || period?.grade || '-',
            scopeStr: [r.usulMainScopeTitle, r.usulSubScopeTitle, r.usulPages].filter(Boolean).join(' - ') || '-',
            examinerName: r.usulExaminerTeacherName || '-',
            score: r.usulScore !== null && r.usulScore !== undefined ? r.usulScore : '-',
            periodTitle: pTitle
          });
        }
      });

      list.push({
        bookTitle: b.title,
        category: b.category === 'usul' ? 'اصول' : b.category === 'fiqh' ? 'فقه' : 'آزمون ورودی',
        examineesCount: recs.length,
        averageScore: scoreCount > 0 ? (scoreSum / scoreCount).toFixed(1) : '-',
        examiners: Array.from(examinerSet),
        recordsList: recs
      });
    });

    return list;
  }, [selectedBookName, scopeBooks, records, periods]);

  // Export Book Report Word
  const handleExportBookReportWord = () => {
    const reportTitle = selectedBookName === 'all' 
      ? 'گزارش تحلیلی برگزاری امتحانات شفاهی کتب و دروس' 
      : `گزارش امتحانات شفاهی کتاب ${selectedBookName}`;

    const meta = [
      { label: 'کتاب منتخب', value: selectedBookName === 'all' ? 'تمامی کتب حوزه' : selectedBookName },
      { label: 'تاریخ تهیه', value: new Date().toLocaleDateString('fa-IR') }
    ];

    const headers = ['ردیف', 'کتاب', 'عنوان دوره', 'نام طلبه', 'پایه', 'محدوده امتحانی', 'استاد ممتحن', 'نمره'];
    const rows: any[][] = [];
    let rIdx = 1;

    booksReportData.forEach(b => {
      b.recordsList.forEach(rec => {
        rows.push([
          rIdx++,
          b.bookTitle,
          rec.periodTitle,
          rec.studentName,
          rec.grade,
          rec.scopeStr,
          rec.examinerName,
          rec.score
        ]);
      });
    });

    exportReportWordDoc(reportTitle, meta, headers, rows);
  };

  // -------------------------------------------------------------
  // REPORT 3: STUDENT COMPREHENSIVE TRANSCRIPT REPORT
  // -------------------------------------------------------------
  const selectedStudent = useMemo(() => {
    if (!selectedStudentId) return null;
    return studentsMap.get(selectedStudentId) || null;
  }, [selectedStudentId, studentsMap]);

  const studentTranscriptData = useMemo(() => {
    if (!selectedStudentId) return [];

    const examList: {
      periodTitle: string;
      academicYear?: string;
      examDate?: string;
      course: 'فقه' | 'اصول';
      bookTitle?: string;
      scopeStr: string;
      examinerName: string;
      score: number | string;
      status: string;
      notes?: string;
    }[] = [];

    Object.values(records).forEach(r => {
      if (r.studentId === selectedStudentId) {
        const period = periods.find(p => p.id === r.periodId);
        const pTitle = period?.title || 'دوره آزمون';
        const pDate = period?.examDate || period?.examDates?.[0] || '-';
        const pYear = period?.academicYear || '-';

        if (period?.hasFiqh !== false && (r.fiqhScore !== undefined || r.fiqhExaminerTeacherName || r.fiqhMainScopeTitle)) {
          examList.push({
            periodTitle: pTitle,
            academicYear: pYear,
            examDate: pDate,
            course: 'فقه',
            bookTitle: r.fiqhBookTitle || period?.fiqhBooks?.join('، ') || 'مکاسب',
            scopeStr: [r.fiqhMainScopeTitle, r.fiqhSubScopeTitle, r.fiqhPages].filter(Boolean).join(' - ') || 'تعیین نشده',
            examinerName: r.fiqhExaminerTeacherName || '-',
            score: r.fiqhScore !== null && r.fiqhScore !== undefined ? r.fiqhScore : '-',
            status: r.overallStatus === 'passed' ? 'قبول' : r.overallStatus === 'retake' ? 'تجدید / مجدد' : r.overallStatus === 'absent' ? 'غایب' : 'نامشخص',
            notes: r.fiqhExaminerNotes || r.examinerNotes
          });
        }

        if (period?.hasUsul !== false && (r.usulScore !== undefined || r.usulExaminerTeacherName || r.usulMainScopeTitle)) {
          examList.push({
            periodTitle: pTitle,
            academicYear: pYear,
            examDate: pDate,
            course: 'اصول',
            bookTitle: r.usulBookTitle || period?.usulBooks?.join('، ') || 'رسائل / کفایه',
            scopeStr: [r.usulMainScopeTitle, r.usulSubScopeTitle, r.usulPages].filter(Boolean).join(' - ') || 'تعیین نشده',
            examinerName: r.usulExaminerTeacherName || '-',
            score: r.usulScore !== null && r.usulScore !== undefined ? r.usulScore : '-',
            status: r.overallStatus === 'passed' ? 'قبول' : r.overallStatus === 'retake' ? 'تجدید / مجدد' : r.overallStatus === 'absent' ? 'غایب' : 'نامشخص',
            notes: r.usulExaminerNotes || r.examinerNotes
          });
        }
      }
    });

    return examList;
  }, [selectedStudentId, records, periods]);

  // Export Student Transcript Word
  const handleExportStudentTranscriptWord = () => {
    if (!selectedStudent) return;

    const reportTitle = `کارنامه و سوابق امتحانات شفاهی طلبه ${selectedStudent.name}`;
    const meta = [
      { label: 'نام طلبه', value: selectedStudent.name },
      { label: 'پایه تحصیلی', value: selectedStudent.grade || '-' },
      { label: 'کد ملی', value: selectedStudent.nationalId || '-' },
      { label: 'شماره همراه', value: selectedStudent.phone || '-' }
    ];

    const headers = ['ردیف', 'عنوان دوره آزمون', 'سال تحصیلی', 'تاریخ', 'درس', 'کتاب', 'محدوده امتحانی', 'استاد ممتحن', 'نمره', 'وضعیت'];
    const rows = studentTranscriptData.map((e, idx) => [
      idx + 1,
      e.periodTitle,
      e.academicYear || '-',
      e.examDate || '-',
      e.course,
      e.bookTitle || '-',
      e.scopeStr,
      e.examinerName,
      e.score,
      e.status
    ]);

    exportReportWordDoc(reportTitle, meta, headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-indigo-950 border border-sky-900/40 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        {/* Ambient background glows */}
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 text-xs font-extrabold backdrop-blur-md">
              <Archive size={14} className="text-sky-300" />
              <span>آرشیو جامع سوابق، نتایج و تحلیل امتحانات</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              سوابق و گزارش‌های امتحانات شفاهی
            </h2>
            <p className="text-sky-100/80 text-xs sm:text-sm max-w-2xl leading-relaxed">
              مشاهده سابقه دوره‌های امتحانی گذشته با امکان فیلتر بر اساس پایه، اصول، فقه، آزمون ورودی، نوع کتاب و گزارش‌گیری تخصصی بر اساس عملکرد اساتید، دروس یا کارنامه طلبه.
            </p>
          </div>

          {/* Tab Switcher: List vs Reports */}
          <div className="flex items-center gap-1.5 p-1.5 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl shrink-0">
            <button
              onClick={() => setActiveTab('list')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-2",
                activeTab === 'list' 
                  ? "bg-white text-slate-900 shadow-md scale-[1.02]" 
                  : "text-slate-200 hover:text-white hover:bg-white/10"
              )}
            >
              <FileText size={15} className={activeTab === 'list' ? "text-sky-600" : "text-sky-300"} />
              <span>فهرست سوابق و دوره‌ها</span>
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-2",
                activeTab === 'reports' 
                  ? "bg-white text-slate-900 shadow-md scale-[1.02]" 
                  : "text-slate-200 hover:text-white hover:bg-white/10"
              )}
            >
              <TrendingUp size={15} className={activeTab === 'reports' ? "text-emerald-600" : "text-emerald-300"} />
              <span>گزارش‌گیری و تحلیل پیشرفته</span>
            </button>
          </div>
        </div>

        {/* Minimal Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-sky-800/50 text-xs">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/5">
            <span className="text-sky-200/80 block mb-1 font-medium">کل دوره‌های ثبت‌شده</span>
            <span className="text-xl font-black text-white">{historyStats.totalPeriodsCount} <span className="text-xs font-normal opacity-80">دوره</span></span>
          </div>
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/5">
            <span className="text-sky-200/80 block mb-1 font-medium">تعداد کل طلاب آزموده</span>
            <span className="text-xl font-black text-sky-300">{historyStats.totalExaminees} <span className="text-xs font-normal opacity-80">نفر·آزمون</span></span>
          </div>
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/5">
            <span className="text-sky-200/80 block mb-1 font-medium">میانگین نمرات شفاهی</span>
            <span className="text-xl font-black text-emerald-300">{historyStats.averageScore} <span className="text-xs font-normal opacity-80">از ۲۰</span></span>
          </div>
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/5">
            <span className="text-sky-200/80 block mb-1 font-medium">درصد قبولی کلی</span>
            <span className="text-xl font-black text-amber-300">{historyStats.passRate}%</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: LIST OF PERIODS & PAST RECORDS                                     */}
      {/* ========================================================================= */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="جستجو در عنوان دوره، پایه یا نام استاد ممتحن..."
                className="w-full pl-4 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-800"
              />
            </div>

            {/* Grade Filter */}
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium cursor-pointer"
            >
              <option value="all">همه پایه‌ها</option>
              <option value="پایه ۷">پایه ۷</option>
              <option value="پایه ۸">پایه ۸</option>
              <option value="پایه ۹">پایه ۹</option>
              <option value="پایه ۱۰">پایه ۱۰</option>
              <option value="امتحان ورودی">آزمون ورودی</option>
              <option value="کل پایه‌ها">ترکیبی / کل پایه‌ها</option>
            </select>

            {/* Subject Type Filter */}
            <select
              value={filterSubjectType}
              onChange={(e) => setFilterSubjectType(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium cursor-pointer"
            >
              <option value="all">همه موضوعات</option>
              <option value="usul">دارای درس اصول</option>
              <option value="fiqh">دارای درس فقه</option>
              <option value="entrance">آزمون ورودی</option>
            </select>

            {/* Book Filter */}
            <select
              value={filterBook}
              onChange={(e) => setFilterBook(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium cursor-pointer"
            >
              <option value="all">همه کتب و دروس</option>
              <option value="کفایه">کفایه</option>
              <option value="رسائل">رسائل</option>
              <option value="مکاسب">مکاسب</option>
              <option value="حلقه ثالثه">حلقه ثالثه</option>
              <option value="حلقه ثانیه">حلقه ثانیه</option>
              <option value="مظفر">اصول مرحوم مظفر</option>
              <option value="لمعه">لمعه</option>
            </select>

            {/* Academic Year Filter */}
            {availableYears.length > 0 && (
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium cursor-pointer"
              >
                <option value="all">همه سال‌های تحصیلی</option>
                {availableYears.map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            )}

            {(filterGrade !== 'all' || filterSubjectType !== 'all' || filterBook !== 'all' || filterYear !== 'all' || searchTerm) && (
              <button
                onClick={() => {
                  setFilterGrade('all');
                  setFilterSubjectType('all');
                  setFilterBook('all');
                  setFilterYear('all');
                  setSearchTerm('');
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold px-2 py-1"
              >
                حذف فیلترها
              </button>
            )}
          </div>

          {/* Periods Cards List */}
          {filteredPeriods.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <Archive size={40} className="text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-700 text-sm">هیچ سابقه یا دوره‌ای با فیلترهای مشخص‌شده یافت نشد.</h3>
              <p className="text-slate-400 text-xs mt-1">جهت ایجاد دوره جدید، به تب «ایجاد امتحان شفاهی» مراجعه فرمایید.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPeriods.map((period) => {
                const examineesCount = period.participatingStudentIds?.length || 0;
                const isArchived = period.status === 'archived' || period.status === 'finalized';
                const dateStr = period.examDate || period.examDates?.[0] || 'تاریخ نامشخص';

                return (
                  <div
                    key={period.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
                  >
                    <div>
                      {/* Top Row: Date & Status */}
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar size={12} />
                          <span>{dateStr}</span>
                        </span>
                        <span className={cn(
                          "font-bold text-[11px]",
                          isArchived ? "text-emerald-700" : "text-amber-700"
                        )}>
                          {isArchived ? 'بایگانی‌شده' : 'در حال انجام / پیش‌نویس'}
                        </span>
                      </div>

                      {/* Period Title */}
                      <h3 className="font-extrabold text-base text-slate-900 leading-snug">
                        {period.title}
                      </h3>

                      {/* Meta Line */}
                      <div className="text-xs text-slate-500 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>{period.grade}</span>
                        {period.academicYear && <span>· سال {period.academicYear}</span>}
                        <span>· {examineesCount} طلبه</span>
                      </div>

                      {/* Books info */}
                      <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                        {period.hasFiqh && (
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-bold text-amber-800">فقه:</span>
                            <span className="truncate">{period.fiqhBooks?.join('، ') || 'مکاسب'}</span>
                          </div>
                        )}
                        {period.hasUsul && (
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-bold text-indigo-800">اصول:</span>
                            <span className="truncate">{period.usulBooks?.join('، ') || 'رسائل / کفایه'}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setViewingPeriod(period)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye size={14} />
                        <span>مشاهده و ویرایش نمرات</span>
                      </button>

                      <button
                        onClick={() => {
                          const pRecords = (period.participatingStudentIds || []).map(id => records[`${period.id}_${id}`]).filter(Boolean);
                          exportPeriodResultsExcel(period, pRecords);
                        }}
                        className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all"
                        title="خروجی فایل اکسل صورتجلسه دوره"
                      >
                        <FileSpreadsheet size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ADVANCED REPORTS (اساتید، کتب، طلاب)                                */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Sub-Tabs for Reports */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                onClick={() => setReportType('teachers')}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  reportType === 'teachers' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <UserCheck size={14} />
                <span>۱. گزارش مشارکت و اساتید</span>
              </button>
              <button
                onClick={() => setReportType('books')}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  reportType === 'books' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <BookOpen size={14} />
                <span>۲. گزارش تحلیلی کتب و دروس</span>
              </button>
              <button
                onClick={() => setReportType('students')}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  reportType === 'students' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <User size={14} />
                <span>۳. کارنامه و سوابق اختصاصی طلبه</span>
              </button>
            </div>

            {/* Quick Export Word for Current Report */}
            <div>
              {reportType === 'teachers' && (
                <button
                  onClick={handleExportTeacherReportWord}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Download size={14} />
                  <span>خروجی ورد رسمی (Word)</span>
                </button>
              )}
              {reportType === 'books' && (
                <button
                  onClick={handleExportBookReportWord}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Download size={14} />
                  <span>خروجی ورد رسمی (Word)</span>
                </button>
              )}
              {reportType === 'students' && selectedStudent && (
                <button
                  onClick={handleExportStudentTranscriptWord}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Download size={14} />
                  <span>خروجی کارنامه ورد (Word)</span>
                </button>
              )}
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* REPORT 1: TEACHER REPORT CONTENT                              */}
          {/* ------------------------------------------------------------- */}
          {reportType === 'teachers' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    گزارش مشارکت اساتید و سرفصل‌های ممتحن
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    بررسی اینکه هر استاد در چه امتحان‌های شفاهی مشارکت داشته، چه دروسی را آزمون گرفته و میانگین نمرات.
                  </p>
                </div>

                <div className="w-full sm:w-64">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">فیلتر استاد ممتحن:</label>
                  <select
                    value={selectedTeacherName}
                    onChange={(e) => setSelectedTeacherName(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium cursor-pointer"
                  >
                    <option value="all">نمایش کلیه اساتید ممتحن</option>
                    {examinerNamesList.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {teachersReportData.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-xs">
                  هیچ داده‌ای برای این استاد ثبت نشده است.
                </div>
              ) : (
                <div className="space-y-6">
                  {teachersReportData.map(t => (
                    <div key={t.teacherName} className="border border-slate-200 rounded-2xl overflow-hidden">
                      {/* Teacher Summary Header */}
                      <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <UserCheck size={18} className="text-emerald-600" />
                          <h4 className="font-extrabold text-sm text-slate-900">{t.teacherName}</h4>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-600">
                          <span>{t.periodsCount} دوره</span>
                          <span>·</span>
                          <span>{t.fiqhCount} آزمون فقه</span>
                          <span>·</span>
                          <span>{t.usulCount} آزمون اصول</span>
                          <span>·</span>
                          <span className="font-bold text-slate-900">میانگین: {t.averageScore}</span>
                        </div>
                      </div>

                      {/* Evaluated Students Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3 w-10 text-center">ردیف</th>
                              <th className="py-2.5 px-3">نام طلبه</th>
                              <th className="py-2.5 px-3">پایه</th>
                              <th className="py-2.5 px-3">عنوان دوره</th>
                              <th className="py-2.5 px-3">درس</th>
                              <th className="py-2.5 px-3 text-center">نمره (از ۲۰)</th>
                              <th className="py-2.5 px-3 text-center">تاریخ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {t.evaluatedStudents.map((st, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="py-2 px-3 text-center text-slate-400">{idx + 1}</td>
                                <td className="py-2 px-3 font-bold text-slate-800">{st.studentName}</td>
                                <td className="py-2 px-3 text-slate-500">{st.grade}</td>
                                <td className="py-2 px-3 text-slate-600">{st.periodTitle}</td>
                                <td className="py-2 px-3 font-medium">
                                  {st.subject === 'فقه' ? <span className="text-amber-800 font-bold">فقه</span> : <span className="text-indigo-800 font-bold">اصول</span>}
                                </td>
                                <td className="py-2 px-3 text-center font-bold text-slate-900">{st.score}</td>
                                <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">{st.date}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* REPORT 2: BOOKS REPORT CONTENT                                */}
          {/* ------------------------------------------------------------- */}
          {reportType === 'books' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    گزارش تفصیلی کتب و دروس امتحانی
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    بررسی کلیه امتحان‌های شفاهی برگزار شده برای هر کتاب، ممتحنین و میانگین نمرات طلاب.
                  </p>
                </div>

                <div className="w-full sm:w-64">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">فیلتر کتاب / درس:</label>
                  <select
                    value={selectedBookName}
                    onChange={(e) => setSelectedBookName(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium cursor-pointer"
                  >
                    <option value="all">نمایش کلیه کتب</option>
                    {scopeBooks.map(b => (
                      <option key={b.id} value={b.title}>{b.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-6">
                {booksReportData.map(b => (
                  <div key={b.bookTitle} className="border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <BookOpen size={18} className="text-indigo-600" />
                        <h4 className="font-extrabold text-sm text-slate-900">{b.bookTitle}</h4>
                        <span className="text-xs text-slate-400">({b.category})</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-600">
                        <span>{b.examineesCount} طلبه آزموده</span>
                        <span>·</span>
                        <span className="font-bold text-slate-900">میانگین نمره: {b.averageScore}</span>
                      </div>
                    </div>

                    {b.recordsList.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-xs">
                        هنوز هیچ آزمونی برای این کتاب ثبت نهایی نشده است.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3 w-10 text-center">ردیف</th>
                              <th className="py-2.5 px-3">نام طلبه</th>
                              <th className="py-2.5 px-3">پایه</th>
                              <th className="py-2.5 px-3">محدوده امتحانی</th>
                              <th className="py-2.5 px-3">استاد ممتحن</th>
                              <th className="py-2.5 px-3 text-center">نمره</th>
                              <th className="py-2.5 px-3">دوره</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {b.recordsList.map((rec, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="py-2 px-3 text-center text-slate-400">{idx + 1}</td>
                                <td className="py-2 px-3 font-bold text-slate-800">{rec.studentName}</td>
                                <td className="py-2 px-3 text-slate-500">{rec.grade}</td>
                                <td className="py-2 px-3 text-slate-700 max-w-[200px] truncate">{rec.scopeStr}</td>
                                <td className="py-2 px-3 font-medium text-slate-800">{rec.examinerName}</td>
                                <td className="py-2 px-3 text-center font-bold text-slate-900">{rec.score}</td>
                                <td className="py-2 px-3 text-slate-500">{rec.periodTitle}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* REPORT 3: STUDENT COMPREHENSIVE TRANSCRIPT                     */}
          {/* ------------------------------------------------------------- */}
          {reportType === 'students' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    کارنامه جامع سوابق امتحان شفاهی طلبه
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    مشاهده تمامی امتحانات شفاهی که طلبه از ابتدای تحصیل یا در بازه زمانی شرکت کرده و نمرات مکسوبه.
                  </p>
                </div>

                <div className="w-full sm:w-80">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">جستجو و انتخاب طلبه:</label>
                  <input
                    type="text"
                    value={studentSearchInput}
                    onChange={(e) => setStudentSearchInput(e.target.value)}
                    placeholder="نام یا کد ملی طلبه را تایپ کنید..."
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-800"
                  />
                  {studentSearchInput && (
                    <div className="mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100 z-20">
                      {students.filter(s => s.name.includes(studentSearchInput) || (s.nationalId && s.nationalId.includes(studentSearchInput))).slice(0, 10).map(s => (
                        <div
                          key={s.id}
                          onClick={() => {
                            setSelectedStudentId(s.id);
                            setStudentSearchInput('');
                          }}
                          className="p-2 text-xs hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                        >
                          <span className="font-bold text-slate-800">{s.name}</span>
                          <span className="text-slate-400">{s.grade}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {!selectedStudent ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  لطفاً با استفاده از کادر جستجوی بالا، نام طلبه مورد نظر را جستجو و انتخاب فرمایید.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Student Header Card */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center font-bold text-slate-700">
                        {selectedStudent.name[0]}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900">{selectedStudent.name}</h4>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                          <span>{selectedStudent.grade}</span>
                          <span>·</span>
                          <span>کد ملی: {selectedStudent.nationalId || '-'}</span>
                          <span>·</span>
                          <span>تلفن: {selectedStudent.phone || '-'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 font-medium">
                      تعداد کل آزمون‌های شفاهی: <b className="text-slate-900 text-sm">{studentTranscriptData.length}</b> مورد
                    </div>
                  </div>

                  {/* Transcript Records Table */}
                  {studentTranscriptData.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-xl text-slate-400 text-xs">
                      هیچ سابقه امتحان شفاهی‌ای برای این طلبه در دیتابیس ثبت نشده است.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3 w-10 text-center">ردیف</th>
                            <th className="py-2.5 px-3">عنوان دوره آزمون</th>
                            <th className="py-2.5 px-3">درس</th>
                            <th className="py-2.5 px-3">کتاب و محدوده دقیق</th>
                            <th className="py-2.5 px-3">استاد ممتحن</th>
                            <th className="py-2.5 px-3 text-center">نمره</th>
                            <th className="py-2.5 px-3 text-center">وضعیت</th>
                            <th className="py-2.5 px-3">توضیحات ممتحن</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {studentTranscriptData.map((e, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 text-center text-slate-400">{idx + 1}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-800">
                                <div>{e.periodTitle}</div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{e.examDate}</div>
                              </td>
                              <td className="py-2.5 px-3">
                                {e.course === 'فقه' ? <span className="text-amber-800 font-bold">فقه</span> : <span className="text-indigo-800 font-bold">اصول</span>}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-800">{e.bookTitle}</div>
                                <div className="text-[11px] text-slate-500 mt-0.5">{e.scopeStr}</div>
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-800">{e.examinerName}</td>
                              <td className="py-2.5 px-3 text-center font-black text-slate-900 text-sm">
                                {e.score}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={cn(
                                  "font-bold text-[11px]",
                                  e.status === 'قبول' ? "text-emerald-700" : "text-rose-600"
                                )}>
                                  {e.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 max-w-[180px] truncate">
                                {e.notes || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VIEW PERIOD & EDIT RESULTS AFTER ARCHIVAL                           */}
      {/* ========================================================================= */}
      {viewingPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  {viewingPeriod.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  پایه: {viewingPeriod.grade} · تاریخ: {viewingPeriod.examDate || viewingPeriod.examDates?.[0] || '-'} · سال تحصیلی: {viewingPeriod.academicYear || '-'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportPeriodResultsExcel(viewingPeriod, viewingPeriodRecords)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet size={14} />
                  <span>اکسل صورتجلسه</span>
                </button>
                <button
                  onClick={() => setViewingPeriod(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body: Table of Records */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3 w-10 text-center">ردیف</th>
                      <th className="py-3 px-3">نام طلبه</th>
                      <th className="py-3 px-3">ساعت</th>
                      {viewingPeriod.hasFiqh && (
                        <>
                          <th className="py-3 px-3 bg-amber-50/60 text-amber-900">محدوده و ممتحن فقه</th>
                          <th className="py-3 px-3 bg-amber-50/60 text-amber-900 text-center">نمره فقه</th>
                        </>
                      )}
                      {viewingPeriod.hasUsul && (
                        <>
                          <th className="py-3 px-3 bg-indigo-50/60 text-indigo-900">محدوده و ممتحن اصول</th>
                          <th className="py-3 px-3 bg-indigo-50/60 text-indigo-900 text-center">نمره اصول</th>
                        </>
                      )}
                      <th className="py-3 px-3 text-center">وضعیت</th>
                      <th className="py-3 px-3 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingPeriodRecords.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400">
                          هیچ رکوردی برای این دوره ثبت نشده است.
                        </td>
                      </tr>
                    ) : (
                      viewingPeriodRecords.map((rec, idx) => (
                        <tr key={rec.id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-3 text-center text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-3 font-bold text-slate-900">{rec.studentName}</td>
                          <td className="py-3 px-3 font-mono text-slate-600 text-[11px]">{rec.examTime || '-'}</td>
                          
                          {/* Fiqh */}
                          {viewingPeriod.hasFiqh && (
                            <>
                              <td className="py-3 px-3 bg-amber-50/30">
                                <div className="text-slate-800 font-medium">{rec.fiqhExaminerTeacherName || 'استاد تعیین نشده'}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[150px]">
                                  {[rec.fiqhMainScopeTitle, rec.fiqhSubScopeTitle].filter(Boolean).join(' - ') || '-'}
                                </div>
                              </td>
                              <td className="py-3 px-3 bg-amber-50/30 text-center font-bold text-slate-900">
                                {rec.fiqhScore !== null && rec.fiqhScore !== undefined ? rec.fiqhScore : '-'}
                              </td>
                            </>
                          )}

                          {/* Usul */}
                          {viewingPeriod.hasUsul && (
                            <>
                              <td className="py-3 px-3 bg-indigo-50/30">
                                <div className="text-slate-800 font-medium">{rec.usulExaminerTeacherName || 'استاد تعیین نشده'}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[150px]">
                                  {[rec.usulMainScopeTitle, rec.usulSubScopeTitle].filter(Boolean).join(' - ') || '-'}
                                </div>
                              </td>
                              <td className="py-3 px-3 bg-indigo-50/30 text-center font-bold text-slate-900">
                                {rec.usulScore !== null && rec.usulScore !== undefined ? rec.usulScore : '-'}
                              </td>
                            </>
                          )}

                          {/* Status */}
                          <td className="py-3 px-3 text-center">
                            <span className={cn(
                              "font-bold text-[11px]",
                              rec.overallStatus === 'passed' ? "text-emerald-700" :
                              rec.overallStatus === 'retake' ? "text-rose-600" :
                              rec.overallStatus === 'absent' ? "text-slate-400" : "text-amber-700"
                            )}>
                              {rec.overallStatus === 'passed' ? 'قبول' : rec.overallStatus === 'retake' ? 'تجدید' : rec.overallStatus === 'absent' ? 'غایب' : 'در جریان'}
                            </span>
                          </td>

                          {/* Edit Action Button */}
                          <td className="py-3 px-3 text-center">
                            {canEdit && (
                              <button
                                onClick={() => handleOpenEditRecord(rec)}
                                className="px-2.5 py-1 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 mx-auto cursor-pointer"
                              >
                                <Edit3 size={12} />
                                <span>ویرایش نتیجه</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SUB-MODAL: EDIT STUDENT RECORD RESULT                          */}
      {/* ------------------------------------------------------------- */}
      {editingStudentRecord && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="font-bold text-base text-slate-900">
                ویرایش نتیجه امتحان «{editingStudentRecord.studentName}»
              </h4>
              <button
                onClick={() => setEditingStudentRecord(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditRecord} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">نمره فقه (از ۲۰)</label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    step="0.25"
                    value={editFiqhScore}
                    onChange={(e) => setEditFiqhScore(e.target.value)}
                    placeholder="مثلاً ۱۷.۵"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800 font-mono text-left font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">نمره اصول (از ۲۰)</label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    step="0.25"
                    value={editUsulScore}
                    onChange={(e) => setEditUsulScore(e.target.value)}
                    placeholder="مثلاً ۱۸"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800 font-mono text-left font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">وضعیت کلی آزمون</label>
                <select
                  value={editOverallStatus}
                  onChange={(e) => setEditOverallStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800 font-medium"
                >
                  <option value="passed">قبول</option>
                  <option value="retake">تجدید / نیاز به آزمون مجدد</option>
                  <option value="absent">غایب در جلسه</option>
                  <option value="pending">در جریان بررسی</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">توضیحات و نظر استاد ممتحن</label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="ثبت نقاط ضعف، تسلط یا علت تجدید..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStudentRecord(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold"
                >
                  {isSavingEdit ? 'در حال ذخیره...' : 'ذخیره تغییرات نتیجه'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
