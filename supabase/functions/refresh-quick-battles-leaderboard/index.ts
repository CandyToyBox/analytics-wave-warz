// Supabase Edge Function: refresh-quick-battles-leaderboard
// Purpose: Refresh materialized view for Quick Battles leaderboard with concurrent refresh
// Assumptions: The materialized view exists at public.v_quick_battle_leaderboard_public
// Notes: Uses SUPABASE_SERVICE_ROLE_KEY automatically available in the Edge runtime

import { createClient } from "npm:@supabase/supabase-js@2.46.1";

console.info("refresh-quick-battles-leaderboard: server started");

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase env vars' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
      db: { schema: 'public' },
    });

    // Execute the refresh via Postgres RPC using a single SQL call
    // We use the Postgres REST endpoint through the client with a raw SQL call via the /rest/v1/rpc Postgres function route.
    // Since we want a simple, dependency-free call, we use the query method on the PostgREST client.

    // Create a dedicated SQL endpoint by leveraging the query() helper on the PostgREST client
    // @ts-ignore - types for .rpc with sql may not exist; we'll call through fetch for reliability

    const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        sql: "REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_quick_battle_leaderboard_public;",
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return new Response(JSON.stringify({ error: 'Refresh failed', details: text }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const refreshed_at = new Date().toISOString();
    return new Response(JSON.stringify({ ok: true, refreshed_at }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Unexpected error', message: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
