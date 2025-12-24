console.info('update-quick-battle-refresh started');

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  // Optional: protect with a shared secret header
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (secret) {
    const got = req.headers.get('x-webhook-secret');
    if (got !== secret) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
  }

  // Kick off background refresh via RPC
  const url = `${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/refresh_v_quick_battle_leaderboard_public`;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const p = fetch(url, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({})
  }).then(async (r) => {
    if (!r.ok) {
      console.error('Refresh RPC failed', r.status, await r.text());
      return;
    }
    console.info('Refresh RPC ok', await r.text());
  }).catch((e) => console.error('Refresh RPC error', e));

  try {
    // @ts-ignore EdgeRuntime available in Supabase Edge
    EdgeRuntime.waitUntil(p);
  } catch (_) {
    // If not available, continue; fetch will likely still complete
  }

  return new Response(JSON.stringify({ ok: true, message: 'Refresh started' }), {
    headers: { 'Content-Type': 'application/json', 'Connection': 'keep-alive' },
  });
});
