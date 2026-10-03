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
import MainDashboard from './components/MainDashboard';
import SettingsModal from './components/SettingsModal';
import { MentorProvider, useMentor } from './context/MentorContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import DatabaseToastBanner from './components/DatabaseToastBanner';
import BugReportModal from './components/BugReportModal';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, LogOut, Settings, Eye, Palette, Bug, Sparkles, Sliders, ArrowRight } from 'lucide-react';
import { cn } from './lib/utils';

function AppContent() {
  const { currentUser, logout, isTabAllowed, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<string>(() => {
    return (currentUser && currentUser.level < 3) ? 'dashboard' : 'todos';
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

  // When user logs in or role changes, default to dashboard for level 1 and 2
  useEffect(() => {
    if (currentUser) {
      if (currentUser.level < 3) {
        if (!activeTab || activeTab === 'todos') {
          setActiveTab('dashboard');
        }
      } else {
        if (!isTabAllowed(activeTab) && activeTab !== 'user-management') {
          const fallback = currentUser.allowedTabs?.[0] || (currentUser as any).allowedModules?.[0] || 'todos';
          setActiveTab(fallback);
        }
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
      case 'anomaly-detection':
        return <AnomalyDetectionView />;
      case 'backup':
        return <BackupAndRestore />;
      case 'audit-logs':
        return <SiteAuditLogs />;
      case 'app-logs':
        return <LogViewer />;
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
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto space-y-4"
            >
              {/* Prominent High-Visibility Return Banner for All Sections */}
              {activeTab !== 'dashboard' && (
                <div className="flex items-center justify-between gap-3 p-3.5 sm:p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl shadow-lg border border-indigo-500/30 mb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
                      <ArrowRight size={22} className="stroke-[2.5]" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-medium text-emerald-300">موقعیت فعلی شما:</span>
                      <span className="text-xs sm:text-sm font-black text-white truncate">{getActiveTabTitle(activeTab)}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleBack}
                    className="group flex items-center gap-2 sm:gap-2.5 px-5 py-2.5 sm:px-6 sm:py-3 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 text-slate-950 rounded-2xl shadow-lg hover:shadow-emerald-500/30 font-black text-xs sm:text-sm transition-all transform hover:-translate-y-0.5 active:scale-95 cursor-pointer border border-white/40 ring-2 ring-emerald-400/40 shrink-0"
                    title="بازگشت به کارت‌ها و صفحه قبل"
                  >
                    <ArrowRight size={20} className="stroke-[3] transform group-hover:translate-x-1 transition-transform" />
                    <span>برگشت به داشبورد</span>
                  </button>
                </div>
              )}

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
          <DatabaseToastBanner />
          <AppContent />
        </MentorProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
