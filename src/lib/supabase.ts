import { createClient, SupabaseClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};

// Default Supabase project credentials (Public Publishable/Anon Key is safe for client applications)
const DEFAULT_URL = 'https://jqfgkkpbdojzjttoziwl.supabase.co';
const DEFAULT_ANON_KEY = 'sb_publishable_2GWIGLxWLh-KSY2LAKM1uQ_cDSphAPq';

export const BUCKET_NAME = 'backups';

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const localUrl = typeof window !== 'undefined' ? (localStorage.getItem('supabase_url') || localStorage.getItem('VITE_SUPABASE_URL')) : '';
  const localKey = typeof window !== 'undefined' ? (localStorage.getItem('supabase_anon_key') || localStorage.getItem('VITE_SUPABASE_ANON_KEY')) : '';

  let url = (localUrl || env.VITE_SUPABASE_URL || DEFAULT_URL || '').trim();
  let anonKey = (localKey || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY || '').trim();

  if (!url || url.includes('your-project-id') || url.includes('placeholder') || !url.startsWith('http')) {
    url = DEFAULT_URL;
  }
  if (!anonKey || anonKey.includes('placeholder') || anonKey.includes('your-supabase') || anonKey.length < 10) {
    anonKey = DEFAULT_ANON_KEY;
  }

  return { url, anonKey };
}

export function saveSupabaseCredentials(url: string, anonKey: string) {
  if (typeof window !== 'undefined') {
    if (url) localStorage.setItem('supabase_url', url.trim());
    if (anonKey) localStorage.setItem('supabase_anon_key', anonKey.trim());
    _cachedClient = null; // Reset cached client
  }
}

let _cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  const { url, anonKey } = getSupabaseCredentials();
  if (!_cachedClient) {
    _cachedClient = createClient(
      url || DEFAULT_URL,
      anonKey || DEFAULT_ANON_KEY
    );
  }
  return _cachedClient;
}

// Proxy wrapper for backward compatibility
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

export function checkIsSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseCredentials();
  return Boolean(
    url &&
    anonKey &&
    !url.includes('your-project-id') &&
    !url.includes('placeholder') &&
    !anonKey.includes('your-supabase') &&
    anonKey.length > 10
  );
}

export const isSupabaseConfigured = checkIsSupabaseConfigured();

/**
 * Maps mentor ID to Supabase Storage folder path
 * - Hosseini -> 'hosseini'
 * - Hayati -> 'hayati'
 * - Soleimani -> 'soleymani'
 * - Shahpoori / Manager -> 'boss'
 */
export function getFolderForMentor(mentorId: string): string {
  switch (mentorId) {
    case 'hosseini':
      return 'hosseini';
    case 'hayati':
      return 'hayati';
    case 'soleimani':
    case 'soleymani':
      return 'soleymani';
    case 'asadi':
      return 'asadi';
    case 'shahpoori':
    case 'boss':
      return 'boss';
    default:
      return 'boss';
  }
}
