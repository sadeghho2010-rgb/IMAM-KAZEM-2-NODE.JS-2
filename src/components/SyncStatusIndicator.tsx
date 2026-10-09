import React from 'react';
import { Wifi, WifiOff, RefreshCw, Clock } from 'lucide-react';
import { useSseClient } from '../hooks/useSseClient';

interface SyncStatusIndicatorProps {
  pendingCount: number;
  isSyncing: boolean;
  onManualSync: () => void;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  pendingCount,
  isSyncing,
  onManualSync
}) => {
  const { isConnected, lastSeq } = useSseClient();

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-50 dark:bg-gray-800/80 rounded-full border border-gray-200 dark:border-gray-700 text-xs font-sans text-right" dir="rtl">
      {/* Real-time SSE Health Indicator */}
      <div className="flex items-center gap-1.5">
        {isConnected ? (
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <Wifi className="w-3.5 h-3.5" />
            اتصال زنده (seq: {lastSeq})
          </span>
        ) : (
          <span className="flex items-center gap-1 text-rose-500 font-semibold">
            <WifiOff className="w-3.5 h-3.5" />
            قطع ارتباط زنده
          </span>
        )}
      </div>

      <span className="text-gray-300 dark:text-gray-600">|</span>

      {/* Pending Queue Counter */}
      {pendingCount > 0 ? (
        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
          <Clock className="w-3 h-3 animate-spin" />
          {pendingCount} داده در صف ارسال
        </span>
      ) : (
        <span className="text-gray-500 dark:text-gray-400">
          داده‌ها همگام هستند
        </span>
      )}

      {/* Manual Sync Trigger */}
      <button
        onClick={onManualSync}
        disabled={isSyncing}
        className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition disabled:opacity-50"
        title="همگام‌سازی دستی"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
};
