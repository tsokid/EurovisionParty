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
import { copy as copyAll } from './content/eurovisionNightCopy';

export default function EurovisionNightPage() {
  const locale = useLocale();
  const c = copyAll[locale];

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.current, href: '/eurovision-night' },
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
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/eurovision-night' },
  };
  const howTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: c.howTo.name,
    step: c.howTo.steps.map((s) => ({ '@type': 'HowToStep', name: s.name, text: s.text })),
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
        canonical="https://eurovision.games/eurovision-night"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        ogLocale={locale === 'el' ? 'el_GR' : 'en_US'}
        ogLocaleAlternate={[locale === 'el' ? 'en_US' : 'el_GR']}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={c.meta.keywords}
        jsonLd={[article, howTo, faqJsonLd, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip={c.hero.chip}
        chipTone="pink"
        title={c.hero.title}
        lede={c.hero.lede}
      />

      <ContentLayout>
        <Section title={c.sections.what.title}>
          <p>
            {c.sections.what.bodyBefore}
            <strong className="text-white">{c.sections.what.bodyDate}</strong>
            {c.sections.what.bodyAfter}
          </p>
        </Section>

        <Section title={c.sections.playbook.title}>
          <ol className="space-y-3">
            {c.sections.playbook.steps.map((s) => (
              <li key={s.boldHead}>
                <strong className="text-white">{s.boldHead}</strong>
                {s.rest}
                {s.href && s.linkLabel && (
                  <a
                    href={s.href}
                    className="text-euro-pink-light hover:text-white underline underline-offset-2"
                  >
                    {s.linkLabel}
                  </a>
                )}
                {s.restAfter}
              </li>
            ))}
          </ol>
        </Section>

        <Section title={c.sections.food.title}>
          <p>{c.sections.food.body}</p>
        </Section>

        <Section title={c.sections.timezones.title}>
          <p>{c.sections.timezones.body}</p>
        </Section>

        <Section title={c.sections.inRoomGames.title}>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.sections.inRoomGames.bullets.map((b) => (
              <li key={b.strong}>
                <strong className="text-white">{b.strong}</strong>
                {b.rest}
              </li>
            ))}
          </ul>
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
