import React, { useState } from 'react';
import { AlertTriangle, Check, RefreshCw, X } from 'lucide-react';
import { localDb } from '../lib/dexieDb';
import axios from 'axios';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  entity: string;
  entityId: string;
  myChanges: Record<string, any>;
  serverState: Record<string, any>;
  idempotencyKey: string;
  onResolved: () => void;
  onCancel: () => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  entity,
  entityId,
  myChanges,
  serverState,
  idempotencyKey,
  onResolved,
  onCancel
}) => {
  const [selectedFields, setSelectedFields] = useState<Record<string, 'MY' | 'SERVER'>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const allKeys = Array.from(new Set([...Object.keys(myChanges), ...Object.keys(serverState)]))
    .filter(k => !['id', 'version', 'created_at', 'updated_at', 'deleted_at'].includes(k));

  const handleFieldToggle = (key: string, source: 'MY' | 'SERVER') => {
    setSelectedFields(prev => ({ ...prev, [key]: source }));
  };

  /**
   * Option 1: Keep Mine (Overwrites server with local changes)
   */
  const handleKeepMine = async () => {
    setIsSubmitting(true);
    try {
      const serverVersion = serverState.version || 1;
      const newKey = `override_${idempotencyKey}_${Date.now()}`;
      
      await axios.post(`/api/v1/${entity}`, {
        id: entityId,
        op: 'UPDATE',
        version: serverVersion,
        payload: myChanges
      }, {
        headers: {
          'Idempotency-Key': newKey,
          'X-CSRF-Token': (window as any).__CSRF_TOKEN__ || ''
        }
      });

      await localDb.mutation_queue.delete(idempotencyKey);
      onResolved();
    } catch (err) {
      alert('خطا در اعمال تغییرات. لطفاً مجدداً تلاش کنید.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Option 2: Keep Theirs (Accepts server state and discards local changes)
   */
  const handleKeepTheirs = async () => {
    setIsSubmitting(true);
    try {
      const table = (localDb as any)[entity];
      if (table) {
        await table.put({
          id: entityId,
          ...serverState,
          isPendingLocal: false
        });
      }
      await localDb.mutation_queue.delete(idempotencyKey);
      onResolved();
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Option 3: Merge Field by Field
   */
  const handleMergeFields = async () => {
    setIsSubmitting(true);
    try {
      const mergedPayload: Record<string, any> = {};
      allKeys.forEach(key => {
        const choice = selectedFields[key] || 'SERVER';
        mergedPayload[key] = choice === 'MY' ? myChanges[key] : serverState[key];
      });

      const serverVersion = serverState.version || 1;
      const newKey = `merge_${idempotencyKey}_${Date.now()}`;

      await axios.post(`/api/v1/${entity}`, {
        id: entityId,
        op: 'UPDATE',
        version: serverVersion,
        payload: mergedPayload
      }, {
        headers: {
          'Idempotency-Key': newKey,
          'X-CSRF-Token': (window as any).__CSRF_TOKEN__ || ''
        }
      });

      await localDb.mutation_queue.delete(idempotencyKey);
      onResolved();
    } catch (err) {
      alert('خطا در ادغام تغییرات.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-sans text-right" dir="rtl">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-amber-200 dark:border-amber-900/50">
        <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 pb-4 mb-4">
          <AlertTriangle className="w-7 h-7 text-amber-500 animate-pulse" />
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              تداخل همزمانی در ثبت داده‌ها (نسخه ۴۰۹)
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              اطلاعات این بخش توسط کاربر دیگری بروزرسانی شده است. لطفاً نحوه حل تداخل را انتخاب کنید:
            </p>
          </div>
        </div>

        <div className="space-y-4 max-h-80 overflow-y-auto pl-2 mb-6">
          <div className="grid grid-cols-3 text-xs font-semibold text-gray-500 border-b pb-2">
            <div>نام فیلد</div>
            <div>تغییرات شما (محلی)</div>
            <div>اطلاعات سرور (جدید)</div>
          </div>

          {allKeys.map((key) => {
            const myVal = JSON.stringify(myChanges[key] ?? '-');
            const serverVal = JSON.stringify(serverState[key] ?? '-');
            const currentChoice = selectedFields[key] || 'SERVER';

            return (
              <div key={key} className="grid grid-cols-3 text-sm items-center py-2 border-b border-gray-50 dark:border-gray-700/50">
                <div className="font-medium text-gray-700 dark:text-gray-300">{key}</div>
                <button
                  onClick={() => handleFieldToggle(key, 'MY')}
                  className={`p-2 text-xs rounded-lg border transition ${
                    currentChoice === 'MY'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold'
                      : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}
                >
                  {myVal}
                </button>
                <button
                  onClick={() => handleFieldToggle(key, 'SERVER')}
                  className={`p-2 text-xs rounded-lg border transition ${
                    currentChoice === 'SERVER'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold'
                      : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}
                >
                  {serverVal}
                </button>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <button
            disabled={isSubmitting}
            onClick={handleKeepMine}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            حفظ تغییرات من
          </button>

          <button
            disabled={isSubmitting}
            onClick={handleKeepTheirs}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            پذیرش تغییرات سرور
          </button>

          <button
            disabled={isSubmitting}
            onClick={handleMergeFields}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
          >
            ادغام فیلد به فیلد
          </button>
        </div>
      </div>
    </div>
  );
};
