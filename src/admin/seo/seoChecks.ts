// The SEO checks of one page (CMS P6, spec §4.1). One implementation for
// the editor's SEO panel and the Publish screen, which refuses to publish
// while a blocking check fails.
//
//   check            rule                                          severity
//   Title            30–60 characters, {placeholders} filled in    warn outside, block if empty
//   Meta description 70–160 characters; unique across the site     warn on length, block if empty or a duplicate
//   H1               exactly one <h1> on the rendered page          block on 0 or more than 1
//   Slug             the fixed English path and the canonical       info
//   Images           every <img> has alt text in both languages    block
//   hreflang pair    both languages complete (valid, translated)   block otherwise
//   Internal links   every <a href> on the page resolves to a page  block on a broken one; warn on nofollow or external
//
// The DOM checks read the preview's rendered page (domAudit.ts), one audit
// per language; until a language's audit has arrived its checks are pending,
// and a pending check holds Publish like a failing one.
//
// Pure: the caller passes the doc, the audits and the known routes.
import { seoFields } from '../../../supabase/functions/_shared/cms/seo';
import { interpolate } from '../../../supabase/functions/_shared/cms/placeholders';
import type { Vars } from '../../../supabase/functions/_shared/cms/interpolateDocument';
import { getIn } from '../modules/pages/form/formModel';
import { FAQ_ANCHOR_IDS } from '../../../supabase/functions/_shared/cms/faqTopics';
import { PAGE_REGISTRY } from '../../lib/seo/registry';
import { archivePath, countryPath, hubPath, HUB_SUBPAGES, ARCHIVE_INDEX_PATH, COUNTRY_INDEX_PATH } from '../../lib/seo/dynamicPages';
import type { Locale } from '../../lib/seo/locale';
import type { DomAudit } from './domAudit';
import type { KnownRoutes } from './knownRoutes';

export { knownRoutes, type KnownRoutes } from './knownRoutes';

export const TITLE_RANGE = [30, 60] as const;
export const DESCRIPTION_RANGE = [70, 160] as const;
const LOCALES: Locale[] = ['en', 'el'];

export type CheckId = 'title' | 'description' | 'h1' | 'slug' | 'images' | 'hreflang' | 'links';
export type Severity = 'ok' | 'info' | 'warn' | 'block' | 'pending';

export type SeoCheck = {
  id: CheckId;
  /** null: about the page as a whole. */
  locale: Locale | null;
  severity: Severity;
  /** What the panel says (Greek, from the caller's copy). */
  message: string;
  /** Title and description: the rendered length and the recommended range. */
  count?: { length: number; min: number; max: number };
  /** The form field to jump to (`en.meta.title`). */
  field?: string;
  /** Items behind the check (the broken links, the images without alt). */
  items?: string[];
};


export type SeoInput = {
  docType: string;
  doc: unknown;
  /** Live-contest placeholder values per locale (titles with {year}). */
  vars?: Partial<Record<Locale, Vars>>;
  /** Cross-page duplicates of this doc's title/description (seo.ts), as the editor computes them. */
  duplicates: Array<{ locale: Locale | null; path: string; message: string }>;
  /** Locales whose doc has validation errors or missing translations (the hreflang pair). */
  incomplete: Partial<Record<Locale, number>>;
  audits: Partial<Record<Locale, DomAudit>>;
  routes: KnownRoutes | null;
  /** The canonical URL of the page per locale, when it has one (site pages). */
  canonical?: Partial<Record<Locale, string>>;
  /** The copy (Greek) of every message. */
  copy: SeoCopy;
};

export type SeoCopy = {
  titleEmpty: string;
  titleShort: (n: number) => string;
  titleLong: (n: number) => string;
  titleOk: (n: number) => string;
  descEmpty: string;
  descShort: (n: number) => string;
  descLong: (n: number) => string;
  descOk: (n: number) => string;
  descDuplicate: (message: string) => string;
  noSeoFields: string;
  h1None: string;
  h1Many: (n: number) => string;
  h1Ok: (text: string) => string;
  pending: string;
  slug: (url: string) => string;
  slugNone: string;
  altMissing: (n: number) => string;
  altOk: (n: number) => string;
  hreflangOk: string;
  hreflangMissing: (locale: string, n: number) => string;
  linksBroken: (n: number) => string;
  linksWarn: (n: number) => string;
  linksOk: (n: number) => string;
  routesLoading: string;
};

const blank = (v: unknown) => typeof v !== 'string' || v.trim() === '';

function rendered(value: unknown, vars: Vars | undefined): string {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!vars) return s;
  try {
    return interpolate(s, vars);
  } catch {
    return s;
  }
}

const REGISTRY_PATHS: Record<Locale, Set<string>> = {
  en: new Set(PAGE_REGISTRY.filter((p) => !p.greekExclusive).map((p) => p.slugByLocale.en)),
  el: new Set(PAGE_REGISTRY.filter((p) => !p.englishExclusive).map((p) => p.slugByLocale.el)),
};

/**
 * Whether an href on the page goes somewhere: a registry page, a data page
 * with data, a FAQ anchor that exists, or an anchor on this page. `null` for
 * an external or non-page link (mailto:, tel:), which the check only warns
 * about when it is external.
 */
export function resolvesInternally(href: string, locale: Locale, routes: KnownRoutes, ids: ReadonlySet<string>): boolean | null {
  if (/^(mailto:|tel:)/i.test(href)) return null;
  let raw = href;
  if (/^https?:\/\//i.test(raw)) {
    const u = new URL(raw);
    if (u.hostname !== 'eurovision.games' && u.hostname !== 'www.eurovision.games') return null;
    raw = u.pathname + u.search + u.hash;
  }
  if (raw.startsWith('#')) return ids.has(raw.slice(1));
  if (!raw.startsWith('/')) return false;
  const [beforeHash, hash = ''] = raw.split('#');
  let path = beforeHash.split('?')[0] || '/';
  let pathLocale = locale;
  const m = /^\/(en|el)(\/.*)?$/.exec(path);
  if (m) {
    pathLocale = m[1] as Locale;
    path = m[2] || '/';
  }
  if (path.length > 1) path = path.replace(/\/+$/, '');
  const known = (() => {
    if (REGISTRY_PATHS[pathLocale].has(path)) return true;
    if (path === ARCHIVE_INDEX_PATH || path === COUNTRY_INDEX_PATH) return true;
    const hub = /^\/eurovision-(\d{4})(?:\/([a-z]+))?$/.exec(path);
    if (hub) {
      const year = Number(hub[1]);
      const sub = hub[2];
      if (sub && !(HUB_SUBPAGES as readonly string[]).includes(sub)) return false;
      return year === routes.liveYear || (!sub && routes.archived.has(year));
    }
    const archive = /^\/past-contests\/eurovision-(\d{4})-([a-z0-9-]+)$/.exec(path);
    if (archive) return routes.archived.get(Number(archive[1])) === archive[2] && path === archivePath(Number(archive[1]), archive[2]);
    const country = /^\/countries\/([a-z0-9-]+)$/.exec(path);
    if (country) return routes.countrySlugs.has(country[1]) && path === countryPath(country[1]);
    return false;
  })();
  if (!known) return false;
  if (hash && path === '/faq') return (FAQ_ANCHOR_IDS as readonly string[]).includes(hash) || hash === '';
  return true;
}

/** Every check of the page, per language where it applies. */
export function seoChecks(input: SeoInput): SeoCheck[] {
  const { copy } = input;
  const out: SeoCheck[] = [];
  const fields = seoFields(input.docType);
  const slice = (l: Locale) => (input.doc && typeof input.doc === 'object' ? (input.doc as Record<string, unknown>)[l] : undefined);

  for (const l of LOCALES) {
    // Title
    if (fields?.title) {
      const text = rendered(getIn(slice(l), fields.title.split('.')), input.vars?.[l]);
      const n = text.length;
      const [min, max] = TITLE_RANGE;
      out.push({
        id: 'title', locale: l, field: `${l}.${fields.title}`, count: { length: n, min, max },
        severity: n === 0 ? 'block' : n < min || n > max ? 'warn' : 'ok',
        message: n === 0 ? copy.titleEmpty : n < min ? copy.titleShort(n) : n > max ? copy.titleLong(n) : copy.titleOk(n),
      });
    }
    // Meta description
    if (fields?.description) {
      const text = rendered(getIn(slice(l), fields.description.split('.')), input.vars?.[l]);
      const n = text.length;
      const [min, max] = DESCRIPTION_RANGE;
      const dup = input.duplicates.find((d) => d.locale === l && d.path === fields.description);
      out.push({
        id: 'description', locale: l, field: `${l}.${fields.description}`, count: { length: n, min, max },
        severity: n === 0 || dup ? 'block' : n < min || n > max ? 'warn' : 'ok',
        message: dup ? copy.descDuplicate(dup.message) : n === 0 ? copy.descEmpty : n < min ? copy.descShort(n) : n > max ? copy.descLong(n) : copy.descOk(n),
      });
    }
    const dupTitle = fields?.title ? input.duplicates.find((d) => d.locale === l && d.path === fields.title) : undefined;
    if (dupTitle) {
      const c = out.find((x) => x.id === 'title' && x.locale === l);
      if (c) Object.assign(c, { severity: 'block' as const, message: copy.descDuplicate(dupTitle.message) });
    }

    // The rendered page
    const audit = input.audits[l];
    if (!audit) {
      for (const id of ['h1', 'images', 'links'] as const) out.push({ id, locale: l, severity: 'pending', message: copy.pending });
    } else {
      const h1 = audit.h1.filter((x) => x !== '');
      out.push({
        id: 'h1', locale: l,
        severity: audit.h1.length === 1 && h1.length === 1 ? 'ok' : 'block',
        message: audit.h1.length === 0 || h1.length === 0 ? copy.h1None : audit.h1.length > 1 ? copy.h1Many(audit.h1.length) : copy.h1Ok(h1[0]),
        field: `${l}.hero.title`,
      });
      const noAlt = audit.images.filter((i) => blank(i.alt));
      out.push({
        id: 'images', locale: l, severity: noAlt.length ? 'block' : 'ok',
        message: noAlt.length ? copy.altMissing(noAlt.length) : copy.altOk(audit.images.length),
        items: noAlt.map((i) => i.src),
      });
      if (!input.routes) {
        out.push({ id: 'links', locale: l, severity: 'pending', message: copy.routesLoading });
      } else {
        const ids = new Set(audit.ids);
        const broken: string[] = [];
        const warn: string[] = [];
        for (const a of audit.links) {
          const r = resolvesInternally(a.href, l, input.routes, ids);
          if (r === false) broken.push(a.href);
          else if (r === null && /^https?:/i.test(a.href)) warn.push(a.href);
          else if (/\bnofollow\b/i.test(a.rel)) warn.push(a.href);
        }
        const uniq = (xs: string[]) => [...new Set(xs)];
        out.push({
          id: 'links', locale: l,
          severity: broken.length ? 'block' : warn.length ? 'warn' : 'ok',
          message: broken.length ? copy.linksBroken(uniq(broken).length) : warn.length ? copy.linksWarn(uniq(warn).length) : copy.linksOk(audit.links.length),
          items: uniq(broken.length ? broken : warn),
        });
      }
    }

    // Slug and canonical (the slug is fixed, English, never edited)
    const url = input.canonical?.[l];
    out.push({ id: 'slug', locale: l, severity: 'info', message: url ? copy.slug(url) : copy.slugNone });
  }

  if (!fields) out.unshift({ id: 'title', locale: null, severity: 'info', message: copy.noSeoFields });

  // hreflang: both languages complete, so en, el and x-default all render.
  const gaps = LOCALES.filter((l) => (input.incomplete[l] ?? 0) > 0);
  out.push({
    id: 'hreflang', locale: null,
    severity: gaps.length ? 'block' : 'ok',
    message: gaps.length ? gaps.map((l) => copy.hreflangMissing(l.toUpperCase(), input.incomplete[l]!)).join(' ') : copy.hreflangOk,
  });
  return out;
}

/** The checks that hold Publish: failing or not yet known. */
export const blockingChecks = (checks: readonly SeoCheck[]) => checks.filter((c) => c.severity === 'block' || c.severity === 'pending');


export { hubPath };
