import type { ReactNode } from 'react';
import { useCmsAttrs } from '../../lib/cms/cmsAttrs';

interface Props {
  id?: string;
  title: string;
  /** The doc path of the title field, for the admin preview's click-to-edit (nothing on the site). */
  cms?: string;
  children: ReactNode;
}

// One H2-led content block. Sets the heading rhythm consistently and gives the
// section an id so we can target it via #anchor for in-page nav and TOCs.
// Consecutive sections are divided by a hairline (Stage boards).
export default function Section({ id, title, cms, children }: Props) {
  const attrs = useCmsAttrs();
  return (
    <section id={id} className="cs">
      <h2 className="t-h2 text-stage-text" {...(cms ? attrs(cms) : undefined)}>{title}</h2>
      <div className="cs-body">{children}</div>
    </section>
  );
}
