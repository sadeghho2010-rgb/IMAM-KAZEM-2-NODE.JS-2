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
import LoginPage from './components/auth/LoginPage';
import UserManagementSettings from './components/admin/UserManagementSettings';
import UserCredentialsSettings from './components/admin/UserCredentialsSettings';
import { MentorProvider, useMentor } from './context/MentorContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import DatabaseToastBanner from './components/DatabaseToastBanner';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, LogOut, Settings, Eye, Palette } from 'lucide-react';
import { cn } from './lib/utils';

function AppContent() {
  const { currentUser, logout, isTabAllowed, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('todos');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedStudentIdForTab, setSelectedStudentIdForTab] = useState<string | undefined>(undefined);

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

  useEffect(() => {
    // Open sidebar by default on large screens
    if (window.innerWidth >= 1024) {
      setIsSidebarOpen(true);
    }
  }, []);

  // When user logs in or role changes, default to an authorized tab
  useEffect(() => {
    if (currentUser) {
      if (!isTabAllowed(activeTab) && activeTab !== 'user-management') {
        const fallback = currentUser.allowedTabs?.[0] || (currentUser as any).allowedModules?.[0] || 'todos';
        setActiveTab(fallback);
      }
    }
  }, [currentUser]);

  // If not logged in, render Glassmorphic Login Page
  if (!currentUser) {
    return <LoginPage />;
  }

  const handleNavigate = (tab: string, studentId?: string) => {
    if (studentId) {
      setSelectedStudentIdForTab(studentId);
    }
    setActiveTab(tab);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'students':
        return <StudentList initialStudentId={selectedStudentIdForTab} />;
      case 'active-students':
        return <StudentList onlyActive initialStudentId={selectedStudentIdForTab} />;
      case 'discussion':
        return <StudyDiscussion initialStudentId={selectedStudentIdForTab} />;
      case 'consultation-advisor':
        return <ConsultationAdvisor onNavigate={handleNavigate} />;
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
      case 'backup':
        return <BackupAndRestore />;
      case 'audit-logs':
        return <SiteAuditLogs />;
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
      default:
        return <TodoList />;
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
          setActiveTab(tab);
          if (window.innerWidth < 1024) {
            setIsSidebarOpen(false);
          }
        }} 
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />
      
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        <header className="bg-white border-b border-slate-200/80 sticky top-0 z-20 shadow-sm">
          <div className="h-16 px-4 sm:px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              >
                {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-800">
                    {activeTab === 'todos' ? 'پیگیری‌ها' :
                     activeTab === 'workflow' ? 'جریان کار و کارتابل تاییدات' :
                     activeTab === 'academic-calendar' ? 'تقویم آموزشی و سالنامه تحصیلی' :
                     activeTab === 'presence-hours' ? 'بخش ثبت ساعت حضور و کارکرد' :
                     activeTab === 'finance-tuition' ? 'محاسبه شهریه طلاب (اطلاعات حضور، فعالیت و محاسبه مکانیزه)' :
                     activeTab === 'finance-grade-mentors' ? 'محاسبه حق‌الزحمه اساتید پایه (حق سرپرستی و پیگیری)' :
                     activeTab === 'finance-teachers' ? 'محاسبه حق‌الزحمه اساتید (ساعات تدریس و حق‌التدریس مصوب)' :
                     activeTab === 'finance-lunch' ? 'اطلاعات نهار و شام (رزرو غذا، لغو آشپزخانه و کسر شهریه)' :
                     activeTab === 'finance-claims' ? 'مدیریت مطالبات و بدهی‌ها (طلاب، اساتید، کارکنان و سایر)' :
                     activeTab === 'finance-loans-fund' ? 'گزارشات صندوق قرض‌الحسنه و وام‌ها' :
                     activeTab === 'finance-expenses-reports' ? 'هزینه‌ها (ردیف بودجه‌ها، ثبت هزینه‌ها و آمارها)' :
                     activeTab === 'students' ? 'مدیریت کل کاربران (مشترک)' :
                     activeTab === 'active-students' ? 'لیست کاربران فعال' :
                     activeTab === 'audit-logs' ? 'فعالیت‌های سایت و مانیتورینگ تغییرات' :
                     activeTab === 'programs' ? 'برنامه‌های آموزشی و سرفصل‌ها' :
                     activeTab === 'classrooms' ? 'مَدرَس‌ها (کلاس‌های درس و مدیریت فضاها)' :
                     activeTab === 'student-schedule' ? 'برنامه هفتگی و درسی طلاب' :
                     activeTab === 'teachers-schedule' ? 'برنامه درسی و ساعات حضور اساتید' :
                     activeTab === 'research' ? 'بخش پژوهش و مقالات' :
                     activeTab === 'attendance' ? 'حضور و غیاب طلاب' :
                     activeTab === 'counseling-classes' ? 'کلاس‌های مشاوره (ارزیابی، نمرات مشارکت و پژوهش)' :
                     activeTab === 'comments' ? 'نظرات، صحبت‌ها و آزمون شفاهی' :
                     activeTab === 'discussion' ? 'گروه‌های بحثی (مدیریت و چینش گروه‌ها)' :
                     activeTab === 'consultation-advisor' ? 'دستیار هوشمند چینش کلاس‌های مشاوره' :
                     activeTab === 'stats' ? 'آمار و گزارشات مطالعه' :
                     activeTab === 'summary' ? 'جمع‌بندی نهایی و هوش مصنوعی' :
                     activeTab === 'teachers-bank' ? 'بانک جامع اساتید و مدرسین' :
                     activeTab === 'user-management' ? 'مدیریت کاربران و سطوح دسترسی (ویژه سوپر ادمین)' : 'پشتیبان‌گیری'}
                  </h2>

                  {currentUser.isReadOnly && (
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold rounded-full flex items-center gap-1">
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

            {/* Top Right Header Space - User Badge, Settings & Logout */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setTheme(prev => prev === 'emerald' ? 'default' : 'emerald')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold transition-all border cursor-pointer shadow-xs",
                  theme === 'emerald'
                    ? "bg-emerald-800 text-white border-emerald-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                )}
                title="تغییر پوسته اصلی نرم‌افزار (تم سبز پررنگ و سفید)"
              >
                <Palette size={14} className={theme === 'emerald' ? "text-emerald-300" : "text-emerald-600"} />
                <span className="hidden sm:inline">{theme === 'emerald' ? 'تم سبز پررنگ (زمردی)' : 'تم لاجوردی'}</span>
              </button>

              {currentUser.role === 'super_admin' && (
                <button
                  onClick={() => setActiveTab('user-management')}
                  className={cn(
                    "hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                    activeTab === 'user-management'
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                  )}
                >
                  <Settings size={14} />
                  <span>مدیریت کاربران و دسترسی‌ها</span>
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

        <main className="p-4 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto"
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
          <DatabaseToastBanner />
          <AppContent />
        </MentorProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
