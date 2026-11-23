import { useParams } from 'react-router-dom';
import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import Section from '../../components/seo/Section';
import { Flag } from '../../components/stage';
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
import { countryCopy, countryFacts, countryUi } from './content/countryCopy';
import { archiveUi, ordinal } from './content/archiveCopy';
import { cityName } from './content/hubCopy';
import { completedContests, CONTEST_INDEX, COUNTRY_INDEX, yearRail, yearPath } from './archive';
import { byDecade, type ResultColumn } from './table';
import ResultsTable, { AnchorNav, Lead } from './ResultsTable';
import { DecadeBlock, LinkCard } from './StageBits';
import { EditorialBlocks, EditorialTop } from './EditorialLayer';
import { editorialDescription, useEditorial } from './editorialContent';
import { mergeFaqJsonLd } from '../../components/cms/extraFaq';
import { editorialDocId } from '../../../supabase/functions/_shared/cms/pagesIndex';

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
  const u = countryUi[locale];
  const au = archiveUi[locale];
  const completed = new Set(completedContests(contests).map((c) => c.year));
  const f = countryFacts(country, locale, completed);
  const path = countryPath(slug);
  const editorial = useEditorial(editorialDocId('country', country.iso));
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
  /** "10η" with a small raised suffix (the suffix stays small next to the numeral). */
  const ord = (n: number) => <>{n}<span className="ord">{ordinal(n, locale).slice(String(n).length)}</span></>;
  const out = (p: CountryParticipation) => !p.cancelled && p.final_place === null && k.result(p) !== null;
  // A non-qualifier without a recorded semi-final keeps the full result text ("Out in the semi-finals").
  const phase = (p: CountryParticipation) =>
    p.cancelled ? null : p.final_place !== null ? u.final : out(p) ? (p.semi !== null ? u.semiOut(p) : k.result(p)) : null;
  const columns: ResultColumn<CountryParticipation>[] = [
    { header: k.headers.year, role: 'pos', cell: (p) => yearRail(p.year, yearPath(p.year, contests[String(p.year)])) },
    {
      header: `${k.headers.artist} · ${k.headers.song}`,
      role: 'main',
      cell: (p) => {
        const town = city(p);
        if (!p.artist && !p.song) return null;
        return (
          <Lead
            title={p.artist ?? '—'}
            sub={<>{p.song && <em>{p.song}</em>}{town && <span className="rt-mob">{p.song ? ' · ' : ''}{town}</span>}</>}
          />
        );
      },
    },
    { header: k.headers.city, role: 'desk', cell: city },
    {
      header: u.place,
      role: 'pts',
      cell: (p) => {
        if (p.cancelled) return <span className="chip rt-chip">{u.cancelled}</span>;
        if (p.final_place !== null) return ord(p.final_place);
        if (out(p)) return <span className="chip chip-bad rt-chip">{u.outOfFinal}</span>;
        return null;
      },
    },
    { header: u.phase, role: 'desk', cell: phase },
    {
      header: k.headers.points,
      role: 'aux',
      cell: (p) => {
        if (p.points !== null) return <><span className="rt-aux-v">{p.points}</span><span className="rt-unit"> {u.pointsUnit}</span></>;
        const ph = phase(p);
        return ph && p.final_place === null ? <><span className="rt-unit">{ph}</span><span className="rt-unit-d">—</span></> : null;
      },
    },
  ];
  const tone = (p: CountryParticipation) =>
    p.cancelled ? 'muted' as const : p.final_place === 1 && completed.has(p.year) ? 'p1' as const : null;
  const newestFirst = [...country.participations].reverse();
  const wins = country.participations.filter((p) => f.winYears.includes(p.year));
  const podium = country.participations.filter(
    (p) => !p.cancelled && completed.has(p.year) && p.final_place !== null && p.final_place > 1 && p.final_place <= 3,
  );
  const decades = byDecade(country.participations, (p) => p.year);

  const bySlugIso = new Map(Object.entries(countries).map(([s, row]) => [row.iso, { slug: s, row }]));
  const related = country.related_iso
    .map((iso) => bySlugIso.get(iso))
    .filter((r): r is NonNullable<typeof r> => r !== undefined)
    .sort((a, b) => compareText(name(a.row), name(b.row)));

  const summary: { label: string; value: string | number; gold?: boolean }[] = [
    { label: k.summary.participations, value: f.participations },
    { label: f.wins > 0 ? `${k.summary.wins}, ${f.winYears.join(', ')}` : k.summary.wins, value: f.wins, gold: f.wins > 0 },
    ...(f.bestPlace !== null ? [{ label: k.summary.bestPlace, value: f.bestPlace }] : []),
    ...(f.first !== null ? [{ label: k.summary.firstYear, value: f.first }] : []),
  ];

  const summaryBlock = (
    <section id="summary" className="ctry-summary" aria-labelledby="summary-h">
      <h2 id="summary-h" className="t-eyebrow">{k.summaryTitle}</h2>
      <dl className="ctry-stats">
        {summary.map((s) => (
          <div key={s.label} className="stat">
            <dt className="k">{s.label}</dt>
            <dd className={s.gold ? 'v num text-stage-gold' : 'v num'}>{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );

  return (
    <>
      <PageSeo
        path={path}
        locale={locale}
        title={k.title(f)}
        description={editorialDescription(editorial, k.description(f))}
        robots={indexable ? undefined : 'noindex'}
        ogType="website"
        jsonLd={mergeFaqJsonLd<object>([breadcrumbJsonLd(crumbs, locale)], editorial?.blocks)}
      />

      <PageHero
        crumbs={crumbs}
        chip={c.chip}
        chipTone="gold"
        title={k.h1(f)}
        lede={k.lede(f)}
        titleLead={<Flag iso={country.iso} size="lg" className="ctry-flag" />}
        aside={summaryBlock}
      />

      <div className="wrap pg-body">
        <div className="pg-main">
          <EditorialTop editorial={editorial} />

          <Section id="last-10" title={k.lastTenTitle}>
            <ResultsTable columns={columns} rows={newestFirst.slice(0, 10)} rowKey={(p) => p.year} tone={tone} className="rt-ctry rt-years" />
          </Section>

          <Section id="history" title={k.historyTitle}>
            <AnchorNav label={au.decadesNav} items={decades.map((d) => ({ id: d.id, label: d.short }))} />
            <div className="dec-list">
              {decades.map((d) => (
                <DecadeBlock key={d.id} id={d.id} label={d.label}>
                  <ResultsTable columns={columns} rows={d.rows} rowKey={(p) => p.year} tone={tone} className="rt-ctry rt-years" />
                </DecadeBlock>
              ))}
            </div>
          </Section>

          <EditorialBlocks editorial={editorial} />

          {related.length > 0 && (
            <Section id="see-also" title={k.seeAlsoTitle}>
              <p>{k.seeAlso}</p>
              <ul className="see-also">
                {related.map(({ slug: s, row }) => (
                  <li key={s}>
                    <LocaleLink to={countryPath(s)} className="chip see-also-chip">
                      <Flag iso={row.iso} size="sm" />
                      {name(row)}
                    </LocaleLink>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <aside className="pg-aside">
          {wins.length > 0 && (
            <section id="wins" className="card card-hero ctry-wins m-first" aria-labelledby="wins-h">
              <h2 id="wins-h" className="chip chip-gold ctry-wins-chip">{k.winsTitle(wins.length)}</h2>
              <table role="table" className="ctry-wins-t">
                <thead role="rowgroup" className="sr-only">
                  <tr role="row">
                    <th role="columnheader">{k.headers.year}</th>
                    <th role="columnheader">{k.headers.artist}</th>
                    <th role="columnheader">{k.headers.song}</th>
                    <th role="columnheader">{k.headers.city}</th>
                    <th role="columnheader">{k.headers.points}</th>
                  </tr>
                </thead>
                <tbody role="rowgroup">
                  {wins.map((p) => {
                    const to = yearPath(p.year, contests[String(p.year)]);
                    return (
                      <tr key={p.year} role="row">
                        <td role="cell" className="cw-year num">
                          {to ? <LocaleLink to={to}>{p.year}</LocaleLink> : p.year}
                        </td>
                        <td role="cell" className="cw-artist">{p.artist ?? '—'}</td>
                        <td role="cell" className="cw-song">{p.song ? <em>{p.song}</em> : '—'}</td>
                        <td role="cell" className="cw-city t-meta">{city(p) ?? '—'}</td>
                        <td role="cell" className="cw-pts">
                          {p.points !== null && <><span className="num">{p.points}</span><span className="t-meta">{u.pointsUnit}</span></>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}

          {podium.length > 0 && (
            <div className="card podium">
              <h3 className="t-h3">{u.podiumTitle}</h3>
              <ul>
                {podium.map((p) => {
                  const to = yearPath(p.year, contests[String(p.year)]);
                  return (
                    <li key={p.year}>
                      <span className="num podium-y">{to ? <LocaleLink to={to}>{p.year}</LocaleLink> : p.year}</span>
                      <span className="podium-who">
                        <span className="podium-a">{p.artist}</span>
                        {p.song && <em className="t-small">{p.song}</em>}
                      </span>
                      <span className="podium-r">
                        <span className="num">{ord(p.final_place!)}</span>
                        {p.points !== null && <span className="t-meta">{p.points} {u.pointsUnit}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <LinkCard to={COUNTRY_INDEX_PATH} icon="globe" title={k.allCountries} blurb={archiveUi[locale].links.countries.blurb} />
        </aside>
      </div>
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
