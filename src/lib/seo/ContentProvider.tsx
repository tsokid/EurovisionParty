import type { ReactNode } from 'react';
import { ContentCollectorContext, type ContentCollector } from './contentContext';

/** Server render only: useContent() records every file it reads into `collector`. */
export default function ContentProvider({ collector, children }: { collector: ContentCollector; children: ReactNode }) {
  return <ContentCollectorContext.Provider value={collector}>{children}</ContentCollectorContext.Provider>;
}
