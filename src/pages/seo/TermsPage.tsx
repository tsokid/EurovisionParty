import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import { useLocale } from '../../lib/seo/LocaleContext';
import { copy as copyAll } from './content/termsCopy';

export default function TermsPage() {
  const locale = useLocale();
  const c = copyAll[locale];

  const crumbs: Crumb[] = [
    { label: c.breadcrumbs.home, href: '/' },
    { label: c.breadcrumbs.terms, href: '/terms' },
  ];

  const PUBLISHED = '2026-04-30T00:00:00Z';
  const MODIFIED = '2026-04-30T00:00:00Z';

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: c.meta.title,
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
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/terms' },
  };

  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: c.meta.title,
    url: 'https://eurovision.games/terms',
    description: c.meta.webPageDescription,
    dateModified: MODIFIED,
    mainEntity: {
      '@type': 'CreativeWork',
      name: c.meta.webPageMainEntityName,
      about: c.meta.webPageMainEntityAbout,
    },
  };

  return (
    <>
      <SchemaHead
        title={c.meta.title}
        description={c.meta.description}
        canonical="https://eurovision.games/terms"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        ogLocale="en_US"
        ogLocaleAlternate={['el_GR']}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={c.meta.keywords}
        jsonLd={[article, webPage, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip={c.hero.chip}
        chipTone="purple"
        title={c.hero.title}
        lede={c.hero.lede}
      />

      <ContentLayout>
        <Section title={c.whoWeAre.title}>
          <p>
            {c.whoWeAre.lead}
            <a
              href="mailto:hello@eurovision.games"
              className="text-euro-pink-light hover:text-white underline underline-offset-2"
            >
              hello@eurovision.games
            </a>
            {c.whoWeAre.contactTail}
          </p>
        </Section>

        <Section title={c.free.title}>
          <p>{c.free.intro}</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.free.items.map((item, i) => (
              <li key={i}>
                <strong className="text-white">{item.bold}</strong>{item.rest}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.conduct.title}>
          <p>{c.conduct.intro}</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.conduct.items.map((item, i) => (
              <li key={i}>
                <strong className="text-white">{item.bold}</strong>{item.rest}
              </li>
            ))}
          </ul>
          <p>{c.conduct.closer}</p>
        </Section>

        <Section title={c.account.title}>
          <p>{c.account.intro}</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.account.items.map((item, i) => (
              <li key={i}>
                <strong className="text-white">{item.bold}</strong>{item.rest}
              </li>
            ))}
            <li>
              <strong className="text-white">{c.account.deletionItem.bold}</strong>
              {c.account.deletionItem.lead}
              <a
                href="mailto:privacy@eurovision.games"
                className="text-euro-pink-light hover:text-white underline underline-offset-2"
              >
                privacy@eurovision.games
              </a>
              {c.account.deletionItem.mid}
              <a href="/privacy" className="text-euro-pink-light hover:text-white underline underline-offset-2">
                {c.account.deletionItem.linkLabel}
              </a>
              {c.account.deletionItem.tail}
            </li>
          </ul>
        </Section>

        <Section title={c.userContent.title}>
          <p>
            {c.userContent.lead}
            <a href="/privacy" className="text-euro-pink-light hover:text-white underline underline-offset-2">
              {c.userContent.linkLabel}
            </a>
            {c.userContent.tail}
          </p>
        </Section>

        <Section title={c.warranties.title}>
          <p>
            {c.warranties.lead}
            <strong className="text-white">{c.warranties.asIs}</strong>
            {c.warranties.mid}
            <strong className="text-white">{c.warranties.asAvailable}</strong>
            {c.warranties.tail}
          </p>
        </Section>

        <Section title={c.liability.title}>
          <p>{c.liability.body}</p>
        </Section>

        <Section title={c.ebu.title}>
          <div className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.04] p-6">
            <h3 className="text-white font-bold text-lg mb-2">{c.ebu.cardTitle}</h3>
            <p className="text-white/85 text-[15px] leading-relaxed">
              {c.ebu.body}
              <strong className="text-white">{c.ebu.bodyBold}</strong>
              {c.ebu.bodyTail}
            </p>
          </div>
        </Section>

        <Section title={c.changes.title}>
          <p>{c.changes.body}</p>
        </Section>

        <Section title={c.contact.title}>
          <p>
            {c.contact.lead}
            <a
              href="mailto:hello@eurovision.games"
              className="text-euro-pink-light hover:text-white underline underline-offset-2"
            >
              {c.contact.helloEmail}
            </a>
            {c.contact.mid1}
            <a
              href="mailto:privacy@eurovision.games"
              className="text-euro-pink-light hover:text-white underline underline-offset-2"
            >
              {c.contact.privacyEmail}
            </a>
            {c.contact.mid2}
            <a
              href="mailto:legal@eurovision.games"
              className="text-euro-pink-light hover:text-white underline underline-offset-2"
            >
              {c.contact.legalEmail}
            </a>
            {c.contact.tail}
          </p>
        </Section>

        <RelatedCards items={c.related} />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
