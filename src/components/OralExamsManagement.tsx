import React, { useState, useEffect, useMemo } from 'react';
import { 
  Award, 
  Plus, 
  Archive, 
  BookOpen, 
  Sparkles,
  Layers,
  ChevronLeft,
  GraduationCap,
  Users,
  CheckCircle2,
  Clock,
  TrendingUp,
  FileCheck
} from 'lucide-react';
import { localDb } from '../lib/localDb';
import { Student, Teacher, OralExamPeriod, OralExamStudentRecord, ScopeBook } from '../types';
import { INITIAL_SCOPE_BOOKS } from '../lib/oralExamScopeSeeds';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import ScopeBankView from './oral-exams/ScopeBankView';
import OralExamHistoryView from './oral-exams/OralExamHistoryView';
import CreateOralExamWizard from './oral-exams/CreateOralExamWizard';

export default function OralExamsManagement() {
  const { currentUser, isReadOnly } = useAuth();
  const canEdit = !isReadOnly;

  // Active top-level section: strictly 3 sections:
  // 1. 'create' = ایجاد امتحان شفاهی
  // 2. 'history' = سوابق امتحان شفاهی
  // 3. 'scopes' = بانک محدوده
  const [activeMainSection, setActiveMainSection] = useState<'create' | 'history' | 'scopes'>('create');

  // Database Data States
  const [periods, setPeriods] = useState<OralExamPeriod[]>([]);
  const [records, setRecords] = useState<Record<string, OralExamStudentRecord>>({});
  const [scopeBooks, setScopeBooks] = useState<ScopeBook[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Period being edited in Wizard (if any)
  const [editingPeriodInWizard, setEditingPeriodInWizard] = useState<OralExamPeriod | null>(null);

  // Load all required collections from localDb (IndexedDB + Supabase mirror)
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [pDocs, rDocs, bDocs, sDocs, tDocs] = await Promise.all([
        localDb.getDocs<OralExamPeriod>('oral_exam_periods'),
        localDb.getDocs<OralExamStudentRecord>('oral_exam_records'),
        localDb.getDocs<ScopeBook>('oral_exam_scope_books'),
        localDb.getDocs<Student>('students'),
        localDb.getDocs<Teacher>('teachers')
      ]);

      setPeriods((pDocs || []).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));

      const rMap: Record<string, OralExamStudentRecord> = {};
      (rDocs || []).forEach(r => {
        if (r && r.id) {
          rMap[r.id] = r;
          if (r.studentId) {
            rMap[r.studentId] = r;
          }
        }
      });
      setRecords(rMap);

      let loadedBooks = bDocs || [];
      if (loadedBooks.length === 0) {
        await localDb.bulkPut('oral_exam_scope_books', INITIAL_SCOPE_BOOKS);
        loadedBooks = INITIAL_SCOPE_BOOKS;
      }
      setScopeBooks(loadedBooks);

      setStudents(sDocs || []);
      setTeachers(tDocs || []);
    } catch (err) {
      console.error('Error loading oral exam collections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleEditPeriodFromHistory = (period: OralExamPeriod) => {
    setEditingPeriodInWizard(period);
    setActiveMainSection('create');
  };

  const handleFinishPeriod = (period: OralExamPeriod) => {
    setEditingPeriodInWizard(null);
    loadAllData();
    setActiveMainSection('history');
  };

  const handleCancelWizard = () => {
    setEditingPeriodInWizard(null);
    setActiveMainSection('history');
  };

  // Quick Stats computation
  const stats = useMemo(() => {
    const totalPeriods = periods.length;
    const activePeriods = periods.filter(p => p.status === 'conducting' || p.status === 'draft').length;
    const archivedPeriods = periods.filter(p => p.status === 'archived').length;
    const evaluatedStudentsCount = Object.keys(records).length;
    
    return {
      totalPeriods,
      activePeriods,
      archivedPeriods,
      evaluatedStudentsCount,
      scopeBooksCount: scopeBooks.length
    };
  }, [periods, records, scopeBooks]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* ========================================================================= */}
      {/* RICH HERO HEADER BANNER                                                   */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-indigo-950 to-purple-950 text-white p-6 sm:p-8 border border-indigo-900/40 shadow-xl">
        {/* Ambient glowing spots */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-extrabold backdrop-blur-md">
              <Sparkles size={14} className="text-amber-400 animate-pulse" />
              <span>سامانه هوشمند ارزشیابی شفاهی</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Award className="text-amber-400 w-8 h-8 shrink-0" />
              <span>مدیریت و برگزاری امتحانات شفاهی</span>
            </h1>
            <p className="text-xs sm:text-sm text-indigo-200/80 max-w-2xl leading-relaxed">
              ارزیابی استاندارد و دقیق دروس فقه، اصول و امتحان ورودی طلاب، تخصیص محدوده، صدور برگه‌های ارزیابی A5، ثبت نمرات ممتحنین و صدور کارنامه
            </p>
          </div>

          {/* KPI Cards Header Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full md:w-auto shrink-0">
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3 text-center transition-all hover:bg-white/15">
              <div className="text-xs text-indigo-200 font-medium mb-1 flex items-center justify-center gap-1">
                <Layers size={13} className="text-sky-300" />
                <span>کل دوره‌ها</span>
              </div>
              <div className="text-xl font-black text-white">{stats.totalPeriods}</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3 text-center transition-all hover:bg-white/15">
              <div className="text-xs text-indigo-200 font-medium mb-1 flex items-center justify-center gap-1">
                <Clock size={13} className="text-emerald-300" />
                <span>در حال برگزاری</span>
              </div>
              <div className="text-xl font-black text-emerald-400">{stats.activePeriods}</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3 text-center transition-all hover:bg-white/15 col-span-2 sm:col-span-1">
              <div className="text-xs text-indigo-200 font-medium mb-1 flex items-center justify-center gap-1">
                <BookOpen size={13} className="text-amber-300" />
                <span>بانک محدوده</span>
              </div>
              <div className="text-xl font-black text-amber-300">{stats.scopeBooksCount} <span className="text-xs font-normal opacity-80">کتاب</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TOP NAVIGATION: VIBRANT 3 SECTION TABS                                     */}
      {/* ========================================================================= */}
      <div className="bg-white/90 backdrop-blur-lg rounded-3xl p-2.5 border border-slate-200/80 shadow-md flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
          {/* Section 1: ایجاد امتحان شفاهی */}
          <button
            onClick={() => {
              setEditingPeriodInWizard(null);
              setActiveMainSection('create');
            }}
            className={cn(
              "py-3 px-5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2.5 group relative overflow-hidden",
              activeMainSection === 'create'
                ? "bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-400/50"
                : "bg-slate-100/80 hover:bg-indigo-50 text-slate-700 hover:text-indigo-900 border border-transparent hover:border-indigo-200/60"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-xl transition-colors",
              activeMainSection === 'create' ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700 group-hover:bg-indigo-200"
            )}>
              <Plus size={18} />
            </div>
            <div className="text-right">
              <div className="font-black">ایجاد و برگزاری آزمون</div>
              <div className={cn("text-[10px] font-normal", activeMainSection === 'create' ? "text-indigo-100" : "text-slate-500")}>تعریف دوره، زمان‌بندی و ثبت نمرات</div>
            </div>
          </button>

          {/* Section 2: سوابق امتحان شفاهی */}
          <button
            onClick={() => setActiveMainSection('history')}
            className={cn(
              "py-3 px-5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2.5 group relative overflow-hidden",
              activeMainSection === 'history'
                ? "bg-gradient-to-r from-sky-600 via-cyan-600 to-blue-700 text-white shadow-lg shadow-sky-500/25 ring-2 ring-sky-400/50"
                : "bg-slate-100/80 hover:bg-sky-50 text-slate-700 hover:text-sky-900 border border-transparent hover:border-sky-200/60"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-xl transition-colors",
              activeMainSection === 'history' ? "bg-white/20 text-white" : "bg-sky-100 text-sky-700 group-hover:bg-sky-200"
            )}>
              <Archive size={18} />
            </div>
            <div className="text-right">
              <div className="font-black">سوابق و گزارشات</div>
              <div className={cn("text-[10px] font-normal", activeMainSection === 'history' ? "text-sky-100" : "text-slate-500")}>بایگانی دوره‌ها، کارنامه‌ها و تحلیل</div>
            </div>
          </button>

          {/* Section 3: بانک محدوده */}
          <button
            onClick={() => setActiveMainSection('scopes')}
            className={cn(
              "py-3 px-5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2.5 group relative overflow-hidden",
              activeMainSection === 'scopes'
                ? "bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/25 ring-2 ring-amber-400/50"
                : "bg-slate-100/80 hover:bg-amber-50 text-slate-700 hover:text-amber-900 border border-transparent hover:border-amber-200/60"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-xl transition-colors",
              activeMainSection === 'scopes' ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700 group-hover:bg-amber-200"
            )}>
              <BookOpen size={18} />
            </div>
            <div className="text-right">
              <div className="font-black">بانک محدوده کتب</div>
              <div className={cn("text-[10px] font-normal", activeMainSection === 'scopes' ? "text-amber-100" : "text-slate-500")}>مدیریت کتب، محدوده اصلی و فرعی</div>
            </div>
          </button>
        </div>
      </div>

      {/* Loading Indicator */}
      {loading ? (
        <div className="bg-white/80 backdrop-blur-md rounded-3xl p-16 text-center border border-slate-200 shadow-lg">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-200 animate-ping opacity-75"></div>
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h3 className="font-extrabold text-slate-800 text-base">در حال بارگذاری اطلاعات امتحانات شفاهی...</h3>
          <p className="text-slate-500 text-xs mt-1">اتصال به پایگاه داده و آماده‌سازی اطلاعات</p>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* 1. ایجاد امتحان شفاهی (WIZARD: STEP 1, 2, 3)                              */}
          {/* ========================================================================= */}
          {activeMainSection === 'create' && (
            <CreateOralExamWizard
              students={students}
              teachers={teachers}
              scopeBooks={scopeBooks}
              existingPeriod={editingPeriodInWizard}
              onFinishPeriod={handleFinishPeriod}
              onCancel={handleCancelWizard}
            />
          )}

          {/* ========================================================================= */}
          {/* 2. سوابق امتحان شفاهی (HISTORY & MULTI-FACETED REPORTS)                    */}
          {/* ========================================================================= */}
          {activeMainSection === 'history' && (
            <OralExamHistoryView
              periods={periods}
              records={records}
              students={students}
              teachers={teachers}
              scopeBooks={scopeBooks}
              canEdit={canEdit}
              onEditPeriod={handleEditPeriodFromHistory}
              onRefreshData={loadAllData}
            />
          )}

          {/* ========================================================================= */}
          {/* 3. بانک محدوده (SCOPE BANK & PRE-SEEDED BOOKS/RANGES)                      */}
          {/* ========================================================================= */}
          {activeMainSection === 'scopes' && (
            <ScopeBankView
              books={scopeBooks}
              onUpdateBooks={(newBooks) => setScopeBooks(newBooks)}
              canEdit={canEdit}
            />
          )}
        </>
      )}
    </div>
  );
}
