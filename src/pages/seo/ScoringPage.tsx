import type { ReactNode } from 'react';
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
import { copy as copyAll } from './content/scoringCopy';

interface RowSpec {
  label: string;
  value: string;
  tone: 'strong' | 'muted' | 'pinkBonus';
}

function renderRow(rows: RowSpec[]): ReactNode[][] {
  return rows.map((r, i) => {
    const valueNode =
      r.tone === 'muted' ? (
        <span key={`v-${i}`} className="text-white/50">{r.value}</span>
      ) : r.tone === 'pinkBonus' ? (
        <strong key={`v-${i}`} className="text-euro-pink-light">{r.value}</strong>
      ) : (
        <strong key={`v-${i}`} className="text-white">{r.value}</strong>
      );
    return [r.label, valueNode];
  });
}

export default function ScoringPage() {
  const locale = useLocale();
  const c = copyAll[locale];

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.current, href: '/scoring' },
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
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://eurovision.games/scoring' },
  };

  return (
    <>
      <SchemaHead
        title={c.meta.title}
        description={c.meta.description}
        canonical="https://eurovision.games/scoring"
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
        chipTone="gold"
        title={c.hero.title}
        lede={c.hero.lede}
      />

      <ContentLayout>
        <Section title={c.quiz.title}>
          <p>{c.quiz.intro}</p>
          <DataTable
            headers={c.quiz.headers as unknown as string[]}
            align={['left', 'right']}
            rows={renderRow(c.quiz.rows)}
          />
          <p
            className="text-white/70 text-[15px] [&_strong]:text-white"
            dangerouslySetInnerHTML={{ __html: c.quiz.note }}
          />
        </Section>

        <Section title={c.top5.title}>
          <p>{c.top5.intro}</p>
          <DataTable
            headers={c.top5.headers as unknown as string[]}
            align={['left', 'right']}
            rows={renderRow(c.top5.rows)}
          />
          <p
            className="text-white/70 text-[15px] [&_strong]:text-white"
            dangerouslySetInnerHTML={{ __html: c.top5.note }}
          />
        </Section>

        <Section title={c.worst5.title}>
          <p>{c.worst5.intro}</p>
          <DataTable
            headers={c.worst5.headers as unknown as string[]}
            align={['left', 'right']}
            rows={renderRow(c.worst5.rows)}
          />
          <p
            className="text-white/70 text-[15px] [&_strong]:text-white"
            dangerouslySetInnerHTML={{ __html: c.worst5.note }}
          />
        </Section>

        <Section title={c.duel.title}>
          <p>{c.duel.intro}</p>
          <DataTable
            headers={c.duel.headers as unknown as string[]}
            align={['left', 'right']}
            rows={renderRow(c.duel.rows)}
          />
          <p
            className="[&_strong]:text-white"
            dangerouslySetInnerHTML={{ __html: c.duel.body }}
          />
        </Section>

        <Section title={c.stealDouble.title}>
          <p>{c.stealDouble.intro}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-euro-pink/30 bg-euro-pink/[0.05] p-6">
              <h3 className="text-white font-bold text-lg mb-2">{c.stealDouble.stealTitle}</h3>
              <p
                className="text-white/80 text-[15px] leading-relaxed"
                dangerouslySetInnerHTML={{ __html: c.stealDouble.stealBody }}
              />
            </div>
            <div className="rounded-2xl border border-euro-purple-light/30 bg-euro-purple-light/[0.05] p-6">
              <h3 className="text-white font-bold text-lg mb-2">{c.stealDouble.doubleTitle}</h3>
              <p
                className="text-white/80 text-[15px] leading-relaxed"
                dangerouslySetInnerHTML={{ __html: c.stealDouble.doubleBody }}
              />
            </div>
          </div>
          <p
            className="text-white/70 text-[15px]"
            dangerouslySetInnerHTML={{ __html: c.stealDouble.note }}
          />
        </Section>

        <Section title={c.penalties.title}>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.penalties.items.map((it, i) => (
              <li key={i}>
                <strong className="text-white">{it.strong}</strong>{' '}
                <span dangerouslySetInnerHTML={{ __html: it.rest }} />
              </li>
            ))}
          </ul>
        </Section>

        <Section title={c.example.title}>
          <p>{c.example.intro}</p>
          <ul className="list-disc pl-6 space-y-1.5 text-white/80">
            {c.example.items.map((it, i) => (
              <li key={i}>
                <strong className="text-white">{it.strong}</strong>{' '}
                <span className="[&_strong]:text-white" dangerouslySetInnerHTML={{ __html: it.rest }} />
              </li>
            ))}
          </ul>
        </Section>

        <CtaBanner
          title={c.cta.title}
          body={c.cta.body}
          primary={{ label: c.cta.primary, href: '/' }}
          secondary={{ label: c.cta.secondary, href: '/how-to-play' }}
        />

        <RelatedCards items={c.related.items} />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
