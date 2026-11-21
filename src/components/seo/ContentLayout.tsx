import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  // wide=true gives extra room for tables and timelines
  wide?: boolean;
}

// Unified content shell used inside SEO articles (Stage): the 1200px `.wrap`
// (16px gutters on mobile, 32px from 768px) with an 880px reading column,
// or the full wrap width when `wide`. `.stage-prose` sets the body type.
export default function ContentLayout({ children, wide = false }: Props) {
  return (
    <div className="wrap content">
      <div className={`content-col stage-prose${wide ? ' wide' : ''}`}>
        {children}
      </div>
    </div>
  );
}
