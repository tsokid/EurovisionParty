import type { ReactNode } from 'react';

interface Props {
  id?: string;
  title: string;
  children: ReactNode;
}

// One H2-led content block. Sets the heading rhythm consistently and gives the
// section an id so we can target it via #anchor for in-page nav and TOCs.
// Consecutive sections are divided by a hairline (Stage boards).
export default function Section({ id, title, children }: Props) {
  return (
    <section id={id} className="cs">
      <h2 className="t-h2 text-stage-text">{title}</h2>
      <div className="cs-body">{children}</div>
    </section>
  );
}
