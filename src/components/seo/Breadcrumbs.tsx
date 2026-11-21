import LocaleLink from './LocaleLink';
import { absoluteUrl } from '../../lib/seo/registry';
import type { Locale } from '../../lib/seo/locale';

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
    <nav aria-label="Breadcrumb" className="crumb">
      <ol>
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={c.href}>
              {last ? (
                <span aria-current="page">{c.label}</span>
              ) : (
                <LocaleLink to={c.href}>{c.label}</LocaleLink>
              )}
              {!last && <span aria-hidden>›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Helper: build BreadcrumbList JSON-LD for a given crumb trail. Crumb hrefs are
// unprefixed (LocaleLink style); items are emitted as `locale`-prefixed URLs.
export function breadcrumbJsonLd(items: Crumb[], locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      item: c.href.startsWith('http') ? c.href : absoluteUrl(locale, c.href),
    })),
  };
}
