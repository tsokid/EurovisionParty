import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import DataTable from '../../components/seo/DataTable';
import RelatedCards from '../../components/seo/RelatedCards';
import LocaleLink from '../../components/seo/LocaleLink';
import { breadcrumbJsonLd } from '../../components/seo/Breadcrumbs';
import { absoluteUrl } from '../../lib/seo/registry';
import { formatDate, showsResults } from './content/hubCopy';
import { visibleTable } from './table';
import { HubGate } from './HubFrame';
import { byCountry, contestEventJsonLd, countryCell, hubCrumbs, hubRelated, numCell, songCell, type Hub } from './hub';

function HubBody({ hub }: { hub: Hub }) {
  const { contest, locale, facts: f, copy: c, base } = hub;
  const crumbs = hubCrumbs(hub);
  const results = showsResults(f);
  const description = c.hub.description(f);

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
  const lineupTable = visibleTable(byCountry(contest.entries, locale), [
    { header: c.headers.country, value: (e) => countryCell(e, locale) },
    { header: c.headers.artist, value: (e) => e.artist },
    { header: c.headers.song, value: (e) => songCell(e.song) },
    { header: c.headers.semi, value: (e) => (e.semi ? c.values.semi(e.semi) : f.semisKnown ? c.values.direct : null) },
  ]);
  const winnerEntry = results ? finalists[0] : null;

  const glance: [string, string | number | null][] = [
    [c.glance.hostCity, f.city],
    [c.glance.hostCountry, f.host],
    [c.shows.semi1, contest.dates.semi1 && formatDate(contest.dates.semi1, locale)],
    [c.shows.semi2, contest.dates.semi2 && formatDate(contest.dates.semi2, locale)],
    [c.shows.final, contest.dates.final && formatDate(contest.dates.final, locale)],
    [c.glance.countries, f.entries],
    [c.glance.finalists, f.finalists || null],
  ];

  const shows = [
    { label: c.shows.semi1, date: contest.dates.semi1 },
    { label: c.shows.semi2, date: contest.dates.semi2 },
    { label: c.shows.final, date: contest.dates.final },
  ];

  return (
    <>
      <PageSeo
        path={base}
        locale={locale}
        title={c.hub.title(f)}
        description={description}
        ogType="website"
        jsonLd={[...(event ? [event] : []), breadcrumbJsonLd(crumbs, locale)]}
      />

      <PageHero crumbs={crumbs} chip={c.chip[contest.stage]} chipTone="gold" title={c.hub.h1(f)} lede={c.hub.lede(f)} />

      <ContentLayout wide>
        {results && winnerEntry ? (
          <Section id="results" title={c.hub.results}>
            <div className="rounded-2xl border border-euro-gold/40 bg-euro-gold/10 px-5 py-4">
              <p className="text-xl font-bold text-white">{c.winner(f)}</p>
              {(winnerEntry.artist || winnerEntry.song) && (
                <p className="mt-1 text-white/75">
                  {winnerEntry.artist}
                  {winnerEntry.artist && winnerEntry.song ? ' – ' : ''}
                  {winnerEntry.song && <em>{winnerEntry.song}</em>}
                </p>
              )}
            </div>
            <DataTable {...resultsTable} />
          </Section>
        ) : (
          <Section id="entries" title={c.hub.lineup(f)}>
            <DataTable {...lineupTable} />
            <p><LocaleLink to={`${base}/songs`} className="text-euro-pink-light hover:underline">{c.hub.songsLink} →</LocaleLink></p>
          </Section>
        )}

        <Section id="glance" title={c.hub.glance}>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {glance.filter(([, v]) => v != null && v !== '').map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-white/10 pb-2">
                <dt className="text-white/60">{label}</dt>
                <dd className="font-semibold text-white text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </Section>

        {(f.semiEntries > 0 || !f.semisKnown) && (
          <Section id="semifinals" title={c.hub.semisTitle}>
            <p>{f.semisKnown ? c.hub.semisSummary(f) : c.hub.semisPending}</p>
            <p><LocaleLink to={`${base}/semifinals`} className="text-euro-pink-light hover:underline">{c.hub.semisLink} →</LocaleLink></p>
          </Section>
        )}

        {shows.some((s) => s.date) && (
          <Section id="schedule" title={c.hub.scheduleTitle}>
            <ul className="space-y-1.5">
              {shows.filter((s) => s.date).map((s) => (
                <li key={s.label}><strong className="text-white">{s.label}:</strong> {formatDate(s.date!, locale)}</li>
              ))}
            </ul>
            <p><LocaleLink to={`${base}/schedule`} className="text-euro-pink-light hover:underline">{c.hub.scheduleLink} →</LocaleLink></p>
          </Section>
        )}

        {results && (
          <p><LocaleLink to={`${base}/songs`} className="text-euro-pink-light hover:underline">{c.hub.songsLink} →</LocaleLink></p>
        )}

        <RelatedCards heading={c.related.heading(contest.year)} items={hubRelated(hub)} />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}

export default function HubPage() {
  return <HubGate page={(hub) => <HubBody hub={hub} />} />;
}
