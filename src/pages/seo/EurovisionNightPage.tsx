import PageSeo from '../../components/seo/PageSeo';
import SiteFooter from '../../components/seo/SiteFooter';
import PageHero from '../../components/seo/PageHero';
import { IconBox, type IconName } from '../../components/seo/StageKit';
import { Button } from '../../components/stage';
import { useTranslation } from 'react-i18next';
import { useDaysUntil } from '../../hooks/useDaysUntil';
import { weekday } from './content/contestText';
import type { CurrentContest } from '../../lib/currentContest';
import type { Locale } from '../../lib/seo/locale';
import FaqAccordion from '../../components/seo/FaqAccordion';
import CtaBanner from '../../components/seo/CtaBanner';
import RelatedCards from '../../components/seo/RelatedCards';
import { breadcrumbJsonLd, type Crumb } from '../../components/seo/Breadcrumbs';
import { useLocale } from '../../lib/seo/LocaleContext';
import { pageUrl } from '../../lib/seo/registry';
import { usePageContent } from '../../lib/cms/usePageContent';
import ExtraBlocks from '../../components/cms/ExtraBlocks';
import { mergeFaqJsonLd } from '../../components/cms/extraFaq';
import type { EurovisionNightContent } from '../../../supabase/functions/_shared/cms/schemas/eurovision-night';
import { PageContentFallback } from './PageContentFallback';
import { interpolate } from '../../../supabase/functions/_shared/cms/placeholders';
import { contestTexts } from './content/contestText';
import { useCurrentContest } from '../../lib/currentContest';

const IN_GAME = new Set([3, 5, 7, 9]); // playbook steps that happen in the app (board chips)
const GAME_ICONS: IconName[] = ['list', 'swords', 'help', 'trophy'];

type Zone = { time: string; tz: string; where: string };

/** "21:00 CEST (Germany, France, Spain)" → rows for the hero card; the sentence stays in the body. */
function parseZones(body: string): Zone[] {
  const out: Zone[] = [];
  const re = /(\d{1,2}:\d{2})\s+([A-Z]{3,5})(?:\/UTC[+-]\d+)?([^()]*?)\(([^)]+)\)/g;
  for (const m of body.matchAll(re)) {
    const extra = m[3].trim();
    const where = m[4].split(/\s+[—–-]\s+/)[0].trim();
    out.push({ time: m[1], tz: m[2], where: extra ? `${where}, ${extra}` : where });
  }
  return out;
}

function FinalCard({ cc, locale, zones, note, label, daysLabel }: {
  cc: CurrentContest; locale: Locale; zones: Zone[]; note: string | null; label: string; daysLabel: string;
}) {
  const days = useDaysUntil(cc.finalDate);
  const d = cc.finalDate;
  return (
    <div className="card-hero night-final">
      <span className="t-eyebrow">{label}</span>
      {d && (
        <div className="night-final-top">
          <time dateTime={d} className="num night-final-date">{`${d.slice(8, 10)}·${d.slice(5, 7)}`}</time>
          <span className="night-final-wd"><strong>{weekday(d, locale)}</strong><span className="t-meta">{d.slice(0, 4)}</span></span>
          {days != null && days >= 0 && (
            <span className="night-final-days"><span className="num">{days}</span><span className="t-meta">{daysLabel}</span></span>
          )}
        </div>
      )}
      {zones.length > 0 && (
        <ul className="night-zones">
          {zones.map((z) => (
            <li key={z.tz + z.time}>
              <span className="t-small">{z.where}</span>
              <span className="night-zone-t"><span className="num">{z.time}</span><span className="t-meta">{z.tz}</span></span>
            </li>
          ))}
        </ul>
      )}
      {note && <p className="t-meta m-0">{note}</p>}
    </div>
  );
}

export default function EurovisionNightPage() {
  const locale = useLocale();
  const { t: tr } = useTranslation();
  const ui = (k: string, o?: Record<string, unknown>) => tr(`nightPage.${k}`, o);
  const cc = useCurrentContest();
  const content = usePageContent<EurovisionNightContent>('eurovision-night');
  if (content.status !== 'ready') return <PageContentFallback state={content} />;
  const c = content.data;
  const t = contestTexts(cc)[locale];
  const vars = { year: t.year, city: t.city, cityFrom: t.cityFrom, finalDay: t.finalDay };
  const fill = (s: string) => interpolate(s, vars);
  const faq = c.faq.map((f) => ({ q: fill(f.q), a: fill(f.a) }));
  const relatedItems = c.related.items.map((it) => ({ ...it, blurb: fill(it.blurb) }));
  const steps = c.sections.playbook.steps.length;
  const zones = parseZones(c.sections.timezones.body);
  // The last sentence of the time-zone tip (open the room early) sits under the rows.
  const zonesNote = zones.length ? (c.sections.timezones.body.split(/(?<=\.)\s+/).filter(Boolean).pop() ?? null) : null;

  const crumbs: Crumb[] = [
    { label: c.crumbs.home, href: '/' },
    { label: c.crumbs.current, href: '/eurovision-night' },
  ];

  const PUBLISHED = '2026-04-30T00:00:00Z'; // fact: date the page was first published
  const MODIFIED = '2026-04-30T00:00:00Z'; // fact: date the page copy was last edited

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
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl('eurovision-night', locale) },
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
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <>
      <PageSeo
        pageId="eurovision-night"
        locale={locale}
        title={fill(c.meta.title)}
        description={c.meta.description}
        ogType="article"
        ogImage="https://eurovision.games/logo.png"
        articlePublishedTime={PUBLISHED}
        articleModifiedTime={MODIFIED}
        keywords={c.meta.keywords.map(fill)}
        jsonLd={mergeFaqJsonLd([article, howTo, faqJsonLd, breadcrumbJsonLd(crumbs, locale)], c.extraBlocks)}
      />

      <PageHero
        crumbs={crumbs}
        chip={c.hero.chip}
        chipTone="pink"
        title={c.hero.title}
        grad="dash"
        lede={c.hero.lede}
        aside={<FinalCard cc={cc} locale={locale} zones={zones} note={zonesNote} label={ui('finalLabel', { city: t.city })} daysLabel={ui('days')} />}
      >
        <div className="kit-actions">
          <Button to="/?action=create" size="lg">{c.cta.primary}</Button>
          <Button to="/how-to-play" variant="ghost" size="lg">{c.cta.secondary}</Button>
        </div>
      </PageHero>

      <div className="wrap pg-body night-body">
        <div className="pg-main">
          <section className="cs night-guide" aria-labelledby="night-guide-h">
            <div className="guide-head">
              <span className="t-eyebrow">{ui('guide')}</span>
              <h2 id="night-guide-h" className="t-h2">{c.sections.playbook.title}</h2>
            </div>
            <ol className="night-steps">
              {c.sections.playbook.steps.map((s, i) => {
                const head = s.boldHead.replace(/^\d+\.\s*/, '').replace(/\.$/, '');
                const inGame = IN_GAME.has(i) && steps === 10;
                return (
                  <li key={s.boldHead} className={inGame ? 'night-step in' : 'night-step'}>
                    <span className="night-n num" aria-hidden>{i + 1}</span>
                    <div className="night-step-b">
                      <h3 className="t-h3">
                        {head}
                        {inGame && <span className="chip chip-pink night-chip">{ui('inGame')}</span>}
                      </h3>
                      <p className="t-small m-0">
                        {fill(s.rest)}
                        {s.href && s.linkLabel && <a href={s.href}>{s.linkLabel}</a>}
                        {s.restAfter}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="cs" aria-labelledby="night-room-h">
            <div className="guide-head">
              <span className="t-eyebrow">{ui('inRoom')}</span>
              <h2 id="night-room-h" className="t-h2">{c.sections.inRoomGames.title}</h2>
            </div>
            <ul className="kit-grid c4 night-games">
              {c.sections.inRoomGames.bullets.map((b, i) => (
                <li key={b.strong} className="card night-game">
                  <IconBox name={GAME_ICONS[i % GAME_ICONS.length]} size={18} />
                  <h3 className="t-h3">{b.strong.replace(/:\s*$/, '')}</h3>
                  <p className="t-small m-0">{b.rest.trim()}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="cs" aria-labelledby="night-tz-h">
            <h2 id="night-tz-h" className="t-h2">{c.sections.timezones.title}</h2>
            <p className="t-body">{c.sections.timezones.body}</p>
          </section>

          <div className="stage-prose guide-extra">
            <ExtraBlocks value={c.extraBlocks} />
          </div>

          <CtaBanner
            title={c.cta.title}
            body={c.cta.body}
            primary={{ label: c.cta.primary, href: '/?action=create' }}
            secondary={{ label: c.cta.secondary, href: '/how-to-play' }}
          />

          <RelatedCards heading={c.related.heading} items={relatedItems} />
        </div>

        <aside className="pg-aside">
          <section className="card card-pad night-what m-first" aria-labelledby="night-what-h">
            <h2 id="night-what-h" className="t-eyebrow">{c.sections.what.title}</h2>
            <p className="t-small m-0">
              {fill(c.sections.what.bodyBefore)}
              <strong>{fill(c.sections.what.bodyDate)}</strong>
              {fill(c.sections.what.bodyAfter)}
            </p>
          </section>
          <section className="card card-pad night-food" aria-labelledby="night-food-h">
            <IconBox name="food" size={18} />
            <div>
              <h2 id="night-food-h" className="t-h3">{c.sections.food.title}</h2>
              <p className="t-small m-0">{c.sections.food.body}</p>
            </div>
          </section>
          <section className="night-faq" aria-labelledby="night-faq-h">
            <h2 id="night-faq-h" className="t-h3">{c.sections.faq.title}</h2>
            <FaqAccordion items={faq} defaultOpen={[0]} singleOpen={false} />
          </section>
        </aside>
      </div>
      <SiteFooter />
    </>
  );
}
