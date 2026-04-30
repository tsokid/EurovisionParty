import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import FaqAccordion from '../../components/seo/FaqAccordion';
import CtaBanner from '../../components/seo/CtaBanner';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import { useLocale } from '../../lib/seo/LocaleContext';
import { copy as copyAll } from './content/faqCopy';

export default function FAQPage() {
  const locale = useLocale();
  const c = copyAll[locale];

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.current, href: '/faq' },
  ];

  const PUBLISHED = '2026-04-30T00:00:00Z';
  const MODIFIED = '2026-04-30T00:00:00Z';

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
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/faq' },
  };

  const createA = c.anchored.find((a) => a.id === 'create')!;
  const joinA = c.anchored.find((a) => a.id === 'join')!;
  const leaveA = c.anchored.find((a) => a.id === 'leave')!;

  return (
    <>
      <SchemaHead
        title={c.meta.title}
        description={c.meta.description}
        canonical="https://eurovision.games/faq"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        ogLocale={locale === 'el' ? 'el_GR' : 'en_US'}
        ogLocaleAlternate={[locale === 'el' ? 'en_US' : 'el_GR']}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={c.meta.keywords}
        jsonLd={[article, faqSchema, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip={c.hero.chip}
        chipTone="pink"
        title={c.hero.title}
        lede={c.hero.lede}
      />

      <ContentLayout>
        <Section id="create" title={c.createSection.title}>
          <p>{createA.a}</p>
          <div className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.04] p-6">
            <h3 className="text-white font-bold text-lg mb-2">{c.createSection.cardTitle}</h3>
            <ul className="list-disc pl-6 space-y-1.5 text-white/80 text-[15px]">
              {c.createSection.bullets.map((b, i) => (
                <li key={i}>
                  <strong className="text-white">{b.strong}</strong> {b.rest}
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section id="join" title={c.joinSection.title}>
          <p>{joinA.a}</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.joinSection.bullets.map((b, i) => (
              <li key={i}>
                <strong className="text-white">{b.strong}</strong>{' '}
                <span dangerouslySetInnerHTML={{ __html: b.rest }} />
              </li>
            ))}
          </ul>
        </Section>

        <Section id="leave" title={c.leaveSection.title}>
          <p>{leaveA.a}</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.leaveSection.bullets.map((b, i) => (
              <li key={i}>
                <strong className="text-white">{b.strong}</strong>{' '}
                <span dangerouslySetInnerHTML={{ __html: b.rest }} />
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.moreTitle}>
          <FaqAccordion items={c.more} />
        </Section>

        <CtaBanner
          title={c.cta.title}
          body={c.cta.body}
          primary={{ label: c.cta.primary, href: '/' }}
          secondary={{ label: c.cta.secondary, href: '/about' }}
        />

        <RelatedCards items={c.related.items} />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
