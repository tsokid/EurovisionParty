import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import DataTable from '../../components/seo/DataTable';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import { useLocale } from '../../lib/seo/LocaleContext';
import { copy as copyAll } from './content/privacyCopy';

export default function PrivacyPage() {
  const locale = useLocale();
  const c = copyAll[locale];

  const crumbs: Crumb[] = [
    { label: c.breadcrumbs.home, href: '/' },
    { label: c.breadcrumbs.privacy, href: '/privacy' },
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
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/privacy' },
  };

  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: c.meta.title,
    url: 'https://eurovision.games/privacy',
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
        canonical="https://eurovision.games/privacy"
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
        <Section title={c.whatCollect.title}>
          <p>{c.whatCollect.intro}</p>
          <DataTable
            headers={c.whatCollect.headers as unknown as string[]}
            align={['left', 'left', 'left']}
            rows={c.whatCollect.rows.map((row, i) => [
              <strong key={`type-${i}`} className="text-white">{row.type}</strong>,
              row.purpose,
              row.retention,
            ])}
          />
        </Section>

        <Section title={c.notCollect.title}>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.notCollect.items.map((item, i) => (
              <li key={i}>
                <strong className="text-white">{item.bold}</strong>{item.rest}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.whoHasAccess.title}>
          <p>{c.whoHasAccess.intro}</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.whoHasAccess.items.map((item, i) => (
              <li key={i}>
                <strong className="text-white">{item.bold}</strong>{item.rest}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.rights.title}>
          <p>{c.rights.intro}</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.rights.items.map((item, i) => (
              <li key={i}>
                <strong className="text-white">{item.bold}</strong>{item.rest}
              </li>
            ))}
          </ul>
          <p>
            {c.rights.contactLead}
            <a
              href="mailto:privacy@eurovision.games"
              className="text-euro-pink-light hover:text-white underline underline-offset-2"
            >
              privacy@eurovision.games
            </a>
            {c.rights.contactTail}
          </p>
        </Section>

        <Section title={c.deletion.title}>
          <div className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.04] p-6">
            <h3 className="text-white font-bold text-lg mb-2">{c.deletion.cardTitle}</h3>
            <p className="text-white/80 text-[15px] leading-relaxed">
              {c.deletion.cardLead}
              <a
                href="mailto:privacy@eurovision.games"
                className="text-euro-pink-light hover:text-white underline underline-offset-2"
              >
                privacy@eurovision.games
              </a>
              {c.deletion.cardTail}
            </p>
          </div>
          <p>{c.deletion.note}</p>
        </Section>

        <Section title={c.cookies.title}>
          <p>
            {c.cookies.lead}
            <a href="/cookies" className="text-euro-pink-light hover:text-white underline underline-offset-2">
              {c.cookies.linkLabel}
            </a>
            {c.cookies.tail}
          </p>
        </Section>

        <Section title={c.children.title}>
          <p>{c.children.body}</p>
        </Section>

        <Section title={c.changes.title}>
          <p>{c.changes.body}</p>
        </Section>

        <Section title={c.contact.title}>
          <p>
            {c.contact.lead}
            <a
              href="mailto:privacy@eurovision.games"
              className="text-euro-pink-light hover:text-white underline underline-offset-2"
            >
              {c.contact.privacyEmail}
            </a>
            {c.contact.mid}
            <a
              href="mailto:hello@eurovision.games"
              className="text-euro-pink-light hover:text-white underline underline-offset-2"
            >
              {c.contact.generalEmail}
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
