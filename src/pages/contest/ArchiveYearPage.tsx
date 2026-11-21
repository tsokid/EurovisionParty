import { useParams } from 'react-router-dom';
import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import Section from '../../components/seo/Section';
import { Flag } from '../../components/stage';
import LocaleLink from '../../components/seo/LocaleLink';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import type { ArchiveYears, ContestSnapshot, EntrySnapshot } from '../../content/contests/types';
import { useLocale } from '../../lib/seo/LocaleContext';
import { useContent } from '../../lib/seo/useContent';
import { absoluteUrl } from '../../lib/seo/registry';
import { ARCHIVE_INDEX_PATH, archivePath, countryPath } from '../../lib/seo/dynamicPages';
import type { Locale } from '../../lib/seo/locale';
import { NotFoundPage } from '../NotFoundPage';
import { ContentPending } from './ContentPending';
import { archiveCopy, archiveFacts, archiveUi, ordinal, type ArchiveFacts } from './content/archiveCopy';
import { countryName, formatDate, hubCopy } from './content/hubCopy';
import { byCountry, contestEventJsonLd, songsItemList } from './hub';
import { ARCHIVE_YEARS, countryLinkCell, parseArchiveSlug } from './archive';
import type { ResultColumn } from './table';
import ResultsTable, { AnchorNav, Lead, type RowTone } from './ResultsTable';
import { Chevron } from './StageBits';
import { EditorialBlocks, EditorialTop } from './EditorialLayer';
import { editorialDescription, useEditorial } from './editorialContent';
import { mergeFaqJsonLd } from '../../components/cms/extraFaq';
import { editorialDocId } from '../../../supabase/functions/_shared/cms/pagesIndex';

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

const dmy = (iso: string): string => `${iso.slice(8, 10)}·${iso.slice(5, 7)}·${iso.slice(0, 4)}`;
/** Nav labels without their arrow (the row draws a chevron). */
const bare = (s: string): string => s.replace(/^←\s*|\s*→$/g, '');
const podium = (n: number | null): RowTone | null => (n === 1 ? 'p1' : n === 2 ? 'p2' : n === 3 ? 'p3' : null);

/** Hero card: the winner (or the shared winners), its points and how they were made. */
function WinnerCard({ f, ranking, locale }: { f: ArchiveFacts; ranking: EntrySnapshot[]; locale: Locale }) {
  const a = archiveCopy[locale];
  const u = archiveUi[locale];
  const shows = hubCopy[locale].shows;
  const solo = f.winners.length === 1 ? ranking.find((e) => e.final_place === 1) ?? null : null;
  const second = solo ? ranking.find((e) => e.final_place === 2) ?? null : null;
  const split = solo && solo.jury_points != null && solo.televote_points != null && (solo.jury_points + solo.televote_points) > 0
    ? { jury: solo.jury_points, tele: solo.televote_points }
    : null;
  return (
    <section id="winner" className="card win-card" aria-labelledby="winner-h">
      <div className="win-top">
        <h2 id="winner-h" className="chip chip-gold win-chip">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
          </svg>
          {a.year.winnerTitle(f.winners.length)}
        </h2>
        <span className="t-meta">{shows.final} · {f.city}</span>
      </div>
      <ul className={f.winners.length > 1 ? 'win-list multi' : 'win-list'}>
        {f.winners.map((w) => (
          <li key={w.iso} className="win-row">
            <div className="win-who">
              <div className="win-country">
                <Flag iso={w.iso} size={f.winners.length > 1 ? 'md' : 'lg'} />
                <span>{w.country}</span>
              </div>
              {(w.artist || w.song) && (
                <div className="win-song">
                  {w.artist}
                  {w.artist && w.song ? ' · ' : ''}
                  {w.song && <em>{w.song}</em>}
                </div>
              )}
            </div>
            {w.points !== null && (
              <div className="win-pts">
                <span className="num">{w.points}</span>
                <span className="t-meta">{u.winner.points}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
      {split && (
        <div className="win-split">
          <div className="win-bar" aria-hidden>
            <span className="jury" style={{ flexGrow: split.jury }} />
            <span className="tele" style={{ flexGrow: split.tele }} />
          </div>
          <div className="win-split-k">
            <span><span className="num jury">{split.jury}</span> {u.winner.jury}</span>
            <span>{u.winner.televote} <span className="num tele">{split.tele}</span></span>
          </div>
        </div>
      )}
      <p className="t-meta win-callout">{a.year.callout(f)}</p>
      {solo && second && solo.total_points != null && second.total_points != null && (
        <p className="t-meta win-margin">
          {u.winner.margin(solo.total_points - second.total_points, countryName(second, locale), second.total_points)}
        </p>
      )}
    </section>
  );
}

/** EL pages: the Greek entry of the year, linking to Greece's page. */
function GreekCard({ contest, locale }: { contest: ContestSnapshot; locale: Locale }) {
  const gr = locale === 'el' ? contest.entries.find((e) => e.iso === 'GR') : undefined;
  if (!gr || contest.cancelled) return null;
  const u = archiveUi[locale];
  const name = countryName(gr, locale);
  const line = [gr.artist, gr.song].filter(Boolean).join(' · ');
  const title = gr.final_place != null
    ? u.greekEntry(name, ordinal(gr.final_place, locale))
    : gr.qualified === false ? u.greekOut(name) : name;
  const pts = gr.final_place != null ? gr.total_points : gr.semi_points;
  return (
    <LocaleLink to={countryPath(gr.country_slug)} className="card-link lc gr-card">
      <Flag iso="GR" />
      <span className="lc-body">
        <span className="lc-title">{title}</span>
        <span className="t-small">{line}{pts != null ? ` · ${u.pointsShort(pts)}` : ''}</span>
      </span>
      <Chevron />
    </LocaleLink>
  );
}

function ArchiveYearBody({ data, locale }: { data: ArchiveYearData; locale: Locale }) {
  const { contest, prev, next } = data;
  const a = archiveCopy[locale];
  const u = archiveUi[locale];
  const h = hubCopy[locale];
  const f = archiveFacts(contest, locale);
  const path = archivePath(contest.year, contest.city_slug);
  const description = a.year.description(f);
  const editorial = useEditorial(editorialDocId('archive', contest.year));

  const crumbs: Crumb[] = [
    { label: a.crumbs.home, href: '/' },
    { label: a.crumbs.archive, href: ARCHIVE_INDEX_PATH },
    { label: a.crumbs.year(contest.year), href: path },
  ];

  const ranking = contest.cancelled ? byCountry(contest.entries, locale) : finalOrder(contest.entries, locale);

  const event = contestEventJsonLd(contest, f.city, description, absoluteUrl(locale, path));

  const lead = (e: EntrySnapshot) => (
    <Lead
      title={countryLinkCell(e, locale)}
      sub={e.artist || e.song ? <>{e.artist}{e.artist && e.song ? ' · ' : ''}{e.song && <em>{e.song}</em>}</> : null}
    />
  );
  const leadHeader = `${h.headers.country} · ${h.headers.artist} · ${h.headers.song}`;
  const highlight = (e: EntrySnapshot): RowTone | null => (locale === 'el' && e.iso === 'GR' ? 'hl' : null);
  const semiLabel = (n: 1 | 2, single: boolean) => (single ? a.year.semiTitle(n, true, null) : n === 1 ? h.shows.semi1 : h.shows.semi2);

  const finalColumns: ResultColumn<EntrySnapshot>[] = [
    { header: h.headers.place, role: 'pos', cell: (e) => e.final_place },
    { header: leadHeader, role: 'main', cell: lead },
    { header: h.headers.jury, role: 'num', cell: (e) => e.jury_points },
    { header: h.headers.televote, role: 'num', cell: (e) => e.televote_points },
    { header: h.headers.points, role: 'pts', cell: (e) => e.total_points },
  ];

  const entriesColumns: ResultColumn<EntrySnapshot>[] = [
    { header: leadHeader, role: 'main', cell: lead },
    { header: h.headers.semi, role: 'aux', cell: (e) => (e.semi ? h.values.semi(e.semi) : h.values.direct) },
  ];

  const semiColumns: ResultColumn<EntrySnapshot>[] = [
    { header: h.headers.place, role: 'pos', cell: (e) => e.semi_place },
    { header: leadHeader, role: 'main', cell: lead },
    { header: h.headers.points, role: 'pts', cell: (e) => e.semi_points },
    {
      header: h.headers.result,
      role: 'aux',
      cell: (e) => e.qualified == null ? null : e.qualified
        ? <span className="rt-ok">{h.values.qualified}</span>
        : <span className="rt-out">{h.values.notQualified}</span>,
    },
  ];

  const semis = contest.cancelled
    ? []
    : ([1, 2] as const)
        .map((n) => ({
          n,
          date: n === 1 ? contest.dates.semi1 : contest.dates.semi2,
          entries: semiOrder(contest.entries.filter((e) => e.semi === n), locale),
        }))
        .filter((s) => s.entries.length > 0);

  const resultsNav = contest.cancelled ? [] : [
    { id: 'final', label: h.shows.finalShort },
    ...semis.map(({ n }) => ({ id: `semi-${n}`, label: semiLabel(n, semis.length === 1) })),
  ];

  const finalists = contest.entries.filter((e) => e.in_final).length;
  const knockedOut = contest.entries.filter((e) => e.qualified === false).length;
  const factRows: { k: string; v: string; num?: boolean }[] = [
    { k: u.facts.city, v: f.host ? `${f.city}, ${f.host}` : f.city },
    ...semis.flatMap(({ n, date }) => (date ? [{ k: semiLabel(n, semis.length === 1), v: dmy(date), num: true }] : [])),
    ...(contest.dates.final ? [{ k: h.shows.final, v: dmy(contest.dates.final), num: true }] : []),
    contest.cancelled
      ? { k: u.facts.entries, v: String(f.entries), num: true }
      : { k: u.facts.finalists, v: String(finalists), num: true },
    ...(knockedOut > 0 ? [{ k: u.facts.out, v: String(knockedOut), num: true }] : []),
  ];

  const heroAside = !contest.cancelled && f.winners.length > 0 ? (
    <>
      <WinnerCard f={f} ranking={ranking} locale={locale} />
      <GreekCard contest={contest} locale={locale} />
    </>
  ) : undefined;

  return (
    <>
      <PageSeo
        path={path}
        locale={locale}
        title={a.year.title(f)}
        description={editorialDescription(editorial, description)}
        robots={contest.indexable ? undefined : 'noindex'}
        ogType="website"
        jsonLd={mergeFaqJsonLd<object>([
          ...(event ? [event] : []),
          songsItemList(ranking, contest.cancelled ? a.year.entriesListName(contest.year) : a.year.listName(contest.year)),
          breadcrumbJsonLd(crumbs, locale),
        ], editorial?.blocks)}
      />

      <PageHero
        crumbs={crumbs}
        chip={`${contest.cancelled ? a.chip.cancelled : a.chip.archive} · ${f.city} ${contest.year}`}
        chipTone="gold"
        title={a.year.h1(f)}
        lede={a.year.lede(f)}
        aside={heroAside}
      />

      <div className="wrap pg-body">
        <div className="pg-main">
          <EditorialTop editorial={editorial} />
          {contest.cancelled ? (
            <Section id="cancelled" title={a.year.cancelledTitle}>
              <p>{a.year.cancelledNote(f)}</p>
              <h3 className="t-h3 text-stage-text">{a.year.entriesTitle(f.entries)}</h3>
              <ResultsTable columns={entriesColumns} rows={ranking} rowKey={(e) => e.iso} iso={(e) => e.iso} tone={highlight} />
            </Section>
          ) : (
            <div className="res">
              <AnchorNav label={u.resultsNav} items={resultsNav} className="res-nav" />
              <Section id="final" title={a.year.finalTitle}>
                <ResultsTable
                  columns={finalColumns}
                  rows={ranking}
                  rowKey={(e) => e.iso}
                  iso={(e) => e.iso}
                  tone={(e) => highlight(e) ?? podium(e.final_place)}
                />
              </Section>
              {semis.map(({ n, date, entries }) => (
                <Section key={n} id={`semi-${n}`} title={a.year.semiTitle(n, semis.length === 1, date ? formatDate(date, locale) : null)}>
                  <p>{a.year.semiIntro}</p>
                  <ResultsTable
                    columns={semiColumns}
                    rows={entries}
                    rowKey={(e) => e.iso}
                    iso={(e) => e.iso}
                    tone={(e) => highlight(e) ?? (e.qualified === false ? 'muted' : null)}
                  />
                </Section>
              ))}
            </div>
          )}
          <EditorialBlocks editorial={editorial} />
        </div>

        <aside className="pg-aside">
          <div className="card facts">
            <h3 className="t-h3">{u.facts.title}</h3>
            <dl>
              {factRows.map((r) => (
                <div key={r.k}>
                  <dt>{r.k}</dt>
                  <dd className={r.num ? 'num' : undefined}>{r.v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <nav aria-label={a.year.navTitle} className="card more-nav">
            <h2 className="t-eyebrow">{a.year.navTitle}</h2>
            <ul>
              {prev && (
                <li>
                  <LocaleLink to={archivePath(prev.year, prev.city_slug)}>
                    <Chevron dir="left" />
                    <span className="more-t">{bare(a.year.prev(prev.year))}</span>
                  </LocaleLink>
                </li>
              )}
              {next && (
                <li>
                  <LocaleLink to={archivePath(next.year, next.city_slug)}>
                    <span className="more-t">{bare(a.year.next(next.year))}</span>
                    <Chevron />
                  </LocaleLink>
                </li>
              )}
              <li>
                <LocaleLink to={ARCHIVE_INDEX_PATH} className="more-all">
                  <span className="more-t">{a.year.allYears}</span>
                  <Chevron />
                </LocaleLink>
              </li>
            </ul>
          </nav>
        </aside>
      </div>
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
