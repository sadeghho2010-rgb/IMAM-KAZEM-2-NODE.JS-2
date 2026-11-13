import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppUser, UserLevel, UserRole, UserScope } from '../types/auth';
import { realtimeSync } from '../lib/realtimeSync';
import { localDb } from '../lib/localDb';
import { verifySecurityPin } from '../components/auth/AccountSecurityPinModal';
import { normalizeDigits } from '../lib/utils';
import {
  isStudentPortalTargetAllowed,
  StudentPortalAccessConfig,
  STUDENT_PORTAL_CONFIG_DOC_ID
} from '../components/education/StudentAccessManagement';
import { hasActiveCriticalWrite, waitForActiveWrites, setWriteInProgress } from '../lib/saveFeedback';

export interface SystemTabDef {
  id: string;
  label: string;
  group: 'آموزش و تدریس' | 'مدیریت طلاب و کاربران' | 'امور مالی و تغذیه' | 'اساتید و پرسنلی' | 'پژوهش و هوش مصنوعی' | 'عمومی و جریان کار' | 'مدیریت سیستم و امنیت';
  description?: string;
  minLevel?: UserLevel;
}

export const ALL_SYSTEM_TABS: SystemTabDef[] = [
  // آموزش و تدریس
  { id: 'academic-calendar', label: 'تقویم آموزشی', group: 'آموزش و تدریس', description: 'مدیریت تقویم سالنامه، تعطیلات، پنج‌شنبه‌ها و سرفصل‌ها' },
  { id: 'programs', label: 'برنامه‌های مدرسه و سرفصل‌ها', group: 'آموزش و تدریس', description: 'ثبت و مدیریت برنامه‌ها، ساعات و اساتید دروس' },
  { id: 'student-schedule', label: 'برنامه درسی طلاب', group: 'آموزش و تدریس', description: 'مشاهده و چاپ برنامه هفتگی و زمان‌بندی طلاب' },
  { id: 'teachers-schedule', label: 'برنامه درسی اساتید', group: 'آموزش و تدریس', description: 'جدول زمان‌بندی و برنامه هفتگی تدریس اساتید' },
  { id: 'teacher-portal', label: 'پنل اختصاصی اساتید', group: 'آموزش و تدریس', description: 'مشاهده برنامه درسی، تقویم آموزشی و ثبت سریع ارزیابی مشاوره‌ها' },
  { id: 'classrooms', label: 'مدرس‌ها (کلاس‌های درس)', group: 'آموزش و تدریس', description: 'مدیریت فضاهای فیزیکی و اتاق‌های تدریس' },
  { id: 'discussion', label: 'گروه‌های بحثی و مباحثات', group: 'آموزش و تدریس', description: 'تنظیم و مدیریت گروه‌های مباحثه دو و چند نفره' },
  { id: 'course-selection', label: 'سامانه انتخاب واحد', group: 'آموزش و تدریس', description: 'دوره‌های انتخاب درس و تایید تقاضای طلاب' },
  { id: 'lockers', label: 'اختصاص کمد', group: 'آموزش و تدریس', description: 'مدیریت و واگذاری ۲۰۰ کمد، وضعیت فعال/خالی/پر/غیرفعال و سابقه امانت کلید' },
  { id: 'consultation-advisor', label: 'دستیار کلاس‌های مشاوره', group: 'آموزش و تدریس', description: 'هوشمندسازی چینش و زمان‌بندی مشاوره‌ها' },
  { id: 'counseling-classes', label: 'کلاس‌های مشاوره (ارزیابی و نمرات)', group: 'آموزش و تدریس', description: 'ثبت نمرات، کیفیت و مشارکت جلسات مشاوره' },
  { id: 'attendance', label: 'حضور و غیاب طلاب', group: 'آموزش و تدریس', description: 'ثبت غیبت، تاخیر، اخطارها و آمار حضور' },
  { id: 'held-sessions', label: 'تعداد جلسات برگزار شده', group: 'آموزش و تدریس', description: 'محاسبه جلسات تشکیل‌شده کلاس‌ها با تفکیک استاد اصلی، جایگزین و تعطیلات تقویم آموزشی' },
  { id: 'student-access-management', label: 'مدیریت دسترسی بخش‌های طلاب', group: 'مدیریت طلاب و کاربران', description: 'فعال یا غیرفعال‌سازی بخش‌های پنل طلاب به صورت سراسری یا اختصاصی برای هر طلبه' },

  // مدیریت طلاب و کاربران
  { id: 'student-requests', label: 'سامانه درخواست‌های طلاب', group: 'مدیریت طلاب و کاربران', description: 'ثبت، پیگیری و گردش آنلاین درخواست‌های آموزشی، مالی و رفاهی طلاب' },
  { id: 'students', label: 'مدیریت کل طلاب', group: 'مدیریت طلاب و کاربران', description: 'پرونده جامع، مشخصات، ویرایش و ثبت طلاب' },
  { id: 'active-students', label: 'طلاب فعال', group: 'مدیریت طلاب و کاربران', description: 'لیست سریع طلاب فعال دوره جاری' },
  { id: 'student-portal', label: 'پرتال اختصاصی طلبه', group: 'مدیریت طلاب و کاربران', description: 'صفحه کاربری طلبه جهت ثبت فعالیت و مشاهده پرونده' },
  { id: 'comments', label: 'نظرات و پرونده تربیتی', group: 'مدیریت طلاب و کاربران', description: 'یادداشت‌های تربیتی، اخلاقی و جلسات مصاحبه' },
  { id: 'oral-exams', label: 'آزمون شفاهی طلاب', group: 'مدیریت طلاب و کاربران', description: 'ثبت نمرات و محدوده‌های آزمون شفاهی فقه و اصول' },
  { id: 'warnings-management', label: 'مدیریت اخطارها', group: 'مدیریت طلاب و کاربران', description: 'پایش اخطارهای حضور و غیاب و ثبت مطالعه طلاب و چاپ فرم تعهدنامه و ابلاغیه قابل ویرایش' },
  { id: 'stats', label: 'آمار و ساعات مطالعه', group: 'مدیریت طلاب و کاربران', description: 'ثبت ساعات مطالعه دوره‌ای و گزارشات تجمعی' },

  // امور مالی و تغذیه
  { id: 'finance-tuition', label: 'محاسبه شهریه طلاب', group: 'امور مالی و تغذیه', description: 'تنظیم دوره‌ها، فرمول‌ها، ضرایب و مبالغ شهریه طلاب' },
  { id: 'finance-grade-mentors', label: 'محاسبه حق‌الزحمه اساتید پایه', group: 'امور مالی و تغذیه', description: 'حق‌الزحمه مسئولین و اساتید پایه‌ها بر اساس کارکرد' },
  { id: 'finance-teachers', label: 'محاسبه حق‌الزحمه اساتید', group: 'امور مالی و تغذیه', description: 'حق‌الزحمه دروس اصلی، مشاوره، پنج‌شنبه و جایگزین' },
  { id: 'education-financial-report', label: 'تنظیم گزارش مالی طلاب', group: 'امور مالی و تغذیه', description: 'ارسال گزارشات مالی آموزش جهت اعمال در شهریه' },
  { id: 'finance-lunch', label: 'اطلاعات نهار و شام', group: 'امور مالی و تغذیه', description: 'آمار، روزهای سرو و مبالغ رزرو نهار و شام' },
  { id: 'student-meals', label: 'رزرو نهار و شام طلاب', group: 'امور مالی و تغذیه', description: 'سامانه ثبت سفارش و رزرو وعده‌های غذایی طلاب' },
  { id: 'finance-claims', label: 'مطالبات و بدهی‌ها', group: 'امور مالی و تغذیه', description: 'کسورات متفرقه، جریمه‌ها و مطالبات ثبت‌شده' },
  { id: 'finance-loans-fund', label: 'صندوق قرض‌الحسنه و وام‌ها', group: 'امور مالی و تغذیه', description: 'وام‌های جاری، اقساط و حق عضویت صندوق' },
  { id: 'finance-expenses-reports', label: 'هزینه‌ها و بیلان مالی', group: 'امور مالی و تغذیه', description: 'گزارش تجمیعی مالی، بیلان و اسناد هزینه‌ها' },
  { id: 'finance', label: 'پیشخوان جامع مالی', group: 'امور مالی و تغذیه', description: 'داشبورد کلی و خلاصه آمار امور مالی' },

  // اساتید و پرسنلی
  { id: 'teachers-bank', label: 'بانک اساتید و مدرسین', group: 'اساتید و پرسنلی', description: 'اطلاعات کامل، رزومه، تخصص‌ها و حساب‌های اساتید' },
  { id: 'staff-bank', label: 'بانک کارکنان مجموعه', group: 'اساتید و پرسنلی', description: 'اطلاعات پرسنل اداری، خدماتی و پشتیبانی' },
  { id: 'teacher-transport', label: 'سرویس و ایاب و ذهاب اساتید', group: 'اساتید و پرسنلی', description: 'هماهنگی رانندگان، مسیرها و هزینه‌های ایاب و ذهاب' },
  { id: 'presence-hours', label: 'ساعت حضور و کارکرد', group: 'اساتید و پرسنلی', description: 'ثبت و تایید ساعات حضور کادر و اساتید' },

  // پژوهش و هوش مصنوعی
  { id: 'research', label: 'بخش پژوهش و مقالات', group: 'پژوهش و هوش مصنوعی', description: 'ارسال، پیگیری و دسته‌بندی مقالات پژوهشی' },
  { id: 'article-evaluations', label: 'ارزیابی مقالات پژوهش', group: 'پژوهش و هوش مصنوعی', description: 'داوری و امتیازدهی تخصصی مقالات توسط مسئول پژوهش' },
  { id: 'summary', label: 'جمع‌بندی و هوش مصنوعی', group: 'پژوهش و هوش مصنوعی', description: 'تحلیل جامع داده‌ها، خلاصه وضعیت و مشاوره هوشمند' },

  // عمومی و جریان کار
  { id: 'todos', label: 'پیگیری‌ها و تسک‌ها', group: 'عمومی و جریان کار', description: 'یادداشت‌های شخصی و کارهای محوله بین کادر' },
  { id: 'workflow', label: 'جریان کار و کارتابل تاییدات', group: 'عمومی و جریان کار', description: 'کارتابل گردش نامه‌ها، مصوبات و تاییدات سیستم' },

  // مدیریت سیستم و امنیت
  { id: 'user-management', label: 'تنظیمات کاربران و سطوح دسترسی', group: 'مدیریت سیستم و امنیت', description: 'تعریف کاربران، تعیین منوها و مجوزهای ویرایش' },
  { id: 'user-credentials', label: 'مدیریت ورود کاربران', group: 'مدیریت سیستم و امنیت', description: 'تولید شناسه ورود، بازنشانی رمز و چاپ کارت' },
  { id: 'anomaly-detection', label: 'تشخیص ناهنجاری‌ها و رولبک', group: 'مدیریت سیستم و امنیت', description: 'سامانه هوشمند مانیتورینگ تغییرات مشکوک و بازگردانی سریع' },
  { id: 'backup', label: 'پشتیبان‌گیری دیتابیس', group: 'مدیریت سیستم و امنیت', description: 'دریافت نسخه پشتیبان JSON و بازیابی داده‌ها' },
  { id: 'system-health', label: 'سلامت سیستم', group: 'مدیریت سیستم و امنیت', description: 'پایش زنده مصرف رم، کوئری‌های کند و خطاهای سرور' },
  { id: 'audit-logs', label: 'فعالیت‌های سایت و وقایع', group: 'مدیریت سیستم و امنیت', description: 'لاگ تمامی تغییرات، ورودها و اقدامات کاربران' },
  { id: 'app-logs', label: 'لاگ‌ها و خطاهای سیستم', group: 'مدیریت سیستم و امنیت', description: 'مانیتورینگ رخدادهای سیستمی و هشدارهای سرور' },
  { id: 'db-connection-test', label: 'تست اتصال به دیتابیس', group: 'مدیریت سیستم و امنیت', description: 'بررسی وضعیت سرور و سینک ابری' },
];

export const DEFAULT_USERS: AppUser[] = [
  // ====================== سطح ۱ (Level 1) ======================
  {
    id: 'user_sadegh',
    username: 'SADEGH',
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
    allowedTabs: ALL_SYSTEM_TABS.map(t => t.id),
    editableTabs: ALL_SYSTEM_TABS.map(t => t.id),
    modulePermissions: ALL_SYSTEM_TABS.reduce((acc, tab) => {
      acc[tab.id] = 'edit';
      return acc;
    }, {} as Record<string, 'none' | 'view' | 'edit'>),
  },
  {
    id: 'user_rahnama',
    username: 'RAHNAMA',
    name: 'استاد رهنما (مدیر مدرسه / معاون)',
    level: 1,
    role: 'school_manager',
    roleTitle: 'مدیر مدرسه / معاون',
    scope: 'all',
    gradeLabel: 'کل سیستم (مشاهده)',
    mentorId: 'shahpoori',
    isReadOnly: true,
    canEdit: false,
    canManageUsers: false,
    canBackup: true,
    avatarBg: 'bg-slate-700',
    allowedTabs: ALL_SYSTEM_TABS.filter(t => t.id !== 'user-management').map(t => t.id),
    editableTabs: [],
    modulePermissions: ALL_SYSTEM_TABS.reduce((acc, tab) => {
      acc[tab.id] = tab.id === 'user-management' ? 'none' : 'view';
      return acc;
    }, {} as Record<string, 'none' | 'view' | 'edit'>),
  },
];

interface AuthContextType {
  currentUser: AppUser | null;
  users: AppUser[];
  login: (username: string, password: string, pinInput?: string) => Promise<{ success: boolean; message?: string; requirePin?: boolean; mustChangePassword?: boolean; user?: any }>;
  logout: () => void;
  logoutAllSessions: () => Promise<{ success: boolean; message?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message?: string }>;
  adminResetPassword: (targetUserId: string, newPassword: string) => Promise<{ success: boolean; message?: string }>;
  addUser: (newUser: Partial<AppUser>) => Promise<{ success: boolean; error?: string; user?: AppUser }>;
  updateUser: (id: string, updates: Partial<AppUser> & { skipStudentDocUpsert?: boolean }) => void;
  deleteUser: (id: string, options?: { skipStudentSync?: boolean }) => Promise<{ success: boolean; error?: string }>;
  resetDefaultUsers: () => void;
  resetToDefaultUsers: () => void;
  toggleUserActive: (id: string) => void;
  isTabAllowed: (tabId: string, user?: AppUser) => boolean;
  hasModuleAccess: (tabId: string, user?: AppUser) => boolean;
  canEditTab: (tabId: string, user?: AppUser) => boolean;
  canEditModule: (tabId: string, user?: AppUser) => boolean;
  canEdit: boolean;
  isReadOnly: boolean;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USERS_STORAGE_KEY = 'hawzah_app_system_users_v3';
const CURRENT_USER_KEY = 'hawzah_app_current_user_v3';

export const STUDENT_DEFAULT_ALLOWED_TABS: string[] = [
  'dashboard', 'student-requests', 'student-portal', 'summary', 'student-meals', 'student-payments',
  'student-schedule', 'academic-calendar', 'discussion', 'research', 'attendance', 'stats',
  'course-selection', 'programs', 'classrooms', 'passed-courses', 'rep-attendance', 'self-reporting',
  'todos', 'security-pin-settings'
];

function getDefaultRoleTabAllowed(tabId: string, user: AppUser): boolean {
  if (user.level === 1) return true;

  const role = user.role;
  const username = (user.username || '').toUpperCase();

  // Finance manager
  if (role === 'finance_manager' || role === 'financial_officer' || username === 'MALI') {
    const allowed = [
      'student-requests', 'finance-tuition', 'finance-grade-mentors', 'finance-teachers', 'finance-lunch',
      'finance-claims', 'finance-loans-fund', 'finance-expenses-reports', 'finance',
      'workflow', 'todos', 'academic-calendar', 'students', 'teachers-bank', 'staff-bank',
      'teacher-transport', 'backup', 'system-health', 'user-credentials', 'audit-logs', 'app-logs'
    ];
    return allowed.includes(tabId);
  }

  // Research manager
  if (role === 'research_manager' || role === 'research_officer' || username === 'YAZDANI') {
    const allowed = [
      'student-requests', 'active-students', 'research', 'article-evaluations', 'counseling-classes',
      'todos', 'workflow', 'programs', 'classrooms', 'teachers-schedule', 'db-connection-test'
    ];
    return allowed.includes(tabId);
  }

  // Education manager (SHAH)
  if (role === 'education_manager' || role === 'education_officer' || username === 'SHAH') {
    const forbidden = [
      'article-evaluations', 'finance-tuition', 'finance-grade-mentors', 'finance-teachers',
      'finance-lunch', 'finance-claims', 'finance-loans-fund', 'finance-expenses-reports', 'finance'
    ];
    return !forbidden.includes(tabId);
  }

  // Grade supervisors / mentors (ISJ, HO, SOL, ASADI)
  if (role.startsWith('grade_supervisor') || role === 'grade_mentor' || ['ISJ', 'HO', 'SOL', 'ASADI'].includes(username)) {
    const allowed = [
      'student-requests', 'todos', 'workflow', 'academic-calendar', 'presence-hours', 'students', 'active-students',
      'passed-courses', 'programs', 'classrooms', 'student-schedule', 'teachers-schedule', 'consultation-advisor',
      'counseling-classes', 'discussion', 'stats', 'attendance', 'warnings-management', 'held-sessions', 'oral-exams', 'comments',
      'summary', 'teachers-bank', 'user-credentials'
    ];
    return allowed.includes(tabId);
  }

  // Level 3 (Teachers)
  if (role === 'teacher') {
    const allowed = [
      'teacher-portal', 'teachers-schedule', 'academic-calendar', 'counseling-classes'
    ];
    return allowed.includes(tabId);
  }

  // Level 3 (Students & class rep)
  if (user.level === 3 || role === 'student' || role === 'class_representative') {
    return STUDENT_DEFAULT_ALLOWED_TABS.includes(tabId);
  }

  return false;
}

function getDefaultRoleTabEditable(tabId: string, user: AppUser): boolean {
  if (user.isReadOnly === true || user.canEdit === false) return false;
  if (user.level === 1 && user.role === 'super_admin') return true;
  if (user.level === 1) return false; // school_manager / vice_principal are read-only
  
  // Student Requests Portal: All authorized users (students & officers) can submit or review requests
  if (tabId === 'student-requests') {
    return true;
  }

  // Teachers (Level 3): only allowed to edit their counseling classes evaluations
  if (user.role === 'teacher') {
    return tabId === 'counseling-classes' || tabId === 'teacher-portal';
  }

  if (user.level === 3) return false; // students cannot edit administrative items

  const role = user.role;
  const username = (user.username || '').toUpperCase();

  // Teachers bank: ONLY education manager and super admin can edit
  if (tabId === 'teachers-bank') {
    return role === 'education_manager' || role === 'education_officer' || username === 'SHAH';
  }

  // Academic calendar: ONLY education manager and super admin can edit
  if (tabId === 'academic-calendar') {
    return role === 'education_manager' || role === 'education_officer' || username === 'SHAH';
  }

  // Lockers, Student Access Management, and Held Sessions: education manager and super admin can edit
  if (tabId === 'lockers' || tabId === 'student-access-management' || tabId === 'held-sessions') {
    return role === 'education_manager' || role === 'education_officer' || username === 'SHAH' || role === 'super_admin';
  }

  // Education financial report: ONLY education manager and super admin can edit
  if (tabId === 'education-financial-report') {
    return role === 'education_manager' || role === 'education_officer' || username === 'SHAH';
  }

  // User credentials: education manager, super admin, and finance
  if (tabId === 'user-credentials') {
    return role === 'super_admin' || role === 'education_manager' || role === 'education_officer' || username === 'SHAH' || role === 'finance_manager';
  }

  // Backup: education manager, super admin, finance
  if (tabId === 'backup') {
    return role === 'super_admin' || role === 'education_manager' || role === 'education_officer' || username === 'SHAH' || role === 'finance_manager';
  }

  // System Health: super admin, education manager, and finance manager
  if (tabId === 'system-health') {
    return role === 'super_admin' || role === 'education_manager' || role === 'education_officer' || username === 'SHAH' || role === 'finance_manager' || (role as string) === 'finance_officer' || role === 'financial_officer' || username === 'MALI';
  }

  return true;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<AppUser[]>(() => {
    try {
      const saved = localStorage.getItem(USERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const userMap = new Map<string, AppUser>();
          // Only ensure mandatory SADEGH super admin exists; NEVER resurrect deleted default users like RAHNAMA
          const defaultSadegh = DEFAULT_USERS.find(u => u.username.toUpperCase() === 'SADEGH');
          if (defaultSadegh) {
            userMap.set('SADEGH', defaultSadegh);
          }

          parsed.forEach((u: AppUser) => {
            if (u && u.username) {
              const uname = u.username.toUpperCase();
              const existingDef = DEFAULT_USERS.find(du => du.username.toUpperCase() === uname);
              const isEduOrAdmin = u.role === 'education_manager' || u.role === 'education_officer' || uname === 'SHAH' || u.role === 'super_admin' || u.level === 1;
              const isFin = u.role === 'finance_manager' || (u.role as string) === 'finance_officer' || u.role === 'financial_officer' || uname === 'MALI' || (u.name && u.name.includes('مالی'));
              const isHealthAuthorized = isEduOrAdmin || isFin;
              const allowedTabs = Array.isArray(u.allowedTabs) ? [...u.allowedTabs] : (existingDef?.allowedTabs ? [...existingDef.allowedTabs] : ['todos', 'students']);
              const editableTabs = Array.isArray(u.editableTabs) ? [...u.editableTabs] : (existingDef?.editableTabs ? [...existingDef.editableTabs] : []);
              const modulePermissions = { ...(existingDef?.modulePermissions || {}), ...(u.modulePermissions || {}) };

              if (isEduOrAdmin) {
                if (!allowedTabs.includes('lockers')) allowedTabs.push('lockers');
                if (!editableTabs.includes('lockers')) editableTabs.push('lockers');
                if (!modulePermissions['lockers'] || modulePermissions['lockers'] === 'none') {
                  modulePermissions['lockers'] = 'edit';
                }
              }

              if (isHealthAuthorized) {
                if (!allowedTabs.includes('system-health')) allowedTabs.push('system-health');
                if (!editableTabs.includes('system-health')) editableTabs.push('system-health');
                if (!modulePermissions['system-health'] || modulePermissions['system-health'] === 'none') {
                  modulePermissions['system-health'] = 'edit';
                }
              }

              userMap.set(uname, {
                ...existingDef,
                ...u,
                username: uname,
                name: u.name || u.fullName || u.username,
                allowedTabs,
                editableTabs,
                modulePermissions,
              });
            }
          });
          return Array.from(userMap.values());
        }
      }
    } catch (e) {
      console.error('Error loading users from storage:', e);
    }
    return DEFAULT_USERS;
  });

  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const saved = localStorage.getItem(CURRENT_USER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.username) {
          const uname = parsed.username.toUpperCase();
          const found = DEFAULT_USERS.find(u => u.username.toUpperCase() === uname);
          const isEduOrAdmin = parsed.role === 'education_manager' || parsed.role === 'education_officer' || uname === 'SHAH' || parsed.role === 'super_admin' || parsed.level === 1;
          const isFin = parsed.role === 'finance_manager' || (parsed.role as string) === 'finance_officer' || parsed.role === 'financial_officer' || uname === 'MALI' || (parsed.name && parsed.name.includes('مالی'));
          const isHealthAuthorized = isEduOrAdmin || isFin;
          const allowedTabs = Array.isArray(parsed.allowedTabs) 
            ? [...parsed.allowedTabs] 
            : (Array.isArray(parsed.allowedModules) ? [...parsed.allowedModules] : (found?.allowedTabs ? [...found.allowedTabs] : ['todos', 'students']));
          const editableTabs = Array.isArray(parsed.editableTabs) ? [...parsed.editableTabs] : (found?.editableTabs ? [...found.editableTabs] : []);
          const modulePermissions = { ...(found?.modulePermissions || {}), ...(parsed.modulePermissions || {}) };

          if (isEduOrAdmin) {
            if (!allowedTabs.includes('lockers')) allowedTabs.push('lockers');
            if (!editableTabs.includes('lockers')) editableTabs.push('lockers');
            if (!modulePermissions['lockers'] || modulePermissions['lockers'] === 'none') {
              modulePermissions['lockers'] = 'edit';
            }
          }

          if (isHealthAuthorized) {
            if (!allowedTabs.includes('system-health')) allowedTabs.push('system-health');
            if (!editableTabs.includes('system-health')) editableTabs.push('system-health');
            if (!modulePermissions['system-health'] || modulePermissions['system-health'] === 'none') {
              modulePermissions['system-health'] = 'edit';
            }
          }

          const resolvedUser: AppUser = {
            ...found,
            ...parsed,
            username: uname,
            name: parsed.name || parsed.fullName || parsed.username || 'کاربر',
            allowedTabs,
            editableTabs,
            modulePermissions,
          };

          // Save migrated user back to localStorage
          try {
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(resolvedUser));
          } catch (e) {}

          return resolvedUser;
        }
      }
    } catch (e) {
      console.error('Error loading current user:', e);
    }
    return null;
  });

  const currentUserRef = useRef<AppUser | null>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const usersRef = useRef<AppUser[]>(users);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  // Short-lived local mutation guards (prevent concurrent background polls from temporarily flickering in-flight deletes/edits)
  const pendingDeletedUsersRef = useRef<Map<string, number>>(new Map());
  const pendingUpsertedUsersRef = useRef<Map<string, { user: AppUser; expiresAt: number }>>(new Map());
  const syncWithServerRef = useRef<((force?: boolean) => Promise<void>) | null>(null);
  const syncInFlightRef = useRef<boolean>(false);

  const [studentPortalAccessConfig, setStudentPortalAccessConfig] = useState<StudentPortalAccessConfig | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadPortalConfig = async () => {
      try {
        const doc = await localDb.getDoc<StudentPortalAccessConfig>('student_portal_access_config', STUDENT_PORTAL_CONFIG_DOC_ID);
        if (isMounted) {
          setStudentPortalAccessConfig(doc || null);
        }
      } catch (e) {
        console.warn('[STORAGE_FAILURE] loadPortalConfig error:', e);
      }
    };
    loadPortalConfig();
    const unsub = localDb.subscribe(() => {
      loadPortalConfig();
    });
    const handlePortalEvent = () => loadPortalConfig();
    const handleAppDataChange = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail?.collection || detail.collection === 'student_portal_access_config') {
        loadPortalConfig();
      }
    };
    window.addEventListener('student_portal_access_updated', handlePortalEvent);
    window.addEventListener('collection_change_student_portal_access_config', handlePortalEvent);
    window.addEventListener('app_data_change', handleAppDataChange);
    return () => {
      isMounted = false;
      unsub();
      window.removeEventListener('student_portal_access_updated', handlePortalEvent);
      window.removeEventListener('collection_change_student_portal_access_config', handlePortalEvent);
      window.removeEventListener('app_data_change', handleAppDataChange);
    };
  }, []);

  // Authoritatively synchronize users from Server API across all hosts, devices, and browser tabs
  useEffect(() => {
    let isMounted = true;

    const pruneExpiredGuards = () => {
      const now = Date.now();
      for (const [k, exp] of Array.from(pendingDeletedUsersRef.current.entries())) {
        if (exp <= now) pendingDeletedUsersRef.current.delete(k);
      }
      for (const [k, entry] of Array.from(pendingUpsertedUsersRef.current.entries())) {
        if (entry.expiresAt <= now) pendingUpsertedUsersRef.current.delete(k);
      }
    };

    const processIncomingUsers = (incomingList: Partial<AppUser>[]) => {
      if (!isMounted || !Array.isArray(incomingList) || incomingList.length === 0) return;
      pruneExpiredGuards();

      let mergedResult: AppUser[] = [];

      setUsers(prev => {
        const prevById = new Map<string, AppUser>();
        const prevByUsername = new Map<string, AppUser>();
        prev.forEach(u => {
          if (u.id) prevById.set(String(u.id), u);
          if (u.username) prevByUsername.set(u.username.toUpperCase(), u);
        });

        const userById = new Map<string, AppUser>();
        const userByUsername = new Map<string, AppUser>();

        // AUTHORITATIVE REPLACEMENT: Build strictly from server incomingList (NEVER pre-seed with prev or non-SADEGH defaults)
        incomingList.forEach((u: Partial<AppUser>) => {
          if (!u || (!u.username && !u.id)) return;
          const rawUname = String(u.username || u.id || '').trim().toUpperCase();
          const rawId = u.id ? String(u.id) : '';

          // Skip users currently undergoing local deletion confirmation
          if (
            (rawId && pendingDeletedUsersRef.current.has(rawId)) ||
            (rawId && pendingDeletedUsersRef.current.has(rawId.toUpperCase())) ||
            pendingDeletedUsersRef.current.has(rawUname)
          ) {
            return;
          }

          // Preserve local client-side fallback fields only for users that ACTUALLY exist on the server
          const prevUser = (rawId && prevById.get(rawId)) || prevByUsername.get(rawUname);

          const resolvedId = rawId || prevUser?.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const normalizedUser: AppUser = {
            ...(prevUser || {} as AppUser),
            ...u,
            id: resolvedId,
            username: rawUname,
            password: (u.password && u.password.trim() !== '') ? u.password.trim() : (prevUser?.password || ''),
            name: u.name || u.fullName || prevUser?.name || rawUname,
            level: ((Number(u.level) || (u.role === 'teacher' ? 3 : (prevUser?.level || 2))) as UserLevel),
            role: u.role || prevUser?.role || 'custom',
            roleTitle: u.roleTitle || prevUser?.roleTitle || (u.role === 'teacher' ? 'استاد مدرسه' : 'کاربر سیستم'),
            gradeLabel: u.gradeLabel || (u as any).grade || prevUser?.gradeLabel || '',
            allowedTabs: Array.isArray(u.allowedTabs) ? u.allowedTabs : prevUser?.allowedTabs || ['todos', 'students'],
            editableTabs: Array.isArray(u.editableTabs) ? u.editableTabs : prevUser?.editableTabs || [],
            modulePermissions: u.modulePermissions || prevUser?.modulePermissions || {},
            isReadOnly: u.isReadOnly !== undefined ? u.isReadOnly : (prevUser?.isReadOnly || false),
            canEdit: u.canEdit !== undefined ? u.canEdit : (prevUser?.canEdit !== undefined ? prevUser.canEdit : true),
          };

          userById.set(normalizedUser.id, normalizedUser);
          userByUsername.set(rawUname, normalizedUser);
        });

        // Apply any unexpired local pending upserts (if not yet reflected or fresher)
        for (const [uname, entry] of pendingUpsertedUsersRef.current.entries()) {
          if (pendingDeletedUsersRef.current.has(uname) || pendingDeletedUsersRef.current.has(entry.user.id)) continue;
          const serverCopy = userByUsername.get(uname) || userById.get(entry.user.id);
          const localTs = entry.user.updatedAt ? new Date(entry.user.updatedAt).getTime() : 0;
          const serverTs = serverCopy?.updatedAt ? new Date(serverCopy.updatedAt).getTime() : 0;
          if (!serverCopy || localTs > serverTs) {
            userById.set(entry.user.id, entry.user);
            userByUsername.set(uname, entry.user);
          }
        }

        // Guarantee mandatory SADEGH super admin stays present
        if (!userByUsername.has('SADEGH')) {
          const defaultSadegh = DEFAULT_USERS.find(du => du.username.toUpperCase() === 'SADEGH');
          if (defaultSadegh) {
            userById.set(defaultSadegh.id, defaultSadegh);
            userByUsername.set('SADEGH', defaultSadegh);
          }
        }

        const merged = Array.from(userById.values());
        mergedResult = merged;

        let hasUsersChanged = false;
        try {
          const oldStr = localStorage.getItem(USERS_STORAGE_KEY);
          const newStr = JSON.stringify(merged);
          hasUsersChanged = oldStr !== newStr || prev.length !== merged.length;
          if (hasUsersChanged) {
            localStorage.setItem(USERS_STORAGE_KEY, newStr);
          }
        } catch (e) {
          hasUsersChanged = true;
        }

        // Always keep IndexedDB & fallback_idb_* caches pruned to the authoritative list
        localDb.replaceAuthoritativeUsersCache(merged).catch((err) => {
          console.warn('[STORAGE_FAILURE] replaceAuthoritativeUsersCache warning:', err);
        });

        if (!hasUsersChanged) {
          return prev;
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('app_users_updated', { detail: merged }));
        }
        return merged;
      });

      // Verify & refresh active user state: if active user was deleted or deactivated on another device, kick out immediately!
      const activeUser = currentUserRef.current;
      if (activeUser && activeUser.username) {
        const activeUname = activeUser.username.toUpperCase();
        const updatedMatch = (mergedResult.length > 0 ? mergedResult : incomingList).find(
          u => (u.username || u.id || '').toUpperCase() === activeUname
        );

        if (!updatedMatch && activeUname !== 'SADEGH' && !pendingUpsertedUsersRef.current.has(activeUname)) {
          console.warn(`[Security Sync] Active user "${activeUname}" was deleted on server. Logging out.`);
          logout();
          return;
        }

        if (updatedMatch) {
          if (updatedMatch.isActive === false && activeUname !== 'SADEGH') {
            console.warn(`[Security Sync] Active user "${activeUname}" was deactivated on server. Logging out.`);
            logout();
            return;
          }

          setCurrentUser(prev => {
            if (!prev || prev.username.toUpperCase() !== activeUname) return prev;
            const updated: AppUser = {
              ...prev,
              ...updatedMatch,
              username: activeUname,
              allowedTabs: Array.isArray(updatedMatch.allowedTabs) ? updatedMatch.allowedTabs : prev.allowedTabs,
              editableTabs: Array.isArray(updatedMatch.editableTabs) ? updatedMatch.editableTabs : prev.editableTabs,
              modulePermissions: updatedMatch.modulePermissions || prev.modulePermissions,
            };
            try {
              const oldStr = localStorage.getItem(CURRENT_USER_KEY);
              const newStr = JSON.stringify(updated);
              if (oldStr === newStr) return prev;
              localStorage.setItem(CURRENT_USER_KEY, newStr);
            } catch (e) {}
            return updated;
          });
        }
      }
    };

    const refreshAccessToken = async (): Promise<string | null> => {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
          credentials: 'include'
        });
        if (!res.ok) return null;
        const data = await res.json().catch(() => null);
        if (data?.success && data?.token) {
          try {
            localStorage.setItem('auth_token', data.token);
            sessionStorage.setItem('auth_token', data.token);
          } catch (e) {}
          return data.token;
        }
      } catch (e) {
        console.warn('[AUTH_REFRESH_WARNING]', e);
      }
      return null;
    };

    // 1. Direct Server API fetch with strict cache-busting & 401 refresh support
    const syncWithServer = async (force = false) => {
      if (syncInFlightRef.current && !force) return;
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      if (!token) return;

      syncInFlightRef.current = true;
      try {
        const makeHeaders = (t: string): Record<string, string> => ({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${t}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        });

        let res = await fetch(`/api/auth/users?_t=${Date.now()}`, {
          method: 'GET',
          headers: makeHeaders(token),
          cache: 'no-store',
          credentials: 'include'
        });

        if (res.status === 401) {
          const freshToken = await refreshAccessToken();
          if (freshToken) {
            res = await fetch(`/api/auth/users?_t=${Date.now()}`, {
              method: 'GET',
              headers: makeHeaders(freshToken),
              cache: 'no-store',
              credentials: 'include'
            });
          }
        }

        if (!res.ok && res.status !== 503 && res.status !== 401 && res.status !== 403) {
          // Fallback to /api/auth/public-users only when primary endpoint is unavailable (not on DB error or auth failure)
          const activeToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || token;
          res = await fetch(`/api/auth/public-users?_t=${Date.now()}`, {
            method: 'GET',
            headers: makeHeaders(activeToken),
            cache: 'no-store',
            credentials: 'include'
          });
        }

        if (res.ok) {
          const result = await res.json();
          if (result.success && Array.isArray(result.users) && result.users.length > 0) {
            processIncomingUsers(result.users);
          }
        }
      } catch (e) {
        console.warn('[USER_SYNC_WARNING] syncWithServer failed:', e);
      } finally {
        syncInFlightRef.current = false;
      }
    };

    syncWithServerRef.current = syncWithServer;

    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token'))
      : null;

    if (token) {
      syncWithServer(true);
      realtimeSync.start();
    } else {
      realtimeSync.stop();
    }

    // 2. Real-time Synchronization Listener (SSE & MySQL Event Bus + BroadcastChannel)
    const unsubscribeRealtime = realtimeSync.subscribe((evt) => {
      if (
        evt.collection === 'system_users' ||
        evt.collection === 'all_users' ||
        evt.collection === 'users' ||
        evt.collection === 'students'
      ) {
        syncWithServer(true);
      }
    });

    const handleFocus = () => {
      const currentToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      if (currentToken) {
        syncWithServer(true);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleFocus();
      }
    };

    // 3. Cross-tab instant synchronization via storage event
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === USERS_STORAGE_KEY && e.newValue && isMounted) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setUsers(parsed);
            window.dispatchEvent(new CustomEvent('app_users_updated', { detail: parsed }));
          }
        } catch (err) {}
      } else if (e.key === CURRENT_USER_KEY && !e.newValue && currentUserRef.current) {
        setCurrentUser(null);
        currentUserRef.current = null;
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('storage', handleStorageEvent);

    // 4. Periodic background sync every 8 seconds (only when authenticated)
    const syncInterval = setInterval(() => {
      const currentToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      if (currentToken) {
        syncWithServer();
      }
    }, 8000);

    return () => {
      isMounted = false;
      syncWithServerRef.current = null;
      clearInterval(syncInterval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageEvent);
      unsubscribeRealtime();
    };
  }, []);

  // Ensure realtimeSync starts and authoritative users sync runs immediately after login
  useEffect(() => {
    if (currentUser) {
      realtimeSync.start();
      syncWithServerRef.current?.(true);
    }
  }, [currentUser?.username]);

  // Save to local storage
  useEffect(() => {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('Error saving users to local storage:', e);
    }
  }, [users]);

  // Automatically verify server session on app initialization
  useEffect(() => {
    let isMounted = true;
    const verifySession = async () => {
      try {
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        if (!token) {
          return;
        }

        const res = await fetch('/api/auth/me', {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          credentials: 'include'
        });

        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user && isMounted) {
            const serverUsername = (data.user.username || '').toUpperCase();
            const activeUser = currentUserRef.current;
            
            // If active user in storage doesn't match the token user on server, do not cross-assign
            if (activeUser && activeUser.username.toUpperCase() !== serverUsername) {
              console.warn('Session user mismatch detected.');
              return;
            }

            setCurrentUser(prev => {
              if (!prev) return data.user;
              const updated = {
                ...prev,
                ...data.user,
                allowedTabs: Array.isArray(data.user.allowedTabs) ? data.user.allowedTabs : prev?.allowedTabs || [],
                editableTabs: Array.isArray(data.user.editableTabs) ? data.user.editableTabs : prev?.editableTabs || [],
                modulePermissions: data.user.modulePermissions || prev?.modulePermissions || {},
              };
              try {
                localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
              } catch (e) {}
              return updated;
            });
          }
        } else if (res.status === 401 || res.status === 403) {
          // Token is expired on server
          if (isMounted) {
            logout();
          }
        }
      } catch (e) {}
    };

    verifySession();
    return () => { isMounted = false; };
  }, []);

  const login = async (usernameInput: string, passwordInput: string, pinInput?: string): Promise<{ success: boolean; message?: string; requirePin?: boolean; mustChangePassword?: boolean; user?: any }> => {
    const cleanUser = normalizeDigits(usernameInput).trim().toUpperCase();
    const cleanPass = normalizeDigits(passwordInput).trim();

    if (!cleanUser || !cleanPass) {
      return { success: false, message: 'لطفاً نام کاربری و رمز عبور را وارد نمایید.' };
    }

    const localMatched = (users && users.length ? users : DEFAULT_USERS).find(u => u.username.toUpperCase() === cleanUser);

    // Check if security PIN is enabled for this user account
    if (localMatched?.securityPinEnabled && localMatched?.specialSecurityPinHash) {
      const cleanPin = (pinInput || '').trim();
      if (!cleanPin) {
        return { 
          success: false, 
          requirePin: true, 
          message: 'این حساب دارای سطح امنیتی بالاست. لطفاً کد پین ۴ رقمی خود را وارد نمایید.' 
        };
      }
      const isPinValid = await verifySecurityPin(cleanPin, localMatched.specialSecurityPinHash);
      if (!isPinValid) {
        return { 
          success: false, 
          requirePin: true, 
          message: 'کد پین ۴ رقمی امنیتی وارد شده نادرست است.' 
        };
      }
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: cleanUser, password: cleanPass })
      });

      const result = await response.json().catch(() => ({ success: false }));

      if (response.ok && result.success) {
        if (result.mustChangePassword) {
          return {
            success: false,
            mustChangePassword: true,
            message: result.message || 'تغییر رمز عبور در اولین ورود الزامی است.',
            user: result.user
          };
        }

        if (result.user) {
          const user = result.user as AppUser;
        const localMatched = (users && users.length ? users : DEFAULT_USERS).find(u => u.username.toUpperCase() === cleanUser);
        const mergedUser: AppUser = {
          ...user,
          allowedTabs: localMatched?.allowedTabs || user.allowedTabs || [],
          editableTabs: localMatched?.editableTabs || user.editableTabs || [],
          modulePermissions: localMatched?.modulePermissions || user.modulePermissions || {},
        };

        if (result.token) {
          try {
            localStorage.setItem('auth_token', result.token);
            sessionStorage.setItem('auth_token', result.token);
          } catch (e) {}
        }

        setCurrentUser(mergedUser);
        try {
          localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(mergedUser));
        } catch (e) {}

        if (mergedUser.mentorId) {
          localStorage.setItem('current_mentor_id', mergedUser.mentorId);
          if (mergedUser.role === 'grade_mentor') {
            localStorage.setItem('shahpoori_active_filter', mergedUser.mentorId);
          }
        }

        return { success: true };
        }
      }

      // If server explicitly returned 401 with bad credentials
      if (response.status === 401) {
        return { success: false, message: result.message || 'نام کاربری یا رمز عبور اشتباه است.' };
      }

      // If server returned 502 / 503 / 504 Gateway errors (restarting container / reverse proxy cold boot)
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        return {
          success: false,
          message: 'سرور در حال راه‌اندازی یا به‌روزرسانی اولیه است (کد ' + response.status + '). لطفاً ۲۰ الی ۳۰ ثانیه دیگر مجدداً دکمه ورود را بزنید.'
        };
      }

      // If server returned 500 internal server error
      if (response.status === 500) {
        return {
          success: false,
          message: result.message || 'خطای موقت در سرور هنگام بررسی ورود (کد ۵۰۰). لطفاً دوباره امتحان کنید.'
        };
      }

      return { success: false, message: result.message || 'نام کاربری یا رمز عبور اشتباه است.' };
    } catch (apiErr) {
      return { 
        success: false, 
        message: 'خطا در ارتباط با سرور احراز هویت. لطفاً اتصال اینترنت خود را بررسی نموده و مجدداً تلاش فرمایید.' 
      };
    }
  };

  const logout = async () => {
    if (hasActiveCriticalWrite()) {
      setWriteInProgress('logout_wait', true, 'در حال تکمیل ثبت اطلاعات در سرور قبل از خروج... لطفاً چند لحظه صبر کنید.');
      try {
        await localDb.flushSyncQueue();
        await waitForActiveWrites(6000);
      } finally {
        setWriteInProgress('logout_wait', false);
      }
    }

    setCurrentUser(null);
    currentUserRef.current = null;
    try {
      localStorage.removeItem(CURRENT_USER_KEY);
      localStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_token');
      localStorage.removeItem('access_token');
      sessionStorage.removeItem('access_token');
      localStorage.removeItem('current_mentor_id');
      localStorage.removeItem('shahpoori_active_filter');
    } catch (e) {}

    // Clear IndexedDB caches and reset seeding flag
    localDb.clearAllLocalDataAndCaches().catch((err) => {
      console.warn('[LOGOUT_CACHE_CLEAR_WARN]', err);
    });
    realtimeSync.stop();

    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    }).catch((err) => {
      console.warn('[LOGOUT_API_WARN]', err);
    });
  };

  const logoutAllSessions = async (): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await fetch('/api/auth/logout-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await res.json();
      setCurrentUser(null);
      try { localStorage.removeItem(CURRENT_USER_KEY); } catch (e) {}
      return { success: res.ok && data.success, message: data.message };
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'خطا در ابطال نشست‌ها.';
      return { success: false, message: errMsg };
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      return { success: res.ok && data.success, message: data.message };
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'خطا در ارتباط با سرور تغییر رمز عبور.';
      return { success: false, message: errMsg };
    }
  };

  const adminResetPassword = async (targetUserId: string, newPassword: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/auth/admin-reset-password', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ targetUserId, newPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(prev => {
          const updated = prev.map(u => {
            if (u.id === targetUserId || u.username.toUpperCase() === targetUserId.toUpperCase()) {
              return { ...u, password: newPassword.trim(), mustChangePassword: false };
            }
            return u;
          });
          try { localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated)); } catch (e) {}
          return updated;
        });
      }
      return { success: res.ok && data.success, message: data.message };
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'خطا در بازنشانی رمز عبور.';
      return { success: false, message: errMsg };
    }
  };

  const addUser = async (newUser: Partial<AppUser>): Promise<{ success: boolean; error?: string; user?: AppUser }> => {
    const username = (newUser.username || '').trim().toUpperCase();
    if (!username) return { success: false, error: 'نام کاربری الزامی است' };

    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const isNewUserStudent = (newUser.level === 3 || newUser.role === 'student' || newUser.role === 'class_representative') && newUser.role !== 'teacher';
    const allowedTabs = newUser.allowedTabs || (newUser.allowedModules ? (newUser.allowedModules as string[]) : (isNewUserStudent ? STUDENT_DEFAULT_ALLOWED_TABS : ['todos', 'students']));
    const editableTabs = newUser.editableTabs || allowedTabs;
    const modulePermissions = newUser.modulePermissions || allowedTabs.reduce((acc, t) => {
      acc[t] = editableTabs.includes(t) ? 'edit' : 'view';
      return acc;
    }, {} as Record<string, 'none' | 'view' | 'edit'>);

    const user: AppUser = {
      ...newUser,
      id: newUser.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      username,
      password: newUser.password || '',
      name: newUser.name || newUser.fullName || username,
      fullName: newUser.fullName || newUser.name || username,
      level: newUser.level || (newUser.role === 'teacher' ? 3 : 2),
      role: newUser.role || 'custom',
      roleTitle: newUser.roleTitle || (newUser.role === 'teacher' ? 'استاد مدرسه' : newUser.level === 3 ? 'طلبه' : 'کاربر سیستم'),
      scope: newUser.scope || (newUser.level === 3 ? 'self' : 'all'),
      gradeLabel: newUser.gradeLabel || '',
      managedGrades: newUser.managedGrades || [],
      mentorId: newUser.mentorId || 'shahpoori',
      linkedStudentId: newUser.linkedStudentId || newUser.studentId,
      studentId: newUser.studentId || newUser.linkedStudentId,
      studentName: newUser.studentName || newUser.name,
      teacherId: newUser.teacherId || newUser.linkedTeacherId,
      linkedTeacherId: newUser.linkedTeacherId || newUser.teacherId,
      isReadOnly: newUser.isReadOnly || false,
      canEdit: newUser.canEdit !== undefined ? newUser.canEdit : true,
      canManageUsers: newUser.canManageUsers || false,
      canBackup: newUser.canBackup !== undefined ? newUser.canBackup : true,
      isActive: newUser.isActive !== undefined ? newUser.isActive : true,
      allowedTabs,
      editableTabs,
      modulePermissions,
      avatarBg: newUser.avatarBg || (newUser.level === 1 ? 'bg-indigo-700' : newUser.level === 2 ? 'bg-amber-600' : 'bg-emerald-600'),
      createdAt: newUser.createdAt || new Date().toISOString(),
    };

    try {
      const response = await fetch('/api/auth/add-user', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ user })
      });

      const result = await response.json().catch(() => ({ success: false }));

      if (response.status === 401 || response.status === 403) {
        logout();
        return { success: false, error: 'نشست کاربری شما منقضی شده است. لطفاً دوباره وارد شوید.' };
      }

      if (!response.ok || !result.success) {
        return { success: false, error: result.message || 'خطا در ثبت کاربر در سرور.' };
      }

      const serverUser: AppUser = { ...user, ...(result.user || {}), username };
      pendingUpsertedUsersRef.current.set(username, {
        user: serverUser,
        expiresAt: Date.now() + 15000
      });
      pendingDeletedUsersRef.current.delete(username);
      pendingDeletedUsersRef.current.delete(serverUser.id);

      let nextUsersSnapshot: AppUser[] = [];
      setUsers(prev => {
        const updated = [...prev.filter(u => u.username.toUpperCase() !== username && u.id !== serverUser.id), serverUser];
        nextUsersSnapshot = updated;
        try {
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });

      // Synchronize student document locally in localDb if linked
      const studentId = serverUser.linkedStudentId || serverUser.studentId;
      if (studentId) {
        localDb.updateDoc('students', studentId, {
          hasUserAccount: true,
          userAccountUsername: username
        }).catch((err) => {
          console.warn('[STORAGE_FAILURE] addUser student sync warning:', err);
        });
      } else {
        localDb.getDocs<any>('students').then(students => {
          const st = students.find(s =>
            (s.nationalId && String(s.nationalId).trim().toUpperCase() === username) ||
            (s.name && String(s.name).trim() === String(serverUser.name || serverUser.fullName).trim())
          );
          if (st) {
            localDb.updateDoc('students', st.id, {
              hasUserAccount: true,
              userAccountUsername: username
            }).catch((err) => {
              console.warn('[STORAGE_FAILURE] addUser student fallback sync warning:', err);
            });
          }
        }).catch((err) => {
          console.warn('[STORAGE_FAILURE] addUser getDocs students warning:', err);
        });
      }

      if (typeof window !== 'undefined') {
        const detailUsers = nextUsersSnapshot.length > 0
          ? nextUsersSnapshot
          : [...usersRef.current.filter(u => u.username.toUpperCase() !== username), serverUser];
        window.dispatchEvent(new CustomEvent('app_users_updated', { detail: detailUsers }));
        window.dispatchEvent(new CustomEvent('collection_change_students', { detail: { collection: 'students' } }));
      }

      // Read-After-Write verification sync
      void syncWithServerRef.current?.(true);

      return { success: true, user: serverUser };
    } catch (e: any) {
      console.error('[STORAGE_FAILURE] addUser error:', e);
      return { success: false, error: 'خطا در ارتباط با سرور هنگام ثبت کاربر.' };
    }
  };

  const updateUser = async (id: string, updates: Partial<AppUser>) => {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    setUsers(prev => {
      let targetUser: AppUser | undefined;
      const cleanId = String(id).toUpperCase();
      const studentId = updates.linkedStudentId || updates.studentId || (id.startsWith('user_fallback_') ? id.replace('user_fallback_', '') : undefined);
      const cleanUsername = (updates.username || '').trim().toUpperCase();

      const updatedList = prev.map(u => {
        const uId = String(u.id);
        const uUname = (u.username || '').trim().toUpperCase();
        const uStudentId = String(u.linkedStudentId || u.studentId || '');

        const matchesId = uId === id || uUname === cleanId;
        const matchesStudent = Boolean(studentId && uStudentId && uStudentId === String(studentId));
        const matchesUsername = Boolean(cleanUsername && uUname === cleanUsername);

        if (matchesId || matchesStudent || matchesUsername) {
          let finalModulePermissions: Record<string, 'none' | 'view' | 'edit'> = {};
          let finalAllowedTabs: string[] = [];
          let finalEditableTabs: string[] = [];

          if (updates.modulePermissions && typeof updates.modulePermissions === 'object') {
            finalModulePermissions = { ...updates.modulePermissions };
            ALL_SYSTEM_TABS.forEach(tab => {
              if (!(tab.id in finalModulePermissions)) {
                const prevPerm = u.modulePermissions?.[tab.id];
                if (prevPerm) {
                  finalModulePermissions[tab.id] = prevPerm;
                } else if (u.allowedTabs?.includes(tab.id)) {
                  finalModulePermissions[tab.id] = (u.editableTabs || []).includes(tab.id) ? 'edit' : 'view';
                } else {
                  finalModulePermissions[tab.id] = 'none';
                }
              }
            });
            finalAllowedTabs = Object.entries(finalModulePermissions)
              .filter(([_, perm]) => perm === 'view' || perm === 'edit')
              .map(([tabId]) => tabId);
            finalEditableTabs = Object.entries(finalModulePermissions)
              .filter(([_, perm]) => perm === 'edit')
              .map(([tabId]) => tabId);
          } else if (updates.allowedTabs !== undefined || updates.editableTabs !== undefined) {
            const allowed = updates.allowedTabs !== undefined ? updates.allowedTabs : (u.allowedTabs || []);
            const editable = updates.editableTabs !== undefined ? updates.editableTabs : (u.editableTabs || []);
            ALL_SYSTEM_TABS.forEach(tab => {
              if (allowed.includes(tab.id)) {
                finalModulePermissions[tab.id] = editable.includes(tab.id) ? 'edit' : 'view';
              } else {
                finalModulePermissions[tab.id] = 'none';
              }
            });
            finalAllowedTabs = allowed;
            finalEditableTabs = editable.filter(t => allowed.includes(t));
          } else {
            finalModulePermissions = u.modulePermissions || {};
            finalAllowedTabs = u.allowedTabs || [];
            finalEditableTabs = u.editableTabs || [];
          }

          const updated: AppUser = { 
            ...u, 
            ...updates,
            id: u.id && !u.id.startsWith('user_fallback_') ? u.id : (id.startsWith('user_fallback_') ? `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}` : id),
            username: cleanUsername || uUname || cleanId,
            password: (updates.password && updates.password.trim() !== '') ? updates.password.trim() : (u.password || ''),
            linkedStudentId: studentId || u.linkedStudentId || u.studentId,
            studentId: studentId || u.studentId || u.linkedStudentId,
            allowedTabs: finalAllowedTabs,
            editableTabs: finalEditableTabs,
            modulePermissions: finalModulePermissions,
            updatedAt: new Date().toISOString()
          };
          targetUser = updated;

          const activeUser = currentUserRef.current;
          if (activeUser && (activeUser.id === id || activeUser.username.toUpperCase() === id.toUpperCase() || activeUser.username.toUpperCase() === u.username.toUpperCase())) {
            setCurrentUser(updated);
            try {
              localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
            } catch (e) {}
          }
          return updated;
        }
        return u;
      });

      if (!targetUser) {
        const fallbackUname = cleanUsername || cleanId;
        const realUserId = id.startsWith('user_fallback_') ? `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}` : id;
        const defaultAllowed = updates.allowedTabs || ['todos', 'students'];
        const defaultEditable = updates.editableTabs || [];
        const defaultPerms: Record<string, 'none' | 'view' | 'edit'> = {};
        ALL_SYSTEM_TABS.forEach(tab => {
          if (defaultAllowed.includes(tab.id)) {
            defaultPerms[tab.id] = defaultEditable.includes(tab.id) ? 'edit' : 'view';
          } else {
            defaultPerms[tab.id] = 'none';
          }
        });

        targetUser = {
          id: realUserId,
          username: fallbackUname,
          name: updates.name || updates.fullName || fallbackUname,
          fullName: updates.fullName || updates.name || fallbackUname,
          level: updates.level || 3,
          role: updates.role || 'student',
          roleTitle: updates.roleTitle || 'طلبه',
          scope: updates.scope || 'self',
          gradeLabel: updates.gradeLabel || '',
          linkedStudentId: studentId,
          studentId: studentId,
          studentName: updates.studentName || updates.name,
          isActive: updates.isActive !== undefined ? updates.isActive : true,
          isReadOnly: updates.isReadOnly || false,
          canEdit: updates.canEdit !== undefined ? updates.canEdit : true,
          allowedTabs: defaultAllowed,
          editableTabs: defaultEditable,
          modulePermissions: updates.modulePermissions || defaultPerms,
          avatarBg: updates.avatarBg || 'bg-emerald-600',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...updates
        } as AppUser;

        updatedList.push(targetUser);
      }

      try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedList));
      } catch (e) {}

      // Synchronize student document locally in localDb if linked and not skipped
      const targetStudentId = targetUser.linkedStudentId || targetUser.studentId;
      if (targetStudentId && !(updates as any)?.skipStudentDocUpsert) {
        localDb.getDoc('students', targetStudentId).then(existingStudent => {
          if (existingStudent && (existingStudent.hasUserAccount || existingStudent.userAccountUsername)) {
            localDb.updateDoc('students', targetStudentId, {
              hasUserAccount: true,
              userAccountUsername: targetUser.username
            }).catch(() => {});
          }
        }).catch(() => {});
      }

      if (targetUser) {
        pendingUpsertedUsersRef.current.set(targetUser.username.toUpperCase(), {
          user: targetUser,
          expiresAt: Date.now() + 15000
        });
        fetch('/api/auth/update-user', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            targetUserId: id,
            updates: {
              ...targetUser,
              ...(targetUser.password ? { password: targetUser.password } : (updates.password ? { password: updates.password } : {}))
            }
          })
        }).then(async res => {
          if (res.status === 401 || res.status === 403) {
            logout();
            return;
          }
          if (res.ok) {
            void syncWithServerRef.current?.(true);
          } else {
            console.error('[STORAGE_FAILURE] update-user rejected by server:', res.status);
          }
        }).catch(err => {
          console.error('[STORAGE_FAILURE] Backend update-user error:', err);
        });
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app_users_updated', { detail: updatedList }));
        window.dispatchEvent(new CustomEvent('collection_change_students', { detail: { collection: 'students' } }));
      }

      return updatedList;
    });
  };

  const deleteUser = async (id: string, options?: { skipStudentSync?: boolean }): Promise<{ success: boolean; error?: string }> => {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const prevUsers = usersRef.current;
    const cleanInputUpper = String(id || '').trim().toUpperCase();
    const target = prevUsers.find(
      u => u.id === id || String(u.id || '').toUpperCase() === cleanInputUpper || u.username.toUpperCase() === cleanInputUpper
    );
    const deletedId = target ? target.id : id;
    const usernameToDelete = target ? target.username.toUpperCase() : cleanInputUpper;
    const linkedStudentId = target?.linkedStudentId || target?.studentId;

    if (usernameToDelete === 'SADEGH') {
      return { success: false, error: 'حذف سوپر ادمین اصلی سامانه مجاز نیست.' };
    }

    // 1. Register short-lived delete guard so concurrent polls don't flicker user back during in-flight API call
    const lockUntil = Date.now() + 15000;
    const guardKeys = Array.from(new Set([id, deletedId, usernameToDelete, cleanInputUpper].filter(Boolean)));
    guardKeys.forEach(k => {
      pendingDeletedUsersRef.current.set(k, lockUntil);
      pendingUpsertedUsersRef.current.delete(k.toUpperCase());
    });

    // 2. Optimistically remove from React state, localStorage, and localDb IndexedDB
    const filtered = prevUsers.filter(
      u => u.id !== id && u.id !== deletedId && u.username.toUpperCase() !== usernameToDelete && u.username.toUpperCase() !== cleanInputUpper
    );
    setUsers(filtered);
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {}

    await localDb.removeLocalUserCacheByKeys(guardKeys);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app_users_updated', { detail: filtered }));
      window.dispatchEvent(new CustomEvent('collection_change_students', { detail: { collection: 'students' } }));
    }

    const rollbackLocalDelete = () => {
      guardKeys.forEach(k => pendingDeletedUsersRef.current.delete(k));
      setUsers(prevUsers);
      try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(prevUsers));
      } catch (e) {}
      localDb.replaceAuthoritativeUsersCache(prevUsers).catch((e) => {
        console.warn('[STORAGE_FAILURE] rollback replaceAuthoritativeUsersCache warning:', e);
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app_users_updated', { detail: prevUsers }));
      }
    };

    try {
      let res = await fetch('/api/auth/delete-user', {
        method: 'POST',
        headers,
        cache: 'no-store',
        credentials: 'include',
        body: JSON.stringify({
          targetUserId: deletedId,
          userId: deletedId,
          username: usernameToDelete,
          skipStudentSync: options?.skipStudentSync
        })
      });

      if (res.status === 401) {
        try {
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          });
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json().catch(() => null);
            if (refreshData?.token) {
              localStorage.setItem('auth_token', refreshData.token);
              sessionStorage.setItem('auth_token', refreshData.token);
              headers['Authorization'] = `Bearer ${refreshData.token}`;
              res = await fetch('/api/auth/delete-user', {
                method: 'POST',
                headers,
                cache: 'no-store',
                credentials: 'include',
                body: JSON.stringify({
                  targetUserId: deletedId,
                  userId: deletedId,
                  username: usernameToDelete,
                  skipStudentSync: options?.skipStudentSync
                })
              });
            }
          }
        } catch (refreshErr) {
          console.warn('[AUTH_REFRESH_WARNING] Token refresh during deleteUser failed:', refreshErr);
        }
      }

      if (res.status === 401 || res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        rollbackLocalDelete();
        if (res.status === 401) logout();
        return { success: false, error: errData.message || 'نشست کاربری شما منقضی شده یا مجوز حذف ندارید.' };
      }

      const result = await res.json().catch(() => ({ success: false }));

      if (!res.ok && res.status !== 404) {
        console.error('[STORAGE_FAILURE] Server delete-user failed:', res.status, result);
        rollbackLocalDelete();
        return { success: false, error: result.message || 'خطا در حذف کاربر از سرور.' };
      }

      if (res.ok && result.success === false) {
        console.error('[STORAGE_FAILURE] Server delete-user rejected:', result);
        rollbackLocalDelete();
        return { success: false, error: result.message || 'حذف کاربر در سرور تایید نشد.' };
      }

      // 3. Server confirmed deletion -> unlink student locally if applicable
      if (!options?.skipStudentSync) {
        if (linkedStudentId) {
          localDb.getDoc('students', linkedStudentId).then(existingStudent => {
            if (existingStudent && (existingStudent.hasUserAccount || existingStudent.userAccountUsername)) {
              localDb.updateDoc('students', linkedStudentId, {
                hasUserAccount: false,
                userAccountUsername: null
              }).catch((err) => console.warn('[STORAGE_FAILURE] deleteUser student unlink error:', err));
            }
          }).catch((err) => console.warn('[STORAGE_FAILURE] deleteUser student lookup error:', err));
        } else {
          localDb.getDocs<any>('students').then(students => {
            const targetStudent = students.find(s =>
              (s.userAccountUsername && String(s.userAccountUsername).trim().toUpperCase() === usernameToDelete) ||
              (s.nationalId && String(s.nationalId).trim().toUpperCase() === usernameToDelete)
            );
            if (targetStudent && (targetStudent.hasUserAccount || targetStudent.userAccountUsername)) {
              localDb.updateDoc('students', targetStudent.id, {
                hasUserAccount: false,
                userAccountUsername: null
              }).catch((err) => console.warn('[STORAGE_FAILURE] deleteUser student unlink fallback error:', err));
            }
          }).catch((err) => console.warn('[STORAGE_FAILURE] deleteUser students lookup error:', err));
        }
      }

      if (currentUser && (currentUser.id === deletedId || currentUser.username.toUpperCase() === usernameToDelete)) {
        logout();
      } else {
        // 4. Read-After-Write authoritative confirmation from server
        await syncWithServerRef.current?.(true);
      }

      return { success: true };
    } catch (err: any) {
      console.error('[STORAGE_FAILURE] Network/request failure in deleteUser:', err);
      rollbackLocalDelete();
      return { success: false, error: 'خطا در ارتباط با سرور هنگام حذف کاربر. لطفاً مجدداً تلاش کنید.' };
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
    let targetUpdated: AppUser | undefined;
    setUsers(prev => {
      const updatedList = prev.map(u => {
        if (u.id === id || u.username.toUpperCase() === id.toUpperCase()) {
          const updated = { ...u, isActive: u.isActive === false ? true : false, updatedAt: new Date().toISOString() };
          targetUpdated = updated;
          const activeUser = currentUserRef.current;
          if (activeUser && activeUser.username.toUpperCase() === u.username.toUpperCase()) {
            setCurrentUser(updated);
            try { localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated)); } catch (e) {}
          }
          return updated;
        }
        return u;
      });
      try { localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedList)); } catch (e) {}
      return updatedList;
    });

    if (targetUpdated) {
      updateUser(id, { isActive: targetUpdated.isActive });
    }
  };

  /**
   * Evaluates whether a specific tab/module is accessible and visible to the user.
   * Granular user settings (modulePermissions / allowedTabs) take ABSOLUTE priority over role defaults!
   */
  const isTabAllowed = (tabId: string, user?: AppUser): boolean => {
    const target = user || currentUser;
    if (!target) return false;

    // Dashboard is universally available for all authenticated users
    if (tabId === 'dashboard') {
      return true;
    }

    // 1. Super Admin (Level 1) has universal access
    if (target.level === 1 && target.role === 'super_admin') {
      // If super admin explicitly has a modulePermissions configured to 'none', allow test restriction
      if (target.modulePermissions && target.modulePermissions[tabId] === 'none') {
        return false;
      }
      return true;
    }

    // 2. User Management tab is EXCLUSIVELY for Super Admin (Level 1)
    if (tabId === 'user-management') {
      return target.level === 1 && target.role === 'super_admin';
    }

    // Lockers, Student Access Management, and Held Sessions: Always available to Education Manager and Super Admin unless explicitly set to 'none'
    const isEduOrAdmin = target.role === 'education_manager' || target.role === 'education_officer' || (target.username || '').toUpperCase() === 'SHAH' || target.level === 1;
    if ((tabId === 'lockers' || tabId === 'student-access-management' || tabId === 'held-sessions') && isEduOrAdmin) {
      if (target.modulePermissions && target.modulePermissions[tabId] === 'none') {
        return false;
      }
      return true;
    }

    // Student Portal Access Control (Global & Per-Student Overrides managed by Education Manager / Super Admin)
    // All standard student tabs are uniformly governed by StudentAccessManagement (not legacy per-account modulePermissions 'none' leftovers).
    const isStudentAccount = (target.level === 3 || target.role === 'student' || target.role === 'class_representative') && target.role !== 'teacher';
    if (isStudentAccount) {
      const candidateIds = [
        target.studentId,
        target.linkedStudentId,
        target.id,
        target.username,
        (target as any).nationalCode,
        (target as any).nationalId
      ];
      if (!isStudentPortalTargetAllowed(studentPortalAccessConfig, candidateIds, tabId)) {
        return false;
      }
      if (getDefaultRoleTabAllowed(tabId, target)) {
        return true;
      }
    }

    // 3. PRIORITY 1: Explicit modulePermissions map
    if (target.modulePermissions && typeof target.modulePermissions === 'object' && Object.keys(target.modulePermissions).length > 0) {
      if (tabId in target.modulePermissions) {
        const perm = target.modulePermissions[tabId];
        if (perm === 'none') return false;
        if (perm === 'view' || perm === 'edit') return true;
      } else {
        // If omitted from custom permissions, fall back to role default permission for new modules
        if (getDefaultRoleTabAllowed(tabId, target)) {
          return true;
        }
        return false;
      }
    }

    // 4. PRIORITY 2: Explicit allowedTabs or allowedModules array
    if (Array.isArray(target.allowedTabs)) {
      if (target.allowedTabs.includes(tabId)) return true;
      if (getDefaultRoleTabAllowed(tabId, target)) return true;
      return false;
    }
    if (Array.isArray(target.allowedModules)) {
      if ((target.allowedModules as string[]).includes(tabId)) return true;
      if (getDefaultRoleTabAllowed(tabId, target)) return true;
      return false;
    }

    // 5. Fallback to standard role-based defaults
    return getDefaultRoleTabAllowed(tabId, target);
  };

  /**
   * Evaluates whether the user has editing rights for a specific module.
   * Granular user settings (modulePermissions / editableTabs) take ABSOLUTE priority!
   */
  const canEditTab = (tabId: string, user?: AppUser): boolean => {
    const target = user || currentUser;
    if (!target) return false;

    // 1. Global Read-Only flag immediately blocks editing across all tabs
    if (target.isReadOnly === true || target.canEdit === false) {
      return false;
    }

    // 2. Super Admin can edit all allowed modules (unless explicitly set to view-only for testing)
    if (target.level === 1 && target.role === 'super_admin') {
      if (target.modulePermissions && target.modulePermissions[tabId] === 'view') {
        return false;
      }
      return true;
    }

    // Lockers module: Always editable for Education Manager and Super Admin unless explicitly set to 'view'
    const isEduOrAdmin = target.role === 'education_manager' || target.role === 'education_officer' || (target.username || '').toUpperCase() === 'SHAH' || target.level === 1;
    if (tabId === 'lockers' && isEduOrAdmin) {
      if (target.modulePermissions && target.modulePermissions['lockers'] === 'view') {
        return false;
      }
      return true;
    }

    // 3. PRIORITY 1: Explicit modulePermissions map
    if (target.modulePermissions && typeof target.modulePermissions === 'object' && Object.keys(target.modulePermissions).length > 0) {
      if (tabId in target.modulePermissions) {
        return target.modulePermissions[tabId] === 'edit';
      }
      return getDefaultRoleTabEditable(tabId, target);
    }

    // 4. PRIORITY 2: Explicit editableTabs array
    if (Array.isArray(target.editableTabs)) {
      if (target.editableTabs.includes(tabId)) return true;
      return getDefaultRoleTabEditable(tabId, target);
    }

    // 5. Fallback to standard role-based editing defaults
    return getDefaultRoleTabEditable(tabId, target);
  };

  const hasModuleAccess = (tabId: string, user?: AppUser): boolean => {
    return isTabAllowed(tabId, user);
  };

  const canEditModule = (tabId: string, user?: AppUser): boolean => {
    return canEditTab(tabId, user);
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
        logoutAllSessions,
        changePassword,
        adminResetPassword,
        addUser,
        updateUser,
        deleteUser,
        resetDefaultUsers,
        resetToDefaultUsers: resetDefaultUsers,
        toggleUserActive,
        isTabAllowed,
        hasModuleAccess,
        canEditTab,
        canEditModule,
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
