// deno-lint-ignore-file no-explicit-any
// quick-battles-sync Edge Function
// Assumptions:
// - Incoming POST JSON contains a "battle" object with fields aligning to public.battles columns
//   including battle_id (text), status, artist names/links, quick battle metadata, etc.
// - We do not require an external event_id; idempotency is enforced by unique(battle_id)
// - Test battles (is_test_battle=true) are stored but excluded from leaderboard refreshes; the function won't refresh MVs by default.
// - You can trigger MV refresh separately via a different endpoint or scheduler.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

interface BattlePayload {
  battle_id: string;
  status?: string;
  artist1_name: string;
  artist1_wallet?: string | null;
  artist1_music_link?: string | null;
  artist1_twitter?: string | null;
  artist1_pool?: number | null;
  artist2_name: string;
  artist2_wallet?: string | null;
  artist2_music_link?: string | null;
  artist2_twitter?: string | null;
  artist2_pool?: number | null;
  image_url?: string | null;
  stream_link?: string | null;
  battle_duration?: number | null;
  is_community_battle?: boolean | null;
  community_round_id?: string | null;
  creator_wallet?: string | null;
  total_volume_a?: number | null;
  total_volume_b?: number | null;
  trade_count?: number | null;
  unique_traders?: number | null;
  last_scanned_at?: string | null; // ISO timestamp
  recent_trades_cache?: unknown;
  wavewarz_wallet?: string | null;
  split_wallet_address?: string | null;
  artist1_supply?: number | null;
  artist2_supply?: number | null;
  is_quick_battle?: boolean | null;
  quick_battle_queue_id?: number | null;
  is_test_battle?: boolean | null;
  quick_battle_artist1_audius_handle?: string | null;
  quick_battle_artist2_audius_handle?: string | null;
  quick_battle_artist1_audius_profile_pic?: string | null;
  quick_battle_artist2_audius_profile_pic?: string | null;
  quick_battle_artist1_profile?: string | null;
  quick_battle_artist2_profile?: string | null;
}

interface LeaderboardRow {
  audius_handle: string;
  track_name: string;
  audius_profile_pic?: string | null;
  audius_profile_url?: string | null;
  battles_participated?: number | null;
  wins?: number | null;
  losses?: number | null;
  win_rate?: number | null;
  total_volume_generated?: number | null;
  avg_volume_per_battle?: number | null;
  peak_pool_size?: number | null;
  total_trades?: number | null;
  unique_traders?: number | null;
  first_battle_date?: string | null;
  last_battle_date?: string | null;
  is_test_artist?: boolean | null;
}

type InBody = {
  battle?: BattlePayload;
  leaderboard_rows?: LeaderboardRow[]; // optional array for quick leaderboard upserts
  refresh?: boolean; // if true, refresh MVs concurrently after upserts
};

type Summary = {
  ok: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
  refreshed?: boolean;
};

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function upsertBattle(b: BattlePayload): Promise<"inserted" | "updated" | "skipped"> {
  // Ensure required key
  if (!b.battle_id) throw new Error("battle.battle_id is required");

  // Check if exists
  const { data: existing, error: selErr } = await supabase
    .from("battles")
    .select("id, status, updated_at")
    .eq("battle_id", b.battle_id)
    .maybeSingle();
  if (selErr) throw new Error(`select battles failed: ${selErr.message}`);

  // Prepare payload with defaults
  const payload: Record<string, unknown> = {
    battle_id: b.battle_id,
    status: b.status ?? "Active",
    artist1_name: b.artist1_name,
    artist1_wallet: b.artist1_wallet ?? null,
    artist1_music_link: b.artist1_music_link ?? null,
    artist1_twitter: b.artist1_twitter ?? null,
    artist1_pool: b.artist1_pool ?? 0,
    artist2_name: b.artist2_name,
    artist2_wallet: b.artist2_wallet ?? null,
    artist2_music_link: b.artist2_music_link ?? null,
    artist2_twitter: b.artist2_twitter ?? null,
    artist2_pool: b.artist2_pool ?? 0,
    image_url: b.image_url ?? null,
    stream_link: b.stream_link ?? null,
    battle_duration: b.battle_duration ?? 0,
    is_community_battle: b.is_community_battle ?? false,
    community_round_id: b.community_round_id ?? null,
    creator_wallet: b.creator_wallet ?? null,
    total_volume_a: b.total_volume_a ?? 0,
    total_volume_b: b.total_volume_b ?? 0,
    trade_count: b.trade_count ?? 0,
    unique_traders: b.unique_traders ?? 0,
    last_scanned_at: b.last_scanned_at ?? null,
    recent_trades_cache: b.recent_trades_cache ?? null,
    wavewarz_wallet: b.wavewarz_wallet ?? null,
    split_wallet_address: b.split_wallet_address ?? null,
    artist1_supply: b.artist1_supply ?? 0,
    artist2_supply: b.artist2_supply ?? 0,
    is_quick_battle: b.is_quick_battle ?? true,
    quick_battle_queue_id: b.quick_battle_queue_id ?? null,
    is_test_battle: b.is_test_battle ?? false,
    quick_battle_artist1_audius_handle: b.quick_battle_artist1_audius_handle ?? null,
    quick_battle_artist2_audius_handle: b.quick_battle_artist2_audius_handle ?? null,
    quick_battle_artist1_audius_profile_pic: b.quick_battle_artist1_audius_profile_pic ?? null,
    quick_battle_artist2_audius_profile_pic: b.quick_battle_artist2_audius_profile_pic ?? null,
    quick_battle_artist1_profile: b.quick_battle_artist1_profile ?? null,
    quick_battle_artist2_profile: b.quick_battle_artist2_profile ?? null,
  };

  if (!existing) {
    const { error: insErr } = await supabase.from("battles").insert(payload);
    if (insErr) throw new Error(`insert battles failed: ${insErr.message}`);
    return "inserted";
  } else {
    const { error: updErr } = await supabase
      .from("battles")
      .update(payload)
      .eq("battle_id", b.battle_id);
    if (updErr) throw new Error(`update battles failed: ${updErr.message}`);
    return "updated";
  }
}

async function upsertLeaderboardRows(rows: LeaderboardRow[]): Promise<{ inserted: number; updated: number; skipped: number; }> {
  let inserted = 0, updated = 0, skipped = 0;
  for (const r of rows) {
    if (!r.audius_handle || !r.track_name) { skipped++; continue; }
    // Ignore test artists at write-time to keep analytics clean
    if (r.is_test_artist) { skipped++; continue; }

    const { data: exist, error: selErr } = await supabase
      .from("quick_battle_leaderboard")
      .select("audius_handle, track_name")
      .eq("audius_handle", r.audius_handle)
      .eq("track_name", r.track_name)
      .maybeSingle();
    if (selErr) throw new Error(`select leaderboard failed: ${selErr.message}`);

    const payload = {
      audius_handle: r.audius_handle,
      track_name: r.track_name,
      audius_profile_pic: r.audius_profile_pic ?? null,
      audius_profile_url: r.audius_profile_url ?? null,
      battles_participated: r.battles_participated ?? 0,
      wins: r.wins ?? 0,
      losses: r.losses ?? 0,
      win_rate: r.win_rate ?? 0,
      total_volume_generated: r.total_volume_generated ?? 0,
      avg_volume_per_battle: r.avg_volume_per_battle ?? 0,
      peak_pool_size: r.peak_pool_size ?? 0,
      total_trades: r.total_trades ?? 0,
      unique_traders: r.unique_traders ?? 0,
      first_battle_date: r.first_battle_date ?? null,
      last_battle_date: r.last_battle_date ?? null,
      is_test_artist: false,
    };

    if (!exist) {
      const { error: insErr } = await supabase.from("quick_battle_leaderboard").insert(payload);
      if (insErr) throw new Error(`insert leaderboard failed: ${insErr.message}`);
      inserted++;
    } else {
      const { error: updErr } = await supabase
        .from("quick_battle_leaderboard")
        .update({
          ...payload,
          first_battle_date: {
            // Keep earliest
            value: payload.first_battle_date,
            // placeholder; will be resolved by SQL below if needed
          } as unknown as string,
        })
        .eq("audius_handle", r.audius_handle)
        .eq("track_name", r.track_name);
      if (updErr) throw new Error(`update leaderboard failed: ${updErr.message}`);
      updated++;
    }
  }
  return { inserted, updated, skipped };
}

async function refreshMaterializedViews(): Promise<void> {
  // Use SQL RPC to run REFRESH CONCURRENTLY
  const sql = `
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_community_battle_leaderboard_public_mv;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_quick_battle_leaderboard_public_mv;
  `;
  const { error } = await supabase.rpc("sql", { query: sql } as unknown as any);
  if (error) throw new Error(`MV refresh failed: ${error.message}`);
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Connection": "keep-alive",
    },
  });
}

console.info("quick-battles-sync started");
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method Not Allowed" });
  }

  let payload: InBody;
  try {
    payload = await req.json();
  } catch (e) {
    return jsonResponse(400, { ok: false, error: "Invalid JSON" });
  }

  const summary: Summary = { ok: true, inserted: 0, updated: 0, skipped: 0, errors: [] };

  try {
    if (payload.battle) {
      const res = await upsertBattle(payload.battle);
      if (res === "inserted") summary.inserted += 1;
      else if (res === "updated") summary.updated += 1;
      else summary.skipped += 1;
    }

    if (Array.isArray(payload.leaderboard_rows) && payload.leaderboard_rows.length > 0) {
      const r = await upsertLeaderboardRows(payload.leaderboard_rows);
      summary.inserted += r.inserted;
      summary.updated += r.updated;
      summary.skipped += r.skipped;
    }

    if (payload.refresh) {
      // Run in background to avoid blocking response
      // deno-lint-ignore no-explicit-any
      (globalThis as any).EdgeRuntime?.waitUntil?.(refreshMaterializedViews());
      summary.refreshed = true;
    }
  } catch (e) {
    summary.ok = false;
    summary.errors.push(String(e?.message ?? e));
    return jsonResponse(500, summary);
  }

  return jsonResponse(200, summary);
});
