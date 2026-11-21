/**
 * Shared plumbing for the live-contest hub pages: resolve `/:slug` to the live
 * year, load site.json + contests/{year}.json through useContent (inlined on
 * prerendered pages, fetched on client-side navigation), and render a 404 for
 * anything that is not the live, non-archived contest. The frame also owns
 * the hub's section menu (Overview / Schedule / Semi-finals / Songs), which
 * every hub page shows at the bottom of its hero.
 */
import type { ReactNode } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import LocaleLink from '../../components/seo/LocaleLink';
import { PageHeroSlot } from '../../components/seo/PageHero';
import type { ContestSnapshot, SiteSnapshot } from '../../content/contests/types';
import { useLocale } from '../../lib/seo/LocaleContext';
import { useContent } from '../../lib/seo/useContent';
import { hubPath, hubYearFromSlug } from '../../lib/seo/dynamicPages';
import { NotFoundPage } from '../NotFoundPage';
import { hubCopy, hubFacts } from './content/hubCopy';
import { ContentPending } from './ContentPending';
import type { Hub, HubSubpage } from './hub';

type HubState =
  | { status: 'ready'; hub: Hub }
  | { status: 'loading' | 'missing' }
  | { status: 'error'; retry: () => void };

function useHub(): HubState {
  const { slug } = useParams<{ slug: string }>();
  const locale = useLocale();
  const year = hubYearFromSlug(slug);
  const site = useContent<SiteSnapshot>(year ? 'site.json' : null);
  const isLive = site.status === 'ready' && site.data.current_year === year;
  const contest = useContent<ContestSnapshot>(isLive ? `contests/${year}.json` : null);

  if (site.status !== 'ready') return site;
  if (!isLive) return { status: 'missing' };
  if (contest.status !== 'ready') return contest;
  if (contest.data.stage === 'archived') return { status: 'missing' };
  const c = contest.data;
  return {
    status: 'ready',
    hub: { contest: c, locale, facts: hubFacts(c, locale), copy: hubCopy[locale], base: hubPath(c.year) },
  };
}

const SUBPAGES: { key: HubSubpage | 'hub'; suffix: string }[] = [
  { key: 'hub', suffix: '' },
  { key: 'schedule', suffix: '/schedule' },
  { key: 'semis', suffix: '/semifinals' },
  { key: 'songs', suffix: '/songs' },
];

/** The hub's section menu (Stage `.seg`); the current page is marked with aria-current. */
export function HubSubNav({ hub }: { hub: Hub }) {
  const { pathname } = useLocation();
  const { copy, base, contest } = hub;
  const labels = { hub: copy.nav.overview, schedule: copy.nav.schedule, semis: copy.nav.semis, songs: copy.nav.songs };
  const path = pathname.replace(/\/+$/, '');
  const current = SUBPAGES.find((s) => s.suffix && path.endsWith(`${base}${s.suffix}`))?.key ?? 'hub';
  return (
    <nav className="seg hub-nav" aria-label={copy.nav.label(contest.year)}>
      {SUBPAGES.map((s) => (
        <LocaleLink
          key={s.key}
          to={`${base}${s.suffix}`}
          className={s.key === current ? 'on' : undefined}
          aria-current={s.key === current ? 'page' : undefined}
        >
          {labels[s.key]}
        </LocaleLink>
      ))}
    </nav>
  );
}

/** Render `page` for the live contest; loading state, error or 404 otherwise. */
export function HubGate({ page }: { page: (hub: Hub) => ReactNode }) {
  const locale = useLocale();
  const state = useHub();
  if (state.status === 'ready') {
    return <PageHeroSlot.Provider value={<HubSubNav hub={state.hub} />}>{page(state.hub)}</PageHeroSlot.Provider>;
  }
  if (state.status === 'missing') return <NotFoundPage />;
  return <ContentPending locale={locale} retry={state.status === 'error' ? state.retry : undefined} />;
}
