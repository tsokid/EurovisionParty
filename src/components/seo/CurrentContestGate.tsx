import type { ReactNode } from 'react';
import { useCurrentContestState, type CurrentContest } from '../../lib/currentContest';
import { useLocale } from '../../lib/seo/LocaleContext';
import { ContentPending } from '../../pages/contest/ContentPending';

/**
 * Renders `page` with the live contest. Prerendered pages always have it (the
 * server render reads it and inlines the two files); on client-side navigation
 * it shows the loading / retry state until site.json and the contest file arrive.
 */
export default function CurrentContestGate({ page }: { page: (cc: CurrentContest) => ReactNode }) {
  const locale = useLocale();
  const state = useCurrentContestState();
  if (state.status === 'ready') return <>{page(state.data)}</>;
  return <ContentPending locale={locale} retry={state.status === 'error' ? state.retry : undefined} />;
}
