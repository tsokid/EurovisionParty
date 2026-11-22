import { useTranslation } from 'react-i18next';
import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import FaqAccordion, { type FaqItem } from '../../components/seo/FaqAccordion';
import RelatedCards from '../../components/seo/RelatedCards';
import { Icon, IconBox, SideLinks, TocCard, TocSeg, type IconName, type TocItem } from '../../components/seo/StageKit';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import { Button } from '../../components/stage';
import { useLocale } from '../../lib/seo/LocaleContext';
import { pageUrl } from '../../lib/seo/registry';
import { usePageContent } from '../../lib/cms/usePageContent';
import ExtraBlocks from '../../components/cms/ExtraBlocks';
import { mergeFaqJsonLd } from '../../components/cms/extraFaq';
import { FAQ_TOPICS, type FaqContent, type FaqTopic } from '../../../supabase/functions/_shared/cms/schemas/faq';
import { PageContentFallback } from './PageContentFallback';

const TOPIC_ICON: Record<FaqTopic, IconName> = {
  start: 'home',
  devices: 'wifi',
  during: 'play',
  scoring: 'trophy',
  results: 'shield',
};

/** First sentence of an answer (the mobile «three most asked» cards). */
const firstSentence = (s: string): string => {
  const m = /^(.+?[.;·])\s/.exec(s);
  return m ? m[1] : s;
};

export default function FAQPage() {
  const locale = useLocale();
  const { t } = useTranslation();
  const content = usePageContent<FaqContent>('faq');
  if (content.status !== 'ready') return <PageContentFallback state={content} />;
  const c = content.data;

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.current, href: '/faq' },
  ];

  const PUBLISHED = '2026-04-30T00:00:00Z'; // fact: date the page was first published
  const MODIFIED = '2026-04-30T00:00:00Z'; // fact: date the page copy was last edited

  // FAQPage schema must include every Q&A — anchored + accordion combined.
  const allFaq = [...c.anchored.map((a) => ({ q: a.q, a: a.a })), ...c.more];
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: allFaq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

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
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl('faq', locale) },
  };

  const createA = c.anchored.find((a) => a.id === 'create')!;
  const joinA = c.anchored.find((a) => a.id === 'join')!;
  const leaveA = c.anchored.find((a) => a.id === 'leave')!;

  // The three anchored questions open the first topic (board), fully open.
  const anchored: FaqItem[] = [
    {
      id: 'create', q: createA.q, a: createA.a,
      body: (
        <div className="faq-rich">
          <p>{createA.a}</p>
          <div className="faq-defaults">
            <h3 className="t-eyebrow">{c.createSection.cardTitle}</h3>
            <ul className="ticks">
              {c.createSection.bullets.map((b, i) => (
                <li key={i}><Icon name="check" size={18} className="tick" /><span><strong>{b.strong}</strong> {b.rest}</span></li>
              ))}
            </ul>
          </div>
        </div>
      ),
    },
    ...[{ a: joinA, s: c.joinSection }, { a: leaveA, s: c.leaveSection }].map(({ a, s }) => ({
      id: a.id, q: a.q, a: a.a,
      body: (
        <div className="faq-rich">
          <p>{a.a}</p>
          <ul className="ticks">
            {s.bullets.map((b, i) => (
              <li key={i}>
                <Icon name="check" size={18} className="tick" />
                <span><strong>{b.strong}</strong> <span dangerouslySetInnerHTML={{ __html: b.rest }} /></span>
              </li>
            ))}
          </ul>
        </div>
      ),
    })),
  ];

  const topics = FAQ_TOPICS.map((id) => {
    const more = c.more.filter((m) => (m.topic ?? 'start') === id);
    const items: FaqItem[] = id === 'start' ? [...anchored, ...more] : more;
    return { id, items };
  }).filter((g) => g.items.length > 0);

  const toc: TocItem[] = topics.map((g) => ({
    id: `topic-${g.id}`,
    title: t(`faqPage.topics.${g.id}`),
    count: g.items.length,
    icon: TOPIC_ICON[g.id],
  }));

  const top3 = [
    { n: 1, id: 'create', title: c.createSection.title, a: createA.a },
    { n: 2, id: 'join', title: c.joinSection.title, a: joinA.a },
    { n: 3, id: 'leave', title: c.leaveSection.title, a: leaveA.a },
  ];

  const heroAside = (
    <ol className="faq-top">
      {top3.map((x) => (
        <li key={x.id}>
          <a href={`#${x.id}`} className="card faq-top-card">
            <span className="num">{String(x.n).padStart(2, '0')}</span>
            <span className="faq-top-t">{x.title}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      <PageSeo
        pageId="faq"
        locale={locale}
        title={c.meta.title}
        description={c.meta.description}
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={c.meta.keywords}
        jsonLd={mergeFaqJsonLd([article, faqSchema, breadcrumbJsonLd(crumbs, locale)], c.extraBlocks)}
      />

      <PageHero
        crumbs={crumbs}
        chip={c.hero.chip}
        chipTone="pink"
        title={c.hero.title}
        grad="dash"
        lede={c.hero.lede}
        aside={heroAside}
        className="faq-hero"
      />

      <TocSeg label={t('faqPage.topicsNav')} items={toc} />

      <div className="wrap pg-body toc-left faq-body">
        <aside className="pg-aside faq-aside">
          <div className="howto-aside faq-toc">
            <TocCard label={t('faqPage.topicsNav')} items={toc} />
          </div>
          <div className="card-hero faq-help" role="complementary">
            <h2 className="t-h3">{c.cta.title}</h2>
            <p className="t-small m-0">{c.cta.body}</p>
            <Button to="/?action=create" block>{c.cta.primary}</Button>
            <Button to="/about" variant="ghost" size="sm" block>{c.cta.secondary}</Button>
          </div>
          <SideLinks label={t('faqPage.details')} items={c.related.items.slice(0, 3).map((r) => ({ href: r.href, title: r.title }))} />
        </aside>

        <div className="pg-main faq-main">
          <section className="faq-top-m" aria-labelledby="faq-top-h">
            <h2 id="faq-top-h" className="t-h2">{t('faqPage.top3')}</h2>
            <ol className="faq-top-list">
              {top3.map((x) => (
                <li key={x.id}>
                  <a href={`#${x.id}`} className="card faq-top-row">
                    <span className="num">{x.n}</span>
                    <span>
                      <span className="faq-top-row-t">{x.title}</span>
                      <span className="t-small">{firstSentence(x.a)}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </section>

          {topics.map((g) => (
            <section key={g.id} id={`topic-${g.id}`} className="faq-topic" aria-labelledby={`topic-${g.id}-h`}>
              <div className="faq-topic-head">
                <IconBox name={TOPIC_ICON[g.id]} />
                <h2 id={`topic-${g.id}-h`} className="t-h2">{t(`faqPage.topics.${g.id}`)}</h2>
                <span className="num t-meta faq-topic-n">{g.items.length}</span>
              </div>
              <FaqAccordion
                items={g.items}
                idPrefix={`faq-${g.id}`}
                singleOpen={false}
                defaultOpen={g.id === 'start' ? [0, 1, 2] : undefined}
              />
            </section>
          ))}

          <div className="stage-prose guide-extra">
            <ExtraBlocks value={c.extraBlocks} />
          </div>

          <RelatedCards heading={t('faqPage.related')} items={c.related.items} />
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
