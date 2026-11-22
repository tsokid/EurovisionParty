import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/seo/StageKit';
import { HubRelatedAside, HubSubHero, ShowDates } from './HubSubBits';
import { weekday } from '../seo/content/contestText';
import Section from '../../components/seo/Section';
import DataTable from '../../components/seo/DataTable';
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
  const { t } = useTranslation();
  const crumbs = hubCrumbs(hub, 'semis');
  // Unknown split: nobody is listed as a direct qualifier.
  const direct = f.semisKnown ? byCountry(contest.entries.filter((e) => e.semi == null), locale) : [];

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

      <HubSubHero hub={hub} crumbs={crumbs} title={c.semis.h1(f)} lede={c.semis.lede(f)} aside={<ShowDates hub={hub} />} />

      <div className="wrap pg-body hs-body">
        <div className="pg-main stage-prose hs-main">
          {!f.semisKnown && (
            <Section id="semis-pending" title={c.hub.semisTitle}>
              <div className="notice">
                <span className="notice-ico" aria-hidden><Icon name="clock" size={22} /></span>
                <p className="t-small notice-body m-0">{c.semis.pending}</p>
              </div>
            </Section>
          )}

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
                      ? <span className="chip chip-gold rt-chip">{c.values.qualified}</span>
                      : <span className="chip rt-chip">{c.values.notQualified}</span>,
                  },
                ])}
              />
            </Section>
          ))}

          {direct.length > 0 && (
            <Section id="direct" title={c.semis.directTitle}>
              <p>{c.semis.direct(direct.length)}</p>
              <ul className="legal-list">
                {direct.map((e) => (
                  <li key={e.iso}>
                    <strong>{countryName(e, locale)}</strong>
                    {e.artist ? ` – ${e.artist}` : ''}
                    {e.song ? <>, <em>{e.song}</em></> : null}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {semis.length === 0 && (
            <ul className="kit-grid c2 hs-semis">
              {([1, 2] as const).map((n) => {
                const date = n === 1 ? contest.dates.semi1 : contest.dates.semi2;
                return (
                  <li key={n} className="card hs-show">
                    <div className="hs-show-top">
                      <h3 className="t-eyebrow">{n === 1 ? c.shows.semi1 : c.shows.semi2}</h3>
                      <span className="chip">{t('hubSub.pending')}</span>
                    </div>
                    {date && (
                      <div className="hs-show-date">
                        <time dateTime={date} className="num">{Number(date.slice(8, 10))}</time>
                        <span><strong>{weekday(date, locale)}</strong><span className="t-meta">{formatDate(date, locale)}</span></span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <aside className="pg-aside">
          <HubRelatedAside heading={c.related.heading(contest.year)} items={hubRelated(hub, 'semis')} />
        </aside>
      </div>
      <SiteFooter />
    </>
  );
}

export default function HubSemifinalsPage() {
  return <HubGate page={(hub) => <SemisBody hub={hub} />} />;
}
