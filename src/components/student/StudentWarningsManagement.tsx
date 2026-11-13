import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  BookOpen,
  Calendar as CalendarIcon,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Info,
  Printer,
  Search,
  ShieldAlert,
  Sparkles,
  User,
  Users,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { useMentor } from '../../context/MentorContext';
import { ShamsiDatePicker } from '../ShamsiDatePicker';
import { exportElementToPdf } from '../../lib/pdfExport';
import { cn } from '../../lib/utils';
import {
  compareShamsi,
  dateToShamsi,
  getTodayShamsi,
  normalizeShamsiDateStr,
  subtractDaysShamsi,
  toEnglishDigits,
  getConsolidatedSessionLog
} from '../../lib/jalali';
import {
  AcademicHolidayItem,
  AttendanceSessionLog,
  Program,
  Student,
  StudyPeriod,
  WorkflowItem
} from '../../types';

export interface UnifiedStudentWarningItem {
  id: string;
  studentId: string;
  category: 'attendance' | 'study';
  dateShamsi: string;
  title: string;
  description: string;
  courseOrPeriodTitle: string;
  status: 'approved' | 'pending' | 'acknowledged' | 'rejected';
  issuerName?: string;
  deficitMinutes?: number;
  absentCount?: number;
  source: 'workflow' | 'attendance_log';
}

export interface StudentWarningsSummaryRow {
  student: Student;
  attendanceWarnings: UnifiedStudentWarningItem[];
  studyWarnings: UnifiedStudentWarningItem[];
  formalLetters: WorkflowItem[];
  totalWarningsCount: number;
}

type FormTemplateKey = 'commitment' | 'council_notice' | 'explanation_request' | 'formal_warning';

export default function StudentWarningsManagement() {
  const { currentUser, canEditModule } = useAuth();
  const { filterStudents } = useMentor();
  const canEdit = canEditModule('warnings-management');

  const [students, setStudents] = useState<Student[]>([]);
  const [workflowItems, setWorkflowItems] = useState<WorkflowItem[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceSessionLog[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [academicHolidays, setAcademicHolidays] = useState<AcademicHolidayItem[]>([]);
  const [studyPeriods, setStudyPeriods] = useState<StudyPeriod[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toastMsg, setToastMsg] = useState<string>('');

  // Time Range & Filter states
  const [rangeMode, setRangeMode] = useState<'all_time' | 'custom_range'>('all_time');
  const [startDate, setStartDate] = useState<string>(() => subtractDaysShamsi(getTodayShamsi(), 30));
  const [endDate, setEndDate] = useState<string>(() => getTodayShamsi());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [warningTypeFilter, setWarningTypeFilter] = useState<'with_warnings' | 'attendance_only' | 'study_only' | 'both' | 'all_students'>('with_warnings');

  // Detail modal state
  const [detailRow, setDetailRow] = useState<StudentWarningsSummaryRow | null>(null);

  // Printable Editable Form Modal state
  const [formTargetRow, setFormTargetRow] = useState<StudentWarningsSummaryRow | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplateKey>('commitment');
  const [headerInstitution, setHeaderInstitution] = useState<string>('مدرسه علمیه — معاونت آموزش و امور طلاب');
  const [bismillahText, setBismillahText] = useState<string>('بسمه تعالی');
  const [formTitle, setFormTitle] = useState<string>('');
  const [letterNumber, setLetterNumber] = useState<string>('');
  const [letterDate, setLetterDate] = useState<string>(getTodayShamsi());
  const [bodyText, setBodyText] = useState<string>('');
  const [includeWarningsTable, setIncludeWarningsTable] = useState<boolean>(true);
  const [showStudentResponseBox, setShowStudentResponseBox] = useState<boolean>(true);
  const [studentResponseBoxTitle, setStudentResponseBoxTitle] = useState<string>('متن تعهد / توضیحات کتبی طلبه:');
  const [sig1Label, setSig1Label] = useState<string>('امضای طلبه');
  const [sig2Label, setSig2Label] = useState<string>('استاد / مسئول پایه');
  const [sig3Label, setSig3Label] = useState<string>('مهر و امضای مسئول آموزش');
  const [isSavingFormLog, setIsSavingFormLog] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const printSheetRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const loadData = async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    try {
      const [studs, wfList, atts, progs, hols, periods] = await Promise.all([
        localDb.getDocs<Student>('students'),
        localDb.getDocs<WorkflowItem>('workflow_items'),
        localDb.getDocs<AttendanceSessionLog>('attendance'),
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<AcademicHolidayItem>('academic_holidays'),
        localDb.getDocs<StudyPeriod>('study_periods')
      ]);

      const activeStudents = (studs || []).filter((s: any) => s && s.status !== 'deleted' && !s.isDeleted && !s.deletedAt);
      setStudents(activeStudents);
      setWorkflowItems(wfList || []);
      setAttendanceRecords(atts || []);
      setPrograms(progs || []);
      setAcademicHolidays(hols || []);
      setStudyPeriods(periods || []);
    } catch (err) {
      console.error('[STORAGE_FAILURE] Error loading StudentWarningsManagement data:', err);
      showToast('خطا در بارگذاری اطلاعات اخطارها.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
    const unsub = localDb.subscribe(() => {
      loadData(false);
    });
    const handleSync = async () => {
      try {
        await Promise.all([
          localDb.syncCollectionFromCloud('workflow_items', true),
          localDb.syncCollectionFromCloud('attendance', true)
        ]);
      } catch (e) {
        console.warn('[STORAGE_FAILURE] Cloud sync in StudentWarningsManagement:', e);
      }
      await loadData(false);
    };
    window.addEventListener('workflow_items_updated', handleSync);
    window.addEventListener('attendance_updated', handleSync);
    window.addEventListener('app_data_change', handleSync);
    return () => {
      unsub();
      window.removeEventListener('workflow_items_updated', handleSync);
      window.removeEventListener('attendance_updated', handleSync);
      window.removeEventListener('app_data_change', handleSync);
    };
  }, []);

  // Mentor/Role scoped active students
  const scopedStudents = useMemo(() => {
    const filtered = filterStudents(students);
    return [...filtered].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fa'));
  }, [students, filterStudents]);

  const getHolidayForDate = (dateStr: string, grade?: string) => {
    const normTarget = normalizeShamsiDateStr(dateStr);
    if (!normTarget || academicHolidays.length === 0) return undefined;
    return academicHolidays.find(h => {
      const hStart = normalizeShamsiDateStr(h.startDate || '');
      const hEnd = normalizeShamsiDateStr(h.endDate || h.startDate || '');
      if (!hStart) return false;
      const isDateMatch = compareShamsi(normTarget, hStart) >= 0 && compareShamsi(normTarget, hEnd) <= 0;
      if (!isDateMatch) return false;
      if (!Array.isArray(h.grades) || h.grades.length === 0 || h.grades.includes('all') || h.grades.includes('همه پایه‌ها')) {
        return true;
      }
      if (!grade) return false;
      return h.grades.includes(grade);
    });
  };

  const isShamsiInRange = (targetShamsi?: string): boolean => {
    if (rangeMode === 'all_time') return true;
    if (!targetShamsi) return true;
    const normTarget = normalizeShamsiDateStr(targetShamsi);
    const normStart = normalizeShamsiDateStr(startDate);
    const normEnd = normalizeShamsiDateStr(endDate);
    if (!normTarget) return true;
    if (normStart && compareShamsi(normTarget, normStart) < 0) return false;
    if (normEnd && compareShamsi(normTarget, normEnd) > 0) return false;
    return true;
  };

  // Aggregate Attendance & Study warnings per student cleanly & without double-counting
  const summaryRows = useMemo<StudentWarningsSummaryRow[]>(() => {
    const studentLookup = new Map<string, string>();
    scopedStudents.forEach(s => {
      if (s.id) studentLookup.set(String(s.id).trim(), s.id);
      if (s.nationalId) studentLookup.set(String(s.nationalId).trim(), s.id);
      if (s.studentCode) studentLookup.set(String(s.studentCode).trim().toUpperCase(), s.id);
    });

    const periodById = new Map<string, StudyPeriod>();
    studyPeriods.forEach(p => {
      if (p.id) periodById.set(p.id, p);
    });

    const mapByStudent: Record<string, {
      attendanceWarnings: UnifiedStudentWarningItem[];
      studyWarnings: UnifiedStudentWarningItem[];
      formalLetters: WorkflowItem[];
      seenAttSessionKeys: Set<string>;
      seenStudyKeys: Set<string>;
    }> = {};

    scopedStudents.forEach(s => {
      mapByStudent[s.id] = {
        attendanceWarnings: [],
        studyWarnings: [],
        formalLetters: [],
        seenAttSessionKeys: new Set<string>(),
        seenStudyKeys: new Set<string>()
      };
    });

    const resolveStudentId = (rawId?: string, rawNat?: string, rawName?: string): string | undefined => {
      const sId = String(rawId || '').trim();
      const nat = String(rawNat || '').trim();
      if (sId && studentLookup.has(sId)) return studentLookup.get(sId);
      if (nat && studentLookup.has(nat)) return studentLookup.get(nat);
      if (rawName) {
        const found = scopedStudents.find(st => st.name?.trim() === rawName.trim());
        if (found) return found.id;
      }
      return undefined;
    };

    const resolveCreatedDateShamsi = (isoOrStr?: string): string => {
      if (!isoOrStr) return getTodayShamsi();
      if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(toEnglishDigits(isoOrStr.trim()))) {
        return normalizeShamsiDateStr(isoOrStr);
      }
      const d = new Date(isoOrStr);
      if (!isNaN(d.getTime())) {
        return dateToShamsi(d);
      }
      return getTodayShamsi();
    };

    // 1. Scan workflow_items
    workflowItems.forEach(w => {
      if (!w || w.status === 'rejected') return;
      const canonicalId = resolveStudentId(w.studentId, w.nationalId, w.studentName);
      if (!canonicalId || !mapByStudent[canonicalId]) return;
      const bucket = mapByStudent[canonicalId];

      // Formal printable letter audit logs stored separately (not counted as raw warnings)
      if (w.details?.isFormalNoticeLetter) {
        bucket.formalLetters.push(w);
        return;
      }

      const isStudyWarn =
        w.category === 'study_deficit_warning' ||
        (w.category !== 'unexcused_absence_warning' &&
          ((w.title && (w.title.includes('مطالعه') || w.title.includes('کسری'))) ||
            (w.description && w.description.includes('ساعت مطالعه'))));

      const isAttWarn =
        !isStudyWarn &&
        (w.category === 'unexcused_absence_warning' ||
          (w.title && w.title.includes('اخطار') && (w.title.includes('غیبت') || w.title.includes('حضور'))));

      if (isAttWarn) {
        const warnDate = normalizeShamsiDateStr(w.details?.date || w.details?.issuedDateShamsi || '') || resolveCreatedDateShamsi(w.createdAt);
        const progRef = String(w.details?.programId || w.details?.programTitle || '').trim();
        const dedupKey = (warnDate && progRef) ? `sess_${progRef}_${warnDate}` : `wf_${w.id}`;
        if (bucket.seenAttSessionKeys.has(dedupKey)) return;
        bucket.seenAttSessionKeys.add(dedupKey);
        if (w.details?.programTitle && warnDate) {
          bucket.seenAttSessionKeys.add(`sess_${String(w.details.programTitle).trim()}_${warnDate}`);
        }

        if (!isShamsiInRange(warnDate)) return;

        bucket.attendanceWarnings.push({
          id: w.id,
          studentId: canonicalId,
          category: 'attendance',
          dateShamsi: warnDate,
          title: w.title,
          description: w.details?.reason || w.description,
          courseOrPeriodTitle: w.details?.programTitle || 'کلاس درسی',
          status: w.status,
          issuerName: w.approvedByName || w.createdByName,
          absentCount: w.details?.absentCount,
          source: 'workflow'
        });
      } else if (isStudyWarn) {
        const linkedPeriodId = w.periodId || w.details?.periodId;
        const periodObj = linkedPeriodId ? periodById.get(linkedPeriodId) : undefined;
        const warnDate = normalizeShamsiDateStr(periodObj?.endDate || periodObj?.startDate || '') || resolveCreatedDateShamsi(w.createdAt);

        const studyKey = linkedPeriodId ? `study_${linkedPeriodId}` : `wf_${w.id}`;
        if (bucket.seenStudyKeys.has(studyKey)) return;
        bucket.seenStudyKeys.add(studyKey);

        if (!isShamsiInRange(warnDate)) return;

        bucket.studyWarnings.push({
          id: w.id,
          studentId: canonicalId,
          category: 'study',
          dateShamsi: warnDate,
          title: w.title,
          description: w.description,
          courseOrPeriodTitle: w.periodTitle || w.details?.periodTitle || periodObj?.title || 'دوره مطالعاتی',
          status: w.status,
          issuerName: w.approvedByName || w.createdByName,
          deficitMinutes: w.details?.deficitMinutes || (w.details?.deficitHours ? Math.round(w.details.deficitHours * 60) : undefined),
          source: 'workflow'
        });
      }
    });

    // 2. Scan consolidated attendance logs for session-level hasEducationalWarning flags
    const allLogsMap = new Map<string, AttendanceSessionLog>();
    attendanceRecords.forEach(r => {
      const prog = programs.find(p => p.id === r.programId);
      if (!prog || prog.isDeleted || prog.status === 'inactive' || prog.status === 'deleted') return;
      const normDate = toEnglishDigits(normalizeShamsiDateStr(r.date)).replace(/[\/\-]/g, '-');
      const key = `${r.programId}_${normDate}`;
      const existing = allLogsMap.get(key);
      if (!existing) {
        allLogsMap.set(key, r);
      } else {
        const merged = getConsolidatedSessionLog([r, existing], r.programId, r.date, prog?.title);
        if (merged) allLogsMap.set(key, merged);
      }
    });

    allLogsMap.forEach(rec => {
      const prog = programs.find(p => p.id === rec.programId);
      const isHoliday = Boolean(getHolidayForDate(rec.date, prog?.grade));
      if (rec.isCancelled || isHoliday || !Array.isArray(rec.students)) return;

      const recDateNorm = normalizeShamsiDateStr(rec.date);
      if (!isShamsiInRange(recDateNorm)) return;

      rec.students.forEach(stItem => {
        if (!stItem.hasEducationalWarning) return;
        const canonicalId = resolveStudentId(stItem.studentId, stItem.nationalId, stItem.studentName);
        if (!canonicalId || !mapByStudent[canonicalId]) return;
        const bucket = mapByStudent[canonicalId];

        const byIdKey = `sess_${rec.programId}_${recDateNorm}`;
        const byTitleKey = `sess_${String(rec.programTitle || '').trim()}_${recDateNorm}`;
        if (bucket.seenAttSessionKeys.has(byIdKey) || bucket.seenAttSessionKeys.has(byTitleKey)) {
          return;
        }
        bucket.seenAttSessionKeys.add(byIdKey);

        bucket.attendanceWarnings.push({
          id: `att_log_${rec.id}_${canonicalId}`,
          studentId: canonicalId,
          category: 'attendance',
          dateShamsi: recDateNorm,
          title: `اخطار آموزشی جلسه کلاس ${rec.programTitle}`,
          description: stItem.note || 'ثبت اخطار آموزشی در لیست حضور و غیاب کلاس',
          courseOrPeriodTitle: rec.programTitle || 'کلاس درسی',
          status: 'approved',
          issuerName: stItem.warningRegisteredBy || rec.recordedByName,
          source: 'attendance_log'
        });
      });
    });

    return scopedStudents.map(st => {
      const bucket = mapByStudent[st.id];
      const attSorted = [...bucket.attendanceWarnings].sort((a, b) => compareShamsi(b.dateShamsi, a.dateShamsi));
      const studySorted = [...bucket.studyWarnings].sort((a, b) => compareShamsi(b.dateShamsi, a.dateShamsi));
      return {
        student: st,
        attendanceWarnings: attSorted,
        studyWarnings: studySorted,
        formalLetters: [...bucket.formalLetters].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        totalWarningsCount: attSorted.length + studySorted.length
      };
    });
  }, [scopedStudents, workflowItems, attendanceRecords, programs, academicHolidays, studyPeriods, rangeMode, startDate, endDate]);

  // Apply UI Filters
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return summaryRows
      .filter(row => {
        if (gradeFilter !== 'all' && row.student.grade !== gradeFilter) return false;
        if (q) {
          const matchName = row.student.name?.toLowerCase().includes(q);
          const matchNat = row.student.nationalId?.includes(q);
          const matchCode = row.student.studentCode?.toLowerCase().includes(q);
          if (!matchName && !matchNat && !matchCode) return false;
        }
        if (warningTypeFilter === 'with_warnings') return row.totalWarningsCount > 0;
        if (warningTypeFilter === 'attendance_only') return row.attendanceWarnings.length > 0;
        if (warningTypeFilter === 'study_only') return row.studyWarnings.length > 0;
        if (warningTypeFilter === 'both') return row.attendanceWarnings.length > 0 && row.studyWarnings.length > 0;
        return true;
      })
      .sort((a, b) => b.totalWarningsCount - a.totalWarningsCount || String(a.student.name).localeCompare(String(b.student.name), 'fa'));
  }, [summaryRows, gradeFilter, searchQuery, warningTypeFilter]);

  const kpis = useMemo(() => {
    let studentsWithAnyWarning = 0;
    let totalAttWarnings = 0;
    let totalStudyWarnings = 0;
    filteredRows.forEach(r => {
      if (r.totalWarningsCount > 0) studentsWithAnyWarning++;
      totalAttWarnings += r.attendanceWarnings.length;
      totalStudyWarnings += r.studyWarnings.length;
    });
    return {
      studentsWithAnyWarning,
      totalAttWarnings,
      totalStudyWarnings,
      grandTotal: totalAttWarnings + totalStudyWarnings
    };
  }, [filteredRows]);

  // Build Editable Form Content from Template
  const applyTemplateToForm = (row: StudentWarningsSummaryRow, tpl: FormTemplateKey) => {
    setSelectedTemplate(tpl);
    const st = row.student;
    const attCount = row.attendanceWarnings.length;
    const stCount = row.studyWarnings.length;
    const rangeLabel = rangeMode === 'all_time'
      ? 'از ابتدای سال تحصیلی تا کنون'
      : `در بازه زمانی ${startDate} تا ${endDate}`;

    const summaryPhrase =
      attCount > 0 && stCount > 0
        ? `${attCount} مورد اخطار حضور و غیاب و ${stCount} مورد اخطار ثبت مطالعه`
        : attCount > 0
          ? `${attCount} مورد اخطار حضور و غیاب`
          : stCount > 0
            ? `${stCount} مورد اخطار ثبت مطالعه`
            : 'سوابق و تذکرات آموزشی ثبت‌شده';

    if (tpl === 'commitment') {
      setFormTitle('فرم اخطار آموزشی و تعهدنامه کتبی طلبه');
      setBodyText(
        `طلبه محترم جناب آقای ${st.name} (${st.grade || 'پایه تحصیلی'}${st.nationalId ? ` - کد ملی: ${st.nationalId}` : ''})\n` +
        `با سلام و تحیت؛\n\n` +
        `بر اساس سوابق ثبت‌شده در سامانه آموزش مدرسه ${rangeLabel}، تا کنون ${summaryPhrase} (مجموعاً ${row.totalWarningsCount} اخطار آموزشی) برای حضرتعالی به ثبت رسیده است.\n\n` +
        `لذا مقتضی است ضمن رعایت دقیق مقررات حضور مستمر در کلاس‌های درس و تکمیل منظم ساعات مطالعه و مباحثه موظفی، تعهد کتبی خود را مبنی بر جبران و عدم تکرار موارد فوق در ذیل این برگه مرقوم و امضا فرمایید.`
      );
      setShowStudentResponseBox(true);
      setStudentResponseBoxTitle('متن تعهدنامه کتبی طلبه:');
      setSig1Label('امضای طلبه متعهد');
      setSig2Label('امضای استاد / مسئول پایه');
      setSig3Label('مهر و امضای مسئول آموزش');
    } else if (tpl === 'council_notice') {
      setFormTitle('ابلاغیه طرح و رسیدگی وضعیت آموزشی در شورای آموزش');
      setBodyText(
        `طلبه محترم جناب آقای ${st.name} (${st.grade || 'پایه تحصیلی'}${st.nationalId ? ` - کد ملی: ${st.nationalId}` : ''})\n` +
        `با سلام و احترام؛\n\n` +
        `نظر به ثبت ${summaryPhrase} ${rangeLabel} در پرونده آموزشی شما، به اطلاع می‌رساند وضعیت حضور و غیاب و پیشرفت تحصیلی حضرتعالی جهت بررسی و اتخاذ تصمیم مقتضی در جلسه آتی شورای آموزش مدرسه مطرح و رسیدگی خواهد شد.\n\n` +
        `خواهشمند است پیش از تشکیل جلسه شورا، در صورت داشتن هرگونه مستندات یا توضیحات ضروری، مراتب را کتباً به دفتر آموزش ارائه نمایید.`
      );
      setShowStudentResponseBox(true);
      setStudentResponseBoxTitle('ملاحظات و مستندات ارائه‌شده جهت طرح در شورای آموزش:');
      setSig1Label('رویت و امضای طلبه');
      setSig2Label('امضای مسئول پایه');
      setSig3Label('رئیس / مسئول آموزش مدرسه');
    } else if (tpl === 'explanation_request') {
      setFormTitle('برگه مطالبه توضیحات و ارائه عذر موجه به مسئول آموزش');
      setBodyText(
        `طلبه گرامی جناب آقای ${st.name} (${st.grade || 'پایه تحصیلی'}${st.nationalId ? ` - کد ملی: ${st.nationalId}` : ''})\n` +
        `با سلام؛\n\n` +
        `پیرو بررسی وضعیت انضباطی و تحصیلی شما ${rangeLabel}، تعداد ${summaryPhrase} در سامانه ثبت گردیده است.\n\n` +
        `چنانچه درباره غیبت‌ها یا کسری ساعات مطالعه ثبت‌شده دارای عذر موجه، گواهی یا توضیح خاصی می‌باشید، لطفاً موارد را به صورت شفاف در کادر زیر درج نموده و جهت بررسی به مسئول محترم آموزش تحویل فرمایید.`
      );
      setShowStudentResponseBox(true);
      setStudentResponseBoxTitle('پاسخ و توضیحات طلبه (با ذکر دلیل و تاریخ):');
      setSig1Label('امضای طلبه');
      setSig2Label('نظریه مسئول پایه');
      setSig3Label('تایید و دستور مسئول آموزش');
    } else {
      setFormTitle('اخطاریه رسمی آموزشی و انضباطی');
      setBodyText(
        `طلبه محترم جناب آقای ${st.name} (${st.grade || 'پایه تحصیلی'}${st.nationalId ? ` - کد ملی: ${st.nationalId}` : ''})\n` +
        `با سلام؛\n\n` +
        `بدین‌وسیله به اطلاع می‌رساند مطابق گزارش سامانه پایش آموزشی ${rangeLabel}، ${summaryPhrase} برای شما ثبت شده است.\n` +
        `این برگه به عنوان اخطار رسمی در پرونده آموزشی حضرتعالی درج می‌گردد و انتظار می‌رود در اسرع وقت نسبت به اصلاح روند حضور و مطالعه اقدام فرمایید.`
      );
      setShowStudentResponseBox(false);
      setStudentResponseBoxTitle('ملاحظات طلبه:');
      setSig1Label('رویت شد (امضای طلبه)');
      setSig2Label('استاد راهنما / مسئول پایه');
      setSig3Label('مهر و امضای مسئول آموزش');
    }
  };

  const handleOpenPrintableForm = (row: StudentWarningsSummaryRow, initialTpl: FormTemplateKey = 'commitment') => {
    setFormTargetRow(row);
    const today = getTodayShamsi();
    setLetterDate(today);
    setLetterNumber(`${today.replace(/\//g, '').slice(2)}-${String(row.student.studentCode || row.student.nationalId || '101').slice(-4)}`);
    applyTemplateToForm(row, initialTpl);
  };

  const handleDirectPrint = () => {
    if (!printSheetRef.current) return;
    document.body.classList.add('printing-warning-form');
    const cleanup = () => {
      document.body.classList.remove('printing-warning-form');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove('printing-warning-form'), 1500);
    }, 120);
  };

  const handleDownloadPdf = async () => {
    if (!printSheetRef.current || !formTargetRow) return;
    setIsExportingPdf(true);
    try {
      const cleanName = String(formTargetRow.student.name || 'student').replace(/\s+/g, '_');
      await exportElementToPdf({
        element: printSheetRef.current,
        filename: `فرم_اخطار_${cleanName}_${letterDate.replace(/\//g, '-')}.pdf`,
        orientation: 'portrait',
        marginMM: 8
      });
      showToast('فایل PDF فرم با موفقیت دانلود شد.');
    } catch (err) {
      console.error('PDF export error:', err);
      showToast('خطا در تولید فایل PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleSaveFormalNoticeLog = async () => {
    if (!formTargetRow || !canEdit) return;
    setIsSavingFormLog(true);
    try {
      const nowIso = new Date().toISOString();
      const issuerName = currentUser?.fullName || currentUser?.name || currentUser?.roleTitle || 'مسئول آموزش';
      const wfNotice: WorkflowItem = {
        id: `wf_notice_letter_${formTargetRow.student.id}_${Date.now()}`,
        type: 'report_notice',
        category: 'general',
        title: `${formTitle}: ${formTargetRow.student.name}`,
        description: bodyText.slice(0, 350),
        status: 'approved',
        grade: formTargetRow.student.grade || 'عمومی',
        studentId: formTargetRow.student.id,
        studentName: formTargetRow.student.name,
        nationalId: formTargetRow.student.nationalId,
        requiresEducationApproval: false,
        approvedByUserId: currentUser?.id,
        approvedByName: issuerName,
        approvedAt: nowIso,
        createdByUserId: currentUser?.id,
        createdByName: issuerName,
        createdAt: nowIso,
        updatedAt: nowIso,
        details: {
          isFormalNoticeLetter: true,
          templateType: selectedTemplate,
          letterNumber,
          letterDate,
          formTitle,
          fullBodyText: bodyText,
          attendanceWarningsCount: formTargetRow.attendanceWarnings.length,
          studyWarningsCount: formTargetRow.studyWarnings.length
        }
      };

      await localDb.setDoc('workflow_items', wfNotice);
      const refreshed = await localDb.getDocs<WorkflowItem>('workflow_items');
      setWorkflowItems(refreshed || []);
      window.dispatchEvent(new CustomEvent('workflow_items_updated'));
      window.dispatchEvent(new CustomEvent('app_data_change', { detail: { collection: 'workflow_items', id: wfNotice.id } }));
      showToast(`سابقه «${formTitle}» برای ${formTargetRow.student.name} در سیستم ثبت گردید.`);
    } catch (err) {
      console.error('[STORAGE_FAILURE] Error saving formal notice letter log:', err);
      showToast('خطا در ذخیره سابقه فرم در پایگاه داده.');
    } finally {
      setIsSavingFormLog(false);
    }
  };

  const handleExportExcel = () => {
    try {
      const rows = filteredRows.map((row, idx) => ({
        'ردیف': idx + 1,
        'نام و نام خانوادگی طلبه': row.student.name,
        'کد ملی': row.student.nationalId || '',
        'پایه تحصیلی': row.student.grade || '',
        'تعداد اخطار حضور و غیاب': row.attendanceWarnings.length,
        'تعداد اخطار ثبت مطالعه': row.studyWarnings.length,
        'مجموع کل اخطارها': row.totalWarningsCount,
        'سوابق ابلاغیه چاپی': row.formalLetters.length,
        'بازه گزارش': rangeMode === 'all_time' ? 'از ابتدا تا کنون' : `${startDate} تا ${endDate}`
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'مدیریت اخطارها');
      XLSX.writeFile(wb, `گزارش_مدیریت_اخطارها_${getTodayShamsi().replace(/\//g, '-')}.xlsx`);
      showToast('فایل اکسل گزارش اخطارها دریافت شد.');
    } catch (err) {
      console.error('Excel export error:', err);
      showToast('خطا در تولید فایل اکسل.');
    }
  };

  if (isLoading) {
    return (
      <div className="p-10 flex flex-col items-center justify-center space-y-3 font-vazir" dir="rtl">
        <div className="w-8 h-8 border-3 border-rose-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500">در حال بارگذاری سامانه مدیریت اخطارهای طلاب...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5 font-vazir" dir="rtl">
      {/* Toast Banner */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[120] bg-slate-900 text-white px-5 py-2.5 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2 text-xs font-bold no-print"
          >
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-600 via-red-600 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/25 shrink-0">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-900">مدیریت اخطارهای طلاب (حضور و غیاب و مطالعه)</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              پایش دقیق اخطارهای ثبت‌شده به تفکیک حضور و غیاب و ثبت مطالعه به همراه صدور و چاپ فرم تعهدنامه، ارجاع به شورا و مطالبه توضیحات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <FileSpreadsheet size={15} />
            <span>خروجی اکسل</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 no-print">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 block">طلاب دارای اخطار</span>
            <span className="text-2xl font-black font-mono text-slate-900 mt-1 block">{kpis.studentsWithAnyWarning}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-rose-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-rose-600 block">اخطارهای حضور و غیاب</span>
            <span className="text-2xl font-black font-mono text-rose-700 mt-1 block">{kpis.totalAttWarnings}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
            <AlertOctagon size={20} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-700 block">اخطارهای ثبت مطالعه</span>
            <span className="text-2xl font-black font-mono text-amber-700 mt-1 block">{kpis.totalStudyWarnings}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <BookOpen size={20} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-rose-600 to-indigo-700 text-white rounded-2xl p-4 shadow-md flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-rose-100 block">مجموع کل اخطارها</span>
            <span className="text-2xl font-black font-mono text-white mt-1 block">{kpis.grandTotal}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
        </div>
      </div>

      {/* Filter & Time Range Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-4 no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Range Mode Switcher */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black text-slate-700 flex items-center gap-1.5 ml-1">
              <CalendarIcon size={15} className="text-indigo-600" />
              <span>محدوده زمانی محاسبه اخطارها:</span>
            </span>
            <button
              type="button"
              onClick={() => setRangeMode('all_time')}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-black transition-all border cursor-pointer',
                rangeMode === 'all_time'
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              )}
            >
              از ابتدا تا کنون
            </button>
            <button
              type="button"
              onClick={() => setRangeMode('custom_range')}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-black transition-all border cursor-pointer',
                rangeMode === 'custom_range'
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              )}
            >
              بازه زمانی مشخص
            </button>
          </div>

          {rangeMode === 'custom_range' && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-40">
                <ShamsiDatePicker value={startDate} onChange={setStartDate} placeholder="از تاریخ..." />
              </div>
              <span className="text-xs font-bold text-slate-400">تا</span>
              <div className="w-40">
                <ShamsiDatePicker value={endDate} onChange={setEndDate} placeholder="تا تاریخ..." />
              </div>
              <button
                type="button"
                onClick={() => {
                  const today = getTodayShamsi();
                  setStartDate(subtractDaysShamsi(today, 30));
                  setEndDate(today);
                }}
                className="px-2.5 py-1.5 text-[11px] font-bold bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200 hover:bg-indigo-100 cursor-pointer"
              >
                ۳۰ روز اخیر
              </button>
            </div>
          )}
        </div>

        {/* Search, Grade & Type Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search size={14} className="absolute right-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی نام طلبه، کد ملی یا کد طلبگی..."
              className="w-full pr-9 pl-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="w-full p-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 focus:bg-white outline-none"
          >
            <option value="all">همه پایه‌های تحصیلی</option>
            <option value="پایه ۷">پایه ۷</option>
            <option value="پایه ۸">پایه ۸</option>
            <option value="پایه ۹">پایه ۹</option>
            <option value="پایه ۱۰">پایه ۱۰</option>
            <option value="پایه ۱۱">پایه ۱۱</option>
          </select>

          <select
            value={warningTypeFilter}
            onChange={(e) => setWarningTypeFilter(e.target.value as any)}
            className="w-full p-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 focus:bg-white outline-none"
          >
            <option value="with_warnings">طلاب دارای اخطار (حضور و غیاب یا مطالعه)</option>
            <option value="attendance_only">دارای اخطار حضور و غیاب</option>
            <option value="study_only">دارای اخطار ثبت مطالعه</option>
            <option value="both">دارای هر دو نوع اخطار</option>
            <option value="all_students">نمایش همه طلاب (حتی بدون اخطار)</option>
          </select>
        </div>
      </div>

      {/* Main Warnings Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden no-print">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-rose-600" />
            <h2 className="text-xs font-black text-slate-800">
              لیست وضعیت اخطارهای طلاب ({rangeMode === 'all_time' ? 'از ابتدا تا کنون' : `بازه ${startDate} تا ${endDate}`})
            </h2>
          </div>
          <span className="text-[11px] font-bold text-slate-500">
            تعداد ردیف‌ها: {filteredRows.length} طلبه
          </span>
        </div>

        {filteredRows.length === 0 ? (
          <div className="p-12 text-center space-y-2 text-slate-500">
            <CheckCircle2 size={36} className="mx-auto text-emerald-400" />
            <p className="text-xs font-bold text-slate-700">موردی مطابق فیلتر انتخابی یافت نشد.</p>
            <p className="text-[11px] text-slate-400">
              برای مشاهده همه طلاب یا چاپ فرم برای یک طلبه خاص، گزینه «نمایش همه طلاب» را انتخاب نمایید.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                  <th className="p-3">ردیف</th>
                  <th className="p-3">نام و نام خانوادگی طلبه</th>
                  <th className="p-3">پایه</th>
                  <th className="p-3 text-center text-rose-700">اخطارهای حضور و غیاب</th>
                  <th className="p-3 text-center text-amber-800">اخطارهای ثبت مطالعه</th>
                  <th className="p-3 text-center">مجموع کل اخطارها</th>
                  <th className="p-3 text-center">سوابق فرم چاپی</th>
                  <th className="p-3 text-center">عملیات و صدور فرم قابل ویرایش</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row, idx) => (
                  <tr key={row.student.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono text-slate-400 font-bold">{idx + 1}</td>
                    <td className="p-3">
                      <div className="font-black text-slate-900">{row.student.name}</div>
                      {row.student.nationalId && (
                        <div className="text-[10.5px] text-slate-400 font-mono mt-0.5">کد ملی: {row.student.nationalId}</div>
                      )}
                    </td>
                    <td className="p-3 font-bold text-slate-700">{row.student.grade || '---'}</td>
                    <td className="p-3 text-center">
                      {row.attendanceWarnings.length > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 border border-rose-200 font-mono font-black">
                          {row.attendanceWarnings.length} مورد
                        </span>
                      ) : (
                        <span className="text-slate-300 font-mono">۰</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {row.studyWarnings.length > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-200 font-mono font-black">
                          {row.studyWarnings.length} مورد
                        </span>
                      ) : (
                        <span className="text-slate-300 font-mono">۰</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {row.totalWarningsCount > 0 ? (
                        <span className="inline-flex items-center justify-center min-w-[32px] px-2.5 py-1 rounded-lg bg-slate-900 text-white font-mono font-black">
                          {row.totalWarningsCount}
                        </span>
                      ) : (
                        <span className="text-slate-300 font-mono">۰</span>
                      )}
                    </td>
                    <td className="p-3 text-center font-mono text-slate-600 font-bold">
                      {row.formalLetters.length > 0 ? (
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px]">
                          {row.formalLetters.length} ابلاغیه
                        </span>
                      ) : '---'}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setDetailRow(row)}
                          className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Eye size={13} />
                          <span>جزئیات ({row.totalWarningsCount})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenPrintableForm(row, 'commitment')}
                          className="px-3 py-1.5 rounded-xl text-[11px] font-black bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                        >
                          <Printer size={13} />
                          <span>صدور و چاپ فرم</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* Modal 1: Student Warnings Detail Breakdown Modal                     */}
      {/* =================================================================== */}
      <AnimatePresence>
        {detailRow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs no-print" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-3xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">ریز اخطارهای ثبت‌شده: {detailRow.student.name}</h3>
                    <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                      {detailRow.student.grade || 'پایه نامشخص'} • حضور و غیاب: {detailRow.attendanceWarnings.length} مورد • مطالعه: {detailRow.studyWarnings.length} مورد
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailRow(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-5 text-xs">
                {/* Attendance warnings */}
                <div className="space-y-2.5">
                  <h4 className="font-black text-rose-800 flex items-center gap-1.5">
                    <AlertOctagon size={15} />
                    <span>اخطارهای حضور و غیاب ({detailRow.attendanceWarnings.length} مورد)</span>
                  </h4>
                  {detailRow.attendanceWarnings.length === 0 ? (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 text-[11px] font-bold">
                      هیچ اخطار حضور و غیابی در بازه انتخابی ثبت نشده است.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {detailRow.attendanceWarnings.map(w => (
                        <div key={w.id} className="p-3 rounded-2xl bg-rose-50/60 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-1">
                            <div className="font-black text-rose-950">{w.courseOrPeriodTitle}</div>
                            <div className="text-[11px] text-rose-800 leading-relaxed">{w.description}</div>
                            {w.issuerName && <div className="text-[10px] text-slate-500 font-bold">ثبت‌کننده: {w.issuerName}</div>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 font-mono text-[11px] font-bold text-rose-800">
                              {w.dateShamsi}
                            </span>
                            <span className={cn(
                              'px-2 py-1 rounded-lg text-[10px] font-black',
                              w.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                            )}>
                              {w.status === 'pending' ? 'در انتظار تایید' : 'ثبت قطعی'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Study warnings */}
                <div className="space-y-2.5">
                  <h4 className="font-black text-amber-900 flex items-center gap-1.5">
                    <BookOpen size={15} />
                    <span>اخطارهای ثبت مطالعه ({detailRow.studyWarnings.length} مورد)</span>
                  </h4>
                  {detailRow.studyWarnings.length === 0 ? (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 text-[11px] font-bold">
                      هیچ اخطار ثبت مطالعه‌ای در بازه انتخابی ثبت نشده است.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {detailRow.studyWarnings.map(w => (
                        <div key={w.id} className="p-3 rounded-2xl bg-amber-50/60 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-1">
                            <div className="font-black text-amber-950">{w.courseOrPeriodTitle}</div>
                            <div className="text-[11px] text-amber-900 leading-relaxed">{w.description}</div>
                            {w.issuerName && <div className="text-[10px] text-slate-500 font-bold">ثبت‌کننده: {w.issuerName}</div>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="px-2.5 py-1 rounded-lg bg-white border border-amber-200 font-mono text-[11px] font-bold text-amber-900">
                              {w.dateShamsi}
                            </span>
                            <span className={cn(
                              'px-2 py-1 rounded-lg text-[10px] font-black',
                              w.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                            )}>
                              {w.status === 'pending' ? 'در انتظار تایید' : 'ثبت قطعی'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Issued formal letters log */}
                {detailRow.formalLetters.length > 0 && (
                  <div className="space-y-2.5">
                    <h4 className="font-black text-indigo-900 flex items-center gap-1.5">
                      <History size={15} />
                      <span>سوابق فرم‌ها و ابلاغیه‌های صادرشده ({detailRow.formalLetters.length} مورد)</span>
                    </h4>
                    <div className="space-y-2">
                      {detailRow.formalLetters.map(ltr => (
                        <div key={ltr.id} className="p-3 rounded-2xl bg-indigo-50/50 border border-indigo-200 flex items-center justify-between gap-2">
                          <div>
                            <div className="font-black text-indigo-950">{ltr.details?.formTitle || ltr.title}</div>
                            <div className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{ltr.details?.fullBodyText || ltr.description}</div>
                          </div>
                          <div className="text-left shrink-0 text-[10.5px] font-mono text-indigo-800 font-bold">
                            <div>شماره: {ltr.details?.letterNumber || '---'}</div>
                            <div>تاریخ: {ltr.details?.letterDate || '---'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setDetailRow(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 cursor-pointer"
                >
                  بستن
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = detailRow;
                    setDetailRow(null);
                    handleOpenPrintableForm(target, 'commitment');
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Printer size={15} />
                  <span>تنظیم و چاپ فرم برای این طلبه</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =================================================================== */}
      {/* Modal 2: Editable Printable Form Builder (A4 RTL Print + PDF)        */}
      {/* =================================================================== */}
      <AnimatePresence>
        {formTargetRow && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-black/55 backdrop-blur-xs" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="bg-slate-100 rounded-3xl max-w-6xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden"
            >
              {/* Modal Top Toolbar */}
              <div className="p-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 no-print">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      صدور و چاپ فرم قابل ویرایش — {formTargetRow.student.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-bold">
                      انتخاب الگو، ویرایش کامل متن و چاپ مستقیم یا خروجی PDF
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {canEdit && (
                    <button
                      type="button"
                      disabled={isSavingFormLog}
                      onClick={handleSaveFormalNoticeLog}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <ClipboardCheck size={15} />
                      <span>{isSavingFormLog ? 'در حال ثبت...' : 'ثبت در سوابق طلبه'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isExportingPdf}
                    onClick={handleDownloadPdf}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Download size={15} />
                    <span>{isExportingPdf ? 'در حال ساخت PDF...' : 'دانلود PDF'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDirectPrint}
                    className="px-4 py-2 rounded-xl text-xs font-black bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Printer size={15} />
                    <span>چاپ مستقیم فرم</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormTargetRow(null)}
                    className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Split Body: Left Editor / Right Live Printable A4 Preview */}
              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Editor Controls */}
                <div className="lg:col-span-5 bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-4 no-print">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-800 block">انتخاب نوع فرم (با قابلیت ویرایش آزاد):</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'commitment' as FormTemplateKey, label: 'تعهدنامه کتبی طلبه' },
                        { key: 'council_notice' as FormTemplateKey, label: 'ارجاع به شورای آموزش' },
                        { key: 'explanation_request' as FormTemplateKey, label: 'مطالبه توضیحات از طلبه' },
                        { key: 'formal_warning' as FormTemplateKey, label: 'اخطاریه رسمی انضباطی' }
                      ].map(t => (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => applyTemplateToForm(formTargetRow, t.key)}
                          className={cn(
                            'p-2.5 rounded-xl text-[11px] font-black border text-right transition-all cursor-pointer',
                            selectedTemplate === t.key
                              ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-rose-50'
                          )}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 mb-1 block">عبارت بالا (بسمه تعالی):</label>
                      <input
                        type="text"
                        value={bismillahText}
                        onChange={(e) => setBismillahText(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-bold outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 mb-1 block">شماره نامه / فرم:</label>
                      <input
                        type="text"
                        value={letterNumber}
                        onChange={(e) => setLetterNumber(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-mono font-bold outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 mb-1 block">نام واحد / مدرسه:</label>
                      <input
                        type="text"
                        value={headerInstitution}
                        onChange={(e) => setHeaderInstitution(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-bold outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 mb-1 block">تاریخ صدور:</label>
                      <input
                        type="text"
                        value={letterDate}
                        onChange={(e) => setLetterDate(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-mono font-bold outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 mb-1 block">عنوان اصلی برگه:</label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-black outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 mb-1 block">متن قابل ویرایش ابلاغیه / تعهدنامه / توضیحات:</label>
                    <textarea
                      rows={8}
                      value={bodyText}
                      onChange={(e) => setBodyText(e.target.value)}
                      className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-medium leading-7 outline-none resize-y"
                    />
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeWarningsTable}
                        onChange={(e) => setIncludeWarningsTable(e.target.checked)}
                        className="w-4 h-4 accent-indigo-600 rounded"
                      />
                      <span>درج خلاصه و جدول اخطارهای حضور و غیاب و مطالعه در برگه</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showStudentResponseBox}
                        onChange={(e) => setShowStudentResponseBox(e.target.checked)}
                        className="w-4 h-4 accent-indigo-600 rounded"
                      />
                      <span>نمایش کادر خط‌کشی‌شده برای نوشتن تعهد یا توضیحات طلبه</span>
                    </label>

                    {showStudentResponseBox && (
                      <input
                        type="text"
                        value={studentResponseBoxTitle}
                        onChange={(e) => setStudentResponseBoxTitle(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold outline-none"
                        placeholder="عنوان کادر پاسخ طلبه..."
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">امضای اول:</label>
                      <input
                        type="text"
                        value={sig1Label}
                        onChange={(e) => setSig1Label(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-bold outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">امضای دوم:</label>
                      <input
                        type="text"
                        value={sig2Label}
                        onChange={(e) => setSig2Label(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-bold outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">امضای سوم:</label>
                      <input
                        type="text"
                        value={sig3Label}
                        onChange={(e) => setSig3Label(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-bold outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Live A4 Print Sheet Preview */}
                <div className="lg:col-span-7 flex justify-center">
                  <div
                    id="warning-form-print-sheet"
                    ref={printSheetRef}
                    className="bg-white w-full max-w-[210mm] min-h-[260mm] p-8 sm:p-10 rounded-2xl border border-slate-300 shadow-md text-slate-900 flex flex-col justify-between space-y-6"
                    dir="rtl"
                  >
                    <div className="space-y-6">
                      {/* Header Block */}
                      <div className="border-b-2 border-slate-800 pb-4">
                        <div className="text-center font-black text-sm text-slate-800 mb-2">{bismillahText}</div>
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="text-base font-black text-slate-950">{headerInstitution}</div>
                            <div className="text-sm font-black text-rose-800">{formTitle}</div>
                          </div>
                          <div className="text-xs font-bold text-slate-700 space-y-1 text-left shrink-0 border border-slate-300 rounded-xl px-3 py-2 bg-slate-50/70">
                            <div>شماره: <span className="font-mono font-black">{letterNumber || '---'}</span></div>
                            <div>تاریخ: <span className="font-mono font-black">{letterDate}</span></div>
                          </div>
                        </div>
                      </div>

                      {/* Student Identity Box */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs">
                        <div>
                          <span className="text-slate-500 font-bold">نام طلبه: </span>
                          <span className="font-black text-slate-950">{formTargetRow.student.name}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-bold">پایه: </span>
                          <span className="font-black text-slate-950">{formTargetRow.student.grade || '---'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-bold">کد ملی: </span>
                          <span className="font-mono font-black text-slate-950">{formTargetRow.student.nationalId || '---'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-bold">بازه: </span>
                          <span className="font-black text-slate-950">
                            {rangeMode === 'all_time' ? 'از ابتدا تا کنون' : `${startDate} الی ${endDate}`}
                          </span>
                        </div>
                      </div>

                      {/* Editable Letter Body */}
                      <div className="text-[13px] leading-8 text-slate-900 font-medium whitespace-pre-wrap text-justify">
                        {bodyText}
                      </div>

                      {/* Optional Warnings Breakdown Table */}
                      {includeWarningsTable && (
                        <div className="space-y-2.5 pt-2">
                          <div className="flex items-center justify-between text-xs font-black text-slate-800 border-b border-slate-300 pb-1">
                            <span>خلاصه آماری و فهرست اخطارهای ثبت‌شده</span>
                            <span>
                              حضور و غیاب: {formTargetRow.attendanceWarnings.length} مورد | ثبت مطالعه: {formTargetRow.studyWarnings.length} مورد
                            </span>
                          </div>
                          {formTargetRow.totalWarningsCount === 0 ? (
                            <p className="text-xs text-slate-500 font-medium">در بازه انتخابی اخطار ثبت‌شده‌ای وجود ندارد.</p>
                          ) : (
                            <table className="w-full text-right text-[11px] border border-slate-300 border-collapse">
                              <thead>
                                <tr className="bg-slate-100 text-slate-900 font-black">
                                  <th className="p-2 border border-slate-300">ردیف</th>
                                  <th className="p-2 border border-slate-300">نوع اخطار</th>
                                  <th className="p-2 border border-slate-300">درس / دوره</th>
                                  <th className="p-2 border border-slate-300">تاریخ</th>
                                  <th className="p-2 border border-slate-300">شرح / علت</th>
                                </tr>
                              </thead>
                              <tbody>
                                {[...formTargetRow.attendanceWarnings, ...formTargetRow.studyWarnings].slice(0, 14).map((w, i) => (
                                  <tr key={w.id}>
                                    <td className="p-1.5 border border-slate-300 font-mono text-center">{i + 1}</td>
                                    <td className="p-1.5 border border-slate-300 font-bold">
                                      {w.category === 'attendance' ? 'حضور و غیاب' : 'ثبت مطالعه'}
                                    </td>
                                    <td className="p-1.5 border border-slate-300 font-bold">{w.courseOrPeriodTitle}</td>
                                    <td className="p-1.5 border border-slate-300 font-mono text-center">{w.dateShamsi}</td>
                                    <td className="p-1.5 border border-slate-300">{w.description}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}

                      {/* Optional Student Commitment / Explanation Box */}
                      {showStudentResponseBox && (
                        <div className="border-2 border-dashed border-slate-400 rounded-xl p-4 space-y-3 bg-slate-50/40">
                          <div className="text-xs font-black text-slate-800">{studentResponseBoxTitle}</div>
                          <div className="space-y-5 pt-2">
                            <div className="border-b border-dotted border-slate-400 h-4" />
                            <div className="border-b border-dotted border-slate-400 h-4" />
                            <div className="border-b border-dotted border-slate-400 h-4" />
                            <div className="border-b border-dotted border-slate-400 h-4" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Signatures Footer */}
                    <div className="grid grid-cols-3 gap-6 pt-8 border-t border-slate-300 text-center text-xs font-black text-slate-800">
                      <div className="space-y-12">
                        <div>{sig1Label}</div>
                        <div className="border-t border-slate-300 pt-1 text-[10px] font-normal text-slate-500">تاریخ و امضا</div>
                      </div>
                      <div className="space-y-12">
                        <div>{sig2Label}</div>
                        <div className="border-t border-slate-300 pt-1 text-[10px] font-normal text-slate-500">تاریخ و امضا</div>
                      </div>
                      <div className="space-y-12">
                        <div>{sig3Label}</div>
                        <div className="border-t border-slate-300 pt-1 text-[10px] font-normal text-slate-500">مهر و امضا</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
