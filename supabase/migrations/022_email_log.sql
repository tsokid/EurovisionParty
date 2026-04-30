-- 022_email_log.sql
-- Transactional email log + RPC for queueing sends.
-- The send-email edge function reads pending rows, calls Resend, and updates status.

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  from_email text not null default 'noreply@eurovision.games',
  subject text not null,
  template text not null check (template in ('host_invite','game_recap','admin_alert','generic')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  provider_id text,
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists email_log_status_created on public.email_log(status, created_at)
  where status in ('pending','sending');
create index if not exists email_log_to_email on public.email_log(to_email);

-- updated_at trigger
create or replace function public.tg_email_log_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists trg_email_log_updated_at on public.email_log;
create trigger trg_email_log_updated_at before update on public.email_log
  for each row execute function public.tg_email_log_updated_at();

-- RLS: super-admin only (table contains recipient PII)
alter table public.email_log enable row level security;
drop policy if exists email_log_admin_all on public.email_log;
create policy email_log_admin_all on public.email_log
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- Queue helper RPC. SECURITY DEFINER so callers don't need RLS write rights;
-- callable by hosts via PostgREST for legitimate sends (e.g. host invite).
create or replace function public.queue_email(
  p_to text,
  p_subject text,
  p_template text,
  p_payload jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if p_to is null or position('@' in p_to) < 2 then
    raise exception 'invalid_email';
  end if;
  if p_template not in ('host_invite','game_recap','admin_alert','generic') then
    raise exception 'invalid_template';
  end if;
  insert into public.email_log(to_email, subject, template, payload)
    values (lower(trim(p_to)), p_subject, p_template, coalesce(p_payload, '{}'::jsonb))
    returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.queue_email(text, text, text, jsonb) from public;
grant execute on function public.queue_email(text, text, text, jsonb) to authenticated;

-- pg_cron: every minute, ping the send-email edge function so it drains the queue.
do $outer$
begin
  if exists (select 1 from pg_extension where extname='pg_cron')
     and exists (select 1 from pg_extension where extname='pg_net') then
    perform cron.unschedule('send-email-drain');
    perform cron.schedule(
      'send-email-drain',
      '* * * * *',
      $cron$
      select net.http_post(
        url := current_setting('app.settings.functions_url', true) || '/send-email',
        headers := jsonb_build_object(
          'content-type','application/json',
          'Authorization','Bearer ' || current_setting('app.settings.service_role_key', true)
        )
      )
      where current_setting('app.settings.functions_url', true) is not null;
      $cron$
    );
  end if;
exception when others then null;
end $outer$;
