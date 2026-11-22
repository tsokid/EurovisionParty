/** Stage pieces shared by the hub's schedule, semi-finals and songs pages (boards). */
import type { ReactNode } from 'react';
import PageHero from '../../components/seo/PageHero';
import type { Crumb } from '../../components/seo/Breadcrumbs';
import type { RelatedCard } from '../../components/seo/RelatedCards';
import { HeroStats, IconLink, type IconName } from '../../components/seo/StageKit';
import { Button } from '../../components/stage';
import { useDaysUntil } from '../../hooks/useDaysUntil';
import type { Hub } from './hub';

const ddmm = (iso: string) => `${iso.slice(8, 10)}·${iso.slice(5, 7)}`;

/** The three show dates as hero stats (final in gold). */
export function ShowDates({ hub }: { hub: Hub }) {
  const { contest, copy: c } = hub;
  const items = [
    { k: c.shows.semi1, d: contest.dates.semi1 },
    { k: c.shows.semi2, d: contest.dates.semi2 },
    { k: c.shows.final, d: contest.dates.final, gold: true },
  ].filter((x): x is { k: string; d: string; gold?: boolean } => x.d != null);
  if (!items.length) return null;
  return (
    <HeroStats items={items.map((x) => ({
      v: <time dateTime={x.d}>{ddmm(x.d)}</time>,
      k: x.k,
      tone: x.gold ? 'gold' : undefined,
    }))} />
  );
}

/** Days to the final (schedule board), only for an upcoming or current contest. */
export function DaysCard({ hub, label }: { hub: Hub; label: (days: number) => ReactNode }) {
  const { contest } = hub;
  const days = useDaysUntil(contest.dates.final);
  const counting = contest.dates.final != null && (contest.stage === 'upcoming' || contest.stage === 'current');
  if (!counting) return <ShowDates hub={hub} />;
  return (
    <div className="card hs-days">
      <span className="num hs-days-n">{days != null && days >= 0 ? days : ' '}</span>
      <span className="t-small">{label(days ?? 2)}</span>
    </div>
  );
}

/** Hero of the hub sub-pages: gold chip with a live dot, gradient year, aside. */
export function HubSubHero({ hub, crumbs, title, lede, aside }: { hub: Hub; crumbs: Crumb[]; title: string; lede: string; aside?: ReactNode }) {
  const { contest, copy: c } = hub;
  return (
    <PageHero
      crumbs={crumbs}
      chip={<><span className="dot" aria-hidden />{c.chip[contest.stage]}</>}
      chipTone="gold"
      title={title}
      grad={`Eurovision ${contest.year}`}
      lede={lede}
      aside={aside}
      className="hs-hero"
    />
  );
}

const RELATED_ICON = (href: string): IconName =>
  href.endsWith('/schedule') ? 'calendar'
    : href.endsWith('/semifinals') || href.endsWith('/songs') ? 'music'
      : href.includes('winners') ? 'chart'
        : href.includes('countries') ? 'globe'
          : 'list';

/** Related links as the board's aside icon cards (h2 = the old related heading). */
export function HubRelatedAside({ heading, items }: { heading: string; items: RelatedCard[] }) {
  return (
    <section className="hs-related" aria-labelledby="related-heading">
      <h2 id="related-heading" className="t-eyebrow">{heading}</h2>
      <div className="hs-related-list">
        {items.map((it) => (
          <IconLink key={it.href} to={it.href} icon={RELATED_ICON(it.href)} title={it.title} blurb={it.blurb} />
        ))}
      </div>
    </section>
  );
}

/** «Παίξε την Eurovision {y} με την παρέα σου» card (hub board). */
export function HubPlayCard({ hub }: { hub: Hub }) {
  const { contest, copy: c } = hub;
  return (
    <section className="card-hero card-pad hs-play" aria-labelledby="hs-play-title">
      <span className="t-eyebrow">{c.play.eyebrow}</span>
      <h2 id="hs-play-title" className="t-h2">{c.play.title(contest.year)}</h2>
      <ul className="ticks">
        {c.play.points.map((p) => (
          <li key={p}>
            <svg className="tick" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5L20 7" /></svg>
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <Button to="/?action=create" size="lg" block>{c.play.create}</Button>
      <Button to="/how-to-play" variant="ghost" block>{c.play.howTo}</Button>
    </section>
  );
}
