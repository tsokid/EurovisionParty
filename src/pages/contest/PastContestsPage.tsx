import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import type { ContestIndex, IndexWinner } from '../../content/contests/types';
import { useLocale } from '../../lib/seo/LocaleContext';
import { useContent } from '../../lib/seo/useContent';
import { absoluteUrl } from '../../lib/seo/registry';
import { ARCHIVE_INDEX_PATH, COUNTRY_INDEX_PATH, archivePath, hubPath } from '../../lib/seo/dynamicPages';
import { useCurrentContest } from '../../lib/currentContest';
import LocaleLink from '../../components/seo/LocaleLink';
import { Flag } from '../../components/stage';
import type { Locale } from '../../lib/seo/locale';
import { NotFoundPage } from '../NotFoundPage';
import { ContentPending } from './ContentPending';
import { archiveCopy, archiveUi, joinList } from './content/archiveCopy';
import { cityName, countryName, hubCopy } from './content/hubCopy';
import { archivedContests, completedContests, CONTEST_INDEX, yearRail, type IndexedContest } from './archive';
import { byDecade, type ResultColumn } from './table';
import ResultsTable, { AnchorNav } from './ResultsTable';
import { Chevron, DecadeBlock, LinkCard } from './StageBits';
import { winnersData } from './winners';

const winners = (c: IndexedContest): IndexWinner[] => (c.winner ? [c.winner, ...c.co_winners] : []);
const dayMonth = (iso: string): string => `${iso.slice(8, 10)}·${iso.slice(5, 7)}`;

function PastContestsBody({ index, locale }: { index: ContestIndex; locale: Locale }) {
  const a = archiveCopy[locale];
  const x = a.index;
  const u = archiveUi[locale];
  const shows = hubCopy[locale].shows;
  // The featured contest: its hub while it is live, its archive page once archived (no redirect hop).
  const featured = useCurrentContest();
  const featuredHref =
    featured.stage === 'archived' ? archivePath(featured.year, featured.citySlug) : hubPath(featured.year);
  const featuredCity = cityName(locale, featured.citySlug, featured.city);
  const contests = archivedContests(index).reverse(); // newest first
  if (contests.length === 0) return <NotFoundPage />;
  const facts = { first: contests[contests.length - 1].year, last: contests[0].year, count: contests.length };

  const crumbs: Crumb[] = [
    { label: a.crumbs.home, href: '/' },
    { label: a.crumbs.archive, href: ARCHIVE_INDEX_PATH },
  ];

  const columns: ResultColumn<IndexedContest>[] = [
    { header: x.headers.year, role: 'pos', cell: (c) => yearRail(c.year, archivePath(c.year, c.city_slug)) },
    {
      header: x.headers.winner,
      role: 'main',
      cell: (c) => {
        if (c.cancelled) return <span className="rt-t rt-muted">{x.cancelled}</span>;
        const ws = winners(c);
        if (ws.length === 0) return null;
        const names = ws.map((w) => countryName(w, locale)).join(', ');
        return <strong className="rt-t">{ws.length > 1 ? `${names} (${x.shared})` : names}</strong>;
      },
    },
    { header: x.headers.city, role: 'sub', cell: (c) => cityName(locale, c.city_slug, c.city).name },
    { header: x.headers.song, role: 'sub', cell: (c) => (winners(c).length === 1 && c.winner!.song ? <em>{c.winner!.song}</em> : null) },
    { header: x.headers.points, role: 'pts', cell: (c) => c.winner?.points ?? null },
  ];

  const decades = byDecade(contests, (c) => c.year);

  // "At a glance": counted from the index, nothing typed in.
  const oldest = contests[contests.length - 1];
  const board = winnersData(index, locale);
  const topWins = board.leaderboard[0]?.wins ?? 0;
  const leaders = board.leaderboard.filter((r) => r.wins === topWins).map((r) => r.name);
  const record = completedContests(index)
    .filter((c) => c.winner?.points != null)
    .reduce<IndexedContest | null>((best, c) => (best && best.winner!.points! >= c.winner!.points! ? best : c), null);

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: x.listName,
    numberOfItems: contests.length,
    itemListElement: contests.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absoluteUrl(locale, archivePath(c.year, c.city_slug)),
      name: `Eurovision ${c.year}`,
    })),
  };

  const featuredDates = [
    { label: shows.semi1, date: featured.semi1Date },
    { label: shows.semi2, date: featured.semi2Date },
    { label: shows.final, date: featured.finalDate, final: true },
  ].filter((d): d is { label: string; date: string; final?: boolean } => d.date != null);

  const featuredCard = (
    <LocaleLink to={featuredHref} className="card card-hero past-next">
      <span className="past-next-top">
        <span className="chip chip-pink past-next-chip">{u.featured(featured.stage)}</span>
        <span className="past-next-link">
          {x.liveLink(featured.year, featuredCity.in)}
          <Chevron />
        </span>
      </span>
      <span className="past-next-main">
        <span className="num past-next-year">{featured.year}</span>
        <span className="past-next-city">
          <Flag iso={featured.hostIso} />
          <span>{featuredCity.name}</span>
        </span>
      </span>
      {featuredDates.length > 0 && (
        <span className="past-next-dates">
          {featuredDates.map((d) => (
            <span key={d.label} className={d.final ? 'final' : undefined}>
              <time dateTime={d.date} className="num">{dayMonth(d.date)}</time>
              <span className="t-meta">{d.label}</span>
            </span>
          ))}
        </span>
      )}
    </LocaleLink>
  );

  return (
    <>
      <PageSeo
        path={ARCHIVE_INDEX_PATH}
        locale={locale}
        title={x.title(facts)}
        description={x.description(facts)}
        ogType="website"
        jsonLd={[itemList, breadcrumbJsonLd(crumbs, locale)]}
      />
      <PageHero
        crumbs={crumbs}
        chip={`${a.chip.archive} · ${facts.first}–${facts.last}`}
        chipTone="gold"
        title={x.h1}
        lede={x.lede(facts)}
        aside={featuredCard}
      />
      <div className="wrap pg-body">
        <div className="pg-main">
          <section id="contests" className="cs" aria-labelledby="contests-h">
            <h2 id="contests-h" className="t-h2 text-stage-text">{x.tableTitle}</h2>
            <AnchorNav className="lg:hidden" label={u.decadesNav} items={decades.map((d) => ({ id: d.id, label: d.short }))} />
            <div className="dec-list">
              {decades.map((d) => (
                <DecadeBlock
                  key={d.id}
                  id={d.id}
                  label={d.label}
                  meta={u.decadeCount(d.rows.filter((c) => !c.cancelled).length, d.rows.filter((c) => c.cancelled).length)}
                >
                  <ResultsTable
                    className="rt-years"
                    columns={columns}
                    rows={d.rows}
                    rowKey={(c) => c.year}
                    iso={(c) => (winners(c).length === 1 ? c.winner!.iso : null)}
                    tone={(c) => (c.cancelled ? 'muted' : c.year === facts.last ? 'gold' : null)}
                  />
                </DecadeBlock>
              ))}
            </div>
          </section>
        </div>

        <aside className="pg-aside">
          <nav aria-label={u.decadesNav} className="card side-nav hidden lg:flex">
            <span className="t-eyebrow side-nav-k">{u.decadesNav}</span>
            {decades.map((d) => (
              <a key={d.id} href={`#${d.id}`}>
                <span className="num">{d.label}</span>
                <span className="t-meta">{d.rows.length}</span>
              </a>
            ))}
          </nav>
          <div className="card glance">
            <h3 className="t-h3">{u.glance.title}</h3>
            <dl className="glance-grid">
              <div><dt className="t-meta">{u.glance.contests}</dt><dd className="num">{contests.length}</dd></div>
              <div>
                <dt className="t-meta">{u.glance.first(cityName(locale, oldest.city_slug, oldest.city).name)}</dt>
                <dd className="num">{oldest.year}</dd>
              </div>
              {topWins > 0 && (
                <div><dt className="t-meta">{u.glance.mostWins(joinList(leaders, locale))}</dt><dd className="num text-stage-gold">{topWins}</dd></div>
              )}
              {record && (
                <div><dt className="t-meta">{u.glance.record(record.year)}</dt><dd className="num">{record.winner!.points}</dd></div>
              )}
            </dl>
          </div>
          <LinkCard to="/winners" icon="trophy" title={u.links.winners.title} blurb={u.links.winners.blurb} />
          <LinkCard to={COUNTRY_INDEX_PATH} icon="globe" title={u.links.countries.title} blurb={u.links.countries.blurb} />
        </aside>
      </div>
      <SiteFooter />
    </>
  );
}

export default function PastContestsPage() {
  const locale = useLocale();
  const index = useContent<ContestIndex>(CONTEST_INDEX);
  if (index.status === 'ready') return <PastContestsBody index={index.data} locale={locale} />;
  if (index.status === 'missing') return <NotFoundPage />;
  return <ContentPending locale={locale} retry={index.status === 'error' ? index.retry : undefined} />;
}
