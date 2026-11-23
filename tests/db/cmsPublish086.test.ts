// @vitest-environment node
// 086: per-document publish, the site-wide preview → promote path, the
// deploy state and the auto-revert's database side (spec §6, §7, §9).
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { applyMigration, asUser, createDb, makeAdmin } from './harness';

const ADMIN = '00000000-0000-4000-8000-000000000086';
const STRANGER = '00000000-0000-4000-8000-0000000086ff';
const doc = (s: string) => ({ en: { t: s }, el: { t: `${s}-el` } });
const tick = () => new Promise((r) => setTimeout(r, 5));

type Row = Record<string, unknown>;

describe('086 cms_publish_per_doc', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
    await makeAdmin(db, ADMIN, 'admin086@example.test');
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  beforeEach(async () => {
    await db.exec(`reset role`);
    await asUser(db, null);
    await db.exec(`delete from public.publish_runs where true; delete from public.cms_documents where true; delete from public.cms_revisions where true`);
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

  const save = async (id: string, data: unknown, expected: string | null = null) => {
    await tick();
    return (await db.query<{ t: string }>(`select public.cms_save($1, $2, $3, $4)::text as t`, [id, id, data, expected])).rows[0].t;
  };
  const begin = async (docIds: string[] | null = null, target = 'main', promote: number | null = null) =>
    Number((await db.query<{ id: string }>(`select public.begin_publish(true, $1, $2, $3) as id`, [docIds, target, promote])).rows[0].id);
  const input = (docIds: string[] | null = null, skip = false) =>
    asService(async () => (await db.query<{ i: { cms_documents: Array<{ doc_id: string; updated_at: string; data: unknown }> } }>(
      `select public.publish_input($1, $2) as i`, [docIds, skip])).rows[0].i);
  const end = (id: number, status: string, sha: string | null, shipped: unknown = null) =>
    asService(() => db.query(`select public.end_publish($1, $2, $3, 1, null, $4)`, [id, status, sha, shipped === null ? null : JSON.stringify(shipped)]));
  const deploy = (id: number, state: string, url: string | null = null, sha: string | null = null, note: string | null = null) =>
    asService(async () => (await db.query<{ r: Row }>(`select public.set_deploy_state($1, $2, $3, $4, $5) as r`, [id, state, url, sha, note])).rows[0].r);
  const list = async () => (await db.query<{ doc_id: string; published: boolean }>(`select doc_id, published from public.cms_list()`)).rows;
  const changed = async () => (await db.query<{ s: { changed_docs: string[] } }>(`select public.unpublished_summary() as s`)).rows[0].s.changed_docs;
  const run = async (id: number) => (await db.query<Row>(`select * from public.publish_runs where id = $1`, [id])).rows[0];
  const shippedOf = async (ids: string[] | null) =>
    (await input(ids)).cms_documents.map((d) => ({ doc_id: d.doc_id, updated_at: d.updated_at, data: d.data }));

  it('publishing one doc ships and stamps only that doc', async () => {
    await save('faq', doc('F'));
    await save('about', doc('A'));
    expect((await input()).cms_documents.map((d) => d.doc_id)).toEqual(['about', 'faq']);
    const id = await begin(['faq']);
    const ship = await shippedOf(['faq']);
    expect(ship.map((d) => d.doc_id)).toEqual(['faq']);
    await end(id, 'ok', 'c0ffee', ship);

    expect(await list()).toEqual([{ doc_id: 'about', published: false }, { doc_id: 'faq', published: true }]);
    expect(await changed()).toEqual(['about']);
    expect((await input()).cms_documents.map((d) => d.doc_id)).toEqual(['about']);
    const r = await run(id);
    expect(r).toMatchObject({ doc_ids: ['faq'], target: 'main', deploy_state: 'building', commit_sha: 'c0ffee' });
    expect((r.shipped as Row[]).map((s) => [s.doc_id, s.prev])).toEqual([['faq', null]]);
    const revs = (await db.query<Row>(`select doc_id, kind, run_id, commit_sha, data from public.cms_revisions where kind = 'published'`)).rows;
    expect(revs).toEqual([{ doc_id: 'faq', kind: 'published', run_id: id, commit_sha: 'c0ffee', data: doc('F') }]);
  });

  it('a per-doc run does not stamp contests.published_at; a full run does', async () => {
    await asUser(db, null);
    await db.exec(`update public.contests set published_at = null`);
    await asUser(db, ADMIN);
    await save('faq', doc('F'));
    const id = await begin(['faq']);
    await end(id, 'ok', null, await shippedOf(['faq']));
    expect((await db.query(`select 1 from public.contests where published_at is not null`)).rows).toHaveLength(0);
    const id2 = await begin();
    await end(id2, 'noop', null);
    expect((await db.query(`select 1 from public.contests where published_at is null`)).rows).toHaveLength(0);
  });

  it('end_publish stamps the version shipped: an edit saved during the run stays unpublished', async () => {
    const t1 = await save('faq', doc('F1'));
    const id = await begin(['faq']);
    const ship = await shippedOf(['faq']);
    await save('faq', doc('F2'), t1); // after publish_input read the draft
    await end(id, 'ok', 'abc', ship);
    expect(await list()).toEqual([{ doc_id: 'faq', published: false }]);
    const rev = (await db.query<{ data: unknown }>(`select data from public.cms_revisions where kind = 'published'`)).rows;
    expect(rev).toEqual([{ data: doc('F1') }]);
  });

  it('without p_shipped (old callers) the run stamps its own docs saved before it started', async () => {
    await save('faq', doc('F'));
    await save('about', doc('A'));
    const id = await begin(['about']);
    await end(id, 'ok', null);
    expect(await list()).toEqual([{ doc_id: 'about', published: true }, { doc_id: 'faq', published: false }]);
  });

  it('skip_site_wide leaves the header, footer and settings out of a direct "publish all"', async () => {
    await save('faq', doc('F'));
    await save('site-header', doc('H'));
    expect((await input(null, true)).cms_documents.map((d) => d.doc_id)).toEqual(['faq']);
    expect((await input(null, false)).cms_documents.map((d) => d.doc_id)).toEqual(['faq', 'site-header']);
  });

  it('only site-wide docs may be previewed; named site-wide docs may also go straight to main (092)', async () => {
    const direct = await begin(['site-footer']);
    expect(direct).toBeGreaterThan(0);
    await end(direct, 'ok', null);
    await expect(begin(['faq'], 'preview')).rejects.toThrow(/only the site-wide documents/);
    await expect(begin(null, 'preview')).rejects.toThrow(/needs the documents/);
    await expect(begin([], 'main')).rejects.toThrow(/no documents/);
    await expect(begin(['faq'], 'staging')).rejects.toThrow(/invalid target/);
  });

  it('preview → ready → promote: nothing is live until the promote, which works once', async () => {
    await save('site-header', doc('H'));
    const pid = await begin(['site-header'], 'preview');
    const ship = await shippedOf(['site-header']);
    await end(pid, 'ok', 'p1', ship);
    expect(await list()).toEqual([{ doc_id: 'site-header', published: false }]);
    expect((await run(pid)).deploy_state).toBe('building');
    expect((await db.query(`select 1 from public.cms_revisions where kind = 'published'`)).rows).toHaveLength(0);

    await expect(begin(null, 'main', pid)).rejects.toThrow(/not ready/);
    await deploy(pid, 'ready', 'https://eurovision-git-content-preview.vercel.app');
    expect((await run(pid)).deploy_url).toBe('https://eurovision-git-content-preview.vercel.app');

    const mid = await begin(null, 'main', pid);
    expect(await run(mid)).toMatchObject({ target: 'main', doc_ids: ['site-header'], promoted_from: pid });
    await end(mid, 'ok', 'm1', ship);
    expect(await list()).toEqual([{ doc_id: 'site-header', published: true }]);
    await deploy(mid, 'ready');
    await expect(begin(null, 'main', pid)).rejects.toThrow(/already live/);
    await expect(begin(null, 'main', mid)).rejects.toThrow(/nothing to promote/);
  });

  it('a main run waits while the previous main deploy builds (15 minutes at most); a preview does not', async () => {
    await save('faq', doc('F'));
    await save('site-footer', doc('S'));
    const id = await begin(['faq']);
    await end(id, 'ok', 'b1', await shippedOf(['faq']));
    await expect(begin(['about'])).rejects.toThrow(/previous deploy is still building/);
    const pid = await begin(['site-footer'], 'preview');
    await end(pid, 'error', null);
    await db.query(`update public.publish_runs set finished_at = now() - interval '16 minutes' where id = $1`, [id]);
    const id2 = await begin(['about']);
    expect(id2).toBeGreaterThan(id);
  });

  it('a revert puts the previous stamps back; a later publish of the doc is left alone; reverted is final', async () => {
    const t1 = await save('faq', doc('F1'));
    const id1 = await begin(['faq']);
    await end(id1, 'ok', 's1', await shippedOf(['faq']));
    await deploy(id1, 'ready');
    const firstStamp = (await db.query<{ p: string }>(`select published_updated_at::text as p from public.cms_documents where doc_id = 'faq'`)).rows[0].p;

    await save('faq', doc('F2'), t1);
    await save('about', doc('A'));
    const id2 = await begin(['faq', 'about']);
    await end(id2, 'ok', 's2', await shippedOf(['faq', 'about']));
    expect(await changed()).toEqual([]);

    const r = await deploy(id2, 'reverted', null, 'r2', null);
    expect(r).toMatchObject({ deploy_state: 'reverted', reverted_sha: 'r2' });
    expect(r).not.toHaveProperty('shipped');
    expect(await changed()).toEqual(['about', 'faq']);
    expect((await db.query<{ p: string }>(`select published_updated_at::text as p from public.cms_documents where doc_id = 'faq'`)).rows[0].p).toBe(firstStamp);
    expect((await deploy(id2, 'ready')).deploy_state).toBe('reverted');
  });

  it('revert_blocked keeps the stamps and records the note', async () => {
    await save('faq', doc('F'));
    const id = await begin(['faq']);
    await end(id, 'ok', 's1', await shippedOf(['faq']));
    const r = await deploy(id, 'revert_blocked', null, null, 'main moved to abc1234');
    expect(r).toMatchObject({ deploy_state: 'revert_blocked', deploy_note: 'main moved to abc1234' });
    expect(await changed()).toEqual([]);
  });

  it('set_deploy_state refuses an unknown state, a revert without its commit and a run with no commit', async () => {
    const id = await begin(['faq']);
    await end(id, 'noop', null);
    await expect(deploy(id, 'ready')).rejects.toThrow(/has no commit/);
    await save('faq', doc('F'));
    const id2 = await begin(['faq']);
    await end(id2, 'ok', 'x', await shippedOf(['faq']));
    await expect(deploy(id2, 'done')).rejects.toThrow(/invalid deploy state/);
    await expect(deploy(id2, 'reverted')).rejects.toThrow(/needs its commit/);
  });

  it('last_publish_run carries the deploy columns', async () => {
    await save('faq', doc('F'));
    const id = await begin(['faq']);
    await end(id, 'ok', 'abc', await shippedOf(['faq']));
    await deploy(id, 'ready', 'https://eurovision.games');
    const last = (await db.query<{ r: Row }>(`select public.last_publish_run() as r`)).rows[0].r;
    expect(last).toMatchObject({ id, doc_ids: ['faq'], target: 'main', deploy_state: 'ready', deploy_url: 'https://eurovision.games', reverted_sha: null });
  });

  it('access: set_deploy_state and end_publish are service-role only; begin_publish is for super admins; one signature each', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      try {
        await expect(db.query(`select public.set_deploy_state(1, 'ready')`), role).rejects.toThrow(/permission denied/);
        await expect(db.query(`select public.end_publish(1, 'ok', null, 0, null, null)`), role).rejects.toThrow(/permission denied/);
        await expect(db.query(`select public.publish_input(null, false)`), role).rejects.toThrow(/permission denied/);
      } finally {
        await db.exec(`reset role`);
      }
    }
    await asUser(db, STRANGER);
    await expect(begin(['faq'])).rejects.toThrow(/forbidden/);
    await asUser(db, ADMIN);
    const fns = (await db.query<{ proname: string; args: string }>(
      `select proname, pg_get_function_identity_arguments(p.oid) as args from pg_proc p
        where p.pronamespace = 'public'::regnamespace and proname in ('begin_publish', 'end_publish', 'publish_input', 'set_deploy_state')
        order by proname`,
    )).rows;
    expect(fns).toEqual([
      { proname: 'begin_publish', args: 'p_cms boolean, p_doc_ids text[], p_target text, p_promote bigint' },
      { proname: 'end_publish', args: 'p_id bigint, p_status text, p_sha text, p_files integer, p_error text, p_shipped jsonb' },
      { proname: 'publish_input', args: 'p_doc_ids text[], p_skip_site_wide boolean' },
      { proname: 'set_deploy_state', args: 'p_run_id bigint, p_state text, p_url text, p_reverted_sha text, p_note text' },
    ]);
  });

  it("P3's interim trigger is gone", async () => {
    const r = await db.query(`select 1 from pg_trigger where tgname = 'cms_revisions_on_publish'`);
    expect(r.rows).toHaveLength(0);
    const f = await db.query(`select 1 from pg_proc where proname = 'cms_revisions_on_publish'`);
    expect(f.rows).toHaveLength(0);
  });
});

describe('086 backfills the per-doc stamp once, from the old global rule', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb({ upTo: '085' });
    await db.exec(`
      insert into public.cms_documents (doc_id, doc_type, data, updated_at) values
        ('faq', 'faq', '{"en":{},"el":{}}', now() - interval '2 hours'),
        ('about', 'about', '{"en":{},"el":{}}', now() - interval '10 minutes');
      insert into public.publish_runs (started_at, finished_at, status, cms) values
        (now() - interval '1 hour', now() - interval '1 hour', 'ok', true),
        (now() - interval '5 minutes', now() - interval '5 minutes', 'ok', false);
    `);
    await applyMigration(db, '086');
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  const stamps = async () =>
    (await db.query<{ doc_id: string; stamped: boolean }>(
      `select doc_id, published_updated_at is not null and published_updated_at = updated_at as stamped from public.cms_documents order by doc_id`,
    )).rows;

  it('drafts saved before the last CMS run are published; later ones (and a contests-only run) are not', async () => {
    expect(await stamps()).toEqual([{ doc_id: 'about', stamped: false }, { doc_id: 'faq', stamped: true }]);
  });

  it('a second run of 086 does not backfill again', async () => {
    await db.exec(`insert into public.publish_runs (started_at, finished_at, status, cms, doc_ids) values (now(), now(), 'ok', true, '{faq}')`);
    await applyMigration(db, '086');
    expect(await stamps()).toEqual([{ doc_id: 'about', stamped: false }, { doc_id: 'faq', stamped: true }]);
  });
});
