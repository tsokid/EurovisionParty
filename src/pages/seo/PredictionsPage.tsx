import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
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
import { compareText } from '../../lib/seo/textSort';
import { countryName, hubCopy } from '../contest/content/hubCopy';
import { byCountry, countryCell, numCell, songCell } from '../contest/hub';
import { visibleTable } from '../contest/table';
import LocaleLink from '../../components/seo/LocaleLink';
import { hubPath } from '../../lib/seo/dynamicPages';
import { contestTexts } from './content/contestText';
import { usePageContent } from '../../lib/cms/usePageContent';
import ExtraBlocks from '../../components/cms/ExtraBlocks';
import { mergeFaqJsonLd } from '../../components/cms/extraFaq';
import type { EurovisionPredictionsContent } from '../../../supabase/functions/_shared/cms/schemas/eurovision-predictions';
import { PageContentFallback } from './PageContentFallback';
import { predictionsText, type PredictionsText } from './predictionsText';

// fact: date the page was first published
const PUBLISHED = '2026-04-30T00:00:00Z'; // fact: date the page was first published
/** The build day (shared by both builds, see vite.config.ts): the line-up block changes with every content publish. */
const MODIFIED = `${import.meta.env.VITE_BUILD_DATE ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`;

const reload = () => window.location.reload();

/**
 * The live contest's entries: the only part of a guide page that needs
 * contests/{year}.json (inlined on the prerendered page, fetched on client
 * navigation). Loading shows a placeholder; a missing file shows the
 * error/retry state, which the prerender check rejects.
 */
function Lineup({ cc, locale, c }: { cc: CurrentContest; locale: Locale; c: PredictionsText['sections']['lineup'] }) {
  const h = hubCopy[locale].headers;
  const file = useContent<ContestSnapshot>(contestPath(cc.year));
  // Crawlable link to the live hub, in every state of the block.
  const hubLink = (
    <p><LocaleLink to={hubPath(cc.year)} className="text-euro-pink-light hover:underline">{c.hubLink} →</LocaleLink></p>
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

  if (entries.length === 0) {
    return (
      <Section id="lineup" title={c.title}>
        <p>{c.empty}</p>
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

  const names = entries
    .map((e) => (e.iso === cc.hostIso ? `${countryName(e, locale)}${c.hostSuffix}` : countryName(e, locale)))
    .sort(compareText);
  return (
    <Section id="lineup" title={c.title}>
      <p>{c.intro}</p>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-white/80">
        {names.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
      <p className="text-sm text-white/60">{c.runningOrder}</p>
      {hubLink}
    </Section>
  );
}

export default function PredictionsPage() {
  const locale = useLocale();
  const cc = useCurrentContest();
  const content = usePageContent<EurovisionPredictionsContent>('eurovision-predictions');
  if (content.status !== 'ready') return <PageContentFallback state={content} />;
  const c = predictionsText(content.data, contestTexts(cc)[locale]);

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.predictions, href: '/eurovision-predictions' },
  ];

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: c.meta.schemaTitle,
    description: c.meta.schemaDescription,
    image: 'https://eurovision.games/logo.png',
    author: { '@type': 'Organization', name: 'Eurovision Games', url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      logo: { '@type': 'ImageObject', url: 'https://eurovision.games/logo.png' },
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
        ogImage="https://eurovision.games/logo.png"
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={c.meta.keywords}
        jsonLd={mergeFaqJsonLd([article, faqJsonLd, breadcrumbJsonLd(crumbs, locale)], content.data.extraBlocks)}
      />

      <PageHero
        crumbs={crumbs}
        chip={c.hero.chip}
        chipTone="purple"
        title={c.hero.title}
        lede={c.hero.lede}
      />

      <ContentLayout>
        <Lineup cc={cc} locale={locale} c={c.sections.lineup} />

        <Section title={c.sections.format.title}>
          <p>{c.sections.format.intro}</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            <li><strong className="text-white">{c.sections.format.top5Label}</strong> — {c.sections.format.top5Body}</li>
            <li><strong className="text-white">{c.sections.format.worst5Label}</strong> — {c.sections.format.worst5Body}</li>
          </ul>
          <p>
            {c.sections.format.orderedPre}
            <strong className="text-white">{c.sections.format.orderedEm}</strong>
            {c.sections.format.orderedPost}
          </p>
        </Section>

        <Section title={c.sections.scoringTop5.title}>
          <p>{c.sections.scoringTop5.intro}</p>
          <DataTable
            headers={[c.sections.scoringTop5.headers.result, c.sections.scoringTop5.headers.points]}
            align={['left', 'right']}
            rows={[
              [c.sections.scoringTop5.rows.exact, <strong key="a" className="text-white">50</strong>],
              [c.sections.scoringTop5.rows.inListWrong, <strong key="b" className="text-white">20</strong>],
              [c.sections.scoringTop5.rows.outside, <span key="c" className="text-white/50">0</span>],
            ]}
          />
          <p>
            {c.sections.scoringTop5.max.pre}
            <strong className="text-white">{c.sections.scoringTop5.max.post}</strong>.
          </p>
        </Section>

        <Section title={c.sections.scoringWorst5.title}>
          <p>{c.sections.scoringWorst5.intro}</p>
          <DataTable
            headers={[c.sections.scoringWorst5.headers.result, c.sections.scoringWorst5.headers.points]}
            align={['left', 'right']}
            rows={[
              [c.sections.scoringWorst5.rows.exact, <strong key="a" className="text-white">50</strong>],
              [c.sections.scoringWorst5.rows.inListWrong, <strong key="b" className="text-white">20</strong>],
              [c.sections.scoringWorst5.rows.outside, <span key="c" className="text-white/50">0</span>],
            ]}
          />
          <p>
            {c.sections.scoringWorst5.max.pre}
            <strong className="text-white">{c.sections.scoringWorst5.max.cap}</strong>.
          </p>
        </Section>

        <Section title={c.sections.strategy.title}>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.sections.strategy.tips.map((tip, i) => (
              <li key={i}>
                <strong className="text-white">{tip.strong}</strong>{tip.rest}
              </li>
            ))}
          </ul>
        </Section>

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
