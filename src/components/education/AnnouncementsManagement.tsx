import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Megaphone,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Lock,
  RefreshCw,
  X,
  Eye,
  Sparkles
} from 'lucide-react';
import { Announcement, AnnouncementAudience, AnnouncementPriority } from '../../types';
import { localDb } from '../../lib/localDb';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import { dispatchDatabaseToast } from '../../lib/databaseToast';

function canManageAnnouncements(user: any): boolean {
  if (!user) return false;
  if (user.isReadOnly === true || user.canEdit === false) return false;
  const uName = String(user.username || '').toUpperCase().trim();
  const role = String(user.role || '').trim();
  const level = Number(user.level) || 0;
  if (role === 'school_manager' || role === 'manager_principal' || uName === 'RAHNAMA') {
    return false;
  }
  return (
    role === 'super_admin' ||
    uName === 'SADEGH' ||
    (level === 1 && role !== 'school_manager') ||
    role === 'education_manager' ||
    role === 'education_officer' ||
    uName === 'SHAH' ||
    uName === 'SHAHPOORI'
  );
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

export default function AnnouncementsManagement() {
  const { currentUser } = useAuth();
  const canEdit = canManageAnnouncements(currentUser);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleInput, setTitleInput] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [targetAudience, setTargetAudience] = useState<AnnouncementAudience>('all');
  const [priority, setPriority] = useState<AnnouncementPriority>('important');
  const [isActive, setIsActive] = useState(true);

  const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null);

  const fetchAnnouncements = useCallback(async (syncFromCloud = false) => {
    setErrorBanner(null);
    try {
      if (syncFromCloud) {
        await localDb.syncCollectionFromCloud('announcements', true).catch((err: any) => {
          console.error('[STORAGE_FAILURE][announcements.sync]', err?.message || err);
        });
      }
      const docs = await localDb.getDocs<Announcement>('announcements');
      const sorted = (docs || []).slice().sort((a, b) => {
        return new Date(b.createdAt || b.updated_at || 0).getTime() - new Date(a.createdAt || a.updated_at || 0).getTime();
      });
      setAnnouncements(sorted);
    } catch (err: any) {
      console.error('[STORAGE_FAILURE][announcements.fetch]', err?.message || err);
      setErrorBanner(err?.message || 'خطا در بارگذاری لیست اطلاعیه‌ها');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements(true);
    const handleSync = () => fetchAnnouncements(false);
    window.addEventListener('collection_change_announcements', handleSync);
    return () => {
      window.removeEventListener('collection_change_announcements', handleSync);
    };
  }, [fetchAnnouncements]);

  const resetForm = () => {
    setEditingId(null);
    setTitleInput('');
    setMessageInput('');
    setTargetAudience('all');
    setPriority('important');
    setIsActive(true);
  };

  const handleEditClick = (item: Announcement) => {
    setEditingId(item.id);
    setTitleInput(item.title || '');
    setMessageInput(item.message || '');
    setTargetAudience(item.targetAudience || 'all');
    setPriority(item.priority || 'normal');
    setIsActive(item.isActive !== false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || isSaving) return;

    const cleanTitle = titleInput.trim();
    const cleanMsg = messageInput.trim();
    if (!cleanTitle || !cleanMsg) {
      dispatchDatabaseToast('لطفاً عنوان و متن کامل اطلاعیه را وارد نمایید.', 'warning');
      return;
    }

    setIsSaving(true);
    setErrorBanner(null);

    try {
      const nowIso = new Date().toISOString();
      const existing = editingId ? announcements.find(a => a.id === editingId) : undefined;
      const docId = editingId || `ann_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const nextVersion = (Number(existing?.version) || 0) + 1;

      const payload: Announcement = {
        id: docId,
        title: cleanTitle,
        message: cleanMsg,
        targetAudience,
        priority,
        isActive,
        createdAt: existing?.createdAt || nowIso,
        createdBy: existing?.createdBy || String(currentUser?.username || currentUser?.id || 'admin'),
        createdByName: existing?.createdByName || String(currentUser?.name || currentUser?.fullName || 'مسئول آموزش'),
        updated_at: nowIso,
        version: nextVersion
      };

      const saved = await localDb.setDoc('announcements', payload);
      if (!saved) {
        throw new Error('ذخیره اطلاعیه در پایگاه داده تایید نشد.');
      }

      // Read-After-Write verification
      const freshDocs = await localDb.getDocs<Announcement>('announcements');
      const sorted = (freshDocs || []).slice().sort((a, b) => {
        return new Date(b.createdAt || b.updated_at || 0).getTime() - new Date(a.createdAt || a.updated_at || 0).getTime();
      });
      setAnnouncements(sorted);

      window.dispatchEvent(new CustomEvent('collection_change_announcements'));
      window.dispatchEvent(new CustomEvent('app_data_change', { detail: { collection: 'announcements', id: docId } }));

      console.log('[STORAGE_SUCCESS][announcements]', docId, `v${nextVersion}`);
      dispatchDatabaseToast(
        editingId
          ? `اطلاعیه «${cleanTitle}» با موفقیت ویرایش و ذخیره شد.`
          : `اطلاعیه جدید «${cleanTitle}» ثبت و در پایگاه داده ذخیره گردید.`,
        'success'
      );
      resetForm();
    } catch (err: any) {
      console.error('[STORAGE_FAILURE][announcements.save]', err?.message || err);
      const errMsg = err?.message || 'خطا در ثبت اطلاعیه در پایگاه داده';
      setErrorBanner(errMsg);
      dispatchDatabaseToast(errMsg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (item: Announcement) => {
    if (!canEdit || isSaving) return;
    setIsSaving(true);
    setErrorBanner(null);

    try {
      const nowIso = new Date().toISOString();
      const nextActive = item.isActive === false;
      const nextVersion = (Number(item.version) || 0) + 1;
      const updated: Announcement = {
        ...item,
        isActive: nextActive,
        updated_at: nowIso,
        version: nextVersion
      };

      await localDb.setDoc('announcements', updated);
      const freshDocs = await localDb.getDocs<Announcement>('announcements');
      const sorted = (freshDocs || []).slice().sort((a, b) => {
        return new Date(b.createdAt || b.updated_at || 0).getTime() - new Date(a.createdAt || a.updated_at || 0).getTime();
      });
      setAnnouncements(sorted);

      window.dispatchEvent(new CustomEvent('collection_change_announcements'));
      window.dispatchEvent(new CustomEvent('app_data_change', { detail: { collection: 'announcements', id: item.id } }));

      console.log('[STORAGE_SUCCESS][announcements.toggle]', item.id, `active=${nextActive}`, `v${nextVersion}`);
      dispatchDatabaseToast(
        nextActive
          ? `اطلاعیه «${item.title}» فعال شد و برای کاربران نمایش داده می‌شود.`
          : `اطلاعیه «${item.title}» غیرفعال گردید.`,
        'success'
      );
    } catch (err: any) {
      console.error('[STORAGE_FAILURE][announcements.toggle]', err?.message || err);
      const errMsg = err?.message || 'خطا در تغییر وضعیت اطلاعیه';
      setErrorBanner(errMsg);
      dispatchDatabaseToast(errMsg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!canEdit || !announcementToDelete || isSaving) return;
    setIsSaving(true);
    setErrorBanner(null);
    const targetId = announcementToDelete.id;
    const targetTitle = announcementToDelete.title;

    try {
      await localDb.deleteDoc('announcements', targetId);
      const freshDocs = await localDb.getDocs<Announcement>('announcements');
      const sorted = (freshDocs || []).slice().sort((a, b) => {
        return new Date(b.createdAt || b.updated_at || 0).getTime() - new Date(a.createdAt || a.updated_at || 0).getTime();
      });
      setAnnouncements(sorted);

      if (editingId === targetId) resetForm();
      setAnnouncementToDelete(null);

      window.dispatchEvent(new CustomEvent('collection_change_announcements'));
      window.dispatchEvent(new CustomEvent('app_data_change', { detail: { collection: 'announcements', id: targetId, action: 'delete' } }));

      console.log('[STORAGE_SUCCESS][announcements.delete]', targetId);
      dispatchDatabaseToast(`اطلاعیه «${targetTitle}» حذف شد.`, 'success');
    } catch (err: any) {
      console.error('[STORAGE_FAILURE][announcements.delete]', err?.message || err);
      const errMsg = err?.message || 'خطا در حذف اطلاعیه';
      setErrorBanner(errMsg);
      dispatchDatabaseToast(errMsg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter(item => {
      if (statusFilter === 'active') return item.isActive !== false;
      if (statusFilter === 'inactive') return item.isActive === false;
      return true;
    });
  }, [announcements, statusFilter]);

  const activeCount = useMemo(
    () => announcements.filter(a => a.isActive !== false).length,
    [announcements]
  );

  if (!canEdit) {
    return (
      <div className="bg-white rounded-3xl border border-rose-200 p-8 text-center space-y-3 font-vazir shadow-xs" dir="rtl">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
          <Lock size={28} />
        </div>
        <h2 className="text-base font-black text-slate-900">عدم دسترسی به مدیریت اطلاعیه‌ها</h2>
        <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
          ایجاد، فعال‌سازی و مدیریت اطلاعیه‌های سراسری منحصراً در اختیار <strong>مسئول آموزش</strong> و <strong>سوپر ادمین</strong> است.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 font-vazir text-right" dir="rtl">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center shrink-0">
            <Megaphone size={24} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900">مدیریت اطلاعیه‌های سامانه</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] font-black tabular-nums">
                {activeCount} اطلاعیه فعال
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              هر اطلاعیه فعال هنگام ورود کاربران به صورت پنجره پاپ‌آپ نمایش داده می‌شود و در بخش زنگوله بالای صفحه نیز قابل مشاهده است.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchAnnouncements(true)}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5 self-start sm:self-center cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>همگام‌سازی</span>
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

      {/* Main Grid: Create/Edit Form + List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Form Card */}
        <form onSubmit={handleSubmit} className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4 h-fit">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              {editingId ? <Edit3 size={16} className="text-amber-600" /> : <Plus size={16} className="text-indigo-600" />}
              <span>{editingId ? 'ویرایش اطلاعیه' : 'ثبت اطلاعیه جدید'}</span>
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                انصراف از ویرایش
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">عنوان اطلاعیه</label>
            <input
              type="text"
              required
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="مثلاً: تغییر برنامه کلاس‌های روز دوشنبه"
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/70 focus:bg-white font-bold text-slate-900"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">متن کامل اطلاعیه</label>
            <textarea
              required
              rows={4}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="جزئیات اطلاعیه برای نمایش به کاربران..."
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/70 focus:bg-white font-medium text-slate-800 leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">مخاطبین هدف</label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value as AnnouncementAudience)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-bold text-slate-800"
              >
                <option value="all">همه کاربران سامانه</option>
                <option value="students">فقط طلاب</option>
                <option value="teachers">فقط اساتید</option>
                <option value="staff">کادر آموزشی و اجرایی</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">درجه اهمیت</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-bold text-slate-800"
              >
                <option value="normal">عادی</option>
                <option value="important">مهم</option>
                <option value="urgent">فوری</option>
              </select>
            </div>
          </div>

          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer select-none">
            <span className="text-xs font-bold text-slate-800">اطلاعیه بلافاصله فعال و منتشر شود</span>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
            />
          </label>

          {/* Mini Preview */}
          {(titleInput.trim() || messageInput.trim()) && (
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-1.5">
              <div className="flex items-center justify-between text-[10.5px] font-black text-indigo-700">
                <span className="flex items-center gap-1">
                  <Sparkles size={12} />
                  <span>پیش‌نمایش پاپ‌آپ</span>
                </span>
                <span>{AUDIENCE_LABELS[targetAudience]}</span>
              </div>
              <div className="text-xs font-black text-slate-900">{titleInput.trim() || 'عنوان اطلاعیه'}</div>
              <p className="text-[11px] text-slate-700 whitespace-pre-line leading-relaxed">
                {messageInput.trim() || 'متن اطلاعیه...'}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? 'در حال ثبت در پایگاه داده...' : editingId ? 'ذخیره تغییرات اطلاعیه' : 'ثبت و ذخیره اطلاعیه'}
          </button>
        </form>

        {/* Announcements List */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900">فهرست اطلاعیه‌های ثبت‌شده</h3>
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
              {([
                { id: 'all', label: `همه (${announcements.length})` },
                { id: 'active', label: `فعال (${activeCount})` },
                { id: 'inactive', label: `غیرفعال (${announcements.length - activeCount})` }
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg transition-all cursor-pointer tabular-nums',
                    statusFilter === tab.id ? 'bg-white text-indigo-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-xs text-slate-400 font-bold">در حال بارگذاری اطلاعیه‌ها...</div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
              <Megaphone size={26} className="mx-auto text-slate-300" />
              <p className="font-bold">هیچ اطلاعیه‌ای در این بخش ثبت نشده است.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAnnouncements.map((item) => {
                const active = item.isActive !== false;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'p-4 rounded-2xl border transition-all space-y-2.5',
                      active ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-50/70 border-slate-200/80 opacity-80'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-black text-slate-900">{item.title}</h4>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-md text-[10px] font-black border',
                              item.priority === 'urgent'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : item.priority === 'important'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            )}
                          >
                            {PRIORITY_LABELS[item.priority || 'normal']}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-100 text-[10px] font-bold flex items-center gap-1">
                            <Users size={11} />
                            <span>{AUDIENCE_LABELS[item.targetAudience || 'all']}</span>
                          </span>
                        </div>
                      </div>

                      <span
                        className={cn(
                          'px-2.5 py-0.5 rounded-full text-[10px] font-black border shrink-0',
                          active
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        )}
                      >
                        {active ? 'فعال' : 'غیرفعال'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                      {item.message}
                    </p>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-[10.5px] text-slate-500">
                      <div className="flex items-center gap-2 flex-wrap tabular-nums">
                        <span>ثبت‌کننده: {item.createdByName || item.createdBy || 'مسئول آموزش'}</span>
                        <span>•</span>
                        <span>{item.createdAt ? new Date(item.createdAt).toLocaleString('fa-IR') : ''}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleToggleActive(item)}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-[11px] font-black border flex items-center gap-1 cursor-pointer disabled:opacity-50',
                            active
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                          )}
                        >
                          {active ? <XCircle size={12} /> : <CheckCircle2 size={12} />}
                          <span>{active ? 'غیرفعال کردن' : 'فعال‌سازی'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleEditClick(item)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 cursor-pointer"
                          title="ویرایش اطلاعیه"
                        >
                          <Edit3 size={13} />
                        </button>

                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => setAnnouncementToDelete(item)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer"
                          title="حذف اطلاعیه"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {announcementToDelete && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isSaving && setAnnouncementToDelete(null)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4 text-right font-vazir"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                <Trash2 size={18} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-slate-900">حذف اطلاعیه</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  آیا از حذف اطلاعیه «<strong>{announcementToDelete.title}</strong>» اطمینان دارید؟
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setAnnouncementToDelete(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleDeleteConfirmed}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'در حال حذف...' : 'بله، حذف شود'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
