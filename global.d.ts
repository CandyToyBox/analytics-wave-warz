/// <reference types="vite/client" />

// Vite injects env values as strings; parse to the required types when consuming.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_KEY?: string;
  readonly VITE_SOL_PRICE_CACHE_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
