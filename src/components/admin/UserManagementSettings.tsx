import React, { useState } from 'react';
import { useAuth, ALL_SYSTEM_TABS, SystemTabDef } from '../../context/AuthContext';
import { AppUser, UserLevel, UserRole, UserScope } from '../../types/auth';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  KeyRound, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Lock, 
  Check, 
  Shield, 
  Layers, 
  Eye, 
  Settings2,
  Sparkles,
  AlertTriangle,
  Search,
  CheckCheck,
  Ban,
  FileCheck,
  ShieldAlert,
  Info
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const TAB_CATEGORIES = [
  'همه دسته‌ها',
  'آموزش و تدریس',
  'مدیریت طلاب و کاربران',
  'امور مالی و تغذیه',
  'اساتید و پرسنلی',
  'پژوهش و هوش مصنوعی',
  'عمومی و جریان کار',
  'مدیریت سیستم و امنیت'
] as const;

export default function UserManagementSettings() {
  const { users, currentUser, addUser, updateUser, deleteUser, resetDefaultUsers } = useAuth();
  
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [filterLevel, setFilterLevel] = useState<number | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal tab filtering & search
  const [selectedCategory, setSelectedCategory] = useState<string>('همه دسته‌ها');
  const [tabSearchTerm, setTabSearchTerm] = useState<string>('');

  // Form states for creating / editing user
  const [formData, setFormData] = useState<{
    username: string;
    name: string;
    password: string;
    level: UserLevel;
    role: UserRole;
    roleTitle: string;
    scope: UserScope;
    gradeLabel: string;
    isReadOnly: boolean;
    canEdit: boolean;
    allowedTabs: string[];
    editableTabs: string[];
    modulePermissions: Record<string, 'none' | 'view' | 'edit'>;
  }>({
    username: '',
    name: '',
    password: '8411924',
    level: 2,
    role: 'custom',
    roleTitle: 'کاربر سیستم',
    scope: 'all',
    gradeLabel: '',
    isReadOnly: false,
    canEdit: true,
    allowedTabs: ['todos', 'students', 'active-students', 'programs'],
    editableTabs: ['todos', 'students', 'active-students', 'programs'],
    modulePermissions: {},
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const getInitialPermissions = (user?: AppUser | null, role?: UserRole): Record<string, 'none' | 'view' | 'edit'> => {
    const perms: Record<string, 'none' | 'view' | 'edit'> = {};
    
    if (user?.modulePermissions && Object.keys(user.modulePermissions).length > 0) {
      ALL_SYSTEM_TABS.forEach(tab => {
        perms[tab.id] = user.modulePermissions?.[tab.id] || 'none';
      });
      return perms;
    }

    if (user?.allowedTabs) {
      ALL_SYSTEM_TABS.forEach(tab => {
        if (user.allowedTabs.includes(tab.id)) {
          perms[tab.id] = (user.editableTabs || []).includes(tab.id) && !user.isReadOnly ? 'edit' : 'view';
        } else {
          perms[tab.id] = 'none';
        }
      });
      return perms;
    }

    // Default template based on role
    ALL_SYSTEM_TABS.forEach(tab => {
      if (role === 'super_admin') {
        perms[tab.id] = 'edit';
      } else if (role === 'school_manager' || role === 'vice_principal') {
        perms[tab.id] = tab.id === 'user-management' ? 'none' : 'view';
      } else if (role === 'student' || role === 'class_representative') {
        const studentTabs = ['student-portal', 'student-meals', 'student-schedule', 'academic-calendar', 'discussion', 'attendance', 'stats', 'course-selection'];
        if (studentTabs.includes(tab.id)) {
          perms[tab.id] = (tab.id === 'student-portal' || tab.id === 'student-meals' || tab.id === 'attendance') ? 'edit' : 'view';
        } else {
          perms[tab.id] = 'none';
        }
      } else {
        // Standard staff defaults
        const basic = ['todos', 'workflow', 'academic-calendar', 'students', 'active-students', 'programs', 'classrooms', 'attendance', 'stats'];
        perms[tab.id] = basic.includes(tab.id) ? 'edit' : 'none';
      }
    });

    return perms;
  };

  const handleOpenCreate = () => {
    const initialPerms = getInitialPermissions(null, 'custom');
    const allowed = Object.entries(initialPerms).filter(([_, p]) => p !== 'none').map(([k]) => k);
    const editable = Object.entries(initialPerms).filter(([_, p]) => p === 'edit').map(([k]) => k);

    setFormData({
      username: '',
      name: '',
      password: '8411924',
      level: 2,
      role: 'custom',
      roleTitle: 'کاربر سیستم',
      scope: 'all',
      gradeLabel: '',
      isReadOnly: false,
      canEdit: true,
      allowedTabs: allowed,
      editableTabs: editable,
      modulePermissions: initialPerms,
    });
    setSelectedCategory('همه دسته‌ها');
    setTabSearchTerm('');
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (user: AppUser) => {
    setSelectedUser(user);
    const perms = getInitialPermissions(user, user.role);
    const allowed = Object.entries(perms).filter(([_, p]) => p !== 'none').map(([k]) => k);
    const editable = Object.entries(perms).filter(([_, p]) => p === 'edit').map(([k]) => k);

    setFormData({
      username: user.username,
      name: user.name,
      password: user.password || '8411924',
      level: user.level,
      role: user.role,
      roleTitle: user.roleTitle,
      scope: user.scope,
      gradeLabel: user.gradeLabel || '',
      isReadOnly: !!user.isReadOnly,
      canEdit: user.canEdit !== undefined ? user.canEdit : true,
      allowedTabs: allowed,
      editableTabs: editable,
      modulePermissions: perms,
    });
    setSelectedCategory('همه دسته‌ها');
    setTabSearchTerm('');
    setIsEditModalOpen(true);
  };

  const setTabPermission = (tabId: string, perm: 'none' | 'view' | 'edit') => {
    setFormData(prev => {
      const nextPerms = { ...prev.modulePermissions, [tabId]: perm };
      const nextAllowed = Object.entries(nextPerms)
        .filter(([_, p]) => p === 'view' || p === 'edit')
        .map(([k]) => k);
      const nextEditable = Object.entries(nextPerms)
        .filter(([_, p]) => p === 'edit')
        .map(([k]) => k);

      return {
        ...prev,
        modulePermissions: nextPerms,
        allowedTabs: nextAllowed,
        editableTabs: nextEditable,
      };
    });
  };

  const setAllTabsPermission = (perm: 'none' | 'view' | 'edit') => {
    setFormData(prev => {
      const nextPerms: Record<string, 'none' | 'view' | 'edit'> = {};
      ALL_SYSTEM_TABS.forEach(tab => {
        // Keep user-management restricted to super admin
        if (tab.id === 'user-management' && prev.level !== 1) {
          nextPerms[tab.id] = 'none';
        } else {
          nextPerms[tab.id] = perm;
        }
      });
      const nextAllowed = Object.entries(nextPerms)
        .filter(([_, p]) => p === 'view' || p === 'edit')
        .map(([k]) => k);
      const nextEditable = Object.entries(nextPerms)
        .filter(([_, p]) => p === 'edit')
        .map(([k]) => k);

      return {
        ...prev,
        modulePermissions: nextPerms,
        allowedTabs: nextAllowed,
        editableTabs: nextEditable,
      };
    });
  };

  const applyRoleDefaultTemplate = () => {
    const perms = getInitialPermissions(null, formData.role);
    const allowed = Object.entries(perms).filter(([_, p]) => p !== 'none').map(([k]) => k);
    const editable = Object.entries(perms).filter(([_, p]) => p === 'edit').map(([k]) => k);

    setFormData(prev => ({
      ...prev,
      modulePermissions: perms,
      allowedTabs: allowed,
      editableTabs: editable,
    }));
  };

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.name.trim()) return;

    const res = addUser({
      username: formData.username.trim().toUpperCase(),
      name: formData.name.trim(),
      password: formData.password.trim(),
      level: formData.level,
      role: formData.role,
      roleTitle: formData.roleTitle,
      scope: formData.scope,
      gradeLabel: formData.gradeLabel,
      isReadOnly: formData.isReadOnly,
      canEdit: formData.canEdit,
      allowedTabs: formData.allowedTabs,
      editableTabs: formData.editableTabs,
      modulePermissions: formData.modulePermissions,
      avatarBg: formData.level === 1 ? 'bg-indigo-700' : formData.level === 2 ? 'bg-amber-600' : 'bg-emerald-600',
    });

    if (res.success) {
      setIsCreateModalOpen(false);
      showToast(`کاربر جدید «${formData.name}» با دسترسی‌های تعیین‌شده ایجاد گردید.`);
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    updateUser(selectedUser.id, {
      username: formData.username.trim().toUpperCase(),
      name: formData.name.trim(),
      password: formData.password.trim(),
      level: formData.level,
      role: formData.role,
      roleTitle: formData.roleTitle,
      scope: formData.scope,
      gradeLabel: formData.gradeLabel,
      isReadOnly: formData.isReadOnly,
      canEdit: formData.canEdit,
      allowedTabs: formData.allowedTabs,
      editableTabs: formData.editableTabs,
      modulePermissions: formData.modulePermissions,
    });

    setIsEditModalOpen(false);
    setSelectedUser(null);
    showToast(`تنظیمات دسترسی و منوی کاربر «${formData.name}» با موفقیت ذخیره و فوراً اعمال گردید.`);
  };

  const filteredUsers = users.filter(u => {
    if (filterLevel !== 'all' && u.level !== filterLevel) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return u.name.toLowerCase().includes(term) || u.username.toLowerCase().includes(term) || u.roleTitle.toLowerCase().includes(term);
    }
    return true;
  });

  // Filter system tabs for modal display
  const filteredModalTabs = ALL_SYSTEM_TABS.filter(tab => {
    const matchesCategory = selectedCategory === 'همه دسته‌ها' || tab.group === selectedCategory;
    const matchesSearch = !tabSearchTerm.trim() || 
      tab.label.toLowerCase().includes(tabSearchTerm.toLowerCase()) || 
      (tab.description && tab.description.toLowerCase().includes(tabSearchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Permission counts for the modal
  const totalTabsCount = ALL_SYSTEM_TABS.length;
  const visibleTabsCount = Object.values(formData.modulePermissions).filter(p => p === 'view' || p === 'edit').length;
  const editableTabsCount = Object.values(formData.modulePermissions).filter(p => p === 'edit').length;
  const viewOnlyTabsCount = Object.values(formData.modulePermissions).filter(p => p === 'view').length;
  const hiddenTabsCount = totalTabsCount - visibleTabsCount;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-vazir" dir="rtl">
      
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-700 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 font-bold text-xs border border-emerald-500"
          >
            <CheckCircle2 size={18} className="text-emerald-200 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-600/20 shrink-0">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900">
                مدیریت جامع کاربران، سطوح و منوهای اختصاصی
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                پنل مدیریت سوپر ادمین جهت کنترل مستقل «نمایش در منو» و «مجوز ویرایش» برای هر بخش به صورت مجزا
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
          <button
            onClick={() => {
              if (window.confirm('آیا از بازنشانی تمامی کاربران به مقادیر پیش‌فرض اطمینان دارید؟')) {
                resetDefaultUsers();
                showToast('کاربران به تنظیمات پیش‌فرض بازگردانی شدند.');
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer"
            title="بازنشانی اکانت‌ها به تنظیمات پیش‌فرض کاربری"
          >
            <RotateCcw size={14} />
            <span>بازنشانی اکانت‌های پیش‌فرض</span>
          </button>
          
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-2xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <UserPlus size={16} />
            <span>تعریف کاربر جدید</span>
          </button>
        </div>
      </div>

      {/* Overview Stats for 3 Levels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-indigo-50/80 to-white p-4 rounded-3xl border border-indigo-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-indigo-900">سطح ۱: مدیریت ارشد</span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
              {users.filter(u => u.level === 1).length} کاربر
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
            سوپر ادمین با دسترسی کامل سیستمی و مدیر مدرسه با امکان مشاهده تمام بخش‌ها.
          </p>
        </div>

        <div className="bg-gradient-to-br from-amber-50/80 to-white p-4 rounded-3xl border border-amber-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-amber-900">سطح ۲: کادر اجرایی و اساتید</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-bold">
              {users.filter(u => u.level === 2).length} کاربر
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
            مسئول آموزش، اساتید مسئول پایه‌های ۷ تا ۱۰، مسئول پژوهش و مسئول مالی.
          </p>
        </div>

        <div className="bg-gradient-to-br from-emerald-50/80 to-white p-4 rounded-3xl border border-emerald-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-emerald-900">سطح ۳: طلاب و نمایندگان</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
              {users.filter(u => u.level === 3).length} کاربر
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
            پرتال اختصاصی طلاب و نماینده‌های کلاس با دسترسی به برنامه، حضور و غیاب و مطالعه.
          </p>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-500">فیلتر سطح:</span>
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setFilterLevel('all')}
              className={cn("px-3 py-1 rounded-lg transition-all", filterLevel === 'all' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500")}
            >
              همه ({users.length})
            </button>
            <button
              onClick={() => setFilterLevel(1)}
              className={cn("px-3 py-1 rounded-lg transition-all", filterLevel === 1 ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500")}
            >
              سطح ۱
            </button>
            <button
              onClick={() => setFilterLevel(2)}
              className={cn("px-3 py-1 rounded-lg transition-all", filterLevel === 2 ? "bg-white text-amber-700 shadow-xs" : "text-slate-500")}
            >
              سطح ۲
            </button>
            <button
              onClick={() => setFilterLevel(3)}
              className={cn("px-3 py-1 rounded-lg transition-all", filterLevel === 3 ? "bg-white text-emerald-700 shadow-xs" : "text-slate-500")}
            >
              سطح ۳
            </button>
          </div>
        </div>

        <div className="w-full sm:w-64">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجوی نام یا نام کاربری..."
              className="w-full pr-8 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500"
            />
            <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold">
                <th className="py-3.5 px-4">کاربر</th>
                <th className="py-3.5 px-4">نام کاربری</th>
                <th className="py-3.5 px-4">رمز عبور</th>
                <th className="py-3.5 px-4">سطح و نقش</th>
                <th className="py-3.5 px-4">محدوده (Scope)</th>
                <th className="py-3.5 px-4">نمایش در منو (Visibility)</th>
                <th className="py-3.5 px-4">مجوز ویرایش (Editability)</th>
                <th className="py-3.5 px-4 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const isCurrent = currentUser?.id === user.id || currentUser?.username?.toUpperCase() === user.username?.toUpperCase();
                
                // Calculate actual visible and editable count
                let visibleCount = 0;
                let editCount = 0;
                if (user.role === 'super_admin') {
                  visibleCount = ALL_SYSTEM_TABS.length;
                  editCount = ALL_SYSTEM_TABS.length;
                } else if (user.modulePermissions && Object.keys(user.modulePermissions).length > 0) {
                  visibleCount = Object.values(user.modulePermissions).filter(p => p === 'view' || p === 'edit').length;
                  editCount = Object.values(user.modulePermissions).filter(p => p === 'edit').length;
                } else {
                  visibleCount = (user.allowedTabs || []).length;
                  editCount = (user.editableTabs || []).length;
                }

                return (
                  <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div className={cn("w-8 h-8 rounded-xl text-white font-black flex items-center justify-center text-xs shadow-xs", user.avatarBg || 'bg-slate-600')}>
                          {(user.name || user.username || 'ک')[0]}
                        </div>
                        <div>
                          <span>{user.name}</span>
                          {isCurrent && (
                            <span className="mr-1.5 px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                              شما
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-700" dir="ltr">
                      {user.username}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-600" dir="ltr">
                      {user.password || '••••••'}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className={cn(
                          "inline-flex items-center w-max px-2 py-0.5 rounded-full text-[10px] font-black border",
                          user.level === 1 ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                          user.level === 2 ? "bg-amber-50 text-amber-800 border-amber-200" :
                          "bg-emerald-50 text-emerald-800 border-emerald-200"
                        )}>
                          سطح {user.level} • {user.roleTitle}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {user.scope === 'all' ? 'کل سیستم / کل پایه‌ها' :
                       user.scope === 'grade_7' ? 'اختصاصی پایه ۷' :
                       user.scope === 'grade_8' ? 'اختصاصی پایه ۸' :
                       user.scope === 'grade_9' ? 'اختصاصی پایه ۹' :
                       user.scope === 'grade_10' ? 'اختصاصی پایه ۱۰' :
                       user.scope === 'class' ? 'کلاس مربوطه' : 'شخصی (طلبه)'}
                    </td>

                    {/* Visibility status */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-lg bg-sky-50 text-sky-800 text-[11px] font-bold border border-sky-200">
                          {visibleCount} از {ALL_SYSTEM_TABS.length} بخش
                        </span>
                      </div>
                    </td>

                    {/* Editability status */}
                    <td className="py-3.5 px-4">
                      {user.isReadOnly ? (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold border border-slate-200">
                          فقط مشاهده (بدون ویرایش)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold border border-emerald-200">
                          {editCount} بخش با ویرایش
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(user)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          title="تنظیم منوها و سطوح دسترسی این کاربر"
                        >
                          <Edit3 size={13} />
                          <span>تنظیم دسترسی</span>
                        </button>
                        
                        {user.role !== 'super_admin' && (
                          <button
                            onClick={() => {
                              if (window.confirm(`آیا از حذف کاربر «${user.name}» اطمینان دارید؟`)) {
                                deleteUser(user.id);
                                showToast(`کاربر «${user.name}» حذف گردید.`);
                              }
                            }}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="حذف کاربر"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create / Edit User with dynamic Menu/Tab permissions */}
      <AnimatePresence>
        {(isCreateModalOpen || isEditModalOpen) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/50 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-5 sm:p-7 max-w-4xl w-full border border-slate-200 shadow-2xl space-y-5 my-6 max-h-[92vh] overflow-y-auto custom-scrollbar"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-600/20 shrink-0">
                    {isEditModalOpen ? <Edit3 size={20} /> : <UserPlus size={20} />}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      {isEditModalOpen ? `تنظیم اختصاصی منو و دسترسی‌های کاربر: ${selectedUser?.name}` : 'تعریف کاربر جدید با تنظیمات اختصاصی منو'}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      تعیین دقیق اینکه کاربر کدام بخش‌ها را در منو ببیند و در هر بخش مجاز، اجازه ویرایش داشته باشد یا فقط مشاهده
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
                >
                  <XCircle size={22} />
                </button>
              </div>

              <form onSubmit={isEditModalOpen ? handleSaveEdit : handleSaveCreate} className="space-y-5">
                
                {/* User Basic Info Form */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      نام کامل / عنوان نمایشی
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="مثال: استاد حسینی"
                      required
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      نام کاربری (انگلیسی)
                    </label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="مثال: HOSSEINI"
                      required
                      dir="ltr"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500 text-right uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      رمز عبور
                    </label>
                    <input
                      type="text"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="8411924"
                      required
                      dir="ltr"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500 text-right"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      نقش و مسئولیت کاربر
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => {
                        const newRole = e.target.value as UserRole;
                        let newLevel: UserLevel = formData.level;
                        let newRoleTitle = formData.roleTitle;
                        let newScope = formData.scope;
                        let newGradeLabel = formData.gradeLabel;
                        let newReadOnly = formData.isReadOnly;

                        switch (newRole) {
                          case 'super_admin':
                            newLevel = 1;
                            newRoleTitle = 'سوپر ادمین';
                            newScope = 'all';
                            newGradeLabel = '';
                            newReadOnly = false;
                            break;
                          case 'school_manager':
                          case 'manager_principal':
                            newLevel = 1;
                            newRoleTitle = 'مدیر مدرسه';
                            newScope = 'all';
                            newGradeLabel = '';
                            newReadOnly = true;
                            break;
                          case 'vice_principal':
                            newLevel = 1;
                            newRoleTitle = 'معاون مدرسه';
                            newScope = 'all';
                            newGradeLabel = '';
                            newReadOnly = true;
                            break;
                          case 'education_manager':
                          case 'education_officer':
                            newLevel = 2;
                            newRoleTitle = 'مسئول آموزش';
                            newScope = 'all';
                            newGradeLabel = '';
                            newReadOnly = false;
                            break;
                          case 'grade_supervisor_7':
                            newLevel = 2;
                            newRoleTitle = 'مسئول پایه ۷';
                            newScope = 'grade_7';
                            newGradeLabel = 'پایه ۷';
                            newReadOnly = false;
                            break;
                          case 'grade_supervisor_8':
                            newLevel = 2;
                            newRoleTitle = 'مسئول پایه ۸';
                            newScope = 'grade_8';
                            newGradeLabel = 'پایه ۸';
                            newReadOnly = false;
                            break;
                          case 'grade_supervisor_9':
                            newLevel = 2;
                            newRoleTitle = 'مسئول پایه ۹';
                            newScope = 'grade_9';
                            newGradeLabel = 'پایه ۹';
                            newReadOnly = false;
                            break;
                          case 'grade_supervisor_10':
                            newLevel = 2;
                            newRoleTitle = 'مسئول پایه ۱۰';
                            newScope = 'grade_10';
                            newGradeLabel = 'پایه ۱۰';
                            newReadOnly = false;
                            break;
                          case 'research_manager':
                          case 'research_officer':
                            newLevel = 2;
                            newRoleTitle = 'مسئول پژوهش';
                            newScope = 'all';
                            newGradeLabel = '';
                            newReadOnly = false;
                            break;
                          case 'finance_manager':
                          case 'financial_officer':
                            newLevel = 2;
                            newRoleTitle = 'مسئول مالی';
                            newScope = 'all';
                            newGradeLabel = '';
                            newReadOnly = false;
                            break;
                          case 'class_representative':
                            newLevel = 3;
                            newRoleTitle = 'نماینده کلاس';
                            newScope = 'class';
                            newReadOnly = false;
                            break;
                          case 'student':
                            newLevel = 3;
                            newRoleTitle = 'طلبه';
                            newScope = 'self';
                            newReadOnly = false;
                            break;
                          default:
                            newRoleTitle = formData.roleTitle || 'کاربر سیستم';
                            break;
                        }

                        setFormData(prev => ({
                          ...prev,
                          role: newRole,
                          level: newLevel,
                          roleTitle: newRoleTitle,
                          scope: newScope,
                          gradeLabel: newGradeLabel,
                          isReadOnly: newReadOnly,
                          canEdit: !newReadOnly
                        }));
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <optgroup label="سطح ۱ - مدیریت ارشد">
                        <option value="super_admin">سوپر ادمین (دسترسی کامل)</option>
                        <option value="school_manager">مدیر مدرسه (مشاهده کل)</option>
                        <option value="vice_principal">معاون مدرسه (مشاهده کل)</option>
                      </optgroup>
                      <optgroup label="سطح ۲ - مسئول آموزش و مسئولین پایه‌ها">
                        <option value="education_manager">مسئول آموزش</option>
                        <option value="grade_supervisor_7">مسئول پایه ۷</option>
                        <option value="grade_supervisor_8">مسئول پایه ۸</option>
                        <option value="grade_supervisor_9">مسئول پایه ۹</option>
                        <option value="grade_supervisor_10">مسئول پایه ۱۰</option>
                        <option value="research_manager">مسئول پژوهش</option>
                        <option value="finance_manager">مسئول مالی</option>
                      </optgroup>
                      <optgroup label="سطح ۳ - طلاب و نمایندگان">
                        <option value="class_representative">نماینده کلاس</option>
                        <option value="student">طلبه / دانشجو</option>
                      </optgroup>
                      <optgroup label="سایر">
                        <option value="custom">نقش سفارشی</option>
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      سطح کاربری
                    </label>
                    <select
                      value={formData.level}
                      onChange={(e) => setFormData({ ...formData, level: Number(e.target.value) as UserLevel })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value={1}>سطح ۱ (مدیریت کلان / سوپر ادمین / مدیر مدرسه)</option>
                      <option value={2}>سطح ۲ (مسئول آموزش / مسئولین پایه‌های ۷ تا ۱۰ / پژوهش / مالی)</option>
                      <option value={3}>سطح ۳ (طلاب / نمایندگان کلاس)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      محدوده دسترسی اطلاعات (Scope)
                    </label>
                    <select
                      value={formData.scope}
                      onChange={(e) => setFormData({ ...formData, scope: e.target.value as UserScope })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="all">تمام طلاب و بخش‌ها (عمومی)</option>
                      <option value="grade_7">فقط پایه ۷</option>
                      <option value="grade_8">فقط پایه ۸</option>
                      <option value="grade_9">فقط پایه ۹</option>
                      <option value="grade_10">فقط پایه ۱۰</option>
                      <option value="class">کلاس مربوطه (نماینده)</option>
                      <option value="self">فقط اطلاعات شخصی (طلبه)</option>
                    </select>
                  </div>
                </div>

                {/* Global Read-Only Switch */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800">حالت فقط مشاهده عمومی (Global Read-Only):</span>
                    <p className="text-[10px] text-slate-500">اگر فعال باشد، کاربر در تمامی بخش‌ها حتی در صورت داشتن دسترسی، فقط مشاهده‌کننده خواهد بود.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.isReadOnly}
                    onChange={(e) => setFormData({ ...formData, isReadOnly: e.target.checked, canEdit: !e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                  />
                </div>

                {/* GRANULAR PER-MODULE PERMISSION CONTROL */}
                <div className="space-y-3 pt-1">
                  
                  {/* Permissions Header & Quick Controls */}
                  <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-amber-300">
                          مدیریت مستقل نمایش در منو (Visibility) و مجوز ویرایش (Editability)
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 border border-slate-700">
                          {totalTabsCount} بخش سیستمی
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-300 mt-1 flex-wrap">
                        <span>فعال در منو: <b className="text-sky-300">{visibleTabsCount} بخش</b></span>
                        <span>•</span>
                        <span>دارای مجوز ویرایش: <b className="text-emerald-400">{editableTabsCount} بخش</b></span>
                        <span>•</span>
                        <span>فقط مشاهده: <b className="text-amber-300">{viewOnlyTabsCount} بخش</b></span>
                        <span>•</span>
                        <span>مخفی از منو: <b className="text-rose-400">{hiddenTabsCount} بخش</b></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setAllTabsPermission('edit')}
                        className="px-2.5 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                        title="دادن مجوز ویرایش به تمام ۳۹ بخش"
                      >
                        همه: ویرایش ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllTabsPermission('view')}
                        className="px-2.5 py-1.5 bg-sky-600/30 hover:bg-sky-600/50 text-sky-300 border border-sky-500/40 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                        title="تنظیم تمام بخش‌ها به فقط مشاهده"
                      >
                        همه: فقط مشاهده 👁️
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllTabsPermission('none')}
                        className="px-2.5 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/40 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                        title="مخفی‌سازی کامل تمام بخش‌ها از منوی کاربر"
                      >
                        همه: مخفی 🚫
                      </button>
                      <button
                        type="button"
                        onClick={applyRoleDefaultTemplate}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                        title="بارگذاری الگو و دسترسی‌های پیش‌فرض این نقش"
                      >
                        <RotateCcw size={12} />
                        <span>پیش‌فرض نقش</span>
                      </button>
                    </div>
                  </div>

                  {/* Filter Categories and Tab Search */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
                    <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 custom-scrollbar text-[11px]">
                      {TAB_CATEGORIES.map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={cn(
                            "px-2.5 py-1 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer",
                            selectedCategory === cat
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    <div className="w-full sm:w-48 shrink-0">
                      <input
                        type="text"
                        value={tabSearchTerm}
                        onChange={(e) => setTabSearchTerm(e.target.value)}
                        placeholder="جستجوی بخش..."
                        className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* MODULES LIST WITH 3-STATE SEGMENTED CONTROLS */}
                  <div className="space-y-2 max-h-72 overflow-y-auto p-2.5 bg-slate-50 rounded-2xl border border-slate-200 custom-scrollbar">
                    {filteredModalTabs.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs font-bold">
                        بخشی با این مشخصات یافت نشد.
                      </div>
                    ) : (
                      filteredModalTabs.map(tab => {
                        const currentPerm = formData.modulePermissions[tab.id] || 'none';
                        const isVisible = currentPerm === 'view' || currentPerm === 'edit';
                        const isEditable = currentPerm === 'edit';

                        return (
                          <div
                            key={tab.id}
                            className={cn(
                              "flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl text-xs transition-all border gap-2",
                              currentPerm === 'edit'
                                ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                                : currentPerm === 'view'
                                ? "bg-sky-50/70 border-sky-200 text-sky-950"
                                : "bg-white border-slate-200 text-slate-500"
                            )}
                          >
                            {/* Left: Tab Label & Details */}
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={cn(
                                "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-white font-bold",
                                currentPerm === 'edit' ? "bg-emerald-600" :
                                currentPerm === 'view' ? "bg-sky-600" : "bg-slate-300"
                              )}>
                                {currentPerm === 'edit' ? <Edit3 size={13} /> :
                                 currentPerm === 'view' ? <Eye size={13} /> : <Ban size={13} />}
                              </div>

                              <div className="truncate">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 text-xs truncate">
                                    {tab.label}
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-600 text-[9px] font-bold shrink-0">
                                    {tab.group}
                                  </span>
                                </div>
                                {tab.description && (
                                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                    {tab.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Right: 3-Way Segmented Control */}
                            <div className="flex items-center self-end sm:self-center bg-slate-200/70 p-0.5 rounded-xl shrink-0">
                              {/* Option 1: None (Hidden) */}
                              <button
                                type="button"
                                onClick={() => setTabPermission(tab.id, 'none')}
                                className={cn(
                                  "px-2.5 py-1 text-[11px] rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1",
                                  currentPerm === 'none'
                                    ? "bg-rose-600 text-white shadow-xs"
                                    : "text-slate-600 hover:text-slate-900"
                                )}
                                title="مخفی‌سازی کامل از منو و سلب دسترسی"
                              >
                                <Ban size={11} />
                                <span>مخفی 🚫</span>
                              </button>

                              {/* Option 2: View Only */}
                              <button
                                type="button"
                                onClick={() => setTabPermission(tab.id, 'view')}
                                className={cn(
                                  "px-2.5 py-1 text-[11px] rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1",
                                  currentPerm === 'view'
                                    ? "bg-sky-600 text-white shadow-xs"
                                    : "text-slate-600 hover:text-slate-900"
                                )}
                                title="نمایش در منو به عنوان فقط مشاهده (غیرقابل ویرایش)"
                              >
                                <Eye size={11} />
                                <span>فقط مشاهده 👁️</span>
                              </button>

                              {/* Option 3: Edit & View */}
                              <button
                                type="button"
                                onClick={() => setTabPermission(tab.id, 'edit')}
                                className={cn(
                                  "px-2.5 py-1 text-[11px] rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1",
                                  currentPerm === 'edit'
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "text-slate-600 hover:text-slate-900"
                                )}
                                title="نمایش در منو همراه با دسترسی کامل به ویرایش، ایجاد و حذف داده"
                              >
                                <Edit3 size={11} />
                                <span>مشاهده و ویرایش ✏️</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Form Footer Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="text-[11px] text-slate-500 font-medium">
                    {visibleTabsCount} بخش در منوی کاربر نمایش داده خواهد شد ({editableTabsCount} بخش با ویرایش).
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreateModalOpen(false);
                        setIsEditModalOpen(false);
                      }}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Check size={16} />
                      <span>{isEditModalOpen ? 'ذخیره و اعمال قطعی دسترسی‌ها' : 'افزودن کاربر و ذخیره دسترسی‌ها'}</span>
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
