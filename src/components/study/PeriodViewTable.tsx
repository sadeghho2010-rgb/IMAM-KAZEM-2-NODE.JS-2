import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  BookOpen, 
  MessageSquare, 
  Calculator, 
  ArrowUpRight, 
  ArrowDownRight, 
  SlidersHorizontal, 
  ChevronDown, 
  Eye, 
  EyeOff, 
  Search, 
  Check, 
  Info,
  Clock,
  Layers,
  Filter,
  AlertCircle,
  Copy,
  ShieldCheck,
  Shield,
  Download,
  AlertTriangle,
  FileSpreadsheet,
  ListFilter,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Student, StudyPeriod, PeriodicStudyLog, Todo, WorkflowItem, Program, Enrollment } from '../../types';
import { getLogMetrics, calculatePeriodAverages, isStudentExempt, getStudyWarningStatus, StudyWarningStatus } from './studyUtils';
import { localDb } from '../../lib/localDb';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

export type TableDisplayMode = 
  | 'ALL_SPLIT'            // تفکیک دروس اصلی + آزاد + مجموع
  | 'AGGREGATED_TOTALS'    // مجموع دروس اصلی + مجموع آزاد + مجموع کل
  | 'TOTAL_ONLY'           // فقط مجموع کل
  | 'STUDY_ONLY'           // فقط مطالعه
  | 'DISCUSSION_ONLY';     // فقط مباحثه

export type WarningFilterType = 
  | 'ALL' 
  | 'COMMENDED_ONLY'       // افراد بالای موظفی‌ها و شایسته تشویق (رعایت حداقل اصلی و حداقل کل)
  | 'WARNINGS_ONLY' 
  | 'CORE_DEFICIT_ONLY' 
  | 'TOTAL_DEFICIT_ONLY' 
  | 'NO_WARNING';

export interface PeriodColumnsVisibility {
  grade: boolean;
  needsFollowUp: boolean;
  individualExempt: boolean;
  warningNotice: boolean;
  warningStatus: boolean;
  coreStudyMinutes: boolean;
  coreDiscussionMinutes: boolean;
  coreTotalMinutes: boolean;
  freeStudyMinutes: boolean;
  totalMinutes: boolean;
  diffMandatory: boolean;
  diffCoreMandatory: boolean;
  diffAvg: boolean;
  statusMandatory: boolean;
}

interface PeriodViewTableProps {
  period: StudyPeriod;
  students: Student[];
  allLogs: PeriodicStudyLog[];
  selectedStudentId: string | null;
  onSelectStudent: (studentId: string) => void;
  onUpdateFollowUp?: (studentId: string, currentStatus?: string) => void;
}

export default function PeriodViewTable({
  period,
  students,
  allLogs,
  selectedStudentId,
  onSelectStudent
}: PeriodViewTableProps) {
  const { currentUser } = useAuth();
  const isLevel2User = currentUser?.level === 1 || currentUser?.level === 2;
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  const handleCopyPhone = (studentName: string, phone: string, studentId: string) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone.trim());
    setCopiedPhoneId(studentId);
    setTimeout(() => setCopiedPhoneId(null), 2000);
  };

  const [displayMode, setDisplayMode] = useState<TableDisplayMode>('ALL_SPLIT');
  const [warningFilter, setWarningFilter] = useState<WarningFilterType>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  useEffect(() => {
    const loadAcademicData = async () => {
      try {
        const [progs, enr] = await Promise.all([
          localDb.getDocs<Program>('programs'),
          localDb.getDocs<Enrollment>('enrollments')
        ]);
        setPrograms(progs || []);
        setEnrollments(enr || []);
      } catch (e) {
        console.error('Error loading programs/enrollments in PeriodViewTable:', e);
      }
    };
    loadAcademicData();
  }, []);

  const [cols, setCols] = useState<PeriodColumnsVisibility>({
    grade: true,
    needsFollowUp: true,
    individualExempt: true,
    warningNotice: true,
    warningStatus: true,
    coreStudyMinutes: true,
    coreDiscussionMinutes: true,
    coreTotalMinutes: true,
    freeStudyMinutes: true,
    totalMinutes: true,
    diffMandatory: true,
    diffCoreMandatory: true,
    diffAvg: true,
    statusMandatory: true
  });

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [workflowItems, setWorkflowItems] = useState<WorkflowItem[]>([]);

  // Toggle individual student exemption (For Grade Supervisor & Education Officer)
  const handleToggleIndividualExempt = async (studentId: string) => {
    try {
      const currentExemptIds = period.exemptStudentIds || [];
      const isExempt = currentExemptIds.includes(studentId);
      const updated = isExempt
        ? currentExemptIds.filter(id => id !== studentId)
        : [...currentExemptIds, studentId];

      await localDb.updateDoc('study_periods', period.id, {
        exemptStudentIds: updated,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error toggling student exemption:", err);
      alert("خطا در تغییر وضعیت معافیت موردی طلبه");
    }
  };

  // Batch toggle exemption for selected students
  const handleBatchExempt = async (setExempt: boolean) => {
    if (selectedStudentIds.length === 0) return;
    try {
      const currentExemptIds = new Set(period.exemptStudentIds || []);
      selectedStudentIds.forEach(id => {
        if (setExempt) {
          currentExemptIds.add(id);
        } else {
          currentExemptIds.delete(id);
        }
      });

      await localDb.updateDoc('study_periods', period.id, {
        exemptStudentIds: Array.from(currentExemptIds),
        updatedAt: new Date().toISOString()
      });
      setSelectedStudentIds([]);
      alert(setExempt ? 'معافیت موردی طلاب با موفقیت ثبت شد.' : 'معافیت موردی طلاب لغو گردید.');
    } catch (err) {
      console.error("Error batch exempting students:", err);
      alert("خطا در بروزرسانی معافیت گروهی طلاب");
    }
  };

  useEffect(() => {
    const fetchTodosAndWorkflows = async () => {
      try {
        const [todoList, wfList] = await Promise.all([
          localDb.getDocs<Todo>('todos'),
          localDb.getDocs<WorkflowItem>('workflow_items')
        ]);
        setTodos(todoList || []);
        setWorkflowItems(wfList || []);
      } catch (e) {
        console.error("Error loading todos or workflow items:", e);
      }
    };
    fetchTodosAndWorkflows();
    const unsub = localDb.subscribe(() => {
      fetchTodosAndWorkflows();
    });
    return () => unsub();
  }, []);

  const handleRegisterWarning = async (student: Student, warningStatus: StudyWarningStatus) => {
    try {
      const existingWf = workflowItems.find(w => 
        w.category === 'study_deficit_warning' && 
        w.studentId === student.id && 
        (w.details?.periodId === period.id || w.title?.includes(period.title))
      );

      if (existingWf) {
        alert(`ثبت اخطار برای ${student.name} قبلاً انجام شده و در وضعیت «${
          existingWf.status === 'approved' ? 'ثبت قطعی' :
          existingWf.status === 'pending' ? 'در انتظار تایید' : 'رد اخطار'
        }» می‌باشد.`);
        return;
      }

      let descText = `طلبه ${student.name} (${student.grade || 'پایه نامشخص'}) در دوره مطالعاتی «${period.title}»: `;
      if (warningStatus.warningType === 'deficit_both') {
        descText += `دارای ${warningStatus.coreDeficitMinutes.toLocaleString('fa-IR')} دقیقه کسری دروس اصلی (حداقل موظفی ${warningStatus.mandatoryCoreMinutes}د) و ${warningStatus.totalDeficitMinutes.toLocaleString('fa-IR')} دقیقه کسری موظفی کل (موظفی ${warningStatus.mandatoryTotalMinutes}د) می‌باشد. مستحق اخطار دوگانه.`;
      } else if (warningStatus.warningType === 'deficit_core_only') {
        descText += `دارای ${warningStatus.coreDeficitMinutes.toLocaleString('fa-IR')} دقیقه کسری از حداقل مطالعه و مباحثه دروس اصلی (${warningStatus.mandatoryCoreMinutes} دقیقه) می‌باشد؛ اگرچه ممکن است مجموع کل با مطالعه آزاد تکمیل شده باشد، طبق ضوابط مجاز نبوده و مستحق اخطار است.`;
      } else {
        descText += `دارای ${warningStatus.totalDeficitMinutes.toLocaleString('fa-IR')} دقیقه کسری از موظفی کل دوره (${warningStatus.mandatoryTotalMinutes} دقیقه) می‌باشد. مستحق اخطار کسری مطالعه.`;
      }

      const newWfItem: WorkflowItem = {
        id: `wf_warning_${Date.now()}_${student.id}`,
        type: 'approval',
        category: 'study_deficit_warning',
        title: `اخطار کسری مطالعه: ${student.name} - ${period.title}`,
        description: descText,
        status: 'pending',
        grade: student.grade || 'همه پایه‌ها',
        studentId: student.id,
        studentName: student.name,
        nationalId: student.nationalId,
        requiresEducationApproval: true,
        details: {
          periodId: period.id,
          periodTitle: period.title,
          deficitMinutes: warningStatus.totalDeficitMinutes || warningStatus.coreDeficitMinutes,
          coreDeficitMinutes: warningStatus.coreDeficitMinutes,
          totalDeficitMinutes: warningStatus.totalDeficitMinutes,
          warningType: warningStatus.warningType,
          mandatoryTotalMinutes: warningStatus.mandatoryTotalMinutes,
          mandatoryCoreMinutes: warningStatus.mandatoryCoreMinutes,
          mandatoryHours: period.mandatoryHours || 0
        },
        createdAt: new Date().toISOString()
      };

      await localDb.addDoc('workflow_items', newWfItem);
      alert(`درخواست صدور ${warningStatus.shortBadge} برای ${student.name} جهت تایید به بخش «جریان کار» ارسال گردید.`);
    } catch (err) {
      console.error("Error registering warning workflow item:", err);
      alert("خطا در ثبت اخطار در جریان کار");
    }
  };

  const handleToggleFollowUp = async (student: Student, activeTodo?: Todo) => {
    try {
      if (activeTodo) {
        // Mark as completed so it leaves active follow-ups list
        await localDb.updateDoc('todos', activeTodo.id, { completed: true });
      } else {
        // Check for an existing completed todo to re-enable or create new
        const existingCompleted = todos.find(t => 
          t.studentId === student.id && 
          t.completed && 
          (t.isStudyFollowUp || (t.title && t.title.includes('[پیگیری مطالعه]'))) && 
          (t.periodId === period.id || (t.title && t.title.includes(period.title)))
        );

        if (existingCompleted) {
          await localDb.updateDoc('todos', existingCompleted.id, { completed: false });
        } else {
          await localDb.addDoc('todos', {
            title: `[پیگیری مطالعه] ${student.name} - ${period.title}`,
            studentId: student.id,
            completed: false,
            isStudyFollowUp: true,
            periodId: period.id,
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (e) {
      console.error("Error toggling follow-up todo:", e);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const mandatoryTotalMinutes = period.mandatoryMinutes || Math.round((period.mandatoryHours || 0) * 60);
  const mandatoryCoreMinutes = period.mandatoryCoreMinutes ?? Math.round(mandatoryTotalMinutes * 0.75);
  const periodLogs = allLogs.filter(l => l.periodId === period.id);

  // Overall Period Averages
  const overallAvg = calculatePeriodAverages(period.id, allLogs);

  // Unique grades for filter
  const uniqueGrades = Array.from(new Set(students.map(s => s.grade).filter(Boolean))) as string[];

  // Helper to map student to their main enrolled courses
  const getStudentCourses = (studentId: string, studentGrade?: string) => {
    const enrolledProgIds = new Set(
      enrollments.filter(e => e.studentId === studentId && (e.status === 'enrolled' || !e.status)).map(e => e.programId)
    );
    let myCourses = programs.filter(p => enrolledProgIds.has(p.id));
    if (myCourses.length === 0 && studentGrade) {
      myCourses = programs.filter(p => p.grade === studentGrade);
    }
    return myCourses.filter(p => {
      if (p.type && p.type !== 'اصلی') return false;
      const typeStr = (p.type || '').trim();
      const titleStr = (p.title || '').trim();
      const isExcluded = ['مشاوره', 'پژوهش', 'دروس 5 شنبه', 'دروس ۵ شنبه', 'دروس پنج شنبه', 'دروس پنج‌شنبه', 'پنج شنبه', 'پنج‌شنبه', 'سایر'].some(k => typeStr.includes(k) || titleStr.includes(k));
      if (isExcluded) return false;
      return p.type === 'اصلی' || !p.type;
    });
  };

  // Precompute row data with warning statuses for filtering and rendering
  const studentRows = useMemo(() => {
    return students.map(student => {
      const log = periodLogs.find(l => l.studentId === student.id);
      const metrics = getLogMetrics(log);
      const warningStatus = getStudyWarningStatus(period, log, student);
      const studentCourses = getStudentCourses(student.id, student.grade);

      const isStudentIndividuallyExempt = (period.exemptStudentIds || []).includes(student.id);
      const isGradeExempt = (period.exemptGrades || []).includes(student.grade || '');
      const isAnyExempt = isStudentIndividuallyExempt || isGradeExempt;

      // Grade-peer averages
      const gradeStudents = students.filter(s => s.grade === student.grade);
      const gradeAvg = calculatePeriodAverages(period.id, allLogs, gradeStudents.map(s => s.id));

      const diffTotalMandatory = isAnyExempt ? 0 : (metrics.totalMinutes - mandatoryTotalMinutes);
      const diffCoreMandatory = isAnyExempt ? 0 : (metrics.coreTotalMinutes - mandatoryCoreMinutes);
      const diffTotalAvg = metrics.totalMinutes - (gradeAvg.activeCount > 0 ? gradeAvg.totalAvgMinutes : overallAvg.totalAvgMinutes);

      const activeTodo = todos.find(t => 
        t.studentId === student.id && 
        !t.completed && 
        (t.isStudyFollowUp || (t.title && t.title.includes('[پیگیری مطالعه]'))) && 
        (t.periodId === period.id || (t.title && t.title.includes(period.title)))
      );
      const hasActiveFollowUp = !!activeTodo;

      const wfItem = workflowItems.find(w => 
        w.category === 'study_deficit_warning' && 
        w.studentId === student.id && 
        (w.details?.periodId === period.id || w.title?.includes(period.title))
      );

      return {
        student,
        log,
        metrics,
        warningStatus,
        studentCourses,
        isStudentIndividuallyExempt,
        isGradeExempt,
        isAnyExempt,
        diffTotalMandatory,
        diffCoreMandatory,
        diffTotalAvg,
        hasActiveFollowUp,
        activeTodo,
        wfItem
      };
    });
  }, [students, periodLogs, period, allLogs, todos, workflowItems, programs, enrollments]);

  // Warning summary counts for tabs
  const warningCounts = useMemo(() => {
    let totalWarnings = 0;
    let coreDeficits = 0;
    let totalDeficits = 0;
    let commendedCount = 0;
    let noWarnings = 0;

    studentRows.forEach(r => {
      if (r.warningStatus.isCommended) {
        commendedCount++;
      }
      if (r.warningStatus.hasWarning) {
        totalWarnings++;
        if (r.warningStatus.isCoreDeficit) coreDeficits++;
        if (r.warningStatus.isTotalDeficit) totalDeficits++;
      } else {
        noWarnings++;
      }
    });

    return { totalWarnings, coreDeficits, totalDeficits, commendedCount, noWarnings };
  }, [studentRows]);

  // Filter students based on search, grade, and warning filter
  const filteredRows = useMemo(() => {
    return studentRows.filter(r => {
      const matchSearch = r.student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (r.student.nationalId && r.student.nationalId.includes(searchTerm));
      const matchGrade = gradeFilter === 'ALL' || r.student.grade === gradeFilter;

      let matchWarning = true;
      if (warningFilter === 'COMMENDED_ONLY') {
        matchWarning = r.warningStatus.isCommended;
      } else if (warningFilter === 'WARNINGS_ONLY') {
        matchWarning = r.warningStatus.hasWarning;
      } else if (warningFilter === 'CORE_DEFICIT_ONLY') {
        matchWarning = r.warningStatus.isCoreDeficit;
      } else if (warningFilter === 'TOTAL_DEFICIT_ONLY') {
        matchWarning = r.warningStatus.isTotalDeficit;
      } else if (warningFilter === 'NO_WARNING') {
        matchWarning = !r.warningStatus.hasWarning;
      }

      return matchSearch && matchGrade && matchWarning;
    });
  }, [studentRows, searchTerm, gradeFilter, warningFilter]);

  // Dynamic list of unique courses present across filtered students for detailed split columns
  const allEnrolledCourses = useMemo(() => {
    const courseMap = new Map<string, string>();
    const isExcludedTitle = (titleStr: string) => {
      const kList = ['مشاوره', 'پژوهش', 'دروس 5 شنبه', 'دروس ۵ شنبه', 'دروس پنج شنبه', 'دروس پنج‌شنبه', 'پنج شنبه', 'پنج‌شنبه', 'سایر'];
      return kList.some(k => titleStr.includes(k));
    };

    filteredRows.forEach(r => {
      // From courseBreakdown in log
      if (r.log?.coursesBreakdown) {
        r.log.coursesBreakdown.forEach(c => {
          if (!isExcludedTitle(c.courseTitle || '') && !courseMap.has(c.courseId)) {
            courseMap.set(c.courseId, c.courseTitle);
          }
        });
      }
      // From student's enrolled courses
      r.studentCourses.forEach(c => {
        if (!isExcludedTitle(c.title || '') && !courseMap.has(c.id)) {
          courseMap.set(c.id, c.title);
        }
      });
    });

    // Fallback if none enrolled yet
    if (courseMap.size === 0) {
      return [
        { id: 'c_usul', title: 'اصول فقه' },
        { id: 'c_fiqh', title: 'فقه' },
        { id: 'c_falsafe', title: 'فلسفه' }
      ];
    }

    return Array.from(courseMap.entries()).map(([id, title]) => ({ id, title }));
  }, [filteredRows]);

  // Export to Excel / CSV based on current view mode
  const handleExportTable = (exportAllDetails: boolean = false) => {
    try {
      const rowsToExport = filteredRows;
      const headers: string[] = ['ردیف', 'نام و نام خانوادگی', 'پایه تحصیلی'];

      if (exportAllDetails || displayMode === 'ALL_SPLIT') {
        allEnrolledCourses.forEach(c => {
          headers.push(`مطالعه ${c.title} (دقیقه)`);
          headers.push(`مباحثه ${c.title} (دقیقه)`);
        });
      }

      headers.push('مجموع مطالعه دروس اصلی (دقیقه)');
      headers.push('مجموع مباحثه دروس اصلی (دقیقه)');
      headers.push('مجموع کل دروس اصلی (دقیقه)');
      headers.push('مطالعه آزاد (دقیقه)');
      headers.push('مجموع کل کارکرد (دقیقه)');
      headers.push('مجموع کل کارکرد (ساعت)');
      headers.push('موظفی کل دوره (دقیقه)');
      headers.push('حداقل موظفی دروس اصلی (دقیقه)');
      headers.push('کسر/مازاد کل (دقیقه)');
      headers.push('کسر/مازاد دروس اصلی (دقیقه)');
      headers.push('وضعیت اخطار و انضباطی');
      headers.push('توضیحات اخطار');

      const csvRows = [headers.join(',')];

      rowsToExport.forEach((r, idx) => {
        const rowVals: string[] = [
          (idx + 1).toString(),
          `"${r.student.name.replace(/"/g, '""')}"`,
          `"${r.student.grade || '---'}"`
        ];

        if (exportAllDetails || displayMode === 'ALL_SPLIT') {
          allEnrolledCourses.forEach(c => {
            const courseDetail = r.log?.coursesBreakdown?.find(cb => cb.courseId === c.id || cb.courseTitle === c.title);
            rowVals.push((courseDetail?.studyMinutes || 0).toString());
            rowVals.push((courseDetail?.discussionMinutes || 0).toString());
          });
        }

        rowVals.push(r.metrics.coreStudyMinutes.toString());
        rowVals.push(r.metrics.coreDiscussionMinutes.toString());
        rowVals.push(r.metrics.coreTotalMinutes.toString());
        rowVals.push(r.metrics.freeStudyMinutes.toString());
        rowVals.push(r.metrics.totalMinutes.toString());
        rowVals.push((r.metrics.totalMinutes / 60).toFixed(1));
        rowVals.push(mandatoryTotalMinutes.toString());
        rowVals.push(mandatoryCoreMinutes.toString());
        rowVals.push(r.diffTotalMandatory.toString());
        rowVals.push(r.diffCoreMandatory.toString());
        rowVals.push(`"${r.warningStatus.shortBadge.replace(/"/g, '""')}"`);
        rowVals.push(`"${r.warningStatus.statusLabel.replace(/"/g, '""')}"`);

        csvRows.push(rowVals.join(','));
      });

      const csvContent = '\uFEFF' + csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `گزارش_${exportAllDetails ? 'تفصیلی' : 'تجمیعی'}_مطالعه_${period.title.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Error exporting table:", e);
      alert("خطا در صدور خروجی اکسل");
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls: Display Mode Tabs, Warning Filters & Search & Export */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* View Mode Selector */}
          <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={() => setDisplayMode('ALL_SPLIT')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                displayMode === 'ALL_SPLIT' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Layers size={13} />
              <span>تفکیک دروس اصلی + آزاد (تفصیلی)</span>
            </button>

            <button
              type="button"
              onClick={() => setDisplayMode('AGGREGATED_TOTALS')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                displayMode === 'AGGREGATED_TOTALS' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Calculator size={13} />
              <span>مجموع دروس اصلی + آزاد + کل (تجمیعی)</span>
            </button>

            <button
              type="button"
              onClick={() => setDisplayMode('TOTAL_ONLY')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                displayMode === 'TOTAL_ONLY' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <span>فقط مجموع کل</span>
            </button>

            <button
              type="button"
              onClick={() => setDisplayMode('STUDY_ONLY')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                displayMode === 'STUDY_ONLY' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <BookOpen size={13} />
              <span>فقط مطالعه</span>
            </button>

            <button
              type="button"
              onClick={() => setDisplayMode('DISCUSSION_ONLY')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                displayMode === 'DISCUSSION_ONLY' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <MessageSquare size={13} />
              <span>فقط مباحثه</span>
            </button>
          </div>

          {/* Export & Columns Drawer */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Export Buttons */}
            <button
              type="button"
              onClick={() => handleExportTable(false)}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="خروجی فایل اکسل بر اساس جدول جاری"
            >
              <Download size={13} />
              <span>خروجی اکسل ({displayMode === 'ALL_SPLIT' ? 'تفصیلی' : 'تجمیعی'})</span>
            </button>

            {displayMode !== 'ALL_SPLIT' && (
              <button
                type="button"
                onClick={() => handleExportTable(true)}
                className="px-3 py-2 bg-white hover:bg-slate-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                title="خروجی کامل تفصیلی به تفکیک تمام دروس اصلی"
              >
                <FileSpreadsheet size={13} className="text-emerald-600" />
                <span>خروجی تفکیک دروس</span>
              </button>
            )}

            {/* Column Toggle Button */}
            <div ref={filterRef} className="relative">
              <button
                type="button"
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <SlidersHorizontal size={14} className="text-indigo-600" />
                <span>مدیریت ستون‌ها</span>
                <ChevronDown size={14} className={cn("text-slate-400 transition-transform", isFilterDropdownOpen && "rotate-180")} />
              </button>

              <AnimatePresence>
                {isFilterDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 mt-2 w-80 p-4 bg-white rounded-2xl border border-slate-200 shadow-xl space-y-3 z-40"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-xs font-black text-slate-800">ستون‌های قابل نمایش:</span>
                      <button
                        type="button"
                        onClick={() => setCols({
                          grade: true,
                          needsFollowUp: true,
                          individualExempt: true,
                          warningNotice: true,
                          warningStatus: true,
                          coreStudyMinutes: true,
                          coreDiscussionMinutes: true,
                          coreTotalMinutes: true,
                          freeStudyMinutes: true,
                          totalMinutes: true,
                          diffMandatory: true,
                          diffCoreMandatory: true,
                          diffAvg: true,
                          statusMandatory: true
                        })}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                      >
                        نمایش همه
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-xs font-bold text-slate-700">
                      <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={cols.grade} onChange={() => setCols(p => ({ ...p, grade: !p.grade }))} className="rounded text-indigo-600" />
                        <span>پایه تحصیلی</span>
                      </label>
                      <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-amber-50/50 cursor-pointer bg-amber-50/30">
                        <input type="checkbox" checked={cols.needsFollowUp} onChange={() => setCols(p => ({ ...p, needsFollowUp: !p.needsFollowUp }))} className="rounded text-amber-600" />
                        <span className="text-amber-800 font-black">نیاز به پیگیری</span>
                      </label>
                      <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-purple-50/50 cursor-pointer bg-purple-50/30">
                        <input type="checkbox" checked={cols.individualExempt} onChange={() => setCols(p => ({ ...p, individualExempt: !p.individualExempt }))} className="rounded text-purple-600" />
                        <span className="text-purple-800 font-black">معافیت موردی</span>
                      </label>
                      <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-rose-50/50 cursor-pointer bg-rose-50/30">
                        <input type="checkbox" checked={cols.warningNotice} onChange={() => setCols(p => ({ ...p, warningNotice: !p.warningNotice }))} className="rounded text-rose-600" />
                        <span className="text-rose-800 font-black">ثبت اخطار</span>
                      </label>
                      <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-amber-50/50 cursor-pointer bg-amber-50/30">
                        <input type="checkbox" checked={cols.warningStatus} onChange={() => setCols(p => ({ ...p, warningStatus: !p.warningStatus }))} className="rounded text-amber-600" />
                        <span className="text-amber-900 font-black">وضعیت اخطار</span>
                      </label>
                      <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={cols.coreStudyMinutes} onChange={() => setCols(p => ({ ...p, coreStudyMinutes: !p.coreStudyMinutes }))} className="rounded text-indigo-600" />
                        <span>مطالعه دروس اصلی</span>
                      </label>
                      <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={cols.coreDiscussionMinutes} onChange={() => setCols(p => ({ ...p, coreDiscussionMinutes: !p.coreDiscussionMinutes }))} className="rounded text-indigo-600" />
                        <span>مباحثه دروس اصلی</span>
                      </label>
                      <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={cols.coreTotalMinutes} onChange={() => setCols(p => ({ ...p, coreTotalMinutes: !p.coreTotalMinutes }))} className="rounded text-indigo-600" />
                        <span>مجموع دروس اصلی</span>
                      </label>
                      <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={cols.freeStudyMinutes} onChange={() => setCols(p => ({ ...p, freeStudyMinutes: !p.freeStudyMinutes }))} className="rounded text-teal-600" />
                        <span>مطالعه آزاد</span>
                      </label>
                      <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={cols.totalMinutes} onChange={() => setCols(p => ({ ...p, totalMinutes: !p.totalMinutes }))} className="rounded text-indigo-600" />
                        <span>مجموع کل دقایق</span>
                      </label>
                      <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={cols.diffCoreMandatory} onChange={() => setCols(p => ({ ...p, diffCoreMandatory: !p.diffCoreMandatory }))} className="rounded text-indigo-600" />
                        <span>کسر/مازاد درس اصلی</span>
                      </label>
                      <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={cols.diffMandatory} onChange={() => setCols(p => ({ ...p, diffMandatory: !p.diffMandatory }))} className="rounded text-indigo-600" />
                        <span>کسر/مازاد کل</span>
                      </label>
                      <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={cols.statusMandatory} onChange={() => setCols(p => ({ ...p, statusMandatory: !p.statusMandatory }))} className="rounded text-indigo-600" />
                        <span>وضعیت موظفی</span>
                      </label>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Row 2: Search, Grade, & Advanced Warning Quick Filter Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-slate-200/60">
          {/* Quick Warning Filtering Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-black text-slate-500 ml-1 flex items-center gap-1">
              <Filter size={13} />
              فیلتر وضعیت:
            </span>

            <button
              type="button"
              onClick={() => setWarningFilter('ALL')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                warningFilter === 'ALL'
                  ? "bg-slate-800 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              )}
            >
              همه طلاب ({studentRows.length})
            </button>

            <button
              type="button"
              onClick={() => setWarningFilter('COMMENDED_ONLY')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer",
                warningFilter === 'COMMENDED_ONLY'
                  ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/40"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300"
              )}
              title="طلابی که هم حداقل مطالعه دروس اصلی و هم حداقل موظفی کل دوره را تکمیل کرده و مازاد تشویقی دارند"
            >
              <Sparkles size={13} className="text-amber-300" />
              <span>شایسته تشویق / مازاد موظفی ({warningCounts.commendedCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setWarningFilter('WARNINGS_ONLY')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer",
                warningFilter === 'WARNINGS_ONLY'
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200"
              )}
            >
              <AlertTriangle size={12} />
              <span>مشمولین اخطار ({warningCounts.totalWarnings})</span>
            </button>

            <button
              type="button"
              onClick={() => setWarningFilter('CORE_DEFICIT_ONLY')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                warningFilter === 'CORE_DEFICIT_ONLY'
                  ? "bg-rose-700 text-white shadow-xs"
                  : "bg-white text-rose-700 hover:bg-rose-50 border border-rose-200"
              )}
            >
              <span>کسری دروس اصلی ({warningCounts.coreDeficits})</span>
            </button>

            <button
              type="button"
              onClick={() => setWarningFilter('TOTAL_DEFICIT_ONLY')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                warningFilter === 'TOTAL_DEFICIT_ONLY'
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
              )}
            >
              <span>کسری مجموع کل ({warningCounts.totalDeficits})</span>
            </button>

            <button
              type="button"
              onClick={() => setWarningFilter('NO_WARNING')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                warningFilter === 'NO_WARNING'
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
              )}
            >
              <span>فاقد اخطار / معاف ({warningCounts.noWarnings})</span>
            </button>
          </div>

          {/* Search Box & Grade Select */}
          <div className="flex items-center gap-2">
            {uniqueGrades.length > 0 && (
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
              >
                <option value="ALL">همه پایه‌ها</option>
                {uniqueGrades.map(g => (
                  <option key={g} value={g}>پایه {g}</option>
                ))}
              </select>
            )}

            <div className="relative min-w-[180px]">
              <input
                type="text"
                placeholder="جستجوی طلبه..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-3 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
              />
              <Search size={14} className="absolute right-2.5 top-2 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Batch Selection / Exemption Toolbar */}
      {selectedStudentIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-purple-50/90 border border-purple-200 p-3 sm:p-4 rounded-2xl shadow-xs">
          <div className="flex items-center gap-2 text-xs font-black text-purple-900">
            <ShieldCheck size={18} className="text-purple-700" />
            <span>تعداد {selectedStudentIds.length.toLocaleString('fa-IR')} طلبه برای اعمال معافیت موردی انتخاب شده است:</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleBatchExempt(true)}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck size={14} />
              <span>معاف کردن موردی طلاب انتخاب‌شده</span>
            </button>
            <button
              type="button"
              onClick={() => handleBatchExempt(false)}
              className="px-3.5 py-1.5 bg-white hover:bg-purple-100 text-purple-800 border border-purple-300 rounded-xl text-xs font-black transition-colors cursor-pointer"
            >
              <span>لغو معافیت موردی انتخاب‌شده‌ها</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedStudentIds([])}
              className="px-2.5 py-1.5 text-slate-500 hover:text-slate-700 text-xs font-bold cursor-pointer"
            >
              انصراف
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
              <th className="px-3 py-3.5 text-center w-8">
                <input
                  type="checkbox"
                  checked={filteredRows.length > 0 && filteredRows.every(r => selectedStudentIds.includes(r.student.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedStudentIds(filteredRows.map(r => r.student.id));
                    } else {
                      setSelectedStudentIds([]);
                    }
                  }}
                  className="w-3.5 h-3.5 rounded text-purple-600 cursor-pointer"
                  title="انتخاب همه طلاب جهت معافیت موردی"
                />
              </th>
              <th className="px-3 py-3.5 text-center">ردیف</th>
              <th className="px-4 py-3.5">نام و نام خانوادگی</th>
              {cols.grade && <th className="px-3 py-3.5 text-center">پایه</th>}
              {cols.needsFollowUp && <th className="px-3 py-3.5 text-center bg-amber-50/60 text-amber-800 font-extrabold">نیاز به پیگیری</th>}
              {cols.individualExempt && <th className="px-3 py-3.5 text-center bg-purple-50/70 text-purple-900 font-extrabold whitespace-nowrap">معافیت موردی</th>}
              {cols.warningNotice && <th className="px-3 py-3.5 text-center bg-rose-50/70 text-rose-800 font-extrabold">ثبت اخطار</th>}
              {cols.warningStatus && <th className="px-3 py-3.5 text-center bg-amber-50/70 text-amber-900 font-extrabold">وضعیت اخطار</th>}

              {/* DETAILED MODE (ALL_SPLIT): Dynamic columns for each core course */}
              {displayMode === 'ALL_SPLIT' && allEnrolledCourses.map(course => (
                <React.Fragment key={course.id}>
                  <th className="px-3 py-3.5 text-center bg-indigo-50/70 text-indigo-900 font-extrabold border-r border-indigo-100 whitespace-nowrap">
                    مطالعه {course.title} (د)
                  </th>
                  <th className="px-3 py-3.5 text-center bg-emerald-50/70 text-emerald-900 font-extrabold whitespace-nowrap">
                    مباحثه {course.title} (د)
                  </th>
                </React.Fragment>
              ))}

              {/* CORE TOTALS (In both ALL_SPLIT and AGGREGATED_TOTALS) */}
              {(displayMode === 'ALL_SPLIT' || displayMode === 'AGGREGATED_TOTALS') && (
                <>
                  {cols.coreStudyMinutes && (
                    <th className="px-3 py-3.5 text-center bg-indigo-100/70 text-indigo-900 font-black whitespace-nowrap">
                      مجموع مطالعه اصلی
                    </th>
                  )}
                  {cols.coreDiscussionMinutes && (
                    <th className="px-3 py-3.5 text-center bg-emerald-100/70 text-emerald-900 font-black whitespace-nowrap">
                      مجموع مباحثه اصلی
                    </th>
                  )}
                  {cols.coreTotalMinutes && (
                    <th className="px-3 py-3.5 text-center bg-amber-100/70 text-amber-950 font-black whitespace-nowrap border-l border-amber-200">
                      مجموع دروس اصلی
                    </th>
                  )}
                  {cols.freeStudyMinutes && (
                    <th className="px-3 py-3.5 text-center bg-teal-50 text-teal-900 font-black whitespace-nowrap">
                      مطالعه آزاد
                    </th>
                  )}
                </>
              )}

              {/* STUDY ONLY MODE */}
              {displayMode === 'STUDY_ONLY' && (
                <th className="px-3 py-3.5 text-center bg-indigo-50/50 text-indigo-700">دقیقه مطالعه</th>
              )}

              {/* DISCUSSION ONLY MODE */}
              {displayMode === 'DISCUSSION_ONLY' && (
                <th className="px-3 py-3.5 text-center bg-emerald-50/50 text-emerald-700">دقیقه مباحثه</th>
              )}

              {/* OVERALL TOTAL COLUMN */}
              {cols.totalMinutes && (
                <th className="px-3 py-3.5 text-center bg-slate-900 text-white font-black whitespace-nowrap">
                  مجموع کل (دقیقه / ساعت)
                </th>
              )}

              {cols.diffCoreMandatory && (
                <th className="px-3 py-3.5 text-center bg-amber-50/50 text-amber-900 whitespace-nowrap">
                  کسر/مازاد درس اصلی (حداقل {mandatoryCoreMinutes}د)
                </th>
              )}

              {cols.diffMandatory && (
                <th className="px-3 py-3.5 text-center whitespace-nowrap">
                  کسر/مازاد کل (موظفی {mandatoryTotalMinutes}د)
                </th>
              )}

              {cols.statusMandatory && <th className="px-3 py-3.5 text-center whitespace-nowrap">ارزیابی نهایی</th>}
              {isLevel2User && <th className="px-3 py-3.5 text-center bg-indigo-50/80 text-indigo-900 font-extrabold whitespace-nowrap">کپی شماره تماس</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={16} className="py-12 text-center text-slate-400 font-bold">
                  هیچ طلبه‌ای با فیلترهای انتخابی یافت نشد.
                </td>
              </tr>
            ) : (
              filteredRows.map(({
                student,
                log,
                metrics,
                warningStatus,
                isStudentIndividuallyExempt,
                isGradeExempt,
                isAnyExempt,
                diffTotalMandatory,
                diffCoreMandatory,
                hasActiveFollowUp,
                activeTodo,
                wfItem
              }, index) => {
                const isSelected = selectedStudentId === student.id;

                return (
                  <tr 
                    key={student.id}
                    onClick={() => onSelectStudent(student.id)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      isSelected ? "bg-indigo-50/70 font-semibold" : "hover:bg-slate-50/80",
                      warningStatus.hasWarning && !isAnyExempt && "bg-rose-50/20"
                    )}
                  >
                    <td className="px-3 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(student.id)}
                        onChange={() => {
                          setSelectedStudentIds(prev => 
                            prev.includes(student.id) ? prev.filter(id => id !== student.id) : [...prev, student.id]
                          );
                        }}
                        className="w-3.5 h-3.5 rounded text-purple-600 cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-3.5 text-slate-400 text-[11px] font-bold text-center">{index + 1}</td>
                    <td className="px-4 py-3.5 font-bold text-slate-800 flex items-center gap-2">
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                      <span>{student.name}</span>
                    </td>
                    {cols.grade && <td className="px-3 py-3.5 text-center text-slate-500">{student.grade || '---'}</td>}

                    {/* Needs Follow-Up Column */}
                    {cols.needsFollowUp && (
                      <td className="px-3 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleToggleFollowUp(student, activeTodo)}
                          className={cn(
                            "px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 mx-auto border shadow-2xs",
                            hasActiveFollowUp
                              ? "bg-amber-500 text-white border-amber-600 hover:bg-amber-600"
                              : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-800"
                          )}
                          title={hasActiveFollowUp ? "در حال پیگیری - کلیک کنید تا تکمیل شود" : "افزودن به لیست پیگیری‌ها"}
                        >
                          <input
                            type="checkbox"
                            checked={hasActiveFollowUp}
                            onChange={() => {}}
                            className="w-3.5 h-3.5 rounded text-amber-600 pointer-events-none cursor-pointer"
                          />
                          <span>{hasActiveFollowUp ? "در پیگیری" : "نیازمند پیگیری"}</span>
                        </button>
                      </td>
                    )}

                    {/* Individual Exemption Column */}
                    {cols.individualExempt && (
                      <td className="px-3 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        {isGradeExempt ? (
                          <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200 whitespace-nowrap" title="کل این پایه توسط مسئول آموزش معاف شده است">
                            معاف پایه
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleIndividualExempt(student.id)}
                            className={cn(
                              "px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 mx-auto border shadow-2xs cursor-pointer",
                              isStudentIndividuallyExempt
                                ? "bg-purple-600 text-white border-purple-700 hover:bg-purple-700"
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300"
                            )}
                            title={isStudentIndividuallyExempt ? "کلیک کنید تا معافیت موردی لغو شود" : "معاف کردن موردی این طلبه از موظفی دوره"}
                          >
                            <ShieldCheck size={12} className={isStudentIndividuallyExempt ? "text-white" : "text-purple-600"} />
                            <span>{isStudentIndividuallyExempt ? "معاف موردی" : "معافیت موردی"}</span>
                          </button>
                        )}
                      </td>
                    )}

                    {/* Register Warning Column */}
                    {cols.warningNotice && (
                      <td className="px-3 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        {isAnyExempt ? (
                          <span className="bg-purple-50 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-200 whitespace-nowrap">
                            {isStudentIndividuallyExempt ? '🛡️ معاف موردی' : 'معاف از موظفی'}
                          </span>
                        ) : warningStatus.hasWarning ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] font-bold text-rose-700 whitespace-nowrap leading-tight">
                              {warningStatus.warningType === 'deficit_both' ? (
                                `کسری ۲گانه (${warningStatus.coreDeficitMinutes}د اصلی | ${warningStatus.totalDeficitMinutes}د کل)`
                              ) : warningStatus.warningType === 'deficit_core_only' ? (
                                `کسری درس اصلی: ${warningStatus.coreDeficitMinutes}د`
                              ) : (
                                `کسری کل: ${warningStatus.totalDeficitMinutes}د`
                              )}
                            </span>
                            {!wfItem ? (
                              <button
                                type="button"
                                onClick={() => handleRegisterWarning(student, warningStatus)}
                                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black rounded-lg transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                                title="ثبت اخطار رسمی در جریان کار"
                              >
                                <AlertCircle size={11} />
                                <span>ثبت اخطار</span>
                              </button>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400">ثبت ارسالی</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-emerald-700 text-[11px] font-bold">تکمیل موظفی</span>
                        )}
                      </td>
                    )}

                    {/* Warning Status Column */}
                    {cols.warningStatus && (
                      <td className="px-3 py-3.5 text-center">
                        {wfItem ? (
                          wfItem.status === 'approved' ? (
                            <span className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-black px-2.5 py-1 rounded-full shadow-2xs whitespace-nowrap">
                              ثبت قطعی اخطار
                            </span>
                          ) : wfItem.status === 'rejected' ? (
                            <span className="bg-slate-100 text-slate-600 border border-slate-300 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
                              رد اخطار
                            </span>
                          ) : (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2.5 py-1 rounded-full shadow-2xs whitespace-nowrap">
                              در انتظار تایید
                            </span>
                          )
                        ) : isAnyExempt ? (
                          <span className="text-purple-600 text-[10px] font-bold">معاف</span>
                        ) : warningStatus.hasWarning ? (
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap", warningStatus.badgeClass)}>
                            {warningStatus.shortBadge}
                          </span>
                        ) : warningStatus.isCommended ? (
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap inline-flex items-center gap-1">
                            <Sparkles size={11} className="text-amber-500" />
                            <span>تشویقی</span>
                          </span>
                        ) : (
                          <span className="text-emerald-600 text-[10px] font-bold">فاقد اخطار</span>
                        )}
                      </td>
                    )}

                    {/* DETAILED COLUMNS: Each enrolled core course study and discussion */}
                    {displayMode === 'ALL_SPLIT' && allEnrolledCourses.map(course => {
                      const cb = log?.coursesBreakdown?.find(c => c.courseId === course.id || c.courseTitle === course.title);
                      const sM = cb?.studyMinutes || 0;
                      const dM = cb?.discussionMinutes || 0;

                      return (
                        <React.Fragment key={course.id}>
                          <td className="px-3 py-3.5 text-center font-bold text-indigo-700 bg-indigo-50/20 border-r border-slate-100">
                            {sM > 0 ? `${sM.toLocaleString('fa-IR')} د` : <span className="text-slate-300 font-normal">۰</span>}
                          </td>
                          <td className="px-3 py-3.5 text-center font-bold text-emerald-700 bg-emerald-50/20">
                            {dM > 0 ? `${dM.toLocaleString('fa-IR')} د` : <span className="text-slate-300 font-normal">۰</span>}
                          </td>
                        </React.Fragment>
                      );
                    })}

                    {/* CORE TOTALS (In both ALL_SPLIT and AGGREGATED_TOTALS) */}
                    {(displayMode === 'ALL_SPLIT' || displayMode === 'AGGREGATED_TOTALS') && (
                      <>
                        {cols.coreStudyMinutes && (
                          <td className="px-3 py-3.5 text-center font-bold text-indigo-800 bg-indigo-50/40">
                            {metrics.coreStudyMinutes > 0 ? `${metrics.coreStudyMinutes.toLocaleString('fa-IR')} د` : <span className="text-slate-300">۰</span>}
                          </td>
                        )}
                        {cols.coreDiscussionMinutes && (
                          <td className="px-3 py-3.5 text-center font-bold text-emerald-800 bg-emerald-50/40">
                            {metrics.coreDiscussionMinutes > 0 ? `${metrics.coreDiscussionMinutes.toLocaleString('fa-IR')} د` : <span className="text-slate-300">۰</span>}
                          </td>
                        )}
                        {cols.coreTotalMinutes && (
                          <td className={cn(
                            "px-3 py-3.5 text-center font-black border-l border-amber-200",
                            metrics.coreTotalMinutes >= mandatoryCoreMinutes ? "text-amber-950 bg-amber-50/80" : "text-rose-700 bg-rose-50/80"
                          )}>
                            {metrics.coreTotalMinutes > 0 ? `${metrics.coreTotalMinutes.toLocaleString('fa-IR')} د` : <span className="text-slate-300">۰</span>}
                          </td>
                        )}
                        {cols.freeStudyMinutes && (
                          <td className="px-3 py-3.5 text-center font-bold text-teal-800 bg-teal-50/40">
                            {metrics.freeStudyMinutes > 0 ? `${metrics.freeStudyMinutes.toLocaleString('fa-IR')} د` : <span className="text-slate-300">۰</span>}
                          </td>
                        )}
                      </>
                    )}

                    {/* STUDY ONLY MODE */}
                    {displayMode === 'STUDY_ONLY' && (
                      <td className="px-3 py-3.5 text-center font-bold text-indigo-700 bg-indigo-50/30">
                        {metrics.studyMinutes > 0 ? `${metrics.studyMinutes.toLocaleString('fa-IR')} د` : <span className="text-slate-300 font-normal">۰</span>}
                      </td>
                    )}

                    {/* DISCUSSION ONLY MODE */}
                    {displayMode === 'DISCUSSION_ONLY' && (
                      <td className="px-3 py-3.5 text-center font-bold text-emerald-700 bg-emerald-50/30">
                        {metrics.discussionMinutes > 0 ? `${metrics.discussionMinutes.toLocaleString('fa-IR')} د` : <span className="text-slate-300 font-normal">۰</span>}
                      </td>
                    )}

                    {/* OVERALL TOTAL COLUMN */}
                    {cols.totalMinutes && (
                      <td className="px-3 py-3.5 text-center font-black bg-slate-50 text-slate-900">
                        {metrics.totalMinutes > 0 ? (
                          <div className="flex flex-col items-center">
                            <span>{metrics.totalMinutes.toLocaleString('fa-IR')} دقیقه</span>
                            <span className="text-[10px] text-slate-500 font-normal">
                              ({(metrics.totalMinutes / 60).toFixed(1)} ساعت)
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-normal">۰</span>
                        )}
                      </td>
                    )}

                    {/* Diff Core Mandatory */}
                    {cols.diffCoreMandatory && (
                      <td className="px-3 py-3.5 text-center bg-amber-50/30">
                        {metrics.coreTotalMinutes > 0 && mandatoryCoreMinutes > 0 ? (
                          <span className={cn(
                            "inline-flex items-center gap-0.5 font-bold text-[11px]",
                            diffCoreMandatory >= 0 ? "text-emerald-600" : "text-rose-600 font-black"
                          )}>
                            {diffCoreMandatory > 0 ? '+' : ''}{diffCoreMandatory.toLocaleString('fa-IR')} د
                            {diffCoreMandatory >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                          </span>
                        ) : (
                          <span className="text-slate-300">---</span>
                        )}
                      </td>
                    )}

                    {/* Diff Total Mandatory */}
                    {cols.diffMandatory && (
                      <td className="px-3 py-3.5 text-center">
                        {metrics.totalMinutes > 0 && mandatoryTotalMinutes > 0 ? (
                          <span className={cn(
                            "inline-flex items-center gap-0.5 font-bold text-[11px]",
                            diffTotalMandatory >= 0 ? "text-emerald-600" : "text-rose-600 font-black"
                          )}>
                            {diffTotalMandatory > 0 ? '+' : ''}{diffTotalMandatory.toLocaleString('fa-IR')} د
                            {diffTotalMandatory >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                          </span>
                        ) : (
                          <span className="text-slate-300">---</span>
                        )}
                      </td>
                    )}

                    {/* Final Status */}
                    {cols.statusMandatory && (
                      <td className="px-3 py-3.5 text-center">
                        {isAnyExempt ? (
                          <span className="bg-purple-50 text-purple-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-purple-200 whitespace-nowrap">
                            معاف از موظفی
                          </span>
                        ) : warningStatus.hasWarning ? (
                          <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full border whitespace-nowrap", warningStatus.badgeClass)}>
                            {warningStatus.shortBadge}
                          </span>
                        ) : warningStatus.isCommended ? (
                          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black px-2.5 py-1 rounded-full shadow-2xs whitespace-nowrap inline-flex items-center gap-1">
                            <Sparkles size={11} className="text-amber-500" />
                            <span>شایسته تشویق</span>
                          </span>
                        ) : metrics.totalMinutes > 0 ? (
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-100 whitespace-nowrap">
                            تکمیل موظفی
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                            ثبت نشده
                          </span>
                        )}
                      </td>
                    )}

                    {/* Copy Phone Number Column (Level 2 Users) */}
                    {isLevel2User && (
                      <td className="px-3 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        {student.phoneNumber ? (
                          <button
                            type="button"
                            onClick={() => handleCopyPhone(student.name, student.phoneNumber!, student.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/90 rounded-xl transition-all cursor-pointer shadow-2xs"
                            title={`کپی شماره تماس ${student.name} (${student.phoneNumber})`}
                          >
                            {copiedPhoneId === student.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                            <span className="font-mono">{student.phoneNumber}</span>
                          </button>
                        ) : (
                          <span className="text-slate-300 text-[11px]">بدون شماره</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100/90 font-black text-slate-800 text-xs border-t-2 border-slate-200">
              <td colSpan={3 + (cols.grade ? 1 : 0) + (cols.needsFollowUp ? 1 : 0) + (cols.individualExempt ? 1 : 0)} className="px-4 py-3.5">
                میانگین دوره (مشارکت: {overallAvg.activeCount} نفر)
              </td>
              <td colSpan={15} className="px-4 py-3.5 text-left text-slate-600 font-bold">
                موظفی کل دوره: <b className="text-indigo-700">{mandatoryTotalMinutes.toLocaleString('fa-IR')} دقیقه</b> | حداقل موظفی دروس اصلی: <b className="text-amber-800">{mandatoryCoreMinutes.toLocaleString('fa-IR')} دقیقه</b>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
