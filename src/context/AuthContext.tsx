import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppUser, UserLevel, UserRole, UserScope } from '../types/auth';

export const ALL_SYSTEM_TABS = [
  { id: 'todos', label: 'پیگیری‌ها' },
  { id: 'academic-calendar', label: 'تقویم آموزشی' },
  { id: 'presence-hours', label: 'ثبت ساعت حضور' },
  { id: 'students', label: 'مدیریت کل کاربران (مشترک)' },
  { id: 'active-students', label: 'لیست کاربران فعال' },
  { id: 'discussion', label: 'مطالعات و مباحثات طلاب' },
  { id: 'programs', label: 'برنامه‌های مدرسه و مدرس‌ها' },
  { id: 'student-schedule', label: 'برنامه درسی طلاب' },
  { id: 'stats', label: 'آمار مطالعه' },
  { id: 'research', label: 'بخش پژوهش و مقالات' },
  { id: 'attendance', label: 'حضور و غیاب طلاب' },
  { id: 'comments', label: 'نظرات، صحبت‌ها و آزمون شفاهی' },
  { id: 'summary', label: 'جمع‌بندی و هوش مصنوعی' },
  { id: 'teachers-bank', label: 'بانک اساتید و مدرسین' },
  { id: 'manager-files', label: 'فایل‌های ارسالی مدیر' },
  { id: 'backup', label: 'پشتیبان‌گیری' },
  { id: 'user-management', label: 'تنظیمات کاربران و سطوح دسترسی' },
];

export const DEFAULT_USERS: AppUser[] = [
  // ====================== سطح ۱ (Level 1) ======================
  {
    id: 'user_sadegh',
    username: 'SADEGH',
    password: '8411924',
    name: 'صادق (سوپر ادمین)',
    level: 1,
    role: 'super_admin',
    roleTitle: 'سوپر ادمین (مدیر کل سیستم)',
    scope: 'all',
    gradeLabel: 'کل سیستم',
    mentorId: 'shahpoori',
    isReadOnly: false,
    canEdit: true,
    canManageUsers: true,
    canBackup: true,
    avatarBg: 'bg-indigo-700',
    allowedTabs: [
      'todos', 'academic-calendar', 'presence-hours', 'students', 'active-students',
      'discussion', 'programs', 'student-schedule', 'stats', 'research',
      'attendance', 'comments', 'summary', 'teachers-bank', 'manager-files', 'backup', 'user-management'
    ],
  },
  {
    id: 'user_rahnama',
    username: 'RAHNAMA',
    password: '8411924',
    name: 'استاد رهنما (مدیر مدرسه / معاون)',
    level: 1,
    role: 'school_manager',
    roleTitle: 'مدیر مدرسه / معاون',
    scope: 'all',
    gradeLabel: 'کل سیستم (مشاهده)',
    mentorId: 'shahpoori',
    isReadOnly: true, // مشاهده بدون ویرایش
    canEdit: false,
    canManageUsers: false,
    canBackup: true,
    avatarBg: 'bg-slate-700',
    allowedTabs: [
      'todos', 'academic-calendar', 'presence-hours', 'students', 'active-students',
      'discussion', 'programs', 'student-schedule', 'stats', 'research',
      'attendance', 'comments', 'summary', 'teachers-bank', 'manager-files', 'backup'
    ],
  },

  // ====================== سطح ۲ (Level 2) ======================
  {
    id: 'user_shah',
    username: 'SHAH',
    password: '8411924',
    name: 'استاد شاهپوری (مسئول آموزش)',
    level: 2,
    role: 'education_manager',
    roleTitle: 'مسئول آموزش',
    scope: 'all',
    gradeLabel: 'کل پایه‌ها',
    mentorId: 'shahpoori',
    isReadOnly: false,
    canEdit: true,
    canManageUsers: false,
    canBackup: true,
    avatarBg: 'bg-amber-600',
    allowedTabs: [
      'todos', 'academic-calendar', 'students', 'active-students', 'programs',
      'student-schedule', 'discussion', 'stats', 'attendance', 'comments',
      'summary', 'teachers-bank', 'manager-files', 'backup'
    ],
  },
  {
    id: 'user_isj',
    username: 'ISJ',
    password: '8411924',
    name: 'استاد حیاتی (مسئول پایه ۷)',
    level: 2,
    role: 'grade_mentor',
    roleTitle: 'مسئول پایه ۷',
    scope: 'grade_7',
    gradeLabel: 'پایه ۷',
    mentorId: 'hayati',
    isReadOnly: false,
    canEdit: true,
    canManageUsers: false,
    canBackup: true,
    avatarBg: 'bg-emerald-600',
    allowedTabs: [
      'todos', 'academic-calendar', 'students', 'active-students', 'programs',
      'student-schedule', 'discussion', 'stats', 'attendance', 'comments',
      'summary', 'teachers-bank', 'manager-files', 'backup'
    ],
  },
  {
    id: 'user_ho',
    username: 'HO',
    password: '8411924',
    name: 'استاد حسینی (مسئول پایه ۸)',
    level: 2,
    role: 'grade_mentor',
    roleTitle: 'مسئول پایه ۸',
    scope: 'grade_8',
    gradeLabel: 'پایه ۸',
    mentorId: 'hosseini',
    isReadOnly: false,
    canEdit: true,
    canManageUsers: false,
    canBackup: true,
    avatarBg: 'bg-sky-600',
    allowedTabs: [
      'todos', 'academic-calendar', 'students', 'active-students', 'programs',
      'student-schedule', 'discussion', 'stats', 'attendance', 'comments',
      'summary', 'teachers-bank', 'manager-files', 'backup'
    ],
  },
  {
    id: 'user_sol',
    username: 'SOL',
    password: '8411924',
    name: 'استاد سلیمانی (مسئول پایه ۹)',
    level: 2,
    role: 'grade_mentor',
    roleTitle: 'مسئول پایه ۹',
    scope: 'grade_9',
    gradeLabel: 'پایه ۹',
    mentorId: 'soleimani',
    isReadOnly: false,
    canEdit: true,
    canManageUsers: false,
    canBackup: true,
    avatarBg: 'bg-purple-600',
    allowedTabs: [
      'todos', 'academic-calendar', 'students', 'active-students', 'programs',
      'student-schedule', 'discussion', 'stats', 'attendance', 'comments',
      'summary', 'teachers-bank', 'manager-files', 'backup'
    ],
  },
  {
    id: 'user_asadi',
    username: 'ASADI',
    password: '8411924',
    name: 'استاد اسدی (مسئول پایه ۱۰)',
    level: 2,
    role: 'grade_mentor',
    roleTitle: 'مسئول پایه ۱۰',
    scope: 'grade_10',
    gradeLabel: 'پایه ۱۰',
    mentorId: 'asadi',
    isReadOnly: false,
    canEdit: true,
    canManageUsers: false,
    canBackup: true,
    avatarBg: 'bg-rose-600',
    allowedTabs: [
      'todos', 'academic-calendar', 'students', 'active-students', 'programs',
      'student-schedule', 'discussion', 'stats', 'attendance', 'comments',
      'summary', 'teachers-bank', 'manager-files', 'backup'
    ],
  },
  {
    id: 'user_yazdani',
    username: 'YAZDANI',
    password: '8411924',
    name: 'استاد یزدانی (مسئول پژوهش)',
    level: 2,
    role: 'research_manager',
    roleTitle: 'مسئول پژوهش',
    scope: 'all',
    gradeLabel: 'بخش پژوهش',
    mentorId: 'shahpoori',
    isReadOnly: false,
    canEdit: true,
    canManageUsers: false,
    canBackup: false,
    avatarBg: 'bg-teal-600',
    allowedTabs: [
      'active-students', 'research', 'todos', 'summary', 'manager-files'
    ],
  },
  {
    id: 'user_mali',
    username: 'MALI',
    password: '8411924',
    name: 'مسئول مالی و اداری',
    level: 2,
    role: 'finance_manager',
    roleTitle: 'مسئول مالی و کارکرد',
    scope: 'all',
    gradeLabel: 'امور مالی',
    mentorId: 'shahpoori',
    isReadOnly: false,
    canEdit: true,
    canManageUsers: false,
    canBackup: true,
    avatarBg: 'bg-cyan-700',
    allowedTabs: [
      'presence-hours', 'teachers-bank', 'students', 'backup'
    ],
  },

  // ====================== سطح ۳ (Level 3) ======================
  {
    id: 'user_sarlak',
    username: 'SARLAK',
    password: '8411924',
    name: 'طلبه سرلک (نماینده کلاس)',
    level: 3,
    role: 'class_representative',
    roleTitle: 'نماینده کلاس',
    scope: 'class',
    gradeLabel: 'نماینده پایه',
    studentName: 'محمد سرلک',
    isReadOnly: false,
    canEdit: true,
    canManageUsers: false,
    canBackup: false,
    avatarBg: 'bg-blue-600',
    allowedTabs: [
      'attendance', 'student-schedule', 'discussion', 'stats', 'manager-files'
    ],
  },
  {
    id: 'user_jalili',
    username: 'JALILI',
    password: '8411924',
    name: 'طلبه جلیلی',
    level: 3,
    role: 'student',
    roleTitle: 'طلبه',
    scope: 'self',
    gradeLabel: 'طلبه پایه',
    studentName: 'علیرضا جلیلی',
    isReadOnly: false,
    canEdit: true,
    canManageUsers: false,
    canBackup: false,
    avatarBg: 'bg-emerald-700',
    allowedTabs: [
      'attendance', 'student-schedule', 'discussion', 'stats', 'comments', 'manager-files'
    ],
  },
];

interface AuthContextType {
  currentUser: AppUser | null;
  users: AppUser[];
  login: (username: string, password: string) => { success: boolean; message?: string };
  logout: () => void;
  addUser: (user: Partial<AppUser>) => { success: boolean; error?: string };
  updateUser: (id: string, updates: Partial<AppUser>) => void;
  deleteUser: (id: string) => void;
  resetDefaultUsers: () => void;
  resetToDefaultUsers: () => void;
  toggleUserActive: (id: string) => void;
  isTabAllowed: (tabId: string) => boolean;
  hasModuleAccess: (tabId: string) => boolean;
  canEdit: boolean;
  isReadOnly: boolean;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USERS_STORAGE_KEY = 'system_auth_users_v2';
const CURRENT_USER_KEY = 'system_auth_current_user_v2';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<AppUser[]>(() => {
    try {
      const saved = localStorage.getItem(USERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((u: any) => ({
            ...u,
            name: u.name || u.fullName || u.username || 'کاربر',
            allowedTabs: Array.isArray(u.allowedTabs) 
              ? u.allowedTabs 
              : (Array.isArray(u.allowedModules) ? u.allowedModules : ['todos', 'students']),
          }));
        }
      }
    } catch (e) {
      console.error('Error loading users:', e);
    }
    return DEFAULT_USERS;
  });

  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const saved = localStorage.getItem(CURRENT_USER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const normalized: AppUser = {
            ...parsed,
            name: parsed.name || parsed.fullName || parsed.username || 'کاربر',
            allowedTabs: Array.isArray(parsed.allowedTabs) 
              ? parsed.allowedTabs 
              : (Array.isArray(parsed.allowedModules) ? parsed.allowedModules : ['todos', 'students']),
          };
          const found = DEFAULT_USERS.find(u => u.username.toUpperCase() === normalized.username?.toUpperCase());
          return found || normalized;
        }
      }
    } catch (e) {
      console.error('Error loading current user:', e);
    }
    return null;
  });

  useEffect(() => {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('Error saving users:', e);
    }
  }, [users]);

  const login = (usernameInput: string, passwordInput: string): { success: boolean; message?: string } => {
    const cleanUser = usernameInput.trim().toUpperCase();
    const cleanPass = passwordInput.trim();

    if (!cleanUser || !cleanPass) {
      return { success: false, message: 'لطفاً نام کاربری و رمز عبور را وارد نمایید.' };
    }

    const matched = users.find(u => u.username.toUpperCase() === cleanUser);
    if (!matched) {
      return { success: false, message: 'نام کاربری وارد شده در سامانه یافت نشد.' };
    }

    if (matched.password && matched.password !== cleanPass) {
      return { success: false, message: 'رمز عبور وارد شده نادرست است.' };
    }

    const updatedUser = {
      ...matched,
      lastLogin: new Date().toISOString()
    };

    setCurrentUser(updatedUser);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));

    // Also sync with mentor context if user has mentorId
    if (updatedUser.mentorId) {
      localStorage.setItem('current_mentor_id', updatedUser.mentorId);
      if (updatedUser.role === 'grade_mentor') {
        localStorage.setItem('shahpoori_active_filter', updatedUser.mentorId);
      }
    }

    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(CURRENT_USER_KEY);
  };

  const addUser = (newUser: Partial<AppUser>): { success: boolean; error?: string } => {
    const username = (newUser.username || '').trim().toUpperCase();
    if (!username) return { success: false, error: 'نام کاربری الزامی است' };

    const user: AppUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      username,
      password: newUser.password || '8411924',
      name: newUser.name || newUser.fullName || username,
      fullName: newUser.fullName || newUser.name || username,
      level: newUser.level || 2,
      role: newUser.role || 'custom',
      roleTitle: newUser.roleTitle || 'کاربر سفارشی',
      scope: newUser.scope || 'all',
      gradeLabel: newUser.gradeLabel || '',
      mentorId: newUser.mentorId || 'shahpoori',
      isReadOnly: newUser.isReadOnly || false,
      canEdit: newUser.canEdit !== undefined ? newUser.canEdit : true,
      canManageUsers: newUser.canManageUsers || false,
      canBackup: newUser.canBackup !== undefined ? newUser.canBackup : true,
      isActive: newUser.isActive !== undefined ? newUser.isActive : true,
      allowedTabs: newUser.allowedTabs || (newUser.allowedModules ? (newUser.allowedModules as string[]) : ['todos', 'students']),
      allowedModules: newUser.allowedModules,
      avatarBg: newUser.avatarBg || 'bg-indigo-600',
      createdAt: new Date().toISOString(),
    };

    setUsers(prev => [...prev.filter(u => u.username.toUpperCase() !== username), user]);
    return { success: true };
  };

  const updateUser = (id: string, updates: Partial<AppUser>) => {
    setUsers(prev => prev.map(u => {
      if (u.id === id) {
        const updated = { ...u, ...updates };
        if (currentUser && currentUser.id === id) {
          setCurrentUser(updated);
          localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
        }
        return updated;
      }
      return u;
    }));
  };

  const deleteUser = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    if (currentUser && currentUser.id === id) {
      logout();
    }
  };

  const resetDefaultUsers = () => {
    setUsers(DEFAULT_USERS);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
    if (currentUser) {
      const refreshed = DEFAULT_USERS.find(u => u.username.toUpperCase() === currentUser.username.toUpperCase());
      if (refreshed) {
        setCurrentUser(refreshed);
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(refreshed));
      }
    }
  };

  const toggleUserActive = (id: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id === id) {
        return { ...u, isReadOnly: !u.isReadOnly };
      }
      return u;
    }));
  };

  const isTabAllowed = (tabId: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.level === 1 && currentUser.role === 'super_admin') return true;
    const tabs = currentUser.allowedTabs || currentUser.allowedModules || [];
    return Array.isArray(tabs) ? tabs.includes(tabId) : false;
  };

  const hasModuleAccess = (tabId: string): boolean => {
    return isTabAllowed(tabId);
  };

  const isReadOnly = currentUser ? currentUser.isReadOnly === true : false;
  const canEdit = currentUser ? !currentUser.isReadOnly && (currentUser.canEdit !== false) : false;
  const isSuperAdmin = currentUser?.level === 1 && currentUser?.role === 'super_admin';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        login,
        logout,
        addUser,
        updateUser,
        deleteUser,
        resetDefaultUsers,
        resetToDefaultUsers: resetDefaultUsers,
        toggleUserActive,
        isTabAllowed,
        hasModuleAccess,
        canEdit,
        isReadOnly,
        isSuperAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
