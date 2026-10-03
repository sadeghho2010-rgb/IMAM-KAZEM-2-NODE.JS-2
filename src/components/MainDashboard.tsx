import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMentor } from '../context/MentorContext';
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
  Activity, 
  ShieldAlert, 
  Settings, 
  Search, 
  ArrowLeft, 
  TrendingUp, 
  UtensilsCrossed, 
  FileSpreadsheet, 
  Building2, 
  Receipt, 
  HandCoins, 
  KeyRound, 
  Car, 
  BookCheck, 
  GitBranch, 
  ShieldCheck, 
  Sliders, 
  CalendarDays,
  Zap,
  CheckCircle2,
  AlertTriangle,
  BrainCircuit,
  UserCheck,
  MessageSquare
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { localDb } from '../lib/localDb';
import { StudentRequest, AnomalyLog } from '../types';

interface DashboardCardDef {
  id: string;
  title: string;
  subtitle: string;
  category: 'education' | 'finance' | 'students' | 'research' | 'requests' | 'system';
  icon: React.ComponentType<{ size?: number; className?: string }>;
  gradient: string;
  hoverBorder: string;
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

  // Ripple Coordinates
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  const handleCardClick = (e: React.MouseEvent<HTMLButtonElement>, tabId: string) => {
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
    }, 150);
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

  // Master List of Available Dashboard Action Cards
  const ALL_DASHBOARD_CARDS: DashboardCardDef[] = [
    // 1. CARDS FOR REQUESTS & WORKFLOW
    {
      id: 'student-requests',
      title: 'پنل رسیدگی به درخواست طلاب',
      subtitle: 'بررسی، تایید و صدور پاسخ آنلاین به مراجعین',
      category: 'requests',
      icon: Inbox,
      gradient: 'from-rose-500/10 via-rose-500/5 to-transparent text-rose-700',
      hoverBorder: 'hover:border-rose-400 hover:shadow-rose-500/10',
      badgeCount: unreadRequestsCount,
      badgeText: unreadRequestsCount > 0 ? `${unreadRequestsCount} جدید` : undefined,
      highlight: unreadRequestsCount > 0
    },
    {
      id: 'workflow',
      title: 'جریان کار و کارتابل تاییدات',
      subtitle: 'رسیدگی به تغییرات گروه‌های مباحثه و فرایندهای مدرسه‌ای',
      category: 'requests',
      icon: GitBranch,
      gradient: 'from-purple-500/10 via-purple-500/5 to-transparent text-purple-700',
      hoverBorder: 'hover:border-purple-400 hover:shadow-purple-500/10'
    },
    {
      id: 'todos',
      title: 'پیگیری‌ها و تسک‌های جاری',
      subtitle: 'مدیریت اقدامات فوری و پیگیری وضعیت طلاب',
      category: 'requests',
      icon: CheckSquare,
      gradient: 'from-indigo-500/10 via-indigo-500/5 to-transparent text-indigo-700',
      hoverBorder: 'hover:border-indigo-400 hover:shadow-indigo-500/10'
    },

    // 2. CARDS FOR EDUCATION
    {
      id: 'programs',
      title: 'برنامه‌ها و کلاس‌های درس',
      subtitle: 'مدیریت دروس، ساعات تدریس و سرفصل‌های آموزشی',
      category: 'education',
      icon: Calendar,
      gradient: 'from-indigo-500/10 via-indigo-500/5 to-transparent text-indigo-700',
      hoverBorder: 'hover:border-indigo-400 hover:shadow-indigo-500/10'
    },
    {
      id: 'classrooms',
      title: 'مدرس‌ها و فضاهای کلاس',
      subtitle: 'چینش فضاها، مدرس‌های درس و سالن‌های مباحثه',
      category: 'education',
      icon: DoorOpen,
      gradient: 'from-blue-500/10 via-blue-500/5 to-transparent text-blue-700',
      hoverBorder: 'hover:border-blue-400 hover:shadow-blue-500/10'
    },
    {
      id: 'student-schedule',
      title: 'برنامه درسی و هفتگی طلاب',
      subtitle: 'مشاهده تقویم هفتگی کلاس‌ها و برنامه آموزشی',
      category: 'education',
      icon: CalendarDays,
      gradient: 'from-sky-500/10 via-sky-500/5 to-transparent text-sky-700',
      hoverBorder: 'hover:border-sky-400 hover:shadow-sky-500/10'
    },
    {
      id: 'course-selection',
      title: 'سامانه انتخاب واحد',
      subtitle: 'مدیریت بازه‌های انتخاب واحد و درخواست‌های دروس',
      category: 'education',
      icon: BookOpen,
      gradient: 'from-teal-500/10 via-teal-500/5 to-transparent text-teal-700',
      hoverBorder: 'hover:border-teal-400 hover:shadow-teal-500/10'
    },
    {
      id: 'oral-exams',
      title: 'سامانه آزمون شفاهی طلاب',
      subtitle: 'برنامه‌ریزی، ثبت نمرات و محدوده آزمون فقه و اصول',
      category: 'education',
      icon: Award,
      gradient: 'from-cyan-500/10 via-cyan-500/5 to-transparent text-cyan-700',
      hoverBorder: 'hover:border-cyan-400 hover:shadow-cyan-500/10'
    },
    {
      id: 'teachers-bank',
      title: 'بانک اساتید و مدرسین',
      subtitle: 'مشخصات، مدارک و ظرفیت تدریس اساتید',
      category: 'education',
      icon: GraduationCap,
      gradient: 'from-indigo-500/10 via-indigo-500/5 to-transparent text-indigo-700',
      hoverBorder: 'hover:border-indigo-400 hover:shadow-indigo-500/10'
    },

    // 3. CARDS FOR STUDENTS AFFAIRS
    {
      id: 'students',
      title: 'مدیریت کل طلاب',
      subtitle: 'پرونده جامع، مشخصات فردی و وضعیت تحصیلی',
      category: 'students',
      icon: Users,
      gradient: 'from-blue-500/10 via-blue-500/5 to-transparent text-blue-700',
      hoverBorder: 'hover:border-blue-400 hover:shadow-blue-500/10'
    },
    {
      id: 'attendance',
      title: 'حضور و غیاب طلاب',
      subtitle: 'ثبت و پایش روزانه حضور در کلاس‌ها و ساعات آموزشی',
      category: 'students',
      icon: CheckSquare,
      gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent text-emerald-700',
      hoverBorder: 'hover:border-emerald-400 hover:shadow-emerald-500/10'
    },
    {
      id: 'discussion',
      title: 'گروه‌های مباحثه و پایش دروس',
      subtitle: 'پایش پوشش دروس فقه و اصول و هم‌بحثی‌ها',
      category: 'students',
      icon: Users,
      gradient: 'from-indigo-500/10 via-indigo-500/5 to-transparent text-indigo-700',
      hoverBorder: 'hover:border-indigo-400 hover:shadow-indigo-500/10'
    },
    {
      id: 'stats',
      title: 'آمار ساعات مطالعه',
      subtitle: 'تحلیل ساعات مطالعه فردی و مباحثاتی طلاب',
      category: 'students',
      icon: BarChart2,
      gradient: 'from-amber-500/10 via-amber-500/5 to-transparent text-amber-700',
      hoverBorder: 'hover:border-amber-400 hover:shadow-amber-500/10'
    },
    {
      id: 'summary',
      title: 'پرونده علمی طلاب',
      subtitle: 'جمع‌بندی سوابق، تحلیل هوش مصنوعی و نمودارهای رشد',
      category: 'students',
      icon: BrainCircuit,
      gradient: 'from-violet-500/10 via-violet-500/5 to-transparent text-violet-700',
      hoverBorder: 'hover:border-violet-400 hover:shadow-violet-500/10'
    },
    {
      id: 'comments',
      title: 'نظرات و ارزیابی‌های تربیتی',
      subtitle: 'ثبت پرونده مشاوره‌ای و جلسات گفتگو',
      category: 'students',
      icon: MessageSquare,
      gradient: 'from-slate-500/10 via-slate-500/5 to-transparent text-slate-700',
      hoverBorder: 'hover:border-slate-400 hover:shadow-slate-500/10'
    },

    // 4. CARDS FOR RESEARCH & COUNSELING
    {
      id: 'research',
      title: 'بخش پژوهش و مقالات',
      subtitle: 'ثبت و پیگیری مقالات، کرسی‌ها و آثار پژوهشی',
      category: 'research',
      icon: BookOpen,
      gradient: 'from-amber-500/10 via-amber-500/5 to-transparent text-amber-700',
      hoverBorder: 'hover:border-amber-400 hover:shadow-amber-500/10'
    },
    {
      id: 'counseling-classes',
      title: 'کلاس‌های مشاوره (ارزیابی و نمرات)',
      subtitle: 'ثبت کلاسی ارزیابی و سنجش تعهد اساتید مشاور',
      category: 'research',
      icon: BookCheck,
      gradient: 'from-amber-500/10 via-amber-500/5 to-transparent text-amber-700',
      hoverBorder: 'hover:border-amber-400 hover:shadow-amber-500/10'
    },
    {
      id: 'article-evaluations',
      title: 'ارزیابی مقالات علمی',
      subtitle: 'داوری، نمره‌دهی و صدور کارنامه پژوهشی',
      category: 'research',
      icon: Award,
      gradient: 'from-amber-500/10 via-amber-500/5 to-transparent text-amber-700',
      hoverBorder: 'hover:border-amber-400 hover:shadow-amber-500/10'
    },
    {
      id: 'consultation-advisor',
      title: 'دستیار کلاس‌های مشاوره',
      subtitle: 'چینش هوشمند جلسات و هماهنگی زمان‌بندی',
      category: 'research',
      icon: Sparkles,
      gradient: 'from-amber-500/10 via-amber-500/5 to-transparent text-amber-700',
      hoverBorder: 'hover:border-amber-400 hover:shadow-amber-500/10'
    },

    // 5. CARDS FOR FINANCE & WELFARE
    {
      id: 'finance-tuition',
      title: 'محاسبه شهریه طلاب',
      subtitle: 'محاسبه مکانیزه شهریه بر مبنای حضور، مباحثه و فعالیت',
      category: 'finance',
      icon: Coins,
      gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent text-emerald-700',
      hoverBorder: 'hover:border-emerald-400 hover:shadow-emerald-500/10'
    },
    {
      id: 'finance-grade-mentors',
      title: 'حق‌الزحمه اساتید پایه',
      subtitle: 'محاسبه حق سرپرستی، پیگیری‌ها و جلسات مباحثه',
      category: 'finance',
      icon: BookOpen,
      gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent text-emerald-700',
      hoverBorder: 'hover:border-emerald-400 hover:shadow-emerald-500/10'
    },
    {
      id: 'finance-teachers',
      title: 'حق‌التدریس اساتید',
      subtitle: 'ساعات تدریس مصوب، نرخ جلسات و صدور فیش',
      category: 'finance',
      icon: Clock,
      gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent text-emerald-700',
      hoverBorder: 'hover:border-emerald-400 hover:shadow-emerald-500/10'
    },
    {
      id: 'finance-lunch',
      title: 'اطلاعات نهار و شام',
      subtitle: 'مدیریت سلف، آمار پخت و کسر شهریه وعده‌های غذایی',
      category: 'finance',
      icon: UtensilsCrossed,
      gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent text-emerald-700',
      hoverBorder: 'hover:border-emerald-400 hover:shadow-emerald-500/10'
    },
    {
      id: 'finance-loans-fund',
      title: 'صندوق قرض‌الحسنه و وام‌ها',
      subtitle: 'تقاضا، اقساط، مانده وام و گردش حساب صندوق',
      category: 'finance',
      icon: Building2,
      gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent text-emerald-700',
      hoverBorder: 'hover:border-emerald-400 hover:shadow-emerald-500/10'
    },
    {
      id: 'finance-claims',
      title: 'مطالبات و بدهی‌ها',
      subtitle: 'رسیدگی به مانده حساب‌های اشخاص و تسویه‌ها',
      category: 'finance',
      icon: HandCoins,
      gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent text-emerald-700',
      hoverBorder: 'hover:border-emerald-400 hover:shadow-emerald-500/10'
    },
    {
      id: 'finance-expenses-reports',
      title: 'هزینه‌ها و ردیف‌های بودجه',
      subtitle: 'ثبت اسناد هزینه، تنخواه‌گردان و ترازهای مالی',
      category: 'finance',
      icon: Receipt,
      gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent text-emerald-700',
      hoverBorder: 'hover:border-emerald-400 hover:shadow-emerald-500/10'
    },
    {
      id: 'lockers',
      title: 'اختصاص کمد و کلید',
      subtitle: 'امانت کلید، رزرواسیون کمد و مدیریت اموال رفاهی',
      category: 'finance',
      icon: KeyRound,
      gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent text-emerald-700',
      hoverBorder: 'hover:border-emerald-400 hover:shadow-emerald-500/10'
    },
    {
      id: 'teacher-transport',
      title: 'سرویس و ایاب و ذهاب اساتید',
      subtitle: 'روتین هفتگی، رانندگان و تسویه ترابری',
      category: 'finance',
      icon: Car,
      gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent text-emerald-700',
      hoverBorder: 'hover:border-emerald-400 hover:shadow-emerald-500/10'
    },

    // 6. CARDS FOR SYSTEM & ADMIN
    {
      id: 'user-management',
      title: 'مدیریت کاربران و دسترسی‌ها',
      subtitle: 'تعریف نقش‌ها، تعیین دسترسی ماژول‌ها و سطوح RBAC',
      category: 'system',
      icon: Settings,
      gradient: 'from-slate-500/10 via-slate-500/5 to-transparent text-slate-700',
      hoverBorder: 'hover:border-slate-400 hover:shadow-slate-500/10'
    },
    {
      id: 'backup',
      title: 'پشتیبان‌گیری از دیتابیس',
      subtitle: 'تهیه فایل پشتیبان و بازیابی ایمن داده‌ها',
      category: 'system',
      icon: HardDrive,
      gradient: 'from-slate-500/10 via-slate-500/5 to-transparent text-slate-700',
      hoverBorder: 'hover:border-slate-400 hover:shadow-slate-500/10'
    },
    {
      id: 'anomaly-detection',
      title: 'تشخیص ناهنجاری‌ها و بازرسی امنیت',
      subtitle: 'پایش رویدادهای مشکوک، هشدارها و رولبک خودکار',
      category: 'system',
      icon: ShieldAlert,
      gradient: 'from-rose-500/10 via-rose-500/5 to-transparent text-rose-700',
      hoverBorder: 'hover:border-rose-400 hover:shadow-rose-500/10',
      badgeCount: unresolvedAnomaliesCount,
      badgeText: unresolvedAnomaliesCount > 0 ? `${unresolvedAnomaliesCount} هشدار` : undefined,
      highlight: unresolvedAnomaliesCount > 0
    }
  ];

  // Filter cards based on user role and permissions
  const userAllowedCards = ALL_DASHBOARD_CARDS.filter(card => {
    if (!currentUser) return false;

    // Check module permission
    if (!isTabAllowed(card.id)) {
      return false;
    }

    // Rule 6: Education Manager must NOT see research cards
    if (isEducationManager && ['research', 'article-evaluations', 'counseling-classes', 'consultation-advisor'].includes(card.id)) {
      return false;
    }

    // Grade Mentors only see relevant mentor modules
    if (isGradeMentor && card.id === 'student-requests') {
      return false;
    }

    return true;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 font-vazir relative min-h-[calc(100vh-5rem)]" dir="rtl">
      {/* Dynamic Quick Action Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
        {userAllowedCards.map((card) => {
          const Icon = card.icon;

          return (
            <button
              key={card.id}
              onClick={(e) => handleCardClick(e, card.id)}
              type="button"
              className={cn(
                "relative group overflow-hidden bg-white rounded-3xl p-5 sm:p-6 border text-right transition-all duration-300 cursor-pointer flex flex-col justify-between shadow-xs hover:shadow-xl hover:-translate-y-1 select-none",
                card.highlight ? "border-rose-300 ring-2 ring-rose-500/20" : "border-slate-200/90",
                card.hoverBorder
              )}
            >
              {/* Background Morphing Gradient On Hover */}
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
                card.gradient
              )} />

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

              <div className="relative z-10 space-y-3.5">
                {/* Card Icon & Badge */}
                <div className="flex items-center justify-between">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-xs group-hover:scale-110",
                    card.category === 'requests' ? "bg-rose-50 text-rose-700 group-hover:bg-rose-600 group-hover:text-white" :
                    card.category === 'education' ? "bg-indigo-50 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white" :
                    card.category === 'students' ? "bg-sky-50 text-sky-700 group-hover:bg-sky-600 group-hover:text-white" :
                    card.category === 'research' ? "bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white" :
                    card.category === 'finance' ? "bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white" :
                    "bg-slate-100 text-slate-700 group-hover:bg-slate-800 group-hover:text-white"
                  )}>
                    <Icon size={24} />
                  </div>

                  {card.badgeText && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white shadow-xs animate-bounce">
                      {card.badgeText}
                    </span>
                  )}
                </div>

                {/* Card Titles */}
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-slate-900 group-hover:text-indigo-950 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 group-hover:text-slate-700 font-medium leading-relaxed line-clamp-2">
                    {card.subtitle}
                  </p>
                </div>
              </div>

              {/* Footer Action Link */}
              <div className="relative z-10 pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">
                <span className="text-[11px] font-black">ورود به بخش</span>
                <ArrowLeft size={14} className="transform group-hover:-translate-x-1 transition-transform" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
