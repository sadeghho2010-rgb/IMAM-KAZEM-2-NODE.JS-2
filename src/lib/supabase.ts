/**
 * Supabase Integration - DEACTIVATED / CUT OFF
 * Primary Database is strictly MySQL 8 on Runflare.
 * All client/server communications with Supabase have been disconnected.
 */

export const BUCKET_NAME = 'backups';

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  return { url: '', anonKey: '' };
}

export function saveSupabaseCredentials(_url: string, _anonKey: string) {
  // No-op
}

export function getSupabaseClient(): any {
  // Safe dummy proxy that returns empty promises/results for any chained call
  return new Proxy({}, {
    get(_target, prop) {
      if (prop === 'auth') {
        return {
          signInWithPassword: async () => ({ data: null, error: new Error('Supabase is disconnected.') }),
          signOut: async () => ({ error: null }),
          getSession: async () => ({ data: { session: null }, error: null }),
        };
      }
      if (prop === 'from') {
        return () => ({
          select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: [], error: null }) }), limit: () => Promise.resolve({ data: [], error: null }) }),
          insert: async () => ({ data: null, error: new Error('Supabase is disconnected.') }),
          upsert: async () => ({ data: null, error: new Error('Supabase is disconnected.') }),
          delete: async () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
        });
      }
      return () => Promise.resolve({ data: null, error: new Error('Supabase is disconnected.') });
    }
  });
}

export const supabase = getSupabaseClient();

export function checkIsSupabaseConfigured(): boolean {
  return false;
}

export const isSupabaseConfigured = false;

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

