// @vitest-environment node
// 076: cms_documents drafts and the cms_* RPCs, plus the 074 extensions
// (publish_input.cms_documents, unpublished_summary.changed_docs).
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, asUser, makeAdmin } from './harness';

const ADMIN = '00000000-0000-4000-8000-000000000001';
const ADMIN2 = '00000000-0000-4000-8000-000000000002';
const STRANGER = '00000000-0000-4000-8000-0000000000ff';

const doc = (title: string) => ({ en: { title }, el: { title: `${title} (el)` } });

type ListRow = { doc_id: string; doc_type: string; updated_at: Date; published: boolean };
type GetResult = { doc_id: string; doc_type: string; data: unknown; updated_at: string } | null;
type Summary = { changed_years: number[]; changed_docs: string[]; since: string | null };

describe('076 cms_documents', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
    await makeAdmin(db, ADMIN, 'admin@example.test');
    await makeAdmin(db, ADMIN2, 'admin2@example.test');
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  beforeEach(async () => {
    await db.exec(`reset role`);
    await asUser(db, null);
    await db.exec(`delete from public.cms_documents where true; delete from public.publish_runs where true`);
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

  const save = async (id: string, type: string, data: unknown, expected: unknown) =>
    (
      await db.query<{ t: Date }>(`select public.cms_save($1, $2, $3::jsonb, $4::timestamptz) as t`, [
        id,
        type,
        JSON.stringify(data),
        expected,
      ])
    ).rows[0].t;
  const get = async (id: string) =>
    (await db.query<{ d: GetResult }>(`select public.cms_get($1) as d`, [id])).rows[0].d;
  const list = async () =>
    (await db.query<ListRow>(`select * from public.cms_list() order by doc_id`)).rows;
  const discard = (id: string) => db.query(`select public.cms_discard($1)`, [id]);
  const summary = async () =>
    (await db.query<{ s: Summary }>(`select public.unpublished_summary() as s`)).rows[0].s;
  const publishOk = async (status: 'ok' | 'noop' = 'ok') => {
    const id = (await db.query<{ id: string }>(`select public.begin_publish() as id`)).rows[0].id;
    await asService(() => db.query(`select public.end_publish($1, $2, null, 0, null)`, [id, status]));
  };
  /** A contest lifecycle auto-publish: begin_publish(false) ships no CMS drafts. */
  const publishContestsOnly = async () => {
    const id = (await db.query<{ id: string }>(`select public.begin_publish(false) as id`)).rows[0].id;
    await asService(() => db.query(`select public.end_publish($1, 'ok', null, 0, null)`, [id]));
  };
  const inputDocs = async () =>
    asService(async () =>
      ((await db.query<{ i: { cms_documents: Array<{ doc_id: string }> } }>(`select public.publish_input() as i`)).rows[0].i
        .cms_documents.map((d) => d.doc_id)));

  it('cms_save inserts a new document and cms_get returns it', async () => {
    const t = await save('home', 'home', doc('Hello'), null);
    expect(t).toBeInstanceOf(Date);
    const d = await get('home');
    expect(d).toMatchObject({ doc_id: 'home', doc_type: 'home', data: doc('Hello') });
    expect(new Date(d!.updated_at).getTime()).toBe(t.getTime());
    const row = (await db.query<{ updated_by: string }>(`select updated_by from public.cms_documents where doc_id = 'home'`)).rows[0];
    expect(row.updated_by).toBe(ADMIN);
  });

  it('cms_get returns null for a missing document', async () => {
    expect(await get('nope')).toBeNull();
  });

  it('the updated_at returned by cms_save round-trips into the next save', async () => {
    const t1 = await save('home', 'home', doc('A'), null);
    const t2 = await save('home', 'home', doc('B'), t1);
    expect(t2.getTime()).toBeGreaterThan(t1.getTime());
    // The string form from cms_get round-trips too.
    const t3 = await save('home', 'home', doc('C'), (await get('home'))!.updated_at);
    expect(t3.getTime()).toBeGreaterThan(t2.getTime());
    expect((await get('home'))!.data).toEqual(doc('C'));
  });

  it('concurrency: a save with a stale updated_at raises and changes nothing', async () => {
    const t1 = await save('home', 'home', doc('A'), null);
    // Admin 1 and admin 2 both loaded t1. Admin 2 saves first.
    await asUser(db, ADMIN2);
    await save('home', 'home', doc('B'), t1);
    await asUser(db, ADMIN);
    await expect(save('home', 'home', doc('A2'), t1)).rejects.toThrow(/document changed by someone else; reload/);
    expect((await get('home'))!.data).toEqual(doc('B'));
  });

  it('concurrency: back-to-back saves never reuse an updated_at', async () => {
    let t = await save('home', 'home', doc('0'), null);
    const seen = new Set([t.getTime()]);
    for (let i = 1; i <= 5; i++) {
      t = await save('home', 'home', doc(String(i)), t);
      seen.add(t.getTime());
    }
    expect(seen.size).toBe(6);
  });

  it('concurrency: inserting over an existing document, or updating a missing one, raises', async () => {
    const t1 = await save('home', 'home', doc('A'), null);
    await expect(save('home', 'home', doc('X'), null)).rejects.toThrow(/document changed by someone else; reload/);
    await discard('home');
    await expect(save('home', 'home', doc('Y'), t1)).rejects.toThrow(/document changed by someone else; reload/);
    expect(await get('home')).toBeNull();
  });

  it('cms_save rejects a data value that is not an {en, el} object', async () => {
    await expect(save('home', 'home', [1, 2], null)).rejects.toThrow(/en.*el/);
    await expect(save('home', 'home', { en: {} }, null)).rejects.toThrow(/en.*el/);
    await expect(save('home', 'home', { el: {} }, null)).rejects.toThrow(/en.*el/);
    await expect(
      db.query(`select public.cms_save('home', 'home', null, null)`),
    ).rejects.toThrow(/en.*el/);
  });

  it('cms_save rejects a document of 1 MiB or more (pg_column_size) and keeps the old one', async () => {
    const t = await save('home', 'home', doc('A'), null);
    const big = { en: { title: 'x'.repeat(1_100_000) }, el: { title: 'y' } };
    await expect(save('home', 'home', big, t)).rejects.toThrow(/document too large/);
    await expect(save('about', 'about', big, null)).rejects.toThrow(/document too large/);
    expect((await get('home'))!.data).toEqual(doc('A'));
    expect(await get('about')).toBeNull();
    // Just under the limit is fine.
    const ok = { en: { title: 'x'.repeat(900_000) }, el: { title: 'y' } };
    await expect(save('home', 'home', ok, t)).resolves.toBeInstanceOf(Date);
  });

  it('cms_save reads its timestamp after taking the row lock (a waiting save is never stamped before the lock holder)', async () => {
    const src = (await db.query<{ src: string }>(
      `select prosrc as src from pg_proc where proname = 'cms_save' and pronamespace = 'public'::regnamespace`,
    )).rows[0].src.toLowerCase();
    // No stamp in the declare section; in the update branch, clock_timestamp() only after "for update".
    const declare = src.slice(0, src.indexOf('begin'));
    expect(declare).not.toContain('clock_timestamp');
    const lock = src.indexOf('for update');
    expect(lock).toBeGreaterThan(0);
    const updateBranch = src.slice(src.indexOf('else', src.indexOf('p_expected_updated_at is null')));
    expect(updateBranch.indexOf('clock_timestamp')).toBeGreaterThan(updateBranch.indexOf('for update'));
  });

  it('cms_save rejects a bad doc_id, an empty doc_type, and a doc_type change', async () => {
    await expect(save('Home Page', 'home', doc('A'), null)).rejects.toThrow(/doc_id/);
    await expect(save('home', '', doc('A'), null)).rejects.toThrow(/doc_type/);
    const t = await save('home', 'home', doc('A'), null);
    await expect(save('home', 'about', doc('A'), t)).rejects.toThrow(/doc_type/);
  });

  it('cms_discard deletes the draft', async () => {
    await save('home', 'home', doc('A'), null);
    await save('about', 'about', doc('A'), null);
    await discard('home');
    expect(await get('home')).toBeNull();
    expect((await list()).map((r) => r.doc_id)).toEqual(['about']);
  });

  it('cms_list: published is false before any publish, true after, false again after an edit', async () => {
    const ta = await save('about', 'about', doc('A'), null);
    await save('home', 'home', doc('H'), null);
    expect((await list()).map((r) => [r.doc_id, r.doc_type, r.published])).toEqual([
      ['about', 'about', false],
      ['home', 'home', false],
    ]);

    await publishOk();
    expect((await list()).every((r) => r.published)).toBe(true);

    await save('about', 'about', doc('A2'), ta);
    expect((await list()).map((r) => [r.doc_id, r.published])).toEqual([
      ['about', false],
      ['home', true],
    ]);

    await publishOk('noop');
    expect((await list()).every((r) => r.published)).toBe(true);
  });

  it('cms_list: an error run does not publish, and an edit during a run stays unpublished', async () => {
    await save('home', 'home', doc('H'), null);
    const id = (await db.query<{ id: string }>(`select public.begin_publish() as id`)).rows[0].id;
    await asService(() => db.query(`select public.end_publish($1, 'error', null, null, 'boom')`, [id]));
    expect((await list())[0].published).toBe(false);

    const id2 = (await db.query<{ id: string }>(`select public.begin_publish() as id`)).rows[0].id;
    const t = (await get('home'))!.updated_at;
    await save('home', 'home', doc('H2'), t); // edited after the run read its input
    await asService(() => db.query(`select public.end_publish($1, 'ok', null, 0, null)`, [id2]));
    expect((await list())[0].published).toBe(false);
  });

  it('unpublished_summary lists changed docs with the same since logic', async () => {
    await save('home', 'home', doc('H'), null);
    const ta = await save('about', 'about', doc('A'), null);
    let s = await summary();
    expect(s.since).toBeNull();
    expect(s.changed_docs).toEqual(['about', 'home']);
    expect(Array.isArray(s.changed_years)).toBe(true);

    await publishOk();
    s = await summary();
    expect(s.changed_docs).toEqual([]);
    expect(s.changed_years).toEqual([]);

    await save('about', 'about', doc('A2'), ta);
    s = await summary();
    expect(s.changed_docs).toEqual(['about']);
    expect(Object.keys(s).sort()).toEqual(['changed_docs', 'changed_years', 'since']);
  });

  it('publish_input includes the documents as [{doc_id, doc_type, data}]', async () => {
    const read = () =>
      asService(async () => (await db.query<{ i: Record<string, unknown> }>(`select public.publish_input() as i`)).rows[0].i);
    expect((await read()).cms_documents).toEqual([]);

    await save('home', 'home', doc('H'), null);
    await save('about', 'about', doc('A'), null);
    const input = await read();
    expect(Object.keys(input).sort()).toEqual(['cms_documents', 'contests', 'countries', 'entries', 'generated_at']);
    expect(input.cms_documents).toEqual([
      { doc_id: 'about', doc_type: 'about', data: doc('A') },
      { doc_id: 'home', doc_type: 'home', data: doc('H') },
    ]);
  });

  it('I3: publish_input ships only drafts saved after the last CMS publish; an old published draft is left out', async () => {
    // "home" was published long ago and its schema has since changed: it would no longer validate.
    await save('home', 'home', { en: { stale: true }, el: { stale: true } }, null);
    await publishOk();
    expect(await inputDocs()).toEqual([]);
    // A new, unpublished draft is shipped; the old published one is neither validated nor re-written.
    const ta = await save('about', 'about', doc('A'), null);
    expect(await inputDocs()).toEqual(['about']);
    await publishOk('noop');
    expect(await inputDocs()).toEqual([]);
    await save('about', 'about', doc('A2'), ta);
    expect(await inputDocs()).toEqual(['about']);
  });

  it('I3: a contests-only publish (begin_publish(false)) does not count as publishing the drafts', async () => {
    await save('about', 'about', doc('A'), null);
    await publishOk();
    const t = (await get('about'))!.updated_at;
    await save('about', 'about', doc('A2'), t);
    await publishContestsOnly();
    // Still unpublished everywhere: the list badge, the summary, and the next Publish ships it.
    expect((await list()).map((r) => [r.doc_id, r.published])).toEqual([['about', false]]);
    const s = await summary();
    expect(s.changed_docs).toEqual(['about']);
    expect(s.changed_years).toEqual([]);
    expect(await inputDocs()).toEqual(['about']);
    await publishOk();
    expect(await inputDocs()).toEqual([]);
    expect((await list())[0].published).toBe(true);
  });

  it('I3: before any CMS publish, every draft ships (a contests-only run does not change that)', async () => {
    await save('about', 'about', doc('A'), null);
    await publishContestsOnly();
    expect(await inputDocs()).toEqual(['about']);
    expect((await summary()).changed_docs).toEqual(['about']);
    expect((await list())[0].published).toBe(false);
  });

  it('non-admins are forbidden from every cms RPC', async () => {
    await save('home', 'home', doc('H'), null);
    await asUser(db, STRANGER);
    await expect(save('x', 'x', doc('X'), null)).rejects.toThrow(/forbidden/);
    await expect(get('home')).rejects.toThrow(/forbidden/);
    await expect(list()).rejects.toThrow(/forbidden/);
    await expect(discard('home')).rejects.toThrow(/forbidden/);
    await asUser(db, ADMIN);
    expect(await get('home')).not.toBeNull();
  });

  it('grants: anon cannot execute the cms RPCs; nobody but the owner touches the table directly', async () => {
    await save('home', 'home', doc('H'), null);
    await db.exec(`set role anon`);
    try {
      await expect(db.query(`select public.cms_list()`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`select public.cms_get('home')`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`select public.cms_save('x', 'x', '{"en":{},"el":{}}', null)`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`select public.cms_discard('home')`)).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec(`reset role`);
    }
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      try {
        const r = await db.query(`select * from public.cms_documents`).catch((e: Error) => e);
        // Either no privilege at all, or RLS with no policies hides every row.
        if (r instanceof Error) expect(r.message).toMatch(/permission denied/);
        else expect(r.rows).toEqual([]);
        await expect(
          db.query(`insert into public.cms_documents (doc_id, doc_type, data) values ('x', 'x', '{}')`),
        ).rejects.toThrow(/permission denied|row-level security/);
      } finally {
        await db.exec(`reset role`);
      }
    }
    const rls = await db.query<{ r: boolean }>(`select relrowsecurity as r from pg_class where oid = 'public.cms_documents'::regclass`);
    expect(rls.rows[0].r).toBe(true);
  });
});
