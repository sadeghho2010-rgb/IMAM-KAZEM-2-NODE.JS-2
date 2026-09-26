import React, { useState, useEffect } from 'react';
import { 
  Award, 
  Plus, 
  Archive, 
  BookOpen, 
  Sparkles,
  Layers,
  ChevronLeft
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

  // Active top-level section: strictly 3 sections as requested by the user:
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
          // also map by studentId if periodId matches
          if (r.studentId) {
            rMap[r.studentId] = r;
          }
        }
      });
      setRecords(rMap);

      // Auto-populate Scope Bank with comprehensive seminary data if empty
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* ========================================================================= */}
      {/* TOP NAVIGATION: STRICTLY 3 SECTIONS ONLY (دستور صریح کاربر)                */}
      {/* ۱. ایجاد امتحان شفاهی                                                     */}
      {/* ۲. سوابق امتحان شفاهی                                                     */}
      {/* ۳. بانک محدوده                                                           */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-3 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl flex-1 max-w-2xl">
          {/* Section 1: ایجاد امتحان شفاهی */}
          <button
            onClick={() => {
              setEditingPeriodInWizard(null);
              setActiveMainSection('create');
            }}
            className={cn(
              "flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2",
              activeMainSection === 'create'
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Plus size={16} className={activeMainSection === 'create' ? "text-emerald-400" : "text-slate-400"} />
            <span>ایجاد امتحان شفاهی</span>
          </button>

          {/* Section 2: سوابق امتحان شفاهی */}
          <button
            onClick={() => setActiveMainSection('history')}
            className={cn(
              "flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2",
              activeMainSection === 'history'
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Archive size={16} className={activeMainSection === 'history' ? "text-sky-400" : "text-slate-400"} />
            <span>سوابق امتحان شفاهی</span>
          </button>

          {/* Section 3: بانک محدوده */}
          <button
            onClick={() => setActiveMainSection('scopes')}
            className={cn(
              "flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2",
              activeMainSection === 'scopes'
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <BookOpen size={16} className={activeMainSection === 'scopes' ? "text-amber-400" : "text-slate-400"} />
            <span>بانک محدوده</span>
          </button>
        </div>

        {/* Status indicator on top left */}
        <div className="flex items-center gap-3 px-3 text-xs text-slate-500 font-medium">
          <span>{periods.length} دوره در سیستم</span>
          <span>·</span>
          <span>{scopeBooks.length} کتاب در بانک</span>
        </div>
      </div>

      {/* Loading Indicator */}
      {loading ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-sm">
          <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h3 className="font-bold text-slate-700 text-sm">در حال بارگذاری اطلاعات امتحانات شفاهی...</h3>
          <p className="text-slate-400 text-xs mt-1">لطفاً شکیبا باشید</p>
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
