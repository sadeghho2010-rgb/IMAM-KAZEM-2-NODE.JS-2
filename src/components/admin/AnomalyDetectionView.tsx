import React, { useState, useEffect } from 'react';
import { AnomalyLog, AnomalySeverity } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { 
  ShieldAlert, 
  RotateCcw, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  User, 
  Database, 
  Code, 
  Eye, 
  X, 
  Loader2, 
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export default function AnomalyDetectionView() {
  const { currentUser, isSuperAdmin } = useAuth();
  const [anomalies, setAnomalies] = useState<AnomalyLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'unresolved' | 'resolved'>('all');
  const [selectedAnomalyForModal, setSelectedAnomalyForModal] = useState<AnomalyLog | null>(null);
  const [isRollbackLoading, setIsRollbackLoading] = useState(false);
  const [rollbackSuccessMsg, setRollbackSuccessMsg] = useState<string | null>(null);
  const [rollbackErrorMsg, setRollbackErrorMsg] = useState<string | null>(null);

  const fetchAnomalies = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/anomalies', {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.anomalies)) {
        setAnomalies(data.anomalies);
      }
    } catch (e) {
      console.warn('Error fetching anomalies:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
  }, []);

  const handleExecuteRollback = async (anomaly: AnomalyLog) => {
    if (!confirm(`آیا از بازگردانی خودکار (Rollback) عملیات ${anomaly.action_type} به حالت امن پیشین اطمینان دارید؟`)) {
      return;
    }

    setIsRollbackLoading(true);
    setRollbackSuccessMsg(null);
    setRollbackErrorMsg(null);

    try {
      const res = await fetch('/api/anomalies/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ anomalyId: anomaly.id })
      });
      const data = await res.json();
      setIsRollbackLoading(false);

      if (res.ok && data.success) {
        setRollbackSuccessMsg(data.message || 'بازگردانی با موفقیت انجام شد.');
        setSelectedAnomalyForModal(null);
        fetchAnomalies();
        setTimeout(() => setRollbackSuccessMsg(null), 5000);
      } else {
        setRollbackErrorMsg(data.message || 'خطا در بازگردانی رولبک.');
      }
    } catch (err: any) {
      setIsRollbackLoading(false);
      setRollbackErrorMsg(err?.message || 'خطا در ارتباط با سرور رولبک.');
    }
  };

  const filteredList = anomalies.filter(item => {
    const matchesSearch = 
      (item.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.detection_reason || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.user_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.action_type || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeverity = selectedSeverity === 'all' || item.severity === selectedSeverity;
    const matchesStatus = 
      selectedStatus === 'all' || 
      (selectedStatus === 'unresolved' && !item.is_resolved) ||
      (selectedStatus === 'resolved' && item.is_resolved);

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const getSeverityBadge = (severity: AnomalySeverity) => {
    switch (severity) {
      case 'critical':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">بحرانی (Critical)</span>;
      case 'high':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">بالا (High)</span>;
      case 'medium':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">متوسط (Medium)</span>;
      case 'low':
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">عادی (Low)</span>;
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-vazir" dir="rtl">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shadow-xs">
            <ShieldAlert size={26} />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900">سامانه هوشمند تشخیص ناهنجاری‌ها و رولبک (Anomaly Detection)</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              مانیتورینگ تغییرات غیرعادی مالی، ویرایش‌های با حجم بالا و امکان بازگردانی فوری به وضعیت امن
            </p>
          </div>
        </div>

        <button
          onClick={fetchAnomalies}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          <span>بروزرسانی داده‌ها</span>
        </button>
      </div>

      {/* Notifications */}
      {rollbackSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2 shadow-xs">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{rollbackSuccessMsg}</span>
        </div>
      )}

      {rollbackErrorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-2 shadow-xs">
          <AlertTriangle size={18} className="text-rose-600 shrink-0" />
          <span>{rollbackErrorMsg}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute right-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در علت، توضیحات، کاربر یا جدول..."
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-indigo-400 outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
          >
            <option value="all">همه سطوح شدت</option>
            <option value="critical">🔴 بحرانی (Critical)</option>
            <option value="high">🟠 بالا (High)</option>
            <option value="medium">🔵 متوسط (Medium)</option>
            <option value="low">⚪ عادی (Low)</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="unresolved">⚠️ نیازمند بررسی / بازگردانی</option>
            <option value="resolved">✅ رولبک‌شده و مختومه</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
            <Loader2 size={28} className="animate-spin text-indigo-500" />
            <span className="text-xs font-semibold">در حال دریافت و تحلیل لاگ‌های ناهنجاری...</span>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
            <CheckCircle2 size={32} className="text-emerald-500" />
            <p className="text-sm font-bold text-slate-700">هیچ رویداد ناهنجاری یافت نشد.</p>
            <p className="text-xs text-slate-400">تمام عملیات سیستمی در شرایط امن و مجاز صورت گرفته است.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">شدت رویداد</th>
                  <th className="py-3.5 px-4">نوع عملیات و جدول</th>
                  <th className="py-3.5 px-4">علت کشف ناهنجاری</th>
                  <th className="py-3.5 px-4">کاربر اقدام‌کننده</th>
                  <th className="py-3.5 px-4">زمان وقوع</th>
                  <th className="py-3.5 px-4">وضعیت</th>
                  <th className="py-3.5 px-4 text-center">عملیات بازگردانی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">{getSeverityBadge(item.severity)}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{item.action_type}</td>
                    <td className="py-3 px-4 font-semibold text-slate-700 max-w-xs truncate" title={item.detection_reason}>
                      {item.detection_reason}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">{item.user_name}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(item.created_at).toLocaleString('fa-IR')}
                    </td>
                    <td className="py-3 px-4">
                      {item.is_resolved ? (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold">
                          مختومه (توسط {item.resolved_by})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-[10px] font-bold">
                          نیازمند بررسی
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedAnomalyForModal(item)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                          title="مشاهده جزئیات و داده‌های قبل از تغییر"
                        >
                          <Eye size={13} />
                          <span>جزئیات</span>
                        </button>

                        {!item.is_resolved && (
                          <button
                            type="button"
                            onClick={() => handleExecuteRollback(item)}
                            disabled={isRollbackLoading}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                            title="بازگردانی به حالت امن"
                          >
                            <RotateCcw size={13} />
                            <span>رولبک</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail & Rollback Modal */}
      <AnimatePresence>
        {selectedAnomalyForModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-2xl border border-slate-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
                    <ShieldAlert size={18} />
                  </div>
                  <h3 className="text-sm font-black text-slate-900">جزئیات رویداد ناهنجاری و وضعیت پیشین</h3>
                </div>
                <button
                  onClick={() => setSelectedAnomalyForModal(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                  <span className="text-slate-400 font-bold block text-[10px]">علت تشخیص:</span>
                  <p className="font-bold text-slate-800">{selectedAnomalyForModal.detection_reason}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                  <span className="text-slate-400 font-bold block text-[10px]">کاربر و زمان:</span>
                  <p className="font-bold text-slate-800">
                    {selectedAnomalyForModal.user_name} • {new Date(selectedAnomalyForModal.created_at).toLocaleString('fa-IR')}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  داده‌های پیشین ذخیره‌شده (Original State JSON):
                </label>
                <pre className="p-3.5 bg-slate-900 text-emerald-400 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-60 dir-ltr text-left">
                  {JSON.stringify(selectedAnomalyForModal.original_state, null, 2)}
                </pre>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedAnomalyForModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  بستن
                </button>

                {!selectedAnomalyForModal.is_resolved && (
                  <button
                    type="button"
                    onClick={() => handleExecuteRollback(selectedAnomalyForModal)}
                    disabled={isRollbackLoading}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-rose-600/20"
                  >
                    {isRollbackLoading ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                    <span>اجرای بازگردانی به وضعیت امن (Rollback)</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
