interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_LYZR_API_KEY?: string;
  readonly VITE_LYZR_AGENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
