import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppUser, UserLevel, UserRole, UserScope } from '../types/auth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const ALL_SYSTEM_TABS = [
  { id: 'todos', label: 'پیگیری‌ها' },
  { id: 'workflow', label: 'جریان کار (سطح ۱ و ۲)' },
  { id: 'academic-calendar', label: 'تقویم آموزشی' },
  { id: 'presence-hours', label: 'ثبت ساعت حضور' },
  { id: 'finance', label: 'بخش مالی (شهریه، کارکرد و هزینه‌ها)' },
  { id: 'students', label: 'مدیریت کل کاربران (مشترک)' },
  { id: 'active-students', label: 'لیست کاربران فعال' },
  { id: 'discussion', label: 'گروه‌های بحثی' },
  { id: 'programs', label: 'برنامه‌های مدرسه و مدرس‌ها' },
  { id: 'classrooms', label: 'مدرس‌ها (کلاس‌های درس)' },
  { id: 'student-schedule', label: 'برنامه درسی طلاب' },
  { id: 'teachers-schedule', label: 'برنامه درسی اساتید' },
  { id: 'stats', label: 'آمار مطالعه' },
  { id: 'research', label: 'بخش پژوهش و مقالات' },
  { id: 'attendance', label: 'حضور و غیاب طلاب' },
  { id: 'comments', label: 'نظرات، صحبت‌ها و آزمون شفاهی' },
  { id: 'summary', label: 'جمع‌بندی و هوش مصنوعی' },
  { id: 'teachers-bank', label: 'بانک اساتید و مدرسین' },
  { id: 'backup', label: 'پشتیبان‌گیری (سطح ۱ و مسئول آموزش)' },
  { id: 'user-management', label: 'تنظیمات کاربران و سطوح دسترسی' },
  { id: 'user-credentials', label: 'مدیریت ورود کاربران' },
  { id: 'audit-logs', label: 'فعالیت‌های سایت (سطح ۱ و مسئول آموزش)' },
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
      'todos', 'workflow', 'academic-calendar', 'presence-hours', 'finance', 'students', 'active-students',
      'discussion', 'programs', 'classrooms', 'student-schedule', 'teachers-schedule', 'stats', 'research',
      'attendance', 'comments', 'summary', 'teachers-bank', 'backup', 'user-management', 'user-credentials', 'audit-logs'
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
      'todos', 'workflow', 'academic-calendar', 'presence-hours', 'finance', 'students', 'active-students',
      'discussion', 'programs', 'classrooms', 'student-schedule', 'teachers-schedule', 'stats', 'research',
      'attendance', 'comments', 'summary', 'teachers-bank', 'backup', 'user-credentials', 'audit-logs'
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
      'todos', 'workflow', 'academic-calendar', 'students', 'active-students', 'programs', 'classrooms',
      'student-schedule', 'teachers-schedule', 'consultation-advisor', 'counseling-classes', 'discussion', 'stats', 'attendance', 'comments',
      'summary', 'teachers-bank', 'backup', 'user-credentials', 'audit-logs'
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
    canBackup: false,
    avatarBg: 'bg-emerald-600',
    allowedTabs: [
      'todos', 'workflow', 'academic-calendar', 'students', 'active-students', 'programs', 'classrooms',
      'student-schedule', 'teachers-schedule', 'consultation-advisor', 'counseling-classes', 'discussion', 'stats', 'attendance', 'comments',
      'summary', 'teachers-bank', 'user-credentials'
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
    canBackup: false,
    avatarBg: 'bg-sky-600',
    allowedTabs: [
      'todos', 'workflow', 'academic-calendar', 'students', 'active-students', 'programs', 'classrooms',
      'student-schedule', 'teachers-schedule', 'consultation-advisor', 'counseling-classes', 'discussion', 'stats', 'attendance', 'comments',
      'summary', 'teachers-bank', 'user-credentials'
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
    canBackup: false,
    avatarBg: 'bg-purple-600',
    allowedTabs: [
      'todos', 'workflow', 'academic-calendar', 'students', 'active-students', 'programs', 'classrooms',
      'student-schedule', 'teachers-schedule', 'consultation-advisor', 'counseling-classes', 'discussion', 'stats', 'attendance', 'comments',
      'summary', 'teachers-bank', 'user-credentials'
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
    canBackup: false,
    avatarBg: 'bg-rose-600',
    allowedTabs: [
      'todos', 'workflow', 'academic-calendar', 'students', 'active-students', 'programs', 'classrooms',
      'student-schedule', 'teachers-schedule', 'consultation-advisor', 'counseling-classes', 'discussion', 'stats', 'attendance', 'comments',
      'summary', 'teachers-bank', 'user-credentials'
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
      'active-students', 'research', 'counseling-classes', 'todos', 'workflow', 'programs', 'classrooms', 'teachers-schedule', 'user-credentials'
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
    canBackup: false,
    avatarBg: 'bg-cyan-700',
    allowedTabs: [
      'finance-tuition',
      'finance-grade-mentors',
      'finance-teachers',
      'finance-lunch',
      'finance-loans-fund',
      'finance-expenses-reports',
      'workflow',
      'todos',
      'academic-calendar',
      'students',
      'teachers-bank',
      'finance',
      'user-credentials'
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
      'student-meals', 'attendance', 'student-schedule', 'programs', 'classrooms', 'discussion', 'stats'
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
      'student-meals', 'attendance', 'student-schedule', 'programs', 'classrooms', 'discussion', 'stats', 'comments'
    ],
  },
];

interface AuthContextType {
  currentUser: AppUser | null;
  users: AppUser[];
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
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
          return parsed.map((u: any) => {
            const tabs = Array.isArray(u.allowedTabs) 
              ? u.allowedTabs 
              : (Array.isArray(u.allowedModules) ? u.allowedModules : ['todos', 'students']);
            if ((u.role === 'education_manager' || u.role === 'super_admin' || u.username === 'SHAH') && !tabs.includes('user-credentials')) {
              tabs.push('user-credentials');
            }
            return {
              ...u,
              name: u.name || u.fullName || u.username || 'کاربر',
              allowedTabs: tabs,
            };
          });
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
          const activeUser = found || normalized;
          if (activeUser && (activeUser.role === 'education_manager' || activeUser.role === 'super_admin' || activeUser.username === 'SHAH')) {
            if (Array.isArray(activeUser.allowedTabs) && !activeUser.allowedTabs.includes('user-credentials')) {
              activeUser.allowedTabs.push('user-credentials');
            }
          }
          return activeUser;
        }
      }
    } catch (e) {
      console.error('Error loading current user:', e);
    }
    return null;
  });

  // Fetch users from Supabase Cloud on mount (synchronizes across hosts & devices)
  useEffect(() => {
    let isMounted = true;
    const syncWithCloud = async () => {
      if (!isSupabaseConfigured || typeof window === 'undefined') return;
      try {
        const { data, error } = await supabase
          .from('app_collections')
          .select('id, data')
          .eq('collection_name', 'system_users');

        if (!error && data) {
          const cloudUsers: AppUser[] = [];
          for (const row of data) {
            if (row.id === 'all_users' && Array.isArray(row.data?.users)) {
              cloudUsers.push(...row.data.users);
            } else if (row.data && row.data.username) {
              cloudUsers.push(row.data);
            }
          }

          if (cloudUsers.length > 0 && isMounted) {
            setUsers(prev => {
              const map = new Map<string, AppUser>();
              // Base defaults
              DEFAULT_USERS.forEach(u => map.set(u.username.toUpperCase(), u));
              // Overlay current local users
              prev.forEach(u => map.set(u.username.toUpperCase(), u));
              // Overlay cloud users as source of truth
              cloudUsers.forEach(u => {
                if (u && u.username) {
                  const uname = u.username.toUpperCase();
                  map.set(uname, {
                    ...u,
                    username: uname,
                    name: u.name || u.fullName || u.username,
                    allowedTabs: Array.isArray(u.allowedTabs) 
                      ? u.allowedTabs 
                      : (Array.isArray((u as any).allowedModules) ? (u as any).allowedModules : ['todos', 'students'])
                  });
                }
              });

              const merged = Array.from(map.values());
              try {
                localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(merged));
              } catch (e) {}
              return merged;
            });
          } else if (data.length === 0) {
            // Seed initial default users to Supabase if completely empty
            for (const defUser of DEFAULT_USERS) {
              supabase.from('app_collections').upsert({
                collection_name: 'system_users',
                id: defUser.username.toUpperCase(),
                data: defUser,
                updated_at: new Date().toISOString()
              }, { onConflict: 'collection_name,id' }).then();
            }
          }
        }
      } catch (e) {
        console.warn('Initial cloud users sync error:', e);
      }
    };

    syncWithCloud();
    return () => { isMounted = false; };
  }, []);

  // Save to local storage and sync batch backup
  useEffect(() => {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      if (isSupabaseConfigured && typeof window !== 'undefined') {
        supabase.from('app_collections').upsert({
          collection_name: 'system_users',
          id: 'all_users',
          data: { users },
          updated_at: new Date().toISOString()
        }, { onConflict: 'collection_name,id' }).then();
      }
    } catch (e) {
      console.error('Error saving users:', e);
    }
  }, [users]);

  const login = async (usernameInput: string, passwordInput: string): Promise<{ success: boolean; message?: string }> => {
    const cleanUser = usernameInput.trim().toUpperCase();
    const cleanPass = passwordInput.trim();

    if (!cleanUser || !cleanPass) {
      return { success: false, message: 'لطفاً نام کاربری و رمز عبور را وارد نمایید.' };
    }

    let matched = users.find(u => u.username.toUpperCase() === cleanUser);

    // If not found in memory, query Supabase directly in real-time (cross-device verification)
    if (!matched && isSupabaseConfigured && typeof window !== 'undefined') {
      try {
        const { data: row } = await supabase
          .from('app_collections')
          .select('data')
          .eq('collection_name', 'system_users')
          .eq('id', cleanUser)
          .maybeSingle();

        if (row?.data && row.data.username) {
          matched = row.data;
          setUsers(prev => {
            const next = [...prev.filter(u => u.username.toUpperCase() !== cleanUser), matched!];
            try { localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(next)); } catch (e) {}
            return next;
          });
        }
      } catch (e) {
        console.warn('Real-time cloud user lookup error:', e);
      }
    }

    if (!matched) {
      return { success: false, message: 'نام کاربری وارد شده در سامانه یافت نشد.' };
    }

    // Check if user account is deactivated
    if (matched.isActive === false) {
      return { 
        success: false, 
        message: 'این حساب کاربری در وضعیت غیرفعال قرار دارد و امکان ورود به سامانه را ندارد. تمامی اطلاعات کاربری شما محفوظ می‌باشد.' 
      };
    }

    // Check linked student status if applicable
    try {
      const storedStudentsRaw = localStorage.getItem('school_students_v1') || localStorage.getItem('localdb_students');
      if (storedStudentsRaw) {
        const studentList = JSON.parse(storedStudentsRaw);
        if (Array.isArray(studentList)) {
          const linkedStudent = studentList.find(s => 
            (matched.linkedStudentId && s.id === matched.linkedStudentId) ||
            (matched.studentId && s.id === matched.studentId) ||
            (s.nationalId && s.nationalId.trim().toUpperCase() === cleanUser)
          );
          if (linkedStudent && linkedStudent.isActive === false) {
            return {
              success: false,
              message: 'حساب کاربری این طلبه در وضعیت غیرفعال قرار گرفته است و امکان ورود وجود ندارد. پرونده و اطلاعات تحصیلی در سامانه محفوظ است.'
            };
          }
        }
      }
    } catch (err) {
      console.warn('Student activity check non-blocking error:', err);
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
      ...newUser,
      id: newUser.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      username,
      password: newUser.password || '8411924',
      name: newUser.name || newUser.fullName || username,
      fullName: newUser.fullName || newUser.name || username,
      level: newUser.level || 3,
      role: newUser.role || 'student',
      roleTitle: newUser.roleTitle || (newUser.level === 3 ? 'طلبه' : 'کاربر سفارشی'),
      scope: newUser.scope || (newUser.level === 3 ? 'self' : 'all'),
      gradeLabel: newUser.gradeLabel || '',
      mentorId: newUser.mentorId || 'shahpoori',
      linkedStudentId: newUser.linkedStudentId || newUser.studentId,
      studentId: newUser.studentId || newUser.linkedStudentId,
      studentName: newUser.studentName || newUser.name,
      isReadOnly: newUser.isReadOnly || false,
      canEdit: newUser.canEdit !== undefined ? newUser.canEdit : true,
      canManageUsers: newUser.canManageUsers || false,
      canBackup: newUser.canBackup !== undefined ? newUser.canBackup : true,
      isActive: newUser.isActive !== undefined ? newUser.isActive : true,
      allowedTabs: newUser.allowedTabs || (newUser.allowedModules ? (newUser.allowedModules as string[]) : ['todos', 'students']),
      allowedModules: newUser.allowedModules,
      avatarBg: newUser.avatarBg || (newUser.level === 1 ? 'bg-indigo-700' : newUser.level === 2 ? 'bg-amber-600' : 'bg-emerald-600'),
      createdAt: newUser.createdAt || new Date().toISOString(),
    };

    setUsers(prev => {
      const updated = [...prev.filter(u => u.username.toUpperCase() !== username), user];
      try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // Save individual user record in Supabase IMMEDIATELY!
    if (isSupabaseConfigured && typeof window !== 'undefined') {
      supabase.from('app_collections').upsert({
        collection_name: 'system_users',
        id: username,
        data: user,
        updated_at: new Date().toISOString()
      }, { onConflict: 'collection_name,id' }).then(({ error }) => {
        if (error) {
          console.error('Error saving user to Supabase:', error);
        }
      });
    }

    return { success: true };
  };

  const updateUser = (id: string, updates: Partial<AppUser>) => {
    setUsers(prev => {
      let targetUser: AppUser | undefined;
      const updatedList = prev.map(u => {
        if (u.id === id || u.username.toUpperCase() === id.toUpperCase()) {
          const updated = { ...u, ...updates };
          targetUser = updated;
          if (currentUser && (currentUser.id === id || currentUser.username.toUpperCase() === id.toUpperCase())) {
            setCurrentUser(updated);
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
          }
          return updated;
        }
        return u;
      });

      try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedList));
      } catch (e) {}

      if (targetUser && isSupabaseConfigured && typeof window !== 'undefined') {
        supabase.from('app_collections').upsert({
          collection_name: 'system_users',
          id: targetUser.username.toUpperCase(),
          data: targetUser,
          updated_at: new Date().toISOString()
        }, { onConflict: 'collection_name,id' }).then();
      }

      return updatedList;
    });
  };

  const deleteUser = (id: string) => {
    const target = users.find(u => u.id === id || u.username.toUpperCase() === id.toUpperCase());
    const usernameToDelete = target ? target.username.toUpperCase() : id.toUpperCase();

    setUsers(prev => {
      const filtered = prev.filter(u => u.id !== id && u.username.toUpperCase() !== id.toUpperCase());
      try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(filtered));
      } catch (e) {}
      return filtered;
    });

    if (currentUser && (currentUser.id === id || currentUser.username.toUpperCase() === id.toUpperCase())) {
      logout();
    }

    if (isSupabaseConfigured && typeof window !== 'undefined') {
      supabase.from('app_collections').delete().match({
        collection_name: 'system_users',
        id: usernameToDelete
      }).then();
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

    // پشتیبان‌گیری: فقط سوپر ادمین (سطح ۱) و مسئول آموزش
    if (tabId === 'backup') {
      return (
        currentUser.level === 1 ||
        currentUser.role === 'super_admin' ||
        currentUser.role === 'education_manager' ||
        currentUser.role === 'education_officer' ||
        currentUser.username.toUpperCase() === 'SHAH'
      );
    }

    // فعالیت‌های سایت: فقط سوپر ادمین / کاربران سطح ۱ و مسئول آموزش
    if (tabId === 'audit-logs') {
      return (
        currentUser.level === 1 ||
        currentUser.role === 'super_admin' ||
        currentUser.role === 'education_manager' ||
        currentUser.role === 'education_officer' ||
        currentUser.username.toUpperCase() === 'SHAH'
      );
    }

    // مدیریت کاربران: فقط سوپر ادمین (سطح ۱)
    if (tabId === 'user-management') {
      return currentUser.level === 1 && currentUser.role === 'super_admin';
    }

    // دستیار کلاس‌های مشاوره: برای مسئول پژوهش و مسئول مالی مخفی است
    if (tabId === 'consultation-advisor') {
      if (
        currentUser.role === 'research_manager' || 
        currentUser.role === 'research_officer' || 
        currentUser.role === 'finance_manager' || 
        currentUser.role === 'financial_officer' ||
        currentUser.username.toUpperCase() === 'YAZDANI' ||
        currentUser.username.toUpperCase() === 'MALI'
      ) {
        return false;
      }
      return currentUser.level === 1 || currentUser.level === 2;
    }

    // جمع‌بندی و هوش مصنوعی: برای مسئول پژوهش و مسئول مالی مخفی است
    if (tabId === 'summary') {
      if (
        currentUser.role === 'research_manager' || 
        currentUser.role === 'research_officer' || 
        currentUser.role === 'finance_manager' || 
        currentUser.role === 'financial_officer' ||
        currentUser.username.toUpperCase() === 'YAZDANI' ||
        currentUser.username.toUpperCase() === 'MALI'
      ) {
        return false;
      }
    }

    // کلاس‌های مشاوره (ارزیابی و نمرات): برای مسئول آموزش، مسئول پژوهش، مسئولین پایه و سوپر ادمین (سطح ۳ ممنوع است)
    if (tabId === 'counseling-classes') {
      if (currentUser.level === 3) return false;
      if (currentUser.role === 'finance_manager' || currentUser.role === 'financial_officer' || currentUser.username.toUpperCase() === 'MALI') {
        return false;
      }
      return (
        currentUser.level === 1 ||
        currentUser.role === 'education_manager' ||
        currentUser.role === 'education_officer' ||
        currentUser.role === 'research_manager' ||
        currentUser.role === 'research_officer' ||
        currentUser.role === 'grade_mentor' ||
        currentUser.role === 'grade_supervisor' ||
        currentUser.role.startsWith('grade_supervisor_') ||
        ['SHAH', 'YAZDANI', 'ISJ', 'HO', 'SOL', 'ASADI'].includes(currentUser.username.toUpperCase())
      );
    }

    if (currentUser.level === 1 && currentUser.role === 'super_admin') return true;

    // مسئول مالی منحصراً به این تب‌ها دسترسی دارد: بخش‌های منفک مالی + جریان کار، پیگیری‌ها، تقویم آموزشی، مدیریت کل طلاب، بانک اساتید
    const isFinanceUser = currentUser.role === 'finance_manager' || currentUser.role === 'financial_officer' || currentUser.username.toUpperCase() === 'MALI';
    if (isFinanceUser) {
      const allowedForFinance = [
        'finance-tuition',
        'finance-grade-mentors',
        'finance-teachers',
        'finance-lunch',
        'finance-loans-fund',
        'finance-expenses-reports',
        'workflow',
        'todos',
        'academic-calendar',
        'students',
        'teachers-bank',
        'finance',
        'user-credentials'
      ];
      return allowedForFinance.includes(tabId);
    }

    // بخش جریان کار و پیگیری‌ها منحصراً برای کاربران سطح ۱ و سطح ۲ در دسترس است
    if (tabId === 'workflow' || tabId === 'todos') {
      return currentUser.level === 1 || currentUser.level === 2;
    }
    // ساعت حضور و کارکرد: برای اساتید پایه و سایرین نمایش داده می‌شود
    if (tabId === 'presence-hours') {
      return true;
    }
    // رزرو نهار و شام طلاب: برای تمامی کاربران سطح ۳ (طلاب) و مدیران قابل دسترسی است
    if (tabId === 'student-meals') {
      if (currentUser.level === 3 || currentUser.role === 'student' || currentUser.role === 'class_representative') return true;
      return currentUser.level === 1;
    }
    // بخش برنامه‌های مدرسه، مَدرَس‌ها و تقویم آموزشی به صورت پیش‌فرض برای تمامی سطوح کاربران قابل مشاهده است
    if (tabId === 'programs' || tabId === 'classrooms' || tabId === 'academic-calendar') return true;
    // برنامه درسی اساتید: کاربران سطح 3 به صورت دیفالت نمی تونند ببینند؛ کاربران سطح 2 همه می توانند ببینند
    if (tabId === 'teachers-schedule') {
      if (currentUser.level === 3) return false;
      if (currentUser.level === 1 || currentUser.level === 2) return true;
    }
    if (tabId === 'user-credentials') {
      if (
        currentUser.role === 'super_admin' || 
        currentUser.role === 'education_manager' || 
        currentUser.role === 'education_officer' ||
        currentUser.username.toUpperCase() === 'SHAH'
      ) {
        return true;
      }
    }
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
