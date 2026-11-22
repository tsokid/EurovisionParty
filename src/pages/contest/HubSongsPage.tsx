import { NotAnnounced, lineupAnnounced, notAnnouncedTitle } from './NotAnnounced';
import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import { HubRelatedAside, HubSubHero, ShowDates } from './HubSubBits';
import Section from '../../components/seo/Section';
import DataTable from '../../components/seo/DataTable';
import { breadcrumbJsonLd } from '../../components/seo/Breadcrumbs';
import { visibleTable } from './table';
import { HubGate } from './HubFrame';
import { byCountry, countryCell, hubCrumbs, hubRelated, songCell, songsItemList, type Hub } from './hub';

function SongsBody({ hub }: { hub: Hub }) {
  const { contest, locale, facts: f, copy: c, base } = hub;
  const crumbs = hubCrumbs(hub, 'songs');
  const entries = byCountry(contest.entries, locale);

  const itemList = songsItemList(entries, c.songs.listName(contest.year));

  const table = visibleTable(entries, [
    { header: c.headers.country, value: (e) => countryCell(e, locale) },
    { header: c.headers.artist, value: (e) => e.artist },
    { header: c.headers.song, value: (e) => songCell(e.song) },
    { header: c.headers.language, value: (e) => e.language },
    { header: c.headers.semi, value: (e) => (e.semi ? c.values.semi(e.semi) : f.semisKnown ? c.values.direct : null) },
  ]);

  return (
    <>
      <PageSeo
        path={`${base}/songs`}
        locale={locale}
        title={c.songs.title(f)}
        description={c.songs.description(f)}
        ogType="website"
        jsonLd={[itemList, breadcrumbJsonLd(crumbs, locale)]}
      />

      <HubSubHero hub={hub} crumbs={crumbs} title={c.songs.h1(f)} lede={c.songs.lede(f)} aside={<ShowDates hub={hub} />} />

      <div className="wrap pg-body hs-body">
        <div className="pg-main stage-prose hs-main">
          {lineupAnnounced(contest.entries) ? (
            <Section id="songs" title={c.songs.listTitle(f)}>
              <DataTable {...table} />
            </Section>
          ) : (
            <Section id="songs" title={notAnnouncedTitle(contest.year, locale)}>
              <NotAnnounced year={contest.year} locale={locale} />
            </Section>
          )}
        </div>
        <aside className="pg-aside">
          <HubRelatedAside heading={c.related.heading(contest.year)} items={hubRelated(hub, 'songs')} />
        </aside>
      </div>
      <SiteFooter />
    </>
  );
}

export default function HubSongsPage() {
  return <HubGate page={(hub) => <SongsBody hub={hub} />} />;
}
