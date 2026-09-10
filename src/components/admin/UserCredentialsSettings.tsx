import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AppUser, UserLevel, UserRole } from '../../types/auth';
import { Student } from '../../types';
import { localDb } from '../../lib/localDb';
import { 
  ShieldCheck, 
  KeyRound, 
  UserCheck, 
  UserX, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  Sparkles,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function UserCredentialsSettings() {
  const { users, currentUser, addUser, updateUser, deleteUser } = useAuth();
  
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<number | 'all'>('all');
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [modalStudent, setModalStudent] = useState<Student | null>(null);

  // Form states
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formLevel, setFormLevel] = useState<UserLevel>(3);
  const [formRole, setFormRole] = useState<UserRole>('student');
  const [formRoleTitle, setFormRoleTitle] = useState('طلبه');
  const [linkedStudentId, setLinkedStudentId] = useState('');

  // Permission helpers
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isEducationManager = currentUser?.role === 'education_manager' || currentUser?.role === 'education_officer' || currentUser?.username?.toUpperCase() === 'SHAH';
  const canModifyCredentials = isSuperAdmin || isEducationManager;

  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const data = await localDb.getDocs<Student>('students');
      setStudents(data);
    } catch (e) {
      console.error('Error fetching students for credentials:', e);
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    const unsub = localDb.subscribe(() => {
      fetchStudents();
    });
    return () => unsub();
  }, []);

  const togglePasswordVisibility = (userId: string) => {
    setShowPasswordMap(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Helper to find if student has user account
  const getStudentUser = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    return users.find(u => {
      if (u.linkedStudentId && String(u.linkedStudentId) === String(studentId)) return true;
      if (u.studentId && String(u.studentId) === String(studentId)) return true;
      if (student?.nationalId && student.nationalId.trim()) {
        const cleanNat = student.nationalId.trim().toUpperCase();
        if (u.username.toUpperCase() === cleanNat) return true;
      }
      if (student && (u.role === 'student' || u.level === 3)) {
        if (u.name && u.name.trim() === student.name.trim()) return true;
        if (u.fullName && u.fullName.trim() === student.name.trim()) return true;
      }
      return false;
    });
  };

  // List of students who DO NOT have user account
  const studentsWithoutAccount = students.filter(s => !getStudentUser(s.id));

  // Quick Account Creation logic
  const handleQuickCreateAccount = (student: Student) => {
    if (!canModifyCredentials) {
      alert('شما دسترسی ایجاد نام کاربری برای طلاب را ندارید.');
      return;
    }
    
    // Proposal logic: nationalId as username, phoneNumber as password
    const usernameProposal = (student.nationalId || '').trim();
    const passwordProposal = (student.phoneNumber || '').trim();

    if (!usernameProposal) {
      alert(`جهت ساخت سریع کاربری برای «${student.name}»، ابتدا باید کد ملی او در پرونده ثبت شده باشد.`);
      return;
    }
    if (!passwordProposal) {
      alert(`جهت ساخت سریع کاربری برای «${student.name}»، ابتدا باید شماره تماس او در پرونده ثبت شده باشد.`);
      return;
    }

    // Check if username already exists in system
    const usernameExists = users.some(u => u.username.toUpperCase() === usernameProposal.toUpperCase());
    if (usernameExists) {
      alert(`نام کاربری پیشنهادی (${usernameProposal}) قبلاً در سیستم ثبت شده است.`);
      return;
    }

    const confirmMessage = `آیا مایلید کاربری برای «${student.name}» با اطلاعات زیر ایجاد شود؟\n\nنام کاربری: ${usernameProposal} (کد ملی)\nرمز عبور: ${passwordProposal} (شماره تماس)`;
    
    if (window.confirm(confirmMessage)) {
      const result = addUser({
        username: usernameProposal,
        password: passwordProposal,
        name: student.name,
        fullName: student.name,
        level: 3,
        role: 'student',
        roleTitle: 'طلبه',
        scope: 'self',
        gradeLabel: student.grade || 'طلبه پایه',
        linkedStudentId: student.id,
        studentId: student.id,
        studentName: student.name,
        isActive: true,
        avatarBg: 'bg-emerald-600',
        allowedTabs: ['attendance', 'student-schedule', 'discussion', 'stats', 'comments', 'manager-files']
      });

      if (result.success) {
        alert(`حساب کاربری با موفقیت برای «${student.name}» ایجاد شد.`);
      } else {
        alert(`خطا در ایجاد حساب کاربری: ${result.error || 'ناشناخته'}`);
      }
    }
  };

  const handleOpenCreateModal = (student?: Student) => {
    setEditingUser(null);
    if (student) {
      setModalStudent(student);
      setFormName(student.name);
      setFormUsername(student.nationalId || '');
      setFormPassword(student.phoneNumber || '');
      setFormLevel(3);
      setFormRole('student');
      setFormRoleTitle('طلبه');
      setLinkedStudentId(student.id);
    } else {
      setModalStudent(null);
      setFormName('');
      setFormUsername('');
      setFormPassword('');
      setFormLevel(3);
      setFormRole('student');
      setFormRoleTitle('طلبه');
      setLinkedStudentId('');
    }
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: AppUser) => {
    // Check level permissions:
    // Only Super Admin can edit Level 1 users.
    // Education Manager can edit Level 2 and Level 3 users.
    if (user.level === 1 && !isSuperAdmin) {
      alert('ویرایش مشخصات ورود کاربران سطح ۱ فقط توسط سوپر ادمین امکان‌پذیر است.');
      return;
    }
    if (!isSuperAdmin && !isEducationManager) {
      alert('شما دسترسی ویرایش کاربران را ندارید.');
      return;
    }

    setEditingUser(user);
    setFormName(user.name);
    setFormUsername(user.username);
    setFormPassword(user.password || '');
    setFormLevel(user.level);
    setFormRole(user.role);
    setFormRoleTitle(user.roleTitle);
    setLinkedStudentId(user.linkedStudentId || '');
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername.trim() || !formName.trim() || !formPassword.trim()) {
      alert('لطفاً تمامی فیلدهای الزامی را تکمیل کنید.');
      return;
    }

    const cleanUsername = formUsername.trim().toUpperCase();

    if (editingUser) {
      // Edit mode
      updateUser(editingUser.id, {
        username: cleanUsername,
        password: formPassword.trim(),
        name: formName.trim(),
        level: formLevel,
        role: formRole,
        roleTitle: formRoleTitle,
        linkedStudentId: linkedStudentId || undefined,
        studentId: linkedStudentId || undefined,
      });
      alert('مشخصات ورود با موفقیت بروزرسانی شد.');
    } else {
      // Create mode
      // Check if username already exists
      if (users.some(u => u.username.toUpperCase() === cleanUsername)) {
        alert('این نام کاربری قبلاً در سامانه تعریف شده است.');
        return;
      }

      const result = addUser({
        username: cleanUsername,
        password: formPassword.trim(),
        name: formName.trim(),
        fullName: formName.trim(),
        level: formLevel,
        role: formRole,
        roleTitle: formRoleTitle,
        linkedStudentId: linkedStudentId || undefined,
        studentId: linkedStudentId || undefined,
        isActive: true,
        scope: formLevel === 3 ? 'self' : 'all',
        avatarBg: formLevel === 1 ? 'bg-indigo-700' : formLevel === 2 ? 'bg-amber-600' : 'bg-emerald-600',
        allowedTabs: formLevel === 3 
          ? ['attendance', 'student-schedule', 'discussion', 'stats', 'comments', 'manager-files']
          : ['todos', 'academic-calendar', 'students', 'active-students', 'programs', 'classrooms', 'student-schedule', 'discussion', 'stats', 'attendance', 'comments', 'summary', 'teachers-bank', 'manager-files', 'backup', 'user-credentials']
      });

      if (result.success) {
        alert('کاربر جدید با موفقیت ایجاد شد.');
      } else {
        alert(`خطا در تعریف کاربر: ${result.error}`);
      }
    }

    setIsModalOpen(false);
  };

  const handleDeleteUser = (user: AppUser) => {
    if (user.level === 1 && !isSuperAdmin) {
      alert('حذف مشخصات ورود کاربران سطح ۱ فقط توسط سوپر ادمین امکان‌پذیر است.');
      return;
    }
    if (!isSuperAdmin && !isEducationManager) {
      alert('شما دسترسی حذف حساب کاربری را ندارید.');
      return;
    }

    if (window.confirm(`آیا از حذف دسترسی ورود کاربر «${user.name}» اطمینان دارید؟`)) {
      deleteUser(user.id);
      alert('حساب کاربری حذف گردید. این شخص دیگر نمی‌تواند وارد سامانه شود.');
    }
  };

  // Filtered Users
  const filteredUsers = users.filter(u => {
    if (selectedLevel !== 'all' && u.level !== selectedLevel) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return u.name.toLowerCase().includes(term) || u.username.toLowerCase().includes(term) || u.roleTitle.toLowerCase().includes(term);
    }
    return true;
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in" dir="rtl">
      
      {/* Top Title Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/15">
            <KeyRound size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">مدیریت ورود و اعتبارنامه‌های کاربران</h1>
            <p className="text-xs text-slate-500 font-medium">
              مشاهده، تعریف و ویرایش کلمات عبور و نام‌های کاربری طلاب، اساتید و کادر مدیریت
            </p>
          </div>
        </div>
        
        {canModifyCredentials && (
          <button
            onClick={() => handleOpenCreateModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
          >
            <Plus size={16} />
            <span>تعریف کاربری جدید</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main User Accounts Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <ShieldCheck className="text-indigo-600" size={18} />
                <span>حساب‌های کاربری فعال در سیستم ({filteredUsers.length})</span>
              </h2>

              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold w-full sm:w-auto">
                <button
                  onClick={() => setSelectedLevel('all')}
                  className={cn("flex-1 px-3 py-1 rounded-lg transition-all", selectedLevel === 'all' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500")}
                >
                  همه
                </button>
                <button
                  onClick={() => setSelectedLevel(1)}
                  className={cn("flex-1 px-3 py-1 rounded-lg transition-all", selectedLevel === 1 ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500")}
                >
                  سطح ۱
                </button>
                <button
                  onClick={() => setSelectedLevel(2)}
                  className={cn("flex-1 px-3 py-1 rounded-lg transition-all", selectedLevel === 2 ? "bg-white text-amber-700 shadow-xs" : "text-slate-500")}
                >
                  سطح ۲
                </button>
                <button
                  onClick={() => setSelectedLevel(3)}
                  className={cn("flex-1 px-3 py-1 rounded-lg transition-all", selectedLevel === 3 ? "bg-white text-emerald-700 shadow-xs" : "text-slate-500")}
                >
                  سطح ۳
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="جستجو بر اساس نام، نام کاربری یا نقش..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 outline-none focus:bg-white"
              />
            </div>

            {/* Users list table */}
            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                    <th className="py-3 px-4">کاربر</th>
                    <th className="py-3 px-4">سطح / نقش</th>
                    <th className="py-3 px-4">نام کاربری</th>
                    <th className="py-3 px-4">کلمه عبور</th>
                    {canModifyCredentials && <th className="py-3 px-4 text-center">عملیات</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 italic">کاربری یافت نشد.</td>
                    </tr>
                  ) : (
                    filteredUsers.map(user => {
                      const isLevel1 = user.level === 1;
                      const editBlocked = isLevel1 ? !isSuperAdmin : (!isSuperAdmin && !isEducationManager);
                      const showPassword = !!showPasswordMap[user.id];

                      return (
                        <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className={cn("w-8 h-8 rounded-xl font-bold text-white flex items-center justify-center shadow-xs", user.avatarBg || 'bg-slate-600')}>
                                {user.name[0]}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-950">{user.name}</span>
                                {user.linkedStudentId && (
                                  <span className="text-[10px] text-emerald-600 font-medium">متصل به پرونده طلبه</span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border",
                              user.level === 1 ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                              user.level === 2 ? "bg-amber-50 text-amber-800 border-amber-200" :
                              "bg-emerald-50 text-emerald-800 border-emerald-200"
                            )}>
                              سطح {user.level} • {user.roleTitle}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 font-mono font-bold text-indigo-700" dir="ltr">
                            {user.username}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 font-mono text-slate-600" dir="ltr">
                              <span>{showPassword ? (user.password || '8411924') : '••••••'}</span>
                              <button
                                onClick={() => togglePasswordVisibility(user.id)}
                                className="text-slate-400 hover:text-indigo-600 p-1 hover:bg-slate-100 rounded-lg transition-colors"
                                title={showPassword ? "عدم نمایش" : "نمایش رمز عبور"}
                              >
                                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                            </div>
                          </td>

                          {canModifyCredentials && (
                            <td className="py-3.5 px-4 text-center">
                              {editBlocked ? (
                                <span className="text-[10px] text-slate-400 font-medium bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">سوپر ادمین</span>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleOpenEditModal(user)}
                                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="ویرایش مشخصات ورود"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                  {user.role !== 'super_admin' && (
                                    <button
                                      onClick={() => handleDeleteUser(user)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                      title="حذف حساب کاربری"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar: Students without Accounts */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <UserX className="text-rose-500" size={18} />
                <span>طلاب بدون حساب کاربری ({studentsWithoutAccount.length})</span>
              </h2>
              <p className="text-[10px] text-slate-400 mt-1">
                طلابی که در جدول مشخصات ثبت شده‌اند اما رمز عبور و نام کاربری سایت ندارند.
              </p>
            </div>

            {loadingStudents ? (
              <div className="text-center py-6 text-xs text-slate-400">در حال بارگذاری طلاب...</div>
            ) : studentsWithoutAccount.length === 0 ? (
              <div className="text-center py-6 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-100 text-xs font-bold flex items-center justify-center gap-2">
                <Check size={16} />
                <span>همه طلاب دارای حساب کاربری هستند!</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                {studentsWithoutAccount.map(student => {
                  const hasProps = !!student.nationalId && !!student.phoneNumber;

                  return (
                    <div 
                      key={student.id} 
                      className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xs font-black text-slate-900">{student.name}</h3>
                          <p className="text-[10px] text-slate-500 mt-0.5">پایه: {student.grade || 'نامشخص'}</p>
                        </div>
                        
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[9px] font-bold border border-rose-200 rounded-full">
                          غیر فعال در سایت
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 bg-white/80 p-2 rounded-xl border border-slate-200/50">
                        <div>کد ملی (کاربری): <span className="font-mono font-bold text-slate-800">{student.nationalId || '---'}</span></div>
                        <div>موبایل (رمز): <span className="font-mono font-bold text-slate-800">{student.phoneNumber || '---'}</span></div>
                      </div>

                      {canModifyCredentials ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleQuickCreateAccount(student)}
                            disabled={!hasProps}
                            className={cn(
                              "flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold rounded-xl transition-all cursor-pointer",
                              hasProps 
                                ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs" 
                                : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                            )}
                            title={hasProps ? "ایجاد کاربری سریع با کدملی و موبایل" : "کدملی و موبایل ثبت نشده است"}
                          >
                            <Sparkles size={11} />
                            <span>ایجاد سریع (پیش‌فرض)</span>
                          </button>
                          
                          <button
                            onClick={() => handleOpenCreateModal(student)}
                            className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                            title="ایجاد سفارشی"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 italic text-center">فاقد دسترسی ویرایش</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Modal: Create/Edit Credential */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <KeyRound size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      {editingUser ? `ویرایش اعتبارنامه ورود: ${editingUser.name}` : 'ایجاد حساب کاربری جدید'}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      تعیین نام کاربری و کلمه عبور جهت ورود کاربران به سامانه
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveModal} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نام کامل نمایش کاربر</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="مثال: محمد امینی"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">نام کاربری</label>
                    <input
                      type="text"
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      placeholder="HOSSEINI یا کدملی"
                      required
                      dir="ltr"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-950 focus:outline-none focus:bg-white focus:border-indigo-500 text-right uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">کلمه عبور</label>
                    <input
                      type="text"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="رمز عبور دلخواه"
                      required
                      dir="ltr"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-950 focus:outline-none focus:bg-white focus:border-indigo-500 text-right"
                    />
                  </div>
                </div>

                {(isSuperAdmin || isEducationManager) ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">سطح کاربری</label>
                      <select
                        value={formLevel}
                        onChange={(e) => {
                          const lvl = Number(e.target.value) as UserLevel;
                          setFormLevel(lvl);
                          if (lvl === 1) {
                            setFormRole('school_manager');
                            setFormRoleTitle('کادر اجرایی');
                          } else if (lvl === 2) {
                            setFormRole('grade_mentor');
                            setFormRoleTitle('مسئول پایه');
                          } else {
                            setFormRole('student');
                            setFormRoleTitle('طلبه');
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                      >
                        {isSuperAdmin && <option value={1}>سطح ۱ (مدیریت کلان)</option>}
                        <option value={2}>سطح ۲ (کادر و اساتید)</option>
                        <option value={3}>سطح ۳ (طلاب / نمایندگان)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">عنوان نقش</label>
                      <input
                        type="text"
                        value={formRoleTitle}
                        onChange={(e) => setFormRoleTitle(e.target.value)}
                        placeholder="طلبه، کادر، مسئول پایه"
                        required
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-950 focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                    <AlertCircle size={14} className="text-amber-500 shrink-0" />
                    <span className="text-[10px] text-slate-600 font-bold">شما دسترسی تغییر سطح کاربری را ندارید.</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اتصال به پرونده دانش‌آموزی (اختیاری)</label>
                  <select
                    value={linkedStudentId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLinkedStudentId(val);
                      if (val) {
                        const stud = students.find(s => s.id === val);
                        if (stud) {
                          setFormName(stud.name);
                          if (!formUsername && stud.nationalId) setFormUsername(stud.nationalId);
                          if (!formPassword && stud.phoneNumber) setFormPassword(stud.phoneNumber);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
                  >
                    <option value="">عدم اتصال به پرونده طلبه</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.grade || 'بدون پایه'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                  >
                    تأیید و ذخیره
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
