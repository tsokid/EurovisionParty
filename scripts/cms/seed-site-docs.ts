/**
 * One-off seed (Track 3 P2, spec §2 "Seed"): writes the site-wide docs
 * content/pages/site-header.json, site-footer.json and site-settings.json from
 * the shipped i18n copy (siteNav.*, siteFooter.* in src/i18n/locales/{en,el}.json)
 * and the shipped header/footer code (the link order and targets).
 *
 *   npx tsx scripts/cms/seed-site-docs.ts
 *
 * Once the keys are removed from the locales the docs are the source of
 * truth: the mapping stays as a record and the script reports "skipped".
 * Never re-run it over edited docs (it refuses to overwrite a file).
 * The proof that the seed renders exactly as before is the page capture
 * (CMS_MIGRATION_PROOF=1, tests/cms/pagesUnchanged.test.ts).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateDocument } from '../../supabase/functions/_shared/cms/validate';
import { stableJson } from '../../supabase/functions/_shared/stableJson';
import type { LinkTarget } from '../../supabase/functions/_shared/cms/siteLinks';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

type Locale = 'en' | 'el';
type Dict = Record<string, unknown>;

/** i18next `{{year}}` → CMS `{year}`. */
const label = (s: unknown): string => String(s).replace(/\{\{\s*year\s*\}\}/g, '{year}');

const page = (pageId: string, anchor?: string): LinkTarget =>
  (anchor ? { kind: 'page', pageId, anchor } : { kind: 'page', pageId }) as LinkTarget;
const dynamic = (key: string): LinkTarget => ({ kind: 'dynamic', key } as LinkTarget);

/** SiteHeader.tsx as shipped: hub, Eurovision night, then the "How to play" menu. */
export function headerLocale(nav: Dict) {
  return {
    items: [
      { label: label(nav.hub), target: dynamic('hub') },
      { label: label(nav.eurovisionNight), target: page('eurovision-night') },
      {
        label: label(nav.howToPlay),
        children: [
          { label: label(nav.trivia), target: page('eurovision-trivia') },
          { label: label(nav.predictions), target: page('eurovision-predictions') },
          { label: label(nav.rules), target: page('rules') },
          { label: label(nav.scoring), target: page('scoring') },
          { label: label(nav.otherFaq), target: page('faq') },
        ],
      },
    ],
    cta: { createRoom: label(nav.createRoom), joinRoom: label(nav.joinRoom) },
    ui: {
      menu: label(nav.menu),
      openMenu: label(nav.openMenu),
      closeMenu: label(nav.closeMenu),
      yourRooms: label(nav.yourRooms),
      noRooms: label(nav.noRooms),
    },
  };
}

/** SiteFooter.tsx as shipped: four columns, then the disclaimer. */
export function footerLocale(f: Dict) {
  const l = f.links as Dict;
  const link = (key: string, target: LinkTarget) => ({ label: label(l[key]), target });
  return {
    tagline: label(f.tagline),
    columns: [
      { id: 'about', heading: label(f.about), links: [link('whatIs', page('about')), link('freeGame', page('eurovision-games')), link('cookies', page('cookies'))] },
      {
        id: 'howToPlay',
        heading: label(f.howToPlay),
        links: [
          link('gameStages', page('how-to-play')),
          link('trivia', page('eurovision-trivia')),
          link('duels', page('eurovision-duels')),
          link('predictions', page('eurovision-predictions')),
          link('dashboard', page('dashboard')),
          link('rules', page('rules')),
        ],
      },
      {
        id: 'eurovision',
        heading: label(f.eurovision),
        links: [link('hub', dynamic('hub')), link('pastContests', dynamic('pastContests')), link('countries', dynamic('countries')), link('winners', page('winners'))],
      },
      {
        id: 'help',
        heading: label(f.help),
        links: [
          link('faq', page('faq')),
          link('create', page('faq', 'create')),
          link('join', page('faq', 'join')),
          link('leave', page('faq', 'leave')),
          link('scoring', page('scoring')),
          link('privacy', page('privacy')),
          link('terms', page('terms')),
        ],
      },
    ],
    disclaimer: label(f.disclaimer),
  };
}

/** The values coded in src/lib/seo/schema.ts and headTags.ts as shipped. */
export function settingsLocale(f: Dict) {
  return {
    siteName: 'Eurovision Games',
    defaultOgImage: 'https://eurovision.games/logo.png',
    organization: { name: 'Eurovision Games', logo: 'https://eurovision.games/icon-512.png' },
    socialProfiles: [],
    contactEmail: String(f.contactEmail),
  };
}

export function seed(write = true): string[] {
  const locales = Object.fromEntries((['en', 'el'] as const).map((l) => [l, JSON.parse(readFileSync(resolve(ROOT, `src/i18n/locales/${l}.json`), 'utf8'))])) as Record<Locale, Dict>;
  if (!locales.en.siteNav || !locales.en.siteFooter) return ['skipped: siteNav/siteFooter are gone from the locales; the docs are the source of truth'];
  const docs = {
    'site-header': { en: headerLocale(locales.en.siteNav as Dict), el: headerLocale(locales.el.siteNav as Dict) },
    'site-footer': { en: footerLocale(locales.en.siteFooter as Dict), el: footerLocale(locales.el.siteFooter as Dict) },
    'site-settings': { en: settingsLocale(locales.en.siteFooter as Dict), el: settingsLocale(locales.en.siteFooter as Dict) },
  };
  const out: string[] = [];
  for (const [docId, doc] of Object.entries(docs)) {
    const r = validateDocument(docId, doc);
    if (!r.ok) throw new Error(`${docId}: ${JSON.stringify(r.errors)}`);
    const file = resolve(ROOT, `content/pages/${docId}.json`);
    if (existsSync(file)) { out.push(`${docId}: exists, not overwritten`); continue; }
    if (write) writeFileSync(file, stableJson(doc), 'utf8');
    out.push(`${docId}: written`);
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  for (const line of seed()) console.log(line);
}
