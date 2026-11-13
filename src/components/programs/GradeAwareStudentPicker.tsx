import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Layers,
  Search,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import { Student } from '../../types';
import { cn } from '../../lib/utils';

export const STANDARD_GRADES = ['پایه 7', 'پایه 8', 'پایه 9', 'پایه 10', 'پایه 11'] as const;

export function normalizeGradeKey(grade?: string): string {
  if (!grade || !grade.trim()) return 'سایر / بدون پایه';
  const eng = grade
    .replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])
    .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
    .trim();

  if (eng.includes('عمومی') || eng.includes('همه') || eng.includes('کل پایه')) {
    return 'عمومی / سایر';
  }

  const numMatch = eng.match(/\b(7|8|9|10|11|12)\b/) || eng.match(/(7|8|9|10|11|12)/);
  if (numMatch) {
    return `پایه ${numMatch[1]}`;
  }

  if (eng.includes('هفتم')) return 'پایه 7';
  if (eng.includes('هشتم')) return 'پایه 8';
  if (eng.includes('نهم')) return 'پایه 9';
  if (eng.includes('دهم')) return 'پایه 10';
  if (eng.includes('یازدهم')) return 'پایه 11';
  if (eng.includes('دوازدهم')) return 'پایه 12';

  return 'سایر / بدون پایه';
}

interface GradeAwareStudentPickerProps {
  students: Student[];
  programGrade?: string;
  selectedIds: string[];
  onChangeSelectedIds: (nextIds: string[]) => void;
  maxListHeightClass?: string;
  compact?: boolean;
  resetKey?: string | number;
}

type PickerViewMode = 'primary' | 'choose_other_grade' | 'other_grade_students';

export const GradeAwareStudentPicker: React.FC<GradeAwareStudentPickerProps> = ({
  students,
  programGrade,
  selectedIds,
  onChangeSelectedIds,
  maxListHeightClass = 'max-h-[42vh]',
  compact = false,
  resetKey
}) => {
  const normalizedPrimaryGrade = useMemo(
    () => normalizeGradeKey(programGrade),
    [programGrade]
  );

  const isGeneralProgram =
    normalizedPrimaryGrade === 'عمومی / سایر' ||
    normalizedPrimaryGrade === 'سایر / بدون پایه';

  const [viewMode, setViewMode] = useState<PickerViewMode>('primary');
  const [selectedOtherGrade, setSelectedOtherGrade] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Reset sub-navigation whenever modal reopens or class grade changes
  useEffect(() => {
    setViewMode('primary');
    setSelectedOtherGrade(null);
    setSearchTerm('');
  }, [normalizedPrimaryGrade, resetKey]);

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), 'fa')
    );
  }, [students]);

  const studentsByGrade = useMemo(() => {
    const map = new Map<string, Student[]>();
    for (const st of sortedStudents) {
      const gKey = normalizeGradeKey(st.grade);
      const list = map.get(gKey) || [];
      list.push(st);
      map.set(gKey, list);
    }
    return map;
  }, [sortedStudents]);

  const availableOtherGrades = useMemo(() => {
    const baseGrades: string[] = [...STANDARD_GRADES];
    if (studentsByGrade.has('پایه 12')) {
      baseGrades.push('پایه 12');
    }
    if ((studentsByGrade.get('سایر / بدون پایه') || []).length > 0) {
      baseGrades.push('سایر / بدون پایه');
    }

    return baseGrades
      .filter(g => (isGeneralProgram ? true : g !== normalizedPrimaryGrade))
      .map(g => {
        const list = studentsByGrade.get(g) || [];
        const selectedCount = list.filter(s => selectedIds.includes(s.id)).length;
        return {
          grade: g,
          students: list,
          totalCount: list.length,
          selectedCount
        };
      });
  }, [studentsByGrade, isGeneralProgram, normalizedPrimaryGrade, selectedIds]);

  const primaryStudents = useMemo(() => {
    if (isGeneralProgram) return sortedStudents;
    return studentsByGrade.get(normalizedPrimaryGrade) || [];
  }, [isGeneralProgram, sortedStudents, studentsByGrade, normalizedPrimaryGrade]);

  const otherGradeStudents = useMemo(() => {
    if (!selectedOtherGrade) return [];
    return studentsByGrade.get(selectedOtherGrade) || [];
  }, [studentsByGrade, selectedOtherGrade]);

  const crossGradeSelectedStudents = useMemo(() => {
    if (isGeneralProgram) return [];
    return sortedStudents.filter(
      s => selectedIds.includes(s.id) && normalizeGradeKey(s.grade) !== normalizedPrimaryGrade
    );
  }, [isGeneralProgram, sortedStudents, selectedIds, normalizedPrimaryGrade]);

  const toggleStudent = (studentId: string) => {
    if (selectedIds.includes(studentId)) {
      onChangeSelectedIds(selectedIds.filter(id => id !== studentId));
    } else {
      onChangeSelectedIds([...selectedIds, studentId]);
    }
  };

  const selectAllVisible = (list: Student[]) => {
    const next = new Set(selectedIds);
    list.forEach(s => next.add(s.id));
    onChangeSelectedIds(Array.from(next));
  };

  const clearVisible = (list: Student[]) => {
    const removeSet = new Set(list.map(s => s.id));
    onChangeSelectedIds(selectedIds.filter(id => !removeSet.has(id)));
  };

  const filterBySearch = (list: Student[]) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      s =>
        (s.name || '').toLowerCase().includes(term) ||
        (s.nationalId || '').toLowerCase().includes(term) ||
        (s.studentCode || '').toLowerCase().includes(term) ||
        (s.grade || '').toLowerCase().includes(term)
    );
  };

  const displayedStudents =
    viewMode === 'other_grade_students'
      ? filterBySearch(otherGradeStudents)
      : filterBySearch(primaryStudents);

  const activeGradeLabel =
    viewMode === 'other_grade_students' && selectedOtherGrade
      ? selectedOtherGrade
      : isGeneralProgram
        ? 'همه پایه‌ها'
        : normalizedPrimaryGrade;

  return (
    <div className="space-y-3" dir="rtl">
      {/* Top Status & Mode Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-black shadow-2xs">
            <Users size={13} />
            <span>کل طلاب انتخاب‌شده: {selectedIds.length.toLocaleString('fa-IR')} نفر</span>
          </span>
          {!isGeneralProgram && viewMode === 'primary' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700">
              <GraduationCap size={13} className="text-indigo-600" />
              <span>لیست فعلی: {normalizedPrimaryGrade} ({primaryStudents.length.toLocaleString('fa-IR')} نفر)</span>
            </span>
          )}
          {viewMode === 'other_grade_students' && selectedOtherGrade && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 border border-amber-300 text-[11px] font-black text-amber-950">
              <GraduationCap size={13} className="text-amber-700" />
              <span>در حال مشاهده: طلاب {selectedOtherGrade} ({otherGradeStudents.length.toLocaleString('fa-IR')} نفر)</span>
            </span>
          )}
        </div>

        {/* Action Button: افزودن از سایر پایه‌ها */}
        {viewMode === 'primary' && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setViewMode('choose_other_grade');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black text-xs shadow-xs transition-all cursor-pointer"
          >
            <UserPlus size={14} />
            <span>افزودن از سایر پایه‌ها</span>
          </button>
        )}

        {viewMode === 'choose_other_grade' && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setViewMode('primary');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs transition-all cursor-pointer"
          >
            <ArrowRight size={14} />
            <span>بازگشت به {isGeneralProgram ? 'همه طلاب' : `طلاب ${normalizedPrimaryGrade}`}</span>
          </button>
        )}

        {viewMode === 'other_grade_students' && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setViewMode('choose_other_grade');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 font-black text-[11px] transition-all cursor-pointer"
            >
              <Layers size={13} />
              <span>تغییر پایه (سایر پایه‌ها)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setViewMode('primary');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-black text-[11px] transition-all cursor-pointer"
            >
              <ArrowRight size={13} />
              <span>بازگشت به {isGeneralProgram ? 'همه طلاب' : normalizedPrimaryGrade}</span>
            </button>
          </div>
        )}
      </div>

      {/* Step 2 View: Prompt «افزودن از کدام پایه؟» */}
      {viewMode === 'choose_other_grade' ? (
        <div className="p-4 rounded-2xl border-2 border-amber-300 bg-amber-50/70 space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                <GraduationCap size={18} className="text-amber-600" />
                <span>افزودن از کدام پایه؟</span>
              </h4>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                پایه تحصیلی مورد نظر را انتخاب کنید تا لیست طلاب آن پایه برای افزودن به کلاس نمایش داده شود.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {availableOtherGrades.map(({ grade, totalCount, selectedCount }) => (
              <button
                key={grade}
                type="button"
                onClick={() => {
                  setSelectedOtherGrade(grade);
                  setSearchTerm('');
                  setViewMode('other_grade_students');
                }}
                className={cn(
                  'p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col gap-1.5 shadow-2xs',
                  selectedCount > 0
                    ? 'bg-emerald-50 border-emerald-400 hover:bg-emerald-100/80 text-emerald-950'
                    : 'bg-white border-amber-200 hover:border-amber-400 hover:bg-amber-50 text-slate-800'
                )}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="text-xs sm:text-sm font-black">{grade}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                    {totalCount.toLocaleString('fa-IR')} طلبه
                  </span>
                </div>
                {selectedCount > 0 ? (
                  <span className="text-[10px] font-black text-emerald-700">
                    ✓ {selectedCount.toLocaleString('fa-IR')} نفر به کلاس اضافه شده
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-slate-500">
                    کلیک برای مشاهده طلاب {grade}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Search + Quick Select Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={`جستجوی نام طلبه در ${activeGradeLabel}...`}
                className="pr-9 pl-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 w-full bg-white font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {displayedStudents.length > 0 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => selectAllVisible(displayedStudents)}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  انتخاب همه ({displayedStudents.length.toLocaleString('fa-IR')})
                </button>
                <button
                  type="button"
                  onClick={() => clearVisible(displayedStudents)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  لغو انتخاب لیست
                </button>
              </div>
            )}
          </div>

          {/* Students Grid */}
          <div className={cn('overflow-y-auto pr-1', maxListHeightClass)}>
            {displayedStudents.length > 0 ? (
              <div className={cn('grid gap-2.5', compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2')}>
                {displayedStudents.map(student => {
                  const isSelected = selectedIds.includes(student.id);
                  const studentGradeLabel = normalizeGradeKey(student.grade);
                  const isFromOtherGrade =
                    !isGeneralProgram && studentGradeLabel !== normalizedPrimaryGrade;

                  return (
                    <label
                      key={student.id}
                      className={cn(
                        'flex items-center gap-3 p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer select-none',
                        isSelected
                          ? isFromOtherGrade
                            ? 'bg-amber-50/90 border-amber-400 text-amber-950 shadow-2xs'
                            : 'bg-indigo-50/80 border-indigo-300 text-indigo-950 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                      )}
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 accent-indigo-600"
                        checked={isSelected}
                        onChange={() => toggleStudent(student.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black leading-tight truncate">{student.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={cn(
                              'text-[10px] font-bold',
                              isFromOtherGrade ? 'text-amber-700' : 'text-slate-500'
                            )}
                          >
                            {student.grade || 'پایه نامشخص'}
                          </span>
                          {isSelected && isFromOtherGrade && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-950">
                              اضافه‌شده از پایه دیگر
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle2
                          size={16}
                          className={isFromOtherGrade ? 'text-amber-600 shrink-0' : 'text-indigo-600 shrink-0'}
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 space-y-2">
                <p className="text-xs font-bold text-slate-500">
                  {searchTerm.trim()
                    ? `طلبه‌ای با عبارت «${searchTerm}» در ${activeGradeLabel} یافت نشد.`
                    : `هیچ طلبه فعالی در ${activeGradeLabel} ثبت نشده است.`}
                </p>
                {viewMode === 'primary' && !isGeneralProgram && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setViewMode('choose_other_grade');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition-colors cursor-pointer"
                  >
                    <UserPlus size={14} />
                    <span>افزودن از سایر پایه‌ها</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Selected Students Added From Other Grades Summary Chips */}
      {crossGradeSelectedStudents.length > 0 && (
        <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-black text-amber-950">
            <span>
              طلاب اضافه‌شده از سایر پایه‌ها ({crossGradeSelectedStudents.length.toLocaleString('fa-IR')} نفر):
            </span>
            <button
              type="button"
              onClick={() => {
                const removeIds = new Set(crossGradeSelectedStudents.map(s => s.id));
                onChangeSelectedIds(selectedIds.filter(id => !removeIds.has(id)));
              }}
              className="text-[10px] font-bold text-rose-700 hover:underline cursor-pointer"
            >
              حذف همه سایر پایه‌ها
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {crossGradeSelectedStudents.map(st => (
              <span
                key={st.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-amber-300 text-[11px] font-bold text-amber-950 shadow-2xs"
              >
                <span>{st.name}</span>
                <span className="text-[10px] text-amber-700">({normalizeGradeKey(st.grade)})</span>
                <button
                  type="button"
                  onClick={() => toggleStudent(st.id)}
                  className="text-slate-400 hover:text-rose-600 cursor-pointer"
                  title="حذف از کلاس"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GradeAwareStudentPicker;
