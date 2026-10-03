import React, { useState, useEffect } from 'react';
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
  Minimize2
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

interface MainDashboardProps {
  onNavigateTab: (tabId: string, studentId?: string) => void;
  onOpenSettings?: () => void;
}

export default function MainDashboard({ onNavigateTab }: MainDashboardProps) {
  const { currentUser, isSuperAdmin, isTabAllowed } = useAuth();

  const [unreadRequestsCount, setUnreadRequestsCount] = useState(0);
  const [unresolvedAnomaliesCount, setUnresolvedAnomaliesCount] = useState(0);

  // Edit / Drag & Drop Mode State
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

  // Filter allowed cards for user
  const allowedCardsMap = React.useMemo(() => {
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

  // Ordered Cards List according to user preference
  const sortedCards = React.useMemo(() => {
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 font-vazir relative min-h-[calc(100vh-5rem)]" dir="rtl">
      
      {/* Dynamic Layout Customization Bar */}
      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-4 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 tracking-tight">داشبورد پویا و کارتابل‌های سریع</h2>
            <p className="text-[11px] text-slate-500 font-medium">جهت ورود کلیک کنید • قابلیت حرکت ۳ بعدی و جابه‌جایی چیدمان (Drag & Drop)</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {/* Toggle First Row Sizing Option */}
          <button
            type="button"
            onClick={toggleFirstRowFeatured}
            className={cn(
              "px-3 py-2 rounded-2xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer shadow-2xs",
              isFirstRowFeatured 
                ? "bg-indigo-50 text-indigo-700 border-indigo-200" 
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
            title="تغییر ابعاد سطر اول به کارت‌های ۳ تایی بزرگ"
          >
            <LayoutGrid size={15} className={isFirstRowFeatured ? "text-indigo-600" : "text-slate-400"} />
            <span>{isFirstRowFeatured ? 'سطر اول ۳ تایی (بزرگ)' : 'سطر اول ۴ تایی (استاندارد)'}</span>
          </button>

          {/* Edit / Drag Toggle Button */}
          <button
            type="button"
            onClick={() => setIsEditMode(!isEditMode)}
            className={cn(
              "px-4 py-2 rounded-2xl text-xs font-black transition-all border flex items-center gap-2 cursor-pointer shadow-sm active:scale-95",
              isEditMode
                ? "bg-emerald-600 text-white border-emerald-600 shadow-emerald-600/20"
                : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
            )}
          >
            {isEditMode ? (
              <>
                <Check size={16} />
                <span>تایید چیدمان</span>
              </>
            ) : (
              <>
                <Move size={16} className="text-indigo-600" />
                <span>جابه‌جایی و ویرایش کارت‌ها</span>
              </>
            )}
          </button>

          {/* Reset Order Button */}
          {(customOrder.length > 0 || Object.keys(customCardSizes).length > 0) && (
            <button
              type="button"
              onClick={handleResetLayout}
              className="p-2 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-2xl border border-slate-200 hover:border-rose-200 transition-all cursor-pointer shadow-2xs"
              title="بازنشانی چیدمان به حالت اولیه"
            >
              <RotateCcw size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Edit Mode Notice Bar */}
      <AnimatePresence>
        {isEditMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-indigo-500/10 border border-amber-300/80 rounded-2xl flex items-center justify-between gap-3 text-right font-vazir text-xs font-bold text-amber-900"
          >
            <div className="flex items-center gap-2">
              <GripVertical size={18} className="text-amber-600 animate-pulse" />
              <span>حالت ویرایش چیدمان فعال است: کارت‌ها را با ماوس کشیده و جابه‌جا کنید (Drag & Drop). با دکمه‌های بزرگنمایی می‌توانید اندازه‌ هر کارت را تغییر دهید.</span>
            </div>
            <button
              onClick={() => setIsEditMode(false)}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[11px] font-black transition-all cursor-pointer shrink-0 shadow-xs"
            >
              اتمام ذخیره‌سازی
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Action Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 auto-rows-fr">
        {sortedCards.map((card, index) => {
          const Icon = card.icon;

          // Determine Card Sizing
          const customSize = customCardSizes[card.id];
          const isRow1Featured = isFirstRowFeatured && index < 3;
          const isLarge = customSize === 'large' || (customSize === undefined && isRow1Featured);

          // Grid Span Rules:
          // Row 1 featured cards take larger space on desktop (3 columns across row 1)
          const spanClass = isLarge
            ? "col-span-1 md:col-span-2 lg:col-span-4/3 xl:col-span-4/3 min-h-[160px]"
            : "col-span-1 min-h-[145px]";

          const isBeingDragged = draggedIndex === index;
          const isBeingDraggedOver = dragOverIndex === index;

          return (
            <motion.div
              key={card.id}
              layout
              draggable={isEditMode}
              onDragStart={(e) => handleDragStart(e as any, index)}
              onDragOver={(e) => handleDragOver(e as any, index)}
              onDrop={(e) => handleDrop(e as any, index)}
              whileHover={!isEditMode ? { 
                scale: 1.028, 
                y: -7,
                rotateX: -1.5,
                rotateY: 2,
                transition: { duration: 0.25, ease: 'easeOut' }
              } : undefined}
              whileTap={!isEditMode ? { scale: 0.97 } : undefined}
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
              {/* Background Glossy Morphing Color Gradient On Hover */}
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
                card.cardGradient
              )} />

              {/* Shimmer Light Reflection Sweep */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />

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
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shrink-0",
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
      </div>
    </div>
  );
}
