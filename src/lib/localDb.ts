/**
 * Local Database Engine (100% Offline & Laptop Storage)
 * Uses IndexedDB with automatic schema migration and fallback.
 * All photos are stored directly in the local database as Base64 data URLs.
 */
import { supabase, isSupabaseConfigured } from './supabase';
import { dispatchDatabaseErrorToast } from './databaseToast';

/**
 * Check if the current logged-in user is authorized to use optional offline storage mode.
 * Only Education Manager (SHAH) and Finance Manager (FINANCE) or Super Admin can enable this option.
 * For all other users (Level 3 students, teachers, etc.), offline saving is strictly disabled.
 */
export function isOfflineStorageAllowedForUser(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('system_auth_current_user_v2');
    if (!raw) return false;
    const user = JSON.parse(raw);
    if (!user) return false;

    const isManagerRole = 
      user.role === 'education_manager' || 
      user.role === 'finance_manager' || 
      user.username === 'SHAH' || 
      user.username === 'FINANCE' ||
      user.role === 'super_admin';

    if (!isManagerRole) return false;

    return localStorage.getItem('allow_offline_storage_mode') === 'true';
  } catch (e) {
    return false;
  }
}

/**
 * Direct authoritative Cloud Database write with a strict 4-second timeout.
 */
export async function saveToCloudWithTimeout(
  action: 'upsert' | 'delete',
  collectionName: string,
  id: string,
  data?: any,
  timeoutMs = 4000
): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('فعلا اتصال به پایگاه داده مقدور نیست، اطلاعات ثبت نشد. لطفاً مجدداً اقدام کنید.');
  }

  const cloudPromise = new Promise<void>(async (resolve, reject) => {
    try {
      let isSaved = false;

      // 1. Direct Supabase write
      if (isSupabaseConfigured) {
        if (action === 'delete') {
          const { error } = await supabase
            .from('app_collections')
            .delete()
            .match({ collection_name: collectionName, id });

          if (error) {
            reject(new Error(error.message || 'خطا در حذف از پایگاه داده'));
            return;
          }
          isSaved = true;
        } else {
          const sanitized = sanitizeForCloud(data);
          const { error } = await supabase
            .from('app_collections')
            .upsert({
              collection_name: collectionName,
              id,
              data: sanitized,
              updated_at: new Date().toISOString()
            }, { onConflict: 'collection_name,id' });

          if (error) {
            // Fallback for collections that might be blocked by restrictive RLS in Supabase
            if (error.code === '42501' && (collectionName === 'finance_student_claims' || collectionName === 'student_claims')) {
              const fallbackCol = collectionName === 'finance_student_claims' ? 'student_claims' : 'claims';
              const retryRes = await supabase
                .from('app_collections')
                .upsert({
                  collection_name: fallbackCol,
                  id,
                  data: sanitized,
                  updated_at: new Date().toISOString()
                }, { onConflict: 'collection_name,id' });

              if (!retryRes.error) {
                isSaved = true;
              } else {
                reject(new Error(retryRes.error.message || 'خطا در ثبت پایگاه داده'));
                return;
              }
            } else {
              reject(new Error(error.message || 'خطا در ثبت پایگاه داده'));
              return;
            }
          } else {
            isSaved = true;
          }
        }
      }

      // 2. Also notify Dedicated Server API if running
      try {
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        if (action === 'delete') {
          await fetch(`/api/data/${collectionName}/${id}`, {
            method: 'DELETE',
            headers,
            credentials: 'include'
          });
        } else {
          await fetch(`/api/data/${collectionName}`, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({ ...data, id })
          });
        }
        isSaved = true;
      } catch (e) {}

      if (isSaved || !isSupabaseConfigured) {
        resolve();
      } else {
        reject(new Error('خطا در ذخیره‌سازی داده‌ها در سرور'));
      }
    } catch (err) {
      reject(err);
    }
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('مهلت زمانی اتصال به دیتابیس پایان یافت (بیش از ۴ ثانیه).'));
    }, timeoutMs);
  });

  try {
    await Promise.race([cloudPromise, timeoutPromise]);
  } catch (err: any) {
    console.error(`[Cloud Write Error] ${collectionName}/${id}:`, err);
    throw new Error('فعلا اتصال به پایگاه داده مقدور نیست، اطلاعات ثبت نشد. لطفاً مجدداً اقدام کنید.');
  }
}

function sanitizeForCloud(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeForCloud);
  const copy: any = {};
  for (const key of Object.keys(data)) {
    if (key === 'photo' || key === 'image' || key === 'avatar' || key === 'picture') {
      continue;
    }
    const val = data[key];
    if (typeof val === 'string' && val.startsWith('data:image/')) {
      continue;
    }
    copy[key] = val;
  }
  return copy;
}

export interface BackupMetadata {
  version: string;
  exportDate: string;
  systemName: string;
  totalCollections: number;
  totalRecords: number;
  hasPhotos: boolean;
  exportType: 'full' | 'mentor' | 'single_student';
  mentorId?: string;
  mentorName?: string;
  mentorRole?: string;
  gradeLabel?: string;
  studentId?: string;
  studentName?: string;
}

export interface FullBackupPackage {
  _meta: BackupMetadata;
  students: any[];
  programs: any[];
  enrollments: any[];
  research: any[];
  research_records?: any[];
  research_history?: any[];
  research_skills_def?: any[];
  student_research_skills?: any[];
  conversation_archives: any[];
  attendance: any[];
  study_stats: any[];
  study_periods: any[];
  periodic_study_logs: any[];
  todos: any[];
  student_comments: any[];
  oral_exams: any[];
  discussion_groups?: any[];
  academic_calendar_periods?: any[];
  academic_holidays?: any[];
  academic_holiday_types?: any[];
  academic_sub_periods?: any[];
  academic_weekly_programs?: any[];
  manager_files?: any[];
  settings?: any[];
  teachers?: any[];
  [key: string]: any;
}

export interface MentorBackupPackage {
  _meta: BackupMetadata;
  mentor: {
    id: string;
    name: string;
    role: string;
    gradeLabel: string;
  };
  students: any[];
  programs: any[];
  enrollments: any[];
  research: any[];
  research_records?: any[];
  research_history?: any[];
  research_skills_def?: any[];
  student_research_skills?: any[];
  conversation_archives: any[];
  attendance: any[];
  study_stats: any[];
  study_periods: any[];
  periodic_study_logs: any[];
  todos: any[];
  student_comments: any[];
  oral_exams: any[];
  discussion_groups?: any[];
  academic_calendar_periods?: any[];
  academic_holidays?: any[];
  academic_holiday_types?: any[];
  academic_sub_periods?: any[];
  academic_weekly_programs?: any[];
  manager_files?: any[];
  settings?: any[];
  teachers?: any[];
}

export interface StudentBackupPackage {
  _meta: BackupMetadata;
  student: any;
  research: any[];
  research_records?: any[];
  research_history?: any[];
  student_research_skills?: any[];
  conversation_archives: any[];
  attendance: any[];
  study_stats: any[];
  periodic_study_logs: any[];
  study_periods: any[];
  student_comments: any[];
  oral_exams: any[];
  enrollments: any[];
  programs: any[];
  todos: any[];
  discussion_groups?: any[];
  academic_calendar_periods?: any[];
  academic_holidays?: any[];
  academic_holiday_types?: any[];
  academic_sub_periods?: any[];
}

const DB_NAME = 'TOLAB_OFFLINE_LOCAL_DB';
const DB_VERSION = 9;

export const COLLECTIONS = [
  'students',
  'programs',
  'enrollments',
  'research',
  'research_records',
  'research_history',
  'research_skills_def',
  'student_research_skills',
  'conversation_archives',
  'attendance',
  'study_stats',
  'study_periods',
  'periodic_study_logs',
  'todos',
  'student_comments',
  'oral_exams',
  'settings',
  'cloud_backups',
  'manager_files',
  'discussion_groups',
  'academic_calendar_periods',
  'academic_holidays',
  'academic_holiday_types',
  'academic_sub_periods',
  'academic_weekly_programs',
  'teachers',
  'teacher_schedules',
  'classrooms',
  'workflow_items',
  'workflow_settings',
  'audit_logs',
  'counseling_session_grades',
  'presence_hours_logs',
  'presence_reports',
  'tuition_periods',
  'tuition_records',
  'tuition_settings',
  'student_financial_profiles',
  'personal_todos',
  'assigned_todos',
  'user_todo_categories',
  'finance_expenses',
  'finance_operational_expenses',
  'finance_loans',
  'finance_staff',
  'finance_meal_holidays',
  'finance_meal_periods',
  'finance_meal_person_categories',
  'finance_student_meal_reservations',
  'finance_grade_mentors',
  'finance_grade_mentor_periods',
  'finance_destination_accounts',
  'finance_student_claims',
  'finance_claim_categories',
  'finance_budget_rows',
  'finance_fund_contributions',
  'finance_lunch_students',
  'finance_teachers_periods',
  'meal_reservation_periods',
  'meal_reservations',
  'lunch_reservations',
  'drivers',
  'staff',
  'education_financial_reports',
  'teacher_transport_routines',
  'teacher_transport_trips',
  'custom_student_schedules',
  'destination_accounts',
  'student_claims',
  'users',
  'attendance_settings',
  'course_selection_periods',
  'course_selection_requests',
  'received_articles',
  'article_evaluations',
  'evaluation_requests'
] as const;

export type CollectionName = typeof COLLECTIONS[number] | string;

export function normalizeNationalId(id?: any): string {
  if (!id) return '';
  const s = String(id).trim();
  return s
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/\s+/g, '')
    .replace(/[-_]/g, '');
}

export interface DuplicateGroup {
  nationalId: string;
  students: any[];
  primaryCandidateId: string;
  totalRelatedRecords: number;
}

export interface MergeResult {
  success: boolean;
  duplicateGroupsCount: number;
  mergedStudentsCount: number;
  updatedRelatedRecordsCount: number;
  message: string;
  details: {
    nationalId: string;
    primaryStudentName: string;
    mergedNames: string[];
    removedCount: number;
  }[];
}

export function isStudentActive(val: any): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'object') {
    const inner = val.isActive !== undefined ? val.isActive : (val.active !== undefined ? val.active : (val.status !== undefined ? val.status : (val.IsActive !== undefined ? val.IsActive : undefined)));
    if (inner !== undefined && inner !== null) {
      return isStudentActive(inner);
    }
    if (val.status === 'فعال' || val.status === 'active') return true;
    return false;
  }
  if (val === true || val === 1 || val === '1') return true;
  if (typeof val === 'string') {
    const str = val.trim().toLowerCase();
    if (['true', '1', 'فعال', 'active', 'yes', 'بله', 'در حال تحصیل'].includes(str)) return true;
    if (['false', '0', 'غیرفعال', 'غیر فعال', 'inactive', 'no', 'خیر', 'فارغ التحصیل', 'انصرافی'].includes(str)) return false;
  }
  return Boolean(val);
}

export function normalizeStudent(item: any): any {
  if (!item || typeof item !== 'object') return item;
  const isAct = isStudentActive(item);
  return {
    ...item,
    id: item.id || `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    isActive: isAct,
    grade: item.grade ? String(item.grade).trim() : '',
    name: item.name ? String(item.name).trim() : 'نامشخص',
    createdAt: item.createdAt || new Date().toISOString()
  };
}

export function getMentorKeyForGrade(grade?: string): 'hayati' | 'hosseini' | 'soleimani' | 'asadi' | 'other' {
  if (!grade) return 'other';
  const g = String(grade).trim().toLowerCase();
  if (g.includes('10') || g.includes('۱۰') || g.includes('ده') || g.includes('دهم') || g === '10' || g === '۱۰') return 'asadi';
  if (g.includes('7') || g.includes('۷') || g.includes('هفت') || g === '7' || g === '۷') return 'hayati';
  if (g.includes('8') || g.includes('۸') || g.includes('هشت') || g === '8' || g === '۸') return 'hosseini';
  if (g.includes('9') || g.includes('۹') || g.includes('نه') || g.includes('نهم') || g === '9' || g === '۹') return 'soleimani';
  return 'other';
}

export const MENTOR_META: Record<string, { id: string; name: string; role: string; gradeLabel: string }> = {
  hayati: { id: 'hayati', name: 'استاد حیاتی', role: 'مسئول پایه ۷', gradeLabel: 'پایه ۷' },
  hosseini: { id: 'hosseini', name: 'استاد حسینی', role: 'مسئول پایه ۸', gradeLabel: 'پایه ۸' },
  soleimani: { id: 'soleimani', name: 'استاد سلیمانی', role: 'مسئول پایه ۹', gradeLabel: 'پایه ۹' },
  asadi: { id: 'asadi', name: 'استاد اسدی', role: 'مسئول پایه ۱۰', gradeLabel: 'پایه ۱۰' },
  shahpoori: { id: 'shahpoori', name: 'مدیریت', role: 'مدیر اصلی', gradeLabel: 'کل پایه‌ها' },
};

class LocalDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.initDb();
  }

  private resolveCollection(name: string): string {
    if (name === 'research_records') return 'research';
    if (name === 'student_claims') return 'finance_student_claims';
    if (name === 'destination_accounts') return 'finance_destination_accounts';
    if (name === 'loans') return 'finance_loans';
    if (name === 'fund_contributions') return 'finance_fund_contributions';
    if (name === 'lunch_students') return 'finance_lunch_students';
    if (name === 'lunch_periods' || name === 'meal_reservation_periods') return 'finance_meal_periods';
    if (name === 'lunch_reservations' || name === 'meal_reservations') return 'finance_student_meal_reservations';
    if (name === 'operational_expenses' || name === 'expenses') return 'finance_operational_expenses';
    return name;
  }

  private initDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        for (const col of COLLECTIONS) {
          const resolved = this.resolveCollection(col);
          if (!db.objectStoreNames.contains(resolved)) {
            db.createObjectStore(resolved, { keyPath: 'id' });
          }
        }
      };

      request.onsuccess = async (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        resolve(db);
        // Check if database is empty, if so populate initial sample seed data
        await this.checkAndSeedDefaultData(db);
        // Auto-migrate and normalize any students with non-boolean isActive
        this.autoMigrateStudents(db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });

    return this.dbPromise;
  }

  private async getDb(): Promise<IDBDatabase> {
    return this.initDb();
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error('LocalDb listener error:', e);
      }
    });
  }

  // LocalStorage Fallback Helpers for when IndexedDB Store does not exist
  private getLocalStorageDocs<T>(resolvedCol: string): T[] {
    try {
      const raw = localStorage.getItem(`fallback_idb_${resolvedCol}`);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  private setLocalStorageDoc(resolvedCol: string, doc: any) {
    try {
      const docs = this.getLocalStorageDocs(resolvedCol);
      const idx = docs.findIndex((d: any) => d.id === doc.id);
      if (idx >= 0) docs[idx] = doc;
      else docs.push(doc);
      localStorage.setItem(`fallback_idb_${resolvedCol}`, JSON.stringify(docs));
    } catch (e) {
      console.error('LocalStorage fallback write error:', e);
    }
  }

  private deleteLocalStorageDoc(resolvedCol: string, id: string) {
    try {
      const docs = this.getLocalStorageDocs(resolvedCol);
      const filtered = docs.filter((d: any) => d.id !== id);
      localStorage.setItem(`fallback_idb_${resolvedCol}`, JSON.stringify(filtered));
    } catch (e) {
      console.error('LocalStorage fallback delete error:', e);
    }
  }

  // Track synced collections in current session
  private syncedCollections = new Set<string>();

  // Fetch and sync a collection from Server / Supabase Cloud
  async syncCollectionFromCloud(collectionName: CollectionName): Promise<any[]> {
    if (typeof window === 'undefined') return [];
    const resolvedCol = this.resolveCollection(collectionName as string);
    try {
      // 1. First try secure Server-Side Dedicated Data API
      let cloudDocs: any[] = [];
      try {
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const apiRes = await fetch(`/api/data/${resolvedCol}`, {
          method: 'GET',
          headers,
          credentials: 'include'
        });

        if (apiRes.ok) {
          const json = await apiRes.json();
          if (json.success && Array.isArray(json.items)) {
            cloudDocs = json.items.filter((d: any) => d && d.id);
          }
        }
      } catch (apiErr) {
        // Fall back to direct Supabase if server API is unavailable
      }

      // 2. Direct Supabase fallback if API yielded no results but Supabase client is configured
      if (cloudDocs.length === 0 && isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('app_collections')
          .select('id, data')
          .eq('collection_name', resolvedCol);

        if (!error && data && Array.isArray(data)) {
          cloudDocs = data
            .map(row => ({ ...row.data, id: row.id || row.data?.id }))
            .filter(d => d && d.id);
        }
      }

      if (cloudDocs.length > 0) {
        const db = await this.getDb();
        if (db.objectStoreNames.contains(resolvedCol)) {
          const tx = db.transaction(resolvedCol, 'readwrite');
          const store = tx.objectStore(resolvedCol);
          for (const doc of cloudDocs) {
            store.put(doc);
          }
        }

        // Also update localStorage fallback
        const key = `fallback_idb_${resolvedCol}`;
        const currentLS = (this.getLocalStorageDocs(resolvedCol) as any[]) || [];
        const map = new Map<string, any>();
        currentLS.forEach(item => map.set(item.id, item));
        cloudDocs.forEach(item => map.set(item.id, item));
        try {
          localStorage.setItem(key, JSON.stringify(Array.from(map.values())));
        } catch (e) {}

        this.syncedCollections.add(resolvedCol);
        this.notify();
        return cloudDocs;
      }

      this.syncedCollections.add(resolvedCol);
    } catch (e) {
      console.warn(`Exception syncing ${resolvedCol} from cloud:`, e);
    }
    return [];
  }

  // Realtime Supabase change listener to synchronize changes between devices instantly
  private realtimeChannel: any = null;

  public setupRealtimeSync() {
    if (!isSupabaseConfigured || typeof window === 'undefined' || this.realtimeChannel) return;

    try {
      this.realtimeChannel = supabase
        .channel('app_collections_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'app_collections' },
          async (payload: any) => {
            const { eventType, new: newRecord, old: oldRecord } = payload;
            const collectionName = newRecord?.collection_name || oldRecord?.collection_name;
            const id = newRecord?.id || oldRecord?.id;
            if (!collectionName || !id) return;

            const resolvedCol = this.resolveCollection(collectionName);
            const db = await this.getDb();

            if (eventType === 'DELETE') {
              if (db.objectStoreNames.contains(resolvedCol)) {
                try {
                  const tx = db.transaction(resolvedCol, 'readwrite');
                  tx.objectStore(resolvedCol).delete(id);
                } catch (e) {}
              }
              const currentLS = this.getLocalStorageDocs(resolvedCol);
              const filtered = currentLS.filter((x: any) => x.id !== id);
              try {
                localStorage.setItem(`fallback_idb_${resolvedCol}`, JSON.stringify(filtered));
              } catch (e) {}
            } else if (eventType === 'INSERT' || eventType === 'UPDATE') {
              const doc = { ...(newRecord.data || {}), id };
              if (db.objectStoreNames.contains(resolvedCol)) {
                try {
                  const tx = db.transaction(resolvedCol, 'readwrite');
                  tx.objectStore(resolvedCol).put(doc);
                } catch (e) {}
              }
              const currentLS = this.getLocalStorageDocs(resolvedCol);
              const map = new Map<string, any>();
              currentLS.forEach((x: any) => map.set(x.id, x));
              map.set(id, doc);
              try {
                localStorage.setItem(`fallback_idb_${resolvedCol}`, JSON.stringify(Array.from(map.values())));
              } catch (e) {}
            }

            this.notify();
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Realtime channel error:', e);
    }
  }

  // Get all documents from a collection
  async getDocs<T = any>(collectionName: CollectionName): Promise<T[]> {
    const resolvedCol = this.resolveCollection(collectionName as string);
    const db = await this.getDb();

    let localItems: T[] = [];
    if (!db.objectStoreNames.contains(resolvedCol)) {
      localItems = this.getLocalStorageDocs<T>(resolvedCol);
    } else {
      localItems = await new Promise((resolve) => {
        try {
          const transaction = db.transaction(resolvedCol, 'readonly');
          const store = transaction.objectStore(resolvedCol);
          const request = store.getAll();

          request.onsuccess = () => {
            const idbResult = (request.result || []) as T[];
            const lsResult = this.getLocalStorageDocs<T>(resolvedCol);
            const idSet = new Set((idbResult as any[]).map(x => x.id));
            const combined = [...idbResult];
            for (const item of lsResult as any[]) {
              if (!idSet.has(item.id)) {
                combined.push(item);
              }
            }
            resolve(combined as T[]);
          };
          request.onerror = () => {
            resolve(this.getLocalStorageDocs<T>(resolvedCol));
          };
        } catch (e) {
          resolve(this.getLocalStorageDocs<T>(resolvedCol));
        }
      });
    }

    // If collection hasn't been synced from cloud yet in this session, await cloud sync!
    if (!this.syncedCollections.has(resolvedCol) && isSupabaseConfigured) {
      const cloudDocs = await this.syncCollectionFromCloud(resolvedCol);
      if (cloudDocs && cloudDocs.length > 0) {
        const cloudIdSet = new Set(cloudDocs.map(c => c.id));
        const unSyncedLocal = localItems.filter(l => !cloudIdSet.has((l as any).id));
        return [...cloudDocs, ...unSyncedLocal] as T[];
      }
    }

    return localItems;
  }

  // Get single document by ID
  async getDoc<T = any>(collectionName: CollectionName, id: string): Promise<T | null> {
    const resolvedCol = this.resolveCollection(collectionName as string);
    const db = await this.getDb();
    if (!db.objectStoreNames.contains(resolvedCol)) {
      const lsDocs = this.getLocalStorageDocs<T>(resolvedCol);
      return (lsDocs as any[]).find(x => x.id === id) || null;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(resolvedCol, 'readonly');
        const store = transaction.objectStore(resolvedCol);
        const request = store.get(id);

        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result as T);
          } else {
            const lsDocs = this.getLocalStorageDocs<T>(resolvedCol);
            resolve((lsDocs as any[]).find(x => x.id === id) || null);
          }
        };
        request.onerror = () => {
          reject(request.error);
        };
      } catch (e) {
        console.warn(`Object store ${resolvedCol} error:`, e);
        const lsDocs = this.getLocalStorageDocs<T>(resolvedCol);
        resolve((lsDocs as any[]).find(x => x.id === id) || null);
      }
    });
  }

  // Alias for addDoc / setDoc (supports both setDoc(col, doc) and setDoc(col, id, doc))
  async setDoc(collectionName: CollectionName, idOrData: any, optionalData?: any): Promise<string> {
    if (optionalData !== undefined && typeof idOrData === 'string') {
      return this.addDoc(collectionName, { ...optionalData, id: idOrData });
    }
    return this.addDoc(collectionName, idOrData);
  }

  // Add a new document (with optimistic UI, strict 4s online sync & automatic rollback)
  async addDoc(collectionName: CollectionName, data: any): Promise<string> {
    const resolvedCol = this.resolveCollection(collectionName as string);
    const db = await this.getDb();
    let record = { ...data };
    if (resolvedCol === 'students') {
      record = normalizeStudent(record);
    }
    const id = record.id || `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    record.id = id;

    // 1. Optimistic Local Write for instant UI responsiveness
    this.setLocalStorageDoc(resolvedCol, record);
    if (db.objectStoreNames.contains(resolvedCol)) {
      try {
        const transaction = db.transaction(resolvedCol, 'readwrite');
        const store = transaction.objectStore(resolvedCol);
        store.put(record);
      } catch (e) {
        console.warn(`Object store ${resolvedCol} write warning:`, e);
      }
    }
    this.notify();

    // 2. Direct Cloud Database Write with strict 4-second timeout
    try {
      await saveToCloudWithTimeout('upsert', resolvedCol, id, record, 4000);
      this.autoLogAudit(db, 'create', resolvedCol, id, undefined, record);
      return id;
    } catch (err: any) {
      if (isOfflineStorageAllowedForUser()) {
        console.warn(`[Offline Mode Permitted] Record ${id} in ${resolvedCol} stored locally.`);
        this.autoLogAudit(db, 'create', resolvedCol, id, undefined, record);
        return id;
      }

      // Strict Rollback: Remove the newly added record
      try {
        this.deleteLocalStorageDoc(resolvedCol, id);
        if (db.objectStoreNames.contains(resolvedCol)) {
          const rollbackTx = db.transaction(resolvedCol, 'readwrite');
          rollbackTx.objectStore(resolvedCol).delete(id);
        }
      } catch (e) {}
      this.notify();

      dispatchDatabaseErrorToast('فعلا اتصال به پایگاه داده مقدور نیست، اطلاعات ثبت نشد. لطفاً مجدداً اقدام کنید.');
      throw new Error('فعلا اتصال به پایگاه داده مقدور نیست، اطلاعات ثبت نشد. لطفاً مجدداً اقدام کنید.');
    }
  }

  // Update existing document (with optimistic UI, strict 4s online sync & automatic rollback)
  async updateDoc(collectionName: CollectionName, id: string, data: any): Promise<void> {
    const resolvedCol = this.resolveCollection(collectionName as string);
    const db = await this.getDb();

    let existingDoc: any = null;
    try {
      existingDoc = await this.getDoc(resolvedCol, id);
    } catch (e) {}

    let updated = { ...(existingDoc || {}), ...data, id };
    if (resolvedCol === 'students') {
      updated = normalizeStudent(updated);
    }

    // 1. Optimistic Local Write
    this.setLocalStorageDoc(resolvedCol, updated);
    if (db.objectStoreNames.contains(resolvedCol)) {
      try {
        const transaction = db.transaction(resolvedCol, 'readwrite');
        const store = transaction.objectStore(resolvedCol);
        store.put(updated);
      } catch (e) {
        console.warn(`Object store ${resolvedCol} update warning:`, e);
      }
    }
    this.notify();

    // 2. Direct Cloud Database Write with strict 4-second timeout
    try {
      await saveToCloudWithTimeout('upsert', resolvedCol, id, updated, 4000);
      this.autoLogAudit(db, 'update', resolvedCol, id, existingDoc, updated);
    } catch (err: any) {
      if (isOfflineStorageAllowedForUser()) {
        console.warn(`[Offline Mode Permitted] Update ${id} in ${resolvedCol} stored locally.`);
        this.autoLogAudit(db, 'update', resolvedCol, id, existingDoc, updated);
        return;
      }

      // Strict Rollback: Restore previous state
      try {
        if (existingDoc) {
          this.setLocalStorageDoc(resolvedCol, existingDoc);
          if (db.objectStoreNames.contains(resolvedCol)) {
            const rollbackTx = db.transaction(resolvedCol, 'readwrite');
            rollbackTx.objectStore(resolvedCol).put(existingDoc);
          }
        } else {
          this.deleteLocalStorageDoc(resolvedCol, id);
          if (db.objectStoreNames.contains(resolvedCol)) {
            const rollbackTx = db.transaction(resolvedCol, 'readwrite');
            rollbackTx.objectStore(resolvedCol).delete(id);
          }
        }
      } catch (e) {}
      this.notify();

      dispatchDatabaseErrorToast('فعلا اتصال به پایگاه داده مقدور نیست، اطلاعات ثبت نشد. لطفاً مجدداً اقدام کنید.');
      throw new Error('فعلا اتصال به پایگاه داده مقدور نیست، اطلاعات ثبت نشد. لطفاً مجدداً اقدام کنید.');
    }
  }

  // Delete a document (with optimistic UI, strict 4s online sync & automatic rollback)
  async deleteDoc(collectionName: CollectionName, id: string): Promise<void> {
    const resolvedCol = this.resolveCollection(collectionName as string);
    const db = await this.getDb();

    let existingDoc: any = undefined;
    try {
      existingDoc = await this.getDoc(resolvedCol, id);
    } catch (e) {}

    // 1. Optimistic Local Delete
    this.deleteLocalStorageDoc(resolvedCol, id);
    if (db.objectStoreNames.contains(resolvedCol)) {
      try {
        const transaction = db.transaction(resolvedCol, 'readwrite');
        const store = transaction.objectStore(resolvedCol);
        store.delete(id);
      } catch (e) {}
    }
    this.notify();

    // 2. Direct Cloud Database Write with strict 4-second timeout
    try {
      await saveToCloudWithTimeout('delete', resolvedCol, id, undefined, 4000);
      this.autoLogAudit(db, 'delete', resolvedCol, id, existingDoc, undefined);
    } catch (err: any) {
      if (isOfflineStorageAllowedForUser()) {
        console.warn(`[Offline Mode Permitted] Deletion ${id} in ${resolvedCol} stored locally.`);
        this.autoLogAudit(db, 'delete', resolvedCol, id, existingDoc, undefined);
        return;
      }

      // Strict Rollback: Restore the deleted item
      if (existingDoc) {
        try {
          this.setLocalStorageDoc(resolvedCol, existingDoc);
          if (db.objectStoreNames.contains(resolvedCol)) {
            const rollbackTx = db.transaction(resolvedCol, 'readwrite');
            rollbackTx.objectStore(resolvedCol).put(existingDoc);
          }
        } catch (e) {}
        this.notify();
      }

      dispatchDatabaseErrorToast('فعلا اتصال به پایگاه داده مقدور نیست، اطلاعات ثبت نشد. لطفاً مجدداً اقدام کنید.');
      throw new Error('فعلا اتصال به پایگاه داده مقدور نیست، اطلاعات ثبت نشد. لطفاً مجدداً اقدام کنید.');
    }
  }

  // Background Non-blocking Real-time Mirror to Server & Supabase
  private mirrorToSupabase(action: 'upsert' | 'delete', collectionName: string, id: string, data?: any) {
    if (typeof window === 'undefined') return;
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // 1. Sync through Secure Dedicated Server Data API
      if (action === 'delete') {
        fetch(`/api/data/${collectionName}/${id}`, {
          method: 'DELETE',
          headers,
          credentials: 'include'
        }).catch(() => {});
      } else {
        fetch(`/api/data/${collectionName}`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({ ...data, id })
        }).catch(() => {});
      }

      // 2. Direct Supabase Fallback if Supabase client is configured
      if (isSupabaseConfigured) {
        if (action === 'delete') {
          supabase
            .from('app_collections')
            .delete()
            .match({ collection_name: collectionName, id })
            .then(({ error }) => {
              if (error) console.error(`Error deleting ${collectionName}/${id} in Supabase:`, error);
            });
        } else {
          const sanitized = sanitizeForCloud(data);
          supabase.from('app_collections').upsert({
            collection_name: collectionName,
            id,
            data: sanitized,
            updated_at: new Date().toISOString()
          }, { onConflict: 'collection_name,id' }).then(({ error }) => {
            if (error) {
              console.error(`Error upserting ${collectionName}/${id} into Supabase app_collections:`, error);
            }
          });
        }
      }
    } catch (e) {
      console.warn(`Exception during mirrorToSupabase for ${collectionName}:`, e);
    }
  }

  // Automatic Audit Logging Interceptor
  private autoLogAudit(
    db: IDBDatabase,
    actionType: 'create' | 'update' | 'delete',
    collectionName: string,
    entityId: string,
    previousState?: any,
    newState?: any
  ) {
    if (collectionName === 'audit_logs') return;

    try {
      const resolvedCol = this.resolveCollection(collectionName);
      const itemForMeta = newState || previousState;

      let module = resolvedCol;
      let moduleTitle = resolvedCol;
      let entityName = itemForMeta?.name || itemForMeta?.title || itemForMeta?.subject || entityId || 'رکورد داده';

      switch (resolvedCol) {
        case 'students':
          module = 'students';
          moduleTitle = 'مدیریت کل طلاب';
          entityName = itemForMeta?.name ? `طلبه ${itemForMeta.name}` : 'پرونده طلبه';
          break;
        case 'programs':
          module = 'programs';
          moduleTitle = 'برنامه‌های آموزشی و سرفصل‌ها';
          entityName = itemForMeta?.title || itemForMeta?.name || 'برنامه آموزشی';
          break;
        case 'enrollments':
          module = 'programs';
          moduleTitle = 'برنامه‌های آموزشی و ثبت‌نام';
          entityName = 'ثبت‌نام دوره';
          break;
        case 'research':
        case 'research_records':
        case 'research_history':
        case 'student_research_skills':
          module = 'research';
          moduleTitle = 'بخش پژوهش و مقالات';
          entityName = itemForMeta?.title || itemForMeta?.subject || 'پژوهش و مقاله';
          break;
        case 'attendance':
          module = 'attendance';
          moduleTitle = 'حضور و غیاب طلاب';
          entityName = itemForMeta?.date ? `حضور و غیاب ${itemForMeta.date}` : 'لیست حضور و غیاب';
          break;
        case 'study_stats':
        case 'study_periods':
        case 'periodic_study_logs':
          module = 'stats';
          moduleTitle = 'آمار و گزارشات مطالعه';
          entityName = itemForMeta?.title || 'ساعات/دوره مطالعه';
          break;
        case 'discussion_groups':
          module = 'discussion';
          moduleTitle = 'گروه‌های بحثی';
          entityName = itemForMeta?.title || itemForMeta?.subject || 'گروه مباحثه';
          break;
        case 'student_comments':
          module = 'comments';
          moduleTitle = 'نظرات و ارزیابی تربیتی';
          entityName = itemForMeta?.category ? `نظر تربیتی (${itemForMeta.category})` : 'نظر تربیتی';
          break;
        case 'oral_exams':
          module = 'comments';
          moduleTitle = 'آزمون‌های شفاهی';
          entityName = itemForMeta?.title || 'آزمون شفاهی';
          break;
        case 'todos':
          module = 'todos';
          moduleTitle = 'پیگیری‌ها و تسک‌ها';
          entityName = itemForMeta?.title || 'تسک پیگیری';
          break;
        case 'academic_calendar_periods':
        case 'academic_holidays':
        case 'academic_holiday_types':
        case 'academic_sub_periods':
        case 'academic_weekly_programs':
          module = 'academic-calendar';
          moduleTitle = 'تقویم آموزشی و سالنامه';
          entityName = itemForMeta?.title || itemForMeta?.name || 'تقویم آموزشی';
          break;
        case 'teachers':
          module = 'teachers-bank';
          moduleTitle = 'بانک اساتید و مدرسین';
          entityName = itemForMeta?.name ? `استاد ${itemForMeta.name}` : 'پرونده استاد';
          break;
        case 'classrooms':
          module = 'classrooms';
          moduleTitle = 'مدرس‌ها و فضاهای درسی';
          entityName = itemForMeta?.name || itemForMeta?.title || 'مدرس/کلاس';
          break;
        case 'workflow_items':
        case 'workflow_settings':
          module = 'workflow';
          moduleTitle = 'جریان کار و کارتابل تاییدات';
          entityName = itemForMeta?.title || 'آیتم جریان کار';
          break;
        case 'presence_hours':
          module = 'presence-hours';
          moduleTitle = 'ساعت حضور و کارکرد';
          entityName = itemForMeta?.teacherName ? `کارکرد استاد ${itemForMeta.teacherName}` : 'کارکرد اساتید';
          break;
        case 'custom_student_schedules':
          module = 'student-schedule';
          moduleTitle = 'برنامه درسی و هفتگی طلاب';
          entityName = itemForMeta?.title || 'برنامه هفتگی';
          break;
        case 'counseling_session_grades':
          module = 'counseling-classes';
          moduleTitle = 'کلاس‌های مشاوره (ارزیابی و نمرات)';
          entityName = itemForMeta?.studentName ? `ارزیابی مشاوره ${itemForMeta.studentName}` : 'نمره کلاس مشاوره';
          break;
        default:
          moduleTitle = `بخش ${resolvedCol}`;
          break;
      }

      let userName = 'کاربر سیستم';
      let username = 'system';
      let userRole: any = 'super_admin';
      let userRoleTitle = 'مدیریت سامانه';
      let userLevel: any = 1;

      try {
        const raw = localStorage.getItem('system_auth_current_user_v2');
        if (raw) {
          const p = JSON.parse(raw);
          if (p) {
            userName = p.name || p.fullName || p.username || userName;
            username = p.username || username;
            userRole = p.role || userRole;
            userRoleTitle = p.roleTitle || userRoleTitle;
            userLevel = p.level || userLevel;
          }
        }
      } catch (e) {}

      const now = new Date();
      const isoStr = now.toISOString();
      const timeStr = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      let dateStr = now.toLocaleDateString('fa-IR');

      try {
        const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const parts = formatter.formatToParts(now);
        const y = parts.find(p => p.type === 'year')?.value;
        const m = parts.find(p => p.type === 'month')?.value;
        const d = parts.find(p => p.type === 'day')?.value;
        dateStr = `${y}/${m}/${d}`;
      } catch (e) {}

      let actionText = 'ایجاد';
      if (actionType === 'update') actionText = 'ویرایش';
      if (actionType === 'delete') actionText = 'حذف';

      const auditEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: isoStr,
        shamsiDate: dateStr,
        shamsiTime: timeStr,
        userName,
        username,
        userRole,
        userRoleTitle,
        userLevel,
        actionType,
        module,
        moduleTitle,
        entityType: resolvedCol,
        entityId,
        entityName,
        description: `${actionText} اطلاعات در ${moduleTitle}: «${entityName}» توسط ${userName}`,
        previousState: previousState ? JSON.parse(JSON.stringify(previousState)) : undefined,
        newState: newState ? JSON.parse(JSON.stringify(newState)) : undefined,
        isReverted: false
      };

      if (db.objectStoreNames.contains('audit_logs')) {
        const tx = db.transaction('audit_logs', 'readwrite');
        const store = tx.objectStore('audit_logs');
        store.put(auditEntry);
      } else {
        this.setLocalStorageDoc('audit_logs', auditEntry);
      }
    } catch (e) {
      console.warn('Auto audit log failed (non-fatal):', e);
    }
  }

  // Clear entire collection
  async clearCollection(collectionName: CollectionName): Promise<void> {
    const resolvedCol = this.resolveCollection(collectionName as string);
    const db = await this.getDb();
    if (!db.objectStoreNames.contains(resolvedCol)) return;

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(resolvedCol, 'readwrite');
        const store = transaction.objectStore(resolvedCol);
        const request = store.clear();

        request.onsuccess = () => {
          this.notify();
          resolve();
        };
        request.onerror = () => {
          reject(request.error);
        };
      } catch (e) {
        console.warn(`Object store ${resolvedCol} clear error:`, e);
        resolve();
      }
    });
  }

  private async autoMigrateStudents(db: IDBDatabase): Promise<void> {
    try {
      if (!db.objectStoreNames.contains('students')) return;
      const transaction = db.transaction('students', 'readwrite');
      const store = transaction.objectStore('students');
      const request = store.getAll();
      request.onsuccess = () => {
        const students = request.result || [];
        let updatedCount = 0;
        for (const s of students) {
          const currentIsActive = s.isActive;
          const normalizedActive = isStudentActive(s);
          if (currentIsActive !== normalizedActive || typeof currentIsActive !== 'boolean') {
            const normalized = normalizeStudent(s);
            store.put(normalized);
            updatedCount++;
          }
        }
        if (updatedCount > 0) {
          this.notify();
        }
      };
    } catch (e) {
      console.warn('autoMigrateStudents non-fatal error:', e);
    }
  }

  // Bulk add or overwrite documents in a collection
  async bulkPut(collectionName: CollectionName, items: any[]): Promise<void> {
    if (!items || items.length === 0) return;
    const resolvedCol = this.resolveCollection(collectionName as string);
    const db = await this.getDb();

    const processedItems: any[] = [];
    for (const item of items) {
      let record = { ...item };
      if (resolvedCol === 'students') {
        record = normalizeStudent(record);
      } else if (!record.id) {
        record.id = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }
      processedItems.push(record);
      this.setLocalStorageDoc(resolvedCol, record);
    }

    if (db.objectStoreNames.contains(resolvedCol)) {
      try {
        const transaction = db.transaction(resolvedCol, 'readwrite');
        const store = transaction.objectStore(resolvedCol);
        for (const record of processedItems) {
          store.put(record);
        }
      } catch (e) {}
    }
    this.notify();

    // Direct Cloud sync
    try {
      const rows = processedItems.map((item: any) => ({
        collection_name: resolvedCol,
        id: String(item.id),
        data: sanitizeForCloud(item),
        updated_at: new Date().toISOString()
      }));

      const cloudPromise = (async () => {
        if (isSupabaseConfigured) {
          const chunkSize = 50;
          for (let i = 0; i < rows.length; i += chunkSize) {
            const chunk = rows.slice(i, i + chunkSize);
            const { error } = await supabase
              .from('app_collections')
              .upsert(chunk, { onConflict: 'collection_name,id' });
            if (error) {
              if (error.code === '42501' && resolvedCol === 'finance_student_claims') {
                const fallbackChunk = chunk.map((r: any) => ({ ...r, collection_name: 'student_claims' }));
                const retry = await supabase
                  .from('app_collections')
                  .upsert(fallbackChunk, { onConflict: 'collection_name,id' });
                if (retry.error) throw retry.error;
              } else {
                throw error;
              }
            }
          }
        }
      })();

      const dynamicTimeout = Math.max(6000, rows.length * 150);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('مهلت ذخیره گروهی پایان یافت')), dynamicTimeout);
      });

      await Promise.race([cloudPromise, timeoutPromise]);
    } catch (err: any) {
      if (isOfflineStorageAllowedForUser()) {
        console.warn(`[Offline Mode Permitted] Bulk write in ${resolvedCol} stored locally.`);
        return;
      }
      dispatchDatabaseErrorToast('فعلا اتصال به پایگاه داده مقدور نیست، اطلاعات ثبت نشد. لطفاً مجدداً اقدام کنید.');
      throw new Error('فعلا اتصال به پایگاه داده مقدور نیست، اطلاعات ثبت نشد. لطفاً مجدداً اقدام کنید.');
    }
  }

  // Clear all data in all collections
  async resetAllDatabase(): Promise<void> {
    for (const col of COLLECTIONS) {
      await this.clearCollection(col);
    }
    this.notify();
  }

  // ==========================================
  // BACKUP & RESTORE FUNCTIONALITY
  // ==========================================

  // Export full database backup (including all Base64 photos and all modules: education, research, finance, tuition, attendance, etc.)
  async exportFullBackup(): Promise<FullBackupPackage> {
    const backupPackage: any = {
      _meta: {
        version: '3.0.0-full-system',
        exportDate: new Date().toISOString(),
        systemName: 'سیستم جامع مدیریت حوزه (آموزش، پژوهش، مالی و شهریه)',
        totalCollections: COLLECTIONS.length,
        totalRecords: 0,
        hasPhotos: false,
        exportType: 'full'
      }
    };

    let totalRecords = 0;
    await Promise.all(
      COLLECTIONS.map(async (col) => {
        try {
          const docs = await this.getDocs(col);
          backupPackage[col] = docs || [];
          totalRecords += (docs ? docs.length : 0);
        } catch {
          backupPackage[col] = [];
        }
      })
    );

    backupPackage._meta.totalRecords = totalRecords;
    backupPackage._meta.hasPhotos = Array.isArray(backupPackage.students) && backupPackage.students.some((s: any) => !!s.photoUrl);

    return backupPackage as FullBackupPackage;
  }

  // Export individual mentor/professor backup (e.g. استاد حسینی، استاد حیاتی، استاد سلیمانی، استاد شاهپوری)
  async exportMentorBackup(mentorId: string): Promise<MentorBackupPackage> {
    const meta = MENTOR_META[mentorId] || {
      id: mentorId,
      name: mentorId === 'shahpoori' ? 'مدیریت' : `استاد ${mentorId}`,
      role: 'مسئول پایه',
      gradeLabel: 'پایه مربوطه'
    };

    const allStudents = await this.getDocs('students');
    const mentorStudents = allStudents.filter((s) => {
      if (mentorId === 'shahpoori') return true;
      const key = getMentorKeyForGrade(s.grade);
      return key === mentorId;
    });

    const studentIds = new Set(mentorStudents.map((s) => s.id));

    const [
      allResearch,
      allResearchRecords,
      allResearchHistory,
      allResearchSkillsDef,
      allStudentResearchSkills,
      allArchives,
      allAttendance,
      allStats,
      allPeriodicLogs,
      allPeriods,
      allComments,
      allExams,
      allEnrollments,
      allPrograms,
      allTodos,
      allDiscussions,
      allManagerFiles,
      allAcademicPeriods,
      allAcademicHolidays,
      allAcademicHolidayTypes,
      allAcademicSubPeriods,
      allSettings,
      allTeachers
    ] = await Promise.all([
      this.getDocs('research'),
      this.getDocs('research_records'),
      this.getDocs('research_history'),
      this.getDocs('research_skills_def'),
      this.getDocs('student_research_skills'),
      this.getDocs('conversation_archives'),
      this.getDocs('attendance'),
      this.getDocs('study_stats'),
      this.getDocs('periodic_study_logs'),
      this.getDocs('study_periods'),
      this.getDocs('student_comments'),
      this.getDocs('oral_exams'),
      this.getDocs('enrollments'),
      this.getDocs('programs'),
      this.getDocs('todos'),
      this.getDocs('discussion_groups'),
      this.getDocs('manager_files'),
      this.getDocs('academic_calendar_periods'),
      this.getDocs('academic_holidays'),
      this.getDocs('academic_holiday_types'),
      this.getDocs('academic_sub_periods'),
      this.getDocs('settings'),
      this.getDocs('teachers')
    ]);

    const mentorResearch = allResearch.filter((r) => studentIds.has(r.studentId));
    const mentorResearchRecords = allResearchRecords.filter((r) => studentIds.has(r.studentId));
    const mentorResearchHistory = allResearchHistory.filter((r) => studentIds.has(r.studentId));
    const mentorStudentResearchSkills = allStudentResearchSkills.filter((s) => studentIds.has(s.studentId));
    const mentorArchives = allArchives.filter((a) => studentIds.has(a.studentId));
    const mentorAttendance = allAttendance.filter((a) => studentIds.has(a.studentId));
    const mentorStats = allStats.filter((s) => studentIds.has(s.studentId));
    const mentorPeriodicLogs = allPeriodicLogs.filter((p) => studentIds.has(p.studentId));
    const relevantPeriodIds = new Set(mentorPeriodicLogs.map((p) => p.periodId));
    const mentorPeriods = allPeriods.filter((p) => relevantPeriodIds.has(p.id) || mentorId === 'shahpoori');
    const mentorComments = allComments.filter((c) => studentIds.has(c.studentId));
    const mentorExams = allExams.filter((e) => studentIds.has(e.studentId));
    const mentorEnrollments = allEnrollments.filter((e) => studentIds.has(e.studentId));
    const relevantProgramIds = new Set(mentorEnrollments.map((e) => e.programId));
    
    // Include programs created by mentor, enrolled by mentor's students, or connected via hierarchy (parent/child)
    const mentorPrograms = allPrograms.filter((p) => {
      if (mentorId === 'shahpoori') return true;
      if (p.mentorId === mentorId) return true;
      if (relevantProgramIds.has(p.id)) return true;
      
      // If any of mentor's relevant programs is a child of this program
      const isParentOfRelevant = allPrograms.some(
        (childP) => (childP.mentorId === mentorId || relevantProgramIds.has(childP.id)) && childP.parentProgramId === p.id
      );
      if (isParentOfRelevant) return true;

      // If this program is a counseling child of any of mentor's relevant programs
      if (p.parentProgramId) {
        const parentP = allPrograms.find((parent) => parent.id === p.parentProgramId);
        if (parentP && (parentP.mentorId === mentorId || relevantProgramIds.has(parentP.id))) return true;
      }

      return false;
    });
    const mentorTodos = allTodos.filter((t) => mentorId === 'shahpoori' || (t.studentId && studentIds.has(t.studentId)) || t.mentorId === mentorId);
    const mentorDiscussions = allDiscussions.filter((g) => {
      if (mentorId === 'shahpoori') return true;
      if (g.mentorId === mentorId) return true;
      return Array.isArray(g.memberStudentIds) && g.memberStudentIds.some((sId: string) => studentIds.has(sId));
    });
    const mentorManagerFiles = allManagerFiles.filter((f) => {
      if (mentorId === 'shahpoori') return true;
      if (f.targetStudentId && studentIds.has(f.targetStudentId)) return true;
      return f.isPublic !== false;
    });

    const collections = [
      mentorStudents,
      mentorResearch,
      mentorResearchRecords,
      mentorResearchHistory,
      allResearchSkillsDef,
      mentorStudentResearchSkills,
      mentorArchives,
      mentorAttendance,
      mentorStats,
      mentorPeriodicLogs,
      mentorPeriods,
      mentorComments,
      mentorExams,
      mentorEnrollments,
      mentorPrograms,
      mentorTodos,
      mentorDiscussions,
      mentorManagerFiles,
      allAcademicPeriods,
      allAcademicHolidays,
      allAcademicHolidayTypes,
      allAcademicSubPeriods,
      allSettings,
      allTeachers
    ];

    const totalRecords = collections.reduce((acc, colItems) => acc + (colItems ? colItems.length : 0), 0);
    const hasPhotos = mentorStudents.some((s) => !!s.photoUrl);

    const backupPackage: MentorBackupPackage = {
      _meta: {
        version: '2.0.0-offline',
        exportDate: new Date().toISOString(),
        systemName: 'سیستم جامع مدیریت طلاب (آفلاین)',
        totalCollections: COLLECTIONS.length,
        totalRecords,
        hasPhotos,
        exportType: 'mentor',
        mentorId: meta.id,
        mentorName: meta.name,
        mentorRole: meta.role,
        gradeLabel: meta.gradeLabel
      },
      mentor: meta,
      students: mentorStudents,
      programs: mentorPrograms,
      enrollments: mentorEnrollments,
      research: mentorResearch,
      research_records: mentorResearchRecords,
      research_history: mentorResearchHistory,
      research_skills_def: allResearchSkillsDef,
      student_research_skills: mentorStudentResearchSkills,
      conversation_archives: mentorArchives,
      attendance: mentorAttendance,
      study_stats: mentorStats,
      study_periods: mentorPeriods,
      periodic_study_logs: mentorPeriodicLogs,
      todos: mentorTodos,
      student_comments: mentorComments,
      oral_exams: mentorExams,
      discussion_groups: mentorDiscussions,
      manager_files: mentorManagerFiles,
      academic_calendar_periods: allAcademicPeriods,
      academic_holidays: allAcademicHolidays,
      academic_holiday_types: allAcademicHolidayTypes,
      academic_sub_periods: allAcademicSubPeriods,
      settings: allSettings,
      teachers: allTeachers
    };

    return backupPackage;
  }

  // Export individual student backup
  async exportStudentBackup(studentId: string): Promise<StudentBackupPackage> {
    const student = await this.getDoc('students', studentId);
    if (!student) {
      throw new Error(`طلبه با شناسه ${studentId} یافت نشد.`);
    }

    const [
      allResearch,
      allResearchRecords,
      allResearchHistory,
      allStudentResearchSkills,
      allArchives,
      allAttendance,
      allStats,
      allPeriodicLogs,
      allPeriods,
      allComments,
      allExams,
      allEnrollments,
      allPrograms,
      allTodos,
      allDiscussions
    ] = await Promise.all([
      this.getDocs('research'),
      this.getDocs('research_records'),
      this.getDocs('research_history'),
      this.getDocs('student_research_skills'),
      this.getDocs('conversation_archives'),
      this.getDocs('attendance'),
      this.getDocs('study_stats'),
      this.getDocs('periodic_study_logs'),
      this.getDocs('study_periods'),
      this.getDocs('student_comments'),
      this.getDocs('oral_exams'),
      this.getDocs('enrollments'),
      this.getDocs('programs'),
      this.getDocs('todos'),
      this.getDocs('discussion_groups')
    ]);

    const studentResearch = allResearch.filter((r) => r.studentId === studentId);
    const studentResearchRecords = allResearchRecords.filter((r) => r.studentId === studentId);
    const studentResearchHistory = allResearchHistory.filter((r) => r.studentId === studentId);
    const studentResearchSkills = allStudentResearchSkills.filter((s) => s.studentId === studentId);
    const studentArchives = allArchives.filter((a) => a.studentId === studentId);
    const studentAttendance = allAttendance.filter((a) => a.studentId === studentId);
    const studentStats = allStats.filter((s) => s.studentId === studentId);
    const studentPeriodicLogs = allPeriodicLogs.filter((p) => p.studentId === studentId);
    const relevantPeriodIds = new Set(studentPeriodicLogs.map((p) => p.periodId));
    const studentPeriods = allPeriods.filter((p) => relevantPeriodIds.has(p.id));
    const studentComments = allComments.filter((c) => c.studentId === studentId);
    const studentExams = allExams.filter((e) => e.studentId === studentId);
    const studentEnrollments = allEnrollments.filter((e) => e.studentId === studentId);
    const relevantProgramIds = new Set(studentEnrollments.map((e) => e.programId));

    // Also include parent programs if student is enrolled in a linked counseling program
    allPrograms.forEach((p) => {
      if (relevantProgramIds.has(p.id) && p.parentProgramId) {
        relevantProgramIds.add(p.parentProgramId);
      }
    });

    const studentPrograms = allPrograms.filter((p) => relevantProgramIds.has(p.id));
    const studentTodos = allTodos.filter((t) => t.studentId === studentId);
    const studentDiscussions = allDiscussions.filter((g) => Array.isArray(g.memberStudentIds) && g.memberStudentIds.includes(studentId));

    const collections = [
      [student],
      studentResearch,
      studentResearchRecords,
      studentResearchHistory,
      studentResearchSkills,
      studentArchives,
      studentAttendance,
      studentStats,
      studentPeriodicLogs,
      studentPeriods,
      studentComments,
      studentExams,
      studentEnrollments,
      studentPrograms,
      studentTodos,
      studentDiscussions
    ];

    const totalRecords = collections.reduce((acc, colItems) => acc + (colItems ? colItems.length : 0), 0);

    const backupPackage: StudentBackupPackage = {
      _meta: {
        version: '2.0.0-offline',
        exportDate: new Date().toISOString(),
        systemName: 'سیستم جامع مدیریت طلاب (آفلاین)',
        totalCollections: COLLECTIONS.length,
        totalRecords,
        hasPhotos: !!student.photoUrl,
        exportType: 'single_student',
        studentId: student.id,
        studentName: student.name
      },
      student,
      research: studentResearch,
      research_records: studentResearchRecords,
      research_history: studentResearchHistory,
      student_research_skills: studentResearchSkills,
      conversation_archives: studentArchives,
      attendance: studentAttendance,
      study_stats: studentStats,
      periodic_study_logs: studentPeriodicLogs,
      study_periods: studentPeriods,
      student_comments: studentComments,
      oral_exams: studentExams,
      enrollments: studentEnrollments,
      programs: studentPrograms,
      todos: studentTodos,
      discussion_groups: studentDiscussions
    };

    return backupPackage;
  }

  // Restore full backup into local database
  async restoreFullBackup(
    backupData: FullBackupPackage,
    mode: 'overwrite' | 'merge' = 'overwrite'
  ): Promise<{ success: boolean; message: string; counts: Record<string, number> }> {
    if (!backupData || typeof backupData !== 'object') {
      throw new Error('فرمت فایل پشتیبان نامعتبر است.');
    }

    if (mode === 'overwrite') {
      await this.resetAllDatabase();
    }

    const counts: Record<string, number> = {};

    // Restore all collections present in COLLECTIONS or in the backup payload
    const allCollectionKeys = Array.from(new Set([
      ...COLLECTIONS,
      ...Object.keys(backupData).filter(k => !k.startsWith('_'))
    ]));

    for (const col of allCollectionKeys) {
      const items = (backupData as any)[col];
      if (Array.isArray(items) && items.length > 0) {
        await this.bulkPut(col as CollectionName, items);
        counts[col] = items.length;
      }
    }

    this.notify();
    return {
      success: true,
      message: `بازیابی کامل اطلاعات با موفقیت انجام شد (${mode === 'overwrite' ? 'جایگزینی کل داده‌ها' : 'ادغام با داده‌های موجود'}).`,
      counts
    };
  }

  async importFullBackup(
    backupData: any,
    mode: 'overwrite' | 'merge' = 'merge'
  ): Promise<any> {
    if (backupData?.data && typeof backupData.data === 'object' && !backupData.students) {
      // Legacy format where data is inside backupData.data
      const dataMap = backupData.data;
      for (const [col, items] of Object.entries(dataMap)) {
        if (Array.isArray(items)) {
          await this.bulkPut(col as CollectionName, items);
        }
      }
      this.notify();
      return { success: true, message: 'داده‌ها با موفقیت بازیابی شدند.' };
    }
    return this.restoreFullBackup(backupData, mode);
  }

  // Restore individual mentor/user backup
  async restoreMentorBackup(
    backupData: MentorBackupPackage,
    mode: 'overwrite' | 'merge' = 'merge'
  ): Promise<{ success: boolean; mentorName: string; studentCount: number; message: string; counts: Record<string, number> }> {
    if (!backupData || !backupData.mentor || !Array.isArray(backupData.students)) {
      throw new Error('فایل پشتیبان کاربر/استاد نامعتبر است.');
    }

    const mentorId = backupData.mentor.id;
    const incomingStudentIds = new Set(backupData.students.map((s) => s.id));

    if (mode === 'overwrite') {
      // Find existing students for this mentor's grade and clear their data
      const allStudents = await this.getDocs('students');
      const studentsToRemove = allStudents.filter((s) => {
        if (mentorId === 'shahpoori') return true;
        const key = getMentorKeyForGrade(s.grade);
        return key === mentorId;
      });
      const removeIds = new Set(studentsToRemove.map((s) => s.id));

      const cols: CollectionName[] = [
        'research',
        'research_records',
        'research_history',
        'student_research_skills',
        'conversation_archives',
        'attendance',
        'study_stats',
        'periodic_study_logs',
        'student_comments',
        'oral_exams',
        'enrollments',
        'todos'
      ];

      for (const col of cols) {
        const records = await this.getDocs(col);
        const toDelete = records.filter((r: any) => removeIds.has(r.studentId));
        for (const item of toDelete) {
          await this.deleteDoc(col, item.id);
        }
      }

      for (const s of studentsToRemove) {
        await this.deleteDoc('students', s.id);
      }
    }

    const counts: Record<string, number> = {};

    const collectionsToRestore: (keyof MentorBackupPackage)[] = [
      'students',
      'programs',
      'enrollments',
      'research',
      'research_records',
      'research_history',
      'research_skills_def',
      'student_research_skills',
      'conversation_archives',
      'attendance',
      'study_stats',
      'study_periods',
      'periodic_study_logs',
      'todos',
      'student_comments',
      'oral_exams',
      'discussion_groups',
      'manager_files',
      'academic_calendar_periods',
      'academic_holidays',
      'academic_holiday_types',
      'academic_sub_periods',
      'settings',
      'teachers'
    ];

    for (const key of collectionsToRestore) {
      const items = backupData[key] as any[];
      if (Array.isArray(items) && items.length > 0) {
        await this.bulkPut(key as CollectionName, items);
        counts[key] = items.length;
      } else {
        counts[key] = 0;
      }
    }

    this.notify();
    return {
      success: true,
      mentorName: backupData.mentor.name || 'استاد',
      studentCount: backupData.students.length,
      message: `اطلاعات و پرونده‌های ${backupData.mentor.name} (${backupData.mentor.role}) با موفقیت بازیابی شد (${backupData.students.length} طلبه).`,
      counts
    };
  }

  // Universal Restore handler that detects package type
  async restoreAnyBackup(
    backupData: any,
    mode: 'overwrite' | 'merge' = 'merge'
  ): Promise<{ success: boolean; message: string; type: string; details?: any }> {
    if (!backupData || typeof backupData !== 'object') {
      throw new Error('فرمت فایل پشتیبان نامعتبر است.');
    }

    // 1. Check if it's single student backup
    if (backupData._meta?.exportType === 'single_student' || (backupData.student && backupData.student.name)) {
      const res = await this.restoreStudentBackup(backupData, mode);
      return {
        success: true,
        type: 'student',
        message: `پرونده طلبه «${res.studentName}» با موفقیت بازیابی شد.`,
        details: res
      };
    }

    // 2. Check if it's mentor/user backup
    if (backupData._meta?.exportType === 'mentor' || (backupData.mentor && Array.isArray(backupData.students))) {
      const res = await this.restoreMentorBackup(backupData, mode);
      return {
        success: true,
        type: 'mentor',
        message: res.message,
        details: res
      };
    }

    // 3. Fallback to Full Backup
    const res = await this.restoreFullBackup(backupData, mode);
    return {
      success: true,
      type: 'full',
      message: res.message,
      details: res
    };
  }

  // Restore single student backup into local database
  async restoreStudentBackup(
    backupData: StudentBackupPackage,
    mode: 'overwrite' | 'merge' = 'merge'
  ): Promise<{ success: boolean; studentName: string; counts: Record<string, number> }> {
    if (!backupData || !backupData.student || !backupData.student.name) {
      throw new Error('فایل پشتیبان پرونده طلبه نامعتبر است.');
    }

    const student = backupData.student;
    const studentId = student.id;

    if (mode === 'overwrite') {
      // Remove any existing records of this student before importing
      const studentCols: CollectionName[] = [
        'research',
        'research_records',
        'research_history',
        'student_research_skills',
        'conversation_archives',
        'attendance',
        'study_stats',
        'periodic_study_logs',
        'student_comments',
        'oral_exams',
        'enrollments',
        'todos'
      ];

      for (const col of studentCols) {
        const records = await this.getDocs(col);
        const toDelete = records.filter((r: any) => r.studentId === studentId);
        for (const item of toDelete) {
          await this.deleteDoc(col, item.id);
        }
      }
    }

    // Save student
    await this.addDoc('students', student);

    const counts: Record<string, number> = { students: 1 };

    // Restore related arrays
    const subMappings: { key: keyof StudentBackupPackage; col: CollectionName }[] = [
      { key: 'research', col: 'research' },
      { key: 'research_records', col: 'research_records' },
      { key: 'research_history', col: 'research_history' },
      { key: 'student_research_skills', col: 'student_research_skills' },
      { key: 'conversation_archives', col: 'conversation_archives' },
      { key: 'attendance', col: 'attendance' },
      { key: 'study_stats', col: 'study_stats' },
      { key: 'periodic_study_logs', col: 'periodic_study_logs' },
      { key: 'study_periods', col: 'study_periods' },
      { key: 'student_comments', col: 'student_comments' },
      { key: 'oral_exams', col: 'oral_exams' },
      { key: 'enrollments', col: 'enrollments' },
      { key: 'programs', col: 'programs' },
      { key: 'todos', col: 'todos' },
      { key: 'discussion_groups', col: 'discussion_groups' },
      { key: 'academic_calendar_periods', col: 'academic_calendar_periods' },
      { key: 'academic_holidays', col: 'academic_holidays' },
      { key: 'academic_holiday_types', col: 'academic_holiday_types' },
      { key: 'academic_sub_periods', col: 'academic_sub_periods' }
    ];

    for (const mapping of subMappings) {
      const items = backupData[mapping.key] as any[];
      if (Array.isArray(items) && items.length > 0) {
        await this.bulkPut(mapping.col, items);
        counts[mapping.col] = items.length;
      }
    }

    this.notify();
    return {
      success: true,
      studentName: student.name,
      counts
    };
  }

  // Scan database to find duplicate students based on nationalId
  async scanDuplicateStudents(): Promise<DuplicateGroup[]> {
    const allStudents = await this.getDocs<any>('students');
    const [
      enrollments,
      research,
      conversations,
      attendance,
      studyStats,
      studyLogs,
      todos,
      comments,
      oralExams
    ] = await Promise.all([
      this.getDocs('enrollments'),
      this.getDocs('research'),
      this.getDocs('conversation_archives'),
      this.getDocs('attendance'),
      this.getDocs('study_stats'),
      this.getDocs('periodic_study_logs'),
      this.getDocs('todos'),
      this.getDocs('student_comments'),
      this.getDocs('oral_exams')
    ]);

    // Group by normalized nationalId
    const groupsMap = new Map<string, any[]>();
    for (const s of allStudents) {
      const normNId = normalizeNationalId(s.nationalId);
      if (!normNId || normNId.length < 3) continue; // Only consider valid non-empty national IDs
      if (!groupsMap.has(normNId)) {
        groupsMap.set(normNId, []);
      }
      groupsMap.get(normNId)!.push(s);
    }

    const duplicateGroups: DuplicateGroup[] = [];
    for (const [nationalId, list] of groupsMap.entries()) {
      if (list.length > 1) {
        // Score each candidate to pick the best primary record
        const scored = list.map((s) => {
          let score = 0;
          if (s.photoUrl && s.photoUrl.length > 50) score += 50;
          if (s.name && s.name.trim() !== 'نامشخص') score += 10;
          if (s.phoneNumber) score += 5;
          if (s.grade) score += 5;
          if (s.fatherOccupation) score += 2;
          if (s.birthDate) score += 2;
          if (s.classicEducation) score += 2;
          if (s.levelOneSchool) score += 2;
          if (isStudentActive(s)) score += 10;

          const relCount =
            enrollments.filter((e: any) => e.studentId === s.id).length +
            research.filter((r: any) => r.studentId === s.id || (r.teamMemberIds && r.teamMemberIds.includes(s.id))).length +
            conversations.filter((c: any) => c.studentId === s.id).length +
            attendance.filter((a: any) => a.studentId === s.id).length +
            studyStats.filter((st: any) => st.studentId === s.id).length +
            studyLogs.filter((sl: any) => sl.studentId === s.id).length +
            todos.filter((t: any) => t.studentId === s.id).length +
            comments.filter((cm: any) => cm.studentId === s.id).length +
            oralExams.filter((ox: any) => ox.studentId === s.id).length;

          score += relCount * 5;

          return { student: s, score, relCount };
        });

        scored.sort((a, b) => b.score - a.score);
        const primaryCandidateId = scored[0].student.id;
        const totalRelatedRecords = scored.reduce((acc, curr) => acc + curr.relCount, 0);

        duplicateGroups.push({
          nationalId,
          students: list,
          primaryCandidateId,
          totalRelatedRecords
        });
      }
    }

    return duplicateGroups;
  }

  // Merges all duplicate students into a primary record and re-assigns all related data before deleting duplicate records
  async mergeAndDeduplicateStudents(): Promise<MergeResult> {
    const groups = await this.scanDuplicateStudents();
    if (groups.length === 0) {
      return {
        success: true,
        duplicateGroupsCount: 0,
        mergedStudentsCount: 0,
        updatedRelatedRecordsCount: 0,
        message: 'هیچ کاربر تکراری با کد ملی مشابه در سامانه یافت نشد. کلیه پرونده‌ها یکتا هستند.',
        details: []
      };
    }

    const [
      enrollments,
      research,
      conversations,
      attendance,
      studyStats,
      studyLogs,
      todos,
      comments,
      oralExams
    ] = await Promise.all([
      this.getDocs('enrollments'),
      this.getDocs('research'),
      this.getDocs('conversation_archives'),
      this.getDocs('attendance'),
      this.getDocs('study_stats'),
      this.getDocs('periodic_study_logs'),
      this.getDocs('todos'),
      this.getDocs('student_comments'),
      this.getDocs('oral_exams')
    ]);

    let totalMergedCount = 0;
    let totalRelatedUpdated = 0;
    const details: MergeResult['details'] = [];

    for (const grp of groups) {
      const primary = grp.students.find((s) => s.id === grp.primaryCandidateId) || grp.students[0];
      const secondaries = grp.students.filter((s) => s.id !== primary.id);
      const secondaryIds = new Set(secondaries.map((s) => s.id));

      // 1. Merge Profile Data into Primary Record so that NO profile fields are lost
      const mergedStudent: any = { ...primary };

      for (const sec of secondaries) {
        if (!mergedStudent.photoUrl && sec.photoUrl) mergedStudent.photoUrl = sec.photoUrl;
        if ((!mergedStudent.name || mergedStudent.name === 'نامشخص') && sec.name) mergedStudent.name = sec.name;
        else if (sec.name && sec.name.length > (mergedStudent.name?.length || 0)) mergedStudent.name = sec.name;

        if (!mergedStudent.phoneNumber && sec.phoneNumber) mergedStudent.phoneNumber = sec.phoneNumber;
        if (!mergedStudent.grade && sec.grade) mergedStudent.grade = sec.grade;
        if (!mergedStudent.fatherOccupation && sec.fatherOccupation) mergedStudent.fatherOccupation = sec.fatherOccupation;
        if (!mergedStudent.birthPlace && sec.birthPlace) mergedStudent.birthPlace = sec.birthPlace;
        if (!mergedStudent.birthDate && sec.birthDate) mergedStudent.birthDate = sec.birthDate;
        if ((!mergedStudent.maritalStatus || mergedStudent.maritalStatus === 'مجرد') && sec.maritalStatus === 'متاهل') {
          mergedStudent.maritalStatus = 'متاهل';
        }
        if ((sec.childrenCount || 0) > (mergedStudent.childrenCount || 0)) {
          mergedStudent.childrenCount = sec.childrenCount;
        }
        if ((!mergedStudent.livingStatus || mergedStudent.livingStatus === 'پدری') && sec.livingStatus && sec.livingStatus !== 'پدری') {
          mergedStudent.livingStatus = sec.livingStatus;
        }
        if (!mergedStudent.livingStatusOther && sec.livingStatusOther) mergedStudent.livingStatusOther = sec.livingStatusOther;
        if (!mergedStudent.classicEducation && sec.classicEducation) mergedStudent.classicEducation = sec.classicEducation;
        if (!mergedStudent.howzaEntryYear && sec.howzaEntryYear) mergedStudent.howzaEntryYear = sec.howzaEntryYear;
        if (!mergedStudent.levelOneSchool && sec.levelOneSchool) mergedStudent.levelOneSchool = sec.levelOneSchool;
        if ((!mergedStudent.tammomStatus || mergedStudent.tammomStatus === 'غیر معمم') && sec.tammomStatus === 'معمم') {
          mergedStudent.tammomStatus = 'معمم';
        }
        if (isStudentActive(sec) || isStudentActive(mergedStudent)) {
          mergedStudent.isActive = true;
        }
        if (sec.createdAt && mergedStudent.createdAt && new Date(sec.createdAt) < new Date(mergedStudent.createdAt)) {
          mergedStudent.createdAt = sec.createdAt;
        }
      }

      // Save updated merged primary student
      await this.updateDoc('students', primary.id, mergedStudent);

      // 2. Re-assign and merge all related records across every collection in the software

      // A. Enrollments
      const primaryEnrollmentProgramIds = new Set(
        enrollments.filter((e: any) => e.studentId === primary.id).map((e: any) => e.programId)
      );
      for (const e of enrollments) {
        if (secondaryIds.has(e.studentId)) {
          if (primaryEnrollmentProgramIds.has(e.programId)) {
            // Already enrolled, delete duplicate enrollment
            await this.deleteDoc('enrollments', e.id);
          } else {
            await this.updateDoc('enrollments', e.id, { studentId: primary.id });
            primaryEnrollmentProgramIds.add(e.programId);
            totalRelatedUpdated++;
          }
        }
      }

      // B. Research & Research Records
      for (const r of research) {
        let changed = false;
        const updates: any = {};
        if (secondaryIds.has(r.studentId)) {
          updates.studentId = primary.id;
          changed = true;
        }
        if (Array.isArray(r.teamMemberIds)) {
          const newTeamIds = Array.from(new Set(r.teamMemberIds.map((mId: string) => secondaryIds.has(mId) ? primary.id : mId)));
          if (JSON.stringify(newTeamIds) !== JSON.stringify(r.teamMemberIds)) {
            updates.teamMemberIds = newTeamIds;
            changed = true;
          }
        }
        if (changed) {
          await this.updateDoc('research', r.id, updates);
          totalRelatedUpdated++;
        }
      }

      // C. Conversation Archives
      for (const c of conversations) {
        if (secondaryIds.has(c.studentId)) {
          await this.updateDoc('conversation_archives', c.id, { studentId: primary.id });
          totalRelatedUpdated++;
        }
      }

      // D. Attendance
      const primaryAttendanceDates = new Set(
        attendance.filter((a: any) => a.studentId === primary.id).map((a: any) => a.date)
      );
      for (const a of attendance) {
        if (secondaryIds.has(a.studentId)) {
          if (primaryAttendanceDates.has(a.date)) {
            // Duplicate date attendance, remove duplicate
            await this.deleteDoc('attendance', a.id);
          } else {
            await this.updateDoc('attendance', a.id, { studentId: primary.id });
            primaryAttendanceDates.add(a.date);
            totalRelatedUpdated++;
          }
        }
      }

      // E. Study Stats
      const primaryStudyStatDates = new Set(
        studyStats.filter((st: any) => st.studentId === primary.id).map((st: any) => st.date)
      );
      for (const st of studyStats) {
        if (secondaryIds.has(st.studentId)) {
          if (primaryStudyStatDates.has(st.date)) {
            await this.deleteDoc('study_stats', st.id);
          } else {
            await this.updateDoc('study_stats', st.id, { studentId: primary.id });
            primaryStudyStatDates.add(st.date);
            totalRelatedUpdated++;
          }
        }
      }

      // F. Periodic Study Logs
      const primaryPeriodLogs = new Set(
        studyLogs.filter((sl: any) => sl.studentId === primary.id).map((sl: any) => sl.periodId)
      );
      for (const sl of studyLogs) {
        if (secondaryIds.has(sl.studentId)) {
          if (primaryPeriodLogs.has(sl.periodId)) {
            await this.deleteDoc('periodic_study_logs', sl.id);
          } else {
            await this.updateDoc('periodic_study_logs', sl.id, { studentId: primary.id });
            primaryPeriodLogs.add(sl.periodId);
            totalRelatedUpdated++;
          }
        }
      }

      // G. Todos
      for (const t of todos) {
        if (t.studentId && secondaryIds.has(t.studentId)) {
          await this.updateDoc('todos', t.id, { studentId: primary.id });
          totalRelatedUpdated++;
        }
      }

      // H. Student Comments
      for (const cm of comments) {
        if (secondaryIds.has(cm.studentId)) {
          await this.updateDoc('student_comments', cm.id, { studentId: primary.id });
          totalRelatedUpdated++;
        }
      }

      // I. Oral Exams
      for (const ox of oralExams) {
        if (secondaryIds.has(ox.studentId)) {
          await this.updateDoc('oral_exams', ox.id, { studentId: primary.id });
          totalRelatedUpdated++;
        }
      }

      // 3. Delete secondary duplicate students safely after all data has been merged
      for (const sec of secondaries) {
        await this.deleteDoc('students', sec.id);
        totalMergedCount++;
      }

      details.push({
        nationalId: grp.nationalId,
        primaryStudentName: mergedStudent.name,
        mergedNames: grp.students.map((s) => s.name),
        removedCount: secondaries.length
      });
    }

    this.notify();

    return {
      success: true,
      duplicateGroupsCount: groups.length,
      mergedStudentsCount: totalMergedCount,
      updatedRelatedRecordsCount: totalRelatedUpdated,
      message: `فرآیند ادغام با موفقیت انجام شد: تعداد ${totalMergedCount} پرونده تکراری شناسایی و ادغام شد و تمامی سوابق تحصیلی، پژوهشی و نمرات (${totalRelatedUpdated} رکورد) به پرونده اصلی منتقل گردید.`,
      details
    };
  }

  // Get statistics on database size and photos
  async getStorageStats(): Promise<{
    totalStudents: number;
    totalActiveStudents: number;
    totalPhotos: number;
    photosSizeEstimateKB: number;
    collectionCounts: Record<string, number>;
  }> {
    const students = await this.getDocs('students');
    let totalPhotos = 0;
    let photosSizeEstimateBytes = 0;

    for (const s of students) {
      if (s.photoUrl && s.photoUrl.startsWith('data:')) {
        totalPhotos++;
        photosSizeEstimateBytes += s.photoUrl.length;
      }
    }

    const collectionCounts: Record<string, number> = {
      students: students.length
    };

    for (const col of COLLECTIONS) {
      if (col !== 'students') {
        const items = await this.getDocs(col);
        collectionCounts[col] = items.length;
      }
    }

    return {
      totalStudents: students.length,
      totalActiveStudents: students.filter((s) => s.isActive).length,
      totalPhotos,
      photosSizeEstimateKB: Math.round(photosSizeEstimateBytes / 1024),
      collectionCounts
    };
  }

  // Seed default data if database is empty
  private async checkAndSeedDefaultData(db: IDBDatabase) {
    try {
      if (!db.objectStoreNames.contains('students')) return;
      const transaction = db.transaction('students', 'readonly');
      const store = transaction.objectStore('students');
      const countReq = store.count();

      countReq.onsuccess = async () => {
        if (countReq.result === 0) {
          console.log('Local Database is empty. Seeding initial baseline data...');
          const initialStudents = [
          {
            id: 'stu_1',
            name: 'محمد رضایی',
            grade: 'پایه ۷',
            nationalId: '0012345678',
            phoneNumber: '09121111111',
            isActive: true,
            maritalStatus: 'مجرد',
            livingStatus: 'خوابگاه',
            classicEducation: 'دیپلم ریاضی',
            howzaEntryYear: '1400',
            levelOneSchool: 'مدرسه معصومیه',
            tammomStatus: 'غیر معمم',
            createdAt: new Date().toISOString()
          },
          {
            id: 'stu_2',
            name: 'علی حسینی',
            grade: 'پایه ۸',
            nationalId: '0023456789',
            phoneNumber: '09122222222',
            isActive: true,
            maritalStatus: 'متاهل',
            childrenCount: 1,
            livingStatus: 'اجاره ای',
            classicEducation: 'کارشناسی ادبیات',
            howzaEntryYear: '1399',
            levelOneSchool: 'مدرسه حقانی',
            tammomStatus: 'معمم',
            createdAt: new Date().toISOString()
          },
          {
            id: 'stu_3',
            name: 'حسین سلیمانی',
            grade: 'پایه ۹',
            nationalId: '0034567890',
            phoneNumber: '09123333333',
            isActive: true,
            maritalStatus: 'مجرد',
            livingStatus: 'پدری',
            classicEducation: 'دیپلم علوم انسانی',
            howzaEntryYear: '1398',
            levelOneSchool: 'مدرسه شهیدین',
            tammomStatus: 'غیر معمم',
            createdAt: new Date().toISOString()
          }
        ];

        const initialPrograms = [
          {
            id: 'prog_1',
            title: 'درس خارج فقه و اصول',
            type: 'اصلی',
            day: 'شنبه تا چهارشنبه',
            time: '08:00 - 09:30',
            teacher: 'استاد حسینی'
          },
          {
            id: 'prog_2',
            title: 'کارگاه روش تحقیق و مقاله‌نویسی',
            type: 'پژوهش',
            day: 'پنج‌شنبه',
            time: '10:00 - 11:30',
            teacher: 'استاد حیاتی'
          }
        ];

        const initialEnrollments = [
          { id: 'enr_1', studentId: 'stu_1', programId: 'prog_1' },
          { id: 'enr_2', studentId: 'stu_1', programId: 'prog_2' },
          { id: 'enr_3', studentId: 'stu_2', programId: 'prog_1' }
        ];

        const initialStudyPeriods = [
          {
            id: 'period_1',
            title: 'دوره مطالعه آبان و آذر',
            startDate: '1403/08/01',
            endDate: '1403/09/30',
            mandatoryHours: 80,
            createdAt: new Date().toISOString()
          }
        ];

        const initialPeriodicLogs = [
          { id: 'log_1', periodId: 'period_1', studentId: 'stu_1', hours: 75 },
          { id: 'log_2', periodId: 'period_1', studentId: 'stu_2', hours: 88 },
          { id: 'log_3', periodId: 'period_1', studentId: 'stu_3', hours: 62 }
        ];

        const initialComments = [
          {
            id: 'com_1',
            studentId: 'stu_1',
            authorName: 'استاد حیاتی',
            category: 'علمی',
            content: 'پیشرفت بسیار خوبی در مباحث مکاسب داشته است و منظم در کلاس شرکت می‌کند.',
            priority: 'high',
            date: '1403/08/15',
            createdAt: new Date().toISOString()
          }
        ];

        const initialOralExams = [
          {
            id: 'exam_1',
            studentId: 'stu_1',
            title: 'فقه پایه ۷ (مکاسب)',
            subjectType: 'فقه',
            score: 18.5,
            examinerName: 'استاد ممتحن فقه',
            date: '1403/08/10',
            isRetake: false,
            createdAt: new Date().toISOString()
          }
        ];

        const initialTodos = [
          {
            id: 'todo_1',
            studentId: 'stu_1',
            title: 'بررسی پیش‌نویس مقاله پژوهشی طلبه محمد رضایی',
            completed: false,
            dueDate: '1403/09/01',
            createdAt: new Date().toISOString()
          }
        ];

        const initialDiscussionGroups = [
          {
            id: 'group_1',
            title: 'گروه مباحثه مکاسب و اصول',
            subject: 'فقه و اصول',
            grade: 'پایه ۷',
            mentorId: 'hayati',
            memberStudentIds: ['stu_1'],
            externalMembers: ['طلبه کاظمی (سایر - خارج از مدرسه)'],
            description: 'مباحثه روزانه کتاب مکاسب بعد از درس اصلی',
            createdAt: new Date().toISOString()
          },
          {
            id: 'group_2',
            title: 'گروه مباحثه رسائل و حلقه ثالثه',
            subject: 'اصول فقه',
            grade: 'پایه ۸',
            mentorId: 'hosseini',
            memberStudentIds: ['stu_2'],
            externalMembers: ['طلبه حسینی (سایر)'],
            description: 'مباحثه تخصصی مباحث الفاظ و حجج',
            createdAt: new Date().toISOString()
          }
        ];

        await Promise.all([
          this.bulkPut('students', initialStudents),
          this.bulkPut('programs', initialPrograms),
          this.bulkPut('enrollments', initialEnrollments),
          this.bulkPut('study_periods', initialStudyPeriods),
          this.bulkPut('periodic_study_logs', initialPeriodicLogs),
          this.bulkPut('student_comments', initialComments),
          this.bulkPut('oral_exams', initialOralExams),
          this.bulkPut('todos', initialTodos),
          this.bulkPut('discussion_groups', initialDiscussionGroups)
        ]);
      }

      // Check and seed workflow_settings & workflow_items if empty
      const existingSettings = await this.getDocs('workflow_settings');
      if (!existingSettings || existingSettings.length === 0) {
        await this.addDoc('workflow_settings', {
          id: 'default_workflow_settings',
          requireEducationApprovalForAttendanceWarning: true,
          requireEducationApprovalForStudyWarning: true,
          requireAccountCreationPrompt: true,
          notifyGradeSupervisorOnWarning: true,
          notifyOnStudyPeriodOpened: true,
          notifyOnStudyPeriodClosed: true,
          updatedAt: new Date().toISOString()
        });
      }

      const existingWorkflow = await this.getDocs('workflow_items');
      if (!existingWorkflow || existingWorkflow.length === 0) {
        const initialWorkflowItems = [
          {
            id: 'wf_1',
            type: 'report_notice',
            category: 'study_period',
            title: 'بازگشایی دوره جدید ثبت مطالعه توسط مسئول آموزش',
            description: 'دوره جدید ثبت مطالعه برای همه پایه‌ها برای بازه زمانی ۰۱ مهر تا ۱۵ مهر ایجاد شد. طلاب محترم و مسئولین پایه می‌توانند ساعات مطالعه و مباحثات را ثبت نمایند.',
            status: 'acknowledged',
            grade: 'همه پایه‌ها',
            periodTitle: 'دوره اول مهرماه ۱۴۰۳',
            dateRange: '۱۴۰۳/۰۷/۰۱ تا ۱۴۰۳/۰۷/۱۵',
            requiresEducationApproval: false,
            reportAction: {
              label: 'مشاهده آمار و گزارش مطالعه',
              tabTarget: 'stats',
              description: 'بررسی شاخص‌های تفکیکی مطالعه و ساعات مباحثه'
            },
            createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString()
          },
          {
            id: 'wf_2',
            type: 'approval',
            category: 'unexcused_absence_warning',
            title: 'ثبت اخطار غیبت غیرموجه: طلبه علی موسوی',
            description: 'طلبه علی موسوی (پایه ۷) دارای ۳ جلسه غیبت غیرموجه در هفته جاری است. بر اساس آئین‌نامه آموزشی، ثبت نهایی اخطار منوط به تایید مسئول آموزش است.',
            status: 'pending',
            grade: 'پایه ۷',
            studentName: 'علی موسوی',
            details: {
              unexcusedAbsences: 3,
              course: 'فقه (مکاسب)',
              dates: ['۱۴۰۳/۰۷/۰۸', '۱۴۰۳/۰۷/۰۹', '۱۴۰۳/۰۷/۱۰']
            },
            requiresEducationApproval: true,
            reportAction: {
              label: 'گزارش حضور و غیاب',
              tabTarget: 'attendance',
              description: 'مشاهده ریز جزئیات جلسات و غیبت‌های ثبت شده'
            },
            createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
          },
          {
            id: 'wf_3',
            type: 'approval',
            category: 'study_deficit_warning',
            title: 'ثبت اخطار ساعت مطالعه و مباحثه: طلبه محمد حسینی',
            description: 'طلبه محمد حسینی (پایه ۸) به علت ثبت ۱۸ ساعت مطالعه و مباحثه (کسری ۱۲ ساعت از سقف الزامی ۳۰ ساعت) مشمول ثبت اخطار شده است. تایید قطعی منوط به نظر مسئول آموزش می‌باشد.',
            status: 'pending',
            grade: 'پایه ۸',
            studentName: 'محمد حسینی',
            details: {
              mandatoryHours: 30,
              loggedHours: 18,
              deficitHours: 12,
              period: 'دوره اول مهرماه ۱۴۰۳'
            },
            requiresEducationApproval: true,
            reportAction: {
              label: 'کارنامه مطالعه و مباحثه',
              tabTarget: 'discussion',
              description: 'مشاهده جزئیات گروه‌های مباحثه و لاگ‌های ثبت‌شده'
            },
            createdAt: new Date(Date.now() - 3600000 * 8).toISOString()
          },
          {
            id: 'wf_4',
            type: 'notice',
            category: 'study_period',
            title: 'پایان مهلت و بسته شدن بازه ثبت مطالعه',
            description: 'مهلت ثبت ساعت مطالعه دوره شهریور ماه پایان یافت و سامانه برای ثبت دیرکرد بسته شد. گزارش تجمیعی در بخش آمار قابل دسترسی است.',
            status: 'acknowledged',
            grade: 'همه پایه‌ها',
            periodTitle: 'دوره شهریور ماه ۱۴۰۳',
            requiresEducationApproval: false,
            createdAt: new Date(Date.now() - 3600000 * 24 * 7).toISOString()
          },
          {
            id: 'wf_5',
            type: 'report_notice',
            category: 'unexcused_absence_warning',
            title: 'ابلاغ اخطار غیبت غیرموجه به مسئول پایه: طلبه صادق مرادی',
            description: 'اخطار غیبت غیرموجه طلبه صادق مرادی (پایه ۹) پس از تایید نهایی مسئول آموزش، به پرونده طلبه الصاق و به مسئول محترم پایه ۹ نیز ابلاغ گردید.',
            status: 'approved',
            grade: 'پایه ۹',
            studentName: 'صادق مرادی',
            requiresEducationApproval: true,
            approvedByName: 'مسئول آموزش (استاد شاهپوری)',
            approvedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
            reportAction: {
              label: 'پرونده حضور و غیاب پایه ۹',
              tabTarget: 'attendance'
            },
            createdAt: new Date(Date.now() - 3600000 * 20).toISOString()
          }
        ];
        await this.bulkPut('workflow_items', initialWorkflowItems);
      }

      // Check and seed default audit_logs if empty
      const existingAudit = await this.getDocs('audit_logs');
      if (!existingAudit || existingAudit.length === 0) {
        const initialAuditLogs = [
          {
            id: 'audit_1',
            timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
            shamsiDate: '1403/08/20',
            shamsiTime: '10:15:22',
            userId: 'user_yazdani',
            userName: 'استاد یزدانی (مسئول پژوهش)',
            username: 'YAZDANI',
            userRole: 'research_manager',
            userRoleTitle: 'مسئول پژوهش',
            userLevel: 2,
            actionType: 'update',
            module: 'research',
            moduleTitle: 'بخش پژوهش و مقالات',
            entityType: 'research',
            entityId: 'res_101',
            entityName: 'مقاله بررسی تطبیقی درایه الحدیث',
            description: 'ویرایش وضعیت مقاله علمی طلبه محمد رضایی به مرحله «ارزیابی نهایی استاد»',
            previousState: { id: 'res_101', status: 'در حال نگارش', score: 14 },
            newState: { id: 'res_101', status: 'ارزیابی نهایی استاد', score: 18 },
            isReverted: false
          },
          {
            id: 'audit_2',
            timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
            shamsiDate: '1403/08/20',
            shamsiTime: '08:30:10',
            userId: 'user_shah',
            userName: 'استاد شاهپوری (مسئول آموزش)',
            username: 'SHAH',
            userRole: 'education_manager',
            userRoleTitle: 'مسئول آموزش',
            userLevel: 2,
            actionType: 'delete',
            module: 'programs',
            moduleTitle: 'برنامه‌های مدرسه و مدرس‌ها',
            entityType: 'programs',
            entityId: 'prog_temp_9',
            entityName: 'کلاس فوق‌العاده مکاسب پایه ۸',
            description: 'حذف کلاس درس فوق‌العاده مکاسب پایه ۸ از لیست برنامه درسی مدرس ۱',
            previousState: { id: 'prog_temp_9', title: 'کلاس فوق‌العاده مکاسب پایه ۸', day: 'پنج‌شنبه', time: '10:00 - 11:30' },
            isReverted: false
          },
          {
            id: 'audit_3',
            timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
            shamsiDate: '1403/08/19',
            shamsiTime: '16:45:00',
            userId: 'user_mali',
            userName: 'مسئول مالی و اداری',
            username: 'MALI',
            userRole: 'finance_manager',
            userRoleTitle: 'مسئول مالی و کارکرد',
            userLevel: 2,
            actionType: 'update',
            module: 'presence-hours',
            moduleTitle: 'ساعت حضور و کارکرد اساتید',
            entityType: 'presence_hours',
            entityId: 'pres_55',
            entityName: 'کارکرد آبان ماه اساتید',
            description: 'تأیید و به‌روزرسانی ساعات حضور و کارکرد اساتید پایه ۷ و ۸ در مهر ماه',
            previousState: { id: 'pres_55', approvedHours: 40 },
            newState: { id: 'pres_55', approvedHours: 52 },
            isReverted: false
          },
          {
            id: 'audit_4',
            timestamp: new Date(Date.now() - 3600000 * 36).toISOString(),
            shamsiDate: '1403/08/18',
            shamsiTime: '11:10:05',
            userId: 'user_isj',
            userName: 'استاد حیاتی (مسئول پایه ۷)',
            username: 'ISJ',
            userRole: 'grade_mentor',
            userRoleTitle: 'مسئول پایه ۷',
            userLevel: 2,
            actionType: 'create',
            module: 'discussion',
            moduleTitle: 'گروه‌های بحثی',
            entityType: 'discussion_groups',
            entityId: 'group_702',
            entityName: 'گروه مباحثه النحو الواضح پایه ۷',
            description: 'ایجاد گروه مباحثه جدید «النحو الواضح» با عضویت طلاب پایه ۷',
            newState: { id: 'group_702', title: 'گروه مباحثه النحو الواضح پایه ۷', grade: 'پایه ۷' },
            isReverted: false
          },
          {
            id: 'audit_5',
            timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
            shamsiDate: '1403/08/17',
            shamsiTime: '14:20:15',
            userId: 'user_sarlak',
            userName: 'طلبه سرلک (نماینده کلاس)',
            username: 'SARLAK',
            userRole: 'class_representative',
            userRoleTitle: 'نماینده کلاس',
            userLevel: 3,
            actionType: 'update',
            module: 'attendance',
            moduleTitle: 'حضور و غیاب طلاب',
            entityType: 'attendance',
            entityId: 'att_88',
            entityName: 'حضور و غیاب کلاس فقه ۲ دوشنبه',
            description: 'ویرایش و اصلاح لیست حضور و غیاب جلسه دوشنبه درس فقه پایه ۷',
            previousState: { id: 'att_88', presentCount: 12 },
            newState: { id: 'att_88', presentCount: 14 },
            isReverted: false
          }
        ];
        await this.bulkPut('audit_logs', initialAuditLogs);
      }
    };
    } catch (e) {
      console.warn('Seed data check error:', e);
    }
  }

  // Proactively fetch all major collections from Supabase on application launch
  async initCloudSync(): Promise<void> {
    if (!isSupabaseConfigured || typeof window === 'undefined') return;
    const coreCollections: CollectionName[] = [
      'classrooms',
      'teachers',
      'teacher_schedules',
      'programs',
      'students',
      'enrollments',
      'attendance',
      'attendance_settings',
      'study_stats',
      'study_periods',
      'periodic_study_logs',
      'discussion_groups',
      'research',
      'research_history',
      'research_skills_def',
      'student_research_skills',
      'conversation_archives',
      'student_comments',
      'oral_exams',
      'counseling_session_grades',
      'academic_calendar_periods',
      'academic_holidays',
      'academic_holiday_types',
      'academic_sub_periods',
      'academic_weekly_programs',
      'tuition_settings',
      'tuition_periods',
      'tuition_records',
      'student_financial_profiles',
      'finance_loans',
      'finance_fund_contributions',
      'finance_student_claims',
      'finance_claim_categories',
      'finance_destination_accounts',
      'finance_budget_rows',
      'finance_operational_expenses',
      'finance_expenses',
      'finance_meal_holidays',
      'finance_meal_periods',
      'finance_meal_person_categories',
      'finance_student_meal_reservations',
      'finance_teachers_periods',
      'finance_grade_mentor_periods',
      'finance_grade_mentors',
      'drivers',
      'staff',
      'teacher_transport_routines',
      'teacher_transport_trips',
      'todos',
      'personal_todos',
      'assigned_todos',
      'user_todo_categories',
      'workflow_items',
      'workflow_settings',
      'settings'
    ];
    try {
      await Promise.allSettled(coreCollections.map(col => this.syncCollectionFromCloud(col)));
    } catch (e) {
      console.warn('Error during initCloudSync:', e);
    }
  }
}

export const localDb = new LocalDatabase();

if (typeof window !== 'undefined' && isSupabaseConfigured) {
  setTimeout(() => {
    localDb.setupRealtimeSync();
    localDb.initCloudSync();
  }, 100);

  window.addEventListener('focus', () => {
    localDb.initCloudSync();
  });
}

export async function getCollection<T = any>(collectionName: CollectionName): Promise<T[]> {
  return localDb.getDocs<T>(collectionName);
}

export async function saveCollection(collectionName: CollectionName, items: any[]): Promise<void> {
  await localDb.clearCollection(collectionName);
  if (items && items.length > 0) {
    await localDb.bulkPut(collectionName, items);
  }
}

