-- 089_avatars_library.sql
-- ============================================================
-- Avatars library in the CMS (Track 3 spec, addendum of 22 Nov 2026).
--
-- * avatars: one row per avatar players can pick. thumb_path / full_path
--   are either a static site path (/avatars/<file>.webp, optional ?v=,
--   the 53 owner avatars that ship in public/avatars/) or an object name in
--   the public Storage bucket `avatars` (<id>-96.webp / <id>-512.webp, new
--   uploads). status: published (in the picker) | unpublished (kept for
--   players who chose it, not offered). deleted_at: soft delete.
-- * RLS: anyone reads published, non-deleted rows (the picker); super
--   admins (is_super_admin(), 018) read and write everything.
-- * players.avatar_id stays a loose reference (no FK): deleting an avatar
--   never touches a player row; the app draws its own fallback.
-- * avatar_entries(ids) (anyone): the non-deleted rows of those ids, any
--   status, so a player who chose an avatar that was unpublished later
--   still shows it. At most 200 ids.
-- * avatar_usage() (super admin): players per avatar_id, in rooms that
--   still exist (rooms are deleted outright; players cascade with them).
-- * avatars_reorder(ids) (super admin): sort = position in the list.
-- * avatar_purge(id) (super admin): removes a soft-deleted row for good,
--   when no player uses it or it was deleted over 30 days ago. Returns its
--   bucket object names (static paths are not), for the admin to remove
--   from Storage. No cron: an admin action only (crons are off, 068).
-- * Storage (Supabase only, skipped where the storage schema is absent):
--   bucket `avatars`, public read, 2 MiB, image/webp; select/insert/
--   update/delete for authenticated super admins on that bucket only. The
--   select policy is what lets Storage's remove() see the rows it deletes:
--   a public bucket serves files by URL, but grants no SELECT on
--   storage.objects (as 077's cms_media_admin_select).
-- * Seed: the 53 shipped owner avatars, published, static paths.
--
-- Idempotent: safe to run twice.
-- ============================================================

begin;

create table if not exists public.avatars (
  id          text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  title_en    text not null check (char_length(btrim(title_en)) between 1 and 60),
  title_el    text not null default '' check (char_length(title_el) <= 60),
  thumb_path  text not null check (thumb_path ~ '^(/avatars/[A-Za-z0-9._-]+\.webp(\?v=[a-z0-9]+)?|[a-z0-9][a-z0-9-]*-96\.webp)$'),
  full_path   text not null check (full_path ~ '^(/avatars/[A-Za-z0-9._-]+\.webp(\?v=[a-z0-9]+)?|[a-z0-9][a-z0-9-]*-512\.webp)$'),
  status      text not null default 'unpublished' check (status in ('published', 'unpublished')),
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists avatars_picker_idx on public.avatars (sort, id)
  where deleted_at is null and status = 'published';

alter table public.avatars enable row level security;

revoke all on public.avatars from anon, authenticated;
grant select on public.avatars to anon, authenticated;
grant insert, update, delete on public.avatars to authenticated;

drop policy if exists avatars_public_read on public.avatars;
create policy avatars_public_read on public.avatars
  for select to anon, authenticated
  using (status = 'published' and deleted_at is null);

drop policy if exists avatars_admin_all on public.avatars;
create policy avatars_admin_all on public.avatars
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ── avatar_entries(ids): rows for avatars players already chose ────────
create or replace function public.avatar_entries(p_ids text[])
returns table (id text, title_en text, title_el text, thumb_path text, full_path text)
language sql stable security definer set search_path = public as $$
  select a.id, a.title_en, a.title_el, a.thumb_path, a.full_path
    from public.avatars a
   where a.deleted_at is null
     and a.id = any ((coalesce(p_ids, '{}'::text[]))[1:200])
$$;
revoke execute on function public.avatar_entries(text[]) from public;
grant execute on function public.avatar_entries(text[]) to anon, authenticated;

-- ── avatar_usage(): players per avatar, admins only ────────────────────
create or replace function public.avatar_usage()
returns table (avatar_id text, players int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
    select p.avatar_id, count(*)::int
      from public.players p
      join public.rooms r on r.id = p.room_id
     where p.avatar_id is not null
     group by p.avatar_id;
end $$;
revoke execute on function public.avatar_usage() from public, anon;
grant execute on function public.avatar_usage() to authenticated;

-- ── avatars_reorder(ids): picker order, admins only ────────────────────
create or replace function public.avatars_reorder(p_ids text[])
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  update public.avatars a
     set sort = o.pos * 10
    from unnest(p_ids) with ordinality as o(id, pos)
   where a.id = o.id;
end $$;
revoke execute on function public.avatars_reorder(text[]) from public, anon;
grant execute on function public.avatars_reorder(text[]) to authenticated;

-- ── avatar_purge(id): hard delete, admins only ─────────────────────────
create or replace function public.avatar_purge(p_id text)
returns text[]
language plpgsql security definer set search_path = public as $$
declare
  v public.avatars;
  v_used int;
begin
  if not public.is_super_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  select * into v from public.avatars where id = p_id for update;
  if not found then
    raise exception 'no avatar %', p_id;
  end if;
  if v.deleted_at is null then
    raise exception 'delete avatar % first; purge removes deleted avatars only', p_id;
  end if;
  select count(*)::int into v_used
    from public.players p join public.rooms r on r.id = p.room_id
   where p.avatar_id = p_id;
  if v_used > 0 and v.deleted_at > now() - interval '30 days' then
    raise exception 'avatar % is used by % player(s); it can be purged 30 days after it was deleted', p_id, v_used;
  end if;
  delete from public.avatars where id = p_id;
  return array(select x from unnest(array[v.thumb_path, v.full_path]) as x where x !~ '^/');
end $$;
revoke execute on function public.avatar_purge(text) from public, anon;
grant execute on function public.avatar_purge(text) to authenticated;

-- ── Storage bucket and policies (Supabase only) ────────────────────────
do $storage$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do update set public = true;

  if exists (select 1 from information_schema.columns
              where table_schema = 'storage' and table_name = 'buckets'
                and column_name = 'file_size_limit')
     and exists (select 1 from information_schema.columns
                  where table_schema = 'storage' and table_name = 'buckets'
                    and column_name = 'allowed_mime_types') then
    execute $q$update storage.buckets
                  set file_size_limit = 2097152,
                      allowed_mime_types = array['image/webp']
                where id = 'avatars'$q$;
  end if;

  drop policy if exists avatars_admin_select on storage.objects;
  create policy avatars_admin_select on storage.objects
    for select to authenticated
    using (bucket_id = 'avatars' and public.is_super_admin());

  drop policy if exists avatars_admin_insert on storage.objects;
  create policy avatars_admin_insert on storage.objects
    for insert to authenticated
    with check (bucket_id = 'avatars' and public.is_super_admin());

  drop policy if exists avatars_admin_update on storage.objects;
  create policy avatars_admin_update on storage.objects
    for update to authenticated
    using (bucket_id = 'avatars' and public.is_super_admin())
    with check (bucket_id = 'avatars' and public.is_super_admin());

  drop policy if exists avatars_admin_delete on storage.objects;
  create policy avatars_admin_delete on storage.objects
    for delete to authenticated
    using (bucket_id = 'avatars' and public.is_super_admin());
end
$storage$;

-- ── Seed: the 53 owner avatars that ship in public/avatars/ ────────────
-- (scripts/avatars/seed-sql.ts)
insert into public.avatars (id, title_en, title_el, thumb_path, full_path, status, sort) values
  ('img-01', 'Disco Commander', 'Disco Commander', '/avatars/img-01-96.webp?v=f1c7fdac', '/avatars/img-01-512.webp?v=f1c7fdac', 'published', 10),
  ('img-02', 'Ice Diva', 'Ice Diva', '/avatars/img-02-96.webp?v=51991dde', '/avatars/img-02-512.webp?v=51991dde', 'published', 20),
  ('img-03', 'Lightning Rocker', 'Lightning Rocker', '/avatars/img-03-96.webp?v=95a73cf2', '/avatars/img-03-512.webp?v=95a73cf2', 'published', 30),
  ('img-04', 'Golden Empress', 'Golden Empress', '/avatars/img-04-96.webp?v=24201166', '/avatars/img-04-512.webp?v=24201166', 'published', 40),
  ('img-05', 'Disco Granny', 'Disco Granny', '/avatars/img-05-96.webp?v=20336889', '/avatars/img-05-512.webp?v=20336889', 'published', 50),
  ('img-06', 'Alien Crooner', 'Alien Crooner', '/avatars/img-06-96.webp?v=b64ef8f7', '/avatars/img-06-512.webp?v=b64ef8f7', 'published', 60),
  ('img-07', 'Folk Metal Baritone', 'Folk Metal Baritone', '/avatars/img-07-96.webp?v=ca50a560', '/avatars/img-07-512.webp?v=ca50a560', 'published', 70),
  ('img-08', 'Bubblegum Princess', 'Bubblegum Princess', '/avatars/img-08-96.webp?v=259b6f30', '/avatars/img-08-512.webp?v=259b6f30', 'published', 80),
  ('img-09', 'Gothic Tenor', 'Gothic Tenor', '/avatars/img-09-96.webp?v=42b59cb3', '/avatars/img-09-512.webp?v=42b59cb3', 'published', 90),
  ('img-10', 'Velvet Prince', 'Velvet Prince', '/avatars/img-10-96.webp?v=303b1e4d', '/avatars/img-10-512.webp?v=303b1e4d', 'published', 100),
  ('img-11', 'Synth Pop Headliner', 'Synth Pop Headliner', '/avatars/img-11-96.webp?v=3afebc0a', '/avatars/img-11-512.webp?v=3afebc0a', 'published', 110),
  ('img-12', 'Rhinestone Yodeler', 'Rhinestone Yodeler', '/avatars/img-12-96.webp?v=29a4864b', '/avatars/img-12-512.webp?v=29a4864b', 'published', 120),
  ('img-13', 'Neon Punk', 'Neon Punk', '/avatars/img-13-96.webp?v=eadd3334', '/avatars/img-13-512.webp?v=eadd3334', 'published', 130),
  ('img-14', 'Ebony Contralto', 'Ebony Contralto', '/avatars/img-14-96.webp?v=68f69a65', '/avatars/img-14-512.webp?v=68f69a65', 'published', 140),
  ('img-15', 'Afro Disco King', 'Afro Disco King', '/avatars/img-15-96.webp?v=4eb02706', '/avatars/img-15-512.webp?v=4eb02706', 'published', 150),
  ('img-16', 'Accordion Heartthrob', 'Accordion Heartthrob', '/avatars/img-16-96.webp?v=27f2239e', '/avatars/img-16-512.webp?v=27f2239e', 'published', 160),
  ('img-17', 'Fuchsia Pageant Queen', 'Fuchsia Pageant Queen', '/avatars/img-17-96.webp?v=0ac3c06a', '/avatars/img-17-512.webp?v=0ac3c06a', 'published', 170),
  ('img-18', 'Cabaret Mime', 'Cabaret Mime', '/avatars/img-18-96.webp?v=ab8e5a6b', '/avatars/img-18-512.webp?v=ab8e5a6b', 'published', 180),
  ('img-19', 'Punk Auntie', 'Punk Auntie', '/avatars/img-19-96.webp?v=e8f9abca', '/avatars/img-19-512.webp?v=e8f9abca', 'published', 190),
  ('img-20', 'Electro Folk Vocalist', 'Electro Folk Vocalist', '/avatars/img-20-96.webp?v=bab04084', '/avatars/img-20-512.webp?v=bab04084', 'published', 200),
  ('img-21', 'Shrimp Balladeer', 'Shrimp Balladeer', '/avatars/img-21-96.webp?v=0ac4f609', '/avatars/img-21-512.webp?v=0ac4f609', 'published', 210),
  ('img-22', 'Mermaid Crooner', 'Mermaid Crooner', '/avatars/img-22-96.webp?v=f680e31c', '/avatars/img-22-512.webp?v=f680e31c', 'published', 220),
  ('img-23', 'Orange Soul Diva', 'Orange Soul Diva', '/avatars/img-23-96.webp?v=8875e23f', '/avatars/img-23-512.webp?v=8875e23f', 'published', 230),
  ('img-24', 'Neon Party Metal', 'Neon Party Metal', '/avatars/img-24-96.webp?v=1def1c3b', '/avatars/img-24-512.webp?v=1def1c3b', 'published', 240),
  ('img-25', 'Disco Vampire', 'Disco Vampire', '/avatars/img-25-96.webp?v=90597046', '/avatars/img-25-512.webp?v=90597046', 'published', 250),
  ('img-26', 'Tuxedo Blues', 'Tuxedo Blues', '/avatars/img-26-96.webp?v=a3abe964', '/avatars/img-26-512.webp?v=a3abe964', 'published', 260),
  ('img-27', 'Brocade Tenor', 'Brocade Tenor', '/avatars/img-27-96.webp?v=002de08b', '/avatars/img-27-512.webp?v=002de08b', 'published', 270),
  ('img-28', 'Techno DJ', 'Techno DJ', '/avatars/img-28-96.webp?v=ee509b8b', '/avatars/img-28-512.webp?v=ee509b8b', 'published', 280),
  ('img-29', 'Firebird', 'Firebird', '/avatars/img-29-96.webp?v=a5a33d81', '/avatars/img-29-512.webp?v=a5a33d81', 'published', 290),
  ('img-30', 'Masked Metal', 'Masked Metal', '/avatars/img-30-96.webp?v=6dd6a406', '/avatars/img-30-512.webp?v=6dd6a406', 'published', 300),
  ('img-31', 'Roller Disco', 'Roller Disco', '/avatars/img-31-96.webp?v=08f634e0', '/avatars/img-31-512.webp?v=08f634e0', 'published', 310),
  ('img-32', 'Eurodance Maximalist', 'Eurodance Maximalist', '/avatars/img-32-96.webp?v=6fb4dd1a', '/avatars/img-32-512.webp?v=6fb4dd1a', 'published', 320),
  ('img-33', 'Drag King', 'Drag King', '/avatars/img-33-96.webp?v=45e192f1', '/avatars/img-33-512.webp?v=45e192f1', 'published', 330),
  ('img-34', 'Opera Grandpa', 'Opera Grandpa', '/avatars/img-34-96.webp?v=bf0d4949', '/avatars/img-34-512.webp?v=bf0d4949', 'published', 340),
  ('img-35', 'Jewel Pop Diva', 'Jewel Pop Diva', '/avatars/img-35-96.webp?v=660fedd1', '/avatars/img-35-512.webp?v=660fedd1', 'published', 350),
  ('img-36', 'Wedding Balladeer', 'Wedding Balladeer', '/avatars/img-36-96.webp?v=bf531c9b', '/avatars/img-36-512.webp?v=bf531c9b', 'published', 360),
  ('img-37', 'Glitter Glam Rocker', 'Glitter Glam Rocker', '/avatars/img-37-96.webp?v=4b2d64d2', '/avatars/img-37-512.webp?v=4b2d64d2', 'published', 370),
  ('img-38', 'Space Lounge', 'Space Lounge', '/avatars/img-38-96.webp?v=5afae3dc', '/avatars/img-38-512.webp?v=5afae3dc', 'published', 380),
  ('img-39', 'Black Swan Cabaret', 'Black Swan Cabaret', '/avatars/img-39-96.webp?v=ac3e27e8', '/avatars/img-39-512.webp?v=ac3e27e8', 'published', 390),
  ('img-40', 'Chrome Heart Pop', 'Chrome Heart Pop', '/avatars/img-40-96.webp?v=fe8bb1fa', '/avatars/img-40-512.webp?v=fe8bb1fa', 'published', 400),
  ('img-42', 'Greek Heartthrob', 'Greek Heartthrob', '/avatars/img-42-96.webp?v=f7d6dd85', '/avatars/img-42-512.webp?v=f7d6dd85', 'published', 410),
  ('img-43', 'Bubblegum Pop', 'Bubblegum Pop', '/avatars/img-43-96.webp?v=0e71cb6c', '/avatars/img-43-512.webp?v=0e71cb6c', 'published', 420),
  ('img-44', 'Dum Tek Tek', 'Dum Tek Tek', '/avatars/img-44-96.webp?v=0472f19d', '/avatars/img-44-512.webp?v=0472f19d', 'published', 430),
  ('img-45', 'Greek Pop Diva', 'Greek Pop Diva', '/avatars/img-45-96.webp?v=7eb14f68', '/avatars/img-45-512.webp?v=7eb14f68', 'published', 440),
  ('img-47', 'Swedish Electropop', 'Swedish Electropop', '/avatars/img-47-96.webp?v=af03d60b', '/avatars/img-47-512.webp?v=af03d60b', 'published', 450),
  ('img-49', 'Wild Dance Captain', 'Wild Dance Captain', '/avatars/img-49-96.webp?v=4fe66608', '/avatars/img-49-512.webp?v=4fe66608', 'published', 460),
  ('img-50', 'Cyberpop Captain', 'Cyberpop Captain', '/avatars/img-50-96.webp?v=cd4016ab', '/avatars/img-50-512.webp?v=cd4016ab', 'published', 470),
  ('img-51', 'Gargoyle Rocker', 'Gargoyle Rocker', '/avatars/img-51-96.webp?v=31757753', '/avatars/img-51-512.webp?v=31757753', 'published', 480),
  ('img-52', 'Crescent Ritual', 'Crescent Ritual', '/avatars/img-52-96.webp?v=10e85f6d', '/avatars/img-52-512.webp?v=10e85f6d', 'published', 490),
  ('img-53', 'Industrial Vocalist', 'Industrial Vocalist', '/avatars/img-53-96.webp?v=f83c13e4', '/avatars/img-53-512.webp?v=f83c13e4', 'published', 500),
  ('img-54', 'Cabaret Marshal', 'Cabaret Marshal', '/avatars/img-54-96.webp?v=394cf070', '/avatars/img-54-512.webp?v=394cf070', 'published', 510),
  ('img-55', 'Fox Synthpop', 'Fox Synthpop', '/avatars/img-55-96.webp?v=26818d92', '/avatars/img-55-512.webp?v=26818d92', 'published', 520),
  ('img-56', 'Satirical Disco Diva', 'Satirical Disco Diva', '/avatars/img-56-96.webp?v=a73b3095', '/avatars/img-56-512.webp?v=a73b3095', 'published', 530)
on conflict (id) do nothing;

commit;
