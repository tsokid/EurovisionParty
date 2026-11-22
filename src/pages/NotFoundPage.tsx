import SchemaHead from '../components/seo/SchemaHead';
import SiteFooter from '../components/seo/SiteFooter';
import PageHero from '../components/seo/PageHero';
import { IconLink, type IconName } from '../components/seo/StageKit';
import { Button } from '../components/stage';
import { useTranslation } from 'react-i18next';
import { useCurrentContest } from '../lib/currentContest';
import { COUNTRY_INDEX_PATH, hubPath } from '../lib/seo/dynamicPages';
import { cityName } from './contest/content/hubCopy';
import CtaBanner from '../components/seo/CtaBanner';
import { breadcrumbJsonLd, type Crumb } from '../components/seo/Breadcrumbs';
import { useLocale } from '../lib/seo/LocaleContext';
import { useHeadCollector } from '../lib/seo/HeadContext';
import { usePageContent } from '../lib/cms/usePageContent';
import ExtraBlocks from '../components/cms/ExtraBlocks';
import { mergeFaqJsonLd } from '../components/cms/extraFaq';
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
    <>
      <main className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <h1 className="t-h1 text-stage-text">{f.title}</h1>
        <LocaleLink to="/" className="btn btn-primary">{f.home}</LocaleLink>
      </main>
      <SiteFooter />
    </>
  );
}

export function NotFoundPage() {
  const locale = useLocale();
  const { t } = useTranslation();
  const cc = useCurrentContest();
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

  const popular: { href: string; icon: IconName; title: string; blurb: string }[] = [
    { href: '/eurovision-night', icon: 'mic', title: c.related.night.title, blurb: c.related.night.blurb },
    { href: '/eurovision-predictions', icon: 'list', title: c.related.predictions.title, blurb: c.related.predictions.blurb },
    { href: '/eurovision-trivia', icon: 'help', title: c.related.trivia.title, blurb: c.related.trivia.blurb },
    { href: '/duels', icon: 'swords', title: c.related.duels.title, blurb: c.related.duels.blurb },
    { href: '/dashboard', icon: 'chart', title: c.related.dashboard.title, blurb: c.related.dashboard.blurb },
    { href: '/how-to-play', icon: 'play', title: c.related.howToPlay.title, blurb: c.related.howToPlay.blurb },
    { href: '/scoring', icon: 'calc', title: c.related.scoring.title, blurb: c.related.scoring.blurb },
    { href: '/faq', icon: 'alert', title: c.related.faq.title, blurb: c.related.faq.blurb },
  ];
  const d = (iso: string | null) => (iso ? Number(iso.slice(8, 10)) : null);
  const s1 = d(cc.semi1Date);
  const fin = d(cc.finalDate);
  const city = cityName(locale, cc.citySlug, cc.city).name;
  const hubBlurb = s1 && fin && cc.finalDate
    ? `${city}, ${s1}–${fin} ${t(`notFoundPage.month.${Number(cc.finalDate.slice(5, 7))}`)}`
    : city;

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
        jsonLd={mergeFaqJsonLd([breadcrumbJsonLd(crumbs, locale)], c.extraBlocks)}
      />

      <PageHero
        cms="hero"
        crumbs={crumbs}
        title={c.hero.title}
        lede={c.hero.lede}
        className="nf-hero"
        aside={
          <div className="nf-art" aria-hidden>
            <span className="nf-4">4</span>
            <span className="nf-coin">NUL</span>
            <span className="nf-4">4</span>
          </div>
        }
      >
        <div className="kit-actions">
          <Button to="/" size="lg">{c.cta.primary}</Button>
          <Button to="/how-to-play" variant="ghost" size="lg">{c.cta.secondary}</Button>
        </div>
      </PageHero>

      <div className="wrap nf-body">
        <section className="nf-sec" aria-labelledby="related-heading">
          <h2 id="related-heading" className="t-h2">{c.related.heading}</h2>
          <div className="kit-grid c4">
            {popular.map((it) => <IconLink key={it.href} to={it.href} icon={it.icon} title={it.title} blurb={it.blurb} />)}
          </div>
        </section>

        <section className="nf-sec" aria-labelledby="nf-ev-h">
          <h2 id="nf-ev-h" className="t-h2">Eurovision</h2>
          <div className="kit-grid c3">
            <IconLink to={hubPath(cc.year)} icon="globe" title={`Eurovision ${cc.year}`} blurb={hubBlurb} />
            <IconLink to="/winners" icon="trophy" title={t('notFoundPage.winnersTitle')} blurb={t('home.guides.winnersDesc')} />
            <IconLink to={COUNTRY_INDEX_PATH} icon="globe" title={t('notFoundPage.countriesTitle')} blurb={t('notFoundPage.countriesBlurb')} />
          </div>
        </section>

        <div className="stage-prose guide-extra">
          <ExtraBlocks value={c.extraBlocks} />
        </div>

        <CtaBanner
          title={c.cta.title}
          body={c.cta.body}
          primary={{ label: c.cta.primary, href: '/' }}
          secondary={{ label: c.cta.secondary, href: '/how-to-play' }}
        />
      </div>
      <SiteFooter />
    </>
  );
}
