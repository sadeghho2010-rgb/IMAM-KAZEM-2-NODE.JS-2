import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AppModuleId } from '../types';
import { AppUser, UserLevel, UserRole, UserScope } from '../types/auth';
import { 
  ShieldCheck, 
  UserPlus, 
  Users, 
  KeyRound, 
  Trash2, 
  Edit, 
  Check, 
  X, 
  Lock, 
  Layers, 
  Eye, 
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  Save,
  GraduationCap
} from 'lucide-react';
import { cn } from '../lib/utils';

const ALL_MODULES: { id: AppModuleId; label: string; group: string }[] = [
  { id: 'todos', label: 'پیگیری‌ها', group: 'عمومی و اداری' },
  { id: 'academic-calendar', label: 'تقویم آموزشی', group: 'آموزش' },
  { id: 'presence-hours', label: 'ساعت حضور و کارکرد', group: 'اداری و پرسنلی' },
  { id: 'students', label: 'مدیریت کل طلاب', group: 'آموزش' },
  { id: 'active-students', label: 'طلاب فعال', group: 'آموزش' },
  { id: 'programs', label: 'برنامه‌های آموزشی و سرفصل‌ها', group: 'آموزش' },
  { id: 'student-schedule', label: 'برنامه درسی و هفتگی طلاب', group: 'آموزش' },
  { id: 'stats', label: 'آمار و گزارشات مطالعه', group: 'آموزش و پژوهش' },
  { id: 'discussion', label: 'بخش مباحثات', group: 'آموزش' },
  { id: 'research', label: 'بخش پژوهش و مقالات', group: 'پژوهش' },
  { id: 'attendance', label: 'حضور و غیاب', group: 'انضباطی و آموزشی' },
  { id: 'oral-exams', label: 'آزمون شفاهی', group: 'ارزیابی' },
  { id: 'comments', label: 'نظرات و ارزیابی تربیتی', group: 'تربیتی' },
  { id: 'summary', label: 'جمع‌بندی و هوش مصنوعی', group: 'تحلیل و BI' },
  { id: 'teachers-bank', label: 'بانک اساتید و مدرسین', group: 'آموزش' },
  { id: 'manager-files', label: 'ارسال و دریافت فایل‌ها', group: 'اسناد' },
  { id: 'backup', label: 'پشتیبان‌گیری دیتابیس', group: 'سیستم' },
  { id: 'user-management', label: 'مدیریت کاربران و دسترسی‌ها', group: 'امنیت و تنظیمات' },
];

export default function UserManagement() {
  const { 
    currentUser, 
    users, 
    addUser, 
    updateUser, 
    deleteUser, 
    toggleUserActive, 
    resetToDefaultUsers 
  } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState<'all' | '1' | '2' | '3'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  // Form State
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('8411924');
  const [formFullName, setFormFullName] = useState('');
  const [formLevel, setFormLevel] = useState<UserLevel>(2);
  const [formRole, setFormRole] = useState<UserRole>('education_officer');
  const [formRoleTitle, setFormRoleTitle] = useState('مسئول آموزش');
  const [formScope, setFormScope] = useState<UserScope>('global');
  const [formGradeLabel, setFormGradeLabel] = useState('کل پایه‌ها');
  const [formIsReadOnly, setFormIsReadOnly] = useState(false);
  const [formAllowedModules, setFormAllowedModules] = useState<AppModuleId[]>([
    'todos', 'students', 'active-students', 'programs', 'attendance', 'stats', 'discussion'
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = () => {
    setFormUsername('');
    setFormPassword('8411924');
    setFormFullName('');
    setFormLevel(2);
    setFormRole('education_officer');
    setFormRoleTitle('مسئول آموزش');
    setFormScope('global');
    setFormGradeLabel('کل پایه‌ها');
    setFormIsReadOnly(false);
    setFormAllowedModules([
      'todos', 'students', 'active-students', 'programs', 'attendance', 'stats', 'discussion'
    ]);
    setFormError(null);
  };

  const openCreateModal = () => {
    resetForm();
    setEditingUser(null);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (user: AppUser) => {
    setEditingUser(user);
    setFormUsername(user.username);
    setFormPassword(user.password || '');
    setFormFullName(user.fullName);
    setFormLevel(user.level);
    setFormRole(user.role);
    setFormRoleTitle(user.roleTitle);
    setFormScope(user.scope);
    setFormGradeLabel(user.gradeLabel || 'کل پایه‌ها');
    setFormIsReadOnly(user.isReadOnly || false);
    setFormAllowedModules((user.allowedModules as AppModuleId[]) || (user.allowedTabs as AppModuleId[]) || []);
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleToggleModulePermission = (modId: AppModuleId) => {
    setFormAllowedModules(prev => 
      prev.includes(modId) ? prev.filter(m => m !== modId) : [...prev, modId]
    );
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formUsername.trim()) {
      setFormError('نام کاربری نمی‌تواند خالی باشد.');
      return;
    }
    if (!formPassword.trim()) {
      setFormError('رمز عبور الزامی است.');
      return;
    }
    if (!formFullName.trim()) {
      setFormError('نام و نام خانوادگی الزامی است.');
      return;
    }

    if (editingUser) {
      // Update
      updateUser(editingUser.id, {
        username: formUsername.trim().toUpperCase(),
        password: formPassword.trim(),
        fullName: formFullName.trim(),
        level: formLevel,
        role: formRole,
        roleTitle: formRoleTitle,
        scope: formScope,
        gradeLabel: formGradeLabel,
        isReadOnly: formIsReadOnly,
        allowedModules: formAllowedModules,
      });
      setIsCreateModalOpen(false);
      setEditingUser(null);
    } else {
      // Create
      const res = addUser({
        username: formUsername.trim().toUpperCase(),
        password: formPassword.trim(),
        fullName: formFullName.trim(),
        level: formLevel,
        role: formRole,
        roleTitle: formRoleTitle,
        scope: formScope,
        gradeLabel: formGradeLabel,
        isReadOnly: formIsReadOnly,
        isActive: true,
        allowedModules: formAllowedModules,
        avatarBg: formLevel === 1 ? 'bg-indigo-600' : formLevel === 2 ? 'bg-emerald-600' : 'bg-cyan-600',
      });

      if (res.success) {
        setIsCreateModalOpen(false);
        resetForm();
      } else {
        setFormError(res.error || 'خطا در ثبت کاربر');
      }
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.roleTitle.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLevel = filterLevel === 'all' || u.level === parseInt(filterLevel);

    return matchesSearch && matchesLevel;
  });

  return (
    <div className="space-y-6 font-vazir" dir="rtl">
      {/* Page Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 shrink-0">
            <ShieldCheck size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-800">مدیریت کاربران و دسترسی‌ها</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200">
                سطح ۱ • سوپر ادمین
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              تعریف حساب‌های کاربری، تعیین سطوح سه‌گانه، نقش‌ها، مجوزهای ماژولار و بازنشانی رمز عبور
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={resetToDefaultUsers}
            className="flex-1 md:flex-initial px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            title="بازگردانی تمامی کاربران پیش‌فرض تعریف شده در SRS"
          >
            <RotateCcw size={15} />
            <span>بازنشانی به پیش‌فرض SRS</span>
          </button>

          <button
            onClick={openCreateModal}
            className="flex-1 md:flex-initial px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-1.5"
          >
            <UserPlus size={16} />
            <span>تعریف کاربر جدید</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400">کل کاربران سامانه</span>
            <p className="text-2xl font-black text-slate-800 mt-1">{users.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-indigo-500">کاربران سطح ۱ (ستاد و مدیران)</span>
            <p className="text-2xl font-black text-indigo-700 mt-1">
              {users.filter(u => u.level === 1).length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ShieldCheck size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-600">کاربران سطح ۲ (مسئولین و اساتید)</span>
            <p className="text-2xl font-black text-emerald-700 mt-1">
              {users.filter(u => u.level === 2).length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <GraduationCap size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-cyan-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-cyan-600">کاربران سطح ۳ (طلاب و نمایندگان)</span>
            <p className="text-2xl font-black text-cyan-700 mt-1">
              {users.filter(u => u.level === 3).length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
            <Layers size={20} />
          </div>
        </div>
      </div>

      {/* Users Table & Filters */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجو با نام، نام کاربری یا نقش..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-2xl pr-10 pl-4 py-2 text-xs font-medium transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs text-slate-400 font-bold ml-1 shrink-0">فیلتر سطح:</span>
            {(['all', '1', '2', '3'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0",
                  filterLevel === lvl 
                    ? "bg-slate-900 text-white shadow-xs" 
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {lvl === 'all' ? 'همه سطوح' : `سطح ${lvl}`}
              </button>
            ))}
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">کاربر و نام کاربری</th>
                <th className="py-3.5 px-4">سطح و نقش</th>
                <th className="py-3.5 px-4">حوزه دسترسی (Scope)</th>
                <th className="py-3.5 px-4">نوع دسترسی</th>
                <th className="py-3.5 px-4">وضعیت</th>
                <th className="py-3.5 px-4 sm:px-6 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => {
                const isSuper = u.username.toUpperCase() === 'SADEGH';
                const isSelf = currentUser?.id === u.id;

                return (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-9 h-9 rounded-xl text-white font-black flex items-center justify-center text-xs shrink-0 shadow-xs", u.avatarBg || 'bg-slate-600')}>
                          {u.username[0]}
                        </div>
                        <div>
                          <div className="font-black text-slate-800 flex items-center gap-1.5">
                            <span>{u.fullName}</span>
                            {isSuper && <ShieldCheck size={14} className="text-amber-500" />}
                          </div>
                          <div className="text-[11px] font-mono text-indigo-600 font-bold">
                            @{u.username}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold w-fit",
                          u.level === 1 ? "bg-indigo-50 text-indigo-700 border border-indigo-200" :
                          u.level === 2 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                          "bg-cyan-50 text-cyan-700 border border-cyan-200"
                        )}>
                          <span>سطح {u.level}</span>
                        </span>
                        <span className="text-slate-600 font-bold">{u.roleTitle}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {u.gradeLabel || 'عمومی'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {u.isReadOnly ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[11px] font-bold">
                          <Eye size={12} />
                          <span>مشاهده فقط (Read-Only)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-[11px] font-bold">
                          <Check size={12} />
                          <span>مشاهده و ویرایش</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => toggleUserActive(u.id)}
                        disabled={isSelf || isSuper}
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all",
                          u.isActive 
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100" 
                            : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100",
                          (isSelf || isSuper) && "opacity-80 cursor-default"
                        )}
                      >
                        {u.isActive ? (
                          <>
                            <CheckCircle2 size={12} />
                            <span>فعال</span>
                          </>
                        ) : (
                          <>
                            <XCircle size={12} />
                            <span>غیرفعال</span>
                          </>
                        )}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 sm:px-6 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-xl transition-all"
                          title="ویرایش کاربر و دسترسی‌ها"
                        >
                          <Edit size={15} />
                        </button>

                        {!isSuper && !isSelf && (
                          <button
                            onClick={() => {
                              if (window.confirm(`آیا از حذف حساب کاربری "${u.fullName}" اطمینان دارید؟`)) {
                                deleteUser(u.id);
                              }
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl transition-all"
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

      {/* Create / Edit User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl border border-slate-200 shadow-2xl overflow-hidden my-8">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  {editingUser ? <Edit size={16} /> : <UserPlus size={16} />}
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800">
                    {editingUser ? `ویرایش کاربر: ${editingUser.fullName}` : 'تعریف کاربر جدید در سامانه'}
                  </h3>
                  <p className="text-[10px] text-slate-400">تنظیمات سطح کاربری، نقش و مجوزهای ماژولار</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold">
                  {formError}
                </div>
              )}

              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    نام کاربری (لاتین) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="مثال: SHAH یا MOHAMMAD"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    رمز عبور *
                  </label>
                  <input
                    type="text"
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="رمز عبور کاربر"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    نام و نام خانوادگی کاربر *
                  </label>
                  <input
                    type="text"
                    required
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    placeholder="مثال: استاد محمد حسینی"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>

              {/* Level & Role Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    سطح کاربری *
                  </label>
                  <select
                    value={formLevel}
                    onChange={(e) => {
                      const lvl = parseInt(e.target.value) as UserLevel;
                      setFormLevel(lvl);
                      if (lvl === 1) {
                        setFormRole('super_admin');
                        setFormRoleTitle('سوپر ادمین');
                      } else if (lvl === 2) {
                        setFormRole('education_officer');
                        setFormRoleTitle('مسئول آموزش');
                      } else {
                        setFormRole('student');
                        setFormRoleTitle('طلبه');
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value={1}>سطح ۱ (مدیر ارشد / ستاد)</option>
                    <option value={2}>سطح ۲ (مسئولین و اساتید)</option>
                    <option value={3}>سطح ۳ (طلبه و نماینده)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    نقش سازمانی *
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => {
                      const role = e.target.value as UserRole;
                      setFormRole(role);
                      if (role === 'super_admin') setFormRoleTitle('سوپر ادمین');
                      else if (role === 'manager_principal') setFormRoleTitle('مدیر مدرسه');
                      else if (role === 'vice_principal') setFormRoleTitle('معاون مدرسه');
                      else if (role === 'education_officer') setFormRoleTitle('مسئول آموزش');
                      else if (role === 'research_officer') setFormRoleTitle('مسئول پژوهش');
                      else if (role === 'grade_supervisor') setFormRoleTitle('مسئول پایه');
                      else if (role === 'financial_officer') setFormRoleTitle('مسئول مالی');
                      else if (role === 'class_representative') setFormRoleTitle('نماینده کلاس');
                      else setFormRoleTitle('طلبه');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    {formLevel === 1 && (
                      <>
                        <option value="super_admin">سوپر ادمین (Super Admin)</option>
                        <option value="manager_principal">مدیر مدرسه</option>
                        <option value="vice_principal">معاون مدرسه</option>
                      </>
                    )}
                    {formLevel === 2 && (
                      <>
                        <option value="education_officer">مسئول آموزش</option>
                        <option value="research_officer">مسئول پژوهش</option>
                        <option value="grade_supervisor">مسئول پایه</option>
                        <option value="financial_officer">مسئول مالی</option>
                      </>
                    )}
                    {formLevel === 3 && (
                      <>
                        <option value="class_representative">نماینده کلاس</option>
                        <option value="student">طلبه / دانش‌پژوه</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    حوزه نظارت (پایه / Scope)
                  </label>
                  <select
                    value={formGradeLabel}
                    onChange={(e) => {
                      setFormGradeLabel(e.target.value);
                      if (e.target.value === 'پایه ۷') setFormScope('grade_7');
                      else if (e.target.value === 'پایه ۸') setFormScope('grade_8');
                      else if (e.target.value === 'پایه ۹') setFormScope('grade_9');
                      else if (e.target.value === 'پایه ۱۰') setFormScope('grade_10');
                      else setFormScope('global');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value="کل پایه‌ها">کل پایه‌ها (سراسری)</option>
                    <option value="پایه ۷">پایه ۷</option>
                    <option value="پایه ۸">پایه ۸</option>
                    <option value="پایه ۹">پایه ۹</option>
                    <option value="پایه ۱۰">پایه ۱۰</option>
                  </select>
                </div>
              </div>

              {/* Read Only Toggle */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">حالت فقط مشاهده (Read-Only)</div>
                  <p className="text-[11px] text-slate-500">کاربر فقط می‌تواند اطلاعات را ببیند و امکان ثبت، ویرایش یا حذف نخواهد داشت.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsReadOnly}
                    onChange={(e) => setFormIsReadOnly(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {/* Module Permissions Matrix */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers size={14} className="text-indigo-600" />
                    <span>ماژول‌ها و منوهای مجاز کاربر:</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (formAllowedModules.length === ALL_MODULES.length) {
                        setFormAllowedModules([]);
                      } else {
                        setFormAllowedModules(ALL_MODULES.map(m => m.id));
                      }
                    }}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    {formAllowedModules.length === ALL_MODULES.length ? 'عدم انتخاب همه' : 'انتخاب همه ماژول‌ها'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 max-h-56 overflow-y-auto custom-scrollbar">
                  {ALL_MODULES.map((mod) => {
                    const isChecked = formAllowedModules.includes(mod.id);
                    return (
                      <label
                        key={mod.id}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer border transition-all",
                          isChecked 
                            ? "bg-indigo-50/80 border-indigo-200 text-indigo-900 font-bold" 
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleModulePermission(mod.id)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>{mod.label}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal">{mod.group}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-200 flex items-center gap-1.5"
                >
                  <Save size={15} />
                  <span>{editingUser ? 'ذخیره تغییرات' : 'ایجاد کاربر'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
