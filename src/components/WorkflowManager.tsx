import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { localDb } from '../lib/localDb';
import { 
  WorkflowItem, 
  WorkflowSettings, 
  WorkflowItemType, 
  WorkflowCategory, 
  WorkflowStatus,
  Student, 
  AppModuleId 
} from '../types';
import { 
  GitBranch, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Filter, 
  Search, 
  Settings as SettingsIcon, 
  Plus, 
  UserPlus, 
  BarChart3, 
  BookOpen, 
  UserCheck, 
  Calendar, 
  Shield, 
  Eye, 
  RefreshCw, 
  FileText, 
  Check, 
  X,
  SlidersHorizontal, 
  Layers, 
  Info,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  AlertCircle,
  HelpCircle,
  Sparkles,
  KeyRound,
  GraduationCap,
  Tag,
  RotateCcw
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const WORKFLOW_CATEGORIES: {
  id: WorkflowCategory | 'all';
  label: string;
  topicTitle: string;
  badgeClass: string;
  borderAccent: string;
  bgGradient: string;
  iconBg: string;
  iconColor: string;
  icon: any;
}[] = [
  {
    id: 'all',
    label: 'همه موضوعات',
    topicTitle: 'کلیه امور و فرآیندها',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
    borderAccent: 'border-r-indigo-500',
    bgGradient: 'bg-white',
    iconBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    iconColor: 'text-indigo-600',
    icon: Layers,
  },
  {
    id: 'unexcused_absence_warning',
    label: 'امور انضباطی و غیبت',
    topicTitle: 'امور انضباطی (غیبت غیرموجه)',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    borderAccent: 'border-r-rose-500',
    bgGradient: 'bg-gradient-to-l from-rose-50/40 via-white to-white',
    iconBg: 'bg-rose-100 text-rose-700 border-rose-200',
    iconColor: 'text-rose-600',
    icon: AlertTriangle,
  },
  {
    id: 'study_deficit_warning',
    label: 'افت مطالعه و مباحثه',
    topicTitle: 'امور آموزشی (کنترل و افت مطالعه)',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
    borderAccent: 'border-r-amber-500',
    bgGradient: 'bg-gradient-to-l from-amber-50/40 via-white to-white',
    iconBg: 'bg-amber-100 text-amber-800 border-amber-200',
    iconColor: 'text-amber-600',
    icon: Clock,
  },
  {
    id: 'study_period',
    label: 'دوره‌ها و تقویم آموزشی',
    topicTitle: 'امور آموزشی (دوره‌های تحصیلی)',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    borderAccent: 'border-r-indigo-500',
    bgGradient: 'bg-gradient-to-l from-indigo-50/40 via-white to-white',
    iconBg: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    iconColor: 'text-indigo-600',
    icon: Calendar,
  },
  {
    id: 'student_account_creation',
    label: 'حساب کاربری طلاب',
    topicTitle: 'امور دسترسی و احراز هویت',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    borderAccent: 'border-r-emerald-500',
    bgGradient: 'bg-gradient-to-l from-emerald-50/40 via-white to-white',
    iconBg: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    iconColor: 'text-emerald-600',
    icon: KeyRound,
  },
  {
    id: 'discussion_group_change',
    label: 'حلقه‌ها و گروه‌های مباحثه',
    topicTitle: 'امور مباحثات و حلقه‌های علمی',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
    borderAccent: 'border-r-sky-500',
    bgGradient: 'bg-gradient-to-l from-sky-50/40 via-white to-white',
    iconBg: 'bg-sky-100 text-sky-700 border-sky-200',
    iconColor: 'text-sky-600',
    icon: MessageSquare,
  },
  {
    id: 'general',
    label: 'امور عمومی و اطلاعیه‌ها',
    topicTitle: 'امور عمومی و اطلاعیه‌ها',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
    borderAccent: 'border-r-slate-400',
    bgGradient: 'bg-white',
    iconBg: 'bg-slate-100 text-slate-700 border-slate-200',
    iconColor: 'text-slate-500',
    icon: Info,
  },
];

export const WORKFLOW_GRADES = [
  { id: 'all', label: 'همه پایه‌ها' },
  { id: 'پایه ۷', label: 'پایه ۷' },
  { id: 'پایه ۸', label: 'پایه ۸' },
  { id: 'پایه ۹', label: 'پایه ۹' },
  { id: 'پایه ۱۰', label: 'پایه ۱۰' },
  { id: 'پایه ۱۱', label: 'پایه ۱۱' },
  { id: 'عمومی', label: 'عمومی و مشترک' },
];

interface WorkflowManagerProps {
  onNavigate?: (tab: AppModuleId, params?: Record<string, any>) => void;
}

const DEFAULT_SETTINGS: WorkflowSettings = {
  id: 'default_workflow_settings',
  requireEducationApprovalForAttendanceWarning: true,
  requireEducationApprovalForStudyWarning: true,
  requireAccountCreationPrompt: true,
  notifyGradeSupervisorOnWarning: true,
  notifyOnStudyPeriodOpened: true,
  notifyOnStudyPeriodClosed: true,
  updatedAt: new Date().toISOString()
};

export default function WorkflowManager({ onNavigate }: WorkflowManagerProps) {
  const { currentUser, users, addUser } = useAuth();

  // Primary states
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [settings, setSettings] = useState<WorkflowSettings>(DEFAULT_SETTINGS);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [tabFilter, setTabFilter] = useState<'my_tasks' | 'all' | 'pending' | 'reports' | 'notices'>('my_tasks');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Panels
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);
  const [rejectionModalItem, setRejectionModalItem] = useState<WorkflowItem | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  
  // Student Account Creation Modal
  const [accountCreationStudent, setAccountCreationStudent] = useState<Student | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('123456');
  const [newRole, setNewRole] = useState<'student' | 'class_representative'>('student');
  const [accountCreationError, setAccountCreationError] = useState('');
  const [accountCreationSuccess, setAccountCreationSuccess] = useState(false);

  // New Event Form
  const [newEventCategory, setNewEventCategory] = useState<WorkflowCategory>('study_period');
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventGrade, setNewEventGrade] = useState('همه پایه‌ها');
  const [newPeriodRange, setNewPeriodRange] = useState('');
  const [selectedStudentForEvent, setSelectedStudentForEvent] = useState<string>('');

  // Role permissions
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isEducationManager = 
    currentUser?.role === 'education_manager' || 
    currentUser?.role === 'education_officer' || 
    currentUser?.username?.toUpperCase() === 'SHAH';
  const isManagerOrPrincipal = currentUser?.role === 'manager_principal' || currentUser?.role === 'vice_principal';
  const isGradeSupervisor = currentUser?.role === 'grade_supervisor';
  const userGrade = currentUser?.gradeLabel || '';

  // Can approve/reject items
  const canApprove = isSuperAdmin || isEducationManager;
  // Can modify workflow settings
  const canManageSettings = isSuperAdmin || isEducationManager;

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [wfItems, wfSettingsList, studentList] = await Promise.all([
        localDb.getDocs<WorkflowItem>('workflow_items'),
        localDb.getDocs<WorkflowSettings>('workflow_settings'),
        localDb.getDocs<Student>('students')
      ]);

      setItems(wfItems || []);
      if (wfSettingsList && wfSettingsList.length > 0) {
        setSettings(wfSettingsList[0]);
      }
      setStudents(studentList || []);
    } catch (err) {
      console.error('Error fetching workflow data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const unsub = localDb.subscribe(() => {
      fetchData();
    });
    return () => unsub();
  }, []);

  // Compute unlinked students (students without user credentials)
  const studentsWithoutAccounts = useMemo(() => {
    if (!settings.requireAccountCreationPrompt) return [];
    return students.filter(student => {
      const hasAccount = users.some(u => 
        (u.linkedStudentId && String(u.linkedStudentId) === String(student.id)) ||
        (u.studentId && String(u.studentId) === String(student.id)) ||
        (student.nationalId && u.username === student.nationalId.trim())
      );
      return !hasAccount && student.isActive;
    });
  }, [students, users, settings.requireAccountCreationPrompt]);

  // Combined Workflow Items including dynamic student account prompts
  const allDisplayItems = useMemo(() => {
    const list: WorkflowItem[] = [...items];

    // If account creation prompt is enabled, inject pending student account items for Education Manager & Super Admin
    if ((isSuperAdmin || isEducationManager) && settings.requireAccountCreationPrompt) {
      studentsWithoutAccounts.forEach(stu => {
        // Only if not already present in list
        const alreadyInWf = list.some(item => 
          item.category === 'student_account_creation' && 
          item.studentId === stu.id && 
          item.status === 'pending'
        );
        if (!alreadyInWf) {
          list.push({
            id: `account_prompt_${stu.id}`,
            type: 'approval',
            category: 'student_account_creation',
            title: `ثبت طلبه جدید فاقد حساب کاربری: ${stu.name}`,
            description: `مشخصات طلبه ${stu.name} (${stu.grade || 'پایه نامشخص'}) در سامانه ثبت شده اما هنوز نام کاربری و دسترسی ورود برای وی تعریف نگردیده است. آیا برای این طلبه نام کاربری ایجاد شود؟`,
            status: 'pending',
            grade: stu.grade || 'همه پایه‌ها',
            studentId: stu.id,
            studentName: stu.name,
            nationalId: stu.nationalId,
            requiresEducationApproval: true,
            createdAt: stu.createdAt || new Date().toISOString()
          });
        }
      });
    }

    // Sort by createdAt descending
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [items, studentsWithoutAccounts, isSuperAdmin, isEducationManager, settings.requireAccountCreationPrompt]);

  // Filter items tailored to current user
  const filteredItems = useMemo(() => {
    return allDisplayItems.filter(item => {
      // 1. Role / User Tailoring (مطالبی که نشون داده میشه برای هر کاربر متفاوت بشه)
      if (tabFilter === 'my_tasks') {
        if (isSuperAdmin) {
          // Super admin sees all actionable or important items
          // Keep all
        } else if (isEducationManager) {
          // Education manager sees all approval items, study periods, and academic warnings
          // All relevant to education
        } else if (isGradeSupervisor) {
          // Grade supervisor sees:
          // a) notices for all grades or their own grade
          // b) warnings/approvals concerning students of their own grade
          const matchesGrade = !item.grade || item.grade === 'همه پایه‌ها' || item.grade === userGrade;
          if (!matchesGrade) return false;
        } else if (isManagerOrPrincipal) {
          // Principal sees all as overview
        }
      }

      // 2. Tab Filter
      if (tabFilter === 'pending') {
        if (item.status !== 'pending') return false;
      } else if (tabFilter === 'reports') {
        if (item.type !== 'report_notice' && !item.reportAction) return false;
      } else if (tabFilter === 'notices') {
        if (item.type !== 'notice') return false;
      }

      // 3. Category Filter
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }

      // 4. Grade Filter
      if (gradeFilter !== 'all') {
        if (gradeFilter === 'عمومی') {
          if (item.grade && item.grade !== 'همه پایه‌ها' && item.grade !== 'عمومی' && item.grade !== 'عمومی و مشترک') {
            return false;
          }
        } else {
          if (item.grade !== gradeFilter && item.grade !== 'همه پایه‌ها') {
            return false;
          }
        }
      }

      // 5. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = 
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          (item.studentName && item.studentName.toLowerCase().includes(q)) ||
          (item.grade && item.grade.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [allDisplayItems, tabFilter, categoryFilter, gradeFilter, searchQuery, isSuperAdmin, isEducationManager, isGradeSupervisor, isManagerOrPrincipal, userGrade]);

  // Counts for Badges & Segmentations
  const pendingCount = useMemo(() => {
    return allDisplayItems.filter(i => i.status === 'pending').length;
  }, [allDisplayItems]);

  const noticesCount = useMemo(() => {
    return allDisplayItems.filter(i => i.type === 'notice').length;
  }, [allDisplayItems]);

  const reportsCount = useMemo(() => {
    return allDisplayItems.filter(i => i.type === 'report_notice' || i.reportAction).length;
  }, [allDisplayItems]);

  const gradeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allDisplayItems.length };
    WORKFLOW_GRADES.forEach(g => {
      if (g.id === 'all') return;
      if (g.id === 'عمومی') {
        counts[g.id] = allDisplayItems.filter(i => !i.grade || i.grade === 'همه پایه‌ها' || i.grade === 'عمومی' || i.grade === 'عمومی و مشترک').length;
      } else {
        counts[g.id] = allDisplayItems.filter(i => i.grade === g.id || i.grade === 'همه پایه‌ها').length;
      }
    });
    return counts;
  }, [allDisplayItems]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allDisplayItems.length };
    WORKFLOW_CATEGORIES.forEach(c => {
      if (c.id === 'all') return;
      counts[c.id] = allDisplayItems.filter(i => i.category === c.id).length;
    });
    return counts;
  }, [allDisplayItems]);

  // Handle Approve
  const handleApprove = async (item: WorkflowItem) => {
    if (item.category === 'student_account_creation' && item.studentId) {
      // Open account creation modal
      const stu = students.find(s => s.id === item.studentId);
      if (stu) {
        handleOpenAccountModal(stu);
      }
      return;
    }

    try {
      // If this is a discussion group change approval, persist the group to database
      if (item.category === 'discussion_group_change' && item.details) {
        const details = item.details;
        const targetGroupId = details.targetGroupId;
        const now = new Date().toISOString();
        
        const groupPayload = {
          title: details.programTitle ? `گروه مباحثه ${details.programTitle}` : (details.title || `گروه مباحثه ${item.studentName}`),
          subject: details.subject || details.programTitle || 'مباحثه درسی',
          grade: details.grade || item.grade || 'پایه ۷',
          programId: details.programId || undefined,
          programTitle: details.programTitle || undefined,
          memberStudentIds: details.memberStudentIds || (item.studentId ? [item.studentId] : []),
          externalMembers: details.externalMembers || [],
          room: details.room || undefined,
          description: details.description || undefined,
          updatedAt: now
        };

        if (targetGroupId) {
          await localDb.updateDoc('discussion_groups', targetGroupId, groupPayload);
        } else {
          await localDb.addDoc('discussion_groups', {
            ...groupPayload,
            id: `group_${Date.now()}_${item.studentId || 'new'}`,
            createdAt: now
          });
        }
      }

      const updated: WorkflowItem = {
        ...item,
        status: 'approved',
        approvedByUserId: currentUser?.id,
        approvedByName: currentUser?.name || currentUser?.roleTitle,
        approvedAt: new Date().toISOString()
      };

      if (item.id.startsWith('account_prompt_')) {
        // Just save to localDb
        await localDb.addDoc('workflow_items', updated);
      } else {
        await localDb.updateDoc('workflow_items', item.id, updated);
      }

      // If settings say notify grade supervisor on approved warning:
      if (
        settings.notifyGradeSupervisorOnWarning && 
        (item.category === 'unexcused_absence_warning' || item.category === 'study_deficit_warning') &&
        item.grade && item.grade !== 'همه پایه‌ها'
      ) {
        const noticeItem: WorkflowItem = {
          id: `notice_grade_${Date.now()}`,
          type: 'report_notice',
          category: item.category,
          title: `ابلاغ اخطار قطعی به مسئول ${item.grade}: ${item.studentName || 'طلبه'}`,
          description: `اخطار ثبت شده برای ${item.studentName || 'طلبه'} در ${item.grade} با تایید نهایی مسئول آموزش قطعی شد و جهت درج در پرونده و اقدامات تربیتی به مسئول محترم پایه ارجاع گردید.`,
          status: 'approved',
          grade: item.grade,
          studentId: item.studentId,
          studentName: item.studentName,
          requiresEducationApproval: false,
          approvedByName: currentUser?.name || 'مسئول آموزش',
          approvedAt: new Date().toISOString(),
          reportAction: {
            label: item.category === 'unexcused_absence_warning' ? 'گزارش حضور و غیاب' : 'گزارش ساعات مطالعه',
            tabTarget: item.category === 'unexcused_absence_warning' ? 'attendance' : 'stats'
          },
          createdAt: new Date().toISOString()
        };
        await localDb.addDoc('workflow_items', noticeItem);
      }

      await fetchData();
    } catch (e) {
      console.error('Error approving workflow item:', e);
    }
  };

  // Handle Reject
  const handleRejectConfirm = async () => {
    if (!rejectionModalItem) return;

    try {
      const updated: WorkflowItem = {
        ...rejectionModalItem,
        status: 'rejected',
        approvedByUserId: currentUser?.id,
        approvedByName: currentUser?.name || currentUser?.roleTitle,
        rejectionReason: rejectionReasonInput.trim() || 'توسط مسئول آموزش تایید نشد.',
        approvedAt: new Date().toISOString()
      };

      if (rejectionModalItem.id.startsWith('account_prompt_')) {
        await localDb.addDoc('workflow_items', updated);
      } else {
        await localDb.updateDoc('workflow_items', rejectionModalItem.id, updated);
      }

      setRejectionModalItem(null);
      setRejectionReasonInput('');
      await fetchData();
    } catch (e) {
      console.error('Error rejecting workflow item:', e);
    }
  };

  // Handle Save Settings
  const handleSaveSettings = async (newSettings: WorkflowSettings) => {
    try {
      await localDb.updateDoc('workflow_settings', newSettings.id, {
        ...newSettings,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.name || currentUser?.username
      });
      setSettings(newSettings);
      setIsSettingsOpen(false);
    } catch (e) {
      console.error('Error updating workflow settings:', e);
    }
  };

  // Handle Open Account Modal
  const handleOpenAccountModal = (stu: Student) => {
    setAccountCreationStudent(stu);
    const suggestedUsername = stu.nationalId && stu.nationalId.trim().length >= 5 
      ? stu.nationalId.trim() 
      : `user_${stu.name.trim().replace(/\s+/g, '_')}`;
    setNewUsername(suggestedUsername);
    setNewPassword('123456');
    setNewRole('student');
    setAccountCreationError('');
    setAccountCreationSuccess(false);
  };

  // Handle Submit Account Creation
  const handleCreateStudentAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountCreationStudent) return;
    if (!newUsername.trim() || !newPassword.trim()) {
      setAccountCreationError('لطفاً نام کاربری و رمز عبور را به صورت کامل وارد کنید.');
      return;
    }

    // Check duplicate username
    const exists = users.some(u => u.username.toLowerCase() === newUsername.trim().toLowerCase());
    if (exists) {
      setAccountCreationError('این نام کاربری قبلاً در سامانه ثبت شده است. لطفاً نام کاربری دیگری انتخاب کنید.');
      return;
    }

    try {
      const newUserRecord = {
        username: newUsername.trim(),
        password: newPassword.trim(),
        fullName: accountCreationStudent.name,
        level: 3 as const,
        role: newRole,
        roleTitle: newRole === 'class_representative' ? 'نماینده کلاس' : 'طلبه',
        scope: (newRole === 'class_representative' ? 'class' : 'self') as any,
        gradeLabel: accountCreationStudent.grade || 'پایه نامشخص',
        linkedStudentId: accountCreationStudent.id,
        isReadOnly: false,
        isActive: true,
        avatarBg: newRole === 'class_representative' ? 'bg-blue-600' : 'bg-emerald-700',
        allowedTabs: newRole === 'class_representative' 
          ? ['attendance', 'student-schedule', 'programs', 'classrooms', 'discussion', 'stats', 'manager-files']
          : ['student-portal', 'student-schedule', 'programs', 'classrooms', 'attendance', 'stats', 'manager-files']
      };

      await addUser(newUserRecord);

      // Mark workflow item as approved
      const wfItem = allDisplayItems.find(i => 
        i.category === 'student_account_creation' && 
        i.studentId === accountCreationStudent.id
      );
      if (wfItem) {
        await localDb.addDoc('workflow_items', {
          ...wfItem,
          id: `account_approved_${accountCreationStudent.id}_${Date.now()}`,
          status: 'approved',
          approvedByUserId: currentUser?.id,
          approvedByName: currentUser?.name || currentUser?.roleTitle,
          approvedAt: new Date().toISOString(),
          description: `حساب کاربری برای طلبه ${accountCreationStudent.name} با نام کاربری @${newUsername.trim()} با موفقیت ایجاد و فعال گردید.`
        });
      }

      setAccountCreationSuccess(true);
      setTimeout(() => {
        setAccountCreationStudent(null);
        setAccountCreationSuccess(false);
      }, 1500);

      await fetchData();
    } catch (err) {
      console.error('Error creating user account for student:', err);
      setAccountCreationError('خطا در ثبت کاربر در پایگاه داده.');
    }
  };

  // Handle Create New Event / Period Announcement
  const handleCreateNewEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim() || !newEventDescription.trim()) return;

    try {
      let type: WorkflowItemType = 'notice';
      let reportAction = undefined;

      if (newEventCategory === 'study_period') {
        type = 'report_notice';
        reportAction = {
          label: 'مشاهده آمار و گزارش مطالعه',
          tabTarget: 'stats' as AppModuleId
        };
      } else if (newEventCategory === 'unexcused_absence_warning') {
        type = settings.requireEducationApprovalForAttendanceWarning ? 'approval' : 'report_notice';
        reportAction = {
          label: 'گزارش حضور و غیاب',
          tabTarget: 'attendance' as AppModuleId
        };
      } else if (newEventCategory === 'study_deficit_warning') {
        type = settings.requireEducationApprovalForStudyWarning ? 'approval' : 'report_notice';
        reportAction = {
          label: 'کارنامه مباحثات و مطالعه',
          tabTarget: 'discussion' as AppModuleId
        };
      }

      const selStu = students.find(s => s.id === selectedStudentForEvent);

      const newItem: WorkflowItem = {
        id: `wf_custom_${Date.now()}`,
        type,
        category: newEventCategory,
        title: newEventTitle.trim(),
        description: newEventDescription.trim(),
        status: type === 'approval' ? 'pending' : 'acknowledged',
        grade: newEventGrade,
        studentId: selStu?.id,
        studentName: selStu?.name,
        dateRange: newPeriodRange.trim() || undefined,
        requiresEducationApproval: type === 'approval',
        reportAction,
        createdByUserId: currentUser?.id,
        createdByName: currentUser?.name || currentUser?.roleTitle,
        createdAt: new Date().toISOString()
      };

      await localDb.addDoc('workflow_items', newItem);
      setIsNewEventModalOpen(false);
      setNewEventTitle('');
      setNewEventDescription('');
      setNewPeriodRange('');
      setSelectedStudentForEvent('');
      await fetchData();
    } catch (err) {
      console.error('Error creating workflow item:', err);
    }
  };

  // Helper for status badge
  const renderStatusBadge = (item: WorkflowItem) => {
    if (item.status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock size={12} className="text-amber-500 animate-pulse" />
          <span>در انتظار تایید</span>
        </span>
      );
    }
    if (item.status === 'approved') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 size={12} className="text-emerald-500" />
          <span>تایید شده</span>
        </span>
      );
    }
    if (item.status === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle size={12} className="text-rose-500" />
          <span>رد شده</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
        <Info size={12} className="text-slate-400" />
        <span>اطلاع‌رسانی شده</span>
      </span>
    );
  };

  // Helper for type badge
  const renderTypeBadge = (item: WorkflowItem) => {
    if (item.type === 'approval') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
          <Shield size={11} className="text-indigo-600" />
          <span>کارتابل تایید نهایی</span>
        </span>
      );
    }
    if (item.type === 'report_notice') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-100">
          <BarChart3 size={11} className="text-sky-600" />
          <span>اطلاعیه با گزارش‌گیری</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-50 text-slate-600 border border-slate-200">
        <Info size={11} className="text-slate-400" />
        <span>صرفاً اطلاع‌رسانی</span>
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 font-vazir" dir="rtl">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <GitBranch size={24} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-black text-slate-900">جریان کار و کارتابل تاییدات</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  سطح ۱ و ۲
                </span>
                {pendingCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                    {pendingCount} مورد در انتظار تایید
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                مدیریت فرآیندها، تایید نهایی اخطارهای غیبت و مطالعه، اطلاع‌رسانی دوره‌ها، بررسی حساب کاربری طلاب و گزینه‌های گزارش‌گیری
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            {canManageSettings && (
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
                title="تنظیمات تاییدات برای مسئول آموزش"
              >
                <SettingsIcon size={15} className="text-slate-500" />
                <span>تنظیمات تاییدات</span>
              </button>
            )}

            {(isSuperAdmin || isEducationManager) && (
              <button
                onClick={() => setIsNewEventModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <Plus size={16} />
                <span>ثبت رویداد جدید</span>
              </button>
            )}
          </div>
        </div>

        {/* User context role strip */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <span className="font-bold text-slate-800">نقش شما:</span>
            <span className="px-2 py-0.5 bg-slate-100 rounded-md font-semibold text-slate-700">
              {currentUser?.roleTitle} ({currentUser?.gradeLabel || 'دسترسی سراسری'})
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500">
              محتوای این بخش به صورت هوشمند بر اساس مسئولیت و پایه شما فیلتر شده است.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 transition-colors p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
              title="بروزرسانی زنده"
            >
              <RefreshCw size={14} className={cn(loading && "animate-spin text-indigo-600")} />
              <span className="text-[11px] font-medium">بروزرسانی</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tabs and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-2xl overflow-x-auto custom-scrollbar shrink-0">
          <button
            onClick={() => setTabFilter('my_tasks')}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
              tabFilter === 'my_tasks' 
                ? "bg-white text-slate-900 shadow-xs" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Layers size={14} />
            <span>مرتبط با من</span>
          </button>

          <button
            onClick={() => setTabFilter('pending')}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
              tabFilter === 'pending' 
                ? "bg-white text-slate-900 shadow-xs" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Clock size={14} className="text-amber-500" />
            <span>در انتظار تایید</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-white">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setTabFilter('reports')}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
              tabFilter === 'reports' 
                ? "bg-white text-slate-900 shadow-xs" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <BarChart3 size={14} className="text-sky-600" />
            <span>گزارش‌گیری‌ها</span>
            <span className="text-[10px] text-slate-400">({reportsCount})</span>
          </button>

          <button
            onClick={() => setTabFilter('notices')}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
              tabFilter === 'notices' 
                ? "bg-white text-slate-900 shadow-xs" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Info size={14} className="text-indigo-600" />
            <span>صرفاً اطلاعیه‌ها</span>
            <span className="text-[10px] text-slate-400">({noticesCount})</span>
          </button>

          <button
            onClick={() => setTabFilter('all')}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
              tabFilter === 'all' 
                ? "bg-white text-slate-900 shadow-xs" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <span>همه موارد</span>
            <span className="text-[10px] text-slate-400">({allDisplayItems.length})</span>
          </button>
        </div>

        {/* Search & Select Filters */}
        <div className="flex items-center gap-2.5 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="جستجو در عناوین، نام طلبه یا توضیحات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500 shadow-2xs"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Grade filter */}
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
          >
            <option value="all">همه پایه‌ها</option>
            <option value="پایه ۷">پایه ۷</option>
            <option value="پایه ۸">پایه ۸</option>
            <option value="پایه ۹">پایه ۹</option>
            <option value="پایه ۱۰">پایه ۱۰</option>
          </select>
        </div>
      </div>

      {/* Dedicated Segmentation Box for Grades and Workflow Topics */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs space-y-4" id="workflow-segmentation-box">
        {/* Top Header of Segmentation Box */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center shrink-0">
              <Filter size={16} />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-800">
                کادر تفکیک و دسته‌بندی جریان کار مدرسه
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                تفکیک دقیق بر اساس پایه‌های تحصیلی و موضوعات کاری با دسترسی فوری
              </p>
            </div>
          </div>
          
          {(gradeFilter !== 'all' || categoryFilter !== 'all') && (
            <button
              onClick={() => {
                setGradeFilter('all');
                setCategoryFilter('all');
              }}
              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1.5 bg-indigo-50/80 hover:bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-100 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <RotateCcw size={12} />
              <span>بازنشانی فیلترهای پایه و موضوع</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* 1. Grade Segmentation Section */}
          <div className="lg:col-span-4 bg-slate-50/70 rounded-2xl p-3.5 border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-black text-slate-800 px-1">
              <span className="flex items-center gap-1.5">
                <GraduationCap size={15} className="text-indigo-600" />
                <span>تفکیک بر اساس پایه‌های تحصیلی:</span>
              </span>
              {gradeFilter !== 'all' && (
                <span className="text-[10px] text-indigo-700 font-bold bg-indigo-100/70 px-2 py-0.5 rounded-md">
                  انتخاب‌شده
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {WORKFLOW_GRADES.map(g => {
                const isSelected = gradeFilter === g.id;
                const count = gradeCounts[g.id] ?? 0;
                return (
                  <button
                    key={g.id}
                    onClick={() => setGradeFilter(g.id)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border",
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-200"
                        : "bg-white text-slate-700 border-slate-200/90 hover:bg-slate-100/90 hover:border-slate-300"
                    )}
                  >
                    <span>{g.label}</span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-md font-mono font-black",
                      isSelected ? "bg-indigo-700 text-white" : "bg-slate-100 text-slate-500"
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Topic / Category Segmentation Section */}
          <div className="lg:col-span-8 bg-slate-50/70 rounded-2xl p-3.5 border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-black text-slate-800 px-1">
              <span className="flex items-center gap-1.5">
                <Tag size={15} className="text-indigo-600" />
                <span>تفکیک بر اساس موضوعات جریان کار:</span>
              </span>
              {categoryFilter !== 'all' && (
                <span className="text-[10px] text-indigo-700 font-bold bg-indigo-100/70 px-2 py-0.5 rounded-md">
                  انتخاب‌شده
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {WORKFLOW_CATEGORIES.map(cat => {
                const isSelected = categoryFilter === cat.id;
                const CatIcon = cat.icon;
                const count = categoryCounts[cat.id] ?? 0;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border",
                      isSelected
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-slate-300"
                        : "bg-white text-slate-700 border-slate-200/90 hover:bg-slate-100/90 hover:border-slate-300"
                    )}
                  >
                    <CatIcon size={13} className={isSelected ? "text-white" : cat.iconColor} />
                    <span>{cat.label}</span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-md font-mono font-black",
                      isSelected ? "bg-slate-800 text-slate-100" : "bg-slate-100 text-slate-500"
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Items List */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <RefreshCw size={28} className="animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-medium">در حال بارگذاری اطلاعات جریان کار...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mx-auto">
            <CheckCircle2 size={28} />
          </div>
          <h3 className="text-sm font-bold text-slate-800">موردی برای نمایش یافت نشد</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            هیچ کار یا اطلاعیه‌ای با فیلترهای انتخابی در کارتابل شما وجود ندارد.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredItems.map((item) => {
            const isItemPending = item.status === 'pending';
            const isAccountPrompt = item.category === 'student_account_creation';
            const isDiscussionChange = item.category === 'discussion_group_change';
            const canUserActOnThis = isItemPending && (
              isSuperAdmin || 
              isEducationManager || 
              (isGradeSupervisor && (!item.grade || item.grade === 'همه پایه‌ها' || item.grade === userGrade))
            );

            const catMeta = WORKFLOW_CATEGORIES.find(c => c.id === item.category) || WORKFLOW_CATEGORIES.find(c => c.id === 'general')!;
            const CatIcon = catMeta.icon;

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={cn(
                  "rounded-2xl p-5 border transition-all duration-200 shadow-xs border-r-4",
                  catMeta.borderAccent,
                  catMeta.bgGradient,
                  isItemPending 
                    ? "border-amber-200/90 hover:border-amber-300 ring-1 ring-amber-200/40" 
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Item Content */}
                  <div className="space-y-2.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Distinct Category Tag */}
                      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-black border shadow-2xs", catMeta.badgeClass)}>
                        <CatIcon size={12} className={catMeta.iconColor} />
                        <span>{catMeta.topicTitle}</span>
                      </span>

                      {renderStatusBadge(item)}
                      {renderTypeBadge(item)}
                      {item.grade && (
                        <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700">
                          {item.grade}
                        </span>
                      )}
                      {item.studentName && (
                        <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700">
                          طلبه: {item.studentName}
                        </span>
                      )}
                      {item.dateRange && (
                        <span className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-emerald-50 text-emerald-700">
                          بازه: {item.dateRange}
                        </span>
                      )}
                    </div>

                    {/* Distinct Title Header with Icon & Prefix */}
                    <div className="flex items-start gap-2.5 pt-0.5">
                      <div className={cn("w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 shadow-2xs", catMeta.iconBg)}>
                        <CatIcon size={14} className={catMeta.iconColor} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-md font-mono border", catMeta.badgeClass)}>
                            [{catMeta.label}]
                          </span>
                          <h3 className="text-sm font-black text-slate-900 leading-snug">
                            {item.title}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed max-w-4xl">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    {/* Specific Details Box if present */}
                    {item.details && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 text-[11px] text-slate-700 flex flex-wrap gap-x-6 gap-y-2 mt-2">
                        {item.category === 'discussion_group_change' ? (
                          <div className="w-full space-y-2">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                              {item.details.programTitle && (
                                <div>
                                  <span className="text-slate-400">درس اصلی: </span>
                                  <span className="font-black text-indigo-700">{item.details.programTitle}</span>
                                </div>
                              )}
                              {item.details.room && (
                                <div>
                                  <span className="text-slate-400">محل مباحثه / مدرس: </span>
                                  <span className="font-bold text-slate-800">{item.details.room}</span>
                                </div>
                              )}
                              {item.details.targetGroupId ? (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md font-bold text-[10px]">
                                  اصلاح و ویرایش گروه قبلی
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[10px]">
                                  ثبت گروه مباحثه جدید
                                </span>
                              )}
                            </div>
                            {item.details.memberStudentNames && item.details.memberStudentNames.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <span className="text-slate-400">اعضای گروه مباحثه: </span>
                                {item.details.memberStudentNames.map((name: string, i: number) => (
                                  <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-800 border border-indigo-100 rounded-md font-bold">
                                    {name}
                                  </span>
                                ))}
                              </div>
                            )}
                            {item.details.externalMembers && item.details.externalMembers.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-slate-400">سایر هم‌بحث‌ها: </span>
                                {item.details.externalMembers.map((name: string, i: number) => (
                                  <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md font-medium">
                                    {name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            {item.details.unexcusedAbsences !== undefined && (
                              <div>
                                <span className="text-slate-400">تعداد جلسات غیبت: </span>
                                <span className="font-bold text-rose-600">{item.details.unexcusedAbsences} جلسه</span>
                              </div>
                            )}
                            {item.details.course && (
                              <div>
                                <span className="text-slate-400">عنوان درس: </span>
                                <span className="font-bold">{item.details.course}</span>
                              </div>
                            )}
                            {item.details.deficitHours !== undefined && (
                              <div>
                                <span className="text-slate-400">میزان کسری ساعت: </span>
                                <span className="font-bold text-rose-600">{item.details.deficitHours} ساعت</span>
                              </div>
                            )}
                            {item.details.loggedHours !== undefined && (
                              <div>
                                <span className="text-slate-400">ساعات ثبت‌شده: </span>
                                <span className="font-bold text-slate-800">{item.details.loggedHours} از {item.details.mandatoryHours} ساعت</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Approval or Rejection Meta */}
                    {item.status === 'approved' && item.approvedByName && (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                        <CheckCircle2 size={12} />
                        <span>تایید نهایی شده توسط: {item.approvedByName}</span>
                        {item.approvedAt && (
                          <span className="text-slate-400 font-normal">
                            ({new Date(item.approvedAt).toLocaleDateString('fa-IR')})
                          </span>
                        )}
                      </div>
                    )}

                    {item.status === 'rejected' && item.rejectionReason && (
                      <div className="flex items-center gap-1.5 text-[11px] text-rose-700 font-medium">
                        <XCircle size={12} />
                        <span>علت رد: {item.rejectionReason}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions Area */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    {/* Actionable Report Options */}
                    {item.reportAction && onNavigate && (
                      <button
                        onClick={() => onNavigate(item.reportAction!.tabTarget, item.reportAction!.filterParams)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-xs font-bold border border-sky-200 transition-colors cursor-pointer"
                        title={item.reportAction.description || 'رفتن به گزارش مربوطه'}
                      >
                        <BarChart3 size={14} />
                        <span>{item.reportAction.label}</span>
                        <ExternalLink size={12} className="opacity-60" />
                      </button>
                    )}

                    {/* Pending Approvals: Approve & Reject buttons */}
                    {canUserActOnThis && (
                      <>
                        {isAccountPrompt ? (
                          <button
                            onClick={() => handleApprove(item)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                          >
                            <UserPlus size={14} />
                            <span>تنظیم و ایجاد نام کاربری</span>
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleApprove(item)}
                              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                              title={isDiscussionChange ? "تایید و اعمال گروه مباحثه" : "تایید نهایی اخطار"}
                            >
                              <Check size={14} />
                              <span>{isDiscussionChange ? "تایید و اعمال گروه مباحثه" : "تایید اخطار"}</span>
                            </button>

                            <button
                              onClick={() => {
                                setRejectionModalItem(item);
                                setRejectionReasonInput('');
                              }}
                              className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold border border-rose-200 transition-all cursor-pointer"
                              title={isDiscussionChange ? "عدم تایید / رد درخواست" : "عدم تایید / رد اخطار"}
                            >
                              <X size={14} />
                              <span>{isDiscussionChange ? "رد درخواست" : "رد اخطار"}</span>
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* Modal 1: Education Officer Approval Settings (تنظیمات تاییدات مسئول آموزش) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-vazir" dir="rtl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                    <SlidersHorizontal size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900">تنظیمات تاییدات مسئول آموزش</h2>
                    <p className="text-xs text-slate-500">تعیین رویه الزامی بودن تایید مسئول آموزش برای اخطارها و وقایع</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* Switch 1: Attendance Warning */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-bold text-slate-800">تایید اخطار غیبت‌های غیرموجه توسط مسئول آموزش</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      در صورت فعال بودن، ثبت نهایی هرگونه اخطار غیبت غیرموجه منوط به تایید مسئول آموزش خواهد بود.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.requireEducationApprovalForAttendanceWarning}
                    onChange={(e) => setSettings({ ...settings, requireEducationApprovalForAttendanceWarning: e.target.checked })}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>

                {/* Switch 2: Study Deficit Warning */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-bold text-slate-800">تایید اخطار کسر ساعت مطالعه و مباحثه توسط مسئول آموزش</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      در صورت فعال بودن، ثبت قطعی اخطار برای کسری ساعات مطالعه منوط به تایید مسئول آموزش است.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.requireEducationApprovalForStudyWarning}
                    onChange={(e) => setSettings({ ...settings, requireEducationApprovalForStudyWarning: e.target.checked })}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>

                {/* Switch 3: Account Creation Prompt */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-bold text-slate-800">پیشنهاد ساخت حساب برای طلاب جدید فاقد حساب</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      ارائه هشدار در کارتابل مسئول آموزش و سوپر ادمین برای طلابی که مشخصاتشان وارد شده اما فاقد نام کاربری هستند.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.requireAccountCreationPrompt}
                    onChange={(e) => setSettings({ ...settings, requireAccountCreationPrompt: e.target.checked })}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>

                {/* Switch 4: Notify Grade Supervisor */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-bold text-slate-800">ارسال خودکار رونوشت اخطار به مسئول پایه</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      پس از تایید قطعی اخطار، اطلاعیه مربوطه به کارتابل مسئول آن پایه نیز ارسال خواهد شد.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifyGradeSupervisorOnWarning}
                    onChange={(e) => setSettings({ ...settings, notifyGradeSupervisorOnWarning: e.target.checked })}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>

                {/* Switch 5: Notify on Study Period Opened */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-bold text-slate-800">اطلاع‌رسانی بازگشایی دوره مطالعه به مسئولین پایه</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      هنگام باز شدن دوره جدید ثبت مطالعه توسط آموزش، برای مسئولین پایه اعلان فرستاده شود.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifyOnStudyPeriodOpened}
                    onChange={(e) => setSettings({ ...settings, notifyOnStudyPeriodOpened: e.target.checked })}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveSettings(settings)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  ذخیره تنظیمات
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* Modal 2: Account Creation for Student (تنظیم نام کاربری برای طلبه) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {accountCreationStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-vazir" dir="rtl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                    <UserPlus size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900">تنظیم نام کاربری و دسترسی</h2>
                    <p className="text-xs text-slate-500">ایجاد حساب کاربری برای {accountCreationStudent.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setAccountCreationStudent(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {accountCreationSuccess ? (
                <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-2">
                  <CheckCircle2 size={32} className="text-emerald-600 mx-auto" />
                  <div className="text-xs font-bold text-emerald-800">حساب کاربری با موفقیت صادر و فعال شد!</div>
                  <div className="text-[11px] text-emerald-600">
                    طلبه اکنون می‌تواند با این نام کاربری و رمز عبور وارد نرم‌افزار شود.
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateStudentAccount} className="space-y-4 text-xs">
                  {accountCreationError && (
                    <div className="p-3 bg-rose-50 text-rose-700 rounded-xl border border-rose-200 flex items-center gap-2 text-[11px]">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{accountCreationError}</span>
                    </div>
                  )}

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-[11px] text-slate-600">
                    <div><span className="font-bold text-slate-800">نام طلبه:</span> {accountCreationStudent.name}</div>
                    <div><span className="font-bold text-slate-800">کد ملی:</span> {accountCreationStudent.nationalId || 'ثبت نشده'}</div>
                    <div><span className="font-bold text-slate-800">پایه تحصیلی:</span> {accountCreationStudent.grade || 'نامشخص'}</div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      نام کاربری (جهت ورود به سامانه)
                    </label>
                    <div className="relative">
                      <KeyRound size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-xl font-mono text-left focus:outline-none focus:border-indigo-500"
                        placeholder="e.g. 1234567890"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      رمز عبور اولیه
                    </label>
                    <input
                      type="text"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-left focus:outline-none focus:border-indigo-500"
                      placeholder="123456"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      نقش کاربری
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 bg-white"
                    >
                      <option value="student">طلبه (مشاهده پرونده و ثبت فعالیت)</option>
                      <option value="class_representative">نماینده کلاس (دسترسی ثبت حضور و غیاب)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setAccountCreationStudent(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      ایجاد و فعال‌سازی حساب
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* Modal 3: Rejection Reason Modal (علت رد اخطار) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {rejectionModalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-vazir" dir="rtl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <XCircle size={20} className="text-rose-600" />
                  <h3 className="text-sm font-black text-slate-900">عدم تایید و رد اخطار</h3>
                </div>
                <button onClick={() => setRejectionModalItem(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-slate-600">
                شما در حال رد اخطار برای <span className="font-bold">{rejectionModalItem.studentName || rejectionModalItem.title}</span> هستید. لطفاً علت عدم تایید را بنویسید:
              </p>

              <textarea
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                rows={3}
                placeholder="مثال: غیبت‌ها موجه بوده و با آموزش هماهنگ شده است..."
                className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-rose-500"
              />

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setRejectionModalItem(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  onClick={handleRejectConfirm}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  ثبت رد اخطار
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* Modal 4: New Workflow Event Modal (ثبت دستی رویداد یا بازگشایی دوره) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isNewEventModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-vazir" dir="rtl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                    <Plus size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900">ثبت رویداد جدید در جریان کار</h2>
                    <p className="text-xs text-slate-500">اطلاع‌رسانی دوره مطالعه، اخطار یا اعلامیه آموزشی</p>
                  </div>
                </div>
                <button onClick={() => setIsNewEventModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateNewEvent} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">نوع رویداد</label>
                  <select
                    value={newEventCategory}
                    onChange={(e) => {
                      const cat = e.target.value as WorkflowCategory;
                      setNewEventCategory(cat);
                      if (cat === 'study_period') {
                        setNewEventTitle('بازگشایی دوره جدید ثبت مطالعه توسط مسئول آموزش');
                        setNewEventDescription('دوره جدید ثبت مطالعه برای همه پایه‌ها ایجاد شد. طلاب و مسئولین محترم پایه می‌توانند ساعات مطالعه و مباحثات را ثبت نمایند.');
                      } else if (cat === 'unexcused_absence_warning') {
                        setNewEventTitle('ثبت اخطار غیبت غیرموجه');
                        setNewEventDescription('ثبت اخطار غیبت غیرموجه نیازمند تایید مسئول آموزش است.');
                      } else if (cat === 'study_deficit_warning') {
                        setNewEventTitle('ثبت اخطار کسر ساعت مطالعه و مباحثه');
                        setNewEventDescription('ثبت اخطار کسر ساعت مطالعه جهت تایید به مسئول آموزش ارجاع می‌گردد.');
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="study_period">دوره مطالعاتی (بازگشایی / بستن دوره مطالعه)</option>
                    <option value="unexcused_absence_warning">اخطار غیبت غیرموجه طلبه</option>
                    <option value="study_deficit_warning">اخطار ساعت مطالعه و مباحثه</option>
                    <option value="general">اطلاعیه و دستور عمومی</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">پایه تحصیلی</label>
                    <select
                      value={newEventGrade}
                      onChange={(e) => setNewEventGrade(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="همه پایه‌ها">همه پایه‌ها</option>
                      <option value="پایه ۷">پایه ۷</option>
                      <option value="پایه ۸">پایه ۸</option>
                      <option value="پایه ۹">پایه ۹</option>
                      <option value="پایه ۱۰">پایه ۱۰</option>
                    </select>
                  </div>

                  {newEventCategory === 'study_period' ? (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1.5">بازه زمانی دوره (شمسی)</label>
                      <input
                        type="text"
                        placeholder="مثال: ۰۱ مهر تا ۱۵ مهر ۱۴۰۳"
                        value={newPeriodRange}
                        onChange={(e) => setNewPeriodRange(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1.5">انتخاب طلبه</label>
                      <select
                        value={selectedStudentForEvent}
                        onChange={(e) => setSelectedStudentForEvent(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">-- انتخاب طلبه --</option>
                        {students.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.grade || 'نامشخص'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">عنوان رویداد</label>
                  <input
                    type="text"
                    required
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                    placeholder="عنوان رویداد را وارد کنید..."
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">شرح کامل پیام و جزئیات</label>
                  <textarea
                    required
                    rows={3}
                    value={newEventDescription}
                    onChange={(e) => setNewEventDescription(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                    placeholder="توضیحات تکمیلی..."
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsNewEventModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                  >
                    ثبت و ابلاغ در جریان کار
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
