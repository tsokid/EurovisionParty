import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import { GuideSection, HeroStats, Icon, IconBox, Ticks, TocCard, TocSeg, type IconName } from '../../components/seo/StageKit';
import { Button } from '../../components/stage';
import { useTranslation } from 'react-i18next';
import { PHASE_ORDER, SCORING } from '../../lib/constants';
import DataTable from '../../components/seo/DataTable';
import CtaBanner from '../../components/seo/CtaBanner';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import { useLocale } from '../../lib/seo/LocaleContext';
import { pageUrl } from '../../lib/seo/registry';
import { usePageContent } from '../../lib/cms/usePageContent';
import ExtraBlocks from '../../components/cms/ExtraBlocks';
import { mergeFaqJsonLd } from '../../components/cms/extraFaq';
import type { RulesContent } from '../../../supabase/functions/_shared/cms/schemas/rules';
import { PageContentFallback } from './PageContentFallback';
import { interpolate } from '../../../supabase/functions/_shared/cms/placeholders';
import { useCurrentContest } from '../../lib/currentContest';

const Q = SCORING.quiz;
const P = SCORING.prediction;
const LIMIT_ICONS: IconName[] = ['users', 'lock', 'home', 'play', 'shield'];

export default function RulesPage() {
  const locale = useLocale();
  const { t } = useTranslation();
  const ui = (k: string, o?: Record<string, unknown>) => t(`rulesPage.${k}`, o);
  const cc = useCurrentContest();
  const content = usePageContent<RulesContent>('rules');
  if (content.status !== 'ready') return <PageContentFallback state={content} />;
  const c = content.data;
  const vars = { year: cc.year };
  const relatedItems = c.related.items.map((it) => ({ ...it, blurb: interpolate(it.blurb, vars) }));

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.current, href: '/rules' },
  ];

  const toc = [
    { id: 'limits', title: c.hostLimits.title },
    { id: 'phases', title: c.phases.title },
    { id: 'predictions', title: c.predictions.title },
    { id: 'quiz', title: c.quiz.title },
    { id: 'duels', title: c.duels.title },
    { id: 'trophies', title: c.trophies.title },
    { id: 'sudden-death', title: c.suddenDeath.title },
    { id: 'disconnect', title: c.disconnect.title },
    { id: 'edge-cases', title: c.edgeCases.title },
  ];
  const nOf = (id: string) => toc.findIndex((x) => x.id === id) + 1;

  const PUBLISHED = '2026-04-30T00:00:00Z'; // fact: date the page was first published
  const MODIFIED = '2026-04-30T00:00:00Z'; // fact: date the page copy was last edited

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: interpolate(c.schema.articleHeadline, vars),
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
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl('rules', locale) },
  };

  return (
    <>
      <PageSeo
        pageId="rules"
        locale={locale}
        title={interpolate(c.meta.title, vars)}
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
          <div className="kit-hero-aside">
            <HeroStats items={[
              { v: '2–20', k: ui('statPlayers') },
              { v: PHASE_ORDER.length, k: ui('statPhases') },
              { v: c.trophies.items.length, k: ui('statTrophies'), tone: 'gold' },
            ]} />
            <Button to="/?action=create" size="lg" block>{c.cta.title}</Button>
          </div>
        }
      />

      <section className="wrap rules-glance" aria-labelledby="rules-glance-h">
        <h2 id="rules-glance-h" className="t-h2">{ui('glanceTitle')}</h2>
        <div className="kit-grid c4">
          <div className="card glance-card">
            <h3 className="glance-h"><IconBox name="help" size={18} />{ui('quiz')}</h3>
            <p className="t-meta m-0">{ui('quizSub')}</p>
            <dl className="glance-rows">
              <div><dt>{ui('quizFast', { s: Q.tier1.maxSeconds })}</dt><dd className="num gold">{Q.tier1.points}</dd></div>
              <div><dt>{ui('quizFast', { s: Q.tier2.maxSeconds })}</dt><dd className="num">{Q.tier2.points}</dd></div>
              <div><dt>{ui('quizSlow')}</dt><dd className="num">{Q.tier3.points}</dd></div>
            </dl>
          </div>
          <div className="card glance-card">
            <h3 className="glance-h"><IconBox name="swords" size={18} />{ui('duels')}</h3>
            <p className="t-meta m-0">{ui('duelSub')}</p>
            <dl className="glance-rows">
              <div><dt>{ui('duelCorrect')}</dt><dd className="num gold">{ui('duelPts')}</dd></div>
              <div><dt>{ui('duelSteal')}</dt><dd className="num pink">←</dd></div>
              <div><dt>{ui('duelDouble')}</dt><dd className="num purple">×2</dd></div>
            </dl>
          </div>
          <div className="card glance-card">
            <h3 className="glance-h"><IconBox name="list" size={18} />{ui('predictions')}</h3>
            <p className="t-meta m-0">{ui('predSub')}</p>
            <dl className="glance-rows">
              <div><dt>{ui('predExact')}</dt><dd className="num gold">+{P.exactPosition}</dd></div>
              <div><dt>{ui('predList')}</dt><dd className="num">+{P.inTop5}</dd></div>
              <div><dt>{ui('predOut')}</dt><dd className="num">0</dd></div>
            </dl>
          </div>
          <div className="card glance-card gold">
            <h3 className="glance-h"><IconBox name="trophy" size={18} />{ui('trophies')}</h3>
            <p className="t-meta m-0">{ui('trophySub')}</p>
            <ul className="glance-chips">
              {c.trophies.items.map((it, i) => <li key={i} className={i === 0 ? 'chip chip-gold' : 'chip'}>{it.strong}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <TocSeg label={ui('onThisPage')} items={toc} />

      <div className="wrap pg-body toc-left">
        <aside className="pg-aside howto-aside">
          <TocCard label={ui('onThisPage')} items={toc} />
        </aside>

        <div className="pg-main guide">
          <GuideSection id="limits" n={nOf('limits')} title={c.hostLimits.title}>
            <ul className="kit-grid c3 rules-cards">
              {c.hostLimits.items.map((it, i) => (
                <li key={i} className="card rules-card">
                  <IconBox name={LIMIT_ICONS[i % LIMIT_ICONS.length]} size={18} />
                  <h3 className="t-h3">{it.strong}</h3>
                  <p className="t-small m-0">{it.rest}</p>
                </li>
              ))}
            </ul>
          </GuideSection>

          <GuideSection id="phases" n={nOf('phases')} title={c.phases.title} intro={c.phases.intro}>
            <DataTable
              headers={['#', ...(c.phases.headers as unknown as string[])]}
              align={['right', 'left', 'left', 'left']}
              rows={c.phases.rows.map((r, i) => [i < PHASE_ORDER.length ? String(i + 1) : '+', r[0], r[1], r[2]])}
            />
          </GuideSection>

          <GuideSection id="predictions" n={nOf('predictions')} title={c.predictions.title}>
            <Ticks items={c.predictions.items} />
          </GuideSection>

          <GuideSection id="quiz" n={nOf('quiz')} title={c.quiz.title}>
            <Ticks items={c.quiz.items} />
          </GuideSection>

          <GuideSection id="duels" n={nOf('duels')} title={c.duels.title}>
            <Ticks items={c.duels.items} html />
          </GuideSection>

          <GuideSection id="trophies" n={nOf('trophies')} title={c.trophies.title} intro={c.trophies.intro}>
            <ul className="trophies">
              {c.trophies.items.map((it, i) => (
                <li key={i} className="card trophy">
                  <span className="ico trophy-ico" aria-hidden><Icon name="trophy" size={20} /></span>
                  <span><strong>{it.strong}</strong> <span className="t-small">{it.rest}</span></span>
                </li>
              ))}
            </ul>
            <p className="t-small m-0">{c.trophies.note}</p>
          </GuideSection>

          <GuideSection id="sudden-death" n={nOf('sudden-death')} title={c.suddenDeath.title} intro={c.suddenDeath.body}>
            <div className="card-hero card-pad rules-sd">
              <h3 className="t-h3">{c.suddenDeath.cardTitle}</h3>
              <p className="t-small m-0">{c.suddenDeath.cardBody}</p>
            </div>
          </GuideSection>

          <GuideSection id="disconnect" n={nOf('disconnect')} title={c.disconnect.title}>
            <Ticks items={c.disconnect.items} />
          </GuideSection>

          <GuideSection id="edge-cases" n={nOf('edge-cases')} title={c.edgeCases.title}>
            <Ticks items={c.edgeCases.items} />
          </GuideSection>

          <div className="stage-prose guide-extra">
            <ExtraBlocks value={c.extraBlocks} />
          </div>

          <CtaBanner
            title={c.cta.title}
            body={c.cta.body}
            primary={{ label: c.cta.primary, href: '/?action=create' }}
            secondary={{ label: c.cta.secondary, href: '/scoring' }}
          />

          <RelatedCards heading={ui('related')} items={relatedItems} />
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
