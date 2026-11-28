import { pageModified } from '../../lib/seo/pageDates';
import { useTranslation } from 'react-i18next';
import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import DataTable from '../../components/seo/DataTable';
import FaqAccordion from '../../components/seo/FaqAccordion';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import { Button, Flag } from '../../components/stage';
import { useLocale } from '../../lib/seo/LocaleContext';
import { pageUrl } from '../../lib/seo/registry';
import { useContent } from '../../lib/seo/useContent';
import { ARCHIVE_INDEX_PATH } from '../../lib/seo/dynamicPages';
import type { ContestIndex, IndexWinner } from '../../content/contests/types';
import { CONTEST_INDEX, yearCell, yearPath, yearRail } from '../contest/archive';
import { cancelledWithin, winnersData, type WinnerYear } from '../contest/winners';
import { ContentPending } from '../contest/ContentPending';
import { archiveUi } from '../contest/content/archiveCopy';
import { byDecade, type ResultColumn } from '../contest/table';
import ResultsTable, { AnchorNav } from '../contest/ResultsTable';
import { DecadeBlock, LinkCard } from '../contest/StageBits';
import { usePageContent } from '../../lib/cms/usePageContent';
import ExtraBlocks from '../../components/cms/ExtraBlocks';
import { mergeFaqJsonLd } from '../../components/cms/extraFaq';
import type { WinnersContent } from '../../../supabase/functions/_shared/cms/schemas/winners';
import { winnersText } from './winnersText';
import { PageContentFallback } from './PageContentFallback';
import { useSiteSettings } from '../../lib/cms/siteSettings';

/** How many champions the "recent winners" table shows (the copy says "the last 15 champions"). */
const RECENT = 15;

/** Longest run of consecutive solo wins by one country (years oldest first; a cancelled year breaks it). */
function longestStreak(all: WinnerYear[]): { iso: string; wins: number } | null {
  let best: { iso: string; wins: number } | null = null;
  let iso: string | null = null;
  let wins = 0;
  for (const y of [...all].reverse()) {
    const solo = y.winners.length === 1 ? y.winners[0].iso : null;
    wins = solo !== null && solo === iso ? wins + 1 : solo !== null ? 1 : 0;
    iso = solo;
    if (iso !== null && wins > (best?.wins ?? 1)) best = { iso, wins };
  }
  return best;
}

export default function WinnersPage() {
  const locale = useLocale();
  const settings = useSiteSettings();
  const { t } = useTranslation();
  const content = usePageContent<WinnersContent>('winners');
  const index = useContent<ContestIndex>(CONTEST_INDEX);
  if (content.status !== 'ready') return <PageContentFallback state={content} />;
  const data = index.status === 'ready' ? winnersData(index.data, locale) : null;
  const recent = data ? data.years.slice(0, RECENT) : [];
  const recentFrom = recent.length ? recent[recent.length - 1].year : null;
  const recentTo = recent.length ? recent[0].year : null;
  const first = data?.all.length ? data.all[data.all.length - 1].year : null;
  // The latest completed year ends the "1956 to …" range in the meta copy.
  const lastYear = data?.years[0]?.year ?? null;
  // A cancelled year inside the recent window gets the "(No 2020 …)" note.
  const gap = data && recentFrom !== null && recentTo !== null ? cancelledWithin(data.all, recentFrom, recentTo) : null;
  const c = winnersText(content.data, { last: lastYear, from: recentFrom, to: recentTo, first, cancelled: gap });
  const u = archiveUi[locale];
  const pending = data ? null : (
    <ContentPending inline locale={locale} retry={index.status === 'error' ? index.retry : undefined} />
  );

  const name = (w: IndexWinner) => (locale === 'el' ? w.name_el : w.name_en);
  const countryCell = (y: WinnerYear) =>
    y.cancelled ? <span className="text-stage-text-3">{c.sections.all.cancelled}</span> : (
      <strong className="text-stage-text">
        {y.winners.map(name).join(', ')}{y.winners.length > 1 ? ` (${c.sections.all.shared})` : ''}
      </strong>
    );
  const winnerRow = (y: WinnerYear) => {
    const solo = y.winners.length === 1 ? y.winners[0] : null;
    const points = y.winners[0]?.points ?? null;
    return [
      yearCell(y.year, yearPath(y.year, y)),
      countryCell(y),
      solo?.artist ?? '—',
      solo?.song ? <em className="text-stage-text-2">{solo.song}</em> : '—',
      points !== null ? <strong className="text-stage-pink-2 tabular-nums">{points}</strong> : '—',
    ];
  };
  const h = c.sections.recent.headers;
  const winnerHeaders = [h.year, h.country, h.artist, h.song, h.points];
  const winnerAlign: ('left' | 'right')[] = ['left', 'left', 'left', 'left', 'right'];

  // The full list: Stage rows per decade (entry rows on phones, columns on desktop).
  const columns: ResultColumn<WinnerYear>[] = [
    { header: h.year, role: 'pos', cell: (y) => yearRail(y.year, yearPath(y.year, y)) },
    {
      header: h.country,
      role: 'main',
      cell: (y) => y.cancelled
        ? <span className="rt-t rt-muted">{c.sections.all.cancelled}</span>
        : <strong className="rt-t">{y.winners.map(name).join(', ')}{y.winners.length > 1 ? ` (${c.sections.all.shared})` : ''}</strong>,
    },
    { header: h.artist, role: 'sub', cell: (y) => (y.winners.length === 1 ? y.winners[0].artist : null) },
    { header: h.song, role: 'sub', cell: (y) => (y.winners.length === 1 && y.winners[0].song ? <em>{y.winners[0].song}</em> : null) },
    { header: h.points, role: 'pts', cell: (y) => y.winners[0]?.points ?? null },
  ];
  const decades = data ? byDecade(data.all, (y) => y.year) : [];

  // Hero stats, counted from the index.
  const record = data?.years.reduce<WinnerYear | null>(
    (best, y) => ((y.winners[0]?.points ?? -1) > (best?.winners[0]?.points ?? -1) ? y : best),
    null,
  ) ?? null;
  const streak = data ? longestStreak(data.all) : null;
  const streakName = streak ? data!.leaderboard.find((r) => r.iso === streak.iso)?.name ?? null : null;
  const topWins = data?.leaderboard[0]?.wins ?? 0;
  // Most wins: rows above the minimum, the countries at the minimum as chips (board).
  const minWins = data?.leaderboard.length ? data.leaderboard[data.leaderboard.length - 1].wins : 0;
  const lbChips = data && data.leaderboard.some((r) => r.wins > minWins) ? data.leaderboard.filter((r) => r.wins === minWins) : [];
  const lbRows = data ? data.leaderboard.filter((r) => !lbChips.includes(r)) : [];

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.history, href: ARCHIVE_INDEX_PATH },
    { label: c.crumbs.winners, href: '/winners' },
  ];

  const PUBLISHED = '2026-04-30T00:00:00Z'; // fact: date the page was first published
  const MODIFIED = pageModified('winners'); // the page's last change, from git (sitemap lastmod)

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: c.meta.schemaTitle,
    description: c.meta.schemaDescription,
    image: settings.defaultOgImage,
    author: { '@type': 'Organization', name: settings.organization.name, url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: settings.organization.name,
      logo: { '@type': 'ImageObject', url: settings.organization.logo },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl('winners', locale) },
  };
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: c.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  const leaderboard = (
    <section id="leaderboard" className="card lb" aria-labelledby="leaderboard-h">
      <div className="lb-head">
        <h2 id="leaderboard-h" className="t-h3">{c.sections.leaderboard.title}</h2>
        <p className="t-meta m-0">{c.sections.leaderboard.intro}</p>
      </div>
      {data ? (
        <table role="table" className="lb-t">
          <thead role="rowgroup" className="sr-only">
            <tr role="row">
              <th role="columnheader">#</th>
              <th role="columnheader">{c.sections.leaderboard.headers.country}</th>
              <th role="columnheader">{c.sections.leaderboard.headers.mostRecent}</th>
              <th role="columnheader">{c.sections.leaderboard.headers.wins}</th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {lbRows.map((row) => {
              const rank = data.leaderboard.findIndex((r) => r.wins === row.wins) + 1;
              return (
                <tr key={row.iso} role="row">
                  <td role="cell" className={rank === 1 ? 'num lb-rank gold' : 'num lb-rank'}>{rank}</td>
                  <td role="cell" className="lb-who">
                    <Flag iso={row.iso} />
                    <span className="lb-name">
                      <strong>{row.name}</strong>
                      <span className="t-meta">{t('winnersPage.lastWin', { year: row.last })}</span>
                    </span>
                  </td>
                  <td role="cell" className="lb-last sr-only">{row.last}</td>
                  <td role="cell" className="lb-wins">
                    <span className="lb-bar" aria-hidden><span style={{ width: `${(row.wins / topWins) * 100}%` }} /></span>
                    <span className={rank === 1 ? 'num gold' : 'num'}>{row.wins}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : pending}
      {lbChips.length > 0 && (
        <div className="lb-chips">
          <p className="lb-chips-k m-0">
            <span className="num">{lbChips[0].wins}</span> {t('winnersPage.wins', { count: lbChips[0].wins })}
          </p>
          <ul>
            {lbChips.map((row) => (
              <li key={row.iso} className="chip lb-chip">
                <Flag iso={row.iso} size="sm" />
                <strong>{row.name}</strong>
                <span className="t-meta">{row.last}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );

  return (
    <>
      {/* Head tags wait for the index; only a client-side navigation renders before it (prerendered pages inline it). */}
      {lastYear !== null && (
        <PageSeo
          pageId="winners"
          locale={locale}
          title={c.meta.title}
          description={c.meta.description}
          ogType="article"
          ogImage={settings.defaultOgImage}
          articlePublishedTime={PUBLISHED}
          articleModifiedTime={MODIFIED}
          keywords={c.meta.keywords}
          jsonLd={mergeFaqJsonLd([article, faqJsonLd, breadcrumbJsonLd(crumbs, locale)], content.data.extraBlocks)}
        />
      )}

      <PageHero
        cms="hero"
        crumbs={crumbs}
        chip={c.hero.chip}
        chipTone="gold"
        title={c.hero.title}
        lede={c.hero.lede}
        aside={leaderboard}
      >
        {data && first !== null && (
          <dl className="hero-stats">
            <div>
              <dt className="t-meta">{t('winnersPage.statContests', { first })}</dt>
              <dd className="num">{data.all.length}</dd>
            </div>
            {record && record.winners[0]?.points != null && (
              <div>
                <dt className="t-meta">{t('winnersPage.statRecord', { year: record.year })}</dt>
                <dd className="num text-stage-gold">{record.winners[0].points}</dd>
              </div>
            )}
            {streak && streakName && (
              <div>
                <dt className="t-meta">{t('winnersPage.statStreak', { country: streakName })}</dt>
                <dd className="num">{streak.wins}</dd>
              </div>
            )}
          </dl>
        )}
      </PageHero>

      <div className="wrap pg-body">
        <div className="pg-main">
          {data && first !== null ? (
            <section id="all" className="cs" aria-labelledby="all-h">
              <div className="cs-head">
                <h2 id="all-h" className="t-h2 text-stage-text">{c.sections.all.title}</h2>
                <AnchorNav label={u.decadesNav} items={decades.map((d) => ({ id: d.id, label: d.short }))} />
              </div>
              <p className="t-body">{c.sections.all.intro}</p>
              <div className="dec-list">
                {decades.map((d) => (
                  <DecadeBlock key={d.id} id={d.id} label={d.label}>
                    <ResultsTable
                      className="rt-years"
                      columns={columns}
                      rows={d.rows}
                      rowKey={(y) => y.year}
                      iso={(y) => (y.winners.length === 1 ? y.winners[0].iso : null)}
                      tone={(y) => (y.cancelled ? 'muted' : y.year === lastYear ? 'gold' : null)}
                    />
                  </DecadeBlock>
                ))}
              </div>
            </section>
          ) : pending}

          {/* The last 15 champions (also in the full list above): kept, folded. */}
          <details id="recent" className="card fold recent-fold">
            <summary className="fold-sum">
              <h2 className="t-h3 recent-h">{c.sections.recent.title}</h2>
              <svg className="fold-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="fold-body stage-prose">
              {recentFrom !== null && <p className="m-0">{c.sections.recent.intro}</p>}
              {pending ?? <DataTable headers={winnerHeaders} align={winnerAlign} rows={recent.map(winnerRow)} />}
            </div>
          </details>
        </div>

        <aside className="pg-aside">
          <section className="card notable" aria-labelledby="notable-h">
            <h2 id="notable-h" className="t-h3">{c.sections.notable.title}</h2>
            <p className="t-small m-0">{c.sections.notable.intro}</p>
            <ul>
              {c.sections.notable.bullets.map((b, i) => (
                <li key={i}>
                  <strong>{b.strong}</strong>
                  <span className="t-small">{b.rest}</span>
                </li>
              ))}
            </ul>
          </section>

          <aside className="card win-cta" role="complementary">
            <h2 className="t-h3">{c.cta.title}</h2>
            <p className="t-small m-0">{c.cta.body}</p>
            <div className="win-cta-actions">
              <Button to="/?action=create" variant="primary" size="sm">{c.cta.primary}</Button>
              <Button to="/how-to-play" variant="secondary" size="sm">{c.cta.secondary}</Button>
            </div>
          </aside>

          <LinkCard to={ARCHIVE_INDEX_PATH} icon="archive" title={c.crumbs.history} blurb={t('winnersPage.pastBlurb')} />
        </aside>
      </div>

      <ContentLayout wide>
        <Section title={c.sections.faqTitle}>
          <FaqAccordion items={c.faq} />
        </Section>

        <ExtraBlocks value={content.data.extraBlocks} />

        <RelatedCards
          heading={c.related.heading}
          items={c.related.items}
        />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
