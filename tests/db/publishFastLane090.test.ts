// @vitest-environment node
// 090: a contests-only publish (the lifecycle and parser auto-publish) never
// waits behind a building content deploy; content publishes still do.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, createDb, makeAdmin } from './harness';

const ADMIN = '00000000-0000-4000-8000-000000000090';
const doc = (s: string) => ({ en: { t: s }, el: { t: `${s}-el` } });
const tick = () => new Promise((r) => setTimeout(r, 5));

describe('090 publish fast lane', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
    await makeAdmin(db, ADMIN, 'admin090@example.test');
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

  const save = async (id: string, data: unknown) => {
    await tick();
    await db.query(`select public.cms_save($1, $2, $3, null)`, [id, id, data]);
  };
  const begin = async (cms: boolean, docIds: string[] | null = null) =>
    Number((await db.query<{ id: string }>(`select public.begin_publish($1, $2, 'main', null) as id`, [cms, docIds])).rows[0].id);
  const end = (id: number, status: string, sha: string | null) =>
    asService(() => db.query(`select public.end_publish($1, $2, $3, 1, null, null)`, [id, status, sha]));
  const deployState = async (id: number) =>
    (await db.query<{ s: string | null }>(`select deploy_state as s from public.publish_runs where id = $1`, [id])).rows[0].s;

  it('a contests-only run starts while a page deploy is building', async () => {
    await save('faq', doc('F'));
    const page = await begin(true, ['faq']);
    await end(page, 'ok', 'page1');
    expect(await deployState(page)).toBe('building');

    const contests = await begin(false);
    expect(contests).toBeGreaterThan(page);
    await end(contests, 'ok', 'contests1');
    expect(await deployState(contests)).toBe('building');
  });

  it('content runs still wait behind any building main deploy, a contests one included', async () => {
    await save('faq', doc('F'));
    const page = await begin(true, ['faq']);
    await end(page, 'ok', 'page1');
    await expect(begin(true, ['about'])).rejects.toThrow(/previous deploy is still building/);
    await expect(begin(true, null)).rejects.toThrow(/previous deploy is still building/);

    await db.exec(`reset role`);
    await asUser(db, null);
    await db.exec(`delete from public.publish_runs where true`);
    await asUser(db, ADMIN);
    const contests = await begin(false);
    await end(contests, 'ok', 'contests1');
    await expect(begin(true, ['faq'])).rejects.toThrow(/previous deploy is still building/);
  });

  it('runs stay serialized: a contests run is refused only while another run is in flight (seconds)', async () => {
    const page = await begin(true, null);
    await expect(begin(false)).rejects.toThrow(/^.*publish already running$/);
    await end(page, 'noop', null);
    const contests = await begin(false);
    expect(contests).toBeGreaterThan(page);
  });
});
