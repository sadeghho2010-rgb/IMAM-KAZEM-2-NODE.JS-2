import React, { useRef } from 'react';
import { 
  Printer, 
  X, 
  CheckCircle2, 
  Building2, 
  Calendar, 
  CreditCard, 
  Clock, 
  UtensilsCrossed, 
  Car, 
  Receipt, 
  HeartHandshake, 
  TrendingUp, 
  BookOpen 
} from 'lucide-react';
import { TeacherCompensationCalculationItem, TeacherCompensationSettings } from '../../../types';
import { cn } from '../../../lib/utils';
import { useIsAdminMobile } from '../../admin/mobile/AdminMobileContext';

interface TeacherCompensationSlipModalProps {
  item: TeacherCompensationCalculationItem | null;
  periodTitle: string;
  startDate: string;
  endDate: string;
  settings: TeacherCompensationSettings;
  onClose: () => void;
}

export const TeacherCompensationSlipModal: React.FC<TeacherCompensationSlipModalProps> = ({
  item,
  periodTitle,
  startDate,
  endDate,
  settings,
  onClose
}) => {
  const isAdminMobile = useIsAdminMobile();
  const printRef = useRef<HTMLDivElement>(null);

  if (!item) return null;

  const handlePrint = () => {
    window.print();
  };

  const debtDed = item.debtMonthlyDeduction ?? item.type2DeductionsTotal ?? 0;
  const fundDed = item.fundContributionDeduction ?? 0;
  const transportDed = item.transportDeduction ?? 0;
  const mealDed = item.mealsDeductionTotal ?? item.lunchDeduction ?? 0;
  const totalDeductions = debtDed + fundDed + transportDed + mealDed + (item.type1Deductions || 0);

  return (
    <div className={cn('fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center overflow-y-auto', isAdminMobile ? 'p-3' : 'p-4')}>
      <div className={cn('bg-white max-w-2xl w-full shadow-2xl border border-slate-100 space-y-6 my-8 max-h-[90vh] overflow-y-auto', isAdminMobile ? 'rounded-2xl p-4' : 'rounded-3xl p-6')}>
        {/* Header Actions */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Receipt className="text-teal-600" size={20} />
            <h3 className="text-sm font-black text-slate-900">فیش تفصیلی حق‌الزحمه تدریس استاد</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer size={15} />
              <span>چاپ فیش</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Slip Sheet */}
        <div ref={printRef} className={cn('bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-5 text-right font-vazir', isAdminMobile ? 'p-3.5' : 'p-6')} dir="rtl">
          {/* Slip Header */}
          <div className={cn('flex justify-between pb-4 border-b border-slate-200 gap-2', isAdminMobile ? 'flex-col items-start' : 'items-center')}>
            <div className="space-y-1">
              <h2 className="text-base font-black text-slate-900">حوزه علمیه و مرکز تخصصی آموزش عالی</h2>
              <p className="text-xs text-slate-500 font-bold">معاونت امور مالی و اداری - فیش تسویه حق‌الزحمه اساتید</p>
            </div>
            <div className={cn('text-xs space-y-1 font-mono text-slate-600', isAdminMobile ? 'text-right' : 'text-left')}>
              <div>دوره: <strong className="text-slate-800 font-sans">{periodTitle}</strong></div>
              <div>بازه: <strong>{startDate}</strong> الی <strong>{endDate}</strong></div>
            </div>
          </div>

          {/* Professor Identification Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-slate-200/60 text-xs">
            <div>
              <span className="text-slate-400 text-[10px] block">نام و نام خانوادگی:</span>
              <strong className="text-slate-900 font-bold">{item.teacherName}</strong>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">کد ملی / پرسنلی:</span>
              <strong className="font-mono text-slate-800">{item.nationalId || '-'}</strong>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">شماره تماس:</span>
              <strong className="font-mono text-slate-800">{item.phone || '-'}</strong>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">دروس تدریسی:</span>
              <span className="text-slate-700 font-bold truncate block">{item.coursesStr || 'دروس فقه و اصول'}</span>
            </div>
          </div>

          {/* Table of Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Column 1: استحقاقی‌ها و ساعات حضور */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100 text-teal-800 font-bold text-xs">
                <Clock size={15} />
                <span>کارکرد و ساعات حضور تقویمی</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">جلسات مقرر تقویم درسی:</span>
                  <span className="font-mono font-bold">{item.calendarScheduledClassesCount ?? item.totalCalendarDays ?? 0} جلسه</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">جلسات تعطیل شده:</span>
                  <span className="font-mono font-bold text-rose-600">{item.cancelledDaysCount ?? 0} جلسه</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">جلسات استاد جایگزین:</span>
                  <span className="font-mono font-bold text-indigo-600">{item.substituteTeachingSessions ?? 0} جلسه</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">ساعت اضافه تدریس:</span>
                  <span className="font-mono font-bold text-emerald-600">+{item.overtimeHours ?? 0} ساعت</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 font-bold">
                  <span className="text-slate-700">مجموع ساعات تدریس:</span>
                  <span className="font-mono text-teal-900">{item.totalTeachingHours} ساعت</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">نرخ مصوب ساعتی:</span>
                  <span className="font-mono">{item.hourlyRate?.toLocaleString('fa-IR')} تومان</span>
                </div>
                <div className="flex justify-between pt-1 font-black text-emerald-700 text-sm">
                  <span>ناخالص استحقاقی:</span>
                  <span className="font-mono">{item.baseGrossAmount?.toLocaleString('fa-IR')} تومان</span>
                </div>

                {item.courseBreakdown && item.courseBreakdown.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <span className="text-[10px] text-teal-800 font-bold block">تفکیک کارکرد دروس:</span>
                    {item.courseBreakdown.map((cb, idx) => (
                      <div key={cb.id || idx} className="flex justify-between text-[11px] py-0.5 text-slate-600">
                        <span>• {cb.courseTitle} ({cb.courseType === 'counseling' ? 'مشاوره' : cb.courseType === 'thursday' ? 'پنج‌شنبه' : 'اصلی'}):</span>
                        <span className="font-mono">{cb.teachingHours} س ({cb.grossAmount?.toLocaleString('fa-IR')} ت)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: کسورات دوره */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100 text-rose-800 font-bold text-xs">
                <Receipt size={15} />
                <span>کسورات قانونی و تعهدات ماهانه</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">کسر اقساط / بدهی:</span>
                  <span className="font-mono font-bold text-amber-700">-{debtDed.toLocaleString('fa-IR')} تومان</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">کمک به صندوق خیریه:</span>
                  <span className="font-mono font-bold text-rose-600">-{fundDed.toLocaleString('fa-IR')} تومان</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">هزینه سرویس ایاب و ذهاب ({item.transportTripsCount || 0} نوبت):</span>
                  <span className="font-mono font-bold text-sky-700">-{transportDed.toLocaleString('fa-IR')} تومان</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">هزینه نهار و شام ({(item.lunchCount || 0) + (item.dinnerCount || 0)} وعده):</span>
                  <span className="font-mono font-bold text-orange-700">-{mealDed.toLocaleString('fa-IR')} تومان</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">تعدیلات دستی (+/-):</span>
                  <span className="font-mono font-bold text-purple-700">
                    {(item.manualAdjustmentAmount || 0) > 0 ? `+${item.manualAdjustmentAmount?.toLocaleString('fa-IR')}` : (item.manualAdjustmentAmount || 0).toLocaleString('fa-IR')} تومان
                  </span>
                </div>
                <div className="flex justify-between pt-1 font-black text-rose-700 text-sm">
                  <span>مجموع کسورات:</span>
                  <span className="font-mono">-{totalDeductions.toLocaleString('fa-IR')} تومان</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Payable Ribbon */}
          <div className={cn('bg-gradient-to-r from-teal-700 to-emerald-700 p-4 rounded-xl text-white flex justify-between shadow-md gap-3', isAdminMobile ? 'flex-col items-start' : 'items-center')}>
            <div>
              <span className="text-xs text-teal-100 block font-medium">مبلغ خالص قابل پرداخت (واریز پایا به حساب استاد):</span>
              <span className="text-lg font-mono font-black tabular-nums">{item.netPayable?.toLocaleString('fa-IR')} تومان</span>
            </div>
            <div className={cn('text-xs font-mono space-y-0.5', isAdminMobile ? 'text-right' : 'text-left')}>
              <div>بانک: {item.bankName || 'تجارت'}</div>
              <div>ش حساب: {item.bankAccount || '-'}</div>
              {item.bankSheba && <div className="break-all">شبا: {item.bankSheba}</div>}
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-4 pt-6 text-center text-xs text-slate-500">
            <div>امضای متصدی امور مالی</div>
            <div>امضای معاون اداری و مالی</div>
            <div>امضای استاد محترم</div>
          </div>
        </div>
      </div>
    </div>
  );
};
