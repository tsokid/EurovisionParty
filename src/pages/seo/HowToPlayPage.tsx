import { pageModified } from '../../lib/seo/pageDates';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import CtaBanner from '../../components/seo/CtaBanner';
import RelatedCards from '../../components/seo/RelatedCards';
import PageTail from '../../components/seo/PageTail';
import LocaleLink from '../../components/seo/LocaleLink';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import { Button } from '../../components/stage';
import { useLocale } from '../../lib/seo/LocaleContext';
import { pageUrl } from '../../lib/seo/registry';
import { usePageContent } from '../../lib/cms/usePageContent';
import { SCORING } from '../../lib/constants';
import ExtraBlocks from '../../components/cms/ExtraBlocks';
import { mergeFaqJsonLd } from '../../components/cms/extraFaq';
import type { HowToPlayContent } from '../../../supabase/functions/_shared/cms/schemas/how-to-play';
import { PageContentFallback } from './PageContentFallback';
import { useSiteSettings } from '../../lib/cms/siteSettings';

const P = SCORING.prediction;

/** "Φτιάξε το δωμάτιο (10δ)." → title + short chip ("10δ"); a long parenthesis stays in the title. */
function splitStep(strong: string): { title: string; chip: string | null } {
  const text = strong.trim().replace(/\.$/, '');
  const m = /^(.*?)\s*\(([^)]{1,12})\)$/.exec(text);
  return m ? { title: m[1], chip: m[2] } : { title: text, chip: null };
}

const Tick = () => (
  <svg className="tick" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12l5 5L20 7" />
  </svg>
);

/** Check-mark list: bold lead-in, then the rest of the sentence. */
function Ticks({ items }: { items: { strong: string; rest: string }[] }) {
  return (
    <ul className="ticks">
      {items.map((it, i) => (
        <li key={i}>
          <Tick />
          <span><strong>{it.strong}</strong> {it.rest}</span>
        </li>
      ))}
    </ul>
  );
}

/** One numbered guide section (howto board): eyebrow number, H2, body. */
function GuideSection({ id, n, title, intro, children }: { id: string; n: number; title: string; intro?: ReactNode; children?: ReactNode }) {
  return (
    <section id={id} className="cs guide-sec" aria-labelledby={`${id}-h`}>
      <div className="guide-head">
        <span className="t-eyebrow">{String(n).padStart(2, '0')}</span>
        <h2 id={`${id}-h`} className="t-h2 text-stage-text">{title}</h2>
        {intro && <p className="t-body">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

export default function HowToPlayPage() {
  const locale = useLocale();
  const settings = useSiteSettings();
  const { t } = useTranslation();
  const content = usePageContent<HowToPlayContent>('how-to-play');
  if (content.status !== 'ready') return <PageContentFallback state={content} />;
  const c = content.data;

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.current, href: '/how-to-play' },
  ];

  const PUBLISHED = '2026-04-30T00:00:00Z'; // fact: date the page was first published
  const MODIFIED = pageModified('how-to-play'); // the page's last change, from git (sitemap lastmod)

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: c.schema.articleHeadline,
    description: c.schema.articleDescription,
    image: settings.defaultOgImage,
    author: { '@type': 'Organization', name: settings.organization.name, url: 'https://eurovision.games' },
    publisher: {
      '@type': 'Organization',
      name: settings.organization.name,
      logo: { '@type': 'ImageObject', url: settings.defaultOgImage },
    },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl('how-to-play', locale) },
  };

  const howTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: c.schema.howToName,
    description: c.schema.howToDescription,
    totalTime: 'PT2M',
    step: c.schema.steps.map((s) => ({ '@type': 'HowToStep', name: s.name, text: s.text })),
  };

  // Board order: setup, duels, predictions, live scoring, trophies, sudden death, what you need.
  const toc = [
    { id: 'setup', title: c.setup.title },
    { id: 'duels', title: c.duels.title },
    { id: 'predictions', title: c.predictions.title },
    { id: 'scoring', title: c.scoring.title },
    { id: 'trophies', title: c.trophies.title },
    { id: 'sudden-death', title: c.suddenDeath.title },
    { id: 'what-you-need', title: c.whatYouNeed.title },
  ];
  const nOf = (id: string) => toc.findIndex((s) => s.id === id) + 1;

  const lastStep = c.setup.items.length - 1;

  const heroAside = (
    <div className="howto-start">
      <dl className="howto-stats">
        <div className="stat">
          <dt className="k">{t('howToGuide.statSetup')}</dt>
          <dd className="v num text-stage-gold">60″</dd>
        </div>
        <div className="stat">
          <dt className="k">{t('howToGuide.statPlayers')}</dt>
          <dd className="v num">2–20</dd>
        </div>
        <div className="stat">
          <dt className="k">{t('howToGuide.statTrophies')}</dt>
          <dd className="v num">{c.trophies.items.length}</dd>
        </div>
      </dl>
      <Button to="/?action=create" size="lg" block>{c.cta.primary}</Button>
      <p className="t-meta howto-note">{c.cta.body}</p>
    </div>
  );

  return (
    <>
      <PageSeo
        pageId="how-to-play"
        locale={locale}
        title={c.meta.title}
        description={c.meta.description}
        ogType="article"
        ogImage={settings.defaultOgImage}
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={c.meta.keywords}
        jsonLd={mergeFaqJsonLd([article, howTo, breadcrumbJsonLd(crumbs, locale)], c.extraBlocks)}
      />

      <PageHero
        cms="hero"
        crumbs={crumbs}
        chip={c.hero.chip}
        chipTone="pink"
        title={c.hero.title}
        lede={c.hero.lede}
        aside={heroAside}
      />

      <div className="howto-seg">
        <nav aria-label={t('howToGuide.onThisPage')} className="seg wrap-seg">
          {toc.map((s) => <a key={s.id} href={`#${s.id}`}>{s.title}</a>)}
        </nav>
      </div>

      <div className="wrap pg-body toc-left">
        <aside className="pg-aside howto-aside">
          <nav aria-label={t('howToGuide.onThisPage')} className="card toc">
            <span className="t-eyebrow toc-k">{t('howToGuide.onThisPage')}</span>
            {toc.map((s, i) => (
              <a key={s.id} href={`#${s.id}`}>
                <span className="num">{String(i + 1).padStart(2, '0')}</span>
                <span>{s.title}</span>
              </a>
            ))}
          </nav>
          <form className="card toc-join" action={`/${locale}/`} method="get">
            <label htmlFor="howto-join" className="t-eyebrow">{t('howToGuide.haveCode')}</label>
            <div className="toc-join-row">
              <input
                id="howto-join"
                name="join"
                className="join-input"
                aria-label={t('howToGuide.codeLabel')}
                placeholder={t('howToGuide.codePlaceholder')}
                maxLength={6}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
              />
              <button type="submit" className="btn btn-secondary btn-sm">{t('howToGuide.codeSubmit')}</button>
            </div>
          </form>
        </aside>

        <div className="pg-main guide">
          <GuideSection id="setup" n={nOf('setup')} title={c.setup.title} intro={c.setup.intro}>
            <ol className="hsteps">
              {c.setup.items.map((it, i) => {
                const { title, chip } = splitStep(it.strong);
                return (
                  <li key={i} className={i === lastStep && i > 0 ? 'hstep last' : 'hstep'}>
                    {i === lastStep && i > 0 && (
                      <div className="hstep-lock">
                        <span className="hstep-dot live" aria-hidden>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="5" y="11" width="14" height="10" rx="2" />
                            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                          </svg>
                        </span>
                        <div className="hstep-live">
                          <div className="phase"><span className="dot" />{t('howToGuide.lockTitle')}</div>
                          <div className="t-small">{t('howToGuide.lockBody')}</div>
                        </div>
                      </div>
                    )}
                    <div className="hstep-row">
                      <span className={i === lastStep && i > 0 ? 'hstep-dot num gold' : 'hstep-dot num'} aria-hidden>{i + 1}</span>
                      <div className="card hstep-card">
                        <div className="hstep-head">
                          <h3 className="t-h3">{title}</h3>
                          {chip && <span className="chip hstep-chip">{chip}</span>}
                        </div>
                        <p className="t-small m-0" dangerouslySetInnerHTML={{ __html: it.rest }} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </GuideSection>

          <GuideSection id="duels" n={nOf('duels')} title={c.duels.title} intro={c.duels.intro}>
            <div className="card duel-card">
              <h3 className="t-h3">{c.duels.cardTitle}</h3>
              <p className="t-small m-0" dangerouslySetInnerHTML={{ __html: c.duels.cardBody }} />
            </div>
            <p className="t-small m-0">{c.duels.capLine}</p>
          </GuideSection>

          <GuideSection id="predictions" n={nOf('predictions')} title={c.predictions.title} intro={c.predictions.intro}>
            <div className="guide-split">
              <Ticks items={c.predictions.items.map((it) => ({ strong: it.label, rest: it.body }))} />
              <div className="guide-points">
                <dl className="howto-pts">
                  <div className="stat gold">
                    <dt className="k">{t('howToGuide.exact')}</dt>
                    <dd className="v num">{P.exactPosition}</dd>
                  </div>
                  <div className="stat">
                    <dt className="k">{t('howToGuide.listOnly')}</dt>
                    <dd className="v num">{P.inTop5}</dd>
                  </div>
                </dl>
                <LocaleLink to="/eurovision-predictions" className="guide-more">
                  {t('howToGuide.predictionsLink')}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </LocaleLink>
              </div>
            </div>
          </GuideSection>

          <GuideSection id="scoring" n={nOf('scoring')} title={c.scoring.title} intro={c.scoring.intro}>
            <Ticks items={c.scoring.items} />
          </GuideSection>

          <GuideSection id="trophies" n={nOf('trophies')} title={c.trophies.title} intro={c.trophies.intro}>
            <ul className="trophies">
              {c.trophies.items.map((it, i) => (
                <li key={i} className="card trophy">
                  <span className="ico trophy-ico" aria-hidden>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3" />
                    </svg>
                  </span>
                  <span><strong>{it.strong}</strong> <span className="t-small">{it.rest}</span></span>
                </li>
              ))}
            </ul>
            <p className="t-small m-0">{c.trophies.note}</p>
          </GuideSection>

          <GuideSection id="sudden-death" n={nOf('sudden-death')} title={c.suddenDeath.title}>
            <div className="card card-pad sd-card">
              <p className="t-body">{c.suddenDeath.body}</p>
            </div>
          </GuideSection>

          <GuideSection id="what-you-need" n={nOf('what-you-need')} title={c.whatYouNeed.title}>
            <Ticks items={c.whatYouNeed.items} />
          </GuideSection>

          <div className="stage-prose guide-extra">
            <ExtraBlocks value={c.extraBlocks} />
          </div>
        </div>
      </div>
      <PageTail>
        <CtaBanner
          title={c.cta.title}
          body={c.cta.body}
          primary={{ label: c.cta.primary, href: '/?action=create' }}
          secondary={{ label: c.cta.secondary, href: '/eurovision-night' }}
        />

        <RelatedCards items={c.related.items} />
      </PageTail>
      <SiteFooter />
    </>
  );
}
