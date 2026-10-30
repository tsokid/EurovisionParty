import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import DataTable from '../../components/seo/DataTable';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd } from '../../components/seo/Breadcrumbs';
import { countryName, formatDate } from './content/hubCopy';
import { visibleTable } from './table';
import { HubGate } from './HubFrame';
import { byCountry, hubCrumbs, hubRelated, type Hub } from './hub';

function ScheduleBody({ hub }: { hub: Hub }) {
  const { contest, locale, facts: f, copy: c, base } = hub;
  const crumbs = hubCrumbs(hub, 'schedule');
  const direct = byCountry(contest.entries.filter((e) => e.semi == null), locale);

  const shows = [
    { show: c.shows.semi1, date: contest.dates.semi1, countries: f.semi1 },
    { show: c.shows.semi2, date: contest.dates.semi2, countries: f.semi2 },
    { show: c.shows.final, date: contest.dates.final, countries: f.finalists },
  ];
  const table = visibleTable(shows, [
    { header: c.headers.show, value: (s) => <strong className="text-white">{s.show}</strong> },
    { header: c.headers.date, value: (s) => (s.date ? formatDate(s.date, locale) : null) },
    { header: c.headers.countries, value: (s) => (s.countries || null), align: 'right' },
  ]);

  return (
    <>
      <PageSeo
        path={`${base}/schedule`}
        locale={locale}
        title={c.schedule.title(f)}
        description={c.schedule.description(f)}
        ogType="website"
        jsonLd={[breadcrumbJsonLd(crumbs, locale)]}
      />

      <PageHero crumbs={crumbs} chip={c.chip[contest.stage]} chipTone="gold" title={c.schedule.h1(f)} lede={c.schedule.lede(f)} />

      <ContentLayout>
        <Section id="shows" title={c.schedule.showsTitle}>
          <DataTable {...table} />
        </Section>

        <Section id="how" title={c.schedule.howTitle}>
          <p>{c.schedule.how}</p>
        </Section>

        {direct.length > 0 && (
          <Section id="direct" title={c.schedule.directTitle}>
            <p>{c.schedule.direct(direct.length, direct.map((e) => countryName(e, locale)).join(', '))}</p>
          </Section>
        )}

        <RelatedCards heading={c.related.heading(contest.year)} items={hubRelated(hub, 'schedule')} />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}

export default function HubSchedulePage() {
  return <HubGate page={(hub) => <ScheduleBody hub={hub} />} />;
}
