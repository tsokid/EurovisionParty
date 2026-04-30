// supabase/functions/admin-otp/index.ts
// Server-side gatekeeper: only emails present in public.super_admin_emails get
// an OTP. Returns the same opaque {ok:true} response either way (constant time)
// so attackers can't enumerate the allowlist.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.3';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const sb = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('method', { status: 405, headers: CORS });

  const { email } = await req.json().catch(() => ({}));

  // Constant-time pad regardless of input or allowlist hit.
  const pad = new Promise((r) => setTimeout(r, 350));

  if (typeof email !== 'string' || !email.includes('@')) {
    await pad;
    return json({ ok: true });
  }

  const normalized = email.toLowerCase().trim();

  // Live allowlist lookup. If the row doesn't exist, we silently no-op.
  const { data, error } = await sb
    .from('super_admin_emails')
    .select('email')
    .eq('email', normalized)
    .maybeSingle();

  if (error) {
    console.error('allowlist lookup error', error.message);
    await pad;
    return json({ ok: true });
  }

  if (!data) {
    await pad;
    return json({ ok: true });
  }

  // shouldCreateUser=true so first-time admins are bootstrapped (the DB trigger
  // then auto-links the new auth.users row into super_admins).
  const { error: otpErr } = await sb.auth.signInWithOtp({
    email: normalized,
    options: { shouldCreateUser: true },
  });
  if (otpErr) console.error('otp error', otpErr.message);
  await pad;
  return json({ ok: true });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
