import React, { useState, useEffect, useRef } from 'react';
import { 
  UserPlus, 
  Plus,
  Search, 
  Filter, 
  Phone, 
  GraduationCap, 
  BookOpen, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Star, 
  Upload, 
  Download, 
  Grid, 
  List, 
  FileSpreadsheet, 
  Copy, 
  Check, 
  Clock, 
  Sparkles, 
  ChevronDown,
  UserCheck,
  Award,
  HelpCircle,
  FileText,
  Printer,
  PhoneCall,
  ShieldAlert,
  Building2,
  Loader2,
  Hash,
  MapPin,
  History,
  CreditCard,
  User
} from 'lucide-react';
import {
  Teacher,
  TeacherCategory,
  TeacherDetailedSpecialties,
  TeacherBankAccount,
  Program,
  TeacherManualSchedule,
  StudentCourseProgress,
  AttendanceSessionLog,
  AcademicWeeklyProgram
} from '../types';
import { localDb } from '../lib/localDb';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { dispatchDatabaseToast } from '../lib/databaseToast';
import { motion, AnimatePresence } from 'motion/react';
import { exportElementToPdf } from '../lib/pdfExport';
import { useIsAdminMobile } from './admin/mobile/AdminMobileContext';
import { MobileSectionHeader, MobileSearchFilterBar } from './admin/mobile/MobileModulePrimitives';
import TeacherExcelImportModal from './teacher/TeacherExcelImportModal';

const ALL_CATEGORIES: TeacherCategory[] = [
  'فقه',
  'اصول',
  'فلسفه',
  'مشاوره اصول',
  'مشاوره فقه',
  'مشاوره فلسفه',
  'دروس پنجشنبه',
  'ویژه'
];

function normalizeTeacherText(input?: string): string {
  return String(input || '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/أ|إ|آ/g, 'ا')
    .replace(/حجت\s*الاسلام\s*و\s*المسلمین/g, ' ')
    .replace(/حجت\s*الاسلام|حجه\s*الاسلام|آیت\s*الله|استاد|حاج\s*آقا|دکتر|شیخ|آقای|سرکار\s*خانم|خانم/g, ' ')
    .replace(/[\u200c\s]+/g, ' ')
    .trim();
}

function matchTeacherWithRecordName(rawName: string | undefined, teacher: Teacher): boolean {
  const normRaw = normalizeTeacherText(rawName);
  if (!normRaw) return false;

  const candidates = [
    teacher.fullName,
    [teacher.firstName, teacher.lastName].filter(Boolean).join(' ')
  ]
    .map((c) => normalizeTeacherText(c))
    .filter((c) => c.length >= 2);

  for (const cand of candidates) {
    if (normRaw === cand) return true;
    const rawNoPrefix = normRaw.replace(/^(سید|سیده)\s+/, '');
    const candNoPrefix = cand.replace(/^(سید|سیده)\s+/, '');
    if (rawNoPrefix && candNoPrefix && rawNoPrefix === candNoPrefix) return true;
    if (cand.length >= 4 && (normRaw.includes(cand) || cand.includes(normRaw))) return true;
  }
  return false;
}

function splitFullNameParts(fullName?: string, firstName?: string, lastName?: string): { firstName: string; lastName: string } {
  const f = (firstName || '').trim();
  const l = (lastName || '').trim();
  if (f || l) {
    return { firstName: f, lastName: l };
  }
  const cleanFull = (fullName || '').trim().replace(/\s+/g, ' ');
  if (!cleanFull) return { firstName: '', lastName: '' };
  const parts = cleanFull.split(' ');
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1]
  };
}

function extractShamsiYear(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = String(dateStr).trim();
  if (/^\d{4}\//.test(clean) || /^[۰-۹]{4}\//.test(clean)) {
    return clean.slice(0, 4).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  }
  const dt = new Date(clean);
  if (!Number.isNaN(dt.getTime())) {
    try {
      const faDate = dt.toLocaleDateString('fa-IR');
      const m = faDate.match(/[۰-۹]{4}|\d{4}/);
      if (m) {
        return m[0].replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
      }
    } catch {
      return '';
    }
  }
  return '';
}

export interface AutoTeachingHistoryInfo {
  currentCourses: string[];
  pastCourses: string[];
  summaryText: string;
  totalCount: number;
}

export default function TeachersBank() {
  const { currentUser } = useAuth();
  const isAdminMobile = useIsAdminMobile();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState<boolean>(false);
  const isLevel2User = currentUser?.level === 1 || currentUser?.level === 2;
  const canManageTeachers = Boolean(
    currentUser && (
      currentUser.level === 1 || 
      currentUser.role === 'super_admin' || 
      currentUser.role === 'education_manager' || 
      currentUser.role === 'education_officer' || 
      currentUser.role === 'school_manager' || 
      currentUser.username?.toUpperCase() === 'SHAH'
    ) && !currentUser.isReadOnly
  );

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [teacherSchedules, setTeacherSchedules] = useState<TeacherManualSchedule[]>([]);
  const [courseProgressRecords, setCourseProgressRecords] = useState<StudentCourseProgress[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceSessionLog[]>([]);
  const [weeklyPrograms, setWeeklyPrograms] = useState<AcademicWeeklyProgram[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Multi-copy phone state (Level 2)
  const [isMultiCopyMode, setIsMultiCopyMode] = useState<boolean>(false);
  const [selectedMultiPhoneIds, setSelectedMultiPhoneIds] = useState<string[]>([]);
  
  // Search and Filters State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedPhoneFilter, setSelectedPhoneFilter] = useState<string>('all'); // all | has-phone | no-phone

  // Export Settings State
  const [includePhoneInExport, setIncludePhoneInExport] = useState<boolean>(true);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const pdfPrintRef = useRef<HTMLDivElement>(null);

  // Import State (4-Step Excel Wizard + JSON Legacy Import Modal)
  const [excelImportFile, setExcelImportFile] = useState<File | null>(null);
  const [showExcelImportModal, setShowExcelImportModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importLoading, setImportLoading] = useState<boolean>(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Layout View Mode ('list' is default as requested by user)
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // Form State — Separated Basic/Identity & Contact Fields
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [fatherName, setFatherName] = useState<string>('');
  const [nationalId, setNationalId] = useState<string>('');
  const [birthCertificateNumber, setBirthCertificateNumber] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [homePhone, setHomePhone] = useState<string>('');
  const [homeAddress, setHomeAddress] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');

  // Form State — Codes & Center Identifiers
  const [teacherCode, setTeacherCode] = useState<string>('');
  const [centerTeacherCode, setCenterTeacherCode] = useState<string>('');
  const [servicesCenterCode, setServicesCenterCode] = useState<string>('');
  const [managementCenterFileNumber, setManagementCenterFileNumber] = useState<string>('');

  // Form State — Status, Priority, Categories, Notes, Experience
  const [priority, setPriority] = useState<1 | 2 | 3>(1);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [selectedCategories, setSelectedCategories] = useState<TeacherCategory[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [experienceHistory, setExperienceHistory] = useState<string>('');

  // Financial & Multiple Bank Accounts State
  const [bankAccountsList, setBankAccountsList] = useState<TeacherBankAccount[]>([
    { id: 'acc_1', bankName: 'بانک ملی', accountNumber: '', cardNumber: '', shebaNumber: '', note: '' }
  ]);
  const [bankName, setBankName] = useState<string>('');
  const [bankAccount, setBankAccount] = useState<string>('');
  const [bankSheba, setBankSheba] = useState<string>('');
  const [tejaratBankAccount, setTejaratBankAccount] = useState<string>('');
  const [sibaBankAccount, setSibaBankAccount] = useState<string>('');

  // Detailed Specialties State
  const [usulSpecialties, setUsulSpecialties] = useState<('رسائل' | 'کفایه' | 'حلقات')[]>([]);
  const [fiqhSpecialties, setFiqhSpecialties] = useState<('مکاسب')[]>([]);
  const [falsafaSpecialties, setFalsafaSpecialties] = useState<('بدایه' | 'نهایه' | 'آموزش فلسفه')[]>([]);
  const [thursdayNote, setThursdayNote] = useState<string>('');

  const isSeedingRef = useRef<boolean>(false);

  // Fetch teachers & school teaching history collections from DB
  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const [
        docs,
        programsDocs,
        schedulesDocs,
        progressDocs,
        attendanceDocs,
        weeklyDocs
      ] = await Promise.all([
        localDb.getDocs('teachers') as Promise<Teacher[]>,
        (localDb.getDocs('programs') as Promise<Program[]>).catch((err) => {
          console.error('[TEACHERS_BANK_FETCH_FAIL] programs:', err);
          return [] as Program[];
        }),
        (localDb.getDocs('teacher_schedules') as Promise<TeacherManualSchedule[]>).catch((err) => {
          console.error('[TEACHERS_BANK_FETCH_FAIL] teacher_schedules:', err);
          return [] as TeacherManualSchedule[];
        }),
        (localDb.getDocs('student_course_progress') as Promise<StudentCourseProgress[]>).catch((err) => {
          console.error('[TEACHERS_BANK_FETCH_FAIL] student_course_progress:', err);
          return [] as StudentCourseProgress[];
        }),
        (localDb.getDocs('attendance') as Promise<AttendanceSessionLog[]>).catch((err) => {
          console.error('[TEACHERS_BANK_FETCH_FAIL] attendance:', err);
          return [] as AttendanceSessionLog[];
        }),
        (localDb.getDocs('academic_weekly_programs') as Promise<AcademicWeeklyProgram[]>).catch((err) => {
          console.error('[TEACHERS_BANK_FETCH_FAIL] academic_weekly_programs:', err);
          return [] as AcademicWeeklyProgram[];
        }),
      ]);

      setPrograms(programsDocs);
      setTeacherSchedules(schedulesDocs);
      setCourseProgressRecords(progressDocs);
      setAttendanceLogs(attendanceDocs);
      setWeeklyPrograms(weeklyDocs);

      if (!isSeedingRef.current) {
        isSeedingRef.current = true;
        // Clean up previous seed sample data if exists
        const SEED_NAMES = [
          'استاد سید محمدحسین حسینی',
          'استاد رضا سلیمانی',
          'استاد علی‌اکبر اسدی'
        ];
        const seedDocs = docs.filter(d => SEED_NAMES.includes(d.fullName));
        
        let cleanDocs = docs;
        if (seedDocs.length > 0) {
          for (const sd of seedDocs) {
            await localDb.deleteDoc('teachers', sd.id);
          }
          cleanDocs = (await localDb.getDocs('teachers')) as Teacher[];
        }

        setTeachers(cleanDocs.filter(t => !t.isExternal));
      } else {
        setTeachers(docs.filter(t => !t.isExternal));
      }
    } catch (err) {
      console.error('[TEACHERS_BANK_FETCH_FAIL] teachers:', err);
      dispatchDatabaseToast('خطا در دریافت اطلاعات بانک اساتید', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
    const unsub = localDb.subscribe(() => {
      fetchTeachers();
    });
    return () => unsub();
  }, []);

  // Precompute automatic teaching history for every teacher from programs, archived courses, passed records, weekly programs & substitute logs
  const autoTeachingHistoryMap = React.useMemo(() => {
    const map: Record<string, AutoTeachingHistoryInfo> = {};

    // Index passed progress records by programId
    const passedByProgramId: Record<string, StudentCourseProgress[]> = {};
    for (const rec of courseProgressRecords) {
      if (rec.status === 'passed' && rec.programId) {
        if (!passedByProgramId[rec.programId]) passedByProgramId[rec.programId] = [];
        passedByProgramId[rec.programId].push(rec);
      }
    }

    // Index attendance years by programId
    const attendanceYearsByProgramId: Record<string, Set<string>> = {};
    for (const log of attendanceLogs) {
      if (log.isCancelled) continue;
      const yr = extractShamsiYear(log.date);
      if (yr && log.programId) {
        if (!attendanceYearsByProgramId[log.programId]) attendanceYearsByProgramId[log.programId] = new Set();
        attendanceYearsByProgramId[log.programId].add(yr);
      }
    }

    for (const teacher of teachers) {
      const currentCourses: string[] = [];
      const pastCourses: string[] = [];
      const seenCurrent = new Set<string>();
      const seenPast = new Set<string>();

      // 1. School Programs (active vs archived/deleted/passed-to-history)
      const matchedPrograms = programs.filter((p) => matchTeacherWithRecordName(p.teacher, teacher));
      for (const prog of matchedPrograms) {
        const isArchived = Boolean(prog.isDeleted) || prog.status === 'inactive' || prog.status === 'deleted';
        const passedList = passedByProgramId[prog.id] || [];
        const detailsParts = [
          prog.title,
          prog.grade ? `(${prog.grade})` : '',
          prog.subjectBook ? `کتاب: ${prog.subjectBook}${prog.subjectChapter ? ` - ${prog.subjectChapter}` : ''}` : ''
        ].filter(Boolean);
        const baseLabel = detailsParts.join(' ');

        if (!isArchived) {
          if (!seenCurrent.has(baseLabel)) {
            seenCurrent.add(baseLabel);
            currentCourses.push(baseLabel);
          }
        } else {
          const years = Array.from(
            new Set([
              ...(attendanceYearsByProgramId[prog.id] ? Array.from(attendanceYearsByProgramId[prog.id]) : []),
              extractShamsiYear(prog.deletedAt)
            ].filter(Boolean))
          ).sort();
          const yearSuffix = years.length > 0 ? ` [سال ${years.join('، ')}]` : ' [آرشیو/دوره قبل]';
          const pastLabel = `${baseLabel}${yearSuffix}`;
          if (!seenPast.has(pastLabel)) {
            seenPast.add(pastLabel);
            pastCourses.push(pastLabel);
          }
        }

        // If courses from this program were finalized/moved to students' passed course records (end-of-year archival)
        if (passedList.length > 0) {
          const passedYears = Array.from(
            new Set(passedList.map((r) => extractShamsiYear(r.passedAt || r.updatedAt)).filter(Boolean))
          ).sort();
          const sampleRec = passedList[0];
          const courseTitle = [
            sampleRec.bookTitle || prog.subjectBook || prog.title,
            sampleRec.chapterTitle || prog.subjectChapter
          ].filter(Boolean).join(' - ');
          const pastPassedLabel = `درس پایان‌یافته/منتقل‌شده به سوابق: ${courseTitle}${prog.grade ? ` (${prog.grade})` : ''}${passedYears.length > 0 ? ` — سال ${passedYears.join('، ')}` : ''} (${passedList.length} طلبه ثبت‌شده در سوابق)`;
          if (!seenPast.has(pastPassedLabel)) {
            seenPast.add(pastPassedLabel);
            pastCourses.push(pastPassedLabel);
          }
        }
      }

      // 2. Teacher Manual Schedules (برنامه هفتگی اختصاصی اساتید)
      for (const sch of teacherSchedules) {
        if (sch.teacherId === teacher.id || matchTeacherWithRecordName(sch.teacherName, teacher)) {
          const label = [
            sch.title,
            sch.grade ? `(${sch.grade})` : '',
            sch.days?.length ? `- ${sch.days.join('، ')}` : sch.day ? `- ${sch.day}` : ''
          ].filter(Boolean).join(' ');
          if (label && !seenCurrent.has(label)) {
            seenCurrent.add(label);
            currentCourses.push(label);
          }
        }
      }

      // 3. Academic Weekly Programs (برنامه‌های هفتگی تقویم آموزشی)
      for (const wp of weeklyPrograms) {
        if (matchTeacherWithRecordName(wp.locationOrTeacher, teacher)) {
          const yr = extractShamsiYear(wp.startDate);
          const label = `${wp.title}${wp.grade ? ` (${wp.grade})` : ''}${yr ? ` [برنامه ${yr}]` : ''}`;
          if (!seenCurrent.has(label)) {
            seenCurrent.add(label);
            currentCourses.push(label);
          }
        }
      }

      // 4. Substitute teaching logs from attendance
      const subMap = new Map<string, { title: string; grade?: string; years: Set<string>; count: number }>();
      for (const log of attendanceLogs) {
        if (log.isCancelled || !log.hasSubstituteTeacher) continue;
        const isMatch = log.substituteTeacherId === teacher.id || matchTeacherWithRecordName(log.substituteTeacherName, teacher);
        if (!isMatch) continue;
        const key = `${log.programTitle || ''}__${log.grade || ''}`;
        if (!subMap.has(key)) {
          subMap.set(key, { title: log.programTitle || 'کلاس', grade: log.grade, years: new Set(), count: 0 });
        }
        const entry = subMap.get(key)!;
        entry.count += 1;
        const yr = extractShamsiYear(log.date);
        if (yr) entry.years.add(yr);
      }
      for (const sub of subMap.values()) {
        const yrs = Array.from(sub.years).sort();
        const label = `تدریس جایگزین: ${sub.title}${sub.grade ? ` (${sub.grade})` : ''} — ${sub.count} جلسه${yrs.length > 0 ? ` [${yrs.join('، ')}]` : ''}`;
        if (!seenPast.has(label)) {
          seenPast.add(label);
          pastCourses.push(label);
        }
      }

      const summaryParts: string[] = [];
      if (currentCourses.length > 0) {
        summaryParts.push(`برنامه‌های جاری: ${currentCourses.join(' | ')}`);
      }
      if (pastCourses.length > 0) {
        summaryParts.push(`سوابق و دروس منتقل‌شده: ${pastCourses.join(' | ')}`);
      }

      map[teacher.id] = {
        currentCourses,
        pastCourses,
        summaryText: summaryParts.join(' — '),
        totalCount: currentCourses.length + pastCourses.length,
      };
    }

    return map;
  }, [teachers, programs, teacherSchedules, courseProgressRecords, attendanceLogs, weeklyPrograms]);

  const generateUniqueTeacherCode = (): string => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `T-${randomNum}`;
  };

  const openAddModal = () => {
    setEditingTeacher(null);
    setFirstName('');
    setLastName('');
    setFatherName('');
    setNationalId('');
    setBirthCertificateNumber('');
    setTeacherCode(generateUniqueTeacherCode());
    setCenterTeacherCode('');
    setServicesCenterCode('');
    setManagementCenterFileNumber('');
    setPhoneNumber('');
    setHomePhone('');
    setHomeAddress('');
    setPhotoUrl('');
    setPriority(1);
    setIsActive(true);
    setSelectedCategories(['اصول']);
    setNotes('');
    setExperienceHistory('');
    setBankName('بانک ملی');
    setBankAccount('');
    setBankSheba('');
    setTejaratBankAccount('');
    setSibaBankAccount('');
    setBankAccountsList([
      { id: `acc_${Date.now()}`, bankName: 'بانک ملی', accountNumber: '', cardNumber: '', shebaNumber: '', note: 'حساب اصلی' }
    ]);
    setUsulSpecialties([]);
    setFiqhSpecialties([]);
    setFalsafaSpecialties([]);
    setThursdayNote('');
    setShowModal(true);
  };

  const openEditModal = (t: Teacher) => {
    setEditingTeacher(t);
    const { firstName: parsedFirst, lastName: parsedLast } = splitFullNameParts(
      t.fullName,
      t.firstName,
      t.lastName
    );
    setFirstName(parsedFirst);
    setLastName(parsedLast);
    setFatherName(t.fatherName || '');
    setNationalId(t.nationalId || '');
    setBirthCertificateNumber(t.birthCertificateNumber || '');
    setTeacherCode(t.teacherCode || generateUniqueTeacherCode());
    setCenterTeacherCode(t.centerTeacherCode || '');
    setServicesCenterCode(t.servicesCenterCode || '');
    setManagementCenterFileNumber(t.managementCenterFileNumber || '');
    setPhoneNumber(t.phoneNumber || '');
    setHomePhone(t.homePhone || '');
    setHomeAddress(t.homeAddress || '');
    setPhotoUrl(t.photoUrl || '');
    setPriority((Number(t.priority) || 1) as 1 | 2 | 3);
    setIsActive(t.isActive !== false);
    setSelectedCategories(t.categories || []);
    setNotes(t.notes || '');
    setExperienceHistory(t.experienceHistory || '');
    setBankName(t.bankName || '');
    setBankAccount(t.bankAccount || '');
    setBankSheba(t.bankSheba || t.bankAccounts?.[0]?.shebaNumber || '');
    setTejaratBankAccount(t.tejaratBankAccount || '');
    setSibaBankAccount(t.sibaBankAccount || '');
    
    // Multiple bank accounts fallback
    if (t.bankAccounts && t.bankAccounts.length > 0) {
      setBankAccountsList(t.bankAccounts);
    } else {
      setBankAccountsList([
        {
          id: `acc_1`,
          bankName: t.bankName || 'بانک ملی',
          accountNumber: t.bankAccount || '',
          cardNumber: '',
          shebaNumber: t.bankSheba || '',
          note: 'حساب اصلی'
        }
      ]);
    }

    setUsulSpecialties(t.detailedSpecialties?.usul || []);
    setFiqhSpecialties(t.detailedSpecialties?.fiqh || []);
    setFalsafaSpecialties(t.detailedSpecialties?.falsafa || []);
    setThursdayNote(t.detailedSpecialties?.thursdayNote || '');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const combinedFullName = [cleanFirst, cleanLast].filter(Boolean).join(' ').trim();

    if (!cleanFirst && !cleanLast) {
      dispatchDatabaseToast('لطفاً نام و نام خانوادگی استاد را وارد نمایید.', 'warning');
      return;
    }

    setIsSaving(true);

    const finalTeacherCode = teacherCode.trim() || generateUniqueTeacherCode();
    const primaryAcc = bankAccountsList[0];
    const resolvedSheba = bankSheba.trim() || primaryAcc?.shebaNumber?.trim() || '';
    const resolvedBankAccount =
      primaryAcc?.accountNumber?.trim() ||
      tejaratBankAccount.trim() ||
      sibaBankAccount.trim() ||
      bankAccount.trim() ||
      '';
    const resolvedBankName =
      primaryAcc?.bankName?.trim() ||
      bankName.trim() ||
      (tejaratBankAccount.trim() ? 'بانک تجارت' : sibaBankAccount.trim() ? 'بانک ملی (سیبا)' : '');

    // Keep primary bankAccountsList[0].shebaNumber synced if bankSheba is entered
    const normalizedAccountsList = bankAccountsList.map((acc, index) =>
      index === 0 && resolvedSheba && !acc.shebaNumber?.trim()
        ? { ...acc, shebaNumber: resolvedSheba }
        : acc
    );

    const nowIso = new Date().toISOString();
    const nextVersion = (editingTeacher?.version || 0) + 1;

    const teacherData: Partial<Teacher> = {
      firstName: cleanFirst,
      lastName: cleanLast,
      fullName: combinedFullName,
      fatherName: fatherName.trim(),
      nationalId: nationalId.trim(),
      birthCertificateNumber: birthCertificateNumber.trim(),
      teacherCode: finalTeacherCode,
      centerTeacherCode: centerTeacherCode.trim(),
      servicesCenterCode: servicesCenterCode.trim(),
      managementCenterFileNumber: managementCenterFileNumber.trim(),
      phoneNumber: phoneNumber.trim(),
      homePhone: homePhone.trim(),
      homeAddress: homeAddress.trim(),
      photoUrl,
      priority,
      isActive,
      categories: selectedCategories,
      notes: notes.trim(),
      experienceHistory: experienceHistory.trim(),
      bankName: resolvedBankName,
      bankAccount: resolvedBankAccount,
      bankSheba: resolvedSheba,
      tejaratBankAccount: tejaratBankAccount.trim(),
      sibaBankAccount: sibaBankAccount.trim(),
      bankAccounts: normalizedAccountsList,
      detailedSpecialties: {
        usul: (selectedCategories.includes('اصول') || selectedCategories.includes('مشاوره اصول')) ? usulSpecialties : [],
        fiqh: (selectedCategories.includes('فقه') || selectedCategories.includes('مشاوره فقه')) ? fiqhSpecialties : [],
        falsafa: (selectedCategories.includes('فلسفه') || selectedCategories.includes('مشاوره فلسفه')) ? falsafaSpecialties : [],
        thursdayNote: selectedCategories.includes('دروس پنجشنبه') ? thursdayNote.trim() : ''
      },
      updatedAt: nowIso,
      updated_at: nowIso,
      version: nextVersion,
      isExternal: false
    };

    const targetId = editingTeacher ? editingTeacher.id : `t_${Date.now()}`;
    const fullTeacherObject: Teacher = {
      id: targetId,
      firstName: cleanFirst,
      lastName: cleanLast,
      fullName: combinedFullName,
      fatherName: teacherData.fatherName || '',
      nationalId: teacherData.nationalId || '',
      birthCertificateNumber: teacherData.birthCertificateNumber || '',
      teacherCode: teacherData.teacherCode || '',
      centerTeacherCode: teacherData.centerTeacherCode || '',
      servicesCenterCode: teacherData.servicesCenterCode || '',
      managementCenterFileNumber: teacherData.managementCenterFileNumber || '',
      phoneNumber: teacherData.phoneNumber || '',
      homePhone: teacherData.homePhone || '',
      homeAddress: teacherData.homeAddress || '',
      photoUrl: teacherData.photoUrl || '',
      priority: teacherData.priority || 1,
      isActive: teacherData.isActive !== false,
      categories: teacherData.categories || [],
      notes: teacherData.notes || '',
      experienceHistory: teacherData.experienceHistory || '',
      bankName: teacherData.bankName || '',
      bankAccount: teacherData.bankAccount || '',
      bankSheba: teacherData.bankSheba || '',
      tejaratBankAccount: teacherData.tejaratBankAccount || '',
      sibaBankAccount: teacherData.sibaBankAccount || '',
      bankAccounts: teacherData.bankAccounts || [],
      detailedSpecialties: teacherData.detailedSpecialties,
      createdAt: editingTeacher?.createdAt || nowIso,
      updatedAt: nowIso,
      updated_at: nowIso,
      version: nextVersion,
      isExternal: false
    };

    // Optimistic local UI update so user sees change instantly
    setTeachers(prev => {
      if (editingTeacher) {
        return prev.map(t => t.id === editingTeacher.id ? { ...t, ...fullTeacherObject } : t);
      } else {
        return [fullTeacherObject, ...prev];
      }
    });

    setShowModal(false);
    dispatchDatabaseToast(
      editingTeacher ? 'اطلاعات استاد با موفقیت بروزرسانی گردید.' : 'استاد جدید با موفقیت در بانک اساتید ذخیره شد.',
      'success'
    );

    try {
      if (editingTeacher) {
        await localDb.updateDoc('teachers', editingTeacher.id, teacherData);
      } else {
        await localDb.addDoc('teachers', {
          ...teacherData,
          id: targetId,
          createdAt: nowIso
        });
      }
      await fetchTeachers();
    } catch (err) {
      console.error('[TEACHERS_BANK_SAVE_FAIL]', targetId, err);
      dispatchDatabaseToast('خطا در ذخیره‌سازی اطلاعات در سرور. در حال بازهمگام‌سازی...', 'error');
      await fetchTeachers();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingIds.has(id)) return;

    const teacher = teachers.find(t => t.id === id);
    const teacherName = teacher?.fullName || 'این استاد';

    if (!window.confirm(`آیا از حذف «${teacherName}» از بانک اساتید اطمینان دارید؟`)) {
      return;
    }

    setDeletingIds(prev => new Set(prev).add(id));
    const originalTeachers = [...teachers];

    // Optimistic UI Update: remove from list immediately
    setTeachers(prev => prev.filter(t => t.id !== id));
    dispatchDatabaseToast(`در حال حذف «${teacherName}»...`, 'info', 2000);

    try {
      await localDb.deleteDoc('teachers', id);
      dispatchDatabaseToast(`«${teacherName}» با موفقیت از بانک اساتید پاک شد.`, 'success');
      fetchTeachers();
    } catch (err) {
      console.error('[TEACHERS_BANK_DELETE_FAIL]', id, err);
      setTeachers(originalTeachers);
      dispatchDatabaseToast(`خطا در حذف «${teacherName}». اطلاعات بازگردانده شد.`, 'error');
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleToggleStatus = async (t: Teacher) => {
    try {
      const nowIso = new Date().toISOString();
      await localDb.updateDoc('teachers', t.id, {
        isActive: !t.isActive,
        updatedAt: nowIso,
        updated_at: nowIso,
        version: (t.version || 0) + 1
      });
      fetchTeachers();
    } catch (err) {
      console.error('[TEACHERS_BANK_STATUS_FAIL]', t.id, err);
      dispatchDatabaseToast('خطا در تغییر وضعیت استاد.', 'error');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('حجم عکس نباید بیشتر از ۲ مگابایت باشد.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleCategory = (cat: TeacherCategory) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter(c => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const copyPhoneNumber = (id: string, num?: string) => {
    if (!num) return;
    navigator.clipboard.writeText(num);
    setCopiedPhoneId(id);
    setTimeout(() => setCopiedPhoneId(null), 2000);
  };

  const handleCopySelectedPhones = () => {
    const selectedTeachers = filteredTeachers.filter(t => selectedMultiPhoneIds.includes(t.id));
    const phones = selectedTeachers
      .map(t => t.phoneNumber?.trim())
      .filter((p): p is string => !!p && p.length > 3);

    if (phones.length === 0) {
      alert('هیچ شماره تلفنی برای اساتید انتخاب‌شده یافت نشد.');
      return;
    }

    const textToCopy = phones.join('\n');
    navigator.clipboard.writeText(textToCopy);
    alert(`${phones.length.toLocaleString('fa-IR')} شماره تلفن اساتید با موفقیت کپی شد! می‌توانید همگی را یکجا Paste کنید.`);
  };

  // Filter logic
  const filteredTeachers = teachers.filter(t => {
    if (t.isExternal === true) return false;

    const autoHistory = autoTeachingHistoryMap[t.id];
    const searchLower = searchTerm.toLowerCase().trim();
    const matchesSearch = !searchLower || 
      t.fullName?.toLowerCase().includes(searchLower) ||
      t.firstName?.toLowerCase().includes(searchLower) ||
      t.lastName?.toLowerCase().includes(searchLower) ||
      t.fatherName?.toLowerCase().includes(searchLower) ||
      t.phoneNumber?.includes(searchLower) ||
      t.homePhone?.includes(searchLower) ||
      t.homeAddress?.toLowerCase().includes(searchLower) ||
      t.nationalId?.includes(searchLower) ||
      t.birthCertificateNumber?.includes(searchLower) ||
      t.teacherCode?.toLowerCase().includes(searchLower) ||
      t.centerTeacherCode?.toLowerCase().includes(searchLower) ||
      t.servicesCenterCode?.toLowerCase().includes(searchLower) ||
      t.managementCenterFileNumber?.toLowerCase().includes(searchLower) ||
      t.notes?.toLowerCase().includes(searchLower) ||
      t.experienceHistory?.toLowerCase().includes(searchLower) ||
      autoHistory?.summaryText?.toLowerCase().includes(searchLower) ||
      t.categories?.some(c => c.toLowerCase().includes(searchLower)) ||
      t.detailedSpecialties?.usul?.some(u => u.includes(searchLower)) ||
      t.detailedSpecialties?.falsafa?.some(f => f.includes(searchLower)) ||
      t.detailedSpecialties?.thursdayNote?.toLowerCase().includes(searchLower);

    const matchesCategory = selectedCategoryFilter === 'all' || t.categories?.includes(selectedCategoryFilter as TeacherCategory);
    const matchesPriority = selectedPriorityFilter === 'all' || String(t.priority) === selectedPriorityFilter;
    const matchesStatus = selectedStatusFilter === 'all' || (selectedStatusFilter === 'active' ? t.isActive : !t.isActive);
    
    const matchesPhone = selectedPhoneFilter === 'all' || 
      (selectedPhoneFilter === 'has-phone' ? Boolean(t.phoneNumber && t.phoneNumber.trim()) : !t.phoneNumber || !t.phoneNumber.trim());

    return matchesSearch && matchesCategory && matchesPriority && matchesStatus && matchesPhone;
  });

  // 4-Step Smart Excel Import trigger (Exact parity with StudentList)
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelImportFile(file);
    setShowExcelImportModal(true);
    e.target.value = '';
  };

  // Export to Excel
  const handleExportExcel = async () => {
    if (filteredTeachers.length === 0) {
      dispatchDatabaseToast('هیچ استادی جهت خروجی در فیلتر فعلی وجود ندارد.', 'warning');
      return;
    }

    const XLSX = await import('xlsx');

    const exportData = filteredTeachers.map((t, idx) => {
      const { firstName: fn, lastName: ln } = splitFullNameParts(t.fullName, t.firstName, t.lastName);
      const specList: string[] = [];
      if (t.detailedSpecialties?.usul?.length) specList.push(`اصول: ${t.detailedSpecialties.usul.join('، ')}`);
      if (t.detailedSpecialties?.fiqh?.length) specList.push(`فقه: ${t.detailedSpecialties.fiqh.join('، ')}`);
      if (t.detailedSpecialties?.falsafa?.length) specList.push(`فلسفه: ${t.detailedSpecialties.falsafa.join('، ')}`);
      if (t.detailedSpecialties?.thursdayNote) specList.push(`پنج‌شنبه: ${t.detailedSpecialties.thursdayNote}`);

      const autoSummary = autoTeachingHistoryMap[t.id]?.summaryText || '';
      const combinedExperience = [t.experienceHistory, autoSummary ? `[خودکار] ${autoSummary}` : '']
        .filter(Boolean)
        .join(' | ');

      const row: Record<string, any> = {
        'ردیف': idx + 1,
        'نام': fn || '-',
        'نام خانوادگی': ln || '-',
        'نام و نام خانوادگی': t.fullName,
        'نام پدر': t.fatherName || '-',
        'کد ملی': t.nationalId || '-',
        'ش.شناسنامه': t.birthCertificateNumber || '-',
        'کد استادی داخلی': t.teacherCode || '-',
        'کد استاد مرکز': t.centerTeacherCode || '-',
        'کد مرکز خدمات': t.servicesCenterCode || '-',
        'شماره پرونده مرکز مدیریت': t.managementCenterFileNumber || '-',
      };

      if (includePhoneInExport) {
        row['شماره تماس'] = t.phoneNumber || 'ثبت نشده';
        row['شماره منزل'] = t.homePhone || '-';
        row['آدرس منزل'] = t.homeAddress || '-';
      }

      row['شماره شبا'] = t.bankSheba || t.bankAccounts?.[0]?.shebaNumber || '-';
      row['حساب تجارت'] = t.tejaratBankAccount || '-';
      row['حساب سیبا'] = t.sibaBankAccount || '-';
      row['تخصص‌های کلی'] = t.categories?.join(' | ') || '-';
      row['تخصص‌های جزئی'] = specList.join(' / ') || '-';
      row['سوابق تدریس در مجموعه'] = combinedExperience || '-';
      row['توضیحات'] = t.notes || '-';
      row['اولویت'] = `اولویت ${t.priority}`;
      row['وضعیت'] = t.isActive ? 'فعال' : 'غیرفعال';

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'بانک اساتید');
    XLSX.writeFile(workbook, `بانک_اساتید_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // Export to PDF
  const handleExportPdf = async () => {
    if (filteredTeachers.length === 0) {
      alert('هیچ استادی جهت خروجی در فیلتر فعلی وجود ندارد.');
      return;
    }
    if (!pdfPrintRef.current) return;

    try {
      setIsExportingPdf(true);
      await exportElementToPdf({
        element: pdfPrintRef.current,
        filename: `بانک_اساتید_${new Date().toISOString().slice(0,10)}.pdf`,
        orientation: 'landscape'
      });
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('خطا در صدور فایل PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Export to JSON
  const handleExportJson = () => {
    if (filteredTeachers.length === 0) {
      alert('هیچ استادی جهت خروجی در فیلتر فعلی وجود ندارد.');
      return;
    }

    const exportData = filteredTeachers.map((t) => {
      const copy = { ...t };
      if (!includePhoneInExport) {
        delete copy.phoneNumber;
      }
      return copy;
    });

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `بانک_اساتید_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import from Excel or JSON
  const handleProcessImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportMessage(null);

    const fileName = file.name.toLowerCase();

    try {
      let importedItems: any[] = [];

      if (fileName.endsWith('.json')) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          importedItems = parsed;
        } else if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.teachers)) {
            importedItems = parsed.teachers;
          } else if (Array.isArray(parsed.data)) {
            importedItems = parsed.data;
          } else {
            throw new Error('فرمت JSON ساختار معتبری شامل لیست اساتید ندارد.');
          }
        }
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        const XLSX = await import('xlsx');
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

        importedItems = rows.map((row) => {
          const getVal = (...keys: string[]) => {
            for (const k of keys) {
              if (row[k] !== undefined && row[k] !== null && row[k] !== '') {
                return String(row[k]).trim();
              }
            }
            return '';
          };

          const fullName = getVal('نام و نام خانوادگی', 'نام خانوادگی', 'نام', 'fullName', 'Name', 'FullName');
          const phoneNumber = getVal('شماره تماس', 'تلفن', 'شماره همراه', 'موبایل', 'phoneNumber', 'Phone', 'Mobile');
          const catStr = getVal('تخصص‌های کلی', 'تخصص', 'دسته', 'دسته‌بندی', 'categories', 'Category');
          const specStr = getVal('تخصص‌های جزئی', 'کتاب‌ها', 'detailedSpecialties', 'Specialties');
          const experienceHistory = getVal('سوابق تدریس در مجموعه', 'سوابق تدریس', 'سوابق', 'experienceHistory');
          const notes = getVal('توضیحات', 'ملاحظات', 'notes', 'Notes');
          const priorityStr = getVal('اولویت', 'priority', 'Priority');
          const statusStr = getVal('وضعیت', 'isActive', 'Status', 'Active');

          let categories: TeacherCategory[] = [];
          if (catStr) {
            const parts = catStr.split(/[|،,/]/).map(s => s.trim());
            for (const p of parts) {
              if (ALL_CATEGORIES.includes(p as TeacherCategory)) {
                categories.push(p as TeacherCategory);
              }
            }
          }

          let priorityNum: 1 | 2 | 3 = 1;
          if (priorityStr.includes('2') || priorityStr.includes('۲') || priorityStr.includes('خوب')) priorityNum = 2;
          if (priorityStr.includes('3') || priorityStr.includes('۳')) priorityNum = 3;

          const isActiveVal = !statusStr || statusStr === 'فعال' || statusStr.toLowerCase() === 'true' || statusStr === '1';

          return {
            fullName,
            phoneNumber,
            categories: categories.length > 0 ? categories : ['اصول'],
            notes,
            experienceHistory,
            priority: priorityNum,
            isActive: isActiveVal,
            detailedSpecialties: {
              usul: specStr.includes('رسائل') ? ['رسائل'] : specStr.includes('کفایه') ? ['کفایه'] : specStr.includes('حلقات') ? ['حلقات'] : [],
              fiqh: specStr.includes('مکاسب') ? ['مکاسب'] : [],
              falsafa: specStr.includes('بدایه') ? ['بدایه'] : specStr.includes('نهایه') ? ['نهایه'] : [],
              thursdayNote: specStr.includes('پنج‌شنبه') ? specStr : ''
            }
          };
        });
      } else {
        throw new Error('فرمت فایل انتخاب شده پشتیبانی نمی‌شود. تنها فایل‌های JSON, XLSX, XLS, CSV مجاز هستند.');
      }

      const validTeachers = importedItems.filter((item) => item && typeof item === 'object' && item.fullName && String(item.fullName).trim());

      if (validTeachers.length === 0) {
        throw new Error('هیچ استادی با نام معتبر در فایل یافت نشد.');
      }

      let count = 0;
      for (const t of validTeachers) {
        const categories = Array.isArray(t.categories) && t.categories.length > 0 
          ? t.categories.filter((c: any) => ALL_CATEGORIES.includes(c))
          : ['اصول'];

        const teacherRecord: Partial<Teacher> = {
          fullName: String(t.fullName).trim(),
          phoneNumber: t.phoneNumber ? String(t.phoneNumber).trim() : '',
          photoUrl: t.photoUrl || '',
          priority: (Number(t.priority) === 2 ? 2 : Number(t.priority) === 3 ? 3 : 1) as 1 | 2 | 3,
          isActive: t.isActive !== false,
          categories: categories.length > 0 ? categories : ['اصول'],
          notes: t.notes ? String(t.notes).trim() : '',
          experienceHistory: t.experienceHistory ? String(t.experienceHistory).trim() : '',
          detailedSpecialties: t.detailedSpecialties || { usul: [], fiqh: [], falsafa: [], thursdayNote: '' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await localDb.addDoc('teachers', teacherRecord);
        count++;
      }

      setImportMessage({
        type: 'success',
        text: `تعداد ${count} استاد با موفقیت به بانک اساتید اضافه شد.`
      });
      fetchTeachers();
    } catch (err: any) {
      console.error('Import error:', err);
      setImportMessage({
        type: 'error',
        text: err?.message || 'خطا در بارگذاری و ورود اطلاعات از فایل.'
      });
    } finally {
      setImportLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  const getPriorityBadge = (p: 1 | 2 | 3 | string) => {
    const num = Number(p);
    if (num === 1) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Star size={11} className="fill-emerald-600 text-emerald-600" />
          اولویت ۱ (عالی)
        </span>
      );
    }
    if (num === 2) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <Star size={11} className="text-blue-600" />
          اولویت ۲ (خوب)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
        اولویت ۳
      </span>
    );
  };

  const getCategoryColor = (cat: TeacherCategory) => {
    switch (cat) {
      case 'فقه':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'اصول':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'فلسفه':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'مشاوره اصول':
        return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'مشاوره فقه':
        return 'bg-orange-50 text-orange-800 border-orange-200';
      case 'مشاوره فلسفه':
        return 'bg-violet-50 text-violet-800 border-violet-200';
      case 'دروس پنجشنبه':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'ویژه':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const hasUsulOrCounseling = selectedCategories.includes('اصول') || selectedCategories.includes('مشاوره اصول');
  const hasFiqhOrCounseling = selectedCategories.includes('فقه') || selectedCategories.includes('مشاوره فقه');
  const hasFalsafaOrCounseling = selectedCategories.includes('فلسفه') || selectedCategories.includes('مشاوره فلسفه');
  const hasThursday = selectedCategories.includes('دروس پنجشنبه');

  const isExternalForm = Boolean(editingTeacher?.isExternal);

  return (
    <div className={cn(isAdminMobile ? "space-y-4 pb-8" : "p-4 sm:p-6 max-w-7xl mx-auto space-y-6")} dir="rtl">
      
      {/* Header Banner */}
      {isAdminMobile ? (
        <MobileSectionHeader
          title="بانک جامع اساتید"
          subtitle={`${filteredTeachers.length} استاد ثبت‌شده`}
          variant="indigo"
          icon={<GraduationCap size={18} />}
          primaryAction={
            canManageTeachers
              ? {
                  id: 'add-teacher',
                  label: 'افزودن استاد جدید',
                  icon: <UserPlus size={15} />,
                  tone: 'emerald',
                  onClick: openAddModal
                }
              : undefined
          }
          secondaryActions={[
            ...(isLevel2User
              ? [{
                  id: 'multi-copy-phones',
                  label: isMultiCopyMode ? 'بستن کپی چندگانه' : 'کپی چندگانه تلفن',
                  icon: <Copy size={14} />,
                  tone: 'amber' as const,
                  onClick: () => setIsMultiCopyMode(prev => !prev)
                }]
              : []),
            {
              id: 'export-excel',
              label: 'خروجی اکسل',
              icon: <FileSpreadsheet size={14} />,
              tone: 'emerald',
              onClick: handleExportExcel
            },
            {
              id: 'export-pdf',
              label: isExportingPdf ? 'در حال دریافت...' : 'خروجی PDF',
              icon: <Download size={14} />,
              tone: 'rose',
              disabled: isExportingPdf,
              onClick: handleExportPdf
            },
            {
              id: 'export-json',
              label: 'خروجی JSON',
              icon: <FileText size={14} />,
              onClick: handleExportJson
            },
            ...(canManageTeachers
              ? [
                  {
                    id: 'import-excel-teachers',
                    label: 'وارد کردن اکسل',
                    icon: <FileSpreadsheet size={14} />,
                    tone: 'emerald' as const,
                    fileInputProps: {
                      accept: '.xlsx, .xls, .csv',
                      onChange: handleExcelImport
                    }
                  },
                  {
                    id: 'import-json-teachers',
                    label: 'افزودن از فایل JSON',
                    icon: <Upload size={14} />,
                    onClick: () => {
                      setImportMessage(null);
                      setShowImportModal(true);
                    }
                  }
                ]
              : [])
          ]}
        />
      ) : (
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute -left-10 -bottom-10 opacity-10 pointer-events-none">
            <GraduationCap size={240} />
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-bold backdrop-blur-md">
                <Award size={14} className="text-amber-400" />
                <span>بانک جامع اساتید و مدرسین مدعو</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">بانک اساتید</h1>
              <p className="text-xs sm:text-sm text-indigo-100 opacity-90 max-w-2xl leading-relaxed">
                بانک اطلاعات کامل اساتید حوزه علمیه به تفکیک دروس فقه، اصول، فلسفه، مشاوره‌های آموزشی و دروس ۵شنبه جهت دعوت و همکاری
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto shrink-0">
              {isLevel2User && (
                <button
                  type="button"
                  onClick={() => setIsMultiCopyMode(prev => !prev)}
                  className={cn(
                    "flex-1 sm:flex-initial flex items-center justify-center gap-1.5 font-bold px-3 py-2 rounded-2xl text-xs transition-all shadow-md active:scale-95 cursor-pointer border",
                    isMultiCopyMode
                      ? "bg-amber-400 text-slate-950 border-amber-300 font-black"
                      : "bg-amber-500 hover:bg-amber-400 text-white border-amber-600"
                  )}
                  title="انتخاب و کپی چندگانه شماره تلفن اساتید"
                >
                  <Copy size={15} />
                  <span>{isMultiCopyMode ? 'بستن کپی چندگانه' : 'کپی چندگانه تلفن'}</span>
                </button>
              )}

              <button
                onClick={handleExportExcel}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-2 rounded-2xl text-xs transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <FileSpreadsheet size={15} />
                <span>خروجی اکسل</span>
              </button>

              <button
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold px-3 py-2 rounded-2xl text-xs transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Download size={15} />
                <span>{isExportingPdf ? 'در حال دریافت...' : 'خروجی PDF'}</span>
              </button>

              <button
                onClick={handleExportJson}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-2 rounded-2xl text-xs transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <FileText size={15} />
                <span>خروجی JSON</span>
              </button>

              {canManageTeachers && (
                <>
                  <label className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold px-3 py-2 rounded-2xl text-xs transition-all shadow-md active:scale-95 cursor-pointer">
                    <FileSpreadsheet size={15} />
                    <span>وارد کردن اکسل</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleExcelImport}
                    />
                  </label>

                  <button
                    onClick={() => {
                      setImportMessage(null);
                      setShowImportModal(true);
                    }}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-slate-700/80 hover:bg-slate-600 text-white font-bold px-3 py-2 rounded-2xl text-xs transition-all shadow-md active:scale-95 cursor-pointer"
                    title="بازیابی از فایل JSON"
                  >
                    <Upload size={15} />
                    <span>ورود JSON</span>
                  </button>

                  <button
                    onClick={openAddModal}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white font-black px-4 py-2 rounded-2xl text-xs transition-all shadow-lg hover:shadow-indigo-500/25 active:scale-95 cursor-pointer"
                  >
                    <UserPlus size={16} />
                    <span>افزودن استاد جدید</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Multi-copy Phone Banner */}
      {isLevel2User && isMultiCopyMode && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black text-amber-900">
              کپی چندگانه شماره تلفن اساتید: ({selectedMultiPhoneIds.length} از {filteredTeachers.length} استاد)
            </span>
            <button
              type="button"
              onClick={() => {
                if (selectedMultiPhoneIds.length === filteredTeachers.length) {
                  setSelectedMultiPhoneIds([]);
                } else {
                  setSelectedMultiPhoneIds(filteredTeachers.map(t => t.id));
                }
              }}
              className="text-xs text-amber-800 underline font-bold cursor-pointer hover:text-amber-950"
            >
              {selectedMultiPhoneIds.length === filteredTeachers.length ? 'لغو انتخاب همه' : 'انتخاب همه اساتید'}
            </button>
          </div>
          <button
            type="button"
            onClick={handleCopySelectedPhones}
            disabled={selectedMultiPhoneIds.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Copy size={15} />
            <span>کپی یکجای شماره‌ها ({selectedMultiPhoneIds.length})</span>
          </button>
        </div>
      )}

      {/* Filters and Controls Bar */}
      {isAdminMobile ? (
        <div className="space-y-2.5">
          <MobileSearchFilterBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="جستجو نام، شماره، درس..."
            onToggleFilters={() => setMobileFiltersOpen((p) => !p)}
            filtersOpen={mobileFiltersOpen}
            activeFilterCount={[
              selectedCategoryFilter !== 'all',
              selectedPriorityFilter !== 'all',
              selectedPhoneFilter !== 'all',
              selectedStatusFilter !== 'all'
            ].filter(Boolean).length}
          />

          {mobileFiltersOpen && (
            <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="min-h-[40px] px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                >
                  <option value="all">همه تخصص‌ها</option>
                  {ALL_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                <select
                  value={selectedPriorityFilter}
                  onChange={(e) => setSelectedPriorityFilter(e.target.value)}
                  className="min-h-[40px] px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                >
                  <option value="all">همه اولویت‌ها</option>
                  <option value="1">اولویت ۱ (عالی)</option>
                  <option value="2">اولویت ۲ (خوب)</option>
                  <option value="3">اولویت ۳ (معمولی)</option>
                </select>

                <select
                  value={selectedPhoneFilter}
                  onChange={(e) => setSelectedPhoneFilter(e.target.value)}
                  className="min-h-[40px] px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                >
                  <option value="all">همه شماره‌ها</option>
                  <option value="has-phone">دارای شماره تماس</option>
                  <option value="no-phone">بدون شماره تماس</option>
                </select>

                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="min-h-[40px] px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                >
                  <option value="all">همه وضعیت‌ها</option>
                  <option value="active">فقط فعال</option>
                  <option value="inactive">فقط غیرفعال</option>
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none bg-indigo-50 text-indigo-900 border border-indigo-200/80 px-3 py-2 rounded-xl text-[11px] font-bold">
                <input
                  type="checkbox"
                  checked={includePhoneInExport}
                  onChange={(e) => setIncludePhoneInExport(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                />
                <span>درج شماره تماس در خروجی (اکسل / PDF)</span>
              </label>
            </div>
          )}

          <div className="text-[11px] font-bold text-slate-500 px-1">
            تعداد اساتید یافت‌شده: <span className="text-indigo-700">{filteredTeachers.length}</span> نفر
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-4">
          
          {/* Filter Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            
            {/* Search Input */}
            <div className="relative col-span-1 sm:col-span-2 lg:col-span-1">
              <Search className="absolute right-3.5 top-3 text-slate-400" size={16} />
              <input 
                type="text"
                placeholder="جستجو نام، شماره، درس..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
              />
            </div>

            {/* Category Filter */}
            <div className="relative">
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">همه تخصص‌ها و دسته‌ها</option>
                {ALL_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div className="relative">
              <select
                value={selectedPriorityFilter}
                onChange={(e) => setSelectedPriorityFilter(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">همه اولویت‌ها</option>
                <option value="1">اولویت ۱ (عالی)</option>
                <option value="2">اولویت ۲ (خوب)</option>
                <option value="3">اولویت ۳ (معمولی)</option>
              </select>
            </div>

            {/* Phone Presence Filter */}
            <div className="relative">
              <select
                value={selectedPhoneFilter}
                onChange={(e) => setSelectedPhoneFilter(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">فیلتر شماره: همه اساتید</option>
                <option value="has-phone">فقط اساتید دارای شماره تماس</option>
                <option value="no-phone">فقط اساتید بدون شماره تماس</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">همه وضعیت‌ها</option>
                <option value="active">فقط اساتید فعال</option>
                <option value="inactive">فقط غیرفعال‌ها</option>
              </select>
            </div>

          </div>

          {/* Export Option Checkbox & Summary bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs font-medium">
            
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-slate-600">
                تعداد اساتید یافت‌شده: <span className="font-bold text-indigo-700">{filteredTeachers.length}</span> نفر
              </span>

              {/* Export Toggle: Include Phone Number */}
              <label className="inline-flex items-center gap-2 cursor-pointer select-none bg-indigo-50 text-indigo-900 border border-indigo-200/80 px-3 py-1.5 rounded-xl hover:bg-indigo-100/80 transition-all">
                <input 
                  type="checkbox"
                  checked={includePhoneInExport}
                  onChange={(e) => setIncludePhoneInExport(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                />
                <span className="text-[11px] font-bold">درج شماره تماس اساتید در فایل خروجی (اکسل / PDF)</span>
              </label>
            </div>

            {/* Layout View Mode Buttons */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                  viewMode === 'list' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                )}
              >
                <List size={15} />
                <span>نمایش لیستی (پیش‌فرض)</span>
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={cn(
                  "p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                  viewMode === 'cards' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                )}
              >
                <Grid size={15} />
                <span>نمایش کارتی</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Main Content: Table or Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 font-medium text-xs">
          در حال دریافت اطلاعات بانک اساتید...
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
            <GraduationCap size={32} />
          </div>
          <h3 className="text-base font-bold text-slate-800">هیچ استادی یافت نشد</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            می‌توانید فیلترها را تغییر داده یا روی دکمه «افزودن استاد جدید» کلیک کنید.
          </p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white font-bold px-4 py-2 rounded-xl text-xs"
          >
            <UserPlus size={16} />
            <span>ثبت اولین استاد</span>
          </button>
        </div>
      ) : !isAdminMobile && viewMode === 'list' ? (
        /* LIST / TABLE VIEW (DEFAULT) */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  {isLevel2User && isMultiCopyMode && (
                    <th className="py-3.5 px-4 text-center bg-amber-50 text-amber-900">
                      <input
                        type="checkbox"
                        checked={selectedMultiPhoneIds.length > 0 && selectedMultiPhoneIds.length === filteredTeachers.length}
                        onChange={() => {
                          if (selectedMultiPhoneIds.length === filteredTeachers.length) {
                            setSelectedMultiPhoneIds([]);
                          } else {
                            setSelectedMultiPhoneIds(filteredTeachers.map(t => t.id));
                          }
                        }}
                        className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="py-3.5 px-4">#</th>
                  <th className="py-3.5 px-4">استاد</th>
                  <th className="py-3.5 px-4">شماره تماس</th>
                  <th className="py-3.5 px-4">تخصص‌های کلی</th>
                  <th className="py-3.5 px-4">تخصص‌های جزئی (کتاب/موضوع)</th>
                  <th className="py-3.5 px-4 min-w-[180px]">سوابق تدریس در مجموعه</th>
                  <th className="py-3.5 px-4 min-w-[150px]">توضیحات</th>
                  <th className="py-3.5 px-4">اولویت</th>
                  <th className="py-3.5 px-4">وضعیت</th>
                  <th className="py-3.5 px-4 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTeachers.map((teacher, idx) => {
                  const spec = teacher.detailedSpecialties;

                  return (
                    <tr 
                      key={teacher.id} 
                      className={cn(
                        "hover:bg-slate-50/80 transition-colors",
                        !teacher.isActive && "bg-slate-50/50 opacity-70",
                        isMultiCopyMode && selectedMultiPhoneIds.includes(teacher.id) && "bg-amber-50/60"
                      )}
                    >
                      {isLevel2User && isMultiCopyMode && (
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedMultiPhoneIds.includes(teacher.id)}
                            onChange={() => {
                              setSelectedMultiPhoneIds(prev =>
                                prev.includes(teacher.id)
                                  ? prev.filter(i => i !== teacher.id)
                                  : [...prev, teacher.id]
                              );
                            }}
                            className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="py-3 px-4 font-bold text-slate-400">{idx + 1}</td>
                      
                      {/* Name & Photo */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {teacher.photoUrl ? (
                            <img 
                              src={teacher.photoUrl} 
                              alt={teacher.fullName} 
                              className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0" 
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-sm shrink-0 border border-indigo-200">
                              {teacher.fullName?.charAt(0) || 'ا'}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                              {teacher.isExternal && <Building2 size={13} className="text-amber-500 shrink-0" />}
                              <span>{teacher.fullName}</span>
                              {teacher.fatherName && (
                                <span className="text-[11px] font-medium text-slate-500">({teacher.fatherName})</span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] text-slate-500 font-mono">
                              {teacher.teacherCode && (
                                <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                                  کد: {teacher.teacherCode}
                                </span>
                              )}
                              {teacher.centerTeacherCode && (
                                <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold">
                                  کد مرکز: {teacher.centerTeacherCode}
                                </span>
                              )}
                              {teacher.nationalId && (
                                <span className="text-slate-500">
                                  کد ملی: {teacher.nationalId}
                                </span>
                              )}
                              {!teacher.isActive && (
                                <span className="text-rose-500 font-bold">غیرفعال</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone Number */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">
                        {teacher.phoneNumber ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => copyPhoneNumber(teacher.id, teacher.phoneNumber)}
                                className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                                title="کپی شماره"
                              >
                                {copiedPhoneId === teacher.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                              </button>
                              <span>{teacher.phoneNumber}</span>
                            </div>
                            {teacher.homePhone && (
                              <div className="text-[10px] text-slate-400 pr-6">منزل: {teacher.homePhone}</div>
                            )}
                          </div>
                        ) : teacher.homePhone ? (
                          <span className="text-xs text-slate-500">منزل: {teacher.homePhone}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Categories (Main Specialties) */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {teacher.categories?.map(cat => (
                            <span 
                              key={cat} 
                              className={cn(
                                "px-2 py-0.5 rounded-md text-[10px] font-bold border",
                                getCategoryColor(cat)
                              )}
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Detailed Specialties */}
                      <td className="py-3 px-4">
                        <div className="space-y-1 text-[11px]">
                          {spec?.usul && spec.usul.length > 0 && (
                            <div className="text-indigo-900 font-medium">
                              <span className="font-bold text-indigo-700">اصول: </span>
                              {spec.usul.join('، ')}
                            </div>
                          )}
                          {spec?.fiqh && spec.fiqh.length > 0 && (
                            <div className="text-amber-900 font-medium">
                              <span className="font-bold text-amber-700">فقه: </span>
                              {spec.fiqh.join('، ')}
                            </div>
                          )}
                          {spec?.falsafa && spec.falsafa.length > 0 && (
                            <div className="text-purple-900 font-medium">
                              <span className="font-bold text-purple-700">فلسفه: </span>
                              {spec.falsafa.join('، ')}
                            </div>
                          )}
                          {spec?.thursdayNote && (
                            <div className="text-teal-900 font-medium">
                              <span className="font-bold text-teal-700">۵شنبه: </span>
                              {spec.thursdayNote}
                            </div>
                          )}
                          {(!spec?.usul?.length && !spec?.fiqh?.length && !spec?.falsafa?.length && !spec?.thursdayNote) && (
                            <span className="text-slate-300">-</span>
                          )}
                        </div>
                      </td>

                      {/* Experience History (Auto + Manual) */}
                      <td className="py-3 px-4 text-slate-700 max-w-xs">
                        {(() => {
                          const autoInfo = autoTeachingHistoryMap[teacher.id];
                          const hasAuto = Boolean(autoInfo && autoInfo.totalCount > 0);
                          const hasManual = Boolean(teacher.experienceHistory);
                          if (!hasAuto && !hasManual) {
                            return <span className="text-slate-300">-</span>;
                          }
                          return (
                            <div className="space-y-1 text-[11px] leading-relaxed">
                              {hasAuto && (
                                <div className="line-clamp-2 bg-indigo-50/70 text-indigo-900 p-1.5 rounded-lg border border-indigo-100">
                                  <span className="font-black text-[10px] text-indigo-700 ml-1">خودکار:</span>
                                  {autoInfo.summaryText}
                                </div>
                              )}
                              {hasManual && (
                                <div className="line-clamp-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                                  {teacher.experienceHistory}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Notes */}
                      <td className="py-3 px-4 text-slate-600 max-w-xs">
                        {teacher.notes ? (
                          <div className="line-clamp-2 text-[11px] leading-relaxed">
                            {teacher.notes}
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-4">
                        {getPriorityBadge(teacher.priority)}
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3 px-4">
                        {canManageTeachers ? (
                          <button
                            onClick={() => handleToggleStatus(teacher)}
                            className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer",
                              teacher.isActive 
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" 
                                : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                            )}
                          >
                            {teacher.isActive ? (
                              <>
                                <CheckCircle2 size={12} />
                                <span>فعال</span>
                              </>
                            ) : (
                              <>
                                <XCircle size={12} />
                                <span>غیرفعال</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border",
                            teacher.isActive 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          )}>
                            {teacher.isActive ? 'فعال' : 'غیرفعال'}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        {canManageTeachers ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditModal(teacher)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="ویرایش استاد"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(teacher.id)}
                              disabled={deletingIds.has(teacher.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              title="حذف استاد"
                            >
                              {deletingIds.has(teacher.id) ? (
                                <Loader2 size={16} className="animate-spin text-rose-600" />
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">فقط مشاهده</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARDS GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeachers.map((teacher) => {
            const spec = teacher.detailedSpecialties;

            return (
              <div 
                key={teacher.id}
                className={cn(
                  "bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all space-y-4 flex flex-col justify-between relative",
                  !teacher.isActive && "opacity-60 bg-slate-50/60"
                )}
              >
                <div className="space-y-3">
                  {/* Top Bar inside Card */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isLevel2User && isMultiCopyMode && (
                        <input
                          type="checkbox"
                          checked={selectedMultiPhoneIds.includes(teacher.id)}
                          onChange={() => {
                            setSelectedMultiPhoneIds(prev =>
                              prev.includes(teacher.id)
                                ? prev.filter(i => i !== teacher.id)
                                : [...prev, teacher.id]
                            );
                          }}
                          className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer shrink-0"
                        />
                      )}
                      {teacher.photoUrl ? (
                        <img 
                          src={teacher.photoUrl} 
                          alt={teacher.fullName} 
                          className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shrink-0 shadow-xs" 
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black flex items-center justify-center text-lg shrink-0 shadow-xs">
                          {teacher.fullName?.charAt(0) || 'ا'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-800 text-sm sm:text-base truncate">
                          {teacher.fullName}
                          {teacher.fatherName ? <span className="text-xs font-medium text-slate-500 mr-1">({teacher.fatherName})</span> : null}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500 font-mono">
                          <span className="flex items-center gap-1">
                            <Phone size={12} className="text-slate-400" />
                            <span>{teacher.phoneNumber || 'بدون شماره'}</span>
                          </span>
                          {teacher.teacherCode && (
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              کد: {teacher.teacherCode}
                            </span>
                          )}
                          {teacher.centerTeacherCode && (
                            <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              مرکز: {teacher.centerTeacherCode}
                            </span>
                          )}
                          {teacher.nationalId && (
                            <span className="text-slate-400 text-[10px]">
                              کد ملی: {teacher.nationalId}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {getPriorityBadge(teacher.priority)}
                    </div>
                  </div>

                  {/* Categories */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {teacher.categories?.map(cat => (
                      <span 
                        key={cat} 
                        className={cn(
                          "px-2.5 py-0.5 rounded-lg text-[10px] font-bold border",
                          getCategoryColor(cat)
                        )}
                      >
                        {cat}
                      </span>
                    ))}
                  </div>

                  {/* Detailed Specialties */}
                  {(spec?.usul?.length || spec?.fiqh?.length || spec?.falsafa?.length || spec?.thursdayNote) ? (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs space-y-1.5">
                      <div className="font-bold text-slate-700 text-[11px] mb-1">تخصص‌های جزئی (کتاب‌ها):</div>
                      {spec?.usul && spec.usul.length > 0 && (
                        <div className="text-indigo-900"><span className="font-bold text-indigo-700">اصول:</span> {spec.usul.join('، ')}</div>
                      )}
                      {spec?.fiqh && spec.fiqh.length > 0 && (
                        <div className="text-amber-900"><span className="font-bold text-amber-700">فقه:</span> {spec.fiqh.join('، ')}</div>
                      )}
                      {spec?.falsafa && spec.falsafa.length > 0 && (
                        <div className="text-purple-900"><span className="font-bold text-purple-700">فلسفه:</span> {spec.falsafa.join('، ')}</div>
                      )}
                      {spec?.thursdayNote && (
                        <div className="text-teal-900"><span className="font-bold text-teal-700">۵شنبه:</span> {spec.thursdayNote}</div>
                      )}
                    </div>
                  ) : null}

                  {/* Experience History (Auto + Manual) */}
                  {(teacher.experienceHistory || (autoTeachingHistoryMap[teacher.id]?.totalCount || 0) > 0) && (
                    <div className="text-xs space-y-1.5">
                      <div className="font-bold text-slate-700 text-[11px] flex items-center gap-1">
                        <History size={12} className="text-indigo-600" />
                        <span>سوابق تدریس در مجموعه (خودکار و دستی):</span>
                      </div>
                      {autoTeachingHistoryMap[teacher.id]?.totalCount > 0 && (
                        <div className="text-indigo-900 text-[11px] leading-relaxed bg-indigo-50/70 border border-indigo-100 p-2.5 rounded-xl space-y-1">
                          {autoTeachingHistoryMap[teacher.id].currentCourses.length > 0 && (
                            <div>
                              <span className="font-black text-indigo-700">برنامه‌های جاری: </span>
                              {autoTeachingHistoryMap[teacher.id].currentCourses.join(' | ')}
                            </div>
                          )}
                          {autoTeachingHistoryMap[teacher.id].pastCourses.length > 0 && (
                            <div>
                              <span className="font-black text-amber-700">دروس سال قبل / سوابق: </span>
                              {autoTeachingHistoryMap[teacher.id].pastCourses.join(' | ')}
                            </div>
                          )}
                        </div>
                      )}
                      {teacher.experienceHistory && (
                        <p className="text-slate-600 text-[11px] leading-relaxed bg-amber-50/50 border border-amber-100 p-2.5 rounded-xl">
                          {teacher.experienceHistory}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {teacher.notes && (
                    <p className="text-[11px] text-slate-500 italic">
                      «{teacher.notes}»
                    </p>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  {canManageTeachers ? (
                    <button
                      onClick={() => handleToggleStatus(teacher)}
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer",
                        teacher.isActive 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                          : "bg-rose-50 text-rose-700 border-rose-200"
                      )}
                    >
                      {teacher.isActive ? 'فعال' : 'غیرفعال'}
                    </button>
                  ) : (
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border",
                      teacher.isActive 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    )}>
                      {teacher.isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                  )}

                  {canManageTeachers ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(teacher)}
                        className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors font-bold text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Edit size={14} />
                        <span>ویرایش</span>
                      </button>
                      <button
                        onClick={() => handleDelete(teacher.id)}
                        disabled={deletingIds.has(teacher.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                        title="حذف"
                      >
                        {deletingIds.has(teacher.id) ? (
                          <Loader2 size={14} className="animate-spin text-rose-600" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium">فقط مشاهده</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* HIDDEN PRINT CONTAINER FOR PDF EXPORT */}
      <div style={{ position: 'fixed', left: '-9999px', top: '0px', width: '1100px', zIndex: -1000, pointerEvents: 'none', opacity: 0 }}>
        <div 
          ref={pdfPrintRef} 
          className="p-8 bg-white text-slate-900 font-sans space-y-5" 
          dir="rtl"
          style={{ width: '1100px', backgroundColor: '#ffffff' }}
        >
          {/* PDF Report Header */}
          <div className="flex items-center justify-between border-b-2 border-indigo-900 pb-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-black text-indigo-950">بانک اطلاعات اساتید و مدرسین حوزه علمیه</h1>
              <p className="text-xs text-slate-600 font-bold">
                گزارش اساتید مدعو و مدرسین دروس فقه، اصول، فلسفه و مشاوره‌های علمی
              </p>
            </div>
            <div className="text-left space-y-1">
              <div className="text-xs font-black text-indigo-900">تاریخ گزارش: {new Date().toLocaleDateString('fa-IR')}</div>
              <div className="text-[11px] font-bold text-slate-600">تعداد اساتید: {filteredTeachers.length} نفر</div>
              {!includePhoneInExport && (
                <div className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  (خروجی بدون شماره تماس اساتید)
                </div>
              )}
            </div>
          </div>

          {/* PDF Teachers Table */}
          <table className="w-full text-right text-xs border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <th className="p-2.5 border border-slate-300 text-center w-10">#</th>
                <th className="p-2.5 border border-slate-300">نام و نام خانوادگی استاد</th>
                {includePhoneInExport && (
                  <th className="p-2.5 border border-slate-300 text-center">شماره تماس</th>
                )}
                <th className="p-2.5 border border-slate-300">تخصص‌های اصلی</th>
                <th className="p-2.5 border border-slate-300">تخصص‌های جزئی (کتاب‌ها)</th>
                <th className="p-2.5 border border-slate-300">سوابق تدریس در مجموعه</th>
                <th className="p-2.5 border border-slate-300">توضیحات</th>
                <th className="p-2.5 border border-slate-300 text-center w-20">اولویت</th>
                <th className="p-2.5 border border-slate-300 text-center w-16">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeachers.map((t, idx) => {
                const spec = t.detailedSpecialties;
                const specList: string[] = [];
                if (spec?.usul?.length) specList.push(`اصول: ${spec.usul.join('، ')}`);
                if (spec?.fiqh?.length) specList.push(`فقه: ${spec.fiqh.join('، ')}`);
                if (spec?.falsafa?.length) specList.push(`فلسفه: ${spec.falsafa.join('، ')}`);
                if (spec?.thursdayNote) specList.push(`۵شنبه: ${spec.thursdayNote}`);

                return (
                  <tr key={t.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}>
                    <td className="p-2 border border-slate-300 text-center font-bold text-slate-500">{idx + 1}</td>
                    <td className="p-2 border border-slate-300 font-bold text-slate-900">{t.fullName}</td>
                    {includePhoneInExport && (
                      <td className="p-2 border border-slate-300 text-center font-mono text-slate-800">{t.phoneNumber || '-'}</td>
                    )}
                    <td className="p-2 border border-slate-300">{t.categories?.join('، ') || '-'}</td>
                    <td className="p-2 border border-slate-300 font-medium">{specList.join(' | ') || '-'}</td>
                    <td className="p-2 border border-slate-300 text-[11px] leading-relaxed">
                      {[
                        t.experienceHistory,
                        autoTeachingHistoryMap[t.id]?.summaryText
                          ? `[خودکار] ${autoTeachingHistoryMap[t.id].summaryText}`
                          : ''
                      ].filter(Boolean).join(' | ') || '-'}
                    </td>
                    <td className="p-2 border border-slate-300 text-[11px] leading-relaxed">{t.notes || '-'}</td>
                    <td className="p-2 border border-slate-300 text-center font-bold">
                      اولویت {t.priority}
                    </td>
                    <td className="p-2 border border-slate-300 text-center font-bold">
                      {t.isActive ? 'فعال' : 'غیرفعال'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT TEACHER MODAL */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-3xl border border-slate-200 shadow-2xl my-6 max-h-[92vh] overflow-y-auto space-y-5"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 sticky top-0 bg-white/95 backdrop-blur-xs z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold border border-indigo-100">
                    <GraduationCap size={21} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-800">
                      {editingTeacher ? 'ویرایش مشخصات استاد' : 'افزودن استاد جدید به بانک اساتید'}
                    </h2>
                    <p className="text-[11px] text-slate-400 font-medium">
                      اطلاعات هویتی، کدهای مرکز، حساب‌های مالی، اولویت و سوابق تدریس استاد را تکمیل نمایید
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                
                {/* FIELDSET 1: Basic, Identity & Contact Information */}
                <fieldset className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200 space-y-3.5">
                  <legend className="px-2.5 py-0.5 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-800 flex items-center gap-1.5 shadow-2xs">
                    <User size={14} className="text-indigo-600" />
                    <span>اطلاعات پایه، هویتی و تماس</span>
                  </legend>

                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                    {/* Photo Uploader */}
                    <div className="relative group shrink-0 mt-1">
                      {photoUrl ? (
                        <img 
                          src={photoUrl} 
                          alt="استاد" 
                          className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-500 shadow-xs" 
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-2xl bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-2xl border border-indigo-200">
                          {firstName?.charAt(0) || lastName?.charAt(0) || 'ا'}
                        </div>
                      )}
                      <label className="absolute -bottom-1.5 -right-1.5 bg-indigo-600 text-white p-1.5 rounded-xl cursor-pointer hover:bg-indigo-700 transition-all shadow-md" title="انتخاب تصویر استاد">
                        <Upload size={12} />
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleImageUpload} 
                          className="hidden" 
                        />
                      </label>
                    </div>

                    {/* Identity & Contact Grid */}
                    <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          نام <span className="text-rose-500">*</span>
                        </label>
                        <input 
                          type="text" 
                          required
                          placeholder="مثلاً: سید علی"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          نام خانوادگی <span className="text-rose-500">*</span>
                        </label>
                        <input 
                          type="text" 
                          required
                          placeholder="مثلاً: حسینی"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">نام پدر</label>
                        <input 
                          type="text" 
                          placeholder="نام پدر استاد"
                          value={fatherName}
                          onChange={(e) => setFatherName(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          کد ملی <span className="text-[10px] text-slate-400 font-normal">(ورود و تطبیق)</span>
                        </label>
                        <input 
                          type="text" 
                          placeholder="مثلاً ۰۰۱۲۳۴۵۶۷۸"
                          value={nationalId}
                          onChange={(e) => setNationalId(e.target.value)}
                          maxLength={10}
                          dir="ltr"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-right outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">ش.شناسنامه</label>
                        <input 
                          type="text" 
                          placeholder="شماره شناسنامه"
                          value={birthCertificateNumber}
                          onChange={(e) => setBirthCertificateNumber(e.target.value)}
                          dir="ltr"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-right outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">شماره همراه / تماس</label>
                        <input 
                          type="text" 
                          placeholder="0912..."
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          dir="ltr"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-right outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">شماره منزل</label>
                        <input 
                          type="text" 
                          placeholder="025..."
                          value={homePhone}
                          onChange={(e) => setHomePhone(e.target.value)}
                          dir="ltr"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-right outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                          <MapPin size={12} className="text-slate-400" />
                          <span>آدرس منزل</span>
                        </label>
                        <input 
                          type="text" 
                          placeholder="نشانی کامل محل سکونت..."
                          value={homeAddress}
                          onChange={(e) => setHomeAddress(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                </fieldset>

                {/* FIELDSET 2: Teacher & Center Codes */}
                <fieldset className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-200/80 space-y-3">
                  <legend className="px-2.5 py-0.5 bg-white border border-indigo-200 rounded-lg text-xs font-black text-indigo-950 flex items-center gap-1.5 shadow-2xs">
                    <Hash size={14} className="text-indigo-600" />
                    <span>اطلاعات کدهای استادی و شناسه‌های مرکز</span>
                  </legend>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">کد استادی داخلی</label>
                        <button
                          type="button"
                          onClick={() => setTeacherCode(generateUniqueTeacherCode())}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                        >
                          تولید خودکار
                        </button>
                      </div>
                      <input 
                        type="text" 
                        placeholder="مثلاً T-104"
                        value={teacherCode}
                        onChange={(e) => setTeacherCode(e.target.value)}
                        dir="ltr"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-right outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">کد استاد مرکز</label>
                      <input 
                        type="text" 
                        placeholder="کد استاد در مرکز..."
                        value={centerTeacherCode}
                        onChange={(e) => setCenterTeacherCode(e.target.value)}
                        dir="ltr"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-right outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">کد مرکز خدمات</label>
                      <input 
                        type="text" 
                        placeholder="کد مرکز خدمات حوزه‌ها..."
                        value={servicesCenterCode}
                        onChange={(e) => setServicesCenterCode(e.target.value)}
                        dir="ltr"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-right outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">شماره پرونده مرکز مدیریت</label>
                      <input 
                        type="text" 
                        placeholder="شماره پرونده..."
                        value={managementCenterFileNumber}
                        onChange={(e) => setManagementCenterFileNumber(e.target.value)}
                        dir="ltr"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-right outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </fieldset>

                {/* FIELDSET 3: Financial & Dedicated Bank Accounts */}
                <fieldset className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200/80 space-y-3">
                  <legend className="px-2.5 py-0.5 bg-white border border-emerald-200 rounded-lg text-xs font-black text-emerald-950 flex items-center gap-1.5 shadow-2xs">
                    <CreditCard size={14} className="text-emerald-700" />
                    <span>اطلاعات مالی و حساب‌های بانکی واریز حق‌الزحمه</span>
                  </legend>

                  {/* Dedicated Sheba, Tejarat, Siba Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-xl border border-emerald-200/80 shadow-2xs">
                    <div>
                      <label className="block text-xs font-bold text-emerald-950 mb-1">شماره شبا (IR...)</label>
                      <input
                        type="text"
                        placeholder="IR000000000000000000000000"
                        value={bankSheba}
                        onChange={(e) => setBankSheba(e.target.value)}
                        dir="ltr"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-right focus:bg-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-emerald-950 mb-1">حساب تجارت</label>
                      <input
                        type="text"
                        placeholder="شماره حساب بانک تجارت..."
                        value={tejaratBankAccount}
                        onChange={(e) => setTejaratBankAccount(e.target.value)}
                        dir="ltr"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-right focus:bg-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-emerald-950 mb-1">حساب سیبا</label>
                      <input
                        type="text"
                        placeholder="شماره حساب سیبا (بانک ملی)..."
                        value={sibaBankAccount}
                        onChange={(e) => setSibaBankAccount(e.target.value)}
                        dir="ltr"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-right focus:bg-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-bold text-emerald-900">
                      سایر حساب‌ها / شماره کارت‌های تکمیلی استاد:
                    </span>
                    <button
                      type="button"
                      onClick={() => setBankAccountsList([
                        ...bankAccountsList,
                        { id: `acc_${Date.now()}`, bankName: 'بانک ملی', accountNumber: '', cardNumber: '', shebaNumber: '', note: '' }
                      ])}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Plus size={13} />
                      <span>افزودن حساب / کارت جدید</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {bankAccountsList.map((acc, accIdx) => (
                      <div key={acc.id || accIdx} className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <span className="text-[11px] font-black text-emerald-900 flex items-center gap-1">
                            <span>حساب شماره {accIdx + 1}</span>
                            {accIdx === 0 && <span className="text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">حساب اصلی</span>}
                          </span>
                          {bankAccountsList.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setBankAccountsList(bankAccountsList.filter((_, i) => i !== accIdx))}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                              title="حذف این شماره حساب"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-0.5">نام بانک</label>
                            <input
                              type="text"
                              placeholder="مثلاً: بانک ملی"
                              value={acc.bankName}
                              onChange={(e) => {
                                const updated = [...bankAccountsList];
                                updated[accIdx].bankName = e.target.value;
                                setBankAccountsList(updated);
                              }}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-0.5">شماره حساب</label>
                            <input
                              type="text"
                              placeholder="۰۱۰..."
                              value={acc.accountNumber || ''}
                              onChange={(e) => {
                                const updated = [...bankAccountsList];
                                updated[accIdx].accountNumber = e.target.value;
                                setBankAccountsList(updated);
                              }}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-0.5">شماره کارت (۱۶ رقمی)</label>
                            <input
                              type="text"
                              placeholder="۶۰۳۷-..."
                              value={acc.cardNumber || ''}
                              onChange={(e) => {
                                const updated = [...bankAccountsList];
                                updated[accIdx].cardNumber = e.target.value;
                                setBankAccountsList(updated);
                              }}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-0.5">شماره شبا (IR...)</label>
                            <input
                              type="text"
                              placeholder="IR120..."
                              value={acc.shebaNumber || ''}
                              onChange={(e) => {
                                const updated = [...bankAccountsList];
                                updated[accIdx].shebaNumber = e.target.value;
                                setBankAccountsList(updated);
                              }}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </fieldset>

                {/* Status Switch & Priority Directly Beneath Status */}
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">وضعیت استاد:</span>
                    <button
                      type="button"
                      onClick={() => setIsActive(!isActive)}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                        isActive ? "bg-emerald-600 text-white border-emerald-600 shadow-xs" : "bg-rose-100 text-rose-700 border-rose-300"
                      )}
                    >
                      {isActive ? 'فعال جهت دعوت' : 'غیرفعال (موقت)'}
                    </button>
                  </div>

                  {/* Suggested Priority directly below Teacher Status */}
                  <div className="pt-2.5 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Star size={14} className="text-amber-500" />
                      <span>اولویت پیشنهادی:</span>
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(Number(e.target.value) as 1 | 2 | 3)}
                      className="sm:w-56 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value={1}>اولویت ۱ (عالی)</option>
                      <option value={2}>اولویت ۲ (خوب)</option>
                      <option value={3}>اولویت ۳ (معمولی)</option>
                    </select>
                  </div>
                </div>

                {/* Main Categories Checkboxes */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    تخصص‌ها و زمینه‌های تدریس/مشاوره (امکان انتخاب چندتایی):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    {ALL_CATEGORIES.map((cat) => {
                      const isChecked = selectedCategories.includes(cat);
                      return (
                        <label 
                          key={cat} 
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-xl border text-xs font-bold cursor-pointer select-none transition-all",
                            isChecked 
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs" 
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                          )}
                        >
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => toggleCategory(cat)}
                            className="w-3.5 h-3.5 accent-indigo-600 rounded"
                          />
                          <span className="text-[11px]">{cat}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Detailed Specialties (Conditional Sections) */}
                
                {/* 1. Usul (اصول / مشاوره اصول) */}
                {hasUsulOrCounseling && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-1.5">
                    <label className="block text-xs font-bold text-indigo-900">
                      کتاب‌ها و مباحث مناسب تدریس اصول / مشاوره اصول:
                    </label>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(['رسائل', 'کفایه', 'حلقات'] as const).map(book => {
                        const isChecked = usulSpecialties.includes(book);
                        return (
                          <label key={book} className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all",
                            isChecked ? "bg-indigo-700 text-white border-indigo-700" : "bg-white border-indigo-200 text-indigo-800"
                          )}>
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) setUsulSpecialties([...usulSpecialties, book]);
                                else setUsulSpecialties(usulSpecialties.filter(b => b !== book));
                              }}
                              className="w-3.5 h-3.5 accent-indigo-600"
                            />
                            <span>{book}</span>
                          </label>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* 2. Fiqh (فقه / مشاوره فقه) */}
                {hasFiqhOrCounseling && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-1.5">
                    <label className="block text-xs font-bold text-amber-900">
                      کتاب‌های مناسب تدریس فقه / مشاوره فقه:
                    </label>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(['مکاسب'] as const).map(book => {
                        const isChecked = fiqhSpecialties.includes(book);
                        return (
                          <label key={book} className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all",
                            isChecked ? "bg-amber-700 text-white border-amber-700" : "bg-white border-amber-200 text-amber-800"
                          )}>
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) setFiqhSpecialties([...fiqhSpecialties, book]);
                                else setFiqhSpecialties(fiqhSpecialties.filter(b => b !== book));
                              }}
                              className="w-3.5 h-3.5 accent-amber-600"
                            />
                            <span>{book}</span>
                          </label>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* 3. Falsafa (فلسفه / مشاوره فلسفه) */}
                {hasFalsafaOrCounseling && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-1.5">
                    <label className="block text-xs font-bold text-purple-900">
                      کتاب‌ها و مباحث مناسب تدریس فلسفه / مشاوره فلسفه:
                    </label>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(['بدایه', 'نهایه', 'آموزش فلسفه'] as const).map(book => {
                        const isChecked = falsafaSpecialties.includes(book);
                        return (
                          <label key={book} className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all",
                            isChecked ? "bg-purple-700 text-white border-purple-700" : "bg-white border-purple-200 text-purple-800"
                          )}>
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) setFalsafaSpecialties([...falsafaSpecialties, book]);
                                else setFalsafaSpecialties(falsafaSpecialties.filter(b => b !== book));
                              }}
                              className="w-3.5 h-3.5 accent-purple-600"
                            />
                            <span>{book}</span>
                          </label>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* 4. Thursday Classes Note */}
                {hasThursday && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-teal-50/70 border border-teal-200 rounded-2xl space-y-1.5">
                    <label className="block text-xs font-bold text-teal-900">
                      مناسب برای چه برنامه‌ها یا دروس ۵شنبه‌ها؟ (دستی بنویسید)
                    </label>
                    <input 
                      type="text" 
                      placeholder="مثلا: کارگاه روش تحقیق، درس اخلاق کاربردی، تفسیر قرآن..."
                      value={thursdayNote}
                      onChange={(e) => setThursdayNote(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-teal-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </motion.div>
                )}

                {/* Experience History (Auto-populated from school programs/history + Manual input) */}
                <div className="space-y-2.5 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <History size={15} className="text-indigo-600" />
                      <span>سوابق تدریس (خودکار از برنامه‌های مدرسه و سوابق سال قبل + ثبت دستی)</span>
                    </label>
                  </div>

                  {(() => {
                    const modalTeacherObj: Teacher = {
                      id: editingTeacher?.id || '__draft__',
                      fullName: [firstName, lastName].filter(Boolean).join(' ').trim(),
                      firstName: firstName.trim(),
                      lastName: lastName.trim(),
                      categories: selectedCategories,
                      priority,
                      isActive,
                      createdAt: ''
                    };
                    const autoInfo = editingTeacher && autoTeachingHistoryMap[editingTeacher.id]
                      ? autoTeachingHistoryMap[editingTeacher.id]
                      : (() => {
                          const currentCourses: string[] = [];
                          const pastCourses: string[] = [];
                          const matchedProgs = programs.filter((p) => matchTeacherWithRecordName(p.teacher, modalTeacherObj));
                          for (const p of matchedProgs) {
                            const isArch = Boolean(p.isDeleted) || p.status === 'inactive' || p.status === 'deleted';
                            const label = `${p.title}${p.grade ? ` (${p.grade})` : ''}${p.subjectBook ? ` کتاب: ${p.subjectBook}` : ''}`;
                            if (isArch) pastCourses.push(`${label} [آرشیو]`);
                            else currentCourses.push(label);
                          }
                          return {
                            currentCourses,
                            pastCourses,
                            summaryText: [...currentCourses, ...pastCourses].join(' | '),
                            totalCount: currentCourses.length + pastCourses.length
                          };
                        })();

                    return (
                      <div className="bg-white border border-indigo-200/80 rounded-xl p-3 space-y-2 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-900 flex items-center gap-1">
                            <Sparkles size={13} className="text-indigo-600" />
                            <span>استخراج خودکار از سامانه:</span>
                          </span>
                          <span className="text-[10px] font-bold text-slate-500">
                            {autoInfo.totalCount > 0 ? `${autoInfo.totalCount} مورد یافت شد` : 'سابقه خودکاری یافت نشد'}
                          </span>
                        </div>

                        {autoInfo.totalCount > 0 ? (
                          <div className="space-y-1.5">
                            {autoInfo.currentCourses.length > 0 && (
                              <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg p-2">
                                <div className="font-black text-indigo-800 text-[10px] mb-1">برنامه‌های جاری مدرسه:</div>
                                <ul className="list-disc list-inside space-y-0.5 text-indigo-950">
                                  {autoInfo.currentCourses.map((c, i) => (
                                    <li key={i}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {autoInfo.pastCourses.length > 0 && (
                              <div className="bg-amber-50/70 border border-amber-100 rounded-lg p-2">
                                <div className="font-black text-amber-800 text-[10px] mb-1">دروس سال قبل و منتقل‌شده به سوابق:</div>
                                <ul className="list-disc list-inside space-y-0.5 text-amber-950">
                                  {autoInfo.pastCourses.map((c, i) => (
                                    <li key={i}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400">
                            بر اساس برنامه‌های فعلی، کلاس‌های آرشیوی و سوابق پایان‌یافته طلاب، موردی برای این نام یافت نشد.
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      سوابق تدریس دستی و بازخوردها (تکمیلی):
                    </label>
                    <textarea 
                      rows={2}
                      placeholder="بنویسید چه درسی تا حالا درس گفته یا چه بازخوردهایی داشته است..."
                      value={experienceHistory}
                      onChange={(e) => setExperienceHistory(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">توضیحات و ملاحظات تکمیلی:</label>
                  <textarea 
                    rows={2}
                    placeholder="ساعات ترجیحی حضور، نکات اخلاقی، ملاحظات مالی..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white resize-none"
                  />
                </div>

                {/* Form Buttons */}
                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className={cn(
                      "px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2",
                      isSaving ? "opacity-75 cursor-not-allowed" : "active:scale-95 cursor-pointer"
                    )}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin ml-1 inline" />
                        <span>در حال ذخیره...</span>
                      </>
                    ) : (
                      <span>{editingTeacher ? 'بروزرسانی اطلاعات استاد' : 'ذخیره استاد جدید'}</span>
                    )}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import File Modal */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-2xl bg-teal-50 text-teal-700">
                    <Upload size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-800">ورود و افزودن اساتید از فایل</h2>
                    <p className="text-[11px] font-medium text-slate-500">پشتیبانی از فایل‌های اکسل (XLSX, XLS, CSV) و JSON</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowImportModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                >
                  <XCircle size={20} />
                </button>
              </div>

              {importMessage && (
                <div className={cn(
                  "p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 border",
                  importMessage.type === 'success' ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"
                )}>
                  {importMessage.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> : <XCircle size={16} className="text-rose-600 shrink-0" />}
                  <span>{importMessage.text}</span>
                </div>
              )}

              <div className="space-y-3">
                <div 
                  onClick={() => importFileRef.current?.click()}
                  className="border-2 border-dashed border-teal-200 hover:border-teal-400 bg-teal-50/40 hover:bg-teal-50 p-6 rounded-2xl text-center cursor-pointer transition-all space-y-2 group"
                >
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload size={24} />
                  </div>
                  <div className="text-xs font-bold text-slate-700">
                    {importLoading ? 'در حال پردازش و افزودن اساتید...' : 'برای انتخاب فایل اکسل یا JSON اینجا کلیک کنید'}
                  </div>
                  <div className="text-[11px] font-medium text-slate-400">فرمت‌های مجاز: .xlsx , .xls , .csv , .json</div>
                </div>

                <input 
                  type="file" 
                  ref={importFileRef}
                  onChange={handleProcessImportFile}
                  accept=".xlsx,.xls,.csv,.json"
                  className="hidden"
                />

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-600 leading-relaxed space-y-1">
                  <span className="font-bold text-slate-800 block">راهنمای ساختار فایل:</span>
                  <p>• <strong className="text-slate-800">اکسل:</strong> ستون اصلی باید شامل <strong className="text-slate-800">«نام و نام خانوادگی»</strong> باشد. ستون‌های اختیاری دیگر: «شماره تماس»، «تخصص‌های کلی» (مثلاً: فقه | اصول)، «تخصص‌های جزئی»، «سوابق تدریس»، «توضیحات» و «اولویت».</p>
                  <p>• <strong className="text-slate-800">JSON:</strong> آرایه‌ای از اشیای استاد شامل مشخصات <code>fullName</code>, <code>phoneNumber</code>, <code>categories</code>, <code>priority</code> و...</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
                >
                  بستن
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4-Step Smart Teacher Excel Import Wizard (Exact Parity with StudentList) */}
      <TeacherExcelImportModal
        isOpen={showExcelImportModal}
        initialFile={excelImportFile}
        existingTeachers={teachers}
        onClose={() => {
          setShowExcelImportModal(false);
          setExcelImportFile(null);
        }}
        onImportCompleted={() => {
          fetchTeachers();
        }}
      />

    </div>
  );
}
