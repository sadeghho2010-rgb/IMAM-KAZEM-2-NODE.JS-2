import React, { useState, useEffect, useCallback } from 'react';
import { Wrench, RefreshCw, LogOut, Clock, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { MaintenanceConfig } from '../../types';

export function canUserBypassMaintenance(user: any): boolean {
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

export default function MaintenanceOverlayGate({ children }: { children: React.ReactNode }) {
  const { currentUser, logout } = useAuth();
  const [maintenanceState, setMaintenanceState] = useState<MaintenanceConfig>({
    enabled: false,
    message: 'سامانه در حال بروزرسانی و نگهداری فنی می‌باشد. لطفاً دقایقی دیگر مراجعه فرمایید.',
    estimatedDuration: '۱۵ دقیقه'
  });
  const [isChecking, setIsChecking] = useState(false);

  const checkStatus = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsChecking(true);
    try {
      const res = await fetch('/api/system/maintenance-status', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data && typeof data.enabled === 'boolean') {
        setMaintenanceState({
          enabled: Boolean(data.enabled),
          message: data.message || 'سامانه در حال بروزرسانی و نگهداری فنی می‌باشد. لطفاً دقایقی دیگر مراجعه فرمایید.',
          estimatedDuration: data.estimatedDuration || null,
          enabledAt: data.enabledAt || null,
          enabledBy: data.enabledBy || null,
          version: Number(data.version) || 1
        });
      }
    } catch (err: any) {
      console.error('[STORAGE_FAILURE][maintenance_gate_poll]', err?.message || err);
    } finally {
      if (showSpinner) setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkStatus(false);

    const interval = setInterval(() => {
      checkStatus(false);
    }, 4000);

    const handleMaintenanceEvent = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail && typeof detail.enabled === 'boolean') {
        setMaintenanceState(prev => ({ ...prev, ...detail }));
      } else {
        checkStatus(false);
      }
    };

    const handleSystemSettingsChange = () => checkStatus(false);
    const handleFocus = () => checkStatus(false);

    window.addEventListener('app_maintenance_updated', handleMaintenanceEvent);
    window.addEventListener('app_maintenance_active', handleMaintenanceEvent);
    window.addEventListener('collection_change_system_settings', handleSystemSettingsChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('app_maintenance_updated', handleMaintenanceEvent);
      window.removeEventListener('app_maintenance_active', handleMaintenanceEvent);
      window.removeEventListener('collection_change_system_settings', handleSystemSettingsChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkStatus]);

  const shouldLockUser =
    Boolean(maintenanceState.enabled) &&
    Boolean(currentUser) &&
    !canUserBypassMaintenance(currentUser);

  if (shouldLockUser) {
    return (
      <div
        className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 font-vazir text-right"
        dir="rtl"
      >
        <div className="max-w-lg w-full bg-white rounded-3xl border border-amber-200 shadow-2xl p-6 sm:p-8 space-y-5 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 text-amber-700 border border-amber-300 flex items-center justify-center shadow-sm">
            <Wrench size={32} />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-black">
              <ShieldAlert size={13} />
              <span>حالت تعمیر و نگهداری سایت فعال است</span>
            </span>
            <h1 className="text-lg sm:text-xl font-black text-slate-900">
              سامانه موقتاً در حال بروزرسانی است
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50 border border-slate-200 rounded-2xl p-4">
              {maintenanceState.message}
            </p>
          </div>

          {maintenanceState.estimatedDuration && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-bold tabular-nums">
              <Clock size={14} />
              <span>مدت زمان تقریبی: {maintenanceState.estimatedDuration}</span>
            </div>
          )}

          <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-3">
            حساب فعلی: <strong className="text-slate-700">{currentUser?.name || currentUser?.username}</strong> — در این وضعیت فقط مسئول آموزش و سوپر ادمین مجاز به استفاده از سامانه هستند.
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => checkStatus(true)}
              disabled={isChecking}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
            >
              <RefreshCw size={15} className={isChecking ? 'animate-spin' : ''} />
              <span>{isChecking ? 'در حال بررسی...' : 'بررسی مجدد وضعیت سایت'}</span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut size={15} />
              <span>خروج از حساب کاربری</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
