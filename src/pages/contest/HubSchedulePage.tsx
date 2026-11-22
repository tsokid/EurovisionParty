import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import { DaysCard, HubPlayCard, HubSubHero } from './HubSubBits';
import { weekday } from '../seo/content/contestText';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd } from '../../components/seo/Breadcrumbs';
import { countryName, formatDate } from './content/hubCopy';
import { HubGate } from './HubFrame';
import { byCountry, hubCrumbs, hubRelated, type Hub } from './hub';

function ScheduleBody({ hub }: { hub: Hub }) {
  const { contest, locale, facts: f, copy: c, base } = hub;
  const crumbs = hubCrumbs(hub, 'schedule');
  // Unknown split: nobody is listed as a direct qualifier.
  const direct = f.semisKnown ? byCountry(contest.entries.filter((e) => e.semi == null), locale) : [];

  const shows = [
    { show: c.shows.semi1, date: contest.dates.semi1, countries: f.semi1, final: false },
    { show: c.shows.semi2, date: contest.dates.semi2, countries: f.semi2, final: false },
    { show: c.shows.final, date: contest.dates.final, countries: f.finalists, final: true },
  ];

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

      <HubSubHero
        hub={hub}
        crumbs={crumbs}
        title={c.schedule.h1(f)}
        lede={c.schedule.lede(f)}
        aside={<DaysCard hub={hub} label={(d) => contest.dates.final ? `${c.daysToFinal(d)}, ${weekday(contest.dates.final, locale)} ${formatDate(contest.dates.final, locale)}` : c.daysToFinal(d)} />}
      />

      <div className="wrap pg-body hs-body">
        <div className="pg-main">
          <section id="shows" className="cs" aria-labelledby="shows-h">
            <h2 id="shows-h" className="t-h2">{c.schedule.showsTitle}</h2>
            <ul className="kit-grid c3 hs-shows">
              {shows.map((s) => (
                <li key={s.show} className={s.final ? 'card hs-show final' : 'card hs-show'}>
                  <h3 className="t-eyebrow">{s.show}</h3>
                  {s.date ? (
                    <div className="hs-show-date">
                      <time dateTime={s.date} className="num">{Number(s.date.slice(8, 10))}</time>
                      <span><strong>{weekday(s.date, locale)}</strong><span className="t-meta">{formatDate(s.date, locale)}</span></span>
                    </div>
                  ) : <p className="t-meta m-0">—</p>}
                  {s.countries ? <p className="t-small m-0">{c.headers.countries}: <strong>{s.countries}</strong></p> : null}
                </li>
              ))}
            </ul>
          </section>

          <section id="how" className="cs" aria-labelledby="how-h">
            <h2 id="how-h" className="t-h2">{c.schedule.howTitle}</h2>
            <p className="t-body">{c.schedule.how}</p>
          </section>

          {direct.length > 0 && (
            <section id="direct" className="cs" aria-labelledby="direct-h">
              <h2 id="direct-h" className="t-h2">{c.schedule.directTitle}</h2>
              <p className="t-body">{c.schedule.direct(direct.length, direct.map((e) => countryName(e, locale)).join(', '))}</p>
            </section>
          )}

          <RelatedCards heading={c.related.heading(contest.year)} items={hubRelated(hub, 'schedule')} columns={2} />
        </div>
        <aside className="pg-aside">
          <HubPlayCard hub={hub} />
        </aside>
      </div>
      <SiteFooter />
    </>
  );
}

export default function HubSchedulePage() {
  return <HubGate page={(hub) => <ScheduleBody hub={hub} />} />;
}
