// @vitest-environment node
// 077: cms_media (CMS 3c media metadata), the media_* RPCs, the 074
// publish_input().media extension, and the guarded Storage bucket/policy block.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser, makeAdmin, applyMigration } from './harness';

const ADMIN = '00000000-0000-4000-8000-000000000001';
const STRANGER = '00000000-0000-4000-8000-0000000000ff';

const SHA = 'a'.repeat(64);
const MB = 1024 * 1024;
const uuidPath = (ext: string, variant = false) =>
  `${crypto.randomUUID()}${variant ? '-800' : ''}.${ext}`;

type MediaRow = {
  id: string;
  kind: string;
  storage_path: string;
  variant_of: string | null;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  sha256: string;
  published_path: string | null;
};

describe('077 cms_media', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
    await makeAdmin(db, ADMIN, 'admin@example.test');
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  beforeEach(async () => {
    await db.exec(`reset role`);
    await asUser(db, null);
    await db.exec(`delete from public.cms_media where true;
                   delete from public.cms_documents where true;
                   delete from public.publish_runs where true`);
    await asUser(db, ADMIN);
  });

  async function asService<T>(fn: () => Promise<T>): Promise<T> {
    await db.exec(`set role service_role`);
    try {
      return await fn();
    } finally {
      await db.exec(`reset role`);
    }
  }

  type Reg = {
    kind: string;
    path: string;
    mime: string;
    bytes: number;
    width?: number | null;
    height?: number | null;
    sha?: string;
    variantOf?: string | null;
  };
  const register = async (r: Reg) =>
    (
      await db.query<{ id: string }>(
        `select public.media_register($1, $2, $3, $4, $5, $6, $7, $8::uuid) as id`,
        [r.kind, r.path, r.mime, r.bytes, r.width ?? null, r.height ?? null, r.sha ?? SHA, r.variantOf ?? null],
      )
    ).rows[0].id;
  const image = (over: Partial<Reg> = {}) =>
    register({ kind: 'image', path: uuidPath('webp'), mime: 'image/webp', bytes: 1000, width: 1600, height: 900, ...over });
  const variant = (parent: string, over: Partial<Reg> = {}) =>
    image({ path: uuidPath('webp', true), width: 800, height: 450, variantOf: parent, ...over });
  const video = (over: Partial<Reg> = {}) =>
    register({ kind: 'video', path: uuidPath('mp4'), mime: 'video/mp4', bytes: 5 * MB, ...over });
  const captions = (over: Partial<Reg> = {}) =>
    register({ kind: 'captions', path: uuidPath('vtt'), mime: 'text/vtt', bytes: 2000, ...over });

  const list = async (kind: string | null = null) =>
    (await db.query<MediaRow>(`select * from public.media_list($1)`, [kind])).rows;
  const del = async (id: string) =>
    (await db.query<{ p: string[] }>(`select public.media_delete($1::uuid) as p`, [id])).rows[0].p;
  const save = (id: string, data: unknown) =>
    db.query(`select public.cms_save($1, $1, $2::jsonb, null)`, [id, JSON.stringify(data)]);
  const docRef = (...ids: string[]) => ({
    en: { hero: { media: `cms-media/${ids[0]}`, alt: 'x' }, more: ids.slice(1).map((i) => `cms-media/${i}`) },
    el: { title: 'y' },
  });
  const tick = () => new Promise((r) => setTimeout(r, 3));
  const publishOk = async () => {
    await tick();
    const id = (await db.query<{ id: string }>(`select public.begin_publish() as id`)).rows[0].id;
    await asService(() => db.query(`select public.end_publish($1, 'ok', null, 0, null)`, [id]));
  };
  const inputMedia = async () =>
    asService(
      async () =>
        (await db.query<{ i: { media: MediaRow[] } }>(`select public.publish_input() as i`)).rows[0].i.media,
    );

  // ── table ──────────────────────────────────────────────────
  it('the table has RLS on, no policies, and no direct access for anon/authenticated', async () => {
    const rls = await db.query<{ r: boolean }>(`select relrowsecurity as r from pg_class where oid = 'public.cms_media'::regclass`);
    expect(rls.rows[0].r).toBe(true);
    const pol = await db.query(`select 1 from pg_policies where schemaname = 'public' and tablename = 'cms_media'`);
    expect(pol.rows).toHaveLength(0);
    await image();
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      try {
        const r = await db.query(`select * from public.cms_media`).catch((e: Error) => e);
        if (r instanceof Error) expect(r.message).toMatch(/permission denied/);
        else expect(r.rows).toEqual([]);
      } finally {
        await db.exec(`reset role`);
      }
    }
  });

  // ── media_register ─────────────────────────────────────────
  it('media_register stores an image and returns its id; media_list returns it', async () => {
    const path = uuidPath('webp');
    const id = await image({ path });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const rows = await list();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id, kind: 'image', storage_path: path, mime: 'image/webp', bytes: 1000,
      width: 1600, height: 900, sha256: SHA, published_path: null, variant_of: null,
    });
    const by = await db.query<{ created_by: string }>(`select created_by from public.cms_media where id = $1`, [id]);
    expect(by.rows[0].created_by).toBe(ADMIN);
  });

  it('media_register accepts each kind at its exact size limit', async () => {
    await image({ bytes: 2 * MB });
    await video({ bytes: 20 * MB });
    await video({ bytes: 1000, width: 1280, height: 720 });
    await captions({ bytes: 200 * 1024 });
    expect(await list()).toHaveLength(4);
  });

  it('media_register rejects a mime that does not match the kind', async () => {
    await expect(image({ mime: 'image/png' })).rejects.toThrow(/mime/);
    await expect(image({ mime: 'image/jpeg' })).rejects.toThrow(/mime/);
    await expect(video({ mime: 'video/webm' })).rejects.toThrow(/mime/);
    await expect(captions({ mime: 'text/plain' })).rejects.toThrow(/mime/);
    await expect(register({ kind: 'audio', path: uuidPath('mp4'), mime: 'video/mp4', bytes: 10 })).rejects.toThrow(/kind/);
  });

  it('media_register rejects sizes over the limit, zero and negative', async () => {
    await expect(image({ bytes: 2 * MB + 1 })).rejects.toThrow(/too large/);
    await expect(video({ bytes: 20 * MB + 1 })).rejects.toThrow(/too large/);
    await expect(captions({ bytes: 200 * 1024 + 1 })).rejects.toThrow(/too large/);
    await expect(image({ bytes: 0 })).rejects.toThrow(/bytes/);
    await expect(image({ bytes: -5 })).rejects.toThrow(/bytes/);
  });

  it('media_register requires positive width and height for an image', async () => {
    await expect(image({ width: null })).rejects.toThrow(/width and height/);
    await expect(image({ height: null })).rejects.toThrow(/width and height/);
    await expect(image({ width: 0 })).rejects.toThrow(/width and height/);
    await expect(video({ width: -1, height: 10 })).rejects.toThrow(/width and height/);
  });

  it('media_register requires sha256 as 64 lowercase hex characters', async () => {
    await expect(image({ sha: 'abc' })).rejects.toThrow(/sha256/);
    await expect(image({ sha: 'A'.repeat(64) })).rejects.toThrow(/sha256/);
    await expect(image({ sha: 'g'.repeat(64) })).rejects.toThrow(/sha256/);
  });

  it('media_register rejects a storage_path with folders, traversal or the wrong extension', async () => {
    const u = crypto.randomUUID();
    for (const bad of [
      `cms-media/${u}.webp`,
      `../${u}.webp`,
      `${u}/../x.webp`,
      `${u}.webp/..`,
      `${u.toUpperCase()}.webp`,
      `${u}.png`,
      `${u}.mp4`, // image with a video extension
      `${u}-400.webp`,
      `${u}.webp.webp`,
      `x${u}.webp`,
      '',
    ]) {
      await expect(image({ path: bad }), bad).rejects.toThrow(/storage_path/);
    }
    await expect(video({ path: `${u}.webp` })).rejects.toThrow(/storage_path/);
    await expect(captions({ path: `${u}.mp4` })).rejects.toThrow(/storage_path/);
  });

  it('media_register refuses a duplicate storage_path', async () => {
    const path = uuidPath('webp');
    await image({ path });
    await expect(image({ path })).rejects.toThrow(/already registered/);
  });

  it('variants: an 800 w image variant of an image is accepted', async () => {
    const parent = await image();
    const v = await variant(parent);
    const rows = await list();
    expect(rows.find((r) => r.id === v)!.variant_of).toBe(parent);
  });

  it('variants: must be an image, of an existing non-variant image, with a -800 path', async () => {
    const parent = await image();
    const vid = await video();
    // A variant path without variant_of, and variant_of without a variant path.
    await expect(image({ path: uuidPath('webp', true) })).rejects.toThrow(/variant/);
    await expect(image({ variantOf: parent })).rejects.toThrow(/variant/);
    // Variant of a video.
    await expect(variant(vid)).rejects.toThrow(/variant/);
    // A video as a variant.
    await expect(video({ path: uuidPath('mp4', true), variantOf: parent })).rejects.toThrow(/variant|storage_path/);
    // Variant of a missing row.
    await expect(variant(crypto.randomUUID())).rejects.toThrow(/variant/);
    // Variant of a variant.
    const v = await variant(parent);
    await expect(variant(v)).rejects.toThrow(/variant/);
  });

  // ── access ─────────────────────────────────────────────────
  it('non-admins are forbidden; anon cannot execute; media_mark_published is service-role only', async () => {
    const id = await image();
    await asUser(db, STRANGER);
    await expect(image()).rejects.toThrow(/forbidden/);
    await expect(list()).rejects.toThrow(/forbidden/);
    await expect(del(id)).rejects.toThrow(/forbidden/);

    const can = async (role: string, fn: string) =>
      (await db.query<{ c: boolean }>(`select has_function_privilege($1, $2, 'execute') as c`, [role, fn])).rows[0].c;
    const reg = 'public.media_register(text, text, text, int, int, int, text, uuid)';
    const lst = 'public.media_list(text)';
    const dl = 'public.media_delete(uuid)';
    const mp = 'public.media_mark_published(uuid, text)';
    for (const fn of [reg, lst, dl]) {
      expect(await can('anon', fn), fn).toBe(false);
      expect(await can('authenticated', fn), fn).toBe(true);
    }
    expect(await can('anon', mp)).toBe(false);
    expect(await can('authenticated', mp)).toBe(false);
    expect(await can('service_role', mp)).toBe(true);
    for (const fn of [reg, lst, dl, mp]) {
      const d = await db.query<{ d: boolean; c: string[] | null }>(
        `select prosecdef as d, proconfig as c from pg_proc where oid = $1::regprocedure`, [fn]);
      expect(d.rows[0].d, fn).toBe(true);
      expect(d.rows[0].c, fn).toContain('search_path=public');
    }
  });

  // ── media_list ─────────────────────────────────────────────
  it('media_list filters by kind', async () => {
    const i = await image();
    const v = await video();
    const c = await captions();
    expect((await list('image')).map((r) => r.id)).toEqual([i]);
    expect((await list('video')).map((r) => r.id)).toEqual([v]);
    expect((await list('captions')).map((r) => r.id)).toEqual([c]);
    expect((await list()).map((r) => r.id).sort()).toEqual([i, v, c].sort());
  });

  // ── media_delete ───────────────────────────────────────────
  it('media_delete removes an unreferenced image and its variant, returning both storage paths', async () => {
    const pPath = uuidPath('webp');
    const vPath = uuidPath('webp', true);
    const parent = await image({ path: pPath });
    await variant(parent, { path: vPath });
    const other = await image();
    expect((await del(parent)).sort()).toEqual([pPath, vPath].sort());
    expect((await list()).map((r) => r.id)).toEqual([other]);
  });

  it('media_delete of a variant removes only the variant', async () => {
    const parent = await image();
    const vPath = uuidPath('webp', true);
    const v = await variant(parent, { path: vPath });
    expect(await del(v)).toEqual([vPath]);
    expect((await list()).map((r) => r.id)).toEqual([parent]);
  });

  it('media_delete raises for a missing id', async () => {
    await expect(del(crypto.randomUUID())).rejects.toThrow(/not found/);
  });

  it('media_delete refuses while a draft references the media, naming the docs', async () => {
    const parent = await image();
    const v = await variant(parent);
    const unrelated = await image();
    await save('home', docRef(parent));
    await save('about', docRef(unrelated, parent));
    await expect(del(parent)).rejects.toThrow('media in use by about, home');
    // The variant goes with a referenced parent, so it is in use too.
    await expect(del(v)).rejects.toThrow('media in use by about, home');
    expect(await list()).toHaveLength(3);
  });

  it('media_delete counts already-published drafts as references', async () => {
    const id = await image();
    await save('home', docRef(id));
    await publishOk();
    await expect(del(id)).rejects.toThrow('media in use by home');
  });

  it('media_delete succeeds once the referencing draft is discarded', async () => {
    const id = await image();
    await save('home', docRef(id));
    await db.query(`select public.cms_discard('home')`);
    expect(await del(id)).toHaveLength(1);
  });

  // ── media_mark_published ───────────────────────────────────
  it('media_mark_published sets published_path (service role) and validates it', async () => {
    const id = await image();
    await asService(() => db.query(`select public.media_mark_published($1::uuid, '/media/0123456789ab.webp')`, [id]));
    expect((await list())[0].published_path).toBe('/media/0123456789ab.webp');
    await asService(() => db.query(`select public.media_mark_published($1::uuid, '/media/0123456789ab-800.webp')`, [id]));
    for (const bad of ['media/0123456789ab.webp', '/media/0123456789AB.webp', '/media/../x.webp', '/media/0123.webp', 'https://x/a.webp']) {
      await expect(
        asService(() => db.query(`select public.media_mark_published($1::uuid, $2)`, [id, bad])),
        bad,
      ).rejects.toThrow(/published path/);
    }
    await expect(
      asService(() => db.query(`select public.media_mark_published($1::uuid, '/media/0123456789ab.webp')`, [crypto.randomUUID()])),
    ).rejects.toThrow(/not found/);
    await db.exec(`set role authenticated`);
    try {
      await expect(db.query(`select public.media_mark_published($1::uuid, '/media/0123456789ab.webp')`, [id]))
        .rejects.toThrow(/permission denied/);
    } finally {
      await db.exec(`reset role`);
    }
  });

  // ── publish_input().media ──────────────────────────────────
  it('publish_input.media is [] with no drafts, and with drafts that reference no media', async () => {
    await image();
    expect(await inputMedia()).toEqual([]);
    await save('home', { en: { title: 'no media' }, el: { title: 'x' } });
    expect(await inputMedia()).toEqual([]);
  });

  it('publish_input.media lists the media referenced by unpublished drafts, plus their variants', async () => {
    const pPath = uuidPath('webp');
    const parent = await image({ path: pPath });
    const v = await variant(parent);
    const vid = await video();
    const cap = await captions();
    const unused = await image();
    await save('home', docRef(parent, vid));
    await save('about', { en: { title: 'no media' }, el: { title: 'x' } });
    const media = await inputMedia();
    expect(media.map((m) => m.id).sort()).toEqual([parent, v, vid].sort());
    expect(media.map((m) => m.id)).not.toContain(cap);
    expect(media.map((m) => m.id)).not.toContain(unused);
    const p = media.find((m) => m.id === parent)!;
    expect(Object.keys(p).sort()).toEqual(
      ['bytes', 'height', 'id', 'kind', 'mime', 'published_path', 'sha256', 'storage_path', 'variant_of', 'width'],
    );
    expect(p).toMatchObject({ kind: 'image', storage_path: pPath, mime: 'image/webp', bytes: 1000, width: 1600, height: 900, sha256: SHA, published_path: null, variant_of: null });
    expect(media.find((m) => m.id === v)!.variant_of).toBe(parent);
    // Each row once, even when referenced by two drafts.
    await save('faq', docRef(parent, cap));
    const again = await inputMedia();
    expect(again.map((m) => m.id).sort()).toEqual([parent, v, vid, cap].sort());
  });

  it('publish_input.media drops media of published drafts, and brings it back on the next edit', async () => {
    const id = await image();
    await save('home', docRef(id));
    expect((await inputMedia()).map((m) => m.id)).toEqual([id]);
    await publishOk();
    expect(await inputMedia()).toEqual([]);
    const t = (await db.query<{ t: Date }>(`select updated_at as t from public.cms_documents where doc_id = 'home'`)).rows[0].t;
    await db.query(`select public.cms_save('home', 'home', $1::jsonb, $2::timestamptz)`, [JSON.stringify(docRef(id)), t]);
    expect((await inputMedia()).map((m) => m.id)).toEqual([id]);
  });

  it('publish_input keeps every existing key and adds media', async () => {
    const input = await asService(
      async () => (await db.query<{ i: Record<string, unknown> }>(`select public.publish_input() as i`)).rows[0].i,
    );
    expect(Object.keys(input).sort()).toEqual(['cms_documents', 'contests', 'countries', 'entries', 'generated_at', 'media']);
  });
});

describe('077 migration application', () => {
  it('is idempotent and its Storage block is a no-op without a storage schema', async () => {
    const db = await createDb();
    try {
      await applyMigration(db, '077');
      const ns = await db.query(`select 1 from pg_namespace where nspname = 'storage'`);
      expect(ns.rows).toHaveLength(0);
    } finally {
      await db.close();
    }
  }, 120_000);

  it('publish_input works on a database without 077 (media is [])', async () => {
    const db = await createDb({ upTo: '076' });
    try {
      await db.exec(`set role service_role`);
      const i = (await db.query<{ i: { media: unknown } }>(`select public.publish_input() as i`)).rows[0].i;
      expect(i.media).toEqual([]);
    } finally {
      await db.close();
    }
  }, 120_000);

  it('with a storage schema: creates the private cms-media bucket and super-admin-only policies', async () => {
    const db = await createDb({ upTo: '076' });
    try {
      // A minimal stand-in for Supabase's storage schema.
      await db.exec(`
        create schema storage;
        create table storage.buckets (
          id text primary key, name text not null, public boolean default false,
          file_size_limit bigint, allowed_mime_types text[]);
        create table storage.objects (
          id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
          name text, owner uuid);
        alter table storage.objects enable row level security;
        grant usage on schema storage to anon, authenticated, service_role;
        grant select, insert, update, delete on storage.objects to anon, authenticated;
        insert into storage.buckets (id, name, public) values ('other', 'other', true);
      `);
      await makeAdmin(db, ADMIN, 'admin@example.test');
      await applyMigration(db, '077');
      await applyMigration(db, '077'); // idempotent, policies included

      const b = await db.query<{ public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
        `select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'cms-media'`);
      expect(b.rows).toHaveLength(1);
      expect(b.rows[0].public).toBe(false);
      expect(Number(b.rows[0].file_size_limit)).toBe(20 * MB);
      expect([...b.rows[0].allowed_mime_types].sort()).toEqual(['image/webp', 'text/vtt', 'video/mp4']);

      const pols = await db.query<{ cmd: string; roles: string[] }>(
        `select cmd, roles from pg_policies where schemaname = 'storage' and tablename = 'objects' order by cmd`);
      expect(pols.rows.map((p) => p.cmd)).toEqual(['DELETE', 'INSERT', 'SELECT', 'UPDATE']);
      for (const p of pols.rows) expect(p.roles).toEqual(['authenticated']);

      const ins = (bucket: string) =>
        db.query(`insert into storage.objects (bucket_id, name) values ($1, 'x.webp')`, [bucket]);
      await db.exec(`set role authenticated`);
      try {
        await asUser(db, ADMIN);
        await ins('cms-media');
        expect((await db.query(`select * from storage.objects where bucket_id = 'cms-media'`)).rows).toHaveLength(1);
        // These policies grant nothing on other buckets.
        await expect(ins('other')).rejects.toThrow(/row-level security/);
        await asUser(db, STRANGER);
        await expect(ins('cms-media')).rejects.toThrow(/row-level security/);
        expect((await db.query(`select * from storage.objects`)).rows).toHaveLength(0);
        const d = await db.query(`delete from storage.objects where bucket_id = 'cms-media'`);
        expect(d.affectedRows).toBe(0);
      } finally {
        await db.exec(`reset role`);
      }
      await db.exec(`set role anon`);
      try {
        await asUser(db, null);
        await expect(ins('cms-media')).rejects.toThrow(/row-level security/);
      } finally {
        await db.exec(`reset role`);
      }

      // A pre-existing public cms-media bucket is made private.
      await db.exec(`update storage.buckets set public = true where id = 'cms-media'`);
      await applyMigration(db, '077');
      expect((await db.query<{ p: boolean }>(`select public as p from storage.buckets where id = 'cms-media'`)).rows[0].p).toBe(false);
    } finally {
      await db.close();
    }
  }, 120_000);
});
