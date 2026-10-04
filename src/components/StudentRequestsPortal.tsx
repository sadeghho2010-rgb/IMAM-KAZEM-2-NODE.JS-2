import React, { useState, useEffect } from 'react';
import { 
  StudentRequest, 
  RequestTargetUnit, 
  StudentRequestStatus, 
  UnitRequestSettings,
  GlobalRequestsConfig 
} from '../types';
import { useAuth } from '../context/AuthContext';
import { localDb } from '../lib/localDb';
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
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export const DEFAULT_GLOBAL_REQUESTS_CONFIG: GlobalRequestsConfig = {
  id: 'global_requests_config',
  isGlobalVisibleForStudents: true, // سوپرادمین: آیا در منوی طلاب نمایش داده شود؟
  isGlobalEnabled: true,           // سوپرادمین: آیا ثبت درخواست فعال است؟
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
  const [activeUnitTab, setActiveUnitTab] = useState<RequestTargetUnit | 'all'>(isSuperAdmin ? 'all' : defaultOfficerUnit);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Drawers
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [selectedRequestForReview, setSelectedRequestForReview] = useState<StudentRequest | null>(null);
  const [showSuperAdminSettingsModal, setShowSuperAdminSettingsModal] = useState(false);
  const [showOfficerToggleStatusModal, setShowOfficerToggleStatusModal] = useState(false);
  const [showSubjectSettingsModal, setShowSubjectSettingsModal] = useState(false);
  const [subjectSettingUnit, setSubjectSettingUnit] = useState<RequestTargetUnit>('education');
  const [newSubjectInput, setNewSubjectInput] = useState('');

  // New Request Form State
  const [newUnit, setNewUnit] = useState<RequestTargetUnit>('education');
  const [newCategory, setNewCategory] = useState<string>('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Officer Reply Form State
  const [replyStatus, setReplyStatus] = useState<StudentRequestStatus>('in_progress');
  const [officialReply, setOfficialReply] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  // Officer toggle state form
  const [officerNoteDraft, setOfficerNoteDraft] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Load Requests
      const reqList = await localDb.getDocs<StudentRequest>('student_requests');
      if (Array.isArray(reqList)) {
        setRequests(reqList);
      }

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
    loadData();
  }, []);

  const triggerUpdateEvent = () => {
    window.dispatchEvent(new CustomEvent('student_requests_updated'));
  };

  // Determine which unit this logged-in officer belongs to
  const currentOfficerUnit: RequestTargetUnit = isEduOfficer 
    ? 'education' 
    : isFinOfficer 
    ? 'finance' 
    : isCulturalOfficer 
    ? 'cultural_welfare' 
    : (activeUnitTab !== 'all' ? activeUnitTab : 'education');

  const isCurrentOfficerAccepting = globalConfig.officersStatus[currentOfficerUnit]?.isAccepting ?? true;

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

    // Also sync with unit_request_settings
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
    
    const updatedCategories = [...currentUnitSettings.allowedCategories, newSubjectInput.trim()];
    const updatedSettings: UnitRequestSettings = {
      ...currentUnitSettings,
      allowedCategories: updatedCategories,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || currentUser?.username || 'system'
    };

    try {
      await localDb.saveDoc('unit_request_settings', updatedSettings.id, updatedSettings);
      setUnitSettings(prev => ({
        ...prev,
        [subjectSettingUnit]: updatedSettings
      }));
      setNewSubjectInput('');
      triggerUpdateEvent();
    } catch (e) {
      console.error('Error saving new subject:', e);
      alert('خطا در ذخیره‌سازی موضوع جدید در پایگاه داده.');
    }
  };

  // Delete a category/subject from the selected unit
  const handleDeleteSubject = async (subjectToDelete: string) => {
    const currentUnitSettings = unitSettings[subjectSettingUnit];
    if (currentUnitSettings.allowedCategories.length <= 1) {
      alert('هر واحد باید حداقل دارای یک موضوع معتبر باشد.');
      return;
    }
    if (!window.confirm(`آیا مایل به حذف موضوع «${subjectToDelete}» هستید؟`)) return;

    const updatedCategories = currentUnitSettings.allowedCategories.filter(cat => cat !== subjectToDelete);
    const updatedSettings: UnitRequestSettings = {
      ...currentUnitSettings,
      allowedCategories: updatedCategories,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || currentUser?.username || 'system'
    };

    try {
      await localDb.saveDoc('unit_request_settings', updatedSettings.id, updatedSettings);
      setUnitSettings(prev => ({
        ...prev,
        [subjectSettingUnit]: updatedSettings
      }));
      triggerUpdateEvent();
    } catch (e) {
      console.error('Error deleting subject:', e);
      alert('خطا در حذف موضوع از پایگاه داده.');
    }
  };

  // Submit New Request by Student
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
    const newRecord: StudentRequest = {
      id: newReqId,
      studentId: currentUser?.studentId || currentUser?.id || 'std_unknown',
      studentName: currentUser?.studentName || currentUser?.name || currentUser?.fullName || 'طلبه گرامی',
      nationalCode: currentUser?.nationalCode,
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

  // Submit Officer Review / Quick Status / Full Reply
  const handleSaveOfficerReply = async (e?: React.FormEvent, overrideStatus?: StudentRequestStatus) => {
    if (e) e.preventDefault();
    if (!selectedRequestForReview) return;

    const finalStatus = overrideStatus || replyStatus;

    if (finalStatus === 'rejected' && !rejectionReason.trim() && !officialReply.trim()) {
      alert('در صورت رد درخواست، ذکر دلیل برای آگاهی طلبه الزامی است.');
      return;
    }

    setIsReplying(true);
    const updated: StudentRequest = {
      ...selectedRequestForReview,
      status: finalStatus,
      statusTitle: finalStatus === 'resolved' ? 'تکمیل و انجام شد' : finalStatus === 'rejected' ? 'رد درخواست' : 'در حال بررسی',
      officialReply: officialReply.trim() || selectedRequestForReview.officialReply,
      rejectionReason: finalStatus === 'rejected' ? (rejectionReason.trim() || officialReply.trim()) : undefined,
      repliedBy: currentUser?.id,
      repliedByName: currentUser?.name || currentUser?.roleTitle,
      repliedAt: new Date().toISOString(),
      isReadByOfficer: true,
      isReadByStudent: false, // Student sees glowing badge
      updatedAt: new Date().toISOString()
    };

    try {
      await localDb.saveDoc('student_requests', updated.id, updated);
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      setSelectedRequestForReview(null);
      setOfficialReply('');
      setRejectionReason('');
      triggerUpdateEvent();
    } catch (err: any) {
      alert('خطا در ذخیره پاسخ: ' + (err?.message || ''));
    } finally {
      setIsReplying(false);
    }
  };

  // Quick Action directly from card (تیک انجام شد، در حال بررسی، رد درخواست)
  const handleQuickStatusChange = async (req: StudentRequest, newStatus: StudentRequestStatus) => {
    const updated: StudentRequest = {
      ...req,
      status: newStatus,
      statusTitle: newStatus === 'resolved' ? 'تکمیل و انجام شد' : newStatus === 'rejected' ? 'رد درخواست' : 'در حال بررسی',
      repliedBy: currentUser?.id,
      repliedByName: currentUser?.name || currentUser?.roleTitle,
      repliedAt: new Date().toISOString(),
      isReadByOfficer: true,
      isReadByStudent: false,
      updatedAt: new Date().toISOString()
    };

    try {
      await localDb.saveDoc('student_requests', updated.id, updated);
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      triggerUpdateEvent();
    } catch (e) {
      alert('خطا در تغییر سریع وضعیت.');
    }
  };

  // Mark student request as read by student
  const handleMarkAsReadByStudent = async (req: StudentRequest) => {
    if (req.isReadByStudent !== false) return;
    const updated = { ...req, isReadByStudent: true };
    try {
      await localDb.saveDoc('student_requests', req.id, updated);
      setRequests(prev => prev.map(r => r.id === req.id ? updated : r));
      triggerUpdateEvent();
    } catch (e) {}
  };

  // Filter requests
  const filteredRequests = requests.filter(r => {
    if (isStudentUser) {
      // Student only sees their own requests
      const isMine = r.studentId === (currentUser.studentId || currentUser.id) || 
                     r.studentName === (currentUser.studentName || currentUser.name);
      if (!isMine) return false;
    } else {
      // Officer sees requests matching active unit tab (or all for super admin)
      if (activeUnitTab !== 'all' && r.unit !== activeUnitTab) return false;
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

  const getStatusBadge = (status: StudentRequestStatus) => {
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
                ? 'ارسال آنلاین درخواست به مسئول آموزش، مالی یا فرهنگی و پیگیری وضعیت پاسخ‌ها'
                : 'بررسی، تعیین وضعیت (انجام شد / در حال بررسی / رد) و صدور پاسخ رسمی به مراجعین'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Action: New Request (Available ONLY for Level 3 Students) */}
          {isStudentUser && (
            <button
              onClick={() => {
                setNewUnit(activeUnitTab !== 'all' ? activeUnitTab : 'education');
                setNewCategory(unitSettings[activeUnitTab !== 'all' ? activeUnitTab : 'education']?.allowedCategories[0] || '');
                setShowNewRequestModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
            >
              <PlusCircle size={16} />
              <span>ثبت درخواست جدید</span>
            </button>
          )}

          {/* Super Admin Control Modal Button */}
          {isSuperAdmin && (
            <button
              onClick={() => setShowSuperAdminSettingsModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0"
              title="کنترل دسترسی سوپرادمین: نمایش در منوی طلاب و فعال/غیرفعال بودن سراسری"
            >
              <Sliders size={15} />
              <span>کنترل سراسری (سوپر ادمین)</span>
            </button>
          )}

          {/* Manage Request Subjects Button (Super Admin & Education Manager) */}
          {(isSuperAdmin || isEduOfficer) && (
            <button
              onClick={() => {
                setSubjectSettingUnit(isEduOfficer ? 'education' : 'education');
                setShowSubjectSettingsModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0"
              title="مدیریت و افزودن موضوعات درخواست‌ها"
            >
              <Settings size={15} />
              <span>مدیریت موضوعات درخواست‌ها</span>
            </button>
          )}

          {/* Refresh Data Button */}
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
            title="بروزرسانی اطلاعات"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin text-indigo-600" : ""} />
          </button>
        </div>
      </div>

      {/* ======================= Super Admin Global Status Notice ======================= */}
      {!globalConfig.isGlobalEnabled && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-rose-900 text-xs font-bold flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-rose-600 shrink-0" />
            <span>
              <strong>هشدار سراسری:</strong> ثبت درخواست‌ها در حال حاضر توسط سوپرادمین به طور کلی <strong>غیرفعال</strong> شده است.
            </span>
          </div>
          {isSuperAdmin && (
            <button
              onClick={() => handleSaveSuperAdminConfig(globalConfig.isGlobalVisibleForStudents, true)}
              className="px-3 py-1 bg-rose-600 text-white rounded-lg text-[11px] font-bold shrink-0 hover:bg-rose-700 cursor-pointer"
            >
              فعال‌سازی سراسری
            </button>
          )}
        </div>
      )}

      {/* ======================= Officer Dedicated Availability Switcher ======================= */}
      {!isStudentUser && (
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
              <p className="text-[11px] text-slate-400 mt-1">
                {isCurrentOfficerAccepting 
                  ? 'طلبه‌ها می‌توانند برای واحد شما درخواست ارسال کنند.' 
                  : (globalConfig.officersStatus[currentOfficerUnit]?.statusNote || 'پذیرش درخواست برای واحد شما غیرفعال است.')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setOfficerNoteDraft(globalConfig.officersStatus[currentOfficerUnit]?.statusNote || '');
                setShowOfficerToggleStatusModal(true);
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs",
                isCurrentOfficerAccepting
                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              )}
            >
              {isCurrentOfficerAccepting ? (
                <>
                  <ToggleRight size={16} />
                  <span>تغییر به عدم پاسخگویی (خاموش)</span>
                </>
              ) : (
                <>
                  <ToggleLeft size={16} />
                  <span>فعال‌سازی حالت پاسخگویی (روشن)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ======================= Student View: 3 Officers Status Cards ======================= */}
      {isStudentUser && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <Building2 size={16} className="text-indigo-600" />
              <span>وضعیت پاسخگویی مسئولین واحدها:</span>
            </h2>
            <span className="text-[11px] text-slate-400">
              {globalConfig.isGlobalEnabled ? 'سامانه فعال است' : 'سامانه موقتاً غیرفعال است'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {(['education', 'finance', 'cultural_welfare'] as RequestTargetUnit[]).map((u) => {
              const statusInfo = globalConfig.officersStatus[u];
              const isAccepting = statusInfo?.isAccepting && globalConfig.isGlobalEnabled;
              const setting = unitSettings[u];

              return (
                <div
                  key={u}
                  className={cn(
                    "p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 shadow-xs",
                    isAccepting 
                      ? "bg-white border-emerald-200/80 hover:border-emerald-300" 
                      : "bg-slate-50/80 border-slate-200 opacity-90"
                  )}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900">{statusInfo?.officerTitle}</span>
                      <span className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1",
                        isAccepting 
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300" 
                          : "bg-rose-100 text-rose-800 border border-rose-300"
                      )}>
                        {isAccepting ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                        {isAccepting ? 'پاسخگو' : 'عدم پاسخگویی'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {isAccepting 
                        ? (statusInfo?.statusNote || 'آماده دریافت و بررسی درخواست‌های متقاضیان') 
                        : (statusInfo?.statusNote || setting?.disabledNoticeMessage || 'در حال حاضر دریافت درخواست غیرفعال است.')}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      مسئول: {statusInfo?.officerName || 'مسئول مربوطه'}
                    </span>

                    {isAccepting ? (
                      <button
                        onClick={() => {
                          setNewUnit(u);
                          setNewCategory(setting?.allowedCategories[0] || '');
                          setShowNewRequestModal(true);
                        }}
                        className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Send size={11} />
                        <span>ارسال به این واحد</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-rose-600 font-bold">
                        غیرقابل ارسال
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================= Officer Unit Tabs (Education / Finance / Cultural / All) ======================= */}
      {!isStudentUser && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setActiveUnitTab('all')}
              className={cn(
                "p-3.5 rounded-2xl border text-right transition-all cursor-pointer",
                activeUnitTab === 'all'
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white border-slate-200 hover:bg-slate-50 text-slate-800"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black">همه واحدها (کل مراجعین)</span>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-black",
                  activeUnitTab === 'all' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                )}>
                  {requests.length}
                </span>
              </div>
              <p className={cn("text-[10px] mt-1", activeUnitTab === 'all' ? "text-indigo-100" : "text-slate-400")}>
                مشاهده تجمیعی کل درخواست‌ها
              </p>
            </button>
          )}

          {(['education', 'finance', 'cultural_welfare'] as RequestTargetUnit[]).map((u) => {
            const countPending = requests.filter(r => r.unit === u && (r.status === 'pending' || r.isReadByOfficer === false)).length;
            const statusInfo = globalConfig.officersStatus[u];
            const isActive = activeUnitTab === u;

            return (
              <button
                key={u}
                type="button"
                onClick={() => setActiveUnitTab(u)}
                className={cn(
                  "p-3.5 rounded-2xl border text-right transition-all cursor-pointer relative overflow-hidden",
                  isActive 
                    ? "bg-indigo-50/90 border-indigo-400 shadow-sm" 
                    : "bg-white border-slate-200/80 hover:bg-slate-50"
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black text-slate-900">{statusInfo?.officerTitle}</span>
                  {countPending > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse flex items-center gap-1 shadow-xs">
                      <span>🔥 {countPending}</span>
                      <span className="hidden sm:inline">جدید</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>وضعیت:</span>
                  <span className={cn("font-bold text-[10px]", statusInfo?.isAccepting ? "text-emerald-600" : "text-rose-600")}>
                    {statusInfo?.isAccepting ? '● پاسخگو' : '○ عدم پاسخگویی'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ======================= Search & Filter Bar ======================= */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute right-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در عنوان، نام متقاضی، موضوع، شرح یا پاسخ رسمی..."
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
            <option value="resolved">✅ انجام شد و تکمیل گردید</option>
            <option value="rejected">❌ رد درخواست</option>
          </select>
        </div>
      </div>

      {/* ======================= Request Cards List ======================= */}
      <div className="space-y-3.5">
        {isLoading ? (
          <div className="bg-white rounded-3xl p-16 text-center text-slate-400 flex flex-col items-center gap-2 border border-slate-200">
            <Loader2 size={28} className="animate-spin text-indigo-600" />
            <span className="text-xs font-semibold">در حال بارگذاری درخواست‌ها...</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 text-center text-slate-400 border border-slate-200 flex flex-col items-center gap-2">
            <Inbox size={40} className="text-slate-300" />
            <p className="text-sm font-bold text-slate-700">هیچ درخواستی در این بخش یافت نشد.</p>
            <p className="text-xs text-slate-400">
              {isStudentUser 
                ? 'با کلیک بر روی «ثبت درخواست جدید» می‌توانید فرم ارسال نمایید.' 
                : 'درخواست‌های جدید ارسالی از سوی طلاب در این کارتابل نمایش داده خواهند شد.'}
            </p>
          </div>
        ) : (
          filteredRequests.map((req) => {
            const isUnreadForOfficer = !isStudentUser && (req.status === 'pending' || req.isReadByOfficer === false);
            const isUnreadForStudent = isStudentUser && req.isReadByStudent === false;

            return (
              <div
                key={req.id}
                onClick={() => {
                  if (isStudentUser) handleMarkAsReadByStudent(req);
                }}
                className={cn(
                  "bg-white rounded-2xl p-5 border transition-all shadow-xs space-y-3.5 relative",
                  isUnreadForOfficer ? "border-amber-300 bg-amber-50/15 ring-1 ring-amber-200" :
                  isUnreadForStudent ? "border-emerald-300 bg-emerald-50/20 ring-1 ring-emerald-200" :
                  req.status === 'resolved' ? "border-emerald-200/80" :
                  req.status === 'rejected' ? "border-rose-200/80" : "border-slate-200/80"
                )}
              >
                {/* Header line of card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {req.category}
                    </span>

                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                      {req.unit === 'education' ? 'آموزش' : req.unit === 'finance' ? 'مالی' : 'فرهنگی/رفاهی'}
                    </span>

                    <h3 className="text-sm font-black text-slate-900 mr-1">{req.title}</h3>

                    {isUnreadForOfficer && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                        جدید 🔥
                      </span>
                    )}

                    {isUnreadForStudent && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white animate-bounce">
                        پاسخ جدید 📩
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusBadge(req.status)}
                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(req.createdAt).toLocaleDateString('fa-IR')}
                    </span>
                  </div>
                </div>

                {/* Body / Student Request Description */}
                <div className="text-xs text-slate-700 leading-relaxed bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                  <span className="block font-bold text-slate-900 mb-1 text-[11px]">متن درخواست طلبه:</span>
                  {req.description}
                </div>

                {/* Official Officer Reply */}
                {req.officialReply && (
                  <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-emerald-900 font-bold text-[11px]">
                      <span className="flex items-center gap-1.5">
                        <MessageSquare size={14} className="text-emerald-700" />
                        پاسخ و توضیحات رسمی مسئول ({req.repliedByName || 'مسئول واحد'}):
                      </span>
                      {req.repliedAt && (
                        <span className="font-mono text-[10px] text-emerald-700">
                          {new Date(req.repliedAt).toLocaleDateString('fa-IR')}
                        </span>
                      )}
                    </div>
                    <p className="text-emerald-900 leading-relaxed font-medium">{req.officialReply}</p>
                  </div>
                )}

                {/* Rejection Note */}
                {req.rejectionReason && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1">
                    <span className="text-rose-900 font-bold text-[11px] flex items-center gap-1">
                      <XCircle size={13} className="text-rose-600" />
                      علت عدم تأیید و رد درخواست:
                    </span>
                    <p className="text-rose-800 font-medium">{req.rejectionReason}</p>
                  </div>
                )}

                {/* Footer Bar: Student info & Quick Action Checkboxes for Officer */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 text-[11px] text-slate-500 border-t border-slate-100/80">
                  <div className="flex flex-wrap items-center gap-3">
                    <span>
                      متقاضی: <strong className="text-slate-800">{req.studentName}</strong> {req.grade ? `(${req.grade})` : ''}
                    </span>
                    <span>
                      اولویت: <strong className={cn(
                        req.priority === 'urgent' ? "text-rose-600" :
                        req.priority === 'high' ? "text-amber-600" : "text-slate-700"
                      )}>
                        {req.priority === 'urgent' ? 'فوری و ضروری' : req.priority === 'high' ? 'بالا' : 'عادی'}
                      </strong>
                    </span>
                  </div>

                  {/* Officer Actions: Quick Status Ticks + Full Reply Modal */}
                  {!isStudentUser && (
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Quick Status Buttons */}
                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(req, 'resolved')}
                        className={cn(
                          "px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer",
                          req.status === 'resolved' 
                            ? "bg-emerald-600 text-white shadow-xs" 
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                        )}
                        title="تغییر وضعیت به انجام شد"
                      >
                        <Check size={12} />
                        <span>انجام شد</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(req, 'in_progress')}
                        className={cn(
                          "px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer",
                          req.status === 'in_progress' 
                            ? "bg-blue-600 text-white shadow-xs" 
                            : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                        )}
                        title="تغییر وضعیت به در حال بررسی"
                      >
                        <Clock size={12} />
                        <span>در حال بررسی</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(req, 'rejected')}
                        className={cn(
                          "px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer",
                          req.status === 'rejected' 
                            ? "bg-rose-600 text-white shadow-xs" 
                            : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                        )}
                        title="تغییر وضعیت به رد درخواست"
                      >
                        <X size={12} />
                        <span>رد درخواست</span>
                      </button>

                      {/* Open Full Review & Official Reply Modal */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRequestForReview(req);
                          setReplyStatus(req.status);
                          setOfficialReply(req.officialReply || '');
                          setRejectionReason(req.rejectionReason || '');
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                      >
                        <Send size={12} />
                        <span>نگارش پاسخ رسمی و جزئیات</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ======================= Modal: New Request Form ======================= */}
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
                  <h3 className="text-sm font-black text-slate-900">ثبت تقاضا و درخواست اداری / رفاهی</h3>
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

                  {!globalConfig.officersStatus[newUnit]?.isAccepting && (
                    <p className="text-[11px] text-rose-600 font-bold mt-1">
                      ⚠️ مسئول این واحد در حال حاضر در وضعیت عدم پاسخگویی قرار دارد.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">موضوع / دسته‌بندی تقاضا:</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
                  >
                    {(unitSettings[newUnit]?.allowedCategories || []).map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">عنوان خلاصه تقاضا:</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="مثال: درخواست صدور گواهی اشتغال به تحصیل یا وام قرض‌الحسنه..."
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-indigo-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">شرح و توضیحات کامل تقاضا:</label>
                  <textarea
                    rows={4}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="لطفاً جزئیات تقاضا، علت و اطلاعات تکمیلی خود را به طور کامل قید فرمایید..."
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-indigo-400 outline-none resize-none leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">میزان اولویت و فوریت:</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 outline-none"
                  >
                    <option value="low">عادی</option>
                    <option value="medium">متوسط</option>
                    <option value="high">بالا</option>
                    <option value="urgent">فوری و ضروری</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowNewRequestModal(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    <span>ارسال نهایی درخواست</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================= Modal: Officer Full Review & Reply Form ======================= */}
      <AnimatePresence>
        {selectedRequestForReview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg border border-slate-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare size={20} className="text-indigo-600" />
                  <h3 className="text-sm font-black text-slate-900">بررسی و نگارش پاسخ رسمی به طلبه</h3>
                </div>
                <button onClick={() => setSelectedRequestForReview(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              {/* Stepped Progress Bar: ۱. ثبت طلبه ➔ ۲. بررسی معاونت ➔ ۳. صدور پاسخ */}
              <div className="p-3 bg-slate-50/90 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between relative px-2">
                  {/* Background Track Line */}
                  <div className="absolute top-3.5 right-8 left-8 h-1 bg-slate-200 -z-0" />
                  {/* Active Highlight Line */}
                  <div 
                    className={cn(
                      "absolute top-3.5 right-8 h-1 transition-all duration-500 -z-0",
                      selectedRequestForReview.status === 'pending'
                        ? "w-1/2 bg-blue-500"
                        : "w-[calc(100%-4rem)] bg-emerald-500"
                    )} 
                  />

                  {/* Step 1: ثبت طلبه */}
                  <div className="flex flex-col items-center gap-1 z-10 select-none">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs shadow-md shadow-emerald-500/25 ring-2 ring-emerald-100">
                      <Check size={14} />
                    </div>
                    <span className="text-[10px] font-black text-slate-800">۱. ثبت طلبه</span>
                  </div>

                  {/* Step 2: بررسی معاونت */}
                  <div className="flex flex-col items-center gap-1 z-10 select-none">
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-md transition-all ring-2",
                      selectedRequestForReview.status === 'pending'
                        ? "bg-blue-600 text-white animate-pulse shadow-blue-500/25 ring-blue-100"
                        : "bg-emerald-600 text-white shadow-emerald-500/25 ring-emerald-100"
                    )}>
                      {selectedRequestForReview.status === 'pending' ? <Clock size={13} /> : <Check size={14} />}
                    </div>
                    <span className="text-[10px] font-black text-slate-800">۲. بررسی معاونت</span>
                  </div>

                  {/* Step 3: صدور پاسخ */}
                  <div className="flex flex-col items-center gap-1 z-10 select-none">
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-md transition-all ring-2",
                      selectedRequestForReview.status === 'resolved'
                        ? "bg-emerald-600 text-white shadow-emerald-500/25 ring-emerald-100"
                        : selectedRequestForReview.status === 'rejected'
                        ? "bg-rose-600 text-white shadow-rose-500/25 ring-rose-100"
                        : "bg-slate-200 text-slate-500 border border-slate-300 ring-slate-100"
                    )}>
                      {selectedRequestForReview.status === 'resolved' ? (
                        <CheckCircle2 size={14} />
                      ) : selectedRequestForReview.status === 'rejected' ? (
                        <XCircle size={14} />
                      ) : (
                        <span className="text-[10px] font-black">۳</span>
                      )}
                    </div>
                    <span className={cn(
                      "text-[10px] font-black",
                      selectedRequestForReview.status === 'resolved' ? "text-emerald-700" :
                      selectedRequestForReview.status === 'rejected' ? "text-rose-700" : "text-slate-500"
                    )}>
                      ۳. نتیجه نهایی
                    </span>
                  </div>
                </div>
              </div>

              {/* Student Details Summary Box */}
              <div className="p-3.5 bg-slate-50 rounded-2xl space-y-1.5 text-xs border border-slate-100">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>متقاضی: {selectedRequestForReview.studentName} ({selectedRequestForReview.category})</span>
                  <span className="font-mono text-slate-400">{new Date(selectedRequestForReview.createdAt).toLocaleDateString('fa-IR')}</span>
                </div>
                <div className="text-slate-700 leading-relaxed font-medium bg-white p-2.5 rounded-xl border border-slate-200/60">
                  {selectedRequestForReview.description}
                </div>
              </div>

              <form onSubmit={(e) => handleSaveOfficerReply(e)} className="space-y-3.5 text-xs">
                {/* 3 Status Buttons Selection */}
                <div>
                  <label className="block font-bold text-slate-700 mb-2">تعیین وضعیت درخواست:</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setReplyStatus('resolved')}
                      className={cn(
                        "py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer",
                        replyStatus === 'resolved' 
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" 
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700"
                      )}
                    >
                      <CheckCircle2 size={13} />
                      <span>انجام شد</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReplyStatus('in_progress')}
                      className={cn(
                        "py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer",
                        replyStatus === 'in_progress' 
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm" 
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50 hover:text-blue-700"
                      )}
                    >
                      <Clock size={13} />
                      <span>در حال بررسی</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReplyStatus('rejected')}
                      className={cn(
                        "py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer",
                        replyStatus === 'rejected' 
                          ? "bg-rose-600 text-white border-rose-600 shadow-sm" 
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-rose-50 hover:text-rose-700"
                      )}
                    >
                      <XCircle size={13} />
                      <span>رد درخواست</span>
                    </button>
                  </div>
                </div>

                {replyStatus === 'rejected' ? (
                  <div>
                    <label className="block font-bold text-rose-700 mb-1">دلیل رسمی رد درخواست (الزامی جهت اطلاع طلبه):</label>
                    <textarea
                      rows={3}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="لطفاً علت عدم موافقت یا شرایط لازم را برای طلبه شرح دهید..."
                      required
                      className="w-full p-2.5 bg-rose-50/60 border border-rose-200 rounded-xl font-medium outline-none resize-none leading-relaxed text-rose-950"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">متن توضیحات و پاسخ کامل رسمی مسئول:</label>
                    <textarea
                      rows={3}
                      value={officialReply}
                      onChange={(e) => setOfficialReply(e.target.value)}
                      placeholder="متن دستور، شماره گواهی، زمان تحویل، تاریخ واریز وام یا راهنمایی لازم برای متقاضی..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none resize-none leading-relaxed"
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedRequestForReview(null)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer"
                  >
                    بستن
                  </button>
                  <button
                    type="submit"
                    disabled={isReplying}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
                  >
                    {isReplying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    <span>ثبت پاسخ و ابلاغ به طلبه</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================= Modal: Super Admin Master Controls ======================= */}
      <AnimatePresence>
        {showSuperAdminSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg border border-slate-200 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders size={20} className="text-indigo-600" />
                  <h3 className="text-sm font-black text-slate-900">کنترل سراسری سامانه درخواست‌ها (سوپر ادمین)</h3>
                </div>
                <button onClick={() => setShowSuperAdminSettingsModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* Switch 1: Visible in Student Menu */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-slate-900">نمایش پنل درخواست در منوی طلاب (سطح ۳)</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      در صورت خاموش بودن، این بخش کلاً از منو و سایدبار طلاب مخفی می‌شود.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveSuperAdminConfig(!globalConfig.isGlobalVisibleForStudents, globalConfig.isGlobalEnabled)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1",
                      globalConfig.isGlobalVisibleForStudents
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 text-slate-700"
                    )}
                  >
                    {globalConfig.isGlobalVisibleForStudents ? <Eye size={14} /> : <EyeOff size={14} />}
                    <span>{globalConfig.isGlobalVisibleForStudents ? 'نمایش داده شود' : 'مخفی باشد'}</span>
                  </button>
                </div>

                {/* Switch 2: Global Enabled */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-slate-900">فعال بودن سراسری ثبت درخواست‌ها</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      در صورت خاموش بودن، ارسال درخواست در سراسر سیستم قفل می‌شود.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveSuperAdminConfig(globalConfig.isGlobalVisibleForStudents, !globalConfig.isGlobalEnabled)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1",
                      globalConfig.isGlobalEnabled
                        ? "bg-emerald-600 text-white"
                        : "bg-rose-600 text-white"
                    )}
                  >
                    {globalConfig.isGlobalEnabled ? <Check size={14} /> : <X size={14} />}
                    <span>{globalConfig.isGlobalEnabled ? 'سامانه فعال است' : 'سامانه غیرفعال است'}</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSuperAdminSettingsModal(false)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  بستن و ذخیره
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================= Modal: Officer Toggle Status Modal ======================= */}
      <AnimatePresence>
        {showOfficerToggleStatusModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg border border-slate-200 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={20} className="text-indigo-600" />
                  <h3 className="text-sm font-black text-slate-900">
                    تنظیم وضعیت پاسخگویی واحد ({globalConfig.officersStatus[currentOfficerUnit]?.officerTitle})
                  </h3>
                </div>
                <button onClick={() => setShowOfficerToggleStatusModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">وضعیت پذیرش درخواست:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleOfficerStatus(currentOfficerUnit, true, officerNoteDraft)}
                      className={cn(
                        "py-2.5 px-3 rounded-xl font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                        isCurrentOfficerAccepting 
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" 
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50"
                      )}
                    >
                      <CheckCircle2 size={14} />
                      <span>حالت پاسخگویی (فعال و روشن)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleOfficerStatus(currentOfficerUnit, false, officerNoteDraft)}
                      className={cn(
                        "py-2.5 px-3 rounded-xl font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                        !isCurrentOfficerAccepting 
                          ? "bg-rose-600 text-white border-rose-600 shadow-sm" 
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-rose-50"
                      )}
                    >
                      <XCircle size={14} />
                      <span>عدم پاسخگویی (خاموش)</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    پیام یا دلیل عدم پاسخگویی (نمایش برای طلاب در صورت خاموش بودن):
                  </label>
                  <textarea
                    rows={3}
                    value={officerNoteDraft}
                    onChange={(e) => setOfficerNoteDraft(e.target.value)}
                    placeholder="مثال: به دلیل بازه امتحانات یا محاسبه شهریه، پذیرش درخواست‌ها موقتاً مقدور نمی‌باشد..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none resize-none leading-relaxed"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowOfficerToggleStatusModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleOfficerStatus(currentOfficerUnit, !isCurrentOfficerAccepting, officerNoteDraft)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
                >
                  ذخیره وضعیت جدید
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================= Modal: Manage Request Subjects (Super Admin & Education Manager) ======================= */}
      <AnimatePresence>
        {showSubjectSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg border border-slate-200 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Settings size={20} className="text-indigo-600 animate-spin-slow" />
                  <h3 className="text-sm font-black text-slate-900">مدیریت موضوعات درخواست‌های طلاب</h3>
                </div>
                <button 
                  onClick={() => {
                    setShowSubjectSettingsModal(false);
                    setNewSubjectInput('');
                  }} 
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* Unit Selector Tabs */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">انتخاب واحد جهت مدیریت موضوعات:</label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setSubjectSettingUnit('education')}
                      className={cn(
                        "py-2 rounded-lg font-bold text-[11px] transition-all cursor-pointer",
                        subjectSettingUnit === 'education'
                          ? "bg-white text-indigo-900 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      واحد آموزش
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubjectSettingUnit('finance')}
                      className={cn(
                        "py-2 rounded-lg font-bold text-[11px] transition-all cursor-pointer",
                        subjectSettingUnit === 'finance'
                          ? "bg-white text-indigo-900 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      واحد مالی
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubjectSettingUnit('cultural_welfare')}
                      className={cn(
                        "py-2 rounded-lg font-bold text-[11px] transition-all cursor-pointer",
                        subjectSettingUnit === 'cultural_welfare'
                          ? "bg-white text-indigo-900 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      واحد فرهنگی و رفاهی
                    </button>
                  </div>
                </div>

                {/* Categories List */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700">موضوعات فعال فعلی:</label>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar">
                    {((unitSettings[subjectSettingUnit]?.allowedCategories) || []).map((cat) => (
                      <div 
                        key={cat} 
                        className="flex items-center justify-between gap-2 p-2 bg-white rounded-xl border border-slate-100 shadow-3xs hover:border-slate-300 transition-colors"
                      >
                        <span className="font-bold text-slate-800">{cat}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteSubject(cat)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                          title="حذف این موضوع"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add New Category Form */}
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <label className="block font-bold text-slate-700">افزودن موضوع جدید به این واحد:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSubjectInput}
                      onChange={(e) => setNewSubjectInput(e.target.value)}
                      placeholder="مثال: درخواست تأییدیه مدارک یا تسویه..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSubject();
                        }
                      }}
                      className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-indigo-400 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddSubject}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <PlusCircle size={14} />
                      <span>افزودن</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowSubjectSettingsModal(false);
                    setNewSubjectInput('');
                  }}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-200"
                >
                  بستن پنجره
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
