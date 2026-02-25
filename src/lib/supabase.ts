import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars not set. Using demo mode.')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlianNjcHl4YWF1d250ZHhhemJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjAxNTMsImV4cCI6MjA4NzU5NjE1M30.h3UnZh39xEFEA6i8xqearmpHz9ik7LJM64S-0s_T8WE'
)

export const STORAGE_BUCKET = 'uploads'
export const REPORTS_BUCKET = 'reports'
