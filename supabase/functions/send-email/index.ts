// supabase/functions/send-email/index.ts
// Polled by pg_cron every minute. Drains pending rows from email_log,
// renders the appropriate template, and POSTs to Resend.
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
//               EMAIL_FROM (e.g. "Eurovision Games <noreply@eurovision.games>").
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.3';
import { renderTemplate } from './templates.ts';

const sb = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM = Deno.env.get('EMAIL_FROM') ?? 'Eurovision Games <noreply@eurovision.games>';
const MAX_ATTEMPTS = 3;
const BATCH = 25;

interface EmailRow {
  id: string;
  to_email: string;
  from_email: string;
  subject: string;
  template: string;
  payload: Record<string, unknown>;
  attempts: number;
}

Deno.serve(async () => {
  if (!RESEND_API_KEY) {
    return json({ ok: false, error: 'RESEND_API_KEY not configured' }, 500);
  }

  // Atomically claim a batch by flipping status to 'sending'.
  const { data: claimed, error: claimErr } = await sb
    .from('email_log')
    .update({ status: 'sending' })
    .eq('status', 'pending')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(BATCH)
    .select('id, to_email, from_email, subject, template, payload, attempts');

  if (claimErr) return json({ ok: false, error: claimErr.message }, 500);
  if (!claimed || claimed.length === 0) return json({ ok: true, drained: 0 });

  let sent = 0;
  let failed = 0;

  for (const row of claimed as EmailRow[]) {
    try {
      const html = renderTemplate(row.template, row.payload);
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${RESEND_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: row.from_email && row.from_email !== 'noreply@eurovision.games' ? row.from_email : FROM,
          to: [row.to_email],
          subject: row.subject,
          html,
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (r.ok && body.id) {
        await sb
          .from('email_log')
          .update({
            status: 'sent',
            provider_id: body.id,
            sent_at: new Date().toISOString(),
            attempts: row.attempts + 1,
            error: null,
          })
          .eq('id', row.id);
        sent++;
      } else {
        const nextAttempts = row.attempts + 1;
        await sb
          .from('email_log')
          .update({
            status: nextAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
            attempts: nextAttempts,
            error: body.message ?? `HTTP ${r.status}`,
          })
          .eq('id', row.id);
        failed++;
      }
    } catch (e) {
      const nextAttempts = row.attempts + 1;
      await sb
        .from('email_log')
        .update({
          status: nextAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
          attempts: nextAttempts,
          error: String(e),
        })
        .eq('id', row.id);
      failed++;
    }
  }

  return json({ ok: true, drained: claimed.length, sent, failed });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
