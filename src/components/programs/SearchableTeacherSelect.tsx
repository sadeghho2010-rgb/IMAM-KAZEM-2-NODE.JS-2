import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';
import { Teacher } from '../../types';
import { cn } from '../../lib/utils';

export function normalizeTeacherSearchText(input: string): string {
  return String(input || '')
    .replace(/[۰-۹]/g, (d) => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])
    .replace(/[٠-٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
    .replace(/[يىئ]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ةۀ]/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/\u200C/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesTeacherQuery(teacher: Teacher, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  const rawHaystack = [
    teacher.fullName,
    teacher.firstName,
    teacher.lastName,
    teacher.phoneNumber,
    teacher.teacherCode,
    teacher.centerTeacherCode,
    teacher.subjectSpecialty,
  ]
    .filter(Boolean)
    .join(' ');

  const normalizedHaystack = normalizeTeacherSearchText(rawHaystack);
  const compactHaystack = normalizedHaystack.replace(/\s+/g, '');
  const compactQuery = normalizedQuery.replace(/\s+/g, '');

  if (compactHaystack.includes(compactQuery)) return true;

  const tokens = normalizedQuery.split(' ').filter(Boolean);
  return tokens.every((token) => normalizedHaystack.includes(token));
}

type FlatOption =
  | { kind: 'clear'; key: string }
  | { kind: 'fallback'; key: string; name: string }
  | { kind: 'teacher'; key: string; teacher: Teacher }
  | { kind: 'custom'; key: string; prefill?: string };

interface SearchableTeacherSelectProps {
  teachers: Teacher[];
  value: string;
  onChange: (teacherName: string) => void;
  onSwitchToCustom: (prefillName?: string) => void;
  currentTeacherFallback?: string;
  placeholder?: string;
  className?: string;
}

export const SearchableTeacherSelect: React.FC<SearchableTeacherSelectProps> = ({
  teachers,
  value,
  onChange,
  onSwitchToCustom,
  currentTeacherFallback,
  placeholder = '-- انتخاب یا جستجوی استاد (بدون تداخل زمانی)... --',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const normalizedQuery = useMemo(
    () => normalizeTeacherSearchText(searchQuery),
    [searchQuery]
  );

  const { internalTeachers, externalTeachers, showFallback } = useMemo(() => {
    const internal: Teacher[] = [];
    const external: Teacher[] = [];

    for (const t of teachers) {
      if (!matchesTeacherQuery(t, normalizedQuery)) continue;
      if (t.isExternal) {
        external.push(t);
      } else {
        internal.push(t);
      }
    }

    const fallbackTrimmed = (currentTeacherFallback || '').trim();
    const fallbackExistsInList =
      !!fallbackTrimmed && teachers.some((t) => t.fullName === fallbackTrimmed);
    const fallbackMatches =
      !!fallbackTrimmed &&
      !fallbackExistsInList &&
      (!normalizedQuery ||
        normalizeTeacherSearchText(fallbackTrimmed)
          .replace(/\s+/g, '')
          .includes(normalizedQuery.replace(/\s+/g, '')));

    return {
      internalTeachers: internal,
      externalTeachers: external,
      showFallback: fallbackMatches,
    };
  }, [teachers, normalizedQuery, currentTeacherFallback]);

  const flatOptions = useMemo<FlatOption[]>(() => {
    const list: FlatOption[] = [];
    if (!normalizedQuery) {
      list.push({ kind: 'clear', key: '__clear__' });
    }
    if (showFallback && currentTeacherFallback) {
      list.push({
        kind: 'fallback',
        key: '__fallback__',
        name: currentTeacherFallback,
      });
    }
    for (const t of internalTeachers) {
      list.push({ kind: 'teacher', key: `int_${t.id}`, teacher: t });
    }
    for (const t of externalTeachers) {
      list.push({ kind: 'teacher', key: `ext_${t.id}`, teacher: t });
    }
    const trimmedQuery = searchQuery.trim();
    list.push({
      kind: 'custom',
      key: '__custom__',
      prefill: trimmedQuery || undefined,
    });
    return list;
  }, [
    normalizedQuery,
    showFallback,
    currentTeacherFallback,
    internalTeachers,
    externalTeachers,
    searchQuery,
  ]);

  // Keep highlightedIndex within bounds when filtered results change
  useEffect(() => {
    if (!isOpen) return;
    if (normalizedQuery) {
      const firstTeacherIdx = flatOptions.findIndex(
        (o) => o.kind === 'teacher' || o.kind === 'fallback'
      );
      setHighlightedIndex(firstTeacherIdx >= 0 ? firstTeacherIdx : 0);
    } else {
      const selectedIdx = value
        ? flatOptions.findIndex(
            (o) =>
              (o.kind === 'teacher' && o.teacher.fullName === value) ||
              (o.kind === 'fallback' && o.name === value)
          )
        : 0;
      setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
    }
  }, [isOpen, normalizedQuery, flatOptions.length]);

  // Focus search input automatically whenever dropdown opens
  useEffect(() => {
    if (!isOpen) return;
    const raf = requestAnimationFrame(() => {
      const input = searchInputRef.current;
      if (input) {
        input.focus({ preventScroll: true });
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
      containerRef.current?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [isOpen]);

  // Scroll highlighted option into view during keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const el = optionRefs.current[highlightedIndex];
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const openWithQuery = (initialQuery = '') => {
    setSearchQuery(initialQuery);
    setIsOpen(true);
  };

  const closeDropdown = (returnFocus = false) => {
    setIsOpen(false);
    setSearchQuery('');
    if (returnFocus) {
      requestAnimationFrame(() => {
        triggerRef.current?.focus({ preventScroll: true });
      });
    }
  };

  const selectOption = (opt: FlatOption) => {
    if (opt.kind === 'clear') {
      onChange('');
      closeDropdown(true);
    } else if (opt.kind === 'fallback') {
      onChange(opt.name);
      closeDropdown(true);
    } else if (opt.kind === 'teacher') {
      onChange(opt.teacher.fullName);
      closeDropdown(true);
    } else if (opt.kind === 'custom') {
      const prefill = opt.prefill;
      closeDropdown(false);
      onSwitchToCustom(prefill);
    }
  };

  const handleContainerMouseEnter = () => {
    if (isOpen) return;
    const active = document.activeElement as HTMLElement | null;
    const tag = active?.tagName;
    const isTypingElsewhere =
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      Boolean(active?.isContentEditable);
    if (!isTypingElsewhere) {
      triggerRef.current?.focus({ preventScroll: true });
    }
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openWithQuery('');
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isOpen) {
        closeDropdown(true);
      } else {
        openWithQuery('');
      }
      return;
    }
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      e.stopPropagation();
      closeDropdown(true);
      return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      openWithQuery('');
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      openWithQuery(e.key);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        flatOptions.length === 0 ? 0 : (prev + 1) % flatOptions.length
      );
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        flatOptions.length === 0
          ? 0
          : (prev - 1 + flatOptions.length) % flatOptions.length
      );
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = flatOptions[highlightedIndex];
      if (chosen) {
        selectOption(chosen);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeDropdown(true);
    }
  };

  const totalMatches =
    internalTeachers.length + externalTeachers.length + (showFallback ? 1 : 0);

  let optionRenderCursor = 0;

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleContainerMouseEnter}
      className={cn('relative', className)}
    >
      <div className="relative flex items-center">
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          onClick={() => {
            if (isOpen) {
              closeDropdown(false);
            } else {
              openWithQuery('');
            }
          }}
          onKeyDown={handleTriggerKeyDown}
          className={cn(
            'w-full px-3.5 py-2 text-xs border rounded-xl outline-none font-bold bg-white flex items-center justify-between gap-2 text-right transition-all cursor-pointer',
            isOpen
              ? 'border-indigo-500 ring-2 ring-indigo-500/25 text-slate-900'
              : 'border-slate-200 hover:border-indigo-300 focus-visible:ring-2 focus-visible:ring-indigo-500 text-slate-800'
          )}
        >
          <span className="flex items-center gap-2 min-w-0 flex-1">
            <Search
              size={13}
              className={cn(
                'shrink-0 transition-colors',
                isOpen || value ? 'text-indigo-500' : 'text-slate-400'
              )}
            />
            <span
              className={cn(
                'truncate',
                value ? 'text-slate-800' : 'text-slate-400 font-medium'
              )}
            >
              {value || placeholder}
            </span>
          </span>

          <span className="flex items-center gap-1 shrink-0">
            {value && (
              <span
                role="button"
                tabIndex={-1}
                title="پاک کردن انتخاب"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange('');
                  triggerRef.current?.focus({ preventScroll: true });
                }}
                className="p-0.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <X size={13} />
              </span>
            )}
            <ChevronDown
              size={14}
              className={cn(
                'text-slate-400 transition-transform duration-150',
                isOpen && 'rotate-180 text-indigo-500'
              )}
            />
          </span>
        </button>
      </div>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
        >
          {/* Compact Inline Search */}
          <div className="p-1.5 border-b border-slate-100 bg-slate-50/90">
            <div className="relative flex items-center">
              <Search
                size={13}
                className="absolute right-2.5 text-indigo-500 pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="جستجوی سریع نام، نام خانوادگی یا کد استاد..."
                className="w-full pr-8 pl-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 font-bold text-slate-800 placeholder:font-medium placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute left-2 p-0.5 text-slate-400 hover:text-rose-500 rounded"
                  title="پاک کردن جستجو"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-52 overflow-y-auto py-1 divide-y divide-slate-50">
            {!normalizedQuery && (() => {
              const idx = optionRenderCursor++;
              const isActive = highlightedIndex === idx;
              return (
                <button
                  key="__clear__"
                  ref={(el) => {
                    optionRefs.current[idx] = el;
                  }}
                  type="button"
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => selectOption({ kind: 'clear', key: '__clear__' })}
                  className={cn(
                    'w-full px-3 py-1.5 text-right text-[11px] font-medium flex items-center justify-between transition-colors',
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-500 hover:bg-slate-50'
                  )}
                >
                  <span>-- بدون انتخاب استاد --</span>
                  {!value && <Check size={12} className="text-indigo-600 shrink-0" />}
                </button>
              );
            })()}

            {showFallback &&
              currentTeacherFallback &&
              (() => {
                const idx = optionRenderCursor++;
                const isActive = highlightedIndex === idx;
                const isSelected = value === currentTeacherFallback;
                return (
                  <button
                    key="__fallback__"
                    ref={(el) => {
                      optionRefs.current[idx] = el;
                    }}
                    type="button"
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() =>
                      selectOption({
                        kind: 'fallback',
                        key: '__fallback__',
                        name: currentTeacherFallback,
                      })
                    }
                    className={cn(
                      'w-full px-3 py-1.5 text-right text-xs flex items-center justify-between gap-2 transition-colors',
                      isActive
                        ? 'bg-indigo-50 text-indigo-900'
                        : isSelected
                          ? 'bg-indigo-50/50 text-indigo-800'
                          : 'text-slate-800 hover:bg-slate-50'
                    )}
                  >
                    <span className="font-bold truncate">
                      {currentTeacherFallback}{' '}
                      <span className="text-[10px] font-medium text-amber-600">
                        (استاد فعلی کلاس)
                      </span>
                    </span>
                    {isSelected && (
                      <Check size={13} className="text-indigo-600 shrink-0" />
                    )}
                  </button>
                );
              })()}

            {internalTeachers.length > 0 && (
              <div>
                <div className="px-3 py-1 text-[10px] font-black text-slate-400 bg-slate-50/80 sticky top-0">
                  اساتید داخلی مؤسسه (در دسترس)
                </div>
                {internalTeachers.map((t) => {
                  const idx = optionRenderCursor++;
                  const isActive = highlightedIndex === idx;
                  const isSelected = value === t.fullName;
                  return (
                    <button
                      key={t.id}
                      ref={(el) => {
                        optionRefs.current[idx] = el;
                      }}
                      type="button"
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onClick={() =>
                        selectOption({
                          kind: 'teacher',
                          key: `int_${t.id}`,
                          teacher: t,
                        })
                      }
                      className={cn(
                        'w-full px-3 py-1.5 text-right text-xs flex items-center justify-between gap-2 transition-colors',
                        isActive
                          ? 'bg-indigo-50 text-indigo-900'
                          : isSelected
                            ? 'bg-indigo-50/50 text-indigo-800'
                            : 'text-slate-800 hover:bg-slate-50'
                      )}
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="font-bold truncate">{t.fullName}</span>
                        {t.phoneNumber && (
                          <span className="text-[10px] text-slate-400 font-normal shrink-0 dir-ltr">
                            ({t.phoneNumber})
                          </span>
                        )}
                      </span>
                      {isSelected && (
                        <Check size={13} className="text-indigo-600 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {externalTeachers.length > 0 && (
              <div>
                <div className="px-3 py-1 text-[10px] font-black text-slate-400 bg-slate-50/80 sticky top-0">
                  مدرس‌های خارج از مجموعه (در دسترس)
                </div>
                {externalTeachers.map((t) => {
                  const idx = optionRenderCursor++;
                  const isActive = highlightedIndex === idx;
                  const isSelected = value === t.fullName;
                  return (
                    <button
                      key={t.id}
                      ref={(el) => {
                        optionRefs.current[idx] = el;
                      }}
                      type="button"
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onClick={() =>
                        selectOption({
                          kind: 'teacher',
                          key: `ext_${t.id}`,
                          teacher: t,
                        })
                      }
                      className={cn(
                        'w-full px-3 py-1.5 text-right text-xs flex items-center justify-between gap-2 transition-colors',
                        isActive
                          ? 'bg-indigo-50 text-indigo-900'
                          : isSelected
                            ? 'bg-indigo-50/50 text-indigo-800'
                            : 'text-slate-800 hover:bg-slate-50'
                      )}
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="font-bold truncate">{t.fullName}</span>
                        <span className="text-[10px] text-slate-400 font-normal shrink-0">
                          (خارج از مجموعه)
                        </span>
                      </span>
                      {isSelected && (
                        <Check size={13} className="text-indigo-600 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {totalMatches === 0 && (
              <div className="px-3 py-3 text-center text-[11px] text-slate-500 font-medium">
                استادی با عبارت «{searchQuery.trim()}» در لیست در دسترس یافت نشد.
              </div>
            )}
          </div>

          {/* Custom / Manual Entry Footer */}
          {(() => {
            const idx = optionRenderCursor++;
            const isActive = highlightedIndex === idx;
            const trimmed = searchQuery.trim();
            return (
              <div className="border-t border-slate-100 bg-slate-50/80 p-1">
                <button
                  ref={(el) => {
                    optionRefs.current[idx] = el;
                  }}
                  type="button"
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() =>
                    selectOption({
                      kind: 'custom',
                      key: '__custom__',
                      prefill: trimmed || undefined,
                    })
                  }
                  className={cn(
                    'w-full px-2.5 py-1.5 rounded-lg text-right text-[11px] font-bold flex items-center gap-1.5 transition-colors',
                    isActive
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'text-indigo-600 hover:bg-indigo-50'
                  )}
                >
                  <Plus size={13} className="shrink-0" />
                  <span className="truncate">
                    {trimmed
                      ? `ورود دستی «${trimmed}» به عنوان نام استاد...`
                      : 'سایر (ورود دستی نام استاد)...'}
                  </span>
                </button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
