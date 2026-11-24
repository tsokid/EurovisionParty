import type { ReactNode } from 'react';

/**
 * Full-width closing zone under a main + aside page body (owner, 24 Nov 2026:
 * "two zones"). The CTA banner and the related cards live here, so they use
 * the whole width instead of a narrow column next to an empty aside.
 */
export default function PageTail({ children }: { children: ReactNode }) {
  return <div className="wrap pg-tail">{children}</div>;
}
