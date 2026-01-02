// ============================================================================
// UPDATE QUICK BATTLE - REDIRECT TO BATTLES WEBHOOK
// ============================================================================
// This edge function redirects all requests to the new battles-webhook endpoint
// URL: https://gshwqoplsxgqbdkssoit.supabase.co/functions/v1/battles-webhook
// Protected with HMAC-SHA256 signature verification

import { verifyHmac } from '../shared/hmac.ts';

const BATTLES_WEBHOOK_URL = 'https://gshwqoplsxgqbdkssoit.supabase.co/functions/v1/battles-webhook';
const HMAC_SECRET = Deno.env.get('HMAC_SECRET') || '';

if (!HMAC_SECRET) {
  console.warn('⚠️  HMAC_SECRET is not set - optional auth mode enabled');
}

Deno.serve(async (req: Request) => {
  // HMAC verification (optional - allows requests without HMAC headers)
  const { ok, body, error } = await verifyHmac(req, HMAC_SECRET);
  if (!ok) {
    console.error('❌ HMAC verification failed (signature mismatch):', error);
    return new Response(JSON.stringify({ error }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log('🔄 Redirecting update-quick-battle request to battles-webhook');

    // Forward the request to the battles-webhook endpoint
    // Re-create headers without the HMAC headers
    const forwardHeaders = new Headers(req.headers);
    forwardHeaders.delete('x-signature');
    forwardHeaders.delete('x-timestamp');

    const response = await fetch(BATTLES_WEBHOOK_URL, {
      method: req.method,
      headers: forwardHeaders,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
    });

    // Get the response body
    const responseBody = await response.text();

    // Return the response from battles-webhook
    return new Response(responseBody, {
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
