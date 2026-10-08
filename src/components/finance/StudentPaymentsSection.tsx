import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Wallet, 
  CreditCard, 
  Coins, 
  Receipt, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  Sparkles, 
  ShieldCheck, 
  FileText, 
  AlertCircle, 
  Calendar, 
  Send,
  HelpCircle,
  TrendingUp,
  Download
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { getTodayShamsi } from '../../lib/jalali';

interface StudentPaymentsSectionProps {
  onNavigateTab?: (tab: string, studentId?: string) => void;
}

export const StudentPaymentsSection: React.FC<StudentPaymentsSectionProps> = ({ onNavigateTab }) => {
  const { currentUser } = useAuth();
  const todayShamsi = getTodayShamsi();
  const displayName = currentUser?.name || currentUser?.fullName || currentUser?.username || 'دانش‌پژوه محترم';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 font-vazir text-right text-slate-800" dir="rtl">
      {/* 1. Header Banner with Jewel Gradient */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-teal-900/20 border border-emerald-400/30">
        <div className="absolute top-0 left-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-10 w-60 h-60 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30 shadow-md">
              <Wallet size={30} className="text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 text-xs font-black border border-emerald-300/30">
                  امور مالی و رفاهی
                </span>
                <span className="text-xs text-emerald-100/80 font-medium">
                  {todayShamsi}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
                سامانه پرداختی‌ها و امور مالی طلاب
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/90 font-medium mt-1">
                مشاهده وضعیت حساب، شهریه، واریزی‌ها و تسهیلات — {displayName} ({currentUser?.gradeLabel || 'سطح ۳'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-center">
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('dashboard')}
                className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs transition-all flex items-center gap-2 border border-white/20 active:scale-95 cursor-pointer shadow-xs"
              >
                <ArrowRight size={16} />
                <span>بازگشت به پیشخوان</span>
              </button>
            )}
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('student-requests')}
                className="px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-black text-xs transition-all flex items-center gap-2 shadow-md active:scale-95 cursor-pointer"
              >
                <Send size={15} />
                <span>ثبت تقاضای مالی / وام</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: وضعیت تسویه */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">وضعیت تسویه مالی</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <ShieldCheck size={20} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg font-black text-emerald-700 flex items-center gap-1.5">
              <span>تسویه و فعال</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">بدون معوقه و مسدودی</p>
          </div>
        </div>

        {/* Card 2: سهم شهریه و کمک هزینه */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">کمک‌هزینه و شهریه دوره</span>
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
              <Coins size={20} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg font-black text-slate-900">
              طبق مصوبه آموزشی
            </div>
            <p className="text-[11px] text-teal-600 font-bold mt-1">بر اساس حضور و مباحثه</p>
          </div>
        </div>

        {/* Card 3: رزرو سلف و نهار */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">وضعیت سلف و تغذیه</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Receipt size={20} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg font-black text-slate-900">
              رزرو برخط فعال
            </div>
            {onNavigateTab ? (
              <button 
                type="button"
                onClick={() => onNavigateTab('student-meals')}
                className="text-[11px] text-amber-700 hover:text-amber-800 font-bold mt-1 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>ورود به سامانه غذا</span>
                <ArrowRight size={12} className="rotate-180" />
              </button>
            ) : (
              <p className="text-[11px] text-amber-600 font-bold mt-1">وعده‌های هفتگی</p>
            )}
          </div>
        </div>

        {/* Card 4: صندوق قرض‌الحسنه */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">صندوق وام و تسهیلات</span>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <CreditCard size={20} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg font-black text-indigo-700">
              امکان درخواست وام
            </div>
            <p className="text-[11px] text-slate-400 mt-1">از طریق کارتابل تقاضا</p>
          </div>
        </div>
      </div>

      {/* 3. Main Dedicated Content Container */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-6">
        {/* Notice of Ready Section for upcoming custom fields */}
        <div className="p-5 bg-gradient-to-br from-indigo-50 via-teal-50/50 to-emerald-50 rounded-2xl border border-indigo-200/70 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
            <Sparkles size={20} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-indigo-950">
              بخش پرداختی‌ها و امور مالی طلاب اضافه شد
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              این بخش به صورت اختصاصی جهت نمایش جزئیات واریزی‌ها، فیش‌های ماهانه، کسورات و تسهیلات طلاب تعبیه گردیده است. محتوای اختصاصی و فیلدهای مالی مدنظر شما پس از اعلام تکمیلی به صورت خودکار و دقیق در این صفحه نمایش داده خواهد شد.
            </p>
          </div>
        </div>

        {/* Transactions & Account Records Preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <FileText size={15} />
              </div>
              <h2 className="text-sm font-black text-slate-800">
                تاریخچه تراکنش‌ها و پرونده مالی
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-bold">
              سال تحصیلی جاری
            </span>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/40">
            <div className="p-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 text-slate-400 mx-auto flex items-center justify-center shadow-xs">
                <Receipt size={26} />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h4 className="text-sm font-black text-slate-800">
                  اطلاعات پرداختی‌های این دوره در حال بارگذاری است
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  فیش‌های حقوقی، واریزی‌های صندوق و رسیدهای پرداخت پس از تنظیمات واحد مالی در این جدول به تفکیک تاریخ، مبلغ و کد رهگیری منعکس می‌گردد.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('student-requests')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <Send size={13} />
                    <span>ثبت درخواست پیگیری مالی</span>
                  </button>
                )}
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('student-meals')}
                    className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-2xs active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <Coins size={13} className="text-amber-600" />
                    <span>مشاهده هزینه‌های سلف غذا</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
