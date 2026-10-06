import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  Download,
  Calendar,
  Clock,
  User,
  Database,
  FileText,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  Info
} from 'lucide-react';

interface AuditLogItem {
  id: string;
  action: string;
  collection_name?: string;
  record_id?: string;
  user_id?: string;
  user_name?: string;
  user_role?: string;
  details?: any;
  ip_address?: string;
  status: 'success' | 'failed' | 'error';
  error_message?: string;
  created_at: string;
}

interface AuditStats {
  total: number;
  today: number;
  errors: number;
  successRate: number;
  actions: { action: string; count: number }[];
}

export const SystemLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [limit, setLimit] = useState(50);
  const [page, setPage] = useState(1);

  // Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') ||
                    localStorage.getItem('auth_access_token') || sessionStorage.getItem('auth_access_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const offset = (page - 1) * limit;
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset)
      });

      if (actionFilter) params.append('action', actionFilter);
      if (collectionFilter) params.append('collection', collectionFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);

      const [logsRes, statsRes] = await Promise.all([
        fetch(`/api/audit/logs?${params.toString()}`, { headers, credentials: 'include' }),
        fetch('/api/audit/stats', { headers, credentials: 'include' })
      ]);

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        if (logsData.success) {
          setLogs(logsData.items || []);
          setTotalLogs(logsData.total || 0);
        }
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.success) {
          setStats(statsData.stats);
        }
      }
    } catch (err: any) {
      console.error('Error loading audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, actionFilter, collectionFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh timer every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      fetchLogs();
    }, 30000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchLogs]);

  const handleCleanup = async () => {
    if (!window.confirm('آیا از پاکسازی لاگ‌های قدیمی‌تر از ۳۰ روز اطمینان دارید؟')) return;

    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/audit/cleanup', {
        method: 'POST',
        headers,
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionNotice({ type: 'success', msg: data.message || 'پاکسازی لاگ‌ها انجام شد.' });
        fetchLogs();
      } else {
        setActionNotice({ type: 'error', msg: data.message || 'خطا در پاکسازی لاگ‌ها' });
      }
    } catch (e: any) {
      setActionNotice({ type: 'error', msg: 'خطا در برقراری ارتباط با سرور' });
    }
  };

  const exportToCSV = () => {
    if (logs.length === 0) return;

    const headers = ['شناسه', 'عملیات', 'کالکشن', 'شناسه رکورد', 'کاربر', 'نقش', 'وضعیت', 'آدرس IP', 'تاریخ'];
    const rows = logs.map(l => [
      l.id,
      l.action,
      l.collection_name || '-',
      l.record_id || '-',
      l.user_name || l.user_id || '-',
      l.user_role || '-',
      l.status === 'success' ? 'موفق' : 'خطا',
      l.ip_address || '-',
      new Date(l.created_at).toLocaleString('fa-IR')
    ]);

    const csvContent = '\uFEFF' + [headers, ...rows].map(e => e.map(val => `"${val}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `system_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getActionBadge = (action: string) => {
    switch (action.toLowerCase()) {
      case 'insert':
        return <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">ایجاد رکورد</span>;
      case 'update':
        return <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-200">ویرایش رکورد</span>;
      case 'delete':
        return <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200">حذف رکورد</span>;
      case 'login':
        return <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">ورود به سیستم</span>;
      case 'login_failed':
        return <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-amber-50 text-amber-700 border border-amber-200">ورود ناموفق</span>;
      case 'logout':
        return <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-slate-100 text-slate-700 border border-slate-200">خروج</span>;
      default:
        return <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-600">{action}</span>;
    }
  };

  const totalPages = Math.ceil(totalLogs / limit) || 1;

  return (
    <div className="space-y-6 dir-rtl text-right font-sans">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Activity size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900">لاگ‌ها و پایش فعالیت‌های سیستم</h1>
            <p className="text-xs text-slate-500 font-medium">ثبت و شفاف‌سازی تمام عملیات دیتابیس، ورودها و تغییرات سامانه</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              autoRefresh
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            <Clock size={14} className={autoRefresh ? 'animate-spin' : ''} />
            <span>{autoRefresh ? 'به‌روزرسانی خودکار (۳۰ث)' : 'به‌روزرسانی دستی'}</span>
          </button>

          {/* Refresh Now */}
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>بازخوانی</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={exportToCSV}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download size={14} />
            <span>خروجی CSV</span>
          </button>

          {/* Cleanup */}
          <button
            onClick={handleCleanup}
            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="پاکسازی لاگ‌های قدیمی‌تر از ۳۰ روز"
          >
            <Trash2 size={14} />
            <span>پاکسازی ۳۰ روزه</span>
          </button>
        </div>
      </div>

      {/* Action Notice Alert */}
      {actionNotice && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <span>{actionNotice.msg}</span>
          <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
        </div>
      )}

      {/* Stats Summary Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
              <span>کل لاگ‌های ثبت‌شده</span>
              <FileText size={18} className="text-indigo-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono">{stats.total.toLocaleString('fa-IR')}</div>
            <p className="text-[11px] text-slate-400 font-medium">از ابتدای راه‌اندازی یا آخرین پاکسازی</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
              <span>فعالیت‌های امروز</span>
              <Calendar size={18} className="text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-700 font-mono">{stats.today.toLocaleString('fa-IR')}</div>
            <p className="text-[11px] text-emerald-600 font-medium">عملیات دیتابیس و ورودها در ۲۴ ساعت گذشته</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
              <span>خطاها و شکست‌ها</span>
              <AlertTriangle size={18} className="text-rose-500" />
            </div>
            <div className="text-2xl font-black text-rose-600 font-mono">{stats.errors.toLocaleString('fa-IR')}</div>
            <p className="text-[11px] text-rose-500 font-medium">ورودهای ناموفق یا استثناهای MySQL</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
              <span>نرخ سلامت عملیات</span>
              <CheckCircle2 size={18} className="text-indigo-500" />
            </div>
            <div className="text-2xl font-black text-indigo-700 font-mono">٪{stats.successRate}</div>
            <p className="text-[11px] text-indigo-600 font-medium">درصد پایداری تراکنش‌های ثبت‌شده</p>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-black text-slate-800 border-b border-slate-100 pb-3">
          <Filter size={16} className="text-indigo-600" />
          <span>فیلتر و جستجوی پیشرفته</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* Action Filter */}
          <div>
            <label className="block text-slate-600 font-bold mb-1">نوع عملیات:</label>
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none text-slate-800"
            >
              <option value="">همه عملیات‌ها</option>
              <option value="insert">ایجاد رکورد (INSERT)</option>
              <option value="update">ویرایش رکورد (UPDATE)</option>
              <option value="delete">حذف رکورد (DELETE)</option>
              <option value="login">ورود به سیستم (LOGIN)</option>
              <option value="login_failed">ورود ناموفق (FAILED)</option>
              <option value="logout">خروج از سیستم (LOGOUT)</option>
            </select>
          </div>

          {/* Collection Filter */}
          <div>
            <label className="block text-slate-600 font-bold mb-1">نام کالکشن / جدول:</label>
            <input
              type="text"
              placeholder="مثلاً: students, classrooms"
              value={collectionFilter}
              onChange={(e) => { setCollectionFilter(e.target.value); setPage(1); }}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none text-slate-800"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-slate-600 font-bold mb-1">وضعیت اجرای تراکنش:</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none text-slate-800"
            >
              <option value="">همه وضعیت‌ها</option>
              <option value="success">فقط تراکنش‌های موفق</option>
              <option value="error">فقط دارای خطا / شکست</option>
            </select>
          </div>

          {/* Search Input */}
          <div>
            <label className="block text-slate-600 font-bold mb-1">جستجو در متن و شناسه:</label>
            <div className="relative">
              <input
                type="text"
                placeholder="نام کاربر، شناسه، یا خطا..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full p-2.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none text-slate-800"
              />
              <Search size={14} className="absolute right-2.5 top-3 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Audit Logs Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50/80 text-slate-600 font-black border-b border-slate-100">
              <tr>
                <th className="p-4">زمان ثبت</th>
                <th className="p-4">عملیات</th>
                <th className="p-4">کالکشن / جدول</th>
                <th className="p-4">کاربر مجری</th>
                <th className="p-4">آدرس IP</th>
                <th className="p-4">وضعیت</th>
                <th className="p-4 text-center">جزئیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 font-medium">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
                    در حال بارگذاری لاگ‌های سیستم...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 font-medium">
                    <Info size={28} className="mx-auto mb-2 text-slate-300" />
                    هیچ لاگی با فیلترهای انتخابی یافت نشد.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-mono text-slate-600 dir-ltr text-right">
                      {new Date(log.created_at).toLocaleString('fa-IR')}
                    </td>

                    <td className="p-4">
                      {getActionBadge(log.action)}
                    </td>

                    <td className="p-4 font-mono font-bold text-slate-800">
                      {log.collection_name ? (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {log.collection_name}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    <td className="p-4">
                      <div className="font-bold text-slate-900">{log.user_name || log.user_id || 'سیستم/ناشناس'}</div>
                      {log.user_role && (
                        <div className="text-[10px] text-slate-400 font-medium">{log.user_role}</div>
                      )}
                    </td>

                    <td className="p-4 font-mono text-slate-500 dir-ltr text-right">
                      {log.ip_address || '127.0.0.1'}
                    </td>

                    <td className="p-4">
                      {log.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={12} />
                          موفق
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle size={12} />
                          خطا
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-center">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 font-bold text-[11px]"
                        title="مشاهده کامل رکورد"
                      >
                        <Eye size={14} />
                        <span>مشاهده</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="font-medium">
            نمایش {logs.length > 0 ? (page - 1) * limit + 1 : 0} تا {Math.min(page * limit, totalLogs)} از مجموع <strong className="font-mono font-bold text-slate-900">{totalLogs}</strong> لاگ
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>

            <span className="font-bold font-mono">
              صفحه {page} از {totalPages}
            </span>

            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-2xl border border-slate-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Activity size={20} className="text-indigo-600" />
                <h3 className="text-sm font-black text-slate-900">جزئیات کامل لاگ تراکنش #{selectedLog.id}</h3>
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer text-sm font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block mb-0.5">نوع عملیات:</span>
                  <strong className="text-slate-800">{selectedLog.action}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">جدول/کالکشن:</span>
                  <strong className="text-slate-800">{selectedLog.collection_name || 'نامشخص'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">کاربر مجری:</span>
                  <strong className="text-slate-800">{selectedLog.user_name || selectedLog.user_id || 'سیستم'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">آدرس IP:</span>
                  <strong className="text-slate-800 font-mono">{selectedLog.ip_address || '127.0.0.1'}</strong>
                </div>
              </div>

              {selectedLog.error_message && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-2xl space-y-1">
                  <span className="font-bold block">متن خطای صادر شده:</span>
                  <p className="font-mono leading-relaxed">{selectedLog.error_message}</p>
                </div>
              )}

              <div>
                <span className="font-bold text-slate-700 block mb-1">داده‌ها و جزئیات ذخیره‌شده (JSON):</span>
                <pre className="bg-slate-900 text-emerald-400 p-4 rounded-2xl font-mono text-[11px] leading-relaxed overflow-x-auto dir-ltr text-left">
                  {selectedLog.details ? JSON.stringify(selectedLog.details, null, 2) : '// بدون جزییات 추가'}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemLogs;
