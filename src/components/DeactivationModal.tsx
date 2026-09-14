import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserX, 
  GraduationCap, 
  ArrowRightLeft, 
  UserMinus, 
  XCircle, 
  AlertTriangle,
  Calendar,
  FileText
} from 'lucide-react';
import { Student, StudentDeactivationReason } from '../types';
import { getTodayShamsi } from '../lib/jalali';
import { cn } from '../lib/utils';

interface DeactivationModalProps {
  isOpen: boolean;
  student: Student | null;
  onClose: () => void;
  onConfirm: (reason: StudentDeactivationReason, date: string, notes?: string) => Promise<void> | void;
}

const REASONS: Array<{
  id: StudentDeactivationReason;
  title: string;
  desc: string;
  icon: typeof UserX;
  colorClass: string;
  badgeClass: string;
}> = [
  {
    id: 'صرفا غیر فعال',
    title: 'صرفاً غیرفعال (مرخصی تحصیلی / تعلیق موقت)',
    desc: 'طلبه در حال حاضر در مدرسه حضور ندارد ولی سوابق و وضعیت تحصیلی ایشان محفوظ است.',
    icon: UserX,
    colorClass: 'border-slate-300 hover:border-slate-500 hover:bg-slate-50/80',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300'
  },
  {
    id: 'فارغ التحصیل',
    title: 'فارغ‌التحصیل (اتمام دوره تحصیلی در مدرسه)',
    desc: 'دوره تحصیلی این طلبه در مدرسه با موفقیت به پایان رسیده و به عنوان طلبه سابق ثبت می‌گردد.',
    icon: GraduationCap,
    colorClass: 'border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/50',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300'
  },
  {
    id: 'انتقال اختیاری از مجموعه',
    title: 'انتقال اختیاری از مجموعه (مهاجرت / حوزه دیگر)',
    desc: 'طلبه بنا بر درخواست شخصی به مرکز، مدرسه علمیه یا دانشگاه دیگری انتقال یافته است.',
    icon: ArrowRightLeft,
    colorClass: 'border-amber-300 hover:border-amber-500 hover:bg-amber-50/50',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300'
  },
  {
    id: 'قطع همکاری از مجموعه',
    title: 'قطع همکاری از مجموعه (تصمیم آموزشی / انضباطی)',
    desc: 'ادامه تحصیل طلبه در این مدرسه علمیه به صلاحدید مسئولین متوقف گردیده است.',
    icon: UserMinus,
    colorClass: 'border-rose-300 hover:border-rose-500 hover:bg-rose-50/50',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300'
  }
];

export default function DeactivationModal({
  isOpen,
  student,
  onClose,
  onConfirm
}: DeactivationModalProps) {
  const [selectedReason, setSelectedReason] = useState<StudentDeactivationReason>('صرفا غیر فعال');
  const [deactivationDate, setDeactivationDate] = useState<string>(getTodayShamsi() || '1405/01/01');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !student) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onConfirm(selectedReason, deactivationDate, notes);
      onClose();
    } catch (err) {
      console.error('Error in deactivation:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 10 }}
          className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 relative overflow-hidden"
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 leading-snug">
                  تعیین وضعیت و علت خروج طلبه از طلاب حاضر
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  تغییر وضعیت طلبه <span className="font-bold text-slate-800">«{student.name}»</span> ({student.grade || 'پایه نامشخص'}) به غیرفعال
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <XCircle size={22} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Note alert */}
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 text-[11px] text-amber-900 leading-relaxed">
              <span className="font-bold">نکته مهم:</span> با غیرفعال شدن وضعیت، طلبه به عنوان «طلبه سابق» بایگانی می‌شود و <b>اجازه ورود به سامانه را نخواهد داشت</b>. تمامی سوابق تحصیلی، نمرات، حضور و غیاب و پرونده ایشان به طور کامل و دائم در بانک اطلاعات مدرسه محفوظ می‌ماند.
            </div>

            {/* Question prompt */}
            <div>
              <label className="block text-xs font-black text-slate-800 mb-2">
                وضعیت و علت غیرفعال بودن این طلبه کدام گزینه است؟
              </label>
              
              <div className="space-y-2">
                {REASONS.map((r) => {
                  const Icon = r.icon;
                  const isSelected = selectedReason === r.id;
                  return (
                    <label
                      key={r.id}
                      onClick={() => setSelectedReason(r.id)}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all",
                        isSelected
                          ? "border-indigo-600 bg-indigo-50/40 shadow-xs"
                          : r.colorClass
                      )}
                    >
                      <input
                        type="radio"
                        name="deactivationReason"
                        value={r.id}
                        checked={isSelected}
                        onChange={() => setSelectedReason(r.id)}
                        className="mt-1 w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Icon size={16} className={isSelected ? "text-indigo-600" : "text-slate-500"} />
                          <span className={cn("text-xs font-bold", isSelected ? "text-indigo-950" : "text-slate-800")}>
                            {r.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                          {r.desc}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Deactivation Date & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                  <Calendar size={13} className="text-slate-400" />
                  <span>تاریخ ثبت خروج / تغییر وضعیت</span>
                </label>
                <input
                  type="text"
                  value={deactivationDate}
                  onChange={(e) => setDeactivationDate(e.target.value)}
                  placeholder="1405/01/01"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                  <FileText size={13} className="text-slate-400" />
                  <span>توضیحات و شماره نامه (اختیاری)</span>
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: پرونده شماره ۱۲۴ یا شماره نامه انتقال"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-100 mt-5">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <UserX size={15} />
                <span>{isSubmitting ? 'در حال ثبت...' : 'تایید و تغییر وضعیت به غیرفعال'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
