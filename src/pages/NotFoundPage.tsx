import SchemaHead from '../components/seo/SchemaHead';
import SiteFooter from '../components/seo/SiteFooter';
import PageHero from '../components/seo/PageHero';
import ContentLayout from '../components/seo/ContentLayout';
import RelatedCards from '../components/seo/RelatedCards';
import CtaBanner from '../components/seo/CtaBanner';
import { breadcrumbJsonLd, type Crumb } from '../components/seo/Breadcrumbs';
import { useLocale } from '../lib/seo/LocaleContext';
import { useHeadCollector } from '../lib/seo/HeadContext';
import { usePageContent } from '../lib/cms/usePageContent';
import type { NotFoundContent } from '../../supabase/functions/_shared/cms/schemas/not-found';
import LocaleLink from '../components/seo/LocaleLink';
import type { Locale } from '../lib/seo/locale';

const FALLBACK: Record<Locale, { title: string; home: string }> = {
  en: { title: 'Page not found', home: 'Home' },
  el: { title: 'Η σελίδα δεν βρέθηκε', home: 'Αρχική' },
};

/**
 * While content/pages/not-found.json is loading (or missing) on the client.
 * Hardcoded on purpose: PageContentFallback renders NotFoundPage for a
 * missing doc, so this page must never fall back to it for its own doc.
 */
function MinimalNotFound({ locale }: { locale: Locale }) {
  const f = FALLBACK[locale];
  return (
    <main className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-white text-2xl font-bold">{f.title}</h1>
      <LocaleLink to="/" className="text-euro-pink-light hover:underline">{f.home}</LocaleLink>
    </main>
  );
}

export function NotFoundPage() {
  const locale = useLocale();
  // Prerender: mark this response as a real 404 (no-op in the browser).
  useHeadCollector()?.setStatus(404);
  // The server render throws if the doc is missing, so the build fails.
  const content = usePageContent<NotFoundContent>('not-found');
  if (content.status !== 'ready') return <MinimalNotFound locale={locale} />;
  const c = content.data;

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.notFound, href: '/' },
  ];

  return (
    <>
      <SchemaHead
        title={c.meta.title}
        description={c.meta.description}
        robots="noindex"
        ogType="website"
        ogImage="https://eurovision.games/logo.png"
        ogLocale={locale === 'el' ? 'el_GR' : 'en_US'}
        ogLocaleAlternate={[locale === 'el' ? 'en_US' : 'el_GR']}
        keywords={c.meta.keywords}
        jsonLd={[breadcrumbJsonLd(crumbs, locale)]}
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
            { href: '/eurovision-predictions', title: c.related.predictions.title, blurb: c.related.predictions.blurb },
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
