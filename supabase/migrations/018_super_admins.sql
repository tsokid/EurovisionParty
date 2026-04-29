-- 018_super_admins.sql
-- Super-admin allowlist. Membership grants access to /admin modules.
-- Seeded with the two operator emails. user_id is filled in on first login
-- by a trigger on auth.users.

create table if not exists public.super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.super_admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

insert into public.super_admin_emails(email) values
  ('elenikp105@gmail.com'),
  ('tsokid@gmail.com')
on conflict (email) do nothing;

-- Auto-link auth.users → super_admins when an allowlisted email signs up
create or replace function public.link_super_admin()
returns trigger language plpgsql security definer as $$
begin
  if exists (select 1 from public.super_admin_emails where email = new.email) then
    insert into public.super_admins(user_id, email) values (new.id, new.email)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_link_super_admin on auth.users;
create trigger trg_link_super_admin
  after insert or update of email on auth.users
  for each row execute function public.link_super_admin();

-- RLS: anyone authenticated can read their own row (used by client to detect admin)
alter table public.super_admins enable row level security;
drop policy if exists super_admins_read_self on public.super_admins;
create policy super_admins_read_self on public.super_admins
  for select using (auth.uid() = user_id);

-- Helper function used by RLS in later phases
create or replace function public.is_super_admin()
returns boolean language sql stable security definer as $$
  select exists(select 1 from public.super_admins where user_id = auth.uid())
$$;
