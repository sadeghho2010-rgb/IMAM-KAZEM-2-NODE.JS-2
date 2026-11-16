import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Bell,
  Megaphone,
  X,
  EyeOff,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { Announcement } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { localDb } from '../../lib/localDb';
import { cn } from '../../lib/utils';

interface AnnouncementCenterProps {
  variant?: 'light' | 'mobile' | 'dark-portal';
}

function isStudentAccount(user: any): boolean {
  if (!user) return false;
  return (user.level === 3 || user.role === 'student' || user.role === 'class_representative') && user.role !== 'teacher';
}

function matchesAudience(item: Announcement, user: any): boolean {
  const audience = item.targetAudience || 'all';
  if (audience === 'all') return true;
  if (!user) return false;
  const role = String(user.role || '');
  const level = Number(user.level) || 0;
  if (audience === 'students') {
    return isStudentAccount(user);
  }
  if (audience === 'teachers') {
    return role === 'teacher';
  }
  if (audience === 'staff') {
    return (
      level === 1 ||
      level === 2 ||
      role === 'super_admin' ||
      role === 'education_manager' ||
      role === 'education_officer' ||
      role === 'finance_manager' ||
      role === 'grade_mentor' ||
      role === 'research_manager'
    );
  }
  return true;
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

export default function AnnouncementCenter({ variant = 'light' }: AnnouncementCenterProps) {
  const { currentUser } = useAuth();
  const isStudent = isStudentAccount(currentUser);
  const userKey = String(currentUser?.studentId || currentUser?.id || currentUser?.username || 'guest');
  const sessionStorageKey = `session_closed_ann_${userKey}`;

  const [activeAnnouncements, setActiveAnnouncements] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [sessionClosedIds, setSessionClosedIds] = useState<string[]>(() => {
    try {
      const raw = sessionStorage.getItem(sessionStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [popupDismissedManually, setPopupDismissedManually] = useState(false);
  const [popupIndex, setPopupIndex] = useState(0);
  const [isBellDrawerOpen, setIsBellDrawerOpen] = useState(false);
  const [isDismissingId, setIsDismissingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchActiveData = useCallback(async () => {
    if (!currentUser) return;
    try {
      // Authoritative fetch from server API
      const res = await fetch('/api/system/announcements/active', {
        headers: getAuthHeaders(),
        credentials: 'include',
        cache: 'no-store'
      });

      if (res.ok) {
        const json = await res.json();
        if (json?.success && Array.isArray(json.announcements)) {
          setActiveAnnouncements(json.announcements);
          if (Array.isArray(json.dismissedIds)) {
            setDismissedIds(json.dismissedIds);
          }
          return;
        }
      }
    } catch (err: any) {
      console.error('[STORAGE_FAILURE][AnnouncementCenter.api]', err?.message || err);
    }

    // IndexedDB fallback for offline resilience
    try {
      const [docs, dismissals] = await Promise.all([
        localDb.getDocs<Announcement>('announcements'),
        localDb.getDocs<any>('announcement_dismissals')
      ]);
      const filtered = (docs || [])
        .filter(a => a && a.isActive !== false && matchesAudience(a, currentUser))
        .sort((a, b) => new Date(b.createdAt || b.updated_at || 0).getTime() - new Date(a.createdAt || a.updated_at || 0).getTime());
      setActiveAnnouncements(filtered);

      const candidates = [currentUser.id, currentUser.studentId, (currentUser as any).linkedStudentId, currentUser.username]
        .filter(Boolean)
        .map((x: any) => String(x).trim().toLowerCase());
      const userDismissed = Array.from(
        new Set(
          (dismissals || [])
            .filter((d: any) => {
              if (!d || !d.announcementId) return false;
              const du = String(d.userId || '').trim().toLowerCase();
              const ds = String(d.studentId || '').trim().toLowerCase();
              const dun = String(d.username || '').trim().toLowerCase();
              return (du && candidates.includes(du)) || (ds && candidates.includes(ds)) || (dun && candidates.includes(dun));
            })
            .map((d: any) => String(d.announcementId))
        )
      );
      setDismissedIds(userDismissed);
    } catch (err: any) {
      console.error('[STORAGE_FAILURE][AnnouncementCenter.localDb]', err?.message || err);
    }
  }, [currentUser]);

  // Reset session-closed cache when user changes
  useEffect(() => {
    setPopupDismissedManually(false);
    setPopupIndex(0);
    try {
      const raw = sessionStorage.getItem(sessionStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setSessionClosedIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSessionClosedIds([]);
    }
  }, [sessionStorageKey]);

  useEffect(() => {
    fetchActiveData();
    const interval = setInterval(fetchActiveData, 15000);
    const handleUpdate = () => fetchActiveData();
    window.addEventListener('collection_change_announcements', handleUpdate);
    window.addEventListener('collection_change_announcement_dismissals', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener('collection_change_announcements', handleUpdate);
      window.removeEventListener('collection_change_announcement_dismissals', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, [fetchActiveData]);

  // Announcements that should auto-popup for this user
  const popupQueue = useMemo(() => {
    return activeAnnouncements.filter(
      a => !dismissedIds.includes(a.id) && !sessionClosedIds.includes(a.id)
    );
  }, [activeAnnouncements, dismissedIds, sessionClosedIds]);

  const showPopup = !popupDismissedManually && popupQueue.length > 0 && !isBellDrawerOpen;
  const safePopupIndex = Math.min(popupIndex, Math.max(0, popupQueue.length - 1));
  const currentPopupItem = popupQueue[safePopupIndex] || null;

  const handleClosePopupSession = () => {
    const idsToClose = popupQueue.map(a => a.id);
    const merged = Array.from(new Set([...sessionClosedIds, ...idsToClose]));
    setSessionClosedIds(merged);
    try {
      sessionStorage.setItem(sessionStorageKey, JSON.stringify(merged));
    } catch {}
    setPopupDismissedManually(true);
    setActionError(null);
  };

  const handlePermanentStudentDismiss = async (announcementId: string) => {
    if (!isStudent || isDismissingId) return;
    setIsDismissingId(announcementId);
    setActionError(null);

    try {
      const res = await fetch(`/api/system/announcements/${encodeURIComponent(announcementId)}/dismiss`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        credentials: 'include'
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || 'خطا در ثبت دائمی عدم نمایش اطلاعیه');
      }

      if (json.dismissal) {
        await localDb.setDoc('announcement_dismissals', json.dismissal).catch((err: any) => {
          console.error('[STORAGE_FAILURE][AnnouncementCenter.mirrorDismiss]', err?.message || err);
        });
      }

      // Read-After-Write state update from server response
      const serverDismissedIds = Array.isArray(json.dismissedIds)
        ? json.dismissedIds
        : Array.from(new Set([...dismissedIds, announcementId]));
      setDismissedIds(serverDismissedIds);
      setPopupIndex(0);
      console.log('[STORAGE_SUCCESS][announcement_dismiss]', announcementId);
    } catch (err: any) {
      console.error('[STORAGE_FAILURE][AnnouncementCenter.dismiss]', err?.message || err);
      setActionError(err?.message || 'امکان ثبت دائمی در سرور برقرار نشد. لطفاً دوباره تلاش کنید.');
    } finally {
      setIsDismissingId(null);
    }
  };

  if (!currentUser) return null;

  const activeCount = activeAnnouncements.length;
  const unreadCount = activeAnnouncements.filter(a => !dismissedIds.includes(a.id)).length;

  return (
    <>
      {/* Header Bell Button */}
      <button
        type="button"
        onClick={() => {
          setActionError(null);
          fetchActiveData();
          setIsBellDrawerOpen(true);
        }}
        className={cn(
          'relative flex items-center justify-center transition-all cursor-pointer shrink-0',
          variant === 'dark-portal'
            ? 'p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15'
            : variant === 'mobile'
            ? 'w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80'
            : 'p-2 rounded-2xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200/90 shadow-2xs'
        )}
        title="اطلاعیه‌های فعال سامانه"
        aria-label="اطلاعیه‌ها"
      >
        <Bell size={variant === 'mobile' ? 18 : 17} />
        {activeCount > 0 && (
          <span
            className={cn(
              'absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center tabular-nums shadow-xs border',
              unreadCount > 0
                ? 'bg-rose-600 text-white border-white'
                : 'bg-indigo-600 text-white border-white'
            )}
          >
            {activeCount}
          </span>
        )}
      </button>

      {/* Auto Startup Announcement Popup Modal */}
      {showPopup && currentPopupItem && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 font-vazir text-right"
          dir="rtl"
          onClick={handleClosePopupSession}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Strip */}
            <div
              className={cn(
                'px-5 py-4 border-b flex items-center justify-between gap-3',
                currentPopupItem.priority === 'urgent'
                  ? 'bg-rose-50 border-rose-200'
                  : currentPopupItem.priority === 'important'
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-indigo-50 border-indigo-200'
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                    currentPopupItem.priority === 'urgent'
                      ? 'bg-rose-600 text-white'
                      : currentPopupItem.priority === 'important'
                      ? 'bg-amber-600 text-white'
                      : 'bg-indigo-600 text-white'
                  )}
                >
                  {currentPopupItem.priority === 'urgent' ? <AlertTriangle size={18} /> : <Megaphone size={18} />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-black text-slate-600">اطلاعیه مهم سامانه</span>
                    {popupQueue.length > 1 && (
                      <span className="px-2 py-0.5 rounded-full bg-white/80 text-slate-700 text-[10px] font-black tabular-nums border border-slate-200">
                        {safePopupIndex + 1} از {popupQueue.length}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
                    {currentPopupItem.title}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClosePopupSession}
                className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-white/70 transition-colors cursor-pointer"
                title="بستن"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 space-y-4">
              {actionError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                  {actionError}
                </div>
              )}

              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50/90 p-4 rounded-2xl border border-slate-200/80 max-h-[45vh] overflow-y-auto">
                {currentPopupItem.message}
              </p>

              <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                <span>از طرف: {currentPopupItem.createdByName || 'مدیریت آموزش'}</span>
                <span>
                  {currentPopupItem.createdAt
                    ? new Date(currentPopupItem.createdAt).toLocaleDateString('fa-IR')
                    : ''}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              {popupQueue.length > 1 ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePopupIndex === 0}
                    onClick={() => setPopupIndex(i => Math.max(0, i - 1))}
                    className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                    title="اطلاعیه قبلی"
                  >
                    <ChevronRight size={15} />
                  </button>
                  <button
                    type="button"
                    disabled={safePopupIndex >= popupQueue.length - 1}
                    onClick={() => setPopupIndex(i => Math.min(popupQueue.length - 1, i + 1))}
                    className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                    title="اطلاعیه بعدی"
                  >
                    <ChevronLeft size={15} />
                  </button>
                </div>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2 flex-wrap">
                {isStudent && (
                  <button
                    type="button"
                    disabled={isDismissingId === currentPopupItem.id}
                    onClick={() => handlePermanentStudentDismiss(currentPopupItem.id)}
                    className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <EyeOff size={14} />
                    <span>
                      {isDismissingId === currentPopupItem.id ? 'در حال ثبت...' : 'دیگر به من نمایش نده'}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleClosePopupSession}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-colors cursor-pointer shadow-xs"
                >
                  متوجه شدم
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bell Active Announcements List Modal */}
      {isBellDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-vazir text-right"
          dir="rtl"
          onClick={() => setIsBellDrawerOpen(false)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <Bell size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">اطلاعیه‌های فعال سامانه</h3>
                  <p className="text-[11px] text-slate-500 tabular-nums">
                    {activeCount > 0 ? `${activeCount} اطلاعیه فعال موجود است` : 'در حال حاضر اطلاعیه فعالی وجود ندارد'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBellDrawerOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 cursor-pointer"
                title="بستن"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
              {actionError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                  {actionError}
                </div>
              )}

              {activeAnnouncements.length === 0 ? (
                <div className="py-12 text-center space-y-2 text-slate-400">
                  <Sparkles size={28} className="mx-auto text-slate-300" />
                  <p className="text-xs font-bold">هم‌اکنون اطلاعیه فعالی برای شما ثبت نشده است.</p>
                </div>
              ) : (
                activeAnnouncements.map(item => {
                  const isPermDismissed = dismissedIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'p-4 rounded-2xl border space-y-2',
                        item.priority === 'urgent'
                          ? 'bg-rose-50/40 border-rose-200'
                          : item.priority === 'important'
                          ? 'bg-amber-50/40 border-amber-200'
                          : 'bg-slate-50/70 border-slate-200'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <h4 className="text-sm font-black text-slate-900">{item.title}</h4>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-md text-[10px] font-black border',
                              item.priority === 'urgent'
                                ? 'bg-rose-100 text-rose-800 border-rose-200'
                                : item.priority === 'important'
                                ? 'bg-amber-100 text-amber-800 border-amber-200'
                                : 'bg-white text-slate-700 border-slate-200'
                            )}
                          >
                            {item.priority === 'urgent' ? 'فوری' : item.priority === 'important' ? 'مهم' : 'عادی'}
                          </span>
                          {isStudent && isPermDismissed && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                              <CheckCircle2 size={10} />
                              <span>عدم نمایش پاپ‌آپ</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                        {item.message}
                      </p>

                      <div className="flex items-center justify-between gap-2 pt-1 text-[10.5px] text-slate-500 tabular-nums">
                        <span>
                          {item.createdByName || 'مدیریت آموزش'} •{' '}
                          {item.createdAt ? new Date(item.createdAt).toLocaleString('fa-IR') : ''}
                        </span>
                        {isStudent && !isPermDismissed && (
                          <button
                            type="button"
                            disabled={isDismissingId === item.id}
                            onClick={() => handlePermanentStudentDismiss(item.id)}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-50 text-amber-900 border border-amber-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <EyeOff size={11} />
                            <span>دیگر به من نمایش نده</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
