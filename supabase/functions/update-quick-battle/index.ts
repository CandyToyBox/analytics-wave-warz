// update-quick-battle: persists quick battle metrics and rolls up leaderboard by track_name
// Assumptions:
// - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are available
// - RPCs: public.update_quick_battle_metrics, public.upsert_quick_leaderboard_for_track
// - Input JSON: { battle_id: string, track_name: string, total_volume_a: number|string, total_volume_b: number|string, trade_count?: number, unique_traders?: number }

import { createClient } from "npm:@supabase/supabase-js@2.45.6";

interface Payload {
  battle_id: string;
  track_name: string;
  total_volume_a: number | string;
  total_volume_b: number | string;
  trade_count?: number;
  unique_traders?: number;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.info('update-quick-battle function started');

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const body = (await req.json()) as Partial<Payload>;

    // Basic validation
    const missing: string[] = [];
    if (!body.battle_id) missing.push('battle_id');
    if (!body.track_name) missing.push('track_name');
    if (body.total_volume_a === undefined || body.total_volume_a === null) missing.push('total_volume_a');
    if (body.total_volume_b === undefined || body.total_volume_b === null) missing.push('total_volume_b');
    if (missing.length) {
      return new Response(JSON.stringify({ error: 'Missing fields', fields: missing }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 1) Persist per-battle metrics
    {
      const { error } = await supabase.rpc('update_quick_battle_metrics', {
        p_battle_id: body.battle_id,
        p_total_volume_a: body.total_volume_a,
        p_total_volume_b: body.total_volume_b,
        p_trade_count: body.trade_count ?? null,
        p_unique_traders: body.unique_traders ?? null,
      });
      if (error) throw new Error(`update_quick_battle_metrics failed: ${error.message}`);
    }

    // 2) Roll up leaderboard for the track
    {
      const { error } = await supabase.rpc('upsert_quick_leaderboard_for_track', {
        p_track_name: body.track_name,
      });
      if (error) throw new Error(`upsert_quick_leaderboard_for_track failed: ${error.message}`);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
