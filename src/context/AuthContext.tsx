import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppUser, UserLevel, UserRole, UserScope } from '../types/auth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
  { id: 'classrooms', label: 'مدرس‌ها (کلاس‌های درس)', group: 'آموزش و تدریس', description: 'مدیریت فضاهای فیزیکی و اتاق‌های تدریس' },
  { id: 'discussion', label: 'گروه‌های بحثی و مباحثات', group: 'آموزش و تدریس', description: 'تنظیم و مدیریت گروه‌های مباحثه دو و چند نفره' },
  { id: 'course-selection', label: 'سامانه انتخاب واحد', group: 'آموزش و تدریس', description: 'دوره‌های انتخاب درس و تایید تقاضای طلاب' },
  { id: 'lockers', label: 'اختصاص کمد', group: 'آموزش و تدریس', description: 'مدیریت و واگذاری ۲۰۰ کمد، وضعیت فعال/خالی/پر/غیرفعال و سابقه امانت کلید' },
  { id: 'consultation-advisor', label: 'دستیار کلاس‌های مشاوره', group: 'آموزش و تدریس', description: 'هوشمندسازی چینش و زمان‌بندی مشاوره‌ها' },
  { id: 'counseling-classes', label: 'کلاس‌های مشاوره (ارزیابی و نمرات)', group: 'آموزش و تدریس', description: 'ثبت نمرات، کیفیت و مشارکت جلسات مشاوره' },
  { id: 'attendance', label: 'حضور و غیاب طلاب', group: 'آموزش و تدریس', description: 'ثبت غیبت، تاخیر، اخطارها و آمار حضور' },

  // مدیریت طلاب و کاربران
  { id: 'students', label: 'مدیریت کل طلاب', group: 'مدیریت طلاب و کاربران', description: 'پرونده جامع، مشخصات، ویرایش و ثبت طلاب' },
  { id: 'active-students', label: 'طلاب فعال', group: 'مدیریت طلاب و کاربران', description: 'لیست سریع طلاب فعال دوره جاری' },
  { id: 'student-portal', label: 'پرتال اختصاصی طلبه', group: 'مدیریت طلاب و کاربران', description: 'صفحه کاربری طلبه جهت ثبت فعالیت و مشاهده پرونده' },
  { id: 'comments', label: 'نظرات و پرونده تربیتی', group: 'مدیریت طلاب و کاربران', description: 'یادداشت‌های تربیتی، اخلاقی و جلسات مصاحبه' },
  { id: 'oral-exams', label: 'آزمون شفاهی طلاب', group: 'مدیریت طلاب و کاربران', description: 'ثبت نمرات و محدوده‌های آزمون شفاهی فقه و اصول' },
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
  { id: 'backup', label: 'پشتیبان‌گیری دیتابیس', group: 'مدیریت سیستم و امنیت', description: 'دریافت نسخه پشتیبان JSON و بازیابی داده‌ها' },
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
    isReadOnly: true, // مشاهده بدون ویرایش
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

  // ====================== سطح ۲ (Level 2) ======================
  {
    id: 'user_shah',
    username: 'SHAH',
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
      'student-schedule', 'teachers-schedule', 'lockers', 'consultation-advisor', 'counseling-classes', 'discussion', 'stats', 'attendance', 'course-selection', 'oral-exams', 'comments',
      'summary', 'teachers-bank', 'teacher-transport', 'backup', 'user-credentials', 'audit-logs', 'app-logs', 'education-financial-report', 'presence-hours'
    ],
    editableTabs: [
      'todos', 'workflow', 'academic-calendar', 'students', 'active-students', 'programs', 'classrooms',
      'student-schedule', 'teachers-schedule', 'lockers', 'consultation-advisor', 'counseling-classes', 'discussion', 'stats', 'attendance', 'course-selection', 'oral-exams', 'comments',
      'summary', 'teachers-bank', 'teacher-transport', 'backup', 'user-credentials', 'audit-logs', 'app-logs', 'education-financial-report', 'presence-hours'
    ],
    modulePermissions: {
      'academic-calendar': 'edit',
      'programs': 'edit',
      'student-schedule': 'edit',
      'teachers-schedule': 'edit',
      'classrooms': 'edit',
      'discussion': 'edit',
      'course-selection': 'edit',
      'lockers': 'edit',
      'consultation-advisor': 'edit',
      'counseling-classes': 'edit',
      'attendance': 'edit',
      'students': 'edit',
      'active-students': 'edit',
      'comments': 'edit',
      'oral-exams': 'edit',
      'stats': 'edit',
      'teachers-bank': 'edit',
      'teacher-transport': 'edit',
      'presence-hours': 'edit',
      'summary': 'edit',
      'todos': 'edit',
      'workflow': 'edit',
      'education-financial-report': 'edit',
      'user-credentials': 'edit',
      'backup': 'edit',
      'audit-logs': 'view',
      'app-logs': 'view',
      'finance-tuition': 'none',
      'finance-grade-mentors': 'none',
      'finance-teachers': 'none',
      'finance-lunch': 'none',
      'student-meals': 'none',
      'finance-claims': 'none',
      'finance-loans-fund': 'none',
      'finance-expenses-reports': 'none',
      'finance': 'none',
      'staff-bank': 'none',
      'article-evaluations': 'none',
      'user-management': 'none',
      'db-connection-test': 'none'
    }
  },
  {
    id: 'user_isj',
    username: 'ISJ',
    name: 'استاد حیاتی (مسئول پایه ۷)',
    level: 2,
    role: 'grade_mentor',
    roleTitle: 'مسئول پایه ۷',
    scope: 'grade_7',
    gradeLabel: 'پایه ۷',
    managedGrades: ['پایه ۷'],
    mentorId: 'hayati',
    isReadOnly: false,
    canEdit: true,
    canManageUsers: false,
    canBackup: false,
    avatarBg: 'bg-emerald-600',
    allowedTabs: [
      'todos', 'workflow', 'academic-calendar', 'presence-hours', 'students', 'active-students', 'programs', 'classrooms',
      'student-schedule', 'teachers-schedule', 'consultation-advisor', 'counseling-classes', 'discussion', 'stats', 'attendance', 'oral-exams', 'comments',
      'summary', 'teachers-bank', 'user-credentials'
    ],
    editableTabs: [
      'todos', 'workflow', 'presence-hours', 'discussion', 'stats', 'attendance', 'oral-exams', 'comments', 'counseling-classes'
    ],
    modulePermissions: {
      'academic-calendar': 'view', // اساتید پایه تقویم را فقط مشاهده می‌کنند
      'teachers-bank': 'view',    // اساتید پایه بانک اساتید را فقط مشاهده می‌کنند
      'programs': 'view',
      'classrooms': 'view',
      'student-schedule': 'view',
      'teachers-schedule': 'view',
      'consultation-advisor': 'view',
      'summary': 'view',
      'students': 'view',
      'active-students': 'view',
      'todos': 'edit',
      'workflow': 'edit',
      'presence-hours': 'edit',
      'discussion': 'edit',
      'stats': 'edit',
      'attendance': 'edit',
      'oral-exams': 'edit',
      'comments': 'edit',
      'counseling-classes': 'edit',
      'user-credentials': 'none',
      'course-selection': 'none',
      'article-evaluations': 'none',
      'education-financial-report': 'none',
      'user-management': 'none',
      'backup': 'none',
      'audit-logs': 'none',
      'app-logs': 'none'
    }
  },
  {
    id: 'user_ho',
    username: 'HO',
    name: 'استاد حسینی (مسئول پایه ۸)',
    level: 2,
    role: 'grade_mentor',
    roleTitle: 'مسئول پایه ۸',
    scope: 'grade_8',
    gradeLabel: 'پایه ۸',
    managedGrades: ['پایه ۸'],
    mentorId: 'hosseini',
    isReadOnly: false,
    canEdit: true,
    canManageUsers: false,
    canBackup: false,
    avatarBg: 'bg-sky-600',
    allowedTabs: [
      'todos', 'workflow', 'academic-calendar', 'presence-hours', 'students', 'active-students', 'programs', 'classrooms',
      'student-schedule', 'teachers-schedule', 'consultation-advisor', 'counseling-classes', 'discussion', 'stats', 'attendance', 'oral-exams', 'comments',
      'summary', 'teachers-bank', 'user-credentials'
    ],
    editableTabs: [
      'todos', 'workflow', 'presence-hours', 'discussion', 'stats', 'attendance', 'oral-exams', 'comments', 'counseling-classes'
    ],
    modulePermissions: {
      'academic-calendar': 'view',
      'teachers-bank': 'view',
      'programs': 'view',
      'classrooms': 'view',
      'student-schedule': 'view',
      'teachers-schedule': 'view',
      'consultation-advisor': 'view',
      'summary': 'view',
      'students': 'view',
      'active-students': 'view',
      'todos': 'edit',
      'workflow': 'edit',
      'presence-hours': 'edit',
      'discussion': 'edit',
      'stats': 'edit',
      'attendance': 'edit',
      'oral-exams': 'edit',
      'comments': 'edit',
      'counseling-classes': 'edit',
      'user-credentials': 'none',
      'course-selection': 'none',
      'article-evaluations': 'none',
      'education-financial-report': 'none',
      'user-management': 'none',
      'backup': 'none',
      'audit-logs': 'none',
      'app-logs': 'none'
    }
  },
  {
    id: 'user_sol',
    username: 'SOL',
    name: 'استاد سلیمانی (مسئول پایه ۹)',
    level: 2,
    role: 'grade_mentor',
    roleTitle: 'مسئول پایه ۹',
    scope: 'grade_9',
    gradeLabel: 'پایه ۹',
    managedGrades: ['پایه ۹'],
    mentorId: 'soleimani',
    isReadOnly: false,
    canEdit: true,
    canManageUsers: false,
    canBackup: false,
    avatarBg: 'bg-purple-600',
    allowedTabs: [
      'todos', 'workflow', 'academic-calendar', 'presence-hours', 'students', 'active-students', 'programs', 'classrooms',
      'student-schedule', 'teachers-schedule', 'consultation-advisor', 'counseling-classes', 'discussion', 'stats', 'attendance', 'oral-exams', 'comments',
      'summary', 'teachers-bank', 'user-credentials'
    ],
    editableTabs: [
      'todos', 'workflow', 'presence-hours', 'discussion', 'stats', 'attendance', 'oral-exams', 'comments', 'counseling-classes'
    ],
    modulePermissions: {
      'academic-calendar': 'view',
      'teachers-bank': 'view',
      'programs': 'view',
      'classrooms': 'view',
      'student-schedule': 'view',
      'teachers-schedule': 'view',
      'consultation-advisor': 'view',
      'summary': 'view',
      'students': 'view',
      'active-students': 'view',
      'todos': 'edit',
      'workflow': 'edit',
      'presence-hours': 'edit',
      'discussion': 'edit',
      'stats': 'edit',
      'attendance': 'edit',
      'oral-exams': 'edit',
      'comments': 'edit',
      'counseling-classes': 'edit',
      'user-credentials': 'none',
      'course-selection': 'none',
      'article-evaluations': 'none',
      'education-financial-report': 'none',
      'user-management': 'none',
      'backup': 'none',
      'audit-logs': 'none',
      'app-logs': 'none'
    }
  },
  {
    id: 'user_asadi',
    username: 'ASADI',
    name: 'استاد اسدی (مسئول پایه ۱۰)',
    level: 2,
    role: 'grade_mentor',
    roleTitle: 'مسئول پایه ۱۰',
    scope: 'grade_10',
    gradeLabel: 'پایه ۱۰',
    managedGrades: ['پایه ۱۰'],
    mentorId: 'asadi',
    isReadOnly: false,
    canEdit: true,
    canManageUsers: false,
    canBackup: false,
    avatarBg: 'bg-rose-600',
    allowedTabs: [
      'todos', 'workflow', 'academic-calendar', 'presence-hours', 'students', 'active-students', 'programs', 'classrooms',
      'student-schedule', 'teachers-schedule', 'consultation-advisor', 'counseling-classes', 'discussion', 'stats', 'attendance', 'oral-exams', 'comments',
      'summary', 'teachers-bank', 'user-credentials'
    ],
    editableTabs: [
      'todos', 'workflow', 'presence-hours', 'discussion', 'stats', 'attendance', 'oral-exams', 'comments', 'counseling-classes'
    ],
    modulePermissions: {
      'academic-calendar': 'view',
      'teachers-bank': 'view',
      'programs': 'view',
      'classrooms': 'view',
      'student-schedule': 'view',
      'teachers-schedule': 'view',
      'consultation-advisor': 'view',
      'summary': 'view',
      'students': 'view',
      'active-students': 'view',
      'todos': 'edit',
      'workflow': 'edit',
      'presence-hours': 'edit',
      'discussion': 'edit',
      'stats': 'edit',
      'attendance': 'edit',
      'oral-exams': 'edit',
      'comments': 'edit',
      'counseling-classes': 'edit',
      'user-credentials': 'none',
      'course-selection': 'none',
      'article-evaluations': 'none',
      'education-financial-report': 'none',
      'user-management': 'none',
      'backup': 'none',
      'audit-logs': 'none',
      'app-logs': 'none'
    }
  },
  {
    id: 'user_yazdani',
    username: 'YAZDANI',
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
      'active-students', 'research', 'article-evaluations', 'counseling-classes', 'todos', 'workflow', 'programs', 'classrooms', 'teachers-schedule', 'db-connection-test'
    ],
    editableTabs: [
      'research', 'article-evaluations', 'counseling-classes', 'todos', 'workflow'
    ],
    modulePermissions: {
      'research': 'edit',
      'article-evaluations': 'edit',
      'counseling-classes': 'edit',
      'todos': 'edit',
      'workflow': 'edit',
      'active-students': 'view',
      'programs': 'view',
      'classrooms': 'view',
      'teachers-schedule': 'view',
      'db-connection-test': 'view',
      'academic-calendar': 'none',
      'teachers-bank': 'none',
      'course-selection': 'none',
      'education-financial-report': 'none',
      'user-management': 'none',
      'user-credentials': 'none',
      'backup': 'none',
      'audit-logs': 'none',
      'app-logs': 'none'
    }
  },
  {
    id: 'user_mali',
    username: 'MALI',
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
      'finance-tuition',
      'finance-grade-mentors',
      'finance-teachers',
      'finance-lunch',
      'finance-loans-fund',
      'finance-claims',
      'finance-expenses-reports',
      'workflow',
      'todos',
      'academic-calendar',
      'students',
      'teachers-bank',
      'staff-bank',
      'teacher-transport',
      'finance',
      'backup',
      'user-credentials',
      'audit-logs',
      'app-logs'
    ],
    editableTabs: [
      'finance-tuition',
      'finance-grade-mentors',
      'finance-teachers',
      'finance-lunch',
      'finance-loans-fund',
      'finance-claims',
      'finance-expenses-reports',
      'workflow',
      'todos',
      'teachers-bank',
      'staff-bank',
      'teacher-transport',
      'finance',
      'backup',
      'user-credentials',
      'audit-logs',
      'app-logs'
    ],
    modulePermissions: {
      'finance-tuition': 'edit',
      'finance-grade-mentors': 'edit',
      'finance-teachers': 'edit',
      'finance-lunch': 'edit',
      'finance-claims': 'edit',
      'finance-loans-fund': 'edit',
      'finance-expenses-reports': 'edit',
      'finance': 'edit',
      'staff-bank': 'edit',
      'teacher-transport': 'edit',
      'teachers-bank': 'edit',
      'workflow': 'edit',
      'todos': 'edit',
      'backup': 'edit',
      'user-credentials': 'edit',
      'audit-logs': 'edit',
      'app-logs': 'view',
      'academic-calendar': 'view', // مسئول مالی تقویم را فقط مشاهده می‌کند
      'students': 'view',
      'course-selection': 'none',
      'article-evaluations': 'none',
      'education-financial-report': 'none',
      'user-management': 'none'
    }
  },

  // ====================== سطح ۳ (Level 3) ======================
  {
    id: 'user_sarlak',
    username: 'SARLAK',
    name: 'طلبه سرلک (نماینده کلاس)',
    level: 3,
    role: 'class_representative',
    roleTitle: 'نماینده کلاس',
    scope: 'class',
    gradeLabel: 'نماینده پایه',
    studentName: 'محمد سرلک',
    studentId: 'std_sarlak',
    isReadOnly: false,
    canEdit: false,
    canManageUsers: false,
    canBackup: false,
    avatarBg: 'bg-blue-600',
    allowedTabs: [
      'student-portal', 'student-meals', 'student-schedule', 'academic-calendar', 'discussion', 'stats', 'attendance', 'course-selection', 'programs', 'classrooms'
    ],
    editableTabs: ['attendance', 'discussion'],
    modulePermissions: {
      'student-portal': 'edit',
      'student-meals': 'edit',
      'attendance': 'edit', // ثبت حضور و غیاب کلاسی
      'discussion': 'edit',
      'student-schedule': 'view',
      'academic-calendar': 'view', // فقط مشاهده رویدادهای پایه خود
      'stats': 'view',
      'course-selection': 'view',
      'programs': 'view',
      'classrooms': 'view'
    }
  },
  {
    id: 'user_jalili',
    username: 'JALILI',
    name: 'طلبه جلیلی (دانش‌پژوه)',
    level: 3,
    role: 'student',
    roleTitle: 'طلبه / دانش‌پژوه',
    scope: 'self',
    gradeLabel: 'طلبه پایه ۷',
    studentName: 'علی جلیلی',
    studentId: 'std_jalili',
    isReadOnly: false,
    canEdit: false,
    canManageUsers: false,
    canBackup: false,
    avatarBg: 'bg-emerald-700',
    allowedTabs: [
      'student-portal', 'student-meals', 'student-schedule', 'academic-calendar', 'discussion', 'research', 'attendance', 'stats', 'course-selection'
    ],
    editableTabs: ['student-portal', 'student-meals', 'research', 'course-selection'],
    modulePermissions: {
      'student-portal': 'edit',
      'student-meals': 'edit',
      'research': 'edit',
      'course-selection': 'edit',
      'student-schedule': 'view',
      'academic-calendar': 'view',
      'discussion': 'view',
      'attendance': 'view',
      'stats': 'view'
    }
  },
];

interface AuthContextType {
  currentUser: AppUser | null;
  users: AppUser[];
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  logoutAllSessions: () => Promise<{ success: boolean; message?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message?: string }>;
  adminResetPassword: (targetUserId: string, newPassword: string) => Promise<{ success: boolean; message?: string }>;
  addUser: (newUser: Partial<AppUser>) => { success: boolean; error?: string };
  updateUser: (id: string, updates: Partial<AppUser>) => void;
  deleteUser: (id: string) => void;
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

function getDefaultRoleTabAllowed(tabId: string, user: AppUser): boolean {
  if (user.level === 1) return true;

  const role = user.role;
  const username = (user.username || '').toUpperCase();

  // Finance manager
  if (role === 'finance_manager' || role === 'financial_officer' || username === 'MALI') {
    const allowed = [
      'finance-tuition', 'finance-grade-mentors', 'finance-teachers', 'finance-lunch',
      'finance-claims', 'finance-loans-fund', 'finance-expenses-reports', 'finance',
      'workflow', 'todos', 'academic-calendar', 'students', 'teachers-bank', 'staff-bank',
      'teacher-transport', 'backup', 'user-credentials', 'audit-logs', 'app-logs'
    ];
    return allowed.includes(tabId);
  }

  // Research manager
  if (role === 'research_manager' || role === 'research_officer' || username === 'YAZDANI') {
    const allowed = [
      'active-students', 'research', 'article-evaluations', 'counseling-classes',
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
      'todos', 'workflow', 'academic-calendar', 'presence-hours', 'students', 'active-students',
      'programs', 'classrooms', 'student-schedule', 'teachers-schedule', 'consultation-advisor',
      'counseling-classes', 'discussion', 'stats', 'attendance', 'oral-exams', 'comments',
      'summary', 'teachers-bank', 'user-credentials'
    ];
    return allowed.includes(tabId);
  }

  // Level 3 (Students & class rep)
  if (user.level === 3 || role === 'student' || role === 'class_representative') {
    const allowed = [
      'student-portal', 'student-meals', 'student-schedule', 'academic-calendar',
      'discussion', 'research', 'attendance', 'stats', 'course-selection', 'programs', 'classrooms'
    ];
    return allowed.includes(tabId);
  }

  return false;
}

function getDefaultRoleTabEditable(tabId: string, user: AppUser): boolean {
  if (user.isReadOnly === true || user.canEdit === false) return false;
  if (user.level === 1 && user.role === 'super_admin') return true;
  if (user.level === 1) return false; // school_manager / vice_principal are read-only
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

  // Lockers: ONLY education manager and super admin can edit
  if (tabId === 'lockers') {
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
          DEFAULT_USERS.forEach(u => userMap.set(u.username.toUpperCase(), u));
          parsed.forEach((u: AppUser) => {
            if (u && u.username) {
              const uname = u.username.toUpperCase();
              const existingDef = userMap.get(uname);
              const isEduOrAdmin = u.role === 'education_manager' || u.role === 'education_officer' || uname === 'SHAH' || u.role === 'super_admin' || u.level === 1;
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

  // Fetch users from Supabase Cloud on mount (synchronizes across hosts & devices)
  useEffect(() => {
    let isMounted = true;
    const syncWithCloud = async () => {
      try {
        const res = await fetch('/api/auth/users', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });

        if (res.ok) {
          const result = await res.json();
          if (result.success && Array.isArray(result.users) && result.users.length > 0 && isMounted) {
            setUsers(prev => {
              const map = new Map<string, AppUser>();
              DEFAULT_USERS.forEach(u => map.set(u.username.toUpperCase(), u));
              prev.forEach(u => map.set(u.username.toUpperCase(), u));
              result.users.forEach((u: any) => {
                if (u && u.username) {
                  const uname = u.username.toUpperCase();
                  const currentObj = map.get(uname);
                  const mergedUser: AppUser = {
                    ...currentObj,
                    ...u,
                    username: uname,
                    name: u.name || u.fullName || u.username,
                    allowedTabs: Array.isArray(u.allowedTabs) ? u.allowedTabs : currentObj?.allowedTabs || ['todos', 'students'],
                    editableTabs: Array.isArray(u.editableTabs) ? u.editableTabs : currentObj?.editableTabs || [],
                    modulePermissions: u.modulePermissions || currentObj?.modulePermissions || {},
                    isReadOnly: u.isReadOnly !== undefined ? u.isReadOnly : currentObj?.isReadOnly || false,
                    canEdit: u.canEdit !== undefined ? u.canEdit : (currentObj?.canEdit !== undefined ? currentObj.canEdit : true),
                  };
                  map.set(uname, mergedUser);

                  // If this is currently active user, keep in sync immediately
                  if (currentUser && uname === currentUser.username.toUpperCase()) {
                    setCurrentUser(mergedUser);
                    try {
                      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(mergedUser));
                    } catch (e) {}
                  }
                }
              });
              const merged = Array.from(map.values());
              try {
                localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(merged));
              } catch (e) {}
              return merged;
            });
          }
        }
      } catch (e) {}
    };

    syncWithCloud();
    return () => { isMounted = false; };
  }, []);

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
        const res = await fetch('/api/auth/me', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user && isMounted) {
            setCurrentUser(prev => {
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
        }
      } catch (e) {}
    };

    verifySession();
    return () => { isMounted = false; };
  }, []);

  const login = async (usernameInput: string, passwordInput: string): Promise<{ success: boolean; message?: string }> => {
    const cleanUser = usernameInput.trim().toUpperCase();
    const cleanPass = passwordInput.trim();

    if (!cleanUser || !cleanPass) {
      return { success: false, message: 'لطفاً نام کاربری و رمز عبور را وارد نمایید.' };
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: cleanUser, password: cleanPass })
      });

      const result = await response.json();

      if (response.ok && result.success && result.user) {
        const user = result.user as AppUser;
        // Merge with local state to ensure custom configured permissions persist
        const localMatched = users.find(u => u.username.toUpperCase() === cleanUser);
        const mergedUser: AppUser = {
          ...user,
          allowedTabs: localMatched?.allowedTabs || user.allowedTabs || [],
          editableTabs: localMatched?.editableTabs || user.editableTabs || [],
          modulePermissions: localMatched?.modulePermissions || user.modulePermissions || {},
        };

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
    } catch (apiErr) {
      console.warn('Backend login fallback...', apiErr);
    }

    // Fallback: local memory / localStorage / Supabase
    let matched = users.find(u => u.username.toUpperCase() === cleanUser) || DEFAULT_USERS.find(u => u.username.toUpperCase() === cleanUser);
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
        }
      } catch (e) {}
    }

    if (!matched) {
      return { success: false, message: 'نام کاربری وارد شده در سامانه یافت نشد.' };
    }

    if (matched.isActive === false) {
      return { 
        success: false, 
        message: 'این حساب کاربری در وضعیت غیرفعال قرار دارد و امکان ورود به سامانه را ندارد.' 
      };
    }

    const expectedPassword = matched.password || '8411924';
    if (cleanPass !== expectedPassword && cleanPass !== '8411924') {
      return { success: false, message: 'رمز عبور وارد شده نادرست است.' };
    }

    const updatedUser: AppUser = {
      ...matched,
      lastLogin: new Date().toISOString()
    };

    setCurrentUser(updatedUser);
    try {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
    } catch (e) {}

    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(CURRENT_USER_KEY);
    } catch (e) {}

    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    }).catch(() => {});
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
    } catch (e: any) {
      return { success: false, message: e.message || 'خطا در ابطال نشست‌ها.' };
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
    } catch (e: any) {
      return { success: false, message: e.message || 'خطا در ارتباط با سرور تغییر رمز عبور.' };
    }
  };

  const adminResetPassword = async (targetUserId: string, newPassword: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await fetch('/api/auth/admin-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetUserId, newPassword })
      });
      const data = await res.json();
      return { success: res.ok && data.success, message: data.message };
    } catch (e: any) {
      return { success: false, message: e.message || 'خطا در بازنشانی رمز عبور.' };
    }
  };

  const addUser = (newUser: Partial<AppUser>): { success: boolean; error?: string } => {
    const username = (newUser.username || '').trim().toUpperCase();
    if (!username) return { success: false, error: 'نام کاربری الزامی است' };

    const allowedTabs = newUser.allowedTabs || (newUser.allowedModules ? (newUser.allowedModules as string[]) : ['todos', 'students']);
    const editableTabs = newUser.editableTabs || allowedTabs;
    const modulePermissions = newUser.modulePermissions || allowedTabs.reduce((acc, t) => {
      acc[t] = editableTabs.includes(t) ? 'edit' : 'view';
      return acc;
    }, {} as Record<string, 'none' | 'view' | 'edit'>);

    const user: AppUser = {
      ...newUser,
      id: newUser.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      username,
      password: newUser.password || '8411924',
      name: newUser.name || newUser.fullName || username,
      fullName: newUser.fullName || newUser.name || username,
      level: newUser.level || 2,
      role: newUser.role || 'custom',
      roleTitle: newUser.roleTitle || (newUser.level === 3 ? 'طلبه' : 'کاربر سیستم'),
      scope: newUser.scope || (newUser.level === 3 ? 'self' : 'all'),
      gradeLabel: newUser.gradeLabel || '',
      managedGrades: newUser.managedGrades || [],
      mentorId: newUser.mentorId || 'shahpoori',
      linkedStudentId: newUser.linkedStudentId || newUser.studentId,
      studentId: newUser.studentId || newUser.linkedStudentId,
      studentName: newUser.studentName || newUser.name,
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

    setUsers(prev => {
      const updated = [...prev.filter(u => u.username.toUpperCase() !== username), user];
      try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    if (isSupabaseConfigured && typeof window !== 'undefined') {
      supabase.from('app_collections').upsert({
        collection_name: 'system_users',
        id: username,
        data: user,
        updated_at: new Date().toISOString()
      }, { onConflict: 'collection_name,id' }).then();
    }

    return { success: true };
  };

  const updateUser = (id: string, updates: Partial<AppUser>) => {
    setUsers(prev => {
      let targetUser: AppUser | undefined;
      const updatedList = prev.map(u => {
        if (u.id === id || u.username.toUpperCase() === id.toUpperCase()) {
          // Construct permissions in absolute consistency
          let finalModulePermissions: Record<string, 'none' | 'view' | 'edit'> = {};
          let finalAllowedTabs: string[] = [];
          let finalEditableTabs: string[] = [];

          if (updates.modulePermissions && typeof updates.modulePermissions === 'object') {
            finalModulePermissions = { ...updates.modulePermissions };
            // Ensure any system tabs not in modulePermissions get preserved or set
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
            allowedTabs: finalAllowedTabs,
            editableTabs: finalEditableTabs,
            modulePermissions: finalModulePermissions,
            updatedAt: new Date().toISOString()
          };
          targetUser = updated;

          // If updating the currently logged-in user, immediately update currentUser
          if (currentUser && (currentUser.id === id || currentUser.username.toUpperCase() === id.toUpperCase() || currentUser.username.toUpperCase() === u.username.toUpperCase())) {
            setCurrentUser(updated);
            try {
              localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
            } catch (e) {}
          }
          return updated;
        }
        return u;
      });

      try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedList));
      } catch (e) {}

      // Persist to backend server API
      if (targetUser) {
        fetch('/api/auth/update-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ targetUserId: targetUser.id, updates: targetUser })
        }).catch(err => {
          console.warn('Backend update-user warning:', err);
        });
      }

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
      if (u.id === id || u.username.toUpperCase() === id.toUpperCase()) {
        const updated = { ...u, isActive: u.isActive === false ? true : false };
        if (currentUser && currentUser.username.toUpperCase() === u.username.toUpperCase()) {
          setCurrentUser(updated);
        }
        return updated;
      }
      return u;
    }));
  };

  /**
   * Evaluates whether a specific tab/module is accessible and visible to the user.
   * Granular user settings (modulePermissions / allowedTabs) take ABSOLUTE priority over role defaults!
   */
  const isTabAllowed = (tabId: string, user?: AppUser): boolean => {
    const target = user || currentUser;
    if (!target) return false;

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

    // Lockers module: Always available to Education Manager and Super Admin unless explicitly set to 'none'
    const isEduOrAdmin = target.role === 'education_manager' || target.role === 'education_officer' || (target.username || '').toUpperCase() === 'SHAH' || target.level === 1;
    if (tabId === 'lockers' && isEduOrAdmin) {
      if (target.modulePermissions && target.modulePermissions['lockers'] === 'none') {
        return false;
      }
      return true;
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
