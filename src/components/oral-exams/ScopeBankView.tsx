import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Layers, 
  Check, 
  X, 
  Bookmark, 
  FileText, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  FolderPlus,
  BookMarked
} from 'lucide-react';
import { ScopeBook, ScopeMainRange, ScopeSubRange } from '../../types';
import { localDb } from '../../lib/localDb';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ScopeBankViewProps {
  books: ScopeBook[];
  onUpdateBooks: (newBooks: ScopeBook[]) => void;
  canEdit: boolean;
}

export default function ScopeBankView({ books, onUpdateBooks, canEdit }: ScopeBankViewProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<'all' | 'entrance' | 'annual'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'usul' | 'fiqh' | 'entrance'>('all');

  // Expanded book cards
  const [expandedBookIds, setExpandedBookIds] = useState<Record<string, boolean>>({});

  // Modals / Dialogs
  // 1. Book Modal (Add / Edit)
  const [isBookModalOpen, setIsBookModalOpen] = useState<boolean>(false);
  const [editingBook, setEditingBook] = useState<ScopeBook | null>(null);
  const [bookTitle, setBookTitle] = useState<string>('');
  const [bookCategory, setBookCategory] = useState<'usul' | 'fiqh' | 'entrance' | 'other'>('usul');
  const [bookStage, setBookStage] = useState<'entrance' | 'annual' | 'both'>('annual');
  const [bookGrade, setBookGrade] = useState<string>('');
  const [bookDescription, setBookDescription] = useState<string>('');

  // 2. Main Scope Modal
  const [isMainScopeModalOpen, setIsMainScopeModalOpen] = useState<boolean>(false);
  const [targetBookForMainScope, setTargetBookForMainScope] = useState<ScopeBook | null>(null);
  const [editingMainScope, setEditingMainScope] = useState<ScopeMainRange | null>(null);
  const [mainScopeTitle, setMainScopeTitle] = useState<string>('');
  const [mainScopeDescription, setMainScopeDescription] = useState<string>('');

  // 3. Sub Scope Modal
  const [isSubScopeModalOpen, setIsSubScopeModalOpen] = useState<boolean>(false);
  const [targetBookForSubScope, setTargetBookForSubScope] = useState<ScopeBook | null>(null);
  const [targetMainScopeForSubScope, setTargetMainScopeForSubScope] = useState<ScopeMainRange | null>(null);
  const [editingSubScope, setEditingSubScope] = useState<ScopeSubRange | null>(null);
  const [subScopeTitle, setSubScopeTitle] = useState<string>('');
  const [subScopePages, setSubScopePages] = useState<string>('');
  const [subScopeDescription, setSubScopeDescription] = useState<string>('');

  // 4. Delete Confirmation
  const [deleteConfirmInfo, setDeleteConfirmInfo] = useState<{
    type: 'book' | 'main' | 'sub';
    title: string;
    action: () => void;
  } | null>(null);

  const toggleBookExpand = (bookId: string) => {
    setExpandedBookIds(prev => ({
      ...prev,
      [bookId]: !prev[bookId]
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    books.forEach(b => { all[b.id] = true; });
    setExpandedBookIds(all);
  };

  const collapseAll = () => {
    setExpandedBookIds({});
  };

  // Filtered books
  const filteredBooks = useMemo(() => {
    return books.filter(b => {
      if (stageFilter !== 'all') {
        if (stageFilter === 'entrance' && b.stage !== 'entrance' && b.stage !== 'both') return false;
        if (stageFilter === 'annual' && b.stage !== 'annual' && b.stage !== 'both') return false;
      }

      if (categoryFilter !== 'all') {
        if (categoryFilter === 'entrance' && b.category !== 'entrance') return false;
        if (categoryFilter === 'usul' && b.category !== 'usul') return false;
        if (categoryFilter === 'fiqh' && b.category !== 'fiqh') return false;
      }

      if (!searchTerm.trim()) return true;

      const term = searchTerm.trim().toLowerCase();
      if (b.title.toLowerCase().includes(term)) return true;
      if (b.description?.toLowerCase().includes(term)) return true;

      // Check main ranges and sub ranges
      return b.mainRanges.some(mr => {
        if (mr.title.toLowerCase().includes(term)) return true;
        if (mr.description?.toLowerCase().includes(term)) return true;
        return mr.subRanges.some(sr => {
          return sr.title.toLowerCase().includes(term) ||
                 (sr.pages && sr.pages.toLowerCase().includes(term)) ||
                 (sr.description && sr.description.toLowerCase().includes(term));
        });
      });
    });
  }, [books, stageFilter, categoryFilter, searchTerm]);

  // Statistics
  const totalStats = useMemo(() => {
    let totalMain = 0;
    let totalSub = 0;
    books.forEach(b => {
      totalMain += b.mainRanges.length;
      b.mainRanges.forEach(mr => {
        totalSub += mr.subRanges.length;
      });
    });
    return {
      bookCount: books.length,
      mainCount: totalMain,
      subCount: totalSub
    };
  }, [books]);

  // Save to DB and state
  const saveBooksList = async (updatedList: ScopeBook[]) => {
    onUpdateBooks(updatedList);
    try {
      await localDb.bulkPut('oral_exam_scope_books', updatedList);
    } catch (err) {
      console.error('Error saving scope books:', err);
    }
  };

  // -------------------------------------------------------------
  // HANDLERS: BOOK
  // -------------------------------------------------------------
  const handleOpenAddBook = () => {
    setEditingBook(null);
    setBookTitle('');
    setBookCategory('usul');
    setBookStage('annual');
    setBookGrade('پایه ۹');
    setBookDescription('');
    setIsBookModalOpen(true);
  };

  const handleOpenEditBook = (book: ScopeBook) => {
    setEditingBook(book);
    setBookTitle(book.title);
    setBookCategory(book.category);
    setBookStage(book.stage);
    setBookGrade(book.grade || '');
    setBookDescription(book.description || '');
    setIsBookModalOpen(true);
  };

  const handleSaveBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookTitle.trim()) return;

    const now = new Date().toISOString();
    let updated: ScopeBook[];

    if (editingBook) {
      updated = books.map(b => b.id === editingBook.id ? {
        ...b,
        title: bookTitle.trim(),
        category: bookCategory,
        stage: bookStage,
        grade: bookGrade.trim() || undefined,
        description: bookDescription.trim() || undefined,
        updatedAt: now
      } : b);
    } else {
      const newBook: ScopeBook = {
        id: `book_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: bookTitle.trim(),
        category: bookCategory,
        stage: bookStage,
        grade: bookGrade.trim() || undefined,
        description: bookDescription.trim() || undefined,
        mainRanges: [],
        createdAt: now,
        updatedAt: now
      };
      updated = [newBook, ...books];
      setExpandedBookIds(prev => ({ ...prev, [newBook.id]: true }));
    }

    await saveBooksList(updated);
    setIsBookModalOpen(false);
  };

  const handleDeleteBook = (book: ScopeBook) => {
    setDeleteConfirmInfo({
      type: 'book',
      title: `کتاب «${book.title}» و کلیه محدوده‌های آن`,
      action: async () => {
        const updated = books.filter(b => b.id !== book.id);
        await saveBooksList(updated);
        try {
          await localDb.deleteDoc('oral_exam_scope_books', book.id);
        } catch {}
        setDeleteConfirmInfo(null);
      }
    });
  };

  // -------------------------------------------------------------
  // HANDLERS: MAIN SCOPE
  // -------------------------------------------------------------
  const handleOpenAddMainScope = (book: ScopeBook) => {
    setTargetBookForMainScope(book);
    setEditingMainScope(null);
    setMainScopeTitle('');
    setMainScopeDescription('');
    setIsMainScopeModalOpen(true);
  };

  const handleOpenEditMainScope = (book: ScopeBook, ms: ScopeMainRange) => {
    setTargetBookForMainScope(book);
    setEditingMainScope(ms);
    setMainScopeTitle(ms.title);
    setMainScopeDescription(ms.description || '');
    setIsMainScopeModalOpen(true);
  };

  const handleSaveMainScope = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetBookForMainScope || !mainScopeTitle.trim()) return;

    const book = targetBookForMainScope;
    let newMainRanges: ScopeMainRange[];

    if (editingMainScope) {
      newMainRanges = book.mainRanges.map(mr => mr.id === editingMainScope.id ? {
        ...mr,
        title: mainScopeTitle.trim(),
        description: mainScopeDescription.trim() || undefined
      } : mr);
    } else {
      const newMs: ScopeMainRange = {
        id: `mr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: mainScopeTitle.trim(),
        description: mainScopeDescription.trim() || undefined,
        subRanges: []
      };
      newMainRanges = [...book.mainRanges, newMs];
    }

    const updated = books.map(b => b.id === book.id ? { ...b, mainRanges: newMainRanges } : b);
    await saveBooksList(updated);
    setIsMainScopeModalOpen(false);
  };

  const handleDeleteMainScope = (book: ScopeBook, ms: ScopeMainRange) => {
    setDeleteConfirmInfo({
      type: 'main',
      title: `محدوده اصلی «${ms.title}»`,
      action: async () => {
        const newMainRanges = book.mainRanges.filter(m => m.id !== ms.id);
        const updated = books.map(b => b.id === book.id ? { ...b, mainRanges: newMainRanges } : b);
        await saveBooksList(updated);
        setDeleteConfirmInfo(null);
      }
    });
  };

  // -------------------------------------------------------------
  // HANDLERS: SUB SCOPE
  // -------------------------------------------------------------
  const handleOpenAddSubScope = (book: ScopeBook, ms: ScopeMainRange) => {
    setTargetBookForSubScope(book);
    setTargetMainScopeForSubScope(ms);
    setEditingSubScope(null);
    setSubScopeTitle('');
    setSubScopePages('');
    setSubScopeDescription('');
    setIsSubScopeModalOpen(true);
  };

  const handleOpenEditSubScope = (book: ScopeBook, ms: ScopeMainRange, ss: ScopeSubRange) => {
    setTargetBookForSubScope(book);
    setTargetMainScopeForSubScope(ms);
    setEditingSubScope(ss);
    setSubScopeTitle(ss.title);
    setSubScopePages(ss.pages || '');
    setSubScopeDescription(ss.description || '');
    setIsSubScopeModalOpen(true);
  };

  const handleSaveSubScope = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetBookForSubScope || !targetMainScopeForSubScope || !subScopeTitle.trim()) return;

    const book = targetBookForSubScope;
    const mainScope = targetMainScopeForSubScope;

    let newSubRanges: ScopeSubRange[];
    if (editingSubScope) {
      newSubRanges = mainScope.subRanges.map(sr => sr.id === editingSubScope.id ? {
        ...sr,
        title: subScopeTitle.trim(),
        pages: subScopePages.trim() || undefined,
        description: subScopeDescription.trim() || undefined
      } : sr);
    } else {
      const newSr: ScopeSubRange = {
        id: `sr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: subScopeTitle.trim(),
        pages: subScopePages.trim() || undefined,
        description: subScopeDescription.trim() || undefined
      };
      newSubRanges = [...mainScope.subRanges, newSr];
    }

    const newMainRanges = book.mainRanges.map(mr => mr.id === mainScope.id ? { ...mr, subRanges: newSubRanges } : mr);
    const updated = books.map(b => b.id === book.id ? { ...b, mainRanges: newMainRanges } : b);
    await saveBooksList(updated);
    setIsSubScopeModalOpen(false);
  };

  const handleDeleteSubScope = (book: ScopeBook, ms: ScopeMainRange, ss: ScopeSubRange) => {
    setDeleteConfirmInfo({
      type: 'sub',
      title: `زیرمحدوده «${ss.title}»`,
      action: async () => {
        const newSubRanges = ms.subRanges.filter(s => s.id !== ss.id);
        const newMainRanges = book.mainRanges.map(m => m.id === ms.id ? { ...m, subRanges: newSubRanges } : m);
        const updated = books.map(b => b.id === book.id ? { ...b, mainRanges: newMainRanges } : b);
        await saveBooksList(updated);
        setDeleteConfirmInfo(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-orange-950 border border-amber-900/40 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        {/* Ambient background glows */}
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-extrabold backdrop-blur-md">
              <BookOpen size={14} className="text-amber-300" />
              <span>بانک جامع سرفصل‌ها و محدوده‌های امتحانی حوزه</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              بانک محدوده دروس امتحانات شفاهی
            </h2>
            <p className="text-amber-100/80 text-xs sm:text-sm max-w-2xl leading-relaxed">
              بانک رسمی و کامل شامل کتب آزمون ورودی (اصول مظفر، حلقه ثانیه، لمعه) و امتحانات طول سال (رسائل، کفایه، حلقه ثالثه، و مکاسب). این محدوده‌ها معیار انتساب به طلاب در زمان برگزاری آزمون است.
            </p>
          </div>

          {/* Top Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {canEdit && (
              <button
                onClick={handleOpenAddBook}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-xl font-extrabold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer scale-[1.01]"
              >
                <Plus size={16} />
                <span>تعریف کتاب / درس جدید</span>
              </button>
            )}

            <button
              onClick={expandAll}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-xl text-xs font-bold transition-all backdrop-blur-md"
            >
              باز کردن همه
            </button>
            <button
              onClick={collapseAll}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-xl text-xs font-bold transition-all backdrop-blur-md"
            >
              بستن همه
            </button>
          </div>
        </div>

        {/* Minimal Stats Row */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-amber-800/50 text-xs">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/5">
            <span className="text-amber-200/80 block mb-1 font-medium">تعداد کتب و دروس</span>
            <span className="text-xl font-black text-white">{totalStats.bookCount} <span className="text-xs font-normal opacity-80">کتاب</span></span>
          </div>
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/5">
            <span className="text-amber-200/80 block mb-1 font-medium">محدوده‌های اصلی</span>
            <span className="text-xl font-black text-amber-300">{totalStats.mainCount} <span className="text-xs font-normal opacity-80">سرفصل</span></span>
          </div>
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/5">
            <span className="text-amber-200/80 block mb-1 font-medium">زیرمحدوده‌ها و صفحات</span>
            <span className="text-xl font-black text-sky-300">{totalStats.subCount} <span className="text-xs font-normal opacity-80">محدوده دقیق</span></span>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجوی عنوان کتاب، محدوده اصلی، زیرمحدوده یا شماره صفحه (مثلا: قطع و ظن، ص ۱۴)..."
            className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-800 focus:bg-white transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Segmented Controls for Stages */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setStageFilter('all')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              stageFilter === 'all' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            همه دوره‌ها
          </button>
          <button
            onClick={() => setStageFilter('entrance')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              stageFilter === 'entrance' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            آزمون ورودی
          </button>
          <button
            onClick={() => setStageFilter('annual')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              stageFilter === 'annual' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            امتحانات طول سال
          </button>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setCategoryFilter('all')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              categoryFilter === 'all' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            همه موضوعات
          </button>
          <button
            onClick={() => setCategoryFilter('usul')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              categoryFilter === 'usul' ? "bg-white text-indigo-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            اصول
          </button>
          <button
            onClick={() => setCategoryFilter('fiqh')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              categoryFilter === 'fiqh' ? "bg-white text-amber-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            فقه (مکاسب)
          </button>
        </div>
      </div>

      {/* Books List Accordion */}
      {filteredBooks.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <BookOpen size={40} className="text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700 text-sm">هیچ کتاب یا محدوده‌ای منطبق بر جستجوی شما یافت نشد.</h3>
          <p className="text-slate-400 text-xs mt-1">می‌توانید عبارت جستجو را پاک کنید یا کتاب جدیدی تعریف فرمایید.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBooks.map((book) => {
            const isExpanded = expandedBookIds[book.id] ?? true;
            const isEntrance = book.stage === 'entrance';
            const isUsul = book.category === 'usul';
            const isFiqh = book.category === 'fiqh';

            return (
              <div
                key={book.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:border-slate-300 transition-all"
              >
                {/* Book Header Card */}
                <div
                  className="p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4 cursor-pointer select-none bg-gradient-to-r from-slate-50/50 to-white"
                  onClick={() => toggleBookExpand(book.id)}
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 mt-0.5 sm:mt-0",
                      isEntrance ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                      isUsul ? "bg-indigo-50 text-indigo-700 border border-indigo-200" :
                      isFiqh ? "bg-amber-50 text-amber-700 border border-amber-200" :
                      "bg-slate-100 text-slate-700 border border-slate-200"
                    )}>
                      <BookMarked size={20} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black text-slate-900 truncate">
                          {book.title}
                        </h3>
                        <span className="text-xs text-slate-500 font-medium">
                          {isEntrance ? 'آزمون ورودی' : 'امتحان طول سال'} · {isUsul ? 'اصول' : isFiqh ? 'فقه' : 'عمومی'}
                        </span>
                        {book.grade && (
                          <span className="text-[11px] text-slate-400">· {book.grade}</span>
                        )}
                      </div>
                      {book.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {book.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs text-slate-400 font-medium ml-1">
                      {book.mainRanges.length} محدوده اصلی
                    </span>

                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenAddMainScope(book)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                          title="افزودن محدوده اصلی جدید به این کتاب"
                        >
                          <Plus size={13} />
                          <span>افزودن سرفصل</span>
                        </button>
                        <button
                          onClick={() => handleOpenEditBook(book)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                          title="ویرایش مشخصات کتاب"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteBook(book)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="حذف کتاب"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => toggleBookExpand(book.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* Main Ranges and Sub-Ranges (Expanded Body) */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-slate-100 p-4 sm:p-5 bg-slate-50/40"
                    >
                      {book.mainRanges.length === 0 ? (
                        <div className="p-6 text-center bg-white rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                          هنوز هیچ محدوده اصلی برای این کتاب تعریف نشده است.
                          {canEdit && (
                            <button
                              onClick={() => handleOpenAddMainScope(book)}
                              className="text-emerald-700 font-bold block mx-auto mt-2 hover:underline cursor-pointer"
                            >
                              + تعریف اولین محدوده اصلی
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {book.mainRanges.map((mainScope, mrIdx) => (
                            <div
                              key={mainScope.id}
                              className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3"
                            >
                              {/* Main Scope Header */}
                              <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">
                                    {mrIdx + 1}
                                  </span>
                                  <h4 className="text-sm font-extrabold text-slate-800">
                                    {mainScope.title}
                                  </h4>
                                  {mainScope.description && (
                                    <span className="text-xs text-slate-400 hidden sm:inline">
                                      — {mainScope.description}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-slate-400">
                                    {mainScope.subRanges.length} زیرمحدوده
                                  </span>

                                  {canEdit && (
                                    <>
                                      <button
                                        onClick={() => handleOpenAddSubScope(book, mainScope)}
                                        className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                        title="افزودن زیرمحدوده و تعیین صفحات"
                                      >
                                        <Plus size={12} />
                                        <span>افزودن زیرمحدوده (صفحات)</span>
                                      </button>
                                      <button
                                        onClick={() => handleOpenEditMainScope(book, mainScope)}
                                        className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                                        title="ویرایش محدوده اصلی"
                                      >
                                        <Edit3 size={13} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteMainScope(book, mainScope)}
                                        className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                                        title="حذف محدوده اصلی"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Sub-Ranges Grid */}
                              {mainScope.subRanges.length === 0 ? (
                                <div className="py-3 px-4 bg-slate-50 rounded-lg text-slate-400 text-xs border border-dashed border-slate-200">
                                  هیچ زیرمحدوده‌ای ثبت نشده است.
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                  {mainScope.subRanges.map((subScope) => (
                                    <div
                                      key={subScope.id}
                                      className="group relative bg-slate-50 hover:bg-white rounded-lg p-2.5 border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-between"
                                    >
                                      <div>
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="font-bold text-xs text-slate-800 leading-snug">
                                            {subScope.title}
                                          </div>
                                          {canEdit && (
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button
                                                onClick={() => handleOpenEditSubScope(book, mainScope, subScope)}
                                                className="p-1 text-slate-400 hover:text-slate-700 rounded"
                                              >
                                                <Edit3 size={11} />
                                              </button>
                                              <button
                                                onClick={() => handleDeleteSubScope(book, mainScope, subScope)}
                                                className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                              >
                                                <Trash2 size={11} />
                                              </button>
                                            </div>
                                          )}
                                        </div>

                                        {subScope.pages && (
                                          <div className="text-[11px] font-semibold text-emerald-700 mt-1 flex items-center gap-1">
                                            <FileText size={11} />
                                            <span>{subScope.pages}</span>
                                          </div>
                                        )}

                                        {subScope.description && (
                                          <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                                            {subScope.description}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. BOOK MODAL                                                 */}
      {/* ------------------------------------------------------------- */}
      {isBookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">
                {editingBook ? 'ویرایش اطلاعات کتاب / درس' : 'افزودن کتاب / درس جدید به بانک محدوده'}
              </h3>
              <button
                onClick={() => setIsBookModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBook} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  عنوان کتاب / درس <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  placeholder="مثلاً: رسائل (فرائد الأصول) یا شرح لمعه..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">دسته‌بندی موضوعی</label>
                  <select
                    value={bookCategory}
                    onChange={(e) => setBookCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800"
                  >
                    <option value="usul">اصول فقه</option>
                    <option value="fiqh">فقه (مکاسب / لمعه)</option>
                    <option value="entrance">آزمون ورودی</option>
                    <option value="other">سایر دروس</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">مرحله برگزاری</label>
                  <select
                    value={bookStage}
                    onChange={(e) => setBookStage(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800"
                  >
                    <option value="annual">امتحانات طول سال</option>
                    <option value="entrance">آزمون ورودی</option>
                    <option value="both">مشترک هر دو</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">پایه تحصیلی پیشنهادی</label>
                <input
                  type="text"
                  value={bookGrade}
                  onChange={(e) => setBookGrade(e.target.value)}
                  placeholder="مثلاً: پایه ۹ و ۱۰"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">توضیحات و یادداشت</label>
                <textarea
                  rows={2}
                  value={bookDescription}
                  onChange={(e) => setBookDescription(e.target.value)}
                  placeholder="شرح کوتاه درباره کتاب، مؤلف یا نکات امتحانی..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBookModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold"
                >
                  {editingBook ? 'ذخیره تغییرات' : 'افزودن کتاب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. MAIN SCOPE MODAL                                           */}
      {/* ------------------------------------------------------------- */}
      {isMainScopeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">
                {editingMainScope ? 'ویرایش محدوده اصلی' : `افزودن محدوده اصلی به «${targetBookForMainScope?.title}»`}
              </h3>
              <button
                onClick={() => setIsMainScopeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMainScope} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  عنوان محدوده اصلی (سرفصل کلی) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={mainScopeTitle}
                  onChange={(e) => setMainScopeTitle(e.target.value)}
                  placeholder="مثلاً: قطع و ظن، یا شروط متعاقدین..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">توضیحات تکمیلی سرفصل</label>
                <textarea
                  rows={2}
                  value={mainScopeDescription}
                  onChange={(e) => setMainScopeDescription(e.target.value)}
                  placeholder="توضیح کوتاه درباره محتوای این بخش..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMainScopeModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold"
                >
                  {editingMainScope ? 'ذخیره تغییرات' : 'ثبت محدوده اصلی'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. SUB SCOPE MODAL                                            */}
      {/* ------------------------------------------------------------- */}
      {isSubScopeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">
                {editingSubScope ? 'ویرایش زیرمحدوده' : `افزودن زیرمحدوده به «${targetMainScopeForSubScope?.title}»`}
              </h3>
              <button
                onClick={() => setIsSubScopeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSubScope} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  عنوان زیرمحدوده (محدوده فرعی) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={subScopeTitle}
                  onChange={(e) => setSubScopeTitle(e.target.value)}
                  placeholder="مثلاً: ادله حجیت خبر واحد..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  شماره صفحات دقیق
                </label>
                <input
                  type="text"
                  value={subScopePages}
                  onChange={(e) => setSubScopePages(e.target.value)}
                  placeholder="مثلاً: از ص ۱۴ الی ص ۲۹"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">شرح و نکات امتحانی</label>
                <textarea
                  rows={2}
                  value={subScopeDescription}
                  onChange={(e) => setSubScopeDescription(e.target.value)}
                  placeholder="نکات خاص، مباحث کلیدی، اشکالات مدنظر اساتید..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSubScopeModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold"
                >
                  {editingSubScope ? 'ذخیره تغییرات' : 'ثبت زیرمحدوده'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. DELETE CONFIRM MODAL                                       */}
      {/* ------------------------------------------------------------- */}
      {deleteConfirmInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">تأیید حذف</h3>
              <p className="text-xs text-slate-500 mt-1">
                آیا از حذف {deleteConfirmInfo.title} اطمینان دارید؟ این عمل غیرقابل بازگشت است.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmInfo(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium cursor-pointer"
              >
                انصراف
              </button>
              <button
                onClick={deleteConfirmInfo.action}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                حذف شود
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
