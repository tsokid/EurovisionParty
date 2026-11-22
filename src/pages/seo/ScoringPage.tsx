import type { ReactNode } from 'react';
import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import { GuideSection, HeroStats, IconBox, SideLinks } from '../../components/seo/StageKit';
import { Button } from '../../components/stage';
import { useTranslation } from 'react-i18next';
import { SCORING } from '../../lib/constants';
import DataTable from '../../components/seo/DataTable';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import { useLocale } from '../../lib/seo/LocaleContext';
import { pageUrl } from '../../lib/seo/registry';
import { usePageContent } from '../../lib/cms/usePageContent';
import ExtraBlocks from '../../components/cms/ExtraBlocks';
import { mergeFaqJsonLd } from '../../components/cms/extraFaq';
import type { ScoringContent } from '../../../supabase/functions/_shared/cms/schemas/scoring';
import { PageContentFallback } from './PageContentFallback';

interface RowSpec {
  label: string;
  value: string;
  tone: 'strong' | 'muted' | 'pinkBonus';
}

function renderRow(rows: RowSpec[]): ReactNode[][] {
  return rows.map((r, i) => {
    const valueNode =
      r.tone === 'muted' ? (
        <span key={`v-${i}`} className="num sc-v muted">{r.value}</span>
      ) : r.tone === 'pinkBonus' ? (
        <strong key={`v-${i}`} className="num sc-v pink">{r.value}</strong>
      ) : (
        <strong key={`v-${i}`} className="num sc-v">{r.value}</strong>
      );
    return [r.label, valueNode];
  });
}

const QUIZ_MAX = SCORING.quiz.tier1.points * 10 * 3;
const PRED_MAX = SCORING.prediction.exactPosition * 5 + SCORING.prediction.exactWorst * 5;

/** The last bold number in an example line ("… = <strong>160</strong> πόντοι"). */
const boldNumber = (html: string): string | null => {
  const all = [...html.matchAll(/<strong>([^<]*\d[^<]*)<\/strong>/g)];
  return all.length ? all[all.length - 1][1] : null;
};

export default function ScoringPage() {
  const locale = useLocale();
  const { t } = useTranslation();
  const ui = (k: string) => t(`scoringPage.${k}`);
  const content = usePageContent<ScoringContent>('scoring');
  if (content.status !== 'ready') return <PageContentFallback state={content} />;
  const c = content.data;

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.current, href: '/scoring' },
  ];

  // Worked example: the last line is the total ("Σύνολο: 356 πόντοι."), the others its parts.
  const items = c.example.items;
  const totalMatch = items.length > 1 ? /(\d+)/.exec(items[items.length - 1].strong) : null;
  const total = totalMatch ? totalMatch[1] : null;
  const last = total ? items[items.length - 1] : null;
  const exampleRows = (total ? items.slice(0, -1) : items).map((it) => ({ ...it, value: boldNumber(it.rest) }));

  const PUBLISHED = '2026-04-30T00:00:00Z'; // fact: date the page was first published
  const MODIFIED = '2026-04-30T00:00:00Z'; // fact: date the page copy was last edited

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: c.schema.articleHeadline,
    description: c.schema.articleDescription,
    image: 'https://eurovision.games/logo.png',
    author: { '@type': 'Organization', name: 'Eurovision Games', url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      logo: { '@type': 'ImageObject', url: 'https://eurovision.games/logo.png' },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl('scoring', locale) },
  };

  return (
    <>
      <PageSeo
        pageId="scoring"
        locale={locale}
        title={c.meta.title}
        description={c.meta.description}
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={c.meta.keywords}
        jsonLd={mergeFaqJsonLd([article, breadcrumbJsonLd(crumbs, locale)], c.extraBlocks)}
      />

      <PageHero
        crumbs={crumbs}
        chip={c.hero.chip}
        chipTone="pink"
        title={c.hero.title}
        grad="dash"
        lede={c.hero.lede}
        aside={
          <HeroStats items={[
            { v: QUIZ_MAX, k: ui('statQuiz') },
            { v: PRED_MAX, k: ui('statPred') },
            { v: '×2', k: ui('statDouble'), tone: 'gold' },
          ]} />
        }
      />

      <div className="wrap pg-body">
        <div className="pg-main guide">
          <div className="sc-pair">
            <GuideSection id="quiz" eyebrow={`01 · ${ui('kQuiz')}`} title={c.quiz.title} intro={c.quiz.intro}>
              <DataTable headers={c.quiz.headers as unknown as string[]} align={['left', 'right']} rows={renderRow(c.quiz.rows)} />
              <p className="t-meta m-0 sc-note" dangerouslySetInnerHTML={{ __html: c.quiz.note }} />
            </GuideSection>

            <GuideSection id="top5" eyebrow={`02 · ${ui('kPred')}`} title={c.top5.title} intro={c.top5.intro}>
              <DataTable headers={c.top5.headers as unknown as string[]} align={['left', 'right']} rows={renderRow(c.top5.rows)} />
              <p className="t-meta m-0 sc-note" dangerouslySetInnerHTML={{ __html: c.top5.note }} />
            </GuideSection>
          </div>

          <GuideSection id="worst5" title={c.worst5.title} intro={c.worst5.intro}>
            <DataTable headers={c.worst5.headers as unknown as string[]} align={['left', 'right']} rows={renderRow(c.worst5.rows)} />
            <p className="t-meta m-0 sc-note" dangerouslySetInnerHTML={{ __html: c.worst5.note }} />
          </GuideSection>

          <GuideSection id="duels" eyebrow={`03 · ${ui('kDuels')}`} title={c.duel.title} intro={c.duel.intro}>
            <div className="card sc-formula">
              <span className="num sc-formula-v">{ui('duelFormula')}</span>
              <p className="t-small m-0" dangerouslySetInnerHTML={{ __html: c.duel.body }} />
            </div>
            <div className="sc-duel">
              <DataTable headers={c.duel.headers as unknown as string[]} align={['left', 'right']} rows={renderRow(c.duel.rows)} />
              <section className="card-hero sc-sd" aria-labelledby="sc-sd-h">
                <h2 id="sc-sd-h" className="t-h3">{c.stealDouble.title}</h2>
                <p className="t-small m-0">{c.stealDouble.intro}</p>
                <div className="card sc-choice">
                  <h3 className="sc-choice-h"><IconBox name="steal" size={16} />{c.stealDouble.stealTitle}</h3>
                  <p className="t-small m-0" dangerouslySetInnerHTML={{ __html: c.stealDouble.stealBody }} />
                </div>
                <div className="card sc-choice">
                  <h3 className="sc-choice-h"><IconBox name="plus" size={16} />{c.stealDouble.doubleTitle}</h3>
                  <p className="t-small m-0" dangerouslySetInnerHTML={{ __html: c.stealDouble.doubleBody }} />
                </div>
                <p className="t-meta m-0" dangerouslySetInnerHTML={{ __html: c.stealDouble.note }} />
              </section>
            </div>
          </GuideSection>

          <GuideSection id="penalties" eyebrow={`04 · ${ui('kEdge')}`} title={c.penalties.title}>
            <ul className="kit-grid c2 sc-pen">
              {c.penalties.items.map((it, i) => (
                <li key={i} className="card sc-pen-card">
                  <h3 className="t-h3">{it.strong}</h3>
                  <p className="t-small m-0" dangerouslySetInnerHTML={{ __html: it.rest }} />
                </li>
              ))}
            </ul>
          </GuideSection>

          <div className="stage-prose guide-extra">
            <ExtraBlocks value={c.extraBlocks} />
          </div>

          <RelatedCards heading={ui('related')} items={c.related.items} />
        </div>

        <aside className="pg-aside sc-aside">
          <section className="card card-pad sc-example m-first" aria-labelledby="sc-ex-h">
            <h2 id="sc-ex-h" className="t-eyebrow">{c.example.title}</h2>
            {total != null && (
              <p className="sc-total m-0"><span className="num">{total}</span><span className="t-small">{ui('totalLabel')}</span></p>
            )}
            <p className="t-small m-0">{c.example.intro}</p>
            <ul className="sc-ex-list">
              {exampleRows.map((it, i) => (
                <li key={i} className={`sc-ex-row c${i % 3}`}>
                  <span className="sc-ex-b">
                    <strong>{it.strong}</strong>
                    <span className="t-meta" dangerouslySetInnerHTML={{ __html: it.rest }} />
                  </span>
                  {it.value && <span className="num sc-ex-v">{it.value}</span>}
                </li>
              ))}
            </ul>
            {last && <p className="t-small m-0"><strong>{last.strong}</strong> <span dangerouslySetInnerHTML={{ __html: last.rest }} /></p>}
          </section>
          <div className="card-hero card-pad sc-cta" role="complementary">
            <h2 className="t-h3">{c.cta.title}</h2>
            <p className="t-small m-0">{c.cta.body}</p>
            <Button to="/?action=create" block>{c.cta.primary}</Button>
            <Button to="/how-to-play" variant="ghost" size="sm" block>{c.cta.secondary}</Button>
          </div>
          <SideLinks items={c.related.items.slice(0, 3).map((r) => ({ href: r.href, title: r.title }))} />
        </aside>
      </div>
      <SiteFooter />
    </>
  );
}
