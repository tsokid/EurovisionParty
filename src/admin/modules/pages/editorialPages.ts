// The editorial documents of the data pages (CMS 3c, spec §5, §6): one per
// contest year (archive-{year}), country (country-{iso}) and live hub
// (hub-{year}). They are optional and created on demand ("Add editorial
// for …"), so the Pages module lists the ones that exist (a draft, or
// published: content/pages/index.json) and offers the others.
//
// Years and countries come from the same admin data as the Contests module
// (contest_summaries, the countries table).
import { supabase } from '../../../lib/supabase';
import { CMS_DOC_TYPES, docTypeFor } from '../../../../supabase/functions/_shared/cms/registry';
import { emptyValue } from '../../../../supabase/functions/_shared/cms/emptyValue';
import { editorialDocId, editorialFamily, type EditorialFamily } from '../../../../supabase/functions/_shared/cms/pagesIndex';
import { archivePath, countryPath, hubPath } from '../../../lib/seo/dynamicPages';
import { compareText } from '../../../lib/seo/textSort';
import type { DocValue } from './form/SchemaForm';
import { cmsGet, fetchPublished, fetchPublishedEditorialIds } from './cmsApi';

export type EditorialGroup = { family: EditorialFamily; title: string; noun: string };

/** The Pages list groups, in display order. */
export const EDITORIAL_GROUPS: readonly EditorialGroup[] = [
  { family: 'archive', title: 'Contest years', noun: 'year' },
  { family: 'country', title: 'Countries', noun: 'country' },
  { family: 'hub', title: 'Live hub', noun: 'live hub' },
];

/** A page that can take an editorial doc. `path` is its unprefixed public path (the preview opens it). */
export type EditorialTarget = { docId: string; family: EditorialFamily; label: string; path: string };

export type ContestSource = { year: number; city: string; city_slug: string; stage: string };
export type CountrySource = { iso: string; name_en: string; slug: string };
export type EditorialSources = { contests: ContestSource[]; countries: CountrySource[] };

/**
 * Every page that can take an editorial doc: each contest year (newest first;
 * its page exists once the year is archived), each live hub (a year not
 * archived yet) and each country (by English name).
 */
export function editorialTargets({ contests, countries }: EditorialSources): EditorialTarget[] {
  const years = [...contests].sort((a, b) => b.year - a.year);
  const yearLabel = (c: ContestSource) => `${c.year} · ${c.city}`;
  return [
    ...years.map((c) => ({ docId: editorialDocId('archive', c.year), family: 'archive' as const, label: yearLabel(c), path: archivePath(c.year, c.city_slug) })),
    ...[...countries]
      .sort((a, b) => compareText(a.name_en, b.name_en))
      .map((c) => ({ docId: editorialDocId('country', c.iso), family: 'country' as const, label: c.name_en, path: countryPath(c.slug) })),
    ...years
      .filter((c) => c.stage !== 'archived')
      .map((c) => ({ docId: editorialDocId('hub', c.year), family: 'hub' as const, label: yearLabel(c), path: hubPath(c.year) })),
  ];
}

/** Contest years and countries, as the Contests module reads them. Throws on failure. */
export async function loadEditorialSources(): Promise<EditorialSources> {
  const [c, co] = await Promise.all([
    supabase.rpc('contest_summaries'),
    supabase.from('countries').select('iso, name_en, slug').order('name_en'),
  ]);
  if (c.error) throw c.error;
  if (co.error) throw co.error;
  return { contests: (c.data ?? []) as ContestSource[], countries: (co.data ?? []) as CountrySource[] };
}

/**
 * What a doc id alone says about an editorial doc (no data needed, so the
 * editor's first paint is right): its kind, key (year or ISO) and heading,
 * and, for the live hub, its public path. Archive and country URLs embed the
 * city or country slug, which only the targets know.
 */
export function editorialRef(docId: string): { family: EditorialFamily; key: string; title: string; path?: string } | null {
  const type = docTypeFor(docId);
  const family = editorialFamily(docId);
  if (!family || type !== `${family}-editorial`) return null;
  const key = docId.slice(family.length + 1);
  const year = /^\d{4}$/.test(key) ? Number(key) : null;
  if (family === 'archive') return { family, key, title: `Contest year ${key}` };
  if (family === 'country') return { family, key, title: `Country ${key.toUpperCase()}` };
  return { family, key, title: `Live hub ${key}`, ...(year !== null && { path: hubPath(year) }) };
}

const KIND: Record<EditorialFamily, string> = { archive: 'Contest year', country: 'Country', hub: 'Live hub' };

/**
 * The editor heading: from the id alone ("Contest year 2005", "Country GR"),
 * with the target's label once the targets are loaded ("Contest year 2005 · Kyiv").
 */
export function editorialTitle(docId: string, targets: readonly EditorialTarget[] = []): string {
  const ref = editorialRef(docId);
  const target = targets.find((t) => t.docId === docId);
  if (!ref) return docId;
  return target ? `${KIND[ref.family]} ${target.label}` : ref.title;
}

/**
 * The public path the preview shows: the hub's from the id, an archive year's
 * or a country's from the targets. null while the targets load; undefined
 * when the doc's year or country is not listed.
 */
export function editorialPreviewPath(docId: string, targets: readonly EditorialTarget[] | null): string | null | undefined {
  const ref = editorialRef(docId);
  if (ref?.path) return ref.path;
  if (!targets) return null;
  return targets.find((t) => t.docId === docId)?.path;
}

/** A new editorial document: the schema's empty value in both locales (empty intro, no blocks). */
export function emptyEditorialDoc(): DocValue {
  const schema = CMS_DOC_TYPES['archive-editorial'].schema;
  return { en: emptyValue(schema), el: emptyValue(schema) };
}

/** What an editorial doc holds, for the Contests indicator: text (an intro or a block) and/or an image. */
export type EditorialLevel = 'none' | 'text' | 'image' | 'text + image';

export function editorialLevel(doc: unknown): EditorialLevel {
  const locales = doc && typeof doc === 'object' ? Object.values(doc as Record<string, unknown>) : [];
  const slices = locales.filter((v): v is Record<string, unknown> => !!v && typeof v === 'object');
  const text = slices.some((s) => (typeof s.intro === 'string' && s.intro.trim() !== '') || (Array.isArray(s.blocks) && s.blocks.length > 0));
  const image = slices.some((s) => {
    const img = s.image as { media?: unknown } | undefined;
    return !!img && typeof img.media === 'string' && img.media.trim() !== '';
  });
  return text && image ? 'text + image' : text ? 'text' : image ? 'image' : 'none';
}

/** What an editorial doc holds: its draft if saved, else the published doc (per the index), else none. */
export async function loadEditorialLevel(docId: string): Promise<EditorialLevel> {
  const row = await cmsGet(docId);
  if (row) return editorialLevel(row.data);
  if (!(await fetchPublishedEditorialIds()).includes(docId)) return 'none';
  return editorialLevel(await fetchPublished(docId));
}
