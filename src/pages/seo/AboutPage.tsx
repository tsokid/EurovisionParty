import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import CtaBanner from '../../components/seo/CtaBanner';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import { useLocale } from '../../lib/seo/LocaleContext';
import { copy as copyAll } from './content/aboutCopy';

export default function AboutPage() {
  const locale = useLocale();
  const c = copyAll[locale];

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
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'hello@eurovision.games',
      contactType: 'customer support',
    },
  };

  const aboutPage = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: c.meta.title,
    url: 'https://eurovision.games/about',
    description: c.meta.aboutPageDescription,
    mainEntity: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      url: 'https://eurovision.games',
    },
  };

  return (
    <>
      <SchemaHead
        title={c.meta.title}
        description={c.meta.description}
        canonical="https://eurovision.games/about"
        ogType="website"
        ogImage="https://eurovision.games/logo.png"
        ogLocale="en_US"
        ogLocaleAlternate={['el_GR']}
        keywords={c.meta.keywords}
        jsonLd={[organization, aboutPage, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip={c.hero.chip}
        chipTone="gold"
        title={c.hero.title}
        lede={c.hero.lede}
      />

      <ContentLayout>
        <Section title={c.whatIs.title}>
          <p>
            {c.whatIs.parts.lead}
            <strong className="text-white">{c.whatIs.parts.predictionsBold}</strong>
            {c.whatIs.parts.mid1}
            <strong className="text-white">{c.whatIs.parts.triviaBold}</strong>
            {c.whatIs.parts.mid2}
            <strong className="text-white">{c.whatIs.parts.trophiesBold}</strong>
            {c.whatIs.parts.tail}
          </p>
        </Section>

        <Section title={c.why.title}>
          <p>{c.why.body}</p>
          <div className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.04] p-6">
            <h3 className="text-white font-bold text-lg mb-2">{c.why.cardTitle}</h3>
            <ul className="list-disc pl-6 space-y-1.5 text-white/85 text-[15px]">
              {c.why.items.map((item, i) => (
                <li key={i}>
                  <strong className="text-white">{item.bold}</strong>{item.rest}
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section title={c.whatsIn.title}>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.whatsIn.items.map((item, i) => (
              <li key={i}>
                <strong className="text-white">{item.bold}</strong>
                {item.lead}
                {item.linkLabel && item.linkHref && (
                  <a
                    href={item.linkHref}
                    className="text-euro-pink-light hover:text-white underline underline-offset-2"
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
          <div className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.04] p-6">
            <h3 className="text-white font-bold text-lg mb-2">{c.ebu.cardTitle}</h3>
            <p className="text-white/85 text-[15px] leading-relaxed">{c.ebu.body}</p>
          </div>
        </Section>

        <Section title={c.builtBy.title}>
          <p>
            {c.builtBy.lead}
            <a
              href="mailto:hello@eurovision.games"
              className="text-euro-pink-light hover:text-white underline underline-offset-2"
            >
              {c.builtBy.helloEmail}
            </a>
            {c.builtBy.mid}
            <a
              href="mailto:press@eurovision.games"
              className="text-euro-pink-light hover:text-white underline underline-offset-2"
            >
              {c.builtBy.pressEmail}
            </a>
            {c.builtBy.tail}
          </p>
        </Section>

        <CtaBanner
          title={c.cta.title}
          body={c.cta.body}
          primary={{ label: c.cta.primaryLabel, href: '/?action=create' }}
          secondary={{ label: c.cta.secondaryLabel, href: '/how-to-play' }}
        />

        <RelatedCards items={c.related} />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
