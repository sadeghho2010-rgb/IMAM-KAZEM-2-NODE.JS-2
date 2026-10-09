import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  BookOpen, 
  Calendar, 
  CheckSquare, 
  Clock, 
  LogOut, 
  Send, 
  Sparkles, 
  Users, 
  UtensilsCrossed, 
  BookCheck, 
  ChevronLeft, 
  LayoutDashboard,
  ShieldCheck,
  Wallet,
  BrainCircuit,
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

      // Match student record
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
    <div className="min-h-screen bg-slate-900/5 pb-24 font-vazir text-right text-slate-800 relative selection:bg-indigo-500 selection:text-white" dir="rtl">
      {/* 1. Ultra-Compact Sleek Welcome Header (بدون کارت‌های ریز، فوق‌العاده جمع‌وجور جهت دید مستقیم ۴ کارت بدون اسکرول) */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-b-2xl shadow-lg shadow-indigo-950/20 border-b border-indigo-500/20">
        {/* Subtle Ambient Glow */}
        <div className="absolute -top-6 -right-6 w-24 h-24 bg-indigo-500/20 rounded-full blur-xl pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-teal-500/20 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between gap-2">
          {/* User Info (Avatar + Name + Compact Badge) */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm text-white shadow-xs shrink-0 border border-white/30 relative overflow-hidden",
              isRepresentative 
                ? "bg-gradient-to-tr from-emerald-600 to-teal-500 ring-1 ring-emerald-400/40" 
                : "bg-gradient-to-tr from-indigo-600 to-purple-600 ring-1 ring-indigo-400/40"
            )}>
              <span className="relative z-10">{displayName[0] || 'ط'}</span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-xs sm:text-sm font-black text-white truncate drop-shadow-xs">
                  {displayName}
                </h1>
                <span className={cn(
                  "text-[8.5px] font-black px-1.5 py-0.2 rounded border shadow-2xs",
                  isRepresentative 
                    ? "bg-emerald-500/30 text-emerald-200 border-emerald-400/40"
                    : "bg-indigo-500/30 text-indigo-200 border-indigo-400/40"
                )}>
                  {isRepresentative ? 'نماینده کلاس' : `${currentUser?.gradeLabel || 'سطح ۳'}`}
                </span>
              </div>
              <div className="text-[9.5px] text-slate-300 font-medium truncate">
                {todayDayName} {todayShamsi}
              </div>
            </div>
          </div>

          {/* Action Buttons (Desktop Toggle + Logout) */}
          <div className="flex items-center gap-1 shrink-0">
            {onSwitchToDesktopView && (
              <button
                type="button"
                onClick={onSwitchToDesktopView}
                className="px-2 py-0.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[9.5px] font-black transition-all border border-white/20 active:scale-95 shadow-2xs cursor-pointer"
                title="مشاهده نسخه کامل دسکتاپ"
              >
                نمای لپ‌تاپ
              </button>
            )}
            <button
              type="button"
              onClick={logout}
              className="p-1 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 rounded-lg transition-all border border-rose-500/30 cursor-pointer active:scale-95"
              title="خروج از حساب"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </div>

      <div className="p-2.5 sm:p-3.5 space-y-2.5">
        {/* 2. Sleek Attendance Banner (۱۵٪ تا ۲۰٪ کوچک‌تر و فشرده‌تر شده جهت دسترسی فوری به ۴ کارت اصلی بدون نیاز به اسکرول) */}
        {isRepresentative ? (
          <div 
            onClick={() => onNavigateTab('attendance')}
            className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-sm border border-emerald-400/40 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all group relative overflow-hidden"
          >
            <div className="space-y-0.5 relative z-10 min-w-0 pr-0.5">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-white/20 text-[8.5px] font-black border border-white/20">
                  <Sparkles size={8} className="text-amber-300 animate-spin" />
                  <span>نماینده کلاس</span>
                </span>
                <h3 className="text-xs sm:text-sm font-black text-white truncate">
                  ثبت سریع حضور و غیاب: «{myRepProgramTitle || 'کلاس درس'}»
                </h3>
              </div>
              <p className="text-[9.5px] text-emerald-100 font-medium truncate">
                ثبت حاضر/غایب کلیه اعضای کلاس با ۱ لمس مستقیم
              </p>
            </div>
            <div className="w-7 h-7 rounded-lg bg-white text-emerald-800 flex items-center justify-center font-black shadow-xs shrink-0 group-hover:scale-105 transition-transform border border-emerald-100 relative z-10">
              <CheckSquare size={15} />
            </div>
          </div>
        ) : (
          <div 
            onClick={() => onNavigateTab('attendance')}
            className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white shadow-xs border border-indigo-500/25 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all group relative overflow-hidden -mt-0.5"
          >
            <div className="space-y-0.5 relative z-10 min-w-0 pr-0.5">
              <h3 className="text-xs sm:text-sm font-black text-white truncate flex items-center gap-1.5">
                <CheckSquare size={14} className="text-emerald-400" />
                <span>کارنامه حضور و غیاب من</span>
              </h3>
              <p className="text-[9.5px] text-indigo-200/80 font-medium truncate">
                مشاهده وضعیت دقیق حضور، تاخیرها، غیبت‌ها و جلسات دروس
              </p>
            </div>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/10 text-amber-300 flex items-center justify-center font-black shadow-xs shrink-0 group-hover:scale-105 transition-transform border border-white/20 relative z-10">
              <CheckSquare size={14} />
            </div>
          </div>
        )}

        {/* 3. FOUR CORE VIBRANT COLORFUL CARDS (۴ کارت رنگی خوشگل اصلی با موج ملایم تغییر رنگ در طی یک دقیقه) */}
        <div>
          <div className="flex items-center justify-between px-1 mb-1.5">
            <h2 className="text-[11px] sm:text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Sparkles size={12} className="text-indigo-600" />
              <span>سامانه‌های اصلی و پرکاربرد طلاب</span>
            </h2>
            <span className="text-[8.5px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.2 rounded-full border border-indigo-200/50">
              دسترسی مستقیم
            </span>
          </div>

          {/* 
            Grid of 4 Core Cards in RTL:
            Row 1: [Top-Right: کارنامه علمی] | [Top-Left: ثبت تقاضا و درخواست]
            Row 2: [Bottom-Right: ساعت مطالعه من] | [Bottom-Left: رزرو نهار و شام]
            With continuous smooth radiant wave animation shifting color gently over ~55s!
          */}
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            {/* Card 1 (بالا سمت راست): کارنامه علمی */}
            <div
              onClick={() => onNavigateTab('student-portal')}
              className="relative overflow-hidden rounded-xl sm:rounded-2xl p-3 sm:p-3.5 text-white shadow-md shadow-indigo-950/25 border border-indigo-400/30 cursor-pointer active:scale-95 transition-all duration-300 group flex flex-col justify-between min-h-[96px] sm:min-h-[106px] animate-card-glow-1"
            >
              <div className="absolute -top-6 -right-6 w-14 h-14 bg-indigo-500/10 rounded-full blur-md pointer-events-none" />
              <div className="flex items-center justify-between relative z-10">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 backdrop-blur-md flex items-center justify-center font-black shadow-2xs border border-amber-400/30 group-hover:scale-105 transition-transform">
                  <BrainCircuit size={17} />
                </div>
                <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/30 backdrop-blur-xs">
                  سوابق علمی
                </span>
              </div>
              <div className="relative z-10 space-y-0.5 pt-1">
                <h3 className="text-xs sm:text-sm font-black text-white truncate">کارنامه علمی</h3>
                <p className="text-[8.5px] text-indigo-100/90 font-medium truncate">پرونده و نمرات تحصیلی</p>
              </div>
            </div>

            {/* Card 2 (بالا سمت چپ): پنل ثبت درخواست */}
            <div
              onClick={() => onNavigateTab('student-requests')}
              className="relative overflow-hidden rounded-xl sm:rounded-2xl p-3 sm:p-3.5 text-white shadow-md shadow-slate-950/25 border border-indigo-400/30 cursor-pointer active:scale-95 transition-all duration-300 group flex flex-col justify-between min-h-[96px] sm:min-h-[106px] animate-card-glow-2"
            >
              <div className="absolute -top-6 -right-6 w-14 h-14 bg-indigo-500/10 rounded-full blur-md pointer-events-none" />
              <div className="flex items-center justify-between relative z-10">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-200 backdrop-blur-md flex items-center justify-center font-black shadow-2xs border border-indigo-400/30 group-hover:scale-105 transition-transform">
                  <Send size={16} />
                </div>
                {myRequestsCount > 0 ? (
                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-400 text-indigo-950 shadow-2xs">
                    {myRequestsCount} جاری
                  </span>
                ) : (
                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 backdrop-blur-xs">
                    کارتابل
                  </span>
                )}
              </div>
              <div className="relative z-10 space-y-0.5 pt-1">
                <h3 className="text-xs sm:text-sm font-black text-white truncate">ثبت تقاضا و درخواست</h3>
                <p className="text-[8.5px] text-indigo-100/90 font-medium truncate">مرخصی، گواهی و رفاهی</p>
              </div>
            </div>

            {/* Card 3 (پایین سمت راست): ساعت مطالعه من */}
            <div
              onClick={() => onNavigateTab('stats')}
              className="relative overflow-hidden rounded-xl sm:rounded-2xl p-3 sm:p-3.5 text-white shadow-md shadow-slate-900/25 border border-amber-400/30 cursor-pointer active:scale-95 transition-all duration-300 group flex flex-col justify-between min-h-[96px] sm:min-h-[106px] animate-card-glow-3"
            >
              <div className="absolute -top-6 -right-6 w-14 h-14 bg-amber-500/10 rounded-full blur-md pointer-events-none" />
              <div className="flex items-center justify-between relative z-10">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 backdrop-blur-md flex items-center justify-center font-black shadow-2xs border border-amber-400/30 group-hover:scale-105 transition-transform">
                  <BookOpen size={17} />
                </div>
                <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/30 backdrop-blur-xs">
                  مباحثه و مطالعه
                </span>
              </div>
              <div className="relative z-10 space-y-0.5 pt-1">
                <h3 className="text-xs sm:text-sm font-black text-white truncate">ساعت مطالعه من</h3>
                <p className="text-[8.5px] text-indigo-100/90 font-medium truncate">ثبت کارکرد و گزارش ساعات</p>
              </div>
            </div>

            {/* Card 4 (پایین سمت چپ): رزرو نهار و شام */}
            <div
              onClick={() => onNavigateTab('student-meals')}
              className="relative overflow-hidden rounded-xl sm:rounded-2xl p-3 sm:p-3.5 text-white shadow-md shadow-indigo-950/25 border border-amber-400/30 cursor-pointer active:scale-95 transition-all duration-300 group flex flex-col justify-between min-h-[96px] sm:min-h-[106px] animate-card-glow-4"
            >
              <div className="absolute -top-6 -right-6 w-14 h-14 bg-amber-500/10 rounded-full blur-md pointer-events-none" />
              <div className="flex items-center justify-between relative z-10">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 backdrop-blur-md flex items-center justify-center font-black shadow-2xs border border-amber-400/30 group-hover:scale-105 transition-transform">
                  <UtensilsCrossed size={17} />
                </div>
                <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/30 backdrop-blur-xs">
                  سلف غذا
                </span>
              </div>
              <div className="relative z-10 space-y-0.5 pt-1">
                <h3 className="text-xs sm:text-sm font-black text-white truncate">رزرو نهار و شام</h3>
                <p className="text-[8.5px] text-amber-100/90 font-medium truncate">سفارش و وعده‌های سلف</p>
              </div>
            </div>
          </div>
        </div>

        {/* 4. TODAY'S CLASSES TIMELINE (برنامه کلاس‌های امروز) */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                <Clock size={15} />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-800">کلاس‌های امروز شما ({todayDayName})</h3>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('student-schedule')}
              className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 bg-indigo-50 px-2 py-0.5 rounded-lg cursor-pointer"
            >
              <span>برنامه کامل</span>
              <ChevronLeft size={12} />
            </button>
          </div>

          {todayPrograms.length === 0 ? (
            <div className="text-center py-4 text-slate-400 text-xs italic">
              امروز هیچ کلاسی در تقویم هفتگی شما ثبت نشده است.
            </div>
          ) : (
            <div className="space-y-2">
              {todayPrograms.map(p => (
                <div 
                  key={p.id}
                  className="p-2.5 sm:p-3 bg-slate-50/70 hover:bg-indigo-50/50 rounded-xl border border-slate-200/80 transition-all flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-slate-900 truncate">{p.title}</span>
                      {p.subjectBook && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 font-bold">
                          {p.subjectBook}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                      <span>استاد: {p.teacher || 'تعیین نشده'}</span>
                      {p.madrasRoom && (
                        <>
                          <span>•</span>
                          <span className="text-indigo-700 font-bold">مَدرَس {p.madrasRoom}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-left shrink-0">
                    <span className="text-[10px] font-mono font-black text-indigo-700 bg-white px-2 py-0.5 rounded-lg border border-indigo-200 shadow-2xs">
                      {p.time || 'نامشخص'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5. SECONDARY FEATURES TILES (امور مالی، برنامه هفتگی، مباحثه و انتخاب واحد) */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <h2 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <CalendarDays size={13} className="text-indigo-600" />
              <span>امور آموزشی و تکمیلی طلاب</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* امور مالی و پرداختی‌ها (انتقال‌یافته به بخش تکمیلی) */}
            <div 
              onClick={() => onNavigateTab('student-payments')}
              className="p-3 bg-white hover:bg-teal-50/40 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer active:scale-95 space-y-1.5 group"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-600 text-white flex items-center justify-center font-bold shadow-xs group-hover:scale-105 transition-transform">
                <Wallet size={16} />
              </div>
              <div>
                <div className="text-xs font-black text-slate-900">پرداختی‌ها و مالی</div>
                <div className="text-[9px] text-slate-400 font-medium truncate">شهریه و وضعیت حساب</div>
              </div>
            </div>

            {/* برنامه کلاسی هفتگی */}
            <div 
              onClick={() => onNavigateTab('student-schedule')}
              className="p-3 bg-white hover:bg-sky-50/40 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer active:scale-95 space-y-1.5 group"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center font-bold shadow-xs group-hover:scale-105 transition-transform">
                <Calendar size={16} />
              </div>
              <div>
                <div className="text-xs font-black text-slate-900">برنامه کلاسی هفتگی</div>
                <div className="text-[9px] text-slate-400 font-medium truncate">ساعات دروس و اساتید</div>
              </div>
            </div>

            {/* گروه‌های مباحثه */}
            <div 
              onClick={() => onNavigateTab('discussion')}
              className="p-3 bg-white hover:bg-purple-50/40 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer active:scale-95 space-y-1.5 group"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-700 text-white flex items-center justify-center font-bold shadow-xs group-hover:scale-105 transition-transform">
                <Users size={16} />
              </div>
              <div>
                <div className="text-xs font-black text-slate-900">گروه مباحثه من</div>
                <div className="text-[9px] text-slate-400 font-medium truncate">هم‌بحثی‌ها و پایش درس</div>
              </div>
            </div>

            {/* انتخاب واحد */}
            <div 
              onClick={() => onNavigateTab('course-selection')}
              className="p-3 bg-white hover:bg-teal-50/40 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer active:scale-95 space-y-1.5 group"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-600 text-white flex items-center justify-center font-bold shadow-xs group-hover:scale-105 transition-transform">
                <BookCheck size={16} />
              </div>
              <div>
                <div className="text-xs font-black text-slate-900">انتخاب واحد</div>
                <div className="text-[9px] text-slate-400 font-medium truncate">واحدهای آموزشی دوره</div>
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
          className="flex flex-col items-center gap-0.5 text-indigo-600 cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shadow-xs">
            <LayoutDashboard size={15} />
          </div>
          <span className="text-[9px] font-black">پیشخوان</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('student-schedule')}
          className="flex flex-col items-center gap-0.5 text-slate-600 hover:text-indigo-600 cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
            <Calendar size={15} />
          </div>
          <span className="text-[9px] font-bold">کلاس‌ها</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('attendance')}
          className="flex flex-col items-center gap-0.5 text-slate-600 hover:text-indigo-600 cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
            <CheckSquare size={15} />
          </div>
          <span className="text-[9px] font-bold">{isRepresentative ? 'ثبت حضور' : 'حضور و غیاب'}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('student-requests')}
          className="flex flex-col items-center gap-0.5 text-slate-600 hover:text-indigo-600 cursor-pointer relative"
        >
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
            <Send size={15} />
          </div>
          <span className="text-[9px] font-bold">درخواست</span>
          {myRequestsCount > 0 && (
            <span className="absolute -top-1 right-2 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center">
              {myRequestsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('stats')}
          className="flex flex-col items-center gap-0.5 text-slate-600 hover:text-purple-600 cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
            <BookOpen size={15} />
          </div>
          <span className="text-[9px] font-bold">مطالعه</span>
        </button>
      </div>
    </div>
  );
};
