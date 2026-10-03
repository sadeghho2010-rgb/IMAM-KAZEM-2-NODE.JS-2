import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  Calendar, 
  BookOpen, 
  GraduationCap, 
  Clock, 
  Coins, 
  Award, 
  Inbox, 
  DoorOpen, 
  CheckSquare, 
  BarChart2, 
  Sparkles, 
  HardDrive, 
  ShieldAlert, 
  Settings, 
  ArrowLeft, 
  ArrowRight,
  UtensilsCrossed, 
  Building2, 
  Receipt, 
  HandCoins, 
  KeyRound, 
  Car, 
  BookCheck, 
  GitBranch, 
  CalendarDays,
  BrainCircuit,
  MessageSquare,
  GripVertical,
  RotateCcw,
  LayoutGrid,
  Move,
  Check,
  Maximize2,
  Minimize2,
  FolderKanban,
  ChevronLeft,
  Layers,
  Grid
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { localDb } from '../lib/localDb';
import { StudentRequest, AnomalyLog } from '../types';

interface DashboardCardDef {
  id: string;
  title: string;
  subtitle: string;
  category: 'education' | 'finance' | 'students' | 'research' | 'requests' | 'system';
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconBg: string;
  cardGradient: string;
  borderGlow: string;
  accentText: string;
  badgeText?: string;
  badgeCount?: number;
  highlight?: boolean;
}

interface MainCategoryDef {
  id: string;
  title: string;
  subtitle: string;
  categoryKey: 'requests' | 'education' | 'students' | 'research' | 'finance' | 'system';
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconBg: string;
  cardGradient: string;
  borderGlow: string;
  accentText: string;
  itemIds: string[];
}

interface MainDashboardProps {
  onNavigateTab: (tabId: string, studentId?: string) => void;
  onOpenSettings?: () => void;
}

export default function MainDashboard({ onNavigateTab }: MainDashboardProps) {
  const { currentUser, isSuperAdmin, isTabAllowed } = useAuth();

  const [unreadRequestsCount, setUnreadRequestsCount] = useState(0);
  const [unresolvedAnomaliesCount, setUnresolvedAnomaliesCount] = useState(0);

  // Check if user disabled animations in settings
  const isAnimationsDisabled = useMemo(() => {
    try {
      if (document.documentElement.classList.contains('disable-animations') || document.body.classList.contains('reduce-motion')) {
        return true;
      }
      const saved = localStorage.getItem('user_app_preferences');
      if (saved) {
        const parsed = JSON.parse(saved);
        return !!parsed.disableAnimations;
      }
    } catch {}
    return false;
  }, []);

  // Display Mode State: 'grouped' (Category Cards - Default Mode 2) vs 'flat' (All Cards Grid - Mode 1)
  const [displayMode, setDisplayMode] = useState<'grouped' | 'flat'>(() => {
    const saved = localStorage.getItem('dashboard_display_mode_v2');
    return (saved === 'flat' || saved === 'grouped') ? saved : 'grouped';
  });

  // Selected Category when in 'grouped' Mode
  const [activeCategoryGroup, setActiveCategoryGroup] = useState<string | null>(null);

  // Edit / Drag & Drop Mode State (for flat mode or ordering)
  const [isEditMode, setIsEditMode] = useState(false);
  const [isFirstRowFeatured, setIsFirstRowFeatured] = useState<boolean>(() => {
    return localStorage.getItem('dashboard_first_row_featured') !== 'false';
  });
  
  // Custom Saved Card Sizes (cardId -> 'large' | 'normal')
  const [customCardSizes, setCustomCardSizes] = useState<Record<string, 'large' | 'normal'>>(() => {
    try {
      const saved = localStorage.getItem('dashboard_card_sizes_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Custom Saved Card Order
  const [customOrder, setCustomOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dashboard_cards_order_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Dragging Index State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Ripple Coordinates
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>, tabId: string) => {
    if (isEditMode) return; // Disable navigation in edit mode

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newRipple = { id: Date.now(), x, y };

    setRipples(prev => [...prev, newRipple]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== newRipple.id));
    }, 600);

    setTimeout(() => {
      onNavigateTab(tabId);
    }, 120);
  };

  // Save display mode
  const handleToggleDisplayMode = (mode: 'grouped' | 'flat') => {
    setDisplayMode(mode);
    setActiveCategoryGroup(null);
    localStorage.setItem('dashboard_display_mode_v2', mode);
  };

  // Load quick live stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        const reqs = await localDb.getDocs<StudentRequest>('student_requests').catch(() => []);

        if (Array.isArray(reqs)) {
          const pendingCount = reqs.filter(r => r.status === 'pending' || r.isReadByOfficer === false).length;
          setUnreadRequestsCount(pendingCount);
        }

        if (currentUser?.level === 1 || isSuperAdmin) {
          const res = await fetch('/api/anomalies').catch(() => null);
          if (res && res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.anomalies)) {
              setUnresolvedAnomaliesCount(data.anomalies.filter((a: AnomalyLog) => !a.is_resolved).length);
            }
          }
        }
      } catch (e) {}
    };

    loadStats();
  }, [currentUser, isSuperAdmin]);

  // Determine user role flags
  const isEducationManager = currentUser?.role === 'education_manager' || currentUser?.username === 'SHAH' || (currentUser?.name && currentUser.name.includes('آموزش'));
  const isFinanceManager = currentUser?.role === 'finance_manager' || currentUser?.username === 'MALI' || (currentUser?.name && currentUser.name.includes('مالی'));
  const isResearchManager = currentUser?.role === 'research_manager' || currentUser?.username === 'YAZDANI' || (currentUser?.name && currentUser.name.includes('پژوهش'));
  const isCulturalManager = currentUser?.role === 'cultural_manager' || (currentUser?.name && currentUser.name.includes('فرهنگی'));
  const isGradeMentor = currentUser?.level === 2 && !isEducationManager && !isFinanceManager && !isResearchManager && !isCulturalManager;

  // Master List of Available Dashboard Action Cards with Glossy Modern Styles
  const ALL_DASHBOARD_CARDS: DashboardCardDef[] = [
    // 1. CARDS FOR REQUESTS & WORKFLOW
    {
      id: 'student-requests',
      title: 'پنل رسیدگی به درخواست طلاب',
      subtitle: 'بررسی، تایید و صدور پاسخ آنلاین به مراجعین و طلاب حوزه',
      category: 'requests',
      icon: Inbox,
      iconBg: 'bg-gradient-to-br from-rose-500 via-rose-600 to-pink-600 text-white shadow-lg shadow-rose-500/30',
      cardGradient: 'from-rose-500/10 via-pink-500/5 to-rose-500/0',
      borderGlow: 'hover:border-rose-400 hover:shadow-2xl hover:shadow-rose-500/20',
      accentText: 'text-rose-600',
      badgeCount: unreadRequestsCount,
      badgeText: unreadRequestsCount > 0 ? `${unreadRequestsCount} جدید` : undefined,
      highlight: unreadRequestsCount > 0
    },
    {
      id: 'workflow',
      title: 'جریان کار و کارتابل تاییدات',
      subtitle: 'رسیدگی به تغییرات گروه‌های مباحثه و فرایندهای مدرسه',
      category: 'requests',
      icon: GitBranch,
      iconBg: 'bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/30',
      cardGradient: 'from-purple-500/10 via-indigo-500/5 to-transparent',
      borderGlow: 'hover:border-purple-400 hover:shadow-2xl hover:shadow-purple-500/20',
      accentText: 'text-purple-600'
    },
    {
      id: 'todos',
      title: 'پیگیری‌ها و تسک‌های جاری',
      subtitle: 'مدیریت اقدامات فوری، یادداشت‌های پیگیری و امور روزانه',
      category: 'requests',
      icon: CheckSquare,
      iconBg: 'bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/30',
      cardGradient: 'from-indigo-500/10 via-blue-500/5 to-transparent',
      borderGlow: 'hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-500/20',
      accentText: 'text-indigo-600'
    },

    // 2. CARDS FOR EDUCATION
    {
      id: 'programs',
      title: 'برنامه‌ها و کلاس‌های درس',
      subtitle: 'مدیریت دروس، ساعات تدریس و سرفصل‌های آموزشی پایه',
      category: 'education',
      icon: Calendar,
      iconBg: 'bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white shadow-lg shadow-indigo-600/30',
      cardGradient: 'from-indigo-600/10 via-violet-500/5 to-transparent',
      borderGlow: 'hover:border-indigo-500 hover:shadow-2xl hover:shadow-indigo-600/20',
      accentText: 'text-indigo-600'
    },
    {
      id: 'classrooms',
      title: 'مدرس‌ها و فضاهای کلاس',
      subtitle: 'چینش فضاها، مَدرَس‌های درس و سالن‌های مباحثه طلاب',
      category: 'education',
      icon: DoorOpen,
      iconBg: 'bg-gradient-to-br from-blue-500 via-indigo-600 to-cyan-600 text-white shadow-lg shadow-blue-500/30',
      cardGradient: 'from-blue-500/10 via-cyan-500/5 to-transparent',
      borderGlow: 'hover:border-blue-400 hover:shadow-2xl hover:shadow-blue-500/20',
      accentText: 'text-blue-600'
    },
    {
      id: 'student-schedule',
      title: 'برنامه درسی و هفتگی طلاب',
      subtitle: 'مشاهده تقویم هفتگی کلاس‌ها و برنامه آموزشی طلاب',
      category: 'education',
      icon: CalendarDays,
      iconBg: 'bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 text-white shadow-lg shadow-sky-500/30',
      cardGradient: 'from-sky-500/10 via-blue-500/5 to-transparent',
      borderGlow: 'hover:border-sky-400 hover:shadow-2xl hover:shadow-sky-500/20',
      accentText: 'text-sky-600'
    },
    {
      id: 'course-selection',
      title: 'سامانه انتخاب واحد',
      subtitle: 'مدیریت بازه‌های انتخاب واحد و درخواست‌های دروس آموزشی',
      category: 'education',
      icon: BookOpen,
      iconBg: 'bg-gradient-to-br from-teal-500 via-emerald-600 to-cyan-600 text-white shadow-lg shadow-teal-500/30',
      cardGradient: 'from-teal-500/10 via-emerald-500/5 to-transparent',
      borderGlow: 'hover:border-teal-400 hover:shadow-2xl hover:shadow-teal-500/20',
      accentText: 'text-teal-600'
    },
    {
      id: 'oral-exams',
      title: 'سامانه آزمون شفاهی طلاب',
      subtitle: 'برنامه‌ریزی، ثبت نمرات و محدوده آزمون شفاهی فقه و اصول',
      category: 'education',
      icon: Award,
      iconBg: 'bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 text-white shadow-lg shadow-cyan-500/30',
      cardGradient: 'from-cyan-500/10 via-blue-500/5 to-transparent',
      borderGlow: 'hover:border-cyan-400 hover:shadow-2xl hover:shadow-cyan-500/20',
      accentText: 'text-cyan-600'
    },
    {
      id: 'teachers-bank',
      title: 'بانک اساتید و مدرسین',
      subtitle: 'مشخصات، مدارک، سوابق علمی و ظرفیت تدریس اساتید',
      category: 'education',
      icon: GraduationCap,
      iconBg: 'bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30',
      cardGradient: 'from-indigo-500/10 via-purple-500/5 to-transparent',
      borderGlow: 'hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-500/20',
      accentText: 'text-indigo-600'
    },

    // 3. CARDS FOR STUDENTS AFFAIRS
    {
      id: 'students',
      title: 'مدیریت کل طلاب',
      subtitle: 'پرونده جامع، مشخصات فردی، عکس و وضعیت تحصیلی',
      category: 'students',
      icon: Users,
      iconBg: 'bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 text-white shadow-lg shadow-sky-500/30',
      cardGradient: 'from-sky-500/10 via-blue-500/5 to-transparent',
      borderGlow: 'hover:border-sky-400 hover:shadow-2xl hover:shadow-sky-500/20',
      accentText: 'text-sky-600'
    },
    {
      id: 'attendance',
      title: 'حضور و غیاب طلاب',
      subtitle: 'ثبت و پایش روزانه حضور در کلاس‌ها و ساعات آموزشی',
      category: 'students',
      icon: CheckSquare,
      iconBg: 'bg-gradient-to-br from-emerald-500 via-teal-600 to-green-600 text-white shadow-lg shadow-emerald-500/30',
      cardGradient: 'from-emerald-500/10 via-teal-500/5 to-transparent',
      borderGlow: 'hover:border-emerald-400 hover:shadow-2xl hover:shadow-emerald-500/20',
      accentText: 'text-emerald-600'
    },
    {
      id: 'discussion',
      title: 'گروه‌های مباحثه و پایش دروس',
      subtitle: 'پایش پوشش دروس فقه و اصول و هم‌بحثی‌های طلاب',
      category: 'students',
      icon: Users,
      iconBg: 'bg-gradient-to-br from-indigo-500 via-purple-600 to-blue-600 text-white shadow-lg shadow-indigo-500/30',
      cardGradient: 'from-indigo-500/10 via-purple-500/5 to-transparent',
      borderGlow: 'hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-500/20',
      accentText: 'text-indigo-600'
    },
    {
      id: 'stats',
      title: 'آمار ساعات مطالعه',
      subtitle: 'تحلیل ساعات مطالعه فردی و مباحثاتی طلاب و نمودارها',
      category: 'students',
      icon: BarChart2,
      iconBg: 'bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-500 text-white shadow-lg shadow-amber-500/30',
      cardGradient: 'from-amber-500/10 via-orange-500/5 to-transparent',
      borderGlow: 'hover:border-amber-400 hover:shadow-2xl hover:shadow-amber-500/20',
      accentText: 'text-amber-600'
    },
    {
      id: 'summary',
      title: 'پرونده علمی طلاب',
      subtitle: 'جمع‌بندی سوابق، تحلیل هوش مصنوعی و نمودارهای رشد',
      category: 'students',
      icon: BrainCircuit,
      iconBg: 'bg-gradient-to-br from-violet-500 via-purple-600 to-pink-600 text-white shadow-lg shadow-violet-500/30',
      cardGradient: 'from-violet-500/10 via-purple-500/5 to-transparent',
      borderGlow: 'hover:border-violet-400 hover:shadow-2xl hover:shadow-violet-500/20',
      accentText: 'text-violet-600'
    },
    {
      id: 'comments',
      title: 'نظرات و ارزیابی‌های تربیتی',
      subtitle: 'ثبت پرونده مشاوره‌ای و گفتگوهای تربیتی اساتید',
      category: 'students',
      icon: MessageSquare,
      iconBg: 'bg-gradient-to-br from-fuchsia-500 via-purple-600 to-indigo-600 text-white shadow-lg shadow-fuchsia-500/30',
      cardGradient: 'from-fuchsia-500/10 via-purple-500/5 to-transparent',
      borderGlow: 'hover:border-fuchsia-400 hover:shadow-2xl hover:shadow-fuchsia-500/20',
      accentText: 'text-fuchsia-600'
    },

    // 4. CARDS FOR RESEARCH & COUNSELING
    {
      id: 'research',
      title: 'بخش پژوهش و مقالات',
      subtitle: 'ثبت و پیگیری مقالات، کرسی‌ها و آثار پژوهشی',
      category: 'research',
      icon: BookOpen,
      iconBg: 'bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/30',
      cardGradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
      borderGlow: 'hover:border-amber-400 hover:shadow-2xl hover:shadow-amber-500/20',
      accentText: 'text-amber-600'
    },
    {
      id: 'counseling-classes',
      title: 'کلاس‌های مشاوره (ارزیابی و نمرات)',
      subtitle: 'ثبت کلاسی ارزیابی و سنجش تعهد اساتید مشاور',
      category: 'research',
      icon: BookCheck,
      iconBg: 'bg-gradient-to-br from-orange-500 via-amber-600 to-yellow-600 text-white shadow-lg shadow-orange-500/30',
      cardGradient: 'from-orange-500/10 via-amber-500/5 to-transparent',
      borderGlow: 'hover:border-orange-400 hover:shadow-2xl hover:shadow-orange-500/20',
      accentText: 'text-orange-600'
    },
    {
      id: 'article-evaluations',
      title: 'ارزیابی مقالات علمی',
      subtitle: 'داوری، نمره‌دهی و صدور کارنامه پژوهشی مقالات',
      category: 'research',
      icon: Award,
      iconBg: 'bg-gradient-to-br from-yellow-500 via-amber-600 to-orange-600 text-white shadow-lg shadow-yellow-500/30',
      cardGradient: 'from-yellow-500/10 via-amber-500/5 to-transparent',
      borderGlow: 'hover:border-yellow-400 hover:shadow-2xl hover:shadow-yellow-500/20',
      accentText: 'text-yellow-600'
    },
    {
      id: 'consultation-advisor',
      title: 'دستیار کلاس‌های مشاوره',
      subtitle: 'چینش هوشمند جلسات و هماهنگی زمان‌بندی مشاوران',
      category: 'research',
      icon: Sparkles,
      iconBg: 'bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 text-white shadow-lg shadow-amber-400/30',
      cardGradient: 'from-amber-400/10 via-yellow-500/5 to-transparent',
      borderGlow: 'hover:border-amber-300 hover:shadow-2xl hover:shadow-amber-400/20',
      accentText: 'text-amber-500'
    },

    // 5. CARDS FOR FINANCE & WELFARE
    {
      id: 'finance-tuition',
      title: 'محاسبه شهریه طلاب',
      subtitle: 'محاسبه مکانیزه شهریه بر مبنای حضور، مباحثه و فعالیت',
      category: 'finance',
      icon: Coins,
      iconBg: 'bg-gradient-to-br from-emerald-500 via-teal-600 to-green-600 text-white shadow-lg shadow-emerald-500/30',
      cardGradient: 'from-emerald-500/10 via-teal-500/5 to-transparent',
      borderGlow: 'hover:border-emerald-400 hover:shadow-2xl hover:shadow-emerald-500/20',
      accentText: 'text-emerald-600'
    },
    {
      id: 'finance-grade-mentors',
      title: 'حق‌الزحمه اساتید پایه',
      subtitle: 'محاسبه حق سرپرستی، پیگیری‌ها و جلسات مباحثه',
      category: 'finance',
      icon: BookOpen,
      iconBg: 'bg-gradient-to-br from-teal-500 via-emerald-600 to-cyan-600 text-white shadow-lg shadow-teal-500/30',
      cardGradient: 'from-teal-500/10 via-emerald-500/5 to-transparent',
      borderGlow: 'hover:border-teal-400 hover:shadow-2xl hover:shadow-teal-500/20',
      accentText: 'text-teal-600'
    },
    {
      id: 'finance-teachers',
      title: 'حق‌التدریس اساتید',
      subtitle: 'ساعات تدریس مصوب، نرخ جلسات و صدور فیش مالی',
      category: 'finance',
      icon: Clock,
      iconBg: 'bg-gradient-to-br from-emerald-600 via-green-600 to-teal-700 text-white shadow-lg shadow-emerald-600/30',
      cardGradient: 'from-emerald-600/10 via-green-500/5 to-transparent',
      borderGlow: 'hover:border-emerald-500 hover:shadow-2xl hover:shadow-emerald-600/20',
      accentText: 'text-emerald-600'
    },
    {
      id: 'finance-lunch',
      title: 'اطلاعات نهار و شام',
      subtitle: 'مدیریت سلف، آمار پخت و کسر شهریه وعده‌های غذایی',
      category: 'finance',
      icon: UtensilsCrossed,
      iconBg: 'bg-gradient-to-br from-teal-500 via-cyan-600 to-blue-600 text-white shadow-lg shadow-teal-500/30',
      cardGradient: 'from-teal-500/10 via-cyan-500/5 to-transparent',
      borderGlow: 'hover:border-teal-400 hover:shadow-2xl hover:shadow-teal-500/20',
      accentText: 'text-teal-600'
    },
    {
      id: 'finance-loans-fund',
      title: 'صندوق قرض‌الحسنه و وام‌ها',
      subtitle: 'تقاضا، اقساط، مانده وام و گردش حساب صندوق',
      category: 'finance',
      icon: Building2,
      iconBg: 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-500/30',
      cardGradient: 'from-emerald-500/10 via-teal-500/5 to-transparent',
      borderGlow: 'hover:border-emerald-400 hover:shadow-2xl hover:shadow-emerald-500/20',
      accentText: 'text-emerald-600'
    },
    {
      id: 'finance-claims',
      title: 'مطالبات و بدهی‌ها',
      subtitle: 'رسیدگی به مانده حساب‌های اشخاص و تسویه‌ها',
      category: 'finance',
      icon: HandCoins,
      iconBg: 'bg-gradient-to-br from-teal-600 via-emerald-600 to-green-600 text-white shadow-lg shadow-teal-600/30',
      cardGradient: 'from-teal-600/10 via-emerald-500/5 to-transparent',
      borderGlow: 'hover:border-teal-500 hover:shadow-2xl hover:shadow-teal-600/20',
      accentText: 'text-teal-600'
    },
    {
      id: 'finance-expenses-reports',
      title: 'هزینه‌ها و ردیف‌های بودجه',
      subtitle: 'ثبت اسناد هزینه، تنخواه‌گردان و ترازهای مالی مجموعه',
      category: 'finance',
      icon: Receipt,
      iconBg: 'bg-gradient-to-br from-green-500 via-emerald-600 to-teal-600 text-white shadow-lg shadow-green-500/30',
      cardGradient: 'from-green-500/10 via-emerald-500/5 to-transparent',
      borderGlow: 'hover:border-green-400 hover:shadow-2xl hover:shadow-green-500/20',
      accentText: 'text-green-600'
    },
    {
      id: 'lockers',
      title: 'اختصاص کمد و کلید',
      subtitle: 'امانت کلید، رزرواسیون کمد و مدیریت اموال رفاهی',
      category: 'finance',
      icon: KeyRound,
      iconBg: 'bg-gradient-to-br from-cyan-500 via-teal-600 to-emerald-600 text-white shadow-lg shadow-cyan-500/30',
      cardGradient: 'from-cyan-500/10 via-teal-500/5 to-transparent',
      borderGlow: 'hover:border-cyan-400 hover:shadow-2xl hover:shadow-cyan-500/20',
      accentText: 'text-cyan-600'
    },
    {
      id: 'teacher-transport',
      title: 'سرویس و ایاب و ذهاب اساتید',
      subtitle: 'روتین هفتگی، رانندگان و تسویه ترابری اساتید',
      category: 'finance',
      icon: Car,
      iconBg: 'bg-gradient-to-br from-emerald-500 via-cyan-600 to-blue-600 text-white shadow-lg shadow-emerald-500/30',
      cardGradient: 'from-emerald-500/10 via-cyan-500/5 to-transparent',
      borderGlow: 'hover:border-emerald-400 hover:shadow-2xl hover:shadow-emerald-500/20',
      accentText: 'text-emerald-600'
    },

    // 6. CARDS FOR SYSTEM & ADMIN
    {
      id: 'user-management',
      title: 'مدیریت کاربران و دسترسی‌ها',
      subtitle: 'تعریف نقش‌ها، تعیین دسترسی ماژول‌ها و سطوح RBAC',
      category: 'system',
      icon: Settings,
      iconBg: 'bg-gradient-to-br from-slate-700 via-slate-800 to-indigo-900 text-white shadow-lg shadow-slate-700/30',
      cardGradient: 'from-slate-700/10 via-indigo-500/5 to-transparent',
      borderGlow: 'hover:border-slate-500 hover:shadow-2xl hover:shadow-slate-700/20',
      accentText: 'text-slate-700'
    },
    {
      id: 'backup',
      title: 'پشتیبان‌گیری از دیتابیس',
      subtitle: 'تهیه فایل پشتیبان و بازیابی ایمن داده‌های سامانه',
      category: 'system',
      icon: HardDrive,
      iconBg: 'bg-gradient-to-br from-slate-800 via-slate-900 to-purple-950 text-white shadow-lg shadow-slate-800/30',
      cardGradient: 'from-slate-800/10 via-purple-500/5 to-transparent',
      borderGlow: 'hover:border-slate-600 hover:shadow-2xl hover:shadow-purple-500/20',
      accentText: 'text-slate-800'
    },
    {
      id: 'anomaly-detection',
      title: 'تشخیص ناهنجاری‌ها و بازرسی امنیت',
      subtitle: 'پایش رویدادهای مشکوک، هشدارها و رولبک خودکار',
      category: 'system',
      icon: ShieldAlert,
      iconBg: 'bg-gradient-to-br from-rose-600 via-rose-700 to-red-800 text-white shadow-lg shadow-rose-600/30',
      cardGradient: 'from-rose-600/10 via-red-500/5 to-transparent',
      borderGlow: 'hover:border-rose-500 hover:shadow-2xl hover:shadow-rose-600/20',
      accentText: 'text-rose-700',
      badgeCount: unresolvedAnomaliesCount,
      badgeText: unresolvedAnomaliesCount > 0 ? `${unresolvedAnomaliesCount} هشدار` : undefined,
      highlight: unresolvedAnomaliesCount > 0
    }
  ];

  // Master Category Cards Definitions for Mode 2 (Grouped / Category View)
  const MAIN_CATEGORY_CARDS: MainCategoryDef[] = [
    {
      id: 'requests_group',
      title: 'کارتابل و رسیدگی به امور',
      subtitle: 'رسیدگی به درخواست‌های طلاب، کارتابل تاییدات و پیگیری‌های جاری',
      categoryKey: 'requests',
      icon: Inbox,
      iconBg: 'bg-gradient-to-br from-rose-500 via-rose-600 to-pink-600 text-white shadow-xl shadow-rose-500/35',
      cardGradient: 'from-rose-500/15 via-pink-500/5 to-transparent',
      borderGlow: 'hover:border-rose-400 hover:shadow-2xl hover:shadow-rose-500/25',
      accentText: 'text-rose-600',
      itemIds: ['student-requests', 'workflow', 'todos']
    },
    {
      id: 'education_group',
      title: 'امور آموزش و کلاس‌های درس',
      subtitle: 'برنامه‌های درسی، کلاس‌ها، انتخاب واحد، آزمون شفاهی و بانک اساتید',
      categoryKey: 'education',
      icon: Calendar,
      iconBg: 'bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white shadow-xl shadow-indigo-600/35',
      cardGradient: 'from-indigo-600/15 via-violet-500/5 to-transparent',
      borderGlow: 'hover:border-indigo-500 hover:shadow-2xl hover:shadow-indigo-600/25',
      accentText: 'text-indigo-600',
      itemIds: ['programs', 'classrooms', 'student-schedule', 'course-selection', 'oral-exams', 'teachers-bank']
    },
    {
      id: 'students_group',
      title: 'امور طلاب و پایش',
      subtitle: 'مدیریت پرونده طلاب، حضور و غیاب، مباحثات، آمار و پرونده علمی',
      categoryKey: 'students',
      icon: Users,
      iconBg: 'bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 text-white shadow-xl shadow-sky-500/35',
      cardGradient: 'from-sky-500/15 via-blue-500/5 to-transparent',
      borderGlow: 'hover:border-sky-400 hover:shadow-2xl hover:shadow-sky-500/25',
      accentText: 'text-sky-600',
      itemIds: ['students', 'attendance', 'discussion', 'stats', 'summary', 'comments']
    },
    {
      id: 'research_group',
      title: 'پژوهش و کلاس‌های مشاوره',
      subtitle: 'ثبت مقالات علمی، داوری، ارزیابی کلاس‌های مشاوره و دستیار چینش',
      categoryKey: 'research',
      icon: BookOpen,
      iconBg: 'bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 text-white shadow-xl shadow-amber-500/35',
      cardGradient: 'from-amber-500/15 via-amber-500/5 to-transparent',
      borderGlow: 'hover:border-amber-400 hover:shadow-2xl hover:shadow-amber-500/25',
      accentText: 'text-amber-600',
      itemIds: ['research', 'counseling-classes', 'article-evaluations', 'consultation-advisor']
    },
    {
      id: 'finance_group',
      title: 'امور مالی، رفاهی و خدمات',
      subtitle: 'محاسبه شهریه، حق‌الزحمه، نهار و شام، صندوق وام، کمدها و ترابری',
      categoryKey: 'finance',
      icon: Coins,
      iconBg: 'bg-gradient-to-br from-emerald-500 via-teal-600 to-green-600 text-white shadow-xl shadow-emerald-500/35',
      cardGradient: 'from-emerald-500/15 via-teal-500/5 to-transparent',
      borderGlow: 'hover:border-emerald-400 hover:shadow-2xl hover:shadow-emerald-500/25',
      accentText: 'text-emerald-600',
      itemIds: ['finance-tuition', 'finance-grade-mentors', 'finance-teachers', 'finance-lunch', 'finance-loans-fund', 'finance-claims', 'finance-expenses-reports', 'lockers', 'teacher-transport']
    },
    {
      id: 'system_group',
      title: 'مدیریت و امنیت سایت',
      subtitle: 'مدیریت کاربران، پشتیبان‌گیری دیتابیس، لاگ‌ها و بازرسی امنیت',
      categoryKey: 'system',
      icon: ShieldAlert,
      iconBg: 'bg-gradient-to-br from-slate-700 via-slate-800 to-indigo-950 text-white shadow-xl shadow-slate-700/35',
      cardGradient: 'from-slate-700/15 via-indigo-500/5 to-transparent',
      borderGlow: 'hover:border-slate-500 hover:shadow-2xl hover:shadow-slate-700/25',
      accentText: 'text-slate-700',
      itemIds: ['user-management', 'backup', 'anomaly-detection']
    }
  ];

  // Filter allowed cards for user
  const allowedCardsMap = useMemo(() => {
    const map = new Map<string, DashboardCardDef>();
    ALL_DASHBOARD_CARDS.forEach(card => {
      if (!currentUser) return;
      if (!isTabAllowed(card.id)) return;
      if (isEducationManager && ['research', 'article-evaluations', 'counseling-classes', 'consultation-advisor'].includes(card.id)) return;
      if (isGradeMentor && card.id === 'student-requests') return;
      map.set(card.id, card);
    });
    return map;
  }, [currentUser, isTabAllowed, isEducationManager, isGradeMentor, unreadRequestsCount, unresolvedAnomaliesCount]);

  // Filter allowed main category cards
  const allowedCategoryCards = useMemo(() => {
    return MAIN_CATEGORY_CARDS.filter(cat => {
      const allowedSubCount = cat.itemIds.filter(id => allowedCardsMap.has(id)).length;
      return allowedSubCount > 0;
    });
  }, [allowedCardsMap]);

  // Ordered Cards List according to user preference in flat mode
  const sortedCards = useMemo(() => {
    const allowed = Array.from(allowedCardsMap.values());
    if (!customOrder || customOrder.length === 0) {
      return allowed;
    }

    const ordered: DashboardCardDef[] = [];
    const remaining = new Map(allowedCardsMap);

    customOrder.forEach(id => {
      if (remaining.has(id)) {
        ordered.push(remaining.get(id)!);
        remaining.delete(id);
      }
    });

    // Append any newly allowed cards not in customOrder
    remaining.forEach(card => ordered.push(card));

    return ordered;
  }, [allowedCardsMap, customOrder]);

  // Filtered Cards when inside a specific active category in grouped mode
  const activeGroupCards = useMemo(() => {
    if (!activeCategoryGroup) return [];
    const cat = MAIN_CATEGORY_CARDS.find(c => c.id === activeCategoryGroup);
    if (!cat) return [];
    return cat.itemIds
      .map(id => allowedCardsMap.get(id))
      .filter((c): c is DashboardCardDef => Boolean(c));
  }, [activeCategoryGroup, allowedCardsMap]);

  const activeCategoryDef = useMemo(() => {
    return MAIN_CATEGORY_CARDS.find(c => c.id === activeCategoryGroup) || null;
  }, [activeCategoryGroup]);

  // Handle Drag and Drop logic
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newCards = [...sortedCards];
    const [movedCard] = newCards.splice(draggedIndex, 1);
    newCards.splice(dropIndex, 0, movedCard);

    const newOrderIds = newCards.map(c => c.id);
    setCustomOrder(newOrderIds);
    localStorage.setItem('dashboard_cards_order_v1', JSON.stringify(newOrderIds));

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleResetLayout = () => {
    if (window.confirm('آیا مایلید چیدمان کارت‌ها به حالت پیش‌فرض اولیه بازگردد؟')) {
      setCustomOrder([]);
      setCustomCardSizes({});
      setIsFirstRowFeatured(true);
      localStorage.removeItem('dashboard_cards_order_v1');
      localStorage.removeItem('dashboard_card_sizes_v1');
      localStorage.setItem('dashboard_first_row_featured', 'true');
    }
  };

  const toggleCardSize = (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomCardSizes(prev => {
      const current = prev[cardId] || 'normal';
      const nextSize: 'large' | 'normal' = current === 'large' ? 'normal' : 'large';
      const updated: Record<string, 'large' | 'normal'> = {
        ...prev,
        [cardId]: nextSize
      };
      localStorage.setItem('dashboard_card_sizes_v1', JSON.stringify(updated));
      return updated;
    });
  };

  const toggleFirstRowFeatured = () => {
    const nextVal = !isFirstRowFeatured;
    setIsFirstRowFeatured(nextVal);
    localStorage.setItem('dashboard_first_row_featured', String(nextVal));
  };

  // Motion variants with disable-animations check
  const transitionConfig = isAnimationsDisabled ? { duration: 0 } : { duration: 0.25 };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 font-vazir relative min-h-[calc(100vh-5rem)]" dir="rtl">
      
      {/* 1. COMPACT ELEGANT GREETING TITLE BANNER (30% Smaller with 2-Minute Glowing Shift) */}
      <div className={cn(
        "relative overflow-hidden border border-indigo-700/40 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg text-white font-vazir transition-all",
        !isAnimationsDisabled
          ? "bg-gradient-to-r from-indigo-900 via-purple-950 via-rose-950 to-slate-900 animate-gradient-glow"
          : "bg-slate-900"
      )}>
        {/* Decorative Background Mesh */}
        <div className="absolute top-0 left-0 -translate-x-10 -translate-y-10 w-48 h-48 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 translate-x-10 translate-y-10 w-52 h-52 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-black text-indigo-200 border border-white/10 flex items-center gap-1">
                <Sparkles size={12} className="text-amber-300" />
                <span>داشبورد اختصاصی</span>
              </span>
              <span className="text-[11px] text-indigo-200/80 font-medium">
                سطح {currentUser?.level || 2}: {currentUser?.roleTitle || 'مسئول سازمانی'}
              </span>
            </div>

            <h1 className="text-base sm:text-lg lg:text-xl font-black text-white tracking-tight">
              سلام و احترام، {currentUser?.name || currentUser?.fullName || currentUser?.username}
            </h1>
            <p className="text-xs text-indigo-100/85 font-medium leading-normal">
              به سامانه جامع حوزه علمیه خوش آمدید. تمامی ابزارها و کارتابل‌ها آماده دسترسی سریع هستند.
            </p>
          </div>

          {/* Unread Alert Shortcut if any */}
          {unreadRequestsCount > 0 && isTabAllowed('student-requests') && (
            <button
              type="button"
              onClick={() => onNavigateTab('student-requests')}
              className="px-3.5 py-2 bg-gradient-to-r from-rose-500 to-amber-500 text-white rounded-2xl text-xs font-black shadow-md shadow-rose-500/25 flex items-center gap-2 hover:scale-105 transition-all cursor-pointer ring-2 ring-white/20 shrink-0 self-start sm:self-center"
            >
              <Inbox size={15} />
              <span>{unreadRequestsCount} درخواست در انتظار</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. DYNAMIC DISPLAY MODE TOOLBAR */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handleToggleDisplayMode('grouped')}
            className={cn(
              "flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none",
              displayMode === 'grouped'
                ? "bg-white text-indigo-900 shadow-xs border border-slate-200/80"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Layers size={15} className={displayMode === 'grouped' ? "text-indigo-600" : "text-slate-400"} />
            <span>دسته‌بندی‌شده (۶ شاخه اصلی)</span>
          </button>

          <button
            type="button"
            onClick={() => handleToggleDisplayMode('flat')}
            className={cn(
              "flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none",
              displayMode === 'flat'
                ? "bg-white text-indigo-900 shadow-xs border border-slate-200/80"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Grid size={15} className={displayMode === 'flat' ? "text-indigo-600" : "text-slate-400"} />
            <span>نمایش یکپارچه (تمام کارت‌ها)</span>
          </button>
        </div>

        {/* Flat Mode Controls / Breadcrumb */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {displayMode === 'grouped' && activeCategoryGroup && (
            <button
              type="button"
              onClick={() => setActiveCategoryGroup(null)}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all border border-indigo-200 flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowRight size={14} />
              <span>بازگشت به تمام دسته‌بندی‌ها</span>
            </button>
          )}

          {displayMode === 'flat' && (
            <>
              {/* Toggle First Row Sizing Option */}
              <button
                type="button"
                onClick={toggleFirstRowFeatured}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer shadow-2xs",
                  isFirstRowFeatured 
                    ? "bg-indigo-50 text-indigo-700 border-indigo-200" 
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                )}
                title="تغییر ابعاد سطر اول به کارت‌های ۳ تایی بزرگ"
              >
                <LayoutGrid size={14} className={isFirstRowFeatured ? "text-indigo-600" : "text-slate-400"} />
                <span className="hidden md:inline">{isFirstRowFeatured ? 'سطر اول ۳ تایی' : 'سطر اول ۴ تایی'}</span>
              </button>

              {/* Edit / Drag Toggle Button */}
              <button
                type="button"
                onClick={() => setIsEditMode(!isEditMode)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-black transition-all border flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95",
                  isEditMode
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-emerald-600/20"
                    : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
                )}
              >
                {isEditMode ? (
                  <>
                    <Check size={15} />
                    <span>تایید چیدمان</span>
                  </>
                ) : (
                  <>
                    <Move size={15} className="text-indigo-600" />
                    <span>جابه‌جایی و ویرایش</span>
                  </>
                )}
              </button>

              {/* Reset Order Button */}
              {(customOrder.length > 0 || Object.keys(customCardSizes).length > 0) && (
                <button
                  type="button"
                  onClick={handleResetLayout}
                  className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl border border-slate-200 hover:border-rose-200 transition-all cursor-pointer shadow-2xs"
                  title="بازنشانی چیدمان به حالت اولیه"
                >
                  <RotateCcw size={15} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Edit Mode Notice Bar */}
      <AnimatePresence>
        {isEditMode && displayMode === 'flat' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={transitionConfig}
            className="p-3 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-indigo-500/10 border border-amber-300/80 rounded-xl flex items-center justify-between gap-3 text-right font-vazir text-xs font-bold text-amber-900"
          >
            <div className="flex items-center gap-2">
              <GripVertical size={16} className="text-amber-600 animate-pulse" />
              <span>حالت ویرایش چیدمان فعال است: کارت‌ها را با ماوس کشیده و جابه‌جا کنید (Drag & Drop).</span>
            </div>
            <button
              onClick={() => setIsEditMode(false)}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-black transition-all cursor-pointer shrink-0 shadow-2xs"
            >
              ذخیره
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. MAIN CARDS CONTAINER WITH SMOOTH ANIMATED TRANSITIONS */}
      <AnimatePresence mode="wait">
        
        {/* MODE 2: GROUPED CATEGORY CARDS VIEW (MAIN DEFAULTS) */}
        {displayMode === 'grouped' && !activeCategoryGroup && (
          <motion.div
            key="grouped-categories-list"
            initial={!isAnimationsDisabled ? { opacity: 0, scale: 0.97, y: 8 } : { opacity: 1, scale: 1, y: 0 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={!isAnimationsDisabled ? { opacity: 0, scale: 0.97, y: -8 } : { opacity: 1, scale: 1, y: 0 }}
            transition={transitionConfig}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {allowedCategoryCards.map((cat) => {
              const Icon = cat.icon;
              const subItemsCount = cat.itemIds.filter(id => allowedCardsMap.has(id)).length;
              const hasBadge = cat.id === 'requests_group' ? unreadRequestsCount > 0 :
                               cat.id === 'system_group' ? unresolvedAnomaliesCount > 0 : false;
              const badgeText = cat.id === 'requests_group' && unreadRequestsCount > 0 ? `${unreadRequestsCount} درخواست جدید` :
                                cat.id === 'system_group' && unresolvedAnomaliesCount > 0 ? `${unresolvedAnomaliesCount} هشدار` : undefined;

              return (
                <motion.div
                  key={cat.id}
                  whileHover={!isAnimationsDisabled ? { 
                    scale: 1.025, 
                    y: -6,
                    rotateX: -1.5,
                    rotateY: 2,
                    transition: { duration: 0.22, ease: 'easeOut' }
                  } : undefined}
                  whileTap={!isAnimationsDisabled ? { scale: 0.97 } : undefined}
                  onClick={() => setActiveCategoryGroup(cat.id)}
                  className={cn(
                    "relative group overflow-hidden bg-white/95 rounded-3xl p-6 border text-right transition-all duration-300 cursor-pointer flex flex-col justify-between shadow-sm select-none backdrop-blur-md min-h-[175px]",
                    cat.borderGlow,
                    hasBadge ? "border-rose-300 ring-2 ring-rose-500/20" : "border-slate-200/90"
                  )}
                >
                  {/* Background Morphing Gradient On Hover */}
                  <div className={cn(
                    "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
                    cat.cardGradient
                  )} />

                  {/* Shimmer Light Reflection Sweep */}
                  {!isAnimationsDisabled && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
                  )}

                  <div className="relative z-10 space-y-3.5">
                    {/* Category Icon & Sub-item Counter */}
                    <div className="flex items-center justify-between">
                      <div className={cn(
                        "w-13 h-13 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-2 shrink-0",
                        cat.iconBg
                      )}>
                        <Icon size={26} />
                      </div>

                      <div className="flex items-center gap-1.5">
                        {badgeText && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/40 animate-bounce ring-2 ring-rose-300/50">
                            {badgeText}
                          </span>
                        )}
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-slate-100 text-slate-700 border border-slate-200">
                          {subItemsCount} بخش
                        </span>
                      </div>
                    </div>

                    {/* Category Titles */}
                    <div className="space-y-1">
                      <h3 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-indigo-950 transition-colors tracking-tight">
                        {cat.title}
                      </h3>
                      <p className="text-xs text-slate-500 group-hover:text-slate-700 font-medium leading-relaxed line-clamp-2">
                        {cat.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Footer Action Link */}
                  <div className="relative z-10 pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">
                    <span className="text-xs font-black group-hover:translate-x-1 transition-transform">مشاهده زیرمجموعه‌ها ({subItemsCount})</span>
                    <div className={cn(
                      "w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:bg-indigo-600 group-hover:text-white shadow-2xs group-hover:shadow-indigo-600/30",
                      cat.accentText
                    )}>
                      <ArrowLeft size={15} className="transform group-hover:-translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* MODE 2 - SUB-LEVEL CARDS VIEW (When a category is selected) */}
        {displayMode === 'grouped' && activeCategoryGroup && (
          <motion.div
            key={`category-subitems-${activeCategoryGroup}`}
            initial={!isAnimationsDisabled ? { opacity: 0, scale: 0.97, y: 8 } : { opacity: 1, scale: 1, y: 0 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={!isAnimationsDisabled ? { opacity: 0, scale: 0.97, y: -8 } : { opacity: 1, scale: 1, y: 0 }}
            transition={transitionConfig}
            className="space-y-4"
          >
            {/* Category Breadcrumb Title */}
            {activeCategoryDef && (
              <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0", activeCategoryDef.iconBg)}>
                    {React.createElement(activeCategoryDef.icon, { size: 18 })}
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900">{activeCategoryDef.title}</h2>
                    <p className="text-[11px] text-slate-500 font-medium">زیرمجموعه‌های این بخش ({activeGroupCards.length} کارت فعال)</p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveCategoryGroup(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <ArrowRight size={14} />
                  <span>بازگشت به کارت‌های اصلی</span>
                </button>
              </div>
            )}

            {/* Grid of Sub-Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {activeGroupCards.map((card) => {
                const Icon = card.icon;

                return (
                  <motion.div
                    key={card.id}
                    whileHover={!isAnimationsDisabled ? { 
                      scale: 1.025, 
                      y: -6,
                      rotateX: -1.5,
                      rotateY: 2,
                      transition: { duration: 0.22, ease: 'easeOut' }
                    } : undefined}
                    whileTap={!isAnimationsDisabled ? { scale: 0.97 } : undefined}
                    onClick={(e) => handleCardClick(e as any, card.id)}
                    className={cn(
                      "relative group overflow-hidden bg-white/95 rounded-3xl p-5 border text-right transition-all duration-300 cursor-pointer flex flex-col justify-between shadow-sm select-none backdrop-blur-md min-h-[150px]",
                      card.borderGlow,
                      card.highlight ? "border-rose-300 ring-2 ring-rose-500/30" : "border-slate-200/90"
                    )}
                  >
                    {/* Background Morphing Gradient On Hover */}
                    <div className={cn(
                      "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
                      card.cardGradient
                    )} />

                    {/* Shimmer Light Reflection Sweep */}
                    {!isAnimationsDisabled && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
                    )}

                    <div className="relative z-10 space-y-3">
                      {/* Card Icon & Badge */}
                      <div className="flex items-center justify-between">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-2 shrink-0",
                          card.iconBg
                        )}>
                          <Icon size={24} />
                        </div>

                        {card.badgeText && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/40 animate-bounce ring-2 ring-rose-300/50">
                            {card.badgeText}
                          </span>
                        )}
                      </div>

                      {/* Card Titles */}
                      <div className="space-y-1">
                        <h3 className="text-sm sm:text-base font-black text-slate-900 group-hover:text-indigo-950 transition-colors tracking-tight">
                          {card.title}
                        </h3>
                        <p className="text-[11px] text-slate-500 group-hover:text-slate-700 font-medium leading-relaxed line-clamp-2">
                          {card.subtitle}
                        </p>
                      </div>
                    </div>

                    {/* Footer Action Link */}
                    <div className="relative z-10 pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">
                      <span className="text-[11px] font-black group-hover:translate-x-1 transition-transform">ورود به بخش</span>
                      <div className={cn(
                        "w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:bg-indigo-600 group-hover:text-white shadow-2xs group-hover:shadow-indigo-600/30",
                        card.accentText
                      )}>
                        <ArrowLeft size={15} className="transform group-hover:-translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* MODE 1: FLAT VIEW (ALL CARDS IN ONE GRID WITH DRAG & DROP) */}
        {displayMode === 'flat' && (
          <motion.div
            key="flat-cards-grid"
            initial={!isAnimationsDisabled ? { opacity: 0, scale: 0.97, y: 8 } : { opacity: 1, scale: 1, y: 0 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={!isAnimationsDisabled ? { opacity: 0, scale: 0.97, y: -8 } : { opacity: 1, scale: 1, y: 0 }}
            transition={transitionConfig}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 auto-rows-fr"
          >
            {sortedCards.map((card, index) => {
              const Icon = card.icon;

              // Determine Card Sizing
              const customSize = customCardSizes[card.id];
              const isRow1Featured = isFirstRowFeatured && index < 3;
              const isLarge = customSize === 'large' || (customSize === undefined && isRow1Featured);

              const spanClass = isLarge
                ? "col-span-1 md:col-span-2 lg:col-span-4/3 xl:col-span-4/3 min-h-[160px]"
                : "col-span-1 min-h-[145px]";

              const isBeingDragged = draggedIndex === index;
              const isBeingDraggedOver = dragOverIndex === index;

              return (
                <motion.div
                  key={card.id}
                  layout={!isAnimationsDisabled}
                  draggable={isEditMode}
                  onDragStart={(e) => handleDragStart(e as any, index)}
                  onDragOver={(e) => handleDragOver(e as any, index)}
                  onDrop={(e) => handleDrop(e as any, index)}
                  whileHover={!isAnimationsDisabled && !isEditMode ? { 
                    scale: 1.025, 
                    y: -6,
                    rotateX: -1.5,
                    rotateY: 2,
                    transition: { duration: 0.22, ease: 'easeOut' }
                  } : undefined}
                  whileTap={!isAnimationsDisabled && !isEditMode ? { scale: 0.97 } : undefined}
                  onClick={(e) => handleCardClick(e as any, card.id)}
                  className={cn(
                    "relative group overflow-hidden bg-white/95 rounded-3xl p-5 border text-right transition-all duration-300 flex flex-col justify-between shadow-sm select-none backdrop-blur-md",
                    spanClass,
                    card.highlight ? "border-rose-300 ring-2 ring-rose-500/30" : "border-slate-200/90",
                    card.borderGlow,
                    isEditMode ? "cursor-grab active:cursor-grabbing ring-2 ring-indigo-400/40 border-indigo-300 shadow-md" : "cursor-pointer",
                    isBeingDragged && "opacity-40 scale-95 border-dashed border-indigo-500",
                    isBeingDraggedOver && "ring-4 ring-emerald-500/50 scale-102 border-emerald-500 shadow-xl"
                  )}
                >
                  {/* Background Morphing Gradient On Hover */}
                  <div className={cn(
                    "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
                    card.cardGradient
                  )} />

                  {/* Shimmer Light Reflection Sweep */}
                  {!isAnimationsDisabled && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
                  )}

                  {/* Circular Ripple Wave */}
                  {ripples.map(r => (
                    <span
                      key={r.id}
                      className="absolute bg-indigo-500/30 rounded-full pointer-events-none animate-ping"
                      style={{
                        left: r.x - 20,
                        top: r.y - 20,
                        width: 40,
                        height: 40
                      }}
                    />
                  ))}

                  {/* Drag Handle & Edit Overlay Controls */}
                  {isEditMode && (
                    <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl text-white shadow-lg">
                      <div className="p-1 text-slate-400 hover:text-white cursor-grab" title="برای جابه‌جایی بکشید">
                        <GripVertical size={16} />
                      </div>
                      <button
                        type="button"
                        onClick={(e) => toggleCardSize(card.id, e)}
                        className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer text-amber-300"
                        title={isLarge ? "کوچک‌سازی کارت" : "بزرگ‌سازی کارت"}
                      >
                        {isLarge ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                      </button>
                    </div>
                  )}

                  <div className="relative z-10 space-y-3.5">
                    {/* Card Icon & Glowing Badge */}
                    <div className="flex items-center justify-between">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-2 shrink-0",
                        card.iconBg
                      )}>
                        <Icon size={24} />
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Size Indicator in Edit Mode */}
                        {isEditMode && (
                          <span className={cn(
                            "text-[9px] px-2 py-0.5 rounded-full font-black border",
                            isLarge ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-slate-100 text-slate-600 border-slate-200"
                          )}>
                            {isLarge ? 'سایز بزرگ' : 'عادی'}
                          </span>
                        )}

                        {/* Live Badge */}
                        {card.badgeText && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/40 animate-bounce ring-2 ring-rose-300/50">
                            {card.badgeText}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Titles & Descriptions */}
                    <div className="space-y-1">
                      <h3 className={cn(
                        "font-black text-slate-900 group-hover:text-indigo-950 transition-colors tracking-tight",
                        isLarge ? "text-base sm:text-lg" : "text-sm sm:text-base"
                      )}>
                        {card.title}
                      </h3>
                      <p className={cn(
                        "text-slate-500 group-hover:text-slate-700 font-medium leading-relaxed line-clamp-2 transition-colors",
                        isLarge ? "text-xs sm:text-sm" : "text-[11px]"
                      )}>
                        {card.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Footer Action Link with Hover Arrow */}
                  <div className="relative z-10 pt-3.5 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">
                    <span className="text-[11px] font-black group-hover:translate-x-1 transition-transform">ورود به بخش</span>
                    <div className={cn(
                      "w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:bg-indigo-600 group-hover:text-white shadow-2xs group-hover:shadow-indigo-600/30",
                      card.accentText
                    )}>
                      <ArrowLeft size={15} className="transform group-hover:-translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
