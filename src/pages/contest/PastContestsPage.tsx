import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import DataTable from '../../components/seo/DataTable';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import type { ContestIndex, IndexWinner } from '../../content/contests/types';
import { useLocale } from '../../lib/seo/LocaleContext';
import { useContent } from '../../lib/seo/useContent';
import { absoluteUrl } from '../../lib/seo/registry';
import { ARCHIVE_INDEX_PATH, archivePath, hubPath } from '../../lib/seo/dynamicPages';
import { useCurrentYear } from '../../lib/currentContest';
import LocaleLink from '../../components/seo/LocaleLink';
import type { Locale } from '../../lib/seo/locale';
import { NotFoundPage } from '../NotFoundPage';
import { ContentPending } from './ContentPending';
import { archiveCopy } from './content/archiveCopy';
import { cityName, countryName } from './content/hubCopy';
import { numCell, songCell } from './hub';
import { archivedContests, CONTEST_INDEX, yearCell, type IndexedContest } from './archive';
import { visibleTable } from './table';

const winners = (c: IndexedContest): IndexWinner[] => (c.winner ? [c.winner, ...c.co_winners] : []);

function PastContestsBody({ index, locale }: { index: ContestIndex; locale: Locale }) {
  const a = archiveCopy[locale];
  const x = a.index;
  const liveYear = useCurrentYear();
  const contests = archivedContests(index).reverse(); // newest first
  if (contests.length === 0) return <NotFoundPage />;
  const facts = { first: contests[contests.length - 1].year, last: contests[0].year, count: contests.length };

  const crumbs: Crumb[] = [
    { label: a.crumbs.home, href: '/' },
    { label: a.crumbs.archive, href: ARCHIVE_INDEX_PATH },
  ];

  const table = visibleTable(contests, [
    { header: x.headers.year, value: (c) => yearCell(c.year, archivePath(c.year, c.city_slug)) },
    { header: x.headers.city, value: (c) => cityName(locale, c.city_slug, c.city).name },
    {
      header: x.headers.winner,
      value: (c) => {
        if (c.cancelled) return <span className="text-white/55">{x.cancelled}</span>;
        const ws = winners(c);
        if (ws.length === 0) return null;
        const names = ws.map((w) => countryName(w, locale)).join(', ');
        return <strong className="text-white">{ws.length > 1 ? `${names} (${x.shared})` : names}</strong>;
      },
    },
    { header: x.headers.song, value: (c) => (winners(c).length === 1 ? songCell(c.winner!.song) : null) },
    { header: x.headers.points, value: (c) => numCell(c.winner?.points ?? null, true), align: 'right' },
  ]);

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
      <PageHero crumbs={crumbs} chip={a.chip.archive} chipTone="gold" title={x.h1} lede={x.lede(facts)} />
      <ContentLayout wide>
        <p>
          <LocaleLink to={hubPath(liveYear)} className="text-euro-pink-light hover:underline">{x.liveLink(liveYear)} →</LocaleLink>
        </p>
        <Section id="contests" title={x.tableTitle}>
          <DataTable {...table} />
        </Section>
      </ContentLayout>
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
