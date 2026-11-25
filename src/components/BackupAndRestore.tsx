import React from 'react';
import { HardDrive, ShieldCheck } from 'lucide-react';

export default function BackupAndRestore() {
  return (
    <div
      className="min-h-[60vh] flex items-center justify-center p-4 sm:p-8 font-vazir"
      dir="rtl"
    >
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-lg p-8 sm:p-10 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-sm">
          <HardDrive size={30} />
        </div>

        <div className="space-y-3">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
            بخش پشتیبان‌گیری و بازیابی اطلاعات
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-8">
            این بخش در حال طراحی و بازنگری زیرساختی است و به‌زودی در دسترس قرار خواهد گرفت. فرآیند پشتیبان‌گیری خودکار سامانه در سرور بدون وقفه در حال انجام است.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
          <ShieldCheck size={16} className="shrink-0" />
          <span>پشتیبان‌گیری خودکار سرور فعال است</span>
        </div>
      </div>
    </div>
  );
}
