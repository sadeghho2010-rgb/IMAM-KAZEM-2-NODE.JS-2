import { CollectionName } from './localDb';

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
  * Tests connection to Supabase database (Deactivated)
  */
export async function testSupabaseConnection(): Promise<ConnectionStatus> {
  return {
    connected: false,
    message: 'اتصال با Supabase طبق دستور شما به طور کامل قطع گردیده است. دیتابیس فعال پروژه فقط MySQL 8 روی رانفلر (Runflare) می‌باشد.'
  };
}

/**
 * Syncs a single collection to Supabase (Deactivated)
 */
export async function syncCollectionToSupabase(collectionName: CollectionName): Promise<SyncResult> {
  return { collection: collectionName, count: 0, success: true };
}

/**
 * Syncs all main collections to Supabase (Deactivated)
 */
export async function syncAllToSupabase(_onProgress?: (col: string, progress: number) => void): Promise<SyncResult[]> {
  return [];
}

