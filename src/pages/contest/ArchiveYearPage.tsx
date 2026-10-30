import { useParams } from 'react-router-dom';
import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import DataTable from '../../components/seo/DataTable';
import LocaleLink from '../../components/seo/LocaleLink';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import type { ArchiveYears, ContestSnapshot, EntrySnapshot } from '../../content/contests/types';
import { useLocale } from '../../lib/seo/LocaleContext';
import { useContent } from '../../lib/seo/useContent';
import { absoluteUrl } from '../../lib/seo/registry';
import { ARCHIVE_INDEX_PATH, archivePath } from '../../lib/seo/dynamicPages';
import type { Locale } from '../../lib/seo/locale';
import { NotFoundPage } from '../NotFoundPage';
import { ContentPending } from './ContentPending';
import { archiveCopy, archiveFacts, type ArchiveFacts } from './content/archiveCopy';
import { formatDate, hubCopy } from './content/hubCopy';
import { byCountry, contestEventJsonLd, numCell, songCell, songsItemList } from './hub';
import { ARCHIVE_YEARS, countryLinkCell, linkClass, parseArchiveSlug } from './archive';
import { visibleTable } from './table';

const LAST = Number.MAX_SAFE_INTEGER;

type ArchiveYear = ArchiveYears['years'][number];

interface ArchiveYearData {
  contest: ContestSnapshot;
  prev: ArchiveYear | null;
  next: ArchiveYear | null;
}

type State = { status: 'ready'; data: ArchiveYearData } | { status: 'loading' | 'missing' } | { status: 'error'; retry: () => void };

/** Slug → years.json row (archived, matching city) → contests/{year}.json. Anything else is a 404. */
function useArchiveYear(): State {
  const { slug } = useParams<{ slug: string }>();
  const parsed = parseArchiveSlug(slug);
  const index = useContent<ArchiveYears>(parsed ? ARCHIVE_YEARS : null);
  const archived = index.status === 'ready' ? index.data.years : [];
  const at = parsed ? archived.findIndex((c) => c.year === parsed.year && c.city_slug === parsed.citySlug) : -1;
  const contest = useContent<ContestSnapshot>(at >= 0 ? `contests/${parsed!.year}.json` : null);

  if (index.status !== 'ready') return index;
  if (at < 0) return { status: 'missing' };
  if (contest.status !== 'ready') return contest;
  return {
    status: 'ready',
    data: { contest: contest.data, prev: archived[at - 1] ?? null, next: archived[at + 1] ?? null },
  };
}

/** Grand final order: place, then country name. */
function finalOrder(entries: EntrySnapshot[], locale: Locale): EntrySnapshot[] {
  return byCountry(entries.filter((e) => e.in_final), locale)
    .sort((a, b) => (a.final_place ?? LAST) - (b.final_place ?? LAST));
}

function semiOrder(entries: EntrySnapshot[], locale: Locale): EntrySnapshot[] {
  return byCountry(entries, locale).sort(
    (a, b) => (a.semi_place ?? LAST) - (b.semi_place ?? LAST) || (a.semi_running_order ?? LAST) - (b.semi_running_order ?? LAST),
  );
}

function WinnerCallout({ f, text }: { f: ArchiveFacts; text: string }) {
  return (
    <div className="rounded-2xl border border-euro-gold/40 bg-euro-gold/10 px-5 py-4">
      <p className="text-xl font-bold text-white">{text}</p>
      <ul className="mt-1 space-y-0.5 text-white/75">
        {f.winners.filter((w) => w.artist || w.song).map((w) => (
          <li key={w.iso}>
            {f.winners.length > 1 && <strong className="text-white">{w.country}: </strong>}
            {w.artist}
            {w.artist && w.song ? ' – ' : ''}
            {w.song && <em>{w.song}</em>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ArchiveYearBody({ data, locale }: { data: ArchiveYearData; locale: Locale }) {
  const { contest, prev, next } = data;
  const a = archiveCopy[locale];
  const h = hubCopy[locale];
  const f = archiveFacts(contest, locale);
  const path = archivePath(contest.year, contest.city_slug);
  const description = a.year.description(f);

  const crumbs: Crumb[] = [
    { label: a.crumbs.home, href: '/' },
    { label: a.crumbs.archive, href: ARCHIVE_INDEX_PATH },
    { label: a.crumbs.year(contest.year), href: path },
  ];

  const ranking = contest.cancelled ? byCountry(contest.entries, locale) : finalOrder(contest.entries, locale);

  const event = contestEventJsonLd(contest, f.city, description, absoluteUrl(locale, path));

  const finalTable = visibleTable(ranking, [
    { header: h.headers.place, value: (e) => numCell(e.final_place), align: 'right' },
    { header: h.headers.country, value: (e) => countryLinkCell(e, locale) },
    { header: h.headers.artist, value: (e) => e.artist },
    { header: h.headers.song, value: (e) => songCell(e.song) },
    { header: h.headers.points, value: (e) => numCell(e.total_points, true), align: 'right' },
    { header: h.headers.jury, value: (e) => numCell(e.jury_points), align: 'right' },
    { header: h.headers.televote, value: (e) => numCell(e.televote_points), align: 'right' },
  ]);

  const entriesTable = visibleTable(ranking, [
    { header: h.headers.country, value: (e) => countryLinkCell(e, locale) },
    { header: h.headers.artist, value: (e) => e.artist },
    { header: h.headers.song, value: (e) => songCell(e.song) },
    { header: h.headers.semi, value: (e) => (e.semi ? h.values.semi(e.semi) : h.values.direct) },
  ]);

  const semis = contest.cancelled
    ? []
    : ([1, 2] as const)
        .map((n) => ({
          n,
          date: n === 1 ? contest.dates.semi1 : contest.dates.semi2,
          entries: semiOrder(contest.entries.filter((e) => e.semi === n), locale),
        }))
        .filter((s) => s.entries.length > 0);

  return (
    <>
      <PageSeo
        path={path}
        locale={locale}
        title={a.year.title(f)}
        description={description}
        robots={contest.indexable ? undefined : 'noindex'}
        ogType="website"
        jsonLd={[
          ...(event ? [event] : []),
          songsItemList(ranking, contest.cancelled ? a.year.entriesListName(contest.year) : a.year.listName(contest.year)),
          breadcrumbJsonLd(crumbs, locale),
        ]}
      />

      <PageHero
        crumbs={crumbs}
        chip={contest.cancelled ? a.chip.cancelled : a.chip.archive}
        chipTone="gold"
        title={a.year.h1(f)}
        lede={a.year.lede(f)}
      />

      <ContentLayout wide>
        {contest.cancelled ? (
          <Section id="cancelled" title={a.year.cancelledTitle}>
            <p>{a.year.cancelledNote(f)}</p>
            <h3 className="text-xl font-semibold text-white">{a.year.entriesTitle(f.entries)}</h3>
            <DataTable {...entriesTable} />
          </Section>
        ) : (
          <>
            {f.winners.length > 0 && (
              <Section id="winner" title={a.year.winnerTitle(f.winners.length)}>
                <WinnerCallout f={f} text={a.year.callout(f)} />
              </Section>
            )}
            <Section id="final" title={a.year.finalTitle}>
              <DataTable {...finalTable} />
            </Section>
            {semis.map(({ n, date, entries }) => (
              <Section key={n} id={`semi-${n}`} title={a.year.semiTitle(n, semis.length === 1, date ? formatDate(date, locale) : null)}>
                <p>{a.year.semiIntro}</p>
                <DataTable
                  {...visibleTable(entries, [
                    { header: h.headers.place, value: (e) => numCell(e.semi_place), align: 'right' },
                    { header: h.headers.country, value: (e) => countryLinkCell(e, locale) },
                    { header: h.headers.artist, value: (e) => e.artist },
                    { header: h.headers.song, value: (e) => songCell(e.song) },
                    { header: h.headers.points, value: (e) => numCell(e.semi_points, true), align: 'right' },
                    {
                      header: h.headers.result,
                      value: (e) => e.qualified == null ? null : e.qualified
                        ? <span className="text-euro-gold font-semibold">{h.values.qualified}</span>
                        : <span className="text-white/55">{h.values.notQualified}</span>,
                    },
                  ])}
                />
              </Section>
            ))}
          </>
        )}

        <nav aria-label={a.year.navTitle} className="space-y-3">
          <h2 className="text-xl font-bold text-white">{a.year.navTitle}</h2>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {prev && <li><LocaleLink to={archivePath(prev.year, prev.city_slug)} className={linkClass}>{a.year.prev(prev.year)}</LocaleLink></li>}
            <li><LocaleLink to={ARCHIVE_INDEX_PATH} className={linkClass}>{a.year.allYears}</LocaleLink></li>
            {next && <li><LocaleLink to={archivePath(next.year, next.city_slug)} className={linkClass}>{a.year.next(next.year)}</LocaleLink></li>}
          </ul>
        </nav>
      </ContentLayout>
      <SiteFooter />
    </>
  );
}

export default function ArchiveYearPage() {
  const locale = useLocale();
  const state = useArchiveYear();
  if (state.status === 'ready') return <ArchiveYearBody data={state.data} locale={locale} />;
  if (state.status === 'missing') return <NotFoundPage />;
  return <ContentPending locale={locale} retry={state.status === 'error' ? state.retry : undefined} />;
}
