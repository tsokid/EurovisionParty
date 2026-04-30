import SchemaHead from '../../components/seo/SchemaHead';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import ContentLayout from '../../components/seo/ContentLayout';
import Section from '../../components/seo/Section';
import DataTable from '../../components/seo/DataTable';
import CtaBanner from '../../components/seo/CtaBanner';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import { useLocale } from '../../lib/seo/LocaleContext';
import { copy as copyAll } from './content/rulesCopy';

export default function RulesPage() {
  const locale = useLocale();
  const c = copyAll[locale];

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.current, href: '/rules' },
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
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/rules' },
  };

  return (
    <>
      <SchemaHead
        title={c.meta.title}
        description={c.meta.description}
        canonical="https://eurovision.games/rules"
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        ogLocale={locale === 'el' ? 'el_GR' : 'en_US'}
        ogLocaleAlternate={[locale === 'el' ? 'en_US' : 'el_GR']}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={c.meta.keywords}
        jsonLd={[article, breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip={c.hero.chip}
        chipTone="purple"
        title={c.hero.title}
        lede={c.hero.lede}
      />

      <ContentLayout>
        <Section title={c.hostLimits.title}>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.hostLimits.items.map((it, i) => (
              <li key={i}>
                <strong className="text-white">{it.strong}</strong> {it.rest}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.phases.title}>
          <p>{c.phases.intro}</p>
          <DataTable
            headers={c.phases.headers as unknown as string[]}
            align={['left', 'left', 'left']}
            rows={c.phases.rows.map((r) => [r[0], r[1], r[2]])}
          />
        </Section>

        <Section title={c.predictions.title}>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.predictions.items.map((it, i) => (
              <li key={i}>
                <strong className="text-white">{it.strong}</strong> {it.rest}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.quiz.title}>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.quiz.items.map((it, i) => (
              <li key={i}>
                <strong className="text-white">{it.strong}</strong> {it.rest}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.duels.title}>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.duels.items.map((it, i) => (
              <li key={i}>
                <strong className="text-white">{it.strong}</strong>{' '}
                <span dangerouslySetInnerHTML={{ __html: it.rest }} />
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
          <div className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.04] p-6">
            <h3 className="text-white font-bold text-lg mb-2">{c.suddenDeath.cardTitle}</h3>
            <p className="text-white/85 text-[15px] leading-relaxed">{c.suddenDeath.cardBody}</p>
          </div>
        </Section>

        <Section title={c.disconnect.title}>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.disconnect.items.map((it, i) => (
              <li key={i}>
                <strong className="text-white">{it.strong}</strong> {it.rest}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.edgeCases.title}>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.edgeCases.items.map((it, i) => (
              <li key={i}>
                <strong className="text-white">{it.strong}</strong> {it.rest}
              </li>
            ))}
          </ul>
        </Section>

        <CtaBanner
          title={c.cta.title}
          body={c.cta.body}
          primary={{ label: c.cta.primary, href: '/' }}
          secondary={{ label: c.cta.secondary, href: '/scoring' }}
        />

        <RelatedCards items={c.related.items} />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
