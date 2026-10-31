// @vitest-environment node
// Every static page that reads a CMS document must inline it in its
// prerendered HTML (#__content__), so the client hydrates from the seed and
// never fetches or flashes. Runs against the last `npm run build`; skipped when
// dist/ is missing.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CMS_DOC_TYPES } from '../../supabase/functions/_shared/cms/registry';
import { PAGE_REGISTRY } from '../../src/lib/seo/registry';
import { localizePath, type Locale } from '../../src/lib/seo/locale';
import { outputPath } from '../../scripts/prerender/injectPage';

const ROOT = resolve(__dirname, '../..');
const DIST = resolve(ROOT, 'dist');
const built = existsSync(resolve(DIST, 'assets'));

if (!built) console.warn('inlinesOwnDoc.test: dist/ not found — run `npm run build` first; skipping.');

/** Static registry pages migrated to content/pages (their pageId is a registered doc type). */
const migrated = PAGE_REGISTRY.filter((p) => Object.prototype.hasOwnProperty.call(CMS_DOC_TYPES, p.id));

const cases = migrated.flatMap((p) =>
  (['en', 'el'] as Locale[])
    .filter((l) => !(l === 'en' && p.greekExclusive) && !(l === 'el' && p.englishExclusive))
    .map((l) => [p.id, l, outputPath(localizePath(l, p.slugByLocale[l]))] as const),
);

function inlined(html: string): Record<string, unknown> {
  const m = /<script type="application\/json" id="__content__">([\s\S]*?)<\/script>/.exec(html);
  return m ? (JSON.parse(m[1]) as Record<string, unknown>) : {};
}

describe.skipIf(!built)('prerendered pages inline their own CMS doc', () => {
  it('covers the Task 4, 5 and 6 pages at least', () => {
    expect(migrated.map((p) => p.id)).toEqual(
      expect.arrayContaining([
        'about', 'privacy', 'terms', 'cookies', 'dashboard', 'scoring', 'rules', 'faq',
        'how-to-play', 'eurovision-night', 'eurovision-games', 'eurovision-party', 'eurovision-trivia', 'eurovision-duels',
        'home', 'eurovision-predictions', 'winners',
      ]),
    );
  });

  // The 404 page is not a registry page: its doc is not-found.
  it('404 → dist/404.html inlines pages/not-found.json', () => {
    const content = inlined(readFileSync(resolve(DIST, '404.html'), 'utf8'));
    expect(content['pages/not-found.json']).toEqual(JSON.parse(readFileSync(resolve(ROOT, 'content/pages/not-found.json'), 'utf8')));
  });

  it.each(cases)('%s (%s) → dist/%s', (docId, _locale, file) => {
    const content = inlined(readFileSync(resolve(DIST, file), 'utf8'));
    const key = `pages/${docId}.json`;
    expect(Object.keys(content)).toContain(key);
    expect(content[key]).toEqual(JSON.parse(readFileSync(resolve(ROOT, 'content', key), 'utf8')));
  });
});
