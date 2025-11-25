import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gshwqoplsxgqbdkssoit.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_KEY || ''; // Use Service Key in production for server-side operations

if (!SUPABASE_URL) {
  console.warn('Missing VITE_SUPABASE_URL environment variable');
}

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
