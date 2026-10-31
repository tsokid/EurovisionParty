// @vitest-environment node
// I6: a templated field may use any placeholder its schema allows, so the page
// must supply every one of them. For each templated page, render (SSR, through
// render()) a doc in which every templated field uses all of its allowed
// placeholders: interpolate() throws on a missing value, so the render must not
// throw, and no placeholder may reach the output unfilled.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CMS_DOC_TYPES } from '../../supabase/functions/_shared/cms/registry';
import { fieldPaths } from '../../supabase/functions/_shared/cms/fields';
import { mapStrings } from '../../supabase/functions/_shared/cms/walk';
import { PAGE_REGISTRY } from '../../src/lib/seo/registry';
import { localizePath, type Locale } from '../../src/lib/seo/locale';
import { headTagsHtml } from '../../src/lib/seo/headTags';

/** content path → replacement document (the eager snapshot is otherwise used as is). */
const overrides = new Map<string, unknown>();

vi.mock('../../src/lib/seo/contentData', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/lib/seo/contentData')>();
  return { ...real, bundledContent: (path: string) => (overrides.has(path) ? overrides.get(path) : real.bundledContent(path)) };
});

afterEach(() => overrides.clear());

const templated = Object.entries(CMS_DOC_TYPES)
  .filter(([id, def]) => !id.startsWith('__') && fieldPaths(def.schema, (m) => (m.placeholders ?? []).length > 0).length > 0)
  .map(([id]) => id);

/** Every templated string field gets all of its allowed placeholders appended. */
function saturate(docId: string, doc: Record<Locale, unknown>): Record<Locale, unknown> {
  const { schema } = CMS_DOC_TYPES[docId];
  const fill = (v: unknown) =>
    mapStrings(schema, v, (s, meta) => (meta.placeholders?.length ? `${s} ${meta.placeholders.map((p) => `{${p}}`).join(' ')}` : s));
  return { en: fill(doc.en), el: fill(doc.el) };
}

describe('every templated page supplies every placeholder its schema allows', () => {
  it('covers the templated pages', () => {
    expect(templated.sort()).toEqual(
      ['eurovision-games', 'eurovision-night', 'eurovision-party', 'eurovision-predictions', 'home', 'rules', 'winners'],
    );
  });

  const cases = templated.flatMap((id) => {
    const page = PAGE_REGISTRY.find((p) => p.id === id);
    if (!page) throw new Error(`no registry page for ${id}`);
    return (['en', 'el'] as Locale[])
      .filter((l) => !(l === 'en' && page.greekExclusive) && !(l === 'el' && page.englishExclusive))
      .map((l) => [id, localizePath(l, page.slugByLocale[l])] as const);
  });

  it.each(cases)('%s (%s)', async (docId, url) => {
    const { bundledContent } = await import('../../src/lib/seo/contentData');
    const path = `pages/${docId}.json`;
    const doc = saturate(docId, bundledContent(path) as Record<Locale, unknown>);
    overrides.set(path, doc);
    const { render } = await import('../../src/entry-server');
    const r = await render(url);
    expect(r.status).toBe(200);
    const out = r.html + (r.head ? headTagsHtml(r.head) : '');
    // The page read the saturated doc (the collector records what it read).
    expect(r.content[path], url).toEqual({ [r.lang]: doc[r.lang] });
    const leftover = out.match(/\{[a-zA-Z][a-zA-Z0-9]*\}/g) ?? [];
    expect(leftover, url).toEqual([]);
  }, 60_000);
});
