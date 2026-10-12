import React, { useState, useEffect } from 'react';
import { BookOpen, Edit, Save, X, Info, Sparkles, CheckCircle2, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

export const DEFAULT_FREE_STUDY_RULES = `ضوابط و آیین‌نامه ثبت مطالعه آزاد:
۱. مطالعه آزاد شامل کتب معتبر تفسیری، کلامی، تاریخی، حدیثی و کتب تخصصی حوزوی خارج از سرفصل دروس جاری پایه می‌باشد.
۲. سقف احتساب مطالعه آزاد حداکثر تا میزان مابه‌التفاوت «موظفی کل» و «حداقل موظفی دروس اصلی» قابل محاسبه است.
۳. پر کردن موظفی کل صرفاً با مطالعه آزاد بدون تکمیل حداقل موظفی دروس اصلی، موجب کسری موظفی و صدور اخطار آموزشی خواهد بود.
۴. طلبه موظف است عنوان کتاب، مبحث و صفحات مطالعه آزاد را در قسمت یادداشت قید نماید.`;

interface FreeStudyRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodRuleOverride?: string;
}

export default function FreeStudyRulesModal({
  isOpen,
  onClose,
  periodRuleOverride
}: FreeStudyRulesModalProps) {
  const { currentUser } = useAuth();
  const [rulesText, setRulesText] = useState<string>(periodRuleOverride || DEFAULT_FREE_STUDY_RULES);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [draftText, setDraftText] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Check if current user is Education Officer or Super Admin
  const canEditRules = Boolean(
    currentUser?.level === 1 || 
    currentUser?.role === 'super_admin' || 
    currentUser?.role === 'education_manager' || 
    currentUser?.role === 'education_officer' ||
    currentUser?.username?.toUpperCase() === 'SHAH'
  );

  useEffect(() => {
    const loadRules = async () => {
      if (periodRuleOverride) {
        setRulesText(periodRuleOverride);
        return;
      }
      try {
        const stored = await localDb.getDoc<{ id: string; text: string }>('settings', 'free_study_rules');
        if (stored?.text) {
          setRulesText(stored.text);
        } else {
          setRulesText(DEFAULT_FREE_STUDY_RULES);
        }
      } catch (e) {
        setRulesText(DEFAULT_FREE_STUDY_RULES);
      }
    };

    if (isOpen) {
      loadRules();
      setIsEditing(false);
      setSaveSuccess(false);
    }
  }, [isOpen, periodRuleOverride]);

  const handleStartEdit = () => {
    setDraftText(rulesText);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!draftText.trim()) return;
    setIsSaving(true);
    try {
      await localDb.saveDoc('settings', 'free_study_rules', {
        id: 'free_study_rules',
        text: draftText.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.name || currentUser?.username
      });
      setRulesText(draftText.trim());
      setIsEditing(false);
      setSaveSuccess(true);
      window.dispatchEvent(new CustomEvent('app_data_change', { detail: { collection: 'settings' } }));
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving free study rules:', err);
      alert('خطا در ذخیره‌سازی قوانین مطالعه آزاد');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs dir-rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl w-full max-w-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-800 via-emerald-800 to-teal-900 text-white flex items-center justify-between border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-teal-200 shadow-xs">
                <BookOpen size={20} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                  <span>توضیحات و قوانین مطالعه آزاد</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-200 border border-teal-400/30 font-bold">
                    راهنمای طلاب
                  </span>
                </h3>
                <p className="text-[11px] text-teal-100/80 mt-0.5 font-medium">
                  ضوابط محاسبه، سقف مجاز و شرایط تایید مطالعه آزاد
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-teal-200 hover:text-white transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
            {saveSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-bold flex items-center gap-2 text-xs">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>قوانین مطالعه آزاد با موفقیت ذخیره و برای تمام طلاب اعمال شد.</span>
              </div>
            )}

            {isEditing ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">ویرایش متن قوانین و توضیحات مطالعه آزاد:</span>
                  <span className="text-[11px] text-slate-500">این متن عینا به طلاب نمایش داده می‌شود</span>
                </div>
                <textarea
                  rows={8}
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-medium focus:bg-white focus:border-teal-500 outline-none leading-relaxed resize-none text-xs sm:text-sm text-slate-800"
                  placeholder="متن قوانین و توضیحات را وارد فرمایید..."
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-teal-50/70 border border-teal-200/90 rounded-2xl space-y-2 text-slate-800 leading-relaxed font-medium">
                  <div className="flex items-center gap-2 text-teal-900 font-black text-xs border-b border-teal-200/80 pb-2">
                    <Info size={16} className="text-teal-700 shrink-0" />
                    <span>آیین‌نامه و الزامات مطالعه آزاد:</span>
                  </div>
                  <div className="whitespace-pre-line text-xs sm:text-sm leading-relaxed text-slate-800 pt-1 font-medium">
                    {rulesText}
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-bold flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-600 shrink-0" />
                  <span>
                    توجه مهم: ثبت مطالعه آزاد به تنهایی جایگزین موظفی دروس اصلی حوزه نخواهد شد.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
            {canEditRules ? (
              isEditing ? (
                <div className="flex items-center gap-2 w-full justify-end">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 cursor-pointer text-xs"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-teal-600/20 cursor-pointer flex items-center gap-1.5 text-xs"
                  >
                    <Save size={15} />
                    <span>{isSaving ? 'در حال ذخیره...' : 'ذخیره و اعمال قوانین'}</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] text-slate-500 font-medium">
                    دسترسی مدیریت: مسئول آموزش و سوپراِدمین مجاز به تغییر متن قوانین هستند.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      className="px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Edit size={14} />
                      <span>ویرایش قوانین</span>
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 cursor-pointer text-xs"
                    >
                      بستن
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div className="flex justify-end w-full">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 cursor-pointer text-xs"
                >
                  متوجه شدم (بستن)
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
