import React from 'react';
import { 
  Users, 
  Calendar, 
  CalendarDays,
  BookOpen, 
  MessageSquare, 
  CheckSquare, 
  BarChart2, 
  UserCheck,
  BrainCircuit,
  GraduationCap,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  FolderOpen,
  Clock,
  LogOut,
  Settings,
  Award,
  User,
  Eye,
  DoorOpen
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useMentor } from '../context/MentorContext';
import { useAuth } from '../context/AuthContext';
import { AppModuleId } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

interface MenuItemDef {
  id: AppModuleId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const ALL_MENU_DEFINITIONS: MenuItemDef[] = [
  { id: 'student-portal', label: 'پرتال و ثبت فعالیت من', icon: User },
  { id: 'todos', label: 'پیگیری‌ها', icon: GraduationCap },
  { id: 'academic-calendar', label: 'تقویم آموزشی', icon: CalendarDays },
  { id: 'presence-hours', label: 'ساعت حضور و کارکرد', icon: Clock },
  { id: 'students', label: 'مدیریت کل طلاب', icon: Users },
  { id: 'active-students', label: 'طلاب فعال', icon: UserCheck },
  { id: 'programs', label: 'برنامه‌های مدرسه و کلاس‌ها', icon: Calendar },
  { id: 'classrooms', label: 'مدرس‌ها (کلاس‌های درس)', icon: DoorOpen },
  { id: 'student-schedule', label: 'برنامه درسی و هفتگی طلاب', icon: CalendarDays },
  { id: 'stats', label: 'آمار مطالعه طلاب', icon: BarChart2 },
  { id: 'discussion', label: 'مطالعات و مباحثات طلاب', icon: Users },
  { id: 'research', label: 'بخش پژوهش و مقالات', icon: BookOpen },
  { id: 'attendance', label: 'حضور و غیاب طلاب', icon: CheckSquare },
  { id: 'oral-exams', label: 'آزمون شفاهی طلاب', icon: Award },
  { id: 'comments', label: 'نظرات و ارزیابی‌ها', icon: MessageSquare },
  { id: 'summary', label: 'جمع‌بندی و هوش مصنوعی', icon: BrainCircuit },
  { id: 'teachers-bank', label: 'بانک اساتید و مدرسین', icon: GraduationCap },
  { id: 'manager-files', label: 'فایل‌های ارسالی مدیر', icon: FolderOpen },
  { id: 'backup', label: 'پشتیبان‌گیری دیتابیس', icon: HardDrive },
  { id: 'user-management', label: 'مدیریت کاربران و دسترسی‌ها', icon: Settings },
  { id: 'user-credentials', label: 'مدیریت ورود کاربران', icon: ShieldCheck },
];

export default function Sidebar({ activeTab, setActiveTab, isOpen }: SidebarProps) {
  const { currentMentor, setIsMentorModalOpen } = useMentor();
  const { currentUser, logout, hasModuleAccess, isReadOnly } = useAuth();

  // Filter items based on user's authorized modules
  const visibleMenuItems = ALL_MENU_DEFINITIONS.filter(item => {
    if (typeof hasModuleAccess === 'function') {
      return hasModuleAccess(item.id);
    }
    return true;
  });

  return (
    <div 
      className={cn(
        "w-64 bg-white border-l border-slate-200 h-screen fixed right-0 top-0 flex flex-col flex-shrink-0 z-40 transition-all duration-300 transform font-vazir",
        isOpen ? "translate-x-0" : "translate-x-full"
      )} 
      dir="rtl"
    >
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-sm">
            ط
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 tracking-tight">سامانه جامع طلاب</h1>
            <p className="text-[9px] text-slate-400 font-medium">نسخه ۲.۰ • احراز هویت ۳ سطحی</p>
          </div>
        </div>

        {currentUser && (
          <span className={cn(
            "text-[9px] px-2 py-0.5 rounded-full font-black border",
            currentUser.level === 1 ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
            currentUser.level === 2 ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
            "bg-cyan-50 text-cyan-800 border-cyan-200"
          )}>
            سطح {currentUser.level}
          </span>
        )}
      </div>

      {/* Active Logged-in User Profile Card */}
      {currentUser && (
        <div className="p-3 border-b border-slate-100 bg-slate-50/70">
          <div className="bg-white rounded-2xl p-2.5 border border-slate-200/90 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400">حساب کاربری فعال:</span>
              {isReadOnly ? (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200 flex items-center gap-0.5">
                  <Eye size={10} />
                  فقط مشاهده
                </span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-bold">
                  {currentUser.gradeLabel || 'سراسری'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className={cn("w-8 h-8 rounded-xl text-white font-black flex items-center justify-center text-xs shrink-0 shadow-xs", currentUser.avatarBg || 'bg-indigo-600')}>
                {(currentUser.name || currentUser.fullName || currentUser.username || 'ک')[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-black text-slate-900 truncate flex items-center gap-1">
                  <span>{(currentUser.name || currentUser.fullName || currentUser.username || '').split('(')[0]}</span>
                  {currentUser.role === 'super_admin' && <ShieldCheck size={12} className="text-amber-600 shrink-0" />}
                </div>
                <p className="text-[10px] text-slate-500 font-medium truncate">{currentUser.roleTitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
              {currentUser.level <= 2 && (
                <button
                  onClick={() => setIsMentorModalOpen(true)}
                  className="flex-1 flex items-center justify-center gap-1 py-1 px-1.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg text-[10px] font-bold text-slate-600 transition-all border border-slate-200/70"
                  title="تغییر محیط استاد / پایه"
                >
                  <RefreshCw size={11} className="text-slate-400" />
                  <span>تغییر محیط</span>
                </button>
              )}

              <button
                onClick={logout}
                className="flex items-center justify-center gap-1 py-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-bold transition-all border border-rose-200/60 cursor-pointer"
                title="خروج از حساب کاربری"
              >
                <LogOut size={11} />
                <span>خروج</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Menu Items */}
      <nav className="flex-1 p-2.5 overflow-y-auto space-y-1 custom-scrollbar">
        {visibleMenuItems.map((item) => {
          const Icon = item.icon;
          let label = item.label;

          // Contextual label adjustments
          if (item.id === 'manager-files') {
            label = currentUser?.role === 'super_admin' || (currentUser?.role as string) === 'education_officer' || currentUser?.role === 'education_manager'
              ? 'ارسال فایل برای کاربران'
              : 'فایل‌های ارسالی مدیر';
          } else if (currentUser?.level === 3) {
            if (item.id === 'student-schedule') label = 'برنامه درسی من';
            if (item.id === 'attendance') label = currentUser.role === 'class_representative' ? 'ثبت و مشاهده حضور و غیاب' : 'حضور و غیاب من';
            if (item.id === 'stats') label = 'ساعات مطالعه من';
            if (item.id === 'research') label = 'پژوهش و مقالات من';
          }

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200 text-right group cursor-pointer",
                activeTab === item.id 
                  ? "bg-indigo-50 text-indigo-700 font-bold shadow-xs border border-indigo-100" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon size={16} className={cn(
                "shrink-0 transition-colors",
                activeTab === item.id ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
              )} />
              <span className="text-xs font-semibold truncate">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer System Info */}
      <div className="p-3 border-t border-slate-100">
        <div className="bg-slate-900 text-white rounded-2xl p-2.5 text-[10px]">
          <div className="flex items-center justify-between opacity-80 mb-1">
            <span>سیستم امنیتی RBAC</span>
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
          </div>
          <p className="font-mono text-slate-300 text-[9px] truncate">
            {currentUser ? `@${currentUser.username} (${currentUser.roleTitle})` : 'مهمان'}
          </p>
        </div>
      </div>
    </div>
  );
}
