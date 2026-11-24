import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import { useTranslation } from 'react-i18next';
import { HeroStats } from '../../components/seo/StageKit';
import { Flag } from '../../components/stage';
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
import { COUNTRY_INDEX } from './archive';

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
  const { t } = useTranslation();
  const groups = groupByInitial(rows);
  const n = rows.length;
  const winners = rows.filter((r) => r.wins > 0).length;
  const record = rows.reduce((m, r) => Math.max(m, r.wins), 0);
  const top = [...rows].filter((r) => r.wins > 0).sort((a, b) => b.wins - a.wins || compareText(a.name, b.name)).slice(0, 6);

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
      <PageHero
        crumbs={crumbs}
        chip={c.chip}
        chipTone="gold"
        title={x.h1}
        grad="Eurovision"
        lede={x.lede(n)}
        aside={<HeroStats items={[
          { v: n, k: t('countriesPage.statCountries') },
          { v: winners, k: t('countriesPage.statWinners'), tone: 'gold' },
          { v: record, k: t('countriesPage.statRecord') },
        ]} />}
      />
      <div className="wrap ctl-body">
        {top.length > 0 && (
          <section className="ctl-top" aria-labelledby="ctl-top-h">
            <h2 id="ctl-top-h" className="t-h2">{t('countriesPage.top')}</h2>
            <ul className="kit-grid c3 ctl-top-grid">
              {top.map((r) => (
                <li key={r.slug}>
                  <LocaleLink to={countryPath(r.slug)} className="card ctl-top-card">
                    <Flag iso={r.iso} size="md" />
                    <span className="ctl-name">{r.name}</span>
                    <span className="num ctl-top-n" aria-label={t('countriesPage.wins', { count: r.wins })}>{r.wins}</span>
                  </LocaleLink>
                </li>
              ))}
            </ul>
          </section>
        )}
        {/* A–Ω index (owner request): jump straight to a letter. */}
        <nav className="ctl-az" aria-label={t('countriesPage.jumpToLetter')}>
          {groups.map((g) => (
            <a key={g.letter} href={`#ctl-g-${g.letter}`} className="num">{g.letter}</a>
          ))}
        </nav>
        <div className="ctl-groups">
          {groups.map((g) => (
            <section key={g.letter} id={`ctl-g-${g.letter}`} className="ctl-group" aria-labelledby={`ctl-${g.letter}`}>
              <h2 id={`ctl-${g.letter}`} className="num ctl-letter">{g.letter}</h2>
              <ul className="ctl-list">
                {g.rows.map((r) => (
                  <li key={r.slug}>
                    <LocaleLink to={countryPath(r.slug)} className="ctl-row">
                      <Flag iso={r.iso} size="md" />
                      <span className="ctl-name">{r.name}</span>
                      {r.wins > 0 && <span className="chip chip-gold ctl-wins">{t('countriesPage.wins', { count: r.wins })}</span>}
                      <span className="ctl-part"><span className="num">{r.participations}</span><span className="t-meta">{t('countriesPage.part')}</span></span>
                      <span className="sr-only">{x.entry(r.participations, r.wins)}</span>
                    </LocaleLink>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
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
