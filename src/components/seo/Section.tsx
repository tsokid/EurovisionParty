import type { ReactNode } from 'react';

interface Props {
  id?: string;
  title: string;
  children: ReactNode;
}

// One H2-led content block. Sets the heading rhythm consistently and gives the
// section an id so we can target it via #anchor for in-page nav and TOCs.
export default function Section({ id, title, children }: Props) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-5">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
