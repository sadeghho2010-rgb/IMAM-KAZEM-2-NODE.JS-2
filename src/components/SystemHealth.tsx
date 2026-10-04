import React, { useState, useEffect, useCallback } from 'react';
import { 
  HeartPulse, 
  RefreshCw, 
  Clock, 
  Cpu, 
  Database, 
  AlertTriangle, 
  Terminal, 
  Server, 
  Zap, 
  Activity, 
  Play, 
  Pause 
} from 'lucide-react';

interface MemorySnapshot {
  timestamp: string;
  heapUsedMb: number;
  heapTotalMb: number;
  rssMb: number;
  externalMb: number;
  freeOsMemInfo?: string;
}

interface SlowQueryLog {
  timestamp: string;
  collection: string;
  durationMs: number;
  querySnippet: string;
}

interface ServerErrorLog {
  timestamp: string;
  message: string;
  stack?: string;
  source?: string;
}

interface HealthData {
  currentMemory: {
    heapUsedMb: number;
    heapTotalMb: number;
    rssMb: number;
    externalMb: number;
    heapUsagePercent: number;
    freeOsMemInfo?: string;
  };
  peakHeap24hMb: number;
  memoryHistory: MemorySnapshot[];
  slowQueries: SlowQueryLog[];
  recentErrors: ServerErrorLog[];
  uptimeSeconds: number;
  nodeVersion: string;
  environment: string;
  timestamp: string;
}

export default function SystemHealth() {
  const [data, setData] = useState<HealthData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [selectedQuery, setSelectedQuery] = useState<SlowQueryLog | null>(null);
  const [selectedError, setSelectedError] = useState<ServerErrorLog | null>(null);

  const fetchHealthData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
      const response = await fetch('/api/system/health', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('شما مجاز به مشاهده سلامت سیستم نیستید. دسترسی فقط برای مدیران ارشد مجاز است.');
        }
        throw new Error(`خطای سرور: کد وضعیت ${response.status}`);
      }
      
      const json = await response.json();
      if (json.success) {
        setData(json);
      } else {
        throw new Error(json.message || 'خطا در بارگذاری اطلاعات سلامت سیستم');
      }
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message || 'اتصال با سرور برقرار نشد.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealthData();
  }, [fetchHealthData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchHealthData();
    }, 30000); // 30 seconds auto-refresh
    return () => clearInterval(interval);
  }, [autoRefresh, fetchHealthData]);

  // Format uptime into days, hours, minutes, seconds
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days} روز`);
    if (hours > 0) parts.push(`${hours} ساعت`);
    if (minutes > 0) parts.push(`${minutes} دقیقه`);
    parts.push(`${secs} ثانیه`);

    return parts.join(' و ');
  };

  const formatTime = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return 'N/A';
    }
  };

  const formatDate = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' - ' + formatTime(isoString);
    } catch {
      return 'N/A';
    }
  };

  // Pure SVG memory graph renderer
  const renderMemoryGraph = (history: MemorySnapshot[]) => {
    if (!history || history.length < 2) {
      return (
        <div className="h-48 flex items-center justify-center text-slate-400 font-bold bg-slate-50 rounded-2xl border border-slate-100">
          داده‌های تاریخچه کافی نیست (در حال جمع‌آوری داده‌ها...)
        </div>
      );
    }

    const width = 800;
    const height = 180;
    const padding = 20;

    const maxHeap = Math.max(...history.map(h => h.heapUsedMb)) * 1.2 || 100;
    const minHeap = Math.min(...history.map(h => h.heapUsedMb)) * 0.8 || 0;
    const range = maxHeap - minHeap;

    const points = history.map((snapshot, index) => {
      const x = padding + (index / (history.length - 1)) * (width - 2 * padding);
      const ratio = range > 0 ? (snapshot.heapUsedMb - minHeap) / range : 0.5;
      const y = height - padding - ratio * (height - 2 * padding);
      return { x, y, val: snapshot.heapUsedMb, time: formatTime(snapshot.timestamp) };
    });

    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaData = `${pathData} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return (
      <div className="relative bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="text-indigo-600" size={18} />
            <h3 className="font-black text-slate-800 text-sm">نمودار تغییرات مصرف رم (Heap) در ۲۴ ساعت اخیر</h3>
          </div>
          <div className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
            حداکثر: {Math.max(...history.map(h => h.heapUsedMb)).toFixed(1)} MB
          </div>
        </div>
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[600px]">
            {/* Grid Lines */}
            <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#f1f5f9" strokeDasharray="3" />
            <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#f1f5f9" strokeDasharray="3" />
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e2e8f0" />

            {/* Filled Area under Curve */}
            <path d={areaData} fill="url(#grad)" opacity="0.1" />

            {/* Line Curve */}
            <path d={pathData} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            {/* Markers on Points (sampled if too many) */}
            {points.map((p, i) => (
              (i === 0 || i === points.length - 1 || i % 12 === 0) && (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r="4" fill="#4f46e5" stroke="#ffffff" strokeWidth="1.5" />
                  <text x={p.x} y={height - 2} fill="#64748b" fontSize="8" fontWeight="bold" textAnchor="middle">
                    {p.time}
                  </text>
                  <text x={p.x} y={p.y - 8} fill="#1e293b" fontSize="8" fontWeight="black" textAnchor="middle">
                    {p.val.toFixed(0)}M
                  </text>
                </g>
              )
            ))}

            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#4f46e5" />
                <stop offset="100%" stopColor="#ffffff" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold mt-2 border-t border-slate-100 pt-2" dir="rtl">
          <span>داده‌ها هر ۱۰ دقیقه ذخیره می‌شوند. تعداد نمونه‌های فعال: {history.length}</span>
          <span>منحنی نمایشگر حافظه فعال موتور V8 است.</span>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* Header Panel */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-200">
            <HeartPulse size={24} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">سامانه پایش سلامت و عملکرد سیستم</h2>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              مانیتورینگ منابع سخت‌افزاری سرور، بررسی کوئری‌های کند دیتابیس و مدیریت استثناهای زنده
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh Info */}
          <div className="text-right shrink-0">
            <div className="text-[10px] text-slate-400 font-bold">آخرین به روزرسانی</div>
            <div className="text-xs text-slate-600 font-black" dir="ltr">
              {lastRefreshed.toLocaleTimeString('fa-IR')}
            </div>
          </div>

          {/* Refresh Action */}
          <button 
            onClick={fetchHealthData}
            disabled={isLoading}
            className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-2xl transition-all duration-200 shadow-sm flex items-center gap-2 disabled:opacity-50"
            title="بروزرسانی لحظه‌ای"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all duration-200 border flex items-center gap-1.5 shadow-sm ${
              autoRefresh 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {autoRefresh ? <Play size={14} className="animate-spin" /> : <Pause size={14} />}
            {autoRefresh ? 'بروزرسانی خودکار فعال (۳۰ ثانیه)' : 'بروزرسانی خودکار غیرفعال'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-5 text-rose-800 text-sm font-bold flex items-center gap-3">
          <AlertTriangle className="text-rose-500 shrink-0" size={24} />
          <div>{error}</div>
        </div>
      )}

      {isLoading && !data ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="animate-spin text-rose-600" size={36} />
          <span className="text-sm font-black text-slate-600">در حال دریافت داده‌های زنده و سیستم لاگ سرور...</span>
        </div>
      ) : data ? (
        <>
          {/* Key Resource Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Current Memory Usage */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-500">مصرف زنده رم (Heap)</span>
                <Cpu className="text-indigo-600" size={18} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-slate-900">{data.currentMemory.heapUsedMb.toFixed(1)}</span>
                <span className="text-xs text-slate-400 font-bold">MB</span>
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                  <span>کل تخصیص داده شده</span>
                  <span>{data.currentMemory.heapTotalMb.toFixed(1)} MB</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      data.currentMemory.heapUsagePercent > 80 
                        ? 'bg-rose-500' 
                        : data.currentMemory.heapUsagePercent > 60 
                        ? 'bg-amber-500' 
                        : 'bg-indigo-600'
                    }`}
                    style={{ width: `${Math.min(data.currentMemory.heapUsagePercent, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Peak Memory Usage */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-500">حداکثر مصرف (۲۴ ساعت)</span>
                <Server className="text-rose-600" size={18} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-slate-900">{data.peakHeap24hMb.toFixed(1)}</span>
                <span className="text-xs text-slate-400 font-bold">MB</span>
              </div>
              <div className="text-[10px] text-slate-500 font-bold leading-normal border-t border-slate-50 pt-2">
                مکانیزم PM2 در صورت رسیدن به حد آستانه (۷۰۰ مگابایت) سرور را به‌طور ایمن بازنشانی خواهد کرد.
              </div>
            </div>

            {/* System Uptime */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-500">آپتایم مداوم سرور</span>
                <Clock className="text-emerald-600" size={18} />
              </div>
              <div className="text-sm font-black text-slate-800 leading-relaxed pt-1">
                {formatUptime(data.uptimeSeconds)}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-black border-t border-slate-50 pt-1.5">
                <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full">فعال</span>
                <span>نسخه: Node {data.nodeVersion}</span>
              </div>
            </div>

            {/* System Quality Indicators */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-500">کیفیت اجرایی سامانه</span>
                <Zap className="text-amber-500" size={18} />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="bg-slate-50 rounded-2xl p-2 border border-slate-100 text-center">
                  <div className="text-[10px] text-slate-400 font-bold">کوئری‌های کند</div>
                  <div className={`text-base font-black ${data.slowQueries.length > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                    {data.slowQueries.length} عدد
                  </div>
                </div>
                <div className="bg-slate-50 rounded-2xl p-2 border border-slate-100 text-center">
                  <div className="text-[10px] text-slate-400 font-bold">خطاهای ثبت شده</div>
                  <div className={`text-base font-black ${data.recentErrors.length > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                    {data.recentErrors.length} مورد
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Memory Usage Trend Graph */}
          {renderMemoryGraph(data.memoryHistory)}

          {/* OS RAM Diagnostic */}
          {data.currentMemory.freeOsMemInfo && (
            <div className="bg-slate-800 text-slate-100 rounded-3xl p-5 border border-slate-700 shadow-sm space-y-2">
              <div className="flex items-center gap-2 border-b border-slate-700 pb-2 mb-2">
                <Terminal size={16} className="text-emerald-400" />
                <span className="text-xs font-black text-slate-300">خروجی تشخیص حافظه سیستم عامل (free -h)</span>
              </div>
              <pre className="text-xs font-mono whitespace-pre overflow-x-auto text-emerald-300 bg-slate-900 p-4 rounded-2xl" dir="ltr">
                {data.currentMemory.freeOsMemInfo}
              </pre>
            </div>
          )}

          {/* Two Columns for Slow Queries & Server Errors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Slow Queries List */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="text-amber-500" size={18} />
                  <h3 className="font-black text-slate-800 text-sm">لیست کوئری‌های کند اخیر دیتابیس (&gt; ۱ ثانیه)</h3>
                </div>
                <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                  حداکثر ۲۰ مورد مانیتور شده
                </span>
              </div>

              <div className="flex-1 overflow-x-auto max-h-[400px]">
                {data.slowQueries.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 font-bold text-xs">
                    خوشبختانه هیچ کوئری کندی در دیتابیس ثبت نگردیده است.
                  </div>
                ) : (
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-black uppercase sticky top-0">
                      <tr>
                        <th className="p-3">زمان</th>
                        <th className="p-3">جدول / کالکشن</th>
                        <th className="p-3 text-left">مدت زمان (ms)</th>
                        <th className="p-3 text-center">جزئیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                      {data.slowQueries.map((q, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 text-slate-400 text-[10px]">{formatTime(q.timestamp)}</td>
                          <td className="p-3">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono text-[10px]">
                              {q.collection}
                            </span>
                          </td>
                          <td className="p-3 text-left text-amber-600 font-black" dir="ltr">
                            {q.durationMs.toLocaleString('fa-IR')} ms
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => setSelectedQuery(q)}
                              className="text-indigo-600 hover:text-indigo-900 hover:underline text-[10px]"
                            >
                              مشاهده SQL
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* 2. System Errors List */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="text-rose-600" size={18} />
                  <h3 className="font-black text-slate-800 text-sm">گزارش خطاها و هشدارهای اخیر سیستم (logs/error.log)</h3>
                </div>
                <span className="text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                  حداکثر ۲۰ خطای اخیر
                </span>
              </div>

              <div className="flex-1 overflow-x-auto max-h-[400px]">
                {data.recentErrors.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 font-bold text-xs">
                    موردی از خطاهای سیستمی ثبت نگردیده است.
                  </div>
                ) : (
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-black uppercase sticky top-0">
                      <tr>
                        <th className="p-3">زمان</th>
                        <th className="p-3">بخش / ریشه</th>
                        <th className="p-3">پیام خطا</th>
                        <th className="p-3 text-center">جزئیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                      {data.recentErrors.map((err, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 text-slate-400 text-[10px] whitespace-nowrap">{formatTime(err.timestamp)}</td>
                          <td className="p-3">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px]">
                              {err.source}
                            </span>
                          </td>
                          <td className="p-3 text-rose-600 line-clamp-1 max-w-[200px]" title={err.message}>
                            {err.message}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => setSelectedError(err)}
                              className="text-indigo-600 hover:text-indigo-900 hover:underline text-[10px]"
                            >
                              مشاهده کامل
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* Query Detail Modal */}
      {selectedQuery && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-2xl w-full overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h4 className="font-black text-slate-900 text-sm">جزئیات کوئری کند دیتابیس</h4>
              <button 
                onClick={() => setSelectedQuery(null)}
                className="w-8 h-8 bg-slate-200 text-slate-600 font-black rounded-full flex items-center justify-center hover:bg-slate-300"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs font-black">
                <div>
                  <span className="text-slate-400 block mb-0.5">جدول هدف:</span>
                  <span className="text-slate-800 bg-slate-100 px-2 py-1 rounded-md">{selectedQuery.collection}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">مدت زمان اجرا:</span>
                  <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded-md" dir="ltr">{selectedQuery.durationMs} ms</span>
                </div>
              </div>
              <div>
                <span className="text-xs font-black text-slate-400 block mb-1">دستور SQL اجرا شده:</span>
                <pre className="text-[11px] font-mono whitespace-pre-wrap bg-slate-800 text-emerald-300 p-4 rounded-2xl overflow-x-auto text-left" dir="ltr">
                  {selectedQuery.querySnippet}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Detail Modal */}
      {selectedError && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-3xl w-full overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h4 className="font-black text-slate-900 text-sm">جزئیات کامل خطای سرور</h4>
              <button 
                onClick={() => setSelectedError(null)}
                className="w-8 h-8 bg-slate-200 text-slate-600 font-black rounded-full flex items-center justify-center hover:bg-slate-300"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 text-xs font-black">
                <div>
                  <span className="text-slate-400 block mb-0.5">منبع:</span>
                  <span className="text-slate-800 bg-slate-100 px-2 py-1 rounded-md">{selectedError.source}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">زمان رخداد:</span>
                  <span className="text-slate-600 bg-slate-50 px-2 py-1 rounded-md">{formatDate(selectedError.timestamp)}</span>
                </div>
              </div>
              <div>
                <span className="text-xs font-black text-slate-400 block mb-1">پیام خطا:</span>
                <div className="text-sm font-black text-rose-600 bg-rose-50 p-3 rounded-2xl border border-rose-100 leading-relaxed">
                  {selectedError.message}
                </div>
              </div>
              {selectedError.stack && (
                <div>
                  <span className="text-xs font-black text-slate-400 block mb-1">ردیابی خطا (Stack Trace):</span>
                  <pre className="text-[10px] font-mono whitespace-pre bg-slate-800 text-rose-300 p-4 rounded-2xl overflow-x-auto text-left leading-normal" dir="ltr">
                    {selectedError.stack}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
