import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Activity, 
  RefreshCw, 
  Search, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  Terminal, 
  Filter,
  X
} from 'lucide-react';

export default function LogViewer() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [copiedTraceId, setCopiedTraceId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const { data, error } = await supabase
        .from('app_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        // If table doesn't exist yet, show friendly notification
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          setErrorMsg('جدول app_logs هنوز در Supabase ساخته نشده است. لطفاً فایل schema.sql را در SQL Editor سوپابیس اجرا کنید.');
        } else {
          setErrorMsg(error.message);
        }
        setLogs([]);
      } else {
        setLogs(data || []);
      }
    } catch (err) {
      setErrorMsg(err.message || 'خطا در دریافت لاگ‌ها');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleCopyTraceId = (traceId, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(traceId);
    setCopiedTraceId(traceId);
    setTimeout(() => setCopiedTraceId(null), 2000);
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesLevel = levelFilter === 'all' || log.level?.toLowerCase() === levelFilter.toLowerCase();
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        !q || 
        (log.message && log.message.toLowerCase().includes(q)) || 
        (log.trace_id && log.trace_id.toLowerCase().includes(q)) ||
        (log.path && log.path.toLowerCase().includes(q));

      return matchesLevel && matchesSearch;
    });
  }, [logs, levelFilter, searchQuery]);

  const getLevelBadge = (level) => {
    const lvl = (level || 'error').toLowerCase();
    if (lvl === 'error') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200">
          <AlertCircle size={13} className="text-rose-600 shrink-0" />
          ERROR
        </span>
      );
    }
    if (lvl === 'warn') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle size={13} className="text-amber-600 shrink-0" />
          WARN
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-sky-50 text-sky-700 border border-sky-200">
        <Info size={13} className="text-sky-600 shrink-0" />
        INFO
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 font-vazir" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Terminal className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">مرکز مانیتورینگ و لاگ‌های سیستم (App Logs)</h1>
              <p className="text-xs text-slate-300 font-medium">
                مشاهده لحظه‌ای خطاهای فرانتاند، استک تریس و وضعیت درخواست‌های کلاینت به تفکیک Trace ID
              </p>
            </div>
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>بروزرسانی لاگ‌ها</span>
          </button>
        </div>
      </div>

      {/* Error / Notice message */}
      {errorMsg && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-amber-700 hover:text-amber-900">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در پیام خطا، Trace ID یا مسیر..."
            className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-bold"
          />
        </div>

        {/* Level Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs text-slate-400 font-bold shrink-0 flex items-center gap-1">
            <Filter size={13} />
            <span>سطح:</span>
          </span>
          {[
            { id: 'all', label: 'همه' },
            { id: 'error', label: 'خطا (Error)' },
            { id: 'warn', label: 'هشدار (Warn)' },
            { id: 'info', label: 'اطلاعات (Info)' }
          ].map((lvl) => (
            <button
              key={lvl.id}
              onClick={() => setLevelFilter(lvl.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                levelFilter === lvl.id
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {lvl.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table / List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
            <p className="text-xs font-bold">در حال بارگذاری لاگ‌ها از دیتابیس...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Activity className="w-10 h-10 mx-auto opacity-30 text-slate-500" />
            <p className="text-xs font-bold">هیچ لاگی منطبق بر فیلترهای جستجو یافت نشد.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const hasDetails = Boolean(log.stack_trace || (log.context && Object.keys(log.context).length > 0));

              return (
                <div key={log.id} className="p-4 hover:bg-slate-50/70 transition-colors">
                  <div
                    onClick={() => hasDetails && setExpandedLogId(isExpanded ? null : log.id)}
                    className={`flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                      hasDetails ? 'cursor-pointer' : ''
                    }`}
                  >
                    <div className="flex items-start md:items-center gap-3 min-w-0">
                      <div className="shrink-0 pt-0.5 md:pt-0">
                        {getLevelBadge(log.level)}
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="text-xs font-black text-slate-800 leading-snug break-words">
                          {log.message}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono">
                          {log.path && (
                            <span className="text-indigo-600 font-semibold truncate max-w-xs">
                              {log.path}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={(e) => handleCopyTraceId(log.trace_id, e)}
                            className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md font-mono text-[10px] transition-colors"
                            title="کپی Trace ID"
                          >
                            {copiedTraceId === log.trace_id ? (
                              <Check size={11} className="text-emerald-600" />
                            ) : (
                              <Copy size={11} />
                            )}
                            <span>{log.trace_id?.substring(0, 13)}...</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                      <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                        <Clock size={12} />
                        <span>{formatDate(log.created_at)}</span>
                      </div>

                      {hasDetails && (
                        <div className="text-slate-400">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Accordion Details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-200/80 space-y-3 text-xs">
                      {log.context && Object.keys(log.context).length > 0 && (
                        <div>
                          <span className="text-[11px] font-bold text-slate-500 block mb-1">
                            Context (داده‌های زمینه و ماسک‌شده):
                          </span>
                          <pre
                            dir="ltr"
                            className="p-3 bg-slate-900 text-emerald-400 rounded-2xl overflow-x-auto text-[11px] font-mono leading-relaxed"
                          >
                            {JSON.stringify(log.context, null, 2)}
                          </pre>
                        </div>
                      )}

                      {log.stack_trace && (
                        <div>
                          <span className="text-[11px] font-bold text-slate-500 block mb-1">
                            Stack Trace (ردیابی پشته خطا):
                          </span>
                          <pre
                            dir="ltr"
                            className="p-3 bg-slate-950 text-rose-300 rounded-2xl overflow-x-auto text-[11px] font-mono leading-relaxed whitespace-pre-wrap"
                          >
                            {log.stack_trace}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
