import React from 'react';
import { 
  Users, 
  Calendar, 
  CalendarDays,
  BookOpen, 
  MessageSquare, 
  CheckSquare, 
  BarChart2, 
  UserCheck,
  BrainCircuit,
  GraduationCap,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  Clock,
  LogOut,
  Settings,
  Award,
  User,
  Eye,
  DoorOpen,
  GitBranch,
  Sparkles,
  Activity,
  BookCheck,
  Wallet,
  Coins,
  UtensilsCrossed,
  Building2,
  Receipt,
  FileSpreadsheet,
  HandCoins,
  Car,
  BookOpenCheck,
  ChevronDown,
  Terminal,
  KeyRound,
  Inbox,
  ShieldAlert,
  Database,
  Sliders,
  HeartPulse
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useMentor } from '../context/MentorContext';
import { useAuth } from '../context/AuthContext';
import { localDb } from '../lib/localDb';
import { StudentRequest, AnomalyLog, GlobalRequestsConfig, WorkflowItem } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onOpenSettings?: () => void;
}

interface MenuItemDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export interface MenuCategoryDef {
  id: string;
  title: string;
  itemIds: string[];
}

export const MENU_CATEGORIES: MenuCategoryDef[] = [
  {
    id: 'requests_group',
    title: 'کارتابل و رسیدگی به امور',
    itemIds: ['student-requests', 'workflow', 'todos']
  },
  {
    id: 'education_group',
    title: 'امور آموزش و کلاس‌های درس',
    itemIds: [
      'programs',
      'classrooms',
      'student-schedule',
      'teachers-schedule',
      'course-selection',
      'oral-exams',
      'academic-calendar',
      'teachers-bank'
    ]
  },
  {
    id: 'students_group',
    title: 'امور طلاب و پایش',
    itemIds: [
      'students',
      'active-students',
      'attendance',
      'discussion',
      'stats',
      'comments',
      'summary'
    ]
  },
  {
    id: 'research_group',
    title: 'پژوهش و کلاس‌های مشاوره',
    itemIds: [
      'research',
      'article-evaluations',
      'counseling-classes',
      'consultation-advisor'
    ]
  },
  {
    id: 'finance_group',
    title: 'امور مالی، رفاهی و خدمات',
    itemIds: [
      'finance-tuition',
      'finance-grade-mentors',
      'finance-teachers',
      'finance-lunch',
      'student-meals',
      'finance-loans-fund',
      'finance-claims',
      'finance-expenses-reports',
      'presence-hours',
      'staff-bank',
      'education-financial-report',
      'lockers',
      'teacher-transport'
    ]
  },
  {
    id: 'system_group',
    title: 'مدیریت و امنیت سامانه',
    itemIds: [
      'user-management',
      'user-credentials',
      'backup',
      'system-health',
      'audit-logs',
      'app-logs',
      'db-save-errors',
      'anomaly-detection',
      'db-connection-test'
    ]
  }
];

const ALL_MENU_DEFINITIONS: MenuItemDef[] = [
  { id: 'dashboard', label: 'داشبورد اصلی', icon: Sparkles },
  { id: 'student-requests', label: 'پنل رسیدگی به درخواست', icon: Inbox },
  { id: 'student-meals', label: 'رزرو نهار و شام', icon: UtensilsCrossed },
  { id: 'student-portal', label: 'پرتال و ثبت فعالیت من', icon: User },
  { id: 'teacher-portal', label: 'پنل اساتید و ارزیابی', icon: GraduationCap },
  { id: 'todos', label: 'پیگیری‌ها', icon: GraduationCap },
  { id: 'workflow', label: 'جریان کار', icon: GitBranch },
  { id: 'academic-calendar', label: 'تقویم آموزشی', icon: CalendarDays },
  { id: 'presence-hours', label: 'ساعت حضور و کارکرد', icon: Clock },
  { id: 'finance-tuition', label: 'محاسبه شهریه طلاب', icon: Coins },
  { id: 'finance-grade-mentors', label: 'محاسبه حق‌الزحمه اساتید پایه', icon: BookOpen },
  { id: 'finance-teachers', label: 'محاسبه حق‌الزحمه اساتید', icon: Clock },
  { id: 'finance-lunch', label: 'اطلاعات نهار و شام', icon: UtensilsCrossed },
  { id: 'finance-claims', label: 'مطالبات و بدهی‌ها', icon: HandCoins },
  { id: 'finance-expenses-reports', label: 'هزینه‌ها', icon: Receipt },
  { id: 'students', label: 'مدیریت کل طلاب', icon: Users },
  { id: 'active-students', label: 'طلاب فعال', icon: UserCheck },
  { id: 'programs', label: 'برنامه‌های مدرسه و کلاس‌ها', icon: Calendar },
  { id: 'student-schedule', label: 'برنامه درسی و هفتگی طلاب', icon: CalendarDays },
  { id: 'teachers-schedule', label: 'برنامه درسی اساتید', icon: GraduationCap },
  { id: 'classrooms', label: 'مدرس‌ها (کلاس‌های درس)', icon: DoorOpen },
  { id: 'stats', label: 'آمار مطالعه طلاب', icon: BarChart2 },
  { id: 'discussion', label: 'گروه‌های بحثی', icon: Users },
  { id: 'research', label: 'بخش پژوهش و مقالات', icon: BookOpen },
  { id: 'article-evaluations', label: 'ارزیابی مقالات', icon: Award },
  { id: 'attendance', label: 'حضور و غیاب طلاب', icon: CheckSquare },
  { id: 'course-selection', label: 'سامانه انتخاب واحد', icon: BookOpenCheck },
  { id: 'oral-exams', label: 'آزمون شفاهی طلاب', icon: Award },
  { id: 'counseling-classes', label: 'کلاس‌های مشاوره (ارزیابی و نمرات)', icon: BookCheck },
  { id: 'comments', label: 'نظرات و ارزیابی‌ها', icon: MessageSquare },
  { id: 'summary', label: 'پرونده علمی طلاب', icon: BrainCircuit },
  { id: 'teachers-bank', label: 'بانک اساتید و مدرسین', icon: GraduationCap },
  { id: 'staff-bank', label: 'بانک کارکنان مجموعه', icon: Users },
  { id: 'lockers', label: 'اختصاص کمد', icon: KeyRound },
  { id: 'teacher-transport', label: 'سرویس و ایاب و ذهاب اساتید', icon: Car },
  { id: 'consultation-advisor', label: 'دستیار کلاس‌های مشاوره', icon: Sparkles },
  { id: 'backup', label: 'پشتیبان‌گیری دیتابیس', icon: HardDrive },
  { id: 'user-management', label: 'مدیریت کاربران و دسترسی‌ها', icon: Settings },
  { id: 'user-credentials', label: 'مدیریت ورود کاربران', icon: ShieldCheck },
  { id: 'audit-logs', label: 'فعالیت‌های سایت', icon: Activity },
  { id: 'app-logs', label: 'لاگ‌ها و خطاهای سیستم', icon: Terminal },
  { id: 'db-save-errors', label: 'خطاهای ثبت دیتابیس', icon: Database },
  { id: 'anomaly-detection', label: 'تشخیص ناهنجاری‌ها', icon: ShieldAlert },
  { id: 'education-financial-report', label: 'تنظیم گزارش مالی طلاب', icon: FileSpreadsheet },
  { id: 'db-connection-test', label: 'تست اتصال به دیتا بیس', icon: RefreshCw },
  { id: 'finance-loans-fund', label: 'صندوق قرض‌الحسنه و وام‌ها', icon: Building2 },
  { id: 'system-health', label: 'سلامت سیستم', icon: HeartPulse },
];

export default function Sidebar({ activeTab, setActiveTab, isOpen, onToggle, onOpenSettings }: SidebarProps) {
  const { currentMentor } = useMentor();
  const { currentUser, logout, hasModuleAccess, isReadOnly, isTabAllowed } = useAuth();

  const handleItemSelect = (tabId: string) => {
    setActiveTab(tabId);
    if (isOpen && typeof onToggle === 'function') {
      onToggle();
    }
  };
  const [isSiteManagementOpen, setIsSiteManagementOpen] = React.useState<boolean>(() => {
    return ['backup', 'user-credentials', 'audit-logs', 'app-logs', 'anomaly-detection', 'system-health'].includes(activeTab);
  });
  const [expandedCategoryId, setExpandedCategoryId] = React.useState<string | null>(() => {
    const activeCat = MENU_CATEGORIES.find(cat => cat.itemIds.includes(activeTab));
    return activeCat ? activeCat.id : (MENU_CATEGORIES[0]?.id || null);
  });

  const hoverCategoryTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleCategoryMouseEnter = (catId: string) => {
    // Read preferences dynamically in real-time
    let smartHover = true;
    try {
      const saved = localStorage.getItem('user_app_preferences');
      if (saved) {
        const parsed = JSON.parse(saved);
        smartHover = parsed.smartMenuHover !== false;
      }
    } catch {}

    if (!smartHover) return;

    if (hoverCategoryTimerRef.current) {
      clearTimeout(hoverCategoryTimerRef.current);
    }
    hoverCategoryTimerRef.current = setTimeout(() => {
      setExpandedCategoryId(catId);
    }, 200); // 0.2 seconds delay as requested
  };

  const handleCategoryMouseLeave = () => {
    if (hoverCategoryTimerRef.current) {
      clearTimeout(hoverCategoryTimerRef.current);
    }
  };

  const toggleCategory = (catId: string) => {
    if (hoverCategoryTimerRef.current) {
      clearTimeout(hoverCategoryTimerRef.current);
    }
    setExpandedCategoryId(prev => prev === catId ? null : catId);
  };

  // Sync expanded category with activeTab changes
  React.useEffect(() => {
    const activeCat = MENU_CATEGORIES.find(cat => cat.itemIds.includes(activeTab));
    if (activeCat) {
      setExpandedCategoryId(activeCat.id);
    }
  }, [activeTab]);

  React.useEffect(() => {
    return () => {
      if (hoverCategoryTimerRef.current) {
        clearTimeout(hoverCategoryTimerRef.current);
      }
    };
  }, []);

  // Real-time Badge Counts State
  const [unreadRequestsCount, setUnreadRequestsCount] = React.useState<number>(0);
  const [pendingWorkflowCount, setPendingWorkflowCount] = React.useState<number>(0);
  const [unresolvedAnomaliesCount, setUnresolvedAnomaliesCount] = React.useState<number>(0);
  const [globalRequestsConfig, setGlobalRequestsConfig] = React.useState<GlobalRequestsConfig | null>(null);

  const fetchBadgeCounts = async () => {
    try {
      // 1. Fetch Global Requests Config
      const gConfig = await localDb.getDoc<GlobalRequestsConfig>('global_requests_config', 'global_requests_config');
      if (gConfig) {
        setGlobalRequestsConfig(gConfig);
      }

      // 2. Fetch Requests & Calculate Target Badge Count
      const allRequests = await localDb.getDocs<StudentRequest>('student_requests');
      if (Array.isArray(allRequests)) {
        if (currentUser?.level === 3) {
          // For student: count requests with unread response from officers
          const count = allRequests.filter(r => 
            (r.studentId === (currentUser.studentId || currentUser.id) || r.studentName === currentUser.name) && 
            r.isReadByStudent === false &&
            (r.officialReply || r.status !== 'pending')
          ).length;
          setUnreadRequestsCount(count);
        } else {
          // For staff/officers: count pending / unread requests addressed to THEIR unit
          const isEdu = currentUser?.role === 'education_manager' || currentUser?.username === 'SHAH' || (currentUser?.name && currentUser.name.includes('آموزش'));
          const isFin = currentUser?.role === 'finance_manager' || currentUser?.username === 'MALI' || (currentUser?.name && currentUser.name.includes('مالی'));
          const isCult = currentUser?.role === 'cultural_manager' || currentUser?.role === 'research_manager' || currentUser?.username === 'YAZDANI';
          const isSuper = currentUser?.level === 1 || currentUser?.role === 'super_admin';

          let count = 0;
          if (isSuper) {
            count = allRequests.filter(r => r.status === 'pending' || r.isReadByOfficer === false).length;
          } else if (isEdu) {
            count = allRequests.filter(r => r.unit === 'education' && (r.status === 'pending' || r.isReadByOfficer === false)).length;
          } else if (isFin) {
            count = allRequests.filter(r => r.unit === 'finance' && (r.status === 'pending' || r.isReadByOfficer === false)).length;
          } else if (isCult) {
            count = allRequests.filter(r => r.unit === 'cultural_welfare' && (r.status === 'pending' || r.isReadByOfficer === false)).length;
          } else {
            count = allRequests.filter(r => r.status === 'pending' || r.isReadByOfficer === false).length;
          }

          setUnreadRequestsCount(count);
        }
      }

      // 3. Fetch Workflow items & Calculate Pending Approvals for destination role
      const allWorkflow = await localDb.getDocs<WorkflowItem>('workflow_items');
      if (Array.isArray(allWorkflow)) {
        const isSuper = currentUser?.level === 1 || currentUser?.role === 'super_admin';
        const isEdu = currentUser?.role === 'education_manager' || currentUser?.role === 'education_officer' || currentUser?.username?.toUpperCase() === 'SHAH';
        const isSupervisor = currentUser?.role === 'grade_supervisor' || currentUser?.role === 'grade_mentor';
        const userGrade = currentUser?.gradeLabel || '';

        let wfCount = 0;
        if (isSuper || isEdu) {
          wfCount = allWorkflow.filter(w => w.status === 'pending' && (w.requiresEducationApproval || isSuper)).length;
        } else if (isSupervisor) {
          wfCount = allWorkflow.filter(w => w.status === 'pending' && (!w.grade || w.grade === userGrade || w.grade === 'همه پایه‌ها')).length;
        }
        setPendingWorkflowCount(wfCount);
      }

      // 4. Anomalies count
      if (currentUser?.level === 1 || currentUser?.role === 'super_admin') {
        const res = await fetch('/api/anomalies').catch(() => null);
        if (res && res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.anomalies)) {
            const count = data.anomalies.filter((a: AnomalyLog) => !a.is_resolved).length;
            setUnresolvedAnomaliesCount(count);
          }
        }
      }
    } catch (e) {}
  };

  React.useEffect(() => {
    fetchBadgeCounts();

    const handleReqUpdate = () => fetchBadgeCounts();
    window.addEventListener('student_requests_updated', handleReqUpdate);
    window.addEventListener('workflow_items_updated', handleReqUpdate);
    const interval = setInterval(fetchBadgeCounts, 15000);

    return () => {
      window.removeEventListener('student_requests_updated', handleReqUpdate);
      window.removeEventListener('workflow_items_updated', handleReqUpdate);
      clearInterval(interval);
    };
  }, [currentUser]);

  React.useEffect(() => {
    if (['backup', 'user-credentials', 'audit-logs', 'app-logs', 'db-save-errors', 'anomaly-detection', 'system-health'].includes(activeTab)) {
      setIsSiteManagementOpen(true);
    }
  }, [activeTab]);

  const siteManagementSubItems = [
    { id: 'security-pin-settings', label: 'افزایش سطح امنیتی حساب', icon: KeyRound },
    { id: 'anomaly-detection', label: 'تشخیص ناهنجاری‌ها و رولبک', icon: ShieldAlert, badge: unresolvedAnomaliesCount },
    { id: 'backup', label: 'پشتیبان‌گیری از دیتابیس', icon: HardDrive },
    { id: 'system-health', label: 'سلامت سیستم', icon: HeartPulse },
    { id: 'user-credentials', label: 'مدیریت ورود کاربران', icon: ShieldCheck },
    { id: 'audit-logs', label: 'فعالیت‌های سایت', icon: Activity },
    { id: 'app-logs', label: 'لاگ‌ها و خطاهای سیستم', icon: Terminal },
    { id: 'db-save-errors', label: 'بازرسی خطاهای ثبت دیتابیس', icon: Database },
    { id: 'db-connection-test', label: 'تست اتصال به دیتا بیس', icon: RefreshCw },
  ].filter(sub => sub.id === 'security-pin-settings' || isTabAllowed(sub.id));

  const canAccessSiteManagement = siteManagementSubItems.length > 0;

  // Filter items based on user's authorized modules
  // Granular permissions set by Super Admin in User Management take ABSOLUTE priority!
  const visibleMenuItems = ALL_MENU_DEFINITIONS.filter(item => {
    if (!currentUser) return false;

    // Check if tab is allowed for current user
    if (!isTabAllowed(item.id)) {
      return false;
    }

    // Super Admin Level 3 Visibility Gate for Student Requests:
    // If user is Level 3 (student), and Super Admin has set isGlobalVisibleForStudents=false or isGlobalEnabled=false, hide it completely!
    if (item.id === 'student-requests' && currentUser.level === 3) {
      if (globalRequestsConfig && (globalRequestsConfig.isGlobalVisibleForStudents === false || globalRequestsConfig.isGlobalEnabled === false)) {
        return false;
      }
    }

    // Level 2 access restriction: ONLY education, finance, cultural, and research managers have student-requests
    // Base professors / mentors (استاد پایه) must NOT have this item!
    if (item.id === 'student-requests' && currentUser.level === 2) {
      const isEdu = currentUser?.role === 'education_manager' || currentUser?.username === 'SHAH' || (currentUser?.name && currentUser.name.includes('آموزش'));
      const isFin = currentUser?.role === 'finance_manager' || currentUser?.username === 'MALI' || (currentUser?.name && currentUser.name.includes('مالی'));
      const isCult = currentUser?.role === 'cultural_manager' || (currentUser?.name && currentUser.name.includes('فرهنگی'));
      const isResearch = currentUser?.role === 'research_manager' || currentUser?.username === 'YAZDANI' || (currentUser?.name && currentUser.name.includes('پژوهش'));
      if (!isEdu && !isFin && !isCult && !isResearch) {
        return false;
      }
    }

    // Rule 6: Education Manager must NOT have research and articles modules
    const isEduUser = currentUser?.role === 'education_manager' || currentUser?.username === 'SHAH' || (currentUser?.name && currentUser.name.includes('آموزش'));
    if (isEduUser && ['research', 'article-evaluations', 'counseling-classes', 'consultation-advisor'].includes(item.id)) {
      return false;
    }

    // Rule 7: Hide classrooms (مدرس‌ها) and comments (نظرات تربیتی) from students by default
    if ((currentUser.level === 3 || currentUser.role === 'student') && (item.id === 'classrooms' || item.id === 'comments')) {
      return false;
    }

    // When site management dropdown is active and this item is inside it, hide its sub-items from top level
    if (canAccessSiteManagement && ['security-pin-settings', 'backup', 'user-credentials', 'audit-logs', 'app-logs', 'db-save-errors', 'anomaly-detection', 'db-connection-test', 'system-health'].includes(item.id)) {
      return false;
    }

    return true;
  });

  const isSiteManagementActive = ['security-pin-settings', 'backup', 'user-credentials', 'audit-logs', 'app-logs', 'db-save-errors', 'anomaly-detection', 'db-connection-test', 'system-health'].includes(activeTab);

  const renderMenuItem = (item: MenuItemDef) => {
    const Icon = item.icon;
    let label = item.label;

    // Contextual label adjustments
    if (currentUser?.level === 3) {
      if (item.id === 'student-requests') label = 'پنل ثبت درخواست';
      if (item.id === 'student-schedule') label = 'برنامه درسی من';
      if (item.id === 'attendance') label = (currentUser.role === 'class_representative' || currentUser.roleTitle?.includes('نماینده')) ? 'ثبت حضور و غیاب' : 'کارنامه حضور و غیاب من';
      if (item.id === 'stats') label = 'ساعات مطالعه من';
      if (item.id === 'research') label = 'پژوهش و مقالات من';
    } else {
      if (item.id === 'student-requests') {
        label = 'پنل رسیدگی به درخواست';
      }
    }

    const isReqItem = item.id === 'student-requests';
    const isWfItem = item.id === 'workflow';
    const badgeCount = isReqItem ? unreadRequestsCount : 
                       isWfItem ? pendingWorkflowCount :
                       item.id === 'anomaly-detection' ? unresolvedAnomaliesCount : 0;
    const isActive = activeTab === item.id;

    return (
      <button
        key={item.id}
        onClick={() => handleItemSelect(item.id)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 text-right group cursor-pointer",
          isActive 
            ? "bg-indigo-50 text-indigo-700 font-bold shadow-xs border border-indigo-100" 
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon size={16} className={cn(
            "shrink-0 transition-colors",
            isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
          )} />
          <span className="text-xs font-semibold truncate">{label}</span>
        </div>

        {badgeCount > 0 && (
          isReqItem ? (
            currentUser?.level === 3 ? (
              <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-black shadow-xs animate-bounce flex items-center gap-0.5">
                📩 {badgeCount} پاسخ
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600 text-white rounded-full text-[10px] font-black shadow-md animate-pulse flex items-center gap-0.5 ring-2 ring-rose-400/50">
                🔥 {badgeCount} جدید
              </span>
            )
          ) : isWfItem ? (
            <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 rounded-full text-[10px] font-black shadow-md animate-pulse flex items-center gap-0.5 ring-2 ring-amber-400/50">
              ⚠️ {badgeCount} کارتابل
            </span>
          ) : (
            <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-black animate-pulse">
              {badgeCount}
            </span>
          )
        )}
      </button>
    );
  };

  return (
    <div 
      className={cn(
        "w-64 bg-white border-l border-slate-200 h-screen fixed right-0 top-0 flex flex-col flex-shrink-0 z-40 transition-all duration-300 transform font-vazir",
        isOpen ? "translate-x-0" : "translate-x-full"
      )} 
      dir="rtl"
    >
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-sm">
            ط
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 tracking-tight">سامانه جامع طلاب</h1>
            <p className="text-[9px] text-slate-400 font-medium">نسخه ۲.۰ • احراز هویت ۳ سطحی</p>
          </div>
        </div>

        {currentUser && (
          <span className={cn(
            "text-[9px] px-2 py-0.5 rounded-full font-black border",
            currentUser.level === 1 ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
            currentUser.level === 2 ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
            "bg-cyan-50 text-cyan-800 border-cyan-200"
          )}>
            سطح {currentUser.level}
          </span>
        )}
      </div>

      {/* Navigation Menu Items */}
      <nav className="flex-1 p-2.5 overflow-y-auto space-y-2.5 custom-scrollbar">
        {/* Main Dashboard Shortcut for All Users */}
        {currentUser && (
          <button
            type="button"
            onClick={() => handleItemSelect('dashboard')}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5 rounded-2xl transition-all duration-200 text-right group cursor-pointer mb-2",
              activeTab === 'dashboard'
                ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-black shadow-md shadow-indigo-600/20"
                : "bg-indigo-50/70 hover:bg-indigo-100 text-indigo-900 font-bold border border-indigo-100"
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Sparkles size={17} className={cn(
                "shrink-0",
                activeTab === 'dashboard' ? "text-amber-300 animate-spin" : "text-indigo-600"
              )} />
              <span className="text-xs font-black truncate">داشبورد اصلی</span>
            </div>
            <span className={cn(
              "text-[9px] px-2 py-0.5 rounded-full font-black",
              activeTab === 'dashboard' ? "bg-white/20 text-white" : "bg-white text-indigo-700 shadow-2xs"
            )}>
              صفحه اصلی
            </span>
          </button>
        )}

        {currentUser && currentUser.level < 3 ? (
          MENU_CATEGORIES.map((cat) => {
            const catItems = visibleMenuItems.filter(item => cat.itemIds.includes(item.id));
            if (catItems.length === 0) return null;

            const isExpanded = expandedCategoryId === cat.id;
            const hasActiveItem = catItems.some(item => item.id === activeTab);

            const isAnimsDisabled = (() => {
              try {
                const saved = localStorage.getItem('user_app_preferences');
                if (saved) {
                  const parsed = JSON.parse(saved);
                  return parsed.disableAnimations === true;
                }
              } catch {}
              return false;
            })();

            return (
              <div 
                key={cat.id} 
                className="space-y-1"
                onMouseEnter={() => handleCategoryMouseEnter(cat.id)}
                onMouseLeave={handleCategoryMouseLeave}
              >
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className={cn(
                    "w-full px-2 py-1 flex items-center justify-between text-[11px] font-black rounded-lg transition-colors cursor-pointer select-none",
                    hasActiveItem ? "text-indigo-900 bg-indigo-50/60" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      cat.id === 'requests_group' ? "bg-rose-500" :
                      cat.id === 'education_group' ? "bg-indigo-500" :
                      cat.id === 'students_group' ? "bg-sky-500" :
                      cat.id === 'research_group' ? "bg-amber-500" :
                      cat.id === 'finance_group' ? "bg-emerald-500" : "bg-slate-400"
                    )} />
                    <span className="tracking-tight truncate">{cat.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-white border border-slate-200 text-slate-500 font-bold">{catItems.length}</span>
                    <ChevronDown size={12} className={cn("text-slate-400 transition-transform duration-200", isExpanded ? "rotate-180" : "-rotate-90")} />
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: isAnimsDisabled ? 0 : 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden space-y-0.5 pr-1"
                    >
                      {catItems.map(renderMenuItem)}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        ) : (
          <div className="space-y-1">
            {visibleMenuItems.map(renderMenuItem)}
          </div>
        )}

        {/* ===================== منوی کشویی مدیریت سایت ===================== */}
        {canAccessSiteManagement && (
          <div className="pt-1">
            {/* Parent Dropdown Button */}
            <button
              type="button"
              onClick={() => setIsSiteManagementOpen(!isSiteManagementOpen)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 text-right group cursor-pointer",
                isSiteManagementActive
                  ? "bg-slate-900 text-white font-black shadow-xs"
                  : "text-slate-700 bg-slate-100/80 hover:bg-slate-200/90 font-bold"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Settings size={16} className={cn(
                  "shrink-0 transition-colors",
                  isSiteManagementActive ? "text-amber-400" : "text-slate-500 group-hover:text-slate-700"
                )} />
                <span className="text-xs truncate">مدیریت سایت</span>
              </div>
              <ChevronDown 
                size={14} 
                className={cn(
                  "transition-transform duration-200 shrink-0",
                  isSiteManagementOpen ? "rotate-180 text-amber-400" : "text-slate-400"
                )} 
              />
            </button>

            {/* Dropdown Sub-Items List */}
            {isSiteManagementOpen && (
              <div className="mr-3 pr-2.5 my-1 space-y-1 border-r-2 border-slate-200 animate-in fade-in slide-in-from-top-1 duration-200">
                {siteManagementSubItems
                  .filter((sub) => typeof hasModuleAccess === 'function' ? hasModuleAccess(sub.id) : true)
                  .map((sub) => {
                  const SubIcon = sub.icon;
                  const isSubActive = activeTab === sub.id;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => handleItemSelect(sub.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-right transition-all text-xs cursor-pointer",
                        isSubActive
                          ? "bg-indigo-50 text-indigo-700 font-black border border-indigo-200 shadow-2xs"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-semibold"
                      )}
                    >
                      <SubIcon size={14} className={cn(
                        "shrink-0",
                        isSubActive ? "text-indigo-600" : "text-slate-400"
                      )} />
                      <span className="truncate">{sub.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Active Logged-in User Profile Card */}
      {currentUser && (
        <div className="p-3 border-t border-slate-100 bg-slate-50/70">
          <div className="bg-white rounded-2xl p-2.5 border border-slate-200/90 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400">حساب کاربری فعال:</span>
              {isReadOnly ? (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200 flex items-center gap-0.5">
                  <Eye size={10} />
                  فقط مشاهده
                </span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-bold">
                  {currentUser.gradeLabel || 'سراسری'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className={cn("w-8 h-8 rounded-xl text-white font-black flex items-center justify-center text-xs shrink-0 shadow-xs", currentUser.avatarBg || 'bg-indigo-600')}>
                {(currentUser.name || currentUser.fullName || currentUser.username || 'ک')[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-black text-slate-900 truncate flex items-center gap-1">
                  <span>{(currentUser.name || currentUser.fullName || currentUser.username || '').split('(')[0]}</span>
                  {currentUser.role === 'super_admin' && <ShieldCheck size={12} className="text-amber-600 shrink-0" />}
                </div>
                <p className="text-[10px] text-slate-500 font-medium truncate">{currentUser.roleTitle}</p>
              </div>
            </div>

            <div className="pt-1.5 border-t border-slate-100 flex flex-col gap-1.5">
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[11px] font-bold transition-all border border-indigo-200/60 cursor-pointer"
                  title="تنظیمات نمایش، تم و انیمیشن‌های سامانه"
                >
                  <Sliders size={13} className="text-indigo-600" />
                  <span>تنظیمات نمایش سایت</span>
                </button>
              )}

              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-[11px] font-bold transition-all border border-rose-200/60 cursor-pointer"
                title="خروج از حساب کاربری"
              >
                <LogOut size={12} />
                <span>خروج از حساب کاربری</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
