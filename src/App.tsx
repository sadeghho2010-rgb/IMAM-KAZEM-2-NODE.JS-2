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
import ManagerFiles from './components/ManagerFiles';
import TodoList from './components/TodoList';
import StudentComments from './components/StudentComments';
import StudyDiscussion from './components/StudyDiscussion';
import AcademicCalendar from './components/AcademicCalendar';
import PresenceHours from './components/PresenceHours';
import TeachersBank from './components/TeachersBank';
import MentorSelectorModal from './components/MentorSelectorModal';
import LoginPage from './components/auth/LoginPage';
import UserManagementSettings from './components/admin/UserManagementSettings';
import { MentorProvider, useMentor } from './context/MentorContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, ShieldCheck, Layers, ChevronDown, UserCheck, LogOut, Settings, Eye, Lock } from 'lucide-react';
import { cn } from './lib/utils';

function AppContent() {
  const { currentUser, logout, isTabAllowed, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('todos');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedStudentIdForTab, setSelectedStudentIdForTab] = useState<string | undefined>(undefined);

  const { 
    currentMentor, 
    currentMentorId, 
    shahpooriFilter, 
    setShahpooriFilter,
    setIsMentorModalOpen 
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
      case 'programs':
        return <Programs />;
      case 'student-schedule':
        return <StudentSchedule initialStudentId={selectedStudentIdForTab} />;
      case 'research':
        return <ResearchAndFeedback initialStudentId={selectedStudentIdForTab} />;
      case 'attendance':
        return <AttendanceAndStats />;
      case 'comments':
        return <StudentComments initialStudentId={selectedStudentIdForTab} />;
      case 'stats':
        return <StudyStats initialStudentId={selectedStudentIdForTab} />;
      case 'todos':
        return <TodoList />;
      case 'academic-calendar':
        return <AcademicCalendar />;
      case 'presence-hours':
        return <PresenceHours />;
      case 'summary':
        return <Summary onNavigate={handleNavigate} initialStudentId={selectedStudentIdForTab} />;
      case 'teachers-bank':
        return <TeachersBank />;
      case 'backup':
        return <BackupAndRestore />;
      case 'manager-files':
        return <ManagerFiles />;
      case 'user-management':
        return isSuperAdmin ? (
          <UserManagementSettings />
        ) : (
          <div className="p-8 text-center bg-white rounded-3xl border border-rose-200 shadow-sm text-rose-700 font-bold">
            دسترسی به بخش مدیریت کاربران و اختیارات فقط برای سوپر ادمین مجاز است.
          </div>
        );
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
                     activeTab === 'academic-calendar' ? 'تقویم آموزشی و سالنامه تحصیلی' :
                     activeTab === 'presence-hours' ? 'بخش ثبت ساعت حضور و کارکرد' :
                     activeTab === 'students' ? 'مدیریت کل کاربران (مشترک)' :
                     activeTab === 'active-students' ? 'لیست کاربران فعال' :
                     activeTab === 'manager-files' ? (currentUser.role === 'super_admin' || currentUser.role === 'education_manager' ? 'ارسال فایل برای کاربران' : 'فایل‌های ارسالی مدیر') :
                     activeTab === 'programs' ? 'برنامه‌های آموزشی و مدرس‌ها' :
                     activeTab === 'student-schedule' ? 'برنامه هفتگی و درسی طلاب' :
                     activeTab === 'research' ? 'بخش پژوهش و مقالات' :
                     activeTab === 'attendance' ? 'حضور و غیاب طلاب' :
                     activeTab === 'comments' ? 'نظرات، صحبت‌ها و آزمون شفاهی' :
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

          {/* Shahpoori Filter Bar (Only visible when current user is Shahpoori/Admin and not on shared "مدیریت کل کاربران") */}
          {currentMentorId === 'shahpoori' && currentUser.level <= 2 && activeTab !== 'students' && (
            <div className="bg-amber-50/60 border-t border-amber-100/80 px-4 sm:px-6 py-2 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <ShieldCheck size={16} className="text-amber-600 shrink-0" />
                <span>مدیریت ارشد:</span>
                <span className="text-slate-500 font-normal hidden md:inline">انتخاب دسته طلاب فعال برای بررسی:</span>
              </div>
              
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-amber-200 shadow-sm font-bold">
                <button
                  onClick={() => setShahpooriFilter('all')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition-all text-[11px] flex items-center gap-1",
                    shahpooriFilter === 'all'
                      ? "bg-amber-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-amber-50"
                  )}
                >
                  <Layers size={12} />
                  <span>همه کاربران فعال</span>
                </button>
                
                <button
                  onClick={() => setShahpooriFilter('hayati')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition-all text-[11px] flex items-center gap-1",
                    shahpooriFilter === 'hayati'
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-emerald-700 hover:bg-emerald-50"
                  )}
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></div>
                  <span>استاد حیاتی (پایه ۷)</span>
                </button>

                <button
                  onClick={() => setShahpooriFilter('hosseini')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition-all text-[11px] flex items-center gap-1",
                    shahpooriFilter === 'hosseini'
                      ? "bg-sky-600 text-white shadow-sm"
                      : "text-sky-700 hover:bg-sky-50"
                  )}
                >
                  <div className="w-2 h-2 rounded-full bg-sky-400 shrink-0"></div>
                  <span>استاد حسینی (پایه ۸)</span>
                </button>

                <button
                  onClick={() => setShahpooriFilter('soleimani')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition-all text-[11px] flex items-center gap-1",
                    shahpooriFilter === 'soleimani'
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-purple-700 hover:bg-purple-50"
                  )}
                >
                  <div className="w-2 h-2 rounded-full bg-purple-400 shrink-0"></div>
                  <span>استاد سلیمانی (پایه ۹)</span>
                </button>

                <button
                  onClick={() => setShahpooriFilter('asadi')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition-all text-[11px] flex items-center gap-1",
                    shahpooriFilter === 'asadi'
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-rose-700 hover:bg-rose-50"
                  )}
                >
                  <div className="w-2 h-2 rounded-full bg-rose-400 shrink-0"></div>
                  <span>استاد اسدی (پایه ۱۰)</span>
                </button>
              </div>
            </div>
          )}
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

      {/* Mentor/User Selector Modal */}
      <MentorSelectorModal />
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
