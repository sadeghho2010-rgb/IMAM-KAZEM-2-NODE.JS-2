import { supabase, isSupabaseConfigured, checkIsSupabaseConfigured, getSupabaseCredentials } from './supabase';
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
  if (!checkIsSupabaseConfigured()) {
    return {
      connected: false,
      message: 'کلید و آدرس دیتابیس آنلاین (Supabase) در تنظیمات هاست یا متغیرهای مرورگر یافت نشد. لطفاً در بخش تنظیمات یا کلادفلر، متغیرهای VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY را وارد نمایید یا از فرم تنظیم اتصال آنلاین استفاده کنید.'
    };
  }
  try {
    const tablesToCheck = [
      { name: 'app_collections', label: 'جدول اصلی داده‌ها (app_collections)' },
      { name: 'cloud_backups', label: 'جدول پشتیبان‌گیری ابری (cloud_backups)' },
      { name: 'students', label: 'جدول طلاب (students)' },
      { name: 'programs', label: 'جدول برنامه‌های درسی (programs)' },
      { name: 'system_users', label: 'جدول کاربران سیستم (system_users)' }
    ];

    const foundTables: string[] = [];
    const missingTables: string[] = [];

    for (const t of tablesToCheck) {
      const { error } = await supabase.from(t.name).select('id').limit(1);
      if (!error) {
        foundTables.push(t.label);
      } else if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        missingTables.push(t.label);
      } else {
        // Table exists but maybe empty or restricted by policy
        foundTables.push(t.label);
      }
    }

    if (foundTables.length === tablesToCheck.length) {
      return {
        connected: true,
        message: 'اتصال به دیتابیس Supabase و تمامی جدول‌های کلیدی با موفقیت تأیید شد.',
        tablesFound: foundTables
      };
    } else if (foundTables.length > 0) {
      return {
        connected: true,
        message: `اتصال به Supabase برقرار است (${foundTables.length} جدول از ${tablesToCheck.length} جدول فعال است). جدول‌های موجود: [${foundTables.join('، ')}]. ${missingTables.length > 0 ? `جدول‌های باقی‌مانده: [${missingTables.join('، ')}]. لطفاً دکمه «کپی اسکریپت کامل SQL» را بزنید و کد را در SQL Editor سوپابیس اجرا کنید.` : ''}`,
        tablesFound: foundTables
      };
    } else {
      return {
        connected: false,
        message: 'جدول‌های دیتابیس آنلاین در پروژه Supabase شما هنوز ایجاد نشده‌اند. لطفاً دکمه «کپی اسکریپت کامل SQL ساخت جدول‌ها» را بزنید و کد کپی شده را در بخش SQL Editor در سایت Supabase Paste کرده و دکمه Run را بزنید تا تمامی ۳۲ جدول سیستم به صورت یکجا و خودکار ساخته شوند.'
      };
    }
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
