import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  // wide=true gives extra room for tables and timelines
  wide?: boolean;
}

// Unified content shell used inside SEO articles. Mobile: 16px gutters.
// Desktop: max-w-3xl reading column (or 4xl when `wide`), generous vertical
// rhythm between sections.
export default function ContentLayout({ children, wide = false }: Props) {
  const max = wide ? 'max-w-4xl' : 'max-w-3xl';
  return (
    <div className={`${max} mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20`}>
      <div className="space-y-12 lg:space-y-16 text-[17px] leading-relaxed text-white/80">
        {children}
      </div>
    </div>
  );
}
