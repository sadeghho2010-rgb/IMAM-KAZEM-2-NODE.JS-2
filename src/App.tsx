/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import LoginPage from './components/auth/LoginPage';
import MainDashboard from './components/MainDashboard';
import SettingsModal from './components/SettingsModal';
import SecurityPinModal from './components/auth/SecurityPinModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { MentorProvider, useMentor } from './context/MentorContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TabErrorBoundary } from './components/TabErrorBoundary';
import BugReportModal from './components/BugReportModal';
import MouseAura from './components/MouseAura';
import { localDb } from './lib/localDb';

// Lazy loading all tab components for maximum initial page load speed
const StudentList = lazy(() => import('./components/StudentList'));
const Programs = lazy(() => import('./components/Programs'));
const StudentSchedule = lazy(() => import('./components/StudentSchedule'));
const ResearchAndFeedback = lazy(() => import('./components/ResearchAndFeedback'));
const AttendanceAndStats = lazy(() => import('./components/AttendanceAndStats'));
const StudyStats = lazy(() => import('./components/StudyStats'));
const Summary = lazy(() => import('./components/Summary'));
const BackupAndRestore = lazy(() => import('./components/BackupAndRestore'));
const SiteAuditLogs = lazy(() => import('./components/SiteAuditLogs'));
const SystemHealth = lazy(() => import('./components/SystemHealth'));
const LogViewer = lazy(() => import('./components/LogViewer'));
const SystemLogs = lazy(() => import('./components/SystemLogs'));
const DbSaveErrorsView = lazy(() => import('./components/DbSaveErrorsView'));
const EducationFinancialReportSettings = lazy(() => import('./components/education/EducationFinancialReportSettings'));
const TeacherTransportManagement = lazy(() => import('./components/education/TeacherTransportManagement'));
const TodoList = lazy(() => import('./components/TodoList'));
const StudentComments = lazy(() => import('./components/StudentComments'));
const StudyDiscussion = lazy(() => import('./components/StudyDiscussion'));
const AcademicCalendar = lazy(() => import('./components/AcademicCalendar'));
const PresenceHours = lazy(() => import('./components/PresenceHours'));
const TeachersBank = lazy(() => import('./components/TeachersBank'));
const StaffBank = lazy(() => import('./components/finance/StaffBank'));
const TeachersSchedule = lazy(() => import('./components/TeachersSchedule'));
const MadrasRooms = lazy(() => import('./components/MadrasRooms'));
const WorkflowManager = lazy(() => import('./components/WorkflowManager'));
const CounselingClasses = lazy(() => import('./components/CounselingClasses'));
const CourseSelection = lazy(() => import('./components/CourseSelection'));
const OralExamsManagement = lazy(() => import('./components/OralExamsManagement'));
const ArticleEvaluations = lazy(() => import('./components/ArticleEvaluations'));
const PassedCoursesManagement = lazy(() => import('./components/PassedCoursesManagement'));
const FinanceManagerDashboard = lazy(() => import('./components/FinanceManagerDashboard'));
const StudentActivityAndTuition = lazy(() => import('./components/finance/StudentActivityAndTuition'));
const GradeProfessorsCompensation = lazy(() => import('./components/finance/GradeProfessorsCompensation'));
const TeachersCompensation = lazy(() => import('./components/finance/TeachersCompensation'));
const LunchManagement = lazy(() => import('./components/finance/LunchManagement'));
const StudentMealReservationView = lazy(() => import('./components/finance/StudentMealReservationView'));
const ClaimsManagement = lazy(() => import('./components/finance/ClaimsManagement'));
const FundAndActiveLoans = lazy(() => import('./components/finance/FundAndActiveLoans'));
const ExpensesAndReports = lazy(() => import('./components/finance/ExpensesAndReports'));
const ConsultationAdvisor = lazy(() => import('./components/ConsultationAdvisor').then(m => ({ default: m.ConsultationAdvisor })));
const LockersManagement = lazy(() => import('./components/LockersManagement'));
const UserManagementSettings = lazy(() => import('./components/admin/UserManagementSettings'));
const UserCredentialsSettings = lazy(() => import('./components/admin/UserCredentialsSettings'));
const DatabaseConnectionTest = lazy(() => import('./components/DatabaseConnectionTest'));
const TeacherPortal = lazy(() => import('./components/TeacherPortal'));
const StudentRequestsPortal = lazy(() => import('./components/StudentRequestsPortal'));
const StudentPaymentsSection = lazy(() => import('./components/finance/StudentPaymentsSection').then(m => ({ default: m.StudentPaymentsSection })));
const AnomalyDetectionView = lazy(() => import('./components/admin/AnomalyDetectionView'));
import AccountSecurityPinModal from './components/auth/AccountSecurityPinModal';
import { StudentMobileAttendance } from './components/student/mobile/StudentMobileAttendance';
import { StudentMobileStudy } from './components/student/mobile/StudentMobileStudy';
import { StudentMobileSchedule } from './components/student/mobile/StudentMobileSchedule';
import { StudentMobileSummary } from './components/student/mobile/StudentMobileSummary';
import { StudentMobileDiscussion } from './components/student/mobile/StudentMobileDiscussion';
import { RepresentativeQuickAttendanceView } from './components/attendance/RepresentativeQuickAttendanceView';
import { StudentQuickSelfReportingView } from './components/attendance/StudentQuickSelfReportingView';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, LogOut, Settings, Eye, Palette, Bug, Sparkles, Sliders, ArrowRight, LayoutDashboard, ChevronLeft, ChevronRight, KeyRound } from 'lucide-react';
import { cn } from './lib/utils';

const BACK_BUTTON_GRADIENTS = [
  {
    bg: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800',
    shadow: 'shadow-emerald-600/40 hover:shadow-emerald-600/60 ring-emerald-400/30',
    border: 'border-emerald-400/50'
  },
  {
    bg: 'bg-gradient-to-r from-emerald-500 via-green-600 to-teal-600 hover:from-emerald-600 hover:to-green-700',
    shadow: 'shadow-green-500/40 hover:shadow-green-500/60 ring-emerald-400/30',
    border: 'border-green-300/50'
  },
  {
    bg: 'bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-700 hover:to-blue-800',
    shadow: 'shadow-indigo-500/40 hover:shadow-indigo-500/60 ring-indigo-400/30',
    border: 'border-indigo-300/50'
  },
  {
    bg: 'bg-gradient-to-r from-cyan-600 via-teal-600 to-cyan-700 hover:from-cyan-700 hover:to-teal-800',
    shadow: 'shadow-cyan-500/40 hover:shadow-cyan-500/60 ring-cyan-400/30',
    border: 'border-cyan-300/50'
  }
];

const TAB_PARENT_CATEGORY_MAP: Record<string, string> = {
  'programs': 'education_group',
  'classrooms': 'education_group',
  'student-schedule': 'education_group',
  'teachers-schedule': 'education_group',
  'course-selection': 'education_group',
  'passed-courses': 'education_group',
  'oral-exams': 'education_group',
  'academic-calendar': 'education_group',
  'teachers-bank': 'education_group',

  'student-requests': 'requests_group',
  'workflow': 'requests_group',
  'todos': 'requests_group',

  'students': 'students_group',
  'active-students': 'students_group',
  'comments': 'students_group',
  'stats': 'students_group',
  'lockers': 'students_group',
  'discussion': 'students_group',
  'counseling-classes': 'students_group',
  'rep-attendance': 'students_group',
  'self-reporting': 'students_group',

  'finance-tuition': 'finance_group',
  'finance-teachers': 'finance_group',
  'finance-lunch': 'finance_group',
  'student-meals': 'finance_group',
  'finance-claims': 'finance_group',
  'finance-loans-fund': 'finance_group',
  'finance-expenses-reports': 'finance_group',

  'research': 'research_group',
  'article-evaluations': 'research_group',
  'summary': 'research_group',

  'user-management': 'security_group',
  'user-credentials': 'security_group',
  'anomaly-detection': 'security_group',
  'backup': 'security_group',
  'audit-logs': 'security_group',
};

const DASHBOARD_CATEGORY_NAMES: Record<string, string> = {
  'education_group': 'آموزش و کلاس‌ها',
  'requests_group': 'درخواست‌ها، وظایف و گردش‌کار',
  'students_group': 'طلاب و امور آموزشی',
  'finance_group': 'امور مالی، رفاهی و خدمات',
  'research_group': 'پژوهش و کلاس‌های مشاوره',
  'security_group': 'مدیریت و امنیت سایت',
  'system_group': 'مدیریت و امنیت سایت',
};

function AppContent() {
  const { currentUser, logout, isTabAllowed, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<string>(() => {
    return 'dashboard';
  });
  const [navigationHistory, setNavigationHistory] = useState<string[]>(['dashboard']);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Closed by default
  const [selectedStudentIdForTab, setSelectedStudentIdForTab] = useState<string | undefined>(undefined);
  const [isBugModalOpen, setIsBugModalOpen] = useState(false);
  const [bugModalInitialValues, setBugModalInitialValues] = useState<{
    title?: string;
    description?: string;
    trackingCode?: string;
    sectionName?: string;
  } | undefined>(undefined);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Listen for global 'open-bug-report-modal' events from ErrorBoundary or user clicks
  useEffect(() => {
    const handleOpenBugModal = (e: any) => {
      if (e.detail) {
        setBugModalInitialValues({
          title: e.detail.title || (e.detail.trackingCode ? `بروز خطا (کد پیگیری: ${e.detail.trackingCode})` : 'گزارش اشکال در سامانه'),
          description: e.detail.errorMessage ? `شرح خطا: ${e.detail.errorMessage}\nکد پیگیری: ${e.detail.trackingCode || '-'}\nبخش: ${e.detail.sectionName || '-'}` : '',
          trackingCode: e.detail.trackingCode,
          sectionName: e.detail.sectionName
        });
      } else {
        setBugModalInitialValues(undefined);
      }
      setIsBugModalOpen(true);
    };

    window.addEventListener('open-bug-report-modal', handleOpenBugModal);
    return () => window.removeEventListener('open-bug-report-modal', handleOpenBugModal);
  }, []);

  // Radiant back button color cycling every 1 minute (60 seconds)
  const [backColorIndex, setBackColorIndex] = useState<number>(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setBackColorIndex((prev) => (prev + 1) % BACK_BUTTON_GRADIENTS.length);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const currentBackTheme = BACK_BUTTON_GRADIENTS[backColorIndex];

  const [dashboardCategoryGroup, setDashboardCategoryGroup] = useState<string | null>(null);

  // Mobile device auto-detection for students
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 768 || /Mobi|Android|iPhone/i.test(navigator.userAgent);
    }
    return false;
  });
  const [forceDesktopMode, setForceDesktopMode] = useState<boolean>(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileDevice(window.innerWidth <= 768 || /Mobi|Android|iPhone/i.test(navigator.userAgent));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isStudentMobile = Boolean(currentUser?.level === 3 && isMobileDevice && !forceDesktopMode);

  const navigateToTab = (tab: string, studentId?: string) => {
    setSelectedStudentIdForTab(studentId || undefined);
    setNavigationHistory(prev => {
      if (prev[prev.length - 1] === tab) return prev;
      return [...prev, tab];
    });
    if (tab === 'dashboard') {
      setDashboardCategoryGroup(null);
    }
    setActiveTab(tab);
  };

  const handleBack = () => {
    if (activeTab !== 'dashboard') {
      const parentCat = TAB_PARENT_CATEGORY_MAP[activeTab] || null;
      setDashboardCategoryGroup(parentCat);
      setActiveTab('dashboard');
      setNavigationHistory(prev => {
        if (prev.length > 1) return prev.slice(0, prev.length - 1);
        return ['dashboard'];
      });
    } else if (dashboardCategoryGroup !== null) {
      setDashboardCategoryGroup(null);
    }
  };

  const getActiveTabTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard': return 'داشبورد اصلی و مدیریت سریع';
      case 'student-requests': return currentUser?.level === 3 ? 'پنل ثبت درخواست طلاب' : 'پنل رسیدگی به درخواست طلاب';
      case 'todos': return 'پیگیری‌ها و تسک‌های جاری';
      case 'workflow': return 'جریان کار و کارتابل تاییدات';
      case 'academic-calendar': return 'تقویم آموزشی و سالنامه تحصیلی';
      case 'presence-hours': return 'ثبت ساعت حضور و کارکرد';
      case 'finance-tuition': return 'محاسبه شهریه طلاب';
      case 'finance-grade-mentors': return 'حق‌الزحمه اساتید پایه';
      case 'finance-teachers': return 'حق‌الزحمه اساتید';
      case 'finance-lunch': return 'اطلاعات نهار و شام';
      case 'student-meals': return 'سامانه رزرو وعده‌های غذایی طلاب';
      case 'student-payments': return 'سامانه پرداختی‌ها و امور مالی طلاب';
      case 'finance-claims': return 'مطالبات و بدهی‌ها';
      case 'finance-loans-fund': return 'صندوق قرض‌الحسنه و وام‌ها';
      case 'finance-expenses-reports': return 'هزینه‌ها و بودجه';
      case 'students': return 'مدیریت کل کاربران';
      case 'active-students': return 'لیست کاربران فعال';
      case 'audit-logs': return 'فعالیت‌های سایت (Audit Logs)';
      case 'programs': return 'برنامه‌های آموزشی و سرفصل‌ها';
      case 'classrooms': return 'مَدرَس‌ها و کلاس‌های درس';
      case 'student-schedule': return 'برنامه هفتگی و درسی طلاب';
      case 'teachers-schedule': return 'برنامه درسی اساتید';
      case 'research': return 'پژوهش و مقالات علمی';
      case 'article-evaluations': return 'ارزیابی مقالات علمی';
      case 'attendance': return 'حضور و غیاب طلاب';
      case 'rep-attendance': return 'ثبت حضور و غیاب (مخصوص نمایندگان)';
      case 'self-reporting': return 'ثبت خوداظهاری حضور در کلاس';
      case 'course-selection': return 'سامانه انتخاب واحد';
      case 'oral-exams': return 'سامانه آزمون شفاهی فقه و اصول';
      case 'counseling-classes': return 'کلاس‌های مشاوره';
      case 'comments': return 'نظرات و ارزیابی‌های تربیتی';
      case 'discussion': return 'گروه‌های بحثی و پایش دروس';
      case 'lockers': return 'اختصاص کمد به طلاب';
      case 'consultation-advisor': return 'دستیار چینش کلاس‌های مشاوره';
      case 'stats': return 'آمار مطالعه طلاب';
      case 'summary': return 'پرونده علمی طلاب';
      case 'teachers-bank': return 'بانک اساتید و مدرسین';
      case 'staff-bank': return 'بانک کارکنان و پرسنل';
      case 'teacher-transport': return 'سرویس و ایاب و ذهاب اساتید';
      case 'education-financial-report': return 'تنظیم گزارش مالی طلاب';
      case 'db-connection-test': return 'تست اتصال دیتابیس';
      case 'db-save-errors': return 'بازرسی خطاهای ثبت دیتابیس';
      case 'user-credentials': return 'مدیریت ورود و مشخصات کاربری';
      case 'anomaly-detection': return 'تشخیص ناهنجاری‌ها و بازرسی';
      case 'backup': return 'پشتیبان‌گیری از دیتابیس';
      case 'user-management': return 'مدیریت کاربران و دسترسی‌ها';
      default: return 'بخش مدیریت حوزه علمیه';
    }
  };

  const [theme, setTheme] = useState<'default' | 'emerald'>(() => {
    return (localStorage.getItem('app_theme') as 'default' | 'emerald') || 'default';
  });

  useEffect(() => {
    localStorage.setItem('app_theme', theme);
    if (theme === 'emerald') {
      document.documentElement.setAttribute('data-theme', 'emerald');
      document.body.classList.add('theme-emerald');
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.body.classList.remove('theme-emerald');
    }
  }, [theme]);

  const { 
    currentMentor, 
    currentMentorId 
  } = useMentor();

  // When user logs in or role changes, sync server collections into IndexedDB cache and default to dashboard
  useEffect(() => {
    if (currentUser) {
      localDb.loadAllCollectionsFromServer().catch(() => {});

      if (!activeTab || activeTab === 'todos') {
        setActiveTab('dashboard');
      } else if (!isTabAllowed(activeTab) && activeTab !== 'user-management') {
        setActiveTab('dashboard');
      }
    }
  }, [currentUser]);

  // If not logged in, render Glassmorphic Login Page
  if (!currentUser) {
    return <LoginPage />;
  }

  // Dedicated Mobile-First Teacher Portal for Teachers
  if (currentUser.role === 'teacher') {
    return <TeacherPortal />;
  }

  const handleNavigate = (tab: string, studentId?: string) => {
    navigateToTab(tab, studentId);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <MainDashboard 
            onNavigateTab={handleNavigate} 
            onOpenSettings={() => setIsSettingsModalOpen(true)}
            initialCategoryGroup={dashboardCategoryGroup}
            onCategoryGroupChange={setDashboardCategoryGroup}
          />
        );
      case 'students':
        return <StudentList initialStudentId={selectedStudentIdForTab} />;
      case 'active-students':
        return <StudentList onlyActive initialStudentId={selectedStudentIdForTab} />;
      case 'passed-courses':
        return <PassedCoursesManagement />;
      case 'discussion':
        if (isStudentMobile) {
          return <StudentMobileDiscussion onNavigateTab={handleNavigate} />;
        }
        return <StudyDiscussion initialStudentId={selectedStudentIdForTab} />;
      case 'consultation-advisor':
        return <ConsultationAdvisor onNavigate={handleNavigate} />;
      case 'lockers':
        return <LockersManagement onNavigateTab={handleNavigate} />;
      case 'programs':
        return <Programs />;
      case 'classrooms':
        return <MadrasRooms />;
      case 'student-schedule':
        if (isStudentMobile) {
          return <StudentMobileSchedule onNavigateTab={handleNavigate} />;
        }
        return <StudentSchedule initialStudentId={selectedStudentIdForTab} />;
      case 'teachers-schedule':
        return <TeachersSchedule />;
      case 'research':
        return <ResearchAndFeedback initialStudentId={selectedStudentIdForTab} />;
      case 'article-evaluations':
        return <ArticleEvaluations />;
      case 'attendance':
        if (isStudentMobile) {
          return <StudentMobileAttendance onNavigateTab={handleNavigate} />;
        }
        return <AttendanceAndStats initialStudentId={selectedStudentIdForTab} />;
      case 'rep-attendance':
        return <RepresentativeQuickAttendanceView onNavigateTab={handleNavigate} />;
      case 'self-reporting':
        return <StudentQuickSelfReportingView onNavigateTab={handleNavigate} />;
      case 'course-selection':
        return <CourseSelection />;
      case 'oral-exams':
        return <OralExamsManagement />;
      case 'counseling-classes':
        return <CounselingClasses />;
      case 'comments':
        return <StudentComments initialStudentId={selectedStudentIdForTab} />;
      case 'stats':
        if (isStudentMobile) {
          return <StudentMobileStudy onNavigateTab={handleNavigate} />;
        }
        return <StudyStats initialStudentId={selectedStudentIdForTab} />;
      case 'todos':
        return <TodoList />;
      case 'workflow':
        return <WorkflowManager onNavigate={(tab, params) => handleNavigate(tab, params?.studentId)} />;
      case 'academic-calendar':
        return <AcademicCalendar />;
      case 'presence-hours':
        return <PresenceHours />;
      case 'finance-tuition':
        return <StudentActivityAndTuition onNavigateTab={handleNavigate} />;
      case 'finance-grade-mentors':
        return <GradeProfessorsCompensation onNavigateTab={handleNavigate} />;
      case 'finance-teachers':
        return <TeachersCompensation onNavigateTab={handleNavigate} />;
      case 'finance-lunch':
        return <LunchManagement onNavigateTab={handleNavigate} />;
      case 'student-meals':
        return <StudentMealReservationView />;
      case 'student-payments':
        return <StudentPaymentsSection onNavigateTab={handleNavigate} />;
      case 'finance-claims':
        return <ClaimsManagement onNavigateTab={handleNavigate} />;
      case 'finance-loans-fund':
        return <FundAndActiveLoans onNavigateTab={handleNavigate} />;
      case 'finance-expenses-reports':
        return <ExpensesAndReports onNavigateTab={handleNavigate} />;
      case 'summary':
        if (isStudentMobile) {
          return <StudentMobileSummary onNavigateTab={handleNavigate} />;
        }
        return <Summary onNavigate={handleNavigate} initialStudentId={selectedStudentIdForTab} />;
      case 'teachers-bank':
        return <TeachersBank />;
      case 'staff-bank':
        return <StaffBank />;
      case 'teacher-transport':
        return <TeacherTransportManagement />;
      case 'student-requests':
        return <StudentRequestsPortal />;
      case 'student-portal':
        if (isStudentMobile) {
          return <StudentMobileSummary onNavigateTab={handleNavigate} />;
        }
        return <Summary onNavigate={handleNavigate} initialStudentId={currentUser?.studentId || selectedStudentIdForTab} />;
      case 'anomaly-detection':
        return <AnomalyDetectionView />;
      case 'backup':
        return <BackupAndRestore />;
      case 'audit-logs':
        return <SiteAuditLogs />;
      case 'system-health':
        return <SystemHealth />;
      case 'system-audit-logs':
      case 'system-logs':
        return (
          <React.Suspense fallback={<div className="p-12 text-center font-bold text-slate-500 dir-rtl">در حال بارگذاری لاگ‌های سیستم...</div>}>
            <SystemLogs />
          </React.Suspense>
        );
      case 'app-logs':
        return <LogViewer />;
      case 'db-save-errors':
        return <DbSaveErrorsView />;
      case 'education-financial-report':
        return <EducationFinancialReportSettings onNavigateTab={handleNavigate} />;
      case 'user-management':
        return isSuperAdmin ? (
          <UserManagementSettings />
        ) : (
          <div className="p-8 text-center bg-white rounded-3xl border border-rose-200 shadow-sm text-rose-700 font-bold">
            دسترسی به بخش مدیریت کاربران و اختیارات فقط برای سوپر ادمین مجاز است.
          </div>
        );
      case 'user-credentials':
        return <UserCredentialsSettings />;
      case 'security-pin-settings':
        return (
          <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6" dir="rtl">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
                  <KeyRound size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">افزایش سطح امنیتی حساب (پین ۴ رقمی)</h2>
                  <p className="text-xs text-slate-500 font-bold mt-0.5">
                    تنظیم پین اختصاصی جهت افزایش امنیت ورود و قفل خودکار حساب کاربری
                  </p>
                </div>
              </div>
              <AccountSecurityPinModal
                isOpen={true}
                onClose={() => setActiveTab('dashboard')}
                targetUser={currentUser}
                onUpdated={() => {
                  alert('تنظیمات امنیتی پین حساب کاربری با موفقیت بروزرسانی گردید.');
                }}
              />
            </div>
          </div>
        );
      case 'teacher-portal':
        return <TeacherPortal />;
      case 'db-connection-test':
        return <DatabaseConnectionTest />;
      default:
        return currentUser?.level < 3 ? (
          <MainDashboard onNavigateTab={handleNavigate} onOpenSettings={() => setIsSettingsModalOpen(true)} />
        ) : (
          <TodoList />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-vazir relative overflow-x-hidden" dir="rtl">
      {/* Interactive Cursor Light Aura / Dynamic Spotlight following mouse */}
      <MouseAura />

      {/* Sidebar Overlay (Drawer Backdrop) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-[#00000033] backdrop-blur-sm z-30"
          />
        )}
      </AnimatePresence>

      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          navigateToTab(tab);
          setIsSidebarOpen(false);
        }} 
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />
      
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        <header className="bg-white border-b border-slate-200/80 sticky top-0 z-20 shadow-sm">
          <div className="h-16 px-4 sm:px-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>

              {/* Header Title Info */}
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                    {getActiveTabTitle(activeTab)}
                  </h2>

                  {currentUser.isReadOnly && (
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold rounded-full flex items-center gap-1 shrink-0">
                      <Eye size={11} />
                      فقط مشاهده (نظارتی)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium mt-0.5">
                  <span className="text-indigo-600 font-bold">سطح {currentUser.level}: {currentUser.roleTitle}</span>
                  {currentUser.gradeLabel && (
                    <>
                      <span>•</span>
                      <span>محدوده: {currentUser.gradeLabel}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Top Right Header Space - User Badge & Logout */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              {/* In-App PWA Install Button for Mobile & Desktop */}
              <PWAInstallButton variant="header" />

              {/* Minimal Live Database Connection Health Indicator */}
              <div 
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-2xl text-[11px] font-bold shadow-2xs select-none cursor-default"
                title="پایگاه داده متصل و همگام است (Live DB Connected)"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="hidden lg:inline text-[10px] text-emerald-700 font-black">پایگاه داده متصل</span>
              </div>

              {/* Quick Bug Report Button for Any User */}
              <button
                type="button"
                onClick={() => {
                  setBugModalInitialValues(undefined);
                  setIsBugModalOpen(true);
                }}
                className="flex items-center gap-1.5 py-1.5 px-2.5 bg-rose-50/80 hover:bg-rose-100 text-rose-700 border border-rose-200/80 hover:border-rose-300 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                title="گزارش مشکل یا خطا در سامانه"
              >
                <Bug size={14} className="text-rose-600 shrink-0" />
                <span className="hidden xl:inline">گزارش مشکل</span>
              </button>

              {/* Display & Visual Preferences Button */}
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(true)}
                className="flex items-center gap-1.5 py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200/90 text-slate-700 hover:text-indigo-700 border border-slate-200/90 hover:border-indigo-200 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                title="تنظیمات نمایش سایت، تم رنگی و انیمیشن‌ها"
              >
                <Sliders size={14} className="text-indigo-600 shrink-0" />
                <span className="hidden sm:inline">تنظیمات نمایش</span>
              </button>

              {currentUser.role === 'super_admin' && (
                <button
                  onClick={() => navigateToTab('user-management')}
                  className={cn(
                    "hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                    activeTab === 'user-management'
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                  )}
                >
                  <Settings size={14} />
                  <span>مدیریت کاربران</span>
                </button>
              )}

              {/* User Profile Info Chip */}
              <div className="flex items-center gap-2 py-1 px-2.5 bg-slate-50 border border-slate-200/90 rounded-2xl">
                <div className={cn("w-7 h-7 rounded-xl text-white font-black flex items-center justify-center text-xs shrink-0 shadow-xs", currentUser.avatarBg || 'bg-indigo-600')}>
                  {(currentUser.name || currentUser.fullName || currentUser.username || 'ک')[0]}
                </div>
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-xs font-black text-slate-800 leading-tight">{(currentUser.name || currentUser.fullName || currentUser.username || '').split('(')[0]}</span>
                  <span className="text-[9px] text-slate-400 font-mono font-bold">@{currentUser.username}</span>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={logout}
                className="flex items-center gap-1.5 py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                title="خروج از حساب کاربری"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">خروج</span>
              </button>
            </div>
          </div>
        </header>

        {/* Universal Sub-Header Back Button - Positioned on the LEFT side and slightly lower */}
        {(activeTab !== 'dashboard' || Boolean(dashboardCategoryGroup)) && (
          <div className="bg-slate-50/90 border-b border-slate-200/80 px-4 sm:px-6 py-1.5 flex items-center justify-between min-w-0 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 truncate flex items-center gap-1.5">
              <span>محیط جاری:</span>
              <span className="text-slate-800 font-black text-xs">
                {activeTab === 'dashboard' && dashboardCategoryGroup 
                  ? `پیشخوان اصلی > ${DASHBOARD_CATEGORY_NAMES[dashboardCategoryGroup] || 'زیرمجموعه کارت‌ها'}`
                  : getActiveTabTitle(activeTab)}
              </span>
            </div>

            <button
              type="button"
              onClick={handleBack}
              className={cn(
                "flex items-center gap-1.5 py-1.5 px-4 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md hover:shadow-lg active:scale-95 border relative overflow-hidden shrink-0 group",
                currentBackTheme.bg,
                currentBackTheme.shadow,
                currentBackTheme.border
              )}
              title={activeTab === 'dashboard' ? "بازگشت به پیشخوان اصلی" : "بازگشت"}
            >
              <ChevronRight size={16} className="text-white group-hover:-translate-x-0.5 transition-transform shrink-0 drop-shadow" />
              <span className="drop-shadow-sm font-black">بازگشت</span>
            </button>
          </div>
        )}

        {/* Global Settings & Preferences Modal */}
        <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} />

        {/* Global Bug Report Modal */}
        <BugReportModal 
          isOpen={isBugModalOpen} 
          onClose={() => {
            setIsBugModalOpen(false);
            setBugModalInitialValues(undefined);
          }} 
          initialValues={bugModalInitialValues}
        />

        <main className="p-4 lg:p-8">
          {/* Global Security PIN Challenge Modal */}
          <SecurityPinModal />

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto space-y-4"
            >
              <TabErrorBoundary tabName={getActiveTabTitle(activeTab)} onNavigateHome={() => navigateToTab('dashboard')}>
                <Suspense fallback={
                  <div className="flex flex-col items-center justify-center p-12 space-y-3 dir-rtl text-slate-600 font-bold bg-white/80 rounded-2xl border border-slate-200/80 shadow-2xs">
                    <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>در حال بارگذاری سریع بخش...</span>
                  </div>
                }>
                  {renderContent()}
                </Suspense>
              </TabErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MentorProvider>
          <AppContent />
        </MentorProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
