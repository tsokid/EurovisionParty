import SchemaHead from '../components/seo/SchemaHead';
import SiteFooter from '../components/seo/SiteFooter';
import PageHero from '../components/seo/PageHero';
import ContentLayout from '../components/seo/ContentLayout';
import RelatedCards from '../components/seo/RelatedCards';
import CtaBanner from '../components/seo/CtaBanner';
import { breadcrumbJsonLd, type Crumb } from '../components/seo/Breadcrumbs';
import { useLocale } from '../lib/seo/LocaleContext';
import { copy as copyAll } from './content/notFoundCopy';

export function NotFoundPage() {
  const locale = useLocale();
  const c = copyAll[locale];

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.notFound, href: '/' },
  ];

  return (
    <>
      <SchemaHead
        title={c.meta.title}
        description={c.meta.description}
        canonical="https://eurovision.games/404"
        ogType="website"
        ogImage="https://eurovision.games/logo.png"
        ogLocale={locale === 'el' ? 'el_GR' : 'en_US'}
        ogLocaleAlternate={[locale === 'el' ? 'en_US' : 'el_GR']}
        keywords={c.meta.keywords}
        jsonLd={[breadcrumbJsonLd(crumbs)]}
      />

      <PageHero
        crumbs={crumbs}
        chip={c.hero.chip}
        chipTone="pink"
        title={c.hero.title}
        lede={c.hero.lede}
      />

      <ContentLayout>
        <CtaBanner
          title={c.cta.title}
          body={c.cta.body}
          primary={{ label: c.cta.primary, href: '/' }}
          secondary={{ label: c.cta.secondary, href: '/how-to-play' }}
        />

        <RelatedCards
          heading={c.related.heading}
          items={[
            { href: '/eurovision-night', title: c.related.night.title, blurb: c.related.night.blurb },
            { href: '/eurovision-2026-predictions', title: c.related.predictions.title, blurb: c.related.predictions.blurb },
            { href: '/eurovision-trivia', title: c.related.trivia.title, blurb: c.related.trivia.blurb },
            { href: '/duels', title: c.related.duels.title, blurb: c.related.duels.blurb },
            { href: '/dashboard', title: c.related.dashboard.title, blurb: c.related.dashboard.blurb },
            { href: '/how-to-play', title: c.related.howToPlay.title, blurb: c.related.howToPlay.blurb },
            { href: '/scoring', title: c.related.scoring.title, blurb: c.related.scoring.blurb },
            { href: '/faq', title: c.related.faq.title, blurb: c.related.faq.blurb },
          ]}
        />
      </ContentLayout>
      <SiteFooter />
    </>
  );
}
