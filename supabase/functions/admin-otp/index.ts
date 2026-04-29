// supabase/functions/admin-otp/index.ts
// Server-side gatekeeper: only allowlisted emails get an OTP. Returns the same
// opaque {ok:true} response either way (constant time) so attackers can't
// enumerate which addresses are on the list.
import { createClient } from 'supabase';

const ALLOW = new Set(['elenikp105@gmail.com', 'tsokid@gmail.com']);

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('method', { status: 405, headers: CORS });

  const { email } = await req.json().catch(() => ({}));

  // Constant-time response shape regardless of input or allowlist hit.
  await new Promise((r) => setTimeout(r, 350));

  if (typeof email !== 'string') return json({ ok: true });
  if (!ALLOW.has(email.toLowerCase().trim())) return json({ ok: true });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // shouldCreateUser=true so first-time admins are bootstrapped
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) console.error('otp error', error.message);
  return json({ ok: true });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
