import React, { useState } from 'react';
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface MobileActionItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  tone?: 'default' | 'primary' | 'emerald' | 'amber' | 'rose' | 'indigo';
  badge?: string | number;
  disabled?: boolean;
  fileInputProps?: {
    accept?: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  };
}

interface MobileSectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badgeText?: string;
  variant?: 'white' | 'indigo' | 'emerald' | 'slate';
  primaryAction?: MobileActionItem;
  secondaryActions?: MobileActionItem[];
  secondaryLabel?: string;
  extraContent?: React.ReactNode;
}

export const MobileSectionHeader: React.FC<MobileSectionHeaderProps> = ({
  title,
  subtitle,
  icon,
  badgeText,
  variant = 'white',
  primaryAction,
  secondaryActions = [],
  secondaryLabel = 'سایر ابزارها',
  extraContent,
}) => {
  const [toolsOpen, setToolsOpen] = useState(false);

  const containerTone =
    variant === 'indigo'
      ? 'bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white border-indigo-400/25 shadow-md'
      : variant === 'emerald'
      ? 'bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-950 text-white border-emerald-400/25 shadow-md'
      : variant === 'slate'
      ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white border-slate-700 shadow-md'
      : 'bg-white text-slate-900 border-slate-200/90 shadow-xs';

  const isDark = variant !== 'white';

  const renderToneBtn = (tone?: MobileActionItem['tone']) => {
    switch (tone) {
      case 'emerald':
        return 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700';
      case 'amber':
        return 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100';
      case 'rose':
        return 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100';
      case 'indigo':
        return 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700';
      case 'primary':
        return 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700';
      default:
        return isDark
          ? 'bg-white/10 text-white border-white/15 hover:bg-white/15'
          : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100';
    }
  };

  return (
    <div className={cn('rounded-[22px] border p-3.5 space-y-3 transition-all', containerTone)} dir="rtl">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {icon && (
            <div
              className={cn(
                'w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border',
                isDark
                  ? 'bg-white/10 text-amber-300 border-white/15'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-100'
              )}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className={cn('text-sm font-black leading-snug truncate', isDark ? 'text-white' : 'text-slate-900')}>
                {title}
              </h2>
              {badgeText && (
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0 border',
                    isDark
                      ? 'bg-white/15 text-cyan-200 border-white/15'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  )}
                >
                  {badgeText}
                </span>
              )}
            </div>
            {subtitle && (
              <p className={cn('text-[11px] font-medium mt-0.5 line-clamp-2 leading-relaxed', isDark ? 'text-slate-300' : 'text-slate-500')}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      {(primaryAction || secondaryActions.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap">
          {primaryAction && (
            <button
              type="button"
              disabled={primaryAction.disabled}
              onClick={primaryAction.onClick}
              className={cn(
                'flex-1 min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] shadow-xs border disabled:opacity-50',
                renderToneBtn(primaryAction.tone || 'primary')
              )}
            >
              {primaryAction.icon}
              <span className="truncate">{primaryAction.label}</span>
              {primaryAction.badge !== undefined && (
                <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] font-mono">
                  {primaryAction.badge}
                </span>
              )}
            </button>
          )}

          {secondaryActions.length > 0 && (
            <button
              type="button"
              onClick={() => setToolsOpen((p) => !p)}
              className={cn(
                'min-h-[42px] px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer border shrink-0',
                isDark
                  ? 'bg-white/10 hover:bg-white/15 text-white border-white/20'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-800 border-slate-200'
              )}
            >
              <SlidersHorizontal size={14} />
              <span>{secondaryLabel}</span>
              <ChevronDown size={14} className={cn('transition-transform', toolsOpen && 'rotate-180')} />
            </button>
          )}
        </div>
      )}

      {toolsOpen && secondaryActions.length > 0 && (
        <div
          className={cn(
            'grid grid-cols-2 gap-2 pt-2.5 border-t',
            isDark ? 'border-white/10' : 'border-slate-100'
          )}
        >
          {secondaryActions.map((act) => {
            if (act.fileInputProps) {
              return (
                <label
                  key={act.id}
                  className={cn(
                    'min-h-[42px] px-3 py-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 border cursor-pointer transition-all text-center',
                    renderToneBtn(act.tone)
                  )}
                >
                  {act.icon}
                  <span className="truncate">{act.label}</span>
                  <input
                    type="file"
                    className="hidden"
                    accept={act.fileInputProps.accept}
                    onChange={(e) => {
                      setToolsOpen(false);
                      act.fileInputProps?.onChange(e);
                    }}
                  />
                </label>
              );
            }
            return (
              <button
                key={act.id}
                type="button"
                disabled={act.disabled}
                onClick={() => {
                  setToolsOpen(false);
                  act.onClick?.();
                }}
                className={cn(
                  'min-h-[42px] px-3 py-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 border cursor-pointer transition-all disabled:opacity-50',
                  renderToneBtn(act.tone)
                )}
              >
                {act.icon}
                <span className="truncate">{act.label}</span>
                {act.badge !== undefined && (
                  <span className="px-1.5 py-0.5 rounded-md bg-black/10 text-[10px] font-mono">
                    {act.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {extraContent}
    </div>
  );
};

export interface MobileTabOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  tone?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
}

interface MobileHorizontalTabsProps {
  tabs: MobileTabOption[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export const MobileHorizontalTabs: React.FC<MobileHorizontalTabsProps> = ({
  tabs,
  activeId,
  onChange,
  className,
}) => {
  const getActiveStyle = (tone?: MobileTabOption['tone']) => {
    switch (tone) {
      case 'emerald':
        return 'bg-emerald-600 text-white border-emerald-600 shadow-xs';
      case 'amber':
        return 'bg-amber-600 text-white border-amber-600 shadow-xs';
      case 'rose':
        return 'bg-rose-600 text-white border-rose-600 shadow-xs';
      case 'slate':
        return 'bg-slate-900 text-white border-slate-900 shadow-xs';
      default:
        return 'bg-indigo-600 text-white border-indigo-600 shadow-xs';
    }
  };

  return (
    <div className={cn('flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide', className)} dir="rtl">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'min-h-[40px] px-3.5 py-2 rounded-xl text-[11.5px] font-black flex items-center gap-1.5 shrink-0 border transition-all cursor-pointer active:scale-[0.97]',
              isActive
                ? getActiveStyle(tab.tone)
                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
            )}
          >
            {tab.icon}
            <span className="whitespace-nowrap">{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== null && tab.badge !== '' && (
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold',
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

interface MobileSearchFilterBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onToggleFilters?: () => void;
  filtersOpen?: boolean;
  activeFilterCount?: number;
}

export const MobileSearchFilterBar: React.FC<MobileSearchFilterBarProps> = ({
  value,
  onChange,
  placeholder = 'جستجو...',
  onToggleFilters,
  filtersOpen,
  activeFilterCount = 0,
}) => {
  return (
    <div className="flex items-center gap-2" dir="rtl">
      <div className="relative flex-1 min-w-0">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full min-h-[42px] pr-9 pl-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 shadow-2xs"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
            aria-label="پاک کردن"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {onToggleFilters && (
        <button
          type="button"
          onClick={onToggleFilters}
          className={cn(
            'min-h-[42px] px-3 py-2 rounded-xl border text-xs font-black flex items-center gap-1.5 shrink-0 cursor-pointer transition-all',
            filtersOpen || activeFilterCount > 0
              ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
              : 'bg-white text-slate-700 border-slate-200'
          )}
        >
          <SlidersHorizontal size={15} />
          <span>فیلتر</span>
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-mono">
              {activeFilterCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
};
