import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  BookOpen, 
  Calendar, 
  CheckSquare, 
  Clock, 
  DoorOpen, 
  GraduationCap, 
  LogOut, 
  MessageSquare, 
  Send, 
  Sparkles, 
  UserCheck, 
  Users, 
  UtensilsCrossed, 
  Award, 
  BookCheck, 
  ChevronLeft, 
  Sliders, 
  LayoutDashboard,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { localDb } from '../../lib/localDb';
import { Program, StudentRequest } from '../../types';
import { getTodayShamsi, getShamsiDayOfWeekName } from '../../lib/jalali';

interface StudentMobilePanelProps {
  onNavigateTab: (tab: string, studentId?: string) => void;
  onSwitchToDesktopView?: () => void;
}

export const StudentMobilePanel: React.FC<StudentMobilePanelProps> = ({
  onNavigateTab,
  onSwitchToDesktopView
}) => {
  const { currentUser, logout } = useAuth();
  const [todayPrograms, setTodayPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [myRequestsCount, setMyRequestsCount] = useState(0);

  const todayShamsi = useMemo(() => getTodayShamsi(), []);
  const todayDayName = useMemo(() => getShamsiDayOfWeekName(todayShamsi), [todayShamsi]);

  const isRepresentative = useMemo(() => {
    return (
      currentUser?.role === 'class_representative' || 
      currentUser?.roleTitle?.includes('نماینده') ||
      !!(currentUser as any)?.managedClassId
    );
  }, [currentUser]);

  useEffect(() => {
    loadStudentData();
  }, [currentUser, todayDayName]);

  const loadStudentData = async () => {
    try {
      setIsLoading(true);
      const [allProgs, allReqs] = await Promise.all([
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<StudentRequest>('student_requests')
      ]);

      // Filter classes today for this student's grade or enrollment
      const studentGrade = currentUser?.gradeLabel || 'پایه ۷';
      const cName = (currentUser?.name || currentUser?.fullName || '').trim().toLowerCase();
      const sId = currentUser?.studentId || currentUser?.linkedStudentId || currentUser?.id;

      const filteredToday = allProgs.filter(p => {
        const matchesDay = Array.isArray(p.days) 
          ? p.days.includes(todayDayName)
          : (p.day && p.day.includes(todayDayName));

        if (!matchesDay) return false;

        // Grade or enrollment match
        const matchesGrade = !p.grade || p.grade === studentGrade || p.grade === 'همه پایه‌ها';
        const matchesEnrollment = sId && Array.isArray((p as any).studentIds) && (p as any).studentIds.includes(sId);
        const matchesRep = sId && Array.isArray((p as any).representativeStudentIds) && (p as any).representativeStudentIds.includes(sId);
        const matchesRepName = cName && Array.isArray((p as any).representativeNames) && (p as any).representativeNames.some((n: string) => n.toLowerCase().includes(cName));

        return matchesGrade || matchesEnrollment || matchesRep || matchesRepName;
      });

      setTodayPrograms(filteredToday);

      // Pending requests for this student
      if (Array.isArray(allReqs)) {
        const myReqs = allReqs.filter(r => 
          (r.studentId && r.studentId === sId) || 
          ((r as any).nationalId && (r as any).nationalId === currentUser?.username)
        );
        setMyRequestsCount(myReqs.filter(r => r.status === 'pending').length);
      }
    } catch (e) {
      console.warn('Error loading mobile student data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const displayName = (currentUser?.name || currentUser?.fullName || currentUser?.username || 'دانش‌پژوه').split('(')[0].trim();

  return (
    <div className="min-h-screen bg-slate-900/5 pb-24 font-vazir text-right text-slate-800" dir="rtl">
      {/* 1. Mobile Header & Glassmorphism Greeting */}
      <div className="bg-gradient-to-b from-indigo-900 via-indigo-950 to-slate-900 text-white p-5 rounded-b-3xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold text-indigo-200">نسخه ویژه موبایل طلاب</span>
          </div>

          <div className="flex items-center gap-1.5">
            {onSwitchToDesktopView && (
              <button
                type="button"
                onClick={onSwitchToDesktopView}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-bold transition-all border border-white/15"
                title="مشاهده نسخه کامل دسکتاپ"
              >
                نمای دسکتاپ
              </button>
            )}
            <button
              type="button"
              onClick={logout}
              className="p-1.5 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 rounded-xl transition-all border border-rose-500/30"
              title="خروج"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>

        {/* User Card */}
        <div className="flex items-center gap-3.5 pt-1">
          <div className={cn(
            "w-13 h-13 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-lg shrink-0 border border-white/20",
            isRepresentative ? "bg-gradient-to-tr from-emerald-600 to-teal-500" : "bg-gradient-to-tr from-indigo-600 to-purple-600"
          )}>
            {displayName[0] || 'ط'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-indigo-300 font-bold">سلام و احترام؛ یا علی</div>
            <h1 className="text-base font-black text-white truncate">{displayName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn(
                "text-[10px] font-black px-2 py-0.5 rounded-md border",
                isRepresentative 
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : "bg-white/10 text-indigo-200 border-white/15"
              )}>
                {isRepresentative ? 'نماینده رسمی کلاس' : `طلبه ${currentUser?.gradeLabel || 'سطح ۳'}`}
              </span>
              <span className="text-[10px] text-slate-300 font-medium">
                {todayDayName} {todayShamsi}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats Pills */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-center">
          <div className="bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/10">
            <span className="text-[10px] text-indigo-200 block font-bold">کلاس‌های امروز</span>
            <span className="text-sm font-black text-white">{todayPrograms.length} کلاس</span>
          </div>

          <div 
            onClick={() => onNavigateTab('student-requests')}
            className="bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/10 cursor-pointer active:scale-95 transition-all"
          >
            <span className="text-[10px] text-indigo-200 block font-bold">درخواست‌ها</span>
            <span className="text-sm font-black text-white">
              {myRequestsCount > 0 ? `${myRequestsCount} در جریان` : 'فعال'}
            </span>
          </div>

          <div 
            onClick={() => onNavigateTab('student-meals')}
            className="bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/10 cursor-pointer active:scale-95 transition-all"
          >
            <span className="text-[10px] text-indigo-200 block font-bold">رزرو نهار</span>
            <span className="text-sm font-black text-amber-300">سلف طلاب</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 2. Primary Action Hero Card */}
        {isRepresentative ? (
          <div 
            onClick={() => onNavigateTab('attendance')}
            className="p-4 rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-lg shadow-emerald-900/20 border border-emerald-400/30 flex items-center justify-between cursor-pointer active:scale-98 transition-all group"
          >
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-black">
                <Sparkles size={11} className="text-amber-300 animate-spin" />
                <span>دسترسی ویژه نماینده کلاس</span>
              </span>
              <h3 className="text-sm font-black text-white">ثبت حضور و غیاب امروز</h3>
              <p className="text-[11px] text-emerald-100">ثبت وضعیت حاضر/غایب طلاب کلاس تحت نمایندگی شما</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-white text-emerald-800 flex items-center justify-center font-black shadow-md shrink-0 group-hover:scale-105 transition-transform">
              <CheckSquare size={20} />
            </div>
          </div>
        ) : (
          <div 
            onClick={() => onNavigateTab('attendance')}
            className="p-4 rounded-3xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white shadow-lg shadow-indigo-900/20 border border-indigo-400/30 flex items-center justify-between cursor-pointer active:scale-98 transition-all group"
          >
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-black">
                <ShieldCheck size={11} className="text-emerald-300" />
                <span>پرونده انضباطی و آموزشی</span>
              </span>
              <h3 className="text-sm font-black text-white">کارنامه و آمار غیبت من</h3>
              <p className="text-[11px] text-indigo-100">مشاهده ریز غیبت‌ها، تاخیرها و جلسات دروس</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-white text-indigo-800 flex items-center justify-center font-black shadow-md shrink-0 group-hover:scale-105 transition-transform">
              <CheckSquare size={20} />
            </div>
          </div>
        )}

        {/* 3. Today's Classes List (برنامه کلاس‌های امروز) */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Clock size={15} />
              </div>
              <h3 className="text-xs font-black text-slate-800">کلاس‌های امروز شما ({todayDayName})</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('student-schedule')}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
            >
              <span>برنامه کامل</span>
              <ChevronLeft size={13} />
            </button>
          </div>

          {todayPrograms.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs italic">
              امروز هیچ کلاسی در تقویم هفتگی شما ثبت نشده است.
            </div>
          ) : (
            <div className="space-y-2">
              {todayPrograms.map(p => (
                <div 
                  key={p.id}
                  className="p-3 bg-slate-50 hover:bg-indigo-50/50 rounded-2xl border border-slate-200/80 transition-all flex items-center justify-between"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-slate-900 truncate">{p.title}</span>
                      {p.subjectBook && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 font-bold">
                          {p.subjectBook}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                      <span>استاد: {p.teacher || 'تعیین نشده'}</span>
                      {p.madrasRoom && (
                        <>
                          <span>•</span>
                          <span className="text-indigo-700">مَدرَس {p.madrasRoom}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-left shrink-0">
                    <span className="text-[11px] font-mono font-black text-indigo-700 bg-white px-2 py-1 rounded-xl border border-indigo-200 shadow-2xs">
                      {p.time || 'نامشخص'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Sleek Mobile Grid Navigation */}
        <div className="grid grid-cols-2 gap-3">
          {/* Discussion Groups */}
          <div 
            onClick={() => onNavigateTab('study-discussion')}
            className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer active:scale-95 space-y-2"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Users size={18} />
            </div>
            <div>
              <div className="text-xs font-black text-slate-900">گروه مباحثه من</div>
              <div className="text-[10px] text-slate-400 font-medium">هم‌بحثی‌ها و ثبت مطالعه</div>
            </div>
          </div>

          {/* Student Requests */}
          <div 
            onClick={() => onNavigateTab('student-requests')}
            className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer active:scale-95 space-y-2"
          >
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <Send size={18} />
            </div>
            <div>
              <div className="text-xs font-black text-slate-900">ثبت درخواست طلاب</div>
              <div className="text-[10px] text-slate-400 font-medium">مرخصی، گواهی و نامه</div>
            </div>
          </div>

          {/* Meal Reservation */}
          <div 
            onClick={() => onNavigateTab('student-meals')}
            className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer active:scale-95 space-y-2"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <UtensilsCrossed size={18} />
            </div>
            <div>
              <div className="text-xs font-black text-slate-900">رزرو غذا (سلف)</div>
              <div className="text-[10px] text-slate-400 font-medium">نهار و وعده‌های هفتگی</div>
            </div>
          </div>

          {/* Weekly Schedule */}
          <div 
            onClick={() => onNavigateTab('student-schedule')}
            className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer active:scale-95 space-y-2"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Calendar size={18} />
            </div>
            <div>
              <div className="text-xs font-black text-slate-900">برنامه کلاسی هفتگی</div>
              <div className="text-[10px] text-slate-400 font-medium">ساعات دروس و اساتید</div>
            </div>
          </div>

          {/* Course Selection */}
          <div 
            onClick={() => onNavigateTab('course-selection')}
            className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer active:scale-95 space-y-2"
          >
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
              <BookCheck size={18} />
            </div>
            <div>
              <div className="text-xs font-black text-slate-900">انتخاب واحد</div>
              <div className="text-[10px] text-slate-400 font-medium">اخذ واحدهای آموزشی</div>
            </div>
          </div>

          {/* Research & Papers */}
          <div 
            onClick={() => onNavigateTab('research')}
            className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer active:scale-95 space-y-2"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Award size={18} />
            </div>
            <div>
              <div className="text-xs font-black text-slate-900">سوابق پژوهشی</div>
              <div className="text-[10px] text-slate-400 font-medium">مقالات و ارزیابی علمی</div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Fixed Ergonomic Bottom Navigation Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 py-2 px-3 z-40 flex items-center justify-around shadow-lg">
        <button
          type="button"
          onClick={() => onNavigateTab('dashboard')}
          className="flex flex-col items-center gap-1 text-indigo-600 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shadow-xs">
            <LayoutDashboard size={17} />
          </div>
          <span className="text-[10px] font-black">پیشخوان</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('student-schedule')}
          className="flex flex-col items-center gap-1 text-slate-600 hover:text-indigo-600 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
            <Calendar size={17} />
          </div>
          <span className="text-[10px] font-bold">کلاس‌ها</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('attendance')}
          className="flex flex-col items-center gap-1 text-slate-600 hover:text-indigo-600 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
            <CheckSquare size={17} />
          </div>
          <span className="text-[10px] font-bold">{isRepresentative ? 'ثبت حضور' : 'کارنامه'}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('student-requests')}
          className="flex flex-col items-center gap-1 text-slate-600 hover:text-indigo-600 cursor-pointer relative"
        >
          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
            <Send size={17} />
          </div>
          <span className="text-[10px] font-bold">درخواست</span>
          {myRequestsCount > 0 && (
            <span className="absolute -top-1 right-2 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
              {myRequestsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('study-discussion')}
          className="flex flex-col items-center gap-1 text-slate-600 hover:text-indigo-600 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
            <Users size={17} />
          </div>
          <span className="text-[10px] font-bold">مباحثه</span>
        </button>
      </div>
    </div>
  );
};
