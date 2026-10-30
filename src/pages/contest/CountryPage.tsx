import { useParams } from 'react-router-dom';
import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import DataTable from '../../components/seo/DataTable';
import LocaleLink from '../../components/seo/LocaleLink';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import type { ContestIndex, CountryIndex, CountryParticipation, CountrySnapshot } from '../../content/contests/types';
import { useLocale } from '../../lib/seo/LocaleContext';
import { useContent } from '../../lib/seo/useContent';
import { COUNTRY_INDEX_PATH, countryPath } from '../../lib/seo/dynamicPages';
import type { Locale } from '../../lib/seo/locale';
import { compareText } from '../../lib/seo/textSort';
import { NotFoundPage } from '../NotFoundPage';
import { ContentPending } from './ContentPending';
import { countryCopy, countryFacts } from './content/countryCopy';
import { cityName } from './content/hubCopy';
import { numCell, songCell } from './hub';
import { CONTEST_INDEX, COUNTRY_INDEX, linkClass, yearCell, yearPath } from './archive';
import { visibleTable } from './table';

interface CountryData {
  slug: string;
  country: CountrySnapshot;
  indexable: boolean;
  countries: CountryIndex;
  contests: ContestIndex;
}

type State = { status: 'ready'; data: CountryData } | { status: 'loading' | 'missing' } | { status: 'error'; retry: () => void };

/** Slug → ISO via countries/index.json → countries/{iso}.json, plus contests/index.json for year links. */
function useCountry(): State {
  const { slug } = useParams<{ slug: string }>();
  const countries = useContent<CountryIndex>(slug ? COUNTRY_INDEX : null);
  const row = countries.status === 'ready' && slug && Object.hasOwn(countries.data, slug) ? countries.data[slug] : null;
  const country = useContent<CountrySnapshot>(row ? `countries/${row.iso}.json` : null);
  const contests = useContent<ContestIndex>(row ? CONTEST_INDEX : null);

  if (countries.status !== 'ready') return countries;
  if (!row || !slug) return { status: 'missing' };
  if (country.status !== 'ready') return country;
  if (contests.status !== 'ready') return contests;
  return {
    status: 'ready',
    data: { slug, country: country.data, indexable: row.indexable, countries: countries.data, contests: contests.data },
  };
}

function CountryBody({ data, locale }: { data: CountryData; locale: Locale }) {
  const { slug, country, indexable, countries, contests } = data;
  const c = countryCopy[locale];
  const k = c.country;
  const archived = new Set(Object.entries(contests).filter(([, c]) => c.stage === 'archived').map(([y]) => Number(y)));
  const f = countryFacts(country, locale, archived);
  const path = countryPath(slug);
  const name = (x: { name_en: string; name_el: string }) => (locale === 'el' ? x.name_el : x.name_en);

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.countries, href: COUNTRY_INDEX_PATH },
    { label: f.name, href: path },
  ];

  const city = (p: CountryParticipation) => {
    const row = contests[String(p.year)];
    return row ? cityName(locale, p.city_slug, row.city).name : null;
  };
  const columns = [
    { header: k.headers.year, value: (p: CountryParticipation) => yearCell(p.year, yearPath(p.year, contests[String(p.year)])) },
    { header: k.headers.city, value: city },
    { header: k.headers.artist, value: (p: CountryParticipation) => p.artist },
    { header: k.headers.song, value: (p: CountryParticipation) => songCell(p.song) },
    { header: k.headers.result, value: (p: CountryParticipation) => k.result(p) },
    { header: k.headers.points, value: (p: CountryParticipation) => numCell(p.points, true), align: 'right' as const },
  ];
  const newestFirst = [...country.participations].reverse();
  const wins = country.participations.filter((p) => f.winYears.includes(p.year));

  const bySlugIso = new Map(Object.entries(countries).map(([s, row]) => [row.iso, { slug: s, row }]));
  const related = country.related_iso
    .map((iso) => bySlugIso.get(iso))
    .filter((r): r is NonNullable<typeof r> => r !== undefined)
    .sort((a, b) => compareText(name(a.row), name(b.row)));

  const summary: [string, string | number][] = [
    [k.summary.participations, f.participations],
    [k.summary.wins, f.wins],
    ...(f.bestPlace !== null ? [[k.summary.bestPlace, f.bestPlace] as [string, number]] : []),
    ...(f.first !== null ? [[k.summary.firstYear, f.first] as [string, number]] : []),
  ];

  return (
    <>
      <PageSeo
        path={path}
        locale={locale}
        title={k.title(f)}
        description={k.description(f)}
        robots={indexable ? undefined : 'noindex'}
        ogType="website"
        jsonLd={[breadcrumbJsonLd(crumbs, locale)]}
      />

      <PageHero crumbs={crumbs} chip={c.chip} chipTone="gold" title={k.h1(f)} lede={k.lede(f)} />

      <ContentLayout wide>
        <Section id="summary" title={k.summaryTitle}>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {summary.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-white/10 pb-2">
                <dt className="text-white/60">{label}</dt>
                <dd className="font-semibold text-white text-right tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </Section>

        {wins.length > 0 && (
          <Section id="wins" title={k.winsTitle(wins.length)}>
            <DataTable {...visibleTable(wins, columns.filter((col) => col.header !== k.headers.result))} />
          </Section>
        )}

        <Section id="last-10" title={k.lastTenTitle}>
          <DataTable {...visibleTable(newestFirst.slice(0, 10), columns)} />
        </Section>

        <Section id="history" title={k.historyTitle}>
          <DataTable {...visibleTable(country.participations, columns)} />
        </Section>

        {related.length > 0 && (
          <Section id="see-also" title={k.seeAlsoTitle}>
            <p>{k.seeAlso}</p>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {related.map(({ slug: s, row }) => (
                <li key={s}><LocaleLink to={countryPath(s)} className={linkClass}>{name(row)}</LocaleLink></li>
              ))}
            </ul>
          </Section>
        )}

        <p><LocaleLink to={COUNTRY_INDEX_PATH} className={linkClass}>{k.allCountries} →</LocaleLink></p>
      </ContentLayout>
      <SiteFooter />
    </>
  );
}

export default function CountryPage() {
  const locale = useLocale();
  const state = useCountry();
  if (state.status === 'ready') return <CountryBody data={state.data} locale={locale} />;
  if (state.status === 'missing') return <NotFoundPage />;
  return <ContentPending locale={locale} retry={state.status === 'error' ? state.retry : undefined} />;
}
