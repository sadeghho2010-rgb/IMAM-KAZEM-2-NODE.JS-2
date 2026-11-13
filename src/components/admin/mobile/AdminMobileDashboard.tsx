import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Search,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  ChevronLeft,
  AlertTriangle,
  Sparkles,
  Check,
  X,
  BookOpen,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import AnimatedCounter from '../../AnimatedCounter';
import {
  GlyphActiveStudents,
  GlyphProgramsBook,
  GlyphAttendanceShield,
  GlyphStudyAnalytics,
  GlyphTeachersCap,
  GlyphRequestsInbox,
  GlyphWorkflowFlow,
  GlyphFinanceCoins,
  GlyphSecurityLock,
} from './AdminMobileIcons';

export interface AdminMobileCardDef {
  id: string;
  title: string;
  subtitle: string;
  category: 'education' | 'finance' | 'students' | 'research' | 'requests' | 'system';
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconBg: string;
  accentText: string;
  badgeText?: string;
  badgeCount?: number;
  highlight?: boolean;
}

interface AdminMobileDashboardProps {
  currentUser: any;
  todayFormatted: string;
  activeStudentsCount: number;
  activeTeachersCount: number;
  passedStudyDays: number;
  remainingStudyDays: number;
  unreadRequestsCount: number;
  pendingWorkflowCount: number;
  unresolvedAnomaliesCount: number;
  systemHealthAlert: { isHigh: boolean; cpuPercent: number; ramPercent: number; message: string } | null;
  sortedCards: AdminMobileCardDef[];
  allowedCardsMap: Map<string, AdminMobileCardDef>;
  customOrder: string[];
  onSaveCustomOrder: (ids: string[]) => void;
  onResetLayout: () => void;
  onNavigateTab: (tabId: string, studentId?: string) => void;
  isCounterAnimDisabled?: boolean;
  hadith?: { arabic: string; source: string };
}

type CategoryFilterKey = 'all' | 'requests' | 'education' | 'students' | 'research' | 'finance' | 'system';

const CATEGORY_TABS: Array<{ key: CategoryFilterKey; label: string }> = [
  { key: 'all', label: 'همه بخش‌ها' },
  { key: 'students', label: 'امور طلاب' },
  { key: 'education', label: 'آموزش و کلاس' },
  { key: 'requests', label: 'کارتابل' },
  { key: 'research', label: 'پژوهش' },
  { key: 'finance', label: 'مالی و رفاهی' },
  { key: 'system', label: 'امنیت و سیستم' },
];

const PRIORITY_CARD_GRADIENTS: Record<string, string> = {
  'active-students': 'from-teal-700 via-emerald-700 to-cyan-800 border-emerald-400/35',
  programs: 'from-indigo-700 via-violet-700 to-purple-800 border-indigo-300/35',
  attendance: 'from-emerald-700 via-teal-700 to-green-800 border-teal-300/35',
  stats: 'from-amber-600 via-orange-600 to-rose-700 border-amber-300/35',
  'teachers-bank': 'from-sky-700 via-indigo-700 to-blue-900 border-sky-300/35',
  'student-requests': 'from-rose-700 via-pink-700 to-red-800 border-rose-300/35',
  workflow: 'from-purple-700 via-indigo-700 to-slate-900 border-purple-300/35',
};

function getPriorityGlyph(cardId: string) {
  switch (cardId) {
    case 'active-students':
      return GlyphActiveStudents;
    case 'programs':
      return GlyphProgramsBook;
    case 'attendance':
      return GlyphAttendanceShield;
    case 'stats':
      return GlyphStudyAnalytics;
    case 'teachers-bank':
      return GlyphTeachersCap;
    case 'student-requests':
      return GlyphRequestsInbox;
    case 'workflow':
      return GlyphWorkflowFlow;
    case 'finance-tuition':
    case 'finance-teachers':
      return GlyphFinanceCoins;
    case 'user-management':
    case 'system-health':
      return GlyphSecurityLock;
    default:
      return null;
  }
}

export const AdminMobileDashboard: React.FC<AdminMobileDashboardProps> = ({
  currentUser,
  todayFormatted,
  activeStudentsCount,
  activeTeachersCount,
  passedStudyDays,
  remainingStudyDays,
  unreadRequestsCount,
  pendingWorkflowCount,
  unresolvedAnomaliesCount,
  systemHealthAlert,
  sortedCards,
  customOrder,
  onSaveCustomOrder,
  onResetLayout,
  onNavigateTab,
  isCounterAnimDisabled,
  hadith,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isReorderOpen, setIsReorderOpen] = useState(false);

  const displayName = (currentUser?.name || currentUser?.fullName || currentUser?.username || 'مدیریت محترم')
    .split('(')[0]
    .trim();

  // Top 5 priority cards (respects اصلاح ۲۸ default RTL order or user's custom saved order)
  const priorityCards = useMemo(() => sortedCards.slice(0, 5), [sortedCards]);

  // Filtered directory cards based on category chip + Persian quick search
  const directoryCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortedCards.filter((card) => {
      if (selectedCategory !== 'all' && card.category !== selectedCategory) return false;
      if (q) {
        return (
          card.title.toLowerCase().includes(q) ||
          card.subtitle.toLowerCase().includes(q) ||
          card.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [sortedCards, selectedCategory, searchQuery]);

  const totalPendingInbox = unreadRequestsCount + pendingWorkflowCount;

  const moveCardInOrder = (index: number, delta: -1 | 1) => {
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= sortedCards.length) return;
    const nextList = [...sortedCards];
    const [moved] = nextList.splice(index, 1);
    nextList.splice(targetIdx, 0, moved);
    onSaveCustomOrder(nextList.map((c) => c.id));
  };

  return (
    <div className="space-y-4 font-vazir text-right" dir="rtl">
      {/* 1. Executive Obsidian KPI Hero Banner */}
      <motion.section
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.22 }}
        className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-4 shadow-[0_14px_34px_-12px_rgba(15,23,42,0.55)] border border-indigo-400/25 space-y-3.5"
      >
        {/* Ambient radial highlight */}
        <div
          className="pointer-events-none absolute -top-14 -left-10 w-44 h-44 rounded-full opacity-35"
          style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.42) 0%, transparent 70%)' }}
          aria-hidden="true"
        />

        <div className="relative z-10 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-cyan-200/90">
              <span>{currentUser?.roleTitle || 'مدیریت سامانه'}</span>
              {currentUser?.gradeLabel && (
                <>
                  <span className="text-white/30">·</span>
                  <span>{currentUser.gradeLabel}</span>
                </>
              )}
            </div>
            <h2 className="text-base font-black text-white truncate mt-0.5">
              خوش آمدید، {displayName}
            </h2>
            <p className="text-[10.5px] text-slate-300 font-medium mt-0.5 tabular-nums">
              {todayFormatted}
            </p>
          </div>

          {totalPendingInbox > 0 && (
            <button
              type="button"
              onClick={() => onNavigateTab(unreadRequestsCount > 0 ? 'student-requests' : 'workflow')}
              className="min-h-[38px] px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 text-[10.5px] font-black flex items-center gap-1.5 shrink-0 shadow-xs active:scale-95 cursor-pointer tabular-nums"
            >
              <Sparkles size={13} />
              <span>{totalPendingInbox} مورد منتظر</span>
            </button>
          )}
        </div>

        {/* 4 Live KPI Counters */}
        <div className="relative z-10 grid grid-cols-4 gap-1.5 pt-3 border-t border-white/10 text-center">
          <button
            type="button"
            onClick={() => onNavigateTab('active-students')}
            className="p-2 rounded-2xl bg-white/[0.07] hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
          >
            <div className="text-sm font-black text-emerald-300 font-mono tabular-nums">
              <AnimatedCounter value={activeStudentsCount} duration={isCounterAnimDisabled ? 0 : 900} />
            </div>
            <div className="text-[9.5px] text-slate-300 font-bold truncate mt-0.5">طلاب فعال</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('teachers-bank')}
            className="p-2 rounded-2xl bg-white/[0.07] hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
          >
            <div className="text-sm font-black text-cyan-300 font-mono tabular-nums">
              <AnimatedCounter value={activeTeachersCount} duration={isCounterAnimDisabled ? 0 : 900} />
            </div>
            <div className="text-[9.5px] text-slate-300 font-bold truncate mt-0.5">اساتید فعال</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('academic-calendar')}
            className="p-2 rounded-2xl bg-white/[0.07] hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
          >
            <div className="text-sm font-black text-amber-300 font-mono tabular-nums">
              <AnimatedCounter value={remainingStudyDays} duration={isCounterAnimDisabled ? 0 : 900} />
            </div>
            <div className="text-[9.5px] text-slate-300 font-bold truncate mt-0.5">روز مانده</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('academic-calendar')}
            className="p-2 rounded-2xl bg-white/[0.07] hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
          >
            <div className="text-sm font-black text-indigo-300 font-mono tabular-nums">
              <AnimatedCounter value={passedStudyDays} duration={isCounterAnimDisabled ? 0 : 900} />
            </div>
            <div className="text-[9.5px] text-slate-300 font-bold truncate mt-0.5">روز گذشته</div>
          </button>
        </div>

        {/* Compact Knowledge Hadith Footer */}
        {hadith && (
          <div className="relative z-10 p-2.5 rounded-2xl bg-white/[0.05] border border-white/10 flex items-start gap-2">
            <BookOpen size={14} className="text-amber-300 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] text-slate-200 leading-relaxed line-clamp-2 font-medium">
                {hadith.arabic}
              </p>
              <span className="text-[9.5px] text-amber-300/90 font-bold mt-0.5 inline-block">
                — {hadith.source}
              </span>
            </div>
          </div>
        )}
      </motion.section>

      {/* 2. Critical System Health or Security Alert Banner */}
      {(systemHealthAlert?.isHigh || unresolvedAnomaliesCount > 0) && (
        <div className="space-y-2">
          {systemHealthAlert?.isHigh && (
            <button
              type="button"
              onClick={() => onNavigateTab('system-health')}
              className="w-full min-h-[48px] p-3 rounded-2xl bg-rose-600 text-white text-right flex items-center justify-between gap-2 shadow-md cursor-pointer active:scale-[0.985]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle size={18} className="shrink-0 text-amber-200" />
                <div className="min-w-0">
                  <div className="text-xs font-black truncate">هشدار سلامت سرور</div>
                  <div className="text-[10.5px] text-rose-100 truncate">{systemHealthAlert.message}</div>
                </div>
              </div>
              <ChevronLeft size={16} className="shrink-0" />
            </button>
          )}
          {unresolvedAnomaliesCount > 0 && (
            <button
              type="button"
              onClick={() => onNavigateTab('anomaly-detection')}
              className="w-full min-h-[46px] p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-right flex items-center justify-between gap-2 cursor-pointer active:scale-[0.985]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle size={17} className="shrink-0 text-amber-600" />
                <span className="text-xs font-black truncate tabular-nums">
                  {unresolvedAnomaliesCount} ناهنجاری یا هشدار امنیتی نیاز به بررسی دارد
                </span>
              </div>
              <ChevronLeft size={16} className="shrink-0 text-amber-700" />
            </button>
          )}
        </div>
      )}

      {/* 3. Priority Quick-Launch Cards (اصلاح ۲۸: Default RTL order + customizable) */}
      <section aria-label="بخش‌های کلیدی و دسترسی سریع" className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <h2 className="text-xs font-black text-slate-900">اولویت‌های اصلی میز کار</h2>
            <span className="text-[10px] text-slate-400 font-bold tabular-nums">({priorityCards.length})</span>
          </div>
          <button
            type="button"
            onClick={() => setIsReorderOpen(true)}
            className="min-h-[34px] px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
          >
            <SlidersHorizontal size={12} />
            <span>چیدمان کارت‌ها</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {priorityCards.map((card, idx) => {
            const PriorityGlyph = getPriorityGlyph(card.id);
            const FallbackIcon = card.icon;
            const gradientClass =
              PRIORITY_CARD_GRADIENTS[card.id] || 'from-slate-800 via-indigo-900 to-slate-900 border-indigo-300/30';
            const isHeroWide = idx === 0 && priorityCards.length % 2 === 1;

            return (
              <motion.button
                key={card.id}
                type="button"
                whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                onClick={() => onNavigateTab(card.id)}
                className={cn(
                  'relative overflow-hidden rounded-[22px] p-3.5 text-white text-right border shadow-[0_10px_24px_-10px_rgba(15,23,42,0.38)] flex flex-col justify-between min-h-[108px] cursor-pointer bg-gradient-to-br',
                  gradientClass,
                  isHeroWide && 'col-span-2 min-h-[96px]'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/25 flex items-center justify-center shrink-0">
                    {PriorityGlyph ? (
                      <PriorityGlyph size={20} className="text-white" active />
                    ) : (
                      <FallbackIcon size={19} className="text-white" />
                    )}
                  </div>
                  {card.badgeText ? (
                    <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-slate-950 text-[10px] font-black tabular-nums">
                      {card.badgeText}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-white/75 tabular-nums">اولویت {idx + 1}</span>
                  )}
                </div>

                <div className="pt-2 space-y-0.5">
                  <h3 className="text-xs font-black text-white truncate">{card.title}</h3>
                  <p className="text-[10px] text-white/80 font-medium truncate">{card.subtitle}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* 4. Instant Search + Semantic Category Tabs + All Modules Grid */}
      <section aria-label="تمامی سامانه‌ها و بخش‌ها" className="space-y-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-black text-slate-900">فهرست بخش‌های سامانه</h2>
          <span className="text-[10px] text-slate-400 font-bold tabular-nums">{directoryCards.length} بخش</span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجوی سریع بخش (مثلاً حضور، شهریه، آزمون، مباحثه)..."
            className="w-full min-h-[44px] pr-10 pl-9 py-2 bg-white border border-slate-200/90 rounded-2xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              aria-label="پاک کردن جستجو"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Horizontal Scrollable Category Filter Rail */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORY_TABS.map((cat) => {
            const isActive = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedCategory(cat.key)}
                className={cn(
                  'min-h-[38px] px-3 py-1.5 rounded-xl text-[11px] font-black shrink-0 transition-all cursor-pointer border',
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                )}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* 2-Column Touch Cards Grid */}
        {directoryCards.length === 0 ? (
          <div className="p-6 text-center bg-white rounded-3xl border border-slate-200/80 text-xs text-slate-500 font-medium">
            بخشی مطابق جستجوی شما یافت نشد.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 pb-2">
            {directoryCards.map((card) => {
              const Icon = card.icon;
              return (
                <motion.button
                  key={card.id}
                  type="button"
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
                  onClick={() => onNavigateTab(card.id)}
                  className={cn(
                    'min-h-[84px] p-3 bg-white hover:bg-slate-50 rounded-[22px] border text-right flex flex-col justify-between gap-2 transition-colors shadow-2xs cursor-pointer',
                    card.highlight ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200/90'
                  )}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', card.iconBg)}>
                      <Icon size={17} />
                    </div>
                    {card.badgeText && (
                      <span className="px-2 py-0.5 rounded-lg bg-rose-600 text-white text-[9.5px] font-black tabular-nums truncate max-w-[78px]">
                        {card.badgeText}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11.5px] font-black text-slate-900 truncate">{card.title}</div>
                    <div className="text-[9.5px] text-slate-500 font-medium truncate mt-0.5">{card.subtitle}</div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. Touch-Friendly Card Reorder Bottom Sheet (اصلاح ۲۸ customization on mobile) */}
      <AnimatePresence>
        {isReorderOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" dir="rtl">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReorderOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            />
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { y: '100%' }}
              animate={prefersReducedMotion ? { opacity: 1 } : { y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { y: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              className="relative z-10 w-full max-w-xl bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="pt-2.5 pb-1 flex justify-center shrink-0">
                <div className="w-10 h-1 rounded-full bg-slate-300" />
              </div>

              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
                <div>
                  <h3 className="text-sm font-black text-slate-900">شخصی‌سازی ترتیب کارت‌ها</h3>
                  <p className="text-[10.5px] text-slate-500 font-medium">
                    ۵ کارت اول در بالای پیشخوان موبایل و نوار دسترسی سریع نمایش داده می‌شوند.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsReorderOpen(false)}
                  className="min-h-[40px] min-w-[40px] rounded-xl text-slate-500 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                  aria-label="بستن"
                >
                  <X size={19} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {sortedCards.map((card, idx) => {
                  const Icon = card.icon;
                  const isTopFive = idx < 5;
                  return (
                    <div
                      key={card.id}
                      className={cn(
                        'p-2.5 rounded-2xl border flex items-center justify-between gap-2',
                        isTopFive ? 'bg-indigo-50/70 border-indigo-200' : 'bg-white border-slate-200'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={cn(
                            'w-6 h-6 rounded-lg text-[10.5px] font-black flex items-center justify-center shrink-0 tabular-nums',
                            isTopFive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                          )}
                        >
                          {idx + 1}
                        </span>
                        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0', card.iconBg)}>
                          <Icon size={15} />
                        </div>
                        <span className="text-xs font-black text-slate-900 truncate">{card.title}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveCardInOrder(idx, -1)}
                          className="min-h-[38px] min-w-[38px] rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-indigo-50 disabled:opacity-35 flex items-center justify-center cursor-pointer"
                          aria-label="انتقال به بالا"
                        >
                          <ArrowUp size={15} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === sortedCards.length - 1}
                          onClick={() => moveCardInOrder(idx, 1)}
                          className="min-h-[38px] min-w-[38px] rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-indigo-50 disabled:opacity-35 flex items-center justify-center cursor-pointer"
                          aria-label="انتقال به پایین"
                        >
                          <ArrowDown size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
                {customOrder.length > 0 ? (
                  <button
                    type="button"
                    onClick={onResetLayout}
                    className="min-h-[42px] px-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw size={14} />
                    <span>بازگشت به پیش‌فرض</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-500 font-medium">چیدمان پیش‌فرض فعال است</span>
                )}
                <button
                  type="button"
                  onClick={() => setIsReorderOpen(false)}
                  className="min-h-[42px] px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Check size={15} />
                  <span>ذخیره و بستن</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
