import React, { useState, useEffect, useMemo } from 'react';
import { 
  StudentRequest, 
  RequestTargetUnit, 
  StudentRequestStatus, 
  UnitRequestSettings,
  GlobalRequestsConfig,
  RequestMessage,
  LeaveRequestedClass,
  LeaveRequestDetails,
  Program,
  AttendanceSessionLog,
  StudentAttendanceDetail
} from '../types';
import { useAuth } from '../context/AuthContext';
import { localDb } from '../lib/localDb';
import { 
  getTodayShamsi,
  shamsiToDate,
  dateToShamsi,
  getShamsiDayOfWeek,
  SHAMSI_WEEKDAY_NAMES,
  formatShamsiDate,
  parseShamsiDate
} from '../lib/jalali';
import { 
  Inbox, 
  PlusCircle, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertCircle, 
  Send, 
  FileText, 
  Building2, 
  Coins, 
  GraduationCap, 
  BookOpen, 
  Sparkles, 
  ToggleLeft, 
  ToggleRight, 
  MessageSquare, 
  Loader2, 
  ShieldCheck,
  Eye,
  EyeOff,
  RefreshCw,
  X,
  Sliders,
  Check,
  BellRing,
  HelpCircle,
  UserCheck,
  HeartHandshake,
  CheckSquare,
  Settings,
  Trash2,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  CalendarCheck,
  CheckSquare2,
  UserX,
  FileCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export const DEFAULT_GLOBAL_REQUESTS_CONFIG: GlobalRequestsConfig = {
  id: 'global_requests_config',
  isGlobalVisibleForStudents: true,
  isGlobalEnabled: true,
  officersStatus: {
    education: {
      isAccepting: true,
      officerTitle: 'مسئول آموزش و امتحانات',
      officerName: 'استاد شاهپوری',
      statusNote: 'پذیرش انواع گواهی‌ها، مرخصی، تطبیق پایه و امور آموزشی'
    },
    finance: {
      isAccepting: true,
      officerTitle: 'مسئول مالی و کارکرد',
      officerName: 'مسئول مالی و اداری',
      statusNote: 'پذیرش تقاضای وام قرض‌الحسنه، تسویه شهریه و مساعده مالی'
    },
    cultural_welfare: {
      isAccepting: true,
      officerTitle: 'مسئول امور فرهنگی و رفاهی',
      officerName: 'مسئول فرهنگی و رفاهی',
      statusNote: 'پذیرش درخواست‌های کمد، اردوها، غذا و خدمات رفاهی'
    }
  }
};

const DEFAULT_UNIT_SETTINGS: Record<RequestTargetUnit, UnitRequestSettings> = {
  education: {
    id: 'setting_education',
    unit: 'education',
    unitName: 'واحد آموزش و امتحانات',
    isAcceptingRequests: true,
    disabledNoticeMessage: 'پذیرش درخواست‌های آموزشی موقتاً به دلیل بازه امتحانات غیرفعال است.',
    allowedCategories: ['درخواست تغییر کلاس', 'درخواست مرخصی', 'تجدید نظر در ازمون شفاهی']
  },
  finance: {
    id: 'setting_finance',
    unit: 'finance',
    unitName: 'واحد مالی، شهریه و وام‌ها',
    isAcceptingRequests: true,
    disabledNoticeMessage: 'سامانه ثبت درخواست‌های مالی موقتاً در حال محاسبه شهریه ماهانه است.',
    allowedCategories: ['گزارش کسریات شهریه']
  },
  cultural_welfare: {
    id: 'setting_cultural_welfare',
    unit: 'cultural_welfare',
    unitName: 'واحد فرهنگی، رفاهی و کمدها',
    isAcceptingRequests: true,
    disabledNoticeMessage: 'پذیرش درخواست‌های رفاهی موقتاً بسته شده است.',
    allowedCategories: ['سایر']
  }
};

export default function StudentRequestsPortal() {
  const { currentUser, isSuperAdmin } = useAuth();
  const [requests, setRequests] = useState<StudentRequest[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [globalConfig, setGlobalConfig] = useState<GlobalRequestsConfig>(DEFAULT_GLOBAL_REQUESTS_CONFIG);
  const [unitSettings, setUnitSettings] = useState<Record<RequestTargetUnit, UnitRequestSettings>>(DEFAULT_UNIT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Determine Persona
  const isStudentUser = currentUser?.level === 3 || currentUser?.role === 'student' || currentUser?.role === 'class_representative';
  
  // Officer unit specialization
  const isEduOfficer = currentUser?.role === 'education_manager' || currentUser?.username === 'SHAH' || (currentUser?.name && currentUser.name.includes('آموزش'));
  const isFinOfficer = currentUser?.role === 'finance_manager' || currentUser?.username === 'MALI' || (currentUser?.name && currentUser.name.includes('مالی'));
  const isCulturalOfficer = currentUser?.role === 'cultural_manager' || currentUser?.role === 'research_manager' || currentUser?.username === 'YAZDANI';

  // Initial unit tab for officers
  const defaultOfficerUnit: RequestTargetUnit = isEduOfficer ? 'education' : isFinOfficer ? 'finance' : isCulturalOfficer ? 'cultural_welfare' : 'education';
  const [activeUnitTab, setActiveUnitTab] = useState<RequestTargetUnit | 'all' | 'leave_requests'>(isSuperAdmin ? 'all' : defaultOfficerUnit);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Drawers
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [showLeaveRequestModal, setShowLeaveRequestModal] = useState(false);
  const [selectedRequestForReview, setSelectedRequestForReview] = useState<StudentRequest | null>(null);
  const [selectedRequestDetail, setSelectedRequestDetail] = useState<StudentRequest | null>(null);
  const [showSuperAdminSettingsModal, setShowSuperAdminSettingsModal] = useState(false);
  const [showOfficerToggleStatusModal, setShowOfficerToggleStatusModal] = useState(false);
  const [showSubjectSettingsModal, setShowSubjectSettingsModal] = useState(false);
  const [subjectSettingUnit, setSubjectSettingUnit] = useState<RequestTargetUnit>('education');
  const [newSubjectInput, setNewSubjectInput] = useState('');

  // New Standard Request Form State
  const [newUnit, setNewUnit] = useState<RequestTargetUnit>('education');
  const [newCategory, setNewCategory] = useState<string>('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Leave Request Form State (درخواست مرخصی)
  const [weekOffset, setWeekOffset] = useState<number>(0); // 0 = current week, -7 = last week, +7 = next week
  const [leaveAbsenceReason, setLeaveAbsenceReason] = useState('');
  const [selectedClassesForLeave, setSelectedClassesForLeave] = useState<LeaveRequestedClass[]>([]);

  // Officer Review / Leave Approval State
  const [replyStatus, setReplyStatus] = useState<StudentRequestStatus>('in_progress');
  const [officialReply, setOfficialReply] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [leaveClassStatuses, setLeaveClassStatuses] = useState<Record<string, 'approved' | 'rejected'>>({});

  // Followup conversational drafts
  const [followupDrafts, setFollowupDrafts] = useState<Record<string, string>>({});
  const [isSendingFollowup, setIsSendingFollowup] = useState(false);

  // Officer toggle state form
  const [officerNoteDraft, setOfficerNoteDraft] = useState('');

  // Officer Grouping State (لیست طلابی که درخواست داشته‌اند به همراه تفکیک فعال و مختومه)
  const [expandedStudentKey, setExpandedStudentKey] = useState<string | null>(null);
  const [officerStudentSubTab, setOfficerStudentSubTab] = useState<Record<string, 'active' | 'closed'>>({});

  const loadData = async (silent = false) => {
    if (!silent && requests.length === 0) {
      setIsLoading(true);
    }
    try {
      // 1. Load Requests from localDb + Server Direct Fetch
      const [reqList, progsList] = await Promise.all([
        localDb.getDocs<StudentRequest>('student_requests'),
        localDb.getDocs<Program>('programs')
      ]);

      if (Array.isArray(progsList)) {
        setPrograms(progsList);
      }

      let freshRequests = Array.isArray(reqList) ? reqList : [];

      // Direct server query when online to guarantee instant sync across browsers
      try {
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const apiRes = await fetch(`/api/data/student_requests?_t=${Date.now()}`, {
          method: 'GET',
          headers: {
            ...headers,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          },
          cache: 'no-store'
        });

        if (apiRes.ok) {
          const json = await apiRes.json();
          if (json.success && Array.isArray(json.items)) {
            freshRequests = json.items;
            // Mirror server fresh requests into local storage cache
            (localDb as any).setLocalStorageDocs('student_requests', freshRequests);
          }
        }
      } catch (srvErr) {}

      setRequests(prev => {
        if (prev.length === freshRequests.length && JSON.stringify(prev) === JSON.stringify(freshRequests)) {
          return prev;
        }
        return freshRequests;
      });

      // 2. Load Global Config
      const configDoc = await localDb.getDoc<GlobalRequestsConfig>('global_requests_config', 'global_requests_config');
      if (configDoc) {
        setGlobalConfig({
          ...DEFAULT_GLOBAL_REQUESTS_CONFIG,
          ...configDoc,
          officersStatus: {
            ...DEFAULT_GLOBAL_REQUESTS_CONFIG.officersStatus,
            ...(configDoc.officersStatus || {})
          }
        });
      }

      // 3. Load Unit Settings
      const settingsList = await localDb.getDocs<UnitRequestSettings>('unit_request_settings');
      if (Array.isArray(settingsList) && settingsList.length > 0) {
        const map = { ...DEFAULT_UNIT_SETTINGS };
        settingsList.forEach(s => {
          if (s && s.unit) map[s.unit] = s;
        });
        setUnitSettings(map);
      }
    } catch (e) {
      console.warn('Error loading student requests data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial auto-purge of test requests per user request
    const PURGE_KEY = 'purged_all_test_requests_v8';
    if (localStorage.getItem(PURGE_KEY) !== 'true') {
      localDb.getDocs<StudentRequest>('student_requests').then(list => {
        if (Array.isArray(list) && list.length > 0) {
          list.forEach(r => {
            localDb.deleteDoc('student_requests', r.id).catch(() => {});
            fetch(`/api/data/student_requests/${r.id}`, { method: 'DELETE' }).catch(() => {});
          });
          setRequests([]);
          window.dispatchEvent(new CustomEvent('student_requests_updated'));
          window.dispatchEvent(new CustomEvent('app_data_change'));
        }
        localStorage.setItem(PURGE_KEY, 'true');
      }).catch(() => {
        localStorage.setItem(PURGE_KEY, 'true');
      });
    }

    loadData(false);

    // Active polling interval every 4 seconds to guarantee real-time updates across browsers
    const pollTimer = setInterval(() => {
      loadData(true);
    }, 4000);

    // Real-time synchronization subscription
    const unsubscribe = localDb.subscribe(() => {
      loadData(true);
    });

    const handleReqUpdate = () => {
      loadData(true);
    };

    window.addEventListener('student_requests_updated', handleReqUpdate);
    window.addEventListener('app_data_change', handleReqUpdate);

    return () => {
      clearInterval(pollTimer);
      unsubscribe();
      window.removeEventListener('student_requests_updated', handleReqUpdate);
      window.removeEventListener('app_data_change', handleReqUpdate);
    };
  }, []);

  const triggerUpdateEvent = () => {
    window.dispatchEvent(new CustomEvent('student_requests_updated'));
    window.dispatchEvent(new CustomEvent('app_data_change'));
  };

  // Determine which unit this logged-in officer belongs to
  const currentOfficerUnit: RequestTargetUnit = isEduOfficer 
    ? 'education' 
    : isFinOfficer 
    ? 'finance' 
    : isCulturalOfficer 
    ? 'cultural_welfare' 
    : (activeUnitTab !== 'all' && activeUnitTab !== 'leave_requests' ? activeUnitTab : 'education');

  const isCurrentOfficerAccepting = globalConfig.officersStatus[currentOfficerUnit]?.isAccepting ?? true;

  // Compute active week dates for Leave Request Modal (Saturday to Thursday)
  const activeWeekInfo = useMemo(() => {
    const todayShamsi = getTodayShamsi();
    const refDate = shamsiToDate(todayShamsi);
    const dayOfWeekIdx = getShamsiDayOfWeek(todayShamsi); // 0 = Saturday, ..., 5 = Thursday, 6 = Friday

    // Calculate Saturday of current week
    const saturdayDate = new Date(refDate);
    saturdayDate.setDate(refDate.getDate() - dayOfWeekIdx + weekOffset);

    // Generate Saturday..Thursday days
    const weekDays: { dayOfWeek: string; dateShamsi: string; dateObj: Date }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(saturdayDate);
      d.setDate(saturdayDate.getDate() + i);
      const dayShamsi = dateToShamsi(d);
      const dayName = SHAMSI_WEEKDAY_NAMES[i] || 'شنبه';
      weekDays.push({ dayOfWeek: dayName, dateShamsi: dayShamsi, dateObj: d });
    }

    const satShamsi = weekDays[0].dateShamsi;
    const thuShamsi = weekDays[5].dateShamsi;

    return {
      satShamsi,
      thuShamsi,
      weekDays
    };
  }, [weekOffset]);

  // Student's enrolled programs for leave requests
  const studentPrograms = useMemo(() => {
    const studentGrade = (currentUser?.gradeLabel || 'پایه ۷').trim();
    const sId = String(currentUser?.studentId || currentUser?.linkedStudentId || currentUser?.id || '').trim();

    const normalizeGrade = (g: string) => g.replace(/7/g, '۷').replace(/8/g, '۸').replace(/9/g, '۹').replace(/10/g, '۱۰');
    const normStudentGrade = normalizeGrade(studentGrade);

    const filtered = programs.filter(p => {
      const pGrade = normalizeGrade(p.grade || '');
      const matchesGrade = !p.grade || pGrade === normStudentGrade || p.grade === 'همه پایه‌ها' || pGrade.includes(normStudentGrade) || normStudentGrade.includes(pGrade);
      const matchesEnrollment = sId && Array.isArray((p as any).studentIds) && (p as any).studentIds.map(String).includes(sId);
      const matchesRep = sId && Array.isArray((p as any).representativeStudentIds) && (p as any).representativeStudentIds.map(String).includes(sId);
      return matchesGrade || matchesEnrollment || matchesRep;
    });

    if (filtered.length > 0) return filtered;
    return programs; // Fallback: return all programs so the schedule grid is never empty
  }, [programs, currentUser]);

  // Toggle Officer Response State (مسئول آموزش، مالی، فرهنگی)
  const handleToggleOfficerStatus = async (unitToToggle: RequestTargetUnit, newStatus: boolean, note?: string) => {
    const updatedConfig: GlobalRequestsConfig = {
      ...globalConfig,
      officersStatus: {
        ...globalConfig.officersStatus,
        [unitToToggle]: {
          ...globalConfig.officersStatus[unitToToggle],
          isAccepting: newStatus,
          statusNote: note !== undefined ? note : globalConfig.officersStatus[unitToToggle]?.statusNote,
          lastToggledAt: new Date().toISOString()
        }
      },
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || currentUser?.username
    };

    const currentUnitSet = unitSettings[unitToToggle];
    const updatedUnitSet: UnitRequestSettings = {
      ...currentUnitSet,
      isAcceptingRequests: newStatus,
      disabledNoticeMessage: note || currentUnitSet.disabledNoticeMessage,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.username
    };

    try {
      await localDb.saveDoc('global_requests_config', 'global_requests_config', updatedConfig);
      await localDb.saveDoc('unit_request_settings', updatedUnitSet.id, updatedUnitSet);
      setGlobalConfig(updatedConfig);
      setUnitSettings(prev => ({ ...prev, [unitToToggle]: updatedUnitSet }));
      setShowOfficerToggleStatusModal(false);
      triggerUpdateEvent();
    } catch (e: any) {
      alert('خطا در ذخیره وضعیت پاسخگویی: ' + (e?.message || ''));
    }
  };

  // Super Admin Master Settings Save
  const handleSaveSuperAdminConfig = async (newVisible: boolean, newEnabled: boolean) => {
    const updatedConfig: GlobalRequestsConfig = {
      ...globalConfig,
      isGlobalVisibleForStudents: newVisible,
      isGlobalEnabled: newEnabled,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || currentUser?.username
    };

    try {
      await localDb.saveDoc('global_requests_config', 'global_requests_config', updatedConfig);
      setGlobalConfig(updatedConfig);
      setShowSuperAdminSettingsModal(false);
      triggerUpdateEvent();
      alert('تنظیمات سراسری سوپر ادمین با موفقیت ذخیره شد.');
    } catch (e: any) {
      alert('خطا در ذخیره تنظیمات سوپر ادمین: ' + (e?.message || ''));
    }
  };

  // Add a new category/subject to the selected unit
  const handleAddSubject = async () => {
    if (!newSubjectInput.trim()) return;
    const currentUnitSettings = unitSettings[subjectSettingUnit];
    if (currentUnitSettings.allowedCategories.includes(newSubjectInput.trim())) {
      alert('این موضوع قبلاً اضافه شده است.');
      return;
    }
    
    const updatedUnitSet: UnitRequestSettings = {
      ...currentUnitSettings,
      allowedCategories: [...currentUnitSettings.allowedCategories, newSubjectInput.trim()],
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.username
    };

    try {
      await localDb.saveDoc('unit_request_settings', updatedUnitSet.id, updatedUnitSet);
      setUnitSettings(prev => ({ ...prev, [subjectSettingUnit]: updatedUnitSet }));
      setNewSubjectInput('');
      triggerUpdateEvent();
    } catch (e: any) {
      alert('خطا در افزودن موضوع: ' + (e?.message || ''));
    }
  };

  const handleRemoveSubject = async (catToRemove: string) => {
    const currentUnitSettings = unitSettings[subjectSettingUnit];
    const updatedUnitSet: UnitRequestSettings = {
      ...currentUnitSettings,
      allowedCategories: currentUnitSettings.allowedCategories.filter(c => c !== catToRemove),
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.username
    };

    try {
      await localDb.saveDoc('unit_request_settings', updatedUnitSet.id, updatedUnitSet);
      setUnitSettings(prev => ({ ...prev, [subjectSettingUnit]: updatedUnitSet }));
      triggerUpdateEvent();
    } catch (e: any) {
      alert('خطا در حذف موضوع: ' + (e?.message || ''));
    }
  };

  // Submit Standard Request by Student
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) {
      alert('لطفاً عنوان و شرح درخواست را به طور کامل وارد فرمایید.');
      return;
    }

    if (!globalConfig.isGlobalEnabled && !isSuperAdmin) {
      alert('سامانه ثبت درخواست‌ها در حال حاضر توسط مدیریت کل سیستم غیرفعال است.');
      return;
    }

    const targetOfficerStatus = globalConfig.officersStatus[newUnit];
    if (!targetOfficerStatus?.isAccepting && !isSuperAdmin) {
      alert(`مسئول ${targetOfficerStatus?.officerTitle || 'این بخش'} در حال حاضر در حالت عدم پاسخگویی قرار دارد:\n${targetOfficerStatus?.statusNote || 'لطفاً در زمان دیگری مراجعه فرمایید.'}`);
      return;
    }

    setIsSubmitting(true);
    const newReqId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const stdId = currentUser?.studentId || (currentUser as any)?.linkedStudentId || currentUser?.id || 'std_unknown';
    const natCode = currentUser?.nationalCode || (currentUser as any)?.nationalId || currentUser?.username || '';
    const stdName = currentUser?.studentName || currentUser?.name || currentUser?.fullName || 'طلبه گرامی';

    const newRecord: StudentRequest = {
      id: newReqId,
      studentId: stdId,
      studentName: stdName,
      nationalCode: natCode,
      grade: currentUser?.gradeLabel,
      unit: newUnit,
      category: newCategory || unitSettings[newUnit]?.allowedCategories[0] || 'درخواست عمومی',
      title: newTitle.trim(),
      description: newDescription.trim(),
      priority: newPriority,
      status: 'pending',
      statusTitle: 'در انتظار بررسی',
      isReadByOfficer: false,
      isReadByStudent: true,
      messages: [{
        id: `msg-${Date.now()}`,
        senderId: currentUser?.id || stdId,
        senderName: stdName,
        senderRole: 'student',
        content: newDescription.trim(),
        createdAt: new Date().toISOString()
      }],
      createdAt: new Date().toISOString()
    };

    try {
      await localDb.saveDoc('student_requests', newReqId, newRecord);
      setRequests(prev => [newRecord, ...prev]);
      setShowNewRequestModal(false);
      setNewTitle('');
      setNewDescription('');
      triggerUpdateEvent();
      alert('✅ درخواست شما با موفقیت ثبت گردید و برای مسئول مربوطه ارسال شد.');
    } catch (err: any) {
      alert('خطا در ثبت درخواست: ' + (err?.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Leave Request (درخواست مرخصی)
  const handleCreateLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedClassesForLeave.length === 0) {
      alert('لطفاً حداقل یک کلاس/جلسه را برای ثبت غیبت و درخواست مرخصی انتخاب نمایید.');
      return;
    }
    if (!leaveAbsenceReason.trim()) {
      alert('لطفاً علت غیبت و دلیل موجه خود را بیان فرمایید.');
      return;
    }

    setIsSubmitting(true);
    const newReqId = 'req_leave_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    
    const leaveDetails: LeaveRequestDetails = {
      weekStartShamsi: activeWeekInfo.satShamsi,
      weekEndShamsi: activeWeekInfo.thuShamsi,
      absenceReason: leaveAbsenceReason.trim(),
      selectedClasses: selectedClassesForLeave.map(c => ({ ...c, status: 'pending' }))
    };

    const classSummaryText = selectedClassesForLeave.map(c => `- ${c.dayOfWeek} ${c.dateShamsi}: ${c.programTitle} (${c.teacherName || 'استاد'})`).join('\n');
    
    const stdId = currentUser?.studentId || (currentUser as any)?.linkedStudentId || currentUser?.id || 'std_unknown';
    const natCode = currentUser?.nationalCode || (currentUser as any)?.nationalId || currentUser?.username || '';
    const stdName = currentUser?.studentName || currentUser?.name || currentUser?.fullName || 'طلبه گرامی';

    const newRecord: StudentRequest = {
      id: newReqId,
      studentId: stdId,
      studentName: stdName,
      nationalCode: natCode,
      grade: currentUser?.gradeLabel,
      unit: 'education',
      category: 'درخواست مرخصی',
      title: `درخواست مرخصی (${selectedClassesForLeave.length} جلسه کلاس)`,
      description: `علت غیبت: ${leaveAbsenceReason.trim()}\n\nکلاس‌های انتخابی جهت مرخصی:\n${classSummaryText}`,
      priority: 'medium',
      status: 'pending',
      statusTitle: 'در انتظار بررسی آموزش',
      isReadByOfficer: false,
      isReadByStudent: true,
      isLeaveRequest: true,
      leaveDetails,
      messages: [{
        id: `msg-${Date.now()}`,
        senderId: currentUser?.id || stdId,
        senderName: stdName,
        senderRole: 'student',
        content: `ثبت درخواست مرخصی برای ${selectedClassesForLeave.length} جلسه کلاس.\nعلت غیبت: ${leaveAbsenceReason.trim()}`,
        createdAt: new Date().toISOString()
      }],
      createdAt: new Date().toISOString()
    };

    try {
      await localDb.saveDoc('student_requests', newReqId, newRecord);
      setRequests(prev => [newRecord, ...prev]);
      setShowLeaveRequestModal(false);
      setLeaveAbsenceReason('');
      setSelectedClassesForLeave([]);
      triggerUpdateEvent();
      alert('✅ درخواست مرخصی شما با موفقیت برای مسئول آموزش ارسال گردید.');
    } catch (err: any) {
      alert('خطا در ثبت درخواست مرخصی: ' + (err?.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Officer Review / Quick Status / Full Reply & Automatic Attendance Sync
  const handleSaveOfficerReply = async (e?: React.FormEvent, overrideStatus?: StudentRequestStatus) => {
    if (e) e.preventDefault();
    const targetReq = selectedRequestForReview || selectedRequestDetail;
    if (!targetReq) return;

    let finalStatus = overrideStatus || replyStatus;

    if (finalStatus === 'rejected' && !rejectionReason.trim() && !officialReply.trim()) {
      alert('در صورت رد درخواست، ذکر دلیل برای آگاهی طلبه الزامی است.');
      return;
    }

    const unitTitle = targetReq.unit === 'education' ? 'واحد آموزش' : targetReq.unit === 'finance' ? 'واحد مالی' : 'واحد فرهنگی و رفاهی';
    const replierTitle = currentUser?.roleTitle || currentUser?.name || unitTitle;
    const replyText = officialReply.trim() || rejectionReason.trim() || '';

    const newOfficerMsg: RequestMessage | null = replyText ? {
      id: `msg-${Date.now()}`,
      senderId: currentUser?.id || 'officer',
      senderName: replierTitle,
      senderRole: 'officer',
      content: replyText,
      createdAt: new Date().toISOString()
    } : null;

    const existingMessages = targetReq.messages || [];
    const updatedMessages = newOfficerMsg ? [...existingMessages, newOfficerMsg] : existingMessages;

    setIsReplying(true);

    // Leave request specific processing & Automatic Attendance Sync
    let updatedLeaveDetails = targetReq.leaveDetails;
    if (targetReq.isLeaveRequest && targetReq.leaveDetails) {
      let updatedClasses = targetReq.leaveDetails.selectedClasses.map(c => {
        const key = `${c.programId}_${c.dateShamsi}`;
        const newClassStatus = leaveClassStatuses[key] || c.status;
        return {
          ...c,
          status: newClassStatus
        };
      });

      // Automatically update classes based on finalStatus
      if (finalStatus === 'resolved') {
        updatedClasses = updatedClasses.map(c => ({
          ...c,
          status: c.status === 'rejected' ? 'rejected' : 'approved'
        }));
      } else if (finalStatus === 'rejected') {
        updatedClasses = updatedClasses.map(c => ({
          ...c,
          status: 'rejected' as const
        }));
      } else if (!overrideStatus) {
        const allApproved = updatedClasses.length > 0 && updatedClasses.every(c => c.status === 'approved');
        const allRejected = updatedClasses.length > 0 && updatedClasses.every(c => c.status === 'rejected');
        if (allApproved) {
          finalStatus = 'resolved';
        } else if (allRejected) {
          finalStatus = 'rejected';
        } else if (finalStatus === 'pending') {
          finalStatus = 'in_progress';
        }
      }

      updatedLeaveDetails = {
        ...targetReq.leaveDetails,
        selectedClasses: updatedClasses
      };

      // AUTOMATIC ATTENDANCE SYNC IN attendanceRecords
      try {
        const attendanceLogs = await localDb.getDocs<AttendanceSessionLog>('attendance');
        
        for (const cls of updatedClasses) {
          const logId = `${cls.programId}_${cls.dateShamsi.replace(/\//g, '-')}`;
          let existingLog = attendanceLogs.find(l => l.id === logId || (l.programId === cls.programId && l.date === cls.dateShamsi));

          const studentEntry: StudentAttendanceDetail = {
            studentId: targetReq.studentId,
            studentName: targetReq.studentName,
            nationalId: targetReq.nationalCode,
            status: cls.status === 'approved' ? 'excused' : 'absent',
            isExcused: cls.status === 'approved',
            excuseReason: cls.status === 'approved' ? 'قبول سیستمی درخواست مرخصی' : 'رد درخواست مرخصی',
            note: cls.status === 'approved' ? 'قبول سیستمی درخواست مرخصی' : 'رد درخواست مرخصی توسط آموزش'
          };

          if (existingLog) {
            const updatedStudents = [...(existingLog.students || [])];
            const sIdx = updatedStudents.findIndex(s => 
              s.studentId === studentEntry.studentId || 
              (s.nationalId && s.nationalId === studentEntry.nationalId) ||
              s.studentName === studentEntry.studentName
            );

            if (sIdx >= 0) {
              updatedStudents[sIdx] = {
                ...updatedStudents[sIdx],
                ...studentEntry
              };
            } else {
              updatedStudents.push(studentEntry);
            }

            const updatedLog: AttendanceSessionLog = {
              ...existingLog,
              students: updatedStudents
            };

            await localDb.saveDoc('attendance', updatedLog.id, updatedLog);
          } else {
            // Create new session log for that date and class
            const newLog: AttendanceSessionLog = {
              id: logId,
              programId: cls.programId,
              programTitle: cls.programTitle,
              date: cls.dateShamsi,
              dayOfWeek: cls.dayOfWeek,
              isCancelled: false,
              notes: 'ثبت خودکار سیستمی بر اساس مرخصی آموزش',
              recordedByName: replierTitle,
              recordedAt: new Date().toISOString(),
              students: [studentEntry]
            };

            await localDb.saveDoc('attendance', newLog.id, newLog);
          }
        }
      } catch (attErr) {
        console.warn('Error syncing leave decision into attendance:', attErr);
      }
    } else if (finalStatus === 'pending') {
      finalStatus = 'in_progress';
    }

    const finalTitle = finalStatus === 'resolved' 
      ? (targetReq.isLeaveRequest ? 'موافقت با مرخصی (تکمیل شد)' : 'تکمیل و انجام شد')
      : finalStatus === 'rejected'
      ? (targetReq.isLeaveRequest ? 'عدم موافقت با مرخصی (رد شد)' : 'رد درخواست')
      : 'در حال بررسی و اقدام';

    const updated: StudentRequest = {
      ...targetReq,
      status: finalStatus,
      statusTitle: finalTitle,
      officialReply: officialReply.trim() || targetReq.officialReply,
      rejectionReason: finalStatus === 'rejected' ? (rejectionReason.trim() || officialReply.trim()) : undefined,
      repliedBy: currentUser?.id,
      repliedByName: replierTitle,
      repliedAt: new Date().toISOString(),
      isReadByOfficer: true,
      isReadByStudent: false, // Student sees glowing badge
      leaveDetails: updatedLeaveDetails,
      messages: updatedMessages,
      updatedAt: new Date().toISOString()
    };

    try {
      await localDb.saveDoc('student_requests', updated.id, updated);
      try {
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        await fetch(`/api/data/student_requests`, {
          method: 'POST',
          headers,
          body: JSON.stringify(updated)
        });
      } catch (srvErr) {}

      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      if (selectedRequestDetail?.id === updated.id) {
        setSelectedRequestDetail(updated);
      }
      setSelectedRequestForReview(null);
      setOfficialReply('');
      setRejectionReason('');
      triggerUpdateEvent();
      alert('✅ پاسخ و وضعیت درخواست با موفقیت ذخیره شد و تغییرات در کارنامه حضور و غیاب اعمال گردید.');
    } catch (err: any) {
      alert('خطا در ذخیره پاسخ: ' + (err?.message || ''));
    } finally {
      setIsReplying(false);
    }
  };

  // Send conversational reply (Student ↔ Officer)
  const handleSendFollowup = async (req: StudentRequest) => {
    const text = (followupDrafts[req.id] || '').trim();
    if (!text) return;
    if (req.isTerminated) {
      alert('این درخواست توسط مسئول مربوطه مختومه اعلام شده است و امکان ادامه گفتگو وجود ندارد.');
      return;
    }

    setIsSendingFollowup(true);
    try {
      const isSenderStudent = isStudentUser;
      const senderRole: 'student' | 'officer' = isSenderStudent ? 'student' : 'officer';
      const senderName = isSenderStudent 
        ? (currentUser?.fullName || currentUser?.name || 'طلبه')
        : (currentUser?.roleTitle || currentUser?.name || 'مسئول مربوطه');

      const newMsg: RequestMessage = {
        id: `msg-${Date.now()}`,
        senderId: currentUser?.id || 'user',
        senderName,
        senderRole,
        content: text,
        createdAt: new Date().toISOString()
      };

      const newStatus = isSenderStudent 
        ? 'in_progress' 
        : (req.status === 'pending' ? 'in_progress' : req.status);

      const newStatusTitle = isSenderStudent 
        ? 'در حال بررسی (پاسخ جدید طلبه)' 
        : (newStatus === 'resolved' ? 'تکمیل و انجام شد' : 'در حال بررسی (پاسخ مسئول داده شد)');

      const updated: StudentRequest = {
        ...req,
        status: newStatus,
        statusTitle: newStatusTitle,
        officialReply: !isSenderStudent ? text : req.officialReply,
        repliedBy: !isSenderStudent ? (currentUser?.id || 'officer') : req.repliedBy,
        repliedByName: !isSenderStudent ? senderName : req.repliedByName,
        repliedAt: !isSenderStudent ? new Date().toISOString() : req.repliedAt,
        isReadByOfficer: !isSenderStudent,
        isReadByStudent: isSenderStudent,
        messages: [...(req.messages || []), newMsg],
        updatedAt: new Date().toISOString()
      };

      await localDb.saveDoc('student_requests', updated.id, updated);
      try {
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        await fetch(`/api/data/student_requests`, {
          method: 'POST',
          headers,
          body: JSON.stringify(updated)
        });
      } catch (srvErr) {}

      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      if (selectedRequestDetail?.id === updated.id) {
        setSelectedRequestDetail(updated);
      }
      setFollowupDrafts(prev => ({ ...prev, [req.id]: '' }));
      triggerUpdateEvent();
    } catch (err: any) {
      alert('خطا در ارسال پیام: ' + (err?.message || ''));
    } finally {
      setIsSendingFollowup(false);
    }
  };

  // Terminate request (ختم رسیدگی توسط مسئول مربوطه)
  const handleTerminateRequest = async (req: StudentRequest) => {
    if (!confirm('آیا از اعلام «ختم رسیدگی» به این پرونده اطمینان دارید؟\nپس از ختم رسیدگی، پرونده به وضعیت مختومه رفته و امکان ارسال پیام و ادامه گفتگو برای طلبه بسته خواهد شد.')) return;
    try {
      const replierTitle = currentUser?.roleTitle || currentUser?.name || 'مسئول مربوطه';
      const termMsg: RequestMessage = {
        id: `msg-${Date.now()}`,
        senderId: currentUser?.id || 'officer',
        senderName: replierTitle,
        senderRole: 'officer',
        content: '⚖️ ختم رسیدگی به این درخواست توسط مسئول مربوطه صادر گردید و پرونده مختومه شد.',
        createdAt: new Date().toISOString()
      };

      const updated: StudentRequest = {
        ...req,
        status: 'resolved',
        statusTitle: 'مختومه (ختم رسیدگی)',
        isTerminated: true,
        terminatedAt: new Date().toISOString(),
        terminatedBy: replierTitle,
        isReadByStudent: false,
        messages: [...(req.messages || []), termMsg],
        updatedAt: new Date().toISOString()
      };

      await localDb.saveDoc('student_requests', updated.id, updated);
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      if (selectedRequestDetail?.id === req.id) {
        setSelectedRequestDetail(updated);
      }
      if (selectedRequestForReview?.id === req.id) {
        setSelectedRequestForReview(null);
      }
      triggerUpdateEvent();
      alert('✅ پرونده با موفقیت مختومه شد و ختم رسیدگی ثبت گردید.');
    } catch (e) {
      alert('خطا در ثبت ختم رسیدگی.');
    }
  };

  // Quick Action directly from card (تیک انجام شد، در حال بررسی، رد درخواست)
  const handleQuickStatusChange = async (req: StudentRequest, newStatus: StudentRequestStatus) => {
    const unitTitle = req.unit === 'education' ? 'واحد آموزش' : req.unit === 'finance' ? 'واحد مالی' : 'واحد فرهنگی و رفاهی';
    const replierTitle = currentUser?.roleTitle || currentUser?.name || unitTitle;
    const defaultNote = newStatus === 'resolved' 
      ? 'درخواست شما بررسی و با موفقیت انجام شد.' 
      : newStatus === 'in_progress' 
      ? 'درخواست شما در دست پیگیری و اقدام است.' 
      : 'درخواست مورد بررسی قرار گرفت اما مورد تأیید واقع نشد.';

    const updated: StudentRequest = {
      ...req,
      status: newStatus,
      statusTitle: newStatus === 'resolved' ? 'تکمیل و انجام شد' : newStatus === 'rejected' ? 'رد درخواست' : 'در حال بررسی',
      officialReply: req.officialReply || defaultNote,
      repliedBy: currentUser?.id,
      repliedByName: replierTitle,
      repliedAt: new Date().toISOString(),
      isReadByOfficer: true,
      isReadByStudent: false,
      updatedAt: new Date().toISOString()
    };

    try {
      await localDb.saveDoc('student_requests', updated.id, updated);
      try {
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        await fetch(`/api/data/student_requests`, {
          method: 'POST',
          headers,
          body: JSON.stringify(updated)
        });
      } catch (srvErr) {}
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      triggerUpdateEvent();
    } catch (e) {
      alert('خطا در تغییر سریع وضعیت.');
    }
  };

  // Mark student request as read by student
  const handleMarkAsReadByStudent = async (req: StudentRequest) => {
    if (req.isReadByStudent !== false) return;
    const updated = { ...req, isReadByStudent: true, updatedAt: new Date().toISOString() };
    try {
      await localDb.saveDoc('student_requests', req.id, updated);
      try {
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        await fetch(`/api/data/student_requests`, {
          method: 'POST',
          headers,
          body: JSON.stringify(updated)
        });
      } catch (srvErr) {}
      setRequests(prev => prev.map(r => r.id === req.id ? updated : r));
      triggerUpdateEvent();
    } catch (e) {}
  };

  // Mark student request as read by officer
  const handleMarkAsReadByOfficer = async (req: StudentRequest) => {
    if (req.isReadByOfficer === true) return;
    const updated = { ...req, isReadByOfficer: true, updatedAt: new Date().toISOString() };
    try {
      await localDb.saveDoc('student_requests', req.id, updated);
      try {
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        await fetch(`/api/data/student_requests`, {
          method: 'POST',
          headers,
          body: JSON.stringify(updated)
        });
      } catch (srvErr) {}
      setRequests(prev => prev.map(r => r.id === req.id ? updated : r));
      triggerUpdateEvent();
    } catch (e) {}
  };

  // Delete a specific request permanently (for officer & super admin)
  const handleDeleteRequest = async (req: StudentRequest, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`آیا از حذف کامل این درخواست («${req.title}») اطمینان دارید؟\nاین درخواست به طور کامل هم برای شما و هم برای طلبه حذف خواهد شد.`)) {
      return;
    }

    try {
      await localDb.deleteDoc('student_requests', req.id);
      try {
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        await fetch(`/api/data/student_requests/${req.id}`, {
          method: 'DELETE',
          headers
        });
      } catch (srvErr) {}

      setRequests(prev => prev.filter(r => r.id !== req.id));
      if (selectedRequestDetail?.id === req.id) setSelectedRequestDetail(null);
      if (selectedRequestForReview?.id === req.id) setSelectedRequestForReview(null);
      triggerUpdateEvent();
      alert('✅ درخواست با موفقیت به طور کامل حذف گردید.');
    } catch (err: any) {
      alert('خطا در حذف درخواست: ' + (err?.message || ''));
    }
  };

  // Clear all test requests recorded so far
  const handleClearAllTestRequests = async () => {
    if (!window.confirm('آیا از پاک‌سازی تمامی درخواست‌های تستی موجود در سیستم اطمینان دارید؟\nاین عملیات کلیه درخواست‌های آزمایشی ثبت‌شده را هم در سمت مسئولین و هم در سمت طلاب به صورت کامل پاک خواهد کرد.')) {
      return;
    }

    try {
      const all = await localDb.getDocs<StudentRequest>('student_requests');
      for (const r of all) {
        await localDb.deleteDoc('student_requests', r.id);
        try {
          const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
          const headers: Record<string, string> = {};
          if (token) headers['Authorization'] = `Bearer ${token}`;
          await fetch(`/api/data/student_requests/${r.id}`, {
            method: 'DELETE',
            headers
          });
        } catch {}
      }
      setRequests([]);
      setSelectedRequestDetail(null);
      setSelectedRequestForReview(null);
      triggerUpdateEvent();
      alert('✅ کلیه درخواست‌های تستی با موفقیت از سیستم پاک‌سازی شدند.');
    } catch (err: any) {
      alert('خطا در پاک‌سازی درخواست‌ها: ' + (err?.message || ''));
    }
  };

  // Convert all active requests for the officer to completed/done
  const handleResolveAllActiveRequests = async () => {
    const activeRequests = filteredRequests.filter(r => !r.isTerminated && r.status !== 'resolved' && r.status !== 'rejected');
    if (activeRequests.length === 0) {
      alert('در حال حاضر هیچ درخواست فعالی برای تبدیل وجود ندارد.');
      return;
    }

    if (!window.confirm(`آیا از تبدیل تمامی (${activeRequests.length}) درخواست فعال به حالت «انجام شد» اطمینان دارید؟\nبا این کار هشدارهای پیام‌های قبلی پاک شده و تمام این درخواست‌ها انجام‌شده خواهند شد.`)) {
      return;
    }

    try {
      const replierTitle = currentUser?.roleTitle || currentUser?.name || 'مسئول مربوطه';
      const nowIso = new Date().toISOString();

      for (const req of activeRequests) {
        const updated: StudentRequest = {
          ...req,
          status: 'resolved',
          statusTitle: 'تکمیل و انجام شد',
          officialReply: req.officialReply || 'درخواست شما بررسی و با موفقیت انجام شد.',
          repliedBy: currentUser?.id,
          repliedByName: replierTitle,
          repliedAt: nowIso,
          isReadByOfficer: true,
          isReadByStudent: false,
          updatedAt: nowIso
        };
        await localDb.saveDoc('student_requests', updated.id, updated);
        try {
          const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = `Bearer ${token}`;
          await fetch(`/api/data/student_requests`, {
            method: 'POST',
            headers,
            body: JSON.stringify(updated)
          });
        } catch {}
      }

      const updatedAll = await localDb.getDocs<StudentRequest>('student_requests');
      setRequests(updatedAll);
      triggerUpdateEvent();
      alert(`✅ با موفقیت تمامی (${activeRequests.length}) درخواست فعال به حالت «انجام شد» تبدیل گردیدند و تمامی هشدارها برطرف گردید.`);
    } catch (err: any) {
      alert('خطا در تبدیل درخواست‌ها: ' + (err?.message || ''));
    }
  };

  // Filter requests
  const filteredRequests = requests.filter(r => {
    if (isStudentUser) {
      // Student only sees their own requests
      const myId = String(currentUser?.studentId || currentUser?.linkedStudentId || currentUser?.id || '').trim();
      const myUsername = String(currentUser?.username || '').trim().toUpperCase();
      const myName = String(currentUser?.name || currentUser?.studentName || currentUser?.fullName || '').trim();

      const reqStudentId = String(r.studentId || (r as any).student_id || '').trim();
      const reqNat = String(r.nationalCode || (r as any).national_id || '').trim().toUpperCase();
      const reqName = String(r.studentName || (r as any).student_name || '').trim();

      const isMine = (myId && reqStudentId === myId) ||
                     (myUsername && (reqNat === myUsername || reqStudentId === myUsername)) ||
                     (myName && reqName === myName);
      if (!isMine) return false;
    } else {
      // Officer sees requests matching active unit tab (or all for super admin)
      if (activeUnitTab === 'leave_requests') {
        if (!r.isLeaveRequest && r.category !== 'درخواست مرخصی') return false;
      } else if (activeUnitTab !== 'all' && r.unit !== activeUnitTab) {
        return false;
      }
    }

    if (activeStatusFilter !== 'all' && r.status !== activeStatusFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = (r.title || '').toLowerCase().includes(q) ||
                    (r.studentName || '').toLowerCase().includes(q) ||
                    (r.category || '').toLowerCase().includes(q) ||
                    (r.description || '').toLowerCase().includes(q) ||
                    (r.officialReply || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  // Sort requests: Unread requests by officer at the top
  const sortedFilteredRequests = useMemo(() => {
    return [...filteredRequests].sort((a, b) => {
      const aUnread = a.isReadByOfficer === false;
      const bUnread = b.isReadByOfficer === false;
      if (aUnread && !bUnread) return -1;
      if (!aUnread && bUnread) return 1;

      const aClosed = a.isTerminated || a.status === 'resolved' || a.status === 'rejected';
      const bClosed = b.isTerminated || b.status === 'resolved' || b.status === 'rejected';
      if (aClosed && !bClosed) return 1;
      if (!aClosed && bClosed) return -1;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [filteredRequests]);

  // Group requests by Student for Officer View
  const officerStudentGroups = useMemo(() => {
    if (isStudentUser) return [];

    const map = new Map<string, {
      studentKey: string;
      studentId: string;
      studentName: string;
      nationalCode: string;
      grade: string;
      activeRequests: StudentRequest[];
      closedRequests: StudentRequest[];
      allRequests: StudentRequest[];
      hasActiveRequest: boolean;
      unreadCount: number;
      latestTimestamp: number;
    }>();

    sortedFilteredRequests.forEach(req => {
      const key = String(req.studentId || req.studentName || 'unknown').trim();
      if (!map.has(key)) {
        map.set(key, {
          studentKey: key,
          studentId: req.studentId || '',
          studentName: req.studentName || 'طلبه گرامی',
          nationalCode: req.nationalCode || '',
          grade: req.grade || '',
          activeRequests: [],
          closedRequests: [],
          allRequests: [],
          hasActiveRequest: false,
          unreadCount: 0,
          latestTimestamp: 0
        });
      }

      const group = map.get(key)!;
      group.allRequests.push(req);

      const isActive = !req.isTerminated && req.status !== 'resolved' && req.status !== 'rejected';
      if (isActive) {
        group.activeRequests.push(req);
        group.hasActiveRequest = true;
      } else {
        group.closedRequests.push(req);
      }

      if (req.isReadByOfficer === false) {
        group.unreadCount++;
      }

      const reqTime = new Date(req.createdAt).getTime();
      if (reqTime > group.latestTimestamp) {
        group.latestTimestamp = reqTime;
      }
    });

    const groupsList = Array.from(map.values());

    // CRITICAL SORTING RULE:
    // Students with active requests ALWAYS move to the top of the list!
    groupsList.sort((a, b) => {
      if (a.hasActiveRequest && !b.hasActiveRequest) return -1;
      if (!a.hasActiveRequest && b.hasActiveRequest) return 1;
      return b.latestTimestamp - a.latestTimestamp;
    });

    return groupsList;
  }, [sortedFilteredRequests, isStudentUser]);

  const getStatusBadge = (status: StudentRequestStatus, isTerminated?: boolean) => {
    if (isTerminated) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-slate-200 text-slate-800 border border-slate-300 flex items-center gap-1.5 shadow-xs">
          <ShieldCheck size={13} className="text-slate-700" />
          <span>مختومه (ختم رسیدگی)</span>
        </span>
      );
    }
    switch (status) {
      case 'resolved':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-xs">
            <CheckCircle2 size={13} className="text-emerald-700" />
            <span>انجام شد و تکمیل گردید</span>
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1.5 shadow-xs">
            <Clock size={13} className="text-blue-700 animate-spin" />
            <span>در حال بررسی و اقدام</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1.5 shadow-xs">
            <XCircle size={13} className="text-rose-700" />
            <span>رد درخواست</span>
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1.5 shadow-xs">
            <Clock size={13} className="text-amber-700" />
            <span>در انتظار بررسی</span>
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-vazir" dir="rtl">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200 shadow-xs">
            <Inbox size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900">
                {isStudentUser ? 'پنل ثبت درخواست طلاب' : 'پنل رسیدگی به درخواست طلاب'}
              </h1>
              {isSuperAdmin && (
                <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-black border border-indigo-200">
                  مدیر کل (دسترسی به تمام واحدها)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {isStudentUser 
                ? 'ارسال آنلاین درخواست، ثبت مرخصی برنامه‌ای و پیگیری دوطرفه گفتگوها تا ختم رسیدگی'
                : 'بررسی درخواست‌ها، ثبت مرخصی با اعمال خودکار در حضور و غیاب و صدور پاسخ رسمی'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Actions for Level 3 Students */}
          {isStudentUser && (
            <>
              {/* Submit Leave Request Button (ثبت درخواست مرخصی) */}
              <button
                onClick={() => {
                  setWeekOffset(0);
                  setSelectedClassesForLeave([]);
                  setLeaveAbsenceReason('');
                  setShowLeaveRequestModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-600/20 active:scale-95 cursor-pointer"
              >
                <CalendarCheck size={16} />
                <span>ثبت درخواست مرخصی</span>
              </button>

              {/* Standard Request Button */}
              <button
                onClick={() => {
                  setNewUnit('education');
                  setNewCategory(unitSettings['education']?.allowedCategories[0] || '');
                  setShowNewRequestModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
              >
                <PlusCircle size={16} />
                <span>ثبت درخواست جدید</span>
              </button>
            </>
          )}

          {/* Super Admin Control Button */}
          {isSuperAdmin && (
            <button
              onClick={() => setShowSuperAdminSettingsModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0"
              title="کنترل دسترسی سوپرادمین"
            >
              <Sliders size={15} />
              <span>کنترل سراسری</span>
            </button>
          )}

          {/* Manage Subjects Button */}
          {(isSuperAdmin || isEduOfficer) && (
            <button
              onClick={() => {
                setSubjectSettingUnit('education');
                setShowSubjectSettingsModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0"
              title="مدیریت موضوعات درخواست‌ها"
            >
              <Settings size={15} />
              <span>موضوعات درخواست‌ها</span>
            </button>
          )}

          {/* Bulk Resolve Active Requests Button for Officers */}
          {!isStudentUser && (
            <>
              <button
                onClick={handleResolveAllActiveRequests}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0"
                title="تبدیل کلیه درخواست‌های فعال به انجام شد و پاک‌سازی هشدارها"
              >
                <CheckSquare size={15} className="text-emerald-700" />
                <span>تبدیل همه درخواست‌های فعال به انجام شد</span>
              </button>

              <button
                onClick={handleClearAllTestRequests}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0"
                title="پاک‌سازی تمامی درخواست‌های تستی موجود در سیستم"
              >
                <Trash2 size={15} className="text-rose-600" />
                <span>پاک‌سازی درخواست‌های تستی</span>
              </button>
            </>
          )}

          {/* Refresh Data Button */}
          <button
            onClick={() => loadData(false)}
            disabled={isLoading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
            title="بروزرسانی اطلاعات"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin text-indigo-600" : ""} />
          </button>
        </div>
      </div>

      {/* Officer Department Tabs & Leave Requests Tab */}
      {!isStudentUser && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
          <button
            onClick={() => setActiveUnitTab('all')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5",
              activeUnitTab === 'all' ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            )}
          >
            <Inbox size={14} />
            <span>همه درخواست‌ها</span>
          </button>

          <button
            onClick={() => setActiveUnitTab('education')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5",
              activeUnitTab === 'education' ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            )}
          >
            <GraduationCap size={14} />
            <span>امور آموزشی</span>
          </button>

          <button
            onClick={() => setActiveUnitTab('finance')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5",
              activeUnitTab === 'finance' ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            )}
          >
            <Coins size={14} />
            <span>امور مالی و وام</span>
          </button>

          <button
            onClick={() => setActiveUnitTab('cultural_welfare')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5",
              activeUnitTab === 'cultural_welfare' ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            )}
          >
            <Building2 size={14} />
            <span>امور فرهنگی و رفاهی</span>
          </button>

          {/* DEDICATED LEAVE REQUESTS TAB FOR OFFICERS */}
          <button
            onClick={() => setActiveUnitTab('leave_requests')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border",
              activeUnitTab === 'leave_requests'
                ? "bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20"
                : "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100"
            )}
          >
            <CalendarCheck size={14} className={activeUnitTab === 'leave_requests' ? "text-white" : "text-amber-700"} />
            <span>درخواست‌های مرخصی</span>
            {requests.filter(r => r.isLeaveRequest && r.status === 'pending').length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white mr-1">
                {requests.filter(r => r.isLeaveRequest && r.status === 'pending').length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Global Disability Notice */}
      {!globalConfig.isGlobalEnabled && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-rose-900 text-xs font-bold flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-rose-600 shrink-0" />
            <span>
              <strong>هشدار سراسری:</strong> ثبت درخواست‌ها در حال حاضر توسط مدیریت کل سیستم <strong>غیرفعال</strong> شده است.
            </span>
          </div>
        </div>
      )}

      {/* Officer dedicated status switcher */}
      {!isStudentUser && activeUnitTab !== 'all' && activeUnitTab !== 'leave_requests' && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-11 h-11 rounded-2xl flex items-center justify-center border",
              isCurrentOfficerAccepting 
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" 
                : "bg-rose-500/20 text-rose-400 border-rose-500/40"
            )}>
              {isCurrentOfficerAccepting ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-300 font-medium">وضعیت پاسخگویی شما:</span>
                <span className={cn(
                  "text-xs font-black px-2.5 py-0.5 rounded-full",
                  isCurrentOfficerAccepting ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                )}>
                  {isCurrentOfficerAccepting ? '● آماده دریافت و پاسخگویی' : '○ عدم پاسخگویی (خاموش)'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setOfficerNoteDraft(globalConfig.officersStatus[currentOfficerUnit]?.statusNote || '');
              setShowOfficerToggleStatusModal(true);
            }}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/20 shrink-0 cursor-pointer"
          >
            تغییر وضعیت پاسخگویی
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute right-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در عنوان، متقاضی، موضوع، متن یا پاسخ..."
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-indigo-400 outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={activeStatusFilter}
            onChange={(e) => setActiveStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="pending">⏳ در انتظار بررسی</option>
            <option value="in_progress">🔄 در حال بررسی و اقدام</option>
            <option value="resolved">✅ انجام شد / تکمیل گردید</option>
            <option value="rejected">❌ رد درخواست</option>
          </select>
        </div>
      </div>

      {/* Request Cards List / Officer Student-Grouped View */}
      <div className="space-y-4">
        {isLoading && requests.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 text-center text-slate-400 flex flex-col items-center gap-2 border border-slate-200">
            <Loader2 size={28} className="animate-spin text-indigo-600" />
            <span className="text-xs font-semibold">در حال بارگذاری درخواست‌ها...</span>
          </div>
        ) : sortedFilteredRequests.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 text-center text-slate-400 border border-slate-200 flex flex-col items-center gap-2">
            <Inbox size={40} className="text-slate-300" />
            <p className="text-sm font-bold text-slate-700">هیچ درخواستی در این بخش یافت نشد.</p>
            <p className="text-xs text-slate-400">
              {isStudentUser 
                ? 'با کلیک بر روی «ثبت درخواست جدید» یا «ثبت درخواست مرخصی» می‌توانید فرم ارسال نمایید.' 
                : 'درخواست‌های جدید ارسالی از سوی طلاب در این کارتابل نمایش داده خواهند شد.'}
            </p>
          </div>
        ) : isStudentUser ? (
          /* ========================================================================= */
          /* STUDENT VIEW: Flat List of Student's Own Requests                          */
          /* ========================================================================= */
          sortedFilteredRequests.map((req) => {
            const isUnreadForStudent = req.isReadByStudent === false;
            const messageCount = Array.isArray(req.messages) ? req.messages.length : 0;

            return (
              <div
                key={req.id}
                onClick={() => {
                  handleMarkAsReadByStudent(req);
                  setSelectedRequestDetail(req);
                  setReplyStatus(req.status);
                  setOfficialReply(req.officialReply || '');
                  setRejectionReason(req.rejectionReason || '');
                  if (req.isLeaveRequest && req.leaveDetails) {
                    const initMap: Record<string, 'approved' | 'rejected'> = {};
                    req.leaveDetails.selectedClasses.forEach(c => {
                      initMap[`${c.programId}_${c.dateShamsi}`] = c.status === 'rejected' ? 'rejected' : 'approved';
                    });
                    setLeaveClassStatuses(initMap);
                  }
                }}
                className={cn(
                  "bg-white rounded-2xl p-4 border transition-all shadow-2xs hover:shadow-md cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 group relative overflow-hidden",
                  isUnreadForStudent ? "border-emerald-300 bg-emerald-50/20 ring-1 ring-emerald-300" :
                  req.isTerminated ? "border-slate-200 bg-slate-50/60" :
                  req.status === 'resolved' ? "border-emerald-200/90 hover:border-emerald-300" :
                  req.status === 'rejected' ? "border-rose-200/90 hover:border-rose-300" : "border-slate-200 hover:border-indigo-300"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs border",
                    req.isLeaveRequest 
                      ? "bg-amber-100 text-amber-900 border-amber-300" 
                      : "bg-indigo-100 text-indigo-900 border-indigo-200"
                  )}>
                    {req.studentName?.[0] || 'ط'}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-black text-slate-900 truncate">
                        {req.studentName}
                      </span>

                      {req.grade && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold">
                          {req.grade}
                        </span>
                      )}

                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-md font-bold border",
                        req.isLeaveRequest 
                          ? "bg-amber-50 text-amber-900 border-amber-200" 
                          : "bg-indigo-50 text-indigo-700 border-indigo-100"
                      )}>
                        {req.category}
                      </span>

                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-medium">
                        {req.unit === 'education' ? 'آموزش' : req.unit === 'finance' ? 'مالی' : 'فرهنگی/رفاهی'}
                      </span>

                      {isUnreadForStudent && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white animate-bounce">
                          پاسخ جدید 📩
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                      {req.title}
                    </h4>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(req.status, req.isTerminated)}

                    {messageCount > 0 && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-700 flex items-center gap-1 font-mono border border-slate-200/80" title="تعداد پیام‌های ثبت‌شده">
                        <MessageSquare size={12} className="text-indigo-600" />
                        <span>{messageCount}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(req.createdAt).toLocaleDateString('fa-IR')}
                    </span>
                    <span className="px-2.5 py-1.5 rounded-xl bg-slate-100 group-hover:bg-indigo-600 group-hover:text-white text-slate-600 transition-all text-xs font-bold flex items-center gap-1">
                      <span>مشاهده و گفتگو</span>
                      <ChevronLeft size={14} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          /* ========================================================================= */
          /* OFFICER VIEW: Grouped by Student with Active Requests at Top               */
          /* ========================================================================= */
          officerStudentGroups.map((group) => {
            const isExpanded = expandedStudentKey === group.studentKey;
            const currentSubTab = officerStudentSubTab[group.studentKey] || (group.hasActiveRequest ? 'active' : 'closed');
            const targetRequestsList = currentSubTab === 'active' ? group.activeRequests : group.closedRequests;

            return (
              <div 
                key={group.studentKey}
                className={cn(
                  "bg-white rounded-3xl border transition-all overflow-hidden shadow-xs hover:shadow-md",
                  group.hasActiveRequest 
                    ? "border-amber-300 bg-gradient-to-r from-amber-50/30 via-white to-white ring-2 ring-amber-400/50" 
                    : "border-slate-200/90"
                )}
              >
                {/* Student Card Header */}
                <div 
                  onClick={() => {
                    const nextExpanded = isExpanded ? null : group.studentKey;
                    setExpandedStudentKey(nextExpanded);
                    if (nextExpanded) {
                      group.allRequests.forEach(req => {
                        if (req.isReadByOfficer === false) {
                          handleMarkAsReadByOfficer(req);
                        }
                      });
                    }
                  }}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm border",
                      group.unreadCount > 0
                        ? "bg-amber-500 text-white border-amber-600 animate-pulse"
                        : "bg-indigo-100 text-indigo-900 border-indigo-200"
                    )}>
                      {group.studentName?.[0] || 'ط'}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-black text-sm text-slate-900 truncate">
                          {group.studentName}
                        </span>

                        {group.grade && (
                          <span className="text-[10.5px] px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold border border-slate-200">
                            {group.grade}
                          </span>
                        )}

                        {group.unreadCount > 0 && (
                          <span className="px-3 py-0.5 rounded-full text-[10.5px] font-black bg-rose-500 text-white animate-pulse shadow-xs flex items-center gap-1">
                            <span>🔥 {group.unreadCount} پیام جدید</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                        {group.nationalCode && <span>کد ملی / شناسه: {group.nationalCode}</span>}
                        <span>•</span>
                        <span>مجموع درخواست‌ها: {group.allRequests.length} مورد</span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Badges & Expand Indicator */}
                  <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-3 py-1 rounded-xl text-xs font-black border flex items-center gap-1",
                        group.activeRequests.length > 0 
                          ? "bg-amber-100 text-amber-950 border-amber-300 shadow-xs" 
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      )}>
                        <Clock size={13} className={group.activeRequests.length > 0 ? "text-amber-700" : ""} />
                        <span>فعال / در جریان: {group.activeRequests.length}</span>
                      </span>

                      <span className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200/80">
                        مختومه: {group.closedRequests.length}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-indigo-600 hover:text-white transition-all text-xs font-bold flex items-center gap-1"
                    >
                      <span>{isExpanded ? 'بستن لیست' : 'مشاهده درخواست‌ها'}</span>
                      <ChevronDown size={16} className={cn("transition-transform duration-300", isExpanded && "rotate-180")} />
                    </button>
                  </div>
                </div>

                {/* Expanded Student Requests Container */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 space-y-4"
                    >
                      {/* Sub Tabs: Active vs Closed */}
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                        <button
                          type="button"
                          onClick={() => setOfficerStudentSubTab({ ...officerStudentSubTab, [group.studentKey]: 'active' })}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
                            currentSubTab === 'active'
                              ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          )}
                        >
                          <Clock size={14} />
                          <span>درخواست‌های فعال و جاری ({group.activeRequests.length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setOfficerStudentSubTab({ ...officerStudentSubTab, [group.studentKey]: 'closed' })}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
                            currentSubTab === 'closed'
                              ? "bg-slate-800 text-white shadow-md"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          )}
                        >
                          <ShieldCheck size={14} />
                          <span>مراودات مختومه‌شده و بایگانی ({group.closedRequests.length})</span>
                        </button>
                      </div>

                      {/* Request Cards Under Selected Sub Tab */}
                      <div className="space-y-3">
                        {targetRequestsList.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 text-xs italic bg-white rounded-2xl border border-dashed border-slate-200">
                            در این بخش درخواستی موجود نیست.
                          </div>
                        ) : (
                          targetRequestsList.map((req) => {
                            const isUnreadForOfficer = req.isReadByOfficer === false;
                            const messageCount = Array.isArray(req.messages) ? req.messages.length : 0;

                            return (
                              <div
                                key={req.id}
                                onClick={() => {
                                  handleMarkAsReadByOfficer(req);
                                  setSelectedRequestDetail(req);
                                  setReplyStatus(req.status === 'pending' ? 'in_progress' : req.status);
                                  setOfficialReply(req.officialReply || '');
                                  setRejectionReason(req.rejectionReason || '');
                                  if (req.isLeaveRequest && req.leaveDetails) {
                                    const initMap: Record<string, 'approved' | 'rejected'> = {};
                                    req.leaveDetails.selectedClasses.forEach(c => {
                                      initMap[`${c.programId}_${c.dateShamsi}`] = c.status === 'rejected' ? 'rejected' : 'approved';
                                    });
                                    setLeaveClassStatuses(initMap);
                                  }
                                }}
                                className={cn(
                                  "bg-white rounded-2xl p-4 border transition-all shadow-2xs hover:shadow-md cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 group relative overflow-hidden",
                                  isUnreadForOfficer ? "border-amber-400 bg-amber-50/40 ring-1 ring-amber-400" :
                                  req.isTerminated ? "border-slate-200 bg-slate-50/80" :
                                  req.status === 'resolved' ? "border-emerald-200" :
                                  req.status === 'rejected' ? "border-rose-200" : "border-slate-200 hover:border-indigo-300"
                                )}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={cn(
                                    "w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs border",
                                    req.isLeaveRequest 
                                      ? "bg-amber-100 text-amber-900 border-amber-300" 
                                      : "bg-indigo-100 text-indigo-900 border-indigo-200"
                                  )}>
                                    {req.isLeaveRequest ? <CalendarCheck size={16} /> : <FileText size={16} />}
                                  </div>

                                  <div className="space-y-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap text-xs">
                                      <span className={cn(
                                        "text-[10px] px-2 py-0.5 rounded-md font-bold border",
                                        req.isLeaveRequest 
                                          ? "bg-amber-50 text-amber-900 border-amber-200" 
                                          : "bg-indigo-50 text-indigo-700 border-indigo-100"
                                      )}>
                                        {req.category}
                                      </span>

                                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-medium">
                                        {req.unit === 'education' ? 'آموزش' : req.unit === 'finance' ? 'مالی' : 'فرهنگی/رفاهی'}
                                      </span>

                                      {isUnreadForOfficer && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                                          جدید 🔥
                                        </span>
                                      )}
                                    </div>

                                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                                      {req.title}
                                    </h4>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                                  <div className="flex items-center gap-2">
                                    {getStatusBadge(req.status, req.isTerminated)}

                                    {messageCount > 0 && (
                                      <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-700 flex items-center gap-1 font-mono border border-slate-200/80">
                                        <MessageSquare size={12} className="text-indigo-600" />
                                        <span>{messageCount}</span>
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={(e) => handleDeleteRequest(req, e)}
                                      className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all cursor-pointer shadow-2xs"
                                      title="حذف کامل این درخواست"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                    <span className="text-[11px] text-slate-400 font-mono">
                                      {new Date(req.createdAt).toLocaleDateString('fa-IR')}
                                    </span>
                                    <span className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all text-xs font-bold flex items-center gap-1 shadow-2xs">
                                      <span>رسیدگی و پاسخ</span>
                                      <ChevronLeft size={14} />
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      {/* ======================= Modal: Full Request Detail & Conversation Thread ======================= */}
      <AnimatePresence>
        {selectedRequestDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm dir-rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl w-full max-w-3xl border border-slate-200 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
            >
              {/* Modal Top Header */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center font-black text-amber-300 text-sm shrink-0">
                    {selectedRequestDetail.studentName?.[0] || 'ط'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-black text-white truncate">
                        {selectedRequestDetail.title}
                      </h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                        {selectedRequestDetail.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-300 mt-0.5">
                      <span>متقاضی: <strong className="text-white">{selectedRequestDetail.studentName}</strong></span>
                      {selectedRequestDetail.grade && <span>({selectedRequestDetail.grade})</span>}
                      <span>•</span>
                      <span className="font-mono text-[11px]">{new Date(selectedRequestDetail.createdAt).toLocaleDateString('fa-IR')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {getStatusBadge(selectedRequestDetail.status, selectedRequestDetail.isTerminated)}
                  {!isStudentUser && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteRequest(selectedRequestDetail, e)}
                      className="p-1.5 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/40 border border-rose-400/40 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                      title="حذف کامل این پرونده"
                    >
                      <Trash2 size={15} />
                      <span className="hidden sm:inline">حذف پرونده</span>
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedRequestDetail(null)}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Modal Scrollable Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
                {/* 1. Original Request Details Card */}
                <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs border-b border-slate-200/80 pb-2">
                    <span className="font-black text-slate-900 flex items-center gap-1.5">
                      <Inbox size={15} className="text-indigo-600" />
                      <span>متن اولیه درخواست:</span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      ارسال به: {selectedRequestDetail.unit === 'education' ? 'واحد آموزش' : selectedRequestDetail.unit === 'finance' ? 'واحد مالی' : 'واحد فرهنگی/رفاهی'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-800 leading-relaxed font-medium whitespace-pre-line">
                    {selectedRequestDetail.description}
                  </p>
                </div>

                {/* 2. Leave Request Class Table Breakdown (If leave request) */}
                {selectedRequestDetail.isLeaveRequest && selectedRequestDetail.leaveDetails && (
                  <div className="p-4 bg-amber-50/80 border border-amber-200/90 rounded-2xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between font-black text-xs text-amber-950 border-b border-amber-200/80 pb-2 gap-2">
                      <span className="flex items-center gap-1.5">
                        <CalendarCheck size={16} className="text-amber-700" />
                        <span>جدول کلاس‌های مرخصی ({selectedRequestDetail.leaveDetails.weekStartShamsi} تا {selectedRequestDetail.leaveDetails.weekEndShamsi}):</span>
                      </span>

                      {!isStudentUser && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              const allAppr: Record<string, 'approved' | 'rejected'> = {};
                              selectedRequestDetail.leaveDetails?.selectedClasses.forEach(c => {
                                allAppr[`${c.programId}_${c.dateShamsi}`] = 'approved';
                              });
                              setLeaveClassStatuses(allAppr);
                              setReplyStatus('resolved');
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-black transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                          >
                            <Check size={13} />
                            <span>موافقت با تمام کلاس‌ها</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const allRej: Record<string, 'approved' | 'rejected'> = {};
                              selectedRequestDetail.leaveDetails?.selectedClasses.forEach(c => {
                                allRej[`${c.programId}_${c.dateShamsi}`] = 'rejected';
                              });
                              setLeaveClassStatuses(allRej);
                              setReplyStatus('rejected');
                            }}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-black transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                          >
                            <X size={13} />
                            <span>مخالفت با تمام کلاس‌ها</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedRequestDetail.leaveDetails.selectedClasses.map((cls, idx) => {
                        const key = `${cls.programId}_${cls.dateShamsi}`;
                        const currentSt = leaveClassStatuses[key] || cls.status;

                        return (
                          <div key={idx} className="p-3 bg-white border border-amber-200 rounded-xl flex items-center justify-between text-xs gap-2">
                            <div>
                              <span className="font-bold text-slate-900 block">{cls.dayOfWeek} ({cls.dateShamsi})</span>
                              <span className="text-[11px] text-slate-600 font-medium">{cls.programTitle}</span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {!isStudentUser ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setLeaveClassStatuses(prev => ({ ...prev, [key]: 'approved' }))}
                                    className={cn(
                                      "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer",
                                      currentSt === 'approved' ? "bg-emerald-600 text-white shadow-xs" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    )}
                                  >
                                    موافق
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setLeaveClassStatuses(prev => ({ ...prev, [key]: 'rejected' }))}
                                    className={cn(
                                      "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer",
                                      currentSt === 'rejected' ? "bg-rose-600 text-white shadow-xs" : "bg-rose-50 text-rose-700 border border-rose-200"
                                    )}
                                  >
                                    مخالف
                                  </button>
                                </>
                              ) : (
                                <span className={cn(
                                  "px-2 py-0.5 rounded text-[10px] font-black",
                                  cls.status === 'approved' ? "bg-emerald-200 text-emerald-900" :
                                  cls.status === 'rejected' ? "bg-rose-200 text-rose-900" : "bg-amber-100 text-amber-900"
                                )}>
                                  {cls.status === 'approved' ? '🟢 موجه' : cls.status === 'rejected' ? '🔴 غیرموجه' : '🟡 در انتظار'}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {!isStudentUser && (
                      <div className="pt-2 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            const allAppr: Record<string, 'approved' | 'rejected'> = {};
                            selectedRequestDetail.leaveDetails?.selectedClasses.forEach(c => {
                              allAppr[`${c.programId}_${c.dateShamsi}`] = 'approved';
                            });
                            setLeaveClassStatuses(allAppr);
                            handleSaveOfficerReply(undefined, 'resolved');
                          }}
                          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                        >
                          <CheckCircle2 size={15} />
                          <span>تأیید سریع و موافقت با تمامی کلاس‌ها و ثبت در حضور و غیاب</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Single Consolidated Conversation Thread (تاریخچه یکپارچه گفتگو) */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs font-black text-slate-800 border-b border-slate-200 pb-2">
                    <span className="flex items-center gap-1.5">
                      <MessageSquare size={16} className="text-indigo-600" />
                      <span>تاریخچه گفتگو و پیام‌های متقابل</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {selectedRequestDetail.messages?.length || 0} پیام ثبت‌شده
                    </span>
                  </div>

                  <div className="space-y-3 max-h-80 overflow-y-auto p-1">
                    {Array.isArray(selectedRequestDetail.messages) && selectedRequestDetail.messages.length > 0 ? (
                      selectedRequestDetail.messages.map((msg) => {
                        const isStudentMsg = msg.senderRole === 'student';
                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              "p-3.5 rounded-2xl text-xs space-y-1.5 max-w-[88%] shadow-2xs border",
                              isStudentMsg
                                ? "bg-indigo-50/90 border-indigo-200/90 text-indigo-950 mr-auto"
                                : "bg-emerald-50/90 border-emerald-200/90 text-emerald-950 ml-auto"
                            )}
                          >
                            <div className="flex items-center justify-between font-bold text-[11px] opacity-80 border-b border-black/5 pb-1">
                              <span className="flex items-center gap-1">
                                <strong>{msg.senderName}</strong>
                                <span className="text-[10px] opacity-75">({isStudentMsg ? 'طلبه' : 'مسئول'})</span>
                              </span>
                              <span className="font-mono text-[10px]">
                                {new Date(msg.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })} - {new Date(msg.createdAt).toLocaleDateString('fa-IR')}
                              </span>
                            </div>
                            <p className="whitespace-pre-line leading-relaxed font-medium text-slate-800">
                              {msg.content}
                            </p>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-400 italic bg-slate-50 rounded-2xl">
                        هنوز پاسخی در این رشته پیام ارسال نشده است.
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Official Response / Action Controls */}
                {!isStudentUser ? (
                  /* Officer Review & Action Panel */
                  <form onSubmit={(e) => handleSaveOfficerReply(e)} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5 text-xs pt-3">
                    <span className="font-black text-slate-900 block border-b border-slate-200 pb-2">
                      ثبت پاسخ رسمی و تعیین وضعیت توسط مسئول:
                    </span>

                    {/* Status quick buttons */}
                    <div className="space-y-1.5">
                      <label className="block font-bold text-slate-700">تعیین وضعیت نهایی پرونده:</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setReplyStatus('resolved')}
                          className={cn(
                            "p-2.5 rounded-xl font-bold text-xs border transition-all cursor-pointer flex items-center justify-center gap-1.5",
                            replyStatus === 'resolved'
                              ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                              : "bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50"
                          )}
                        >
                          <CheckCircle2 size={15} />
                          <span>تکمیل و انجام شد</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setReplyStatus('in_progress')}
                          className={cn(
                            "p-2.5 rounded-xl font-bold text-xs border transition-all cursor-pointer flex items-center justify-center gap-1.5",
                            replyStatus === 'in_progress'
                              ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                              : "bg-white text-indigo-800 border-indigo-200 hover:bg-indigo-50"
                          )}
                        >
                          <Clock size={15} />
                          <span>در حال بررسی و اقدام</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setReplyStatus('rejected')}
                          className={cn(
                            "p-2.5 rounded-xl font-bold text-xs border transition-all cursor-pointer flex items-center justify-center gap-1.5",
                            replyStatus === 'rejected'
                              ? "bg-rose-600 text-white border-rose-700 shadow-sm"
                              : "bg-white text-rose-800 border-rose-200 hover:bg-rose-50"
                          )}
                        >
                          <XCircle size={15} />
                          <span>رد درخواست</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">متن پاسخ رسمی / دستور مسئول:</label>
                      <textarea
                        rows={3}
                        value={officialReply}
                        onChange={(e) => setOfficialReply(e.target.value)}
                        placeholder="متن پاسخ رسمی یا توضیحات لازم برای آگاهی طلبه را بنویسید..."
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:border-indigo-500 outline-none resize-none leading-relaxed"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
                      <div>
                        {!selectedRequestDetail.isTerminated && (
                          <button
                            type="button"
                            onClick={() => handleTerminateRequest(selectedRequestDetail)}
                            className="py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1 text-[11px]"
                          >
                            <ShieldCheck size={14} />
                            <span>مختومه‌سازی پرونده</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedRequestDetail(null)}
                          className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 cursor-pointer"
                        >
                          بستن
                        </button>
                        <button
                          type="submit"
                          disabled={isReplying}
                          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-indigo-600/20 cursor-pointer flex items-center gap-1.5"
                        >
                          <Send size={15} />
                          <span>{isReplying ? 'در حال ثبت...' : 'ثبت پاسخ و اعمال قطعی وضعیت'}</span>
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  /* Student Followup Messaging Area */
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    {!selectedRequestDetail.isTerminated ? (
                      <div className="space-y-2">
                        <label className="block font-bold text-xs text-slate-800">
                          ارسال پیام و پاسخ جدید در ادامه گفتگو:
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={followupDrafts[selectedRequestDetail.id] || ''}
                            onChange={(e) => setFollowupDrafts(prev => ({ ...prev, [selectedRequestDetail.id]: e.target.value }))}
                            placeholder="پیام یا توضیحات خود را بنویسید..."
                            className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:border-indigo-500 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSendFollowup(selectedRequestDetail)}
                            disabled={isSendingFollowup || !followupDrafts[selectedRequestDetail.id]?.trim()}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-md shadow-indigo-600/20"
                          >
                            <Send size={14} />
                            <span>ارسال پیام</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold flex items-center gap-2">
                        <ShieldCheck size={16} className="text-amber-700 shrink-0" />
                        <span>⚖️ این پرونده توسط مسئول مربوطه مختومه اعلام گردیده است.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================= Modal: New Standard Request ======================= */}
      <AnimatePresence>
        {showNewRequestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg border border-slate-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <PlusCircle size={20} className="text-emerald-600" />
                  <h3 className="text-sm font-black text-slate-900">ثبت تقاضا و درخواست جدید</h3>
                </div>
                <button onClick={() => setShowNewRequestModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateRequest} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">واحد دریافت‌کننده درخواست:</label>
                  <select
                    value={newUnit}
                    onChange={(e) => {
                      const u = e.target.value as RequestTargetUnit;
                      setNewUnit(u);
                      setNewCategory(unitSettings[u]?.allowedCategories[0] || '');
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
                  >
                    <option value="education">
                      واحد آموزش و امتحانات {globalConfig.officersStatus.education?.isAccepting ? '(پاسخگو)' : '(عدم پاسخگویی)'}
                    </option>
                    <option value="finance">
                      واحد مالی، شهریه و وام‌ها {globalConfig.officersStatus.finance?.isAccepting ? '(پاسخگو)' : '(عدم پاسخگویی)'}
                    </option>
                    <option value="cultural_welfare">
                      واحد فرهنگی، رفاهی و کمدها {globalConfig.officersStatus.cultural_welfare?.isAccepting ? '(پاسخگو)' : '(عدم پاسخگویی)'}
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">موضوع تقاضا:</label>
                  <select
                    value={newCategory}
                    onChange={(e) => {
                      const selectedCat = e.target.value;
                      if (selectedCat === 'درخواست مرخصی') {
                        setShowNewRequestModal(false);
                        setWeekOffset(0);
                        setSelectedClassesForLeave([]);
                        setLeaveAbsenceReason('');
                        setShowLeaveRequestModal(true);
                      } else {
                        setNewCategory(selectedCat);
                      }
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
                  >
                    {(unitSettings[newUnit]?.allowedCategories || []).map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">عنوان درخواست:</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="عنوان خلاصه تقاضا..."
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-indigo-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">شرح درخواست:</label>
                  <textarea
                    rows={4}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="جزئیات و شرح تقاضای خود را به طور کامل بنویسید..."
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-indigo-400 outline-none resize-none leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">اولویت:</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
                  >
                    <option value="low">عادی</option>
                    <option value="medium">متوسط</option>
                    <option value="high">بالا</option>
                    <option value="urgent">فوری و ضروری</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowNewRequestModal(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-600/20"
                  >
                    {isSubmitting ? 'در حال ثبت...' : 'ثبت و ارسال درخواست'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================= Modal: Leave Request Form (ثبت درخواست مرخصی) ======================= */}
      <AnimatePresence>
        {showLeaveRequestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-3xl border border-slate-200 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <CalendarCheck size={22} className="text-amber-600" />
                  <div>
                    <h3 className="text-base font-black text-slate-900">فرم اختصاصی ثبت درخواست مرخصی</h3>
                    <p className="text-xs text-slate-500">انتخاب جلسات کلاس‌های هفته جاری یا هفته‌های دیگر جهت ثبت غیبت موجه</p>
                  </div>
                </div>
                <button onClick={() => setShowLeaveRequestModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={20} />
                </button>
              </div>

              {/* Week Navigation Header */}
              <div className="p-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white rounded-2xl flex items-center justify-between shadow-md">
                <button
                  type="button"
                  onClick={() => setWeekOffset(prev => prev - 7)}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <ChevronRight size={18} />
                  <span className="text-xs">هفته قبل</span>
                </button>

                <div className="text-center space-y-0.5">
                  <span className="text-xs font-black text-amber-100 block">برنامه درسی هفته انتخابی</span>
                  <span className="text-sm font-black text-white font-mono">
                    شنبه {activeWeekInfo.satShamsi} تا پنج‌شنبه {activeWeekInfo.thuShamsi}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setWeekOffset(prev => prev + 7)}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span className="text-xs">هفته بعد</span>
                  <ChevronLeft size={18} />
                </button>
              </div>

              {/* Weekly Classes Selection Grid */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-800 block">
                  کلاس‌های دایر در این هفته (با کلیک بر روی هر کلاس، آن را برای غیبت/مرخصی علامت بزنید):
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeWeekInfo.weekDays.map((dayItem) => {
                    // Filter student's programs running on this weekday
                    const dayProgs = studentPrograms.filter(p => {
                      if (Array.isArray(p.days)) return p.days.includes(dayItem.dayOfWeek);
                      if (p.day) return p.day.includes(dayItem.dayOfWeek);
                      return true; // fallback
                    });

                    return (
                      <div key={dayItem.dayOfWeek} className="p-3 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 font-black text-xs text-slate-800">
                          <span>{dayItem.dayOfWeek}</span>
                          <span className="font-mono text-slate-500 text-[11px]">{dayItem.dateShamsi}</span>
                        </div>

                        {dayProgs.length === 0 ? (
                          <span className="text-[11px] text-slate-400 italic block py-2 text-center">کلاسی در این روز ثبت نشده</span>
                        ) : (
                          <div className="space-y-1.5">
                            {dayProgs.map((prog) => {
                              const isSelected = selectedClassesForLeave.some(
                                c => c.programId === prog.id && c.dateShamsi === dayItem.dateShamsi
                              );

                              return (
                                <button
                                  type="button"
                                  key={prog.id}
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedClassesForLeave(prev => prev.filter(c => !(c.programId === prog.id && c.dateShamsi === dayItem.dateShamsi)));
                                    } else {
                                      const newCls: LeaveRequestedClass = {
                                        programId: prog.id,
                                        programTitle: prog.title,
                                        dateShamsi: dayItem.dateShamsi,
                                        dayOfWeek: dayItem.dayOfWeek,
                                        time: prog.time || (prog.startTime ? `${prog.startTime} - ${prog.endTime || ''}` : ''),
                                        teacherName: prog.teacher,
                                        status: 'pending'
                                      };
                                      setSelectedClassesForLeave(prev => [...prev, newCls]);
                                    }
                                  }}
                                  className={cn(
                                    "w-full text-right p-2.5 rounded-xl border text-xs transition-all cursor-pointer flex items-center justify-between gap-2",
                                    isSelected 
                                      ? "bg-amber-100/90 border-amber-400 text-amber-950 font-black shadow-xs ring-1 ring-amber-400" 
                                      : "bg-white border-slate-200 text-slate-800 hover:border-amber-300"
                                  )}
                                >
                                  <div>
                                    <span className="block text-xs font-bold">{prog.title}</span>
                                    <span className="text-[10px] text-slate-500">{prog.teacher || 'استاد'}</span>
                                  </div>
                                  <div>
                                    {isSelected ? (
                                      <span className="px-2 py-0.5 rounded-md bg-amber-600 text-white text-[10px] font-black shrink-0 flex items-center gap-1">
                                        <Check size={12} />
                                        <span>مرخصی</span>
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] shrink-0">
                                        انتخاب
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selected Count Summary */}
              {selectedClassesForLeave.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-bold flex items-center justify-between">
                  <span>مجموع جلسات انتخابی جهت ثبت مرخصی:</span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-amber-200 text-amber-950 font-mono font-black text-sm">
                    {selectedClassesForLeave.length} جلسه کلاس
                  </span>
                </div>
              )}

              {/* Reason for Absence Input */}
              <form onSubmit={handleCreateLeaveRequest} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">علت غیبت و دلیل موجه:</label>
                  <textarea
                    rows={3}
                    value={leaveAbsenceReason}
                    onChange={(e) => setLeaveAbsenceReason(e.target.value)}
                    placeholder="لطفاً علت غیبت و دلیل موجه خود را جهت بررسی مسئول آموزش قید فرمایید..."
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-amber-500 outline-none resize-none leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowLeaveRequestModal(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || selectedClassesForLeave.length === 0}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-amber-600/20 cursor-pointer flex items-center gap-1.5"
                  >
                    <Send size={15} />
                    <span>{isSubmitting ? 'در حال ارسال...' : 'ارسال درخواست مرخصی به مسئول آموزش'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================= Modal: Officer Review & Full Reply ======================= */}
      <AnimatePresence>
        {selectedRequestForReview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-2xl border border-slate-200 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {selectedRequestForReview.isLeaveRequest ? 'رسیدگی ویژه به درخواست مرخصی' : 'رسیدگی و نگارش پاسخ رسمی'}
                  </h3>
                  <p className="text-xs text-slate-500">متقاضی: {selectedRequestForReview.studentName} ({selectedRequestForReview.grade})</p>
                </div>
                <button onClick={() => setSelectedRequestForReview(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <span className="font-bold block text-slate-900">متن درخواست:</span>
                <p className="text-slate-700 whitespace-pre-line leading-relaxed">{selectedRequestForReview.description}</p>
              </div>

              {/* LEAVE REQUEST CLASS APPROVAL TABLE FOR OFFICER */}
              {selectedRequestForReview.isLeaveRequest && selectedRequestForReview.leaveDetails && (
                <div className="space-y-3 p-4 bg-amber-50/80 border border-amber-200 rounded-2xl">
                  <div className="flex items-center justify-between font-black text-xs text-amber-950 border-b border-amber-200 pb-2">
                    <span>جدول آموزشی کلاس‌های مرخصی طلبه جهت موافقت یا مخالفت:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allAppr: Record<string, 'approved' | 'rejected'> = {};
                          selectedRequestForReview.leaveDetails?.selectedClasses.forEach(c => {
                            allAppr[`${c.programId}_${c.dateShamsi}`] = 'approved';
                          });
                          setLeaveClassStatuses(allAppr);
                        }}
                        className="px-2 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold"
                      >
                        موافقت با تمام کلاس‌ها
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const allRej: Record<string, 'approved' | 'rejected'> = {};
                          selectedRequestForReview.leaveDetails?.selectedClasses.forEach(c => {
                            allRej[`${c.programId}_${c.dateShamsi}`] = 'rejected';
                          });
                          setLeaveClassStatuses(allRej);
                        }}
                        className="px-2 py-1 bg-rose-600 text-white rounded text-[11px] font-bold"
                      >
                        مخالفت با تمام کلاس‌ها
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {selectedRequestForReview.leaveDetails.selectedClasses.map((cls, idx) => {
                      const key = `${cls.programId}_${cls.dateShamsi}`;
                      const currentSt = leaveClassStatuses[key] || cls.status;

                      return (
                        <div key={idx} className="p-3 bg-white border border-amber-200 rounded-xl flex items-center justify-between text-xs gap-3">
                          <div>
                            <span className="font-bold text-slate-900 block">{cls.dayOfWeek} ({cls.dateShamsi}) - {cls.programTitle}</span>
                            <span className="text-[11px] text-slate-500">{cls.teacherName || 'استاد'}</span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setLeaveClassStatuses(prev => ({ ...prev, [key]: 'approved' }))}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1",
                                currentSt === 'approved' ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              )}
                            >
                              <Check size={14} />
                              <span>موافقت (موجه)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setLeaveClassStatuses(prev => ({ ...prev, [key]: 'rejected' }))}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1",
                                currentSt === 'rejected' ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-700 border border-rose-200"
                              )}
                            >
                              <X size={14} />
                              <span>مخالفت (غیرموجه)</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <form onSubmit={(e) => handleSaveOfficerReply(e)} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تعیین وضعیت درخواست:</label>
                  <select
                    value={replyStatus}
                    onChange={(e) => setReplyStatus(e.target.value as StudentRequestStatus)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
                  >
                    <option value="in_progress">🔄 در حال بررسی و اقدام</option>
                    <option value="resolved">✅ تکمیل و انجام شد</option>
                    <option value="rejected">❌ رد درخواست</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">متن پاسخ رسمی مسئول مربوطه:</label>
                  <textarea
                    rows={4}
                    value={officialReply}
                    onChange={(e) => setOfficialReply(e.target.value)}
                    placeholder="متن پاسخ و دستور رسمی به متقاضی را بنویسید..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-indigo-400 outline-none resize-none leading-relaxed"
                  />
                </div>

                {replyStatus === 'rejected' && (
                  <div>
                    <label className="block font-bold text-rose-700 mb-1">علت رد درخواست (الزامی):</label>
                    <textarea
                      rows={2}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="علت عدم تأیید تقاضا را برای اطلاع متقاضی بنویسید..."
                      className="w-full p-2.5 bg-rose-50/50 border border-rose-200 rounded-xl font-medium focus:bg-white outline-none resize-none"
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedRequestForReview(null)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={isReplying}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-600/20 cursor-pointer"
                  >
                    {isReplying ? 'در حال ثبت...' : 'ذخیره پاسخ و اعمال خودکار'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================= Modal: Officer Availability Toggle ======================= */}
      <AnimatePresence>
        {showOfficerToggleStatusModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md border border-slate-200 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900">تنظیم وضعیت پاسخگویی بخش</h3>
                <button onClick={() => setShowOfficerToggleStatusModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-slate-600 leading-relaxed">
                  در صورت فعال‌سازی حالت «عدم پاسخگویی»، امکان ثبت درخواست جدید در این بخش برای طلاب غیرفعال شده و پیام راهنما نمایش داده می‌شود.
                </p>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">پیام یا دلیل عدم پاسخگویی (اختیاری):</label>
                  <textarea
                    rows={3}
                    value={officerNoteDraft}
                    onChange={(e) => setOfficerNoteDraft(e.target.value)}
                    placeholder="مثال: به دلیل بازه امتحانات یا محاسبه شهریه، پذیرش درخواست‌ها تا پایان هفته غیرفعال است."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleToggleOfficerStatus(currentOfficerUnit, true, officerNoteDraft)}
                    className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer flex items-center justify-center gap-1"
                  >
                    <CheckCircle2 size={16} />
                    <span>فعال (پاسخگو)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleOfficerStatus(currentOfficerUnit, false, officerNoteDraft)}
                    className="py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer flex items-center justify-center gap-1"
                  >
                    <XCircle size={16} />
                    <span>خاموش (عدم پاسخگویی)</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================= Modal: Super Admin Settings ======================= */}
      <AnimatePresence>
        {showSuperAdminSettingsModal && isSuperAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md border border-slate-200 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900">تنظیمات سراسری سوپر ادمین</h3>
                <button onClick={() => setShowSuperAdminSettingsModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl space-y-2 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">۱. فعال بودن کلی سامانه ثبت درخواست:</span>
                    <button
                      onClick={() => handleSaveSuperAdminConfig(globalConfig.isGlobalVisibleForStudents, !globalConfig.isGlobalEnabled)}
                      className={cn(
                        "px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer",
                        globalConfig.isGlobalEnabled ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                      )}
                    >
                      {globalConfig.isGlobalEnabled ? 'فعال' : 'غیرفعال'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">در صورت غیرفعال بودن، ثبت هرگونه درخواست برای تمام طلاب مسدود می‌شود.</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl space-y-2 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">۲. نمایش در منوی طلاب (سطح ۳):</span>
                    <button
                      onClick={() => handleSaveSuperAdminConfig(!globalConfig.isGlobalVisibleForStudents, globalConfig.isGlobalEnabled)}
                      className={cn(
                        "px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer",
                        globalConfig.isGlobalVisibleForStudents ? "bg-emerald-600 text-white" : "bg-slate-600 text-white"
                      )}
                    >
                      {globalConfig.isGlobalVisibleForStudents ? 'نمایش داده شود' : 'مخفی شود'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">تعیین می‌کند که آیا آیکون ثبت درخواست در پنل طلاب نمایش داده شود یا خیر.</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================= Modal: Subject Management ======================= */}
      <AnimatePresence>
        {showSubjectSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg border border-slate-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900">مدیریت موضوعات و دسته‌بندی درخواست‌ها</h3>
                <button onClick={() => setShowSubjectSettingsModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">انتخاب واحد:</label>
                  <select
                    value={subjectSettingUnit}
                    onChange={(e) => setSubjectSettingUnit(e.target.value as RequestTargetUnit)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
                  >
                    <option value="education">واحد آموزش و امتحانات</option>
                    <option value="finance">واحد مالی و شهریه</option>
                    <option value="cultural_welfare">واحد فرهنگی و رفاهی</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <span className="font-bold text-slate-800 block">افزودن موضوع جدید:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newSubjectInput}
                      onChange={(e) => setNewSubjectInput(e.target.value)}
                      placeholder="عنوان موضوع جدید (مثلاً درخواست گواهی اشتغال)..."
                      className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddSubject}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shrink-0 cursor-pointer"
                    >
                      افزودن
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="font-bold text-slate-800 block">موضوعات موجود در این واحد:</span>
                  <div className="flex flex-wrap gap-2">
                    {(unitSettings[subjectSettingUnit]?.allowedCategories || []).map((cat) => (
                      <span key={cat} className="px-3 py-1.5 bg-slate-100 text-slate-800 rounded-xl font-bold border border-slate-200 flex items-center gap-2">
                        <span>{cat}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubject(cat)}
                          className="text-rose-500 hover:text-rose-700 cursor-pointer"
                          title="حذف موضوع"
                        >
                          <Trash2 size={13} />
                        </button>
                      </span>
                    ))}
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
