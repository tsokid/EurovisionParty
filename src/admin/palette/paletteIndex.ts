// What the ⌘K / Ctrl+K palette searches (CMS P6, spec §4 "⌘K"): the admin
// screens, every CMS doc, every field of the site pages (by its label path
// and its text, so a sentence finds the field that holds it), and actions on
// the doc that is open («Δημοσίευση», «Ιστορικό», «Άνοιγμα στο site»).
//
// Matching is accent- and case-insensitive (Greek tonos ignored) and ranks
// title prefixes over word starts over substrings over subsequences, docs
// and screens over fields, so a doc's name typed in full is the first
// result and opens with Enter.
import type { z } from 'zod';
import { CMS_DOC_TYPES } from '../../../supabase/functions/_shared/cms/registry';
import { walkSchema } from '../../../supabase/functions/_shared/cms/walk';
import { childLabel } from '../modules/pages/form/formModel';
import { SITE_PAGES } from '../modules/pages/sitePages';
import { adminPaths, FOOTER_COLUMN_KEYS } from '../paths';
import { docLabel, sitePagePath } from '../siteStructure';
import { localizePath } from '../../lib/seo/locale';
import { t } from '../i18n';

export type PaletteKind = 'action' | 'screen' | 'doc' | 'field';

export type PaletteItem = {
  id: string;
  kind: PaletteKind;
  title: string;
  /** Where it is (the doc of a field, the section of a screen). */
  subtitle?: string;
  /** The doc a field belongs to: matched before its text, so «doc + field» finds that doc's field. */
  group?: string;
  /** Searched too, not shown (doc ids, English names, field text). */
  keywords?: string;
  /** An admin path, or an absolute https:// URL (opened in a new tab). */
  to: string;
};

/** Lowercase, accents and tonos stripped, whitespace collapsed. */
export const fold = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ').replace(/\s+/g, ' ').trim();

const KIND_WEIGHT: Record<PaletteKind, number> = { action: 40, screen: 30, doc: 30, field: 0 };

type Folded = { title: string; group: string; hay: string };
const folded = new WeakMap<PaletteItem, Folded>();

function foldItem(item: PaletteItem): Folded {
  let f = folded.get(item);
  if (!f) {
    f = { title: fold(item.title), group: fold(item.group ?? ''), hay: fold(`${item.title} ${item.subtitle ?? ''} ${item.keywords ?? ''}`) };
    folded.set(item, f);
  }
  return f;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A query prepared once: its folded text, tokens and word-start patterns. */
function prepare(query: string) {
  const q = fold(query);
  const tokens = q ? q.split(' ') : [];
  return { q, tokens, starts: tokens.map((tok) => new RegExp(`(^|[\\s›·(«-])${escapeRe(tok)}`)) };
}

/** How well `query` matches an item; 0 = not at all. */
export function score(item: PaletteItem, query: string | ReturnType<typeof prepare>): number {
  const p = typeof query === 'string' ? prepare(query) : query;
  if (!p.q) return KIND_WEIGHT[item.kind] + 1;
  const { title, group, hay } = foldItem(item);
  let total = 0;
  for (let i = 0; i < p.tokens.length; i++) {
    const tok = p.tokens[i];
    let s = 0;
    if (title === p.q) s = 1000;
    else if (title.startsWith(tok)) s = 400;
    else if (p.starts[i].test(title)) s = 250;
    else if (title.includes(tok)) s = 150;
    else if (group && group.includes(tok)) s = 120;
    else if (hay.includes(tok)) s = 80;
    else if (isSubsequence(tok, title)) s = 30;
    else return 0;
    total += s;
  }
  // The words that are not the doc's name, as a phrase: the field named exactly so wins.
  const rest = p.tokens.filter((tok) => !(group && group.includes(tok) && !title.includes(tok))).join(' ');
  if (rest && title === rest) total += 600;
  else if (rest && title.includes(rest)) total += 200;
  // Shorter titles first among equals; the kind decides close calls.
  return total + KIND_WEIGHT[item.kind] - Math.min(title.length, 120) / 10;
}

function isSubsequence(needle: string, hay: string): boolean {
  let i = 0;
  for (const ch of hay) if (ch === needle[i] && ++i === needle.length) return true;
  return needle.length === 0;
}

/** The best `limit` items for `query`, best first. */
export function search(items: readonly PaletteItem[], query: string, limit = 40): PaletteItem[] {
  const p = prepare(query);
  return items
    .map((it) => ({ it, s: score(it, p) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || (a.it.title < b.it.title ? -1 : 1))
    .slice(0, limit)
    .map((x) => x.it);
}

/** The admin screens. */
export function screenItems(): PaletteItem[] {
  const s = (id: string, title: string, to: string, subtitle?: string, keywords?: string): PaletteItem => ({ id: `screen:${id}`, kind: 'screen', title, subtitle, to, keywords });
  return [
    s('overview', t.nav.overview, adminPaths.overview(), undefined, 'dashboard overview'),
    s('publish', t.nav.publish, adminPaths.publish(), undefined, 'publish queue deploy'),
    s('header', t.nav.header, adminPaths.header(), t.nav.site, 'header menu nav site-header'),
    s('footer', t.nav.footer, adminPaths.footer(), t.nav.site, 'footer site-footer'),
    ...FOOTER_COLUMN_KEYS.map((k) => s(`footer-${k}`, `${t.nav.footer} › ${t.footerColumns[k as keyof typeof t.footerColumns] ?? k}`, adminPaths.footer(k), t.nav.site, `footer ${k}`)),
    s('pages', t.nav.pages, adminPaths.pages(), t.nav.site, 'pages'),
    s('contests', t.nav.yearsEntries, adminPaths.contests(), t.nav.contests, 'contests years entries'),
    s('monitor', t.nav.monitor, adminPaths.monitor(), t.nav.game, 'rooms phases monitor'),
    s('parser', t.nav.parser, adminPaths.parser(), t.nav.game, 'parser results'),
    s('winners', t.nav.winners, adminPaths.winners(), t.nav.game, 'winners'),
    s('avatars', t.nav.avatars, adminPaths.avatars(), t.nav.game, 'avatars'),
    s('media', t.nav.mediaLibrary, adminPaths.media(), t.nav.media, 'media images alt'),
    s('settings', t.nav.siteSettings, adminPaths.settings(), t.nav.settings, 'settings site-settings'),
    s('admins', t.nav.admins, adminPaths.admins(), t.nav.settings, 'super admins'),
  ];
}

/** Every site page doc by name (the header, footer and settings are screens). */
export function docItems(): PaletteItem[] {
  const pages = SITE_PAGES.map(({ docId, label }) => ({
    id: `doc:${docId}`, kind: 'doc' as const, title: label, subtitle: t.nav.pages, to: adminPaths.pages(docId),
    keywords: `${docId} ${CMS_DOC_TYPES[docId]?.label ?? ''} ${sitePagePath(docId) ?? ''}`,
  }));
  // The header, footer and settings are their screens (screenItems).
  return pages;
}

const clip = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * The fields of a site page doc as palette items: one per translatable
 * string, by its label path, with its English and Greek text as keywords.
 * Opening one deep-links the editor to the field (?field=en.path).
 */
export function fieldItems(docId: string, doc: unknown): PaletteItem[] {
  const schema: z.ZodType | undefined = CMS_DOC_TYPES[docId]?.schema;
  if (!schema || !doc || typeof doc !== 'object') return [];
  const { en, el } = doc as { en?: unknown; el?: unknown };
  const out: PaletteItem[] = [];
  const names = new Map<string, string>([['', '']]);
  const docTitle = docLabel(docId);
  walkSchema(schema, (n) => {
    const parent = names.get(n.segments.slice(0, -1).join('.')) ?? '';
    const last = n.segments[n.segments.length - 1];
    const own = last === undefined ? '' : childLabel(last, n.schema);
    // An optional() wrapper and its inner field share a path: the first visit names it.
    const name = names.get(n.path) ?? (parent ? `${parent} › ${own}` : own);
    names.set(n.path, name);
    if (n.type !== 'string' || n.meta.shared || n.meta.hidden) return;
    const [a, b] = n.values.map((v) => (typeof v === 'string' ? v : ''));
    out.push({
      id: `field:${docId}:${n.path}`,
      kind: 'field',
      title: name,
      subtitle: `${docTitle}${a ? ` · ${clip(a.replace(/\s+/g, ' '))}` : ''}`,
      group: docTitle,
      keywords: `${docTitle} ${a} ${b}`.slice(0, 600),
      to: `${adminPaths.pages(docId)}?field=${encodeURIComponent(`en.${n.path}`)}`,
    });
  }, [en, el]);
  return out;
}

/** The doc a path is about (for the actions), or null. */
export function docOfPath(pathname: string): string | null {
  const page = /^\/admin\/pages\/([^/?#]+)/.exec(pathname);
  if (page) return decodeURIComponent(page[1]);
  if (/^\/admin\/header(\/|$)/.test(pathname)) return 'site-header';
  if (/^\/admin\/footer(\/|$)/.test(pathname)) return 'site-footer';
  if (/^\/admin\/settings(\/|$)/.test(pathname)) return 'site-settings';
  return null;
}

/** «Δημοσίευση», «Ιστορικό» and «Άνοιγμα στο site» for the open doc; «Δημοσίευση» goes to the queue elsewhere. */
export function actionItems(pathname: string): PaletteItem[] {
  const docId = docOfPath(pathname);
  if (!docId) return [{ id: 'action:publish', kind: 'action', title: t.palette.publish, subtitle: t.palette.publishQueue, to: adminPaths.publish(), keywords: 'publish' }];
  const name = docLabel(docId);
  const out: PaletteItem[] = [
    { id: 'action:publish', kind: 'action', title: t.palette.publish, subtitle: name, to: adminPaths.docPublish(docId), keywords: 'publish deploy' },
    { id: 'action:history', kind: 'action', title: t.palette.history, subtitle: name, to: adminPaths.history(docId), keywords: 'history revisions restore' },
  ];
  const path = sitePagePath(docId);
  if (path) out.push({ id: 'action:live', kind: 'action', title: t.palette.openLive, subtitle: `${name} · ${path}`, to: `https://eurovision.games${localizePath('el', path)}`, keywords: 'live site open view' });
  return out;
}
