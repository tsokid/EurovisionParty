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

/** An entry is announced once it has both its artist and its song. */
export const isAnnounced = (e: Pick<ContestSnapshot['entries'][number], 'artist' | 'song'>): boolean =>
  (e.artist ?? '').trim() !== '' && (e.song ?? '').trim() !== '';

/** True when at least one entry has both its artist and its song. */
export const lineupAnnounced = (entries: ContestSnapshot['entries']): boolean => entries.some(isAnnounced);

interface Copy {
  title: (year: number) => string;
  notice: (year: number) => string;
  partial: (year: number) => string;
  noticeBody: string;
  all: (n: number) => string;
  intro: (n: number) => string;
}

// Notice wording from the hub/predictions boards (owner-approved).
const COPY: Record<Locale, Copy> = {
  en: {
    title: (y) => `Eurovision ${y} entries`,
    notice: (y) => `The Eurovision ${y} entries have not been announced yet.`,
    partial: (y) => `Not every Eurovision ${y} entry has been announced yet.`,
    noticeBody: 'Each entry will appear here as soon as its country announces it.',
    all: (n) => `All ${n} countries that have ever taken part`,
    intro: (n) => `Until they are, here are all ${n} countries that have ever taken part in the Eurovision Song Contest:`,
  },
  el: {
    title: (y) => `Οι συμμετοχές της Eurovision ${y}`,
    notice: (y) => `Οι συμμετοχές της Eurovision ${y} δεν έχουν ανακοινωθεί ακόμα.`,
    partial: (y) => `Δεν έχουν ανακοινωθεί ακόμα όλες οι συμμετοχές της Eurovision ${y}.`,
    noticeBody: 'Κάθε συμμετοχή θα εμφανίζεται εδώ μόλις την ανακοινώσει η χώρα της.',
    all: (n) => `Και οι ${n} χώρες που έχουν πάρει ποτέ μέρος`,
    intro: (n) => `Μέχρι να ανακοινωθούν, αυτές είναι και οι ${n} χώρες που έχουν πάρει ποτέ μέρος στον Διαγωνισμό Τραγουδιού Eurovision:`,
  },
};

/** Section title for the not-announced line-up. */
export const notAnnouncedTitle = (year: number, locale: Locale): string => COPY[locale].title(year);

/** The gold "not announced yet" notice card (none announced, or `partial`: only some). */
export function NotAnnouncedNotice({ year, locale, partial = false }: { year: number; locale: Locale; partial?: boolean }) {
  const t = COPY[locale];
  return (
    <div className="notice">
      <span className="notice-ico" aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </span>
      <div className="min-w-0">
        <h3 className="notice-title">{partial ? t.partial(year) : t.notice(year)}</h3>
        <p className="t-small notice-body">{t.noticeBody}</p>
      </div>
    </div>
  );
}

export function NotAnnounced({ year, locale }: { year: number; locale: Locale }) {
  const index = useContent<CountryIndex>(COUNTRY_INDEX_FILE);
  const t = COPY[locale];
  if (index.status !== 'ready') {
    return (
      <>
        <NotAnnouncedNotice year={year} locale={locale} />
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
      <NotAnnouncedNotice year={year} locale={locale} />
      {/* Every country that ever competed: kept (links to the country pages), folded under the notice. */}
      <details className="card fold">
        <summary className="fold-sum">
          <span className="flex-1">{t.all(countries.length)}</span>
          <svg className="fold-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </summary>
        <div className="fold-body">
          <p className="t-small m-0">{t.intro(countries.length)}</p>
          <ul className="fold-list">
            {countries.map((c) => (
              <li key={c.slug}>
                {c.page ? (
                  <LocaleLink to={countryPath(c.slug)} className="hover:text-stage-text hover:underline">{c.name}</LocaleLink>
                ) : (
                  c.name
                )}
              </li>
            ))}
          </ul>
        </div>
      </details>
    </>
  );
}
