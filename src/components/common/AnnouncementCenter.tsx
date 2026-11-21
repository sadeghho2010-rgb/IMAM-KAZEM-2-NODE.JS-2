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
  CheckCircle2,
  Plus,
  Edit3,
  Trash2,
  XCircle,
  RefreshCw
} from 'lucide-react';
import {
  Announcement,
  AnnouncementAudience,
  AnnouncementPriority
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { localDb } from '../../lib/localDb';
import { cn } from '../../lib/utils';
import { dispatchDatabaseToast } from '../../lib/databaseToast';
import { canUserManageAnnouncements } from '../../lib/autoAnnouncementHelper';

interface AnnouncementCenterProps {
  variant?: 'light' | 'mobile' | 'dark-portal';
}

const AUDIENCE_LABELS: Record<AnnouncementAudience, string> = {
  all: 'همه کاربران سامانه',
  students: 'فقط طلاب',
  teachers: 'فقط اساتید',
  staff: 'کادر آموزشی و اجرایی'
};

const PRIORITY_LABELS: Record<AnnouncementPriority, string> = {
  normal: 'عادی',
  important: 'مهم',
  urgent: 'فوری'
};

function isStudentAccount(user: any): boolean {
  if (!user) return false;
  return (
    (user.level === 3 || user.role === 'student' || user.role === 'class_representative') &&
    user.role !== 'teacher'
  );
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

function sortAnnouncements(list: Announcement[]): Announcement[] {
  const prioWeight = (p?: string) => (p === 'urgent' ? 3 : p === 'important' ? 2 : 1);
  return (list || [])
    .slice()
    .sort((a, b) => {
      const diff = prioWeight(b.priority) - prioWeight(a.priority);
      if (diff !== 0) return diff;
      return (
        new Date(b.createdAt || b.updated_at || 0).getTime() -
        new Date(a.createdAt || a.updated_at || 0).getTime()
      );
    });
}

export default function AnnouncementCenter({ variant = 'light' }: AnnouncementCenterProps) {
  const { currentUser } = useAuth();
  const isStudent = isStudentAccount(currentUser);
  const canManage = canUserManageAnnouncements(currentUser);
  const userKey = String(currentUser?.studentId || currentUser?.id || currentUser?.username || 'guest');
  const sessionStorageKey = `session_closed_ann_${userKey}`;

  const [activeAnnouncements, setActiveAnnouncements] = useState<Announcement[]>([]);
  const [manageAnnouncements, setManageAnnouncements] = useState<Announcement[]>([]);
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

  const [popupIndex, setPopupIndex] = useState(0);
  const [isBellDrawerOpen, setIsBellDrawerOpen] = useState(false);
  const [isDismissingId, setIsDismissingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Manager inline state inside Bell modal
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formAudience, setFormAudience] = useState<AnnouncementAudience>('all');
  const [formPriority, setFormPriority] = useState<AnnouncementPriority>('important');
  const [formIsActive, setFormIsActive] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [isSyncingManage, setIsSyncingManage] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchManageList = useCallback(async (syncFromCloud = false) => {
    if (!canManage) return;
    if (syncFromCloud) setIsSyncingManage(true);
    try {
      if (syncFromCloud) {
        await localDb.syncCollectionFromCloud('announcements', true).catch((err: any) => {
          console.error('[STORAGE_FAILURE][AnnouncementCenter.manageSync]', err?.message || err);
        });
      }
      const docs = await localDb.getDocs<Announcement>('announcements');
      setManageAnnouncements(sortAnnouncements(docs || []));
    } catch (err: any) {
      console.error('[STORAGE_FAILURE][AnnouncementCenter.manageFetch]', err?.message || err);
    } finally {
      if (syncFromCloud) setIsSyncingManage(false);
    }
  }, [canManage]);

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
      const filtered = sortAnnouncements(
        (docs || []).filter(a => a && a.isActive !== false && matchesAudience(a, currentUser))
      );
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
    if (canManage) {
      fetchManageList(false);
    }
    const interval = setInterval(() => {
      fetchActiveData();
      if (canManage && isBellDrawerOpen) {
        fetchManageList(false);
      }
    }, 15000);
    const handleUpdate = () => {
      fetchActiveData();
      if (canManage) {
        fetchManageList(false);
      }
    };
    window.addEventListener('collection_change_announcements', handleUpdate);
    window.addEventListener('collection_change_announcement_dismissals', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener('collection_change_announcements', handleUpdate);
      window.removeEventListener('collection_change_announcement_dismissals', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, [fetchActiveData, fetchManageList, canManage, isBellDrawerOpen]);

  // Announcements that should auto-popup for this user
  const popupQueue = useMemo(() => {
    return activeAnnouncements.filter(
      a => !dismissedIds.includes(a.id) && !sessionClosedIds.includes(a.id)
    );
  }, [activeAnnouncements, dismissedIds, sessionClosedIds]);

  const showPopup = popupQueue.length > 0 && !isBellDrawerOpen;
  const safePopupIndex = Math.min(popupIndex, Math.max(0, popupQueue.length - 1));
  const currentPopupItem = popupQueue[safePopupIndex] || null;

  const handleClosePopupSession = () => {
    const idsToClose = popupQueue.map(a => a.id);
    const merged = Array.from(new Set([...sessionClosedIds, ...idsToClose]));
    setSessionClosedIds(merged);
    try {
      sessionStorage.setItem(sessionStorageKey, JSON.stringify(merged));
    } catch (err: any) {
      console.error('[STORAGE_FAILURE][AnnouncementCenter.sessionStorage]', err?.message || err);
    }
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

  // Manager controls directly inside Bell modal
  const openCreateForm = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormMessage('');
    setFormAudience('all');
    setFormPriority('important');
    setFormIsActive(true);
    setConfirmDeleteId(null);
    setActionError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (item: Announcement) => {
    setEditingItem(item);
    setFormTitle(item.title || '');
    setFormMessage(item.message || '');
    setFormAudience(item.targetAudience || 'all');
    setFormPriority(item.priority || 'normal');
    setFormIsActive(item.isActive !== false);
    setConfirmDeleteId(null);
    setActionError(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingItem(null);
  };

  const handleSaveBellForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || isMutating) return;

    const cleanTitle = formTitle.trim();
    const cleanMessage = formMessage.trim();
    if (!cleanTitle || !cleanMessage) {
      setActionError('لطفاً عنوان و متن کامل اطلاعیه را وارد نمایید.');
      return;
    }

    setIsMutating(true);
    setActionError(null);

    try {
      const nowIso = new Date().toISOString();
      const docId = editingItem?.id || `ann_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const nextVersion = (Number(editingItem?.version) || 0) + 1;

      const payload: Announcement = {
        id: docId,
        title: cleanTitle,
        message: cleanMessage,
        targetAudience: formAudience,
        priority: formPriority,
        isActive: formIsActive,
        autoSourceType: editingItem?.autoSourceType,
        sourcePeriodId: editingItem?.sourcePeriodId,
        isCustomized: editingItem?.autoSourceType ? true : editingItem?.isCustomized,
        manuallyDeactivated: !formIsActive,
        createdAt: editingItem?.createdAt || nowIso,
        createdBy: editingItem?.createdBy || String(currentUser?.username || currentUser?.id || 'admin'),
        createdByName: editingItem?.createdByName || String(currentUser?.name || currentUser?.fullName || 'مسئول آموزش'),
        updated_at: nowIso,
        version: nextVersion
      };

      const savedId = await localDb.setDoc('announcements', payload);
      if (!savedId) {
        throw new Error('ذخیره اطلاعیه در پایگاه داده تایید نشد.');
      }
      await localDb.flushSyncQueue();

      // Read-After-Write verification
      const freshDocs = await localDb.getDocs<Announcement>('announcements');
      setManageAnnouncements(sortAnnouncements(freshDocs || []));
      await fetchActiveData();

      window.dispatchEvent(new CustomEvent('collection_change_announcements'));
      window.dispatchEvent(new CustomEvent('app_data_change', { detail: { collection: 'announcements', id: docId } }));

      console.log('[STORAGE_SUCCESS][Bell.announcements.save]', docId, `v${nextVersion}`);
      dispatchDatabaseToast(
        editingItem
          ? `اطلاعیه «${cleanTitle}» ویرایش و ذخیره شد.`
          : `اطلاعیه جدید «${cleanTitle}» ثبت گردید.`,
        'success'
      );
      closeForm();
    } catch (err: any) {
      console.error('[STORAGE_FAILURE][Bell.announcements.save]', err?.message || err);
      const errMsg = err?.message || 'خطا در ذخیره‌سازی اطلاعیه';
      setActionError(errMsg);
      dispatchDatabaseToast(errMsg, 'error');
    } finally {
      setIsMutating(false);
    }
  };

  const handleToggleActiveFromBell = async (item: Announcement) => {
    if (!canManage || isMutating) return;
    setIsMutating(true);
    setActionError(null);

    try {
      const nowIso = new Date().toISOString();
      const nextActive = item.isActive === false;
      const nextVersion = (Number(item.version) || 0) + 1;

      const updated: Announcement = {
        ...item,
        isActive: nextActive,
        manuallyDeactivated: !nextActive,
        updated_at: nowIso,
        version: nextVersion
      };

      await localDb.setDoc('announcements', updated);
      await localDb.flushSyncQueue();

      const freshDocs = await localDb.getDocs<Announcement>('announcements');
      setManageAnnouncements(sortAnnouncements(freshDocs || []));
      await fetchActiveData();

      window.dispatchEvent(new CustomEvent('collection_change_announcements'));
      window.dispatchEvent(new CustomEvent('app_data_change', { detail: { collection: 'announcements', id: item.id } }));

      console.log('[STORAGE_SUCCESS][Bell.announcements.toggle]', item.id, `active=${nextActive}`, `v${nextVersion}`);
      dispatchDatabaseToast(
        nextActive ? `اطلاعیه «${item.title}» فعال شد.` : `اطلاعیه «${item.title}» غیرفعال گردید.`,
        'success'
      );
    } catch (err: any) {
      console.error('[STORAGE_FAILURE][Bell.announcements.toggle]', err?.message || err);
      const errMsg = err?.message || 'خطا در تغییر وضعیت اطلاعیه';
      setActionError(errMsg);
      dispatchDatabaseToast(errMsg, 'error');
    } finally {
      setIsMutating(false);
    }
  };

  const handleDeleteFromBell = async (item: Announcement) => {
    if (!canManage || isMutating) return;
    setIsMutating(true);
    setActionError(null);

    try {
      await localDb.deleteDoc('announcements', item.id);
      await localDb.flushSyncQueue();

      const freshDocs = await localDb.getDocs<Announcement>('announcements');
      setManageAnnouncements(sortAnnouncements(freshDocs || []));
      await fetchActiveData();

      if (editingItem?.id === item.id) {
        closeForm();
      }
      setConfirmDeleteId(null);

      window.dispatchEvent(new CustomEvent('collection_change_announcements'));
      window.dispatchEvent(new CustomEvent('app_data_change', { detail: { collection: 'announcements', id: item.id, action: 'delete' } }));

      console.log('[STORAGE_SUCCESS][Bell.announcements.delete]', item.id);
      dispatchDatabaseToast(`اطلاعیه «${item.title}» حذف شد.`, 'success');
    } catch (err: any) {
      console.error('[STORAGE_FAILURE][Bell.announcements.delete]', err?.message || err);
      const errMsg = err?.message || 'خطا در حذف اطلاعیه';
      setActionError(errMsg);
      dispatchDatabaseToast(errMsg, 'error');
    } finally {
      setIsMutating(false);
    }
  };

  const filteredManageAnnouncements = useMemo(() => {
    if (!canManage) return activeAnnouncements;
    return manageAnnouncements.filter(item => {
      if (statusFilter === 'active') return item.isActive !== false;
      if (statusFilter === 'inactive') return item.isActive === false;
      return true;
    });
  }, [canManage, manageAnnouncements, activeAnnouncements, statusFilter]);

  const manageActiveCount = useMemo(
    () => manageAnnouncements.filter(a => a.isActive !== false).length,
    [manageAnnouncements]
  );

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
          if (canManage) {
            fetchManageList(true);
          }
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
        title={canManage ? 'مدیریت و مشاهده اطلاعیه‌های سامانه' : 'اطلاعیه‌های فعال سامانه'}
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
                      <span className="text-[11px] font-black text-slate-600 tabular-nums">
                        · {safePopupIndex + 1} از {popupQueue.length}
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
                    className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
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
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-colors cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                >
                  متوجه شدم
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bell Announcements Modal (Read for All Users, Full Inline Management for Education Officer & Super Admin) */}
      {isBellDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-vazir text-right"
          dir="rtl"
          onClick={() => setIsBellDrawerOpen(false)}
        >
          <div
            className={cn(
              'bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-h-[88vh] flex flex-col overflow-hidden',
              canManage ? 'max-w-2xl' : 'max-w-xl'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Bell size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-900 truncate">
                    {canManage ? 'مدیریت و مشاهده اطلاعیه‌های سامانه' : 'اطلاعیه‌های فعال سامانه'}
                  </h3>
                  <p className="text-[11px] text-slate-500 tabular-nums">
                    {canManage
                      ? `${manageActiveCount} فعال · ${manageAnnouncements.length} کل اطلاعیه`
                      : activeCount > 0
                      ? `${activeCount} اطلاعیه فعال موجود است`
                      : 'در حال حاضر اطلاعیه فعالی وجود ندارد'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => (isFormOpen && !editingItem ? closeForm() : openCreateForm())}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Plus size={14} />
                      <span>اطلاعیه جدید</span>
                    </button>
                    <button
                      type="button"
                      disabled={isSyncingManage}
                      onClick={() => fetchManageList(true)}
                      className="p-2 rounded-xl text-slate-500 hover:text-indigo-700 hover:bg-slate-200/70 cursor-pointer disabled:opacity-50"
                      title="همگام‌سازی اطلاعیه‌ها"
                    >
                      <RefreshCw size={15} className={isSyncingManage ? 'animate-spin' : ''} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setIsBellDrawerOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 cursor-pointer"
                  title="بستن"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Manager Segmented Filter */}
            {canManage && (
              <div className="px-5 py-2.5 border-b border-slate-100 bg-white flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-[11px] font-bold">
                  {([
                    { id: 'all', label: `همه (${manageAnnouncements.length})` },
                    { id: 'active', label: `فعال (${manageActiveCount})` },
                    { id: 'inactive', label: `غیرفعال (${manageAnnouncements.length - manageActiveCount})` }
                  ] as const).map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStatusFilter(tab.id)}
                      className={cn(
                        'px-2.5 py-1 rounded-lg transition-all cursor-pointer tabular-nums whitespace-nowrap shrink-0',
                        statusFilter === tab.id
                          ? 'bg-white text-indigo-700 shadow-2xs font-black'
                          : 'text-slate-600 hover:text-slate-900'
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-slate-500">
                  اطلاعیه‌های مطالعه و نهار به صورت خودکار و با قابلیت ویرایش ثبت می‌شوند
                </span>
              </div>
            )}

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
              {actionError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between gap-2">
                  <span>{actionError}</span>
                  <button
                    type="button"
                    onClick={() => setActionError(null)}
                    className="text-rose-500 hover:text-rose-800 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Inline Create / Edit Form for Managers */}
              {canManage && isFormOpen && (
                <form
                  onSubmit={handleSaveBellForm}
                  className="p-4 rounded-2xl bg-slate-50 border border-indigo-200 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                    <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      {editingItem ? <Edit3 size={14} className="text-amber-600" /> : <Plus size={14} className="text-indigo-600" />}
                      <span>{editingItem ? 'ویرایش اطلاعیه' : 'ثبت اطلاعیه جدید'}</span>
                    </h4>
                    <button
                      type="button"
                      onClick={closeForm}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      انصراف
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">عنوان اطلاعیه</label>
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="عنوان کوتاه و شفاف اطلاعیه..."
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-bold text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">متن اطلاعیه</label>
                    <textarea
                      required
                      rows={3}
                      value={formMessage}
                      onChange={(e) => setFormMessage(e.target.value)}
                      placeholder="متن کامل جهت نمایش به کاربران..."
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium text-slate-800 leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">مخاطبین هدف</label>
                      <select
                        value={formAudience}
                        onChange={(e) => setFormAudience(e.target.value as AnnouncementAudience)}
                        className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-bold text-slate-800"
                      >
                        <option value="all">همه کاربران سامانه</option>
                        <option value="students">فقط طلاب</option>
                        <option value="teachers">فقط اساتید</option>
                        <option value="staff">کادر آموزشی و اجرایی</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">درجه اهمیت</label>
                      <select
                        value={formPriority}
                        onChange={(e) => setFormPriority(e.target.value as AnnouncementPriority)}
                        className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-bold text-slate-800"
                      >
                        <option value="normal">عادی</option>
                        <option value="important">مهم</option>
                        <option value="urgent">فوری</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formIsActive}
                        onChange={(e) => setFormIsActive(e.target.checked)}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                      <span>اطلاعیه فعال و برای کاربران نمایش داده شود</span>
                    </label>

                    <button
                      type="submit"
                      disabled={isMutating}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      {isMutating
                        ? 'در حال ذخیره...'
                        : editingItem
                        ? 'ذخیره تغییرات'
                        : 'ثبت اطلاعیه'}
                    </button>
                  </div>
                </form>
              )}

              {/* Announcement List */}
              {filteredManageAnnouncements.length === 0 ? (
                <div className="py-12 text-center space-y-2 text-slate-400">
                  <Sparkles size={28} className="mx-auto text-slate-300" />
                  <p className="text-xs font-bold">
                    {canManage
                      ? 'در این بخش اطلاعیه‌ای ثبت نشده است.'
                      : 'هم‌اکنون اطلاعیه فعالی برای شما ثبت نشده است.'}
                  </p>
                </div>
              ) : (
                filteredManageAnnouncements.map(item => {
                  const isPermDismissed = dismissedIds.includes(item.id);
                  const isActiveItem = item.isActive !== false;
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'p-4 rounded-2xl border space-y-2.5 transition-colors',
                        !isActiveItem
                          ? 'bg-slate-50/60 border-slate-200/80 opacity-80'
                          : item.priority === 'urgent'
                          ? 'bg-rose-50/35 border-rose-200'
                          : item.priority === 'important'
                          ? 'bg-amber-50/35 border-amber-200'
                          : 'bg-white border-slate-200'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <h4 className="text-sm font-black text-slate-900">{item.title}</h4>
                          <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500 font-medium">
                            <span>{PRIORITY_LABELS[item.priority || 'normal']}</span>
                            {canManage && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{AUDIENCE_LABELS[item.targetAudience || 'all']}</span>
                              </>
                            )}
                            {item.autoSourceType && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-indigo-700 font-bold">
                                  {item.autoSourceType === 'study_period'
                                    ? 'خودکار (دوره مطالعه)'
                                    : 'خودکار (رزرو نهار و شام)'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {canManage && (
                            <span
                              className={cn(
                                'text-[11px] font-black',
                                isActiveItem ? 'text-emerald-700' : 'text-slate-500'
                              )}
                            >
                              {isActiveItem ? 'فعال' : 'غیرفعال'}
                            </span>
                          )}
                          {isStudent && isPermDismissed && (
                            <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 size={12} />
                              <span>عدم نمایش پاپ‌آپ</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                        {item.message}
                      </p>

                      {/* Inline Delete Confirmation for Managers */}
                      {canManage && confirmDeleteId === item.id && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-rose-900">
                            آیا از حذف کامل این اطلاعیه اطمینان دارید؟
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isMutating}
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer"
                            >
                              انصراف
                            </button>
                            <button
                              type="button"
                              disabled={isMutating}
                              onClick={() => handleDeleteFromBell(item)}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black cursor-pointer disabled:opacity-50"
                            >
                              {isMutating ? 'در حال حذف...' : 'بله، حذف شود'}
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-[10.5px] text-slate-500 tabular-nums border-t border-slate-100">
                        <span>
                          {item.createdByName || 'مدیریت آموزش'} ·{' '}
                          {item.createdAt ? new Date(item.createdAt).toLocaleString('fa-IR') : ''}
                        </span>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {canManage && (
                            <>
                              <button
                                type="button"
                                disabled={isMutating}
                                onClick={() => handleToggleActiveFromBell(item)}
                                className={cn(
                                  'px-2.5 py-1 rounded-lg text-[11px] font-black border flex items-center gap-1 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0',
                                  isActiveItem
                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                                )}
                              >
                                {isActiveItem ? <XCircle size={12} /> : <CheckCircle2 size={12} />}
                                <span>{isActiveItem ? 'غیرفعال کردن' : 'فعال‌سازی'}</span>
                              </button>

                              <button
                                type="button"
                                disabled={isMutating}
                                onClick={() => openEditForm(item)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                                title="ویرایش اطلاعیه"
                              >
                                <Edit3 size={12} />
                                <span>ویرایش</span>
                              </button>

                              <button
                                type="button"
                                disabled={isMutating}
                                onClick={() => setConfirmDeleteId(item.id)}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                                title="حذف اطلاعیه"
                              >
                                <Trash2 size={12} />
                                <span>حذف</span>
                              </button>
                            </>
                          )}

                          {isStudent && !isPermDismissed && (
                            <button
                              type="button"
                              disabled={isDismissingId === item.id}
                              onClick={() => handlePermanentStudentDismiss(item.id)}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-50 text-amber-900 border border-amber-200 text-[10.5px] font-black flex items-center gap-1 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                            >
                              <EyeOff size={11} />
                              <span>دیگر به من نمایش نده</span>
                            </button>
                          )}
                        </div>
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
