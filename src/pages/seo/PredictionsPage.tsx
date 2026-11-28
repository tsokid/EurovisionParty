import { pageModified } from '../../lib/seo/pageDates';
import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import Breadcrumbs from '../../components/seo/Breadcrumbs';
import Chip from '../../components/seo/Chip';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import DataTable from '../../components/seo/DataTable';
import FaqAccordion from '../../components/seo/FaqAccordion';
import CtaBanner from '../../components/seo/CtaBanner';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import { contestPath, useCurrentContest, type CurrentContest } from '../../lib/currentContest';
import type { ContestSnapshot } from '../../content/contests/types';
import { useContent } from '../../lib/seo/useContent';
import { ContentPending } from '../contest/ContentPending';
import type { Locale } from '../../lib/seo/locale';
import { useLocale } from '../../lib/seo/LocaleContext';
import { pageUrl } from '../../lib/seo/registry';
import { hubCopy } from '../contest/content/hubCopy';
import { byCountry, countryCell, numCell, songCell } from '../contest/hub';
import { visibleTable } from '../contest/table';
import LocaleLink from '../../components/seo/LocaleLink';
import { archivePath, hubPath } from '../../lib/seo/dynamicPages';
import { NotAnnounced, lineupAnnounced } from '../contest/NotAnnounced';
import { EntryCards } from '../contest/EntryCards';
import { Button, Flag } from '../../components/stage';
import { SCORING } from '../../lib/constants';
import { contestTexts, type ContestText } from './content/contestText';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { usePageContent } from '../../lib/cms/usePageContent';
import ExtraBlocks from '../../components/cms/ExtraBlocks';
import { mergeFaqJsonLd } from '../../components/cms/extraFaq';
import type { EurovisionPredictionsContent } from '../../../supabase/functions/_shared/cms/schemas/eurovision-predictions';
import { PageContentFallback } from './PageContentFallback';
import { predictionsText, type PredictionsText } from './predictionsText';
import { useSiteSettings } from '../../lib/cms/siteSettings';

// fact: date the page was first published
const PUBLISHED = '2026-04-30T00:00:00Z'; // fact: date the page was first published
/** The page's last change, its line-up included (content/contests), from git: the sitemap's lastmod. */
const MODIFIED = pageModified('eurovision-predictions');

const reload = () => window.location.reload();

/**
 * Stage-layout labels of the page (predictions-after-{m,d} boards) that the
 * CMS doc does not carry: hero meta line and stats, the decorative example
 * card, the scoring card, the timeline and the "in detail" fold (i18n
 * `predictionsGuide`). Points come from SCORING, contest facts from ContestText.
 */
interface PredictionsStageCopy {
  chip: (chip: string, year: number) => string;
  metaShort: (t: ContestText) => string;
  metaLong: (t: ContestText) => string;
  create: string;
  howTo: string;
  stats: { max: string; lists: string; exact: string };
  example: { phase: string; label: string; top5Hint: string; worst5Hint: string; pick: string; pickTail: string; lockNote: string; picks: [string, string] };
  scoring: { eyebrow: string; title: string; body: string; unit: string; max: string; rows: Record<'exact' | 'inList' | 'outside', [string, string]> };
  timeline: { eyebrow: string; title: string; steps: { title: string; body: string }[] };
  detail: string;
}

function stageCopy(t: TFunction): PredictionsStageCopy {
  const k = (key: string) => t(`predictionsGuide.${key}`);
  return {
    chip: (chip, year) => t('predictionsGuide.chip', { chip, year }),
    metaShort: (x) => t('predictionsGuide.metaShort', { city: x.city, finalDay: x.finalDay }),
    metaLong: (x) => t('predictionsGuide.metaLong', { year: x.year, cityIn: x.cityIn, finalDay: x.finalDay }),
    create: k('create'),
    howTo: k('howTo'),
    stats: { max: k('stats.max'), lists: k('stats.lists'), exact: k('stats.exact') },
    example: {
      phase: k('example.phase'),
      label: k('example.label'),
      top5Hint: k('example.top5Hint'),
      worst5Hint: k('example.worst5Hint'),
      pick: k('example.pick'),
      pickTail: k('example.pickTail'),
      lockNote: k('example.lockNote'),
      picks: [k('example.pick1'), k('example.pick2')],
    },
    scoring: {
      eyebrow: k('scoring.eyebrow'),
      title: k('scoring.title'),
      body: k('scoring.body'),
      unit: k('scoring.unit'),
      max: k('scoring.max'),
      rows: {
        exact: [k('scoring.exactTitle'), k('scoring.exactBody')],
        inList: [k('scoring.inListTitle'), k('scoring.inListBody')],
        outside: [k('scoring.outsideTitle'), k('scoring.outsideBody')],
      },
    },
    timeline: {
      eyebrow: k('timeline.eyebrow'),
      title: k('timeline.title'),
      steps: (['party', 'final', 'voting', 'results'] as const).map((s) => ({ title: k(`timeline.${s}Title`), body: k(`timeline.${s}Body`) })),
    },
    detail: k('detail'),
  };
}

const P = SCORING.prediction;
const MAX_TOP5 = P.exactPosition * 5;
const MAX_WORST5 = P.exactWorst * 5;

/**
 * The live contest's entries: the only part of a guide page that needs
 * contests/{year}.json (inlined on the prerendered page, fetched on client
 * navigation). Loading shows a placeholder; a missing file shows the
 * error/retry state, which the prerender check rejects.
 */
function Lineup({ cc, locale, c }: { cc: CurrentContest; locale: Locale; c: PredictionsText['sections']['lineup'] }) {
  const h = hubCopy[locale].headers;
  const file = useContent<ContestSnapshot>(contestPath(cc.year));
  // Crawlable link to the featured contest's page (its archive page once archived: no redirect hop).
  const contestHref = cc.stage === 'archived' ? archivePath(cc.year, cc.citySlug) : hubPath(cc.year);
  const hubLink = (
    <p className="m-0"><LocaleLink to={contestHref} className="hub-more">{c.hubLink} →</LocaleLink></p>
  );

  if (file.status !== 'ready') {
    const retry = file.status === 'error' ? file.retry : file.status === 'missing' ? reload : undefined;
    return (
      <Section id="lineup" title={c.title}>
        <ContentPending locale={locale} retry={retry} inline />
        {hubLink}
      </Section>
    );
  }
  const entries = file.data.entries;

  // Not announced yet (no entry has its artist and song): every country that ever competed.
  if (!lineupAnnounced(entries)) {
    return (
      <Section id="lineup" title={c.title}>
        <NotAnnounced year={cc.year} locale={locale} />
        {hubLink}
      </Section>
    );
  }

  // The final is decided: the ranking with places.
  if ((cc.stage === 'finalized' || cc.stage === 'archived') && entries.some((e) => e.final_place != null)) {
    // Finalists by place, then the semi-final non-qualifiers by country name.
    const finalists = entries.filter((e) => e.final_place != null).sort((a, b) => a.final_place! - b.final_place!);
    const others = byCountry(entries.filter((e) => e.final_place == null), locale);
    const table = visibleTable([...finalists, ...others], [
      { header: h.place, value: (e) => (e.final_place != null ? numCell(e.final_place) : c.notInFinal), align: 'right' },
      { header: h.country, value: (e) => countryCell(e, locale) },
      { header: h.artist, value: (e) => e.artist },
      { header: h.song, value: (e) => songCell(e.song) },
      { header: h.points, value: (e) => numCell(e.total_points, true), align: 'right' },
    ]);
    return (
      <Section id="lineup" title={c.resultsTitle}>
        <p>{c.resultsIntro}</p>
        <DataTable {...table} />
        {hubLink}
      </Section>
    );
  }

  return (
    <Section id="lineup" title={c.title}>
      <p>{c.intro}</p>
      <EntryCards
        entries={entries}
        year={cc.year}
        locale={locale}
        semisKnown={entries.some((e) => e.semi != null)}
        host={{ iso: cc.hostIso, suffix: c.hostSuffix }}
      />
      <p className="t-small m-0">{c.runningOrder}</p>
      {hubLink}
    </Section>
  );
}

/** Decorative example of the two lists (board illustration): static, hidden from assistive tech. */
function ExampleLists({ s }: { s: PredictionsStageCopy }) {
  const ex = s.example;
  const picks = [
    { iso: 'SE', name: ex.picks[0] },
    { iso: 'IT', name: ex.picks[1] },
  ];
  const list = (title: string, hint: string, tone: string, filled: typeof picks) => (
    <div className="pred-list">
      <div className="pred-list-head">
        <span className="pred-list-title" style={{ color: tone }}>{title}</span>
        <span className="t-meta text-xs">{hint}</span>
      </div>
      <ol className="pred-slots">
        {[0, 1, 2, 3, 4].map((i) => {
          const pick = filled[i];
          return (
            <li key={i} className={pick ? 'pred-slot filled' : 'pred-slot'}>
              <span className="num pred-slot-n" style={{ color: tone }}>{i + 1}</span>
              {pick ? <Flag iso={pick.iso} size="sm" className="pred-slot-flag" /> : <span className="pred-slot-flag empty" />}
              {pick ? (
                <span className="pred-slot-name">{pick.name}</span>
              ) : (
                <span className="pred-slot-empty">{ex.pick}<span className="hidden lg:inline">{ex.pickTail}</span></span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
  return (
    <div className="card pred-example" aria-hidden>
      <div className="flex items-center gap-2.5">
        <span className="phase text-stage-live whitespace-nowrap"><span className="dot" />{ex.phase}</span>
        <span className="spacer" />
        <span className="chip h-6 text-xs">{ex.label}</span>
      </div>
      <div className="pred-lists">
        {list('Top 5', ex.top5Hint, 'var(--color-stage-gold)', picks)}
        {list('Worst 5', ex.worst5Hint, 'var(--color-stage-pink-2)', [])}
      </div>
      <div className="pred-lock t-small">
        <svg className="text-stage-text-3 shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        <span>{ex.lockNote}</span>
      </div>
    </div>
  );
}

function PredictionsHero({ crumbs, c, s, live, cc }: { crumbs: Crumb[]; c: PredictionsText; s: PredictionsStageCopy; live: ContestText; cc: CurrentContest }) {
  const h1 = c.hero.title;
  // The gradient takes the part after the dash or colon; the H1 text stays the CMS title.
  const cut = Math.max(h1.lastIndexOf('— '), h1.lastIndexOf(': '));
  return (
    <header className="hero pred-hero">
      <div className="wrap pred-hero-grid">
        <div className="pred-hero-text">
          <Breadcrumbs items={crumbs} />
          <Chip tone="pink">{s.chip(c.hero.chip, live.year)}</Chip>
          <h1 className="pred-title">
            {cut > 0 ? (
              <>
                {h1.slice(0, cut + 2)}
                <span className="grad lg:block">{h1.slice(cut + 2)}</span>
              </>
            ) : h1}
          </h1>
          <p className="hero-lede">{c.hero.lede}</p>
          <p className="pred-meta t-meta">
            <Flag iso={cc.hostIso} size="sm" />
            <span className="lg:hidden">{s.metaShort(live)}</span>
            <span className="hidden lg:inline">{s.metaLong(live)}</span>
          </p>
          <div className="pred-actions">
            <Button to="/?action=create" size="lg" className="w-full lg:w-auto">{s.create}</Button>
            <Button to="/how-to-play" variant="ghost" size="lg" className="hidden lg:inline-flex">{s.howTo}</Button>
          </div>
          <dl className="pred-stats">
            <div><dt className="t-meta">{s.stats.max}</dt><dd className="num text-stage-gold">{MAX_TOP5 + MAX_WORST5}</dd></div>
            <div><dt className="t-meta">{s.stats.lists}</dt><dd className="num">2×5</dd></div>
            <div><dt className="t-meta">{s.stats.exact}</dt><dd className="num">{P.exactPosition}</dd></div>
          </dl>
        </div>
        <ExampleLists s={s} />
      </div>
    </header>
  );
}

function ScoringCard({ s }: { s: PredictionsStageCopy }) {
  const rows = [
    { pts: P.exactPosition, row: s.scoring.rows.exact, tone: 'gold' },
    { pts: P.inTop5, row: s.scoring.rows.inList, tone: '' },
    { pts: 0, row: s.scoring.rows.outside, tone: 'muted' },
  ];
  return (
    <section className="pred-scoring" aria-labelledby="pred-scoring-title">
      <div className="pred-scoring-intro">
        <span className="t-eyebrow">{s.scoring.eyebrow}</span>
        <h2 id="pred-scoring-title" className="t-h2 text-stage-text pred-h2">{s.scoring.title}</h2>
        <p className="t-body">{s.scoring.body}</p>
        <div className="pred-max">
          <div><div className="num pred-max-v">{MAX_TOP5}</div><div className="t-meta text-xs">Top 5</div></div>
          <span className="num pred-max-op" aria-hidden>+</span>
          <div><div className="num pred-max-v">{MAX_WORST5}</div><div className="t-meta text-xs">Worst 5</div></div>
          <span className="num pred-max-op" aria-hidden>=</span>
          <div><div className="num pred-max-v text-stage-gold">{MAX_TOP5 + MAX_WORST5}</div><div className="t-meta text-xs">{s.scoring.max}</div></div>
        </div>
      </div>
      <ul className="card pred-rows">
        {rows.map((r) => (
          <li key={r.pts} className={`pred-row ${r.tone}`}>
            <div className="pred-row-pts">
              <div className="num pred-row-v">{r.pts}</div>
              <div className="t-meta pred-row-unit">{s.scoring.unit}</div>
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-stage-text">{r.row[0]}</div>
              <div className="t-small">{r.row[1]}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const STEP_ICONS = [
  <><circle key="c" cx="12" cy="12" r="9" /><path key="p" d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01" /></>,
  <path key="l" d="M4 6h16M4 12h10M4 18h7" />,
  <><rect key="r" x="5" y="11" width="14" height="10" rx="2" /><path key="p" d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  <path key="t" d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" />,
];
const STEP_TONES = ['', '', 'live', 'gold'];

function Timeline({ s }: { s: PredictionsStageCopy }) {
  return (
    <section className="pred-timeline" aria-labelledby="pred-timeline-title">
      <div>
        <span className="t-eyebrow">{s.timeline.eyebrow}</span>
        <h2 id="pred-timeline-title" className="t-h2 text-stage-text pred-h2 mt-2">{s.timeline.title}</h2>
      </div>
      <ol className="pred-steps">
        {s.timeline.steps.map((st, i) => (
          <li key={st.title} className="pred-step">
            <span className={`pred-step-ico ${STEP_TONES[i]}`} aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{STEP_ICONS[i]}</svg>
            </span>
            <div className="min-w-0">
              <div className="font-semibold text-stage-text">{st.title}</div>
              <div className="t-small">{st.body}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

const FoldChevron = () => (
  <svg className="fold-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export default function PredictionsPage() {
  const locale = useLocale();
  const settings = useSiteSettings();
  const cc = useCurrentContest();
  const { t } = useTranslation();
  const content = usePageContent<EurovisionPredictionsContent>('eurovision-predictions');
  if (content.status !== 'ready') return <PageContentFallback state={content} />;
  const live = contestTexts(cc)[locale];
  const c = predictionsText(content.data, live);
  const st = stageCopy(t);

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.predictions, href: '/eurovision-predictions' },
  ];

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: c.meta.schemaTitle,
    description: c.meta.schemaDescription,
    image: settings.defaultOgImage,
    author: { '@type': 'Organization', name: settings.organization.name, url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: settings.organization.name,
      logo: { '@type': 'ImageObject', url: settings.organization.logo },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl('eurovision-predictions', locale) },
  };
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: c.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <>
      <PageSeo
        pageId="eurovision-predictions"
        locale={locale}
        title={c.meta.title}
        description={c.meta.description}
        ogType="article"
        ogImage={settings.defaultOgImage}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={c.meta.keywords}
        jsonLd={mergeFaqJsonLd([article, faqJsonLd, breadcrumbJsonLd(crumbs, locale)], content.data.extraBlocks)}
      />

      <PredictionsHero crumbs={crumbs} c={c} s={st} live={live} cc={cc} />

      <ContentLayout wide>
        <ScoringCard s={st} />

        <Timeline s={st} />

        <Lineup cc={cc} locale={locale} c={c.sections.lineup} />

        <Section title={c.sections.strategy.title}>
          <ol className="pred-tips">
            {c.sections.strategy.tips.map((tip, i) => (
              <li key={i} className="card pred-tip">
                <span className="num pred-tip-n" aria-hidden>{i + 1}</span>
                <div className="min-w-0">
                  <h3 className="pred-tip-title">{tip.strong}</h3>
                  <p className="t-small m-0 mt-1.5">{tip.rest.trim()}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {/* The CMS format and scoring sections, folded below the board's sections. */}
        <details className="card fold pred-detail">
          <summary className="fold-sum">
            <span className="flex-1">{st.detail}</span>
            <FoldChevron />
          </summary>
          <div className="fold-body pred-detail-body">
            <Section title={c.sections.format.title}>
              <p>{c.sections.format.intro}</p>
              <ul className="list-disc pl-6 space-y-1.5">
                <li><strong>{c.sections.format.top5Label}</strong> — {c.sections.format.top5Body}</li>
                <li><strong>{c.sections.format.worst5Label}</strong> — {c.sections.format.worst5Body}</li>
              </ul>
              <p>
                {c.sections.format.orderedPre}
                <strong>{c.sections.format.orderedEm}</strong>
                {c.sections.format.orderedPost}
              </p>
            </Section>

            <Section title={c.sections.scoringTop5.title}>
              <p>{c.sections.scoringTop5.intro}</p>
              <DataTable
                headers={[c.sections.scoringTop5.headers.result, c.sections.scoringTop5.headers.points]}
                align={['left', 'right']}
                rows={[
                  [c.sections.scoringTop5.rows.exact, <strong key="a" className="text-stage-text">{P.exactPosition}</strong>],
                  [c.sections.scoringTop5.rows.inListWrong, <strong key="b" className="text-stage-text">{P.inTop5}</strong>],
                  [c.sections.scoringTop5.rows.outside, <span key="c" className="text-stage-text-3">0</span>],
                ]}
              />
              <p>
                {c.sections.scoringTop5.max.pre}
                <strong>{c.sections.scoringTop5.max.post}</strong>.
              </p>
            </Section>

            <Section title={c.sections.scoringWorst5.title}>
              <p>{c.sections.scoringWorst5.intro}</p>
              <DataTable
                headers={[c.sections.scoringWorst5.headers.result, c.sections.scoringWorst5.headers.points]}
                align={['left', 'right']}
                rows={[
                  [c.sections.scoringWorst5.rows.exact, <strong key="a" className="text-stage-text">{P.exactWorst}</strong>],
                  [c.sections.scoringWorst5.rows.inListWrong, <strong key="b" className="text-stage-text">{P.inWorst5}</strong>],
                  [c.sections.scoringWorst5.rows.outside, <span key="c" className="text-stage-text-3">0</span>],
                ]}
              />
              <p>
                {c.sections.scoringWorst5.max.pre}
                <strong>{c.sections.scoringWorst5.max.cap}</strong>.
              </p>
            </Section>
          </div>
        </details>

        <Section title={c.sections.faqTitle}>
          <FaqAccordion items={c.faq} />
        </Section>

        <ExtraBlocks value={content.data.extraBlocks} />

        <CtaBanner
          title={c.cta.title}
          body={c.cta.body}
          primary={{ label: c.cta.primary, href: '/?action=create' }}
          secondary={{ label: c.cta.secondary, href: '/how-to-play' }}
        />

        <RelatedCards
          items={[
            { href: '/eurovision-night', title: c.related.night.title, blurb: c.related.night.blurb },
            { href: '/eurovision-trivia', title: c.related.trivia.title, blurb: c.related.trivia.blurb },
            { href: '/duels', title: c.related.duels.title, blurb: c.related.duels.blurb },
            { href: '/scoring', title: c.related.scoring.title, blurb: c.related.scoring.blurb },
            { href: '/how-to-play', title: c.related.howToPlay.title, blurb: c.related.howToPlay.blurb },
            { href: '/faq', title: c.related.faq.title, blurb: c.related.faq.blurb },
          ]}
        />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
