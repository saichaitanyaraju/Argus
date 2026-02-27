import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars not set. Using demo mode.');
}

export const supabase = createClient(
  // Use a valid-looking placeholder URL so the app can still boot in "demo mode".
  supabaseUrl || 'https://example.supabase.co',
  // Intentionally NOT a real JWT. If env vars are missing, all network calls should fail fast.
  supabaseAnonKey || 'SUPABASE_ANON_KEY_NOT_SET'
);

// Storage buckets
export const STORAGE_BUCKET = 'project-files';
export const REPORTS_BUCKET = 'reports';
export const UPLOADS_BUCKET = 'uploads';
