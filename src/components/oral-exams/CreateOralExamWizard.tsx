import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Award, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Users, 
  BookOpen, 
  Printer, 
  Download, 
  Save, 
  Archive, 
  RotateCcw, 
  X, 
  FileText, 
  Check, 
  Layers, 
  Eye, 
  UserCheck, 
  ChevronDown, 
  ChevronRight,
  ChevronLeft,
  Clock,
  Sparkles,
  ArrowRight,
  FileSpreadsheet,
  FileSignature,
  FileEdit,
  UserPlus,
  HelpCircle,
  Clock3
} from 'lucide-react';
import { 
  OralExamPeriod, 
  OralExamStudentRecord, 
  Student, 
  Teacher, 
  ScopeBook, 
  OralExamExaminer, 
  ScopeMainRange, 
  ScopeSubRange,
  OralExam
} from '../../types';
import { TIME_SLOTS_15MIN } from '../../lib/oralExamScopeSeeds';
import { exportBulletinBoardExcel, exportOralExamA5WordDoc, exportPeriodResultsExcel } from './OralExamDocGenerator';
import { localDb } from '../../lib/localDb';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import ShamsiDatePicker from '../ShamsiDatePicker';

interface CreateOralExamWizardProps {
  students: Student[];
  teachers: Teacher[];
  scopeBooks: ScopeBook[];
  existingPeriod?: OralExamPeriod | null;
  onFinishPeriod: (period: OralExamPeriod) => void;
  onCancel: () => void;
}

export default function CreateOralExamWizard({
  students,
  teachers,
  scopeBooks,
  existingPeriod,
  onFinishPeriod,
  onCancel
}: CreateOralExamWizardProps) {
  // Wizard Step: 1 = تنظیمات اولیه و اساتید, 2 = جدول طلاب، محدوده و ساعت, 3 = فاز برگزاری و ثبت نمرات
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(existingPeriod?.status === 'conducting' ? 3 : 1);

  // -------------------------------------------------------------
  // STEP 1 STATE: PERIOD SETTINGS & EXAMINERS
  // -------------------------------------------------------------
  const [periodTitle, setPeriodTitle] = useState<string>(existingPeriod?.title || '');
  const [academicYear, setAcademicYear] = useState<string>(existingPeriod?.academicYear || '۱۴۰۳-۱۴۰۴');
  const [examDate, setExamDate] = useState<string>(existingPeriod?.examDate || new Date().toLocaleDateString('fa-IR'));
  const [targetGrade, setTargetGrade] = useState<string>(existingPeriod?.grade || 'پایه ۹');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);

  // Flexible grade matching for Persian/English digits and spacing
  const isGradeMatch = (g1?: string, g2?: string) => {
    if (!g1 || !g2) return false;
    const norm = (s: string) => s.replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)]).trim().toLowerCase();
    const n1 = norm(g1);
    const n2 = norm(g2);
    return n1 === n2 || n1.includes(n2) || n2.includes(n1);
  };
  const [examType, setExamType] = useState<'both' | 'fiqh' | 'usul' | 'entrance'>(
    existingPeriod?.examType || (targetGrade === 'امتحان ورودی' ? 'entrance' : 'both')
  );

  // Books selected
  const [hasFiqh, setHasFiqh] = useState<boolean>(existingPeriod?.hasFiqh ?? (examType !== 'usul'));
  const [fiqhBooks, setFiqhBooks] = useState<string[]>(existingPeriod?.fiqhBooks || ['مکاسب']);
  const [hasUsul, setHasUsul] = useState<boolean>(existingPeriod?.hasUsul ?? (examType !== 'fiqh'));
  const [usulBooks, setUsulBooks] = useState<string[]>(existingPeriod?.usulBooks || ['رسائل']);

  // Participating Students IDs
  const [participatingStudentIds, setParticipatingStudentIds] = useState<string[]>(
    existingPeriod?.participatingStudentIds || []
  );

  // Search to add other students manually (even from other grades)
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [studentSearchGradeFilter, setStudentSearchGradeFilter] = useState<string>('all');
  const [isStudentSearchOpen, setIsStudentSearchOpen] = useState<boolean>(false);

  // Examiners List (with duty: 'fiqh' | 'usul' | 'both')
  const [examiners, setExaminers] = useState<OralExamExaminer[]>(
    existingPeriod?.examiners || [
      { id: 'ex_1', teacherName: 'استاد رضوانی', source: 'teachers_bank', duty: 'both' }
    ]
  );

  // Teacher Bank Search Dropdown
  const [isTeacherBankOpen, setIsTeacherBankOpen] = useState<boolean>(false);
  const [teacherBankSearch, setTeacherBankSearch] = useState<string>('');

  // Oral Exam Teacher Bank Search Dropdown
  const [isOralTeacherBankOpen, setIsOralTeacherBankOpen] = useState<boolean>(false);
  const [oralTeacherBankSearch, setOralTeacherBankSearch] = useState<string>('');
  const [customExaminerNameInput, setCustomExaminerNameInput] = useState<string>('');

  // -------------------------------------------------------------
  // STEP 2 & 3 STATE: STUDENT RECORDS MAP
  // -------------------------------------------------------------
  const [recordsMap, setRecordsMap] = useState<Record<string, OralExamStudentRecord>>({});

  // Quick Scope Autocomplete state (for Step 2)
  const [activeScopeSearch, setActiveScopeSearch] = useState<{
    studentId: string;
    course: 'fiqh' | 'usul';
  } | null>(null);
  const [scopeSearchQuery, setScopeSearchQuery] = useState<string>('');

  // Quick auto time step
  const [autoStartTime, setAutoStartTime] = useState<string>('08:00');

  // Exam Category (امتحان طول سال vs امتحان ورودی)
  const [examCategory, setExamCategory] = useState<'academic' | 'entrance'>(
    existingPeriod?.grade === 'امتحان ورودی' || existingPeriod?.examType === 'entrance' ? 'entrance' : 'academic'
  );

  // Time Interval Step for Step 2 (۱۵ دقیقه، ۲۰ دقیقه، ۳۰ دقیقه)
  const [timeIntervalStep, setTimeIntervalStep] = useState<15 | 20 | 30>(20);

  // Show Scopes in Bulletin Board Print Toggle (اصلاح ۸)
  const [showScopesInPrint, setShowScopesInPrint] = useState<boolean>(true);

  // Quick Entrance Exam Applicants Form State (اصلاح ۴)
  const [applicantRows, setApplicantRows] = useState<Array<{ id: string; fullName: string; nationalId: string; phone: string; notes: string }>>([
    { id: 'app_1', fullName: '', nationalId: '', phone: '', notes: '' },
    { id: 'app_2', fullName: '', nationalId: '', phone: '', notes: '' },
    { id: 'app_3', fullName: '', nationalId: '', phone: '', notes: '' }
  ]);
  const [isSavingApplicants, setIsSavingApplicants] = useState<boolean>(false);

  // Print/A5 Preview Modal
  const [isA5PreviewOpen, setIsA5PreviewOpen] = useState<boolean>(false);
  const [isBulletinBoardPreviewOpen, setIsBulletinBoardPreviewOpen] = useState<boolean>(false);

  // Examiner Notes Modal (during Step 3)
  const [activeNoteStudent, setActiveNoteStudent] = useState<OralExamStudentRecord | null>(null);
  const [tempNoteText, setTempNoteText] = useState<string>('');

  // Students Map
  const studentsMap = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach(s => map.set(s.id, s));
    return map;
  }, [students]);

  // Initial title generation if empty
  useEffect(() => {
    if (!periodTitle && !existingPeriod) {
      setPeriodTitle(`دوره آزمون شفاهی ${targetGrade} - نیمسال اول`);
    }
  }, [targetGrade]);

  const DRAFT_KEY = 'oral_exam_wizard_draft_v3';

  // Load draft from localStorage on initial render if no existingPeriod is provided
  useEffect(() => {
    if (!existingPeriod) {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const draft = JSON.parse(raw);
          if (draft.periodTitle) setPeriodTitle(draft.periodTitle);
          if (draft.academicYear) setAcademicYear(draft.academicYear);
          if (draft.examDate) setExamDate(draft.examDate);
          if (draft.targetGrade) setTargetGrade(draft.targetGrade);
          if (draft.examType) setExamType(draft.examType);
          if (typeof draft.hasFiqh === 'boolean') setHasFiqh(draft.hasFiqh);
          if (draft.fiqhBooks) setFiqhBooks(draft.fiqhBooks);
          if (typeof draft.hasUsul === 'boolean') setHasUsul(draft.hasUsul);
          if (draft.usulBooks) setUsulBooks(draft.usulBooks);
          if (draft.participatingStudentIds?.length) setParticipatingStudentIds(draft.participatingStudentIds);
          if (draft.examiners?.length) setExaminers(draft.examiners);
          if (draft.recordsMap && Object.keys(draft.recordsMap).length > 0) setRecordsMap(draft.recordsMap);
          if (draft.currentStep) setCurrentStep(draft.currentStep);
          if (draft.timeIntervalStep) setTimeIntervalStep(draft.timeIntervalStep);
          if (draft.autoStartTime) setAutoStartTime(draft.autoStartTime);
        }
      } catch (e) {
        console.error('Error loading draft:', e);
      }
    }
  }, [existingPeriod]);

  // Save draft whenever state changes
  useEffect(() => {
    if (!existingPeriod) {
      const draft = {
        currentStep,
        periodTitle,
        academicYear,
        examDate,
        targetGrade,
        examType,
        hasFiqh,
        fiqhBooks,
        hasUsul,
        usulBooks,
        participatingStudentIds,
        examiners,
        recordsMap,
        timeIntervalStep,
        autoStartTime
      };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch (e) {
        // Ignore storage quota error
      }
    }
  }, [
    existingPeriod,
    currentStep,
    periodTitle,
    academicYear,
    examDate,
    targetGrade,
    examType,
    hasFiqh,
    fiqhBooks,
    hasUsul,
    usulBooks,
    participatingStudentIds,
    examiners,
    recordsMap,
    timeIntervalStep,
    autoStartTime
  ]);

  // Auto-populate students when target grade changes (اصلاح ۳)
  useEffect(() => {
    if (!existingPeriod) {
      if (examCategory === 'entrance' || targetGrade === 'امتحان ورودی') {
        const entryStudents = students.filter(s => s.grade === 'ورودی' || s.grade === 'امتحان ورودی' || s.grade?.includes('ورودی'));
        if (entryStudents.length > 0) {
          setParticipatingStudentIds(entryStudents.map(s => s.id));
        }
      } else if (targetGrade && targetGrade !== 'کل پایه‌ها') {
        const gradeStudents = students.filter(s => isGradeMatch(s.grade, targetGrade));
        if (gradeStudents.length > 0) {
          setParticipatingStudentIds(gradeStudents.map(s => s.id));
        }
      }
    }
  }, [targetGrade, examCategory, existingPeriod, students]);

  // Toggle student participation (اصلاح ۳)
  const toggleStudentParticipation = (studentId: string) => {
    setParticipatingStudentIds(prev => {
      if (prev.includes(studentId)) {
        return prev.filter(id => id !== studentId);
      } else {
        return [...prev, studentId];
      }
    });
  };

  // Confirm entrance applicants and create student records (اصلاح ۴)
  const handleConfirmEntranceApplicants = async () => {
    const validApplicants = applicantRows.filter(r => r.fullName.trim() !== '');
    if (validApplicants.length === 0) {
      alert('لطفاً حداقل نام و نام خانوادگی یک داوطلب ورودی را وارد نمایید.');
      return;
    }

    setIsSavingApplicants(true);
    try {
      const newStudentIds: string[] = [];
      for (const app of validApplicants) {
        const stId = `st_entry_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newStudent: Student = {
          id: stId,
          name: app.fullName.trim(),
          nationalId: app.nationalId.trim() || undefined,
          phone: app.phone.trim() || undefined,
          grade: 'امتحان ورودی',
          isActive: true,
          createdAt: new Date().toISOString()
        };
        await localDb.addDoc('students', newStudent);
        students.push(newStudent);
        studentsMap.set(stId, newStudent);
        newStudentIds.push(stId);
      }

      setParticipatingStudentIds(prev => Array.from(new Set([...prev, ...newStudentIds])));
      alert(`${validApplicants.length.toLocaleString('fa-IR')} داوطلب آزمون ورودی با موفقیت ثبت و به لیست طلاب اضافه شدند.`);
    } catch (err) {
      console.error('Error adding entrance applicants:', err);
    } finally {
      setIsSavingApplicants(false);
    }
  };

  // Sync course switches
  const handleExamTypeChange = (type: 'both' | 'fiqh' | 'usul' | 'entrance') => {
    setExamType(type);
    if (type === 'both') {
      setHasFiqh(true);
      setHasUsul(true);
    } else if (type === 'fiqh') {
      setHasFiqh(true);
      setHasUsul(false);
    } else if (type === 'usul') {
      setHasFiqh(false);
      setHasUsul(true);
    } else if (type === 'entrance') {
      setHasFiqh(true);
      setHasUsul(true);
      setTargetGrade('امتحان ورودی');
    }
  };

  // Examiners authorized for Fiqh
  const fiqhExaminerOptions = useMemo(() => {
    return examiners.filter(e => e.duty === 'fiqh' || e.duty === 'both');
  }, [examiners]);

  // Examiners authorized for Usul
  const usulExaminerOptions = useMemo(() => {
    return examiners.filter(e => e.duty === 'usul' || e.duty === 'both');
  }, [examiners]);

  // Flatten all scope sub-ranges for instant searching
  const allFlattenedScopes = useMemo(() => {
    const list: {
      bookId: string;
      bookTitle: string;
      category: string;
      mainScopeId: string;
      mainScopeTitle: string;
      subScopeId: string;
      subScopeTitle: string;
      pages?: string;
    }[] = [];

    scopeBooks.forEach(b => {
      b.mainRanges.forEach(mr => {
        if (mr.subRanges.length === 0) {
          list.push({
            bookId: b.id,
            bookTitle: b.title,
            category: b.category,
            mainScopeId: mr.id,
            mainScopeTitle: mr.title,
            subScopeId: '',
            subScopeTitle: mr.title,
            pages: ''
          });
        } else {
          mr.subRanges.forEach(sr => {
            list.push({
              bookId: b.id,
              bookTitle: b.title,
              category: b.category,
              mainScopeId: mr.id,
              mainScopeTitle: mr.title,
              subScopeId: sr.id,
              subScopeTitle: sr.title,
              pages: sr.pages
            });
          });
        }
      });
    });

    return list;
  }, [scopeBooks]);

  // Initialize records map for all participating students
  useEffect(() => {
    const periodId = existingPeriod?.id || 'temp_period';
    const newMap: Record<string, OralExamStudentRecord> = { ...recordsMap };

    participatingStudentIds.forEach((stId, idx) => {
      const st = studentsMap.get(stId);
      if (!newMap[stId]) {
        // default slot from time slots
        const defaultSlot = TIME_SLOTS_15MIN[idx % TIME_SLOTS_15MIN.length] || '08:00';

        // default examiner
        const defaultFiqhEx = fiqhExaminerOptions[0]?.teacherName || '';
        const defaultUsulEx = usulExaminerOptions[0]?.teacherName || '';

        newMap[stId] = {
          id: `${periodId}_${stId}`,
          periodId: periodId,
          studentId: stId,
          studentName: st?.name || 'طلبه',
          nationalId: st?.nationalId,
          grade: st?.grade || targetGrade,
          phone: st?.phone,
          examTime: defaultSlot,
          fiqhExaminerTeacherName: defaultFiqhEx,
          usulExaminerTeacherName: defaultUsulEx,
          status: 'draft',
          overallStatus: 'pending',
          updatedAt: new Date().toISOString()
        };
      }
    });

    setRecordsMap(newMap);
  }, [participatingStudentIds, studentsMap]);

  // -------------------------------------------------------------
  // HANDLERS: EXAMINERS
  // -------------------------------------------------------------
  const handleAddExaminer = (teacherName: string, source: 'teachers_bank' | 'oral_exam_bank' | 'custom', duty: 'fiqh' | 'usul' | 'both' = 'both') => {
    if (!teacherName.trim()) return;
    if (examiners.some(e => e.teacherName === teacherName)) return;

    const newEx: OralExamExaminer = {
      id: `ex_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      teacherName: teacherName.trim(),
      source,
      duty
    };
    setExaminers(prev => [...prev, newEx]);
  };

  const handleRemoveExaminer = (id: string) => {
    setExaminers(prev => prev.filter(e => e.id !== id));
  };

  const handleUpdateExaminerDuty = (id: string, duty: 'fiqh' | 'usul' | 'both') => {
    setExaminers(prev => prev.map(e => e.id === id ? { ...e, duty } : e));
  };

  // -------------------------------------------------------------
  // HANDLERS: STUDENTS SELECTION
  // -------------------------------------------------------------
  const handleRemoveStudent = (stId: string) => {
    setParticipatingStudentIds(prev => prev.filter(id => id !== stId));
    setRecordsMap(prev => {
      const copy = { ...prev };
      delete copy[stId];
      return copy;
    });
  };

  const handleAddStudentManually = (st: Student) => {
    if (!participatingStudentIds.includes(st.id)) {
      setParticipatingStudentIds(prev => [...prev, st.id]);
    }
    setIsStudentSearchOpen(false);
    setStudentSearchQuery('');
  };

  // Search filtered candidate students to add
  const candidateStudentsToAdd = useMemo(() => {
    return students.filter(s => {
      if (participatingStudentIds.includes(s.id)) return false;
      if (studentSearchGradeFilter !== 'all' && s.grade !== studentSearchGradeFilter) return false;
      if (!studentSearchQuery.trim()) return true;
      const term = studentSearchQuery.trim().toLowerCase();
      return s.name.toLowerCase().includes(term) || (s.nationalId && s.nationalId.includes(term));
    }).slice(0, 20);
  }, [students, participatingStudentIds, studentSearchGradeFilter, studentSearchQuery]);

  // -------------------------------------------------------------
  // STEP 2: SCHEDULE & SCOPE ASSIGNMENT HELPERS
  // -------------------------------------------------------------
  const handleUpdateRecord = (studentId: string, updates: Partial<OralExamStudentRecord>) => {
    setRecordsMap(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        ...updates,
        updatedAt: new Date().toISOString()
      }
    }));
  };

  // Auto-schedule times with configurable interval step (15, 20, or 30 mins) for all students
  const handleAutoScheduleTimes = () => {
    const [startHourStr, startMinStr] = (autoStartTime || '08:00').split(':');
    const startHour = Number(startHourStr) || 8;
    const startMin = Number(startMinStr) || 0;
    const baseTotalMinutes = startHour * 60 + startMin;

    const newMap = { ...recordsMap };
    participatingStudentIds.forEach((stId, idx) => {
      const slotMinutes = baseTotalMinutes + idx * timeIntervalStep;
      const h = Math.floor(slotMinutes / 60) % 24;
      const m = slotMinutes % 60;
      const slotStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

      if (newMap[stId]) {
        newMap[stId].examTime = slotStr;
      }
    });
    setRecordsMap(newMap);
  };

  // Select scope from autocomplete dropdown
  const handleSelectScopeForStudent = (
    studentId: string,
    course: 'fiqh' | 'usul',
    scopeItem: typeof allFlattenedScopes[0]
  ) => {
    if (course === 'fiqh') {
      handleUpdateRecord(studentId, {
        fiqhBookTitle: scopeItem.bookTitle,
        fiqhMainScopeId: scopeItem.mainScopeId,
        fiqhMainScopeTitle: scopeItem.mainScopeTitle,
        fiqhSubScopeId: scopeItem.subScopeId,
        fiqhSubScopeTitle: scopeItem.subScopeTitle,
        fiqhPages: scopeItem.pages
      });
    } else {
      handleUpdateRecord(studentId, {
        usulBookTitle: scopeItem.bookTitle,
        usulMainScopeId: scopeItem.mainScopeId,
        usulMainScopeTitle: scopeItem.mainScopeTitle,
        usulSubScopeId: scopeItem.subScopeId,
        usulSubScopeTitle: scopeItem.subScopeTitle,
        usulPages: scopeItem.pages
      });
    }
    setActiveScopeSearch(null);
    setScopeSearchQuery('');
  };

  // -------------------------------------------------------------
  // STEP 3: WORKFLOW ACTIONS (ثبت موقت & ثبت نهایی و انتقال به بایگانی)
  // -------------------------------------------------------------
  const handleSaveTemporary = async () => {
    const periodId = existingPeriod?.id || `period_${Date.now()}`;
    const now = new Date().toISOString();

    const periodData: OralExamPeriod = {
      id: periodId,
      title: periodTitle.trim(),
      academicYear,
      examDate,
      grade: targetGrade,
      examType,
      hasFiqh,
      fiqhBooks,
      hasUsul,
      usulBooks,
      examDates: [examDate],
      examinerTeacherIds: examiners.map(e => e.teacherId || e.id),
      examinerTeacherNames: examiners.map(e => e.teacherName),
      examiners: examiners,
      hasCustomScopes: false,
      scopes: [],
      participatingStudentIds,
      status: 'conducting', // وضعیت در حال برگزاری
      createdAt: existingPeriod?.createdAt || now
    };

    // Save period
    await localDb.saveDoc('oral_exam_periods', periodData);

    // Save all student records
    const recordsList = Object.values(recordsMap).map(r => ({
      ...r,
      periodId: periodId,
      status: 'draft' as const
    }));
    await localDb.bulkPut('oral_exam_records', recordsList);

    alert('دوره آزمون شفاهی به صورت «ثبت موقت» در سیستم ذخیره گردید و در هر زمان قابل ادامه است.');
  };

  const handleFinalizeAndArchive = async () => {
    const periodId = existingPeriod?.id || `period_${Date.now()}`;
    const now = new Date().toISOString();

    const periodData: OralExamPeriod = {
      id: periodId,
      title: periodTitle.trim(),
      academicYear,
      examDate,
      grade: targetGrade,
      examType,
      hasFiqh,
      fiqhBooks,
      hasUsul,
      usulBooks,
      examDates: [examDate],
      examinerTeacherIds: examiners.map(e => e.teacherId || e.id),
      examinerTeacherNames: examiners.map(e => e.teacherName),
      examiners: examiners,
      hasCustomScopes: false,
      scopes: [],
      participatingStudentIds,
      status: 'archived', // وضعیت بایگانی شده
      createdAt: existingPeriod?.createdAt || now,
      archivedAt: now
    };

    // 1. Save Period
    await localDb.saveDoc('oral_exam_periods', periodData);
    try {
      localStorage.removeItem('oral_exam_wizard_draft_v3');
    } catch (e) {}

    // 2. Save Records
    const recordsList = Object.values(recordsMap).map(r => ({
      ...r,
      periodId: periodId,
      status: 'finalized' as const
    }));
    await localDb.bulkPut('oral_exam_records', recordsList);

    // 3. Mirror/Sync each individual exam into 'oral_exams' collection
    // So student profile, comments, and summary show these scores seamlessly!
    try {
      const existingOralExams = await localDb.getDocs<OralExam>('oral_exams') || [];
      const updatedExamsList: OralExam[] = [...existingOralExams];

      for (const rec of recordsList) {
        // Fiqh Exam doc
        if (hasFiqh && typeof rec.fiqhScore === 'number') {
          const fiqhId = `oe_${periodId}_${rec.studentId}_fiqh`;
          const fiqhExamDoc: OralExam = {
            id: fiqhId,
            studentId: rec.studentId,
            title: `امتحان شفاهی فقه - ${periodTitle}`,
            subjectType: 'فقه',
            score: rec.fiqhScore,
            examinerName: rec.fiqhExaminerTeacherName || 'استاد ممتحن فقه',
            date: examDate,
            isRetake: rec.fiqhIsRetake || false,
            periodId: periodId,
            periodTitle: periodTitle,
            scopeTitle: [rec.fiqhMainScopeTitle, rec.fiqhSubScopeTitle, rec.fiqhPages].filter(Boolean).join(' - '),
            examinerNotes: rec.fiqhExaminerNotes || rec.examinerNotes,
            createdAt: now,
            updatedAt: now
          };
          const fIdx = updatedExamsList.findIndex(e => e.id === fiqhId);
          if (fIdx >= 0) updatedExamsList[fIdx] = fiqhExamDoc;
          else updatedExamsList.push(fiqhExamDoc);
        }

        // Usul Exam doc
        if (hasUsul && typeof rec.usulScore === 'number') {
          const usulId = `oe_${periodId}_${rec.studentId}_usul`;
          const usulExamDoc: OralExam = {
            id: usulId,
            studentId: rec.studentId,
            title: `امتحان شفاهی اصول - ${periodTitle}`,
            subjectType: 'اصول',
            score: rec.usulScore,
            examinerName: rec.usulExaminerTeacherName || 'استاد ممتحن اصول',
            date: examDate,
            isRetake: rec.usulIsRetake || false,
            periodId: periodId,
            periodTitle: periodTitle,
            scopeTitle: [rec.usulMainScopeTitle, rec.usulSubScopeTitle, rec.usulPages].filter(Boolean).join(' - '),
            examinerNotes: rec.usulExaminerNotes || rec.examinerNotes,
            createdAt: now,
            updatedAt: now
          };
          const uIdx = updatedExamsList.findIndex(e => e.id === usulId);
          if (uIdx >= 0) updatedExamsList[uIdx] = usulExamDoc;
          else updatedExamsList.push(usulExamDoc);
        }
      }

      await localDb.bulkPut('oral_exams', updatedExamsList);
    } catch (err) {
      console.error('Error syncing individual oral exams to profile:', err);
    }

    alert('دوره آزمون شفاهی با موفقیت ثبت نهایی شد، نمرات در پرونده طلاب درج گردید و به بخش بایگانی (سوابق) انتقال یافت.');
    onFinishPeriod(periodData);
  };

  // Filtered scopes for quick search in Step 2 (اصلاح ۴ و ۷)
  const matchingScopeItems = useMemo(() => {
    if (!activeScopeSearch) return [];
    const term = scopeSearchQuery.trim().toLowerCase();
    const stRec = recordsMap[activeScopeSearch.studentId];

    return allFlattenedScopes.filter(s => {
      if (activeScopeSearch.course === 'fiqh') {
        if (s.category === 'usul') return false;
        const selectedBook = stRec?.fiqhBookTitle;
        if (selectedBook) {
          if (!s.bookTitle.includes(selectedBook) && !selectedBook.includes(s.bookTitle)) return false;
        } else if (fiqhBooks.length > 0) {
          const matchBook = fiqhBooks.some(fb => s.bookTitle.includes(fb) || fb.includes(s.bookTitle));
          if (!matchBook && s.category !== 'entrance') return false;
        }
      }
      if (activeScopeSearch.course === 'usul') {
        if (s.category === 'fiqh') return false;
        const selectedBook = stRec?.usulBookTitle;
        if (selectedBook) {
          if (!s.bookTitle.includes(selectedBook) && !selectedBook.includes(s.bookTitle)) return false;
        } else if (usulBooks.length > 0) {
          const matchBook = usulBooks.some(ub => s.bookTitle.includes(ub) || ub.includes(s.bookTitle));
          if (!matchBook && s.category !== 'entrance') return false;
        }
      }

      if (!term) return true;
      return s.bookTitle.toLowerCase().includes(term) ||
             s.mainScopeTitle.toLowerCase().includes(term) ||
             s.subScopeTitle.toLowerCase().includes(term) ||
             (s.pages && s.pages.toLowerCase().includes(term));
    }).slice(0, 20);
  }, [activeScopeSearch, scopeSearchQuery, allFlattenedScopes, fiqhBooks, usulBooks, recordsMap]);

  return (
    <div className="space-y-6">
      {/* Wizard Step Progression Bar */}
      <div className="bg-white/90 backdrop-blur-md p-3 sm:p-4 rounded-3xl border border-slate-200/90 shadow-md flex items-center justify-between gap-2 overflow-x-auto">
        <button
          onClick={() => setCurrentStep(1)}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer whitespace-nowrap flex-1 justify-center",
            currentStep === 1 
              ? "bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-400/50 scale-[1.01]" 
              : "bg-slate-100/90 text-slate-700 hover:bg-slate-200/80 hover:text-indigo-900"
          )}
        >
          <span className={cn(
            "w-7 h-7 rounded-xl text-xs flex items-center justify-center font-black shadow-inner transition-colors",
            currentStep === 1 ? "bg-white text-indigo-800" : "bg-slate-200 text-slate-700"
          )}>۱</span>
          <div className="text-right">
            <div>مرحله ۱: تنظیمات دوره و اساتید</div>
            <div className={cn("text-[10px] font-normal", currentStep === 1 ? "text-indigo-100" : "text-slate-500")}>عنوان، درس‌ها و اساتید ممتحن</div>
          </div>
        </button>

        <ChevronLeft size={18} className="text-slate-300 shrink-0 hidden sm:block" />

        <button
          onClick={() => {
            if (!periodTitle.trim()) {
              alert('لطفاً عنوان دوره را در مرحله ۱ وارد نمایید.');
              return;
            }
            if (examiners.length === 0) {
              alert('لطفاً حداقل یک استاد ممتحن برای دوره تعیین فرمایید.');
              return;
            }
            if (participatingStudentIds.length === 0) {
              alert('لطفاً حداقل یک طلبه برای دوره انتخاب فرمایید.');
              return;
            }
            setCurrentStep(2);
          }}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer whitespace-nowrap flex-1 justify-center",
            currentStep === 2 
              ? "bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white shadow-lg shadow-purple-500/25 ring-2 ring-purple-400/50 scale-[1.01]" 
              : "bg-slate-100/90 text-slate-700 hover:bg-slate-200/80 hover:text-indigo-900"
          )}
        >
          <span className={cn(
            "w-7 h-7 rounded-xl text-xs flex items-center justify-center font-black shadow-inner transition-colors",
            currentStep === 2 ? "bg-white text-purple-800" : "bg-slate-200 text-slate-700"
          )}>۲</span>
          <div className="text-right">
            <div>مرحله ۲: جدول طلاب و محدوده</div>
            <div className={cn("text-[10px] font-normal", currentStep === 2 ? "text-purple-100" : "text-slate-500")}>تخصیص ساعت و محدوده نهایی</div>
          </div>
        </button>

        <ChevronLeft size={18} className="text-slate-300 shrink-0 hidden sm:block" />

        <button
          onClick={() => {
            if (currentStep < 2) setCurrentStep(2);
            setCurrentStep(3);
          }}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer whitespace-nowrap flex-1 justify-center",
            currentStep === 3 
              ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-400/50 scale-[1.01]" 
              : "bg-slate-100/90 text-slate-700 hover:bg-slate-200/80 hover:text-emerald-900"
          )}
        >
          <span className={cn(
            "w-7 h-7 rounded-xl text-xs flex items-center justify-center font-black shadow-inner transition-colors",
            currentStep === 3 ? "bg-white text-emerald-800" : "bg-slate-200 text-slate-700"
          )}>۳</span>
          <div className="text-right">
            <div>مرحله ۳: برگزاری و ثبت نمرات</div>
            <div className={cn("text-[10px] font-normal", currentStep === 3 ? "text-emerald-100" : "text-slate-500")}>درج نمرات، A5 و بایگانی نهایی</div>
          </div>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* STEP 1: INITIAL SETTINGS, EXAMINERS & STUDENTS                            */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-8 shadow-xs">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              تنظیمات اولیه دوره و انتخاب اساتید ممتحن
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              عنوان دوره، سال تحصیلی، تاریخ برگزاری، دروس مورد آزمون و اساتید ممتحن را از بانک اساتید انتخاب و تفکیک نمایید.
            </p>
          </div>

          {/* Exam Category Switcher (امتحان ورودی vs طول سال) - اصلاح ۴ */}
          <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-2 border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setExamCategory('academic');
                if (targetGrade === 'امتحان ورودی') setTargetGrade('پایه ۹');
                if (examType === 'entrance') setExamType('both');
              }}
              className={cn(
                "flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2",
                examCategory === 'academic'
                  ? "bg-white text-indigo-900 shadow-sm border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <BookOpen size={16} className="text-indigo-600" />
              <span>امتحان طول سال (دوره‌ای / پایه‌ای)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setExamCategory('entrance');
                setTargetGrade('امتحان ورودی');
                setExamType('entrance');
              }}
              className={cn(
                "flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2",
                examCategory === 'entrance'
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Award size={16} />
              <span>امتحان ورودی (داوطلبان جدید و خارج از موسسه)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Period Title */}
            <div className="md:col-span-2 space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                عنوان دوره آزمون شفاهی <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={periodTitle}
                onChange={(e) => setPeriodTitle(e.target.value)}
                placeholder={examCategory === 'entrance' ? "مثلاً: آزمون شفاهی ورودی طلاب جدیدالورود - دوره پاییز" : "مثلاً: دوره آزمون شفاهی پایه ۹ - آذر ۱۴۰۳"}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-800"
              />
            </div>

            {/* Academic Year Select Dropdown (اصلاح ۴) */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">سال تحصیلی (انتخابی)</label>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-800 cursor-pointer"
              >
                {['۱۴۰۲-۱۴۰۳', '۱۴۰۳-۱۴۰۴', '۱۴۰۴-۱۴۰۵', '۱۴۰۵-۱۴۰۶', '۱۴۰۶-۱۴۰۷'].map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>

            {/* Exam Date */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">تاریخ برگزاری (شمسی)</label>
              <ShamsiDatePicker
                value={examDate}
                onChange={(d) => setExamDate(d)}
                placeholder="انتخاب تاریخ برگزاری"
              />
            </div>

            {/* Grade Selection (Only shown for Academic Year, hidden for Entrance) */}
            {examCategory === 'academic' && (
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">پایه تحصیلی هدف</label>
                <select
                  value={targetGrade}
                  onChange={(e) => {
                    const newGrade = e.target.value;
                    setTargetGrade(newGrade);
                    if (newGrade === 'امتحان ورودی') {
                      handleExamTypeChange('entrance');
                      setExamCategory('entrance');
                    } else if (newGrade && newGrade !== 'کل پایه‌ها') {
                      const matched = students.filter(s => isGradeMatch(s.grade, newGrade));
                      if (matched.length > 0) {
                        setParticipatingStudentIds(matched.map(s => s.id));
                      }
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium cursor-pointer"
                >
                  <option value="پایه ۷">پایه ۷</option>
                  <option value="پایه ۸">پایه ۸</option>
                  <option value="پایه ۹">پایه ۹</option>
                  <option value="پایه ۱۰">پایه ۱۰</option>
                  <option value="کل پایه‌ها">ترکیبی / کل پایه‌ها</option>
                </select>
              </div>
            )}

            {/* Book Selection for Usul with Multi-Select Capability (اصلاح ۴) */}
            <div className="space-y-1 md:col-span-1">
              <label className="block text-xs font-bold text-indigo-900">
                کتاب/کتب مورد آزمون در اصول (امکان انتخاب چندتایی):
              </label>
              <div className="bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-200 space-y-1.5">
                {(examCategory === 'entrance' ? [
                  { id: 'اصول مرحوم مظفر', label: 'اصول الفقه (مرحوم مظفر)' },
                  { id: 'حلقه ثانیه', label: 'حلقه ثانیه (شهید صدر)' }
                ] : [
                  { id: 'رسائل', label: 'رسائل (شیخ انصاری)' },
                  { id: 'کفایه', label: 'کفایة الأصول (آخوند خراسانی)' },
                  { id: 'حلقه ثالثه', label: 'حلقه ثالثه (شهید صدر)' }
                ]).map(bk => {
                  const isChecked = usulBooks.includes(bk.id);
                  return (
                    <label key={bk.id} className="flex items-center gap-2 cursor-pointer text-xs font-bold text-indigo-950 hover:text-indigo-700 select-none">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setUsulBooks([...usulBooks, bk.id]);
                          } else {
                            if (usulBooks.length > 1) {
                              setUsulBooks(usulBooks.filter(b => b !== bk.id));
                            }
                          }
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                      <span>{bk.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Book Selection for Fiqh with Multi-Select Capability (اصلاح ۴) */}
            <div className="space-y-1 md:col-span-1">
              <label className="block text-xs font-bold text-amber-900">
                کتاب/کتب مورد آزمون در فقه (امکان انتخاب چندتایی):
              </label>
              <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200 space-y-1.5">
                {(examCategory === 'entrance' ? [
                  { id: 'لمعه', label: 'شرح اللمعة الدمشقیة (لمعه)' }
                ] : [
                  { id: 'مکاسب - محرمه', label: 'مکاسب - مکاسب محرمه' },
                  { id: 'مکاسب - بیع', label: 'مکاسب - کتاب البيع' },
                  { id: 'مکاسب - شروط متعاقدین', label: 'مکاسب - شروط متعاقدین' },
                  { id: 'مکاسب - شروط عوضین', label: 'مکاسب - شروط عوضین' }
                ]).map(bk => {
                  const isChecked = fiqhBooks.includes(bk.id);
                  return (
                    <label key={bk.id} className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-950 hover:text-amber-700 select-none">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFiqhBooks([...fiqhBooks, bk.id]);
                          } else {
                            if (fiqhBooks.length > 1) {
                              setFiqhBooks(fiqhBooks.filter(b => b !== bk.id));
                            }
                          }
                        }}
                        className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                      />
                      <span>{bk.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* EXAMINERS SECTION (دو لیست درخواستی کاربر)                     */}
          {/* ------------------------------------------------------------- */}
          <div className="pt-6 border-t border-slate-100 space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <UserCheck size={18} className="text-emerald-600" />
                <span>انتخاب اساتید ممتحن (از دو بانک اساتید)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                با کلیک بر روی هر یک از دو باکس زیر، نوار جستجو باز می‌شود و با نوشتن چند حرف اول اسامی محدود شده و با کلیک اضافه می‌گردد. در صورت برگزاری فقه و اصول، نقش هر استاد را مشخص کنید.
              </p>
            </div>

            {/* Two Selection Boxes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Box 1: Teachers Bank (بانک اساتید کل مدرسه) */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <Users size={15} className="text-slate-600" />
                    <span>۱. بانک کلی اساتید مدرسه</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTeacherBankOpen(!isTeacherBankOpen);
                      setTeacherBankSearch('');
                    }}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <Search size={13} />
                    <span>جستجو و انتخاب استاد</span>
                  </button>
                </div>

                {isTeacherBankOpen && (
                  <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-md space-y-2">
                    <input
                      type="text"
                      autoFocus
                      value={teacherBankSearch}
                      onChange={(e) => setTeacherBankSearch(e.target.value)}
                      placeholder="چند حرف از نام استاد را تایپ کنید..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-slate-800"
                    />
                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                      {teachers
                        .filter(t => (t.fullName || t.name || '').toLowerCase().includes(teacherBankSearch.trim().toLowerCase()))
                        .map(t => {
                          const tName = t.fullName || t.name || 'استاد';
                          return (
                            <div
                              key={t.id}
                              onClick={() => {
                                handleAddExaminer(tName, 'teachers_bank', 'both');
                                setIsTeacherBankOpen(false);
                              }}
                              className="p-2 hover:bg-slate-50 rounded cursor-pointer flex items-center justify-between"
                            >
                              <span className="font-bold text-slate-800">{tName}</span>
                              <span className="text-emerald-700 text-[11px]">+ افزودن ممتحن</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Box 2: Oral Exam Examiners Bank (بانک اساتید امتحان شفاهی) */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <Award size={15} className="text-indigo-600" />
                    <span>۲. بانک اساتید امتحان شفاهی</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOralTeacherBankOpen(!isOralTeacherBankOpen);
                      setOralTeacherBankSearch('');
                    }}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <Search size={13} />
                    <span>انتخاب از ممتحنین شفاهی</span>
                  </button>
                </div>

                {isOralTeacherBankOpen && (
                  <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-md space-y-2.5">
                    <input
                      type="text"
                      autoFocus
                      value={oralTeacherBankSearch}
                      onChange={(e) => setOralTeacherBankSearch(e.target.value)}
                      placeholder="جستجوی استاد امتحان شفاهی یا تایپ نام جدید..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-slate-800"
                    />

                    {/* Predefined oral examiners */}
                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 text-xs">
                      {teachers
                        .filter(t => (t.fullName || t.name || '').toLowerCase().includes(oralTeacherBankSearch.trim().toLowerCase()))
                        .map(t => {
                          const tName = t.fullName || t.name || 'استاد';
                          return (
                            <div
                              key={t.id}
                              onClick={() => {
                                handleAddExaminer(tName, 'oral_exam_bank', 'both');
                                setIsOralTeacherBankOpen(false);
                              }}
                              className="p-2 hover:bg-slate-50 rounded cursor-pointer flex items-center justify-between"
                            >
                              <span className="font-bold text-slate-800">{tName}</span>
                              <span className="text-indigo-700 text-[11px]">+ انتخاب</span>
                            </div>
                          );
                        })}
                    </div>

                    {/* Add Custom Name if not in list */}
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                      <input
                        type="text"
                        value={customExaminerNameInput}
                        onChange={(e) => setCustomExaminerNameInput(e.target.value)}
                        placeholder="نام استاد جدید (مثلاً: استاد محمدی)..."
                        className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customExaminerNameInput.trim()) {
                            handleAddExaminer(customExaminerNameInput.trim(), 'custom', 'both');
                            setCustomExaminerNameInput('');
                            setIsOralTeacherBankOpen(false);
                          }
                        }}
                        className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        افزودن
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* List of Added Examiners with Duty Selector */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 block">
                اساتید ممتحن اضافه شده به این دوره ({examiners.length} استاد):
              </span>

              {examiners.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-rose-500 font-bold border border-dashed border-rose-200">
                  هنوز هیچ استادی به عنوان ممتحن اضافه نشده است. لطفاً از باکس‌های بالا استاد را اضافه فرمایید.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {examiners.map(ex => (
                    <div
                      key={ex.id}
                      className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2.5 flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">{ex.teacherName}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveExaminer(ex.id)}
                          className="text-slate-400 hover:text-rose-600 p-0.5 rounded"
                          title="حذف استاد"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Duty Selection (فقه / اصول / هر دو) */}
                      {hasFiqh && hasUsul && (
                        <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg text-[10px]">
                          <button
                            type="button"
                            onClick={() => handleUpdateExaminerDuty(ex.id, 'both')}
                            className={cn(
                              "flex-1 py-1 rounded-md font-bold transition-all text-center",
                              ex.duty === 'both' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
                            )}
                          >
                            هر دو درس
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateExaminerDuty(ex.id, 'fiqh')}
                            className={cn(
                              "flex-1 py-1 rounded-md font-bold transition-all text-center",
                              ex.duty === 'fiqh' ? "bg-amber-100 text-amber-900 shadow-2xs" : "text-slate-600"
                            )}
                          >
                            فقط فقه
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateExaminerDuty(ex.id, 'usul')}
                            className={cn(
                              "flex-1 py-1 rounded-md font-bold transition-all text-center",
                              ex.duty === 'usul' ? "bg-indigo-100 text-indigo-900 shadow-2xs" : "text-slate-600"
                            )}
                          >
                            فقط اصول
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* PARTICIPATING STUDENTS SECTION                                */}
          {/* ------------------------------------------------------------- */}
          <div className="pt-6 border-t border-slate-100 space-y-4">
            {/* ENTRANCE EXAM FAST FORM (اصلاح ۴) */}
            {examCategory === 'entrance' ? (
              <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-amber-950 flex items-center gap-2">
                      <UserPlus size={18} className="text-amber-600" />
                      <span>ورود سریع اطلاعات طلاب متقاضی آزمون ورودی</span>
                    </h3>
                    <p className="text-xs text-amber-800/80 mt-0.5">
                      در آزمون ورودی، داوطلبان خارج از موسسه هستند. مشخصات ایشان را سریع تکمیل کرده و دکمه «تایید و ثبت» را بزنید.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setApplicantRows(prev => [
                        ...prev,
                        { id: `app_${Date.now()}`, fullName: '', nationalId: '', phone: '', notes: '' }
                      ]);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer self-start sm:self-auto shadow-xs"
                  >
                    <Plus size={14} />
                    <span>+ افزودن سطر داوطلب جدید</span>
                  </button>
                </div>

                <div className="border border-amber-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-amber-100/70 text-amber-950 font-bold border-b border-amber-200">
                      <tr>
                        <th className="p-2.5 w-10 text-center">#</th>
                        <th className="p-2.5">نام و نام خانوادگی داوطلب <span className="text-rose-500">*</span></th>
                        <th className="p-2.5 w-32">کد ملی</th>
                        <th className="p-2.5 w-32">شماره تماس</th>
                        <th className="p-2.5">سایر توضیحات / سوابق</th>
                        <th className="p-2.5 w-10 text-center">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                      {applicantRows.map((row, rIdx) => (
                        <tr key={row.id} className="hover:bg-amber-50/50">
                          <td className="p-2 text-center text-amber-800 font-bold">{rIdx + 1}</td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={row.fullName}
                              onChange={(e) => {
                                const val = e.target.value;
                                setApplicantRows(prev => prev.map(r => r.id === row.id ? { ...r, fullName: val } : r));
                              }}
                              placeholder="مثلاً: محمد حسینی..."
                              className="w-full px-2.5 py-1.5 bg-amber-50/30 border border-amber-200 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={row.nationalId}
                              onChange={(e) => {
                                const val = e.target.value;
                                setApplicantRows(prev => prev.map(r => r.id === row.id ? { ...r, nationalId: val } : r));
                              }}
                              placeholder="۰۰۱۲۳۴۵۶۷۸"
                              className="w-full px-2 py-1.5 bg-amber-50/30 border border-amber-200 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:outline-none"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={row.phone}
                              onChange={(e) => {
                                const val = e.target.value;
                                setApplicantRows(prev => prev.map(r => r.id === row.id ? { ...r, phone: val } : r));
                              }}
                              placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                              className="w-full px-2 py-1.5 bg-amber-50/30 border border-amber-200 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:outline-none"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={row.notes}
                              onChange={(e) => {
                                const val = e.target.value;
                                setApplicantRows(prev => prev.map(r => r.id === row.id ? { ...r, notes: val } : r));
                              }}
                              placeholder="توضیحات تکمیلی..."
                              className="w-full px-2 py-1.5 bg-amber-50/30 border border-amber-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:outline-none"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            {applicantRows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setApplicantRows(prev => prev.filter(r => r.id !== row.id))}
                                className="text-rose-400 hover:text-rose-600 p-1 rounded cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    disabled={isSavingApplicants}
                    onClick={handleConfirmEntranceApplicants}
                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    <CheckCircle2 size={16} />
                    <span>تایید و ثبت طلاب ورودی در آزمون</span>
                  </button>
                </div>
              </div>
            ) : (
              /* ACADEMIC YEAR GRADE STUDENTS WITH TOGGLE CHECKBOXES (اصلاح ۳) */
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <Users size={18} className="text-sky-600" />
                      <span>طلاب شرکت‌کننده در آزمون پایه {targetGrade} ({participatingStudentIds.length} نفر فعال)</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      تمامی طلاب این پایه به‌طور خودکار انتخاب شده‌اند. با کلیک روی تیک هر طلبه، او از شرکت در آزمون کنار می‌رود.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const gradeSts = students.filter(s => s.grade === targetGrade).map(s => s.id);
                        setParticipatingStudentIds(Array.from(new Set([...participatingStudentIds, ...gradeSts])));
                      }}
                      className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[11px] font-bold border border-emerald-200 cursor-pointer"
                    >
                      تیک زدن همه طلاب این پایه
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const gradeStIds = new Set(students.filter(s => s.grade === targetGrade).map(s => s.id));
                        setParticipatingStudentIds(prev => prev.filter(id => !gradeStIds.has(id)));
                      }}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-lg text-[11px] font-bold border border-rose-200 cursor-pointer"
                    >
                      از دست دادن همه
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsStudentSearchOpen(!isStudentSearchOpen)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <UserPlus size={13} />
                      <span>+ افزودن طلبه از سایر پایه‌ها</span>
                    </button>
                  </div>
                </div>

                {/* Manual Student Adder Dropdown */}
                {isStudentSearchOpen && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800">جستجو در کل طلاب مدرسه جهت افزودن به آزمون:</span>
                      <button onClick={() => setIsStudentSearchOpen(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        value={studentSearchQuery}
                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                        placeholder="نام یا کد ملی طلبه..."
                        className="sm:col-span-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-800"
                      />
                      <select
                        value={studentSearchGradeFilter}
                        onChange={(e) => setStudentSearchGradeFilter(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-medium"
                      >
                        <option value="all">همه پایه‌ها</option>
                        <option value="پایه ۷">پایه ۷</option>
                        <option value="پایه ۸">پایه ۸</option>
                        <option value="پایه ۹">پایه ۹</option>
                        <option value="پایه ۱۰">پایه ۱۰</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const allCandidateIds = candidateStudentsToAdd.map(s => s.id);
                            setSelectedCandidateIds(prev => Array.from(new Set([...prev, ...allCandidateIds])));
                          }}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold border border-indigo-200 cursor-pointer"
                        >
                          تیک زدن همه موارد این لیست ({candidateStudentsToAdd.length})
                        </button>
                        {selectedCandidateIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedCandidateIds([])}
                            className="px-2 py-1 text-slate-500 hover:text-slate-700 text-[11px] font-bold cursor-pointer"
                          >
                            لغو انتخاب
                          </button>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-slate-600">
                        {selectedCandidateIds.length} طلبه انتخاب شده
                      </span>
                    </div>

                    <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 bg-white rounded-xl border border-slate-200">
                      {candidateStudentsToAdd.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-xs">هیچ طلبه‌ای یافت نشد.</div>
                      ) : (
                        candidateStudentsToAdd.map(st => {
                          const isChecked = selectedCandidateIds.includes(st.id);
                          return (
                            <div
                              key={st.id}
                              onClick={() => {
                                setSelectedCandidateIds(prev => 
                                  prev.includes(st.id) ? prev.filter(id => id !== st.id) : [...prev, st.id]
                                );
                              }}
                              className={cn(
                                "p-2.5 hover:bg-slate-50 flex items-center justify-between cursor-pointer text-xs transition-colors select-none",
                                isChecked && "bg-indigo-50/60"
                              )}
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer pointer-events-none"
                                />
                                <div>
                                  <span className="font-bold text-slate-900">{st.name}</span>
                                  <span className="text-slate-400 text-[11px] mr-2">({st.grade || 'نامشخص'})</span>
                                </div>
                              </div>
                              <span className={cn(
                                "text-[11px] font-bold px-2 py-0.5 rounded-lg border",
                                isChecked 
                                  ? "bg-indigo-100 text-indigo-800 border-indigo-200" 
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              )}>
                                {isChecked ? 'انتخاب شده ✓' : 'کلیک برای انتخاب'}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Batch Add Confirm Button */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          setIsStudentSearchOpen(false);
                          setSelectedCandidateIds([]);
                        }}
                        className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        بستن
                      </button>
                      <button
                        type="button"
                        disabled={selectedCandidateIds.length === 0}
                        onClick={() => {
                          if (selectedCandidateIds.length === 0) return;
                          setParticipatingStudentIds(prev => Array.from(new Set([...prev, ...selectedCandidateIds])));
                          setSelectedCandidateIds([]);
                          setIsStudentSearchOpen(false);
                          setStudentSearchQuery('');
                        }}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs",
                          selectedCandidateIds.length > 0
                            ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200"
                            : "bg-slate-200 text-slate-400 cursor-not-allowed"
                        )}
                      >
                        <UserPlus size={14} />
                        <span>تایید و افزودن به آزمون ({selectedCandidateIds.length} طلبه)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Grid of Grade Students with Active Toggle Checkboxes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto p-1 border border-slate-200 rounded-2xl bg-slate-50/50">
                  {students
                    .filter(s => s.grade === targetGrade || participatingStudentIds.includes(s.id))
                    .map(st => {
                      const isSelected = participatingStudentIds.includes(st.id);
                      return (
                        <div
                          key={st.id}
                          onClick={() => toggleStudentParticipation(st.id)}
                          className={cn(
                            "p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 text-xs select-none",
                            isSelected
                              ? "bg-emerald-50/90 border-emerald-300 text-emerald-950 font-extrabold shadow-2xs"
                              : "bg-white border-slate-200 text-slate-400 opacity-60 hover:opacity-100"
                          )}
                        >
                          <div className="truncate">
                            <div className="truncate">{st.name}</div>
                            <div className="text-[10px] font-mono text-slate-400">{st.grade || targetGrade}</div>
                          </div>

                          <div className={cn(
                            "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                            isSelected ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-400"
                          )}>
                            <Check size={14} className={isSelected ? "stroke-[3]" : "opacity-40"} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Navigation to Step 2 */}
          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
            >
              انصراف و بازگشت
            </button>

            <button
              type="button"
              onClick={() => {
                if (!periodTitle.trim()) {
                  alert('لطفاً عنوان دوره را وارد فرمایید.');
                  return;
                }
                if (examiners.length === 0) {
                  alert('لطفاً حداقل یک استاد ممتحن تعیین فرمایید.');
                  return;
                }
                if (participatingStudentIds.length === 0) {
                  alert('لطفاً حداقل یک طلبه انتخاب فرمایید.');
                  return;
                }
                setCurrentStep(2);
              }}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <span>مرحله بعد: تنظیم جدول طلاب، محدوده و ساعت</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: SCHEDULE, SCOPE ASSIGNMENT & EXAMINER PER STUDENT                 */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs">
          {/* Header & Quick Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                تنظیم جدول نوبت‌ها، ساعت و محدوده امتحانی طلاب
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                برای هر طلبه، ساعت امتحان (ربع‌ساعت به ربع‌ساعت)، استاد ممتحن و محدوده اصلی و فرعی (از بانک محدوده با سرچ سریع) را مشخص کنید.
              </p>
            </div>

            {/* Quick Time Scheduler with 15/20/30 Min Interval Selection (اصلاح ۹) */}
            <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <Clock3 size={15} className="text-indigo-600" />
                <span>گام زمان‌بندی:</span>
              </div>

              {/* Interval selector buttons (15, 20, 30 mins) */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setTimeIntervalStep(15)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-bold transition-all text-[11px]",
                    timeIntervalStep === 15 ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  ۱۵ دقیقه (یک ربع)
                </button>
                <button
                  type="button"
                  onClick={() => setTimeIntervalStep(20)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-bold transition-all text-[11px]",
                    timeIntervalStep === 20 ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  ۲۰ دقیقه
                </button>
                <button
                  type="button"
                  onClick={() => setTimeIntervalStep(30)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-bold transition-all text-[11px]",
                    timeIntervalStep === 30 ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  ۳۰ دقیقه (نیم ساعت)
                </button>
              </div>

              <div className="flex items-center gap-1.5 mr-auto">
                <span className="text-slate-500 font-bold">شروع از:</span>
                <select
                  value={autoStartTime}
                  onChange={(e) => setAutoStartTime(e.target.value)}
                  className="py-1 px-2 bg-white border border-slate-200 rounded-lg font-mono font-bold text-xs"
                >
                  {TIME_SLOTS_15MIN.slice(0, 15).map(slot => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAutoScheduleTimes}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl font-bold cursor-pointer transition-all shadow-2xs"
                >
                  اعمال زمان‌بندی خودکار
                </button>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="border border-slate-200 rounded-2xl overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse min-w-[900px]">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">ردیف</th>
                  <th className="py-3 px-3 min-w-[160px]">نام طلبه و مشخصات</th>
                  <th className="py-3 px-3 w-28 text-center">ساعت برگزاری</th>
                  {hasFiqh && (
                    <th className="py-3 px-3 bg-amber-50/60 text-amber-900 border-r border-amber-200">
                      درس فقه: استاد ممتحن و محدوده مصوب
                    </th>
                  )}
                  {hasUsul && (
                    <th className="py-3 px-3 bg-indigo-50/60 text-indigo-900 border-r border-indigo-200">
                      درس اصول: استاد ممتحن و محدوده مصوب
                    </th>
                  )}
                  <th className="py-3 px-2 w-10 text-center">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {participatingStudentIds.map((stId, idx) => {
                  const rec = recordsMap[stId];
                  const st = studentsMap.get(stId);
                  if (!rec) return null;

                  return (
                    <tr key={stId} className="hover:bg-slate-50/60">
                      {/* Index */}
                      <td className="py-3 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>

                      {/* Student Profile */}
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-slate-900">{rec.studentName}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
                          <span>{rec.grade || targetGrade}</span>
                          {rec.phone && <span>· {rec.phone}</span>}
                        </div>
                      </td>

                      {/* 15-Minute Exam Time Slot */}
                      <td className="py-3 px-3 text-center">
                        <select
                          value={rec.examTime || '08:00'}
                          onChange={(e) => handleUpdateRecord(stId, { examTime: e.target.value })}
                          className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-slate-800 cursor-pointer"
                        >
                          {TIME_SLOTS_15MIN.map(slot => (
                            <option key={slot} value={slot}>{slot}</option>
                          ))}
                        </select>
                      </td>

                      {/* Fiqh Course Block */}
                      {hasFiqh && (
                        <td className="py-2.5 px-3 bg-amber-50/20 border-r border-amber-100 space-y-1.5">
                          {/* Examiner */}
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-amber-900 shrink-0">ممتحن فقه:</span>
                            <select
                              value={rec.fiqhExaminerTeacherName || ''}
                              onChange={(e) => handleUpdateRecord(stId, { fiqhExaminerTeacherName: e.target.value })}
                              className="flex-1 px-2 py-1 bg-white border border-amber-200 rounded-lg text-xs font-medium focus:outline-none"
                            >
                              <option value="">انتخاب ممتحن فقه...</option>
                              {fiqhExaminerOptions.map(ex => (
                                <option key={ex.id} value={ex.teacherName}>{ex.teacherName}</option>
                              ))}
                            </select>
                          </div>

                          {/* Book Title Selector for Student (اصلاح ۴) */}
                          {fiqhBooks.length > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-amber-900 shrink-0">کتاب فقه:</span>
                              <select
                                value={rec.fiqhBookTitle || fiqhBooks[0] || ''}
                                onChange={(e) => handleUpdateRecord(stId, { fiqhBookTitle: e.target.value, fiqhMainScopeTitle: '', fiqhSubScopeTitle: '', fiqhPages: '' })}
                                className="flex-1 px-2 py-1 bg-amber-100/80 border border-amber-300 rounded-lg text-xs font-bold text-amber-950 focus:outline-none cursor-pointer"
                              >
                                {fiqhBooks.map(bk => (
                                  <option key={bk} value={bk}>{bk}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Scope Search & Display */}
                          <div className="relative">
                            <div
                              onClick={() => {
                                setActiveScopeSearch({ studentId: stId, course: 'fiqh' });
                                setScopeSearchQuery('');
                              }}
                              className="px-2.5 py-1.5 bg-white border border-amber-200 hover:border-amber-400 rounded-lg text-xs cursor-pointer flex items-center justify-between"
                            >
                              <span className={cn(
                                "truncate",
                                rec.fiqhSubScopeTitle ? "text-slate-800 font-semibold" : "text-slate-400"
                              )}>
                                {[rec.fiqhMainScopeTitle, rec.fiqhSubScopeTitle, rec.fiqhPages ? `(${rec.fiqhPages})` : ''].filter(Boolean).join(' - ') || '🔍 کلیک برای جستجو و انتخاب محدوده فقه...'}
                              </span>
                              <ChevronDown size={13} className="text-slate-400" />
                            </div>

                            {/* Autocomplete Dropdown */}
                            {activeScopeSearch?.studentId === stId && activeScopeSearch?.course === 'fiqh' && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-2 space-y-2">
                                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                                  <span className="text-[11px] font-bold text-amber-900">
                                    جستجوی محدوده فقه ({rec.fiqhBookTitle || fiqhBooks[0] || 'کل کتب'}):
                                  </span>
                                  <button onClick={() => setActiveScopeSearch(null)} className="text-slate-400 hover:text-slate-600">
                                    <X size={14} />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  autoFocus
                                  value={scopeSearchQuery}
                                  onChange={(e) => setScopeSearchQuery(e.target.value)}
                                  placeholder="تایپ ۱ یا ۲ حرف از نام محدوده یا صفحات..."
                                  className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                                />
                                <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 text-xs">
                                  {matchingScopeItems.length === 0 ? (
                                    <div className="p-3 text-center text-slate-400 text-[11px]">محدوده‌ای یافت نشد.</div>
                                  ) : (
                                    matchingScopeItems.map((item, sIdx) => (
                                      <div
                                        key={sIdx}
                                        onClick={() => handleSelectScopeForStudent(stId, 'fiqh', item)}
                                        className="p-2 hover:bg-amber-50 rounded cursor-pointer"
                                      >
                                        <div className="font-bold text-slate-800 flex items-center justify-between">
                                          <span>{item.subScopeTitle}</span>
                                          {item.pages && <span className="text-amber-800 font-mono text-[10px]">{item.pages}</span>}
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                          کتاب {item.bookTitle} · سرفصل: {item.mainScopeTitle}
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Usul Course Block */}
                      {hasUsul && (
                        <td className="py-2.5 px-3 bg-indigo-50/20 border-r border-indigo-100 space-y-1.5">
                          {/* Examiner */}
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-indigo-900 shrink-0">ممتحن اصول:</span>
                            <select
                              value={rec.usulExaminerTeacherName || ''}
                              onChange={(e) => handleUpdateRecord(stId, { usulExaminerTeacherName: e.target.value })}
                              className="flex-1 px-2 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-medium focus:outline-none"
                            >
                              <option value="">انتخاب ممتحن اصول...</option>
                              {usulExaminerOptions.map(ex => (
                                <option key={ex.id} value={ex.teacherName}>{ex.teacherName}</option>
                              ))}
                            </select>
                          </div>

                          {/* Book Title Selector for Student (اصلاح ۴) */}
                          {usulBooks.length > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-indigo-900 shrink-0">کتاب اصول:</span>
                              <select
                                value={rec.usulBookTitle || usulBooks[0] || ''}
                                onChange={(e) => handleUpdateRecord(stId, { usulBookTitle: e.target.value, usulMainScopeTitle: '', usulSubScopeTitle: '', usulPages: '' })}
                                className="flex-1 px-2 py-1 bg-indigo-100/80 border border-indigo-300 rounded-lg text-xs font-bold text-indigo-950 focus:outline-none cursor-pointer"
                              >
                                {usulBooks.map(bk => (
                                  <option key={bk} value={bk}>{bk}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Scope Search & Display */}
                          <div className="relative">
                            <div
                              onClick={() => {
                                setActiveScopeSearch({ studentId: stId, course: 'usul' });
                                setScopeSearchQuery('');
                              }}
                              className="px-2.5 py-1.5 bg-white border border-indigo-200 hover:border-indigo-400 rounded-lg text-xs cursor-pointer flex items-center justify-between"
                            >
                              <span className={cn(
                                "truncate",
                                rec.usulSubScopeTitle ? "text-slate-800 font-semibold" : "text-slate-400"
                              )}>
                                {[rec.usulMainScopeTitle, rec.usulSubScopeTitle, rec.usulPages ? `(${rec.usulPages})` : ''].filter(Boolean).join(' - ') || '🔍 کلیک برای جستجو و انتخاب محدوده اصول...'}
                              </span>
                              <ChevronDown size={13} className="text-slate-400" />
                            </div>

                            {/* Autocomplete Dropdown */}
                            {activeScopeSearch?.studentId === stId && activeScopeSearch?.course === 'usul' && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-2 space-y-2">
                                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                                  <span className="text-[11px] font-bold text-indigo-900">
                                    جستجوی محدوده اصول ({rec.usulBookTitle || usulBooks[0] || 'کل کتب'}):
                                  </span>
                                  <button onClick={() => setActiveScopeSearch(null)} className="text-slate-400 hover:text-slate-600">
                                    <X size={14} />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  autoFocus
                                  value={scopeSearchQuery}
                                  onChange={(e) => setScopeSearchQuery(e.target.value)}
                                  placeholder="تایپ ۱ یا ۲ حرف از نام محدوده یا صفحات..."
                                  className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                                />
                                <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 text-xs">
                                  {matchingScopeItems.length === 0 ? (
                                    <div className="p-3 text-center text-slate-400 text-[11px]">محدوده‌ای یافت نشد.</div>
                                  ) : (
                                    matchingScopeItems.map((item, sIdx) => (
                                      <div
                                        key={sIdx}
                                        onClick={() => handleSelectScopeForStudent(stId, 'usul', item)}
                                        className="p-2 hover:bg-indigo-50 rounded cursor-pointer"
                                      >
                                        <div className="font-bold text-slate-800 flex items-center justify-between">
                                          <span>{item.subScopeTitle}</span>
                                          {item.pages && <span className="text-indigo-800 font-mono text-[10px]">{item.pages}</span>}
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                          کتاب {item.bookTitle} · سرفصل: {item.mainScopeTitle}
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Remove Student */}
                      <td className="py-3 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveStudent(stId)}
                          className="text-slate-300 hover:text-rose-600 p-1 rounded"
                          title="حذف طلبه از این دوره"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Navigation Controls */}
          <div className="pt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowRight size={15} />
              <span>ویرایش مرحله ۱ (تنظیمات و اساتید)</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <span>پایان مرحله ۲ و ورود به فاز برگزاری آزمون</span>
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: CONDUCTING EXAM, SCORING & HIGH-DEMAND EXPORTS                     */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs">
          {/* Header & Export Actions Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>فاز فعال برگزاری آزمون شفاهی و ثبت نمرات</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                {periodTitle}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                تاریخ: {examDate} · پایه: {targetGrade} · تعداد طلاب: {participatingStudentIds.length} نفر
              </p>
            </div>

            {/* HIGH-DEMAND EXPORT BUTTONS */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Output 1: Bulletin Board (تابلو اعلانات) */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsBulletinBoardPreviewOpen(true)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="خروجی شکیل جهت نصب روی تابلو اعلانات برای مشاهده طلاب"
                >
                  <Printer size={15} className="text-slate-600" />
                  <span>چاپ تابلو اعلانات (PDF)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const currentRecords = participatingStudentIds.map(id => recordsMap[id]).filter(Boolean);
                    exportBulletinBoardExcel(
                      { id: 'p', title: periodTitle, grade: targetGrade, hasFiqh, fiqhBooks, hasUsul, usulBooks, examinerTeacherIds: [], examinerTeacherNames: [], hasCustomScopes: false, scopes: [], participatingStudentIds, status: 'conducting', createdAt: '' },
                      currentRecords,
                      studentsMap
                    );
                  }}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-emerald-700 rounded-xl transition-all cursor-pointer"
                  title="اکسل تابلو اعلانات"
                >
                  <FileSpreadsheet size={15} />
                </button>
              </div>

              {/* Output 2: A5 Examiner Evaluation Sheets (تولید برگه امتحان شفاهی A5) */}
              <button
                type="button"
                onClick={() => setIsA5PreviewOpen(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                title="تولید برگه امتحانی A5 حاوی عکس، مشخصات، محدوده، ساعت و کادر نمره برای تک‌تک طلاب"
              >
                <FileSignature size={15} />
                <span>تولید برگه امتحان شفاهی (A5)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const currentRecords = participatingStudentIds.map(id => recordsMap[id]).filter(Boolean);
                  exportOralExamA5WordDoc(
                    { id: 'p', title: periodTitle, examDate, grade: targetGrade, hasFiqh, fiqhBooks, hasUsul, usulBooks, examinerTeacherIds: [], examinerTeacherNames: [], hasCustomScopes: false, scopes: [], participatingStudentIds, status: 'conducting', createdAt: '' },
                    currentRecords,
                    studentsMap
                  );
                }}
                className="px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                title="دانلود فایل Word برگه‌های A5 طلاب"
              >
                <Download size={14} />
                <span>دانلود Word برگه‌های A5</span>
              </button>
            </div>
          </div>

          {/* Conduct & Scoring Table */}
          <div className="border border-slate-200 rounded-2xl overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse min-w-[950px]">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">ردیف</th>
                  <th className="py-3 px-3">طلبه</th>
                  <th className="py-3 px-2 w-20 text-center font-mono">ساعت</th>
                  {hasFiqh && (
                    <>
                      <th className="py-3 px-3 bg-amber-50/60 text-amber-900 border-r border-amber-200">
                        محدوده و ممتحن فقه
                      </th>
                      <th className="py-3 px-3 bg-amber-50/60 text-amber-900 w-24 text-center">
                        نمره فقه (۲۰)
                      </th>
                    </>
                  )}
                  {hasUsul && (
                    <>
                      <th className="py-3 px-3 bg-indigo-50/60 text-indigo-900 border-r border-indigo-200">
                        محدوده و ممتحن اصول
                      </th>
                      <th className="py-3 px-3 bg-indigo-50/60 text-indigo-900 w-24 text-center">
                        نمره اصول (۲۰)
                      </th>
                    </>
                  )}
                  <th className="py-3 px-3 w-28 text-center">وضعیت</th>
                  <th className="py-3 px-3 w-32 text-center">نظر ممتحن</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {participatingStudentIds.map((stId, idx) => {
                  const rec = recordsMap[stId];
                  if (!rec) return null;

                  return (
                    <tr key={stId} className="hover:bg-slate-50/60">
                      <td className="py-3 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                      
                      {/* Name */}
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-slate-900">{rec.studentName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{rec.phone || rec.grade}</div>
                      </td>

                      {/* Time */}
                      <td className="py-3 px-2 text-center font-mono font-bold text-slate-700">
                        {rec.examTime || '-'}
                      </td>

                      {/* Fiqh Block */}
                      {hasFiqh && (
                        <>
                          <td className="py-2.5 px-3 bg-amber-50/20 border-r border-amber-100">
                            <div className="text-slate-800 font-semibold">{rec.fiqhExaminerTeacherName || 'استاد تعیین نشده'}</div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                              {[rec.fiqhMainScopeTitle, rec.fiqhSubScopeTitle, rec.fiqhPages].filter(Boolean).join(' - ') || '-'}
                            </div>
                          </td>
                          <td className="py-2 px-2 bg-amber-50/20 text-center">
                            <input
                              type="number"
                              min="0"
                              max="20"
                              step="0.25"
                              value={rec.fiqhScore !== null && rec.fiqhScore !== undefined ? rec.fiqhScore : ''}
                              onChange={(e) => handleUpdateRecord(stId, { fiqhScore: e.target.value !== '' ? Number(e.target.value) : null })}
                              placeholder="از ۲۰"
                              className="w-16 px-2 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold text-center text-amber-950 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </td>
                        </>
                      )}

                      {/* Usul Block */}
                      {hasUsul && (
                        <>
                          <td className="py-2.5 px-3 bg-indigo-50/20 border-r border-indigo-100">
                            <div className="text-slate-800 font-semibold">{rec.usulExaminerTeacherName || 'استاد تعیین نشده'}</div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                              {[rec.usulMainScopeTitle, rec.usulSubScopeTitle, rec.usulPages].filter(Boolean).join(' - ') || '-'}
                            </div>
                          </td>
                          <td className="py-2 px-2 bg-indigo-50/20 text-center">
                            <input
                              type="number"
                              min="0"
                              max="20"
                              step="0.25"
                              value={rec.usulScore !== null && rec.usulScore !== undefined ? rec.usulScore : ''}
                              onChange={(e) => handleUpdateRecord(stId, { usulScore: e.target.value !== '' ? Number(e.target.value) : null })}
                              placeholder="از ۲۰"
                              className="w-16 px-2 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-mono font-bold text-center text-indigo-950 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                        </>
                      )}

                      {/* Overall Status */}
                      <td className="py-2 px-2 text-center">
                        <select
                          value={rec.overallStatus || 'pending'}
                          onChange={(e) => handleUpdateRecord(stId, { overallStatus: e.target.value as any })}
                          className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none cursor-pointer"
                        >
                          <option value="pending">در جریان</option>
                          <option value="passed">قبول</option>
                          <option value="retake">تجدید / مجدد</option>
                          <option value="absent">غایب</option>
                        </select>
                      </td>

                      {/* Notes Button */}
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveNoteStudent(rec);
                            setTempNoteText(rec.examinerNotes || '');
                          }}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 mx-auto",
                            rec.examinerNotes 
                              ? "bg-slate-800 text-white" 
                              : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                          )}
                        >
                          <FileEdit size={12} />
                          <span>{rec.examinerNotes ? 'ویرایش نظر' : 'ثبت نظر'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom Workflow Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                بازگشت به مرحله ۲ (ویرایش جدول و محدوده)
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                ویرایش مرحله ۱
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* Temporary Save */}
              <button
                type="button"
                onClick={handleSaveTemporary}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Save size={15} />
                <span>ثبت موقت در دیتابیس</span>
              </button>

              {/* Finalize and Archive */}
              <button
                type="button"
                onClick={handleFinalizeAndArchive}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Archive size={15} />
                <span>ثبت نهایی و انتقال به بایگانی</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: EXAMINER NOTES MODAL                                 */}
      {/* ------------------------------------------------------------- */}
      {activeNoteStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="font-bold text-base text-slate-900">
                ثبت نظر و ارزیابی استاد ممتحن برای «{activeNoteStudent.studentName}»
              </h4>
              <button onClick={() => setActiveNoteStudent(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-500">
                نظرات اساتید در خصوص تسلط بر متن، روان‌خوانی، فهم مطلب یا نکات توصیه‌ای را ثبت نمایید:
              </p>
              <textarea
                rows={4}
                autoFocus
                value={tempNoteText}
                onChange={(e) => setTempNoteText(e.target.value)}
                placeholder="مثلاً: درک مطلب عالی بود ولی در اعراب‌گذاری عبارات نیازمند دقت بیشتری است..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveNoteStudent(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium text-xs cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  handleUpdateRecord(activeNoteStudent.studentId, { examinerNotes: tempNoteText.trim() || undefined });
                  setActiveNoteStudent(null);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer"
              >
                ذخیره یادداشت
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: A5 EXAMINER EVALUATION SHEETS PREVIEW & PRINT        */}
      {/* ------------------------------------------------------------- */}
      {isA5PreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-slate-100 rounded-3xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileSignature size={18} className="text-amber-400" />
                <h3 className="font-extrabold text-sm sm:text-base">
                  پیش‌نمایش و چاپ برگه‌های ارزیابی ممتحن (قطع A5 برای تک‌تک طلاب)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Printer size={14} />
                  <span>چاپ مستقیم / ذخیره PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const currentRecords = participatingStudentIds.map(id => recordsMap[id]).filter(Boolean);
                    exportOralExamA5WordDoc(
                      { id: 'p', title: periodTitle, examDate, grade: targetGrade, hasFiqh, fiqhBooks, hasUsul, usulBooks, examinerTeacherIds: [], examinerTeacherNames: [], hasCustomScopes: false, scopes: [], participatingStudentIds, status: 'conducting', createdAt: '' },
                      currentRecords,
                      studentsMap
                    );
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Download size={14} />
                  <span>دانلود فایل Word (.doc)</span>
                </button>
                <button onClick={() => setIsA5PreviewOpen(false)} className="text-slate-400 hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Printable A5 Pages Scrollable Area */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6 bg-slate-200/80">
              {participatingStudentIds.map((stId, pIdx) => {
                const rec = recordsMap[stId];
                const student = studentsMap.get(stId);
                if (!rec) return null;

                const fiqhScopeStr = [rec.fiqhMainScopeTitle, rec.fiqhSubScopeTitle, rec.fiqhPages ? `(${rec.fiqhPages})` : ''].filter(Boolean).join(' - ') || 'تعیین نشده';
                const usulScopeStr = [rec.usulMainScopeTitle, rec.usulSubScopeTitle, rec.usulPages ? `(${rec.usulPages})` : ''].filter(Boolean).join(' - ') || 'تعیین نشده';

                return (
                  <div
                    key={stId}
                    className="bg-white rounded-xl shadow-lg border border-slate-300 p-6 max-w-2xl mx-auto space-y-4 text-slate-800 text-xs print:shadow-none print:border-none print:m-0 print:p-8"
                    style={{ pageBreakAfter: 'always' }}
                  >
                    {/* Header */}
                    <div className="border-b-2 border-slate-900 pb-3 flex items-center justify-between">
                      <div className="text-right">
                        <div className="font-bold text-xs text-slate-700">حوزه علمیه مروی</div>
                        <div className="text-[10px] text-slate-400">معاونت آموزش و سنجش علمی</div>
                      </div>
                      <div className="text-center">
                        <h3 className="font-black text-sm text-slate-900">برگه ارزیابی و ثبت نمره آزمون شفاهی</h3>
                        <div className="text-xs font-bold text-slate-700 mt-0.5">{periodTitle}</div>
                      </div>
                      <div className="text-left text-[10px] text-slate-500">
                        <div>تاریخ: <b>{examDate}</b></div>
                        <div>ساعت آزمون: <b>{rec.examTime || '--:--'}</b></div>
                      </div>
                    </div>

                    {/* Student Info Box */}
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center gap-4">
                      <div className="w-16 h-20 rounded-lg bg-slate-200 border border-slate-300 overflow-hidden flex items-center justify-center shrink-0">
                        {student?.photoUrl ? (
                          <img src={student.photoUrl} alt={rec.studentName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[11px] text-slate-400 font-bold">محل عکس</span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 flex-1">
                        <div><b>نام و نام خانوادگی:</b> <span className="font-extrabold text-sm text-slate-900">{rec.studentName}</span></div>
                        <div><b>پایه تحصیلی:</b> <span className="font-bold">{rec.grade || targetGrade}</span></div>
                        <div><b>شماره تماس:</b> <span className="font-mono text-slate-700">{rec.phone || student?.phone || '-'}</span></div>
                        <div><b>کد ملی:</b> <span className="font-mono text-slate-700">{rec.nationalId || student?.nationalId || '-'}</span></div>
                        <div className="col-span-2 text-sky-800 font-bold">
                          ساعت دقیق آزمون: <span className="font-mono text-sm">{rec.examTime}</span>
                        </div>
                      </div>
                    </div>

                    {/* Subjects and Scopes Table */}
                    <div className="border border-slate-800 rounded-lg overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 font-bold border-b border-slate-800">
                          <tr>
                            <th className="p-2 w-16 text-center">درس</th>
                            <th className="p-2">محدوده امتحانی مصوب</th>
                            <th className="p-2 text-center w-32">استاد ممتحن</th>
                            <th className="p-2 text-center w-24">نمره (از ۲۰)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {hasFiqh && (
                            <tr>
                              <td className="p-2.5 text-center font-bold bg-amber-50 text-amber-900">فـقـه</td>
                              <td className="p-2.5 leading-relaxed">{fiqhScopeStr}</td>
                              <td className="p-2.5 text-center font-bold text-slate-800">{rec.fiqhExaminerTeacherName || 'استاد ممتحن فقه'}</td>
                              <td className="p-2.5 text-center font-black text-sm">
                                {rec.fiqhScore !== null && rec.fiqhScore !== undefined ? rec.fiqhScore : '..............'}
                              </td>
                            </tr>
                          )}
                          {hasUsul && (
                            <tr>
                              <td className="p-2.5 text-center font-bold bg-indigo-50 text-indigo-900">اصـول</td>
                              <td className="p-2.5 leading-relaxed">{usulScopeStr}</td>
                              <td className="p-2.5 text-center font-bold text-slate-800">{rec.usulExaminerTeacherName || 'استاد ممتحن اصول'}</td>
                              <td className="p-2.5 text-center font-black text-sm">
                                {rec.usulScore !== null && rec.usulScore !== undefined ? rec.usulScore : '..............'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Criteria Evaluation Checklist */}
                    <div className="border border-slate-200 rounded-lg p-2.5 text-[10px] space-y-1.5">
                      <span className="font-bold text-slate-700 block">معیارهای سنجش ممتحن (امتیاز از ۵):</span>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="border border-slate-200 p-1 rounded bg-slate-50">صحت قرائت و اعراب [ &nbsp; ]</div>
                        <div className="border border-slate-200 p-1 rounded bg-slate-50">ترجمه و توضیح روان [ &nbsp; ]</div>
                        <div className="border border-slate-200 p-1 rounded bg-slate-50">استدلال و تسلط [ &nbsp; ]</div>
                        <div className="border border-slate-200 p-1 rounded bg-slate-50">پاسخ به اشکالات [ &nbsp; ]</div>
                      </div>
                    </div>

                    {/* Notes and Signatures Box */}
                    <div className="border border-slate-300 rounded-xl p-3 space-y-2">
                      <span className="font-bold text-xs text-slate-700 block">محل درج نظرات، نقاط ضعف و توضیحات ممتحن:</span>
                      <div className="min-h-[50px] border-b border-dashed border-slate-300 text-slate-600 text-xs">
                        {rec.examinerNotes || ''}
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-3 text-center text-xs">
                        <div>
                          <div>نام و امضای استاد ممتحن فقه:</div>
                          <div className="h-10"></div>
                        </div>
                        <div>
                          <div>نام و امضای استاد ممتحن اصول:</div>
                          <div className="h-10"></div>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="text-center text-[9px] text-slate-400 border-t border-slate-100 pt-2">
                      صفحه {pIdx + 1} از {participatingStudentIds.length} — سامانه مدیریت سنجش و امتحانات شفاهی حوزه علمیه
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: BULLETIN BOARD NOTICE PREVIEW & PRINT                */}
      {/* ------------------------------------------------------------- */}
      {isBulletinBoardPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Printer size={18} className="text-sky-400" />
                <h3 className="font-bold text-sm">چاپ برنامه زمانی و تابلو اعلانات طلاب</h3>
              </div>

              {/* Show Scopes Toggle Checkbox (اصلاح ۸) */}
              <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                <input
                  type="checkbox"
                  checked={showScopesInPrint}
                  onChange={(e) => setShowScopesInPrint(e.target.checked)}
                  className="rounded text-sky-500 w-4 h-4 cursor-pointer"
                />
                <span>درج محدوده‌های امتحانی در چاپ تابلو</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer shadow-2xs"
                >
                  چاپ مستقیم تابلو (Print)
                </button>
                <button onClick={() => setIsBulletinBoardPreviewOpen(false)} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 print:p-8">
              <div className="text-center border-b-2 border-slate-900 pb-3">
                <h2 className="text-lg font-black text-slate-900">جدول زمان‌بندی و نوبت آزمون‌های شفاهی</h2>
                <div className="text-xs text-slate-600 font-bold mt-1">
                  {periodTitle} · تاریخ برگزاری: {examDate}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  حوزه علمیه مروی — لطفاً طلاب گرامی ۱۵ دقیقه پیش از ساعت تعیین‌شده در محل آزمون حضور یابند.
                </div>
              </div>

              <div className="border border-slate-300 rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 font-bold border-b border-slate-300">
                    <tr>
                      <th className="p-2.5 w-10 text-center">ردیف</th>
                      <th className="p-2.5 w-24 text-center">ساعت آزمون</th>
                      <th className="p-2.5">نام و نام خانوادگی طلبه</th>
                      <th className="p-2.5">پایه</th>
                      {hasFiqh && <th className="p-2.5">استاد و محدوده فقه</th>}
                      {hasUsul && <th className="p-2.5">استاد و محدوده اصول</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {participatingStudentIds
                      .sort((a, b) => (recordsMap[a]?.examTime || '00:00').localeCompare(recordsMap[b]?.examTime || '00:00'))
                      .map((stId, idx) => {
                        const rec = recordsMap[stId];
                        if (!rec) return null;
                        return (
                          <tr key={stId} className="hover:bg-slate-50">
                            <td className="p-2.5 text-center text-slate-400">{idx + 1}</td>
                            <td className="p-2.5 text-center font-mono font-bold text-slate-900 text-sm bg-slate-50">
                              {rec.examTime}
                            </td>
                            <td className="p-2.5 font-bold text-slate-900">{rec.studentName}</td>
                            <td className="p-2.5 text-slate-500">{rec.grade || targetGrade}</td>
                            {hasFiqh && (
                              <td className="p-2.5 text-slate-700">
                                <div className="font-semibold text-amber-900">{rec.fiqhExaminerTeacherName || 'استاد ممتحن فقه'}</div>
                                {showScopesInPrint && (
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    {[rec.fiqhMainScopeTitle, rec.fiqhSubScopeTitle, rec.fiqhPages].filter(Boolean).join(' - ') || '-'}
                                  </div>
                                )}
                              </td>
                            )}
                            {hasUsul && (
                              <td className="p-2.5 text-slate-700">
                                <div className="font-semibold text-indigo-900">{rec.usulExaminerTeacherName || 'استاد ممتحن اصول'}</div>
                                {showScopesInPrint && (
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    {[rec.usulMainScopeTitle, rec.usulSubScopeTitle, rec.usulPages].filter(Boolean).join(' - ') || '-'}
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
