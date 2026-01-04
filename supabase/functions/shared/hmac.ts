// ============================================================================
// HMAC VERIFICATION UTILITY
// ============================================================================
// Shared HMAC-SHA256 signature verification for securing Supabase Edge Functions
// Uses X-Signature and X-Timestamp headers with constant-time comparison

export async function verifyHmac(
  req: Request,
  secret: string
): Promise<{ ok: boolean; body?: string; error?: string }> {
  const sig = req.headers.get('x-signature');
  const ts = req.headers.get('x-timestamp');

  if (!secret) {
    return { ok: false, error: 'HMAC secret is required' };
  }

  if (!sig || !ts) {
    return { ok: false, error: 'Missing signature headers' };
  }

  // Enforce max age (5 minutes = 300 seconds)
  const now = Math.floor(Date.now() / 1000);
  const tsNum = /^\d+$/.test(ts)
    ? parseInt(ts, 10)
    : Math.floor(new Date(ts).getTime() / 1000);

  if (!Number.isFinite(tsNum) || Math.abs(now - tsNum) > 300) {
    return { ok: false, error: 'Stale or invalid timestamp' };
  }

  // Read raw body once
  const body = await req.text();
  const payload = `${ts}.${body}`;

  // Compute HMAC-SHA256
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sigBuf = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload)
  );

  const expectedHex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time compare
  if (!timingSafeEqualHex(expectedHex, sig)) {
    return { ok: false, error: 'Invalid signature' };
  }

  return { ok: true, body };
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
