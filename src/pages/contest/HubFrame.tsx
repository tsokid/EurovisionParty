/**
 * Shared plumbing for the live-contest hub pages: resolve `/:slug` to the live
 * year, load site.json + contests/{year}.json through useContent (inlined on
 * prerendered pages, fetched on client-side navigation), and render a 404 for
 * anything that is not the live, non-archived contest.
 */
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import type { ContestSnapshot, SiteSnapshot } from '../../content/contests/types';
import { useLocale } from '../../lib/seo/LocaleContext';
import { useContent } from '../../lib/seo/useContent';
import { hubPath, hubYearFromSlug } from '../../lib/seo/dynamicPages';
import { NotFoundPage } from '../NotFoundPage';
import { hubCopy, hubFacts } from './content/hubCopy';
import { ContentPending } from './ContentPending';
import type { Hub } from './hub';

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

/** Render `page` for the live contest; loading state, error or 404 otherwise. */
export function HubGate({ page }: { page: (hub: Hub) => ReactNode }) {
  const locale = useLocale();
  const state = useHub();
  if (state.status === 'ready') return <>{page(state.hub)}</>;
  if (state.status === 'missing') return <NotFoundPage />;
  return <ContentPending locale={locale} retry={state.status === 'error' ? state.retry : undefined} />;
}
