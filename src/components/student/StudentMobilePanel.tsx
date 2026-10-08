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
  AlertCircle,
  Wallet,
  BrainCircuit,
  Coins,
  Receipt,
  ArrowRight,
  TrendingUp,
  Flame,
  CheckCircle2,
  CalendarDays
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

  const [hasRepProgram, setHasRepProgram] = useState(false);
  const [myRepProgramTitle, setMyRepProgramTitle] = useState<string>('');

  const isRepresentative = useMemo(() => {
    return (
      currentUser?.role === 'class_representative' || 
      currentUser?.roleTitle?.includes('نماینده') ||
      Boolean((currentUser as any)?.managedClassId) ||
      Boolean((currentUser as any)?.representativeProgramIds?.length) ||
      hasRepProgram
    );
  }, [currentUser, hasRepProgram]);

  useEffect(() => {
    loadStudentData();
  }, [currentUser, todayDayName]);

  const loadStudentData = async () => {
    try {
      setIsLoading(true);
      const [allProgs, allReqs, allStudents] = await Promise.all([
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<StudentRequest>('student_requests'),
        localDb.getDocs<any>('students')
      ]);

      const studentGrade = currentUser?.gradeLabel || 'پایه ۷';
      const cName = (currentUser?.name || currentUser?.fullName || '').trim().toLowerCase();
      const sId = currentUser?.studentId || currentUser?.linkedStudentId || currentUser?.id;
      const uName = (currentUser?.username || '').trim().toLowerCase();

      // Find matching student
      const matchedSt = allStudents.find(s => 
        (sId && s.id === sId) ||
        (uName && (s.nationalId?.toLowerCase() === uName || s.studentCode?.toLowerCase() === uName)) ||
        (cName && s.name?.toLowerCase().includes(cName))
      );

      const candidateIds = [sId, currentUser?.id, matchedSt?.id, matchedSt?.studentCode, matchedSt?.nationalId].filter(Boolean);
      const candidateNames = [cName, matchedSt?.name?.toLowerCase()].filter(Boolean);

      const filteredToday = allProgs.filter(p => {
        const matchesDay = Array.isArray(p.days) 
          ? p.days.includes(todayDayName)
          : (p.day && p.day.includes(todayDayName));

        if (!matchesDay) return false;

        const matchesGrade = !p.grade || p.grade === studentGrade || p.grade === 'همه پایه‌ها';
        const matchesEnrollment = candidateIds.some(id => Array.isArray((p as any).studentIds) && (p as any).studentIds.includes(id));
        const matchesRep = candidateIds.some(id => Array.isArray((p as any).representativeStudentIds) && (p as any).representativeStudentIds.includes(id));
        const matchesRepName = candidateNames.some(cn => Array.isArray((p as any).representativeNames) && (p as any).representativeNames.some((n: string) => n.toLowerCase().includes(cn!)));

        return matchesGrade || matchesEnrollment || matchesRep || matchesRepName;
      });

      const repProg = allProgs.find(p => {
        const matchesId = candidateIds.some(id => Array.isArray((p as any).representativeStudentIds) && (p as any).representativeStudentIds.includes(id));
        const matchesName = candidateNames.some(cn => Array.isArray((p as any).representativeNames) && (p as any).representativeNames.some((n: string) => n.toLowerCase().includes(cn!)));
        const matchesCust = candidateNames.some(cn => p.customRepresentative && p.customRepresentative.toLowerCase().includes(cn!));
        const matchesManaged = (currentUser as any)?.managedClassId && p.id === (currentUser as any)?.managedClassId;
        return matchesId || matchesName || matchesCust || matchesManaged;
      });

      if (repProg) {
        setHasRepProgram(true);
        setMyRepProgramTitle(repProg.title || 'کلاس تحت نمایندگی');
      }

      setTodayPrograms(filteredToday);

      // Pending requests for this student
      if (Array.isArray(allReqs)) {
        const myReqs = allReqs.filter(r => 
          (r.studentId && candidateIds.includes(r.studentId)) || 
          ((r as any).nationalId && ((r as any).nationalId === currentUser?.username || (matchedSt && (r as any).nationalId === matchedSt.nationalId)))
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
    <div className="min-h-screen bg-slate-900/5 pb-28 font-vazir text-right text-slate-800 relative selection:bg-indigo-500 selection:text-white" dir="rtl">
      {/* 1. Radiant Header with Luminous Mesh Gradient & Stars */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 rounded-b-[2.5rem] shadow-2xl shadow-indigo-950/40 space-y-4 border-b border-indigo-500/20">
        {/* Ambient Glowing Orbs */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -left-12 w-48 h-48 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-1/3 w-40 h-40 bg-pink-500/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse ring-4 ring-emerald-400/20" />
            <span className="text-[11px] font-black tracking-wide text-indigo-200">پیشخوان هوشمند طلاب</span>
          </div>

          <div className="flex items-center gap-2">
            {onSwitchToDesktopView && (
              <button
                type="button"
                onClick={onSwitchToDesktopView}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black transition-all border border-white/20 active:scale-95 shadow-xs cursor-pointer backdrop-blur-md"
                title="مشاهده نسخه کامل دسکتاپ"
              >
                نمای لپ‌تاپ
              </button>
            )}
            <button
              type="button"
              onClick={logout}
              className="p-1.5 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 rounded-xl transition-all border border-rose-500/30 cursor-pointer active:scale-95"
              title="خروج از حساب"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>

        {/* User Profile Card */}
        <div className="relative z-10 flex items-center gap-3.5 pt-1">
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-xl shrink-0 border border-white/30 relative overflow-hidden",
            isRepresentative 
              ? "bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 ring-2 ring-emerald-400/40" 
              : "bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 ring-2 ring-indigo-400/40"
          )}>
            <div className="absolute inset-0 bg-white/10 backdrop-blur-xs" />
            <span className="relative z-10">{displayName[0] || 'ط'}</span>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-indigo-300 font-bold">سلام و درود؛ یا علی (ع)</span>
            </div>
            <h1 className="text-base sm:text-lg font-black text-white truncate drop-shadow-sm">{displayName}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "text-[10px] font-black px-2.5 py-0.5 rounded-lg border shadow-xs",
                isRepresentative 
                  ? "bg-emerald-500/30 text-emerald-200 border-emerald-400/40"
                  : "bg-indigo-500/30 text-indigo-200 border-indigo-400/40"
              )}>
                {isRepresentative ? '⭐ نماینده رسمی کلاس' : `طلبه ${currentUser?.gradeLabel || 'سطح ۳'}`}
              </span>
              <span className="text-[10px] text-slate-300 font-medium">
                {todayDayName} {todayShamsi}
              </span>
            </div>
          </div>
        </div>

        {/* Quick KPI Glass Pills */}
        <div className="relative z-10 grid grid-cols-4 gap-2 pt-2 border-t border-white/10 text-center">
          <div 
            onClick={() => onNavigateTab('student-schedule')}
            className="bg-white/10 hover:bg-white/15 backdrop-blur-md p-2 rounded-2xl border border-white/10 cursor-pointer active:scale-95 transition-all shadow-xs"
          >
            <span className="text-[9px] text-indigo-200 block font-bold">کلاس‌های امروز</span>
            <span className="text-xs sm:text-sm font-black text-white">{todayPrograms.length} کلاس</span>
          </div>

          <div 
            onClick={() => onNavigateTab('student-meals')}
            className="bg-white/10 hover:bg-white/15 backdrop-blur-md p-2 rounded-2xl border border-white/10 cursor-pointer active:scale-95 transition-all shadow-xs"
          >
            <span className="text-[9px] text-amber-200 block font-bold">رزرو نهار</span>
            <span className="text-xs sm:text-sm font-black text-amber-300">سلف غذا</span>
          </div>

          <div 
            onClick={() => onNavigateTab('student-requests')}
            className="bg-white/10 hover:bg-white/15 backdrop-blur-md p-2 rounded-2xl border border-white/10 cursor-pointer active:scale-95 transition-all shadow-xs"
          >
            <span className="text-[9px] text-rose-200 block font-bold">درخواست‌ها</span>
            <span className="text-xs sm:text-sm font-black text-rose-300">
              {myRequestsCount > 0 ? `${myRequestsCount} جاری` : 'فعال'}
            </span>
          </div>

          <div 
            onClick={() => onNavigateTab('student-payments')}
            className="bg-white/10 hover:bg-white/15 backdrop-blur-md p-2 rounded-2xl border border-white/10 cursor-pointer active:scale-95 transition-all shadow-xs"
          >
            <span className="text-[9px] text-teal-200 block font-bold">پرداختی‌ها</span>
            <span className="text-xs sm:text-sm font-black text-teal-300">مالی</span>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">
        {/* 2. Direct Hero Action Banner: Class Representative or Attendance Record */}
        {isRepresentative ? (
          <div 
            onClick={() => onNavigateTab('attendance')}
            className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-xl shadow-emerald-900/25 border border-emerald-400/40 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all group relative overflow-hidden"
          >
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/15 rounded-full blur-xl pointer-events-none" />
            <div className="space-y-1.5 relative z-10">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-black border border-white/20 backdrop-blur-xs">
                <Sparkles size={11} className="text-amber-300 animate-spin" />
                <span>دسترسی مستقیم نماینده کلاس</span>
              </span>
              <h3 className="text-sm sm:text-base font-black text-white">
                ثبت حضور و غیاب امروز: «{myRepProgramTitle || 'کلاس تحت نمایندگی'}»
              </h3>
              <p className="text-[11px] text-emerald-100 font-medium">
                ثبت سریع وضعیت حاضر/غایب کلیه اعضای کلاس با ۱ لمس
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white text-emerald-800 flex items-center justify-center font-black shadow-lg shrink-0 group-hover:scale-105 transition-transform border border-emerald-100 relative z-10">
              <CheckSquare size={24} />
            </div>
          </div>
        ) : (
          <div 
            onClick={() => onNavigateTab('attendance')}
            className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white shadow-xl shadow-indigo-900/25 border border-indigo-400/40 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all group relative overflow-hidden"
          >
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/15 rounded-full blur-xl pointer-events-none" />
            <div className="space-y-1.5 relative z-10">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-black border border-white/20 backdrop-blur-xs">
                <ShieldCheck size={12} className="text-emerald-300" />
                <span>پرونده انضباطی و آموزشی</span>
              </span>
              <h3 className="text-sm sm:text-base font-black text-white">
                کارنامه و آمار غیبت‌های من
              </h3>
              <p className="text-[11px] text-indigo-100 font-medium">
                مشاهده ریز غیبت‌ها، تاخیرها، جلسات دروس و کارنامه حضور
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white text-indigo-800 flex items-center justify-center font-black shadow-lg shrink-0 group-hover:scale-105 transition-transform border border-indigo-100 relative z-10">
              <CheckSquare size={24} />
            </div>
          </div>
        )}

        {/* 3. FOUR CORE ESSENTIAL STUDENT MODULES (VIBRANT LUMINOUS CARDS) */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2.5">
            <h2 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
              <Sparkles size={14} className="text-indigo-600" />
              <span>سامانه‌های اصلی و پرکاربرد طلاب</span>
            </h2>
            <span className="text-[10px] text-slate-400 font-bold">بخش‌های منتخب</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Card 1: رزرو نهار و شام (سلف) */}
            <div
              onClick={() => onNavigateTab('student-meals')}
              className="relative overflow-hidden rounded-3xl p-4 bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/25 border border-amber-300/40 cursor-pointer active:scale-95 transition-all duration-300 group flex flex-col justify-between min-h-[125px]"
            >
              <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/15 rounded-full blur-lg pointer-events-none" />
              <div className="flex items-center justify-between relative z-10">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black shadow-sm border border-white/30 group-hover:scale-105 transition-transform">
                  <UtensilsCrossed size={20} className="text-white" />
                </div>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-black/20 text-amber-100 border border-white/20">
                  سلف غذا
                </span>
              </div>
              <div className="relative z-10 space-y-0.5 pt-2">
                <h3 className="text-xs sm:text-sm font-black text-white">رزرو نهار و شام</h3>
                <p className="text-[10px] text-amber-100 font-medium">سفارش وعده‌های غذایی</p>
              </div>
            </div>

            {/* Card 2: کارنامه علمی */}
            <div
              onClick={() => onNavigateTab('student-portal')}
              className="relative overflow-hidden rounded-3xl p-4 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg shadow-indigo-600/25 border border-indigo-300/40 cursor-pointer active:scale-95 transition-all duration-300 group flex flex-col justify-between min-h-[125px]"
            >
              <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/15 rounded-full blur-lg pointer-events-none" />
              <div className="flex items-center justify-between relative z-10">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black shadow-sm border border-white/30 group-hover:scale-105 transition-transform">
                  <BrainCircuit size={20} className="text-white" />
                </div>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-black/20 text-purple-100 border border-white/20">
                  سوابق
                </span>
              </div>
              <div className="relative z-10 space-y-0.5 pt-2">
                <h3 className="text-xs sm:text-sm font-black text-white">کارنامه علمی</h3>
                <p className="text-[10px] text-purple-100 font-medium">پرونده و رشد تحصیلی</p>
              </div>
            </div>

            {/* Card 3: پنل ثبت درخواست */}
            <div
              onClick={() => onNavigateTab('student-requests')}
              className="relative overflow-hidden rounded-3xl p-4 bg-gradient-to-br from-rose-500 via-pink-600 to-red-600 text-white shadow-lg shadow-rose-600/25 border border-rose-300/40 cursor-pointer active:scale-95 transition-all duration-300 group flex flex-col justify-between min-h-[125px]"
            >
              <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/15 rounded-full blur-lg pointer-events-none" />
              <div className="flex items-center justify-between relative z-10">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black shadow-sm border border-white/30 group-hover:scale-105 transition-transform">
                  <Send size={19} className="text-white" />
                </div>
                {myRequestsCount > 0 ? (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-white text-rose-700 shadow-xs">
                    {myRequestsCount} در جریان
                  </span>
                ) : (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-black/20 text-rose-100 border border-white/20">
                    آنلاین
                  </span>
                )}
              </div>
              <div className="relative z-10 space-y-0.5 pt-2">
                <h3 className="text-xs sm:text-sm font-black text-white">ثبت تقاضا و درخواست</h3>
                <p className="text-[10px] text-rose-100 font-medium">مرخصی، گواهی و رفاهی</p>
              </div>
            </div>

            {/* Card 4: سامانه پرداختی‌ها و امور مالی */}
            <div
              onClick={() => onNavigateTab('student-payments')}
              className="relative overflow-hidden rounded-3xl p-4 bg-gradient-to-br from-teal-600 via-emerald-600 to-cyan-700 text-white shadow-lg shadow-teal-600/25 border border-teal-300/40 cursor-pointer active:scale-95 transition-all duration-300 group flex flex-col justify-between min-h-[125px]"
            >
              <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/15 rounded-full blur-lg pointer-events-none" />
              <div className="flex items-center justify-between relative z-10">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black shadow-sm border border-white/30 group-hover:scale-105 transition-transform">
                  <Wallet size={20} className="text-white" />
                </div>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-400 text-emerald-950 font-black">
                  جدید
                </span>
              </div>
              <div className="relative z-10 space-y-0.5 pt-2">
                <h3 className="text-xs sm:text-sm font-black text-white">پرداختی‌ها و مالی</h3>
                <p className="text-[10px] text-emerald-100 font-medium">شهریه، فیش‌ها و حساب</p>
              </div>
            </div>
          </div>
        </div>

        {/* 4. TODAY'S CLASSES TIMELINE (برنامه کلاس‌های امروز) */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                <Clock size={16} />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-800">کلاس‌های امروز شما ({todayDayName})</h3>
                <span className="text-[10px] text-slate-400 font-medium">{todayPrograms.length} جلسه برنامه‌ریزی شده</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('student-schedule')}
              className="text-[11px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 bg-indigo-50 px-2.5 py-1 rounded-xl cursor-pointer"
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
            <div className="space-y-2.5">
              {todayPrograms.map(p => (
                <div 
                  key={p.id}
                  className="p-3.5 bg-slate-50/70 hover:bg-indigo-50/50 rounded-2xl border border-slate-200/80 transition-all flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-slate-900 truncate">{p.title}</span>
                      {p.subjectBook && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-bold">
                          {p.subjectBook}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                      <span>استاد: {p.teacher || 'تعیین نشده'}</span>
                      {p.madrasRoom && (
                        <>
                          <span>•</span>
                          <span className="text-indigo-700 font-black">مَدرَس {p.madrasRoom}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-left shrink-0">
                    <span className="text-[11px] font-mono font-black text-indigo-700 bg-white px-2.5 py-1 rounded-xl border border-indigo-200 shadow-2xs">
                      {p.time || 'نامشخص'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5. SECONDARY FEATURE TILES WITH RADIANT ACCENTS */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2.5">
            <h2 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
              <CalendarDays size={14} className="text-indigo-600" />
              <span>امور آموزشی و علمی</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Weekly Schedule */}
            <div 
              onClick={() => onNavigateTab('student-schedule')}
              className="p-3.5 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer active:scale-95 space-y-2 group"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
                <Calendar size={18} />
              </div>
              <div>
                <div className="text-xs font-black text-slate-900">برنامه کلاسی هفتگی</div>
                <div className="text-[10px] text-slate-400 font-medium">ساعات دروس و اساتید</div>
              </div>
            </div>

            {/* Discussion Groups */}
            <div 
              onClick={() => onNavigateTab('discussion')}
              className="p-3.5 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer active:scale-95 space-y-2 group"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-700 text-white flex items-center justify-center font-bold shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform">
                <Users size={18} />
              </div>
              <div>
                <div className="text-xs font-black text-slate-900">گروه مباحثه من</div>
                <div className="text-[10px] text-slate-400 font-medium">هم‌بحثی‌ها و پایش درس</div>
              </div>
            </div>

            {/* Study Stats */}
            <div 
              onClick={() => onNavigateTab('stats')}
              className="p-3.5 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer active:scale-95 space-y-2 group"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-600 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                <BookOpen size={18} />
              </div>
              <div>
                <div className="text-xs font-black text-slate-900">ساعات مطالعه من</div>
                <div className="text-[10px] text-slate-400 font-medium">ثبت مطالعه و مباحثه</div>
              </div>
            </div>

            {/* Course Selection */}
            <div 
              onClick={() => onNavigateTab('course-selection')}
              className="p-3.5 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer active:scale-95 space-y-2 group"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-teal-500/20 group-hover:scale-105 transition-transform">
                <BookCheck size={18} />
              </div>
              <div>
                <div className="text-xs font-black text-slate-900">انتخاب واحد</div>
                <div className="text-[10px] text-slate-400 font-medium">واحدهای آموزشی دوره</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Fixed Ergonomic Bottom Navigation Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 py-2 px-3 z-40 flex items-center justify-around shadow-2xl">
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
          onClick={() => onNavigateTab('student-payments')}
          className="flex flex-col items-center gap-1 text-slate-600 hover:text-teal-600 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
            <Wallet size={17} />
          </div>
          <span className="text-[10px] font-bold">پرداختی‌ها</span>
        </button>
      </div>
    </div>
  );
};
