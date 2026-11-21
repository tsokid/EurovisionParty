// Entry cards for the announced countries of the live contest (hub and
// predictions boards): flag, country, artist, song, semi-final and running
// order, with a link to the country page when it has one. Countries without
// their artist and song yet are listed by name under the cards.
import type { CountryIndex, EntrySnapshot } from '../../content/contests/types';
import type { Locale } from '../../lib/seo/locale';
import { useContent } from '../../lib/seo/useContent';
import { countryPath } from '../../lib/seo/dynamicPages';
import { compareText } from '../../lib/seo/textSort';
import LocaleLink from '../../components/seo/LocaleLink';
import { Flag } from '../../components/stage';
import { countryName, hubCopy } from './content/hubCopy';
import { byCountry } from './hub';
import { COUNTRY_INDEX_FILE, NotAnnouncedNotice, isAnnounced } from './NotAnnounced';

interface Props {
  entries: EntrySnapshot[];
  year: number;
  locale: Locale;
  /** Who sings in which semi-final is known (otherwise nobody is called a direct qualifier). */
  semisKnown: boolean;
  /** Marks the host country's card, e.g. " (host)". */
  host?: { iso: string | null; suffix: string };
}

function EntryCard({ e, year, locale, semisKnown, linked, hostSuffix }: { e: EntrySnapshot; year: number; locale: Locale; semisKnown: boolean; linked: boolean; hostSuffix?: string }) {
  const c = hubCopy[locale];
  const semi = e.semi ? c.values.semi(e.semi) : semisKnown ? c.values.direct : null;
  const order = e.semi_running_order ?? e.final_running_order ?? null;
  return (
    <li className="card entry-card">
      <div className="entry-card-head">
        <Flag iso={e.iso} size="lg" />
        <h3 className="entry-card-country">
          {countryName(e, locale)}
          {hostSuffix && <span className="t-meta font-normal">{hostSuffix}</span>}
        </h3>
        <span className="t-meta text-xs">{year}</span>
      </div>
      <div className="min-w-0">
        <div className="entry-card-artist" title={e.artist ?? undefined}>{e.artist}</div>
        <div className="t-small italic">«{e.song}»</div>
      </div>
      <div className="entry-card-meta">
        {semi && <span className={e.semi ? 'chip entry-card-chip' : 'chip chip-gold entry-card-chip'}>{semi}</span>}
        <span className="t-meta">{c.entry.runningOrder(order)}</span>
      </div>
      {linked && (
        <LocaleLink to={countryPath(e.country_slug)} className="entry-card-link t-small">
          {c.entry.countryPage}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </LocaleLink>
      )}
    </li>
  );
}

/** Cards for every announced entry; the partial-announcement notice and the pending countries when some are missing. */
export function EntryCards({ entries, year, locale, semisKnown, host }: Props) {
  const index = useContent<CountryIndex>(COUNTRY_INDEX_FILE);
  const pages = index.status === 'ready' ? index.data : null;
  const sorted = byCountry(entries, locale);
  const announced = sorted.filter(isAnnounced);
  const pending = sorted.filter((e) => !isAnnounced(e));
  return (
    <>
      {pending.length > 0 && <NotAnnouncedNotice year={year} locale={locale} partial />}
      <ul className="entry-cards">
        {announced.map((e) => (
          <EntryCard key={e.iso} e={e} year={year} locale={locale} semisKnown={semisKnown} linked={!!pages?.[e.country_slug]?.indexable} hostSuffix={host && host.iso === e.iso ? host.suffix : undefined} />
        ))}
      </ul>
      {pending.length > 0 && (
        <p className="t-small m-0">
          <span className="font-semibold text-stage-text">{hubCopy[locale].entry.pending}</span>{' '}
          {pending.map((e) => countryName(e, locale)).sort(compareText).join(', ')}
        </p>
      )}
    </>
  );
}
