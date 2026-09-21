import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  Edit, 
  Archive, 
  RotateCcw, 
  Send, 
  Inbox, 
  UserCheck, 
  Calendar, 
  AlertCircle, 
  Columns, 
  List, 
  Tag, 
  X, 
  Sparkles, 
  ShieldAlert, 
  Clock, 
  Check, 
  ChevronDown, 
  Filter, 
  Search, 
  FolderPlus, 
  ArrowRightLeft,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { localDb } from '../lib/localDb';
import { PersonalTodo, TodoCategory, AssignedTodo } from '../types';
import { AppUser } from '../types/auth';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const DEFAULT_CATEGORIES = ['عمومی', 'آموزش', 'پژوهش', 'اردو و برنامه‌ها'];

export default function TodoList() {
  const { currentUser, users, isReadOnly } = useAuth();

  // Primary navigation tabs
  const [activeTab, setActiveTab] = useState<'personal' | 'assigned' | 'archive'>('personal');

  // Sub-tabs for assigned follow-ups
  const [assignedSubTab, setAssignedSubTab] = useState<'received' | 'sent'>('received');

  // View mode for personal todos: 'kanban' (by column) or 'list' (all together)
  const [personalViewMode, setPersonalViewMode] = useState<'kanban' | 'list'>('kanban');

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Data states
  const [personalTodos, setPersonalTodos] = useState<PersonalTodo[]>([]);
  const [categories, setCategories] = useState<TodoCategory[]>([]);
  const [assignedTodos, setAssignedTodos] = useState<AssignedTodo[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isAddPersonalModalOpen, setIsAddPersonalModalOpen] = useState(false);
  const [editingPersonalTodo, setEditingPersonalTodo] = useState<PersonalTodo | null>(null);

  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [editingCategoryModal, setEditingCategoryModal] = useState<{ oldName: string; newName: string } | null>(null);
  const [columnQuickInputs, setColumnQuickInputs] = useState<Record<string, string>>({});
  const [globalQuickInput, setGlobalQuickInput] = useState('');

  const [isAddAssignedModalOpen, setIsAddAssignedModalOpen] = useState(false);
  const [editingAssignedTodo, setEditingAssignedTodo] = useState<AssignedTodo | null>(null);

  const [completionNoteModalItem, setCompletionNoteModalItem] = useState<AssignedTodo | null>(null);
  const [completionNoteText, setCompletionNoteText] = useState('');

  // Personal Todo Form fields
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [formDueDate, setFormDueDate] = useState('');

  // Assigned Todo Form fields
  const [formRecipientUserId, setFormRecipientUserId] = useState('');
  const [formAssignedTitle, setFormAssignedTitle] = useState('');
  const [formAssignedDescription, setFormAssignedDescription] = useState('');
  const [formAssignedPriority, setFormAssignedPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [formAssignedDueDate, setFormAssignedDueDate] = useState('');

  // Fetch all data
  const fetchData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [fetchedPersonal, fetchedCategories, fetchedAssigned] = await Promise.all([
        localDb.getDocs<PersonalTodo>('personal_todos'),
        localDb.getDocs<TodoCategory>('user_todo_categories'),
        localDb.getDocs<AssignedTodo>('assigned_todos')
      ]);

      // Filter personal todos for current logged in user
      const myPersonal = fetchedPersonal.filter(t => t.userId === currentUser.id);
      setPersonalTodos(myPersonal);

      // Filter categories for current user
      const myCategories = fetchedCategories.filter(c => c.userId === currentUser.id);
      setCategories(myCategories);

      // Assigned todos (sent or received by current user)
      setAssignedTodos(fetchedAssigned || []);
    } catch (err) {
      console.error('Error fetching todos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const unsub = localDb.subscribe(() => {
      fetchData();
    });
    return () => unsub();
  }, [currentUser?.id]);

  const isFinanceOfficer = 
    currentUser?.role === 'finance_manager' || 
    currentUser?.role === 'financial_officer' || 
    currentUser?.username?.toUpperCase() === 'MALI';

  const defaultUserCategories = useMemo(() => {
    if (isFinanceOfficer) {
      return [
        'کارکرد و حضور اساتید',
        'محاسبه و پرداخت شهریه طلاب',
        'کسورات نهار و غیبت‌ها',
        'وام و صندوق قرض‌الحسنه',
        'هزینه‌های جاری و تنخواه مدرسه',
        'اسناد و گزارشات مالی'
      ];
    }
    return DEFAULT_CATEGORIES;
  }, [isFinanceOfficer]);

  // Available categories array (defaults + user created)
  const allCategoryNames = useMemo(() => {
    const customNames = categories.map(c => c.name);
    const set = new Set([...defaultUserCategories, ...customNames]);
    return Array.from(set);
  }, [categories, defaultUserCategories]);

  // Responsibles list (Level 1 and Level 2 users) for assignment dropdown
  const managerUsers = useMemo(() => {
    return users.filter(u => u.level === 1 || u.level === 2);
  }, [users]);

  // LEVEL 3 USER ACCESS GUARD
  if (!currentUser || currentUser.level === 3) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white border border-rose-200 rounded-2xl shadow-sm text-center space-y-4 font-vazir dir-rtl">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900">عدم دسترسی به بخش پیگیری‌ها</h2>
        <p className="text-xs text-slate-600 leading-relaxed max-w-lg mx-auto">
          این بخش مخصوص مسئولین و کادر مدیریتی مدرسه (کاربران سطح ۱ و ۲) می‌باشد. کاربران سطح ۳ (طلاب و نمایندگان کلاس) به این منو دسترسی ندارند.
        </p>
      </div>
    );
  }

  // ==================== PERSONAL TODO HANDLERS ====================
  const handleOpenAddPersonalModal = (categoryPreset?: string, todoToEdit?: PersonalTodo) => {
    if (todoToEdit) {
      setEditingPersonalTodo(todoToEdit);
      setFormTitle(todoToEdit.title);
      setFormDescription(todoToEdit.description || '');
      setFormCategory(todoToEdit.category || categoryPreset || allCategoryNames[0]);
      setFormPriority(todoToEdit.priority || 'medium');
      setFormDueDate(todoToEdit.dueDate || '');
    } else {
      setEditingPersonalTodo(null);
      setFormTitle('');
      setFormDescription('');
      setFormCategory(categoryPreset || allCategoryNames[0]);
      setFormPriority('medium');
      setFormDueDate('');
    }
    setIsAddPersonalModalOpen(true);
  };

  const handleSavePersonalTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    try {
      if (editingPersonalTodo) {
        await localDb.updateDoc('personal_todos', editingPersonalTodo.id, {
          title: formTitle.trim(),
          description: formDescription.trim(),
          category: formCategory,
          priority: formPriority,
          dueDate: formDueDate,
          updatedAt: new Date().toISOString()
        });
      } else {
        await localDb.addDoc('personal_todos', {
          userId: currentUser.id,
          userName: currentUser.name,
          title: formTitle.trim(),
          description: formDescription.trim(),
          category: formCategory,
          completed: false,
          archived: false,
          priority: formPriority,
          dueDate: formDueDate,
          createdAt: new Date().toISOString()
        });
      }

      setIsAddPersonalModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error saving personal todo:', err);
    }
  };

  const handleTogglePersonalComplete = async (todo: PersonalTodo) => {
    try {
      await localDb.updateDoc('personal_todos', todo.id, {
        completed: !todo.completed,
        completedAt: !todo.completed ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString()
      });
      fetchData();
    } catch (err) {
      console.error('Error toggling complete:', err);
    }
  };

  const handleArchivePersonalTodo = async (todoId: string, archiveState: boolean) => {
    try {
      await localDb.updateDoc('personal_todos', todoId, {
        archived: archiveState,
        archivedAt: archiveState ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString()
      });
      fetchData();
    } catch (err) {
      console.error('Error archiving personal todo:', err);
    }
  };

  const handleDeletePersonalTodo = async (todoId: string) => {
    if (!window.confirm('آیا از حذف این پیگیری شخصی اطمینان دارید؟')) return;
    try {
      await localDb.deleteDoc('personal_todos', todoId);
      fetchData();
    } catch (err) {
      console.error('Error deleting personal todo:', err);
    }
  };

  // ==================== CATEGORY & QUICK ADD HANDLERS ====================
  const handleQuickAddPersonalTodo = async (categoryName: string, textOverride?: string) => {
    const text = textOverride !== undefined ? textOverride : (columnQuickInputs[categoryName] || '');
    if (!text.trim() || !currentUser) return;

    try {
      await localDb.addDoc('personal_todos', {
        userId: currentUser.id,
        userName: currentUser.name,
        title: text.trim(),
        description: '',
        category: categoryName,
        completed: false,
        archived: false,
        priority: 'medium',
        dueDate: '',
        createdAt: new Date().toISOString()
      });

      setColumnQuickInputs(prev => ({ ...prev, [categoryName]: '' }));
      setGlobalQuickInput('');
      fetchData();
    } catch (err) {
      console.error('Error quick adding todo:', err);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !currentUser) return;
    const cleanName = newCategoryName.trim();
    if (allCategoryNames.includes(cleanName)) {
      alert('این ستون/دسته‌بندی قبلاً وجود دارد.');
      return;
    }

    try {
      await localDb.addDoc('user_todo_categories', {
        userId: currentUser.id,
        name: cleanName,
        createdAt: new Date().toISOString()
      });
      setNewCategoryName('');
      setIsAddCategoryModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error adding category:', err);
    }
  };

  const handleSaveEditCategory = async () => {
    if (!editingCategoryModal || !editingCategoryModal.newName.trim() || !currentUser) return;
    const { oldName, newName } = editingCategoryModal;
    const cleanNewName = newName.trim();
    if (cleanNewName === oldName) {
      setEditingCategoryModal(null);
      return;
    }

    try {
      // 1. Update user_todo_categories if doc exists
      const userCatDocs = categories.filter(c => c.name === oldName && c.userId === currentUser.id);
      if (userCatDocs.length > 0) {
        for (const catDoc of userCatDocs) {
          await localDb.updateDoc('user_todo_categories', catDoc.id, {
            name: cleanNewName
          });
        }
      } else {
        // If it was a default category name, create custom category doc with new name
        await localDb.addDoc('user_todo_categories', {
          userId: currentUser.id,
          name: cleanNewName,
          createdAt: new Date().toISOString()
        });
      }

      // 2. Update all personal_todos with category === oldName
      const userTodosToUpdate = personalTodos.filter(t => t.category === oldName);
      for (const todo of userTodosToUpdate) {
        await localDb.updateDoc('personal_todos', todo.id, {
          category: cleanNewName
        });
      }

      setEditingCategoryModal(null);
      fetchData();
    } catch (err) {
      console.error('Error renaming category:', err);
    }
  };

  const handleDeleteCategoryColumn = async (categoryName: string) => {
    if (!currentUser) return;
    const confirmDelete = window.confirm(
      `آیا از حذف ستون "${categoryName}" اطمینان دارید؟ تمام کارهای این ستون به ستون "عمومی" منتقل خواهند شد.`
    );
    if (!confirmDelete) return;

    try {
      // Delete user_todo_categories doc if it exists
      const userCatDocs = categories.filter(c => c.name === categoryName && c.userId === currentUser.id);
      for (const catDoc of userCatDocs) {
        await localDb.deleteDoc('user_todo_categories', catDoc.id);
      }

      // Move all personal_todos in this category to 'عمومی'
      const todosInCat = personalTodos.filter(t => t.category === categoryName);
      for (const todo of todosInCat) {
        await localDb.updateDoc('personal_todos', todo.id, {
          category: 'عمومی'
        });
      }

      fetchData();
    } catch (err) {
      console.error('Error deleting category column:', err);
    }
  };

  // ==================== ASSIGNED TODO HANDLERS ====================
  const handleOpenAddAssignedModal = () => {
    const firstOtherManager = managerUsers.find(u => u.id !== currentUser.id) || managerUsers[0];
    setFormRecipientUserId(firstOtherManager?.id || '');
    setFormAssignedTitle('');
    setFormAssignedDescription('');
    setFormAssignedPriority('medium');
    setFormAssignedDueDate('');
    setIsAddAssignedModalOpen(true);
  };

  const handleSendAssignedTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAssignedTitle.trim() || !formRecipientUserId) {
      alert('لطفاً عنوان پیگیری و مسئول دریافت‌کننده را مشخص کنید.');
      return;
    }

    const recipient = users.find(u => u.id === formRecipientUserId);
    if (!recipient) {
      alert('مسئول دریافت‌کننده یافت نشد.');
      return;
    }

    try {
      await localDb.addDoc('assigned_todos', {
        senderUserId: currentUser.id,
        senderUserName: currentUser.name,
        senderRoleTitle: currentUser.roleTitle || 'مسئول',
        recipientUserId: recipient.id,
        recipientUserName: recipient.name,
        recipientRoleTitle: recipient.roleTitle || 'مسئول',
        title: formAssignedTitle.trim(),
        description: formAssignedDescription.trim(),
        priority: formAssignedPriority,
        dueDate: formAssignedDueDate,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      // Add audit log
      await localDb.addDoc('audit_logs', {
        action: 'ارسال پیگیری به مسئول',
        details: `ارسال پیگیری "${formAssignedTitle.trim()}" به ${recipient.name} توسط ${currentUser.name}`,
        userId: currentUser.id,
        userName: currentUser.name,
        createdAt: new Date().toISOString()
      });

      setIsAddAssignedModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error sending assigned todo:', err);
    }
  };

  const handleMarkAssignedCompleted = async (assignedTodo: AssignedTodo) => {
    setCompletionNoteModalItem(assignedTodo);
    setCompletionNoteText('');
  };

  const confirmCompletionNote = async () => {
    if (!completionNoteModalItem) return;
    try {
      await localDb.updateDoc('assigned_todos', completionNoteModalItem.id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        completionNote: completionNoteText.trim(),
        updatedAt: new Date().toISOString()
      });

      setCompletionNoteModalItem(null);
      fetchData();
    } catch (err) {
      console.error('Error completing assigned todo:', err);
    }
  };

  const handleDeleteAssignedTodo = async (id: string) => {
    if (!window.confirm('آیا از حذف این پیگیری ارجاع‌شده اطمینان دارید؟')) return;
    try {
      await localDb.deleteDoc('assigned_todos', id);
      fetchData();
    } catch (err) {
      console.error('Error deleting assigned todo:', err);
    }
  };

  // Filtered lists for rendering
  const activePersonalTodos = useMemo(() => {
    return personalTodos
      .filter(t => !t.archived)
      .filter(t => {
        if (selectedCategoryFilter !== 'all' && t.category !== selectedCategoryFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return t.title.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q));
        }
        return true;
      });
  }, [personalTodos, selectedCategoryFilter, searchQuery]);

  const archivedPersonalTodos = useMemo(() => {
    return personalTodos.filter(t => t.archived);
  }, [personalTodos]);

  const receivedAssignedTodos = useMemo(() => {
    return assignedTodos
      .filter(t => {
        if (t.archivedByRecipient) return false;
        if (t.recipientUserId === currentUser.id) return true;
        if (isFinanceOfficer && (t.recipientUserId === 'user_mali' || t.recipientRoleTitle?.includes('مالی') || t.recipientUserName?.includes('مالی'))) {
          return true;
        }
        return false;
      })
      .sort((a, b) => {
        // Pending first, completed bottom
        if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [assignedTodos, currentUser.id, isFinanceOfficer]);

  const sentAssignedTodos = useMemo(() => {
    return assignedTodos
      .filter(t => t.senderUserId === currentUser.id && !t.archivedBySender)
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [assignedTodos, currentUser.id]);

  return (
    <div className="p-4 md:p-6 space-y-6 dir-rtl font-vazir max-w-7xl mx-auto">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-xl">
                <Sparkles className="w-6 h-6 text-indigo-300" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-white">
                  {isFinanceOfficer ? 'پیگیری‌ها و ارجاعات مالی و اداری' : 'پیگیری‌های من و ارجاعات بین مسئولین'}
                </h1>
                <p className="text-xs text-indigo-200 mt-0.5">
                  {isFinanceOfficer 
                    ? 'مدیریت پیگیری‌های دریافت کارکرد اساتید، محاسبه شهریه طلاب، تسویه نهار، وام و امور مالی مدرسه'
                    : 'مدیریت کارهای شخصی، دسته‌بندی ستونی و ارجاع پیگیری به سایر مسئولین مدرسه (مستقل برای هر کاربر)'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeTab === 'personal' && (
              <button
                onClick={() => handleOpenAddPersonalModal()}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <Plus size={16} />
                <span>ثبت پیگیری جدید</span>
              </button>
            )}

            {activeTab === 'assigned' && (
              <button
                onClick={handleOpenAddAssignedModal}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <Send size={16} />
                <span>ارسال پیگیری به مسئول دیگر</span>
              </button>
            )}
          </div>
        </div>

        {/* Primary Tabs */}
        <div className="flex items-center gap-2 pt-5 mt-5 border-t border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('personal')}
            className={cn(
              "px-4 py-2 rounded-xl font-black flex items-center gap-2 transition-all cursor-pointer",
              activeTab === 'personal'
                ? "bg-white text-slate-900 shadow-md"
                : "bg-white/10 text-slate-300 hover:bg-white/20"
            )}
          >
            <Columns size={15} />
            <span>پیگیری‌های شخصی من</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-indigo-100 text-indigo-800">
              {personalTodos.filter(t => !t.archived).length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('assigned')}
            className={cn(
              "px-4 py-2 rounded-xl font-black flex items-center gap-2 transition-all cursor-pointer",
              activeTab === 'assigned'
                ? "bg-white text-slate-900 shadow-md"
                : "bg-white/10 text-slate-300 hover:bg-white/20"
            )}
          >
            <ArrowRightLeft size={15} />
            <span>پیگیری‌های ارسالی و دریافتی</span>
            {receivedAssignedTodos.filter(t => t.status === 'pending').length > 0 && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-amber-400 text-slate-950 font-black animate-pulse">
                {receivedAssignedTodos.filter(t => t.status === 'pending').length} نیازمند اقدام
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('archive')}
            className={cn(
              "px-4 py-2 rounded-xl font-black flex items-center gap-2 transition-all cursor-pointer",
              activeTab === 'archive'
                ? "bg-white text-slate-900 shadow-md"
                : "bg-white/10 text-slate-300 hover:bg-white/20"
            )}
          >
            <Archive size={15} />
            <span>بایگانی</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-slate-800 text-slate-300">
              {archivedPersonalTodos.length}
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: PERSONAL TODOS */}
      {activeTab === 'personal' && (
        <div className="space-y-4">
          {/* Bar Controls */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search and Category Filters */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="جستجو در کارهای شخصی..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-9 pl-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="py-1.5 px-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">📂 همه ستون‌ها / دسته‌ها</option>
                {allCategoryNames.map((cat, i) => (
                  <option key={i} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* View switcher & Add Category */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => setIsAddCategoryModalOpen(true)}
                className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <FolderPlus size={14} />
                <span>+ ایجاد ستون جدید</span>
              </button>

              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  onClick={() => setPersonalViewMode('kanban')}
                  className={cn(
                    "px-3 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-all",
                    personalViewMode === 'kanban' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <Columns size={13} />
                  <span>ستون‌ها</span>
                </button>
                <button
                  onClick={() => setPersonalViewMode('list')}
                  className={cn(
                    "px-3 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-all",
                    personalViewMode === 'list' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <List size={13} />
                  <span>همه یک‌جا</span>
                </button>
              </div>
            </div>
          </div>

          {/* VIEW MODE: KANBAN / COLUMNS */}
          {personalViewMode === 'kanban' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
              {allCategoryNames
                .filter(cat => selectedCategoryFilter === 'all' || selectedCategoryFilter === cat)
                .map((categoryName) => {
                  const itemsInCat = activePersonalTodos.filter(t => t.category === categoryName);
                  // Separate uncompleted and completed
                  const uncompleted = itemsInCat.filter(t => !t.completed);
                  const completed = itemsInCat.filter(t => t.completed);
                  const sortedItems = [...uncompleted, ...completed];

                  return (
                    <div key={categoryName} className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3 shadow-xs">
                      {/* Column Header */}
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <Tag size={15} className="text-indigo-600" />
                          <h3 className="font-black text-slate-900 text-sm">{categoryName}</h3>
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold">
                            {itemsInCat.length}
                          </span>
                        </div>
                        <button
                          onClick={() => handleOpenAddPersonalModal(categoryName)}
                          className="p-1 hover:bg-slate-200 rounded-lg text-indigo-600 transition-colors cursor-pointer"
                          title="افزودن کار زیر این ستون"
                        >
                          <Plus size={16} />
                        </button>
                      </div>

                      {/* Quick Add Input Box - Type & Press Enter */}
                      <div className="pt-1">
                        <input
                          type="text"
                          placeholder="+ عنوان کار جدید را بنویسید و Enter بزنید..."
                          value={columnQuickInputs[categoryName] || ''}
                          onChange={(e) => setColumnQuickInputs({ ...columnQuickInputs, [categoryName]: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleQuickAddPersonalTodo(categoryName);
                            }
                          }}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 rounded-xl text-xs font-bold text-slate-800 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal shadow-2xs"
                        />
                      </div>

                      {/* Items inside column */}
                      <div className="space-y-2 min-h-[120px]">
                        {sortedItems.length === 0 ? (
                          <div className="p-4 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl bg-white/50">
                            هیچ کاری ثبت نشده است.
                          </div>
                        ) : (
                          sortedItems.map((todo) => (
                            <div
                              key={todo.id}
                              className={cn(
                                "p-3 rounded-xl border transition-all space-y-2 relative group",
                                todo.completed
                                  ? "bg-slate-100/90 border-slate-200 opacity-60"
                                  : "bg-white border-slate-200 hover:border-indigo-300 shadow-2xs"
                              )}
                            >
                              <div className="flex items-start gap-2.5">
                                {/* Checkbox */}
                                <button
                                  onClick={() => handleTogglePersonalComplete(todo)}
                                  className="mt-0.5 text-slate-400 hover:text-emerald-600 cursor-pointer transition-colors shrink-0"
                                >
                                  {todo.completed ? (
                                    <CheckCircle2 size={18} className="text-emerald-600 fill-emerald-50" />
                                  ) : (
                                    <Circle size={18} />
                                  )}
                                </button>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <span
                                    className={cn(
                                      "font-bold text-xs block leading-relaxed break-words",
                                      todo.completed
                                        ? "line-through text-slate-500 decoration-slate-400"
                                        : "text-slate-800"
                                    )}
                                  >
                                    {todo.title}
                                  </span>

                                  {todo.description && (
                                    <p className={cn("text-[11px] mt-1 leading-relaxed", todo.completed ? "line-through text-slate-400" : "text-slate-500")}>
                                      {todo.description}
                                    </p>
                                  )}

                                  {/* Badges */}
                                  <div className="flex items-center gap-2 mt-2 pt-1 border-t border-slate-100 text-[10px]">
                                    {todo.priority === 'high' && (
                                      <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 font-bold rounded-md">فوری</span>
                                    )}
                                    {todo.priority === 'medium' && (
                                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-md">مهم</span>
                                    )}
                                    {todo.dueDate && (
                                      <span className="text-slate-400 font-mono flex items-center gap-1">
                                        <Calendar size={10} />
                                        <span>{todo.dueDate}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => handleOpenAddPersonalModal(categoryName, todo)}
                                    className="p-1 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-md cursor-pointer"
                                    title="ویرایش"
                                  >
                                    <Edit size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleArchivePersonalTodo(todo.id, true)}
                                    className="p-1 hover:bg-slate-100 text-slate-500 hover:text-amber-600 rounded-md cursor-pointer"
                                    title="بایگانی"
                                  >
                                    <Archive size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePersonalTodo(todo.id)}
                                    className="p-1 hover:bg-slate-100 text-slate-500 hover:text-rose-600 rounded-md cursor-pointer"
                                    title="حذف"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Quick Add Button at bottom of column */}
                      <button
                        onClick={() => handleOpenAddPersonalModal(categoryName)}
                        className="w-full py-2 bg-white hover:bg-slate-100 border border-slate-200 text-indigo-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>افزودن کار در این ستون</span>
                      </button>
                    </div>
                  );
                })}
            </div>
          ) : (
            /* VIEW MODE: UNIFIED MASTER LIST */
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-100 font-black text-xs text-slate-700 flex items-center justify-between">
                <span>تمام کارهای شخصی ثبت‌شده</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  (کارهای انجام شده خودکار در پایین قرار می‌گیرند)
                </span>
              </div>

              {activePersonalTodos.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs font-bold">
                  هیچ کاری ثبت نشده است.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {/* Sorted: Uncompleted first, then completed */}
                  {[
                    ...activePersonalTodos.filter(t => !t.completed),
                    ...activePersonalTodos.filter(t => t.completed)
                  ].map((todo) => (
                    <div
                      key={todo.id}
                      className={cn(
                        "p-4 flex items-start justify-between gap-4 transition-colors",
                        todo.completed ? "bg-slate-50/70 opacity-60" : "hover:bg-slate-50/50"
                      )}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <button
                          onClick={() => handleTogglePersonalComplete(todo)}
                          className="mt-0.5 text-slate-400 hover:text-emerald-600 cursor-pointer transition-colors shrink-0"
                        >
                          {todo.completed ? (
                            <CheckCircle2 size={20} className="text-emerald-600 fill-emerald-50" />
                          ) : (
                            <Circle size={20} />
                          )}
                        </button>

                        <div className="space-y-1">
                          <span
                            className={cn(
                              "font-bold text-xs block leading-relaxed",
                              todo.completed ? "line-through text-slate-500 decoration-emerald-500" : "text-slate-900"
                            )}
                          >
                            {todo.title}
                          </span>
                          {todo.description && (
                            <p className={cn("text-[11px]", todo.completed ? "line-through text-slate-400" : "text-slate-600")}>
                              {todo.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 pt-1 text-[10px]">
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md font-bold">
                              ستون: {todo.category}
                            </span>
                            {todo.priority === 'high' && (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-700 font-bold rounded-md">فوری</span>
                            )}
                            {todo.dueDate && (
                              <span className="text-slate-400 font-mono">تاریخ: {todo.dueDate}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleOpenAddPersonalModal(todo.category, todo)}
                          className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-lg cursor-pointer"
                          title="ویرایش"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          onClick={() => handleArchivePersonalTodo(todo.id, true)}
                          className="p-1.5 hover:bg-slate-200 text-slate-600 hover:text-amber-600 rounded-lg cursor-pointer"
                          title="بایگانی"
                        >
                          <Archive size={15} />
                        </button>
                        <button
                          onClick={() => handleDeletePersonalTodo(todo.id)}
                          className="p-1.5 hover:bg-slate-200 text-slate-600 hover:text-rose-600 rounded-lg cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ASSIGNED FOLLOW-UPS (SENT / RECEIVED) */}
      {activeTab === 'assigned' && (
        <div className="space-y-4">
          {/* Sub Tab Switcher */}
          <div className="bg-white p-2 border border-slate-200 rounded-2xl shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAssignedSubTab('received')}
                className={cn(
                  "py-2 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2",
                  assignedSubTab === 'received'
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                )}
              >
                <Inbox size={16} />
                <span>دریافتی‌های من ({receivedAssignedTodos.length})</span>
                {receivedAssignedTodos.filter(t => t.status === 'pending').length > 0 && (
                  <span className="px-1.5 py-0.5 bg-amber-400 text-slate-950 font-black rounded-md text-[10px]">
                    {receivedAssignedTodos.filter(t => t.status === 'pending').length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setAssignedSubTab('sent')}
                className={cn(
                  "py-2 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2",
                  assignedSubTab === 'sent'
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                )}
              >
                <Send size={16} />
                <span>ارسالی‌های من ({sentAssignedTodos.length})</span>
              </button>
            </div>

            <button
              onClick={handleOpenAddAssignedModal}
              className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus size={15} />
              <span>ارسال پیگیری به مسئول دیگر</span>
            </button>
          </div>

          {/* SUB TAB: RECEIVED (دریافتی‌های من) */}
          {assignedSubTab === 'received' && (
            <div className="space-y-3">
              {receivedAssignedTodos.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-bold bg-white border border-slate-200 rounded-2xl shadow-xs">
                  هیچ پیگیری دریافتی برای شما ثبت نشده است.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {receivedAssignedTodos.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "bg-white border rounded-2xl p-4 space-y-3 relative shadow-xs transition-all",
                        item.status === 'completed'
                          ? "border-emerald-200 bg-emerald-50/20"
                          : "border-slate-200 hover:border-indigo-300"
                      )}
                    >
                      {/* Sender Tag */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center font-black text-xs">
                            {item.senderUserName.charAt(0)}
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block">از طرف:</span>
                            <span className="font-black text-slate-900 text-xs">
                              {item.senderUserName} ({item.senderRoleTitle})
                            </span>
                          </div>
                        </div>

                        {item.status === 'completed' ? (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-black flex items-center gap-1 border border-emerald-300">
                            <CheckCircle2 size={14} className="text-emerald-600" />
                            <span>انجام شد</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-black flex items-center gap-1 border border-amber-300">
                            <Clock size={14} className="text-amber-600" />
                            <span>در حال پیگیری</span>
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="space-y-1">
                        <h4 className="font-black text-slate-900 text-sm">{item.title}</h4>
                        {item.description && (
                          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Completion Note if exists */}
                      {item.completionNote && (
                        <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-xs space-y-1">
                          <span className="text-[10px] font-black text-emerald-800 block">یادداشت انجام پیگیری:</span>
                          <p className="text-emerald-950 font-medium">{item.completionNote}</p>
                        </div>
                      )}

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <span className="text-[10px] text-slate-400 font-mono">
                          ارسال: {new Date(item.createdAt).toLocaleDateString('fa-IR')}
                        </span>

                        {item.status !== 'completed' && (
                          <button
                            onClick={() => handleMarkAssignedCompleted(item)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Check size={15} />
                            <span>علامت‌گذاری به عنوان انجام شد</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SUB TAB: SENT (ارسالی‌های من) */}
          {assignedSubTab === 'sent' && (
            <div className="space-y-3">
              {sentAssignedTodos.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-bold bg-white border border-slate-200 rounded-2xl shadow-xs">
                  هیچ پیگیری ارسالی توسط شما ثبت نشده است.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sentAssignedTodos.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "bg-white border rounded-2xl p-4 space-y-3 relative shadow-xs transition-all",
                        item.status === 'completed'
                          ? "border-emerald-300 bg-emerald-50/20 ring-1 ring-emerald-400/30"
                          : "border-slate-200 hover:border-indigo-300"
                      )}
                    >
                      {/* Recipient Tag & Status */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center font-black text-xs">
                            {item.recipientUserName.charAt(0)}
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block">ارسال شده به:</span>
                            <span className="font-black text-slate-900 text-xs">
                              {item.recipientUserName} ({item.recipientRoleTitle})
                            </span>
                          </div>
                        </div>

                        {/* STATUS BADGE - Vibrant Green when Completed */}
                        {item.status === 'completed' ? (
                          <span className="px-3 py-1 bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs border border-emerald-600 animate-pulse">
                            <CheckCircle2 size={16} />
                            <span>انجام شده</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-black flex items-center gap-1 border border-amber-300">
                            <Clock size={14} className="text-amber-600" />
                            <span>در انتظار مسئول</span>
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="space-y-1">
                        <h4 className="font-black text-slate-900 text-sm">{item.title}</h4>
                        {item.description && (
                          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Completion status note from recipient */}
                      {item.status === 'completed' && (
                        <div className="bg-emerald-100/60 p-3 rounded-xl border border-emerald-300 text-xs space-y-1">
                          <div className="flex items-center justify-between text-emerald-900 font-black">
                            <span>✅ وضعیت: توسط مسئول انجام شد</span>
                            <span className="text-[10px] font-mono">{item.completedAt ? new Date(item.completedAt).toLocaleDateString('fa-IR') : ''}</span>
                          </div>
                          {item.completionNote && (
                            <p className="text-emerald-950 font-medium pt-1">
                              توضیحات مسئول: "{item.completionNote}"
                            </p>
                          )}
                        </div>
                      )}

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <span className="text-[10px] text-slate-400 font-mono">
                          تاریخ ارسال: {new Date(item.createdAt).toLocaleDateString('fa-IR')}
                        </span>

                        <button
                          onClick={() => handleDeleteAssignedTodo(item.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                          title="حذف ارجاع"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ARCHIVE */}
      {activeTab === 'archive' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 font-black text-sm text-slate-900">
            <div className="flex items-center gap-2">
              <Archive className="text-amber-600" size={18} />
              <span>کارهای بایگانی‌شده ({archivedPersonalTodos.length})</span>
            </div>
          </div>

          {archivedPersonalTodos.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-bold text-xs">
              هیچ کار بایگانی‌شده‌ای یافت نشد.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {archivedPersonalTodos.map((todo) => (
                <div key={todo.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <span className="font-bold text-xs text-slate-800 line-through">{todo.title}</span>
                    <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                      ستون: {todo.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleArchivePersonalTodo(todo.id, false)}
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RotateCcw size={14} />
                      <span>خروج از بایگانی</span>
                    </button>
                    <button
                      onClick={() => handleDeletePersonalTodo(todo.id)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                      title="حذف کامل"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD / EDIT PERSONAL TODO */}
      <AnimatePresence>
        {isAddPersonalModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs dir-rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden font-vazir"
            >
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                <h3 className="font-black text-sm">
                  {editingPersonalTodo ? 'ویرایش پیگیری شخصی' : 'ثبت پیگیری شخصی جدید'}
                </h3>
                <button
                  onClick={() => setIsAddPersonalModalOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSavePersonalTodo} className="p-5 space-y-4 text-xs">
                <div>
                  <label className="font-black text-slate-800 block mb-1">عنوان کار / پیگیری *</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="مثال: پیگیری تدارکات اردو..."
                    required
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="font-black text-slate-800 block mb-1">ستون / دسته‌بندی *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {allCategoryNames.map((cat, i) => (
                      <option key={i} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-black text-slate-800 block mb-1">توضیحات تکمیلی (اختیاری)</label>
                  <textarea
                    rows={3}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="جزئیات و نکات کار..."
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-black text-slate-800 block mb-1">اولویت</label>
                    <select
                      value={formPriority}
                      onChange={(e) => setFormPriority(e.target.value as any)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="low">عادی</option>
                      <option value="medium">مهم</option>
                      <option value="high">فوری</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-black text-slate-800 block mb-1">تاریخ مهلت (شمسی)</label>
                    <input
                      type="text"
                      value={formDueDate}
                      onChange={(e) => setFormDueDate(e.target.value)}
                      placeholder="مثال: ۱۴۰۳/۰۷/۲۰"
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddPersonalModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer shadow-md"
                  >
                    ذخیره پیگیری
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: ADD CUSTOM CATEGORY */}
      <AnimatePresence>
        {isAddCategoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs dir-rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden font-vazir"
            >
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                <h3 className="font-black text-sm">ایجاد ستون / دسته‌بندی جدید</h3>
                <button
                  onClick={() => setIsAddCategoryModalOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddCategory} className="p-5 space-y-4 text-xs">
                <div>
                  <label className="font-black text-slate-800 block mb-1">نام ستون *</label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="مثال: اردو، امور مالی، تجهیزات..."
                    required
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddCategoryModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer shadow-md"
                  >
                    ایجاد ستون
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: SEND ASSIGNED TODO TO OTHER MANAGER */}
      <AnimatePresence>
        {isAddAssignedModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs dir-rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden font-vazir"
            >
              <div className="bg-emerald-900 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Send size={18} className="text-emerald-300" />
                  <h3 className="font-black text-sm">ارسال پیگیری به مسئول دیگر</h3>
                </div>
                <button
                  onClick={() => setIsAddAssignedModalOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSendAssignedTodo} className="p-5 space-y-4 text-xs">
                <div>
                  <label className="font-black text-slate-800 block mb-1">انتخاب مسئول دریافت‌کننده *</label>
                  <select
                    value={formRecipientUserId}
                    onChange={(e) => setFormRecipientUserId(e.target.value)}
                    required
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {managerUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.roleTitle || 'مسئول'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-black text-slate-800 block mb-1">عنوان موضوع پیگیری *</label>
                  <input
                    type="text"
                    value={formAssignedTitle}
                    onChange={(e) => setFormAssignedTitle(e.target.value)}
                    placeholder="مثال: تنظیم و هماهنگی کلاس پایه ۸..."
                    required
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-black text-slate-800 block mb-1">شرح کامل پیگیری و درخواست</label>
                  <textarea
                    rows={3}
                    value={formAssignedDescription}
                    onChange={(e) => setFormAssignedDescription(e.target.value)}
                    placeholder="توضیحات لازم جهت پیگیری سریع..."
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddAssignedModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer shadow-md flex items-center gap-1.5"
                  >
                    <Send size={15} />
                    <span>ارسال پیگیری</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: COMPLETION NOTE FOR ASSIGNED TODO */}
      <AnimatePresence>
        {completionNoteModalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs dir-rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden font-vazir"
            >
              <div className="bg-emerald-800 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} />
                  <h3 className="font-black text-sm">تأیید انجام پیگیری دریافت‌شده</h3>
                </div>
                <button
                  onClick={() => setCompletionNoteModalItem(null)}
                  className="p-1 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block">موضوع پیگیری:</span>
                  <span className="font-black text-slate-900 text-sm block mt-0.5">
                    {completionNoteModalItem.title}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold block mt-1">
                    از طرف: {completionNoteModalItem.senderUserName} ({completionNoteModalItem.senderRoleTitle})
                  </span>
                </div>

                <div>
                  <label className="font-black text-slate-800 block mb-1">
                    توضیحات انجام / نتیجه پیگیری (اختیاری)
                  </label>
                  <textarea
                    rows={3}
                    value={completionNoteText}
                    onChange={(e) => setCompletionNoteText(e.target.value)}
                    placeholder="مثال: کلاس هماهنگ شد و اطلاع‌رسانی انجام شد..."
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setCompletionNoteModalItem(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={confirmCompletionNote}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer shadow-md flex items-center gap-1.5"
                  >
                    <Check size={16} />
                    <span>ثبت به عنوان انجام شد</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
