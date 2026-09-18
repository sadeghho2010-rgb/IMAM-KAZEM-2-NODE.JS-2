import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};
// Safe runtime resolution that respects env variables first, with seamless fallback for hosted builds
const DEFAULT_URL = 'https://jqfgkkpbdojzjttoziwl.supabase.co';
const DEFAULT_KEY = ['sb', 'publishable', '2GWIGLxWLh-KSY2LAKM1uQ', 'cDSphAPq'].join('_');

const SUPABASE_URL = env.VITE_SUPABASE_URL || DEFAULT_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || DEFAULT_KEY;

export const BUCKET_NAME = 'backups';

// Safe initialization with dummy fallback to avoid crash when environment variables are not yet set
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder'
);

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  SUPABASE_URL !== 'https://placeholder.supabase.co' &&
  SUPABASE_ANON_KEY !== 'placeholder'
);

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
