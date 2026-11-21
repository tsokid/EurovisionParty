import { NotAnnounced, lineupAnnounced, notAnnouncedTitle } from './NotAnnounced';
import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import Breadcrumbs from '../../components/seo/Breadcrumbs';
import Chip from '../../components/seo/Chip';
import { usePageHeroSlot } from '../../components/seo/PageHero';
import DataTable from '../../components/seo/DataTable';
import RelatedCards from '../../components/seo/RelatedCards';
import LocaleLink from '../../components/seo/LocaleLink';
import { Button, Flag } from '../../components/stage';
import { breadcrumbJsonLd } from '../../components/seo/Breadcrumbs';
import { absoluteUrl } from '../../lib/seo/registry';
import { useDaysUntil } from '../../hooks/useDaysUntil';
import { useCurrentContest } from '../../lib/currentContest';
import { formatDate, formatDay, showsResults, type HubFacts } from './content/hubCopy';
import { weekday } from '../seo/content/contestText';
import { visibleTable } from './table';
import { HubGate } from './HubFrame';
import { EntryCards } from './EntryCards';
import { EditorialBlocks, EditorialTop } from './EditorialLayer';
import { editorialDescription, useEditorial } from './editorialContent';
import { mergeFaqJsonLd } from '../../components/cms/extraFaq';
import { editorialDocId } from '../../../supabase/functions/_shared/cms/pagesIndex';
import { contestEventJsonLd, countryCell, hubCrumbs, hubRelated, numCell, songCell, type Hub } from './hub';

/** `2027-05-11` → "11·05" (the boards' scoreboard date). */
const dayMonth = (iso: string): string => `${iso.slice(8, 10)}·${iso.slice(5, 7)}`;

const Chevron = () => (
  <svg className="shrink-0 text-stage-text-3" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

/** H1 with the host city in the stage gradient; the text is exactly `c.hub.h1(f)`. */
function HubTitle({ text, f }: { text: string; f: HubFacts }) {
  const at = text.lastIndexOf(f.cityIn);
  const cityAt = f.cityIn.lastIndexOf(f.city);
  if (at < 0 || cityAt < 0) return <h1 className="hub-title">{text}</h1>;
  return (
    <h1 className="hub-title">
      {text.slice(0, at)}
      <span className="lg:block">
        {f.cityIn.slice(0, cityAt)}
        <span className="grad">{f.city}</span>
        {f.cityIn.slice(cityAt + f.city.length)}
      </span>
      {text.slice(at + f.cityIn.length)}
    </h1>
  );
}

/** Host city card: city, days to the final, and the three show dates. */
function HostCard({ hub }: { hub: Hub }) {
  const { contest, locale, facts: f, copy: c } = hub;
  const days = useDaysUntil(contest.dates.final);
  // Host country: from the line-up, else from site.json (known before any entry is).
  const cc = useCurrentContest();
  const host = f.host ?? (cc.year === contest.year ? cc.hostName[locale] || null : null);
  const counting = contest.dates.final != null && (contest.stage === 'upcoming' || contest.stage === 'current');
  const shows = [
    { label: c.shows.semi1, date: contest.dates.semi1, final: false },
    { label: c.shows.semi2, date: contest.dates.semi2, final: false },
    { label: c.shows.final, date: contest.dates.final, final: true },
  ].filter((s): s is { label: string; date: string; final: boolean } => s.date != null);
  return (
    <div className="card-hero hub-card">
      <div className="flex items-center gap-3.5">
        <Flag iso={contest.host_iso} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-stage-text lg:text-[17px]">{host ? `${f.city}, ${host}` : f.city}</div>
          <div className="t-meta">{c.glance.hostCity}</div>
        </div>
        {counting && (
          <div className="hub-days">
            <div className="num hub-days-n">{days != null && days >= 0 ? days : ' '}</div>
            <div className="t-meta">{c.daysToFinal(days ?? 2)}</div>
          </div>
        )}
      </div>
      {shows.length > 0 && (
        <dl className="hub-shows">
          {shows.map((s) => (
            <div key={s.label} className={s.final ? 'stat hub-show final' : 'stat hub-show'}>
              <dt className="t-meta hub-show-k">
                {s.final ? (
                  <>
                    <span className="lg:hidden">{c.shows.finalShort}</span>
                    <span className="hidden lg:inline">{s.label}</span>
                  </>
                ) : s.label}
              </dt>
              <dd className="m-0">
                <time dateTime={s.date} className="num hub-show-v">{dayMonth(s.date)}</time>
                <span className="t-meta block">
                  {weekday(s.date, locale)}
                  <span className="hidden lg:inline"> {s.date.slice(0, 4)}</span>
                </span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function HubBody({ hub }: { hub: Hub }) {
  const { contest, locale, facts: f, copy: c, base } = hub;
  const crumbs = hubCrumbs(hub);
  const results = showsResults(f);
  const description = c.hub.description(f);
  const editorial = useEditorial(editorialDocId('hub', contest.year));
  const subNav = usePageHeroSlot();

  const event = contestEventJsonLd(contest, f.city, description, absoluteUrl(locale, base));

  const finalists = contest.entries
    .filter((e) => e.final_place != null)
    .sort((a, b) => a.final_place! - b.final_place!);
  const resultsTable = visibleTable(finalists, [
    { header: c.headers.place, value: (e) => numCell(e.final_place), align: 'right' },
    { header: c.headers.country, value: (e) => countryCell(e, locale) },
    { header: c.headers.artist, value: (e) => e.artist },
    { header: c.headers.song, value: (e) => songCell(e.song) },
    { header: c.headers.points, value: (e) => numCell(e.total_points, true), align: 'right' },
    { header: c.headers.jury, value: (e) => numCell(e.jury_points), align: 'right' },
    { header: c.headers.televote, value: (e) => numCell(e.televote_points), align: 'right' },
  ]);
  const winnerEntry = results ? finalists[0] : null;
  // No entry with its artist and song yet: "not announced" and every country that ever competed.
  const announced = lineupAnnounced(contest.entries);

  const glance: [string, string | number | null][] = [
    [c.glance.hostCity, f.city],
    [c.glance.hostCountry, f.host],
    [c.shows.semi1, contest.dates.semi1 && formatDate(contest.dates.semi1, locale)],
    [c.shows.semi2, contest.dates.semi2 && formatDate(contest.dates.semi2, locale)],
    [c.shows.final, contest.dates.final && formatDate(contest.dates.final, locale)],
    [c.glance.countries, f.entries || null],
    [c.glance.finalists, f.finalists || null],
  ];

  const shows = [
    { label: c.shows.semi1, date: contest.dates.semi1 },
    { label: c.shows.semi2, date: contest.dates.semi2 },
    { label: c.shows.final, date: contest.dates.final },
  ];
  const semiShows = [
    { label: c.shows.semi1, date: contest.dates.semi1 },
    { label: c.shows.semi2, date: contest.dates.semi2 },
  ].filter((s): s is { label: string; date: string } => s.date != null);
  const showSemis = f.semiEntries > 0 || !f.semisKnown;

  return (
    <>
      <PageSeo
        path={base}
        locale={locale}
        title={c.hub.title(f)}
        description={editorialDescription(editorial, description)}
        ogType="website"
        jsonLd={mergeFaqJsonLd<object>([...(event ? [event] : []), breadcrumbJsonLd(crumbs, locale)], editorial?.blocks)}
      />

      <header className="hero hub-hero">
        <div className="wrap hub-hero-inner">
          <div className="hub-hero-grid">
            <div className="hub-hero-text">
              <Breadcrumbs items={crumbs} />
              <Chip tone="gold"><span className="dot" aria-hidden />{c.chip[contest.stage]}</Chip>
              <HubTitle text={c.hub.h1(f)} f={f} />
              <p className="hero-lede">{c.hub.lede(f)}</p>
            </div>
            <HostCard hub={hub} />
          </div>
          <div className="hub-hero-foot">
            {subNav}
            {shows.some((s) => s.date) && (
              <LocaleLink to={`${base}/schedule`} className="hub-more hidden lg:inline-flex">
                {c.hub.scheduleLink}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </LocaleLink>
            )}
          </div>
        </div>
      </header>

      <div className="wrap hub-body stage-prose">
        <EditorialTop editorial={editorial} />

        <div className="hub-main-grid">
          <div className="hub-main">
            {results && winnerEntry ? (
              <section id="results" className="cs">
                <h2 className="t-h2 text-stage-text">{c.hub.results}</h2>
                <div className="hub-winner">
                  <Flag iso={winnerEntry.iso} size="lg" />
                  <div className="min-w-0">
                    <p className="hub-winner-title">{c.winner(f)}</p>
                    {(winnerEntry.artist || winnerEntry.song) && (
                      <p className="t-small m-0 mt-1">
                        {winnerEntry.artist}
                        {winnerEntry.artist && winnerEntry.song ? ' – ' : ''}
                        {winnerEntry.song && <em>{winnerEntry.song}</em>}
                      </p>
                    )}
                  </div>
                </div>
                <DataTable {...resultsTable} />
                <p className="m-0"><LocaleLink to={`${base}/songs`} className="hub-more">{c.hub.songsLink} →</LocaleLink></p>
              </section>
            ) : (
              <section id="entries" className="cs">
                <h2 className="t-h2 text-stage-text">{announced ? c.hub.lineup(f) : notAnnouncedTitle(contest.year, locale)}</h2>
                {announced ? (
                  <>
                    <EntryCards entries={contest.entries} year={contest.year} locale={locale} semisKnown={f.semisKnown} />
                    <p className="m-0"><LocaleLink to={`${base}/songs`} className="hub-more">{c.hub.songsLink} →</LocaleLink></p>
                  </>
                ) : (
                  <NotAnnounced year={contest.year} locale={locale} />
                )}
              </section>
            )}
          </div>

          <aside className="hub-aside" aria-label={`${c.hub.semisTitle} · ${c.play.eyebrow}`}>
            {showSemis && (
              <section id="semifinals" className="card hub-semis">
                <h2 className="t-h3 text-stage-text">{c.hub.semisTitle}</h2>
                {semiShows.length > 0 && (
                  <ul className="hub-semis-list">
                    {semiShows.map((s) => (
                      <li key={s.label}>
                        <LocaleLink to={`${base}/semifinals`} className="hub-semi">
                          <span className="num hub-semi-n">{dayMonth(s.date)}</span>
                          <span className="flex-1 min-w-0">
                            <span className="block font-semibold text-stage-text">{s.label}</span>
                            <span className="t-meta block">{weekday(s.date, locale)} {formatDay(s.date, locale)}</span>
                          </span>
                          <Chevron />
                        </LocaleLink>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="t-meta m-0">{f.semisKnown ? c.hub.semisSummary(f) : c.hub.semisPending}</p>
                <p className="m-0"><LocaleLink to={`${base}/semifinals`} className="hub-more">{c.hub.semisLink} →</LocaleLink></p>
              </section>
            )}

            {!results && (
              <section className="card hub-play" aria-labelledby="hub-play-title">
                <span className="t-eyebrow text-stage-text-2">{c.play.eyebrow}</span>
                <h2 id="hub-play-title" className="t-h2 text-stage-text hub-play-title">{c.play.title(contest.year)}</h2>
                <ul className="hub-checks t-small">
                  {c.play.points.map((p) => (
                    <li key={p}>
                      <svg className="text-stage-ok shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                      {p}
                    </li>
                  ))}
                </ul>
                <Button to="/?action=create" block>{c.play.create}</Button>
                <Button to="/how-to-play" variant="ghost" size="sm" block className="hidden lg:inline-flex">{c.play.howTo}</Button>
              </section>
            )}
          </aside>
        </div>

        {/* Kept from the previous hub, below the board's sections. */}
        <div className="hub-facts">
          <section id="glance" className="card hub-fact">
            <h2 className="t-h3 text-stage-text">{c.hub.glance}</h2>
            <dl className="hub-glance">
              {glance.filter(([, v]) => v != null && v !== '').map(([label, value]) => (
                <div key={label}>
                  <dt className="t-meta">{label}</dt>
                  <dd className="m-0 font-semibold text-stage-text text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {shows.some((s) => s.date) && (
            <section id="schedule" className="card hub-fact">
              <h2 className="t-h3 text-stage-text">{c.hub.scheduleTitle}</h2>
              <ul className="hub-dates">
                {shows.filter((s) => s.date).map((s) => (
                  <li key={s.label}><strong>{s.label}:</strong> {formatDate(s.date!, locale)}</li>
                ))}
              </ul>
              <p className="m-0"><LocaleLink to={`${base}/schedule`} className="hub-more">{c.hub.scheduleLink} →</LocaleLink></p>
            </section>
          )}
        </div>

        <EditorialBlocks editorial={editorial} />

        <RelatedCards heading={c.related.heading(contest.year)} items={hubRelated(hub)} columns={4} />
      </div>
      <SiteFooter />
    </>
  );
}

export default function HubPage() {
  return <HubGate page={(hub) => <HubBody hub={hub} />} />;
}
