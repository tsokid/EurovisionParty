// supabase/functions/eurovision-parse/index.ts
// Polled by pg_cron every 2 minutes. For each running parse_job, fetches the
// configured source, upserts entries into eurovision_2026_live, and records
// the run in parse_runs.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.3';
import { parseEurovision } from './parse.ts';

const sb = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async () => {
  const { data: jobs } = await sb.from('parse_jobs').select('*').eq('status', 'running');
  if (!jobs || jobs.length === 0) {
    return new Response('no jobs', { status: 200 });
  }

  for (const job of jobs) {
    const { data: sched } = await sb
      .from('eurovision_parse_schedule')
      .select('*')
      .eq('year', job.year)
      .single();
    if (!sched) continue;

    const run = await sb
      .from('parse_runs')
      .insert({ job_id: job.id, year: job.year })
      .select()
      .single();

    try {
      const { entries, httpStatus, source } = await parseEurovision(sched.source_url);
      const hash = await sha256(JSON.stringify(entries));

      let upserted = 0;
      for (const e of entries) {
        const { error } = await sb.from('eurovision_2026_live').upsert(
          {
            iso: e.iso,
            name: e.name,
            artist: e.artist,
            song: e.song,
            running_order: e.runningOrder,
            source,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'iso' },
        );
        if (!error) upserted++;
      }

      await sb
        .from('parse_runs')
        .update({
          finished_at: new Date().toISOString(),
          http_status: httpStatus,
          status: entries.length === 0 ? 'blocked' : 'ok',
          rows_upserted: upserted,
          payload_hash: hash,
        })
        .eq('id', run.data!.id);

      await sb
        .from('parse_jobs')
        .update({
          last_poll_at: new Date().toISOString(),
          poll_count: (job.poll_count ?? 0) + 1,
        })
        .eq('id', job.id);
    } catch (e) {
      await sb
        .from('parse_runs')
        .update({
          finished_at: new Date().toISOString(),
          status: 'error',
          error: String(e),
        })
        .eq('id', run.data!.id);
    }
  }

  return new Response('ok');
});

async function sha256(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
