// @vitest-environment node
// P4 parity (spec §9 "Preview/prerender divergence"): one fixture rendered
// through the preview path (PreviewBody: the draft in PageContentOverride,
// preview mode on, cms markers on) and through the prerender path
// (entry-server render(), reading content/pages/{id}.json as the build does,
// with the same draft overlaid by overlayDrafts, the function publish-content
// uses for the pages after a publish). The HTML must be identical once the
// data-cms-path markers are removed.
import { describe, it, expect, afterEach } from 'vitest';
import { StrictMode, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { MotionConfig } from 'framer-motion';
import { render } from '../../src/entry-server';
import i18n from '../../src/i18n';
import { PreviewBody } from '../../src/admin/preview/PreviewDocument';
import { HeadProvider, createHeadCollector } from '../../src/lib/seo/HeadContext';
import ContentProvider from '../../src/lib/seo/ContentProvider';
import { createContentCollector } from '../../src/lib/seo/contentContext';
import { bundledContent } from '../../src/lib/seo/contentData';
import { PAGE_REGISTRY } from '../../src/lib/seo/registry';
import { localizePath, type Locale } from '../../src/lib/seo/locale';
import { overlayDrafts, type DraftDoc } from '../../supabase/functions/_shared/cms/overlay';

type Doc = { en: Record<string, unknown>; el: Record<string, unknown> };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const MARKER = /\sdata-cms-path="[^"]*"/g;
const strip = (html: string) => html.replace(MARKER, '');

/** Swaps content/pages/{docId}.json for the overlaid draft while `fn` runs (the snapshot object is shared). */
async function withCommitted<T>(drafts: DraftDoc[], fn: () => Promise<T>): Promise<T> {
  const saved = new Map<string, Doc>();
  const committed: Record<string, unknown> = {};
  for (const d of drafts) committed[d.doc_id] = bundledContent(`pages/${d.doc_id}.json`);
  const after = overlayDrafts(committed, drafts);
  for (const d of drafts) {
    const file = bundledContent(`pages/${d.doc_id}.json`) as Doc;
    saved.set(d.doc_id, { en: file.en, el: file.el });
    const next = after[d.doc_id] as Doc;
    file.en = next.en;
    file.el = next.el;
  }
  try {
    return await fn();
  } finally {
    for (const d of drafts) Object.assign(bundledContent(`pages/${d.doc_id}.json`) as Doc, saved.get(d.doc_id));
  }
}

/** The prerender's markup for a page (what scripts/prerender.ts writes inside <body>). */
async function prerendered(url: string): Promise<string> {
  const r = await render(url);
  expect(r.status, url).toBe(200);
  return r.html;
}

/** The preview's markup: the same providers entry-server puts around the router, then the preview. */
async function previewed(docId: string, doc: unknown, locale: Locale, drafts: DraftDoc[] = []): Promise<string> {
  await i18n.changeLanguage(locale);
  const wrap = (ui: ReactNode) => (
    <StrictMode>
      <MotionConfig reducedMotion="user">
        <HeadProvider collector={createHeadCollector()}>
          <ContentProvider collector={createContentCollector()}>{ui}</ContentProvider>
        </HeadProvider>
      </MotionConfig>
    </StrictMode>
  );
  return renderToString(wrap(<PreviewBody docId={docId} doc={doc} locale={locale} drafts={drafts} />));
}

const urlOf = (docId: string, locale: Locale) => {
  const page = PAGE_REGISTRY.find((p) => p.id === docId)!;
  return localizePath(locale, page.slugByLocale[locale]);
};

/** The rules page with edits in both locales: hero, a list item, a placeholder line and new blocks. */
function rulesFixture(): Doc {
  const doc = clone(bundledContent('pages/rules.json') as Doc);
  for (const l of ['en', 'el'] as const) {
    const c = doc[l] as Record<string, any>;
    c.hero.title = l === 'en' ? 'Rules — the parity fixture' : 'Κανόνες — το δοκιμαστικό';
    c.hero.lede = l === 'en' ? 'Edited lede for the parity test.' : 'Αλλαγμένο κείμενο για τον έλεγχο.';
    c.hostLimits.items[0].strong = l === 'en' ? 'Edited limit' : 'Αλλαγμένο όριο';
    c.extraBlocks = [
      { type: 'text', body: l === 'en' ? '## A new section\n\nWith **bold** text and a [link](/faq).' : '## Νέα ενότητα\n\nΜε **έντονα** και [σύνδεσμο](/faq).' },
      { type: 'faq', items: [{ q: l === 'en' ? 'A question?' : 'Μια ερώτηση;', a: l === 'en' ? 'An answer.' : 'Μια απάντηση.' }] },
      { type: 'callout', tone: 'warn', body: l === 'en' ? 'Mind the gap.' : 'Προσοχή στο κενό.' },
    ];
  }
  return doc;
}

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('preview ↔ prerender parity', () => {
  for (const locale of ['en', 'el'] as const) {
    it(`an edited rules draft renders the same HTML in both paths (${locale}), markers aside`, async () => {
      const draft = rulesFixture();
      const pre = await withCommitted([{ doc_id: 'rules', data: draft }], () => prerendered(urlOf('rules', locale)));
      const prev = await previewed('rules', draft, locale);
      expect(pre).toContain(locale === 'en' ? 'Edited lede for the parity test.' : 'Αλλαγμένο κείμενο για τον έλεγχο.');
      expect(prev).toMatch(MARKER);
      expect(pre).not.toMatch(MARKER);
      expect(strip(prev)).toBe(pre);
    });
  }

  it('a header and footer draft shown on the page renders the same in both paths', async () => {
    const header = clone(bundledContent('pages/site-header.json') as Doc) as Record<string, any>;
    const footer = clone(bundledContent('pages/site-footer.json') as Doc) as Record<string, any>;
    header.en.cta.createRoom = 'Start a party room';
    footer.en.tagline = 'A footer tagline for the parity test';
    footer.en.columns[0].heading = 'About this site';
    const drafts = [{ doc_id: 'site-header', data: header }, { doc_id: 'site-footer', data: footer }];
    const page = clone(bundledContent('pages/faq.json'));
    const pre = await withCommitted([...drafts, { doc_id: 'faq', data: page }], () => prerendered(urlOf('faq', 'en')));
    const prev = await previewed('faq', page, 'en', drafts);
    expect(pre).toContain('A footer tagline for the parity test');
    expect(strip(prev)).toBe(pre);
  });

  it('every static page, as published, renders the same in both paths (en and el)', async () => {
    const mismatches: string[] = [];
    for (const page of PAGE_REGISTRY) {
      const doc = bundledContent(`pages/${page.id}.json`);
      if (!doc) continue;
      for (const locale of ['en', 'el'] as const) {
        const pre = await prerendered(urlOf(page.id, locale));
        const prev = strip(await previewed(page.id, clone(doc), locale));
        if (prev !== pre) mismatches.push(`${page.id}/${locale}`);
      }
    }
    expect(mismatches).toEqual([]);
  }, 120_000);
});
