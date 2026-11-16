import React, { useState, useEffect, useCallback } from 'react';
import {
  Wrench,
  ShieldCheck,
  Power,
  AlertTriangle,
  Clock,
  RefreshCw,
  CheckCircle2,
  X,
  Lock,
  Unlock,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import { dispatchDatabaseToast } from '../../lib/databaseToast';
import { MaintenanceConfig } from '../../types';

function canUserManageMaintenance(user: any): boolean {
  if (!user) return false;
  if (user.isReadOnly === true || user.canEdit === false) return false;
  const usernameUpper = String(user.username || '').toUpperCase().trim();
  const role = String(user.role || '').trim();
  const level = Number(user.level) || 0;

  if (role === 'school_manager' || role === 'manager_principal' || usernameUpper === 'RAHNAMA') {
    return false;
  }

  const isSuperAdmin =
    role === 'super_admin' ||
    usernameUpper === 'SADEGH' ||
    (level === 1 && role !== 'school_manager');

  const isEducationOfficer =
    role === 'education_manager' ||
    role === 'education_officer' ||
    usernameUpper === 'SHAH' ||
    usernameUpper === 'SHAHPOORI';

  return isSuperAdmin || isEducationOfficer;
}

function getAuthHeaders(includeJson = false): Record<string, string> {
  const token =
    localStorage.getItem('auth_token') ||
    sessionStorage.getItem('auth_token') ||
    localStorage.getItem('access_token') ||
    sessionStorage.getItem('access_token');
  const headers: Record<string, string> = {};
  if (includeJson) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export default function MaintenanceModeManagement() {
  const { currentUser } = useAuth();
  const isAuthorized = canUserManageMaintenance(currentUser);

  const [state, setState] = useState<MaintenanceConfig>({
    enabled: false,
    message: 'سامانه در حال بروزرسانی و نگهداری فنی می‌باشد. لطفاً دقایقی دیگر مراجعه فرمایید.',
    estimatedDuration: '۱۵ دقیقه',
    enabledAt: null,
    enabledBy: null,
    version: 1
  });
  const [messageInput, setMessageInput] = useState(
    'سامانه در حال بروزرسانی و نگهداری فنی می‌باشد. لطفاً دقایقی دیگر مراجعه فرمایید.'
  );
  const [durationInput, setDurationInput] = useState('۱۵ دقیقه');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const loadMaintenanceState = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/monitor/maintenance', {
        headers: getAuthHeaders(),
        credentials: 'include',
        cache: 'no-store'
      });
      const json = await res.json();
      if (res.ok && json?.success && json.state) {
        setState(json.state);
        if (json.state.message) setMessageInput(json.state.message);
        if (json.state.estimatedDuration) setDurationInput(json.state.estimatedDuration);
      } else {
        setErrorBanner(json?.message || 'عدم دسترسی یا خطا در دریافت وضعیت حالت تعمیر');
      }
    } catch (err: any) {
      console.error('[STORAGE_FAILURE][MaintenanceModeManagement.load]', err?.message || err);
      setErrorBanner(err?.message || 'خطا در ارتباط با سرور');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthorized) {
      loadMaintenanceState();
    } else {
      setLoading(false);
    }
  }, [isAuthorized, loadMaintenanceState]);

  const handleConfirmToggle = async () => {
    if (!isAuthorized || isSaving) return;
    const nextEnabled = !state.enabled;
    setIsSaving(true);
    setErrorBanner(null);

    try {
      const res = await fetch('/api/monitor/maintenance', {
        method: 'POST',
        headers: getAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify({
          enabled: nextEnabled,
          message: messageInput.trim() || 'سامانه در حال بروزرسانی و نگهداری فنی می‌باشد. لطفاً دقایقی دیگر مراجعه فرمایید.',
          estimatedDuration: durationInput.trim() || '۱۵ دقیقه'
        })
      });
      const json = await res.json();
      if (!res.ok || !json?.success || !json.state) {
        throw new Error(json?.message || 'خطا در ذخیره وضعیت حالت تعمیر');
      }

      // Read-After-Write: update UI strictly from authoritative server response
      setState(json.state);
      if (json.state.message) setMessageInput(json.state.message);
      if (json.state.estimatedDuration) setDurationInput(json.state.estimatedDuration);

      window.dispatchEvent(new CustomEvent('app_maintenance_updated', { detail: json.state }));
      console.log('[STORAGE_SUCCESS][maintenance_mode]', `enabled=${json.state.enabled}`, `v${json.state.version}`);

      dispatchDatabaseToast(
        nextEnabled
          ? 'حالت تعمیر سایت فعال شد؛ سایر کاربران تا زمان غیرفعال‌سازی از دسترسی خارج شدند.'
          : 'حالت تعمیر غیرفعال شد و دسترسی همه کاربران به سامانه بازگشایی گردید.',
        'success'
      );
      setConfirmModalOpen(false);
    } catch (err: any) {
      console.error('[STORAGE_FAILURE][MaintenanceModeManagement.toggle]', err?.message || err);
      const msg = err?.message || 'خطا در ثبت تغییرات حالت تعمیر';
      setErrorBanner(msg);
      dispatchDatabaseToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="bg-white rounded-3xl border border-rose-200 p-8 text-center space-y-3 font-vazir shadow-xs" dir="rtl">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
          <Lock size={28} />
        </div>
        <h2 className="text-base font-black text-slate-900">عدم دسترسی به تنظیمات حالت تعمیر</h2>
        <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
          این بخش حساس منحصراً در اختیار <strong>مسئول آموزش</strong> و <strong>سوپر ادمین</strong> است.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 font-vazir text-right" dir="rtl">
      {/* Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div
            className={cn(
              'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-xs',
              state.enabled
                ? 'bg-amber-100 text-amber-700 border-amber-300'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
            )}
          >
            <Wrench size={24} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900">حالت تعمیر و نگهداری سایت</h2>
              <span
                className={cn(
                  'px-2.5 py-0.5 rounded-full text-[11px] font-black border',
                  state.enabled
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                )}
              >
                {state.enabled ? 'حالت تعمیر فعال (سایت قفل است)' : 'وضعیت عادی (در دسترس همگان)'}
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              با فعال‌سازی حالت تعمیر، سامانه به صورت فوری از دسترس طلاب، اساتید، مربیان و سایر نقش‌ها خارج می‌شود و تنها مسئول آموزش و سوپر ادمین داخل پنل باقی می‌مانند.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadMaintenanceState}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5 self-start sm:self-center cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>بروزرسانی وضعیت</span>
        </button>
      </div>

      {errorBanner && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0 text-rose-600" />
            <span>{errorBanner}</span>
          </div>
          <button type="button" onClick={() => setErrorBanner(null)} className="text-rose-500 hover:text-rose-800 cursor-pointer">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Main Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form & Toggle Panel */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Power size={17} className={state.enabled ? 'text-amber-600' : 'text-indigo-600'} />
              <span>تنظیمات پیام و کنترل دسترسی</span>
            </h3>
            {typeof state.version === 'number' && (
              <span className="text-[10.5px] font-mono font-bold text-slate-400 tabular-nums">
                نسخه تنظیمات: v{state.version}
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                متن پیام نمایشی به کاربران هنگام قفل بودن سایت
              </label>
              <textarea
                rows={3}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="پیام محترمانه برای نمایش در زمان تعمیر سایت..."
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/70 focus:bg-white text-slate-800 font-medium leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                مدت زمان تقریبی بروزرسانی (اختیاری)
              </label>
              <div className="relative">
                <Clock size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={durationInput}
                  onChange={(e) => setDurationInput(e.target.value)}
                  placeholder="مثلاً: ۱۵ دقیقه"
                  className="w-full pr-10 pl-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/70 focus:bg-white text-slate-800 font-bold"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-100">
            <div className="text-[11px] text-slate-500 font-medium">
              {state.enabled && state.enabledAt ? (
                <span className="tabular-nums">
                  فعال‌شده توسط <strong className="text-slate-800">{state.enabledBy || 'مدیر'}</strong> در{' '}
                  {new Date(state.enabledAt).toLocaleString('fa-IR')}
                </span>
              ) : (
                <span>در حال حاضر همه کاربران طبق سطح دسترسی عادی وارد سامانه می‌شوند.</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setConfirmModalOpen(true)}
              disabled={isSaving || loading}
              className={cn(
                'px-5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50 shrink-0',
                state.enabled
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              )}
            >
              {state.enabled ? <Unlock size={16} /> : <Lock size={16} />}
              <span>{state.enabled ? 'غیرفعال‌سازی حالت تعمیر و بازگشایی سایت' : 'فعال‌سازی حالت تعمیر (بستن سایت)'}</span>
            </button>
          </div>
        </div>

        {/* Access Summary Sidebar Card */}
        <div className="bg-slate-50/90 rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-4">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <ShieldCheck size={17} className="text-indigo-600" />
            <span>قواعد دسترسی در حالت تعمیر</span>
          </h3>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
              <div className="font-black flex items-center gap-1.5">
                <UserCheck size={14} className="text-emerald-700" />
                <span>افراد مجاز (داخل سامانه باقی می‌مانند):</span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                مسئول آموزش و سوپر ادمین به صورت کامل به تمامی بخش‌ها دسترسی خواهند داشت.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-1">
              <div className="font-black flex items-center gap-1.5">
                <Lock size={14} className="text-amber-700" />
                <span>سایر کاربران (خروج موقت از دسترس):</span>
              </div>
              <p className="text-[11px] text-amber-900 leading-relaxed">
                کلیه طلاب، اساتید، مربیان پایه، پژوهش، مالی و ناظرین تا لحظه بازگشایی صفحه قفل تعمیر و نگهداری را مشاهده می‌کنند و درخواست‌های سیستمی آن‌ها مسدود می‌شود.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white border border-slate-200 text-slate-600 text-[11px] leading-relaxed">
              تغییر وضعیت در پایگاه داده مرکزی ثبت می‌شود و در کمتر از چند ثانیه برای تمامی دستگاه‌های متصل اعمال خواهد شد.
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isSaving && setConfirmModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 font-vazir text-right"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border',
                  state.enabled
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                )}
              >
                {state.enabled ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-slate-900">
                  {state.enabled ? 'تایید بازگشایی عمومی سامانه' : 'تایید فعال‌سازی حالت تعمیر'}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {state.enabled
                    ? 'آیا اطمینان دارید که حالت تعمیر غیرفعال شده و همه کاربران دوباره به سامانه دسترسی پیدا کنند؟'
                    : 'با تایید این مورد، دسترسی تمامی کاربران به جز مسئول آموزش و سوپر ادمین بلافاصله مسدود می‌شود.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleConfirmToggle}
                className={cn(
                  'px-4 py-2 rounded-xl text-white text-xs font-black cursor-pointer disabled:opacity-50 flex items-center gap-1.5',
                  state.enabled ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
                )}
              >
                <span>{isSaving ? 'در حال ثبت...' : state.enabled ? 'بله، سایت بازگشایی شود' : 'بله، حالت تعمیر فعال شود'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
