import { supabase, isSupabaseConfigured } from './supabase';
import { localDb, COLLECTIONS, CollectionName } from './localDb';

export interface SyncResult {
  collection: string;
  count: number;
  success: boolean;
  error?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  message: string;
  tablesFound?: string[];
}

/**
 * Tests connection to Supabase database and checks if schema tables exist
 */
export async function testSupabaseConnection(): Promise<ConnectionStatus> {
  if (!isSupabaseConfigured) {
    return {
      connected: false,
      message: 'کلید اتصال به دیتابیس Supabase در متغیرهای سیستم تنظیم نشده است. سیستم در حالت محلی (آفلاین) فعال است.'
    };
  }
  try {
    // 1. Try querying cloud_backups table
    const { error: tableError } = await supabase
      .from('cloud_backups')
      .select('id')
      .limit(1);

    if (tableError) {
      if (tableError.code === '42P01' || tableError.message.includes('relation') || tableError.message.includes('not exist')) {
        return {
          connected: false,
          message: 'جدول‌های دیتابیس در Supabase هنوز ساخته نشده‌اند. لطفاً اسکریپت SQL را در SQL Editor سوپابیس اجرا کنید.'
        };
      }
      return {
        connected: false,
        message: `خطای اتصال به Supabase: ${tableError.message}`
      };
    }

    return {
      connected: true,
      message: 'اتصال به دیتابیس Supabase و جدول‌های سیستم با موفقیت تأیید شد.'
    };
  } catch (err: any) {
    return {
      connected: false,
      message: `خطای ارتباط با سرور دیتابیس: ${err?.message || 'نامشخص'}`
    };
  }
}

/**
 * Syncs a single collection to Supabase app_collections or dedicated table
 */
export async function syncCollectionToSupabase(collectionName: CollectionName): Promise<SyncResult> {
  try {
    const docs = await localDb.getDocs(collectionName);
    if (!docs || docs.length === 0) {
      return { collection: collectionName, count: 0, success: true };
    }

    // Try syncing to dedicated table first if available, else app_collections
    const rows = docs.map((doc: any) => ({
      collection_name: collectionName,
      id: String(doc.id || `${collectionName}_${Date.now()}`),
      data: doc,
      updated_at: new Date().toISOString()
    }));

    // Chunking to avoid large payloads
    const chunkSize = 50;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('app_collections')
        .upsert(chunk, { onConflict: 'collection_name,id' });

      if (error) {
        // Fallback: If app_collections doesn't exist, log warning
        console.warn(`Error syncing collection ${collectionName}:`, error);
        return { collection: collectionName, count: 0, success: false, error: error.message };
      }
    }

    return { collection: collectionName, count: docs.length, success: true };
  } catch (err: any) {
    return { collection: collectionName, count: 0, success: false, error: err?.message };
  }
}

/**
 * Syncs all main collections to Supabase
 */
export async function syncAllToSupabase(onProgress?: (col: string, progress: number) => void): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  const list = [...COLLECTIONS];

  for (let i = 0; i < list.length; i++) {
    const col = list[i];
    if (onProgress) {
      onProgress(col, Math.round(((i + 1) / list.length) * 100));
    }
    const res = await syncCollectionToSupabase(col);
    results.push(res);
  }

  return results;
}
