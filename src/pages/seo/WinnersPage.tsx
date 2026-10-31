import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import DataTable from '../../components/seo/DataTable';
import FaqAccordion from '../../components/seo/FaqAccordion';
import CtaBanner from '../../components/seo/CtaBanner';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import { useLocale } from '../../lib/seo/LocaleContext';
import { pageUrl } from '../../lib/seo/registry';
import { useContent } from '../../lib/seo/useContent';
import { ARCHIVE_INDEX_PATH } from '../../lib/seo/dynamicPages';
import type { ContestIndex, IndexWinner } from '../../content/contests/types';
import { CONTEST_INDEX, yearCell, yearPath } from '../contest/archive';
import { cancelledWithin, winnersData, type WinnerYear } from '../contest/winners';
import { ContentPending } from '../contest/ContentPending';
import { usePageContent } from '../../lib/cms/usePageContent';
import type { WinnersContent } from '../../../supabase/functions/_shared/cms/schemas/winners';
import { winnersText } from './winnersText';
import { PageContentFallback } from './PageContentFallback';

/** How many champions the "recent winners" table shows (the copy says "the last 15 champions"). */
const RECENT = 15;

export default function WinnersPage() {
  const locale = useLocale();
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
  const pending = data ? null : (
    <ContentPending inline locale={locale} retry={index.status === 'error' ? index.retry : undefined} />
  );

  const name = (w: IndexWinner) => (locale === 'el' ? w.name_el : w.name_en);
  const countryCell = (y: WinnerYear) =>
    y.cancelled ? <span className="text-white/55">{c.sections.all.cancelled}</span> : (
      <strong className="text-white">
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
      solo?.song ? <em className="text-white/75">{solo.song}</em> : '—',
      points !== null ? <strong className="text-euro-pink-light tabular-nums">{points}</strong> : '—',
    ];
  };
  const winnerHeaders = [
    c.sections.recent.headers.year,
    c.sections.recent.headers.country,
    c.sections.recent.headers.artist,
    c.sections.recent.headers.song,
    c.sections.recent.headers.points,
  ];
  const winnerAlign: ('left' | 'right')[] = ['left', 'left', 'left', 'left', 'right'];

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.history, href: ARCHIVE_INDEX_PATH },
    { label: c.crumbs.winners, href: '/winners' },
  ];

  const PUBLISHED = '2026-04-30T00:00:00Z'; // fact: date the page was first published
  const MODIFIED = '2026-04-30T00:00:00Z'; // fact: date the page copy was last edited

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: c.meta.schemaTitle,
    description: c.meta.schemaDescription,
    image: 'https://eurovision.games/logo.png',
    author: { '@type': 'Organization', name: 'Eurovision Games', url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      logo: { '@type': 'ImageObject', url: 'https://eurovision.games/logo.png' },
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
          ogImage="https://eurovision.games/logo.png"
          articlePublishedTime={PUBLISHED}
          articleModifiedTime={MODIFIED}
          keywords={c.meta.keywords}
          jsonLd={[article, faqJsonLd, breadcrumbJsonLd(crumbs, locale)]}
        />
      )}

      <PageHero
        crumbs={crumbs}
        chip={c.hero.chip}
        chipTone="gold"
        title={c.hero.title}
        lede={c.hero.lede}
      />

      <ContentLayout>
        <Section id="recent" title={c.sections.recent.title}>
          {recentFrom !== null && <p>{c.sections.recent.intro}</p>}
          {pending ?? <DataTable headers={winnerHeaders} align={winnerAlign} rows={recent.map(winnerRow)} />}
        </Section>

        <Section id="leaderboard" title={c.sections.leaderboard.title}>
          <p>{c.sections.leaderboard.intro}</p>
          {data ? (
            <DataTable
              headers={[
                c.sections.leaderboard.headers.country,
                c.sections.leaderboard.headers.wins,
                c.sections.leaderboard.headers.mostRecent,
              ]}
              align={['left', 'right', 'right']}
              rows={data.leaderboard.map((row) => [
                <strong key="c" className="text-white">{row.name}</strong>,
                <strong key="w" className="text-euro-gold tabular-nums">{row.wins}</strong>,
                <span key="r" className="font-mono text-white/65 text-xs">{row.last}</span>,
              ])}
            />
          ) : pending}
        </Section>

        {data && first !== null && (
          <Section id="all" title={c.sections.all.title}>
            <p>{c.sections.all.intro}</p>
            <DataTable headers={winnerHeaders} align={winnerAlign} rows={data.all.map(winnerRow)} />
          </Section>
        )}

        <Section title={c.sections.notable.title}>
          <p>{c.sections.notable.intro}</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.sections.notable.bullets.map((b, i) => (
              <li key={i}>
                <strong className="text-white">{b.strong}</strong>
                {b.rest}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.sections.faqTitle}>
          <FaqAccordion items={c.faq} />
        </Section>

        <CtaBanner
          title={c.cta.title}
          body={c.cta.body}
          primary={{ label: c.cta.primary, href: '/?action=create' }}
          secondary={{ label: c.cta.secondary, href: '/how-to-play' }}
        />

        <RelatedCards
          heading={c.related.heading}
          items={c.related.items}
        />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
