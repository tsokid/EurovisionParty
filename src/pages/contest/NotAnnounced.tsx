// "Not announced yet" (owner, 19 Nov 2026, roadmap "Principle — Featured
// contest"): before a contest's line-up is known, pages say so and, instead of
// an empty table, list every country that has ever competed, from
// countries/index.json. Countries with a page link to it.
import type { CountryIndex } from '../../content/contests/types';
import type { ContestSnapshot } from '../../content/contests/types';
import type { Locale } from '../../lib/seo/locale';
import { useContent } from '../../lib/seo/useContent';
import { countryPath } from '../../lib/seo/dynamicPages';
import { compareText } from '../../lib/seo/textSort';
import LocaleLink from '../../components/seo/LocaleLink';
import { ContentPending } from './ContentPending';

export const COUNTRY_INDEX_FILE = 'countries/index.json';

/** True when at least one entry has both its artist and its song. */
export const lineupAnnounced = (entries: ContestSnapshot['entries']): boolean =>
  entries.some((e) => (e.artist ?? '').trim() !== '' && (e.song ?? '').trim() !== '');

const COPY: Record<Locale, { title: (year: number) => string; notice: (year: number) => string; intro: (n: number) => string }> = {
  en: {
    title: (y) => `Eurovision ${y} entries`,
    notice: (y) => `The Eurovision ${y} entries have not been announced yet.`,
    intro: (n) => `Until they are, here are all ${n} countries that have ever taken part in the Eurovision Song Contest:`,
  },
  el: {
    title: (y) => `Οι συμμετοχές της Eurovision ${y}`,
    notice: (y) => `Οι συμμετοχές της Eurovision ${y} δεν έχουν ακόμα ανακοινωθεί.`,
    intro: (n) => `Μέχρι να ανακοινωθούν, αυτές είναι και οι ${n} χώρες που έχουν πάρει ποτέ μέρος στον Διαγωνισμό Τραγουδιού Eurovision:`,
  },
};

/** Section title for the not-announced line-up. */
export const notAnnouncedTitle = (year: number, locale: Locale): string => COPY[locale].title(year);

export function NotAnnounced({ year, locale }: { year: number; locale: Locale }) {
  const index = useContent<CountryIndex>(COUNTRY_INDEX_FILE);
  const t = COPY[locale];
  if (index.status !== 'ready') {
    return (
      <>
        <p>{t.notice(year)}</p>
        <ContentPending locale={locale} retry={index.status === 'error' ? index.retry : undefined} inline />
      </>
    );
  }
  const countries = Object.entries(index.data)
    .filter(([, c]) => c.participations > 0)
    .map(([slug, c]) => ({ slug, name: locale === 'el' ? c.name_el : c.name_en, page: c.indexable }))
    .sort((a, b) => compareText(a.name, b.name));
  return (
    <>
      <p className="font-semibold text-white">{t.notice(year)}</p>
      <p>{t.intro(countries.length)}</p>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-white/80">
        {countries.map((c) => (
          <li key={c.slug}>
            {c.page ? (
              <LocaleLink to={countryPath(c.slug)} className="hover:underline">{c.name}</LocaleLink>
            ) : (
              c.name
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
