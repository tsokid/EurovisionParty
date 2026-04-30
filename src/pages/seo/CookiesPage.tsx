import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import DataTable from '../../components/seo/DataTable';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import { useLocale } from '../../lib/seo/LocaleContext';
import { copy as copyAll } from './content/cookiesCopy';

export default function CookiesPage() {
  const locale = useLocale();
  const c = copyAll[locale];

  const crumbs: Crumb[] = [
    { label: c.breadcrumbs.home, href: '/' },
    { label: c.breadcrumbs.cookies, href: '/cookies' },
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
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/cookies' },
  };

  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: c.meta.title,
    url: 'https://eurovision.games/cookies',
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
        canonical="https://eurovision.games/cookies"
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
        <Section title={c.whatWeUse.title}>
          <p>{c.whatWeUse.intro}</p>
          <DataTable
            headers={c.whatWeUse.headers as unknown as string[]}
            align={['left', 'left', 'left']}
            rows={c.whatWeUse.rows.map((row, i) => [
              <strong key={`cat-${i}`} className="text-white">{row.category}</strong>,
              row.purpose,
              <span
                key={`def-${i}`}
                className={row.defaultTone === 'pink' ? 'text-euro-pink-light' : 'text-white/70'}
              >
                {row.defaultText}
              </span>,
            ])}
          />
        </Section>

        <Section title={c.notUsed.title}>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.notUsed.items.map((item, i) => (
              <li key={i}>
                <strong className="text-white">{item.bold}</strong>{item.rest}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.changeConsent.title}>
          <p>
            {c.changeConsent.intro.lead}
            <em>{c.changeConsent.intro.emphasis}</em>
            {c.changeConsent.intro.tail}
          </p>
          <div className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.04] p-6">
            <h3 className="text-white font-bold text-lg mb-2">{c.changeConsent.cardTitle}</h3>
            <p className="text-white/80 text-[15px] leading-relaxed mb-4">
              {c.changeConsent.cardBody}
            </p>
            <button
              type="button"
              data-cc="show-preferencesModal"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-euro-purple-light to-euro-pink text-white font-bold text-sm hover:opacity-95 transition shadow-lg shadow-euro-pink/20"
            >
              {c.changeConsent.buttonLabel}
            </button>
          </div>
        </Section>

        <Section title={c.whereDataLives.title}>
          <p>
            {c.whereDataLives.intro.lead}
            <a href="/privacy" className="text-euro-pink-light hover:text-white underline underline-offset-2">
              {c.whereDataLives.intro.linkLabel}
            </a>
            {c.whereDataLives.intro.tail}
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.whereDataLives.items.map((item, i) => (
              <li key={i}>
                <strong className="text-white">{item.bold}</strong>{item.rest}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.banner.title}>
          <p>
            {c.banner.intro.lead}
            <em>{c.banner.intro.accept}</em>
            {c.banner.intro.mid1}
            <em>{c.banner.intro.reject}</em>
            {c.banner.intro.mid2}
            <em>{c.banner.intro.manage}</em>
            {c.banner.intro.tail}
          </p>
        </Section>

        <RelatedCards items={c.related} />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
