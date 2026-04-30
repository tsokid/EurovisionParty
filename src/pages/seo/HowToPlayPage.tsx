import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import CtaBanner from '../../components/seo/CtaBanner';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import { useLocale } from '../../lib/seo/LocaleContext';
import { copy as copyAll } from './content/howToPlayCopy';

export default function HowToPlayPage() {
  const locale = useLocale();
  const c = copyAll[locale];

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.current, href: '/how-to-play' },
  ];

  const PUBLISHED = '2026-04-30T00:00:00Z';
  const MODIFIED = '2026-04-30T00:00:00Z';

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
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/how-to-play' },
  };

  const howTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: c.schema.howToName,
    description: c.schema.howToDescription,
    totalTime: 'PT2M',
    step: c.schema.steps.map((s) => ({ '@type': 'HowToStep', name: s.name, text: s.text })),
  };

  return (
    <>
      <SchemaHead
        title={c.meta.title}
        description={c.meta.description}
        canonical="https://eurovision.games/how-to-play"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        ogLocale={locale === 'el' ? 'el_GR' : 'en_US'}
        ogLocaleAlternate={[locale === 'el' ? 'en_US' : 'el_GR']}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={c.meta.keywords}
        jsonLd={[article, howTo, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip={c.hero.chip}
        chipTone="pink"
        title={c.hero.title}
        lede={c.hero.lede}
      />

      <ContentLayout>
        <Section title={c.setup.title}>
          <p>{c.setup.intro}</p>
          <ol className="list-decimal pl-6 space-y-2 text-white/80 marker:text-euro-pink-light marker:font-bold">
            {c.setup.items.map((it, i) => (
              <li key={i}>
                <strong className="text-white">{it.strong}</strong>{' '}
                <span dangerouslySetInnerHTML={{ __html: it.rest }} />
              </li>
            ))}
          </ol>
        </Section>

        <Section title={c.predictions.title}>
          <p>{c.predictions.intro}</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.predictions.items.map((it, i) => (
              <li key={i}>
                <strong className="text-white">{it.label}</strong> {it.body}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.duels.title}>
          <p>{c.duels.intro}</p>
          <div className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.04] p-6">
            <h3 className="text-white font-bold text-lg mb-2">{c.duels.cardTitle}</h3>
            <p
              className="text-white/85 text-[15px] leading-relaxed [&_strong]:text-white"
              dangerouslySetInnerHTML={{ __html: c.duels.cardBody }}
            />
          </div>
          <p className="text-white/70 text-[15px]">{c.duels.capLine}</p>
        </Section>

        <Section title={c.scoring.title}>
          <p>{c.scoring.intro}</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.scoring.items.map((it, i) => (
              <li key={i}>
                <strong className="text-white">{it.strong}</strong> {it.rest}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.trophies.title}>
          <p>{c.trophies.intro}</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.trophies.items.map((it, i) => (
              <li key={i}>
                <strong className="text-white">{it.strong}</strong> {it.rest}
              </li>
            ))}
          </ul>
          <p className="text-white/70 text-[15px]">{c.trophies.note}</p>
        </Section>

        <Section title={c.suddenDeath.title}>
          <p>{c.suddenDeath.body}</p>
        </Section>

        <Section title={c.whatYouNeed.title}>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.whatYouNeed.items.map((it, i) => (
              <li key={i}>
                <strong className="text-white">{it.strong}</strong> {it.rest}
              </li>
            ))}
          </ul>
        </Section>

        <CtaBanner
          title={c.cta.title}
          body={c.cta.body}
          primary={{ label: c.cta.primary, href: '/?action=create' }}
          secondary={{ label: c.cta.secondary, href: '/eurovision-night' }}
        />

        <RelatedCards items={c.related.items} />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
