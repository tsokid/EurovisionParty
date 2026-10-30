import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import DataTable from '../../components/seo/DataTable';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd } from '../../components/seo/Breadcrumbs';
import type { EntrySnapshot } from '../../content/contests/types';
import { countryName, formatDate } from './content/hubCopy';
import { visibleTable } from './table';
import { HubGate } from './HubFrame';
import { byCountry, countryCell, hubCrumbs, hubRelated, numCell, songCell, type Hub } from './hub';

const LAST = Number.MAX_SAFE_INTEGER;

/** By place, then running order, then country name. */
function semiOrder(entries: EntrySnapshot[], hub: Hub): EntrySnapshot[] {
  return byCountry(entries, hub.locale).sort(
    (a, b) => (a.semi_place ?? LAST) - (b.semi_place ?? LAST) || (a.semi_running_order ?? LAST) - (b.semi_running_order ?? LAST),
  );
}

function SemisBody({ hub }: { hub: Hub }) {
  const { contest, locale, facts: f, copy: c, base } = hub;
  const crumbs = hubCrumbs(hub, 'semis');
  const direct = byCountry(contest.entries.filter((e) => e.semi == null), locale);

  const semis = ([1, 2] as const)
    .map((n) => {
      const date = n === 1 ? contest.dates.semi1 : contest.dates.semi2;
      const entries = semiOrder(contest.entries.filter((e) => e.semi === n), hub);
      return { n, date, entries };
    })
    .filter((s) => s.entries.length > 0);

  return (
    <>
      <PageSeo
        path={`${base}/semifinals`}
        locale={locale}
        title={c.semis.title(f)}
        description={c.semis.description(f)}
        ogType="website"
        jsonLd={[breadcrumbJsonLd(crumbs, locale)]}
      />

      <PageHero crumbs={crumbs} chip={c.chip[contest.stage]} chipTone="gold" title={c.semis.h1(f)} lede={c.semis.lede(f)} />

      <ContentLayout wide>
        {semis.map(({ n, date, entries }) => (
          <Section key={n} id={`semi-${n}`} title={c.semis.semiTitle(n, date ? formatDate(date, locale) : null)}>
            <DataTable
              {...visibleTable(entries, [
                { header: c.headers.place, value: (e) => numCell(e.semi_place), align: 'right' },
                { header: c.headers.runningOrder, value: (e) => numCell(e.semi_running_order), align: 'right' },
                { header: c.headers.country, value: (e) => countryCell(e, locale) },
                { header: c.headers.artist, value: (e) => e.artist },
                { header: c.headers.song, value: (e) => songCell(e.song) },
                { header: c.headers.points, value: (e) => numCell(e.semi_points, true), align: 'right' },
                {
                  header: c.headers.result,
                  value: (e) => e.qualified == null ? null : e.qualified
                    ? <span className="text-euro-gold font-semibold">{c.values.qualified}</span>
                    : <span className="text-white/55">{c.values.notQualified}</span>,
                },
              ])}
            />
          </Section>
        ))}

        {direct.length > 0 && (
          <Section id="direct" title={c.semis.directTitle}>
            <p>{c.semis.direct(direct.length)}</p>
            <ul className="list-disc pl-6 space-y-1.5">
              {direct.map((e) => (
                <li key={e.iso}>
                  <strong className="text-white">{countryName(e, locale)}</strong>
                  {e.artist ? ` – ${e.artist}` : ''}
                  {e.song ? <>, <em>{e.song}</em></> : null}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <RelatedCards heading={c.related.heading(contest.year)} items={hubRelated(hub, 'semis')} />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}

export default function HubSemifinalsPage() {
  return <HubGate page={(hub) => <SemisBody hub={hub} />} />;
}
