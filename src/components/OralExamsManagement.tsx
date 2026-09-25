import React, { useState, useEffect, useMemo } from 'react';
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
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { localDb } from '../lib/localDb';
import { Student, Teacher, OralExamPeriod, ExamScopeRange, OralExamStudentRecord, OralExam } from '../types';
import { useMentor } from '../context/MentorContext';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const USUL_BOOK_OPTIONS = ['رسائل', 'کفایه', 'حلقه ثالثه', 'سایر'];
const FIQH_BOOK_OPTIONS = ['مکاسب', 'شرح لمعه', 'سایر'];

const GRADE_OPTIONS = [
  { id: 'پایه ۷', label: 'پایه ۷' },
  { id: 'پایه ۸', label: 'پایه ۸' },
  { id: 'پایه ۹', label: 'پایه ۹' },
  { id: 'پایه ۱۰', label: 'پایه ۱۰' },
  { id: 'کل پایه‌ها', label: 'کل پایه‌ها / ترکیبی' },
];

export default function OralExamsManagement() {
  const { filterStudents, currentMentorId, shahpooriFilter } = useMentor();
  const { currentUser, isReadOnly } = useAuth();

  const [periods, setPeriods] = useState<OralExamPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [studentRecords, setStudentRecords] = useState<Record<string, OralExamStudentRecord>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');

  // Search & Filter in Table
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterRetakeOnly, setFilterRetakeOnly] = useState<boolean>(false);
  const [filterGrade, setFilterGrade] = useState<string>('all');

  // Create Period Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [isEditingPeriod, setIsEditingPeriod] = useState<boolean>(false);

  // Period Form State
  const [formPeriodTitle, setFormPeriodTitle] = useState<string>('');
  const [formTargetGrade, setFormTargetGrade] = useState<string>('پایه ۹');
  const [formHasUsul, setFormHasUsul] = useState<boolean>(true);
  const [formUsulBooks, setFormUsulBooks] = useState<string[]>(['رسائل']);
  const [formCustomUsulBook, setFormCustomUsulBook] = useState<string>('');
  const [formHasFiqh, setFormHasFiqh] = useState<boolean>(true);
  const [formFiqhBooks, setFormFiqhBooks] = useState<string[]>(['مکاسب']);
  const [formCustomFiqhBook, setFormCustomFiqhBook] = useState<string>('');
  const [formExamDates, setFormExamDates] = useState<string[]>([]);
  const [formNewDateInput, setFormNewDateInput] = useState<string>('');
  const [formSelectedTeacherIds, setFormSelectedTeacherIds] = useState<string[]>([]);
  const [formCustomTeacherInput, setFormCustomTeacherInput] = useState<string>('');
  const [formCustomTeacherNames, setFormCustomTeacherNames] = useState<string[]>([]);
  const [formHasCustomScopes, setFormHasCustomScopes] = useState<boolean>(false);
  const [formScopes, setFormScopes] = useState<ExamScopeRange[]>([]);
  const [formParticipatingStudentIds, setFormParticipatingStudentIds] = useState<string[]>([]);
  const [formAdditionalStudentSearch, setFormAdditionalStudentSearch] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');

  // Examiner Notes Modal (Per Student)
  const [activeNotesStudentRecord, setActiveNotesStudentRecord] = useState<OralExamStudentRecord | null>(null);

  // Helper for Persian Date
  const getShamsiToday = (): string => {
    try {
      const today = new Date();
      const parts = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(today);
      const year = parts.find(p => p.type === 'year')?.value;
      const month = parts.find(p => p.type === 'month')?.value;
      const day = parts.find(p => p.type === 'day')?.value;
      if (year && month && day) return `${year}/${month}/${day}`;
      return today.toLocaleDateString('fa-IR-u-nu-latn');
    } catch {
      return new Date().toLocaleDateString('fa-IR');
    }
  };

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [pDocs, sDocs, tDocs, rDocs] = await Promise.all([
        localDb.getDocs<OralExamPeriod>('oral_exam_periods'),
        localDb.getDocs<Student>('students'),
        localDb.getDocs<Teacher>('teachers'),
        localDb.getDocs<OralExamStudentRecord>('oral_exam_records')
      ]);

      const sortedPeriods = (pDocs || []).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setPeriods(sortedPeriods);
      setStudents(sDocs || []);
      setTeachers(tDocs || []);

      const recordMap: Record<string, OralExamStudentRecord> = {};
      (rDocs || []).forEach(r => {
        if (r && r.id) {
          recordMap[r.id] = r;
        }
      });
      setStudentRecords(recordMap);

      if (sortedPeriods.length > 0 && !selectedPeriodId) {
        setSelectedPeriodId(sortedPeriods[0].id);
      }
    } catch (e) {
      console.error('Error loading oral exam periods:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const currentPeriod = useMemo(() => {
    return periods.find(p => p.id === selectedPeriodId) || null;
  }, [periods, selectedPeriodId]);

  // Handle Target Grade Change in Modal -> Auto-populate students of that grade
  const handleTargetGradeChange = (grade: string) => {
    setFormTargetGrade(grade);
    if (grade === 'کل پایه‌ها') {
      setFormParticipatingStudentIds(students.filter(s => s.isActive !== false).map(s => s.id));
    } else {
      const gradeStudents = students.filter(s => s.grade === grade && s.isActive !== false);
      setFormParticipatingStudentIds(gradeStudents.map(s => s.id));
    }
  };

  const handleOpenCreateModal = (periodToEdit?: OralExamPeriod) => {
    if (periodToEdit) {
      setIsEditingPeriod(true);
      setFormPeriodTitle(periodToEdit.title);
      setFormTargetGrade(periodToEdit.grade);
      setFormHasUsul(periodToEdit.hasUsul);
      setFormUsulBooks(periodToEdit.usulBooks || ['رسائل']);
      setFormCustomUsulBook(periodToEdit.customUsulBook || '');
      setFormHasFiqh(periodToEdit.hasFiqh);
      setFormFiqhBooks(periodToEdit.fiqhBooks || ['مکاسب']);
      setFormCustomFiqhBook(periodToEdit.customFiqhBook || '');
      setFormExamDates(periodToEdit.examDates || []);
      setFormSelectedTeacherIds(periodToEdit.examinerTeacherIds || []);
      setFormCustomTeacherNames(periodToEdit.examinerTeacherNames?.filter(name => !teachers.some(t => t.name === name)) || []);
      setFormHasCustomScopes(periodToEdit.hasCustomScopes || false);
      setFormScopes(periodToEdit.scopes || []);
      setFormParticipatingStudentIds(periodToEdit.participatingStudentIds || []);
      setFormNotes(periodToEdit.notes || '');
    } else {
      setIsEditingPeriod(false);
      const defaultGrade = 'پایه ۹';
      setFormPeriodTitle(`دوره آزمون شفاهی ${defaultGrade} - ${getShamsiToday().substring(0, 7)}`);
      setFormTargetGrade(defaultGrade);
      setFormHasUsul(true);
      setFormUsulBooks(['رسائل']);
      setFormCustomUsulBook('');
      setFormHasFiqh(true);
      setFormFiqhBooks(['مکاسب']);
      setFormCustomFiqhBook('');
      setFormExamDates([getShamsiToday()]);
      setFormNewDateInput('');
      setFormSelectedTeacherIds([]);
      setFormCustomTeacherNames([]);
      setFormHasCustomScopes(false);
      setFormScopes([
        { id: `scope_1_${Date.now()}`, courseType: 'fiqh', title: 'محدوده ۱: از ابتدای کتاب تا پایان شرایط متعاقدین' },
        { id: `scope_2_${Date.now()}`, courseType: 'usul', title: 'محدوده ۱: از ابتدای قطع و ظن تا پایان برائت' }
      ]);
      const initialStudents = students.filter(s => s.grade === defaultGrade && s.isActive !== false);
      setFormParticipatingStudentIds(initialStudents.map(s => s.id));
      setFormNotes('');
    }
    setShowCreateModal(true);
  };

  const handleAddScope = (courseType: 'fiqh' | 'usul') => {
    const newScope: ExamScopeRange = {
      id: `scope_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      courseType,
      title: `محدوده جدید ${courseType === 'fiqh' ? 'فقه' : 'اصول'}`
    };
    setFormScopes(prev => [...prev, newScope]);
  };

  const handleRemoveScope = (scopeId: string) => {
    setFormScopes(prev => prev.filter(s => s.id !== scopeId));
  };

  const handleUpdateScopeTitle = (scopeId: string, title: string) => {
    setFormScopes(prev => prev.map(s => s.id === scopeId ? { ...s, title } : s));
  };

  const handleAddCustomTeacher = () => {
    const trimmed = formCustomTeacherInput.trim();
    if (trimmed && !formCustomTeacherNames.includes(trimmed)) {
      setFormCustomTeacherNames(prev => [...prev, trimmed]);
      setFormCustomTeacherInput('');
    }
  };

  const handleRemoveCustomTeacher = (name: string) => {
    setFormCustomTeacherNames(prev => prev.filter(n => n !== name));
  };

  const handleAddExamDate = () => {
    const trimmed = formNewDateInput.trim();
    if (trimmed && !formExamDates.includes(trimmed)) {
      setFormExamDates(prev => [...prev, trimmed]);
      setFormNewDateInput('');
    }
  };

  const handleRemoveExamDate = (d: string) => {
    setFormExamDates(prev => prev.filter(item => item !== d));
  };

  // Create / Save Period
  const handleSavePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPeriodTitle.trim()) return;

    if (!formHasFiqh && !formHasUsul) {
      alert('لطفاً حداقل یکی از دروس فقه یا اصول را برای دوره آزمون انتخاب نمایید.');
      return;
    }

    const allExaminerNames: string[] = teachers
      .filter(t => formSelectedTeacherIds.includes(t.id))
      .map(t => t.name);

    if (allExaminerNames.length === 0) {
      alert('لطفاً حداقل یک استاد ممتحن از لیست بانک اساتید انتخاب نمایید.');
      return;
    }

    const periodId = isEditingPeriod && currentPeriod ? currentPeriod.id : `oral_period_${Date.now()}`;
    const newPeriod: OralExamPeriod = {
      id: periodId,
      title: formPeriodTitle.trim(),
      grade: formTargetGrade,
      hasUsul: formHasUsul,
      usulBooks: formUsulBooks,
      customUsulBook: formCustomUsulBook.trim(),
      hasFiqh: formHasFiqh,
      fiqhBooks: formFiqhBooks,
      customFiqhBook: formCustomFiqhBook.trim(),
      examDates: formExamDates.length > 0 ? formExamDates : [getShamsiToday()],
      examDatesStr: formExamDates.join(' و '),
      examinerTeacherIds: formSelectedTeacherIds,
      examinerTeacherNames: allExaminerNames,
      hasCustomScopes: formHasCustomScopes,
      scopes: formScopes,
      participatingStudentIds: formParticipatingStudentIds,
      status: isEditingPeriod && currentPeriod ? currentPeriod.status : 'draft',
      notes: formNotes.trim(),
      createdAt: isEditingPeriod && currentPeriod ? currentPeriod.createdAt : new Date().toISOString(),
      createdByName: currentUser?.name || currentUser?.username || 'مدیر آموزش'
    };

    try {
      await localDb.setDoc('oral_exam_periods', newPeriod.id, newPeriod);
      
      // Initialize student records for this period if not exists
      const updatedMap = { ...studentRecords };
      for (const stId of formParticipatingStudentIds) {
        const recordKey = `${periodId}_${stId}`;
        if (!updatedMap[recordKey]) {
          const st = students.find(s => s.id === stId);
          const initialRecord: OralExamStudentRecord = {
            id: recordKey,
            periodId,
            studentId: stId,
            studentName: st?.name || '',
            nationalId: st?.nationalId,
            grade: st?.grade,
            fiqhExaminerTeacherName: allExaminerNames[0] || '',
            usulExaminerTeacherName: allExaminerNames[0] || '',
            fiqhScopeTitle: formScopes.find(s => s.courseType === 'fiqh')?.title || '',
            usulScopeTitle: formScopes.find(s => s.courseType === 'usul')?.title || '',
            fiqhScore: null,
            fiqhIsRetake: false,
            usulScore: null,
            usulIsRetake: false,
            status: 'draft',
            updatedAt: new Date().toISOString()
          };
          updatedMap[recordKey] = initialRecord;
          await localDb.setDoc('oral_exam_records', recordKey, initialRecord);
        }
      }

      setStudentRecords(updatedMap);
      await loadData();
      setSelectedPeriodId(periodId);
      setShowCreateModal(false);
      setSaveSuccessMsg('دوره آزمون شفاهی با موفقیت ثبت گردید.');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(`خطا در ذخیره دوره: ${err?.message || 'مشکل اتصال'}`);
    }
  };

  // Delete Period
  const handleDeletePeriod = async (periodId: string) => {
    if (!window.confirm('آیا از حذف این دوره آزمون شفاهی اطمینان دارید؟')) return;
    try {
      await localDb.deleteDoc('oral_exam_periods', periodId);
      // Remove related records
      const remainingRecords = { ...studentRecords };
      Object.keys(remainingRecords).forEach(k => {
        if (remainingRecords[k].periodId === periodId) {
          localDb.deleteDoc('oral_exam_records', k).catch(() => {});
          delete remainingRecords[k];
        }
      });
      setStudentRecords(remainingRecords);
      await loadData();
    } catch (e: any) {
      alert(`خطا در حذف دوره: ${e?.message}`);
    }
  };

  // Update Record Field in Memory
  const handleUpdateRecord = (studentId: string, updates: Partial<OralExamStudentRecord>) => {
    if (!selectedPeriodId) return;
    const recordKey = `${selectedPeriodId}_${studentId}`;
    const existing = studentRecords[recordKey] || {
      id: recordKey,
      periodId: selectedPeriodId,
      studentId,
      studentName: students.find(s => s.id === studentId)?.name || '',
      nationalId: students.find(s => s.id === studentId)?.nationalId,
      grade: students.find(s => s.id === studentId)?.grade,
      status: 'draft',
      updatedAt: new Date().toISOString()
    };

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    setStudentRecords(prev => ({
      ...prev,
      [recordKey]: updated
    }));
  };

  // Save Draft (ثبت موقت)
  const handleSaveDraft = async () => {
    if (!currentPeriod) return;
    setIsSaving(true);
    try {
      const recordsToSave = participatingStudents.map(st => {
        const recordKey = `${currentPeriod.id}_${st.id}`;
        return studentRecords[recordKey] || {
          id: recordKey,
          periodId: currentPeriod.id,
          studentId: st.id,
          studentName: st.name,
          nationalId: st.nationalId,
          grade: st.grade,
          status: 'draft',
          updatedAt: new Date().toISOString()
        };
      });

      for (const rec of recordsToSave) {
        await localDb.setDoc('oral_exam_records', rec.id, rec);
      }

      setSaveSuccessMsg('اطلاعات این دوره به صورت موقت (پیش‌نویس) با موفقیت ذخیره شد.');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(`خطا در ثبت موقت: ${err?.message || 'مشکل اتصال'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Final Submit & Archive (ثبت نهایی و ثبت در سابقه و آرشیو امتحان)
  const handleFinalSubmitAndArchive = async () => {
    if (!currentPeriod) return;
    if (!window.confirm('آیا از ثبت نهایی و درج نمرات آزمون شفاهی در پرونده و کارنامه طلاب اطمینان دارید؟')) return;

    setIsSaving(true);
    try {
      // 1. Mark period as finalized
      const updatedPeriod: OralExamPeriod = {
        ...currentPeriod,
        status: 'finalized',
        finalizedAt: new Date().toISOString(),
        finalizedByName: currentUser?.name || currentUser?.username || 'مسئول آموزش'
      };
      await localDb.setDoc('oral_exam_periods', updatedPeriod.id, updatedPeriod);

      // 2. Save all student records with finalized status
      const existingOralExams = await localDb.getDocs<OralExam>('oral_exams') || [];
      const updatedExamsList: OralExam[] = [...existingOralExams];

      for (const st of participatingStudents) {
        const recordKey = `${currentPeriod.id}_${st.id}`;
        const rec = studentRecords[recordKey] || {
          id: recordKey,
          periodId: currentPeriod.id,
          studentId: st.id,
          studentName: st.name,
          nationalId: st.nationalId,
          grade: st.grade,
          status: 'finalized',
          updatedAt: new Date().toISOString()
        };

        const finalizedRec = { ...rec, status: 'finalized' as const };
        await localDb.setDoc('oral_exam_records', finalizedRec.id, finalizedRec);

        // Sync Fiqh Exam Record to oral_exams
        if (currentPeriod.hasFiqh && (finalizedRec.fiqhScore !== null && finalizedRec.fiqhScore !== undefined || finalizedRec.fiqhIsRetake)) {
          const fiqhExamId = `exam_fiqh_${currentPeriod.id}_${st.id}`;
          const fiqhExam: OralExam = {
            id: fiqhExamId,
            studentId: st.id,
            title: `فقه (${currentPeriod.fiqhBooks.join('، ') || 'مکاسب'}) - ${currentPeriod.title}`,
            subjectType: 'فقه',
            score: finalizedRec.fiqhIsRetake ? 0 : Number(finalizedRec.fiqhScore || 0),
            examinerName: finalizedRec.fiqhExaminerTeacherName || currentPeriod.examinerTeacherNames[0] || 'استاد ممتحن فقه',
            date: currentPeriod.examDates[0] || getShamsiToday(),
            isRetake: Boolean(finalizedRec.fiqhIsRetake),
            periodId: currentPeriod.id,
            periodTitle: currentPeriod.title,
            scopeTitle: finalizedRec.fiqhScopeTitle,
            examinerNotes: finalizedRec.fiqhExaminerNotes || finalizedRec.examiner1Notes,
            notes: finalizedRec.fiqhExaminerNotes,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await localDb.setDoc('oral_exams', fiqhExam.id, fiqhExam);
          const idx = updatedExamsList.findIndex(e => e.id === fiqhExam.id);
          if (idx >= 0) updatedExamsList[idx] = fiqhExam;
          else updatedExamsList.push(fiqhExam);
        }

        // Sync Usul Exam Record to oral_exams
        if (currentPeriod.hasUsul && (finalizedRec.usulScore !== null && finalizedRec.usulScore !== undefined || finalizedRec.usulIsRetake)) {
          const usulExamId = `exam_usul_${currentPeriod.id}_${st.id}`;
          const usulExam: OralExam = {
            id: usulExamId,
            studentId: st.id,
            title: `اصول (${currentPeriod.usulBooks.join('، ') || 'رسائل'}) - ${currentPeriod.title}`,
            subjectType: 'اصول',
            score: finalizedRec.usulIsRetake ? 0 : Number(finalizedRec.usulScore || 0),
            examinerName: finalizedRec.usulExaminerTeacherName || currentPeriod.examinerTeacherNames[0] || 'استاد ممتحن اصول',
            date: currentPeriod.examDates[0] || getShamsiToday(),
            isRetake: Boolean(finalizedRec.usulIsRetake),
            periodId: currentPeriod.id,
            periodTitle: currentPeriod.title,
            scopeTitle: finalizedRec.usulScopeTitle,
            examinerNotes: finalizedRec.usulExaminerNotes || finalizedRec.examiner2Notes,
            notes: finalizedRec.usulExaminerNotes,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await localDb.setDoc('oral_exams', usulExam.id, usulExam);
          const idx = updatedExamsList.findIndex(e => e.id === usulExam.id);
          if (idx >= 0) updatedExamsList[idx] = usulExam;
          else updatedExamsList.push(usulExam);
        }
      }

      await loadData();
      setSaveSuccessMsg('تمام اطلاعات آزمون با موفقیت ثبت نهایی گردید و در پرونده و کارنامه طلاب آرشیو شد.');
      setTimeout(() => setSaveSuccessMsg(''), 5000);
    } catch (err: any) {
      alert(`خطا در ثبت نهایی: ${err?.message || 'مشکل اتصال'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered List of Students for Active Period
  const participatingStudents = useMemo(() => {
    if (!currentPeriod) return [];
    let list = students.filter(s => currentPeriod.participatingStudentIds?.includes(s.id));

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(s => 
        (s.name || '').toLowerCase().includes(q) || 
        (s.nationalId || '').includes(q) ||
        (s.fatherName || '').includes(q)
      );
    }

    if (filterGrade !== 'all') {
      list = list.filter(s => s.grade === filterGrade);
    }

    if (filterRetakeOnly) {
      list = list.filter(s => {
        const rec = studentRecords[`${currentPeriod.id}_${s.id}`];
        return rec?.fiqhIsRetake || rec?.usulIsRetake;
      });
    }

    return list;
  }, [currentPeriod, students, studentRecords, searchQuery, filterGrade, filterRetakeOnly]);

  // Examiner Options for Selectors
  const examinerOptions = useMemo(() => {
    if (!currentPeriod) return [];
    return currentPeriod.examinerTeacherNames || [];
  }, [currentPeriod]);

  // Fiqh & Usul Scopes
  const fiqhScopes = useMemo(() => {
    if (!currentPeriod?.scopes) return [];
    return currentPeriod.scopes.filter(s => s.courseType === 'fiqh');
  }, [currentPeriod]);

  const usulScopes = useMemo(() => {
    if (!currentPeriod?.scopes) return [];
    return currentPeriod.scopes.filter(s => s.courseType === 'usul');
  }, [currentPeriod]);

  // Print Report Handler
  const handlePrint = () => {
    window.print();
  };

  // Export CSV
  const handleExportCsv = () => {
    if (!currentPeriod) return;
    const headers = [
      'ردیف',
      'نام طلبه',
      'کد ملی',
      'پایه',
      currentPeriod.hasFiqh ? 'استاد ممتحن فقه' : '',
      currentPeriod.hasFiqh ? 'محدوده فقه' : '',
      currentPeriod.hasFiqh ? 'نمره فقه' : '',
      currentPeriod.hasFiqh ? 'امتحان مجدد فقه' : '',
      currentPeriod.hasUsul ? 'استاد ممتحن اصول' : '',
      currentPeriod.hasUsul ? 'محدوده اصول' : '',
      currentPeriod.hasUsul ? 'نمره اصول' : '',
      currentPeriod.hasUsul ? 'امتحان مجدد اصول' : '',
      'توضیحات ممتحنین'
    ].filter(Boolean);

    const rows = participatingStudents.map((st, idx) => {
      const rec: Partial<OralExamStudentRecord> = studentRecords[`${currentPeriod.id}_${st.id}`] || {};
      const row = [
        (idx + 1).toString(),
        st.name,
        st.nationalId || '',
        st.grade || '',
        currentPeriod.hasFiqh ? (rec.fiqhExaminerTeacherName || '') : '',
        currentPeriod.hasFiqh ? (rec.fiqhScopeTitle || '') : '',
        currentPeriod.hasFiqh ? (rec.fiqhIsRetake ? 'امتحان مجدد' : (rec.fiqhScore ?? '')) : '',
        currentPeriod.hasFiqh ? (rec.fiqhIsRetake ? 'بله' : 'خیر') : '',
        currentPeriod.hasUsul ? (rec.usulExaminerTeacherName || '') : '',
        currentPeriod.hasUsul ? (rec.usulScopeTitle || '') : '',
        currentPeriod.hasUsul ? (rec.usulIsRetake ? 'امتحان مجدد' : (rec.usulScore ?? '')) : '',
        currentPeriod.hasUsul ? (rec.usulIsRetake ? 'بله' : 'خیر') : '',
        `"${(rec.examiner1Notes || rec.generalNotes || '').replace(/"/g, '""')}"`
      ].filter(Boolean);
      return row.join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `نتایج_آزمون_شفاهی_${currentPeriod.title.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-24 font-vazir" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-700 via-amber-800 to-indigo-900 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
                <Award className="w-7 h-7 text-amber-300" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight">سامانه جامع آزمون شفاهی طلاب</h1>
                <p className="text-xs text-amber-100 font-medium">
                  مدیریت و ثبت دوره‌ای آزمون‌های شفاهی فقه و اصول، محدوده‌های درسی، نمرات و امتحانات مجدد
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleOpenCreateModal()}
              className="flex items-center gap-2 px-5 py-3 bg-amber-400 hover:bg-amber-300 text-slate-900 rounded-2xl text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Plus size={16} />
              <span>تعریف دوره امتحان شفاهی جدید</span>
            </button>
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      <AnimatePresence>
        {saveSuccessMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
            <button onClick={() => setSaveSuccessMsg('')} className="text-emerald-700 hover:text-emerald-900">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Period Selection & Quick Stats Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Period Selector Tabs */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <h2 className="text-sm font-black text-slate-800">دوره‌های آزمون شفاهی</h2>
            </div>
            <span className="text-xs text-slate-400 font-bold">
              تعداد دوره‌ها: {periods.length}
            </span>
          </div>

          {periods.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
              <Award className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600">هنوز دوره آزمون شفاهی تعریف نشده است.</p>
              <button
                onClick={() => handleOpenCreateModal()}
                className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-800 underline inline-flex items-center gap-1"
              >
                <Plus size={14} />
                <span>تعریف اولین دوره امتحان شفاهی</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {periods.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPeriodId(p.id)}
                  className={cn(
                    "px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border cursor-pointer",
                    selectedPeriodId === p.id
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  <span>{p.title}</span>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-black",
                    p.status === 'finalized' 
                      ? (selectedPeriodId === p.id ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-800")
                      : (selectedPeriodId === p.id ? "bg-amber-400 text-slate-900" : "bg-amber-100 text-amber-800")
                  )}>
                    {p.status === 'finalized' ? 'نهایی‌شده' : 'پیش‌نویس'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Period Info Card */}
        <div className="lg:col-span-4 bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl p-5 text-white shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-300">اطلاعات دوره فعال</span>
            {currentPeriod && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleOpenCreateModal(currentPeriod)}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-slate-200 text-xs font-bold transition-all"
                  title="ویرایش دوره"
                >
                  <Edit3 size={13} />
                </button>
                <button
                  onClick={() => handleDeletePeriod(currentPeriod.id)}
                  className="p-1.5 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 rounded-xl text-xs font-bold transition-all"
                  title="حذف دوره"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>

          {currentPeriod ? (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>پایه امتحانی:</span>
                <span className="font-bold text-white bg-white/10 px-2 py-0.5 rounded-lg">{currentPeriod.grade}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>دروس آزمون:</span>
                <span className="font-bold text-amber-300">
                  {[
                    currentPeriod.hasFiqh ? `فقه (${currentPeriod.fiqhBooks.join('، ')})` : '',
                    currentPeriod.hasUsul ? `اصول (${currentPeriod.usulBooks.join('، ')})` : ''
                  ].filter(Boolean).join(' + ')}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>اساتید ممتحن:</span>
                <span className="font-bold text-slate-200 truncate max-w-[180px]">
                  {currentPeriod.examinerTeacherNames?.join('، ') || 'ثبت نشده'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>تعداد طلاب شرکت‌کننده:</span>
                <span className="font-black text-white">{currentPeriod.participatingStudentIds?.length || 0} نفر</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">دوره‌ای انتخاب نشده است.</p>
          )}
        </div>
      </div>

      {/* Main Student Evaluation Table */}
      {currentPeriod && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden space-y-4 p-5">
          {/* Controls & Filter Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative min-w-[240px]">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجوی نام طلبه یا کد ملی..."
                  className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-bold"
                />
              </div>

              {/* Grade Filter */}
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">همه پایه‌ها</option>
                <option value="پایه ۷">پایه ۷</option>
                <option value="پایه ۸">پایه ۸</option>
                <option value="پایه ۹">پایه ۹</option>
                <option value="پایه ۱۰">پایه ۱۰</option>
              </select>

              {/* Retake Only Filter */}
              <button
                onClick={() => setFilterRetakeOnly(!filterRetakeOnly)}
                className={cn(
                  "px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer",
                  filterRetakeOnly 
                    ? "bg-rose-50 text-rose-700 border-rose-200 font-black shadow-2xs" 
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                )}
              >
                <RotateCcw size={13} />
                <span>فقط امتحانات مجدد</span>
              </button>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                title="چاپ صورتجلسه آزمون"
              >
                <Printer size={15} />
                <span>چاپ کارنامه</span>
              </button>

              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                title="خروجی فایل اکسل"
              >
                <Download size={15} />
                <span>خروجی اکسل</span>
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-right border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 text-xs font-black border-b border-slate-200">
                  <th className="py-3.5 px-3 w-12 text-center">ردیف</th>
                  <th className="py-3.5 px-4 min-w-[180px]">نام و مشخصات طلبه</th>

                  {/* Fiqh Group Headers */}
                  {currentPeriod.hasFiqh && (
                    <>
                      <th className="py-3.5 px-3 bg-amber-50/70 text-amber-900 border-r border-amber-200 min-w-[140px]">
                        استاد ممتحن فقه
                      </th>
                      <th className="py-3.5 px-3 bg-amber-50/70 text-amber-900 min-w-[160px]">
                        محدوده فقه
                      </th>
                      <th className="py-3.5 px-3 bg-amber-50/70 text-amber-900 w-24 text-center">
                        نمره فقه
                      </th>
                      <th className="py-3.5 px-3 bg-amber-50/70 text-amber-900 w-28 text-center">
                        امتحان مجدد فقه
                      </th>
                    </>
                  )}

                  {/* Usul Group Headers */}
                  {currentPeriod.hasUsul && (
                    <>
                      <th className="py-3.5 px-3 bg-indigo-50/70 text-indigo-900 border-r border-indigo-200 min-w-[140px]">
                        استاد ممتحن اصول
                      </th>
                      <th className="py-3.5 px-3 bg-indigo-50/70 text-indigo-900 min-w-[160px]">
                        محدوده اصول
                      </th>
                      <th className="py-3.5 px-3 bg-indigo-50/70 text-indigo-900 w-24 text-center">
                        نمره اصول
                      </th>
                      <th className="py-3.5 px-3 bg-indigo-50/70 text-indigo-900 w-28 text-center">
                        امتحان مجدد اصول
                      </th>
                    </>
                  )}

                  <th className="py-3.5 px-4 text-center min-w-[120px]">توضیحات ممتحن</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {participatingStudents.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-10 text-slate-400 font-bold">
                      هیچ طلبه‌ای منطبق بر فیلترهای جستجو یافت نشد.
                    </td>
                  </tr>
                ) : (
                  participatingStudents.map((st, idx) => {
                    const recordKey = `${currentPeriod.id}_${st.id}`;
                    const rec = studentRecords[recordKey] || {
                      id: recordKey,
                      periodId: currentPeriod.id,
                      studentId: st.id,
                      studentName: st.name,
                      nationalId: st.nationalId,
                      grade: st.grade,
                      status: 'draft',
                      updatedAt: new Date().toISOString()
                    };

                    const hasNotes = Boolean(rec.examiner1Notes || rec.examiner2Notes || rec.fiqhExaminerNotes || rec.usulExaminerNotes);

                    return (
                      <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Index */}
                        <td className="py-3 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>

                        {/* Student Name & Avatar */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                              {st.photoUrl ? (
                                <img src={st.photoUrl} alt={st.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="font-black text-slate-600 text-xs">{(st.name || 'ط')[0]}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-black text-slate-900 truncate">{st.name}</div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-2 font-mono">
                                <span>{st.grade || 'پایه'}</span>
                                {st.nationalId && <span>• {st.nationalId}</span>}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Fiqh Columns */}
                        {currentPeriod.hasFiqh && (
                          <>
                            {/* Fiqh Examiner */}
                            <td className="py-2.5 px-3 bg-amber-50/30 border-r border-amber-100">
                              <select
                                value={rec.fiqhExaminerTeacherName || ''}
                                onChange={(e) => handleUpdateRecord(st.id, { fiqhExaminerTeacherName: e.target.value })}
                                className="w-full px-2.5 py-1.5 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer"
                              >
                                <option value="">انتخاب ممتحن...</option>
                                {examinerOptions.map(name => (
                                  <option key={name} value={name}>{name}</option>
                                ))}
                              </select>
                            </td>

                            {/* Fiqh Scope */}
                            <td className="py-2.5 px-3 bg-amber-50/30">
                              {fiqhScopes.length > 0 ? (
                                <select
                                  value={rec.fiqhScopeTitle || ''}
                                  onChange={(e) => handleUpdateRecord(st.id, { fiqhScopeTitle: e.target.value })}
                                  className="w-full px-2.5 py-1.5 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer"
                                >
                                  <option value="">انتخاب محدوده...</option>
                                  {fiqhScopes.map(sc => (
                                    <option key={sc.id} value={sc.title}>{sc.title}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={rec.fiqhScopeTitle || ''}
                                  onChange={(e) => handleUpdateRecord(st.id, { fiqhScopeTitle: e.target.value })}
                                  placeholder="محدوده فقه..."
                                  className="w-full px-2.5 py-1.5 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                                />
                              )}
                            </td>

                            {/* Fiqh Score */}
                            <td className="py-2.5 px-3 bg-amber-50/30 text-center">
                              <input
                                type="number"
                                min="0"
                                max="20"
                                step="0.25"
                                disabled={Boolean(rec.fiqhIsRetake)}
                                value={rec.fiqhIsRetake ? '' : (rec.fiqhScore ?? '')}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? null : Number(e.target.value);
                                  handleUpdateRecord(st.id, { fiqhScore: val });
                                }}
                                placeholder={rec.fiqhIsRetake ? 'مجدد' : 'نمره'}
                                className={cn(
                                  "w-16 px-2 py-1.5 text-center font-bold font-mono rounded-xl border focus:outline-none text-xs",
                                  rec.fiqhIsRetake
                                    ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                                    : (rec.fiqhScore !== null && rec.fiqhScore !== undefined && rec.fiqhScore >= 12)
                                      ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                                      : (rec.fiqhScore !== null && rec.fiqhScore !== undefined && rec.fiqhScore < 12)
                                        ? "bg-rose-50 border-rose-300 text-rose-800"
                                        : "bg-white border-amber-200 text-slate-800 focus:border-amber-500"
                                )}
                              />
                            </td>

                            {/* Fiqh Retake Toggle */}
                            <td className="py-2.5 px-3 bg-amber-50/30 text-center">
                              <button
                                type="button"
                                onClick={() => handleUpdateRecord(st.id, { 
                                  fiqhIsRetake: !rec.fiqhIsRetake,
                                  fiqhScore: !rec.fiqhIsRetake ? null : rec.fiqhScore
                                })}
                                className={cn(
                                  "px-2.5 py-1.5 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer",
                                  rec.fiqhIsRetake
                                    ? "bg-rose-600 text-white shadow-xs"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200"
                                )}
                              >
                                <RotateCcw size={11} />
                                <span>{rec.fiqhIsRetake ? 'امتحان مجدد' : 'عادی'}</span>
                              </button>
                            </td>
                          </>
                        )}

                        {/* Usul Columns */}
                        {currentPeriod.hasUsul && (
                          <>
                            {/* Usul Examiner */}
                            <td className="py-2.5 px-3 bg-indigo-50/30 border-r border-indigo-100">
                              <select
                                value={rec.usulExaminerTeacherName || ''}
                                onChange={(e) => handleUpdateRecord(st.id, { usulExaminerTeacherName: e.target.value })}
                                className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
                              >
                                <option value="">انتخاب ممتحن...</option>
                                {examinerOptions.map(name => (
                                  <option key={name} value={name}>{name}</option>
                                ))}
                              </select>
                            </td>

                            {/* Usul Scope */}
                            <td className="py-2.5 px-3 bg-indigo-50/30">
                              {usulScopes.length > 0 ? (
                                <select
                                  value={rec.usulScopeTitle || ''}
                                  onChange={(e) => handleUpdateRecord(st.id, { usulScopeTitle: e.target.value })}
                                  className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
                                >
                                  <option value="">انتخاب محدوده...</option>
                                  {usulScopes.map(sc => (
                                    <option key={sc.id} value={sc.title}>{sc.title}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={rec.usulScopeTitle || ''}
                                  onChange={(e) => handleUpdateRecord(st.id, { usulScopeTitle: e.target.value })}
                                  placeholder="محدوده اصول..."
                                  className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                                />
                              )}
                            </td>

                            {/* Usul Score */}
                            <td className="py-2.5 px-3 bg-indigo-50/30 text-center">
                              <input
                                type="number"
                                min="0"
                                max="20"
                                step="0.25"
                                disabled={Boolean(rec.usulIsRetake)}
                                value={rec.usulIsRetake ? '' : (rec.usulScore ?? '')}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? null : Number(e.target.value);
                                  handleUpdateRecord(st.id, { usulScore: val });
                                }}
                                placeholder={rec.usulIsRetake ? 'مجدد' : 'نمره'}
                                className={cn(
                                  "w-16 px-2 py-1.5 text-center font-bold font-mono rounded-xl border focus:outline-none text-xs",
                                  rec.usulIsRetake
                                    ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                                    : (rec.usulScore !== null && rec.usulScore !== undefined && rec.usulScore >= 12)
                                      ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                                      : (rec.usulScore !== null && rec.usulScore !== undefined && rec.usulScore < 12)
                                        ? "bg-rose-50 border-rose-300 text-rose-800"
                                        : "bg-white border-indigo-200 text-slate-800 focus:border-indigo-500"
                                )}
                              />
                            </td>

                            {/* Usul Retake Toggle */}
                            <td className="py-2.5 px-3 bg-indigo-50/30 text-center">
                              <button
                                type="button"
                                onClick={() => handleUpdateRecord(st.id, { 
                                  usulIsRetake: !rec.usulIsRetake,
                                  usulScore: !rec.usulIsRetake ? null : rec.usulScore
                                })}
                                className={cn(
                                  "px-2.5 py-1.5 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer",
                                  rec.usulIsRetake
                                    ? "bg-rose-600 text-white shadow-xs"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200"
                                )}
                              >
                                <RotateCcw size={11} />
                                <span>{rec.usulIsRetake ? 'امتحان مجدد' : 'عادی'}</span>
                              </button>
                            </td>
                          </>
                        )}

                        {/* Notes / Comments Button */}
                        <td className="py-2.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setActiveNotesStudentRecord(rec)}
                            className={cn(
                              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 mx-auto cursor-pointer",
                              hasNotes
                                ? "bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 shadow-2xs"
                                : "bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200"
                            )}
                          >
                            <MessageSquare size={13} />
                            <span>{hasNotes ? 'مشاهده/ویرایش نظرات' : 'ثبت نظر'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Action Bar: Draft Save & Final Archive */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/80 p-4 rounded-2xl">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
              <span>وضعیت دوره:</span>
              <span className={cn(
                "px-2.5 py-1 rounded-full font-black",
                currentPeriod.status === 'finalized'
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  : "bg-amber-100 text-amber-800 border border-amber-200"
              )}>
                {currentPeriod.status === 'finalized' ? 'نهایی‌شده و ثبت‌شده در سوابق' : 'پیش‌نویس (ثبت موقت)'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Draft Save Button */}
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSaving}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-xs font-black transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save size={15} />
                <span>ثبت موقت دوره</span>
              </button>

              {/* Final Submit & Archive */}
              <button
                type="button"
                onClick={handleFinalSubmitAndArchive}
                disabled={isSaving}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Archive size={15} />
                <span>ثبت نهایی و ثبت در سابقه و آرشیو امتحان</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create / Edit Period */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-2xl border border-slate-200 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto custom-scrollbar"
              dir="rtl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                    <Award size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">
                      {isEditingPeriod ? 'ویرایش دوره امتحان شفاهی' : 'تعریف دوره امتحان شفاهی جدید'}
                    </h3>
                    <p className="text-[11px] text-slate-400">تنظیم مشخصات، دروس، اساتید ممتحن و محدوده‌های امتحانی</p>
                  </div>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSavePeriod} className="space-y-4">
                {/* Period Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    عنوان دوره آزمون شفاهی: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formPeriodTitle}
                    onChange={(e) => setFormPeriodTitle(e.target.value)}
                    placeholder="مثال: دوره آزمون شفاهی نیمسال اول پایه ۹ - آذر ۱۴۰۳"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Target Grade Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    انتخاب پایه اصلی دوره:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GRADE_OPTIONS.map(g => (
                      <button
                        type="button"
                        key={g.id}
                        onClick={() => handleTargetGradeChange(g.id)}
                        className={cn(
                          "px-4 py-2 rounded-2xl text-xs font-bold transition-all border cursor-pointer",
                          formTargetGrade === g.id
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-xs font-black"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Course Subjects (Usul & Fiqh) */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/90 space-y-3">
                  <label className="block text-xs font-black text-slate-800">
                    تعیین دروس امتحانی (فقه و اصول):
                  </label>
                  
                  {/* Usul Subject Toggle & Books */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                    <label className="flex items-center gap-2 text-xs font-black text-indigo-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formHasUsul}
                        onChange={(e) => setFormHasUsul(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <span>امتحان درس اصول (رسائل، کفایه، حلقه ثالثه...)</span>
                    </label>

                    {formHasUsul && (
                      <div className="pt-2 pr-6 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500">کتاب / متن:</span>
                        {USUL_BOOK_OPTIONS.map(b => (
                          <button
                            type="button"
                            key={b}
                            onClick={() => {
                              if (formUsulBooks.includes(b)) {
                                setFormUsulBooks(prev => prev.filter(x => x !== b));
                              } else {
                                setFormUsulBooks(prev => [...prev, b]);
                              }
                            }}
                            className={cn(
                              "px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                              formUsulBooks.includes(b)
                                ? "bg-indigo-50 text-indigo-700 border-indigo-300 font-black"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            )}
                          >
                            {b}
                          </button>
                        ))}

                        {formUsulBooks.includes('سایر') && (
                          <input
                            type="text"
                            value={formCustomUsulBook}
                            onChange={(e) => setFormCustomUsulBook(e.target.value)}
                            placeholder="نام کتاب یا متن اصول..."
                            className="px-2.5 py-1 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Fiqh Subject Toggle & Books */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                    <label className="flex items-center gap-2 text-xs font-black text-amber-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formHasFiqh}
                        onChange={(e) => setFormHasFiqh(e.target.checked)}
                        className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                      />
                      <span>امتحان درس فقه (مکاسب، شرح لمعه...)</span>
                    </label>

                    {formHasFiqh && (
                      <div className="pt-2 pr-6 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500">کتاب / متن:</span>
                        {FIQH_BOOK_OPTIONS.map(b => (
                          <button
                            type="button"
                            key={b}
                            onClick={() => {
                              if (formFiqhBooks.includes(b)) {
                                setFormFiqhBooks(prev => prev.filter(x => x !== b));
                              } else {
                                setFormFiqhBooks(prev => [...prev, b]);
                              }
                            }}
                            className={cn(
                              "px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                              formFiqhBooks.includes(b)
                                ? "bg-amber-50 text-amber-800 border-amber-300 font-black"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            )}
                          >
                            {b}
                          </button>
                        ))}

                        {formFiqhBooks.includes('سایر') && (
                          <input
                            type="text"
                            value={formCustomFiqhBook}
                            onChange={(e) => setFormCustomFiqhBook(e.target.value)}
                            placeholder="نام کتاب یا متن فقه..."
                            className="px-2.5 py-1 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Exam Dates */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    روزهای برگزاری امتحان:
                  </label>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {formExamDates.map(d => (
                      <span key={d} className="px-3 py-1 bg-slate-100 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-200">
                        <Calendar size={13} className="text-slate-500" />
                        <span>{d}</span>
                        <button type="button" onClick={() => handleRemoveExamDate(d)} className="text-slate-400 hover:text-rose-600">
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={formNewDateInput}
                      onChange={(e) => setFormNewDateInput(e.target.value)}
                      placeholder="تاریخ جدید (مثلاً 1403/09/16)"
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 w-48 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleAddExamDate}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-xs font-bold"
                    >
                      افزودن روز
                    </button>
                  </div>
                </div>

                {/* Participating Examiners (Teachers from Bank) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      اساتید ممتحن دوره (انتخاب از بانک اساتید): <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] font-bold text-indigo-600">
                      {formSelectedTeacherIds.length} استاد انتخاب شده
                    </span>
                  </div>
                  
                  {teachers.length === 0 ? (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 text-xs font-bold text-center">
                      استادی در بانک اساتید ثبت نشده است. ابتدا در بخش «بانک اساتید» اساتید را تعریف نمایید.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2.5 bg-slate-50 rounded-2xl border border-slate-200 custom-scrollbar">
                      {teachers.map(t => {
                        const isSelected = formSelectedTeacherIds.includes(t.id);
                        return (
                          <button
                            type="button"
                            key={t.id}
                            onClick={() => {
                              if (isSelected) {
                                setFormSelectedTeacherIds(prev => prev.filter(id => id !== t.id));
                              } else {
                                setFormSelectedTeacherIds(prev => [...prev, t.id]);
                              }
                            }}
                            className={cn(
                              "p-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-between text-right",
                              isSelected
                                ? "bg-indigo-50 border-indigo-300 text-indigo-900 shadow-2xs font-black"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                            )}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <div className={cn(
                                "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0",
                                isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                              )}>
                                {isSelected ? <Check size={12} /> : (t.name || 'ا')[0]}
                              </div>
                              <span className="truncate">{t.name}</span>
                            </div>
                            {t.courses && (
                              <span className="text-[10px] text-slate-400 font-normal truncate max-w-[90px]">
                                {t.courses}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Custom Exam Scope Ranges (محدوده‌ها) */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/90 space-y-3">
                  <label className="flex items-center gap-2 text-xs font-black text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formHasCustomScopes}
                      onChange={(e) => setFormHasCustomScopes(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <span>تعیین و تفکیک محدوده‌های امتحانی برای فقه و اصول</span>
                  </label>

                  {formHasCustomScopes && (
                    <div className="space-y-3 pt-2">
                      {/* Fiqh Scopes */}
                      {formHasFiqh && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-amber-900">محدوده‌های امتحان فقه:</span>
                            <button
                              type="button"
                              onClick={() => handleAddScope('fiqh')}
                              className="text-[11px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1"
                            >
                              <Plus size={13} />
                              <span>افزودن محدوده فقه</span>
                            </button>
                          </div>
                          {formScopes.filter(s => s.courseType === 'fiqh').map(sc => (
                            <div key={sc.id} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={sc.title}
                                onChange={(e) => handleUpdateScopeTitle(sc.id, e.target.value)}
                                placeholder="عنوان محدوده فقه..."
                                className="flex-1 px-3 py-1.5 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveScope(sc.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Usul Scopes */}
                      {formHasUsul && (
                        <div className="space-y-2 pt-2 border-t border-slate-200">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-indigo-900">محدوده‌های امتحان اصول:</span>
                            <button
                              type="button"
                              onClick={() => handleAddScope('usul')}
                              className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1"
                            >
                              <Plus size={13} />
                              <span>افزودن محدوده اصول</span>
                            </button>
                          </div>
                          {formScopes.filter(s => s.courseType === 'usul').map(sc => (
                            <div key={sc.id} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={sc.title}
                                onChange={(e) => handleUpdateScopeTitle(sc.id, e.target.value)}
                                placeholder="عنوان محدوده اصول..."
                                className="flex-1 px-3 py-1.5 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveScope(sc.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Additional Students Manual Selection */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      طلاب شرکت‌کننده در این دوره ({formParticipatingStudentIds.length} نفر):
                    </label>
                  </div>
                  <div className="max-h-40 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200 space-y-1 custom-scrollbar">
                    {students
                      .filter(s => {
                        if (!formAdditionalStudentSearch.trim()) return true;
                        return s.name.includes(formAdditionalStudentSearch) || (s.nationalId || '').includes(formAdditionalStudentSearch);
                      })
                      .map(st => {
                        const isSelected = formParticipatingStudentIds.includes(st.id);
                        return (
                          <label key={st.id} className="flex items-center justify-between p-1.5 hover:bg-white rounded-xl text-xs cursor-pointer">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormParticipatingStudentIds(prev => [...prev, st.id]);
                                  } else {
                                    setFormParticipatingStudentIds(prev => prev.filter(id => id !== st.id));
                                  }
                                }}
                                className="w-3.5 h-3.5 text-indigo-600 rounded"
                              />
                              <span className="font-bold text-slate-800">{st.name}</span>
                              <span className="text-[10px] text-slate-400">({st.grade || 'نامشخص'})</span>
                            </div>
                          </label>
                        );
                      })}
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black shadow-md active:scale-95"
                  >
                    {isEditingPeriod ? 'ذخیره تغییرات دوره' : 'ایجاد دوره امتحان شفاهی'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Examiner Notes & Comments (Per Student) */}
      <AnimatePresence>
        {activeNotesStudentRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg border border-slate-200 shadow-2xl space-y-4"
              dir="rtl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-amber-600" />
                  <h3 className="text-sm font-black text-slate-800">
                    ثبت نظرات و توضیحات اساتید ممتحن: {activeNotesStudentRecord.studentName}
                  </h3>
                </div>
                <button onClick={() => setActiveNotesStudentRecord(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-amber-900 mb-1">
                    نظر استاد ممتحن اول (فقه):
                  </label>
                  <textarea
                    rows={3}
                    value={activeNotesStudentRecord.fiqhExaminerNotes || activeNotesStudentRecord.examiner1Notes || ''}
                    onChange={(e) => setActiveNotesStudentRecord({
                      ...activeNotesStudentRecord,
                      fiqhExaminerNotes: e.target.value,
                      examiner1Notes: e.target.value
                    })}
                    placeholder="توضیحات یا نقاط قوت و ضعف تسلط طلبه در آزمون فقه..."
                    className="w-full p-3 bg-slate-50 border border-amber-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-indigo-900 mb-1">
                    نظر استاد ممتحن دوم (اصول):
                  </label>
                  <textarea
                    rows={3}
                    value={activeNotesStudentRecord.usulExaminerNotes || activeNotesStudentRecord.examiner2Notes || ''}
                    onChange={(e) => setActiveNotesStudentRecord({
                      ...activeNotesStudentRecord,
                      usulExaminerNotes: e.target.value,
                      examiner2Notes: e.target.value
                    })}
                    placeholder="توضیحات یا نکات برجسته آزمون اصول..."
                    className="w-full p-3 bg-slate-50 border border-indigo-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveNotesStudentRecord(null)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-2xl font-bold"
                  >
                    بستن
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeNotesStudentRecord) {
                        handleUpdateRecord(activeNotesStudentRecord.studentId, {
                          fiqhExaminerNotes: activeNotesStudentRecord.fiqhExaminerNotes,
                          examiner1Notes: activeNotesStudentRecord.examiner1Notes,
                          usulExaminerNotes: activeNotesStudentRecord.usulExaminerNotes,
                          examiner2Notes: activeNotesStudentRecord.examiner2Notes
                        });
                        setActiveNotesStudentRecord(null);
                      }
                    }}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black"
                  >
                    ثبت و تأیید نظرات
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
