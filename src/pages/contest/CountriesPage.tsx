import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import LocaleLink from '../../components/seo/LocaleLink';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import type { CountryIndex, CountryIndexEntry } from '../../content/contests/types';
import { useLocale } from '../../lib/seo/LocaleContext';
import { useContent } from '../../lib/seo/useContent';
import { absoluteUrl } from '../../lib/seo/registry';
import { COUNTRY_INDEX_PATH, countryPath } from '../../lib/seo/dynamicPages';
import type { Locale } from '../../lib/seo/locale';
import { compareText, sortKey } from '../../lib/seo/textSort';
import { NotFoundPage } from '../NotFoundPage';
import { ContentPending } from './ContentPending';
import { countryCopy } from './content/countryCopy';
import { COUNTRY_INDEX, linkClass } from './archive';

interface Row extends CountryIndexEntry {
  slug: string;
  name: string;
}

/** Countries grouped by the first letter of their localized name (diacritics stripped), A–Z. */
function groupByInitial(rows: Row[]): { letter: string; rows: Row[] }[] {
  const groups = new Map<string, Row[]>();
  for (const r of [...rows].sort((a, b) => compareText(a.name, b.name))) {
    const letter = sortKey(r.name).charAt(0).toUpperCase();
    groups.set(letter, [...(groups.get(letter) ?? []), r]);
  }
  return [...groups].map(([letter, rs]) => ({ letter, rows: rs }));
}

function CountriesBody({ index, locale }: { index: CountryIndex; locale: Locale }) {
  const c = countryCopy[locale];
  const x = c.index;
  const rows: Row[] = Object.entries(index).map(([slug, r]) => ({ ...r, slug, name: locale === 'el' ? r.name_el : r.name_en }));
  const groups = groupByInitial(rows);
  const n = rows.length;

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.countries, href: COUNTRY_INDEX_PATH },
  ];
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: x.listName,
    numberOfItems: n,
    itemListElement: groups.flatMap((g) => g.rows).map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absoluteUrl(locale, countryPath(r.slug)),
      name: r.name,
    })),
  };

  return (
    <>
      <PageSeo
        path={COUNTRY_INDEX_PATH}
        locale={locale}
        title={x.title(n)}
        description={x.description(n)}
        ogType="website"
        jsonLd={[itemList, breadcrumbJsonLd(crumbs, locale)]}
      />
      <PageHero crumbs={crumbs} chip={c.chip} chipTone="gold" title={x.h1} lede={x.lede(n)} />
      <ContentLayout wide>
        {groups.map((g) => (
          <Section key={g.letter} title={g.letter}>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
              {g.rows.map((r) => (
                <li key={r.slug} className="flex justify-between gap-4 border-b border-white/10 pb-2">
                  <LocaleLink to={countryPath(r.slug)} className={linkClass}>{r.name}</LocaleLink>
                  <span className="text-white/60 text-sm text-right">{x.entry(r.participations, r.wins)}</span>
                </li>
              ))}
            </ul>
          </Section>
        ))}
      </ContentLayout>
      <SiteFooter />
    </>
  );
}

export default function CountriesPage() {
  const locale = useLocale();
  const index = useContent<CountryIndex>(COUNTRY_INDEX);
  if (index.status === 'ready') return <CountriesBody index={index.data} locale={locale} />;
  if (index.status === 'missing') return <NotFoundPage />;
  return <ContentPending locale={locale} retry={index.status === 'error' ? index.retry : undefined} />;
}
