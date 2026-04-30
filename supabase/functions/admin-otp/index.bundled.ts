// supabase/functions/admin-otp/index.ts
// Server-side gatekeeper: only emails present in public.super_admin_emails get
// an OTP. Returns the same opaque {ok:true} response either way (constant time)
// so attackers can't enumerate the allowlist.
//
// No SDK dependency — direct REST calls keep the function bulletproof against
// upstream module-host outages (esm.sh boot errors).

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('method', { status: 405, headers: CORS });

  // Constant-time pad regardless of input or allowlist hit.
  const pad = new Promise((r) => setTimeout(r, 350));

  let email: unknown;
  try {
    const body = await req.json();
    email = body?.email;
  } catch {
    await pad;
    return json({ ok: true });
  }

  if (typeof email !== 'string' || !email.includes('@')) {
    await pad;
    return json({ ok: true });
  }

  const normalized = email.toLowerCase().trim();

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('missing env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    await pad;
    return json({ ok: true });
  }

  // 1. Allowlist lookup via PostgREST.
  let allowed = false;
  try {
    const u = `${SUPABASE_URL}/rest/v1/super_admin_emails?email=eq.${encodeURIComponent(normalized)}&select=email`;
    const res = await fetch(u, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Accept: 'application/json',
      },
    });
    if (res.ok) {
      const rows = await res.json();
      allowed = Array.isArray(rows) && rows.length > 0;
    } else {
      console.error('allowlist lookup status', res.status, await res.text());
    }
  } catch (e) {
    console.error('allowlist fetch error', String(e));
  }

  if (!allowed) {
    await pad;
    return json({ ok: true });
  }

  // 2. Send OTP via GoTrue. shouldCreateUser=true so first-time admins are
  // bootstrapped (the DB trigger then auto-links the new auth.users row into
  // super_admins).
  try {
    const otpRes = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: normalized,
        create_user: true,
      }),
    });
    if (!otpRes.ok) {
      console.error('otp status', otpRes.status, await otpRes.text());
    }
  } catch (e) {
    console.error('otp fetch error', String(e));
  }

  await pad;
  return json({ ok: true });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
