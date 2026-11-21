import LocaleLink from './LocaleLink';

export interface RelatedCard {
  href: string;
  title: string;
  blurb: string;
}

interface Props {
  heading?: string;
  items: RelatedCard[];
  /** Desktop columns (the hub boards use 4). */
  columns?: 3 | 4;
}

// "Keep reading" links as Stage `.card-link` rows (home board pattern).
export default function RelatedCards({ heading = 'Keep reading', items, columns = 3 }: Props) {
  return (
    <section aria-labelledby="related-heading" className="flex flex-col gap-3.5">
      <h2 id="related-heading" className="t-h2 text-stage-text">{heading}</h2>
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${columns === 4 ? 'lg:grid-cols-4 lg:gap-4' : 'lg:grid-cols-3'}`}>
        {items.map((c) => (
          <LocaleLink key={c.href} to={c.href} className="card-link text-stage-text no-underline">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold leading-snug text-stage-text m-0">{c.title}</h3>
              <p className="t-small mt-1 mb-0">{c.blurb}</p>
            </div>
            <svg className="shrink-0 self-center text-stage-text-3" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 6l6 6-6 6" />
            </svg>
          </LocaleLink>
        ))}
      </div>
    </section>
  );
}
