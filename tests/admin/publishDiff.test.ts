// @vitest-environment node
// The publish diff's pure parts (CMS P5): the changed fields as preview
// targets, the word diff, and the SEO delta, which must agree with what the
// build's SEO guard will allow (scripts/seo/intent.ts on the intent that
// publish-content writes for the same change).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { changedTargets, fieldChanges, seoDelta, wordDiff } from '../../src/admin/publish/diff';
import { buildIntentEntry } from '../../supabase/functions/_shared/cms/seoIntent';
import { intentContext, intentPolicy } from '../../scripts/seo/intent';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = { en: any; el: any };
const doc = (id: string) => JSON.parse(readFileSync(resolve(process.cwd(), `content/pages/${id}.json`), 'utf8')) as Doc;

describe('changedTargets', () => {
  it('turns the changed fields of one locale into data-cms-path values', () => {
    const live = doc('faq');
    const draft = doc('faq');
    draft.en.hero.title = 'New title';
    draft.el.hero.lede = 'Νέο κείμενο';
    const changes = fieldChanges(live, draft);
    expect(changedTargets('faq', 'en', changes)).toEqual(['faq:en:hero.title']);
    expect(changedTargets('faq', 'el', changes)).toEqual(['faq:el:hero.lede']);
  });

  it('a list that changed length is one target (its nodes and their children are tinted)', () => {
    const live = { en: { items: [{ q: 'a' }, { q: 'b' }] }, el: {} };
    const draft = { en: { items: [{ q: 'a' }] }, el: {} };
    expect(changedTargets('faq', 'en', fieldChanges(live, draft))).toEqual(['faq:en:items']);
  });
});

describe('wordDiff', () => {
  it('marks the removed and added words and keeps the rest', () => {
    const parts = wordDiff('Play Eurovision with friends', 'Play the Eurovision game with friends');
    expect(parts.filter((p) => p.kind === 'del')).toEqual([]);
    expect(parts.filter((p) => p.kind === 'add').map((p) => p.text.trim())).toEqual(['the', 'game']);
    expect(parts.filter((p) => p.kind !== 'add').map((p) => p.text).join('')).toBe('Play Eurovision with friends');
    expect(parts.filter((p) => p.kind !== 'del').map((p) => p.text).join('')).toBe('Play the Eurovision game with friends');
  });

  it('handles empty sides', () => {
    expect(wordDiff('', 'new')).toEqual([{ text: 'new', kind: 'add' }]);
    expect(wordDiff('old', '')).toEqual([{ text: 'old', kind: 'del' }]);
  });
});

describe('seoDelta', () => {
  it('lists title and meta changes with before/after, and H1 / JSON-LD as possible', () => {
    const live = doc('faq');
    const draft = doc('faq');
    draft.en.meta.title = 'Eurovision Games FAQ: rooms, points and rules';
    draft.el.hero.title = 'Συχνές ερωτήσεις για το παιχνίδι';
    const rows = seoDelta('faq', live, draft);
    expect(rows.map((r) => [r.locale, r.field, r.route, r.definite])).toEqual([
      ['en', 'title', '/en/faq', true],
      ['en', 'jsonLd', '/en/faq', false],
      ['el', 'h1', '/el/faq', false],
      ['el', 'jsonLd', '/el/faq', false],
    ]);
    expect(rows[0]).toMatchObject({ before: live.en.meta.title, after: 'Eurovision Games FAQ: rooms, points and rules', allowed: true });
  });

  it('agrees with the build guard on every route and field it lists', () => {
    const live = doc('faq');
    const draft = doc('faq');
    draft.en.meta.title = 'Eurovision Games FAQ: rooms, points and rules';
    draft.en.meta.description = 'Every question about Eurovision Games rooms, points, prediction rules and the live show night, answered in one place.';
    draft.el.hero.title = 'Συχνές ερωτήσεις για το παιχνίδι';
    const rows = seoDelta('faq', live, draft);
    const entry = buildIntentEntry({ id: 'publish-1', createdAt: '2026-11-22T00:00:00Z', changedPaths: ['content/pages/faq.json'], drafts: { faq: draft }, committed: { faq: live } })!;
    const policy = intentPolicy([entry], intentContext(process.cwd()));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(policy.allows(r.route!, r.field), `${r.route} ${r.field}`).toBe(r.allowed);
    // And nothing the screen leaves out is allowed: robots, canonical and hreflang never come from a doc.
    for (const route of ['/en/faq', '/el/faq']) {
      for (const f of ['robots', 'canonical', 'hreflang'] as const) expect(policy.allows(route, f)).toBe(false);
    }
  });

  it('site-wide docs list nothing (the guard allows no SEO change for them anywhere)', () => {
    const live = doc('site-header');
    const draft = doc('site-header');
    draft.en.cta.createRoom = 'Create a room now';
    expect(seoDelta('site-header', live, draft)).toEqual([]);
    const entry = buildIntentEntry({ id: 'publish-2', createdAt: '2026-11-22T00:00:00Z', changedPaths: ['content/pages/site-header.json'], drafts: { 'site-header': draft }, committed: { 'site-header': live } })!;
    const policy = intentPolicy([entry], intentContext(process.cwd()));
    expect(policy.allowances.size).toBe(0);
  });

  it('no change, no rows', () => {
    expect(seoDelta('faq', doc('faq'), doc('faq'))).toEqual([]);
  });
});
