import LocaleLink from './LocaleLink';

export interface Crumb {
  label: string;
  href: string;
}

interface Props {
  items: Crumb[];
}

// Visual breadcrumb. The matching BreadcrumbList JSON-LD is emitted from PageHero
// via the `breadcrumbJsonLd` helper so we have one schema per page.
export default function Breadcrumbs({ items }: Props) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-white/60">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={c.href} className="flex items-center gap-1.5">
              {i === 0 && (
                <svg className="w-3.5 h-3.5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M3 12 12 3l9 9" /><path d="M5 10v10h14V10" />
                </svg>
              )}
              {last ? (
                <span className="text-white/90 font-medium" aria-current="page">{c.label}</span>
              ) : (
                <LocaleLink to={c.href} className="text-white/60 hover:text-white transition">{c.label}</LocaleLink>
              )}
              {!last && <span aria-hidden className="text-white/30">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Helper: build BreadcrumbList JSON-LD for a given crumb trail.
export function breadcrumbJsonLd(items: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      item: c.href.startsWith('http') ? c.href : `https://eurovision.games${c.href}`,
    })),
  };
}
