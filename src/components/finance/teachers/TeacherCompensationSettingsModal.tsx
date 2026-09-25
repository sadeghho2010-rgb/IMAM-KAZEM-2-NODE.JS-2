import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  X, 
  Check, 
  HelpCircle, 
  DollarSign, 
  Car, 
  UtensilsCrossed, 
  Receipt, 
  HeartHandshake, 
  Clock, 
  BookOpen, 
  CalendarDays, 
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { TeacherCompensationSettings, TeacherDebtCategory } from '../../../types';
import { cn } from '../../../lib/utils';

interface TeacherCompensationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TeacherCompensationSettings;
  onSave: (newSettings: TeacherCompensationSettings) => void;
}

export const TeacherCompensationSettingsModal: React.FC<TeacherCompensationSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave
}) => {
  const [formData, setFormData] = useState<TeacherCompensationSettings>(settings);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        ...settings,
        useUniformCourseRate: settings.useUniformCourseRate ?? true,
        mainCoursesHourlyRate: settings.mainCoursesHourlyRate ?? settings.hourlyTeachingRate,
        counselingCoursesHourlyRate: settings.counselingCoursesHourlyRate ?? settings.hourlyTeachingRate,
        thursdayCoursesHourlyRate: settings.thursdayCoursesHourlyRate ?? settings.hourlyTeachingRate,
        enableTransportCalculation: settings.enableTransportCalculation ?? true,
        transportCalculationMode: settings.transportCalculationMode ?? 'per_trip',
        transportCostPerTrip: settings.transportCostPerTrip ?? 150000,
        enableLunchCalculation: settings.enableLunchCalculation ?? true,
        lunchCostPerDay: settings.lunchCostPerDay ?? 45000,
        dinnerCostPerMeal: settings.dinnerCostPerMeal ?? 40000,
        enableDebtsCalculation: settings.enableDebtsCalculation ?? true,
        includedDebtCategories: settings.includedDebtCategories ?? ['installment', 'qard_loan', 'advance', 'cultural', 'other'],
        enableFundContributionCalculation: settings.enableFundContributionCalculation ?? true,
      });
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const toggleDebtCategory = (category: TeacherDebtCategory) => {
    const current = formData.includedDebtCategories || [];
    if (current.includes(category)) {
      setFormData({
        ...formData,
        includedDebtCategories: current.filter(c => c !== category)
      });
    } else {
      setFormData({
        ...formData,
        includedDebtCategories: [...current, category]
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-6 my-8 font-vazir text-right" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
              <Settings size={22} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">تنظیمات جامع محاسبه حق‌الزحمه اساتید</h3>
              <p className="text-xs text-slate-500 font-medium">پیکربندی نرخ‌های تدریس، سرویس، نهار، شمول بدهی‌ها و کمک به صندوق</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 text-xs">
          {/* SECTION 1: نرخ ساعت حضور و کارکرد دروس */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="text-teal-600" size={17} />
                <span className="font-black text-slate-800 text-sm">۱. نرخ پرداختی به ازای هر ساعت حضور</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">مبنای تدریس</span>
            </div>

            {/* نرخ پایه عمومی */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <label className="text-slate-700 font-bold">
                میزان پرداختی به ازای هر ساعت حضور (نرخ پیش‌فرض):
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1000"
                  required
                  value={formData.hourlyTeachingRate}
                  onChange={(e) => setFormData({ ...formData, hourlyTeachingRate: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-mono font-black text-slate-800 text-xs focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none text-left"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-sans pointer-events-none">تومان</span>
              </div>
            </div>

            {/* آیا هزینه کلاس‌های مشاوره و اصلی و دروس پنج‌شنبه به یک نرخ محاسبه شود؟ */}
            <div className="pt-2 border-t border-slate-200/60 space-y-2.5">
              <label className="text-slate-800 font-black block">
                آیا هزینه کلاس‌های مشاوره و اصلی و دروس پنج‌شنبه به یک نرخ محاسبه شود؟
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, useUniformCourseRate: true })}
                  className={cn(
                    "p-3 rounded-xl border text-right transition-all flex items-start gap-2.5 cursor-pointer",
                    formData.useUniformCourseRate
                      ? "bg-teal-50/80 border-teal-500 ring-2 ring-teal-500/20 text-teal-950 font-bold"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0",
                    formData.useUniformCourseRate ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300"
                  )}>
                    {formData.useUniformCourseRate && <Check size={10} />}
                  </div>
                  <div>
                    <div className="text-xs font-black">بله، همه دروس به نرخ یکسان</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">تمام ساعات به نرخ {formData.hourlyTeachingRate.toLocaleString('fa-IR')} تومان محاسبه شوند</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, useUniformCourseRate: false })}
                  className={cn(
                    "p-3 rounded-xl border text-right transition-all flex items-start gap-2.5 cursor-pointer",
                    !formData.useUniformCourseRate
                      ? "bg-amber-50/80 border-amber-500 ring-2 ring-amber-500/20 text-amber-950 font-bold"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0",
                    !formData.useUniformCourseRate ? "border-amber-600 bg-amber-600 text-white" : "border-slate-300"
                  )}>
                    {!formData.useUniformCourseRate && <Check size={10} />}
                  </div>
                  <div>
                    <div className="text-xs font-black">خیر، تفکیک نرخ بر اساس نوع کلاس</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">تعیین ۳ نرخ مجزا برای دروس اصلی، مشاوره و پنج‌شنبه</div>
                  </div>
                </button>
              </div>

              {/* سه باکس اختصاصی در صورت پاسخ منفی */}
              {!formData.useUniformCourseRate && (
                <div className="mt-3 p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200/80 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-600" />
                    <span>ثبت نرخ هر ساعت حضور در هر یک از این کلاس‌ها:</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* ۱. کلاس‌های اصلی */}
                    <div className="bg-white p-3 rounded-xl border border-amber-200 space-y-1.5 shadow-2xs">
                      <label className="text-[11px] font-black text-slate-800 flex items-center gap-1">
                        <BookOpen size={13} className="text-teal-600" />
                        <span>۱. کلاس‌های اصلی (فقه/اصول):</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={formData.mainCoursesHourlyRate ?? formData.hourlyTeachingRate}
                          onChange={(e) => setFormData({ ...formData, mainCoursesHourlyRate: Number(e.target.value) })}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-xs outline-none text-left"
                        />
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400">تومان</span>
                      </div>
                    </div>

                    {/* ۲. کلاس‌های مشاوره */}
                    <div className="bg-white p-3 rounded-xl border border-amber-200 space-y-1.5 shadow-2xs">
                      <label className="text-[11px] font-black text-slate-800 flex items-center gap-1">
                        <Sparkles size={13} className="text-indigo-600" />
                        <span>۲. کلاس‌های مشاوره:</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={formData.counselingCoursesHourlyRate ?? formData.hourlyTeachingRate}
                          onChange={(e) => setFormData({ ...formData, counselingCoursesHourlyRate: Number(e.target.value) })}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-xs outline-none text-left"
                        />
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400">تومان</span>
                      </div>
                    </div>

                    {/* ۳. دروس پنج‌شنبه */}
                    <div className="bg-white p-3 rounded-xl border border-amber-200 space-y-1.5 shadow-2xs">
                      <label className="text-[11px] font-black text-slate-800 flex items-center gap-1">
                        <CalendarDays size={13} className="text-amber-600" />
                        <span>۳. دروس پنج‌شنبه:</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={formData.thursdayCoursesHourlyRate ?? formData.hourlyTeachingRate}
                          onChange={(e) => setFormData({ ...formData, thursdayCoursesHourlyRate: Number(e.target.value) })}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-xs outline-none text-left"
                        />
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400">تومان</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: سرویس ایاب و ذهاب */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Car className="text-sky-600" size={17} />
                <span className="font-black text-slate-800 text-sm">۲. هزینه سرویس ایاب و ذهاب</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs">
                <span className={formData.enableTransportCalculation ? "text-sky-700" : "text-slate-400"}>
                  {formData.enableTransportCalculation ? 'حساب شود (فعال)' : 'حساب نشود (غیرفعال)'}
                </span>
                <input
                  type="checkbox"
                  checked={formData.enableTransportCalculation}
                  onChange={(e) => setFormData({ ...formData, enableTransportCalculation: e.target.checked })}
                  className="accent-sky-600 w-4 h-4 rounded cursor-pointer"
                />
              </label>
            </div>

            {formData.enableTransportCalculation && (
              <div className="pt-2 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-150">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">هزینه سرویس چقدر کسر شود؟ (نرخ هر نوبت):</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="5000"
                      value={formData.transportCostPerTrip}
                      onChange={(e) => setFormData({ ...formData, transportCostPerTrip: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-mono font-bold text-xs outline-none text-left"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-sans">تومان</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">نحوه محاسبه نوبت‌های تردد:</label>
                  <select
                    value={formData.transportCalculationMode}
                    onChange={(e) => setFormData({ ...formData, transportCalculationMode: e.target.value as any })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                  >
                    <option value="per_trip">هر رفت و برگشت جداگانه (۲ نوبت در روز)</option>
                    <option value="per_day">کل رفت و برگشت روز ۱ نوبت</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: هزینه نهار و شام */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="text-orange-600" size={17} />
                <span className="font-black text-slate-800 text-sm">۳. هزینه نهار و تغذیه</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs">
                <span className={formData.enableLunchCalculation ? "text-orange-700" : "text-slate-400"}>
                  {formData.enableLunchCalculation ? 'حساب شود (فعال)' : 'حساب نشود (غیرفعال)'}
                </span>
                <input
                  type="checkbox"
                  checked={formData.enableLunchCalculation}
                  onChange={(e) => setFormData({ ...formData, enableLunchCalculation: e.target.checked })}
                  className="accent-orange-600 w-4 h-4 rounded cursor-pointer"
                />
              </label>
            </div>

            {formData.enableLunchCalculation && (
              <div className="pt-2 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-150">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">هزینه هر وعده نهار چقدر حساب شود؟:</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={formData.lunchCostPerDay}
                      onChange={(e) => setFormData({ ...formData, lunchCostPerDay: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-mono font-bold text-xs outline-none text-left"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-sans">تومان</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">هزینه هر وعده شام (در صورت رزرو):</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={formData.dinnerCostPerMeal ?? 40000}
                      onChange={(e) => setFormData({ ...formData, dinnerCostPerMeal: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-mono font-bold text-xs outline-none text-left"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-sans">تومان</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: بدهی‌ها و مطالبات */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="text-amber-600" size={17} />
                <span className="font-black text-slate-800 text-sm">۴. کسر بدهی‌ها و اقساط</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs">
                <span className={formData.enableDebtsCalculation ? "text-amber-700" : "text-slate-400"}>
                  {formData.enableDebtsCalculation ? 'حساب شود (فعال)' : 'حساب نشود (غیرفعال)'}
                </span>
                <input
                  type="checkbox"
                  checked={formData.enableDebtsCalculation}
                  onChange={(e) => setFormData({ ...formData, enableDebtsCalculation: e.target.checked })}
                  className="accent-amber-600 w-4 h-4 rounded cursor-pointer"
                />
              </label>
            </div>

            {formData.enableDebtsCalculation && (
              <div className="pt-2 border-t border-slate-200/60 space-y-2 animate-in fade-in duration-150">
                <label className="text-[11px] font-black text-slate-800 block">
                  کدام بدهی‌ها در این دوره حساب شود؟:
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-3 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.includedDebtCategories?.includes('qard_loan')}
                      onChange={() => toggleDebtCategory('qard_loan')}
                      className="accent-amber-600 rounded"
                    />
                    <span>اقساط وام‌های قرض‌الحسنه و ضروری</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.includedDebtCategories?.includes('advance')}
                      onChange={() => toggleDebtCategory('advance')}
                      className="accent-amber-600 rounded"
                    />
                    <span>مساعده حقوق و پیش‌دریافت</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.includedDebtCategories?.includes('cultural')}
                      onChange={() => toggleDebtCategory('cultural')}
                      className="accent-amber-600 rounded"
                    />
                    <span>مطالبات عتبات، اردوها و امور فرهنگی</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.includedDebtCategories?.includes('other')}
                      onChange={() => toggleDebtCategory('other')}
                      className="accent-amber-600 rounded"
                    />
                    <span>سایر بدهی‌ها و مطالبات عمومی</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 5: کمک به صندوق */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartHandshake className="text-rose-600" size={17} />
                <span className="font-black text-slate-800 text-sm">۵. کسر کمک ماهانه به صندوق خیریه</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs">
                <span className={formData.enableFundContributionCalculation ? "text-rose-700" : "text-slate-400"}>
                  {formData.enableFundContributionCalculation ? 'حساب شود (فعال)' : 'حساب نشود (غیرفعال)'}
                </span>
                <input
                  type="checkbox"
                  checked={formData.enableFundContributionCalculation}
                  onChange={(e) => setFormData({ ...formData, enableFundContributionCalculation: e.target.checked })}
                  className="accent-rose-600 w-4 h-4 rounded cursor-pointer"
                />
              </label>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              در صورت فعال بودن، مبالغی که اساتید در فرم‌های تقاضای کمک به صندوق درخواست داده‌اند، به صورت خودکار از حقوق کسر و در ستون مربوطه و خروجی بالادستی اعمال می‌گردد.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black shadow-md shadow-teal-100 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Check size={16} />
              <span>ذخیره و اعمال تنظیمات</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
