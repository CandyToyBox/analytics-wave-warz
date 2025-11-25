import { createClient } from '@supabase/supabase-js';

// Use VITE_ prefix vars if that's what is set in Vercel, 
// or standard SUPABASE_URL if you set those.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn('Missing Supabase Environment Variables in API');
}

// Create a single instance
export const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);