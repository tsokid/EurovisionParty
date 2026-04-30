import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import DataTable from '../../components/seo/DataTable';
import FaqAccordion from '../../components/seo/FaqAccordion';
import CtaBanner from '../../components/seo/CtaBanner';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import { useLocale } from '../../lib/seo/LocaleContext';
import { copy as copyAll } from './content/dashboardCopy';

export default function DashboardPage() {
  const locale = useLocale();
  const c = copyAll[locale];

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.current, href: '/dashboard' },
  ];

  const PUBLISHED = '2026-04-30T00:00:00Z';
  const MODIFIED = '2026-04-30T00:00:00Z';

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: c.meta.headline,
    description: c.meta.articleDescription,
    image: 'https://eurovision.games/logo.png',
    author: { '@type': 'Organization', name: 'Eurovision Games', url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: 'Eurovision Games',
      logo: { '@type': 'ImageObject', url: 'https://eurovision.games/logo.png' },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/dashboard' },
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
      <SchemaHead
        title={c.meta.title}
        description={c.meta.description}
        canonical="https://eurovision.games/dashboard"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        ogLocale={locale === 'el' ? 'el_GR' : 'en_US'}
        ogLocaleAlternate={[locale === 'el' ? 'en_US' : 'el_GR']}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={c.meta.keywords}
        jsonLd={[article, faqJsonLd, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip={c.hero.chip}
        chipTone="purple"
        title={c.hero.title}
        lede={c.hero.lede}
      />

      <ContentLayout>
        <Section title={c.sections.shows.title}>
          <p>{c.sections.shows.intro}</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.sections.shows.bullets.map((b) => (
              <li key={b.strong}>
                <strong className="text-white">{b.strong}</strong>
                {b.rest}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.sections.sources.title}>
          <p>{c.sections.sources.intro}</p>
          <DataTable
            headers={c.sections.sources.tableHeaders}
            align={['left', 'left', 'right']}
            rows={c.sections.sources.rows.map((r, i) => [
              r.source,
              r.when,
              r.capIsOpen ? (
                <span key={`cap-${i}`} className="text-white/70">{r.capLabel}</span>
              ) : (
                <strong key={`cap-${i}`} className="text-white">{r.capLabel}</strong>
              ),
            ])}
          />
          <p>
            {c.sections.sources.footer.before}
            <a href="/scoring" className="text-euro-pink-light hover:text-white underline underline-offset-2">
              {c.sections.sources.footer.linkLabel}
            </a>
            {c.sections.sources.footer.after}
          </p>
        </Section>

        <Section title={c.sections.activity.title}>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.sections.activity.bullets.map((b) => (
              <li key={b.strong}>
                <strong className="text-white">{b.strong}</strong>
                {b.rest}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.sections.notShown.title}>
          <p>{c.sections.notShown.intro}</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.sections.notShown.bullets.map((b) => (
              <li key={b.strong}>
                <strong className="text-white">{b.strong}</strong>
                {b.rest}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.sections.hostVsPlayer.title}>
          <p>{c.sections.hostVsPlayer.body}</p>
        </Section>

        <Section title={c.sections.faq.title}>
          <FaqAccordion items={c.faq} />
        </Section>

        <CtaBanner
          title={c.cta.title}
          body={c.cta.body}
          primary={{ label: c.cta.primary, href: '/?action=create' }}
          secondary={{ label: c.cta.secondary, href: '/how-to-play' }}
        />

        <RelatedCards heading={c.related.heading} items={c.related.items} />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
