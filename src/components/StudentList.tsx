import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Upload, 
  Search, 
  Trash2, 
  Edit2, 
  CheckCircle, 
  XCircle,
  FileSpreadsheet,
  Settings2,
  ChevronDown,
  User,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  RotateCcw,
  GitMerge,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  CheckCheck,
  RefreshCw,
  CopyCheck,
  Users,
  Phone,
  Heart,
  Home,
  MapPin,
  BookOpen,
  KeyRound,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  GraduationCap,
  Award,
  CreditCard,
  Building,
  UserX,
  Calendar,
  FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { localDb, isStudentActive, DuplicateGroup, MergeResult } from '../lib/localDb';
import { Student, Program, Enrollment, StudentDeactivationReason } from '../types';
import { useMentor } from '../context/MentorContext';
import { useAuth } from '../context/AuthContext';
import { AppUser } from '../types/auth';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import DeactivationModal from './DeactivationModal';
import StudentRecordHistoryModal from './StudentRecordHistoryModal';

interface StudentListProps {
  onlyActive?: boolean;
  initialStudentId?: string;
}

export default function StudentList({ onlyActive = false, initialStudentId }: StudentListProps) {
  const { 
    filterStudents, 
    getMentorForStudent, 
    currentMentor, 
    currentMentorId, 
    setIsMentorModalOpen,
    shahpooriFilter,
    setShahpooriFilter 
  } = useMentor();
  const { users, currentUser, addUser, updateUser } = useAuth();
  const [selectedStudentForCredentials, setSelectedStudentForCredentials] = useState<Student | null>(null);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [editingCredUser, setEditingCredUser] = useState<AppUser | null>(null);

  // Form fields inside the credentials popup
  const [credUsername, setCredUsername] = useState('');
  const [credPassword, setCredPassword] = useState('');
  const [credName, setCredName] = useState('');

  const isAuthorizedToManage = currentUser?.role === 'super_admin' || currentUser?.role === 'education_manager' || currentUser?.role === 'education_officer' || currentUser?.username?.toUpperCase() === 'SHAH';
  const isReadOnlyUser = currentUser?.isReadOnly === true;

  // Helper to accurately match a student with their user account
  const getStudentAccount = (student: Student, allUsers: AppUser[] = users): AppUser | undefined => {
    if (!student) return undefined;
    return allUsers.find(u => {
      // 1. Matched by linkedStudentId
      if (u.linkedStudentId && String(u.linkedStudentId) === String(student.id)) return true;
      // 2. Matched by studentId
      if (u.studentId && String(u.studentId) === String(student.id)) return true;
      // 3. Matched by national ID if username is national ID
      if (student.nationalId && student.nationalId.trim()) {
        const cleanNationalId = student.nationalId.trim().toUpperCase();
        if (u.username.toUpperCase() === cleanNationalId) return true;
      }
      // 4. Matched by exact name if role is student or level is 3
      if ((u.role === 'student' || u.level === 3) && u.name && student.name) {
        if (u.name.trim() === student.name.trim()) return true;
        if (u.fullName && u.fullName.trim() === student.name.trim()) return true;
      }
      return false;
    });
  };

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForCredentials) return;

    if (!credUsername.trim() || !credPassword.trim()) {
      alert('نام کاربری و کلمه عبور نمی‌تواند خالی باشد.');
      return;
    }

    const cleanUsername = credUsername.trim().toUpperCase();

    if (editingCredUser) {
      // Update
      updateUser(editingCredUser.id, {
        username: cleanUsername,
        password: credPassword.trim(),
        name: selectedStudentForCredentials.name,
        fullName: selectedStudentForCredentials.name,
        linkedStudentId: selectedStudentForCredentials.id,
        studentId: selectedStudentForCredentials.id,
        studentName: selectedStudentForCredentials.name,
      });
      alert('مشخصات ورود طلبه با موفقیت ویرایش شد.');
      setSelectedStudentForCredentials(null);
    } else {
      // Create or re-link
      const existingUserWithUsername = users.find(u => 
        u.username.toUpperCase() === cleanUsername || 
        (u.linkedStudentId && String(u.linkedStudentId) === String(selectedStudentForCredentials.id)) ||
        (u.studentId && String(u.studentId) === String(selectedStudentForCredentials.id))
      );

      if (existingUserWithUsername) {
        // If this user account belongs to this student (by name or nationalId or previous link), link and update it!
        const isSameStudent = 
          existingUserWithUsername.linkedStudentId === selectedStudentForCredentials.id ||
          existingUserWithUsername.studentId === selectedStudentForCredentials.id ||
          existingUserWithUsername.name?.trim() === selectedStudentForCredentials.name.trim() ||
          existingUserWithUsername.fullName?.trim() === selectedStudentForCredentials.name.trim() ||
          (selectedStudentForCredentials.nationalId && existingUserWithUsername.username.toUpperCase() === selectedStudentForCredentials.nationalId.trim().toUpperCase());

        if (isSameStudent) {
          updateUser(existingUserWithUsername.id, {
            username: cleanUsername,
            password: credPassword.trim(),
            name: selectedStudentForCredentials.name,
            fullName: selectedStudentForCredentials.name,
            linkedStudentId: selectedStudentForCredentials.id,
            studentId: selectedStudentForCredentials.id,
            studentName: selectedStudentForCredentials.name,
          });
          alert('حساب کاربری با موفقیت به این طلبه متصل و بروزرسانی شد.');
          setSelectedStudentForCredentials(null);
          return;
        }

        alert('این نام کاربری قبلاً در سامانه برای کاربر دیگری تعریف شده است.');
        return;
      }

      const result = addUser({
        username: cleanUsername,
        password: credPassword.trim(),
        name: selectedStudentForCredentials.name,
        fullName: selectedStudentForCredentials.name,
        level: 3,
        role: 'student',
        roleTitle: 'طلبه',
        scope: 'self',
        gradeLabel: selectedStudentForCredentials.grade || 'طلبه پایه',
        linkedStudentId: selectedStudentForCredentials.id,
        studentId: selectedStudentForCredentials.id,
        studentName: selectedStudentForCredentials.name,
        isActive: true,
        avatarBg: 'bg-emerald-600',
        allowedTabs: ['attendance', 'student-schedule', 'discussion', 'stats', 'comments', 'manager-files']
      });

      if (result.success) {
        alert('حساب کاربری با موفقیت برای این طلبه ایجاد شد.');
        setSelectedStudentForCredentials(null);
      } else {
        alert(`خطا در ایجاد حساب: ${result.error}`);
      }
    }
  };
  const [students, setStudents] = useState<Student[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingStudentSummary, setViewingStudentSummary] = useState<Student | null>(null);

  useEffect(() => {
    if (initialStudentId && students.length > 0) {
      const found = students.find(s => s.id === initialStudentId);
      if (found) {
        setSearchTerm(found.name);
      }
    }
  }, [initialStudentId, students]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [newStudent, setNewStudent] = useState<Partial<Student>>({ 
    name: '', 
    nationalId: '', 
    phoneNumber: '', 
    grade: '',
    isActive: true,
    fatherOccupation: '',
    birthPlace: '',
    birthDate: '',
    maritalStatus: 'مجرد',
    childrenCount: 0,
    livingStatus: 'پدری',
    livingStatusOther: '',
    classicEducation: '',
    howzaEntryYear: '',
    instituteEntryYear: '',
    levelOneSchool: '',
    tammomStatus: 'غیر معمم',
    managementCenterCode: '',
    instituteCode: '',
    servicesCenterCode: '',
    deactivationReason: 'صرفا غیر فعال',
    deactivationDate: '',
    deactivationNotes: '',
    tuitionCode: '',
    bankName1: '',
    bankAccount1: '',
    bankSheba1: '',
    bankName2: '',
    bankAccount2: '',
    bankSheba2: ''
  });

  // Deactivation and History State
  const [studentToDeactivate, setStudentToDeactivate] = useState<Student | null>(null);
  const [showDeactivationModal, setShowDeactivationModal] = useState(false);
  const [selectedStudentForRecords, setSelectedStudentForRecords] = useState<Student | null>(null);

  // Status Filter in the All-Users Bank (all | active | inactive)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [inactiveReasonFilter, setInactiveReasonFilter] = useState<string>('all');

  const [showColumnFilter, setShowColumnFilter] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [hideInactive, setHideInactive] = useState<boolean>(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'index', 'grade', 'name', 'nationalId', 'isActive', 'deactivationReason', 'userStatus', 'actions'
  ]);

  // Duplicate Students Management
  const [showDuplicateModal, setShowDuplicateModal] = useState<boolean>(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [isScanningDuplicates, setIsScanningDuplicates] = useState<boolean>(false);
  const [isMergingDuplicates, setIsMergingDuplicates] = useState<boolean>(false);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);

  const handleOpenDuplicateModal = async () => {
    setShowDuplicateModal(true);
    setMergeResult(null);
    setIsScanningDuplicates(true);
    try {
      const groups = await localDb.scanDuplicateStudents();
      setDuplicateGroups(groups);
    } catch (e) {
      console.error('Error scanning duplicate students:', e);
    } finally {
      setIsScanningDuplicates(false);
    }
  };

  const handleExecuteMergeDuplicates = async () => {
    setIsMergingDuplicates(true);
    try {
      const result = await localDb.mergeAndDeduplicateStudents();
      setMergeResult(result);
      const updatedGroups = await localDb.scanDuplicateStudents();
      setDuplicateGroups(updatedGroups);
      await fetchStudents();
    } catch (e: any) {
      alert('خطا در ادغام اطلاعات کاربران تکراری: ' + (e?.message || 'نامشخص'));
    } finally {
      setIsMergingDuplicates(false);
    }
  };

  // Filter & Sort States
  const [sortBy, setSortBy] = useState<string>('grade');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [livingFilter, setLivingFilter] = useState<string>('all');
  const [maritalFilter, setMaritalFilter] = useState<string>('all');
  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const allColumns = [
    { id: 'index', label: '#' },
    { id: 'grade', label: 'پایه تحصیلی' },
    { id: 'name', label: 'نام و نام خانوادگی' },
    { id: 'nationalId', label: 'کد ملی' },
    { id: 'phoneNumber', label: 'شماره تماس' },
    { id: 'managementCenterCode', label: 'کد مرکز مدیریت' },
    { id: 'instituteCode', label: 'کد موسسه' },
    { id: 'servicesCenterCode', label: 'کد مرکز خدمات' },
    { id: 'fatherOccupation', label: 'شغل پدر' },
    { id: 'birthPlace', label: 'اهل کجاست' },
    { id: 'birthDate', label: 'تاریخ تولد' },
    { id: 'maritalStatus', label: 'وضعیت تاهل' },
    { id: 'childrenCount', label: 'تعداد فرزندان' },
    { id: 'livingStatus', label: 'سکونت' },
    { id: 'classicEducation', label: 'تحصیلات کلاسیک' },
    { id: 'howzaEntryYear', label: 'سال ورود به حوزه' },
    { id: 'instituteEntryYear', label: 'سال ورود به موسسه' },
    { id: 'levelOneSchool', label: 'مدرسه سطح یک' },
    { id: 'tammomStatus', label: 'وضعیت تعمم' },
    { id: 'isActive', label: 'وضعیت حضور' },
    { id: 'deactivationReason', label: 'علت غیرفعال بودن' },
    { id: 'tuitionCode', label: 'کد شهریه' },
    { id: 'userStatus', label: 'وضعیت کاربری سایت' },
    { id: 'actions', label: 'عملیات' },
  ];

  const toggleColumn = (columnId: string) => {
    if (visibleColumns.includes(columnId)) {
      if (visibleColumns.length > 1) {
        setVisibleColumns(visibleColumns.filter(id => id !== columnId));
      }
    } else {
      setVisibleColumns([...visibleColumns, columnId]);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const allData = await localDb.getDocs<Student>('students');
      const allProgs = await localDb.getDocs<Program>('programs');
      const allEnrollments = await localDb.getDocs<Enrollment>('enrollments');

      const data = onlyActive ? allData.filter(s => isStudentActive(s)) : allData;
      
      // Sort by grade (numerically if possible)
      const sortedData = data.sort((a, b) => {
        const gradeA = a.grade || '99';
        const gradeB = b.grade || '99';
        return gradeA.localeCompare(gradeB, 'fa', { numeric: true });
      });
      
      setStudents(sortedData);
      setPrograms(allProgs);
      setEnrollments(allEnrollments);
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    const unsub = localDb.subscribe(() => {
      fetchStudents();
    });
    return () => unsub();
  }, [onlyActive]);

  const syncStudentUserStatus = (studentId: string, isActive: boolean) => {
    try {
      const student = students.find(s => s.id === studentId);
      if (!student) return;
      const studentUser = getStudentAccount(student);
      if (studentUser) {
        updateUser(studentUser.id, { isActive });
      }
    } catch (e) {
      console.warn('Could not sync user status:', e);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name?.trim()) {
      alert('لطفاً نام و نام خانوادگی را وارد کنید');
      return;
    }
    
    try {
      const activeState = newStudent.isActive !== undefined ? isStudentActive(newStudent.isActive) : true;
      const studentPayload: any = {
        ...newStudent,
        isActive: activeState,
        deactivationReason: !activeState ? (newStudent.deactivationReason || 'صرفا غیر فعال') : undefined
      };

      if (editingStudent) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, createdAt, ...updateData } = studentPayload as Student;
        
        await localDb.updateDoc('students', editingStudent.id, {
          ...updateData,
          isActive: activeState
        });
        syncStudentUserStatus(editingStudent.id, activeState);
        alert('اطلاعات با موفقیت بروزرسانی شد');
      } else {
        await localDb.addDoc('students', {
          ...studentPayload,
          createdAt: new Date().toISOString()
        });
        alert('طلبه جدید با موفقیت ثبت شد');
      }
      resetForm();
      setShowAddModal(false);
      fetchStudents();
    } catch (error: any) {
      console.error("Error adding/updating student:", error);
      alert('خطا در ثبت اطلاعات: ' + (error.message || 'خطای نامشخص'));
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300;
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setNewStudent(prev => ({ ...prev, photoUrl: dataUrl }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    let defaultGrade = '';
    if (currentMentorId === 'hayati') defaultGrade = 'پایه 7';
    else if (currentMentorId === 'hosseini') defaultGrade = 'پایه 8';
    else if (currentMentorId === 'soleimani') defaultGrade = 'پایه 9';
    else if (currentMentorId === 'asadi') defaultGrade = 'پایه 10';

    setNewStudent({ 
      name: '', 
      photoUrl: '',
      nationalId: '', 
      phoneNumber: '', 
      grade: defaultGrade,
      isActive: true,
      
      // اطلاعات آموزشی
      managementCenterCode: '',
      instituteCode: '',
      servicesCenterCode: '',

      // اطلاعات هویتی
      birthPlace: '',
      birthDate: '',
      fatherName: '',
      fatherOccupation: '',
      fatherJob: '',
      tammomStatus: 'غیر معمم',

      // وضعیت تاهل و سکونت
      maritalStatus: 'مجرد',
      childrenCount: 0,
      livingStatus: 'پدری',
      livingStatusOther: '',

      // سوابق تحصیلی
      classicEducation: '',
      howzaEntryYear: '',
      instituteEntryYear: '',
      levelOneSchool: '',

      // وضعیت غیرفعال
      deactivationReason: 'صرفا غیر فعال',
      deactivationDate: '',
      deactivationNotes: '',

      // اطلاعات مالی
      tuitionCode: '',
      bankName1: '',
      bankAccount1: '',
      bankSheba1: '',
      bankName2: '',
      bankAccount2: '',
      bankSheba2: ''
    });
    setEditingStudent(null);
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setNewStudent({
      ...student,
      isActive: isStudentActive(student.isActive),
      deactivationReason: student.deactivationReason || 'صرفا غیر فعال'
    });
    setShowAddModal(true);
  };

  const toggleActive = async (id: string, currentStatus: any) => {
    try {
      const activeBool = isStudentActive(currentStatus);
      if (activeBool) {
        // If active -> prompt educational manager with the deactivation modal
        const stud = students.find(s => s.id === id);
        if (stud) {
          setStudentToDeactivate(stud);
          setShowDeactivationModal(true);
          return;
        }
      } else {
        // If inactive -> reactivate as present student
        await localDb.updateDoc('students', id, { 
          isActive: true, 
          deactivationReason: undefined,
          deactivationDate: undefined 
        });
        syncStudentUserStatus(id, true);
        fetchStudents();
      }
    } catch (error) {
      console.error("Error updating student:", error);
    }
  };

  const handleConfirmDeactivation = async (reason: StudentDeactivationReason, date: string, notes?: string) => {
    if (!studentToDeactivate) return;
    try {
      await localDb.updateDoc('students', studentToDeactivate.id, {
        isActive: false,
        deactivationReason: reason,
        deactivationDate: date,
        deactivationNotes: notes
      });
      syncStudentUserStatus(studentToDeactivate.id, false);
      setStudentToDeactivate(null);
      fetchStudents();
    } catch (err) {
      console.error('Error deactivating student:', err);
    }
  };

  const deleteStudent = (student: Student) => {
    setStudentToDelete(student);
  };

  const confirmDeleteStudent = async () => {
    if (!studentToDelete) return;
    try {
      await localDb.deleteDoc('students', studentToDelete.id);
      setStudentToDelete(null);
      fetchStudents();
    } catch (error: any) {
      console.error("Error deleting student:", error);
      alert('خطا در حذف: ' + (error.message || 'خطای نامشخص'));
    }
  };

  const confirmDeleteAllStudents = async () => {
    setDeletingAll(true);
    try {
      await localDb.clearCollection('students');
      setShowDeleteAllModal(false);
      fetchStudents();
    } catch (error: any) {
      console.error("Error deleting all students:", error);
      alert('خطا در پاکسازی اطلاعات: ' + (error.message || 'خطای نامشخص'));
    } finally {
      setDeletingAll(false);
    }
  };

  const handleExcelExport = () => {
    if (students.length === 0) {
      alert('لیستی برای خروجی وجود ندارد');
      return;
    }

    const exportData = students.map((s, index) => ({
      'ردیف': index + 1,
      'پایه تحصیلی': s.grade || '',
      'نام و نام خانوادگی': s.name,
      'کد ملی': s.nationalId || '',
      'شماره تماس': s.phoneNumber || '',
      'کد مرکز مدیریت': s.managementCenterCode || '',
      'کد موسسه': s.instituteCode || '',
      'کد مرکز خدمات': s.servicesCenterCode || '',
      'شغل پدر': s.fatherOccupation || '',
      'اهل کجاست': s.birthPlace || '',
      'تاریخ تولد': s.birthDate || '',
      'وضعیت تاهل': s.maritalStatus || '',
      'تعداد فرزندان': s.childrenCount ?? 0,
      'سکونت': s.livingStatus || '',
      'تحصیلات کلاسیک': s.classicEducation || '',
      'سال ورود به حوزه': s.howzaEntryYear || '',
      'سال ورود به موسسه': s.instituteEntryYear || '',
      'مدرسه سطح یک': s.levelOneSchool || '',
      'وضعیت تعمم': s.tammomStatus || '',
      'وضعیت حضور': isStudentActive(s.isActive) ? 'فعال (حاضر)' : 'غیرفعال (سابق)',
      'علت غیرفعال بودن': !isStudentActive(s.isActive) ? (s.deactivationReason || 'صرفا غیر فعال') : '—',
      'کد شهریه': s.tuitionCode || '',
      'بانک ۱': s.bankName1 || '',
      'شماره حساب ۱': s.bankAccount1 || '',
      'شماره شبا ۱': s.bankSheba1 || '',
      'بانک ۲': s.bankName2 || '',
      'شماره حساب ۲': s.bankAccount2 || '',
      'شماره شبا ۲': s.bankSheba2 || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!dir'] = 'rtl'; // Set RTL direction for the worksheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "طلاب");
    XLSX.writeFile(wb, `لیست_طلاب_${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.xlsx`);
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const buffer = evt.target?.result;
        const wb = XLSX.read(buffer, { type: 'array' });
        const wsname = wb.SheetNames[0];
        if (!wsname) {
          alert('فایل اکسل خالی یا نامعتبر است');
          return;
        }
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (!data || data.length === 0) {
          alert('هیچ داده‌ای در فایل اکسل یافت نشد');
          return;
        }

        for (const row of data) {
          const getString = (val: any) => (val !== undefined && val !== null) ? String(val).trim() : '';

          const name = getString(row['نام و نام خانوادگی'] ?? row['نام'] ?? row.Name ?? row.name) || 'نامشخص';
          const nationalId = getString(row['کد ملی'] ?? row.NationalId ?? row.nationalId);
          const phoneNumber = getString(row['شماره تماس'] ?? row['تلفن'] ?? row.Phone ?? row.phone);
          const grade = getString(row['پایه تحصیلی'] ?? row['پایه'] ?? row.Grade ?? row.grade);
          const fatherOccupation = getString(row['شغل پدر'] ?? row.FatherOccupation);
          const birthPlace = getString(row['اهل کجاست'] ?? row['محل تولد'] ?? row.BirthPlace);
          const birthDate = getString(row['تاریخ تولد'] ?? row.BirthDate);
          
          const rawMarital = getString(row['وضعیت تاهل'] ?? row.MaritalStatus);
          const maritalStatus = (rawMarital === 'متاهل' || rawMarital === 'متأهل') ? 'متاهل' : 'مجرد';
          
          const rawChildren = row['تعداد فرزندان'] ?? row.ChildrenCount;
          const childrenCount = (rawChildren !== undefined && rawChildren !== null && !isNaN(Number(rawChildren))) ? Number(rawChildren) : 0;
          
          const rawLiving = getString(row['سکونت'] ?? row.LivingStatus);
          let livingStatus: any = 'پدری';
          if (['خوابگاه', 'اجاره ای', 'شخصی', 'پدری', 'سایر'].includes(rawLiving)) {
            livingStatus = rawLiving;
          } else if (rawLiving.includes('خوابگاه')) {
            livingStatus = 'خوابگاه';
          } else if (rawLiving.includes('اجاره')) {
            livingStatus = 'اجاره ای';
          } else if (rawLiving.includes('شخصی')) {
            livingStatus = 'شخصی';
          }

          const classicEducation = getString(row['تحصیلات کلاسیک'] ?? row.ClassicEducation);
          const howzaEntryYear = getString(row['سال ورود به حوزه'] ?? row.HowzaEntryYear);
          const instituteEntryYear = getString(row['سال ورود به موسسه'] ?? row.InstituteEntryYear);
          const levelOneSchool = getString(row['مدرسه سطح یک'] ?? row.LevelOneSchool);
          
          const rawTammom = getString(row['وضعیت تعمم'] ?? row.TammomStatus);
          let tammomStatus: any = 'غیر معمم';
          if (['معمم', 'غیر معمم', 'در شرف تعمم'].includes(rawTammom)) {
            tammomStatus = rawTammom;
          }

          const rawStatus = row['وضعیت حضور'] ?? row['وضعیت'] ?? row.IsActive ?? row.isActive;
          let isActive = true;
          if (rawStatus !== undefined && rawStatus !== null) {
            if (typeof rawStatus === 'boolean') {
              isActive = rawStatus;
            } else {
              const strStatus = String(rawStatus).trim().toLowerCase();
              if (strStatus.includes('غیر') || strStatus === 'false' || strStatus === '0') {
                isActive = false;
              }
            }
          }

          const deactivationReason = getString(row['علت غیرفعال بودن'] ?? row.DeactivationReason ?? row.deactivationReason);
          const managementCenterCode = getString(row['کد مرکز مدیریت'] ?? row.ManagementCenterCode ?? row.managementCenterCode);
          const instituteCode = getString(row['کد موسسه'] ?? row.InstituteCode ?? row.instituteCode);
          const servicesCenterCode = getString(row['کد مرکز خدمات'] ?? row.ServicesCenterCode ?? row.servicesCenterCode);
          const tuitionCode = getString(row['کد شهریه'] ?? row.TuitionCode ?? row.tuitionCode);
          const bankName1 = getString(row['بانک ۱'] ?? row.BankName1 ?? row.bankName1);
          const bankAccount1 = getString(row['شماره حساب ۱'] ?? row.BankAccount1 ?? row.bankAccount1);
          const bankSheba1 = getString(row['شماره شبا ۱'] ?? row.BankSheba1 ?? row.bankSheba1);
          const bankName2 = getString(row['بانک ۲'] ?? row.BankName2 ?? row.bankName2);
          const bankAccount2 = getString(row['شماره حساب ۲'] ?? row.BankAccount2 ?? row.bankAccount2);
          const bankSheba2 = getString(row['شماره شبا ۲'] ?? row.BankSheba2 ?? row.bankSheba2);

          await localDb.addDoc('students', {
            name,
            nationalId,
            phoneNumber,
            grade,
            fatherOccupation,
            birthPlace,
            birthDate,
            maritalStatus,
            childrenCount,
            livingStatus,
            classicEducation,
            howzaEntryYear,
            instituteEntryYear,
            levelOneSchool,
            tammomStatus,
            isActive,
            deactivationReason: !isActive ? (deactivationReason || 'صرفا غیر فعال') : undefined,
            managementCenterCode,
            instituteCode,
            servicesCenterCode,
            tuitionCode,
            bankName1,
            bankAccount1,
            bankSheba1,
            bankName2,
            bankAccount2,
            bankSheba2,
            createdAt: new Date().toISOString()
          });
        }
        fetchStudents();
        alert('اطلاعات فایل اکسل با موفقیت وارد شد');
      } catch (error) {
        console.error("Error importing excel:", error);
        alert('خطا در خواندن یا ثبت اطلاعات فایل اکسل');
      } finally {
        if (e.target) {
          e.target.value = '';
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Extract unique grades dynamically
  const availableGrades = Array.from(
    new Set(students.map(s => s.grade).filter(Boolean))
  ).sort((a, b) => String(a || '').localeCompare(String(b || ''), 'fa', { numeric: true }));

  // Handle column header click for sorting
  const handleSort = (columnId: string) => {
    if (sortBy === columnId) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnId);
      setSortOrder('asc');
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setGradeFilter('all');
    setLivingFilter('all');
    setMaritalFilter('all');
    setSortBy('grade');
    setSortOrder('asc');
  };

  const activeFilterCount = (gradeFilter !== 'all' ? 1 : 0) +
    (livingFilter !== 'all' ? 1 : 0) +
    (maritalFilter !== 'all' ? 1 : 0) +
    (searchTerm ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  const mentorFilteredStudents = filterStudents(students, onlyActive);

  const filteredStudents = mentorFilteredStudents
    .filter(s => {
      const matchesSearch = 
        !searchTerm ||
        s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.nationalId?.includes(searchTerm) ||
        s.phoneNumber?.includes(searchTerm) ||
        s.managementCenterCode?.includes(searchTerm) ||
        s.instituteCode?.includes(searchTerm) ||
        s.servicesCenterCode?.includes(searchTerm) ||
        s.tuitionCode?.includes(searchTerm);

      const matchesGrade = gradeFilter === 'all' || s.grade === gradeFilter;

      const matchesLiving = 
        livingFilter === 'all' ? true :
        livingFilter === 'خوابگاه' ? s.livingStatus === 'خوابگاه' :
        livingFilter === 'غیرخوابگاه' ? s.livingStatus !== 'خوابگاه' :
        s.livingStatus === livingFilter;

      const matchesMarital = maritalFilter === 'all' || s.maritalStatus === maritalFilter;

      const isAct = isStudentActive(s.isActive);
      const matchesStatus = 
        statusFilter === 'all' ? (hideInactive ? isAct : true) :
        statusFilter === 'active' ? isAct :
        !isAct;

      const matchesInactiveReason = 
        !isAct && statusFilter === 'inactive' && inactiveReasonFilter !== 'all'
          ? (s.deactivationReason || 'صرفا غیر فعال') === inactiveReasonFilter
          : true;

      return matchesSearch && matchesGrade && matchesLiving && matchesMarital && matchesStatus && matchesInactiveReason;
    })
    .sort((a, b) => {
      // In 'all' view, always keep active students before inactive students by default
      const actA = isStudentActive(a.isActive) ? 1 : 0;
      const actB = isStudentActive(b.isActive) ? 1 : 0;

      if (statusFilter === 'all' && actA !== actB) {
        return actB - actA; // 1 (active) comes before 0 (inactive)
      }

      let cmp = 0;
      if (sortBy === 'grade') {
        const gA = a.grade || '99';
        const gB = b.grade || '99';
        cmp = gA.localeCompare(gB, 'fa', { numeric: true });
      } else if (sortBy === 'name') {
        cmp = (a.name || '').localeCompare(b.name || '', 'fa');
      } else if (sortBy === 'maritalStatus') {
        cmp = (a.maritalStatus || '').localeCompare(b.maritalStatus || '', 'fa');
      } else if (sortBy === 'livingStatus') {
        cmp = (a.livingStatus || '').localeCompare(b.livingStatus || '', 'fa');
      } else if (sortBy === 'childrenCount') {
        cmp = (a.childrenCount || 0) - (b.childrenCount || 0);
      } else if (sortBy === 'tammomStatus') {
        cmp = (a.tammomStatus || '').localeCompare(b.tammomStatus || '', 'fa');
      } else if (sortBy === 'isActive') {
        const actA = isStudentActive(a.isActive) ? 1 : 0;
        const actB = isStudentActive(b.isActive) ? 1 : 0;
        cmp = actB - actA;
      } else if (sortBy === 'deactivationReason') {
        cmp = (a.deactivationReason || '').localeCompare(b.deactivationReason || '', 'fa');
      } else if (sortBy === 'nationalId') {
        cmp = (a.nationalId || '').localeCompare(b.nationalId || '');
      } else if (sortBy === 'managementCenterCode') {
        cmp = (a.managementCenterCode || '').localeCompare(b.managementCenterCode || '');
      }

      if (cmp === 0) {
        cmp = (a.name || '').localeCompare(b.name || '', 'fa');
      }

      return sortOrder === 'asc' ? cmp : -cmp;
    });

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-black text-slate-800">
              {onlyActive ? 'لیست طلاب و کاربران فعال' : 'مدیریت کل کاربران (بانک طلاب حاضر و سابق مدرسه)'}
            </h2>
            <div className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5", currentMentor.badgeBg, currentMentor.badgeText, currentMentor.badgeBorder)}>
              <span className={cn("w-2 h-2 rounded-full", currentMentor.dotColor)}></span>
              <span>{currentMentor.name} ({currentMentor.gradeLabel})</span>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            {onlyActive 
              ? `فهرست طلاب حاضر در مدرسه دارای حساب کاربری فعال (${filteredStudents.length} طلبه فعال)` 
              : `بانک جامع اطلاعاتی طلاب؛ تنها طلاب حاضر دارای کاربری و اجازه ورود به سامانه هستند و کلیه سوابق طلاب سابق به طور کامل محفوظ است.`}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="جستجوی نام، کد ملی یا شماره..." 
              className="pr-9 pl-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none w-64 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {isAuthorizedToManage && (
            <button 
              onClick={() => { resetForm(); setShowAddModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
            >
              <Plus size={16} />
              <span>افزودن طلبه جدید</span>
            </button>
          )}
          
          <button 
            onClick={handleExcelExport}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
          >
            <FileSpreadsheet size={16} />
            <span>خروجی اکسل</span>
          </button>

          {!onlyActive && (
            <>
              {isAuthorizedToManage && (
                <label className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors cursor-pointer shadow-sm">
                  <FileSpreadsheet size={16} />
                  <span>وارد کردن اکسل</span>
                  <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleExcelImport} />
                </label>
              )}

              {isAuthorizedToManage && (
                <button 
                  onClick={handleOpenDuplicateModal}
                  className="flex items-center gap-2 px-4 py-2 border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:border-amber-400 text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
                  title="شناسایی طلاب تکراری بر اساس کد ملی، ادغام کامل سوابق و حذف پرونده‌های تکراری"
                >
                  <GitMerge size={16} className="text-amber-700" />
                  <span>حذف کاربر تکراری</span>
                </button>
              )}

              {isAuthorizedToManage && students.length > 0 && (
                <button 
                  onClick={() => setShowDeleteAllModal(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:border-rose-300 text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
                  title="حذف کامل تمامی کاربران"
                >
                  <Trash2 size={16} />
                  <span>حذف همه کاربران</span>
                </button>
              )}
            </>
          )}

          <div className="relative">
            <button 
              onClick={() => setShowColumnFilter(!showColumnFilter)}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Settings2 size={16} />
              <span>فیلتر ستون‌ها</span>
              <ChevronDown size={14} className={cn("transition-transform", showColumnFilter && "rotate-180")} />
            </button>

            <AnimatePresence>
              {showColumnFilter && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute left-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-2 overflow-hidden"
                >
                  <div className="max-h-[300px] overflow-y-auto pr-1">
                    {allColumns.map(col => (
                      <label key={col.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                          checked={visibleColumns.includes(col.id)}
                          onChange={() => toggleColumn(col.id)}
                        />
                        <span className="text-[11px] font-bold text-slate-600">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Bank Status Filter Switcher: All | Present (Active) | Former (Inactive) */}
      {!onlyActive && (
        <div className="bg-slate-100/90 p-2 rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => { setStatusFilter('all'); setInactiveReasonFilter('all'); }}
              className={cn(
                "px-3.5 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-2",
                statusFilter === 'all'
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              )}
            >
              <Users size={15} className="text-indigo-600" />
              <span>همه طلاب (بانک جامع: حاضر و سابق)</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 font-mono font-bold text-slate-700">
                {students.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setStatusFilter('active'); setInactiveReasonFilter('all'); }}
              className={cn(
                "px-3.5 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-2",
                statusFilter === 'active'
                  ? "bg-white text-emerald-900 shadow-xs border border-emerald-300"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              )}
            >
              <CheckCircle size={15} className="text-emerald-600" />
              <span>طلاب حاضر مدرسه (دارای کاربری فعال)</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-100 font-mono font-bold text-emerald-800">
                {students.filter(s => isStudentActive(s.isActive)).length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('inactive')}
              className={cn(
                "px-3.5 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-2",
                statusFilter === 'inactive'
                  ? "bg-white text-slate-900 shadow-xs border border-slate-300"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              )}
            >
              <UserX size={15} className="text-slate-500" />
              <span>طلاب سابق مدرسه (غیرفعال / بدون دسترسی)</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-200 font-mono font-bold text-slate-800">
                {students.filter(s => !isStudentActive(s.isActive)).length}
              </span>
            </button>
          </div>

          {/* Toggle for hideInactive in 'all' view */}
          {statusFilter === 'all' && (
            <label className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer shadow-2xs hover:bg-slate-50 transition-colors">
              <input 
                type="checkbox" 
                checked={hideInactive} 
                onChange={(e) => setHideInactive(e.target.checked)} 
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" 
              />
              <span>عدم نمایش طلاب سابق (غیرفعال)</span>
            </label>
          )}

          {/* Sub-filters for Inactive reasons when inactive is selected */}
          {statusFilter === 'inactive' && (
            <div className="flex items-center gap-1.5 flex-wrap bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 ml-1">علت غیرفعال بودن:</span>
              {(['all', 'صرفا غیر فعال', 'فارغ التحصیل', 'انتقال اختیاری از مجموعه', 'قطع همکاری از مجموعه'] as const).map(reason => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setInactiveReasonFilter(reason)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer",
                    inactiveReasonFilter === reason
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {reason === 'all' ? 'همه علل' : reason}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filter & Sort Bar */}
      <div ref={filterRef} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all">
        <div 
          onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          className="p-4 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-50/80 transition-colors select-none"
        >
          <div className="flex items-center gap-2 text-xs font-black text-slate-700">
            <Filter size={15} className="text-indigo-600" />
            <span>فیلتر و مرتب‌سازی لیست</span>
            {hasActiveFilters && (
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full">
                {activeFilterCount} فیلتر فعال
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {hasActiveFilters && (
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  resetFilters();
                }}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-rose-50"
              >
                <RotateCcw size={13} />
                <span>بازنشانی فیلترها</span>
              </button>
            )}
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-slate-100/90 px-3 py-1.5 rounded-lg border border-slate-200/80 hover:bg-slate-200/80 transition-colors">
              <span>{isFilterExpanded ? 'بستن کشو' : 'فیلتر و مرتب‌سازی'}</span>
              <ChevronDown size={14} className={cn("transition-transform duration-200 text-indigo-600", isFilterExpanded && "rotate-180")} />
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isFilterExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-slate-100 bg-slate-50/50 p-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                {/* Grade Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">پایه تحصیلی</label>
                  <select 
                    value={gradeFilter} 
                    onChange={(e) => setGradeFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="all">همه پایه‌ها</option>
                    {availableGrades.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                {/* Living Status Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">وضعیت سکونت / خوابگاه</label>
                  <select 
                    value={livingFilter} 
                    onChange={(e) => setLivingFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="all">همه موارد</option>
                    <option value="خوابگاه">🏢 خوابگاهی</option>
                    <option value="غیرخوابگاه">🏠 غیر خوابگاهی</option>
                    <option value="پدری">پدری</option>
                    <option value="شخصی">شخصی</option>
                    <option value="اجاره ای">اجاره‌ای</option>
                    <option value="سایر">سایر</option>
                  </select>
                </div>

                {/* Marital Status Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">وضعیت تأهل</label>
                  <select 
                    value={maritalFilter} 
                    onChange={(e) => setMaritalFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="all">همه وضعیت‌ها</option>
                    <option value="مجرد">🌱 مجرد</option>
                    <option value="متاهل">💍 متأهل</option>
                  </select>
                </div>

                {/* Sort By Field */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">مرتب‌سازی بر اساس</label>
                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="grade">پایه تحصیلی</option>
                    <option value="name">نام و نام خانوادگی</option>
                    <option value="livingStatus">وضعیت سکونت (خوابگاه)</option>
                    <option value="maritalStatus">وضعیت تأهل</option>
                    <option value="childrenCount">تعداد فرزندان</option>
                    <option value="tammomStatus">وضعیت تعمم</option>
                    <option value="isActive">وضعیت (فعال/غیرفعال)</option>
                    <option value="nationalId">کد ملی</option>
                  </select>
                </div>

                {/* Sort Direction Toggle */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">جهت مرتب‌سازی</label>
                  <button
                    type="button"
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="w-full px-3 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                  >
                    <ArrowUpDown size={14} />
                    <span>{sortOrder === 'asc' ? 'صعودی (الف → ی)' : 'نزولی (ی → الف)'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-right border-collapse min-w-max">
          <thead>
            <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
              {allColumns.filter(c => visibleColumns.includes(c.id)).map(col => {
                const sortableMap: Record<string, string> = {
                  'grade': 'grade',
                  'name': 'name',
                  'nationalId': 'nationalId',
                  'managementCenterCode': 'managementCenterCode',
                  'maritalStatus': 'maritalStatus',
                  'childrenCount': 'childrenCount',
                  'livingStatus': 'livingStatus',
                  'tammomStatus': 'tammomStatus',
                  'isActive': 'isActive',
                  'deactivationReason': 'deactivationReason'
                };
                const sortKey = sortableMap[col.id];
                const isCurrentlySorted = sortKey && sortBy === sortKey;

                return (
                  <th 
                    key={col.id} 
                    onClick={() => sortKey && handleSort(sortKey)}
                    className={cn(
                      "px-6 py-3 text-[11px] font-bold uppercase tracking-wider select-none",
                      sortKey && "cursor-pointer hover:text-indigo-600 transition-colors",
                      col.id === 'actions' && "text-left"
                    )}
                  >
                    <div className={cn("flex items-center gap-1.5", col.id === 'actions' && "justify-end")}>
                      <span>{col.label}</span>
                      {sortKey && (
                        isCurrentlySorted ? (
                          sortOrder === 'asc' ? <ArrowUp size={13} className="text-indigo-600 shrink-0" /> : <ArrowDown size={13} className="text-indigo-600 shrink-0" />
                        ) : (
                          <ArrowUpDown size={12} className="text-slate-300 opacity-50 hover:opacity-100 shrink-0" />
                        )
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-6 py-12 text-center text-slate-400 text-xs">در حال بارگذاری...</td>
              </tr>
            ) : filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-6 py-12 text-center text-slate-400 text-xs italic">هیچ طلبی یافت نشد</td>
              </tr>
            ) : (
              filteredStudents.map((student, index) => (
                <tr 
                  key={student.id} 
                  onClick={() => setViewingStudentSummary(student)}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  title="برای مشاهده خلاصه اطلاعات طلبه کلیک کنید"
                >
                  {visibleColumns.includes('index') && (
                    <td className="px-6 py-4 text-xs font-bold text-slate-400">{index + 1}</td>
                  )}
                  {visibleColumns.includes('grade') && (
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-full border border-slate-200 shrink-0">
                          {student.grade || 'نامشخص'}
                        </span>
                        {(() => {
                          const mInfo = getMentorForStudent(student.grade);
                          if (mInfo) {
                            return (
                              <span className={cn("px-2 py-0.5 text-[10px] font-black rounded-full border flex items-center gap-1 shrink-0", mInfo.badgeBg, mInfo.badgeText, mInfo.badgeBorder)}>
                                <span className={cn("w-1.5 h-1.5 rounded-full", mInfo.dotColor)}></span>
                                <span>{mInfo.name}</span>
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </td>
                  )}
                  {visibleColumns.includes('name') && (
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {student.photoUrl ? (
                          <img 
                            src={student.photoUrl} 
                            alt={student.name} 
                            className="w-9 h-9 rounded-full object-cover border-2 border-indigo-100 shadow-sm shrink-0" 
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 text-indigo-400">
                            <User size={18} />
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-sm">{student.name}</span>
                          {!visibleColumns.includes('phoneNumber') && (
                            <span className="text-[10px] text-slate-400">{student.phoneNumber || 'بدون شماره'}</span>
                          )}
                        </div>
                      </div>
                    </td>
                  )}
                  {visibleColumns.includes('nationalId') && (
                    <td className="px-6 py-4 text-xs font-mono text-slate-600">{student.nationalId || '---'}</td>
                  )}
                  {visibleColumns.includes('managementCenterCode') && (
                    <td className="px-6 py-4 text-xs font-mono text-slate-600">{student.managementCenterCode || '---'}</td>
                  )}
                  {visibleColumns.includes('instituteCode') && (
                    <td className="px-6 py-4 text-xs font-mono text-slate-600">{student.instituteCode || '---'}</td>
                  )}
                  {visibleColumns.includes('servicesCenterCode') && (
                    <td className="px-6 py-4 text-xs font-mono text-slate-600">{student.servicesCenterCode || '---'}</td>
                  )}
                  {visibleColumns.includes('phoneNumber') && (
                    <td className="px-6 py-4 text-xs font-mono text-slate-600">{student.phoneNumber || '---'}</td>
                  )}
                  {visibleColumns.includes('fatherOccupation') && (
                    <td className="px-6 py-4 text-xs text-slate-600">{student.fatherOccupation || '---'}</td>
                  )}
                  {visibleColumns.includes('birthPlace') && (
                    <td className="px-6 py-4 text-xs text-slate-600">{student.birthPlace || '---'}</td>
                  )}
                  {visibleColumns.includes('birthDate') && (
                    <td className="px-6 py-4 text-xs text-slate-600">{student.birthDate || '---'}</td>
                  )}
                  {visibleColumns.includes('maritalStatus') && (
                    <td className="px-6 py-4 text-xs text-slate-600">{student.maritalStatus || '---'}</td>
                  )}
                  {visibleColumns.includes('childrenCount') && (
                    <td className="px-6 py-4 text-xs text-slate-600">{student.childrenCount ?? 0}</td>
                  )}
                  {visibleColumns.includes('livingStatus') && (
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {student.livingStatus}{student.livingStatus === 'سایر' && student.livingStatusOther ? ` (${student.livingStatusOther})` : ''}
                    </td>
                  )}
                  {visibleColumns.includes('classicEducation') && (
                    <td className="px-6 py-4 text-xs text-slate-600">{student.classicEducation || '---'}</td>
                  )}
                  {visibleColumns.includes('howzaEntryYear') && (
                    <td className="px-6 py-4 text-xs text-slate-600">{student.howzaEntryYear || '---'}</td>
                  )}
                  {visibleColumns.includes('instituteEntryYear') && (
                    <td className="px-6 py-4 text-xs text-slate-600">{student.instituteEntryYear || '---'}</td>
                  )}
                  {visibleColumns.includes('levelOneSchool') && (
                    <td className="px-6 py-4 text-xs text-slate-600">{student.levelOneSchool || '---'}</td>
                  )}
                  {visibleColumns.includes('tammomStatus') && (
                    <td className="px-6 py-4 text-xs text-slate-600">{student.tammomStatus || '---'}</td>
                  )}
                  {visibleColumns.includes('tuitionCode') && (
                    <td className="px-6 py-4 text-xs font-mono text-slate-600">{student.tuitionCode || '---'}</td>
                  )}
                  {visibleColumns.includes('deactivationReason') && (
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {!isStudentActive(student.isActive) ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          {student.deactivationReason || 'صرفا غیر فعال'}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[11px]">—</span>
                      )}
                    </td>
                  )}
                  {visibleColumns.includes('isActive') && (
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleActive(student.id, student.isActive);
                        }}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer",
                          isStudentActive(student.isActive) 
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100" 
                            : "bg-slate-100 text-slate-500 border border-slate-300 hover:bg-slate-200"
                        )}
                        title={isStudentActive(student.isActive) ? "طلبه حاضر (کلیک برای غیرفعال‌سازی و ثبت علت)" : "طلبه سابق (کلیک برای فعال‌سازی مجدد)"}
                      >
                        <div className={cn("w-1.5 h-1.5 rounded-full", isStudentActive(student.isActive) ? "bg-emerald-500" : "bg-slate-400")}></div>
                        {isStudentActive(student.isActive) ? 'حاضر (فعال)' : 'سابق (غیرفعال)'}
                      </button>
                    </td>
                  )}
                  {visibleColumns.includes('userStatus') && (
                    <td className="px-6 py-4" onClick={(e) => {
                      e.stopPropagation();
                      const studentUser = getStudentAccount(student);
                      setSelectedStudentForCredentials(student);
                      if (studentUser) {
                        setEditingCredUser(studentUser);
                        setCredUsername(studentUser.username);
                        setCredPassword(studentUser.password || '8411924');
                        setCredName(studentUser.name);
                      } else {
                        setEditingCredUser(null);
                        setCredUsername(student.nationalId || '');
                        setCredPassword(student.phoneNumber || '');
                        setCredName(student.name);
                      }
                    }}>
                      {(() => {
                        const studentUser = getStudentAccount(student);
                        const isStudentAct = isStudentActive(student.isActive);
                        
                        if (!isStudentAct) {
                          return (
                            <span 
                              className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200"
                              title="طلبه غیرفعال اجازه ورود به سامانه را ندارد"
                            >
                              <UserX size={11} className="text-slate-400" />
                              <span>غیرفعال (مسدود)</span>
                            </span>
                          );
                        }

                        return studentUser ? (
                          <button 
                            type="button"
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                            title="مشاهده اطلاعات ورود به سایت"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                            <span>دارای کاربری ({studentUser.username})</span>
                          </button>
                        ) : (
                          <button 
                            type="button"
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                            title="ایجاد نام کاربری و کلمه عبور برای سایت"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                            <span>بدون کاربری</span>
                          </button>
                        );
                      })()}
                    </td>
                  )}
                   {visibleColumns.includes('actions') && (
                    <td className="px-6 py-4 text-left" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                         <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStudentForRecords(student);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-all cursor-pointer"
                          title="مشاهده گزارش جامع سوابق به تفکیک پایه‌ها و جزئیات"
                        >
                          <GraduationCap size={13} />
                          <span>سوابق</span>
                        </button>
                        
                        {isAuthorizedToManage && (
                          <>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(student);
                              }}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                              title="ویرایش اطلاعات"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteStudent(student);
                              }}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                              title="حذف کاربر"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 max-w-4xl w-full shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingStudent ? 'ویرایش اطلاعات طلبه' : 'افزودن طلبه جدید'}
                </h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleAddStudent} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Basic Info */}
                  <div className="space-y-4 col-span-full">
                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-b border-indigo-50 pb-1">اطلاعات پایه و عکس پرسنلی</h4>
                  </div>

                  {/* Photo Upload Section */}
                  <div className="col-span-full bg-indigo-50/40 p-4 rounded-xl border border-indigo-100 flex flex-col md:flex-row items-center gap-4">
                    <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-white border-2 border-indigo-200 shadow-md flex items-center justify-center shrink-0">
                      {newStudent.photoUrl ? (
                        <img src={newStudent.photoUrl} alt="تصویر طلبه" className="w-full h-full object-cover" />
                      ) : (
                        <User size={36} className="text-indigo-300" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2 text-center md:text-right">
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                        <label className="cursor-pointer px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm">
                          <Upload size={14} />
                          <span>انتخاب و آپلود عکس طلبه</span>
                          <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                        </label>
                        {newStudent.photoUrl && (
                          <button
                            type="button"
                            onClick={() => setNewStudent(prev => ({ ...prev, photoUrl: '' }))}
                            className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                          >
                            <Trash2 size={13} />
                            <span>حذف عکس</span>
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        عکس انتخاب‌شده به تصویر پرسنلی طلبه اختصاص می‌یابد و در کلیه گزارش‌ها و صفحات نمایش داده می‌شود.
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">نام و نام خانوادگی <span className="text-rose-500">*</span></label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.name || ''}
                      onChange={(e) => setNewStudent({...newStudent, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">کد ملی</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-left"
                      value={newStudent.nationalId || ''}
                      onChange={(e) => setNewStudent({...newStudent, nationalId: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">شماره تماس</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-left"
                      value={newStudent.phoneNumber || ''}
                      onChange={(e) => setNewStudent({...newStudent, phoneNumber: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">کد مرکز مدیریت</label>
                    <input 
                      type="text" 
                      placeholder="مثال: 981234"
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-left"
                      value={newStudent.managementCenterCode || ''}
                      onChange={(e) => setNewStudent({...newStudent, managementCenterCode: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">کد موسسه</label>
                    <input 
                      type="text" 
                      placeholder="مثال: 104"
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-left"
                      value={newStudent.instituteCode || ''}
                      onChange={(e) => setNewStudent({...newStudent, instituteCode: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">کد مرکز خدمات</label>
                    <input 
                      type="text" 
                      placeholder="مثال: 45678"
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-left"
                      value={newStudent.servicesCenterCode || ''}
                      onChange={(e) => setNewStudent({...newStudent, servicesCenterCode: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">پایه تحصیلی</label>
                    <div className="flex items-center gap-1 mb-1.5">
                      <button
                        type="button"
                        onClick={() => setNewStudent(prev => ({ ...prev, grade: 'پایه 7' }))}
                        className={cn(
                          "px-2 py-0.5 text-[10px] rounded border transition-colors",
                          newStudent.grade?.includes('7') || newStudent.grade?.includes('۷')
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        پایه ۷ (حیاتی)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewStudent(prev => ({ ...prev, grade: 'پایه 8' }))}
                        className={cn(
                          "px-2 py-0.5 text-[10px] rounded border transition-colors",
                          newStudent.grade?.includes('8') || newStudent.grade?.includes('۸')
                            ? "bg-sky-100 text-sky-800 border-sky-300 font-bold"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        پایه ۸ (حسینی)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewStudent(prev => ({ ...prev, grade: 'پایه 9' }))}
                        className={cn(
                          "px-2 py-0.5 text-[10px] rounded border transition-colors",
                          newStudent.grade?.includes('9') || newStudent.grade?.includes('۹')
                            ? "bg-purple-100 text-purple-800 border-purple-300 font-bold"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        پایه ۹ (سلیمانی)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewStudent(prev => ({ ...prev, grade: 'پایه 10' }))}
                        className={cn(
                          "px-2 py-0.5 text-[10px] rounded border transition-colors",
                          newStudent.grade?.includes('10') || newStudent.grade?.includes('۱۰')
                            ? "bg-rose-100 text-rose-800 border-rose-300 font-bold"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        پایه ۱۰ (اسدی)
                      </button>
                    </div>
                    <input 
                      type="text" 
                      placeholder="مثال: پایه 7 یا پایه 10"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.grade || ''}
                      onChange={(e) => setNewStudent({...newStudent, grade: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">وضعیت در سامانه (کاربر فعال / غیرفعال)</label>
                    <select 
                      className="w-full px-3 py-2 text-sm font-bold border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      value={isStudentActive(newStudent.isActive) ? 'active' : 'inactive'}
                      onChange={(e) => {
                        const isAct = e.target.value === 'active';
                        setNewStudent({
                          ...newStudent, 
                          isActive: isAct,
                          deactivationReason: isAct ? undefined : (newStudent.deactivationReason || 'صرفا غیر فعال')
                        });
                      }}
                    >
                      <option value="active">🟢 فعال (در حال تحصیل / حضور در مدرسه)</option>
                      <option value="inactive">⚪ غیرفعال (طلاب سابق / عدم حضور در مدرسه)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">تاریخ تولد</label>
                    <input 
                      type="text" 
                      placeholder="۱۴۰۵/۰۱/۰۱"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.birthDate}
                      onChange={(e) => setNewStudent({...newStudent, birthDate: e.target.value})}
                    />
                  </div>

                  {/* Family & Status */}
                  <div className="space-y-4 col-span-full mt-4">
                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-b border-indigo-50 pb-1">وضعیت خانوادگی، سکونت و اصالت</h4>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">اهل کجاست (محل تولد / اصالت)</label>
                    <input 
                      type="text" 
                      placeholder="مثال: قم / اصفهان / شیراز"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.birthPlace || ''}
                      onChange={(e) => setNewStudent({...newStudent, birthPlace: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">شغل پدر</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.fatherOccupation || ''}
                      onChange={(e) => setNewStudent({...newStudent, fatherOccupation: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">وضعیت تاهل</label>
                    <select 
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.maritalStatus}
                      onChange={(e) => setNewStudent({...newStudent, maritalStatus: e.target.value as any})}
                    >
                      <option value="مجرد">مجرد</option>
                      <option value="متاهل">متاهل</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">تعداد فرزندان</label>
                    <input 
                      type="number" 
                      min="0"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.childrenCount ?? 0}
                      onChange={(e) => setNewStudent({...newStudent, childrenCount: Math.max(0, parseInt(e.target.value) || 0)})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">سکونت</label>
                    <select 
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.livingStatus}
                      onChange={(e) => setNewStudent({...newStudent, livingStatus: e.target.value as any})}
                    >
                      <option value="پدری">پدری</option>
                      <option value="خوابگاه">خوابگاه</option>
                      <option value="اجاره ای">اجاره ای</option>
                      <option value="شخصی">شخصی</option>
                      <option value="سایر">سایر</option>
                    </select>
                  </div>
                  {newStudent.livingStatus === 'سایر' && (
                    <div className="col-span-full">
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">توضیحات سکونت</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        value={newStudent.livingStatusOther}
                        onChange={(e) => setNewStudent({...newStudent, livingStatusOther: e.target.value})}
                      />
                    </div>
                  )}

                  {/* Educational History */}
                  <div className="space-y-4 col-span-full mt-4">
                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-b border-indigo-50 pb-1">سوابق تحصیلی و حوزوی</h4>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">تحصیلات کلاسیک</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.classicEducation || ''}
                      onChange={(e) => setNewStudent({...newStudent, classicEducation: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">سال ورود به حوزه</label>
                    <input 
                      type="text" 
                      placeholder="مثال: 1398"
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-left"
                      value={newStudent.howzaEntryYear || ''}
                      onChange={(e) => setNewStudent({...newStudent, howzaEntryYear: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">سال ورود به موسسه</label>
                    <input 
                      type="text" 
                      placeholder="مثال: 1401"
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-left"
                      value={newStudent.instituteEntryYear || ''}
                      onChange={(e) => setNewStudent({...newStudent, instituteEntryYear: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">مدرسه سطح یک</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.levelOneSchool || ''}
                      onChange={(e) => setNewStudent({...newStudent, levelOneSchool: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">وضعیت تعمم</label>
                    <select 
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.tammomStatus || 'غیر معمم'}
                      onChange={(e) => setNewStudent({...newStudent, tammomStatus: e.target.value as any})}
                    >
                      <option value="معمم">معمم</option>
                      <option value="غیر معمم">غیر معمم</option>
                      <option value="در شرف تعمم">در شرف تعمم</option>
                    </select>
                  </div>

                  {/* If Inactive -> Deactivation reason and notes */}
                  {!isStudentActive(newStudent.isActive) && (
                    <div className="col-span-full bg-amber-50/70 border border-amber-200 rounded-xl p-4 mt-2 space-y-3">
                      <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                        <AlertCircle size={16} className="text-amber-600" />
                        <span>جزئیات غیرفعال‌سازی طلبه (عدم حضور در مدرسه)</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">علت غیرفعال بودن <span className="text-rose-500">*</span></label>
                          <select
                            value={newStudent.deactivationReason || 'صرفا غیر فعال'}
                            onChange={(e) => setNewStudent({ ...newStudent, deactivationReason: e.target.value as any })}
                            className="w-full px-3 py-2 text-sm font-bold border border-amber-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-amber-500"
                          >
                            <option value="صرفا غیر فعال">صرفاً غیرفعال (مرخصی / انصراف موقت)</option>
                            <option value="فارغ التحصیل">فارغ التحصیل</option>
                            <option value="انتقال اختیاری از مجموعه">انتقال اختیاری از مجموعه</option>
                            <option value="قطع همکاری از مجموعه">قطع همکاری از مجموعه</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">تاریخ غیرفعال‌سازی / خروج</label>
                          <input
                            type="text"
                            placeholder="مثال: ۱۴۰۴/۰۶/۳۱"
                            value={newStudent.deactivationDate || ''}
                            onChange={(e) => setNewStudent({ ...newStudent, deactivationDate: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                        <div className="col-span-full">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">یادداشت و توضیحات مدیر آموزش</label>
                          <input
                            type="text"
                            placeholder="توضیحات و مصوبه مربوط به وضعیت طلبه..."
                            value={newStudent.deactivationNotes || ''}
                            onChange={(e) => setNewStudent({ ...newStudent, deactivationNotes: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Financial & Banking Information */}
                  <div className="space-y-4 col-span-full mt-4">
                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-b border-indigo-50 pb-1">اطلاعات شهریه و حساب‌های بانکی</h4>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">کد شهریه</label>
                    <input 
                      type="text" 
                      placeholder="مثال: 12345"
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-left"
                      value={newStudent.tuitionCode || ''}
                      onChange={(e) => setNewStudent({...newStudent, tuitionCode: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">نام بانک (اول)</label>
                    <input 
                      type="text" 
                      placeholder="مثال: بانک ملی / تجارت / رسالت"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.bankName1 || ''}
                      onChange={(e) => setNewStudent({...newStudent, bankName1: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">شماره حساب (اول)</label>
                    <input 
                      type="text" 
                      placeholder="شماره حساب اول"
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-left"
                      value={newStudent.bankAccount1 || ''}
                      onChange={(e) => setNewStudent({...newStudent, bankAccount1: e.target.value})}
                    />
                  </div>
                  <div className="col-span-full">
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">شماره شبا (اول)</label>
                    <input 
                      type="text" 
                      placeholder="IR000000000000000000000000"
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-left uppercase"
                      value={newStudent.bankSheba1 || ''}
                      onChange={(e) => setNewStudent({...newStudent, bankSheba1: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">نام بانک (دوم - اختیاری)</label>
                    <input 
                      type="text" 
                      placeholder="نام بانک دوم"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.bankName2 || ''}
                      onChange={(e) => setNewStudent({...newStudent, bankName2: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">شماره حساب (دوم)</label>
                    <input 
                      type="text" 
                      placeholder="شماره حساب دوم"
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-left"
                      value={newStudent.bankAccount2 || ''}
                      onChange={(e) => setNewStudent({...newStudent, bankAccount2: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">شماره شبا (دوم)</label>
                    <input 
                      type="text" 
                      placeholder="IR..."
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-left uppercase"
                      value={newStudent.bankSheba2 || ''}
                      onChange={(e) => setNewStudent({...newStudent, bankSheba2: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-8 pt-4 border-t border-slate-100">
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                  >
                    {editingStudent ? 'بروزرسانی اطلاعات' : 'تایید و ثبت نهایی'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setShowAddModal(false); resetForm(); }}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    انصراف
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {studentToDelete && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-100"
              dir="rtl"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <div className="p-2.5 bg-rose-50 rounded-xl">
                  <Trash2 size={22} />
                </div>
                <h3 className="text-base font-bold text-slate-800">تایید حذف کاربر</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                آیا از حذف <span className="font-bold text-slate-900">{studentToDelete.name}</span> اطمینان دارید؟ این عمل غیرقابل بازگشت است.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStudentToDelete(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteStudent}
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors shadow-md shadow-rose-200"
                >
                  حذف کاربر
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete All Confirmation Modal */}
      <AnimatePresence>
        {showDeleteAllModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-100 text-right"
              dir="rtl"
            >
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                <Trash2 size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 text-center">حذف همه‌جانبه تمامی کاربران</h3>
              <p className="text-xs text-slate-600 text-center leading-relaxed">
                آیا از حذف کامل تمامی لیست طلاب ({students.length} نفر) اطمینان دارید؟ 
                <br /><strong className="text-rose-600 font-bold">این عملیات تمامی داده‌ها را از دیتابیس پاک کرده و غیرقابل بازگشت است!</strong>
              </p>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteAllModal(false)}
                  disabled={deletingAll}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteAllStudents}
                  disabled={deletingAll}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  {deletingAll ? (
                    <span>در حال پاکسازی...</span>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>بله، پاکسازی همه</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Deduplicate & Merge Users Modal */}
      <AnimatePresence>
        {showDuplicateModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl border border-slate-100 text-right"
              dir="rtl"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center">
                    <GitMerge size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">شناسایی و حذف کاربران تکراری</h3>
                    <p className="text-xs text-slate-500 mt-0.5">ملاک تطابق: یکسان بودن شماره کد ملی</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDuplicateModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <XCircle size={20} />
                </button>
              </div>

              {/* Security Banner */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3 text-emerald-900">
                <ShieldCheck size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold">تضمین عدم حذف و از بین رفتن اطلاعات (Merge Safe):</p>
                  <p className="text-emerald-700 leading-relaxed">
                    سیستم قبل از حذف هر پرونده، تمامی اطلاعات اعم از عکس پرسنلی، نمرات امتحانات شفاهی، کارگاه‌های پژوهشی، حضور و غیاب، سوابق مصاحبه، برنامه‌ها و تکالیف را به پرونده اصلی منتقل و ادغام می‌کند.
                  </p>
                </div>
              </div>

              {/* State 1: Scanning */}
              {isScanningDuplicates ? (
                <div className="py-12 text-center space-y-3">
                  <RefreshCw size={28} className="animate-spin text-indigo-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-600">در حال پایش و تطبیق کدهای ملی طلاب...</p>
                </div>
              ) : mergeResult ? (
                /* State 2: Merge Result Summary */
                <div className="space-y-4 py-2">
                  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-center space-y-2">
                    <CheckCheck size={32} className="text-indigo-600 mx-auto" />
                    <h4 className="text-sm font-bold text-indigo-900">عملیات ادغام و پاکسازی با موفقیت انجام شد</h4>
                    <p className="text-xs text-indigo-700 leading-relaxed">{mergeResult.message}</p>
                  </div>

                  {mergeResult.details.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                      <div className="bg-slate-50 px-3 py-2 font-bold text-slate-700 border-b border-slate-200">
                        جزئیات پرونده‌های ادغام‌شده:
                      </div>
                      <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                        {mergeResult.details.map((d, idx) => (
                          <div key={idx} className="p-3 flex items-center justify-between">
                            <div>
                              <span className="font-bold text-slate-800">{d.primaryStudentName}</span>
                              <span className="text-slate-400 mr-2">(کد ملی: {d.nationalId})</span>
                            </div>
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-[11px] font-bold">
                              {d.removedCount} رکورد تکراری ادغام شد
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowDuplicateModal(false)}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                    >
                      تایید و بازگشت به فهرست کاربران
                    </button>
                  </div>
                </div>
              ) : duplicateGroups.length === 0 ? (
                /* State 3: No duplicates found */
                <div className="py-8 text-center space-y-3">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                    <CheckCircle size={26} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">هیچ کاربر تکراری یافت نشد</h4>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                    کلیه کدهای ملی طلاب در پایگاه داده یکتا هستند و هیچ تداخلی در پرونده‌ها مشاهده نشد.
                  </p>
                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={() => setShowDuplicateModal(false)}
                      className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                    >
                      بستن
                    </button>
                  </div>
                </div>
              ) : (
                /* State 4: Duplicates detected */
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 text-xs">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={18} className="text-amber-600 shrink-0" />
                      <span>
                        تعداد <strong>{duplicateGroups.length}</strong> گروه کاربر با کد ملی یکسان شناسایی شد.
                      </span>
                    </div>
                    <span className="font-bold text-amber-700">
                      مجموعاً {duplicateGroups.reduce((acc, g) => acc + (g.students.length - 1), 0)} رکورد تکراری
                    </span>
                  </div>

                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {duplicateGroups.map((grp, gIdx) => (
                      <div key={gIdx} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60 space-y-2.5">
                        <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-2">
                          <span className="font-bold text-slate-700">کد ملی: {grp.nationalId}</span>
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[11px] font-bold">
                            {grp.students.length} پرونده ثبت‌شده
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {grp.students.map((st, sIdx) => {
                            const isPrimary = st.id === grp.primaryCandidateId;
                            return (
                              <div 
                                key={sIdx} 
                                className={cn(
                                  "p-2.5 rounded-lg text-xs flex items-center justify-between border",
                                  isPrimary 
                                    ? "bg-emerald-50/70 border-emerald-200 text-emerald-900" 
                                    : "bg-white border-slate-200 text-slate-700"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  {st.photoUrl ? (
                                    <img src={st.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-slate-200" />
                                  ) : (
                                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-[10px]">
                                      {st.name?.charAt(0) || 'ط'}
                                    </div>
                                  )}
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold">{st.name}</span>
                                      {st.grade && <span className="text-[11px] text-slate-500">({st.grade})</span>}
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                      {st.phoneNumber ? `همراه: ${st.phoneNumber}` : 'بدون شماره'}
                                      {isStudentActive(st) ? ' • فعال' : ' • غیرفعال'}
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  {isPrimary ? (
                                    <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold flex items-center gap-1">
                                      <CheckCircle size={12} />
                                      پرونده اصلی نگهداری
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded text-[10px] font-bold">
                                      ادغام در پرونده اصلی
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowDuplicateModal(false)}
                      disabled={isMergingDuplicates}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                    >
                      انصراف
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteMergeDuplicates}
                      disabled={isMergingDuplicates}
                      className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    >
                      {isMergingDuplicates ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          <span>در حال ادغام اطلاعات...</span>
                        </>
                      ) : (
                        <>
                          <GitMerge size={16} />
                          <span>ادغام کامل اطلاعات و حذف تکراری‌ها</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Student Read-Only Summary Card Overlay Modal */}
      <AnimatePresence>
        {viewingStudentSummary && (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setViewingStudentSummary(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-xl w-full space-y-4 my-auto"
              dir="rtl"
            >
              {/* Box 1: Student Primary Summary Info */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xl relative overflow-hidden">
                <div className="flex items-start justify-between mb-5 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-4">
                    {viewingStudentSummary.photoUrl ? (
                      <img 
                        src={viewingStudentSummary.photoUrl} 
                        alt={viewingStudentSummary.name} 
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-200 shadow-md shrink-0" 
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center shrink-0 text-indigo-400 shadow-inner">
                        <User size={32} />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-black text-slate-800 leading-tight">
                          {viewingStudentSummary.name}
                        </h3>
                        <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold rounded-full">
                          {viewingStudentSummary.grade || 'نامشخص'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">اطلاعات پرونده طلبه (بدون امکان ویرایش)</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setViewingStudentSummary(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                    title="بستن"
                  >
                    <XCircle size={22} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Photo & Name */}
                  <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                      <User size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">نام و نام خانوادگی</span>
                      <span className="font-bold text-slate-800">{viewingStudentSummary.name}</span>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <Phone size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">شماره همراه</span>
                      <span className="font-bold text-slate-800">{viewingStudentSummary.phoneNumber || 'ثبت نشده'}</span>
                    </div>
                  </div>

                  {/* Marital Status */}
                  <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <Heart size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">وضعیت تاهل</span>
                      <span className="font-bold text-slate-800">
                        {viewingStudentSummary.maritalStatus || 'نامشخص'}
                        {viewingStudentSummary.maritalStatus === 'متاهل' && viewingStudentSummary.childrenCount !== undefined && viewingStudentSummary.childrenCount > 0 ? ` (${viewingStudentSummary.childrenCount} فرزند)` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Living Status */}
                  <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                      <Home size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">وضعیت سکونت</span>
                      <span className="font-bold text-slate-800">
                        {viewingStudentSummary.livingStatus || 'نامشخص'}
                        {viewingStudentSummary.livingStatus === 'سایر' && viewingStudentSummary.livingStatusOther ? ` (${viewingStudentSummary.livingStatusOther})` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Hometown / Birthplace */}
                  <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex items-center gap-3 sm:col-span-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                      <MapPin size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">اهل کجاست</span>
                      <span className="font-bold text-slate-800">{viewingStudentSummary.birthPlace || 'ثبت نشده'}</span>
                    </div>
                  </div>
                </div>
              </div>

               {/* Box 2: Enrolled Lessons / Courses */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xl">
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-5 bg-indigo-600 rounded-full"></div>
                    <h4 className="text-sm font-bold text-slate-800">درس‌هایی که شرکت می‌کند</h4>
                  </div>
                  {(() => {
                    const enrolledProgs = programs.filter(p => enrollments.some(e => e.studentId === viewingStudentSummary.id && e.programId === p.id));
                    return (
                      <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-bold rounded-full">
                        {enrolledProgs.length} درس ثبت‌شده
                      </span>
                    );
                  })()}
                </div>

                {(() => {
                  const enrolledProgs = programs.filter(p => enrollments.some(e => e.studentId === viewingStudentSummary.id && e.programId === p.id));
                  if (enrolledProgs.length === 0) {
                    return (
                      <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs italic">
                        هیچ درسی برای این طلبه ثبت نشده است.
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
                      {enrolledProgs.map(p => (
                        <div key={p.id} className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-xl transition-colors space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-800 text-xs">{p.title}</span>
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[9px] font-bold rounded-md shrink-0">
                              {p.type || 'اصلی'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
                            {p.teacher && <span>استاد: {p.teacher}</span>}
                            {(p.day || p.time) && <span>{p.day} {p.time}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Student Site Login Credentials Modal */}
      <AnimatePresence>
        {selectedStudentForCredentials && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 shadow-2xl space-y-5"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <KeyRound size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      حساب کاربری سایت: {selectedStudentForCredentials.name}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium">
                      پایه: {selectedStudentForCredentials.grade || 'نامشخص'}
                    </p>
                  </div>
                </div>
              </div>

              {editingCredUser ? (
                <div className="bg-emerald-50 text-emerald-800 p-3 rounded-2xl border border-emerald-100 text-xs font-bold flex items-center gap-2">
                  <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                  <span>این طلبه هم‌اکنون دارای حساب کاربری فعال در سامانه است.</span>
                </div>
              ) : (
                <div className="bg-rose-50 text-rose-800 p-3 rounded-2xl border border-rose-100 text-xs font-bold space-y-2.5">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-rose-600 shrink-0" />
                    <span>این طلبه هنوز نام کاربری و کلمه عبوری برای ورود به سایت ندارد.</span>
                  </div>
                  {isAuthorizedToManage && (
                    <p className="text-[10px] text-rose-700/90 font-medium leading-relaxed">
                      سیستم به طور پیش‌فرض کدملی ثبت شده برای طلبه را به عنوان نام کاربری و شماره موبایل ثبت شده در نرم افزار را به عنوان رمز عبور پیشنهاد می‌دهد.
                    </p>
                  )}
                </div>
              )}

              <form onSubmit={handleSaveCredentials} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نام کاربری</label>
                  <input
                    type="text"
                    value={credUsername}
                    onChange={(e) => setCredUsername(e.target.value)}
                    disabled={!isAuthorizedToManage}
                    placeholder="بدون کدملی (کدملی را در پرونده ثبت کنید)"
                    required
                    dir="ltr"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-950 focus:outline-none focus:bg-white focus:border-indigo-500 text-right uppercase disabled:opacity-75 disabled:bg-slate-100"
                  />
                  {!editingCredUser && isAuthorizedToManage && !selectedStudentForCredentials.nationalId && (
                    <p className="text-[9px] text-rose-600 mt-1 font-bold">هشدار: کدملی این طلبه ثبت نشده است. ابتدا کد ملی را ویرایش کنید یا دستی وارد نمایید.</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">کلمه عبور (رمز)</label>
                    <button
                      type="button"
                      onClick={() => setShowPasswordMap(prev => ({ ...prev, current: !prev.current }))}
                      className="text-[10px] text-indigo-600 font-bold hover:underline"
                    >
                      {showPasswordMap.current ? 'مخفی کردن' : 'نمایش رمز'}
                    </button>
                  </div>
                  <input
                    type={showPasswordMap.current ? 'text' : 'password'}
                    value={credPassword}
                    onChange={(e) => setCredPassword(e.target.value)}
                    disabled={!isAuthorizedToManage}
                    placeholder="بدون شماره موبایل (موبایل را در پرونده ثبت کنید)"
                    required
                    dir="ltr"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-950 focus:outline-none focus:bg-white focus:border-indigo-500 text-right disabled:opacity-75 disabled:bg-slate-100"
                  />
                  {!editingCredUser && isAuthorizedToManage && !selectedStudentForCredentials.phoneNumber && (
                    <p className="text-[9px] text-rose-600 mt-1 font-bold">هشدار: شماره همراه این طلبه ثبت نشده است. ابتدا شماره همراه را ویرایش کنید یا دستی وارد نمایید.</p>
                  )}
                </div>

                {!isAuthorizedToManage && (
                  <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100 flex items-start gap-2">
                    <Lock size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    <span className="text-[10px] text-amber-800 font-bold leading-relaxed">
                      مشاهده فقط‌خواندنی: شما به عنوان کادر مسئول پایه مجاز به تغییر یا تعریف اعتبارنامه‌های کاربران نیستید. جهت تغییر با مدیر آموزش یا سوپر ادمین هماهنگ کنید.
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedStudentForCredentials(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    بستن صفحه
                  </button>
                  {isAuthorizedToManage && (
                    <button
                      type="submit"
                      disabled={!credUsername.trim() || !credPassword.trim()}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                    >
                      {editingCredUser ? 'ذخیره تغییرات' : 'ایجاد حساب کاربری'}
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Deactivation Modal */}
      <DeactivationModal
        isOpen={showDeactivationModal}
        student={studentToDeactivate}
        onClose={() => {
          setShowDeactivationModal(false);
          setStudentToDeactivate(null);
        }}
        onConfirm={handleConfirmDeactivation}
      />

      {/* Student Record & History Modal */}
      <StudentRecordHistoryModal
        isOpen={!!selectedStudentForRecords}
        student={selectedStudentForRecords}
        onClose={() => setSelectedStudentForRecords(null)}
      />
    </div>
  );
}
