// @vitest-environment node
// 088: cms_media.alt {en, el} and title, media_set_meta, media_list with
// both, media_usage, and publish_input's media rows carrying alt.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { applyMigration, asUser, createDb, makeAdmin } from './harness';

const ADMIN = '00000000-0000-4000-8000-000000000088';
const STRANGER = '00000000-0000-4000-8000-0000000088ff';
const SHA = 'b'.repeat(64);

describe('088 cms_media_alt', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
    await makeAdmin(db, ADMIN, 'admin088@example.test');
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  beforeEach(async () => {
    await db.exec(`reset role`);
    await asUser(db, null);
    await db.exec(`delete from public.cms_media where true; delete from public.cms_documents where true; delete from public.publish_runs where true`);
    await asUser(db, ADMIN);
  });

  const image = async () => {
    const id = crypto.randomUUID();
    await db.query(`select public.media_register($1::uuid, 'image', $2, 'image/webp', 1000, 1600, 900, $3, null)`, [id, `${id}.webp`, SHA]);
    return id;
  };
  const variantOf = async (parent: string) =>
    (await db.query<{ id: string }>(`select public.media_register(null, 'image', $1, 'image/webp', 500, 800, 450, $2, $3::uuid) as id`, [`${parent}-800.webp`, SHA, parent])).rows[0].id;
  const setMeta = (id: string, alt: unknown, title: string | null = null) =>
    db.query<{ r: Record<string, unknown> }>(`select public.media_set_meta($1::uuid, $2::jsonb, $3) as r`, [id, JSON.stringify(alt), title]);
  const listed = async (id: string) =>
    (await db.query<{ alt: unknown; title: string | null }>(`select alt, title from public.media_list(null) where id = $1::uuid`, [id])).rows[0];

  it('a new row has no alt and no title; media_set_meta stores both, trimmed, blanks dropped', async () => {
    const id = await image();
    expect(await listed(id)).toEqual({ alt: {}, title: null });
    const r = (await setMeta(id, { en: '  Stage at night ', el: '' }, ' Σκηνή ')).rows[0].r;
    expect(r).toMatchObject({ id, alt: { en: 'Stage at night' }, title: 'Σκηνή' });
    expect(await listed(id)).toEqual({ alt: { en: 'Stage at night' }, title: 'Σκηνή' });
    await setMeta(id, { en: 'Stage', el: 'Σκηνή' });
    expect(await listed(id)).toEqual({ alt: { en: 'Stage', el: 'Σκηνή' }, title: null });
  });

  it('refuses bad input, a variant, a missing row and a non-admin', async () => {
    const id = await image();
    await expect(setMeta(id, { de: 'x' })).rejects.toThrow(/unknown language de/);
    await expect(setMeta(id, { en: 3 })).rejects.toThrow(/alt.en must be text/);
    await expect(setMeta(id, ['x'])).rejects.toThrow(/alt must be an object/);
    await expect(setMeta(id, { en: 'x'.repeat(301) })).rejects.toThrow(/longer than 300/);
    await expect(setMeta(id, {}, 'y'.repeat(121))).rejects.toThrow(/title is longer than 120/);
    await expect(setMeta(await variantOf(id), { en: 'x' })).rejects.toThrow(/not its 800 w variant/);
    await expect(setMeta(crypto.randomUUID(), { en: 'x' })).rejects.toThrow(/not found/);
    await asUser(db, STRANGER);
    await expect(setMeta(id, { en: 'x' })).rejects.toThrow(/forbidden/);
  });

  it('the table stays closed to direct writes: alt changes only through media_set_meta', async () => {
    const id = await image();
    await db.exec(`set role authenticated`);
    await expect(db.query(`update public.cms_media set alt = '{"en":"x"}' where id = $1::uuid`, [id])).rejects.toThrow(/permission denied/);
    await db.exec(`reset role`);
  });

  it('media_usage lists the drafts that reference the file or its 800 w variant', async () => {
    const id = await image();
    const v = await variantOf(id);
    await db.query(`select public.cms_save('faq', 'faq', $1, null)`, [{ en: { m: `cms-media/${id}` }, el: { m: `cms-media/${id}` } }]);
    await db.query(`select public.cms_save('about', 'about', $1, null)`, [{ en: { m: `cms-media/${v}` }, el: {} }]);
    await db.query(`select public.cms_save('rules', 'rules', $1, null)`, [{ en: { m: 'none' }, el: {} }]);
    const usage = (await db.query<{ u: string[] }>(`select public.media_usage($1::uuid) as u`, [id])).rows[0].u;
    expect(usage).toEqual(['about', 'faq']);
  });

  it('publish_input returns each referenced row with its alt', async () => {
    const id = await image();
    await setMeta(id, { en: 'Stage', el: 'Σκηνή' });
    await db.query(`select public.cms_save('faq', 'faq', $1, null)`, [{ en: { m: `cms-media/${id}` }, el: { m: `cms-media/${id}` } }]);
    await db.exec(`set role service_role`);
    const input = (await db.query<{ i: { media: Array<Record<string, unknown>> } }>(`select public.publish_input(null, false) as i`)).rows[0].i;
    await db.exec(`reset role`);
    expect(input.media).toHaveLength(1);
    expect(input.media[0]).toMatchObject({ id, alt: { en: 'Stage', el: 'Σκηνή' } });
  });

  it('is idempotent', async () => {
    const id = await image();
    await setMeta(id, { en: 'kept' });
    await applyMigration(db, '088');
    expect(await listed(id)).toEqual({ alt: { en: 'kept' }, title: null });
  });
});
