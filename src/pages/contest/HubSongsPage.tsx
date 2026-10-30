import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import DataTable from '../../components/seo/DataTable';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd } from '../../components/seo/Breadcrumbs';
import { countryName } from './content/hubCopy';
import { visibleTable } from './table';
import { HubGate } from './HubFrame';
import { byCountry, countryCell, hubCrumbs, hubRelated, songCell, type Hub } from './hub';

function SongsBody({ hub }: { hub: Hub }) {
  const { contest, locale, facts: f, copy: c, base } = hub;
  const crumbs = hubCrumbs(hub, 'songs');
  const entries = byCountry(contest.entries, locale);

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: c.songs.listName(contest.year),
    numberOfItems: entries.length,
    itemListElement: entries.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'MusicRecording',
        name: e.song ?? countryName(e, locale),
        ...(e.artist ? { byArtist: { '@type': 'MusicGroup', name: e.artist } } : {}),
        ...(e.language ? { inLanguage: e.language } : {}),
      },
    })),
  };

  const table = visibleTable(entries, [
    { header: c.headers.country, value: (e) => countryCell(e, locale) },
    { header: c.headers.artist, value: (e) => e.artist },
    { header: c.headers.song, value: (e) => songCell(e.song) },
    { header: c.headers.language, value: (e) => e.language },
    { header: c.headers.semi, value: (e) => (e.semi ? c.values.semi(e.semi) : c.values.direct) },
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

      <PageHero crumbs={crumbs} chip={c.chip[contest.stage]} chipTone="gold" title={c.songs.h1(f)} lede={c.songs.lede(f)} />

      <ContentLayout wide>
        <Section id="songs" title={c.songs.listTitle(f)}>
          <DataTable {...table} />
        </Section>

        <RelatedCards heading={c.related.heading(contest.year)} items={hubRelated(hub, 'songs')} />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}

export default function HubSongsPage() {
  return <HubGate page={(hub) => <SongsBody hub={hub} />} />;
}
