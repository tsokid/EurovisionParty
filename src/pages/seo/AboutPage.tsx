import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import LegalFrame from '../../components/seo/LegalFrame';
import Section from '../../components/seo/Section';
import CtaBanner from '../../components/seo/CtaBanner';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import { useLocale } from '../../lib/seo/LocaleContext';
import { pageUrl } from '../../lib/seo/registry';
import { usePageContent } from '../../lib/cms/usePageContent';
import ExtraBlocks from '../../components/cms/ExtraBlocks';
import { mergeFaqJsonLd } from '../../components/cms/extraFaq';
import type { AboutContent } from '../../../supabase/functions/_shared/cms/schemas/about';
import { PageContentFallback } from './PageContentFallback';

export default function AboutPage() {
  const locale = useLocale();
  const content = usePageContent<AboutContent>('about');
  if (content.status !== 'ready') return <PageContentFallback state={content} />;
  const c = content.data;

  const crumbs: Crumb[] = [
    { label: c.breadcrumbs.home, href: '/' },
    { label: c.breadcrumbs.about, href: '/about' },
  ];

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Eurovision Games',
    url: 'https://eurovision.games',
    logo: 'https://eurovision.games/logo.png',
    description: c.meta.organizationDescription,
    sameAs: [],
  };

  const aboutPage = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: c.meta.title,
    url: pageUrl('about', locale),
    description: c.meta.aboutPageDescription,
    mainEntity: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      url: 'https://eurovision.games',
    },
  };

  return (
    <>
      <PageSeo
        pageId="about"
        locale={locale}
        title={c.meta.title}
        description={c.meta.description}
        ogType="website"
        ogImage="https://eurovision.games/logo.png"
        keywords={c.meta.keywords}
        jsonLd={mergeFaqJsonLd([organization, aboutPage, breadcrumbJsonLd(crumbs, locale)], c.extraBlocks)}
      />

      <LegalFrame
        current="about"
        crumbs={crumbs}
        chip={c.hero.chip}
        title={c.hero.title}
        lede={c.hero.lede}
      >

        <Section title={c.whatIs.title}>
          <p>
            {c.whatIs.parts.lead}
            <strong>{c.whatIs.parts.predictionsBold}</strong>
            {c.whatIs.parts.mid1}
            <strong>{c.whatIs.parts.triviaBold}</strong>
            {c.whatIs.parts.mid2}
            <strong>{c.whatIs.parts.trophiesBold}</strong>
            {c.whatIs.parts.tail}
          </p>
        </Section>

        <Section title={c.why.title}>
          <p>{c.why.body}</p>
          <div className="card-hero card-pad legal-card">
            <h3 className="t-h3">{c.why.cardTitle}</h3>
            <ul className="legal-list">
              {c.why.items.map((item, i) => (
                <li key={i}>
                  <strong>{item.bold}</strong>{item.rest}
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section title={c.whatsIn.title}>
          <ul className="legal-list">
            {c.whatsIn.items.map((item, i) => (
              <li key={i}>
                <strong>{item.bold}</strong>
                {item.lead}
                {item.linkLabel && item.linkHref && (
                  <a
                    href={item.linkHref}
                   
                  >
                    {item.linkLabel}
                  </a>
                )}
                {item.tail}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.freeNoAccount.title}>
          <p>{c.freeNoAccount.body}</p>
        </Section>

        <Section title={c.ebu.title}>
          <div className="card-hero card-pad legal-card">
            <h3 className="t-h3">{c.ebu.cardTitle}</h3>
            <p className="t-small">{c.ebu.body}</p>
          </div>
        </Section>

        <Section title={c.builtBy.title}>
          <p>{c.builtBy.lead}</p>
        </Section>

        <ExtraBlocks value={c.extraBlocks} />

        <CtaBanner
          title={c.cta.title}
          body={c.cta.body}
          primary={{ label: c.cta.primaryLabel, href: '/?action=create' }}
          secondary={{ label: c.cta.secondaryLabel, href: '/how-to-play' }}
        />

        <RelatedCards items={c.related} />
      </LegalFrame>
      <SiteFooter />
    </>
  );
}
