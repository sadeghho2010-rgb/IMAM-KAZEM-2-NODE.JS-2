import React, { useState } from 'react';
import { useAuth, ALL_SYSTEM_TABS } from '../../context/AuthContext';
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
  AlertTriangle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function UserManagementSettings() {
  const { users, currentUser, addUser, updateUser, deleteUser, resetDefaultUsers } = useAuth();
  
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [filterLevel, setFilterLevel] = useState<number | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

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
  });

  const handleOpenCreate = () => {
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
      allowedTabs: ['todos', 'students', 'active-students', 'programs'],
    });
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (user: AppUser) => {
    setSelectedUser(user);
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
      allowedTabs: [...(user.allowedTabs || [])],
    });
    setIsEditModalOpen(true);
  };

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.name.trim()) return;

    addUser({
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
      avatarBg: formData.level === 1 ? 'bg-indigo-700' : formData.level === 2 ? 'bg-amber-600' : 'bg-emerald-600',
    });

    setIsCreateModalOpen(false);
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
    });

    setIsEditModalOpen(false);
    setSelectedUser(null);
  };

  const toggleTabPermission = (tabId: string) => {
    setFormData(prev => {
      const exists = prev.allowedTabs.includes(tabId);
      if (exists) {
        return { ...prev, allowedTabs: prev.allowedTabs.filter(t => t !== tabId) };
      } else {
        return { ...prev, allowedTabs: [...prev.allowedTabs, tabId] };
      }
    });
  };

  const selectAllTabs = () => {
    setFormData(prev => ({ ...prev, allowedTabs: ALL_SYSTEM_TABS.map(t => t.id) }));
  };

  const clearAllTabs = () => {
    setFormData(prev => ({ ...prev, allowedTabs: [] }));
  };

  const filteredUsers = users.filter(u => {
    if (filterLevel !== 'all' && u.level !== filterLevel) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return u.name.toLowerCase().includes(term) || u.username.toLowerCase().includes(term) || u.roleTitle.toLowerCase().includes(term);
    }
    return true;
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-600/20">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900">
                مدیریت جامع کاربران، نقش‌ها و سطوح دسترسی
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                پنل مدیریت اختصاصی سوپر ادمین جهت تعریف، ویرایش و کنترل منوها و مجوزهای ۳ سطح کاربری
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
          <button
            onClick={resetDefaultUsers}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all"
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
        <div className="bg-gradient-to-br from-indigo-50 to-white p-4 rounded-3xl border border-indigo-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-indigo-900">سطح ۱: مدیریت ارشد</span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
              {users.filter(u => u.level === 1).length} کاربر
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            سوپر ادمین با دسترسی کامل سیستمی و مدیر مدرسه با امکان مشاهده تمام بخش‌ها.
          </p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-white p-4 rounded-3xl border border-amber-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-amber-900">سطح ۲: کادر اجرایی و اساتید</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-bold">
              {users.filter(u => u.level === 2).length} کاربر
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            مسئول آموزش، اساتید مسئول پایه‌های ۷ تا ۱۰، مسئول پژوهش و مسئول مالی.
          </p>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-3xl border border-emerald-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-emerald-900">سطح ۳: طلاب و نمایندگان</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
              {users.filter(u => u.level === 3).length} کاربر
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
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
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجوی نام یا کاربری..."
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500"
          />
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
                <th className="py-3.5 px-4">وضعیت دسترسی</th>
                <th className="py-3.5 px-4">تعداد منوهای مجاز</th>
                <th className="py-3.5 px-4 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const isCurrent = currentUser?.id === user.id;
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

                    <td className="py-3.5 px-4">
                      {user.isReadOnly ? (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold">
                          فقط مشاهده (بدون ویرایش)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold">
                          مشاهده و ویرایش
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-slate-700">
                      {user.role === 'super_admin' ? 'همه بخش‌ها (کامل)' : `${(user.allowedTabs || []).length} بخش`}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(user)}
                          className="p-1.5 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg transition-colors"
                          title="ویرایش کاربر و مجوزهای دسترسی"
                        >
                          <Edit3 size={15} />
                        </button>
                        
                        {user.role !== 'super_admin' && (
                          <button
                            onClick={() => {
                              if (window.confirm(`آیا از حذف کاربر «${user.name}» اطمینان دارید؟`)) {
                                deleteUser(user.id);
                              }
                            }}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full border border-slate-200 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    {isEditModalOpen ? <Edit3 size={18} /> : <UserPlus size={18} />}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      {isEditModalOpen ? `ویرایش کاربر و دسترسی‌ها: ${selectedUser?.name}` : 'تعریف کاربر جدید در سامانه'}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      تعیین نام کاربری، رمز عبور، سطح کاربری، نقش و مجوزهای فعال منو
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <form onSubmit={isEditModalOpen ? handleSaveEdit : handleSaveCreate} className="space-y-4">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500"
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
                      placeholder="مثال: HOSSEINI یا HO"
                      required
                      dir="ltr"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500 text-right uppercase"
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
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500 text-right"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      عنوان نقش نمایشی
                    </label>
                    <input
                      type="text"
                      value={formData.roleTitle}
                      onChange={(e) => setFormData({ ...formData, roleTitle: e.target.value })}
                      placeholder="مثال: مسئول پایه ۸"
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      سطح کاربری
                    </label>
                    <select
                      value={formData.level}
                      onChange={(e) => setFormData({ ...formData, level: Number(e.target.value) as UserLevel })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500"
                    >
                      <option value={1}>سطح ۱ (مدیریت کلان / سوپر ادمین / مدیر مدرسه)</option>
                      <option value={2}>سطح ۲ (مسئول آموزش / مسئولین پایه‌ها / پژوهش / مالی)</option>
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
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500"
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

                {/* Read-Only Option */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800">حالت فقط مشاهده (بدون دسترسی به ویرایش و حذف):</span>
                    <p className="text-[10px] text-slate-500">کاربر فقط می‌تواند بخش‌های مجاز را ببیند اما نمی‌تواند دیتایی اضافه یا ویرایش کند.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.isReadOnly}
                    onChange={(e) => setFormData({ ...formData, isReadOnly: e.target.checked, canEdit: !e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                </div>

                {/* Allowed Menu Tabs Selection */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-800">
                      بخش‌های مجاز منوی کاربری (Permissions):
                    </label>
                    <div className="flex gap-2 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={selectAllTabs}
                        className="text-indigo-600 hover:underline"
                      >
                        انتخاب همه
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={clearAllTabs}
                        className="text-rose-600 hover:underline"
                      >
                        حذف همه
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200 custom-scrollbar">
                    {ALL_SYSTEM_TABS.map(tab => {
                      const isChecked = formData.allowedTabs.includes(tab.id);
                      return (
                        <label
                          key={tab.id}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-xl text-xs font-bold cursor-pointer transition-all border",
                            isChecked ? "bg-indigo-50 border-indigo-200 text-indigo-900" : "bg-white border-slate-200/80 text-slate-600 hover:bg-slate-100"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleTabPermission(tab.id)}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                          />
                          <span>{tab.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setIsEditModalOpen(false);
                    }}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                  >
                    {isEditModalOpen ? 'ذخیره تغییرات' : 'افزودن کاربر به سیستم'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
