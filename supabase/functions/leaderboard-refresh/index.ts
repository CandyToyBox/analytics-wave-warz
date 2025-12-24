// deno-lint-ignore-file no-explicit-any
// Scheduled refresh for leaderboard materialized views (quick + community)
// Routes:
// - POST /leaderboard-refresh/refresh  (manual trigger)
// - GET  /leaderboard-refresh/health    (health check)

import { createClient } from "npm:@supabase/supabase-js@2.46.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false },
  global: { headers: { "X-Client-Info": "leaderboard-refresh/1.1" } },
});

async function refreshViews(): Promise<{ ok: boolean; details: any }> {
  const sql = `
    begin;
    refresh materialized view concurrently if exists public.v_quick_battle_leaderboard_public_mv;
    refresh materialized view concurrently if exists public.v_community_battle_leaderboard_public_mv;
    commit;`;

  const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json",
      Prefer: "tx=commit",
    },
    body: JSON.stringify({ sql }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return { ok: false, details: { status: resp.status, error: text } };
  }
  const data = await resp.json().catch(() => ({}));
  return { ok: true, details: data };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+/g, "/");

  if (req.method === "GET" && path.endsWith("/health")) {
    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method === "POST" && path.endsWith("/refresh")) {
    const result = await refreshViews();
    const status = result.ok ? 200 : 500;
    return new Response(JSON.stringify(result), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ error: "Not found", hint: "POST /leaderboard-refresh/refresh" }),
    { status: 404, headers: { "Content-Type": "application/json" } },
  );
});
