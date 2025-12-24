// ============================================================================
// REFRESH QUICK BATTLES LEADERBOARD - REDIRECT TO BATTLES WEBHOOK
// ============================================================================
// This edge function redirects all requests to the new battles-webhook endpoint
// URL: https://gshwqoplsxgqbdkssoit.supabase.co/functions/v1/battles-webhook

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const BATTLES_WEBHOOK_URL = 'https://gshwqoplsxgqbdkssoit.supabase.co/functions/v1/battles-webhook';

serve(async (req) => {
  try {
    console.log('🔄 Redirecting refresh-quick-battles-leaderboard request to battles-webhook');

    // Forward the request to the battles-webhook endpoint
    const response = await fetch(BATTLES_WEBHOOK_URL, {
      method: req.method,
      headers: req.headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined,
    });

    // Get the response body
    const body = await response.text();

    // Return the response from battles-webhook
    return new Response(body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    console.error('❌ Error redirecting to battles-webhook:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to redirect to battles-webhook',
        message: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
