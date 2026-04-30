import { Link } from 'react-router-dom';

export interface RelatedCard {
  href: string;
  title: string;
  blurb: string;
}

interface Props {
  heading?: string;
  items: RelatedCard[];
}

export default function RelatedCards({ heading = 'Keep reading', items }: Props) {
  return (
    <section aria-labelledby="related-heading">
      <h2 id="related-heading" className="text-xl font-bold text-white mb-5">{heading}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((c) => (
          <Link
            key={c.href}
            to={c.href}
            className="group relative rounded-xl border border-white/10 hover:border-euro-pink/50 hover:bg-white/[0.04] transition-all duration-200 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-bold text-white group-hover:text-euro-pink-light transition">{c.title}</h3>
              <svg
                className="w-4 h-4 text-white/30 group-hover:text-euro-pink-light group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0 mt-1"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                aria-hidden
              >
                <path d="M7 17L17 7M17 7H8M17 7v9" />
              </svg>
            </div>
            <p className="mt-2 text-sm text-white/60 leading-relaxed">{c.blurb}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
