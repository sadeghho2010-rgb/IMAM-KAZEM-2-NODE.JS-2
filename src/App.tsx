/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import StudentList from './components/StudentList';
import Programs from './components/Programs';
import StudentSchedule from './components/StudentSchedule';
import ResearchAndFeedback from './components/ResearchAndFeedback';
import AttendanceAndStats from './components/AttendanceAndStats';
import StudyStats from './components/StudyStats';
import Summary from './components/Summary';
import BackupAndRestore from './components/BackupAndRestore';
import SiteAuditLogs from './components/SiteAuditLogs';
import LogViewer from './components/LogViewer';
import DbSaveErrorsView from './components/DbSaveErrorsView';
import EducationFinancialReportSettings from './components/education/EducationFinancialReportSettings';
import TeacherTransportManagement from './components/education/TeacherTransportManagement';
import TodoList from './components/TodoList';
import StudentComments from './components/StudentComments';
import StudyDiscussion from './components/StudyDiscussion';
import AcademicCalendar from './components/AcademicCalendar';
import PresenceHours from './components/PresenceHours';
import TeachersBank from './components/TeachersBank';
import StaffBank from './components/finance/StaffBank';
import TeachersSchedule from './components/TeachersSchedule';
import MadrasRooms from './components/MadrasRooms';
import WorkflowManager from './components/WorkflowManager';
import CounselingClasses from './components/CounselingClasses';
import CourseSelection from './components/CourseSelection';
import OralExamsManagement from './components/OralExamsManagement';
import ArticleEvaluations from './components/ArticleEvaluations';
import FinanceManagerDashboard from './components/FinanceManagerDashboard';
import StudentActivityAndTuition from './components/finance/StudentActivityAndTuition';
import GradeProfessorsCompensation from './components/finance/GradeProfessorsCompensation';
import TeachersCompensation from './components/finance/TeachersCompensation';
import LunchManagement from './components/finance/LunchManagement';
import StudentMealReservationView from './components/finance/StudentMealReservationView';
import ClaimsManagement from './components/finance/ClaimsManagement';
import FundAndActiveLoans from './components/finance/FundAndActiveLoans';
import ExpensesAndReports from './components/finance/ExpensesAndReports';
import { ConsultationAdvisor } from './components/ConsultationAdvisor';
import LockersManagement from './components/LockersManagement';
import LoginPage from './components/auth/LoginPage';
import UserManagementSettings from './components/admin/UserManagementSettings';
import UserCredentialsSettings from './components/admin/UserCredentialsSettings';
import DatabaseConnectionTest from './components/DatabaseConnectionTest';
import TeacherPortal from './components/TeacherPortal';
import StudentRequestsPortal from './components/StudentRequestsPortal';
import AnomalyDetectionView from './components/admin/AnomalyDetectionView';
import SecurityPinModal from './components/auth/SecurityPinModal';
import AccountSecurityPinModal from './components/auth/AccountSecurityPinModal';
import MainDashboard from './components/MainDashboard';
import SettingsModal from './components/SettingsModal';
import { MentorProvider, useMentor } from './context/MentorContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import BugReportModal from './components/BugReportModal';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, LogOut, Settings, Eye, Palette, Bug, Sparkles, Sliders, ArrowRight, LayoutDashboard, ChevronLeft, KeyRound } from 'lucide-react';
import { cn } from './lib/utils';

function AppContent() {
  const { currentUser, logout, isTabAllowed, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<string>(() => {
    return 'dashboard';
  });
  const [navigationHistory, setNavigationHistory] = useState<string[]>(['dashboard']);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Closed by default
  const [selectedStudentIdForTab, setSelectedStudentIdForTab] = useState<string | undefined>(undefined);
  const [isBugModalOpen, setIsBugModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const navigateToTab = (tab: string, studentId?: string) => {
    if (studentId) {
      setSelectedStudentIdForTab(studentId);
    }
    setNavigationHistory(prev => {
      if (prev[prev.length - 1] === tab) return prev;
      return [...prev, tab];
    });
    setActiveTab(tab);
  };

  const handleBack = () => {
    setNavigationHistory(prev => {
      if (prev.length > 1) {
        const nextHistory = prev.slice(0, prev.length - 1);
        const targetTab = nextHistory[nextHistory.length - 1] || 'dashboard';
        setActiveTab(targetTab);
        return nextHistory;
      } else {
        setActiveTab('dashboard');
        return ['dashboard'];
      }
    });
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

  // When user logs in or role changes, default to dashboard for all users (including level 3)
  useEffect(() => {
    if (currentUser) {
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
    if (studentId) {
      setSelectedStudentIdForTab(studentId);
    }
    setActiveTab(tab);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <MainDashboard onNavigateTab={handleNavigate} onOpenSettings={() => setIsSettingsModalOpen(true)} />;
      case 'students':
        return <StudentList initialStudentId={selectedStudentIdForTab} />;
      case 'active-students':
        return <StudentList onlyActive initialStudentId={selectedStudentIdForTab} />;
      case 'discussion':
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
        return <StudentSchedule initialStudentId={selectedStudentIdForTab} />;
      case 'teachers-schedule':
        return <TeachersSchedule />;
      case 'research':
        return <ResearchAndFeedback initialStudentId={selectedStudentIdForTab} />;
      case 'article-evaluations':
        return <ArticleEvaluations />;
      case 'attendance':
        return <AttendanceAndStats initialStudentId={selectedStudentIdForTab} />;
      case 'course-selection':
        return <CourseSelection />;
      case 'oral-exams':
        return <OralExamsManagement />;
      case 'counseling-classes':
        return <CounselingClasses />;
      case 'comments':
        return <StudentComments initialStudentId={selectedStudentIdForTab} />;
      case 'stats':
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
      case 'finance-claims':
        return <ClaimsManagement onNavigateTab={handleNavigate} />;
      case 'finance-loans-fund':
        return <FundAndActiveLoans onNavigateTab={handleNavigate} />;
      case 'finance-expenses-reports':
        return <ExpensesAndReports onNavigateTab={handleNavigate} />;
      case 'summary':
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
        return <Summary onNavigate={handleNavigate} initialStudentId={currentUser?.studentId || selectedStudentIdForTab} />;
      case 'anomaly-detection':
        return <AnomalyDetectionView />;
      case 'backup':
        return <BackupAndRestore />;
      case 'audit-logs':
        return <SiteAuditLogs />;
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
          if (window.innerWidth < 1024) {
            setIsSidebarOpen(false);
          }
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

              {/* Universal Header Return to Dashboard Button */}
              {activeTab !== 'dashboard' && (
                <button
                  type="button"
                  onClick={() => navigateToTab('dashboard')}
                  className="flex items-center gap-1.5 py-1.5 px-2.5 sm:px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 border border-indigo-200/90 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs shrink-0 group active:scale-95"
                  title="بازگشت به داشبورد اصلی"
                >
                  <LayoutDashboard size={14} className="text-indigo-600 group-hover:scale-110 transition-transform shrink-0" />
                  <span className="hidden xs:inline">بازگشت به داشبورد</span>
                </button>
              )}

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

        {/* Global Settings & Preferences Modal */}
        <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} />

        {/* Global Bug Report Modal */}
        <BugReportModal isOpen={isBugModalOpen} onClose={() => setIsBugModalOpen(false)} />

        <main className="p-4 lg:p-8">
          {/* Global Security PIN Challenge Modal */}
          <SecurityPinModal />

          {/* Universal Sticky / Prominent Back to Dashboard Banner for all sections */}
          {activeTab !== 'dashboard' && (
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 px-3.5 sm:px-4 py-2.5 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xs mb-4">
              <div className="flex items-center gap-2 text-xs min-w-0">
                <button
                  type="button"
                  onClick={() => navigateToTab('dashboard')}
                  className="flex items-center gap-1.5 text-indigo-700 hover:text-indigo-900 font-black hover:underline cursor-pointer group shrink-0"
                >
                  <LayoutDashboard size={14} className="text-indigo-600 group-hover:scale-110 transition-transform shrink-0" />
                  <span>داشبورد اصلی</span>
                </button>
                <ChevronLeft size={13} className="text-slate-400 shrink-0" />
                <span className="font-bold text-slate-800 truncate">{getActiveTabTitle(activeTab)}</span>
              </div>
              <button
                type="button"
                onClick={() => navigateToTab('dashboard')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 shrink-0"
                title="بازگشت سریع به صفحه اصلی"
              >
                <ArrowRight size={13} />
                <span>بازگشت به داشبورد</span>
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto space-y-4"
            >
              {renderContent()}
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
